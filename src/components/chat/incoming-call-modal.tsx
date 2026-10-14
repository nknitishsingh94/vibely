'use client';

import * as React from 'react';
import { Phone, PhoneOff, Video, Sparkles } from 'lucide-react';
import { useCall } from '@/context/call-context';
import { Avatar } from '@/components/ui/avatar';

export function IncomingCallModal() {
  const { incomingCall, acceptCall, declineCall } = useCall();

  if (!incomingCall) return null;

  const isVideo = incomingCall.callType === 'video';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200 select-none">
      <div className="relative w-full max-w-sm rounded-3xl bg-[#0B141A] border border-emerald-500/30 shadow-2xl p-6 flex flex-col items-center text-center overflow-hidden">
        {/* Glow backdrop */}
        <div className="absolute -top-16 -left-16 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none animate-pulse" />

        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-4">
          <Sparkles className="w-3.5 h-3.5 animate-spin" />
          <span>Incoming {isVideo ? 'Video' : 'Voice'} Call</span>
        </div>

        {/* Pulsing Avatar */}
        <div className="relative my-4 flex items-center justify-center">
          <div className="absolute w-36 h-36 rounded-full bg-emerald-500/15 animate-ping [animation-duration:2s]" />
          <div className="absolute w-28 h-28 rounded-full bg-emerald-500/20 animate-pulse" />

          <Avatar
            src={incomingCall.caller.avatar_path || undefined}
            name={incomingCall.caller.display_name}
            size="xl"
            className="w-24 h-24 text-2xl ring-4 ring-emerald-500/40 relative z-10"
          />
        </div>

        <h3 className="text-xl font-bold text-white mt-2">
          {incomingCall.caller.display_name}
        </h3>
        {incomingCall.caller.username && (
          <p className="text-xs text-white/60 font-mono mt-0.5">
            @{incomingCall.caller.username.replace(/^@/, '')}
          </p>
        )}

        <p className="text-xs text-emerald-400 font-medium tracking-wide mt-2 animate-pulse">
          Ringing...
        </p>

        {/* Action Buttons: Accept & Decline */}
        <div className="flex items-center justify-center gap-12 mt-8 w-full">
          {/* Decline Button */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={declineCall}
              className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-700 active:scale-95 text-white flex items-center justify-center shadow-lg shadow-rose-600/40 transition-all cursor-pointer"
              title="Decline"
            >
              <PhoneOff className="w-6 h-6" />
            </button>
            <span className="text-[11px] text-white/70 font-medium">Decline</span>
          </div>

          {/* Accept Button */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={acceptCall}
              className="w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white flex items-center justify-center shadow-lg shadow-emerald-600/40 transition-all cursor-pointer animate-bounce"
              title="Accept"
            >
              {isVideo ? <Video className="w-6 h-6" /> : <Phone className="w-6 h-6" />}
            </button>
            <span className="text-[11px] text-emerald-400 font-semibold">Accept</span>
          </div>
        </div>
      </div>
    </div>
  );
}
