/**
 * useWebRTC — Manages a single WebRTC PeerConnection for voice/video calls.
 *
 * Signaling is sent over real-time WebSocket server with fallback to BroadcastChannel and localStorage.
 */

import { useEffect, useRef, useState, useCallback } from 'react';

// Signaling Channel names
const BC_NAME = 'garage_call_signals';
const bc = new BroadcastChannel(BC_NAME);

// Free STUN servers (Google & Mozilla) — no auth needed
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.services.mozilla.com' },
  ],
};

/**
 * @param {object} params
 * @param {MediaStream|null} params.localStream  – Already-acquired local camera/mic stream
 * @param {string|null}      params.callState    – 'calling' | 'incoming' | 'connected' | 'idle'
 * @param {object|null}      params.activeCall   – { contact, isOutgoing, type, ... }
 * @param {object|null}      params.currentUser  – { id, ... }
 * @param {function}         [params.sendCallWS] – Real-time WebSocket sender helper
 */
export function useWebRTC({ localStream, callState, activeCall, currentUser, sendCallWS }) {
  const pcRef = useRef(null);                       // RTCPeerConnection
  const pendingCandidates = useRef([]);             // ICE candidates queued before remote SDP set
  const remoteStreamRef = useRef(new MediaStream()); // Persistent stable stream object
  const [remoteStream, setRemoteStream] = useState(remoteStreamRef.current);
  const [videoState, setVideoState] = useState('idle'); // idle | connecting | waiting | live | camera-off
  const [connectionQuality, setConnectionQuality] = useState('good'); // good | fair | poor
  const [isReconnecting, setIsReconnecting] = useState(false);
  const statsInterval = useRef(null);
  const retryCount = useRef(0);
  const MAX_RETRIES = 3;

  // Track remote media states (mic/cam)
  const [remoteMediaState, setRemoteMediaState] = useState({
    audio: true,
    video: true
  });

  // ── Helper: send a signal via WebSocket + BroadcastChannel + localStorage Queue ────
  const sendSignal = useCallback((payload) => {
    if (!currentUser?.id || !activeCall?.contact?.id) return;

    const signal = {
      ...payload,
      id: `sig_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      from: currentUser.id,
      to: activeCall.contact.id,
      timestamp: Date.now(),
    };

    try {
      // 1. Send via WebSocket if available
      let sentWS = false;
      if (typeof sendCallWS === 'function') {
        const typeMap = {
          'WEBRTC_OFFER': 'call_webrtc_offer',
          'WEBRTC_ANSWER': 'call_webrtc_answer',
          'WEBRTC_ICE': 'call_webrtc_ice',
          'WEBRTC_MEDIA_STATE': 'call_webrtc_media_state'
        };
        const wsType = typeMap[payload.signalType] || payload.signalType;
        sentWS = sendCallWS({ ...signal, type: wsType });
      }

      // 2. Send via BroadcastChannel (Near-instant for same machine)
      bc.postMessage(signal);

      // 3. Persist to localStorage (Legacy/Cross-tab fallback)
      const queueKey = 'garage_signal_queue';
      const existingQueue = JSON.parse(localStorage.getItem(queueKey) || '[]');
      const newQueue = [...existingQueue, signal].slice(-20);
      localStorage.setItem(queueKey, JSON.stringify(newQueue));
      localStorage.setItem('garage_webrtc_signal', JSON.stringify(signal));
    } catch (e) {
      console.error("[WebRTC] Signaling failed", e);
    }
  }, [currentUser?.id, activeCall?.contact?.id, sendCallWS]);

  // Perfect Negotiation State
  const makingOffer = useRef(false);
  const ignoreOffer = useRef(false);
  const isSettingRemoteDescription = useRef(false);
  const isPolite = !activeCall?.isOutgoing; // Receiver is polite, Caller is impolite

  // ── Create PeerConnection (Singleton pattern for a given call) ─────────────
  const createPC = useCallback(() => {
    // If PC already exists and isn't closed, we reuse it
    if (pcRef.current && pcRef.current.signalingState !== 'closed') {
      console.log('[WebRTC] Reusing existing PeerConnection');
      return pcRef.current;
    }

    console.log('[WebRTC] Creating new RTCPeerConnection');
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;

    // Remote track received → attach to state stream
    pc.ontrack = (event) => {
      console.log('[WebRTC] Track received:', event.track.kind);
      
      const stream = remoteStreamRef.current;
      // Remove old track of same kind if exists to prevent duplicates
      stream.getTracks()
        .filter(t => t.kind === event.track.kind)
        .forEach(t => stream.removeTrack(t));
      
      stream.addTrack(event.track);
      
      // Return a new MediaStream instance to trigger react bindings
      setRemoteStream(new MediaStream(stream.getTracks()));

      const hasVideo = event.track.kind === 'video' || (pcRef.current?.getReceivers().some(r => r.track?.kind === 'video'));
      if (hasVideo) setVideoState('live');

      // Monitor track lifecycle
      event.track.onmute = () => {
        console.log(`[WebRTC] Track muted: ${event.track.kind}`);
        if (event.track.kind === 'video') setVideoState('camera-off');
      };
      event.track.onunmute = () => {
        console.log(`[WebRTC] Track unmuted: ${event.track.kind}`);
        if (event.track.kind === 'video') setVideoState('live');
      };
    };

    // ICE candidates → signal to other peer
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('[WebRTC] Local ICE Candidate generated');
        sendSignal({
          signalType: 'WEBRTC_ICE',
          candidate: event.candidate.toJSON(),
        });
      }
    };

    pc.onnegotiationneeded = () => {
      console.log('[WebRTC] Negotiation needed triggered');
      negotiate();
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log('[WebRTC] Connection state:', state);
      if (state === 'connecting') setVideoState('connecting');
      if (state === 'connected') {
        setIsReconnecting(false);
        retryCount.current = 0;
        // Check for tracks immediately on connect
        const receivers = pc.getReceivers();
        const hasVideo = receivers.some(r => r.track?.kind === 'video' && !r.track.muted);
        setVideoState(hasVideo ? 'live' : 'waiting');
        startStatsMonitor(pc);
      }

      if (state === 'failed' || state === 'disconnected') {
        if (state === 'failed') {
          console.warn('[WebRTC] Connection failed, attempting ICE Restart...');
          try { 
            pc.restartIce();
          } catch (e) { 
            handleConnectionFailure(); 
          }
        } else {
          handleConnectionFailure();
        }
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE state:', pc.iceConnectionState);
    };

    // Eagerly add existing tracks if localStream is already available
    if (localStream) {
      console.log('[WebRTC] Eagerly adding tracks from localStream');
      localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
    }

    return pc;
  }, [sendSignal, localStream]);

  // ── Create and send an offer (used for initial call and mid-call negotiation)
  const negotiate = useCallback(async () => {
    const pc = pcRef.current || createPC();
    if (pc.signalingState !== 'stable') return;

    try {
      makingOffer.current = true;
      console.log('[WebRTC] Creating OFFER');
      setVideoState('connecting');

      // Attach local tracks before creating offer
      if (localStream) {
        const currentSenders = pc.getSenders();
        localStream.getTracks().forEach(track => {
          track.enabled = true;
          const alreadyAdded = currentSenders.find(s => s.track && s.track.kind === track.kind);
          if (!alreadyAdded) {
            console.log(`[WebRTC] Adding local track before offer: ${track.kind}`);
            pc.addTrack(track, localStream);
          } else if (alreadyAdded.track !== track) {
            alreadyAdded.replaceTrack(track);
          }
        });
      }

      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: activeCall?.type === 'video',
      });
      await pc.setLocalDescription(offer);

      sendSignal({
        signalType: 'WEBRTC_OFFER',
        sdp: pc.localDescription,
      });
    } catch (e) {
      console.error('[WebRTC] Negotiation failed', e);
    } finally {
      makingOffer.current = false;
    }
  }, [createPC, sendSignal, activeCall?.type, localStream]);

  const startCall = negotiate;

  const handleOffer = useCallback(async (offerSdp) => {
    const pc = pcRef.current || createPC();
    
    try {
      const offerCollision = makingOffer.current || pc.signalingState !== 'stable';
      ignoreOffer.current = !isPolite && offerCollision;

      if (ignoreOffer.current) {
        console.warn('[WebRTC] Ignoring offer due to collision (Impolite peer)');
        return;
      }

      if (offerCollision && isPolite) {
        console.log('[WebRTC] Offer collision detected on polite peer. Rolling back...');
        await pc.setLocalDescription({ type: 'rollback' }).catch(() => {});
      }

      isSettingRemoteDescription.current = true;
      await pc.setRemoteDescription(new RTCSessionDescription(offerSdp));
      isSettingRemoteDescription.current = false;

      // Apply queued candidates
      for (const c of pendingCandidates.current) {
        await pc.addIceCandidate(new RTCIceCandidate(c)).catch(e => { });
      }
      pendingCandidates.current = [];

      // Add/replace local tracks prior to creating answer
      if (localStream) {
        const currentSenders = pc.getSenders();
        localStream.getTracks().forEach(track => {
          track.enabled = true;
          const alreadyAdded = currentSenders.find(s => s.track && s.track.kind === track.kind);
          if (!alreadyAdded) {
            console.log(`[WebRTC] Adding local track before answer: ${track.kind}`);
            pc.addTrack(track, localStream);
          } else if (alreadyAdded.track !== track) {
            alreadyAdded.replaceTrack(track);
          }
        });
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      sendSignal({
        signalType: 'WEBRTC_ANSWER',
        sdp: pc.localDescription,
      });
      console.log('[WebRTC] Sent ANSWER');
    } catch (e) {
      console.error('[WebRTC] Error handling offer:', e);
    } finally {
      isSettingRemoteDescription.current = false;
    }
  }, [createPC, sendSignal, isPolite, localStream]);

  const handleAnswer = useCallback(async (answerSdp) => {
    const pc = pcRef.current;
    if (!pc) return;
    try {
      isSettingRemoteDescription.current = true;
      await pc.setRemoteDescription(new RTCSessionDescription(answerSdp));
      isSettingRemoteDescription.current = false;
      
      // Apply queued candidates
      for (const c of pendingCandidates.current) {
        await pc.addIceCandidate(new RTCIceCandidate(c)).catch(e => { });
      }
      pendingCandidates.current = [];
      console.log('[WebRTC] Answer applied');
    } catch (e) {
      console.error('[WebRTC] Failed to set remote answer:', e);
    } finally {
      isSettingRemoteDescription.current = false;
    }
  }, []);

  const handleIceCandidate = useCallback(async (candidate) => {
    const pc = pcRef.current;
    try {
      if (pc && pc.remoteDescription) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => { });
      } else {
        pendingCandidates.current.push(candidate);
      }
    } catch (e) {
      if (!ignoreOffer.current) console.error('[WebRTC] ICE candidate error:', e);
    }
  }, []);

  // ── Media State Signaling ──────────────────────────────────────────────
  const sendMediaState = useCallback((states) => {
    sendSignal({
      signalType: 'WEBRTC_MEDIA_STATE',
      mediaStates: states
    });
  }, [sendSignal]);

  // ── Connection Helpers ───────────────────────────────────────────────────
  const startStatsMonitor = (pc) => {
    if (statsInterval.current) clearInterval(statsInterval.current);
    statsInterval.current = setInterval(async () => {
      if (!pc || pc.connectionState !== 'connected') return;
      try {
        const stats = await pc.getStats();
        stats.forEach(report => {
          if (report.type === 'inbound-rtp' && report.kind === 'audio') {
            if (report.jitter > 0.1) setConnectionQuality('poor');
            else if (report.jitter > 0.05) setConnectionQuality('fair');
            else setConnectionQuality('good');
          }
        });
      } catch (e) { }
    }, 5000);
  };

  const handleConnectionFailure = useCallback(() => {
    if (retryCount.current < MAX_RETRIES) {
      retryCount.current += 1;
      setIsReconnecting(true);
      console.log(`[WebRTC] Connection failed, retrying (${retryCount.current}/${MAX_RETRIES})...`);
      setTimeout(() => {
        if (activeCall && callState === 'connected') {
          startCall();
        }
      }, 3000);
    } else {
      setIsReconnecting(false);
      console.error('[WebRTC] Max retries reached, connection failed.');
    }
  }, [activeCall, callState, startCall]);

  // ── Cleanup ────────────────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (statsInterval.current) {
      clearInterval(statsInterval.current);
      statsInterval.current = null;
    }
    
    // Clear out the persistent stream
    const stream = remoteStreamRef.current;
    stream.getTracks().forEach(t => {
      t.stop();
      stream.removeTrack(t);
    });

    setRemoteStream(new MediaStream()); 
    setVideoState('idle');
    setConnectionQuality('good');
    setIsReconnecting(false);
    pendingCandidates.current = [];
    retryCount.current = 0;
  }, []);

  const processedSignals = useRef(new Set());

  useEffect(() => {
    if (!currentUser?.id || !activeCall) return;

    const handleIncomingSignal = (signal) => {
      // 1. Deduplication & Target check
      if (processedSignals.current.has(signal.id)) return;
      if (String(signal.to) !== String(currentUser.id)) return;

      const sigType = signal.signalType || (signal.type === 'call_webrtc_offer' ? 'WEBRTC_OFFER' :
                     (signal.type === 'call_webrtc_answer' ? 'WEBRTC_ANSWER' :
                     (signal.type === 'call_webrtc_ice' ? 'WEBRTC_ICE' :
                     (signal.type === 'call_webrtc_media_state' ? 'WEBRTC_MEDIA_STATE' : null))));

      // Filter types relevant to WebRTC negotiation
      const isWebRTC = ['WEBRTC_OFFER', 'WEBRTC_ANSWER', 'WEBRTC_ICE', 'WEBRTC_MEDIA_STATE'].includes(sigType);
      if (!isWebRTC) return;

      // Ignore signals older than 30 seconds
      const now = Date.now();
      if (signal.timestamp && (now - signal.timestamp > 30000)) {
        processedSignals.current.add(signal.id);
        return;
      }

      processedSignals.current.add(signal.id);
      console.log('[WebRTC] Signal Received:', sigType);

      if (sigType === 'WEBRTC_OFFER') {
        handleOffer(signal.sdp);
      } else if (sigType === 'WEBRTC_ANSWER') {
        handleAnswer(signal.sdp);
      } else if (sigType === 'WEBRTC_ICE') {
        handleIceCandidate(signal.candidate);
      } else if (sigType === 'WEBRTC_MEDIA_STATE') {
        console.log('[WebRTC] Remote media state changed:', signal.mediaStates);
        if (signal.mediaStates) {
          setRemoteMediaState(signal.mediaStates);
          if (signal.mediaStates.video === false) {
            setVideoState('camera-off');
          } else {
            const hasVideo = pcRef.current?.getReceivers().some(r => r.track?.kind === 'video' && !r.track.muted);
            if (hasVideo) setVideoState('live');
          }
        }
      }
    };

    // 1. Listen on BroadcastChannel
    bc.onmessage = (event) => handleIncomingSignal(event.data);

    // 2. Listen for custom window event dispatched by AppContext WS handler
    const handleWSEvent = (e) => {
      if (e.detail) handleIncomingSignal(e.detail);
    };
    window.addEventListener('garage:webrtc_signal', handleWSEvent);

    // 3. Also poll localStorage for cross-tab robustness
    const pollSignalQueue = () => {
      try {
        const queueJSON = localStorage.getItem('garage_signal_queue');
        if (!queueJSON) return;
        const queue = JSON.parse(queueJSON);
        queue.forEach(handleIncomingSignal);
      } catch (e) { }
    };

    const handleStorageChange = (e) => {
      if (e.key === 'garage_signal_queue' || e.key === 'garage_webrtc_signal') {
        pollSignalQueue();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    pollSignalQueue();

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('garage:webrtc_signal', handleWSEvent);
    };
  }, [currentUser?.id, activeCall, handleOffer, handleAnswer, handleIceCandidate]);

  // ── Trigger WebRTC offer ──────────────────────────────────────────────────
  useEffect(() => {
    const isReady = (callState === 'calling' || callState === 'connected') &&
      activeCall?.isOutgoing &&
      localStream &&
      !pcRef.current;

    if (isReady) {
      if (activeCall.type === 'video' && localStream.getVideoTracks().length === 0) return;
      startCall();
    }
  }, [callState, activeCall, localStream, startCall]);

  // ── Dynamic Track Management ──────────────────────────────────────────────
  useEffect(() => {
    const pc = pcRef.current;
    if (!pc || !localStream) return;

    let addedNew = false;
    const currentSenders = pc.getSenders();
    localStream.getTracks().forEach(track => {
      track.enabled = true;
      const alreadyAdded = currentSenders.find(s => s.track && s.track.kind === track.kind);
      if (!alreadyAdded) {
        console.log(`[WebRTC] Dynamic addTrack: ${track.kind}`);
        pc.addTrack(track, localStream);
        addedNew = true;
      } else if (alreadyAdded.track.id !== track.id) {
        console.log(`[WebRTC] Dynamic replaceTrack: ${track.kind}`);
        alreadyAdded.replaceTrack(track);
      }
    });

    if (addedNew && pc.signalingState === 'stable') {
      console.log('[WebRTC] Newly added track requires re-negotiation. Triggering offer...');
      negotiate();
    }
  }, [localStream, callState, negotiate]);

  // ── Cleanup when call ends ─────────────────────────────────────────────────
  useEffect(() => {
    if (callState === 'idle') {
      cleanup();
    }
  }, [callState, cleanup]);

  return { remoteStream, videoState, connectionQuality, isReconnecting, remoteMediaState, sendMediaState };
}
