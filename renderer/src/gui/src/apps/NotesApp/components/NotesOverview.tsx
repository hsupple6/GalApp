import { formatDistance, formatDistanceToNow, isAfter, isFuture } from 'date-fns';
import React from 'react';

import type { UINote } from '../../../types/notes';

interface NotesOverviewProps {
  recentNotes: UINote[];
  onCreateNew: () => void;
  onSelectNote: (id: string) => void;
  show: boolean;
}

export const NotesOverview: React.FC<NotesOverviewProps> = ({ recentNotes, onCreateNew, onSelectNote, show }) => {
  if (!show) return null;
  
  // Function to convert HTML content to plain text
  const stripHtml = (html: string) => {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    return temp.textContent || temp.innerText || '';
  };
  
  return (
    <div className="notesOverview notes-app-namespace">
      <div className="notesOverviewHeader">
        <span className="appTitle">Notes</span>
        <button onClick={onCreateNew} className="createNoteButton">
          <span className="buttonIcon">+</span>
        </button>
      </div>
      <div className="recentNotesList">
        {recentNotes.length === 0 ? (
          <div className="emptyState">No notes yet. Create your first note!</div>
        ) : (
          recentNotes.map((note) => {
            // Safely handle date formatting
            let timeAgo = 'Unknown time';
            try {
              const date = new Date(note.updated);
              const now = new Date();
              
              // Always treat dates in the future as if they were just now
              // This ensures we always show "ago" rather than "in about X time"
              if (isFuture(date)) {
                timeAgo = 'just now';
              } else {
                timeAgo = formatDistanceToNow(date, { addSuffix: true });
              }
            } catch (error) {
              console.error('Error formatting date:', error);
            }

            // Process the content to display as plain text
            const displayContent = stripHtml(note.content);

            return (
              <div key={note.id} className="noteItem" onClick={() => {
                console.log('[NotesOverview] Selecting note with ID:', note.id);
                onSelectNote(note.id);
              }}>
                <div className="notePreview">
                  <span className="noteTitle">{displayContent}</span>
                  <span className="noteTimestamp">{timeAgo}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default NotesOverview;
