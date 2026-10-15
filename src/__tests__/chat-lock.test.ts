import { describe, it, expect, beforeEach } from 'vitest';
import {
  setChatLockPasscode,
  verifyChatLockPasscode,
  hasChatLockPasscode,
  lockConversation,
  unlockConversationPermanently,
  isConversationLocked,
  getLockedConversationIds,
  clearChatLock,
} from '@/lib/chat-lock';

describe('Chat Lock & Passcode Management', () => {
  const testUserId = 'user-lock-test-123';
  const testConvId = 'conv-private-456';

  beforeEach(() => {
    localStorage.clear();
  });

  it('initially reports no passcode set and empty locked conversations', () => {
    expect(hasChatLockPasscode(testUserId)).toBe(false);
    expect(getLockedConversationIds(testUserId)).toEqual([]);
    expect(isConversationLocked(testUserId, testConvId)).toBe(false);
  });

  it('sets and verifies a 4-digit passcode correctly', async () => {
    const success = await setChatLockPasscode(testUserId, '1234');
    expect(success).toBe(true);
    expect(hasChatLockPasscode(testUserId)).toBe(true);

    const isMatch = await verifyChatLockPasscode(testUserId, '1234');
    expect(isMatch).toBe(true);

    const isWrongMatch = await verifyChatLockPasscode(testUserId, '9999');
    expect(isWrongMatch).toBe(false);
  });

  it('locks and unlocks conversations', () => {
    lockConversation(testUserId, testConvId);
    expect(isConversationLocked(testUserId, testConvId)).toBe(true);
    expect(getLockedConversationIds(testUserId)).toContain(testConvId);

    // Locking again should not create duplicates
    lockConversation(testUserId, testConvId);
    expect(getLockedConversationIds(testUserId).length).toBe(1);

    // Unlock permanently
    unlockConversationPermanently(testUserId, testConvId);
    expect(isConversationLocked(testUserId, testConvId)).toBe(false);
    expect(getLockedConversationIds(testUserId)).toEqual([]);
  });

  it('clears all chat lock credentials and conversations on clearChatLock', async () => {
    await setChatLockPasscode(testUserId, '4321');
    lockConversation(testUserId, testConvId);

    expect(hasChatLockPasscode(testUserId)).toBe(true);
    expect(getLockedConversationIds(testUserId).length).toBe(1);

    clearChatLock(testUserId);

    expect(hasChatLockPasscode(testUserId)).toBe(false);
    expect(getLockedConversationIds(testUserId)).toEqual([]);
  });
});
