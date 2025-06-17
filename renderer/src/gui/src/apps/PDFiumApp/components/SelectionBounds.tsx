import { useMemo } from 'react';

import { PDFPage } from '../lib/pdfium-wasm/types';
import { TextSelection } from '../types';

interface Props {
  selection: TextSelection | null;
  index: number;
  page: PDFPage;
  scale: number;
}

interface SelectionRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export default function SelectionBounds({ selection, index, page, scale }: Props) {
  const style = useMemo(() => ({
    position: 'absolute' as const,
    top: 0,
    left: 0,
    width: `${page.width * scale}px`,
    height: `${page.height * scale}px`,
    pointerEvents: 'none' as const,
    zIndex: 10000,
  }), [page.height, page.width, scale]);

  if (!selection?.bounds?.rects?.length) return null;

  // Only show selection on the correct page
  if ((index - 1) !== selection.startPage) return null;

  return (
    <svg key={`selection-${selection.startIndex}-${selection.endIndex}`} style={style}>
      {selection.bounds.rects.map((rect: SelectionRect, i: number) => {
        const x = rect.left * scale;
        const y = rect.top * scale;
        const width = (rect.right - rect.left) * scale;
        const height = (rect.bottom - rect.top) * scale;

        return (
          <rect 
            key={i} 
            x={x} 
            y={y} 
            width={width} 
            height={height} 
            fill="rgba(0, 100, 255, 0.15)" 
          />
        );
      })}
    </svg>
  );
}
