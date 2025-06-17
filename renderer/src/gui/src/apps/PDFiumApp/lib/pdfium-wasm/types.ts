export interface PDFViewport {
  width: number;
  height: number;
  scale: number;
  rotation?: number;
  offsetX?: number;
  offsetY?: number;
  renderMode?: 'normal' | 'high-resolution';
}

export type ViewportState = PDFViewport;

export interface PDFPage {
  width: number;
  height: number;
  pageNumber: number;
  pagePtr: number;
  render: (context: CanvasRenderingContext2D, viewport: PDFViewport) => Promise<void>;
  getText: () => Promise<string>;
  getTextInRect: (left: number, top: number, right: number, bottom: number) => Promise<string>;
  destroy: () => void;
  getTextPage: () => Promise<number>;
  getCharacterAtPosition: (x: number, y: number) => Promise<number>;
  getCharacterBounds: (index: number) => Promise<CharacterBounds | null>;
  getTextRange: (startIndex: number, endIndex: number) => Promise<string>;
}

export interface CharacterBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
  lineHeight: number;
}

export interface PDFDocument {
  numPages: number;
  getPage(pageNumber: number): Promise<PDFPage>;
  destroy(): void;
}

export interface PDFiumModule {
  // Memory
  HEAP8: Int8Array;
  HEAPU8: Uint8Array;
  HEAP16: Int16Array;
  HEAPU16: Uint16Array;
  HEAP32: Int32Array;
  HEAPU32: Uint32Array;
  HEAPF32: Float32Array;
  
  // Memory management
  _malloc(size: number): number;
  _free(ptr: number): void;

  // PDFium functions
  _FPDF_InitLibrary(): void;
  _FPDF_InitLibraryWithConfig(config: number): number;
  _FPDF_LoadMemDocument(data: number, size: number, password: number | null): number;
  _FPDF_CloseDocument(doc: number): void;
  _FPDF_GetPageCount(doc: number): number;
  _FPDF_LoadPage(doc: number, page_index: number): number;
  _FPDF_ClosePage(page: number): void;
  _FPDF_GetPageWidth(page: number): number;
  _FPDF_GetPageHeight(page: number): number;
  _FPDF_GetLastError(): number;

  // Bitmap functions
  _FPDFBitmap_Create(width: number, height: number, format: number): number;
  _FPDFBitmap_CreateEx(width: number, height: number, format: number, buffer: number, stride: number): number;
  _FPDFBitmap_FillRect(bitmap: number, left: number, top: number, width: number, height: number, color: number): number;
  _FPDFBitmap_GetBuffer(bitmap: number): number;
  _FPDFBitmap_GetStride(bitmap: number): number;
  _FPDFBitmap_Destroy(bitmap: number): void;
  _FPDF_RenderPageBitmap(bitmap: number, page: number, start_x: number, start_y: number, size_x: number, size_y: number, rotate: number, flags: number): number;

  // Text functions
  _FPDFText_LoadPage(page: number): number;
  _FPDFText_ClosePage(textPage: number): void;
  _FPDFText_CountChars(textPage: number): number;
  _FPDFText_GetText(textPage: number, start_index: number, count: number, result: number): number;
  _FPDFText_GetCharBox(textPage: number, index: number, left: number, right: number, bottom: number, top: number): number;
  _FPDFText_GetCharIndexAtPos(textPage: number, x: number, y: number, xTolerance: number, yTolerance: number): number;
  _FPDFText_GetBoundedText(textPage: number, left: number, top: number, right: number, bottom: number, buffer: number | null, length: number): number;
  _FPDFText_GetWordBoundary(textPage: number, charIndex: number, start: number, count: number): number;
  _FPDFText_GetCharOrigin(textPage: number, index: number, x: number, y: number): number;
  _FPDFText_GetFontSize(textPage: number, index: number): number;
  _FPDFText_CountRects(textPage: number, start: number, count: number): number;
  _FPDFText_GetRect(textPage: number, rect_index: number, left: number, top: number, right: number, bottom: number): void;

  // WASM specific
  wasmExports: {
    memory: WebAssembly.Memory;
    FPDF_RenderPageBitmap: Function;
  };
}

export interface TextChar {
  index: number;
  bounds: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  };
} 