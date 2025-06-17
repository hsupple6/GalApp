import { SpaceEntity, UISpace, ACLEntry, ACLEntryWithUser } from '../types/spaces';
import { AnyWindowEntity } from '../types/windows';
import fetchService from './fetchService';
import { API_BASE_URL } from '../api/config';
import { logger } from '../utils/logger';

export class SpaceService {
  private baseUrl = `${API_BASE_URL}/spaces`;

  private getAuthHeaders() {
    const authToken = localStorage.getItem('authToken');
    return {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    };
  }

  async fetchSpace(id: string): Promise<UISpace> {
    const space: SpaceEntity = await fetchService(`${this.baseUrl}/${id}`, {
      credentials: 'include',
    });
    return this.toUISpace(space);
  }

  async updateSpace(id: string, windows: Record<string, AnyWindowEntity>, settings: any): Promise<UISpace> {
    logger.log('[SpaceService] Updating space:', { id, windowCount: Object.keys(windows).length });
    
    try {
      // Clean up the windows object - remove any incomplete window entries
      const cleanedWindows = this.cleanupWindowsObject(windows);
      
      // Directly update the space
      const space: SpaceEntity = await fetchService(`${this.baseUrl}/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ windows: cleanedWindows, settings }),
        credentials: 'include',
      });
      
      return this.toUISpace(space);
    } catch (error) {
      logger.error('[SpaceService] Error updating space:', error);
      // Don't rethrow - just log and return original data
      // This prevents errors from propagating to UI and breaking the experience
      return {
        id: id,
        name: 'Space',
        windows: windows,
        settings: settings,
        created: new Date(),
        updated: new Date(),
      };
    }
  }

  // Helper method to clean up the windows object before saving to backend
  private cleanupWindowsObject(windows: Record<string, AnyWindowEntity>): Record<string, AnyWindowEntity> {
    logger.log('[SpaceService] Cleaning up windows object, before:', Object.keys(windows).length);
    
    // Filter out incomplete window entries (ghost windows)
    const cleanedWindows: Record<string, AnyWindowEntity> = {};
    
    Object.entries(windows).forEach(([windowId, window]) => {
      // Check if this is a valid, complete window
      // A valid window should have at least id, type, position, and size
      if (window && 
          window.id && 
          window.type === 'window' && 
          window.position && 
          window.size) {
        cleanedWindows[windowId] = window;
      } else {
        logger.log(`[SpaceService] Removing incomplete window: ${windowId}`, window);
      }
    });
    
    logger.log('[SpaceService] Cleaning up windows object, after:', Object.keys(cleanedWindows).length);
    return cleanedWindows;
  }

  // New method to clean up ghost windows in an existing space
  async cleanupSpace(id: string): Promise<UISpace> {
    try {
      // First, get the current space data
      const space = await this.getSpace(id);
      if (!space) {
        throw new Error(`Space not found: ${id}`);
      }
      
      // Clean up the windows
      const cleanedWindows = this.cleanupWindowsObject(space.windows);
      
      // Update the space with cleaned windows
      return await this.updateSpace(id, cleanedWindows, space.settings);
    } catch (error) {
      logger.error('[SpaceService] Error cleaning up space:', error);
      throw error;
    }
  }

  private toUISpace(space: SpaceEntity): UISpace {
    logger.log('[SpaceService] Converting space:', space);
    return {
      id: space._id,
      name: space.name,
      windows: space.skeleton.windows,
      settings: space.skeleton.settings,
      created: new Date(space.created_at),
      updated: new Date(space.updated_at),
      acl: space.acl,
    };
  }

  async createSpace(name: string): Promise<UISpace> {
    // Always let the backend generate the ID
    const space: SpaceEntity = await fetchService(`${this.baseUrl}`, {
      method: 'POST',
      body: JSON.stringify({ name }),
      credentials: 'include',
    });
    
    return this.toUISpace(space);
  }

  async getSpace(id: string): Promise<UISpace | null> {
    try {
      return await this.fetchSpace(id);
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  // async updateWindow(windowId: string, updates: Partial<AnyWindowEntity>) {
  //   const space = await this.fetchSpace(windowId.split('-')[0]);
  //   const updatedWindows = space.windows.map((w) =>
  //     w.id === windowId ? ({ ...w, ...updates } as AnyWindowEntity) : w,
  //   );
  //   return this.updateSpace(space.id, updatedWindows as AnyWindowEntity[], space.settings);
  // }

  // TODO: Remove when updates are implemented
  async groupWindows(windowIds: string[], spaceId: string) {
    if (windowIds.length < 2) return;

    // try {
    //   const space = await this.fetchSpace(spaceId);
    //   const firstWindow = space.windows.find(w => w.id === windowIds[0]);
    //   if (!firstWindow) return;

    //   // Convert first window to tabbed window
    //   const updatedWindow: WindowEntity = {
    //     ...firstWindow,
    //     tabs: windowIds,
    //     activeTabId: windowIds[0],
    //     isParentWindow: true
    //   };

    //   // Update windows array
    //   const updatedWindows = space.windows.map(win =>
    //     win.id === firstWindow.id ? updatedWindow : win
    //   );

    //   // Update via CRDT first
    //   spaceCRDTService.updateWindows(spaceId, updatedWindows);

    //   // Then persist to database
    //   return await this.updateSpace(space.id, updatedWindows, space.settings);
    // } catch (error) {
    //   console.error('Error grouping windows:', error);
    //   throw new Error('Failed to group windows');
    // }
  }

  // TODO: Remove when updates are implemented
  async ungroupWindows(windowId: string, spaceId: string) {
    try {
      // const space = await this.fetchSpace(spaceId);
      // const window = space.windows.find(w => w.id === windowId) as WindowEntity;
      // if (!window?.tabs) return;
      // // Remove tab properties
      // const updatedWindow = {
      //   ...window,
      //   tabs: undefined,
      //   activeTabId: undefined,
      //   isParentWindow: undefined
      // };
      // const updatedWindows = space.windows.map(win =>
      //   win.id === windowId ? updatedWindow : win
      // );
      // // Update CRDT
      // spaceCRDTService.updateWindows(spaceId, updatedWindows);
      // return this.updateSpace(space.id, updatedWindows, space.settings);
    } catch (error) {
      console.error('Error ungrouping windows:', error);
      throw new Error('Failed to ungroup windows');
    }
  }

  async fetchRecentSpaces(): Promise<UISpace[]> {
    const spacesData: SpaceEntity[] = await fetchService(`${this.baseUrl}/list`, {
      credentials: 'include',
    });
    
    const spaces = spacesData.map(space => this.toUISpace(space));
    logger.log('[SpaceService] fetchedRecentSpaces', spaces);
    return spaces;
  }

  async fetchRecentSpace(): Promise<UISpace | null> {
    try {
      const space: SpaceEntity = await fetchService(`${this.baseUrl}/recent`, {
        credentials: 'include',
      });
      
      logger.log('[SpaceService] fetchedRecentSpace', space);
      return this.toUISpace(space);
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        logger.log('[SpaceService] No recent space found');
        return null;
      }
      logger.error('[SpaceService] Error fetching recent space:', error);
      throw error;
    }
  }

  async updateSpaceName(spaceId: string, newName: string) {
    try {
      await fetchService(`${this.baseUrl}/${spaceId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: newName }), // Just send name at top level
        credentials: 'include',
      });
      
      return true;
    } catch (error) {
      logger.error('Failed to update space name:', error);
      throw error;
    }
  }

  // NEW ACL METHODS

  async addPermission(spaceId: string, email: string, role: 'owner' | 'editor' | 'viewer' | 'commenter'): Promise<void> {
    try {
      await fetchService(`${this.baseUrl}/${spaceId}/permissions`, {
        method: 'POST',
        body: JSON.stringify({ email, role }),
        credentials: 'include',
      });
    } catch (error) {
      logger.error('[SpaceService] Error adding permission:', error);
      throw error;
    }
  }

  async removePermission(spaceId: string, userAuth0Id: string): Promise<void> {
    try {
      await fetchService(`${this.baseUrl}/${spaceId}/permissions/${userAuth0Id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
    } catch (error) {
      logger.error('[SpaceService] Error removing permission:', error);
      throw error;
    }
  }

  async listPermissions(spaceId: string): Promise<{ permissions: ACLEntryWithUser[] }> {
    try {
      const response = await fetchService(`${this.baseUrl}/${spaceId}/permissions`, {
        credentials: 'include',
      });
      return response;
    } catch (error) {
      logger.error('[SpaceService] Error listing permissions:', error);
      throw error;
    }
  }
}

export const spaceService = new SpaceService();
