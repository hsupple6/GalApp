// Re-export types from main types file
export type { 
  EntityBase,
  FileSkeleton,
  NoteSkeleton,
  SpaceSkeleton} from '../types';

export interface BaseSkeleton {
  '@type': string;
  childEntities?: string[];
}
// Base API response type
export interface EntityResponse {
  _id: string;
  entityType: string;
  name: string;
  skeleton: Record<string, any>;
  created_at: string;
  updated_at: string;
  appId?: string;
}

// BaseEntityType is the core interface that all entities in the system inherit from.
export interface BaseEntityType<T = { childEntities?: string[] }> {
  _id: string;
  id: string;
  type: string;
  name: string;
  entityType: string;
  created_at: string;
  updated_at: string;
  skeleton?: T;
  isSystemGroup?: boolean;
  children?: BaseEntityType[];
}

// Make it a module
export {};

// EXAMPLE: Note Entity
// {
//     "_id": {
//       "$oid": "677570acc8bc2ba5fd6fda66"
//     },
//     "entityType": "Note",
//     "created_at": {
//       "$date": "2025-01-01T16:43:24.420Z"
//     },
//     "skeleton": {
//       "@type": "Note",
//       "content": "[object Object]",
//       "ydoc": [
//         1,
//         9,
//         ...
//         2
//       ]
//     },
//     "updated_at": {
//       "$date": "2025-01-01T16:43:25.826Z"
//     }
//   }

export interface EntityQueryParams {
  type?: string;  // Maps to entityType in MongoDB
  userId?: string;
  entityType?: string;  // Direct MongoDB field mapping
  name?: string;
  appId?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: any; // Allow for additional MongoDB query parameters
}
