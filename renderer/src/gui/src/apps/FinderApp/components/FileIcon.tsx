import React from 'react';
import { FileSystemItem } from '../types';
import {
  FolderIcon,
  DocumentIcon,
  ImageIcon,
  VideoIcon,
  AudioIcon,
  CodeIcon,
  ArchiveIcon,
  PDFIcon,
  TextDocumentIcon,
  SpreadsheetIcon,
  PresentationIcon,
  AppIcon
} from '../../../components/MacOSIcons';
import './FileIcon.scss';

interface FileIconProps {
  item: FileSystemItem;
  size?: 'small' | 'medium' | 'large';
}

const FileIcon: React.FC<FileIconProps> = ({ item, size = 'medium' }) => {
  // Convert size to pixels
  const sizeInPx = size === 'small' ? 16 : size === 'medium' ? 24 : 48;
  
  // Determine the icon based on the file type
  const getIconComponent = (item: FileSystemItem) => {
    if (item.kind === 'directory') {
      return <FolderIcon size={sizeInPx} className="folder" />;
    }

    // Check file type based on extension or MIME type
    const extension = item.name.split('.').pop()?.toLowerCase();
    
    // Image files
    if (item.type?.startsWith('image/') || 
        ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'tiff', 'ico'].includes(extension || '')) {
      return <ImageIcon size={sizeInPx} className="image" />;
    }
    
    // Video files
    if (item.type?.startsWith('video/') || 
        ['mp4', 'webm', 'avi', 'mov', 'mkv', 'flv', 'wmv', 'm4v', '3gp'].includes(extension || '')) {
      return <VideoIcon size={sizeInPx} className="video" />;
    }
    
    // Audio files
    if (item.type?.startsWith('audio/') || 
        ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma'].includes(extension || '')) {
      return <AudioIcon size={sizeInPx} className="audio" />;
    }
    
    // Code files
    if (['js', 'jsx', 'ts', 'tsx', 'html', 'css', 'scss', 'sass', 'less', 'json', 'py', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'go', 'rb', 'php', 'swift', 'kt', 'rs', 'sql', 'sh', 'bash'].includes(extension || '')) {
      return <CodeIcon size={sizeInPx} className="code" />;
    }
    
    // Archive files
    if (['zip', 'rar', 'tar', 'gz', '7z', 'bz2', 'xz', 'iso', 'dmg'].includes(extension || '')) {
      return <ArchiveIcon size={sizeInPx} className="archive" />;
    }
    
    // PDF files
    if (extension === 'pdf' || item.type === 'application/pdf') {
      return <PDFIcon size={sizeInPx} className="pdf" />;
    }
    
    // Text files
    if (['txt', 'md', 'rtf', 'log', 'csv'].includes(extension || '') || 
        item.type === 'text/plain') {
      return <TextDocumentIcon size={sizeInPx} className="text" />;
    }
    
    // Spreadsheet files
    if (['xls', 'xlsx', 'ods', 'numbers'].includes(extension || '') || 
        item.type?.includes('spreadsheet')) {
      return <SpreadsheetIcon size={sizeInPx} className="spreadsheet" />;
    }
    
    // Presentation files
    if (['ppt', 'pptx', 'odp', 'key'].includes(extension || '') || 
        item.type?.includes('presentation')) {
      return <PresentationIcon size={sizeInPx} className="presentation" />;
    }
    
    // Document files
    if (['doc', 'docx', 'odt', 'pages'].includes(extension || '') || 
        item.type?.includes('document')) {
      return <DocumentIcon size={sizeInPx} className="document" />;
    }
    
    // Executable files
    if (['exe', 'app', 'msi', 'bin', 'command', 'sh', 'bat'].includes(extension || '')) {
      return <AppIcon size={sizeInPx} className="executable" />;
    }
    
    // Default document icon for other files
    return <DocumentIcon size={sizeInPx} />;
  };

  return (
    <div className={`file-icon-wrapper ${size}`}>
      {getIconComponent(item)}
    </div>
  );
};

export default FileIcon; 