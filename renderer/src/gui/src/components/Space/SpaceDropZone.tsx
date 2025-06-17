import React, { useCallback, useState } from 'react';
import { DropEvent, useDropzone } from 'react-dropzone';

import './SpaceDropZone.scss';
import fetchService from '../../services/fetchService';
import { useFileService } from '../../services/FileService';
import useEntityStore from '../../stores/entityStore';
import useSpaceStore from '../../stores/spaceStore';
import { BaseEntityType } from '../../types';
import { generateWindowId, getWindowSizeAndPosition } from './utils/windowUtils';
import { API_BASE_URL } from '../../api/config';

interface SpaceDropZoneProps {
  children: React.ReactNode;
  className?: string;
}

// Helper functions
const getFileFromEntry = (entry: FileSystemFileEntry): Promise<File> => {
  return new Promise((resolve, reject) => {
    entry.file(resolve, reject);
  });
};

const getFilesFromDirectory = async (entry: FileSystemDirectoryEntry): Promise<File[]> => {
  const dirReader = entry.createReader();
  const entries = await new Promise<FileSystemEntry[]>((resolve, reject) => {
    dirReader.readEntries(resolve, reject);
  });

  const files: File[] = [];
  for (const entry of entries) {
    if (entry.isFile) {
      const file = await getFileFromEntry(entry as FileSystemFileEntry);
      // Add directory path info to the file for grouping
      (file as any).__directoryInfo = {
        path: entry.fullPath.split('/').slice(0, -1).join('/'),
        name: entry.name
      };
      files.push(file);
    } else if (entry.isDirectory) {
      const subFiles = await getFilesFromDirectory(entry as FileSystemDirectoryEntry);
      files.push(...subFiles);
    }
  }
  return files;
};

const readAllFilesFromDirectory = async (
  directory: FileSystemDirectoryEntry,
  childEntityIds: string[],
  processFile: (file: File, groupIds?: string[]) => Promise<any>,
): Promise<File[]> => {
  const reader = directory.createReader();
  const entries: FileSystemEntry[] = await new Promise((resolve, reject) => reader.readEntries(resolve, reject));

  const files: File[] = [];

  for (const entry of entries) {
    if (entry.isFile) {
      const file = await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject));
      // Add directory info for better grouping
      (file as any).__directoryInfo = {
        path: entry.fullPath.split('/').slice(0, -1).join('/'),
        name: entry.name,
        fullPath: entry.fullPath
      };
      const result = await processFile(file);
      if (result && result._id) {
        childEntityIds.push(result._id);
      }
      files.push(file);
    } else if (entry.isDirectory) {
      const subDirFiles = await readAllFilesFromDirectory(
        entry as FileSystemDirectoryEntry,
        childEntityIds,
        processFile,
      );
      files.push(...subDirFiles);
    }
  }

  return files;
};

// Custom Event handler for react-dropzone to handle both files and directories
const customFileGetter = async (event: DropEvent): Promise<File[]> => {
  console.log('Drop event:', event);

  // Handle drag and drop case
  const dragEvent = event as DragEvent;
  if (dragEvent.dataTransfer?.items) {
    const items = dragEvent.dataTransfer.items;
    const files: File[] = [];

    for (const item of items) {
      if (item.kind === 'file') {
        if (item.webkitGetAsEntry) {
          const entry = item.webkitGetAsEntry();
          if (entry?.isFile) {
            const file = await getFileFromEntry(entry as FileSystemFileEntry);
            // Add metadata for individual files
            (file as any).__directoryInfo = {
              path: 'root',
              name: file.name,
              fullPath: `/${file.name}`,
              isDirectory: false
            };
            files.push(file);
          } else if (entry?.isDirectory) {
            // Use the enhanced directory reader
            const childEntityIds: string[] = [];
            const dirFiles = await readAllFilesFromDirectory(
              entry as FileSystemDirectoryEntry,
              childEntityIds,
              async (file: File) => {
                // Just return the file, we'll process uploads later
                return { _id: `temp-${Date.now()}-${Math.random()}` };
              }
            );
            files.push(...dirFiles);
          }
        } else {
          const file = item.getAsFile();
          if (file) {
            // Add metadata for fallback files
            (file as any).__directoryInfo = {
              path: 'root',
              name: file.name,
              fullPath: `/${file.name}`,
              isDirectory: false
            };
            files.push(file);
          }
        }
      }
    }
    return files;
  }

  // Handle file input case
  const inputEvent = event as Event;
  if ('target' in inputEvent && inputEvent.target instanceof HTMLInputElement && inputEvent.target.files) {
    console.log('Handling files from input:', inputEvent.target.files);
    const fileList = Array.from(inputEvent.target.files);
    // Add metadata for input files
    fileList.forEach(file => {
      (file as any).__directoryInfo = {
        path: 'root',
        name: file.name,
        fullPath: `/${file.name}`,
        isDirectory: false
      };
    });
    return fileList;
  }

  return [];
};

// Helper to determine app type
const getAppIdForFile = (file: File) => {
  const ext = file.name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf':
      return 'pdfium';
    case 'txt':
    case 'md':
      return 'webdocument';
    default:
      return 'webdocument'; // fallback
  }
};

// SpaceDropZone Wrapper Component
const SpaceDropZone: React.FC<SpaceDropZoneProps> = ({ children, className = '' }) => {
  const fileService = useFileService();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ [key: string]: number }>({});
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const entityStore = useEntityStore();
  const { addWindow } = useSpaceStore();

  const updateProgress = (fileName: string, percent: number) => {
    setProgress((prev) => ({ ...prev, [fileName]: percent }));
  };

  const handleDrop = useCallback(
    async (acceptedFiles: File[]) => {
      setUploading(true);
      setProgress({});
      setErrors({});

      try {
        console.log('[SpaceDropZone] Processing files:', acceptedFiles);

        // Group files by directory
        const filesByDirectory = new Map<string, File[]>();
        acceptedFiles.forEach((file) => {
          const dirInfo = (file as any).__directoryInfo;
          const key = dirInfo?.path || 'root';
          const existing = filesByDirectory.get(key) || [];
          filesByDirectory.set(key, [...existing, file]);
        });

        const allUploadedEntities: BaseEntityType[] = [];

        // Process each directory
        for (const [dirPath, files] of filesByDirectory.entries()) {
          // Upload files with progress tracking
          const uploadPromises = files.map(async (file) => {
            try {
              updateProgress(file.name, 0);
              const entity = await fileService.addFile(file);
              updateProgress(file.name, 100);

              // Open the file in a new window after successful upload
              if (entity) {
                const { size, position } = getWindowSizeAndPosition();
                const fileName = (entity.skeleton as any)?.fileName || entity.name || file.name;
                addWindow({
                  id: generateWindowId(),
                  type: 'window',
                  position,
                  size,
                  appType: getAppIdForFile(file), // Use helper to determine app
                  title: fileName,
                  entity: entity,
                });
              }

              return entity;
            } catch (error) {
              console.error(`Failed to upload ${file.name}:`, error);
              setErrors((prev) => ({
                ...prev,
                [file.name]: error instanceof Error ? error.message : 'Upload failed',
              }));
              return null;
            }
          });

          const results = await Promise.all(uploadPromises);
          const uploadedEntities = results.filter(Boolean) as BaseEntityType[];
          allUploadedEntities.push(...uploadedEntities);

          // Create group if this was a directory upload
          if (dirPath !== 'root' && uploadedEntities.length > 0) {
            try {
              const formData = new FormData();
              formData.append('folderName', dirPath.split('/').pop() || 'Untitled Folder');
              formData.append('childEntities', JSON.stringify(uploadedEntities.map((f) => f._id)));
              formData.append('entityType', 'Group');

              await fetchService(`${API_BASE_URL}/files/create-group`, {
                method: 'POST',
                body: formData,
              });
            } catch (error) {
              console.error('Failed to create group:', error);
              // Continue even if group creation fails
            }
          }
        }

        // Refresh entity store if any files were uploaded
        if (allUploadedEntities.length > 0) {
          const currentSpaceId = entityStore.currentSpaceId;
          if (currentSpaceId) {
            console.log('[SpaceDropZone] Refreshing entities after upload');
            await entityStore.fetchEntities();
          }
        }
      } catch (error) {
        console.error('[SpaceDropZone] Upload failed:', error);
      } finally {
        setUploading(false);
      }
    },
    [fileService, entityStore, addWindow],
  );



  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleDrop,
    getFilesFromEvent: (event) => customFileGetter(event),
    multiple: true,
    noClick: true, // Prevent clicking anywhere from opening file dialog
  });

  return (
    <div 
      {...getRootProps()} 
      className={`space-dropzone ${className} ${isDragActive ? 'drag-active' : ''}`}
      style={{
        boxShadow: isDragActive ? 'inset 0 0 0 3px #007AFF' : 'none',
        borderRadius: isDragActive ? '12px' : '0',
        transition: 'box-shadow 0.2s ease, border-radius 0.2s ease'
      }}
    >
      <input {...getInputProps()} />
      
      {children}
      
      {/* Top Gradient Drop Hint */}
      {isDragActive && (
        <div className="drop-hint-gradient">
          <div className="drop-hint-message">
            📤 Drop to upload files and folders
          </div>

        </div>
      )}
      
      {/* Upload Progress Toast */}
      {uploading && (
        <div className="upload-toast">
          <div className="toast-header">
            <h4>📤 Uploading Files</h4>
            <div className="upload-summary">
              {Object.keys(progress).length} file(s) • {Object.values(progress).reduce((sum, p) => sum + p, 0) / Object.keys(progress).length || 0}% complete
            </div>
          </div>
          <div className="toast-files">
            {Object.entries(progress).map(([fileName, percent]) => (
              <div key={fileName} className="toast-file-item">
                <div className="file-info">
                  <span className="file-name">{fileName}</span>
                  <span className="file-percent">{Math.round(percent)}%</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${percent}%` }} />
                </div>
                {errors[fileName] && <div className="file-error">❌ {errors[fileName]}</div>}
              </div>
            ))}
          </div>
        </div>
      )}


    </div>
  );
};

export default SpaceDropZone;
