import { AppDefinition } from '../../types/apps';

// These events should match the APP_ACTIONS registry
export const BROWSER_EVENTS = {
  OPEN: 'BROWSER_OPEN',
  NAVIGATE: 'BROWSER_NAVIGATE',
  REFRESH: 'BROWSER_REFRESH',
  GO_BACK: 'BROWSER_GO_BACK',
  GO_FORWARD: 'BROWSER_GO_FORWARD',
  CHANGE_URL: 'BROWSER_CHANGE_URL',
} as const;

export const BrowserAppDefinition: AppDefinition = {
  appId: 'browser',
  name: 'Web Browser',
  version: '1.0.0',
  description: 'Browse web pages and online content',
  supportedFileTypes: ['.html', '.htm'],
  events: BROWSER_EVENTS,
  entityTypes: ['Webpage'],
  component: 'BrowserApp',
  requiresProps: false,
  requiresEntity: false,
  actions: {
    open: {
      name: 'Open Browser',
      description: 'Open the web browser',
    },
    navigate: {
      name: 'Navigate',
      description: 'Navigate to a URL',
    },
    refresh: {
      name: 'Refresh',
      description: 'Refresh the current page',
    },
    goBack: {
      name: 'Go Back',
      description: 'Navigate to previous page',
    },
    goForward: {
      name: 'Go Forward',
      description: 'Navigate to next page',
    },
    changeUrl: {
      name: 'Change URL',
      description: 'Change the current URL',
    },
  },
};
