import React, { useState, useEffect, useRef } from 'react';
import { 
  Settings2, 
  Monitor, 
  Printer, 
  KeyRound, 
  RefreshCw,
  FileText,
  ShieldAlert,
  X,
  Power,
  CheckCircle,
  Wifi,
  Usb,
  Loader2,
  Eye,
  EyeOff,
  Globe
} from 'lucide-react';
import './Settings.css';
import { useLanguage } from './LanguageContext.jsx';

const Settings = () => {
  const { lang, setLang, t } = useLanguage();
  const [activeTab, setActiveTab] = useState('hat');

  // Yazıcı state'leri
  const [printers, setPrinters] = useState([]);
  const [selectedPrinter, setSelectedPrinter] = useState(null);
  const [savedPrinter, setSavedPrinter] = useState(null);
  const [loadingPrinters, setLoadingPrinters] = useState(false);
  const [loadingTestPrint, setLoadingTestPrint] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testPrintSuccess, setTestPrintSuccess] = useState(false);
  const [flashAlert, setFlashAlert] = useState(false);
  const flashTimerRef = useRef(null);

  // Hat Numaraları state'i
  const [hatNumbers, setHatNumbers] = useState({ 1: '', 2: '', 3: '' });
  const [hatSaveSuccess, setHatSaveSuccess] = useState(false);

  // Hat numaralarını yükle
  useEffect(() => {
    if (window.electronAPI?.getHatNumbers) {
      window.electronAPI.getHatNumbers().then(nums => setHatNumbers(nums || { 1: '', 2: '', 3: '' }));
    }
  }, []);

  // Tema state'i
  const [selectedTheme, setSelectedTheme] = useState('light');
  const [themeSaveSuccess, setThemeSaveSuccess] = useState(false);

  // Versiyon state'i
  const [versionStr, setVersionStr] = useState('V1.0.0');
  const [versionDate, setVersionDate] = useState('');
  const [versionSaveSuccess, setVersionSaveSuccess] = useState(false);

  // Versiyon bilgisini yükle
  useEffect(() => {
    if (window.electronAPI?.getVersion) {
      window.electronAPI.getVersion().then(info => {
        if (info) {
          setVersionStr(info.version || 'V1.0.0');
          setVersionDate(info.date || '');
        }
      });
    }
  }, []);

  const handleSaveVersion = async () => {
    if (!window.electronAPI?.saveVersion) return;
    const result = await window.electronAPI.saveVersion({ version: versionStr, date: versionDate });
    if (result.success) {
      setVersionSaveSuccess(true);
      setTimeout(() => setVersionSaveSuccess(false), 3000);
    }
  };

  // Temayı yükle
  useEffect(() => {
    if (window.electronAPI?.getTheme) {
      window.electronAPI.getTheme().then(t => setSelectedTheme(t || 'light'));
    }
  }, []);

  const handleSaveTheme = async () => {
    if (!window.electronAPI?.saveTheme) return;
    const result = await window.electronAPI.saveTheme(selectedTheme);
    if (result.success) {
      setThemeSaveSuccess(true);
      setTimeout(() => setThemeSaveSuccess(false), 3000);
    }
  };

  // Seçim değiştiğinde anında önizleme yap
  const handleThemeSelect = (t) => {
    setSelectedTheme(t);
    document.documentElement.setAttribute('data-theme', t);
  };

  const handleSaveHatNumbers = async () => {
    if (!window.electronAPI?.saveHatNumbers) return;
    const result = await window.electronAPI.saveHatNumbers(hatNumbers);
    if (result.success) {
      setHatSaveSuccess(true);
      setTimeout(() => setHatSaveSuccess(false), 3000);
    }
  };

  // Telefon numarasını (XXX) XXX XX XX formatına dönüştür
  const formatHatPhone = (value) => {
    const digits = value.replace(/\D/g, '').slice(0, 10); // En fazla 10 rakam
    if (digits.length === 0) return '';
    if (digits.length <= 3) return `(${digits}`;
    if (digits.length <= 6) return `(${digits.slice(0,3)}) ${digits.slice(3)}`;
    if (digits.length <= 8) return `(${digits.slice(0,3)}) ${digits.slice(3,6)} ${digits.slice(6)}`;
    return `(${digits.slice(0,3)}) ${digits.slice(3,6)} ${digits.slice(6,8)} ${digits.slice(8)}`;
  };

  // Arka plan tıklandığında kırmızı gölge uyarısı
  useEffect(() => {
    if (!window.electronAPI?.onFlashAlert) return;
    const cleanup = window.electronAPI.onFlashAlert(() => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      setFlashAlert(true);
      flashTimerRef.current = setTimeout(() => setFlashAlert(false), 700);
    });
    return () => { cleanup(); if (flashTimerRef.current) clearTimeout(flashTimerRef.current); };
  }, []);

  // Parola yönetimi state'leri
  const [pwdEnabled, setPwdEnabled] = useState(false);
  const [pwdPassword, setPwdPassword] = useState('');
  const [pwdPassword2, setPwdPassword2] = useState('');
  const [pwdQuestion, setPwdQuestion] = useState('');
  const [pwdCustomQuestion, setPwdCustomQuestion] = useState(''); // Özel gizli soru
  const [pwdAnswer, setPwdAnswer] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState(false);
  const [pwdVisible, setPwdVisible] = useState(false);

  // Parola kaldırma onay modalı
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  const [disableConfirmPwd, setDisableConfirmPwd] = useState('');
  const [disableConfirmError, setDisableConfirmError] = useState('');
  const [disableConfirmLoading, setDisableConfirmLoading] = useState(false);

  // Gizli soru sabit listesi
  const CUSTOM_QUESTION_VALUE = '__custom__';
  const SECRET_QUESTIONS = [
    "Anne'nizin kızlık soyadı nedir?",
    'İlk evcil hayvanınızın adı nedir?',
    'Doğum yeriniz neresidir?',
    'İlk okul öğretmeninizin adı nedir?',
    'İlk otomobilinizin markası nedir?',
    'En sevdiğiniz çocukluk arkadaşınızın ismi nedir?',
    CUSTOM_QUESTION_VALUE
  ];
  const effectiveQuestion = pwdQuestion === CUSTOM_QUESTION_VALUE ? pwdCustomQuestion : pwdQuestion;

  // Yönetici girişi state'leri
  const [showAdminModal, setShowAdminModal] = useState(false);   // Ayarlar > Yönetici
  const [adminPwd, setAdminPwd] = useState('');
  const [adminPwdError, setAdminPwdError] = useState('');
  const [adminPwdLoading, setAdminPwdLoading] = useState(false);
  const [adminUnlocked, setAdminUnlocked] = useState(false);     // Şifre doğrulandı mı?
  const [adminDisableSuccess, setAdminDisableSuccess] = useState(false);

  const handleAdminLogin = async () => {
    if (!adminPwd) return;
    setAdminPwdLoading(true);
    setAdminPwdError('');
    const ok = await window.electronAPI.verifyAdminPassword(adminPwd);
    if (ok) {
      setAdminUnlocked(true);
    } else {
      setAdminPwdError('Yanlış yönetici şifresi. Lütfen tekrar deneyin.');
    }
    setAdminPwdLoading(false);
  };

  const handleAdminDisablePassword = async () => {
    const result = await window.electronAPI.adminDisablePassword(adminPwd);
    if (result.success) {
      setPwdEnabled(false); // Ayarlar'daki checkbox'u da kaldır
      setAdminDisableSuccess(true);
    }
  };

  // Checkbox değişem handlerı — parola aktifken kaldırmak parola ister
  const handlePwdCheckboxChange = async (e) => {
    const newVal = e.target.checked;
    if (!newVal && pwdEnabled) {
      // Parola aktifken devre dışı bırakma onayı iste
      setDisableConfirmPwd('');
      setDisableConfirmError('');
      setShowDisableConfirm(true);
    } else {
      setPwdEnabled(newVal);
    }
  };

  const handleConfirmDisable = async () => {
    if (!disableConfirmPwd) return;
    setDisableConfirmLoading(true);
    setDisableConfirmError('');
    const ok = await window.electronAPI.verifyPassword(disableConfirmPwd);
    if (ok) {
      // Parola korumasını kaldır
      await window.electronAPI.savePasswordConfig({ enabled: false, password: '', secretQuestion: '', secretAnswer: '' });
      setPwdEnabled(false);
      setShowDisableConfirm(false);
      setDisableConfirmPwd('');
      setPwdSuccess(false);
    } else {
      setDisableConfirmError('Hatalı parola. Lütfen tekrar deneyin.');
    }
    setDisableConfirmLoading(false);
  };

  // Parola config yükle
  useEffect(() => {
    if (window.electronAPI?.getPasswordConfig) {
      window.electronAPI.getPasswordConfig().then(cfg => {
        if (cfg) {
          setPwdEnabled(cfg.enabled || false);
          setPwdQuestion(cfg.secretQuestion || SECRET_QUESTIONS[0]);
        }
      });
    }
  }, []);

  const handleSavePassword = async () => {
    setPwdError('');
    setPwdSuccess(false);
    if (pwdEnabled) {
      if (!pwdPassword || !pwdPassword2 || !pwdQuestion || !pwdAnswer) {
        setPwdError('Lütfen tüm alanları doldurun.');
        return;
      }
      if (pwdPassword !== pwdPassword2) {
        setPwdError('Parolalar uyuşmamaktadır. Lütfen kontrol ediniz.');
        return;
      }
    }
    const result = await window.electronAPI.savePasswordConfig({
      enabled: pwdEnabled,
      password: pwdEnabled ? pwdPassword : '',
      secretQuestion: pwdEnabled ? effectiveQuestion : '',
      secretAnswer: pwdEnabled ? pwdAnswer : ''
    });
    if (result?.success) {
      setPwdSuccess(true);
      setPwdPassword('');
      setPwdPassword2('');
      setPwdAnswer('');
      setTimeout(() => setPwdSuccess(false), 4000);
    } else {
      setPwdError('Kaydedilemedi. Tekrar deneyin.');
    }
  };

  const handleClose = () => {
    if (window.electronAPI && window.electronAPI.closeSettings) {
      window.electronAPI.closeSettings();
    }
  };

  // Yazıcıları yükle
  const loadPrinters = async () => {
    if (!window.electronAPI) return;
    setLoadingPrinters(true);
    try {
      const [printerList, saved] = await Promise.all([
        window.electronAPI.getPrinters(),
        window.electronAPI.getPrinterSelection()
      ]);
      setPrinters(printerList || []);
      setSavedPrinter(saved);
      setSelectedPrinter(saved);
    } catch (error) {
      console.error('Yazıcı listesi yüklenemedi:', error);
    }
    setLoadingPrinters(false);
  };

  // Yazıcı sekmesine geçildiğinde yükle
  useEffect(() => {
    if (activeTab === 'yazici') {
      loadPrinters();
    }
  }, [activeTab]);

  // Sınama sayfası yazdır
  const handleTestPrint = async () => {
    if (!window.electronAPI || !selectedPrinter) return;
    setLoadingTestPrint(true);
    try {
      const result = await window.electronAPI.printTestPage(selectedPrinter);
      if (result.success) {
        setTestPrintSuccess(true);
        setTimeout(() => setTestPrintSuccess(false), 3000);
      } else {
        alert('Sınama sayfası yazılamadı: ' + result.error);
      }
    } catch (error) {
      console.error('Sınama sayfası yazdırma hatası:', error);
    }
    setLoadingTestPrint(false);
  };

  // Yazıcı seçimini kaydet
  const handleSavePrinter = async () => {
    if (!window.electronAPI || !selectedPrinter) return;
    try {
      const result = await window.electronAPI.savePrinterSelection(selectedPrinter);
      if (result.success) {
        setSavedPrinter(selectedPrinter);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (error) {
      console.error('Yazıcı kaydedilemedi:', error);
    }
  };

  const menuItems = [
    { id: 'hat', icon: Settings2, label: t('menuHat') },
    { id: 'ekran', icon: Monitor, label: t('menuScreen') },
    { id: 'yazici', icon: Printer, label: t('menuPrinter') },
    { id: 'parola', icon: KeyRound, label: t('menuPassword') },
    { id: 'dil', icon: Globe, label: t('menuLanguage') },
    { id: 'guncelleme', icon: RefreshCw, label: t('menuUpdate') },
    { id: 'log', icon: FileText, label: t('menuLog') },
    { id: 'yonetici', icon: ShieldAlert, label: t('menuAdmin') },
  ];

  const [showRestartModal, setShowRestartModal] = useState(false);
  const [langSaveSuccess, setLangSaveSuccess] = useState(false);
  const [pendingLang, setPendingLang] = useState(lang);

  const handleSaveLang = () => {
    // Dil değiştiyse sadece modalı aç — dili henüz kaydetme/uygulama
    if (pendingLang !== lang) {
      setShowRestartModal(true);
    }
  };

  // Yazıcı durumunu Türkçe göster
  const getPrinterStatusText = (status) => {
    switch (status) {
      case 0: return 'Hazır';
      case 1: return 'Meşgul';
      case 2: return 'Hata';
      default: return 'Bilinmiyor';
    }
  };

  const getPrinterStatusClass = (status) => {
    switch (status) {
      case 0: return 'status-ready';
      case 1: return 'status-busy';
      case 2: return 'status-error';
      default: return 'status-unknown';
    }
  };

  // Yazıcı sekmesi içeriği
  const renderPrinterContent = () => {
    if (loadingPrinters && printers.length === 0) {
      return (
        <div className="printer-loading">
          <Loader2 size={32} className="spinner" />
          <span>Yazıcılar taranıyor...</span>
        </div>
      );
    }

    if (!loadingPrinters && printers.length === 0) {
      return (
        <div className="printer-empty">
          <Printer size={48} strokeWidth={1.5} />
          <h4>Yazıcı Bulunamadı</h4>
          <p>Sisteminizde tanımlı yazıcı tespit edilemedi.</p>
        </div>
      );
    }

    return (
      <>
        <div className="printer-list">
          {printers.map((printer, idx) => (
            <div
              key={idx}
              className={`printer-item ${selectedPrinter === printer.name ? 'selected' : ''}`}
              onClick={() => setSelectedPrinter(printer.name)}
            >
              <div className="printer-radio">
                <div className={`radio-outer ${selectedPrinter === printer.name ? 'checked' : ''}`}>
                  {selectedPrinter === printer.name && <div className="radio-inner" />}
                </div>
              </div>
              <div className="printer-icon-box">
                <Printer size={24} />
              </div>
              <div className="printer-info">
                <div className="printer-name">
                  {printer.displayName}
                  {printer.isDefault && <span className="printer-default-badge">Varsayılan</span>}
                  {savedPrinter === printer.name && <span className="printer-active-badge">Kullanımda</span>}
                </div>
                <div className="printer-details">
                  <span className={`printer-status ${getPrinterStatusClass(printer.status)}`}>
                    {getPrinterStatusText(printer.status)}
                  </span>
                  {printer.description && (
                    <span className="printer-description">{printer.description}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="printer-actions">
          {(saveSuccess || testPrintSuccess) && (
            <div className="printer-save-success">
              <CheckCircle size={18} />
              <span>{saveSuccess ? 'Yazıcı başarıyla kaydedildi!' : 'Sınama sayfası gönderildi!'}</span>
            </div>
          )}
          <div className="printer-action-buttons">
            <button 
              className="printer-test-btn"
              onClick={handleTestPrint}
              disabled={!selectedPrinter || loadingTestPrint}
            >
              {loadingTestPrint ? <Loader2 size={16} className="spinner" /> : 'Sınama Sayfası Yazdır'}
            </button>
            <button 
              className="printer-save-btn"
              onClick={handleSavePrinter}
              disabled={!selectedPrinter || selectedPrinter === savedPrinter}
            >
              Kaydet
            </button>
          </div>
        </div>
      </>
    );
  };

  const renderContent = () => {
    const defaultPlaceholder = (title) => (
      <div className="settings-content-placeholder">
        <h3>{title}</h3>
        <p>Bu bölüm henüz yapım aşamasındadır.</p>
        <p style={{ marginTop: '6px', fontSize: '13px', color: '#94a3b8' }}>
          İstek ve talepleriniz varsa, lütfen developerınızla iletişime geçiniz.
        </p>
      </div>
    );

    switch (activeTab) {
      case 'hat': return (
        <div className="printer-section">
          <h3>{t('hatSettingsTitle')}</h3>
          <p className="printer-section-desc">{t('hatSettingsDesc')}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '400px' }}>
            {[1, 2, 3].map(id => (
              <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <label style={{
                  minWidth: '60px', fontWeight: '600', fontSize: '15px', color: '#0f172a'
                }}>{t('line')} {id}</label>
                <input
                  type="tel"
                  value={hatNumbers[id] || ''}
                  onChange={e => setHatNumbers(prev => ({ ...prev, [id]: formatHatPhone(e.target.value) }))}
                  placeholder="Ör: (216) XXX XX XX"
                  style={{
                    flex: 1, padding: '10px 14px', border: '2px solid #e2e8f0',
                    borderRadius: '8px', fontSize: '15px', outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={e => e.target.style.borderColor = '#38bdf8'}
                  onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                />
              </div>
            ))}
          </div>
          <div className="printer-actions" style={{ marginTop: '24px' }}>
            {hatSaveSuccess && (
              <div className="printer-save-success">
                <CheckCircle size={18} />
                <span>{t('hatSaved')}</span>
              </div>
            )}
            <button className="printer-save-btn" onClick={handleSaveHatNumbers}>{t('save')}</button>
          </div>
        </div>
      );
      case 'ekran': return (
        <div className="printer-section">
          <h3>{t('screenSettingsTitle')}</h3>
          <p className="printer-section-desc">{t('languageDesc').replace('arayüz','görünüm tema')}</p>
          <div style={{ display: 'flex', gap: '20px', marginTop: '8px' }}>
            {[
              { id: 'light', label: t('lightMode'), desc: t('lightModeDesc'), icon: '☀️' },
              { id: 'dark',  label: t('darkMode'),  desc: t('darkModeDesc'),  icon: '🌙' }
            ].map(opt => (
              <div
                key={opt.id}
                onClick={() => handleThemeSelect(opt.id)}
                style={{
                  flex: 1, padding: '20px', border: `2px solid ${selectedTheme === opt.id ? '#38bdf8' : '#e2e8f0'}`,
                  borderRadius: '12px', background: selectedTheme === opt.id ? '#f0f9ff' : '#ffffff',
                  cursor: 'pointer', transition: 'all 0.2s ease',
                  boxShadow: selectedTheme === opt.id ? '0 0 0 3px rgba(56,189,248,0.2)' : 'none'
                }}
              >
                <div style={{ fontSize: '32px', marginBottom: '10px' }}>{opt.icon}</div>
                <div style={{ fontWeight: '700', fontSize: '15px', color: '#0f172a', marginBottom: '4px' }}>{opt.label}</div>
                <div style={{ fontSize: '13px', color: '#64748b' }}>{opt.desc}</div>
                {selectedTheme === opt.id && (
                  <div style={{
                    display: 'inline-block', marginTop: '12px', padding: '3px 12px',
                    background: '#38bdf8', color: '#0f172a', borderRadius: '20px',
                    fontSize: '12px', fontWeight: '700'
                  }}>{lang === 'en' ? 'Active' : 'Aktif'}</div>
                )}
              </div>
            ))}
          </div>
          <div className="printer-actions" style={{ marginTop: '28px' }}>
            {themeSaveSuccess && (
              <div className="printer-save-success">
                <CheckCircle size={18} />
                <span>{t('themeSaved')}</span>
              </div>
            )}
            <button className="printer-save-btn" onClick={handleSaveTheme}>{t('save')}</button>
          </div>
        </div>
      );
      case 'yazici': return (
        <div className="printer-section">
          <h3>{t('printerTitle')}</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <p className="printer-section-desc" style={{ margin: 0, flex: 1 }}>{t('printerDesc')}</p>
            <button
              className="printer-refresh-btn"
              onClick={loadPrinters}
              disabled={loadingPrinters}
              title="Yazıcı listesini yenile"
            >
              <RefreshCw size={14} className={loadingPrinters ? 'spinner' : ''} />
              {loadingPrinters ? 'Taranıyor...' : 'Yenile'}
            </button>
          </div>
          {renderPrinterContent()}
        </div>
      );
      case 'parola': return (
        <div className="printer-section">
          <h3>{t('passwordTitle')}</h3>

          {/* Checkbox */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <input
              id="pwd-enable"
              type="checkbox"
              checked={pwdEnabled}
              onChange={handlePwdCheckboxChange}
              style={{ width: '18px', height: '18px', accentColor: '#38bdf8', cursor: 'pointer' }}
            />
            <label htmlFor="pwd-enable" style={{ fontSize: '15px', fontWeight: '600', color: '#0f172a', cursor: 'pointer' }}>
              {t('passwordEnable')}
            </label>
          </div>

          {/* Parola Alanları */}
          {pwdEnabled && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '420px' }}>

              {/* Parola */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>{t('password')}</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={pwdVisible ? 'text' : 'password'}
                    value={pwdPassword}
                    onChange={e => setPwdPassword(e.target.value)}
                    placeholder={t('passwordPlaceholder')}
                    style={{ width: '100%', padding: '10px 44px 10px 14px', border: '2px solid #e2e8f0', borderRadius: '8px', fontSize: '15px', outline: 'none' }}
                    onFocus={e => e.target.style.borderColor = '#38bdf8'}
                    onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                  />
                  <button type="button" onClick={() => setPwdVisible(v => !v)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center' }}>
                    {pwdVisible ? <Eye size={20} /> : <EyeOff size={20} />}
                  </button>
                </div>
              </div>

              {/* Parola Tekrar */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>{t('passwordRepeat')}</label>
                <input
                  type={pwdVisible ? 'text' : 'password'}
                  value={pwdPassword2}
                  onChange={e => setPwdPassword2(e.target.value)}
                  placeholder={t('passwordRepeatPlaceholder')}
                  style={{ width: '100%', padding: '10px 14px', border: `2px solid ${pwdPassword2 && pwdPassword !== pwdPassword2 ? '#ef4444' : '#e2e8f0'}`, borderRadius: '8px', fontSize: '15px', outline: 'none', transition: 'border-color 0.2s' }}
                  onFocus={e => e.target.style.borderColor = pwdPassword2 && pwdPassword !== pwdPassword2 ? '#ef4444' : '#38bdf8'}
                  onBlur={e => e.target.style.borderColor = pwdPassword2 && pwdPassword !== pwdPassword2 ? '#ef4444' : '#e2e8f0'}
                />
                {pwdPassword2 && pwdPassword !== pwdPassword2 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '5px', color: '#ef4444', fontSize: '12px', fontWeight: '600' }}>
                    <span style={{ fontSize: '16px' }}>⚠</span>
                    {t('passwordMismatchInline')}
                  </div>
                )}
              </div>

              {/* Gizli Soru */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>{t('secretQuestion')}</label>
                <select
                  value={pwdQuestion}
                  onChange={e => setPwdQuestion(e.target.value)}
                  style={{ padding: '10px 14px', border: '2px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none', background: '#fff', color: '#1e293b', cursor: 'pointer' }}
                >
                  {SECRET_QUESTIONS.map(q => (
                    q === CUSTOM_QUESTION_VALUE
                      ? <option key={q} value={q}>{t('customQuestion')}</option>
                      : <option key={q} value={q}>{q}</option>
                  ))}
                </select>

                {/* Özel soru giriş kutusu */}
                {pwdQuestion === CUSTOM_QUESTION_VALUE && (
                  <input
                    type="text"
                    value={pwdCustomQuestion}
                    onChange={e => setPwdCustomQuestion(e.target.value)}
                    placeholder={t('customQuestionPlaceholder')}
                    autoFocus
                    style={{ padding: '10px 14px', border: `2px solid ${!pwdCustomQuestion.trim() ? '#fbbf24' : '#e2e8f0'}`, borderRadius: '8px', fontSize: '14px', outline: 'none', transition: 'border-color 0.2s' }}
                    onFocus={e => e.target.style.borderColor = '#38bdf8'}
                    onBlur={e => e.target.style.borderColor = pwdCustomQuestion.trim() ? '#e2e8f0' : '#fbbf24'}
                  />
                )}
              </div>

              {/* Gizli Soru Cevabı */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>{t('secretAnswer')}</label>
                <input
                  type="text"
                  value={pwdAnswer}
                  onChange={e => setPwdAnswer(e.target.value)}
                  placeholder={t('secretAnswerPlaceholder')}
                  style={{ padding: '10px 14px', border: '2px solid #e2e8f0', borderRadius: '8px', fontSize: '15px', outline: 'none' }}
                  onFocus={e => e.target.style.borderColor = '#38bdf8'}
                  onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                />
              </div>
            </div>
          )}

          {/* Hata / Başarı mesajları */}
          <div className="printer-actions" style={{ marginTop: '24px' }}>
            {pwdError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444', fontSize: '14px', fontWeight: '500', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '8px 12px' }}>
                ⚠️ {pwdError}
              </div>
            )}
            {pwdSuccess && (
              <div className="printer-save-success">
                <CheckCircle size={18} />
                <span>{t('passwordSaved')}</span>
              </div>
            )}
            <button className="printer-save-btn" onClick={handleSavePassword}>{t('save')}</button>
          </div>
        </div>
      );
      case 'yonetici': return (
        <div className="printer-section">
          <h3>{t('adminTitle')}</h3>
          {!adminUnlocked ? (
            <>
              <p className="printer-section-desc">{t('adminDesc')}</p>
              <div style={{ maxWidth: '380px', display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
                <div style={{ position: 'relative' }}>
                  <input
                    autoFocus
                    type="password"
                    value={adminPwd}
                    onChange={e => setAdminPwd(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAdminLogin()}
                    placeholder={t('adminPasswordPlaceholder')}
                    style={{ width: '100%', padding: '11px 14px', border: `2px solid ${adminPwdError ? '#ef4444' : '#e2e8f0'}`, borderRadius: '8px', fontSize: '15px', outline: 'none' }}
                  />
                </div>
                {adminPwdError && (
                  <div style={{ color: '#ef4444', fontSize: '13px', fontWeight: '500' }}>⚠️ {adminPwdError}</div>
                )}
                <button
                  className="printer-save-btn"
                  onClick={handleAdminLogin}
                  disabled={adminPwdLoading || !adminPwd}
                  style={{ opacity: (!adminPwd || adminPwdLoading) ? 0.5 : 1 }}
                >{adminPwdLoading ? t('adminLogging') : t('adminLogin')}</button>
              </div>
            </>
          ) : (
            <div style={{ maxWidth: '400px' }}>
              <p style={{ fontSize: '14px', color: '#16a34a', fontWeight: '600', marginBottom: '20px' }}>
                {t('adminLoggedIn')}
              </p>
              {!adminDisableSuccess ? (
                <button
                  style={{ padding: '12px 24px', background: 'linear-gradient(135deg,#ef4444,#b91c1c)', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: '700', fontSize: '15px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(239,68,68,0.3)' }}
                  onClick={handleAdminDisablePassword}
                >{t('adminDisableBtn')}</button>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#16a34a', fontSize: '15px', fontWeight: '700', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', padding: '12px 16px' }}>
                  <CheckCircle size={20} /> {t('adminDisableSuccess')}
                </div>
              )}
            </div>
          )}
        </div>
      );
      default: return null;
      case 'dil': return (
        <div className="printer-section">
          <h3>{t('languageTitle')}</h3>
          <p className="printer-section-desc">{t('languageDesc')}</p>
          <div style={{ display: 'flex', gap: '16px', marginTop: '16px', flexWrap: 'wrap' }}>
            {[
              { code: 'tr', label: t('langTR'), flag: '🇹🇷' },
              { code: 'en', label: t('langEN'), flag: '🇬🇧' }
            ].map(opt => (
              <div
                key={opt.code}
                onClick={() => setPendingLang(opt.code)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: '10px', padding: '24px 32px', borderRadius: '14px', cursor: 'pointer',
                  border: `2.5px solid ${pendingLang === opt.code ? '#38bdf8' : '#e2e8f0'}`,
                  background: pendingLang === opt.code ? 'rgba(56,189,248,0.06)' : '#fff',
                  transition: 'all 0.2s', minWidth: '140px', boxShadow: pendingLang === opt.code ? '0 0 0 3px rgba(56,189,248,0.15)' : 'none'
                }}
              >
                <span style={{ fontSize: '36px' }}>{opt.flag}</span>
                <span style={{ fontWeight: '700', fontSize: '15px', color: pendingLang === opt.code ? '#0ea5e9' : '#1e293b' }}>{opt.label}</span>
                {/* Aktif dil tik - SADECE kayıtlı lang üzerinde */}
                {lang === opt.code && (
                  <span style={{ fontSize: '12px', fontWeight: '700', background: '#16a34a', color: '#fff', borderRadius: '20px', padding: '2px 12px' }}>✓</span>
                )}
              </div>
            ))}
          </div>
          <div className="printer-actions" style={{ marginTop: '28px' }}>
            {langSaveSuccess && (
              <div className="printer-save-success">
                <CheckCircle size={18} /><span>{t('languageSaved')}</span>
              </div>
            )}
            <button className="printer-save-btn" onClick={handleSaveLang}>{t('save')}</button>
          </div>
        </div>
      );
      case 'guncelleme': return (
        <div className="settings-section">
          <div className="settings-section-header">
            <RefreshCw size={20} />
            <span>Versiyon Güncelleme</span>
          </div>
          <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '20px', lineHeight: '1.6' }}>
            Buradan program versiyonunu ve güncelleme tarihini düzenleyebilirsiniz.
            Kaydettikten sonra <strong>Hakkında</strong> penceresinde güncel bilgi görünür.
          </p>

          <div className="hat-fields">
            <div className="hat-field-row">
              <label className="hat-field-label">Versiyon</label>
              <input
                className="hat-field-input"
                type="text"
                placeholder="Örn: V1.0.0"
                value={versionStr}
                onChange={e => setVersionStr(e.target.value)}
              />
            </div>
            <div className="hat-field-row">
              <label className="hat-field-label">Tarih</label>
              <input
                className="hat-field-input"
                type="text"
                placeholder="GG.AA.YYYY"
                value={versionDate}
                onChange={e => setVersionDate(e.target.value)}
              />
            </div>
          </div>

          <div className="printer-actions" style={{ marginTop: '20px' }}>
            {versionSaveSuccess && (
              <div className="printer-save-success">
                <CheckCircle size={18} /><span>Versiyon bilgisi kaydedildi.</span>
              </div>
            )}
            <button className="printer-save-btn" onClick={handleSaveVersion}>Kaydet</button>
          </div>
        </div>
      );
      case 'log': return (
        <div className="settings-content-placeholder">
          <h3>{t('menuLog2')}</h3>
          <p>{t('sectionWip')}</p>
          <p style={{ marginTop: '6px', fontSize: '13px', color: '#94a3b8' }}>{t('sectionWipContact')}</p>
        </div>
      );
    }
  };

  return (
    <div className={`settings-wrapper${flashAlert ? ' flash-alert-active' : ''}`}>

      {/* PAROLA KALDIRMA ONAY MODALI */}
      {showDisableConfirm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999
        }}>
          <div style={{
            background: '#fff', borderRadius: '16px', padding: '32px 36px',
            width: '380px', boxShadow: '0 20px 60px rgba(0,0,0,0.25)'
          }}>
            <h3 style={{ fontSize: '17px', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>Parola Korumasını Kaldır</h3>
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '20px' }}>
              Parola korumasını kaldırmak için mevcut parolanızı girin.
            </p>
            <input
              autoFocus
              type="password"
              value={disableConfirmPwd}
              onChange={e => setDisableConfirmPwd(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleConfirmDisable()}
              placeholder="Mevcut parolanız"
              style={{ width: '100%', padding: '11px 14px', border: `2px solid ${disableConfirmError ? '#ef4444' : '#e2e8f0'}`, borderRadius: '8px', fontSize: '15px', outline: 'none', marginBottom: '8px' }}
            />
            {disableConfirmError && (
              <p style={{ color: '#ef4444', fontSize: '13px', marginBottom: '12px' }}>⚠️ {disableConfirmError}</p>
            )}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button
                onClick={() => { setShowDisableConfirm(false); setDisableConfirmError(''); }}
                style={{ padding: '9px 20px', border: '2px solid #e2e8f0', borderRadius: '8px', background: '#fff', color: '#475569', fontWeight: '600', cursor: 'pointer' }}
              >{t('cancel')}</button>
              <button
                onClick={handleConfirmDisable}
                disabled={disableConfirmLoading || !disableConfirmPwd}
                style={{ padding: '9px 20px', background: '#ef4444', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: '700', cursor: 'pointer', opacity: (!disableConfirmPwd || disableConfirmLoading) ? 0.5 : 1 }}
              >{disableConfirmLoading ? t('verifying') : t('confirm')}</button>
            </div>
          </div>
        </div>
      )}

      {/* YENİDEN BAŞLATMA MODAL */}
      {showRestartModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '32px 36px', width: '420px', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <h3 style={{ fontSize: '17px', fontWeight: '700', color: '#0f172a', marginBottom: '12px' }}>
              {lang === 'en' ? 'Restart Required' : 'Yeniden Başlatma Gerekiyor'}
            </h3>
            <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '24px' }}>
              {lang === 'en'
                ? 'You changed the language. The program needs to restart. Restart now?'
                : 'Dil değişikliği yaptınız. Programın yeniden başlatılması gerekiyor. Şimdi yeniden başlatılsın mı?'
              }
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={async () => {
                  await window.electronAPI?.applyLanguage(pendingLang);
                }}
                style={{ padding: '10px 24px', background: 'linear-gradient(135deg,#38bdf8,#0ea5e9)', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: '700', cursor: 'pointer', fontSize: '14px' }}
              >{lang === 'en' ? 'Yes' : 'Evet'}</button>
              <button
                onClick={() => { setShowRestartModal(false); setPendingLang(lang); }}
                autoFocus
                style={{ padding: '10px 24px', border: '2px solid #e2e8f0', borderRadius: '8px', background: '#fff', color: '#475569', fontWeight: '700', cursor: 'pointer', fontSize: '14px' }}
              >{lang === 'en' ? 'No' : 'Hayır'}</button>
            </div>
          </div>
        </div>
      )}
      {/* Özel Başlık Çubuğu */}
      <div className="title-bar">
        <div className="title-bar-drag-area"></div>
        <div className="title-bar-controls">
          <button className="control-btn close-btn" onClick={handleClose}>
            <X size={16} />
          </button>
        </div>
      </div>
      <div className="settings-container">

      <div className="settings-sidebar">
        <div className="settings-header">
          <h2>{t('settingsTitle')}</h2>
        </div>
        <nav className="settings-nav">
          {menuItems.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={`settings-nav-item ${activeTab === item.id ? 'active' : ''}`}
                onClick={() => setActiveTab(item.id)}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
      
      <div className="settings-main">
        {renderContent()}
      </div>
      </div>
    </div>
  );
};

export default Settings;
