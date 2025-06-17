/**
 * Text chunking utilities for handling large content in chat AI interactions
 */

export interface TextChunk {
  text: string;
  index: number;
  startPosition: number;
  endPosition: number;
  length: number;
}

export interface ChunkingOptions {
  chunkSize?: number;
  overlap?: number;
  preserveWords?: boolean;
}

export interface SearchMatch {
  text: string;
  position: number;
  contextSize: number;
}

/**
 * Split text into overlapping chunks
 */
export function chunkText(
  text: string, 
  options: ChunkingOptions = {}
): TextChunk[] {
  const { 
    chunkSize = 1000, 
    overlap = 100, 
    preserveWords = true 
  } = options;

  if (text.length <= chunkSize) {
    return [{
      text,
      index: 0,
      startPosition: 0,
      endPosition: text.length,
      length: text.length
    }];
  }
  
  const chunks: TextChunk[] = [];
  let start = 0;
  let chunkIndex = 0;
  
  while (start < text.length) {
    let end = Math.min(start + chunkSize, text.length);
    
    // If preserveWords is true, try to break at word boundaries
    if (preserveWords && end < text.length) {
      // Find the last space character before the end position
      let searchEnd = end;
      while (searchEnd > start && text[searchEnd] !== ' ') {
        searchEnd--;
      }
      
      // Use the word boundary if it's not too far back
      if (searchEnd > start + chunkSize * 0.7) {
        end = searchEnd;
      }
    }
    
    const chunkText = text.slice(start, end);
    chunks.push({
      text: chunkText,
      index: chunkIndex,
      startPosition: start,
      endPosition: end,
      length: chunkText.length
    });
    
    chunkIndex++;
    
    // Move start position with overlap
    start = end - overlap;
    if (start >= text.length) break;
  }
  
  return chunks;
}

/**
 * Search for text occurrences with context
 */
export function findTextOccurrences(
  text: string, 
  searchTerm: string, 
  contextSize: number = 200
): SearchMatch[] {
  const results: SearchMatch[] = [];
  const searchTermLower = searchTerm.toLowerCase();
  const textLower = text.toLowerCase();
  
  let position = 0;
  while (position < text.length) {
    const index = textLower.indexOf(searchTermLower, position);
    if (index === -1) break;
    
    const start = Math.max(0, index - contextSize);
    const end = Math.min(text.length, index + searchTerm.length + contextSize);
    const context = text.slice(start, end);
    
    results.push({
      text: context,
      position: index,
      contextSize
    });
    
    position = index + searchTerm.length;
  }
  
  return results;
}

/**
 * Get text from a specific range with validation
 */
export function getTextRange(
  text: string,
  startPos: number,
  endPos?: number
): { text: string; actualStart: number; actualEnd: number } {
  const safeStartPos = Math.max(0, Math.min(startPos, text.length));
  const safeEndPos = endPos === undefined || endPos === -1 
    ? text.length 
    : Math.max(safeStartPos, Math.min(endPos, text.length));
  
  return {
    text: text.slice(safeStartPos, safeEndPos),
    actualStart: safeStartPos,
    actualEnd: safeEndPos
  };
}

/**
 * Get text from the beginning up to a specified length
 */
export function getTextFromStart(
  text: string, 
  maxLength: number = 1000
): { text: string; length: number; isComplete: boolean } {
  const textFromStart = text.slice(0, Math.min(maxLength, text.length));
  
  return {
    text: textFromStart,
    length: textFromStart.length,
    isComplete: textFromStart.length === text.length
  };
}

/**
 * Get text from the end up to a specified length
 */
export function getTextFromEnd(
  text: string, 
  maxLength: number = 1000
): { text: string; length: number; startPos: number; isComplete: boolean } {
  const startPos = Math.max(0, text.length - maxLength);
  const textFromEnd = text.slice(startPos);
  
  return {
    text: textFromEnd,
    length: textFromEnd.length,
    startPos,
    isComplete: textFromEnd.length === text.length
  };
}

/**
 * Estimate token count (rough approximation: 1 token ≈ 4 characters)
 */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Determine optimal chunk size based on content length and token limits
 */
export function getOptimalChunkSize(
  textLength: number,
  maxTokens: number = 1000
): { chunkSize: number; estimatedChunks: number } {
  const maxChars = maxTokens * 4; // Rough token-to-character conversion
  const chunkSize = Math.min(maxChars, Math.max(500, Math.floor(textLength / 10))); // At least 500 chars, at most maxChars
  const estimatedChunks = Math.ceil(textLength / chunkSize);
  
  return { chunkSize, estimatedChunks };
}

/**
 * Analyze content and recommend reading strategy
 */
export function analyzeContentStrategy(
  textLength: number,
  searchTerm?: string
): {
  strategy: 'full' | 'chunked' | 'search' | 'summary';
  recommendation: string;
  suggestedChunkSize?: number;
} {
  const estimatedTokens = Math.ceil(textLength / 4);
  
  if (estimatedTokens <= 800) {
    return {
      strategy: 'full',
      recommendation: 'Content is small enough to read in full'
    };
  }
  
  if (searchTerm) {
    return {
      strategy: 'search',
      recommendation: `Use search to find specific content: "${searchTerm}"`
    };
  }
  
  if (estimatedTokens <= 4000) {
    const { chunkSize } = getOptimalChunkSize(textLength, 1000);
    return {
      strategy: 'chunked',
      recommendation: 'Content is large, use chunked reading',
      suggestedChunkSize: chunkSize
    };
  }
  
  return {
    strategy: 'summary',
    recommendation: 'Content is very large, consider using summaries or searching for specific sections'
  };
} 