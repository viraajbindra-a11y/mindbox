// ollama.js — the game's link to a LOCAL LLM (Ollama) that powers the AI:
// infinite-craft invention and (later) agent reasoning. Everything runs on your
// own machine.
//
// Two modes, same API:
//   • DESKTOP APP (Electron): window.mindbox is present — the app installs,
//     runs and manages Ollama for you, and proxies requests (no CORS, no setup).
//   • PLAIN WEB PAGE: falls back to fetch() against a user-run Ollama
//     (run it with `OLLAMA_ORIGINS=* ollama serve`).
//
// Better model = smarter agents = better game. The Models panel lets you pull
// bigger models when your machine can handle them.

const Ollama = {
  online: false,
  installed: false,
  models: [],
  model: (typeof localStorage !== 'undefined' && localStorage.getItem('mb_ollama_model')) || 'llama3.2',
  endpoint: (typeof localStorage !== 'undefined' && localStorage.getItem('mb_ollama_url')) || 'http://localhost:11434',
  get bridge() { return typeof window !== 'undefined' && window.mindbox ? window.mindbox : null; },
  isDesktop() { return !!this.bridge; },

  // refresh status: is Ollama installed / serving, which models are available
  async check() {
    try {
      if (this.bridge) {
        const s = await this.bridge.ollamaStatus();
        this.installed = s.installed; this.online = s.serving;
        this.models = s.models || [];
      } else {
        const r = await fetch(this.endpoint + '/api/tags');
        if (!r.ok) throw new Error('status ' + r.status);
        const d = await r.json();
        this.models = (d.models || []).map(m => m.name);
        this.installed = true; this.online = true;
      }
      if (this.models.length && !this.models.includes(this.model)) this.setModel(this.models[0]);
    } catch (e) {
      this.online = false;
      if (!this.bridge) this.installed = false;
    }
    return this.online;
  },

  // install Ollama (desktop app only). onLine(text) streams progress.
  async install(onLine) {
    if (!this.bridge) throw new Error('Installing Ollama needs the desktop app. On the web, install it yourself from ollama.com.');
    return this.bridge.ollamaInstall(onLine || (() => {}));
  },

  // download a model. onLine(text) streams progress.
  async pull(model, onLine) {
    if (this.bridge) return this.bridge.ollamaPull(model, onLine || (() => {}));
    // web mode: stream /api/pull
    const r = await fetch(this.endpoint + '/api/pull', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: model, stream: true }),
    });
    if (!r.ok) throw new Error('pull ' + r.status);
    const reader = r.body.getReader(), dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n'); buf = lines.pop();
      for (const ln of lines) { if (!ln.trim()) continue; try { const j = JSON.parse(ln); if (onLine) onLine(j.status || ''); } catch (e) {} }
    }
    await this.check();
  },

  // one chat turn → assistant text
  async chat(system, user, opts = {}) {
    if (this.bridge) return this.bridge.ollamaChat({ system, user, ...opts });
    const r = await fetch(this.endpoint + '/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model, stream: false, format: opts.json ? 'json' : undefined,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        options: { temperature: opts.temperature ?? 0.9, num_predict: opts.maxTokens ?? 80 },
      }),
    });
    if (!r.ok) throw new Error('ollama ' + r.status);
    const d = await r.json();
    return (d.message && d.message.content) || '';
  },

  setModel(m) { this.model = m; try { localStorage.setItem('mb_ollama_model', m); } catch (e) {} if (this.bridge) this.bridge.ollamaSetModel(m); },
  setEndpoint(u) { this.endpoint = u.replace(/\/$/, ''); try { localStorage.setItem('mb_ollama_url', this.endpoint); } catch (e) {} },
};

// suggested models, smallest → smartest (better = better gameplay)
const OLLAMA_MODELS = [
  { name: 'llama3.2:1b',  label: 'Llama 3.2 1B', note: 'tiny · fast · runs on anything' },
  { name: 'llama3.2',     label: 'Llama 3.2 3B', note: 'small · good default' },
  { name: 'qwen2.5:7b',   label: 'Qwen 2.5 7B',  note: 'smarter · needs ~8GB RAM' },
  { name: 'llama3.1:8b',  label: 'Llama 3.1 8B', note: 'smart · ~8GB RAM' },
  { name: 'gemma2:9b',    label: 'Gemma 2 9B',   note: 'smarter · ~10GB RAM' },
  { name: 'qwen2.5:14b',  label: 'Qwen 2.5 14B', note: 'very smart · ~16GB RAM' },
];
