import React from 'react';

import { ViewportState } from '../utils/viewport';

interface PDFToolbarProps {
  viewport: ViewportState;
  onViewportChange: (viewport: ViewportState) => void;
  activeTool: 'highlight' | 'annotate' | 'select';
  onToolChange: (tool: 'highlight' | 'annotate' | 'select') => void;
  onSave: () => void;
}

export const PDFToolbar: React.FC<PDFToolbarProps> = ({
  viewport,
  onViewportChange,
  activeTool,
  onToolChange,
  onSave
}) => {
  const zoomLevels = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];

  return (
    <div className="pdf-toolbar">
      <div className="tool-group">
        <button
          className={`tool-button ${activeTool === 'select' ? 'active' : ''}`}
          onClick={() => onToolChange('select')}
          title="Select Text"
        >
          <i className="fas fa-i-cursor" />
        </button>
        <button
          className={`tool-button ${activeTool === 'highlight' ? 'active' : ''}`}
          onClick={() => onToolChange('highlight')}
          title="Highlight Text"
        >
          <i className="fas fa-highlighter" />
        </button>
        <button
          className={`tool-button ${activeTool === 'annotate' ? 'active' : ''}`}
          onClick={() => onToolChange('annotate')}
          title="Add Annotation"
        >
          <i className="fas fa-comment-alt" />
        </button>
      </div>

      <div className="zoom-group">
        <button
          onClick={() => onViewportChange({
            ...viewport,
            scale: Math.max(0.25, viewport.scale - 0.25)
          })}
          title="Zoom Out"
        >
          <i className="fas fa-search-minus" />
        </button>
        <select
          value={viewport.scale}
          onChange={(e) => onViewportChange({
            ...viewport,
            scale: parseFloat(e.target.value)
          })}
          title="Zoom Level"
        >
          {zoomLevels.map(level => (
            <option key={level} value={level}>
              {Math.round(level * 100)}%
            </option>
          ))}
        </select>
        <button
          onClick={() => onViewportChange({
            ...viewport,
            scale: Math.min(4, viewport.scale + 0.25)
          })}
          title="Zoom In"
        >
          <i className="fas fa-search-plus" />
        </button>
      </div>

      <div className="rotation-group">
        <button
          onClick={() => onViewportChange({
            ...viewport,
            rotation: (viewport.rotation - 90) % 360
          })}
          title="Rotate Left"
        >
          <i className="fas fa-undo" />
        </button>
        <button
          onClick={() => onViewportChange({
            ...viewport,
            rotation: (viewport.rotation + 90) % 360
          })}
          title="Rotate Right"
        >
          <i className="fas fa-redo" />
        </button>
      </div>

      <div className="action-group">
        <button onClick={onSave} title="Save Changes">
          <i className="fas fa-save" />
        </button>
      </div>
    </div>
  );
}; 