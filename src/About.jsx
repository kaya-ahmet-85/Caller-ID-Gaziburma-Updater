import React, { useState, useEffect } from 'react';
import { X, Tag, ShieldCheck, Phone } from 'lucide-react';
import './About.css';

export default function About() {
  const [versionInfo, setVersionInfo] = useState({ version: 'V1.0.0', date: '...' });
  // GitHub'dan gelen en son versiyon (bağlantı kurulduğunda dolar)
  const [latestVersion, setLatestVersion] = useState(null); // örn: 'V1.2.0'
  const [hasUpdate, setHasUpdate] = useState(false);

  useEffect(() => {
    // Yerel versiyon bilgisini yükle
    if (window.electronAPI?.getVersion) {
      window.electronAPI.getVersion().then(info => {
        if (info) setVersionInfo(info);
      });
    }

    // GitHub'dan güncelleme kontrolü
    window.electronAPI?.checkForUpdates?.().then(result => {
      if (result?.hasUpdate) {
        setHasUpdate(true);
        setLatestVersion(result.latestVersion);
      } else if (result?.currentVersion) {
        setVersionInfo(prev => ({ ...prev, version: result.currentVersion }));
      }
    }).catch(() => { /* sessiz hata */ });
  }, []);

  const handleClose = () => {
    window.close();
  };

  return (
    <div className="about-wrapper">
      {/* Başlık Çubuğu */}
      <div className="about-title-bar">
        <div className="about-title-drag">
          <span className="about-title-text">Hakkında</span>
        </div>
        <button className="about-close-btn" onClick={handleClose} title="Kapat">
          <X size={16} />
        </button>
      </div>

      {/* İçerik */}
      <div className="about-content">
        {/* Logo */}
        <div className="about-logo-wrap">
          <img
            src="/src/assets/logo.png"
            alt="Gaziburma Mustafa"
            className="about-logo"
            draggable={false}
          />
        </div>

        {/* Bölümler */}
        <div className="about-sections">

          {/* Versiyon */}
          <div className="about-section">
            <div className="about-section-icon">
              <Tag size={18} />
            </div>
            <div className="about-section-body">
              <div className="about-section-title">Versiyon</div>
              <div className="about-section-value">
                {versionInfo.version}
                <span className="about-version-date"> ({versionInfo.date})</span>
                {hasUpdate && latestVersion && (
                  <span style={{
                    marginLeft: '10px',
                    padding: '2px 10px',
                    background: '#0ea5e9',
                    color: '#fff',
                    borderRadius: '20px',
                    fontSize: '11px',
                    fontWeight: '700',
                    verticalAlign: 'middle'
                  }}>
                    ↑ {latestVersion} mevcut
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Lisans */}
          <div className="about-section">
            <div className="about-section-icon">
              <ShieldCheck size={18} />
            </div>
            <div className="about-section-body">
              <div className="about-section-title">Lisans</div>
              <div className="about-section-value about-license-text">
                Bu yazılım, yalnızca <strong>'Gaziburma Mustafa'</strong> adına lisanslanmıştır.
                Yazılımın üçüncü kişiler tarafından izinsiz kullanılması, kopyalanması veya
                dağıtılması halinde tüm yasal haklar{' '}
                <strong>'TeknoGöz Bilişim Sistemleri'</strong> tarafından saklı tutulur.
              </div>
            </div>
          </div>

          {/* İletişim */}
          <div className="about-section">
            <div className="about-section-icon">
              <Phone size={18} />
            </div>
            <div className="about-section-body">
              <div className="about-section-title">İletişim</div>
              <div className="about-section-value">
                TeknoGöz Bilişim Sistemleri
                <span className="about-phone"> (534) 354 74 95</span>
              </div>
            </div>
          </div>

        </div>

        {/* Alt Bant */}
        <div className="about-footer">
          © 2026 TeknoGöz Bilişim Sistemleri — Tüm hakları saklıdır.
        </div>
      </div>
    </div>
  );
}
