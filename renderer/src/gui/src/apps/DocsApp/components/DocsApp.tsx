import './DocsApp.scss';

import { useDocsAppStore } from '../store/docsAppStore';
import { useSpaceStore } from '../../../stores/spaceStore';
import React, { useCallback, useEffect, useState, forwardRef, useRef } from 'react';

import DocsEditor, { DocsEditorRef } from './DocsEditor';
import DocsOverview from './DocsOverview';
import { DocEntity } from 'types/docs';
import WindowWrapper from '../../../WindowWrapper';
import { DocsAppState } from 'types/appState';
import { logger } from 'utils/logger';



export interface DocsAppProps {
  windowId: string;
  spaceId: string;
  onClose?: () => void;
  title?: string;
}

const DocsApp = forwardRef<DocsEditorRef, DocsAppProps>(({ windowId, spaceId, onClose, title = 'Documents' }, ref) => {
  const { 
    initialize, 
    createDoc, 
    recentDocs, 
    fetchRecentDocs, 
    setDocId, 
    docId: activeDocId,
    editorViewGetCurrentText,
    storeId,
    editorView,
    isInitializing,
    isInitialized,
  } = useDocsAppStore(windowId, spaceId);
  
  const { updateWindow, windows } = useSpaceStore();
  const initStateRef = useRef({
    hasInitialized: false,
    hasAttemptedInit: false,
    hasLoadedWindowState: false
  });
  const [loadingStatus, setLoadingStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');

  // Load state from window entity - this happens only once and is the source of truth
  useEffect(() => {
    if (initStateRef.current.hasLoadedWindowState || loadingStatus !== 'idle') return;

    setLoadingStatus('loading');
    logger.log('[DocsApp] Checking for window state...', { windowId, windows });
    
    if (windowId && windows[windowId]) {
      const window = windows[windowId];
      const appState = window.applicationState?.docs;
      
      if (appState?.activeDocId) {
        logger.log('[DocsApp] Found window state with active doc:', appState);
        initStateRef.current.hasLoadedWindowState = true;
        
        // Set docId before initializing
        setDocId(appState.activeDocId);
        
        // Don't try to initialize yet, we'll do that in the next effect
        setLoadingStatus('loaded');
      } else {
        logger.log('[DocsApp] No doc ID in window state');
        initStateRef.current.hasLoadedWindowState = true;
        setLoadingStatus('loaded');
      }
    } else {
      logger.log('[DocsApp] No window data available');
      initStateRef.current.hasLoadedWindowState = true;
      setLoadingStatus('loaded');
    }
  }, [windowId, windows, setDocId]);

  // Initialize content after loading window state
  useEffect(() => {
    if (initStateRef.current.hasAttemptedInit || loadingStatus !== 'loaded') return;
    
    initStateRef.current.hasAttemptedInit = true;
    logger.log('[DocsApp] Starting initialization after loading window state');
    
    const initAsync = async () => {
      try {
        if (activeDocId) {
          logger.log('[DocsApp] Initializing with doc:', activeDocId);
          await initialize(activeDocId);
          initStateRef.current.hasInitialized = true;
          logger.log('[DocsApp] Successfully initialized with doc');
        } else {
          logger.log('[DocsApp] No doc ID, fetching recent docs');
          await fetchRecentDocs();
          logger.log('[DocsApp] Successfully fetched recent docs');
        }
      } catch (err) {
        logger.error('[DocsApp] Error during initialization:', err);
        await fetchRecentDocs();
      }
    };
    
    initAsync();
  }, [activeDocId, initialize, fetchRecentDocs, loadingStatus]);

  // Fetch recent docs if no active doc
  useEffect(() => {
    if (!initStateRef.current.hasLoadedWindowState || activeDocId || !loadingStatus) return;
    
    logger.log('[DocsApp] No active document, fetching recent docs');
    fetchRecentDocs();
  }, [activeDocId, fetchRecentDocs, loadingStatus]);

  const resetSelectedDocId = useCallback(() => {
    setDocId(null);
  }, [setDocId]);

  const handleDocIdChange = useCallback((id: string, docEntity?: DocEntity) => {
    logger.log('[DocsApp] Document selection changed:', id);
    initialize(id, docEntity);
    setDocId(id);
  }, [initialize, setDocId]);

  // Sync state back to window entity - debounced to avoid excessive updates
  const syncStateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    if (!windowId || isInitializing) return;
    
    if (syncStateTimeoutRef.current) {
      clearTimeout(syncStateTimeoutRef.current);
    }
    
    syncStateTimeoutRef.current = setTimeout(() => {
      if (activeDocId && editorView) {
        try {
          const currentContent = editorViewGetCurrentText();
          // Find the active document in recentDocs to get its name
          const activeDoc = recentDocs.find(doc => doc.id === activeDocId);
          
          const docsAppState: DocsAppState = {
            activeDocId: activeDocId,
            content: currentContent,
            currentDocName: activeDoc?.name || 'Untitled Document',
            currentState: 'editing',
            recentDocs: recentDocs.map(d => {
              return {
                docId: d._id,
                name: d.name,
              }
            })
          };
          
          logger.log('[DocsApp] Syncing editor state to window:', windowId);
          updateWindow(windowId, {
            applicationState: {
              docs: docsAppState
            }
          });
        } catch (e) {
          logger.error('[DocsApp] Error syncing state:', e);
        }
      } else {
        const docsAppState: DocsAppState = {
          activeDocId: undefined,
          content: '',
          currentState: 'overview',
          recentDocs: recentDocs.map(d => {
            return {
              docId: d._id,
              name: d.name,
            }
          })
        };
        
        logger.log('[DocsApp] Syncing overview state to window:', windowId);
        updateWindow(windowId, {
          applicationState: {
            docs: docsAppState
          }
        });
      }
      syncStateTimeoutRef.current = null;
    }, 300); // 300ms debounce
    
    return () => {
      if (syncStateTimeoutRef.current) {
        clearTimeout(syncStateTimeoutRef.current);
      }
    };
  }, [windowId, activeDocId, editorView, editorViewGetCurrentText, updateWindow, recentDocs, isInitializing]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      logger.log('[DocsApp] Component unmounting, cleaning up');
      if (syncStateTimeoutRef.current) {
        clearTimeout(syncStateTimeoutRef.current);
      }
    };
  }, []);

  const docsContent = (
    <div className="docs-app">
      {activeDocId ? (
        <DocsEditor
          ref={ref}
          docId={activeDocId}
          windowId={windowId}
          spaceId={spaceId}
          onBack={resetSelectedDocId}
          onClose={onClose}
        />
      ) : (
        <DocsOverview
          show={!activeDocId}
          recentDocs={recentDocs}
          onCreateNew={async () => {
            const newDoc = await createDoc();
            if (newDoc.id) {
              handleDocIdChange(newDoc.id, newDoc);
            }
          }}
          onSelectDoc={handleDocIdChange}
        />
      )}
    </div>
  );

  // Conditionally wrap in WindowWrapper based on GUI vs standalone
  return onClose ? (
    <WindowWrapper title={title} onClose={onClose}>
      {docsContent}
    </WindowWrapper>
  ) : (
    docsContent
  );
});

DocsApp.displayName = 'DocsApp';

export default DocsApp;