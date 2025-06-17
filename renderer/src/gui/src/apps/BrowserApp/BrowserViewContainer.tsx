import React, { useEffect, useRef } from 'react';

interface BrowserViewContainerProps {
  browserView: any;
}

const BrowserViewContainer: React.FC<BrowserViewContainerProps> = ({ browserView }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!browserView || !containerRef.current) return;

    const container = containerRef.current;
    const bounds = container.getBoundingClientRect();
    
    browserView.setBounds({ 
      x: Math.round(bounds.x), 
      y: Math.round(bounds.y), 
      width: Math.round(bounds.width), 
      height: Math.round(bounds.height) 
    });

    const resizeObserver = new ResizeObserver(() => {
      const newBounds = container.getBoundingClientRect();
      browserView.setBounds({ 
        x: Math.round(newBounds.x), 
        y: Math.round(newBounds.y), 
        width: Math.round(newBounds.width), 
        height: Math.round(newBounds.height) 
      });
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [browserView]);

  return (
    <div 
      ref={containerRef} 
      className="browser-view-container"
      style={{ 
        width: '100%', 
        height: '100%',
        position: 'relative'
      }} 
    />
  );
};

export default BrowserViewContainer; 