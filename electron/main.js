// electron/main.js — the desktop app shell.
// Loads the game (index.html) and exposes a managed local Ollama to it so the
// AI agents can think/invent. All Ollama setup is handled here in the main
// process (install, serve, pull models, chat) — no CORS, no manual setup.

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const host = require('./ollama-host');

let win;
function createWindow() {
  win = new BrowserWindow({
    width: 1320,
    height: 880,
    backgroundColor: '#0c0f16',
    title: 'MindBox',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, '..', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();
  host.ensureServing().catch(() => {});   // start Ollama in the background if installed
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => {
  host.stop();
  if (process.platform !== 'darwin') app.quit();
});

// --- bridge the renderer asks for (see electron/preload.js) ---
ipcMain.handle('ollama-status',   ()          => host.status());
ipcMain.handle('ollama-install',  (e)         => host.install((t) => e.sender.send('ollama-progress', t)));
ipcMain.handle('ollama-pull',     (e, model)  => host.pull(model, (t) => e.sender.send('ollama-progress', t)));
ipcMain.handle('ollama-chat',     (e, opts)   => host.chat(opts));
ipcMain.handle('ollama-setmodel', (e, m)      => host.setModel(m));
ipcMain.handle('open-external',   (e, url)    => shell.openExternal(url));
