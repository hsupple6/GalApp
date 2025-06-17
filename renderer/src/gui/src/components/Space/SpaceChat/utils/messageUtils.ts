import { ObjectId } from "bson"
import { 
  MessageEntity, 
  MessageContent, 
  ThreadEntity, 
  MessageSender,
  ThreadSkeleton 
} from "types/chat"
import { ChatMode } from "../types"
import { StreamToolUseData } from "./streamHelpers"

export function composeContextSummary(message?: MessageEntity) {
  if (!message || !Array.isArray(message?.skeleton?.content)) {
    return '';
  }

  const isResponseAction = message?.skeleton?.content.some((action) => action.type === 'tool_result');

  return `${(message?.skeleton?.content).map((action) => action.type).join(', ')} ${isResponseAction ? 'response' : ''}`;
}

// export function convertMessagesToClaudeFormat(messages: MessageEntity[]) {
//   return messages.map((message) => {
//     return {
//       role: message.skeleton.sender,
//       content: message.skeleton.content.map((c) => {
//         if (c.type === 'text') {
//           return c.text;
//         }
//         return c;
//       }).join('\n'),
//     }
//   })
// }

export const createMessageUtils = (user_id: string) => {
  return {
    createMessage(content: MessageContent[], sender: MessageSender, threadId: string): MessageEntity {
      return {
        _id: new ObjectId().toString(),
        entityType: 'Message',
        name: 'Message',
        user_id,
        skeleton: {
          '@type': 'Message',
          content,
          sender,
          thread_id: threadId,
          sourceEntities: [],
        },
        created_at: new Date().toISOString(),
      }
    },
    createUserMessage(text: string, threadId: string): MessageEntity {
      return this.createMessage([{
        type: 'text',
        text,
      }], 'user', threadId);
    },
    createAIMessage(content: MessageContent[], threadId: string): MessageEntity {
      return this.createMessage(content, 'assistant', threadId);
    },
    createErrorMessage(error: Error, threadId: string): MessageEntity {
      return this.createMessage([{
        type: 'text',
        text: error.message,
      }], 'assistant', threadId);
    },
    createToolUseMessage(toolUseContent: StreamToolUseData['content'], threadId: string): MessageEntity {
      return this.createMessage([{
        type: 'tool_use',
        ...toolUseContent,
      }], 'assistant', threadId);
    },
    pushToolUseToMessage(message: MessageEntity, toolUseContent: StreamToolUseData['content']): MessageEntity {
      const newMessage: MessageEntity = {
        ...message,
        skeleton: {
          ...message.skeleton,
          content: [...message.skeleton.content, {
            type: 'tool_use',
            ...toolUseContent,
          }],
        },
      };
      return newMessage;
    },
    createToolResultMessage(toolResult: any, threadId: string): MessageEntity {
      return this.createMessage([{
        type: 'tool_result',
        ...toolResult,
      }], 'user', threadId);
    },
    createThread(mode: ChatMode, title: string, messageIds: string[]): ThreadEntity {
      return {
        _id: new ObjectId().toString(),
        entityType: 'Thread',
        user_id,
        name: title,
        skeleton: {
          '@type': 'Thread',
          mode,
          message_ids: messageIds,
        } as ThreadSkeleton,
        created_at: new Date().toISOString(),
      }
    },
    convertMessagesToClaudeFormat(messages: MessageEntity[]) {
      return messages.map((message) => {
        return {
          role: message.skeleton.sender,
          content: message.skeleton.content,
        }
      })
    }
  }
}