import { ActionDefinition } from '../../types/registry';

export const imageViewerAppActions: ActionDefinition[] = [
  {
    actionId: 'zoom_in',
    appId: 'imageviewer',
    description: 'Increases the zoom level of the image.',
    category: 'app',
    lastUpdated: new Date().toISOString(),
    schema: {
      args: {}
    }
  },
  {
    actionId: 'zoom_out',
    appId: 'imageviewer',
    description: 'Decreases the zoom level of the image.',
    category: 'app',
    lastUpdated: new Date().toISOString(),
    schema: {
      args: {}
    }
  },
  {
    actionId: 'reset_zoom',
    appId: 'imageviewer',
    description: 'Resets the zoom level of the image to default.',
    category: 'app',
    lastUpdated: new Date().toISOString(),
    schema: {
      args: {}
    }
  },
  {
    actionId: 'rotate_left',
    appId: 'imageviewer',
    description: 'Rotates the image 90 degrees counterclockwise.',
    category: 'app',
    lastUpdated: new Date().toISOString(),
    schema: {
      args: {}
    }
  },
  {
    actionId: 'rotate_right',
    appId: 'imageviewer',
    description: 'Rotates the image 90 degrees clockwise.',
    category: 'app',
    lastUpdated: new Date().toISOString(),
    schema: {
      args: {}
    }
  }
]; 