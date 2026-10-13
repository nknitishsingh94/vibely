'use client';

import * as React from 'react';
import { useChat } from '@/context/chat-context';
import { MessageBubble } from './message-bubble';
import { formatMessageDate } from '@/lib/utils';
import { Heart, Search, Sparkles } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';

export function MessageList() {
  const {
    messages,
    isLoadingMessages,
    searchQuery,
    typingUsers,
    activeConversation,
  } = useChat();

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
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-muted-foreground romantic-wallpaper select-none">
        {searchQuery ? (
          <>
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <Search className="w-6 h-6 opacity-60" />
            </div>
            <p className="text-sm font-medium text-foreground">No matching moments found</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              No messages found matching &quot;{searchQuery}&quot;. Try another word.
            </p>
          </>
        ) : (
          <div className="space-y-3 max-w-sm animate-in fade-in duration-300">
            <div className="w-16 h-16 rounded-full bg-rose-500/10 text-primary flex items-center justify-center mx-auto shadow-xs border border-rose-500/20">
              <Heart className="w-8 h-8 fill-primary/20 stroke-primary" />
            </div>
            <h3 className="text-base font-serif font-bold text-foreground">
              Your story starts with a hello.
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Every little moment matters. Share a heartfelt note, a photo, a favorite song, or say what&apos;s on your mind.
            </p>
            <div className="pt-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium text-rose-600 dark:text-rose-300 bg-rose-500/10 border border-rose-500/15">
                <Sparkles className="w-3 h-3 text-primary" />
                Just us, in our own little world.
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
      className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4 romantic-wallpaper"
    >
      {groupedMessages.map(group => (
        <div key={group.date} className="space-y-2">
          {/* Centered Editorial Date Badge */}
          <div className="flex items-center justify-center my-4">
            <div className="relative flex items-center justify-center w-full max-w-xs">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border/40" />
              </div>
              <span className="relative px-3.5 py-0.5 rounded-full text-[11px] font-serif font-medium bg-background/90 text-muted-foreground border border-border/60 select-none shadow-xs backdrop-blur-xs">
                {group.date}
              </span>
            </div>
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

      {/* Typing Indicator Bubble */}
      {typingUsers.length > 0 && (
        <div className="flex items-center gap-2 pl-2 animate-in fade-in duration-200">
          <Avatar
            name={typingUsers[0]}
            size="xs"
            src={activeConversation?.otherUser?.avatar_path}
          />
          <div className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-card border border-border/70 shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" />
            <span
              className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce"
              style={{ animationDelay: '0.15s' }}
            />
            <span
              className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce"
              style={{ animationDelay: '0.3s' }}
            />
          </div>
        </div>
      )}

      <div ref={bottomRef} className="h-1" />
    </div>
  );
}
