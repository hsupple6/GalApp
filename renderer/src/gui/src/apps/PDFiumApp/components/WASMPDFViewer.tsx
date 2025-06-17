// src/apps/pdf/components/WASMPDFViewer.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { PDFEngine } from '../../../engines/pdf';

interface Props {
  pdfData?: ArrayBuffer;
}

const handleError = (err: unknown) => {
  console.error('Error:', err);
  return err instanceof Error ? err.message : String(err);
};

export const WASMPDFViewer: React.FC<Props> = ({ pdfData }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<PDFEngine | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('');

  const renderPDF = useCallback(() => {
    if (!canvasRef.current || !pdfData) return;

    try {
      console.debug('Creating PDF Engine...');
      const engine = new PDFEngine(canvasRef.current!.id);
      engineRef.current = engine;

      engine.load_document(new Uint8Array(pdfData));
      console.debug('PDF loaded, rendering first page');

      const transform = new Float32Array([
        1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0,
      ]);

      engine.render_page(1, transform);
      setDebugInfo('PDF rendered successfully');
    } catch (err: unknown) {
      setError(handleError(err));
    }
  }, [pdfData]);

  useEffect(() => {
    renderPDF();
    return () => {
      if (engineRef.current) {
        engineRef.current.free();
        engineRef.current = null;
      }
    };
  }, []);

  return (
    <div className="pdf-viewer">
      <canvas
        ref={canvasRef}
        id="pdf-canvas"
        width={window.innerWidth - 40}
        height={window.innerHeight - 40}
        style={{
          border: '1px solid #ccc',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          backgroundColor: 'white',
          margin: '20px',
        }}
      />
      {error && <div className="error">{error}</div>}
    </div>
  );
};

export default WASMPDFViewer;
