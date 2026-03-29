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
  Globe,
  BarChart2
} from 'lucide-react';
import './Settings.css';
import { useLanguage } from './LanguageContext.jsx';

const Settings = () => {
  const { lang, setLang, t } = useLanguage();
  const [activeTab, setActiveTab] = useState('hat');
  const [screenTab, setScreenTab] = useState('tema'); // 'tema' veya 'olcek'

  // Ölçek Ayarları state'i
  const [scaleSettings, setScaleSettings] = useState({
    hatBoxes: { width: '', height: '' },
    sidebar: { width: '290', height: '' },
    callList: { width: '320', height: '' }
  });
  const [scaleSaveSuccess, setScaleSaveSuccess] = useState(false);

  // Ölçek ayarlarını yükle
  useEffect(() => {
    if (window.electronAPI?.getScaleSettings) {
      window.electronAPI.getScaleSettings().then(settings => {
        if (settings) {
          setScaleSettings(prev => ({ ...prev, ...settings }));
        }
      });
    }
  }, []);

  const handleSaveScaleSettings = async () => {
    if (!window.electronAPI?.saveScaleSettings) return;
    const result = await window.electronAPI.saveScaleSettings(scaleSettings);
    if (result.success) {
      setScaleSaveSuccess(true);
      setTimeout(() => setScaleSaveSuccess(false), 3000);
    }
  };

  const updateScale = (section, field, value) => {
    // Sadece sayı girilmesini sağlayalım (görünümü bozmamak için)
    const numericValue = value.replace(/[^0-9]/g, '');
    setScaleSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: numericValue
      }
    }));
  };

  // Yazıcı state'leri
  const [printerTab, setPrinterTab] = useState('siparis');
  const [printers, setPrinters] = useState([]);
  const [selectedPrinter, setSelectedPrinter] = useState(null);
  const [savedPrinter, setSavedPrinter] = useState(null);
  const [selectedReportPrinter, setSelectedReportPrinter] = useState(null);
  const [savedReportPrinter, setSavedReportPrinter] = useState(null);
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

  // Güncelleme kontrolü state'i
  // 'idle' | 'checking' | 'up-to-date' | 'update-available' | 'error'
  const [updateStatus, setUpdateStatus] = useState('idle');
  const [updateInfo, setUpdateInfo] = useState(null); // { latestVersion, currentVersion, url }

  // Update modal state
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  const handleCheckForUpdates = async () => {
    setShowUpdateModal(true);
    setUpdateStatus('checking');
    setUpdateInfo(null);
    try {
      const result = await window.electronAPI?.checkForUpdates?.();
      if (!result) {
        setUpdateStatus('error');
        setUpdateInfo({ error: 'Sunucuya bağlanılamadı.' });
        return;
      }
      // API'den hata mesajı döndüyse
      if (result.error) {
        setUpdateStatus('error');
        setUpdateInfo({ error: result.error });
        return;
      }
      if (result.updateAvailable) {
        setUpdateStatus('update-available');
        setUpdateInfo({
          latestVersion: result.latestVersion,
          currentVersion: result.currentVersion,
          releaseNotes: result.releaseNotes || '',
          url: result.url
        });
      } else {
        // updateAvailable === false → güncel
        setUpdateStatus('up-to-date');
        setUpdateInfo({ currentVersion: result.currentVersion });
      }
    } catch (err) {
      setUpdateStatus('error');
      setUpdateInfo({ error: err.message });
    }
  };

  // Raporlama state'i
  const [reportStartDate, setReportStartDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [reportEndDate, setReportEndDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [reportLines, setReportLines] = useState({ 1: true, 2: true, 3: true });
  const [printingReport, setPrintingReport] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);

  const handlePrintReport = async () => {
    if (!window.electronAPI) return;
    if (!savedReportPrinter) {
      alert("Lütfen önce 'Yazıcı(lar)' sekmesinden bir 'Rapor Yazıcısı' seçip kaydedin.");
      return;
    }

    setPrintingReport(true);
    try {
      const appState = await window.electronAPI.getAppState();
      const callHistory = appState?.callHistory || [];

      const parseTrDate = (dStr) => {
        if(!dStr) return null;
        const parts = dStr.split('.');
        if(parts.length !== 3) return null;
        return new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00`);
      };

      const start = new Date(reportStartDate); start.setHours(0,0,0,0);
      const end = new Date(reportEndDate); end.setHours(23,59,59,999);

      const filteredCalls = callHistory.filter((call) => {
        const lineStr = call.lineLabel ? call.lineLabel.toString() : '';
        if (lineStr && !reportLines[lineStr]) return false;

        const callDate = parseTrDate(call.date);
        if (callDate) {
          if (callDate < start || callDate > end) return false;
        }
        return true;
      });

      if (filteredCalls.length === 0) {
        alert("Seçilen kriterlere uyan hiçbir çağrı kaydı bulunamadı.");
        setPrintingReport(false);
        return;
      }

      const result = await window.electronAPI.printA4Report(filteredCalls, savedReportPrinter);
      if (result && result.success) {
        setReportSuccess(true);
        setTimeout(() => setReportSuccess(false), 3000);
      } else {
        alert("Rapor yazdırılırken bir hata oluştu: " + result.error);
      }
    } catch (err) {
      console.error(err);
      alert("Hata: " + err.message);
    }
    setPrintingReport(false);
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
      const [printerList, savedOrder, savedReport] = await Promise.all([
        window.electronAPI.getPrinters(),
        window.electronAPI.getPrinterSelection(),
        window.electronAPI.getReportPrinterSelection ? window.electronAPI.getReportPrinterSelection() : Promise.resolve(null)
      ]);
      setPrinters(printerList || []);
      setSavedPrinter(savedOrder);
      setSelectedPrinter(savedOrder);
      setSavedReportPrinter(savedReport);
      setSelectedReportPrinter(savedReport);
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
    const printerToTest = printerTab === 'siparis' ? selectedPrinter : selectedReportPrinter;
    if (!window.electronAPI || !printerToTest) return;
    setLoadingTestPrint(true);
    try {
      const result = await window.electronAPI.printTestPage(printerToTest);
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
    if (!window.electronAPI) return;
    try {
      let result;
      if (printerTab === 'siparis') {
        if (!selectedPrinter) return;
        result = await window.electronAPI.savePrinterSelection(selectedPrinter);
        if (result.success) setSavedPrinter(selectedPrinter);
      } else {
        if (!selectedReportPrinter) return;
        result = await window.electronAPI.saveReportPrinterSelection(selectedReportPrinter);
        if (result.success) setSavedReportPrinter(selectedReportPrinter);
      }
      if (result && result.success) {
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
    { id: 'raporlama', icon: BarChart2, label: 'Raporlar' },
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
          {printers.map((printer, idx) => {
            const isSelected = printerTab === 'siparis' ? selectedPrinter === printer.name : selectedReportPrinter === printer.name;
            const isSaved = printerTab === 'siparis' ? savedPrinter === printer.name : savedReportPrinter === printer.name;
            return (
              <div
                key={idx}
                className={`printer-item ${isSelected ? 'selected' : ''}`}
                onClick={() => printerTab === 'siparis' ? setSelectedPrinter(printer.name) : setSelectedReportPrinter(printer.name)}
              >
                <div className="printer-radio">
                  <div className={`radio-outer ${isSelected ? 'checked' : ''}`}>
                    {isSelected && <div className="radio-inner" />}
                  </div>
                </div>
                <div className="printer-icon-box">
                  <Printer size={24} />
                </div>
                <div className="printer-info">
                  <div className="printer-name">
                    {printer.displayName}
                    {printer.isDefault && <span className="printer-default-badge">Varsayılan</span>}
                    {isSaved && <span className="printer-active-badge">Kullanımda</span>}
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
            );
          })}
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
              disabled={(printerTab === 'siparis' ? !selectedPrinter : !selectedReportPrinter) || loadingTestPrint}
            >
              {loadingTestPrint ? <Loader2 size={16} className="spinner" /> : 'Sınama Sayfası Yazdır'}
            </button>
            <button 
              className="printer-save-btn"
              onClick={handleSavePrinter}
              disabled={printerTab === 'siparis' ? (!selectedPrinter || selectedPrinter === savedPrinter) : (!selectedReportPrinter || selectedReportPrinter === savedReportPrinter)}
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
      case 'raporlama': return (
        <div className="printer-section">
          <h3>Raporlama Bölümü</h3>
          <p className="printer-section-desc">Belirlediğiniz tarih aralığı ve telefon hatlarına göre geçmiş çağrı listesini A4 formatında "Rapor Yazıcınız" üzerinden yazdırın.</p>

          <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', marginTop: '16px' }}>
            <h4 style={{ margin: '0 0 16px', fontSize: '15px', color: '#0f172a' }}>Tarih Aralığı Seçimi</h4>
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '8px' }}>Başlangıç Tarihi</label>
                <input 
                  type="date" 
                  value={reportStartDate}
                  onChange={(e) => setReportStartDate(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', border: '2px solid #e2e8f0', borderRadius: '8px', outline: 'none', transition: '0.2s', boxSizing: 'border-box', fontFamily: 'inherit' }}
                  onFocus={e => e.target.style.borderColor = '#38bdf8'}
                  onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                />
              </div>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '8px' }}>Bitiş Tarihi</label>
                <input 
                  type="date"
                  value={reportEndDate}
                  onChange={(e) => setReportEndDate(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', border: '2px solid #e2e8f0', borderRadius: '8px', outline: 'none', transition: '0.2s', boxSizing: 'border-box', fontFamily: 'inherit' }}
                  onFocus={e => e.target.style.borderColor = '#38bdf8'}
                  onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                />
              </div>
            </div>
          </div>

          <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', marginTop: '20px' }}>
            <h4 style={{ margin: '0 0 16px', fontSize: '15px', color: '#0f172a' }}>Hat Seçimi</h4>
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
              {[1, 2, 3].map(id => (
                <label key={id} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: '600', color: '#334155' }}>
                  <input 
                    type="checkbox" 
                    checked={reportLines[id]}
                    onChange={(e) => setReportLines(prev => ({ ...prev, [id]: e.target.checked }))}
                    style={{ width: '18px', height: '18px', accentColor: '#38bdf8', cursor: 'pointer' }}
                  />
                  Hat {id}
                </label>
              ))}
            </div>
          </div>

          <div className="printer-actions" style={{ marginTop: '28px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '16px' }}>
            {reportSuccess && (
              <div className="printer-save-success" style={{ margin: 0 }}>
                <CheckCircle size={18} color="#16a34a" />
                <span style={{ color: '#16a34a', fontWeight: '600' }}>Rapor başarıyla yazdırıldı!</span>
              </div>
            )}
            <button 
              className="printer-save-btn" 
              onClick={handlePrintReport}
              disabled={printingReport || Object.values(reportLines).every(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#0ea5e9', cursor: (printingReport || Object.values(reportLines).every(v => !v)) ? 'not-allowed' : 'pointer' }}
            >
              {printingReport ? <Loader2 size={16} className="spinner" /> : <FileText size={16} />}
              Raporu Yazdır
            </button>
          </div>
        </div>
      );
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
          <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', marginBottom: '20px', marginTop: '10px' }}>
            <div 
              onClick={() => setScreenTab('tema')}
              style={{
                padding: '10px 20px', 
                cursor: 'pointer',
                fontWeight: '600',
                color: screenTab === 'tema' ? '#0ea5e9' : '#64748b',
                borderBottom: screenTab === 'tema' ? '2px solid #0ea5e9' : '2px solid transparent',
                transition: 'all 0.2s',
                userSelect: 'none'
              }}
            >
              Tema
            </div>
            <div 
              onClick={() => setScreenTab('olcek')}
              style={{
                padding: '10px 20px', 
                cursor: 'pointer',
                fontWeight: '600',
                color: screenTab === 'olcek' ? '#0ea5e9' : '#64748b',
                borderBottom: screenTab === 'olcek' ? '2px solid #0ea5e9' : '2px solid transparent',
                transition: 'all 0.2s',
                userSelect: 'none'
              }}
            >
              Ölçek
            </div>
          </div>

          {screenTab === 'tema' && (
            <>
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
            </>
          )}

          {screenTab === 'olcek' && (
            <div style={{ padding: '20px 0', color: '#64748b', fontSize: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr) minmax(200px, 1fr) minmax(200px, 1fr)', gap: '20px', alignItems: 'start' }}>
                
                {/* 1. Hat 1, Hat 2, Hat 3 ve 4. Kutu */}
                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <h4 style={{ margin: '0 0 16px', fontSize: '14px', color: '#0f172a' }}>Hat 1, Hat 2, Hat 3 ve 4. Kutu</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '6px' }}>Yatay Ölçü (px)</label>
                      <input type="text" value={scaleSettings.hatBoxes.width} onChange={e => updateScale('hatBoxes', 'width', e.target.value)} placeholder="Oto" style={{ width: '100%', padding: '8px 12px', border: '2px solid #e2e8f0', borderRadius: '8px', outline: 'none', transition: '0.2s', boxSizing: 'border-box' }} onFocus={e => e.target.style.borderColor = '#38bdf8'} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '6px' }}>Dikey Ölçü (px)</label>
                      <input type="text" value={scaleSettings.hatBoxes.height} onChange={e => updateScale('hatBoxes', 'height', e.target.value)} placeholder="Oto" style={{ width: '100%', padding: '8px 12px', border: '2px solid #e2e8f0', borderRadius: '8px', outline: 'none', transition: '0.2s', boxSizing: 'border-box' }} onFocus={e => e.target.style.borderColor = '#38bdf8'} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                    </div>
                  </div>
                </div>

                {/* 2. Ekran Sol Menü */}
                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <h4 style={{ margin: '0 0 16px', fontSize: '14px', color: '#0f172a' }}>Ekran Sol Menü</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '6px' }}>Yatay Ölçü (px)</label>
                      <input type="text" value={scaleSettings.sidebar.width} onChange={e => updateScale('sidebar', 'width', e.target.value)} placeholder="290" style={{ width: '100%', padding: '8px 12px', border: '2px solid #e2e8f0', borderRadius: '8px', outline: 'none', transition: '0.2s', boxSizing: 'border-box' }} onFocus={e => e.target.style.borderColor = '#38bdf8'} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '6px' }}>Dikey Ölçü (px)</label>
                      <input type="text" value={scaleSettings.sidebar.height} onChange={e => updateScale('sidebar', 'height', e.target.value)} placeholder="Oto" style={{ width: '100%', padding: '8px 12px', border: '2px solid #e2e8f0', borderRadius: '8px', outline: 'none', transition: '0.2s', boxSizing: 'border-box' }} onFocus={e => e.target.style.borderColor = '#38bdf8'} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                    </div>
                  </div>
                </div>

                {/* 3. Çağrı Listesi */}
                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <h4 style={{ margin: '0 0 16px', fontSize: '14px', color: '#0f172a' }}>Çağrı Listesi</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '6px' }}>Yatay Ölçü (px)</label>
                      <input type="text" value={scaleSettings.callList.width} onChange={e => updateScale('callList', 'width', e.target.value)} placeholder="320" style={{ width: '100%', padding: '8px 12px', border: '2px solid #e2e8f0', borderRadius: '8px', outline: 'none', transition: '0.2s', boxSizing: 'border-box' }} onFocus={e => e.target.style.borderColor = '#38bdf8'} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '6px' }}>Dikey Ölçü (px)</label>
                      <input type="text" value={scaleSettings.callList.height} onChange={e => updateScale('callList', 'height', e.target.value)} placeholder="Oto" style={{ width: '100%', padding: '8px 12px', border: '2px solid #e2e8f0', borderRadius: '8px', outline: 'none', transition: '0.2s', boxSizing: 'border-box' }} onFocus={e => e.target.style.borderColor = '#38bdf8'} onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                    </div>
                  </div>
                </div>

              </div>

              {/* Kaydet Butonu */}
              <div className="printer-actions" style={{ marginTop: '28px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '16px' }}>
                {scaleSaveSuccess && (
                  <div className="printer-save-success" style={{ margin: 0 }}>
                    <CheckCircle size={18} color="#16a34a" />
                    <span style={{ color: '#16a34a', fontWeight: '600' }}>Ölçek ayarları kaydedildi!</span>
                  </div>
                )}
                <button className="printer-save-btn" onClick={handleSaveScaleSettings}>{t('save')}</button>
              </div>
            </div>
          )}
        </div>
      );
      case 'yazici': return (
        <div className="printer-section">
          <h3>{t('printerTitle')}</h3>

          {/* Yazıcı Sekmeleri */}
          <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', marginBottom: '20px', marginTop: '10px' }}>
            <div 
              onClick={() => setPrinterTab('siparis')}
              style={{
                padding: '10px 20px', 
                cursor: 'pointer',
                fontWeight: '600',
                color: printerTab === 'siparis' ? '#0ea5e9' : '#64748b',
                borderBottom: printerTab === 'siparis' ? '2px solid #0ea5e9' : '2px solid transparent',
                transition: 'all 0.2s',
                userSelect: 'none'
              }}
            >
              Sipariş Yazıcısı
            </div>
            <div 
              onClick={() => setPrinterTab('rapor')}
              style={{
                padding: '10px 20px', 
                cursor: 'pointer',
                fontWeight: '600',
                color: printerTab === 'rapor' ? '#0ea5e9' : '#64748b',
                borderBottom: printerTab === 'rapor' ? '2px solid #0ea5e9' : '2px solid transparent',
                transition: 'all 0.2s',
                userSelect: 'none'
              }}
            >
              Rapor Yazıcısı
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <p className="printer-section-desc" style={{ margin: 0, flex: 1 }}>
              {printerTab === 'siparis' 
                ? 'Gelen çağrılarda otomatik ve manuel fiş yazdırılırken kullanılacak varsayılan termal sipariş yazıcısıdır.' 
                : 'Program içerisinden büyük çıktı (A4 vb.) veya raporlar alınırken kullanılacak yazıcıdır.'}
            </p>
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
        <div className="printer-section">
          <h3>Güncelleme</h3>
          <p className="printer-section-desc">
            Programın en güncel sürümde olup olmadığını GitHub üzerinden kontrol edebilirsiniz.
          </p>

          {/* Statik bilgi kutusu */}
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: '20px', marginTop: '48px'
          }}>
            <div style={{ fontSize: '64px' }}>🔄</div>
            <p style={{ fontSize: '14px', color: '#64748b', textAlign: 'center', maxWidth: '320px', lineHeight: '1.6' }}>
              Güncellemeleri kontrol etmek için aşağıdaki butona tıklayın.
            </p>
            <button
              className="printer-save-btn"
              onClick={handleCheckForUpdates}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '220px', justifyContent: 'center' }}
            >
              <RefreshCw size={16} /> Güncellemeleri Kontrol Et
            </button>
          </div>

          {/* ── Animasyonlu Güncelleme Modal ── */}
          {showUpdateModal && (
            <div style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 99999,
              animation: 'fadeIn 0.25s ease'
            }}>
              <div style={{
                background: '#fff',
                borderRadius: '20px',
                padding: '48px 40px',
                width: '420px',
                boxShadow: '0 25px 80px rgba(0,0,0,0.35)',
                textAlign: 'center',
                animation: 'slideUp 0.3s cubic-bezier(0.34,1.56,0.64,1)'
              }}>

                {/* CHECKING */}
                {updateStatus === 'checking' && (
                  <>
                    <div style={{ marginBottom: '24px' }}>
                      <Loader2 size={64} style={{ color: '#38bdf8', animation: 'spin 1s linear infinite' }} />
                    </div>
                    <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>
                      Güncelleme Denetleniyor...
                    </h3>
                    <p style={{ fontSize: '13px', color: '#94a3b8' }}>GitHub deposu sorgulanıyor, lütfen bekleyin.</p>
                  </>
                )}

                {/* UP TO DATE */}
                {updateStatus === 'up-to-date' && (
                  <>
                    <div style={{ fontSize: '72px', marginBottom: '16px', animation: 'bounceIn 0.4s ease' }}>✅</div>
                    <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#16a34a', marginBottom: '8px' }}>
                      Yazılımınız güncel.
                    </h3>
                    {updateInfo?.currentVersion && (
                      <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '24px' }}>
                        Mevcut sürüm: <strong>{updateInfo.currentVersion}</strong>
                      </p>
                    )}
                    <button
                      onClick={() => { setShowUpdateModal(false); setUpdateStatus('idle'); }}
                      style={{
                        padding: '12px 36px', background: '#16a34a',
                        border: 'none', borderRadius: '10px', color: '#fff',
                        fontWeight: '700', fontSize: '15px', cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(22,163,74,0.35)'
                      }}
                    >Tamam</button>
                  </>
                )}

                {/* UPDATE AVAILABLE */}
                {updateStatus === 'update-available' && (
                  <>
                    <div style={{ fontSize: '72px', marginBottom: '16px', animation: 'bounceIn 0.4s ease' }}>🆕</div>
                    <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#0ea5e9', marginBottom: '8px' }}>
                      Yeni sürüm mevcut!
                    </h3>
                    <p style={{ fontSize: '15px', color: '#0f172a', fontWeight: '700', marginBottom: '4px' }}>
                      v{updateInfo?.latestVersion}
                    </p>
                    {updateInfo?.currentVersion && (
                      <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '24px' }}>
                        Mevcut: v{updateInfo.currentVersion}
                      </p>
                    )}
                    {/* Changelog / Bu Sürümde Değişenler */}
                    {updateInfo?.releaseNotes && (
                      <div style={{
                        margin: '0 0 20px',
                        textAlign: 'left',
                        background: '#f0f9ff',
                        border: '1px solid #bae6fd',
                        borderRadius: '10px',
                        padding: '12px 14px'
                      }}>
                        <div style={{ fontSize: '12px', fontWeight: '700', color: '#0369a1', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          📋 Bu Sürümde Değişenler
                        </div>
                        <div style={{
                          fontSize: '12px', color: '#1e293b', lineHeight: '1.7',
                          maxHeight: '110px', overflowY: 'auto',
                          whiteSpace: 'pre-wrap', fontFamily: 'inherit'
                        }}>
                          {updateInfo.releaseNotes}
                        </div>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                      <button
                        onClick={() => {
                          if (updateInfo?.url) window.electronAPI?.openExternal?.(updateInfo.url);
                          setShowUpdateModal(false);
                        }}
                        style={{
                          padding: '12px 28px',
                          background: 'linear-gradient(135deg,#0ea5e9,#0284c7)',
                          border: 'none', borderRadius: '10px', color: '#fff',
                          fontWeight: '700', fontSize: '14px', cursor: 'pointer',
                          boxShadow: '0 4px 12px rgba(14,165,233,0.4)'
                        }}
                      >⬇ Şimdi Güncelle</button>
                      <button
                        onClick={() => { setShowUpdateModal(false); setUpdateStatus('idle'); }}
                        style={{
                          padding: '12px 28px', background: '#f1f5f9',
                          border: '2px solid #e2e8f0', borderRadius: '10px',
                          color: '#475569', fontWeight: '700', fontSize: '14px', cursor: 'pointer'
                        }}
                      >İptal</button>
                    </div>
                  </>
                )}

                {/* ERROR */}
                {updateStatus === 'error' && (
                  <>
                    <div style={{ fontSize: '72px', marginBottom: '16px' }}>❌</div>
                    <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#ef4444', marginBottom: '8px' }}>
                      Bağlantı hatası
                    </h3>
                    <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '24px' }}>
                      {updateInfo?.error || 'GitHub\'a ulaşılamadı. İnternet bağlantınızı kontrol edin.'}
                    </p>
                    <button
                      onClick={() => { setShowUpdateModal(false); setUpdateStatus('idle'); }}
                      style={{
                        padding: '12px 36px', background: '#ef4444',
                        border: 'none', borderRadius: '10px', color: '#fff',
                        fontWeight: '700', fontSize: '14px', cursor: 'pointer'
                      }}
                    >Kapat</button>
                  </>
                )}
              </div>
            </div>
          )}
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
