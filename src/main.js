// main.js — wires the toolbar + camera + main loop together.
let sim, renderer, playing = true, tool = 'hand', brush = 3, following = false;

// which tools paint terrain (drag-paint) vs. fire one-shot disasters
const TERRAIN = { land: 'raise', water: 'water', mountain: 'mountain',
                  forest: 'forest', grass: 'grass', sand: 'sand' };
const ONESHOT = new Set(['meteor', 'bomb', 'lightning']);

function init() {
  sim = new Simulation();
  renderer = new Renderer(document.getElementById('view'));
  setupUI();
  requestAnimationFrame(loop);
}

function loop() {
  if (playing)
    for (let i = 0; i < CONFIG.ticksPerFrame; i++) sim.tick();
  if (following && sim.selected && sim.selected.alive)
    renderer.centerOn(sim.selected.x, sim.selected.y);
  renderer.draw(sim);
  updateHUD();
  drawChart();
  updateInspector();
  requestAnimationFrame(loop);
}

function drawChart() {
  const cv = document.getElementById('chart');
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);
  const hist = sim.history;
  if (hist.length < 2) return;
  let maxV = CONFIG.minHunters + 10;
  for (const p of hist) { if (p[0] > maxV) maxV = p[0]; if (p[1] > maxV) maxV = p[1]; }
  const n = hist.length;
  const plot = (idx, color) => {
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * W;
      const y = H - 2 - (hist[i][idx] / maxV) * (H - 4);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  };
  plot(0, '#7fd1a6'); // grazers
  plot(1, '#e06a6a'); // hunters
}

function updateInspector() {
  const sec = document.getElementById('inspector');
  const sel = sim.selected;
  if (!sel) { sec.style.display = 'none'; return; }
  sec.style.display = 'block';
  const info = document.getElementById('insp-info');
  if (!sel.alive) {
    info.innerHTML = '☠ <b>this mind has died</b><br>' +
      '<span style="color:#7c8699">its descendants may still carry its brain</span>';
    document.getElementById('brain').getContext('2d').clearRect(0, 0, 248, 150);
    return;
  }
  info.innerHTML = `${sel.def.emoji} <b>${sel.def.name}</b> &nbsp;·&nbsp; gen ${sel.generation}<br>` +
    `energy ${sel.energy.toFixed(0)} &nbsp;·&nbsp; age ${sel.age} &nbsp;·&nbsp; size ${sel.size.toFixed(2)}`;
  drawBrain(sel);
}

function drawBrain(c) {
  const cv = document.getElementById('brain');
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);
  const b = c.brain;
  const [ni, nh, no] = b.layers;
  const acts = b.trace(c.sense(sim.world, sim));   // [inputs, hidden, action probabilities]
  const sizes = [ni, nh, no];
  const colX = l => 16 + (W - 32) * (l / 2);        // three columns
  const nodeY = (l, i) => { const n = sizes[l]; return 12 + (H - 24) * (n === 1 ? 0.5 : i / (n - 1)); };

  const conns = (from, w, inN, outN) => {
    for (let i = 0; i < inN; i++) {
      const x1 = colX(from), y1 = nodeY(from, i);
      for (let o = 0; o < outN; o++) {
        const wt = w[i * outN + o];
        const a = Math.min(0.5, Math.abs(wt) * 0.5);
        if (a < 0.04) continue;
        ctx.strokeStyle = wt > 0 ? `rgba(110,200,150,${a})` : `rgba(220,110,90,${a})`;
        ctx.lineWidth = 0.6;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(colX(from + 1), nodeY(from + 1, o)); ctx.stroke();
      }
    }
  };
  conns(0, b.W1, ni, nh);
  conns(1, b.W2, nh, no);

  for (let l = 0; l < 3; l++) {
    for (let i = 0; i < sizes[l]; i++) {
      const v = Math.max(-1, Math.min(1, acts[l][i]));
      ctx.fillStyle = v >= 0
        ? `rgb(${(50 + 20 * v) | 0},${(120 + 110 * v) | 0},${(95 + 40 * v) | 0})`
        : `rgb(${(150 + 80 * -v) | 0},80,70)`;
      ctx.beginPath(); ctx.arc(colX(l), nodeY(l, i), 3.1, 0, 6.283); ctx.fill();
    }
  }

  const labels = ['↑', '↓', '←', '→'];
  ctx.fillStyle = '#9aa4b6'; ctx.font = '9px monospace';
  for (let o = 0; o < no; o++) ctx.fillText(labels[o] || '', W - 11, nodeY(2, o) + 3);
  // ring the action it's currently most likely to pick
  let best = 0; for (let k = 1; k < no; k++) if (acts[2][k] > acts[2][best]) best = k;
  ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(colX(2), nodeY(2, best), 5, 0, 6.283); ctx.stroke();
}

function updateHUD() {
  const s = sim.stats();
  set('stat-tick', s.tick);
  const seas = seasonAt(s.tick);
  set('stat-season', seas.emoji + ' ' + seas.name);
  set('stat-year', yearNumber(s.tick));
  set('stat-pop', s.pop);
  set('stat-gen', s.maxGen);
  set('stat-size', s.avgSize.toFixed(2));
  set('stat-vision', s.avgVision.toFixed(1));
  set('stat-oldest', s.oldest);
  set('stat-born', s.born);
  set('stat-died', s.died);
  renderCensus(s.census);
}

function renderCensus(census) {
  const rows = SPECIES_LIST
    .map(d => ({ d, n: census[d.key] || 0 }))
    .sort((a, b) => b.n - a.n);
  document.getElementById('census').innerHTML = rows.map(r =>
    `<span class="cspecies${r.n ? '' : ' zero'}" title="${r.d.name}">${r.d.emoji} ${r.n}</span>`
  ).join('');
}

function buildPalette() {
  document.getElementById('species-palette').innerHTML = SPECIES_LIST.map(d =>
    `<button class="spbtn" data-tool="spawn:${d.key}" title="Spawn ${d.name}">${d.emoji}</button>`
  ).join('');
}
function set(id, v) { document.getElementById(id).textContent = v; }

function flashBtn(id, text) {
  const b = document.getElementById(id);
  const old = b.textContent;
  b.textContent = text;
  setTimeout(() => { b.textContent = old; }, 1100);
}

function setupUI() {
  buildPalette();   // must run before we wire [data-tool] buttons
  const playBtn = document.getElementById('btn-play');
  playBtn.onclick = () => { playing = !playing; playBtn.textContent = playing ? '⏸ Pause' : '▶ Play'; };
  document.getElementById('btn-reset').onclick = () => sim.reset();

  document.getElementById('btn-save').onclick = () => {
    try {
      localStorage.setItem('mindbox_save', sim.serialize());
      flashBtn('btn-save', '✓ Saved');
    } catch (e) { alert('Save failed: ' + e.message); }
  };
  document.getElementById('btn-load').onclick = () => {
    const s = localStorage.getItem('mindbox_save');
    if (!s) { alert('No saved world yet — hit 💾 Save first.'); return; }
    try { sim.load(s); flashBtn('btn-load', '✓ Loaded'); }
    catch (e) { alert('Load failed: ' + e.message); }
  };

  document.querySelectorAll('[data-tool]').forEach(btn => {
    btn.onclick = () => selectTool(btn.dataset.tool);
  });
  selectTool('hand');

  bindSlider('brush', v => { brush = v; }, 'brush');
  bindSlider('speed', v => { CONFIG.ticksPerFrame = v; });
  bindSlider('food', v => { CONFIG.foodGrowth = v / 1000; });
  bindSlider('mut', v => { CONFIG.mutationRate = v / 100; });

  setupCanvas();
}

function bindSlider(id, apply, labelId) {
  const el = document.getElementById('slider-' + id);
  const label = document.getElementById('val-' + id);
  const update = () => { apply(parseFloat(el.value)); if (label) label.textContent = el.value; };
  el.oninput = update;
  update();
}

function selectTool(t) {
  tool = t;
  document.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('active', b.dataset.tool === t));
}

function setupCanvas() {
  const canvas = renderer.canvas;
  let lmb = false, pan = false, last = null;

  const apply = (e, isDown) => {
    const r = canvas.getBoundingClientRect();
    const { tx, ty } = renderer.screenToTile(e.clientX - r.left, e.clientY - r.top);
    if (!sim.world.inBounds(tx, ty)) return;
    if (TERRAIN[tool]) sim.world.terraform(tx, ty, brush, TERRAIN[tool]);
    else if (tool === 'fire') sim.fireTool(tx, ty, Math.min(brush, 2));
    else if (tool.startsWith('spawn:')) sim.spawnAt(tool.slice(6), tx, ty);
    else if (tool === 'smite') sim.smite(tx, ty, brush);
    else if (tool === 'inspect') { sim.selectAt(tx, ty); if (sim.selected) following = true; }
    else if (isDown && ONESHOT.has(tool)) sim[tool](tx, ty);
  };

  canvas.addEventListener('mousedown', e => {
    last = { x: e.clientX, y: e.clientY };
    if (e.button === 2 || tool === 'hand') { pan = true; }
    else { lmb = true; apply(e, true); }
  });
  window.addEventListener('mousemove', e => {
    if (pan && last) { renderer.pan(e.clientX - last.x, e.clientY - last.y); last = { x: e.clientX, y: e.clientY }; following = false; }
    else if (lmb) apply(e, false);
  });
  window.addEventListener('mouseup', () => { lmb = false; pan = false; last = null; });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    renderer.zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.12 : 0.89);
  }, { passive: false });
}

window.addEventListener('DOMContentLoaded', init);
