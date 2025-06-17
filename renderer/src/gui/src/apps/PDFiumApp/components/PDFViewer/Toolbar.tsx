import './Toolbar.scss';

import React from 'react';

interface ToolbarProps {
  currentPage: number;
  totalPages: number;
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRotate: () => void;
  onToggleSearch: () => void;
  onToggleThumbnails: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  currentPage,
  totalPages,
  scale,
  onZoomIn,
  onZoomOut,
  onRotate,
  onToggleSearch,
  onToggleThumbnails
}) => {
  return (
    <div className="pdf-toolbar">
      <div className="toolbar-group">
        <button onClick={onToggleThumbnails} title="Toggle Thumbnails">
          ☰
        </button>
      </div>

      <div className="toolbar-group">
        <button onClick={onZoomOut} title="Zoom Out">-</button>
        <span>{Math.round(scale * 100)}%</span>
        <button onClick={onZoomIn} title="Zoom In">+</button>
        <button onClick={onRotate} title="Rotate">⟳</button>
      </div>

      <div className="toolbar-group">
        <span>
          Page {currentPage} of {totalPages}
        </span>
      </div>

      <div className="toolbar-group">
        <button onClick={onToggleSearch} title="Search">
          🔍
        </button>
      </div>
    </div>
  );
}; 