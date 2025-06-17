import SettingsApp from 'apps/SettingsApp/SettingsApp';
import WebDocumentApp from 'apps/WebDocumentApp/WebDocumentApp';
import React from 'react';
import { create } from "zustand";

import BrowserApp from '../apps/BrowserApp/BrowserApp';
// Import all possible app components statically
import EntityBrowserApp from "../apps/EntityBrowserApp/EntityBrowserApp";
import FinderApp from '../apps/FinderApp/FinderApp';
import { ImageViewerApp } from '../apps/ImageViewerApp/ImageViewerApp';
import NotesApp from "../apps/NotesApp/components/NotesApp";
import { PDFiumApp } from "../apps/PDFiumApp/PDFiumApp";
import { PersonalModelApp } from '../apps/PersonalModelApp';
import NeurvanaApp from '../apps/Neurvana2App/components/NeurvanaApp';
import GalideApp from '../apps/GalideApp/components/GalideApp';
import { appRegistry } from '../services/appRegistryService';
import type { AppDefinition, StoredAppDefinition } from '../types/apps';
import DocsApp from 'apps/DocsApp/components/DocsApp';
// Static component map - use consistent appIds
const componentMap: Record<string, React.ComponentType<any>> = {
  pdfium: PDFiumApp,
  notes: NotesApp,
  entityBrowser: EntityBrowserApp,
  webdocument: WebDocumentApp,
  settings: SettingsApp,
  browser: BrowserApp,
  imageviewer: ImageViewerApp,
  finder: FinderApp,
  personalModels: PersonalModelApp,
  neurvana: NeurvanaApp,
  galide: GalideApp,
  docs: DocsApp,
};

type AppInfo = {
  appId: string;
  name: string;
  icon?: string;
  description?: string;
  requiresProps?: boolean;
  requiresEntity?: boolean;
};

interface AppRegistryState {
  apps: Record<string, StoredAppDefinition>;
  componentMap: Record<string, React.ComponentType<any>>;
  initializeApps: () => Promise<void>;
}

export const useAppRegistryStore = create<AppRegistryState>((set) => ({
  apps: {},
  componentMap,
  initializeApps: async () => {
    try {
      const installedApps = await appRegistry.getInstalledApps();

      const formattedApps = installedApps.reduce<Record<string, StoredAppDefinition>>((acc, app: AppDefinition) => {
        acc[app.appId] = {
          _id: '', // Required by StoredAppDefinition
          entityType: 'App',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          skeleton: app,
        };
        return acc;
      }, {});

      set({ apps: formattedApps });
    } catch (error) {
      console.error('Failed to initialize apps:', error);
    }
  },
}));
