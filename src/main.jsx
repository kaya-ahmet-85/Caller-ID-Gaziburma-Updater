import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import Settings from './Settings.jsx'
import Help from './Help.jsx'
import About from './About.jsx'
import SplashScreen from './SplashScreen.jsx'
import { LanguageProvider } from './LanguageContext.jsx'

// Ana uygulama — açılış ekranını sarmalamak için wrapper
function MainWithSplash() {
  const [showSplash, setShowSplash] = useState(true);
  return (
    <>
      {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}
      <App />
    </>
  );
}

const renderApp = () => {
  const root = createRoot(document.getElementById('root'));

  // Basit Hash Router mantığı
  if (window.location.hash === '#/settings') {
    root.render(
      <StrictMode>
        <LanguageProvider>
          <Settings />
        </LanguageProvider>
      </StrictMode>
    );
  } else if (window.location.hash === '#/help') {
    root.render(
      <StrictMode>
        <LanguageProvider>
          <Help />
        </LanguageProvider>
      </StrictMode>
    );
  } else if (window.location.hash === '#/about') {
    root.render(
      <StrictMode>
        <About />
      </StrictMode>
    );
  } else {
    // Yalnızca ana pencerede açılış ekranı gösterilir
    root.render(
      <StrictMode>
        <MainWithSplash />
      </StrictMode>
    );
  }
};

renderApp();
