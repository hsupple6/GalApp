import React, { useEffect, useMemo, useState } from 'react';
import usePresenceStore, { CursorData } from '../../../stores/presenceStore';
import { presenceCRDTService } from '../../../services/crdt/presenceCRDTService';
import './UserPresence.scss';

interface UserPresenceProps {
  spaceId: string;
  user: any; // Auth0 user object
}

// Simple tooltip component
const Tooltip: React.FC<{
  show: boolean;
  text: string;
  secondaryText?: string;
}> = ({ show, text, secondaryText }) => {
  if (!show) return null;
  
  return (
    <div className="user-tooltip">
      {text}
      {secondaryText && <div className="tooltip-secondary">{secondaryText}</div>}
    </div>
  );
};

const UserPresence: React.FC<UserPresenceProps> = ({ spaceId, user }) => {
  const [cursors, setCursors] = useState<Record<string, CursorData>>({});
  const clientId = usePresenceStore((state) => state.clientId);
  const userId = usePresenceStore((state) => state.userId);
  const [hoverAvatarId, setHoverAvatarId] = useState<string | null>(null);
  
  // Initialize user presence for this space
  useEffect(() => {
    if (!spaceId || !user) return;
    
    // console.log('[UserPresence] Initializing presence for space:', spaceId);
    let cleanupFn: (() => void) | void;
    
    const setupPresence = async () => {
      try {
        // Initialize presence in the store
        const initializePresence = usePresenceStore.getState().initializePresence;
        usePresenceStore.getState().setUser(user);
        
        // Initialize presence with this space and the Auth0 user
        cleanupFn = await initializePresence(spaceId, user);
        // console.log('[UserPresence] Presence initialized successfully');
      } catch (error) {
        console.error('[UserPresence] Failed to initialize presence:', error);
      }
    };
    
    setupPresence();
    
    return () => {
      // console.log('[UserPresence] Cleaning up presence');
      if (typeof cleanupFn === 'function') {
        cleanupFn();
      }
    };
  }, [spaceId, user]);
  
  // Sync cursor data from presence store
  useEffect(() => {
    const unsubscribe = usePresenceStore.subscribe((state) => {
      // Filter out null cursors and convert to our expected type
      const filteredCursors = Object.entries(state.cursors)
        .filter(([_, cursor]) => cursor !== null && cursor !== undefined)
        .reduce((acc, [id, cursor]) => {
          acc[id] = cursor as CursorData;
          return acc;
        }, {} as Record<string, CursorData>);
      
      setCursors(filteredCursors);
    });
    
    return () => unsubscribe();
  }, []);

  // Group users by userId to handle multiple sessions from the same user
  const userSessions = useMemo(() => {
    // First ensure we have cursor data
    if (Object.keys(cursors).length === 0) {
      return [];
    }
    
    // Group by userId
    const userGroups = new Map<string, { userId: string, sessions: { id: string, data: CursorData }[] }>();
    
    Object.entries(cursors).forEach(([id, data]) => {
      if (!data || !data.userId) return; // Skip invalid entries
      
      const userId = data.userId;
      if (!userGroups.has(userId)) {
        userGroups.set(userId, { 
          userId, 
          sessions: [] 
        });
      }
      
      userGroups.get(userId)?.sessions.push({ id, data });
    });
    
    return Array.from(userGroups.values());
  }, [cursors]);

  // Render the user avatars
  const renderUserAvatars = useMemo(() => {
    // console.log('[UserPresence] Rendering user sessions:', userSessions.length);
    
    return (
      <div className="user-avatars">
        {userSessions.map(userGroup => {
          const isCurrentUser = userGroup.userId === userId;
          const firstSession = userGroup.sessions[0];
          const userData = firstSession.data;
          const sessionsCount = userGroup.sessions.length;
          
          return (
            <div 
              key={userGroup.userId} 
              className={`avatar-group ${isCurrentUser ? 'current-user-group' : ''}`}
              onMouseEnter={() => setHoverAvatarId(userGroup.userId)}
              onMouseLeave={() => setHoverAvatarId(null)}
            >
              <div className="avatar">
                {userData.picture ? (
                  <img src={userData.picture} alt={userData.displayName || "User"} />
                ) : (
                  <div 
                    className="avatar-placeholder" 
                    style={{ backgroundColor: userData.color || '#ff0000' }}
                  >
                    {(userData.displayName?.[0] || userData.username?.[0] || "U").toUpperCase()}
                  </div>
                )}
                
                {/* Show badge with session count if more than 1 */}
                {sessionsCount > 1 && (
                  <div className="session-count">{sessionsCount}</div>
                )}
                
                {/* Show tooltip on hover */}
                {hoverAvatarId === userGroup.userId && (
                  <Tooltip 
                    show={true} 
                    text={isCurrentUser 
                      ? `You (${userData.displayName || userData.username || "User"})` 
                      : (userData.displayName || userData.username || "User")}
                    secondaryText={sessionsCount > 1 ? `${sessionsCount} active sessions` : undefined}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }, [userSessions, userId, hoverAvatarId]);

  return renderUserAvatars;
};

export default UserPresence;

// Also export a function to get cursor components for rendering in the space
export const useCursorPresence = () => {
  const [cursors, setCursors] = useState<Record<string, CursorData>>({});
  const clientId = usePresenceStore((state) => state.clientId);
  
  // Sync cursor data from presence store with more frequent updates
  useEffect(() => {
    const unsubscribe = usePresenceStore.subscribe((state) => {
      // Filter out null values and convert to the expected Record<string, CursorData> type
      const filteredCursors = Object.entries(state.cursors)
        .filter(([_, cursor]) => cursor !== null && cursor !== undefined)
        .reduce((acc, [id, cursor]) => {
          acc[id] = cursor as CursorData;
          return acc;
        }, {} as Record<string, CursorData>);
      
      setCursors(filteredCursors);
    });
    
    return () => unsubscribe();
  }, []);
  
  // Render the cursors with smooth transitions
  const renderCursors = useMemo(() => {
    return Object.entries(cursors)
      .filter(([key]) => key !== clientId)
      .map(([key, cursor]) =>
        cursor ? (
          <div
            key={key}
            className="cursor"
            style={{
              position: 'absolute',
              zIndex: '99999',
              left: `${cursor.x}px`,
              top: `${cursor.y}px`,
              backgroundColor: cursor.color || '#ff0000',
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              pointerEvents: 'none',
              fontSize: '8px',
              transition: 'left 0.08s ease-out, top 0.08s ease-out',
              boxShadow: '0 0 0 2px rgba(255,255,255,0.8)',
              transform: 'translate(-50%, -50%)',
            }}
          >
            <div 
              className="cursor-label"
              style={{
                position: 'absolute',
                top: '12px',
                left: '12px',
                background: 'rgba(0,0,0,0.8)',
                color: '#fff',
                padding: '2px 5px',
                borderRadius: '3px',
                fontSize: '10px',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                zIndex: '100000',
              }}
            >
              {cursor.displayName || cursor.username || (cursor.userId ? `User-${cursor.userId.slice(0, 4)}` : 'Unknown User')}
            </div>
          </div>
        ) : null,
      );
  }, [cursors, clientId]);
  
  return { renderCursors };
}; 