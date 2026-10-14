'use client';

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from './auth-context';
import { useChat } from './chat-context';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { startOutgoingRing, startIncomingRing, stopAllRingtones } from '@/lib/ringtone';
import {
  addCallLog,
  updateCallLog,
  useCallHistory,
  type CallLogItem,
} from '@/lib/call-history';
import type { Profile } from '@/types/database';

export interface CallParticipant {
  id: string; // user id
  profile: Profile;
  stream: MediaStream | null;
  status: 'calling' | 'ringing' | 'connected' | 'declined' | 'ended';
  isAudioMuted?: boolean;
  isVideoMuted?: boolean;
}

export interface OutgoingCallState {
  partner: Profile;
  participants: CallParticipant[];
  roomId: string;
  callType: 'voice' | 'video';
  conversationId: string;
  status: 'calling' | 'ringing' | 'connected' | 'ended' | 'declined' | 'unavailable';
  duration: number;
  isGroup?: boolean;
}

export interface IncomingCallState {
  caller: Profile;
  callType: 'voice' | 'video';
  conversationId: string;
  callId: string;
  roomId: string;
  sdp?: RTCSessionDescriptionInit | null;
  isMerge?: boolean;
  existingParticipants?: Profile[];
}

interface CallContextType {
  outgoingCall: OutgoingCallState | null;
  incomingCall: IncomingCallState | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  participants: CallParticipant[];
  isMuted: boolean;
  isVideoEnabled: boolean;
  isSpeakerOn: boolean;
  callHistory: CallLogItem[];
  clearCallHistory: () => void;
  deleteCallLog: (id: string) => void;
  startCall: (partner: Profile, type: 'voice' | 'video', conversationId?: string) => Promise<void>;
  mergeCall: (partner: Profile, conversationId?: string) => Promise<void>;
  acceptCall: () => Promise<void>;
  declineCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleVideo: () => void;
  toggleSpeaker: () => void;
}

const CallContext = createContext<CallContextType>({
  outgoingCall: null,
  incomingCall: null,
  localStream: null,
  remoteStream: null,
  participants: [],
  isMuted: false,
  isVideoEnabled: true,
  isSpeakerOn: true,
  callHistory: [],
  clearCallHistory: () => {},
  deleteCallLog: () => {},
  startCall: async () => {},
  mergeCall: async () => {},
  acceptCall: async () => {},
  declineCall: () => {},
  endCall: () => {},
  toggleMute: () => {},
  toggleVideo: () => {},
  toggleSpeaker: () => {},
});

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
  ],
  iceCandidatePoolSize: 10,
};

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const { activeConversationId } = useChat();

  const {
    history: callHistory,
    clearAll: clearCallHistory,
    removeLog: deleteCallLog,
  } = useCallHistory(profile?.id);

  const [outgoingCall, setOutgoingCall] = useState<OutgoingCallState | null>(null);
  const [incomingCall, setIncomingCall] = useState<IncomingCallState | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [participants, setParticipants] = useState<CallParticipant[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);

  // Mesh WebRTC Peer Connections: Map of remoteUserId -> RTCPeerConnection
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const pendingIceCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const participantsRef = useRef<CallParticipant[]>([]);
  useEffect(() => {
    participantsRef.current = participants;
  }, [participants]);

  const callRoomChannelRef = useRef<any>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const callDurationTimerRef = useRef<any>(null);
  const callRetryTimerRef = useRef<any>(null);
  const callTimeoutRef = useRef<any>(null);
  const offerRetryTimerRef = useRef<any>(null);

  // Synchronous state tracking to eliminate async React state race conditions
  const activeCallStatusRef = useRef<'idle' | 'calling' | 'ringing' | 'connected' | 'ended' | 'declined' | 'unavailable'>('idle');
  const activeCallIdRef = useRef<string | null>(null);
  const processedSignals = useRef<Map<string, number>>(new Map());

  const isDuplicateSignal = useCallback((event: string, payload: any) => {
    const now = Date.now();
    // Prune entries older than 8 seconds
    processedSignals.current.forEach((time, key) => {
      if (now - time > 8000) processedSignals.current.delete(key);
    });

    const callId = payload?.callId || payload?.conversationId || payload?.roomId || '';
    const fromId = payload?.fromUserId || payload?.caller?.id || '';
    const toId = payload?.toUserId || '';
    const sdpType = payload?.sdp?.type || '';
    const ts = payload?.timestamp || '';
    const sigKey = `${event}:${callId}:${fromId}:${toId}:${sdpType}:${ts}`;
    if (callId && processedSignals.current.has(sigKey)) {
      return true;
    }
    processedSignals.current.set(sigKey, now);
    return false;
  }, []);

  const outgoingCallRef = useRef<OutgoingCallState | null>(null);
  useEffect(() => {
    outgoingCallRef.current = outgoingCall;
    if (outgoingCall?.status) {
      activeCallStatusRef.current = outgoingCall.status;
    } else if (!incomingCallRef.current) {
      activeCallStatusRef.current = 'idle';
    }
  }, [outgoingCall]);

  const incomingCallRef = useRef<IncomingCallState | null>(null);
  useEffect(() => {
    incomingCallRef.current = incomingCall;
    if (incomingCall) {
      activeCallStatusRef.current = 'ringing';
    } else if (!outgoingCallRef.current) {
      activeCallStatusRef.current = 'idle';
    }
  }, [incomingCall]);

  // Clean up all media tracks, peer connections, and timers
  const cleanupMedia = useCallback(() => {
    stopAllRingtones();
    activeCallStatusRef.current = 'idle';
    activeCallIdRef.current = null;

    if (callDurationTimerRef.current) {
      clearInterval(callDurationTimerRef.current);
      callDurationTimerRef.current = null;
    }
    if (callRetryTimerRef.current) {
      clearInterval(callRetryTimerRef.current);
      callRetryTimerRef.current = null;
    }
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }
    if (offerRetryTimerRef.current) {
      clearInterval(offerRetryTimerRef.current);
      offerRetryTimerRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => {
        try {
          t.stop();
        } catch {}
      });
      localStreamRef.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);

    // Close and remove all peer connections in the mesh
    peerConnectionsRef.current.forEach((pc) => {
      try {
        pc.close();
      } catch {}
    });
    peerConnectionsRef.current.clear();
    remoteStreamsRef.current.clear();
    pendingIceCandidatesRef.current.clear();
    setParticipants([]);

    if (callRoomChannelRef.current) {
      try {
        const supabase = getSupabaseBrowserClient();
        supabase.removeChannel(callRoomChannelRef.current);
      } catch {}
      callRoomChannelRef.current = null;
    }
  }, []);

  // Flush queued ICE candidates helper
  const flushPendingIceCandidates = useCallback(async (userId: string, pc: RTCPeerConnection) => {
    const pending = pendingIceCandidatesRef.current.get(userId) || [];
    if (pending.length > 0 && pc.remoteDescription) {
      for (const cand of pending) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(cand));
        } catch (e) {
          console.warn('Error adding queued candidate:', e);
        }
      }
      pendingIceCandidatesRef.current.delete(userId);
    }
  }, []);

  // Multi-channel signaling broadcaster to reach a user instantly (<50ms)
  const sendSignalToUser = useCallback(
    (targetUserId: string, event: string, payload: any, conversationId?: string, roomId?: string) => {
      if (!targetUserId) return;
      const enrichedPayload = {
        ...payload,
        timestamp: payload?.timestamp || Date.now(),
      };

      // 1. Direct Server-Side Broadcast (<50ms delivery across all channels simultaneously)
      fetch('/api/chat/call-signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId,
          event,
          payload: enrichedPayload,
          conversationId,
          roomId,
        }),
      }).catch(err => {
        console.warn('Server-side signal dispatch error:', err);
      });

      // 2. Direct client WebSocket fallback
      try {
        const supabase = getSupabaseBrowserClient();
        const callChannel = supabase.channel(`call-user:${targetUserId}`);
        callChannel.send({
          type: 'broadcast',
          event,
          payload: enrichedPayload,
        }).catch(() => {});
      } catch {}
    },
    []
  );

  // Helper to acquire local media stream with crisp audio constraints & robust progressive fallbacks
  const acquireLocalMedia = async (callType: 'voice' | 'video'): Promise<MediaStream | null> => {
    // 1. If we already have a stream, check if it has the required tracks
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      const videoTracks = localStreamRef.current.getVideoTracks();
      const hasLiveAudio = audioTracks.some(t => t.readyState === 'live');
      const hasLiveVideo = videoTracks.some(t => t.readyState === 'live');

      if (callType === 'video' && !hasLiveVideo) {
        try {
          let videoStream: MediaStream | null = null;
          try {
            videoStream = await navigator.mediaDevices.getUserMedia({
              video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: 'user',
              },
            });
          } catch {
            videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
          }

          if (videoStream) {
            videoStream.getVideoTracks().forEach(t => {
              t.enabled = true;
              localStreamRef.current?.addTrack(t);
            });
          }
        } catch (err) {
          console.warn('Could not add video track to existing stream:', err);
        }
      }

      // Re-enable existing audio & video tracks
      localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = true; });
      if (callType === 'video') {
        localStreamRef.current.getVideoTracks().forEach(t => { t.enabled = true; });
      }

      const freshStream = new MediaStream(localStreamRef.current.getTracks());
      localStreamRef.current = freshStream;
      setLocalStream(freshStream);
      return freshStream;
    }

    const audioConstraints = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    };

    // 2. Video call media acquisition with graceful multi-tier fallbacks
    if (callType === 'video') {
      // Step A: Attempt optimal audio + video
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: audioConstraints,
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user',
          },
        });
        stream.getAudioTracks().forEach(t => { t.enabled = true; });
        stream.getVideoTracks().forEach(t => { t.enabled = true; });
        localStreamRef.current = stream;
        setLocalStream(stream);
        return stream;
      } catch (errA) {
        console.warn('Optimal audio+video acquisition failed, falling back to basic video:', errA);
      }

      // Step B: Attempt basic audio + video without complex constraints
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true,
        });
        stream.getAudioTracks().forEach(t => { t.enabled = true; });
        stream.getVideoTracks().forEach(t => { t.enabled = true; });
        localStreamRef.current = stream;
        setLocalStream(stream);
        return stream;
      } catch (errB) {
        console.warn('Basic audio+video acquisition failed, falling back to audio only:', errB);
      }
    }

    // Step C: Audio-only fallback (or voice call)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
        video: false,
      }).catch(async () => {
        return await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      });

      stream.getAudioTracks().forEach(t => { t.enabled = true; });
      localStreamRef.current = stream;
      setLocalStream(stream);
      return stream;
    } catch (errC) {
      console.error('All media acquisition failed (Microphone/Camera blocked):', errC);
      return null;
    }
  };

  // Create & configure an RTCPeerConnection for a remote user
  const createPeerConnection = useCallback((remoteUser: Profile, roomId: string) => {
    const existing = peerConnectionsRef.current.get(remoteUser.id);
    if (existing && existing.signalingState !== 'closed') {
      return existing;
    }

    const pc = new RTCPeerConnection(RTC_CONFIG);
    peerConnectionsRef.current.set(remoteUser.id, pc);

    // Setup ontrack with reliable fresh MediaStream creation
    pc.ontrack = (event) => {
      let currentStream = remoteStreamsRef.current.get(remoteUser.id);
      if (!currentStream) {
        currentStream = event.streams?.[0] || new MediaStream();
      }
      if (event.track && !currentStream.getTracks().some(t => t.id === event.track.id)) {
        currentStream.addTrack(event.track);
      }

      currentStream.getAudioTracks().forEach(t => { t.enabled = true; });
      currentStream.getVideoTracks().forEach(t => { t.enabled = true; });

      // Always create a new MediaStream instance so React state updates trigger video element playback
      const freshStream = new MediaStream(currentStream.getTracks());
      remoteStreamsRef.current.set(remoteUser.id, freshStream);
      setRemoteStream(freshStream);

      setParticipants(prev => {
        const idx = prev.findIndex(p => p.id === remoteUser.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], stream: freshStream, status: 'connected' };
          return updated;
        }
        return [
          ...prev,
          { id: remoteUser.id, profile: remoteUser, stream: freshStream, status: 'connected' },
        ];
      });
    };

    // Setup onicecandidate with dual channel dispatch (room channel + direct signaling)
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const candPayload = {
          fromUserId: profile?.id,
          toUserId: remoteUser.id,
          candidate: event.candidate,
        };

        if (callRoomChannelRef.current) {
          callRoomChannelRef.current.send({
            type: 'broadcast',
            event: 'ice_candidate',
            payload: candPayload,
          });
        }
        sendSignalToUser(remoteUser.id, 'ice_candidate', candPayload, outgoingCallRef.current?.conversationId, roomId);
      }
    };

    // Attach local tracks immediately
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        track.enabled = true;
        try {
          pc.addTrack(track, localStreamRef.current!);
        } catch (e) {
          console.warn('Track already added to pc:', e);
        }
      });
    }

    return pc;
  }, [profile?.id, sendSignalToUser]);

  // Initiate an offer to a remote peer (with auto-retry)
  const initiatePeerOffer = useCallback(async (remoteUser: Profile, channel: any) => {
    if (!remoteUser?.id || remoteUser.id === profile?.id) return;

    const stream = await acquireLocalMedia(outgoingCallRef.current?.callType || 'voice');
    const pc = createPeerConnection(remoteUser, outgoingCallRef.current?.roomId || 'default');

    // Attach all tracks to PC if not already attached
    if (stream) {
      const senders = pc.getSenders();
      stream.getTracks().forEach(track => {
        if (!senders.some(s => s.track?.id === track.id)) {
          try {
            pc.addTrack(track, stream);
          } catch {}
        }
      });
    }

    const sendOffer = async () => {
      if (pc.signalingState === 'closed') return;
      try {
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: outgoingCallRef.current?.callType === 'video',
        });
        await pc.setLocalDescription(offer);

        const offerPayload = {
          fromUserId: profile?.id,
          toUserId: remoteUser.id,
          sdp: offer,
          senderProfile: profile,
        };

        if (channel) {
          channel.send({
            type: 'broadcast',
            event: 'webrtc_offer',
            payload: offerPayload,
          });
        }
        sendSignalToUser(remoteUser.id, 'webrtc_offer', offerPayload, outgoingCallRef.current?.conversationId, outgoingCallRef.current?.roomId);
      } catch (err) {
        console.warn('Failed to send offer:', err);
      }
    };

    await sendOffer();

    // Auto-retry offer every 1.5s until answer is received
    let offerAttempts = 0;
    if (offerRetryTimerRef.current) clearInterval(offerRetryTimerRef.current);
    offerRetryTimerRef.current = setInterval(() => {
      offerAttempts++;
      if (offerAttempts >= 6 || pc.signalingState === 'stable') {
        if (offerRetryTimerRef.current) {
          clearInterval(offerRetryTimerRef.current);
          offerRetryTimerRef.current = null;
        }
        return;
      }
      sendOffer();
    }, 1500);
  }, [profile, createPeerConnection, sendSignalToUser]);

  // Handle incoming offer from a remote peer
  const handleReceiveOffer = useCallback(async (payload: any, channel: any) => {
    const { fromUserId, sdp, senderProfile } = payload;
    if (!fromUserId || !sdp) return;

    // Ensure sender is in participants
    if (senderProfile) {
      setParticipants(prev => {
        const idx = prev.findIndex(p => p.id === fromUserId);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], profile: senderProfile };
          return updated;
        }
        return [
          ...prev,
          { id: fromUserId, profile: senderProfile, stream: null, status: 'connected' },
        ];
      });
    }

    const stream = await acquireLocalMedia(outgoingCallRef.current?.callType || 'voice');
    const pc = createPeerConnection(
      senderProfile || ({ id: fromUserId, display_name: 'Partner' } as any),
      outgoingCallRef.current?.roomId || 'default'
    );

    if (stream) {
      const senders = pc.getSenders();
      stream.getTracks().forEach(track => {
        if (!senders.some(s => s.track?.id === track.id)) {
          try {
            pc.addTrack(track, stream);
          } catch {}
        }
      });
    }

    try {
      if (pc.signalingState === 'stable' || pc.signalingState === 'have-local-offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        await flushPendingIceCandidates(fromUserId, pc);

        const answer = await pc.createAnswer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: outgoingCallRef.current?.callType === 'video',
        });
        await pc.setLocalDescription(answer);

        const answerPayload = {
          fromUserId: profile?.id,
          toUserId: fromUserId,
          sdp: answer,
        };

        if (channel) {
          channel.send({
            type: 'broadcast',
            event: 'webrtc_answer',
            payload: answerPayload,
          });
        }
        sendSignalToUser(fromUserId, 'webrtc_answer', answerPayload, outgoingCallRef.current?.conversationId, outgoingCallRef.current?.roomId);
      }
    } catch (err) {
      console.warn('Error handling received offer:', err);
    }
  }, [profile, createPeerConnection, flushPendingIceCandidates, sendSignalToUser]);

  // Handle incoming answer from remote peer
  const handleReceiveAnswer = useCallback(async (payload: any) => {
    const { fromUserId, sdp } = payload;
    const pc = peerConnectionsRef.current.get(fromUserId);
    if (!pc || !sdp) return;

    if (offerRetryTimerRef.current) {
      clearInterval(offerRetryTimerRef.current);
      offerRetryTimerRef.current = null;
    }

    try {
      if (pc.signalingState !== 'stable') {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        await flushPendingIceCandidates(fromUserId, pc);
      }
    } catch (err) {
      console.warn('Error setting answer description:', err);
    }
  }, [flushPendingIceCandidates]);

  // Handle incoming ICE candidate from remote peer
  const handleReceiveIceCandidate = useCallback(async (payload: any) => {
    const { fromUserId, candidate } = payload;
    if (!fromUserId || !candidate) return;

    const pc = peerConnectionsRef.current.get(fromUserId);
    if (pc && pc.remoteDescription) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn('Error adding candidate:', e);
      }
    } else {
      const queue = pendingIceCandidatesRef.current.get(fromUserId) || [];
      queue.push(candidate);
      pendingIceCandidatesRef.current.set(fromUserId, queue);
    }
  }, []);

  // Handle peer leaving or declining
  const handlePeerLeft = useCallback((userId: string) => {
    const pc = peerConnectionsRef.current.get(userId);
    if (pc) {
      try {
        pc.close();
      } catch {}
      peerConnectionsRef.current.delete(userId);
    }
    remoteStreamsRef.current.delete(userId);
    pendingIceCandidatesRef.current.delete(userId);

    setParticipants(prev => {
      const remaining = prev.filter(p => p.id !== userId);
      if (remaining.length === 0 && activeCallStatusRef.current === 'connected') {
        setTimeout(() => {
          endCall();
        }, 500);
      }
      return remaining;
    });
  }, []);

  // Join Call Room (Mesh Signaling Channel)
  const joinCallRoom = useCallback(
    async (roomId: string, callType: 'voice' | 'video', announceSelf: boolean) => {
      try {
        const supabase = getSupabaseBrowserClient();
        await acquireLocalMedia(callType);

        // If already connected to this channel, reuse it
        if (callRoomChannelRef.current?.topic === `call-room:${roomId}`) {
          if (announceSelf && profile) {
            callRoomChannelRef.current.send({
              type: 'broadcast',
              event: 'peer_joined',
              payload: { user: profile },
            });
          }
          return;
        }

        const channel = supabase.channel(`call-room:${roomId}`);
        callRoomChannelRef.current = channel;

        channel
          .on('broadcast', { event: 'peer_joined' }, async ({ payload }: any) => {
            if (!payload?.user || payload.user.id === profile?.id) return;
            await initiatePeerOffer(payload.user, channel);
          })
          .on('broadcast', { event: 'webrtc_offer' }, async ({ payload }: any) => {
            if (!payload || payload.toUserId !== profile?.id) return;
            await handleReceiveOffer(payload, channel);
          })
          .on('broadcast', { event: 'webrtc_answer' }, async ({ payload }: any) => {
            if (!payload || payload.toUserId !== profile?.id) return;
            await handleReceiveAnswer(payload);
          })
          .on('broadcast', { event: 'ice_candidate' }, async ({ payload }: any) => {
            if (!payload || payload.toUserId !== profile?.id) return;
            await handleReceiveIceCandidate(payload);
          })
          .on('broadcast', { event: 'participant_invited' }, ({ payload }: any) => {
            if (!payload?.participant || payload.participant.id === profile?.id) return;
            setParticipants(prev => {
              if (prev.some(p => p.id === payload.participant.id)) return prev;
              return [
                ...prev,
                {
                  id: payload.participant.id,
                  profile: payload.participant,
                  stream: null,
                  status: 'calling',
                },
              ];
            });
          })
          .on('broadcast', { event: 'peer_left' }, ({ payload }: any) => {
            if (!payload?.userId) return;
            handlePeerLeft(payload.userId);
          })
          .on('broadcast', { event: 'call_declined' }, ({ payload }: any) => {
            if (!payload?.userId) return;
            handlePeerLeft(payload.userId);
          })
          .on('broadcast', { event: 'call_ended' }, () => {
            endCall();
          })
          .subscribe((status: string) => {
            if (status === 'SUBSCRIBED') {
              if (announceSelf && profile) {
                channel.send({
                  type: 'broadcast',
                  event: 'peer_joined',
                  payload: { user: profile },
                });
              }
            }
          });
      } catch (err) {
        console.error('Error joining call room:', err);
      }
    },
    [profile, initiatePeerOffer, handleReceiveOffer, handleReceiveAnswer, handleReceiveIceCandidate, handlePeerLeft]
  );

  // Listen for incoming call notifications and global call signals
  useEffect(() => {
    if (!profile?.id) return;
    const supabase = getSupabaseBrowserClient();

    const callChannel = supabase.channel(`call-user:${profile.id}`);
    const notifChannel = supabase.channel(`user-notifications:${profile.id}`);

    const handleIncomingCall = (payload: any) => {
      if (!payload || !payload.caller) return;
      if (isDuplicateSignal('incoming_call', payload)) return;

      // Don't accept or ring if already in another active call state
      if (activeCallStatusRef.current !== 'idle') return;
      if (outgoingCallRef.current || incomingCallRef.current) return;

      const callId = payload.callId || `call_${Date.now()}`;
      const roomId = payload.roomId || `room_${callId}`;
      activeCallStatusRef.current = 'ringing';
      activeCallIdRef.current = callId;

      // Log incoming call in history (status 'missed' until answered)
      if (profile?.id) {
        addCallLog(profile.id, {
          callId,
          partner: payload.caller,
          direction: 'incoming',
          callType: payload.callType || 'voice',
          status: 'missed',
          duration: 0,
          startedAt: new Date().toISOString(),
          conversationId: payload.conversationId,
        });
      }

      setIncomingCall({
        caller: payload.caller,
        callType: payload.callType || 'voice',
        conversationId: payload.conversationId,
        callId,
        roomId,
        sdp: payload.sdp || null,
        isMerge: !!payload.isMerge,
        existingParticipants: payload.existingParticipants || [],
      });

      // Start melodic ringtone chime on callee's device
      startIncomingRing();

      // Send ACK back to caller immediately
      sendSignalToUser(
        payload.caller.id,
        'call_ringing',
        {
          callId,
          roomId,
          conversationId: payload.conversationId,
        },
        payload.conversationId,
        roomId
      );
    };

    const handleCallRinging = (payload?: any) => {
      if (isDuplicateSignal('call_ringing', payload)) return;

      if (callRetryTimerRef.current) {
        clearInterval(callRetryTimerRef.current);
        callRetryTimerRef.current = null;
      }

      if (activeCallStatusRef.current !== 'calling') {
        return;
      }

      activeCallStatusRef.current = 'ringing';

      setOutgoingCall(prev => {
        if (prev && prev.status === 'calling') {
          return { ...prev, status: 'ringing' };
        }
        return prev;
      });

      if (activeCallStatusRef.current === 'ringing') {
        startOutgoingRing();
      }
    };

    const handleCallAccepted = async (payload: any) => {
      if (isDuplicateSignal('call_accepted', payload)) return;

      if (callRetryTimerRef.current) {
        clearInterval(callRetryTimerRef.current);
        callRetryTimerRef.current = null;
      }
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }

      stopAllRingtones();
      activeCallStatusRef.current = 'connected';

      if (profile?.id && activeCallIdRef.current) {
        updateCallLog(profile.id, activeCallIdRef.current, {
          status: 'connected',
        });
      }

      setOutgoingCall(prev => (prev ? { ...prev, status: 'connected' } : null));

      const roomId = payload.roomId || outgoingCallRef.current?.roomId || `room_${payload.callId}`;
      await joinCallRoom(roomId, payload.callType || 'voice', false);

      // If answer SDP was returned in call_accepted payload, set remote description immediately!
      if (payload.sdp) {
        const partnerId = outgoingCallRef.current?.partner?.id || payload.callee?.id;
        const pc = peerConnectionsRef.current.get(partnerId);
        if (pc && pc.signalingState !== 'stable') {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
            await flushPendingIceCandidates(partnerId, pc);
          } catch (err) {
            console.warn('Error setting answer from call_accepted:', err);
          }
        }
      }
    };

    const handleCallDeclined = (payload?: any) => {
      if (isDuplicateSignal('call_declined', payload)) return;

      if (callRetryTimerRef.current) {
        clearInterval(callRetryTimerRef.current);
        callRetryTimerRef.current = null;
      }
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }

      stopAllRingtones();

      if (participantsRef.current.length > 1 && payload?.userId) {
        handlePeerLeft(payload.userId);
        return;
      }

      activeCallStatusRef.current = 'ended';

      if (profile?.id && activeCallIdRef.current) {
        updateCallLog(profile.id, activeCallIdRef.current, {
          status: 'declined',
          endedAt: new Date().toISOString(),
        });
      }
      activeCallIdRef.current = null;

      setOutgoingCall(prev => (prev ? { ...prev, status: 'declined' } : null));
      setTimeout(() => {
        setOutgoingCall(null);
        cleanupMedia();
      }, 1500);
    };

    const handleCallCancelled = (payload?: any) => {
      if (isDuplicateSignal('call_cancelled', payload)) return;

      stopAllRingtones();
      activeCallStatusRef.current = 'idle';

      if (profile?.id && activeCallIdRef.current) {
        updateCallLog(profile.id, activeCallIdRef.current, {
          status: 'missed',
          endedAt: new Date().toISOString(),
        });
      }
      activeCallIdRef.current = null;
      setIncomingCall(null);
    };

    callChannel
      .on('broadcast', { event: 'incoming_call' }, ({ payload }: any) => handleIncomingCall(payload))
      .on('broadcast', { event: 'call_ringing' }, ({ payload }: any) => handleCallRinging(payload))
      .on('broadcast', { event: 'call_accepted' }, async ({ payload }: any) => handleCallAccepted(payload))
      .on('broadcast', { event: 'call_declined' }, ({ payload }: any) => handleCallDeclined(payload))
      .on('broadcast', { event: 'call_cancelled' }, ({ payload }: any) => handleCallCancelled(payload))
      .on('broadcast', { event: 'ice_candidate' }, ({ payload }: any) => handleReceiveIceCandidate(payload))
      .on('broadcast', { event: 'webrtc_offer' }, async ({ payload }: any) => handleReceiveOffer(payload, callRoomChannelRef.current))
      .on('broadcast', { event: 'webrtc_answer' }, async ({ payload }: any) => handleReceiveAnswer(payload))
      .subscribe();

    notifChannel
      .on('broadcast', { event: 'incoming_call' }, ({ payload }: any) => handleIncomingCall(payload))
      .on('broadcast', { event: 'call_ringing' }, ({ payload }: any) => handleCallRinging(payload))
      .on('broadcast', { event: 'call_accepted' }, async ({ payload }: any) => handleCallAccepted(payload))
      .on('broadcast', { event: 'call_declined' }, ({ payload }: any) => handleCallDeclined(payload))
      .on('broadcast', { event: 'call_cancelled' }, ({ payload }: any) => handleCallCancelled(payload))
      .on('broadcast', { event: 'ice_candidate' }, ({ payload }: any) => handleReceiveIceCandidate(payload))
      .on('broadcast', { event: 'webrtc_offer' }, async ({ payload }: any) => handleReceiveOffer(payload, callRoomChannelRef.current))
      .on('broadcast', { event: 'webrtc_answer' }, async ({ payload }: any) => handleReceiveAnswer(payload))
      .subscribe();

    return () => {
      supabase.removeChannel(callChannel);
      supabase.removeChannel(notifChannel);
    };
  }, [profile?.id, sendSignalToUser, cleanupMedia, isDuplicateSignal, joinCallRoom, handlePeerLeft, flushPendingIceCandidates, handleReceiveIceCandidate, handleReceiveOffer, handleReceiveAnswer]);

  // Handle call duration timer when status === 'connected'
  useEffect(() => {
    if (outgoingCall?.status === 'connected') {
      if (!callDurationTimerRef.current) {
        callDurationTimerRef.current = setInterval(() => {
          setOutgoingCall(prev => {
            if (!prev) return null;
            const newDuration = prev.duration + 1;
            if (profile?.id && activeCallIdRef.current && newDuration % 2 === 0) {
              updateCallLog(profile.id, activeCallIdRef.current, {
                status: 'connected',
                duration: newDuration,
              });
            }
            return { ...prev, duration: newDuration };
          });
        }, 1000);
      }
    } else {
      if (callDurationTimerRef.current) {
        clearInterval(callDurationTimerRef.current);
        callDurationTimerRef.current = null;
      }
    }
  }, [outgoingCall?.status, profile?.id]);

  // 1. Start Call (Caller initiates 1-on-1 call with instant WebRTC setup)
  const startCall = async (partner: Profile, type: 'voice' | 'video', convId?: string) => {
    if (!profile) return;
    stopAllRingtones();
    cleanupMedia();

    const conversationId = convId || activeConversationId || '';
    const callId = `call_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const roomId = `room_${callId}`;

    activeCallStatusRef.current = 'calling';
    activeCallIdRef.current = callId;

    if (profile?.id) {
      addCallLog(profile.id, {
        callId,
        partner,
        direction: 'outgoing',
        callType: type,
        status: 'unavailable',
        duration: 0,
        startedAt: new Date().toISOString(),
        conversationId,
      });
    }

    const initialParticipants: CallParticipant[] = [
      {
        id: partner.id,
        profile: partner,
        stream: null,
        status: 'calling',
      },
    ];

    setParticipants(initialParticipants);
    setOutgoingCall({
      partner,
      participants: initialParticipants,
      roomId,
      callType: type,
      conversationId,
      status: 'calling',
      duration: 0,
      isGroup: false,
    });
    setIsVideoEnabled(type === 'video');
    setIsMuted(false);

    // Acquire local media tracks immediately
    await acquireLocalMedia(type);

    // Pre-create RTCPeerConnection for partner
    const pc = createPeerConnection(partner, roomId);

    // Create SDP Offer immediately
    let initialOffer: RTCSessionDescriptionInit | null = null;
    try {
      initialOffer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: type === 'video',
      });
      await pc.setLocalDescription(initialOffer);
    } catch (err) {
      console.warn('Initial offer error:', err);
    }

    // Join room channel
    await joinCallRoom(roomId, type, false);

    // Send call invite to partner with periodic retry
    let attempts = 0;
    const sendInvite = () => {
      if (activeCallStatusRef.current !== 'calling') {
        if (callRetryTimerRef.current) {
          clearInterval(callRetryTimerRef.current);
          callRetryTimerRef.current = null;
        }
        return;
      }

      attempts++;
      sendSignalToUser(
        partner.id,
        'incoming_call',
        {
          caller: profile,
          callType: type,
          conversationId,
          callId,
          roomId,
          sdp: initialOffer,
          existingParticipants: [profile],
        },
        conversationId,
        roomId
      );

      if (attempts >= 12 && callRetryTimerRef.current) {
        clearInterval(callRetryTimerRef.current);
        callRetryTimerRef.current = null;
      }
    };

    sendInvite();
    callRetryTimerRef.current = setInterval(sendInvite, 1500);

    // Call timeout: if not answered after 35 seconds
    if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
    callTimeoutRef.current = setTimeout(() => {
      if (callRetryTimerRef.current) {
        clearInterval(callRetryTimerRef.current);
        callRetryTimerRef.current = null;
      }
      stopAllRingtones();
      activeCallStatusRef.current = 'ended';

      if (profile?.id && activeCallIdRef.current) {
        updateCallLog(profile.id, activeCallIdRef.current, {
          status: 'unavailable',
          endedAt: new Date().toISOString(),
        });
      }
      activeCallIdRef.current = null;

      setOutgoingCall(prev => {
        if (prev && prev.status !== 'connected') {
          return { ...prev, status: 'unavailable' };
        }
        return prev;
      });

      sendSignalToUser(partner.id, 'call_cancelled', { callId, conversationId, roomId }, conversationId, roomId);

      setTimeout(() => {
        setOutgoingCall(null);
        cleanupMedia();
      }, 2000);
    }, 35000);
  };

  // 2. Merge Call / Add Participant into active call (Seamless Multi-Party Mesh)
  const mergeCall = async (partner: Profile, convId?: string) => {
    if (!profile || !outgoingCallRef.current) return;
    const currentRoomId = outgoingCallRef.current.roomId;
    if (!currentRoomId) return;

    if (participantsRef.current.some(p => p.id === partner.id)) {
      return;
    }

    const newParticipantItem: CallParticipant = {
      id: partner.id,
      profile: partner,
      stream: null,
      status: 'calling',
    };

    setParticipants(prev => [...prev, newParticipantItem]);

    setOutgoingCall(prev => {
      if (!prev) return null;
      return {
        ...prev,
        isGroup: true,
        participants: [...prev.participants, newParticipantItem],
      };
    });

    if (callRoomChannelRef.current) {
      callRoomChannelRef.current.send({
        type: 'broadcast',
        event: 'participant_invited',
        payload: { participant: partner },
      });
    }

    // Pre-create connection for merged user
    const pc = createPeerConnection(partner, currentRoomId);
    let mergeOffer: RTCSessionDescriptionInit | null = null;
    try {
      mergeOffer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: outgoingCallRef.current.callType === 'video',
      });
      await pc.setLocalDescription(mergeOffer);
    } catch {}

    const mergeCallId = `merge_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const currentParticipantsList = [
      profile,
      ...participantsRef.current.map(p => p.profile),
    ];

    sendSignalToUser(
      partner.id,
      'incoming_call',
      {
        caller: profile,
        callType: outgoingCallRef.current.callType,
        conversationId: convId || outgoingCallRef.current.conversationId,
        callId: mergeCallId,
        roomId: currentRoomId,
        sdp: mergeOffer,
        isMerge: true,
        existingParticipants: currentParticipantsList,
      },
      convId || outgoingCallRef.current.conversationId,
      currentRoomId
    );
  };

  // 3. Accept Call (Callee accepts 1-on-1 or Merged Group Call)
  const acceptCall = async () => {
    if (!incomingCall || !profile) return;

    stopAllRingtones();
    activeCallStatusRef.current = 'connected';

    const { caller, callType, conversationId, callId, roomId, isMerge, existingParticipants, sdp: initialOffer } = incomingCall;
    activeCallIdRef.current = callId;

    if (profile?.id) {
      updateCallLog(profile.id, callId, {
        status: 'connected',
      });
    }

    const initialParticipants: CallParticipant[] = [];
    if (isMerge && existingParticipants && existingParticipants.length > 0) {
      existingParticipants.forEach(p => {
        if (p.id !== profile.id) {
          initialParticipants.push({
            id: p.id,
            profile: p,
            stream: null,
            status: 'connected',
          });
        }
      });
    } else {
      initialParticipants.push({
        id: caller.id,
        profile: caller,
        stream: null,
        status: 'connected',
      });
    }

    setParticipants(initialParticipants);
    setOutgoingCall({
      partner: caller,
      participants: initialParticipants,
      roomId,
      callType,
      conversationId,
      status: 'connected',
      duration: 0,
      isGroup: isMerge || (existingParticipants && existingParticipants.length > 1),
    });
    setIsVideoEnabled(callType === 'video');
    setIsMuted(false);
    setIncomingCall(null);

    // 1. Acquire local media tracks
    const stream = await acquireLocalMedia(callType);

    // 2. Pre-create connection for caller
    const pc = createPeerConnection(caller, roomId);

    // Ensure tracks are added to peer connection
    if (stream) {
      const senders = pc.getSenders();
      stream.getTracks().forEach(track => {
        if (!senders.some(s => s.track?.id === track.id)) {
          try {
            pc.addTrack(track, stream);
          } catch {}
        }
      });
    }

    // 3. Join room channel
    await joinCallRoom(roomId, callType, false);

    // 4. If initialOffer was provided in incoming_call, generate answer right now!
    let answerSdp: RTCSessionDescriptionInit | null = null;
    if (initialOffer) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(initialOffer));
        await flushPendingIceCandidates(caller.id, pc);

        const answer = await pc.createAnswer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: callType === 'video',
        });
        await pc.setLocalDescription(answer);
        answerSdp = answer;
      } catch (err) {
        console.warn('Error answering initial offer:', err);
      }
    }

    // 5. Send call_accepted to caller with the answer SDP!
    sendSignalToUser(
      caller.id,
      'call_accepted',
      {
        conversationId,
        callId,
        callType,
        roomId,
        sdp: answerSdp,
        callee: profile,
      },
      conversationId,
      roomId
    );
  };

  // 4. Decline Call
  const declineCall = () => {
    stopAllRingtones();
    activeCallStatusRef.current = 'idle';

    if (profile?.id && incomingCall) {
      updateCallLog(profile.id, incomingCall.callId, {
        status: 'declined',
        endedAt: new Date().toISOString(),
      });
    }
    activeCallIdRef.current = null;

    if (!incomingCall) return;
    const { caller, conversationId, callId, roomId, isMerge } = incomingCall;

    if (isMerge && roomId && profile) {
      try {
        const supabase = getSupabaseBrowserClient();
        const channel = supabase.channel(`call-room:${roomId}`);
        channel.subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            channel.send({
              type: 'broadcast',
              event: 'call_declined',
              payload: { userId: profile.id, roomId },
            });
            setTimeout(() => supabase.removeChannel(channel), 1000);
          }
        });
      } catch {}
    }

    sendSignalToUser(caller.id, 'call_declined', { conversationId, callId, userId: profile?.id }, conversationId, roomId);

    setIncomingCall(null);
    cleanupMedia();
  };

  // 5. End Call
  const endCall = () => {
    stopAllRingtones();
    activeCallStatusRef.current = 'ended';

    if (profile?.id && activeCallIdRef.current) {
      const finalDuration = outgoingCallRef.current?.duration || 0;
      updateCallLog(profile.id, activeCallIdRef.current, {
        status: outgoingCallRef.current?.status === 'connected' ? 'connected' : 'ended',
        duration: finalDuration,
        endedAt: new Date().toISOString(),
      });
    }
    activeCallIdRef.current = null;

    if (callRetryTimerRef.current) {
      clearInterval(callRetryTimerRef.current);
      callRetryTimerRef.current = null;
    }
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }
    if (offerRetryTimerRef.current) {
      clearInterval(offerRetryTimerRef.current);
      offerRetryTimerRef.current = null;
    }

    const currentCall = outgoingCallRef.current;

    if (callRoomChannelRef.current) {
      try {
        const isMultiPeer = participantsRef.current.length > 1;
        if (isMultiPeer && profile) {
          callRoomChannelRef.current.send({
            type: 'broadcast',
            event: 'peer_left',
            payload: { userId: profile.id },
          });
        } else {
          callRoomChannelRef.current.send({
            type: 'broadcast',
            event: 'call_ended',
            payload: { conversationId: currentCall?.conversationId },
          });
        }
      } catch {}
    }

    if (currentCall?.partner?.id) {
      sendSignalToUser(
        currentCall.partner.id,
        currentCall.status === 'connected' ? 'call_ended' : 'call_cancelled',
        { conversationId: currentCall.conversationId, roomId: currentCall.roomId },
        currentCall.conversationId,
        currentCall.roomId
      );
    }

    setOutgoingCall(prev => (prev ? { ...prev, status: 'ended' } : null));
    setIncomingCall(null);

    setTimeout(() => {
      setOutgoingCall(null);
      cleanupMedia();
    }, 600);
  };

  // Controls: Mute
  const toggleMute = () => {
    const nextMuted = !isMuted;
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !nextMuted;
      });
    }
    setIsMuted(nextMuted);

    if (callRoomChannelRef.current && profile) {
      callRoomChannelRef.current.send({
        type: 'broadcast',
        event: 'peer_muted',
        payload: { userId: profile.id, isMuted: nextMuted },
      });
    }
  };

  // Controls: Video (Dynamic camera hardware acquisition & WebRTC renegotiation)
  const toggleVideo = async () => {
    const nextVideo = !isVideoEnabled;

    if (nextVideo) {
      // Turning camera ON
      let stream = localStreamRef.current;
      const existingVideoTracks = stream ? stream.getVideoTracks() : [];
      const hasLiveTrack = existingVideoTracks.some(t => t.readyState === 'live');

      if (!hasLiveTrack) {
        try {
          let newVideoStream: MediaStream | null = null;
          try {
            newVideoStream = await navigator.mediaDevices.getUserMedia({
              video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: 'user',
              },
            });
          } catch {
            newVideoStream = await navigator.mediaDevices.getUserMedia({ video: true });
          }

          const newVideoTrack = newVideoStream?.getVideoTracks()[0];
          if (newVideoTrack) {
            newVideoTrack.enabled = true;
            if (!stream) {
              stream = new MediaStream([newVideoTrack]);
              localStreamRef.current = stream;
            } else {
              stream.addTrack(newVideoTrack);
            }

            // Add or replace track on all active peer connections
            peerConnectionsRef.current.forEach(pc => {
              if (pc.signalingState !== 'closed') {
                const senders = pc.getSenders();
                const videoSender = senders.find(s => s.track?.kind === 'video');
                if (videoSender) {
                  videoSender.replaceTrack(newVideoTrack).catch(err => {
                    console.warn('Error replacing video track:', err);
                  });
                } else {
                  try {
                    pc.addTrack(newVideoTrack, stream!);
                  } catch (e) {
                    console.warn('Error adding video track to pc:', e);
                  }
                }
              }
            });

            const fresh = new MediaStream(stream.getTracks());
            localStreamRef.current = fresh;
            setLocalStream(fresh);
          }
        } catch (err) {
          console.warn('Failed to turn on camera:', err);
          return;
        }
      } else {
        existingVideoTracks.forEach(t => { t.enabled = true; });
        const fresh = new MediaStream(stream!.getTracks());
        setLocalStream(fresh);
      }
    } else {
      // Turning camera OFF
      if (localStreamRef.current) {
        localStreamRef.current.getVideoTracks().forEach(track => {
          track.enabled = false;
        });
        const fresh = new MediaStream(localStreamRef.current.getTracks());
        setLocalStream(fresh);
      }
    }

    setIsVideoEnabled(nextVideo);

    if (callRoomChannelRef.current && profile) {
      callRoomChannelRef.current.send({
        type: 'broadcast',
        event: 'peer_video_toggled',
        payload: { userId: profile.id, isVideoEnabled: nextVideo },
      });
    }
  };

  // Controls: Speaker
  const toggleSpeaker = () => {
    setIsSpeakerOn(prev => !prev);
  };

  return (
    <CallContext.Provider
      value={{
        outgoingCall,
        incomingCall,
        localStream,
        remoteStream,
        participants,
        isMuted,
        isVideoEnabled,
        isSpeakerOn,
        callHistory,
        clearCallHistory,
        deleteCallLog,
        startCall,
        mergeCall,
        acceptCall,
        declineCall,
        endCall,
        toggleMute,
        toggleVideo,
        toggleSpeaker,
      }}
    >
      {children}
    </CallContext.Provider>
  );
}

export function useCall() {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
}
