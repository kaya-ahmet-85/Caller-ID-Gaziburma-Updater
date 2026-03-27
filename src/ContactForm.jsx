import { useState, useRef } from 'react';
import { MessageSquare, Send, CheckCircle, XCircle, Loader, X, Paperclip } from 'lucide-react';
import './ContactForm.css';

const ALLOWED_TYPES = ['image/jpeg','image/png','image/gif','image/webp','application/pdf','text/plain'];
const MAX_SIZE_MB = 10;

export default function ContactForm() {
  const [name, setName]             = useState('');
  const [subject, setSubject]       = useState('');
  const [message, setMessage]       = useState('');
  const [attachment, setAttachment] = useState(null); // { base64, filename, mimeType }
  const [status, setStatus]         = useState('idle'); // idle | sending | success | error
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      alert('Desteklenmeyen dosya türü. Lütfen PNG, JPEG, GIF, WEBP, PDF veya TXT seçin.');
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      alert(`Dosya çok büyük. Maksimum ${MAX_SIZE_MB} MB.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      // reader.result → "data:image/png;base64,XXXX"
      const base64 = reader.result.split(',')[1];
      setAttachment({ base64, filename: file.name, mimeType: file.type });
    };
    reader.readAsDataURL(file);
    // Aynı dosyayı yeniden seçebilmek için input değerini sıfırla
    e.target.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    setStatus('sending');
    try {
      const result = await window.electronAPI.sendTelegramMessage({
        name, subject, message,
        attachment: attachment || null
      });
      setStatus(result.ok ? 'success' : 'error');
      if (result.ok) {
        setTimeout(() => {
          setName(''); setSubject(''); setMessage('');
          setAttachment(null); setStatus('idle');
        }, 3500);
      }
    } catch {
      setStatus('error');
    }
  };

  return (
    <div className="cf-container">
      {/* Kapatma Butonu */}
      <button className="cf-close-btn" onClick={() => window.close()} title="Kapat">
        <X size={18} />
      </button>

      <div className="cf-header">
        <MessageSquare size={22} className="cf-header-icon" />
        <div>
          <h2 className="cf-title">Bize Yazın</h2>
          <p className="cf-subtitle">Görüş, öneri veya şikayetlerinizi iletin</p>
        </div>
      </div>

      <form className="cf-form" onSubmit={handleSubmit}>
        <div className="cf-field">
          <label className="cf-label">Adınız / Unvanınız <span className="cf-optional">(isteğe bağlı)</span></label>
          <input
            className="cf-input"
            type="text"
            placeholder="Ahmet Yılmaz"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={status === 'sending'}
          />
        </div>

        <div className="cf-field">
          <label className="cf-label">Konu <span className="cf-optional">(isteğe bağlı)</span></label>
          <input
            className="cf-input"
            type="text"
            placeholder="Örn: Öneri, Şikayet, Hata bildirimi…"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={status === 'sending'}
          />
        </div>

        <div className="cf-field">
          <label className="cf-label">Mesajınız <span className="cf-required">*</span></label>
          <textarea
            className="cf-textarea"
            placeholder="Mesajınızı buraya yazın…"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={status === 'sending'}
            rows={5}
          />
        </div>

        {/* Attachment Alanı */}
        <div className="cf-field">
          <label className="cf-label">Dosya Ekle <span className="cf-optional">(isteğe bağlı)</span></label>

          {attachment ? (
            <div className="cf-attachment-preview">
              <Paperclip size={14} className="cf-attachment-icon" />
              <span className="cf-attachment-name" title={attachment.filename}>
                {attachment.filename}
              </span>
              <button
                type="button"
                className="cf-attachment-remove"
                onClick={() => setAttachment(null)}
                title="Dosyayı kaldır"
              >
                <X size={13} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="cf-attach-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={status === 'sending'}
            >
              <Paperclip size={15} />
              Dosya Seç
            </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.txt"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <span className="cf-attachment-hint">PNG, JPEG, GIF, WEBP, PDF veya TXT — maks. 10 MB</span>
        </div>

        {status === 'success' && (
          <div className="cf-feedback cf-success">
            <CheckCircle size={18} />
            <span>Mesajınız başarıyla iletildi. Teşekkür ederiz!</span>
          </div>
        )}
        {status === 'error' && (
          <div className="cf-feedback cf-error">
            <XCircle size={18} />
            <span>Gönderilemedi. İnternet bağlantınızı kontrol edin.</span>
          </div>
        )}

        <button
          className="cf-submit"
          type="submit"
          disabled={status === 'sending' || !message.trim() || status === 'success'}
        >
          {status === 'sending'
            ? <><Loader size={16} className="cf-spin" /> Gönderiliyor…</>
            : <><Send size={16} /> Gönder</>}
        </button>
      </form>
    </div>
  );
}
