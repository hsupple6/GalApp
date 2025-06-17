import './NotesModalWrapper.scss';

import React from 'react';

interface NotesModalWrapperProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const NotesModalWrapper: React.FC<NotesModalWrapperProps> = ({
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
    <div className="notes-modal-overlay" onClick={onClose}>
      <div className="notes-modal-content" onClick={handleContentClick}>
        <div className="notes-modal-header">
          <h2>{title}</h2>
          <button onClick={onClose} className="notes-close-button">
            ✕
          </button>
        </div>
        <div className="notes-modal-body">{children}</div>
      </div>
    </div>
  );
};

export default NotesModalWrapper; 