// kingdoms.js — WorldBox-style civilizations.
// Sapients (humans, elves, dwarves, orcs) that cluster together form a KINGDOM:
// a named, coloured nation with a capital, territory, a population, and war/peace
// relations with its neighbours. The local LLM names them; a procedural name is
// used instantly and replaced when the model answers.

const KINGDOM_COLORS = ['#d24a4a', '#4a78d2', '#54c46a', '#d2b34a', '#a44ad2', '#4ad2c8', '#d27a4a', '#c84a8a', '#7a9a4a', '#4a9ad2'];
const NAME_A = ['Al', 'Ver', 'Bel', 'Cor', 'Dra', 'El', 'Fen', 'Gor', 'Hal', 'Ith', 'Kor', 'Lyr', 'Mor', 'Nor', 'Oth', 'Pyr', 'Quel', 'Rav', 'Sil', 'Thar', 'Ulf', 'Val', 'Wyn', 'Xan', 'Yor', 'Zel'];
const NAME_B = ['adia', 'oria', 'enthal', 'mar', 'dor', 'heim', 'gard', 'wyn', 'vale', 'reach', 'spire', 'fell', 'mont', 'grad', 'stead', 'crest', 'helm', 'moor'];

const Kingdoms = {
  list: [],
  byId: {},
  nextId: 1,
  territory: null,
  _dist: null,
  clusterRadius: 13,
  minCity: 4,

  init(sim) {
    this.list = []; this.byId = {}; this.nextId = 1;
    this.events = [];
    const n = sim.world.w * sim.world.h;
    this.territory = new Int16Array(n);
    this._dist = new Float32Array(n);
  },

  log(msg) { if (!this.events) this.events = []; if (this.events[0] === msg) return; this.events.unshift(msg); if (this.events.length > 30) this.events.pop(); },

  colorOf(id) { const k = this.byId[id]; return k ? k.color : null; },

  update(sim) {
    if (!this.territory) this.init(sim);
    const clusters = this._cluster(sim);
    const used = new Set();
    const next = [];
    for (const c of clusters) {
      let best = null, bestD = 26 * 26;
      for (const k of this.list) {
        if (used.has(k.id) || k.species !== c.species) continue;
        const d = (k.cx - c.cx) ** 2 + (k.cy - c.cy) ** 2;
        if (d < bestD) { bestD = d; best = k; }
      }
      if (best) { best.cx = c.cx; best.cy = c.cy; best.pop = c.pop; best.age++; used.add(best.id); next.push(best); }
      else next.push(this._found(c));
    }
    this.list = next;
    this.byId = {};
    for (const k of this.list) this.byId[k.id] = k;
    this._relations();
    this._territory(sim);
    this._war(sim);
  },

  // armies, sieges, and conquest
  _war(sim) {
    const W = sim.world.w;
    // each sapient belongs to the kingdom that owns the tile it stands on (same species)
    for (const c of sim.creatures) {
      if (!c.def.builder) continue;
      const k = this.byId[this.territory[c.y * W + c.x]];
      c.kingdomId = (k && k.species === c.species) ? k.id : 0;
    }
    // keep / drop army orders; soldiers re-aim at the (moving) enemy capital
    for (const c of sim.creatures) {
      if (!c.soldier) continue;
      const tgt = this.byId[c.armyTarget];
      if (!c.kingdomId || !tgt || !this.atWar(c.kingdomId, c.armyTarget)) { c.soldier = false; c.mtx = c.mty = -1; c.armyTarget = 0; }
      else { c.mtx = tgt.cx; c.mty = tgt.cy; }
    }
    // raise armies for each warring pair (both directions)
    for (const a of this.list)
      for (const idStr in a.relations) {
        const b = this.byId[idStr];
        if (b && a.relations[idStr] === 'war' && a.id < b.id) { this._recruit(sim, a, b); this._recruit(sim, b, a); }
      }
    // siege pressure: enemy soldiers vs defenders near each capital
    for (const k of this.list) { k.pressure = 0; k.defenders = 0; if (k.siege === undefined) k.siege = 0; }
    for (const c of sim.creatures) {
      if (c.soldier) {
        for (const k of this.list)
          if (k.id !== c.kingdomId && this.atWar(c.kingdomId, k.id) && (c.x - k.cx) ** 2 + (c.y - k.cy) ** 2 < 64)
            k.pressure += (this.byId[c.kingdomId] && this.byId[c.kingdomId].might) || 1;   // tech-age might
      } else if (c.kingdomId) {
        const k = this.byId[c.kingdomId];
        if (k && (c.x - k.cx) ** 2 + (c.y - k.cy) ** 2 < 64) k.defenders++;
      }
    }
    for (const k of this.list.slice()) {
      if (k.pressure >= 2 && k.pressure > k.defenders) {
        k.siege += (k.pressure - k.defenders) * 2;
        if (k.siege >= 50) this._conquer(sim, k);
      } else k.siege = Math.max(0, k.siege - 2);
    }
  },

  _recruit(sim, a, b) {
    const MAX = a.armyCap || 12;   // advanced realms (meta tech age) field bigger armies
    let have = 0;
    for (const c of sim.creatures) if (c.soldier && c.kingdomId === a.id && c.armyTarget === b.id) have++;
    for (const c of sim.creatures) {
      if (have >= MAX) break;
      if (c.soldier || c.kingdomId !== a.id) continue;
      if ((c.x - a.cx) ** 2 + (c.y - a.cy) ** 2 > 225) continue;   // muster near the capital
      c.soldier = true; c.armyTarget = b.id; c.mtx = b.cx; c.mty = b.cy; have++;
    }
  },

  _conquer(sim, loser) {
    let winner = null, best = -1;
    for (const k of this.list)
      if (k.id !== loser.id && this.atWar(loser.id, k.id) && k.pop > best) { best = k.pop; winner = k; }
    this.list = this.list.filter(k => k.id !== loser.id);
    delete this.byId[loser.id];
    for (const c of sim.creatures) {
      if (c.kingdomId === loser.id) c.kingdomId = winner ? winner.id : 0;
      if (c.soldier && c.armyTarget === loser.id) { c.soldier = false; c.mtx = c.mty = -1; c.armyTarget = 0; }
    }
    if (winner) winner.conquests = (winner.conquests || 0) + 1;
    this.log(`⚔ ${winner ? winner.name : 'Rebels'} conquered ${loser.name}`);
  },

  _cluster(sim) {
    const clusters = [];
    const R2 = this.clusterRadius * this.clusterRadius;
    for (const p of sim.creatures) {
      if (!p.def.builder) continue;
      let found = null;
      for (const cl of clusters) {
        if (cl.species !== p.species) continue;
        if ((cl.sx / cl.n - p.x) ** 2 + (cl.sy / cl.n - p.y) ** 2 < R2) { found = cl; break; }
      }
      if (found) { found.sx += p.x; found.sy += p.y; found.n++; }
      else clusters.push({ species: p.species, sx: p.x, sy: p.y, n: 1 });
    }
    return clusters.filter(c => c.n >= this.minCity)
      .map(c => ({ species: c.species, cx: Math.round(c.sx / c.n), cy: Math.round(c.sy / c.n), pop: c.n }));
  },

  _found(c) {
    const k = {
      id: this.nextId++, species: c.species, cx: c.cx, cy: c.cy, pop: c.pop, age: 0,
      color: KINGDOM_COLORS[(this.nextId * 3) % KINGDOM_COLORS.length],
      name: NAME_A[(Math.random() * NAME_A.length) | 0] + NAME_B[(Math.random() * NAME_B.length) | 0],
      relations: {},
    };
    if (typeof Meta !== 'undefined') Meta.seed(k);
    if (typeof Ollama !== 'undefined' && Ollama.online) this._llmName(k);
    return k;
  },

  async _llmName(k) {
    try {
      const out = await Ollama.chat(
        'You name fantasy kingdoms. Reply with ONLY the kingdom name, 1-2 words, no quotes or punctuation.',
        `Invent a kingdom name for a realm of ${k.species}s.`, { maxTokens: 12, temperature: 1.05 });
      const n = out.trim().split('\n')[0].replace(/["'.,]/g, '').slice(0, 22).trim();
      if (n && this.byId[k.id]) k.name = n;
    } catch (e) {}
  },

  _relations() {
    for (let i = 0; i < this.list.length; i++)
      for (let j = i + 1; j < this.list.length; j++) {
        const a = this.list[i], b = this.list[j];
        const near = (a.cx - b.cx) ** 2 + (a.cy - b.cy) ** 2 < 55 * 55;
        let rel = a.relations[b.id];
        if (!near) rel = 'neutral';
        else if (!rel || rel === 'neutral') rel = a.species !== b.species ? 'war' : 'peace';
        a.relations[b.id] = rel; b.relations[a.id] = rel;
      }
  },

  _territory(sim) {
    const W = sim.world.w, H = sim.world.h, R = 15;
    this.territory.fill(0);
    this._dist.fill(1e9);
    for (const k of this.list) {
      for (let y = Math.max(0, k.cy - R); y <= Math.min(H - 1, k.cy + R); y++)
        for (let x = Math.max(0, k.cx - R); x <= Math.min(W - 1, k.cx + R); x++) {
          const d = (x - k.cx) ** 2 + (y - k.cy) ** 2;
          if (d > R * R) continue;
          const i = y * W + x;
          if (d < this._dist[i]) { this._dist[i] = d; this.territory[i] = k.id; }
        }
    }
  },

  // is creature a at war with the kingdom owning the tile it's on? (used for combat flavour)
  atWar(aKingId, bKingId) {
    const a = this.byId[aKingId];
    return !!(a && a.relations[bKingId] === 'war');
  },
};
