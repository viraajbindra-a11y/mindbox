// world.js — the WorldBox-style map.
// Each tile has a biome (ocean, beach, grass, forest, desert, mountain, snow),
// an elevation + moisture (used to pick the biome), a plant-food amount, a
// tree flag, and a fire timer. God tools terraform the map by changing these.

// biome ids (B) are defined in config.js so species.js can reference them

function fertilityOf(b) {
  if (b === B.GRASS) return 0.95;
  if (b === B.FOREST) return 0.72;
  if (b === B.SAVANNA) return 0.30;
  if (b === B.SHALLOW) return 0.22;   // plankton — food for fish
  if (b === B.DEEP) return 0.12;
  if (b === B.SAND) return 0.06;
  return 0;
}
function flammableOf(b) { return b === B.GRASS || b === B.FOREST || b === B.SAVANNA; }

function classifyBiome(e, m, temp) {
  if (e < 0.30) return B.DEEP;
  if (e < 0.385) return B.SHALLOW;
  if (e < 0.42) return B.SAND;
  if (e < 0.78) {
    if (temp < 0.27) return B.SNOW;     // cold lowlands → snowy tundra
    if (m < 0.30) return B.SAVANNA;     // dry
    if (m < 0.58) return B.GRASS;
    return B.FOREST;
  }
  if (e < 0.88) return temp < 0.45 ? B.SNOW : B.ROCK;
  return B.SNOW;
}

class World {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    const n = w * h;
    this.elev = new Float32Array(n);
    this.moist = new Float32Array(n);
    this.temp = new Float32Array(n);
    this.biome = new Uint8Array(n);
    this.tree = new Uint8Array(n);
    this.food = new Float32Array(n);
    this.fire = new Float32Array(n);
    this.ore = new Uint8Array(n);              // 0 none, 1 stone, 2 metal
    this.struct = new Int16Array(n).fill(-1);  // structure id at tile, -1 = none
    this.generate();
  }

  idx(x, y) { return y * this.w + x; }
  inBounds(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  isWater(x, y) { const b = this.biome[this.idx(x, y)]; return b === B.DEEP || b === B.SHALLOW; }
  walkable(x, y) { return this.inBounds(x, y) && !this.isWater(x, y); }
  foodAt(x, y) { return this.food[this.idx(x, y)]; }
  flammable(i) { return flammableOf(this.biome[i]); }
  fertilityAt(i) { return fertilityOf(this.biome[i]); }

  generate() {
    const { w, h } = this;
    const elevNoise = new Noise();
    const moistNoise = new Noise();
    const scale = 0.045;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = this.idx(x, y);
        // elevation, pushed down near the borders so the map is a continent
        let e = elevNoise.fractal(x * scale, y * scale, 5);
        const dx = Math.min(x, w - 1 - x) / (w * 0.5);
        const dy = Math.min(y, h - 1 - y) / (h * 0.5);
        const edge = Math.min(1, Math.min(dx, dy) * 1.7);
        e = Math.max(0, Math.min(1, e - (1 - edge) * 0.55));
        const m = moistNoise.fractal(x * scale + 11, y * scale + 7, 4);
        // temperature: warm at the equator (middle rows), colder up high
        const lat = 1 - Math.abs(y / (h - 1) - 0.5) * 2;
        const t = Math.max(0, Math.min(1, lat - (e - 0.4) * 0.5));
        this.elev[i] = e;
        this.moist[i] = m;
        this.temp[i] = t;
        const b = classifyBiome(e, m, t);
        this.biome[i] = b;
        this.tree[i] = b === B.FOREST && Math.random() < 0.7 ? 1 : 0;
        this.food[i] = fertilityOf(b) * CONFIG.foodStart;
        if (b === B.ROCK && Math.random() < CONFIG.oreChance) this.ore[i] = Math.random() < 0.3 ? 2 : 1;
        else if ((b === B.GRASS || b === B.SAVANNA || b === B.SAND) && Math.random() < 0.02) this.ore[i] = 1;  // surface boulders → stone on the plains
      }
    }
  }

  // Recompute a tile's biome after its elevation changed (used by terraform).
  recompute(i) {
    const b = classifyBiome(this.elev[i], this.moist[i], this.temp[i]);
    this.biome[i] = b;
    this.tree[i] = b === B.FOREST && Math.random() < 0.7 ? 1 : 0;
    if (this.food[i] > fertilityOf(b)) this.food[i] = fertilityOf(b);
  }

  grow(rate) {
    const f = this.food, biome = this.biome;
    for (let i = 0; i < f.length; i++) {
      const cap = fertilityOf(biome[i]);
      if (cap > 0 && f[i] < cap) f[i] = Math.min(cap, f[i] + rate * cap);
      if (biome[i] === B.FOREST && this.tree[i] === 0 && Math.random() < CONFIG.treeRegrow) this.tree[i] = 1;
    }
  }

  eat(x, y) {
    const i = this.idx(x, y);
    const amount = this.food[i];
    this.food[i] = 0;
    return amount;
  }

  // --- terraforming god tools (cx,cy center, r brush radius) ---
  terraform(cx, cy, r, kind) {
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        if (!this.inBounds(x, y)) continue;
        if ((x - cx) ** 2 + (y - cy) ** 2 > r * r) continue;
        const i = this.idx(x, y);
        switch (kind) {
          case 'raise':   this.elev[i] = Math.min(1, this.elev[i] + 0.06); this.recompute(i); break;
          case 'lower':   this.elev[i] = Math.max(0, this.elev[i] - 0.06); this.recompute(i); break;
          case 'mountain': this.elev[i] = 0.84; this.biome[i] = B.ROCK; this.tree[i] = 0; this.food[i] = 0; break;
          case 'forest':  this.elev[i] = 0.55; this.biome[i] = B.FOREST; this.tree[i] = 1; this.food[i] = Math.max(this.food[i], 0.4); break;
          case 'grass':   this.elev[i] = 0.50; this.biome[i] = B.GRASS; this.tree[i] = 0; this.food[i] = Math.max(this.food[i], 0.3); break;
          case 'sand':    this.elev[i] = 0.40; this.biome[i] = B.SAND; this.tree[i] = 0; this.food[i] = 0; break;
          case 'water':   this.elev[i] = 0.34; this.biome[i] = B.SHALLOW; this.tree[i] = 0; this.food[i] = 0; this.fire[i] = 0; break;
        }
      }
    }
  }
}
