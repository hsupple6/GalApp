import './SearchPanel.scss';

import React, { useState } from 'react';

interface SearchPanelProps {
  document: any;
  currentPage: number;
  onResultClick: (page: number) => void;
}

export const SearchPanel: React.FC<SearchPanelProps> = ({
  document,
  currentPage,
  onResultClick,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="pdf-search-panel">
      <div className="search-header">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search..."
        />
      </div>
      <div className="search-results">
        {/* Placeholder for search results */}
        <div className="search-result">
          No results yet
        </div>
      </div>
    </div>
  );
}; 