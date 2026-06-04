// sim.js — runs time for the whole world: plant growth, fire, every creature's
// turn, births, deaths, per-species immigration floors, and god-power disasters.

// --- compact save/load helpers: typed arrays <-> base64 ---
function bytesToB64(arr) {
  const bytes = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK)
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  return btoa(bin);
}
function b64ToBytes(s) {
  const bin = atob(s);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}
function b64ToF32(s) { const b = b64ToBytes(s); return new Float32Array(b.buffer, 0, b.length / 4); }

class Simulation {
  constructor() {
    this.world = new World(CONFIG.gridW, CONFIG.gridH);
    this.creatures = [];
    this.grid = new Array(CONFIG.gridW * CONFIG.gridH).fill(null);
    this.burning = new Set();
    this.tickCount = 0;
    this.born = 0;
    this.died = 0;
    this.counts = {};
    this.history = [];
    this.selected = null;
    this.seed();
  }

  seed() {
    for (const def of SPECIES_LIST)
      for (let k = 0; k < def.start; k++) this.spawnRandom(def.key);
  }

  reset() {
    this.world = new World(CONFIG.gridW, CONFIG.gridH);
    this.creatures = [];
    this.grid = new Array(CONFIG.gridW * CONFIG.gridH).fill(null);
    this.burning = new Set();
    this.tickCount = this.born = this.died = 0;
    this.counts = {};
    this.history = [];
    this.selected = null;
    this.seed();
  }

  canStand(def, x, y) {
    if (!this.world.inBounds(x, y)) return false;
    if (def.domain === 'air') return true;
    const w = this.world.isWater(x, y);
    return def.domain === 'water' ? w : !w;
  }

  emptyCellFor(def) {
    for (let t = 0; t < 200; t++) {
      const x = Math.floor(Math.random() * this.world.w);
      const y = Math.floor(Math.random() * this.world.h);
      const i = this.world.idx(x, y);
      if (!this.canStand(def, x, y) || this.grid[i]) continue;
      // for the first tries, insist on the species' preferred biome; then settle
      if (def.habitat && t < 150 && !def.habitat.includes(this.world.biome[i])) continue;
      return [x, y];
    }
    return null;
  }

  spawnRandom(key) {
    const c = this.emptyCellFor(SPECIES[key]);
    if (c) this.spawnAt(key, c[0], c[1]);
  }

  spawnAt(key, x, y, brain, size, vision) {
    const def = SPECIES[key];
    if (!def || !this.canStand(def, x, y) || this.grid[this.world.idx(x, y)]) return;
    const b = brain || new NeuralNet(CONFIG.brainLayers);
    const hue = (def.hue + (Math.random() * 2 - 1) * 25 + 360) % 360;
    const c = new Creature(key, x, y, def.maxEnergy * (size || def.size) * 0.55, b, hue, 0, size, vision);
    this.grid[this.world.idx(x, y)] = c;
    this.creatures.push(c);
  }

  kill(c) {
    if (!c.alive) return;
    c.alive = false;
    const i = this.world.idx(c.x, c.y);
    if (this.grid[i] === c) this.grid[i] = null;
    this.died++;
  }

  rebuildGrid() {
    this.grid.fill(null);
    for (const c of this.creatures) this.grid[this.world.idx(c.x, c.y)] = c;
  }

  canReproduce(key) {
    if (this.creatures.length >= CONFIG.maxPop) return false;
    return (this.counts[key] || 0) < SPECIES[key].cap * CONFIG.capScale;
  }

  tick() {
    this.world.grow(CONFIG.foodGrowth);
    this.rebuildGrid();
    this.updateFire();

    this.counts = {};
    for (const c of this.creatures) this.counts[c.species] = (this.counts[c.species] || 0) + 1;

    const newborns = [];
    for (const c of this.creatures) {
      const child = c.step(this.world, this);
      if (child) { newborns.push(child); this.counts[child.species] = (this.counts[child.species] || 0) + 1; }
    }

    const survivors = [];
    for (const c of this.creatures) if (c.alive) survivors.push(c);
    this.creatures = survivors;
    for (const child of newborns) {
      if (this.creatures.length >= CONFIG.maxPop) break;
      this.creatures.push(child); this.born++;
    }

    // immigration: keep each species above its floor so nothing dies out
    for (const def of SPECIES_LIST) {
      let have = this.counts[def.key] || 0;
      while (have < def.min) { this.spawnRandom(def.key); have++; this.counts[def.key] = have; }
    }

    if (this.tickCount % 4 === 0) {
      let prey = 0, pred = 0;
      for (const c of this.creatures) (c.def.diet === 'plant' ? prey++ : pred++);
      this.history.push([prey, pred]);
      if (this.history.length > 320) this.history.shift();
    }
    this.tickCount++;
  }

  // --- fire ---
  ignite(i) {
    if (this.world.flammable(i) && this.world.fire[i] <= 0) {
      this.world.fire[i] = CONFIG.fireDuration;
      this.burning.add(i);
    }
  }

  updateFire() {
    if (this.burning.size === 0) return;
    const W = this.world, next = new Set();
    for (const i of this.burning) {
      W.fire[i] -= 1;
      const occ = this.grid[i];
      if (occ) { occ.energy -= CONFIG.fireDamage; if (occ.energy <= 0) this.kill(occ); }
      const x = i % W.w, y = (i / W.w) | 0;
      for (const [nx, ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]) {
        if (!W.inBounds(nx, ny)) continue;
        const ni = W.idx(nx, ny);
        if (W.flammable(ni) && W.fire[ni] <= 0 && Math.random() < CONFIG.fireSpread) this.ignite(ni);
      }
      if (W.fire[i] > 0) next.add(i);
      else { W.tree[i] = 0; W.food[i] *= 0.15; }
    }
    this.burning = next;
  }

  // --- disasters (god powers) ---
  meteor(cx, cy) {
    const r = 6;
    for (let y = cy - r; y <= cy + r; y++)
      for (let x = cx - r; x <= cx + r; x++) {
        if (!this.world.inBounds(x, y)) continue;
        const d2 = (x - cx) ** 2 + (y - cy) ** 2;
        if (d2 > r * r) continue;
        const i = this.world.idx(x, y);
        if (this.grid[i]) this.kill(this.grid[i]);
        if (d2 < (r * 0.7) ** 2) { this.world.food[i] = 0; this.ignite(i); }
      }
  }

  bomb(cx, cy) {
    const r = 4;
    for (let y = cy - r; y <= cy + r; y++)
      for (let x = cx - r; x <= cx + r; x++) {
        if (!this.world.inBounds(x, y)) continue;
        if ((x - cx) ** 2 + (y - cy) ** 2 > r * r) continue;
        const i = this.world.idx(x, y);
        if (this.grid[i]) this.kill(this.grid[i]);
        this.ignite(i);
      }
  }

  lightning(cx, cy) {
    for (const [x, y] of [[cx,cy],[cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]]) {
      if (!this.world.inBounds(x, y)) continue;
      const i = this.world.idx(x, y);
      if (this.grid[i]) this.kill(this.grid[i]);
      this.ignite(i);
    }
  }

  fireTool(cx, cy, r) {
    for (let y = cy - r; y <= cy + r; y++)
      for (let x = cx - r; x <= cx + r; x++)
        if (this.world.inBounds(x, y) && (x - cx) ** 2 + (y - cy) ** 2 <= r * r)
          this.ignite(this.world.idx(x, y));
  }

  smite(cx, cy, r) {
    for (const c of this.creatures)
      if ((c.x - cx) ** 2 + (c.y - cy) ** 2 <= r * r) this.kill(c);
  }

  selectAt(tx, ty) {
    let best = null, bestD = 81;
    for (const c of this.creatures) {
      const d = (c.x - tx) ** 2 + (c.y - ty) ** 2;
      if (d < bestD) { bestD = d; best = c; }
    }
    if (best) this.selected = best;
  }

  // --- save / load: terrain + every creature (species, genes, brain) ---
  serialize() {
    const w = this.world;
    return JSON.stringify({
      v: 2, gw: w.w, gh: w.h,
      biome: bytesToB64(w.biome), tree: bytesToB64(w.tree),
      elev: bytesToB64(w.elev), moist: bytesToB64(w.moist),
      temp: bytesToB64(w.temp), food: bytesToB64(w.food),
      tick: this.tickCount, born: this.born, died: this.died,
      creatures: this.creatures.map(c => ({
        k: c.species, x: c.x, y: c.y, e: c.energy, h: c.hue, g: c.generation, a: c.age,
        sz: c.size, vi: c.vision,
        w: c.brain.weights.map(bytesToB64), b: c.brain.biases.map(bytesToB64),
      })),
    });
  }

  load(str) {
    const d = JSON.parse(str);
    const w = new World(d.gw, d.gh);
    w.biome = b64ToBytes(d.biome);
    w.tree = b64ToBytes(d.tree);
    w.elev = b64ToF32(d.elev);
    w.moist = b64ToF32(d.moist);
    w.temp = b64ToF32(d.temp);
    w.food = b64ToF32(d.food);
    w.fire = new Float32Array(d.gw * d.gh);
    this.world = w;
    this.creatures = d.creatures.filter(o => SPECIES[o.k]).map(o => {
      const brain = new NeuralNet(CONFIG.brainLayers, o.w.map(b64ToF32), o.b.map(b64ToF32));
      const c = new Creature(o.k, o.x, o.y, o.e, brain, o.h, o.g, o.sz, o.vi);
      c.age = o.a;
      return c;
    });
    this.grid = new Array(w.w * w.h).fill(null);
    this.burning = new Set();
    this.tickCount = d.tick || 0;
    this.born = d.born || 0; this.died = d.died || 0;
    this.counts = {}; this.history = []; this.selected = null;
    this.rebuildGrid();
  }

  stats() {
    const census = {};
    let maxGen = 0, oldest = 0, sizeSum = 0, visSum = 0;
    for (const c of this.creatures) {
      census[c.species] = (census[c.species] || 0) + 1;
      if (c.generation > maxGen) maxGen = c.generation;
      if (c.age > oldest) oldest = c.age;
      sizeSum += c.size; visSum += c.vision;
    }
    const n = this.creatures.length || 1;
    return {
      tick: this.tickCount, pop: this.creatures.length, census,
      maxGen, oldest, born: this.born, died: this.died,
      avgSize: sizeSum / n, avgVision: visSum / n,
    };
  }
}
