import { ChatMode } from "components/Space/SpaceChat/types";
import { EntityBase, BaseSkeleton } from "./entities";

export interface ThreadSkeleton extends BaseSkeleton {
  '@type': 'Thread';
  message_ids: string[];
  mode: ChatMode;
}

export type MessageContentType = 'text' | 'tool_use' | 'tool_result';

interface ToolUseContent {
  type: 'tool_use';
  id: string;
  name: string;
  input: any;
}

interface ToolResultContent {
  type: 'tool_result';
  tool_use_id: string;
  content: any;
}

interface TextContent {
  type: 'text';
  text: string;
}

export type MessageContent = TextContent | ToolUseContent | ToolResultContent;

export type MessageSender = 'user' | 'assistant';

export interface MessageSkeleton extends BaseSkeleton {
  '@type': 'Message';
  content: MessageContent[];
  sender: MessageSender;
  thread_id: string;
  sourceEntities: string[];
}

export interface ThreadEntity extends EntityBase {
  entityType: 'Thread';
  user_id: string;
  skeleton: ThreadSkeleton;
}

export interface MessageEntity extends EntityBase {
  entityType: 'Message';
  user_id: string;
  skeleton: MessageSkeleton;
}
