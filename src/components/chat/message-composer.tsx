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
  Camera,
  Loader2,
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

  const QUICK_EMOJIS = ['❤️', '💕', '🥰', '😘', '✨', '🌹', '☕', '😂', '🔥', '🎉'];

  // Handle typing indicator debounce and auto-expand textarea
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    broadcastTyping(true);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }

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
      <div className="shrink-0 relative border-t border-border/70 bg-card/95 backdrop-blur-md p-2 sm:p-2.5 select-none transition-all pb-[max(env(safe-area-inset-bottom),0.625rem)]">
        <VoiceRecorderBar
          onSendVoice={handleSendVoice}
          onCancel={() => setIsRecordingVoice(false)}
        />
      </div>
    );
  }

  return (
    <div className="shrink-0 relative border-t border-border/60 bg-background/95 dark:bg-[#111B21] backdrop-blur-md px-2 py-2 sm:px-3 sm:py-2.5 select-none transition-all pb-[max(env(safe-area-inset-bottom),0.5rem)]">
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Error alert if any */}
      {errorMessage && (
        <div className="flex items-center gap-2 mb-2 p-2 rounded-xl bg-destructive/10 text-destructive text-xs border border-destructive/20 animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1 truncate">{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="p-0.5 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* WhatsApp Quoted Reply Preview */}
      {replyingTo && (
        <div className="flex items-center justify-between gap-2 mb-2 p-2.5 px-3 rounded-2xl bg-muted/90 dark:bg-[#202C33] border-l-4 border-l-emerald-600 dark:border-l-emerald-400 border border-border/60 text-xs shadow-2xs animate-in slide-in-from-bottom-2">
          <div className="min-w-0">
            <span className="font-semibold text-emerald-700 dark:text-emerald-400">
              {replyingTo.sender?.display_name || 'Partner'}
            </span>
            <p className="truncate text-muted-foreground mt-0.5">
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
        <div className="flex items-center justify-between gap-2 mb-2 px-3 py-1.5 rounded-2xl bg-amber-500/10 dark:bg-amber-950/30 border border-amber-500/25 text-xs text-amber-700 dark:text-amber-200 animate-in fade-in">
          <span className="flex items-center gap-1.5 font-serif italic">
            <span>💌</span> Composing a Little Note
          </span>
          <button
            onClick={() => setIsLittleNoteMode(false)}
            className="text-[11px] hover:underline font-sans cursor-pointer text-muted-foreground hover:text-foreground"
          >
            Normal text
          </button>
        </div>
      )}

      {/* Selected File Attachment Preview Chip */}
      {selectedFile && (
        <div className="flex items-center justify-between gap-3 mb-2 p-2 px-3 rounded-2xl bg-card dark:bg-[#202C33] border border-border/80 text-xs shadow-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            {filePreview ? (
              <img
                src={filePreview}
                alt="Upload preview"
                className="w-10 h-10 rounded-xl object-cover border border-border"
              />
            ) : (
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
                <FileText className="w-5 h-5" />
              </div>
            )}
            <div className="min-w-0">
              <p className="font-semibold truncate text-foreground">{selectedFile.name}</p>
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

      {/* Main WhatsApp Composer Bar */}
      <div className="flex items-end gap-2">
        {/* WhatsApp Signature Input Pill */}
        <div
          className={cn(
            'flex-1 flex items-end gap-1 px-2 py-1 rounded-[24px] bg-card dark:bg-[#202C33] border border-border/70 dark:border-white/10 shadow-xs transition-all relative focus-within:border-emerald-500/50 focus-within:ring-2 focus-within:ring-emerald-500/15',
            isLittleNoteMode && 'ring-2 ring-amber-500/30 border-amber-500/40 bg-amber-50/20 dark:bg-amber-950/20'
          )}
        >
          {/* 1. Emoji Picker Button */}
          <div className="relative shrink-0 pb-0.5">
            <button
              type="button"
              onClick={() => setShowEmojiPicker(prev => !prev)}
              className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors cursor-pointer"
              title="Insert emoji"
              aria-label="Insert emoji"
            >
              <Smile className="w-5 h-5" />
            </button>

            {/* Quick Emoji Popover */}
            {showEmojiPicker && (
              <div className="absolute bottom-full mb-2.5 left-0 flex items-center gap-1 p-2 rounded-2xl bg-card dark:bg-[#202C33] border border-border/80 shadow-xl z-30 animate-in zoom-in-95 backdrop-blur-md">
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

          {/* 2. Attachment Paperclip Button */}
          <div className="relative shrink-0 pb-0.5">
            <button
              type="button"
              onClick={() => setShowAttachMenu(prev => !prev)}
              className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors cursor-pointer"
              title="Attach media or document"
              aria-label="Attach file"
            >
              <Paperclip className="w-5 h-5" />
            </button>

            {/* WhatsApp Attachment Popover Menu */}
            {showAttachMenu && (
              <div className="absolute bottom-full mb-3 left-0 w-56 rounded-3xl bg-card dark:bg-[#233138] border border-border/80 dark:border-white/10 p-2 shadow-2xl z-30 animate-in zoom-in-95 space-y-1 backdrop-blur-md">
                <button
                  type="button"
                  onClick={() => {
                    if (fileInputRef.current) {
                      fileInputRef.current.accept = 'image/*';
                      fileInputRef.current.click();
                    }
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-xs font-semibold hover:bg-muted/70 text-foreground transition-colors cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-full bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                    <ImageIcon className="w-4 h-4" />
                  </div>
                  <span>Photos & Videos</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (fileInputRef.current) {
                      fileInputRef.current.accept = 'audio/*';
                      fileInputRef.current.click();
                    }
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-xs font-semibold hover:bg-muted/70 text-foreground transition-colors cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <Music className="w-4 h-4" />
                  </div>
                  <span>Audio & Songs</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (fileInputRef.current) {
                      fileInputRef.current.accept = '*/*';
                      fileInputRef.current.click();
                    }
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-xs font-semibold hover:bg-muted/70 text-foreground transition-colors cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-full bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <span>Document / File</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsLittleNoteMode(prev => !prev);
                    setShowAttachMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-xs font-semibold hover:bg-muted/70 text-foreground transition-colors cursor-pointer border-t border-border/40"
                >
                  <div className="w-8 h-8 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <span>💌 Little Note</span>
                </button>
              </div>
            )}
          </div>

          {/* 3. Text Input (Auto-Expanding) */}
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder={
              isLittleNoteMode
                ? 'Write your heartfelt Little Note...'
                : 'Type a message'
            }
            rows={1}
            className={cn(
              'flex-1 min-h-[36px] max-h-32 px-1.5 py-1.5 text-sm bg-transparent border-0 outline-none focus:outline-none focus:ring-0 resize-none placeholder:text-muted-foreground leading-normal',
              isLittleNoteMode && 'font-serif italic text-amber-900 dark:text-amber-100'
            )}
          />

          {/* 4. Little Note Quick Shortcut */}
          <div className="shrink-0 pb-0.5">
            <button
              type="button"
              onClick={() => setIsLittleNoteMode(prev => !prev)}
              className={cn(
                'p-1.5 rounded-full transition-transform cursor-pointer text-sm',
                isLittleNoteMode
                  ? 'bg-amber-500/20 ring-1 ring-amber-500/40 scale-110'
                  : 'hover:bg-muted/70 opacity-70 hover:opacity-100'
              )}
              title={isLittleNoteMode ? 'Little Note active' : 'Send as Little Note'}
            >
              💌
            </button>
          </div>
        </div>

        {/* WhatsApp Circular Action Button (Emerald Circle) */}
        <button
          type="button"
          onClick={text.trim() || selectedFile ? handleSend : () => setIsRecordingVoice(true)}
          disabled={isSending}
          className="w-11 h-11 rounded-full shrink-0 flex items-center justify-center bg-[#005C4B] hover:bg-[#004D3F] text-white shadow-md active:scale-90 transition-all cursor-pointer"
          title={text.trim() || selectedFile ? 'Send message' : 'Record voice note'}
          aria-label={text.trim() || selectedFile ? 'Send' : 'Record Voice'}
        >
          {isSending ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : text.trim() || selectedFile ? (
            <Send className="w-5 h-5 ml-0.5" />
          ) : (
            <Mic className="w-5 h-5" />
          )}
        </button>
      </div>
    </div>
  );
}
