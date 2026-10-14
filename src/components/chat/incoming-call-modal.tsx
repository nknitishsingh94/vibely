'use client';

import * as React from 'react';
import { Phone, PhoneOff, Video, Sparkles, Users } from 'lucide-react';
import { useCall } from '@/context/call-context';
import { Avatar } from '@/components/ui/avatar';
import { unlockAudioSession } from '@/lib/ringtone';

export function IncomingCallModal() {
  const { incomingCall, acceptCall, declineCall } = useCall();
  const [isProcessing, setIsProcessing] = React.useState(false);

  React.useEffect(() => {
    setIsProcessing(false);
  }, [incomingCall?.callId]);

  if (!incomingCall) return null;

  const isVideo = incomingCall.callType === 'video';
  const isGroup = incomingCall.isMerge || (incomingCall.existingParticipants && incomingCall.existingParticipants.length > 1);
  const otherParticipants = (incomingCall.existingParticipants || []).filter(
    p => p.id !== incomingCall.caller.id
  );

  const handleAccept = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    unlockAudioSession();
    await acceptCall();
  };

  const handleDecline = () => {
    if (isProcessing) return;
    setIsProcessing(true);
    declineCall();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200 select-none">
      <div className="relative w-full max-w-sm rounded-3xl bg-card border border-border shadow-2xl p-6 flex flex-col items-center text-center overflow-hidden">
        {/* Glow backdrop */}
        <div className="absolute -top-16 -left-16 w-48 h-48 bg-emerald-500/10 dark:bg-emerald-500/20 rounded-full blur-3xl pointer-events-none animate-pulse" />

        {isGroup ? (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs font-semibold mb-4">
            <Users className="w-3.5 h-3.5" />
            <span>Group {isVideo ? 'Video' : 'Voice'} Call</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5 animate-spin text-emerald-600 dark:text-emerald-400" />
            <span>Incoming {isVideo ? 'Video' : 'Voice'} Call</span>
          </div>
        )}

        {/* Pulsing Avatar or Multi-avatar Stack */}
        <div className="relative my-4 flex items-center justify-center">
          <div className="absolute w-36 h-36 rounded-full bg-emerald-500/10 animate-ping [animation-duration:2s]" />
          <div className="absolute w-28 h-28 rounded-full bg-emerald-500/15 animate-pulse" />

          {isGroup && otherParticipants.length > 0 ? (
            <div className="relative flex items-center justify-center z-10">
              <Avatar
                src={incomingCall.caller.avatar_path || undefined}
                name={incomingCall.caller.display_name}
                size="xl"
                className="w-20 h-20 text-xl ring-4 ring-emerald-500/30 shadow-xl rounded-full"
              />
              <div className="absolute -bottom-2 -right-2 flex -space-x-2">
                {otherParticipants.slice(0, 2).map(p => (
                  <Avatar
                    key={p.id}
                    src={p.avatar_path || undefined}
                    name={p.display_name}
                    size="sm"
                    className="w-8 h-8 text-[10px] ring-2 ring-white dark:ring-slate-900 rounded-full"
                  />
                ))}
              </div>
            </div>
          ) : (
            <Avatar
              src={incomingCall.caller.avatar_path || undefined}
              name={incomingCall.caller.display_name}
              size="xl"
              className="w-24 h-24 text-2xl ring-4 ring-emerald-500/30 relative z-10 shadow-xl rounded-full"
            />
          )}
        </div>

        <h3 className="text-xl font-bold text-foreground mt-2">
          {incomingCall.caller.display_name}
        </h3>
        {incomingCall.caller.username && (
          <p className="text-xs text-muted-foreground font-mono mt-0.5">
            @{incomingCall.caller.username.replace(/^@/, '')}
          </p>
        )}

        {isGroup && otherParticipants.length > 0 && (
          <p className="text-xs text-emerald-800 dark:text-emerald-300 font-medium mt-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            Invited you to join with {otherParticipants.map(p => p.display_name).join(', ')}
          </p>
        )}

        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium tracking-wide mt-2 animate-pulse">
          {isProcessing ? 'Connecting...' : 'Ringing...'}
        </p>

        {/* Action Buttons: Accept & Decline */}
        <div className="flex items-center justify-center gap-12 mt-8 w-full">
          {/* Decline Button */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              disabled={isProcessing}
              onClick={handleDecline}
              className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-700 active:scale-95 disabled:opacity-50 text-white flex items-center justify-center shadow-lg shadow-rose-600/30 transition-all cursor-pointer"
              title="Decline"
            >
              <PhoneOff className="w-6 h-6" />
            </button>
            <span className="text-[11px] text-muted-foreground font-medium">Decline</span>
          </div>

          {/* Accept Button */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              disabled={isProcessing}
              onClick={handleAccept}
              className="w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:opacity-50 text-white flex items-center justify-center shadow-lg shadow-emerald-600/30 transition-all cursor-pointer animate-bounce"
              title="Accept"
            >
              {isVideo ? <Video className="w-6 h-6" /> : <Phone className="w-6 h-6" />}
            </button>
            <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">
              {isProcessing ? 'Connecting' : isGroup ? 'Join Call' : 'Accept'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
