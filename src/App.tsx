import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import './App.css';
import { tables, reducers } from './module_bindings';
import { useSpacetimeDB, useTable, useReducer } from 'spacetimedb/react';

import ServerSidebar from './components/ServerSidebar';
import ChannelSidebar from './components/ChannelSidebar';
import MessageArea from './components/MessageArea';
import ThreadPanel from './components/ThreadPanel';
import MemberList from './components/MemberList';
import {
  CreateServerModal,
  JoinServerModal,
  CreateChannelModal,
  SetNameModal,
} from './components/Modals';
import {
  deriveChannelKey,
  encryptMessage,
  decryptMessage,
} from './hooks/useEncryption';

// ─── Types ──────────────────────────────────────────────────────────────────

type DecryptedMessage = {
  id: bigint;
  channelId: bigint;
  threadId: bigint;
  senderId: any;
  senderName: string;
  senderColor: string;
  content: string;
  sentAt: Date;
  encrypted: boolean;
};

// ─── App ────────────────────────────────────────────────────────────────────

function App() {
  const { identity, isActive: connected } = useSpacetimeDB();

  // Reducers
  const setNameReducer = useReducer(reducers.setName);
  const createServerReducer = useReducer(reducers.createServer);
  const joinServerReducer = useReducer(reducers.joinServer);
  const leaveServerReducer = useReducer(reducers.leaveServer);
  const createChannelReducer = useReducer(reducers.createChannel);
  const createThreadReducer = useReducer(reducers.createThread);
  const sendMessageReducer = useReducer(reducers.sendMessage);

  // Tables
  const [users] = useTable(tables.user);
  const [servers] = useTable(tables.server);
  const [serverMembers] = useTable(tables.serverMember);
  const [channels] = useTable(tables.channel);
  const [threads] = useTable(tables.thread);
  const [rawMessages] = useTable(tables.message);

  // UI state
  const [selectedServerId, setSelectedServerId] = useState<bigint | null>(null);
  const [selectedChannelId, setSelectedChannelId] = useState<bigint | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<bigint | null>(null);
  const [showCreateServer, setShowCreateServer] = useState(false);
  const [showJoinServer, setShowJoinServer] = useState(false);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showSetName, setShowSetName] = useState(false);

  // Encryption — channel key derived from invite code + channel ID
  const channelKeyRef = useRef<CryptoKey | null>(null);
  const channelKeyIdRef = useRef<string>('');
  const [decryptedMessages, setDecryptedMessages] = useState<DecryptedMessage[]>([]);
  const [hasChannelKey, setHasChannelKey] = useState(false);

  // ─── Derived data ─────────────────────────────────────────────────────

  const currentUser = users.find(
    u => identity && u.identity.toHexString() === identity.toHexString()
  );
  const userName =
    currentUser?.name || identity?.toHexString().substring(0, 8) || 'Unknown';

  const myServers = servers.filter(s =>
    serverMembers.some(
      m =>
        m.serverId === s.id &&
        identity &&
        m.memberId.toHexString() === identity.toHexString()
    )
  );

  const selectedServer = selectedServerId
    ? servers.find(s => s.id === selectedServerId)
    : null;

  const serverChannels = selectedServerId
    ? channels.filter(c => c.serverId === selectedServerId)
    : [];

  const selectedChannel = selectedChannelId
    ? channels.find(c => c.id === selectedChannelId)
    : null;

  const channelThreads = selectedChannelId
    ? threads.filter(t => t.channelId === selectedChannelId)
    : [];

  const selectedThread = selectedThreadId
    ? threads.find(t => t.id === selectedThreadId)
    : null;

  const serverMemberUsers = selectedServerId
    ? users.filter(u =>
        serverMembers.some(
          m =>
            m.serverId === selectedServerId &&
            m.memberId.toHexString() === u.identity.toHexString()
        )
      )
    : [];

  const isOwner =
    selectedServer && identity
      ? selectedServer.ownerId.toHexString() === identity.toHexString()
      : false;

  // ─── Derive channel encryption key ────────────────────────────────────
  // Key = SHA-256(inviteCode + channelId). All members derive the same key.

  useEffect(() => {
    if (!selectedChannel || !selectedServer) {
      channelKeyRef.current = null;
      channelKeyIdRef.current = '';
      setHasChannelKey(false);
      return;
    }

    const keyId = `${selectedServer.inviteCode}:${selectedChannel.id}`;
    if (channelKeyIdRef.current === keyId) return; // already derived

    (async () => {
      const key = await deriveChannelKey(
        selectedServer.inviteCode,
        selectedChannel.id
      );
      channelKeyRef.current = key;
      channelKeyIdRef.current = keyId;
      setHasChannelKey(true);
    })();
  }, [selectedChannel, selectedServer]);

  // ─── Decrypt messages ─────────────────────────────────────────────────

  useEffect(() => {
    if (!selectedChannelId) {
      setDecryptedMessages([]);
      return;
    }

    const channelMessages = rawMessages.filter(
      m => m.channelId === selectedChannelId
    );
    const channelKey = channelKeyRef.current;

    (async () => {
      const decrypted: DecryptedMessage[] = [];
      for (const msg of channelMessages) {
        const sender = users.find(
          u => u.identity.toHexString() === msg.senderId.toHexString()
        );
        let content = '';
        let encrypted = true;

        // No IV means plaintext message
        if (!msg.iv || msg.iv === '') {
          content = msg.content;
          encrypted = false;
        } else if (channelKey) {
          try {
            content = await decryptMessage(msg.content, msg.iv, channelKey);
            encrypted = false;
          } catch {
            content = '';
          }
        }

        decrypted.push({
          id: msg.id,
          channelId: msg.channelId,
          threadId: msg.threadId,
          senderId: msg.senderId,
          senderName:
            sender?.name || msg.senderId.toHexString().substring(0, 8),
          senderColor: sender?.avatarColor || '#5865F2',
          content,
          sentAt: msg.sentAt.toDate(),
          encrypted,
        });
      }

      decrypted.sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime());
      setDecryptedMessages(decrypted);
    })();
  }, [rawMessages, selectedChannelId, users, hasChannelKey]);

  // ─── Auto-select first channel ────────────────────────────────────────

  useEffect(() => {
    if (selectedServerId && serverChannels.length > 0 && !selectedChannelId) {
      setSelectedChannelId(serverChannels[0].id);
    }
  }, [selectedServerId, serverChannels, selectedChannelId]);

  // ─── Prompt for name on first connect ─────────────────────────────────

  useEffect(() => {
    if (connected && currentUser && !currentUser.name) {
      setShowSetName(true);
    }
  }, [connected, currentUser]);

  // ─── Handlers ─────────────────────────────────────────────────────────

  const handleSelectServer = useCallback((id: bigint | null) => {
    setSelectedServerId(id);
    setSelectedChannelId(null);
    setSelectedThreadId(null);
  }, []);

  const handleSelectChannel = useCallback((id: bigint) => {
    setSelectedChannelId(id);
    setSelectedThreadId(null);
  }, []);

  const handleCreateServer = useCallback(
    async (name: string) => {
      setShowCreateServer(false);
      await createServerReducer({ name });
    },
    [createServerReducer]
  );

  const handleJoinServer = useCallback(
    async (code: string) => {
      setShowJoinServer(false);
      await joinServerReducer({ inviteCode: code });
    },
    [joinServerReducer]
  );

  const handleLeaveServer = useCallback(async () => {
    if (!selectedServerId) return;
    await leaveServerReducer({ serverId: selectedServerId });
    setSelectedServerId(null);
    setSelectedChannelId(null);
  }, [selectedServerId, leaveServerReducer]);

  const handleCreateChannel = useCallback(
    async (name: string, topic: string) => {
      if (!selectedServerId) return;
      setShowCreateChannel(false);
      await createChannelReducer({ serverId: selectedServerId, name, topic });
    },
    [selectedServerId, createChannelReducer]
  );

  const handleSendMessage = useCallback(
    async (text: string) => {
      if (!selectedChannelId) return;

      const channelKey = channelKeyRef.current;
      let content: string;
      let iv: string;

      if (channelKey) {
        const encrypted = await encryptMessage(text, channelKey);
        content = encrypted.content;
        iv = encrypted.iv;
      } else {
        content = text;
        iv = '';
      }

      sendMessageReducer({
        channelId: selectedChannelId,
        threadId: selectedThreadId || 0n,
        content,
        iv,
      });
    },
    [selectedChannelId, selectedThreadId, sendMessageReducer]
  );

  const handleSendThreadMessage = useCallback(
    async (text: string) => {
      if (!selectedChannelId || !selectedThreadId) return;

      const channelKey = channelKeyRef.current;
      let content: string;
      let iv: string;

      if (channelKey) {
        const encrypted = await encryptMessage(text, channelKey);
        content = encrypted.content;
        iv = encrypted.iv;
      } else {
        content = text;
        iv = '';
      }

      sendMessageReducer({
        channelId: selectedChannelId,
        threadId: selectedThreadId,
        content,
        iv,
      });
    },
    [selectedChannelId, selectedThreadId, sendMessageReducer]
  );

  const handleCreateThread = useCallback(
    async (messageId: bigint) => {
      if (!selectedChannelId) return;
      const name = prompt('Thread name:');
      if (!name?.trim()) return;
      await createThreadReducer({
        channelId: selectedChannelId,
        parentMessageId: messageId,
        name: name.trim(),
      });
    },
    [selectedChannelId, createThreadReducer]
  );

  // ─── Render ───────────────────────────────────────────────────────────

  if (!connected || !identity) {
    return (
      <div className="app loading">
        <div className="loading-spinner" />
        <h2>Connecting to server...</h2>
      </div>
    );
  }

  const channelMessages = decryptedMessages.filter(m => m.threadId === 0n);
  const threadMessages = selectedThreadId
    ? decryptedMessages.filter(m => m.threadId === selectedThreadId)
    : [];

  return (
    <div className="app">
      <ServerSidebar
        servers={myServers}
        selectedServerId={selectedServerId}
        onSelectServer={handleSelectServer}
        onCreateServer={() => setShowCreateServer(true)}
        onJoinServer={() => setShowJoinServer(true)}
      />
      <ChannelSidebar
        server={selectedServer || null}
        channels={serverChannels}
        threads={channelThreads}
        selectedChannelId={selectedChannelId}
        selectedThreadId={selectedThreadId}
        onSelectChannel={handleSelectChannel}
        onSelectThread={id => setSelectedThreadId(id)}
        onCreateChannel={() => setShowCreateChannel(true)}
        userName={userName}
        isOnline={true}
        isOwner={isOwner}
        onLeaveServer={handleLeaveServer}
      />
      {selectedChannel ? (
        <MessageArea
          channelName={selectedChannel.name}
          channelTopic={selectedChannel.topic}
          messages={channelMessages}
          onSendMessage={handleSendMessage}
          onCreateThread={handleCreateThread}
          onOpenThread={id => setSelectedThreadId(id)}
          threads={channelThreads}
          hasEncryptionKey={hasChannelKey}
        />
      ) : (
        <div className="message-area empty-state">
          <div className="empty-state-content">
            <h2>
              {selectedServer
                ? 'Select a channel'
                : 'Welcome to Discord Clone'}
            </h2>
            <p>
              {selectedServer
                ? 'Choose a channel from the sidebar to start chatting'
                : 'Select a server or create a new one to get started'}
            </p>
          </div>
        </div>
      )}
      {selectedThreadId && selectedThread ? (
        <ThreadPanel
          threadName={selectedThread.name}
          messages={threadMessages}
          onSendMessage={handleSendThreadMessage}
          onClose={() => setSelectedThreadId(null)}
        />
      ) : (
        selectedServer && <MemberList members={serverMemberUsers} />
      )}

      {showCreateServer && (
        <CreateServerModal
          onClose={() => setShowCreateServer(false)}
          onCreate={handleCreateServer}
        />
      )}
      {showJoinServer && (
        <JoinServerModal
          onClose={() => setShowJoinServer(false)}
          onJoin={handleJoinServer}
        />
      )}
      {showCreateChannel && (
        <CreateChannelModal
          onClose={() => setShowCreateChannel(false)}
          onCreate={handleCreateChannel}
        />
      )}
      {showSetName && (
        <SetNameModal
          currentName={userName}
          onClose={() => setShowSetName(false)}
          onSetName={name => setNameReducer({ name })}
        />
      )}
    </div>
  );
}

export default App;
