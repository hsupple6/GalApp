import type { PDFiumModule } from './types';
import { PDFiumWrapper } from './wrapper';

let pdfiumPromise: Promise<PDFiumWrapper> | null = null;
let wrapperInstance: PDFiumWrapper | null = null;

async function initializePDFiumModule(): Promise<any> {
  // Get the PDFium module constructor
  const PDFiumModule = (window as any).PDFiumModule;
  if (!PDFiumModule) {
    throw new Error('PDFiumModule not found');
  }

  // Initialize the module
  const module = await PDFiumModule({
    // You can add configuration options here if needed
    locateFile: (path: string) => {
      // Adjust the path to your WASM file
      if (path.endsWith('.wasm')) {
        return `${process.env.PUBLIC_URL}/pdfium-wasm/${path}`;
      }
      return path;
    },
  });

  return module;
}

function waitForPDFiumModule(maxAttempts = 50): Promise<void> {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      attempts++;
      if ((window as any).PDFiumModule) {
        resolve();
      } else if (attempts >= maxAttempts) {
        reject(new Error('PDFiumModule failed to load after multiple attempts'));
      } else {
        setTimeout(check, 100);
      }
    };
    check();
  });
}

export async function initPDFium(): Promise<PDFiumWrapper> {
  // If we already have an instance, return it
  if (wrapperInstance) {
    console.debug('📚 Using existing PDFium wrapper instance');
    return wrapperInstance;
  }

  // If initialization is in progress, wait for it
  if (pdfiumPromise) {
    console.debug('⏳ PDFium initialization in progress, waiting...');
    try {
      wrapperInstance = await pdfiumPromise;
      return wrapperInstance;
    } catch (error) {
      console.error('🚫 Error while waiting for PDFium initialization:', error);
      pdfiumPromise = null; // Reset to allow retry
      throw error;
    }
  }

  // Start new initialization
  console.debug('🏁 Starting new PDFium initialization...');
  pdfiumPromise = new Promise(async (resolve, reject) => {
    try {
      console.debug('⌛ Waiting for PDFium module to load...');
      await waitForPDFiumModule();

      console.debug('⌛ Initializing PDFium module...');
      const module = await initializePDFiumModule();

      console.debug('PDFium module:', {
        type: typeof module,
        methods: Object.keys(module || {}),
        instance: module,
      });

      if (!module) {
        throw new Error('PDFium module initialization failed');
      }

      wrapperInstance = new PDFiumWrapper(module);
      console.debug('🎉 PDFium wrapper created successfully');
      resolve(wrapperInstance);
    } catch (error) {
      console.error('💥 PDFium initialization failed:', error);
      pdfiumPromise = null;
      wrapperInstance = null;
      reject(error);
    }
  });

  return pdfiumPromise;
}
