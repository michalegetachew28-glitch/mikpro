import React, { useState, useEffect } from 'react';
import { Download, Share, PlusSquare, X } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import './InstallPWA.css';

const InstallPWA = ({ className = "" }) => {
  const { t } = useAppContext();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isSafari, setIsSafari] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // 1. Detect if already installed (standalone mode)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (isStandalone) {
      setIsVisible(false);
      return;
    }

    // 2. Detect Safari/iOS
    const ua = window.navigator.userAgent;
    const isIOS = /iPhone|iPad|iPod/.test(ua);
    const isSafariUA = /^((?!chrome|android).)*safari/i.test(ua);
    const safariDetected = isIOS || isSafariUA;
    setIsSafari(safariDetected);

    // If safari, we can show instructions immediately (unless already installed)
    if (safariDetected) {
      setIsVisible(true);
    }

    // 3. Listen for Chrome's install prompt
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setIsVisible(false);
      }
    } else if (isSafari) {
      setShowGuide(true);
    }
  };

  if (!isVisible) return null;

  return (
    <>
      <button className={`install-pwa-btn ${className}`} onClick={handleInstallClick}>
        <Download size={18} />
        <span>{t("Install App")}</span>
      </button>

      {showGuide && (
        <div className="safari-guide-overlay" onClick={() => setShowGuide(false)}>
          <div className="safari-guide-modal" onClick={e => e.stopPropagation()}>
            <button className="guide-close" onClick={() => setShowGuide(false)}><X size={20} /></button>
            <div className="guide-icon-header">
               <Download size={32} />
            </div>
            <h3>{t("Install on Safari")}</h3>
            <p>To add this app to your home screen for quick access:</p>
            
            <div className="guide-steps">
              <div className="guide-step">
                <div className="step-num">1</div>
                <div className="step-text">{t("Tap the Share button at the bottom of the screen.")}</div>
              </div>
              <div className="guide-step">
                <div className="step-num">2</div>
                <div className="step-text">{t("Scroll down and tap Add to Home Screen.")}</div>
              </div>
              <div className="guide-step">
                <div className="step-num">3</div>
                <div className="step-text">{t("Tap Add in the top right corner.")}</div>
              </div>
            </div>

            <button className="guide-done" onClick={() => setShowGuide(false)}>{t("Got it")}</button>
          </div>
        </div>
      )}
    </>
  );
};

export default InstallPWA;
