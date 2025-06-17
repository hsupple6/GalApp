import { create, useStore } from 'zustand';
import { ChatMode } from '../types';
import { AppAction } from 'types/apps';
import { useMemo } from 'react';
import { ModelType } from '../components/ModelSelector';
import { logger } from 'utils/logger';

interface UiState {
  // Chat mode and model
  mode: ChatMode;
  model: string;
  models: ModelType[];

  // Context and tools
  isContextVisible: boolean;
  isActionsVisible: boolean;
  activeToolId: string | null;
  activeToolPayload: {
    id: string;
    input: any;
    name: string;
  } | null;
  nextAutoMessage: AppAction[] | null;
  
  // UI state
  isHistoryOpen: boolean;
  activePreview: string | null;
  inputText: string;

  // Actions
  setMode: (mode: ChatMode) => void;
  setModel: (model: string) => void;
  setModels: (models: ModelType[]) => void;
  setIsHistoryOpen: (isOpen: boolean) => void;
  setActivePreview: (previewId: string | null) => void;
  setIsContextVisible: (isVisible: boolean) => void;
  setIsActionsVisible: (isVisible: boolean) => void;
  setNextAutoMessage: (message: AppAction[] | null) => void;
  setInputText: (text: string) => void;
  // New method to initialize from space settings
  initializeFromSpaceSettings: () => Promise<void>;
}

const createUiStore = () => {
  return create<UiState>((set, get) => ({
    mode: 'create',
    model: 'claude-3.5-sonnet',
    models: [],
    isContextVisible: true,
    isActionsVisible: false,
    activeToolId: null,
    activeToolPayload: null,
    nextAutoMessage: null,
    isHistoryOpen: false,
    activePreview: null,
    inputText: '',

    setMode: (mode) => {
      set({ mode });
      
      // Persist to space store
      (async () => {
        try {
          const spaceStore = (await import('../../../../stores/spaceStore')).default;
          const spaceState = spaceStore.getState();
          await spaceState.updateSpaceChatSettings({ mode });
          logger.log('[uiStore][setMode] Persisted mode to space store:', mode);
        } catch (error) {
          logger.error('[uiStore][setMode] Failed to persist mode:', error);
        }
      })();
    },
    
    setModel: (model) => {
      set({ model });
      
      // Persist to space store
      (async () => {
        try {
          const spaceStore = (await import('../../../../stores/spaceStore')).default;
          const spaceState = spaceStore.getState();
          await spaceState.updateSpaceChatSettings({ model });
          logger.log('[uiStore][setModel] Persisted model to space store:', model);
        } catch (error) {
          logger.error('[uiStore][setModel] Failed to persist model:', error);
        }
      })();
    },
    
    setModels: (models) => set({ models }),
    
    setIsHistoryOpen: (isOpen) => {
      set({ isHistoryOpen: isOpen });
      
      // Persist to space store
      (async () => {
        try {
          const spaceStore = (await import('../../../../stores/spaceStore')).default;
          const spaceState = spaceStore.getState();
          await spaceState.updateSpaceChatSettings({ isHistoryOpen: isOpen });
          logger.log('[uiStore][setIsHistoryOpen] Persisted history state to space store:', isOpen);
        } catch (error) {
          logger.error('[uiStore][setIsHistoryOpen] Failed to persist history state:', error);
        }
      })();
    },
    
    setActivePreview: (previewId) => set({ activePreview: previewId }),
    
    setIsContextVisible: (isVisible) => {
      set({ isContextVisible: isVisible });
      
      // Persist to space store
      (async () => {
        try {
          const spaceStore = (await import('../../../../stores/spaceStore')).default;
          const spaceState = spaceStore.getState();
          await spaceState.updateSpaceChatSettings({ isContextVisible: isVisible });
          logger.log('[uiStore][setIsContextVisible] Persisted context visibility to space store:', isVisible);
        } catch (error) {
          logger.error('[uiStore][setIsContextVisible] Failed to persist context visibility:', error);
        }
      })();
    },
    
    setIsActionsVisible: (isVisible) => set({ isActionsVisible: isVisible }),
    setNextAutoMessage: (message) => set({ nextAutoMessage: message }),
    setInputText: (text) => set({ inputText: text }),

    initializeFromSpaceSettings: async () => {
      try {
        const spaceStore = (await import('../../../../stores/spaceStore')).default;
        const spaceState = spaceStore.getState();
        const spaceChatSettings = spaceState.activeSpace?.settings?.spaceChat;
        
        if (spaceChatSettings) {
          set({
            mode: (spaceChatSettings.mode as ChatMode) || 'create',
            model: spaceChatSettings.model || 'claude-3.5-sonnet',
            isHistoryOpen: spaceChatSettings.isHistoryOpen || false,
            isContextVisible: spaceChatSettings.isContextVisible !== undefined ? spaceChatSettings.isContextVisible : true
          });
          logger.log('[uiStore][initializeFromSpaceSettings] Loaded settings from space store:', spaceChatSettings);
        }
      } catch (error) {
        logger.error('[uiStore][initializeFromSpaceSettings] Failed to load space settings:', error);
      }
    }
  }));
};

export const useUiStore = () => useStore(useMemo(() => createUiStore(), []));