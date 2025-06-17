import React from 'react';
import { ToolbarProps } from '../types';
import './Toolbar.scss';
import {
  BackIcon,
  ForwardIcon,
  UpIcon,
  ListViewIcon,
  GridViewIcon,
  ColumnViewIcon,
  AddIcon,
  TrashIcon
} from '../../../components/MacOSIcons';

const Toolbar: React.FC<ToolbarProps> = ({
  canGoBack,
  canGoForward,
  canGoUp,
  currentPath,
  viewMode,
  selectedItems,
  onBack,
  onForward,
  onUp,
  onChangeViewMode,
  onCreateFolder,
  onDelete
}) => {
  // Handle path input change
  const handlePathChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // This would be implemented to allow direct path entry
    console.log('Path changed:', e.target.value);
  };

  // Handle path input submit
  const handlePathSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // This would navigate to the entered path
    const input = e.currentTarget.querySelector('input');
    if (input) {
      console.log('Navigate to:', input.value);
    }
  };

  return (
    <div className="finder-toolbar">
      <div className="navigation-controls">
        <button 
          className="toolbar-button" 
          onClick={onBack} 
          disabled={!canGoBack}
          title="Back"
        >
          <BackIcon size={16} />
        </button>
        <button 
          className="toolbar-button" 
          onClick={onForward} 
          disabled={!canGoForward}
          title="Forward"
        >
          <ForwardIcon size={16} />
        </button>
        <button 
          className="toolbar-button" 
          onClick={onUp} 
          disabled={!canGoUp}
          title="Up"
        >
          <UpIcon size={16} />
        </button>
      </div>
      
      <form className="path-field" onSubmit={handlePathSubmit}>
        <input 
          type="text" 
          value={currentPath} 
          onChange={handlePathChange}
          placeholder="Path"
        />
      </form>
      
      <div className="view-controls">
        <button 
          className={`toolbar-button ${viewMode === 'list' ? 'active' : ''}`} 
          onClick={() => onChangeViewMode('list')}
          title="List View"
        >
          <ListViewIcon size={16} />
        </button>
        <button 
          className={`toolbar-button ${viewMode === 'grid' ? 'active' : ''}`} 
          onClick={() => onChangeViewMode('grid')}
          title="Grid View"
        >
          <GridViewIcon size={16} />
        </button>
        <button 
          className={`toolbar-button ${viewMode === 'column' ? 'active' : ''}`} 
          onClick={() => onChangeViewMode('column')}
          title="Column View"
        >
          <ColumnViewIcon size={16} />
        </button>
      </div>
      
      <div className="action-controls">
        <button 
          className="toolbar-button" 
          onClick={onCreateFolder}
          title="New Folder"
        >
          <AddIcon size={16} />
        </button>
        <button 
          className="toolbar-button" 
          onClick={onDelete}
          disabled={selectedItems.length === 0}
          title="Delete"
        >
          <TrashIcon size={16} />
        </button>
      </div>
    </div>
  );
};

export default Toolbar; 