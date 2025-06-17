import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export interface FileInfo {
  id: string;
  name: string;
  path: string;
  type: string;
  content: string;
}

export interface UIViewInfo {
  id: string;
  name: string;
  type: string;
  config: any;
  url?: string;
  htmlContent?: string;
}

interface NeurvanaAppState {
  projectId: string | null;
  activeFileId: string | null;
  activeUIViewId: string | null;
  openFiles: FileInfo[];
  openUIViews: UIViewInfo[];
  isSidebarOpen: boolean;
  storeId: string;
}

interface NeurvanaAppActions {
  initialize: (projectId?: string | null) => void;
  setFileId: (fileId: string | null) => void;
  setUIViewId: (uiViewId: string | null) => void;
  openFile: (file: FileInfo) => void;
  openUIView: (uiView: UIViewInfo) => void;
  closeFile: (fileId: string) => void;
  closeUIView: (uiViewId: string) => void;
  toggleSidebar: () => void;
}

type NeurvanaAppStore = NeurvanaAppState & NeurvanaAppActions;

const createStore = (storeId: string) => {
  // Try to get projectId from URL or localStorage first
  let initialProjectId: string | null = null;
  
  // Check URL first if we're in a browser environment
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    const urlProjectId = urlParams.get('projectId');
    
    if (urlProjectId) {
      initialProjectId = urlProjectId;
    } else {
      // Try localStorage
      const savedProjectId = localStorage.getItem('lastOpenProjectId');
      if (savedProjectId) {
        initialProjectId = savedProjectId;
      }
    }
  }
  
  return create<NeurvanaAppStore>()(
    immer((set, get) => ({
      projectId: initialProjectId,
      activeFileId: null,
      activeUIViewId: null,
      openFiles: [],
      openUIViews: [],
      isSidebarOpen: true,
      storeId,

      initialize: (projectId) => {
        set((state) => {
          if (projectId) {
            state.projectId = projectId;
          }
        });
      },

      setFileId: (fileId) => {
        set((state) => {
          state.activeFileId = fileId;
        });
      },

      setUIViewId: (uiViewId) => {
        set((state) => {
          state.activeUIViewId = uiViewId;
        });
      },

      openFile: (file) => {
        set((state) => {
          // Check if the file is already open
          const existingFileIndex = state.openFiles.findIndex(f => f.id === file.id);
          
          if (existingFileIndex === -1) {
            state.openFiles.push(file);
          } else {
            // Update the existing file
            state.openFiles[existingFileIndex] = file;
          }
          
          state.activeFileId = file.id;
        });
      },

      openUIView: (uiView) => {
        set((state) => {
          // Check if the UI view is already open
          const existingViewIndex = state.openUIViews.findIndex(v => v.id === uiView.id);
          
          if (existingViewIndex === -1) {
            state.openUIViews.push(uiView);
          } else {
            // Update the existing UI view
            state.openUIViews[existingViewIndex] = uiView;
          }
          
          state.activeUIViewId = uiView.id;
        });
      },

      closeFile: (fileId) => {
        set((state) => {
          state.openFiles = state.openFiles.filter(f => f.id !== fileId);
          
          // If we closed the active file, set the active file to the last one in the list
          if (state.activeFileId === fileId && state.openFiles.length > 0) {
            state.activeFileId = state.openFiles[state.openFiles.length - 1].id;
          } else if (state.openFiles.length === 0) {
            state.activeFileId = null;
          }
        });
      },

      closeUIView: (uiViewId) => {
        set((state) => {
          state.openUIViews = state.openUIViews.filter(v => v.id !== uiViewId);
          
          // If we closed the active UI view, set the active view to the last one in the list
          if (state.activeUIViewId === uiViewId && state.openUIViews.length > 0) {
            state.activeUIViewId = state.openUIViews[state.openUIViews.length - 1].id;
          } else if (state.openUIViews.length === 0) {
            state.activeUIViewId = null;
          }
        });
      },

      toggleSidebar: () => {
        set((state) => {
          state.isSidebarOpen = !state.isSidebarOpen;
        });
      }
    }))
  );
};

// Create a store for each window/space combination
const stores = new Map<string, any>();

export const useNeurvanaAppStore = (windowId: string, spaceId: string) => {
  const storeId = `${windowId}-${spaceId}`;
  
  if (!stores.has(storeId)) {
    stores.set(storeId, createStore(storeId));
  }
  
  return stores.get(storeId)();
}; 