import { describe, it, expect } from 'vitest';
import { encryptMessage, decryptMessage } from '@/lib/e2ee';

describe('End-to-End Encryption (E2EE)', () => {
  const conversationId = 'c694a971-8095-4672-9db8-b1fc8938166c';
  const secretMessage = 'Hey sweetie, I love you so much! ❤️';

  it('encrypts plaintext into an unreadable ciphertext starting with e2ee:v1:', async () => {
    const encrypted = await encryptMessage(secretMessage, conversationId);
    expect(encrypted).not.toBe(secretMessage);
    expect(encrypted.startsWith('e2ee:v1:')).toBe(true);
    expect(encrypted).not.toContain('sweetie');
    expect(encrypted).not.toContain('love');
  });

  it('decrypts ciphertext back to the exact original plaintext', async () => {
    const encrypted = await encryptMessage(secretMessage, conversationId);
    const decrypted = await decryptMessage(encrypted, conversationId);
    expect(decrypted).toBe(secretMessage);
  });

  it('returns legacy plaintext unchanged without errors', async () => {
    const legacy = 'Old unencrypted message';
    const result = await decryptMessage(legacy, conversationId);
    expect(result).toBe(legacy);
  });

  it('generates different ciphertexts for the same plaintext due to random IVs', async () => {
    const enc1 = await encryptMessage('Hello', conversationId);
    const enc2 = await encryptMessage('Hello', conversationId);
    expect(enc1).not.toBe(enc2);

    expect(await decryptMessage(enc1, conversationId)).toBe('Hello');
    expect(await decryptMessage(enc2, conversationId)).toBe('Hello');
  });
});
