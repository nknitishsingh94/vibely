'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  UserPlus,
  Settings,
  Search,
  Camera,
  Mic,
  Video,
  FileText,
  Sparkles,
  Heart,
  FolderHeart,
  Copy,
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
  X,
  Bell,
  Lock,
  Phone,
} from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { useChat } from '@/context/chat-context';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { BrandLogo } from '@/components/ui/brand-logo';
import { InviteModal } from './invite-modal';
import { CallModal } from './call-modal';
import { NotificationBell } from './notification-bar';
import { formatConversationTime, cn } from '@/lib/utils';
import { useRomanticFeatures } from '@/lib/romantic-features';

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
    typingUsers,
    markConversationAsRead,
    partnerActivity,
  } = useChat();
  const router = useRouter();

  const { daysTogether, favorites } = useRomanticFeatures();
  const [isInviteOpen, setIsInviteOpen] = React.useState(false);
  const [filterText, setFilterText] = React.useState('');
  const [filterTab, setFilterTab] = React.useState<'all' | 'unread' | 'favorites'>('all');
  const [copiedId, setCopiedId] = React.useState(false);
  const [isCallModalOpen, setIsCallModalOpen] = React.useState(false);
  const [selectedCallPartner, setSelectedCallPartner] = React.useState<any>(null);

  const myUsername = profile?.username ? `@${profile.username}` : '';

  const handleCopyUsername = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!myUsername) return;
    navigator.clipboard.writeText(myUsername);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const filteredConversations = conversations.filter(c => {
    if (filterTab === 'unread' && c.unreadCount <= 0) return false;
    if (filterTab === 'favorites' && c.lastMessage && !favorites.includes(c.lastMessage.id)) {
      return false;
    }
    if (!filterText) return true;
    const name = c.otherUser?.display_name?.toLowerCase() || '';
    const user = c.otherUser?.username?.toLowerCase() || '';
    return name.includes(filterText.toLowerCase()) || user.includes(filterText.toLowerCase());
  });

  // Outgoing last message status tick (exact WhatsApp style)
  const renderLastMessageStatus = (lastMsg: any, isPartnerOnline: boolean) => {
    if (!lastMsg || lastMsg.sender_id !== profile?.id) return null;

    if (lastMsg.deliveryStatus === 'sending' || lastMsg.isOptimistic) {
      return <Clock className="w-3.5 h-3.5 text-muted-foreground/70 inline-block mr-1 shrink-0 animate-pulse" />;
    }
    if (lastMsg.deliveryStatus === 'failed') {
      return <AlertCircle className="w-3.5 h-3.5 text-rose-500 inline-block mr-1 shrink-0" />;
    }
    if (lastMsg.deliveryStatus === 'read') {
      return <CheckCheck className="w-4 h-4 text-[#38BDF8] inline-block mr-1 shrink-0 stroke-[2.5]" />;
    }
    if (lastMsg.deliveryStatus === 'delivered' || isPartnerOnline) {
      return <CheckCheck className="w-4 h-4 text-muted-foreground/80 inline-block mr-1 shrink-0 stroke-[2]" />;
    }
    // Default: Sent (partner offline)
    return <Check className="w-4 h-4 text-muted-foreground/80 inline-block mr-1 shrink-0 stroke-[2]" />;
  };

  const renderMediaPreview = (type?: string, filename?: string | null) => {
    switch (type) {
      case 'image':
        return (
          <span className="inline-flex items-center gap-1">
            <Camera className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span>Photo</span>
          </span>
        );
      case 'audio':
        return (
          <span className="inline-flex items-center gap-1">
            <Mic className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>Voice message</span>
          </span>
        );
      case 'video':
        return (
          <span className="inline-flex items-center gap-1">
            <Video className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span>Video</span>
          </span>
        );
      case 'file':
        return (
          <span className="inline-flex items-center gap-1">
            <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className="truncate">{filename || 'Document'}</span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <aside className="w-full md:w-80 lg:w-92 flex flex-col h-full max-h-[100dvh] bg-sidebar-bg border-r border-border/70 select-none overflow-hidden overscroll-none">
        {/* Brand Header */}
        <div className="shrink-0 p-3.5 sm:p-4 border-b border-border/50 flex flex-col gap-2 pt-[max(env(safe-area-inset-top),0.875rem)]">
          <div className="flex items-center justify-between">
            <BrandLogo size="md" />

            <div className="flex items-center gap-1.5">
              <NotificationBell onOpenConnect={() => setIsInviteOpen(true)} />

              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsInviteOpen(true)}
                className="rounded-xl text-xs gap-1.5 border-emerald-500/20 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/15 transition-all cursor-pointer font-medium"
                title="Connect partner"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Connect</span>
              </Button>
            </div>
          </div>
        </div>

        {/* WhatsApp-Style Search Input */}
        <div className="shrink-0 px-3 pt-2.5 pb-1.5 space-y-2">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 pointer-events-none" />
            <input
              type="text"
              value={filterText}
              onChange={e => setFilterText(e.target.value)}
              placeholder="Search or start new chat"
              className="w-full pl-9 pr-8 py-2 rounded-xl text-xs bg-muted/60 hover:bg-muted/80 focus:bg-background border border-border/60 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 placeholder:text-muted-foreground transition-all"
            />
            {filterText && (
              <button
                onClick={() => setFilterText('')}
                className="absolute right-2.5 text-muted-foreground hover:text-foreground p-0.5 rounded-full"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* WhatsApp Filter Tabs: All, Unread, Favourites */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setFilterTab('all')}
              className={cn(
                'px-3 py-1 rounded-full text-[11px] font-medium transition-colors cursor-pointer',
                filterTab === 'all'
                  ? 'bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              )}
            >
              All
            </button>
            <button
              onClick={() => setFilterTab('unread')}
              className={cn(
                'px-3 py-1 rounded-full text-[11px] font-medium transition-colors cursor-pointer',
                filterTab === 'unread'
                  ? 'bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              )}
            >
              Unread
            </button>
            <button
              onClick={() => setFilterTab('favorites')}
              className={cn(
                'px-3 py-1 rounded-full text-[11px] font-medium transition-colors cursor-pointer',
                filterTab === 'favorites'
                  ? 'bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              )}
            >
              Favourites
            </button>

            {/* Calls Button beside Unread & Favourites */}
            <button
              onClick={() => {
                const targetConv = conversations.find(c => c.id === activeConversationId) || conversations[0];
                if (targetConv?.otherUser) {
                  setSelectedCallPartner(targetConv.otherUser);
                  setIsCallModalOpen(true);
                } else {
                  setIsInviteOpen(true);
                }
              }}
              className="px-3 py-1 rounded-full text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1 shrink-0 bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/25"
              title="Start a Call"
            >
              <Phone className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              <span>Calls</span>
            </button>

            <button
              onClick={() => setIsMediaDrawerOpen(true)}
              className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              title="Open Our Moments gallery"
            >
              <FolderHeart className="w-3 h-3 text-primary" />
              <span>Moments</span>
            </button>
          </div>
        </div>

        {/* Conversations List (WhatsApp Chat Feed) */}
        <div className="flex-1 overflow-y-auto overscroll-contain touch-pan-y divide-y divide-border/30">
          {/* Pending Connection Requests Banner in Sidebar */}
          {incomingRequests.length > 0 && (
            <div className="p-2 space-y-1.5 bg-card/60">
              <div className="flex items-center justify-between px-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                <span className="flex items-center gap-1">
                  <Bell className="w-3 h-3 text-rose-500 animate-bounce" />
                  Connection Requests ({incomingRequests.length})
                </span>
              </div>

              {incomingRequests.map(req => {
                const usernameText = req.sender.username ? `@${req.sender.username}` : '';
                return (
                  <div
                    key={req.id}
                    className="p-2.5 rounded-2xl bg-card border border-emerald-500/25 space-y-2 shadow-xs"
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
                          {usernameText}
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
            <div className="p-8 text-center text-muted-foreground space-y-2">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 mx-auto flex items-center justify-center">
                <Heart className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-foreground">No chats found</p>
              <p className="text-xs text-muted-foreground max-w-[220px] mx-auto">
                Share your username or connect with your partner to start chatting.
              </p>
              <Button
                variant="default"
                size="sm"
                onClick={() => setIsInviteOpen(true)}
                className="mt-2 text-xs rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
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
              const isPartnerTyping = typingUsers.some(
                u => u === other?.display_name || u === other?.username
              );

              const lastTime = conv.lastMessage?.created_at || conv.updated_at;
              const hasUnread = conv.unreadCount > 0;

              return (
                <div
                  key={conv.id}
                  onClick={() => {
                    setActiveConversationId(conv.id);
                    markConversationAsRead(conv.id);
                  }}
                  className={cn(
                    'flex items-center gap-3 px-3.5 py-3 cursor-pointer transition-all duration-150 relative group',
                    isActive
                      ? 'bg-muted/80 dark:bg-card/90 shadow-2xs'
                      : 'hover:bg-muted/40'
                  )}
                >
                  {/* Active Left Indicator Bar */}
                  {isActive && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-600 dark:bg-emerald-500" />
                  )}

                  {/* Partner Avatar with live green online dot */}
                  <Avatar
                    src={other?.avatar_path}
                    name={other?.display_name || 'Partner'}
                    size="md"
                    isOnline={isOtherOnline}
                    className="shrink-0"
                  />

                  {/* WhatsApp Content Details */}
                  <div className="flex-1 min-w-0">
                    {/* Top Row: Partner Name + WhatsApp Timestamp */}
                    <div className="flex items-center justify-between mb-1">
                      <h4
                        className={cn(
                          'text-sm font-semibold truncate text-foreground',
                          hasUnread && 'font-bold'
                        )}
                      >
                        {other?.display_name || 'Partner'}
                      </h4>

                      {lastTime && (
                        <span
                          className={cn(
                            'text-[11px] shrink-0 font-medium',
                            hasUnread
                              ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                              : 'text-muted-foreground'
                          )}
                        >
                          {formatConversationTime(lastTime)}
                        </span>
                      )}
                    </div>

                    {/* Bottom Row: Status Tick + Last Message / Typing... + Unread Badge */}
                    <div className="flex items-center justify-between gap-1.5 text-xs">
                      <div className="truncate flex items-center min-w-0 max-w-[190px] sm:max-w-[210px]">
                        {isPartnerTyping || (isActive && partnerActivity?.activity === 'typing') ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium text-xs flex items-center gap-1 animate-pulse">
                            typing...
                          </span>
                        ) : isActive && partnerActivity?.activity === 'viewing_image' ? (
                          <span className="text-purple-600 dark:text-purple-400 font-medium text-xs flex items-center gap-1 animate-pulse">
                            📸 viewing photo...
                          </span>
                        ) : isActive && partnerActivity?.activity === 'in_chat' ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium text-xs flex items-center gap-1">
                            👀 in chat
                          </span>
                        ) : (
                          <span
                            className={cn(
                              'truncate text-xs flex items-center',
                              hasUnread
                                ? 'text-foreground font-semibold'
                                : 'text-muted-foreground'
                            )}
                          >
                            {/* WhatsApp Status Tick if outgoing */}
                            {renderLastMessageStatus(conv.lastMessage, isOtherOnline)}

                            {/* Media icon if media */}
                            {renderMediaPreview(
                              conv.lastMessage?.message_type,
                              conv.lastMessage?.original_filename
                            )}

                            {/* Text preview */}
                            {!['image', 'audio', 'video', 'file'].includes(
                              conv.lastMessage?.message_type || ''
                            ) && (
                              <span className="truncate">
                                {conv.lastMessage?.body?.startsWith('[💌 Note]')
                                  ? '💌 Sent a Little Note'
                                  : conv.lastMessage?.body ||
                                    (conv.lastMessage ? 'Sent a message' : 'Say hello!')}
                              </span>
                            )}
                          </span>
                        )}
                      </div>

                      {/* WhatsApp Unread Counter Badge (Emerald Circle) */}
                      {hasUnread && (
                        <span className="min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
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

        {/* WhatsApp End-to-End Encryption Notice Footer */}
        <div className="shrink-0 py-2 px-3 text-center text-[10px] text-muted-foreground/60 flex items-center justify-center gap-1.5 border-t border-border/30 bg-muted/20">
          <Lock className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>Your personal messages are end-to-end encrypted</span>
        </div>

        {/* User Profile Footer */}
        <div className="shrink-0 p-3 border-t border-border/60 bg-card/60 flex items-center justify-between gap-1 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
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
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-mono truncate">
                <span className="text-[#0C3B2E] dark:text-emerald-400 font-semibold">{myUsername || '@user'}</span>
              </div>
            </div>
          </Link>

          <button
            type="button"
            onClick={handleCopyUsername}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0 cursor-pointer"
            title="Copy your @username"
            aria-label="Copy Username"
          >
            {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          <div className="flex items-center shrink-0">
            <Link
              href="/settings"
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

      <CallModal
        isOpen={isCallModalOpen}
        onClose={() => setIsCallModalOpen(false)}
        partnerName={selectedCallPartner?.display_name || 'Partner'}
        partnerAvatar={selectedCallPartner?.avatar_path}
        partnerUsername={selectedCallPartner?.username}
        initialCallType="voice"
      />
    </>
  );
}
