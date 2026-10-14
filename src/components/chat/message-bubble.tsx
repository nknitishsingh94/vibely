'use client';

import * as React from 'react';
import {
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
  Reply,
  Smile,
  Edit2,
  Trash2,
  Copy,
  Check as CheckIcon,
  X,
  Bookmark,
  Heart,
  Sparkles,
  ChevronDown,
  Ban,
  CheckSquare,
} from 'lucide-react';
import { MessageWithDetails } from '@/types/database';
import { useAuth } from '@/context/auth-context';
import { useChat } from '@/context/chat-context';
import { formatMessageTime, cn } from '@/lib/utils';
import { ImagePreview } from './media/image-preview';
import { AudioPlayer } from './media/audio-player';
import { VideoPlayer } from './media/video-player';
import { DocumentCard } from './media/document-card';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { spawnFloatingHearts } from '@/components/ui/floating-hearts';
import { useRomanticFeatures } from '@/lib/romantic-features';
import { toast } from '@/components/ui/toast';

interface MessageBubbleProps {
  message: MessageWithDetails;
  isFirstInGroup?: boolean;
}

const COMMON_EMOJIS = ['❤️', '💕', '🥰', '✨', '😂', '🔥', '☕'];

export function MessageBubble({ message, isFirstInGroup = true }: MessageBubbleProps) {
  const { profile } = useAuth();
  const {
    setReplyingTo,
    toggleReaction,
    editMessage,
    deleteMessage,
    friendPresence,
    selectedMessageIds,
    isSelectMode,
    toggleSelectMessage,
  } = useChat();

  const isSelected = selectedMessageIds.includes(message.id);

  const { isFavorite, toggleFav } = useRomanticFeatures();
  const isBookmarked = isFavorite(message.id);

  const [isEditing, setIsEditing] = React.useState(false);
  const [editText, setEditText] = React.useState(message.body || '');
  const [showReactionPicker, setShowReactionPicker] = React.useState(false);
  const [showDeleteModal, setShowDeleteModal] = React.useState(false);
  const [showMobileMenu, setShowMobileMenu] = React.useState(false);
  const [menuPos, setMenuPos] = React.useState<{ top: number; left: number } | null>(null);
  const chevronBtnRef = React.useRef<HTMLButtonElement | null>(null);
  const [isCopied, setIsCopied] = React.useState(false);
  const longPressTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  const isOutgoing = message.sender_id === profile?.id;

  // Check if message is a "Little Note"
  const isLittleNote = message.body?.startsWith('[💌 Note]') || false;
  const displayBody = isLittleNote
    ? message.body?.replace(/^\[💌 Note\]\s*/, '')
    : message.body;

  const isImageOnly = message.message_type === 'image' && !displayBody;

  // 1. Eligible for editing: Outgoing text message AND within 15 minutes of sending
  const isEditAvailable = React.useMemo(() => {
    if (!isOutgoing || message.message_type !== 'text') return false;
    const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
    const createdTime = new Date(message.created_at).getTime();
    return Date.now() - createdTime <= FIFTEEN_MINUTES_MS;
  }, [isOutgoing, message.message_type, message.created_at]);

  // 2. Eligible for "Delete for everyone":
  // Must be outgoing AND within 2 hours of being seen (or within 2 hours of sending if not seen yet)
  const isDeleteForEveryoneAvailable = React.useMemo(() => {
    if (!isOutgoing) return false;
    const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

    const readReceipt = message.receipts?.find((r: any) => r.read_at);
    if (readReceipt?.read_at) {
      const readTime = new Date(readReceipt.read_at).getTime();
      return Date.now() - readTime <= TWO_HOURS_MS;
    }

    if (message.deliveryStatus === 'read') {
      const createdTime = new Date(message.created_at).getTime();
      return Date.now() - createdTime <= TWO_HOURS_MS;
    }

    const createdTime = new Date(message.created_at).getTime();
    return Date.now() - createdTime <= TWO_HOURS_MS;
  }, [isOutgoing, message.receipts, message.deliveryStatus, message.created_at]);

  // Status icon for outgoing messages (WhatsApp-style ticks)
  const renderStatus = () => {
    if (!isOutgoing) return null;

    if (message.deliveryStatus === 'sending' || message.isOptimistic) {
      return (
        <span title="Sending..." className="inline-flex items-center text-white/70">
          <Clock className="w-3 h-3 animate-pulse" />
        </span>
      );
    }

    if (message.deliveryStatus === 'failed') {
      return (
        <span title="Failed to send" className="inline-flex items-center text-rose-300">
          <AlertCircle className="w-3.5 h-3.5" />
        </span>
      );
    }

    if (message.deliveryStatus === 'read') {
      return (
        <span title="Read" className="inline-flex items-center text-[#38BDF8] dark:text-[#53BDEB]">
          <CheckCheck className="w-3.5 h-3.5 stroke-[2.5]" />
        </span>
      );
    }

    if (message.deliveryStatus === 'delivered' || friendPresence.online) {
      return (
        <span title="Delivered (Partner is online)" className="inline-flex items-center text-white/75">
          <CheckCheck className="w-3.5 h-3.5 stroke-[2]" />
        </span>
      );
    }

    return (
      <span title="Sent (Partner is offline)" className="inline-flex items-center text-white/70">
        <Check className="w-3.5 h-3.5 stroke-[2]" />
      </span>
    );
  };

  const handleCopy = async () => {
    if (displayBody) {
      try {
        await navigator.clipboard.writeText(displayBody);
        setIsCopied(true);
        toast.success('Message copied to clipboard!');
        setTimeout(() => setIsCopied(false), 2000);
      } catch {
        toast.error('Failed to copy text');
      }
    }
    setShowMobileMenu(false);
  };

  const handleSaveEdit = async () => {
    if (editText.trim() && editText !== displayBody) {
      const updated = isLittleNote ? `[💌 Note] ${editText.trim()}` : editText.trim();
      await editMessage(message.id, updated);
      toast.success('Message updated');
    }
    setIsEditing(false);
  };

  const handleDeleteForMe = async () => {
    await deleteMessage(message.id, 'for_me');
    setShowDeleteModal(false);
    setShowMobileMenu(false);
  };

  const handleDeleteForEveryone = async () => {
    await deleteMessage(message.id, 'for_everyone');
    setShowDeleteModal(false);
    setShowMobileMenu(false);
  };

  const handleReactionClick = (emoji: string, e?: React.MouseEvent) => {
    if (emoji === '❤️' || emoji === '💕' || emoji === '🥰') {
      const rect = (e?.currentTarget as HTMLElement)?.getBoundingClientRect();
      spawnFloatingHearts(rect?.left ?? window.innerWidth / 2, rect?.top ?? window.innerHeight / 2, 7);
    }
    toggleReaction(message.id, emoji);
    setShowReactionPicker(false);
    setShowMobileMenu(false);
  };

  const handleToggleFavorite = (e: React.MouseEvent) => {
    const isNowFav = toggleFav(message.id);
    if (isNowFav) {
      const rect = (e?.currentTarget as HTMLElement)?.getBoundingClientRect();
      spawnFloatingHearts(rect?.left ?? window.innerWidth / 2, rect?.top ?? window.innerHeight / 2, 5);
      toast.success('Saved to Our Moments');
    } else {
      toast.info('Removed from Our Moments');
    }
    setShowMobileMenu(false);
  };

  const handleOpenMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (showMobileMenu) {
      setShowMobileMenu(false);
      setMenuPos(null);
      return;
    }
    if (chevronBtnRef.current) {
      const rect = chevronBtnRef.current.getBoundingClientRect();
      const menuWidth = 148;
      let left = isOutgoing ? rect.right - menuWidth : rect.left;
      left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8));
      const top = rect.bottom + 4;
      setMenuPos({ top, left });
      setShowMobileMenu(true);
    }
  };

  // Touch handlers for mobile long-press: enters multi-select mode!
  const handleTouchStart = () => {
    longPressTimerRef.current = setTimeout(() => {
      toggleSelectMessage(message.id);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate(40);
        } catch {}
      }
    }, 450);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  // Group reactions by emoji
  const groupedReactions = (message.reactions || []).reduce(
    (acc, r) => {
      acc[r.emoji] = acc[r.emoji] || [];
      acc[r.emoji].push(r.user_id);
      return acc;
    },
    {} as Record<string, string[]>
  );

  // If deleted, display WhatsApp in-place deleted placeholder directly where the message was!
  if (message.deleted_at) {
    return (
      <div
        id={`msg-${message.id}`}
        className={cn(
          'flex flex-col mb-2 px-1 sm:px-2 select-none animate-in fade-in duration-200',
          isOutgoing ? 'items-end' : 'items-start'
        )}
      >
        <div
          className={cn(
            'rounded-2xl px-3.5 py-2 text-xs flex items-center gap-2 border shadow-2xs italic',
            isOutgoing
              ? 'bg-muted/40 border-border/50 text-muted-foreground'
              : 'bg-muted/40 border-border/50 text-muted-foreground'
          )}
        >
          <Ban className="w-3.5 h-3.5 text-muted-foreground/70 shrink-0" />
          <span>
            {isOutgoing ? 'You deleted this message' : 'This message was deleted'}
          </span>
          <span className="text-[10px] ml-2 not-italic text-muted-foreground/60 font-mono">
            {formatMessageTime(message.created_at)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      id={`msg-${message.id}`}
      className={cn(
        'group relative flex flex-col mb-2.5 px-1 sm:px-2 transition-all duration-150',
        isOutgoing ? 'items-end' : 'items-start'
      )}
    >
      {/* Quick Action Floating Toolbar on Desktop Hover */}
      {!isEditing && (
        <div
          className={cn(
            'absolute -top-4 z-20 hidden group-hover:flex items-center gap-0.5 rounded-2xl bg-card/95 border border-border/80 p-1 shadow-md text-muted-foreground backdrop-blur-md transition-all',
            isOutgoing ? 'right-2' : 'left-2'
          )}
        >
          {/* Reaction Trigger */}
          <div className="relative">
            <button
              onClick={() => setShowReactionPicker(prev => !prev)}
              aria-label="React with emoji"
              className="p-1.5 rounded-xl hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
            >
              <Smile className="w-3.5 h-3.5" />
            </button>
            {showReactionPicker && (
              <div
                className={cn(
                  'absolute bottom-full mb-1 flex items-center gap-1 rounded-2xl bg-card border border-border/90 p-1.5 shadow-xl z-30 animate-in zoom-in-95 backdrop-blur-md',
                  isOutgoing ? 'right-0' : 'left-0'
                )}
              >
                {COMMON_EMOJIS.map(emoji => (
                  <button
                    key={emoji}
                    onClick={e => handleReactionClick(emoji, e)}
                    className="p-1 hover:scale-130 transition-transform text-base cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick Heart Reaction Shortcut */}
          <button
            onClick={e => handleReactionClick('❤️', e)}
            aria-label="Send love reaction"
            className="p-1.5 rounded-xl hover:bg-rose-500/10 hover:text-rose-500 transition-colors cursor-pointer"
            title="Heart reaction"
          >
            <Heart className="w-3.5 h-3.5" />
          </button>

          {/* Save / Bookmark to Favorites */}
          <button
            onClick={handleToggleFavorite}
            aria-label={isBookmarked ? 'Unsave moment' : 'Save to Our Moments'}
            className={cn(
              'p-1.5 rounded-xl transition-colors cursor-pointer',
              isBookmarked
                ? 'text-amber-500 bg-amber-500/10'
                : 'hover:bg-muted hover:text-foreground'
            )}
            title={isBookmarked ? 'Saved to Our Moments' : 'Save to Our Moments'}
          >
            <Bookmark className={cn('w-3.5 h-3.5', isBookmarked && 'fill-current')} />
          </button>

          {/* Reply */}
          <button
            onClick={() => setReplyingTo(message)}
            aria-label="Reply to message"
            className="p-1.5 rounded-xl hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
          >
            <Reply className="w-3.5 h-3.5" />
          </button>

          {/* Copy (only if text body exists) */}
          {displayBody && (
            <button
              onClick={handleCopy}
              aria-label="Copy text"
              className="p-1.5 rounded-xl hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              title="Copy text"
            >
              {isCopied ? <CheckIcon className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          )}

          {/* Edit (only text, outgoing, within 15 min limit) */}
          {isEditAvailable && (
            <button
              onClick={() => {
                setIsEditing(true);
                setEditText(displayBody || '');
              }}
              aria-label="Edit message (within 15 min)"
              className="p-1.5 rounded-xl hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              title="Edit message"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Delete (available for outgoing & incoming with options) */}
          <button
            onClick={() => setShowDeleteModal(true)}
            aria-label="Delete message"
            className="p-1.5 rounded-xl hover:bg-destructive/10 hover:text-destructive transition-colors cursor-pointer"
            title="Delete message"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Replying-to Quoted Preview */}
      {message.reply_to && (
        <div
          className={cn(
            'flex items-center gap-2 mb-1 px-3 py-1.5 rounded-xl text-xs bg-muted/70 border border-border/50 max-w-sm truncate text-muted-foreground',
            isOutgoing ? 'mr-1' : 'ml-1'
          )}
        >
          <Reply className="w-3 h-3 shrink-0 text-primary" />
          <span className="font-semibold text-foreground shrink-0">
            {message.reply_to.sender_name}:
          </span>
          <span className="truncate">
            {message.reply_to.body || message.reply_to.original_filename || `[${message.reply_to.message_type}]`}
          </span>
        </div>
      )}

      {/* Main Bubble Content with Selection Checkbox */}
      <div className={cn('flex items-center gap-2 w-full', isOutgoing ? 'justify-end' : 'justify-start')}>
        {/* Checkbox indicator on left for incoming messages */}
        {isSelectMode && !isOutgoing && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              toggleSelectMessage(message.id);
            }}
            className={cn(
              'w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-all cursor-pointer self-center',
              isSelected
                ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                : 'border-muted-foreground/40 bg-card hover:border-emerald-500'
            )}
          >
            {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
          </div>
        )}

        <div
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onClick={() => {
            if (isSelectMode) toggleSelectMessage(message.id);
          }}
          className={cn(
            'relative max-w-[85%] sm:max-w-md rounded-2xl shadow-xs transition-all',
            isImageOnly ? 'p-1 sm:p-1.5' : 'p-2 px-3 pb-1.5 sm:p-2.5 sm:px-3.5 sm:pb-2 pr-7 sm:pr-8',
            isLittleNote
              ? 'little-note-card rounded-2xl'
              : isOutgoing
              ? 'bg-[#005C4B] text-white rounded-br-xs shadow-sm shadow-[#005C4B]/20'
              : 'bg-white dark:bg-[#202C33] text-foreground border border-border/70 rounded-bl-xs shadow-2xs',
            isSelectMode && isSelected && 'ring-2 ring-emerald-500 bg-emerald-500/15 dark:bg-emerald-500/25'
          )}
        >
          {/* Subtle Dropdown Chevron & Context Menu */}
          {!isEditing && (
            <div className="absolute top-1.5 right-1.5 z-20">
              <button
                ref={chevronBtnRef}
                type="button"
                onClick={handleOpenMenu}
                className={cn(
                  'p-1 rounded-full text-xs transition-all cursor-pointer flex items-center justify-center',
                  isOutgoing
                    ? 'text-white/80 hover:text-white hover:bg-white/20 bg-black/15'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted bg-muted/60',
                  'opacity-80 hover:opacity-100 shadow-xs'
                )}
                title="Message options"
                aria-label="Message options"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>

              {/* Action Menu Popup (Anchored directly under Chevron, never cut off!) */}
              {showMobileMenu && menuPos && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMobileMenu(false);
                      setMenuPos(null);
                    }}
                  />
                  <div
                    className="fixed z-50 w-36 rounded-2xl bg-white dark:bg-[#233138] border border-border/80 dark:border-white/15 shadow-2xl p-1.5 space-y-0.5 text-zinc-900 dark:text-zinc-100 select-none animate-in fade-in zoom-in-95"
                    style={{ top: `${menuPos.top}px`, left: `${menuPos.left}px` }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Quick Emojis Bar */}
                    <div className="flex items-center justify-between px-1 py-1 border-b border-border/50 dark:border-white/10 mb-1">
                      {COMMON_EMOJIS.slice(0, 5).map(emoji => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={e => handleReactionClick(emoji, e)}
                          className="p-0.5 hover:scale-125 transition-transform text-sm cursor-pointer"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>

                    {/* Reply */}
                    <button
                      type="button"
                      onClick={() => {
                        setReplyingTo(message);
                        setShowMobileMenu(false);
                        setMenuPos(null);
                      }}
                      className="w-full flex items-center gap-2 px-2 py-1.5 text-[12px] font-medium text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-white/10 rounded-xl transition-colors cursor-pointer text-left"
                    >
                      <Reply className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-300" />
                      <span>Reply</span>
                    </button>

                    {/* Select */}
                    <button
                      type="button"
                      onClick={() => {
                        toggleSelectMessage(message.id);
                        setShowMobileMenu(false);
                        setMenuPos(null);
                      }}
                      className="w-full flex items-center gap-2 px-2 py-1.5 text-[12px] font-medium text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-white/10 rounded-xl transition-colors cursor-pointer text-left"
                    >
                      <CheckSquare className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-300" />
                      <span>Select</span>
                    </button>

                    {/* Copy */}
                    {displayBody && (
                      <button
                        type="button"
                        onClick={handleCopy}
                        className="w-full flex items-center gap-2 px-2 py-1.5 text-[12px] font-medium text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-white/10 rounded-xl transition-colors cursor-pointer text-left"
                      >
                        {isCopied ? (
                          <CheckIcon className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-300" />
                        )}
                        <span>{isCopied ? 'Copied' : 'Copy'}</span>
                      </button>
                    )}

                    {/* Save to Moments */}
                    <button
                      type="button"
                      onClick={handleToggleFavorite}
                      className="w-full flex items-center gap-2 px-2 py-1.5 text-[12px] font-medium text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-white/10 rounded-xl transition-colors cursor-pointer text-left"
                    >
                      <Bookmark className={cn('w-3.5 h-3.5', isBookmarked ? 'text-amber-500 fill-current' : 'text-zinc-600 dark:text-zinc-300')} />
                      <span>{isBookmarked ? 'Unsave' : 'Save'}</span>
                    </button>

                    {/* Edit (if available) */}
                    {isEditAvailable && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditing(true);
                          setEditText(displayBody || '');
                          setShowMobileMenu(false);
                          setMenuPos(null);
                        }}
                        className="w-full flex items-center gap-2 px-2 py-1.5 text-[12px] font-medium text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-white/10 rounded-xl transition-colors cursor-pointer text-left"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-300" />
                        <span>Edit</span>
                      </button>
                    )}

                    <div className="h-px bg-zinc-200 dark:bg-zinc-700/60 my-0.5" />

                    {/* Delete Option with Red Trash Icon */}
                    <button
                      type="button"
                      onClick={() => {
                        setShowMobileMenu(false);
                        setMenuPos(null);
                        setShowDeleteModal(true);
                      }}
                      className="w-full flex items-center gap-2 px-2 py-1.5 text-[12px] font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-colors cursor-pointer text-left"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                      <span>Delete</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

        {/* Little Note Header Badge */}
        {isLittleNote && (
          <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-rose-900/15 dark:border-rose-300/15">
            <span className="text-[11px] font-serif italic text-primary dark:text-rose-300 font-semibold flex items-center gap-1.5">
              <span>💌</span> Little Note
            </span>
            <Sparkles className="w-3 h-3 text-primary/70" />
          </div>
        )}

        {/* Media Attachments */}
        {message.message_type === 'image' && message.signedMediaUrl && (
          <div className={cn('relative', !isImageOnly && 'mb-2')}>
            <ImagePreview
              src={message.signedMediaUrl}
              filename={message.original_filename}
              fileSize={message.file_size}
            />
            {/* WhatsApp floating timestamp on image when no caption */}
            {isImageOnly && (
              <div className="absolute bottom-2 right-2 z-10 bg-black/60 backdrop-blur-xs text-white px-2 py-0.5 rounded-full text-[10px] flex items-center gap-1 shadow-md pointer-events-none select-none">
                <span>{formatMessageTime(message.created_at)}</span>
                {renderStatus()}
              </div>
            )}
          </div>
        )}

        {message.message_type === 'audio' && message.signedMediaUrl && (
          <div className="mb-1">
            <AudioPlayer
              src={message.signedMediaUrl}
              filename={message.original_filename}
              fileSize={message.file_size}
              initialDuration={message.duration_seconds}
              isOutgoing={isOutgoing && !isLittleNote}
            />
          </div>
        )}

        {message.message_type === 'video' && message.signedMediaUrl && (
          <div className="mb-2">
            <VideoPlayer
              src={message.signedMediaUrl}
              filename={message.original_filename}
              fileSize={message.file_size}
              mimeType={message.mime_type}
            />
          </div>
        )}

        {message.message_type === 'file' && (
          <div className="mb-1">
            <DocumentCard
              src={message.signedMediaUrl}
              filename={message.original_filename}
              fileSize={message.file_size}
              mimeType={message.mime_type}
              isOutgoing={isOutgoing && !isLittleNote}
            />
          </div>
        )}

        {/* Text Body / Inline Edit */}
        {isEditing ? (
          <div className="space-y-2 mt-1">
            <textarea
              value={editText}
              onChange={e => setEditText(e.target.value)}
              className="w-full p-2 text-xs rounded-xl bg-background text-foreground border border-border focus:outline-none focus:ring-1 focus:ring-ring"
              rows={2}
            />
            <div className="flex items-center justify-end gap-1.5">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsEditing(false)}
                className="h-7 text-xs px-2"
              >
                <X className="w-3.5 h-3.5 mr-1" />
                Cancel
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={handleSaveEdit}
                className="h-7 text-xs px-2.5 font-medium"
              >
                <CheckIcon className="w-3.5 h-3.5 mr-1" />
                Save
              </Button>
            </div>
          </div>
        ) : (
          displayBody && (
            <div className="text-sm font-sans leading-relaxed break-words">
              <span
                className={cn(
                  'whitespace-pre-wrap',
                  isLittleNote && 'font-serif italic text-foreground tracking-wide'
                )}
              >
                {displayBody}
              </span>

              {/* Inline Timestamp aligned right & slightly down, saving vertical space */}
              <span
                className={cn(
                  'inline-flex items-center gap-1 float-right align-bottom ml-2.5 translate-y-1 select-none text-[10px] leading-none shrink-0 pointer-events-none',
                  isLittleNote
                    ? 'text-muted-foreground'
                    : isOutgoing
                    ? 'text-white/75'
                    : 'text-muted-foreground'
                )}
              >
                {isBookmarked && (
                  <span title="Saved in Our Moments" className="text-amber-400 mr-0.5">
                    <Bookmark className="w-2.5 h-2.5 fill-current" />
                  </span>
                )}
                {message.edited_at && <span className="italic opacity-80 text-[9px]">(edited)</span>}
                <span>{formatMessageTime(message.created_at)}</span>
                {renderStatus()}
              </span>
            </div>
          )
        )}

        {/* Timestamp for media-only messages without text caption */}
        {!displayBody && !isImageOnly && (
          <div
            className={cn(
              'flex items-center gap-1.5 mt-1 text-[10px] select-none justify-end',
              isOutgoing ? 'text-white/75' : 'text-muted-foreground'
            )}
          >
            {isBookmarked && (
              <span title="Saved in Our Moments" className="text-amber-400 mr-0.5">
                <Bookmark className="w-2.5 h-2.5 fill-current" />
              </span>
            )}
            {message.edited_at && <span className="italic opacity-80 text-[9px]">(edited)</span>}
            <span>{formatMessageTime(message.created_at)}</span>
            {renderStatus()}
          </div>
        )}
      </div>

      {/* Checkbox indicator on right for outgoing messages in select mode */}
      {isSelectMode && isOutgoing && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            toggleSelectMessage(message.id);
          }}
          className={cn(
            'w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-all cursor-pointer self-center',
            isSelected
              ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
              : 'border-muted-foreground/40 bg-card hover:border-emerald-500'
          )}
        >
          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
        </div>
      )}
    </div>

      {/* Emoji Reactions Badges */}
      {Object.keys(groupedReactions).length > 0 && (
        <div
          className={cn(
            'flex flex-wrap items-center gap-1 mt-1 z-10',
            isOutgoing ? 'justify-end pr-1' : 'justify-start pl-1'
          )}
        >
          {Object.entries(groupedReactions).map(([emoji, userIds]) => {
            const hasReacted = profile ? userIds.includes(profile.id) : false;

            return (
              <button
                key={emoji}
                onClick={e => handleReactionClick(emoji, e)}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs border transition-all cursor-pointer shadow-xs',
                  hasReacted
                    ? 'bg-rose-500/15 border-rose-500/40 text-primary font-semibold'
                    : 'bg-card/90 border-border/80 text-muted-foreground hover:bg-muted'
                )}
              >
                <span>{emoji}</span>
                <span className="text-[10px] font-mono">{userIds.length}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* WhatsApp-Style Delete Confirmation Modal */}
      <Dialog
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        size="sm"
        title="Delete message?"
        description={
          isDeleteForEveryoneAvailable
            ? 'You can delete this message for everyone or only for yourself.'
            : isOutgoing
            ? 'Delete for everyone is no longer available (time limit: 2 hours after message is seen).'
            : 'Delete this message from your device.'
        }
      >
        <div className="flex flex-col gap-2 pt-3">
          {/* Delete for everyone (only if within 2 hours of message being seen) */}
          {isDeleteForEveryoneAvailable && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteForEveryone}
              className="w-full justify-center text-xs font-semibold h-9 rounded-xl gap-2 cursor-pointer shadow-xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete for everyone</span>
            </Button>
          )}

          {/* Delete for me (always available) */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleDeleteForMe}
            className="w-full justify-center text-xs font-medium h-9 rounded-xl gap-2 hover:bg-destructive/10 hover:text-destructive cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete for me</span>
          </Button>

          {/* Cancel */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDeleteModal(false)}
            className="w-full justify-center text-xs text-muted-foreground h-9 rounded-xl cursor-pointer"
          >
            Cancel
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
