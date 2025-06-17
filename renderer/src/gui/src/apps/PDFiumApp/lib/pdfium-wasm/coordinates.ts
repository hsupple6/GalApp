export const PDFCoordinates = {
  // Convert screen coordinates to PDF coordinates
  screenToPDF: (x: number, y: number, pageHeight: number) => ({
    x,
    y: pageHeight - y  // Flip Y coordinate
  }),

  // Convert PDF coordinates to screen coordinates
  pdfToScreen: (x: number, y: number, pageHeight: number) => ({
    x,
    y: pageHeight - y  // Flip Y coordinate
  }),

  // Get character bounds in screen coordinates
  getCharacterScreenBounds: (bounds: { left: number; right: number; top: number; bottom: number }, pageHeight: number) => ({
    left: bounds.left,
    right: bounds.right,
    top: pageHeight - bounds.bottom,  // Flip Y coordinate
    bottom: pageHeight - bounds.top   // Flip Y coordinate
  })
}; 