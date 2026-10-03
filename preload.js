const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  load: () => ipcRenderer.invoke('data:load'),
  save: (json) => ipcRenderer.send('data:save', json),
  saveSync: (json) => ipcRenderer.sendSync('data:saveSync', json),
  notify: (title, body) => ipcRenderer.send('notify', { title, body }),
  progress: (value, mode) => ipcRenderer.send('progress', value, mode),
  prefs: (p) => ipcRenderer.send('prefs', p),
  tooltip: (text) => ipcRenderer.send('tray-tooltip', text),
  exportData: (json) => ipcRenderer.invoke('export', json),
  importData: () => ipcRenderer.invoke('import'),
  onQuickAdd: (fn) => ipcRenderer.on('quick-add', () => fn()),
});
