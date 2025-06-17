// TODO: Remove all note related code
// 
import { useMemo } from 'react';
import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';
import { create } from 'zustand';
import { StoreApi, UseBoundStore, useStore } from 'zustand';
import { EditorView } from 'prosemirror-view';
import { Transaction } from 'prosemirror-state';
import { Node, Fragment } from 'prosemirror-model';

import { entityService } from '../../../services/entityService';
// import { DocEntity } from '../../../types';
import { docsCRDTService } from '../crdt/docsCRDTService';
import { ObjectId } from 'bson';
import { DocEntity } from 'types/docs';
import { commands } from './commands';
import { registerCommands } from 'stores/commandRegistryStore';
import { logger } from '../../../utils/logger';

interface YxmlNode {
  content: string;
  type: string;
  pos: number;
  size: number;
  isDeletion: boolean;
  isInsertion: boolean;
}

// Define the state interface
export interface DocsAppState {
  windowId: string;
  spaceId: string;
  status: 'idle' | 'loading' | 'error';
  error: Error | null;
  docContent: string;
  initialized: boolean;
  isInitializing: boolean;
  isInitialized: boolean;
  cleanup?: () => void;
  docId: string | null;
  recentDocs: DocEntity[];
  ydoc: Y.Doc | null;
  provider?: WebsocketProvider;
  editorView: EditorView | null;
  storeId: number;
  zoomLevel: number; // New: Store zoom level (100 = 100%)
}

// Define the store interface
export interface DocsAppStore extends DocsAppState {
  createDocId: () => string;
  initialize: (docId: string, docEntity?: DocEntity) => Promise<void>;
  cleanup: () => void;
  fetchRecentDocs: () => Promise<void>;
  createDoc: () => Promise<DocEntity>;
  setState: (state: Partial<DocsAppState>) => void;
  setDocId: (docId: string | null) => void;
  setEditorView: (editorView: EditorView | null) => void;
  editorViewGetCurrentText: () => string;
  
  // New: Zoom functions
  setZoomLevel: (level: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;

  // Diff interface with nodes
  getNodes: (view?: EditorView) => YxmlNode[];
  addNode: (node: Partial<YxmlNode>) => YxmlNode[] | null;
  removeNode: (position: number) => YxmlNode[] | null;
  updateNode: (node: Partial<YxmlNode>) => YxmlNode[] | null;
}

// Define the store hook type
export type DocsAppStoreHook = UseBoundStore<StoreApi<DocsAppStore>>;

// First, update the store type to include the subscription
interface DocsStore extends DocsAppStore {
  subscribe: (subscriber: (state: DocsAppState) => void) => () => boolean;
}

// Create the store with proper typing
export const createDocsAppStore = (windowId: string, spaceId: string) => {
  // Create a set of subscribers
  const subscribers = new Set<(state: DocsAppState) => void>();

  // Create the base store
  return create<DocsStore>((set, get) => ({
    // Initial state
    windowId,
    spaceId,
    status: 'idle',
    docContent: '',
    initialized: false,
    isInitializing: false,
    isInitialized: false,
    recentDocs: [],
    docId: null,
    error: null,
    ydoc: null,
    editorView: null,
    storeId: Date.now(),
    zoomLevel: 100, // Default zoom is 100%

    // New: Zoom control functions
    setZoomLevel: (level: number) => {
      // Clamp zoom level between 50% and 200%
      const clampedLevel = Math.max(50, Math.min(200, level));
      logger.log('[DocsAppStore] Setting zoom level to', clampedLevel);
      set({ zoomLevel: clampedLevel });
    },
    
    zoomIn: () => {
      const { zoomLevel } = get();
      const newZoomLevel = Math.min(200, zoomLevel + 10);
      logger.log('[DocsAppStore] Zooming in from', zoomLevel, 'to', newZoomLevel);
      set({ zoomLevel: newZoomLevel });
    },
    
    zoomOut: () => {
      const { zoomLevel } = get();
      const newZoomLevel = Math.max(50, zoomLevel - 10);
      logger.log('[DocsAppStore] Zooming out from', zoomLevel, 'to', newZoomLevel);
      set({ zoomLevel: newZoomLevel });
    },
    
    resetZoom: () => {
      logger.log('[DocsAppStore] Resetting zoom to 100%');
      set({ zoomLevel: 100 });
    },

    createDocId: () => new ObjectId().toString(),
    // Set state function
    setState: (newState: Partial<DocsAppState>) => {
      set((state) => ({
        ...state,
        ...newState
      }));
    },
    setDocId: (docId: string | null) => {
      set({ docId });
    },
    setEditorView: (editorView: EditorView | null) => {
      logger.log('[DocsAppStore] Setting editor view:', { editorView });
      set({ editorView });
    },

    editorViewGetCurrentText: () => {
      const { editorView } = get();
      if (editorView) {
        logger.log('[DocsAppStore] Getting current text:', { text: editorView.state.doc.textContent, windowId: get().windowId, spaceId: get().spaceId });
        return editorView.state.doc.textContent;
      } else {
        logger.error('[DocsAppStore] No editor view found', { windowId: get().windowId, spaceId: get().spaceId });
        throw new Error('No editor view found');
      }
    },

    // Initialize function
    initialize: async (docId: string, docEntity?: DocEntity) => {
      logger.log('[DocsAppStore] Starting initialization for doc:', { docId, windowId });
      
      const state = get();
      
      if (state.initialized && state.docId === docId && state.ydoc) {
        logger.log('[DocsAppStore] Already fully initialized, skipping');
        set({ isInitialized: true });
        return;
      }
      
      if (state.status === 'loading' && state.docId === docId) {
        logger.log('[DocsAppStore] Already loading, waiting...');
        // Wait for loading to complete
        await new Promise<void>(resolve => {
          const onStateChange = (newState: DocsAppState) => {
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
        const newState = { 
          status: 'loading' as const, 
          docId,
          isInitializing: true,
          isInitialized: false
        };
        set(newState);
        // Notify subscribers
        subscribers.forEach(subscriber => subscriber({ ...get(), ...newState }));

        const initialDoc = docEntity || await entityService.get(docId);
        logger.log('[DocsAppStore] Initial content:', initialDoc);

        const {doc: ydoc, provider} = docsCRDTService.getYDocForDoc(
          docId, 
          initialDoc.skeleton?.content || '',
          initialDoc.name // Pass the document name
        );

        // Set up observer for Y.js document changes
        const observer = (update: Uint8Array, origin: any) => {
          console.log('[DocsApp - Store] Update received:', { update, origin });
          const yxml = ydoc.getXmlFragment('prosemirror');
          const currentContent = yxml.toString();
          console.log('[DocsApp - Store] YXML content:', { contentLength: currentContent.length, content: currentContent.substring(0, 100) });
          
          // Always update content from Y.js - this is the source of truth
          // The Y.js document will have the correct content whether it came from:
          // 1. Database initialization
          // 2. Peer synchronization
          // 3. Local changes
          console.log('[DocsApp - Store] Updating content from Y.js');
          set({ docContent: currentContent });
        };

        ydoc.on('update', observer);

        const cleanup = () => {
          ydoc.off('update', observer);
        };

        // Get initial content from Y.js document
        const yxml = ydoc.getXmlFragment('prosemirror');
        const initialContent = yxml.toString();

        const finalState = {
          windowId,
          spaceId,
          status: 'idle' as const,
          docId,
          docContent: initialContent,
          initialized: true,
          isInitializing: false,
          isInitialized: true,
          ydoc,
          provider,
          cleanup
        };

        console.log('[DocsApp - Store] Initialization complete:', { 
          docId, 
          contentLength: initialContent.length,
          hasProvider: !!provider,
          providerState: {
            connected: provider?.wsconnected,
            synced: provider?.synced
          }
        });

        set(finalState);
        // Notify subscribers
        subscribers.forEach(subscriber => subscriber({ ...get(), ...finalState }));
      } catch (error) {
        logger.error('[DocsAppStore] Error initializing:', error);
        set({ 
          status: 'error', 
          error: error as Error,
          isInitializing: false,
          isInitialized: false
        });
      }
    },

    // Cleanup function
    cleanup: () => {
      const state = get();
      if (state.cleanup) {
        state.cleanup();
      }
    },

    // Fetch recent docs
    fetchRecentDocs: async () => {
      try {
        set({ isInitializing: true });
        const docs = await entityService.getEntitiesByType({ entityType: 'Doc' });
        // order by created_at or updated_at (favour the updated_at)
        const sortedDocs = docs.sort((a, b) => {
          const aUpdatedAt = new Date(a.updated_at).getTime();
          const bUpdatedAt = new Date(b.updated_at).getTime();
          return bUpdatedAt - aUpdatedAt;
        });
        set({ 
          recentDocs: sortedDocs as DocEntity[],
          isInitializing: false,
          isInitialized: true
        });
      } catch (error) {
        logger.error('[DocsAppStore] Error fetching recent docs:', error);
        set({ 
          error: error as Error,
          isInitializing: false,
          isInitialized: false
        });
      }
    },

    // Create doc
    createDoc: async () => {
      try {
        const newDocEntityData: Partial<DocEntity> = {
          entityType: 'Doc',
          // type: 'doc',
          name: 'New Document',
          skeleton: {
            '@type': 'Doc',
            content: '',
            settings: {
              isContentsVisible: true,
              isChatVisible: true
            }
          },
          created_at: new Date().toISOString(),
        }
        const { id } = await entityService.create(newDocEntityData);
        const newDocEntity = { ...newDocEntityData, id } as DocEntity;
        set({ recentDocs: [...get().recentDocs, newDocEntity] });
        return newDocEntity;
      } catch (error) {
        logger.error('[DocsAppStore] Error creating doc:', error);
        set({ error: error as Error });
        throw error;
      }
    },

    // Add subscribe method directly in the store
    subscribe: (subscriber: (state: DocsAppState) => void) => {
      subscribers.add(subscriber);
      return () => subscribers.delete(subscriber);
    },


    // Diff interface (with nodes)

    getNodes: (view?: EditorView) => {
      let editorView = view || get().editorView;
      if (!editorView) return [];
      
      const yxmlNodes: YxmlNode[] = [];
      editorView.state.doc.descendants((node, pos) => {
        if (node.isBlock) {
          logger.log('[DocsAppStore][getNodes] Found block node:', { node, pos });
          yxmlNodes.push({
            content: node.textContent,
            type: node.type.name,
            pos,
            size: node.nodeSize,
            isDeletion: node.attrs.change_status === 'old',
            isInsertion: node.attrs.change_status === 'new'
          });
        }
      });
      logger.log('[DocsAppStore][getNodes] YXML nodes:', yxmlNodes);
      return yxmlNodes;
    },

    addNode: (node: Partial<YxmlNode>) => {
      logger.log('[DocsAppStore][addNode] Adding yxml node:', { node });
      
      if (!node.content || !node.type || node.pos === undefined) return null;

      const { editorView, getNodes, docId } = get();
      if (!editorView) {
        logger.error('[DocsAppStore][addNode] No editor view found');
        return null;
      };

      const { state, dispatch, updateState } = editorView;
      const { tr } = state;

      // create new node
      const newNode = state.schema.nodes[node.type].create(
        { change_status: 'new', revision_id: new ObjectId().toString() },
        state.schema.text(node.content)
      );

      logger.log('[DocsAppStore][addNode] Adding new node:', { newNode });

      // insert new node at position
      tr.insert(node.pos, newNode);
      dispatch(tr);
      // updateState(state);
      const nodes = getNodes(editorView);
      logger.log('[DocsAppStore][addNode] Nodes after insert:', { nodes });
      
      const textContent = editorView.state.doc.textContent;
      set({ docContent: textContent });
      
      // Persist changes to backend
      const yxml = get().ydoc?.getXmlFragment('prosemirror');
      const yxmlString = yxml?.toString();
      if (docId && yxmlString) {
        // **DEBUG: Log CRDT persistence**
        logger.log('[DocsAppStore][addNode][ai_debug] 💾 Persisting to CRDT:', {
          docId,
          yxmlLength: yxmlString.length,
          windowId: get().windowId,
          beforeSave: yxmlString.substring(0, 100) + '...'
        });
        docsCRDTService.saveToDB(docId, yxmlString);
        logger.log('[DocsAppStore][addNode][ai_debug] ✅ CRDT save completed');
      } else {
        logger.error('[DocsAppStore][addNode][ai_debug] ❌ Cannot persist - missing docId or yxml:', {
          hasDocId: !!docId,
          hasYxml: !!yxml,
          hasYxmlString: !!yxmlString
        });
      }
      
      return nodes;
    },

    removeNode: (position: number) => {
      const { editorView, getNodes, docId } = get();
      if (!editorView) return null;
      
      const { state, dispatch, updateState } = editorView;
      const { tr } = state;

      // find node at position
      const node = state.doc.nodeAt(position);
      if (!node) return null;

      if (node.isText) {
        // For text nodes, find the parent node position
        const $pos = state.doc.resolve(position);
        const parentPos = $pos.before($pos.depth);
        const parentNode = state.doc.nodeAt(parentPos);
        
        if (parentNode) {
          // Mark the parent node as old
          tr.setNodeMarkup(parentPos, null, { change_status: 'old', revision_id: new ObjectId().toString() });
        } else {
          throw new Error('[DocsApp - Store] Parent node not found');
        }
      } else {
        // For non-text nodes, mark directly
        tr.setNodeMarkup(position, null, { change_status: 'old', revision_id: new ObjectId().toString() });
      }

      dispatch(tr);
      // updateState(state);
      const nodes = getNodes(editorView);
      logger.log('[DocsAppStore][removeNode] Nodes after remove:', { nodes });
      
      // Persist changes to backend
      const yxml = get().ydoc?.getXmlFragment('prosemirror');
      const yxmlString = yxml?.toString();
      if (docId && yxmlString) {
        docsCRDTService.saveToDB(docId, yxmlString);
      }
      
      return nodes;
    },

    updateNode: (node: Partial<YxmlNode>) => {
      if (!node.content || !node.type || node.pos === undefined) return null;
      const { editorView, getNodes, docId } = get();
      if (!editorView) return null;
    
      const { state, dispatch, updateState } = editorView;
      const { tr } = state;

      const revisionId = new ObjectId().toString();

      // find node at position
      const oldNode = state.doc.nodeAt(node.pos);
      if (!oldNode) return null;

      if (oldNode.isText) {
        // For text nodes, find the parent node position
        const $pos = state.doc.resolve(node.pos);
        const parentPos = $pos.before($pos.depth);
        const parentNode = state.doc.nodeAt(parentPos);
        
        if (parentNode) {
          // Mark the parent node as old
          tr.setNodeMarkup(parentPos, null, { change_status: 'old', revision_id: revisionId });
        } else {
          throw new Error('[DocsApp - Store] Parent node not found');
        }
      } else {
        // For non-text nodes, mark directly
        tr.setNodeMarkup(node.pos, null, { change_status: 'old', revision_id: revisionId });
      }

      // create new node
      const newNode = state.schema.nodes[node.type].create(
        { change_status: 'new', revision_id: revisionId },
        state.schema.text(node.content)
      );

      // insert new node at position
      tr.insert(node.pos, newNode);
      dispatch(tr);
      // updateState(state);
      const nodes = getNodes(editorView);
      logger.log('[DocsAppStore][updateNode] Nodes after update:', { nodes });
      
      
      const textContent = editorView.state.doc.textContent;
      set({ docContent: textContent });
      
      // Persist changes to backend
      const yxml = get().ydoc?.getXmlFragment('prosemirror');
      const yxmlString = yxml?.toString();
      if (docId && yxmlString) {
        docsCRDTService.saveToDB(docId, yxmlString);
      }
      
      return nodes;
    },
  }));
};

// Create a map to store instances
const storeMap = new Map<string, ReturnType<typeof createDocsAppStore>>();

// Get or create store instance
export const getDocsAppStore = (windowId: string, spaceId: string) => {
  const key = `${windowId}-${spaceId}`;

  if (storeMap.size === 0) {
    registerCommands(commands);
    logger.log('[DocsAppStore] Registered docs commands');
  }

  if (!storeMap.has(key)) {
    const store = createDocsAppStore(windowId, spaceId);
    storeMap.set(key, store);
  }
  return storeMap.get(key)!;
};

// Hook to use the store
export const useDocsAppStore = (windowId: string, spaceId: string) => {
  return useStore(useMemo(() => getDocsAppStore(windowId, spaceId), [windowId, spaceId]));
};

// Cleanup function
export const cleanupDocsStore = (windowId: string, spaceId: string) => {
  const key = `${windowId}-${spaceId}`;
  const store = storeMap.get(key);
  if (store) {
    const state = store.getState();
    state.cleanup();
    storeMap.delete(key);
    logger.log('[DocsAppStore] Cleaned up store for:', key);
  }
};
