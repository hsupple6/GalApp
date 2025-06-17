/**
 * Simple window targeting system inspired by Cursor
 * Avoids hardcoding app types and uses clear priority rules
 */

import { AnyWindowEntity } from "types/windows";
import { SpaceContext, WindowContent, GenericWindowContent } from "../types";
import { logger } from "utils/logger";
import { getWindowTitle } from "../../utils/windowUtils";

export interface SimpleWindowTarget {
  windowId: string;
  window: AnyWindowEntity;
  reason: string;
}

export interface WindowTargetingResult {
  input: Record<string, any>;
  wasModified: boolean;
  reason?: string;
  error?: string;
}

/**
 * Generate a Cursor-style context description for the AI
 */
export function generateContextDescription(
  context: SpaceContext,
  windows: Record<string, AnyWindowEntity>,
  activeWindowId: string | null
): string {
  const windowContents = context.windowContents || {};
  const windowCount = Object.keys(windowContents).length;
  
  if (windowCount === 0) {
    return "No windows currently in context. Ask the user to add relevant windows to the context first.";
  }

  let description = "Workspace Context:\n";

  // Active window (highest priority)
  if (activeWindowId && windowContents[activeWindowId]) {
    const activeWindow = windows[activeWindowId];
    const activeContent = windowContents[activeWindowId];
    if (activeWindow) {
      const title = getWindowTitle(activeWindow);
      const type = formatWindowType(activeContent.appType);
      description += `Active: "${title}" (${type}) [${activeWindowId}]\n`;
    }
  }

  // Other windows in context
  const nonActiveWindows = Object.entries(windowContents)
    .filter(([id]) => id !== activeWindowId)
    .map(([id, content]) => ({ id, content, window: windows[id] }))
    .filter(item => item.window); // Only include windows that exist

  if (nonActiveWindows.length > 0) {
    description += "\nAvailable:\n";
    nonActiveWindows.forEach(({ id, content, window }) => {
      const title = getWindowTitle(window);
      const type = formatWindowType(content.appType);
      description += `- "${title}" (${type}) [${id}]\n`;
    });
  }

  // Usage instructions
  description += "\nTool Usage:\n";
  description += "- Always use the exact windowId from brackets above (e.g., [window-123])\n";
  description += "- Use the Active window when user refers to 'this' or 'current' content\n";
  description += "- If a tool fails due to wrong window type, request the user to open the correct type\n";

  return description;
}

/**
 * Format window type for display (normalize common variations)
 */
function formatWindowType(appType: string | undefined): string {
  if (!appType) return "Unknown";
  
  const normalized = appType.toLowerCase();
  
  // Normalize common variations
  if (normalized === 'pdfium' || normalized === 'pdf') return "PDF";
  if (normalized === 'docs' || normalized === 'doc') return "Document";
  if (normalized === 'notes' || normalized === 'note') return "Note";
  if (normalized === 'browser') return "Browser";
  
  // Capitalize first letter for others
  return appType.charAt(0).toUpperCase() + appType.slice(1).toLowerCase();
}

/**
 * Check if a tool name might be compatible with a window type
 * Uses heuristics rather than hardcoded mappings
 */
function isToolCompatibleWithWindow(
  toolName: string, 
  appType: string, 
  windowContent?: WindowContent,
  windows?: Record<string, AnyWindowEntity>,
  windowId?: string
): boolean {
  const normalizedTool = toolName.toLowerCase();
  const normalizedType = appType.toLowerCase();
  
  // Direct matches in tool name
  if (normalizedTool.includes('pdf') && (normalizedType === 'pdf' || normalizedType === 'pdfium')) {
    return true;
  }
  
  if (normalizedTool.includes('doc') && normalizedType === 'docs') {
    // **ADDITIONAL CHECK: For docs tools, verify the docs window actually has a document loaded**
    if (windowContent && windows && windowId) {
      const window = windows[windowId];
      const docsState = window?.applicationState?.docs;
      
      if (!docsState?.activeDocId) {
        logger.log(`[ai_debug][SimpleWindowTargeting] 📄❌ Docs window ${windowId} has no active document loaded`);
        return false;
      }
      
      logger.log(`[ai_debug][SimpleWindowTargeting] 📄✅ Docs window ${windowId} has active document: ${docsState.activeDocId}`);
    }
    return true;
  }
  
  if (normalizedTool.includes('note') && normalizedType === 'notes') {
    return true;
  }
  
  // Tool prefix patterns (flexible)
  if (normalizedTool.startsWith('pdf_') && (normalizedType === 'pdf' || normalizedType === 'pdfium')) {
    return true;
  }
  if (normalizedTool.startsWith('docs_') && normalizedType === 'docs') {
    // **ADDITIONAL CHECK: For docs tools, verify the docs window actually has a document loaded**
    if (windowContent && windows && windowId) {
      const window = windows[windowId];
      const docsState = window?.applicationState?.docs;
      
      if (!docsState?.activeDocId) {
        logger.log(`[ai_debug][SimpleWindowTargeting] 📄❌ Docs window ${windowId} has no active document loaded`);
        return false;
      }
      
      logger.log(`[ai_debug][SimpleWindowTargeting] 📄✅ Docs window ${windowId} has active document: ${docsState.activeDocId}`);
    }
    return true;
  }
  if (normalizedTool.startsWith('notes_') && normalizedType === 'notes') {
    return true;
  }
  
  return false;
}

/**
 * Find the best window for a tool using simple priority rules
 * Now searches BOTH context windows AND space windows
 */
function findBestWindowForTool(
  toolName: string,
  context: SpaceContext,
  windows: Record<string, AnyWindowEntity>,
  activeWindowId: string | null
): SimpleWindowTarget | null {
  
  const windowContents = context.windowContents || {};
  const candidateWindows: Array<{
    id: string;
    window: AnyWindowEntity;
    content?: WindowContent;
    score: number;
    reason: string;
    source: 'context' | 'space';
  }> = [];

  // **FIRST: Score windows that are explicitly in context (higher priority)**
  Object.entries(windowContents).forEach(([windowId, content]) => {
    const window = windows[windowId];
    if (!window) return;

    let score = 0;
    let reason = '';

    // Compatibility check
    if (isToolCompatibleWithWindow(toolName, content.appType || '', content, windows, windowId)) {
      score += 200; // Higher base score for context windows
      reason = `context ${formatWindowType(content.appType)}`;
      
      // Active window bonus
      if (windowId === activeWindowId) {
        score += 50;
        reason = `active ${reason}`;
      }
      
      // Entity availability bonus
      if (content.appType === 'PDF' || content.appType === 'pdfium') {
        if ((content as any)?.entityId) {
          score += 20;
        }
      }

      candidateWindows.push({
        id: windowId,
        window,
        content,
        score,
        reason,
        source: 'context'
      });
    }
  });

  // **SECOND: If no compatible context windows, search ALL space windows**
  if (candidateWindows.length === 0) {
    logger.log(`[ai_debug][SimpleWindowTargeting] No compatible windows in context, searching all space windows`);
    
    Object.entries(windows).forEach(([windowId, window]) => {
      // Skip windows already checked in context
      if (windowContents[windowId]) return;
      
      // Create a temporary content object for compatibility checking
      const tempContent: WindowContent = {
        appType: window.appType || 'unknown',
        isActive: windowId === activeWindowId,
        windowId: windowId,
        stableId: windowId, // Use windowId as stableId for temp objects
        title: window.title || ''
      } as GenericWindowContent;

      let score = 0;
      let reason = '';

      // Compatibility check
      if (isToolCompatibleWithWindow(toolName, window.appType || '', tempContent, windows, windowId)) {
        score += 100; // Lower base score for space-only windows
        reason = `space ${formatWindowType(window.appType)}`;
        
        // Active window bonus
        if (windowId === activeWindowId) {
          score += 50;
          reason = `active ${reason}`;
        }
        
        // Prefer windows with entities for PDF tools
        if ((window.appType === 'PDF' || window.appType === 'pdfium') && window.entity) {
          score += 20;
          reason += ` (with entity)`;
        }

        candidateWindows.push({
          id: windowId,
          window,
          content: tempContent,
          score,
          reason,
          source: 'space'
        });
      }
    });
  }

  // Sort by score (highest first)
  candidateWindows.sort((a, b) => b.score - a.score);

  if (candidateWindows.length === 0) {
    return null;
  }

  const best = candidateWindows[0];
  
  // **Log which source we're using**
  logger.log(`[ai_debug][SimpleWindowTargeting] Selected window from ${best.source}:`, {
    windowId: best.id,
    score: best.score,
    reason: best.reason,
    source: best.source
  });
  
  return {
    windowId: best.id,
    window: best.window,
    reason: `${best.reason} (from ${best.source})`
  };
}

/**
 * Simple tool input enhancement using Cursor-style logic
 */
export function enhanceToolInput(
  toolName: string,
  originalInput: Record<string, any>,
  context: SpaceContext,
  windows: Record<string, AnyWindowEntity>,
  activeWindowId: string | null,
  activeSpaceId?: string
): WindowTargetingResult {
  
  logger.log(`[ai_debug][enhanceToolInput] 🎯 Processing tool enhancement:`, {
    toolName,
    originalWindowId: originalInput.windowId,
    originalSpaceId: originalInput.spaceId,
    contextWindowIds: Object.keys(context?.windowContents || {}),
    windowCount: Object.keys(context?.windowContents || {}).length
  });

  const enhancedInput = { ...originalInput };
  let wasModified = false;
  let reason = '';
  let error = '';

  // Add spaceId if missing (for tools that might need it)
  if (!enhancedInput.spaceId || enhancedInput.spaceId === 'undefined') {
    if (activeSpaceId) {
      enhancedInput.spaceId = activeSpaceId;
      wasModified = true;
      logger.log(`[ai_debug][SimpleWindowTargeting] Added spaceId: ${activeSpaceId}`);
    }
  } else {
    // **IMPORTANT: Always use the active/context spaceId to ensure we get the right store instance**
    if (activeSpaceId && enhancedInput.spaceId !== activeSpaceId) {
      logger.log(`[ai_debug][SimpleWindowTargeting] SpaceId mismatch - using active spaceId:`, {
        toolInputSpaceId: enhancedInput.spaceId,
        activeSpaceId: activeSpaceId
      });
      enhancedInput.spaceId = activeSpaceId;
      wasModified = true;
    }
  }

  // Handle windowId resolution
  const needsWindowId = !enhancedInput.windowId || enhancedInput.windowId === 'undefined';
  const hasInvalidWindowId = enhancedInput.windowId && !context.windowContents?.[enhancedInput.windowId];

  // **DEBUG: Log windowId validation**
  logger.log(`[ai_debug][SimpleWindowTargeting] WindowId validation:`, {
    needsWindowId,
    hasInvalidWindowId,
    windowIdExists: enhancedInput.windowId ? !!context.windowContents?.[enhancedInput.windowId] : false,
    contextWindowIds: Object.keys(context.windowContents || {})
  });

  if (needsWindowId || hasInvalidWindowId) {
    logger.log(`[ai_debug][SimpleWindowTargeting] WindowId needs resolution - trying to find compatible window`);
    
    // Try to find a compatible window
    const target = findBestWindowForTool(toolName, context, windows, activeWindowId);
    
    if (target) {
      enhancedInput.windowId = target.windowId;
      wasModified = true;
      reason = `Selected ${target.reason} window: ${getWindowTitle(target.window)}`;
      logger.log(`[ai_debug][SimpleWindowTargeting] ${reason}`);
    } else {
      // No compatible windows found
      const toolType = inferToolType(toolName);
      
      // Special message for docs tools if there are docs windows but none have documents loaded
      if (toolName.startsWith('docs_')) {
        const docsWindows = Object.entries(context.windowContents || {})
          .filter(([_, content]) => content.appType === 'docs');
          
        if (docsWindows.length > 0) {
          error = `Found ${docsWindows.length} docs window(s) in context, but none have documents loaded. Please open a document in one of the docs windows first.`;
        } else {
          error = `No document windows found in context. Please add a document window to context first.`;
        }
      } else {
        error = `No ${toolType} windows found in context. Please add a ${toolType} window to context first.`;
      }
      
      logger.warn(`[ai_debug][SimpleWindowTargeting] ${error}`);
    }
  } else {
    logger.log(`[ai_debug][SimpleWindowTargeting] WindowId is valid, checking compatibility`);
    
    // Validate existing windowId is compatible
    const existingContent = context.windowContents[enhancedInput.windowId];
    if (existingContent && !isToolCompatibleWithWindow(toolName, existingContent.appType || '', existingContent, windows, enhancedInput.windowId)) {
      logger.log(`[ai_debug][SimpleWindowTargeting] WindowId incompatible - ${toolName} vs ${existingContent.appType}`);
      
      const target = findBestWindowForTool(toolName, context, windows, activeWindowId);
      
      if (target) {
        enhancedInput.windowId = target.windowId;
        wasModified = true;
        reason = `Switched to compatible ${target.reason} window`;
        logger.log(`[ai_debug][SimpleWindowTargeting] ${reason}`);
      } else {
        const toolType = inferToolType(toolName);
        
        // Special message for docs tools if the existing window is docs but has no document
        if (toolName.startsWith('docs_') && existingContent.appType === 'docs') {
          error = `The specified docs window has no document loaded. Please open a document first, or specify a different docs window with an active document.`;
        } else {
          error = `Tool ${toolName} requires a ${toolType} window, but the specified window is ${formatWindowType(existingContent.appType)}.`;
        }
      }
    }
  }

  // **DEBUG: Log final result**
  logger.log(`[ai_debug][SimpleWindowTargeting] Final result:`, {
    originalWindowId: originalInput.windowId,
    finalWindowId: enhancedInput.windowId,
    wasModified,
    reason,
    error
  });

  return {
    input: enhancedInput,
    wasModified,
    reason: reason || undefined,
    error: error || undefined
  };
}

/**
 * Infer what type of window a tool needs based on its name
 */
function inferToolType(toolName: string): string {
  const normalized = toolName.toLowerCase();
  
  if (normalized.includes('pdf') || normalized.startsWith('pdf_')) {
    return 'PDF';
  }
  if (normalized.includes('doc') || normalized.startsWith('docs_')) {
    return 'Document';
  }
  if (normalized.includes('note') || normalized.startsWith('notes_')) {
    return 'Note';
  }
  
  return 'compatible';
} 