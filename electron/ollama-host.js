// electron/ollama-host.js — manages a LOCAL Ollama on the player's machine:
// find it, install it if missing, run `ollama serve`, pull models, and proxy
// chat requests. Runs in Electron's main process (full Node access).

const { spawn, execSync } = require('child_process');
const http = require('http');

const BASE = 'http://127.0.0.1:11434';
let serveProc = null;
let currentModel = 'llama3.2';

function findBinary() {
  const cands = process.platform === 'win32'
    ? ['ollama', 'ollama.exe']
    : ['ollama', '/usr/local/bin/ollama', '/opt/homebrew/bin/ollama', '/usr/bin/ollama'];
  const probe = process.platform === 'win32' ? 'where ' : 'command -v ';
  for (const c of cands) {
    try { execSync(probe + c, { stdio: 'ignore' }); return c; } catch (e) {}
  }
  return null;
}

function httpGet(pathname) {
  return new Promise((resolve, reject) => {
    const req = http.get(BASE + pathname, (resp) => {
      let d = ''; resp.on('data', (c) => (d += c)); resp.on('end', () => resolve({ status: resp.statusCode, body: d }));
    });
    req.on('error', reject);
    req.setTimeout(1500, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function serving() {
  try { return (await httpGet('/api/tags')).status === 200; } catch (e) { return false; }
}

async function ensureServing() {
  if (await serving()) return true;
  const bin = findBinary();
  if (!bin) return false;
  serveProc = spawn(bin, ['serve'], { detached: true, stdio: 'ignore', env: { ...process.env, OLLAMA_HOST: '127.0.0.1:11434' } });
  serveProc.unref();
  for (let i = 0; i < 30; i++) { await new Promise((r) => setTimeout(r, 500)); if (await serving()) return true; }
  return false;
}

async function status() {
  const bin = findBinary();
  const srv = await serving();
  let models = [];
  if (srv) { try { models = (JSON.parse((await httpGet('/api/tags')).body).models || []).map((m) => m.name); } catch (e) {} }
  return { installed: !!bin || srv, serving: srv, models, model: currentModel };
}

function install(onLine) {
  return new Promise((resolve) => {
    let cmd, args;
    if (process.platform === 'darwin') {
      try { execSync('command -v brew', { stdio: 'ignore' }); cmd = 'brew'; args = ['install', 'ollama']; }
      catch (e) { if (onLine) onLine('Install Ollama from https://ollama.com/download, then click Connect.'); return resolve({ ok: false, manual: true }); }
    } else if (process.platform === 'linux') {
      cmd = 'sh'; args = ['-c', 'curl -fsSL https://ollama.com/install.sh | sh'];
    } else {
      if (onLine) onLine('Install Ollama from https://ollama.com/download, then click Connect.'); return resolve({ ok: false, manual: true });
    }
    if (onLine) onLine('Installing Ollama…');
    const p = spawn(cmd, args, { shell: false });
    p.stdout.on('data', (d) => onLine && onLine(d.toString().trim()));
    p.stderr.on('data', (d) => onLine && onLine(d.toString().trim()));
    p.on('close', async (code) => { await ensureServing(); resolve({ ok: code === 0 }); });
    p.on('error', (err) => { if (onLine) onLine(String(err)); resolve({ ok: false }); });
  });
}

function pull(model, onLine) {
  return new Promise(async (resolve) => {
    await ensureServing();
    const bin = findBinary();
    if (!bin) { if (onLine) onLine('Ollama is not installed yet.'); return resolve({ ok: false }); }
    if (onLine) onLine('Downloading ' + model + '…');
    const p = spawn(bin, ['pull', model]);
    p.stdout.on('data', (d) => onLine && onLine(d.toString().trim()));
    p.stderr.on('data', (d) => onLine && onLine(d.toString().trim()));
    p.on('close', (code) => { if (code === 0) currentModel = model; resolve({ ok: code === 0 }); });
    p.on('error', (err) => { if (onLine) onLine(String(err)); resolve({ ok: false }); });
  });
}

function setModel(m) { currentModel = m; return { ok: true }; }

function chat(opts) {
  return ensureServing().then(() => new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: opts.model || currentModel,
      stream: false,
      format: opts.json ? 'json' : undefined,
      messages: [{ role: 'system', content: opts.system }, { role: 'user', content: opts.user }],
      options: { temperature: opts.temperature ?? 0.9, num_predict: opts.maxTokens ?? 80 },
    });
    const req = http.request(BASE + '/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (resp) => {
      let d = ''; resp.on('data', (c) => (d += c));
      resp.on('end', () => { try { resolve((JSON.parse(d).message || {}).content || ''); } catch (e) { reject(e); } });
    });
    req.on('error', reject);
    req.write(body); req.end();
  }));
}

function stop() { try { if (serveProc && serveProc.pid) process.kill(-serveProc.pid); } catch (e) {} }

module.exports = { ensureServing, status, install, pull, chat, setModel, stop };
