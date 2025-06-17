import type { CursorData } from '../../stores/presenceStore';
import { crdtServiceWS } from './crdtServiceWS';

/**
 * A service to handle user presence in spaces using CRDT
 */
class PresenceCRDTService {
    private debug = false;
    private activeConnections: Record<string, boolean> = {}; // Track active connections by space

    constructor() {
        // Add a cleanup handler for when the window is closed
        if (typeof window !== 'undefined') {
            window.addEventListener('beforeunload', (e) => {
                // Get the client ID from local storage if available
                const clientId = localStorage.getItem('presence_client_id');
                const spaceId = localStorage.getItem('presence_space_id');
                
                if (clientId && spaceId) {
                    this.log('Window unloading, cleaning up presence for', clientId);
                    this.removePresence(spaceId, clientId);
                }
            });
        }
    }
    
    private log(...args: any[]) {
        if (this.debug) {
            console.log('[PresenceCRDT]', ...args);
        }
    }
    
    /**
     * Update the presence data for a client in a space
     * @param immediate Ignored parameter for backward compatibility
     */
    updatePresence(spaceId: string, clientId: string, data: CursorData | null, immediate = false): void {
        try {
            // Save these values for cleanup on page unload
            if (clientId) {
                localStorage.setItem('presence_client_id', clientId);
            }
            if (spaceId) {
                localStorage.setItem('presence_space_id', spaceId);
            }
            
            // Mark this space as having an active connection
            this.activeConnections[spaceId] = true;
            
            // Create the key for the CRDT
            const key = `presence-${spaceId}`;
            
            if (data === null) {
                // If data is null, remove the presence
                this.log('Removing presence for client', clientId);
                
                // Send removal immediately
                crdtServiceWS.update(key, { 
                    [clientId]: null 
                }, {
                    updateType: 'remove',
                    preserveOtherConnections: true
                });
            } else {
                // Otherwise, update the presence with the new data
                this.log('Updating presence for client', clientId);
                
                // Add a timestamp to the data
                const updatedData = {
                    ...data,
                    lastUpdated: Date.now()
                };
                
                // Send update immediately
                crdtServiceWS.update(key, { 
                    [clientId]: updatedData 
                }, {
                    updateType: 'update',
                    preserveOtherConnections: true
                });
            }
        } catch (error) {
            console.error('[PresenceCRDT] Error updating presence:', error);
        }
    }

    /**
     * Remove presence data for a client in a space
     */
    removePresence(spaceId: string, clientId: string): void {
        try {
            // Send removal directly to ensure immediate cleanup
            const key = `presence-${spaceId}`;
            
            crdtServiceWS.update(key, { 
                [clientId]: null 
            }, {
                updateType: 'remove',
                preserveOtherConnections: true
            });
            
            // Mark this space as no longer having an active connection
            delete this.activeConnections[spaceId];
        } catch (error) {
            console.error('[PresenceCRDT] Error removing presence:', error);
        }
    }
    
    /**
     * Connect to a space's presence data
     */
    connectToSpace(spaceId: string, onUpdate: (data: Record<string, CursorData | null>) => void): () => void {
        const key = `presence-${spaceId}`;
        
        // Mark this space as having an active connection
        this.activeConnections[spaceId] = true;
        
        // Connect to the CRDT service for updates
        const disconnect = crdtServiceWS.connect<Record<string, CursorData | null>>(key, (update) => {
            if (update && update.data) {
                this.log('Received presence update:', update);
                
                // Filter out null entries and process the data
                const filteredData = this.processPresenceData(update.data);
                
                // Call the callback with the filtered data
                onUpdate(filteredData);
            }
        });
        
        // Return a cleanup function that also handles our internal state
        return () => {
            // Call the original disconnect function
            disconnect();
            
            // Mark this space as no longer having an active connection
            delete this.activeConnections[spaceId];
        };
    }
    
    /**
     * Process presence data to filter out null entries and stale cursors
     */
    private processPresenceData(data: Record<string, CursorData | null>): Record<string, CursorData | null> {
        const result: Record<string, CursorData | null> = {};
        const now = Date.now();
        const staleThreshold = 30000; // 30 seconds
        
        for (const [clientId, cursor] of Object.entries(data)) {
            // Skip null or undefined cursors
            if (!cursor) continue;
            
            // Skip stale cursors
            if (cursor.lastActive && now - cursor.lastActive > staleThreshold) {
                this.log('Filtering out stale cursor for client', clientId);
                continue;
            }
            
            // Include valid cursors
            result[clientId] = cursor;
        }
        
        return result;
    }
}

// Export a singleton instance
export const presenceCRDTService = new PresenceCRDTService(); 