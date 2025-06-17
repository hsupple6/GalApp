import type { AnyWindowEntity } from './windows';

export interface SpaceSelection {
  text: string;
  source: {
    window: AnyWindowEntity;
    type: string;  // e.g., 'pdf', 'web', 'text-editor'
    metadata?: {
      pageNumber?: number;
      lineNumber?: number;
      // ... other app-specific metadata
      [key: string]: any;
    };
  };
}

export interface SelectionProvider {
  type: string;
  handleSelection: (selection: SpaceSelection) => void;
} 