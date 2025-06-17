import { AnyWindowEntity } from 'types/windows';
import { PDFWindowContent, WindowContent } from '../types';
import { getWindowTitle } from '../../utils/windowUtils';
import { logger } from 'utils/logger';

export const contextUtils = {
  // Generate a stable content hash using browser's Web Crypto API instead of Node's crypto
  generateContentHash: (content: string): string => {
    // Simple fallback hash function for when crypto API isn't available
    const simpleHash = (str: string): string => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32bit integer
      }
      return hash.toString(16).padStart(8, '0');
    };

    try {
      // Use available browser APIs when possible
      if (typeof window !== 'undefined' && window.btoa) {
        // Use simple but browser-compatible base64 encoding
        return window.btoa(encodeURIComponent(content)).slice(0, 16);
      } else {
        return simpleHash(content);
      }
    } catch (e) {
      logger.warn('Failed to generate content hash', e);
      return simpleHash(content);
    }
  },

  // Generate a stable window identifier based on window type and content
  getStableWindowId: (window: AnyWindowEntity): string => {
    // Use existing ID if it's a stable part of the system
    if (window.id) {
      // If it's a document, include the document ID too
      if (window.appType === 'docs' && window.applicationState?.docs?.activeDocId) {
        return `docs-${window.applicationState.docs.activeDocId}`;
      }
      // For PDFs, include entity ID
      if (window.appType === 'pdfium' && window.applicationState?.pdfium?.entityId) {
        return `pdf-${window.applicationState.pdfium.entityId}`;
      }
      // For notes, include note ID
      if (window.appType === 'notes' && window.applicationState?.notes?.activeNoteId) {
        return `notes-${window.applicationState.notes.activeNoteId}`;
      }
    }
    // Fallback to using window ID
    return window.id;
  },

  /**
   * Creates window content based on the window type and properties
   */
  createWindowContent: (window: AnyWindowEntity): WindowContent | null => {
    logger.log(`[contextUtils] Creating window content for window ${window.id}`);

    // Extract common properties
    const windowId = window.id;
    // Use getWindowTitle to get the proper computed title instead of just window.title
    const title = window.type === 'window' ? getWindowTitle(window) : window.title || 'Untitled';
    const isActive = false; // This gets set by the caller if needed

    console.log('>>>> createWindowContent. window: ', window);

    // Determine window type based on multiple properties
    const appType = window.appType || '';

    // Handle PDF windows (multiple ways to detect)
    if (
      appType === 'pdfium' ||
      appType === 'PDF' ||
      (window.applicationState as any)?.pdfium ||
      (window.title || '').toLowerCase().includes('.pdf')
    ) {
      logger.log(`[contextUtils] Detected PDF window: ${windowId}`);

      // Try to get entity ID from several possible locations
      let entityId = null;
      if ((window.applicationState as any)?.pdfium?.entityId) {
        entityId = (window.applicationState as any).pdfium.entityId;
      } else if ((window as any).entityId) {
        entityId = (window as any).entityId;
      } else if (window.entity && (window.entity as any)._id) {
        entityId = (window.entity as any)._id;
      } else if (window.entity && (window.entity as any).id) {
        entityId = (window.entity as any).id;
      }

      logger.log(`[contextUtils] PDF window entity ID: ${entityId || 'unknown'}`);

      const content: PDFWindowContent = {
        appType: 'PDF', // Always normalize to 'PDF' for consistency
        windowId,
        entityId,
        isActive,
        stableId: `pdf-${entityId || windowId}`,
        title,
      };

      return content;
    }

    // Handle docs windows
    if (appType === 'docs' || (window.applicationState as any)?.docs) {
      logger.log(`[contextUtils] Detected docs window: ${windowId}`);

      // Try to get doc ID
      let docId = null;
      if ((window.applicationState as any)?.docs?.activeDocId) {
        docId = (window.applicationState as any).docs.activeDocId;
      } else if ((window as any).docId) {
        docId = (window as any).docId;
      }

      // Get content if available
      let content = '';
      let contentHash = '';

      if ((window.applicationState as any)?.docs?.content) {
        content = (window.applicationState as any).docs.content;
        contentHash = String(Date.now()); // Use timestamp as hash to detect changes
      }

      return {
        appType: 'docs',
        windowId,
        isActive,
        screen: 'doc',
        docId: docId || '',
        content,
        contentHash,
        stableId: `docs-${docId || windowId}`,
        title,
      };
    }

    // Handle note windows
    if (appType === 'notes' || appType === 'note') {
      logger.log(`[contextUtils] Detected note window: ${windowId}`);

      return {
        appType: 'notes',
        windowId,
        isActive,
        stableId: `notes-${windowId}`,
        title,
      };
    }

    // Generic fallback for unknown window types
    logger.log(`[contextUtils] Unknown window type: ${appType} for window ${windowId}`);
    return {
      appType: appType || 'unknown',
      windowId,
      isActive,
      stableId: `window-${windowId}`,
      title,
    };
  },

  // Validate that a window exists and is of the required type
  validateWindowForCommand: (
    windows: Record<string, AnyWindowEntity>,
    windowId: string,
    requiredType?: string,
  ): { valid: boolean; message: string } => {
    // Check if window exists
    if (!windows[windowId]) {
      return {
        valid: false,
        message: `Window with ID ${windowId} not found`,
      };
    }

    // If type is specified, validate it
    if (requiredType && windows[windowId].appType !== requiredType) {
      return {
        valid: false,
        message: `Window ${windowId} is not a ${requiredType} window (type: ${windows[windowId].appType})`,
      };
    }

    return {
      valid: true,
      message: 'Window validation successful',
    };
  },
};
