import { getDocsAppStore } from "./docsAppStore";
import { Command } from "types/commands";
import { ObjectId } from "bson";
import { docsCRDTService } from "../crdt/docsCRDTService";
import { parseStructuredContent } from "../utils/contentParser";
import { Fragment } from "prosemirror-model";
import { entityService } from "../../../services/entityService";

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

// Utility function to extract text content from nodes
const extractTextFromNodes = (nodes: any[]): string => {
  return nodes
    .filter(node => !node.isDeletion)
    .map(node => node.content || '')
    .join('\n');
};

// Create a registry of all available commands for Ai to use
export const commands: Command[] = [
  {
    id: 'docs_getNodes',
    description: 'Get content of the doc as a list of nodes. Returns a list of nodes with their content, type, pos, size, isDeletion, isInsertion. When node marked as isDeletion, it should be ignored.',
    parameters: [
      {
        name: 'windowId',
        type: 'string',
        description: 'The ID of the window containing the document (e.g. "window-12345-abcde")',
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
      const docsStore = getDocsAppStore(windowId, spaceId);
      const state = docsStore.getState();
      const nodes = state.getNodes();
      callback(JSON.stringify(nodes));
    }
  },
  {
    id: 'docs_getNodesChunk',
    description: 'Get a specific chunk of nodes from a document to avoid token limits. Useful for reading large documents in smaller portions.',
    parameters: [
      {
        name: 'windowId',
        type: 'string',
        description: 'The ID of the window containing the document',
        required: true
      },
      {
        name: 'spaceId',
        type: 'string',
        description: 'The ID of the space containing the document',
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
        const docsStore = getDocsAppStore(windowId, spaceId);
        const state = docsStore.getState();
        const nodes = state.getNodes();
        const fullText = extractTextFromNodes(nodes);
        
        // Chunk the text
        const chunks = chunkText(fullText, chunkSize, overlap);
        
        if (chunkIndex >= chunks.length) {
          callback(JSON.stringify({
            error: `Chunk index ${chunkIndex} out of range. Document has ${chunks.length} chunks.`,
            totalChunks: chunks.length,
            documentLength: fullText.length
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
          error: `Failed to get document chunk: ${error.message || 'Unknown error'}`,
          chunkIndex
        }));
      }
    }
  },
  {
    id: 'docs_searchText',
    description: 'Search for specific text within a document and return matching sections with context',
    parameters: [
      {
        name: 'windowId',
        type: 'string',
        description: 'The ID of the window containing the document',
        required: true
      },
      {
        name: 'spaceId',
        type: 'string',
        description: 'The ID of the space containing the document',
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
        const docsStore = getDocsAppStore(windowId, spaceId);
        const state = docsStore.getState();
        const nodes = state.getNodes();
        const fullText = extractTextFromNodes(nodes);
        
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
    id: 'docs_getTextRange',
    description: 'Get text from a range of characters within a document',
    parameters: [
      {
        name: 'windowId',
        type: 'string',
        description: 'The ID of the window containing the document',
        required: true
      },
      {
        name: 'spaceId',
        type: 'string',
        description: 'The ID of the space containing the document',
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
        description: 'Ending character position (-1 for end of document)',
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
        const docsStore = getDocsAppStore(windowId, spaceId);
        const state = docsStore.getState();
        const nodes = state.getNodes();
        const fullText = extractTextFromNodes(nodes);
        
        // Validate and adjust positions
        const safeStartPos = Math.max(0, Math.min(startPos, fullText.length));
        const safeEndPos = endPos === -1 ? fullText.length : Math.max(safeStartPos, Math.min(endPos, fullText.length));
        
        const textRange = fullText.slice(safeStartPos, safeEndPos);
        
        callback(JSON.stringify({
          text: textRange,
          startPos: safeStartPos,
          endPos: safeEndPos,
          length: textRange.length,
          totalDocumentLength: fullText.length
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
    id: 'docs_getFromStart',
    description: 'Get text from the beginning of a document up to a specified length',
    parameters: [
      {
        name: 'windowId',
        type: 'string',
        description: 'The ID of the window containing the document',
        required: true
      },
      {
        name: 'spaceId',
        type: 'string',
        description: 'The ID of the space containing the document',
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
        const docsStore = getDocsAppStore(windowId, spaceId);
        const state = docsStore.getState();
        const nodes = state.getNodes();
        const fullText = extractTextFromNodes(nodes);
        
        const textFromStart = fullText.slice(0, Math.min(length, fullText.length));
        
        callback(JSON.stringify({
          text: textFromStart,
          requestedLength: length,
          actualLength: textFromStart.length,
          totalDocumentLength: fullText.length,
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
    id: 'docs_getFromEnd',
    description: 'Get text from the end of a document up to a specified length',
    parameters: [
      {
        name: 'windowId',
        type: 'string',
        description: 'The ID of the window containing the document',
        required: true
      },
      {
        name: 'spaceId',
        type: 'string',
        description: 'The ID of the space containing the document',
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
        const docsStore = getDocsAppStore(windowId, spaceId);
        const state = docsStore.getState();
        const nodes = state.getNodes();
        const fullText = extractTextFromNodes(nodes);
        
        const startPos = Math.max(0, fullText.length - length);
        const textFromEnd = fullText.slice(startPos);
        
        callback(JSON.stringify({
          text: textFromEnd,
          requestedLength: length,
          actualLength: textFromEnd.length,
          totalDocumentLength: fullText.length,
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
    id: 'docs_insertNode',
    description: 'Insert a single node into a doc at the specified position. Use this for single-line edits or when making incremental changes. For multiple related paragraphs, use docs_insertMultipleNodes instead.',
    parameters: [
      {
        name: 'windowId',
        type: 'string',
        description: 'The ID of the window containing the document (e.g. "window-12345-abcde")',
        required: true
      },
      {
        name: 'spaceId',
        type: 'string',
        description: 'The ID of the space containing the note',
        required: true
      },
      {
        name: 'content',
        type: 'string',
        description: 'The content of the node to insert',
        required: true
      },
      {
        name: 'type',
        type: 'string',
        description: 'The type of the node to insert (paragraph, heading)',
        required: true
      },
      {
        name: 'position',
        type: 'number',
        description: 'The position of the node to insert',
        required: true
      }
    ],
    handler: ({windowId, spaceId, content, type, position, callback}: {windowId: string, spaceId: string, content: string, type: string, position: number, callback: (text: string) => void}) => {
      try {
        // **DEBUG: Log all input parameters**
        console.log('[docs_insertNode][ai_debug] 🏁 Tool execution started:', {
          windowId,
          spaceId,
          content: content.substring(0, 50) + '...',
          type,
          position
        });

        const docsStore = getDocsAppStore(windowId, spaceId);
        const state = docsStore.getState();
        
        // **DEBUG: Log store state**
        console.log('[docs_insertNode][ai_debug] 📦 Store state:', {
          storeId: state.storeId,
          windowId: state.windowId,
          spaceId: state.spaceId,
          activeDocId: state.docId,
          initialized: state.initialized,
          hasEditorView: !!state.editorView,
          hasYdoc: !!state.ydoc,
          docContentLength: state.docContent?.length || 0
        });

        // **DEBUG: Log store registry info**
        console.log('[docs_insertNode][ai_debug] 🗂️ Store lookup key:', `${windowId}-${spaceId}`);
        
        // Get current document nodes to validate position
        const nodes = state.getNodes();
        
        // **DEBUG: Log current nodes**
        console.log('[docs_insertNode][ai_debug] 📄 Current document nodes:', {
          nodeCount: nodes.length,
          nodes: nodes.map(n => ({
            type: n.type,
            pos: n.pos,
            size: n.size,
            content: n.content?.substring(0, 30) + '...',
            isDeletion: n.isDeletion,
            isInsertion: n.isInsertion
          }))
        });
        
        // Get document size/length for validation
        const docSize = nodes.reduce((a, b) => a + b.size, 0);
        
        // Validate position - ensure it's within range
        let safePosition = position;
        if (position < 0) {
          console.log(`[docs_insertNode][ai_debug] ⚠️ Position ${position} is negative, using 0 instead`);
          safePosition = 0;
        } else if (position > docSize) {
          console.log(`[docs_insertNode][ai_debug] ⚠️ Position ${position} is out of range (doc size: ${docSize}), using end position instead`);
          safePosition = docSize;
        }
        
        console.log(`[docs_insertNode][ai_debug] 📍 Inserting at position ${safePosition} (original: ${position}, doc size: ${docSize})`);
        
        const updateDocContent = state.addNode({content, type, pos: safePosition});
        
        // **DEBUG: Log the result of addNode**
        console.log('[docs_insertNode][ai_debug] ✅ Node insertion result:', {
          success: !!updateDocContent,
          resultType: typeof updateDocContent,
          newNodeCount: updateDocContent?.length || 0,
          // Show first few nodes to verify the change
          updatedNodes: updateDocContent?.slice(0, 3).map(n => ({
            type: n.type,
            pos: n.pos,
            size: n.size,
            content: n.content?.substring(0, 30) + '...'
          }))
        });

        // **DEBUG: Check if the store state actually changed**
        const newState = docsStore.getState();
        console.log('[docs_insertNode][ai_debug] 🔄 Store state after edit:', {
          docContentLength: newState.docContent?.length || 0,
          docContentChanged: newState.docContent !== state.docContent,
          ydocExists: !!newState.ydoc
        });

        callback(JSON.stringify(updateDocContent));
      } catch (error: any) {
        console.error('[docs_insertNode][ai_debug] ❌ Error:', error);
        callback(JSON.stringify({
          error: `Failed to insert node: ${error.message || 'Unknown error'}`,
          position,
          content,
          type
        }));
      }
    }
  },
  {
    id: 'docs_removeNode',
    description: 'Remove a node from the doc at the specified position. Returns a list of nodes with their content, type, pos, size, isDeletion, isInsertion. When node marked as isDeletion, it should be ignored.',
    parameters: [
      {
        name: 'windowId',
        type: 'string',
        description: 'The ID of the window containing the document (e.g. "window-12345-abcde")',
        required: true
      },
      {
        name: 'spaceId',
        type: 'string',
        description: 'The ID of the space containing the note',
        required: true
      },
      {
        name: 'pos',
        type: 'number',
        description: 'The position from which to remove text',
        required: true
      }
    ],
    handler: ({windowId, spaceId, pos, callback}: {windowId: string, spaceId: string, pos: number, callback: (text: string) => void}) => {
      try {
        const docsStore = getDocsAppStore(windowId, spaceId);
        const state = docsStore.getState();
        
        // Get current document nodes to validate position
        const nodes = state.getNodes();
        const docSize = nodes.reduce((a, b) => a + b.size, 0);
        
        // Validate position is within range
        if (pos < 0 || pos >= docSize) {
          throw new Error(`Position ${pos} is out of range (0-${docSize - 1})`);
        }
        
        const updateDocContent = state.removeNode(pos);
        console.log('[commands][docs_removeNode] updateDocContent:', updateDocContent);
        callback(JSON.stringify(updateDocContent));
      } catch (error: any) {
        console.error('[commands][docs_removeNode] Error:', error);
        callback(JSON.stringify({
          error: `Failed to remove node: ${error.message || 'Unknown error'}`,
          position: pos
        }));
      }
    }
  },
  {
    id: 'docs_updateNode',
    description: 'Update a node in the doc at the specified position',
    parameters: [
      {
        name: 'windowId',
        type: 'string',
        description: 'The ID of the window containing the document (e.g. "window-12345-abcde")',
        required: true
      },
      {
        name: 'spaceId',
        type: 'string',
        description: 'The ID of the space containing the doc',
        required: true
      },
      {
        name: 'pos',
        type: 'number',
        description: 'The position of the node to update',
        required: true
      },
      {
        name: 'content',
        type: 'string',
        description: 'The content of the node to update',
        required: true
      },
      {
        name: 'type',
        type: 'string',
        description: 'The type of the node to update',
        required: true
      }
    ],
    handler: ({windowId, spaceId, pos, content, type, callback}: {windowId: string, spaceId: string, pos: number, content: string, type: string, callback: (text: string) => void}) => {
      try {
        const docsStore = getDocsAppStore(windowId, spaceId);
        const state = docsStore.getState();
        
        // Get current document nodes to validate position
        const nodes = state.getNodes();
        const docSize = nodes.reduce((a, b) => a + b.size, 0);
        
        // Validate position is within range
        if (pos < 0 || pos >= docSize) {
          throw new Error(`Position ${pos} is out of range (0-${docSize - 1})`);
        }
        
        const updateDocContent = state.updateNode({pos, content, type});
        callback(JSON.stringify(updateDocContent));
      } catch (error: any) {
        console.error('[commands][docs_updateNode] Error:', error);
        callback(JSON.stringify({
          error: `Failed to update node: ${error.message || 'Unknown error'}`,
          position: pos,
          content,
          type
        }));
      }
    }
  },
  {
    id: 'docs_insertMultipleNodes',
    description: 'Insert multiple nodes into a doc at once as a single logical edit. Use this when adding multiple related paragraphs/sections that should be accepted or rejected together.',
    parameters: [
      {
        name: 'windowId',
        type: 'string',
        description: 'The ID of the window containing the document (e.g. "window-12345-abcde")',
        required: true
      },
      {
        name: 'spaceId',
        type: 'string',
        description: 'The ID of the space containing the document',
        required: true
      },
      {
        name: 'nodes',
        type: 'array',
        description: 'Array of nodes to insert. Each node should have: {content: string, type: string, position: number}',
        required: true
      },
      {
        name: 'description',
        type: 'string',
        description: 'Description of what this batch edit does (e.g., "Add PDF outline sections")',
        required: false
      }
    ],
    handler: ({windowId, spaceId, nodes, description, callback}: {windowId: string, spaceId: string, nodes: Array<{content: string, type: string, position: number, attrs?: Record<string, any>}>, description?: string, callback: (text: string) => void}) => {
      try {
        console.log('[docs_insertMultipleNodes][ai_debug] 🏁 Starting batch node insertion:', {
          windowId,
          spaceId,
          nodeCount: nodes.length,
          description
        });

        // If nodes don't have explicit types or are all paragraphs, try to parse them smartly
        const needsSmartParsing = nodes.every(node => node.type === 'paragraph') || 
                                  nodes.some(node => !node.type);
        
        let processedNodes = nodes;
        
        if (needsSmartParsing) {
          console.log('[docs_insertMultipleNodes][ai_debug] 📋 Applying smart content parsing to nodes');
          
          // Parse each node's content individually to determine appropriate types
          processedNodes = nodes.map((node, index) => {
            const structuredContent = parseStructuredContent(node.content);
            
            if (structuredContent.nodes.length === 1) {
              const parsedNode = structuredContent.nodes[0];
              return {
                ...node,
                type: parsedNode.type,
                attrs: parsedNode.attrs,
                content: parsedNode.content
              };
            } else if (structuredContent.nodes.length > 1) {
              // If parsing results in multiple nodes, keep the first one and log this case
              console.log('[docs_insertMultipleNodes][ai_debug] ⚠️ Content split into multiple nodes, using first:', {
                originalContent: node.content.substring(0, 50),
                resultingNodes: structuredContent.nodes.length
              });
              const parsedNode = structuredContent.nodes[0];
              return {
                ...node,
                type: parsedNode.type,
                attrs: parsedNode.attrs,
                content: parsedNode.content
              };
            }
            
            // Fallback to original node
            return node;
          });
        }

        const docsStore = getDocsAppStore(windowId, spaceId);
        const state = docsStore.getState();
        
        // **DEBUG: Log store state**
        console.log('[docs_insertMultipleNodes][ai_debug] 📦 Store state:', {
          storeId: state.storeId,
          windowId: state.windowId,
          spaceId: state.spaceId,
          activeDocId: state.docId,
          initialized: state.initialized,
          hasEditorView: !!state.editorView,
          hasYdoc: !!state.ydoc
        });

        if (!state.editorView) {
          throw new Error('No editor view found');
        }

        // Get current document nodes for position validation
        const currentNodes = state.getNodes();
        const docSize = currentNodes.reduce((a, b) => a + b.size, 0);
        
        // **Use the same revision ID for all nodes in this batch**
        const batchRevisionId = new ObjectId().toString();
        
        // Check if all nodes have the same position (indicating sequential insertion)
        // or different positions (indicating scattered insertion)
        const allSamePosition = processedNodes.every(node => node.position === processedNodes[0].position);
        
        let sortedNodes;
        if (allSamePosition) {
          // For sequential content (like outlines), reverse the order for insertion
          // so they end up in the correct order in the document
          console.log('[docs_insertMultipleNodes][ai_debug] 📋 Sequential insertion detected, reversing for correct order');
          sortedNodes = [...processedNodes].reverse();
        } else {
          // For scattered positions, sort in reverse to prevent position shifts
          console.log('[docs_insertMultipleNodes][ai_debug] 📋 Scattered positions detected, sorting in reverse');
          sortedNodes = [...processedNodes].sort((a, b) => b.position - a.position);
        }
        
        // Insert all nodes with the same revision ID
        let insertedCount = 0;
        let finalNodes = null;
        
        sortedNodes.forEach((node, index) => {
          // Validate position
          let safePosition = node.position;
          if (node.position < 0) {
            console.log(`[docs_insertMultipleNodes][ai_debug] ⚠️ Position ${node.position} is negative, using 0`);
            safePosition = 0;
          } else if (node.position > docSize) {
            console.log(`[docs_insertMultipleNodes][ai_debug] ⚠️ Position ${node.position} is out of range (doc size: ${docSize}), using end`);
            safePosition = docSize;
          }

          // Insert node with shared revision ID
          const editorView = state.editorView;
          if (!editorView) {
            throw new Error('Editor view not available');
          }
          
          const { state: editorState, dispatch } = editorView;
          const { tr } = editorState;

          // Create node with appropriate type and attributes
          const nodeAttrs = { 
            change_status: 'new', 
            revision_id: batchRevisionId,
            batch_description: description || `Batch edit (${processedNodes.length} items)`,
            batch_index: index,
            batch_total: processedNodes.length,
            ...(node.attrs || {})
          };

          let newNode;
          
          if (node.type === 'heading') {
            newNode = editorState.schema.nodes.heading.create(
              nodeAttrs,
              editorState.schema.text(node.content)
            );
          } else if (node.type === 'list_item') {
            // Create list item with paragraph content
            const paragraph = editorState.schema.nodes.paragraph.create(
              {}, 
              editorState.schema.text(node.content)
            );
            newNode = editorState.schema.nodes.list_item.create(nodeAttrs, paragraph);
          } else {
            // Default to paragraph or use specified type if valid
            const nodeType = editorState.schema.nodes[node.type] || editorState.schema.nodes.paragraph;
            newNode = nodeType.create(
              nodeAttrs,
              editorState.schema.text(node.content)
            );
          }

          tr.insert(safePosition, newNode);
          dispatch(tr);
          insertedCount++;
          
          console.log(`[docs_insertMultipleNodes][ai_debug] 📝 Inserted ${node.type} node ${index + 1}/${processedNodes.length}:`, {
            type: node.type,
            position: safePosition,
            attrs: node.attrs,
            revisionId: batchRevisionId,
            contentPreview: node.content.substring(0, 30) + '...'
          });
        });

        // Get final node list
        finalNodes = state.getNodes();
        
        // Update doc content
        const textContent = state.editorView.state.doc.textContent;
        state.setState({ docContent: textContent });
        
        // Persist to CRDT
        const yxml = state.ydoc?.getXmlFragment('prosemirror');
        const yxmlString = yxml?.toString();
        if (state.docId && yxmlString) {
          console.log('[docs_insertMultipleNodes][ai_debug] 💾 Persisting batch to CRDT');
          docsCRDTService.saveToDB(state.docId, yxmlString);
        }

        console.log('[docs_insertMultipleNodes][ai_debug] ✅ Batch operation completed:', {
          insertedCount,
          finalNodeCount: finalNodes?.length || 0,
          batchRevisionId,
          description
        });

        callback(JSON.stringify({
          success: true,
          insertedCount,
          batchRevisionId,
          description: description || `Batch edit (${nodes.length} items)`,
          nodes: finalNodes
        }));

      } catch (error: any) {
        console.error('[docs_insertMultipleNodes][ai_debug] ❌ Batch operation failed:', error);
        callback(JSON.stringify({
          error: `Failed to insert multiple nodes: ${error.message || 'Unknown error'}`,
          nodeCount: nodes?.length || 0
        }));
      }
    }
  },
  {
    id: 'docs_createDoc',
    description: 'Create a new document entity. Returns the created document with ID, name, and other metadata. Note: This only creates the document entity - use space_createWindow to open it in a window.',
    parameters: [
      {
        name: 'spaceId',
        type: 'string',
        description: 'The ID of the space where the document should be created',
        required: true
      },
      {
        name: 'name',
        type: 'string',
        description: 'The name/title for the new document (defaults to "New Document" if not provided)',
        required: false
      }
    ],
    handler: async ({spaceId, name, callback}: {spaceId: string, name?: string, callback: (text: string) => void}) => {
      try {
        // Create a temporary window ID and store for document creation
        // This is a bit of a hack since the store requires windowId/spaceId, but we only need the createDoc functionality
        const tempWindowId = `temp-${Date.now()}`;
        const docsStore = getDocsAppStore(tempWindowId, spaceId);
        const state = docsStore.getState();
        
        // Create the document
        const newDoc = await state.createDoc();
        
        // Update the name if provided
        if (name && name.trim() !== '') {
          try {
            await entityService.update(newDoc.id || newDoc._id, { name: name.trim() });
            
            // Update the local document object
            newDoc.name = name.trim();
            
            console.log(`[commands][docs_createDoc] Updated document name to "${name.trim()}"`);
          } catch (updateError: any) {
            console.error('[commands][docs_createDoc] Error updating document name:', updateError);
            // Continue with creation even if name update fails
          }
        }
        
        console.log('[commands][docs_createDoc] Created new document:', newDoc);
        
        // Return the created document information
        callback(JSON.stringify({
          success: true,
          document: {
            id: newDoc.id || newDoc._id,
            _id: newDoc._id,
            name: newDoc.name,
            entityType: newDoc.entityType,
            created_at: newDoc.created_at,
            skeleton: newDoc.skeleton
          }
        }));
        
      } catch (error: any) {
        console.error('[commands][docs_createDoc] Error:', error);
        callback(JSON.stringify({
          success: false,
          error: `Failed to create document: ${error.message || 'Unknown error'}`,
          spaceId,
          requestedName: name
        }));
      }
    }
  },
  {
    id: 'docs_insertTextBlock',
    description: 'Insert a multi-line text block into a doc as a single logical edit. The text will be automatically split into paragraphs. Use this for adding outlines, lists, or multi-paragraph content that should be accepted/rejected together.',
    systemPromptAddition: 'IMPORTANT: When creating structured content like outlines, reports, or organized documents, use proper formatting:\n\n- Use markdown-style headings (# ## ### etc.) for section titles and hierarchical structure\n- Use bullet points (-) or numbered lists (1. 2. 3.) for lists and sub-points\n- Use proper heading levels: # for main titles, ## for major sections, ### for subsections\n- Format content like "I. Introduction", "A. Overview", "1. First Point" as proper headings by using:\n  # I. Introduction\n  ## A. Overview\n  ### 1. First Point\n\nThis ensures the content will be properly structured in the document editor instead of appearing as plain paragraph text. The document editor can recognize and format these structures appropriately.',
    parameters: [
      {
        name: 'windowId',
        type: 'string',
        description: 'The ID of the window containing the document (e.g. "window-12345-abcde")',
        required: true
      },
      {
        name: 'spaceId',
        type: 'string',
        description: 'The ID of the space containing the document',
        required: true
      },
      {
        name: 'text',
        type: 'string',
        description: 'Multi-line text to insert. Each line (separated by \\n) will become a separate paragraph.',
        required: true
      },
      {
        name: 'position',
        type: 'number',
        description: 'The position at which to start inserting the text block',
        required: true
      },
      {
        name: 'description',
        type: 'string',
        description: 'Description of what this content is (e.g., "PDF outline", "Key findings")',
        required: false
      }
    ],
    handler: ({windowId, spaceId, text, position, description, callback}: {windowId: string, spaceId: string, text: string, position: number, description?: string, callback: (text: string) => void}) => {
      try {
        console.log('[docs_insertTextBlock][ai_debug] 🏁 Starting smart content insertion:', {
          windowId,
          spaceId,
          textLength: text.length,
          startPosition: position,
          description
        });

        // Parse the text to determine proper node types
        const structuredContent = parseStructuredContent(text);
        
        console.log('[docs_insertTextBlock][ai_debug] 📋 Parsed content structure:', {
          totalNodes: structuredContent.totalNodes,
          nodeTypes: structuredContent.nodes.map(n => ({
            type: n.type, 
            attrs: n.attrs, 
            contentPreview: n.content.substring(0, 30),
            hasChildren: !!n.children,
            childrenCount: n.children?.length || 0
          }))
        });

        const docsStore = getDocsAppStore(windowId, spaceId);
        const state = docsStore.getState();
        
        if (!state.editorView) {
          throw new Error('No editor view found');
        }

        // Get current document nodes for position validation
        const currentNodes = state.getNodes();
        const docSize = currentNodes.reduce((a, b) => a + b.size, 0);
        
        // Validate starting position
        let safeStartPosition = position;
        if (position < 0) {
          safeStartPosition = 0;
        } else if (position > docSize) {
          safeStartPosition = docSize;
        }

        // Use the same revision ID for all nodes in this batch
        const batchRevisionId = new ObjectId().toString();
        
        const editorView = state.editorView;
        const { state: editorState, dispatch } = editorView;
        
        // Create all nodes first, then insert them in a single transaction
        const nodesToInsert: any[] = [];
        let nodeIndex = 0;

        // Process each parsed node and create ProseMirror nodes
        structuredContent.nodes.forEach((parsedNode) => {
          console.log(`[docs_insertTextBlock][ai_debug] 📝 Processing node ${nodeIndex + 1}:`, {
            type: parsedNode.type,
            content: parsedNode.content.substring(0, 50),
            hasChildren: !!parsedNode.children,
            childrenCount: parsedNode.children?.length || 0
          });

          // Handle list containers and their items
          if (parsedNode.type === 'bullet_list' || parsedNode.type === 'ordered_list') {
            // Create list items first
            const listItems: any[] = [];
            if (parsedNode.children) {
              parsedNode.children.forEach(childNode => {
                if (childNode.content && childNode.content.trim()) {
                  const paragraph = editorState.schema.nodes.paragraph.create(
                    {}, 
                    editorState.schema.text(childNode.content.trim())
                  );
                  const listItem = editorState.schema.nodes.list_item.create(
                    {
                      change_status: 'new', 
                      revision_id: batchRevisionId
                    }, 
                    paragraph
                  );
                  listItems.push(listItem);
                } else {
                  console.log(`[docs_insertTextBlock][ai_debug] ⚠️ Skipping empty list item:`, childNode);
                }
              });
            }

            if (listItems.length > 0) {
              // Create the list container with its items
              const listNodeAttrs = {
                change_status: 'new', 
                revision_id: batchRevisionId,
                batch_description: description || `Structured content (${structuredContent.totalNodes} items)`,
                batch_index: nodeIndex,
                batch_total: structuredContent.totalNodes
              };

              try {
                const listNode = editorState.schema.nodes[parsedNode.type].create(
                  listNodeAttrs,
                  Fragment.from(listItems)
                );
                
                nodesToInsert.push(listNode);
                console.log(`[docs_insertTextBlock][ai_debug] 📋 Created ${parsedNode.type} with ${listItems.length} items`);
              } catch (error) {
                console.error(`[docs_insertTextBlock][ai_debug] ❌ Failed to create ${parsedNode.type}:`, error);
              }
            }
            nodeIndex++;
            return; // Skip to next node
          }

          // Skip individual list items - they should be handled as part of list containers
          if (parsedNode.type === 'list_item') {
            return;
          }

          // Create regular nodes (headings, paragraphs, etc.)
          if (parsedNode.content && parsedNode.content.trim()) {
            const nodeAttrs = {
              change_status: 'new', 
              revision_id: batchRevisionId,
              batch_description: description || `Structured content (${structuredContent.totalNodes} items)`,
              batch_index: nodeIndex,
              batch_total: structuredContent.totalNodes,
              ...parsedNode.attrs
            };

            let newNode;
            if (parsedNode.type === 'heading') {
              newNode = editorState.schema.nodes.heading.create(
                nodeAttrs,
                editorState.schema.text(parsedNode.content.trim())
              );
            } else {
              // Default to paragraph
              newNode = editorState.schema.nodes.paragraph.create(
                nodeAttrs,
                editorState.schema.text(parsedNode.content.trim())
              );
            }

            nodesToInsert.push(newNode);
            console.log(`[docs_insertTextBlock][ai_debug] 📝 Created ${parsedNode.type} node:`, {
              type: parsedNode.type,
              attrs: parsedNode.attrs,
              contentPreview: parsedNode.content.substring(0, 30) + '...'
            });
          } else {
            console.log(`[docs_insertTextBlock][ai_debug] ⚠️ Skipping empty node:`, parsedNode);
          }
          nodeIndex++;
        });

        // Insert all nodes in a single transaction
        if (nodesToInsert.length > 0) {
          const tr = editorState.tr;
          
          console.log(`[docs_insertTextBlock][ai_debug] 📦 Inserting ${nodesToInsert.length} nodes starting at position ${safeStartPosition}`);
          
          // Insert nodes in forward order, calculating position for each insertion
          let currentInsertPosition = safeStartPosition;
          nodesToInsert.forEach((node, index) => {
            tr.insert(currentInsertPosition, node);
            console.log(`[docs_insertTextBlock][ai_debug] ➕ Inserted node ${index + 1}/${nodesToInsert.length} at position ${currentInsertPosition}`);
            // Update position for next insertion - move past the node we just inserted
            currentInsertPosition += node.nodeSize;
          });

          // Apply all insertions in one transaction
          dispatch(tr);
          
          console.log('[docs_insertTextBlock][ai_debug] ✅ All nodes inserted successfully');
        } else {
          console.log('[docs_insertTextBlock][ai_debug] ⚠️ No valid nodes to insert');
        }

        // Update doc content
        const textContent = state.editorView.state.doc.textContent;
        state.setState({ docContent: textContent });
        
        // Persist to CRDT
        const yxml = state.ydoc?.getXmlFragment('prosemirror');
        const yxmlString = yxml?.toString();
        if (state.docId && yxmlString) {
          docsCRDTService.saveToDB(state.docId, yxmlString);
        }

        console.log('[docs_insertTextBlock][ai_debug] ✅ Smart content insertion completed:', {
          insertedCount: nodesToInsert.length,
          batchRevisionId,
          description,
          structuredNodes: structuredContent.totalNodes
        });

        callback(`Successfully inserted ${nodesToInsert.length} structured content nodes`);
      } catch (error: any) {
        console.error('[docs_insertTextBlock][ai_debug] ❌ Insertion failed:', error);
        callback(`Error: ${error.message}`);
      }
    }
  },
  {
    id: 'docs_loadDocument',
    description: 'Load a specific document in a DocsApp window. Use this after creating a window with space_createWindow.',
    parameters: [
      {
        name: 'windowId',
        type: 'string',
        description: 'The ID of the DocsApp window where the document should be loaded',
        required: true
      },
      {
        name: 'spaceId',
        type: 'string',
        description: 'The ID of the space containing the window',
        required: true
      },
      {
        name: 'documentId',
        type: 'string',
        description: 'The ID of the document to load',
        required: true
      }
    ],
    handler: async ({windowId, spaceId, documentId, callback}: {windowId: string, spaceId: string, documentId: string, callback: (text: string) => void}) => {
      try {
        const docsStore = getDocsAppStore(windowId, spaceId);
        const state = docsStore.getState();
        
        // Initialize the document in the store
        await state.initialize(documentId);
        
        // Set the active document
        state.setDocId(documentId);
        
        console.log('[commands][docs_loadDocument] Loaded document in window:', { documentId, windowId });
        
        callback(JSON.stringify({
          success: true,
          documentId,
          windowId,
          message: 'Document loaded successfully'
        }));
        
      } catch (error: any) {
        console.error('[commands][docs_loadDocument] Error:', error);
        callback(JSON.stringify({
          success: false,
          error: `Failed to load document: ${error.message || 'Unknown error'}`,
          documentId,
          windowId,
          spaceId
        }));
      }
    }
  }
];
