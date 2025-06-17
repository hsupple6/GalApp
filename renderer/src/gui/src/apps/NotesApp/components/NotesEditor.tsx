import './NotesEditor.scss';

import React, { useEffect, useImperativeHandle, forwardRef } from 'react';
import { useNotesAppStore } from '../store/notesAppStore';
import YProsemirrorEditorWS from './YProsemirrorEditorWS';
import TextDiffModal from './TextDiffModal';
import NotesToolbar from './NotesToolbar';

export interface NotesEditorRef {
  streamContent: (content: string) => void;
}

interface NotesEditorProps {
  noteId: string;
  onBack?: () => void;
  onClose?: () => void;
  windowId: string;
  spaceId: string;
}

const NotesEditor = forwardRef<NotesEditorRef, NotesEditorProps>(
  ({ noteId, onBack, onClose, windowId, spaceId }, ref) => {
    const { 
      initialize, 
      showDiffModal, 
      pendingTextInsert, 
      confirmTextInsert, 
      cancelTextInsert,
      editorViewInsertText, 
      editorViewGetCurrentText,
      editorView,
      noteContent
    } = useNotesAppStore(windowId, spaceId);

    useEffect(() => {
      initialize(noteId);
    }, [noteId, initialize]);

    // Expose the streamContent method to parent components
    useImperativeHandle(ref, () => ({
      streamContent: (content: string) => {
        console.log('Streaming content to note:', content);
        // Insert the content at the end of the current text
        editorViewInsertText(content, editorViewGetCurrentText().length);
      },
    }), [editorViewInsertText, editorViewGetCurrentText]);

    return (
      <div className="notes-editor">
        <NotesToolbar 
          editorView={editorView} 
          onBack={onBack}
          noteContent={noteContent}
        />
        
        <div className="notes-editor-content">
          <YProsemirrorEditorWS 
            noteId={noteId} 
            windowId={windowId} 
            spaceId={spaceId} 
          />
        </div>
        
        {/* Text Diff Modal */}
        {pendingTextInsert && (
          <TextDiffModal
            isOpen={showDiffModal}
            onClose={cancelTextInsert}
            onConfirm={confirmTextInsert}
            beforeText={pendingTextInsert.beforeText}
            afterText={pendingTextInsert.afterText}
          />
        )}
      </div>
    );
  }
);

NotesEditor.displayName = 'NotesEditor';

export default NotesEditor; 