// External imports
import { debounce } from "lodash";
import './DocsYProsemirrorEditor.scss';
// ProseMirror imports
import { baseKeymap, chainCommands, createParagraphNear, liftEmptyBlock, splitBlock, newlineInCode } from "prosemirror-commands";
import { history, redo, undo } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import { EditorState, NodeSelection, Selection, TextSelection, Transaction } from "prosemirror-state";
import { Node, ResolvedPos, Schema } from "prosemirror-model";
import { EditorView, NodeView } from "prosemirror-view";
import React, { useEffect, useRef, useState } from "react";
// y-prosemirror imports
import { initProseMirrorDoc, yUndoPlugin } from "y-prosemirror";
import { yCursorPlugin, ySyncPlugin } from "y-prosemirror";
// y-websocket import
import * as Y from 'yjs';
// List commands for better outline support
import { wrapInList, splitListItem, liftListItem, sinkListItem } from "prosemirror-schema-list";
import { changeDecorationPlugin } from '../plugins/changeDecorationPlugin';
import { entityService } from '../../../services/entityService';
import { docsCRDTService } from '../crdt/docsCRDTService';

import { useDocsAppStore } from "../store/docsAppStore";
import { useSpaceStore } from "stores/spaceStore";
import { schema } from "../editor/schema";

interface EditorContainerProps {
  docId: string;
  windowId: string;
  spaceId: string;
}

// Custom NodeView for hard breaks to ensure proper rendering
class HardBreakView implements NodeView {
  dom: HTMLElement;

  constructor() {
    this.dom = document.createElement('div');
    this.dom.classList.add('hard-break-container');
    this.dom.style.height = '1em';
    this.dom.style.width = '100%';
    this.dom.style.display = 'block';
    this.dom.innerHTML = '<br>';
  }

  update() {
    return true;
  }

  stopEvent() {
    return false;
  }

  ignoreMutation() {
    return true;
  }

  destroy() {
    // No cleanup needed
  }
}

// Helper to get line numbers from node positions
const getLineNumbersFromSelection = (state: EditorState, selection: Selection): { startLine: number, endLine: number } => {
  const { from, to } = selection;
  const doc = state.doc;
  
  // Count block-level nodes to determine line numbers
  const getLineNumber = (pos: number): number => {
    let lineCount = 0;
    
    // Walk through all block nodes and count those that start before our position
    doc.descendants((node, nodePos) => {
      // Only count block-level nodes (paragraphs, headings, list items, etc.)
      // Skip the root document node
      if (node.isBlock && node.type.name !== 'doc') {
        // If this block starts before our position, count it
        if (nodePos < pos) {
          lineCount++;
        }
        // If this block contains our position, count it and stop
        else if (nodePos <= pos && pos < nodePos + node.nodeSize) {
          lineCount++;
          return false; // Stop walking
        }
      }
      return true;
    });
    
    // Line numbers are 1-based
    return Math.max(1, lineCount);
  };
  
  const startLine = getLineNumber(from);
  const endLine = getLineNumber(to);
  
  return { startLine, endLine };
};

// Create a custom function for Enter key that inserts a hard break instead of creating a new paragraph
const insertHardBreakOnEnter = (state: EditorState, dispatch: ((tr: Transaction) => void) | undefined) => {
  const { schema, selection } = state;
  const { $from, $to } = selection;
  
  if (dispatch) {
    // Create a hard break node
    const hardBreak = schema.nodes.hard_break.create();
    
    // Replace the current selection with a hard break
    const tr = state.tr.replaceSelectionWith(hardBreak);
    
    // Ensure cursor is positioned after the hard break
    const pos = $from.pos + 1;
    tr.setSelection(TextSelection.create(tr.doc, pos));
    
    // Apply the transaction and ensure it's visible
    dispatch(tr.scrollIntoView());
  }
  
  return true;
};

const EditorContainer: React.FC<EditorContainerProps> = ({ docId, windowId, spaceId }) => {
  const { ydoc, provider, setEditorView, zoomLevel } = useDocsAppStore(windowId, spaceId);
  const { setIsChatVisible } = useSpaceStore();
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const yXmlFragment = useRef<Y.XmlFragment>();
  const docRef = useRef<any>();
  const mappingRef = useRef<any>();
  const nameTextRef = useRef<Y.Text>();
  const customSchemaRef = useRef<Schema>();

  useEffect(() => {
    if (!ydoc || !provider) return;

    customSchemaRef.current = schema;
    yXmlFragment.current = ydoc.getXmlFragment('prosemirror');
    
    // Initialize the name text field
    nameTextRef.current = ydoc.getText('name');
    
    // Wait for content to be loaded before initializing ProseMirror
    const checkContentAndInitialize = () => {
      const yxml = yXmlFragment.current;
      const schema = customSchemaRef.current;
      if (!yxml || !schema) return;
      
      console.log('[DocsApp - YProseMirror] Checking Y.js content before ProseMirror init:', {
        yxmlLength: yxml.length,
        providerSynced: provider?.synced,
        content: yxml.toString().substring(0, 100)
      });
      
      // Initialize ProseMirror immediately - we handle both empty and populated documents
      // The Y.js sync will handle any needed content synchronization
      console.log('[DocsApp - YProseMirror] Initializing ProseMirror document immediately');
      const { doc, meta } = initProseMirrorDoc(yxml, schema);
      docRef.current = doc;
      mappingRef.current = meta;
      console.log('[DocsApp - YProseMirror] ProseMirror document initialized with content length:', doc.content.size);
    };
    
    // Initialize immediately
    checkContentAndInitialize();
  }, [docId, ydoc, provider]);

  useEffect(() => {
    if (!docRef.current ||
        !editorRef.current ||
        !yXmlFragment.current ||
        !mappingRef.current ||
        !provider ||
        !customSchemaRef.current
      ) return;

    // Create a custom keymap with modified Enter behavior
    const customKeymap = {
      ...baseKeymap,
      'Enter': chainCommands(
        newlineInCode,
        splitListItem(customSchemaRef.current.nodes.list_item),
        insertHardBreakOnEnter,
        createParagraphNear,
        liftEmptyBlock,
        splitBlock
      ),
      // List keybindings for outline editing
      'Shift-Ctrl-8': wrapInList(customSchemaRef.current.nodes.bullet_list),
      'Shift-Ctrl-9': wrapInList(customSchemaRef.current.nodes.ordered_list),
      'Tab': sinkListItem(customSchemaRef.current.nodes.list_item),
      'Shift-Tab': liftListItem(customSchemaRef.current.nodes.list_item),
    };

    const state = EditorState.create({
      doc: docRef.current,
      schema: customSchemaRef.current,
      plugins: [
        ySyncPlugin(yXmlFragment.current, { mapping: mappingRef.current }),
        yCursorPlugin(provider.awareness),
        yUndoPlugin(),
        history(),
        changeDecorationPlugin(),
        keymap({
          'Mod-z': undo,
          'Mod-y': redo,
          'Mod-k': () => {
            setIsChatVisible(true);
            return true;
          },
          ...customKeymap // Use our custom keymap instead of baseKeymap
        })
      ]
    });

    // Create a NodeView factory to handle custom node rendering
    const nodeViews = {
      hard_break: () => new HardBreakView(),
    };

    const view = new EditorView(editorRef.current, { 
      state,
      nodeViews
    });

    setEditorView(view);
    viewRef.current = view;

    // Focus the editor immediately for new documents
    setTimeout(() => {
      if (viewRef.current) {
        viewRef.current.focus();
        console.log('[DocsApp - YProseMirror] Editor focused');
      }
    }, 100); // Small delay to ensure DOM is ready

    // Ensure line breaks are properly styled by adding a specific CSS class to the editor
    if (editorRef.current && view.dom) {
      // Add styles to ensure line breaks work correctly
      const styleElement = document.createElement('style');
      styleElement.textContent = `
        .ProseMirror-focused br, .ProseMirror br {
          display: block !important;
          margin-top: 0.75em !important;
          content: '' !important;
        }
        .ProseMirror p {
          white-space: pre-wrap !important;
          word-break: normal !important;
          min-height: 1.5em !important;
        }
      `;
      document.head.appendChild(styleElement);
      
      // Define the copy event handler to include metadata before using it
      const handleCopy = (e: ClipboardEvent) => {
        if (!viewRef.current || !e.clipboardData) return;
        
        const { state } = viewRef.current;
        const { selection } = state;
        
        // Only if there's a selection
        if (selection.empty) return;
        
        // Get the selected text
        const selectedText = state.doc.textBetween(selection.from, selection.to);
        
        // Debug: Log document structure
        console.log('[DocsEditor Copy Debug] Document structure:');
        let blockIndex = 0;
        state.doc.descendants((node, pos) => {
          if (node.isBlock && node.type.name !== 'doc') {
            blockIndex++;
            console.log(`  Block ${blockIndex}: ${node.type.name} at pos ${pos}-${pos + node.nodeSize}, content: "${node.textContent.slice(0, 50)}..."`);
          }
          return true;
        });
        
        // Debug: Log selection details
        console.log(`[DocsEditor Copy Debug] Selection from ${selection.from} to ${selection.to}`);
        console.log(`[DocsEditor Copy Debug] Selected text: "${selectedText.slice(0, 100)}..."`);
        
        // Get line numbers from selection
        const { startLine, endLine } = getLineNumbersFromSelection(state, selection);
        
        console.log(`[DocsEditor Copy Debug] Calculated lines: ${startLine}-${endLine}`);
        
        // Create special format with metadata
        const textWithMetadata = `${selectedText}\n\nDOC:${docId}:LINES=${startLine}-${endLine}`;
        
        // Add both the plain text and our custom format to the clipboard
        e.clipboardData.setData('text/plain', textWithMetadata);
        
        // Prevent default to use our custom data
        e.preventDefault();
      };
      
      // Add the event listener to the editor's DOM
      editorRef.current.addEventListener('copy', handleCopy);
      
      // Return cleanup function to remove style element
      return () => {
        document.head.removeChild(styleElement);
        
        if (viewRef.current) {
          viewRef.current.destroy();
          viewRef.current = null;
          setEditorView(null);
        }
        
        // Clean up copy event listener
        if (editorRef.current) {
          editorRef.current.removeEventListener('copy', handleCopy);
        }
      };
    }

    return () => {
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
        setEditorView(null);
      }
    };
  }, [docId, provider, setEditorView]);

  useEffect(() => {
    if (!viewRef.current) return;

    const updateHandler = () => {
      const content = viewRef.current?.state.doc.textContent;
      if (content && nameTextRef.current) {
        const first100Chars = content.slice(0, 100);
        nameTextRef.current.delete(0, nameTextRef.current.length);
        nameTextRef.current.insert(0, first100Chars);

        // Save content to database as backup
        if (docId && yXmlFragment.current) {
          const xmlContent = yXmlFragment.current.toString();
          console.log('[DocsApp - YProseMirror] Content changed, saving to DB as backup', { 
            contentLength: content.length, 
            xmlContentLength: xmlContent.length 
          });
          
          // Explicitly save to DB through CRDT service
          docsCRDTService.saveToDB(docId, xmlContent);
          
          // Debugging log to track persistence
          console.log('[DocsApp - YProseMirror] Save to DB triggered with doc length:', xmlContent.length);
        } else {
          console.warn('[DocsApp - YProseMirror] Cannot save content: missing docId or yXmlFragment');
        }
      }
    };

    // Initial content save
    viewRef.current.dispatch(viewRef.current.state.tr);
    updateHandler();

    // Properly attach the event listener with the same function reference
    viewRef.current.dom.addEventListener('input', updateHandler);

    // Set up a direct transaction handler on the view
    const oldDispatch = viewRef.current.dispatch;
    viewRef.current.dispatch = (tr) => {
      oldDispatch.call(viewRef.current, tr);
      if (tr.docChanged) {
        // Only trigger on actual document changes
        console.log('[DocsApp - YProseMirror] Document change detected through transaction');
        updateHandler();
      }
    };

    return () => {
      // Clean up event listeners with the proper references
      if (viewRef.current) {
        viewRef.current.dom.removeEventListener('input', updateHandler);
        // Restore original dispatch if it exists
        if (oldDispatch) {
          viewRef.current.dispatch = oldDispatch;
        }
      }
    };
  }, [docId]); // Only depend on docId, not viewRef.current which causes re-renders

  // Apply zoom level to the editor content
  useEffect(() => {
    if (editorRef.current) {
      // Apply zoom as font-size to the container
      const fontSize = `${14 * zoomLevel / 100}px`;
      editorRef.current.style.fontSize = fontSize;
      
      // Also apply to ProseMirror content if it exists
      const proseMirror = editorRef.current.querySelector('.ProseMirror');
      if (proseMirror instanceof HTMLElement) {
        proseMirror.style.fontSize = fontSize;
      }
    }
  }, [zoomLevel]);

  return (
    <>
      <div className="prose-mirror-editor" ref={editorRef} />
    </>
  );
};

export default EditorContainer;

