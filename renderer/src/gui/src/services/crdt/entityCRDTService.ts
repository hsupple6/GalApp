import type { BaseEntityType, EntitySkeleton } from '../../types';
import { CRDTService, crdtService } from './crdtService';

export interface EntityUpdate {
    id: string;
    type: 'add' | 'update' | 'delete';
    entity?: BaseEntityType;
}

export class EntityCRDTService {
    constructor(private crdt: CRDTService) {}

    private getKey() {
        return 'entities'; // Single key for all entities
    }

    observeEntities(onUpdate: (update: EntityUpdate) => void) {
        const key = this.getKey();
        
        return this.crdt.connect<EntityUpdate>(key, (update) => {
            if (update.data) {
                onUpdate(update.data);
            }
        });
    }

    updateEntity(entityId: string, entity: BaseEntityType) {
        const key = this.getKey();
        
        this.crdt.update(key, {
            type: 'add',
            id: entityId,
            entity
        });
    }

    deleteEntity(entityId: string) {
        const key = this.getKey();
        
        this.crdt.update(key, {
            type: 'delete',
            id: entityId
        });
    }
    
    async getAllEntities(): Promise<BaseEntityType[]> {
        const key = this.getKey();
        const data = await this.crdt.get<EntityUpdate[]>(key) || [];
        
        // Filter to only get entities that are of type 'add' and have an entity object
        return data
            .filter(update => update.type === 'add' && update.entity)
            .map(update => update.entity as BaseEntityType);
    }
}

export const entityCRDTService = new EntityCRDTService(crdtService); 