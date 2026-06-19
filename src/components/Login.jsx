import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';
import { Wrench, Globe, MessageSquare } from 'lucide-react';
import PhoneInput from './PhoneInput';
import './Login.css';

const ROLES = [
  { value: 'customer', label: 'customer', icon: '👤' },
  { value: 'admin', label: 'garageOwner', icon: '🏢' },
];

const Login = () => {
  const { login, register, getAccounts, resetPassword, requestPasswordReset, verifyResetOtp, generateNextGarageId } = useAuth();
  const { t, language, setLanguage } = useAppContext();
  const [tab, setTab] = useState('login'); // 'login' | 'signup'
  const [error, setError] = useState('');

  // Form states
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPhone, setLoginPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loginMethod, setLoginMethod] = useState('email'); // 'email' | 'phone'
  const [isPhoneValid, setIsPhoneValid] = useState(true);
  const [rememberMe, setRememberMe] = useState(true);
  const [address, setAddress] = useState('');
  const [role, setRole] = useState('customer');
  const [garageName, setGarageName] = useState('');
  const [selectedGarage, setSelectedGarage] = useState('');
  const [generatedGarageId, setGeneratedGarageId] = useState('');

  const [availableGarages, setAvailableGarages] = useState([]);
  const [accountMap, setAccountMap] = useState([]); // Cache for fast ID lookups
  const [garageSearch, setGarageSearch] = useState('');
  const [isGarageDropdownOpen, setIsGarageDropdownOpen] = useState(false);

  // Persistence: Pre-fill remembered data
  useEffect(() => {
    const savedId = localStorage.getItem('garage_remembered_id');
    const savedGarage = localStorage.getItem('garage_remembered_garage');
    const savedMethod = localStorage.getItem('garage_remembered_method') || 'email';
    const savedGarageName = localStorage.getItem('garage_remembered_garage_name');

    if (savedMethod === 'email') {
      if (savedId) setLoginEmail(savedId);
    } else {
      if (savedId) setLoginPhone(savedId);
    }
    if (savedGarage) setSelectedGarage(savedGarage);
    if (savedGarageName) setGarageSearch(savedGarageName);
  }, []);

  useEffect(() => {
    if (tab === 'signup' && role === 'admin') {
      setGeneratedGarageId(generateNextGarageId());
    }
  }, [tab, role, generateNextGarageId]);

  // Verification State
  const [verificationCode, setVerificationCode] = useState('');
  const [userCodeInput, setUserCodeInput] = useState('');
  const [showSmsToast, setShowSmsToast] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  useEffect(() => {
    const accounts = getAccounts();
    // Get unique list of admin-owned garages with their IDs
    const garages = accounts
      .filter(a => a.role === 'admin' || a.id === a.ownerId)
      .map(a => ({ id: a.ownerId, name: a.garageName }));

    // De-duplicate by ownerId
    const uniqueGarages = Array.from(new Map(garages.map(g => [g.id, g])).values());

    // Always ensure 0001 is an option if any data exists for it, to prevent "locked out" scenarios
    if (!uniqueGarages.find(g => g.id === '0001')) {
      uniqueGarages.unshift({ id: '0001', name: 'Miky Garage (Primary)' });
    }

    setAvailableGarages(uniqueGarages);
    setAccountMap(accounts.map(a => ({ email: a.email, phone: a.phone, ownerId: a.ownerId, garageName: a.garageName })));
  }, [getAccounts]);

  const filteredGarages = React.useMemo(() => {
    return availableGarages.filter(g =>
      g.name.toLowerCase().includes(garageSearch.toLowerCase()) ||
      g.id.includes(garageSearch)
    );
  }, [availableGarages, garageSearch]);

  const handleLogin = (e) => {
    e.preventDefault();
    setError('');

    const finalIdentifier = loginEmail || loginPhone;
    if (!finalIdentifier) {
      setError(t("Please provide email or phone."));
      return;
    }

    if (loginPhone && !isPhoneValid) {
      setError(t("Please enter a valid Ethiopian phone number (e.g. 09... or 07...)"));
      return;
    }

    const result = login(finalIdentifier, password, selectedGarage, role);
    if (!result.success) {
      setError(result.message);
    } else {
      // Save for Remember Me
      if (rememberMe) {
        localStorage.setItem('garage_remembered_id', finalIdentifier);
        localStorage.setItem('garage_remembered_garage', selectedGarage);
        localStorage.setItem('garage_remembered_method', loginEmail ? 'email' : 'phone');
        localStorage.setItem('garage_remembered_garage_name', garageSearch);
      } else {
        localStorage.removeItem('garage_remembered_id');
        localStorage.removeItem('garage_remembered_garage');
        localStorage.removeItem('garage_remembered_method');
        localStorage.removeItem('garage_remembered_garage_name');
      }
    }
  };

  const handleSignup = (e) => {
    e.preventDefault();
    setError('');

    if (role === 'customer' && !selectedGarage) {
      setError(t("Please select a garage from the dropdown."));
      return;
    }

    if (!email && !phone) {
      setError(t('provideEmailOrPhone'));
      return;
    }

    if (!isPhoneValid) {
      setError('Please enter a valid phone number.');
      return;
    }

    if (password.length < 6) {
      setError(t('passwordMinChar'));
      return;
    }

    if (password !== confirmPassword) {
      setError(t('passwordsDoNotMatch'));
      return;
    }

    // For admins, garageName is their new garage
    let finalGarage = garageName;
    let ownerId = null;

    if (role === 'admin') {
      ownerId = generatedGarageId;
    } else {
      const selected = availableGarages.find(g => g.id === selectedGarage);
      finalGarage = selected ? selected.name : '';
      ownerId = selectedGarage;
    }

    const result = register(name, email, phone, password, role, finalGarage, ownerId, true, address);
    if (!result.success) setError(result.message);
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
    } else {
      setError(result.message);
    }
  };

  const handleReset = (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    const finalIdentifier = loginEmail || loginPhone;
    const result = resetPassword(finalIdentifier, password);
    if (result.success) {
      alert(result.message);
      setTab('login');
      setPassword('');
      setVerificationCode('');
      setUserCodeInput('');
    } else {
      setError(result.message);
    }
  };

  const toggleLanguage = () => {
    setLanguage(t("am"));
  };

  // Roles available for login (includes mechanic)
  const LOGIN_ROLES = [
    { value: 'customer', label: 'customer', icon: '🚗' },
    { value: 'mechanic', label: 'mechanic', icon: '🔧' },
    { value: 'cashier', label: 'cashier', icon: '💰' },
    { value: 'inventoryManager', label: 'inventoryManager', icon: '🔩' },
    { value: 'manager', label: 'manager', icon: '👔' },
    { value: 'admin', label: 'admin', icon: '👑' },
  ];

  return (
    <div className="auth-page">
      <div className="auth-card">
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
            onClick={() => { setTab('login'); setError(''); setRole('customer'); }}
          >
            {t('signIn')}
          </button>
          <button
            className={`auth-tab ${tab === 'signup' ? 'active' : ''}`}
            onClick={() => { setTab('signup'); setError(''); setRole('customer'); }}
          >
            {t('createAccount')}
          </button>
        </div>

        {tab === 'login' ? (
          <>
            <p className="auth-subtitle">{t('loginSubtitle')}</p>
            <form className="auth-form" onSubmit={handleLogin}>
              <div className="auth-form-group">
                <label>{t('role')}</label>
                <div className="role-selector">
                  {LOGIN_ROLES.map(r => (
                    <button
                      key={r.value}
                      type="button"
                      className={`role-btn ${role === r.value ? 'active' : ''}`}
                      onClick={() => setRole(r.value)}
                    >
                      <span className="role-icon">{r.icon}</span>
                      <span className="role-label">{t(r.label)}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="auth-form-group">
                <label>{t('email')}</label>
                <input
                  className="auth-input"
                  type="email"
                  value={loginEmail}
                  onChange={e => {
                    const val = e.target.value;
                    setLoginEmail(val);
                    if (val) setLoginPhone(''); // Clear other
                    // Proactive ID matching using cached data
                    const matches = accountMap.filter(a => a.email && a.email.toLowerCase() === val.toLowerCase());
                    if (matches.length === 1 && matches[0].ownerId) {
                      setSelectedGarage(matches[0].ownerId);
                      setGarageSearch(`${matches[0].garageName} (${matches[0].ownerId})`);
                    }
                  }}
                  placeholder="you@example.com"
                />
              </div>

              <div className="auth-divider">
                <span>{t("OR")}</span>
              </div>

              <div className="auth-form-group">
                <label>{t('phone')}</label>
                <PhoneInput
                  value={loginPhone}
                  onChange={(val, valid) => {
                    setLoginPhone(val);
                    if (val) setLoginEmail(''); // Clear other
                    setIsPhoneValid(valid);
                    // Proactive ID matching using cached data
                    const matches = accountMap.filter(a => a.phone === val);
                    if (matches.length === 1 && matches[0].ownerId) {
                      setSelectedGarage(matches[0].ownerId);
                      setGarageSearch(`${matches[0].garageName} (${matches[0].ownerId})`);
                    }
                  }}
                />
              </div>

              <div className="auth-form-group">
                <label>{t('garageName')} (ID)</label>
                <div className="searchable-garage-selector" style={{ position: 'relative' }}>
                  <input
                    className="auth-input"
                    type="text"
                    value={garageSearch}
                    onChange={(e) => {
                      setGarageSearch(e.target.value);
                      setSelectedGarage(''); // Clear on type
                      setIsGarageDropdownOpen(true);
                    }}
                    onFocus={() => setIsGarageDropdownOpen(true)}
                    placeholder={t('searchGaragePlaceholder')}
                  />
                  {isGarageDropdownOpen && (
                    <div className="garage-dropdown-results glass-panel" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, maxHeight: '200px', overflowY: 'auto', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', marginTop: '4px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
                      {filteredGarages.map(g => (
                        <div
                          key={g.id}
                          className="garage-dropdown-item"
                          style={{ padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                          onClick={() => {
                            setSelectedGarage(g.id);
                            setGarageSearch(`${g.name} (${g.id})`);
                            setIsGarageDropdownOpen(false);
                          }}
                        >
                          <strong>{g.name}</strong> <span style={{ opacity: 0.5 }}>- {g.id}</span>
                        </div>
                      ))}
                      {filteredGarages.length === 0 && (
                        <div style={{ padding: '10px 16px', opacity: 0.5 }}>{t('noGaragesFound')}</div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="auth-form-group">
                <label>{t('password')}</label>
                <input
                  className="auth-input"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
              </div>

              <div className="auth-options">
                <label className="remember-me">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <span>{t("Remember me")}</span>
                </label>
                <button
                  type="button"
                  className="btn-text-small"
                  style={{ fontSize: '0.8rem', opacity: 0.8 }}
                  onClick={() => { setTab('forgot'); setError(''); }}
                >
                  {t("Forgot Password?")}
                </button>
              </div>
              {error && <div className="auth-error">{error}</div>}
              <button type="submit" className="auth-submit-btn">{t('signIn')} →</button>
            </form>
          </>
        ) : tab === 'forgot' ? (
          <>
            <p className="auth-subtitle">
              {t("Securely reset your password using your recovery contact")}
            </p>
            <form className="auth-form" onSubmit={handleReset}>
              <div className="auth-form-group">
                <label>{t('email')}</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input
                    className="auth-input"
                    type="email"
                    placeholder="you@example.com"
                    value={loginEmail}
                    onChange={e => {
                      setLoginEmail(e.target.value);
                      if (e.target.value) setLoginPhone('');
                    }}
                    disabled={verificationCode && !error.includes('expired')}
                  />
                  {(!verificationCode || error.includes('expired')) && (
                    <button
                      type="button"
                      className="btn-primary-small"
                      disabled={resendCooldown > 0}
                      onClick={handleSendOtp}
                    >
                      {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : (t("Send Code"))}
                    </button>
                  )}
                </div>
              </div>

              <div className="auth-divider">
                <span>{t("OR")}</span>
              </div>

              <div className="auth-form-group">
                <label>{t('phone')}</label>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <PhoneInput
                      value={loginPhone}
                      onChange={(val, valid) => {
                        setLoginPhone(val);
                        if (val) setLoginEmail('');
                        setIsPhoneValid(valid);
                      }}
                    />
                  </div>
                  {(!verificationCode || error.includes('expired')) && (
                    <button
                      type="button"
                      className="btn-primary-small"
                      style={{ height: '52px', marginTop: '0' }}
                      disabled={resendCooldown > 0 || !isPhoneValid}
                      onClick={handleSendOtp}
                    >
                      {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : (t("Send Code"))}
                    </button>
                  )}
                </div>
              </div>

              {(verificationCode && !error.includes('Verified')) && (
                <div className="auth-form-group">
                  <label>{t("Verification Code")}</label>
                  <input
                    className="auth-input"
                    type="text"
                    placeholder="______"
                    maxLength="6"
                    required
                    value={userCodeInput}
                    onChange={e => {
                      const val = e.target.value;
                      setUserCodeInput(val);
                      if (val.length === 6) {
                        const finalIdentifier = loginEmail || loginPhone;
                        const res = verifyResetOtp(finalIdentifier, val);
                        if (res.success) {
                          setError('Verified! Create your new password.');
                          setPassword('');
                        } else {
                          setError(res.message);
                        }
                      }
                    }}
                  />
                </div>
              )}

              {error.includes('Verified') && (
                <>
                  <div className="auth-form-group">
                    <label>{t("New Password")}</label>
                    <input
                      className="auth-input"
                      type="password"
                      placeholder="••••••••"
                      required
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                    />
                  </div>
                  <div className="auth-form-group">
                    <label>{t("Confirm New Password")}</label>
                    <input
                      className="auth-input"
                      type="password"
                      placeholder="••••••••"
                      required
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                    />
                  </div>
                </>
              )}

              {error && !error.includes('Enter code') && (
                <div className={`auth-error ${error.includes('Verified') || error.includes('sent') ? 'success' : ''}`}>
                  {error.includes('sent') ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <strong>{t("CODE SENT")}</strong>
                      <span>{error}</span>
                    </div>
                  ) : error}
                </div>
              )}

              {error.includes('Verified') && (
                <button type="submit" className="auth-submit-btn">
                  {t("Save New Password")}
                </button>
              )}

              <button type="button" className="btn-text" style={{ width: '100%', marginTop: 10 }} onClick={() => { setTab('login'); setLoginEmail(''); setLoginPhone(''); setPassword(''); setError(''); }}>
                {t('cancel')}
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="auth-subtitle">{t('signupSubtitle')}</p>
            <form className="auth-form" onSubmit={handleSignup}>

              <div className="auth-form-group">
                <label>{t('role')}</label>
                <div className="role-selector">
                  {ROLES.map(r => (
                    <button
                      key={r.value}
                      type="button"
                      className={`role-btn ${role === r.value ? 'active' : ''}`}
                      onClick={() => setRole(r.value)}
                    >
                      <span className="role-icon">{r.icon}</span>
                      <span className="role-label">{t(r.label)}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="auth-form-group">
                <label>{t('name')}</label>
                <input
                  className="auth-input"
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="John Doe"
                  required
                />
              </div>

              {role === 'admin' ? (
                <>
                  <div className="auth-form-group">
                    <label>{t('garageName')}</label>
                    <input
                      className="auth-input"
                      type="text"
                      value={garageName}
                      onChange={e => setGarageName(e.target.value)}
                      placeholder="e.g. Addis Garage"
                      required
                    />
                  </div>
                  <div className="auth-form-group">
                    <label>{t('Garage ID') || 'Garage ID'}</label>
                    <input
                      className="auth-input"
                      type="text"
                      value={generatedGarageId}
                      readOnly
                      style={{
                        backgroundColor: 'var(--bg-main)',
                        opacity: 0.8,
                        cursor: 'not-allowed',
                        fontWeight: 'bold',
                        letterSpacing: '2px',
                        color: 'var(--primary)'
                      }}
                    />
                    <small style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                      {t("This ID is auto-generated and permanently assigned to your new garage.") || "This ID is auto-generated and permanently assigned to your new garage."}
                    </small>
                  </div>
                </>
              ) : (
                <div className="auth-form-group">
                  <label>{t('selectGarage')}</label>
                  <div className="searchable-garage-selector" style={{ position: 'relative' }}>
                    <input
                      className="auth-input"
                      type="text"
                      value={garageSearch}
                      onChange={(e) => {
                        setGarageSearch(e.target.value);
                        setSelectedGarage(''); // Clear selection if typing
                        setIsGarageDropdownOpen(true);
                      }}
                      onFocus={() => setIsGarageDropdownOpen(true)}
                      placeholder={t('searchGaragePlaceholder')}
                      required
                    />
                    {isGarageDropdownOpen && (
                      <div className="garage-dropdown-results glass-panel" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, maxHeight: '200px', overflowY: 'auto', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', marginTop: '4px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
                        {filteredGarages.map(g => (
                          <div
                            key={g.id}
                            className="garage-dropdown-item"
                            style={{ padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                            onClick={() => {
                              setSelectedGarage(g.id);
                              setGarageSearch(`${g.name} (${g.id})`);
                              setIsGarageDropdownOpen(false);
                            }}
                          >
                            <strong>{g.name}</strong> <span style={{ opacity: 0.5 }}>- {g.id}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="auth-form-group">
                <label>{t('email')} ({t("Opt.")})</label>
                <input
                  className="auth-input"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>

              <div className="auth-form-group">
                <label>{t('phone')} ({t('required')})</label>
                <PhoneInput
                  value={phone}
                  onChange={(val, valid) => {
                    setPhone(val);
                    setIsPhoneValid(valid);
                  }}
                  required={true}
                />
              </div>

              <div className="auth-form-group">
                <label>{t('address')} ({t("Opt.")})</label>
                <input
                  className="auth-input"
                  type="text"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="e.g. Bole, Addis Ababa"
                />
              </div>

              <div className="auth-form-group">
                <label>{t('password')}</label>
                <input
                  className="auth-input"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                />
              </div>

              <div className="auth-form-group">
                <label>{t('confirmPassword')}</label>
                <input
                  className="auth-input"
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                />
              </div>

              {error && <div className="auth-error">{error}</div>}
              <button type="submit" className="auth-submit-btn">{t('createAccount')} →</button>
            </form>
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
