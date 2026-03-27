/**
 * licenseCheck.js — Firestore REST API ile lisans doğrulama
 * Firebase SDK gerektirmez; Node.js'in built-in https modülü kullanılır.
 */

const https    = require('https');
const { app }  = require('electron');
const path     = require('path');
const fs       = require('fs');
const os       = require('os');
const crypto   = require('crypto');

const FIREBASE_PROJECT = 'caller-id-gaziburma';
const FIREBASE_API_KEY = 'AIzaSyCUcalTqGg4hvZuD8ouxdhz0oIz1EUojIY';

// ── Yardımcı: HTTPS GET/PATCH ────────────────────────────────────────────────
const httpsRequest = (options, body = null) => new Promise((resolve, reject) => {
  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', chunk => { data += chunk; });
    res.on('end', () => {
      try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
      catch (e) { resolve({ status: res.statusCode, body: data }); }
    });
  });
  req.on('error', reject);
  if (body) req.write(JSON.stringify(body));
  req.end();
});

// ── Firestore REST: licenses koleksiyonundan dokümanı ID ile getir ───────────
// Artık licenseKey field'ı aranmaz; girilən key doğrudan Document ID'sidir.
const getLicenseDoc = async (licenseKey) => {
  const docPath = `/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/licenses/${encodeURIComponent(licenseKey)}`;

  return httpsRequest({
    hostname: 'firestore.googleapis.com',
    path: `${docPath}?key=${FIREBASE_API_KEY}`,
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });
};

// ── Firestore REST: document güncelle (deviceId yaz) ────────────────────────
const patchDocument = async (docPath, deviceId) => {
  return httpsRequest({
    hostname: 'firestore.googleapis.com',
    path: `/v1/${docPath}?key=${FIREBASE_API_KEY}&updateMask.fieldPaths=deviceId`,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' }
  }, {
    fields: { deviceId: { stringValue: deviceId } }
  });
};

// ── Yerel Config Dosyası ─────────────────────────────────────────────────────
const getLicensePath = () => path.join(app.getPath('userData'), 'license.json');

const readLocalLicense = () => {
  try {
    const p = getLicensePath();
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch (e) { /* ignore */ }
  return null;
};

const writeLocalLicense = (data) => {
  try { fs.writeFileSync(getLicensePath(), JSON.stringify(data, null, 2), 'utf-8'); }
  catch (e) { console.error('[License] Yerel kayıt hatası:', e.message); }
};

// ── Cihaz ID Üretici ─────────────────────────────────────────────────────────
const getDeviceId = () => {
  const raw = `${os.hostname()}-${os.platform()}-${os.arch()}-${os.cpus()[0]?.model || ''}`;
  return crypto.createHash('sha256').update(raw).digest('hex').substring(0, 32);
};

// ── Ana Doğrulama Fonksiyonu ─────────────────────────────────────────────────
const verifyLicense = async (licenseKey) => {
  if (!licenseKey || licenseKey.trim() === '') {
    return { valid: false, message: 'Lisans anahtarı boş olamaz.' };
  }

  const key      = licenseKey.trim();
  const deviceId = getDeviceId();

  try {
    const res = await getLicenseDoc(key);

    // 404 → belgé yok
    if (res.status === 404) {
      return { valid: false, message: 'Lisans anahtarı bulunamadı.' };
    }
    if (res.status !== 200 || !res.body?.fields) {
      throw new Error(`Beklenmeyen yanıt (${res.status}): ${JSON.stringify(res.body)}`);
    }

    const fields  = res.body.fields || {};
    const active  = fields.active?.booleanValue;
    const docDev  = fields.deviceId?.stringValue || '';
    const docPath = res.body.name; // projects/.../documents/licenses/xxx

    if (!active) {
      return { valid: false, message: 'Bu lisans devre dışı bırakılmış.' };
    }

    // Cihaz ID kontrolü
    if (docDev && docDev !== deviceId) {
      return { valid: false, message: 'Bu lisans başka bir cihaza kayıtlı.' };
    }

    // İlk aktivasyon: deviceId'yi Firestore'a yaz
    if (!docDev) {
      console.log('[License] İlk aktivasyon: deviceId yazılıyor...');
      await patchDocument(docPath, deviceId);
    }

    // Yerel cache'e kaydet
    writeLocalLicense({ licenseKey: key, deviceId, activatedAt: new Date().toISOString() });
    return { valid: true, message: 'Lisans geçerli.' };

  } catch (err) {
    console.error('[License] Firestore hatası:', err.message);
    // Çevrimdışı fallback
    const local = readLocalLicense();
    if (local && local.licenseKey === key && local.deviceId === deviceId) {
      console.warn('[License] Çevrimdışı — yerel cache ile doğrulandı.');
      return { valid: true, message: 'Çevrimdışı doğrulama.' };
    }
    return { valid: false, message: `Sunucuya bağlanılamadı: ${err.message}` };
  }
};

module.exports = { verifyLicense, readLocalLicense, getDeviceId };
