import { FileEntity } from '../types';

export function getAppForFile(file: FileEntity): string | null {
  // Get the file extension
  const extension = file.name.split('.').pop()?.toLowerCase();

  // Map file extensions to app types
  switch (extension) {
    case 'txt':
    case 'md':
    case 'json':
    case 'js':
    case 'ts':
    case 'html':
    case 'css':
      return 'WebDocument';
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
      return 'ImageViewer';
    case 'pdf':
      return 'PDFium';
    // Add more file types and corresponding apps as needed
    default:
      return null;
  }
} 