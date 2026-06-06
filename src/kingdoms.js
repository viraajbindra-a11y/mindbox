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
  minCity: 6,        // people needed to FOUND a new realm (survival needs only 3 — hysteresis)

  init(sim) {
    this.list = []; this.byId = {}; this.nextId = 1;
    this.events = [];
    const n = sim.world.w * sim.world.h;
    this.territory = new Int16Array(n);
    this._dist = new Float32Array(n);
    this.roads = new Uint8Array(n);
  },

  log(msg) { if (!this.events) this.events = []; if (this.events[0] === msg) return; this.events.unshift(msg); if (this.events.length > 30) this.events.pop(); },

  colorOf(id) { const k = this.byId[id]; return k ? k.color : null; },

  update(sim) {
    if (!this.territory) this.init(sim);
    // 1) existing kingdoms PERSIST: each claims the nearby kin around its capital and
    //    anchors there. Surviving (just 3 people) is far easier than founding a new realm
    //    (minCity), and a realm gets a grace period before it falls — this hysteresis is
    //    what stops kingdoms blinking in and out (and jumping the map) as people wander.
    const claimed = new Set();
    const next = [];
    const CLAIM2 = 18 * 18;
    for (const k of this.list) {
      let sx = 0, sy = 0, n = 0;
      for (const p of sim.creatures) {
        if (!p.def.builder || p.species !== k.species || claimed.has(p)) continue;
        if ((p.x - k.cx) ** 2 + (p.y - k.cy) ** 2 <= CLAIM2) { sx += p.x; sy += p.y; n++; claimed.add(p); }
      }
      if (n >= 3) {
        k.cx += Math.round((sx / n - k.cx) * 0.1);   // capital drifts slowly toward its people (anchored)
        k.cy += Math.round((sy / n - k.cy) * 0.1);
        k.pop = n; k.age++; k.miss = 0; next.push(k);
      } else if ((k.miss = (k.miss || 0) + 1) <= 5) {
        k.pop = n; next.push(k);                       // grace period: don't vanish on a few bad updates
      } else {
        this.log(`🏚 ${k.name} faded into history`);
      }
    }
    // 2) found brand-new kingdoms only from people no existing realm claimed
    for (const c of this._cluster(sim, claimed)) next.push(this._found(c));
    this.list = next;
    this.byId = {};
    for (const k of this.list) this.byId[k.id] = k;
    this._relations();
    this._rebellion(sim);
    this._allianceWars();
    this._trade();
    this._roads(sim);
    this._territory(sim);
    this._war(sim);
  },

  // trade routes: allied or peaceful capitals within reach trade with each other.
  // (Visual on the map; Meta turns each partner into prosperity → faster tech.)
  _trade() {
    const routes = [];
    const R2 = 48 * 48;
    for (let i = 0; i < this.list.length; i++)
      for (let j = i + 1; j < this.list.length; j++) {
        const a = this.list[i], b = this.list[j], rel = a.relations[b.id];
        if (rel !== 'ally' && rel !== 'peace') continue;
        if ((a.cx - b.cx) ** 2 + (a.cy - b.cy) ** 2 > R2) continue;
        routes.push([a.id, b.id]);
      }
    this.tradeRoutes = routes;
  },

  // roads: worn paths traced between trading cities (a capital and each trade partner).
  // Roads stop at the water's edge. Purely a map feature for now.
  _roads(sim) {
    const W = sim.world.w, H = sim.world.h, biome = sim.world.biome;
    if (!this.roads || this.roads.length !== W * H) this.roads = new Uint8Array(W * H);
    this.roads.fill(0);
    const stamp = (x, y) => {
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      const i = y * W + x, b = biome[i];
      if (b !== B.DEEP && b !== B.SHALLOW) this.roads[i] = 1;   // roads don't run over open water
    };
    const line = (x0, y0, x1, y1) => {                          // Bresenham
      let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx + dy, g = 0;
      let x = x0, y = y0;
      while (g++ < 4000) {
        stamp(x, y);
        if (x === x1 && y === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x += sx; }
        if (e2 <= dx) { err += dx; y += sy; }
      }
    };
    for (const r of (this.tradeRoutes || [])) {
      const a = this.byId[r[0]], b = this.byId[r[1]];
      if (a && b) line(a.cx, a.cy, b.cx, b.cy);
    }
  },

  // allies are dragged into each other's wars (one hop per update) — this is what
  // turns a single border war into a bloc-wide world war as faith alliances chain.
  _allianceWars() {
    const decls = [];
    for (const a of this.list)
      for (const bid in a.relations) {
        if (a.relations[bid] !== 'ally') continue;
        const b = this.byId[bid]; if (!b) continue;
        for (const cid in b.relations) {
          if (b.relations[cid] !== 'war') continue;
          const c = this.byId[cid]; if (!c || c.id === a.id) continue;
          const cur = a.relations[c.id];
          if (cur !== 'war' && cur !== 'ally') decls.push([a, b, c]);   // join b's war, unless c is our own ally
        }
      }
    for (const [a, b, c] of decls) {
      if (a.relations[c.id] === 'ally') continue;   // a later decl may have allied them; never war an ally
      a.relations[c.id] = 'war'; c.relations[a.id] = 'war';
      this.log(`⚔ ${a.name} joins its ally ${b.name} against ${c.name}`);
    }
  },

  // REBELLION: a large, far-flung realm can fracture — a distant province breaks
  // away as a new kingdom and declares independence (civil war). The breakaway
  // founds its capital where its people already stand, so territory swings to it.
  _rebellion(sim) {
    for (const k of this.list.slice()) {
      if (this.list.length >= 16) break;          // keep the world legible
      if ((k.pop || 0) < 36 || k.age < 6) continue;
      if (Math.random() > 0.03) continue;          // rare, dramatic
      const mine = sim.creatures.filter(c => c.kingdomId === k.id);
      if (mine.length < 12) continue;
      mine.sort((a, b) => ((b.x - k.cx) ** 2 + (b.y - k.cy) ** 2) - ((a.x - k.cx) ** 2 + (a.y - k.cy) ** 2));
      const lead = mine[0];
      if ((lead.x - k.cx) ** 2 + (lead.y - k.cy) ** 2 < 13 * 13) continue;  // needs to be spread out
      const rebel = this._found({ species: k.species, cx: lead.x, cy: lead.y, pop: Math.max(4, Math.floor(k.pop / 3)) });
      rebel.relations[k.id] = 'war'; k.relations[rebel.id] = 'war';
      rebel.born = 'rebellion';
      this.list.push(rebel); this.byId[rebel.id] = rebel;
      this.log(`🔥 ${rebel.name} broke away from ${k.name} and declared independence`);
    }
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

  _cluster(sim, claimed) {
    const clusters = [];
    const R2 = this.clusterRadius * this.clusterRadius;
    for (const p of sim.creatures) {
      if (!p.def.builder) continue;
      if (claimed && claimed.has(p)) continue;          // people an existing realm already holds
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
      const n = cleanLLM(out.trim().split('\n')[0].replace(/["'.,]/g, '').slice(0, 22).trim());
      if (n && this.byId[k.id]) k.name = n;   // crude name -> keep the safe procedural one
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

  // Organic, WorldBox-style territory. Instead of a circle, a realm owns ZONES
  // (chunky 4x4 tile cells) seeded by its CAPITAL and its HOUSES, grown outward a
  // couple of zones (the "claim neighbouring land" expansion) and clipped to habitable
  // land. So borders are irregular, hug coasts and lakes, and spread as more houses are
  // built. Houses are stationary, so the shape is stable — it only shifts as the realm
  // actually builds. Nearest settlement wins contested ground. (WorldBox uses 8x8 zones
  // that a village claims outward from its buildings; this is the same idea, finer.)
  _territory(sim) {
    const W = sim.world.w, H = sim.world.h;
    const Z = 4;                                          // zone size in tiles
    const ZW = Math.ceil(W / Z), ZH = Math.ceil(H / Z), NZ = ZW * ZH;
    if (!this._zone || this._zone.length !== NZ) { this._zone = new Int16Array(NZ); this._zdist = new Float32Array(NZ); }
    const zone = this._zone, zdist = this._zdist;
    zone.fill(0); zdist.fill(1e9);
    const qx = [], qy = []; let head = 0;
    const seedTile = (tx, ty, id) => {
      const zx = (tx / Z) | 0, zy = (ty / Z) | 0;
      if (zx < 0 || zy < 0 || zx >= ZW || zy >= ZH) return;
      const z = zy * ZW + zx;
      if (zdist[z] > 0) { zdist[z] = 0; zone[z] = id; qx.push(zx); qy.push(zy); }
    };
    // seeds: the capital, plus every HOUSE (attributed to its nearest capital)
    for (const k of this.list) seedTile(k.cx, k.cy, k.id);
    for (const st of sim.structs) {
      const tx = st.idx % W, ty = (st.idx / W) | 0;
      let best = 0, bd = 24 * 24;
      for (const k of this.list) { const d = (k.cx - tx) ** 2 + (k.cy - ty) ** 2; if (d < bd) { bd = d; best = k.id; } }
      if (best) seedTile(tx, ty, best);
    }
    // grow outward a couple of zones, nearest seed wins — this makes the outline
    // irregular (the union of all the settlement zones) rather than a clean circle
    const GROW = 2;
    while (head < qx.length) {
      const zx = qx[head], zy = qy[head]; head++;
      const z = zy * ZW + zx; const d = zdist[z]; if (d >= GROW) continue;
      const id = zone[z];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = zx + dx, ny = zy + dy;
        if (nx < 0 || ny < 0 || nx >= ZW || ny >= ZH) continue;
        const nz = ny * ZW + nx;
        if (zdist[nz] > d + 1) { zdist[nz] = d + 1; zone[nz] = id; qx.push(nx); qy.push(ny); }
      }
    }
    // paint per-tile, skipping open water so borders hug the coastline (more organic)
    this.territory.fill(0);
    const biome = sim.world.biome;
    for (let ty = 0; ty < H; ty++) {
      const zrow = ((ty / Z) | 0) * ZW;
      for (let tx = 0; tx < W; tx++) {
        const id = zone[zrow + ((tx / Z) | 0)];
        if (!id) continue;
        const i = ty * W + tx;
        const b = biome[i];
        if (b === B.DEEP || b === B.SHALLOW) continue;   // don't claim open water
        this.territory[i] = id;
      }
    }
  },

  // is creature a at war with the kingdom owning the tile it's on? (used for combat flavour)
  atWar(aKingId, bKingId) {
    const a = this.byId[aKingId];
    return !!(a && a.relations[bKingId] === 'war');
  },
};
