import React, { useEffect, useState } from 'react';
import './SplashScreen.css';

const SPOKES = Array.from({ length: 12 });

/**
 * SplashScreen — Sinematik Açılış Animasyonu
 *  1. Sol & sağ kenardan merkeze çizgi gelir
 *  2. Nokta → logo genişliğinde yatay açılır
 *  3. Çizgi yukarı-aşağı açılarak logo ortaya çıkar
 *  4. Spinner + lisans metni giriş yapar
 */
export default function SplashScreen({ onDone, duration = 4800 }) {
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setFadingOut(true), duration);
    const t2 = setTimeout(() => { if (onDone) onDone(); }, duration + 800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [duration, onDone]);

  return (
    <div className={`splash-overlay${fadingOut ? ' fade-out' : ''}`}>

      {/* Arka Plan Izgara */}
      <div className="splash-bg-grid" />

      {/* Sol Kenardan Gelen Çizgi */}
      <div className="splash-line-left" />

      {/* Sağ Kenardan Gelen Çizgi */}
      <div className="splash-line-right" />

      {/* Merkez Nokta (çizgiler birleşince çakar) */}
      <div className="splash-center-dot" />

      {/* Kızıl Çubuk Üst Yarısı — yukarı kayar */}
      <div className="splash-bar-top" />

      {/* Kızıl Çubuk Alt Yarısı — aşağı kayar */}
      <div className="splash-bar-bottom" />

      {/* Logo — clip-path ile yatay→dikey açılır */}
      <div className="splash-logo-wrap">
        <img
          src="/gaziburma-logo.png"
          alt="Gaziburma Mustafa"
          className="splash-logo"
          draggable={false}
        />
      </div>

      {/* Alt Alan: Spinner + Lisans (logo açıldıktan sonra giriş yapar) */}
      <div className="splash-bottom">
        <div className="splash-divider" />

        <div className="splash-spinner-wrap">
          <div className="splash-spinner" aria-label="Yükleniyor">
            {SPOKES.map((_, i) => <span key={i} className="spoke" />)}
          </div>
          <span className="splash-loading-text">Yükleniyor</span>
        </div>

        <p className="splash-license">
          Bu program, &lsquo;TeknoGöz Bilişim Sistemleri&rsquo; tarafından Gaziburma Mustafa&rsquo;ya lisanslanmış olup,<br />tüm hakları saklıdır.&nbsp;&reg;
        </p>
      </div>

      {/* Sağ-Alt: Sistem Etiketi */}
      <div className="splash-corner-info">Caller ID System v1.0</div>

      {/* Sol-Alt: Nabız Noktası */}
      <div className="splash-pulse-dot">
        <div className="splash-pulse-dot-inner" />
      </div>

    </div>
  );
}
