import React, { useState, useEffect, useRef, useCallback } from 'react';

type DecryptedMessage = {
  id: bigint;
  channelId: bigint;
  threadId: bigint;
  senderId: any;
  senderName: string;
  senderColor: string;
  content: string;
  sentAt: Date;
  encrypted: boolean; // true if we couldn't decrypt
};

type Props = {
  channelName: string;
  channelTopic?: string;
  messages: DecryptedMessage[];
  onSendMessage: (text: string) => void;
  onCreateThread: (messageId: bigint) => void;
  onOpenThread: (threadId: bigint) => void;
  threads: { id: bigint; parentMessageId: bigint; name: string }[];
  hasEncryptionKey: boolean;
};

export default function MessageArea({
  channelName,
  channelTopic,
  messages,
  onSendMessage,
  onCreateThread,
  onOpenThread,
  threads,
  hasEncryptionKey,
}: Props) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; msgId: bigint } | null>(null);

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

  const handleContextMenu = useCallback((e: React.MouseEvent, msgId: bigint) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, msgId });
  }, []);

  useEffect(() => {
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  // Group consecutive messages by same sender
  const grouped: DecryptedMessage[][] = [];
  for (const msg of messages) {
    const last = grouped[grouped.length - 1];
    if (
      last &&
      last[0].senderId.toHexString() === msg.senderId.toHexString() &&
      msg.sentAt.getTime() - last[last.length - 1].sentAt.getTime() < 5 * 60 * 1000
    ) {
      last.push(msg);
    } else {
      grouped.push([msg]);
    }
  }

  // Map message IDs to threads
  const threadByParent: Record<string, { id: bigint; name: string }> = {};
  for (const t of threads) {
    threadByParent[t.parentMessageId.toString()] = t;
  }

  return (
    <div className="message-area">
      <div className="message-area-header">
        <div className="channel-title">
          <span className="channel-hash-large">#</span>
          <span>{channelName}</span>
        </div>
        {channelTopic && <span className="channel-topic-text">{channelTopic}</span>}
        <div className="header-right">
          {hasEncryptionKey && (
            <span className="encryption-badge" title="End-to-end encrypted">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
              </svg>
              E2E
            </span>
          )}
        </div>
      </div>

      <div className="messages-container">
        <div className="channel-welcome">
          <div className="channel-welcome-icon">#</div>
          <h2>Welcome to #{channelName}!</h2>
          <p>This is the start of the #{channelName} channel.</p>
        </div>
        {grouped.map((group, gi) => (
          <div key={gi} className="message-group">
            <div className="message-avatar" style={{ backgroundColor: group[0].senderColor }}>
              {group[0].senderName.charAt(0).toUpperCase()}
            </div>
            <div className="message-content">
              <div className="message-header">
                <span className="message-author">{group[0].senderName}</span>
                <span className="message-timestamp">
                  {group[0].sentAt.toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric',
                    year:
                      group[0].sentAt.getFullYear() !== new Date().getFullYear()
                        ? 'numeric'
                        : undefined,
                  })}{' '}
                  at{' '}
                  {group[0].sentAt.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              {group.map(msg => (
                <div key={msg.id.toString()}>
                  <div
                    className={`message-text ${msg.encrypted ? 'encrypted' : ''}`}
                    onContextMenu={e => handleContextMenu(e, msg.id)}
                  >
                    {msg.encrypted ? (
                      <span className="encrypted-text">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: 4, verticalAlign: 'middle' }}>
                          <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
                        </svg>
                        Encrypted message
                      </span>
                    ) : (
                      msg.content
                    )}
                  </div>
                  {threadByParent[msg.id.toString()] && (
                    <button
                      className="thread-button"
                      onClick={() => onOpenThread(threadByParent[msg.id.toString()].id)}
                    >
                      <span className="thread-icon-small">&#x1F9F5;</span>
                      {threadByParent[msg.id.toString()].name}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {contextMenu && (
        <div
          className="context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button
            onClick={() => {
              const name = prompt('Thread name:');
              if (name) onCreateThread(contextMenu.msgId);
              setContextMenu(null);
            }}
          >
            Create Thread
          </button>
        </div>
      )}

      <div className="message-input-container">
        <form onSubmit={handleSend} className="message-form">
          <div className="message-input-wrapper">
            <textarea
              className="message-input"
              placeholder={`Message #${channelName}`}
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
