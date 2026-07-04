// craft.js — Infinite-Craft-style discovery.
// Combine two things → a new thing. With Ollama running, the LLM invents the
// result (truly endless). Without it, a built-in recipe table keeps it playable.
// Discoveries are cached and saved, so a world slowly grows a tech tree.

const CRAFT_FALLBACK = {
  'fire + water': ['steam', '💨'], 'fire + wood': ['charcoal', '⚫'], 'fire + plant': ['ash', '🌫️'],
  'fire + stone': ['lava', '🌋'], 'fire + meat': ['steak', '🥩'], 'fire + fire': ['inferno', '🔥'],
  'fire + sand': ['glass', '🔷'], 'dirt + water': ['mud', '🟫'], 'plant + water': ['reed', '🌱'],
  'stone + water': ['clay', '🧱'], 'stone + stone': ['boulder', '🗿'], 'stone + wood': ['axe', '🪓'],
  'stone + bone': ['tool', '🛠️'], 'wood + wood': ['plank', '🪧'], 'plant + wood': ['paper', '📜'],
  'bone + bone': ['skeleton', '💀'], 'plant + plant': ['bush', '🌳'], 'dirt + plant': ['farm', '🌾'],
  'meat + plant': ['stew', '🍲'], 'water + wind': ['rain', '🌧️'], 'fire + wind': ['smoke', '💨'],
  'dirt + fire': ['brick', '🧱'], 'sand + water': ['beach', '🏖️'], 'metal + fire': ['blade', '🗡️'],
  'metal + wood': ['hammer', '🔨'], 'water + water': ['lake', '🌊'], 'wind + wind': ['storm', '🌪️'],
};

const Craft = {
  items: {},      // name -> { name, emoji, tier }
  recipes: {},    // "a + b" (sorted) -> result name
  log: [],        // recent discoveries (newest first)
  pending: false, // an auto-experiment is in flight
  _inflight: {},  // de-dupe concurrent identical combines
  base: [
    ['water', '💧'], ['fire', '🔥'], ['stone', '🪨'], ['wood', '🪵'], ['plant', '🌿'],
    ['meat', '🍖'], ['bone', '🦴'], ['dirt', '🟤'], ['sand', '🏜️'], ['wind', '🌬️'], ['metal', '🔩'],
  ],

  init() {
    this.items = {}; this.recipes = {}; this.log = []; this._inflight = {};
    for (const [n, e] of this.base) this.add(n, e, 0);
    this.load();
  },

  add(name, emoji, tier = 1) {
    name = String(name).toLowerCase().trim().slice(0, 24);
    if (!name) return null;
    if (!this.items[name]) this.items[name] = { name, emoji: emoji || '✨', tier };
    return this.items[name];
  },

  key(a, b) { return [a.toLowerCase(), b.toLowerCase()].sort().join(' + '); },
  count() { return Object.keys(this.items).length; },

  // combine two known items → discover/return the result
  async combine(a, b) {
    const k = this.key(a, b);
    if (this.recipes[k]) return this.items[this.recipes[k]];
    if (this._inflight[k]) return this._inflight[k];
    const p = (async () => {
      let res = null;
      if (Ollama.online) { try { res = await this._ask(a, b); } catch (e) { res = null; } }
      if (!res) res = this._fallback(a, b);
      const tier = Math.max(this.items[a.toLowerCase()] ? this.items[a.toLowerCase()].tier : 1,
                            this.items[b.toLowerCase()] ? this.items[b.toLowerCase()].tier : 1) + 1;
      const item = this.add(res.name, res.emoji, tier);
      if (!item) return null;
      this.recipes[k] = item.name;
      if (typeof Sfx !== 'undefined') Sfx.play('craft');
      this.log.unshift({ a, b, r: item.name, emoji: item.emoji });
      if (this.log.length > 60) this.log.pop();
      this.save();
      return item;
    })();
    this._inflight[k] = p;
    try { return await p; } finally { delete this._inflight[k]; }
  },

  async _ask(a, b) {
    const sys = 'You are the crafting engine of a god game, like the game Infinite Craft. ' +
      'The player combines two things; reply with the single most fitting new thing they make. ' +
      'Be evocative; you may invent. Reply ONLY compact JSON: {"name":"short lowercase name","emoji":"one emoji"}.';
    const out = await Ollama.chat(sys, `${a} + ${b}`, { json: true, temperature: 0.9, maxTokens: 60 });
    const m = out.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const j = JSON.parse(m[0]);
    if (!j.name) return null;
    const name = cleanLLM(String(j.name).toLowerCase()); if (!name) return null;   // crude name -> built-in fallback recipe
    return { name, emoji: (j.emoji || '✨') };
  },

  _fallback(a, b) {
    const t = CRAFT_FALLBACK[this.key(a, b)];
    if (t) return { name: t[0], emoji: t[1] };
    return { name: a.toLowerCase() + '-' + b.toLowerCase(), emoji: '✨' };
  },

  // let the AI experiment on its own: combine two random known items
  async experiment() {
    if (this.pending) return null;
    const names = Object.keys(this.items);
    if (names.length < 2) return null;
    const a = names[(Math.random() * names.length) | 0];
    let b = names[(Math.random() * names.length) | 0];
    if (a === b) b = names[(Math.random() * names.length) | 0];
    this.pending = true;
    try { return await this.combine(a, b); }
    finally { this.pending = false; }
  },

  save() { try { localStorage.setItem('mb_craft', JSON.stringify({ items: this.items, recipes: this.recipes, log: this.log })); } catch (e) {} },
  load() {
    try {
      const d = JSON.parse(localStorage.getItem('mb_craft') || 'null');
      if (d) { Object.assign(this.items, d.items || {}); Object.assign(this.recipes, d.recipes || {}); this.log = d.log || []; }
    } catch (e) {}
  },
};
