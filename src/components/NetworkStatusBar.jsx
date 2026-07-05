import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import './NetworkStatusBar.css';

const NetworkStatusBar = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  // If app loads offline, show immediately. Otherwise, hide.
  const [showStatus, setShowStatus] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowStatus(true);
      
      // Auto-hide the success bar after 5 seconds
      setTimeout(() => {
        setShowStatus(false);
      }, 5000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowStatus(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className={`network-status-bar ${!isOnline ? 'offline' : (showStatus ? 'online' : 'hidden')}`}>
      {isOnline ? (
        <><Wifi size={16} /> <span>Connected Successfully</span></>
      ) : (
        <><WifiOff size={16} /> <span>No Internet Connection – Offline Mode</span></>
      )}
    </div>
  );
};

export default NetworkStatusBar;
