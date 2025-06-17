// API Types
export interface NoteEntity {
  _id: string;
  entityType: "Note";
  created_at: string;
  updated_at: string;
  skeleton: {
      "@type": "Note";
      content: string;
      ydoc: number[];  // CRDT state
  };
}

// UI Types
export interface UINote {
  id: string;
  title: string;
  content: string;
  created: Date;
  updated: Date;
  ydoc?: number[];
}

// CRDT Types
export interface NoteCRDTUpdate {
  type: 'content' | 'metadata';
  data: any;
  timestamp: number;
}

// Error Types
export type NoteErrorType = 'NOT_FOUND' | 'PERMISSION_DENIED' | 'NETWORK_ERROR' | 'INVALID_INPUT';

export class NoteError extends Error {
  constructor(
    message: string,
    public type: NoteErrorType,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'NoteError';
  }
}