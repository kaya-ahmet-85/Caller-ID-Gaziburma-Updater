import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import Settings from './Settings.jsx'
import Help from './Help.jsx'
import { LanguageProvider } from './LanguageContext.jsx'

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
  } else {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  }
};

renderApp();
