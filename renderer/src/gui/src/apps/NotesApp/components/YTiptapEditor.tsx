import { Editor } from '@tiptap/core';
import Collaboration from '@tiptap/extension-collaboration';
import { EditorContent, useEditor } from '@tiptap/react';
import React from 'react';
import * as Y from 'yjs';

import { createBaseExtensions } from '../editor/extensions';
import { useNotesAppStore } from '../store/notesAppStore';

interface YTiptapEditorProps {
  noteId: string;
  onUpdate: (content: string) => void;
  className?: string;
}

export const YTiptapEditor: React.FC<YTiptapEditorProps> = ({ 
  noteId, 
  onUpdate,
  className,
}) => {
  const { ydoc, noteContent } = useNotesAppStore('window-1', 'space-1');

  const editor = useEditor({
    extensions: [
      ...createBaseExtensions(),
      ...(ydoc ? [
        Collaboration.configure({
          document: ydoc,
          field: 'content'
        })
      ] : [])
    ],
    content: noteContent,  // Set initial content through editor config
    editable: true,
    autofocus: false,
    onUpdate: ({ editor }) => {
      onUpdate(editor.getHTML());
    },
  }, [ydoc]);

  if (!editor || !ydoc) return <div>Loading editor...</div>;

  return (
    <div className={`notes-editor-content ${className || ''}`}>
      <EditorContent editor={editor} />
    </div>
  );
};

export default YTiptapEditor;
