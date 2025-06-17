import { CharacterBounds } from './lib/pdfium-wasm/types';

export interface TextSelection {
  startPage: number;
  endPage: number;
  startIndex: number;
  endIndex: number;
  text: string;
  bounds: {
    rects: Array<{
      left: number;
      top: number;
      right: number;
      bottom: number;
    }>;
  };
} 