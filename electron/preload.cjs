const { contextBridge, ipcRenderer } = require('electron');
const invoke = async (method, ...args) => { const r = await ipcRenderer.invoke(`paperday:${method}`, ...args); if (!r.ok) throw new Error(r.error); return r.value; };
contextBridge.exposeInMainWorld('paperday', Object.freeze({
  state: () => invoke('state'), saveSettings: input => invoke('settings', input), recommend: extra => invoke('recommend', extra),
  summarize: id => invoke('summary', id), update: (id, patch) => invoke('update', id, patch),
  setFocus: description => invoke('focus', description),
  askPaper: (id, question) => invoke('ask', id, question),
  open: (id, kind) => invoke('open', id, kind), export: id => invoke('export', id), folder: () => invoke('folder')
}));
