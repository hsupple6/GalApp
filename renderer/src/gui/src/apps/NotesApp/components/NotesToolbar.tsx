import React from 'react';
import './NotesToolbar.scss';
import { EditorView } from 'prosemirror-view';
import { toggleMark, setBlockType } from 'prosemirror-commands';
import { schema } from 'prosemirror-schema-basic';
import { TextSelection } from 'prosemirror-state';

interface NotesToolbarProps {
  editorView: EditorView | null;
  onBack?: () => void;
  noteContent?: string;
}

const NotesToolbar: React.FC<NotesToolbarProps> = ({ editorView, onBack, noteContent }) => {
  const applyCommand = (command: any) => {
    if (!editorView) return;
    command(editorView.state, editorView.dispatch);
    editorView.focus();
  };
  
  const toggleBold = () => {
    if (!editorView) return;
    applyCommand(toggleMark(schema.marks.strong));
  };
  
  const toggleItalic = () => {
    if (!editorView) return;
    applyCommand(toggleMark(schema.marks.em));
  };
  
  const toggleCode = () => {
    if (!editorView) return;
    applyCommand(toggleMark(schema.marks.code));
  };
  
  const setHeading = (level: number) => {
    if (!editorView) return;
    
    // Get the current selection
    const { selection } = editorView.state;
    
    // Create a custom command that preserves the content
    const safeSetBlockType = (state: any, dispatch: any) => {
      const { $from, $to } = state.selection;
      const range = $from.blockRange($to);
      
      if (!range) return false;
      
      // Check if there's content in the current block
      const node = $from.node();
      if (node.type !== schema.nodes.heading && node.content.size === 0) {
        // If there's no content, we need to add some placeholder text
        if (dispatch) {
          const tr = state.tr;
          tr.insertText("Heading", $from.pos);
          dispatch(tr);
        }
        return true;
      }
      
      // If there is content, apply the heading style normally
      return setBlockType(schema.nodes.heading, { level })(state, dispatch);
    };
    
    applyCommand(safeSetBlockType);
  };
  
  const setParagraph = () => {
    if (!editorView) return;
    
    // Create a custom command that preserves content when converting from heading to paragraph
    const safeSetParagraph = (state: any, dispatch: any) => {
      const { $from, $to } = state.selection;
      const range = $from.blockRange($to);
      
      if (!range) return false;
      
      // If we're converting from a heading with no content, add placeholder text
      const node = $from.node();
      if (node.type === schema.nodes.heading && node.content.size === 0) {
        if (dispatch) {
          const tr = state.tr;
          tr.insertText("Paragraph", $from.pos);
          dispatch(tr);
        }
        return true;
      }
      
      // Otherwise, apply paragraph formatting normally
      return setBlockType(schema.nodes.paragraph)(state, dispatch);
    };
    
    applyCommand(safeSetParagraph);
  };

  // Extract note title from content (first 30 chars)
  const getTitle = () => {
    if (!noteContent) return 'New Note';
    
    // Strip HTML tags if present
    const stripHtml = (html: string) => {
      const temp = document.createElement('div');
      temp.innerHTML = html;
      return temp.textContent || temp.innerText || '';
    };
    
    const plainText = stripHtml(noteContent);
    // Use first line or first 30 chars
    const firstLine = plainText.split('\n')[0] || '';
    return firstLine.length > 30 ? firstLine.substring(0, 30) + '...' : firstLine || 'New Note';
  };

  return (
    <div className="notes-toolbar">
      <div className="toolbar-content">
        <div className="toolbar-left">
          {onBack && (
            <button onClick={onBack} className="back-button">
              <i className="icon-back">←</i>
            </button>
          )}
          <div className="note-title">{getTitle()}</div>
        </div>
        
        <div className="toolbar-right">
          <div className="toolbar-group">
            <button className="toolbar-button" onClick={toggleBold} title="Bold">
              <i className="icon-bold">B</i>
            </button>
            <button className="toolbar-button" onClick={toggleItalic} title="Italic">
              <i className="icon-italic">I</i>
            </button>
            <button className="toolbar-button" onClick={toggleCode} title="Code">
              <i className="icon-code">{`</>`}</i>
            </button>
          </div>
          
          <div className="toolbar-group">
            <button className="toolbar-button" onClick={() => setHeading(1)} title="Heading 1">
              <i className="icon-h1">H1</i>
            </button>
            <button className="toolbar-button" onClick={() => setHeading(2)} title="Heading 2">
              <i className="icon-h2">H2</i>
            </button>
            <button className="toolbar-button" onClick={() => setHeading(3)} title="Heading 3">
              <i className="icon-h3">H3</i>
            </button>
            <button className="toolbar-button" onClick={setParagraph} title="Paragraph">
              <i className="icon-paragraph">P</i>
            </button>
          </div>
          
          <div className="toolbar-group">
            <button className="toolbar-button" title="Checklist">
              <i className="icon-checklist">☑</i>
            </button>
            <button className="toolbar-button" title="Bullets">
              <i className="icon-bullet">•</i>
            </button>
            <button className="toolbar-button" title="Numbered List">
              <i className="icon-numbered">1.</i>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotesToolbar; 