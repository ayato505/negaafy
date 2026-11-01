// Auto-updates for the installed (NSIS) desktop app, from GitHub Releases of
// ayato2x/negaafy-updates (configured in package.json → build.publish).
const { app } = require('electron');

function setupUpdates(emit) {
  const api = { state: null, check: async () => null, install: () => {} };
  if (!app.isPackaged) return api; // npm start: nothing to update

  const { autoUpdater } = require('electron-updater');
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  const set = (u) => { api.state = u; emit(u); };

  autoUpdater.on('update-available', (i) => set({ state: 'downloading', version: i.version, pct: 0 }));
  autoUpdater.on('download-progress', (p) => set({ ...api.state, state: 'downloading', pct: p.percent }));
  autoUpdater.on('update-downloaded', (i) => set({ state: 'ready', version: i.version }));
  autoUpdater.on('error', () => { if (api.state && api.state.state !== 'ready') set({ state: 'error' }); });

  api.check = async () => {
    const r = await autoUpdater.checkForUpdates();
    const v = r && r.updateInfo && r.updateInfo.version;
    return v && v !== app.getVersion() ? { version: v } : null;
  };
  api.install = () => { if (api.state && api.state.state === 'ready') autoUpdater.quitAndInstall(false, true); };

  const quiet = () => api.check().catch(() => {});
  setTimeout(quiet, 8000);
  setInterval(quiet, 6 * 3600e3);
  return api;
}

module.exports = { setupUpdates };
