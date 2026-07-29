import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';
import {
  Wrench, Globe, MessageSquare, ChevronRight, ChevronLeft,
  Search, MapPin, Phone, CheckCircle2, Building2,
} from 'lucide-react';
import PhoneInput from './PhoneInput';
import { api } from '../services/api';
import './Login.css';
import InstallPWA from './InstallPWA';
import './InstallPWA.css';

const SIGNUP_STEP = { ROLE: 0, GARAGE: 1, SERVICES: 2, FORM: 3 };

const Login = () => {
  const { loginAsync, registerAsync, getAccounts, resetPassword, requestPasswordReset, verifyResetOtp } = useAuth();
  const { t, language, setLanguage } = useAppContext();
  const [tab, setTab] = useState('login'); // 'login' | 'signup' | 'forgot'
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

  // ── Effects ──────────────────────────────────────────────
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

  // ── Handlers ─────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const finalIdentifier = loginEmail || loginPhone;
    if (!finalIdentifier) { setError(t('Please provide your email or phone number.')); setLoading(false); return; }
    if (!password) { setError(t('Password is required.')); setLoading(false); return; }
    if (loginPhone && !isPhoneValid) { setError(t('Please enter a valid Ethiopian phone number (e.g. 09... or 07...)')); setLoading(false); return; }
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

  const handleSignupNext = () => {
    setError('');
    if (signupStep === SIGNUP_STEP.ROLE) {
      setSignupStep(signupRole === 'admin' ? SIGNUP_STEP.FORM : SIGNUP_STEP.GARAGE);
    } else if (signupStep === SIGNUP_STEP.GARAGE) {
      if (!selectedGarageId) { setError(t('Please select a garage to continue.')); return; }
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
    if (signupRole !== 'admin' && !selectedGarageId) { setError(t('Please select a garage.')); return; }
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
      setError('Verification code sent! Expires in 5m.');
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

  const toggleLanguage = () => setLanguage(t('am'));
  const resetSignup = () => {
    setSignupStep(SIGNUP_STEP.ROLE);
    setSelectedGarageId('');
    setGarageSearch('');
    setSignupRole('customer');
    setError('');
  };

  // Step labels for progress bar
  const stepLabels = signupRole === 'admin' ? ['Role', 'Account'] : ['Role', 'Garage', 'Services', 'Account'];
  const currentStepDisplay = signupRole === 'admin'
    ? (signupStep === SIGNUP_STEP.ROLE ? 1 : 2)
    : signupStep + 1;

  const isWide = tab === 'signup' && signupStep !== SIGNUP_STEP.ROLE;

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="lp-root">
      <div className={`lp-card${isWide ? ' lp-card--wide' : ''}`}>

        {/* ── Header: Logo + Lang ── */}
        <div className="lp-header">
          <div className="lp-logo">
            <div className="lp-logo-icon"><Wrench size={22} /></div>
            <span className="lp-logo-text">MechPro</span>
          </div>
          <button className="lp-lang-btn" onClick={toggleLanguage}>
            <Globe size={15} />
            <span>{t(t('amharic'))}</span>
          </button>
        </div>

        {/* ── Tab switcher ── */}
        <div className="lp-tabs">
          <button
            className={`lp-tab${tab === 'login' ? ' active' : ''}`}
            onClick={() => { setTab('login'); setError(''); resetSignup(); }}
          >
            {t('signIn')}
          </button>
          <button
            className={`lp-tab${tab === 'signup' || tab === 'forgot' ? ' active' : ''}`}
            onClick={() => { setTab('signup'); setError(''); resetSignup(); }}
          >
            {t('createAccount')}
          </button>
        </div>

        {/* ══════════════════ LOGIN ══════════════════ */}
        {tab === 'login' && (
          <>
            {/* Platform owner quick-access */}
            <button className="lp-platform-btn" onClick={handlePlatformOwnerLogin} disabled={loading}>
              <span className="lp-lightning">⚡</span>
              Enter Platform Owner Portal
            </button>

            <div className="lp-or">
              <div className="lp-or-line" />
              <span className="lp-or-text">or sign in as a garage user</span>
              <div className="lp-or-line" />
            </div>

            <p className="lp-subtitle">{t('loginSubtitle')}</p>

            <form className="lp-form" onSubmit={handleLogin}>
              <div className="lp-field">
                <label>{t('email')}</label>
                <input
                  className="lp-input"
                  type="email"
                  placeholder="you@example.com"
                  value={loginEmail}
                  onChange={e => { setLoginEmail(e.target.value); if (e.target.value) setLoginPhone(''); }}
                />
              </div>

              <div className="lp-field-divider"><span>{t('OR')}</span></div>

              <div className="lp-field">
                <label>{t('phone')}</label>
                <div className="lp-phone-wrap">
                  <PhoneInput
                    value={loginPhone}
                    onChange={(val, valid) => { setLoginPhone(val); if (val) setLoginEmail(''); setIsPhoneValid(valid); }}
                  />
                </div>
              </div>

              <div className="lp-field">
                <label>{t('password')}</label>
                <input
                  className="lp-input"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>

              <div className="lp-options">
                <label className="lp-remember">
                  <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} />
                  <span>{t('Remember me')}</span>
                </label>
                <button
                  type="button"
                  className="lp-forgot-btn"
                  onClick={() => { setTab('forgot'); setError(''); }}
                >
                  {t('Forgot Password?')}
                </button>
              </div>

              {error && <div className="lp-alert">{error}</div>}

              <button type="submit" className="lp-submit" disabled={loading}>
                {loading ? <span className="loader-spinner xsmall" /> : `${t('signIn')} →`}
              </button>
            </form>
          </>
        )}

        {/* ══════════════════ FORGOT PASSWORD ══════════════════ */}
        {tab === 'forgot' && (
          <>
            <p className="lp-subtitle">{t('Securely reset your password using your recovery contact')}</p>
            <form className="lp-form" onSubmit={handleReset}>
              {/* Email + Send code */}
              <div className="lp-field">
                <label>{t('email')}</label>
                <div className="lp-code-row">
                  <input
                    className="lp-input"
                    type="email"
                    placeholder="you@example.com"
                    value={loginEmail}
                    onChange={e => { setLoginEmail(e.target.value); if (e.target.value) setLoginPhone(''); }}
                    disabled={verificationCode && !error.includes('expired')}
                  />
                  {(!verificationCode || error.includes('expired')) && (
                    <button type="button" className="btn-primary-small" disabled={resendCooldown > 0} onClick={handleSendOtp}>
                      {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : t('Send Code')}
                    </button>
                  )}
                </div>
              </div>

              <div className="lp-field-divider"><span>{t('OR')}</span></div>

              {/* Phone + Send code */}
              <div className="lp-field">
                <label>{t('phone')}</label>
                <div className="lp-code-row">
                  <div className="lp-phone-wrap" style={{ flex: 1 }}>
                    <PhoneInput
                      value={loginPhone}
                      onChange={(val, valid) => { setLoginPhone(val); if (val) setLoginEmail(''); setIsPhoneValid(valid); }}
                    />
                  </div>
                  {(!verificationCode || error.includes('expired')) && (
                    <button type="button" className="btn-primary-small" disabled={resendCooldown > 0 || !isPhoneValid} onClick={handleSendOtp}>
                      {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : t('Send Code')}
                    </button>
                  )}
                </div>
              </div>

              {/* OTP input */}
              {verificationCode && !error.includes('Verified') && (
                <div className="lp-field">
                  <label>{t('Verification Code')}</label>
                  <input
                    className="lp-input"
                    type="text"
                    placeholder="______"
                    maxLength="6"
                    required
                    value={userCodeInput}
                    onChange={e => {
                      const val = e.target.value; setUserCodeInput(val);
                      if (val.length === 6) {
                        const finalIdentifier = loginEmail || loginPhone;
                        const res = verifyResetOtp(finalIdentifier, val);
                        if (res.success) { setError('Verified! Create your new password.'); setPassword(''); }
                        else setError(res.message);
                      }
                    }}
                  />
                </div>
              )}

              {/* New password fields */}
              {error.includes('Verified') && (
                <>
                  <div className="lp-field">
                    <label>{t('New Password')}</label>
                    <input className="lp-input" type="password" placeholder="••••••••" required value={password} onChange={e => setPassword(e.target.value)} />
                  </div>
                  <div className="lp-field">
                    <label>{t('Confirm New Password')}</label>
                    <input className="lp-input" type="password" placeholder="••••••••" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                  </div>
                </>
              )}

              {error && !error.includes('Enter code') && (
                <div className={`lp-alert${error.includes('Verified') || error.includes('sent') ? ' success' : ''}`}>
                  {error.includes('sent')
                    ? <><strong>{t('CODE SENT')}</strong><br />{error}</>
                    : error}
                </div>
              )}

              {error.includes('Verified') && (
                <button type="submit" className="lp-submit">{t('Save New Password')}</button>
              )}

              <button
                type="button"
                className="lp-cancel-btn"
                onClick={() => { setTab('login'); setLoginEmail(''); setLoginPhone(''); setPassword(''); setError(''); }}
              >
                {t('cancel')}
              </button>
            </form>
          </>
        )}

        {/* ══════════════════ SIGNUP — MULTI STEP ══════════════════ */}
        {tab === 'signup' && (
          <>
            {/* Progress step bar */}
            <div className="lp-steps">
              {stepLabels.map((label, i) => {
                const isActive = i === currentStepDisplay - 1;
                const isDone   = i < currentStepDisplay - 1;
                return (
                  <React.Fragment key={i}>
                    <div className="lp-step-item">
                      <div className={`lp-step-bubble${isDone ? ' done' : ''}${isActive ? ' current' : ''}`}>
                        {isDone ? '✓' : i + 1}
                      </div>
                      <span className={`lp-step-label${isActive ? ' current' : ''}`}>{label}</span>
                    </div>
                    {i < stepLabels.length - 1 && (
                      <div className={`lp-step-connector${i < currentStepDisplay - 1 ? ' done' : ''}`} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            {/* ── STEP 0: Role ── */}
            {signupStep === SIGNUP_STEP.ROLE && (
              <>
                <p className="lp-subtitle">{t('Who are you?')}</p>
                <div className="lp-roles">
                  {[
                    { value: 'customer', label: t('customer') || 'Customer',       icon: '👤', desc: 'Book services & track vehicles' },
                    { value: 'admin',    label: t('garageOwner') || 'Garage Owner', icon: '🏢', desc: 'Manage your own garage' },
                  ].map(r => (
                    <button
                      key={r.value}
                      type="button"
                      className={`lp-role-btn${signupRole === r.value ? ' active' : ''}`}
                      onClick={() => setSignupRole(r.value)}
                    >
                      <span className="lp-role-icon">{r.icon}</span>
                      <span className="lp-role-label">{r.label}</span>
                      <span className="lp-role-desc">{r.desc}</span>
                    </button>
                  ))}
                </div>
                {error && <div className="lp-alert" style={{ marginBottom: 12 }}>{error}</div>}
                <button className="lp-submit" onClick={handleSignupNext}>
                  {t('Continue')} <ChevronRight size={18} />
                </button>
              </>
            )}

            {/* ── STEP 1: Garage Selection ── */}
            {signupStep === SIGNUP_STEP.GARAGE && (
              <>
                <p className="lp-subtitle">{t('Select your garage')}</p>

                {/* Search */}
                <div className="lp-search-wrap">
                  <Search size={15} className="lp-search-icon" />
                  <input
                    className="lp-input"
                    style={{ paddingLeft: 36 }}
                    type="text"
                    placeholder="Search garage by name or location..."
                    value={garageSearch}
                    onChange={e => setGarageSearch(e.target.value)}
                  />
                </div>

                {garagesLoading && (
                  <div className="lp-loading">
                    <span className="loader-spinner xsmall" style={{ display: 'inline-block', marginBottom: 6 }} />
                    <p style={{ margin: 0 }}>Loading garages…</p>
                  </div>
                )}

                {garagesError && !garagesLoading && (
                  <div className="lp-error-box">
                    ⚠ {garagesError}
                    <br />
                    <button className="lp-cancel-btn" style={{ margin: '6px auto 0', display: 'inline-block', width: 'auto', padding: '4px 10px' }}
                      onClick={() => {
                        setGaragesLoading(true); setGaragesError('');
                        api.getActiveGarages().then(d => setGarages(Array.isArray(d) ? d : [])).catch(e => setGaragesError(e.message)).finally(() => setGaragesLoading(false));
                      }}>Retry</button>
                  </div>
                )}

                {!garagesLoading && !garagesError && filteredGarages.length === 0 && (
                  <div className="lp-empty">
                    <Building2 size={34} style={{ marginBottom: 8, opacity: 0.35 }} />
                    <p style={{ margin: 0 }}>{garageSearch ? 'No garages match your search.' : 'No active garages available.'}</p>
                  </div>
                )}

                {!garagesLoading && !garagesError && filteredGarages.length > 0 && (
                  <div className="lp-garage-list">
                    {filteredGarages.map(g => {
                      const sel = selectedGarageId === g.id;
                      return (
                        <div
                          key={g.id}
                          className={`lp-garage-card${sel ? ' selected' : ''}`}
                          onClick={() => setSelectedGarageId(g.id)}
                        >
                          <div className={`lp-garage-avatar${sel ? ' selected' : ''}`}>
                            {g.logoUrl
                              ? <img src={g.logoUrl} alt={g.name} />
                              : g.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="lp-garage-info">
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                              <span className="lp-garage-name">{g.name}</span>
                              {sel && <CheckCircle2 size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />}
                            </div>
                            {g.description && <p className="lp-garage-desc">{g.description}</p>}
                            <div className="lp-garage-meta">
                              {g.address && (
                                <span className="lp-garage-meta-item"><MapPin size={10} />{g.address}</span>
                              )}
                              {g.phone && (
                                <span className="lp-garage-meta-item"><Phone size={10} />{g.phone}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {error && <div className="lp-alert" style={{ marginTop: 8 }}>{error}</div>}

                <div className="lp-btn-row" style={{ marginTop: 14 }}>
                  <button type="button" className="lp-back-btn" onClick={handleSignupBack}>
                    <ChevronLeft size={16} />{t('Back')}
                  </button>
                  <button
                    type="button"
                    className="lp-submit"
                    style={{ opacity: selectedGarageId ? 1 : 0.55 }}
                    onClick={handleSignupNext}
                  >
                    {t('Continue')} <ChevronRight size={18} />
                  </button>
                </div>
              </>
            )}

            {/* ── STEP 2: Services Preview ── */}
            {signupStep === SIGNUP_STEP.SERVICES && selectedGarageObj && (
              <>
                <p className="lp-subtitle">
                  {t('Services offered by')}: <strong style={{ color: 'var(--primary)' }}>{selectedGarageObj.name}</strong>
                </p>

                {/* Garage summary */}
                <div className="lp-services-header">
                  <div className={`lp-garage-avatar selected`} style={{ width: 46, height: 46 }}>
                    {selectedGarageObj.logoUrl
                      ? <img src={selectedGarageObj.logoUrl} alt={selectedGarageObj.name} />
                      : selectedGarageObj.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <strong style={{ color: 'var(--primary)', fontSize: '0.95rem' }}>{selectedGarageObj.name}</strong>
                    {selectedGarageObj.address && (
                      <p style={{ margin: '2px 0 0', fontSize: '0.75rem', opacity: 0.55, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <MapPin size={11} />{selectedGarageObj.address}
                      </p>
                    )}
                  </div>
                </div>

                {/* Services */}
                <div style={{ borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden', marginBottom: 4 }}>
                  <div className="lp-services-title">⭐ {t('Our Services')}</div>
                  <div className="lp-services-body">
                    {selectedGarageObj.services
                      ? <pre className="lp-services-text">{selectedGarageObj.services}</pre>
                      : <p style={{ margin: 0, opacity: 0.45, fontSize: '0.82rem', textAlign: 'center', padding: '8px 0' }}>{t('No service list provided by this garage.')}</p>
                    }
                  </div>
                </div>

                <div className="lp-btn-row" style={{ marginTop: 14 }}>
                  <button type="button" className="lp-back-btn" onClick={handleSignupBack}>
                    <ChevronLeft size={16} />{t('Back')}
                  </button>
                  <button type="button" className="lp-submit" onClick={handleSignupNext}>
                    {t('Continue')} <ChevronRight size={18} />
                  </button>
                </div>
              </>
            )}

            {/* ── STEP 3 (or 1 for admin): Account Form ── */}
            {signupStep === SIGNUP_STEP.FORM && (
              <form className="lp-form" onSubmit={handleSignup}>
                {/* Selected garage badge */}
                {signupRole !== 'admin' && selectedGarageObj && (
                  <div className="lp-garage-badge">
                    <CheckCircle2 size={15} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                    <span className="lp-garage-badge-name">{selectedGarageObj.name}</span>
                    <button type="button" className="lp-garage-badge-change" onClick={() => setSignupStep(SIGNUP_STEP.GARAGE)}>Change</button>
                  </div>
                )}

                <div className="lp-field">
                  <label>{t('name')}</label>
                  <input className="lp-input" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="John Doe" required />
                </div>

                {signupRole === 'admin' && (
                  <div className="lp-field">
                    <label>{t('garageName')}</label>
                    <input className="lp-input" type="text" value={garageName} onChange={e => setGarageName(e.target.value)} placeholder="e.g. Addis Garage" required />
                  </div>
                )}

                <div className="lp-field">
                  <label>{t('email')} ({t('Opt.')})</label>
                  <input className="lp-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
                </div>

                <div className="lp-field">
                  <label>{t('phone')} ({t('required')})</label>
                  <div className="lp-phone-wrap">
                    <PhoneInput
                      value={signupPhone}
                      onChange={(val, valid) => { setSignupPhone(val); setSignupPhoneValid(valid); }}
                      required={true}
                    />
                  </div>
                </div>

                <div className="lp-field">
                  <label>{t('address')} ({t('Opt.')})</label>
                  <input className="lp-input" type="text" value={address} onChange={e => setAddress(e.target.value)} placeholder="e.g. Bole, Addis Ababa" />
                </div>

                <div className="lp-field">
                  <label>{t('password')}</label>
                  <input className="lp-input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required autoComplete="new-password" />
                </div>

                <div className="lp-field">
                  <label>{t('confirmPassword')}</label>
                  <input className="lp-input" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" required autoComplete="new-password" />
                </div>

                {error && <div className="lp-alert">{error}</div>}

                <div className="lp-btn-row">
                  <button type="button" className="lp-back-btn" onClick={handleSignupBack}>
                    <ChevronLeft size={16} />{t('Back')}
                  </button>
                  <button type="submit" className="lp-submit" disabled={loading}>
                    {loading ? <span className="loader-spinner xsmall" /> : `${t('createAccount')} →`}
                  </button>
                </div>
              </form>
            )}
          </>
        )}

      </div>

      {/* SMS Toast */}
      {showSmsToast && (
        <div className="lp-sms-toast">
          <div className="lp-sms-icon"><MessageSquare size={18} /></div>
          <div className="lp-sms-content">
            <h4>MechPro Messages</h4>
            <p>Your verification code is: <strong>{verificationCode}</strong></p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
