import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  getOrCreateKeyPair,
  generateChannelKey,
  exportChannelKey,
  encryptChannelKeyForMember,
  decryptChannelKey,
  encryptMessage,
  decryptMessage,
  cacheChannelKey,
  getCachedChannelKey,
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
  const setPublicKeyReducer = useReducer(reducers.setPublicKey);
  const createServerReducer = useReducer(reducers.createServer);
  const joinServerReducer = useReducer(reducers.joinServer);
  const leaveServerReducer = useReducer(reducers.leaveServer);
  const createChannelReducer = useReducer(reducers.createChannel);
  const createThreadReducer = useReducer(reducers.createThread);
  const sendMessageReducer = useReducer(reducers.sendMessage);
  const storeChannelKeyReducer = useReducer(reducers.storeChannelKey);

  // Tables
  const [users] = useTable(tables.user);
  const [servers] = useTable(tables.server);
  const [serverMembers] = useTable(tables.serverMember);
  const [channels] = useTable(tables.channel);
  const [threads] = useTable(tables.thread);
  const [rawMessages] = useTable(tables.message);
  const [encryptedKeys] = useTable(tables.encryptedChannelKey);

  // UI state
  const [selectedServerId, setSelectedServerId] = useState<bigint | null>(null);
  const [selectedChannelId, setSelectedChannelId] = useState<bigint | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<bigint | null>(null);
  const [showCreateServer, setShowCreateServer] = useState(false);
  const [showJoinServer, setShowJoinServer] = useState(false);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showSetName, setShowSetName] = useState(false);

  // Encryption state — use a version counter to trigger re-renders when keys change
  const privateKeyRef = useRef<CryptoKey | null>(null);
  const channelKeysRef = useRef<Map<string, CryptoKey>>(new Map());
  const [keyVersion, setKeyVersion] = useState(0); // bumped when any channel key is added
  const [decryptedMessages, setDecryptedMessages] = useState<DecryptedMessage[]>([]);
  // Track which channels we've already initiated key generation for (prevents race)
  const keyGenInFlightRef = useRef<Set<string>>(new Set());

  // ─── Derived data ─────────────────────────────────────────────────────

  const currentUser = users.find(u => identity && u.identity.toHexString() === identity.toHexString());
  const userName = currentUser?.name || identity?.toHexString().substring(0, 8) || 'Unknown';

  const myServers = servers.filter(s =>
    serverMembers.some(
      m => m.serverId === s.id && identity && m.memberId.toHexString() === identity.toHexString()
    )
  );

  const selectedServer = selectedServerId ? servers.find(s => s.id === selectedServerId) : null;

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
          m => m.serverId === selectedServerId && m.memberId.toHexString() === u.identity.toHexString()
        )
      )
    : [];

  const isOwner =
    selectedServer && identity
      ? selectedServer.ownerId.toHexString() === identity.toHexString()
      : false;

  const hasChannelKey = selectedChannelId
    ? channelKeysRef.current.has(selectedChannelId.toString())
    : false;
  // eslint-disable-next-line no-unused-expressions
  keyVersion; // read so React tracks the dependency

  // ─── Encryption setup: load key pair ────────────────────────────────────

  const [publicKeyJwk, setPublicKeyJwk] = useState<string | null>(null);

  useEffect(() => {
    if (!connected || !identity) return;
    (async () => {
      const kp = await getOrCreateKeyPair();
      privateKeyRef.current = kp.privateKey;
      setPublicKeyJwk(kp.publicKeyJwk);
    })();
  }, [connected, identity]);

  // Upload public key once we have it AND the user row exists
  useEffect(() => {
    if (!publicKeyJwk || !currentUser) return;
    if (!currentUser.publicKey) {
      setPublicKeyReducer({ publicKey: publicKeyJwk });
    }
  }, [publicKeyJwk, currentUser]);

  // ─── Decrypt channel keys from encrypted_channel_key table ────────────

  useEffect(() => {
    if (!identity || !privateKeyRef.current || !publicKeyJwk) return;

    (async () => {
      let added = false;
      for (const eck of encryptedKeys) {
        if (eck.memberId.toHexString() !== identity.toHexString()) continue;
        const chId = eck.channelId.toString();
        if (channelKeysRef.current.has(chId)) continue;

        try {
          let key = await getCachedChannelKey(chId);
          if (!key) {
            key = await decryptChannelKey(eck.encryptedKey, privateKeyRef.current!);
            await cacheChannelKey(chId, key);
          }
          channelKeysRef.current.set(chId, key);
          added = true;
        } catch (e) {
          console.warn('Failed to decrypt channel key for channel', chId, e);
        }
      }
      if (added) {
        setKeyVersion(v => v + 1);
      }
    })();
  }, [encryptedKeys, identity, publicKeyJwk]);

  // ─── Decrypt messages ─────────────────────────────────────────────────

  useEffect(() => {
    if (!selectedChannelId) {
      setDecryptedMessages([]);
      return;
    }

    const channelMessages = rawMessages.filter(m => m.channelId === selectedChannelId);
    const channelKey = channelKeysRef.current.get(selectedChannelId.toString());

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
            // Decryption failed — different key or corrupt
            content = '';
          }
        }

        decrypted.push({
          id: msg.id,
          channelId: msg.channelId,
          threadId: msg.threadId,
          senderId: msg.senderId,
          senderName: sender?.name || msg.senderId.toHexString().substring(0, 8),
          senderColor: sender?.avatarColor || '#5865F2',
          content,
          sentAt: msg.sentAt.toDate(),
          encrypted,
        });
      }

      decrypted.sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime());
      setDecryptedMessages(decrypted);
    })();
  }, [rawMessages, selectedChannelId, users, keyVersion]);

  // ─── Key generation: only the server OWNER generates keys ─────────────
  //     This eliminates the race where two clients both generate different keys.

  const setupChannelEncryption = useCallback(
    async (channelId: bigint) => {
      const chId = channelId.toString();
      if (channelKeysRef.current.has(chId)) return;
      if (keyGenInFlightRef.current.has(chId)) return;
      keyGenInFlightRef.current.add(chId);

      try {
        const channelKey = await generateChannelKey();
        channelKeysRef.current.set(chId, channelKey);
        await cacheChannelKey(chId, channelKey);
        setKeyVersion(v => v + 1);

        const ch = channels.find(c => c.id === channelId);
        if (!ch) return;

        const members = serverMembers.filter(m => m.serverId === ch.serverId);
        const raw = await exportChannelKey(channelKey);

        for (const member of members) {
          const memberUser = users.find(
            u => u.identity.toHexString() === member.memberId.toHexString()
          );
          if (!memberUser?.publicKey) continue;

          try {
            const encrypted = await encryptChannelKeyForMember(raw, memberUser.publicKey);
            storeChannelKeyReducer({
              channelId,
              memberIdentityHex: member.memberId.toHexString(),
              encryptedKey: encrypted,
            });
          } catch (e) {
            console.warn('Failed to encrypt channel key for member', e);
          }
        }
      } finally {
        keyGenInFlightRef.current.delete(chId);
      }
    },
    [channels, serverMembers, users, storeChannelKeyReducer]
  );

  // Server owner: generate keys for channels that have no encrypted keys yet
  useEffect(() => {
    if (!identity || !connected) return;

    for (const ch of channels) {
      const srv = servers.find(s => s.id === ch.serverId);
      if (!srv) continue;
      // Only server owner generates keys — single source of truth
      if (srv.ownerId.toHexString() !== identity.toHexString()) continue;

      const chId = ch.id.toString();
      if (channelKeysRef.current.has(chId)) continue;

      const existingKeys = encryptedKeys.filter(ek => ek.channelId === ch.id);
      if (existingKeys.length > 0) continue; // keys already exist

      setupChannelEncryption(ch.id);
    }
  }, [channels, servers, encryptedKeys, identity, connected, setupChannelEncryption]);

  // ─── Auto-distribute keys to new members (anyone who has the key can distribute) ──

  useEffect(() => {
    if (!identity || !connected) return;

    (async () => {
      for (const [chIdStr, channelKey] of channelKeysRef.current.entries()) {
        const ch = channels.find(c => c.id.toString() === chIdStr);
        if (!ch) continue;

        const members = serverMembers.filter(m => m.serverId === ch.serverId);
        const existingKeys = encryptedKeys.filter(
          ek => ek.channelId.toString() === chIdStr
        );

        for (const member of members) {
          const hasKey = existingKeys.some(
            ek => ek.memberId.toHexString() === member.memberId.toHexString()
          );
          if (hasKey) continue;

          const memberUser = users.find(
            u => u.identity.toHexString() === member.memberId.toHexString()
          );
          if (!memberUser?.publicKey) continue;

          try {
            const raw = await exportChannelKey(channelKey);
            const encrypted = await encryptChannelKeyForMember(raw, memberUser.publicKey);
            storeChannelKeyReducer({
              channelId: ch.id,
              memberIdentityHex: member.memberId.toHexString(),
              encryptedKey: encrypted,
            });
          } catch (e) {
            console.warn('Failed to distribute key to member', e);
          }
        }
      }
    })();
  }, [serverMembers, users, encryptedKeys, channels, connected, identity, keyVersion]);

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

  const handleSelectServer = useCallback(
    (id: bigint | null) => {
      setSelectedServerId(id);
      setSelectedChannelId(null);
      setSelectedThreadId(null);
    },
    []
  );

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
      // Key generation happens automatically via the owner effect above
    },
    [selectedServerId, createChannelReducer]
  );

  const handleSendMessage = useCallback(
    async (text: string) => {
      if (!selectedChannelId) return;

      const channelKey = channelKeysRef.current.get(selectedChannelId.toString());
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

      const channelKey = channelKeysRef.current.get(selectedChannelId.toString());
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
            <h2>{selectedServer ? 'Select a channel' : 'Welcome to Discord Clone'}</h2>
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
