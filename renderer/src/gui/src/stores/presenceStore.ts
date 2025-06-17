import { v4 as uuidv4 } from 'uuid';
import { create } from 'zustand';

import { presenceCRDTService } from '../services/crdt/presenceCRDTService';
import { logger } from '../utils/logger';

export interface CursorData {
    x: number;
    y: number;
    userId: string;     // Consistent user ID (same across tabs)
    sessionId: string;  // Unique ID for this specific browser tab
    username?: string;
    displayName?: string; // User's display name from Auth0
    email?: string;      // User's email from Auth0
    picture?: string;    // User's profile picture from Auth0
    color?: string;
    lastActive?: number; // Timestamp of last activity
    lastUpdated?: number; // Timestamp of last update
}

interface PresenceState {
    cursors: Record<string, CursorData | null>;
    clientId: string;
    userId: string;
    spaceId: string | null;
    status: 'idle' | 'loading' | 'error';
    error?: Error;
    lastPosition: { x: number, y: number }; // Store last position
    user: any; // Auth0 user object
    isActive: boolean; // Track if user is active or idle
}

interface PresenceStore extends PresenceState {
    setCursor: (x: number, y: number) => void;
    cleanup: () => void;
    initializePresence: (spaceId: string, user: any) => Promise<(() => void) | void>;
    sendPresenceHeartbeat: () => void; // Method to send heartbeat
    setUser: (user: any) => void; // Method to update user info
}

// Generate a unique ID for this browser tab/session
const generateClientId = () => {
    // Store the client ID in sessionStorage to keep it unique per tab
    // but persistent across page refreshes
    const existing = sessionStorage.getItem('presence_session_id');
    if (existing) {
        return existing;
    }
    
    const newId = uuidv4();
    sessionStorage.setItem('presence_session_id', newId);
    return newId;
};

// Get a persistent user ID - this should be the same across tabs for the same user
const getUserId = () => {
    // Try to use the user ID from localStorage if available
    // This ensures the same user ID is used across tabs
    const storedId = localStorage.getItem('presence_user_id');
    if (storedId) {
        return storedId;
    }
    
    // Generate a new user ID if none exists
    const newId = uuidv4().slice(0, 8);
    localStorage.setItem('presence_user_id', newId);
    return newId;
};

// Get a persistent color for this user
const getUserColor = () => {
    // Try to use the color from localStorage if available
    const storedColor = localStorage.getItem('presence_user_color');
    if (storedColor) {
        return storedColor;
    }
    
    // Generate a new color if none exists
    const colors = [
        '#FF5733', // Red-Orange
        '#33FF57', // Green
        '#3357FF', // Blue
        '#FF33A8', // Pink
        '#33FFF6', // Cyan
        '#F633FF', // Purple
        '#FFF633', // Yellow
    ];
    
    const newColor = colors[Math.floor(Math.random() * colors.length)];
    localStorage.setItem('presence_user_color', newColor);
    return newColor;
};

// Create the store
const usePresenceStore = create<PresenceStore>((set, get) => {
    // Initialize client ID - unique per tab
    const clientId = generateClientId();
    
    // Initialize user ID - same across tabs for the same user
    const userId = getUserId();
    
    // Initial store state
    const initialState: PresenceState = {
        cursors: {},
        clientId,
        userId,
        spaceId: null,
        status: 'idle',
        lastPosition: { x: 0, y: 0 },
        user: null,
        isActive: true, // Default to active
    };
    
    // Set initial state
    set(initialState);
    
    // Set up activity tracking
    let activityTimeout: NodeJS.Timeout | null = null;
    
    const trackActivity = () => {
        // Clear any existing timeout
        if (activityTimeout) {
            clearTimeout(activityTimeout);
        }
        
        // If user was inactive, mark as active and send an update
        const state = get();
        if (state.isActive === false) {
            set({ isActive: true });
            // Force an update to show we're active again
            if (state.spaceId) {
                const { lastPosition } = state;
                get().setCursor(lastPosition.x, lastPosition.y);
            }
        }
        
        // Set timeout to mark user as inactive after 60 seconds of no movement
        activityTimeout = setTimeout(() => {
            set({ isActive: false });
        }, 60000);
    };
    
    // Set up user activity listeners
    if (typeof window !== 'undefined') {
        // Use setTimeout to ensure store is fully initialized
        setTimeout(() => {
            window.addEventListener('mousemove', () => trackActivity());
            window.addEventListener('keydown', () => trackActivity());
            window.addEventListener('click', () => trackActivity());
            
            // Initial activity setup
            trackActivity();
        }, 0);
        
        // Add a beforeunload handler to clean up when the page is closed
        window.addEventListener('beforeunload', () => {
            const { spaceId } = get();
            if (spaceId) {
                // Sync cleanup call
                presenceCRDTService.removePresence(spaceId, clientId);
            }
        });
    }
    
    return {
        ...initialState,
        
        setUser: (user) => {
            set({ user });
        },
        
        initializePresence: async (spaceId: string, user: any) => {
            set({ status: 'loading', spaceId, user });
            logger.log(`[PresenceStore] Initializing presence for space: ${spaceId}, clientId: ${clientId}, userId: ${userId}`);
            
            try {
                // First ensure any previous presence for this client is cleaned up
                presenceCRDTService.removePresence(spaceId, clientId);
                
                // Connect to the space for real-time presence updates
                const disconnect = presenceCRDTService.connectToSpace(spaceId, (updatedCursors) => {
                    // Filter out our own cursor from this specific tab (clientId),
                    // but keep cursors from other tabs with same userId
                    const filteredCursors = { ...updatedCursors };
                    delete filteredCursors[clientId]; // Remove this specific tab's cursor
                    
                    // Always update cursors immediately with filtered data
                    set({ cursors: filteredCursors });
                });
                
                // Wait a moment for any previous connection to be fully cleaned up
                await new Promise(resolve => setTimeout(resolve, 50));
                
                // Send initial presence data
                const initialPresence: CursorData = {
                    x: 0,
                    y: 0,
                    userId,
                    sessionId: clientId,
                    username: user?.name || `User-${userId.slice(0, 4)}`,
                    displayName: user?.name,
                    email: user?.email,
                    picture: user?.picture,
                    color: getUserColor(),
                    lastActive: Date.now()
                };
                
                // Set up a heartbeat interval to maintain presence
                const heartbeatInterval = setInterval(() => {
                    const { lastPosition, isActive } = get();
                    if (isActive) {
                        sendHeartbeat(spaceId, clientId, userId, user, lastPosition.x, lastPosition.y);
                    }
                }, 5000); // Send heartbeats every 5 seconds
                
                // Send initial presence immediately
                presenceCRDTService.updatePresence(spaceId, clientId, initialPresence, true);
                
                // Update the status
                set({
                    status: 'idle'
                });
                
                // Return a cleanup function
                return () => {
                    logger.log('[PresenceStore] Cleaning up presence');
                    clearInterval(heartbeatInterval);
                    if (activityTimeout) {
                        clearTimeout(activityTimeout);
                    }
                    disconnect();
                    presenceCRDTService.removePresence(spaceId, clientId);
                };
            } catch (error) {
                set({ status: 'error', error: error as Error });
                logger.error('[PresenceStore] Error initializing presence:', error);
                throw error;
            }
        },
        
        setCursor: (x, y) => {
            const { clientId, spaceId, userId, user, isActive } = get();
            if (!spaceId || !isActive) return;
            
            // Check if a window drag operation is in progress
            // @ts-ignore - windowDragging is a global we'll set in Space.tsx
            if (window.__windowDragging) {
                // Skip cursor updates during window drag operations
                return;
            }
            
            // Update the last position
            const newPosition = { x, y };
            set({ lastPosition: newPosition });
            
            // Create the presence data
            const presenceData: CursorData = {
                x,
                y,
                userId,
                sessionId: clientId,
                username: user?.name || `User-${userId.slice(0, 4)}`,
                displayName: user?.name,
                email: user?.email,
                picture: user?.picture,
                color: getUserColor(),
                lastActive: Date.now()
            };
            
            // Send update immediately without throttling or batching
            presenceCRDTService.updatePresence(spaceId, clientId, presenceData, true);
            
            // We don't update local state for our own cursor since we filter it out
        },
        
        sendPresenceHeartbeat: () => {
            const { clientId, spaceId, userId, lastPosition, user, isActive } = get();
            if (!spaceId || !isActive) return;
            
            // Send a heartbeat with the last known position
            sendHeartbeat(spaceId, clientId, userId, user, lastPosition.x, lastPosition.y);
        },
        
        cleanup: () => {
            const { clientId, spaceId } = get();
            if (!spaceId) return;
            
            logger.log(`[PresenceStore] Explicit cleanup for clientId: ${clientId}`);
            
            // Remove this client's presence
            presenceCRDTService.removePresence(spaceId, clientId);
            
            // Reset the store state
            set({
                cursors: {},
                spaceId: null
            });
        }
    };
});

// Helper function to send a heartbeat
const sendHeartbeat = (
    spaceId: string,
    clientId: string,
    userId: string,
    user: any,
    x: number,
    y: number
) => {
    const presenceData: CursorData = {
        x,
        y,
        userId,
        sessionId: clientId,
        username: user?.name || `User-${userId.slice(0, 4)}`,
        displayName: user?.name,
        email: user?.email,
        picture: user?.picture,
        color: getUserColor(),
        lastActive: Date.now()
    };
    
    // Update presence with the latest data
    presenceCRDTService.updatePresence(spaceId, clientId, presenceData);
};

export default usePresenceStore;
