import React, { useRef, useState } from 'react';
import './NeurvanaTabBar.scss';
import { FileInfo, UIViewInfo } from '../store/neurvanaAppStore';

export interface NeurvanaTabBarProps {
  openFiles: FileInfo[];
  openUIViews: UIViewInfo[];
  activeFileId: string | null;
  activeUIViewId: string | null;
  isUIView: boolean;
  onTabChange: (id: string, isUI: boolean) => void;
  onTabClose?: (id: string, isUI: boolean) => void;
}

const NeurvanaTabBar: React.FC<NeurvanaTabBarProps> = ({ 
  openFiles, 
  openUIViews, 
  activeFileId, 
  activeUIViewId, 
  isUIView,
  onTabChange,
  onTabClose = () => {} // Default no-op if not provided
}) => {
  const [draggedTab, setDraggedTab] = useState<{ id: string, isUI: boolean } | null>(null);
  const [dragOverTabId, setDragOverTabId] = useState<string | null>(null);
  const tabBarRef = useRef<HTMLDivElement>(null);
  
  // Function to get file extension icon (could be expanded with more file types)
  const getFileIcon = (filename: string): string => {
    const extension = filename.split('.').pop()?.toLowerCase() || '';
    
    switch (extension) {
      case 'js':
      case 'jsx':
        return '📄 '; // JS files
      case 'ts':
      case 'tsx':
        return '📄 '; // TypeScript files
      case 'py':
        return '🐍 '; // Python files
      case 'json':
        return '📋 '; // JSON files
      case 'html':
        return '📱 '; // HTML files
      case 'css':
      case 'scss':
        return '🎨 '; // CSS files
      case 'md':
        return '📝 '; // Markdown files
      default:
        return '📄 '; // Default file icon
    }
  };
  
  // Function to get clean display name
  const getDisplayName = (file: FileInfo | UIViewInfo) => {
    if ('path' in file) {
      // It's a file
      const filename = file.name.split('/').pop() || file.name;
      return filename;
    } else {
      // It's a UI view
      return file.name;
    }
  };
  
  // Drag handlers
  const handleDragStart = (event: React.DragEvent, id: string, isUI: boolean) => {
    setDraggedTab({ id, isUI });
    event.dataTransfer.effectAllowed = 'move';
    
    // Create a ghost image for dragging (optional)
    const dragImage = document.createElement('div');
    dragImage.classList.add('tab-drag-image');
    dragImage.textContent = isUI 
      ? openUIViews.find(v => v.id === id)?.name || 'Tab'
      : openFiles.find(f => f.id === id)?.name || 'Tab';
    
    document.body.appendChild(dragImage);
    event.dataTransfer.setDragImage(dragImage, 0, 0);
    
    // Remove after drag is completed
    setTimeout(() => {
      document.body.removeChild(dragImage);
    }, 0);
  };
  
  const handleDragOver = (event: React.DragEvent, id: string) => {
    event.preventDefault();
    setDragOverTabId(id);
    event.dataTransfer.dropEffect = 'move';
  };
  
  const handleDragEnd = () => {
    setDraggedTab(null);
    setDragOverTabId(null);
  };
  
  // For now, this is a stub - we'd need to implement proper tab ordering in the store
  const handleDrop = (event: React.DragEvent, targetId: string, isTargetUI: boolean) => {
    event.preventDefault();
    
    if (!draggedTab) return;
    
    const { id: sourceId, isUI: isSourceUI } = draggedTab;
    
    console.log(`Dragged tab ${sourceId} onto tab ${targetId}`);
    // Here you would implement reordering logic by updating the store
    
    setDraggedTab(null);
    setDragOverTabId(null);
  };
  
  const handleCloseTab = (e: React.MouseEvent, id: string, isUIView: boolean) => {
    e.stopPropagation(); // Prevent tab selection when closing
    onTabClose(id, isUIView);
  };
  
  return (
    <div className="neurvana-tab-bar" ref={tabBarRef}>
      {openFiles.map((file) => {
        const isActive = !isUIView && activeFileId === file.id;
        const isDragged = draggedTab?.id === file.id && !draggedTab.isUI;
        const isDraggedOver = dragOverTabId === file.id;
        
        return (
          <div 
            key={file.id}
            className={`tab file-tab ${isActive ? 'active' : ''} 
                      ${isDragged ? 'dragged' : ''} 
                      ${isDraggedOver ? 'drag-over' : ''}`}
            onClick={() => onTabChange(file.id, false)}
            draggable
            onDragStart={(e) => handleDragStart(e, file.id, false)}
            onDragOver={(e) => handleDragOver(e, file.id)}
            onDragEnd={handleDragEnd}
            onDrop={(e) => handleDrop(e, file.id, false)}
          >
            <span className="tab-icon">{getFileIcon(file.name)}</span>
            <span className="tab-name">{getDisplayName(file)}</span>
            <button 
              className="tab-close"
              onClick={(e) => handleCloseTab(e, file.id, false)}
            >
              ×
            </button>
          </div>
        );
      })}
      
      {openUIViews.map((view) => {
        const isActive = isUIView && activeUIViewId === view.id;
        const isDragged = draggedTab?.id === view.id && draggedTab.isUI;
        const isDraggedOver = dragOverTabId === view.id;
        
        return (
          <div 
            key={view.id}
            className={`tab ui-view-tab ${isActive ? 'active' : ''} 
                      ${isDragged ? 'dragged' : ''} 
                      ${isDraggedOver ? 'drag-over' : ''}`}
            onClick={() => onTabChange(view.id, true)}
            draggable
            onDragStart={(e) => handleDragStart(e, view.id, true)}
            onDragOver={(e) => handleDragOver(e, view.id)}
            onDragEnd={handleDragEnd}
            onDrop={(e) => handleDrop(e, view.id, true)}
          >
            <span className="tab-icon">🖥️</span>
            <span className="tab-name">{view.name}</span>
            <button 
              className="tab-close"
              onClick={(e) => handleCloseTab(e, view.id, true)}
            >
              ×
            </button>
          </div>
        );
      })}
      
      {openFiles.length === 0 && openUIViews.length === 0 && (
        <div className="empty-tabs-message">
          No open files or UI views
        </div>
      )}
    </div>
  );
};

export default NeurvanaTabBar; 