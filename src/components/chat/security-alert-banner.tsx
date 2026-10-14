'use client';

import * as React from 'react';
import { Camera, Save, Download, X } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { useChat } from '@/context/chat-context';
import { cn } from '@/lib/utils';

/**
 * Snapchat-Style Live Floating Security Alert Banner
 * Pops down from the top of the chat whenever anyone takes a screenshot or saves media
 */
export function SecurityAlertBanner() {
  const { profile } = useAuth();
  const { securityAlert, dismissSecurityAlert, activeConversationId } = useChat();

  if (!securityAlert || (activeConversationId && securityAlert.conversationId !== activeConversationId)) {
    return null;
  }

  const isSelf = securityAlert.userId === profile?.id;
  const isScreenshot = securityAlert.type === 'screenshot';
  const isVideo = securityAlert.type === 'video_saved';
  const isPhoto = securityAlert.type === 'media_saved';

  let title = 'Screenshot';
  let description = isSelf
    ? 'You took a screenshot of the chat'
    : `${securityAlert.userName} took a screenshot of the chat!`;
  let badgeColor = 'bg-amber-500/20 text-amber-400 border-amber-500/40';
  let pillBorder = 'border-amber-500/40 shadow-amber-500/10';

  if (isVideo) {
    title = 'Video Saved';
    description = isSelf
      ? 'You saved a video to gallery'
      : `${securityAlert.userName} saved a video to gallery!`;
    badgeColor = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
    pillBorder = 'border-emerald-500/40 shadow-emerald-500/10';
  } else if (isPhoto) {
    title = 'Photo Saved';
    description = isSelf
      ? 'You saved a photo to gallery'
      : `${securityAlert.userName} saved a photo to gallery!`;
    badgeColor = 'bg-sky-500/20 text-sky-400 border-sky-500/40';
    pillBorder = 'border-sky-500/40 shadow-sky-500/10';
  } else if (securityAlert.type === 'file_downloaded') {
    title = 'File Downloaded';
    description = isSelf
      ? `You downloaded ${securityAlert.filename || 'a file'}`
      : `${securityAlert.userName} downloaded ${securityAlert.filename || 'a file'}!`;
    badgeColor = 'bg-indigo-500/20 text-indigo-400 border-indigo-500/40';
    pillBorder = 'border-indigo-500/40 shadow-indigo-500/10';
  }

  return (
    <div className="absolute top-16 sm:top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-zinc-950/95 text-white shadow-2xl border backdrop-blur-xl flex items-center gap-3 animate-in slide-in-from-top-4 fade-in duration-300 max-w-sm sm:max-w-md w-[92%] sm:w-auto pointer-events-auto select-none ring-1 ring-white/10">
      <div className={cn('w-9 h-9 rounded-full flex items-center justify-center shrink-0 border shadow-xs', badgeColor)}>
        {isScreenshot ? (
          <Camera className="w-4 h-4 animate-pulse" />
        ) : isVideo ? (
          <Save className="w-4 h-4" />
        ) : (
          <Download className="w-4 h-4" />
        )}
      </div>

      <div className="text-left min-w-0 flex-1">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-xs font-bold text-white truncate max-w-[150px]">
            {isSelf ? 'You' : securityAlert.userName}
          </span>
          <span
            className={cn(
              'text-[9px] px-1.5 py-0.2 rounded-full border uppercase font-bold tracking-wider',
              badgeColor
            )}
          >
            {title}
          </span>
        </div>
        <p className="text-[11px] text-zinc-300 truncate font-medium">{description}</p>
      </div>

      <button
        type="button"
        onClick={dismissSecurityAlert}
        className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors ml-1 cursor-pointer shrink-0"
        title="Dismiss alert"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
