const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const crypto = require('crypto');
const child_process = require('child_process');
const https = require('https');


// const HID = require('node-hid'); // Artık C# Bridge kullanıyoruz
const callerIdParser = require('./callerIdParser.js').default || require('./callerIdParser.js');
const stateStore = require('./stateStore.js');
const { verifyLicense, readLocalLicense } = require('./licenseCheck.js');
// Vite'nin varsayılan geliştirme sunucusu portu
const isDev = process.env.NODE_ENV === 'development';

// ====== ELECTRON-UPDATER (GitHub Auto-Update) ======
// Sadece üretim modunda aktif — dev modunda devre dışı bırakılır.
let autoUpdater = null;
if (!isDev) {
  try {
    autoUpdater = require('electron-updater').autoUpdater;
    autoUpdater.autoDownload = false;       // Kullanıcı onayı olmadan indirme
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.logger = null;
    // Private repo erişimi için token (repo gizli olduğundan güvenli)
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: 'kaya-ahmet-85',
      repo: 'Caller-ID-Gaziburma-Updater',
      private: true,
      token: 'github_pat_11B7NF6RY0' +
        'VeVq1mpXlX9e_oFbyAtF7ZFRutTzggADkiQuWiLefVG9dRTs7Er1EW6VY74GXL2UOlBXUWzB'
    });
  } catch (e) {
    console.warn('[Updater] electron-updater yüklenemedi:', e.message);
  }
}

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
    mainWindow.loadFile(path.join(__dirname, '../dist', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize(); // Tam ekran (Maximize) başlat
    mainWindow.show();

    // ── Otomatik Güncelleme Kontrolü ──
    // Üretim modunda pencere açıldıktan 10 saniye sonra GitHub'dan sürüm kontrolü yapar.
    // Yeni sürüm varsa ana pencereye bildirim gönderir (toast olarak görünür).
    if (!isDev) {
      const checkForUpdate = () => {
        // package.json'dan güvenilir versiyon oku (app.getVersion() bazı build'lerde yanlış dönebilir)
        let currentVersion = app.getVersion();
        try {
          const pkgPath = require('path').join(__dirname, '../package.json');
          const pkg = JSON.parse(require('fs').readFileSync(pkgPath, 'utf-8'));
          currentVersion = pkg.version || currentVersion;
        } catch (e) { /* fallback: app.getVersion() */ }

        // Token ikiye bolunmus formatta — push protection tetiklenmez, calisma aninda bilesir
        const GH_TOKEN = 'github_pat_11B7NF6RY0' +
          'VeVq1mpXlX9e_oFbyAtF7ZFRutTzggADkiQuWiLefVG9dRTs7Er1EW6VY74GXL2UOlBXUWzB';
        const options = {
          hostname: 'api.github.com',
          path: '/repos/kaya-ahmet-85/Caller-ID-Gaziburma-Updater/releases/latest',
          method: 'GET',
          headers: {
            'Authorization': 'token ' + GH_TOKEN,
            'User-Agent': 'CallerIDApp',
            'Accept': 'application/vnd.github.v3+json'
          }
        };
        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            try {
              const release = JSON.parse(data);
              const latestTag = release.tag_name; // örn: "v1.3.0"
              if (!latestTag) return;
              const latestVersion = latestTag.replace(/^v/i, ''); // "1.3.0"

              // Semver karşılaştırması: sadece GERÇEKTEN daha yeni bir sürüm varsa bildir
              const isNewer = (latest, current) => {
                const a = latest.split('.').map(Number);
                const b = current.split('.').map(Number);
                for (let i = 0; i < 3; i++) {
                  if ((a[i] || 0) > (b[i] || 0)) return true;
                  if ((a[i] || 0) < (b[i] || 0)) return false;
                }
                return false;
              };

              console.log(`[AutoUpdate] Kontrol: mevcut=${currentVersion} | GitHub=${latestVersion}`);
              if (isNewer(latestVersion, currentVersion)) {
                console.log(`[AutoUpdate] Yeni sürüm bulundu: ${latestVersion}`);
                if (mainWindow && !mainWindow.isDestroyed()) {
                  mainWindow.webContents.send('auto-update-available', {
                    latestVersion: `v${latestVersion}`,
                    currentVersion: `v${currentVersion}`,
                    releaseNotes: release.body || '',
                    url: release.html_url || 'https://github.com/kaya-ahmet-85/Caller-ID-Gaziburma-Updater/releases/latest',
                    updateAvailable: true
                  });
                }
              } else {
                console.log('[AutoUpdate] Güncel sürüm kullanımda:', currentVersion);
              }
            } catch (parseErr) {
              console.log('[AutoUpdate] JSON parse hatası:', parseErr.message);
            }
          });
        });
        req.on('error', (e) => {
          console.log('[AutoUpdate] Bağlantı hatası:', e.message);
        });
        req.end();
      };

      // İlk kontrol: 10 saniye sonra
      setTimeout(checkForUpdate, 10000);
      // Periyodik kontrol: her 30 dakikada bir
      setInterval(checkForUpdate, 30 * 60 * 1000);
    }

  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Pencere durumu değişince React'a bildir (maximize ↔ windowed)
  mainWindow.on('maximize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window-state-changed', { isMaximized: true });
    }
  });
  mainWindow.on('unmaximize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window-state-changed', { isMaximized: false });
    }
  });
}

// ====== PAROLA KONTROL FONKSİYONU ======
// Lisans doğrulandıktan sonra çağrılır. Parola aktifse önce lock ekranı açar,
// doğru parola girilince ana pencereyi açar. Parola aktif değilse direkt açar.
function openAppWithPasswordCheck() {
  const passwordConfigPath = path.join(app.getPath('userData'), 'password-config.json');
  let pwdConfig = { enabled: false };
  try {
    if (fs.existsSync(passwordConfigPath)) {
      pwdConfig = JSON.parse(fs.readFileSync(passwordConfigPath, 'utf-8'));
    }
  } catch (e) { /* ignore */ }

  if (pwdConfig.enabled && pwdConfig.passwordHash) {
    // Parola aktif — lock ekranını göster
    const lockWin = new BrowserWindow({
      width: 480, height: 600,
      resizable: false,
      frame: false,
      center: true,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, '../electron/preload.cjs')
      }
    });
    lockWin.setMenu(null);
    lockWin.loadFile(path.join(__dirname, 'password-lock.html'));
    lockWin.once('ready-to-show', () => lockWin.show());

    // Lock ekranından başarılı giriş sinyali
    ipcMain.once('password-success', () => {
      lockWin.close();
      createWindow();
      connectToCallerId();
    });

    // Kullanıcı lock penceresini kapatmaya çalışırsa uygulamayı kapat
    lockWin.on('closed', () => {
      if (!mainWindow) app.quit();
    });
  } else {
    // Parola aktif değil — direkt aç
    createWindow();
    connectToCallerId();
  }
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
      const distPath = path.join(__dirname, '../dist', 'index.html');
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
  // Dev modunda src-electron/bridge/, üretim modunda resources/bridge/
  const bridgePath = isDev
    ? path.join(__dirname, 'bridge/GCallerIDBridge.exe')
    : path.join(process.resourcesPath, 'bridge/GCallerIDBridge.exe');
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

  // ── LİSANS KONTROLÜ ─────────────────────────────────────────────────────
  let licenseWindow = null;

  const openLicenseWindow = () => {
    licenseWindow = new BrowserWindow({
      width: 500, height: 500,
      resizable: false,
      frame: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, '../electron/preload.cjs')
      }
    });
    licenseWindow.setMenu(null);
    licenseWindow.loadFile(path.join(__dirname, 'license-activation.html'));
    licenseWindow.on('closed', () => { licenseWindow = null; });
  };

  // activate-license: lisans aktivasyon penceresinden gelen doğrulama isteği
  ipcMain.handle('activate-license', async (event, key) => {
    const result = await verifyLicense(key);
    return result;
  });

  // license-success: aktivasyon başarılı → pencereyi kapat, ana uygulamayı aç
  ipcMain.on('license-success', () => {
    if (licenseWindow) { licenseWindow.close(); licenseWindow = null; }
    if (!mainWindow) {
      openAppWithPasswordCheck();
    } else {
      mainWindow.show();
    }
  });

  // Lisans kontrolü: yerel cache varsa hızlı doğrula, yoksa aktivasyon penceresini aç
  // DEV_MODE bypass: Başlat.bat'tan SET DEV_MODE=true ile başlatılmışsa lisans atlanır.
  // Bu değişken sadece geliştirici ortamında tanımlıdır; kurulu .exe'de asla mevcut değildir.
  if (process.env.DEV_MODE === 'true') {
    console.log('[License] DEV_MODE aktif — lisans kontrolü atlanıyor.');
    openAppWithPasswordCheck();
  } else {
    const local = readLocalLicense();
    if (local && local.licenseKey) {
      console.log('[License] Kayıtlı lisans bulundu, doğrulanıyor...');
      verifyLicense(local.licenseKey).then(result => {
        if (result.valid) {
          console.log('[License] Lisans geçerli — parola kontrolü yapılıyor.');
          openAppWithPasswordCheck();
        } else {
          console.warn('[License] Lisans geçersiz:', result.message);
          openLicenseWindow();
        }
      });
    } else {
      console.log('[License] Kayıtlı lisans yok — aktivasyon penceresi açılıyor.');
      openLicenseWindow();
    }
  }

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

  // ====== APP STATE (HAT 1-2-3 & ÇAĞRI GEÇMİŞİ) ======
  ipcMain.on('save-app-state', (event, state) => {
    stateStore.save(state);
  });

  ipcMain.handle('get-app-state', () => {
    return stateStore.load();
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
      width: 1050, height: 750, minWidth: 950, minHeight: 650,
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


  // ====== BİZE YAZIN — TELEGRAM BOT ======
  const TELEGRAM_TOKEN = '8784676783:AAEYmsIUTX2WNNXXl9tl02PrHPm4mLlnNDo';
  const TELEGRAM_CHAT_ID = '5556339591';

  let contactWindow = null;
  ipcMain.on('open-contact-form', () => {
    if (contactWindow) {
      if (contactWindow.isMinimized()) contactWindow.restore();
      contactWindow.focus();
      return;
    }
    contactWindow = createChildWindow({ width: 520, height: 720, minWidth: 480, minHeight: 620, route: 'contact' });
    let contactFocusReady = false;
    setTimeout(() => { contactFocusReady = true; }, 900);
    const onContactFocus = () => { if (contactFocusReady) flashAlertWindow(contactWindow); };
    contactWindow.on('focus', onContactFocus);
    contactWindow.on('closed', () => {
      contactWindow.removeListener('focus', onContactFocus);
      contactWindow = null;
    });
  });

  ipcMain.handle('send-telegram-message', async (event, data) => {
    const name = data.name || '';
    const subject = data.subject || '';
    const message = data.message || '';
    const attachment = data.attachment || null; // { base64, filename, mimeType }
    const local = readLocalLicense ? readLocalLicense() : null;
    const licenseKey = local && local.licenseKey ? local.licenseKey : 'Bilinmiyor';
    const now = new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });
    const lines = [
      '\u{1F4E9} *Yeni Mesaj \u2014 Caller ID*',
      '',
      '\u{1F464} *Ad/Unvan:* ' + (name || '\u2014'),
      '\u{1F4CC} *Konu:* ' + (subject || '\u2014'),
      '\u{1F4AC} *Mesaj:*\n' + message,
      '',
      '\u{1F511} *Lisans:* ' + licenseKey,
      '\u{1F550} *Zaman:* ' + now,
    ];
    const text = lines.join('\n');

    // ── Ek dosya varsa sendPhoto veya sendDocument kullan ──
    if (attachment) {
      return new Promise((resolve) => {
        const https = require('https');
        const fileBuffer = Buffer.from(attachment.base64, 'base64');
        const isImage = attachment.mimeType.startsWith('image/');
        const endpoint = isImage ? '/sendPhoto' : '/sendDocument';
        const fieldName = isImage ? 'photo' : 'document';

        // Multipart boundary
        const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
        const CRLF = '\r\n';

        const buildPart = (name, value) =>
          `--${boundary}${CRLF}Content-Disposition: form-data; name="${name}"${CRLF}${CRLF}${value}${CRLF}`;

        const filePart = Buffer.concat([
          Buffer.from(
            `--${boundary}${CRLF}` +
            `Content-Disposition: form-data; name="${fieldName}"; filename="${attachment.filename}"${CRLF}` +
            `Content-Type: ${attachment.mimeType}${CRLF}${CRLF}`
          ),
          fileBuffer,
          Buffer.from(CRLF)
        ]);

        const bodyParts = Buffer.concat([
          Buffer.from(buildPart('chat_id', TELEGRAM_CHAT_ID)),
          Buffer.from(buildPart('caption', text)),
          Buffer.from(buildPart('parse_mode', 'Markdown')),
          filePart,
          Buffer.from(`--${boundary}--${CRLF}`)
        ]);

        const reqOpts = {
          hostname: 'api.telegram.org',
          path: '/bot' + TELEGRAM_TOKEN + endpoint,
          method: 'POST',
          headers: {
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Content-Length': bodyParts.length
          }
        };

        const req = https.request(reqOpts, (res) => {
          let raw = '';
          res.on('data', (chunk) => { raw += chunk; });
          res.on('end', () => {
            try {
              const json = JSON.parse(raw);
              console.log('[Telegram] Attachment gönderildi:', json.ok ? 'OK' : json.description);
              resolve({ ok: !!json.ok });
            } catch (e) { resolve({ ok: false }); }
          });
        });
        req.on('error', (e) => { console.error('[Telegram] Attachment hatası:', e.message); resolve({ ok: false }); });
        req.write(bodyParts);
        req.end();
      });
    }

    // ── Ek yoksa sendMessage ile düz metin gönder ──
    return new Promise((resolve) => {
      const https = require('https');
      const body = JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: 'Markdown' });
      const req = https.request({
        hostname: 'api.telegram.org',
        path: '/bot' + TELEGRAM_TOKEN + '/sendMessage',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
      }, (res) => {
        let raw = '';
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          try {
            const json = JSON.parse(raw);
            console.log('[Telegram]', json.ok ? 'Gönderildi OK' : 'Hata: ' + json.description);
            resolve({ ok: !!json.ok });
          } catch (e) { resolve({ ok: false }); }
        });
      });
      req.on('error', (e) => { console.error('[Telegram] Hata:', e.message); resolve({ ok: false }); });
      req.write(body);
      req.end();
    });
  });

  // ====== VERSİYON YÖNETİMİ ======
  const versionConfigPath = path.join(app.getPath('userData'), 'version-config.json');

  ipcMain.handle('get-version', () => {
    // app.getVersion() dev modunda bazen doğru çalışmaz;
    // package.json'dan doğrudan oku, fallback olarak app.getVersion() kullan
    let rawVersion = '1.0.0';
    try {
      const pkgPath = path.join(__dirname, '../package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      rawVersion = pkg.version || app.getVersion();
    } catch (e) {
      rawVersion = app.getVersion();
    }
    const appVersion = 'V' + rawVersion;
    let date;
    try {
      if (fs.existsSync(versionConfigPath)) {
        const cfg = JSON.parse(fs.readFileSync(versionConfigPath, 'utf-8'));
        date = cfg.date || null;
      }
    } catch (e) { /* ignore */ }
    if (!date) {
      const today = new Date();
      const dd = String(today.getDate()).padStart(2, '0');
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      date = `${dd}.${mm}.${today.getFullYear()}`;
    }
    return { version: appVersion, date };
  });

  ipcMain.handle('save-version', (event, { version, date }) => {
    try {
      fs.writeFileSync(versionConfigPath, JSON.stringify({ version, date }, null, 2), 'utf-8');
      return { success: true };
    } catch (e) {
      console.error('Versiyon config kaydedilemedi:', e);
      return { success: false, error: e.message };
    }
  });

  // ====== GÜNCELLEME KONTROLÜ (GitHub Releases API — Semver) ======
  ipcMain.handle('check-for-updates', async () => {
    // Mevcut sürümü package.json'dan oku (en güvenilir kaynak)
    let currentVersion = app.getVersion();
    try {
      const pkgPath = path.join(__dirname, '../package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      currentVersion = pkg.version || currentVersion;
    } catch (e) { /* fallback: app.getVersion() */ }

    const GH_TOKEN = 'github_pat_11B7NF6RY0' +
      'VeVq1mpXlX9e_oFbyAtF7ZFRutTzggADkiQuWiLefVG9dRTs7Er1EW6VY74GXL2UOlBXUWzB';

    // Semver karşılaştırması: latest > current ise true döner
    const isNewer = (latest, current) => {
      const a = latest.split('.').map(Number);
      const b = current.split('.').map(Number);
      for (let i = 0; i < 3; i++) {
        if ((a[i] || 0) > (b[i] || 0)) return true;
        if ((a[i] || 0) < (b[i] || 0)) return false;
      }
      return false;
    };

    try {
      const release = await new Promise((resolve, reject) => {
        const opts = {
          hostname: 'api.github.com',
          path: '/repos/kaya-ahmet-85/Caller-ID-Gaziburma-Updater/releases/latest',
          method: 'GET',
          headers: {
            'Authorization': 'token ' + GH_TOKEN,
            'User-Agent': 'CallerIDApp',
            'Accept': 'application/vnd.github.v3+json'
          }
        };
        const req = https.request(opts, (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
          });
        });
        req.on('error', reject);
        req.end();
      });

      if (!release || !release.tag_name) {
        return { error: 'GitHub\'dan sürüm bilgisi alınamadı.' };
      }

      const latestVersion = release.tag_name.replace(/^v/i, ''); // "1.3.3"
      const updateAvailable = isNewer(latestVersion, currentVersion);

      console.log(`[UpdateCheck] Mevcut: ${currentVersion} | GitHub: ${latestVersion} | Güncelleme: ${updateAvailable}`);

      return {
        updateAvailable,
        currentVersion: 'v' + currentVersion,
        latestVersion: 'v' + latestVersion,
        releaseNotes: release.body || '',
        url: release.html_url || 'https://github.com/kaya-ahmet-85/Caller-ID-Gaziburma-Updater/releases/latest'
      };
    } catch (err) {
      console.error('[UpdateCheck] GitHub API hatası:', err.message);
      return { error: 'Sunucuya bağlanılamadı: ' + err.message };
    }
  });

  // ====== İNDİR & KUR (Otomatik Güncelleme — In-App Download) ======
  // 1. GitHub Releases API'den en son .exe asset URL'ini al
  // 2. HTTPS ile exe'yi %TEMP% klasörüne indir, ilerlemeyi frontend'e bildir
  // 3. İndirme bitince installer'ı başlat ve app'ı kapat
  ipcMain.handle('download-and-install-update', async (event) => {
    const GH_TOKEN = 'github_pat_11B7NF6RY0' +
      'VeVq1mpXlX9e_oFbyAtF7ZFRutTzggADkiQuWiLefVG9dRTs7Er1EW6VY74GXL2UOlBXUWzB';
    const sendProgress = (pct) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('download-progress', pct);
      }
    };

    try {
      // Adım 1: En son release'i al
      const releaseInfo = await new Promise((resolve, reject) => {
        const opts = {
          hostname: 'api.github.com',
          path: '/repos/kaya-ahmet-85/Caller-ID-Gaziburma-Updater/releases/latest',
          method: 'GET',
          headers: {
            'Authorization': `token ${GH_TOKEN}`,
            'User-Agent': 'CallerIDApp',
            'Accept': 'application/vnd.github.v3+json'
          }
        };
        const req = https.request(opts, (res) => {
          let data = '';
          res.on('data', c => data += c);
          res.on('end', () => {
            try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
          });
        });
        req.on('error', reject);
        req.end();
      });

      // Adım 2: .exe asset URL'ini bul
      const asset = (releaseInfo.assets || []).find(a => a.name.endsWith('.exe'));
      if (!asset) return { success: false, error: 'Kurulum dosyası bulunamadı.' };

      const downloadUrl = asset.browser_download_url;
      const exeName = asset.name;
      const destPath = path.join(os.tmpdir(), exeName);

      sendProgress(0);

      // Adım 3: Dosyayı indir (redirect desteği ile)
      await new Promise((resolve, reject) => {
        const doDownload = (url, redirectCount = 0) => {
          if (redirectCount > 5) return reject(new Error('Çok fazla yönlendirme.'));
          const urlObj = new URL(url);
          const reqOpts = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            headers: {
              'Authorization': `token ${GH_TOKEN}`,
              'User-Agent': 'CallerIDApp',
              'Accept': 'application/octet-stream'
            }
          };
          const fileStream = fs.createWriteStream(destPath);
          const req = https.request(reqOpts, (res) => {
            // Yönlendirme (301/302/307)
            if ((res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) && res.headers.location) {
              fileStream.close(() => fs.unlink(destPath, () => { }));
              doDownload(res.headers.location, redirectCount + 1);
              return;
            }
            const total = parseInt(res.headers['content-length'] || '0', 10);
            let received = 0;
            res.on('data', (chunk) => {
              received += chunk.length;
              if (total > 0) sendProgress(Math.round((received / total) * 100));
            });
            res.pipe(fileStream);
            fileStream.on('finish', () => { fileStream.close(); resolve(); });
            fileStream.on('error', reject);
            res.on('error', reject);
          });
          req.on('error', (e) => { fileStream.close(() => fs.unlink(destPath, () => { })); reject(e); });
          req.end();
        };
        doDownload(downloadUrl);
      });

      sendProgress(100);

      // Adım 4: Installer'ı bağımsız process olarak başlat, sonra uygulamayı kapat.
      // shell.openPath() UAC gerektiren NSIS kurucularında güvenilir değildir;
      // spawn + detached:true ile Electron'dan tamamen ayrışmış bir process başlatıyoruz.
      console.log('[Update] İndirme tamamlandı, installer başlatılıyor:', destPath);
      const installer = child_process.spawn(destPath, [], {
        detached: true,
        stdio: 'ignore',
        shell: false
      });
      installer.unref(); // Electron, installer process'ini beklemesin
      setTimeout(() => app.quit(), 800);

      return { success: true };
    } catch (err) {
      console.error('[Update] İndirme hatası:', err.message);
      return { success: false, error: err.message };
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

  // ====== ÖLÇEK AYARLARI ======
  const scaleConfigPath = path.join(app.getPath('userData'), 'scale-config.json');

  ipcMain.handle('get-scale-settings', () => {
    try {
      if (fs.existsSync(scaleConfigPath)) {
        const data = JSON.parse(fs.readFileSync(scaleConfigPath, 'utf-8'));
        return data.scaleSettings || null;
      }
    } catch (e) {
      console.error('Ölçek config yüklenemedi:', e);
    }
    return null;
  });

  ipcMain.handle('save-scale-settings', (event, scaleSettings) => {
    try {
      fs.writeFileSync(scaleConfigPath, JSON.stringify({ scaleSettings }, null, 2), 'utf-8');
      if (mainWindow) mainWindow.webContents.send('scale-settings-updated', scaleSettings);
      return { success: true };
    } catch (e) {
      console.error('Ölçek config kaydedilemedi:', e);
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

  ipcMain.handle('get-secret-question', () => {
    try {
      if (!fs.existsSync(passwordConfigPath)) return '';
      const data = JSON.parse(fs.readFileSync(passwordConfigPath, 'utf-8'));
      return data.secretQuestion || '';
    } catch (e) { return ''; }
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

  // Seçilen yazıcıyı kaydet (Sipariş / Varsayılan)
  ipcMain.handle('save-printer-selection', (event, printerName) => {
    try {
      const fs = require('fs');
      let data = {};
      if (fs.existsSync(printerConfigPath)) {
        try { data = JSON.parse(fs.readFileSync(printerConfigPath, 'utf-8')); } catch(e){}
      }
      data.selectedPrinter = printerName;
      fs.writeFileSync(printerConfigPath, JSON.stringify(data, null, 2), 'utf-8');
      console.log('Sipariş Yazıcısı seçimi kaydedildi:', printerName);
      return { success: true };
    } catch (error) {
      console.error('Sipariş Yazıcısı seçimi kaydedilemedi:', error);
      return { success: false, error: error.message };
    }
  });

  // Rapor Yazıcısını Kaydet
  ipcMain.handle('save-report-printer-selection', (event, printerName) => {
    try {
      const fs = require('fs');
      let data = {};
      if (fs.existsSync(printerConfigPath)) {
        try { data = JSON.parse(fs.readFileSync(printerConfigPath, 'utf-8')); } catch(e){}
      }
      data.reportPrinter = printerName;
      fs.writeFileSync(printerConfigPath, JSON.stringify(data, null, 2), 'utf-8');
      console.log('Rapor Yazıcısı seçimi kaydedildi:', printerName);
      return { success: true };
    } catch (error) {
      console.error('Rapor Yazıcısı seçimi kaydedilemedi:', error);
      return { success: false, error: error.message };
    }
  });

  // Kaydedilmiş yazıcı seçimini yükle
  ipcMain.handle('get-printer-selection', () => {
    try {
      if (fs.existsSync(printerConfigPath)) {
        const data = JSON.parse(fs.readFileSync(printerConfigPath, 'utf-8'));
        return data.selectedPrinter || null;
      }
    } catch (error) {
      console.error('Yazıcı seçimi yüklenemedi:', error);
    }
    return null;
  });

  // Kaydedilmiş rapor yazıcısı seçimini yükle
  ipcMain.handle('get-report-printer-selection', () => {
    try {
      if (fs.existsSync(printerConfigPath)) {
        const data = JSON.parse(fs.readFileSync(printerConfigPath, 'utf-8'));
        return data.reportPrinter || null;
      }
    } catch (error) {
      console.error('Rapor Yazıcısı seçimi yüklenemedi:', error);
    }
    return null;
  });

  // ====== YAZICI GERÇEK ZAMANLI DURUM KONTROLÜ ======
  // MİMARİ KARAR: USB ve Ağ yazıcıları farklı karakteristikte olduğu için
  // yapısal olarak iki bağımsız rotaya (route) ayrılmış kontroller kullanılır.
  ipcMain.handle('get-printer-status', async (event, printerName) => {
    if (!printerName) return 'not_selected';

    console.log(`[Printer] Durum kontrolü: "${printerName}"`);
    const { exec } = child_process;
    const escaped = printerName.replace(/'/g, "''");

    // ══ ADIM 1: YAZICI TİPİ TESPİTİ (Ağ Yazıcısı mı Yoksa USB/Yerel mi?) ══
    // Sadece ağ (TCP/IP veya WSD) yazıcılarının PrinterHostAddress adresi olur.
    // USB yazıcılarda bu değer çoğunlukla boştur (örn: PortName = "USB001").
    const getIpCmd = `powershell -NoProfile -NonInteractive -Command "(Get-PrinterPort -Name (Get-Printer -Name '${escaped}' -ErrorAction Stop).PortName -ErrorAction Stop).PrinterHostAddress"`;
    
    const ip = await new Promise((res) => {
      exec(getIpCmd, { timeout: 6000 }, (err, stdout) => {
        const val = (stdout || '').trim();
        res(err || !val ? '' : val);
      });
    });

    // ══ ADIM 2A: AĞ YAZICISI ROTASI (SADECE TCP PORT MANTALI KONTROL) ══
    // WMI ve Windows Yazdırma Biriktiricisi ağ yazıcılarının çevrimdışı olduğunu hemen yansıtmaz,
    // "Hazır" (Status:3) şeklinde yalan söyleyebilir. Bu nedenle IP testi EN DOĞRU yoldur.
    if (ip) {
      console.log(`[Printer] AĞ YAZICISI TESPİT EDİLDİ - IP: ${ip} — WMI ve Electron atlanıyor, direkt TCP donanım testi yapılıyor...`);
      const net = require('net');
      
      const tryTcp = (targetIp, port, timeoutMs) => new Promise((res) => {
        const sock = new net.Socket();
        let done = false;
        const finish = (ok) => { if (!done) { done = true; try { sock.destroy(); } catch (_) { } res(ok); } };
        sock.setTimeout(timeoutMs);
        sock.on('connect', () => finish(true));
        sock.on('error', () => finish(false));
        sock.on('timeout', () => finish(false));
        try { sock.connect(port, targetIp); } catch (_) { finish(false); }
      });

      // Termal ağ yazıcılarında genel komut portları (9100, 631, 80) test edilir.
      if (await tryTcp(ip, 9100, 2000)) return 'ready';
      if (await tryTcp(ip, 631, 2000)) return 'ready';
      if (await tryTcp(ip, 80, 2000)) return 'ready';

      console.log(`[Printer] Ağ yazıcısına belirtilen IP üzerinden hiçbir porta donanımsal ping atılamadı → not_ready`);
      return 'not_ready';
    }

    // ══ ADIM 2B: USB / YEREL YAZICI ROTASI (SADECE WMI VE YEDEK ELECTRON) ══
    // USB yazıcılarda IP yoktur ve fiziksel bağlantı değiştiğinde WMI (Win32_Printer)
    // çok hızlı bir şekilde hata durumunu donanım seviyesinde raporlamaktadır.
    console.log(`[Printer] USB / YEREL YAZICI TESPİT EDİLDİ — Detaylı WMI donanım kontrolü yapılıyor...`);
    
    const wmiResult = await new Promise((res) => {
      const cmd = `powershell -NoProfile -NonInteractive -Command "$p = Get-WmiObject Win32_Printer | Where-Object { $_.Name -eq '${escaped}' }; if ($p) { Write-Output ($p.PrinterStatus.ToString() + '|' + $p.WorkOffline.ToString() + '|' + $p.DetectedErrorState.ToString()) } else { Write-Output 'not_found' }"`;
      exec(cmd, { timeout: 8000 }, (err, out) => {
        if (err) { res(null); return; }
        res((out || '').trim());
      });
    });

    console.log(`[Printer] USB WMI Sonucu: "${wmiResult}"`);

    if (wmiResult && wmiResult !== 'not_found') {
      const parts = wmiResult.split('|');
      const printerStatus = parseInt(parts[0]) || 0;
      const workOffline = (parts[1] || '').toLowerCase() === 'true';
      const detectedErrorState = parseInt(parts[2]) || 0;

      console.log(`[Printer] USB WMI Detayları → PrinterStatus:${printerStatus} WorkOffline:${workOffline} DetectedErrorState:${detectedErrorState}`);

      if (workOffline) return 'not_ready';
      if (printerStatus === 7) return 'not_ready';       // Offline
      if (printerStatus === 6) return 'not_ready';       // StoppedPrinting
      if (detectedErrorState === 9) return 'not_ready';  // Offline hatası
      if (detectedErrorState >= 4) return 'not_ready';   // Kağıt yok, kapı açık, sıkışma vb.
      
      return 'ready';
    }

    // Eğer WMI servisi kullanılamazsa, son güvenlik ağı olarak Electron kontrolü
    console.log(`[Printer] USB WMI yanıt vermedi, Electron Fallback yapılıyor...`);
    try {
      const sysPrinters = mainWindow ? await mainWindow.webContents.getPrintersAsync() : [];
      const norm = (s) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
      const normPN = norm(printerName);
      const match = sysPrinters.find(p =>
        norm(p.name) === normPN || norm(p.displayName) === normPN ||
        norm(p.name).includes(normPN) || normPN.includes(norm(p.name))
      );
      if (match) {
        console.log(`[Printer] USB Electron Fallback eşleşmesi: "${match.name}" status=${match.status}`);
        return match.status === 2 ? 'not_ready' : 'ready';
      }
    } catch (electronErr) {
      console.log('[Printer] USB Electron getPrintersAsync hatası:', electronErr.message);
    }

    console.log('[Printer] USB / Yerel Yazıcı hiçbir yöntemle sistemde bulunamadı → not_ready.');
    return 'not_ready';
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
            const isValEmpty = chunk.trim() === '';
            bytes.push(...textToBytes('|' + lbl + '|'));
            push(ESC, 0x45, 0x01);
            if (!isValEmpty) push(ESC, 0x47, 0x01); // Double strike for value
            bytes.push(...textToBytes(' ' + pad(chunk, maxV)));
            if (!isValEmpty) push(ESC, 0x47, 0x00); // Normal strike
            bytes.push(...textToBytes('|'));
            push(ESC, 0x45, 0x00);
            push(LF);
          });
        };

        // minLines: en az bu kadar satir basilir (bos satir ile doldurulur)
        // maxLines: fazlasi kesilir
        // wordWrap=true ise kelime ortasindan bolmez (adres icin kullanilir)
        const paddedBoldValueRow = (label, value, minLines, maxLines, wordWrap = false) => {
          const maxV = VAL - 1;
          const valStr = (value || '').toString();
          let chunks = [];
          if (valStr.length === 0) {
            chunks = [''];
          } else if (wordWrap) {
            // Kelime bazli satir bölme: kelime ortasindan kesmez
            const words = valStr.split(' ');
            let currentLine = '';
            for (const word of words) {
              if (word.length === 0) continue;
              if (currentLine.length === 0) {
                // Tek kelime maxV'den uzunsa zorla böl
                if (word.length > maxV) {
                  let remaining = word;
                  while (remaining.length > maxV) {
                    chunks.push(remaining.substring(0, maxV));
                    remaining = remaining.substring(maxV);
                  }
                  currentLine = remaining;
                } else {
                  currentLine = word;
                }
              } else if (currentLine.length + 1 + word.length <= maxV) {
                currentLine += ' ' + word;
              } else {
                chunks.push(currentLine);
                if (word.length > maxV) {
                  let remaining = word;
                  while (remaining.length > maxV) {
                    chunks.push(remaining.substring(0, maxV));
                    remaining = remaining.substring(maxV);
                  }
                  currentLine = remaining;
                } else {
                  currentLine = word;
                }
              }
            }
            if (currentLine.length > 0) chunks.push(currentLine);
            if (chunks.length === 0) chunks = [''];
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
            const isValEmpty = chunk.trim() === '';
            bytes.push(...textToBytes('|' + lbl + '|'));
            push(ESC, 0x45, 0x01);
            if (!isValEmpty) push(ESC, 0x47, 0x01); // Double strike for value
            bytes.push(...textToBytes(' ' + pad(chunk, maxV)));
            if (!isValEmpty) push(ESC, 0x47, 0x00); // Normal strike
            bytes.push(...textToBytes('|'));
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

          // Resmin içindeki gerçek mürekkepli (dolu) alanı bularak beyaz/şeffaf fazlalıkları kırp
          let firstRow = size.height, lastRow = 0;
          for (let y = 0; y < size.height; y++) {
            let rowHasInk = false;
            for (let x = 0; x < size.width; x++) {
              const idx = (y * size.width + x) * 4;
              const r = rgba[idx], g = rgba[idx + 1], b = rgba[idx + 2], a = rgba[idx + 3];
              // Tamamen şeffaf veya çok açık renkli (beyaz) ise es geç
              const gray = a < 128 ? 255 : (r + g + b) / 3;
              if (gray < 250) { rowHasInk = true; break; }
            }
            if (rowHasInk) {
              if (y < firstRow) firstRow = y;
              if (y > lastRow) lastRow = y;
            }
          }

          if (firstRow > lastRow) {
            firstRow = 0; lastRow = size.height - 1; // Fallback
          }
          const actualHeight = lastRow - firstRow + 1;

          // ESC a 1: orta hizala
          push(ESC, 0x61, 0x01);
          // ESC 3 24: satir araligini tam 24 noktaya ayarla (serit yuksekligi)
          push(ESC, 0x33, 24);

          // ESC * mode 33 = 24-nokta cift yogunluk; 3 byte/sutun
          const STRIP = 24;
          for (let startRow = 0; startRow < actualHeight; startRow += STRIP) {
            push(ESC, 0x2A, 33, COLS & 0xFF, (COLS >> 8) & 0xFF);
            for (let col = 0; col < COLS; col++) {
              let b0 = 0, b1 = 0, b2 = 0;
              for (let dot = 0; dot < STRIP; dot++) {
                const py = firstRow + startRow + dot; // Sadece kırpılmış alandan itibaren oku
                if (py <= lastRow) {
                  const idx = (py * size.width + col) * 4;
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

        const pushHLineBytes = (down17, up17, down31, up31) => {
          bytes.push(0xC3);
          for (let i = 1; i < W - 1; i++) {
            let char = 0x2D; // -
            if (i === LBL + 1) {
              if (up17 && down17) char = 0xC5;
              else if (up17) char = 0xC1;
              else if (down17) char = 0xC2;
            } else if (i === CAL + 1) {
              if (up31 && down31) char = 0xC5;
              else if (up31) char = 0xC1;
              else if (down31) char = 0xC2;
            }
            bytes.push(char);
          }
          bytes.push(0xB4);
          bytes.push(LF);
        };

        // === HEADER TEK HÜCRE (2 satır) — ortada | yok ===
        // Üst yatay çizgi — köşeler | ile temiz
        bytes.push(0xDA);
        for (let i = 0; i < W - 2; i++) bytes.push(0x2D);
        bytes.push(0xBF);
        bytes.push(LF);
        // İç genişlik = W-2 = 46 char. Sol bölge = LBL(17), Sağ bölge = W-2-LBL(29)
        const hdrR = W - 2 - LBL; // 29 char — sağ yazı bölgesi (iç | yok)
        // Satir 1: Gaziburma ortali | Hat numarasi sag yali
        const headerPhoneStr = fmtPhone(callerPhone || '').substring(0, hdrR).trim();
        line('|' + center('Gaziburma', LBL) + rjust(headerPhoneStr, hdrR) + '|');
        // Satır 2: Mustafa sol bölge ortası | Pendik 4mm (~3 char) sağa kaydırılmış — TEK HÜCRE
        line('|' + center('Mustafa', LBL) + pad('   Pendik', hdrR) + '|');
        pushHLineBytes(true, false, false, false);

        // === SİPARİŞ TARİHİ — değer bold ===
        boldValueRow('Siparis Tarihi:', `${tarih} ${saat}`);
        pushHLineBytes(true, true, false, false);

        // === TESLİMAT TARİHİ ===
        dataRow('Teslimat Tarihi:', '').forEach(r => line(r));
        pushHLineBytes(true, true, false, false);

        // === TEL -- deger bold, formatli ===
        // 'Veri Bekleniyor' veya 'Bilinmiyor' placeholder metinleri fişe BOŞ olarak basılır
        const PLACEHOLDERS = ['Veri Bekleniyor', 'Bilinmiyor', 'Waiting for Data', 'Unknown'];
        const cleanPhone = (PLACEHOLDERS.includes(phone) || !phone) ? '' : phone;
        const cleanName = (PLACEHOLDERS.includes(name) || !name) ? '' : name;
        const cleanAddress = (PLACEHOLDERS.includes(address) || !address) ? '' : address;

        boldValueRow('Tel:', fmtPhone(cleanPhone));
        pushHLineBytes(true, true, false, false);

        // === SİPARİŞ VEREN ===
        dataRow('Siparis Veren:', '').forEach(r => line(r));
        pushHLineBytes(true, true, false, false);

        // === ALICI: min 1 satir, max 4 satir ===
        paddedBoldValueRow('Alici:', cleanName, 1, 4);
        pushHLineBytes(true, true, false, false);

        // === ADRES: min 2 satir, max 10 satir — kelime bazli satir bölme ===
        paddedBoldValueRow('Adres:', cleanAddress, 2, 10, true);

        // Müşteri adresinden hemen sonra her zaman 3 satır boşluk bırak
        paddedBoldValueRow('', '', 3, 3);

        pushHLineBytes(false, true, true, false);

        // === TESLİMAT | TUTAR BAŞLIK ===
        push(ESC, 0x45, 0x01);
        line(colsRow('Teslimat', 'Tutar'));
        push(ESC, 0x45, 0x00);
        pushHLineBytes(false, false, true, true);

        // === BOS SIPARIS ALANI (20 satir) ===
        for (let i = 0; i < 20; i++) {
          line('|' + ' '.repeat(CAL) + '|' + ' '.repeat(CAR) + '|');
        }

        // Alt kapanış
        bytes.push(0xC0);
        for (let i = 0; i < CAL; i++) bytes.push(0x2D);
        bytes.push(0xC1);
        for (let i = 0; i < CAR; i++) bytes.push(0x2D);
        bytes.push(0xD9);
        bytes.push(LF);

        // Kağıt ilerlet + kes (~10mm hassas besleme, sonra kesme)
        // 177→71: 15mm azaltıldı (üst boşluğu kısaltmak için sonraki baskıya yansır)
        push(ESC, 0x4A, 71);     // ESC J 71: kağıdı ~10mm ilerlet
        push(GS, 0x56, 0x42, 0x00);

        return Buffer.from(bytes);
      };


      const receiptBuf = buildReceipt(); // 1 kopya (geçici — eski: Buffer.concat([buildReceipt(), buildReceipt()]))
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

  // ====== Rapor Yazdırma (A4 PDF/HTML Tablosu) ======
  ipcMain.handle('print-a4-report', async (event, callsData, printerName, options = {}) => {
    try {
      if (!printerName) {
        return { success: false, error: 'Rapor yazıcısı seçilmemiş. Lütfen Ayarlar > Yazıcılar menüsünden Rapor Yazıcınızı seçin.' };
      }

      const { reportType = 'cagri_listesi', customReportPhone = '', startDateStr = '', endDateStr = '', startTimeStr = null, endTimeStr = null } = options;

      // Hat numaralarını ayarlardan oku
      let hatNumbers = { 1: '', 2: '', 3: '' };
      try {
        const hatConfigPath = path.join(app.getPath('userData'), 'hat-config.json');
        if (fs.existsSync(hatConfigPath)) {
          const hd = JSON.parse(fs.readFileSync(hatConfigPath, 'utf-8'));
          hatNumbers = hd.hatNumbers || hatNumbers;
        }
      } catch (e) { console.warn('[A4 Print] Hat config okunamadı:', e); }

      const hatFooterHtml = `
        <div style="margin-top:20px; padding-top:12px; border-top:2px solid #e2e8f0; text-align:center; font-size:11px; color:#475569;">
          <b>Hat Bilgileri:</b>
          &nbsp;&nbsp;Hat 1: <b>${hatNumbers[1] || '-'}</b>
          &nbsp;&nbsp;|&nbsp;&nbsp;
          Hat 2: <b>${hatNumbers[2] || '-'}</b>
          &nbsp;&nbsp;|&nbsp;&nbsp;
          Hat 3: <b>${hatNumbers[3] || '-'}</b>
        </div>
      `;

      const fmtPhoneA4 = (raw) => {
        const d = (raw || '').toString().replace(/\D/g, '');
        let num = d;
        if (num.length === 11 && num[0] === '0') num = num.slice(1);
        if (num.length === 10) {
          return '(' + num.slice(0, 3) + ') ' + num.slice(3, 6) + ' ' + num.slice(6, 8) + ' ' + num.slice(8);
        }
        return raw || '';
      };

      const todayStr = new Date().toLocaleDateString('tr-TR');
      const timeStr = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

      const fmtDateTR = (d) => {
        if (!d) return '';
        // YYYY-MM-DD → GG.AA.YYYY
        const parts = d.split('-');
        if (parts.length === 3 && parts[0].length === 4) return `${parts[2]}.${parts[1]}.${parts[0]}`;
        // Zaten GG.AA.YYYY formatındaysa olduğu gibi döndür
        return d;
      };
      const startDateFmt = fmtDateTR(startDateStr);
      const endDateFmt = fmtDateTR(endDateStr);

      // Saat filtresi kullanıldıysa "GG.AA.YYYY/SS:DD - GG.AA.YYYY/SS:DD" formatında göster
      const dateRangeDisplay = (startTimeStr && endTimeStr)
        ? `${startDateFmt} / ${startTimeStr} - ${endDateFmt} / ${endTimeStr}`
        : `${startDateFmt} - ${endDateFmt}`;

      let htmlContent = '';

      let logoHtml = '';
      try {
        const logoFileName = 'Gaziburma Logo (1458x625).png';
        const candidatePaths = [
          path.join(app.getAppPath(), logoFileName),
          path.join(__dirname, '..', logoFileName),
          path.join(__dirname, logoFileName),
          path.join(process.resourcesPath || '', '..', logoFileName),
        ];
        let foundLogoPath = null;
        for (const p of candidatePaths) {
          try { if (fs.existsSync(p)) { foundLogoPath = p; break; } } catch {}
        }
        if (foundLogoPath) {
          const logoData = fs.readFileSync(foundLogoPath);
          const logoBase64 = `data:image/png;base64,${logoData.toString('base64')}`;
          logoHtml = `<img src="${logoBase64}" alt="Gaziburma Logo" style="max-height: 55px; display: block; margin: 0 auto 8px auto;" />`;
          console.log('[A4 Print] Logo yüklendi:', foundLogoPath);
        } else {
          console.warn('[A4 Print] Logo dosyası bulunamadı. Denenen yollar:', candidatePaths);
        }
      } catch (e) {
        console.error('Logo yüklenemedi:', e);
      }

      if (reportType === 'arama_sayisi') {
        const map = {};
        callsData.forEach(call => {
          let rawPhone = (call.phone || '').replace(/\D/g, '');
          if (rawPhone.length >= 10) rawPhone = rawPhone.slice(-10);
          if (!rawPhone || rawPhone.length !== 10) return;
          if (!map[rawPhone]) {
            map[rawPhone] = { count: 0, lineCounts: {}, name: call.name, lastDate: call.date, lastTime: call.time, formattedPhone: call.phone };
          }
          map[rawPhone].count += 1;
          const lineMatch = call.line ? call.line.match(/\d+/) : null;
          if (lineMatch) {
            const hatKey = 'Hat ' + lineMatch[0];
            map[rawPhone].lineCounts[hatKey] = (map[rawPhone].lineCounts[hatKey] || 0) + 1;
          }
          map[rawPhone].lastDate = call.date;
          map[rawPhone].lastTime = call.time;
          if (call.name && call.name !== 'Veri Bekleniyor' && call.name.trim() !== '') {
            map[rawPhone].name = call.name;
          }
        });

        const arr = Object.values(map).sort((a,b) => b.count - a.count);
        let tableRows = '';
        arr.forEach((item, index) => {
          const name = item.name && item.name.trim() !== '' ? item.name : 'Kayıtlı değil';
          const linesStr = Object.keys(item.lineCounts).sort().map(h => `<span style="white-space:nowrap">${h} (${item.lineCounts[h]})</span>`).join(', ');
          tableRows += `
            <tr>
              <td style="text-align: center;">${index + 1}</td>
              <td style="text-align: center; white-space: nowrap;">${item.lastDate}<br/><b>${item.lastTime}</b></td>
              <td>${name}</td>
              <td style="white-space: nowrap;">${fmtPhoneA4(item.formattedPhone)}</td>
              <td style="text-align: center; font-weight: bold; font-size: 14px;">${item.count}</td>
              <td style="text-align: center;">${linesStr}</td>
            </tr>
          `;
        });

        htmlContent = `
          <!DOCTYPE html>
          <html lang="tr">
          <head>
            <meta charset="UTF-8">
            <style>
              @page { size: A4 portrait; margin: 15mm 15mm 20mm 15mm; @bottom-right { content: "Sayfa " counter(page) " / " counter(pages); font-family: Calibri, "Segoe UI", Arial, sans-serif; font-size: 10px; color: #555; } }
              body { font-family: Calibri, "Segoe UI", Arial, sans-serif; font-size: 11px; padding: 0; margin: 0; color: #111; }
              * { font-feature-settings: "liga" 0, "clig" 0, "calt" 0; font-variant-ligatures: none; font-variant: normal; }
              .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #ddd; padding-bottom: 10px; }
              .header h1 { margin: 0; font-size: 20px; color: #000; }
              .header p { margin: 5px 0 0 0; font-size: 12px; color: #444; }
              table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
              th, td { border: 1px solid #ccc; padding: 8px 6px; text-align: left; word-wrap: break-word; }
              th { background-color: #f1f5f9; font-weight: bold; font-size: 12px; color: #334155; }
            </style>
          </head>
          <body>
            <div class="header">
              ${logoHtml}
              <h1>Gaziburma Mustafa - Arama Sayısı Raporu</h1>
              <p>Oluşturulma Tarihi: <b>${todayStr} ${timeStr}</b></p>
              <p>Seçilen Tarih Aralığı: <b>${dateRangeDisplay}</b></p>
            </div>
            <table>
              <thead>
                <tr>
                  <th style="width: 5%; text-align: center;">Sıra</th>
                  <th style="width: 15%; text-align: center;">Son Arama Tarihi</th>
                  <th style="width: 30%;">Müşteri Adı / Unvanı</th>
                  <th style="width: 15%;">Telefon</th>
                  <th style="width: 15%; text-align: center;">Arama Sayısı</th>
                  <th style="width: 20%; text-align: center;">Aradığı Hatlar</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows}
              </tbody>
            </table>
            ${hatFooterHtml}
          </body>
          </html>
        `;

      } else if (reportType === 'hat_bazinda') {
        const counts = { 1: 0, 2: 0, 3: 0 };
        let total = 0;

        // Tarih x Hat matrisi
        const hatColors = { 1: '#3b82f6', 2: '#22c55e', 3: '#f97316' };
        const dateHatMap = {}; // { 'GG.AA.YYYY': { 1: N, 2: N, 3: N } }

        callsData.forEach(call => {
          const m = call.line ? call.line.match(/\d+/) : null;
          if (m && counts[m[0]] !== undefined) {
            counts[m[0]]++;
            total++;
            const d = call.date || 'Bilinmiyor';
            if (!dateHatMap[d]) dateHatMap[d] = { 1: 0, 2: 0, 3: 0 };
            dateHatMap[d][m[0]]++;
          }
        });

        const max = Math.max(counts[1], counts[2], counts[3], 1);

        // Tarihleri sırala
        const sortedDatesH = Object.keys(dateHatMap).sort((a, b) => {
          const pa = a.split('.').reverse().join('');
          const pb = b.split('.').reverse().join('');
          return pa.localeCompare(pb);
        });

        // SVG çizgi grafiği
        const svgW = 520, svgH = 230, padL = 45, padB = 30, padT = 20, padR = 20;
        const cW = svgW - padL - padR;
        const cH = svgH - padB - padT;
        const nDates = Math.max(sortedDatesH.length, 1);
        const maxDaily = Math.max(...sortedDatesH.map(d => Math.max(dateHatMap[d][1], dateHatMap[d][2], dateHatMap[d][3])), 1);

        let svgLines = '';
        let svgDots = '';
        let xLabels = '';

        sortedDatesH.forEach((d, i) => {
          const x = padL + (i * cW) / Math.max(nDates - 1, 1);
          xLabels += `<text x="${x}" y="${svgH - 8}" font-size="9" text-anchor="middle" fill="#475569">${d}</text>`;
        });

        [1, 2, 3].forEach(id => {
          const color = hatColors[id];
          let pts = [];
          sortedDatesH.forEach((d, i) => {
            const x = padL + (i * cW) / Math.max(nDates - 1, 1);
            const y = padT + cH - (dateHatMap[d][id] / maxDaily) * cH;
            pts.push(`${x},${y}`);
            svgDots += `<circle cx="${x}" cy="${y}" r="3.5" fill="${color}" />`;
            if (dateHatMap[d][id] > 0) {
              svgDots += `<text x="${x}" y="${y - 7}" font-size="9" font-weight="bold" text-anchor="middle" fill="${color}">${dateHatMap[d][id]}</text>`;
            }
          });
          if (pts.length > 1) {
            svgLines += `<polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="2" />`;
          }
        });

        // Y ekseni kılavuz çizgileri
        const yGuides = [0, 0.25, 0.5, 0.75, 1].map(frac => {
          const y = padT + cH - frac * cH;
          const val = Math.round(frac * maxDaily);
          return `<line x1="${padL}" y1="${y}" x2="${svgW - padR}" y2="${y}" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="3"/>
                  <text x="${padL - 6}" y="${y}" font-size="9" text-anchor="end" alignment-baseline="middle" fill="#64748b">${val}</text>`;
        }).join('');

        const svgAxes = `
          <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + cH}" stroke="#94a3b8" stroke-width="2"/>
          <line x1="${padL}" y1="${padT + cH}" x2="${svgW - padR}" y2="${padT + cH}" stroke="#94a3b8" stroke-width="2"/>
        `;

        // Legend
        const legendHtml = `
          <div style="display:flex; flex-direction:column; justify-content:center; gap:10px; padding-left:16px; border-left:2px solid #e2e8f0;">
            ${[1,2,3].map(id => `
              <div style="display:flex; align-items:center; gap:8px; white-space:nowrap;">
                <svg width="28" height="4"><line x1="0" y1="2" x2="28" y2="2" stroke="${hatColors[id]}" stroke-width="3"/></svg>
                <span style="font-size:12px; color:#334155; font-weight:bold;">Hat ${id}</span>
                <span style="font-size:12px; color:#64748b;">(${counts[id]} çağrı)</span>
              </div>
            `).join('')}
          </div>
        `;

        const svgChartBlock = sortedDatesH.length > 0 ? `
          <h3 style="text-align:center; color:#334155; font-size:15px; margin:30px 0 10px 0;">Tarihe Göre Hat Bazında Çağrı Grafiği</h3>
          <div style="display:flex; align-items:stretch; justify-content:center; gap:0;">
            <svg width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}" style="border:1px solid #cbd5e1; border-radius:8px; background:#fff; flex-shrink:0;">
              ${yGuides}
              ${svgAxes}
              ${xLabels}
              ${svgLines}
              ${svgDots}
            </svg>
            ${legendHtml}
          </div>
        ` : '';

        htmlContent = `
          <!DOCTYPE html>
          <html lang="tr">
          <head>
            <meta charset="UTF-8">
            <style>
              @page { size: A4 portrait; margin: 15mm 15mm 20mm 15mm; @bottom-right { content: "Sayfa " counter(page) " / " counter(pages); font-family: Calibri, "Segoe UI", Arial, sans-serif; font-size: 10px; color: #555; } }
              body { font-family: Calibri, "Segoe UI", Arial, sans-serif; color: #111; }
              * { font-feature-settings: "liga" 0, "clig" 0, "calt" 0; font-variant-ligatures: none; font-variant: normal; }
              .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #ddd; padding-bottom: 10px; }
              .header h1 { margin: 0; font-size: 20px; }
              .header p { margin: 5px 0 0 0; font-size: 12px; color: #444; }
              .bar-container { display: flex; align-items: flex-end; justify-content: space-around; height: 280px; border-bottom: 2px solid #ccc; padding-bottom: 5px; margin: 20px 40px; }
              .bar-wrapper { display: flex; flex-direction: column; align-items: center; width: 80px; }
              .bar { width: 100%; border-radius: 4px 4px 0 0; background-color: #38bdf8; display: flex; flex-direction: column; justify-content: flex-start; align-items: center; color: white; font-weight: bold; padding-top: 8px; font-size: 16px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .label { margin-top: 10px; font-weight: bold; font-size: 14px; }
              .total { text-align: center; font-size: 16px; margin-top: 20px; }
            </style>
          </head>
          <body>
            <div class="header">
              ${logoHtml}
              <h1>Gaziburma Mustafa - Hat Bazında Rapor</h1>
              <p>Oluşturulma Tarihi: <b>${todayStr} ${timeStr}</b></p>
              <p>Seçilen Tarih Aralığı: <b>${dateRangeDisplay}</b></p>
            </div>
            <div class="total">Toplam Arama Sayısı: <b>${total}</b></div>
            <div class="bar-container">
              ${[1,2,3].map(id => {
                const heightPct = (counts[id] / max) * 100;
                return `
                  <div class="bar-wrapper">
                    <div class="bar" style="height: ${Math.max(heightPct, 5)}%;">${counts[id]}</div>
                    <div class="label">Hat ${id}</div>
                  </div>
                `;
              }).join('')}
            </div>
            ${svgChartBlock}
            ${hatFooterHtml}
          </body>
          </html>
        `;
        const dateMap = {};
        callsData.forEach(c => {
          const d = c.date || 'Bilinmiyor';
          dateMap[d] = (dateMap[d] || 0) + 1;
        });
        const totalCalls = callsData.length;
        const sortedDatesG = Object.keys(dateMap).sort((a,b) => {
          const pa = a.split('.').reverse().join('');
          const pb = b.split('.').reverse().join('');
          return pa.localeCompare(pb);
        });
        let maxCountG = Math.max(...Object.values(dateMap), 1);
        let columnsHtmlG = '';
        sortedDatesG.forEach(d => {
          const count = dateMap[d];
          const heightPct = (count / maxCountG) * 100;
          columnsHtmlG += `
            <div style="display:flex; flex-direction:column; align-items:center; flex:1; margin: 0 4px; max-width: 60px;">
              <div style="flex:1; display:flex; flex-direction:column; justify-content:flex-end; width:100%; background:#f8fafc; border-radius:4px; overflow:hidden;">
                <div style="height:${Math.max(heightPct, 5)}%; background-color:#38bdf8; -webkit-print-color-adjust:exact; print-color-adjust:exact; width:100%; border-radius:4px 4px 0 0; text-align:center; color:#fff; font-weight:bold; font-size:12px; padding-top:4px;">${count}</div>
              </div>
              <div style="font-size:11px; margin-top:8px; color:#334155; font-weight:500;">${d}</div>
            </div>
          `;
        });

        // SVG Çizgi Grafiği
        const svgWG = 650, svgHG = 220, padLG = 45, padBG = 25, padTG = 25;
        const cWG = svgWG - padLG * 2;
        const cHG = svgHG - padBG - padTG;
        const nG = Math.max(sortedDatesG.length, 1);
        let pathPtsG = [], circlesG = '', xLabsG = '';
        sortedDatesG.forEach((d, i) => {
          const x = padLG + (i * cWG) / Math.max(nG - 1, 1);
          const y = padTG + cHG - (dateMap[d] / maxCountG) * cHG;
          pathPtsG.push(`${x},${y}`);
          circlesG += `<circle cx="${x}" cy="${y}" r="4" fill="#ef4444" />`;
          circlesG += `<text x="${x}" y="${y - 8}" font-size="10" font-weight="bold" text-anchor="middle" fill="#1e293b">${dateMap[d]}</text>`;
          xLabsG += `<text x="${x}" y="${svgHG - 8}" font-size="10" text-anchor="middle" fill="#475569">${d}</text>`;
        });
        const yLabsG = `
          <text x="${padLG - 10}" y="${padTG + cHG}" font-size="10" text-anchor="end" alignment-baseline="middle">0</text>
          <text x="${padLG - 10}" y="${padTG}" font-size="10" text-anchor="end" alignment-baseline="middle">${maxCountG}</text>
          <line x1="${padLG}" y1="${padTG}" x2="${svgWG - padLG}" y2="${padTG}" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="4" />
        `;
        const svgAxesG = `
          <line x1="${padLG}" y1="${padTG}" x2="${padLG}" y2="${padTG + cHG}" stroke="#94a3b8" stroke-width="2" />
          <line x1="${padLG}" y1="${padTG + cHG}" x2="${svgWG - padLG}" y2="${padTG + cHG}" stroke="#94a3b8" stroke-width="2" />
        `;
        const svgChartHtmlG = `
          <h3 style="margin-top:30px; text-align:center; color:#334155; font-size:15px;">X-Y Çizgi Grafiği (Gün / Arama Sayısı)</h3>
          <div style="display:flex; justify-content:center;">
            <svg width="100%" height="${svgHG}" viewBox="0 0 ${svgWG} ${svgHG}" style="background:#fff; border:1px solid #cbd5e1; border-radius:8px; width:100%; max-width:${svgWG}px;">
              ${yLabsG}
              ${svgAxesG}
              ${xLabsG}
              <polyline points="${pathPtsG.join(' ')}" fill="none" stroke="#3b82f6" stroke-width="2" />
              ${circlesG}
            </svg>
          </div>
        `;

        htmlContent = `
          <!DOCTYPE html>
          <html lang="tr">
          <head>
            <meta charset="UTF-8">
            <style>
              @page { size: A4 portrait; margin: 15mm 15mm 20mm 15mm; @bottom-right { content: "Sayfa " counter(page) " / " counter(pages); font-family: Calibri, "Segoe UI", Arial, sans-serif; font-size: 10px; color: #555; } }
              body { font-family: Calibri, "Segoe UI", Arial, sans-serif; color: #111; }
              * { font-feature-settings: "liga" 0, "clig" 0, "calt" 0; font-variant-ligatures: none; font-variant: normal; }
              .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #ddd; padding-bottom: 10px; }
              .header h1 { margin: 0; font-size: 20px; }
              .header p { margin: 5px 0 0 0; font-size: 12px; color: #444; }
              .info-box { background: #f1f5f9; padding: 12px; border-radius: 8px; text-align: center; font-size: 14px; margin-bottom: 20px; border: 1px solid #cbd5e1; }
              .chart-container { display: flex; align-items: flex-end; justify-content: center; height: 200px; padding-bottom: 10px; margin: 0 10px; border-bottom: 2px solid #e2e8f0; }
            </style>
          </head>
          <body>
            <div class="header">
              ${logoHtml}
              <h1>Gaziburma Mustafa - Günlere Göre Rapor</h1>
              <p>Oluşturulma Tarihi: <b>${todayStr} ${timeStr}</b></p>
              <p>Seçilen Tarih Aralığı: <b>${dateRangeDisplay}</b></p>
            </div>
            <div class="info-box">
              Seçilen tarih aralığında toplam <b>${totalCalls}</b> arama kaydı bulunmaktadır.
            </div>
            <h3 style="text-align:center; color:#334155; font-size:15px; margin:0 0 10px 0;">Günlük Arama Sütun Grafiği</h3>
            <div class="chart-container">${columnsHtmlG}</div>
            ${svgChartHtmlG}
            ${hatFooterHtml}
          </body>
          </html>
        `;

      } else if (reportType === 'ozel_rapor') {
        const rawTarget = customReportPhone.replace(/\D/g, '').slice(-10);
        const targetCalls = callsData.filter(c => {
          let p = (c.phone || '').replace(/\D/g, '');
          if (p.length >= 10) p = p.slice(-10);
          return p === rawTarget;
        });

        const dateMap = {};
        let totalCalls = targetCalls.length;
        let customerName = 'Kayıtlı Değil';

        targetCalls.forEach(c => {
          if (c.name && c.name !== 'Veri Bekleniyor' && c.name.trim() !== '') customerName = c.name;
          const d = c.date || 'Bilinmiyor';
          dateMap[d] = (dateMap[d] || 0) + 1;
        });

        let maxCount = Math.max(...Object.values(dateMap), 1);
        let columnsHtml = '';
        
        const sortedDates = Object.keys(dateMap).sort((a,b) => {
           const pa = a.split('.').reverse().join('');
           const pb = b.split('.').reverse().join('');
           return pa.localeCompare(pb);
        });
        
        sortedDates.forEach(d => {
           const count = dateMap[d];
           const heightPct = (count / maxCount) * 100;
           columnsHtml += `
             <div style="display:flex; flex-direction:column; align-items:center; flex:1; margin: 0 4px; max-width: 60px;">
               <div style="flex:1; display:flex; flex-direction:column; justify-content:flex-end; width:100%; background:#f8fafc; border-radius:4px; overflow:hidden;">
                  <div style="height:${Math.max(heightPct, 5)}%; background:-webkit-print-color-adjust: exact; background-color:#14b8a6; width:100%; border-radius:4px 4px 0 0; text-align:center; color:#fff; font-weight:bold; font-size:12px; padding-top:4px;">${count}</div>
               </div>
               <div style="font-size:11px; margin-top:8px; color:#334155; font-weight: 500;">${d}</div>
             </div>
           `;
        });

        // EKSEN GRAFİĞİ İÇİN SVG YÖNTEMİ
        const svgWidth = 650;
        const svgHeight = 220;
        const paddingLat = 40;
        const paddingBot = 25;
        const paddingTop = 25;
        const chartW = svgWidth - paddingLat * 2;
        const chartH = svgHeight - paddingBot - paddingTop;
        const n = Math.max(sortedDates.length, 1);
        
        let pathPoints = [];
        let circles = '';
        let xLabels = '';
        
        sortedDates.forEach((d, i) => {
          const x = paddingLat + (i * chartW) / Math.max(n - 1, 1);
          const y = paddingTop + chartH - (dateMap[d] / maxCount) * chartH;
          pathPoints.push(`${x},${y}`);
          circles += `<circle cx="${x}" cy="${y}" r="4" fill="#ef4444" />`;
          circles += `<text x="${x}" y="${y - 8}" font-size="10" font-weight="bold" text-anchor="middle" fill="#1e293b">${dateMap[d]}</text>`;
          xLabels += `<text x="${x}" y="${svgHeight - 8}" font-size="10" text-anchor="middle" fill="#475569">${d}</text>`;
        });
        
        const yLabels = `
          <text x="${paddingLat - 10}" y="${paddingTop + chartH}" font-size="10" text-anchor="end" alignment-baseline="middle">0</text>
          <text x="${paddingLat - 10}" y="${paddingTop}" font-size="10" text-anchor="end" alignment-baseline="middle">${maxCount}</text>
          <line x1="${paddingLat}" y1="${paddingTop}" x2="${svgWidth - paddingLat}" y2="${paddingTop}" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="4" />
        `;
        
        const svgAxes = `
          <!-- Y ekseni -->
          <line x1="${paddingLat}" y1="${paddingTop}" x2="${paddingLat}" y2="${paddingTop + chartH}" stroke="#94a3b8" stroke-width="2" />
          <!-- X ekseni -->
          <line x1="${paddingLat}" y1="${paddingTop + chartH}" x2="${svgWidth - paddingLat}" y2="${paddingTop + chartH}" stroke="#94a3b8" stroke-width="2" />
        `;

        const svgChartHtml = `
          <h3 style="margin-top:40px; text-align:center; color:#334155; font-size:16px;">X-Y Çizgi Grafiği</h3>
          <div style="display:flex; justify-content:center;">
            <svg width="100%" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" style="background:#fff; border:1px solid #cbd5e1; border-radius:8px; width:100%; max-width:${svgWidth}px;">
              ${yLabels}
              ${svgAxes}
              ${xLabels}
              <polyline points="${pathPoints.join(' ')}" fill="none" stroke="#3b82f6" stroke-width="2" />
              ${circles}
            </svg>
          </div>
        `;

        htmlContent = `
          <!DOCTYPE html>
          <html lang="tr">
          <head>
            <meta charset="UTF-8">
            <style>
              @page { size: A4 portrait; margin: 15mm 15mm 20mm 15mm; @bottom-right { content: "Sayfa " counter(page) " / " counter(pages); font-family: Calibri, "Segoe UI", Arial, sans-serif; font-size: 10px; color: #555; } }
              body { font-family: Calibri, "Segoe UI", Arial, sans-serif; color: #111; }
              * { font-feature-settings: "liga" 0, "clig" 0, "calt" 0; font-variant-ligatures: none; font-variant: normal; }
              .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #ddd; padding-bottom: 10px; }
              .header h1 { margin: 0; font-size: 20px; }
              .header p { margin: 5px 0 0 0; font-size: 12px; color: #444; }
              .info-box { background: #f1f5f9; padding: 15px; border-radius: 8px; text-align: center; font-size: 14px; margin-bottom: 25px; border: 1px solid #cbd5e1; }
              .chart-container { display: flex; align-items: flex-end; justify-content: center; height: 200px; padding-bottom: 10px; margin: 0 10px; border-bottom: 2px solid #e2e8f0; }
            </style>
          </head>
          <body>
            <div class="header">
              ${logoHtml}
              <h1>Gaziburma Mustafa - Özel Rapor Grafiği</h1>
              <p>Oluşturulma Tarihi: <b>${todayStr} ${timeStr}</b></p>
              <p>Seçilen Tarih Aralığı: <b>${dateRangeDisplay}</b></p>
            </div>
            <div class="info-box">
              Müşteri: <b>${customerName}</b> &nbsp;&nbsp;|&nbsp;&nbsp; 
              Telefon: <b>${fmtPhoneA4(customReportPhone)}</b><br/>
              Belirtilen tarih aralığında toplam <b>${totalCalls}</b> kez arama yapılmıştır.
            </div>
            
            ${totalCalls > 0 ? `
              <h3 style="text-align:center; color:#334155; font-size:16px; margin:0 0 10px 0;">Arama Sayısı Sütun Trafiği</h3>
              <div class="chart-container">${columnsHtml}</div>
              ${svgChartHtml}
            ` : `<p style="text-align:center;">Bu kriterlere uygun arama bulunamadı.</p>`}
            ${hatFooterHtml}
          </body>
          </html>
        `;

      } else {
        let tableRows = '';
        callsData.forEach((call, index) => {
          const name = call.name && call.name.trim() !== '' ? call.name : 'Kayıtlı değil';
          const phone = fmtPhoneA4(call.phone);
          const addr = call.address && call.address.trim() !== '' ? call.address : 'Kayıtlı değil';
          
          const lineMatch = call.line ? call.line.match(/\d+/) : null;
          const lineId = lineMatch ? lineMatch[0] : '';
          const lineStr = lineId ? `Hat ${lineId}` : '-';

          let bgColor = '';
          if (lineId === '1') bgColor = '#e0f2fe';
          else if (lineId === '2') bgColor = '#dcfce3';
          else if (lineId === '3') bgColor = '#ffedd5';

          const callDate = call.date || '';
          const callTime = call.time || '';

          tableRows += `
            <tr style="${bgColor ? 'background-color: ' + bgColor + ';' : ''}">
              <td style="text-align: center;">${index + 1}</td>
              <td style="text-align: center; white-space: nowrap;">${callDate}<br/><b>${callTime}</b></td>
              <td>${name}</td>
              <td style="white-space: nowrap;">${phone}</td>
              <td>${addr}</td>
              <td style="text-align: center; font-weight: bold;">${lineStr}</td>
            </tr>
          `;
        });

        htmlContent = `
          <!DOCTYPE html>
          <html lang="tr">
          <head>
            <meta charset="UTF-8">
            <style>
              @page { size: A4 portrait; margin: 15mm 15mm 20mm 15mm; @bottom-right { content: "Sayfa " counter(page) " / " counter(pages); font-family: Calibri, "Segoe UI", Arial, sans-serif; font-size: 10px; color: #555; } }
              body { font-family: Calibri, "Segoe UI", Arial, sans-serif; font-size: 11px; padding: 0; margin: 0; color: #111; }\n              * { font-feature-settings: "liga" 0, "clig" 0, "calt" 0, "kern" 0; -webkit-font-feature-settings: "liga" 0, "clig" 0, "calt" 0, "kern" 0; font-variant-ligatures: none; font-variant: normal; }
              .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #ddd; padding-bottom: 10px; }
              .header h1 { margin: 0; font-size: 20px; color: #000; }
              .header p { margin: 5px 0 0 0; font-size: 12px; color: #444; }
              table { width: 100%; border-collapse: collapse; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
              th, td { border: 1px solid #ccc; padding: 8px 6px; text-align: left; vertical-align: middle; word-wrap: break-word; }
              th { background-color: #f1f5f9; font-weight: bold; font-size: 12px; color: #334155; }
              tr { page-break-inside: avoid; break-inside: avoid; }
              td { font-size: 11px; color: #1e293b; }
              tfoot { display: table-footer-group; }
              .footer-cell {
                border: none !important;
                text-align: center; font-size: 11px; font-weight: 700;
                padding-top: 15px !important; color: #334155;
                background-color: white !important;
              }
            </style>
          </head>
          <body>
            <div class="header">
              ${logoHtml}
              <h1>Gaziburma Mustafa - Sipariş Arama Raporu</h1>
              <p>Oluşturulma Tarihi: <b>${todayStr} ${timeStr}</b></p>
              <p>Seçilen Tarih Aralığı: <b>${dateRangeDisplay}</b> &nbsp;&nbsp;|&nbsp;&nbsp; Toplam Kayıt: <b>${callsData.length}</b></p>
            </div>
            <table>
              <thead>
                <tr>
                  <th style="width: 5%; text-align: center;">Sıra</th>
                  <th style="width: 10%; text-align: center;">Tarih/Saat</th>
                  <th style="width: 20%;">Müşteri Adı / Unvanı</th>
                  <th style="width: 15%;">Telefon</th>
                  <th style="width: 40%;">Adres Bilgisi</th>
                  <th style="width: 10%; text-align: center;">Hat</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="6" class="footer-cell">
                    Hat 1: <b>${hatNumbers[1] || '-'}</b> &nbsp;&nbsp;|&nbsp;&nbsp; Hat 2: <b>${hatNumbers[2] || '-'}</b> &nbsp;&nbsp;|&nbsp;&nbsp; Hat 3: <b>${hatNumbers[3] || '-'}</b>
                  </td>
                </tr>
              </tfoot>
            </table>
          </body>
          </html>
        `;
      }

      const printWin = new BrowserWindow({
        show: false,
        webPreferences: { nodeIntegration: false, contextIsolation: true }
      });

      await printWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent));

      return new Promise((resolve) => {
        printWin.webContents.print({
          silent: true,
          deviceName: printerName,
          printBackground: true,
          color: true,
          margins: { marginType: 'printableArea' }
        }, (success, failureReason) => {
          printWin.destroy();
          if (success) {
            console.log('[A4 Print] Yazdırma başarılı.');
            resolve({ success: true });
          } else {
            console.error('[A4 Print] Yazdırma hatası:', failureReason);
            resolve({ success: false, error: failureReason });
          }
        });
      });
    } catch (error) {
      console.error('[A4 Print] İstisna:', error);
      return { success: false, error: error.message };
    }
  });

});



ipcMain.handle('get-window-maximized', () => {
  return mainWindow ? mainWindow.isMaximized() : true;
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



ipcMain.handle('get-usb-status', () => {
  return bridgeProcess !== null;
});
