import React, { useEffect, useRef, useState } from 'react';

interface ImageRendererProps {
  imageUrl: string;
  scale: number;
  setScale: React.Dispatch<React.SetStateAction<number>>;
  rotation: number;
}

export const ImageRenderer: React.FC<ImageRendererProps> = ({ imageUrl, scale, setScale, rotation }) => {
  const [width, setWidth] = useState(1);
  const [height, setHeight] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const image = imageRef.current;
    const container = containerRef.current;
    if (!image || !container) return;

    const updateImageSize = () => {
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;

      // Reset image size to get natural dimensions
      image.style.width = '';
      image.style.height = '';

      const imgWidth = image.naturalWidth;
      const imgHeight = image.naturalHeight;

      setWidth(imgWidth);
      setHeight(imgHeight);

      // Calculate scale to fit image within container
      const scaleX = containerWidth / imgWidth;
      const scaleY = containerHeight / imgHeight;
      const baseScale = Math.min(scaleX, scaleY, 1); // Don't scale up images larger than natural size

      // Apply scale and rotation
      image.style.transform = `rotate(${rotation}deg) scale(${baseScale})`;
      setScale(baseScale);
    };

    // Update size when image loads
    image.onload = updateImageSize;

    // Update size when container resizes
    const resizeObserver = new ResizeObserver(updateImageSize);
    resizeObserver.observe(container);

    // Initial update
    updateImageSize();

    return () => {
      resizeObserver.disconnect();
    };
  }, [imageUrl, rotation, setScale]);

  useEffect(() => {
    const image = imageRef.current;

    if (!image || !image?.style?.transform) return;

    image.style.transform = `rotate(${rotation}deg) scale(${scale})`;
  }, [rotation, scale]);

  return (
    <div ref={containerRef} className="image-renderer">
      <img
        ref={imageRef}
        src={imageUrl}
        alt="Viewer"
        style={{
          width: `${width}px`,
          height: `${height}px`,
          transformOrigin: 'center center',
          transition: 'transform 0.2s ease-out',
        }}
      />
    </div>
  );
};
