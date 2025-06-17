import { debounce } from 'lodash';
import { baseKeymap } from 'prosemirror-commands';
import { history, redo, undo } from 'prosemirror-history';
import { keymap } from 'prosemirror-keymap';
import { DOMParser as ProseMirrorDOMParser, DOMSerializer } from 'prosemirror-model';
import { schema } from 'prosemirror-schema-basic';
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import React, { useCallback,useEffect, useRef } from 'react';
import { crdtService } from 'services/crdt/crdtService';
import { yCursorPlugin, ySyncPlugin, yUndoPlugin } from 'y-prosemirror';
import * as Y from 'yjs';

import { notesCRDTService } from '../crdt/notesCRDTService';
import { useNotesAppStore } from '../store/notesAppStore';

interface YProsemirrorEditorProps {
  noteId: string;
  onUpdate: (content: string) => void;
  className?: string;
}

export const YProsemirrorEditor: React.FC<YProsemirrorEditorProps> = ({
  noteId,
  onUpdate,
  className,
}) => {
  const { ydoc, noteContent } = useNotesAppStore('window-1', 'space-1');
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  // Debounce the update callback
  const debouncedUpdate = useCallback(
    debounce((content: string) => {
      onUpdate(content);
    }, 1000),
    [onUpdate]
  );

  useEffect(() => {
    console.log('[YProsemirrorEditor] useEffect - ZOUNDS!');
    if (!ydoc || !editorRef.current) return;

    const yXmlFragment = notesCRDTService.getContent(noteId);
    if (!yXmlFragment) {
      console.error('[YProsemirrorEditor] No content found for note:', noteId);
      return;
    }

    const provider = notesCRDTService.getProvider(noteId);
    if (!provider) {
      console.error('[YProsemirrorEditor] No provider found for note:', noteId);
      return;
    }

    // Create initial doc content
    let doc = schema.node('doc', null, [
      schema.node('paragraph', null, [])
    ]);
    
    if (noteContent) {
      // Parse HTML into ProseMirror doc
      const domNode = document.createElement('div');
      // Check if content is JSON and convert back to HTML if needed
      try {
        const parsed = JSON.parse(noteContent);
        // If it parsed as JSON, it's probably a ProseMirror doc
        doc = schema.nodeFromJSON(parsed);
      } catch (e) {
        // If not JSON, treat as HTML
        domNode.innerHTML = noteContent;
        doc = ProseMirrorDOMParser.fromSchema(schema).parse(domNode);
      }
    }

    // Create ProseMirror state
    const state = EditorState.create({
      doc,
      schema,
      plugins: [
        ySyncPlugin(yXmlFragment),
        yCursorPlugin(provider.awareness),
        yUndoPlugin(),
        history(),
        keymap({
          'Mod-z': undo,
          'Mod-y': redo,
          ...baseKeymap
        })
      ]
    });

    const view = new EditorView(editorRef.current, {
      state,
      dispatchTransaction: (tr) => {
        if (!viewRef.current) return;
        
        const newState = viewRef.current.state.apply(tr);
        viewRef.current.updateState(newState);

        if (tr.docChanged && !tr.getMeta('remote')) {
          // Convert to HTML before saving
          const fragment = DOMSerializer.fromSchema(schema).serializeFragment(newState.doc.content);
          const div = document.createElement('div');
          div.appendChild(fragment);
          debouncedUpdate(div.innerHTML);
        }
      }
    });

    viewRef.current = view;

    return () => {
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }
      debouncedUpdate.cancel();
    };
  }, [ydoc, noteId, noteContent, debouncedUpdate]);

  return <div ref={editorRef} className={className} id="zounds-editor-container" />;
};

export default YProsemirrorEditor;
