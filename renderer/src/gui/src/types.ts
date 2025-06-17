import { WindowEntity } from './types/windows';

// Base interface for shared properties
export interface EntityBase {
  _id: string;
  id?: string;
  // type: string;
  name: string;
  entityType: string;
  created_at: string;
  updated_at?: string;
}

// Email type
export interface EmailType extends EntityBase {
  type: 'email';
  entityType: 'Email';
  from: string;
  to: string;
  subject: string;
  date: string; // Add this back
  gmail_id?: string;
  cleaned_plain_text?: string;
}

// Apple Note type
export interface AppleNoteType extends EntityBase {
  type: 'applenote';
  entityType: 'AppleNote';
  title: string; // Add this back
  folder?: string;
  plaintext?: string;
  modified_at?: string;
}

// Base skeleton interface that all skeletons must implement
export interface BaseSkeleton {
  '@type': string;
  childEntities?: string[];
}

// Update all skeleton types to extend BaseSkeleton
export interface FileSkeleton {
  '@type': 'File';
  fileId: string;
  fileName: string;
  groupIds: string[];
  mimeType: string;
  size: number;
}

export interface NoteSkeleton extends BaseSkeleton {
  '@type': 'Note';
  content?: string;
  settings?: {
    isContentsVisible: boolean;
    isChatVisible: boolean;
  };
}

export interface SpaceSkeleton extends BaseSkeleton {
  '@type': 'Space';
  windows: WindowEntity[];
  settings: {
    isContentsVisible: boolean;
    isChatVisible: boolean;
  };
}

export interface WebDocumentSkeleton {
  '@type': 'WebDocument';
  url: string;
  title: string;
  settings: {
    isScrollable: boolean;
    isContentsVisible: boolean;
    isChatVisible: boolean;
  };
  childEntities: string[];
}

export type EntitySkeleton = FileSkeleton | NoteSkeleton | SpaceSkeleton | WebDocumentSkeleton;

// Base entity type that all entities extend
export interface BaseEntityType {
  _id: string;
  id: string;
  name: string;
  type: string;
  entityType: string;
  created_at: string;
  updated_at: string;
  skeleton: any;
  spaceId?: string;
  children?: BaseEntityType[];
  isSystemGroup?: boolean;
}

// Space types
export interface SpaceEntity extends EntityBase {
  type: 'space';
  entityType: 'Space' | 'Window';
  skeleton: SpaceSkeleton;
}

// File types
export interface FileType extends EntityBase {
  type: 'file';
  entityType: 'File';
  path?: string;
  size?: number;
  lastModified?: Date;
  metadata?: {
    size?: number;
    mimeType?: string;
    originalPath?: string;
  };
}

export interface PDFEntity extends EntityBase {
  type: 'pdf' | 'pdfium';
  entityType: 'File';
}

// File entity type
export interface FileEntity extends BaseEntityType {
  entityType: 'File';
  skeleton: FileSkeleton;
}

// Web Document types
export interface WebDocument extends BaseEntityType {
  entityType: 'WebDocument';
  skeleton: WebDocumentSkeleton;
}

export interface WebDocumentEntity extends EntityBase {
  type: 'webdoc';
  metadata: {
    url: string;
  };
}

// Event types
export interface OpenFileEvent extends CustomEvent {
  detail: {
    entity: BaseEntityType;
    appType: string;
  };
}

// App type
// export type AppType = 'browser' | 'webdoc' | 'chat' | 'system' | 'console' | 'pdf' | 'pdfium' | 'notes';

// Utility Types
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  left: number;
}

export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  category?: string;
  class?: string;
  tags: string[];
}

export interface EntityType extends EntityBase {
  metadata?: any;
}

// Add these type guards
// export const isSpaceSkeleton = (skeleton: NoteSkeleton | SpaceSkeleton): skeleton is SpaceSkeleton => {
//   return 'windows' in skeleton;
// };

// export const isNoteSkeleton = (skeleton: NoteSkeleton | SpaceSkeleton): skeleton is NoteSkeleton => {
//   return !('windows' in skeleton);
// };

export interface AppAction {
  ACTION_NAME: string;
  arguments?: Record<string, any>;
  response?: any;
}

// export interface AppActionResponse extends AppAction {
//   response: null | Record<string, any> | any[];
// }
//
// export interface AppAction2 {
//   ACTION_NAME: string;
//   arguments?: {
//     fileList: string[];
//   };
//   response: {
//     result: boolean;
//     list: string[];
//   };
// }

// export interface AppActionDefinitionOld {
//   args: string[];
//   callExamples: AppAction[];
//   responseExamples: (Record<any, any> | any[])[] | null;
//   description: string;
//   context: string[];
// }

export interface AppActionDefinition {
  name: string;
  description: string;
  schema: Record<any, any>;
}

// Note interface
export interface Note extends BaseEntityType {
  type: 'note';
  entityType: 'Note';
  skeleton: {
    content?: string;
    childEntities: string[];
    settings?: {
      isContentsVisible: boolean;
      isChatVisible: boolean;
    };
  };
}

// Thread and Message types for ChatApp
export interface ThreadSkeleton extends BaseSkeleton {
  '@type': 'Thread';
  title: string;
  messages: string[]; // Array of message IDs
  summary?: string;
  pinned?: boolean;
  settings?: {
    isVisible: boolean;
  };
}

export interface MessageSkeleton extends BaseSkeleton {
  '@type': 'Message';
  content: string;
  sender: 'User' | 'AI';
  threadId: string;
  sourceEntities?: string[]; // IDs of related entities
  status?: 'sent' | 'delivered' | 'read' | 'error';
}

export interface ThreadEntity extends BaseEntityType {
  type: 'thread';
  entityType: 'Thread';
  skeleton: ThreadSkeleton;
}

export interface MessageEntity extends BaseEntityType {
  type: 'message';
  entityType: 'Message';
  skeleton: MessageSkeleton;
}
