import React, { useCallback, useEffect, useState, useRef } from 'react';
import { useGalideAppStore, FileInfo, UIViewInfo } from '../store/galideAppStore';
import { useSpaceStore } from '../../../stores/spaceStore';
import './GalideApp.scss';
import GalideEditor from './GalideEditor';
import GalideExplorer, { GalideExplorerMethods } from './GalideExplorer';
import GalideTabBar from './GalideTabBar';
import GalideUIRenderer from './GalideUIRenderer';
import WindowWrapper from '../../../WindowWrapper';
import { useFileService } from '../../../services/FileService';
import * as galideService from '../services/galideService';

export interface GalideAppProps {
  projectId?: string;
  entityId?: string; // Generic entity ID instead of specific fileId/uiViewId
  entityType?: string; // Add type information
  onClose?: () => void;
  windowId: string;
  spaceId: string;
  title?: string;
}

// Create a separate content component to avoid duplication
const GalideAppContent: React.FC<Omit<GalideAppProps, 'onClose' | 'title'>> = ({ 
  projectId, 
  entityId,
  entityType,
  windowId, 
  spaceId 
}) => {
  const { 
    initialize, 
    activeFileId,
    activeUIViewId, 
    setFileId,
    setUIViewId,
    openFiles,
    openUIViews,
    isSidebarOpen,
    toggleSidebar,
    closeFile,
    closeUIView,
    openFile,
    openUIView
  } = useGalideAppStore(windowId, spaceId);
  
  const { updateWindow } = useSpaceStore();
  const fileService = useFileService();
  
  const [isUIView, setIsUIView] = useState(false);
  const [localProjectId, setLocalProjectId] = useState<string | null>(() => {
    // First prioritize prop
    if (projectId) return projectId;
    
    // Then check URL
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const urlProjectId = urlParams.get('projectId');
      
      if (urlProjectId) return urlProjectId;
      
      // Finally check localStorage
      const savedProjectId = localStorage.getItem('lastOpenProjectId');
      if (savedProjectId) return savedProjectId;
    }
    
    return null;
  });

  useEffect(() => {
    initialize(localProjectId);
    
    // Handle initial entity selection based on entityType
    if (entityId && entityType) {
      if (entityType.toLowerCase() === 'file') {
        setFileId(entityId);
        setIsUIView(false);
      } else if (entityType.toLowerCase() === 'uiview' || entityType.toLowerCase() === 'ui') {
        setUIViewId(entityId);
        setIsUIView(true);
      }
    }
  }, [initialize, localProjectId, entityId, entityType, setFileId, setUIViewId]);

  useEffect(() => {
    if (projectId !== undefined && projectId !== localProjectId) {
      setLocalProjectId(projectId || null);
    }
  }, [projectId]);

  // Sync state back to window entity
  useEffect(() => {
    if (windowId) {
      updateWindow(windowId, {
        applicationState: {
          galide: {
            projectId: localProjectId || undefined,
            activeFileId,
            activeUIViewId,
            isUIView
          }
        }
      });
    }
  }, [windowId, localProjectId, activeFileId, activeUIViewId, isUIView, updateWindow]);

  // Handle entity selection from the explorer
  const handleEntitySelect = useCallback(async (id: string, type: string) => {
    console.log(`[GalideApp] Entity selected: ${id} of type ${type}`);
    
    if (type.toLowerCase() === 'file') {
      try {
        // Fetch the file details using the fileService from the outer scope
        const fileEntities = await fileService.getList();
        const fileEntity = fileEntities.find(entity => entity._id === id);
        
        if (fileEntity) {
          // Create a FileInfo object with safe property access
          const fileInfo: FileInfo = {
            id: fileEntity._id,
            name: fileEntity.name || 'Untitled',
            path: fileEntity.skeleton?.path || '', // Using optional chaining for skeleton.path
            type: 'file',
            content: '' // Content will be loaded by the editor
          };
          
          // Open the file (adds to openFiles array)
          openFile(fileInfo);
          
          // Set as active file
          setFileId(id);
          setIsUIView(false);
        } else {
          console.error(`File with ID ${id} not found`);
        }
      } catch (error) {
        console.error('Error opening file:', error);
      }
    } else if (type.toLowerCase() === 'uiview' || type.toLowerCase() === 'ui') {
      // Handle UI view selection
      
      try {
        // Fetch the UI entity details
        const uiEntity = await galideService.getUIView(id);
        
        const uiViewInfo: UIViewInfo = {
          id: id,
          name: uiEntity.name || `UI View ${id}`,
          type: 'generic',
          config: uiEntity.skeleton?.config || {},
          url: uiEntity.skeleton?.url,
          htmlContent: uiEntity.skeleton?.htmlContent
        };
        
        
        // Open the UI view
        openUIView(uiViewInfo);
      } catch (error) {
        console.error(`Error opening UI view ${id}:`, error);
        
        // Create a minimal UIViewInfo even if the fetch fails
        // This will allow the UIViewRenderer to handle fetching details itself as a fallback
        const fallbackUIViewInfo: UIViewInfo = {
          id: id,
          name: `UI View ${id.substring(0, 8)}...`,
          type: 'generic',
          config: {},
          // Add default HTML content as a fallback
          htmlContent: `
            <html>
              <head>
                <title>UI View ${id}</title>
                <style>
                  body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    padding: 20px;
                    background-color: #f5f5f5;
                    color: #333;
                    text-align: center;
                  }
                  h1 { color: #0066cc; }
                  .content { margin-top: 30px; }
                  button {
                    background-color: #0066cc;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                    margin-top: 20px;
                  }
                </style>
              </head>
              <body>
                <h1>UI View</h1>
                <p>This is a custom UI view component.</p>
                <div class="content">
                  <p>Entity ID: ${id}</p>
                  <button onclick="window.parent.postMessage({type: 'UI_ACTION', action: 'refresh'}, '*')">
                    Refresh
                  </button>
                </div>
              </body>
            </html>
          `
        };
        
        openUIView(fallbackUIViewInfo);
      }
      
      // Set as active UI view
      setUIViewId(id);
      setIsUIView(true);
    } else {
      // Handle other entity types (for future expansion)
      console.log(`Selected entity of type ${type}: ${id}`);
    }
  }, [setFileId, setUIViewId, openFile, openUIView, fileService, galideService]);

  const handleTabChange = useCallback((id: string, isUI: boolean) => {
    if (isUI) {
      setUIViewId(id);
      setIsUIView(true);
    } else {
      setFileId(id);
      setIsUIView(false);
    }
  }, [setFileId, setUIViewId]);

  const handleTabClose = useCallback((id: string, isUI: boolean) => {
    if (isUI) {
      closeUIView(id);
      // If we closed the active UI view, switch to a file if available
      if (id === activeUIViewId) {
        if (openUIViews.length > 1) {
          // Find the next UI view to show
          const index = openUIViews.findIndex((v: UIViewInfo) => v.id === id);
          const nextView = openUIViews[index === 0 ? 1 : index - 1];
          if (nextView) {
            setUIViewId(nextView.id);
          }
        } else if (openFiles.length > 0) {
          // Switch to a file if no UI views left
          setFileId(openFiles[0].id);
          setIsUIView(false);
        }
      }
    } else {
      closeFile(id);
      // If we closed the active file, switch to another file or UI view
      if (id === activeFileId) {
        if (openFiles.length > 1) {
          // Find the next file to show
          const index = openFiles.findIndex((f: FileInfo) => f.id === id);
          const nextFile = openFiles[index === 0 ? 1 : index - 1];
          if (nextFile) {
            setFileId(nextFile.id);
          }
        } else if (openUIViews.length > 0) {
          // Switch to a UI view if no files left
          setUIViewId(openUIViews[0].id);
          setIsUIView(true);
        }
      }
    }
  }, [
    closeFile, 
    closeUIView, 
    activeFileId, 
    activeUIViewId, 
    openFiles, 
    openUIViews, 
    setFileId, 
    setUIViewId
  ]);

  return (
    <div className="neurvana-app">
      <div className="neurvana-app-main">
        {isSidebarOpen && (
          <div className="neurvana-app-sidebar">
            <GalideExplorer 
              projectId={localProjectId}
              onEntitySelect={handleEntitySelect}
            />
          </div>
        )}
        
        <div className="neurvana-app-content-wrapper">
          <div className="neurvana-app-header">
            <button 
              className="sidebar-toggle"
              onClick={toggleSidebar}
            >
              {isSidebarOpen ? '◀' : '▶'}
            </button>
            <GalideTabBar 
              openFiles={openFiles}
              openUIViews={openUIViews}
              activeFileId={activeFileId}
              activeUIViewId={activeUIViewId}
              isUIView={isUIView}
              onTabChange={handleTabChange}
              onTabClose={handleTabClose}
            />
          </div>
          
          <div className="neurvana-app-content">
            {isUIView ? (
              <GalideUIRenderer 
                uiViewId={activeUIViewId}
                projectId={localProjectId}
                windowId={windowId}
                spaceId={spaceId}
              />
            ) : (
              <GalideEditor 
                fileId={activeFileId}
                projectId={localProjectId}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const GalideApp: React.FC<GalideAppProps> = ({ 
  onClose,
  title = 'Galide',
  ...props
}) => {
  const [displayTitle, setDisplayTitle] = useState(title);
  const explorerRef = useRef<GalideExplorerMethods | null>(null);

  // Update title when window is focused or project changes
  useEffect(() => {
    if (props.projectId) {
      // Fetch project name to use as title
      const fetchProjectName = async () => {
        try {
          // Here you would use your service to get project details
          const projectName = localStorage.getItem(`project_${props.projectId}_name`);
          if (projectName) {
            setDisplayTitle(projectName);
          }
        } catch (error) {
          console.error('Error fetching project name:', error);
        }
      };
      
      fetchProjectName();
    }
  }, [props.projectId]);
  
  // Initialize explorerRef with methods when window.galideExplorerMethods is available
  useEffect(() => {
    const checkForMethods = () => {
      if (window && (window as any).galideExplorerMethods) {
        explorerRef.current = (window as any).galideExplorerMethods;
      }
    };
    
    // Check immediately
    checkForMethods();
    
    // Set up interval to check periodically (in case the Explorer loads after this component)
    const interval = setInterval(checkForMethods, 500);
    
    // Clear interval on unmount
    return () => clearInterval(interval);
  }, []);
  
  // Handlers for project actions
  const handleCreateNewGroup = () => {
    if (explorerRef.current) {
      explorerRef.current.handleCreateNewGroup();
    } else if (window && (window as any).galideExplorerMethods) {
      (window as any).galideExplorerMethods.handleCreateNewGroup();
    }
  };
  
  const handleOpenProject = () => {
    if (explorerRef.current) {
      explorerRef.current.handleOpenProject();
    } else if (window && (window as any).galideExplorerMethods) {
      (window as any).galideExplorerMethods.handleOpenProject();
    }
  };
  
  return (
    <WindowWrapper 
      onClose={onClose} 
      title={displayTitle}
      showProjectActions={true}
      onCreateNewGroup={handleCreateNewGroup}
      onOpenProject={handleOpenProject}
    >
      <GalideAppContent {...props} />
    </WindowWrapper>
  );
};

export default GalideApp; 