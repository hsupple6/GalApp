import './Notes.scss';

import { useNotesAppStore } from '../store/notesAppStore';
import { useSpaceStore } from '../../../stores/spaceStore';
import React, { useCallback, useEffect, useState, forwardRef } from 'react';

import NotesEditor, { NotesEditorRef } from './NotesEditor';
import NotesOverview from './NotesOverview';

export interface NotesAppProps {
  noteId?: string;
  onClose?: () => void;
  windowId: string;
  spaceId: string;
}

const NotesApp = forwardRef<NotesEditorRef, NotesAppProps>(({ noteId, windowId, spaceId, onClose }, ref) => {
  const { 
    initialize, 
    createNote, 
    recentNotes, 
    fetchRecentNotes, 
    setNoteId, 
    noteId: activeNoteId,
    editorViewGetCurrentText,
    storeId,
  } = useNotesAppStore(windowId, spaceId);
  
  const { updateWindow } = useSpaceStore();

  const resetSelectedNoteId = useCallback(() => {
    setNoteId(null);
  }, [setNoteId]);

  const handleNoteIdChange = useCallback((id: string) => {
    initialize(id);
    setNoteId(id);
  }, [initialize, setNoteId]);

  const handleCreateNew = useCallback(async () => {
    try {
      const note = await createNote();
      handleNoteIdChange(note.id);
    } catch (error) {
      console.error('[NotesApp] Failed to create new note:', error);
    }
  }, [createNote, handleNoteIdChange]);

  useEffect(() => {
    if (!activeNoteId) {
      fetchRecentNotes();
    }
  }, [activeNoteId, fetchRecentNotes]);

  // Sync state back to window entity
  useEffect(() => {
    if (windowId && activeNoteId) {
      const currentContent = editorViewGetCurrentText();
      
      updateWindow(windowId, {
        applicationState: {
          notes: {
            activeNoteId,
            content: currentContent
          }
        }
      });
    }
  }, [windowId, activeNoteId, editorViewGetCurrentText, updateWindow]);

  return (
    <div className="notes-app-namespace">
      {activeNoteId ? (
        <NotesEditor
          ref={ref}
          noteId={activeNoteId}
          windowId={windowId}
          spaceId={spaceId}
          onBack={resetSelectedNoteId}
          onClose={onClose}
        />
      ) : ( 
        <NotesOverview
          show={!activeNoteId}
          recentNotes={recentNotes}
          onCreateNew={handleCreateNew}
          onSelectNote={handleNoteIdChange}
        />
      )}
    </div>
  );
});

NotesApp.displayName = 'NotesApp';

export default NotesApp;