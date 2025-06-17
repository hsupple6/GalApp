import './DocsApp.scss';
import { formatDistance } from 'date-fns';
import React from 'react';

import type { DocEntity } from 'types/docs';

interface DocsOverviewProps {
  recentDocs: DocEntity[];
  onCreateNew: () => void;
  onSelectDoc: (id: string) => void;
  show: boolean;
}

export const DocsOverview: React.FC<DocsOverviewProps> = ({ recentDocs, onCreateNew, onSelectDoc, show }) => {
  if (!show) return null;
  return (
    <div className="docsOverview">
      <div className="docsOverviewHeader">
        <span className="appTitle">
          <i className="fas fa-file-alt"></i>
          <span>Documents</span>
        </span>
        <button onClick={onCreateNew} className="createNoteButton">
          <i className="fas fa-plus"></i> New Document
        </button>
      </div>
      <div className="recentDocsList">
        {recentDocs.length === 0 ? (
          <div className="emptyState">
            <i className="fas fa-file-alt fa-3x" style={{ marginBottom: '15px', opacity: 0.5 }}></i>
            <div>No documents yet. Create your first document!</div>
          </div>
        ) : (
          <>
            <h2 className="section-title">
              <i className="fas fa-history"></i> Recent Documents
            </h2>
            {recentDocs.map((doc) => {
              // Safely handle date formatting
              let timeAgo = 'Unknown time';
              try {
                const date = new Date(doc.created_at);
                if (date instanceof Date && !isNaN(date.getTime())) {
                  timeAgo = formatDistance(date, new Date(), { addSuffix: true });
                }
              } catch (error) {
                console.error('Error formatting date:', error);
              }

              return (
                <div key={doc.id} className="docItem" onClick={() => {
                  console.log('[DocsOverview] Selecting doc with ID:', doc.id);
                  onSelectDoc(doc.id || '');
                }}>
                  <div className="doc-preview-icon">
                    <i className="fas fa-file-alt fa-2x" style={{ color: '#4a89dc' }}></i>
                  </div>
                  <div className="docPreview">
                    <span className="docTitle">{doc.name.substring(0, 100) || 'Untitled Document'}</span>
                    <span className="docTimestamp">
                      <i className="far fa-clock" style={{ marginRight: '5px' }}></i>
                      {timeAgo}
                    </span>
                  </div>
                </div>
              );
            })}
          </>
        )}

      </div>
    </div>
  );
};

export default DocsOverview;
