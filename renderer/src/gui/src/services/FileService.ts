import { API_BASE_URL } from '../api/config';
import { FILES_ENDPOINTS, PDF_ENDPOINTS, PROJECTS_ENDPOINTS } from '../endpoints';
import { BaseEntityType } from '../types';
import { entityCRDTService } from './crdt/entityCRDTService';
import fetchService from './fetchService';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

export interface EnrichmentStatus {
  status: 'not_started' | 'processing' | 'completed' | 'failed';
  error?: string | null;
}

export interface PdfEnrichmentResult {
  raw_text: string;
  sections: Record<string, string>;
  chunks: any[];
  metadata: any;
  summaries: Record<string, string>;
}

export class FileService {
  async getList(parentEntityId?: string): Promise<BaseEntityType[]> {
    try {
      // Use the projects endpoint for entities when we're in project context
      // Otherwise fallback to the legacy files endpoint
      let endpoint;
      if (parentEntityId && parentEntityId !== 'default') {
        // For project-related entities, use the new projects/entities endpoint
        endpoint = PROJECTS_ENDPOINTS.entities(parentEntityId);
      } else {
        // For default/legacy behavior, use the files/list endpoint
        endpoint = FILES_ENDPOINTS.list(parentEntityId);
      }

      const response = await fetchService(endpoint);

      // Filter out invalid entities before mapping
      return response
        .filter((entity: any) => {
          if (!entity || !entity._id) {
            logger.warn('[FileService] Skipping invalid entity:', entity);
            return false;
          }
          return true;
        })
        .map((entity: any) => {
          // Determine entity type from various possible sources
          const entityType = entity.entityType || entity.type || 'File';

          // Preserve windows for Space entities
          if (entityType === 'Space') {
            return {
              _id: entity._id,
              id: entity._id,
              name: entity.name || 'Untitled!',
              type: entityType.toLowerCase(),
              entityType: entityType,
              created_at: entity.created_at || new Date().toISOString(),
              updated_at: entity.updated_at || new Date().toISOString(),
              skeleton: {
                '@type': entityType,
                ...entity.skeleton, // Keep existing skeleton including windows
              },
            };
          }

          // For File entities, use skeleton.fileName as the primary name source
          const displayName = entityType === 'File' 
            ? (entity.skeleton?.fileName || entity.name || 'Untitled')
            : (entity.name || 'Untitled');

          // Regular mapping for other entities...
          return {
            _id: entity._id,
            id: entity._id,
            name: displayName,
            type: entityType.toLowerCase(),
            entityType: entityType,
            created_at: entity.created_at || new Date().toISOString(),
            updated_at: entity.updated_at || new Date().toISOString(),
            skeleton: {
              '@type': entityType,
              ...(entity.skeleton || {}),
              // Ensure minimal skeleton properties based on type
              ...(entityType === 'File'
                ? {
                    fileId: entity._id,
                    fileName: entity.skeleton?.fileName || entity.name || 'Untitled',
                    groupIds: [],
                    mimeType: entity.mimeType || 'application/octet-stream',
                    size: entity.size || 0,
                  }
                : {}),
              ...(entityType === 'Group'
                ? {
                    childEntities: entity.skeleton?.childEntities || [],
                  }
                : {}),
            },
          };
        });
    } catch (error) {
      logger.error('[FileService] Failed to get list:', error);
      throw error;
    }
  }

  async addFile(file: File, parentEntityId?: string, spaceId: string = 'default'): Promise<BaseEntityType> {
    logger.log('[FileService] Adding file:', { name: file.name, parentId: parentEntityId, spaceId });
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('entityType', 'File');
    
    // Determine the correct endpoint based on whether we're in a project context
    let endpoint;
    if (parentEntityId) {
      // For files being added to a project, use the projects API
      endpoint = PROJECTS_ENDPOINTS.addFile(parentEntityId);
    } else {
      // For general file uploads, use the files API
      endpoint = FILES_ENDPOINTS.add();
    }
    
    const response = await fetchService(endpoint, {
      method: 'POST',
      body: formData,
    });

    const entity: BaseEntityType = {
      ...response,
      _id: response._id,
      id: response._id,
      name: response.name || file.name,
      type: 'File',
      entityType: 'File',
      created_at: response.created_at || new Date().toISOString(),
      updated_at: response.updated_at || new Date().toISOString(),
      skeleton: {
        '@type': 'File',
        fileId: response._id,
        fileName: file.name,
        groupIds: [],
        mimeType: file.type,
        size: file.size,
        parentId: parentEntityId // Store the parent ID in the skeleton for persistence
      },
      spaceId,
    };

    // Update CRDT and wait for confirmation
    await entityCRDTService.updateEntity(entity._id, entity);

    return entity;
  }

  private async enrichPdfAndWait(fileId: string, pollingInterval = 1000, timeout = 300000): Promise<void> {
    // Start enrichment process
    await fetchService(PDF_ENDPOINTS.enrich(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileId,
      }),
    });

    // Start polling with timeout
    const startTime = Date.now();

    while (true) {
      // Check if we've exceeded timeout
      if (Date.now() - startTime > timeout) {
        throw new Error('PDF enrichment timed out');
      }

      // Get current status
      const status = await this.getPdfEnrichmentStatus(fileId);

      if (status.status === 'completed') {
        // Load the enriched data
        await this.loadPdfEnrichment(fileId);
        break;
      } else if (status.status === 'failed') {
        throw new Error(status.error || 'PDF enrichment failed');
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, pollingInterval));
    }
  }

  async readFile(entityId: string, parentEntityId?: string): Promise<Uint8Array> {
    const maxRetries = 3;
    let lastError: any = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        logger.log(`[FileService] Reading file attempt ${attempt + 1}/${maxRetries} for entity ID: ${entityId}`);
        // Use custom fetch options for file downloads to avoid CORS issues with credentials
        const data = await fetchService(FILES_ENDPOINTS.read(entityId, parentEntityId), {
          credentials: 'omit', // Don't send credentials for file downloads
          mode: 'cors'
        });

        if (data && data.length > 0) {
          logger.log(`[FileService] Successfully read file, size: ${data.length} bytes`);
          return data;
        } else {
          logger.warn(`[FileService] Received empty data for file: ${entityId}`);

          // If this isn't the last attempt, try again
          if (attempt < maxRetries - 1) {
            await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
            continue;
          }

          throw new Error('Received empty data from server');
        }
      } catch (error: any) {
        logger.error(`[FileService] Error reading file (attempt ${attempt + 1}/${maxRetries}):`, error);
        lastError = error;

        // If this isn't the last attempt, try again with exponential backoff
        if (attempt < maxRetries - 1) {
          const backoffMs = 1000 * Math.pow(2, attempt);
          logger.log(`[FileService] Retrying in ${backoffMs}ms...`);
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
        }
      }
    }

    // If we got here, all retries failed
    logger.error('[FileService] All attempts to read file failed:', lastError);
    throw lastError || new Error('Failed to read file after multiple attempts');
  }

  async updateFile(file: File, entityId: string, parentEntityId?: string): Promise<Uint8Array> {
    const formData = new FormData();
    formData.append('file', file);

    return fetchService(FILES_ENDPOINTS.update(entityId, parentEntityId), {
      method: 'PUT',
      body: formData,
    });
  }

  async deleteFile(entityId: string, parentEntityId?: string): Promise<Uint8Array> {
    return fetchService(FILES_ENDPOINTS.update(entityId, parentEntityId), {
      method: 'DELETE',
    });
  }

  async getPdfEnrichmentStatus(fileId: string): Promise<EnrichmentStatus> {
    return fetchService(`${PDF_ENDPOINTS.enrich()}/status?fileId=${fileId}`, {
      method: 'GET',
    });
  }

  async loadPdfEnrichment(fileId: string): Promise<PdfEnrichmentResult> {
    const response = await fetchService(`${API_BASE_URL}/inspect_pdf?fileId=${fileId}`, {
      method: 'GET',
    });
    return response.skeleton.enrichments;
  }

  async uploadFile(spaceId: string, file: File): Promise<BaseEntityType> {
    logger.log('[FileService] Uploading file:', {
      name: file.name,
      size: file.size,
      type: file.type,
      spaceId,
    });

    const id = uuidv4();
    // Create file entity with all required fields
    const fileEntity: BaseEntityType = {
      _id: id,
      id: id,
      name: file.name,
      type: 'File',
      entityType: 'File',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      skeleton: {
        '@type': 'File',
        path: file.name,
        fileName: file.name,
        size: file.size,
        type: file.type,
      },
    };

    // Update CRDT
    entityCRDTService.updateEntity(fileEntity._id, fileEntity);

    return fileEntity;
  }

  async getRecentFiles(type?: string): Promise<Array<{ id: string; name: string }>> {
    try {
      const response = await fetchService(`${API_BASE_URL}/files/recent${type ? `?type=${type}` : ''}`);
      return response;
    } catch (error) {
      logger.error('Error fetching recent files:', error);
      return [];
    }
  }

  /**
   * Creates a new project
   * @param name The name of the project
   */
  async createProject(name: string): Promise<BaseEntityType> {
    // Create a local project entity first
    const id = uuidv4();
    const projectEntity: BaseEntityType = {
      _id: id,
      id,
      name,
      type: 'project',
      entityType: 'Project',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      skeleton: {
        '@type': 'Project',
        name,
        files: [],
      },
    };
    
    try {
      // First persist to CRDT to ensure we have a local copy
      await entityCRDTService.updateEntity(projectEntity._id, projectEntity);
      logger.log('[FileService] Project created and persisted locally:', projectEntity);
      
      // Then try to sync with backend if it exists
      const formData = new FormData();
      formData.append('name', name);
      formData.append('entityType', 'Project');
      
      logger.log('[FileService] Attempting to sync project with backend API:', PROJECTS_ENDPOINTS.create());
      
      const response = await fetchService(PROJECTS_ENDPOINTS.create(), {
        method: 'POST',
        body: formData,
      });
      
      logger.log('[FileService] Project creation response from backend:', response);
      
      // If we get a successful response, update our entity with backend properties
      if (response && response._id) {
        const backendProjectEntity: BaseEntityType = {
          ...projectEntity,
          ...response,
          _id: response._id,
          id: response._id,
          name: response.name || name,
        };
        
        // Update CRDT with backend-synced entity
        await entityCRDTService.updateEntity(backendProjectEntity._id, backendProjectEntity);
        logger.log('[FileService] Project synced with backend:', backendProjectEntity);
        
        return backendProjectEntity;
      }
      
      // If backend didn't return a valid response, use our local entity
      return projectEntity;
    } catch (error) {
      logger.error('[FileService] Error syncing project with backend (will use local only):', error);
      return projectEntity;
    }
  }
  
  /**
   * Gets all available projects
   */
  async getProjects(): Promise<BaseEntityType[]> {
    try {
      // Use the entity CRDT service directly to get local projects without calling the API
      const localEntities = await entityCRDTService.getAllEntities();
      const localProjects = localEntities.filter((entity: BaseEntityType) => entity.entityType === 'Project');
      logger.log('[FileService] Found local projects from CRDT:', localProjects);
      
      // Then try to fetch from backend and merge
      try {
        const response = await fetchService(PROJECTS_ENDPOINTS.list());
        logger.log('[FileService] Backend project response:', response);
        
        if (Array.isArray(response) && response.length > 0) {
          // Combine backend projects with local ones, avoiding duplicates
          const backendProjectIds = new Set(response.map((p: BaseEntityType) => p._id));
          const uniqueLocalProjects = localProjects.filter((p: BaseEntityType) => !backendProjectIds.has(p._id));
          
          return [...response, ...uniqueLocalProjects];
        }
      } catch (backendError) {
        logger.log('[FileService] Backend projects API not available, using local only:', backendError);
        // This is expected if the backend endpoint doesn't exist, just use local projects
      }
      
      return localProjects;
    } catch (error) {
      logger.error('[FileService] Error fetching projects:', error);
      return [];
    }
  }
}

// Create and export the singleton instance
export const fileService = new FileService();

// React hook to use the service
export const useFileService = () => fileService;
