'use client';

import * as React from 'react';
import {
  Send,
  Paperclip,
  Mic,
  Smile,
  X,
  Image as ImageIcon,
  Film,
  Music,
  FileText,
  AlertCircle,
  Sparkles,
  Heart,
} from 'lucide-react';
import { useChat } from '@/context/chat-context';
import { validateFileAttachment } from '@/lib/validations/message';
import { VoiceRecorderBar } from './voice-recorder-bar';
import { Button } from '@/components/ui/button';
import { cn, formatBytes } from '@/lib/utils';
import { spawnFloatingHearts } from '@/components/ui/floating-hearts';

export function MessageComposer() {
  const {
    sendMessage,
    replyingTo,
    setReplyingTo,
    broadcastTyping,
  } = useChat();

  const [text, setText] = React.useState('');
  const [isLittleNoteMode, setIsLittleNoteMode] = React.useState(false);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [filePreview, setFilePreview] = React.useState<string | null>(null);
  const [fileCategory, setFileCategory] = React.useState<'image' | 'video' | 'audio' | 'document'>('document');
  const [isRecordingVoice, setIsRecordingVoice] = React.useState(false);
  const [isSending, setIsSending] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [showAttachMenu, setShowAttachMenu] = React.useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = React.useState(false);

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const typingTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  const QUICK_EMOJIS = ['❤️', '💕', '🥰', '✨', '🌹', '☕', '😂', '🔥', '🎉'];

  // Handle typing indicator debounce
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    broadcastTyping(true);

    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      broadcastTyping(false);
    }, 2000);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateFileAttachment(file);
    if (!validation.valid) {
      setErrorMessage(validation.error || 'Invalid file');
      return;
    }

    setSelectedFile(file);
    setFileCategory(validation.category);

    if (validation.category === 'image') {
      setFilePreview(URL.createObjectURL(file));
    } else {
      setFilePreview(null);
    }

    setShowAttachMenu(false);
  };

  const clearAttachment = () => {
    setSelectedFile(null);
    setFilePreview(null);
    setErrorMessage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSend = async () => {
    if (isSending) return;
    const trimmed = text.trim();
    if (!trimmed && !selectedFile) return;

    setIsSending(true);
    setErrorMessage(null);

    const messageType: 'text' | 'image' | 'audio' | 'video' | 'file' = selectedFile
      ? (fileCategory === 'document' ? 'file' : fileCategory)
      : 'text';

    // Format body if Little Note mode is active
    const finalBody = trimmed
      ? (isLittleNoteMode ? `[💌 Note] ${trimmed}` : trimmed)
      : undefined;

    if (isLittleNoteMode || trimmed.includes('❤️') || trimmed.includes('💕')) {
      spawnFloatingHearts(window.innerWidth / 2, window.innerHeight - 100, 6);
    }

    const res = await sendMessage({
      messageType,
      body: finalBody,
      file: selectedFile || undefined,
      replyToId: replyingTo?.id,
    });

    setIsSending(false);

    if (res.error) {
      setErrorMessage(res.error);
    } else {
      setText('');
      setIsLittleNoteMode(false);
      clearAttachment();
      broadcastTyping(false);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSendVoice = async (file: File, durationSeconds: number) => {
    setIsRecordingVoice(false);
    await sendMessage({
      messageType: 'audio',
      file,
      durationSeconds,
      replyToId: replyingTo?.id,
    });
  };

  if (isRecordingVoice) {
    return (
      <VoiceRecorderBar
        onSendVoice={handleSendVoice}
        onCancel={() => setIsRecordingVoice(false)}
      />
    );
  }

  return (
    <div className="shrink-0 relative border-t border-border/70 bg-card/90 backdrop-blur-md p-2 sm:p-3 select-none transition-all pb-[max(env(safe-area-inset-bottom),0.625rem)]">
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Error alert if any */}
      {errorMessage && (
        <div className="flex items-center gap-2 mb-2 p-2 rounded-xl bg-destructive/10 text-destructive text-xs border border-destructive/20">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1 truncate">{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="p-0.5 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Quoted Reply Preview */}
      {replyingTo && (
        <div className="flex items-center justify-between gap-2 mb-2 p-2 px-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs">
          <div className="min-w-0">
            <span className="font-semibold text-primary">
              Replying to {replyingTo.sender?.display_name || 'Partner'}:
            </span>
            <p className="truncate text-muted-foreground">
              {replyingTo.body?.replace(/^\[💌 Note\]\s*/, '') ||
                replyingTo.original_filename ||
                `[${replyingTo.message_type}]`}
            </p>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
            aria-label="Cancel reply"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Little Note Mode Banner */}
      {isLittleNoteMode && (
        <div className="flex items-center justify-between gap-2 mb-2 px-3 py-1.5 rounded-xl bg-amber-500/10 dark:bg-amber-950/30 border border-amber-500/25 text-xs text-amber-700 dark:text-amber-200">
          <span className="flex items-center gap-1.5 font-serif italic">
            <span>💌</span> Composing a Little Note for your favorite person
          </span>
          <button
            onClick={() => setIsLittleNoteMode(false)}
            className="text-[11px] hover:underline font-sans cursor-pointer text-muted-foreground hover:text-foreground"
          >
            Normal text
          </button>
        </div>
      )}

      {/* Attachment Preview Bar */}
      {selectedFile && (
        <div className="flex items-center justify-between gap-3 mb-2 p-2 px-3 rounded-xl bg-muted/80 border border-border text-xs">
          <div className="flex items-center gap-2 min-w-0">
            {filePreview ? (
              <img
                src={filePreview}
                alt="Upload preview"
                className="w-10 h-10 rounded-lg object-cover border border-border"
              />
            ) : (
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <FileText className="w-5 h-5" />
              </div>
            )}
            <div className="min-w-0">
              <p className="font-medium truncate">{selectedFile.name}</p>
              <p className="text-[11px] text-muted-foreground font-mono">
                {formatBytes(selectedFile.size)}
              </p>
            </div>
          </div>
          <button
            onClick={clearAttachment}
            className="p-1 rounded-lg text-muted-foreground hover:text-destructive cursor-pointer"
            aria-label="Remove attachment"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Composer Row */}
      <div className="flex items-end gap-1.5 sm:gap-2">
        {/* Attachment menu trigger */}
        <div className="relative">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setShowAttachMenu(prev => !prev)}
            className="rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors cursor-pointer"
            title="Attach media or memories"
            aria-label="Attach file"
          >
            <Paperclip className="w-4.5 h-4.5" />
          </Button>

          {/* Attachment Type Popover */}
          {showAttachMenu && (
            <div className="absolute bottom-full mb-2 left-0 w-52 rounded-2xl bg-card border border-border/80 p-1.5 shadow-xl z-30 animate-in zoom-in-95 space-y-0.5 backdrop-blur-md">
              <button
                type="button"
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = 'image/*';
                    fileInputRef.current.click();
                  }
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium hover:bg-muted text-foreground transition-colors cursor-pointer"
              >
                <ImageIcon className="w-4 h-4 text-rose-500" />
                Photos & Memories
              </button>
              <button
                type="button"
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = 'audio/*';
                    fileInputRef.current.click();
                  }
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium hover:bg-muted text-foreground transition-colors cursor-pointer"
              >
                <Music className="w-4 h-4 text-violet-500" />
                Songs & Audio
              </button>
              <button
                type="button"
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = 'video/*';
                    fileInputRef.current.click();
                  }
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium hover:bg-muted text-foreground transition-colors cursor-pointer"
              >
                <Film className="w-4 h-4 text-sky-500" />
                Videos
              </button>
              <button
                type="button"
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = '*/*';
                    fileInputRef.current.click();
                  }
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium hover:bg-muted text-foreground transition-colors cursor-pointer"
              >
                <FileText className="w-4 h-4 text-amber-500" />
                Files & Documents
              </button>
            </div>
          )}
        </div>

        {/* Little Note Toggle Button */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setIsLittleNoteMode(prev => !prev)}
          className={cn(
            'rounded-xl transition-colors cursor-pointer',
            isLittleNoteMode
              ? 'text-amber-500 bg-amber-500/15 hover:bg-amber-500/20'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
          )}
          title={isLittleNoteMode ? 'Little Note mode enabled' : 'Send as a Little Note'}
          aria-label="Toggle Little Note mode"
        >
          <span className="text-sm">💌</span>
        </Button>

        {/* Text Input Area */}
        <div
          className={cn(
            'flex-1 relative flex items-center bg-background/80 rounded-2xl border shadow-xs transition-all',
            isLittleNoteMode
              ? 'border-amber-400/50 bg-amber-50/30 dark:bg-amber-950/20 focus-within:ring-2 focus-within:ring-amber-500/20'
              : 'border-input focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20'
          )}
        >
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder={
              isLittleNoteMode
                ? 'Write your heartfelt note...'
                : 'Type a message... (Enter to send, Shift+Enter for newline)'
            }
            rows={1}
            className={cn(
              'w-full px-3.5 py-2.5 text-sm bg-transparent border-0 focus:outline-none resize-none max-h-32 placeholder:text-muted-foreground',
              isLittleNoteMode && 'font-serif italic'
            )}
          />

          {/* Quick Emoji Button */}
          <div className="relative pr-2">
            <button
              type="button"
              onClick={() => setShowEmojiPicker(prev => !prev)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title="Insert romantic emoji"
              aria-label="Insert emoji"
            >
              <Smile className="w-4 h-4" />
            </button>

            {showEmojiPicker && (
              <div className="absolute bottom-full mb-2 right-0 flex items-center gap-1 p-2 rounded-2xl bg-card border border-border shadow-xl z-30 animate-in zoom-in-95 backdrop-blur-md">
                {QUICK_EMOJIS.map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      setText(prev => prev + emoji);
                      setShowEmojiPicker(false);
                      textareaRef.current?.focus();
                      if (emoji === '❤️' || emoji === '💕') {
                        spawnFloatingHearts(window.innerWidth / 2, window.innerHeight - 100, 4);
                      }
                    }}
                    className="p-1 text-base hover:scale-130 transition-transform cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Send / Voice Record Button */}
        {text.trim() || selectedFile ? (
          <Button
            type="button"
            onClick={handleSend}
            isLoading={isSending}
            size="icon"
            className="rounded-2xl shrink-0 bg-[#0C3B2E] hover:bg-[#155E49] text-white shadow-sm hover:scale-105 active:scale-95 transition-all cursor-pointer"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setIsRecordingVoice(true)}
            className="rounded-2xl shrink-0 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
            title="Record voice message"
            aria-label="Record voice message"
          >
            <Mic className="w-5 h-5" />
          </Button>
        )}
      </div>
    </div>
  );
}
