// TypeScript declarations for File System Access API scoped to Neurvana namespace
// Based on https://wicg.github.io/file-system-access/

declare namespace NeurvanaFS {
  interface FileSystemHandle {
    readonly kind: 'file' | 'directory';
    readonly name: string;
    isSameEntry(other: FileSystemHandle): Promise<boolean>;
  }

  interface FileSystemFileHandle extends FileSystemHandle {
    readonly kind: 'file';
    getFile(): Promise<File>;
    createWritable(options?: FileSystemCreateWritableOptions): Promise<FileSystemWritableFileStream>;
  }

  interface FileSystemDirectoryHandle extends FileSystemHandle {
    readonly kind: 'directory';
    getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle>;
    getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
    removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
    resolve(possibleDescendant: FileSystemHandle): Promise<string[] | null>;
    keys(): AsyncIterableIterator<string>;
    values(): AsyncIterableIterator<FileSystemHandle>;
    entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
    [Symbol.asyncIterator](): AsyncIterableIterator<[string, FileSystemHandle]>;
  }

  interface FileSystemCreateWritableOptions {
    keepExistingData?: boolean;
  }

  interface FileSystemWritableFileStream extends WritableStream {
    write(data: FileSystemWriteChunkType): Promise<void>;
    seek(position: number): Promise<void>;
    truncate(size: number): Promise<void>;
  }

  type FileSystemWriteChunkType =
    | { type: 'write'; position?: number; data: BufferSource | Blob | string }
    | { type: 'seek'; position: number }
    | { type: 'truncate'; size: number };

  interface ShowDirectoryPickerOptions {
    id?: string;
    startIn?: 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos';
    mode?: 'read' | 'readwrite';
  }

  interface ShowOpenFilePickerOptions {
    multiple?: boolean;
    excludeAcceptAllOption?: boolean;
    types?: {
      description?: string;
      accept: { [mimeType: string]: string[] };
    }[];
    id?: string;
    startIn?: 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos';
    mode?: 'read' | 'readwrite';
  }

  interface ShowSaveFilePickerOptions {
    excludeAcceptAllOption?: boolean;
    suggestedName?: string;
    types?: {
      description?: string;
      accept: { [mimeType: string]: string[] };
    }[];
    id?: string;
    startIn?: 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos';
  }
  
  // Helper functions to get standard Web API objects from window but cast to our types
  function getDirectoryPicker(): (options?: ShowDirectoryPickerOptions) => Promise<FileSystemDirectoryHandle>;
  function getOpenFilePicker(): (options?: ShowOpenFilePickerOptions) => Promise<FileSystemFileHandle[]>;
  function getSaveFilePicker(): (options?: ShowSaveFilePickerOptions) => Promise<FileSystemFileHandle>;
}

// Export our namespace
export = NeurvanaFS;
export as namespace NeurvanaFS;

// Implementation of the helper functions
declare const NeurvanaFS: {
  getDirectoryPicker(): (options?: NeurvanaFS.ShowDirectoryPickerOptions) => Promise<NeurvanaFS.FileSystemDirectoryHandle>;
  getOpenFilePicker(): (options?: NeurvanaFS.ShowOpenFilePickerOptions) => Promise<NeurvanaFS.FileSystemFileHandle[]>;
  getSaveFilePicker(): (options?: NeurvanaFS.ShowSaveFilePickerOptions) => Promise<NeurvanaFS.FileSystemFileHandle>;
};

NeurvanaFS.getDirectoryPicker = () => 
  (options?: NeurvanaFS.ShowDirectoryPickerOptions) => 
    window.showDirectoryPicker(options as any) as Promise<NeurvanaFS.FileSystemDirectoryHandle>;

NeurvanaFS.getOpenFilePicker = () => 
  (options?: NeurvanaFS.ShowOpenFilePickerOptions) => 
    window.showOpenFilePicker(options as any) as Promise<NeurvanaFS.FileSystemFileHandle[]>;

NeurvanaFS.getSaveFilePicker = () => 
  (options?: NeurvanaFS.ShowSaveFilePickerOptions) => 
    window.showSaveFilePicker(options as any) as Promise<NeurvanaFS.FileSystemFileHandle>; 