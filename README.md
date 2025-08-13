# Hydrate & Stretch – Electron (Native Windows Notifications)

This build removes web push and service workers.
Electron's main process fires native notifications on Windows (and macOS/Linux equivalents).

## Run (dev)
```bash
# Terminal A
cd client
npm install
npm run dev   # optional if you want the Electron dev fallback

# Terminal B (or after building client)
cd desktop
npm install
npm start
```

## Build client and package desktop
```bash
cd client
npm install
npm run build

# Copy build into Electron
rm -rf ../desktop/dist
mkdir -p ../desktop/dist
cp -r dist/* ../desktop/dist/

# Build installer
cd ../desktop
npm install
npm run build
```
This produces a Windows **.exe** (NSIS) installer in `desktop/release`.

## Notes
- App ID is `com.hydrate.stretch` (set via `app.setAppUserModelId` and electron-builder `appId`) so Windows toasts show in Action Center.
- The renderer (React UI) sends prefs to the main process via `window.HS.setPrefs` so native reminders match your config.
- Dark theme is enforced via `force-dark.css`.
