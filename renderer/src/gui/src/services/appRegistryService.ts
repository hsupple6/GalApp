import { BrowserAppDefinition } from 'apps/BrowserApp/definition';
import { ImageViewerAppDefinition } from 'apps/ImageViewerApp/definition';
import { SettingsAppDefinition } from 'apps/SettingsApp/definition';

import { EntityBrowserAppDefinition } from '../apps/EntityBrowserApp/definition';
import { FinderAppDefinition } from '../apps/FinderApp/definition';
import { NotesAppDefinition } from '../apps/NotesApp/definition';
import { PDFiumAppDefinition } from '../apps/PDFiumApp/definition';
import { WebDocumentAppDefinition } from '../apps/WebDocumentApp/definition';
import { PersonalModelAppDefinition } from '../apps/PersonalModelApp/definition';
import { NeurvanaAppDefinition } from '../apps/Neurvana2App/definition';
import { GalideAppDefinition } from '../apps/GalideApp/definition';
import { AppDefinition, StoredAppDefinition } from '../types/apps';

import { API_BASE_URL } from '../api/config';
import fetchService from './fetchService';
import { DocsAppDefinition } from 'apps/DocsApp/definition';
const SYSTEM_APPS = [
  PDFiumAppDefinition,
  NotesAppDefinition,
  WebDocumentAppDefinition,
  EntityBrowserAppDefinition,
  BrowserAppDefinition,
  SettingsAppDefinition,
  ImageViewerAppDefinition,
  FinderAppDefinition,
  PersonalModelAppDefinition,
  NeurvanaAppDefinition,
  GalideAppDefinition,
  DocsAppDefinition,
  // TODO: Add other system apps
];

class AppRegistryService {
  private apps: Map<string, StoredAppDefinition> = new Map();
  private initialized = false;

  async initialize() {
    try {
      console.debug('[AppRegistry] Initializing...');
      const rawData = await fetchService(`${API_BASE_URL}/apps`);

      console.debug('[AppRegistry] Raw response:', rawData);

      // Ensure we have an array
      const apps = Array.isArray(rawData) ? rawData : [rawData];

      // Transform raw MongoDB docs into StoredAppDefinition with defensive checks
      const storedApps = apps
        .map((app) => {
          if (!app) {
            console.warn('[AppRegistry] Received null/undefined app');
            return null;
          }

          console.debug('[AppRegistry] Processing app:', app);
          return {
            ...app,
            _id: app._id?.toString() || 'unknown',
            created_at: app.created_at ? new Date(app.created_at).toISOString() : new Date().toISOString(),
            updated_at: app.updated_at ? new Date(app.updated_at).toISOString() : new Date().toISOString(),
          };
        })
        .filter(Boolean); // Remove any null entries

      console.debug('[AppRegistry] Processed apps:', storedApps);
      storedApps.forEach((app) => {
        if (app?.skeleton?.appId) {
          this.apps.set(app.skeleton.appId, app);
        } else {
          console.warn('[AppRegistry] App missing required fields:', app);
        }
      });
    } catch (error) {
      console.error('[AppRegistry] Failed to initialize:', error);
      throw error;
    }
  }

  async installApp(appDefinition: AppDefinition) {
    console.debug('[AppRegistry] Installing app:', appDefinition);
    const appEntity: Partial<StoredAppDefinition> = {
      entityType: 'App',
      skeleton: appDefinition,
    };

    // Use the correct endpoint
    const installedApp: StoredAppDefinition = await fetchService(`${API_BASE_URL}/apps`, {
      method: 'POST',
      body: JSON.stringify(appEntity),
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

  async getInstalledApps(): Promise<AppDefinition[]> {
    const apps: StoredAppDefinition[] = await fetchService(`${API_BASE_URL}/apps`);
    // Update local map
    apps.forEach((app) => this.apps.set(app.skeleton.appId, app));
    return apps.map((app) => app.skeleton);
  }

  getAllAppsEvents(): Record<string, string> {
    const events = {};
    this.apps.forEach((app) => {
      if (app.skeleton?.events) {
        Object.assign(events, app.skeleton.events);
      }
    });
    return events;
  }

  async verifySystemApps() {
    console.debug('[AppRegistry] Verifying system apps...');

    // Get list of required system app IDs
    const systemAppIds = SYSTEM_APPS.map((app) => app.appId);

    let results;

    try {
      results = await fetchService(`${API_BASE_URL}/apps/verify-system-apps`, {
        method: 'POST',
        body: JSON.stringify({ systemAppIds }),
      });
    } catch (error) {
      window.location.href = '/login';
      return;
    }

    console.debug('[AppRegistry] System apps verification:', results);

    // Install any missing apps
    if (results.missing.length > 0) {
      console.debug(`[AppRegistry] Installing ${results.missing.length} missing system apps...`);
      for (const appId of results.missing) {
        const appDef = SYSTEM_APPS.find((app) => app.appId === appId);
        if (appDef) {
          try {
            await this.installApp(appDef);
            console.debug(`[AppRegistry] Installed system app: ${appDef.name}`);
          } catch (error) {
            console.error(`Failed to install system app ${appDef.name}:`, error);
          }
        }
      }
    }

    return results;
  }

  async initializeSystemApps() {
    if (this.initialized) {
      console.debug('[AppRegistry] System apps already initialized');
      return;
    }

    await this.verifySystemApps();
    this.initialized = true;
  }
}

export const appRegistry = new AppRegistryService();
