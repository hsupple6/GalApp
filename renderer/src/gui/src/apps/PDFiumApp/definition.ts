import { AppDefinition } from '../../types/apps';

// These events should match the APP_ACTIONS registry
export const PDF_EVENTS = {
  OPEN: 'PDF_OPEN',
  ZOOM_IN: 'PDF_ZOOM_IN',
  ZOOM_OUT: 'PDF_ZOOM_OUT',
  RESET_ZOOM: 'PDF_RESET_ZOOM',
  SELECT_TEXT: 'PDF_SELECT_TEXT',
  CLEAR_SELECTION: 'PDF_CLEAR_SELECTION',
  EXTRACT_TEXT: 'PDF_EXTRACT_TEXT',
} as const;

export const PDFiumAppDefinition: AppDefinition = {
  appId: 'pdfium', // KEY FIELD .... gets consumed in the front-end
  name: 'PDF Viewer',
  version: '1.0.0',
  description: 'View and annotate PDF files',
  supportedFileTypes: ['.pdf'],
  events: PDF_EVENTS,
  entityTypes: ['PDF', 'File'],
  component: 'PDFiumApp',
  requiresProps: false,
  requiresEntity: true,
  actions: {
    open: {
      name: 'Open PDF',
      description: 'Open a PDF file',
    },
    zoomIn: {
      name: 'Zoom In',
      description: 'Zoom in on the PDF',
    },
    zoomOut: {
      name: 'Zoom Out',
      description: 'Zoom out on the PDF',
    },
    resetZoom: {
      name: 'Reset Zoom',
      description: 'Reset the zoom level of the PDF',
    },
    selectText: {
      name: 'Select Text',
      description: 'Select text in the PDF',
    },
    clearSelection: {
      name: 'Clear Selection',
      description: 'Clear the selection in the PDF',
    },
    extractText: {
      name: 'Extract Text',
      description: 'Extract text from the PDF',
    },
  },
};
