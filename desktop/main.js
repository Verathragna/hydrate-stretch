import { app, BrowserWindow, Notification, ipcMain, Tray, Menu, nativeImage } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

console.log('[main] starting…');
app.setAppUserModelId('com.hydrate.stretch'); // Windows toasts
console.log('[main] Notification supported?', Notification.isSupported());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let win;
let tray;
let quitting = false;

// ---------- prefs (renderer updates via IPC) ----------
let prefs = {
  hydrationMin: 30,
  stretchMin: 45,
  hydrationText: 'Grab some water ✨',
  stretchText: 'Stand up, loosen shoulders & hips 🧘',
  weekdaysOnly: false,
  workHoursOnly: false,
  workStart: '09:00',
  workEnd: '17:00',
  hydrationOn: true,
  stretchOn: true,
};

// Absolute due timestamps (ms since epoch)
let dueH = null;
let dueS = null;

// Debounce to prevent double toasts (e.g., triggerNow + scheduler in same second)
const MIN_GAP_MS = 5000; // 5s
const lastFired = { hydrate: 0, stretch: 0 };

// ---------- IPC ----------
ipcMain.on('set-prefs', (_evt, p) => {
  prefs = { ...prefs, ...p };
  console.log('[main] set-prefs', prefs);
  const now = Date.now();
  if (dueH == null) dueH = now + (prefs.hydrationMin || 1) * 60_000;
  if (dueS == null) dueS = now + (prefs.stretchMin || 1) * 60_000;
});

ipcMain.on('set-next-due', (_evt, { kind, dueAt }) => {
  if (typeof dueAt !== 'number' || !isFinite(dueAt)) return;
  if (kind === 'hydrate') { dueH = dueAt; console.log('[main] set dueH ->', new Date(dueH).toLocaleTimeString()); }
  if (kind === 'stretch') { dueS = dueAt; console.log('[main] set dueS ->', new Date(dueS).toLocaleTimeString()); }
});

ipcMain.on('trigger-now', (_evt, { kind }) => {
  const now = Date.now();
  if (kind === 'hydrate' && prefs.hydrationOn && allowedNow()) {
    tryFire('hydrate', now);
    dueH = now + (prefs.hydrationMin || 1) * 60_000;
    console.log('[main] trigger-now hydrate -> next', new Date(dueH).toLocaleTimeString());
  }
  if (kind === 'stretch' && prefs.stretchOn && allowedNow()) {
    tryFire('stretch', now);
    dueS = now + (prefs.stretchMin || 1) * 60_000;
    console.log('[main] trigger-now stretch -> next', new Date(dueS).toLocaleTimeString());
  }
});

// Test buttons
ipcMain.on('test-notification', (_evt, payload) => {
  const kind = payload?.kind || 'hydrate';
  tryFire(kind, Date.now(), /*force*/ true);
});

// Autostart
ipcMain.handle('get-launch-at-login', () => !!app.getLoginItemSettings().openAtLogin);
ipcMain.handle('set-launch-at-login', (_evt, enable) => {
  app.setLoginItemSettings({ openAtLogin: !!enable, openAsHidden: true });

  if (process.platform === 'linux') {
    const dir = path.join(os.homedir(), '.config', 'autostart');
    const desktopFile = path.join(dir, 'HydrateStretch.desktop');
    try {
      fs.mkdirSync(dir, { recursive: true });
      if (enable) {
        const exe = process.execPath;
        fs.writeFileSync(
          desktopFile,
          `[Desktop Entry]
Type=Application
Name=Hydrate & Stretch
Exec="${exe}"
X-GNOME-Autostart-enabled=true
`
        );
      } else if (fs.existsSync(desktopFile)) fs.unlinkSync(desktopFile);
    } catch (err) {
      // ignore errors writing autostart file
    }
  }
  return { ok: true };
});

// ---------- window / tray ----------
function createWindow() {
  const preloadPath = path.join(__dirname, 'preload.cjs');
  console.log('[main] preload path:', preloadPath);

  win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const distIndex = path.join(__dirname, 'dist', 'index.html');
  if (fs.existsSync(distIndex)) win.loadFile(distIndex);
  else win.loadURL('http://localhost:5173/');

  // close to tray
  win.on('close', (e) => {
    if (quitting) return;
    e.preventDefault();
    win.hide();
  });
}

function createTray() {
  try {
    const ico   = path.join(__dirname, 'dist', 'icons', 'icon.ico');
    const png32 = path.join(__dirname, 'dist', 'icons', 'icon-32.png');
    const png16 = path.join(__dirname, 'dist', 'icons', 'icon-16.png');

    let trayImage = null;
    if (fs.existsSync(ico)) trayImage = nativeImage.createFromPath(ico);
    else if (fs.existsSync(png32)) trayImage = nativeImage.createFromPath(png32);
    else if (fs.existsSync(png16)) trayImage = nativeImage.createFromPath(png16);
    else {
      const transparent1x1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7vWmEAAAAASUVORK5CYII=';
      trayImage = nativeImage.createFromBuffer(Buffer.from(transparent1x1, 'base64')).resize({ width: 16, height: 16 });
    }

    tray = new Tray(trayImage);
    const menu = Menu.buildFromTemplate([
      { label: 'Open Hydrate & Stretch', click: () => win?.show() },
      { type: 'separator' },
      { label: 'Quit', click: () => { quitting = true; app.quit(); } },
    ]);
    tray.setToolTip('Hydrate & Stretch');
    tray.setContextMenu(menu);
    tray.on('click', () => win?.show());
  } catch (err) {
    console.error('[main] Failed to create Tray, continuing without tray:', err);
    tray = null;
  }
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  const login = app.getLoginItemSettings();
  if (login.openAtLogin || process.argv.includes('--hidden')) win.hide();
});
app.on('before-quit', () => { quitting = true; });
app.on('window-all-closed', (e) => { e.preventDefault?.(); });

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();
else app.on('second-instance', () => { if (win) { win.show(); win.focus(); } });

// ---------- helpers & scheduler ----------
function allowedNow() {
  const now = new Date();
  if (prefs.weekdaysOnly) { const d = now.getDay(); if (d === 0 || d === 6) return false; }
  if (!prefs.workHoursOnly) return true;
  const [sh, sm] = (prefs.workStart || '09:00').split(':').map(Number);
  const [eh, em] = (prefs.workEnd || '17:00').split(':').map(Number);
  const start = new Date(now); start.setHours(sh, sm || 0, 0, 0);
  const end   = new Date(now); end.setHours(eh, em || 0, 0, 0);

  if (start <= end) return now >= start && now <= end;
  return now >= start || now <= end;
}

function tryFire(kind, now, force = false) {
  if (!force && now - lastFired[kind] < MIN_GAP_MS) {
    console.log(`[main] skip duplicate ${kind} (<${MIN_GAP_MS}ms)`);
    return false;
  }
  lastFired[kind] = now;
  const title = kind === 'stretch' ? 'Time to stretch' : 'Time to hydrate';
  const body  = kind === 'stretch' ? prefs.stretchText : prefs.hydrationText;
  console.log(`[main] fire ${kind} ->`, title, body);
  try { if (Notification.isSupported()) new Notification({ title, body }).show(); }
  catch (e) { console.error('[main] Notification error', e); }
  return true;
}

// Main scheduler checks every second
setInterval(() => {
  const now = Date.now();
  if (prefs.hydrationOn && typeof dueH === 'number' && now >= dueH && allowedNow()) {
    if (tryFire('hydrate', now)) {
      dueH = now + (prefs.hydrationMin || 1) * 60_000;
      console.log('[main] scheduled hydrate -> next', new Date(dueH).toLocaleTimeString());
    }
  }
  if (prefs.stretchOn && typeof dueS === 'number' && now >= dueS && allowedNow()) {
    if (tryFire('stretch', now)) {
      dueS = now + (prefs.stretchMin || 1) * 60_000;
      console.log('[main] scheduled stretch -> next', new Date(dueS).toLocaleTimeString());
    }
  }
}, 1000);
