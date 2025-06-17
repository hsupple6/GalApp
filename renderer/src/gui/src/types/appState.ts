/**
 * Types for application state used in window entities
 */

// DocsApp state
export interface DocsRecentDoc {
  docId: string;
  name: string;
}

export interface DocsAppState {
  // Core properties
  activeDocId?: string;
  content?: string;
  recentDocs?: DocsRecentDoc[];
  
  // Extended properties
  currentDocName?: string;
  currentState?: 'editing' | 'overview';
}

// Generic application state interface
export interface ApplicationState {
  docs?: DocsAppState;
  // Add other app states as needed
  // terminal?: TerminalAppState;
  // browser?: BrowserAppState;
  // etc.
}

// Window with application state - includes common window properties
export interface WindowWithApplicationState {
  id?: string;
  windowId?: string;
  name?: string;
  title?: string;
  appType?: string;
  type?: string;
  skeleton?: {
    name?: string;
    type?: string;
    [key: string]: any;
  };
  applicationState?: ApplicationState;
  [key: string]: any; // Allow other window properties
} 