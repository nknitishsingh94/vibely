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
  Plus,
} from 'lucide-react';
import { useChat } from '@/context/chat-context';
import { validateFileAttachment } from '@/lib/validations/message';
import { VoiceRecorderBar } from './voice-recorder-bar';
import { cn, formatBytes } from '@/lib/utils';
import { spawnFloatingHearts } from '@/components/ui/floating-hearts';

interface PendingAttachment {
  id: string;
  file: File;
  category: 'image' | 'video' | 'audio' | 'document';
  previewUrl: string | null;
}

export function MessageComposer() {
  const {
    sendMessage,
    replyingTo,
    setReplyingTo,
    broadcastTyping,
  } = useChat();

  const [text, setText] = React.useState('');
  const [isLittleNoteMode, setIsLittleNoteMode] = React.useState(false);
  const [attachments, setAttachments] = React.useState<PendingAttachment[]>([]);
  const [isRecordingVoice, setIsRecordingVoice] = React.useState(false);
  const [isSending, setIsSending] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [showAttachMenu, setShowAttachMenu] = React.useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = React.useState(false);

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const typingTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const currentModeRef = React.useRef<'document' | 'gallery' | 'audio' | 'camera'>('gallery');

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

  const openFilePicker = (mode: 'document' | 'gallery' | 'audio' | 'camera') => {
    currentModeRef.current = mode;
    setShowAttachMenu(false);
    if (!fileInputRef.current) return;

    if (mode === 'document') {
      fileInputRef.current.accept = '*/*';
      fileInputRef.current.multiple = true;
      fileInputRef.current.removeAttribute('capture');
    } else if (mode === 'gallery') {
      fileInputRef.current.accept = 'image/*,video/*';
      fileInputRef.current.multiple = true;
      fileInputRef.current.removeAttribute('capture');
    } else if (mode === 'audio') {
      fileInputRef.current.accept = 'audio/*';
      fileInputRef.current.multiple = true;
      fileInputRef.current.removeAttribute('capture');
    } else if (mode === 'camera') {
      fileInputRef.current.accept = 'image/*';
      fileInputRef.current.multiple = false;
      fileInputRef.current.capture = 'environment';
    }

    fileInputRef.current.click();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const currentMode = currentModeRef.current;
    const newAttachments: PendingAttachment[] = [];
    const errors: string[] = [];

    for (const file of files) {
      const validation = validateFileAttachment(
        file,
        currentMode === 'document' ? 'document' : undefined
      );

      if (!validation.valid) {
        errors.push(validation.error || `${file.name} is invalid`);
        continue;
      }

      newAttachments.push({
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${file.name}`,
        file,
        category: currentMode === 'document' ? 'document' : validation.category,
        previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
      });
    }

    if (errors.length > 0) {
      setErrorMessage(
        errors.slice(0, 2).join('; ') + (errors.length > 2 ? ` (+${errors.length - 2} more)` : '')
      );
    }

    if (newAttachments.length > 0) {
      setAttachments(prev => [...prev, ...newAttachments]);
    }

    // Reset input so same files can be re-selected if cleared, or more added
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => {
      const item = prev.find(a => a.id === id);
      if (item?.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
      }
      return prev.filter(a => a.id !== id);
    });
  };

  const clearAllAttachments = () => {
    attachments.forEach(a => {
      if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
    });
    setAttachments([]);
    setErrorMessage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Cleanup object URLs on unmount
  React.useEffect(() => {
    return () => {
      attachments.forEach(a => {
        if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
      });
    };
  }, [attachments]);

  const handleSend = async () => {
    if (isSending) return;
    const trimmed = text.trim();
    if (!trimmed && attachments.length === 0) return;

    // Immediately keep focus on textarea so soft keyboard stays up on mobile
    if (textareaRef.current) {
      textareaRef.current.focus();
    }

    setIsSending(true);
    setErrorMessage(null);

    const finalBody = trimmed
      ? (isLittleNoteMode ? `[💌 Note] ${trimmed}` : trimmed)
      : undefined;

    if (isLittleNoteMode || (trimmed && (trimmed.includes('❤️') || trimmed.includes('💕')))) {
      spawnFloatingHearts(window.innerWidth / 2, window.innerHeight - 100, 6);
    }

    // Case 1: Pure text message
    if (attachments.length === 0) {
      // Clear text IMMEDIATELY for instant, snappy WhatsApp feel
      setText('');
      setIsLittleNoteMode(false);
      broadcastTyping(false);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.focus();
      }

      const res = await sendMessage({
        messageType: 'text',
        body: finalBody,
        replyToId: replyingTo?.id,
      });

      setIsSending(false);

      if (res.error) {
        setErrorMessage(res.error);
        setText(trimmed);
      }

      // Re-affirm focus after sending so keyboard never dismisses
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
      return;
    }

    // Case 2: One or more attachments (bulk/batch send)
    const queue = [...attachments];
    let failedIndex = -1;

    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      setUploadProgress(queue.length > 1 ? `Sending ${i + 1} of ${queue.length}...` : 'Sending...');

      const messageType: 'image' | 'video' | 'audio' | 'file' =
        item.category === 'document' ? 'file' : item.category;

      // Attach text caption to the first attachment only
      const caption = i === 0 ? finalBody : undefined;

      const res = await sendMessage({
        messageType,
        body: caption,
        file: item.file,
        replyToId: i === 0 ? replyingTo?.id : undefined,
      });

      if (res.error) {
        failedIndex = i;
        setErrorMessage(`Failed sending ${item.file.name}: ${res.error}`);
        break;
      }
    }

    setIsSending(false);
    setUploadProgress(null);

    if (failedIndex === -1) {
      // All items succeeded!
      setText('');
      setIsLittleNoteMode(false);
      clearAllAttachments();
      broadcastTyping(false);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.focus();
      }
    } else {
      // Partially sent; remove only the sent items from queue
      const remaining = queue.slice(failedIndex);
      for (let j = 0; j < failedIndex; j++) {
        if (queue[j].previewUrl) URL.revokeObjectURL(queue[j].previewUrl!);
      }
      setAttachments(remaining);
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
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

      {/* Progress status for multi-file uploading */}
      {uploadProgress && (
        <div className="flex items-center gap-2 mb-2 p-2 px-3 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs border border-emerald-500/20 animate-in fade-in">
          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
          <span className="font-medium">{uploadProgress}</span>
        </div>
      )}

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

      {/* WhatsApp Attachment Popover Menu */}
      {showAttachMenu && (
        <>
          {/* Backdrop to close menu when tapping outside */}
          <div
            className="fixed inset-0 z-20"
            onClick={() => setShowAttachMenu(false)}
          />

          {/* WhatsApp Popover Grid */}
          <div className="absolute bottom-full mb-3 left-2 sm:left-6 z-30 w-72 sm:w-80 p-3 rounded-2xl bg-white dark:bg-[#233138] border border-border/80 dark:border-white/10 shadow-2xl animate-in zoom-in-95 duration-150 backdrop-blur-md">
            <div className="text-[11px] font-semibold text-muted-foreground px-2 pb-2 mb-1 border-b border-border/40 dark:border-white/5 flex items-center justify-between">
              <span>Send Attachments</span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-normal">
                Multi-select supported
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2.5 pt-1">
              {/* Document Option (Photos, PDFs, uncompressed files) */}
              <button
                type="button"
                onClick={() => openFilePicker('document')}
                className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-muted/60 dark:hover:bg-white/5 active:scale-95 transition-all cursor-pointer group"
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-600 to-indigo-500 shadow-md flex items-center justify-center text-white group-hover:scale-105 transition-transform">
                  <FileText className="w-6 h-6" />
                </div>
                <div className="text-center">
                  <span className="text-xs font-medium text-foreground block">Document</span>
                  <span className="text-[9px] text-muted-foreground leading-none block">Pics, docs & raw</span>
                </div>
              </button>

              {/* Gallery Option (Photos & Videos) */}
              <button
                type="button"
                onClick={() => openFilePicker('gallery')}
                className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-muted/60 dark:hover:bg-white/5 active:scale-95 transition-all cursor-pointer group"
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-purple-600 to-fuchsia-500 shadow-md flex items-center justify-center text-white group-hover:scale-105 transition-transform">
                  <ImageIcon className="w-6 h-6" />
                </div>
                <div className="text-center">
                  <span className="text-xs font-medium text-foreground block">Gallery</span>
                  <span className="text-[9px] text-muted-foreground leading-none block">Photos & videos</span>
                </div>
              </button>

              {/* Camera Option */}
              <button
                type="button"
                onClick={() => openFilePicker('camera')}
                className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-muted/60 dark:hover:bg-white/5 active:scale-95 transition-all cursor-pointer group"
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-rose-500 to-pink-500 shadow-md flex items-center justify-center text-white group-hover:scale-105 transition-transform">
                  <Camera className="w-6 h-6" />
                </div>
                <div className="text-center">
                  <span className="text-xs font-medium text-foreground block">Camera</span>
                  <span className="text-[9px] text-muted-foreground leading-none block">Take photo</span>
                </div>
              </button>

              {/* Audio Option */}
              <button
                type="button"
                onClick={() => openFilePicker('audio')}
                className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-muted/60 dark:hover:bg-white/5 active:scale-95 transition-all cursor-pointer group"
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-amber-500 to-orange-500 shadow-md flex items-center justify-center text-white group-hover:scale-105 transition-transform">
                  <Music className="w-6 h-6" />
                </div>
                <div className="text-center">
                  <span className="text-xs font-medium text-foreground block">Audio</span>
                  <span className="text-[9px] text-muted-foreground leading-none block">Music & voice</span>
                </div>
              </button>

              {/* Little Note Option */}
              <button
                type="button"
                onClick={() => {
                  setIsLittleNoteMode(prev => !prev);
                  setShowAttachMenu(false);
                }}
                className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-muted/60 dark:hover:bg-white/5 active:scale-95 transition-all cursor-pointer group"
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-pink-500 to-rose-400 shadow-md flex items-center justify-center text-white group-hover:scale-105 transition-transform">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div className="text-center">
                  <span className="text-xs font-medium text-foreground block">Little Note</span>
                  <span className="text-[9px] text-muted-foreground leading-none block">Special style</span>
                </div>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Selected Attachments Tray / Carousel (Multi-File Support) */}
      {attachments.length > 0 && (
        <div className="mb-2 p-2 sm:p-2.5 rounded-2xl bg-card dark:bg-[#202C33] border border-border/80 text-xs shadow-xs animate-in fade-in slide-in-from-bottom-2">
          {/* Header of tray */}
          <div className="flex items-center justify-between mb-2 px-1">
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <Paperclip className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 -rotate-45" />
              <span>
                {attachments.length} {attachments.length === 1 ? 'file' : 'files'} selected
              </span>
              {attachments.some(a => a.category === 'document') && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 font-semibold tracking-wider">
                  Document Mode
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => openFilePicker(attachments[0]?.category === 'document' ? 'document' : 'gallery')}
                className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer flex items-center gap-0.5"
              >
                <Plus className="w-3 h-3" /> Add more
              </button>
              <span className="text-muted-foreground/40">•</span>
              <button
                type="button"
                onClick={clearAllAttachments}
                className="text-[11px] font-medium text-muted-foreground hover:text-destructive cursor-pointer"
              >
                Clear all
              </button>
            </div>
          </div>

          {/* Horizontal scrollable items */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 scrollbar-thin">
            {attachments.map((att) => (
              <div
                key={att.id}
                className="relative shrink-0 flex items-center gap-2 p-1.5 pr-2 rounded-xl bg-background/90 dark:bg-[#111B21] border border-border/70 max-w-[190px] shadow-2xs group"
              >
                {/* Thumbnail or File Icon */}
                {att.previewUrl ? (
                  <div className="relative w-11 h-11 rounded-lg overflow-hidden shrink-0 border border-border/60">
                    <img
                      src={att.previewUrl}
                      alt={att.file.name}
                      className="w-full h-full object-cover"
                    />
                    {att.category === 'document' && (
                      <span className="absolute bottom-0 inset-x-0 bg-black/75 text-[8px] text-center font-bold text-white py-0.5 uppercase tracking-wider">
                        DOC
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="w-11 h-11 rounded-lg bg-muted flex items-center justify-center shrink-0 text-muted-foreground">
                    {att.category === 'document' ? (
                      <FileText className="w-5 h-5 text-indigo-500" />
                    ) : att.category === 'audio' ? (
                      <Music className="w-5 h-5 text-amber-500" />
                    ) : (
                      <Film className="w-5 h-5 text-purple-500" />
                    )}
                  </div>
                )}

                {/* File info */}
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium truncate text-foreground leading-tight" title={att.file.name}>
                    {att.file.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                    {formatBytes(att.file.size)}
                  </p>
                </div>

                {/* Delete button */}
                <button
                  type="button"
                  onClick={() => removeAttachment(att.id)}
                  className="w-5 h-5 rounded-full bg-muted/80 hover:bg-destructive hover:text-white text-muted-foreground flex items-center justify-center transition-colors cursor-pointer shrink-0 ml-1"
                  title="Remove file"
                  aria-label="Remove file"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Composer Row matching WhatsApp - 100% Mobile Responsive */}
      <div className="flex items-end gap-1.5 sm:gap-2">
        {/* Input pill */}
        <div
          className={cn(
            'flex-1 min-w-0 flex items-end gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-[22px] bg-card dark:bg-[#202C33] border border-border/80 dark:border-white/10 shadow-xs transition-all relative focus-within:border-emerald-500/50 focus-within:ring-2 focus-within:ring-emerald-500/15',
            isLittleNoteMode && 'ring-2 ring-amber-500/30 border-amber-500/40 bg-amber-50/20 dark:bg-amber-950/20'
          )}
        >
          {/* Emoji button inside pill on left */}
          <div className="relative shrink-0 mb-0.5">
            <button
              type="button"
              onClick={() => setShowEmojiPicker(prev => !prev)}
              className="w-9 h-9 md:w-8 md:h-8 flex items-center justify-center rounded-full text-muted-foreground/80 hover:text-foreground active:scale-95 transition-all cursor-pointer"
              title="Insert emoji"
              aria-label="Insert emoji"
            >
              <Smile className="w-5.5 h-5.5 md:w-5 md:h-5" />
            </button>

            {/* Quick Emoji Popover */}
            {showEmojiPicker && (
              <div className="absolute bottom-full mb-3 left-0 flex items-center gap-1 p-2 rounded-2xl bg-card dark:bg-[#202C33] border border-border/80 shadow-2xl z-30 animate-in zoom-in-95 backdrop-blur-md">
                {QUICK_EMOJIS.map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setText(prev => prev + emoji);
                      setShowEmojiPicker(false);
                      textareaRef.current?.focus();
                      if (emoji === '❤️' || emoji === '💕') {
                        spawnFloatingHearts(window.innerWidth / 2, window.innerHeight - 100, 4);
                      }
                    }}
                    className="p-1 text-base hover:scale-125 transition-transform cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              setTimeout(() => {
                const scrollEl = document.querySelector('.message-scroll-container');
                if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
              }, 150);
            }}
            placeholder={
              isLittleNoteMode
                ? 'Write your Little Note...'
                : attachments.length > 0
                ? 'Add a caption...'
                : 'Message'
            }
            rows={1}
            className={cn(
              'flex-1 min-w-0 min-h-[40px] md:min-h-[36px] max-h-28 px-1.5 py-2 text-base md:text-sm bg-transparent border-0 outline-none focus:outline-none focus:ring-0 resize-none placeholder:text-muted-foreground leading-normal',
              isLittleNoteMode && 'font-serif italic text-amber-900 dark:text-amber-100'
            )}
          />

          {/* WhatsApp Attachment Button (Paperclip) */}
          <button
            type="button"
            onClick={() => setShowAttachMenu(prev => !prev)}
            className={cn(
              'w-9 h-9 md:w-8 md:h-8 flex items-center justify-center rounded-full transition-all cursor-pointer shrink-0 mb-0.5 active:scale-95',
              showAttachMenu
                ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
                : 'text-muted-foreground/80 hover:text-foreground'
            )}
            title="Attach documents, photos & media"
            aria-label="Attach file"
          >
            <Paperclip className="w-5.5 h-5.5 md:w-5 md:h-5 -rotate-45" />
          </button>

          {/* Quick Camera button */}
          <button
            type="button"
            onClick={() => openFilePicker('camera')}
            className="w-9 h-9 md:w-8 md:h-8 flex items-center justify-center rounded-full text-muted-foreground/80 hover:text-foreground active:scale-95 transition-all cursor-pointer shrink-0 mb-0.5"
            title="Open camera"
            aria-label="Camera"
          >
            <Camera className="w-5.5 h-5.5 md:w-5 md:h-5" />
          </button>
        </div>

        {/* Right Action Button: Enlarged 44px on mobile, fixed spot */}
        {text.trim() || attachments.length > 0 ? (
          <button
            type="button"
            onMouseDown={(e) => {
              // Crucial: prevent textarea blur on pointer press
              e.preventDefault();
            }}
            onClick={(e) => {
              e.preventDefault();
              if (textareaRef.current) {
                textareaRef.current.focus();
              }
              handleSend();
            }}
            className="w-11 h-11 md:w-10 md:h-10 rounded-full shrink-0 flex items-center justify-center bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white shadow-md transition-all cursor-pointer"
            title="Send chat"
            aria-label="Send"
          >
            {isSending ? (
              <Loader2 className="w-5 h-5 md:w-4 md:h-4 animate-spin" />
            ) : (
              <Send className="w-5 h-5 md:w-4 md:h-4 ml-0.5 fill-current" />
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIsRecordingVoice(true)}
            className="w-11 h-11 md:w-10 md:h-10 rounded-full shrink-0 flex items-center justify-center bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white shadow-md transition-all cursor-pointer"
            title="Record voice note"
            aria-label="Record voice note"
          >
            <Mic className="w-5.5 h-5.5 md:w-5 md:h-5 text-white" />
          </button>
        )}
      </div>
    </div>
  );
}
