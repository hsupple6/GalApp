import { EntityBrowserAppDefinition } from '../apps/EntityBrowserApp/definition';
import { ImageViewerAppDefinition } from '../apps/ImageViewerApp/definition';
import { NotesAppDefinition } from '../apps/NotesApp/definition';
import { PDFiumAppDefinition } from '../apps/PDFiumApp/definition';
import { WebDocumentAppDefinition } from '../apps/WebDocumentApp/definition';
import { AppDefinition, convertToActionMetadata, StoredAppDefinition } from '../types/apps';
import { ActionDefinition, ActionMetadata, ActionRegistryEntity } from '../types/registry';
import { API_BASE_URL } from '../api/config';
import fetchService from './fetchService';
import { logger } from '../utils/logger';

export class RegistryService {
  private actionRegistry: ActionRegistryEntity | null = null;
  private actionDefinitions: Map<string, ActionDefinition> = new Map();

  private getAuthHeaders() {
    const authToken = localStorage.getItem('authToken');
    return {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    };
  }

  async initialize() {
    try {
      const registryResponse = await fetchService(`${API_BASE_URL}/registry`);

      if (!registryResponse.ok) {
        if (registryResponse.status === 404) {
          await this.initializeDefaultRegistry();
        } else {
          logger.error('Registry error:', await registryResponse.text());
          // Initialize with empty registry rather than throwing
          this.actionRegistry = {
            entityType: 'Registry',
            userId: this.getUserIdFromToken(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            skeleton: {
              id: 'default_registry',
              name: 'Default Registry',
              version: '1.0.0',
              description: 'Default registry',
              actions: {},
            },
          };
        }
      } else {
        this.actionRegistry = await registryResponse.json();
      }

      // Load actions from ES for quick search
      const actionsResponse = await fetchService(`${API_BASE_URL}/registry/actions`);

      if (actionsResponse.ok) {
        const actions = await actionsResponse.json();
        actions.forEach((action: ActionDefinition) => {
          this.actionDefinitions.set(`${action.appId}_${action.actionId}`, action);
        });
      }
    } catch (error) {
      logger.error('Registry initialization error:', error);
      // Initialize with defaults instead of throwing
      this.initializeDefaults();
    }
  }

  private initializeDefaults() {
    this.actionRegistry = {
      entityType: 'Registry',
      userId: this.getUserIdFromToken(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      skeleton: {
        id: 'default_registry',
        name: 'Default Registry',
        version: '1.0.0',
        description: 'Default registry',
        actions: {},
      },
    };
  }

  private getUserIdFromToken(): string {
    const token = localStorage.getItem('authToken');
    if (!token) throw new Error('No auth token found');

    // Decode JWT payload
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.sub;
  }

  private async installAppEntity(appDefinition: AppDefinition): Promise<StoredAppDefinition> {
    const response = await fetch(`${API_BASE_URL}/apps/install`, {
      method: 'POST',
      body: JSON.stringify(appDefinition),
    });

    if (!response.ok) {
      throw new Error(`Failed to install app: ${response.statusText}`);
    }

    return response.json();
  }

  async installApp(appDefinition: AppDefinition) {
    logger.debug(`Installing app ${appDefinition.name}...`);

    // 1. Install the app itself
    const storedApp = await this.installAppEntity(appDefinition);

    // 2. Add app's actions to registry
    if (appDefinition.actions) {
      logger.debug(`Adding actions for ${appDefinition.name}:`, appDefinition.actions);
      const convertedActions = this.convertAppActions(appDefinition);

      await this.syncRegistry({
        ...this.actionRegistry!,
        skeleton: {
          ...this.actionRegistry!.skeleton,
          actions: {
            ...this.actionRegistry!.skeleton.actions,
            ...convertedActions,
          },
        },
      });
    }

    return storedApp;
  }

  private async syncRegistry(registry: Omit<ActionRegistryEntity, '_id'>) {
    // 1. Update MongoDB registry
    await fetchService(`${API_BASE_URL}/registry`, {
      method: 'PUT',
      body: JSON.stringify(registry),
    });

    // 2. Sync all actions to ES
    await this.syncActionsToES(registry.skeleton.actions);
  }

  private async syncActionsToES(actions: Record<string, ActionMetadata>) {
    // Fetch full definitions for each action
    const actionDefinitions = await Promise.all(
      Object.entries(actions).map(async ([id, metadata]) => {
        const definition: ActionDefinition = await fetchService(`${API_BASE_URL}/registry/actions/${id}`);

        return {
          ...definition,
          id: `${metadata.appId}_${id}`,
        };
      }),
    );

    const validDefinitions = actionDefinitions.filter((def) => def !== null);

    await fetchService(`${API_BASE_URL}/registry/actions/sync`, {
      method: 'POST',
      body: JSON.stringify(validDefinitions),
    });
  }

  getRegistryState() {
    return {
      registry: this.actionRegistry,
      actions: Array.from(this.actionDefinitions.values()),
    };
  }

  async getInstalledApps(): Promise<any[]> {
    return fetchService(`${API_BASE_URL}/apps`);
  }

  async getDebugInfo() {
    await this.initialize();
    const state = this.getRegistryState();
    const installedApps = await this.getInstalledApps();

    return {
      registry: state.registry,
      actions: state.actions,
      installedApps,
    };
  }

  async getActionDefinition(actionId: string): Promise<ActionDefinition> {
    // First check cache
    if (this.actionDefinitions.has(actionId)) {
      return this.actionDefinitions.get(actionId)!;
    }

    // Fetch from backend
    const definition = await fetchService(`${API_BASE_URL}/registry/actions/${actionId}`);

    this.actionDefinitions.set(actionId, definition);
    return definition;
  }

  private async createNewRegistry() {
    const userId = this.getUserIdFromToken();
    const newRegistry: Omit<ActionRegistryEntity, '_id'> = {
      entityType: 'Registry',
      userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      skeleton: {
        id: `registry_${userId}`,
        name: 'User Action Registry',
        version: '1.0.0',
        description: 'Registry of all available actions',
        actions: {},
      },
    };

    this.actionRegistry = await fetchService(`${API_BASE_URL}/registry`, {
      method: 'POST',
      body: JSON.stringify(newRegistry),
    });
  }

  private async initializeDefaultRegistry() {
    // First create empty registry and wait for it
    await this.createNewRegistry();

    // Make sure we have a registry before continuing
    if (!this.actionRegistry) {
      throw new Error('Failed to initialize registry');
    }

    logger.debug('Installing core apps...');

    const coreApps = [
      EntityBrowserAppDefinition,
      NotesAppDefinition,
      PDFiumAppDefinition,
      WebDocumentAppDefinition,
      ImageViewerAppDefinition,
    ];

    // Install apps sequentially to avoid race conditions
    for (const app of coreApps) {
      try {
        logger.debug(`Installing ${app.name}...`);
        await this.installApp(app);
      } catch (error) {
        logger.error(`Failed to install ${app.name}:`, error);
      }
    }

    // Verify actions were added
    logger.debug('Final registry state:', this.actionRegistry.skeleton.actions);
  }

  async checkForUpdates() {
    const installedApps = await this.getInstalledApps();

    // Map of app IDs to their latest definitions
    const latestDefs: Record<string, AppDefinition> = {
      entityBrowser: EntityBrowserAppDefinition,
      notes: NotesAppDefinition,
      pdfium: PDFiumAppDefinition,
      webdoc: WebDocumentAppDefinition,
    };

    for (const app of installedApps as AppDefinition[]) {
      const latestDef = latestDefs[app.appId];
      if (latestDef && latestDef.version > app.version) {
        await this.updateApp(app.appId, latestDef);
      }
    }
  }

  async updateApp(appId: string, newDefinition: AppDefinition) {
    // Update app entity
    await fetchService(`${API_BASE_URL}/apps/${appId}`, {
      method: 'PUT',
      body: JSON.stringify(newDefinition),
    });

    // Update registry actions
    if (newDefinition.actions) {
      const convertedActions = this.convertAppActions(newDefinition);

      await this.syncRegistry({
        ...this.actionRegistry!,
        skeleton: {
          ...this.actionRegistry!.skeleton,
          actions: {
            ...this.actionRegistry!.skeleton.actions,
            ...convertedActions,
          },
        },
      });
    }
  }

  private convertAppActions(appDefinition: AppDefinition): Record<string, ActionMetadata> {
    const convertedActions: Record<string, ActionMetadata> = {};

    Object.entries(appDefinition.actions).forEach(([key, action]) => {
      convertedActions[key] = convertToActionMetadata(action, appDefinition.appId);
    });

    return convertedActions;
  }

  async syncAppActions(appDefinition: AppDefinition) {
    const convertedActions = this.convertAppActions(appDefinition);

    await this.syncRegistry({
      ...this.actionRegistry!,
      skeleton: {
        ...this.actionRegistry!.skeleton,
        actions: {
          ...this.actionRegistry!.skeleton.actions,
          ...convertedActions,
        },
      },
    });
  }
}

export const registryService = new RegistryService();
