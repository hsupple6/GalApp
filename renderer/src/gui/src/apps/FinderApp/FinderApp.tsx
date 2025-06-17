import './FinderApp.scss';

import React, { useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import WindowWrapper from '../../WindowWrapper';
import { 
  HomeIcon, 
  DesktopIcon, 
  DocumentIcon, 
  DownloadsIcon,
  FolderIcon,
  IconStyles
} from '../../components/MacOSIcons';
import { useFinderStore, getSpecialFolder } from './store/finderStore';

// Import components conditionally to avoid errors if they don't exist yet
let FileTree: any;
let FilePreview: any;
let Toolbar: any;
try {
  FileTree = require('./components/FileTree').default;
} catch (e) {
  FileTree = () => <div>FileTree component not found</div>;
}
try {
  FilePreview = require('./components/FilePreview').default;
} catch (e) {
  FilePreview = () => <div>FilePreview component not found</div>;
}
try {
  Toolbar = require('./components/Toolbar').default;
} catch (e) {
  Toolbar = () => <div>Toolbar component not found</div>;
}

// Define types locally if they don't exist yet
interface FileSystemItem {
  name: string;
  kind: 'file' | 'directory';
  handle?: any;
  path: string;
  children?: FileSystemItem[];
  size: number;
  lastModified: Date;
  type?: string;
  icon?: string;
}

type ViewMode = 'list' | 'grid' | 'column';

interface FinderAppProps {
  windowId: string;
  title?: string;
  onClose: () => void;
}

const FinderApp: React.FC<FinderAppProps> = ({ windowId, title = 'Finder', onClose }) => {
  const {
    rootDirectory,
    currentPath,
    history,
    historyIndex,
    selectedItems,
    viewMode,
    isLoading,
    favoriteLocations,
    error,
    openDirectory,
    tryRestoreDirectory,
    navigateToPath,
    navigateBack,
    navigateForward,
    navigateUp,
    selectItem,
    setViewMode,
    createFolder,
    deleteItems,
    renameItem,
    copyItems,
    moveItems
  } = useFinderStore();

  const [specialFolders, setSpecialFolders] = useState<{
    [key: string]: FileSystemItem | null;
  }>({
    home: null,
    desktop: null,
    documents: null,
    downloads: null
  });

  // Check if File System Access API is supported
  const isFileSystemAccessSupported = typeof window !== 'undefined' && 'showDirectoryPicker' in window;

  // Initialize special folders
  useEffect(() => {
    const initSpecialFolders = async () => {
      // Try to get special folder handles
      const desktopHandle = await getSpecialFolder('desktop');
      const documentsHandle = await getSpecialFolder('documents');
      const downloadsHandle = await getSpecialFolder('downloads');
      
      // Create FileSystemItem objects for each special folder
      const specialFoldersMap: { [key: string]: FileSystemItem | null } = {
        home: rootDirectory,
        desktop: desktopHandle ? {
          name: 'Desktop',
          kind: 'directory',
          handle: desktopHandle,
          path: '/Desktop',
          children: [],
          size: 0,
          lastModified: new Date()
        } : null,
        documents: documentsHandle ? {
          name: 'Documents',
          kind: 'directory',
          handle: documentsHandle,
          path: '/Documents',
          children: [],
          size: 0,
          lastModified: new Date()
        } : null,
        downloads: downloadsHandle ? {
          name: 'Downloads',
          kind: 'directory',
          handle: downloadsHandle,
          path: '/Downloads',
          children: [],
          size: 0,
          lastModified: new Date()
        } : null
      };
      
      setSpecialFolders(specialFoldersMap);
    };
    
    if (rootDirectory) {
      initSpecialFolders();
    }
  }, [rootDirectory]);

  // Try to restore the last used directory when the component mounts
  useEffect(() => {
    if (isFileSystemAccessSupported && !rootDirectory) {
      tryRestoreDirectory().then((success: boolean) => {
        if (success) {
          console.log('Successfully restored directory handle');
        } else {
          console.log('Could not restore directory handle, user will need to select one');
        }
      });
    }
  }, [isFileSystemAccessSupported, rootDirectory, tryRestoreDirectory]);

  // Handle file selection
  const handleSelectItem = (item: FileSystemItem) => {
    selectItem(item);
  };

  // Handle navigation
  const handleNavigate = (path: string) => {
    navigateToPath(path);
  };

  // Handle file operations
  const handleFileOperation = (
    operation: 'copy' | 'move' | 'delete' | 'rename',
    items: FileSystemItem[],
    destination?: FileSystemItem,
    newName?: string
  ) => {
    switch (operation) {
      case 'copy':
        if (destination) {
          copyItems(items, destination);
        }
        break;
      case 'move':
        if (destination) {
          moveItems(items, destination);
        }
        break;
      case 'delete':
        deleteItems(items);
        break;
      case 'rename':
        if (items.length === 1 && newName) {
          renameItem(items[0], newName);
        }
        break;
    }
  };

  // Handle view mode change
  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
  };

  // Handle special folder navigation
  const handleSpecialFolderClick = (folderKey: string) => {
    const folder = specialFolders[folderKey];
    if (folder) {
      // For special folders, we need to open them directly
      if (folderKey === 'home') {
        navigateToPath('/');
      } else {
        // Set the root directory to the special folder
        useFinderStore.setState({
          rootDirectory: folder,
          currentPath: '/',
          history: ['/'],
          historyIndex: 0,
          selectedItems: []
        });
      }
    }
  };

  // Handle drop zone for files and directories
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      console.log('Files dropped:', acceptedFiles);
      // Handle dropped files
      // This would need to use the File System Access API to write files
    },
    noClick: true,
    noKeyboard: true,
  });

  // Handle connect button click
  const handleConnectClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    openDirectory();
  };

  return (
    <WindowWrapper 
      title={title} 
      onClose={onClose}
      headerButtons={
        !rootDirectory && isFileSystemAccessSupported ? (
          <button 
            className="connect-button"
            onClick={handleConnectClick}
          >
            Select Root Directory
          </button>
        ) : null
      }
    >
      <IconStyles />
      <div className="finder-app" {...getRootProps()}>
        <input {...getInputProps()} />
        
        <Toolbar 
          canGoBack={historyIndex > 0}
          canGoForward={historyIndex < history.length - 1}
          canGoUp={currentPath !== '/'}
          currentPath={currentPath}
          viewMode={viewMode}
          selectedItems={selectedItems}
          onBack={navigateBack}
          onForward={navigateForward}
          onUp={navigateUp}
          onChangeViewMode={handleViewModeChange}
          onCreateFolder={createFolder}
          onDelete={() => deleteItems(selectedItems)}
        />
        
        <div className="finder-content">
          <div className="finder-sidebar">
            <div className="sidebar-section">
              <h3>Favorites</h3>
              <ul>
                <li 
                  className={currentPath === '/' ? 'active' : ''}
                  onClick={() => rootDirectory && handleSpecialFolderClick('home')}
                >
                  <HomeIcon size={16} color={currentPath === '/' ? 'white' : '#666'} />
                  <span>Home</span>
                </li>
                <li
                  onClick={() => specialFolders.desktop && handleSpecialFolderClick('desktop')}
                >
                  <DesktopIcon size={16} />
                  <span>Desktop</span>
                </li>
                <li
                  onClick={() => specialFolders.documents && handleSpecialFolderClick('documents')}
                >
                  <DocumentIcon size={16} />
                  <span>Documents</span>
                </li>
                <li
                  onClick={() => specialFolders.downloads && handleSpecialFolderClick('downloads')}
                >
                  <DownloadsIcon size={16} />
                  <span>Downloads</span>
                </li>
              </ul>
            </div>
            
            {favoriteLocations.length > 0 && (
              <div className="sidebar-section">
                <h3>Locations</h3>
                <ul>
                  {favoriteLocations.map((location) => (
                    <li 
                      key={location.path}
                      className={currentPath === location.path ? 'active' : ''}
                      onClick={() => handleNavigate(location.path)}
                    >
                      <FolderIcon size={16} color={currentPath === location.path ? 'white' : '#666'} />
                      <span>{location.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          
          <div className="finder-main">
            {isLoading ? (
              <div className="loading">Loading...</div>
            ) : !rootDirectory ? (
              <div className="not-connected">
                {!isFileSystemAccessSupported ? (
                  <div className="error-message">
                    <h3>File System Access API Not Supported</h3>
                    <p>Your browser doesn't support the File System Access API. Please use Chrome or Edge.</p>
                  </div>
                ) : (
                  <div className="connect-message">
                    <h3>Connect to File System</h3>
                    <p>
                      Due to browser security, you need to select which directory to access.
                      For the best experience, please select your home directory or another high-level directory.
                    </p>
                    <div className="tips">
                      <h4>Browser Security Limitations:</h4>
                      <ul>
                        <li>Browsers restrict direct access to the entire file system</li>
                        <li>You must explicitly select a directory to grant access</li>
                        <li>Select your home folder for the most Finder-like experience</li>
                        <li>You'll need to select a directory each time you use the app</li>
                        <li>Some system folders may be inaccessible due to security restrictions</li>
                      </ul>
                    </div>
                    <button 
                      className="connect-button"
                      onClick={handleConnectClick}
                    >
                      Select Root Directory
                    </button>
                  </div>
                )}
              </div>
            ) : error ? (
              <div className="error-container">
                <div className="error-message">
                  <h3>Access Error</h3>
                  <p>{error}</p>
                  <p>This is likely due to browser security restrictions on system files.</p>
                  <button 
                    className="connect-button"
                    onClick={handleConnectClick}
                  >
                    Select Different Directory
                  </button>
                </div>
              </div>
            ) : (
              <FileTree 
                rootItem={rootDirectory}
                currentPath={currentPath}
                selectedItems={selectedItems}
                viewMode={viewMode}
                onSelectItem={handleSelectItem}
                onNavigate={handleNavigate}
                onFileOperation={handleFileOperation}
              />
            )}
          </div>
          
          <div className="finder-preview">
            {selectedItems.length === 1 ? (
              <FilePreview item={selectedItems[0]} />
            ) : (
              <div className="no-selection">
                <p>No item selected</p>
              </div>
            )}
          </div>
        </div>
        
        {isDragActive && (
          <div className="drop-overlay">
            <div className="drop-message">Drop files here</div>
          </div>
        )}
      </div>
    </WindowWrapper>
  );
};

export default FinderApp; 