import require$$0$3 from "electron";
import require$$0$1 from "path";
import require$$0$2 from "events";
import require$$1$1 from "util";
import require$$1 from "os";
import require$$0 from "fs";
function getDefaultExportFromCjs(x) {
  return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, "default") ? x["default"] : x;
}
var main$1 = {};
var nodehid = {};
var bindingOptions;
var hasRequiredBindingOptions;
function requireBindingOptions() {
  if (hasRequiredBindingOptions) return bindingOptions;
  hasRequiredBindingOptions = 1;
  bindingOptions = {
    name: "HID",
    napi_versions: [4]
  };
  return bindingOptions;
}
function commonjsRequire(path) {
  throw new Error('Could not dynamically require "' + path + '". Please configure the dynamicRequireTargets or/and ignoreDynamicRequires option of @rollup/plugin-commonjs appropriately for this require call to work.');
}
var prebuild;
var hasRequiredPrebuild;
function requirePrebuild() {
  if (hasRequiredPrebuild) return prebuild;
  hasRequiredPrebuild = 1;
  const fs = require$$0;
  function getPrebuildName(options) {
    if (!options.napi_version) throw new Error("NAN not implemented");
    const tokens = [
      options.name,
      options.platform,
      options.arch,
      // options.armv ? (options.arch === 'arm64' ? '8' : vars.arm_version) : null,
      options.libc && options.platform === "linux" ? options.libc : null
    ];
    return `${tokens.filter((t) => !!t).join("-")}/${options.runtime}-napi-v${options.napi_version}.node`;
  }
  function isNwjs() {
    return !!(process.versions && process.versions.nw);
  }
  function isElectron() {
    if (process.versions && process.versions.electron) return true;
    if (process.env.ELECTRON_RUN_AS_NODE) return true;
    return typeof window !== "undefined" && window.process && window.process.type === "renderer";
  }
  function isAlpine(platform) {
    return platform === "linux" && fs.existsSync("/etc/alpine-release");
  }
  prebuild = {
    getPrebuildName,
    isNwjs,
    isElectron,
    isAlpine
  };
  return prebuild;
}
var bindings;
var hasRequiredBindings;
function requireBindings() {
  if (hasRequiredBindings) return bindings;
  hasRequiredBindings = 1;
  const path = require$$0$1;
  const os = require$$1;
  const { getPrebuildName, isNwjs, isElectron, isAlpine } = requirePrebuild();
  const fs = typeof jest !== "undefined" ? jest.requireActual("fs") : require$$0;
  const runtimeRequire = typeof __webpack_require__ === "function" ? __non_webpack_require__ : commonjsRequire;
  function resolvePath(basePath, options, verifyPrebuild, throwOnMissing) {
    if (typeof basePath !== "string" || !basePath) throw new Error(`Invalid basePath to pkg-prebuilds`);
    if (typeof options !== "object" || !options) throw new Error(`Invalid options to pkg-prebuilds`);
    if (typeof options.name !== "string" || !options.name) throw new Error(`Invalid name to pkg-prebuilds`);
    let isNodeApi = false;
    if (options.napi_versions && Array.isArray(options.napi_versions)) {
      isNodeApi = true;
    }
    const arch = verifyPrebuild && process.env.npm_config_arch || os.arch();
    const platform = verifyPrebuild && process.env.npm_config_platform || os.platform();
    let runtime = "node";
    if (!isNodeApi) {
      if (verifyPrebuild && process.env.npm_config_runtime) {
        runtime = process.env.npm_config_runtime;
      } else if (isElectron()) {
        runtime = "electron";
      } else if (isNwjs()) {
        runtime = "node-webkit";
      }
    }
    const candidates = [];
    if (!verifyPrebuild) {
      candidates.push(
        path.join(basePath, "build", "Debug", `${options.name}.node`),
        path.join(basePath, "build", "Release", `${options.name}.node`)
      );
    }
    let libc = void 0;
    if (isAlpine(platform)) libc = "musl";
    if (isNodeApi) {
      for (const ver of options.napi_versions) {
        const prebuildName = getPrebuildName({
          name: options.name,
          platform,
          arch,
          libc,
          napi_version: ver,
          runtime
          // armv: options.armv ? (arch === 'arm64' ? '8' : vars.arm_version) : null,
        });
        candidates.push(path.join(basePath, "prebuilds", prebuildName));
      }
    } else {
      throw new Error("Not implemented for NAN!");
    }
    let foundPath = null;
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        const stat = fs.statSync(candidate);
        if (stat.isFile()) {
          foundPath = candidate;
          break;
        }
      }
    }
    if (!foundPath && throwOnMissing) {
      const candidatesStr = candidates.map((cand) => ` - ${cand}`).join("\n");
      throw new Error(`Failed to find binding for ${options.name}
Tried paths:
${candidatesStr}`);
    }
    return foundPath;
  }
  function loadBinding(basePath, options) {
    const foundPath = resolvePath(basePath, options, false, true);
    if (!foundPath) throw new Error(`Failed to find binding for ${options.name}`);
    return runtimeRequire(foundPath);
  }
  loadBinding.resolve = resolvePath;
  bindings = loadBinding;
  return bindings;
}
var hasRequiredNodehid;
function requireNodehid() {
  if (hasRequiredNodehid) return nodehid;
  hasRequiredNodehid = 1;
  const EventEmitter = require$$0$2.EventEmitter;
  const util = require$$1$1;
  let driverType = null;
  function setDriverType(type) {
    driverType = type;
  }
  let binding = null;
  function loadBinding() {
    if (!binding) {
      const options = requireBindingOptions();
      if (process.platform === "linux" && (!driverType || driverType === "hidraw")) {
        options.name = "HID_hidraw";
      }
      binding = requireBindings()(__dirname, options);
    }
  }
  function HID() {
    if (!new.target) {
      throw new Error("HID() must be called with 'new' operator");
    }
    EventEmitter.call(this);
    loadBinding();
    var thisPlusArgs = new Array(arguments.length + 1);
    thisPlusArgs[0] = null;
    for (var i = 0; i < arguments.length; i++)
      thisPlusArgs[i + 1] = arguments[i];
    this._raw = new (Function.prototype.bind.apply(
      binding.HID,
      thisPlusArgs
    ))();
    for (var i in binding.HID.prototype)
      this[i] = binding.HID.prototype[i].bind(this._raw);
    this._paused = true;
    var self = this;
    self.on("newListener", function(eventName, listener) {
      if (eventName == "data")
        process.nextTick(self.resume.bind(self));
    });
  }
  util.inherits(HID, EventEmitter);
  HID.prototype.close = function close() {
    this._closing = true;
    this.removeAllListeners();
    if (this._paused) {
      this._raw.close();
      this._closed = true;
    } else {
      this._raw.readInterrupt();
    }
  };
  HID.prototype.pause = function pause() {
    this._paused = true;
    this._raw.readInterrupt();
  };
  HID.prototype.read = function read(callback) {
    if (this._closed) {
      throw new Error("Unable to read from a closed HID device");
    } else {
      return this._raw.read(callback);
    }
  };
  HID.prototype.resume = function resume() {
    var self = this;
    if (self._paused && self.listeners("data").length > 0) {
      self._paused = false;
      self.read(function readFunc(err, data) {
        try {
          if (self._closing) {
            self._paused = true;
            self._raw.close();
            self._closed = true;
            return;
          }
          if (err) {
            self._paused = true;
            if (!self._closing)
              self.emit("error", err);
          } else {
            if (self.listeners("data").length <= 0)
              self._paused = true;
            if (!self._paused)
              self.read(readFunc);
            self.emit("data", data);
          }
        } catch (e) {
          setImmediate(() => {
            if (!self._closing)
              self.emit("error", e);
          });
        }
      });
    }
  };
  class HIDAsync extends EventEmitter {
    constructor(raw) {
      super();
      if (!(raw instanceof binding.HIDAsync)) {
        throw new Error(`HIDAsync cannot be constructed directly. Use HIDAsync.open() instead`);
      }
      this._raw = raw;
      for (let i in this._raw) {
        this[i] = async (...args) => this._raw[i](...args);
      }
      this.on("newListener", (eventName, listener) => {
        if (eventName == "data")
          process.nextTick(this.resume.bind(this));
      });
      this.on("removeListener", (eventName, listener) => {
        if (eventName == "data" && this.listenerCount("data") == 0)
          process.nextTick(this.pause.bind(this));
      });
    }
    static async open(...args) {
      loadBinding();
      const native = await binding.openAsyncHIDDevice(...args);
      return new HIDAsync(native);
    }
    async close() {
      this._closing = true;
      await this._raw.close();
      this.removeAllListeners();
      this._closed = true;
    }
    //Pauses the reader, which stops "data" events from being emitted
    pause() {
      this._raw.readStop();
    }
    resume() {
      if (this.listenerCount("data") > 0) {
        this._raw.readStart((err, data) => {
          try {
            if (err) {
              if (!this._closing)
                this.emit("error", err);
            } else {
              this.emit("data", data);
            }
          } catch (e) {
            setImmediate(() => {
              if (!this._closing)
                this.emit("error", e);
            });
          }
        });
      }
    }
  }
  function showdevices() {
    loadBinding();
    return binding.devices.apply(HID, arguments);
  }
  function showdevicesAsync(...args) {
    loadBinding();
    return binding.devicesAsync(...args);
  }
  function getHidapiVersion() {
    loadBinding();
    return binding.hidapiVersion;
  }
  nodehid.HID = HID;
  nodehid.HIDAsync = HIDAsync;
  nodehid.devices = showdevices;
  nodehid.devicesAsync = showdevicesAsync;
  nodehid.setDriverType = setDriverType;
  nodehid.getHidapiVersion = getHidapiVersion;
  return nodehid;
}
var hasRequiredMain;
function requireMain() {
  if (hasRequiredMain) return main$1;
  hasRequiredMain = 1;
  const { app, BrowserWindow, ipcMain } = require$$0$3;
  const path = require$$0$1;
  const HID = requireNodehid();
  const isDev = process.env.NODE_ENV === "development";
  let mainWindow;
  function createWindow() {
    mainWindow = new BrowserWindow({
      width: 1280,
      height: 800,
      minWidth: 1024,
      minHeight: 768,
      show: false,
      // Yüklenmeden pencereyi gösterme
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, "preload.js")
      }
    });
    if (isDev) {
      mainWindow.loadURL("http://localhost:5173");
    } else {
      mainWindow.loadFile(path.join(__dirname, "../dist", "index.html"));
    }
    mainWindow.once("ready-to-show", () => {
      mainWindow.show();
    });
    mainWindow.on("closed", () => {
      mainWindow = null;
    });
  }
  const VENDOR_ID = 1240;
  const PRODUCT_ID = 61395;
  let callerIdDevice = null;
  function connectToCallerId() {
    try {
      console.log("Caller ID Cihazı aranıyor...");
      callerIdDevice = new HID.HID(VENDOR_ID, PRODUCT_ID);
      console.log("✅ Caller ID Cihazına Başarıyla Bağlanıldı!");
      callerIdDevice.on("data", (data) => {
        const rawString = data.toString("utf8").replace(/\0/g, "").trim();
        console.log("USB HID Veri Geldi:", rawString);
        if (rawString && mainWindow) {
          mainWindow.webContents.send("caller-id-data", {
            raw: rawString,
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          });
        }
      });
      callerIdDevice.on("error", (err) => {
        console.error("Caller ID Cihaz Hatası:", err);
        callerIdDevice.close();
        callerIdDevice = null;
        setTimeout(connectToCallerId, 3e3);
      });
    } catch (error) {
      console.log("❌ Caller ID Cihazı Bulunamadı. 3 saniye sonra tekrar denenecek...");
      setTimeout(connectToCallerId, 3e3);
    }
  }
  app.whenReady().then(() => {
    createWindow();
    connectToCallerId();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
  ipcMain.on("ping", (event, arg) => {
    console.log("React (Frontend) tarafından mesaj alındı:", arg);
    event.reply("pong", "Electron (Backend) iletişim kurdu!");
  });
  return main$1;
}
var mainExports = requireMain();
const main = /* @__PURE__ */ getDefaultExportFromCjs(mainExports);
export {
  main as default
};
