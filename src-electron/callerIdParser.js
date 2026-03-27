const { EventEmitter } = require('events');
const fs = require('fs');
const path = require('path');
const https = require('https');
const zlib = require('zlib');

class CallerIdParser extends EventEmitter {
  constructor() {
    super();
    this.lines = {
      1: { status: 'HAZIR', phone: null, time: null, isRinging: false },
      2: { status: 'HAZIR', phone: null, time: null, isRinging: false },
      3: { status: 'HAZIR', phone: null, time: null, isRinging: false },
      4: { status: 'HAZIR', phone: null, time: null, isRinging: false }
    };
    this.logPath = 'C:/Users/Ahmet/caller_id_raw.log';
    this.debugLogPath = 'C:/Users/Ahmet/caller_id_debug.log';
    
    this.apiUrl = "https://gaziburma.com/api/data.php";
    this.apiKey = "gzb_2026_Xk9mPqR7vLwNcYdA3hFjBtSe";
    
    // Hafızadaki Müşteri Verisi
    this.customerData = [];
    this.isInitialSyncDone = false;
    this.syncInterval = 5 * 60 * 1000; // 5 dakikada bir güncelle

    // Log dosyasını her açılışta temizle
    try { 
      fs.writeFileSync(this.debugLogPath, `--- DEBUG BAŞLATILDI: ${new Date().toISOString()} ---\n`);
    } catch (e) { }

    // Senkronizasyonu başlat
    this.startBackgroundSync();
  }

  debug(msg) {
    try {
      const timestamp = new Date().toLocaleTimeString();
      fs.appendFileSync(this.debugLogPath, `[${timestamp}] ${msg}\n`);
      console.log(`[Parser Debug] ${msg}`);
    } catch (e) { }
  }

  async startBackgroundSync() {
    this.debug("[Sync] Senkronizasyon başlatılıyor...");
    this.emit('sync-status', { status: 'waiting' });
    try {
        await this.fetchLatestData();
        const syncInfo = {
            count: this.customerData.length,
            time: new Date().toLocaleTimeString('tr-TR'),
            status: 'success'
        };
        this.debug(`[Sync] Başarılı: ${syncInfo.count} kayıt hafızaya alındı.`);
        this.emit('sync-status', syncInfo);
        this.isInitialSyncDone = true;
        // Flag set edildikten SONRA tekrar emit et: mevcut hatlardaki
        // "Sorgulanıyor..." kayıtları artık doğru şekilde çözülecek.
        this.emit('global-data-updated');
    } catch (err) {
        this.debug(`[Sync] Hata: ${err.message}`);
        this.emit('sync-status', { status: 'error', message: err.message });
        // Başarısız olsa bile flag'i true yap; böylece sonraki çağrılar
        // "Sorgulanıyor..." yerine "Bilinmiyor" gösterir.
        this.isInitialSyncDone = true;
        this.emit('global-data-updated');
    }

    // Periyodik güncelleme başlat
    this.startTimer();
  }

  startTimer() {
    if (this.syncTimer) {
        clearInterval(this.syncTimer);
    }
    
    this.syncTimer = setInterval(async () => {
        this.debug("[Sync] Periyodik güncelleme yapılıyor...");
        await this.performSync();
    }, this.syncInterval);
  }

  async performSync() {
    this.emit('sync-status', { status: 'waiting' });
    try {
        await this.fetchLatestData();
        const syncInfo = {
            count: this.customerData.length,
            time: new Date().toLocaleTimeString('tr-TR'),
            status: 'success'
        };
        this.debug(`[Sync] Güncellendi: ${syncInfo.count} kayıt.`);
        this.emit('sync-status', syncInfo);
        this.isInitialSyncDone = true;
        this.emit('global-data-updated');
    } catch (err) {
        this.debug(`[Sync] Güncelleme hatası: ${err.message}`);
        this.emit('sync-status', { status: 'error', message: err.message });
        this.isInitialSyncDone = true;
        this.emit('global-data-updated');
    }
  }

  forceSync() {
      this.debug("[Sync] İnternet geri geldi, zorunlu senkronizasyon tetikleniyor...");
      this.performSync().then(() => {
          // Başarılı veya başarısız olsun, timer'ı sıfırla ki 5 dk baştan saysın
          this.startTimer();
      });
  }


  fetchLatestData() {
    return new Promise((resolve, reject) => {
        const options = {
            headers: { 
                'X-Api-Key': this.apiKey,
                'Accept-Encoding': 'gzip' // Sıkıştırma iste
            }
        };

        https.get(this.apiUrl, options, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`API Hatası: ${res.statusCode}`));
                return;
            }

            let stream = res;
            if (res.headers['content-encoding'] === 'gzip') {
                this.debug("[Sync] GZIP sıkıştırma kullanılıyor.");
                stream = res.pipe(zlib.createGunzip());
            }

            let body = '';
            stream.on('data', chunk => body += chunk);
            stream.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    if (parsed.durum && Array.isArray(parsed.musteriler)) {
                        this.customerData = parsed.musteriler;
                        this.emit('global-data-updated');
                        resolve();
                    } else {
                        reject(new Error("Hatalı API yanıt formatı"));
                    }
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
  }

  lookupCustomer(phone) {
    if (!phone || phone === 'Bilinmiyor' || phone === 'Veri Bekleniyor') return null;
    
    this.debug(`[Lookup] Başlatıldı: ${phone} (Hafızadan sorgulanıyor)`);
    const cleanIncoming = phone.replace(/\D/g, '');
    
    if (cleanIncoming.length < 7) return null;

    if (this.customerData.length === 0) {
        this.debug("[Lookup] Hafızada veri yok!");
        return null;
    }

    const customers = this.customerData.filter(m => {
      const rawMusteriPhone = m.telefon_numarasi || '';
      const parts = rawMusteriPhone.split(/[,\/;\-\s]+/);
      
      return parts.some(part => {
        const cleanMusteri = part.replace(/\D/g, '');
        if (!cleanMusteri) return false;
        
        return cleanIncoming === cleanMusteri || 
               (cleanIncoming.length >= 10 && cleanMusteri.length >= 10 && 
                cleanIncoming.slice(-10) === cleanMusteri.slice(-10));
      });
    });

    if (customers.length > 0) {
      this.debug(`[Lookup] BULUNDU: ${customers.length} eşleşme`);
      const first = customers[0];
      return {
        id: first.id || first.musteri_id || null,
        name: first.musteri_bilgisi,
        address: first.acik_adres,
        phone: first.telefon_numarasi,
        results: customers.map(c => ({
          id: c.id || c.musteri_id || null,
          name: c.musteri_bilgisi,
          phone: c.telefon_numarasi,
          address: c.acik_adres
        }))
      };
    }

    this.debug(`[Lookup] BULUNAMADI: ${phone}`);
    return null;
  }

  async handleBridgeData(dataString) {
    this.debug(`Gelen Veri: ${dataString}`);
    try {
      const data = JSON.parse(dataString);

      if (data.status === 'CONNECTED') {
        this.debug(`Cihaz Bağlandı: ${data.serial}`);
        this.emit('usb-status', true);
        return;
      }

      if (data.status === 'DISCONNECTED') {
        this.debug(`Cihaz Bağlantısı Kesildi.`);
        this.emit('usb-status', false);
        return;
      }

      if (data.event === 'CALL') {
        // Port → Mantıksal Hat eşleştirmesi
        // Hat 1 = Port 1, Hat 2 = Port 3, Hat 3 = Port 4
        const PORT_TO_LINE = { 1: 1, 3: 2, 4: 3 };
        const lineId = PORT_TO_LINE[parseInt(data.line)];
        if (!lineId) {
          this.debug(`Port ${data.line} eşleşmedi, yoksayılıyor.`);
          return;
        }
        const phone = data.phone ? data.phone.trim() : 'Bilinmiyor';
        const time = data.time || new Date().toLocaleTimeString('tr-TR');
        const now = Date.now();

        const line = this.lines[lineId];
        
        if (line && line.lastPhone === phone && (now - line.lastCallTime) < 5000) {
          this.debug(`Mükerrer engellendi: ${phone}`);
          return;
        }

        if (line) {
          line.lastPhone = phone;
          line.lastCallTime = now;
          line.lastCallReceived = now;
          
          clearTimeout(line.idleTimer);
          line.idleTimer = setTimeout(() => {
            this.emit('onIdle', { line: `L${lineId}`, status: 'HAZIR' });
          }, 8000);
        }

        // HAFIZADAN ANINDA SORGULA
        const customerInfo = this.lookupCustomer(phone);
        
        const callData = {
          line: `L${lineId}`,
          phone: phone,
          time: time,
          status: 'ARANIYOR',
          name: customerInfo ? customerInfo.name : (this.isInitialSyncDone ? 'Bilinmiyor' : 'Sorgulanıyor...'),
          address: customerInfo ? customerInfo.address : (this.isInitialSyncDone ? 'Bilinmiyor' : 'Sorgulanıyor...'),
          customerId: customerInfo ? customerInfo.id : null,
          results: customerInfo ? customerInfo.results : [],
          isIncoming: true
        };

        this.emit('onRing', callData);
      }

      if (data.event === 'SIGNAL') {
        // Port → Mantıksal Hat eşleştirmesi (CALL ile aynı tablo)
        const PORT_TO_LINE = { 1: 1, 3: 2, 4: 3 };
        const lineId = PORT_TO_LINE[parseInt(data.line)];
        if (!lineId) return; // Eşleşmeyen portları yoksay
        const line = this.lines[lineId];
        const now = Date.now();
        
        if (line && line.lastPhone && (now - line.lastCallReceived) > 8000) {
          this.debug(`Sinyal algılandı, Hat ${lineId} boşa çıkarılıyor`);
          clearTimeout(line.idleTimer);
          this.emit('onIdle', { line: `L${lineId}`, status: 'HAZIR' });
        }
      }
    } catch (e) {
      console.error('[Parser] Bridge veri hatası:', e.message, 'Gelen:', dataString);
    }
  }

  // 4. Kutu için Gelişmiş Arama (İsim veya Numara)
  searchDatabase(query) {
    if (!query || query.length < 3) return [];
    if (this.customerData.length === 0) return [];

    const normalizedQuery = query.toLowerCase().trim();
    const cleanNumQuery = normalizedQuery.replace(/\D/g, '');
    
    // Eğer sadece rakamlardan oluşuyorsa (boşluk ve tireler hariç) sayısal arama kabul et
    const isNumSearch = cleanNumQuery.length > 0 && cleanNumQuery.length >= normalizedQuery.replace(/[^a-z0-9]/gi, '').length;

    const results = [];
    
    for (let i = 0; i < this.customerData.length; i++) {
      const customer = this.customerData[i];
      if (!customer) continue;

      let isMatch = false;

      // Numara araması
      if (isNumSearch && cleanNumQuery.length >= 3) {
        const rawPhones = customer.telefon_numarasi || '';
        const parts = rawPhones.split(/[,\/;\-\s]+/);
        
        isMatch = parts.some(part => {
          const cleanPhone = part.replace(/\D/g, '');
          return cleanPhone.includes(cleanNumQuery);
        });
      } 
      
      // İsim araması (Ayrıca numara eşleşmediyse isme de bak)
      if (!isMatch) {
        const name = (customer.musteri_bilgisi || '').toLowerCase();
        // İsim içinde tam eşleşme veya parça eşleşmesi ara
        if (name.includes(normalizedQuery)) {
          isMatch = true;
        }
      }

      if (isMatch) {
        results.push({
          id: customer.id || customer.musteri_id || null,
          name: customer.musteri_bilgisi,
          phone: customer.telefon_numarasi,
          address: customer.acik_adres
        });
        
        // Çok fazla sonuç döndürüp sistemi kasmasın diye 15 ile sınırla
        if (results.length >= 15) break;
      }
    }

    return results;
  }

  async manualRefresh(lineLabel, phone) {
    this.debug(`[Manual Refresh] Talep Geldi: ${lineLabel}, Tel: ${phone}`);
    try {
      // 1. Önce veritabanını tazele
      await this.fetchLatestData();
      
      const syncInfo = {
        count: this.customerData.length,
        time: new Date().toLocaleTimeString('tr-TR'),
        status: 'success'
      };
      this.emit('sync-status', syncInfo);

      // 2. Yeni verilerle tekrar sorgula
      const customerInfo = this.lookupCustomer(phone);
      
      // 3. Güncel bilgileri arayüze gönder (Hemen yansıması için)
      const refreshData = {
        line: lineLabel, // Örn: "L1"
        phone: phone,
        time: new Date().toLocaleTimeString('tr-TR'),
        status: 'GUNCELLE', // 'ARANIYOR' yerine 'GUNCELLE' kullanarak animasyonu tetiklemiyoruz
        name: customerInfo ? customerInfo.name : 'Bilinmiyor',
        address: customerInfo ? customerInfo.address : 'Bilinmiyor',
        customerId: customerInfo ? customerInfo.id : null,
        results: customerInfo ? customerInfo.results : [],
        isIncoming: true
      };

      this.emit('onRing', refreshData);
      this.debug(`[Manual Refresh] Tamamlandı: ${refreshData.name}`);
      return { success: true };
    } catch (err) {
      this.debug(`[Manual Refresh] Hata: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  parse(rawData) {}

  simulateIncomingCall(lineId, phone) {
    this.handleBridgeData(JSON.stringify({
        event: 'CALL',
        line: lineId,
        phone: phone,
        time: new Date().toLocaleTimeString('tr-TR')
    }));
  }

  generateRandomTestNumber() {
    const prefixes = ['0532', '0533', '0542', '0544', '0555', '0216', '0212'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const body = Math.floor(1000000 + Math.random() * 9000000).toString();
    return prefix + body;
  }
}

module.exports = new CallerIdParser();


