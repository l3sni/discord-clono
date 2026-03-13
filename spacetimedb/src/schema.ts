import { schema, t, table } from 'spacetimedb/server';

// ─────────────────────────────────────────────────────────────────────────────
// TABLES
// ─────────────────────────────────────────────────────────────────────────────

export const user = table(
  { name: 'user', public: true },
  {
    identity: t.identity().primaryKey(),
    name: t.string().optional(),
    avatarColor: t.string(),
    online: t.bool(),
    publicKey: t.string().optional(),
  }
);

export const server = table(
  {
    name: 'server',
    public: true,
    indexes: [
      { accessor: 'inviteCodeIdx', name: 'server_invite_code', algorithm: 'btree' as const, columns: ['inviteCode'] },
    ],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    name: t.string(),
    ownerId: t.identity(),
    iconColor: t.string(),
    inviteCode: t.string(),
    createdAt: t.timestamp(),
  }
);

export const serverMember = table(
  {
    name: 'server_member',
    public: true,
    indexes: [
      { accessor: 'serverIdIdx', name: 'server_member_server_id', algorithm: 'btree' as const, columns: ['serverId'] },
      { accessor: 'memberIdIdx', name: 'server_member_member_id', algorithm: 'btree' as const, columns: ['memberId'] },
    ],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    serverId: t.u64(),
    memberId: t.identity(),
    joinedAt: t.timestamp(),
  }
);

export const channel = table(
  {
    name: 'channel',
    public: true,
    indexes: [
      { accessor: 'serverIdIdx', name: 'channel_server_id', algorithm: 'btree' as const, columns: ['serverId'] },
    ],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    serverId: t.u64(),
    name: t.string(),
    topic: t.string().optional(),
    createdAt: t.timestamp(),
  }
);

export const thread = table(
  {
    name: 'thread',
    public: true,
    indexes: [
      { accessor: 'channelIdIdx', name: 'thread_channel_id', algorithm: 'btree' as const, columns: ['channelId'] },
    ],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    channelId: t.u64(),
    parentMessageId: t.u64(),
    name: t.string(),
    creatorId: t.identity(),
    createdAt: t.timestamp(),
  }
);

export const message = table(
  {
    name: 'message',
    public: true,
    indexes: [
      { accessor: 'channelIdIdx', name: 'message_channel_id', algorithm: 'btree' as const, columns: ['channelId'] },
      { accessor: 'threadIdIdx', name: 'message_thread_id', algorithm: 'btree' as const, columns: ['threadId'] },
    ],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    channelId: t.u64(),
    threadId: t.u64(),
    senderId: t.identity(),
    content: t.string(),
    iv: t.string(),
    sentAt: t.timestamp(),
  }
);

export const encryptedChannelKey = table(
  {
    name: 'encrypted_channel_key',
    public: true,
    indexes: [
      { accessor: 'channelIdIdx', name: 'eck_channel_id', algorithm: 'btree' as const, columns: ['channelId'] },
      { accessor: 'memberIdIdx', name: 'eck_member_id', algorithm: 'btree' as const, columns: ['memberId'] },
    ],
  },
  {
    id: t.u64().primaryKey().autoInc(),
    channelId: t.u64(),
    memberId: t.identity(),
    encryptedKey: t.string(),
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMA EXPORT
// ─────────────────────────────────────────────────────────────────────────────

const spacetimedb = schema({
  user,
  server,
  serverMember,
  channel,
  thread,
  message,
  encryptedChannelKey,
});

export default spacetimedb;
