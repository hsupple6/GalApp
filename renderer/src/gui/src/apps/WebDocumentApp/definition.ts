import { AppDefinition } from '../../types/apps';

export const WEB_DOCUMENT_EVENTS = {
  SCROLL_TO_TOP: 'WEB_SCROLL_TO_TOP',
  SCROLL_TO_BOTTOM: 'WEB_SCROLL_TO_BOTTOM',
  SAVE_PAGE: 'WEB_SAVE_PAGE',
  TOGGLE_READER_MODE: 'WEB_TOGGLE_READER_MODE',
} as const;

export const WebDocumentAppDefinition: AppDefinition = {
  appId: 'webdocument',
  name: 'Web Document',
  icon: '🌎',
  version: '1.0.0',
  description: 'View and save web pages and documents',
  supportedFileTypes: ['.html', '.htm', '.mht', '.mhtml'],
  events: WEB_DOCUMENT_EVENTS,
  entityTypes: ['WebDocument'],
  component: 'WebDocumentApp',
  requiresProps: false,
  requiresEntity: true,
  actions: {
    scrollToTop: {
      name: 'Scroll to Top',
      description: 'Scroll to the top of the page',
    },
    scrollToBottom: {
      name: 'Scroll to Bottom',
      description: 'Scroll to the bottom of the page',
    },
    savePage: {
      name: 'Save Page',
      description: 'Save the current page',
    },
    toggleReaderMode: {
      name: 'Toggle Reader Mode',
      description: 'Toggle the reader mode of the page',
    },
  },
};
