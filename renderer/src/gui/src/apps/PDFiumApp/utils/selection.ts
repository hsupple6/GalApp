import { ViewportManager } from './viewport';

interface PDFRect {
  x: number;
  y: number;
  width: number;
  height: number;
  pageNumber: number;
}

export function getClientRects(range: Range, viewportManager: ViewportManager): PDFRect[] {
  const clientRects = Array.from(range.getClientRects());
  const rects: PDFRect[] = [];

  // Get all PDF page elements
  const pages = Array.from(document.querySelectorAll('.pdf-page')).map((node, index) => ({
    node,
    number: index + 1,
    rect: node.getBoundingClientRect()
  }));

  clientRects.forEach(clientRect => {
    // Find which page this selection belongs to
    const page = pages.find(page => {
      const pageRect = page.rect;
      return (
        clientRect.top >= pageRect.top &&
        clientRect.bottom <= pageRect.bottom &&
        clientRect.left >= pageRect.left &&
        clientRect.right <= pageRect.right
      );
    });

    if (page) {
      // Convert screen coordinates to PDF coordinates
      const [pdfX, pdfY] = viewportManager.screenToPDF(
        clientRect.left - page.rect.left,
        clientRect.top - page.rect.top
      );

      const [pdfWidth, pdfHeight] = viewportManager.screenToPDF(
        clientRect.width,
        clientRect.height
      );

      rects.push({
        x: pdfX,
        y: pdfY,
        width: pdfWidth,
        height: pdfHeight,
        pageNumber: page.number
      });
    }
  });

  return rects;
} 