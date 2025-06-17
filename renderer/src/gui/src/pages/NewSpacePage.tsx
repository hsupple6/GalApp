import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { spaceService } from '../services/spaceService';
import { logger } from 'utils/logger';

/**
 * This component checks for a recent space first, and only creates a new space if none exists.
 * It uses a combination of ref and tab-specific session storage to prevent duplicate operations
 * in a single tab while allowing multiple tabs to work independently.
 */
const NewSpacePage = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('Checking for recent space...');
  
  // This ref persists across renders within the same component instance
  const operationInProgress = useRef(false);
  
  // Generate a unique session ID for this component instance if needed
  const getSessionId = () => {
    const existingId = sessionStorage.getItem('SPACE_OPERATION_SESSION_ID');
    if (existingId) return existingId;
    
    const newId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    sessionStorage.setItem('SPACE_OPERATION_SESSION_ID', newId);
    return newId;
  };
  
  // Get or create session ID for this browser tab
  const sessionId = getSessionId();

  useEffect(() => {
    // If this component instance is already processing, don't start again
    if (operationInProgress.current) {
      logger.log('[NewSpacePage] Operation already in progress in this component instance');
      return;
    }
    
    // Set the flag for this component instance
    operationInProgress.current = true;
    
    // Check if we're already in the middle of an operation in this tab
    const operationState = sessionStorage.getItem(`SPACE_OPERATION_${sessionId}`);
    if (operationState === 'in_progress') {
      logger.log('[NewSpacePage] Operation already in progress in this tab');
      
      // Check for a stale lock (more than 30 seconds old)
      const timestamp = parseInt(sessionStorage.getItem(`SPACE_OPERATION_${sessionId}_TIME`) || '0', 10);
      if (Date.now() - timestamp > 30000) {
        logger.log('[NewSpacePage] Stale lock detected, resetting');
        sessionStorage.removeItem(`SPACE_OPERATION_${sessionId}`);
        sessionStorage.removeItem(`SPACE_OPERATION_${sessionId}_TIME`);
      } else {
        return; // Wait for the other instance to complete
      }
    }
    
    // Set the tab-specific lock
    sessionStorage.setItem(`SPACE_OPERATION_${sessionId}`, 'in_progress');
    sessionStorage.setItem(`SPACE_OPERATION_${sessionId}_TIME`, Date.now().toString());
    
    // Function to handle space logic
    const handleSpaceLogic = async () => {
      try {
        logger.log(`[NewSpacePage] Starting space logic for session ${sessionId}...`);
        
        // First, try to get the most recent space
        setStatus('Checking for recent space...');
        const recentSpace = await spaceService.fetchRecentSpace();
        
        if (recentSpace) {
          logger.log(`[NewSpacePage] Found recent space: ${recentSpace.id}`);
          setStatus('Found recent space, redirecting...');
          
          // Save the space ID in case we need it later
          sessionStorage.setItem(`SPACE_OPERATION_${sessionId}_RESULT`, recentSpace.id);
          sessionStorage.setItem(`SPACE_OPERATION_${sessionId}`, 'complete');
          
          // Navigate to the recent space
          navigate(`/spaces/${recentSpace.id}`, { replace: true });
          return;
        }
        
        // No recent space found, create a new one
        logger.log(`[NewSpacePage] No recent space found, creating new space...`);
        setStatus('Creating new space...');
        
        const newSpace = await spaceService.createSpace('New Space');
        
        logger.log(`[NewSpacePage] Space created successfully with ID: ${newSpace.id}`);
        
        // Save the space ID in case we need it later
        sessionStorage.setItem(`SPACE_OPERATION_${sessionId}_RESULT`, newSpace.id);
        sessionStorage.setItem(`SPACE_OPERATION_${sessionId}`, 'complete');
        
        // Navigate to the new space
        navigate(`/spaces/${newSpace.id}`, { replace: true });
      } catch (err) {
        logger.error('[NewSpacePage] Failed to handle space logic:', err);
        setError('Failed to load or create space. Please try again.');
        
        // Release the lock on error
        sessionStorage.removeItem(`SPACE_OPERATION_${sessionId}`);
        sessionStorage.removeItem(`SPACE_OPERATION_${sessionId}_TIME`);
        
        // Wait a moment and redirect to home
        setTimeout(() => {
          navigate('/home');
        }, 2000);
      } finally {
        setIsLoading(false);
      }
    };

    // Start the space logic
    handleSpaceLogic();

    // Cleanup function
    return () => {
      // Clear the session storage if navigating to a new space (success case)
      // or keep it for error handling
      if (window.location.pathname.includes('/spaces/')) {
        sessionStorage.removeItem(`SPACE_OPERATION_${sessionId}`);
        sessionStorage.removeItem(`SPACE_OPERATION_${sessionId}_TIME`);
        logger.log(`[NewSpacePage] Navigation complete, cleaning up for session ${sessionId}`);
      }
    };
  }, [navigate, sessionId]);

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column',
      alignItems: 'center', 
      justifyContent: 'center', 
      height: '100vh',
      background: '#1e1e1e',
      color: '#fff'
    }}>
      <div style={{ fontSize: '24px', marginBottom: '20px' }}>
        {error || status}
      </div>
      {isLoading && (
        <div style={{ 
          width: '50px', 
          height: '50px', 
          border: '5px solid #333', 
          borderTopColor: '#fff', 
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
      )}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default NewSpacePage;
