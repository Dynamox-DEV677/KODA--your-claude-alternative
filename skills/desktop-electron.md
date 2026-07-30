---
name: desktop-electron
description: Desktop apps with Electron (and when not to use it)
triggers: electron, desktop app, tray, native app, system tray
---
Build desktop apps with Electron only when the app truly needs OS integration (tray, global shortcuts, file watching, startup launch). A local web page or PWA is lighter and often enough — say so when it is.

STRUCTURE: main.js (main process: windows, tray, OS APIs) / preload.js (the ONLY bridge) / renderer (plain web UI). Keep main thin — logic lives in modules it imports.

SECURITY (non-negotiable defaults):
- BrowserWindow webPreferences: contextIsolation: true, nodeIntegration: false, sandbox: true.
- Expose capabilities via contextBridge.exposeInMainWorld with a NARROW API ("saveNote(text)"), never generic ipcRenderer or fs access.
- Validate every ipcMain.handle input like a server endpoint — the renderer is untrusted.

PATTERNS:
- Single instance lock (app.requestSingleInstanceLock) — second launch focuses the existing window.
- Tray app: window hide-on-close instead of quit, tray menu with Show/Quit; app.setLoginItemSettings for start-on-boot.
- Persist window bounds to a JSON settings file; restore on launch, clamp to current display.
- Renderer ↔ main: invoke/handle for request-response, webContents.send for pushes. Never remote module.
- Dev vs prod paths: app.isPackaged decides loadURL(localhost dev server) vs loadFile.

SHIPPING: electron-builder with nsis (Windows) / dmg (Mac) / AppImage (Linux) targets. Icons: 256px ico + icns. Auto-update only if the user asks — it needs signed builds.
VERIFY: launch it (run_command `npx electron .`), confirm the window opens and check the console for errors.
