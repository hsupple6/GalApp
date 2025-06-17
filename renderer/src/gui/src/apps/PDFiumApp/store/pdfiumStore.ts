import { useMemo } from 'react';
import { create } from 'zustand';
import { StoreApi, UseBoundStore, useStore } from 'zustand';
import { ObjectId } from 'bson';
import { commands } from '../commands';
import { registerCommands } from 'stores/commandRegistryStore';
import { entityService } from '../../../services/entityService';
import { PDFDocument } from '../lib/pdfium-wasm/types';
import { logger } from 'utils/logger';

// Define page contents interface
export interface PageContents {
  [pageNumber: string]: string;
}

// Define the state interface
export interface PDFiumAppState {
  windowId: string;
  spaceId: string;
  status: 'idle' | 'loading' | 'error';
  error: Error | null;
  initialized: boolean;
  isInitializing: boolean;
  isInitialized: boolean;
  entityId: string | null;
  // The full PDF entity data
  entity: any | null;
  // PDF content and enrichments
  rawText: string;
  pageContents: PageContents;
  pageSummaries: Record<string, string>;
  pdfDoc: PDFDocument | null;
  hasEnrichments: boolean;
  enrichmentError: string | null;
  // Viewer state
  scale: number;
  selection: any | null;
}

// Define the store interface
export interface PDFiumStore extends PDFiumAppState {
  initialize: (entityId: string) => Promise<void>;
  cleanup: () => void;
  setScale: (scale: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  setSelection: (selection: any | null) => void;
  setPDFDoc: (doc: PDFDocument | null) => void;
  setState: (state: Partial<PDFiumAppState>) => void;
  getPageText: (pageNumber: number) => string | null;
  getAllPageSummaries: () => Record<string, string>;
  getPageSummary: (pageNumber: number) => string | null;
}

// Define the store hook type
export type PDFiumStoreHook = UseBoundStore<StoreApi<PDFiumStore>>;

// Create the store with proper typing
export const createPDFiumStore = (windowId: string, spaceId: string) => {
  // Create a set of subscribers
  const subscribers = new Set<(state: PDFiumAppState) => void>();

  // Create the base store
  return create<PDFiumStore>((set, get) => ({
    // Initial state
    windowId,
    spaceId,
    status: 'idle',
    error: null,
    initialized: false,
    isInitializing: false,
    isInitialized: false,
    entityId: null,
    entity: null,
    rawText: '',
    pageContents: {},
    pageSummaries: {},
    pdfDoc: null,
    hasEnrichments: false,
    enrichmentError: null,
    scale: 1.0,
    selection: null,

    // Set partial state
    setState: (newState: Partial<PDFiumAppState>) => {
      set((state) => ({
        ...state,
        ...newState
      }));
    },

    // Initialize function - loads the full PDF entity and its enrichments
    initialize: async (entityId: string) => {
      logger.log('[PDFiumStore] Starting initialization for entity:', { entityId, windowId });
      
      const state = get();
      
      if (state.initialized && state.entityId === entityId && state.entity) {
        logger.log('[PDFiumStore] Already fully initialized, skipping');
        set({ isInitialized: true });
        return;
      }
      
      if (state.status === 'loading' && state.entityId === entityId) {
        logger.log('[PDFiumStore] Already loading, waiting...');
        return;
      }

      try {
        set({ 
          status: 'loading', 
          entityId,
          isInitializing: true,
          isInitialized: false
        });

        // Fetch the full entity data from the backend
        const entity = await entityService.get(entityId);
        logger.log('[PDFiumStore] Loaded entity:', entity);
        
        // Extract enrichments
        const enrichments = entity?.skeleton?.enrichments;
        const hasEnrichments = !!enrichments;
        let rawText = '';
        let pageContents: PageContents = {};
        let pageSummaries: Record<string, string> = {};
        let enrichmentError = entity?.skeleton?.enrichment_error || null;
        
        // Extract raw text if available
        if (enrichments?.raw_text) {
          rawText = enrichments.raw_text;
        }
        
        // Extract page contents from sections if available
        if (enrichments?.sections) {
          Object.entries(enrichments.sections).forEach(([key, value]) => {
            // Extract page number from "Page X" format
            const pageMatch = key.match(/Page (\d+)/);
            if (pageMatch && pageMatch[1]) {
              const pageNumber = parseInt(pageMatch[1], 10);
              if (!isNaN(pageNumber)) {
                pageContents[pageNumber.toString()] = value as string;
              }
            }
          });
        }
        
        // Extract page summaries
        // Check if the structure is like the example with "Page X" keys
        if (enrichments?.summaries && typeof enrichments.summaries === 'object' && !Array.isArray(enrichments.summaries)) {
          logger.log('[PDFiumStore] Found summaries in object format with Page X keys');
          // Process each page summary
          Object.entries(enrichments.summaries).forEach(([key, value]) => {
            // Extract page number from "Page X" format or use key directly
            const pageMatch = key.match(/Page (\d+)/);
            if (pageMatch && pageMatch[1]) {
              const pageNumber = parseInt(pageMatch[1], 10);
              if (!isNaN(pageNumber)) {
                pageSummaries[pageNumber.toString()] = typeof value === 'string' ? value : JSON.stringify(value);
              }
            } else if (/^\d+$/.test(key)) {
              // If key is already a number string, use it directly
              pageSummaries[key] = typeof value === 'string' ? value : JSON.stringify(value);
            }
          });
        }
        // Check if pageSummaries exists (less common)
        else if (enrichments?.pageSummaries) {
          logger.log('[PDFiumStore] Found pageSummaries field');
          // If it's an array, convert to object with page numbers as keys
          if (Array.isArray(enrichments.pageSummaries)) {
            enrichments.pageSummaries.forEach((summary: any, index: number) => {
              const pageNumber = (index + 1).toString();
              if (typeof summary === 'string') {
                pageSummaries[pageNumber] = summary;
              } else if (summary && typeof summary === 'object') {
                try {
                  pageSummaries[pageNumber] = JSON.stringify(summary);
                } catch (e) {
                  pageSummaries[pageNumber] = `Summary for page ${pageNumber}`;
                }
              }
            });
          } 
          // If it's already an object mapping page numbers to summaries
          else if (typeof enrichments.pageSummaries === 'object') {
            Object.entries(enrichments.pageSummaries).forEach(([key, value]) => {
              pageSummaries[key] = typeof value === 'string' ? value : JSON.stringify(value);
            });
          }
        }
        // Sometimes it might be an array under 'summaries' (old format?)
        else if (enrichments?.summaries && Array.isArray(enrichments.summaries)) {
          logger.log('[PDFiumStore] Found summaries in array format');
          enrichments.summaries.forEach((summary: any, index: number) => {
            const pageNumber = (index + 1).toString();
            if (typeof summary === 'string') {
              pageSummaries[pageNumber] = summary;
            } else if (summary && typeof summary === 'object') {
              try {
                pageSummaries[pageNumber] = JSON.stringify(summary);
              } catch (e) {
                pageSummaries[pageNumber] = `Summary for page ${pageNumber}`;
              }
            }
          });
        }
        
        logger.log('[PDFiumStore] Processed enrichments:', {
          pageContentCount: Object.keys(pageContents).length,
          pageSummaryCount: Object.keys(pageSummaries).length,
          summaryKeys: Object.keys(pageSummaries).slice(0, 3),
          hasRawText: !!rawText,
          enrichmentError
        });
        
        // Update state with all the extracted data
        set({
          status: 'idle',
          entity,
          rawText,
          pageContents,
          pageSummaries,
          hasEnrichments,
          enrichmentError,
          initialized: true,
          isInitializing: false,
          isInitialized: true
        });
      } catch (error) {
        logger.error('[PDFiumStore] Error initializing:', error);
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
      const { pdfDoc } = get();
      
      // Clean up PDF document if it exists
      if (pdfDoc) {
        try {
          logger.log('[PDFiumStore] Cleaning up PDF document');
          pdfDoc.destroy();
        } catch (error) {
          logger.error('[PDFiumStore] Error destroying PDF document:', error);
        }
      }
      
      set({
        pdfDoc: null,
        entity: null,
        initialized: false,
        isInitialized: false
      });
    },

    // Zoom controls
    setScale: (scale: number) => {
      set({ scale });
    },
    
    zoomIn: () => {
      set(state => ({ scale: state.scale * 1.1 }));
    },
    
    zoomOut: () => {
      set(state => ({ scale: state.scale / 1.1 }));
    },
    
    resetZoom: () => {
      set({ scale: 1.0 });
    },

    // Selection handling
    setSelection: (selection: any | null) => {
      set({ selection });
    },

    // Set PDF document
    setPDFDoc: (doc: PDFDocument | null) => {
      set({ pdfDoc: doc });
    },

    // Get page text for a specific page number
    getPageText: (pageNumber: number): string | null => {
      const { pageContents } = get();
      return pageContents[pageNumber.toString()] || null;
    },

    // Get all page summaries
    getAllPageSummaries: (): Record<string, string> => {
      return get().pageSummaries;
    },

    // Get summary for a specific page
    getPageSummary: (pageNumber: number): string | null => {
      const { pageSummaries } = get();
      return pageSummaries[pageNumber.toString()] || null;
    }
  }));
};

// Create a map to store instances
const storeMap = new Map<string, ReturnType<typeof createPDFiumStore>>();

// Get or create store instance
export const getPDFiumStore = (windowId: string, spaceId: string) => {
  const key = `${windowId}-${spaceId}`;

  if (storeMap.size === 0) {
    registerCommands(commands);
    logger.log('[PDFiumStore] Registered PDF commands');
  }

  if (!storeMap.has(key)) {
    const store = createPDFiumStore(windowId, spaceId);
    storeMap.set(key, store);
  }
  return storeMap.get(key)!;
};

// Hook to use the store
export const usePDFiumStore = (windowId: string, spaceId: string) => {
  return useStore(useMemo(() => getPDFiumStore(windowId, spaceId), [windowId, spaceId]));
};

// Cleanup function
export const cleanupPDFiumStore = (windowId: string, spaceId: string) => {
  const key = `${windowId}-${spaceId}`;
  const store = storeMap.get(key);
  if (store) {
    const state = store.getState();
    state.cleanup();
    storeMap.delete(key);
    logger.log('[PDFiumStore] Cleaned up store for:', key);
  }
}; 