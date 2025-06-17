import { create } from 'zustand';
import { FileSystemItem, FinderStore, ViewMode } from '../types';

// Helper function to read directory contents
export const readDirectoryContents = async (
  directoryHandle: FileSystemDirectoryHandle,
  path: string = '/'
): Promise<FileSystemItem[]> => {
  const items: FileSystemItem[] = [];
  
  try {
    for await (const [name, handle] of directoryHandle.entries()) {
      try {
        const kind = handle.kind;
        const itemPath = path === '/' ? `/${name}` : `${path}/${name}`;
        
        if (kind === 'file') {
          try {
            const fileHandle = handle as FileSystemFileHandle;
            const file = await fileHandle.getFile();
            
            items.push({
              name,
              kind,
              handle: fileHandle,
              path: itemPath,
              size: file.size,
              lastModified: new Date(file.lastModified),
              type: file.type
            });
          } catch (fileError: any) {
            console.warn(`Could not access file "${name}": ${fileError.message}`);
            // Add the file with limited information
            items.push({
              name,
              kind,
              handle: handle as FileSystemFileHandle,
              path: itemPath,
              size: 0,
              lastModified: new Date(),
              type: 'inaccessible',
              error: 'Cannot access this file due to system restrictions'
            });
          }
        } else {
          // For directories, we don't load children immediately for performance
          items.push({
            name,
            kind,
            handle: handle as FileSystemDirectoryHandle,
            path: itemPath,
            children: [],
            size: 0,
            lastModified: new Date()
          });
        }
      } catch (itemError: any) {
        console.warn(`Error processing item: ${itemError.message}`);
        // Skip this item
      }
    }
  } catch (error: any) {
    console.error(`Error reading directory contents: ${error.message}`);
    // If we can't read the directory at all, add a special error message
    if (error.name === 'NotAllowedError' || error.message.includes('permission')) {
      throw new Error('Cannot access this folder because it contains system files or permission was denied');
    } else {
      throw error; // Re-throw other errors
    }
  }
  
  // Sort items: directories first, then files, both alphabetically
  return items.sort((a, b) => {
    if (a.kind !== b.kind) {
      return a.kind === 'directory' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
};

// Helper function to navigate to a specific path
export const navigateToPath = async (
  rootItem: FileSystemItem,
  targetPath: string
): Promise<FileSystemItem[]> => {
  if (!rootItem || !rootItem.handle || rootItem.kind !== 'directory') {
    throw new Error('Invalid root item');
  }
  
  // If we're at the root, just return its children
  if (targetPath === rootItem.name || targetPath === '/') {
    if (!rootItem.children || rootItem.children.length === 0) {
      rootItem.children = await readDirectoryContents(
        rootItem.handle as FileSystemDirectoryHandle,
        rootItem.path
      );
    }
    return rootItem.children;
  }
  
  // Split the path into segments
  const pathSegments = targetPath.split('/').filter(Boolean);
  
  // Start from the root directory
  let currentDir = rootItem;
  let currentPath = rootItem.path;
  
  // Navigate through each path segment
  for (const segment of pathSegments) {
    if (!currentDir.children || currentDir.children.length === 0) {
      currentDir.children = await readDirectoryContents(
        currentDir.handle as FileSystemDirectoryHandle,
        currentPath
      );
    }
    
    const nextDir = currentDir.children.find(
      item => item.name === segment && item.kind === 'directory'
    );
    
    if (!nextDir) {
      throw new Error(`Directory not found: ${segment}`);
    }
    
    currentDir = nextDir;
    currentPath = nextDir.path;
  }
  
  // Load the children of the final directory if not already loaded
  if (!currentDir.children || currentDir.children.length === 0) {
    currentDir.children = await readDirectoryContents(
      currentDir.handle as FileSystemDirectoryHandle,
      currentPath
    );
  }
  
  return currentDir.children;
};

// Helper function to get special folder handles
export const getSpecialFolder = async (
  folderType: 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos'
): Promise<FileSystemDirectoryHandle | null> => {
  try {
    const handle = await window.showDirectoryPicker({
      id: folderType,
      mode: 'read',
      startIn: folderType
    });
    
    return handle;
  } catch (error) {
    console.error(`Error accessing ${folderType} folder:`, error);
    return null;
  }
};

// Create the store
export const useFinderStore = create<FinderStore>((set, get) => ({
  rootDirectory: null,
  currentPath: '/',
  history: ['/'],
  historyIndex: 0,
  selectedItems: [],
  viewMode: 'list',
  isLoading: false,
  favoriteLocations: [],
  
  // Try to restore the last used directory
  tryRestoreDirectory: async () => {
    try {
      set({ isLoading: true });
      
      // The File System Access API doesn't have a built-in way to restore directory handles
      // without user interaction. This is a security feature of browsers.
      // We'll return false to indicate that we couldn't restore the directory
      // and the user will need to select it again.
      
      // In a real implementation, you might use the Storage Access API or IndexedDB
      // to store directory handles, but this requires explicit user permission
      // and is beyond the scope of this example.
      
      return false;
    } catch (error) {
      console.error('Error restoring directory:', error);
      return false;
    } finally {
      set({ isLoading: false });
    }
  },
  
  // Open a directory
  openDirectory: async () => {
    try {
      set({ isLoading: true });
      
      // Try to get a handle to the root directory
      // Note: Due to browser security, we can't access the entire file system without user selection
      // We'll ask the user to select their home directory or another high-level directory
      const directoryHandle = await window.showDirectoryPicker({
        id: 'root-directory', // This helps with permission persistence
        mode: 'readwrite'     // Request read/write access
      });
      
      // Create a root item representing the selected directory
      const rootItem: FileSystemItem = {
        name: directoryHandle.name,
        kind: 'directory',
        handle: directoryHandle,
        path: '/',
        children: [],
        size: 0,
        lastModified: new Date()
      };
      
      try {
        // Load the initial directory contents
        rootItem.children = await readDirectoryContents(directoryHandle, '/');
      } catch (dirError: any) {
        console.error('Error reading directory contents:', dirError);
        
        // Set an error message but still allow access to the directory
        if (dirError.message.includes('system files')) {
          set({
            rootDirectory: rootItem,
            currentPath: '/',
            history: ['/'],
            historyIndex: 0,
            selectedItems: [],
            error: dirError.message
          });
          return;
        }
      }
      
      // Store the directory handle for future use
      try {
        // Request permission persistence
        // This allows the browser to remember this permission
        if ('permissions' in navigator) {
          // @ts-ignore - The permissions API might not be fully typed
          const permission = await navigator.permissions.query({
            name: 'persistent-storage'
          });
          
          if (permission.state === 'granted') {
            console.log('Permission to persist storage granted');
          }
        }
      } catch (error) {
        console.warn('Could not persist directory permission:', error);
      }
      
      set({
        rootDirectory: rootItem,
        currentPath: '/',
        history: ['/'],
        historyIndex: 0,
        selectedItems: [],
        error: undefined // Clear any previous errors
      });
    } catch (error: any) {
      console.error('Error opening directory:', error);
      
      // Set a user-friendly error message
      let errorMessage = 'Failed to open directory';
      
      if (error.name === 'AbortError') {
        // User cancelled the directory picker
        errorMessage = 'Directory selection was cancelled';
      } else if (error.name === 'NotAllowedError' || error.message.includes('permission')) {
        errorMessage = 'Cannot access this folder because it contains system files or permission was denied';
      } else if (error.name === 'SecurityError') {
        errorMessage = 'Access to this directory was blocked due to security restrictions';
      }
      
      set({ error: errorMessage });
    } finally {
      set({ isLoading: false });
    }
  },
  
  // Navigate to a specific path
  navigateToPath: async (path: string) => {
    const { rootDirectory, history, historyIndex } = get();
    
    if (!rootDirectory) return;
    
    try {
      set({ isLoading: true, error: undefined }); // Clear any previous errors
      
      // Load the directory contents
      try {
        await navigateToPath(rootDirectory, path);
        
        // Update history
        const newHistory = [...history.slice(0, historyIndex + 1), path];
        
        set({
          currentPath: path,
          history: newHistory,
          historyIndex: newHistory.length - 1,
          selectedItems: []
        });
      } catch (navError: any) {
        console.error('Error navigating to path:', navError);
        
        // Set an error message but still update the path
        if (navError.message.includes('system files') || navError.message.includes('permission')) {
          set({
            error: navError.message,
            currentPath: path,
            selectedItems: []
          });
        } else {
          throw navError; // Re-throw other errors
        }
      }
    } catch (error: any) {
      console.error('Error navigating to path:', error);
      set({ 
        error: `Cannot access this folder: ${error.message}` 
      });
    } finally {
      set({ isLoading: false });
    }
  },
  
  // Navigate back in history
  navigateBack: () => {
    const { history, historyIndex } = get();
    
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      const path = history[newIndex];
      
      set({
        currentPath: path,
        historyIndex: newIndex,
        selectedItems: []
      });
      
      // Load the directory contents
      get().navigateToPath(path);
    }
  },
  
  // Navigate forward in history
  navigateForward: () => {
    const { history, historyIndex } = get();
    
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      const path = history[newIndex];
      
      set({
        currentPath: path,
        historyIndex: newIndex,
        selectedItems: []
      });
      
      // Load the directory contents
      get().navigateToPath(path);
    }
  },
  
  // Navigate up one level
  navigateUp: () => {
    const { currentPath } = get();
    
    if (currentPath === '/') return;
    
    const pathSegments = currentPath.split('/').filter(Boolean);
    const newPath = pathSegments.length > 1
      ? '/' + pathSegments.slice(0, -1).join('/')
      : '/';
    
    get().navigateToPath(newPath);
  },
  
  // Select an item
  selectItem: (item: FileSystemItem) => {
    const { selectedItems } = get();
    
    // Check if the item is already selected
    if (!selectedItems.some(selected => selected.path === item.path)) {
      set({ selectedItems: [...selectedItems, item] });
    }
  },
  
  // Deselect an item
  deselectItem: (item: FileSystemItem) => {
    const { selectedItems } = get();
    
    set({
      selectedItems: selectedItems.filter(
        selected => selected.path !== item.path
      )
    });
  },
  
  // Clear selection
  clearSelection: () => {
    set({ selectedItems: [] });
  },
  
  // Set view mode
  setViewMode: (mode: ViewMode) => {
    set({ viewMode: mode });
  },
  
  // Create a new folder
  createFolder: async () => {
    const { rootDirectory, currentPath } = get();
    
    if (!rootDirectory) return;
    
    try {
      set({ isLoading: true });
      
      // Navigate to the current directory
      const pathSegments = currentPath.split('/').filter(Boolean);
      let currentDir = rootDirectory;
      
      for (const segment of pathSegments) {
        if (!currentDir.children) continue;
        
        const nextDir = currentDir.children.find(
          item => item.name === segment && item.kind === 'directory'
        );
        
        if (!nextDir) throw new Error(`Directory not found: ${segment}`);
        currentDir = nextDir;
      }
      
      if (!currentDir.handle) throw new Error('Invalid directory handle');
      
      // Create a new folder
      const dirHandle = currentDir.handle as FileSystemDirectoryHandle;
      const folderName = 'New Folder';
      let uniqueName = folderName;
      let counter = 1;
      
      // Check if the folder name already exists
      while (currentDir.children?.some(item => item.name === uniqueName)) {
        uniqueName = `${folderName} ${counter}`;
        counter++;
      }
      
      // Create the folder
      await dirHandle.getDirectoryHandle(uniqueName, { create: true });
      
      // Refresh the directory contents
      await get().navigateToPath(currentPath);
    } catch (error) {
      console.error('Error creating folder:', error);
    } finally {
      set({ isLoading: false });
    }
  },
  
  // Delete items
  deleteItems: async (items: FileSystemItem[]) => {
    const { rootDirectory, currentPath } = get();
    
    if (!rootDirectory || items.length === 0) return;
    
    try {
      set({ isLoading: true });
      
      // Get the parent directory handle
      const pathSegments = currentPath.split('/').filter(Boolean);
      let parentDir = rootDirectory;
      
      for (const segment of pathSegments) {
        if (!parentDir.children) continue;
        
        const nextDir = parentDir.children.find(
          item => item.name === segment && item.kind === 'directory'
        );
        
        if (!nextDir) throw new Error(`Directory not found: ${segment}`);
        parentDir = nextDir;
      }
      
      if (!parentDir.handle) throw new Error('Invalid directory handle');
      
      // Delete each item
      const parentHandle = parentDir.handle as FileSystemDirectoryHandle;
      
      for (const item of items) {
        await parentHandle.removeEntry(item.name, { recursive: true });
      }
      
      // Refresh the directory contents
      await get().navigateToPath(currentPath);
    } catch (error) {
      console.error('Error deleting items:', error);
    } finally {
      set({ isLoading: false });
    }
  },
  
  // Rename an item
  renameItem: async (item: FileSystemItem, newName: string) => {
    const { rootDirectory, currentPath } = get();
    
    if (!rootDirectory || !item.handle) return;
    
    try {
      set({ isLoading: true });
      
      // Get the parent directory handle
      const pathSegments = currentPath.split('/').filter(Boolean);
      let parentDir = rootDirectory;
      
      for (const segment of pathSegments) {
        if (!parentDir.children) continue;
        
        const nextDir = parentDir.children.find(
          item => item.name === segment && item.kind === 'directory'
        );
        
        if (!nextDir) throw new Error(`Directory not found: ${segment}`);
        parentDir = nextDir;
      }
      
      if (!parentDir.handle) throw new Error('Invalid directory handle');
      
      // Currently, the File System Access API doesn't support renaming directly
      // We need to copy the item with the new name and delete the old one
      const parentHandle = parentDir.handle as FileSystemDirectoryHandle;
      
      if (item.kind === 'file') {
        // For files, we need to copy the content
        const fileHandle = item.handle as FileSystemFileHandle;
        const file = await fileHandle.getFile();
        
        // Create a new file with the new name
        const newFileHandle = await parentHandle.getFileHandle(newName, { create: true });
        const writable = await newFileHandle.createWritable();
        await writable.write(file);
        await writable.close();
        
        // Delete the old file
        await parentHandle.removeEntry(item.name);
      } else {
        // For directories, we need to recursively copy all contents
        const dirHandle = item.handle as FileSystemDirectoryHandle;
        const newDirHandle = await parentHandle.getDirectoryHandle(newName, { create: true });
        
        // Copy all entries recursively
        const copyEntries = async (src: FileSystemDirectoryHandle, dest: FileSystemDirectoryHandle) => {
          for await (const [name, handle] of src.entries()) {
            if (handle.kind === 'file') {
              const fileHandle = handle as FileSystemFileHandle;
              const file = await fileHandle.getFile();
              
              const newFileHandle = await dest.getFileHandle(name, { create: true });
              const writable = await newFileHandle.createWritable();
              await writable.write(file);
              await writable.close();
            } else {
              const dirHandle = handle as FileSystemDirectoryHandle;
              const newDirHandle = await dest.getDirectoryHandle(name, { create: true });
              
              await copyEntries(dirHandle, newDirHandle);
            }
          }
        };
        
        await copyEntries(dirHandle, newDirHandle);
        
        // Delete the old directory
        await parentHandle.removeEntry(item.name, { recursive: true });
      }
      
      // Refresh the directory contents
      await get().navigateToPath(currentPath);
    } catch (error) {
      console.error('Error renaming item:', error);
    } finally {
      set({ isLoading: false });
    }
  },
  
  // Copy items to a destination
  copyItems: async (items: FileSystemItem[], destination: FileSystemItem) => {
    const { rootDirectory } = get();
    
    if (!rootDirectory || items.length === 0 || !destination.handle || destination.kind !== 'directory') {
      return;
    }
    
    try {
      set({ isLoading: true });
      
      const destHandle = destination.handle as FileSystemDirectoryHandle;
      
      // Copy each item
      for (const item of items) {
        if (!item.handle) continue;
        
        if (item.kind === 'file') {
          // Copy file
          const fileHandle = item.handle as FileSystemFileHandle;
          const file = await fileHandle.getFile();
          
          // Create a new file in the destination
          const newFileHandle = await destHandle.getFileHandle(item.name, { create: true });
          const writable = await newFileHandle.createWritable();
          await writable.write(file);
          await writable.close();
        } else {
          // Copy directory recursively
          const dirHandle = item.handle as FileSystemDirectoryHandle;
          const newDirHandle = await destHandle.getDirectoryHandle(item.name, { create: true });
          
          // Copy all entries recursively
          const copyEntries = async (src: FileSystemDirectoryHandle, dest: FileSystemDirectoryHandle) => {
            for await (const [name, handle] of src.entries()) {
              if (handle.kind === 'file') {
                const fileHandle = handle as FileSystemFileHandle;
                const file = await fileHandle.getFile();
                
                const newFileHandle = await dest.getFileHandle(name, { create: true });
                const writable = await newFileHandle.createWritable();
                await writable.write(file);
                await writable.close();
              } else {
                const dirHandle = handle as FileSystemDirectoryHandle;
                const newDirHandle = await dest.getDirectoryHandle(name, { create: true });
                
                await copyEntries(dirHandle, newDirHandle);
              }
            }
          };
          
          await copyEntries(dirHandle, newDirHandle);
        }
      }
      
      // Refresh the destination directory if it's the current one
      if (destination.path === get().currentPath) {
        await get().navigateToPath(destination.path);
      }
    } catch (error) {
      console.error('Error copying items:', error);
    } finally {
      set({ isLoading: false });
    }
  },
  
  // Move items to a destination
  moveItems: async (items: FileSystemItem[], destination: FileSystemItem) => {
    const { rootDirectory, currentPath } = get();
    
    if (!rootDirectory || items.length === 0 || !destination.handle || destination.kind !== 'directory') {
      return;
    }
    
    try {
      set({ isLoading: true });
      
      // First copy the items to the destination
      await get().copyItems(items, destination);
      
      // Then delete the original items
      await get().deleteItems(items);
      
      // Refresh the current directory
      await get().navigateToPath(currentPath);
    } catch (error) {
      console.error('Error moving items:', error);
    } finally {
      set({ isLoading: false });
    }
  },
  
  // Add a location to favorites
  addToFavorites: (item: FileSystemItem) => {
    const { favoriteLocations } = get();
    
    // Check if the location is already in favorites
    if (!favoriteLocations.some(fav => fav.path === item.path)) {
      set({ favoriteLocations: [...favoriteLocations, item] });
    }
  },
  
  // Remove a location from favorites
  removeFromFavorites: (item: FileSystemItem) => {
    const { favoriteLocations } = get();
    
    set({
      favoriteLocations: favoriteLocations.filter(
        fav => fav.path !== item.path
      )
    });
  },
  
  // Set root directory
  setRootDirectory: (directory: FileSystemItem | null) => {
    set({ rootDirectory: directory });
  },
  
  // Set current path
  setCurrentPath: (path: string) => {
    set({ currentPath: path });
  }
})); 