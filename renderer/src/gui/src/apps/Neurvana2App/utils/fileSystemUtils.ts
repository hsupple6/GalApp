/**
 * File System Access API utilities for Neurvana
 * These utilities help bridge the standard Web API with our namespaced typings
 */
import NeurvanaFS from '../../../types/fileSystemAccess';

/**
 * Get a directory picker function that wraps the standard Web API
 */
export const getDirectoryPicker = (): 
  (options?: NeurvanaFS.ShowDirectoryPickerOptions) => Promise<NeurvanaFS.FileSystemDirectoryHandle> => {
  return (options?: NeurvanaFS.ShowDirectoryPickerOptions) => 
    window.showDirectoryPicker(options as any) as Promise<NeurvanaFS.FileSystemDirectoryHandle>;
};

/**
 * Get an open file picker function that wraps the standard Web API
 */
export const getOpenFilePicker = (): 
  (options?: NeurvanaFS.ShowOpenFilePickerOptions) => Promise<NeurvanaFS.FileSystemFileHandle[]> => {
  return (options?: NeurvanaFS.ShowOpenFilePickerOptions) => 
    window.showOpenFilePicker(options as any) as Promise<NeurvanaFS.FileSystemFileHandle[]>;
};

/**
 * Get a save file picker function that wraps the standard Web API
 */
export const getSaveFilePicker = (): 
  (options?: NeurvanaFS.ShowSaveFilePickerOptions) => Promise<NeurvanaFS.FileSystemFileHandle> => {
  return (options?: NeurvanaFS.ShowSaveFilePickerOptions) => 
    window.showSaveFilePicker(options as any) as Promise<NeurvanaFS.FileSystemFileHandle>;
};

/**
 * Convert a standard FileSystemHandle to our namespaced type
 */
export const asNeurvanaFileSystemHandle = (
  handle: FileSystemHandle
): NeurvanaFS.FileSystemHandle => {
  return handle as unknown as NeurvanaFS.FileSystemHandle;
};

/**
 * Convert a standard FileSystemDirectoryHandle to our namespaced type
 */
export const asNeurvanaDirectoryHandle = (
  handle: FileSystemDirectoryHandle
): NeurvanaFS.FileSystemDirectoryHandle => {
  return handle as unknown as NeurvanaFS.FileSystemDirectoryHandle;
};

/**
 * Convert a standard FileSystemFileHandle to our namespaced type
 */
export const asNeurvanaFileHandle = (
  handle: FileSystemFileHandle
): NeurvanaFS.FileSystemFileHandle => {
  return handle as unknown as NeurvanaFS.FileSystemFileHandle;
};

/**
 * Convert a FileSystemHandle to either FileSystemDirectoryHandle or FileSystemFileHandle
 * based on its kind
 */
export const asAppropriateNeurvanaHandle = (
  handle: FileSystemHandle
): NeurvanaFS.FileSystemDirectoryHandle | NeurvanaFS.FileSystemFileHandle => {
  if (handle.kind === 'directory') {
    return asNeurvanaDirectoryHandle(handle as FileSystemDirectoryHandle);
  } else {
    return asNeurvanaFileHandle(handle as FileSystemFileHandle);
  }
}; 