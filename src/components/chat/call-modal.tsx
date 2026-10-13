'use client';

import * as React from 'react';
import {
  Phone,
  Video,
  PhoneOff,
  Mic,
  MicOff,
  VideoOff,
  Volume2,
  VolumeX,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

interface CallModalProps {
  isOpen: boolean;
  onClose: () => void;
  partnerName: string;
  partnerAvatar?: string | null;
  partnerUsername?: string | null;
  initialCallType?: 'voice' | 'video';
}

export function CallModal({
  isOpen,
  onClose,
  partnerName,
  partnerAvatar,
  partnerUsername,
  initialCallType = 'voice',
}: CallModalProps) {
  const [callType, setCallType] = React.useState<'voice' | 'video'>(initialCallType);
  const [callStatus, setCallStatus] = React.useState<'calling' | 'ringing' | 'connected' | 'ended'>('calling');
  const [callDuration, setCallDuration] = React.useState(0);
  const [isMuted, setIsMuted] = React.useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = React.useState(initialCallType === 'video');
  const [isSpeakerOn, setIsSpeakerOn] = React.useState(true);

  // Sync initialCallType
  React.useEffect(() => {
    setCallType(initialCallType);
    setIsVideoEnabled(initialCallType === 'video');
  }, [initialCallType]);

  // Handle call state progression
  React.useEffect(() => {
    if (!isOpen) {
      setCallStatus('calling');
      setCallDuration(0);
      return;
    }

    setCallStatus('calling');
    const ringTimer = setTimeout(() => {
      setCallStatus('ringing');
    }, 1500);

    const connectTimer = setTimeout(() => {
      setCallStatus('connected');
    }, 3500);

    return () => {
      clearTimeout(ringTimer);
      clearTimeout(connectTimer);
    };
  }, [isOpen]);

  // Duration timer when connected
  React.useEffect(() => {
    if (callStatus !== 'connected') return;

    const timer = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [callStatus]);

  if (!isOpen) return null;

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleEndCall = () => {
    setCallStatus('ended');
    toast.info('Call ended');
    setTimeout(() => {
      onClose();
    }, 500);
  };

  const getStatusText = () => {
    switch (callStatus) {
      case 'calling':
        return 'Calling...';
      case 'ringing':
        return 'Ringing...';
      case 'connected':
        return formatTimer(callDuration);
      case 'ended':
        return 'Call ended';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-xl animate-in fade-in duration-200 select-none">
      {/* Background ambient lighting */}
      <div className="absolute inset-0 bg-radial from-emerald-950/40 via-transparent to-black pointer-events-none" />

      {/* Main Call Container */}
      <div className="relative w-full max-w-sm sm:max-w-md h-[92vh] max-h-[720px] rounded-3xl bg-[#0B141A] border border-white/10 shadow-2xl flex flex-col justify-between p-6 overflow-hidden">
        {/* Top Header */}
        <div className="flex flex-col items-center gap-1.5 pt-2 z-10">
          <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/20 text-emerald-400 text-[11px] font-medium tracking-wide">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>End-to-end encrypted</span>
          </div>

          <h2 className="text-xl font-bold text-white mt-3 text-center">
            {partnerName || 'Partner'}
          </h2>
          {partnerUsername && (
            <p className="text-xs text-white/50 font-mono">@{partnerUsername.replace(/^@/, '')}</p>
          )}

          <p
            className={cn(
              'text-xs font-medium tracking-wider mt-1 transition-all',
              callStatus === 'connected' ? 'text-emerald-400 font-mono' : 'text-white/70 animate-pulse'
            )}
          >
            {getStatusText()}
          </p>
        </div>

        {/* Center Media / Avatar Area */}
        <div className="flex-1 flex flex-col items-center justify-center relative my-4">
          {callType === 'video' && isVideoEnabled ? (
            /* Simulated Video Stream */
            <div className="relative w-full h-full rounded-2xl overflow-hidden bg-zinc-900 border border-white/10 flex items-center justify-center">
              <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60 z-10" />
              <img
                src={partnerAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80'}
                alt={partnerName}
                className="w-full h-full object-cover filter brightness-95"
              />
              <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-xs text-[11px] text-white">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Live Camera</span>
              </div>

              {/* Floating Self Video Tile */}
              <div className="absolute bottom-3 right-3 w-24 h-32 rounded-xl overflow-hidden border-2 border-white/20 bg-zinc-800 shadow-xl z-20 flex items-center justify-center">
                <span className="text-[10px] text-white/70 font-medium">You</span>
              </div>
            </div>
          ) : (
            /* Voice Call Pulse Area */
            <div className="flex flex-col items-center justify-center relative">
              {/* Pulse Wave Rings */}
              {callStatus !== 'ended' && (
                <>
                  <div className="absolute w-44 h-44 rounded-full bg-emerald-500/10 animate-ping [animation-duration:3s]" />
                  <div className="absolute w-36 h-36 rounded-full bg-emerald-500/15 animate-pulse" />
                </>
              )}

              <div className="relative z-10 shadow-2xl rounded-full">
                <Avatar
                  src={partnerAvatar || undefined}
                  name={partnerName}
                  size="xl"
                  className="w-28 h-28 text-3xl ring-4 ring-emerald-500/30"
                />
              </div>

              {/* Animated Equalizer when connected */}
              {callStatus === 'connected' && (
                <div className="flex items-center gap-1 mt-6">
                  {[40, 70, 30, 90, 60, 80, 50].map((h, i) => (
                    <span
                      key={i}
                      style={{ height: `${h * 0.25}px` }}
                      className="w-1 bg-emerald-400 rounded-full animate-pulse"
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Call Controls */}
        <div className="flex flex-col items-center gap-4 pb-2 z-10">
          <div className="flex items-center justify-center gap-4">
            {/* Toggle Mic */}
            <button
              type="button"
              onClick={() => {
                setIsMuted(prev => !prev);
                toast.info(isMuted ? 'Microphone unmuted' : 'Microphone muted');
              }}
              className={cn(
                'w-12 h-12 rounded-full flex items-center justify-center text-white transition-all cursor-pointer shadow-md',
                isMuted
                  ? 'bg-rose-500 hover:bg-rose-600'
                  : 'bg-white/10 hover:bg-white/20 backdrop-blur-xs'
              )}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            {/* Toggle Video */}
            <button
              type="button"
              onClick={() => {
                if (callType === 'voice') {
                  setCallType('video');
                  setIsVideoEnabled(true);
                  toast.info('Switched to Video Call');
                } else {
                  setIsVideoEnabled(prev => !prev);
                }
              }}
              className={cn(
                'w-12 h-12 rounded-full flex items-center justify-center text-white transition-all cursor-pointer shadow-md',
                isVideoEnabled && callType === 'video'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-white/10 hover:bg-white/20 backdrop-blur-xs'
              )}
              title={isVideoEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
            >
              {isVideoEnabled && callType === 'video' ? (
                <Video className="w-5 h-5" />
              ) : (
                <VideoOff className="w-5 h-5" />
              )}
            </button>

            {/* Toggle Speaker */}
            <button
              type="button"
              onClick={() => {
                setIsSpeakerOn(prev => !prev);
                toast.info(isSpeakerOn ? 'Speaker disabled' : 'Speaker enabled');
              }}
              className={cn(
                'w-12 h-12 rounded-full flex items-center justify-center text-white transition-all cursor-pointer shadow-md',
                isSpeakerOn
                  ? 'bg-white/20 hover:bg-white/30 backdrop-blur-xs'
                  : 'bg-white/10 hover:bg-white/20 text-white/50'
              )}
              title={isSpeakerOn ? 'Speaker On' : 'Speaker Off'}
            >
              {isSpeakerOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>

            {/* End Call Button */}
            <button
              type="button"
              onClick={handleEndCall}
              className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-700 active:scale-95 text-white flex items-center justify-center shadow-lg shadow-rose-600/40 transition-all cursor-pointer"
              title="End Call"
            >
              <PhoneOff className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
