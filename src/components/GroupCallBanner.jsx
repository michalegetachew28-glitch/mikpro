import React from 'react';
import { Phone, Users, Video, User } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import './GroupCallBanner.css';

const GroupCallBanner = ({ groupId }) => {
  const { groupCalls, joinGroupCall, leaveGroupCall, callState, activeCall } = useAppContext();
  const { currentUser } = useAuth();
  
  const call = groupCalls[groupId];
  if (!call) return null;

  const isJoined = callState === 'connected' && activeCall?.groupId === groupId;
  const participantCount = call.participants?.length || 0;

  return (
    <div className={`group-call-banner ${isJoined ? 'joined' : ''}`}>
      <div className="gcb-left">
        <div className="gcb-icon-pulse">
          {call.type === 'video' ? <Video size={18} /> : <Phone size={18} />}
        </div>
        <div className="gcb-info">
          <span className="gcb-label">{call.type === 'video' ? 'Group Video Call' : 'Group Voice Call'}</span>
          <div className="gcb-participants">
            <Users size={12} />
            <span>{participantCount} {participantCount === 1 ? 'participant' : 'participants'}</span>
          </div>
        </div>
      </div>

      <div className="gcb-right">
        {!isJoined ? (
          <button className="gcb-join-btn" onClick={() => joinGroupCall(groupId)}>
            Join
          </button>
        ) : (
          <div className="gcb-joined-badge">
            <div className="status-dot online" />
            <span>You are in call</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default GroupCallBanner;
