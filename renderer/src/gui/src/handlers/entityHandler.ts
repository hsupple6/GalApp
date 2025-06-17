import { entityService } from '../services/entityService';
import type { BaseEntityType } from '../types';
import type { EntityQueryParams } from '../types/entities';
import { logger } from 'utils/logger';

export class EntityHandler {
  async queryEntities(query: EntityQueryParams): Promise<BaseEntityType[]> {
    try {
      logger.log('[EntityHandler] Querying entities with params:', query);
      const entities = await entityService.queryEntities(query);
      return entities;
    } catch (error) {
      logger.error('[EntityHandler] Failed to query entities:', error);
      throw error;
    }
  }

  async createEntity(data: Partial<BaseEntityType>): Promise<BaseEntityType> {
    try {
      logger.log('[EntityHandler] Creating entity:', data);
      const entity = await entityService.create(data);
      return entity;
    } catch (error) {
      logger.error('[EntityHandler] Failed to create entity:', error);
      throw error;
    }
  }

  async updateEntity(id: string, data: Partial<BaseEntityType>): Promise<BaseEntityType> {
    try {
      logger.log('[EntityHandler] Updating entity:', { id, data });
      const entity = await entityService.update(id, data);
      return entity;
    } catch (error) {
      logger.error('[EntityHandler] Failed to update entity:', error);
      throw error;
    }
  }

  async deleteEntity(id: string): Promise<boolean> {
    try {
      logger.log('[EntityHandler] Deleting entity:', id);
      const result = await entityService.deleteEntity(id);
      return result;
    } catch (error) {
      logger.error('[EntityHandler] Failed to delete entity:', error);
      throw error;
    }
  }

  async getEntity(id: string): Promise<BaseEntityType> {
    try {
      logger.log('[EntityHandler] Fetching entity:', id);
      const entity = await entityService.get(id);
      return entity;
    } catch (error) {
      logger.error('[EntityHandler] Failed to fetch entity:', error);
      throw error;
    }
  }

  async batchUpsertEntities(entities: Partial<BaseEntityType>[]): Promise<BaseEntityType[]> {
    try {
      logger.log('[EntityHandler] Batch upserting entities:', entities.length);
      const result = await entityService.batchUpsert(entities);
      return result;
    } catch (error) {
      logger.error('[EntityHandler] Failed to batch upsert entities:', error);
      throw error;
    }
  }
}

// Export a singleton instance
export const entityHandler = new EntityHandler(); 