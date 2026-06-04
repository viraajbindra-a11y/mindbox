// sim.js — runs time: food growth, fire, every creature's turn, births,
// deaths, immigration, and the god-power disasters.

class Simulation {
  constructor() {
    this.world = new World(CONFIG.gridW, CONFIG.gridH);
    this.creatures = [];
    this.grid = new Array(CONFIG.gridW * CONFIG.gridH).fill(null);
    this.burning = new Set();
    this.tickCount = 0;
    this.born = 0;
    this.died = 0;
    this.gC = 0;
    this.hC = 0;
    this.history = [];     // [grazers, hunters] samples for the live graph
    this.selected = null;  // creature being inspected
    this.seed();
  }

  seed() {
    for (let k = 0; k < CONFIG.startGrazers; k++) this.spawnRandom('grazer');
    for (let k = 0; k < CONFIG.startHunters; k++) this.spawnRandom('hunter');
  }

  reset() {
    this.world = new World(CONFIG.gridW, CONFIG.gridH);
    this.creatures = [];
    this.grid = new Array(CONFIG.gridW * CONFIG.gridH).fill(null);
    this.burning = new Set();
    this.tickCount = this.born = this.died = 0;
    this.history = [];
    this.selected = null;
    this.seed();
  }

  emptyCell() {
    for (let t = 0; t < 200; t++) {
      const x = Math.floor(Math.random() * this.world.w);
      const y = Math.floor(Math.random() * this.world.h);
      if (this.world.walkable(x, y) && !this.grid[this.world.idx(x, y)]) return [x, y];
    }
    return null;
  }

  spawnRandom(species) {
    const c = this.emptyCell();
    if (c) this.spawnAt(species, c[0], c[1]);
  }

  spawnAt(species, x, y, brain) {
    if (!this.world.walkable(x, y) || this.grid[this.world.idx(x, y)]) return;
    const b = brain || new NeuralNet(CONFIG.brainLayers);
    const hue = species === 'hunter'
      ? (Math.random() * 40 + 350) % 360   // hunters start reddish
      : Math.random() * 120 + 70;          // grazers start green/cyan
    const c = new Creature(species, x, y, CONFIG.startEnergy, b, hue, 0);
    this.grid[this.world.idx(x, y)] = c;
    this.creatures.push(c);
  }

  selectAt(tx, ty) {
    let best = null, bestD = 81;  // pick the nearest creature within ~9 tiles
    for (const c of this.creatures) {
      const d = (c.x - tx) ** 2 + (c.y - ty) ** 2;
      if (d < bestD) { bestD = d; best = c; }
    }
    if (best) this.selected = best;
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

  canReproduce(species) {
    if (this.creatures.length >= CONFIG.maxPop) return false;
    return species === 'grazer' ? this.gC < CONFIG.maxGrazers : this.hC < CONFIG.maxHunters;
  }

  tick() {
    this.world.grow(CONFIG.foodGrowth);
    this.rebuildGrid();
    this.updateFire();

    // live species counts, so per-species caps work during the loop
    this.gC = 0; this.hC = 0;
    for (const c of this.creatures) (c.species === 'grazer' ? this.gC++ : this.hC++);

    const newborns = [];
    for (const c of this.creatures) {
      const child = c.step(this.world, this);
      if (child) { newborns.push(child); (child.species === 'grazer' ? this.gC++ : this.hC++); }
    }

    const survivors = [];
    for (const c of this.creatures) if (c.alive) survivors.push(c);
    this.creatures = survivors;
    for (const child of newborns) {
      if (this.creatures.length >= CONFIG.maxPop) break;
      this.creatures.push(child);
      this.born++;
    }

    // immigration: keep a minimum of each species so the food chain persists
    let grazers = 0, hunters = 0;
    for (const c of this.creatures) (c.species === 'grazer' ? grazers++ : hunters++);
    while (grazers < CONFIG.minGrazers) { this.spawnRandom('grazer'); grazers++; }
    while (hunters < CONFIG.minHunters) { this.spawnRandom('hunter'); hunters++; }

    if (this.tickCount % 4 === 0) {
      this.history.push([grazers, hunters]);
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
      // spread to neighbors
      const x = i % W.w, y = (i / W.w) | 0;
      const nb = [[x-1,y],[x+1,y],[x,y-1],[x,y+1]];
      for (const [nx, ny] of nb) {
        if (!W.inBounds(nx, ny)) continue;
        const ni = W.idx(nx, ny);
        if (W.flammable(ni) && W.fire[ni] <= 0 && Math.random() < CONFIG.fireSpread) this.ignite(ni);
      }
      if (W.fire[i] > 0) next.add(i);
      else { W.tree[i] = 0; W.food[i] *= 0.15; }   // burned out → scorched
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

  stats() {
    let grazers = 0, hunters = 0, maxGen = 0, oldest = 0;
    for (const c of this.creatures) {
      if (c.species === 'grazer') grazers++; else hunters++;
      if (c.generation > maxGen) maxGen = c.generation;
      if (c.age > oldest) oldest = c.age;
    }
    return {
      tick: this.tickCount, pop: this.creatures.length,
      grazers, hunters, maxGen, oldest, born: this.born, died: this.died,
    };
  }
}
