import React, { useEffect, useState } from 'react';
import { FilePreviewProps } from '../types';
import './FilePreview.scss';
import FileIcon from './FileIcon';

const FilePreview: React.FC<FilePreviewProps> = ({ item }) => {
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Reset state when item changes
    setPreview(null);
    setError(null);
    
    if (!item || item.kind !== 'file' || !item.handle) {
      return;
    }

    let cleanupFunction: (() => void) | undefined;

    const loadPreview = async () => {
      try {
        const file = await (item.handle as FileSystemFileHandle).getFile();
        
        // Handle different file types
        if (file.type.startsWith('image/')) {
          // Image preview
          const url = URL.createObjectURL(file);
          setPreview(url);
          
          // Clean up URL when component unmounts or item changes
          cleanupFunction = () => URL.revokeObjectURL(url);
        } else if (file.type.startsWith('text/') || 
                  file.type === 'application/json' || 
                  file.name.endsWith('.md') || 
                  file.name.endsWith('.txt')) {
          // Text preview (limit to first 10KB)
          const text = await file.slice(0, 10240).text();
          setPreview(text);
        } else if (file.type.startsWith('video/')) {
          // Video preview
          const url = URL.createObjectURL(file);
          setPreview(url);
          
          // Clean up URL when component unmounts or item changes
          cleanupFunction = () => URL.revokeObjectURL(url);
        } else if (file.type.startsWith('audio/')) {
          // Audio preview
          const url = URL.createObjectURL(file);
          setPreview(url);
          
          // Clean up URL when component unmounts or item changes
          cleanupFunction = () => URL.revokeObjectURL(url);
        } else {
          // No preview available
          setError('No preview available for this file type');
        }
      } catch (err) {
        console.error('Error loading file preview:', err);
        setError('Error loading preview');
      }
    };

    loadPreview();
    
    return () => {
      if (cleanupFunction) {
        cleanupFunction();
      }
    };
  }, [item]);

  if (!item) {
    return (
      <div className="file-preview empty">
        <p>No file selected</p>
      </div>
    );
  }

  // Format file size for display
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Format date for display
  const formatDate = (date: Date): string => {
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  return (
    <div className="file-preview">
      <div className="preview-header">
        <FileIcon item={item} size="large" />
        <div className="file-info">
          <h3>{item.name}</h3>
          <p>
            {item.kind === 'file' ? formatFileSize(item.size) : `${item.children?.length || 0} items`}
            {' • '}
            Last modified: {formatDate(item.lastModified)}
          </p>
          {item.kind === 'file' && item.type && <p>Type: {item.type}</p>}
        </div>
      </div>
      
      <div className="preview-content">
        {error ? (
          <div className="preview-error">{error}</div>
        ) : preview ? (
          item.type?.startsWith('image/') ? (
            <img src={preview} alt={item.name} />
          ) : item.type?.startsWith('video/') ? (
            <video src={preview} controls />
          ) : item.type?.startsWith('audio/') ? (
            <audio src={preview} controls />
          ) : (
            <pre>{preview}</pre>
          )
        ) : (
          <div className="preview-loading">Loading preview...</div>
        )}
      </div>
    </div>
  );
};

export default FilePreview; 