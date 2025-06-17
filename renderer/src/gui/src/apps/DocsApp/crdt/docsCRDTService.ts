import { debounce } from 'lodash';
import { useCallback, useEffect, useState } from 'react';
import { CRDTServiceWS, crdtServiceWS } from 'services/crdt/crdtServiceWS';
import { WebrtcProvider } from 'y-webrtc';
import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';

import { entityService } from '../../../services/entityService';
import { logger } from '../../../utils/logger';

interface CRDTUpdate<T> {
  data: T;
  type: string;
  timestamp: number;
}

interface DocUpdate {
  content: string;
}

export class DocsCRDTService {
  private yContentCache = new Map<string, Y.XmlFragment>();
  private activeDocObservers = new Map<string, () => void>();

  constructor(private crdt: CRDTServiceWS) {}

  getYDocForDoc(docId: string, initialContent?: string, initialName?: string): {doc: Y.Doc, provider?: WebsocketProvider} {
    logger.log('[docsCRDT] getYDocForDoc called for:', docId);
    
    const docKey = this.getDocKey(docId);
    const doc = this.crdt.ensureInitialized(docKey);
    const provider = this.crdt.getProvider(docKey);
    
    // Initialize the name field if provided
    if (initialName && doc) {
      const nameText = doc.getText('name');
      // Only set if empty
      if (nameText.length === 0) {
        logger.log('[docsCRDT] Setting initial document name:', initialName);
        nameText.insert(0, initialName);
      }
    }
    
    // Get or create Y.XmlFragment
    let isNewCache = false;
    if (!this.yContentCache.has(docId)) {
      console.log('[DocsApp - CRDT] Creating new Y.XmlFragment for:', docId);
      isNewCache = true;
    } else {
      console.log('[DocsApp - CRDT] Using cached Y.XmlFragment for:', docId);
    }
    
    const yxml = doc.getXmlFragment('prosemirror');
    this.yContentCache.set(docId, yxml);

    console.log('[DocsApp - CRDT] Provider state:', { 
      wsconnected: provider?.wsconnected, 
      synced: provider?.synced,
      hasContent: yxml.length > 0,
      hasInitialContent: !!initialContent,
      isNewCache,
      currentYXMLContent: yxml.toString().substring(0, 100)
    });

    // Helper function to initialize content from database
    const initializeFromDB = () => {
      console.log('[DocsApp - CRDT] initializeFromDB called:', { 
        hasInitialContent: !!initialContent, 
        yxmlLength: yxml.length,
        contentPreview: initialContent?.substring(0, 100)
      });
      
      if (initialContent && yxml.length === 0) {
        console.log('[DocsApp - CRDT] Initializing content from DB');
        try {
          const paragraphs = this.convertHtmlToYXmlElements(initialContent);
          if (paragraphs.length > 0) {
            console.log('[DocsApp - CRDT] Inserting', paragraphs.length, 'paragraphs into Y.js document');
            yxml.insert(0, paragraphs);
            console.log('[DocsApp - CRDT] Initial content set from DB, new length:', yxml.length);
          } else {
            // If no paragraphs were created, create a default empty paragraph
            console.log('[DocsApp - CRDT] No content to convert, creating empty paragraph');
            const emptyParagraph = new Y.XmlElement('paragraph');
            yxml.insert(0, [emptyParagraph]);
          }
        } catch (error) {
          console.error('[DocsApp - CRDT] Error converting initial content:', error);
          // Create a default empty paragraph on error
          const emptyParagraph = new Y.XmlElement('paragraph');
          yxml.insert(0, [emptyParagraph]);
        }
      } else if (!initialContent) {
        console.log('[DocsApp - CRDT] No initial content provided');
      } else if (yxml.length > 0) {
        console.log('[DocsApp - CRDT] Y.js document already has content, length:', yxml.length);
      }
    };

    // Always try to initialize if we have content but Y.js doc is empty
    // This handles both new and cached documents
    if (initialContent && yxml.length === 0) {
      console.log('[DocsApp - CRDT] Document is empty but we have initial content - initializing immediately');
      initializeFromDB();
    }

    // Set up provider-based initialization for cases where sync matters
    if (provider?.synced) {
      console.log('[DocsApp - CRDT] Provider already synced');
      if (initialContent && yxml.length === 0) {
        console.log('[DocsApp - CRDT] Provider synced but content still empty, initializing');
        initializeFromDB();
      }
    } else {
      console.log('[DocsApp - CRDT] Provider not synced, setting up sync listener');
      // If not synced yet, wait for sync event
      provider?.once('sync', () => {
        console.log('[DocsApp - CRDT] Provider synced event received');
        initializeFromDB();
      });
      
      // Also set up a fallback timeout
      setTimeout(() => {
        if (initialContent && yxml.length === 0) {
          console.log('[DocsApp - CRDT] Fallback initialization triggered after 500ms');
          initializeFromDB();
        }
      }, 500); // Longer timeout to be sure
    }

    // Set up an observer for Y.js document changes to auto-persist (only once)
    if (isNewCache) {
      this.setupDocObserver(docId, doc);
    }

    return {doc, provider};
  }

  // Setup an observer for document changes to automatically persist to DB
  private setupDocObserver(docId: string, doc: Y.Doc) {
    // Clean up any existing observer
    const existingCleanup = this.activeDocObservers.get(docId);
    if (existingCleanup) {
      existingCleanup();
      this.activeDocObservers.delete(docId);
    }

    // Create a new observer
    const observer = (update: Uint8Array, origin: any) => {
      logger.log(`[docsCRDT] Document ${docId} changed, auto-persisting to DB`);
      const yxml = doc.getXmlFragment('prosemirror');
      const content = yxml.toString();
      
      // Save to DB
      this.debouncedSave(docId, content);
    };

    // Add the observer to the document
    doc.on('update', observer);
    
    // Store the cleanup function
    this.activeDocObservers.set(docId, () => {
      doc.off('update', observer);
    });
  }

  getContent(docId: string): Y.XmlFragment | null {
    return this.yContentCache.get(docId) || null;
  }

  getProvider(docId: string): WebsocketProvider | undefined {
    const docKey = this.getDocKey(docId);
    return this.crdt.getProvider(docKey);
  }

  async observeDoc(docId: string, callback: (update: DocUpdate) => void) {
    const { doc } = this.getYDocForDoc(docId);
    
    // Wait for Prosemirror to create the Y.Text type
    const waitForContent = () => {
      return new Promise<Y.Text>((resolve) => {
        if (doc.share.has('content')) {
          resolve(doc.getText('content'));
        } else {
          const observer = () => {
            if (doc.share.has('content')) {
              doc.off('afterTransaction', observer);
              resolve(doc.getText('content'));
            }
          };
          doc.on('afterTransaction', observer);
        }
      });
    };

    const text = await waitForContent();
    const observer = () => {
      this.yContentCache.set(docId, doc.getXmlFragment('prosemirror'));
      callback({ content: text.toString() });
    };

    doc.on('update', observer);
    // await this.crdt.connect(docId, doc);

    return () => {
      doc.off('update', observer);
      this.crdt.disconnect(docId);
    };
  }

  cleanup(docId: string) {
    // Remove document observer if exists
    const cleanup = this.activeDocObservers.get(docId);
    if (cleanup) {
      cleanup();
      this.activeDocObservers.delete(docId);
    }
    
    this.yContentCache.delete(docId);
    this.crdt.disconnect(docId);
  }

  // Force an immediate save - use this when you need to ensure content is saved right away
  async forceSave(docId: string, content: string): Promise<void> {
    try {
      logger.log(`[docsCRDT] Forcing immediate save to DB for doc ${docId}`);
      await entityService.update(docId, {
        skeleton: {
          '@type': 'Doc',
          content
        }
      });
      logger.log(`[docsCRDT] Successfully saved content to DB for doc ${docId}`);
    } catch (error) {
      logger.error(`[docsCRDT] Failed to save content to DB for doc ${docId}:`, error);
      throw error;
    }
  }

  updateDocContent(docId: string, content: string) {
    const doc = this.getYDocForDoc(docId);
    if (!doc) {
      logger.error('[DocsCRDTService] No doc found for:', docId);
      return;
    }

    // Let Prosemirror handle the Y.Text updates
    // Only save to backend
    this.debouncedSave(docId, content);
  }

  saveToDB(docId: string, content: string) {
    logger.log(`[docsCRDT] saveToDB called for doc ${docId} (${content.length} chars)`);
    this.debouncedSave(docId, content);
  }

  async disconnect() {
    // Clear all document observers
    for (const [docId, cleanup] of this.activeDocObservers.entries()) {
      cleanup();
    }
    this.activeDocObservers.clear();
    
    this.crdt.cleanup();
  }

  private debouncedSave = debounce(async (docId: string, content: string) => {
    try {
      logger.log(`[docsCRDT] Saving content to DB for doc ${docId} (${content.length} chars)`);
      await entityService.update(docId, {
        skeleton: {
          '@type': 'Doc',
          content
        }
      });
      logger.log(`[docsCRDT] Successfully saved content to DB for doc ${docId}`);
    } catch (error) {
      logger.error(`[docsCRDT] Failed to save content to DB for doc ${docId}:`, error);
    }
  }, 1000); // Increase debounce time to 1000ms for fewer DB writes

  private getDocKey(docId: string): string {
    return `doc:${docId}`;
  }

  private convertHtmlToYXmlElements(html: string): Y.XmlElement[] {
    if (!html || html.trim() === '') {
      console.log('[DocsApp - CRDT] Empty HTML content, creating default paragraph');
      const emptyParagraph = new Y.XmlElement('paragraph');
      return [emptyParagraph];
    }

    console.log('[DocsApp - CRDT] Converting HTML to Y.js format using ProseMirror parser:', html.substring(0, 200));
    
    // Import ProseMirror modules for proper parsing
    // We'll use a simpler approach that works with Y.js expectations
    try {
      // Create a temporary DOM element to parse the HTML
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      if (!doc.body || doc.body.children.length === 0) {
        console.log('[DocsApp - CRDT] No parseable content, creating default paragraph with text');
        const paragraph = new Y.XmlElement('paragraph');
        const textContent = doc.body?.textContent?.trim() || '';
        if (textContent) {
          paragraph.insert(0, [new Y.XmlText(textContent)]);
        }
        return [paragraph];
      }

      // Convert each top-level element (should be paragraphs)
      const elements: Y.XmlElement[] = [];
      
      Array.from(doc.body.children).forEach((child, index) => {
        
        if (child.tagName.toLowerCase() === 'paragraph' || child.tagName.toLowerCase() === 'p') {
          const paragraph = new Y.XmlElement('paragraph');
          
          // Handle the content inside the paragraph
          if (child.innerHTML.trim() === '') {
            // Empty paragraph
            console.log('[DocsApp - CRDT] Creating empty paragraph');
          } else {
            // Parse the inner content as rich text
            const textContent = this.parseInlineContent(child);
            if (textContent.length > 0) {
              paragraph.insert(0, textContent);
            }
          }
          
          elements.push(paragraph);
        } else {
          // Convert other elements to paragraphs (fallback)
          console.log('[DocsApp - CRDT] Converting', child.tagName, 'to paragraph');
          const paragraph = new Y.XmlElement('paragraph');
          const textContent = child.textContent || '';
          if (textContent.trim()) {
            paragraph.insert(0, [new Y.XmlText(textContent)]);
          }
          elements.push(paragraph);
        }
      });

      if (elements.length === 0) {
        console.log('[DocsApp - CRDT] No elements created, returning default paragraph');
        const emptyParagraph = new Y.XmlElement('paragraph');
        return [emptyParagraph];
      }

      console.log('[DocsApp - CRDT] Successfully converted HTML to', elements.length, 'paragraph elements');
      return elements;
      
    } catch (error) {
      console.error('[DocsApp - CRDT] Error converting HTML content:', error);
      const emptyParagraph = new Y.XmlElement('paragraph');
      return [emptyParagraph];
    }
  }

  // Helper method to parse inline content with proper mark handling
  private parseInlineContent(element: Element): (Y.XmlText | Y.XmlElement)[] {
    const result: (Y.XmlText | Y.XmlElement)[] = [];
    
    // For now, let's create a simple text representation
    // This avoids the complex nested structure that was causing issues
    const textContent = element.textContent || '';
    
    if (textContent.trim()) {
      result.push(new Y.XmlText(textContent));
    }
    
    return result;
  }
}

export const docsCRDTService = new DocsCRDTService(crdtServiceWS); 