import { PDFCoordinates } from './coordinates';
import { debug } from './debug';
import type { PDFDocument, PDFiumModule, PDFPage, PDFViewport } from './types';

// First, let's define a type for our format
interface BitmapFormat {
  id: number;
  name: string;
}

export class PDFiumWrapper {
  private module: PDFiumModule;
  private initialized: boolean = false;
  private allocatedBuffers: Set<number> = new Set();
  private documentDataPtr: number = 0;
  private activePages: Set<number> = new Set();

  constructor(module: PDFiumModule) {
    if (!module || typeof module._FPDF_InitLibrary !== 'function') {
      throw new Error('Invalid PDFium module');
    }
    this.module = module;

    try {
      const configPtr = module._malloc(16);
      if (!configPtr) {
        throw new Error('Failed to allocate config memory');
      }

      try {
        module.HEAPU8.fill(0, configPtr, configPtr + 16);
        module.HEAPU32[configPtr >> 2] = 2;

        console.debug('Initializing PDFium with config at:', configPtr);
        const result = module._FPDF_InitLibraryWithConfig(configPtr);
        console.debug('Initialization result:', result);

        this.initialized = true;
      } finally {
        module._free(configPtr);
      }
    } catch (error) {
      console.error('PDFium initialization failed:', error);
      try {
        console.debug('Attempting fallback initialization...');
        module._FPDF_InitLibrary();
        this.initialized = true;
      } catch (fallbackError) {
        console.error('Fallback initialization failed:', fallbackError);
        throw new Error('Failed to initialize PDFium');
      }
    }

    if (!this.initialized) {
      throw new Error('PDFium initialization failed');
    }
  }

  private ensureInitialized() {
    if (!this.initialized) {
      throw new Error('PDFium not properly initialized');
    }
  }

  private logMemoryStats() {
    console.debug('Memory stats:', {
      allocatedBuffers: [...this.allocatedBuffers],
      heapSize: this.module.HEAPU8.length,
      // Add any other relevant memory stats
    });
  }

  private async renderPage(
    context: CanvasRenderingContext2D,
    viewport: PDFViewport,
    pagePtr: number,
    pageWidth: number,
    pageHeight: number,
  ) {
    if (!context || !viewport || !pagePtr) {
      throw new Error('Invalid render parameters');
    }

    this.ensureInitialized();
    // this.logMemoryStats();

    // Round dimensions to prevent fractional pixels
    const renderWidth = Math.floor(viewport.width);
    const renderHeight = Math.floor(viewport.height);

    if (renderWidth <= 0 || renderHeight <= 0) {
      throw new Error(`Invalid dimensions: ${renderWidth}x${renderHeight}`);
    }

    console.debug('Render dimensions:', {
      renderWidth,
      renderHeight,
      pagePtr,
      viewport,
    });

    // Create bitmap with integer dimensions
    const bitmap = this.module._FPDFBitmap_Create(
      renderWidth,
      renderHeight,
      0, // BGRA format
    );

    if (!bitmap) {
      throw new Error(`Failed to create bitmap (${renderWidth}x${renderHeight})`);
    }

    this.allocatedBuffers.add(bitmap);

    try {
      const fillResult = this.module._FPDFBitmap_FillRect(bitmap, 0, 0, renderWidth, renderHeight, 0xffffffff);

      if (fillResult === 0) {
        throw new Error('Failed to fill bitmap background');
      }

      const renderResult = this.module._FPDF_RenderPageBitmap(bitmap, pagePtr, 0, 0, renderWidth, renderHeight, 0, 0);

      if (renderResult === 0) {
        throw new Error(`Render failed: ${this.getErrorDescription(this.module._FPDF_GetLastError())}`);
      }

      const buffer = this.module._FPDFBitmap_GetBuffer(bitmap);
      const stride = this.module._FPDFBitmap_GetStride(bitmap);

      if (!buffer) {
        throw new Error('Failed to get bitmap buffer');
      }

      // Ensure stride is a multiple of 4 for RGBA data
      const alignedWidth = Math.floor(stride / 4);
      const size = stride * renderHeight;
      const data = new Uint8Array(this.module.HEAPU8.buffer, buffer, size);
      
      // Convert from BGRA to RGBA format - this fixes the inverted colors
      const rgbaData = this.convertToRGBA(new Uint8Array(data), 0); // 0 is BGRA format
      
      // Create ImageData with the converted RGBA data
      const imageData = new ImageData(
        new Uint8ClampedArray(rgbaData.buffer), 
        alignedWidth, 
        renderHeight
      );

      // Draw to canvas
      context.putImageData(imageData, 0, 0);
    } catch (error) {
      console.error('Render error:', error);
      throw error;
    } finally {
      this.allocatedBuffers.delete(bitmap);
      this.module._FPDFBitmap_Destroy(bitmap);
    }
  }

  private convertToRGBA(data: Uint8Array, fromFormat: number): Uint8Array {
    const rgba = new Uint8Array(data.length);

    for (let i = 0; i < data.length; i += 4) {
      switch (fromFormat) {
        case 0: // BGRA to RGBA
          rgba[i] = data[i + 2]; // R <- B
          rgba[i + 1] = data[i + 1]; // G stays
          rgba[i + 2] = data[i]; // B <- R
          rgba[i + 3] = data[i + 3]; // A stays
          break;
        case 1: // BGR to RGBA
        case 2: // BGRx to RGBA
          rgba[i] = data[i + 2]; // R <- B
          rgba[i + 1] = data[i + 1]; // G stays
          rgba[i + 2] = data[i]; // B <- R
          rgba[i + 3] = 255; // A = 255
          break;
        case 3: // Gray to RGBA
          rgba[i] = data[i]; // R = Gray
          rgba[i + 1] = data[i]; // G = Gray
          rgba[i + 2] = data[i]; // B = Gray
          rgba[i + 3] = 255; // A = 255
          break;
      }
    }

    return rgba;
  }

  async loadDocument(data: Uint8Array): Promise<PDFDocument> {
    if (!data || !(data instanceof Uint8Array)) {
      throw new Error('Invalid PDF data: must be a Uint8Array');
    }

    if (this.documentDataPtr !== 0) {
      // Clean up any existing document
      this.module._free(this.documentDataPtr);
      this.documentDataPtr = 0;
    }

    this.documentDataPtr = this.module._malloc(data.length);
    if (!this.documentDataPtr) {
      throw new Error('Failed to allocate memory for PDF data');
    }

    try {
      const dataHeap = new Uint8Array(this.module.HEAPU8.buffer, this.documentDataPtr, data.length);
      dataHeap.set(data);

      const docPtr = this.module._FPDF_LoadMemDocument(this.documentDataPtr, data.length, null);
      if (!docPtr) {
        throw new Error(
          `Failed to load PDF document. Error code: ${this.getErrorDescription(this.module._FPDF_GetLastError())}`,
        );
      }

      const pageCount = this.module._FPDF_GetPageCount(docPtr);
      console.debug('Document loaded with', pageCount, 'pages');

      return {
        numPages: pageCount,
        getPage: async (pageNumber: number): Promise<PDFPage> => {
          try {
            // Check if document is still valid (not destroyed)
            if (!this.module || !docPtr) {
              throw new Error('The PDF document has been closed or is no longer valid');
            }
            
            console.debug(`Loading page ${pageNumber} from document ${docPtr}`);
            
            const pagePtr = this.module._FPDF_LoadPage(docPtr, pageNumber - 1);
            if (!pagePtr) {
              const errorCode = this.module._FPDF_GetLastError(); 
              throw new Error(
                `Failed to load page ${pageNumber}. Error code: ${this.getErrorDescription(errorCode)}`,
              );
            }

            // Track this page as active
            this.activePages.add(pagePtr);
            
            const width = this.module._FPDF_GetPageWidth(pagePtr);
            const height = this.module._FPDF_GetPageHeight(pagePtr);

            return {
              width,
              height,
              pagePtr,
              pageNumber,
              
              render: async (context: CanvasRenderingContext2D, viewport: PDFViewport) => {
                return this.renderPage(context, viewport, pagePtr, width, height);
              },

              destroy: () => {
                try {
                  if (this.activePages.has(pagePtr)) {
                    console.debug(`Destroying page ${pageNumber} (pointer: ${pagePtr})`);
                    this.module._FPDF_ClosePage(pagePtr);
                    this.activePages.delete(pagePtr);
                  }
                } catch (error) {
                  console.error(`Error destroying page ${pageNumber}:`, error);
                }
              },

              getTextPage: async () => {
                const textPage = this.module._FPDFText_LoadPage(pagePtr);
                if (!textPage) {
                  throw new Error('Failed to load text page');
                }
                return textPage;
              },

              getText: async (): Promise<string> => {
                return this.getPageText(pagePtr);
              },

              getTextInRect: async (left: number, top: number, right: number, bottom: number): Promise<string> => {
                return this.getTextInRect(pagePtr, left, top, right, bottom);
              },

              getCharacterAtPosition: async (x: number, y: number): Promise<number> => {
                return this.getCharacterAtPosition(pagePtr, x, y);
              },

              getCharacterBounds: async (index: number): Promise<any> => {
                return this.getCharacterBounds(pagePtr, index);
              },

              getTextRange: async (startIndex: number, endIndex: number): Promise<string> => {
                return this.getTextRange(pagePtr, startIndex, endIndex);
              },
            };
          } catch (error) {
            console.error(`Error in getPage(${pageNumber}):`, error);
            throw error;
          }
        },
        destroy: () => {
          try {
            // Only proceed if we have valid pointers
            if (docPtr && this.documentDataPtr) {
              console.debug('📑 Closing PDF document with pointer:', docPtr);
              // Close the document first
              this.module._FPDF_CloseDocument(docPtr);
              // Then free the memory
              if (this.documentDataPtr) {
                console.debug('📑 Freeing document data memory:', this.documentDataPtr);
                this.module._free(this.documentDataPtr);
                this.documentDataPtr = 0;
              }
            } else {
              console.warn('Skipping document destroy - invalid pointers:', { docPtr, dataPtr: this.documentDataPtr });
            }
          } catch (error) {
            console.error('Error in PDF document destroy:', error);
            // Make sure to reset the data pointer even if there's an error
            this.documentDataPtr = 0;
          }
        },
      };
    } catch (error) {
      this.module._free(this.documentDataPtr);
      this.documentDataPtr = 0;
      throw error;
    }
  }

  private getErrorDescription(code: number): string {
    switch (code) {
      case 0:
        return 'Success';
      case 1:
        return 'Unknown error';
      case 2:
        return 'File access error';
      case 3:
        return 'File format error';
      case 4:
        return 'Password error';
      case 5:
        return 'Security error';
      case 6:
        return 'Page not found or content error';
      default:
        return `Unknown error code: ${code}`;
    }
  }

  // Add cleanup method
  destroy() {
    // Clean up active pages first
    for (const pagePtr of this.activePages) {
      try {
        this.module._FPDF_ClosePage(pagePtr);
      } catch (e) {
        console.warn('Error closing page:', e);
      }
    }
    this.activePages.clear();

    // Clean up any remaining buffers
    for (const ptr of this.allocatedBuffers) {
      try {
        this.module._free(ptr);
      } catch (e) {
        console.warn('Failed to free buffer:', e);
      }
    }
    this.allocatedBuffers.clear();

    // Clean up document data if any
    if (this.documentDataPtr !== 0) {
      try {
        this.module._free(this.documentDataPtr);
      } catch (e) {
        console.warn('Failed to free document data:', e);
      }
      this.documentDataPtr = 0;
    }
  }

  private getPageText(pagePtr: number): string {
    // Load text page
    const textPage = this.module._FPDFText_LoadPage(pagePtr);
    if (!textPage) {
      throw new Error('Failed to load text page');
    }

    try {
      // Get character count
      const charCount = this.module._FPDFText_CountChars(textPage);
      if (charCount <= 0) return '';

      // Allocate buffer for text
      const bufferLength = (charCount + 1) * 2; // UTF-16 + null terminator
      const buffer = this.module._malloc(bufferLength);
      if (!buffer) {
        throw new Error('Failed to allocate text buffer');
      }

      try {
        // Get text
        const length = this.module._FPDFText_GetText(textPage, 0, charCount, buffer);
        if (length <= 0) return '';

        // Convert to string
        const array = new Uint16Array(this.module.HEAPU8.buffer, buffer, length);
        return String.fromCharCode(...array);
      } finally {
        this.module._free(buffer);
      }
    } finally {
      this.module._FPDFText_ClosePage(textPage);
    }
  }

  private getTextInRect(pagePtr: number, left: number, top: number, right: number, bottom: number): string {
    const textPage = this.module._FPDFText_LoadPage(pagePtr);
    if (!textPage) {
      throw new Error('Failed to load text page');
    }

    try {
      // Convert screen coordinates to PDF coordinates
      const count = this.module._FPDFText_GetBoundedText(textPage, left, top, right, bottom, null, 0);

      if (count <= 0) return '';

      const bufferLength = (count + 1) * 2;
      const buffer = this.module._malloc(bufferLength);
      if (!buffer) {
        throw new Error('Failed to allocate text buffer');
      }

      try {
        const length = this.module._FPDFText_GetBoundedText(textPage, left, top, right, bottom, buffer, count);

        if (length <= 0) return '';

        const array = new Uint16Array(this.module.HEAPU8.buffer, buffer, length);
        return String.fromCharCode(...array);
      } finally {
        this.module._free(buffer);
      }
    } finally {
      this.module._FPDFText_ClosePage(textPage);
    }
  }

  private getCharacterAtPosition(pagePtr: number, x: number, y: number): number {
    const textPage = this.module._FPDFText_LoadPage(pagePtr);
    if (!textPage) throw new Error('Failed to load text page');

    try {
      const pageHeight = this.module._FPDF_GetPageHeight(pagePtr);
      const pdfY = pageHeight - y; // Flip Y coordinate

      // console.debug('GetCharIndexAtPos input:', { x, y, pdfY, pageHeight });

      const charIndex = this.module._FPDFText_GetCharIndexAtPos(
        textPage,
        x,
        pdfY,
        5, // Reduced tolerance
        5, // Reduced tolerance
      );

      // console.debug('GetCharIndexAtPos result:', charIndex);
      return charIndex;
    } finally {
      this.module._FPDFText_ClosePage(textPage);
    }
  }

  private getLineMetrics(textPage: number, charIndex: number) {
    const fontSize = this.module._FPDFText_GetFontSize(textPage, charIndex);
    // Standard line height is typically 1.2x font size
    const lineHeight = fontSize * 1.2;
    return { fontSize, lineHeight };
  }

  private getCharacterBounds(
    pagePtr: number,
    index: number,
  ): { left: number; right: number; top: number; bottom: number; lineHeight: number } | null {
    const textPage = this.module._FPDFText_LoadPage(pagePtr);
    if (!textPage) throw new Error('Failed to load text page');

    try {
      // Get line metrics first
      const { lineHeight } = this.getLineMetrics(textPage, index);

      const left = this.module._malloc(8);
      const top = this.module._malloc(8);
      const right = this.module._malloc(8);
      const bottom = this.module._malloc(8);

      try {
        const result = this.module._FPDFText_GetCharBox(textPage, index, left, right, bottom, top);
        if (result === 0) return null;

        const l = new Float64Array(this.module.HEAPU8.buffer, left, 1)[0];
        const t = new Float64Array(this.module.HEAPU8.buffer, top, 1)[0];
        const r = new Float64Array(this.module.HEAPU8.buffer, right, 1)[0];
        const b = new Float64Array(this.module.HEAPU8.buffer, bottom, 1)[0];

        if (!isFinite(l) || !isFinite(r) || !isFinite(t) || !isFinite(b)) return null;

        const pageHeight = this.module._FPDF_GetPageHeight(pagePtr);

        return {
          left: l,
          right: r,
          top: pageHeight - t,
          bottom: pageHeight - b,
          lineHeight,
        };
      } finally {
        this.module._free(left);
        this.module._free(top);
        this.module._free(right);
        this.module._free(bottom);
      }
    } finally {
      this.module._FPDFText_ClosePage(textPage);
    }
  }

  private getTextRange(pagePtr: number, startIndex: number, endIndex: number): string {
    // Load text page first
    const textPage = this.module._FPDFText_LoadPage(pagePtr);
    if (!textPage) {
      throw new Error('Failed to load text page');
    }

    try {
      const length = endIndex - startIndex + 1;
      const buffer = this.module._malloc((length + 1) * 2);

      try {
        const count = this.module._FPDFText_GetText(textPage, startIndex, length, buffer);
        if (count <= 0) return '';

        const array = new Uint16Array(this.module.HEAPU8.buffer, buffer, count);
        return String.fromCharCode(...array);
      } finally {
        this.module._free(buffer);
      }
    } finally {
      this.module._FPDFText_ClosePage(textPage);
    }
  }

  private getCharacterAt(textPage: number, index: number): string {
    const buffer = this.module._malloc(4);
    try {
      const length = this.module._FPDFText_GetText(textPage, index, 1, buffer);
      if (length <= 0) return '';

      const array = new Uint16Array(this.module.HEAPU8.buffer, buffer, 1);
      const char = String.fromCharCode(array[0]);
      // console.debug('Character at', index, ':', {
      //   char,
      //   code: array[0],
      //   hex: '0x' + array[0].toString(16)
      // });
      return char;
    } finally {
      this.module._free(buffer);
    }
  }
}
