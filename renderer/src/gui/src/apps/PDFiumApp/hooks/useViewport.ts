import { useCallback,useState } from 'react';

import type { ViewportState } from '../lib/pdfium-wasm/types';

export interface UseViewportOptions {
  initialScale?: number;
}

export function useViewport({ initialScale = 1 }: UseViewportOptions = {}) {
  const [viewport, setViewport] = useState<ViewportState>({
    width: 0,
    height: 0,
    scale: initialScale,
    rotation: 0,
    offsetX: 0,
    offsetY: 0,
    renderMode: 'high-resolution'
  });

  const zoom = useCallback((scale: number) => {
    setViewport(prev => ({
      ...prev,
      scale
    }));
  }, []);

  const pan = useCallback((offsetX: number, offsetY: number) => {
    setViewport(prev => ({
      ...prev,
      offsetX,
      offsetY
    }));
  }, []);

  const rotate = useCallback((degrees: number) => {
    setViewport(prev => ({
      ...prev,
      rotation: ((prev.rotation || 0) + degrees) % 360
    }));
  }, []);

  return {
    viewport,
    zoom,
    pan,
    rotate
  };
} 