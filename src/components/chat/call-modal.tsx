'use client';

import * as React from 'react';
import {
  Video,
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  VideoOff,
  Volume1,
  Volume2,
  VolumeX,
  ShieldCheck,
  UserPlus,
  Users,
  X,
  Search,
  Check,
  SwitchCamera,
  Maximize2,
  Minimize2,
  Zap,
  ScreenShare,
  ScreenShareOff,
  Sparkles,
} from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { useCall, type CallParticipant } from '@/context/call-context';
import { useChat } from '@/context/chat-context';
import { cn } from '@/lib/utils';
import { VibelyEmblem } from '@/components/ui/brand-logo';
import type { Profile } from '@/types/database';

/**
 * Dedicated audio stream player for each remote participant
 * Ensures uninterrupted, concurrent audio playback without collisions
 */
function RemoteParticipantAudio({
  stream,
  isSpeakerOn,
}: {
  stream: MediaStream | null;
  isSpeakerOn: boolean;
}) {
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  const handleAudioRef = React.useCallback(
    (node: HTMLAudioElement | null) => {
      audioRef.current = node;
      if (node && stream) {
        node.srcObject = stream;
        node.muted = false;
        node.volume = isSpeakerOn ? 1.0 : 0.55;
        node.play().catch(err => {
          console.warn('Remote participant audio play warning:', err);
        });
      }
    },
    [stream, isSpeakerOn]
  );

  React.useEffect(() => {
    if (audioRef.current && stream) {
      audioRef.current.srcObject = stream;
      audioRef.current.muted = false;
      audioRef.current.volume = isSpeakerOn ? 1.0 : 0.55;
      audioRef.current.play().catch(err => {
        console.warn('Remote participant audio effect warning:', err);
      });
    }
  }, [stream, isSpeakerOn]);

  return <audio ref={handleAudioRef} autoPlay playsInline />;
}

/**
 * Participant video tile for multi-user grid
 */
function ParticipantVideoTile({
  participant,
  isBeautyFilterActive = true,
}: {
  participant: CallParticipant;
  isBeautyFilterActive?: boolean;
}) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const stream = participant.stream;

  const hasLiveVideoTrack = Boolean(
    stream &&
      stream.getVideoTracks().some(t => t.enabled && t.readyState === 'live') &&
      !participant.isVideoMuted
  );

  const handleVideoRef = React.useCallback(
    (node: HTMLVideoElement | null) => {
      videoRef.current = node;
      if (node && stream) {
        node.srcObject = stream;
        node.play().catch(err => {
          console.warn('Participant video play error:', err);
        });
      }
    },
    [stream]
  );

  React.useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(err => {
        console.warn('Participant video effect warning:', err);
      });
    }
  }, [stream, hasLiveVideoTrack]);

  return (
    <div className="relative w-full h-full min-h-[140px] rounded-2xl overflow-hidden bg-zinc-900/90 border border-white/10 flex items-center justify-center shadow-lg">
      {hasLiveVideoTrack ? (
        <video
          ref={handleVideoRef}
          autoPlay
          playsInline
          muted
          className={cn(
            "w-full h-full",
            participant.isScreenSharing ? "object-contain bg-black" : "object-cover",
            !participant.isScreenSharing && isBeautyFilterActive && "contrast-[1.04] saturate-[1.08] brightness-[1.02]"
          )}
          style={{ imageRendering: '-webkit-optimize-contrast' as any }}
        />
      ) : (
        <div className="flex flex-col items-center justify-center p-3 text-center space-y-1.5">
          <Avatar
            src={participant.profile.avatar_path || undefined}
            name={participant.profile.display_name}
            size="lg"
            className="w-14 h-14 text-lg ring-2 ring-emerald-500/30"
          />
          <p className="text-xs text-white/90 font-medium truncate max-w-[110px]">
            {participant.profile.display_name}
          </p>
          <span className="text-[10px] text-emerald-400 font-mono">
            {participant.status === 'calling' ? 'Calling...' : 'In call'}
          </span>
        </div>
      )}

      {/* Participant badge */}
      <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-xs text-[10px] text-white flex items-center gap-1.5 font-medium border border-white/10">
        <span className="truncate max-w-[90px]">{participant.profile.display_name}</span>
        {participant.isScreenSharing && (
          <span className="flex items-center gap-0.5 text-emerald-400 font-semibold">
            <ScreenShare className="w-2.5 h-2.5" />
            <span className="text-[9px]">Screen</span>
          </span>
        )}
        {participant.isAudioMuted && <MicOff className="w-2.5 h-2.5 text-rose-400" />}
      </div>
    </div>
  );
}

export function CallModal() {
  const {
    outgoingCall,
    localStream,
    remoteStream,
    participants,
    isMuted,
    isVideoEnabled,
    isSpeakerOn,
    isScreenSharing,
    isRemoteScreenSharing,
    facingMode,
    flipCamera,
    isAntiBusyMode,
    toggleAntiBusyMode,
    endCall,
    toggleMute,
    toggleVideo,
    toggleSpeaker,
    toggleScreenShare,
    stopScreenShare,
    mergeCall,
  } = useCall();

  const { conversations, isUserOnline } = useChat();

  const [isMergeDialogOpen, setIsMergeDialogOpen] = React.useState(false);
  const [mergeSearch, setMergeSearch] = React.useState('');
  const [invitedUserIds, setInvitedUserIds] = React.useState<Set<string>>(new Set());
  const [showControls, setShowControls] = React.useState(true);
  const [isPipExpanded, setIsPipExpanded] = React.useState(false);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [isBeautyFilterActive, setIsBeautyFilterActive] = React.useState(true);
  const callContainerRef = React.useRef<HTMLDivElement | null>(null);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      callContainerRef.current?.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  React.useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
    };
  }, []);

  const localVideoRef = React.useRef<HTMLVideoElement | null>(null);
  const singleRemoteVideoRef = React.useRef<HTMLVideoElement | null>(null);
  const primaryAudioRef = React.useRef<HTMLAudioElement | null>(null);

  const hasLocalVideo = Boolean(
    isVideoEnabled &&
      localStream &&
      localStream.getVideoTracks().some(t => t.enabled && t.readyState === 'live')
  );

  const hasRemoteVideo = Boolean(
    remoteStream &&
      remoteStream.getVideoTracks().some(t => t.enabled && t.readyState === 'live')
  );

  // Callback ref for remote video
  const handleRemoteVideoRef = React.useCallback(
    (node: HTMLVideoElement | null) => {
      singleRemoteVideoRef.current = node;
      if (node && remoteStream) {
        node.srcObject = remoteStream;
        node.play().catch(err => {
          console.warn('Single remote video callback play warning:', err);
        });
      }
    },
    [remoteStream]
  );

  // Callback ref for local self video
  const handleLocalVideoRef = React.useCallback(
    (node: HTMLVideoElement | null) => {
      localVideoRef.current = node;
      if (node && localStream) {
        node.srcObject = localStream;
        node.play().catch(err => {
          console.warn('Local video callback play warning:', err);
        });
      }
    },
    [localStream]
  );

  // Callback ref for primary audio
  const handlePrimaryAudioRef = React.useCallback(
    (node: HTMLAudioElement | null) => {
      primaryAudioRef.current = node;
      if (node && remoteStream) {
        node.srcObject = remoteStream;
        node.muted = false;
        node.volume = isSpeakerOn ? 1.0 : 0.55;
        node.play().catch(err => {
          console.warn('Primary audio callback play warning:', err);
        });
      }
    },
    [remoteStream, isSpeakerOn]
  );

  // Attach local media stream to local video element
  React.useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(err => {
        console.warn('Local video effect play warning:', err);
      });
    }
  }, [localStream, isVideoEnabled, hasLocalVideo, facingMode]);

  // For 1-on-1 video call fallback
  React.useEffect(() => {
    if (singleRemoteVideoRef.current && remoteStream) {
      singleRemoteVideoRef.current.srcObject = remoteStream;
      singleRemoteVideoRef.current.play().catch(err => {
        console.warn('Remote video effect play warning:', err);
      });
    }
  }, [remoteStream, hasRemoteVideo]);

  // Attach remote media stream to permanent primary audio element
  React.useEffect(() => {
    if (primaryAudioRef.current && remoteStream) {
      primaryAudioRef.current.srcObject = remoteStream;
      primaryAudioRef.current.muted = false;
      primaryAudioRef.current.volume = isSpeakerOn ? 1.0 : 0.55;
      primaryAudioRef.current.play().catch(err => {
        console.warn('Primary audio playback error:', err);
      });
    }
  }, [remoteStream, isSpeakerOn]);

  // Audio unlock listener: any tap on screen will trigger playback if browser autoplay policy paused it
  React.useEffect(() => {
    const unlockAudio = () => {
      if (primaryAudioRef.current && remoteStream && primaryAudioRef.current.paused) {
        primaryAudioRef.current.play().catch(() => {});
      }
    };
    window.addEventListener('click', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);
    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };
  }, [remoteStream]);

  if (!outgoingCall) return null;

  const { partner, callType, status, duration, isGroup } = outgoingCall;
  const isVideo = callType === 'video';
  const isScreenActive = isScreenSharing || isRemoteScreenSharing;
  const isVideoView = isVideo || isScreenActive;
  const isMultiPeer = isGroup || participants.length > 1;
  const isLightScreen = !isVideoView || (!hasRemoteVideo && !isMultiPeer && !isScreenActive);

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

  // Contacts available for merging (exclude anyone already participating)
  const existingParticipantIds = new Set([
    partner.id,
    ...participants.map(p => p.id),
  ]);

  const availableFriends = conversations
    .map(c => ({
      profile: c.otherUser,
      conversationId: c.id,
    }))
    .filter(
      (item): item is { profile: Profile; conversationId: string } =>
        !!item.profile && !!item.profile.id
    )
    .filter(item => {
      if (!mergeSearch.trim()) return true;
      const q = mergeSearch.toLowerCase();
      return (
        item.profile.display_name.toLowerCase().includes(q) ||
        (item.profile.username && item.profile.username.toLowerCase().includes(q))
      );
    });

  const handleMergeContact = async (friendProfile: Profile, convId: string) => {
    setInvitedUserIds(prev => new Set(prev).add(friendProfile.id));
    await mergeCall(friendProfile, convId);
    setTimeout(() => {
      setIsMergeDialogOpen(false);
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black select-none sm:bg-black/95 sm:backdrop-blur-xl sm:p-4 animate-in fade-in duration-200">
      {/* Primary Dedicated Audio Player (Permanent & unmuted for primary peer) */}
      <audio ref={handlePrimaryAudioRef} autoPlay playsInline />

      {/* Additional Audio Players for secondary participants when in group/merged call */}
      {participants.slice(1).map(p => (
        <RemoteParticipantAudio key={p.id} stream={p.stream} isSpeakerOn={isSpeakerOn} />
      ))}

      {/* Main Full-Screen Calling Shell (Snapchat / FaceTime 100dvh edge-to-edge mobile container) */}
      <div
        ref={callContainerRef}
        className={cn(
          "relative w-full h-[100dvh] sm:max-w-lg sm:h-[92vh] sm:max-h-[760px] sm:rounded-3xl sm:border sm:shadow-2xl flex flex-col justify-between overflow-hidden transition-colors duration-300",
          isLightScreen
            ? "bg-background text-foreground sm:border-border"
            : "bg-[#070D12] text-white sm:border-white/10"
        )}
      >
        {/* 1. BACKGROUND FULLSCREEN MEDIA LAYER */}
        {isVideoView && (isVideoEnabled || isScreenActive) ? (
          isMultiPeer ? (
            /* Multi-user video grid */
            <div className="absolute inset-0 w-full h-full grid grid-cols-2 gap-2 p-3 pt-20 pb-28 overflow-y-auto bg-zinc-950 z-0">
              {participants.map(p => (
                <ParticipantVideoTile key={p.id} participant={p} isBeautyFilterActive={isBeautyFilterActive} />
              ))}

              {/* Self tile in multi-video */}
              <div className="relative w-full h-full min-h-[140px] rounded-2xl overflow-hidden bg-zinc-900 border border-white/20 flex items-center justify-center shadow-lg">
                {hasLocalVideo ? (
                  <video
                    ref={handleLocalVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className={cn(
                      'w-full h-full',
                      isScreenSharing
                        ? 'object-contain bg-black'
                        : facingMode === 'user' ? 'object-cover -scale-x-100' : 'object-cover',
                      !isScreenSharing && isBeautyFilterActive && 'contrast-[1.04] saturate-[1.08] brightness-[1.02]'
                    )}
                    style={{ imageRendering: '-webkit-optimize-contrast' as any }}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center p-3 text-center space-y-1.5">
                    <VideoOff className="w-6 h-6 text-white/40" />
                    <span className="text-[10px] text-white/50">Camera off</span>
                  </div>
                )}
                <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-xs text-[10px] text-white font-medium border border-white/10 flex items-center gap-1">
                  <span>{isScreenSharing ? 'Your Screen' : 'You'}</span>
                  {isScreenSharing && <ScreenShare className="w-2.5 h-2.5 text-emerald-400" />}
                  {isMuted && <MicOff className="w-2.5 h-2.5 text-rose-400" />}
                </div>
              </div>
            </div>
          ) : (
            /* 1-on-1 Full-Screen Video Canvas (Edge-to-edge Snapchat style) */
            <div
              className="absolute inset-0 w-full h-full bg-zinc-950 overflow-hidden z-0 flex items-center justify-center"
              onClick={() => setShowControls(prev => !prev)}
            >
              {hasRemoteVideo || isScreenSharing ? (
                <video
                  ref={isScreenSharing && !hasRemoteVideo ? handleLocalVideoRef : handleRemoteVideoRef}
                  autoPlay
                  playsInline
                  muted={isScreenSharing && !hasRemoteVideo}
                  className={cn(
                    'w-full h-full transition-all duration-200',
                    isRemoteScreenSharing || isScreenSharing
                      ? 'object-contain bg-black'
                      : 'object-cover',
                    !isRemoteScreenSharing && !isScreenSharing && isBeautyFilterActive && 'contrast-[1.04] saturate-[1.08] brightness-[1.02]'
                  )}
                  style={{ imageRendering: '-webkit-optimize-contrast' as any }}
                />
              ) : (
                /* Connecting / Camera waiting backdrop */
                <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center relative bg-gradient-to-b from-[#F0FDF4] via-white to-[#F8FAFC]">
                  <div className="relative flex items-center justify-center mb-5">
                    <div className="absolute w-48 h-48 rounded-full bg-emerald-500/10 animate-ping [animation-duration:3s]" />
                    <div className="absolute w-36 h-36 rounded-full bg-emerald-500/20 animate-pulse" />
                    <Avatar
                      src={partner?.avatar_path || undefined}
                      name={partner?.display_name}
                      size="xl"
                      className="w-28 h-28 text-3xl ring-4 ring-emerald-500/30 relative z-10 shadow-xl rounded-full"
                    />
                  </div>
                  <h3 className="text-2xl font-bold text-[#0C3B2E] drop-shadow-xs">
                    {partner?.display_name}
                  </h3>
                  {partner?.username && (
                    <p className="text-xs text-slate-500 font-mono mt-0.5">
                      @{partner.username.replace(/^@/, '')}
                    </p>
                  )}
                  <p className="text-xs text-emerald-600 font-medium tracking-wide mt-3 animate-pulse">
                    {status === 'connected' ? 'Connecting camera feed...' : getStatusText()}
                  </p>
                </div>
              )}
            </div>
          )
        ) : (
          /* Voice Call Backdrop */
          <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-b from-emerald-500/10 via-background to-background z-0">
            {isMultiPeer ? (
              <div className="grid grid-cols-2 gap-3 w-full max-w-sm mt-12 mb-20">
                <div className="flex flex-col items-center p-3.5 rounded-2xl bg-card border border-border/80 shadow-sm relative">
                  <Avatar
                    src={partner?.avatar_path || undefined}
                    name={partner?.display_name}
                    size="lg"
                    className="w-16 h-16 text-xl ring-2 ring-emerald-500/40 rounded-full"
                  />
                  <p className="text-xs text-foreground font-semibold mt-2 truncate max-w-[110px]">
                    {partner.display_name}
                  </p>
                  <span className="text-[10px] text-emerald-600 font-mono mt-0.5">
                    {status === 'connected' ? 'Connected' : getStatusText()}
                  </span>
                </div>
                {participants.map(p => (
                  <div
                    key={p.id}
                    className="flex flex-col items-center p-3.5 rounded-2xl bg-card border border-border/80 shadow-sm relative"
                  >
                    <Avatar
                      src={p.profile.avatar_path || undefined}
                      name={p.profile.display_name}
                      size="lg"
                      className="w-16 h-16 text-xl ring-2 ring-emerald-500/40 rounded-full"
                    />
                    <p className="text-xs text-foreground font-semibold mt-2 truncate max-w-[110px]">
                      {p.profile.display_name}
                    </p>
                    <span className="text-[10px] text-emerald-600 font-mono mt-0.5">
                      {p.status === 'calling' ? 'Ringing...' : 'Connected'}
                    </span>
                    {p.isAudioMuted && (
                      <span className="absolute top-2 right-2 bg-rose-500/80 p-1 rounded-full">
                        <MicOff className="w-2.5 h-2.5 text-white" />
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center relative mt-8 mb-16">
                {status !== 'ended' && (
                  <>
                    <div className="absolute w-52 h-52 rounded-full bg-emerald-500/10 animate-ping [animation-duration:3s]" />
                    <div className="absolute w-40 h-40 rounded-full bg-emerald-500/15 animate-pulse" />
                  </>
                )}
                <Avatar
                  src={partner?.avatar_path || undefined}
                  name={partner?.display_name}
                  size="xl"
                  className="w-32 h-32 text-4xl ring-4 ring-emerald-500/30 relative z-10 shadow-xl rounded-full"
                />
                <h3 className="text-2xl font-bold text-foreground mt-4">{partner?.display_name}</h3>
                {partner?.username && (
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">
                    @{partner.username.replace(/^@/, '')}
                  </p>
                )}
                {status === 'connected' ? (
                  <div className="flex items-center gap-1 mt-6">
                    {[40, 75, 30, 95, 60, 85, 45, 90, 35].map((h, i) => (
                      <span
                        key={i}
                        style={{ height: `${h * 0.25}px` }}
                        className="w-1.5 bg-emerald-500 rounded-full animate-pulse"
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-emerald-600 font-medium tracking-wide mt-3 animate-pulse">
                    {getStatusText()}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* 2. FLOATING PICTURE-IN-PICTURE (Self-view in Snapchat / FaceTime style) */}
        {((isVideo && isVideoEnabled) || isScreenSharing) && !isMultiPeer && (
          <div
            onClick={() => setIsPipExpanded(prev => !prev)}
            className={cn(
              'absolute z-30 transition-all duration-300 shadow-2xl rounded-2xl overflow-hidden border-2 border-white/25 bg-zinc-900 group cursor-pointer backdrop-blur-md',
              isPipExpanded
                ? 'inset-4 sm:inset-6 z-40 rounded-3xl'
                : 'top-16 right-4 sm:top-20 sm:right-6 w-28 h-40 sm:w-32 sm:h-48'
            )}
            title="Tap to resize self camera"
          >
            {hasLocalVideo ? (
              <video
                ref={handleLocalVideoRef}
                autoPlay
                playsInline
                muted
                className={cn(
                  'w-full h-full',
                  isScreenSharing
                    ? 'object-contain bg-black'
                    : facingMode === 'user' ? 'object-cover -scale-x-100' : 'object-cover',
                  !isScreenSharing && isBeautyFilterActive && 'contrast-[1.04] saturate-[1.08] brightness-[1.02]'
                )}
                style={{ imageRendering: '-webkit-optimize-contrast' as any }}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900/95 text-white/60 text-[10px] p-2 text-center">
                <VideoOff className="w-5 h-5 mb-1 text-white/40" />
                <span>Camera off</span>
              </div>
            )}

            {/* Quick Flip Camera Button right on the PiP (hidden during screen sharing) */}
            {!isScreenSharing && (
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  flipCamera();
                }}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md text-white/90 border border-white/20 cursor-pointer active:scale-90 transition-transform shadow-md"
                title="Flip camera (Front / Rear)"
              >
                <SwitchCamera className="w-3.5 h-3.5" />
              </button>
            )}

            {/* PiP Badge */}
            <div className="absolute bottom-1.5 left-2 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-xs text-[9px] text-white/90 font-medium flex items-center gap-1">
              <span>{isScreenSharing ? 'Your Screen' : 'You'}</span>
              {isScreenSharing && <ScreenShare className="w-2.5 h-2.5 text-emerald-400" />}
            </div>
          </div>
        )}

        {/* SCREEN SHARE BANNER NOTIFICATION */}
        {isRemoteScreenSharing && (
          <div className="absolute top-18 sm:top-20 left-1/2 -translate-x-1/2 z-30 px-3.5 py-1.5 rounded-full bg-emerald-600/95 text-white text-xs font-semibold flex items-center gap-2 shadow-xl border border-emerald-400/40 backdrop-blur-md animate-in fade-in slide-in-from-top-2 pointer-events-auto">
            <ScreenShare className="w-4 h-4 text-white animate-pulse" />
            <span className="truncate max-w-[180px] sm:max-w-[240px]">{partner?.display_name}&apos;s Screen</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-ping" />
          </div>
        )}

        {isScreenSharing && (
          <div className="absolute top-18 sm:top-20 left-1/2 -translate-x-1/2 z-30 px-3.5 py-1.5 rounded-full bg-black/85 text-white text-xs font-semibold flex items-center gap-2.5 shadow-2xl border border-emerald-500/50 backdrop-blur-md animate-in fade-in slide-in-from-top-2 pointer-events-auto">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="tracking-tight">Sharing your screen</span>
            <button
              type="button"
              onClick={stopScreenShare}
              className="ml-0.5 px-2.5 py-0.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold transition-all cursor-pointer shadow-xs active:scale-95"
            >
              Stop
            </button>
          </div>
        )}

        {/* 3. FLOATING TOP HEADER OVERLAY (Snapchat style translucent gradient) */}
        <div
          className={cn(
            'relative z-20 flex items-center justify-between p-4 pt-5 sm:pt-4 transition-opacity duration-300',
            !showControls && isVideo && isVideoEnabled
              ? 'opacity-0 pointer-events-none'
              : 'opacity-100'
          )}
        >
          {/* Top gradient shadow scrim */}
          <div
            className={cn(
              "absolute inset-0 pointer-events-none transition-colors duration-300",
              isLightScreen
                ? "bg-gradient-to-b from-white/95 via-white/70 to-transparent"
                : "bg-gradient-to-b from-black/85 via-black/45 to-transparent"
            )}
          />

          {/* Left: User Info & Call Status */}
          <div className="relative z-10 flex items-center gap-2.5">
            <Avatar
              src={partner?.avatar_path || undefined}
              name={partner?.display_name}
              size="md"
              className="w-10 h-10 ring-2 ring-emerald-500/40 shadow-md rounded-full"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h2
                  className={cn(
                    "text-base font-bold truncate max-w-[150px] sm:max-w-[200px]",
                    isLightScreen ? "text-foreground" : "text-white drop-shadow-md"
                  )}
                >
                  {isMultiPeer
                    ? `Group (${participants.length + 1})`
                    : partner?.display_name}
                </h2>
                <span
                  className={cn(
                    "flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold shadow-xs",
                    isLightScreen
                      ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
                      : "bg-emerald-500/20 border border-emerald-500/40 text-emerald-300"
                  )}
                >
                  <ShieldCheck className="w-2.5 h-2.5" />
                  <span>Encrypted</span>
                </span>
                <span
                  className={cn(
                    "flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold shadow-xs",
                    isVideo
                      ? isLightScreen
                        ? "bg-violet-500/15 border border-violet-500/30 text-violet-800"
                        : "bg-violet-500/25 border border-violet-500/40 text-violet-300 ring-1 ring-violet-500/30"
                      : isLightScreen
                      ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-800"
                      : "bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 ring-1 ring-emerald-500/30"
                  )}
                >
                  {isVideo ? <Video className="w-2.5 h-2.5" /> : <Phone className="w-2.5 h-2.5" />}
                  <span>{isVideo ? 'Video Call' : 'Voice Call'}</span>
                </span>
                {isVideo && isVideoEnabled && !isScreenActive && (
                  <span
                    className={cn(
                      "flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold shadow-xs transition-colors",
                      isBeautyFilterActive
                        ? isLightScreen
                          ? "bg-amber-500/15 border border-amber-500/30 text-amber-800"
                          : "bg-amber-400/20 border border-amber-400/40 text-amber-300 ring-1 ring-amber-400/30"
                        : isLightScreen
                        ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-800"
                        : "bg-emerald-500/20 border border-emerald-500/40 text-emerald-300"
                    )}
                  >
                    <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                    <span>{isBeautyFilterActive ? "HD Glow" : "HD 1080p"}</span>
                  </span>
                )}
              </div>
              <p
                className={cn(
                  'text-xs font-semibold tracking-wide transition-colors',
                  status === 'connected'
                    ? isLightScreen ? 'text-emerald-700 font-mono' : 'text-emerald-400 font-mono'
                    : status === 'declined' || status === 'unavailable'
                    ? 'text-rose-500'
                    : isLightScreen ? 'text-slate-600 animate-pulse' : 'text-white/80 animate-pulse'
                )}
              >
                {getStatusText()}
              </p>
            </div>
          </div>

          {/* Right: Anti-Busy Mode & Add Participant */}
          <div className="relative z-10 flex items-center gap-2">
            {isRemoteScreenSharing && (
              <button
                type="button"
                onClick={toggleFullscreen}
                className={cn(
                  "p-2.5 rounded-full active:scale-90 backdrop-blur-md shadow-sm transition-all cursor-pointer border",
                  isFullscreen
                    ? "bg-emerald-600 text-white border-emerald-500"
                    : isLightScreen
                    ? "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
                    : "bg-white/15 hover:bg-white/25 text-white border-white/20"
                )}
                title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Screen Share"}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            )}

            <button
              type="button"
              onClick={() => toggleAntiBusyMode()}
              className={cn(
                "px-2.5 py-1.5 rounded-full backdrop-blur-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95 border",
                isAntiBusyMode
                  ? "bg-amber-500/20 border-amber-500/50 text-amber-800 dark:text-amber-300 ring-2 ring-amber-400/30"
                  : isLightScreen
                  ? "bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700"
                  : "bg-white/15 border-white/20 text-white/70 hover:text-white"
              )}
              title={
                isAntiBusyMode
                  ? "Anti-Busy Mode ON: External calls will NOT show busy!"
                  : "Turn on Anti-Busy Mode (prevents external apps from showing busy)"
              }
            >
              <Zap className={cn("w-3.5 h-3.5", isAntiBusyMode ? "text-amber-500 fill-amber-500" : isLightScreen ? "text-slate-600" : "text-white/70")} />
              <span className="text-[10px] tracking-tight">
                {isAntiBusyMode ? "Anti-Busy ON" : "Anti-Busy"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setIsMergeDialogOpen(true)}
              className={cn(
                "p-2.5 rounded-full active:scale-90 backdrop-blur-md shadow-sm transition-all cursor-pointer border",
                isLightScreen
                  ? "bg-slate-100 hover:bg-slate-200 text-emerald-800 border-slate-200"
                  : "bg-white/15 hover:bg-white/25 text-white border-white/20"
              )}
              title="Add friend to call"
            >
              <UserPlus className="w-4 h-4 text-emerald-600" />
            </button>
          </div>
        </div>

        {/* 4. FLOATING BOTTOM CONTROLS OVERLAY (Snapchat style frosted glass dock) */}
        <div
          className={cn(
            'relative z-20 flex flex-col items-center gap-3 p-4 pb-8 sm:pb-6 transition-opacity duration-300',
            !showControls && isVideo && isVideoEnabled
              ? 'opacity-0 pointer-events-none'
              : 'opacity-100'
          )}
        >
          {/* Bottom gradient shadow scrim */}
          <div
            className={cn(
              "absolute inset-0 pointer-events-none transition-colors duration-300",
              isLightScreen
                ? "bg-gradient-to-t from-white/95 via-white/70 to-transparent"
                : "bg-gradient-to-t from-black/95 via-black/60 to-transparent"
            )}
          />

          {/* Floating Controls Bar */}
          <div className="relative z-10 flex items-center justify-center gap-2 sm:gap-3.5 w-full flex-wrap px-2">
            {/* Toggle Mic */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleMute();
              }}
              className={cn(
                'w-11 h-11 sm:w-13 sm:h-13 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-lg active:scale-95',
                isMuted
                  ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/40 ring-2 ring-amber-400'
                  : isLightScreen
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200/90'
                  : 'bg-white/15 hover:bg-white/25 text-white backdrop-blur-md border border-white/20'
              )}
              title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            >
              {isMuted ? <MicOff className="w-5 h-5 text-white" /> : <Mic className="w-5 h-5" />}
            </button>

            {/* In Audio Call: Speaker button sits here in place of the video button */}
            {!isVideo && (
              <button
                type="button"
                onClick={toggleSpeaker}
                className={cn(
                  'w-11 h-11 sm:w-13 sm:h-13 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-lg active:scale-95 border',
                  isSpeakerOn
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30 ring-2 ring-emerald-400 border-emerald-400'
                    : isLightScreen
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/90'
                    : 'bg-white/15 hover:bg-white/25 text-white backdrop-blur-md border border-white/20'
                )}
                title={isSpeakerOn ? 'Speaker: Loudspeaker ON' : 'Speaker: Normal Call (Earpiece Mode)'}
              >
                {isSpeakerOn ? <Volume2 className="w-5 h-5 text-white" /> : <Volume1 className="w-5 h-5" />}
              </button>
            )}

            {/* In Video Call: Toggle Video Camera */}
            {isVideo && (
              <button
                type="button"
                onClick={toggleVideo}
                className={cn(
                  'w-11 h-11 sm:w-13 sm:h-13 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-lg active:scale-95',
                  isVideoEnabled
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/40 ring-2 ring-emerald-400'
                    : isLightScreen
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200/90'
                    : 'bg-white/15 hover:bg-white/25 text-white backdrop-blur-md border border-white/20'
                )}
                title={isVideoEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
              >
                {isVideoEnabled ? (
                  <Video className="w-5 h-5 text-white" />
                ) : (
                  <VideoOff className="w-5 h-5 text-slate-600" />
                )}
              </button>
            )}

            {/* Toggle Screen Share (Desktop & Mobile) */}
            <button
              type="button"
              onClick={toggleScreenShare}
              className={cn(
                'w-11 h-11 sm:w-13 sm:h-13 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-lg active:scale-95 border',
                isScreenSharing
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/40 ring-2 ring-emerald-400 border-emerald-400 animate-pulse'
                  : isLightScreen
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200/90'
                  : 'bg-white/15 hover:bg-white/25 text-white backdrop-blur-md border border-white/20'
              )}
              title={isScreenSharing ? 'Stop Sharing Screen' : 'Share Screen (Mobile & Desktop)'}
            >
              {isScreenSharing ? (
                <ScreenShareOff className="w-5 h-5 text-white" />
              ) : (
                <ScreenShare className={cn("w-5 h-5", isLightScreen ? "text-emerald-700" : "text-emerald-400")} />
              )}
            </button>

            {/* Flip Camera (Front / Rear) - Only shown when camera is active and not sharing screen */}
            {isVideo && isVideoEnabled && !isScreenSharing && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  flipCamera();
                }}
                className={cn(
                  "w-11 h-11 sm:w-13 sm:h-13 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-lg active:scale-95 border",
                  facingMode === 'environment'
                    ? "bg-emerald-600 text-white border-emerald-400 ring-2 ring-emerald-400/50 shadow-emerald-600/30"
                    : isLightScreen
                    ? "bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200/90"
                    : "bg-white/15 hover:bg-white/25 text-white border-white/20 backdrop-blur-md"
                )}
                title={facingMode === 'environment' ? "Back camera active (Tap to switch to front)" : "Front camera active (Tap to switch to back)"}
              >
                <SwitchCamera className={cn("w-5 h-5", facingMode === 'environment' ? "text-white" : "text-emerald-500")} />
              </button>
            )}

            {/* HD Beauty Filter (Glow & Crisp HD) */}
            {isVideo && isVideoEnabled && !isScreenSharing && (
              <button
                type="button"
                onClick={() => setIsBeautyFilterActive(prev => !prev)}
                className={cn(
                  "w-11 h-11 sm:w-13 sm:h-13 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-lg active:scale-95 border",
                  isBeautyFilterActive
                    ? "bg-amber-500/25 hover:bg-amber-500/35 text-amber-400 border-amber-400/60 ring-2 ring-amber-400/40 backdrop-blur-md shadow-amber-500/20"
                    : isLightScreen
                    ? "bg-slate-100 hover:bg-slate-200 text-slate-500 border border-slate-200/90"
                    : "bg-white/10 hover:bg-white/20 text-white/50 border border-white/15 backdrop-blur-md"
                )}
                title={isBeautyFilterActive ? "HD Beauty Filter: ON (Glowing skin & sharp clarity)" : "HD Beauty Filter: OFF"}
              >
                <Sparkles className={cn("w-5 h-5", isBeautyFilterActive ? "text-amber-400 fill-amber-400/30" : "")} />
              </button>
            )}

            {/* In Video Call: Toggle Speaker */}
            {isVideo && (
              <button
                type="button"
                onClick={toggleSpeaker}
                className={cn(
                  'w-11 h-11 sm:w-13 sm:h-13 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-lg active:scale-95 border',
                  isSpeakerOn
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30 ring-2 ring-emerald-400 border-emerald-400'
                    : isLightScreen
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200/90'
                    : 'bg-white/10 text-white/50 border border-white/10'
                )}
                title={isSpeakerOn ? 'Speakerphone: ON (Loudspeaker)' : 'Speakerphone: OFF'}
              >
                {isSpeakerOn ? <Volume2 className="w-5 h-5" /> : <Volume1 className="w-5 h-5" />}
              </button>
            )}

            {/* End Call Button - Distinct separation so it cannot be touched accidentally */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                endCall();
              }}
              className="ml-2 sm:ml-4 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-rose-600 hover:bg-rose-700 active:scale-90 text-white flex items-center justify-center shadow-xl shadow-rose-600/40 transition-all cursor-pointer ring-2 ring-rose-400/40 shrink-0"
              title="End Call"
            >
              <PhoneOff className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>

        {/* Merge Call Contact Picker Modal Dialog */}
        {isMergeDialogOpen && (
          <div
            className={cn(
              "absolute inset-0 z-50 p-4 flex flex-col justify-between animate-in fade-in duration-150 backdrop-blur-xl",
              isLightScreen ? "bg-card/98 text-foreground" : "bg-black/95 text-white"
            )}
          >
            {/* Header */}
            <div
              className={cn(
                "flex items-center justify-between pb-3 border-b",
                isLightScreen ? "border-border" : "border-white/10"
              )}
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className={cn("text-sm font-bold", isLightScreen ? "text-foreground" : "text-white")}>Merge Call</h3>
                  <p className={cn("text-[11px]", isLightScreen ? "text-muted-foreground" : "text-white/50")}>Add friends to talk together</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMergeDialogOpen(false)}
                className={cn(
                  "p-1.5 rounded-full transition-colors cursor-pointer",
                  isLightScreen ? "hover:bg-slate-100 text-slate-500 hover:text-slate-900" : "hover:bg-white/10 text-white/60 hover:text-white"
                )}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative my-3 flex items-center">
              <div className="absolute left-2.5 flex items-center gap-1.5 pointer-events-none select-none z-10">
                <VibelyEmblem size="xs" />
                <Search className={cn("w-3.5 h-3.5", isLightScreen ? "text-slate-400" : "text-white/50")} />
              </div>
              <input
                type="text"
                placeholder="Search Vibely friends to add..."
                value={mergeSearch}
                onChange={e => setMergeSearch(e.target.value)}
                className={cn(
                  "w-full pl-[3.75rem] pr-3 py-2.5 rounded-xl text-xs focus:outline-hidden focus:border-emerald-500/50",
                  isLightScreen
                    ? "bg-slate-100 border border-slate-200 text-slate-900 placeholder-slate-400"
                    : "bg-white/5 border border-white/10 text-white placeholder-white/40"
                )}
              />
            </div>

            {/* Contact list */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {availableFriends.length === 0 ? (
                <div className={cn("h-full flex flex-col items-center justify-center text-center p-4 text-xs", isLightScreen ? "text-slate-400" : "text-white/50")}>
                  <Users className="w-8 h-8 mb-2 opacity-40" />
                  <p>No contacts found to merge.</p>
                </div>
              ) : (
                availableFriends.map(({ profile: friend, conversationId: convId }) => {
                  const isInCall = existingParticipantIds.has(friend.id);
                  const isInvited = invitedUserIds.has(friend.id);
                  const isOnline = isUserOnline(friend.id);

                  return (
                    <div
                      key={friend.id}
                      className={cn(
                        "flex items-center justify-between p-2.5 rounded-xl border transition-colors",
                        isLightScreen
                          ? "bg-slate-50 hover:bg-emerald-50/60 border-slate-200/80"
                          : "bg-white/5 hover:bg-white/10 border-white/5"
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative">
                          <Avatar
                            src={friend.avatar_path || undefined}
                            name={friend.display_name}
                            size="md"
                            className="w-10 h-10 text-sm ring-1 ring-border/40 rounded-full"
                          />
                          {isOnline && (
                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-background" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className={cn("text-xs font-semibold truncate", isLightScreen ? "text-slate-900" : "text-white")}>
                            {friend.display_name}
                          </p>
                          {friend.username && (
                            <p className={cn("text-[10px] font-mono truncate", isLightScreen ? "text-slate-500" : "text-white/50")}>
                              @{friend.username.replace(/^@/, '')}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Action Button */}
                      {isInCall ? (
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-semibold text-emerald-600">
                          In Call
                        </span>
                      ) : isInvited ? (
                        <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/20 text-[10px] font-semibold text-emerald-600 animate-pulse">
                          <Check className="w-3 h-3" />
                          <span>Calling...</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleMergeContact(friend, convId)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-medium transition-all cursor-pointer shadow-md"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Merge</span>
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className={cn("pt-3 border-t flex justify-end", isLightScreen ? "border-slate-200" : "border-white/10")}>
              <button
                type="button"
                onClick={() => setIsMergeDialogOpen(false)}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer",
                  isLightScreen ? "bg-slate-100 hover:bg-slate-200 text-slate-700" : "bg-white/10 hover:bg-white/20 text-white"
                )}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
