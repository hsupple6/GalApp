import { debounce } from 'lodash';
import { useCallback, useEffect, useState } from 'react';
import { CRDTServiceWS, getCRDTServiceInstance } from 'services/crdt/crdtServiceWS';
import { WebrtcProvider } from 'y-webrtc';
import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';

import { notesService } from '../../../services/notesService';

// Get the CRDT service instance
const crdtService = getCRDTServiceInstance();

interface CRDTUpdate<T> {
  data: T;
  type: string;
  timestamp: number;
}

interface NoteUpdate {
  content: string;
}

export class NotesCRDTService {
  private yContentCache = new Map<string, Y.XmlFragment>();

  constructor(private crdt: CRDTServiceWS) {}

  private getDocKey(noteId: string): string {
    return `note:${noteId}`;
  }

  getYDocForNote(noteId: string, initialContent?: string): {doc: Y.Doc, provider?: WebsocketProvider} {
    const docKey = this.getDocKey(noteId);
    const doc = this.crdt.ensureInitialized(docKey);
    const provider = this.crdt.getProvider(docKey);
    // Get or create Y.XmlFragment
    if (!this.yContentCache.has(noteId)) {
      const yxml = doc.getXmlFragment('prosemirror');
      this.yContentCache.set(noteId, yxml);

      if (initialContent && yxml.length === 0) {
        // Parse HTML into DOM nodes
        const parser = new DOMParser();
        const dom = parser.parseFromString(initialContent, 'text/html');
        // Convert DOM nodes to ProseMirror nodes
        const paragraphs = Array.from(dom.body.children).map(child => {
          const element = new Y.XmlElement('paragraph');
          const text = new Y.XmlText(child.textContent || '');
          element.insert(0, [text]);
          return element;
        });
        yxml.insert(0, paragraphs);
      }
    }

    return {doc, provider};
  }

  getContent(noteId: string): Y.XmlFragment | null {
    return this.yContentCache.get(noteId) || null;
  }

  getProvider(noteId: string): WebsocketProvider | undefined {
    const docKey = this.getDocKey(noteId);
    return this.crdt.getProvider(docKey);
  }

  async observeNote(noteId: string, callback: (update: NoteUpdate) => void) {
    const { doc } = this.getYDocForNote(noteId);
    
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
      this.yContentCache.set(noteId, doc.getXmlFragment('prosemirror'));
      callback({ content: text.toString() });
    };

    doc.on('update', observer);
    // await this.crdt.connect(noteId, doc);

    return () => {
      doc.off('update', observer);
      this.crdt.disconnect(noteId);
    };
  }

  cleanup(noteId: string) {
    this.yContentCache.delete(noteId);
    this.crdt.disconnect(noteId);
  }

  updateNoteContent(noteId: string, content: string) {
    const { doc } = this.getYDocForNote(noteId);
    if (!doc) {
      console.error('[NotesCRDTService] No doc found for:', noteId);
      return;
    }

    // Let Prosemirror handle the Y.Text updates
    // Only save to backend
    this.debouncedSave(noteId, content);
  }

  private debouncedSave = debounce(async (noteId: string, content: string) => {
    try {
      await notesService.updateNoteContent(noteId, content);
    } catch (error) {
      console.error('[NotesCRDTService] Failed to save content:', error);
    }
  }, 1000);

  async disconnect() {
    this.crdt.cleanup();
  }
}

export const notesCRDTService = new NotesCRDTService(crdtService);
