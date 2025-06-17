import { getNotesAppStore } from "./notesAppStore";
import { Command } from "types/commands";

// Utility function to chunk text content
const chunkText = (text: string, chunkSize: number = 1000, overlap: number = 100): string[] => {
  if (text.length <= chunkSize) {
    return [text];
  }
  
  const chunks: string[] = [];
  let start = 0;
  
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.slice(start, end);
    chunks.push(chunk);
    
    // Move start position with overlap
    start = end - overlap;
    if (start >= text.length) break;
  }
  
  return chunks;
};

// Utility function to search for text within content
const findTextOccurrences = (text: string, searchTerm: string, contextSize: number = 200): Array<{text: string, position: number}> => {
  const results: Array<{text: string, position: number}> = [];
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
      position: index
    });
    
    position = index + searchTerm.length;
  }
  
  return results;
};

// Create a registry of all available commands
export const commands: Command[] = [
  {
    id: 'notes_getText',
    description: 'Get the current text content and length from a note',
    parameters: [
      {
        name: 'windowId',
        type: 'string',
        description: 'The ID of the window containing the note (e.g. "window-12345-abcde")',
        required: true
      },
      {
        name: 'spaceId',
        type: 'string',
        description: 'The ID of the space containing the note',
        required: true
      }
    ],
    handler: ({windowId, spaceId, callback}: {windowId: string, spaceId: string, callback: (text: string) => void}) => {
      const notesStore = getNotesAppStore(windowId, spaceId);
      const state = notesStore.getState();
      const text = state.editorViewGetCurrentText();
      callback(`{"text": "${text}", "length": ${text.length}}`);
    }
  },
  {
    id: 'notes_getTextChunk',
    description: 'Get a specific chunk of text from a note to avoid token limits. Useful for reading large notes in smaller portions.',
    parameters: [
      {
        name: 'windowId',
        type: 'string',
        description: 'The ID of the window containing the note',
        required: true
      },
      {
        name: 'spaceId',
        type: 'string',
        description: 'The ID of the space containing the note',
        required: true
      },
      {
        name: 'chunkIndex',
        type: 'number',
        description: 'The index of the chunk to retrieve (0-based)',
        required: true
      },
      {
        name: 'chunkSize',
        type: 'number',
        description: 'Size of each chunk in characters (default: 1000)',
        required: false
      },
      {
        name: 'overlap',
        type: 'number',
        description: 'Overlap between chunks in characters (default: 100)',
        required: false
      }
    ],
    handler: ({windowId, spaceId, chunkIndex, chunkSize = 1000, overlap = 100, callback}: {
      windowId: string, 
      spaceId: string, 
      chunkIndex: number,
      chunkSize?: number,
      overlap?: number,
      callback: (text: string) => void
    }) => {
      try {
        const notesStore = getNotesAppStore(windowId, spaceId);
        const state = notesStore.getState();
        const fullText = state.editorViewGetCurrentText();
        
        // Chunk the text
        const chunks = chunkText(fullText, chunkSize, overlap);
        
        if (chunkIndex >= chunks.length) {
          callback(JSON.stringify({
            error: `Chunk index ${chunkIndex} out of range. Note has ${chunks.length} chunks.`,
            totalChunks: chunks.length,
            noteLength: fullText.length
          }));
          return;
        }
        
        const chunk = chunks[chunkIndex];
        callback(JSON.stringify({
          text: chunk,
          chunkIndex,
          totalChunks: chunks.length,
          chunkSize: chunk.length,
          isComplete: chunkIndex === chunks.length - 1
        }));
      } catch (error: any) {
        callback(JSON.stringify({
          error: `Failed to get text chunk: ${error.message || 'Unknown error'}`,
          chunkIndex
        }));
      }
    }
  },
  {
    id: 'notes_searchText',
    description: 'Search for specific text within a note and return matching sections with context',
    parameters: [
      {
        name: 'windowId',
        type: 'string',
        description: 'The ID of the window containing the note',
        required: true
      },
      {
        name: 'spaceId',
        type: 'string',
        description: 'The ID of the space containing the note',
        required: true
      },
      {
        name: 'searchTerm',
        type: 'string',
        description: 'The text to search for',
        required: true
      },
      {
        name: 'contextSize',
        type: 'number',
        description: 'Amount of context around each match in characters (default: 200)',
        required: false
      }
    ],
    handler: ({windowId, spaceId, searchTerm, contextSize = 200, callback}: {
      windowId: string,
      spaceId: string,
      searchTerm: string,
      contextSize?: number,
      callback: (text: string) => void
    }) => {
      try {
        const notesStore = getNotesAppStore(windowId, spaceId);
        const state = notesStore.getState();
        const fullText = state.editorViewGetCurrentText();
        
        // Search for text occurrences
        const matches = findTextOccurrences(fullText, searchTerm, contextSize);
        
        callback(JSON.stringify({
          searchTerm,
          matchCount: matches.length,
          matches: matches.map((match, index) => ({
            index,
            position: match.position,
            text: match.text,
            contextSize
          }))
        }));
      } catch (error: any) {
        callback(JSON.stringify({
          error: `Failed to search text: ${error.message || 'Unknown error'}`,
          searchTerm
        }));
      }
    }
  },
  {
    id: 'notes_getTextRange',
    description: 'Get text from a range of characters within a note',
    parameters: [
      {
        name: 'windowId',
        type: 'string',
        description: 'The ID of the window containing the note',
        required: true
      },
      {
        name: 'spaceId',
        type: 'string',
        description: 'The ID of the space containing the note',
        required: true
      },
      {
        name: 'startPos',
        type: 'number',
        description: 'Starting character position (0-based)',
        required: true
      },
      {
        name: 'endPos',
        type: 'number',
        description: 'Ending character position (-1 for end of note)',
        required: false
      }
    ],
    handler: ({windowId, spaceId, startPos, endPos = -1, callback}: {
      windowId: string,
      spaceId: string,
      startPos: number,
      endPos?: number,
      callback: (text: string) => void
    }) => {
      try {
        const notesStore = getNotesAppStore(windowId, spaceId);
        const state = notesStore.getState();
        const fullText = state.editorViewGetCurrentText();
        
        // Validate and adjust positions
        const safeStartPos = Math.max(0, Math.min(startPos, fullText.length));
        const safeEndPos = endPos === -1 ? fullText.length : Math.max(safeStartPos, Math.min(endPos, fullText.length));
        
        const textRange = fullText.slice(safeStartPos, safeEndPos);
        
        callback(JSON.stringify({
          text: textRange,
          startPos: safeStartPos,
          endPos: safeEndPos,
          length: textRange.length,
          totalNoteLength: fullText.length
        }));
      } catch (error: any) {
        callback(JSON.stringify({
          error: `Failed to get text range: ${error.message || 'Unknown error'}`,
          startPos,
          endPos
        }));
      }
    }
  },
  {
    id: 'notes_getFromStart',
    description: 'Get text from the beginning of a note up to a specified length',
    parameters: [
      {
        name: 'windowId',
        type: 'string',
        description: 'The ID of the window containing the note',
        required: true
      },
      {
        name: 'spaceId',
        type: 'string',
        description: 'The ID of the space containing the note',
        required: true
      },
      {
        name: 'length',
        type: 'number',
        description: 'Number of characters to read from the start (default: 1000)',
        required: false
      }
    ],
    handler: ({windowId, spaceId, length = 1000, callback}: {
      windowId: string,
      spaceId: string,
      length?: number,
      callback: (text: string) => void
    }) => {
      try {
        const notesStore = getNotesAppStore(windowId, spaceId);
        const state = notesStore.getState();
        const fullText = state.editorViewGetCurrentText();
        
        const textFromStart = fullText.slice(0, Math.min(length, fullText.length));
        
        callback(JSON.stringify({
          text: textFromStart,
          requestedLength: length,
          actualLength: textFromStart.length,
          totalNoteLength: fullText.length,
          isComplete: textFromStart.length === fullText.length
        }));
      } catch (error: any) {
        callback(JSON.stringify({
          error: `Failed to get text from start: ${error.message || 'Unknown error'}`,
          length
        }));
      }
    }
  },
  {
    id: 'notes_getFromEnd',
    description: 'Get text from the end of a note up to a specified length',
    parameters: [
      {
        name: 'windowId',
        type: 'string',
        description: 'The ID of the window containing the note',
        required: true
      },
      {
        name: 'spaceId',
        type: 'string',
        description: 'The ID of the space containing the note',
        required: true
      },
      {
        name: 'length',
        type: 'number',
        description: 'Number of characters to read from the end (default: 1000)',
        required: false
      }
    ],
    handler: ({windowId, spaceId, length = 1000, callback}: {
      windowId: string,
      spaceId: string,
      length?: number,
      callback: (text: string) => void
    }) => {
      try {
        const notesStore = getNotesAppStore(windowId, spaceId);
        const state = notesStore.getState();
        const fullText = state.editorViewGetCurrentText();
        
        const startPos = Math.max(0, fullText.length - length);
        const textFromEnd = fullText.slice(startPos);
        
        callback(JSON.stringify({
          text: textFromEnd,
          requestedLength: length,
          actualLength: textFromEnd.length,
          totalNoteLength: fullText.length,
          startPos,
          isComplete: textFromEnd.length === fullText.length
        }));
      } catch (error: any) {
        callback(JSON.stringify({
          error: `Failed to get text from end: ${error.message || 'Unknown error'}`,
          length
        }));
      }
    }
  },
  {
    id: 'notes_insertText',
    description: 'Insert text into a note at the specified position',
    parameters: [
      {
        name: 'windowId',
        type: 'string',
        description: 'The ID of the window containing the note',
        required: true
      },
      {
        name: 'spaceId',
        type: 'string',
        description: 'The ID of the space containing the note',
        required: true
      },
      {
        name: 'text',
        type: 'string',
        description: 'The text to insert',
        required: true
      },
      {
        name: 'position',
        type: 'number',
        description: 'The position at which to insert the text',
        required: true
      }
    ],
    handler: ({windowId, spaceId, text, position, callback}: {windowId: string, spaceId: string, text: string, position: number, callback: (text: string) => void}) => {
      const notesStore = getNotesAppStore(windowId, spaceId);
      const state = notesStore.getState();
      state.showTextDiffModal(text, position, callback);
    }
  },
  {
    id: 'notes_removeText',
    description: 'Remove text from a note between the specified positions',
    parameters: [
      {
        name: 'windowId',
        type: 'string',
        description: 'The ID of the window containing the note',
        required: true
      },
      {
        name: 'spaceId',
        type: 'string',
        description: 'The ID of the space containing the note',
        required: true
      },
      {
        name: 'from',
        type: 'number',
        description: 'The starting position from which to remove text',
        required: true
      },
      {
        name: 'to',
        type: 'number',
        description: 'The ending position up to which to remove text',
        required: true
      }
    ],
    handler: ({windowId, spaceId, from, to, callback}: {windowId: string, spaceId: string, from: number, to: number, callback: (text: string) => void}) => {
      const notesStore = getNotesAppStore(windowId, spaceId);
      const state = notesStore.getState();
      state.editorViewRemoveText(from, to);
      const text = state.editorViewGetCurrentText();
      console.log('[commands][notes_removeText] Text:', text);
      callback(text);
    }
  }
];
