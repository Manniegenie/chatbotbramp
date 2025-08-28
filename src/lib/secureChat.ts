// src/lib/secureChat.ts
// Encrypts a chat payload for /chat/secure using RSA-OAEP(SHA-256) + AES-GCM.

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:4000';
const PEM = import.meta.env.VITE_RSA_PUBLIC_KEY_PEM as string | undefined;
const B64 = import.meta.env.VITE_RSA_PUBLIC_KEY_B64 as string | undefined;

function b64ToBytes(b64: string): Uint8Array {
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function pemToSpkiBytes(pem: string): Uint8Array {
  const clean = pem.replace(/-----(BEGIN|END)\s+PUBLIC KEY-----/g, '').replace(/\s+/g, '');
  return b64ToBytes(clean);
}

function flipIv(iv: Uint8Array): Uint8Array {
  const out = new Uint8Array(iv.length);
  for (let i = 0; i < iv.length; i++) out[i] = (~iv[i]) & 0xff;
  return out;
}

function bytesToB64(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes;
  let s = '';
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return btoa(s);
}

export function hasPublicKeyInEnv(): boolean {
  return Boolean(PEM || B64);
}

async function importRsaFromEnv(): Promise<CryptoKey> {
  if (!PEM && !B64) throw new Error('No VITE_RSA_PUBLIC_KEY_PEM or VITE_RSA_PUBLIC_KEY_B64 in env.');
  const spkiBytes = PEM ? pemToSpkiBytes(PEM) : (B64 ? b64ToBytes(B64) : new Uint8Array());
  return crypto.subtle.importKey(
    'spki',
    spkiBytes.buffer, // 👈 must be ArrayBuffer
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt']
  );
}

export async function sendSecure(message: string, history: any[], sessionId: string) {
  const rsa = await importRsaFromEnv();

  // 16B key (AES-128) + 12B IV
  const aesRaw = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Wrap AES key with RSA
  const wrapped = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, rsa, aesRaw.buffer);

  // Import AES key for encryption/decryption
  const aesKey = await crypto.subtle.importKey(
    'raw',
    aesRaw.buffer, // 👈 ArrayBuffer
    { name: 'AES-GCM', length: 128 },
    false,
    ['encrypt', 'decrypt']
  );

  // Encrypt payload
  const pt = new TextEncoder().encode(JSON.stringify({ message, history, sessionId }));
  const ctxt = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, pt);

  const payload = {
    encrypted_aes_key: bytesToB64(wrapped),
    encrypted_data: bytesToB64(ctxt),
    initial_vector: bytesToB64(iv),
    sessionId
  };

  const resp = await fetch(`${API_BASE}/chat/secure`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const encReplyB64 = await resp.text();
  if (!resp.ok) {
    if (resp.status === 421) {
      return sendSecure(message, history, sessionId); // retry once
    }
    throw new Error(`Secure chat failed: ${resp.status}`);
  }

  // decrypt response with flipped IV
  const flipped = flipIv(iv);
  const replyBytes = b64ToBytes(encReplyB64);
  const clear = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: flipped },
    aesKey,
    replyBytes.buffer // 👈 ArrayBuffer
  );

  return JSON.parse(new TextDecoder().decode(clear)); // { reply, timestamp }
}

export { API_BASE };
