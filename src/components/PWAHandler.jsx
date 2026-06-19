import React, { useState, useEffect } from 'react';
import { Download, RefreshCw, X } from 'lucide-react';

const PWAHandler = () => {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showUpdate, setShowUpdate] = useState(false);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  useEffect(() => {
    // Handle Service Worker updates
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        setShowUpdate(true);
      });
    }

    // Handle install prompt
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
      // Check if user has already seen this session
      if (!sessionStorage.getItem('pwa-prompt-seen')) {
        setShowInstallBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    setInstallPrompt(null);
    setShowInstallBanner(false);
    sessionStorage.setItem('pwa-prompt-seen', 'true');
  };

  const handleUpdate = () => {
    window.location.reload();
  };

  if (!showUpdate && !showInstallBanner) return null;

  return (
    <div className="pwa-notifications-container">
      {showUpdate && (
        <div className="pwa-banner update-banner">
          <div className="pwa-banner-content">
            <RefreshCw className="pwa-icon spin" size={20} />
            <div>
              <p className="pwa-title">New Update Available</p>
              <p className="pwa-desc">Reload to get the latest features and fixes.</p>
            </div>
          </div>
          <button className="pwa-btn primary" onClick={handleUpdate}>Update Now</button>
        </div>
      )}

      {showInstallBanner && (
        <div className="pwa-banner install-banner">
          <div className="pwa-banner-content">
            <Download className="pwa-icon" size={20} />
            <div>
              <p className="pwa-title">Install GarageSys</p>
              <p className="pwa-desc">Install for a faster, app-like experience.</p>
            </div>
          </div>
          <div className="pwa-actions">
            <button className="pwa-btn text" onClick={() => setShowInstallBanner(false)}>
              <X size={18} />
            </button>
            <button className="pwa-btn primary" onClick={handleInstall}>Install</button>
          </div>
        </div>
      )}

      <style>{`
        .pwa-notifications-container {
          position: fixed;
          bottom: 100px; /* Above BottomNav */
          left: 50%;
          transform: translateX(-50%);
          z-index: 10000;
          display: flex;
          flex-direction: column;
          gap: 12px;
          width: 90%;
          max-width: 400px;
          animation: slideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .pwa-banner {
          background: var(--bg-card);
          border: 1px solid var(--primary);
          border-radius: var(--radius-lg);
          padding: 16px;
          box-shadow: var(--shadow-glass);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
        }

        .pwa-banner-content {
          display: flex;
          align-items: center;
          gap: 12px;
          flex: 1;
        }

        .pwa-icon {
          color: var(--primary);
          flex-shrink: 0;
        }

        .pwa-icon.spin {
          animation: spin 2s linear infinite;
        }

        .pwa-title {
          font-weight: 700;
          font-size: 0.95rem;
          margin: 0;
          color: var(--text-primary);
        }

        .pwa-desc {
          font-size: 0.8rem;
          margin: 0;
          color: var(--text-secondary);
        }

        .pwa-btn {
          padding: 8px 16px;
          border-radius: var(--radius-btn);
          font-weight: 600;
          font-size: 0.85rem;
          cursor: pointer;
          transition: var(--transition);
          border: none;
        }

        .pwa-btn.primary {
          background: var(--primary);
          color: white;
        }

        .pwa-btn.text {
          background: transparent;
          color: var(--text-secondary);
          padding: 8px;
        }

        @keyframes slideUp {
          from { transform: translate(-50%, 20px); opacity: 0; }
          to { transform: translate(-50%, 0); opacity: 1; }
        }

        @media (max-width: 768px) {
          .pwa-notifications-container {
            bottom: calc(90px + var(--safe-bottom));
          }
        }
      `}</style>
    </div>
  );
};

export default PWAHandler;
