const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const crypto = require('crypto');
const child_process = require('child_process');

// const HID = require('node-hid'); // Artık C# Bridge kullanıyoruz
const callerIdParser = require('./callerIdParser.js').default || require('./callerIdParser.js');
const stateStore = require('./stateStore.js');
// Vite'nin varsayılan geliştirme sunucusu portu
const isDev = process.env.NODE_ENV === 'development';

// ====== RAW YAZICI DLL CACHE ======
// C# kodu her seferinde derlenmek yerine bir kez derlenir ve DLL olarak kaydedilir.
// Sonraki çağrılarda sadece DLL yüklenir (~100ms vs ~3-5sn derleme süresi).
let rawPrinterDllPath = null; // app.getPath('userData') app.ready sonrası kullanılabilir

// Tüm PS scriptleri için ortak RawPrinterCore tanımını yükleyen PS başlığı
const getRawPrinterPsHeader = () => {
  const dllPath = rawPrinterDllPath.replace(/\\/g, '\\\\');
  return `
$dllPath = "${dllPath}"
$typeDef = @'
using System;
using System.Runtime.InteropServices;
public class RawPrinterCore {
    [DllImport("winspool.drv", CharSet=CharSet.Ansi)]
    public static extern bool OpenPrinter(string pPrinterName, out IntPtr hPrinter, IntPtr pDefault);
    [DllImport("winspool.drv")]
    public static extern bool ClosePrinter(IntPtr hPrinter);
    [DllImport("winspool.drv", CharSet=CharSet.Ansi)]
    public static extern int StartDocPrinter(IntPtr hPrinter, int Level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);
    [DllImport("winspool.drv")]
    public static extern bool EndDocPrinter(IntPtr hPrinter);
    [DllImport("winspool.drv")]
    public static extern bool StartPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.drv")]
    public static extern bool EndPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.drv")]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Ansi)]
    public class DOCINFOA {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }
}
'@
if (-not (Test-Path $dllPath)) {
    Add-Type -TypeDefinition $typeDef -OutputAssembly $dllPath -ErrorAction Stop
}
Add-Type -Path $dllPath -ErrorAction Stop
`;
};

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    frame: false, // Çerçeveyi kaldır
    transparent: false,
    show: false,
    // Önce kapalı başlatıp sonra maximize edeceğiz
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../electron/preload.cjs')
    }
  });

  // Üst menü çubuğunu tamamen kaldır (File, Edit vb.)
  mainWindow.setMenu(null);

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize(); // Tam ekran (Maximize) başlat
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ====== MODAL PENCERE YARDIMCI FONKSİYONU ======
// İleride eklenecek tüm alt pencereler (Ayarlar, Yardım, vb.) bu fonksiyon ile oluşturulmalıdır.
// Bu sayede her alt pencere otomatik olarak modal olur ve ana pencereyi bloklar.
// Ana pencereye tıklanırsa Windows otomatik hata sesi çalar.
function createChildWindow(options = {}) {
  const childWindow = new BrowserWindow({
    width: options.width || 900,
    height: options.height || 600,
    minWidth: options.minWidth || 700,
    minHeight: options.minHeight || 500,
    parent: mainWindow,    // Ana pencereye bağla
    modal: true,           // Modal yap (Ana pencere bloklanır, tıklanırsa sistem sesi çalar)
    frame: false,
    transparent: false,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../electron/preload.cjs')
    }
  });

  childWindow.setMenu(null);

  // URL veya hash route yükle
  if (options.route) {
    if (isDev) {
      childWindow.loadURL(`http://localhost:5173/#/${options.route}`);
    } else {
      const distPath = path.join(__dirname, '../../dist', 'index.html');
      childWindow.loadURL(`file://${distPath}#/${options.route}`);
    }
  }

  childWindow.once('ready-to-show', () => {
    childWindow.show();
  });

  return childWindow;
}

// ====== C# BRIDGE CALLER ID ENTEGRASYONU ======
const { spawn } = require('child_process');
let bridgeProcess = null;

function connectToCallerId() {
  const bridgePath = path.join(__dirname, 'bridge/GCallerIDBridge.exe');
  console.log('Caller ID Bridge başlatılıyor:', bridgePath);

  try {
    bridgeProcess = spawn(bridgePath, [], {
      cwd: path.dirname(bridgePath)
    });

    bridgeProcess.stdout.on('data', (data) => {
      const output = data.toString();
      // Satırları \r\n veya \n formatına göre ayırıp her birini trim et
      const lines = output.split(/\r?\n/);

      lines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
          callerIdParser.handleBridgeData(trimmed);
        } else if (trimmed) {
          console.log('[Bridge Log]:', trimmed);
        }
      });
    });

    bridgeProcess.stderr.on('data', (data) => {
      console.error('[Bridge Error]:', data.toString());
    });

    bridgeProcess.on('close', (code) => {
      console.log(`Bridge süreci kapandı (Kod: ${code}). 3 saniye sonra yeniden denenecek...`);
      bridgeProcess = null;
      if (mainWindow) mainWindow.webContents.send('usb-status', false);
      setTimeout(connectToCallerId, 3000);
    });

    if (mainWindow) mainWindow.webContents.send('usb-status', true);

  } catch (error) {
    console.error('Bridge başlatılamadı:', error);
    if (mainWindow) mainWindow.webContents.send('usb-status', false);
    setTimeout(connectToCallerId, 5000);
  }
}

console.log("ELECTRON OBJESI:", require('electron'));

app.whenReady().then(() => {
  // DLL cache yolunu app.userData altında tanımla (app ready sonrası kullanılabilir)
  rawPrinterDllPath = path.join(app.getPath('userData'), 'raw_printer_core.dll');
  console.log('[RawPrinter] DLL cache yolu:', rawPrinterDllPath);

  createWindow();
  connectToCallerId();

  // Parser'dan gelen onRing eventini React'a dinletmek
  callerIdParser.on('onRing', (callData) => {
    if (mainWindow) {
      mainWindow.webContents.send('caller-id-data', callData);
    }
  });
  callerIdParser.on('onIdle', (idleData) => {
    if (mainWindow) {
      mainWindow.webContents.send('caller-id-data', idleData);
    }
  });

  callerIdParser.on('sync-status', (syncInfo) => {
    if (mainWindow) {
      mainWindow.webContents.send('sync-status', syncInfo);
    }
  });

  callerIdParser.on('global-data-updated', () => {
    if (mainWindow) {
      mainWindow.webContents.send('global-data-updated');
    }
  });

  // Parser'dan gelen USB durum değişikliklerini arayüze ilet
  callerIdParser.on('usb-status', (status) => {
    if (mainWindow) {
      mainWindow.webContents.send('usb-status', status);
    }
  });

  // İnternet durumunu ana süreçten de kontrol edelim (Arayüz bazen yakalayamıyor)
  setInterval(() => {
    const isOnline = require('electron').net.isOnline();
    if (mainWindow) {
      mainWindow.webContents.send('internet-status', isOnline);
    }
  }, 5000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
  ipcMain.handle('manual-refresh', async (event, { lineLabel, phone }) => {
    return await callerIdParser.manualRefresh(lineLabel, phone);
  });

  ipcMain.handle('lookup-customer', (event, phone) => {
    return callerIdParser.lookupCustomer(phone);
  });

  ipcMain.handle('force-sync', () => {
    callerIdParser.forceSync();
  });

  ipcMain.handle('advanced-search', (event, query) => {
    return callerIdParser.searchDatabase(query);
  });

  // ====== MODAL PENCERE GÖRSEL UYARI (KIRMIZI GÖLGE) ======
  // ====== MÜŞTERİ DÜZENLEME PENCERESİ (Electron BrowserWindow) ======
  // Sistem tarayıcısı yerine Electron penceresi kullanılır; böylece sayfa
  // yüklendikten sonra executeJavaScript() ile Ajax filtresi tetiklenebilir.
  ipcMain.on('open-customer-edit', (event, { customerId, phone }) => {
    const BASE_URL = "https://gaziburma.com/api/index.php?anahtar=;_u9uhe!M5%3C:pMB^";

    const editWin = new BrowserWindow({
      width: 1280,
      height: 860,
      minWidth: 900,
      minHeight: 600,
      title: 'Gaziburma Web Arayüzü',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    editWin.setMenu(null);
    editWin.maximize();          // Tam ekran (Maximize) olarak aç
    editWin.loadURL(BASE_URL);

    // Sayfa tamamen yüklenince filtre JS'ini enjekte et
    // 600ms gecikme: DataTables init + Ajax tablo verisi yüklenmesi için bekliyoruz
    editWin.webContents.on('did-finish-load', () => {
      // Telefon numarasını her zaman kullan (ID güvenilir değil)
      // Virgüllü çoklu numaralarda sadece ilkini al: "0533...,0212..." → "0533..."
      const rawPhone = phone && phone !== 'Veri Bekleniyor' && phone !== 'Bilinmiyor'
        ? String(phone).split(/[,;\s]+/)[0].trim()
        : null;

      if (!rawPhone) return;

      setTimeout(() => {
        const jsCode = `
          (function() {
            var phoneInput = document.querySelector("input.col-search-input[placeholder='Müşteri Telefon Numarası']");

            if (!phoneInput) {
              console.warn('[CallerID] Telefon arama kutusu bulunamadı!');
              return;
            }

            phoneInput.value = ${JSON.stringify(rawPhone)};

            phoneInput.dispatchEvent(new Event('input',  { bubbles: true }));
            phoneInput.dispatchEvent(new Event('change', { bubbles: true }));
            phoneInput.dispatchEvent(new KeyboardEvent('keyup', {
              bubbles: true, cancelable: true,
              key: 'Enter', code: 'Enter', keyCode: 13, which: 13
            }));

            console.log('[CallerID] Telefon filtresi tetiklendi:', ${JSON.stringify(rawPhone)});
          })();
        `;

        editWin.webContents.executeJavaScript(jsCode).catch(err => {
          console.error('[EditCustomer] JS enjeksiyon hatası:', err.message);
        });
      }, 600);
    });

    editWin.on('closed', () => { /* temizlik gerekmez */ });
  });

  // ====== MODAL PENCERE GÖRSEL UYARI (KIRMIZI GÖLGE) ======
  // Modal pencere açıkken kullanıcı arka planı tıkladığında, OS sesli uyarı verir.
  // Bu fonksiyon ek olarak pencereye 'flash-alert' IPC mesajı göndererek
  // frontend'de kırmızı gölge CSS animasyonunu tetikler.
  const flashAlertWindow = (win) => {
    if (!win || win.isDestroyed()) return;
    win.webContents.send('flash-alert');
  };

  // Ayarlar Penceresi (Modal - createChildWindow helper kullanılıyor)
  let settingsWindow = null;
  ipcMain.on('open-settings', () => {
    if (settingsWindow) {
      if (settingsWindow.isMinimized()) settingsWindow.restore();
      settingsWindow.focus();
      return;
    }

    settingsWindow = createChildWindow({
      width: 900, height: 750, minWidth: 800, minHeight: 650,
      route: 'settings'
    });

    // Windows modal pencereye arka plan tıklandığında modal'a
    // yeniden focus gönderiyor — bunu yakalıyoruz.
    // İlk açılıştaki focus'u atlamak için 900ms guard kullanılıyor.
    let settingsFocusReady = false;
    setTimeout(() => { settingsFocusReady = true; }, 900);
    const onSettingsFocus = () => { if (settingsFocusReady) flashAlertWindow(settingsWindow); };
    settingsWindow.on('focus', onSettingsFocus);

    settingsWindow.on('closed', () => {
      settingsWindow.removeListener('focus', onSettingsFocus);
      settingsWindow = null;
    });
  });

  ipcMain.on('close-settings', () => {
    if (settingsWindow) {
      settingsWindow.close();
    }
  });

  // Yardım Penceresi (Modal - createChildWindow helper kullanılıyor)
  let helpWindow = null;
  ipcMain.on('open-help', () => {
    if (helpWindow) {
      if (helpWindow.isMinimized()) helpWindow.restore();
      helpWindow.focus();
      return;
    }

    helpWindow = createChildWindow({
      width: 850, height: 700, minWidth: 700, minHeight: 500,
      route: 'help'
    });

    // Aynı mekanizma: Help modal'a arka plan tıklandığında focus eventi yanı alınıyor.
    let helpFocusReady = false;
    setTimeout(() => { helpFocusReady = true; }, 900);
    const onHelpFocus = () => { if (helpFocusReady) flashAlertWindow(helpWindow); };
    helpWindow.on('focus', onHelpFocus);

    helpWindow.on('closed', () => {
      helpWindow.removeListener('focus', onHelpFocus);
      helpWindow = null;
    });
  });

  ipcMain.on('close-help', () => {
    if (helpWindow) {
      helpWindow.close();
    }
  });

  // Hakkında Penceresi
  let aboutWindow = null;
  ipcMain.on('open-about', () => {
    if (aboutWindow) {
      if (aboutWindow.isMinimized()) aboutWindow.restore();
      aboutWindow.focus();
      return;
    }

    aboutWindow = createChildWindow({
      width: 500, height: 440, minWidth: 460, minHeight: 400,
      route: 'about'
    });

    let aboutFocusReady = false;
    setTimeout(() => { aboutFocusReady = true; }, 900);
    const onAboutFocus = () => { if (aboutFocusReady) flashAlertWindow(aboutWindow); };
    aboutWindow.on('focus', onAboutFocus);

    aboutWindow.on('closed', () => {
      aboutWindow.removeListener('focus', onAboutFocus);
      aboutWindow = null;
    });
  });

  // ====== VERSİYON YÖNETİMİ ======
  const versionConfigPath = path.join(app.getPath('userData'), 'version-config.json');

  const getVersionConfig = () => {
    try {
      if (fs.existsSync(versionConfigPath)) {
        return JSON.parse(fs.readFileSync(versionConfigPath, 'utf-8'));
      }
    } catch (e) { console.error('Versiyon config okunamadı:', e); }
    // Varsayılan: V1.0.0 + bugünün tarihi
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    return { version: 'V1.0.0', date: `${dd}.${mm}.${yyyy}` };
  };

  ipcMain.handle('get-version', () => getVersionConfig());

  ipcMain.handle('save-version', (event, { version, date }) => {
    try {
      fs.writeFileSync(versionConfigPath, JSON.stringify({ version, date }, null, 2), 'utf-8');
      return { success: true };
    } catch (e) {
      console.error('Versiyon config kaydedilemedi:', e);
      return { success: false, error: e.message };
    }
  });

  // ====== HAT NUMARALARI YÖNETİMİ ======
  const hatConfigPath = path.join(app.getPath('userData'), 'hat-config.json');

  ipcMain.handle('get-hat-numbers', () => {
    try {
      if (fs.existsSync(hatConfigPath)) {
        const data = JSON.parse(fs.readFileSync(hatConfigPath, 'utf-8'));
        return data.hatNumbers || { 1: '', 2: '', 3: '' };
      }
    } catch (e) { console.error('Hat config yüklenemedi:', e); }
    return { 1: '', 2: '', 3: '' };
  });

  ipcMain.handle('save-hat-numbers', (event, hatNumbers) => {
    try {
      fs.writeFileSync(hatConfigPath, JSON.stringify({ hatNumbers }, null, 2), 'utf-8');
      if (mainWindow) mainWindow.webContents.send('hat-numbers-updated', hatNumbers);
      return { success: true };
    } catch (e) {
      console.error('Hat config kaydedilemedi:', e);
      return { success: false, error: e.message };
    }
  });

  // ====== TEMA YÖNETİMİ (AÇIK / KOYU MOD) ======
  const themeConfigPath = path.join(app.getPath('userData'), 'theme-config.json');

  ipcMain.handle('get-theme', () => {
    try {
      if (fs.existsSync(themeConfigPath)) {
        const data = JSON.parse(fs.readFileSync(themeConfigPath, 'utf-8'));
        return data.theme || 'light';
      }
    } catch (e) { console.error('Tema config yüklenemedi:', e); }
    return 'light';
  });

  ipcMain.handle('save-theme', (event, theme) => {
    try {
      fs.writeFileSync(themeConfigPath, JSON.stringify({ theme }, null, 2), 'utf-8');
      // Ana pencereye tema değiştiğini bildir
      if (mainWindow) mainWindow.webContents.send('theme-updated', theme);
      return { success: true };
    } catch (e) {
      console.error('Tema config kaydedilemedi:', e);
      return { success: false, error: e.message };
    }
  });

  // ====== PAROLA YÖNETİMİ ======
  const passwordConfigPath = path.join(app.getPath('userData'), 'password-config.json');
  const sha256 = (str) => crypto.createHash('sha256').update(str).digest('hex');

  ipcMain.handle('get-password-config', () => {
    try {
      if (fs.existsSync(passwordConfigPath)) {
        const data = JSON.parse(fs.readFileSync(passwordConfigPath, 'utf-8'));
        // hash ve cevap hash'ini frontend'e döndürme — sadece meta verileri dön
        return { enabled: data.enabled || false, secretQuestion: data.secretQuestion || '' };
      }
    } catch (e) { console.error('Parola config okunamadı:', e); }
    return { enabled: false, secretQuestion: '' };
  });

  ipcMain.handle('save-password-config', (event, { enabled, password, secretQuestion, secretAnswer }) => {
    try {
      const existing = fs.existsSync(passwordConfigPath)
        ? JSON.parse(fs.readFileSync(passwordConfigPath, 'utf-8'))
        : {};
      const config = {
        enabled,
        passwordHash: password ? sha256(password) : (existing.passwordHash || ''),
        secretQuestion: secretQuestion || (existing.secretQuestion || ''),
        secretAnswerHash: secretAnswer ? sha256(secretAnswer.toLowerCase().trim()) : (existing.secretAnswerHash || '')
      };
      fs.writeFileSync(passwordConfigPath, JSON.stringify(config, null, 2), 'utf-8');
      return { success: true };
    } catch (e) {
      console.error('Parola config kaydedilemedi:', e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('verify-password', (event, password) => {
    try {
      if (!fs.existsSync(passwordConfigPath)) return false;
      const data = JSON.parse(fs.readFileSync(passwordConfigPath, 'utf-8'));
      return data.passwordHash === sha256(password);
    } catch (e) { return false; }
  });

  ipcMain.handle('verify-secret-answer', (event, answer) => {
    try {
      if (!fs.existsSync(passwordConfigPath)) return false;
      const data = JSON.parse(fs.readFileSync(passwordConfigPath, 'utf-8'));
      return data.secretAnswerHash === sha256(answer.toLowerCase().trim());
    } catch (e) { return false; }
  });

  ipcMain.handle('reset-password', (event, newPassword) => {
    try {
      if (!fs.existsSync(passwordConfigPath)) return { success: false };
      const data = JSON.parse(fs.readFileSync(passwordConfigPath, 'utf-8'));
      data.passwordHash = sha256(newPassword);
      fs.writeFileSync(passwordConfigPath, JSON.stringify(data, null, 2), 'utf-8');
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // ====== YÖNETİCİ ŞİFRESİ ======
  // Sabit yönetici şifresi — SHA-256 hash olarak saklanır
  const ADMIN_PASSWORD_HASH = sha256('04011985teknogoz');

  ipcMain.handle('verify-admin-password', (event, pwd) => {
    return sha256(pwd) === ADMIN_PASSWORD_HASH;
  });

  ipcMain.handle('admin-disable-password', async (event, adminPwd) => {
    if (sha256(adminPwd) !== ADMIN_PASSWORD_HASH) {
      return { success: false, error: 'Yanlış yönetici şifresi.' };
    }
    try {
      const config = { enabled: false, passwordHash: '', secretQuestion: '', secretAnswerHash: '' };
      fs.writeFileSync(passwordConfigPath, JSON.stringify(config, null, 2), 'utf-8');
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // ====== DİL YÖNETİMİ ======
  const languageConfigPath = path.join(app.getPath('userData'), 'language-config.json');

  ipcMain.handle('get-language', () => {
    try {
      if (fs.existsSync(languageConfigPath)) {
        const data = JSON.parse(fs.readFileSync(languageConfigPath, 'utf-8'));
        return data.lang || 'tr';
      }
    } catch (e) { console.error('Dil config okunamadı:', e); }
    return 'tr';
  });

  ipcMain.handle('save-language', (event, lang) => {
    try {
      fs.writeFileSync(languageConfigPath, JSON.stringify({ lang }, null, 2), 'utf-8');
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('apply-language', async (event, lang) => {
    // 1. Dili kaydet
    try {
      fs.writeFileSync(languageConfigPath, JSON.stringify({ lang }, null, 2), 'utf-8');
    } catch (e) {
      return { success: false, error: e.message };
    }

    // 2. Settings penceresini kapat
    const senderWindow = BrowserWindow.fromWebContents(event.sender);
    if (senderWindow && senderWindow !== mainWindow) {
      senderWindow.close();
    }

    // 3. Ana pencereyi yeniden yükle (Vite dev server çalışmaya devam eder)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.reload();
    }

    return { success: true };
  });

  // ====== YAZICI YÖNETİMİ ======
  const printerConfigPath = path.join(app.getPath('userData'), 'printer-config.json');

  // Sistemdeki tüm yazıcıları listele
  ipcMain.handle('get-printers', async () => {
    try {
      const printers = await mainWindow.webContents.getPrintersAsync();
      return printers.map(p => ({
        name: p.name,
        displayName: p.displayName || p.name,
        description: p.description || '',
        status: p.status,
        isDefault: p.isDefault
      }));
    } catch (error) {
      console.error('Yazıcı listesi alınamadı:', error);
      return [];
    }
  });

  // Seçilen yazıcıyı kaydet
  ipcMain.handle('save-printer-selection', (event, printerName) => {
    try {
      const fs = require('fs');
      fs.writeFileSync(printerConfigPath, JSON.stringify({ selectedPrinter: printerName }, null, 2), 'utf-8');
      console.log('Yazıcı seçimi kaydedildi:', printerName);
      return { success: true };
    } catch (error) {
      console.error('Yazıcı seçimi kaydedilemedi:', error);
      return { success: false, error: error.message };
    }
  });

  // Kaydedilmiş yazıcı seçimini yükle
  ipcMain.handle('get-printer-selection', () => {
    try {
      const fs = require('fs');
      if (fs.existsSync(printerConfigPath)) {
        const data = JSON.parse(fs.readFileSync(printerConfigPath, 'utf-8'));
        return data.selectedPrinter || null;
      }
    } catch (error) {
      console.error('Yazıcı seçimi yüklenemedi:', error);
    }
    return null;
  });

  // ====== RAW HARDWARE CUT (YARDIMCI FONKSİYON) ======
  // Sadece kağıtı ilerletir ve keser. Yazdırma işleminden sonra çağırılmalıdır.
  const triggerHardwareCut = (printerName) => {
    const fs = require('fs');
    const os = require('os');
    const { execFile } = require('child_process');

    const ts = Date.now();
    const psPath = path.join(os.tmpdir(), `cid_cut_${ts}.ps1`);

    // 0x0A: Line Feed (İlerlet), 0x1D 0x56 0x42 0x00: GS V B 0 (Kesme Komutu)
    // DLL cache kullanarak hızlı yükleme (Add-Type -OutputAssembly ile bir kez derlenir)
    const psScript = getRawPrinterPsHeader() + `
$printerName = '${printerName.replace(/'/g, "''")}'
$bytes = [byte[]]@(0x0A, 0x0A, 0x0A, 0x0A, 0x0A, 0x1D, 0x56, 0x42, 0x00)

$hPrinter = [IntPtr]::Zero
$di = New-Object RawPrinterCore+DOCINFOA
$di.pDocName  = "CUT_COMMAND"
$di.pDataType = "RAW"

if ([RawPrinterCore]::OpenPrinter($printerName, [ref]$hPrinter, [IntPtr]::Zero)) {
    [RawPrinterCore]::StartDocPrinter($hPrinter, 1, $di) | Out-Null
    [RawPrinterCore]::StartPagePrinter($hPrinter) | Out-Null
    $ptr = [System.Runtime.InteropServices.Marshal]::AllocHGlobal($bytes.Length)
    [System.Runtime.InteropServices.Marshal]::Copy($bytes, 0, $ptr, $bytes.Length)
    $written = 0
    [RawPrinterCore]::WritePrinter($hPrinter, $ptr, $bytes.Length, [ref]$written) | Out-Null
    [System.Runtime.InteropServices.Marshal]::FreeHGlobal($ptr)
    [RawPrinterCore]::EndPagePrinter($hPrinter) | Out-Null
    [RawPrinterCore]::EndDocPrinter($hPrinter) | Out-Null
    [RawPrinterCore]::ClosePrinter($hPrinter) | Out-Null
}
`;
    fs.writeFileSync(psPath, psScript, 'utf-8');

    execFile(
      'powershell',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', psPath],
      { timeout: 15000 },
      () => {
        try { fs.unlinkSync(psPath); } catch (e) { }
      }
    );
  };

  // ====== YAZDIRMA (ESC/POS RAW PROTOCOL) ======
  ipcMain.handle('print-customer-info', async (event, { name, phone, address, callerPhone }) => {
    try {
      let selectedPrinter = null;
      if (fs.existsSync(printerConfigPath)) {
        const config = JSON.parse(fs.readFileSync(printerConfigPath, 'utf-8'));
        selectedPrinter = config.selectedPrinter || null;
      }
      if (!selectedPrinter) {
        return { success: false, error: 'Yazıcı seçilmemiş. Lütfen Ayarlar > Yazıcı(lar) bölümünden bir yazıcı seçin.' };
      }
      console.log('[Print] ESC/POS RAW yazdırma başladı:', selectedPrinter);

      const now = new Date();
      const tarih = now.toLocaleDateString('tr-TR');
      const saat = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

      // ================================================================
      // ŞABLON LAYOUT (sağ kenarlık 9mm sağa kaydırıldı → 70.5mm toplam)
      // Yatay çizgi formatı: |------...------|  (köşelerde + YOK)
      // Etiket: 17 char | Değer: 27 char → toplam 47 char (~70.5mm @ 1.5mm/char)
      // 1(|) + 17 + 1(|) + 27 + 1(|) = 47
      // ================================================================

      const W = 48;   // toplam satır genişliği
      const LBL = 17;   // etiket sütunu
      const VAL = 28;   // değer sütunu  (1+17+1+28+1 = 48)
      // Teslimat/Tutar: CAL=LBL ve CAR=VAL → orta | aynı pozisyonda
      const CAL = 31;   // Teslimat sol sütun (17mm sağa kaydırıldı: 17→31)
      const CAR = 14;   // Tutar sağ sütun  (17mm daraltıldı: 28→14)

      const pad = (str, len) => {
        const s = (str || '').toString().substring(0, len);
        return s + ' '.repeat(Math.max(0, len - s.length));
      };
      const center = (str, len) => {
        const s = (str || '').toString().substring(0, len);
        const sp = Math.max(0, len - s.length);
        return ' '.repeat(Math.floor(sp / 2)) + s + ' '.repeat(Math.ceil(sp / 2));
      };
      const rjust = (str, len) => {
        const s = (str || '').toString().substring(0, len);
        return ' '.repeat(Math.max(0, len - s.length)) + s;
      };
      // Turkce karakterler ASCII karsiliklarina donusturulur (yazici uyumlulugu)
      const normalizeTR = (str) => (str || '').toString()
        .replace(/\u015f/g, 's').replace(/\u015e/g, 'S')
        .replace(/\u011f/g, 'g').replace(/\u011e/g, 'G')
        .replace(/\u0131/g, 'i').replace(/\u0130/g, 'I')
        .replace(/\u00e7/g, 'c').replace(/\u00c7/g, 'C')
        .replace(/\u00f6/g, 'o').replace(/\u00d6/g, 'O')
        .replace(/\u00fc/g, 'u').replace(/\u00dc/g, 'U')
        .replace(/\u00e2/g, 'a').replace(/\u00ea/g, 'e')
        .replace(/\u00ee/g, 'i').replace(/\u00f4/g, 'o')
        .replace(/\u00fb/g, 'u').replace(/\u00e0/g, 'a');
      const textToBytes = (str) => {
        const s = normalizeTR(str);
        const result = [];
        for (let i = 0; i < s.length; i++) result.push(s.charCodeAt(i) & 0x7F);
        return result;
      };
      // Telefon numarasini (5XX) XXX XX XX veya (2XX) XXX XX XX formatina donusturur
      const fmtPhone = (raw) => {
        const digits = normalizeTR((raw || '').toString()).replace(/\D/g, '');
        let d = digits;
        if (d.length === 11 && d[0] === '0') d = d.slice(1); // bas?ndaki 0'? kaldir
        if (d.length === 10) {
          return '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + ' ' + d.slice(6, 8) + ' ' + d.slice(8);
        }
        return normalizeTR(raw || ''); // formatlanamiyorsa oldugu gibi
      };
      const hLine = () => '|' + '-'.repeat(LBL) + '|' + '-'.repeat(VAL) + '|';
      // Teslimat/Tutar ayracı
      const hLineCols = () => '|' + '-'.repeat(CAL) + '|' + '-'.repeat(CAR) + '|';

      // Standart 2 sütunlu satır: | etiket          | değer                  |
      const dataRow = (label, value) => {
        const rows = [];
        const maxV = VAL - 1;
        const valStr = (value || '').toString();
        const chunks = [];
        if (valStr.length === 0) {
          chunks.push('');
        } else {
          for (let i = 0; i < valStr.length; i += maxV) {
            chunks.push(valStr.substring(i, i + maxV));
          }
        }
        chunks.forEach((chunk, idx) => {
          const lbl = idx === 0 ? pad(label, LBL) : pad('', LBL);
          rows.push('|' + lbl + '|' + ' ' + pad(chunk, maxV) + '|');
        });
        return rows;
      };

      // Teslimat / Tutar satırı
      const colsRow = (left, right) => {
        return '|' + center(left, CAL) + '|' + center(right, CAR) + '|';
      };

      // ================================================================
      // FİŞ OLUŞTURMA
      // ================================================================
      const buildReceipt = () => {
        const ESC = 0x1B;
        const GS = 0x1D;
        const LF = 0x0A;
        const bytes = [];
        const push = (...args) => args.forEach(b => bytes.push(b));
        const line = (str) => { bytes.push(...textToBytes(str)); bytes.push(LF); };

        push(ESC, 0x40);         // Printer init
        push(ESC, 0x74, 0x12);   // PC857 Türkçe kod sayfası—ş,ğ,ı,İ vs. doğru basar

        // Sadece değer kısmını bold yapan yardımcı:
        // |label           |(BOLD)değer                    |(/BOLD) LF
        const boldValueRow = (label, value) => {
          const maxV = VAL - 1;
          const valStr = (value || '').toString();
          const chunks = valStr.length === 0 ? [''] :
            Array.from({ length: Math.ceil(valStr.length / maxV) },
              (_, i) => valStr.substring(i * maxV, (i + 1) * maxV));

          chunks.forEach((chunk, idx) => {
            const lbl = idx === 0 ? pad(label, LBL) : pad('', LBL);
            bytes.push(...textToBytes('|' + lbl + '|'));
            push(ESC, 0x45, 0x01);
            bytes.push(...textToBytes(' ' + pad(chunk, maxV) + '|'));
            push(ESC, 0x45, 0x00);
            push(LF);
          });
        };

        // minLines: en az bu kadar satir basilir (bos satir ile doldurulur)
        // maxLines: fazlasi kesilir
        const paddedBoldValueRow = (label, value, minLines, maxLines) => {
          const maxV = VAL - 1;
          const valStr = (value || '').toString();
          let chunks = [];
          if (valStr.length === 0) {
            chunks = [''];
          } else {
            for (let i = 0; i < valStr.length; i += maxV)
              chunks.push(valStr.substring(i, i + maxV));
          }
          // Max satir kap
          chunks = chunks.slice(0, maxLines);
          // Min satire tamamla (bos satir ile)
          while (chunks.length < minLines) chunks.push('');

          chunks.forEach((chunk, idx) => {
            const lbl = idx === 0 ? pad(label, LBL) : pad('', LBL);
            bytes.push(...textToBytes('|' + lbl + '|'));
            push(ESC, 0x45, 0x01);
            bytes.push(...textToBytes(' ' + pad(chunk, maxV) + '|'));
            push(ESC, 0x45, 0x00);
            push(LF);
          });
        };

        // === BASLIK: Gaziburma Logosu — ESC * (ESC a 1 ile ortalanir) ===
        try {
          const { nativeImage } = require('electron');
          const logoPath = require('path').join(__dirname, '..', 'Gaziburma Logo (1458x625).png');
          // 300 sutun ~ 42mm @ 180dpi; 58mm kagit ortasinda gözükür
          const COLS = 300;
          const logoH = Math.round(COLS * 625 / 1458); // ~128 piksel
          const img = nativeImage.createFromPath(logoPath)
            .resize({ width: COLS, height: logoH, quality: 'better' });
          const size = img.getSize();
          const rgba = img.getBitmap();

          // ESC a 1: orta hizala
          push(ESC, 0x61, 0x01);
          // ESC 3 24: satir araligini tam 24 noktaya ayarla (serit yuksekligi)
          // Bu olmadan LF varsayilan aralikla kağidi ilerletir => seritler arasinda bosluk!
          push(ESC, 0x33, 24);

          // ESC * mode 33 = 24-nokta cift yogunluk; 3 byte/sutun
          const STRIP = 24;
          for (let startRow = 0; startRow < size.height; startRow += STRIP) {
            push(ESC, 0x2A, 33, COLS & 0xFF, (COLS >> 8) & 0xFF);
            for (let col = 0; col < COLS; col++) {
              let b0 = 0, b1 = 0, b2 = 0;
              for (let dot = 0; dot < STRIP; dot++) {
                const row = startRow + dot;
                if (row < size.height) {
                  const idx = (row * size.width + col) * 4;
                  const r = rgba[idx], g = rgba[idx + 1], bv = rgba[idx + 2], a = rgba[idx + 3];
                  const gray = a < 128 ? 255 : Math.round(0.299 * r + 0.587 * g + 0.114 * bv);
                  if (gray < 128) {
                    if (dot < 8) b0 |= (0x80 >> dot);
                    else if (dot < 16) b1 |= (0x80 >> (dot - 8));
                    else b2 |= (0x80 >> (dot - 16));
                  }
                }
              }
              push(b0, b1, b2);
            }
            push(LF);
          }

          push(ESC, 0x32);        // Varsayilan satir araligina geri don (ESC 2)
          push(ESC, 0x61, 0x00);  // Sol hiza
          // Logo ile şablon arasında boşluk YOK (bitişik)
        } catch (e) {
          push(ESC, 0x61, 0x01);
          push(ESC, 0x45, 0x01);
          line('gaziburma');
          push(ESC, 0x45, 0x00);
          push(ESC, 0x61, 0x00);
        }

        // === HEADER TEK HÜCRE (2 satır) — ortada | yok ===
        // Üst yatay çizgi — köşeler | ile temiz
        line('|' + '-'.repeat(W - 2) + '|');
        // İç genişlik = W-2 = 46 char. Sol bölge = LBL(17), Sağ bölge = W-2-LBL(29)
        const hdrR = W - 2 - LBL; // 29 char — sağ yazı bölgesi (iç | yok)
        // Satir 1: Gaziburma ortali | Hat numarasi sag yali
        const headerPhoneStr = fmtPhone(callerPhone || '').substring(0, hdrR).trim();
        line('|' + center('Gaziburma', LBL) + rjust(headerPhoneStr, hdrR) + '|');
        // Satır 2: Mustafa sol bölge ortası | Pendik 4mm (~3 char) sağa kaydırılmış — TEK HÜCRE
        line('|' + center('Mustafa', LBL) + pad('   Pendik', hdrR) + '|');
        line(hLine());

        // === SİPARİŞ TARİHİ — değer bold ===
        boldValueRow('Siparis Tarihi:', `${tarih} ${saat}`);
        line(hLine());

        // === TESLİMAT TARİHİ ===
        dataRow('Teslimat Tarihi:', '').forEach(r => line(r));
        line(hLine());

        // === TEL -- deger bold, formatli ===
        boldValueRow('Tel:', fmtPhone(phone || ''));
        line(hLine());

        // === SİPARİŞ VEREN ===
        dataRow('Siparis Veren:', '').forEach(r => line(r));
        line(hLine());

        // === ALICI: min 1 satir, max 4 satir ===
        paddedBoldValueRow('Alici:', name || '', 1, 4);
        line(hLine());

        // === ADRES: min 2 satir, max 10 satir ===
        paddedBoldValueRow('Adres:', address || '', 2, 10);
        line(hLine());

        // === TESLİMAT | TUTAR BAŞLIK ===
        push(ESC, 0x45, 0x01);
        line(colsRow('Teslimat', 'Tutar'));
        push(ESC, 0x45, 0x00);
        line(hLineCols());

        // === BOS SIPARIS ALANI (20 satir) ===
        for (let i = 0; i < 20; i++) {
          line('|' + ' '.repeat(CAL) + '|' + ' '.repeat(CAR) + '|');
        }

        // Alt kapanış
        line(hLineCols());

        // Kağıt ilerlet + kes (~10mm hassas besleme, sonra kesme)
        // 177→71: 15mm azaltıldı (üst boşluğu kısaltmak için sonraki baskıya yansır)
        push(ESC, 0x4A, 71);     // ESC J 71: kağıdı ~10mm ilerlet
        push(GS, 0x56, 0x42, 0x00);

        return Buffer.from(bytes);
      };


      const receiptBuf = Buffer.concat([buildReceipt(), buildReceipt()]); // 2 kopya
      const ts = Date.now();
      const binPath = path.join(os.tmpdir(), `siparis_escpos_${ts}.bin`);
      fs.writeFileSync(binPath, receiptBuf);

      // winspool.drv üzerinden RAW yazdırma — DLL cache ile hızlı (ilk baskıda derlenir, sonraki baskılar ~100ms)
      const psScript = getRawPrinterPsHeader() + `
$printerName = '${selectedPrinter.replace(/'/g, "''")}'
$bytes = [System.IO.File]::ReadAllBytes("${binPath.replace(/\\/g, '\\\\')}")

$hPrinter = [IntPtr]::Zero
$di = New-Object RawPrinterCore+DOCINFOA
$di.pDocName  = "SIPARIS_FISI"
$di.pDataType = "RAW"

if ([RawPrinterCore]::OpenPrinter($printerName, [ref]$hPrinter, [IntPtr]::Zero)) {
    [RawPrinterCore]::StartDocPrinter($hPrinter, 1, $di) | Out-Null
    [RawPrinterCore]::StartPagePrinter($hPrinter) | Out-Null
    $ptr = [System.Runtime.InteropServices.Marshal]::AllocHGlobal($bytes.Length)
    [System.Runtime.InteropServices.Marshal]::Copy($bytes, 0, $ptr, $bytes.Length)
    $written = 0
    [RawPrinterCore]::WritePrinter($hPrinter, $ptr, $bytes.Length, [ref]$written) | Out-Null
    [System.Runtime.InteropServices.Marshal]::FreeHGlobal($ptr)
    [RawPrinterCore]::EndPagePrinter($hPrinter) | Out-Null
    [RawPrinterCore]::EndDocPrinter($hPrinter) | Out-Null
    [RawPrinterCore]::ClosePrinter($hPrinter) | Out-Null
}

Remove-Item -Path "${binPath.replace(/\\/g, '\\\\')}" -Force -ErrorAction SilentlyContinue
`;

      const psPath = path.join(os.tmpdir(), `siparis_print_${ts}.ps1`);
      fs.writeFileSync(psPath, psScript, 'utf-8');

      return new Promise((resolve) => {
        child_process.execFile(
          'powershell',
          ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', psPath],
          { timeout: 30000 },
          (err) => {
            try { fs.unlinkSync(psPath); } catch (e) { }
            if (err) {
              console.error('[Print] RAW yazdırma hatası:', err);
              resolve({ success: false, error: err.message });
            } else {
              console.log('[Print] ESC/POS RAW yazdırma başarılı.');
              resolve({ success: true });
            }
          }
        );
      });

    } catch (error) {
      console.error('[Print] İstisna:', error);
      return { success: false, error: error.message };
    }
  });



  // ====== SINAMA SAYFASI YAZDIRMA (ESC/POS RAW PROTOCOL) ======
  ipcMain.handle('print-test-page', async (event, printerName) => {
    try {
      console.log('[TestPrint] ESC/POS RAW sınama sayfası:', printerName);

      const tarih = new Date().toLocaleDateString('tr-TR');
      const saat = new Date().toLocaleTimeString('tr-TR');
      const LINE_WIDTH = 42;

      const ESC = 0x1B;
      const GS = 0x1D;
      const LF = 0x0A;
      const sepLine = Array(LINE_WIDTH).fill(0x2D);
      // PC857 Türkçe kod sayfası — ESC t 0x12 ile eşleşir
      // Eski 'binary' encode: ş→'_', ğ→boş karakter hatalarını düzeltir
      // Turkce karakterler ASCII karsiliklarina donusturulur (yazici uyumlulugu)
      const normalizeTR = (str) => (str || '').toString()
        .replace(/\u015f/g, 's').replace(/\u015e/g, 'S')
        .replace(/\u011f/g, 'g').replace(/\u011e/g, 'G')
        .replace(/\u0131/g, 'i').replace(/\u0130/g, 'I')
        .replace(/\u00e7/g, 'c').replace(/\u00c7/g, 'C')
        .replace(/\u00f6/g, 'o').replace(/\u00d6/g, 'O')
        .replace(/\u00fc/g, 'u').replace(/\u00dc/g, 'U')
        .replace(/\u00e2/g, 'a').replace(/\u00ea/g, 'e')
        .replace(/\u00ee/g, 'i').replace(/\u00f4/g, 'o')
        .replace(/\u00fb/g, 'u').replace(/\u00e0/g, 'a');
      const textToBytes = (str) => {
        const s = normalizeTR(str);
        const result = [];
        for (let i = 0; i < s.length; i++) result.push(s.charCodeAt(i) & 0x7F);
        return result;
      };

      const bytes = [];
      const push = (...args) => args.forEach(b => bytes.push(b));
      const pushArr = (arr) => arr.forEach(b => bytes.push(b));

      push(ESC, 0x40); // Init
      push(ESC, 0x74, 0x12); // PC857 Türkçe kod sayfası

      // Başlık (Ortalı, Büyük, Kalın)
      push(ESC, 0x61, 0x01); // orta
      push(ESC, 0x45, 0x01); // bold
      push(ESC, 0x21, 0x30); // Double width/height
      pushArr(textToBytes('SINAMA SAYFASI'));
      push(LF);
      push(ESC, 0x21, 0x00); // normal
      push(ESC, 0x45, 0x00); // bold off

      push(ESC, 0x61, 0x01);
      pushArr(textToBytes('Caller ID Sistemi'));
      push(LF);
      push(ESC, 0x61, 0x00); // sola

      pushArr(sepLine); push(LF);

      pushArr(textToBytes(`Yazici: ${printerName}`)); push(LF);
      pushArr(textToBytes(`Tarih:  ${tarih}`)); push(LF);
      pushArr(textToBytes(`Saat:   ${saat}`)); push(LF);

      pushArr(sepLine); push(LF);

      // Mesaj satırları
      const msg = "Bu yaziyi okuyabiliyorsaniz; Yazici bilgisayariniza nizami bir sekilde kurulmus, 'Caller ID' programina tanitilmis ve stabil bir sekilde calisiyordur.";
      for (let i = 0; i < msg.length; i += LINE_WIDTH) {
        pushArr(textToBytes(msg.substring(i, i + LINE_WIDTH)));
        push(LF);
      }

      pushArr(sepLine); push(LF);

      // Kağıt ilerlet + Kes
      for (let i = 0; i < 10; i++) push(LF);
      push(GS, 0x56, 0x42, 0x00);

      const testBuf = Buffer.from(bytes);
      const ts = Date.now();
      const binPath = path.join(os.tmpdir(), `test_escpos_${ts}.bin`);
      fs.writeFileSync(binPath, testBuf);

      // DLL cache ile hızlı RAW yazdırma
      const psScript = getRawPrinterPsHeader() + `
$printerName = '${printerName.replace(/'/g, "''")}'
$bytes = [System.IO.File]::ReadAllBytes("${binPath.replace(/\\/g, '\\\\')}")
$hPrinter = [IntPtr]::Zero
$di = New-Object RawPrinterCore+DOCINFOA
$di.pDocName  = "TEST_PAGE"
$di.pDataType = "RAW"
if ([RawPrinterCore]::OpenPrinter($printerName, [ref]$hPrinter, [IntPtr]::Zero)) {
    [RawPrinterCore]::StartDocPrinter($hPrinter, 1, $di) | Out-Null
    [RawPrinterCore]::StartPagePrinter($hPrinter) | Out-Null
    $ptr = [System.Runtime.InteropServices.Marshal]::AllocHGlobal($bytes.Length)
    [System.Runtime.InteropServices.Marshal]::Copy($bytes, 0, $ptr, $bytes.Length)
    $written = 0
    [RawPrinterCore]::WritePrinter($hPrinter, $ptr, $bytes.Length, [ref]$written) | Out-Null
    [System.Runtime.InteropServices.Marshal]::FreeHGlobal($ptr)
    [RawPrinterCore]::EndPagePrinter($hPrinter) | Out-Null
    [RawPrinterCore]::EndDocPrinter($hPrinter) | Out-Null
    [RawPrinterCore]::ClosePrinter($hPrinter) | Out-Null
}
Remove-Item -Path "${binPath.replace(/\\/g, '\\\\')}" -Force -ErrorAction SilentlyContinue
`;

      const psPath = path.join(os.tmpdir(), `test_print_${ts}.ps1`);
      fs.writeFileSync(psPath, psScript, 'utf-8');

      return new Promise((resolve) => {
        child_process.execFile(
          'powershell',
          ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', psPath],
          { timeout: 30000 },
          (err) => {
            try { fs.unlinkSync(psPath); } catch (e) { }
            if (err) {
              console.error('[TestPrint] RAW hatası:', err);
              resolve({ success: false, error: err.message });
            } else {
              console.log('[TestPrint] ESC/POS RAW sınama başarılı.');
              resolve({ success: true });
            }
          }
        );
      });

    } catch (error) {
      console.error('[TestPrint] İstisna:', error);
      return { success: false, error: error.message };
    }
  });


});



app.on('window-all-closed', () => {

  if (process.platform !== 'darwin') app.quit();
});

ipcMain.on('ping', (event, arg) => {
  console.log('React (Frontend) tarafından mesaj alındı:', arg);
  event.reply('pong', 'Electron (Backend) iletişim kurdu!');
});

// Pencere Kontrol IPC'leri
ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.on('open-external', (event, url) => {
  shell.openExternal(url);
});

ipcMain.on('save-app-state', (event, state) => {
  stateStore.save(state);
});

ipcMain.handle('get-app-state', () => {
  return stateStore.load();
});

ipcMain.handle('get-usb-status', () => {
  return bridgeProcess !== null;
});
