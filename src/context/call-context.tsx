'use client';

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from './auth-context';
import { useChat } from './chat-context';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { startOutgoingRing, startIncomingRing, stopAllRingtones } from '@/lib/ringtone';
import type { Profile } from '@/types/database';

export interface OutgoingCallState {
  partner: Profile;
  callType: 'voice' | 'video';
  conversationId: string;
  status: 'calling' | 'ringing' | 'connected' | 'ended';
  duration: number;
}

export interface IncomingCallState {
  caller: Profile;
  callType: 'voice' | 'video';
  conversationId: string;
  callId: string;
}

interface CallContextType {
  outgoingCall: OutgoingCallState | null;
  incomingCall: IncomingCallState | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  isVideoEnabled: boolean;
  isSpeakerOn: boolean;
  startCall: (partner: Profile, type: 'voice' | 'video', conversationId?: string) => Promise<void>;
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
  isMuted: false,
  isVideoEnabled: true,
  isSpeakerOn: true,
  startCall: async () => {},
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
  ],
};

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const { friendPresence, activeConversationId } = useChat();

  const [outgoingCall, setOutgoingCall] = useState<OutgoingCallState | null>(null);
  const [incomingCall, setIncomingCall] = useState<IncomingCallState | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const callRoomChannelRef = useRef<any>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const callDurationTimerRef = useRef<any>(null);

  // Stop media tracks helper
  const cleanupMedia = useCallback(() => {
    stopAllRingtones();
    if (callDurationTimerRef.current) {
      clearInterval(callDurationTimerRef.current);
      callDurationTimerRef.current = null;
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

    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch {}
      pcRef.current = null;
    }

    if (callRoomChannelRef.current) {
      try {
        const supabase = getSupabaseBrowserClient();
        supabase.removeChannel(callRoomChannelRef.current);
      } catch {}
      callRoomChannelRef.current = null;
    }
  }, []);

  // Listen for incoming call notifications on user-notifications channel
  useEffect(() => {
    if (!profile?.id) return;
    const supabase = getSupabaseBrowserClient();
    const userChannel = supabase.channel(`user-notifications:${profile.id}`);

    userChannel
      .on('broadcast', { event: 'incoming_call' }, ({ payload }: any) => {
        if (!payload || !payload.caller) return;
        // Don't accept if already in another call
        if (outgoingCall || incomingCall) return;

        setIncomingCall({
          caller: payload.caller,
          callType: payload.callType || 'voice',
          conversationId: payload.conversationId,
          callId: payload.callId,
        });

        // Start incoming melodic ringtone chime
        startIncomingRing();
      })
      .on('broadcast', { event: 'call_cancelled' }, () => {
        stopAllRingtones();
        setIncomingCall(null);
      })
      .on('broadcast', { event: 'call_declined' }, () => {
        stopAllRingtones();
        setOutgoingCall(prev => (prev ? { ...prev, status: 'ended' } : null));
        setTimeout(() => {
          setOutgoingCall(null);
          cleanupMedia();
        }, 1500);
      })
      .on('broadcast', { event: 'call_accepted' }, async ({ payload }: any) => {
        stopAllRingtones();
        // Callee accepted! Setup WebRTC as Caller
        setOutgoingCall(prev => (prev ? { ...prev, status: 'connected' } : null));
        await setupWebRTCAsCaller(payload.conversationId, payload.callType || 'voice');
      });

    return () => {
      // Keep channel alive
    };
  }, [profile?.id, outgoingCall, incomingCall, cleanupMedia]);

  // Handle call duration timer when status === 'connected'
  useEffect(() => {
    if (outgoingCall?.status === 'connected') {
      if (!callDurationTimerRef.current) {
        callDurationTimerRef.current = setInterval(() => {
          setOutgoingCall(prev => (prev ? { ...prev, duration: prev.duration + 1 } : null));
        }, 1000);
      }
    } else {
      if (callDurationTimerRef.current) {
        clearInterval(callDurationTimerRef.current);
        callDurationTimerRef.current = null;
      }
    }
  }, [outgoingCall?.status]);

  // Setup WebRTC as Caller
  const setupWebRTCAsCaller = async (conversationId: string, callType: 'voice' | 'video') => {
    try {
      const supabase = getSupabaseBrowserClient();
      const channel = supabase.channel(`call-room:${conversationId}`);
      callRoomChannelRef.current = channel;

      const pc = new RTCPeerConnection(RTC_CONFIG);
      pcRef.current = pc;

      // Handle remote tracks
      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
        }
      };

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          channel.send({
            type: 'broadcast',
            event: 'ice_candidate',
            payload: { candidate: event.candidate },
          });
        }
      };

      // Add local media tracks
      let stream = localStreamRef.current;
      if (!stream) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: callType === 'video',
          });
          localStreamRef.current = stream;
          setLocalStream(stream);
        } catch (mediaErr) {
          console.warn('Microphone/Camera permission error:', mediaErr);
        }
      }

      if (stream) {
        stream.getTracks().forEach(track => {
          pc.addTrack(track, stream!);
        });
      }

      // Create Offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      channel
        .on('broadcast', { event: 'webrtc_answer' }, async ({ payload }: any) => {
          if (payload?.sdp) {
            await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          }
        })
        .on('broadcast', { event: 'ice_candidate' }, async ({ payload }: any) => {
          if (payload?.candidate) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
            } catch {}
          }
        })
        .on('broadcast', { event: 'call_ended' }, () => {
          endCall();
        })
        .subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            channel.send({
              type: 'broadcast',
              event: 'webrtc_offer',
              payload: { sdp: offer },
            });
          }
        });
    } catch (err) {
      console.error('Error establishing WebRTC as caller:', err);
    }
  };

  // Setup WebRTC as Callee
  const setupWebRTCAsCallee = async (conversationId: string, callType: 'voice' | 'video') => {
    try {
      const supabase = getSupabaseBrowserClient();
      const channel = supabase.channel(`call-room:${conversationId}`);
      callRoomChannelRef.current = channel;

      const pc = new RTCPeerConnection(RTC_CONFIG);
      pcRef.current = pc;

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          channel.send({
            type: 'broadcast',
            event: 'ice_candidate',
            payload: { candidate: event.candidate },
          });
        }
      };

      // Acquire local media
      let stream = localStreamRef.current;
      if (!stream) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: callType === 'video',
          });
          localStreamRef.current = stream;
          setLocalStream(stream);
        } catch (mediaErr) {
          console.warn('Microphone/Camera permission error:', mediaErr);
        }
      }

      if (stream) {
        stream.getTracks().forEach(track => {
          pc.addTrack(track, stream!);
        });
      }

      channel
        .on('broadcast', { event: 'webrtc_offer' }, async ({ payload }: any) => {
          if (payload?.sdp) {
            await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            channel.send({
              type: 'broadcast',
              event: 'webrtc_answer',
              payload: { sdp: answer },
            });
          }
        })
        .on('broadcast', { event: 'ice_candidate' }, async ({ payload }: any) => {
          if (payload?.candidate) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
            } catch {}
          }
        })
        .on('broadcast', { event: 'call_ended' }, () => {
          endCall();
        })
        .subscribe();
    } catch (err) {
      console.error('Error establishing WebRTC as callee:', err);
    }
  };

  // 1. Start Call (Caller initiates)
  const startCall = async (partner: Profile, type: 'voice' | 'video', convId?: string) => {
    if (!profile) return;
    const conversationId = convId || activeConversationId || '';
    const isPartnerOnline = partner.id === friendPresence.userId ? friendPresence.online : false;

    // Check offline vs online:
    // If offline: status is strictly 'calling' (no ringing sound)
    // If online: status is 'ringing' and plays outgoing telephone ringtone!
    const initialStatus = isPartnerOnline ? 'ringing' : 'calling';

    if (isPartnerOnline) {
      startOutgoingRing();
    }

    setOutgoingCall({
      partner,
      callType: type,
      conversationId,
      status: initialStatus,
      duration: 0,
    });
    setIsVideoEnabled(type === 'video');
    setIsMuted(false);

    // Pre-acquire local media for fast start
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === 'video',
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
    } catch (e) {
      console.warn('Could not acquire local stream:', e);
    }

    // Broadcast call invitation to partner's notification channel
    const supabase = getSupabaseBrowserClient();
    const partnerChannel = supabase.channel(`user-notifications:${partner.id}`);
    partnerChannel.subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        partnerChannel.send({
          type: 'broadcast',
          event: 'incoming_call',
          payload: {
            caller: profile,
            callType: type,
            conversationId,
            callId: `call_${Date.now()}`,
          },
        });
      }
    });
  };

  // 2. Accept Call (Callee accepts)
  const acceptCall = async () => {
    if (!incomingCall || !profile) return;
    stopAllRingtones();

    const { caller, callType, conversationId, callId } = incomingCall;

    // Switch callee into outgoingCall state with 'connected' status
    setOutgoingCall({
      partner: caller,
      callType,
      conversationId,
      status: 'connected',
      duration: 0,
    });
    setIncomingCall(null);

    // Notify caller that call was accepted
    const supabase = getSupabaseBrowserClient();
    const callerChannel = supabase.channel(`user-notifications:${caller.id}`);
    callerChannel.subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        callerChannel.send({
          type: 'broadcast',
          event: 'call_accepted',
          payload: { conversationId, callId, callType },
        });
      }
    });

    // Callee sets up WebRTC
    await setupWebRTCAsCallee(conversationId, callType);
  };

  // 3. Decline Call
  const declineCall = () => {
    if (!incomingCall) return;
    stopAllRingtones();

    const { caller, conversationId, callId } = incomingCall;
    const supabase = getSupabaseBrowserClient();
    const callerChannel = supabase.channel(`user-notifications:${caller.id}`);
    callerChannel.subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        callerChannel.send({
          type: 'broadcast',
          event: 'call_declined',
          payload: { conversationId, callId },
        });
      }
    });

    setIncomingCall(null);
  };

  // 4. End Call
  const endCall = () => {
    stopAllRingtones();

    if (outgoingCall?.conversationId && callRoomChannelRef.current) {
      try {
        callRoomChannelRef.current.send({
          type: 'broadcast',
          event: 'call_ended',
          payload: { conversationId: outgoingCall.conversationId },
        });
      } catch {}
    } else if (outgoingCall?.partner?.id) {
      try {
        const supabase = getSupabaseBrowserClient();
        const partnerChannel = supabase.channel(`user-notifications:${outgoingCall.partner.id}`);
        partnerChannel.subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            partnerChannel.send({
              type: 'broadcast',
              event: 'call_cancelled',
              payload: {},
            });
          }
        });
      } catch {}
    }

    setOutgoingCall(prev => (prev ? { ...prev, status: 'ended' } : null));
    setTimeout(() => {
      setOutgoingCall(null);
      cleanupMedia();
    }, 600);
  };

  // Controls: Mute
  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(prev => !prev);
    } else {
      setIsMuted(prev => !prev);
    }
  };

  // Controls: Video
  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoEnabled(prev => !prev);
    } else {
      setIsVideoEnabled(prev => !prev);
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
        isMuted,
        isVideoEnabled,
        isSpeakerOn,
        startCall,
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

export const useCall = () => useContext(CallContext);
