import { AnyWindowEntity,WindowEntity } from 'types/windows';
import { WindowWithApplicationState } from '../../../types/appState';

import { FileSkeleton, type Note } from '../../../types';
import type { BaseEntityType } from '../../../types/entities';

export const generateWindowId = () => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  return `window-${timestamp}-${random}`;
};

export const getAppTitle = (appTypeOrWindow: string | WindowWithApplicationState): string => {
  // If an object is passed, it might be a window with application state
  if (typeof appTypeOrWindow === 'object') {
    const window = appTypeOrWindow;
    
    // Check for docs application state
    if (window.applicationState?.docs) {
      const docsState = window.applicationState.docs;
      
      // If we're editing a document, use its name
      if (docsState.currentState === 'editing' && docsState.currentDocName) {
        return docsState.currentDocName;
      }
      
      // If we have an activeDocId but no currentDocName, try to find it in recentDocs
      if (docsState.activeDocId && docsState.recentDocs) {
        const activeDoc = docsState.recentDocs.find((doc) => doc.docId === docsState.activeDocId);
        if (activeDoc && activeDoc.name) {
          return activeDoc.name;
        }
      }
      
      // Default docs title
      return 'Documents';
    }
    
    // For other app types, get the app type from the window
    const appType = window.appType || '';
    // Use the appType string to lookup a title (avoid recursion)
    return getAppTitleByType(appType);
  }
  
  // String-based app type lookup
  return getAppTitleByType(appTypeOrWindow);
};

// Helper function to get app title by type string
export const getAppTitleByType = (appType: string): string => {
  switch (appType) {
    case 'chat':
      return 'Chat';
    case 'system':
    case 'entityBrowser':
      return 'Entity Browser';
    case 'console':
      return 'Console';
    case 'pdf':
      return 'PDF Viewer';
    case 'pdfium':
      return 'PDFium Viewer';
    case 'notes':
      return 'Notes';
    case 'docs':
      return 'Documents';
    case 'browser':
      return 'Browser';
    case 'webdoc':
      return 'Web Document';
    case 'settings':
      return 'Settings';
    case 'imageviewer':
      return 'Image Viewer';
    default:
      return 'Window';
  }
};

export const getAppTypeByExt = (ext: string): string | null => {
  switch (ext.toLowerCase()) {
    case '.pdf':
      return 'pdfium';
    case '.txt':
      return 'notes';
    case '.jpg':
    case '.jpeg':
    case '.png':
    case '.gif':
    case '.webp':
    case '.bmp':
      return 'imageviewer';
    default:
      return null;
  }
};

export const getAppTypeByEntity = (entity: BaseEntityType): string | null => {
  if ((entity?.skeleton as FileSkeleton)?.['@type'] === 'File' && 
      (entity?.skeleton as FileSkeleton)?.mimeType === 'application/pdf') {
    return 'pdfium';
  }

  // Check if it's an image file
  if (entity.entityType === 'File') {
    // Use skeleton.fileName first, fallback to entity.name
    const fileName = ((entity.skeleton as any)?.fileName || entity.name || '').toLowerCase();
    const ext = fileName.substring(fileName.lastIndexOf('.'));
    return getAppTypeByExt(ext);
  }

  return null;
};

export const stripHtml = (html: string) => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || '';
};

export const getPreviewText = (note: Note) => {
  try {
    const content = note.skeleton?.content;
    if (!content) {
      return 'Empty Note';
    }

    if (typeof content === 'string') {
      return stripHtml(content).substring(0, 50) || 'Empty Note';
    }

    return 'Empty Note';
  } catch (e) {
    return 'Error loading note';
  }
};

export const getEntityDisplayName = (entity: BaseEntityType) => {
  if (entity.entityType === 'Note') {
    return getPreviewText(entity as Note);
  } else if (entity.entityType === 'WebDocument') {
    return (entity as any).skeleton.url;
  } else if (entity.entityType === 'Space') {
    return entity.name || `space_${entity._id}`;
  } else if (entity.entityType === 'File') {
    // Check for fileName in skeleton first, fallback to entity.name
    return (entity.skeleton as any)?.fileName || entity.name;
  } else {
    return entity.name;
  }
};

export const getEntityDisplayIcon = (entity: BaseEntityType) => {
  const iconMap = {
    Space: '🌌',
    Group: '📁',
    Note: '📝',
    File: '📄',
    WebDocument: '🌐',
    Doc: '📄',
  };
  
  return iconMap[entity.entityType as keyof typeof iconMap] || '⬜️'; // Default to file icon
};

export const getRandomWindowPositionShift = () => {
  const numbers = [-30, -20, -10, 10, 20, 30];
  return numbers[Math.floor(Math.random() * numbers.length)];
};

export const getWindowSizeAndPosition = () => {
  const size = { width: 600, height: 500 };
  const position = {
    x: window.innerWidth / 2 - size.width / 2 + getRandomWindowPositionShift(),
    y: window.innerHeight / 2 - size.height / 2 + getRandomWindowPositionShift(),
  };

  return { size, position };
};

export const fileAndGroupFilter = (entity: BaseEntityType) =>
  (entity.entityType === 'File' || entity.entityType === 'Group') && !entity.isSystemGroup;

export const getWindowTitle = (window: WindowEntity): string => {
  // If there's no appType, fall back to the provided title
  if (!window.appType) return window.title || 'Untitled';

  // Check for application state for docs
  const windowWithState = window as WindowWithApplicationState;
  if (window.appType === 'docs' && windowWithState.applicationState?.docs) {
    const docsState = windowWithState.applicationState.docs;
    
    // If we're editing a document, use its name
    if (docsState.currentState === 'editing' && docsState.currentDocName) {
      return docsState.currentDocName;
    }
    
    // If we have an activeDocId but no currentDocName, try to find it in recentDocs
    if (docsState.activeDocId && docsState.recentDocs) {
      const activeDoc = docsState.recentDocs.find((doc) => doc.docId === docsState.activeDocId);
      if (activeDoc && activeDoc.name) {
        return activeDoc.name;
      }
    }
  }

  // Special cases where we want to use the entity name instead of app name
  const useEntityNameApps = ['browser', 'pdfium', 'webdoc'];
  
  if (useEntityNameApps.includes(window.appType) && window.entity) {
    // Use entity name for content-based windows
    return window.entity.name || getEntityDisplayName(window.entity) || window.title;
  }

  // For app-based windows, use the app name
  return getAppTitleByType(window.appType);
};

export const getMentionDisplayName = (entity: AnyWindowEntity): string => {
  if (!entity) return 'Unknown';
  
  if ('title' in entity && typeof entity.title === 'string') {
    return entity.title || 'Untitled';
  }
  
  if ('name' in entity && typeof entity.name === 'string') {
    return entity.name;
  }

  return entity.id || 'Unknown';
};