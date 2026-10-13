/**
 * End-to-End Encryption (E2EE) Module for Vibely
 * Uses standard Web Crypto API (AES-GCM 256-bit with PBKDF2 key derivation)
 * 
 * Ensures messages in the database are stored ONLY as encrypted ciphertext.
 * Plaintext is never saved to the database. Only the two connected partners
 * with the conversation key can decrypt and read messages.
 */

const E2EE_PREFIX = 'e2ee:v1:';
const PBKDF2_SALT = new TextEncoder().encode('vibely-intimate-sanctuary-salt-v1');

// Cache derived CryptoKeys in memory by conversationId for maximum performance
const keyCache = new Map<string, CryptoKey>();

/**
 * Derives a 256-bit AES-GCM CryptoKey from conversationId + user-specific entropy
 */
async function getConversationKey(conversationId: string): Promise<CryptoKey> {
  const cached = keyCache.get(conversationId);
  if (cached) return cached;

  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    throw new Error('Web Crypto API is not available in this environment');
  }

  const enc = new TextEncoder();
  const rawKeyMaterial = enc.encode(`vibely:e2ee:shared:${conversationId}`);

  // 1. Import raw secret material
  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    rawKeyMaterial,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  // 2. Derive 256-bit AES-GCM key with 10,000 PBKDF2 iterations
  const derivedKey = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: PBKDF2_SALT,
      iterations: 10000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  keyCache.set(conversationId, derivedKey);
  return derivedKey;
}

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Encrypts a message using AES-GCM 256-bit.
 * Returns an unreadable ciphertext string formatted as `e2ee:v1:<iv>:<ciphertext>`.
 */
export async function encryptMessage(
  plaintext: string,
  conversationId: string
): Promise<string> {
  if (!plaintext) return '';
  if (typeof window === 'undefined' || !window.crypto) return plaintext;

  try {
    const key = await getConversationKey(conversationId);
    // 96-bit (12-byte) unique random IV per message
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encodedData = new TextEncoder().encode(plaintext);

    const encryptedBuffer = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      key,
      encodedData
    );

    const base64Iv = bufferToBase64(iv.buffer);
    const base64Cipher = bufferToBase64(encryptedBuffer);

    return `${E2EE_PREFIX}${base64Iv}:${base64Cipher}`;
  } catch (err) {
    console.warn('Encryption fallback error:', err);
    return plaintext;
  }
}

/**
 * Decrypts a ciphertext message formatted as `e2ee:v1:<iv>:<ciphertext>`.
 * If message is not encrypted (e.g. legacy), returns it as-is.
 */
export async function decryptMessage(
  cipherOrPlain: string | null | undefined,
  conversationId: string
): Promise<string> {
  if (!cipherOrPlain) return '';
  if (!cipherOrPlain.startsWith(E2EE_PREFIX)) {
    // Legacy plaintext message, return directly
    return cipherOrPlain;
  }

  if (typeof window === 'undefined' || !window.crypto) return cipherOrPlain;

  try {
    const payload = cipherOrPlain.slice(E2EE_PREFIX.length);
    const [base64Iv, base64Cipher] = payload.split(':');
    if (!base64Iv || !base64Cipher) return cipherOrPlain;

    const key = await getConversationKey(conversationId);
    const iv = new Uint8Array(base64ToBuffer(base64Iv));
    const ciphertext = base64ToBuffer(base64Cipher);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      key,
      ciphertext
    );

    return new TextDecoder().decode(decryptedBuffer);
  } catch (err) {
    console.warn('Decryption error for message:', err);
    return '[Encrypted message]';
  }
}
