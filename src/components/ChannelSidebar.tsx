import React, { useState } from 'react';

type Channel = {
  id: bigint;
  serverId: bigint;
  name: string;
  topic?: string;
};

type Thread = {
  id: bigint;
  channelId: bigint;
  name: string;
};

type Server = {
  id: bigint;
  name: string;
  inviteCode: string;
  ownerId: any;
};

type Props = {
  server: Server | null;
  channels: Channel[];
  threads: Thread[];
  selectedChannelId: bigint | null;
  selectedThreadId: bigint | null;
  onSelectChannel: (id: bigint) => void;
  onSelectThread: (id: bigint) => void;
  onCreateChannel: () => void;
  userName: string;
  isOnline: boolean;
  isOwner: boolean;
  onLeaveServer: () => void;
};

export default function ChannelSidebar({
  server,
  channels,
  threads,
  selectedChannelId,
  onSelectChannel,
  onSelectThread,
  onCreateChannel,
  userName,
  isOnline,
  isOwner,
  onLeaveServer,
}: Props) {
  const [showInvite, setShowInvite] = useState(false);

  if (!server) {
    return (
      <div className="channel-sidebar">
        <div className="channel-sidebar-header">
          <h2>Discord Clone</h2>
        </div>
        <div className="channel-sidebar-content">
          <p className="channel-empty-text">Select or create a server to get started</p>
        </div>
        <div className="user-panel">
          <div className="user-avatar-small" style={{ backgroundColor: '#5865F2' }}>
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="user-info">
            <span className="user-name-small">{userName}</span>
            <span className={`user-status ${isOnline ? 'online' : 'offline'}`}>
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Group threads by channel
  const threadsByChannel: Record<string, Thread[]> = {};
  for (const t of threads) {
    const key = t.channelId.toString();
    if (!threadsByChannel[key]) threadsByChannel[key] = [];
    threadsByChannel[key].push(t);
  }

  return (
    <div className="channel-sidebar">
      <div className="channel-sidebar-header" onClick={() => setShowInvite(!showInvite)}>
        <h2>{server.name}</h2>
        <span className="dropdown-arrow">{showInvite ? '\u25B2' : '\u25BC'}</span>
      </div>
      {showInvite && (
        <div className="invite-panel">
          <label>Invite Code</label>
          <div className="invite-code-row">
            <code>{server.inviteCode}</code>
            <button
              className="copy-btn"
              onClick={() => navigator.clipboard.writeText(server.inviteCode)}
            >
              Copy
            </button>
          </div>
          {!isOwner && (
            <button className="leave-btn" onClick={onLeaveServer}>
              Leave Server
            </button>
          )}
        </div>
      )}
      <div className="channel-sidebar-content">
        <div className="channel-category">
          <span className="category-label">TEXT CHANNELS</span>
          <button className="add-channel-btn" onClick={onCreateChannel} title="Create Channel">
            +
          </button>
        </div>
        {channels.map(ch => (
          <React.Fragment key={ch.id.toString()}>
            <div
              className={`channel-item ${selectedChannelId === ch.id ? 'selected' : ''}`}
              onClick={() => onSelectChannel(ch.id)}
            >
              <span className="channel-hash">#</span>
              <span className="channel-name">{ch.name}</span>
            </div>
            {threadsByChannel[ch.id.toString()]?.map(th => (
              <div
                key={th.id.toString()}
                className={`thread-item ${false ? 'selected' : ''}`}
                onClick={() => {
                  onSelectChannel(ch.id);
                  onSelectThread(th.id);
                }}
              >
                <span className="thread-icon">&#x21B3;</span>
                <span className="thread-name">{th.name}</span>
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>
      <div className="user-panel">
        <div className="user-avatar-small" style={{ backgroundColor: '#5865F2' }}>
          {userName.charAt(0).toUpperCase()}
        </div>
        <div className="user-info">
          <span className="user-name-small">{userName}</span>
          <span className={`user-status ${isOnline ? 'online' : 'offline'}`}>
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>
    </div>
  );
}
