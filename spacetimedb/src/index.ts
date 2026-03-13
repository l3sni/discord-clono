import spacetimedb from './schema.ts';
export default spacetimedb;
import { t, SenderError } from 'spacetimedb/server';

// ─────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  '#5865F2', '#57F287', '#FEE75C', '#EB459E', '#ED4245',
  '#F47B67', '#F8A532', '#2D7D46', '#45DDC0', '#9B59B6',
];

function pickColor(seed: bigint): string {
  const idx = Number(seed % BigInt(AVATAR_COLORS.length));
  return AVATAR_COLORS[idx];
}

function generateInviteCode(id: bigint, timestamp: bigint): string {
  const combined = id * 2654435761n + timestamp;
  const abs = combined < 0n ? -combined : combined;
  return abs.toString(36).slice(-8).padStart(8, '0');
}

function assertMember(ctx: any, serverId: bigint): void {
  let found = false;
  for (const m of ctx.db.serverMember.memberIdIdx.filter(ctx.sender)) {
    if (m.serverId === serverId) {
      found = true;
      break;
    }
  }
  if (!found) throw new SenderError('Not a member of this server');
}

// ─────────────────────────────────────────────────────────────────────────────
// USER REDUCERS
// ─────────────────────────────────────────────────────────────────────────────

export const set_name = spacetimedb.reducer(
  { name: t.string() },
  (ctx, { name }) => {
    if (!name.trim()) throw new SenderError('Name must not be empty');
    const user = ctx.db.user.identity.find(ctx.sender);
    if (!user) throw new SenderError('Unknown user');
    ctx.db.user.identity.update({ ...user, name: name.trim() });
  }
);

export const set_public_key = spacetimedb.reducer(
  { publicKey: t.string() },
  (ctx, { publicKey }) => {
    if (!publicKey) throw new SenderError('Public key must not be empty');
    const user = ctx.db.user.identity.find(ctx.sender);
    if (!user) throw new SenderError('Unknown user');
    ctx.db.user.identity.update({ ...user, publicKey });
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// SERVER REDUCERS
// ─────────────────────────────────────────────────────────────────────────────

export const create_server = spacetimedb.reducer(
  { name: t.string() },
  (ctx, { name }) => {
    if (!name.trim()) throw new SenderError('Server name must not be empty');

    const row = ctx.db.server.insert({
      id: 0n,
      name: name.trim(),
      ownerId: ctx.sender,
      iconColor: pickColor(ctx.timestamp.microsSinceUnixEpoch),
      inviteCode: '',
      createdAt: ctx.timestamp,
    });

    const inviteCode = generateInviteCode(row.id, ctx.timestamp.microsSinceUnixEpoch);
    ctx.db.server.id.update({ ...row, inviteCode });

    ctx.db.serverMember.insert({
      id: 0n,
      serverId: row.id,
      memberId: ctx.sender,
      joinedAt: ctx.timestamp,
    });

    ctx.db.channel.insert({
      id: 0n,
      serverId: row.id,
      name: 'general',
      topic: 'General discussion',
      createdAt: ctx.timestamp,
    });
  }
);

export const join_server = spacetimedb.reducer(
  { inviteCode: t.string() },
  (ctx, { inviteCode }) => {
    if (!inviteCode.trim()) throw new SenderError('Invite code must not be empty');

    let targetServer = null;
    for (const s of ctx.db.server.inviteCodeIdx.filter(inviteCode.trim())) {
      targetServer = s;
      break;
    }
    if (!targetServer) throw new SenderError('Invalid invite code');

    for (const m of ctx.db.serverMember.serverIdIdx.filter(targetServer.id)) {
      if (m.memberId.toHexString() === ctx.sender.toHexString()) {
        throw new SenderError('Already a member of this server');
      }
    }

    ctx.db.serverMember.insert({
      id: 0n,
      serverId: targetServer.id,
      memberId: ctx.sender,
      joinedAt: ctx.timestamp,
    });
  }
);

export const leave_server = spacetimedb.reducer(
  { serverId: t.u64() },
  (ctx, { serverId }) => {
    const server = ctx.db.server.id.find(serverId);
    if (!server) throw new SenderError('Server not found');
    if (server.ownerId.toHexString() === ctx.sender.toHexString()) {
      throw new SenderError('Server owner cannot leave. Delete the server instead.');
    }

    for (const m of ctx.db.serverMember.serverIdIdx.filter(serverId)) {
      if (m.memberId.toHexString() === ctx.sender.toHexString()) {
        ctx.db.serverMember.id.delete(m.id);
        return;
      }
    }
    throw new SenderError('Not a member of this server');
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// CHANNEL REDUCERS
// ─────────────────────────────────────────────────────────────────────────────

export const create_channel = spacetimedb.reducer(
  { serverId: t.u64(), name: t.string(), topic: t.string() },
  (ctx, { serverId, name, topic }) => {
    if (!name.trim()) throw new SenderError('Channel name must not be empty');
    assertMember(ctx, serverId);

    ctx.db.channel.insert({
      id: 0n,
      serverId,
      name: name.trim().toLowerCase().replace(/\s+/g, '-'),
      topic: topic || undefined,
      createdAt: ctx.timestamp,
    });
  }
);

export const delete_channel = spacetimedb.reducer(
  { channelId: t.u64() },
  (ctx, { channelId }) => {
    const ch = ctx.db.channel.id.find(channelId);
    if (!ch) throw new SenderError('Channel not found');

    const server = ctx.db.server.id.find(ch.serverId);
    if (!server) throw new SenderError('Server not found');
    if (server.ownerId.toHexString() !== ctx.sender.toHexString()) {
      throw new SenderError('Only server owner can delete channels');
    }

    for (const msg of ctx.db.message.channelIdIdx.filter(channelId)) {
      ctx.db.message.id.delete(msg.id);
    }

    for (const th of ctx.db.thread.channelIdIdx.filter(channelId)) {
      ctx.db.thread.id.delete(th.id);
    }

    for (const eck of ctx.db.encryptedChannelKey.channelIdIdx.filter(channelId)) {
      ctx.db.encryptedChannelKey.id.delete(eck.id);
    }

    ctx.db.channel.id.delete(channelId);
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// THREAD REDUCERS
// ─────────────────────────────────────────────────────────────────────────────

export const create_thread = spacetimedb.reducer(
  { channelId: t.u64(), parentMessageId: t.u64(), name: t.string() },
  (ctx, { channelId, parentMessageId, name }) => {
    if (!name.trim()) throw new SenderError('Thread name must not be empty');

    const ch = ctx.db.channel.id.find(channelId);
    if (!ch) throw new SenderError('Channel not found');
    assertMember(ctx, ch.serverId);

    ctx.db.thread.insert({
      id: 0n,
      channelId,
      parentMessageId,
      name: name.trim(),
      creatorId: ctx.sender,
      createdAt: ctx.timestamp,
    });
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// MESSAGE REDUCERS
// ─────────────────────────────────────────────────────────────────────────────

export const send_message = spacetimedb.reducer(
  {
    channelId: t.u64(),
    threadId: t.u64(),
    content: t.string(),
    iv: t.string(),
  },
  (ctx, { channelId, threadId, content, iv }) => {
    if (!content) throw new SenderError('Message content must not be empty');

    const ch = ctx.db.channel.id.find(channelId);
    if (!ch) throw new SenderError('Channel not found');
    assertMember(ctx, ch.serverId);

    ctx.db.message.insert({
      id: 0n,
      channelId,
      threadId,
      senderId: ctx.sender,
      content,
      iv,
      sentAt: ctx.timestamp,
    });
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// E2E ENCRYPTION KEY DISTRIBUTION
// ─────────────────────────────────────────────────────────────────────────────

export const store_channel_key = spacetimedb.reducer(
  { channelId: t.u64(), memberIdentityHex: t.string(), encryptedKey: t.string() },
  (ctx, { channelId, memberIdentityHex, encryptedKey }) => {
    if (!encryptedKey) throw new SenderError('Encrypted key must not be empty');

    const ch = ctx.db.channel.id.find(channelId);
    if (!ch) throw new SenderError('Channel not found');
    assertMember(ctx, ch.serverId);

    // Check if key already exists for this member+channel, update if so
    for (const eck of ctx.db.encryptedChannelKey.channelIdIdx.filter(channelId)) {
      if (eck.memberId.toHexString() === memberIdentityHex) {
        ctx.db.encryptedChannelKey.id.update({ ...eck, encryptedKey });
        return;
      }
    }

    // Find the member's identity from server members
    let memberIdentity = null;
    for (const m of ctx.db.serverMember.serverIdIdx.filter(ch.serverId)) {
      if (m.memberId.toHexString() === memberIdentityHex) {
        memberIdentity = m.memberId;
        break;
      }
    }
    if (!memberIdentity) throw new SenderError('Member not found in server');

    ctx.db.encryptedChannelKey.insert({
      id: 0n,
      channelId,
      memberId: memberIdentity,
      encryptedKey,
    });
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// LIFECYCLE
// ─────────────────────────────────────────────────────────────────────────────

export const init = spacetimedb.init(_ctx => {});

export const onConnect = spacetimedb.clientConnected(ctx => {
  const user = ctx.db.user.identity.find(ctx.sender);
  if (user) {
    ctx.db.user.identity.update({ ...user, online: true });
  } else {
    ctx.db.user.insert({
      identity: ctx.sender,
      name: undefined,
      avatarColor: pickColor(ctx.timestamp.microsSinceUnixEpoch),
      online: true,
      publicKey: undefined,
    });
  }
});

export const onDisconnect = spacetimedb.clientDisconnected(ctx => {
  const user = ctx.db.user.identity.find(ctx.sender);
  if (user) {
    ctx.db.user.identity.update({ ...user, online: false });
  }
});
