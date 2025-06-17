import { useMemo } from 'react';
import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';
import { create } from 'zustand';
import { StoreApi, UseBoundStore, useStore } from 'zustand';

import { notesService } from '../../../services/notesService';
import { NoteError, UINote } from '../../../types/notes';
import { notesCRDTService } from '../crdt/notesCRDTService';
import { ObjectId } from 'bson';
import { EditorView } from 'prosemirror-view';
import { registerCommands } from '../../../stores/commandRegistryStore';
import { commands } from './commands';
import { logger } from '../../../utils/logger';

// Define the state interface
export interface NotesAppState {
  windowId: string;
  spaceId: string;
  status: 'idle' | 'loading' | 'error';
  error: NoteError | null;
  noteContent: string;
  initialized: boolean;
  cleanup?: () => void;
  noteId: string | null;
  recentNotes: UINote[];
  ydoc: Y.Doc | null;
  provider?: WebsocketProvider;
  editorView: EditorView | null;
  storeId: number;
  // Diff modal state
  showDiffModal: boolean;
  pendingTextInsert: {
    text: string;
    position: number;
    beforeText: string;
    afterText: string;
  } | null;
}

// Define the store interface
export interface NotesAppStore extends NotesAppState {
  createNoteId: () => string;
  initialize: (noteId: string) => Promise<void>;
  cleanup: () => void;
  fetchRecentNotes: () => Promise<void>;
  createNote: () => Promise<UINote>;
  setState: (state: Partial<NotesAppState>) => void;
  setNoteId: (noteId: string | null) => void;
  setEditorView: (editorView: EditorView | null) => void;
  editorViewGetCurrentText: () => string;
  editorViewInsertText: (text: string, position: number) => void;
  editorViewRemoveText: (from: number, to: number) => void;
  // Diff modal actions
  showTextDiffModal: (text: string, position: number, diffCallback: (text: string) => void) => string;
  confirmTextInsert: () => string;
  cancelTextInsert: () => string;
}

// Define the store hook type
export type NotesAppStoreHook = UseBoundStore<StoreApi<NotesAppStore>>;

// First, update the store type to include the subscription
interface NotesStore extends NotesAppStore {
  subscribe: (subscriber: (state: NotesAppState) => void) => () => boolean;
}

// Create the store with proper typing
export const createNotesAppStore = (windowId: string, spaceId: string) => {
  // Create a set of subscribers
  const subscribers = new Set<(state: NotesAppState) => void>();

  // Create the base store
  return create<NotesStore>((set, get) => ({
    // Initial state
    windowId,
    spaceId,
    status: 'idle',
    noteContent: '',
    initialized: false,
    recentNotes: [],
    noteId: null,
    error: null,
    ydoc: null,
    editorView: null,
    storeId: Date.now(),
    showDiffModal: false,
    pendingTextInsert: null,

    createNoteId: () => new ObjectId().toString(),
    // Set state function
    setState: (newState: Partial<NotesAppState>) => {
      set((state) => ({
        ...state,
        ...newState
      }));
    },
    setNoteId: (noteId: string | null) => {
      set({ noteId });
    },
    setEditorView: (editorView: EditorView | null) => {
      set({ editorView });
    },

    editorViewGetCurrentText: () => {
      const { editorView } = get();
      if (editorView) {
        logger.log('[NotesAppStore] Getting current text:', { text: editorView.state.doc.textContent });
        return editorView.state.doc.textContent;
      } else {
        logger.error('[NotesAppStore] No editor view found');
      }
      return '';
    },

    editorViewInsertText: (text: string, position: number) => {
      const { editorView, ydoc, noteId } = get();
      if (editorView && ydoc) {
        try {

          logger.log('[NotesAppStore] Inserting text:', { text: text.substring(0, 50), position });
            
          // Update Y.js document using XmlFragment
          const yxml = ydoc.getXmlFragment('prosemirror');

          // Get document length
          const docLength = yxml.length;
          // Cap the position to the document length
          const safePosition = Math.min(position, docLength);
          // Create a transaction to update the XML fragment
          ydoc.transact(() => {
            // If this is the first chunk (position 0), clear existing content
            if (safePosition === 0) {
              while (yxml.length > 0) {
                yxml.delete(0, 1);
              }
              // Create initial paragraph
              const paragraph = new Y.XmlElement('paragraph');
              yxml.insert(0, [paragraph]);
            }

            const lines = text.split('\n');
            let currentPosition = safePosition;
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i];
              const newParagraph = new Y.XmlElement('paragraph');
              newParagraph.insert(0, [new Y.XmlText(line)]);
              yxml.insert(currentPosition, [newParagraph]);
              currentPosition += line.length;
              currentPosition -= 1;
              currentPosition = Math.min(currentPosition, yxml.length);
            }
            
            // Get the first (and only) paragraph
            // const paragraph = yxml.get(0);
            // if (!(paragraph instanceof Y.XmlElement)) {
            //   logger.error('[NotesAppStore] Expected paragraph element not found');
            //   return;
            // }
          });
          
          // Update note content in store
          const newContent = editorView.state.doc.textContent;
          set({ noteContent: newContent });
  
          // Persist to backend
          if (noteId) {
            notesService.updateNoteContent(noteId, newContent).catch(error => {
              logger.error('[NotesAppStore] Failed to persist note content:', error);
            });
          }
        } catch (error) {
          logger.error('[NotesAppStore] Error inserting text:', error);
        }
      } else {
        logger.error('[NotesAppStore] No editor view or ydoc found');
      }
    },

    editorViewRemoveText: (from: number, to: number) => {
      const { editorView } = get();
      if (editorView) {
        logger.log('[NotesAppStore] Removing text:', { from, to });
        const transaction = editorView.state.tr.delete(from, to);
        editorView.dispatch(transaction);
      } else {
        logger.error('[NotesAppStore] No editor view found');
      }
    },

    // Initialize function
    initialize: async (noteId: string) => {
      logger.log('[NotesAppStore] Starting initialization for note:', { noteId, windowId });
      
      const state = get();
      
      if (state.initialized && state.noteId === noteId && state.ydoc) {
        logger.log('[NotesAppStore] Already fully initialized, skipping');
        return;
      }
      
      if (state.status === 'loading' && state.noteId === noteId) {
        logger.log('[NotesAppStore] Already loading, waiting...');
        // Wait for loading to complete
        await new Promise<void>(resolve => {
          const onStateChange = (newState: NotesAppState) => {
            if (newState.status !== 'loading') {
              subscribers.delete(onStateChange);
              resolve();
            }
          };
          subscribers.add(onStateChange);
        });
        return;
      }

      try {
        const newState = { status: 'loading' as const, noteId };
        set(newState);
        // Notify subscribers
        subscribers.forEach(subscriber => subscriber({ ...get(), ...newState }));

        const initialNote = await notesService.fetchNote(noteId);
        logger.log('[NotesAppStore] Initial content:', initialNote);

        const {doc: ydoc, provider} = notesCRDTService.getYDocForNote(noteId, initialNote.content);

        const observer = (update: Uint8Array) => {
          // logger.log('[NotesAppStore] Update received:', update);
          const yxml = ydoc.getXmlFragment('prosemirror');
          // logger.log('[NotesAppStore] YXML:', yxml, yxml.toString());
          set({ noteContent: yxml.toString() });
        };

        ydoc.on('update', observer);

        const cleanup = () => {
          ydoc.off('update', observer);
        };

        const yxml = ydoc.getXmlFragment('prosemirror');

        const finalState = {
          windowId,
          spaceId,
          status: 'idle' as const,
          noteId,
          noteContent: yxml.toString(),
          initialized: true,
          ydoc,
          provider,
          error: null,
          cleanup
        };
        
        set(state => ({ ...state, ...finalState }));
        // Notify subscribers
        subscribers.forEach(subscriber => subscriber({ ...get(), ...finalState }));

        logger.log('[NotesAppStore] Initialization complete:', { 
          // content: note.content?.substring(0, 100),
          hasYDoc: !!ydoc
        });
      } catch (error) {
        const errorState = { status: 'error' as const, error: error as NoteError };
        set(errorState);
        // Notify subscribers
        subscribers.forEach(subscriber => subscriber({ ...get(), ...errorState }));
        throw error;
      }
    },

    // Cleanup function
    cleanup: () => {
      const { noteId, ydoc } = get();
      if (noteId && ydoc) {
        logger.log('[NotesAppStore] Cleaning up note:', noteId);
        
        // Remove direct Y.Text access - let notesCRDTService handle cleanup
        notesCRDTService.cleanup(noteId);
        
        // Reset store state
        set({ 
          status: 'idle',
          noteId: null,
          noteContent: '',
          ydoc: null,
          initialized: false,
          error: null
        });
      }
    },

    // Fetch recent notes function
    fetchRecentNotes: async () => {
      // Add a check to prevent duplicate fetches
      const { status } = get();
      if (status === 'loading') {
        logger.log('[NotesAppStore] Already fetching notes, skipping');
        return;
      }

      logger.log('[NotesAppStore] Fetching recent notes');
      try {
        set({ status: 'loading' });
        const notes = await notesService.fetchRecentNotes();
        set({ 
          recentNotes: notes,
          status: 'idle'
        });
      } catch (error) {
        logger.error('[NotesAppStore] Error fetching notes:', error);
        set({ 
          status: 'error',
          error: error as NoteError 
        });
      }
    },

    // Create note function
    createNote: async () => {
      logger.log('[NotesAppStore] Creating new note');
      try {
        const note = await notesService.createNote();
        set(state => ({
          recentNotes: [note, ...state.recentNotes]
        }));
        return note;
      } catch (error) {
        logger.error('[NotesAppStore] Error creating note:', error);
        set({ 
          status: 'error',
          error: error as NoteError 
        });
        throw error;
      }
    },

    // Add subscribe method directly in the store
    subscribe: (subscriber: (state: NotesAppState) => void) => {
      subscribers.add(subscriber);
      return () => subscribers.delete(subscriber);
    },

    // Diff modal actions
    showTextDiffModal: (text: string, position: number, diffCallback: (text: string) => void) => {
      const { editorView } = get();
      logger.log('[NotesAppStore] Showing text diff modal:', { text, position });
      if (editorView) {
        // Get current text
        const beforeText = editorView.state.doc.textContent;
        
        // Calculate what the text would look like after insertion
        const afterText = beforeText.slice(0, position) + text + beforeText.slice(position);
        
        set({ 
          showDiffModal: true, 
          pendingTextInsert: { 
            text, 
            position, 
            beforeText, 
            afterText 
          },
        });

        diffCallback(text);

        return text;
      } else {
        logger.error('[NotesAppStore] No editor view found');
        return '';
      }
    },
    confirmTextInsert: () => {
      const { pendingTextInsert } = get();
      if (pendingTextInsert) {
        const { text, position } = pendingTextInsert;
        // Call the actual implementation
        const store = get();
        if (store.editorViewInsertText) {
          store.editorViewInsertText(text, position);
        }
        set({ showDiffModal: false, pendingTextInsert: null });
        return text;
      }
      return '';
    },
    cancelTextInsert: () => {
      const store = get();
      set({ showDiffModal: false, pendingTextInsert: null });
      return '';
    }
  }));
};

// Update the store registry type
const notesStores = new Map<string, ReturnType<typeof createNotesAppStore>>();

// Update the hook creation
export const getNotesAppStore = (windowId: string, spaceId: string) => {
  const key = `${windowId}-${spaceId}`;
  
  // Register notes commands once if this is the first store being created
  if (notesStores.size === 0) {
    registerCommands(commands);
    logger.log('[NotesAppStore] Registered notes commands');
  }
  
  if (!notesStores.has(key)) {
    const store = createNotesAppStore(windowId, spaceId);
    notesStores.set(key, store);
  }
  return notesStores.get(key)!;
};

// Create a proper hook that returns the store state and actions
export const useNotesAppStore = (windowId: string, spaceId: string) => {
  const store = useMemo(() => getNotesAppStore(windowId, spaceId), [windowId, spaceId]);
  return useStore(store);
};

// Add back cleanup functionality
export const cleanupNotesStore = (windowId: string, spaceId: string) => {
  const key = `${windowId}-${spaceId}`;
  const store = notesStores.get(key);
  if (store) {
    const state = store.getState();
    state.cleanup();
    notesStores.delete(key);
    logger.log('[NotesAppStore] Cleaned up store for:', key);
  }
};
