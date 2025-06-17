import './DocsModalWrapper.scss';

import React from 'react';

interface DocsModalWrapperProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const DocsModalWrapper: React.FC<DocsModalWrapperProps> = ({
  isOpen,
  onClose,
  title,
  children,
}) => {
  if (!isOpen) return null;

  // Stop propagation to prevent closing when clicking inside the modal
  const handleContentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div className="docs-modal-overlay" onClick={onClose}>
      <div className="docs-modal-content" onClick={handleContentClick}>
        <div className="docs-modal-header">
          <h2>{title}</h2>
          <button onClick={onClose} className="docs-close-button">
            ✕
          </button>
        </div>
        <div className="docs-modal-body">{children}</div>
      </div>
    </div>
  );
};

export default DocsModalWrapper; 