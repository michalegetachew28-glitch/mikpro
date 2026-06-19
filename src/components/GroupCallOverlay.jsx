import React, { useEffect, useState, useRef } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, User, Plus, Shield, Globe, Minimize2, Maximize2 } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useGroupWebRTC } from '../hooks/useGroupWebRTC';
import './GroupCallOverlay.css';

const GroupCallOverlay = ({ groupId }) => {
  const { groupCalls, leaveGroupCall, activeCall, callState } = useAppContext();
  const { currentUser } = useAuth();
  const [localStream, setLocalStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(activeCall?.type !== 'video');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const call = groupCalls[groupId];
  const { participants } = useGroupWebRTC({
    localStream,
    groupId,
    currentUser,
    activeGroupCall: call
  });

  const localVideoRef = useRef(null);

  useEffect(() => {
    const startMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: activeCall?.type === 'video',
          audio: true
        });
        setLocalStream(stream);
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      } catch (err) {
        console.error("Group media start failed:", err);
      }
    };
    startMedia();
    return () => {
      localStream?.getTracks().forEach(t => t.stop());
    };
  }, []);

  useEffect(() => {
    if (localStream) {
      localStream.getAudioTracks().forEach(t => t.enabled = !isMuted);
      localStream.getVideoTracks().forEach(t => t.enabled = !isCameraOff);
    }
  }, [isMuted, isCameraOff, localStream]);

  if (!call) return null;

  const allParticipantIds = [currentUser.id, ...call.participants.filter(p => p !== currentUser.id)];

  return (
    <div className={`group-call-overlay ${isFullscreen ? 'fullscreen' : ''}`}>
      <div className="gco-header">
        <div className="gco-info">
          <h3>{call.groupName} - {call.type === 'video' ? 'Video' : 'Voice'} Call</h3>
          <span className="gco-status">Live ({call.participants.length} in call)</span>
        </div>
        <div className="gco-actions">
          <button className="gco-btn-mini" onClick={() => setIsFullscreen(!isFullscreen)}>
            {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
          </button>
        </div>
      </div>

      <div className={`active-call-grid grid-${Math.min(allParticipantIds.length, 9)}`}>
        {/* Local View */}
        <div className="participant-tile local">
          <div className="tile-content">
            {activeCall?.type === 'video' && !isCameraOff ? (
              <video ref={localVideoRef} autoPlay playsInline muted className="local-video mirror" />
            ) : (
              <div className="avatar-fallback">
                <div className="avatar-pulse" />
                <User size={64} />
              </div>
            )}
            <div className="tile-overlay">
              <span className="p-name">You</span>
              <div className="p-status">
                {isMuted && <MicOff size={14} color="#ef4444" />}
              </div>
            </div>
          </div>
        </div>

        {/* Remote Participants */}
        {allParticipantIds.slice(1).map(pid => {
          const pData = participants[pid];
          return (
            <div key={pid} className={`participant-tile ${pData?.isSpeaking ? 'speaking' : ''}`}>
              <div className="tile-content">
                {pData?.stream && pData.videoState === 'live' ? (
                  <VideoTile stream={pData.stream} />
                ) : (
                  <div className="avatar-fallback">
                    <div className={`speaking-ring ${pData?.isSpeaking ? 'active' : ''}`} />
                    <User size={64} />
                  </div>
                )}
                
                {/* Always ensure audio plays if a stream exists, regardless of video visibility */}
                {pData?.stream && <ParticipantAudio stream={pData.stream} />}

                <div className="tile-overlay">
                  <span className="p-name">Participant</span>
                  <div className="p-status">
                    {pData?.videoState === 'camera-off' && <VideoOff size={14} color="#ef4444" />}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="gco-controls">
        <div className="controls-group">
          <button className={`ctrl-btn-round ${isMuted ? 'active' : ''}`} onClick={() => setIsMuted(!isMuted)}>
            {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
          </button>
          <button className={`ctrl-btn-round ${isCameraOff ? 'active' : ''}`} onClick={() => setIsCameraOff(!isCameraOff)}>
            {isCameraOff ? <VideoOff size={24} /> : <Video size={24} />}
          </button>
          <button className="ctrl-btn-round">
            <Plus size={24} />
          </button>
        </div>

        <button className="ctrl-btn-end" onClick={() => leaveGroupCall(groupId)}>
          <PhoneOff size={28} />
        </button>

        <div className="controls-group">
          <button className="ctrl-btn-round">
            <Shield size={24} />
          </button>
          <button className="ctrl-btn-round">
            <Globe size={24} />
          </button>
        </div>
      </div>
    </div>
  );
};

const VideoTile = ({ stream }) => {
  const videoRef = useRef(null);
  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);
  // Note: Video element will play both video and audio tracks
  return <video ref={videoRef} autoPlay playsInline className="remote-video" />;
};

const ParticipantAudio = ({ stream }) => {
  const audioRef = useRef(null);
  useEffect(() => {
    if (audioRef.current) audioRef.current.srcObject = stream;
  }, [stream]);
  return <audio ref={audioRef} autoPlay playsInline style={{ display: 'none' }} />;
};

export default GroupCallOverlay;
