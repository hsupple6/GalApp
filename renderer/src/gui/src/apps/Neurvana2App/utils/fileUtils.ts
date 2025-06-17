/**
 * Determines the Monaco language based on file extension
 */
export function getFileLanguage(filename: string): string {
  if (!filename) return 'plaintext';
  
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  
  // Map file extensions to Monaco language IDs
  const languageMap: Record<string, string> = {
    // JavaScript/TypeScript
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    
    // Web
    'html': 'html',
    'htm': 'html',
    'css': 'css',
    'scss': 'scss',
    'less': 'less',
    'json': 'json',
    
    // Backend
    'py': 'python',
    'rb': 'ruby',
    'php': 'php',
    'java': 'java',
    'c': 'c',
    'h': 'c',
    'cpp': 'cpp',
    'hpp': 'cpp',
    'cs': 'csharp',
    'go': 'go',
    'rs': 'rust',
    
    // Data/Config
    'csv': 'csv',
    'tsv': 'csv',
    'md': 'markdown',
    'markdown': 'markdown',
    'yaml': 'yaml',
    'yml': 'yaml',
    'toml': 'toml',
    'ini': 'ini',
    'xml': 'xml',
    'svg': 'xml',
    'sql': 'sql',
    
    // Shell
    'sh': 'shell',
    'bash': 'shell',
    'zsh': 'shell',
    'ps1': 'powershell',

    // Documents
    'txt': 'plaintext',
    'log': 'plaintext',
    'pdf': 'pdf',
    'doc': 'doc',
    'docx': 'doc',
    'xls': 'excel',
    'xlsx': 'excel',
    'ppt': 'powerpoint',
    'pptx': 'powerpoint',
  };
  
  return languageMap[ext] || 'plaintext';
}

/**
 * Checks if a file is binary (non-text)
 */
export function isBinaryFile(filename: string): boolean {
  if (!filename) return false;
  
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const binaryExtensions = [
    // Images
    'jpg', 'jpeg', 'png', 'gif', 'bmp', 'ico', 'webp', 'tiff',
    
    // Audio
    'mp3', 'wav', 'ogg', 'flac', 'm4a',
    
    // Video
    'mp4', 'mov', 'avi', 'mkv', 'webm',
    
    // Documents
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
    
    // Archives
    'zip', 'tar', 'gz', 'rar', '7z',
    
    // Other
    'exe', 'dll', 'so', 'dylib', 'bin'
  ];
  
  // Make sure Python files and other code files are treated as text files
  const codeExtensions = ['py', 'js', 'jsx', 'ts', 'tsx', 'html', 'css', 'json', 'md', 'txt', 'csv'];
  if (codeExtensions.includes(ext)) {
    return false;
  }
  
  return binaryExtensions.includes(ext);
}

/**
 * Returns the appropriate icon name for a file type
 */
export function getFileIcon(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  
  // Map file extensions to icon names
  const iconMap: Record<string, string> = {
    // JavaScript/TypeScript
    'js': 'javascript',
    'jsx': 'react',
    'ts': 'typescript',
    'tsx': 'react',
    
    // Web
    'html': 'html',
    'htm': 'html',
    'css': 'css',
    'scss': 'sass',
    'less': 'less',
    'json': 'json',
    
    // Backend
    'py': 'python',
    'rb': 'ruby',
    'php': 'php',
    'java': 'java',
    'c': 'c',
    'h': 'c',
    'cpp': 'cpp',
    'hpp': 'cpp',
    'cs': 'csharp',
    'go': 'go',
    'rs': 'rust',
    
    // Data/Config
    'csv': 'table',
    'tsv': 'table',
    'md': 'markdown',
    'markdown': 'markdown',
    'yaml': 'yaml',
    'yml': 'yaml',
    'toml': 'settings',
    'ini': 'settings',
    'xml': 'xml',
    'svg': 'image',
    'sql': 'database',
    
    // Shell
    'sh': 'terminal',
    'bash': 'terminal',
    'zsh': 'terminal',
    'ps1': 'powershell',

    // Images
    'jpg': 'image',
    'jpeg': 'image',
    'png': 'image',
    'gif': 'image',
    'bmp': 'image',
    'ico': 'image',
    'webp': 'image',

    // Documents
    'pdf': 'pdf',
    'doc': 'word',
    'docx': 'word',
    'xls': 'excel',
    'xlsx': 'excel',
    'ppt': 'powerpoint',
    'pptx': 'powerpoint',
  };
  
  return iconMap[ext] || 'document';
}

/**
 * Formats a file path for display
 */
export function formatFilePath(path: string): string {
  // Remove leading slash
  let formatted = path.startsWith('/') ? path.substring(1) : path;
  
  // If the path is very long, truncate the middle
  if (formatted.length > 50) {
    const parts = formatted.split('/');
    if (parts.length > 4) {
      const start = parts.slice(0, 2).join('/');
      const end = parts.slice(-2).join('/');
      formatted = `${start}/.../${end}`;
    }
  }
  
  return formatted;
}

/**
 * Get file extension from filename or path
 */
export function getFileExtension(filename: string): string {
  if (!filename) return '';
  const parts = filename.split('.');
  return parts.length > 1 ? `.${parts.pop()}` : '';
}

/**
 * Get file name without extension
 */
export function getFileNameWithoutExtension(filename: string): string {
  if (!filename) return '';
  const name = filename.split('/').pop() || '';
  const ext = getFileExtension(name);
  return ext ? name.slice(0, -ext.length) : name;
}

/**
 * Checks if a file should be opened in the monaco editor
 */
export function shouldOpenInEditor(filename: string): boolean {
  return !isBinaryFile(filename);
} 