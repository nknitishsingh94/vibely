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

export interface OutgoingCallState {
  partner: Profile;
  callType: 'voice' | 'video';
  conversationId: string;
  status: 'calling' | 'ringing' | 'connected' | 'ended' | 'declined' | 'unavailable';
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
  callHistory: CallLogItem[];
  clearCallHistory: () => void;
  deleteCallLog: (id: string) => void;
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
  callHistory: [],
  clearCallHistory: () => {},
  deleteCallLog: () => {},
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
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);

  const pcRef = useRef<RTCPeerConnection | null>(null);
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

    const callId = payload?.callId || payload?.conversationId || '';
    const ts = payload?.timestamp || '';
    const sigKey = `${event}:${callId}:${ts}`;
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

  // Stop media tracks and clear timers helper
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

  // Multi-channel signaling broadcaster
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

  // Setup WebRTC as Caller
  const setupWebRTCAsCaller = async (conversationId: string, callType: 'voice' | 'video') => {
    stopAllRingtones();
    try {
      const supabase = getSupabaseBrowserClient();
      const channel = supabase.channel(`call-room:${conversationId || 'default'}`);
      callRoomChannelRef.current = channel;

      const pc = new RTCPeerConnection(RTC_CONFIG);
      pcRef.current = pc;

      // Handle remote tracks
      pc.ontrack = event => {
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
        }
      };

      // Handle ICE candidates
      pc.onicecandidate = event => {
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

      let offerAttempts = 0;
      const sendOffer = () => {
        channel.send({
          type: 'broadcast',
          event: 'webrtc_offer',
          payload: { sdp: offer },
        });
      };

      channel
        .on('broadcast', { event: 'webrtc_answer' }, async ({ payload }: any) => {
          if (offerRetryTimerRef.current) {
            clearInterval(offerRetryTimerRef.current);
            offerRetryTimerRef.current = null;
          }
          if (payload?.sdp) {
            try {
              if (pc.signalingState !== 'stable') {
                await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
              }
            } catch (err) {
              console.warn('Error setting remote description:', err);
            }
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
            sendOffer();
            if (offerRetryTimerRef.current) clearInterval(offerRetryTimerRef.current);
            offerRetryTimerRef.current = setInterval(() => {
              offerAttempts++;
              if (offerAttempts >= 5 || pc.signalingState === 'stable') {
                if (offerRetryTimerRef.current) {
                  clearInterval(offerRetryTimerRef.current);
                  offerRetryTimerRef.current = null;
                }
                return;
              }
              sendOffer();
            }, 1500);
          }
        });
    } catch (err) {
      console.error('Error establishing WebRTC as caller:', err);
    }
  };

  // Setup WebRTC as Callee
  const setupWebRTCAsCallee = async (conversationId: string, callType: 'voice' | 'video') => {
    stopAllRingtones();
    try {
      const supabase = getSupabaseBrowserClient();
      const channel = supabase.channel(`call-room:${conversationId || 'default'}`);
      callRoomChannelRef.current = channel;

      const pc = new RTCPeerConnection(RTC_CONFIG);
      pcRef.current = pc;

      pc.ontrack = event => {
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
        }
      };

      pc.onicecandidate = event => {
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
            try {
              if (pc.signalingState === 'stable' || pc.signalingState === 'have-local-offer') {
                await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);

                channel.send({
                  type: 'broadcast',
                  event: 'webrtc_answer',
                  payload: { sdp: answer },
                });
              }
            } catch (err) {
              console.warn('Callee offer handling error:', err);
            }
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

  // Listen for incoming call notifications and call signals
  useEffect(() => {
    if (!profile?.id) return;
    const supabase = getSupabaseBrowserClient();

    // 1. Dedicated Call Channel for this user
    const callChannel = supabase.channel(`call-user:${profile.id}`);
    // 2. Notification Channel for this user
    const notifChannel = supabase.channel(`user-notifications:${profile.id}`);

    const handleIncomingCall = (payload: any) => {
      if (!payload || !payload.caller) return;
      if (isDuplicateSignal('incoming_call', payload)) return;

      // Don't accept or ring if already in any active call state
      if (activeCallStatusRef.current !== 'idle') return;
      if (outgoingCallRef.current || incomingCallRef.current) return;

      const callId = payload.callId || `call_${Date.now()}`;
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
      });

      // Start incoming melodic ringtone chime on callee's device!
      startIncomingRing();

      // Send ACK back to caller: "I received the call and my phone is now ringing!"
      sendSignalToUser(
        payload.caller.id,
        'call_ringing',
        {
          callId,
          conversationId: payload.conversationId,
        },
        payload.conversationId
      );
    };

    const handleCallRinging = (payload?: any) => {
      if (isDuplicateSignal('call_ringing', payload)) return;

      // Caller receives confirmation that partner's phone is actually ringing!
      if (callRetryTimerRef.current) {
        clearInterval(callRetryTimerRef.current);
        callRetryTimerRef.current = null;
      }

      // CRITICAL: Only ring if caller is still waiting in 'calling' state!
      // If the call is already connected, ended, or idle, NEVER ring!
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

      // Start outgoing telephone ring tone ONLY when in ringing state
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

      // Stop all ringtones immediately!
      stopAllRingtones();
      activeCallStatusRef.current = 'connected';

      // Update call log status to connected
      if (profile?.id && activeCallIdRef.current) {
        updateCallLog(profile.id, activeCallIdRef.current, {
          status: 'connected',
        });
      }

      setOutgoingCall(prev => (prev ? { ...prev, status: 'connected' } : null));
      await setupWebRTCAsCaller(payload.conversationId, payload.callType || 'voice');
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
      activeCallStatusRef.current = 'ended';

      // Update call log status to declined
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

      // If incoming call was cancelled by caller, it remains missed
      if (profile?.id && activeCallIdRef.current) {
        updateCallLog(profile.id, activeCallIdRef.current, {
          status: 'missed',
          endedAt: new Date().toISOString(),
        });
      }
      activeCallIdRef.current = null;
      setIncomingCall(null);
    };

    // Attach handlers & SUBSCRIBE
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
  }, [profile?.id, sendSignalToUser, cleanupMedia, isDuplicateSignal]);

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

  // 1. Start Call (Caller initiates)
  const startCall = async (partner: Profile, type: 'voice' | 'video', convId?: string) => {
    if (!profile) return;
    stopAllRingtones();
    cleanupMedia();

    const conversationId = convId || activeConversationId || '';
    const callId = `call_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

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

    // Set status to 'calling' initially ("Calling...") - NOT ringing yet!
    setOutgoingCall({
      partner,
      callType: type,
      conversationId,
      status: 'calling',
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

    // Send call invite to partner with periodic retry
    let attempts = 0;
    const sendInvite = () => {
      // Don't send more invites if no longer calling
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
        },
        conversationId
      );

      // Stop retrying after 12 attempts (~18 seconds)
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

      // Send cancellation signal
      sendSignalToUser(partner.id, 'call_cancelled', { callId, conversationId }, conversationId);

      setTimeout(() => {
        setOutgoingCall(null);
        cleanupMedia();
      }, 2500);
    }, 35000);
  };

  // 2. Accept Call (Callee accepts)
  const acceptCall = async () => {
    if (!incomingCall || !profile) return;
    
    // Stop ringing IMMEDIATELY
    stopAllRingtones();
    activeCallStatusRef.current = 'connected';

    const { caller, callType, conversationId, callId } = incomingCall;
    activeCallIdRef.current = callId;

    if (profile?.id) {
      updateCallLog(profile.id, callId, {
        status: 'connected',
      });
    }

    // Switch callee into outgoingCall state with 'connected' status
    setOutgoingCall({
      partner: caller,
      callType,
      conversationId,
      status: 'connected',
      duration: 0,
    });
    setIncomingCall(null);

    // Notify caller that call was accepted across all channels!
    sendSignalToUser(caller.id, 'call_accepted', { conversationId, callId, callType }, conversationId);

    // Callee sets up WebRTC
    await setupWebRTCAsCallee(conversationId, callType);
  };

  // 3. Decline Call
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
    const { caller, conversationId, callId } = incomingCall;

    // Notify caller that call was declined
    sendSignalToUser(caller.id, 'call_declined', { conversationId, callId }, conversationId);

    setIncomingCall(null);
    cleanupMedia();
  };

  // 4. End Call
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
    if (currentCall?.partner?.id) {
      sendSignalToUser(
        currentCall.partner.id,
        currentCall.status === 'connected' ? 'call_ended' : 'call_cancelled',
        { conversationId: currentCall.conversationId },
        currentCall.conversationId
      );
    }

    if (callRoomChannelRef.current) {
      try {
        callRoomChannelRef.current.send({
          type: 'broadcast',
          event: 'call_ended',
          payload: { conversationId: currentCall?.conversationId },
        });
      } catch {}
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
        callHistory,
        clearCallHistory,
        deleteCallLog,
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

export function useCall() {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
}
