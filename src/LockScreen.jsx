import React, { useState } from 'react';
import { Lock, Eye, EyeOff, HelpCircle, KeyRound, CheckCircle, XCircle } from 'lucide-react';
import './LockScreen.css';
import { useLanguage } from './LanguageContext.jsx';

// Ekran modları
const SCREEN = { LOGIN: 'login', SECRET: 'secret', RESET: 'reset', RESET_OK: 'reset_ok', ADMIN: 'admin', ADMIN_OK: 'admin_ok' };

const LockScreen = ({ secretQuestion, onUnlock }) => {
  const { t } = useLanguage();
  const [screen, setScreen] = useState(SCREEN.LOGIN);

  // Giriş
  const [password, setPassword] = useState('');
  const [pwdVisible, setPwdVisible] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Gizli soru
  const [answer, setAnswer] = useState('');
  const [secretError, setSecretError] = useState('');
  const [secretLoading, setSecretLoading] = useState(false);

  // Yeni parola
  const [newPwd, setNewPwd] = useState('');
  const [newPwd2, setNewPwd2] = useState('');
  const [newPwdVisible, setNewPwdVisible] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  // Yönetici girişi
  const [adminPwd, setAdminPwd] = useState('');
  const [adminError, setAdminError] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);

  // ── GİRİŞ ──────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!password) return;
    setLoginLoading(true);
    setLoginError('');
    const ok = await window.electronAPI.verifyPassword(password);
    if (ok) {
      onUnlock();
    } else {
      setLoginError('Hatalı parola. Lütfen tekrar deneyin.');
    }
    setLoginLoading(false);
  };

  // ── GİZLİ SORU ─────────────────────────
  const handleSecretCheck = async (e) => {
    e.preventDefault();
    if (!answer.trim()) return;
    setSecretLoading(true);
    setSecretError('');
    const ok = await window.electronAPI.verifySecretAnswer(answer);
    if (ok) {
      setScreen(SCREEN.RESET);
    } else {
      setSecretError('Cevap yanlış. Lütfen tekrar deneyin.');
    }
    setSecretLoading(false);
  };

  // ── YENİ PAROLA ─────────────────────────
  const handleReset = async (e) => {
    e.preventDefault();
    if (!newPwd || !newPwd2) return;
    if (newPwd !== newPwd2) {
      setResetError('Parolalar uyuşmamaktadır. Lütfen kontrol ediniz.');
      return;
    }
    setResetLoading(true);
    setResetError('');
    const result = await window.electronAPI.resetPassword(newPwd);
    if (result.success) {
      setScreen(SCREEN.RESET_OK);
    } else {
      setResetError('Parola sıfırlanamadı. Lütfen tekrar deneyin.');
    }
    setResetLoading(false);
  };

  // ―― YÖNETİCİ GİRİŞİ ――――――――――――――――――――――――
  const handleAdminLogin = async (e) => {
    e.preventDefault();
    if (!adminPwd) return;
    setAdminLoading(true);
    setAdminError('');
    const ok = await window.electronAPI.verifyAdminPassword(adminPwd);
    if (ok) {
      setScreen(SCREEN.ADMIN_OK);
    } else {
      setAdminError('Yanlış yönetici şifresi.');
    }
    setAdminLoading(false);
  };

  const handleAdminDisable = async () => {
    const result = await window.electronAPI.adminDisablePassword(adminPwd);
    if (result.success) onUnlock(); // Şifre kaldırıldı, ana ekrana geç
  };

  return (
    <div className="lock-overlay">
      <div className="lock-card">

        {/* Logo / Başlık */}
        <div className="lock-header">
          <div className="lock-logo-circle">
            <Lock size={28} />
          </div>
          <h1 className="lock-title">GAZİBURMA MUSTAFA</h1>
          <p className="lock-subtitle">Sipariş Takip Sistemi</p>
        </div>

        {/* ── GİRİŞ EKRANI ── */}
        {screen === SCREEN.LOGIN && (
          <form className="lock-form" onSubmit={handleLogin}>
            <div className="lock-field">
              <label>Parola</label>
              <div className="lock-input-wrap">
                <input
                  type={pwdVisible ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={t('lockPasswordPlaceholder')}
                  autoFocus
                />
                <button type="button" className="eye-btn" onClick={() => setPwdVisible(v => !v)}>
                  {pwdVisible ? <Eye size={18} /> : <EyeOff size={18} />}
                </button>
              </div>
            </div>

            {loginError && (
              <div className="lock-error">
                <XCircle size={15} /> {loginError}
              </div>
            )}

            <button type="submit" className="lock-btn" disabled={loginLoading || !password}>
              {loginLoading ? t('lockLogging') : t('lockLogin')}
            </button>

            <button
              type="button"
              className="lock-forgot"
              onClick={() => { setScreen(SCREEN.SECRET); setLoginError(''); }}
            >
              <HelpCircle size={14} /> {t('lockForgot')}
            </button>

            <button
              type="button"
              className="lock-forgot"
              onClick={() => { setScreen(SCREEN.ADMIN); setLoginError(''); }}
              style={{ marginTop: '-6px', color: '#475569' }}
            >
              <KeyRound size={14} /> {t('lockAdminEntry')}
            </button>
          </form>
        )}

        {/* ── GİZLİ SORU EKRANI ── */}
        {screen === SCREEN.SECRET && (
          <form className="lock-form" onSubmit={handleSecretCheck}>
            <p className="lock-question-label">{t('lockSecretQuestion')}</p>
            <p className="lock-question-text">{secretQuestion || '(Gizli soru tanımlanmamış)'}</p>

            <div className="lock-field">
              <label>{t('lockSecretAnswer')}</label>
              <div className="lock-input-wrap">
                <input
                  type="text"
                  value={answer}
                  onChange={e => setAnswer(e.target.value)}
                  placeholder={t('lockSecretAnswerPlaceholder')}
                  autoFocus
                />
              </div>
            </div>

            {secretError && (
              <div className="lock-error">
                <XCircle size={15} /> {secretError}
              </div>
            )}

            <button type="submit" className="lock-btn" disabled={secretLoading || !answer.trim()}>
              {secretLoading ? t('verifying') : t('lockSecretContinue')}
            </button>

            <button type="button" className="lock-forgot" onClick={() => setScreen(SCREEN.LOGIN)}>
              {t('lockBackToLogin')}
            </button>
          </form>
        )}

        {/* ── YENİ PAROLA EKRANI ── */}
        {screen === SCREEN.RESET && (
          <form className="lock-form" onSubmit={handleReset}>
            <div className="lock-field">
              <label>{t('lockNewPassword')}</label>
              <div className="lock-input-wrap">
                <input
                  type={newPwdVisible ? 'text' : 'password'}
                  value={newPwd}
                  onChange={e => setNewPwd(e.target.value)}
                  placeholder={t('lockNewPasswordPlaceholder')}
                  autoFocus
                />
                <button type="button" className="eye-btn" onClick={() => setNewPwdVisible(v => !v)}>
                  {newPwdVisible ? <Eye size={18} /> : <EyeOff size={18} />}
                </button>
              </div>
            </div>

            <div className="lock-field">
              <label>{t('lockNewPasswordRepeat')}</label>
              <div className="lock-input-wrap">
                <input
                  type={newPwdVisible ? 'text' : 'password'}
                  value={newPwd2}
                  onChange={e => setNewPwd2(e.target.value)}
                  placeholder={t('lockNewPasswordRepeatPlaceholder')}
                />
              </div>
            </div>

            {resetError && (
              <div className="lock-error">
                <XCircle size={15} /> {resetError}
              </div>
            )}

            <button type="submit" className="lock-btn" disabled={resetLoading || !newPwd || !newPwd2}>
              {resetLoading ? t('lockSaving') : t('lockSavePassword')}
            </button>
          </form>
        )}

        {/* ―― YÖNETİCİ ŞİFRESİ EKRANI ―― */}
        {screen === SCREEN.ADMIN && (
          <form className="lock-form" onSubmit={handleAdminLogin}>
            <div className="lock-field">
              <label>{t('lockAdminPasswordLabel')}</label>
              <div className="lock-input-wrap">
                <input
                  type="password"
                  value={adminPwd}
                  onChange={e => setAdminPwd(e.target.value)}
                  placeholder={t('lockAdminPasswordPlaceholder')}
                  autoFocus
                />
              </div>
            </div>
            {adminError && (
              <div className="lock-error"><XCircle size={15} /> {adminError}</div>
            )}
            <button type="submit" className="lock-btn" disabled={adminLoading || !adminPwd}>
              {adminLoading ? t('lockAdminLogin') : t('lockAdminLogin')}
            </button>
            <button type="button" className="lock-forgot" onClick={() => setScreen(SCREEN.LOGIN)}>
              {t('lockBackToLogin')}
            </button>
          </form>
        )}

        {/* ―― YÖNETİCİ ONAYLADI ―― */}
        {screen === SCREEN.ADMIN_OK && (
          <div className="lock-form lock-success-screen">
            <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '16px', textAlign: 'center' }}>
              {t('lockAdminVerified')}
            </p>
            <button
              className="lock-btn"
              style={{ background: 'linear-gradient(135deg,#ef4444,#b91c1c)', boxShadow: '0 4px 16px rgba(239,68,68,0.4)' }}
              onClick={handleAdminDisable}
            >
              {t('lockAdminDisable')}
            </button>
          </div>
        )}

        {/* ―― SIFIRLAMA BAŞARILI ―― */}
        {screen === SCREEN.RESET_OK && (
          <div className="lock-form lock-success-screen">
            <div className="lock-success-icon"><CheckCircle size={48} /></div>
            <p className="lock-success-msg">Parola başarıyla sıfırlandı!</p>
            <button
              className="lock-btn"
              onClick={() => { setScreen(SCREEN.LOGIN); setPassword(''); setNewPwd(''); setNewPwd2(''); }}
            >
              <KeyRound size={16} /> {t('lockGoToLogin')}
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default LockScreen;
