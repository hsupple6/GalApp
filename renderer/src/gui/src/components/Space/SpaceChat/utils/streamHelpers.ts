import { logger } from "utils/logger";
import { generateContextDescription } from "./simpleWindowTargeting";
import { CLAUDE_ENDPOINTS } from 'endpoints';
import { MessageContent } from 'types/chat';
import { SpaceContext, SpaceSelection } from '../types';
import { ClaudeTool } from 'types/commands';
import { createToolsFromCommands } from 'stores/commandRegistryStore';
import { commands as notesCommands } from 'apps/NotesApp/store/commands';
import { commands as docsCommands } from 'apps/DocsApp/store/commands';
import { commands as pdfiumCommands } from 'apps/PDFiumApp/commands';
import fetchService from 'services/fetchService';

// Stream response types
interface StreamTextData {
  type: 'text';
  content: string;
}

export interface StreamToolUseData {
  type: 'tool_use';
  content: {
    id: string;
    name: string;
    input: any;
  };
}

interface StreamMessageStartData {
  type: 'message_start';
  message_id: string;
}

interface StreamContentBlockStartData {
  type: 'content_block_start';
  index: number;
}

interface StreamContentBlockStopData {
  type: 'content_block_stop';
  index: number;
}

interface StreamMessageDeltaData {
  type: 'message_delta';
  delta: {
    stop_reason?: string;
  };
}

interface StreamMessageStopData {
  type: 'message_stop';
}

interface StreamPingData {
  type: 'ping';
}

interface StreamDoneData {
  type: 'done';
  conversation_title: string;
}

interface StreamErrorData {
  type: 'error';
  message: string;
}

type StreamData =
  | StreamTextData
  | StreamToolUseData
  | StreamMessageStartData
  | StreamContentBlockStartData
  | StreamContentBlockStopData
  | StreamMessageDeltaData
  | StreamMessageStopData
  | StreamPingData
  | StreamDoneData
  | StreamErrorData;

interface BaseStreamOptions {
  logPrefix: string;
  messageId: string;
  onText: (text: string, fullResponse: string, messageId: string) => void;
  onToolUse?: (toolData: StreamToolUseData['content'], messageId: string) => void;
  onDone: (fullResponse: string, messageId: string, conversationTitle: string) => void;
  onError?: (error: Error, messageId: string) => void;
}

interface ParseStreamOptions extends BaseStreamOptions {
  reader: ReadableStreamDefaultReader<Uint8Array>;
  signal?: AbortSignal;
}

interface StreamOptions extends BaseStreamOptions {
  messageContent: MessageContent;
  context: SpaceContext;
  messageHistory: ClaudeMessage[];
  model: string;
  onControllerReady?: (controller: AbortController) => void;
}

interface StreamRequestBody {
  context: SpaceContext & { currentSelection?: SpaceSelection | null };
  conversation_history: any;
  tools: any;
  model: string;
  query?: string;
  output?: any;
  tool_use_id?: string;
  stream?: boolean;
}

interface ClaudeMessage {
  role: string;
  content: MessageContent[];
}

const getCommandsForClaude = (context: SpaceContext & { currentSelection?: SpaceSelection | null }): ClaudeTool[] => {
  logger.log('[context-debug][streamHelpers][getCommandsForClaude] context:', context);
  const { windowContents } = context;
  const commands: ClaudeTool[] = [];
  const addedCommands = new Set();

  if (!windowContents || Object.keys(windowContents).length === 0) {
    logger.log('[getCommandsForClaude] No window contents found in context, returning default tools');
    // Add default tools even if no windows are open
    const noteTools = createToolsFromCommands(notesCommands);
    const docsTools = createToolsFromCommands(docsCommands);
    commands.push(...noteTools, ...docsTools);

    // Log the tools that will be sent
    logger.log(`[getCommandsForClaude] Added ${commands.length} default tools`);
    return commands;
  }
  
  Object.values(windowContents).forEach(windowContent => {
    const appType = windowContent.appType?.toLowerCase() || '';
    
    // Use flexible matching instead of exact string comparisons
    if ((appType === 'notes' || appType === 'note') && !addedCommands.has('notes')) {
      const noteTools = createToolsFromCommands(notesCommands);
      logger.log(`[getCommandsForClaude] Adding ${noteTools.length} note tools`);
      commands.push(...noteTools);
      addedCommands.add('notes');
    }
    
    if ((appType === 'docs' || appType === 'doc') && !addedCommands.has('docs')) {
      const docsTools = createToolsFromCommands(docsCommands);
      logger.log(`[getCommandsForClaude] Adding ${docsTools.length} docs tools`);
      commands.push(...docsTools);
      addedCommands.add('docs');
    }
    
    if ((appType === 'pdf' || appType === 'pdfium') && !addedCommands.has('pdf')) {
      const pdfiumTools = createToolsFromCommands(pdfiumCommands);
      logger.log(`[getCommandsForClaude] Adding ${pdfiumTools.length} PDF tools`);
      commands.push(...pdfiumTools);
      addedCommands.add('pdf');
    }
  });

  logger.log(`[getCommandsForClaude] Total tools added: ${commands.length}`);
  if (commands.length > 0) {
    logger.log('[getCommandsForClaude] Example tool:', commands[0]);
  }

  return commands;
};

/**
 * Parses a stream from Claude API and handles different event types
 */
const parseStream = async ({
  reader,
  messageId,
  logPrefix,
  onText,
  onToolUse,
  onDone,
  onError,
  signal,
}: ParseStreamOptions): Promise<{ fullResponse: string; toolMessage: any | null }> => {
  let fullResponse = '';
  let toolMessage: any = null;

  try {
    // Process the stream
    while (true) {
      // Check if the operation was aborted
      if (signal?.aborted) {
        console.log(`[spaceChatStore][${logPrefix}] Stream aborted by user`);
        try {
          await reader.cancel();
        } catch (cancelError) {
          console.log(`[spaceChatStore][${logPrefix}] Reader cancel error (expected):`, cancelError);
        }
        return { fullResponse, toolMessage };
      }

      let result: ReadableStreamReadResult<Uint8Array>;
      try {
        // Use Promise.race to make reading more responsive to abort signals
        const readPromise = reader.read();
        const abortPromise = new Promise<never>((_, reject) => {
          if (signal?.aborted) {
            reject(new Error('AbortError'));
            return;
          }
          signal?.addEventListener('abort', () => {
            reject(new Error('AbortError'));
          });
        });

        result = await Promise.race([readPromise, abortPromise]);
      } catch (readError) {
        // Check if the error is due to abort
        if (
          signal?.aborted ||
          (readError instanceof Error && (readError.name === 'AbortError' || readError.message === 'AbortError'))
        ) {
          console.log(`[spaceChatStore][${logPrefix}] Stream read aborted by user`);
          return { fullResponse, toolMessage };
        }
        throw readError;
      }

      const { done, value } = result;
      if (done) break;

      // Check abort signal again after each read
      if (signal?.aborted) {
        console.log(`[spaceChatStore][${logPrefix}] Stream aborted by user after read`);
        try {
          await reader.cancel();
        } catch (cancelError) {
          console.log(`[spaceChatStore][${logPrefix}] Reader cancel error (expected):`, cancelError);
        }
        return { fullResponse, toolMessage };
      }

      // Convert the chunk to text
      const chunk = new TextDecoder().decode(value);
      const lines = chunk.split('\n').filter(line => line.trim());
      
      logger.log(`[spaceChatStore][${logPrefix}] lines: `, lines);
      
      for (const line of lines) {
        // Check abort signal before processing each line
        if (signal?.aborted) {
          console.log(`[spaceChatStore][${logPrefix}] Stream aborted by user during line processing`);
          try {
            await reader.cancel();
          } catch (cancelError) {
            console.log(`[spaceChatStore][${logPrefix}] Reader cancel error (expected):`, cancelError);
          }
          return { fullResponse, toolMessage };
        }

        try {
          // Check for Claude overloaded error specifically
          if (line.includes('overloaded_error')) {
            logger.log(`[spaceChatStore][${logPrefix}] Claude API overloaded:`, line);
            const customError = new Error(
              "Claude's servers are currently experiencing high traffic. Please try again in a few moments.",
            );
            if (onError) {
              onError(customError, messageId);
            }
            return { fullResponse, toolMessage: null };
          }

          const data = JSON.parse(line) as StreamData;

          switch (data.type) {
            case 'text':
              // Update streaming text
              fullResponse += data.content;
              onText(data.content, fullResponse, messageId);
              break;

            case 'tool_use':
              // Handle tool use
              logger.log(`[spaceChatStore][${logPrefix}] Tool use requested:`, data.content);
              toolMessage = data.content;

              if (onToolUse) {
                onToolUse(data.content, messageId);
                // Break the stream processing loop
                try {
                  await reader.cancel();
                } catch (cancelError) {
                  console.log(
                    `[spaceChatStore][${logPrefix}] Reader cancel error after tool use (expected):`,
                    cancelError,
                  );
                }
                return { fullResponse, toolMessage };
              }
              break;

            case 'message_start':
              // Message start event
              logger.log(`[spaceChatStore][${logPrefix}] Message start:`, data.message_id);
              break;

            case 'content_block_start':
              // Content block start event
              logger.log(`[spaceChatStore][${logPrefix}] Content block start:`, data.index);
              break;

            case 'content_block_stop':
              // Content block stop event
              logger.log(`[spaceChatStore][${logPrefix}] Content block stop:`, data.index);
              break;

            case 'message_delta':
              // Message delta event
              logger.log(`[spaceChatStore][${logPrefix}] Message delta:`, data.delta);
              if (data.delta.stop_reason === 'tool_use') {
                logger.log(`[spaceChatStore][${logPrefix}] Tool use stop reason:`, data.delta);
              }
              break;

            case 'message_stop':
              // Message stop event
              logger.log(`[spaceChatStore][${logPrefix}] Message stop`);
              break;

            case 'ping':
              // Ping event - just log it
              logger.log(`[spaceChatStore][${logPrefix}] Ping received`);
              break;

            case 'done':
              // Stream is complete
              logger.log(`[spaceChatStore][${logPrefix}] Stream complete:`, data);
              onDone(fullResponse, messageId, data.conversation_title || '');
              return { fullResponse, toolMessage };

            case 'error':
              throw new Error(data.message || 'Unknown error in stream');

            default:
              logger.log(`[spaceChatStore][${logPrefix}] Unknown event type:`, data);
          }
        } catch (error) {
          logger.error(`[spaceChatStore][${logPrefix}] Error processing stream chunk:`, error, line);
          if (onError) {
            onError(error instanceof Error ? error : new Error(String(error)), messageId);
          }
        }
      }
    }
  } catch (error) {
    // Check if the error is due to abort
    if (
      signal?.aborted ||
      (error instanceof Error &&
        (error.name === 'AbortError' || error.message.includes('aborted') || error.message === 'AbortError'))
    ) {
      console.log(`[spaceChatStore][${logPrefix}] Stream cancelled by user`);
      return { fullResponse, toolMessage };
    }

    console.error(`[spaceChatStore][${logPrefix}] Error processing stream:`, error);
    if (onError) {
      onError(error instanceof Error ? error : new Error(String(error)), messageId);
    }
  } finally {
    // Ensure the reader is always closed
    try {
      await reader.cancel();
    } catch (cancelError) {
      // This is expected if the stream has already been cancelled
      console.log(`[spaceChatStore][${logPrefix}] Reader cancel in finally block (expected):`, cancelError);
    }
  }

  return { fullResponse, toolMessage };
};

const initStream = async (
  content: MessageContent,
  context: SpaceContext & { currentSelection?: SpaceSelection | null },
  messageHistory: ClaudeMessage[],
  model: string,
) => {
  // Create a new AbortController
  const controller = new AbortController();
  const { signal } = controller;

  // Create a deep copy of the context to avoid modifying the original
  const contextWithSelection = { ...context };

  // Include current selection in the context if available
  if (contextWithSelection.currentSelection) {
    logger.log('[initStream] Including selection in context:', contextWithSelection.currentSelection);
  }

  // **DEBUG: Log exactly what context gets sent to Claude**
  const windowIds = Object.keys(contextWithSelection.windowContents || {});
  logger.log('[ai_debug][initStream] Context being sent to Claude:', {
    windowCount: windowIds.length,
    windowIds: windowIds,
    spaceId: contextWithSelection.spaceId,
    hasCurrentSelection: !!contextWithSelection.currentSelection,
    timestamp: Date.now()
  });

  // Log detailed window information
  if (windowIds.length > 0) {
    logger.log('[ai_debug][initStream] Window details being sent to Claude:');
    Object.entries(contextWithSelection.windowContents || {}).forEach(([windowId, content]) => {
      logger.log(`[ai_debug][initStream]   - ${windowId}: ${content.appType} "${content.title || 'Untitled'}"`);
    });
  } else {
    logger.warn('[ai_debug][initStream] ⚠️  No windows in context being sent to Claude!');
  }

  const body: StreamRequestBody = {
    context: contextWithSelection,
    conversation_history: messageHistory,
    tools: getCommandsForClaude(contextWithSelection),
    model,
  };
  let url = CLAUDE_ENDPOINTS.chatStream();
  switch (content.type) {
    case 'text':
      body.query = content.text;
      break;
    case 'tool_result':
      body.output = content.content;
      body.tool_use_id = content.tool_use_id;
      body.stream = true;
      url = CLAUDE_ENDPOINTS.toolOutput();
      break;
  }

  const stringifiedBody = JSON.stringify(body);
  logger.log('[ai_debug][initStream] Full request body keys:', Object.keys(body));
  logger.log('[ai_debug][initStream] Tools being sent:', body.tools.length);
  
  // Create a reader for the stream
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('authToken')}`,
    },
    body: stringifiedBody,
    signal,
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'Failed to process query');
  }

  // Get the reader from the response body
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Failed to get response reader');
  }

  return { reader, controller };
};

const stream = async ({
  messageContent,
  messageId,
  context,
  messageHistory,
  model,
  onText,
  onToolUse,
  onDone,
  onError,
  onControllerReady,
}: StreamOptions) => {
  const { reader, controller } = await initStream(messageContent, context, messageHistory, model);
  // Return the controller so it can be stored and used for cancellation
  onControllerReady?.(controller);
  return {
    result: await parseStream({
      reader,
      messageId,
      logPrefix: 'stream',
      onText,
      onToolUse,
      onDone,
      onError,
      signal: controller.signal,
    }),
    controller,
  };
};

const getModels = async () => {
  const data = await fetchService(CLAUDE_ENDPOINTS.models());
  return data.data;
};

export { parseStream, initStream, stream, getModels };
