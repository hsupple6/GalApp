import type { BaseEntityType } from './entities';

export interface OpenFileEvent {
    detail: {
        appType: string;
        entity: BaseEntityType & {
            metadata?: {
                url?: string;
            };
        };
    };
} 