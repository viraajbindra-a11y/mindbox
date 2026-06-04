// render.js — draws the world with a pan/zoom camera, WorldBox-style biome
// colors, trees, fire, and the two creature species.

const BIOME_COLOR = {
  [B.DEEP]:    [38, 82, 130],
  [B.SHALLOW]: [58, 120, 168],
  [B.SAND]:    [222, 205, 142],
  [B.GRASS]:   [110, 170, 84],
  [B.FOREST]:  [74, 132, 66],
  [B.SAVANNA]: [184, 168, 96],
  [B.ROCK]:    [138, 134, 128],
  [B.SNOW]:    [232, 238, 242],
};

class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    canvas.width = 840;
    canvas.height = 560;
    this.cam = { x: 0, y: 0, scale: 1 };
    this.fit();
  }

  minScale() { return Math.max(this.canvas.width / CONFIG.gridW, this.canvas.height / CONFIG.gridH); }

  fit() {
    this.cam.scale = this.minScale();
    this.clamp();
  }

  clamp() {
    this.cam.scale = Math.min(40, Math.max(this.minScale(), this.cam.scale));
    const viewW = this.canvas.width / this.cam.scale;
    const viewH = this.canvas.height / this.cam.scale;
    this.cam.x = Math.max(0, Math.min(CONFIG.gridW - viewW, this.cam.x));
    this.cam.y = Math.max(0, Math.min(CONFIG.gridH - viewH, this.cam.y));
  }

  screenToTile(sx, sy) {
    return {
      tx: Math.floor(this.cam.x + sx / this.cam.scale),
      ty: Math.floor(this.cam.y + sy / this.cam.scale),
    };
  }

  zoomAt(sx, sy, factor) {
    const wx = this.cam.x + sx / this.cam.scale;
    const wy = this.cam.y + sy / this.cam.scale;
    this.cam.scale *= factor;
    this.clamp();
    this.cam.x = wx - sx / this.cam.scale;
    this.cam.y = wy - sy / this.cam.scale;
    this.clamp();
  }

  pan(dxScreen, dyScreen) {
    this.cam.x -= dxScreen / this.cam.scale;
    this.cam.y -= dyScreen / this.cam.scale;
    this.clamp();
  }

  draw(sim) {
    const ctx = this.ctx, s = this.cam.scale, world = sim.world;
    const W = world.w, H = world.h;
    const x0 = Math.max(0, Math.floor(this.cam.x));
    const y0 = Math.max(0, Math.floor(this.cam.y));
    const x1 = Math.min(W - 1, Math.ceil(this.cam.x + this.canvas.width / s));
    const y1 = Math.min(H - 1, Math.ceil(this.cam.y + this.canvas.height / s));
    const size = Math.ceil(s) + 1;
    const drawTrees = s >= 4;

    ctx.fillStyle = '#0c0f16';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const i = world.idx(tx, ty);
        const b = world.biome[i];
        let [r, g, bl] = BIOME_COLOR[b];
        // shade by elevation for a little depth
        const shade = 0.82 + world.elev[i] * 0.32;
        r *= shade; g *= shade; bl *= shade;
        // grass/forest get brighter with more food
        if (b === B.GRASS || b === B.FOREST || b === B.SAVANNA) g += world.food[i] * 45;
        const fire = world.fire[i];
        const px = (tx - this.cam.x) * s, py = (ty - this.cam.y) * s;
        if (fire > 0) {
          const f = Math.min(1, fire / CONFIG.fireDuration);
          ctx.fillStyle = `rgb(${(230 + f * 25) | 0}, ${(90 + f * 60) | 0}, ${(20) | 0})`;
        } else {
          ctx.fillStyle = `rgb(${r | 0}, ${Math.min(255, g) | 0}, ${bl | 0})`;
        }
        ctx.fillRect(px, py, size, size);

        if (drawTrees && world.tree[i] && fire <= 0) {
          ctx.fillStyle = '#2f6b34';
          ctx.beginPath();
          ctx.arc(px + s / 2, py + s / 2, s * 0.34, 0, 6.283);
          ctx.fill();
        }
      }
    }

    // creatures
    for (const c of sim.creatures) {
      if (c.x < x0 - 1 || c.x > x1 + 1 || c.y < y0 - 1 || c.y > y1 + 1) continue;
      const px = (c.x - this.cam.x) * s + s / 2;
      const py = (c.y - this.cam.y) * s + s / 2;
      const light = 42 + Math.min(34, (c.energy / CONFIG.maxEnergy) * 34);
      if (s < 3) {
        ctx.fillStyle = `hsl(${c.hue | 0},80%,${light}%)`;
        ctx.fillRect(px - s / 2, py - s / 2, Math.ceil(s), Math.ceil(s));
      } else if (c.species === 'hunter') {
        ctx.fillStyle = `hsl(${c.hue | 0},85%,${light}%)`;
        ctx.beginPath();
        ctx.arc(px, py, s * 0.62, 0, 6.283);
        ctx.fill();
        ctx.lineWidth = Math.max(1, s * 0.16);
        ctx.strokeStyle = '#3a0d0d';
        ctx.stroke();
      } else {
        ctx.fillStyle = `hsl(${c.hue | 0},70%,${light}%)`;
        ctx.beginPath();
        ctx.arc(px, py, s * 0.46, 0, 6.283);
        ctx.fill();
      }
    }
  }
}
