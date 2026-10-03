const { app, BrowserWindow, ipcMain, Tray, Menu, Notification, globalShortcut, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const APP_ID = 'com.adian.tempo';
const ICON_ICO = path.join(__dirname, 'build', 'icon.ico');
const ICON_PNG = path.join(__dirname, 'build', 'icon.png');

// Title bar overlay colours must match --content in styles.css (the window controls sit over the content area)
const THEMES = {
  dark: { color: '#111113', symbolColor: '#c7c7cc' },
  light: { color: '#f5f5f7', symbolColor: '#1d1d1f' },
};

let win = null;
let tray = null;
let quitting = false;
let prefs = { theme: 'dark', closeToTray: true, launchAtLogin: false };
let loginApplied = null;
let backedUp = false;
const startHidden = process.argv.includes('--hidden');

app.setAppUserModelId(APP_ID);
// en-GB gives the native date/time pickers 24-hour time and day-first dates
app.commandLine.appendSwitch('lang', 'en-GB');

const dataPath = () => path.join(app.getPath('userData'), 'tempo-data.json');
const flagPath = (name) => path.join(app.getPath('userData'), name);

function loadData() {
  try { return JSON.parse(fs.readFileSync(dataPath(), 'utf8')); } catch { return null; }
}

function saveData(json) {
  const file = dataPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // Keep one backup per launch of whatever was there before we started writing
  if (!backedUp && fs.existsSync(file)) {
    try { fs.copyFileSync(file, file.replace(/\.json$/, '.backup.json')); } catch {}
    backedUp = true;
  }
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, json);
  fs.renameSync(tmp, file);
}

function notify(title, body) {
  if (!Notification.isSupported()) return;
  const n = new Notification({ title, body, icon: ICON_PNG });
  n.on('click', showWindow);
  n.show();
}

function showWindow() {
  if (!win) createWindow();
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function applyPrefs(p) {
  prefs = { ...prefs, ...p };
  const t = THEMES[prefs.theme] || THEMES.dark;
  if (win) {
    try { win.setTitleBarOverlay({ color: t.color, symbolColor: t.symbolColor, height: 44 }); } catch {}
    win.setBackgroundColor(t.color);
  }
  if (app.isPackaged && loginApplied !== !!prefs.launchAtLogin) {
    loginApplied = !!prefs.launchAtLogin;
    app.setLoginItemSettings({
      openAtLogin: loginApplied,
      path: process.env.PORTABLE_EXECUTABLE_FILE || process.execPath,
      args: ['--hidden'],
    });
  }
}

function createWindow() {
  const t = THEMES[prefs.theme] || THEMES.dark;
  win = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1000,
    minHeight: 660,
    show: false,
    title: 'Tempo',
    backgroundColor: t.color,
    icon: ICON_ICO,
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: t.color, symbolColor: t.symbolColor, height: 44 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false, // reminders + focus timer keep ticking while hidden in the tray
      spellcheck: false,
      autoplayPolicy: 'no-user-gesture-required',
    },
  });
  win.removeMenu();
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.once('ready-to-show', () => { if (!startHidden) win.show(); });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  win.on('close', (e) => {
    if (quitting || !prefs.closeToTray) return;
    e.preventDefault();
    win.hide();
    if (!fs.existsSync(flagPath('.tray-hint'))) {
      try { fs.writeFileSync(flagPath('.tray-hint'), '1'); } catch {}
      notify('Tempo is still running', 'It lives in the tray so your reminders keep working. Right-click the tray icon to quit.');
    }
  });
  // Never hold up a Windows shutdown/logoff by hiding to the tray
  win.on('query-session-end', () => { quitting = true; });
  win.on('session-end', () => { quitting = true; });
  win.on('closed', () => { win = null; });
}

function createTray() {
  tray = new Tray(ICON_ICO);
  tray.setToolTip('Tempo');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open Tempo', click: showWindow },
    { label: 'Quick add…', click: () => { showWindow(); win.webContents.send('quick-add'); } },
    { type: 'separator' },
    { label: 'Quit Tempo', click: () => { quitting = true; app.quit(); } },
  ]));
  tray.on('click', showWindow);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showWindow);

  ipcMain.handle('data:load', () => loadData());
  ipcMain.on('data:save', (_e, json) => { try { saveData(json); } catch (err) { console.error(err); } });
  ipcMain.on('data:saveSync', (e, json) => { try { saveData(json); } catch {} e.returnValue = true; });
  ipcMain.on('notify', (_e, { title, body }) => notify(title, body));
  ipcMain.on('progress', (_e, value, mode) => { if (win) win.setProgressBar(value, mode ? { mode } : undefined); });
  ipcMain.on('prefs', (_e, p) => applyPrefs(p));
  ipcMain.on('tray-tooltip', (_e, text) => { if (tray) tray.setToolTip(String(text).slice(0, 120)); });
  ipcMain.handle('export', async (_e, json) => {
    const stamp = new Date().toISOString().slice(0, 10);
    const r = await dialog.showSaveDialog(win, {
      title: 'Export Tempo data',
      defaultPath: `tempo-backup-${stamp}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (r.canceled || !r.filePath) return false;
    fs.writeFileSync(r.filePath, json);
    return true;
  });
  ipcMain.handle('import', async () => {
    const r = await dialog.showOpenDialog(win, {
      title: 'Import Tempo data',
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (r.canceled || !r.filePaths[0]) return null;
    return fs.readFileSync(r.filePaths[0], 'utf8');
  });

  app.whenReady().then(() => {
    const saved = loadData();
    if (saved && saved.settings) {
      prefs.theme = saved.settings.theme === 'light' ? 'light' : 'dark';
      prefs.closeToTray = saved.settings.closeToTray !== false;
    }
    createWindow();
    createTray();
    globalShortcut.register('CommandOrControl+Shift+Space', () => {
      showWindow();
      win.webContents.send('quick-add');
    });
  });

  app.on('before-quit', () => { quitting = true; });
  app.on('will-quit', () => globalShortcut.unregisterAll());
  app.on('window-all-closed', () => app.quit());
}
