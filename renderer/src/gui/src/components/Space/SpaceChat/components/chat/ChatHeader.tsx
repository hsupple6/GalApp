import React from 'react';

import { ThreadEntity } from 'types/chat';
import { ChatMode } from '../../types';

interface ChatHeaderProps {
  mode: ChatMode;
  setMode: (mode: ChatMode) => void;
  onNewChat: () => void;
  onClose: () => void;
  getModeDescription?: (mode: ChatMode) => string;
  threads: Record<string, ThreadEntity>;
  currentThreadName?: string | null;
  children?: React.ReactNode;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  mode,
  setMode,
  onNewChat,
  onClose,
  getModeDescription,
  threads,
  currentThreadName,
  children
}) => {
  return (
    <div className="chat-header">
      <div className="header-title-section">
        <div className="panelTitle">Ai</div>
        {currentThreadName && <div className="currentThreadName">{currentThreadName}</div>}
      </div>
      {children}
    </div>
  );
};