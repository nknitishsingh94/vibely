'use client';

import * as React from 'react';
import { Camera, Save, Download } from 'lucide-react';
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

  let text = isSelf ? 'You took a screenshot' : `${securityAlert.userName} took a screenshot`;
  let icon = <Camera className="w-3.5 h-3.5 shrink-0 text-amber-400 animate-pulse" />;
  let pillStyle = 'bg-zinc-900/90 text-white border-white/10 shadow-lg';

  if (isVideo) {
    text = isSelf ? 'You saved a video' : `${securityAlert.userName} saved a video`;
    icon = <Save className="w-3.5 h-3.5 shrink-0 text-emerald-400" />;
    pillStyle = 'bg-zinc-900/90 text-white border-white/10 shadow-lg';
  } else if (isPhoto) {
    text = isSelf ? 'You saved a photo' : `${securityAlert.userName} saved a photo`;
    icon = <Download className="w-3.5 h-3.5 shrink-0 text-sky-400" />;
    pillStyle = 'bg-zinc-900/90 text-white border-white/10 shadow-lg';
  } else if (securityAlert.type === 'file_downloaded') {
    text = isSelf ? 'You saved a file' : `${securityAlert.userName} saved a file`;
    icon = <Download className="w-3.5 h-3.5 shrink-0 text-indigo-400" />;
    pillStyle = 'bg-zinc-900/90 text-white border-white/10 shadow-lg';
  }

  return (
    <div
      onClick={dismissSecurityAlert}
      className="absolute top-16 sm:top-18 left-1/2 -translate-x-1/2 z-50 pointer-events-auto cursor-pointer select-none animate-in slide-in-from-top-3 fade-in duration-200 max-w-[90vw]"
      title="Click to dismiss"
    >
      <div
        className={cn(
          'px-4 py-1.5 sm:py-2 rounded-full border text-xs font-semibold backdrop-blur-md flex items-center gap-2 transition-all hover:scale-105 active:scale-95',
          pillStyle
        )}
      >
        {icon}
        <span className="truncate tracking-tight">{text}</span>
      </div>
    </div>
  );
}
