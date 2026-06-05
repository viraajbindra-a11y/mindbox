// structures.js — the build/tech tree.
// Sapients (humans, elves, dwarves, orcs) gather wood + stone and build these.
// Each is a recipe: a cost, a prerequisite structure that must be nearby (the
// tech gate), an effect the sim applies, and a little procedurally-drawn model.
// Adding a new building is one row here — that's the "endless possibilities" hook.

const STRUCTS = [
  { key: 'campfire', name: 'Campfire', emoji: '🔥', tier: 1, cost: { wood: 5,  stone: 0 },  requires: null,       effect: 'camp',     spacing: 7,  color: '#d97a2a' },
  { key: 'hut',      name: 'Hut',      emoji: '🛖', tier: 2, cost: { wood: 14, stone: 0 },  requires: 'campfire', effect: 'heal',     spacing: 3,  color: '#a9763f' },
  { key: 'farm',     name: 'Farm',     emoji: '🌾', tier: 2, cost: { wood: 10, stone: 0 },  requires: 'campfire', effect: 'farm',     spacing: 4,  color: '#c9b047' },
  { key: 'wall',     name: 'Wall',     emoji: '🧱', tier: 3, cost: { wood: 0,  stone: 8 },  requires: 'hut',      effect: 'wall',     spacing: 2,  color: '#8a8378' },
  { key: 'tower',    name: 'Tower',    emoji: '🗼', tier: 4, cost: { wood: 8,  stone: 12 }, requires: 'wall',     effect: 'tower',    spacing: 9,  color: '#9a9488' },
  { key: 'monument', name: 'Monument', emoji: '🗿', tier: 5, cost: { wood: 25, stone: 30 }, requires: 'tower',    effect: 'monument', spacing: 16, color: '#b8c0c8' },
];
const STRUCT_BY_KEY = {};
STRUCTS.forEach((s, i) => { s.id = i; STRUCT_BY_KEY[s.key] = s; });

// ---- procedural building models (origin = tile centre, s = tile pixels) ----
function _sb(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }
const STRUCT_DRAW = {
  campfire(ctx, s, t) {
    _sb(ctx, -0.34 * s, 0.2 * s, 0.68 * s, 0.14 * s, '#6b4a2a');           // logs
    _sb(ctx, -0.28 * s, 0.26 * s, 0.56 * s, 0.1 * s, '#5a3e22');
    const f = 0.85 + Math.sin(t * 0.3) * 0.15;                            // flicker
    ctx.fillStyle = '#e8902a'; ctx.beginPath();
    ctx.moveTo(-0.22 * s, 0.22 * s); ctx.quadraticCurveTo(0, (-0.45 * f) * s, 0.22 * s, 0.22 * s); ctx.fill();
    ctx.fillStyle = '#f6d24a'; ctx.beginPath();
    ctx.moveTo(-0.12 * s, 0.22 * s); ctx.quadraticCurveTo(0, (-0.22 * f) * s, 0.12 * s, 0.22 * s); ctx.fill();
  },
  hut(ctx, s) {
    _sb(ctx, -0.34 * s, -0.05 * s, 0.68 * s, 0.42 * s, '#b98a52');         // walls
    ctx.fillStyle = '#7a4a2a'; ctx.beginPath();                            // roof
    ctx.moveTo(-0.46 * s, -0.03 * s); ctx.lineTo(0, -0.46 * s); ctx.lineTo(0.46 * s, -0.03 * s); ctx.closePath(); ctx.fill();
    _sb(ctx, -0.1 * s, 0.12 * s, 0.2 * s, 0.25 * s, '#4a2f1a');            // door
  },
  farm(ctx, s) {
    _sb(ctx, -0.42 * s, -0.34 * s, 0.84 * s, 0.68 * s, '#7a5a32');         // soil
    ctx.strokeStyle = '#9c7a3e'; ctx.lineWidth = Math.max(1, 0.06 * s);
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 0.16 * s, -0.32 * s); ctx.lineTo(i * 0.16 * s, 0.32 * s); ctx.stroke(); }
    ctx.fillStyle = '#8fce4a'; for (let i = -2; i <= 2; i++) ctx.fillRect(i * 0.16 * s - 0.03 * s, -0.3 * s, 0.06 * s, 0.12 * s);
  },
  wall(ctx, s) {
    _sb(ctx, -0.46 * s, -0.4 * s, 0.92 * s, 0.8 * s, '#8a847a');
    ctx.strokeStyle = '#6a655c'; ctx.lineWidth = Math.max(1, 0.05 * s);
    ctx.strokeRect(-0.46 * s, -0.13 * s, 0.92 * s, 0.001); ctx.strokeRect(-0.46 * s, 0.13 * s, 0.92 * s, 0.001);
    ctx.beginPath(); ctx.moveTo(0, -0.4 * s); ctx.lineTo(0, -0.13 * s); ctx.moveTo(-0.23 * s, -0.13 * s); ctx.lineTo(-0.23 * s, 0.13 * s); ctx.moveTo(0.23 * s, -0.13 * s); ctx.lineTo(0.23 * s, 0.13 * s); ctx.stroke();
  },
  tower(ctx, s) {
    _sb(ctx, -0.26 * s, -0.5 * s, 0.52 * s, 0.95 * s, '#9a9488');          // shaft
    for (let i = -1; i <= 1; i++) _sb(ctx, i * 0.2 * s - 0.07 * s, -0.6 * s, 0.14 * s, 0.12 * s, '#9a9488'); // battlements
    _sb(ctx, -0.08 * s, -0.2 * s, 0.16 * s, 0.2 * s, '#3a3630');           // window
    ctx.fillStyle = '#c0202a'; ctx.beginPath(); ctx.moveTo(0.26 * s, -0.5 * s); ctx.lineTo(0.5 * s, -0.43 * s); ctx.lineTo(0.26 * s, -0.36 * s); ctx.fill(); // flag
  },
  monument(ctx, s) {
    ctx.fillStyle = '#c2cad2'; ctx.beginPath();
    ctx.moveTo(-0.2 * s, 0.45 * s); ctx.lineTo(-0.1 * s, -0.55 * s); ctx.lineTo(0.1 * s, -0.55 * s); ctx.lineTo(0.2 * s, 0.45 * s); ctx.closePath(); ctx.fill();
    _sb(ctx, -0.32 * s, 0.42 * s, 0.64 * s, 0.12 * s, '#9aa2aa');          // base
    ctx.fillStyle = '#e8c84a'; ctx.beginPath(); ctx.moveTo(0, -0.72 * s); ctx.lineTo(-0.08 * s, -0.55 * s); ctx.lineTo(0.08 * s, -0.55 * s); ctx.fill(); // gold cap
  },
};

// ============================================================================
// LLM-GENERATED BUILDINGS
// Villagers pour resources in (e.g. 5 stone + 3 wood); the local model invents
// the building from the amounts. Different amounts -> different buildings. The
// fixed recipes above are the offline fallback. world.struct stores an index
// into BUILD_DEFS (a growing registry of every building kind that exists).
// ============================================================================

const BUILD_EFFECTS = ['shelter', 'farm', 'defense', 'storage', 'wonder'];
const BUILD_DEFS = [];   // [0]=construction site, [1..]=fixed fallbacks, then generated
let BUILD_SEED = 0;

function buildDefsInit() {
  BUILD_DEFS.length = 0;
  BUILD_DEFS.push({ name: 'Construction', emoji: '🏗️', effect: 'none', color: '#9a8a6a', fixed: '_construction' });
  for (const s of STRUCTS) BUILD_DEFS.push({ name: s.name, emoji: s.emoji, effect: s.effect, color: s.color, fixed: s.key });
  BUILD_SEED = BUILD_DEFS.length;   // generated buildings start here
}
const CONSTRUCTION_DI = 0;

// map any effect tag (fixed or generated) to a sim behaviour
function effectKind(effect) {
  if (effect === 'farm') return 'food';
  if (effect === 'tower' || effect === 'defense') return 'damage';
  if (effect === 'wall') return 'wall';
  if (effect === 'none') return 'none';
  return 'heal';   // camp, heal, shelter, storage, monument, wonder
}

const BuildGen = {
  cache: {},        // resourceKey -> BUILD_DEFS index
  pending: 0,
  maxPending: 3,
  key(res) { return Object.keys(res).filter(k => res[k] > 0).sort().map(k => k + Math.round(res[k])).join('_'); },

  // which building to place NOW. New combo + LLM online -> place a construction
  // site and call onReady(realIndex) once the model invents the real building.
  resolve(res, onReady) {
    const k = this.key(res);
    if (this.cache[k] !== undefined) return this.cache[k];
    const fb = this.fallbackIndex(res);
    if (typeof Ollama !== 'undefined' && Ollama.online) {
      if (this.pending < this.maxPending) {
        this.pending++;
        this._ask(res).then(def => {
          const di = def ? (BUILD_DEFS.push(def) - 1) : fb;
          this.cache[k] = di;
          if (onReady) onReady(di);
        }).catch(() => {}).finally(() => { this.pending--; });
        return CONSTRUCTION_DI;
      }
      return fb;   // model is busy — build a fallback now, leave uncached so a later build asks it
    }
    this.cache[k] = fb;   // truly offline → settle on a fitting fixed building
    return fb;
  },

  // offline / busy: pick the fixed building that best fits the resources
  fallbackIndex(res) {
    const wood = res.wood || 0, stone = res.stone || 0, total = wood + stone;
    let key;
    if (total >= 40) key = 'monument';
    else if (stone >= 10) key = 'tower';
    else if (stone >= 6) key = 'wall';
    else if (wood >= 12) key = 'hut';
    else if (wood >= 8) key = 'farm';
    else key = 'campfire';
    const i = BUILD_DEFS.findIndex(d => d.fixed === key);
    return i < 0 ? 1 : i;
  },

  async _ask(res) {
    const list = Object.keys(res).filter(k => res[k] > 0).map(k => `${Math.round(res[k])} ${k}`).join(' + ');
    const sys = 'You design buildings for a village in a god game. Given the resources a builder pours in, ' +
      'invent the single structure they construct — its kind and grandeur should fit the amounts (more = bigger). ' +
      'Reply ONLY compact JSON: {"name":"short building name","emoji":"one emoji","effect":"one of: shelter, farm, defense, storage, wonder"}.';
    const out = await Ollama.chat(sys, list, { json: true, temperature: 0.8, maxTokens: 70 });
    const m = out.match(/\{[\s\S]*\}/); if (!m) return null;
    const j = JSON.parse(m[0]); if (!j.name) return null;
    const effect = BUILD_EFFECTS.includes(j.effect) ? j.effect : 'shelter';
    const color = effect === 'defense' ? '#8a8378' : effect === 'farm' ? '#c9b047' : effect === 'wonder' ? '#cdd4dc' : '#a9763f';
    return { name: String(j.name).slice(0, 28), emoji: (j.emoji || '🏠'), effect, color };
  },

  save() { return { defs: BUILD_DEFS.slice(BUILD_SEED), cache: this.cache }; },
  load(d) {
    buildDefsInit();
    this.cache = {};
    if (d && d.defs) for (const def of d.defs) BUILD_DEFS.push(def);
    if (d && d.cache) this.cache = d.cache;
  },
};

function drawStructure(ctx, def, px, py, s, t) {
  ctx.save();
  ctx.translate(px + s / 2, py + s / 2);
  if (def.fixed && def.fixed !== '_construction' && STRUCT_DRAW[def.fixed]) {
    STRUCT_DRAW[def.fixed](ctx, s, t);
  } else if (def.fixed === '_construction') {
    ctx.fillStyle = '#9a8a6a'; ctx.fillRect(-0.32 * s, 0.0 * s, 0.64 * s, 0.36 * s);
    ctx.strokeStyle = '#d2b24a'; ctx.lineWidth = Math.max(1, 0.08 * s);
    ctx.beginPath(); ctx.moveTo(-0.4 * s, 0.36 * s); ctx.lineTo(0, -0.4 * s); ctx.lineTo(0.4 * s, 0.36 * s); ctx.stroke();
  } else {
    // an LLM-invented building: a coloured base + its emoji
    ctx.fillStyle = def.color || '#a9763f';
    ctx.fillRect(-0.4 * s, -0.06 * s, 0.8 * s, 0.42 * s);
    ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(-0.4 * s, 0.3 * s, 0.8 * s, 0.06 * s);
    if (s >= 11 && def.emoji) {
      ctx.font = `${(s * 0.66) | 0}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(def.emoji, 0, -0.08 * s);
    }
  }
  ctx.restore();
}

buildDefsInit();
