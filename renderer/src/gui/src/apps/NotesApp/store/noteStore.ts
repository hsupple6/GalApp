import { Doc } from 'yjs';
import { create } from 'zustand';

import { notesService } from '../../../services/notesService';
import { NoteError, UINote } from '../../../types/notes';
import { notesCRDTService } from '../crdt/notesCRDTService';

// Export these types
export interface NoteState {
  status: 'idle' | 'loading' | 'error';
  error?: NoteError;
  recentNotes: UINote[];
  activeNote: UINote | null;
  activeNoteDoc?: Doc;
}

export interface NoteStore extends NoteState {
  fetchRecentNotes: () => Promise<void>;
  setActiveNote: (id: string) => Promise<void>;
  updateNoteContent: (content: string) => void;
  clearError: () => void;
  cleanup: () => void;
  createNote: () => Promise<UINote>;
  activeCleanup?: () => void;
  windowId: string;
}

const useNoteStore = create<NoteStore>((set, get) => ({
  status: 'idle',
  recentNotes: [],
  activeNote: null,
  activeCleanup: undefined,
  windowId: `note-window-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,

  fetchRecentNotes: async () => {
    console.debug('[NoteStore] Fetching recent notes');
    set({ status: 'loading' });
    try {
      const notes = await notesService.fetchRecentNotes();
      console.debug('[NoteStore] Fetched notes:', notes);
      set({ recentNotes: notes, status: 'idle' });
    } catch (error) {
      console.error('[NoteStore] Error fetching notes:', error);
      set({
        status: 'error',
        error: error instanceof NoteError ? error : new NoteError('Unknown error', 'NETWORK_ERROR'),
      });
    }
  },

  setActiveNote: async (id: string) => {
    try {
      // Get note data
      // const note = await notesService.fetchNote(id);
      
      // Get doc from CRDT service - this should be the only place doing this
      const doc = notesCRDTService.getYDocForNote(id);
      
      // Set up observation
      const cleanup = await notesCRDTService.observeNote(id, (update) => {
        set(state => ({
          activeNote: state.activeNote ? {
            ...state.activeNote,
            content: update.content
          } : null
        }));
      });

      set(state => ({
        // activeNote: note,
        // recentNotes: [note, ...state.recentNotes.filter(n => n.id !== note.id)],
        activeNoteDo: doc,
        status: 'idle',
        activeCleanup: () => cleanup()
      }));

    } catch (error) {
      console.error('[NoteStore] Error setting active note:', error);
      set({ status: 'error', error: error as NoteError });
    }
  },

  updateNoteContent: (content) => {
    const { activeNote } = get();
    if (!activeNote) return;

    // Optimistic update
    set({ activeNote: { ...activeNote, content } });
    notesCRDTService.updateNoteContent(activeNote.id, content);
  },

  clearError: () => set({ status: 'idle', error: undefined }),

  cleanup: () => {
    console.debug('[NoteStore] Cleaning up note store');
    const { activeCleanup } = get();
    if (activeCleanup) {
      activeCleanup();
      set({ activeCleanup: undefined, activeNote: null });
    }
  },

  createNote: async () => {
    set({ status: 'loading' });
    try {
      const note = await notesService.createNote();
      console.debug('[NoteStore] Created new note:', note.id, 'for window:', get().windowId);

      // Clean up previous note if exists
      const { activeCleanup } = get();
      if (activeCleanup) {
        console.debug('[NoteStore] Cleaning up previous note for window:', get().windowId);
        activeCleanup();
      }

      // Set up CRDT observation for new note
      console.debug('[NoteStore] Setting up CRDT observation for new note:', note.id);
      const cleanup = await notesCRDTService.observeNote(note.id, (update) => {
        console.debug('[NoteStore] Received CRDT update for window:', get().windowId);
        const currentNote = get().activeNote;
        if (currentNote && currentNote.id === note.id) {
          set({ activeNote: { ...currentNote, content: update.content } });
        }
      });

      set((state) => ({
        recentNotes: [note, ...state.recentNotes],
        status: 'idle',
        activeNote: note,
        activeCleanup: () => cleanup(),
      }));

      return note;
    } catch (error) {
      console.error('[NoteStore] Error creating note:', error);
      set({
        status: 'error',
        error: error instanceof NoteError ? error : new NoteError('Unknown error', 'NETWORK_ERROR'),
      });
      throw error;
    }
  },
}));

export default useNoteStore;
