'use client';

import * as React from 'react';
import {
  Video,
  PhoneOff,
  Mic,
  MicOff,
  VideoOff,
  Volume2,
  VolumeX,
  ShieldCheck,
  UserPlus,
  Users,
  X,
  Search,
  Check,
} from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { useCall, type CallParticipant } from '@/context/call-context';
import { useChat } from '@/context/chat-context';
import { cn } from '@/lib/utils';
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

  React.useEffect(() => {
    if (audioRef.current && stream) {
      audioRef.current.srcObject = stream;
      audioRef.current.play().catch(err => {
        console.warn('Remote participant audio play warning:', err);
      });
    }
  }, [stream]);

  return <audio ref={audioRef} autoPlay playsInline muted={!isSpeakerOn} />;
}

/**
 * Participant video tile for multi-user grid
 */
function ParticipantVideoTile({
  participant,
}: {
  participant: CallParticipant;
}) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const stream = participant.stream;

  React.useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const hasLiveVideoTrack =
    stream &&
    stream.getVideoTracks().some(t => t.enabled && t.readyState === 'live') &&
    !participant.isVideoMuted;

  return (
    <div className="relative w-full h-full min-h-[140px] rounded-2xl overflow-hidden bg-zinc-900/90 border border-white/10 flex items-center justify-center shadow-lg">
      {hasLiveVideoTrack ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
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
    endCall,
    toggleMute,
    toggleVideo,
    toggleSpeaker,
    mergeCall,
  } = useCall();

  const { conversations, isUserOnline } = useChat();

  const [isMergeDialogOpen, setIsMergeDialogOpen] = React.useState(false);
  const [mergeSearch, setMergeSearch] = React.useState('');
  const [invitedUserIds, setInvitedUserIds] = React.useState<Set<string>>(new Set());

  const localVideoRef = React.useRef<HTMLVideoElement | null>(null);
  const singleRemoteVideoRef = React.useRef<HTMLVideoElement | null>(null);

  // Attach local media stream to local video element
  React.useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, isVideoEnabled]);

  // For 1-on-1 video call fallback
  React.useEffect(() => {
    if (singleRemoteVideoRef.current && remoteStream) {
      singleRemoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  if (!outgoingCall) return null;

  const { partner, callType, status, duration, isGroup } = outgoingCall;
  const isVideo = callType === 'video';
  const isMultiPeer = isGroup || participants.length > 1;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-xl animate-in fade-in duration-200 select-none">
      {/* Dynamic Multi-Peer Audio Elements: one per remote participant for uninterrupted sound */}
      {participants.map(p => (
        <RemoteParticipantAudio key={p.id} stream={p.stream} isSpeakerOn={isSpeakerOn} />
      ))}
      {/* 1-on-1 fallback audio if participants array hasn't updated yet */}
      {participants.length === 0 && remoteStream && (
        <RemoteParticipantAudio stream={remoteStream} isSpeakerOn={isSpeakerOn} />
      )}

      {/* Background ambient lighting */}
      <div className="absolute inset-0 bg-radial from-emerald-950/40 via-transparent to-black pointer-events-none" />

      {/* Main Call Container */}
      <div className="relative w-full max-w-sm sm:max-w-lg h-[92vh] max-h-[740px] rounded-3xl bg-[#0B141A] border border-white/10 shadow-2xl flex flex-col justify-between p-6 overflow-hidden">
        {/* Top Header */}
        <div className="flex flex-col items-center gap-1.5 pt-1 z-10">
          <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/20 text-emerald-400 text-[11px] font-medium tracking-wide">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>End-to-end encrypted</span>
          </div>

          {isMultiPeer ? (
            /* Multi-Party Group Call Header */
            <div className="flex flex-col items-center mt-2 text-center">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <h2 className="text-lg font-bold text-white">
                  Group Call ({participants.length + 1})
                </h2>
              </div>
              <p className="text-xs text-white/60 font-medium truncate max-w-[280px] mt-0.5">
                {[partner.display_name, ...participants.map(p => p.profile.display_name)]
                  .filter((v, i, a) => a.indexOf(v) === i)
                  .join(', ')}
              </p>
            </div>
          ) : (
            /* 1-on-1 Call Header */
            <div className="flex flex-col items-center mt-2 text-center">
              <h2 className="text-xl font-bold text-white">
                {partner?.display_name || 'Partner'}
              </h2>
              {partner?.username && (
                <p className="text-xs text-white/50 font-mono mt-0.5">
                  @{partner.username.replace(/^@/, '')}
                </p>
              )}
            </div>
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

        {/* Center Media Area */}
        <div className="flex-1 flex flex-col items-center justify-center relative my-4 overflow-hidden">
          {isVideo && isVideoEnabled ? (
            /* Video Layout */
            isMultiPeer ? (
              /* Multi-user video grid */
              <div className="relative w-full h-full grid grid-cols-2 gap-2 p-1 overflow-y-auto rounded-2xl">
                {participants.map(p => (
                  <ParticipantVideoTile key={p.id} participant={p} />
                ))}

                {/* Self tile in multi-video */}
                <div className="relative w-full h-full min-h-[140px] rounded-2xl overflow-hidden bg-zinc-900 border border-white/20 flex items-center justify-center shadow-lg">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover mirror-mode"
                  />
                  <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-xs text-[10px] text-white font-medium border border-white/10 flex items-center gap-1">
                    <span>You</span>
                    {isMuted && <MicOff className="w-2.5 h-2.5 text-rose-400" />}
                  </div>
                </div>
              </div>
            ) : (
              /* 1-on-1 full video stream with PiP */
              <div className="relative w-full h-full rounded-2xl overflow-hidden bg-zinc-900 border border-white/10 flex items-center justify-center">
                {remoteStream ? (
                  <video
                    ref={singleRemoteVideoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : (
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
            )
          ) : (
            /* Voice Conference Area */
            isMultiPeer ? (
              /* Multi-user audio conference grid */
              <div className="w-full h-full flex flex-col justify-center items-center gap-3 overflow-y-auto px-2">
                <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
                  {/* Primary partner tile */}
                  <div className="flex flex-col items-center p-3.5 rounded-2xl bg-white/5 border border-white/10 relative">
                    <Avatar
                      src={partner?.avatar_path || undefined}
                      name={partner?.display_name}
                      size="lg"
                      className="w-16 h-16 text-xl ring-2 ring-emerald-500/40"
                    />
                    <p className="text-xs text-white font-medium mt-2 truncate max-w-[110px]">
                      {partner.display_name}
                    </p>
                    <span className="text-[10px] text-emerald-400 font-mono mt-0.5">
                      {status === 'connected' ? 'Connected' : getStatusText()}
                    </span>
                  </div>

                  {/* Other participants */}
                  {participants.map(p => (
                    <div
                      key={p.id}
                      className="flex flex-col items-center p-3.5 rounded-2xl bg-white/5 border border-white/10 relative"
                    >
                      <Avatar
                        src={p.profile.avatar_path || undefined}
                        name={p.profile.display_name}
                        size="lg"
                        className="w-16 h-16 text-xl ring-2 ring-emerald-500/40"
                      />
                      <p className="text-xs text-white font-medium mt-2 truncate max-w-[110px]">
                        {p.profile.display_name}
                      </p>
                      <span className="text-[10px] text-emerald-400 font-mono mt-0.5">
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

                {/* Animated Equalizer when call is connected */}
                {status === 'connected' && (
                  <div className="flex items-center gap-1 mt-4">
                    {[35, 65, 25, 85, 55, 75, 45, 95, 30].map((h, i) => (
                      <span
                        key={i}
                        style={{ height: `${h * 0.22}px` }}
                        className="w-1 bg-emerald-400 rounded-full animate-pulse"
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* 1-on-1 Voice Call Pulse Area */
              <div className="flex flex-col items-center justify-center relative">
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
            )
          )}
        </div>

        {/* Bottom Call Controls */}
        <div className="flex flex-col items-center gap-4 pb-2 z-10">
          <div className="flex items-center justify-center gap-3 sm:gap-4">
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

            {/* Merge / Add Participant Button */}
            <button
              type="button"
              onClick={() => setIsMergeDialogOpen(true)}
              className="relative w-12 h-12 rounded-full flex items-center justify-center bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-400 hover:text-emerald-300 transition-all cursor-pointer shadow-md active:scale-95 group"
              title="Merge / Add Participant to Call"
            >
              <UserPlus className="w-5 h-5 group-hover:scale-110 transition-transform" />
              {participants.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-emerald-500 text-black text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow">
                  {participants.length + 1}
                </span>
              )}
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

        {/* Merge Call Contact Picker Modal Dialog */}
        {isMergeDialogOpen && (
          <div className="absolute inset-0 z-30 bg-black/90 backdrop-blur-md p-4 flex flex-col justify-between animate-in fade-in duration-150">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Merge Call</h3>
                  <p className="text-[11px] text-white/50">Add friends to talk together</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMergeDialogOpen(false)}
                className="p-1.5 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative my-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                type="text"
                placeholder="Search friends to add..."
                value={mergeSearch}
                onChange={e => setMergeSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-white/40 focus:outline-hidden focus:border-emerald-500/50"
              />
            </div>

            {/* Contact list */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {availableFriends.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-4 text-white/50 text-xs">
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
                      className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative">
                          <Avatar
                            src={friend.avatar_path || undefined}
                            name={friend.display_name}
                            size="md"
                            className="w-10 h-10 text-sm ring-1 ring-white/10"
                          />
                          {isOnline && (
                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-[#0B141A]" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white truncate">
                            {friend.display_name}
                          </p>
                          {friend.username && (
                            <p className="text-[10px] text-white/50 font-mono truncate">
                              @{friend.username.replace(/^@/, '')}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Action Button */}
                      {isInCall ? (
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-semibold text-emerald-400">
                          In Call
                        </span>
                      ) : isInvited ? (
                        <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/20 text-[10px] font-semibold text-emerald-300 animate-pulse">
                          <Check className="w-3 h-3" />
                          <span>Calling...</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleMergeContact(friend, convId)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-medium transition-all cursor-pointer shadow-md"
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
            <div className="pt-3 border-t border-white/10 flex justify-end">
              <button
                type="button"
                onClick={() => setIsMergeDialogOpen(false)}
                className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-medium text-white transition-colors cursor-pointer"
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
