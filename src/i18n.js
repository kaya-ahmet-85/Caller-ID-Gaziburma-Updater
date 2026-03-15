// ====================================================
// i18n.js — Türkçe / İngilizce Çeviri Sözlüğü
// ====================================================

export const translations = {
  tr: {
    // ── GENEL ──
    appTitle: 'SİPARİŞ TAKİP SİSTEMİ',
    orderSystem: 'Sipariş Takip Sistemi',
    save: 'Kaydet',
    cancel: 'İptal',
    close: 'Kapat',

    // ── SIDEBAR ──
    settings: 'Ayarlar',
    webInterface: 'WEB ARAYÜZÜNE GİT',
    shutDown: 'SİSTEMİ KAPAT',
    updating: 'Güncelleniyor',
    lastUpdate: '(Son güncelleme)',
    updateNow: 'Şimdi Güncelle',
    noInternet: 'İnternet Bağlantısı Yok',

    // ── HAT KUTULARI ──
    customerName: 'MÜŞTERİ ADI',
    phoneNumber: 'TELEFON NUMARASI',
    addressInfo: 'ADRES BİLGİSİ',
    print: 'YAZDIR',
    edit: 'DÜZENLE',
    refresh: 'YENİLE',
    waitingData: 'Veri Bekleniyor',
    unknown: 'Bilinmiyor',
    noRecord: 'Başka kayıt yoktur !!!',
    noRecordAvail: 'Kayıt Mevcut Değil',
    prevCall: 'Bir Önceki Çağrı Bilgilerini Göster',
    nextCall: 'Bir Sonraki Çağrı Bilgilerini Göster',
    searchCustomer: 'Müşteri Adı veya Tel No ara...',
    line: 'Hat',

    // ── ÇAĞRI LİSTESİ ──
    callList: 'Çağrı Listesi',
    callCount: 'Çağrı',
    refreshToday: 'Yenile (Bu günün çağrı listesine gel)',
    filterByDate: 'Tarihe Göre Filtrele',
    searchPlaceholder: 'Numara, İsim, Saat veya Hat No ile ara...',
    noRecordsFound: 'Kayıt Bulunamadı',
    colDate: 'TARİH/SAAT',
    colPhone: 'NUMARA',
    colLine: 'HAT',

    // ── AYARLAR MENÜSÜ ──
    settingsTitle: 'Ayarlar',
    menuHat: 'Hat Ayarları',
    menuScreen: 'Ekran Ayarları',
    menuPrinter: 'Yazıcı(lar)',
    menuPassword: 'Parola',
    menuLanguage: 'Dil',
    menuUpdate: 'Güncelleme',
    menuLog: 'Log Kayıtları',
    menuAdmin: 'Yönetici Girişi',

    // ── HAT AYARLARI SEKMESİ ──
    hatSettingsTitle: 'Hat Ayarları',
    hatSettingsDesc: 'Her hatta görüntülenecek telefon numarasını girin. Bu numara ana ekranda hat isminin altında gözükür.',
    hatSaved: 'Hat numaraları kaydedildi!',

    // ── EKRAN AYARLARI SEKMESİ ──
    screenSettingsTitle: 'Ekran Ayarları',
    lightMode: 'Açık Mod',
    lightModeDesc: 'Standart açık renkli arayüz',
    darkMode: 'Koyu Mod',
    darkModeDesc: 'Göz yormayan koyu arayüz',
    themeSaved: 'Tema kaydedildi!',

    // ── YAZICI SEKMESİ ──
    printerTitle: 'Yazıcı Seçimi',
    printerDesc: 'Programda kullanmak istediğiniz yazıcıyı seçin ve kaydedin.',
    printerLoading: 'Yazıcılar yükleniyor...',
    noPrinter: 'Bağlı yazıcı bulunamadı.',
    noPrinterDesc: 'Yazıcınızın bağlı olduğundan ve açık olduğundan emin olun.',
    printerSaved: 'Yazıcı tercihiniz kaydedildi!',
    testPrint: 'Test Yazdır',
    printerStatus: 'Seçili Yazıcı:',
    noPrinterSelected: 'Henüz seçilmedi',
    printSuccess: 'Test yazdırma başlatıldı.',
    printError: 'Yazdırma hatası.',

    // ── PAROLA SEKMESİ ──
    passwordTitle: 'Parola İşlemleri',
    passwordEnable: 'Program açılışında parola sorulsun',
    password: 'Parola',
    passwordRepeat: 'Parola Tekrar',
    passwordPlaceholder: 'Parola girin',
    passwordRepeatPlaceholder: 'Parolayı tekrar girin',
    secretQuestion: 'Gizli Soru',
    secretAnswer: 'Gizli Soru Cevabı',
    secretAnswerPlaceholder: 'Cevabı girin (büyük/küçük harf duyarsız)',
    customQuestion: 'Soruyu ben belirleyeceğim',
    customQuestionPlaceholder: 'Lütfen gizli sorunuzu yazın.',
    fillAllFields: 'Lütfen tüm alanları doldurun.',
    passwordMismatch: 'Parolalar uyuşmamaktadır. Lütfen kontrol ediniz.',
    passwordMismatchInline: 'Yazılan iki parola birbiriyle uyuşmamaktadır. Lütfen kontrol ediniz !!!',
    passwordSaved: 'Parola başarılı bir şekilde kaydedilmiştir.',
    saveFailed: 'Kaydedilemedi. Tekrar deneyin.',
    disablePasswordTitle: 'Parola Korumasını Kaldır',
    disablePasswordDesc: 'Parola korumasını kaldırmak için mevcut parolanızı girin.',
    currentPassword: 'Mevcut parolanız',
    confirm: 'Onayla',
    verifying: 'Doğrulanıyor...',
    wrongPassword: 'Hatalı parola. Lütfen tekrar deneyin.',

    // ── DİL SEKMESİ ──
    languageTitle: 'Dil Ayarları',
    languageDesc: 'Programın arayüz dilini seçin.',
    langTR: 'Türkçe',
    langEN: 'İngilizce',
    languageSaved: 'Dil ayarı kaydedildi!',

    // ── YÖNETİCİ GİRİŞİ ──
    adminTitle: 'Yönetici Girişi',
    adminDesc: 'Bu alana erişmek için yönetici şifresini girin.',
    adminPasswordLabel: 'Yönetici Şifresi',
    adminPasswordPlaceholder: 'Yönetici şifresini girin',
    adminLogin: 'Giriş Yap',
    adminLogging: 'Doğrulanıyor...',
    adminLoggedIn: '✅ Yönetici olarak giriş yapıldı.',
    adminWrongPassword: 'Yanlış yönetici şifresi. Lütfen tekrar deneyin.',
    adminDisableBtn: 'Program Giriş Şifresini İptal Et',
    adminDisableSuccess: 'Program giriş şifresi başarıyla iptal edildi!',

    // ── PLACEHOLDER SEKME ──
    sectionWip: 'Bu bölüm henüz yapım aşamasındadır.',
    sectionWipContact: 'İstek ve talepleriniz varsa, lütfen developer ınızla iletişime geçiniz.',
    menuUpdate2: 'Sistem Güncellemeleri',
    menuLog2: 'Log (Kayıt) Defteri',

    // ── KİLİT EKRANI ──
    lockSubtitle: 'Sipariş Takip Sistemi',
    lockPasswordLabel: 'Parola',
    lockPasswordPlaceholder: 'Parolanızı girin',
    lockLogin: 'Giriş Yap',
    lockLogging: 'Kontrol ediliyor...',
    lockWrongPassword: 'Hatalı parola. Lütfen tekrar deneyin.',
    lockForgot: 'Parolamı unuttum',
    lockAdminEntry: 'Yönetici Şifresiyle Giriş Yap',
    lockSecretQuestion: 'Gizli Soru:',
    lockSecretAnswer: 'Cevabınız',
    lockSecretAnswerPlaceholder: 'Gizli sorunun cevabını girin',
    lockSecretContinue: 'Devam Et',
    lockWrongAnswer: 'Cevap yanlış. Lütfen tekrar deneyin.',
    lockBackToLogin: '← Giriş ekranına dön',
    lockNewPassword: 'Yeni Parola',
    lockNewPasswordPlaceholder: 'Yeni parolayı girin',
    lockNewPasswordRepeat: 'Yeni Parola Tekrar',
    lockNewPasswordRepeatPlaceholder: 'Parolayı tekrar girin',
    lockSavePassword: 'Parolayı Kaydet',
    lockSaving: 'Kaydediliyor...',
    lockResetFail: 'Parola sıfırlanamadı. Lütfen tekrar deneyin.',
    lockResetSuccess: 'Parola başarıyla sıfırlandı!',
    lockGoToLogin: 'Giriş ekranına git',
    lockAdminPasswordLabel: 'Yönetici Şifresi',
    lockAdminPasswordPlaceholder: 'Yönetici şifresini girin',
    lockAdminLogin: 'Giriş Yap',
    lockAdminWrong: 'Yanlış yönetici şifresi.',
    lockAdminVerified: 'Yönetici kimliğiniz doğrulandı.',
    lockAdminDisable: 'Program Giriş Şifresini İptal Et',

    // ── GİZLİ SORULAR ──
    sq0: "Anne'nizin kızlık soyadı nedir?",
    sq1: 'İlk evcil hayvanınızın adı nedir?',
    sq2: 'Doğum yeriniz neresidir?',
    sq3: 'İlk okul öğretmeninizin adı nedir?',
    sq4: 'İlk otomobilinizin markası nedir?',
    sq5: 'En sevdiğiniz çocukluk arkadaşınızın ismi nedir?',
  },

  en: {
    // ── GENERAL ──
    appTitle: 'ORDER TRACKING SYSTEM',
    orderSystem: 'Order Tracking System',
    save: 'Save',
    cancel: 'Cancel',
    close: 'Close',

    // ── SIDEBAR ──
    settings: 'Settings',
    webInterface: 'GO TO WEB INTERFACE',
    shutDown: 'SHUT DOWN SYSTEM',
    updating: 'Updating',
    lastUpdate: '(Last update)',
    updateNow: 'Update Now',
    noInternet: 'No Internet Connection',

    // ── LINE BOXES ──
    customerName: 'CUSTOMER NAME',
    phoneNumber: 'PHONE NUMBER',
    addressInfo: 'ADDRESS INFO',
    print: 'PRINT',
    edit: 'EDIT',
    refresh: 'REFRESH',
    waitingData: 'Waiting for Data',
    unknown: 'Unknown',
    noRecord: 'No more records !!!',
    noRecordAvail: 'No Records',
    prevCall: 'Show Previous Call Info',
    nextCall: 'Show Next Call Info',
    searchCustomer: 'Search by customer name or phone...',
    line: 'Line',

    // ── CALL LIST ──
    callList: 'Call List',
    callCount: 'Calls',
    refreshToday: "Refresh (Go to today's call list)",
    filterByDate: 'Filter by Date',
    searchPlaceholder: 'Search by number, name, time or line...',
    noRecordsFound: 'No Records Found',
    colDate: 'DATE/TIME',
    colPhone: 'NUMBER',
    colLine: 'LINE',

    // ── SETTINGS MENU ──
    settingsTitle: 'Settings',
    menuHat: 'Line Settings',
    menuScreen: 'Display Settings',
    menuPrinter: 'Printer(s)',
    menuPassword: 'Password',
    menuLanguage: 'Language',
    menuUpdate: 'Updates',
    menuLog: 'Log Records',
    menuAdmin: 'Admin Login',

    // ── LINE SETTINGS TAB ──
    hatSettingsTitle: 'Line Settings',
    hatSettingsDesc: 'Enter the phone number to display for each line. It will appear below the line name on the main screen.',
    hatSaved: 'Line numbers saved!',

    // ── DISPLAY SETTINGS TAB ──
    screenSettingsTitle: 'Display Settings',
    lightMode: 'Light Mode',
    lightModeDesc: 'Standard light-colored interface',
    darkMode: 'Dark Mode',
    darkModeDesc: 'Eye-friendly dark interface',
    themeSaved: 'Theme saved!',

    // ── PRINTER TAB ──
    printerTitle: 'Printer Selection',
    printerDesc: 'Select and save the printer you want to use.',
    printerLoading: 'Loading printers...',
    noPrinter: 'No connected printer found.',
    noPrinterDesc: 'Make sure your printer is connected and turned on.',
    printerSaved: 'Printer preference saved!',
    testPrint: 'Test Print',
    printerStatus: 'Selected Printer:',
    noPrinterSelected: 'Not selected yet',
    printSuccess: 'Test print started.',
    printError: 'Print error.',

    // ── PASSWORD TAB ──
    passwordTitle: 'Password Settings',
    passwordEnable: 'Ask for password on startup',
    password: 'Password',
    passwordRepeat: 'Confirm Password',
    passwordPlaceholder: 'Enter password',
    passwordRepeatPlaceholder: 'Re-enter password',
    secretQuestion: 'Secret Question',
    secretAnswer: 'Secret Question Answer',
    secretAnswerPlaceholder: 'Enter answer (case insensitive)',
    customQuestion: 'I will set my own question',
    customQuestionPlaceholder: 'Please type your secret question.',
    fillAllFields: 'Please fill in all fields.',
    passwordMismatch: 'Passwords do not match. Please check.',
    passwordMismatchInline: 'The two passwords do not match. Please check !!!',
    passwordSaved: 'Password has been saved successfully.',
    saveFailed: 'Could not save. Please try again.',
    disablePasswordTitle: 'Remove Password Protection',
    disablePasswordDesc: 'Enter your current password to remove protection.',
    currentPassword: 'Your current password',
    confirm: 'Confirm',
    verifying: 'Verifying...',
    wrongPassword: 'Wrong password. Please try again.',

    // ── LANGUAGE TAB ──
    languageTitle: 'Language Settings',
    languageDesc: 'Select the interface language of the program.',
    langTR: 'Turkish',
    langEN: 'English',
    languageSaved: 'Language setting saved!',

    // ── ADMIN LOGIN ──
    adminTitle: 'Admin Login',
    adminDesc: 'Enter the admin password to access this section.',
    adminPasswordLabel: 'Admin Password',
    adminPasswordPlaceholder: 'Enter admin password',
    adminLogin: 'Login',
    adminLogging: 'Verifying...',
    adminLoggedIn: '✅ Logged in as administrator.',
    adminWrongPassword: 'Wrong admin password. Please try again.',
    adminDisableBtn: 'Cancel Program Login Password',
    adminDisableSuccess: 'Program login password successfully cancelled!',

    // ── PLACEHOLDER TAB ──
    sectionWip: 'This section is currently under construction.',
    sectionWipContact: 'If you have requests, please contact your developer.',
    menuUpdate2: 'System Updates',
    menuLog2: 'Log Records',

    // ── LOCK SCREEN ──
    lockSubtitle: 'Order Tracking System',
    lockPasswordLabel: 'Password',
    lockPasswordPlaceholder: 'Enter your password',
    lockLogin: 'Login',
    lockLogging: 'Checking...',
    lockWrongPassword: 'Wrong password. Please try again.',
    lockForgot: 'Forgot my password',
    lockAdminEntry: 'Login with Admin Password',
    lockSecretQuestion: 'Secret Question:',
    lockSecretAnswer: 'Your Answer',
    lockSecretAnswerPlaceholder: 'Enter the answer to the secret question',
    lockSecretContinue: 'Continue',
    lockWrongAnswer: 'Wrong answer. Please try again.',
    lockBackToLogin: '← Back to login',
    lockNewPassword: 'New Password',
    lockNewPasswordPlaceholder: 'Enter new password',
    lockNewPasswordRepeat: 'Confirm New Password',
    lockNewPasswordRepeatPlaceholder: 'Re-enter password',
    lockSavePassword: 'Save Password',
    lockSaving: 'Saving...',
    lockResetFail: 'Could not reset password. Please try again.',
    lockResetSuccess: 'Password reset successfully!',
    lockGoToLogin: 'Go to login screen',
    lockAdminPasswordLabel: 'Admin Password',
    lockAdminPasswordPlaceholder: 'Enter admin password',
    lockAdminLogin: 'Login',
    lockAdminWrong: 'Wrong admin password.',
    lockAdminVerified: 'Administrator identity verified.',
    lockAdminDisable: 'Cancel Program Login Password',

    // ── SECRET QUESTIONS ──
    sq0: "What is your mother's maiden name?",
    sq1: 'What was the name of your first pet?',
    sq2: 'What city were you born in?',
    sq3: "What was your first school teacher's name?",
    sq4: 'What was the make of your first car?',
    sq5: "What is the name of your favorite childhood friend?",
  }
};

/** Çeviri yardımcısı: t('key', 'tr' | 'en') */
export function t(key, lang = 'tr') {
  const dict = translations[lang] || translations['tr'];
  return dict[key] ?? translations['tr'][key] ?? key;
}
