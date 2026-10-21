'use client';

import * as React from 'react';
import {
  ArrowLeft,
  Search,
  FolderHeart,
  ShieldCheck,
  X,
  Heart,
  CalendarHeart,
  Sparkles,
  UserMinus,
  Trash2,
  Loader2,
  Phone,
  Video,
  MoreVertical,
  RotateCw,
  Copy,
  CheckSquare,
  Forward,
  Lock,
  Unlock,
  Users,
} from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { useChat } from '@/context/chat-context';
import { useChatLock } from '@/context/chat-lock-context';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { formatLastSeen } from '@/lib/utils';
import { toast } from '@/components/ui/toast';
import { useRomanticFeatures } from '@/lib/romantic-features';
import { Dialog } from '@/components/ui/dialog';
import { ForwardModal } from './forward-modal';
import { GroupDetailsModal } from './group-details-modal';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCall } from '@/context/call-context';
import { VibelyEmblem } from '@/components/ui/brand-logo';

export function ConversationHeader() {
  const { profile } = useAuth();
  const {
    activeConversation,
    setActiveConversationId,
    friendPresence,
    isUserOnline,
    isSearching,
    setIsSearching,
    searchQuery,
    setSearchQuery,
    isMediaDrawerOpen,
    setIsMediaDrawerOpen,
    typingUsers,
    deleteFriend,
    partnerActivity,
    refreshConversations,
    messages,
    selectedMessageIds,
    isSelectMode,
    clearSelectedMessages,
    selectAllMessages,
    deleteMessages,
  } = useChat();

  const { startCall } = useCall();
  const { anniversary, daysTogether, updateAnniversary } = useRomanticFeatures();
  const { isChatLocked, toggleLockChat } = useChatLock();
  const router = useRouter();
  const isCurrentLocked = activeConversation ? isChatLocked(activeConversation.id) : false;
  const [isContactInfoOpen, setIsContactInfoOpen] = React.useState(false);
  const [isDateDialogOpen, setIsDateDialogOpen] = React.useState(false);
  const [selectedDate, setSelectedDate] = React.useState(anniversary || '');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState(false);
  const [isDeletingFriend, setIsDeletingFriend] = React.useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = React.useState(false);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = React.useState(false);
  const [isDeletingMessages, setIsDeletingMessages] = React.useState(false);
  const [isForwardModalOpen, setIsForwardModalOpen] = React.useState(false);
  const [isGroupDetailsOpen, setIsGroupDetailsOpen] = React.useState(false);

  // Stealth Chat Lock State & Long-Press Gesture Detection
  const [isSecretLockModalOpen, setIsSecretLockModalOpen] = React.useState(false);
  const longPressTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const isLongPressTriggered = React.useRef(false);

  const isGroup = activeConversation?.type === 'group';
  const friend = activeConversation?.otherUser;
  const isOnline = friend?.id ? isUserOnline(friend.id) || friendPresence.online : friendPresence.online;

  const groupTitle =
    activeConversation?.name ||
    activeConversation?.members.map(m => m.profile?.display_name).filter(Boolean).join(', ') ||
    'Group Chat';

  const groupOnlineCount = React.useMemo(() => {
    if (!isGroup || !activeConversation) return 0;
    return activeConversation.members.filter(m => isUserOnline(m.user_id)).length;
  }, [isGroup, activeConversation, isUserOnline]);

  const startLongPress = React.useCallback(() => {
    isLongPressTriggered.current = false;
    longPressTimerRef.current = setTimeout(() => {
      isLongPressTriggered.current = true;
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate(25); } catch {}
      }
      setIsSecretLockModalOpen(true);
    }, 450);
  }, []);

  const clearLongPress = React.useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handlePartnerInfoClick = React.useCallback(() => {
    if (isLongPressTriggered.current) {
      isLongPressTriggered.current = false;
      return;
    }
    if (isGroup) {
      setIsGroupDetailsOpen(true);
    } else {
      setIsContactInfoOpen(true);
    }
  }, [isGroup]);

  // Only allow "Delete for everyone" if ALL selected messages were sent by current user and not already deleted
  const canDeleteForEveryone = React.useMemo(() => {
    if (selectedMessageIds.length === 0) return false;
    const selected = messages.filter(m => selectedMessageIds.includes(m.id));
    return (
      selected.length > 0 &&
      selected.every(m => m.sender_id === profile?.id && !m.deleted_at)
    );
  }, [messages, selectedMessageIds, profile?.id]);

  const handleCopySelected = async () => {
    const selectedTexts = messages
      .filter(m => selectedMessageIds.includes(m.id) && m.body && !m.deleted_at)
      .map(m => m.body?.replace(/^\[💌 Note\]\s*/, ''))
      .filter(Boolean);

    if (selectedTexts.length > 0) {
      await navigator.clipboard.writeText(selectedTexts.join('\n'));
      toast.success(`${selectedTexts.length} ${selectedTexts.length === 1 ? 'message' : 'messages'} copied!`);
      clearSelectedMessages();
    } else {
      toast.error('No text in selected messages');
    }
  };

  const handleStartCall = (type: 'voice' | 'video') => {
    if (isGroup) {
      toast.info('Group voice & video calling is coming soon! Use direct chat with a partner for live calls.');
      return;
    }
    if (friend) {
      startCall(friend, type, activeConversation?.id);
    }
  };

  const handleMobileBack = () => {
    setActiveConversationId(null);
    if (typeof window !== 'undefined') {
      if (window.location.pathname.startsWith('/chat/')) {
        router.push('/chat');
      } else if (window.location.hash === '#chat') {
        window.history.back();
      }
    }
  };

  const handleSaveDate = (e: React.FormEvent) => {
    e.preventDefault();
    updateAnniversary(selectedDate || null);
    setIsDateDialogOpen(false);
  };

  const handleDeleteFriend = async () => {
    if (!friend || !activeConversation) return;
    setIsDeletingFriend(true);
    try {
      const res = await deleteFriend(friend.id, activeConversation.id);
      if (res.success) {
        // Intentionally NO success toast per user instruction
        setIsDeleteModalOpen(false);
      } else {
        toast.error(res.error || 'Failed to remove friend');
      }
    } catch {
      toast.error('Network error. Failed to remove friend.');
    } finally {
      setIsDeletingFriend(false);
    }
  };

  return (
    <>
      <div className="shrink-0 flex flex-col border-b border-border/70 bg-card/90 backdrop-blur-md z-10 select-none pt-[max(env(safe-area-inset-top),0.375rem)] pl-[max(env(safe-area-inset-left),0rem)] pr-[max(env(safe-area-inset-right),0rem)]">
        {isSelectMode ? (
          <div className="flex items-center justify-between px-3 sm:px-4 py-2 bg-emerald-600/10 dark:bg-[#182229] border-b border-emerald-500/20 text-foreground animate-in fade-in duration-150">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={clearSelectedMessages}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted active:scale-95 transition-all cursor-pointer text-foreground"
                aria-label="Cancel selection"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-1.5 font-semibold text-sm sm:text-base">
                <span>{selectedMessageIds.length}</span>
                <span className="text-xs text-muted-foreground font-normal">selected</span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleCopySelected}
                className="w-10 h-10 md:w-9 md:h-9 flex items-center justify-center rounded-xl hover:bg-muted text-foreground active:scale-95 transition-all cursor-pointer"
                title="Copy selected text"
                aria-label="Copy selected"
              >
                <Copy className="w-5 h-5 md:w-4 md:h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsForwardModalOpen(true)}
                className="w-10 h-10 md:w-9 md:h-9 flex items-center justify-center rounded-xl text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/15 active:scale-95 transition-all cursor-pointer"
                title="Forward selected"
                aria-label="Forward selected"
              >
                <Forward className="w-5 h-5 md:w-4 md:h-4" />
              </button>
              <button
                type="button"
                onClick={selectAllMessages}
                className="w-10 h-10 md:w-9 md:h-9 flex items-center justify-center rounded-xl hover:bg-muted text-foreground active:scale-95 transition-all cursor-pointer"
                title="Select all"
                aria-label="Select all"
              >
                <CheckSquare className="w-5 h-5 md:w-4 md:h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsBulkDeleteModalOpen(true)}
                className="w-10 h-10 md:w-9 md:h-9 flex items-center justify-center rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-500/15 active:scale-95 transition-all cursor-pointer"
                title="Delete selected"
                aria-label="Delete selected"
              >
                <Trash2 className="w-5 h-5 md:w-4 md:h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between px-2.5 sm:px-4 py-2 sm:py-2.5">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            {/* Mobile Back Button - properly spaced & touch-friendly, no cut off */}
            <button
              type="button"
              onClick={handleMobileBack}
              className="md:hidden w-10 h-10 flex items-center justify-center rounded-full text-foreground/80 hover:text-foreground hover:bg-muted active:scale-95 transition-all cursor-pointer shrink-0"
              aria-label="Back to conversations list"
            >
              <ArrowLeft className="w-6 h-6 shrink-0" />
            </button>

          <div
            onClick={handlePartnerInfoClick}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setIsSecretLockModalOpen(true);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              setIsSecretLockModalOpen(true);
            }}
            onTouchStart={startLongPress}
            onTouchEnd={clearLongPress}
            onTouchMove={clearLongPress}
            onMouseDown={startLongPress}
            onMouseUp={clearLongPress}
            onMouseLeave={clearLongPress}
            className="flex items-center gap-2.5 sm:gap-3 min-w-0 cursor-pointer select-none group/partner hover:opacity-90 transition-opacity"
            title="Tap for chat details, hold space to manage stealth lock"
          >
            {/* Friend / Group Avatar with presence ring */}
            <div className="relative">
              {isGroup ? (
                <div className="w-11 h-11 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center shrink-0 ring-2 ring-emerald-500/20 shadow-xs">
                  <Users className="w-5 h-5 md:w-4 md:h-4" />
                </div>
              ) : (
                <Avatar
                  src={friend?.avatar_path}
                  name={friend?.display_name || 'Partner'}
                  size="md"
                  isOnline={isOnline}
                  className="w-11 h-11 md:w-10 md:h-10 text-base md:text-sm shrink-0 ring-2 ring-emerald-500/20 group-hover/partner:ring-emerald-500/50 transition-all"
                />
              )}
            </div>

            {/* Partner / Group Name, Dynamic Status & Badges */}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="text-base md:text-sm font-bold md:font-semibold truncate text-foreground flex items-center gap-1">
                  {isGroup ? groupTitle : (friend?.display_name || 'My Partner')}
                  {isGroup ? (
                    <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded-md shrink-0 ml-0.5">
                      Group
                    </span>
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 text-rose-400 inline shrink-0" />
                  )}
                </h2>
                {!isGroup && (
                  <span title="Private Romantic Sanctuary" className="inline-flex">
                    <ShieldCheck className="w-4 h-4 md:w-3.5 md:h-3.5 text-primary/80 shrink-0" />
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs truncate">
                {isGroup ? (
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <span>{activeConversation?.members.length || 0} members</span>
                    {groupOnlineCount > 0 && (
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                        {groupOnlineCount} online
                      </span>
                    )}
                  </span>
                ) : isOnline && (partnerActivity?.activity === 'typing' || typingUsers.length > 0) ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5 animate-pulse text-[13px] md:text-xs">
                    <span className="flex items-center gap-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.3s]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.15s]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce" />
                    </span>
                    <span>typing...</span>
                  </span>
                ) : isOnline && partnerActivity?.activity === 'viewing_image' ? (
                  <span className="text-purple-600 dark:text-purple-400 font-semibold flex items-center gap-1 animate-pulse text-[13px] md:text-xs">
                    <span>📸</span>
                    <span>viewing photo...</span>
                  </span>
                ) : isOnline && partnerActivity?.activity === 'in_chat' ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 text-[13px] md:text-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping mr-0.5" />
                    <span>👀 In chat</span>
                  </span>
                ) : isOnline ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 text-[13px] md:text-xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                    <span>online</span>
                  </span>
                ) : (
                  <span className="text-muted-foreground text-xs md:text-[11px]">
                    {formatLastSeen(friend?.last_seen_at || friendPresence.lastSeen)}
                  </span>
                )}

                {/* Day Counter Mini Pill in Header */}
                {daysTogether !== null && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedDate(anniversary || '');
                      setIsDateDialogOpen(true);
                    }}
                    className="hidden sm:inline-flex items-center gap-1 text-xs md:text-[11px] font-medium text-rose-600 dark:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 px-2 py-0.5 rounded-full border border-rose-500/20 cursor-pointer transition-colors"
                    title="Click to view or edit our special date"
                  >
                    <Heart className="w-3 h-3 fill-current" />
                    Day {daysTogether}
                  </button>
                )}
              </div>
            </div>
          </div>
          </div>

          {/* Action Controls: Call, Video, Single-User Lock & More Menu */}
          <div className="flex items-center gap-1.5 sm:gap-1 relative">
            <button
              type="button"
              onClick={() => handleStartCall('video')}
              className="w-10 h-10 md:w-9 md:h-9 flex items-center justify-center rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 active:scale-95 transition-all cursor-pointer shrink-0"
              title="Video Call"
              aria-label="Video Call"
            >
              <Video className="w-5 h-5 md:w-4 md:h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleStartCall('voice')}
              className="w-10 h-10 md:w-9 md:h-9 flex items-center justify-center rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 active:scale-95 transition-all cursor-pointer shrink-0"
              title="Voice Call"
              aria-label="Voice Call"
            >
              <Phone className="w-5 h-5 md:w-4 md:h-4" />
            </button>

            {/* Desktop Additional Buttons */}
            <div className="hidden sm:flex items-center gap-1">
              {/* Optional Relationship Day Counter Button if not set */}
              {daysTogether === null && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedDate('');
                    setIsDateDialogOpen(true);
                  }}
                  className="rounded-xl text-xs text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 gap-1.5 font-normal"
                  title="Set our anniversary or special date"
                >
                  <CalendarHeart className="w-3.5 h-3.5 text-primary" />
                  <span>Our Date</span>
                </Button>
              )}

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsSearching(!isSearching)}
                className="rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted"
                title="Search messages in conversation"
                aria-label="Search conversation"
              >
                <Search className="w-4 h-4" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMediaDrawerOpen(!isMediaDrawerOpen)}
                className={`rounded-xl transition-colors ${
                  isMediaDrawerOpen
                    ? 'text-primary bg-primary/10'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
                title="Our Moments (photos, songs, saved notes)"
                aria-label="Toggle Our Moments drawer"
              >
                <FolderHeart className="w-4 h-4" />
              </Button>
            </div>

            {/* Mobile More Options Dropdown Toggle */}
            <div className="sm:hidden relative">
              <button
                type="button"
                onClick={() => setIsMoreMenuOpen(prev => !prev)}
                className="w-10 h-10 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95 transition-all cursor-pointer"
                title="More options"
                aria-label="More options"
              >
                <MoreVertical className="w-5 h-5" />
              </button>

              {isMoreMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40 bg-black/25"
                    onClick={() => setIsMoreMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-1.5 z-50 w-48 rounded-2xl bg-white dark:bg-[#233138] border border-border/80 dark:border-white/15 shadow-2xl p-1.5 space-y-0.5 select-none animate-in fade-in zoom-in-95 duration-100">
                    <button
                      type="button"
                      onClick={async () => {
                        setIsMoreMenuOpen(false);
                        await refreshConversations();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-white/10 active:scale-[0.98] transition-all cursor-pointer text-left"
                    >
                      <RotateCw className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>Refresh Chat</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsSearching(!isSearching);
                        setIsMoreMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-white/10 active:scale-[0.98] transition-all cursor-pointer text-left"
                    >
                      <Search className="w-4 h-4 text-zinc-600 dark:text-zinc-300 shrink-0" />
                      <span>Search messages</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsMediaDrawerOpen(true);
                        setIsMoreMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-white/10 active:scale-[0.98] transition-all cursor-pointer text-left"
                    >
                      <FolderHeart className="w-4 h-4 text-primary shrink-0" />
                      <span>Our Moments</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDate(anniversary || '');
                        setIsDateDialogOpen(true);
                        setIsMoreMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-white/10 active:scale-[0.98] transition-all cursor-pointer text-left"
                    >
                      <CalendarHeart className="w-4 h-4 text-rose-500 shrink-0" />
                      <span>Our Special Date</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsMoreMenuOpen(false);
                        if (activeConversation) {
                          toggleLockChat(activeConversation.id);
                        }
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-white/10 active:scale-[0.98] transition-all cursor-pointer text-left"
                    >
                      {isCurrentLocked ? (
                        <>
                          <Unlock className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span>Unlock Chat</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                          <span>Lock Chat (PIN)</span>
                        </>
                      )}
                    </button>
                    <div className="h-px bg-zinc-200 dark:bg-zinc-700/60 my-0.5" />
                    <button
                      type="button"
                      onClick={() => {
                        setIsDeleteModalOpen(true);
                        setIsMoreMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 active:scale-[0.98] transition-all cursor-pointer text-left"
                    >
                      <Trash2 className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                      <span>Delete Chat</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        )}

        {/* In-conversation Search Bar when toggled */}
        {isSearching && (
          <div className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-muted/40 border-t border-border/50 animate-in slide-in-from-top-1 duration-150">
            <div className="flex items-center gap-1.5 shrink-0 select-none">
              <VibelyEmblem size="xs" />
              <Search className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search in Vibely messages, little notes, or memories..."
              autoFocus
              className="w-full bg-transparent text-xs focus:outline-none placeholder:text-muted-foreground"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => {
                setIsSearching(false);
                setSearchQuery('');
              }}
              className="text-xs text-muted-foreground hover:text-foreground font-medium px-1 cursor-pointer"
            >
              Done
            </button>
          </div>
        )}
      </div>

      {/* Anniversary / Special Date Configuration Modal */}
      <Dialog
        isOpen={isDateDialogOpen}
        onClose={() => setIsDateDialogOpen(false)}
        size="sm"
        title="Our Special Date"
        description="Choose the meaningful day you two started your journey together (e.g. your anniversary, first date, or day you met)."
      >
        <form onSubmit={handleSaveDate} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Meaningful Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-xs bg-background border border-input focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <p className="text-[11px] text-muted-foreground">
              This count stays completely private to you two.
            </p>
          </div>

          <div className="flex items-center justify-between pt-2">
            {anniversary && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  updateAnniversary(null);
                  setIsDateDialogOpen(false);
                }}
                className="text-xs text-destructive hover:bg-destructive/10"
              >
                Remove Date
              </Button>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsDateDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" className="bg-primary text-primary-foreground font-medium">
                Save Date
              </Button>
            </div>
          </div>
        </form>
      </Dialog>

      {/* Delete Chat Confirmation Modal */}
      <Dialog
        isOpen={isDeleteModalOpen}
        onClose={() => !isDeletingFriend && setIsDeleteModalOpen(false)}
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
                {friend?.display_name || 'Partner'}
              </p>
              <p className="text-xs text-muted-foreground font-mono truncate">
                {friend?.username ? `@${friend.username}` : ''}
              </p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            Are you sure you want to delete this chat with <strong className="text-foreground">{friend?.display_name || 'this partner'}</strong>? This will delete your conversation history and disconnect you as partners.
          </p>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
            <Button
              variant="outline"
              size="sm"
              disabled={isDeletingFriend}
              onClick={() => setIsDeleteModalOpen(false)}
              className="text-xs rounded-xl cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={isDeletingFriend}
              onClick={handleDeleteFriend}
              className="text-xs rounded-xl gap-1.5 bg-rose-600 hover:bg-rose-700 text-white cursor-pointer font-medium"
            >
              {isDeletingFriend ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
              <span>Delete Chat</span>
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Bulk Delete Modal */}
      <Dialog
        isOpen={isBulkDeleteModalOpen}
        onClose={() => !isDeletingMessages && setIsBulkDeleteModalOpen(false)}
        title={`Delete ${selectedMessageIds.length} ${selectedMessageIds.length === 1 ? 'message' : 'messages'}?`}
        size="sm"
      >
        <div className="space-y-4 pt-1">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Are you sure you want to delete {selectedMessageIds.length} selected {selectedMessageIds.length === 1 ? 'message' : 'messages'}?
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2 border-t border-border/50">
            <Button
              variant="outline"
              size="sm"
              disabled={isDeletingMessages}
              onClick={() => setIsBulkDeleteModalOpen(false)}
              className="text-xs rounded-xl cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={isDeletingMessages}
              onClick={async () => {
                setIsDeletingMessages(true);
                try {
                  await deleteMessages(selectedMessageIds, 'for_me');
                  setIsBulkDeleteModalOpen(false);
                } finally {
                  setIsDeletingMessages(false);
                }
              }}
              className="text-xs rounded-xl cursor-pointer text-foreground hover:bg-muted"
            >
              Delete for me
            </Button>
            {canDeleteForEveryone && (
              <Button
                variant="destructive"
                size="sm"
                disabled={isDeletingMessages}
                onClick={async () => {
                  setIsDeletingMessages(true);
                  try {
                    await deleteMessages(selectedMessageIds, 'for_everyone');
                    setIsBulkDeleteModalOpen(false);
                  } finally {
                    setIsDeletingMessages(false);
                  }
                }}
                className="text-xs rounded-xl bg-rose-600 hover:bg-rose-700 text-white cursor-pointer font-medium"
              >
                {isDeletingMessages ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                <span>Delete for everyone</span>
              </Button>
            )}
          </div>
        </div>
      </Dialog>

      {/* Forward Modal */}
      <ForwardModal
        isOpen={isForwardModalOpen}
        onClose={() => setIsForwardModalOpen(false)}
        messageIds={selectedMessageIds}
        onSuccess={clearSelectedMessages}
      />

      {/* Partner Profile & Single User Chat Security Dialog */}
      <Dialog
        isOpen={isContactInfoOpen}
        onClose={() => setIsContactInfoOpen(false)}
        size="sm"
        title="Chat Info & Security"
      >
        <div className="space-y-5 pt-2 select-none">
          {/* Partner Identity Card */}
          <div className="flex flex-col items-center text-center space-y-2 p-4 rounded-2xl bg-muted/30 border border-border/40">
            <Avatar
              src={friend?.avatar_path}
              name={friend?.display_name || 'Partner'}
              size="lg"
              isOnline={isOnline}
              className="w-20 h-20 text-2xl shadow-md ring-4 ring-emerald-500/15"
            />
            <div className="space-y-0.5">
              <h3 className="text-base font-bold text-foreground flex items-center justify-center gap-1.5">
                <span>{friend?.display_name || 'My Partner'}</span>
                <Sparkles className="w-4 h-4 text-rose-400 inline shrink-0" />
              </h3>
              <p className="text-xs font-mono text-muted-foreground">
                {friend?.username ? `@${friend.username}` : ''}
              </p>
            </div>

            <div className="pt-1">
              {isOnline ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Online now</span>
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">
                  {formatLastSeen(friend?.last_seen_at || friendPresence.lastSeen)}
                </span>
              )}
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-3 pt-3">
              <button
                type="button"
                onClick={() => {
                  setIsContactInfoOpen(false);
                  handleStartCall('voice');
                }}
                className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-semibold transition-all active:scale-95 cursor-pointer"
              >
                <Phone className="w-4 h-4" />
                <span>Voice</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsContactInfoOpen(false);
                  handleStartCall('video');
                }}
                className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-semibold transition-all active:scale-95 cursor-pointer"
              >
                <Video className="w-4 h-4" />
                <span>Video</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsContactInfoOpen(false);
                  setIsMediaDrawerOpen(true);
                }}
                className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold transition-all active:scale-95 cursor-pointer"
              >
                <FolderHeart className="w-4 h-4 text-primary" />
                <span>Media</span>
              </button>
            </div>
          </div>

          {/* SINGLE USER CHAT LOCK TOGGLE CARD */}
          <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-xs space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  isCurrentLocked
                    ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  <Lock className="w-4.5 h-4.5" />
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <span>Chat Lock</span>
                    {isCurrentLocked && (
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 px-1.5 py-0.2 rounded-md">
                        Protected
                      </span>
                    )}
                  </h4>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Lock and hide this conversation behind your 4-digit passcode on this device.
                  </p>
                </div>
              </div>

              {/* iOS / WhatsApp Style Toggle Switch */}
              <button
                type="button"
                role="switch"
                aria-checked={isCurrentLocked}
                onClick={() => {
                  if (activeConversation) {
                    toggleLockChat(activeConversation.id, friend?.display_name);
                  }
                }}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                  isCurrentLocked ? 'bg-emerald-600' : 'bg-muted-foreground/30'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    isCurrentLocked ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <p className="text-[10px] text-muted-foreground/80 border-t border-border/40 pt-2 flex items-center gap-1.5">
              <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>
                {isCurrentLocked
                  ? 'This chat is hidden in the Locked Chats folder.'
                  : 'Toggle ON to instantly hide and protect this chat.'}
              </span>
            </p>
          </div>

          {/* Delete Friendship / Conversation Option */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => {
                setIsContactInfoOpen(false);
                setIsDeleteModalOpen(true);
              }}
              className="w-full flex items-center justify-center gap-2 p-3 rounded-2xl bg-destructive/10 hover:bg-destructive/20 text-destructive text-xs font-semibold transition-all cursor-pointer active:scale-98"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete Chat & Remove Friend</span>
            </button>
          </div>
        </div>
      </Dialog>

      {/* Secret Stealth Chat Lock Dialog */}
      <Dialog
        isOpen={isSecretLockModalOpen}
        onClose={() => setIsSecretLockModalOpen(false)}
        title="Stealth Chat Lock"
        size="sm"
      >
        <div className="space-y-4 pt-1 select-none">
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center shadow-xs">
              {isCurrentLocked ? <ShieldCheck className="w-6 h-6" /> : <Lock className="w-6 h-6" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">
                {isCurrentLocked ? 'This Chat is Locked & Hidden' : 'Lock & Hide This Chat'}
              </h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                {isCurrentLocked
                  ? 'This chat is secret. It is hidden from the public chats list and protected by your PIN.'
                  : 'Hides this chat from your main conversation list. It can only be revealed by touching the Vibely logo and entering your PIN.'}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-2 border-t border-border/50">
            {isCurrentLocked ? (
              <Button
                type="button"
                onClick={() => {
                  if (activeConversation) {
                    toggleLockChat(activeConversation.id, friend?.display_name);
                    setIsSecretLockModalOpen(false);
                  }
                }}
                className="w-full rounded-xl bg-muted hover:bg-muted/80 text-foreground font-semibold text-xs h-10 cursor-pointer"
              >
                <span>Unlock & Make Public Again</span>
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => {
                  if (activeConversation) {
                    toggleLockChat(activeConversation.id, friend?.display_name);
                    setIsSecretLockModalOpen(false);
                  }
                }}
                className="w-full rounded-xl bg-[#0C3B2E] hover:bg-[#155E49] text-white font-bold text-xs h-10 shadow-sm cursor-pointer"
              >
                <Lock className="w-4 h-4 mr-1.5" />
                <span>Lock & Hide Chat Behind PIN</span>
              </Button>
            )}

            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsSecretLockModalOpen(false)}
              className="w-full rounded-xl text-xs text-muted-foreground cursor-pointer"
            >
              Cancel
            </Button>
          </div>
        </div>
      </Dialog>

      {isGroup && activeConversation && (
        <GroupDetailsModal
          isOpen={isGroupDetailsOpen}
          onClose={() => setIsGroupDetailsOpen(false)}
          conversation={activeConversation}
        />
      )}
    </>
  );
}
