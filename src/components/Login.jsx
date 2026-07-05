import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';
import { Wrench, Globe, MessageSquare, ChevronRight, ChevronLeft, Search, MapPin, Phone, CheckCircle2, Building2 } from 'lucide-react';
import PhoneInput from './PhoneInput';
import { api } from '../services/api';
import './Login.css';
import InstallPWA from './InstallPWA';
import './InstallPWA.css';

const SIGNUP_STEP = { ROLE: 0, GARAGE: 1, SERVICES: 2, FORM: 3 };

const Login = () => {
  const { loginAsync, registerAsync, getAccounts, resetPassword, requestPasswordReset, verifyResetOtp } = useAuth();
  const { t, language, setLanguage } = useAppContext();
  const [tab, setTab] = useState('login'); // 'login' | 'signup'
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPhone, setLoginPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isPhoneValid, setIsPhoneValid] = useState(true);
  const [rememberMe, setRememberMe] = useState(true);

  // Forgot password
  const [verificationCode, setVerificationCode] = useState('');
  const [userCodeInput, setUserCodeInput] = useState('');
  const [showSmsToast, setShowSmsToast] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [accountMap, setAccountMap] = useState([]);

  // ------- SIGNUP multi-step -------
  const [signupStep, setSignupStep] = useState(SIGNUP_STEP.ROLE);
  const [signupRole, setSignupRole] = useState('customer');

  // Garage selection
  const [garages, setGarages] = useState([]);
  const [garagesLoading, setGaragesLoading] = useState(false);
  const [garagesError, setGaragesError] = useState('');
  const [garageSearch, setGarageSearch] = useState('');
  const [selectedGarageId, setSelectedGarageId] = useState('');
  const selectedGarageObj = garages.find(g => g.id === selectedGarageId) || null;

  // Account form
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [garageName, setGarageName] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [signupPhoneValid, setSignupPhoneValid] = useState(true);

  // Persistence
  useEffect(() => {
    const savedId = localStorage.getItem('garage_remembered_id');
    const savedMethod = localStorage.getItem('garage_remembered_method') || 'email';
    if (savedMethod === 'email') { if (savedId) setLoginEmail(savedId); }
    else { if (savedId) setLoginPhone(savedId); }
  }, []);

  useEffect(() => {
    const accounts = getAccounts();
    setAccountMap(accounts.map(a => ({ email: a.email, phone: a.phone, ownerId: a.ownerId, garageName: a.garageName })));
  }, [getAccounts]);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Load garages whenever user switches to garage selection step
  useEffect(() => {
    if (signupStep === SIGNUP_STEP.GARAGE && signupRole !== 'admin') {
      setGaragesLoading(true);
      setGaragesError('');
      api.getActiveGarages()
        .then(data => setGarages(Array.isArray(data) ? data : []))
        .catch(err => setGaragesError(err.message || 'Failed to load garages'))
        .finally(() => setGaragesLoading(false));
    }
  }, [signupStep, signupRole]);

  const filteredGarages = garages.filter(g =>
    g.name.toLowerCase().includes(garageSearch.toLowerCase()) ||
    (g.address || '').toLowerCase().includes(garageSearch.toLowerCase())
  );

  // ───────────────── LOGIN ─────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const finalIdentifier = loginEmail || loginPhone;
    if (!finalIdentifier) { setError(t("Please provide your email or phone number.")); setLoading(false); return; }
    if (!password) { setError(t("Password is required.")); setLoading(false); return; }
    if (loginPhone && !isPhoneValid) { setError(t("Please enter a valid Ethiopian phone number (e.g. 09... or 07...)")); setLoading(false); return; }

    try {
      const result = await loginAsync(finalIdentifier, password);
      if (!result.success) {
        setError(result.message);
      } else {
        if (rememberMe) {
          localStorage.setItem('garage_remembered_id', finalIdentifier);
          localStorage.setItem('garage_remembered_method', loginEmail ? 'email' : 'phone');
        } else {
          localStorage.removeItem('garage_remembered_id');
          localStorage.removeItem('garage_remembered_method');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePlatformOwnerLogin = async () => {
    setError(''); setLoading(true);
    try {
      const result = await loginAsync('987360873', '987360873');
      if (!result.success) setError(result.message);
    } finally { setLoading(false); }
  };

  // ───────────────── SIGNUP ─────────────────
  const handleSignupNext = () => {
    setError('');
    if (signupStep === SIGNUP_STEP.ROLE) {
      if (signupRole === 'admin') {
        setSignupStep(SIGNUP_STEP.FORM); // admin skips garage selection
      } else {
        setSignupStep(SIGNUP_STEP.GARAGE);
      }
    } else if (signupStep === SIGNUP_STEP.GARAGE) {
      if (!selectedGarageId) { setError(t("Please select a garage to continue.")); return; }
      setSignupStep(SIGNUP_STEP.SERVICES);
    } else if (signupStep === SIGNUP_STEP.SERVICES) {
      setSignupStep(SIGNUP_STEP.FORM);
    }
  };

  const handleSignupBack = () => {
    setError('');
    if (signupStep === SIGNUP_STEP.FORM) {
      setSignupStep(signupRole === 'admin' ? SIGNUP_STEP.ROLE : SIGNUP_STEP.SERVICES);
    } else if (signupStep === SIGNUP_STEP.SERVICES) {
      setSignupStep(SIGNUP_STEP.GARAGE);
    } else if (signupStep === SIGNUP_STEP.GARAGE) {
      setSignupStep(SIGNUP_STEP.ROLE);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    if (!signupPhoneValid) { setError('Please enter a valid phone number.'); return; }
    if (password.length < 6) { setError(t('passwordMinChar')); return; }
    if (password !== confirmPassword) { setError(t('passwordsDoNotMatch')); return; }
    if (signupRole !== 'admin' && !selectedGarageId) { setError(t("Please select a garage.")); return; }

    setLoading(true);
    try {
      const result = await registerAsync(
        name, email, signupPhone, password,
        signupRole,
        signupRole === 'admin' ? garageName : (selectedGarageObj?.name || ''),
        address,
        signupRole !== 'admin' ? selectedGarageId : null
      );
      if (!result.success) setError(result.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    const identifier = loginEmail || loginPhone;
    if (!identifier) { setError(t('provideEmailOrPhone')); return; }
    const result = requestPasswordReset(identifier);
    if (result.success) {
      setVerificationCode(result.code);
      setError(`Verification code sent! Expires in 5m.`);
      setResendCooldown(60);
      setShowSmsToast(true);
      setTimeout(() => setShowSmsToast(false), 8000);
    } else { setError(result.message); }
  };

  const handleReset = (e) => {
    e.preventDefault(); setError('');
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    const finalIdentifier = loginEmail || loginPhone;
    const result = resetPassword(finalIdentifier, password);
    if (result.success) {
      alert(result.message); setTab('login');
      setPassword(''); setVerificationCode(''); setUserCodeInput('');
    } else { setError(result.message); }
  };

  const toggleLanguage = () => setLanguage(t("am"));
  const resetSignup = () => { setSignupStep(SIGNUP_STEP.ROLE); setSelectedGarageId(''); setGarageSearch(''); setSignupRole('customer'); setError(''); };

  // ────────────────────────────────────
  // Signup step indicators
  const stepLabels = signupRole === 'admin'
    ? ['Role', 'Account']
    : ['Role', 'Garage', 'Services', 'Account'];
  const stepCount = signupRole === 'admin' ? 2 : 4;
  const currentStepDisplay = signupRole === 'admin'
    ? (signupStep === SIGNUP_STEP.ROLE ? 1 : 2)
    : signupStep + 1;


  return (
    <div className="auth-page">
      <div className={`auth-card ${tab === 'signup' && signupStep !== SIGNUP_STEP.ROLE ? 'auth-card--wide' : ''}`}>
        {/* Language Toggle */}
        <div className="auth-lang-toggle">
          <button className="language-toggle" onClick={toggleLanguage}>
            <Globe size={18} />
            <span>{t(t("amharic"))}</span>
          </button>
        </div>

        {/* Logo */}
        <div className="auth-logo">
          <div className="auth-logo-icon"><Wrench size={26} /></div>
          <h1>MechPro</h1>
        </div>

        {/* Tabs */}
        <div className="auth-tabs">
          <button
            className={`auth-tab ${tab === 'login' ? 'active' : ''}`}
            onClick={() => { setTab('login'); setError(''); resetSignup(); }}
          >
            {t('signIn')}
          </button>
          <button
            className={`auth-tab ${tab === 'signup' ? 'active' : ''}`}
            onClick={() => { setTab('signup'); setError(''); resetSignup(); }}
          >
            {t('createAccount')}
          </button>
        </div>

        {/* ══════════════ LOGIN ══════════════ */}
        {tab === 'login' ? (
          <>
            <button
              type="button"
              onClick={handlePlatformOwnerLogin}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                width: '100%', padding: '13px 20px', marginBottom: '18px',
                background: 'linear-gradient(135deg, #6366f1, #818cf8)',
                border: 'none', borderRadius: '12px', color: '#fff',
                fontSize: '0.9rem', fontWeight: '700', cursor: 'pointer',
                letterSpacing: '0.01em', boxShadow: '0 4px 20px rgba(99,102,241,0.45)',
                transition: 'transform 0.15s, box-shadow 0.15s', fontFamily: 'inherit',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(99,102,241,0.55)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(99,102,241,0.45)'; }}
            >
              <span style={{ fontSize: '1.1rem' }}>⚡</span>
              Enter Platform Owner Portal
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, opacity: 0.45 }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>or sign in as a garage user</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>
            <p className="auth-subtitle">{t('loginSubtitle')}</p>
            <form className="auth-form" onSubmit={handleLogin}>
              <div className="auth-form-group">
                <label>{t('email')}</label>
                <input
                  className="auth-input"
                  type="email"
                  value={loginEmail}
                  onChange={e => { setLoginEmail(e.target.value); if (e.target.value) setLoginPhone(''); }}
                  placeholder="you@example.com"
                />
              </div>
              <div className="auth-divider"><span>{t("OR")}</span></div>
              <div className="auth-form-group">
                <label>{t('phone')}</label>
                <PhoneInput
                  value={loginPhone}
                  onChange={(val, valid) => { setLoginPhone(val); if (val) setLoginEmail(''); setIsPhoneValid(valid); }}
                />
              </div>
              <div className="auth-form-group">
                <label>{t('password')}</label>
                <input className="auth-input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required autoComplete="current-password" />
              </div>
              <div className="auth-options">
                <label className="remember-me">
                  <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} />
                  <span>{t("Remember me")}</span>
                </label>
                <button type="button" className="btn-text-small" style={{ fontSize: '0.8rem', opacity: 0.8 }} onClick={() => { setTab('forgot'); setError(''); }}>
                  {t("Forgot Password?")}
                </button>
              </div>
              {error && <div className="auth-error">{error}</div>}
              <button type="submit" className="auth-submit-btn" disabled={loading}>
                {loading ? <span className="loader-spinner xsmall"></span> : (t('signIn') + ' →')}
              </button>
            </form>
          </>

        ) : tab === 'forgot' ? (
          /* ══════════════ FORGOT PASSWORD ══════════════ */
          <>
            <p className="auth-subtitle">{t("Securely reset your password using your recovery contact")}</p>
            <form className="auth-form" onSubmit={handleReset}>
              <div className="auth-form-group">
                <label>{t('email')}</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input className="auth-input" type="email" placeholder="you@example.com" value={loginEmail} onChange={e => { setLoginEmail(e.target.value); if (e.target.value) setLoginPhone(''); }} disabled={verificationCode && !error.includes('expired')} />
                  {(!verificationCode || error.includes('expired')) && (
                    <button type="button" className="btn-primary-small" disabled={resendCooldown > 0} onClick={handleSendOtp}>
                      {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : t("Send Code")}
                    </button>
                  )}
                </div>
              </div>
              <div className="auth-divider"><span>{t("OR")}</span></div>
              <div className="auth-form-group">
                <label>{t('phone')}</label>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <PhoneInput value={loginPhone} onChange={(val, valid) => { setLoginPhone(val); if (val) setLoginEmail(''); setIsPhoneValid(valid); }} />
                  </div>
                  {(!verificationCode || error.includes('expired')) && (
                    <button type="button" className="btn-primary-small" style={{ height: '52px', marginTop: '0' }} disabled={resendCooldown > 0 || !isPhoneValid} onClick={handleSendOtp}>
                      {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : t("Send Code")}
                    </button>
                  )}
                </div>
              </div>
              {(verificationCode && !error.includes('Verified')) && (
                <div className="auth-form-group">
                  <label>{t("Verification Code")}</label>
                  <input className="auth-input" type="text" placeholder="______" maxLength="6" required value={userCodeInput} onChange={e => {
                    const val = e.target.value; setUserCodeInput(val);
                    if (val.length === 6) {
                      const finalIdentifier = loginEmail || loginPhone;
                      const res = verifyResetOtp(finalIdentifier, val);
                      if (res.success) { setError('Verified! Create your new password.'); setPassword(''); } else setError(res.message);
                    }
                  }} />
                </div>
              )}
              {error.includes('Verified') && (
                <>
                  <div className="auth-form-group">
                    <label>{t("New Password")}</label>
                    <input className="auth-input" type="password" placeholder="••••••••" required value={password} onChange={e => setPassword(e.target.value)} />
                  </div>
                  <div className="auth-form-group">
                    <label>{t("Confirm New Password")}</label>
                    <input className="auth-input" type="password" placeholder="••••••••" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                  </div>
                </>
              )}
              {error && !error.includes('Enter code') && (
                <div className={`auth-error ${error.includes('Verified') || error.includes('sent') ? 'success' : ''}`}>
                  {error.includes('sent') ? <div style={{display:'flex',flexDirection:'column',gap:5}}><strong>{t("CODE SENT")}</strong><span>{error}</span></div> : error}
                </div>
              )}
              {error.includes('Verified') && <button type="submit" className="auth-submit-btn">{t("Save New Password")}</button>}
              <button type="button" className="btn-text" style={{ width: '100%', marginTop: 10 }} onClick={() => { setTab('login'); setLoginEmail(''); setLoginPhone(''); setPassword(''); setError(''); }}>
                {t('cancel')}
              </button>
            </form>
          </>

        ) : (
          /* ══════════════ SIGNUP - MULTI STEP ══════════════ */
          <>
            {/* Step indicators */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 20 }}>
              {stepLabels.map((label, i) => {
                const isActive = i === currentStepDisplay - 1;
                const isDone = i < currentStepDisplay - 1;
                return (
                  <React.Fragment key={i}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.75rem', fontWeight: 700, transition: 'all 0.25s',
                        background: isDone ? 'var(--success)' : isActive ? 'var(--primary)' : 'var(--bg-main)',
                        color: (isDone || isActive) ? '#fff' : 'var(--text-secondary)',
                        border: isActive ? '2px solid var(--primary)' : '2px solid var(--border)',
                        boxShadow: isActive ? '0 0 0 4px rgba(99,102,241,0.18)' : 'none'
                      }}>
                        {isDone ? '✓' : i + 1}
                      </div>
                      <span style={{ fontSize: '0.65rem', opacity: isActive ? 1 : 0.5, fontWeight: isActive ? 700 : 400 }}>{label}</span>
                    </div>
                    {i < stepLabels.length - 1 && (
                      <div style={{ width: 24, height: 2, borderRadius: 2, marginBottom: 14, background: i < currentStepDisplay - 1 ? 'var(--success)' : 'var(--border)', transition: 'background 0.3s' }} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            {/* ── STEP 0: Role ── */}
            {signupStep === SIGNUP_STEP.ROLE && (
              <div>
                <p className="auth-subtitle" style={{ textAlign: 'center' }}>{t('Who are you?')}</p>
                <div style={{ display: 'flex', gap: 12, marginBottom: 24, marginTop: 8 }}>
                  {[
                    { value: 'customer', label: t('customer') || 'Customer', icon: '👤', desc: 'Book services & track vehicles' },
                    { value: 'admin', label: t('garageOwner') || 'Garage Owner', icon: '🏢', desc: 'Manage your own garage' },
                  ].map(r => (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => setSignupRole(r.value)}
                      style={{
                        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '18px 12px',
                        borderRadius: 14, border: signupRole === r.value ? '2px solid var(--primary)' : '2px solid var(--border)',
                        background: signupRole === r.value ? 'var(--primary-subtle, rgba(99,102,241,0.1))' : 'var(--bg-main)',
                        color: signupRole === r.value ? 'var(--primary)' : 'var(--text-secondary)',
                        cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'inherit',
                        boxShadow: signupRole === r.value ? '0 0 0 4px rgba(99,102,241,0.12)' : 'none'
                      }}
                    >
                      <span style={{ fontSize: '1.8rem' }}>{r.icon}</span>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{r.label}</span>
                      <span style={{ fontSize: '0.72rem', opacity: 0.65, textAlign: 'center' }}>{r.desc}</span>
                    </button>
                  ))}
                </div>
                {error && <div className="auth-error">{error}</div>}
                <button className="auth-submit-btn" onClick={handleSignupNext} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {t('Continue')} <ChevronRight size={18} />
                </button>
              </div>
            )}

            {/* ── STEP 1: Garage Selection ── */}
            {signupStep === SIGNUP_STEP.GARAGE && (
              <div>
                <p className="auth-subtitle" style={{ textAlign: 'center', marginBottom: 14 }}>
                  {t('Select your garage')}
                </p>

                {/* Search */}
                <div style={{ position: 'relative', marginBottom: 16 }}>
                  <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', opacity: 0.45, pointerEvents: 'none' }} />
                  <input
                    className="auth-input"
                    style={{ paddingLeft: 38, margin: 0 }}
                    type="text"
                    placeholder="Search garage by name or location..."
                    value={garageSearch}
                    onChange={e => setGarageSearch(e.target.value)}
                  />
                </div>

                {/* Loading */}
                {garagesLoading && (
                  <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-secondary)' }}>
                    <span className="loader-spinner xsmall" style={{ display: 'inline-block', marginBottom: 8 }}></span>
                    <p style={{ margin: 0, fontSize: '0.85rem' }}>Loading garages...</p>
                  </div>
                )}

                {/* Error */}
                {garagesError && !garagesLoading && (
                  <div style={{ textAlign: 'center', padding: 20, background: 'rgba(239,68,68,0.08)', borderRadius: 12, border: '1px solid rgba(239,68,68,0.2)' }}>
                    <p style={{ color: 'var(--danger)', margin: 0, fontSize: '0.85rem' }}>⚠ {garagesError}</p>
                    <button className="btn-text" style={{ marginTop: 8, fontSize: '0.8rem' }} onClick={() => {
                      setGaragesLoading(true); setGaragesError('');
                      api.getActiveGarages().then(d => setGarages(Array.isArray(d) ? d : [])).catch(e => setGaragesError(e.message)).finally(() => setGaragesLoading(false));
                    }}>Retry</button>
                  </div>
                )}

                {/* Empty */}
                {!garagesLoading && !garagesError && filteredGarages.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '28px 20px', opacity: 0.55 }}>
                    <Building2 size={36} style={{ marginBottom: 8, opacity: 0.4 }} />
                    <p style={{ margin: 0, fontSize: '0.85rem' }}>{garageSearch ? 'No garages match your search.' : 'No active garages available.'}</p>
                  </div>
                )}

                {/* Garage Cards */}
                {!garagesLoading && !garagesError && (
                  <div style={{ display: 'grid', gap: 12, maxHeight: 340, overflowY: 'auto', paddingRight: 4 }}>
                    {filteredGarages.map(g => {
                      const isSelected = selectedGarageId === g.id;
                      return (
                        <div
                          key={g.id}
                          onClick={() => setSelectedGarageId(g.id)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                            borderRadius: 14, cursor: 'pointer', transition: 'all 0.2s',
                            border: isSelected ? '2px solid var(--primary)' : '2px solid var(--border)',
                            background: isSelected ? 'var(--primary-subtle, rgba(99,102,241,0.08))' : 'var(--bg-main)',
                            boxShadow: isSelected ? '0 0 0 4px rgba(99,102,241,0.1)' : 'none',
                            transform: isSelected ? 'scale(1.01)' : 'scale(1)',
                          }}
                        >
                          {/* Logo or Initials */}
                          {g.logoUrl ? (
                            <img src={g.logoUrl} alt={g.name} style={{ width: 52, height: 52, borderRadius: 10, objectFit: 'cover', flexShrink: 0, border: '2px solid var(--border)' }} />
                          ) : (
                            <div style={{
                              width: 52, height: 52, borderRadius: 10, flexShrink: 0,
                              background: isSelected ? 'var(--primary)' : 'var(--bg-card)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '1.3rem', fontWeight: 800, color: isSelected ? '#fff' : 'var(--text-secondary)',
                              border: '2px solid var(--border)', transition: 'all 0.2s'
                            }}>
                              {g.name.charAt(0).toUpperCase()}
                            </div>
                          )}

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                              <strong style={{ fontSize: '0.95rem', color: isSelected ? 'var(--primary)' : 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {g.name}
                              </strong>
                              {isSelected && <CheckCircle2 size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} />}
                            </div>
                            {g.description && (
                              <p style={{ margin: '3px 0', fontSize: '0.78rem', opacity: 0.65, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                                {g.description}
                              </p>
                            )}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px', marginTop: 4 }}>
                              {g.address && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.73rem', opacity: 0.55 }}>
                                  <MapPin size={11} /> {g.address}
                                </span>
                              )}
                              {g.phone && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.73rem', opacity: 0.55 }}>
                                  <Phone size={11} /> {g.phone}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {error && <div className="auth-error" style={{ marginTop: 8 }}>{error}</div>}

                <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                  <button type="button" className="btn-secondary" onClick={handleSignupBack} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '11px 16px' }}>
                    <ChevronLeft size={16} /> {t('Back')}
                  </button>
                  <button
                    type="button"
                    className="auth-submit-btn"
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: selectedGarageId ? 1 : 0.55 }}
                    onClick={handleSignupNext}
                  >
                    {t('Continue')} <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 2: Services Preview ── */}
            {signupStep === SIGNUP_STEP.SERVICES && selectedGarageObj && (
              <div>
                <p className="auth-subtitle" style={{ textAlign: 'center', marginBottom: 14 }}>
                  {t("Services offered by")}: <strong style={{ color: 'var(--primary)' }}>{selectedGarageObj.name}</strong>
                </p>

                {/* Garage summary card */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 14, border: '2px solid var(--primary)', background: 'var(--primary-subtle, rgba(99,102,241,0.07))', marginBottom: 16 }}>
                  {selectedGarageObj.logoUrl ? (
                    <img src={selectedGarageObj.logoUrl} alt={selectedGarageObj.name} style={{ width: 52, height: 52, borderRadius: 10, objectFit: 'cover', border: '2px solid var(--primary)' }} />
                  ) : (
                    <div style={{ width: 52, height: 52, borderRadius: 10, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', fontWeight: 800, color: '#fff' }}>
                      {selectedGarageObj.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <strong style={{ color: 'var(--primary)', fontSize: '1rem' }}>{selectedGarageObj.name}</strong>
                    {selectedGarageObj.address && <p style={{ margin: '2px 0 0', fontSize: '0.78rem', opacity: 0.6, display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={11} /> {selectedGarageObj.address}</p>}
                  </div>
                </div>

                {/* Services */}
                <div style={{ borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-main)', overflow: 'hidden' }}>
                  <div style={{ padding: '10px 16px', background: 'var(--primary)', color: '#fff', fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                    ⭐ {t('Our Services')}
                  </div>
                  <div style={{ padding: '14px 16px', maxHeight: 200, overflowY: 'auto' }}>
                    {selectedGarageObj.services ? (
                      <pre style={{ margin: 0, fontFamily: 'inherit', fontSize: '0.85rem', lineHeight: 1.7, whiteSpace: 'pre-wrap', color: 'var(--text-primary)' }}>
                        {selectedGarageObj.services}
                      </pre>
                    ) : (
                      <p style={{ margin: 0, opacity: 0.5, fontSize: '0.82rem', textAlign: 'center', padding: '12px 0' }}>
                        {t('No service list provided by this garage.')}
                      </p>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                  <button type="button" className="btn-secondary" onClick={handleSignupBack} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '11px 16px' }}>
                    <ChevronLeft size={16} /> {t('Back')}
                  </button>
                  <button type="button" className="auth-submit-btn" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={handleSignupNext}>
                    {t('Continue')} <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 3 (or 1 for admin): Account Form ── */}
            {signupStep === SIGNUP_STEP.FORM && (
              <form className="auth-form" onSubmit={handleSignup}>
                {/* Selected garage badge */}
                {signupRole !== 'admin' && selectedGarageObj && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, border: '1px solid var(--primary)', background: 'var(--primary-subtle, rgba(99,102,241,0.08))', marginBottom: 4 }}>
                    <CheckCircle2 size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.82rem', color: 'var(--primary)', fontWeight: 600 }}>
                      {selectedGarageObj.name}
                    </span>
                    <button type="button" onClick={() => setSignupStep(SIGNUP_STEP.GARAGE)} style={{ marginLeft: 'auto', fontSize: '0.72rem', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', opacity: 0.7 }}>
                      Change
                    </button>
                  </div>
                )}

                <div className="auth-form-group">
                  <label>{t('name')}</label>
                  <input className="auth-input" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="John Doe" required />
                </div>

                {signupRole === 'admin' && (
                  <div className="auth-form-group">
                    <label>{t('garageName')}</label>
                    <input className="auth-input" type="text" value={garageName} onChange={e => setGarageName(e.target.value)} placeholder="e.g. Addis Garage" required />
                  </div>
                )}

                <div className="auth-form-group">
                  <label>{t('email')} ({t("Opt.")})</label>
                  <input className="auth-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
                </div>

                <div className="auth-form-group">
                  <label>{t('phone')} ({t('required')})</label>
                  <PhoneInput
                    value={signupPhone}
                    onChange={(val, valid) => { setSignupPhone(val); setSignupPhoneValid(valid); }}
                    required={true}
                  />
                </div>

                <div className="auth-form-group">
                  <label>{t('address')} ({t("Opt.")})</label>
                  <input className="auth-input" type="text" value={address} onChange={e => setAddress(e.target.value)} placeholder="e.g. Bole, Addis Ababa" />
                </div>

                <div className="auth-form-group">
                  <label>{t('password')}</label>
                  <input className="auth-input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required autoComplete="new-password" />
                </div>

                <div className="auth-form-group">
                  <label>{t('confirmPassword')}</label>
                  <input className="auth-input" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" required autoComplete="new-password" />
                </div>

                {error && <div className="auth-error">{error}</div>}

                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="button" className="btn-secondary" onClick={handleSignupBack} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '11px 16px' }}>
                    <ChevronLeft size={16} /> {t('Back')}
                  </button>
                  <button type="submit" className="auth-submit-btn" style={{ flex: 1 }} disabled={loading}>
                    {loading ? <span className="loader-spinner xsmall"></span> : (t('createAccount') + ' →')}
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </div>

      {showSmsToast && (
        <div className="mock-sms-toast">
          <div className="sms-icon"><MessageSquare size={20} /></div>
          <div className="sms-content">
            <h4>MechPro Messages</h4>
            <p>Your verification code is: <strong>{verificationCode}</strong></p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;

