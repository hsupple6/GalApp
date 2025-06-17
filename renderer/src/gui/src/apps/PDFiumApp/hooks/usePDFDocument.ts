import { useEffect,useState } from 'react';

import { initPDFium } from '../lib/pdfium-wasm';
import type { PDFDocument } from '../lib/pdfium-wasm/types';

export function usePDFDocument(url: string) {
  const [document, setDocument] = useState<PDFDocument | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadDocument = async () => {
      try {
        setIsLoading(true);
        
        // First fetch the URL
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        
        const pdfium = await initPDFium();
        const doc = await pdfium.loadDocument(new Uint8Array(arrayBuffer));
        
        if (mounted) {
          setDocument(doc);
          setError(null);
        }
      } catch (err) {
        console.error('Error loading PDF:', err);
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Failed to load PDF'));
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    loadDocument();

    return () => {
      mounted = false;
      if (document) {
        document.destroy();
      }
    };
  }, [url]);

  return { document, error, isLoading };
} 