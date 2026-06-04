// main.js — wires the toolbar + camera + main loop together.
let sim, renderer, playing = true, tool = 'hand', brush = 3;

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
  renderer.draw(sim);
  updateHUD();
  requestAnimationFrame(loop);
}

function updateHUD() {
  const s = sim.stats();
  set('stat-tick', s.tick);
  set('stat-pop', s.pop);
  set('stat-grazers', s.grazers);
  set('stat-hunters', s.hunters);
  set('stat-gen', s.maxGen);
  set('stat-oldest', s.oldest);
  set('stat-born', s.born);
  set('stat-died', s.died);
}
function set(id, v) { document.getElementById(id).textContent = v; }

function setupUI() {
  const playBtn = document.getElementById('btn-play');
  playBtn.onclick = () => { playing = !playing; playBtn.textContent = playing ? '⏸ Pause' : '▶ Play'; };
  document.getElementById('btn-reset').onclick = () => sim.reset();

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
    else if (tool === 'grazer') sim.spawnAt('grazer', tx, ty);
    else if (tool === 'hunter') sim.spawnAt('hunter', tx, ty);
    else if (tool === 'smite') sim.smite(tx, ty, brush);
    else if (isDown && ONESHOT.has(tool)) sim[tool](tx, ty);
  };

  canvas.addEventListener('mousedown', e => {
    last = { x: e.clientX, y: e.clientY };
    if (e.button === 2 || tool === 'hand') { pan = true; }
    else { lmb = true; apply(e, true); }
  });
  window.addEventListener('mousemove', e => {
    if (pan && last) { renderer.pan(e.clientX - last.x, e.clientY - last.y); last = { x: e.clientX, y: e.clientY }; }
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
