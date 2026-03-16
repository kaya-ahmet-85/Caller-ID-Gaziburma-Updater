const electron = require('electron');
console.log('Type:', typeof electron);
console.log('Keys:', JSON.stringify(Object.keys(electron || {})));
const { app } = electron;
console.log('app:', typeof app, app ? 'defined' : 'UNDEFINED');
if (app) {
  app.whenReady().then(() => {
    console.log('App ready!');
    app.quit();
  });
} else {
  console.error('app is undefined!');
  process.exit(1);
}
