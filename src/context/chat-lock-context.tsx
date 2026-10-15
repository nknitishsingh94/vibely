'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './auth-context';
import {
  getLockedConversationIds,
  lockConversation,
  unlockConversationPermanently,
  hasChatLockPasscode,
  setChatLockPasscode,
  verifyChatLockPasscode,
} from '@/lib/chat-lock';
import { toast } from '@/components/ui/toast';

interface ChatLockContextType {
  lockedConversationIds: string[];
  isUnlocked: boolean;
  hasPasscode: boolean;
  unlockSession: (passcode: string) => Promise<{ success: boolean; error?: string }>;
  lockSession: () => void;
  createPasscode: (passcode: string) => Promise<boolean>;
  toggleLockChat: (conversationId: string) => Promise<boolean>;
  unlockChatPermanently: (conversationId: string) => void;
  isChatLocked: (conversationId: string) => boolean;
  isChatAccessible: (conversationId: string) => boolean;
  showUnlockModal: boolean;
  targetConversationId: string | null;
  openUnlockModal: (targetConvId?: string | null) => void;
  closeUnlockModal: () => void;
}

const ChatLockContext = createContext<ChatLockContextType>({
  lockedConversationIds: [],
  isUnlocked: false,
  hasPasscode: false,
  unlockSession: async () => ({ success: false, error: 'Not initialized' }),
  lockSession: () => {},
  createPasscode: async () => false,
  toggleLockChat: async () => false,
  unlockChatPermanently: () => {},
  isChatLocked: () => false,
  isChatAccessible: () => true,
  showUnlockModal: false,
  targetConversationId: null,
  openUnlockModal: () => {},
  closeUnlockModal: () => {},
});

export function ChatLockProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id || '';

  const [lockedConversationIds, setLockedConversationIds] = useState<string[]>([]);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [hasPasscode, setHasPasscode] = useState(false);

  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [targetConversationId, setTargetConversationId] = useState<string | null>(null);

  // Sync state whenever user changes or on mount
  const syncLockState = useCallback(() => {
    if (!userId) {
      setLockedConversationIds([]);
      setHasPasscode(false);
      setIsUnlocked(false);
      return;
    }
    const ids = getLockedConversationIds(userId);
    setLockedConversationIds(ids);
    setHasPasscode(hasChatLockPasscode(userId));
  }, [userId]);

  useEffect(() => {
    syncLockState();
  }, [syncLockState]);

  // Auto-lock when user leaves or switches window/tab
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        setIsUnlocked(false);
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const openUnlockModal = useCallback((targetConvId: string | null = null) => {
    setTargetConversationId(targetConvId);
    setShowUnlockModal(true);
  }, []);

  const closeUnlockModal = useCallback(() => {
    setShowUnlockModal(false);
    setTargetConversationId(null);
  }, []);

  const unlockSession = useCallback(
    async (passcode: string): Promise<{ success: boolean; error?: string }> => {
      if (!userId) return { success: false, error: 'User not signed in' };

      const isValid = await verifyChatLockPasscode(userId, passcode);
      if (isValid) {
        setIsUnlocked(true);
        setShowUnlockModal(false);
        return { success: true };
      } else {
        return { success: false, error: 'Incorrect passcode. Please try again.' };
      }
    },
    [userId]
  );

  const lockSession = useCallback(() => {
    setIsUnlocked(false);
    toast.info('Locked chats hidden');
  }, []);

  const createPasscode = useCallback(
    async (passcode: string): Promise<boolean> => {
      if (!userId) return false;
      const success = await setChatLockPasscode(userId, passcode);
      if (success) {
        setHasPasscode(true);
        setIsUnlocked(true);
        toast.success('Chat lock passcode set successfully!');
      }
      return success;
    },
    [userId]
  );

  const toggleLockChat = useCallback(
    async (conversationId: string): Promise<boolean> => {
      if (!userId || !conversationId) return false;

      const isLocked = lockedConversationIds.includes(conversationId);
      if (isLocked) {
        // Unlock permanently
        unlockConversationPermanently(userId, conversationId);
        syncLockState();
        toast.success('Chat unlocked and returned to regular chats');
        return false;
      } else {
        // Lock conversation
        if (!hasPasscode) {
          // Must set a passcode first
          openUnlockModal(conversationId);
          return false;
        }
        lockConversation(userId, conversationId);
        syncLockState();
        setIsUnlocked(true); // Keep unlocked for current view
        toast.success('Chat locked! It is now hidden behind your passcode.');
        return true;
      }
    },
    [userId, lockedConversationIds, hasPasscode, syncLockState, openUnlockModal]
  );

  const unlockChatPermanently = useCallback(
    (conversationId: string) => {
      if (!userId || !conversationId) return;
      unlockConversationPermanently(userId, conversationId);
      syncLockState();
      toast.success('Chat unlocked permanently');
    },
    [userId, syncLockState]
  );

  const isChatLocked = useCallback(
    (conversationId: string): boolean => {
      return lockedConversationIds.includes(conversationId);
    },
    [lockedConversationIds]
  );

  const isChatAccessible = useCallback(
    (conversationId: string): boolean => {
      if (!lockedConversationIds.includes(conversationId)) return true;
      return isUnlocked;
    },
    [lockedConversationIds, isUnlocked]
  );

  return (
    <ChatLockContext.Provider
      value={{
        lockedConversationIds,
        isUnlocked,
        hasPasscode,
        unlockSession,
        lockSession,
        createPasscode,
        toggleLockChat,
        unlockChatPermanently,
        isChatLocked,
        isChatAccessible,
        showUnlockModal,
        targetConversationId,
        openUnlockModal,
        closeUnlockModal,
      }}
    >
      {children}
    </ChatLockContext.Provider>
  );
}

export function useChatLock() {
  return useContext(ChatLockContext);
}
