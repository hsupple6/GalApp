import './Thumbnails.scss';

import React from 'react';

interface ThumbnailsProps {
  document: any;
  currentPage: number;
  onPageSelect: (pageNumber: number) => void;
}

export const Thumbnails: React.FC<ThumbnailsProps> = ({
  document,
  currentPage,
  onPageSelect,
}) => {
  return (
    <div className="pdf-thumbnails">
      <div className="thumbnails-content">
        {/* Placeholder for thumbnails */}
        <div 
          className={`thumbnail ${currentPage === 1 ? 'active' : ''}`}
          onClick={() => onPageSelect(1)}
        >
          Page 1
        </div>
      </div>
    </div>
  );
}; 