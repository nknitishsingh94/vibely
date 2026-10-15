'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from './auth-context';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/env';
import {
  ConversationWithDetails,
  MessageWithDetails,
  MessageType,
  UserPresence,
  MessageReaction,
  DeliveryStatus,
  Message,
  PartnerActivity,
  PartnerActivityType,
} from '@/types/database';
import { encryptMessage, decryptMessage } from '@/lib/e2ee';
import { playSecurityAlertSound } from '@/lib/ringtone';
import { showChatMessageNotification, playMessageNotificationSound } from '@/lib/device-notifications';

export type SecurityEventType = 'screenshot' | 'video_saved' | 'media_saved' | 'file_downloaded';

export interface SecurityEventAlert {
  id: string;
  type: SecurityEventType;
  userId: string;
  userName: string;
  filename?: string;
  conversationId: string;
  timestamp: number;
}

export interface ChatContextType {
  conversations: ConversationWithDetails[];
  activeConversationId: string | null;
  activeConversation: ConversationWithDetails | null;
  messages: MessageWithDetails[];
  isLoadingMessages: boolean;
  replyingTo: MessageWithDetails | null;
  searchQuery: string;
  isSearching: boolean;
  isMediaDrawerOpen: boolean;
  typingUsers: string[];
  friendPresence: UserPresence;
  isUserOnline: (userId?: string | null) => boolean;
  onlineUserIds: Set<string>;
  setActiveConversationId: (id: string | null) => void;
  setReplyingTo: (msg: MessageWithDetails | null) => void;
  setSearchQuery: (q: string) => void;
  setIsSearching: (val: boolean) => void;
  setIsMediaDrawerOpen: (val: boolean) => void;
  sendMessage: (payload: {
    messageType: MessageType;
    body?: string;
    file?: File;
    replyToId?: string;
    durationSeconds?: number;
  }) => Promise<{ error?: string }>;
  editMessage: (messageId: string, newBody: string) => Promise<{ error?: string }>;
  deleteMessage: (messageId: string, mode?: 'for_me' | 'for_everyone') => Promise<{ error?: string }>;
  deleteMessages: (messageIds: string[], mode?: 'for_me' | 'for_everyone') => Promise<{ error?: string }>;
  forwardMessages: (targetConversationId: string, messageIds: string[]) => Promise<{ success: boolean; error?: string }>;
  selectedMessageIds: string[];
  setSelectedMessageIds: React.Dispatch<React.SetStateAction<string[]>>;
  isSelectMode: boolean;
  toggleSelectMessage: (id: string) => void;
  clearSelectedMessages: () => void;
  selectAllMessages: () => void;
  toggleReaction: (messageId: string, emoji: string) => Promise<void>;
  broadcastTyping: (isTyping: boolean) => void;
  partnerActivity: PartnerActivity | null;
  broadcastActivity: (activity: PartnerActivityType) => void;
  markConversationAsRead: (conversationId: string) => Promise<void>;
  refreshConversations: () => Promise<void>;
  incomingRequests: ConnectionRequestItem[];
  refreshRequests: () => Promise<void>;
  respondToRequest: (
    requestId: string,
    action: 'accept' | 'decline'
  ) => Promise<{ success: boolean; conversationId?: string; error?: string; message?: string }>;
  connectWithPartner: (
    identifier: string
  ) => Promise<{ success: boolean; conversationId?: string; isRequestSent?: boolean; message?: string; error?: string }>;
  deleteFriend: (
    friendId: string,
    conversationId?: string
  ) => Promise<{ success: boolean; error?: string; message?: string }>;
  notifySecurityEvent: (type: SecurityEventType, filename?: string) => Promise<void>;
  securityAlert: SecurityEventAlert | null;
  dismissSecurityAlert: () => void;
  sessionSecurityAlerts: SecurityEventAlert[];
}

export interface ConnectionRequestItem {
  id: string;
  createdAt: string;
  sender: {
    id: string;
    display_name: string;
    username?: string;
    avatar_path?: string | null;
  };
}

function getStoredDeletedForMe(userId?: string | null): Set<string> {
  const ids = new Set<string>();
  if (typeof window === 'undefined') return ids;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('vibely_deleted_for_me')) {
        const item = localStorage.getItem(k);
        if (item) {
          const parsed = JSON.parse(item);
          if (Array.isArray(parsed)) {
            parsed.forEach(id => {
              if (typeof id === 'string') ids.add(id);
            });
          }
        }
      }
    }
  } catch (e) {
    console.error('Error reading deleted for me IDs:', e);
  }
  return ids;
}

function storeDeletedForMe(userId: string | undefined | null, messageIds: string[]) {
  if (typeof window === 'undefined' || messageIds.length === 0) return;
  try {
    if (userId) {
      const userKey = `vibely_deleted_for_me_${userId}`;
      const existing: string[] = JSON.parse(localStorage.getItem(userKey) || '[]');
      const merged = Array.from(new Set([...existing, ...messageIds]));
      localStorage.setItem(userKey, JSON.stringify(merged));
    }
    const globalKey = 'vibely_deleted_for_me';
    const existingGlobal: string[] = JSON.parse(localStorage.getItem(globalKey) || '[]');
    const mergedGlobal = Array.from(new Set([...existingGlobal, ...messageIds]));
    localStorage.setItem(globalKey, JSON.stringify(mergedGlobal));
  } catch (e) {
    console.error('Error storing deleted for me IDs:', e);
  }
}

const ChatContext = createContext<ChatContextType | null>(null);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { profile, isConfigured } = useAuth();
  const profileRef = useRef(profile);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageWithDetails[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [replyingTo, setReplyingTo] = useState<MessageWithDetails | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isMediaDrawerOpen, setIsMediaDrawerOpen] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<ConnectionRequestItem[]>([]);
  const [partnerActivity, setPartnerActivity] = useState<PartnerActivity | null>(null);
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);
  const [securityAlert, setSecurityAlert] = useState<SecurityEventAlert | null>(null);
  const [sessionSecurityAlerts, setSessionSecurityAlerts] = useState<SecurityEventAlert[]>([]);
  const lastSecurityEventRef = useRef<{ type: string; time: number; key?: string }>({ type: '', time: 0 });
  const isSelectMode = selectedMessageIds.length > 0;

  const toggleSelectMessage = useCallback((id: string) => {
    setSelectedMessageIds(prev =>
      prev.includes(id) ? prev.filter(mId => mId !== id) : [...prev, id]
    );
  }, []);

  const clearSelectedMessages = useCallback(() => {
    setSelectedMessageIds([]);
  }, []);

  const selectAllMessages = useCallback(() => {
    setSelectedMessageIds(messages.map(m => m.id));
  }, [messages]);

  const activityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const onlineUserIdsRef = useRef<Set<string>>(onlineUserIds);
  useEffect(() => {
    onlineUserIdsRef.current = onlineUserIds;
  }, [onlineUserIds]);

  const isUserOnline = useCallback(
    (userId?: string | null) => {
      if (!userId) return false;
      return onlineUserIds.has(userId);
    },
    [onlineUserIds]
  );

  const [friendPresence, setFriendPresence] = useState<UserPresence>({
    userId: '',
    online: false,
    lastSeen: new Date().toISOString(),
  });

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<any>(null);
  const activeConversationIdRef = useRef<string | null>(activeConversationId);

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  // Active conversation object
  const activeConversation = conversations.find(c => c.id === activeConversationId) || null;

  // Sync friend presence strictly from realtime presence (offline means offline!)
  useEffect(() => {
    if (activeConversation?.otherUser) {
      const partnerId = activeConversation.otherUser.id;
      const isOnline = onlineUserIds.has(partnerId);
      setFriendPresence({
        userId: partnerId,
        online: isOnline,
        lastSeen: activeConversation.otherUser.last_seen_at || new Date().toISOString(),
      });
      if (!isOnline) {
        setPartnerActivity(null);
      }
    } else {
      setFriendPresence({
        userId: '',
        online: false,
        lastSeen: new Date().toISOString(),
      });
      setPartnerActivity(null);
    }
  }, [activeConversation?.otherUser?.id, activeConversation?.otherUser?.last_seen_at, onlineUserIds]);

  // Load conversations
  const refreshConversations = useCallback(async () => {
    if (!profile) {
      setConversations([]);
      setActiveConversationId(null);
      return;
    }

    try {
      const supabase = getSupabaseBrowserClient();
      // Fetch conversations the user is a member of
      const { data: memberRows, error: memberErr } = await supabase
        .from('conversation_members')
        .select(`
          conversation_id,
          last_read_at,
          conversations (
            id,
            type,
            created_at,
            updated_at
          )
        `)
        .eq('user_id', profile.id);

      if (memberErr || !memberRows) {
        const errDetail = memberErr ? (memberErr.message || memberErr.code || JSON.stringify(memberErr)) : 'No data';
        console.warn('Unable to fetch member rows from database:', errDetail);
        setConversations([]);
        return;
      }

      const convList: ConversationWithDetails[] = [];

      for (const row of memberRows) {
        const conv = (row as any).conversations;
        if (!conv) continue;

        // Fetch all members of this conversation
        const { data: allMembers } = await supabase
          .from('conversation_members')
          .select(`
            conversation_id,
            user_id,
            joined_at,
            last_read_at,
            role,
            profiles (*)
          `)
          .eq('conversation_id', conv.id);

        const mappedMembers = (allMembers || []).map((m: any) => ({
          ...m,
          profile: m.profiles,
        }));

        const otherMember = mappedMembers.find((m: any) => m.user_id !== profile.id);

        // Fetch last message
        const { data: lastMsgData } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', conv.id)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        let lastMsg: (Message & { deliveryStatus?: DeliveryStatus }) | null = lastMsgData ? { ...lastMsgData } : null;
        if (lastMsg) {
          if (lastMsg.body) {
            try {
              lastMsg.body = await decryptMessage(lastMsg.body, conv.id);
            } catch {
              // fallback to raw body if decryption fails
            }
          }

          if (lastMsg.sender_id === profile.id) {
            const { data: receipts } = await supabase
              .from('message_receipts')
              .select('*')
              .eq('message_id', lastMsg.id);

            const readReceipt = receipts?.find((r: any) => r.read_at);
            const deliveredReceipt = receipts?.find((r: any) => r.delivered_at);
            if (readReceipt) {
              lastMsg.deliveryStatus = 'read';
            } else if (deliveredReceipt) {
              lastMsg.deliveryStatus = 'delivered';
            } else {
              lastMsg.deliveryStatus = 'sent';
            }
          }
        }

        // Count unread
        let unreadCount = 0;
        const isCurrentActive = conv.id === activeConversationIdRef.current;
        if (isCurrentActive) {
          // If user is currently looking at this conversation, unread count is always 0
          unreadCount = 0;
        } else {
          // Check local read cache as well as database last_read_at
          let localReadIso: string | null = null;
          try {
            if (typeof window !== 'undefined' && profile?.id) {
              localReadIso = localStorage.getItem(`vibely_last_read_${profile.id}_${conv.id}`);
            }
          } catch {}

          const effectiveLastRead = localReadIso && row.last_read_at
            ? (new Date(localReadIso).getTime() > new Date(row.last_read_at).getTime() ? localReadIso : row.last_read_at)
            : (localReadIso || row.last_read_at);

          if (effectiveLastRead) {
            const { count } = await supabase
              .from('messages')
              .select('*', { count: 'exact', head: true })
              .eq('conversation_id', conv.id)
              .gt('created_at', effectiveLastRead)
              .neq('sender_id', profile.id)
              .is('deleted_at', null);
            unreadCount = count || 0;
          } else {
            // Neither DB nor local storage has last_read_at
            if (lastMsg && lastMsg.sender_id === profile.id) {
              unreadCount = 0;
            } else if (lastMsg) {
              // Check if user has a read receipt in message_receipts
              const { data: userReceipt } = await supabase
                .from('message_receipts')
                .select('read_at')
                .eq('message_id', lastMsg.id)
                .eq('user_id', profile.id)
                .maybeSingle();

              if (userReceipt?.read_at) {
                unreadCount = 0;
                try {
                  localStorage.setItem(`vibely_last_read_${profile.id}_${conv.id}`, userReceipt.read_at);
                } catch {}
              } else {
                const { count } = await supabase
                  .from('messages')
                  .select('*', { count: 'exact', head: true })
                  .eq('conversation_id', conv.id)
                  .neq('sender_id', profile.id)
                  .is('deleted_at', null);
                unreadCount = count || 0;
              }
            } else {
              unreadCount = 0;
            }
          }
        }

        convList.push({
          id: conv.id,
          type: conv.type,
          created_at: conv.created_at,
          updated_at: conv.updated_at,
          members: mappedMembers,
          otherUser: otherMember?.profile,
          lastMessage: lastMsg,
          unreadCount,
        });
      }

      setConversations(convList);
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  }, [profile, isConfigured]);

  // Connect with a partner via Duo ID or username (sends connection request)
  const connectWithPartner = useCallback(
    async (identifier: string) => {
      try {
        const res = await fetch('/api/connect/request', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(profile?.id ? { 'x-user-id': profile.id } : {}),
          },
          body: JSON.stringify({
            identifier,
            senderId: profile?.id,
          }),
        });
        const data = await res.json();
        if (!res.ok || data.error) {
          return { success: false, error: data.error || 'Failed to connect' };
        }

        if (data.alreadyConnected && data.conversationId) {
          await refreshConversations();
          setActiveConversationId(data.conversationId);
          return { success: true, conversationId: data.conversationId, message: data.message };
        }

        if (data.autoAccepted && data.conversationId) {
          await refreshConversations();
          setActiveConversationId(data.conversationId);
          return { success: true, conversationId: data.conversationId, message: data.message };
        }

        return {
          success: true,
          isRequestSent: true,
          message: data.message || 'Connection request sent!',
        };
      } catch (err: any) {
        return { success: false, error: err?.message || 'Network error' };
      }
    },
    [profile?.id, refreshConversations]
  );

  // Fetch incoming connection requests (using userId param + header for 100% reliability)
  const refreshRequests = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const url = `/api/connect/requests?userId=${encodeURIComponent(profile.id)}`;
      const res = await fetch(url, {
        headers: { 'x-user-id': profile.id },
      });
      if (res.ok) {
        const data = await res.json();
        setIncomingRequests(data.incoming || []);
      }
    } catch (e) {
      console.error('Failed to fetch connection requests:', e);
    }
  }, [profile?.id]);

  // Respond to connection request (accept or decline)
  const respondToRequest = useCallback(
    async (requestId: string, action: 'accept' | 'decline') => {
      try {
        const res = await fetch('/api/connect/respond', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(profile?.id ? { 'x-user-id': profile.id } : {}),
          },
          body: JSON.stringify({
            requestId,
            action,
            userId: profile?.id,
          }),
        });
        const data = await res.json();
        if (!res.ok || data.error) {
          return { success: false, error: data.error || 'Failed to respond to request' };
        }

        // Remove from local list immediately
        setIncomingRequests(prev => prev.filter(r => r.id !== requestId));

        if (action === 'accept') {
          await refreshConversations();
          if (data.conversationId) {
            setActiveConversationId(data.conversationId);
          }
        }

        return {
          success: true,
          conversationId: data.conversationId,
          message: data.message,
        };
      } catch (err: any) {
        return { success: false, error: err?.message || 'Network error' };
      }
    },
    [profile?.id, refreshConversations]
  );

  // Delete / remove a friend and clean up direct conversation
  const deleteFriend = useCallback(
    async (friendId: string, conversationId?: string) => {
      try {
        const res = await fetch('/api/connect/remove-friend', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(profile?.id ? { 'x-user-id': profile.id } : {}),
          },
          body: JSON.stringify({
            friendId,
            conversationId,
            userId: profile?.id,
          }),
        });
        const data = await res.json();
        if (!res.ok || data.error) {
          return { success: false, error: data.error || 'Failed to remove friend' };
        }

        // Optimistically remove from conversations state
        setConversations(prev =>
          prev.filter(c => c.id !== conversationId && c.otherUser?.id !== friendId)
        );

        if (activeConversationId === conversationId) {
          setActiveConversationId(null);
        }

        await refreshConversations();
        await refreshRequests();

        return { success: true, message: data.message || 'Friend removed successfully' };
      } catch (err: any) {
        return { success: false, error: err?.message || 'Network error' };
      }
    },
    [profile?.id, activeConversationId, refreshConversations, refreshRequests]
  );

  // Real-time synchronization for connection requests and friends
  useEffect(() => {
    if (!profile?.id) return;

    // 1. Initial fetch
    refreshRequests();

    const supabase = getSupabaseBrowserClient();

    // 2. Real-time broadcast channel dedicated to this user
    const broadcastChannel = supabase.channel(`user-notifications:${profile.id}`);
    broadcastChannel
      .on('broadcast', { event: 'new-request' }, () => {
        refreshRequests();
      })
      .on('broadcast', { event: 'request-accepted' }, () => {
        refreshConversations();
        refreshRequests();
      })
      .on('broadcast', { event: 'request-declined' }, () => {
        refreshRequests();
      })
      .on('broadcast', { event: 'new_message' }, ({ payload }: any) => {
        if (!payload || payload.sender?.id === profile.id) return;
        refreshConversations();

        const isCurrentOpen = activeConversationIdRef.current === payload.conversationId;
        const isHidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';

        if (!isCurrentOpen || isHidden) {
          showChatMessageNotification({
            messageId: payload.messageId || payload.id,
            senderName: payload.sender?.display_name || 'Friend',
            messageText: payload.body,
            messageType: payload.messageType,
            conversationId: payload.conversationId,
            avatarUrl: payload.sender?.avatar_path,
          });
        } else {
          // In active open chat: play arrival chime immediately (respects mute & throttling)
          playMessageNotificationSound();
        }
      })
      .on('broadcast', { event: 'friend-removed' }, (payload: any) => {
        refreshConversations();
        refreshRequests();
        if (payload?.payload?.conversationId && payload.payload.conversationId === activeConversationId) {
          setActiveConversationId(null);
        }
      })
      .on('broadcast', { event: 'chat_security_alert' }, ({ payload }: any) => {
        if (payload && payload.userId !== profile?.id) {
          setSecurityAlert(payload);
          setSessionSecurityAlerts(prev => [...prev, payload]);
          playSecurityAlertSound();
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            try { navigator.vibrate([50, 70, 50]); } catch {}
          }
          // Trigger OS notification banner if page is in background or tab not focused
          if (typeof document !== 'undefined' && (document.hidden || !document.hasFocus())) {
            const userName = payload.userName || 'Partner';
            const isScreenshot = payload.type === 'screenshot';
            showChatMessageNotification({
              messageId: payload.id,
              senderName: isScreenshot ? '📸 Screenshot Alert' : '🚨 Security Alert',
              messageText: isScreenshot
                ? `${userName} took a screenshot of your chat!`
                : `${userName} performed a security action.`,
              conversationId: payload.conversationId,
            });
          }
          setTimeout(() => {
            setSecurityAlert(prev => (prev?.id === payload.id ? null : prev));
          }, 5500);
        }
      })
      .subscribe();

    // 3. Realtime postgres changes channel
    const dbChannel = supabase
      .channel('public:invitations')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'invitations' },
        () => {
          refreshRequests();
          refreshConversations();
        }
      )
      .subscribe();

    // 4. High-frequency polling (every 2.5 seconds) to guarantee real-time updates across browsers
    const pollInterval = setInterval(() => {
      refreshRequests();
    }, 2500);

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(broadcastChannel);
      supabase.removeChannel(dbChannel);
    };
  }, [profile?.id, refreshRequests, refreshConversations]);

  // Load messages for active conversation
  const loadMessages = useCallback(async (conversationId: string) => {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    setIsLoadingMessages(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender:profiles(*),
          receipts:message_receipts(*),
          reactions:message_reactions(*)
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) {
        const errDetail = error.message || error.code || JSON.stringify(error);
        console.warn('Unable to fetch messages from database:', errDetail);
        setMessages([]);
      } else if (data) {
        // Filter out messages deleted for me on this device (robust across devices and refreshes)
        const deletedForMe = getStoredDeletedForMe(profileRef.current?.id || profile?.id);
        const visibleData = data.filter((m: any) => !deletedForMe.has(m.id));

        const enriched: MessageWithDetails[] = await Promise.all(
          visibleData.map(async (msg: any) => {
            if (msg.deleted_at) {
              return {
                ...msg,
                body: null,
                signedMediaUrl: null,
                deliveryStatus: 'read',
              };
            }
            let signedMediaUrl = null;
            if (msg.storage_path) {
              const { data: signedData } = await supabase.storage
                .from('chat-media')
                .createSignedUrl(msg.storage_path, 3600);
              signedMediaUrl = signedData?.signedUrl ?? null;
            }

            // Calculate delivery status
            let status: MessageWithDetails['deliveryStatus'] = 'sent';
            const receipts = msg.receipts || [];
            if (receipts.some((r: any) => r.read_at)) {
              status = 'read';
            } else if (receipts.some((r: any) => r.delivered_at)) {
              status = 'delivered';
            }

            // Decrypt message body with E2EE
            const decryptedBody = await decryptMessage(msg.body, conversationId);

            return {
              ...msg,
              body: decryptedBody,
              deliveryStatus: status,
              signedMediaUrl,
            };
          })
        );
        setMessages(enriched);

        // Immediately reset unread count in conversations state for this conversation
        setConversations(prev =>
          prev.map(c => (c.id === conversationId ? { ...c, unreadCount: 0 } : c))
        );

        // Cache read state locally and call server endpoint
        const nowIso = new Date().toISOString();
        try {
          if (typeof window !== 'undefined' && profile?.id) {
            localStorage.setItem(`vibely_last_read_${profile.id}_${conversationId}`, nowIso);
          }
        } catch {}

        // Mark conversation read in database & notify partner for blue ticks
        if (profile?.id && conversationId) {
          fetch('/api/chat/mark-read', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-user-id': profile.id,
            },
            body: JSON.stringify({ conversationId, userId: profile.id }),
          }).catch(() => {});

          supabase
            .from('conversation_members')
            .update({ last_read_at: nowIso })
            .eq('conversation_id', conversationId)
            .eq('user_id', profile.id)
            .then(() => {});

          // Upsert message_receipts for partner messages
          const partnerMessages = data.filter((m: any) => m.sender_id !== profile.id);
          if (partnerMessages.length > 0) {
            const receiptRows = partnerMessages.map((m: any) => ({
              message_id: m.id,
              user_id: profile.id,
              delivered_at: nowIso,
              read_at: nowIso,
            }));
            supabase
              .from('message_receipts')
              .upsert(receiptRows, { onConflict: 'message_id,user_id' })
              .then(() => {});
          }

          if (channelRef.current) {
            channelRef.current.send({
              type: 'broadcast',
              event: 'read_receipt',
              payload: {
                conversationId,
                readByUserId: profile.id,
                readAt: nowIso,
              },
            });
          }
        }
      }
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      setIsLoadingMessages(false);
    }
  }, [isConfigured, profile?.id]);

  // Initialize conversations
  useEffect(() => {
    if (profile) {
      refreshConversations();
    }
  }, [profile, refreshConversations]);

  // When partner comes online, upgrade pending 'sent' messages to 'delivered'
  useEffect(() => {
    if (friendPresence.online && profile?.id) {
      setMessages(prev =>
        prev.map(m =>
          m.sender_id === profile.id && m.deliveryStatus === 'sent'
            ? { ...m, deliveryStatus: 'delivered' }
            : m
        )
      );
    }
  }, [friendPresence.online, profile?.id]);

  // Periodically update current user's last_seen_at in profiles table
  useEffect(() => {
    if (!profile?.id || !isConfigured) return;
    const supabase = getSupabaseBrowserClient();

    const updateHeartbeat = () => {
      supabase
        .from('profiles')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', profile.id)
        .then(() => {});
    };

    updateHeartbeat();
    const timer = setInterval(updateHeartbeat, 60000);
    window.addEventListener('focus', updateHeartbeat);

    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', updateHeartbeat);
    };
  }, [profile?.id, isConfigured]);

  // Auto-refresh when mobile tab resumes from background, screen unlocks, or reconnects
  useEffect(() => {
    if (!profile?.id || !isConfigured) return;

    const handleResume = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      refreshConversations();
      refreshRequests();
      if (activeConversationIdRef.current) {
        loadMessages(activeConversationIdRef.current);
      }
    };

    document.addEventListener('visibilitychange', handleResume);
    window.addEventListener('online', handleResume);
    window.addEventListener('focus', handleResume);

    return () => {
      document.removeEventListener('visibilitychange', handleResume);
      window.removeEventListener('online', handleResume);
      window.removeEventListener('focus', handleResume);
    };
  }, [profile?.id, isConfigured, refreshConversations, refreshRequests, loadMessages]);

  // Realtime subscription for incoming connections and messages across all conversations
  useEffect(() => {
    if (!isConfigured || !profile) return;

    const supabase = getSupabaseBrowserClient();
    const userChannel = supabase
      .channel(`user-sync:${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversation_members',
          filter: `user_id=eq.${profile.id}`,
        },
        () => {
          refreshConversations();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        async (payload: any) => {
          const newMsg = payload.new as any;
          const currentActive = activeConversationIdRef.current;
          // If this message belongs to the currently active conversation and is from partner,
          // update last_read_at in DB before refreshing conversations so unreadCount won't spike
          if (currentActive && newMsg?.conversation_id === currentActive && newMsg.sender_id !== profile.id) {
            await supabase
              .from('conversation_members')
              .update({ last_read_at: new Date().toISOString() })
              .eq('conversation_id', currentActive)
              .eq('user_id', profile.id);
          }
          refreshConversations();
        }
      )
      .subscribe();

    return () => {
      userChannel.unsubscribe();
    };
  }, [isConfigured, profile, refreshConversations]);

  // Global presence channel tracking all online users in the app
  useEffect(() => {
    if (!isConfigured || !profile?.id) return;

    const supabase = getSupabaseBrowserClient();
    const globalChannel = supabase.channel('global-presence', {
      config: {
        presence: {
          key: profile.id,
        },
      },
    });

    globalChannel
      .on('presence', { event: 'sync' }, () => {
        const state = globalChannel.presenceState();
        const activeIds = new Set<string>();
        Object.keys(state).forEach(key => {
          if (state[key] && (state[key] as any).length > 0) {
            activeIds.add(key);
          }
        });
        setOnlineUserIds(activeIds);
      })
      .on('presence', { event: 'join' }, ({ key }: { key: string }) => {
        setOnlineUserIds(prev => {
          const next = new Set(prev);
          next.add(key);
          return next;
        });
      })
      .on('presence', { event: 'leave' }, ({ key }: { key: string }) => {
        setOnlineUserIds(prev => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
        if (key === activeConversation?.otherUser?.id) {
          setPartnerActivity(null);
        }
      });

    globalChannel.subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        globalChannel.track({
          user_id: profile.id,
          online_at: new Date().toISOString(),
        });
      }
    });

    // Untrack presence immediately on unload, pagehide, or network disconnect
    const handleImmediateLeave = () => {
      try {
        globalChannel.untrack();
        supabase
          .from('profiles')
          .update({ last_seen_at: new Date().toISOString() })
          .eq('id', profile.id)
          .then(() => {});
      } catch {}
    };

    let visibilityTimer: NodeJS.Timeout | null = null;
    const handleVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        visibilityTimer = setTimeout(() => {
          try {
            globalChannel.untrack();
          } catch {}
        }, 4000);
      } else {
        if (visibilityTimer) {
          clearTimeout(visibilityTimer);
          visibilityTimer = null;
        }
        try {
          globalChannel.track({
            user_id: profile.id,
            online_at: new Date().toISOString(),
          });
        } catch {}
      }
    };

    window.addEventListener('beforeunload', handleImmediateLeave);
    window.addEventListener('pagehide', handleImmediateLeave);
    window.addEventListener('offline', handleImmediateLeave);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (visibilityTimer) clearTimeout(visibilityTimer);
      window.removeEventListener('beforeunload', handleImmediateLeave);
      window.removeEventListener('pagehide', handleImmediateLeave);
      window.removeEventListener('offline', handleImmediateLeave);
      document.removeEventListener('visibilitychange', handleVisibility);
      try {
        globalChannel.untrack();
        globalChannel.unsubscribe();
      } catch {}
    };
  }, [isConfigured, profile?.id, activeConversation?.otherUser?.id]);

  // Handle active conversation change
  useEffect(() => {
    setSelectedMessageIds([]);
    setSecurityAlert(null);
    setSessionSecurityAlerts([]);
    if (activeConversationId) {
      loadMessages(activeConversationId);
      markConversationAsRead(activeConversationId);
    } else {
      setMessages([]);
      setPartnerActivity(null);
    }
  }, [activeConversationId, loadMessages]);

  // Realtime subscription setup
  useEffect(() => {
    if (!isConfigured || !activeConversationId || !profile) return;

    const supabase = getSupabaseBrowserClient();
    const channelName = `conversation:${activeConversationId}`;

    const channel = supabase.channel(channelName, {
      config: {
        presence: {
          key: profile.id,
        },
      },
    });

    channelRef.current = channel;

    // Presence listeners
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const otherUserId = activeConversation?.otherUser?.id;
        if (otherUserId) {
          const isInChannel = Boolean(state[otherUserId] && (state[otherUserId] as any).length > 0);
          const isPresent = isInChannel || onlineUserIdsRef.current.has(otherUserId);
          setFriendPresence(prev => ({
            userId: otherUserId,
            online: isPresent,
            lastSeen: isPresent ? new Date().toISOString() : (activeConversation?.otherUser?.last_seen_at || prev.lastSeen),
          }));
          if (!isPresent) {
            setPartnerActivity(null);
          }
        }
      })
      .on('presence', { event: 'join' }, ({ key }: { key: string }) => {
        if (key === activeConversation?.otherUser?.id) {
          setFriendPresence(prev => ({
            ...prev,
            online: true,
            lastSeen: new Date().toISOString(),
          }));
        }
      })
      .on('presence', { event: 'leave' }, ({ key }: { key: string }) => {
        if (key === activeConversation?.otherUser?.id) {
          setFriendPresence(prev => ({
            ...prev,
            online: false,
            lastSeen: new Date().toISOString(),
          }));
          setPartnerActivity(null);
        }
      });

    // Broadcast listener for instant message deletion by partner
    channel.on('broadcast', { event: 'message_deleted' }, ({ payload }: { payload: any }) => {
      if (payload?.messageId) {
        const deletedForMe = getStoredDeletedForMe(profileRef.current?.id || profile?.id);
        if (deletedForMe.has(payload.messageId)) {
          setMessages(prev => prev.filter(m => m.id !== payload.messageId));
          return;
        }
        setMessages(prev =>
          prev.map(m =>
            m.id === payload.messageId
              ? {
                  ...m,
                  deleted_at: payload.deletedAt || new Date().toISOString(),
                  body: null,
                  storage_path: null,
                  signedMediaUrl: null,
                }
              : m
          )
        );
      }
    });

    // Broadcast listener for multiple messages deletion by partner
    channel.on('broadcast', { event: 'messages_deleted' }, ({ payload }: { payload: any }) => {
      if (Array.isArray(payload?.messageIds) && payload.messageIds.length > 0) {
        const deletedForMe = getStoredDeletedForMe(profileRef.current?.id || profile?.id);
        const deletedIds = new Set(payload.messageIds);
        setMessages(prev =>
          prev
            .filter(m => !deletedForMe.has(m.id))
            .map(m =>
              deletedIds.has(m.id)
                ? {
                    ...m,
                    deleted_at: payload.deletedAt || new Date().toISOString(),
                    body: null,
                    storage_path: null,
                    signedMediaUrl: null,
                  }
                : m
            )
        );
      }
    });

    // Realtime Snapchat-Style Partner Activity Listener
    channel.on('broadcast', { event: 'partner_activity' }, ({ payload }: { payload: any }) => {
      if (payload.userId !== profile.id && payload.conversationId === activeConversationId) {
        setPartnerActivity({
          userId: payload.userId,
          displayName: payload.displayName,
          activity: payload.activity,
          conversationId: payload.conversationId,
          timestamp: payload.timestamp || Date.now(),
        });

        if (activityTimeoutRef.current) clearTimeout(activityTimeoutRef.current);

        // If typing, auto-revert to 'in_chat' after 3.5 seconds
        if (payload.activity === 'typing') {
          activityTimeoutRef.current = setTimeout(() => {
            setPartnerActivity(prev => (prev?.activity === 'typing' ? { ...prev, activity: 'in_chat' } : prev));
          }, 3500);
        }
      }
    });

    // Realtime Read Receipt Broadcast Listener (Instant WhatsApp Blue Ticks!)
    channel.on('broadcast', { event: 'read_receipt' }, ({ payload }: { payload: any }) => {
      if (payload.readByUserId !== profile.id) {
        setMessages(prev =>
          prev.map(m =>
            m.sender_id === profile.id && (!payload.messageId || m.id === payload.messageId || m.created_at <= payload.readAt)
              ? { ...m, deliveryStatus: 'read' }
              : m
          )
        );
        setConversations(prev =>
          prev.map(c =>
            c.id === activeConversationId && c.lastMessage?.sender_id === profile.id
              ? {
                  ...c,
                  lastMessage: {
                    ...c.lastMessage,
                    deliveryStatus: 'read',
                  },
                }
              : c
          )
        );
      }
    });

    // Realtime Snapchat-Style Security Event Listener (Screenshots & Media Saves)
    channel.on('broadcast', { event: 'chat_security_alert' }, ({ payload }: { payload: any }) => {
      if (payload && payload.conversationId === activeConversationId && payload.userId !== profile?.id) {
        setSecurityAlert(payload);
        setSessionSecurityAlerts(prev => [...prev, payload]);
        playSecurityAlertSound();
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try { navigator.vibrate([50, 70, 50]); } catch {}
        }
        if (typeof document !== 'undefined' && (document.hidden || !document.hasFocus())) {
          const userName = payload.userName || 'Partner';
          const isScreenshot = payload.type === 'screenshot';
          showChatMessageNotification({
            messageId: payload.id,
            senderName: isScreenshot ? '📸 Screenshot Alert' : '🚨 Security Alert',
            messageText: isScreenshot
              ? `${userName} took a screenshot of your chat!`
              : `${userName} performed a security action.`,
            conversationId: payload.conversationId,
          });
        }
        setTimeout(() => {
          setSecurityAlert(prev => (prev?.id === payload.id ? null : prev));
        }, 5500);
      }
    });

    // Broadcast typing indicator
    channel.on('broadcast', { event: 'typing' }, ({ payload }: { payload: any }) => {
      if (payload.userId !== profile.id) {
        if (payload.isTyping) {
          setTypingUsers(prev => Array.from(new Set([...prev, payload.displayName])));
        } else {
          setTypingUsers(prev => prev.filter(name => name !== payload.displayName));
        }
      }
    });

    // Listen to database message inserts
    channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${activeConversationId}`,
        },
        async (payload: any) => {
          const newMsg = payload.new as any;
          if (newMsg.deleted_at) return;
          const deletedForMe = getStoredDeletedForMe(profileRef.current?.id || profile?.id);
          if (deletedForMe.has(newMsg.id)) return;

          // Fetch sender profile
          const { data: senderProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', newMsg.sender_id)
            .single();

          let signedUrl = null;
          if (newMsg.storage_path) {
            const { data: signedData } = await supabase.storage
              .from('chat-media')
              .createSignedUrl(newMsg.storage_path, 3600);
            signedUrl = signedData?.signedUrl ?? null;
          }

          // Decrypt body with E2EE
          const decryptedBody = await decryptMessage(newMsg.body, activeConversationId);

          const completeMessage: MessageWithDetails = {
            ...newMsg,
            body: decryptedBody,
            sender: senderProfile,
            reactions: [],
            receipts: [],
            deliveryStatus: 'delivered',
            signedMediaUrl: signedUrl,
          };

          setMessages(prev => {
            // Deduplicate if already present (e.g. optimistic)
            const exists = prev.some(m => m.id === newMsg.id);
            if (exists) {
              return prev.map(m => (m.id === newMsg.id ? completeMessage : m));
            }
            return [...prev, completeMessage];
          });

          // If incoming message from other user, record receipt
          if (newMsg.sender_id !== profile.id) {
            // Receipt upsert (broadcast already handles real-time alert without double-trigger)
            const nowIso = new Date().toISOString();
            await supabase.from('message_receipts').upsert(
              {
                message_id: newMsg.id,
                user_id: profile.id,
                delivered_at: nowIso,
                read_at: nowIso,
              },
              { onConflict: 'message_id,user_id' }
            );

            // Also update last_read_at in conversation_members so DB stays in sync
            await supabase
              .from('conversation_members')
              .update({ last_read_at: nowIso })
              .eq('conversation_id', activeConversationId)
              .eq('user_id', profile.id);

            // Keep local unread count at 0 for active conversation
            setConversations(prev =>
              prev.map(c =>
                c.id === activeConversationId
                  ? {
                      ...c,
                      unreadCount: 0,
                      lastMessage: {
                        ...completeMessage,
                        deliveryStatus: 'read',
                      },
                      updated_at: newMsg.created_at,
                    }
                  : c
              )
            );

            // Broadcast read receipt so sender's double tick turns blue immediately
            channel.send({
              type: 'broadcast',
              event: 'read_receipt',
              payload: {
                conversationId: activeConversationId,
                readByUserId: profile.id,
                messageId: newMsg.id,
                readAt: nowIso,
              },
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${activeConversationId}`,
        },
        (payload: any) => {
          const updated = payload.new as any;
          const deletedForMe = getStoredDeletedForMe(profileRef.current?.id || profile?.id);

          if (deletedForMe.has(updated.id)) {
            setMessages(prev => prev.filter(m => m.id !== updated.id));
            return;
          }

          if (updated.deleted_at) {
            // Keep message in place with deleted_at set so UI renders deleted placeholder
            setMessages(prev =>
              prev.map(m =>
                m.id === updated.id
                  ? {
                      ...m,
                      deleted_at: updated.deleted_at,
                      body: null,
                      storage_path: null,
                      signedMediaUrl: null,
                    }
                  : m
              )
            );
          } else {
            setMessages(prev =>
              prev.map(m =>
                m.id === updated.id
                  ? { ...m, ...updated, body: updated.body, edited_at: updated.edited_at }
                  : m
              )
            );
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_reactions',
        },
        () => {
          // Refresh reactions
          if (activeConversationId) {
            loadMessages(activeConversationId);
          }
        }
      );

    channel.subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        channel.track({
          online_at: new Date().toISOString(),
          user_id: profile.id,
        });
        if (channelRef.current && activeConversationIdRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'partner_activity',
            payload: {
              userId: profile.id,
              displayName: profile.display_name,
              activity: 'in_chat',
              conversationId: activeConversationIdRef.current,
              timestamp: Date.now(),
            },
          });
        }
      }
    });

    return () => {
      if (channelRef.current && activeConversationIdRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'partner_activity',
          payload: {
            userId: profile.id,
            displayName: profile.display_name,
            activity: 'idle',
            conversationId: activeConversationIdRef.current,
            timestamp: Date.now(),
          },
        });
      }
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [isConfigured, activeConversationId, profile, activeConversation?.otherUser?.id, loadMessages]);

  // Broadcast partner activity (Snapchat-style)
  const broadcastActivity = useCallback(
    (activity: PartnerActivityType) => {
      if (!profile || !isConfigured || !channelRef.current || !activeConversationIdRef.current) return;

      channelRef.current.send({
        type: 'broadcast',
        event: 'partner_activity',
        payload: {
          userId: profile.id,
          displayName: profile.display_name,
          activity,
          conversationId: activeConversationIdRef.current,
          timestamp: Date.now(),
        },
      });
    },
    [profile, isConfigured]
  );

  // Broadcast typing
  const broadcastTyping = useCallback(
    (isTyping: boolean) => {
      if (!profile || !isConfigured) return;

      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'typing',
          payload: {
            userId: profile.id,
            displayName: profile.display_name,
            isTyping,
          },
        });
      }
      broadcastActivity(isTyping ? 'typing' : 'in_chat');
    },
    [profile, isConfigured, broadcastActivity]
  );

  // Send message
  const sendMessage = async (payload: {
    messageType: MessageType;
    body?: string;
    file?: File;
    replyToId?: string;
    durationSeconds?: number;
  }): Promise<{ error?: string }> => {
    if (!profile || !activeConversationId) {
      return { error: 'No active conversation' };
    }

    const optimisticId = `temp_${Date.now()}`;
    let localPreviewUrl: string | null = null;

    if (payload.file) {
      localPreviewUrl = URL.createObjectURL(payload.file);
    }

    const replyContext = payload.replyToId
      ? messages.find(m => m.id === payload.replyToId)
      : null;

    const optimisticMessage: MessageWithDetails = {
      id: optimisticId,
      conversation_id: activeConversationId,
      sender_id: profile.id,
      sender: profile,
      message_type: payload.messageType,
      body: payload.body || null,
      storage_path: null,
      original_filename: payload.file?.name || null,
      mime_type: payload.file?.type || null,
      file_size: payload.file?.size || null,
      duration_seconds: payload.durationSeconds || null,
      reply_to_message_id: payload.replyToId || null,
      reply_to: replyContext
        ? {
            id: replyContext.id,
            sender_name: replyContext.sender?.display_name || 'Friend',
            message_type: replyContext.message_type,
            body: replyContext.body,
            original_filename: replyContext.original_filename,
          }
        : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      edited_at: null,
      deleted_at: null,
      deliveryStatus: 'sending',
      signedMediaUrl: localPreviewUrl,
      isOptimistic: true,
      reactions: [],
      receipts: [],
    };

    // Add optimistic message immediately
    setMessages(prev => [...prev, optimisticMessage]);
    setReplyingTo(null);

    // Optimistically update conversation's last message in sidebar
    setConversations(prev =>
      prev.map(c =>
        c.id === activeConversationId
          ? {
              ...c,
              lastMessage: {
                ...optimisticMessage,
                deliveryStatus: 'sending',
              },
              updated_at: optimisticMessage.created_at,
            }
          : c
      )
    );

    if (!activeConversationId) {
      return { error: 'No conversation selected' };
    }

    try {
      const supabase = getSupabaseBrowserClient();
      let storagePath: string | null = null;

      // Upload file to private storage if present
      if (payload.file) {
        const fileExt = (payload.file.name.split('.').pop() || 'bin').replace(/[^a-zA-Z0-9]/g, '');
        const safeName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${fileExt}`;
        const filePath = `${activeConversationId}/${safeName}`;
        const contentType = payload.file.type && payload.file.type.trim() !== '' ? payload.file.type : 'application/octet-stream';

        let uploadSuccess = false;

        // 1. First attempt: Direct client-side storage upload
        try {
          const { error: uploadErr } = await supabase.storage
            .from('chat-media')
            .upload(filePath, payload.file, {
              contentType,
              upsert: false,
            });

          if (!uploadErr) {
            storagePath = filePath;
            uploadSuccess = true;
          } else {
            console.warn('Client direct upload failed, trying server API fallback:', uploadErr.message);
          }
        } catch (clientErr) {
          console.warn('Client direct upload exception, falling back to server API:', clientErr);
        }

        // 2. Second attempt: Resilient server-side upload fallback (bypasses CORS & MIME restrictions)
        if (!uploadSuccess) {
          const formData = new FormData();
          formData.append('file', payload.file);
          formData.append('conversationId', activeConversationId);

          const apiRes = await fetch('/api/chat/upload', {
            method: 'POST',
            body: formData,
          });

          const apiData = await apiRes.json();
          if (!apiRes.ok || apiData.error || !apiData.filePath) {
            throw new Error(apiData.error || `Upload failed with status ${apiRes.status}`);
          }

          storagePath = apiData.filePath;
        }
      }

      // Encrypt body using AES-GCM 256-bit E2EE before storing in Supabase!
      const encryptedBody = payload.body
        ? await encryptMessage(payload.body, activeConversationId)
        : null;

      const { data: insertedMsg, error: insertErr } = await supabase
        .from('messages')
        .insert({
          conversation_id: activeConversationId,
          sender_id: profile.id,
          message_type: payload.messageType,
          body: encryptedBody,
          storage_path: storagePath,
          original_filename: payload.file?.name || null,
          mime_type: payload.file?.type || null,
          file_size: payload.file?.size || null,
          duration_seconds: payload.durationSeconds || null,
          reply_to_message_id: payload.replyToId || null,
        })
        .select()
        .single();

      if (insertErr || !insertedMsg) {
        throw new Error(insertErr?.message || 'Failed to send message');
      }

      // Update optimistic message with real ID and sent/delivered status (preserve local plaintext body)
      const initialDeliveryStatus: MessageWithDetails['deliveryStatus'] =
        friendPresence.online ? 'delivered' : 'sent';

      setMessages(prev =>
        prev.map(m =>
          m.id === optimisticId
            ? { ...m, ...insertedMsg, body: payload.body || null, isOptimistic: false, deliveryStatus: initialDeliveryStatus }
            : m
        )
      );

      // Also finalize conversation last message in sidebar
      setConversations(prev =>
        prev.map(c =>
          c.id === activeConversationId
            ? {
                ...c,
                lastMessage: {
                  ...insertedMsg,
                  body: payload.body || null,
                  deliveryStatus: initialDeliveryStatus,
                },
                updated_at: insertedMsg.created_at,
              }
            : c
        )
      );

      // Notify recipient device in real time via dual client-websocket and server-http broadcast
      const partnerId = activeConversation?.otherUser?.id;
      if (partnerId && insertedMsg) {
        const notifPayload = {
          conversationId: activeConversationId,
          sender: profile,
          messageType: payload.messageType,
          body: payload.body || '',
          created_at: insertedMsg.created_at,
        };

        // 1. Direct client WebSocket broadcast (<20ms)
        try {
          const userNotifChan = supabase.channel(`user-notifications:${partnerId}`);
          userNotifChan.subscribe((status: string) => {
            if (status === 'SUBSCRIBED') {
              userNotifChan.send({
                type: 'broadcast',
                event: 'new_message',
                payload: notifPayload,
              });
              setTimeout(() => {
                supabase.removeChannel(userNotifChan);
              }, 1500);
            }
          });
        } catch {}

        // 2. Parallel server-side HTTP broadcast via service role
        fetch('/api/chat/call-signal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetUserId: partnerId,
            event: 'new_message',
            payload: notifPayload,
            conversationId: activeConversationId,
          }),
        }).catch(() => {});
      }

      return {};
    } catch (err: unknown) {
      const errMsg = (err as Error)?.message || 'Failed to send message';
      setMessages(prev =>
        prev.map(m => (m.id === optimisticId ? { ...m, deliveryStatus: 'failed' } : m))
      );
      return { error: errMsg };
    }
  };

  // Snapchat-style Security Event Notifier (Screenshots & Media Saves)
  const dismissSecurityAlert = useCallback(() => {
    setSecurityAlert(null);
  }, []);

  const notifySecurityEvent = useCallback(
    async (type: SecurityEventType, filename?: string) => {
      if (!profile || !activeConversationIdRef.current) return;
      const now = Date.now();
      const dedupKey = `${type}:${filename || ''}`;
      // Debounce: prevent duplicate trigger within 4 seconds
      if (lastSecurityEventRef.current.key === dedupKey && now - lastSecurityEventRef.current.time < 4000) {
        return;
      }
      lastSecurityEventRef.current = { type, time: now, key: dedupKey };

      const convId = activeConversationIdRef.current;
      const alert: SecurityEventAlert = {
        id: `sec_${now}_${Math.random().toString(36).slice(2, 6)}`,
        type,
        userId: profile.id,
        userName: profile.display_name,
        filename,
        conversationId: convId,
        timestamp: now,
      };

      // Trigger local alert & sound immediately
      setSecurityAlert(alert);
      setSessionSecurityAlerts(prev => [...prev, alert]);
      playSecurityAlertSound();
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate([40, 60, 40]); } catch {}
      }
      setTimeout(() => {
        setSecurityAlert(prev => (prev?.id === alert.id ? null : prev));
      }, 5000);

      // Realtime broadcast to active conversation channel
      if (channelRef.current) {
        try {
          channelRef.current.send({
            type: 'broadcast',
            event: 'chat_security_alert',
            payload: alert,
          });
        } catch {}
      }

      // Also broadcast directly to partner's user notification channel for ultra-reliability
      const currentConv = conversations.find(c => c.id === convId);
      const otherUserId = currentConv?.otherUser?.id;
      if (otherUserId) {
        try {
          const supabase = getSupabaseBrowserClient();
          const targetChan = supabase.channel(`user-notifications:${otherUserId}`);
          targetChan.subscribe((status: any) => {
            if (status === 'SUBSCRIBED') {
              targetChan.send({
                type: 'broadcast',
                event: 'chat_security_alert',
                payload: alert,
              }).finally(() => {
                supabase.removeChannel(targetChan);
              });
            }
          });
        } catch {}

        // Server-Side High-Priority Push to wake up partner's phone / background service
        fetch('/api/chat/call-signal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetUserId: otherUserId,
            event: 'chat_security_alert',
            payload: alert,
            conversationId: convId,
          }),
        }).catch(() => {});
      }

      // Record permanent screenshot security event in messages table
      if (type === 'screenshot') {
        try {
          const supabase = getSupabaseBrowserClient();
          await supabase.from('messages').insert({
            conversation_id: convId,
            sender_id: profile.id,
            message_type: 'text',
            body: '[📸 Screenshot]',
          });
        } catch (e) {
          console.warn('Could not record screenshot message:', e);
        }
      }
    },
    [profile, conversations]
  );

  // Edit message
  const editMessage = async (messageId: string, newBody: string): Promise<{ error?: string }> => {
    if (!profile) return { error: 'Not authenticated' };

    setMessages(prev =>
      prev.map(m =>
        m.id === messageId
          ? { ...m, body: newBody, edited_at: new Date().toISOString() }
          : m
      )
    );

    if (!isConfigured) return {};

    try {
      const supabase = getSupabaseBrowserClient();
      const encrypted = activeConversationId ? await encryptMessage(newBody, activeConversationId) : newBody;
      const { error } = await supabase
        .from('messages')
        .update({
          body: encrypted,
          edited_at: new Date().toISOString(),
        })
        .eq('id', messageId)
        .eq('sender_id', profile.id);

      if (error) return { error: error.message };
      return {};
    } catch (err: unknown) {
      return { error: (err as Error)?.message || 'Failed to edit message' };
    }
  };

  // Delete message: support 'for_me' and 'for_everyone'
  const deleteMessage = async (
    messageId: string,
    mode: 'for_me' | 'for_everyone' = 'for_everyone'
  ): Promise<{ error?: string }> => {
    if (!profile) return { error: 'Not authenticated' };

    const nowIso = new Date().toISOString();
    const targetMsg = messages.find(m => m.id === messageId);

    if (mode === 'for_me') {
      storeDeletedForMe(profile.id, [messageId]);
      // Completely remove message from local messages state
      setMessages(prev => prev.filter(m => m.id !== messageId));

      // Notify server endpoint
      fetch('/api/chat/delete-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': profile.id },
        body: JSON.stringify({
          messageIds: [messageId],
          conversationId: activeConversationId,
          mode: 'for_me',
          userId: profile.id,
        }),
      }).catch(() => {});

      return {};
    }

    if (mode === 'for_everyone') {
      if (targetMsg && targetMsg.sender_id !== profile.id) {
        return { error: 'You can only delete your own messages for everyone' };
      }
    }

    // 1. Delete for everyone: keep message in place and mark deleted_at locally so placeholder renders right in its spot
    setMessages(prev =>
      prev.map(m =>
        m.id === messageId
          ? {
              ...m,
              deleted_at: nowIso,
              body: null,
              storage_path: null,
              signedMediaUrl: null,
            }
          : m
      )
    );

    // 2. Call server API route for 100% reliable DB write via Service Role
    fetch('/api/chat/delete-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': profile.id },
      body: JSON.stringify({
        messageIds: [messageId],
        conversationId: activeConversationId,
        mode: 'for_everyone',
        userId: profile.id,
      }),
    }).catch(err => console.error('Delete message API error:', err));

    // 3. Delete for everyone: update database, delete storage files, and broadcast
    if (!isConfigured) return {};

    try {
      const supabase = getSupabaseBrowserClient();

      // Remove physical file from Supabase Storage
      if (targetMsg?.storage_path) {
        supabase.storage.from('chat-media').remove([targetMsg.storage_path]).catch(() => {});
      }

      const { error } = await supabase
        .from('messages')
        .update({
          deleted_at: nowIso,
          body: null,
          storage_path: null,
          original_filename: null,
          file_size: null,
          mime_type: null,
        })
        .eq('id', messageId)
        .eq('sender_id', profile.id);

      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'message_deleted',
          payload: { messageId, deletedAt: nowIso, conversationId: activeConversationId },
        });
      }

      if (error) return { error: error.message };
      return {};
    } catch (err: unknown) {
      return { error: (err as Error)?.message || 'Failed to delete message' };
    }
  };

  // Delete multiple messages (bulk delete)
  const deleteMessages = async (
    messageIds: string[],
    mode: 'for_me' | 'for_everyone' = 'for_me'
  ): Promise<{ error?: string }> => {
    if (!profile || messageIds.length === 0) return {};
    const nowIso = new Date().toISOString();

    if (mode === 'for_me') {
      storeDeletedForMe(profile.id, messageIds);
      setMessages(prev => prev.filter(m => !messageIds.includes(m.id)));
      setSelectedMessageIds([]);

      // Notify server endpoint
      fetch('/api/chat/delete-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': profile.id },
        body: JSON.stringify({
          messageIds,
          conversationId: activeConversationId,
          mode: 'for_me',
          userId: profile.id,
        }),
      }).catch(() => {});

      return {};
    }

    // Delete for everyone - ONLY messages sent by current user can be deleted for everyone!
    const outgoingIds = messages
      .filter(m => messageIds.includes(m.id) && m.sender_id === profile.id && !m.deleted_at)
      .map(m => m.id);

    if (outgoingIds.length === 0) {
      return { error: 'You can only delete your own messages for everyone' };
    }

    setMessages(prev =>
      prev.map(m =>
        outgoingIds.includes(m.id)
          ? {
              ...m,
              deleted_at: nowIso,
              body: null,
              storage_path: null,
              signedMediaUrl: null,
            }
          : m
      )
    );
    setSelectedMessageIds([]);

    // Call server API route with Service Role for guaranteed DB write
    fetch('/api/chat/delete-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': profile.id },
      body: JSON.stringify({
        messageIds: outgoingIds,
        conversationId: activeConversationId,
        mode: 'for_everyone',
        userId: profile.id,
      }),
    }).catch(err => console.error('Bulk delete API error:', err));

    if (!isConfigured) return {};

    try {
      const supabase = getSupabaseBrowserClient();

      // Remove physical files from Supabase Storage
      const outgoingStoragePaths = messages
        .filter(m => outgoingIds.includes(m.id) && m.storage_path)
        .map(m => m.storage_path as string);

      if (outgoingStoragePaths.length > 0) {
        supabase.storage.from('chat-media').remove(outgoingStoragePaths).catch(() => {});
      }

      await supabase
        .from('messages')
        .update({
          deleted_at: nowIso,
          body: null,
          storage_path: null,
          original_filename: null,
          file_size: null,
          mime_type: null,
        })
        .in('id', outgoingIds)
        .eq('sender_id', profile.id);

      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'messages_deleted',
          payload: { messageIds: outgoingIds, deletedAt: nowIso, conversationId: activeConversationId },
        });
      }
      return {};
    } catch (err: unknown) {
      return { error: (err as Error)?.message || 'Failed to delete messages' };
    }
  };

  // Forward one or more messages to a target conversation
  const forwardMessages = async (
    targetConversationId: string,
    messageIds: string[]
  ): Promise<{ success: boolean; error?: string }> => {
    if (!profile || messageIds.length === 0) {
      return { success: false, error: 'No messages to forward' };
    }

    const msgsToForward = messages.filter(m => messageIds.includes(m.id) && !m.deleted_at);
    if (msgsToForward.length === 0) {
      return { success: false, error: 'No valid messages to forward' };
    }

    const supabase = getSupabaseBrowserClient();

    try {
      for (const msg of msgsToForward) {
        let storagePath = msg.storage_path;

        // Copy media file in Supabase storage if present
        if (msg.storage_path) {
          const fileExt = msg.original_filename?.split('.').pop() || 'dat';
          const safeName = `fwd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${fileExt}`;
          const targetPath = `${targetConversationId}/${safeName}`;

          const { error: copyErr } = await supabase.storage
            .from('chat-media')
            .copy(msg.storage_path, targetPath);

          if (!copyErr) {
            storagePath = targetPath;
          }
        }

        const plainBody = msg.body;
        const encryptedBody = plainBody
          ? await encryptMessage(plainBody, targetConversationId)
          : null;

        const { data: insertedMsg, error: insertErr } = await supabase
          .from('messages')
          .insert({
            conversation_id: targetConversationId,
            sender_id: profile.id,
            message_type: msg.message_type,
            body: encryptedBody,
            storage_path: storagePath,
            original_filename: msg.original_filename,
            mime_type: msg.mime_type,
            file_size: msg.file_size,
            duration_seconds: msg.duration_seconds,
          })
          .select()
          .single();

        if (insertErr) {
          throw new Error(insertErr.message);
        }

        // If forwarding into currently active chat, update message list
        if (insertedMsg && targetConversationId === activeConversationId) {
          const newMsg: MessageWithDetails = {
            ...insertedMsg,
            sender: profile,
            body: plainBody,
            signedMediaUrl: msg.signedMediaUrl,
            deliveryStatus: 'sent',
            reactions: [],
            receipts: [],
          };
          setMessages(prev => [...prev, newMsg]);
        }
      }

      await refreshConversations();
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: (err as Error)?.message || 'Failed to forward messages' };
    }
  };

  // Toggle emoji reaction
  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!profile) return;

    const targetMessage = messages.find(m => m.id === messageId);
    if (!targetMessage) return;

    const existingReaction = targetMessage.reactions?.find(
      r => r.user_id === profile.id && r.emoji === emoji
    );

    if (existingReaction) {
      // Remove reaction locally
      setMessages(prev =>
        prev.map(m =>
          m.id === messageId
            ? {
                ...m,
                reactions: (m.reactions || []).filter(r => r.id !== existingReaction.id),
              }
            : m
        )
      );

      if (isConfigured) {
        const supabase = getSupabaseBrowserClient();
        await supabase
          .from('message_reactions')
          .delete()
          .eq('message_id', messageId)
          .eq('user_id', profile.id)
          .eq('emoji', emoji);
      }
    } else {
      // Add reaction locally
      const newReaction: MessageReaction = {
        id: `react_${Date.now()}`,
        message_id: messageId,
        user_id: profile.id,
        emoji,
        created_at: new Date().toISOString(),
      };

      setMessages(prev =>
        prev.map(m =>
          m.id === messageId
            ? {
                ...m,
                reactions: [...(m.reactions || []), newReaction],
              }
            : m
        )
      );

      if (isConfigured) {
        const supabase = getSupabaseBrowserClient();
        await supabase.from('message_reactions').insert({
          message_id: messageId,
          user_id: profile.id,
          emoji,
        });
      }
    }
  };

  // Mark conversation as read
  const markConversationAsRead = async (conversationId: string) => {
    if (!profile) return;

    setConversations(prev =>
      prev.map(c => (c.id === conversationId ? { ...c, unreadCount: 0 } : c))
    );

    const nowIso = new Date().toISOString();
    try {
      if (typeof window !== 'undefined' && profile?.id) {
        localStorage.setItem(`vibely_last_read_${profile.id}_${conversationId}`, nowIso);
      }
    } catch {}

    if (isConfigured) {
      // 1. Call server API to guarantee DB update even if client RLS blocks
      fetch('/api/chat/mark-read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': profile.id,
        },
        body: JSON.stringify({ conversationId, userId: profile.id }),
      }).catch(() => {});

      // 2. Client-side update
      const supabase = getSupabaseBrowserClient();
      await supabase
        .from('conversation_members')
        .update({ last_read_at: nowIso })
        .eq('conversation_id', conversationId)
        .eq('user_id', profile.id);
    }
  };

  return (
    <ChatContext.Provider
      value={{
        conversations,
        activeConversationId,
        activeConversation,
        messages,
        isLoadingMessages,
        replyingTo,
        searchQuery,
        isSearching,
        isMediaDrawerOpen,
        typingUsers,
        friendPresence,
        isUserOnline,
        onlineUserIds,
        setActiveConversationId,
        setReplyingTo,
        setSearchQuery,
        setIsSearching,
        setIsMediaDrawerOpen,
        sendMessage,
        editMessage,
        deleteMessage,
        deleteMessages,
        forwardMessages,
        selectedMessageIds,
        setSelectedMessageIds,
        isSelectMode,
        toggleSelectMessage,
        clearSelectedMessages,
        selectAllMessages,
        toggleReaction,
        broadcastTyping,
        partnerActivity,
        broadcastActivity,
        markConversationAsRead,
        refreshConversations,
        incomingRequests,
        refreshRequests,
        respondToRequest,
        connectWithPartner,
        deleteFriend,
        notifySecurityEvent,
        securityAlert,
        dismissSecurityAlert,
        sessionSecurityAlerts,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}
