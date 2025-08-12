// desktop/preload.cjs
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('HS', {
  setPrefs: (prefs) => ipcRenderer.send('set-prefs', prefs),
  setNextDue: (kind, dueAt) => ipcRenderer.send('set-next-due', { kind, dueAt }),
  triggerNow: (kind) => ipcRenderer.send('trigger-now', { kind }),
  onPlayPing: (cb) => ipcRenderer.on('play-ping', cb),
  testNotification: (kind) => ipcRenderer.send('test-notification', { kind }),
  getLaunchAtLogin: () => ipcRenderer.invoke('get-launch-at-login'),
  setLaunchAtLogin: (enable) => ipcRenderer.invoke('set-launch-at-login', enable),
});
