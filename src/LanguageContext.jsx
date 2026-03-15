import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations, t as translate } from './i18n.js';

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState('tr');

  // Uygulama açılışında dil tercihini yükle
  useEffect(() => {
    if (window.electronAPI?.getLanguage) {
      window.electronAPI.getLanguage().then(saved => {
        if (saved && translations[saved]) setLangState(saved);
      });
    }
  }, []);

  const setLang = (newLang) => {
    setLangState(newLang);
  };

  const t = (key) => translate(key, lang);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used inside LanguageProvider');
  return ctx;
}
