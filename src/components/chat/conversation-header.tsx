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
  const [isDateDialogOpen, setIsDateDialogOpen] = React.useState(false);
  const [selectedDate, setSelectedDate] = React.useState(anniversary || '');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState(false);
  const [isDeletingFriend, setIsDeletingFriend] = React.useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = React.useState(false);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = React.useState(false);
  const [isDeletingMessages, setIsDeletingMessages] = React.useState(false);
  const [isForwardModalOpen, setIsForwardModalOpen] = React.useState(false);

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

  const friend = activeConversation?.otherUser;
  const isOnline = friend?.id ? isUserOnline(friend.id) || friendPresence.online : friendPresence.online;

  const handleStartCall = (type: 'voice' | 'video') => {
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

            {/* Friend Avatar with presence ring */}
            <div className="relative">
              <Avatar
                src={friend?.avatar_path}
                name={friend?.display_name || 'Partner'}
                size="md"
                isOnline={isOnline}
                className="w-11 h-11 md:w-10 md:h-10 text-base md:text-sm shrink-0"
              />
            </div>

            {/* Partner Name, Dynamic Status & Romantic Badge */}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="text-base md:text-sm font-bold md:font-semibold truncate text-foreground flex items-center gap-1">
                  {friend?.display_name || 'My Partner'}
                  <Sparkles className="w-3.5 h-3.5 text-rose-400 inline shrink-0" />
                </h2>
                <span title="Private Romantic Sanctuary" className="inline-flex">
                  <ShieldCheck className="w-4 h-4 md:w-3.5 md:h-3.5 text-primary/80 shrink-0" />
                </span>
                {isCurrentLocked && (
                  <span
                    title="This chat is locked with your 4-digit passcode"
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/15 border border-emerald-500/25 px-1.5 py-0.5 rounded-full shrink-0"
                  >
                    <Lock className="w-2.5 h-2.5" />
                    <span>Locked</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs truncate">
                {/* Live Activity Status - ONLY when partner is ACTUALLY online */}
                {isOnline && (partnerActivity?.activity === 'typing' || typingUsers.length > 0) ? (
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
                    onClick={() => {
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

          {/* Action Controls: Call, Video, Delete Chat & More Menu */}
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

              {/* Chat Lock / Unlock Action Button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (activeConversation) {
                    toggleLockChat(activeConversation.id);
                  }
                }}
                className={`rounded-xl transition-colors ${
                  isCurrentLocked
                    ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/15'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
                title={isCurrentLocked ? 'Unlock Chat (remove PIN protection)' : 'Lock Chat (hide behind 4-digit PIN)'}
                aria-label="Toggle Chat Lock"
              >
                {isCurrentLocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
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
    </>
  );
}
