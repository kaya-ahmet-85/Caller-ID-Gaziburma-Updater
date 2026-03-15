"use strict";
const require$$0 = require("electron");
var preload = {};
var hasRequiredPreload;
function requirePreload() {
  if (hasRequiredPreload) return preload;
  hasRequiredPreload = 1;
  const { contextBridge, ipcRenderer } = require$$0;
  contextBridge.exposeInMainWorld("electronAPI", {
    ping: (message) => ipcRenderer.send("ping", message),
    onPong: (callback) => ipcRenderer.on("pong", (event, arg) => callback(arg)),
    // İleride Caller ID cihazından gelen verileri dinlemek için eklenecek olay
    onCallerIdData: (callback) => ipcRenderer.on("caller-id-data", (event, data) => callback(data))
  });
  return preload;
}
requirePreload();
