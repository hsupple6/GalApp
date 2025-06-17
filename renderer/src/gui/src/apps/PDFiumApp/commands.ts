import { SpaceContext } from "components/Space/SpaceChat/types";
import useSpaceStore from "stores/spaceStore";
import { Command } from "types/commands";
import { getPDFiumStore } from "./store/pdfiumStore";

// Import file service to read PDF files directly
import { useFileService } from "services/FileService";

// Check if a value exists in an object of any type
const hasProperty = (obj: any, prop: string): boolean => {
  return obj && typeof obj === 'object' && prop in obj;
};

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
    id: 'pdf_getPage',
    description: 'Get the full text of a page in a PDF from pdfium app',
    parameters: [
      {
        name: 'windowId',
        type: 'string',
        description: 'The ID of the window containing the PDF',
        required: true
      },
      {
        name: 'pageNumber',
        type: 'number',
        description: 'The number of the page to get the text of',
        required: true
      }
    ],
    handler: async ({windowId, pageNumber, callback, context}: {windowId: string, pageNumber: number, callback: (text: string) => void, context: SpaceContext}) => {
      console.log(`[pdf_getPage] Looking for window: ${windowId}`);
      
      // Step 1: Find the window content
      const windowContent = context.windowContents[windowId];
      if (!windowContent) {
        console.error(`[pdf_getPage] Window not found: ${windowId}`);
        callback(JSON.stringify({
          error: "Window not found", 
          windowId: windowId,
          detail: "Check if windowId is correct and the window exists"
        }));
        return;
      }
      
      // Step 2: Check window type (accept both 'PDF' and 'pdfium')
      if (windowContent.appType !== 'PDF' && windowContent.appType !== 'pdfium') {
        console.error(`[pdf_getPage] Invalid window type: ${windowContent.appType}`);
        callback(JSON.stringify({
          error: "Window is not a PDF", 
          foundType: windowContent.appType,
          detail: "Only PDF windows are supported for this command"
        }));
        return;
      }
      
      // Step 3: Get entity ID from window content
      const entityId = windowContent.entityId;
      if (!entityId) {
        console.error(`[pdf_getPage] No entity ID in window: ${windowId}`);
        callback(JSON.stringify({
          error: "No entity ID in window",
          detail: "Window doesn't have an associated entity"
        }));
        return;
      }
      
      try {
        // Step 4: Get the spaceId
        const spaceStore = useSpaceStore.getState();
        const spaceId = spaceStore.activeSpace?.id;
        if (!spaceId) {
          throw new Error("No active space found");
        }
        
        // Step 5: Get and initialize the PDF store
        const pdfiumStore = getPDFiumStore(windowId, spaceId);
        const pdfState = pdfiumStore.getState();
        
        if (!pdfState.initialized || pdfState.entityId !== entityId) {
          console.log(`[pdf_getPage] Initializing PDF store for entity: ${entityId}`);
          await pdfiumStore.getState().initialize(entityId);
        }
        
        // Get the latest state after initialization
        const updatedState = pdfiumStore.getState();
        
        // Get the page text from the store
        const pageText = updatedState.getPageText(pageNumber);
        
        if (!pageText) {
          console.error(`[pdf_getPage] No text found for page ${pageNumber}`);
          callback(JSON.stringify({
            error: `Failed to retrieve page ${pageNumber} content`,
            detail: {
              hasEntity: !!updatedState.entity,
              pageContentCount: Object.keys(updatedState.pageContents).length,
              hasEnrichments: updatedState.hasEnrichments,
              enrichmentError: updatedState.enrichmentError
            }
          }));
          return;
        }
        
        // Return the page text
        callback(`{"text": ${JSON.stringify(pageText)}, "length": ${pageText.length}}`);
      } catch (error: unknown) {
        console.error(`[pdf_getPage] Error accessing page data:`, error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        // Include detailed error information
        callback(JSON.stringify({
          error: `Failed to access page data: ${errorMessage}`,
          detail: {
            entityId,
            pageNumber,
            errorStack: error instanceof Error ? error.stack : undefined
          }
        }));
      }
    }
  },
  {
    id: 'pdf_getPageChunk',
    description: 'Get a specific chunk of text from a PDF page to avoid token limits. Useful for reading large pages in smaller portions.',
    parameters: [
      {
        name: 'windowId',
        type: 'string',
        description: 'The ID of the window containing the PDF',
        required: true
      },
      {
        name: 'pageNumber',
        type: 'number',
        description: 'The number of the page to get the text from',
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
    handler: async ({windowId, pageNumber, chunkIndex, chunkSize = 1000, overlap = 100, callback, context}: {
      windowId: string, 
      pageNumber: number, 
      chunkIndex: number,
      chunkSize?: number,
      overlap?: number,
      callback: (text: string) => void, 
      context: SpaceContext
    }) => {
      console.log(`[pdf_getPageChunk] Looking for window: ${windowId}, page: ${pageNumber}, chunk: ${chunkIndex}`);
      
      const windowContent = context.windowContents[windowId];
      if (!windowContent) {
        callback(JSON.stringify({error: "Window not found", windowId}));
        return;
      }
      
      if (windowContent.appType !== 'PDF' && windowContent.appType !== 'pdfium') {
        callback(JSON.stringify({error: "Window is not a PDF", foundType: windowContent.appType}));
        return;
      }
      
      const entityId = windowContent.entityId;
      if (!entityId) {
        callback(JSON.stringify({error: "No entity ID in window"}));
        return;
      }
      
      try {
        const spaceStore = useSpaceStore.getState();
        const spaceId = spaceStore.activeSpace?.id;
        if (!spaceId) {
          throw new Error("No active space found");
        }
        
        const pdfiumStore = getPDFiumStore(windowId, spaceId);
        const pdfState = pdfiumStore.getState();
        
        if (!pdfState.initialized || pdfState.entityId !== entityId) {
          await pdfiumStore.getState().initialize(entityId);
        }
        
        const updatedState = pdfiumStore.getState();
        const pageText = updatedState.getPageText(pageNumber);
        
        if (!pageText) {
          callback(JSON.stringify({error: `No text found for page ${pageNumber}`}));
          return;
        }
        
        // Chunk the text
        const chunks = chunkText(pageText, chunkSize, overlap);
        
        if (chunkIndex >= chunks.length) {
          callback(JSON.stringify({
            error: `Chunk index ${chunkIndex} out of range. Page has ${chunks.length} chunks.`,
            totalChunks: chunks.length,
            pageLength: pageText.length
          }));
          return;
        }
        
        const chunk = chunks[chunkIndex];
        callback(JSON.stringify({
          text: chunk,
          chunkIndex,
          totalChunks: chunks.length,
          chunkSize: chunk.length,
          pageNumber,
          isComplete: chunkIndex === chunks.length - 1
        }));
        
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        callback(JSON.stringify({error: `Failed to access page chunk: ${errorMessage}`}));
      }
    }
  },
  {
    id: 'pdf_searchText',
    description: 'Search for specific text within a PDF page and return matching sections with context',
    parameters: [
      {
        name: 'windowId',
        type: 'string',
        description: 'The ID of the window containing the PDF',
        required: true
      },
      {
        name: 'pageNumber',
        type: 'number',
        description: 'The number of the page to search in',
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
    handler: async ({windowId, pageNumber, searchTerm, contextSize = 200, callback, context}: {
      windowId: string,
      pageNumber: number,
      searchTerm: string,
      contextSize?: number,
      callback: (text: string) => void,
      context: SpaceContext
    }) => {
      console.log(`[pdf_searchText] Searching for "${searchTerm}" in window: ${windowId}, page: ${pageNumber}`);
      
      const windowContent = context.windowContents[windowId];
      if (!windowContent) {
        callback(JSON.stringify({error: "Window not found", windowId}));
        return;
      }
      
      if (windowContent.appType !== 'PDF' && windowContent.appType !== 'pdfium') {
        callback(JSON.stringify({error: "Window is not a PDF", foundType: windowContent.appType}));
        return;
      }
      
      const entityId = windowContent.entityId;
      if (!entityId) {
        callback(JSON.stringify({error: "No entity ID in window"}));
        return;
      }
      
      try {
        const spaceStore = useSpaceStore.getState();
        const spaceId = spaceStore.activeSpace?.id;
        if (!spaceId) {
          throw new Error("No active space found");
        }
        
        const pdfiumStore = getPDFiumStore(windowId, spaceId);
        const pdfState = pdfiumStore.getState();
        
        if (!pdfState.initialized || pdfState.entityId !== entityId) {
          await pdfiumStore.getState().initialize(entityId);
        }
        
        const updatedState = pdfiumStore.getState();
        const pageText = updatedState.getPageText(pageNumber);
        
        if (!pageText) {
          callback(JSON.stringify({error: `No text found for page ${pageNumber}`}));
          return;
        }
        
        // Search for text occurrences
        const matches = findTextOccurrences(pageText, searchTerm, contextSize);
        
        callback(JSON.stringify({
          searchTerm,
          pageNumber,
          matchCount: matches.length,
          matches: matches.map((match, index) => ({
            index,
            position: match.position,
            text: match.text,
            contextSize
          }))
        }));
        
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        callback(JSON.stringify({error: `Failed to search text: ${errorMessage}`}));
      }
    }
  },
  {
    id: 'pdf_getPageRange',
    description: 'Get text from a range of characters within a PDF page',
    parameters: [
      {
        name: 'windowId',
        type: 'string',
        description: 'The ID of the window containing the PDF',
        required: true
      },
      {
        name: 'pageNumber',
        type: 'number',
        description: 'The number of the page to get text from',
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
        description: 'Ending character position (-1 for end of page)',
        required: false
      }
    ],
    handler: async ({windowId, pageNumber, startPos, endPos = -1, callback, context}: {
      windowId: string,
      pageNumber: number,
      startPos: number,
      endPos?: number,
      callback: (text: string) => void,
      context: SpaceContext
    }) => {
      console.log(`[pdf_getPageRange] Getting range ${startPos}-${endPos} from window: ${windowId}, page: ${pageNumber}`);
      
      const windowContent = context.windowContents[windowId];
      if (!windowContent) {
        callback(JSON.stringify({error: "Window not found", windowId}));
        return;
      }
      
      if (windowContent.appType !== 'PDF' && windowContent.appType !== 'pdfium') {
        callback(JSON.stringify({error: "Window is not a PDF", foundType: windowContent.appType}));
        return;
      }
      
      const entityId = windowContent.entityId;
      if (!entityId) {
        callback(JSON.stringify({error: "No entity ID in window"}));
        return;
      }
      
      try {
        const spaceStore = useSpaceStore.getState();
        const spaceId = spaceStore.activeSpace?.id;
        if (!spaceId) {
          throw new Error("No active space found");
        }
        
        const pdfiumStore = getPDFiumStore(windowId, spaceId);
        const pdfState = pdfiumStore.getState();
        
        if (!pdfState.initialized || pdfState.entityId !== entityId) {
          await pdfiumStore.getState().initialize(entityId);
        }
        
        const updatedState = pdfiumStore.getState();
        const pageText = updatedState.getPageText(pageNumber);
        
        if (!pageText) {
          callback(JSON.stringify({error: `No text found for page ${pageNumber}`}));
          return;
        }
        
        // Validate and adjust positions
        const safeStartPos = Math.max(0, Math.min(startPos, pageText.length));
        const safeEndPos = endPos === -1 ? pageText.length : Math.max(safeStartPos, Math.min(endPos, pageText.length));
        
        const textRange = pageText.slice(safeStartPos, safeEndPos);
        
        callback(JSON.stringify({
          text: textRange,
          startPos: safeStartPos,
          endPos: safeEndPos,
          length: textRange.length,
          pageNumber,
          totalPageLength: pageText.length
        }));
        
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        callback(JSON.stringify({error: `Failed to get page range: ${errorMessage}`}));
      }
    }
  },
  {
    id: 'pdf_getSummaries',
    description: 'Get the summaries of a PDF from pdfium app',
    parameters: [
      {
        name: 'windowId',
        type: 'string',
        description: 'The ID of the window containing the PDF',
        required: true
      }
    ],
    handler: async ({windowId, callback, context}: {windowId: string, callback: (text: string) => void, context: SpaceContext}) => {
      console.log(`[pdf_getSummaries] Looking for window: ${windowId}`);
      
      // Step 1: Find the window content
      const windowContent = context.windowContents[windowId];
      if (!windowContent) {
        console.error(`[pdf_getSummaries] Window not found: ${windowId}`);
        callback(JSON.stringify({
          error: "Window not found", 
          windowId: windowId,
          detail: "Check if windowId is correct and the window exists"
        }));
        return;
      }
      
      // Step 2: Check window type (accept both 'PDF' and 'pdfium')
      if (windowContent.appType !== 'PDF' && windowContent.appType !== 'pdfium') {
        console.error(`[pdf_getSummaries] Invalid window type: ${windowContent.appType}`);
        callback(JSON.stringify({
          error: "Window is not a PDF", 
          foundType: windowContent.appType,
          detail: "Only PDF windows are supported for this command"
        }));
        return;
      }
      
      // Step 3: Get entity ID from window content
      const entityId = windowContent.entityId;
      if (!entityId) {
        console.error(`[pdf_getSummaries] No entity ID in window: ${windowId}`);
        callback(JSON.stringify({
          error: "No entity ID in window",
          detail: "Window doesn't have an associated entity"
        }));
        return;
      }
      
      try {
        // Step 4: Get the spaceId
        const spaceStore = useSpaceStore.getState();
        const spaceId = spaceStore.activeSpace?.id;
        if (!spaceId) {
          throw new Error("No active space found");
        }
        
        // Step 5: Get and initialize the PDF store
        const pdfiumStore = getPDFiumStore(windowId, spaceId);
        const pdfState = pdfiumStore.getState();
        
        if (!pdfState.initialized || pdfState.entityId !== entityId) {
          console.log(`[pdf_getSummaries] Initializing PDF store for entity: ${entityId}`);
          await pdfiumStore.getState().initialize(entityId);
        }
        
        // Get the latest state after initialization
        const updatedState = pdfiumStore.getState();
        
        // Get the summaries from the store
        const summaries = updatedState.getAllPageSummaries();
        
        if (Object.keys(summaries).length === 0) {
          console.error(`[pdf_getSummaries] No summaries found for entity ${entityId}`);
          callback(JSON.stringify({
            error: "Failed to retrieve PDF summaries",
            detail: {
              hasEntity: !!updatedState.entity,
              hasEnrichments: updatedState.hasEnrichments,
              enrichmentError: updatedState.enrichmentError
            }
          }));
          return;
        }
        
        // Return the summaries
        callback(`{"summaries": ${JSON.stringify(summaries)}}`);
      } catch (error: unknown) {
        console.error(`[pdf_getSummaries] Error accessing summaries:`, error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        // Include detailed error information
        callback(JSON.stringify({
          error: `Failed to access summaries: ${errorMessage}`,
          detail: {
            entityId,
            errorStack: error instanceof Error ? error.stack : undefined
          }
        }));
      }
    }
  },
];
