import { ImageViewerAppDefinition } from '../apps/ImageViewerApp/definition';
import { NotesAppDefinition } from '../apps/NotesApp/definition';
import { PDFiumAppDefinition } from '../apps/PDFiumApp/definition';
import { WebDocumentAppDefinition } from '../apps/WebDocumentApp/definition';
import { AppDefinition, StoredAppDefinition } from '../types/apps';
import { API_BASE_URL } from '../api/config';
import fetchService from './fetchService';
import { DocsAppDefinition } from 'apps/DocsApp/definition';
import { logger } from '../utils/logger';

const SYSTEM_APPS = [
  PDFiumAppDefinition,
  NotesAppDefinition,
  WebDocumentAppDefinition,
  ImageViewerAppDefinition,
  {
    appId: 'system',
    name: 'Entity Browser',
    version: '1.0.0',
    description: 'Browse and manage your files and documents',
    events: {},
    entityTypes: [],
    component: 'EntityBrowserApp',
    requiresProps: true,
    requiresEntity: false,
    actions: {},
  },
  {
    appId: 'chat',
    name: 'Chat',
    version: '1.0.0',
    description: 'Chat with AI assistant',
    events: {},
    entityTypes: [],
    component: 'ChatApp',
    requiresProps: false,
    requiresEntity: false,
    actions: {},
  },
  DocsAppDefinition,
];

class AppService {
  private apps: Map<string, StoredAppDefinition> = new Map();

  async initialize() {
    const apps: StoredAppDefinition[] = await fetchService(`${API_BASE_URL}/apps`);
    apps.forEach((app) => {
      this.apps.set(app.skeleton.appId, app);
    });
  }

  async installApp(appDefinition: AppDefinition) {
    const storedApp: Partial<StoredAppDefinition> = {
      entityType: 'App',
      skeleton: appDefinition,
    };

    const installedApp: StoredAppDefinition = await fetchService(`${API_BASE_URL}/apps/install`, {
      method: 'POST',
      body: JSON.stringify(storedApp),
    });

    this.apps.set(installedApp.skeleton.appId, installedApp);
    return installedApp;
  }

  async uninstallApp(appId: string) {
    await fetchService(`${API_BASE_URL}/apps/${appId}/uninstall`, {
      method: 'POST',
    });

    this.apps.delete(appId);
  }

  getInstalledApps(): AppDefinition[] {
    return Array.from(this.apps.values()).map((app) => app.skeleton);
  }

  getApp(appId: string): StoredAppDefinition | undefined {
    return this.apps.get(appId);
  }

  async initializeSystemApps() {
    const installedApps = await this.getInstalledApps();
    const installedAppIds = new Set(installedApps.map((app) => app.appId));

    for (const app of SYSTEM_APPS) {
      if (!installedAppIds.has(app.appId)) {
        try {
          await this.installApp(app);
          logger.debug(`Installed system app: ${app.name}`);
        } catch (error) {
          logger.error(`Failed to install system app ${app.name}:`, error);
        }
      }
    }
  }
}

export const appService = new AppService();
