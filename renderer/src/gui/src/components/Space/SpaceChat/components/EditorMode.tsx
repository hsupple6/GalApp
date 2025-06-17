import React, { useCallback, useState } from 'react';

import { MessageEntity } from 'types/chat';
import { EditProposal } from './EditProposal';

const MOCK_EDIT_PROPOSALS: Record<string, EditProposal> = {
  'mock-edit-1': {
    noteId: 'note-1',
    originalText: 'function calculateTotal(items) {\n  return items.reduce((sum, item) => sum + item.price, 0);\n}',
    proposedEdit: 'function calculateTotal(items) {\n  const total = items.reduce((sum, item) => sum + item.price, 0);\n  return Number(total.toFixed(2)); // Fix floating point precision\n}',
    startPosition: 0,
    endPosition: 82
  },
  'mock-edit-2': {
    noteId: 'note-2',
    originalText: 'console.log("Hello world");',
    proposedEdit: 'console.log("Hello world! 👋");',
    startPosition: 0,
    endPosition: 26
  }
};

interface UseEditorModeProps {
  onSendMessage: (message: string) => void;
  addMessage: (message: MessageEntity) => void;
}

export const useEditorMode = ({ onSendMessage, addMessage }: UseEditorModeProps) => {
  const [mockStreamingText, setMockStreamingText] = useState('');
  const [isStreamingMock, setIsStreamingMock] = useState(false);

  const simulateStreamingEdit = async (finalText: string) => {
    setIsStreamingMock(true);
    setMockStreamingText('');
    
    // Simulate streaming character by character
    for (let i = 0; i < finalText.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 50));
      setMockStreamingText(finalText.slice(0, i + 1));
    }
    
    setIsStreamingMock(false);
  };

  const handleEditorMessage = useCallback(async (text: string) => {
    const userMessageId = Date.now().toString();
    
    addMessage({
      id: userMessageId,
      user_id: 'user',
      skeleton: {
        '@type': 'Message',
        content: [{
          type: 'text',
          text: text
        }],
        sender: 'user',
        thread_id: 'thread-1',
        sourceEntities: []
      },
      entityType: 'Message',
      _id: userMessageId,
      name: 'User message',
      created_at: new Date().toISOString()
    });

    // Simulate AI thinking
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Add AI response with mock edit proposal
    const mockEditId = Object.keys(MOCK_EDIT_PROPOSALS)[
      Math.floor(Math.random() * Object.keys(MOCK_EDIT_PROPOSALS).length)
    ];
    const mockEdit = MOCK_EDIT_PROPOSALS[mockEditId];

    const aiMessageId = Date.now().toString();
    addMessage({
      id: aiMessageId,
      user_id: 'user',
      skeleton: {
        '@type': 'Message',
        content: [{
          type: 'text',
          text: "I suggest making the following edit:"
        }],
        sender: 'assistant',
        thread_id: 'thread-1',
        sourceEntities: []
      },
      entityType: 'Message',
      _id: aiMessageId,
      name: 'Assistant message',
      created_at: new Date().toISOString()
    });

    // Simulate streaming the edit
    await simulateStreamingEdit(mockEdit.proposedEdit);
  }, [isStreamingMock, mockStreamingText, addMessage]);

  return { handleEditorMessage };
}; 