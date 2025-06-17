import DocsApp from 'apps/DocsApp/components/DocsApp';
import BrowserApp from './apps/BrowserApp/BrowserApp';
import ChatApp from './apps/ChatApp/ChatApp';
import ConsoleApp from './apps/ConsoleApp';
import EntityBrowser from './apps/EntityBrowserApp/EntityBrowserApp';
import FinderApp from './apps/FinderApp/FinderApp';
import { ImageViewerApp } from './apps/ImageViewerApp/ImageViewerApp';
import Notes from './apps/NotesApp/components/NotesApp';
import { PDFiumApp } from './apps/PDFiumApp/PDFiumApp';
import SettingsApp from './apps/SettingsApp/SettingsApp';
import WebDocumentApp from './apps/WebDocumentApp/WebDocumentApp';
import NeurvanaApp from './apps/Neurvana2App/components/NeurvanaApp';

export const AppRegistry: {
  [key: string]: { component: React.ComponentType<any>; title: string };
} = {
  system: {
    component: EntityBrowser,
    title: 'Entity Browser',
  },
  chat: {
    component: ChatApp,
    title: 'Chat',
  },
  console: { component: ConsoleApp, title: 'Console' },
  browser: { component: BrowserApp, title: 'Browser' },
  imageviewer: { component: ImageViewerApp, title: 'Image Viewer' },
  pdfium: { component: PDFiumApp, title: 'PDFium Viewer' },
  notes: {
    component: Notes,
    title: 'Notes',
  },
  docs: {
    component: DocsApp,
    title: 'Docs',
  },
  webdoc: {
    component: WebDocumentApp,
    title: 'Web Document',
  },
  settings: {
    component: SettingsApp,
    title: 'Settings',
  },
  finder: {
    component: FinderApp,
    title: 'Finder',
  },
  neurvana: {
    component: NeurvanaApp,
    title: 'Neurvana',
  },
};
