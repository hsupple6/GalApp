import React, { useCallback, useEffect, useState, useRef } from 'react';
import { FileSystemItem, FileTreeProps } from '../types';
import { readDirectoryContents } from '../store/finderStore';
import FileIcon from './FileIcon';
import './FileTree.scss';

const FileTree: React.FC<FileTreeProps> = ({
  rootItem,
  currentPath,
  selectedItems,
  viewMode,
  onSelectItem,
  onNavigate,
  onFileOperation,
}) => {
  const [items, setItems] = useState<FileSystemItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    item: FileSystemItem | null;
  }>({
    visible: false,
    x: 0,
    y: 0,
    item: null,
  });
  const [renameItem, setRenameItem] = useState<{
    item: FileSystemItem | null;
    newName: string;
  }>({
    item: null,
    newName: '',
  });

  // Ref for rename input
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Load directory contents when currentPath changes
  useEffect(() => {
    const loadDirectory = async () => {
      if (!rootItem || !rootItem.handle) return;
      
      setIsLoading(true);
      try {
        // If we're at the root, just use the children
        if (currentPath === '/') {
          if (!rootItem.children || rootItem.children.length === 0) {
            const directoryHandle = rootItem.handle as FileSystemDirectoryHandle;
            rootItem.children = await readDirectoryContents(directoryHandle, '/');
          }
          setItems(rootItem.children);
        } else {
          // For non-root paths, we need to navigate to the specific path
          // This is a simplified version of the navigateToPath function
          const pathSegments = currentPath.split('/').filter(Boolean);
          let currentDir = rootItem;
          let currentDirPath = '/';
          
          // Navigate through each path segment
          for (const segment of pathSegments) {
            if (!currentDir.children || currentDir.children.length === 0) {
              const directoryHandle = currentDir.handle as FileSystemDirectoryHandle;
              currentDir.children = await readDirectoryContents(directoryHandle, currentDirPath);
            }
            
            const nextDir = currentDir.children.find(
              item => item.name === segment && item.kind === 'directory'
            );
            
            if (!nextDir) {
              throw new Error(`Directory not found: ${segment}`);
            }
            
            currentDir = nextDir;
            currentDirPath = currentDir.path;
          }
          
          // Load the children of the final directory if not already loaded
          if (!currentDir.children || currentDir.children.length === 0) {
            const directoryHandle = currentDir.handle as FileSystemDirectoryHandle;
            currentDir.children = await readDirectoryContents(directoryHandle, currentDirPath);
          }
          
          setItems(currentDir.children);
        }
      } catch (error) {
        console.error('Error loading directory:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadDirectory();
  }, [rootItem, currentPath]);

  // Focus rename input when it appears
  useEffect(() => {
    if (renameItem.item && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renameItem]);

  // Handle double click on an item
  const handleDoubleClick = useCallback(async (item: FileSystemItem) => {
    if (item.kind === 'directory') {
      onNavigate(item.path);
    } else if (item.kind === 'file' && item.handle) {
      try {
        // For files, we could open them or preview them
        const fileHandle = item.handle as FileSystemFileHandle;
        const file = await fileHandle.getFile();
        
        // Here you could implement file preview or opening
        console.log('File selected:', file);
      } catch (error) {
        console.error('Error opening file:', error);
      }
    }
  }, [onNavigate]);

  // Handle context menu
  const handleContextMenu = useCallback((e: React.MouseEvent, item: FileSystemItem) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      item,
    });
  }, []);

  // Handle context menu item click
  const handleContextMenuAction = useCallback((action: string) => {
    if (!contextMenu.item) return;

    switch (action) {
      case 'open':
        handleDoubleClick(contextMenu.item);
        break;
      case 'rename':
        setRenameItem({
          item: contextMenu.item,
          newName: contextMenu.item.name,
        });
        break;
      case 'delete':
        if (onFileOperation) {
          onFileOperation('delete', [contextMenu.item]);
        }
        break;
      case 'copy':
        // Store the item for copy operation
        localStorage.setItem('finder_clipboard', JSON.stringify({
          operation: 'copy',
          items: [contextMenu.item],
        }));
        break;
      case 'cut':
        // Store the item for move operation
        localStorage.setItem('finder_clipboard', JSON.stringify({
          operation: 'move',
          items: [contextMenu.item],
        }));
        break;
      case 'paste':
        // Get items from clipboard
        const clipboardData = localStorage.getItem('finder_clipboard');
        if (clipboardData && onFileOperation) {
          try {
            const { operation, items } = JSON.parse(clipboardData);
            if (items && items.length > 0) {
              onFileOperation(operation, items, contextMenu.item);
            }
          } catch (error) {
            console.error('Error parsing clipboard data:', error);
          }
        }
        break;
    }

    // Close context menu
    setContextMenu({ ...contextMenu, visible: false });
  }, [contextMenu, handleDoubleClick, onFileOperation]);

  // Handle rename submit
  const handleRenameSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (renameItem.item && onFileOperation) {
      onFileOperation('rename', [renameItem.item], undefined, renameItem.newName);
    }
    setRenameItem({ item: null, newName: '' });
  }, [renameItem, onFileOperation]);

  // Handle rename cancel
  const handleRenameCancel = useCallback(() => {
    setRenameItem({ item: null, newName: '' });
  }, []);

  // Handle rename input change
  const handleRenameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setRenameItem({ ...renameItem, newName: e.target.value });
  }, [renameItem]);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenu.visible) {
        setContextMenu({ ...contextMenu, visible: false });
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [contextMenu]);

  // Format file size for display
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Format date for display in macOS Finder style
  const formatDate = (date: Date): string => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const isToday = date.toDateString() === now.toDateString();
    const isYesterday = date.toDateString() === yesterday.toDateString();
    
    // Format time
    const timeOptions: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
    const time = date.toLocaleTimeString(undefined, timeOptions);
    
    if (isToday) {
      return `Today at ${time}`;
    } else if (isYesterday) {
      return `Yesterday at ${time}`;
    } else {
      // For older dates, show month, day, year
      const dateOptions: Intl.DateTimeFormatOptions = { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric'
      };
      return date.toLocaleDateString(undefined, dateOptions);
    }
  };

  // Render list view
  const renderListView = () => (
    <table className="file-list">
      <thead>
        <tr>
          <th>Name</th>
          <th>Size</th>
          <th>Kind</th>
          <th>Date Modified</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr
            key={item.path}
            className={selectedItems.some(selected => selected.path === item.path) ? 'selected' : ''}
            onClick={() => onSelectItem(item)}
            onDoubleClick={() => handleDoubleClick(item)}
            onContextMenu={(e) => handleContextMenu(e, item)}
          >
            <td className="name-cell">
              {renameItem.item && renameItem.item.path === item.path ? (
                <form onSubmit={handleRenameSubmit} className="rename-file-form">
                  <input
                    ref={renameInputRef}
                    type="text"
                    value={renameItem.newName}
                    onChange={handleRenameChange}
                    onBlur={handleRenameCancel}
                    onKeyDown={(e) => e.key === 'Escape' && handleRenameCancel()}
                    className="rename-file-input"
                  />
                </form>
              ) : (
                <>
                  <FileIcon item={item} />
                  <span>{item.name}</span>
                </>
              )}
            </td>
            <td>{formatFileSize(item.size)}</td>
            <td>{item.kind === 'directory' ? 'Folder' : (item.type || 'File')}</td>
            <td>{formatDate(item.lastModified)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  // Render grid view
  const renderGridView = () => (
    <div className="file-grid">
      {items.map((item) => (
        <div
          key={item.path}
          className={`grid-item ${selectedItems.some(selected => selected.path === item.path) ? 'selected' : ''}`}
          onClick={() => onSelectItem(item)}
          onDoubleClick={() => handleDoubleClick(item)}
          onContextMenu={(e) => handleContextMenu(e, item)}
        >
          <FileIcon item={item} size="large" />
          {renameItem.item && renameItem.item.path === item.path ? (
            <form onSubmit={handleRenameSubmit}>
              <input
                ref={renameInputRef}
                type="text"
                value={renameItem.newName}
                onChange={handleRenameChange}
                onBlur={handleRenameCancel}
                onKeyDown={(e) => e.key === 'Escape' && handleRenameCancel()}
              />
            </form>
          ) : (
            <div className="item-name">{item.name}</div>
          )}
        </div>
      ))}
    </div>
  );

  // Render column view
  const renderColumnView = () => (
    <div className="file-columns">
      {/* This would be more complex, showing multiple columns of navigation */}
      <div className="column">
        {items.map((item) => (
          <div
            key={item.path}
            className={`column-item ${selectedItems.some(selected => selected.path === item.path) ? 'selected' : ''}`}
            onClick={() => onSelectItem(item)}
            onDoubleClick={() => handleDoubleClick(item)}
            onContextMenu={(e) => handleContextMenu(e, item)}
          >
            <FileIcon item={item} size="small" />
            {renameItem.item && renameItem.item.path === item.path ? (
              <form onSubmit={handleRenameSubmit}>
                <input
                  ref={renameInputRef}
                  type="text"
                  value={renameItem.newName}
                  onChange={handleRenameChange}
                  onBlur={handleRenameCancel}
                  onKeyDown={(e) => e.key === 'Escape' && handleRenameCancel()}
                />
              </form>
            ) : (
              <span>{item.name}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  // Show loading state
  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  // Show empty state
  if (items.length === 0) {
    return <div className="empty-folder">This folder is empty</div>;
  }

  // Render the appropriate view based on viewMode
  return (
    <div className="file-tree">
      {viewMode === 'list' && renderListView()}
      {viewMode === 'grid' && renderGridView()}
      {viewMode === 'column' && renderColumnView()}
      
      {/* Context Menu */}
      {contextMenu.visible && (
        <div 
          className="finder-context-menu"
          style={{ 
            position: 'fixed', 
            top: contextMenu.y, 
            left: contextMenu.x,
            zIndex: 1000
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <ul>
            <li onClick={() => handleContextMenuAction('open')}>Open</li>
            <li onClick={() => handleContextMenuAction('rename')}>Rename</li>
            <li onClick={() => handleContextMenuAction('delete')}>Delete</li>
            <li className="divider"></li>
            <li onClick={() => handleContextMenuAction('copy')}>Copy</li>
            <li onClick={() => handleContextMenuAction('cut')}>Cut</li>
            {contextMenu.item?.kind === 'directory' && (
              <li onClick={() => handleContextMenuAction('paste')}>Paste</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default FileTree; 