// electron/preload.js — safely exposes the managed-Ollama bridge to the game as
// window.mindbox. ollama.js detects this and routes all LLM calls through here.

const { contextBridge, ipcRenderer } = require('electron');

// invoke a long task while forwarding its streamed progress lines to onLine()
function withProgress(channel, arg, onLine) {
  const handler = (_e, text) => { try { onLine && onLine(text); } catch (e) {} };
  ipcRenderer.on('ollama-progress', handler);
  const p = arg === undefined ? ipcRenderer.invoke(channel) : ipcRenderer.invoke(channel, arg);
  return p.finally(() => ipcRenderer.removeListener('ollama-progress', handler));
}

contextBridge.exposeInMainWorld('mindbox', {
  desktop: true,
  ollamaStatus:   () => ipcRenderer.invoke('ollama-status'),
  ollamaInstall:  (onLine) => withProgress('ollama-install', undefined, onLine),
  ollamaPull:     (model, onLine) => withProgress('ollama-pull', model, onLine),
  ollamaChat:     (opts) => ipcRenderer.invoke('ollama-chat', opts),
  ollamaSetModel: (m) => ipcRenderer.invoke('ollama-setmodel', m),
  openExternal:   (url) => ipcRenderer.invoke('open-external', url),
});
