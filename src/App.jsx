import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  PhoneCall,
  PhoneIncoming,
  MapPin,
  User,
  Settings,
  HelpCircle,
  Printer,
  Edit,
  Save,
  Search,
  ExternalLink,
  ChevronUp,
  ChevronDown,
  CalendarDays,
  ListRestart,
  Minus,
  Square,
  X,
  Power,
  Globe,
  Usb,
  XCircle,
  Ban,
  RefreshCw,
  Loader2
} from 'lucide-react';
import './App.css';
import LockScreen from './LockScreen.jsx';
import { LanguageProvider, useLanguage } from './LanguageContext.jsx';

// Varsayılan Müşteri Verisi (Boş Durum İçin)
const emptyLineData = {
  active: false,
  status: 'HAZIR',
  name: 'Veri Bekleniyor',
  phone: 'Veri Bekleniyor',
  address: 'Veri Bekleniyor',
  isIncoming: false
};

// Örnek Çağrı Geçmişi Verileri (Sıfırlandı)
const initialCallHistory = [];

function AppInner() {
  const { t, lang } = useLanguage();
  // Güncel Yerel Tarih (YYYY-MM-DD formatında)
  const getLocalTodayStr = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const local = new Date(now.getTime() - (offset * 60 * 1000));
    return local.toISOString().split('T')[0];
  };

  const [currentTime, setCurrentTime] = useState(new Date());
  const [lines, setLines] = useState([
    { id: 1, label: 'L1', ...emptyLineData },
    { id: 2, label: 'L2', ...emptyLineData },
    { id: 3, label: 'L3', ...emptyLineData },
    { id: 4, label: 'L4', ...emptyLineData, isEmptyLine: true }
  ]);
  const [callHistory, setCallHistory] = useState(initialCallHistory);
  const [searchQuery, setSearchQuery] = useState('');
  
  // 4. Kutu (Gelişmiş Arama) State'leri
  const [box4Query, setBox4Query] = useState('');
  const [box4Results, setBox4Results] = useState([]);
  const [box4Selected, setBox4Selected] = useState(null);
  const [isBox4DropdownOpen, setIsBox4DropdownOpen] = useState(false);

  // Box 4 Arama Debounce Mimarisi
  useEffect(() => {
    if (!box4Query || box4Query.length < 3) {
      setBox4Results([]);
      setIsBox4DropdownOpen(false);
      // Sadece arama silindiyse seçileni SİLME
      return;
    }

    const timer = setTimeout(async () => {
      if (window.electronAPI && window.electronAPI.advancedSearch) {
        try {
          const results = await window.electronAPI.advancedSearch(box4Query);
          setBox4Results(results);
          
          if (results.length > 0) {
            setIsBox4DropdownOpen(true);
            // Her yeni aramada, ilk sonucu varsayılan olarak seç ki eski kişi kalmasın
            setBox4Selected(results[0]);
          } else {
            setIsBox4DropdownOpen(false);
          }
        } catch (error) {
          console.error('[Box4 Search] Error:', error);
        }
      }
    }, 400); // 400ms bekle (yazma bitince ara)

    return () => clearTimeout(timer);
  }, [box4Query]);
  const [isTitleBarVisible, setIsTitleBarVisible] = useState(false);
  const [usbStatus, setUsbStatus] = useState(false);
  const [internetStatus, setInternetStatus] = useState(navigator.onLine);
  const [isInitialized, setIsInitialized] = useState(false);
  const [selectedDate, setSelectedDate] = useState(getLocalTodayStr()); // Varsayılan: Bugün
  const [lastResetDate, setLastResetDate] = useState(''); // En son sıfırlama yapılan gün
  const [syncStatus, setSyncStatus] = useState({ status: 'waiting', count: 0, time: '' });
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [hatNumbers, setHatNumbers] = useState({ 1: '', 2: '', 3: '' }); // Hat numaraları (Ayarlar'dan)
  const [theme, setTheme] = useState('light'); // Tema (light / dark)
  const [isLocked, setIsLocked] = useState(false);      // Kilit ekranı görünsün mü?
  const [secretQuestion, setSecretQuestion] = useState(''); // Gizli soru metni
  const dateInputRef = React.useRef(null); // Gizli input referansı

  // Anlık durumlara effect içinden erişmek için referanslar (Closure düzeltmesi)
  const linesRef = React.useRef(lines);
  const callHistoryRef = React.useRef(callHistory);
  const box4QueryRef = React.useRef(box4Query);
  const box4SelectedRef = React.useRef(box4Selected);

  useEffect(() => {
    linesRef.current = lines;
    callHistoryRef.current = callHistory;
    box4QueryRef.current = box4Query;
    box4SelectedRef.current = box4Selected;
  }, [lines, callHistory, box4Query, box4Selected]);


  // Title Bar Mouse Sensörü (Electron CSS bug'ına karşı React ile tam çözüm)
  useEffect(() => {
    const handleMouseMove = (e) => {
      // SADECE farenin ucu (0-2 piksel) ekranın tavanına dayandığında açıl
      if (e.clientY <= 2) {
        setIsTitleBarVisible(true);
      } else if (e.clientY > 60) {
        // Çubuğun içindeyken kapanmasını engellemek için, barın dışına çıkınca gizleyeceğiz
        setIsTitleBarVisible(false);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  // Gün Değişimi Kontrolü ve Saat Güncellemesi
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);

      // Her saniye gün değişimini de kontrol et (Uygulama açıkken gün atlaması)
      if (isInitialized) {
        const todayStr = getLocalTodayStr();
        if (lastResetDate && lastResetDate !== todayStr) {
          console.log("GÜN ATLADI! Otomatik temizleme yapılıyor...", { eski: lastResetDate, yeni: todayStr });
          performDailyReset(todayStr);
        }
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [isInitialized, lastResetDate]);

  // Günlük Sıfırlama Fonksiyonu
  const performDailyReset = (newDateStr) => {
    // 1. Hatları Temizle
    setLines(prevLines => prevLines.map(line => ({
      ...line,
      ...emptyLineData,
      status: 'HAZIR', // Garantili HAZIR durumu
      isEmptyLine: line.id === 4 // Hat 4'ü boş tutmaya devam et
    })));

    // 2. Çağrı Listesini "Temiz" Başlat (Bugünün tarihini filtreleyerek)
    setSelectedDate(newDateStr);
    
    // 3. Sıfırlama Tarihini Güncelle
    setLastResetDate(newDateStr);
  };

  // Parola / Kilit kontrolü — uygulama ilk açıldığında
  useEffect(() => {
    if (window.electronAPI?.getPasswordConfig) {
      window.electronAPI.getPasswordConfig().then(cfg => {
        if (cfg?.enabled) {
          setSecretQuestion(cfg.secretQuestion || '');
          setIsLocked(true);
        }
      });
    }
  }, []);

  // Tema yükleme ve uygulama
  useEffect(() => {
    const applyTheme = (t) => {
      document.documentElement.setAttribute('data-theme', t);
      setTheme(t);
    };
    if (window.electronAPI?.getTheme) {
      window.electronAPI.getTheme().then(applyTheme);
    }
    if (window.electronAPI?.onThemeUpdated) {
      const cleanup = window.electronAPI.onThemeUpdated(applyTheme);
      return cleanup;
    }
  }, []);

  // Hat Numaralarını yükle ve Ayarlar'dan değişince güncelle
  useEffect(() => {
    if (window.electronAPI?.getHatNumbers) {
      window.electronAPI.getHatNumbers().then(nums => setHatNumbers(nums || { 1: '', 2: '', 3: '' }));
    }
    if (window.electronAPI?.onHatNumbersUpdated) {
      const cleanup = window.electronAPI.onHatNumbersUpdated((nums) => setHatNumbers(nums || { 1: '', 2: '', 3: '' }));
      return cleanup;
    }
  }, []);

  // Uygulama Başladığında State Yükle
  useEffect(() => {
    if (window.electronAPI && window.electronAPI.getAppState) {
      window.electronAPI.getAppState().then(savedState => {
        if (savedState) {
          console.log("Kayıtlı oturum yüklendi:", savedState);
          let loadedLines = (savedState.lines || []).map(line => ({
            ...line,
            // Açılışta çalma durumunu her zaman sıfırla (Sonsuz döngüyü engelle)
            status: line.status === 'ARANIYOR' ? 'HAZIR' : line.status,
            isIncoming: false
          }));
          
          // Hat 4'ü her zaman boş tut (User isteği)
          if (loadedLines[3]) loadedLines[3].isEmptyLine = true;
          setLines(loadedLines);
          if (savedState.callHistory) setCallHistory(savedState.callHistory);

          // Açılışta gün kontrolü
          const todayStr = getLocalTodayStr();
          const savedResetDate = savedState.lastResetDate || '';
          
          setSelectedDate(todayStr); // Her açılışta bugüne odaklan
          
          if (savedResetDate !== todayStr) {
            console.log("Açılışta gün değişimi algılandı, sıfırlanıyor...");
            performDailyReset(todayStr);
          } else {
            setLastResetDate(savedResetDate);
          }
        } else {
          // İlk açılış veya state yoksa reset tarihini ayarla
          const todayStr = getLocalTodayStr();
          setLastResetDate(todayStr);
          setSelectedDate(todayStr);
        }
        setIsInitialized(true);
      });
    } else {
      setIsInitialized(true);
    }
  }, []);

  // State Değiştiğinde Kaydet
  useEffect(() => {
    if (isInitialized && window.electronAPI && window.electronAPI.saveAppState) {
      console.log("Oturum kaydediliyor...");
      window.electronAPI.saveAppState({
        lines: lines,
        callHistory: callHistory,
        lastResetDate: lastResetDate
      });
    }
  }, [lines, callHistory, lastResetDate, isInitialized]);

  // Backend IPC Dinleyicisi
  useEffect(() => {
    if (window.electronAPI && window.electronAPI.onCallerIdData) {
      const cleanup = window.electronAPI.onCallerIdData((data) => {
        console.log("React Arayüzüne Gelen Veri:", data);

        if (data.status === 'ARANIYOR') {
          // DEBUG: Gelen her veriyi konsola bas
          console.log(`[UI] ÇAĞRI GELDİ: ${data.phone} (Hat: ${data.line})`);
          
          const now = new Date();
          const timeStr = now.toLocaleTimeString('tr-TR');
          const dateStr = now.toLocaleDateString('tr-TR');
          const callId = Date.now(); // Benzersiz ID

          // 1. Gelen veriyi (isim ve adres dahil) hemen listeye ekle
          setCallHistory(prev => {
            const newCall = {
              id: callId,
              phone: data.phone,
              name: data.name || 'Veri Bekleniyor',
              address: data.address || 'Veri Bekleniyor',
              date: dateStr,
              time: timeStr,
              line: `HAT ${data.line.replace('L', '')}`
            };
            return [newCall, ...prev];
          });

          // 2. Hat bilgisini güncelle
          setLines(prevLines => {
            const newLines = [...prevLines];
            const lineIndex = newLines.findIndex(l => l.label === data.line);
            if (lineIndex !== -1) {
              newLines[lineIndex] = {
                ...newLines[lineIndex],
                status: 'ARANIYOR',
                phone: data.phone,
                name: data.name || 'Veri Bekleniyor',
                address: data.address || 'Veri Bekleniyor',
                date: dateStr,
                time: timeStr,
                isIncoming: true
              };
            }
            return newLines;
          });
        } else if (data.status === 'HAZIR') {
          setLines(prevLines => {
            const newLines = [...prevLines];
            const lineIndex = newLines.findIndex(l => l.label === data.line);
            if (lineIndex !== -1) {
              newLines[lineIndex] = { 
                ...newLines[lineIndex], 
                status: 'HAZIR', 
                isIncoming: false 
              };
            }
            return newLines;
          });
        } else if (data.status === 'GUNCELLE') {
          // SADECE içeriği güncelle, animasyonu/durumu elleme
          setLines(prevLines => {
            const newLines = [...prevLines];
            const lineIndex = newLines.findIndex(l => l.label === data.line);
            if (lineIndex !== -1) {
              newLines[lineIndex] = {
                ...newLines[lineIndex],
                phone: data.phone,
                name: data.name,
                address: data.address
              };
            }
            return newLines;
          });
          
          // Aynı zamanda ana geçmiş tablosunu da güncelle (Sağ taraftaki liste de yenilensin)
          setCallHistory(prev => prev.map(c => 
            c.phone === data.phone ? { ...c, name: data.name, address: data.address } : c
          ));
        }
      });
      return () => cleanup();
    }
  }, []);

  // Sync Status Dinleyicisi
  useEffect(() => {
    if (window.electronAPI && window.electronAPI.onSyncStatus) {
      const cleanup = window.electronAPI.onSyncStatus((info) => {
        console.log("Sync Durumu Güncellendi:", info);
        setSyncStatus(info);
        if (info.status === 'success' || info.status === 'error') {
            setIsManualSyncing(false); // Dönmeyi durdur
        }
      });
      return () => cleanup();
    }
  }, []);

  // USB Durum Dinleyicisi
  useEffect(() => {
    if (window.electronAPI && window.electronAPI.getUsbStatus) {
      window.electronAPI.getUsbStatus().then(status => {
        setUsbStatus(status);
      });
    }

    if (window.electronAPI && window.electronAPI.onUsbStatus) {
      const cleanup = window.electronAPI.onUsbStatus((status) => {
        setUsbStatus(status);
      });
      return () => cleanup();
    }
  }, []);

  // İnternet Durum Dinleyicisi
  useEffect(() => {
    const handleOnline = () => {
      setInternetStatus(true);
      if (window.electronAPI && window.electronAPI.forceSync) {
        console.log("[UI] İnternet geri geldi, acil senkronizasyon tetikleniyor...");
        window.electronAPI.forceSync();
      }
    };
    const handleOffline = () => setInternetStatus(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Backend'den gelen periyodik kontrolleri de dinle
    if (window.electronAPI && window.electronAPI.onInternetStatus) {
      const cleanup = window.electronAPI.onInternetStatus((status) => {
        setInternetStatus(status);
        if (status === true && !internetStatus) {
           // Backend'den internetin geri geldiği bilgisi geldiğinde de tetikle
           // (Yalnızca önceki durum 'false' ise, yani gerçekten bir kopup gelme varsa)
           if (window.electronAPI.forceSync) {
               console.log("[UI] (Backend-tetikli) İnternet geri geldi, acil senkronizasyon tetikleniyor...");
               window.electronAPI.forceSync();
           }
        }
      });
      
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        cleanup();
      };
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Global Veri Güncelleme Dinleyicisi (Auto-Sync & Manual Refresh)
  useEffect(() => {
    if (window.electronAPI && window.electronAPI.onGlobalDataUpdated) {
      const cleanup = window.electronAPI.onGlobalDataUpdated(async () => {
        console.log("[UI] Global veri güncelleme sinyali alındı. Ekranlar tazeleniyor...");
        
        const currentLines = linesRef.current;
        const currentHistory = callHistoryRef.current;

        // 1. Aktif Hatları Güncelle
        const updatedLinesArray = await Promise.all(currentLines.map(async line => {
          if (line.phone && line.phone !== 'Veri Bekleniyor' && line.phone !== 'Bilinmiyor') {
            try {
              const freshData = await window.electronAPI.lookupCustomer(line.phone);
              if (freshData) {
                return { ...line, name: freshData.name, address: freshData.address };
              }
            } catch (e) {
              console.error("[UI] Hat güncelleme hatası:", e);
            }
          }
          return line;
        }));
        
        setLines(updatedLinesArray);

        // 2. Çağrı Geçmişini Güncelle
        // Performans için sadece eşsiz numaraları sorgula
        const uniquePhones = [...new Set(currentHistory.map(c => c.phone).filter(p => p && p !== 'Veri Bekleniyor' && p !== 'Bilinmiyor'))];
        const updates = {};
        
        await Promise.all(uniquePhones.map(async phone => {
          try {
            const freshData = await window.electronAPI.lookupCustomer(phone);
            if (freshData) {
              updates[phone] = freshData;
            }
          } catch (e) {
             console.error("[UI] Çağrı geçmişi güncelleme hatası:", e);
          }
        }));

        if (Object.keys(updates).length > 0) {
          setCallHistory(prev => prev.map(call => {
            if (updates[call.phone]) {
              return { ...call, name: updates[call.phone].name, address: updates[call.phone].address };
            }
            return call;
          }));
        }
      });
      return () => cleanup();
    }
  }, []);

  // Global Veri Güncelleme Dinleyicisi (Auto-Sync & Manual Refresh)
  useEffect(() => {
    if (window.electronAPI && window.electronAPI.onGlobalDataUpdated) {
      const cleanup = window.electronAPI.onGlobalDataUpdated(async () => {
        console.log("[UI] Global veri güncelleme sinyali alındı. Ekranlar tazeleniyor...");
        
        const currentLines = linesRef.current;
        const currentHistory = callHistoryRef.current;

        // 1. Aktif Hatları Güncelle
        const updatedLinesArray = await Promise.all(currentLines.map(async line => {
          if (line.phone && line.phone !== 'Veri Bekleniyor' && line.phone !== 'Bilinmiyor') {
            try {
              const freshData = await window.electronAPI.lookupCustomer(line.phone);
              if (freshData) {
                return { ...line, name: freshData.name, address: freshData.address };
              }
            } catch (e) {
              console.error("[UI] Hat güncelleme hatası:", e);
            }
          }
          return line;
        }));
        
        setLines(updatedLinesArray);

        // 2. Çağrı Geçmişini Güncelle
        // Performans için sadece eşsiz numaraları sorgula
        const uniquePhones = [...new Set(currentHistory.map(c => c.phone).filter(p => p && p !== 'Veri Bekleniyor' && p !== 'Bilinmiyor'))];
        const updates = {};
        
        await Promise.all(uniquePhones.map(async phone => {
          try {
            const freshData = await window.electronAPI.lookupCustomer(phone);
            if (freshData) {
              updates[phone] = freshData;
            }
          } catch (e) {
             console.error("[UI] Çağrı geçmişi güncelleme hatası:", e);
          }
        }));

        if (Object.keys(updates).length > 0) {
          setCallHistory(prev => prev.map(call => {
            if (updates[call.phone]) {
              return { ...call, name: updates[call.phone].name, address: updates[call.phone].address };
            }
            return call;
          }));
        }

        // 3. Box 4 Arama Sonuçlarını Güncelle
        const currentBox4Query = box4QueryRef.current;
        const currentBox4Selected = box4SelectedRef.current;
        if (currentBox4Query && currentBox4Query.trim().length >= 3 && window.electronAPI.advancedSearch) {
          try {
            const freshResults = await window.electronAPI.advancedSearch(currentBox4Query);
            setBox4Results(freshResults);
            if (currentBox4Selected && freshResults.length > 0) {
              const updatedSelected = freshResults.find(r => r.phone === currentBox4Selected.phone) || freshResults[0];
              setBox4Selected(updatedSelected);
            }
          } catch (e) {
            console.error('[UI] Box4 güncelleme hatası:', e);
          }
        }
      });
      return () => cleanup();
    }
  }, []);

  const handleRefresh = async (lineLabel, phone) => {
    if (window.electronAPI && window.electronAPI.manualRefresh) {
      console.log(`[UI] Manuel yenileme başlatıldı: ${lineLabel}, ${phone}`);
      await window.electronAPI.manualRefresh(lineLabel, phone);
    }
  };

  // Yazdırma Fonksiyonu
  const handlePrint = async (name, phone, address) => {
    if (!window.electronAPI || !window.electronAPI.printCustomerInfo) return;
    try {
      const result = await window.electronAPI.printCustomerInfo({ name, phone, address });
      if (!result.success) {
        console.error('[UI] Yazdırma hatası:', result.error);
        alert(result.error || 'Yazdırma işlemi başarısız oldu.');
      }
    } catch (error) {
      console.error('[UI] Yazdırma istisnası:', error);
    }
  };

  const handleGlobalSyncClick = () => {
    if (!internetStatus) return; // İnternet yoksa tıklamayı yoksay
    setIsManualSyncing(true);
    if (window.electronAPI && window.electronAPI.forceSync) {
      console.log("[UI] Kullanıcı manuel senkronizasyon tetikledi.");
      window.electronAPI.forceSync();
      // Durum 'success' veya 'error' geldiğinde onSyncStatus efekti isManualSyncing'i durduracak.
      // Emniyet sübabı olarak 5 saniye sonra manuel olarak durduralım.
      setTimeout(() => setIsManualSyncing(false), 5000);
    } else {
      setTimeout(() => setIsManualSyncing(false), 1000); // API yoksa hemen kapat
    }
  };

  const handleMinimize = () => {
    if (window.electronAPI) window.electronAPI.minimize();
  };

  const handleMaximize = () => {
    if (window.electronAPI) window.electronAPI.maximize();
  };

  const handleClose = () => {
    if (window.electronAPI) window.electronAPI.close();
  };

  const formatDate = (date) => {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('tr-TR', options);
  };

  const formatPhoneNumber = (phone) => {
    if (!phone || phone === 'Veri Bekleniyor') return phone;
    // Sadece sayıları al
    const cleaned = ('' + phone).replace(/\D/g, '');
    
    // 05XX XXX XX XX formatı (11 hane varsayımı)
    const match = cleaned.match(/^(\d{4})(\d{3})(\d{2})(\d{2})$/);
    if (match) {
      return `${match[1]} ${match[2]} ${match[3]} ${match[4]}`;
    }
    
    // Eğer 10 hane ise (başta 0 yoksa) 0 ekle dene
    if (cleaned.length === 10) {
      const match10 = cleaned.match(/^(\d{3})(\d{3})(\d{2})(\d{2})$/);
      if (match10) {
        return `0${match10[1]} ${match10[2]} ${match10[3]} ${match10[4]}`;
      }
    }

    return phone; // Format uymuyorsa olduğu gibi bırak
  };

  // Sadece seçili günün (veya bugünün) toplam çağrı sayısını hesaplama
  const currentDayTotalCallsCount = useMemo(() => {
    const targetDateStr = selectedDate ? new Date(selectedDate).toLocaleDateString('tr-TR') : new Date(getLocalTodayStr()).toLocaleDateString('tr-TR');
    return callHistory.filter(call => call.date === targetDateStr).length;
  }, [callHistory, selectedDate]);

  // Takvim Filtreleme Mantığı
  const filteredHistory = useMemo(() => {
    let list = [...callHistory];
    
    // Her zaman tek bir güne ait kayıtları gösterir (Seçili gün veya bugün)
    const targetDateStr = selectedDate ? new Date(selectedDate).toLocaleDateString('tr-TR') : new Date(getLocalTodayStr()).toLocaleDateString('tr-TR');
    list = list.filter(call => call.date === targetDateStr);
    
    // Arama Sorgusu Varsa Filtrele
    if (searchQuery) {
      const criteria = searchQuery.split(',').map(s => s.trim().toLowerCase()).filter(s => s !== '');

      list = list.filter(call => {
        // Her bir kriter (virgülle ayrılmış parça) için kontrol et
        return criteria.every(q => {
          const qNoSpace = q.replace(/\s/g, ''); // Boşluksuz kriter
          
          const phoneMatch = call.phone.includes(q);
          const nameMatch = (call.name || '').toLowerCase().includes(q);
          const timeMatch = call.time.includes(q);
          const lineMatch = call.line.toLowerCase().includes(q);
          
          // "hat1" -> "HAT 1" eşleşmesi için akıllı kontrol
          const lineNormalized = call.line.toLowerCase().replace(/\s/g, '');
          const smartLineMatch = lineNormalized.includes(qNoSpace) && (qNoSpace.includes('hat') || qNoSpace.includes('l'));

          return phoneMatch || nameMatch || timeMatch || lineMatch || smartLineMatch;
        });
      });
    }
    
    return list;
  }, [callHistory, selectedDate, searchQuery]);

  // 5 Dakika Otomatik Geri Dönüş ve Filtre Temizleme
  useEffect(() => {
    let timer;
    const todayString = getLocalTodayStr();
    // Eğer seçili tarih bugün değilse (başka bir gün veya null) sayacı başlat
    if (selectedDate !== todayString) {
      timer = setTimeout(() => {
        setSelectedDate(todayString);
        setSearchQuery(''); // Aramayı da temizleyelim
        console.log("5 dakika doldu, filtre otomatik temizlendi ve bugüne dönüldü.");
      }, 5 * 60 * 1000); // 5 Dakika
    }
    return () => clearTimeout(timer);
  }, [selectedDate]);

  const handleDateClick = () => {
    if (dateInputRef.current) {
      dateInputRef.current.showPicker(); // Browser native calendar aç
    }
  };

  const clearFilter = () => {
    setSelectedDate(getLocalTodayStr());
    setSearchQuery('');
  };

  const isTodaySelected = () => {
    if (!selectedDate) return false;
    const todayString = getLocalTodayStr();
    return selectedDate === todayString;
  };

  // Hat bazlı geçmiş gezintisi (Up/Down okları için)
  const browseLineHistory = async (lineId, direction) => {
    const lineHistory = callHistory.filter(call => call.line === `HAT ${lineId}`);
    if (lineHistory.length <= 1) return; // Gezilecek kayıt yoksa çık

    const currentLine = lines.find(l => l.id === lineId);
    if (!currentLine) return;

    let currentIndex = lineHistory.findIndex(h => h.phone === currentLine.phone && h.time === currentLine.time && h.date === currentLine.date);
    
    let nextIndex;
    if (currentIndex === -1) {
      if (direction === 1) nextIndex = 0;
      else return;
    } else {
      nextIndex = currentIndex + direction;
    }

    if (nextIndex < 0) nextIndex = 0;
    if (nextIndex >= lineHistory.length) nextIndex = lineHistory.length - 1;

    const targetCall = lineHistory[nextIndex];
    let freshName = targetCall.name || 'Veri Bekleniyor';
    let freshAddress = targetCall.address || 'Veri Bekleniyor';

    // Geçmişte gezinirken her zaman anlık en güncel veriyi sor
    if (window.electronAPI && window.electronAPI.lookupCustomer) {
      try {
        const freshData = await window.electronAPI.lookupCustomer(targetCall.phone);
        if (freshData) {
          freshName = freshData.name;
          freshAddress = freshData.address;
          
          // Aynı zamanda bellekteki genel arama geçmişini de güncelleyelim ki listede de düzelsin
          setCallHistory(prev => prev.map(c => 
            c.phone === targetCall.phone ? { ...c, name: freshName, address: freshAddress } : c
          ));
        }
      } catch (e) {
        console.error("Geçmiş gezinti sırasında veri sorgulama hatası:", e);
      }
    }

    setLines(prevLines => prevLines.map(line => {
      if (line.id === lineId) {
        return {
          ...line,
          phone: targetCall.phone,
          name: freshName,
          address: freshAddress,
          time: targetCall.time,
          date: targetCall.date
        };
      }
      return line;
    }));
  };

  return (
    <div className="app-container">
      {/* PAROLA KİLİT EKRANI */}
      {isLocked && (
        <LockScreen
          secretQuestion={secretQuestion}
          onUnlock={() => setIsLocked(false)}
        />
      )}

      {/* ÖZEL BAŞLIK ÇUBUĞU (TITLE BAR) */}
      <div className={`title-bar-content ${isTitleBarVisible ? 'visible' : ''}`}>
        <div className="title-bar-drag">
          <span className="title-bar-title">GAZİBURMA MUSTAFA - SİPARİŞ TAKİP SİSTEMİ</span>
        </div>
        <div className="window-controls">
          <button onClick={handleMinimize} className="control-btn minimize" title="Küçült">
            <Minus size={16} />
          </button>
          <button onClick={handleMaximize} className="control-btn maximize" title="Ekranı Kapla">
            <Square size={14} />
          </button>
          <button onClick={handleClose} className="control-btn close" title="Kapat">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* SOL MENÜ */}
      <aside className="sidebar">
        <div>
          <div className="sidebar-logo">
            <img
              src="/src/assets/logo.png"
              alt="Gaziburma Mustafa Logo"
              style={{ width: '100%', height: 'auto', objectFit: 'contain' }}
            />
          </div>

          <div className="sidebar-menu">
            <div className="menu-item active">
              <PhoneCall size={20} />
              <span>{t('callList')}</span>
            </div>
            <div 
              className="menu-item"
              onClick={() => {
                if (window.electronAPI && window.electronAPI.openSettings) {
                  window.electronAPI.openSettings();
                }
              }}
            >
              <Settings size={20} />
              <span>{t('settings')}</span>
            </div>
            <div 
              className="menu-item"
              onClick={() => {
                if (window.electronAPI && window.electronAPI.openHelp) {
                  window.electronAPI.openHelp();
                }
              }}
            >
              <HelpCircle size={20} />
              <span>{lang === 'en' ? 'Help' : 'Yardım'}</span>
            </div>
          </div>
        </div>

        <div className="sidebar-footer">
          <div className="status-container">
            <div className="status-item">
              <div className="status-info">
                <div className="status-label">
                  <span>Caller ID</span>
                </div>
                <div className={`status-value ${usbStatus ? 'connected' : 'disconnected'}`}>
                  <div className="status-dot"></div>
                  <span>{usbStatus ? (lang === 'en' ? 'Connected' : 'Bağlantı Kuruldu') : (lang === 'en' ? 'USB Disconnected' : 'USB Bağlantı Kesildi')}</span>
                </div>
              </div>
              <div className="status-icon-wrapper">
                <Usb size={16} className="status-main-icon" />
                {!usbStatus && <XCircle size={20} className="status-x-overlay" />}
              </div>
            </div>

            <div className="status-item">
              <div className="status-info">
                <div className="status-label">
                  <span>{lang === 'en' ? 'Internet Access' : 'İnternet Erişimi'}</span>
                </div>
                <div className={`status-value ${internetStatus ? 'connected' : 'disconnected'}`}>
                  <div className="status-dot"></div>
                  <span>{internetStatus ? (lang === 'en' ? 'Connected' : 'Bağlantı Kuruldu') : (lang === 'en' ? 'No Internet' : 'İnternet Bağlantısı Kesildi')}</span>
                </div>
              </div>
              <div className="status-icon-wrapper">
                <Globe size={16} className="status-main-icon" />
                {!internetStatus && <XCircle size={20} className="status-x-overlay" />}
              </div>
            </div>

            <div className="status-item">
              <div className="status-info">
                <div className="status-label">
                  <span>{lang === 'en' ? 'Database Update' : 'Database Güncellemesi'}</span>
                </div>
                <div className={`status-value ${internetStatus ? 'connected' : 'disconnected'}`}>
                  <div className="status-dot"></div>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                    {syncStatus.status === 'success' ? (
                      syncStatus.time
                    ) : (
                      <span className="loading-dots">{t('updating')}</span>
                    )}
                    {!internetStatus && <span style={{ color: '#94a3b8', fontSize: '11px' }}>({t('lastUpdate').replace('(','').replace(')','') })</span>}
                  </span>
                </div>
              </div>
              <div 
                className="status-icon-wrapper" 
                onClick={handleGlobalSyncClick}
                style={{ cursor: internetStatus ? 'pointer' : 'default' }}
                title={internetStatus ? t('updateNow') : t('noInternet')}
              >
                {syncStatus.status === 'waiting' || isManualSyncing ? (
                  <Loader2 size={16} className="status-main-icon spin" />
                ) : (
                  <RefreshCw size={16} className="status-main-icon" />
                )}
                {!internetStatus && <XCircle size={20} className="status-x-overlay" />}
              </div>
            </div>
          </div>

          <button
            className="web-btn"
            onClick={() => {
              if (window.electronAPI && window.electronAPI.openExternal) {
                window.electronAPI.openExternal("https://gaziburma.com/api/index.php?anahtar=;_u9uhe!M5%3C:pMB^");
              }
            }}
          >
            <ExternalLink size={18} />
            {t('webInterface')}
          </button>

          
          <button className="close-btn" onClick={handleClose}>
            <Power size={18} />
                        {t('shutDown')}
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="top-header">
          <div className="header-title" style={{
            fontFamily: "'Poppins', sans-serif",
            fontWeight: 800,
            fontSize: '22px',
            color: '#1e293b',
            letterSpacing: '0.5px',
            textTransform: 'uppercase'
          }}>
            {t('appTitle')}
          </div>

          <div className="header-right-controls" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div className="header-time">

              <CalendarDays size={18} />
              <span>{formatDate(currentTime)}</span>
              <span style={{ marginLeft: '12px', fontWeight: '700' }}>
                {currentTime.toLocaleTimeString(lang === 'en' ? 'en-US' : 'tr-TR')}
              </span>
            </div>
          </div>
        </header>

        <div className="content-area">
          <div className="lines-grid">

            {lines.map((line) => {
              const lineHistory = callHistory.filter(call => call.line === `HAT ${line.id}`);
              const currentIndex = lineHistory.findIndex(h => h.phone === line.phone && h.time === line.time && h.date === line.date);
              
              const isAtOldest = currentIndex !== -1 && currentIndex === lineHistory.length - 1;
              const isAtNewest = currentIndex !== -1 && currentIndex === 0;

              return (
                <div key={line.id} className={`line-box ${line.status === 'ARANIYOR' ? 'ringing' : ''}`} style={line.isEmptyLine ? { overflow: 'visible' } : {}}>
                  {line.isEmptyLine ? (
                    <div className="box4-container">
                      <div className="box4-search-header">
                        <Search size={18} className="box4-search-icon" />
                        <input
                          type="text"
                          className="box4-search-input"
                          placeholder={t('searchCustomer')}
                          value={box4Query}
                          onChange={(e) => setBox4Query(e.target.value)}
                        />
                      </div>

                      {box4Query.trim().length > 0 && (
                        <>
                          <div className="line-content-wrapper" style={{ marginTop: '3px' }}>
                            <div className="customer-details">
                              <div className="detail-row" style={{ position: 'relative' }}>
                                <div className="icon-wrapper blue"><User size={20} /></div>
                                <div className="detail-content" style={{ position: 'relative', width: '100%', paddingRight: '12px' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span className="detail-label">{t('customerName')}</span>
                                    <span className="detail-value" style={{ 
                                      opacity: box4Selected ? 1 : 0.4,
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px'
                                    }}>
                                      {box4Selected ? box4Selected.name : ''}
                                      {box4Selected && box4Results.length > 1 && (
                                        <span style={{ 
                                          color: '#3b82f6', 
                                          fontSize: '16px', 
                                          fontWeight: '800', 
                                          marginLeft: '8px' 
                                        }}>
                                          ({box4Results.length})
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                  
                                  {box4Results.length > 1 && (
                                    <div 
                                      className="box4-dropdown-trigger"
                                      style={{ 
                                        position: 'absolute', 
                                        right: '0', 
                                        top: '50%', 
                                        transform: 'translateY(-50%)',
                                        zIndex: 10
                                      }}
                                      onClick={() => setIsBox4DropdownOpen(!isBox4DropdownOpen)}
                                    >
                                      <ChevronDown size={22} className={isBox4DropdownOpen ? 'open' : ''} />
                                    </div>
                                  )}
                                </div>

                                {isBox4DropdownOpen && box4Results.length > 1 && (
                                  <div className="box4-dropdown-menu">
                                    {box4Results.map((result, idx) => (
                                      <div 
                                        key={idx} 
                                        className="box4-dropdown-item"
                                        onClick={() => {
                                          setBox4Selected(result);
                                          setIsBox4DropdownOpen(false);
                                        }}
                                      >
                                        <div className="box4-dropdown-item-name">{result.name}</div>
                                        <div className="box4-dropdown-item-phone">{result.phone}</div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <div className="detail-row">
                                <div className="icon-wrapper green"><PhoneCall size={20} /></div>
                                <div className="detail-content">
                                  <span className="detail-label">{t('phoneNumber')}</span>
                                  <span className="detail-value phone" style={{ 
                                    opacity: box4Selected ? 1 : 0.4 
                                  }}>{box4Selected ? formatPhoneNumber(box4Selected.phone) : ''}</span>
                                </div>
                              </div>

                              <div className="detail-row address-row">
                                <div className="icon-wrapper yellow"><MapPin size={20} /></div>
                                <div className="detail-content">
                                  <span className="detail-label">{t('addressInfo')}</span>
                                  <span className="detail-value" style={{ 
                                    opacity: box4Selected ? 1 : 0.4, 
                                    lineHeight: '1.4' 
                                  }}>{box4Selected ? box4Selected.address : ''}</span>
                                </div>
                              </div>
                            </div>

                            <div className="line-actions">
                              <button 
                                className="action-btn print-btn" 
                                style={{ opacity: box4Selected ? 1 : 0.5 }}
                                onClick={() => box4Selected && handlePrint(box4Selected.name, box4Selected.phone, box4Selected.address)}
                              >
                                <Printer size={18} />
                                {t('print')}
                              </button>
                              <button className="action-btn edit-btn" style={{ opacity: box4Selected ? 1 : 0.5 }}>
                                <Edit size={18} />
                                {t('edit')}
                              </button>
                              <button 
                                className="action-btn refresh-btn" 
                                style={{ opacity: box4Selected ? 1 : 0.5 }}
                                onClick={() => handleGlobalSyncClick()}
                              >
                                <ListRestart size={18} />
                                {t('refresh')}
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="line-header">
                        <div className="line-info">
                          <div className="line-indicator">
                            <div 
                              className={`nav-icon-wrapper ${isAtOldest ? 'at-boundary' : ''}`}
                              onClick={() => !isAtOldest && browseLineHistory(line.id, 1)}
                              title={isAtOldest ? t('noRecord') : (lineHistory.length === 0 ? t('noRecordAvail') : t('prevCall'))}
                            >
                              <ChevronUp 
                                size={14} 
                                className="chevron-icon"
                                style={{ cursor: isAtOldest ? 'default' : 'pointer', opacity: lineHistory.length === 0 ? 0.3 : 1 }}
                              />
                              <Ban size={14} className="ban-icon" color="#ef4444" />
                            </div>

                            <span style={{ fontWeight: '700', fontSize: '13px', margin: '2px 0' }}>{line.label}</span>

                            <div 
                              className={`nav-icon-wrapper ${isAtNewest ? 'at-boundary' : ''}`}
                              onClick={() => !isAtNewest && browseLineHistory(line.id, -1)}
                              title={isAtNewest ? t('noRecord') : (lineHistory.length === 0 ? t('noRecordAvail') : t('nextCall'))}
                            >
                              <ChevronDown 
                                size={14} 
                                className="chevron-icon"
                                style={{ cursor: isAtNewest ? 'default' : 'pointer', opacity: lineHistory.length === 0 ? 0.3 : 1 }}
                              />
                              <Ban size={14} className="ban-icon" color="#ef4444" />
                            </div>
                          </div>
                          <div>
                            <div className="line-title">{t('line')} {line.id}</div>
                            <div className="line-number">{hatNumbers[line.id] || ''}</div>
                          </div>
                      </div>
                      {line.status === 'ARANIYOR' ? (
                        <div className="status-badge ringing-badge">
                          <PhoneCall size={18} className="shaking-icon" />
                        </div>
                      ) : (
                        <div className="status-badge">
                          {line.status === 'HAZIR' ? (lang === 'en' ? 'READY' : 'HAZIR') : line.status}
                        </div>
                      )}
                    </div>

                    <div className="line-content-wrapper">
                      <div className="customer-details">
                        <div className="detail-row">
                          <div className="icon-wrapper blue"><User size={20} /></div>
                          <div className="detail-content">
                            <span className="detail-label">{t('customerName')}</span>
                            <span className="detail-value" style={{ 
                              opacity: line.name === 'Veri Bekleniyor' ? 0.4 : 1 
                            }}>{line.name === 'Veri Bekleniyor' ? t('waitingData') : line.name}</span>
                          </div>
                        </div>

                        <div className="detail-row">
                          <div className="icon-wrapper green"><PhoneCall size={20} /></div>
                          <div className="detail-content">
                            <span className="detail-label">{t('phoneNumber')}</span>
                            <span className="detail-value phone" style={{ 
                              opacity: line.phone === 'Veri Bekleniyor' ? 0.4 : 1 
                            }}>{line.phone === 'Veri Bekleniyor' ? t('waitingData') : formatPhoneNumber(line.phone)}</span>
                          </div>
                        </div>

                        <div className="detail-row address-row">
                          <div className="icon-wrapper yellow"><MapPin size={20} /></div>
                          <div className="detail-content">
                            <span className="detail-label">{t('addressInfo')}</span>
                            <span className="detail-value" style={{ 
                              opacity: line.address === 'Veri Bekleniyor' ? 0.4 : 1, 
                              lineHeight: '1.4' 
                            }}>{line.address === 'Veri Bekleniyor' ? t('waitingData') : line.address}</span>
                          </div>
                        </div>
                      </div>

                      <div className="line-actions">
                        <button 
                          className="action-btn print-btn"
                          onClick={() => handlePrint(line.name, line.phone, line.address)}
                        >
                          <Printer size={18} />
                          {t('print')}
                        </button>
                        <button className="action-btn edit-btn">
                          <Edit size={18} />
                          {t('edit')}
                        </button>
                        <button 
                          className="action-btn refresh-btn"
                          onClick={() => handleRefresh(line.label, line.phone)}
                        >
                          <ListRestart size={18} />
                          {t('refresh')}
                        </button>
                      </div>
                    </div>
                  </>
                  )}
                </div>
              );
            })}
          </div>

          {/* SAĞ BÖLÜM - ÇAĞRI LİSTESİ */}
          <aside className="call-list-sidebar">
            <div className="call-list-header">
              <div className="call-list-title" style={{ whiteSpace: 'nowrap' }}>
                <PhoneCall size={18} />
                {t('callList')}
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button 
                  onClick={() => {
                    setSelectedDate(getLocalTodayStr());
                    setSearchQuery('');
                  }}
                  title={t('refreshToday')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '6px',
                    backgroundColor: '#e2e8f0',
                    border: '1px solid #cbd5e1',
                    borderRadius: '4px',
                    color: '#334155',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#cbd5e1'; }}
                  onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#e2e8f0'; }}
                >
                  <RefreshCw size={16} />
                </button>

                <span className="call-count-badge" style={{ whiteSpace: 'nowrap' }}>
                  {currentDayTotalCallsCount} {t('callCount')}
                </span>
                
                {/* Takvim Simgesi ve Gizli Input */}
                <div style={{ position: 'relative' }}>
                  <CalendarDays 
                    size={20} 
                    color={selectedDate && !isTodaySelected() ? "#3b82f6" : "#94a3b8"} 
                    style={{ cursor: 'pointer' }}
                    onClick={handleDateClick}
                    title={t('filterByDate')}
                  />
                  <input
                    type="date"
                    ref={dateInputRef}
                    style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
                    onChange={(e) => setSelectedDate(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="call-search">
              <div className="search-input-wrapper">
                <Search size={16} />
                <input
                  type="text"
                  className="search-input"
                  placeholder={t('searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Tarih Filtresi Aktifse ve Bugün Değilse Göster */}
            {selectedDate && !isTodaySelected() && (
              <div className="active-filter-badge">
                <CalendarDays size={14} />
                <span>{new Date(selectedDate).toLocaleDateString(lang === 'en' ? 'en-US' : 'tr-TR')}</span>
                <X size={14} className="clear-filter" onClick={clearFilter} />
              </div>
            )}
            <div className="list-column-headers">
              <div className="col-hash">#</div>
              <div className="col-date">{t('colDate')}</div>
              <div className="col-phone">{t('colPhone')}</div>
              <div className="col-line">{t('colLine')}</div>
            </div>

            <div className="calls-container">
              {filteredHistory.length > 0 ? (
                filteredHistory.map((call, index) => {
                  // Aynı güne ait tüm çağrıları bul (Gösterim sırasına göre Yeniden Eskiye)
                  const sameDateCalls = callHistory.filter(c => c.date === call.date);
                  
                  // Bu çağrının o gün içindeki sırası (En yeni olan en yüksek numarayı alır)
                  // Eğer sameDateCalls.length = 10 ise, dizideki 0. eleman (en yeni) 10 numarasını, 9. eleman (en eski) 1 numarasını almalı.
                  const callIndexInItsDay = sameDateCalls.findIndex(c => c.id === call.id);
                  const displayIndex = sameDateCalls.length - callIndexInItsDay;

                  return (
                    <div key={call.id} className={`call-item bg-${call.line.replace(/\s+/g, '-').toLowerCase()}`}>
                      <div className="call-index">{displayIndex}</div>
                      <div className="call-date-time">
                        <span className="date-text">{call.date}</span>
                        <span className="time-text">{call.time}</span>
                      </div>
                      <div className="call-phone col-phone">
                        <div className="phone-main">{formatPhoneNumber(call.phone)}</div>
                        {call.name && call.name !== 'Veri Bekleniyor' && call.name !== 'Waiting for Data' && call.name !== 'Bilinmiyor' && call.name !== 'Unknown' && (
                          <div className="phone-sub-name" title={call.name}>
                            {call.name}
                          </div>
                        )}
                      </div>
                      <div className={`call-line-badge col-line badge-${call.line.replace(/\s+/g, '-').toLowerCase()}`}>
                        {call.line}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="no-calls-msg">
                  <XCircle size={32} />
                  <span>{t('noRecordsFound')}</span>
                </div>
              )}
            </div>
          </aside>

        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <LanguageProvider>
      <AppInner />
    </LanguageProvider>
  );
}

export default App;
