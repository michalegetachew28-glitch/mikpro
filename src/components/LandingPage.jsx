import React, { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';
import './LandingPage.css';
import { Shield, Map, Box, CheckCircle, Wrench, ArrowRight, Activity, Droplet, Disc, Wind, Settings, Moon, Sun } from 'lucide-react';
import { translations } from '../data/translations';
import PhoneInput from './PhoneInput';

const LandingPage = () => {
  const { currentUser } = useAuth();
  const { darkMode, toggleDarkMode, language, setLanguage, deferredPrompt, setDeferredPrompt } = useAppContext();
  const [phone, setPhone] = useState('');
  const [isPhoneValid, setIsPhoneValid] = useState(true);

  // If already logged in, we stay on the page but allow navigation to dashboard
  const isLogged = !!currentUser;

  const handleLangChange = (e) => {
    setLanguage(e.target.value);
  };

  const t = translations[language] || translations.en;

  return (
    <div className="landing-container">
      {/* Header */}
      <header className="landing-header glass-panel">
        <div className="logo-container">
          <div className="logo-icon">
            <Wrench size={20} />
          </div>
          <h2>GarageSys</h2>
        </div>

        <nav className="header-nav">
          <a href="#home" className="nav-link">{t.landingHome}</a>
          <a href="#about" className="nav-link">{t.landingAbout}</a>
          <a href="#services" className="nav-link">{t.landingServices}</a>
          <a href="#features" className="nav-link">{t.landingFeatures}</a>
        </nav>

        <div className="header-actions">
          <select value={language} onChange={handleLangChange} className="language-select">
            <option value="en">English</option>
            <option value="am">አማርኛ (Amharic)</option>
            <option value="om">Afaan Oromoo</option>
            <option value="so">Soomaali (Somali)</option>
            <option value="ti">ትግርኛ (Tigrinya)</option>
          </select>
          <button className="theme-toggle-btn icon-btn" onClick={toggleDarkMode} title="Toggle Light/Dark Mode" style={{ width: '38px', height: '38px', background: 'transparent', border: '1px solid var(--border)'}}>
            {darkMode ? <Sun size={18} color="var(--text-primary)" /> : <Moon size={18} color="var(--text-primary)" />}
          </button>
          {deferredPrompt && (
            <button 
              className="btn-primary" 
              onClick={async () => {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                if (outcome === 'accepted') {
                  setDeferredPrompt(null);
                }
              }}
            >
              {t['Install App'] || 'Install App'}
            </button>
          )}
          {isLogged ? (
            <Link to="/dashboard" className="btn-get-started">{t.goToDashboard}</Link>
          ) : (
            <>
              <Link to="/login" className="btn-login">{t.landingLogin}</Link>
              <Link to="/login" className="btn-get-started">{t.landingGetStarted}</Link>
            </>
          )}
        </div>
      </header>

          {/* Hero Section */}
          <section id="home" className="hero-section">
            <div className="hero-content">
              <h1 className="hero-title">
                {t.heroTitle1} <br />
                <span className="text-gradient">{t.heroTitle2}</span>
              </h1>
              <p className="hero-subtitle">
                {t.heroSubtitle}
              </p>
              <div className="hero-cta">
                <Link to={isLogged ? "/dashboard" : "/login"} className="btn-primary-large">
                  {isLogged ? t.goToDashboard : t.landingCta} <ArrowRight size={20} />
                </Link>
                <a href="#services" className="btn-secondary-large">
                  {t.landingExplore}
                </a>
              </div>
            </div>
            
            <div className="hero-image-container">
              <img src="/garage-hero.png" alt="Modern Garage" className="hero-image" />
            </div>

            {/* Decorative elements for the hero background */}
            <div className="blob blob-1"></div>
            <div className="blob blob-2"></div>
          </section>

          {/* About Section */}
          <section id="about" className="about-section">
            <div className="section-header">
              <h2>{t.aboutTitle}</h2>
              <p>{t.aboutSubtitle}</p>
            </div>
            <div className="about-content-wrapper">
              <div className="about-text glass-panel">
                <p>
                  <strong>{t.aboutP1}</strong>
                </p>
                <p>
                  {t.aboutP2}
                </p>
              </div>
              <div className="about-image-container">
                <img src="/about-garage.png" alt="About Garage" className="about-image" />
              </div>
            </div>
          </section>

          {/* Services Section */}
          <section id="services" className="services-section">
            <div className="section-header">
              <h2>{t.servicesTitle}</h2>
              <p>{t.servicesSubtitle}</p>
            </div>
            <div className="services-grid">
              <div className="service-card glass-panel">
                <h3><Activity size={24} color="var(--primary)" /> {t.srv1Title}</h3>
                <p>{t.srv1Desc}</p>
              </div>
              <div className="service-card glass-panel">
                <h3><Droplet size={24} color="var(--success)" /> {t.srv2Title}</h3>
                <p>{t.srv2Desc}</p>
              </div>
              <div className="service-card glass-panel">
                <h3><Shield size={24} color="var(--danger)" /> {t.srv3Title}</h3>
                <p>{t.srv3Desc}</p>
              </div>
              <div className="service-card glass-panel">
                <h3><Disc size={24} color="var(--warning)" /> {t.srv4Title}</h3>
                <p>{t.srv4Desc}</p>
              </div>
              <div className="service-card glass-panel">
                <h3><Wind size={24} color="var(--accent)" /> {t.srv5Title}</h3>
                <p>{t.srv5Desc}</p>
              </div>
              <div className="service-card glass-panel">
                <h3><Settings size={24} color="var(--primary-hover)" /> {t.srv6Title}</h3>
                <p>{t.srv6Desc}</p>
              </div>
            </div>
          </section>

          {/* Features Section */}
          <section id="features" className="features-section">
            <div className="section-header">
              <h2>{t.featuresTitle}</h2>
              <p>{t.featuresSubtitle}</p>
            </div>

            <div className="features-grid">
              <div className="feature-card glass-panel">
                <div className="feature-icon icon-blue">
                  <Map size={28} />
                </div>
                <h3>{t.feat1Title}</h3>
                <p>{t.feat1Desc}</p>
              </div>

              <div className="feature-card glass-panel">
                <div className="feature-icon icon-pink">
                  <Box size={28} />
                </div>
                <h3>{t.feat2Title}</h3>
                <p>{t.feat2Desc}</p>
              </div>

              <div className="feature-card glass-panel">
                <div className="feature-icon icon-orange">
                  <Shield size={28} />
                </div>
                <h3>{t.feat3Title}</h3>
                <p>{t.feat3Desc}</p>
              </div>

              <div className="feature-card glass-panel">
                <div className="feature-icon icon-success">
                  <CheckCircle size={28} />
                </div>
                <h3>{t.feat4Title}</h3>
                <p>{t.feat4Desc}</p>
              </div>
            </div>
          </section>

          {/* Contact Section */}
          <section id="contact" className="contact-section">
            <div className="section-header">
              <h2>{t.contactTitle}</h2>
              <p>{t.contactSubtitle}</p>
            </div>
            
            <div className="contact-wrapper glass-panel">
              <form className="contact-form" onSubmit={(e) => {
                e.preventDefault();
                if (!isPhoneValid) {
                  alert(t("Please enter a valid phone number before submitting."));
                  return;
                }
                alert(t("Message Sent!"));
              }}>
                <div className="form-group">
                  <label>{t.contactName}</label>
                  <input type="text" placeholder="John Doe" className="form-input" />
                </div>
                
                <div className="form-group">
                  <label>{t.contactPhone}</label>
                  <PhoneInput 
                    value={phone}
                    onChange={(val, valid) => {
                      setPhone(val);
                      setIsPhoneValid(valid);
                    }}
                    required={true}
                    placeholder="911 234 567"
                  />
                </div>

                <div className="form-group">
                  <label>{t.contactMsg}</label>
                  <textarea placeholder={t.contactPlaceholder} className="form-input textarea" rows="4"></textarea>
                </div>
                
                <button type="submit" className="btn-primary-large submit-btn">{t.contactSendBtn}</button>
              </form>
            </div>
          </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-logo">
            <div className="logo-icon">
              <Wrench size={16} />
            </div>
            <h3>GarageSys</h3>
          </div>
          <p>&copy; {new Date().getFullYear()} {t.landingFooterText}</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
