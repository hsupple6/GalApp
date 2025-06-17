import { ActionDefinition } from '../../types/registry';

export const pdfiumAppActions: ActionDefinition[] = [
  {
    actionId: 'zoom_in',
    appId: 'pdfium',
    description: 'Increases the zoom level of the PDF.',
    category: 'app',
    lastUpdated: new Date().toISOString(),
    schema: {
      args: {}
    }
  },
  {
    actionId: 'zoom_out',
    appId: 'pdfium',
    description: 'Decreases the zoom level of the PDF.',
    category: 'app',
    lastUpdated: new Date().toISOString(),
    schema: {
      args: {}
    }
  },
  {
    actionId: 'reset_zoom',
    appId: 'pdfium',
    description: 'Resets the zoom level of the PDF to default.',
    category: 'app',
    lastUpdated: new Date().toISOString(),
    schema: {
      args: {}
    }
  }
]; 