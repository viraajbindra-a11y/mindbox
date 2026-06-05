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
  [B.SWAMP]:   [78, 96, 66],
  [B.JUNGLE]:  [44, 112, 52],
  [B.DESERT]:  [226, 198, 116],
  [B.TUNDRA]:  [176, 186, 170],
  [B.TAIGA]:   [70, 104, 84],
  [B.MUSHROOM]:[122, 80, 150],
};
function isVeg(b) {
  return b === B.GRASS || b === B.FOREST || b === B.SAVANNA || b === B.JUNGLE ||
         b === B.SWAMP || b === B.TAIGA || b === B.TUNDRA || b === B.MUSHROOM;
}

// sky overlay keyframes over one day: [t, r, g, b, alpha]
const SKY_KEYS = [
  [0.00, 10, 16, 44, 0.50],   // midnight
  [0.22, 22, 24, 56, 0.42],   // pre-dawn
  [0.28, 240, 140, 70, 0.22], // sunrise (warm)
  [0.40, 255, 226, 184, 0.05],
  [0.50, 255, 255, 255, 0.00],// noon (clear)
  [0.68, 255, 232, 190, 0.05],
  [0.76, 242, 120, 80, 0.24], // sunset (warm)
  [0.83, 70, 44, 92, 0.34],   // dusk (purple)
  [0.92, 12, 18, 46, 0.48],
  [1.00, 10, 16, 44, 0.50],
];
function skyOverlay(t) {
  let a = SKY_KEYS[0], b = SKY_KEYS[SKY_KEYS.length - 1];
  for (let i = 0; i < SKY_KEYS.length - 1; i++) {
    if (t >= SKY_KEYS[i][0] && t <= SKY_KEYS[i + 1][0]) { a = SKY_KEYS[i]; b = SKY_KEYS[i + 1]; break; }
  }
  const f = (t - a[0]) / ((b[0] - a[0]) || 1);
  return [a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, a[3] + (b[3] - a[3]) * f, a[4] + (b[4] - a[4]) * f];
}

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

  // smoothly keep a tile centered (used to follow an inspected creature)
  centerOn(tx, ty, lerp = 0.15) {
    const viewW = this.canvas.width / this.cam.scale;
    const viewH = this.canvas.height / this.cam.scale;
    this.cam.x += ((tx + 0.5 - viewW / 2) - this.cam.x) * lerp;
    this.cam.y += ((ty + 0.5 - viewH / 2) - this.cam.y) * lerp;
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
    const season = seasonBlend(sim.tickCount);
    const seasonTint = season.tint, seasonStr = season.strength;

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
        // vegetated tiles get brighter with more food, then tinted by the season
        if (isVeg(b)) {
          g += world.food[i] * 45;
          r += (seasonTint[0] - r) * seasonStr;
          g += (seasonTint[1] - g) * seasonStr;
          bl += (seasonTint[2] - bl) * seasonStr;
        }
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
          ctx.fillStyle = b === B.TAIGA ? '#3a6b5a' : b === B.JUNGLE ? '#236a2c' : b === B.SWAMP ? '#49592f' : '#2f6b34';
          ctx.beginPath();
          ctx.arc(px + s / 2, py + s / 2, s * 0.34, 0, 6.283);
          ctx.fill();
        }
        if (drawTrees && world.ore[i]) {
          ctx.fillStyle = world.ore[i] === 2 ? '#d8b24a' : '#c2cad2';   // metal / stone
          ctx.beginPath(); ctx.arc(px + s * 0.34, py + s * 0.36, s * 0.15, 0, 6.283); ctx.fill();
          ctx.beginPath(); ctx.arc(px + s * 0.62, py + s * 0.6, s * 0.11, 0, 6.283); ctx.fill();
        }
      }
    }

    // kingdom territory tint
    if (Kingdoms.territory) {
      const terr = Kingdoms.territory;
      ctx.globalAlpha = 0.2;
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
        const id = terr[ty * W + tx]; if (!id) continue;
        const col = Kingdoms.colorOf(id); if (!col) continue;
        ctx.fillStyle = col;
        ctx.fillRect((tx - this.cam.x) * s, (ty - this.cam.y) * s, size, size);
      }
      ctx.globalAlpha = 1;
    }

    // structures (under creatures)
    for (const st of sim.structs) {
      const def = BUILD_DEFS[st.di]; if (!def) continue;
      const sx = st.idx % W, sy = (st.idx / W) | 0;
      if (sx < x0 - 1 || sx > x1 + 1 || sy < y0 - 1 || sy > y1 + 1) continue;
      const px = (sx - this.cam.x) * s, py = (sy - this.cam.y) * s;
      if (s >= 8) drawStructure(ctx, def, px, py, s, sim.tickCount);
      else { ctx.fillStyle = def.color || '#a9763f'; ctx.fillRect(px + s * 0.2, py + s * 0.2, s * 0.6, s * 0.6); }
    }

    // creatures — animated models when zoomed in, colored dots when far out
    const dayT = (sim.tickCount / CONFIG.dayLength) % 1;        // time of day, 0..1
    const night = (0.5 + 0.5 * Math.sin(2 * Math.PI * (dayT - 0.25))) < 0.33;
    const drawModels = s >= 12;
    for (const c of sim.creatures) {
      if (c.x < x0 - 1 || c.x > x1 + 1 || c.y < y0 - 1 || c.y > y1 + 1) continue;
      const px = (c.x - this.cam.x) * s + s / 2;
      const py = (c.y - this.cam.y) * s + s / 2;
      if (drawModels) { drawCreature(ctx, c, px, py, s, night); continue; }
      const light = 42 + Math.min(34, (c.energy / c.maxE) * 34);
      const sz = Math.min(1.5, c.size);
      const meat = c.def.diet !== 'plant';
      if (s < 3) {
        ctx.fillStyle = `hsl(${c.hue | 0},80%,${light}%)`;
        ctx.fillRect(px - s / 2, py - s / 2, Math.ceil(s), Math.ceil(s));
      } else {
        ctx.fillStyle = `hsl(${c.hue | 0},${meat ? 85 : 70}%,${light}%)`;
        ctx.beginPath();
        ctx.arc(px, py, s * (meat ? 0.6 : 0.5) * sz, 0, 6.283);
        ctx.fill();
        if (s >= 4 && meat) {
          ctx.lineWidth = Math.max(1, s * 0.14);
          ctx.strokeStyle = 'rgba(20,4,4,0.7)';
          ctx.stroke();
        }
      }
    }

    // marching soldiers get a little red spear
    for (const c of sim.creatures) {
      if (!c.soldier) continue;
      if (c.x < x0 - 1 || c.x > x1 + 1 || c.y < y0 - 1 || c.y > y1 + 1) continue;
      const px = (c.x - this.cam.x) * s + s / 2, py = (c.y - this.cam.y) * s + s / 2;
      ctx.strokeStyle = '#e84a4a'; ctx.lineWidth = Math.max(1, s * 0.12);
      ctx.beginPath(); ctx.moveTo(px, py - s * 0.45); ctx.lineTo(px, py - s * 0.95); ctx.stroke();
      ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.arc(px, py - s * 0.95, Math.max(1, s * 0.13), 0, 6.283); ctx.fill();
    }

    // highlight the inspected creature
    const sel = sim.selected;
    if (sel && sel.alive && sel.x >= x0 - 1 && sel.x <= x1 + 1 && sel.y >= y0 - 1 && sel.y <= y1 + 1) {
      const px = (sel.x - this.cam.x) * s + s / 2;
      const py = (sel.y - this.cam.y) * s + s / 2;
      ctx.lineWidth = Math.max(1.5, s * 0.16);
      ctx.strokeStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(px, py, s * 0.95, 0, 6.283);
      ctx.stroke();
    }

    // day/night sky: a coloured overlay cycling dawn → day → dusk → night
    const sky = skyOverlay(dayT);
    if (sky[3] > 0.003) {
      ctx.fillStyle = `rgba(${sky[0] | 0},${sky[1] | 0},${sky[2] | 0},${sky[3].toFixed(3)})`;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // kingdom capital markers + names (on top so they stay readable at night)
    if (s >= 4 && Kingdoms.list.length) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `bold ${Math.min(15, Math.max(9, s * 0.85)) | 0}px sans-serif`;
      for (const k of Kingdoms.list) {
        if (k.cx < x0 - 2 || k.cx > x1 + 2 || k.cy < y0 - 2 || k.cy > y1 + 2) continue;
        const px = (k.cx - this.cam.x) * s + s / 2, py = (k.cy - this.cam.y) * s + s / 2;
        ctx.fillStyle = k.color;
        ctx.beginPath(); ctx.moveTo(px, py - s * 0.7); ctx.lineTo(px - s * 0.45, py); ctx.lineTo(px + s * 0.45, py); ctx.closePath(); ctx.fill(); // little banner
        ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillText(k.name, px + 1, py - s - 4 + 1);
        ctx.fillStyle = k.color; ctx.fillText(k.name, px, py - s - 4);
        if (k.siege > 0) {   // under siege — red capture bar
          const bw = s * 1.8, bh = Math.max(2, s * 0.16);
          ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(px - bw / 2, py - s * 0.45, bw, bh);
          ctx.fillStyle = '#e84a4a'; ctx.fillRect(px - bw / 2, py - s * 0.45, bw * Math.min(1, k.siege / 50), bh);
        }
      }
    }
  }
}
