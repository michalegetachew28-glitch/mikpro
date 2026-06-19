import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Phone, PhoneOff, Mic, MicOff, User, X, Volume2,
  Maximize, Minimize, Users, UserPlus, Signal, RefreshCw,
  Settings, Lock, Wifi, WifiOff, Plus, Video, VideoOff
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';
import { useWebRTC } from '../hooks/useWebRTC';
import GroupCallOverlay from './GroupCallOverlay';
import './CallOverlay.css';

const CallOverlay = () => {
  const { callState, activeCall, callSubStatus, acceptCall, endCall } = useAppContext();
  const { currentUser } = useAuth();

  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isControlsVisible, setIsControlsVisible] = useState(true);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [pipPosition, setPipPosition] = useState({ x: 0, y: 0 });
  const [isDraggingPip, setIsDraggingPip] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [participants, setParticipants] = useState([]); // Array of participant objects
  const [needsInteraction, setNeedsInteraction] = useState(false);

  const [localStream, setLocalStream] = useState(null);
  const localVideoRef = useRef(null);
  const localVideoFullRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const controlsTimer = useRef(null);

  // ── WebRTC peer connection ─────────────────────────────────────────────────
  const { remoteStream, videoState, remoteMediaState, sendMediaState } = useWebRTC({
    localStream,
    callState,
    activeCall,
    currentUser,
  });

  // Attach streams to video/audio elements with track-aware stability
  useEffect(() => {
    const attachStream = async (stream, element) => {
      if (!stream || !element) return;
      
      // Compare tracks to see if we actually need a re-attach
      const currentTracksIds = (element.srcObject?.getTracks() || [])
        .map(t => t.id).sort().join(',');
      const newTracksIds = stream.getTracks()
        .map(t => t.id).sort().join(',');

      // If tracks are the same, don't re-attach srcObject (prevents flickering)
      // BUT always try to call play() in case it was suspended
      if (element.srcObject && currentTracksIds === newTracksIds) {
        try { 
          await element.play(); 
          console.log(`[CallOverlay] <${element.tagName}> playback confirmed`);
        } catch(e) {
          console.warn(`[CallOverlay] <${element.tagName}> play() failed on re-check`, e);
          setNeedsInteraction(true);
        }
        return;
      }

      console.log(`[CallOverlay] New tracks detected. Attaching to <${element.tagName}>...`);
      element.srcObject = stream;
      
      try {
        await element.play();
        console.log(`[CallOverlay] <${element.tagName}> started successfully`);
        setNeedsInteraction(false);
      } catch (e) {
        console.warn(`[CallOverlay] ${element.tagName} play() failed initial attempt:`, e);
        setNeedsInteraction(true);
      }
    };

    if (remoteStream) {
      attachStream(remoteStream, remoteVideoRef.current);
      attachStream(remoteStream, remoteAudioRef.current);
    }
  }, [remoteStream]);

  useEffect(() => {
    if (localStream) {
      if (localVideoRef.current) localVideoRef.current.srcObject = localStream;
      if (localVideoFullRef.current) localVideoFullRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Auto-hide controls during video calls
  const resetControlsTimer = useCallback(() => {
    setIsControlsVisible(true);
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    if (callState === 'connected') {
      controlsTimer.current = setTimeout(() => {
        setIsControlsVisible(false);
      }, 5000);
    }
  }, [callState]);

  useEffect(() => {
    resetControlsTimer();
    return () => {
      if (controlsTimer.current) clearTimeout(controlsTimer.current);
    };
  }, [resetControlsTimer]);

  // ── PiP Dragging Logic ───────────────────────────────────────────────────
  const handlePipMouseDown = (e) => {
    setIsDraggingPip(true);
    setDragStart({
      x: e.clientX - pipPosition.x,
      y: e.clientY - pipPosition.y,
    });
  };

  const handleGlobalMouseMove = useCallback((e) => {
    if (!isDraggingPip) return;
    setPipPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  }, [isDraggingPip, dragStart]);

  const handleGlobalMouseUp = useCallback(() => {
    setIsDraggingPip(false);
  }, []);

  useEffect(() => {
    if (isDraggingPip) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
    } else {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDraggingPip, handleGlobalMouseMove, handleGlobalMouseUp]);


  // Duration timer
  useEffect(() => {
    let interval;
    if (callState === 'connected') {
      interval = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    } else {
      setDuration(0);
    }
    return () => clearInterval(interval);
  }, [callState]);

  // Media stream management
  useEffect(() => {
    let currentStream = null;
    const startStreaming = async () => {
      const shouldStream =
        callState === 'connected' ||
        callState === 'calling' ||
        callState === 'incoming';

      if (shouldStream && !localStream) { // Only start if not already started
        try {
          console.log('[CallOverlay] Acquiring local media...');
          const constraints = {
            video: activeCall.type === 'video',
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
          };

          currentStream = await navigator.mediaDevices.getUserMedia(constraints);
          setLocalStream(currentStream);
        } catch (err) {
          console.error('Media access failed:', err);
        }
      }
    };
    startStreaming();
    
    return () => {
      // Only cleanup if we are going to idle
      if (callState === 'idle' && currentStream) {
        currentStream.getTracks().forEach(t => t.stop());
        setLocalStream(null);
      }
    };
  }, [callState]); // Remote activeCall from deps to prevent restart on meta changes

  useEffect(() => {
    if (localStream) {
      const audioActive = !isMuted;
      const videoActive = !isCameraOff;

      localStream.getAudioTracks().forEach(t => {
        t.enabled = audioActive;
      });
      localStream.getVideoTracks().forEach(t => {
        t.enabled = videoActive;
      });

      // Signal the new state to the remote peer
      if (callState === 'connected') {
        sendMediaState({ audio: audioActive, video: videoActive });
      }
    }
  }, [isMuted, isCameraOff, localStream, callState, sendMediaState]);



  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const rs = s % 60;
    return `${m}:${rs < 10 ? '0' : ''}${rs}`;
  };

  if (!currentUser || !activeCall || callState === 'idle') return null;

  const isConnected = callState === 'connected';
  const isIncoming = callState === 'incoming';
  const isVideo = activeCall?.type === 'video';

  if (activeCall?.groupId && isConnected) {
    return <GroupCallOverlay groupId={activeCall.groupId} />;
  }

  // Specific render for Receiver Side (Incoming Call Page)
  if (isIncoming) {
    return (
      <div className={`flagship-call-overlay incoming-receiver ${isVideo ? 'video-mode' : 'voice-mode'}`}>
        <div className="fco-background">
          <div className="fco-glass-bg">
            <div className="fco-blob blob-1" />
            <div className="fco-blob blob-2" />
            <div className="fco-bg-image-blur" style={{ backgroundImage: `url(${activeCall.contact?.profilePic})` }} />
          </div>
        </div>

        <div className="fco-incoming-overlay clean-receiver">
          <div className="incoming-card">
            <div className="fco-avatar-ring large">
              <div className="ring ring-1" />
              <div className="ring ring-2" />
              <div className="avatar-box">
                {activeCall.contact?.profilePic ? (
                  <img src={activeCall.contact.profilePic} alt="" />
                ) : (
                  <div className="avatar-placeholder">{(activeCall.contact?.name || '?').charAt(0)}</div>
                )}
              </div>
            </div>
            <h1 className="fco-user-name">{activeCall.contact?.name}</h1>
            <p className="fco-incoming-label">Incoming Call...</p>
            <div className="fco-incoming-actions">
              <button className="ctrl-btn decline" onClick={() => endCall('declined')} title="Decline"><PhoneOff size={28} /></button>
              <button className="ctrl-btn accept pulse-green" onClick={acceptCall} title="Answer">
                {isVideo ? <Video size={28} /> : <Phone size={28} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flagship-call-overlay ${callState} ${isVideo ? 'video-mode' : 'voice-mode'} ${isFullscreen ? 'fullscreen' : ''} ${isMinimized ? 'minimized' : ''}`}>

      {/* Background Layer */}
      <div className="fco-background">
        {/* Always show glass/blur background as the base layer */}
        <div className="fco-glass-bg">
          <div className="fco-blob blob-1" />
          <div className="fco-blob blob-2" />
          {activeCall.contact?.profilePic ? (
            <div className="fco-bg-image-blur" style={{ backgroundImage: `url(${activeCall.contact.profilePic})` }} />
          ) : (
            <div className="fco-bg-image-blur dark" />
          )}
        </div>

        {isVideo && (
          <div className="fco-video-container">
            {/* Remote video - Main View */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className={`remote-view ${videoState === 'live' ? 'show' : 'fade'}`}
              style={{ 
                opacity: videoState === 'live' ? 1 : 0,
                transition: 'opacity 0.5s ease-in-out'
              }}
            />

            {/* Status Overlays over video area */}
            <div className={`fco-video-status-overlay ${videoState !== 'live' ? 'visible' : 'hidden'}`}>
              {videoState === 'connecting' && (
                <>
                  <RefreshCw size={48} className="spin-anim" />
                  <span className="fco-video-status-label">Connecting...</span>
                </>
              )}
              {isConnected && videoState === 'waiting' && (
                <>
                  <User size={48} />
                  <span className="fco-video-status-label">Waiting for remote video...</span>
                </>
              )}
              {isConnected && videoState === 'camera-off' && (
                <>
                  <VideoOff size={48} />
                  <span className="fco-video-status-label">Remote camera is off</span>
                </>
              )}
              {isConnected && needsInteraction && (
                <button className="fco-interaction-overlay-btn" onClick={() => {
                  setNeedsInteraction(false);
                  remoteVideoRef.current?.play();
                  remoteAudioRef.current?.play();
                }}>
                  <Volume2 size={24} />
                  <span>Click to enable sound/video</span>
                </button>
              )}
            </div>

            {/* Self-preview during outgoing phase - Fullscreen mirror */}
            {!isConnected && (
              <video ref={localVideoFullRef} autoPlay playsInline muted className="remote-view local-view-mirror outgoing-preview" />
            )}

            <div className="fco-video-overlay" />
          </div>
        )}
      </div>

      {/* Call UI Content */}
      <div className="fco-main" onMouseMove={resetControlsTimer}>
        {/* Header - shown only when connected or calling */}
        <div className="fco-header">
          <div className="fco-enc-badge">
            <Lock size={14} />
            <span>End-to-End Encrypted</span>
          </div>
          <div className="fco-call-info">
            <Signal size={16} className="quality-icon" />
            <span className="duration">
              {isConnected ? formatTime(duration) : (
                callSubStatus === 'ringing' ? 'Ringing...' :
                  callSubStatus === 'delivered' ? 'Delivered' : 'Calling...'
              )}
            </span>
          </div>
          <button className="fco-mini-btn" onClick={() => setIsMinimized(!isMinimized)} title={isMinimized ? 'Maximize' : 'Minimize'}>
            {isMinimized ? <Maximize size={20} /> : <Minimize size={20} />}
          </button>
        </div>

        {/* Center - Participants Area */}
        <div className="fco-center-wrap">
          {isVideo ? (
            <div className="fco-video-ui-wrap">
              {!isConnected && (
                <div className="fco-video-connecting-status">
                  <h1 className="fco-user-name">{activeCall.contact?.name}</h1>
                  <p className="fco-status-badge">Connecting Video...</p>
                </div>
              )}

              {/* Small Local Preview Window (Draggable) */}
              <div
                className={`fco-local-preview-mini ${isDraggingPip ? 'dragging' : ''}`}
                onMouseDown={handlePipMouseDown}
                style={{
                  transform: `translate(${pipPosition.x}px, ${pipPosition.y}px)`,
                  cursor: isDraggingPip ? 'grabbing' : 'grab'
                }}
              >
                <video ref={localVideoRef} autoPlay playsInline muted className="local-view-mirror" />
                <span className="preview-label">You</span>
              </div>
            </div>
          ) : (
            <div className="fco-voice-content">
              <div className="fco-participants-grid">
                {/* Main Participant */}
                <div className="fco-participant-item active-speaker">
                  <div className="fco-avatar-ring">
                    <div className="ring ring-1" />
                    <div className="ring ring-2" />
                    <div className="avatar-box">
                      {activeCall.contact?.profilePic ? (
                        <img src={activeCall.contact.profilePic} alt="" />
                      ) : (
                        <div className="avatar-placeholder">{(activeCall.contact?.name || '?').charAt(0)}</div>
                      )}
                    </div>
                  </div>
                  {localStream && localStream.getAudioTracks().length === 0 && (
                    <div className="perm-warning">
                      <MicOff size={14} /> <span>Microphone not detected or blocked</span>
                    </div>
                  )}
                  <p className="fco-status-badge">
                    {isConnected ? (
                      <>
                        Connected {remoteMediaState.audio === false && <span className="muted-notif"> (Muted)</span>}
                      </>
                    ) : (
                      callSubStatus === 'ringing' ? 'Ringing...' :
                        callSubStatus === 'delivered' ? 'Delivered' : 'Connecting...'
                    )}
                  </p>
                </div>
              </div>

              {isConnected && (
                <div className="fco-waveform-wrap">
                  {[1, 2, 3, 4, 5, 2, 1, 3, 5, 2].map((h, i) => (
                    <div key={i} className="wave-bar" style={{ height: `${h * 8}px`, animationDelay: `${i * 0.1}s` }} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className={`fco-controls-wrapper ${!isControlsVisible && isConnected ? 'hide' : ''}`}>
          <div className="fco-control-bar">
            <div className="fco-actions-secondary">
              <button className={`ctrl-btn-round ${isMuted ? 'active' : ''}`} onClick={() => setIsMuted(!isMuted)} title="Mute Microphone">
                {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
              </button>
              {isVideo && (
                <button className={`ctrl-btn-round ${isCameraOff ? 'active' : ''}`} onClick={() => setIsCameraOff(!isCameraOff)} title={isCameraOff ? 'Turn Camera On' : 'Turn Camera Off'}>
                  {isCameraOff ? <VideoOff size={22} /> : <Video size={22} />}
                </button>
              )}
              {isVideo && (
                <button className="ctrl-btn-round" title="Switch Camera">
                  <RefreshCw size={22} />
                </button>
              )}
              <button className={`ctrl-btn-round ${isSpeaker ? 'active' : ''}`} onClick={() => setIsSpeaker(!isSpeaker)} title="Speaker">
                <Volume2 size={22} />
              </button>
              {!isVideo && (
                <button className="ctrl-btn-round" title="Add Participant">
                  <Plus size={22} />
                </button>
              )}
            </div>

            <button className="ctrl-btn end-call" onClick={endCall} title="End Call">
              <PhoneOff size={28} />
            </button>

            <div className="fco-actions-secondary">
              <button className="ctrl-btn-round" onClick={() => setShowSettings(!showSettings)} title="Settings">
                <Settings size={22} />
              </button>
            </div>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="fco-quick-settings">
            <div className="settings-header">
              <h3>{isVideo ? 'Call Settings' : 'Audio Settings'}</h3>
              <button onClick={() => setShowSettings(false)}><X size={16} /></button>
            </div>
            <div className="settings-list">
              <div className="s-item"><span>Noise Suppression</span><RefreshCw size={14} /></div>
              <div className="s-item"><span>Echo Cancellation</span><Wifi size={14} /></div>
              {isVideo && <div className="s-item"><span>Low Bandwidth Mode</span><Signal size={14} /></div>}
            </div>
          </div>
        )}
      </div>

      {/* Hidden audio element for consistent remote audio playback */}
      <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />
    </div>
  );
};


export default CallOverlay;
