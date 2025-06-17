import React, { useCallback, useEffect, useRef, useState } from 'react';

import { CharacterBounds, PDFDocument, PDFPage } from '../lib/pdfium-wasm/types';
import { TextSelection } from '../types';
import PdfPage from './PdfPage';

interface SelectionRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

const getSelectionBounds = async (page: PDFPage, startIndex: number, endIndex: number) => {

  // Get all character bounds
  const boundsPromises = Array.from(
    { length: endIndex - startIndex + 1 }, 
    (_, i) => page.getCharacterBounds(startIndex + i)
  );
  
  const allBounds = await Promise.all(boundsPromises);
  const validBounds = allBounds.filter(Boolean) as CharacterBounds[];
  
  if (validBounds.length === 0) {
    console.log('⚠️ No valid bounds found!');
    return { rects: [] };
  }

  // Group into lines based on Y position with more tolerance
  const lines: CharacterBounds[][] = [];
  let currentLine: CharacterBounds[] = [validBounds[0]];
  const lineHeightTolerance = 2; // Pixels of tolerance for line height differences

  for (let i = 1; i < validBounds.length; i++) {
    const bound = validBounds[i];
    const prevBound = validBounds[i - 1];
    
    // If this character is close to the previous one horizontally and vertically,
    // add it to the current line
    if (Math.abs(bound.top - prevBound.top) < lineHeightTolerance &&
        Math.abs(bound.bottom - prevBound.bottom) < lineHeightTolerance &&
        (bound.left - prevBound.right) < 20) { // Allow some space between characters
      currentLine.push(bound);
    } else {
      lines.push([...currentLine]);
      currentLine = [bound];
    }
  }
  lines.push([...currentLine]);

  // Create one rectangle per line
  const rects = lines.map(line => {
    // Get the average/max height for this line
    const lineTop = Math.min(...line.map(b => b.top));
    const lineBottom = Math.max(...line.map(b => b.bottom));
    const lineHeight = lineBottom - lineTop;

    // Create rectangles with consistent height
    return line.reduce((lineRects, char, i) => {
      const prevChar = line[i - 1];

      if (prevChar && (char.left - prevChar.right) < 5) {
        lineRects[lineRects.length - 1].right = char.right;
      } else {
        lineRects.push({
          left: char.left - 1,
          right: char.right + 1,
          top: lineTop - 2,
          bottom: lineBottom + 2
        });
      }
      return lineRects;
    }, [] as SelectionRect[]);
  }).flat();

  return { rects };
};

const getCharacterAtPosition = async (
  e: React.MouseEvent,
  pageIndex: number,
  canvas: HTMLCanvasElement | null,
  page: PDFPage,
) => {
  if (!canvas || !page) return;

  const rect = canvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * page.width;
  const y = ((e.clientY - rect.top) / rect.height) * page.height;

  return await page.getCharacterAtPosition(x, y);
};

interface Props {
  document: PDFDocument;
  scale?: number;
  renderMode?: 'normal' | 'high-resolution';
  onScaleChange?: (newScale: number) => void;
  selection: TextSelection | null;
  setSelection: React.Dispatch<React.SetStateAction<TextSelection | null>>;
  isSelecting: boolean;
  setIsSelecting: (isSelecting: boolean, selection?: TextSelection) => void;
}

export const PDFRenderer: React.FC<Props> = ({
  document: pdfDocument,
  scale = 1.0,
  renderMode = 'normal',
  onScaleChange,
  selection,
  setSelection,
  isSelecting,
  setIsSelecting,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  // const pagePointersRef = useRef<number[]>([]);
  const justFinishedSelectingRef = useRef(false);
  const [initialSelection, setInitialSelection] = useState<TextSelection | null>(null);
  const [isShiftSelecting, setIsShiftSelecting] = useState(false);

  // Handle zooming with trackpad/wheel
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        // Ctrl on Windows/Linux, Cmd on Mac
        e.preventDefault();
        const delta = -e.deltaY;
        const zoomFactor = 1.005; // Smaller factor for smoother zooming
        const newScale = scale * Math.pow(zoomFactor, delta);

        // Limit zoom range
        const constrainedScale = Math.min(Math.max(newScale, 0.25), 5.0);
        onScaleChange?.(constrainedScale);
      }
    },
    [onScaleChange, scale],
  );

  // Add wheel event listener
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
      return () => container.removeEventListener('wheel', handleWheel);
    }
  }, [handleWheel, scale]);

  // Update click handler to check the ref
  const handleClick = useCallback(() => {
    if (justFinishedSelectingRef.current) {
      justFinishedSelectingRef.current = false;
      return;
    }
    // Only clear selection if we're not shift-selecting
    if (!isSelecting && !isShiftSelecting) {
      setSelection(null);
    }
  }, [isSelecting, isShiftSelecting, setSelection]);

  // Update mouseup to handle final selection
  const onMouseUp = useCallback(async (e?: React.MouseEvent) => {
    // Prevent handling the event multiple times
    if (e) {
      e.stopPropagation();
    }

    if (isSelecting && selection) {
      const page = await pdfDocument.getPage(selection.startPage + 1);
      
      const startIdx = Math.min(selection.startIndex, selection.endIndex);
      const endIdx = Math.max(selection.startIndex, selection.endIndex);
      
      if (!isNaN(startIdx) && !isNaN(endIdx)) {
        console.log('🔍 Getting text range:', { startIdx, endIdx });
        
        // Get final text and bounds
        const [text, bounds] = await Promise.all([
          page.getTextRange(startIdx, endIdx),
          getSelectionBounds(page, startIdx, endIdx)
        ]);

        const finalSelection = {
          ...selection,
          startIndex: startIdx,
          endIndex: endIdx,
          text,
          bounds
        };

        // Update local state and notify parent only once
        setSelection(finalSelection);
        justFinishedSelectingRef.current = true;
        setIsSelecting(false, finalSelection);
        return;
      }
    }
    setIsSelecting(false);
  }, [isSelecting, selection, pdfDocument, setSelection]);

  // Update mousedown to handle both new selections and clearing
  const onMouseDown = useCallback(
    async (
      e: React.MouseEvent,
      pageIndex: number,
      canvasRef: React.MutableRefObject<HTMLCanvasElement | null>,
      page: PDFPage | null,
    ) => {
      const canvas = canvasRef.current;
      if (!canvas || !page) return;

      const charIndex = await getCharacterAtPosition(e, pageIndex, canvas, page);
      if (charIndex === undefined || charIndex < 0) {
        setSelection(null);
        setIsSelecting(false);
        setIsShiftSelecting(false);
        return;
      }

      // Always start a new selection unless shift is pressed
      if (!e.shiftKey) {
        // Set initial selection point
        const newSelection = {
          startPage: pageIndex - 1,
          startIndex: charIndex,
          endPage: pageIndex - 1,
          endIndex: charIndex,
          text: '',
          bounds: { rects: [] },
        };
        setSelection(newSelection);
        setInitialSelection(newSelection);
        setIsSelecting(true);
        setIsShiftSelecting(false);
      } else if (e.shiftKey && initialSelection) {
        // Extend existing selection
        setIsSelecting(true);
        setIsShiftSelecting(true);
      }
    },
    [initialSelection, setIsSelecting, setSelection],
  );

  // Modify onMouseMove to only update visual bounds
  const onMouseMove = useCallback(
    async (
      e: React.MouseEvent,
      pageIndex: number,
      canvasRef: React.MutableRefObject<HTMLCanvasElement | null>,
      page: PDFPage | null,
    ) => {
      const canvas = canvasRef.current;
      if (!canvas || !page || !isSelecting || !selection || isShiftSelecting) return;

      const charIndex = await getCharacterAtPosition(e, pageIndex, canvas, page);
      if (charIndex === undefined || charIndex < 0) return;

      const startIdx = Math.min(selection.startIndex, charIndex);
      const endIdx = Math.max(selection.startIndex, charIndex);

      // Only update bounds during drag for visual feedback
      getSelectionBounds(page, startIdx, endIdx).then(bounds => {
        setSelection(prev => ({
          ...prev!,
          endPage: pageIndex - 1,
          endIndex: charIndex,
          bounds,
        }));
      });
    },
    [isSelecting, isShiftSelecting, selection, setSelection],
  );

  return (
    <div
      ref={containerRef}
      className="pdf-pages"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        padding: '20px',
      }}
      onClick={handleClick}
      onMouseUp={e => {
        e.stopPropagation();
        onMouseUp(e);
      }}
    >
      {Array.from({ length: pdfDocument.numPages }).map((_, index) => {
        return (
          <PdfPage
            key={index}
            pdfDocument={pdfDocument}
            pageIndex={index + 1}
            renderMode={renderMode}
            scale={scale}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            selection={selection}
          />
        );
      })}
    </div>
  );
};
