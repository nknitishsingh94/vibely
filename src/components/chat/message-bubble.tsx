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
  const [isCopied, setIsCopied] = React.useState(false);

  const isOutgoing = message.sender_id === profile?.id;

  // Check if message is a "Little Note"
  const isLittleNote = message.body?.startsWith('[💌 Note]') || false;
  const displayBody = isLittleNote
    ? message.body?.replace(/^\[💌 Note\]\s*/, '')
    : message.body;

  // Status icon for outgoing messages (WhatsApp-style ticks)
  const renderStatus = () => {
    if (!isOutgoing) return null;

    // 1. Clock icon if sending/pending
    if (message.deliveryStatus === 'sending' || message.isOptimistic) {
      return (
        <span title="Sending..." className="inline-flex items-center text-white/70">
          <Clock className="w-3 h-3 animate-pulse" />
        </span>
      );
    }

    // 2. Error / Failed
    if (message.deliveryStatus === 'failed') {
      return (
        <span title="Failed to send" className="inline-flex items-center text-rose-300">
          <AlertCircle className="w-3.5 h-3.5" />
        </span>
      );
    }

    // 3. Seen / Read -> Double check with color change (WhatsApp Sky Blue!)
    if (message.deliveryStatus === 'read') {
      return (
        <span title="Read" className="inline-flex items-center text-[#38BDF8] dark:text-[#53BDEB]">
          <CheckCheck className="w-3.5 h-3.5 stroke-[2.5]" />
        </span>
      );
    }

    // 4. Delivered (partner is online) -> Double check
    if (message.deliveryStatus === 'delivered' || friendPresence.online) {
      return (
        <span title="Delivered (Partner is online)" className="inline-flex items-center text-white/75">
          <CheckCheck className="w-3.5 h-3.5 stroke-[2]" />
        </span>
      );
    }

    // 5. Sent (partner is offline) -> Single check
    return (
      <span title="Sent (Partner is offline)" className="inline-flex items-center text-white/70">
        <Check className="w-3.5 h-3.5 stroke-[2]" />
      </span>
    );
  };

  const handleCopy = () => {
    if (displayBody) {
      navigator.clipboard.writeText(displayBody);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const handleSaveEdit = async () => {
    if (editText.trim() && editText !== displayBody) {
      const updated = isLittleNote ? `[💌 Note] ${editText.trim()}` : editText.trim();
      await editMessage(message.id, updated);
    }
    setIsEditing(false);
  };

  const handleDelete = async () => {
    await deleteMessage(message.id);
    setShowDeleteModal(false);
  };

  const handleReactionClick = (emoji: string, e?: React.MouseEvent) => {
    if (emoji === '❤️' || emoji === '💕' || emoji === '🥰') {
      const rect = (e?.currentTarget as HTMLElement)?.getBoundingClientRect();
      spawnFloatingHearts(rect?.left ?? window.innerWidth / 2, rect?.top ?? window.innerHeight / 2, 7);
    }
    toggleReaction(message.id, emoji);
    setShowReactionPicker(false);
  };

  const handleToggleFavorite = (e: React.MouseEvent) => {
    const isNowFav = toggleFav(message.id);
    if (isNowFav) {
      const rect = (e?.currentTarget as HTMLElement)?.getBoundingClientRect();
      spawnFloatingHearts(rect?.left ?? window.innerWidth / 2, rect?.top ?? window.innerHeight / 2, 5);
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
      {/* Quick Action Floating Toolbar on Hover */}
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

          {/* Copy */}
          {displayBody && (
            <button
              onClick={handleCopy}
              aria-label="Copy text"
              className="p-1.5 rounded-xl hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
            >
              {isCopied ? <CheckIcon className="w-3.5 h-3.5 text-rose-500" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          )}

          {/* Edit (only text and only outgoing) */}
          {isOutgoing && message.message_type === 'text' && (
            <button
              onClick={() => {
                setIsEditing(true);
                setEditText(displayBody || '');
              }}
              aria-label="Edit message"
              className="p-1.5 rounded-xl hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Delete */}
          {isOutgoing && (
            <button
              onClick={() => setShowDeleteModal(true)}
              aria-label="Delete message"
              className="p-1.5 rounded-xl hover:bg-destructive/10 hover:text-destructive transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
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
        className={cn(
          'relative max-w-[85%] sm:max-w-md rounded-2xl p-3 sm:p-3.5 shadow-xs transition-all',
          isLittleNote
            ? 'little-note-card rounded-2xl'
            : isOutgoing
            ? 'bg-[#0C3B2E] text-white rounded-br-xs shadow-sm shadow-[#0C3B2E]/15'
            : 'bg-white dark:bg-[#0D281E] text-foreground border border-border/70 rounded-bl-xs shadow-2xs'
        )}
      >
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
            const isHeartEmoji = emoji === '❤️' || emoji === '💕' || emoji === '🥰';

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

      {/* Delete Confirmation Modal */}
      <Dialog
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        size="sm"
        title="Delete moment?"
        description="Are you sure you want to delete this message? This action removes it for both of you."
      >
        <div className="flex items-center justify-end gap-2 pt-4">
          <Button variant="outline" size="sm" onClick={() => setShowDeleteModal(false)}>
            Cancel
          </Button>
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            Delete for both of us
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
