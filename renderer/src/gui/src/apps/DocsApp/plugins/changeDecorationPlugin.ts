import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet, EditorView } from "prosemirror-view";
import { Node } from "prosemirror-model";
import { Transaction, EditorState, TextSelection } from "prosemirror-state";

// Create a plugin key for our plugin
const changeDecorationsKey = new PluginKey("changeDecorations");

class ChangeDecorationPlugin {
  view: EditorView;
  
  constructor(view: EditorView) {
    this.view = view;
  }
  
  update() {
    return true; // Always return true to ensure redraws
  }
  
  destroy() {
    // Nothing to clean up
  }
}

function createDecorations(doc: Node): DecorationSet {
  const decorations: Decoration[] = [];
  const changeGroups = new Map<string, {endPos: number, firstPos: number}>();
  
  // First pass: find all changes
  doc.descendants((node: Node, pos: number) => {
    if (node.attrs?.revision_id) {
      const { revision_id } = node.attrs;
      const endPos = pos + node.nodeSize;
      
      // Track both first and last position
      if (!changeGroups.has(revision_id)) {
        changeGroups.set(revision_id, { 
          endPos: endPos,
          firstPos: pos 
        });
      } else {
        const group = changeGroups.get(revision_id)!;
        // Update end position if this is further
        if (endPos > group.endPos) {
          group.endPos = endPos;
        }
        // Update first position if this is earlier
        if (pos < group.firstPos) {
          group.firstPos = pos;
        }
      }
    }
  });
  
  // Second pass: create widget decorations
  for (const [revision_id, positions] of changeGroups.entries()) {
    console.log(`Creating widget for revision ${revision_id} at positions: first=${positions.firstPos}, end=${positions.endPos}`);
    
    // Create the widget element
    const widget = document.createElement("div");
    widget.className = "change-controls";
    widget.setAttribute("data-ctrl-revision-id", revision_id);
    
    // Position in right gutter
    widget.style.position = "absolute";
    widget.style.right = "20px"; // Distance from right edge
    widget.style.marginTop = "-2.5em"; // Adjust vertical position
    
    // Create custom HTML hover overlay for highlighting
    let isHovered = false;
    let activeTimeout: number | null = null;
    
    // Add hover handlers to the container
    widget.onmouseenter = () => {
      console.log(`HOVER START on revision ${revision_id}`);
      isHovered = true;
      
      // Clear any pending timeout
      if (activeTimeout !== null) {
        window.clearTimeout(activeTimeout);
        activeTimeout = null;
      }
      
      // Add a special class to the document body when hovering
      document.body.classList.add(`hovering-revision-${revision_id}`);
      
      // Add a style tag with specific targeting
      const styleId = `highlight-style-${revision_id}`;
      let styleEl = document.getElementById(styleId) as HTMLStyleElement;
      
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = styleId;
        document.head.appendChild(styleEl);
      }
      
      // Use a very specific selector that will override other styles
      styleEl.textContent = `
        /* Highlight all elements with this revision ID */
        [data-revision-id="${revision_id}"] {
          background-color: rgb(252, 254, 143) !important;
        }
        
        /* Special styling for new changes (darker green) */
        [data-revision-id="${revision_id}"][data-change-status="new"] {
          background-color: rgba(0, 180, 42, 0.4) !important;
        }
        
        /* Special styling for old changes (darker red) */
        [data-revision-id="${revision_id}"][data-change-status="old"] {
          background-color: rgba(220, 38, 38, 0.4) !important;
        }
      `;
    };
    
    widget.onmouseleave = () => {
      console.log(`HOVER END on revision ${revision_id}`);
      isHovered = false;
      
      // Use a timeout to ensure the styles are removed
      activeTimeout = window.setTimeout(() => {
        if (!isHovered) {
          console.log(`REMOVING styles for ${revision_id}`);
          // Remove the body class
          document.body.classList.remove(`hovering-revision-${revision_id}`);
          
          // Remove the style element
          const styleEl = document.getElementById(`highlight-style-${revision_id}`);
          if (styleEl) {
            document.head.removeChild(styleEl);
          }
          
          // Extra cleanup: brute force style removal
          const elements = document.querySelectorAll(`[data-revision-id="${revision_id}"]`);
          elements.forEach(el => {
            if (el instanceof HTMLElement) {
              el.style.removeProperty('background-color');
              el.style.removeProperty('font-weight');
              el.style.removeProperty('color');
              el.style.removeProperty('border');
              el.style.removeProperty('text-decoration');
            }
          });
        }
      }, 50); // Short delay to handle potential mouse movement between elements
    };
    
    // Create buttons
    const acceptBtn = document.createElement("button");
    acceptBtn.className = "accept-button";
    acceptBtn.textContent = "✓";
    acceptBtn.title = "Accept changes";
    acceptBtn.onclick = () => handleAccept(revision_id);
    
    const rejectBtn = document.createElement("button");
    rejectBtn.className = "reject-button";
    rejectBtn.textContent = "✕";
    rejectBtn.title = "Reject changes";
    rejectBtn.onclick = () => handleReject(revision_id);
    
    // Append buttons to widget
    widget.appendChild(acceptBtn);
    widget.appendChild(rejectBtn);
    
    // Use the END position to place controls after the change
    const insertPosition = positions.endPos;
    
    // Create the decoration - place it at the end of the last node
    decorations.push(
      Decoration.widget(insertPosition, widget, {
        key: `change-${revision_id}`,
        side: 1, // Place after the node
        stopEvent: () => true
      })
    );
  }
  
  return DecorationSet.create(doc, decorations);
}

function handleAccept(revision_id: string) {
  const view = window.prosemirrorView;
  if (!view) return;
  
  const { state, dispatch } = view;
  const { tr } = state;
  
  // First pass: collect positions for deletion
  const posToDelete: [number, number][] = [];
  
  // Process all revisions in the document
  state.doc.descendants((node: Node, pos: number) => {
    // Only process nodes with this revision ID
    if (node.attrs?.revision_id === revision_id) {
      // For "new" content, keep it but remove the change markers
      if (node.attrs.change_status === "new") {
        const newAttrs = { ...node.attrs };
        delete newAttrs.change_status;
        delete newAttrs.revision_id;
        tr.setNodeMarkup(pos, null, newAttrs);
      } 
      // For "old" content, mark for deletion
      else if (node.attrs.change_status === "old") {
        console.log(`Marking old content for deletion at pos ${pos}, size ${node.nodeSize}`);
        posToDelete.push([pos, pos + node.nodeSize]);
      }
    }
  });
  
  // Second pass: delete old content (from right to left to avoid position shifts)
  if (posToDelete.length > 0) {
    // Sort positions in descending order so we delete from right to left
    posToDelete.sort((a, b) => b[0] - a[0]);
    
    for (const [start, end] of posToDelete) {
      console.log(`Deleting content from ${start} to ${end}`);
      tr.delete(start, end);
    }
  }
  
  console.log("Accepted changes, dispatching transaction");
  dispatch(tr);
}

function handleReject(revision_id: string) {
  const view = window.prosemirrorView;
  if (!view) return;
  
  const { state, dispatch } = view;
  const { tr } = state;
  
  // First pass: collect positions for deletion
  const posToDelete: [number, number][] = [];
  
  // Process all revisions in the document
  state.doc.descendants((node: Node, pos: number) => {
    // Only process nodes with this revision ID
    if (node.attrs?.revision_id === revision_id) {
      // For "old" content, keep it but remove the change markers
      if (node.attrs.change_status === "old") {
        const oldAttrs = { ...node.attrs };
        delete oldAttrs.change_status;
        delete oldAttrs.revision_id;
        tr.setNodeMarkup(pos, null, oldAttrs);
      } 
      // For "new" content, mark for deletion
      else if (node.attrs.change_status === "new") {
        console.log(`Marking new content for deletion at pos ${pos}, size ${node.nodeSize}`);
        posToDelete.push([pos, pos + node.nodeSize]);
      }
    }
  });
  
  // Second pass: delete new content (from right to left to avoid position shifts)
  if (posToDelete.length > 0) {
    // Sort positions in descending order so we delete from right to left
    posToDelete.sort((a, b) => b[0] - a[0]);
    
    for (const [start, end] of posToDelete) {
      console.log(`Deleting content from ${start} to ${end}`);
      tr.delete(start, end);
    }
  }
  
  console.log("Rejected changes, dispatching transaction");
  dispatch(tr);
}

// Workaround to access view from event handlers
declare global {
  interface Window {
    prosemirrorView: EditorView | null;
  }
}

export const changeDecorationPlugin = () =>
  new Plugin({
    key: changeDecorationsKey,
    
    view(editorView) {
      // Store view globally for event handlers
      window.prosemirrorView = editorView;
      return new ChangeDecorationPlugin(editorView);
    },
    
    props: {
      decorations(state) {
        return createDecorations(state.doc);
      }
    }
  }); 