import React, { useCallback, useEffect, useRef, useState } from 'react';

import useOnScreen from '../hooks/useOnScreen';
import { PDFDocument, PDFPage } from '../lib/pdfium-wasm/types';
import { TextSelection } from '../types';
import SelectionBounds from './SelectionBounds';

interface Props {
  pdfDocument: PDFDocument;
  // page: PDFPage;
  pageIndex: number;
  scale: number;
  // children: any;
  renderMode?: 'normal' | 'high-resolution';
  selection: TextSelection | null;
  onMouseDown: (e: React.MouseEvent, pageIndex: number, canvasRef: React.MutableRefObject<HTMLCanvasElement | null>, page: PDFPage | null) => void;
  onMouseMove: (e: React.MouseEvent, pageIndex: number, canvasRef: React.MutableRefObject<HTMLCanvasElement | null>, page: PDFPage | null) => void;
}

export default function PdfPage({
  pdfDocument,
  // page,
  pageIndex,
  selection,
  scale,
  renderMode = 'normal',
  onMouseDown,
  onMouseMove,
}: Props) {
  const [page, setPage] = useState<PDFPage | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isIntersecting = useOnScreen(canvasRef);
  const [isRendered, setIsRendered] = useState<boolean>(false);

  const loadPage = useCallback(async () => {
    try {
      // Make sure the pdfDocument still exists
      if (!pdfDocument) {
        console.warn(`PDF Document is no longer available for page ${pageIndex}`);
        return;
      }
      
      const initialPage = await pdfDocument.getPage(pageIndex);
      setPage(initialPage);
      console.debug(`✅ Loaded page ${pageIndex}`);
    } catch (error) {
      console.error(`❌ Failed to load page ${pageIndex}:`, error);
      // Don't set the page state if loading fails
    }
  }, [pageIndex, pdfDocument]);

  const renderPage = useCallback(async () => {
    const canvas = canvasRef.current;

    if (!canvas || !page) {
      return;
    }

    const context = canvas.getContext('2d');

    if (!context) {
      console.error(`Failed to get context for page ${pageIndex}`);
      return;
    }

    try {
      context.clearRect(0, 0, canvas.width, canvas.height);

      await page.render(context, {
        width: page.width * window.devicePixelRatio,
        height: page.height * window.devicePixelRatio,
        scale,
        renderMode,
      });

      console.debug(`✅ Completed render for page ${pageIndex}`);

      setIsRendered(true);
    } catch (err) {
      console.error(`Failed to render page ${pageIndex}:`, err);
      context.fillStyle = 'white';
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
  }, [page, pageIndex, renderMode, scale]);

  useEffect(() => {
    if (isIntersecting && !page) {
      loadPage().then();
    }
  }, [isIntersecting, loadPage, page]);

  useEffect(() => {
    if (isIntersecting && !isRendered && page) {
      renderPage().then();
    }
  }, [isIntersecting, isRendered, renderPage, page]);

  // Cleanup pages when component unmounts
  useEffect(() => {
    return () => {
      try {
        page?.destroy();
      } catch (error) {
        console.error(`Error destroying page ${pageIndex}:`, error);
      }
    };
  }, [page, pageIndex]);

  // Handle scale changes
  useEffect(() => {
    // Mark all pages for re-render when scale changes
    setIsRendered(false);
  }, [scale, renderMode]);

  // useEffect(() => {
  //   // Log page render info
  //   console.log('🎯 PdfPage render:', {
  //     pageIndex,
  //     hasSelection: !!selection,
  //     selectionBounds: selection?.bounds,
  //     scale,
  //     pageWidth: page?.width,
  //     pageHeight: page?.height
  //   });
  // }, [pageIndex, selection, scale, page]);

  return (
    <div style={{ position: 'relative' }}>
      <canvas
        ref={canvasRef}
        style={{
          backgroundColor: 'white',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          cursor: 'text',
          width: `${(page?.width || 552) * scale}px`,
          height: `${(page?.height || 751) * scale}px`,
        }}
        width={(page?.width || 552) * scale * 2}
        height={(page?.height || 751) * scale * 2}
        onMouseDown={(e) => onMouseDown(e, pageIndex, canvasRef, page)}
        onMouseMove={(e) => onMouseMove(e, pageIndex, canvasRef, page)}
      />

      {page ? <SelectionBounds selection={selection} index={pageIndex} page={page} scale={scale} /> : null}
    </div>
  );
}
