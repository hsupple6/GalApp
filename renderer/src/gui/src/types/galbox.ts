export interface GalBoxEntity {
  _id: string;
  serial_number: string;
  name: string;
  ip_address: string;
  username: string;
  ollama_version?: string;
  created_at: string;
  updated_at: string;
  status: 'setup' | 'ready' | 'error';
}

export interface UIGalBox {
  id: string;
  serialNumber: string;
  name: string;
  ipAddress: string;
  username: string;
  ollamaVersion?: string;
  created: Date;
  updated: Date;
  status: 'setup' | 'ready' | 'error';
}

export class GalBoxError extends Error {
  constructor(
    message: string,
    public code: 'NOT_FOUND' | 'NETWORK_ERROR' | 'PERMISSION_DENIED' | 'INVALID_INPUT',
    public originalError?: Error
  ) {
    super(message);
    this.name = 'GalBoxError';
  }
} 