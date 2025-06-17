import { AppDefinition } from '../../types/apps';

// These events should match the APP_ACTIONS registry
export const IMAGE_EVENTS = {
  OPEN: 'IMAGE_OPEN',
  ZOOM_IN: 'IMAGE_ZOOM_IN',
  ZOOM_OUT: 'IMAGE_ZOOM_OUT',
  RESET_ZOOM: 'IMAGE_RESET_ZOOM',
  ROTATE_LEFT: 'IMAGE_ROTATE_LEFT',
  ROTATE_RIGHT: 'IMAGE_ROTATE_RIGHT',
} as const;

export const ImageViewerAppDefinition: AppDefinition = {
  appId: 'imageviewer',
  name: 'Image Viewer',
  version: '1.0.0',
  description: 'View and interact with images',
  supportedFileTypes: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'],
  events: IMAGE_EVENTS,
  entityTypes: ['Image'],
  component: 'ImageViewerApp',
  requiresProps: false,
  requiresEntity: true,
  actions: {
    open: {
      name: 'Open Image',
      description: 'Open an image in the image viewer',
    },
    zoomIn: {
      name: 'Zoom In',
      description: 'Zoom in on the image',
    },
    zoomOut: {
      name: 'Zoom Out',
      description: 'Zoom out on the image',
    },
    resetZoom: {
      name: 'Reset Zoom',
      description: 'Reset the zoom level of the image',
    },
    rotateLeft: {
      name: 'Rotate Left',
      description: 'Rotate the image to the left',
    },
    rotateRight: {
      name: 'Rotate Right',
      description: 'Rotate the image to the right',
    },
  },
};
