const { spawn } = require('child_process');
const path = require('path');

// ELECTRON_RUN_AS_NODE=1 sisteme set olmuşsa, electron API'sini kırar.
// Bu satır ortam değişkenini env'den siler.
delete process.env.ELECTRON_RUN_AS_NODE;

process.env.NODE_ENV = process.env.NODE_ENV || 'development';

// Geliştirme ortamında DEV_MODE'u zorla aktif et (lisans kontrolünü atla)
if (process.env.NODE_ENV === 'development') {
  process.env.DEV_MODE = 'true';
}

console.log("Starting Electron from:", __dirname);

const electronBin = require('electron');

const proc = spawn(electronBin, ['.'], {
  stdio: 'inherit',
  env: process.env,
  shell: false,
  cwd: __dirname  // src-electron/ dizininden başlat → type:commonjs package.json
});

proc.on('close', (code) => {
  process.exit(code);
});
