import React, { useState, useEffect, useRef } from 'react';

type DecryptedMessage = {
  id: bigint;
  senderId: any;
  senderName: string;
  senderColor: string;
  content: string;
  sentAt: Date;
  encrypted: boolean;
};

type Props = {
  threadName: string;
  messages: DecryptedMessage[];
  onSendMessage: (text: string) => void;
  onClose: () => void;
};

export default function ThreadPanel({ threadName, messages, onSendMessage, onClose }: Props) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    onSendMessage(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  return (
    <div className="thread-panel">
      <div className="thread-panel-header">
        <div className="thread-panel-title">
          <span className="thread-icon-header">&#x1F9F5;</span>
          <h3>{threadName}</h3>
        </div>
        <button className="thread-close-btn" onClick={onClose}>
          &times;
        </button>
      </div>
      <div className="thread-messages">
        {messages.map(msg => (
          <div key={msg.id.toString()} className="message-group compact">
            <div className="message-avatar small" style={{ backgroundColor: msg.senderColor }}>
              {msg.senderName.charAt(0).toUpperCase()}
            </div>
            <div className="message-content">
              <div className="message-header">
                <span className="message-author">{msg.senderName}</span>
                <span className="message-timestamp">
                  {msg.sentAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className={`message-text ${msg.encrypted ? 'encrypted' : ''}`}>
                {msg.encrypted ? 'Encrypted message' : msg.content}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="thread-input-container">
        <form onSubmit={handleSend} className="message-form">
          <div className="message-input-wrapper">
            <textarea
              className="message-input"
              placeholder={`Reply to thread...`}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
            />
            <button type="submit" className="send-btn" disabled={!input.trim()}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
