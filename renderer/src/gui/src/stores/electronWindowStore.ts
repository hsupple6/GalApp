import { create } from 'zustand';

export interface ElectronWindow {
  id: string;
  type: 'browserView';
  url: string;
  title: string;
  bounds: { x: number; y: number; width: number; height: number };
  zIndex: number;
}

interface ElectronWindowState {
  windows: Record<string, ElectronWindow>;
  addWindow: (window: ElectronWindow) => void;
  updateWindow: (id: string, updates: Partial<ElectronWindow>) => void;
  removeWindow: (id: string) => void;
  setZIndex: (id: string, zIndex: number) => void;
}

export const useElectronWindowStore = create<ElectronWindowState>()((set) => ({
  windows: {},
  addWindow: (window: ElectronWindow) => {
    return set((state: ElectronWindowState) => ({
      windows: { ...state.windows, [window.id]: window },
    }));
  },
  updateWindow: (id: string, updates: Partial<ElectronWindow>) =>
    set((state: ElectronWindowState) => ({
      windows: {
        ...state.windows,
        [id]: { ...state.windows[id], ...updates },
      },
    })),
  removeWindow: (id: string) =>
    set((state: ElectronWindowState) => {
      const { [id]: removed, ...rest } = state.windows;
      return { windows: rest };
    }),
  setZIndex: (id: string, zIndex: number) =>
    set((state: ElectronWindowState) => ({
      windows: {
        ...state.windows,
        [id]: { ...state.windows[id], zIndex },
      },
    })),
}));
