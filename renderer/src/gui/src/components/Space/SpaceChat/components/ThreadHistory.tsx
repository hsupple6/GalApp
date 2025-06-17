import './ThreadHistory.scss';

import React, { useEffect, useRef } from 'react';

import { ThreadEntity } from 'types/chat';

interface ThreadHistoryProps {
  threads: Record<string, ThreadEntity>;
  currentThreadId?: string;
  onSelectThread: (threadId: string) => void;
  onClose: () => void;
}

export const ThreadHistory: React.FC<ThreadHistoryProps> = ({
  threads,
  currentThreadId,
  onSelectThread,
  onClose
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        event.stopPropagation();
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const getTimeLabel = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  // Sort threads by lastActive
  const sortedThreads = Object.values(threads).sort(
    (a, b) => new Date(b?.updated_at || b?.created_at || '').getTime() - new Date(a?.updated_at || a?.created_at || '').getTime()
  );

  return (
    <div className="thread-history" ref={containerRef}>
      <div className="thread-history-header">
        <div className="panelTitle">Chat History</div>
        <button 
          className="close-button" 
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
        >
          ×
        </button>
      </div>
      <div className="thread-list">
        {sortedThreads.map(thread => (
          <button
            key={thread._id}
            className={`thread-item ${currentThreadId === thread._id ? 'active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              if (thread._id) {
                onSelectThread(thread._id);
              } else {
                console.error('[ThreadHistory] Thread has no id:', thread);
              }
            }}
          >
            <div className="thread-info">
              <div className="thread-header">
                <span className="thread-title">{thread.name}</span>
              </div>
              <div className="thread-meta-line">
                <span className="thread-time">{getTimeLabel(new Date(thread.created_at))} •</span>
                <span className="thread-meta">
                  {thread.skeleton.message_ids.length} messages
                </span>
              </div>
            </div>
            <span className="thread-type">{thread.skeleton.mode}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
} 