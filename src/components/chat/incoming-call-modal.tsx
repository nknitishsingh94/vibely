'use client';

import * as React from 'react';
import { Phone, PhoneOff, Video, Sparkles, Users } from 'lucide-react';
import { useCall } from '@/context/call-context';
import { Avatar } from '@/components/ui/avatar';
import { unlockAudioSession } from '@/lib/ringtone';
import { cn } from '@/lib/utils';

export function IncomingCallModal() {
  const { incomingCall, acceptCall, declineCall } = useCall();
  const [isProcessing, setIsProcessing] = React.useState(false);

  React.useEffect(() => {
    setIsProcessing(false);
    if (incomingCall) {
      unlockAudioSession();
    }
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
    <div
      onTouchStart={unlockAudioSession}
      onClick={unlockAudioSession}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200 select-none"
    >
      <div className="relative w-full max-w-sm rounded-3xl bg-card border border-border shadow-2xl p-6 flex flex-col items-center text-center overflow-hidden">
        {/* Glow backdrop tailored by call type */}
        <div
          className={cn(
            'absolute -top-16 -left-16 w-52 h-52 rounded-full blur-3xl pointer-events-none animate-pulse',
            isVideo
              ? 'bg-violet-600/25 dark:bg-violet-500/30'
              : 'bg-emerald-600/25 dark:bg-emerald-500/30'
          )}
        />

        {/* Distinct Call Type Banner at Top */}
        {isGroup ? (
          <div
            className={cn(
              'flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-bold uppercase tracking-wider mb-4 shadow-sm',
              isVideo
                ? 'bg-violet-500/15 border-violet-500/40 text-violet-700 dark:text-violet-300'
                : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-800 dark:text-emerald-300'
            )}
          >
            <Users className="w-4 h-4 shrink-0" />
            <span>Group {isVideo ? '📹 Video' : '📞 Voice'} Call</span>
          </div>
        ) : isVideo ? (
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-violet-600/20 via-indigo-600/20 to-purple-600/20 border border-violet-500/40 text-violet-700 dark:text-violet-300 text-xs font-extrabold uppercase tracking-wider mb-4 shadow-sm animate-pulse">
            <Video className="w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0" />
            <span>📹 Incoming Video Call</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-emerald-600/20 via-teal-600/20 to-emerald-600/20 border border-emerald-500/40 text-emerald-800 dark:text-emerald-300 text-xs font-extrabold uppercase tracking-wider mb-4 shadow-sm animate-pulse">
            <Phone className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 animate-bounce" />
            <span>📞 Incoming Voice Call</span>
          </div>
        )}

        {/* Pulsing Avatar or Multi-avatar Stack with Call Type Badge */}
        <div className="relative my-4 flex items-center justify-center">
          <div
            className={cn(
              'absolute w-36 h-36 rounded-full animate-ping [animation-duration:2.4s]',
              isVideo ? 'bg-violet-500/15' : 'bg-emerald-500/15'
            )}
          />
          <div
            className={cn(
              'absolute w-28 h-28 rounded-full animate-pulse',
              isVideo ? 'bg-violet-500/20' : 'bg-emerald-500/20'
            )}
          />

          {isGroup && otherParticipants.length > 0 ? (
            <div className="relative flex items-center justify-center z-10">
              <Avatar
                src={incomingCall.caller.avatar_path || undefined}
                name={incomingCall.caller.display_name}
                size="xl"
                className={cn(
                  'w-22 h-22 text-xl ring-4 shadow-xl rounded-full',
                  isVideo ? 'ring-violet-500/40' : 'ring-emerald-500/40'
                )}
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
            <div className="relative z-10">
              <Avatar
                src={incomingCall.caller.avatar_path || undefined}
                name={incomingCall.caller.display_name}
                size="xl"
                className={cn(
                  'w-24 h-24 text-2xl ring-4 shadow-2xl rounded-full',
                  isVideo ? 'ring-violet-500/50' : 'ring-emerald-500/50'
                )}
              />
              {/* Prominent Call Type Badge at bottom-right corner of avatar */}
              <div
                className={cn(
                  'absolute -bottom-1 -right-1 w-9 h-9 rounded-full text-white flex items-center justify-center ring-4 ring-card shadow-lg z-20 animate-in zoom-in-75 duration-200',
                  isVideo
                    ? 'bg-gradient-to-tr from-violet-600 to-indigo-600'
                    : 'bg-gradient-to-tr from-emerald-600 to-teal-600'
                )}
                title={isVideo ? 'Video Call' : 'Voice Call'}
              >
                {isVideo ? <Video className="w-5 h-5 stroke-[2.5]" /> : <Phone className="w-5 h-5 stroke-[2.5]" />}
              </div>
            </div>
          )}
        </div>

        {/* Caller Name */}
        <h3 className="text-xl font-extrabold text-foreground mt-2">
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

        {/* Explicit Call Mode Helper Line */}
        <div className="mt-2.5">
          {isVideo ? (
            <p className="text-xs font-bold text-violet-600 dark:text-violet-400 flex items-center justify-center gap-1.5">
              <Video className="w-3.5 h-3.5" />
              <span>Camera Video Call Ringing...</span>
            </p>
          ) : (
            <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1.5">
              <Phone className="w-3.5 h-3.5" />
              <span>Voice Audio Call Ringing...</span>
            </p>
          )}
        </div>

        {/* Action Buttons: Accept & Decline */}
        <div className="flex items-center justify-center gap-10 mt-7 w-full">
          {/* Decline Button */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              disabled={isProcessing}
              onClick={handleDecline}
              className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-700 active:scale-95 disabled:opacity-50 text-white flex items-center justify-center shadow-lg shadow-rose-600/30 transition-all cursor-pointer"
              title="Decline Call"
              aria-label="Decline Call"
            >
              <PhoneOff className="w-6 h-6 stroke-[2.5]" />
            </button>
            <span className="text-[11px] text-muted-foreground font-semibold">Decline</span>
          </div>

          {/* Accept Button */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              disabled={isProcessing}
              onClick={handleAccept}
              className={cn(
                'w-15 h-15 rounded-full text-white flex items-center justify-center shadow-xl transition-all cursor-pointer active:scale-95 animate-bounce disabled:opacity-50',
                isVideo
                  ? 'bg-gradient-to-tr from-indigo-600 via-violet-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-violet-600/40 ring-4 ring-violet-500/30'
                  : 'bg-gradient-to-tr from-emerald-600 via-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-600/40 ring-4 ring-emerald-500/30'
              )}
              title={isVideo ? 'Answer with Video' : 'Answer Call'}
              aria-label={isVideo ? 'Answer with Video' : 'Answer Call'}
            >
              {isVideo ? <Video className="w-7 h-7 stroke-[2.5]" /> : <Phone className="w-7 h-7 stroke-[2.5]" />}
            </button>
            <span
              className={cn(
                'text-[11px] font-bold',
                isVideo ? 'text-violet-700 dark:text-violet-300' : 'text-emerald-700 dark:text-emerald-400'
              )}
            >
              {isProcessing
                ? 'Connecting...'
                : isGroup
                ? 'Join Call'
                : isVideo
                ? 'Answer Video'
                : 'Answer Call'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
