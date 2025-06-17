import { create, useStore } from 'zustand';
import { Mention } from '../types';
import { AnyWindowEntity } from 'types/windows';
import { useMemo } from 'react';

interface MentionState {
  mentionSearch: string;
  mentionSuggestions: AnyWindowEntity[];
  mentions: Mention[];
  mentionStartIndex: number;
  mentionResults: AnyWindowEntity[];
  showMentionResults: boolean;
  
  // Actions
  setMentionSearch: (search: string) => void;
  setMentionSuggestions: (suggestions: AnyWindowEntity[]) => void;
  setMentions: (mentions: Mention[]) => void;
  setMentionStartIndex: (index: number) => void;
  setMentionResults: (results: AnyWindowEntity[]) => void;
  setShowMentionResults: (show: boolean) => void;
  handleMentionSelect: (entity: AnyWindowEntity) => void;
}

const createMentionStore = () => {
  return create<MentionState>((set, get) => ({
    mentionSearch: '',
    mentionSuggestions: [],
    mentions: [],
    mentionStartIndex: -1,
    mentionResults: [],
    showMentionResults: false,

    setMentionSearch: (search) => set({ mentionSearch: search }),
    setMentionSuggestions: (suggestions) => set({ mentionSuggestions: suggestions }),
    setMentions: (mentions) => set({ mentions }),
    setMentionStartIndex: (index) => set({ mentionStartIndex: index }),
    setMentionResults: (results) => set({ mentionResults: results }),
    setShowMentionResults: (show) => set({ showMentionResults: show }),
    
    handleMentionSelect: (entity) => {
      const { mentionStartIndex } = get();
      
      if (mentionStartIndex === -1) return;
      
      // Ensure displayName is a string
      const displayName = 'name' in entity && typeof entity.name === 'string' 
        ? entity.name 
        : String(entity.id);
      
      set((state) => ({
        mentions: [...state.mentions, { 
          id: entity.id, 
          displayName, 
          type: entity.type 
        }],
        mentionStartIndex: -1,
        showMentionResults: false
      }));
    }
  }));
}; 

export const useMentionStore = () => useStore(useMemo(() => createMentionStore(), []));