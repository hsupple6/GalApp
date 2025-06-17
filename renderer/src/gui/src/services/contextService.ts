import { API_BASE_URL } from '../api/config';
import { logger } from '../utils/logger';

/**
 * Interface for tool enhancement input
 */
export interface ToolEnhancementInput {
  tool_name: string;
  tool_input: Record<string, any>;
  user_message: string;
  context: Record<string, any>;
  user_id?: string;
}

/**
 * Interface for tool enhancement result
 */
export interface ToolEnhancementResult {
  tool_input: Record<string, any>;
  was_modified: boolean;
  tool_name: string;
}

/**
 * Interface for message analysis input
 */
export interface MessageAnalysisInput {
  message: string;
  context: Record<string, any>;
  user_id?: string;
}

/**
 * Interface for message analysis result
 */
export interface MessageAnalysisResult {
  entities: Array<{
    type: string;
    name: string;
    confidence: number;
    source: string;
  }>;
  matching_windows: Array<{
    windowId: string;
    entityName: string;
    confidence: number;
    windowType: string;
    isActive: boolean;
  }>;
}

/**
 * Service for context processing and enhancement
 */
class ContextService {
  /**
   * Enhance tool inputs by identifying the right window or entity based on context
   * 
   * @param params Tool enhancement parameters
   * @returns Enhanced tool input
   */
  public async enhanceTool(params: ToolEnhancementInput): Promise<ToolEnhancementResult> {
    try {
      logger.log('[ContextService] Enhancing tool:', {
        tool_name: params.tool_name,
        input: params.tool_input,
        message_length: params.user_message?.length || 0
      });

      // Log window contents to help with debugging
      const windowIds = Object.keys(params.context?.windowContents || {});
      logger.log(`[ContextService] Context has ${windowIds.length} windows:`, windowIds);
      
      // Handle PDF tool operations locally if possible (faster than calling API)
      if (params.tool_name.startsWith('pdf_') && (!params.tool_input.windowId || params.tool_input.windowId === 'undefined')) {
        // Find all PDF windows in context
        const pdfWindows = Object.entries(params.context?.windowContents || {})
          .filter(([_, content]) => (content as any)?.appType === 'PDF')
          .map(([id, content]) => ({ 
            id, 
            title: (content as any)?.title || '',
            isActive: (content as any)?.isActive || false
          }));
          
        logger.log(`[ContextService] Found ${pdfWindows.length} PDF windows in context:`, 
          pdfWindows.map(w => `${w.id} (${w.title})`));
          
        // If we have PDF windows, select the most appropriate one
        if (pdfWindows.length > 0) {
          // Prefer active window, otherwise take the first one
          const selectedWindow = pdfWindows.find(w => w.isActive) || pdfWindows[0];
          
          // Create enhanced input
          const enhancedInput = { 
            ...params.tool_input, 
            windowId: selectedWindow.id 
          };
          
          logger.log(`[ContextService] Enhanced PDF tool input locally:`, {
            tool: params.tool_name,
            windowId: enhancedInput.windowId
          });
          
          return {
            tool_input: enhancedInput,
            was_modified: true,
            tool_name: params.tool_name
          };
        }
      }
      
      // Handle document tool operations locally if possible
      if (params.tool_name.startsWith('docs_')) {
        // Ensure spaceId is set correctly
        if (!params.tool_input.spaceId || params.tool_input.spaceId === 'undefined') {
          if (params.context?.spaceId) {
            params.tool_input.spaceId = params.context.spaceId;
            logger.log(`[ContextService] Added spaceId from context: ${params.context.spaceId}`);
          }
        }
        
        // If windowId is missing or incorrect, try to find a docs window
        if (!params.tool_input.windowId || 
            !params.context?.windowContents?.[params.tool_input.windowId] ||
            params.context?.windowContents?.[params.tool_input.windowId]?.appType !== 'docs') {
          
          // Find all docs windows in context
          const docsWindows = Object.entries(params.context?.windowContents || {})
            .filter(([_, content]) => (content as any)?.appType === 'docs')
            .map(([id, content]) => ({ 
              id, 
              title: (content as any)?.title || '',
              isActive: (content as any)?.isActive || false
            }));
            
          logger.log(`[ContextService] Found ${docsWindows.length} docs windows in context:`, 
            docsWindows.map(w => `${w.id} (${w.title})`));
            
          // If we have docs windows, select the most appropriate one
          if (docsWindows.length > 0) {
            // Prefer active window, otherwise take the first one
            const selectedWindow = docsWindows.find(w => w.isActive) || docsWindows[0];
            
            // Create enhanced input
            params.tool_input.windowId = selectedWindow.id;
            logger.log(`[ContextService] Enhanced docs tool input with window ID:`, selectedWindow.id);
          }
        }
      }

      // Try the backend enhancement service
      const response = await fetch(`${API_BASE_URL}/spacechat/enhance-tool`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({
          tool_name: params.tool_name,
          tool_input: params.tool_input,
          user_message: params.user_message,
          context: params.context,
          user_id: params.user_id,
        }),
      });

      // Log status code for debugging
      logger.log(`[ContextService] API response status: ${response.status}`);

      if (!response.ok) {
        let errorText = '';
        try {
          const errorData = await response.json();
          errorText = JSON.stringify(errorData);
          logger.error('[ContextService] Error enhancing tool:', errorData);
        } catch (parseError) {
          errorText = await response.text();
          logger.error('[ContextService] Error response text:', errorText);
        }
        throw new Error(`Error enhancing tool: ${errorText || response.statusText}`);
      }

      const result = await response.json();
      logger.log('[ContextService] Backend enhancement result:', {
        was_modified: result.was_modified,
        tool_name: result.tool_name,
        window_id: result.tool_input?.windowId,
        input_keys: Object.keys(result.tool_input || {})
      });
      
      return result;
    } catch (error) {
      logger.error('[ContextService] Failed to enhance tool:', error);
      // Return the original input with any local enhancements we made
      return {
        tool_input: params.tool_input,
        was_modified: false,
        tool_name: params.tool_name
      };
    }
  }

  /**
   * Analyze a user message to extract entities and suggest potential actions
   * 
   * @param params Message analysis parameters 
   * @returns Analysis results
   */
  public async analyzeMessage(params: MessageAnalysisInput): Promise<MessageAnalysisResult> {
    try {
      logger.log('[ContextService] Analyzing message:', {
        message_length: params.message?.length || 0,
        context_keys: Object.keys(params.context || {})
      });

      // Pre-process the message locally to detect PDF or document mentions
      if (params.message.toLowerCase().includes('pdf') || 
          params.message.toLowerCase().includes('document')) {
        
        logger.log('[ContextService] Local detection: Message mentions PDF or document');
        
        // Find PDF windows in context
        const pdfWindows = Object.entries(params.context?.windowContents || {})
          .filter(([_, content]) => (content as any)?.appType === 'PDF')
          .map(([id, content]) => ({
            windowId: id,
            entityName: (content as any)?.title || 'PDF Document',
            confidence: 0.85,
            windowType: 'PDF',
            isActive: (content as any)?.isActive || false
          }));
          
        // Add them to results if found
        if (pdfWindows.length > 0) {
          logger.log(`[ContextService] Found ${pdfWindows.length} PDF windows by local analysis`);
          // Return immediately with local results
          return {
            entities: [],
            matching_windows: pdfWindows
          };
        }
      }

      const response = await fetch(`${API_BASE_URL}/spacechat/analyze-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({
          message: params.message,
          context: params.context,
          user_id: params.user_id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        logger.error('[ContextService] Error analyzing message:', errorData);
        throw new Error(`Error analyzing message: ${errorData.error || response.statusText}`);
      }

      const result = await response.json();
      logger.log('[ContextService] Analysis results:', {
        entities_found: result.entities?.length || 0,
        windows_matched: result.matching_windows?.length || 0
      });
      
      return result;
    } catch (error) {
      logger.error('[ContextService] Failed to analyze message:', error);
      // Return empty results on error
      return {
        entities: [],
        matching_windows: []
      };
    }
  }
}

export const contextService = new ContextService(); 