import React, { useEffect, useRef, useState } from 'react';

import type { PDFDocument, PDFViewport } from '../../lib/pdfium-wasm/types';

interface PageViewProps {
  document: PDFDocument;
  pageNumber: number;
  viewport: PDFViewport;
}

export const PageView: React.FC<PageViewProps> = ({ document, pageNumber, viewport }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let currentPage: any = null;

    const renderPage = async () => {
      if (!canvasRef.current) return;

      try {
        setLoading(true);
        console.debug(`📄 [Page ${pageNumber}] Getting page from document`);
        const page = await document.getPage(pageNumber);
        console.debug(`✅ [Page ${pageNumber}] Got page:`, {
          width: page.width,
          height: page.height,
          pagePtr: (page as any).pagePtr,
        });

        currentPage = page;
        const ctx = canvasRef.current.getContext('2d');

        if (!ctx || !mounted) return;

        // Scale canvas for high DPI displays
        const pixelRatio = window.devicePixelRatio || 1;
        const scaledWidth = page.width * viewport.scale * pixelRatio;
        const scaledHeight = page.height * viewport.scale * pixelRatio;

        console.debug(`🎨 [Page ${pageNumber}] Setting up canvas:`, {
          pixelRatio,
          scaledWidth,
          scaledHeight,
          viewportScale: viewport.scale,
        });

        canvasRef.current.width = scaledWidth;
        canvasRef.current.height = scaledHeight;
        canvasRef.current.style.width = `${page.width * viewport.scale}px`;
        canvasRef.current.style.height = `${page.height * viewport.scale}px`;

        ctx.scale(pixelRatio, pixelRatio);

        console.debug(`🖌️ [Page ${pageNumber}] Starting render with viewport:`, viewport);
        await page.render(ctx, {
          ...viewport,
          rotation: viewport.rotation || 0,
        });
        console.debug(`✨ [Page ${pageNumber}] Render complete`);
      } catch (error) {
        console.error(`❌ [Page ${pageNumber}] Error:`, error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    console.debug(`🔄 [Page ${pageNumber}] Starting page render effect`);
    renderPage();

    return () => {
      console.debug(`🧹 [Page ${pageNumber}] Cleaning up`);
      mounted = false;
      if (currentPage) {
        try {
          currentPage.destroy();
          console.debug(`🗑️ [Page ${pageNumber}] Page destroyed`);
        } catch (e) {
          console.warn(`⚠️ [Page ${pageNumber}] Error destroying page:`, e);
        }
      }
    };
  }, [document, pageNumber, viewport.scale, viewport.rotation]);

  return (
    <div className="pdf-page">
      {loading && <div className="pdf-page-loading">Loading...</div>}
      <canvas ref={canvasRef} />
    </div>
  );
};
