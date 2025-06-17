// import init, { PDFEngine } from './pkg';

// const PDFEngine = function (){} as any;

// TODO: temporary replace missing PDFEngine with dummy class
class PDFEngine {
  constructor(id: string) {
  }

  load_document(buffer: any) {
  }

  render_page(page: number, transform: Float32Array) {
  }

  free() {
  }
}


export { PDFEngine };

// Initialize WASM module
// init().catch(console.error);
