const { spawn } = require('child_process');

// Bu satır ortam değişkenini KÖKTEN siler
delete process.env.ELECTRON_RUN_AS_NODE;

console.log("Starting Electron...");

const proc = spawn('npx', ['electron', '.'], {
  stdio: 'inherit',
  env: process.env,
  shell: true
});

proc.on('close', (code) => {
  process.exit(code);
});
