// External imports
import { debounce } from "lodash";
import './YProsemirrorEditor.scss';
// ProseMirror imports
import { baseKeymap } from "prosemirror-commands";
import { history, redo, undo } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import { schema } from 'prosemirror-schema-basic';
import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
// y-prosemirror imports
import { initProseMirrorDoc, yUndoPlugin } from "y-prosemirror";
import { yCursorPlugin, ySyncPlugin } from "y-prosemirror";
// y-websocket import
import * as Y from 'yjs';

import { useNotesAppStore } from "../store/notesAppStore";
import { notesCRDTService } from '../crdt/notesCRDTService';

interface EditorContainerProps {
  noteId: string;
  windowId: string;
  spaceId: string;
}

const EditorContainer: React.FC<EditorContainerProps> = ({ noteId, windowId, spaceId }) => {
  const { ydoc, provider, setEditorView } = useNotesAppStore(windowId, spaceId);
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const yXmlFragment = useRef<Y.XmlFragment>();
  const docRef = useRef<any>();
  const mappingRef = useRef<any>();

  // Track changes and sync with CRDT service
  const handleChange = useCallback(() => {
    if (!viewRef.current) return;
    const content = viewRef.current.dom.innerHTML;
    notesCRDTService.updateNoteContent(noteId, content);
  }, [noteId]);

  useEffect(() => {
    if (!ydoc || !provider) return;

    yXmlFragment.current = ydoc.getXmlFragment('prosemirror');
    const { doc, meta } = initProseMirrorDoc(yXmlFragment.current, schema);
    docRef.current = doc;
    mappingRef.current = meta;
  }, [noteId, ydoc, provider]);

  useEffect(() => {
    if (!docRef.current ||
        !editorRef.current ||
        !yXmlFragment.current ||
        !mappingRef.current ||
        !provider
      ) return;

    const state = EditorState.create({
      doc: docRef.current,
      schema,
      plugins: [
        ySyncPlugin(yXmlFragment.current, { mapping: mappingRef.current }),
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
      dispatchTransaction(transaction) {
        const newState = view.state.apply(transaction);
        view.updateState(newState);
        
        // Only sync if the document actually changed
        if (transaction.docChanged) {
          handleChange();
        }
      }
    });
    
    setEditorView(view);
    viewRef.current = view;

    // Ensure the editor is scrolled to the top when first loaded
    if (editorRef.current) {
      // Reset scroll position
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.scrollTop = 0;
        }
      }, 0);
    }

    return () => {
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
        setEditorView(null);
      }
    };
  }, [noteId, provider, setEditorView, handleChange]);
  
  return (
    <>
      <div className="prose-mirror-editor notes-prosemirror" ref={editorRef} />
    </>
  );
};

export default EditorContainer;
