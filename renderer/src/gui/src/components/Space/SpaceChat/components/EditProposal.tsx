import './EditProposal.scss';

import React from 'react';

export interface EditProposal {
  noteId: string;
  originalText: string;
  proposedEdit: string;
  startPosition: number;
  endPosition: number;
}

interface EditProposalDisplayProps {
  proposal: EditProposal;
  onAccept: () => void;
  onReject: () => void;
  onPreview: () => void;
  isStreaming?: boolean;
}

export const EditProposalDisplay: React.FC<EditProposalDisplayProps> = ({
  proposal,
  onAccept,
  onReject,
  onPreview,
  isStreaming = false
}) => {
  return (
    <div className="edit-proposal">
      <div className="edit-proposal-header">
        <div className="edit-title">
          <span className="entity-name">Notes</span>
          <span className="file-path">main.ts</span>
        </div>
        <div className="edit-proposal-actions">
          <button onClick={onPreview} className="preview-button">
            👁️ Preview
          </button>
          <button onClick={onAccept} className="accept-button" disabled={isStreaming}>
            ✓ Apply
          </button>
          <button onClick={onReject} className="reject-button">
            ✕
          </button>
        </div>
      </div>
      
      <div className="edit-proposal-content">
        <div className="edit-original">
          <div className="label">Original:</div>
          <div className="text">{proposal.originalText}</div>
        </div>
        <div className="edit-proposed">
          <div className="label">Proposed{isStreaming ? ' (typing...)' : ':'}</div>
          <div className="text">{proposal.proposedEdit}</div>
        </div>
      </div>
    </div>
  );
}; 