import './ImageViewerApp.scss';

import React, { useMemo, useState } from 'react';

import { useCustomEventListener } from '../../services/actionService';
import { useFileService } from '../../services/FileService';
import { ImageRenderer } from './components/ImageRenderer';
import { IMAGE_EVENTS } from './definition';
import { FILES_ENDPOINTS } from '../../endpoints';

export interface ImageViewerAppProps {
  title: string;
  onClose: () => void;
  entity: {
    _id: string;
    name: string;
    type: string;
    entityType: string;
  };
}

export const ImageViewerApp: React.FC<ImageViewerAppProps> = ({ entity }) => {
  // const [imageData, setImageData] = useState<string | null>(null);
  const [scale, setScale] = useState(1.0);
  const [rotation, setRotation] = useState(0);
  // const [loading, setLoading] = useState(true);
  // const [error, setError] = useState<string | null>(null);
  const fileService = useFileService();

  // useEffect(() => {
  //   const loadImage = async () => {
  //     try {
  //       setLoading(true);
  //       setError(null);
  //
  //       const fileData = null;
  //
  //       console.log('>>>> fileData: ', fileData);
  //
  //       if (!fileData) {
  //         throw new Error('Failed to load image data');
  //       }
  //
  //       // Convert array buffer to base64 string
  //       const blob = new Blob([fileData]);
  //       const reader = new FileReader();
  //       reader.onloadend = () => {
  //         setImageData(reader.result as string);
  //         setLoading(false);
  //       };
  //       reader.readAsDataURL(blob);
  //     } catch (error) {
  //       console.error('Error loading image:', error);
  //       setError(error instanceof Error ? error.message : 'Failed to load image');
  //       setLoading(false);
  //     }
  //   };
  //
  //   if (entity?._id) {
  //     loadImage();
  //   }
  // }, [entity, fileService]);

  // Listen for events
  useCustomEventListener(IMAGE_EVENTS.ZOOM_IN, () => handleScaleChange(scale * 1.1));
  useCustomEventListener(IMAGE_EVENTS.ZOOM_OUT, () => handleScaleChange(scale / 1.1));
  useCustomEventListener(IMAGE_EVENTS.RESET_ZOOM, () => handleScaleChange(1.0));
  useCustomEventListener(IMAGE_EVENTS.ROTATE_LEFT, () => setRotation((prev) => (prev - 90) % 360));
  useCustomEventListener(IMAGE_EVENTS.ROTATE_RIGHT, () => setRotation((prev) => (prev + 90) % 360));

  const handleScaleChange = (newScale: number) => {
    setScale(Math.max(0.1, Math.min(100.0, newScale))); // Limit scale between 0.1x and 5x
  };

  const imageUrl = useMemo(() => 
    entity?._id ? FILES_ENDPOINTS.read(entity._id) : '', 
    [entity?._id]
  );

  // Add a check for missing entity
  if (!entity || !entity._id) {
    return <div className="image-error">No image to display. Missing entity data.</div>;
  }

  // if (loading) {
  //   return <div className="image-loading">Loading image...</div>;
  // }
  //
  // if (error) {
  //   return <div className="image-error">{error}</div>;
  // }

  return (
    <div className="image-viewer-app">
      <div className="image-container">
        <ImageRenderer imageUrl={imageUrl as string} scale={scale} setScale={setScale} rotation={rotation} />
      </div>
      <div className="image-toolbar">
        <button onClick={() => handleScaleChange(scale * 1.1)}>Zoom In</button>
        <button onClick={() => handleScaleChange(scale / 1.1)}>Zoom Out</button>
        <button onClick={() => handleScaleChange(1.0)}>Reset Zoom</button>
        <span>{Math.round(scale * 100)}%</span>
        <button onClick={() => setRotation((prev) => (prev - 90) % 360)}>Rotate Left</button>
        <button onClick={() => setRotation((prev) => (prev + 90) % 360)}>Rotate Right</button>
      </div>
    </div>
  );
};
