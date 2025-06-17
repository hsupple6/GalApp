import React, { useRef, useState, useEffect } from 'react';
import SpaceChat from '../SpaceChat/SpaceChat';
import { AnyWindowEntity } from '../../../types/windows';
import './FocusedLayout.scss';
import SystemMenuButton from '../SystemMenuButton/SystemMenuButton';
import SpaceDetailsButton from '../SpaceDetailsButton/SpaceDetailsButton';
import { useResizable } from '../SpaceChat/hooks/useResizable';
import TaskBar from '../TaskBar';
import SpaceContents from '../SpaceContents';

interface FocusedLayoutProps {
  id: string;
  activeWindowId: string | null;
  windows: Record<string, AnyWindowEntity>;
  windowContents: Record<string, React.ReactNode>;
  isChatVisible: boolean;
  handleSetChatVisible: (visible: boolean) => void;
  user: any;
  handleWindowClick: (windowId: string, event: React.MouseEvent) => void;
  handleWindowFocus?: (windowId: string) => void;
  openApp: (appId: string) => void;
  handleMouseMove: (event: React.MouseEvent) => void;
  bgColor?: string;
  getWindowTitle: (window: AnyWindowEntity) => string;
  activeWindow: AnyWindowEntity | null;
  handleCreateBlankWindow: () => void;
}

const FocusedLayout: React.FC<FocusedLayoutProps> = ({
  id,
  activeWindowId,
  windows,
  windowContents,
  isChatVisible,
  handleSetChatVisible,
  user,
  handleWindowClick,
  handleWindowFocus,
  openApp,
  handleMouseMove,
  bgColor,
  getWindowTitle,
  activeWindow,
  handleCreateBlankWindow,
}) => {
  // Reference to the sidebar element for resizing
  const sidebarRef = useRef<HTMLDivElement>(null);
  
  // Default and min/max values for sidebar width
  const defaultSidebarWidth = 250;
  const minSidebarWidth = 180;
  const maxSidebarWidth = 400;
  
  // State to persist sidebar width
  const [sidebarWidth, setSidebarWidth] = useState(defaultSidebarWidth);
  
  // State for sidebar visibility control in focused layout
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  
  // State for contents visibility - always true in focused mode
  const [isContentsVisible, setIsContentsVisible] = useState(true);
  
  // Setup resizable functionality for sidebar
  const { startResize: startSidebarResize, isDragging: isSidebarResizing } = useResizable({
    elementRef: sidebarRef,
    initialWidth: sidebarWidth,
    minWidth: minSidebarWidth,
    maxWidth: maxSidebarWidth,
    direction: 'right',
    onWidthChange: setSidebarWidth
  });
  
  // Additional class for the layout when resizing
  const layoutClass = `space-container focused-layout ${isSidebarResizing ? 'resizing' : ''}`;
  
  // Handler for window click in sidebar to bring it to front
  const handleSidebarWindowClick = (windowId: string, event: React.MouseEvent) => {
    // Call regular click handler first
    handleWindowClick(windowId, event);
    
    // Also focus the window
    if (handleWindowFocus) {
      handleWindowFocus(windowId);
    }
  };
  
  return (
    <div 
      className={layoutClass}
      onMouseMove={handleMouseMove}
    >
      {/* Header bar with controls - preserved at top */}
      <span className="spaceTitle">
        <SystemMenuButton />
        
        <SpaceDetailsButton />
        {activeWindow && <span className="activeWindowTitle">{getWindowTitle(activeWindow)}</span>}
      </span>
      
      <div className="focused-layout-container">
        {/* Left sidebar with SpaceContents component */}
        <div 
          className={`focused-layout-sidebar ${!isSidebarVisible ? 'collapsed' : ''}`}
          ref={sidebarRef}
        >
          <div className="sidebar-header">
            <h3>Contents</h3>
            <button 
              className="toggle-sidebar-button"
              onClick={() => setIsSidebarVisible(!isSidebarVisible)}
            >
              {isSidebarVisible ? '◀' : '▶'}
            </button>
            
          </div>
          
          {/* Use SpaceContents directly in the sidebar */}
          <SpaceContents 
            isVisible={isContentsVisible} 
            setIsVisible={setIsContentsVisible}
            entities={windows}
            selectedIds={activeWindowId ? [activeWindowId] : []}
            handleWindowClick={handleSidebarWindowClick}
          />
          
          {/* Drop zone is now handled by the main Space container */}
          
          {/* Resize handle for sidebar */}
          <div 
            className="sidebar-resize-handle"
            onMouseDown={startSidebarResize}
          />
        </div>
        
        {/* Main content area */}
        <div className="focused-layout-content">
          {activeWindow ? (
            <div className="focused-window-content">
              <div className="window-body">
                {windowContents[`${activeWindow.id}-${activeWindow.appType}`]}
              </div>
            </div>
          ) : (
            <div className="no-window-selected">
              <h3>No window selected</h3>
              <p>Select a window from the sidebar or open a new application</p>
            </div>
          )}
          
          {/* Task bar positioned at the bottom of the content area */}
          <div className="focused-layout-taskbar">
            <TaskBar onOpenApp={openApp} onCreateBlankWindow={handleCreateBlankWindow} />
          </div>
        </div>
        
        {/* Right sidebar with chat */}
        {user && user.sub && (
          <div className="focused-layout-chat">
            <SpaceChat 
              isVisible={isChatVisible} 
              setIsVisible={handleSetChatVisible} 
              user_id={user.sub} 
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default FocusedLayout; 