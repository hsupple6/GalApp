import React from 'react';
import { UIThread } from '../../types/chatApp';
import './ThreadSidebar.scss';
import { FiChevronLeft, FiPlus } from 'react-icons/fi';
import { extractId } from '../../utils/mongoUtils';

interface ThreadSidebarProps {
  threads: UIThread[];
  activeThreadId: string | null;
  onSelectThread: (threadId: string) => void;
  onCreateThread: () => void;
  onToggleSidebar?: () => void;
  collapsed?: boolean;
  isCreatingThread?: boolean;
}

const ThreadSidebar: React.FC<ThreadSidebarProps> = ({
  threads,
  activeThreadId,
  onSelectThread,
  onCreateThread,
  onToggleSidebar,
  collapsed = false,
  isCreatingThread = false,
}) => {
  if (collapsed) {
    return (
      <div className="thread-sidebar collapsed">
        <div className="thread-sidebar-header">
          <button onClick={onToggleSidebar} className="expand-button">
            <FiChevronLeft size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="thread-sidebar">
      <div className="thread-sidebar-header">
        <div className="aiName">Conversations</div>
        <div className="sidebar-actions">
          <button onClick={onToggleSidebar} className="collapse-button">
            <FiChevronLeft size={16} />
          </button>
        </div>
      </div>
      
      <div className="thread-actions">
        <button 
          className="create-thread-btn" 
          onClick={onCreateThread} 
          disabled={isCreatingThread}
        >
          <FiPlus size={16} />
          {isCreatingThread ? 'Creating...' : 'New Chat'}
        </button>
      </div>

      <div className="thread-list">
        {threads.length === 0 ? (
          <div className="empty-state">
            No conversations yet. Click "New Chat" to start.
          </div>
        ) : (
          threads.map((thread) => {
            const threadId = extractId(thread.id);
            return (
              <div
                key={threadId}
                className={`thread-item ${activeThreadId === threadId ? 'active' : ''}`}
                onClick={() => onSelectThread(threadId)}
              >
                <div className="thread-title">{thread.title || 'New Conversation'}</div>
                <div className="thread-date">{new Date(thread.updated).toLocaleDateString()}</div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ThreadSidebar; 