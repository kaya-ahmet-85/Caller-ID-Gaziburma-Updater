const { contextBridge, ipcRenderer } = require('electron');

// Güvenli IPC (Inter-Process Communication) Katmanı
// Buradaki fonksiyonlar Vite (React) içindeki window nesnesine aktarılır.
contextBridge.exposeInMainWorld('electronAPI', {
  ping: (message) => ipcRenderer.send('ping', message),
  onPong: (callback) => ipcRenderer.on('pong', (event, arg) => callback(arg)),

  // İleride Caller ID cihazından gelen verileri dinlemek için eklenecek olay
  onCallerIdData: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('caller-id-data', listener);
    return () => ipcRenderer.removeListener('caller-id-data', listener);
  },

  // Pencere Kontrolleri
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  openExternal: (url) => ipcRenderer.send('open-external', url),
  onUsbStatus: (callback) => {
    const listener = (event, status) => callback(status);
    ipcRenderer.on('usb-status', listener);
    return () => ipcRenderer.removeListener('usb-status', listener);
  },
  onSyncStatus: (callback) => {
    const listener = (event, status) => callback(status);
    ipcRenderer.on('sync-status', listener);
    return () => ipcRenderer.removeListener('sync-status', listener);
  },
  onGlobalDataUpdated: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('global-data-updated', listener);
    return () => ipcRenderer.removeListener('global-data-updated', listener);
  },
  onInternetStatus: (callback) => {
    const listener = (event, status) => callback(status);
    ipcRenderer.on('internet-status', listener);
    return () => ipcRenderer.removeListener('internet-status', listener);
  },
  getUsbStatus: () => ipcRenderer.invoke('get-usb-status'),
  manualRefresh: (lineLabel, phone) => ipcRenderer.invoke('manual-refresh', { lineLabel, phone }),
  lookupCustomer: (phone) => ipcRenderer.invoke('lookup-customer', phone),
  forceSync: () => ipcRenderer.invoke('force-sync'),
  saveAppState: (state) => ipcRenderer.send('save-app-state', state),
  getAppState: () => ipcRenderer.invoke('get-app-state'),
  openSettings: () => ipcRenderer.send('open-settings'),
  closeSettings: () => ipcRenderer.send('close-settings'),
  openHelp: () => ipcRenderer.send('open-help'),
  closeHelp: () => ipcRenderer.send('close-help'),
  advancedSearch: (query) => ipcRenderer.invoke('advanced-search', query),

  // Yazıcı Yönetimi
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  savePrinterSelection: (printerName) => ipcRenderer.invoke('save-printer-selection', printerName),
  getPrinterSelection: () => ipcRenderer.invoke('get-printer-selection'),
  printCustomerInfo: (data) => ipcRenderer.invoke('print-customer-info', data),
  printTestPage: (printerName) => ipcRenderer.invoke('print-test-page', printerName),

  // Modal Görsel Uyarı — arka plan tıklandığında kırmızı gölge efekti
  onFlashAlert: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('flash-alert', listener);
    return () => ipcRenderer.removeListener('flash-alert', listener);
  },

  // Hat Numarası Yönetimi
  getHatNumbers: () => ipcRenderer.invoke('get-hat-numbers'),
  saveHatNumbers: (hatNumbers) => ipcRenderer.invoke('save-hat-numbers', hatNumbers),
  onHatNumbersUpdated: (callback) => {
    const listener = (event, hatNumbers) => callback(hatNumbers);
    ipcRenderer.on('hat-numbers-updated', listener);
    return () => ipcRenderer.removeListener('hat-numbers-updated', listener);
  },

  // Tema Yönetimi (Açık / Koyu Mod)
  getTheme: () => ipcRenderer.invoke('get-theme'),
  saveTheme: (theme) => ipcRenderer.invoke('save-theme', theme),
  onThemeUpdated: (callback) => {
    const listener = (event, theme) => callback(theme);
    ipcRenderer.on('theme-updated', listener);
    return () => ipcRenderer.removeListener('theme-updated', listener);
  },

  // Parola Yönetimi
  getPasswordConfig: () => ipcRenderer.invoke('get-password-config'),
  savePasswordConfig: (cfg) => ipcRenderer.invoke('save-password-config', cfg),
  verifyPassword: (pwd) => ipcRenderer.invoke('verify-password', pwd),
  verifySecretAnswer: (ans) => ipcRenderer.invoke('verify-secret-answer', ans),
  resetPassword: (newPwd) => ipcRenderer.invoke('reset-password', newPwd),

  // Yönetici Şifresi
  verifyAdminPassword: (pwd) => ipcRenderer.invoke('verify-admin-password', pwd),
  adminDisablePassword: (adminPwd) => ipcRenderer.invoke('admin-disable-password', adminPwd),

  // Dil Yönetimi
  getLanguage: () => ipcRenderer.invoke('get-language'),
  saveLanguage: (lang) => ipcRenderer.invoke('save-language', lang),

  // Dil Uygulama (kaydet + ana pencereyi yenile)
  applyLanguage: (lang) => ipcRenderer.invoke('apply-language', lang)
});
