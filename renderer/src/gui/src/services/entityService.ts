import { API_BASE_URL } from '../api/config';
import type { BaseEntityType } from '../types';
import type { EntityResponse } from '../types/entities';
import type { NoteEntity } from '../types/notes';
import fetchService from './fetchService';
import { logger } from 'utils/logger';

interface EntityServiceConfig {
  baseUrl: string;
}

interface EntityQueryParams {
  type?: string;  // Maps to entityType in MongoDB
  userId?: string;
  entityType?: string;  // Direct MongoDB field mapping
  name?: string;
  appId?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: any; // Allow for additional MongoDB query parameters
}

export class EntityService<T extends BaseEntityType> {
  private baseUrl: string;

  constructor(config: EntityServiceConfig) {
    this.baseUrl = config.baseUrl;
  }

  private getAuthHeaders(): Headers {
    const authToken = localStorage.getItem('authToken');
    if (!authToken) throw new Error('No auth token found');

    return new Headers({
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    });
  }

  private async fetchWithAuth(url: string, options: RequestInit = {}) {
    const response = await fetch(url, {
      ...options,
      headers: this.getAuthHeaders(),
      credentials: 'include',
      mode: 'cors',
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    return response;
  }

  async create(data: Partial<T>): Promise<T> {
    return fetchService(`${this.baseUrl}/entities`, {
      method: 'POST',
      body: JSON.stringify(data),
      credentials: 'include',
    });
  }

  async get(id: string): Promise<T> {
    return fetchService(`${this.baseUrl}/entities/${id}`, {
      credentials: 'include',
    });
  }

  async update(id: string, data: Partial<T>): Promise<T> {
    return fetchService(`${this.baseUrl}/entities/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
      credentials: 'include',
    });
  }

  async fetchEntity(id: string): Promise<EntityResponse> {
    return fetchService(`/api/entities/${id}`);
  }

  async fetchNotes(): Promise<NoteEntity[]> {
    return fetchService('/api/entities?type=AppleNote');
  }

  async fetchEntities(): Promise<T[]> {
    return fetchService(`${this.baseUrl}/entities`, {
      credentials: 'include',
    });
  }

  async queryEntities(query: EntityQueryParams): Promise<T[]> {
    logger.log(`[EntityService] Querying entities with params:`, query);
    
    try {
      // Transform the query to match MongoDB structure
      const mongoQuery: Record<string, any> = {};
      
      // Handle type/entityType mapping
      if (query.type) {
        mongoQuery.entityType = query.type;
      } else if (query.entityType) {
        mongoQuery.entityType = query.entityType;
      }

      // Process all other query parameters
      Object.entries(query).forEach(([key, value]) => {
        // Skip already processed parameters
        if (key === 'type' || key === 'entityType') return;

        // Handle date fields
        if (key === 'created_at' || key === 'updated_at') {
          if (value instanceof Date) {
            mongoQuery[key] = value.toISOString();
          } else if (typeof value === 'string') {
            mongoQuery[key] = value;
          }
        }
        // Handle array fields
        else if (Array.isArray(value)) {
          mongoQuery[key] = value.join(',');
        }
        // Handle boolean fields
        else if (typeof value === 'boolean') {
          mongoQuery[key] = value.toString();
        }
        // Handle numeric fields
        else if (typeof value === 'number') {
          mongoQuery[key] = value.toString();
        }
        // Default: string value or other types
        else {
          mongoQuery[key] = value;
        }
      });

      // Build query string
      const queryString = Object.entries(mongoQuery)
        .filter(([_, value]) => value !== undefined && value !== null)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join('&');

      const response = await fetchService(`${this.baseUrl}/entities?${queryString}`, {
        credentials: 'include',
      });
      
      if (!Array.isArray(response)) {
        logger.error('[EntityService] Expected array response, got:', response);
        throw new Error('Invalid response format from /api/entities');
      }
      
      return response;
    } catch (error) {
      logger.error(`[EntityService] Failed to query entities:`, error);
      throw error;
    }
  }

  async batchUpsert(entities: Partial<T>[]): Promise<T[]> {
    return fetchService(`${this.baseUrl}/entities/batch`, {
      method: 'POST',
      body: JSON.stringify({ entities }),
      credentials: 'include',
    });
  }

  async deleteEntity(id: string): Promise<boolean> {
    try {
      await fetchService(`${this.baseUrl}/entities/${id}`, {
        method: 'DELETE',
        credentials: 'include',
        mode: 'cors',
      });
      return true;
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        logger.debug('Entity already deleted or not found');
        return false;
      }
      logger.error('Delete request failed:', error);
      return false;
    }
  }

  async getEntities(spaceId: string): Promise<BaseEntityType[]> {
    logger.log('[EntityService] Fetching entities for space:', spaceId);
    
    try {
      const response = await fetchService(`${API_BASE_URL}/entities`);
      
      if (!Array.isArray(response)) {
        logger.error('[EntityService] Expected array response, got:', response);
        throw new Error('Invalid response format from /api/entities');
      }
      
      const entities = response.map((entity: any) => ({
        _id: entity._id,
        id: entity._id,
        name: entity.entityType === 'File' 
          ? (entity.skeleton?.fileName || entity.name || 'Untitled')
          : (entity.name ?? 'Untitled'),
        type: entity.entityType.toLowerCase(),
        entityType: entity.entityType,
        created_at: entity.created_at || new Date().toISOString(),
        updated_at: entity.updated_at || new Date().toISOString(),
        skeleton: {
          '@type': entity.entityType,
          ...entity.skeleton
        }
      }));

      logger.log('[EntityService] Processed entities:', {
        count: entities.length,
        types: [...new Set(entities.map(e => e.entityType))]
      });

      return entities;
    } catch (error) {
      logger.error('[EntityService] Failed to fetch entities:', error);
      throw error;
    }
  }

  async getEntitiesByType({ entityType }: { entityType: string }): Promise<BaseEntityType[]> {
    logger.log(`[EntityService] Fetching entities of type: ${entityType}`);
    
    try {
      const response = await fetchService(`${API_BASE_URL}/entities?type=${entityType}`);
      
      if (!Array.isArray(response)) {
        logger.error('[EntityService] Expected array response, got:', response);
        throw new Error('Invalid response format from /api/entities');
      }
      
      const entities = response.map((entity: any) => ({
        _id: entity._id,
        id: entity._id,
        name: entity.entityType === 'File' 
          ? (entity.skeleton?.fileName || entity.name || 'Untitled')
          : (entity.name ?? 'Untitled'),
        type: entity.entityType.toLowerCase(),
        entityType: entity.entityType,
        created_at: entity.created_at || new Date().toISOString(),
        updated_at: entity.updated_at || new Date().toISOString(),
        skeleton: entity.skeleton || {},
        appId: entity.appId,
      }));

      logger.log(`[EntityService] Found ${entities.length} ${entityType} entities`);
      return entities;
    } catch (error) {
      logger.error(`[EntityService] Failed to fetch ${entityType} entities:`, error);
      throw error;
    }
  }
}

// Export a singleton instance
export const entityService = new EntityService({
  baseUrl: process.env.REACT_APP_API_URL || API_BASE_URL
});

// Export the getEntitiesByType function directly
export const getEntitiesByType = (params: { entityType: string }) => {
  return entityService.getEntitiesByType(params);
};

// Usage example:
// export const createEntityService = <T extends BaseEntityType>(entityType: EntityTypes) => {
//   return new EntityService<T>({
//     baseUrl: `