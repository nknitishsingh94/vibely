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
  } = useChat();

  const { isFavorite, toggleFav } = useRomanticFeatures();
  const isBookmarked = isFavorite(message.id);

  const [isEditing, setIsEditing] = React.useState(false);
  const [editText, setEditText] = React.useState(message.body || '');
  const [showReactionPicker, setShowReactionPicker] = React.useState(false);
  const [showDeleteModal, setShowDeleteModal] = React.useState(false);
  const [showMobileMenu, setShowMobileMenu] = React.useState(false);
  const [isCopied, setIsCopied] = React.useState(false);
  const longPressTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  const isOutgoing = message.sender_id === profile?.id;

  // Check if message is a "Little Note"
  const isLittleNote = message.body?.startsWith('[💌 Note]') || false;
  const displayBody = isLittleNote
    ? message.body?.replace(/^\[💌 Note\]\s*/, '')
    : message.body;

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
    toast.success('Message deleted for you');
  };

  const handleDeleteForEveryone = async () => {
    await deleteMessage(message.id, 'for_everyone');
    setShowDeleteModal(false);
    setShowMobileMenu(false);
    toast.success('Message deleted for everyone');
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

  // Touch handlers for mobile long-press
  const handleTouchStart = () => {
    longPressTimerRef.current = setTimeout(() => {
      setShowMobileMenu(true);
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

      {/* Main Bubble Content */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className={cn(
          'relative max-w-[85%] sm:max-w-md rounded-2xl p-3 sm:p-3.5 shadow-xs transition-all pr-7 sm:pr-8',
          isLittleNote
            ? 'little-note-card rounded-2xl'
            : isOutgoing
            ? 'bg-[#005C4B] text-white rounded-br-xs shadow-sm shadow-[#005C4B]/20'
            : 'bg-white dark:bg-[#202C33] text-foreground border border-border/70 rounded-bl-xs shadow-2xs'
        )}
      >
        {/* Subtle Dropdown Chevron for Mobile & Touch */}
        {!isEditing && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowMobileMenu(prev => !prev);
            }}
            className={cn(
              'absolute top-2 right-2 p-1 rounded-full text-xs transition-all cursor-pointer z-10',
              isOutgoing
                ? 'text-white/70 hover:text-white hover:bg-white/10'
                : 'text-muted-foreground/70 hover:text-foreground hover:bg-muted',
              'opacity-70 sm:opacity-0 sm:group-hover:opacity-100'
            )}
            title="Message options"
            aria-label="Message options"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Action Menu Popup (Anchored Dropdown for Mobile / Desktop) */}
        {showMobileMenu && (
          <>
            <div
              className="fixed inset-0 z-30"
              onClick={() => setShowMobileMenu(false)}
            />
            <div
              className={cn(
                'absolute z-40 top-8 w-44 rounded-2xl bg-card border border-border/90 shadow-xl backdrop-blur-md p-1.5 space-y-1 animate-in fade-in zoom-in-95 text-foreground select-none',
                isOutgoing ? 'right-0' : 'left-0'
              )}
            >
              {/* Quick Emojis Bar */}
              <div className="flex items-center justify-between px-1.5 py-1 border-b border-border/50 mb-1">
                {COMMON_EMOJIS.slice(0, 5).map(emoji => (
                  <button
                    key={emoji}
                    onClick={e => handleReactionClick(emoji, e)}
                    className="p-1 hover:scale-125 transition-transform text-sm cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              {/* Reply */}
              <button
                onClick={() => {
                  setReplyingTo(message);
                  setShowMobileMenu(false);
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs rounded-xl hover:bg-muted transition-colors cursor-pointer text-left"
              >
                <Reply className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Reply</span>
              </button>

              {/* Copy */}
              {displayBody && (
                <button
                  onClick={handleCopy}
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs rounded-xl hover:bg-muted transition-colors cursor-pointer text-left"
                >
                  {isCopied ? (
                    <CheckIcon className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                  <span>{isCopied ? 'Copied!' : 'Copy text'}</span>
                </button>
              )}

              {/* Save to Moments */}
              <button
                onClick={handleToggleFavorite}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs rounded-xl hover:bg-muted transition-colors cursor-pointer text-left"
              >
                <Bookmark className={cn('w-3.5 h-3.5', isBookmarked ? 'text-amber-500 fill-current' : 'text-muted-foreground')} />
                <span>{isBookmarked ? 'Unsave moment' : 'Save to Moments'}</span>
              </button>

              {/* Edit (if available) */}
              {isEditAvailable && (
                <button
                  onClick={() => {
                    setIsEditing(true);
                    setEditText(displayBody || '');
                    setShowMobileMenu(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs rounded-xl hover:bg-muted transition-colors cursor-pointer text-left"
                >
                  <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Edit message</span>
                </button>
              )}

              {/* Delete */}
              <button
                onClick={() => {
                  setShowMobileMenu(false);
                  setShowDeleteModal(true);
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs rounded-xl hover:bg-destructive/10 text-destructive transition-colors cursor-pointer text-left"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete message</span>
              </button>
            </div>
          </>
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
          <div className="mb-2">
            <ImagePreview
              src={message.signedMediaUrl}
              filename={message.original_filename}
              fileSize={message.file_size}
            />
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
            <p
              className={cn(
                'leading-relaxed whitespace-pre-wrap break-words',
                isLittleNote
                  ? 'font-serif text-sm italic text-foreground tracking-wide'
                  : 'text-sm font-sans'
              )}
            >
              {displayBody}
            </p>
          )
        )}

        {/* Timestamp & Status Metadata */}
        <div
          className={cn(
            'flex items-center gap-1.5 mt-1.5 text-[10px] select-none',
            isLittleNote
              ? 'justify-end text-muted-foreground'
              : isOutgoing
              ? 'justify-end text-white/75'
              : 'justify-end text-muted-foreground'
          )}
        >
          {isBookmarked && (
            <span title="Saved in Our Moments" className="text-amber-400 mr-0.5">
              <Bookmark className="w-2.5 h-2.5 fill-current" />
            </span>
          )}
          {message.edited_at && <span className="italic opacity-80">(edited)</span>}
          <span>{formatMessageTime(message.created_at)}</span>
          {renderStatus()}
        </div>
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
