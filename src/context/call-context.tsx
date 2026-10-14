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
  isMerge?: boolean;
  existingParticipants?: Profile[];
}

interface CallContextType {
  outgoingCall: OutgoingCallState | null;
  incomingCall: IncomingCallState | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null; // primary remote stream for 1-to-1 compat
  participants: CallParticipant[]; // all remote participants in active call
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
  ],
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

  // Multi-channel signaling broadcaster to reach a user directly
  const sendSignalToUser = useCallback(
    (targetUserId: string, event: string, payload: any, conversationId?: string) => {
      if (!targetUserId) return;
      try {
        const supabase = getSupabaseBrowserClient();
        const enrichedPayload = {
          ...payload,
          timestamp: payload?.timestamp || Date.now(),
        };

        // 1. Dedicated Call Channel for target user
        const callChannel = supabase.channel(`call-user:${targetUserId}`);
        callChannel.subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            callChannel.send({
              type: 'broadcast',
              event,
              payload: enrichedPayload,
            });
          }
        });

        // 2. Also send to user-notifications:${targetUserId}
        const notifChannel = supabase.channel(`user-notifications:${targetUserId}`);
        notifChannel.subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            notifChannel.send({
              type: 'broadcast',
              event,
              payload: enrichedPayload,
            });
          }
        });

        // 3. If in active conversation, also broadcast directly to conversation channel
        if (conversationId) {
          const convChannel = supabase.channel(`conversation:${conversationId}`);
          convChannel.subscribe((status: string) => {
            if (status === 'SUBSCRIBED') {
              convChannel.send({
                type: 'broadcast',
                event,
                payload: enrichedPayload,
              });
            }
          });
        }
      } catch (err) {
        console.warn('Failed to send call signal:', err);
      }
    },
    []
  );

  // Helper to acquire local media stream
  const acquireLocalMedia = async (callType: 'voice' | 'video') => {
    if (localStreamRef.current) return localStreamRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === 'video',
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      return stream;
    } catch (err) {
      console.warn('Error acquiring media devices:', err);
      return null;
    }
  };

  // Initiate a WebRTC offer to a remote peer (caller/existing peer role)
  const initiatePeerOffer = useCallback(async (remoteUser: Profile, channel: any) => {
    if (!remoteUser?.id || remoteUser.id === profile?.id) return;

    // Check if peer connection already exists and is active
    const existingPc = peerConnectionsRef.current.get(remoteUser.id);
    if (existingPc && existingPc.signalingState !== 'closed') {
      return;
    }

    // Ensure local stream is ready
    const stream = await acquireLocalMedia(outgoingCallRef.current?.callType || 'voice');

    // Create RTCPeerConnection for this remote peer
    const pc = new RTCPeerConnection(RTC_CONFIG);
    peerConnectionsRef.current.set(remoteUser.id, pc);

    // Setup ontrack
    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        const remoteMediaStream = event.streams[0];
        remoteStreamsRef.current.set(remoteUser.id, remoteMediaStream);
        setRemoteStream(remoteMediaStream);
        setParticipants(prev => {
          const idx = prev.findIndex(p => p.id === remoteUser.id);
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = { ...updated[idx], stream: remoteMediaStream, status: 'connected' };
            return updated;
          }
          return [
            ...prev,
            { id: remoteUser.id, profile: remoteUser, stream: remoteMediaStream, status: 'connected' },
          ];
        });
      }
    };

    // Setup ICE candidate gathering
    pc.onicecandidate = (event) => {
      if (event.candidate && channel) {
        channel.send({
          type: 'broadcast',
          event: 'ice_candidate',
          payload: {
            fromUserId: profile?.id,
            toUserId: remoteUser.id,
            candidate: event.candidate,
          },
        });
      }
    };

    // Attach local media tracks
    if (stream) {
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });
    }

    // Create & dispatch WebRTC offer
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      channel.send({
        type: 'broadcast',
        event: 'webrtc_offer',
        payload: {
          fromUserId: profile?.id,
          toUserId: remoteUser.id,
          sdp: offer,
          senderProfile: profile,
        },
      });
    } catch (err) {
      console.error('Error creating offer for peer:', remoteUser.id, err);
    }
  }, [profile]);

  // Handle incoming offer from a remote peer (callee/new peer role)
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

    let pc = peerConnectionsRef.current.get(fromUserId);
    if (!pc || pc.signalingState === 'closed') {
      pc = new RTCPeerConnection(RTC_CONFIG);
      peerConnectionsRef.current.set(fromUserId, pc);

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          const remoteMediaStream = event.streams[0];
          remoteStreamsRef.current.set(fromUserId, remoteMediaStream);
          setRemoteStream(remoteMediaStream);
          setParticipants(prev => {
            const idx = prev.findIndex(p => p.id === fromUserId);
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = { ...updated[idx], stream: remoteMediaStream, status: 'connected' };
              return updated;
            }
            return [
              ...prev,
              {
                id: fromUserId,
                profile: senderProfile || { id: fromUserId, display_name: 'Participant' } as any,
                stream: remoteMediaStream,
                status: 'connected',
              },
            ];
          });
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && channel) {
          channel.send({
            type: 'broadcast',
            event: 'ice_candidate',
            payload: {
              fromUserId: profile?.id,
              toUserId: fromUserId,
              candidate: event.candidate,
            },
          });
        }
      };

      if (stream) {
        stream.getTracks().forEach(track => {
          pc!.addTrack(track, stream);
        });
      }
    }

    try {
      if (pc.signalingState === 'stable' || pc.signalingState === 'have-local-offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));

        // Drain pending ICE candidates
        const pending = pendingIceCandidatesRef.current.get(fromUserId) || [];
        for (const cand of pending) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(cand));
          } catch {}
        }
        pendingIceCandidatesRef.current.delete(fromUserId);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        channel.send({
          type: 'broadcast',
          event: 'webrtc_answer',
          payload: {
            fromUserId: profile?.id,
            toUserId: fromUserId,
            sdp: answer,
          },
        });
      }
    } catch (err) {
      console.warn('Error handling offer from peer:', fromUserId, err);
    }
  }, [profile]);

  // Handle incoming answer from remote peer
  const handleReceiveAnswer = useCallback(async (payload: any) => {
    const { fromUserId, sdp } = payload;
    const pc = peerConnectionsRef.current.get(fromUserId);
    if (!pc || !sdp) return;

    try {
      if (pc.signalingState !== 'stable') {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      }
      // Drain pending ICE candidates
      const pending = pendingIceCandidatesRef.current.get(fromUserId) || [];
      for (const cand of pending) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(cand));
        } catch {}
      }
      pendingIceCandidatesRef.current.delete(fromUserId);
    } catch (err) {
      console.warn('Error setting answer description:', err);
    }
  }, []);

  // Handle incoming ICE candidate from remote peer
  const handleReceiveIceCandidate = useCallback(async (payload: any) => {
    const { fromUserId, candidate } = payload;
    if (!fromUserId || !candidate) return;

    const pc = peerConnectionsRef.current.get(fromUserId);
    if (pc && pc.remoteDescription) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {}
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
      // If all remote peers have left, end call
      if (remaining.length === 0 && activeCallStatusRef.current === 'connected') {
        setTimeout(() => {
          endCall();
        }, 600);
      }
      return remaining;
    });
  }, []);

  // Join Call Room (Mesh Signaling Channel)
  const joinCallRoom = useCallback(
    async (roomId: string, callType: 'voice' | 'video', announceSelf: boolean) => {
      stopAllRingtones();
      try {
        const supabase = getSupabaseBrowserClient();
        await acquireLocalMedia(callType);

        // If channel already active on same room, reuse it
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
            // Existing peer creates offer for newly joined peer!
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
          .on('broadcast', { event: 'peer_muted' }, ({ payload }: any) => {
            if (!payload?.userId) return;
            setParticipants(prev =>
              prev.map(p =>
                p.id === payload.userId ? { ...p, isAudioMuted: !!payload.isMuted } : p
              )
            );
          })
          .on('broadcast', { event: 'peer_video_toggled' }, ({ payload }: any) => {
            if (!payload?.userId) return;
            setParticipants(prev =>
              prev.map(p =>
                p.id === payload.userId
                  ? { ...p, isVideoMuted: !payload.isVideoEnabled }
                  : p
              )
            );
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
        isMerge: !!payload.isMerge,
        existingParticipants: payload.existingParticipants || [],
      });

      // Start melodic ringtone chime on callee's device
      startIncomingRing();

      // Send ACK back to caller
      sendSignalToUser(
        payload.caller.id,
        'call_ringing',
        {
          callId,
          roomId,
          conversationId: payload.conversationId,
        },
        payload.conversationId
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

      // If in a multi-peer call and a merged user declined, only remove that user!
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
      }, 1800);
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
      .subscribe();

    notifChannel
      .on('broadcast', { event: 'incoming_call' }, ({ payload }: any) => handleIncomingCall(payload))
      .on('broadcast', { event: 'call_ringing' }, ({ payload }: any) => handleCallRinging(payload))
      .on('broadcast', { event: 'call_accepted' }, async ({ payload }: any) => handleCallAccepted(payload))
      .on('broadcast', { event: 'call_declined' }, ({ payload }: any) => handleCallDeclined(payload))
      .on('broadcast', { event: 'call_cancelled' }, ({ payload }: any) => handleCallCancelled(payload))
      .subscribe();

    return () => {
      supabase.removeChannel(callChannel);
      supabase.removeChannel(notifChannel);
    };
  }, [profile?.id, sendSignalToUser, cleanupMedia, isDuplicateSignal, joinCallRoom, handlePeerLeft]);

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

  // 1. Start Call (Caller initiates 1-on-1 call)
  const startCall = async (partner: Profile, type: 'voice' | 'video', convId?: string) => {
    if (!profile) return;
    stopAllRingtones();
    cleanupMedia();

    const conversationId = convId || activeConversationId || '';
    const callId = `call_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const roomId = `room_${callId}`;

    activeCallStatusRef.current = 'calling';
    activeCallIdRef.current = callId;

    // Log outgoing call in history
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

    // Acquire local media
    await acquireLocalMedia(type);

    // Join room in preparation
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
          existingParticipants: [profile],
        },
        conversationId
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

      sendSignalToUser(partner.id, 'call_cancelled', { callId, conversationId, roomId }, conversationId);

      setTimeout(() => {
        setOutgoingCall(null);
        cleanupMedia();
      }, 2500);
    }, 35000);
  };

  // 2. Merge Call / Add Participant into active call (Seamless Multi-Party Mesh)
  const mergeCall = async (partner: Profile, convId?: string) => {
    if (!profile || !outgoingCallRef.current) return;
    const currentRoomId = outgoingCallRef.current.roomId;
    if (!currentRoomId) return;

    // Check if partner is already in call
    if (participantsRef.current.some(p => p.id === partner.id)) {
      return;
    }

    // 1. Add partner to local participants as 'calling'
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

    // 2. Broadcast to room so other members see the new participant ringing
    if (callRoomChannelRef.current) {
      callRoomChannelRef.current.send({
        type: 'broadcast',
        event: 'participant_invited',
        payload: { participant: partner },
      });
    }

    // 3. Send merge invite to the partner
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
        isMerge: true,
        existingParticipants: currentParticipantsList,
      },
      convId || outgoingCallRef.current.conversationId
    );
  };

  // 3. Accept Call (Callee accepts 1-on-1 or Merged Group Call)
  const acceptCall = async () => {
    if (!incomingCall || !profile) return;

    stopAllRingtones();
    activeCallStatusRef.current = 'connected';

    const { caller, callType, conversationId, callId, roomId, isMerge, existingParticipants } = incomingCall;
    activeCallIdRef.current = callId;

    if (profile?.id) {
      updateCallLog(profile.id, callId, {
        status: 'connected',
      });
    }

    // Build initial participants list
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
    setIncomingCall(null);

    // Send call_accepted to caller
    sendSignalToUser(caller.id, 'call_accepted', { conversationId, callId, callType, roomId }, conversationId);

    // Callee joins the room and announces presence to existing peers
    await joinCallRoom(roomId, callType, true);
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

    // If it was a merge invite, notify the room that this user declined
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

    sendSignalToUser(caller.id, 'call_declined', { conversationId, callId, userId: profile?.id }, conversationId);

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

    const currentCall = outgoingCallRef.current;

    // If multi-peer call, send peer_left so remaining participants keep talking uninterrupted
    // If 1-on-1 call, send call_ended to terminate for both
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
        currentCall.conversationId
      );
    }

    setOutgoingCall(prev => (prev ? { ...prev, status: 'ended' } : null));
    setIncomingCall(null);

    setTimeout(() => {
      setOutgoingCall(null);
      cleanupMedia();
    }, 700);
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

  // Controls: Video
  const toggleVideo = () => {
    const nextVideo = !isVideoEnabled;
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = nextVideo;
      });
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
