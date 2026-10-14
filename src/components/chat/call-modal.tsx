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
} from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { useCall } from '@/context/call-context';
import { cn } from '@/lib/utils';

export function CallModal() {
  const {
    outgoingCall,
    localStream,
    remoteStream,
    isMuted,
    isVideoEnabled,
    isSpeakerOn,
    endCall,
    toggleMute,
    toggleVideo,
    toggleSpeaker,
  } = useCall();

  const localVideoRef = React.useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = React.useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = React.useRef<HTMLAudioElement | null>(null);

  // Attach local media stream to local video element
  React.useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, isVideoEnabled]);

  // Attach remote media stream to remote video & audio elements
  React.useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.play().catch(() => {});
    }
  }, [remoteStream]);

  if (!outgoingCall) return null;

  const { partner, callType, status, duration } = outgoingCall;
  const isVideo = callType === 'video';

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusText = () => {
    switch (status) {
      case 'calling':
        return 'Calling...';
      case 'ringing':
        return 'Ringing...';
      case 'connected':
        return formatTimer(duration);
      case 'declined':
        return 'Call declined';
      case 'unavailable':
        return 'Unavailable / No answer';
      case 'ended':
        return 'Call ended';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-xl animate-in fade-in duration-200 select-none">
      {/* Hidden remote audio element for real-time voice streaming */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

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
            {partner?.display_name || 'Partner'}
          </h2>
          {partner?.username && (
            <p className="text-xs text-white/50 font-mono">@{partner.username.replace(/^@/, '')}</p>
          )}

          <p
            className={cn(
              'text-xs font-medium tracking-wider mt-1 transition-all',
              status === 'connected'
                ? 'text-emerald-400 font-mono'
                : status === 'declined' || status === 'unavailable'
                ? 'text-rose-400 font-semibold'
                : 'text-white/70 animate-pulse'
            )}
          >
            {getStatusText()}
          </p>
        </div>

        {/* Center Media / Avatar Area */}
        <div className="flex-1 flex flex-col items-center justify-center relative my-4">
          {isVideo && isVideoEnabled ? (
            /* Live WebRTC Video Streams */
            <div className="relative w-full h-full rounded-2xl overflow-hidden bg-zinc-900 border border-white/10 flex items-center justify-center">
              {remoteStream ? (
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                /* Waiting for remote camera placeholder */
                <div className="flex flex-col items-center justify-center text-center p-4 space-y-2">
                  <Avatar
                    src={partner?.avatar_path || undefined}
                    name={partner?.display_name}
                    size="xl"
                    className="w-24 h-24 text-2xl ring-4 ring-emerald-500/30"
                  />
                  <p className="text-xs text-white/60">
                    {status === 'connected' ? 'Connecting camera...' : getStatusText()}
                  </p>
                </div>
              )}

              {/* Floating Self Video Picture-in-Picture Box */}
              <div className="absolute bottom-3 right-3 w-24 h-32 rounded-xl overflow-hidden border-2 border-white/20 bg-zinc-800 shadow-xl z-20 flex items-center justify-center">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover mirror-mode"
                />
                <span className="absolute bottom-1 right-1.5 text-[9px] text-white/80 bg-black/60 px-1 rounded font-medium">
                  You
                </span>
              </div>
            </div>
          ) : (
            /* Voice Call Pulse Area */
            <div className="flex flex-col items-center justify-center relative">
              {/* Pulse Wave Rings */}
              {status !== 'ended' && (
                <>
                  <div className="absolute w-44 h-44 rounded-full bg-emerald-500/10 animate-ping [animation-duration:3s]" />
                  <div className="absolute w-36 h-36 rounded-full bg-emerald-500/15 animate-pulse" />
                </>
              )}

              <div className="relative z-10 shadow-2xl rounded-full">
                <Avatar
                  src={partner?.avatar_path || undefined}
                  name={partner?.display_name}
                  size="xl"
                  className="w-28 h-28 text-3xl ring-4 ring-emerald-500/30"
                />
              </div>

              {/* Animated Equalizer when connected */}
              {status === 'connected' && (
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
              onClick={toggleMute}
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
              onClick={toggleVideo}
              className={cn(
                'w-12 h-12 rounded-full flex items-center justify-center text-white transition-all cursor-pointer shadow-md',
                isVideoEnabled && isVideo
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-white/10 hover:bg-white/20 backdrop-blur-xs'
              )}
              title={isVideoEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
            >
              {isVideoEnabled && isVideo ? (
                <Video className="w-5 h-5" />
              ) : (
                <VideoOff className="w-5 h-5" />
              )}
            </button>

            {/* Toggle Speaker */}
            <button
              type="button"
              onClick={toggleSpeaker}
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
              onClick={endCall}
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
