const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const getFilePath = () => path.join(app.getPath('userData'), 'app-state.json');

const stateStore = {
  save(state) {
    try {
      const filePath = getFilePath();
      console.log('Oturum dosyaya kaydediliyor:', filePath);
      fs.writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf-8');
      return true;
    } catch (error) {
      console.error('State kaydedilemedi:', error);
      return false;
    }
  },

  load() {
    try {
      const filePath = getFilePath();
      if (fs.existsSync(filePath)) {
        console.log('Oturum dosyadan yükleniyor:', filePath);
        const data = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(data);
      } else {
        console.log('Oturum dosyası bulunamadı, yeni oturum başlatılacak.');
      }
    } catch (error) {
      console.error('State yüklenemedi:', error);
    }
    return null;
  }
};

module.exports = stateStore;
