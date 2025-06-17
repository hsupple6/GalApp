// Add FileSystemHandle types for TypeScript
declare global {
  interface FileSystemHandle {
    readonly kind: 'file' | 'directory';
    readonly name: string;
  }

  interface FileSystemDirectoryHandle extends FileSystemHandle {
    readonly kind: 'directory';
    getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle>;
    getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
    removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
    resolve(possibleDescendant: FileSystemHandle): Promise<string[] | null>;
    entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
  }

  interface FileSystemFileHandle extends FileSystemHandle {
    readonly kind: 'file';
    getFile(): Promise<File>;
    createWritable(options?: { keepExistingData?: boolean }): Promise<FileSystemWritableFileStream>;
  }

  interface FileSystemWritableFileStream extends WritableStream {
    write(data: BufferSource | Blob | string): Promise<void>;
    seek(position: number): Promise<void>;
    truncate(size: number): Promise<void>;
    close(): Promise<void>;
  }
  
  interface Window {
    showDirectoryPicker: (options?: { 
      mode?: 'read' | 'readwrite';
      id?: string;
      startIn?: 'desktop' | 'documents' | 'downloads' | 'home' | 'music' | 'pictures' | 'videos';
    }) => Promise<FileSystemDirectoryHandle>;
    showOpenFilePicker: (options?: { multiple?: boolean }) => Promise<FileSystemFileHandle[]>;
    showSaveFilePicker: (options?: any) => Promise<FileSystemFileHandle>;
  }
}

// View mode for the finder
export type ViewMode = 'list' | 'grid' | 'column';

// File operation types
export type FileOperation = 'copy' | 'move' | 'delete' | 'rename';

// File system item representation
export interface FileSystemItem {
  name: string;
  kind: 'file' | 'directory';
  handle?: FileSystemFileHandle | FileSystemDirectoryHandle;
  path: string;
  children?: FileSystemItem[];
  size: number;
  lastModified: Date;
  type?: string; // MIME type for files
  icon?: string; // Icon to display
  error?: string; // Error message if the item cannot be accessed
}

// Props for the FileTree component
export interface FileTreeProps {
  rootItem: FileSystemItem | null;
  currentPath: string;
  selectedItems: FileSystemItem[];
  viewMode: ViewMode;
  onSelectItem: (item: FileSystemItem) => void;
  onNavigate: (path: string) => void;
  onFileOperation?: (
    operation: FileOperation,
    items: FileSystemItem[],
    destination?: FileSystemItem,
    newName?: string
  ) => void;
}

// Props for the Toolbar component
export interface ToolbarProps {
  canGoBack: boolean;
  canGoForward: boolean;
  canGoUp: boolean;
  currentPath: string;
  viewMode: ViewMode;
  selectedItems: FileSystemItem[];
  onBack: () => void;
  onForward: () => void;
  onUp: () => void;
  onChangeViewMode: (mode: ViewMode) => void;
  onCreateFolder: () => void;
  onDelete: () => void;
}

// Props for the FilePreview component
export interface FilePreviewProps {
  item: FileSystemItem | null;
}

// Store for the Finder app
export interface FinderStore {
  rootDirectory: FileSystemItem | null;
  currentPath: string;
  history: string[];
  historyIndex: number;
  selectedItems: FileSystemItem[];
  viewMode: ViewMode;
  isLoading: boolean;
  favoriteLocations: FileSystemItem[];
  error?: string; // Error message for system file access errors
  
  // Methods
  tryRestoreDirectory: () => Promise<boolean>;
  openDirectory: () => Promise<void>;
  navigateToPath: (path: string) => Promise<void>;
  navigateBack: () => void;
  navigateForward: () => void;
  navigateUp: () => void;
  selectItem: (item: FileSystemItem) => void;
  deselectItem: (item: FileSystemItem) => void;
  clearSelection: () => void;
  setViewMode: (mode: ViewMode) => void;
  createFolder: () => Promise<void>;
  deleteItems: (items: FileSystemItem[]) => Promise<void>;
  renameItem: (item: FileSystemItem, newName: string) => Promise<void>;
  copyItems: (items: FileSystemItem[], destination: FileSystemItem) => Promise<void>;
  moveItems: (items: FileSystemItem[], destination: FileSystemItem) => Promise<void>;
  addToFavorites: (item: FileSystemItem) => void;
  removeFromFavorites: (item: FileSystemItem) => void;
  setRootDirectory: (directory: FileSystemItem | null) => void;
  setCurrentPath: (path: string) => void;
} 