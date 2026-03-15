import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Electron derlemesi için bağıl yol gerektirir.
  server: {
    port: 5173,
    strictPort: true, // Port çakışmalarını önlemek için
  }
})
