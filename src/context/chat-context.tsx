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
} from '@/types/database';
import { encryptMessage, decryptMessage } from '@/lib/e2ee';

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
  toggleReaction: (messageId: string, emoji: string) => Promise<void>;
  broadcastTyping: (isTyping: boolean) => void;
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

const ChatContext = createContext<ChatContextType | null>(null);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { profile, isConfigured } = useAuth();
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

  // Sync friend presence from active conversation's partner
  useEffect(() => {
    if (activeConversation?.otherUser) {
      const lastSeen = activeConversation.otherUser.last_seen_at;
      const isRecentlyActive = lastSeen
        ? Date.now() - new Date(lastSeen).getTime() < 120000
        : false;
      setFriendPresence({
        userId: activeConversation.otherUser.id,
        online: isRecentlyActive,
        lastSeen: lastSeen || new Date().toISOString(),
      });
    } else {
      setFriendPresence({
        userId: '',
        online: false,
        lastSeen: new Date().toISOString(),
      });
    }
  }, [activeConversation]);

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
        } else if (row.last_read_at) {
          const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .gt('created_at', row.last_read_at)
            .neq('sender_id', profile.id)
            .is('deleted_at', null);
          unreadCount = count || 0;
        } else {
          // If last_read_at is null, count messages sent by others
          const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .neq('sender_id', profile.id)
            .is('deleted_at', null);
          unreadCount = count || 0;
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
      .on('broadcast', { event: 'friend-removed' }, (payload: any) => {
        refreshConversations();
        refreshRequests();
        if (payload?.payload?.conversationId && payload.payload.conversationId === activeConversationId) {
          setActiveConversationId(null);
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
        .is('deleted_at', null)
        .order('created_at', { ascending: true });

      if (error) {
        const errDetail = error.message || error.code || JSON.stringify(error);
        console.warn('Unable to fetch messages from database:', errDetail);
        setMessages([]);
      } else if (data) {
        // Filter out messages deleted for me on this device
        let deletedForMe: string[] = [];
        try {
          if (profile?.id && typeof window !== 'undefined') {
            deletedForMe = JSON.parse(localStorage.getItem(`vibely_deleted_for_me_${profile.id}`) || '[]');
          }
        } catch {}
        const visibleData = data.filter((m: any) => !deletedForMe.includes(m.id));

        const enriched: MessageWithDetails[] = await Promise.all(
          visibleData.map(async (msg: any) => {
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

        // Mark conversation read in database & notify partner for blue ticks
        if (profile?.id && conversationId) {
          const nowIso = new Date().toISOString();
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
  }, [isConfigured]);

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

  // Handle active conversation change
  useEffect(() => {
    if (activeConversationId) {
      loadMessages(activeConversationId);
      markConversationAsRead(activeConversationId);
    } else {
      setMessages([]);
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
          const isPresent = Boolean(state[otherUserId] && (state[otherUserId] as any).length > 0);
          setFriendPresence(prev => ({
            userId: otherUserId,
            online: isPresent,
            lastSeen: isPresent ? new Date().toISOString() : (activeConversation?.otherUser?.last_seen_at || prev.lastSeen),
          }));
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
        }
      });

    // Broadcast listener for instant message deletion by partner
    channel.on('broadcast', { event: 'message_deleted' }, ({ payload }: { payload: any }) => {
      if (payload?.messageId) {
        setMessages(prev => prev.filter(m => m.id !== payload.messageId));
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
          if (updated.deleted_at) {
            // Remove soft-deleted message from view
            setMessages(prev => prev.filter(m => m.id !== updated.id));
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
      }
    });

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [isConfigured, activeConversationId, profile, activeConversation?.otherUser?.id, loadMessages]);

  // Broadcast typing
  const broadcastTyping = useCallback(
    (isTyping: boolean) => {
      if (!profile) return;

      if (!isConfigured) return;

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
    },
    [profile, isConfigured]
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
        const fileExt = payload.file.name.split('.').pop();
        const safeName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${fileExt}`;
        const filePath = `${activeConversationId}/${safeName}`;

        const { error: uploadErr } = await supabase.storage
          .from('chat-media')
          .upload(filePath, payload.file, {
            contentType: payload.file.type,
            upsert: false,
          });

        if (uploadErr) {
          throw new Error(`Upload failed: ${uploadErr.message}`);
        }

        storagePath = filePath;
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

      return {};
    } catch (err: unknown) {
      const errMsg = (err as Error)?.message || 'Failed to send message';
      setMessages(prev =>
        prev.map(m => (m.id === optimisticId ? { ...m, deliveryStatus: 'failed' } : m))
      );
      return { error: errMsg };
    }
  };

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

    // 1. Remove from local messages state immediately
    setMessages(prev => prev.filter(m => m.id !== messageId));

    if (mode === 'for_me') {
      try {
        if (typeof window !== 'undefined') {
          const key = `vibely_deleted_for_me_${profile.id}`;
          const stored: string[] = JSON.parse(localStorage.getItem(key) || '[]');
          if (!stored.includes(messageId)) {
            stored.push(messageId);
            localStorage.setItem(key, JSON.stringify(stored));
          }
        }
      } catch (e) {
        console.error('Failed to save delete-for-me to storage:', e);
      }
      return {};
    }

    // 2. Delete for everyone: update database and broadcast
    if (!isConfigured) return {};

    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase
        .from('messages')
        .update({
          deleted_at: new Date().toISOString(),
        })
        .eq('id', messageId)
        .eq('sender_id', profile.id);

      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'message_deleted',
          payload: { messageId, conversationId: activeConversationId },
        });
      }

      if (error) return { error: error.message };
      return {};
    } catch (err: unknown) {
      return { error: (err as Error)?.message || 'Failed to delete message' };
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

    if (isConfigured) {
      const supabase = getSupabaseBrowserClient();
      await supabase
        .from('conversation_members')
        .update({ last_read_at: new Date().toISOString() })
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
        setActiveConversationId,
        setReplyingTo,
        setSearchQuery,
        setIsSearching,
        setIsMediaDrawerOpen,
        sendMessage,
        editMessage,
        deleteMessage,
        toggleReaction,
        broadcastTyping,
        markConversationAsRead,
        refreshConversations,
        incomingRequests,
        refreshRequests,
        respondToRequest,
        connectWithPartner,
        deleteFriend,
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
