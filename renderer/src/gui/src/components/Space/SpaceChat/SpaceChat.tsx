import './SpaceChat.scss';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSpaceStore from '../../../stores/spaceStore';
import { ChatHeader } from './components/chat/ChatHeader';
import { ChatInput } from './components/chat/ChatInput';
import { ChatMessages } from './components/chat/ChatMessages';
import { ThreadHistory } from './components/ThreadHistory';

import { useCommandRegistryStore } from '../../../stores/commandRegistryStore';
import { useUiStore } from './store/uiStore';
import { useChatStore } from './store/chatStore';
import { useMentionStore } from './store/mentionStore';
import { useContextStore } from './store/contextStore';
import { ContextSection } from './components/chat/ContextSection';
import { ModelType } from './components/ModelSelector';
import { useViewMode } from '../contexts/ViewModeContext';
import { useResizable } from './hooks/useResizable';
import { MessageContent } from '../../../types/chat';
import { logger } from '../../../utils/logger';
import { getWindowTitle } from '../utils/windowUtils';
import { contextUtils } from './utils/contextUtils';
import { enhanceToolInput, generateContextDescription } from './utils/simpleWindowTargeting';
import { getDocsAppStore } from '../../../apps/DocsApp/store/docsAppStore';
import { contextService } from '../../../services/contextService';

// Debounce utility for width persistence
const debounce = (func: Function, wait: number) => {
  let timeout: NodeJS.Timeout;
  return function executedFunction(...args: any[]) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

interface SpaceChatProps {
  isVisible: boolean;
  user_id: string;
  setIsVisible: (visible: boolean) => void;
}

const SpaceChat: React.FC<SpaceChatProps> = ({ isVisible, setIsVisible, user_id }) => {
  // Get the current view mode
  const { viewMode } = useViewMode();
  const isFocusedMode = viewMode === 'focused';

  // Container ref for resizing - this now references the chat panel not the wrapper
  const chatPanelRef = useRef<HTMLDivElement>(null);

  // State for the context notification
  const [notification, setNotification] = useState('');
  const [showNotification, setShowNotification] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { activeSpace, windows, activeWindowId, updateSpaceChatSettings } = useSpaceStore();
  const contextStore = useContextStore();
  const { context } = contextStore;
  const { executeCommand } = useCommandRegistryStore();

  // Initialize the context store for handling selections
  useEffect(() => {
    // Clean up when component unmounts
    return () => {
      contextStore.dispose();
      logger.log('[SpaceChat] Disposed context store');
    };
  }, []); // Empty dependency array - only dispose on unmount, not when contextStore reference changes

  // Default widths
  const defaultFocusedWidth = 300;
  const defaultSpatialWidth = 500;

  // Get initial widths from space settings or use defaults
  const getInitialWidths = () => {
    const savedWidths = activeSpace?.settings?.spaceChat?.widths;
    return {
      focused: savedWidths?.focused || defaultFocusedWidth,
      spatial: savedWidths?.spatial || defaultSpatialWidth,
    };
  };

  // Initialize the actual width based on mode
  const initialWidths = getInitialWidths();
  const initialWidth = isFocusedMode ? initialWidths.focused : initialWidths.spatial;

  // Remember chat width for each mode - initialize from space settings
  const [focusedWidth, setFocusedWidth] = useState(initialWidths.focused);
  const [spatialWidth, setSpatialWidth] = useState(initialWidths.spatial);

  // Update local state when space settings change
  useEffect(() => {
    const savedWidths = activeSpace?.settings?.spaceChat?.widths;
    if (savedWidths) {
      setFocusedWidth(savedWidths.focused || defaultFocusedWidth);
      setSpatialWidth(savedWidths.spatial || defaultSpatialWidth);
    }
  }, [activeSpace?.settings?.spaceChat?.widths, defaultFocusedWidth, defaultSpatialWidth]);

  // Debounced width persistence function
  const debouncedPersistWidths = useCallback(
    debounce((widths: { focused: number; spatial: number }) => {
      updateSpaceChatSettings({ widths }).catch(error => {
        logger.error('[SpaceChat] Failed to persist widths:', error);
      });
    }, 500), // 500ms debounce
    [updateSpaceChatSettings],
  );

  // Setup resizable functionality
  const { startResize, isDragging } = useResizable({
    elementRef: chatPanelRef,
    initialWidth: initialWidth,
    minWidth: isFocusedMode ? 250 : 350,
    maxWidth: isFocusedMode ? 500 : 800,
    direction: 'left',
    onWidthChange: (newWidth) => {
      if (isFocusedMode) {
        setFocusedWidth(newWidth);
        // Persist focused width via spaceStore (debounced)
        debouncedPersistWidths({
          focused: newWidth,
          spatial: spatialWidth,
        });
      } else {
        setSpatialWidth(newWidth);
        // Persist spatial width via spaceStore (debounced)
        debouncedPersistWidths({
          focused: focusedWidth,
          spatial: newWidth,
        });
      }
    },
  });

  // Update width when switching modes
  useEffect(() => {
    if (chatPanelRef.current) {
      const newWidth = isFocusedMode ? focusedWidth : spatialWidth;
      chatPanelRef.current.style.width = `${newWidth}px`;
    }
  }, [isFocusedMode, focusedWidth, spatialWidth]);

  const {
    mode,
    setMode,
    model,
    setModel,
    isHistoryOpen,
    setIsHistoryOpen,
    activePreview,
    isContextVisible,
    setIsContextVisible,
    setActivePreview,

    inputText,
    setInputText,
    initializeFromSpaceSettings,
  } = useUiStore();

  const {
    messageEntities,
    threadEntities,
    currentThreadIds,
    createThread,
    setCurrentThread,
    initialize,
    initialized,
    initializationInProgress,

    isProcessing,
    isStreaming,
    isGenerating,
    sendMessage,
    stopStream,
    pendingToolMessageId,
    handleToolResult,
  } = useChatStore(user_id);

  const {
    mentionSearch,
    setMentionSearch,
    mentionSuggestions,
    setMentionSuggestions,
    mentions,
    setMentions,
    mentionStartIndex,
    setMentionStartIndex,
    mentionResults,
    setMentionResults,
    showMentionResults,
    setShowMentionResults,
    handleMentionSelect,
  } = useMentionStore();

  const messages = useMemo(() => {
    const currentThreadId = currentThreadIds[mode];
    if (currentThreadId) {
      const currentThread = threadEntities[currentThreadId];
      logger.log('[SpaceChat][useMemo] current thread:', currentThread);
      if (currentThread) {
        return currentThread.skeleton.message_ids
          .map((messageId) => messageEntities[messageId])
          .filter((message) => message !== undefined);
      }
    }
    return [];
  }, [mode, currentThreadIds, messageEntities]);

  // Add this helper function to find the correct windows for Claude tools
  const findWindowByType = useCallback(
    (type: string, contentId?: string) => {
      if (!windows) return null;

      console.log(`[SpaceChat] Finding window of type: ${type}`);

      // Normalize the requested type for consistent comparisons
      const normalizedType = type.toLowerCase();
      const isPdfType = normalizedType === 'pdf' || normalizedType === 'pdfium';
      const isDocsType = normalizedType === 'docs' || normalizedType === 'doc' || normalizedType === 'document';

      // First try matching windows in the context
      if (context.windowContents && Object.keys(context.windowContents).length > 0) {
        console.log(`[SpaceChat] Checking ${Object.keys(context.windowContents).length} windows in context`);

        // For PDF windows
        if (isPdfType) {
          // First check for windows marked as PDF in our context
          const contextPdfWindows = Object.entries(context.windowContents)
            .filter(([_, content]) => {
              const appType = (content as any)?.appType?.toLowerCase() || '';
              return appType === 'pdf' || appType === 'pdfium';
            })
            .map(([id]) => windows[id])
            .filter((window) => !!window);

          if (contextPdfWindows.length > 0) {
            // Prefer active windows first
            const activeWindow = contextPdfWindows.find((w) => w.id === activeWindowId);
            if (activeWindow) {
              console.log(`[SpaceChat] Found active PDF window from context: ${activeWindow.id}`);
              return activeWindow;
            }

            console.log(`[SpaceChat] Found PDF window from context: ${contextPdfWindows[0].id}`);
            return contextPdfWindows[0];
          }
        }

        // For document windows
        if (isDocsType) {
          // First check context for docs windows
          const contextDocsWindows = Object.entries(context.windowContents)
            .filter(([_, content]) => {
              const appType = (content as any)?.appType?.toLowerCase() || '';
              return appType === 'docs' || appType === 'doc';
            })
            .map(([id]) => windows[id])
            .filter((window) => !!window);

          if (contextDocsWindows.length > 0) {
            // Prefer active windows first
            const activeWindow = contextDocsWindows.find((w) => w.id === activeWindowId);
            if (activeWindow) {
              console.log(`[SpaceChat] Found active docs window from context: ${activeWindow.id}`);
              return activeWindow;
            }

            console.log(`[SpaceChat] Found docs window from context: ${contextDocsWindows[0].id}`);
            return contextDocsWindows[0];
          }
        }
      }

      // If not found in context, check all windows
      console.log(`[SpaceChat] Available windows:`, Object.keys(windows));

      // Function to score window match quality (higher = better match)
      const getMatchScore = (window: any): number => {
        let score = 0;

        // Score for PDF windows
        if (isPdfType) {
          // Check app type matches
          if (window.appType === 'pdfium' || window.appType === 'PDF') score += 10;

          // Check application state
          if ((window.applicationState as any)?.pdfium) score += 5;

          // Check entity file type
          if (
            (window.entity as any)?.entityType === 'File' &&
            ((window.entity as any)?.skeleton?.type || '').toLowerCase().includes('pdf')
          ) {
            score += 3;
          }

          // Check title for PDF extension
          if ((window.title || '').toLowerCase().includes('.pdf')) score += 2;

          // Check if this window is active
          if (window.id === activeWindowId) score += 8;
        }

        // Score for docs windows
        if (isDocsType) {
          // Check app type matches
          if (window.appType === 'docs') score += 10;

          // Check application state
          if ((window.applicationState as any)?.docs) score += 5;

          // Check if this is the active window
          if (window.id === activeWindowId) score += 8;
        }

        return score;
      };

      // Find the best matching window by score
      const windowsWithScores = Object.values(windows)
        .map((win) => ({ window: win, score: getMatchScore(win) }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score);

      if (windowsWithScores.length > 0) {
        const bestMatch = windowsWithScores[0].window;
        console.log(
          `[SpaceChat] Found best match window by score: ${bestMatch.id} (score: ${windowsWithScores[0].score})`,
        );
        return bestMatch;
      }

      // Last resort: if we're looking for a specific type and find exactly one window of that type
      if (isPdfType) {
        const pdfWindows = Object.values(windows).filter(
          (w) => w.appType === 'pdfium' || w.appType === 'PDF' || (w.title || '').toLowerCase().includes('.pdf'),
        );

        if (pdfWindows.length === 1) {
          console.log(`[SpaceChat] Found single PDF window as last resort: ${pdfWindows[0].id}`);
          return pdfWindows[0];
        }
      }

      if (isDocsType) {
        const docsWindows = Object.values(windows).filter(
          (w) => w.appType === 'docs' || (w.applicationState as any)?.docs,
        );

        if (docsWindows.length === 1) {
          console.log(`[SpaceChat] Found single docs window as last resort: ${docsWindows[0].id}`);
          return docsWindows[0];
        }
      }

      console.log(`[SpaceChat] Could not find window of type: ${type}`);
      return null;
    },
    [windows, context.windowContents, activeWindowId],
  );

  // Expose the window finder function to the context store
  useEffect(() => {
    if (contextStore && typeof findWindowByType === 'function') {
      (contextStore as any).findWindowByType = findWindowByType;

      return () => {
        delete (contextStore as any).findWindowByType;
      };
    }
  }, [contextStore, findWindowByType]);

  // Tool execution handling
  useEffect(() => {
    if (pendingToolMessageId) {
      const toolMessage = messageEntities[pendingToolMessageId];
      const toolUse = toolMessage?.skeleton.content.find((content) => content.type === 'tool_use');

      // Always keep isGenerating true while a tool is pending
      if (!isGenerating && pendingToolMessageId) {
        logger.log('[SpaceChat] Tool execution detected, ensuring isGenerating is true');
      }

      if (toolUse && toolUse.type === 'tool_use' && toolUse.name && toolUse.id) {
        console.log('[SpaceChat][useEffect] Executing tool:', toolUse);

        // Special handling for window-specific tools
        const input = { ...toolUse.input };
        // Get typed versions of the tool properties we know are defined (TypeScript safeguard)
        const toolName = toolUse.name;
        const toolId = toolUse.id;
        const originalInput = { ...toolUse.input };

        // Track if we used backend enhancement
        let usedBackendEnhancement = false;

        // Get the most recent user message to provide context for tool enhancement
        const threadId = toolMessage.skeleton.thread_id;
        const threadMessages =
          threadEntities[threadId]?.skeleton.message_ids
            .map((id) => messageEntities[id])
            .filter((msg) => msg?.skeleton?.sender === 'user') || [];

        const lastUserMessage =
          threadMessages.length > 0
            ? threadMessages[threadMessages.length - 1]?.skeleton.content
                .filter((c) => c.type === 'text')
                .map((c) => {
                  // Use proper type assertion with a type guard
                  if (c.type === 'text' && 'text' in c) {
                    return c.text;
                  }
                  return '';
                })
                .join(' ')
            : '';

        // Make sure we have spaceId for tools that need it
        if (
          (toolName.startsWith('docs_') || toolName.startsWith('note_')) &&
          (!input.spaceId || input.spaceId === 'undefined')
        ) {
          if (activeSpace?.id) {
            input.spaceId = activeSpace.id;
            console.log(`[SpaceChat] Added spaceId from active space: ${activeSpace.id}`);
          }
        }

        // Try to enhance the tool input with the backend service first
        const enhanceToolAsync = async () => {
          try {
            // For tools that may need window ID resolution
            if (
              toolName.startsWith('docs_') ||
              toolName.startsWith('pdf_') ||
              toolName.startsWith('note_') ||
              input.windowId === undefined
            ) {
              console.log('[SpaceChat] Attempting to enhance tool input with backend service');
              console.log('[SpaceChat] Original input:', JSON.stringify(input));
              console.log('[SpaceChat] Context window count:', Object.keys(context.windowContents || {}).length);

              // Call the context service to enhance the tool input
              const enhancedInput = await contextService.enhanceTool({
                tool_name: toolName,
                tool_input: input,
                user_message: lastUserMessage,
                context: context,
                user_id: user_id,
              });

              if (enhancedInput.was_modified) {
                usedBackendEnhancement = true;
                console.log('[SpaceChat] Backend enhanced tool input:', enhancedInput.tool_input);
                console.log('[SpaceChat] Original windowId:', input.windowId);
                console.log('[SpaceChat] New windowId:', enhancedInput.tool_input.windowId);
                executeToolWithInput(enhancedInput.tool_input);
                return;
              } else {
                console.log('[SpaceChat] Backend did not modify tool input, falling back to local enhancement');
              }
            } else {
              console.log('[SpaceChat] Not using backend enhancement - already has valid windowId:', input.windowId);
            }

            // Fallback to local enhancement if backend service didn't modify the input
            enhanceInputLocally();
          } catch (error) {
            console.error('[SpaceChat] Error enhancing tool input with backend:', error);
            // Fallback to local enhancement
            enhanceInputLocally();
          }
        };

        // Local input enhancement similar to original logic
        const enhanceInputLocally = () => {
          // Validate inputs for window-specific tools
          let validationResult = { valid: true, message: '' };

          // Fix common AI errors - using the docs window for PDF operations or vice versa
          const isPdfTool = toolName.startsWith('pdf_');
          const isDocsTool = toolName.startsWith('docs_');

          if (input.windowId && windows[input.windowId]) {
            const window = windows[input.windowId];

            // Check if using wrong window type for the tool
            if (isPdfTool && window.appType !== 'pdfium') {
              console.log(
                `[SpaceChat] AI is trying to use a non-PDF window (${window.appType}) for PDF tool ${toolName}`,
              );

              // Try to find a PDF window instead
              const pdfWindow = Object.values(windows).find((w) => w.appType === 'pdfium');
              if (pdfWindow) {
                console.log(`[SpaceChat] Switching to PDF window: ${pdfWindow.id}`);
                input.windowId = pdfWindow.id;
              } else {
                validationResult = {
                  valid: false,
                  message: 'No PDF window found in the workspace',
                };
              }
            } else if (isDocsTool && window.appType !== 'docs') {
              console.log(
                `[SpaceChat] AI is trying to use a non-docs window (${window.appType}) for docs tool ${toolName}`,
              );

              // Try to find a docs window instead
              const docsWindow = Object.values(windows).find((w) => w.appType === 'docs');
              if (docsWindow) {
                console.log(`[SpaceChat] Switching to docs window: ${docsWindow.id}`);
                input.windowId = docsWindow.id;

                // Make sure spaceId is set for docs operations
                if (!input.spaceId && activeSpace?.id) {
                  input.spaceId = activeSpace.id;
                }
              } else {
                validationResult = {
                  valid: false,
                  message: 'No docs window found in the workspace',
                };
              }
            }
          } else if (!input.windowId || !windows[input.windowId]) {
            // Handle missing windowId
            if (isPdfTool) {
              // Find any PDF window
              const pdfWindow = Object.values(windows).find((w) => w.appType === 'pdfium');
              if (pdfWindow) {
                console.log(`[SpaceChat] Using PDF window: ${pdfWindow.id}`);
                input.windowId = pdfWindow.id;
              } else {
                validationResult = {
                  valid: false,
                  message: 'No PDF window found in the workspace',
                };
              }
            } else if (isDocsTool) {
              // Find any docs window
              const docsWindow = Object.values(windows).find((w) => w.appType === 'docs');
              if (docsWindow) {
                console.log(`[SpaceChat] Using docs window: ${docsWindow.id}`);
                input.windowId = docsWindow.id;

                // Make sure spaceId is set for docs operations
                if (!input.spaceId && activeSpace?.id) {
                  input.spaceId = activeSpace.id;
                }
              } else {
                validationResult = {
                  valid: false,
                  message: 'No docs window found in the workspace',
                };
              }
            }
          }

          if (validationResult.valid) {
            executeToolWithInput(input);
          } else {
            // If validation failed, return error to model
            const errorOutput = {
              status: 'error',
              message: validationResult.message,
              data: null,
            };

            console.log('[SpaceChat] Returning validation error to model:', errorOutput);
            handleToolResult(toolId, errorOutput, context, toolMessage.skeleton.thread_id, model);
          }
        };

        // Execute the tool with the given input
        const executeToolWithInput = (finalInput: any, enhancementReason?: string) => {
          // **DEBUG: Log what input actually gets executed**
          logger.log(`[ai_debug][SpaceChat][executeToolWithInput] 🔧 Executing tool:`, {
            toolName,
            windowId: finalInput.windowId,
            enhancementReason,
            inputKeys: Object.keys(finalInput)
          });
          
          executeCommand(toolName, {
            ...finalInput,
            callback: (output: any) => {
              // **DEBUG: Log the tool execution result**
              logger.log(`[ai_debug][SpaceChat][executeToolWithInput] 📋 Tool execution result:`, {
                toolName,
                executedWindowId: finalInput.windowId,
                success: !output.error,
                outputKeys: Object.keys(output || {}),
                // **DEBUG: Log actual output for docs tools to see what's happening**
                ...(toolName.startsWith('docs_') && {
                  actualOutput: output,
                  outputLength: typeof output === 'string' ? output.length : 'not_string'
                })
              });

              // Format the output as a structured result
              const structuredOutput = output.error
                ? {
                    status: 'error',
                    message: `Error executing ${toolName}: ${output.error}`,
                    data: null,
                  }
                : {
                    status: 'success',
                    message: `Successfully executed ${toolName}`,
                    data: output,
                  };

              // Check if we should still process this (user didn't click stop)
              if (pendingToolMessageId) {
                logger.log('[SpaceChat][useEffect] Tool used:', toolUse, structuredOutput);
                
                // For certain tools, we should refresh the context after execution
                const needsContextRefresh =
                  toolName.startsWith('docs_open') ||
                  toolName.startsWith('pdf_open') ||
                  toolName.includes('create') ||
                  toolName.includes('edit');

                if (needsContextRefresh) {
                  try {
                    logger.log('[SpaceChat] Tool execution modified content, refreshing context');
                    
                    // Update the context refresh timestamp to force a refresh
                    const updatedContext = {
                      ...context,
                      _refreshTimestamp: Date.now(),
                    };

                    // For specific tool types, try to add the target window to context
                    if (finalInput.windowId && windows && windows[finalInput.windowId]) {
                      logger.log(`[SpaceChat] Adding window ${finalInput.windowId} to context after tool execution`);
                      contextStore.addWindowToContext(finalInput.windowId);

                      // If context panel isn't visible, make it visible
                      if (!isContextVisible) {
                        setIsContextVisible(true);
                      }
                    }

                    // Handle the tool result with the refreshed context
                    handleToolResult(toolId, structuredOutput, updatedContext, toolMessage.skeleton.thread_id, model);
                    return; // Skip the normal handling below
                  } catch (refreshError) {
                    logger.error('[SpaceChat] Error refreshing context:', refreshError);
                  }
                }

                // For tools that don't need context refresh, just handle normally
                handleToolResult(toolId, structuredOutput, context, toolMessage.skeleton.thread_id, model);
              } else {
                logger.log('[SpaceChat][useEffect] Tool execution was cancelled');
              }
            },
            context,
          });
        };

        // Start the enhancement process
        enhanceToolAsync();
      }
    }
  }, [
    pendingToolMessageId,
    messageEntities,
    executeCommand,
    context,
    model,
    handleToolResult,
    isGenerating,
    findWindowByType,
    windows,
    activeSpace,
    user_id,
    threadEntities,
    isContextVisible,
    setIsContextVisible,
    contextStore,
  ]);

  useEffect(() => {
    if (!initialized && !initializationInProgress) {
      initialize();
    }
  }, [initialize, initialized, initializationInProgress]);

  // Initialize UI store from space settings
  useEffect(() => {
    if (activeSpace?.id) {
      initializeFromSpaceSettings();
    }
  }, [activeSpace?.id, initializeFromSpaceSettings]);

  // TODO: debug log, remove later
  useEffect(() => {
    logger.log('[SpaceChat][useEffect] chat state:', {
      threadEntities,
      currentThreadIds,
      mode,
      messageEntities,
      messages,
      isStreaming,
      isProcessing,
    });
  }, [threadEntities, mode, currentThreadIds, messageEntities, messages, isStreaming, isProcessing]);

  // Debug the AI generation state changes
  useEffect(() => {
    logger.log('[SpaceChat] AI generation state:', { 
      isGenerating, 
      isStreaming, 
      isProcessing, 
      pendingToolMessageId 
    });
  }, [isGenerating, isStreaming, isProcessing, pendingToolMessageId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInputText(value);

    // Auto-adjust height
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;

    // Handle mention suggestions
    const lastAtIndex = value.lastIndexOf('@');
    if (lastAtIndex !== -1 && (lastAtIndex === 0 || value[lastAtIndex - 1] === ' ')) {
      const searchText = value.substring(lastAtIndex + 1).split(' ')[0];
      setMentionSearch(searchText);
      setMentionStartIndex(lastAtIndex);

      // Filter windows based on search text
      const filteredWindows = Object.values(windows).filter((window) =>
        (window as any)?.name?.toLowerCase().includes(searchText.toLowerCase()),
      );

      setMentionResults(filteredWindows);
      setShowMentionResults(true);
    } else {
      setShowMentionResults(false);
    }
  };

  // Handle paste events to process document metadata
  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const pastedText = e.clipboardData.getData('text/plain');

      // Check if the pasted text contains the document metadata format
      const metadataMatch = pastedText.match(/\n\nDOC:([^:]+):LINES=(\d+)-(\d+)$/);
      if (metadataMatch) {
        e.preventDefault(); // Prevent default paste behavior

        const [fullMatch, docId, startLine, endLine] = metadataMatch;
        console.log('[SpaceChat] Detected document text with node metadata:', { docId, startLine, endLine });

        // Extract the actual text (without the metadata suffix)
        const actualText = pastedText.replace(fullMatch, '');

        // Find the corresponding document window
        const docWindow = Object.values(windows).find(
          (window) => (window as any).applicationState?.docs?.activeDocId === docId,
        );

        if (docWindow) {
          // Make sure the window is in the context
          contextStore.addWindowToContext(docWindow.id);

          // Create a pasted context with node range
          const pastedContext = {
            text: actualText,
            source: {
              window: docWindow,
              type: 'docs',
              metadata: {
                docId,
                nodeRange: {
                  startLine: parseInt(startLine, 10),
                  endLine: parseInt(endLine, 10),
                },
              },
            },
          };

          // Store in context
          contextStore.setPastedContext(pastedContext);

          // Show notification
          const windowName = (docWindow as any).name || (docWindow as any).title || 'document';
          const nodeText = startLine === endLine ? `line ${startLine}` : `lines ${startLine}-${endLine}`;
          const notificationMessage = `Added ${nodeText} from ${windowName} to context`;
          showContextNotification(notificationMessage);

          // Hide notification after a few seconds
          setTimeout(() => {
            setShowNotification(false);
          }, 3000);
        } else {
          // Document window not found, just paste normally
          console.warn('[SpaceChat] Could not find document window for:', docId);
          return true;
        }
      }
      // For regular text without metadata, let default paste behavior happen
    },
    [windows, contextStore],
  );

  // Show a notification message
  const showContextNotification = (message: string, duration = 3000) => {
    setNotification(message);
    setShowNotification(true);

    // Hide notification after duration
    setTimeout(() => {
      setShowNotification(false);
    }, duration);
  };

  // Function to analyze message for context clues and entity references
  const analyzeMessage = useCallback(
    async (message: string) => {
      if (!message.trim()) return;

      try {
        console.log('[SpaceChat] Analyzing message for context clues:', message);

        const analysisResult = await contextService.analyzeMessage({
          message,
          context,
          user_id,
        });

        if (analysisResult.entities.length > 0 || analysisResult.matching_windows.length > 0) {
          console.log('[SpaceChat] Analysis found context clues:', analysisResult);

          // If we found matching windows with high confidence, add them to context
          const highConfidenceMatches = analysisResult.matching_windows.filter((match) => match.confidence > 0.7);

          if (highConfidenceMatches.length > 0) {
            // Add windows to context
            highConfidenceMatches.forEach((match) => {
              if (windows[match.windowId]) {
                console.log(`[SpaceChat] Adding window ${match.windowId} to context based on message analysis`);
                contextStore.addWindowToContext(match.windowId);

                // Show notification for first match
                if (highConfidenceMatches[0].windowId === match.windowId) {
                  const windowName = windows[match.windowId].title || match.entityName;
                  showContextNotification(`Added ${windowName} to context`);
                }
              }
            });
          }
        }
      } catch (error) {
        console.error('[SpaceChat] Error analyzing message:', error);
      }
    },
    [context, user_id, windows, contextStore, showContextNotification],
  );

  // Update handleSendMessage to use pasted context
  const handleSendMessage = useCallback(async () => {
    if (!inputText.trim() || isProcessing || isStreaming) return;

    try {
      // Simple message analysis (no backend call)
      await analyzeMessage(inputText);
      
      logger.log('[SpaceChat][handleSendMessage] Context:', context);

      // Get the current context
      const currentContext = { ...context };

      // Add pasted context if it exists
      const pastedContent = contextStore.getPastedContext();
      if (pastedContent) {
        console.log('[SpaceChat][handleSendMessage] Including pasted context:', pastedContent);
        currentContext.currentSelection = pastedContent;
      }

      // **DEBUG: Log what context will be sent to Claude**
      const windowIds = Object.keys(currentContext.windowContents || {});
      logger.log('[ai_debug][SpaceChat][handleSendMessage] 🚀 About to send to Claude:', {
        windowCount: windowIds.length,
        windowIds: windowIds,
        inputLength: inputText.length
      });

      let currentThreadId = currentThreadIds[mode];
      if (currentThreadId) {
        await sendMessage({
          content: { type: 'text', text: inputText },
          threadId: currentThreadId,
          mode,
          context: currentContext,
          model,
        });
      } else {
        const threadId = createThread(mode);
        await sendMessage({
          content: { type: 'text', text: inputText },
          threadId,
          mode,
          context: currentContext,
          model,
        });
      }
    } catch (error) {
      logger.error('Error sending message:', error);
    }
  }, [
    inputText,
    isProcessing,
    isStreaming,
    activeWindowId,
    windows,
    executeCommand,
    activeSpace?.id,
    sendMessage,
    currentThreadIds,
    mode,
    context,
    contextStore,
    createThread,
    model,
    analyzeMessage,
  ]);

  // Render model selector
  const renderModelSelector = () => (
    <div className="model-selector">
      <select value={model} onChange={(e) => setModel(e.target.value)}>
        <option value="claude-3.5-sonnet">Claude 3.5 Sonnet</option>
        <option value="claude-3-opus">Claude 3 Opus</option>
        <option value="claude-3-sonnet">Claude 3 Sonnet</option>
        <option value="claude-3-haiku">Claude 3 Haiku</option>
      </select>
    </div>
  );

  const handleClear = () => {
    setInputText('');
    // setMessages([]);
    // setActivePreview(null);
    setIsHistoryOpen(false);
  };

  const getModeDescription = () => {
    switch (mode) {
      case 'create':
        return 'Create mode';
      case 'chat':
        return 'Chat mode';
      case 'editor':
        return 'Editor mode';
      case 'exp1':
        return 'Experimental mode 1';
      default:
        return 'Unknown mode';
    }
  };

  // Convert our internal model state to the ModelType expected by the ModelSelector component
  const handleModelChange = (newModel: ModelType) => {
    logger.log(`[SpaceChat] Changing model to: ${newModel}`);
    setModel(newModel as string);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage();
    setInputText('');
  };

  const handleNewChat = () => {
    logger.log('[SpaceChat] handleNewChat called');
    logger.log('[SpaceChat] Current messages length:', messages.length);
    logger.log('[SpaceChat] Current mode:', mode);
    logger.log('[SpaceChat] Current thread ID:', currentThreadIds[mode]);
    
    // Always create a new thread, regardless of whether there are existing messages
    const newThreadId = createThread(mode);
    logger.log('[SpaceChat] Created new thread:', newThreadId);
    
    // Show notification that a new thread was created
    showContextNotification('New conversation started!', 2000);

    setIsHistoryOpen(false);
  };

  const toggleHistory = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsHistoryOpen(!isHistoryOpen);
  };

  const handleRemoveContext = (windowId: string) => {
    logger.log(`Removed context for window ${windowId}`);
    // You can add additional logic here if needed when context is removed
  };

  // Handle stopping the AI stream
  const handleStopGeneration = useCallback(() => {
    // Stop AI generation if active
    if (isGenerating || pendingToolMessageId) {
      logger.log('[SpaceChat] Stopping AI generation');
      stopStream();
    }
  }, [stopStream, isGenerating, pendingToolMessageId]);

  // **DEBUG: Comprehensive debug dump function**
  const handleDebugDump = useCallback(() => {
    console.group('🔍 [SpaceChat Debug Dump]');
    
    try {
      // Space Store Analysis
      console.group('📦 Space Store');
      const spaceInfo = (window as any).windowDebug?.inspectSpaceStore?.() || { error: 'windowDebug not available' };
      console.log('Space Store State:', spaceInfo);
      console.groupEnd();
      
      // Context Store Analysis  
      console.group('🎯 Context Store');
      console.log('Context Object:', context);
      console.log('Context Window Count:', Object.keys(context?.windowContents || {}).length);
      console.log('Context Window IDs:', Object.keys(context?.windowContents || {}));
      console.groupEnd();
      
      // Store Comparison
      console.group('⚖️ Space vs Context Comparison');
      const allSpaceWindows = Object.keys(windows || {});
      const contextWindows = Object.keys(context?.windowContents || {});
      const windowsNotInContext = allSpaceWindows.filter(id => !contextWindows.includes(id));
      const contextWindowsNotInSpace = contextWindows.filter(id => !allSpaceWindows.includes(id));
      
      console.log('Total Space Windows:', allSpaceWindows.length);
      console.log('Total Context Windows:', contextWindows.length);
      console.log('Windows in Space but NOT in Context:', windowsNotInContext);
      console.log('Context Windows NOT in Space:', contextWindowsNotInSpace);
      console.groupEnd();
      
      // Docs Store Analysis
      console.group('📄 Docs Store Analysis');
      const docsInfo = (window as any).windowDebug?.inspectDocsStore?.() || { error: 'Could not inspect docs store' };
      console.log('Docs Store State:', docsInfo);
      console.groupEnd();
      
      // Recent Windows
      console.group('🕐 Recent Windows Analysis');
      const recentWindows = Object.entries(windows || {})
        .map(([id, win]) => ({
          id,
          appType: win.appType,
          title: win.title || 'Untitled',
          inContext: !!context?.windowContents?.[id],
          isActive: id === activeWindowId,
          // Extract timestamp from window ID
          timestamp: id.match(/window-(\d+)-/)?.[1] || '0'
        }))
        .sort((a, b) => parseInt(b.timestamp) - parseInt(a.timestamp))
        .slice(0, 5);
      
      console.log('5 Most Recent Windows:', recentWindows);
      console.groupEnd();
      
      // AI State
      console.group('🤖 AI State');
      console.log('Is Processing:', isProcessing);
      console.log('Is Streaming:', isStreaming);
      console.log('Is Generating:', isGenerating);
      console.log('Pending Tool Message ID:', pendingToolMessageId);
      console.log('Current Model:', model);
      console.log('Current Mode:', mode);
      console.groupEnd();
      
      // Context Store Methods
      console.group('🛠️ Available Context Methods');
      console.log('Context Store Methods:', Object.keys(contextStore));
      console.log('Window Debug Methods:', Object.keys((window as any).windowDebug || {}));
      console.groupEnd();
      
    } catch (error) {
      console.error('Error during debug dump:', error);
    }
    
    console.groupEnd();
    
    // Also log a summary message
    console.log(`
🔍 DEBUG SUMMARY:
- Space has ${Object.keys(windows || {}).length} windows
- Context has ${Object.keys(context?.windowContents || {}).length} windows  
- Active Window: ${activeWindowId}
- Space ID: ${activeSpace?.id}
- AI State: ${isGenerating ? 'Generating' : isProcessing ? 'Processing' : 'Idle'}
    `);
  }, [windows, context, activeWindowId, activeSpace, isGenerating, isProcessing, isStreaming, pendingToolMessageId, model, mode, contextStore]);

  // Determine classes based on view mode
  const chatWrapperClass = `chat-wrapper ${isFocusedMode ? 'chat-wrapper-focused' : ''}`;
  const chatPanelClass = `chat-panel ${isFocusedMode ? 'chat-panel-focused' : ''} ${isDragging ? 'resizing' : ''}`;

  // Determine position of resize handle based on mode
  const resizeHandleClass = `resize-handle ${isFocusedMode ? 'resize-handle-left' : 'resize-handle-right'}`;

  // Add a listener for changes to context items
  useEffect(() => {
    const handleContextChange = () => {
      // Add your logic here for context changes
      logger.log('[SpaceChat] Context changed');
    };

    // Clean up event listener
    return () => {
      // Clean up logic
    };
  }, []);

  // Listen for SpaceContents visibility changes
  useEffect(() => {
    const handleSpaceContentsOpened = (event: Event) => {
      // Show notification when SpaceContents is opened
      showContextNotification('Space Contents panel opened. Select a window to add to context.');
    };

    // Listen for a custom event that would be triggered when SpaceContents is opened
    window.addEventListener('space-contents-opened', handleSpaceContentsOpened);

    return () => {
      window.removeEventListener('space-contents-opened', handleSpaceContentsOpened);
    };
  }, []);

  // Add a debugging tool to help diagnose window issues
  useEffect(() => {
    // Add window debugging capabilities
    (window as any).windowDebug = {
      // List all windows with their relevant properties
      listWindows: () => {
        if (!windows) return { error: 'No windows available' };

        return Object.entries(windows).map(([id, win]) => ({
          id,
          type: win.type,
          appType: win.appType,
          hasEntity: !!win.entity,
          entityType: (win.entity as any)?.entityType,
          hasAppState: !!win.applicationState,
          appStateKeys: win.applicationState ? Object.keys(win.applicationState) : [],
          position: win.position,
          title: win.title || '(no title)',
          size: win.size,
        }));
      },
      
      // Show current context in Cursor-style format
      showContext: () => {
        return generateContextDescription(context, windows, activeWindowId);
      },
      
      // Test window targeting for a specific tool
      testWindowTargeting: (toolName: string) => {
        const result = enhanceToolInput(
          toolName,
          { /* empty input */ },
          context,
          windows || {},
          activeWindowId,
          activeSpace?.id
        );
        
        return {
          tool: toolName,
          result: result.wasModified ? 'enhanced' : 'no_changes',
          input: result.input,
          reason: result.reason,
          error: result.error
        };
      },

      // Test PDF window detection
      findPdfWindow: () => {
        const pdfWindow = findWindowByType('pdfium');
        return pdfWindow
          ? {
              found: true,
              id: pdfWindow.id,
              entity: pdfWindow.entity,
              appState: pdfWindow.applicationState,
            }
          : { found: false };
      },

      // Test docs window detection
      findDocsWindow: () => {
        const docsWindow = findWindowByType('docs');
        return docsWindow
          ? {
              found: true,
              id: docsWindow.id,
              appState: docsWindow.applicationState,
              docInfo: (docsWindow.applicationState as any)?.docs,
            }
          : { found: false };
      },

      // Test a specific tool with a specific window
      testTool: (toolName: string, windowId: string) => {
        if (!windows[windowId]) {
          return { error: `Window ${windowId} not found` };
        }
        
        // Use the new targeting system to enhance the input
        const targetingResult = enhanceToolInput(
          toolName,
          { windowId },
          context,
          windows || {},
          activeWindowId,
          activeSpace?.id
        );
        
        if (targetingResult.error) {
          return { error: targetingResult.error };
        }
        
        const finalInput = targetingResult.input;
        

        // Determine whether we need spaceId (for docs tools)
        const needsSpaceId = toolName.startsWith('docs_');
        const spaceId = activeSpace?.id;

        // Sample inputs based on tool type
        const input: any = { windowId };
        if (needsSpaceId) input.spaceId = spaceId;

        // Add tool-specific parameters
        if (toolName === 'pdf_getPage') {
          input.pageNumber = 1;
        }

        // Execute the command and return a promise
        return new Promise((resolve) => {
          executeCommand(toolName, {
            ...finalInput,
            callback: (output: any) => {
              resolve({
                tool: toolName,
                input: finalInput,
                output,
                success: !output.error,
                targeting: {
                  wasModified: targetingResult.wasModified,
                  reason: targetingResult.reason
                }
              });
            },
          });
        });
      },
    };

    return () => {
      delete (window as any).windowDebug;
    };
  }, [windows, executeCommand, activeSpace, context, activeWindowId, activeSpace, isGenerating, isProcessing, isStreaming, pendingToolMessageId, model, mode, contextStore]);

  const handleRetryLastMessage = useCallback(() => {
    // Get the last user message
    const currentThreadId = currentThreadIds[mode];
    if (!currentThreadId) return;

    const currentThread = threadEntities[currentThreadId];
    if (!currentThread) return;

    // Find the last user message
    const userMessages = currentThread.skeleton.message_ids
      .map((id) => messageEntities[id])
      .filter((msg) => msg?.skeleton?.sender === 'user');

    if (userMessages.length === 0) return;

    const lastUserMessage = userMessages[userMessages.length - 1];
    const lastUserContent = lastUserMessage.skeleton.content.find((c) => c.type === 'text');

    if (!lastUserContent || lastUserContent.type !== 'text') return;

    // Set the input text to the last message
    setInputText(lastUserContent.text);

    // Focus the input
    const textarea = document.querySelector('.chat-input textarea');
    if (textarea) {
      (textarea as HTMLTextAreaElement).focus();
    }
  }, [currentThreadIds, mode, threadEntities, messageEntities, setInputText]);

  // Calculate current thread name
  const currentThreadName = useMemo(() => {
    const currentThreadId = currentThreadIds[mode];
    if (currentThreadId && threadEntities[currentThreadId]) {
      return threadEntities[currentThreadId].name;
    }
    return null;
  }, [currentThreadIds, mode, threadEntities]);

  // Create a function to get entity metadata from windowId
  const getEntityMetadata = useCallback((windowId: string) => {
    // Get the window from spaceStore
    const window = windows[windowId];
    if (window) {
      // Use existing infrastructure to get meaningful information
      const title = getWindowTitle(window);
      const appType = window.appType;
      
      return {
        name: title,
        type: appType
      };
    }
    
    return null;
  }, [windows]);

  return (
    <div className={chatWrapperClass}>
      {/* Only show toggle button in spatial mode */}
      {!isFocusedMode && (
        <button className="chat-button" onClick={() => setIsVisible(!isVisible)}>
          {isVisible ? '💬' : '💬'}
        </button>
      )}

      {/* In focused mode, always show; in spatial mode, only show when isVisible */}
      {(isFocusedMode || isVisible) && (
        <div className={chatPanelClass} ref={chatPanelRef}>
          {/* Resize handle - positioned different based on mode */}
          <div className={resizeHandleClass} onMouseDown={startResize} />

          {/* Context notification toast */}
          <div className={`context-notification ${showNotification ? 'visible' : ''}`}>{notification}</div>

          <ChatHeader
            mode={mode}
            setMode={setMode}
            onNewChat={handleNewChat}
            onClose={() => !isFocusedMode && setIsVisible(false)}
            getModeDescription={getModeDescription}
            threads={threadEntities}
            currentThreadName={currentThreadName}
          >
            <div className="header-buttons">
              <button type="button" className="chatHeaderButton" onClick={toggleHistory}>
                🕰️
              </button>
              <button
                type="button"
                className="chatHeaderButton"
                onClick={(e) => {
                  console.log('[SpaceChat] New button clicked!', e);
                  handleNewChat();
                }}
              >
                New
              </button>
              {/* Debug button */}
              <button 
                type="button" 
                className="chatHeaderButton" 
                onClick={handleDebugDump}
                title="Dump debug info to console"
                style={{ fontSize: '12px' }}
              >
                🔍 Debug
              </button>
              {/* Only show close button in spatial mode */}
              {!isFocusedMode && (
                <button className="closeButton" onClick={() => setIsVisible(false)}>
                  ×
                </button>
              )}
            </div>
          </ChatHeader>

          {isHistoryOpen && (
            <ThreadHistory
              threads={threadEntities}
              currentThreadId={currentThreadIds[mode]}
              onSelectThread={(threadId) => setCurrentThread(mode, threadId)}
              onClose={() => setIsHistoryOpen(false)}
            />
          )}

          <ChatMessages
            messages={messages}
            isLoading={isStreaming || isProcessing}
            activePreview={activePreview}
            setActivePreview={setActivePreview}
            messagesEndRef={messagesEndRef}
            onRetry={handleRetryLastMessage}
            getEntityMetadata={getEntityMetadata}
          />

          <div className="chat-controls">
            {(isGenerating || pendingToolMessageId) && (
              <>
                <div className="generating-indicator">
                  <span className="generating-text">Generating</span>
                  <span className="generating-dots">
                    <span className="dot">.</span>
                    <span className="dot">.</span>
                    <span className="dot">.</span>
                  </span>
                </div>
                <button
                  className="stop-button"
                  onClick={handleStopGeneration}
                  title="Stop AI generation"
                >
                  Stop AI
                </button>
              </>
            )}
          </div>

          <ContextSection isVisible={true} onRemove={handleRemoveContext} onNotification={showContextNotification} />

          <ChatInput
            inputText={inputText}
            isProcessing={isProcessing}
            isStreaming={isStreaming}
            mode={mode}
            setMode={setMode}
            model={model as unknown as ModelType}
            onModelChange={handleModelChange}
            mentionSuggestions={mentionSuggestions}
            onInputChange={handleInputChange}
            onSubmit={handleSubmit}
            onPaste={handlePaste}
            onMentionSelect={handleMentionSelect}
            getModeDescription={getModeDescription}
            threads={threadEntities}
          />
        </div>
      )}
    </div>
  );
};

export default SpaceChat;
