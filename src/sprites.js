// sprites.js — procedurally-drawn, ANIMATED creature models (no emoji).
// Each species has a visual spec (body archetype + colours + features). A few
// shared "forms" draw a side-view animal and animate it by state:
//   walk  → legs swing, body bobs       eat → head dips and chomps
//   sleep → lies down, eyes shut, zzz    idle → gentle breathing
// The renderer advances each creature's `anim` phase every frame.

// ---- tiny canvas helpers (origin = creature centre, facing +x) ----
function _ell(ctx, x, y, rx, ry) { ctx.beginPath(); ctx.ellipse(x, y, Math.abs(rx) || 0.1, Math.abs(ry) || 0.1, 0, 0, 6.2832); ctx.fill(); }
function _cir(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, Math.abs(r) || 0.1, 0, 6.2832); ctx.fill(); }
function _tri(ctx, ax, ay, bx, by, cx, cy) { ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(cx, cy); ctx.closePath(); ctx.fill(); }
function _leg(ctx, x, yTop, len, w, ang, color) {
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, yTop); ctx.lineTo(x + Math.sin(ang) * len, yTop + Math.cos(ang) * len); ctx.stroke();
}
function _eye(ctx, x, y, r, sleeping) {
  if (sleeping) { ctx.strokeStyle = '#15140f'; ctx.lineWidth = Math.max(0.7, r * 0.9); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x + r, y); ctx.stroke(); }
  else { ctx.fillStyle = '#15140f'; _cir(ctx, x, y, r); }
}
function _zzz(ctx, u, anim) {
  ctx.fillStyle = 'rgba(230,240,255,0.85)'; ctx.textAlign = 'center';
  ctx.font = `${Math.max(6, (0.7 * u) | 0)}px monospace`;
  const o = Math.sin(anim * 0.5) * 0.12 * u;
  ctx.fillText('z', 0.7 * u, -1.0 * u - o);
  ctx.fillText('z', 1.0 * u, -1.45 * u - o);
}

const FORMS = {
  // ---------------- four-legged animals ----------------
  quad(ctx, sp, u, anim, state) {
    const sleeping = state === 'sleep', walk = state === 'walk';
    const sw = walk ? Math.sin(anim) * 0.5 : (state === 'idle' ? Math.sin(anim * 0.6) * 0.04 : 0);
    const bob = walk ? Math.abs(Math.sin(anim * 2)) * 0.08 * u : 0;
    ctx.save();
    if (sleeping) { ctx.translate(0, 0.42 * u); ctx.scale(1.05, 0.6); }
    ctx.translate(0, -bob);

    if (sp.wings) { // dragon wings (behind body)
      ctx.fillStyle = sp.c1; const wf = walk || true ? Math.sin(anim * 0.8) * 0.25 : 0;
      ctx.save(); ctx.translate(-0.1 * u, -0.4 * u); ctx.rotate(-0.5 - wf);
      _tri(ctx, 0, 0, -1.5 * u, -0.6 * u, -0.3 * u, 0.6 * u); ctx.restore();
    }

    const legc = sp.legc || sp.c2 || '#5a4a3a';
    const legY = 0.28 * u, legLen = 0.7 * u, legW = Math.max(1.2, 0.17 * u);
    const xs = [-0.55, -0.3, 0.3, 0.55], ph = [1, -1, -1, 1];
    if (!sleeping) for (let k = 0; k < 4; k++) _leg(ctx, xs[k] * u, legY, legLen, legW, ph[k] * sw, legc);

    // tail
    if (sp.tail && sp.tail !== 'none') {
      ctx.strokeStyle = sp.tailc || sp.c1; ctx.lineCap = 'round';
      const wag = walk ? Math.sin(anim) * 0.12 * u : 0;
      if (sp.tail === 'bushy' || sp.tail === 'bushytip') { ctx.lineWidth = Math.max(2, 0.3 * u);
        ctx.beginPath(); ctx.moveTo(-1.0 * u, -0.05 * u); ctx.lineTo(-1.5 * u, -0.35 * u + wag); ctx.stroke();
        if (sp.tail === 'bushytip') { ctx.fillStyle = '#f0eada'; _cir(ctx, -1.5 * u, -0.35 * u + wag, 0.16 * u); } }
      else { ctx.lineWidth = Math.max(1.4, 0.15 * u);
        ctx.beginPath(); ctx.moveTo(-1.0 * u, -0.05 * u); ctx.lineTo(-1.35 * u, -0.25 * u + wag); ctx.stroke();
        if (sp.tail === 'tuft') { ctx.fillStyle = sp.mane || sp.c1; _cir(ctx, -1.35 * u, -0.25 * u + wag, 0.13 * u); } }
    }

    // body
    if (sp.mane) { ctx.fillStyle = sp.mane; _cir(ctx, 0.78 * u, -0.2 * u, 0.62 * u); }
    ctx.fillStyle = sp.c1; _ell(ctx, 0, 0, 1.05 * u, 0.66 * u);
    if (sp.belly) { ctx.fillStyle = sp.belly; _ell(ctx, 0.05 * u, 0.2 * u, 0.78 * u, 0.4 * u); }
    if (sp.spots) { ctx.fillStyle = sp.spots; _ell(ctx, -0.4 * u, -0.05 * u, 0.3 * u, 0.26 * u); _ell(ctx, 0.45 * u, 0.12 * u, 0.22 * u, 0.2 * u); }
    if (sp.fluffy) { ctx.fillStyle = sp.c1; for (let i = -2; i <= 2; i++) _cir(ctx, i * 0.42 * u, -0.5 * u, 0.3 * u); _cir(ctx, -1.0 * u, -0.1 * u, 0.32 * u); }

    // head
    const dip = state === 'eat' ? 0.55 + Math.sin(anim * 3) * 0.16 : 0;
    ctx.save(); ctx.translate(0.95 * u, -0.28 * u); ctx.rotate(dip);
    const hc = sp.headc || sp.c1;
    if (sp.mane) { ctx.fillStyle = sp.mane; _cir(ctx, 0.05 * u, 0, 0.55 * u); }
    if (sp.ears === 'round') { ctx.fillStyle = hc; _cir(ctx, -0.18 * u, -0.42 * u, 0.17 * u); _cir(ctx, 0.34 * u, -0.42 * u, 0.17 * u); }
    if (sp.ears === 'pointy') { ctx.fillStyle = hc; _tri(ctx, -0.25 * u, -0.3 * u, -0.05 * u, -0.85 * u, 0.18 * u, -0.35 * u); _tri(ctx, 0.5 * u, -0.35 * u, 0.45 * u, -0.85 * u, 0.2 * u, -0.3 * u); }
    if (sp.ears === 'long') { ctx.fillStyle = hc; _ell(ctx, -0.02 * u, -0.62 * u, 0.1 * u, 0.46 * u); _ell(ctx, 0.24 * u, -0.62 * u, 0.1 * u, 0.46 * u); }
    ctx.fillStyle = hc; _ell(ctx, 0.12 * u, 0, 0.5 * u, 0.45 * u);
    if (sp.snout) { ctx.fillStyle = sp.snoutc || hc; _ell(ctx, 0.5 * u, 0.1 * u, 0.26 * u, 0.2 * u); ctx.fillStyle = '#241c18'; _cir(ctx, 0.66 * u, 0.1 * u, 0.07 * u); }
    if (sp.trunk) { ctx.strokeStyle = hc; ctx.lineWidth = 0.2 * u; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0.5 * u, 0.1 * u); ctx.quadraticCurveTo(0.85 * u, 0.4 * u, 0.7 * u, 0.75 * u); ctx.stroke(); }
    if (sp.horns) { ctx.strokeStyle = sp.hornc || '#dccca0'; ctx.lineWidth = Math.max(1, 0.13 * u); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-0.05 * u, -0.3 * u); ctx.lineTo(-0.28 * u, -0.66 * u); ctx.moveTo(0.4 * u, -0.3 * u); ctx.lineTo(0.6 * u, -0.66 * u); ctx.stroke(); }
    if (sp.tusks) { ctx.strokeStyle = '#ece3cf'; ctx.lineWidth = Math.max(1, 0.12 * u); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0.45 * u, 0.22 * u); ctx.lineTo(0.62 * u, 0.46 * u); ctx.moveTo(0.3 * u, 0.24 * u); ctx.lineTo(0.4 * u, 0.5 * u); ctx.stroke(); }
    _eye(ctx, 0.3 * u, -0.08 * u, Math.max(1, 0.09 * u), sleeping);
    ctx.restore();
    ctx.restore();
    if (sleeping) _zzz(ctx, u, anim);
  },

  // ---------------- two-legged people / monsters ----------------
  biped(ctx, sp, u, anim, state) {
    const sleeping = state === 'sleep', walk = state === 'walk';
    const sw = walk ? Math.sin(anim) * 0.45 : 0;
    const bob = walk ? Math.abs(Math.sin(anim)) * 0.06 * u : 0;
    ctx.save();
    if (sleeping) { ctx.translate(0, 0.55 * u); ctx.rotate(1.4); }
    ctx.translate(0, -bob);
    const legc = sp.legc || '#3a3a4a', sh = sp.short ? 0.8 : 1, big = sp.big ? 1.15 : 1;
    // legs
    const legY = 0.2 * u * sh, legLen = 0.7 * u * sh, legW = Math.max(1.4, 0.2 * u);
    _leg(ctx, -0.12 * u, legY, legLen, legW, sw, legc);
    _leg(ctx, 0.12 * u, legY, legLen, legW, -sw, legc);
    // torso
    ctx.fillStyle = sp.bone ? sp.skin : (sp.cloth || sp.skin);
    _ell(ctx, 0, -0.25 * u * sh, 0.4 * u * big, 0.55 * u * sh);
    if (sp.bone) { ctx.strokeStyle = '#b9b5a6'; ctx.lineWidth = Math.max(0.8, 0.08 * u); for (let r = 0; r < 3; r++) { ctx.beginPath(); ctx.moveTo(-0.25 * u, (-0.4 + r * 0.18) * u); ctx.lineTo(0.25 * u, (-0.4 + r * 0.18) * u); ctx.stroke(); } }
    if (sp.rock) { ctx.fillStyle = 'rgba(0,0,0,0.18)'; _ell(ctx, -0.1 * u, -0.2 * u, 0.14 * u, 0.22 * u); }
    // arms (swing opposite legs)
    ctx.strokeStyle = sp.skin; ctx.lineWidth = Math.max(1.3, 0.17 * u); ctx.lineCap = 'round';
    const arm = walk ? Math.sin(anim) * 0.4 : (state === 'eat' ? 0.8 + Math.sin(anim * 3) * 0.2 : 0.15);
    ctx.beginPath(); ctx.moveTo(0, -0.45 * u * sh); ctx.lineTo(0.05 * u + Math.sin(-arm) * 0.4 * u, -0.05 * u + Math.cos(arm) * 0.4 * u); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -0.45 * u * sh); ctx.lineTo(-0.05 * u + Math.sin(arm) * 0.4 * u, -0.05 * u + Math.cos(arm) * 0.4 * u); ctx.stroke();
    // head
    const hy = -0.95 * u * sh;
    ctx.fillStyle = sp.skin; _cir(ctx, 0, hy, 0.32 * u * big);
    if (sp.hair) { ctx.fillStyle = sp.hair; _ell(ctx, 0, hy - 0.15 * u, 0.34 * u * big, 0.22 * u); }
    if (sp.ears === 'pointy') { ctx.fillStyle = sp.skin; _tri(ctx, 0.28 * u, hy - 0.1 * u, 0.5 * u, hy - 0.3 * u, 0.3 * u, hy + 0.1 * u); }
    if (sp.beard) { ctx.fillStyle = sp.beard; _ell(ctx, 0, hy + 0.22 * u, 0.28 * u, 0.22 * u); }
    if (sp.horns) { ctx.fillStyle = '#3a1010'; _tri(ctx, -0.2 * u, hy - 0.2 * u, -0.34 * u, hy - 0.6 * u, -0.05 * u, hy - 0.25 * u); _tri(ctx, 0.2 * u, hy - 0.2 * u, 0.34 * u, hy - 0.6 * u, 0.05 * u, hy - 0.25 * u); }
    if (sp.tusks) { ctx.fillStyle = '#ece3cf'; _tri(ctx, 0.08 * u, hy + 0.1 * u, 0.12 * u, hy + 0.32 * u, 0.2 * u, hy + 0.12 * u); }
    _eye(ctx, 0.12 * u, hy, Math.max(1, 0.07 * u), sleeping);
    ctx.restore();
    if (sleeping) _zzz(ctx, u, anim);
  },

  // ---------------- fish / sharks / whales (in water) ----------------
  fish(ctx, sp, u, anim, state) {
    const swim = Math.sin(anim) * 0.18 * u;
    ctx.save();
    ctx.fillStyle = sp.c1;
    _ell(ctx, 0, 0, (sp.whale ? 1.3 : 1.0) * u, (sp.whale ? 0.7 : 0.55) * u);
    if (sp.belly) { ctx.fillStyle = sp.belly; _ell(ctx, 0, 0.2 * u, 0.7 * u, 0.3 * u); }
    // tail flicks
    ctx.fillStyle = sp.c1;
    _tri(ctx, -0.9 * u, 0, -1.4 * u, -0.35 * u + swim, -1.4 * u, 0.35 * u + swim);
    if (sp.fin) { _tri(ctx, 0, -0.45 * u, 0.2 * u, -0.95 * u, 0.4 * u, -0.4 * u); }       // shark dorsal
    _tri(ctx, 0.1 * u, 0.35 * u, 0.3 * u, 0.75 * u, 0.45 * u, 0.35 * u);                  // pectoral
    _eye(ctx, 0.6 * u, -0.1 * u, Math.max(1, 0.08 * u), state === 'sleep');
    if (sp.whale) { ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 0.06 * u; ctx.beginPath(); ctx.moveTo(0.2 * u, -0.5 * u); ctx.lineTo(0.2 * u, -0.8 * u); ctx.stroke(); }
    ctx.restore();
  },

  // ---------------- chickens / penguins ----------------
  bird(ctx, sp, u, anim, state) {
    const sleeping = state === 'sleep', walk = state === 'walk';
    const sw = walk ? Math.sin(anim) * 0.4 : 0;
    const bob = walk ? Math.abs(Math.sin(anim)) * 0.06 * u : 0;
    ctx.save(); ctx.translate(0, -bob);
    const legc = sp.legc || '#e0a020';
    _leg(ctx, -0.1 * u, 0.4 * u, 0.4 * u, Math.max(1, 0.1 * u), sw, legc);
    _leg(ctx, 0.1 * u, 0.4 * u, 0.4 * u, Math.max(1, 0.1 * u), -sw, legc);
    ctx.fillStyle = sp.c1; _ell(ctx, 0, 0, 0.55 * u, 0.7 * u);
    if (sp.belly) { ctx.fillStyle = sp.belly; _ell(ctx, 0.08 * u, 0.05 * u, 0.34 * u, 0.55 * u); }
    // head
    ctx.fillStyle = sp.c1; const hy = -0.7 * u;
    _cir(ctx, 0.05 * u, hy, 0.3 * u);
    if (sp.comb) { ctx.fillStyle = sp.comb; _cir(ctx, 0.0 * u, hy - 0.28 * u, 0.1 * u); _cir(ctx, 0.15 * u, hy - 0.3 * u, 0.09 * u); }
    if (sp.beak) { ctx.fillStyle = sp.beak; _tri(ctx, 0.3 * u, hy - 0.05 * u, 0.6 * u, hy + 0.03 * u, 0.3 * u, hy + 0.12 * u); }
    _eye(ctx, 0.18 * u, hy - 0.03 * u, Math.max(1, 0.07 * u), sleeping);
    if (sp.penguin) { ctx.fillStyle = sp.c1; _tri(ctx, -0.45 * u, -0.1 * u, -0.7 * u, 0.3 * u, -0.4 * u, 0.3 * u); } // flipper
    ctx.restore();
    if (sleeping) _zzz(ctx, u, anim);
  },

  // ---------------- snake ----------------
  snake(ctx, sp, u, anim, state) {
    ctx.save();
    ctx.strokeStyle = sp.c1; ctx.lineWidth = 0.45 * u; ctx.lineCap = 'round';
    const wig = state === 'sleep' ? 0.04 : 0.22;
    ctx.beginPath();
    for (let i = 0; i <= 12; i++) { const t = i / 12; const x = (-1.2 + t * 2.4) * u; const y = Math.sin(anim + t * 6) * wig * u; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke();
    // head
    const hx = 1.2 * u, hy = Math.sin(anim + 6) * wig * u;
    ctx.fillStyle = sp.c2 || sp.c1; _ell(ctx, hx, hy, 0.32 * u, 0.26 * u);
    _eye(ctx, hx + 0.12 * u, hy - 0.06 * u, Math.max(1, 0.06 * u), state === 'sleep');
    if (state !== 'sleep') { ctx.strokeStyle = '#c02a2a'; ctx.lineWidth = Math.max(0.8, 0.05 * u); ctx.beginPath(); ctx.moveTo(hx + 0.3 * u, hy); ctx.lineTo(hx + 0.5 * u, hy); ctx.stroke(); }
    ctx.restore();
  },

  // ---------------- slime blob ----------------
  blob(ctx, sp, u, anim, state) {
    const sq = 1 + Math.sin(anim * (state === 'walk' ? 2 : 0.8)) * 0.12;
    ctx.save();
    ctx.fillStyle = sp.c1; ctx.globalAlpha = 0.9;
    _ell(ctx, 0, 0.1 * u, 0.9 * u / sq, 0.7 * u * sq);
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; _ell(ctx, -0.25 * u, -0.2 * u, 0.18 * u, 0.12 * u);
    _eye(ctx, -0.15 * u, 0.05 * u, Math.max(1, 0.08 * u), state === 'sleep');
    _eye(ctx, 0.25 * u, 0.05 * u, Math.max(1, 0.08 * u), state === 'sleep');
    ctx.restore();
  },

  // ---------------- crab ----------------
  crab(ctx, sp, u, anim, state) {
    const sw = state === 'walk' ? Math.sin(anim) * 0.3 : 0;
    ctx.save();
    ctx.strokeStyle = sp.c2 || sp.c1; ctx.lineWidth = Math.max(1, 0.1 * u); ctx.lineCap = 'round';
    for (let i = -1; i <= 1; i++) { for (const sgn of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sgn * 0.4 * u, 0.1 * u); ctx.lineTo(sgn * (0.8 + 0.1 * i) * u, 0.5 * u + sw * 0.1 * u * i); ctx.stroke(); } }
    ctx.fillStyle = sp.c1; _ell(ctx, 0, 0, 0.7 * u, 0.5 * u);
    // claws
    ctx.fillStyle = sp.c2 || sp.c1; _cir(ctx, -0.85 * u, -0.1 * u, 0.22 * u); _cir(ctx, 0.85 * u, -0.1 * u, 0.22 * u);
    ctx.fillStyle = sp.c1; _eye(ctx, -0.18 * u, -0.3 * u, Math.max(1, 0.08 * u), false); _eye(ctx, 0.18 * u, -0.3 * u, Math.max(1, 0.08 * u), false);
    ctx.restore();
  },

  // ---------------- octopus ----------------
  octopus(ctx, sp, u, anim, state) {
    ctx.save();
    ctx.strokeStyle = sp.c2 || sp.c1; ctx.lineWidth = Math.max(1, 0.13 * u); ctx.lineCap = 'round';
    for (let i = -3; i <= 3; i++) { const px = i * 0.18 * u; ctx.beginPath(); ctx.moveTo(px, 0.2 * u); ctx.quadraticCurveTo(px + 0.1 * u, 0.6 * u + Math.sin(anim + i) * 0.1 * u, px + i * 0.06 * u, 0.9 * u); ctx.stroke(); }
    ctx.fillStyle = sp.c1; _ell(ctx, 0, -0.1 * u, 0.6 * u, 0.7 * u);
    _eye(ctx, -0.2 * u, -0.15 * u, Math.max(1, 0.09 * u), state === 'sleep');
    _eye(ctx, 0.2 * u, -0.15 * u, Math.max(1, 0.09 * u), state === 'sleep');
    ctx.restore();
  },
};

// derive animation state, advance phase, and draw the creature
function drawCreature(ctx, c, px, py, s, night) {
  const sp = SPRITE[c.species] || SPRITE_DEFAULT;
  let state;
  if (night && !c.justMoved && c.energy < c.maxE * 0.9) state = 'sleep';
  else if (c.justAte) state = 'eat';
  else if (c.justMoved) state = 'walk';
  else state = 'idle';
  c.animState = state;
  c.anim += state === 'walk' ? 0.4 : state === 'eat' ? 0.5 : state === 'sleep' ? 0.05 : 0.07;

  const u = s * Math.min(1.7, c.size) * (sp.big ? 0.6 : sp.small ? 0.42 : 0.5);
  ctx.save();
  ctx.translate(px, py);
  if (c.face < 0) ctx.scale(-1, 1);
  (FORMS[sp.form] || FORMS.quad)(ctx, sp, u, c.anim, state, c);
  ctx.restore();
}

const SPRITE_DEFAULT = { form: 'quad', c1: '#cccccc', headc: '#bbbbbb', ears: 'round', tail: 'none', legc: '#888' };
const SPRITE = {
  sheep:  { form: 'quad', c1: '#f3efe6', headc: '#4a4038', fluffy: true, ears: 'round', tail: 'none', legc: '#4a4038' },
  rabbit: { form: 'quad', small: true, c1: '#cfc6b8', belly: '#efe9df', headc: '#cfc6b8', ears: 'long', tail: 'tuft', legc: '#b3a999' },
  deer:   { form: 'quad', c1: '#b07a44', belly: '#e6d2af', headc: '#b07a44', ears: 'pointy', horns: true, tail: 'none', legc: '#7a5630' },
  cow:    { form: 'quad', big: true, c1: '#f1ece2', spots: '#39332e', headc: '#e6ddcf', horns: true, ears: 'round', tail: 'tuft', legc: '#cfc6b8' },
  wolf:   { form: 'quad', c1: '#8b909a', belly: '#bcbfc7', headc: '#7d828c', snoutc: '#6a6f78', ears: 'pointy', tail: 'bushy', tailc: '#7d828c', legc: '#6a6f78', snout: true },
  fox:    { form: 'quad', small: true, c1: '#d4692a', belly: '#efe6da', headc: '#d4692a', ears: 'pointy', tail: 'bushytip', tailc: '#d4692a', legc: '#3a2a20', snout: true, snoutc: '#efe6da' },
  lion:   { form: 'quad', c1: '#d9a441', mane: '#9c6320', headc: '#d9a441', ears: 'round', tail: 'tuft', legc: '#b07f30' },
  bear:   { form: 'quad', big: true, c1: '#6e4a30', headc: '#6e4a30', snoutc: '#8a6444', ears: 'round', tail: 'none', legc: '#553a26', snout: true },
  boar:   { form: 'quad', c1: '#4a3a30', headc: '#4a3a30', snoutc: '#6a5040', ears: 'pointy', tusks: true, tail: 'none', legc: '#33271f', snout: true },
  mammoth:{ form: 'quad', big: true, fluffy: true, c1: '#7a5640', headc: '#7a5640', tusks: true, trunk: true, tail: 'none', legc: '#5e4030' },
  human:  { form: 'biped', skin: '#e0a878', cloth: '#4a78c0', hair: '#3a2a1a', legc: '#39394a' },
  elf:    { form: 'biped', skin: '#dcc4a4', cloth: '#3f9f5f', hair: '#caa24a', ears: 'pointy', legc: '#2f6f43' },
  dwarf:  { form: 'biped', short: true, skin: '#d2a474', cloth: '#7a4a2a', beard: '#9c6a34', hair: '#9c6a34', legc: '#5a3a22' },
  orc:    { form: 'biped', big: true, skin: '#6fa24f', cloth: '#5a4a36', tusks: true, hair: '#2a3a1a', legc: '#46382a' },
  skeleton:{ form: 'biped', skin: '#e8e6dd', bone: true, legc: '#cfccc0' },
  demon:  { form: 'biped', big: true, skin: '#b3242c', horns: true, cloth: '#6a1418', legc: '#7a1a1e' },
  golem:  { form: 'biped', big: true, skin: '#8a8a86', rock: true, legc: '#6e6e6a' },
  fish:   { form: 'fish', c1: '#5fa8d6', belly: '#cfeaf6' },
  shark:  { form: 'fish', big: true, c1: '#6a7686', belly: '#d4dae2', fin: true },
  whale:  { form: 'fish', big: true, whale: true, c1: '#46647e', belly: '#9fb4c4' },
  chicken:{ form: 'bird', c1: '#f3efe6', comb: '#cf3a2a', beak: '#e0a020', legc: '#e0a020' },
  penguin:{ form: 'bird', penguin: true, c1: '#2b2f38', belly: '#eef2f5', beak: '#e0a020', legc: '#e0a020' },
  snake:  { form: 'snake', c1: '#5a9a4a', c2: '#3f7a34' },
  slime:  { form: 'blob', c1: '#5fbf6f' },
  crab:   { form: 'crab', c1: '#d2493a', c2: '#a8352a' },
  octopus:{ form: 'octopus', c1: '#9a4aa0', c2: '#7a3580' },
  dragon: { form: 'quad', big: true, c1: '#c0302a', headc: '#a82820', snoutc: '#8a201c', horns: true, wings: true, tail: 'tuft', legc: '#8a201c', snout: true },
};
