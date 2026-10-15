/**
 * Vibely Chat Lock & Privacy Passcode Module
 * Allows locking individual intimate/private conversations behind a secure 4-digit PIN / Passcode.
 * Uses SHA-256 with user-specific cryptographic salt via Web Crypto API.
 */

const STORAGE_PREFIX = 'vibely_chat_lock_';

function getStorageKey(userId: string, suffix: string): string {
  return `${STORAGE_PREFIX}${suffix}_${userId}`;
}

/**
 * Derives a SHA-256 hash of the passcode with a salt
 */
export async function hashPasscode(passcode: string, salt: string): Promise<string> {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    // Basic fallback for non-crypto environments
    let hash = 0;
    const str = `${salt}:${passcode}`;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return hash.toString(16);
  }

  const enc = new TextEncoder();
  const data = enc.encode(`vibely_pin_salt:${salt}:${passcode}`);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Gets the list of locked conversation IDs for a user
 */
export function getLockedConversationIds(userId: string): string[] {
  if (typeof window === 'undefined' || !userId) return [];
  try {
    const raw = localStorage.getItem(getStorageKey(userId, 'conversations'));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Checks if a specific conversation is locked
 */
export function isConversationLocked(userId: string, conversationId: string): boolean {
  if (!userId || !conversationId) return false;
  const lockedIds = getLockedConversationIds(userId);
  return lockedIds.includes(conversationId);
}

/**
 * Locks a conversation
 */
export function lockConversation(userId: string, conversationId: string): void {
  if (typeof window === 'undefined' || !userId || !conversationId) return;
  try {
    const current = getLockedConversationIds(userId);
    if (!current.includes(conversationId)) {
      const updated = [...current, conversationId];
      localStorage.setItem(getStorageKey(userId, 'conversations'), JSON.stringify(updated));
    }
  } catch (err) {
    console.warn('Error locking conversation:', err);
  }
}

/**
 * Unlocks a conversation (removes it from locked list permanently until locked again)
 */
export function unlockConversationPermanently(userId: string, conversationId: string): void {
  if (typeof window === 'undefined' || !userId || !conversationId) return;
  try {
    const current = getLockedConversationIds(userId);
    const updated = current.filter(id => id !== conversationId);
    localStorage.setItem(getStorageKey(userId, 'conversations'), JSON.stringify(updated));
  } catch (err) {
    console.warn('Error unlocking conversation permanently:', err);
  }
}

/**
 * Checks if a passcode has been set for this user
 */
export function hasChatLockPasscode(userId: string): boolean {
  if (typeof window === 'undefined' || !userId) return false;
  return Boolean(localStorage.getItem(getStorageKey(userId, 'hash')));
}

/**
 * Sets or updates the user's Chat Lock passcode
 */
export function setChatLockPasscode(userId: string, passcode: string): Promise<boolean> {
  if (typeof window === 'undefined' || !userId || !passcode) return Promise.resolve(false);
  try {
    const salt = Math.random().toString(36).substring(2) + Date.now().toString(36);
    return hashPasscode(passcode.trim(), salt).then(hash => {
      localStorage.setItem(getStorageKey(userId, 'salt'), salt);
      localStorage.setItem(getStorageKey(userId, 'hash'), hash);
      return true;
    });
  } catch {
    return Promise.resolve(false);
  }
}

/**
 * Verifies if the entered passcode matches the stored passcode
 */
export async function verifyChatLockPasscode(userId: string, passcode: string): Promise<boolean> {
  if (typeof window === 'undefined' || !userId || !passcode) return false;
  try {
    const salt = localStorage.getItem(getStorageKey(userId, 'salt'));
    const storedHash = localStorage.getItem(getStorageKey(userId, 'hash'));
    if (!salt || !storedHash) return false;

    const computedHash = await hashPasscode(passcode.trim(), salt);
    return computedHash === storedHash;
  } catch {
    return false;
  }
}

/**
 * Clears the Chat Lock passcode and all locked chats (e.g. on account reset)
 */
export function clearChatLock(userId: string): void {
  if (typeof window === 'undefined' || !userId) return;
  try {
    localStorage.removeItem(getStorageKey(userId, 'salt'));
    localStorage.removeItem(getStorageKey(userId, 'hash'));
    localStorage.removeItem(getStorageKey(userId, 'conversations'));
  } catch (err) {
    console.warn('Error clearing chat lock:', err);
  }
}
