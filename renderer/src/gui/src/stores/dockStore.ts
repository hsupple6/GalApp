import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useAppRegistryStore } from './appRegistryStore';

interface DockPreferences {
  appOrder: string[];
  hiddenApps: string[];
}

interface DockStore {
  preferences: DockPreferences;
  setAppOrder: (order: string[]) => void;
  toggleAppVisibility: (appId: string) => void;
  resetPreferences: () => void;
  syncWithAvailableApps: () => void;
}

const DEFAULT_PREFERENCES: DockPreferences = {
  appOrder: [
    'pdfium',
    'settings', 
    'EntityBrowserApp',
    'docs'
  ],
  hiddenApps: []
};

export const useDockStore = create<DockStore>()(
  persist(
    (set, get) => ({
      preferences: DEFAULT_PREFERENCES,
      setAppOrder: (order) => 
        set((state) => ({
          preferences: { ...state.preferences, appOrder: order }
        })),
      toggleAppVisibility: (appId) =>
        set((state) => ({
          preferences: {
            ...state.preferences,
            hiddenApps: state.preferences.hiddenApps.includes(appId)
              ? state.preferences.hiddenApps.filter(id => id !== appId)
              : [...state.preferences.hiddenApps, appId]
          }
        })),
      resetPreferences: () =>
        set(() => ({
          preferences: DEFAULT_PREFERENCES
        })),
      syncWithAvailableApps: () => {
        const availableApps = Object.keys(useAppRegistryStore.getState().apps);
        const currentPreferences = get().preferences;
        
        // Filter out apps that no longer exist
        const validAppOrder = currentPreferences.appOrder.filter(appId => availableApps.includes(appId));
        const validHiddenApps = currentPreferences.hiddenApps.filter(appId => availableApps.includes(appId));
        
        // Add any new apps to the end of the order
        const newApps = availableApps.filter(appId => !validAppOrder.includes(appId));
        
        set({
          preferences: {
            appOrder: [...validAppOrder, ...newApps],
            hiddenApps: validHiddenApps
          }
        });
      }
    }),
    {
      name: 'dock-preferences'
    }
  )
); 