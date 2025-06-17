import './PDFViewer.scss';

import React, { useEffect, useRef, useState } from 'react';

import { useViewport } from '../../hooks/useViewport';
import type { PDFDocument } from '../../lib/pdfium-wasm/types';
import { PageView } from './PageView';
import { SearchPanel } from './SearchPanel';
import { Thumbnails } from './Thumbnails';
import { Toolbar } from './Toolbar';

export interface PDFViewerProps {
  document: PDFDocument;
}

export const PDFViewer = React.memo(({ document }: PDFViewerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isThumbnailsOpen, setIsThumbnailsOpen] = useState(true);
  const { viewport, zoom, pan, rotate } = useViewport({ initialScale: 1.0 });

  // Create array of page numbers
  const pageNumbers = Array.from(
    { length: document.numPages },
    (_, i) => i + 1
  );

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  return (
    <div className="pdf-viewer">
      <Toolbar
        currentPage={currentPage}
        totalPages={document?.numPages || 1}
        scale={viewport.scale}
        onZoomIn={() => zoom(0.1)}
        onZoomOut={() => zoom(-0.1)}
        onRotate={() => rotate(90)}
        onToggleSearch={() => setIsSearchOpen(!isSearchOpen)}
        onToggleThumbnails={() => setIsThumbnailsOpen(!isThumbnailsOpen)}
      />

      <div className="pdf-viewer-container">
        {isThumbnailsOpen && (
          <Thumbnails
            document={document}
            currentPage={currentPage}
            onPageSelect={handlePageChange}
          />
        )}

        <div 
          ref={containerRef}
          className="pdf-viewer-content"
          onWheel={e => {
            if (e.ctrlKey) {
              e.preventDefault();
              zoom(e.deltaY > 0 ? -0.1 : 0.1);
            }
          }}
        >
          {pageNumbers.map(pageNumber => (
            <PageView
              key={pageNumber}
              document={document}
              pageNumber={pageNumber}
              viewport={viewport}
            />
          ))}
        </div>

        {isSearchOpen && (
          <SearchPanel
            document={document}
            currentPage={currentPage}
            onResultClick={(page) => handlePageChange(page)}
          />
        )}
      </div>
    </div>
  );
});

export default PDFViewer; 