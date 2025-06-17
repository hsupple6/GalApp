import './TextDiffModal.scss';

import React from 'react';

import NotesModalWrapper from './NotesModalWrapper';

interface TextDiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  beforeText: string;
  afterText: string;
}

const TextDiffModal: React.FC<TextDiffModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  beforeText,
  afterText,
}) => {
  return (
    <NotesModalWrapper
      isOpen={isOpen}
      onClose={onClose}
      title="Text Change Preview"
    >
      <div className="text-diff-modal">
        <div className="diff-container">
          <div className="diff-column before">
            <h3>Before</h3>
            <div className="text-content">
              {beforeText || <span className="empty-text">(Empty)</span>}
            </div>
          </div>
          <div className="diff-column after">
            <h3>After</h3>
            <div className="text-content">
              {afterText || <span className="empty-text">(Empty)</span>}
            </div>
          </div>
        </div>
        <div className="button-container">
          <button onClick={onConfirm} className="confirm-button">
            Apply Changes
          </button>
          <button onClick={onClose} className="cancel-button">
            Cancel
          </button>
        </div>
      </div>
    </NotesModalWrapper>
  );
};

export default TextDiffModal; 