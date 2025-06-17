import { BaseEntityType } from "../../../types";
import { AnyWindowEntity } from "../../../types/windows";
import { 
  MessageEntity as GlobalMessageEntity, 
  ThreadEntity as GlobalThreadEntity,
  MessageContent as GlobalMessageContent,
  MessageSender as GlobalMessageSender,
  MessageSkeleton as GlobalMessageSkeleton,
  ThreadSkeleton as GlobalThreadSkeleton
} from "../../../types/chat";

// Re-export the types we're using directly from chat.ts
export type MessageEntity = GlobalMessageEntity;
export type ThreadEntity = GlobalThreadEntity;
export type MessageContent = GlobalMessageContent;
export type MessageSender = GlobalMessageSender;
export type MessageSkeleton = GlobalMessageSkeleton;
export type ThreadSkeleton = GlobalThreadSkeleton;

export type ChatMode = "chat" | "create" | "editor" | "exp1";

export interface TextBlock {
  type: "text";
  text: string;
}

export interface ToolUseBlock {
  type: "tool_use";
  name: string;
  input: Record<string, any>;
  id: string;
}

export interface ToolResultBlock {
  type: "tool_result";
  tool_use_id: string;
  content: string;
}

export type MessageBlock = TextBlock | ToolUseBlock | ToolResultBlock;

// Base window content with common properties
export interface BaseWindowContent {
  appType: string;
  isActive: boolean;
  windowId: string;
  stableId: string;
  title: string;
}

// PDF Window content type
export interface PDFWindowContent extends BaseWindowContent {
  appType: "PDF";
  entityId: string | null;
}

// Docs Window content type
export interface DocsWindowContent extends BaseWindowContent {
  appType: "docs";
  screen: string;
  docId: string;
  content: string;
  contentHash: string;
}

// Note Window content type
export interface NoteWindowContent extends BaseWindowContent {
  appType: "notes";
  noteId?: string; // Make noteId optional
  content?: string; // Make content optional
  contentHash?: string; // Make contentHash optional
}

// Generic window content for other types
export interface GenericWindowContent extends BaseWindowContent {
  appType: string; // Allow any app type for flexibility
  [key: string]: any; // Allow additional properties
}

// Union type of all possible window contents
export type WindowContent = PDFWindowContent | DocsWindowContent | NoteWindowContent | GenericWindowContent;

// Space context type 
export interface SpaceContext {
  spaceId: string;
  windowContents: Record<string, WindowContent>;
  currentSelection?: any;
  _refreshTimestamp?: number;
}

// Window mention type
export interface WindowMention {
  id: string;
  type: string;
  startIndex: number;
  endIndex: number;
}

// Selection object types
export interface SpaceSelection {
  text: string;
  source: {
    window: any;
    type: string;
    metadata?: any;
  };
}

// Tool result type
export interface ToolResult<T = any> {
  status: "success" | "error";
  message: string;
  data: T | null;
}

// Other types needed in the application
export interface Mention {
  id: string;
  displayName: string;
  type: string;
}

// Window context types
export interface BaseWindowContext {
  type: string;
}

export interface ContentWindowContext extends BaseWindowContext {
  type: 'pdfium' | 'notes';
  name: string;
  content: string;
}

export interface BrowserWindowContext extends BaseWindowContext {
  type: 'browser';
  url: string;
  title: string;
}

export interface DefaultWindowContext extends BaseWindowContext {
  type: string;
  title: string;
}

export type WindowContext = ContentWindowContext | BrowserWindowContext | DefaultWindowContext;

export interface ThreadSummary {
  id: string;
  mode: ChatMode;
  title: string;
  messageCount: number;
  lastActive: Date;
}