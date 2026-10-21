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
  Copy,
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
  X,
  Bell,
  Lock,
  Unlock,
  ChevronRight,
  Phone,
  Trash2,
  Loader2,
  RotateCw,
  ArrowDownLeft,
  ArrowUpRight,
  PhoneOff,
  Plus,
  Users,
} from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { useChat } from '@/context/chat-context';
import { useChatLock } from '@/context/chat-lock-context';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { BrandLogo, VibelyEmblem } from '@/components/ui/brand-logo';
import { InviteModal } from './invite-modal';
import { AvatarPickerModal } from './avatar-picker-modal';
import { CreateGroupModal } from './create-group-modal';
import { NotificationBell } from './notification-bar';
import { NotificationPermissionBanner } from './notification-permission-banner';
import { formatConversationTime, cn } from '@/lib/utils';
import { useRomanticFeatures } from '@/lib/romantic-features';
import { useCall } from '@/context/call-context';
import { toast } from '@/components/ui/toast';
import { formatCallTime, formatCallDuration } from '@/lib/call-history';

export function Sidebar() {
  const { profile, signOut, isConfigured, refreshProfile } = useAuth();
  const {
    conversations,
    activeConversationId,
    setActiveConversationId,
    friendPresence,
    isUserOnline,
    incomingRequests,
    respondToRequest,
    typingUsers,
    markConversationAsRead,
    partnerActivity,
    deleteFriend,
    refreshConversations,
    refreshRequests,
  } = useChat();
  const router = useRouter();

  const { daysTogether, favorites } = useRomanticFeatures();
  const { startCall, callHistory, clearCallHistory, deleteCallLog, markCallHistoryAsRead } = useCall();
  const {
    lockedConversationIds,
    isUnlocked,
    hasPasscode,
    unlockSession,
    openUnlockModal,
    lockSession,
    toggleLockChat,
    unlockChatPermanently,
  } = useChatLock();
  const [isInviteOpen, setIsInviteOpen] = React.useState(false);
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = React.useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = React.useState(false);
  const [filterText, setFilterText] = React.useState('');
  const [filterTab, setFilterTab] = React.useState<'all' | 'unread' | 'favorites' | 'calls'>('all');
  const [callSubTab, setCallSubTab] = React.useState<'all' | 'missed'>('all');
  const [isNewCallOpen, setIsNewCallOpen] = React.useState(false);
  const [isClearHistoryConfirmOpen, setIsClearHistoryConfirmOpen] = React.useState(false);
  const [copiedId, setCopiedId] = React.useState(false);
  const [confirmDeleteChat, setConfirmDeleteChat] = React.useState<{ friend: any; conversationId: string } | null>(null);
  const [isDeletingChat, setIsDeletingChat] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [pullDistance, setPullDistance] = React.useState(0);

  const touchStartY = React.useRef(0);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  // Stealth Logo Touch & Long-Press Detection
  const logoPressTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleLogoTouchStart = React.useCallback(() => {
    logoPressTimerRef.current = setTimeout(() => {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate(25); } catch {}
      }
      openUnlockModal();
    }, 450);
  }, [openUnlockModal]);

  const handleLogoTouchEnd = React.useCallback(() => {
    if (logoPressTimerRef.current) {
      clearTimeout(logoPressTimerRef.current);
      logoPressTimerRef.current = null;
    }
  }, []);

  const handleLogoClick = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (lockedConversationIds.length > 0) {
      if (isUnlocked) {
        lockSession();
      } else {
        openUnlockModal();
      }
    } else {
      setActiveConversationId(null);
    }
  }, [lockedConversationIds.length, isUnlocked, lockSession, openUnlockModal, setActiveConversationId]);

  const handleManualRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await Promise.allSettled([
        refreshConversations(),
        refreshRequests(),
        refreshProfile?.(),
      ]);
    } finally {
      setTimeout(() => setIsRefreshing(false), 450);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (scrollContainerRef.current && scrollContainerRef.current.scrollTop <= 0) {
      touchStartY.current = e.touches[0].clientY;
    } else {
      touchStartY.current = 0;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartY.current) return;
    if (scrollContainerRef.current && scrollContainerRef.current.scrollTop > 0) return;

    const currentY = e.touches[0].clientY;
    const diff = currentY - touchStartY.current;

    if (diff > 0) {
      const distance = Math.min(diff * 0.45, 80);
      setPullDistance(distance);
    } else {
      setPullDistance(0);
    }
  };

  const handleTouchEnd = async () => {
    if (pullDistance >= 50) {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate(15); } catch {}
      }
      setPullDistance(46);
      setIsRefreshing(true);
      try {
        await Promise.allSettled([
          refreshConversations(),
          refreshRequests(),
          refreshProfile?.(),
        ]);
      } finally {
        setTimeout(() => {
          setPullDistance(0);
          setIsRefreshing(false);
        }, 450);
      }
    } else {
      setPullDistance(0);
    }
    touchStartY.current = 0;
  };

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
    // Never show direct chats where partner was deleted from the database
    if (c.type === 'direct' && (!c.otherUser || !c.otherUser.id)) return false;
    // For group chats, ensure group has members
    if (c.type === 'group' && (!c.members || c.members.length === 0)) return false;
    if (filterTab === 'unread' && c.unreadCount <= 0) return false;
    if (filterTab === 'favorites' && c.lastMessage && !favorites.includes(c.lastMessage.id)) {
      return false;
    }
    if (!filterText) return true;
    const q = filterText.toLowerCase();
    if (c.type === 'group') {
      const gName = c.name?.toLowerCase() || '';
      const memberNames = c.members?.map(m => m.profile?.display_name?.toLowerCase()).filter(Boolean).join(' ') || '';
      return gName.includes(q) || memberNames.includes(q);
    }
    const name = c.otherUser?.display_name?.toLowerCase() || '';
    const user = c.otherUser?.username?.toLowerCase() || '';
    return name.includes(q) || user.includes(q);
  });

  const regularConversations = React.useMemo(() => {
    return filteredConversations.filter(c => !lockedConversationIds.includes(c.id));
  }, [filteredConversations, lockedConversationIds]);

  const lockedConversations = React.useMemo(() => {
    return filteredConversations.filter(c => lockedConversationIds.includes(c.id));
  }, [filteredConversations, lockedConversationIds]);

  const unreadMissedCallsCount = React.useMemo(() => {
    return callHistory.filter(
      c =>
        c.direction === 'incoming' &&
        (c.status === 'missed' || c.status === 'declined') &&
        !c.isRead
    ).length;
  }, [callHistory]);

  // When user opens/views the calls tab, clear missed call notification badges immediately
  React.useEffect(() => {
    if (filterTab === 'calls' && unreadMissedCallsCount > 0) {
      markCallHistoryAsRead();
    }
  }, [filterTab, unreadMissedCallsCount, markCallHistoryAsRead]);

  const filteredCalls = React.useMemo(() => {
    return callHistory.filter(call => {
      // Must have valid partner with id and name
      if (!call.partner?.id || !call.partner?.display_name) return false;
      if (callSubTab === 'missed') {
        const isMissed = call.direction === 'incoming' && (call.status === 'missed' || call.status === 'declined');
        if (!isMissed) return false;
      }
      if (filterText.trim()) {
        const q = filterText.toLowerCase();
        const nameMatch = call.partner?.display_name?.toLowerCase().includes(q);
        const userMatch = call.partner?.username?.toLowerCase().includes(q);
        return Boolean(nameMatch || userMatch);
      }
      return true;
    });
  }, [callHistory, callSubTab, filterText]);

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
      <aside className="w-full md:w-80 lg:w-92 flex flex-col h-full max-h-[100dvh] bg-sidebar-bg border-r border-border/70 select-none overflow-hidden">
        {/* Brand Header */}
        <div className="shrink-0 p-3.5 sm:p-4 border-b border-border/50 flex flex-col gap-2 pt-[max(env(safe-area-inset-top),0.875rem)]">
          <div className="flex items-center justify-between">
            <div
              onTouchStart={handleLogoTouchStart}
              onTouchEnd={handleLogoTouchEnd}
              onTouchMove={handleLogoTouchEnd}
              onContextMenu={(e) => {
                e.preventDefault();
                openUnlockModal();
              }}
              className="cursor-pointer select-none"
              title="Vibely Space"
            >
              <BrandLogo
                size="md"
                href="/chat"
                onClick={handleLogoClick}
              />
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="p-2.5 md:p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95 transition-all cursor-pointer"
                title="Refresh chats"
                aria-label="Refresh chats"
              >
                <RotateCw className={cn("w-4 h-4 md:w-3.5 md:h-3.5", isRefreshing && "animate-spin text-emerald-600 dark:text-emerald-400")} />
              </button>

              <NotificationBell onOpenConnect={() => setIsInviteOpen(true)} className="p-2.5 md:p-2" />

              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsCreateGroupOpen(true)}
                className="h-9 md:h-8 px-2.5 md:px-2 rounded-xl text-xs font-bold gap-1 border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 active:scale-95 transition-all cursor-pointer"
                title="Create Group Chat"
              >
                <Users className="w-4 h-4 md:w-3.5 md:h-3.5" />
                <span className="hidden sm:inline">Group</span>
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsInviteOpen(true)}
                className="h-9 md:h-8 px-3 md:px-2.5 rounded-xl text-xs font-bold gap-1 border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 active:scale-95 transition-all cursor-pointer"
                title="Connect partner"
              >
                <UserPlus className="w-4 h-4 md:w-3.5 md:h-3.5" />
                <span>Connect</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Vibely Branded Search Input */}
        <div className="shrink-0 px-3.5 sm:px-3 pt-2.5 pb-2 space-y-2">
          <div className="relative flex items-center group">
            <div className="absolute left-3 flex items-center gap-1.5 pointer-events-none select-none z-10">
              <VibelyEmblem size="xs" />
              <Search className="w-4 h-4 md:w-3.5 md:h-3.5 text-muted-foreground/70 group-focus-within:text-emerald-600 dark:group-focus-within:text-emerald-400 transition-colors" />
            </div>
            <input
              type="text"
              value={filterText}
              onChange={async (e) => {
                const val = e.target.value;
                setFilterText(val);
                // Stealth passcode entry directly in search bar
                if (val.length === 4 && /^\d{4}$/.test(val) && hasPasscode && !isUnlocked) {
                  const res = await unlockSession(val);
                  if (res.success) {
                    setFilterText('');
                    toast.success('Stealth chats unlocked! 🔓');
                  }
                }
              }}
              placeholder="Search Vibely or start new chat"
              className="w-full pl-[3.85rem] pr-8 py-2.5 md:py-2 rounded-xl text-sm md:text-xs bg-muted/60 hover:bg-muted/80 focus:bg-background border border-border/60 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 placeholder:text-muted-foreground transition-all shadow-xs"
            />
            {filterText && (
              <button
                onClick={() => setFilterText('')}
                className="absolute right-2.5 text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-muted transition-colors cursor-pointer"
                title="Clear search"
              >
                <X className="w-4 h-4 md:w-3.5 md:h-3.5" />
              </button>
            )}
          </div>

          {/* WhatsApp Filter Tabs: All, Unread, Favourites */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
            <button
              onClick={() => setFilterTab('all')}
              className={cn(
                'px-3.5 py-1.5 md:px-3 md:py-1 rounded-full text-xs md:text-[11px] font-semibold transition-colors cursor-pointer shrink-0',
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
                'px-3.5 py-1.5 md:px-3 md:py-1 rounded-full text-xs md:text-[11px] font-semibold transition-colors cursor-pointer shrink-0',
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
                'px-3.5 py-1.5 md:px-3 md:py-1 rounded-full text-xs md:text-[11px] font-semibold transition-colors cursor-pointer shrink-0',
                filterTab === 'favorites'
                  ? 'bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              )}
            >
              Favourites
            </button>

            {/* Calls Tab Button */}
            <button
              onClick={() => {
                setFilterTab('calls');
                markCallHistoryAsRead();
              }}
              className={cn(
                'px-3.5 py-1.5 md:px-3 md:py-1 rounded-full text-xs md:text-[11px] font-semibold transition-colors cursor-pointer flex items-center gap-1.5 shrink-0',
                filterTab === 'calls'
                  ? 'bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 font-bold shadow-2xs'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              )}
              title="Call History"
            >
              <Phone className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Calls</span>
              {unreadMissedCallsCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center animate-pulse">
                  {unreadMissedCallsCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Real-time calling & notification permission prompt */}
        <NotificationPermissionBanner compact />

        {/* Conversations List (WhatsApp Chat Feed with Touch Pull-to-Refresh) */}
        <div
          ref={scrollContainerRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="flex-1 overflow-y-auto overscroll-y-auto touch-pan-y divide-y divide-border/30 relative"
        >
          {/* Mobile Pull-to-Refresh Banner */}
          {(pullDistance > 0 || isRefreshing) && (
            <div
              style={{ height: isRefreshing ? 44 : pullDistance }}
              className="flex items-center justify-center overflow-hidden transition-all duration-150 bg-emerald-500/10 border-b border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-400 gap-2 shrink-0 select-none"
            >
              <RotateCw
                className={cn(
                  'w-3.5 h-3.5 transition-transform duration-200',
                  isRefreshing ? 'animate-spin' : pullDistance >= 50 ? 'rotate-180' : ''
                )}
              />
              <span className="font-medium text-[11px]">
                {isRefreshing
                  ? 'Refreshing...'
                  : pullDistance >= 50
                  ? 'Release to refresh'
                  : 'Pull down to refresh'}
              </span>
            </div>
          )}
          {/* Pending Connection Requests Banner in Sidebar */}
          {incomingRequests.length > 0 && (
            <div className="p-2.5 space-y-2 bg-card/60">
              <div className="flex items-center justify-between px-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <span className="flex items-center gap-1.5">
                  <Bell className="w-3.5 h-3.5 text-rose-500 animate-bounce" />
                  Connection Requests ({incomingRequests.length})
                </span>
              </div>

              {incomingRequests.map(req => {
                const usernameText = req.sender.username ? `@${req.sender.username}` : '';
                return (
                  <div
                    key={req.id}
                    className="p-3 rounded-2xl bg-card border border-emerald-500/25 space-y-2.5 shadow-xs"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar
                        src={req.sender.avatar_path || undefined}
                        name={req.sender.display_name}
                        size="md"
                        className="w-11 h-11 md:w-8 md:h-8 text-sm md:text-xs shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm md:text-xs font-bold text-foreground truncate">
                          {req.sender.display_name}
                        </p>
                        <p className="text-xs md:text-[10px] text-muted-foreground font-mono truncate">
                          {usernameText}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-0.5">
                      <Button
                        size="sm"
                        onClick={() => respondToRequest(req.id, 'accept')}
                        className="flex-1 h-8 md:h-7 rounded-xl text-xs md:text-[11px] gap-1.5 font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer active:scale-95"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Accept</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => respondToRequest(req.id, 'decline')}
                        className="h-8 md:h-7 px-3 md:px-2.5 rounded-xl text-xs md:text-[11px] gap-1 border-border/80 text-muted-foreground hover:text-foreground cursor-pointer active:scale-95"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Decline</span>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {filterTab === 'calls' ? (
            <div className="flex-1 flex flex-col">
              {/* Sub-bar for Calls tab: All / Missed tabs + New Call & Clear buttons */}
              <div className="p-3 md:p-2.5 border-b border-border/40 flex items-center justify-between gap-2 bg-muted/20">
                <div className="flex items-center gap-2 md:gap-1.5">
                  <button
                    onClick={() => setCallSubTab('all')}
                    className={cn(
                      'px-3 py-1 md:px-2.5 md:py-0.5 rounded-full text-xs md:text-[11px] font-semibold transition-colors cursor-pointer',
                      callSubTab === 'all'
                        ? 'bg-emerald-600/20 text-emerald-700 dark:text-emerald-400 font-bold border border-emerald-500/30'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    All
                  </button>
                  <button
                    onClick={() => {
                      setCallSubTab('missed');
                      markCallHistoryAsRead();
                    }}
                    className={cn(
                      'px-3 py-1 md:px-2.5 md:py-0.5 rounded-full text-xs md:text-[11px] font-semibold transition-colors cursor-pointer flex items-center gap-1',
                      callSubTab === 'missed'
                        ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 font-bold border border-rose-500/30'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <span>Missed</span>
                    {unreadMissedCallsCount > 0 && (
                      <span className="w-4 h-4 md:w-3.5 md:h-3.5 rounded-full bg-rose-500 text-white text-[9px] md:text-[8px] font-bold flex items-center justify-center">
                        {unreadMissedCallsCount}
                      </span>
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-2 md:gap-1.5">
                  <Button
                    size="sm"
                    onClick={() => setIsNewCallOpen(true)}
                    className="h-8 md:h-7 px-3 md:px-2.5 rounded-xl text-xs md:text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs gap-1.5 cursor-pointer active:scale-95"
                    title="Start a new call"
                  >
                    <Plus className="w-3.5 h-3.5 md:w-3 md:h-3" />
                    <span>New Call</span>
                  </Button>

                  {callHistory.length > 0 && (
                    <button
                      onClick={() => setIsClearHistoryConfirmOpen(true)}
                      className="p-2 md:p-1.5 rounded-xl text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                      title="Clear call history"
                    >
                      <Trash2 className="w-4 h-4 md:w-3.5 md:h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Calls List */}
              {filteredCalls.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground space-y-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
                    <Phone className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">
                      {callSubTab === 'missed' ? 'No missed calls' : 'No call history yet'}
                    </p>
                    <p className="text-xs text-muted-foreground max-w-[220px] mx-auto">
                      {callSubTab === 'missed'
                        ? 'All incoming calls have been answered.'
                        : 'Calls you make or receive with your partner will be recorded here.'}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setIsNewCallOpen(true)}
                    className="mt-2 text-xs rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs gap-1.5 cursor-pointer"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Start a Call</span>
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-border/30">
                  {filteredCalls.map(item => {
                    const isIncoming = item.direction === 'incoming';
                    const isMissed = item.status === 'missed' || item.status === 'declined';
                    const isVideo = item.callType === 'video';

                    return (
                      <div
                        key={item.id}
                        onClick={() => {
                          if (item.conversationId) {
                            setActiveConversationId(item.conversationId);
                          } else {
                            const targetConv = conversations.find(c => c.otherUser?.id === item.partner?.id);
                            if (targetConv) setActiveConversationId(targetConv.id);
                          }
                        }}
                        className="flex items-center gap-3.5 px-4 py-3.5 md:px-3.5 md:py-3 hover:bg-muted/40 transition-colors cursor-pointer group relative"
                      >
                        {/* Partner Avatar */}
                        <Avatar
                          src={item.partner?.avatar_path || undefined}
                          name={item.partner?.display_name || 'User'}
                          size="md"
                          isOnline={item.partner?.id ? isUserOnline(item.partner.id) : false}
                          className="w-12 h-12 md:w-10 md:h-10 text-base md:text-sm shrink-0"
                        />

                        {/* Call Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <h4
                              className={cn(
                                'text-base md:text-sm font-bold md:font-semibold truncate',
                                isMissed ? 'text-rose-500 dark:text-rose-400 font-extrabold' : 'text-foreground'
                              )}
                            >
                              {item.partner?.display_name || 'User'}
                            </h4>
                            <span className="text-xs md:text-[11px] text-muted-foreground shrink-0 font-medium">
                              {formatCallTime(item.startedAt)}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            {/* Direction Arrow */}
                            {isIncoming ? (
                              isMissed ? (
                                <ArrowDownLeft className="w-4 h-4 md:w-3.5 md:h-3.5 text-rose-500 shrink-0 stroke-[2.5]" />
                              ) : (
                                <ArrowDownLeft className="w-4 h-4 md:w-3.5 md:h-3.5 text-emerald-500 shrink-0 stroke-[2.5]" />
                              )
                            ) : (
                              <ArrowUpRight
                                className={cn(
                                  'w-4 h-4 md:w-3.5 md:h-3.5 shrink-0 stroke-[2.5]',
                                  item.status === 'connected' ? 'text-emerald-500' : 'text-muted-foreground'
                                )}
                              />
                            )}

                            {/* Call Type Icon */}
                            {isVideo ? (
                              <Video className="w-3.5 h-3.5 md:w-3 md:h-3 text-muted-foreground shrink-0" />
                            ) : (
                              <Phone className="w-3.5 h-3.5 md:w-3 md:h-3 text-muted-foreground shrink-0" />
                            )}

                            {/* Status or Duration text */}
                            <span className={cn('truncate text-[13px] md:text-xs', isMissed && 'text-rose-500 font-semibold')}>
                              {isMissed
                                ? item.status === 'declined'
                                  ? 'Declined'
                                  : 'Missed'
                                : item.status === 'connected' && item.duration > 0
                                ? `${isIncoming ? 'Incoming' : 'Outgoing'} (${formatCallDuration(item.duration)})`
                                : item.status === 'unavailable'
                                ? 'Unavailable'
                                : `${isIncoming ? 'Incoming' : 'Outgoing'}`}
                            </span>
                          </div>
                        </div>

                        {/* Direct Call & Delete Actions */}
                        <div className="flex items-center gap-2 md:gap-1 shrink-0 ml-1">
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              startCall(item.partner, 'voice', item.conversationId);
                            }}
                            className="w-10 h-10 md:w-8 md:h-8 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-xs"
                            title="Voice Call"
                          >
                            <Phone className="w-4.5 h-4.5 md:w-3.5 md:h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              startCall(item.partner, 'video', item.conversationId);
                            }}
                            className="w-10 h-10 md:w-8 md:h-8 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-xs"
                            title="Video Call"
                          >
                            <Video className="w-4.5 h-4.5 md:w-3.5 md:h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              deleteCallLog(item.id);
                            }}
                            className="w-8 h-8 md:w-7 md:h-7 rounded-full text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 flex items-center justify-center opacity-70 md:opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                            title="Delete from call history"
                          >
                            <X className="w-4 h-4 md:w-3.5 md:h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Stealth Locked Chats section - ONLY visible when owner has unlocked via secret touch */}
              {isUnlocked && lockedConversations.length > 0 && (
                <div className="border-b border-border/40 bg-card/40 animate-in fade-in duration-200">
                  <div
                    onClick={lockSession}
                    className="flex items-center justify-between px-4 py-2.5 md:px-3.5 md:py-2 cursor-pointer hover:bg-muted/40 transition-colors group select-none bg-emerald-500/10 border-b border-emerald-500/20"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                        <Lock className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          <span>Unlocked Chats</span>
                          <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                            {lockedConversations.length}
                          </span>
                        </h4>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        lockSession();
                      }}
                      className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95 transition-all cursor-pointer"
                    >
                      Hide & Lock
                    </button>
                  </div>

                  {/* Show the unlocked conversations */}
                  <div className="divide-y divide-border/20 border-t border-border/30 bg-emerald-950/5 dark:bg-emerald-950/20">
                      {lockedConversations.map(conv => {
                        const other = conv.otherUser;
                        const isActive = conv.id === activeConversationId;
                        const isOtherOnline = other?.id ? isUserOnline(other.id) : (other?.id === friendPresence.userId ? friendPresence.online : false);
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
                              'flex items-center gap-3.5 px-4 py-3.5 md:px-3.5 md:py-3 cursor-pointer transition-all duration-150 relative group',
                              isActive
                                ? 'bg-muted/80 dark:bg-card/90 shadow-2xs'
                                : 'hover:bg-muted/40'
                            )}
                          >
                            {isActive && (
                              <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-600 dark:bg-emerald-500" />
                            )}
                            <Avatar
                              src={other?.avatar_path}
                              name={other?.display_name || 'Partner'}
                              size="md"
                              isOnline={isOtherOnline}
                              className="w-12 h-12 md:w-10 md:h-10 text-base md:text-sm shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <h4
                                  className={cn(
                                    'text-base md:text-sm font-bold md:font-semibold truncate text-foreground flex items-center gap-1.5',
                                    hasUnread && 'font-extrabold'
                                  )}
                                >
                                  <span className="truncate">{other?.display_name || 'Partner'}</span>
                                  <span className="inline-flex items-center text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 px-1.5 py-0.2 rounded-md shrink-0">
                                    <Lock className="w-2.5 h-2.5 mr-0.5 inline" />
                                    Locked
                                  </span>
                                </h4>
                                {lastTime && (
                                  <span
                                    className={cn(
                                      'text-xs md:text-[11px] shrink-0 font-medium',
                                      hasUnread
                                        ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                                        : 'text-muted-foreground'
                                    )}
                                  >
                                    {formatConversationTime(lastTime)}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center justify-between gap-2 text-xs">
                                <div className="truncate flex items-center min-w-0 max-w-[210px] sm:max-w-[230px]">
                                  {isOtherOnline && (isPartnerTyping || (isActive && partnerActivity?.activity === 'typing')) ? (
                                    <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[13px] md:text-xs flex items-center gap-1 animate-pulse">
                                      typing...
                                    </span>
                                  ) : isOtherOnline && isActive && partnerActivity?.activity === 'viewing_image' ? (
                                    <span className="text-purple-600 dark:text-purple-400 font-semibold text-[13px] md:text-xs flex items-center gap-1 animate-pulse">
                                      📸 viewing photo...
                                    </span>
                                  ) : isOtherOnline && isActive && partnerActivity?.activity === 'in_chat' ? (
                                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-[13px] md:text-xs flex items-center gap-1">
                                      👀 in chat
                                    </span>
                                  ) : (
                                    <span
                                      className={cn(
                                        'truncate text-[13px] md:text-xs flex items-center',
                                        hasUnread
                                          ? 'text-foreground font-semibold'
                                          : 'text-muted-foreground'
                                      )}
                                    >
                                      {renderLastMessageStatus(conv.lastMessage, isOtherOnline)}
                                      {renderMediaPreview(
                                        conv.lastMessage?.message_type,
                                        conv.lastMessage?.original_filename
                                      )}
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
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {hasUnread && (
                                    <span className="min-w-[22px] h-5.5 px-1.5 rounded-full text-xs md:text-[11px] font-bold bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                                      {conv.unreadCount}
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={e => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      unlockChatPermanently(conv.id, other?.display_name);
                                    }}
                                    className="px-2 py-1 rounded-lg text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 bg-emerald-500/10 flex items-center gap-1 cursor-pointer active:scale-95 transition-all"
                                    title={`Unlock chat with ${other?.display_name || 'partner'} and restore to regular chats`}
                                    aria-label={`Unlock chat with ${other?.display_name || 'partner'}`}
                                  >
                                    <Unlock className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                    <span>Unlock</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

              {/* Regular Conversations List */}
              {regularConversations.length === 0 ? (
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
                    className="mt-2 text-xs rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                    Connect Partner
                  </Button>
                </div>
              ) : (
                regularConversations.map(conv => {
                  const isGroup = conv.type === 'group';
                  const other = conv.otherUser;
                  const isActive = conv.id === activeConversationId;
                  const isOtherOnline = other?.id ? isUserOnline(other.id) : (other?.id === friendPresence.userId ? friendPresence.online : false);
                  const isPartnerTyping = typingUsers.some(
                    u => u === other?.display_name || u === other?.username
                  );

                  const groupTitle = conv.name || (conv.members.map(m => m.profile?.display_name).filter(Boolean).join(', ') || 'Group Chat');
                  const chatTitle = isGroup ? groupTitle : (other?.display_name || 'Partner');

                  const lastTime = conv.lastMessage?.created_at || conv.updated_at;
                  const hasUnread = conv.unreadCount > 0;

                  // For group chats: show sender name prefix if incoming
                  const incomingSender = isGroup && conv.lastMessage && conv.lastMessage.sender_id !== profile?.id
                    ? conv.members.find(m => m.user_id === conv.lastMessage?.sender_id)?.profile?.display_name?.split(' ')[0]
                    : null;

                  return (
                    <div
                      key={conv.id}
                      onClick={() => {
                        setActiveConversationId(conv.id);
                        markConversationAsRead(conv.id);
                      }}
                      className={cn(
                        'flex items-center gap-3.5 px-4 py-3.5 md:px-3.5 md:py-3 cursor-pointer transition-all duration-150 relative group',
                        isActive
                          ? 'bg-muted/80 dark:bg-card/90 shadow-2xs'
                          : 'hover:bg-muted/40'
                      )}
                    >
                      {/* Active Left Indicator Bar */}
                      {isActive && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-600 dark:bg-emerald-500" />
                      )}

                      {/* Avatar: Group icon for group chat, Partner Avatar for direct chat */}
                      {isGroup ? (
                        <div className="w-12 h-12 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center shrink-0 shadow-xs ring-2 ring-emerald-500/20">
                          <Users className="w-5 h-5 md:w-4 md:h-4" />
                        </div>
                      ) : (
                        <Avatar
                          src={other?.avatar_path}
                          name={other?.display_name || 'Partner'}
                          size="md"
                          isOnline={isOtherOnline}
                          className="w-12 h-12 md:w-10 md:h-10 text-base md:text-sm shrink-0"
                        />
                      )}

                      {/* WhatsApp Content Details */}
                      <div className="flex-1 min-w-0">
                        {/* Top Row: Partner / Group Name + WhatsApp Timestamp */}
                        <div className="flex items-center justify-between mb-1">
                          <h4
                            className={cn(
                              'text-base md:text-sm font-bold md:font-semibold truncate text-foreground flex items-center gap-1.5',
                              hasUnread && 'font-extrabold'
                            )}
                          >
                            <span className="truncate">{chatTitle}</span>
                            {isGroup && (
                              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded-md shrink-0">
                                {conv.members.length} members
                              </span>
                            )}
                          </h4>

                          {lastTime && (
                            <span
                              className={cn(
                                'text-xs md:text-[11px] shrink-0 font-medium',
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
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <div className="truncate flex items-center min-w-0 max-w-[210px] sm:max-w-[230px]">
                            {isOtherOnline && (isPartnerTyping || (isActive && partnerActivity?.activity === 'typing')) ? (
                              <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[13px] md:text-xs flex items-center gap-1 animate-pulse">
                                typing...
                              </span>
                            ) : isOtherOnline && isActive && partnerActivity?.activity === 'viewing_image' ? (
                              <span className="text-purple-600 dark:text-purple-400 font-semibold text-[13px] md:text-xs flex items-center gap-1 animate-pulse">
                                📸 viewing photo...
                              </span>
                            ) : isOtherOnline && isActive && partnerActivity?.activity === 'in_chat' ? (
                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-[13px] md:text-xs flex items-center gap-1">
                                👀 in chat
                              </span>
                            ) : (
                              <span
                                className={cn(
                                  'truncate text-[13px] md:text-xs flex items-center',
                                  hasUnread
                                    ? 'text-foreground font-semibold'
                                    : 'text-muted-foreground'
                                )}
                              >
                                {/* WhatsApp Status Tick if outgoing */}
                                {renderLastMessageStatus(conv.lastMessage, isOtherOnline)}

                                {/* Incoming group message sender prefix */}
                                {incomingSender && (
                                  <span className="font-semibold text-emerald-600 dark:text-emerald-400 mr-1 shrink-0">
                                    {incomingSender}:
                                  </span>
                                )}

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

                          {/* Badge and Quick Action Buttons */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* WhatsApp Unread Counter Badge (Emerald Circle) */}
                            {hasUnread && (
                              <span className="min-w-[22px] h-5.5 px-1.5 rounded-full text-xs md:text-[11px] font-bold bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                                {conv.unreadCount}
                              </span>
                            )}

                            {/* Chat Lock Button */}
                            <button
                              type="button"
                              onClick={e => {
                                e.preventDefault();
                                e.stopPropagation();
                                toggleLockChat(conv.id, chatTitle);
                              }}
                              className="w-7 h-7 rounded-lg text-muted-foreground/60 hover:text-emerald-600 hover:bg-emerald-500/10 dark:hover:text-emerald-400 opacity-60 sm:opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center cursor-pointer active:scale-95"
                              title={`Lock chat ${chatTitle}`}
                              aria-label={`Lock chat ${chatTitle}`}
                            >
                              <Lock className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </>
          )}
        </div>

        {/* WhatsApp End-to-End Encryption Notice Footer */}
        <div className="shrink-0 py-2 px-3 text-center text-[10px] text-muted-foreground/60 flex items-center justify-center gap-1.5 border-t border-border/30 bg-muted/20">
          <Lock className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>Your personal messages are end-to-end encrypted</span>
        </div>

        {/* User Profile Footer */}
        <div className="shrink-0 p-3 sm:p-3.5 border-t border-border/60 bg-card/60 flex items-center justify-between gap-1 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
          <div
            className="flex items-center gap-3 min-w-0 p-1 flex-1 select-none"
          >
            <div
              onClick={() => setIsAvatarPickerOpen(true)}
              className="relative group cursor-pointer shrink-0 rounded-full overflow-hidden"
              title="Change profile photo"
            >
              <Avatar
                src={profile?.avatar_path}
                name={profile?.display_name || 'Me'}
                size="md"
                className="w-11 h-11 md:w-8 md:h-8 ring-1 ring-border/50 group-hover:ring-emerald-500/60 transition-all rounded-full text-sm md:text-xs"
              />
              <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                <Camera className="w-3.5 h-3.5 md:w-2.5 md:h-2.5" />
              </div>
            </div>
            <div className="min-w-0 text-left">
              <p className="text-sm md:text-xs font-bold md:font-semibold truncate text-foreground leading-tight">
                {profile?.display_name || 'My Profile'}
              </p>
              <div className="flex items-center gap-1 text-xs md:text-[11px] text-muted-foreground font-mono truncate mt-0.5">
                <span className="text-[#0C3B2E] dark:text-emerald-400 font-bold">{myUsername || '@user'}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCopyUsername}
            className="w-10 h-10 md:w-8 md:h-8 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95 transition-all shrink-0 cursor-pointer"
            title="Copy your @username"
            aria-label="Copy Username"
          >
            {copiedId ? <Check className="w-4.5 h-4.5 md:w-3.5 md:h-3.5 text-emerald-500" /> : <Copy className="w-4.5 h-4.5 md:w-3.5 md:h-3.5" />}
          </button>

          <div className="flex items-center shrink-0">
            <Link
              href="/settings"
              className="w-10 h-10 md:w-8 md:h-8 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95 transition-all"
              title="Settings & Preferences"
              aria-label="Settings"
            >
              <Settings className="w-5 h-5 md:w-4 md:h-4" />
            </Link>
          </div>
        </div>
      </aside>

      {/* Delete Chat Confirmation Dialog */}
      <Dialog
        isOpen={!!confirmDeleteChat}
        onClose={() => !isDeletingChat && setConfirmDeleteChat(null)}
        title="Delete Chat"
        size="sm"
      >
        <div className="space-y-4 pt-1">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
            <div className="w-10 h-10 rounded-full bg-destructive/20 text-destructive flex items-center justify-center shrink-0">
              <Trash2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">
                {confirmDeleteChat?.friend?.display_name || 'Partner'}
              </p>
              <p className="text-xs text-muted-foreground font-mono truncate">
                {confirmDeleteChat?.friend?.username ? `@${confirmDeleteChat.friend.username}` : ''}
              </p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            Are you sure you want to delete this chat with <strong className="text-foreground">{confirmDeleteChat?.friend?.display_name || 'this partner'}</strong>? This will delete all messages and disconnect your partner.
          </p>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
            <Button
              variant="outline"
              size="sm"
              disabled={isDeletingChat}
              onClick={() => setConfirmDeleteChat(null)}
              className="text-xs rounded-xl cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={isDeletingChat}
              onClick={async () => {
                if (!confirmDeleteChat) return;
                setIsDeletingChat(true);
                try {
                  await deleteFriend(confirmDeleteChat.friend.id, confirmDeleteChat.conversationId);
                  setConfirmDeleteChat(null);
                  // Intentionally NO success toast per user instruction
                } catch {
                  // Silent
                } finally {
                  setIsDeletingChat(false);
                }
              }}
              className="text-xs rounded-xl gap-1.5 bg-rose-600 hover:bg-rose-700 text-white cursor-pointer font-medium"
            >
              {isDeletingChat ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
              <span>Delete Chat</span>
            </Button>
          </div>
        </div>
      </Dialog>

      {/* New Call Dialog */}
      <Dialog
        isOpen={isNewCallOpen}
        onClose={() => setIsNewCallOpen(false)}
        title="Start a New Call"
        size="sm"
      >
        <div className="space-y-3 pt-1">
          <p className="text-xs text-muted-foreground">
            Select a connected partner to start a voice or video call.
          </p>

          <div className="max-h-64 overflow-y-auto divide-y divide-border/30 rounded-xl border border-border/40">
            {conversations.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">
                No connected contacts yet. Connect a partner first!
              </div>
            ) : (
              conversations.map(conv => {
                const partner = conv.otherUser;
                if (!partner) return null;
                const isOnline = isUserOnline(partner.id);

                return (
                  <div
                    key={conv.id}
                    className="flex items-center justify-between p-3 hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar
                        src={partner.avatar_path || undefined}
                        name={partner.display_name}
                        size="sm"
                        isOnline={isOnline}
                      />
                      <div className="min-w-0 truncate">
                        <p className="text-xs font-semibold text-foreground truncate">
                          {partner.display_name}
                        </p>
                        {partner.username && (
                          <p className="text-[10px] text-muted-foreground font-mono truncate">
                            @{partner.username}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setIsNewCallOpen(false);
                          startCall(partner, 'voice', conv.id);
                        }}
                        className="h-8 px-2.5 rounded-xl text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/15 gap-1 text-xs cursor-pointer"
                        title="Voice Call"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>Voice</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setIsNewCallOpen(false);
                          startCall(partner, 'video', conv.id);
                        }}
                        className="h-8 px-2.5 rounded-xl text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/15 gap-1 text-xs cursor-pointer"
                        title="Video Call"
                      >
                        <Video className="w-3.5 h-3.5" />
                        <span>Video</span>
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Dialog>

      {/* Clear Call History Confirmation Dialog */}
      <Dialog
        isOpen={isClearHistoryConfirmOpen}
        onClose={() => setIsClearHistoryConfirmOpen(false)}
        title="Clear Call History"
        size="sm"
      >
        <div className="space-y-4 pt-1">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
            <div className="w-10 h-10 rounded-full bg-destructive/20 text-destructive flex items-center justify-center shrink-0">
              <Trash2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">
                Clear all call logs
              </p>
              <p className="text-xs text-muted-foreground">
                This will delete your entire call history permanently from this device.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsClearHistoryConfirmOpen(false)}
              className="text-xs rounded-xl cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                clearCallHistory();
                setIsClearHistoryConfirmOpen(false);
              }}
              className="text-xs rounded-xl gap-1.5 bg-rose-600 hover:bg-rose-700 text-white cursor-pointer font-medium"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear All</span>
            </Button>
          </div>
        </div>
      </Dialog>

      <InviteModal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
      />

      <CreateGroupModal
        isOpen={isCreateGroupOpen}
        onClose={() => setIsCreateGroupOpen(false)}
      />

      <AvatarPickerModal
        isOpen={isAvatarPickerOpen}
        onClose={() => setIsAvatarPickerOpen(false)}
      />
    </>
  );
}
