'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  UserPlus,
  Settings,
  Search,
  Image as ImageIcon,
  Music,
  Film,
  FileText,
  Sparkles,
  Heart,
  FolderHeart,
  CalendarHeart,
  Copy,
  Check,
  X,
  Bell,
} from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { useChat } from '@/context/chat-context';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { BrandLogo } from '@/components/ui/brand-logo';
import { InviteModal } from './invite-modal';
import { NotificationBell } from './notification-bar';
import { formatMessageTime, cn } from '@/lib/utils';
import { useRomanticFeatures } from '@/lib/romantic-features';
import { formatDuoId } from '@/lib/duo-id';

export function Sidebar() {
  const { profile, signOut, isConfigured } = useAuth();
  const {
    conversations,
    activeConversationId,
    setActiveConversationId,
    friendPresence,
    setIsMediaDrawerOpen,
    incomingRequests,
    respondToRequest,
  } = useChat();
  const router = useRouter();

  const { daysTogether } = useRomanticFeatures();
  const [isInviteOpen, setIsInviteOpen] = React.useState(false);
  const [filterText, setFilterText] = React.useState('');
  const [copiedId, setCopiedId] = React.useState(false);

  const duoId = formatDuoId(profile);

  const handleCopyDuoId = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(duoId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const filteredConversations = conversations.filter(c => {
    if (!filterText) return true;
    const name = c.otherUser?.display_name?.toLowerCase() || '';
    const user = c.otherUser?.username?.toLowerCase() || '';
    return name.includes(filterText.toLowerCase()) || user.includes(filterText.toLowerCase());
  });



  const getMediaPreviewIcon = (type?: string) => {
    switch (type) {
      case 'image':
        return <ImageIcon className="w-3.5 h-3.5 text-rose-500 shrink-0 inline mr-1" />;
      case 'audio':
        return <Music className="w-3.5 h-3.5 text-violet-500 shrink-0 inline mr-1" />;
      case 'video':
        return <Film className="w-3.5 h-3.5 text-sky-500 shrink-0 inline mr-1" />;
      case 'file':
        return <FileText className="w-3.5 h-3.5 text-amber-500 shrink-0 inline mr-1" />;
      default:
        return null;
    }
  };

  return (
    <>
      <aside className="w-full md:w-80 lg:w-88 flex flex-col h-full bg-sidebar-bg border-r border-border/70 select-none transition-colors">
        {/* Brand Header */}
        <div className="p-4 border-b border-border/50 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <BrandLogo size="md" />

            <div className="flex items-center gap-1.5">
              <NotificationBell onOpenConnect={() => setIsInviteOpen(true)} />

              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsInviteOpen(true)}
                className="rounded-xl text-xs gap-1.5 border-primary/20 bg-primary/5 text-primary hover:bg-primary/15 hover:text-primary transition-all cursor-pointer font-medium"
                title="Connect partner"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Connect</span>
              </Button>
            </div>
          </div>

          {/* Intimate Subtitle Ribbon */}
          <div className="flex items-center justify-between text-[11px] text-muted-foreground/90 px-0.5">
            <span className="flex items-center gap-1.5 italic font-serif">
              <Sparkles className="w-3 h-3 text-primary/70 animate-pulse" />
              Your little corner of the world
            </span>

            {daysTogether !== null && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-300 font-medium text-[10px] border border-rose-500/20">
                <Heart className="w-2.5 h-2.5 fill-current" />
                Day {daysTogether}
              </span>
            )}
          </div>
        </div>

        {/* Search Conversations Input */}
        <div className="px-3 pt-3 pb-1">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 pointer-events-none" />
            <input
              type="text"
              value={filterText}
              onChange={e => setFilterText(e.target.value)}
              placeholder="Search conversations..."
              className="w-full pl-9 pr-3 py-2 rounded-xl text-xs bg-background/60 border border-input focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground transition-all"
            />
          </div>
        </div>

        {/* Quick Couple Shortcuts: Our Moments */}
        <div className="px-3 py-1.5 flex items-center gap-1.5">
          <button
            onClick={() => setIsMediaDrawerOpen(true)}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/70 border border-transparent hover:border-border/50 transition-all cursor-pointer"
            title="Open Our Moments gallery"
          >
            <FolderHeart className="w-3.5 h-3.5 text-primary" />
            <span>Our Moments</span>
          </button>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {/* Pending Connection Requests Banner in Sidebar */}
          {incomingRequests.length > 0 && (
            <div className="space-y-1.5 mb-2">
              <div className="flex items-center justify-between px-1 text-[11px] font-semibold text-primary">
                <span className="flex items-center gap-1">
                  <Bell className="w-3 h-3 text-rose-500 animate-bounce" />
                  Connection Requests ({incomingRequests.length})
                </span>
              </div>

              {incomingRequests.map(req => {
                const duoIdText = formatDuoId(req.sender as any);
                return (
                  <div
                    key={req.id}
                    className="p-2.5 rounded-2xl bg-[#0C3B2E]/5 dark:bg-white/5 border border-primary/25 space-y-2 shadow-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <Avatar
                        src={req.sender.avatar_path || undefined}
                        name={req.sender.display_name}
                        size="sm"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">
                          {req.sender.display_name}
                        </p>
                        <p className="text-[10px] text-muted-foreground font-mono truncate">
                          {duoIdText}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 pt-0.5">
                      <Button
                        size="sm"
                        onClick={() => respondToRequest(req.id, 'accept')}
                        className="flex-1 h-7 rounded-xl text-[11px] gap-1 font-medium bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer"
                      >
                        <Check className="w-3 h-3" />
                        <span>Accept</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => respondToRequest(req.id, 'decline')}
                        className="h-7 px-2.5 rounded-xl text-[11px] gap-1 border-border/80 text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                        <span>Decline</span>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {filteredConversations.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground space-y-2">
              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center">
                <Heart className="w-5 h-5" />
              </div>
              <p className="text-xs font-medium text-foreground">No conversations yet</p>
              <p className="text-[11px] text-muted-foreground max-w-[200px] mx-auto">
                Share your unique Vibe ID or enter your partner&apos;s ID to start chatting.
              </p>
              <Button
                variant="default"
                size="sm"
                onClick={() => setIsInviteOpen(true)}
                className="mt-2 text-xs rounded-xl shadow-sm"
              >
                <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                Connect Partner
              </Button>
            </div>
          ) : (
            filteredConversations.map(conv => {
              const other = conv.otherUser;
              const isActive = conv.id === activeConversationId;
              const isOtherOnline = other?.id === friendPresence.userId ? friendPresence.online : false;

              return (
                <div
                  key={conv.id}
                  onClick={() => setActiveConversationId(conv.id)}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all duration-150 relative group',
                    isActive
                      ? 'bg-card border border-rose-200/60 dark:border-rose-900/40 shadow-xs text-card-foreground'
                      : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground'
                  )}
                >
                  {/* Subtle active left glow line */}
                  {isActive && (
                    <div className="absolute left-1.5 top-3 bottom-3 w-1 rounded-full bg-primary" />
                  )}

                  <Avatar
                    src={other?.avatar_path}
                    name={other?.display_name || 'Partner'}
                    size="md"
                    isOnline={isOtherOnline}
                    className="shrink-0"
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <h4
                        className={cn(
                          'text-xs font-semibold truncate flex items-center gap-1',
                          isActive ? 'text-foreground font-bold' : 'text-foreground/90'
                        )}
                      >
                        {other?.display_name || 'My Partner'}
                      </h4>
                      {conv.lastMessage && (
                        <span className="text-[10px] text-muted-foreground shrink-0 font-mono">
                          {formatMessageTime(conv.lastMessage.created_at)}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <p className="truncate text-[11px] text-muted-foreground max-w-[170px]">
                        {getMediaPreviewIcon(conv.lastMessage?.message_type)}
                        {conv.lastMessage?.body?.startsWith('[💌 Note]')
                          ? '💌 Sent a Little Note'
                          : conv.lastMessage?.body ||
                            conv.lastMessage?.original_filename ||
                            (conv.lastMessage?.message_type ? `[${conv.lastMessage.message_type}]` : 'Say hello!')}
                      </p>
                      {conv.unreadCount > 0 && (
                        <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-primary text-primary-foreground shadow-xs">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* User Footer Profile & Controls */}
        <div className="p-3 border-t border-border/60 bg-card/40 flex items-center justify-between gap-1">
          <Link
            href="/settings/profile"
            className="flex items-center gap-2.5 min-w-0 p-1.5 rounded-xl hover:bg-muted/70 transition-colors flex-1"
          >
            <Avatar
              src={profile?.avatar_path}
              name={profile?.display_name || 'Me'}
              size="sm"
            />
            <div className="min-w-0 text-left">
              <p className="text-xs font-semibold truncate text-foreground leading-tight">
                {profile?.display_name || 'My Profile'}
              </p>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono truncate">
                <span className="text-primary font-medium">{duoId}</span>
              </div>
            </div>
          </Link>

          <button
            type="button"
            onClick={handleCopyDuoId}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0 cursor-pointer"
            title="Copy your Vibe ID"
            aria-label="Copy Vibe ID"
          >
            {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          <div className="flex items-center shrink-0">
            <Link
              href="/settings/profile"
              className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Settings & Preferences"
              aria-label="Settings"
            >
              <Settings className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </aside>

      <InviteModal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
      />
    </>
  );
}
