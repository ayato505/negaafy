const { contextBridge, ipcRenderer } = require('electron');

const calls = ['init', 'search', 'related', 'lyrics', 'resolveUrl', 'prefetch', 'warm', 'like', 'history', 'createPlaylist',
  'renamePlaylist', 'deletePlaylist', 'addToPlaylist', 'removeFromPlaylist', 'download', 'deleteDownload',
  'setSettings', 'pickFolder', 'ytdlpVersion', 'engineInfo', 'ytdlpUpdate', 'openExternal', 'openLibraryFolder', 'rescan', 'appVersion', 'checkUpdate', 'installUpdate',
  'trending', 'newReleases', 'dailyMixes', 'resolveDailyMix', 'tasteProfile', 'autoplay'];

const api = {};
for (const c of calls) api[c] = (...args) => ipcRenderer.invoke(c, ...args);
api.on = (ch, fn) => {
  if (['lib:changed', 'dl:progress', 'status', 'update'].includes(ch)) ipcRenderer.on(ch, (_e, p) => fn(p));
};

contextBridge.exposeInMainWorld('api', api);
