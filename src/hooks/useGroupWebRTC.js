import { useEffect, useRef, useState, useCallback } from 'react';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

/**
 * useGroupWebRTC — Manages multiple WebRTC PeerConnections for group calls (Mesh).
 * 
 * @param {object} params
 * @param {MediaStream|null} params.localStream
 * @param {string}           params.groupId
 * @param {object}           params.currentUser
 * @param {object}           params.activeGroupCall - From AppContext state
 */
export function useGroupWebRTC({ localStream, groupId, currentUser, activeGroupCall }) {
  const [participants, setParticipants] = useState({}); // userId -> { stream, videoState, audioEnabled, isSpeaking }
  const pcsRef = useRef({}); // userId -> RTCPeerConnection
  const processedSignals = useRef(new Set());

  const sendSignal = useCallback((toId, payload) => {
    if (!currentUser?.id || !toId) return;

    const signal = {
      ...payload,
      id: `gsig_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      from: currentUser.id,
      to: toId,
      groupId,
      timestamp: Date.now(),
    };

    try {
      const queueKey = 'garage_signal_queue';
      const existingQueue = JSON.parse(localStorage.getItem(queueKey) || '[]');
      localStorage.setItem(queueKey, JSON.stringify([...existingQueue, signal].slice(-50)));
      localStorage.setItem('garage_webrtc_signal', JSON.stringify(signal));
    } catch (e) {
      console.error("[GroupWebRTC] Signaling failed", e);
    }
  }, [currentUser?.id, groupId]);

  const createPC = useCallback((targetId, isOffer) => {
    if (pcsRef.current[targetId]) {
      pcsRef.current[targetId].close();
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcsRef.current[targetId] = pc;

    if (localStream) {
      localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal(targetId, {
          signalType: 'WEBRTC_ICE',
          candidate: event.candidate.toJSON(),
        });
      }
    };

    pc.ontrack = (event) => {
      const remote = event.streams[0] || new MediaStream([event.track]);
      setParticipants(prev => ({
        ...prev,
        [targetId]: {
          ...prev[targetId],
          stream: new MediaStream(remote.getTracks()),
          videoState: remote.getVideoTracks().length > 0 ? 'live' : 'camera-off'
        }
      }));

      if (event.track.kind === 'audio') {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioCtx.createMediaStreamSource(new MediaStream([event.track]));
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const checkSpeaking = () => {
          if (!pcsRef.current[targetId]) return;
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
          const average = sum / bufferLength;

          setParticipants(prev => {
            const isSpeaking = average > 40; // Sensitivity threshold
            if (prev[targetId]?.isSpeaking === isSpeaking) return prev;
            return {
              ...prev,
              [targetId]: { ...prev[targetId], isSpeaking }
            };
          });
          requestAnimationFrame(checkSpeaking);
        };
        checkSpeaking();
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        console.warn(`[GroupWebRTC] Connection to ${targetId} failed`);
      }
    };

    return pc;
  }, [localStream, sendSignal]);

  const initiateOffer = useCallback(async (targetId) => {
    const pc = createPC(targetId, true);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    sendSignal(targetId, { signalType: 'WEBRTC_OFFER', sdp: offer });
  }, [createPC, sendSignal]);

  const handleOffer = useCallback(async (fromId, sdp) => {
    const pc = createPC(fromId, false);
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    sendSignal(fromId, { signalType: 'WEBRTC_ANSWER', sdp: answer });
  }, [createPC, sendSignal]);

  const handleAnswer = useCallback(async (fromId, sdp) => {
    const pc = pcsRef.current[fromId];
    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    }
  }, []);

  const handleIce = useCallback(async (fromId, candidate) => {
    const pc = pcsRef.current[fromId];
    if (pc) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.warn);
    }
  }, []);

  // Listen for signals
  useEffect(() => {
    if (!currentUser?.id || !groupId) return;

    const handleSignal = async (signal) => {
      if (processedSignals.current.has(signal.id)) return;
      if (String(signal.to) !== String(currentUser.id)) return;
      if (signal.groupId !== groupId) return;

      processedSignals.current.add(signal.id);

      if (signal.signalType === 'WEBRTC_OFFER') {
        await handleOffer(signal.from, signal.sdp);
      } else if (signal.signalType === 'WEBRTC_ANSWER') {
        await handleAnswer(signal.from, signal.sdp);
      } else if (signal.signalType === 'WEBRTC_ICE') {
        await handleIce(signal.from, signal.candidate);
      }
    };

    const handleStorageChange = (e) => {
      if (e.key === 'garage_signal_queue' || e.key === 'garage_webrtc_signal') {
        try {
          const queue = JSON.parse(localStorage.getItem('garage_signal_queue') || '[]');
          queue.forEach(handleSignal);
        } catch (e) { }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [currentUser?.id, groupId, handleOffer, handleAnswer, handleIce]);

  // Handle participant changes from AppContext
  useEffect(() => {
    if (!activeGroupCall?.participants) return;

    activeGroupCall.participants.forEach(pid => {
      if (String(pid) === String(currentUser.id)) return;
      if (!pcsRef.current[pid]) {
        // Someone new joined, if I'm already in, I might wait for them or initiate
        // Conventional Mesh: Usually, the newcomer initiates or the existing ones do.
        // Let's have the existing ones initiate to the newcomer.
        // Or simpler: The peer with the higher ID initiates.
        if (String(currentUser.id) > String(pid)) {
          initiateOffer(pid);
        }
      }
    });

    // Cleanup stale participants
    Object.keys(pcsRef.current).forEach(pid => {
      if (!activeGroupCall.participants.includes(pid)) {
        pcsRef.current[pid].close();
        delete pcsRef.current[pid];
        setParticipants(prev => {
          const next = { ...prev };
          delete next[pid];
          return next;
        });
      }
    });
  }, [activeGroupCall?.participants, currentUser?.id, initiateOffer]);

  // Clean up all on unmount
  useEffect(() => {
    return () => {
      Object.values(pcsRef.current).forEach(pc => pc.close());
      pcsRef.current = {};
    };
  }, []);

  return { participants };
}
