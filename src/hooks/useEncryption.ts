// E2E Encryption using Web Crypto API
// RSA-OAEP for key wrapping, AES-GCM for message encryption

const STORAGE_PRIVATE_KEY = 'discord-clono-private-key';
const STORAGE_PUBLIC_KEY = 'discord-clono-public-key';
const CHANNEL_KEYS_STORE = 'discord-clono-channel-keys';

function b64Encode(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function b64Decode(str: string): ArrayBuffer {
  const bin = atob(str);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

// ─── RSA Key Pair ───────────────────────────────────────────────────────────

export async function getOrCreateKeyPair(): Promise<{
  publicKeyJwk: string;
  privateKey: CryptoKey;
}> {
  const storedPriv = localStorage.getItem(STORAGE_PRIVATE_KEY);
  const storedPub = localStorage.getItem(STORAGE_PUBLIC_KEY);

  if (storedPriv && storedPub) {
    const privateKey = await crypto.subtle.importKey(
      'jwk',
      JSON.parse(storedPriv),
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      false,
      ['decrypt']
    );
    return { publicKeyJwk: storedPub, privateKey };
  }

  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['encrypt', 'decrypt']
  );

  const pubJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  const privJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);

  const pubStr = JSON.stringify(pubJwk);
  const privStr = JSON.stringify(privJwk);

  localStorage.setItem(STORAGE_PUBLIC_KEY, pubStr);
  localStorage.setItem(STORAGE_PRIVATE_KEY, privStr);

  // Re-import private key as non-extractable
  const privateKey = await crypto.subtle.importKey(
    'jwk',
    privJwk,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['decrypt']
  );

  return { publicKeyJwk: pubStr, privateKey };
}

// ─── AES Channel Key ────────────────────────────────────────────────────────

export async function generateChannelKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ]);
}

export async function exportChannelKey(key: CryptoKey): Promise<ArrayBuffer> {
  return crypto.subtle.exportKey('raw', key);
}

export async function importChannelKey(raw: ArrayBuffer): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ]);
}

// ─── RSA Encrypt/Decrypt Channel Key ────────────────────────────────────────

export async function encryptChannelKeyForMember(
  channelKeyRaw: ArrayBuffer,
  memberPublicKeyJwk: string
): Promise<string> {
  const pubKey = await crypto.subtle.importKey(
    'jwk',
    JSON.parse(memberPublicKeyJwk),
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt']
  );
  const encrypted = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, pubKey, channelKeyRaw);
  return b64Encode(encrypted);
}

export async function decryptChannelKey(
  encryptedKeyB64: string,
  privateKey: CryptoKey
): Promise<CryptoKey> {
  const encrypted = b64Decode(encryptedKeyB64);
  const raw = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, privateKey, encrypted);
  return importChannelKey(raw);
}

// ─── Message Encrypt/Decrypt ────────────────────────────────────────────────

export async function encryptMessage(
  plaintext: string,
  channelKey: CryptoKey
): Promise<{ content: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    channelKey,
    encoded
  );
  return {
    content: b64Encode(ciphertext),
    iv: b64Encode(iv.buffer),
  };
}

export async function decryptMessage(
  contentB64: string,
  ivB64: string,
  channelKey: CryptoKey
): Promise<string> {
  const ciphertext = b64Decode(contentB64);
  const iv = b64Decode(ivB64);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    channelKey,
    ciphertext
  );
  return new TextDecoder().decode(decrypted);
}

// ─── Local Channel Key Cache ────────────────────────────────────────────────

export function getCachedChannelKeys(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(CHANNEL_KEYS_STORE) || '{}');
  } catch {
    return {};
  }
}

export async function cacheChannelKey(channelId: string, key: CryptoKey): Promise<void> {
  const raw = await exportChannelKey(key);
  const cache = getCachedChannelKeys();
  cache[channelId] = b64Encode(raw);
  localStorage.setItem(CHANNEL_KEYS_STORE, JSON.stringify(cache));
}

export async function getCachedChannelKey(channelId: string): Promise<CryptoKey | null> {
  const cache = getCachedChannelKeys();
  const b64 = cache[channelId];
  if (!b64) return null;
  try {
    const raw = b64Decode(b64);
    return importChannelKey(raw);
  } catch {
    return null;
  }
}
