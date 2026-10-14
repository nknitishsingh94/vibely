'use client';

import * as React from 'react';
import { useChat } from '@/context/chat-context';
import { MessageBubble } from './message-bubble';
import { formatMessageDate } from '@/lib/utils';
import { Heart, Search, Sparkles, Lock } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';

export function MessageList() {
  const {
    messages,
    isLoadingMessages,
    searchQuery,
    typingUsers,
    activeConversation,
    partnerActivity,
    friendPresence,
    isUserOnline,
  } = useChat();

  const partnerId = activeConversation?.otherUser?.id;
  const isPartnerOnline = partnerId ? isUserOnline(partnerId) || friendPresence.online : friendPresence.online;

  const bottomRef = React.useRef<HTMLDivElement | null>(null);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  // Filter messages based on search query
  const filteredMessages = React.useMemo(() => {
    if (!searchQuery.trim()) return messages;
    const q = searchQuery.toLowerCase();
    return messages.filter(
      m =>
        (m.body && m.body.toLowerCase().includes(q)) ||
        (m.original_filename && m.original_filename.toLowerCase().includes(q))
    );
  }, [messages, searchQuery]);

  // Group filtered messages by formatted date
  const groupedMessages = React.useMemo(() => {
    const groups: { date: string; items: typeof messages }[] = [];
    let currentDate = '';

    filteredMessages.forEach(msg => {
      const msgDate = formatMessageDate(msg.created_at);
      if (msgDate !== currentDate) {
        currentDate = msgDate;
        groups.push({ date: msgDate, items: [msg] });
      } else {
        groups[groups.length - 1].items.push(msg);
      }
    });

    return groups;
  }, [filteredMessages]);

  // Scroll to bottom on initial load or new messages
  React.useEffect(() => {
    if (!searchQuery) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, searchQuery]);

  // Keep latest messages in view when mobile virtual keyboard opens or resizes
  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;

    const handleViewportResize = () => {
      if (!searchQuery) {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    };

    window.visualViewport.addEventListener('resize', handleViewportResize);
    return () => {
      window.visualViewport?.removeEventListener('resize', handleViewportResize);
    };
  }, [searchQuery]);

  if (isLoadingMessages) {
    return (
      <div className="flex-1 p-4 sm:p-6 space-y-4 overflow-y-auto romantic-wallpaper">
        <div className="flex justify-start">
          <div className="w-48 h-12 bg-muted/60 dark:bg-muted/30 animate-pulse rounded-2xl" />
        </div>
        <div className="flex justify-end">
          <div className="w-64 h-16 bg-primary/20 animate-pulse rounded-2xl" />
        </div>
        <div className="flex justify-start">
          <div className="w-56 h-36 bg-muted/60 dark:bg-muted/30 animate-pulse rounded-2xl" />
        </div>
      </div>
    );
  }

  if (filteredMessages.length === 0) {
    const partnerUsername = activeConversation?.otherUser?.username
      ? `@${activeConversation.otherUser.username}`
      : activeConversation?.otherUser?.display_name || 'your partner';

    return (
      <div className="flex-1 flex flex-col justify-between p-4 text-center text-muted-foreground select-none">
        {/* Centered Date at the top like in user's photo */}
        <div className="flex items-center justify-center pt-2 select-none">
          <span className="text-[11px] font-sans font-semibold tracking-wider text-muted-foreground/80 uppercase">
            TODAY
          </span>
        </div>

        {searchQuery ? (
          <div className="my-auto space-y-2">
            <p className="text-sm font-semibold text-foreground">No matching messages</p>
            <p className="text-xs text-muted-foreground">No messages found matching &quot;{searchQuery}&quot;</p>
          </div>
        ) : (
          /* Subtle clean notice at bottom like in user's photo */
          <div className="max-w-md mx-auto w-full p-4 rounded-2xl bg-card/60 dark:bg-[#182229] border border-border/60 text-center space-y-2 mb-2 animate-in fade-in shadow-2xs">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="font-semibold text-foreground">{partnerUsername}</span> is connected with you. Messages and voice notes are end-to-end encrypted.
            </p>
            <div className="flex items-center justify-center gap-2 pt-0.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                <Lock className="w-3 h-3 text-emerald-600" />
                End-to-End Encrypted
              </span>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto overscroll-contain touch-pan-y p-3 sm:p-5 space-y-4 romantic-wallpaper"
    >
      {/* WhatsApp End-to-End Encryption Security Pill Banner */}
      <div className="flex items-center justify-center my-2 px-4 select-none">
        <div className="max-w-md px-3.5 py-1.5 rounded-xl bg-amber-500/10 dark:bg-[#182229] border border-amber-500/20 dark:border-border/60 text-center text-[11px] text-amber-800 dark:text-amber-300/90 shadow-2xs flex items-center justify-center gap-1.5 leading-snug">
          <Lock className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>Messages are end-to-end encrypted. No one outside of this chat, not even Vibely, can read or listen to them.</span>
        </div>
      </div>

      {groupedMessages.map(group => (
        <div key={group.date} className="space-y-2">
          {/* Centered WhatsApp Date Badge */}
          <div className="flex items-center justify-center my-3 select-none">
            <span className="px-3 py-1 rounded-lg text-[11px] font-sans font-medium uppercase tracking-wide bg-background/90 dark:bg-[#182229] text-muted-foreground border border-border/60 shadow-2xs backdrop-blur-xs">
              {group.date}
            </span>
          </div>

          {/* Messages */}
          {group.items.map((message, idx) => (
            <MessageBubble
              key={message.id}
              message={message}
              isFirstInGroup={idx === 0 || group.items[idx - 1]?.sender_id !== message.sender_id}
            />
          ))}
        </div>
      ))}

      {/* Live Activity Typing Indicator */}
      {isPartnerOnline && (partnerActivity?.activity === 'typing' || typingUsers.length > 0) ? (
        <div className="flex items-center gap-2 pl-2 animate-in fade-in duration-200">
          <Avatar
            name={activeConversation?.otherUser?.display_name || 'Partner'}
            size="xs"
            src={activeConversation?.otherUser?.avatar_path}
          />
          <div className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-card border border-border/70 shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce" />
            <span
              className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce"
              style={{ animationDelay: '0.15s' }}
            />
            <span
              className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce"
              style={{ animationDelay: '0.3s' }}
            />
          </div>
        </div>
      ) : null}

      <div ref={bottomRef} className="h-1" />
    </div>
  );
}
