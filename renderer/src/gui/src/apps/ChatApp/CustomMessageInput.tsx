import { MessageInput, MessageInputProps } from "@chatscope/chat-ui-kit-react";
import React, { useRef, useState } from "react";
import "./CustomMessageInput.scss";

interface CustomMessageInputProps extends MessageInputProps {
  as?: string | typeof MessageInput;
  sendMessage?: (message: string) => void;
}

const CustomMessageInput = ({
  as: Component,
  sendMessage,
  ...rest
}: CustomMessageInputProps) => {
  const [messageInputValue, setMessageInputValue] = useState("");
  const inputRef = useRef(null);

  const handleSendClick = () => {
    if (messageInputValue.trim() !== "" && sendMessage) {
      sendMessage(messageInputValue);
      setMessageInputValue(""); // Clear the input after sending the message
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendClick();
    }
  };

  return (
    <div className='custom-message-input'>
      <div className='input-container'>
        <textarea
          ref={inputRef}
          className='message-textarea'
          value={messageInputValue}
          onChange={(e) => setMessageInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message Gal..."
          rows={1}
        />
        <button 
          className={`send-button ${messageInputValue.trim() ? 'active' : ''}`}
          onClick={handleSendClick}
          disabled={!messageInputValue.trim()}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
      <div className="input-footer">
        <span className="hint">Press Enter to send. Shift+Enter for new line.</span>
      </div>
    </div>
  );
};

export default CustomMessageInput;
