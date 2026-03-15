import React, { useState, useEffect, useRef } from 'react';
import { X, BookOpen, AlertCircle } from 'lucide-react';
import './Help.css';

const Help = () => {
  const handleClose = () => {
    if (window.electronAPI && window.electronAPI.closeHelp) {
      window.electronAPI.closeHelp();
    }
  };

  const [flashAlert, setFlashAlert] = useState(false);
  const flashTimerRef = useRef(null);

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

  return (
    <div className={`help-wrapper${flashAlert ? ' flash-alert-active' : ''}`}>
      {/* Özel Başlık Çubuğu */}
      <div className="title-bar">
        <div className="title-bar-drag-area"></div>
        <div className="title-bar-controls">
          <button className="control-btn close-btn" onClick={handleClose} title="Kapat">
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="help-container">
        <div className="help-header">
          <div className="help-header-content">
            <BookOpen size={28} className="help-icon" />
            <h1>GAZİBURMA MUSTAFA</h1>
            <h2>Sipariş Takip Sistemi Kullanım Kılavuzu</h2>
          </div>
        </div>

        <div className="help-content">
          <p className="help-intro">
            Bu kılavuz, Gaziburma Mustafa Sipariş Takip Sistemi'nin kullanımını 
            kolaylaştırmak amacıyla hazırlanmıştır. Sistemin tüm özellikleri ve günlük kullanım 
            senaryoları aşağıda detaylıca açıklanmıştır.
          </p>

          <div className="help-section">
            <h3>1. ÇAĞRI LİSTESİ VE AKILLI ARAMA EKRANI</h3>
            <p>Ekranın sağ tarafında yer alan "Çağrı Listesi" bölümü, gün içerisinde gelen aramaları kaydeder ve kolayca geriye dönük arama yapmanıza olanak tanır.</p>
            
            <h4>Akıllı Arama Kutucuğu Nasıl Kullanılır?</h4>
            <p>Çağrı listesinin hemen üzerinde, büyüteç ikonlu bir arama kutucuğu bulunmaktadır. Bu kutucuk "Her Şeyi Arama" (Omni-Search) özelliğine sahiptir.</p>
            <ul>
              <li><strong>Müşteri Adıyla Arama:</strong> Kutuya örneğin "Ahmet" yazdığınızda, listedeki tüm Ahmet isimli müşterilerin aramalarını anında filtreler.</li>
              <li><strong>Numarayla Arama:</strong> Kutuya numaranın bir kısmını yazdığınızda (örn: "532"), o rakamları içeren tüm aramalar süzülür.</li>
              <li><strong>Saat veya Hat ile Arama:</strong> Arama kutusuna "14:" yazarak saat 2'deki tüm aramaları veya sadece "Hat 2" yazarak 2. hattan gelen çağrıları listeleyebilirsiniz. Aramayı temizlemek için kutucuğun sağındaki <strong>(X)</strong> ikonuna basmanız yeterlidir.</li>
            </ul>

            <h4>Renk Kodları Neler Anlatır?</h4>
            <p>Listede aramalar bulundukları hatlara göre renklendirilmiştir:</p>
            <ul>
              <li><strong>HAT 1:</strong> Mavi zemin ve mavi etiket.</li>
              <li><strong>HAT 2:</strong> Yeşil zemin ve yeşil etiket.</li>
              <li><strong>HAT 3:</strong> Turuncu zemin ve turuncu etiket.</li>
            </ul>
            <p className="help-note">
              <AlertCircle size={14} /> 
              Listede adı sistemde kayıtlı olan müşterilerin isimleri, numaralarının hemen altında mavi renkli ve belirgin bir yazıyla gösterilmektedir.
            </p>
          </div>

          <div className="help-section">
            <h3>2. ANA EKRAN HAT KUTULARI VE İŞLEVLERİ</h3>
            <p>Ana ekranın sol kısmında "Hat 1, Hat 2 ve Hat 3" olmak üzere aktif cihaz durumunuzu gösteren 3 adet kutu bulunur. Bir çağrı geldiğinde bu kutular otomatik olarak güncellenir.</p>

            <h4>Kutuların Altındaki Butonlar Ne İşe Yarar?</h4>
            <p>Her hat kutusunun altında 3 adet temel eylem butonu vardır:</p>
            <ul>
              <li><strong>YAZDIR (Mavi):</strong> Ekranda görünen müşteri verisini yazdıran veya yazdırma ekranına gönderen butondur.</li>
              <li><strong>DÜZENLE / KAYDET (Yeşil):</strong> Henüz sistemde kayıtlı olmayan bir numara aradığında, müşteri adını veya adresini hemen oradaki kutucukların içine tıklayarak yazabilirsiniz. Düzenlemeyi bitirdiğinizde "KAYDET" butonuna basarak bu bilgiyi veritabanına ekleyebilirsiniz.</li>
              <li><strong>YENİLE (Mavi):</strong> Eğer müşterinin bilgisi web tarafında güncellenmiş ancak programa henüz yansımamışsa; yenile okuna bir kez bastığınızda o telefon numarasının en güncel verisini internetten anında geri çeker ve kutuyu günceller.</li>
            </ul>
          </div>

          <div className="help-section">
            <h3>3. VERİTABANI GÜNCELLEMESİ (SENKRONİZASYON)</h3>
            <p>Program, sol alt köşede yer alan "Database Güncellemesi" bölümü ile devamlı web sunucusuyla iletişim halindedir.</p>
            <ul>
              <li><strong>Otomatik Senkronizasyon:</strong> Program açıldığında ve sonrasında her 5 dakikada bir otomatik olarak arka planda tüm rehberi kontrol eder.</li>
              <li><strong>Manuel Senkronizasyon (Dönen Simge):</strong> Güncelleme yazısının yanındaki Dönen Ok simgesine tıkladığınızda, sistem beklemeden internetten tüm güncel veriyi anında çeker.</li>
              <li><strong>Güncelleniyor Animasyonu:</strong> Senkronizasyon sırasında simge İOS tarzı dönen bir tekerleğe dönüşür ve yazı animasyonlu olarak "Güncelleniyor..." şeklini alır.</li>
              <li><strong>İnternet Kesintisi Durumu:</strong> İnternetiniz koptuğunda, dönen simgenin üzerinde Kırmızı bir X belirir ve saatin yanına "(Son güncelleme)" notu düşülür. İnternet gelir gelmez arka planda kendiliğinden yeni verileri indirir.</li>
            </ul>
          </div>

          <div className="help-section">
            <h3>4. AYARLAR MENÜSÜ</h3>
            <p>Sol menüdeki "Ayarlar" butonuna tıkladığınızda bağımsız, yeni bir pencere açılır. Bu pencereden Hat ayarları, Ekran ayarları, Yazıcılar, Parola, Güncelleme, Log Kayıtları ve Yönetici Girişi gibi tüm donanım ve yazılım parametrelerine ulaşabilirsiniz.</p>
            <p className="help-note">
              <AlertCircle size={14} /> 
              Ayarlar penceresini kapattığınızda ana program arka planda kusursuz bir şekilde çalışmaya devam eder.
            </p>
          </div>
          
          <div className="help-footer">
            <p>Sorun bildirimleri veya ek talepleriniz için sistem yöneticinize veya yazılım destek ekibinize başvurabilirsiniz.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Help;
