// E2E Encryption using Web Crypto API
// Channel keys are derived deterministically from the server invite code + channel ID.
// Every member who knows the invite code can derive the same AES-256-GCM key.
// No key distribution needed — eliminates all race conditions.

function b64Encode(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function b64Decode(str: string): ArrayBuffer {
  const bin = atob(str);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

// ─── Deterministic Channel Key Derivation ───────────────────────────────────
// Derives a unique AES-256-GCM key from the server's invite code and channel ID.
// All members of the server know the invite code, so they all derive the same key.

export async function deriveChannelKey(
  inviteCode: string,
  channelId: bigint
): Promise<CryptoKey> {
  const material = new TextEncoder().encode(`e2e:${inviteCode}:${channelId}`);
  const hash = await crypto.subtle.digest('SHA-256', material);
  return crypto.subtle.importKey(
    'raw',
    hash,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
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
