import React from 'react';
import SpaceContents from '../SpaceContents';
import SpaceChat from '../SpaceChat/SpaceChat';
import TaskBar from '../TaskBar';
import { ElectronWindowManager } from '../../ElectronWindow/ElectronWindowManager';
import { AnyWindowEntity } from '../../../types/windows';
import SystemMenuButton from '../SystemMenuButton/SystemMenuButton';
import SpaceDetailsButton from '../SpaceDetailsButton/SpaceDetailsButton';

interface SpatialLayoutProps {
  id: string;
  windows: React.ReactNode;
  cursors: React.ReactNode;
  isContentsVisible: boolean;
  handleSetContentsVisible: (visible: boolean) => void;
  isChatVisible: boolean;
  handleSetChatVisible: (visible: boolean) => void;
  handleSpaceClick: (event: React.MouseEvent) => void;
  handleMouseMove: (event: React.MouseEvent) => void;
  bgColor?: string;
  user: any;
  entities: Record<string, AnyWindowEntity>;
  selectedIds: string[];
  handleWindowClick: (windowId: string, event: React.MouseEvent) => void;
  openApp: (appId: string) => void;
  handleCreateBlankWindow: () => void;
  activeWindow: any;
  getWindowTitle: (window: any) => string;
}

const SpatialLayout: React.FC<SpatialLayoutProps> = ({
  id,
  windows,
  cursors,
  isContentsVisible,
  handleSetContentsVisible,
  isChatVisible,
  handleSetChatVisible,
  handleSpaceClick,
  handleMouseMove,
  bgColor,
  user,
  entities,
  selectedIds,
  handleWindowClick,
  openApp,
  handleCreateBlankWindow,
  activeWindow,
  getWindowTitle,
}) => {
  return (
    <div
      className="space-container spatial-layout"
      onClick={handleSpaceClick}
      onMouseMove={handleMouseMove}
      style={{ backgroundColor: bgColor || '#ffffff00' }}
    >
      <span className="spaceTitle">
        <SystemMenuButton />
        <SpaceDetailsButton />
        {activeWindow && <span className="activeWindowTitle">{getWindowTitle(activeWindow)}</span>}
      </span>
      {cursors}
      {windows}

      <SpaceContents
        isVisible={isContentsVisible}
        setIsVisible={handleSetContentsVisible}
        entities={entities}
        selectedIds={selectedIds}
        handleWindowClick={handleWindowClick}
      />

      {user && user.sub && (
        <SpaceChat isVisible={isChatVisible} setIsVisible={handleSetChatVisible} user_id={user.sub} />
      )}

      <div className="spatial-taskbar-wrapper">
        <TaskBar onOpenApp={openApp} onCreateBlankWindow={handleCreateBlankWindow} />
      </div>

      {/* Only render WindowManager in Electron environment */}
      {!!(window as any).electron?.BrowserView && <ElectronWindowManager />}
    </div>
  );
};

export default SpatialLayout; 