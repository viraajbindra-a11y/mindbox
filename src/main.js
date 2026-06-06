// main.js — wires the toolbar + camera + main loop together.
let sim, renderer, playing = true, tool = 'hand', brush = 3, following = false;
let speed = 0.5, tickAcc = 0;            // ticks per frame (fractional = slow-mo)
const SPEEDS = [0.1, 0.25, 0.5, 1, 2, 3, 5, 8, 12, 16];   // Speed slider presets

// which tools paint terrain (drag-paint) vs. fire one-shot disasters
const TERRAIN = { land: 'raise', water: 'water', mountain: 'mountain',
                  forest: 'forest', grass: 'grass', sand: 'sand',
                  desert: 'desert', jungle: 'jungle', swamp: 'swamp', snow: 'snow', mushroom: 'mushroom' };
const ONESHOT = new Set(['meteor', 'bomb', 'lightning', 'tornado', 'volcano', 'tsunami', 'plague', 'blessing', 'summon']);

function init() {
  sim = new Simulation();
  renderer = new Renderer(document.getElementById('view'));
  setupUI();
  requestAnimationFrame(loop);
}

function loop() {
  if (playing) {
    tickAcc += speed;                    // accumulate fractional speed → slow-mo or fast-forward
    let n = 0;
    while (tickAcc >= 1 && n < 64) { sim.tick(); tickAcc -= 1; n++; }
  }
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
  conns(0, b.Wxh, ni, nh);
  conns(1, b.Wha, nh, no);

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
  set('stat-structs', s.structs);
  renderCensus(s.census);
  renderBuilds(s.structCensus);
  renderKingdoms();
}

function renderKingdoms() {
  const sec = document.getElementById('kingdoms-sec');
  const list = Kingdoms.list.slice().sort((a, b) => b.pop - a.pop).slice(0, 8);
  if (!list.length) { sec.style.display = 'none'; return; }
  sec.style.display = 'block';
  document.getElementById('kingdom-count').textContent = '(' + Kingdoms.list.length + ')';
  const SP = { human: '🧑', elf: '🧝', dwarf: '🧔', orc: '👹' };
  document.getElementById('kingdoms').innerHTML = list.map(k => {
    const wars = Object.keys(k.relations).filter(id => k.relations[id] === 'war' && Kingdoms.byId[id]).length;
    const allies = Object.keys(k.relations).filter(id => k.relations[id] === 'ally' && Kingdoms.byId[id]).length;
    const siege = k.siege > 0 ? ` <span class="kwar">🛡${Math.min(100, (k.siege / 50 * 100) | 0)}%</span>` : '';
    const age = (k.tech != null) ? Meta.ageOf(k) : null;
    const faith = k.religion ? ` ${k.religion.symbol}` : '';
    const tip = k.culture ? ` title="${age ? age.name : ''} · ${k.culture.trait} · “${k.culture.motto}” · ${k.religion.name}"` : '';
    return `<div class="krow"${tip}><span class="ksw" style="background:${k.color}"></span>` +
      `<b>${SP[k.species] || ''} ${k.name}</b>${faith}<span class="kpop"> ·${k.pop}</span>` +
      (age ? `<span class="kage"> ${age.emoji}</span>` : '') +
      (allies ? `<span class="kally"> 🤝${allies}</span>` : '') +
      (wars ? `<span class="kwar"> ⚔${wars}</span>` : '') + siege + `</div>`;
  }).join('');
  renderMeta();
  renderHistory();
}

function renderMeta() {
  const sec = document.getElementById('meta-sec');
  const list = Kingdoms.list.filter(k => k.culture).sort((a, b) => b.pop - a.pop).slice(0, 6);
  if (!list.length) { sec.style.display = 'none'; return; }
  sec.style.display = 'block';
  document.getElementById('meta').innerHTML = list.map(k => {
    const age = Meta.ageOf(k), c = k.culture, r = k.religion;
    return `<div class="mrow"><span class="ksw" style="background:${k.color}"></span>` +
      `<b>${k.name}</b> <span class="mage">${age.emoji} ${age.name}</span>` +
      `<div class="msub">${c.trait} · ${c.art} · “${c.motto}” · <i>${c.hello}!</i></div>` +
      `<div class="msub">${r.symbol} ${r.name} — ${r.deity} · ${r.tenet}</div></div>`;
  }).join('');
}

function renderHistory() {
  const sec = document.getElementById('history-sec');
  const ev = Kingdoms.events || [];
  if (!ev.length) { sec.style.display = 'none'; return; }
  sec.style.display = 'block';
  document.getElementById('history').innerHTML = ev.slice(0, 8).map(e => `<div class="hrow">${e}</div>`).join('');
}

function renderBuilds(sc) {
  const sec = document.getElementById('builds-sec');
  const entries = Object.entries(sc).sort((a, b) => b[1] - a[1]).slice(0, 16);
  if (!entries.length) { sec.style.display = 'none'; return; }
  sec.style.display = 'block';
  document.getElementById('builds').innerHTML = entries
    .map(([label, n]) => `<span class="cspecies">${label} ${n}</span>`).join('');
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
  const speedEl = document.getElementById('slider-speed'), speedLbl = document.getElementById('val-speed');
  const applySpeed = () => { speed = SPEEDS[parseInt(speedEl.value) - 1] || 1; if (speedLbl) speedLbl.textContent = speed + '×'; };
  speedEl.oninput = applySpeed; applySpeed();
  bindSlider('food', v => { CONFIG.foodGrowth = v / 1000; });
  bindSlider('mut', v => { CONFIG.mutationRate = v / 100; });

  setupCanvas();
  setupCraft();
}

function setupCraft() {
  const $ = id => document.getElementById(id);
  Craft.init();

  const fillItems = () => {
    const names = Object.keys(Craft.items).sort();
    const opts = names.map(n => `<option value="${n}">${Craft.items[n].emoji} ${n}</option>`).join('');
    const a = $('craft-a'), b = $('craft-b'), av = a.value, bv = b.value;
    a.innerHTML = opts; b.innerHTML = opts;
    if (names.includes(av)) a.value = av; if (names.includes(bv)) b.value = bv;
    $('craft-count').textContent = '(' + Craft.count() + ')';
  };
  const renderLog = () => {
    $('craft-log').innerHTML = Craft.log.slice(0, 14)
      .map(e => `<span class="cspecies" title="${e.a} + ${e.b}">${e.emoji} ${e.r}</span>`).join('');
  };
  const msg = t => { $('ollama-msg').textContent = t || ''; };
  fillItems(); renderLog();

  const ms = $('ollama-model');
  const fillModels = () => {
    ms.innerHTML = OLLAMA_MODELS.map(m =>
      `<option value="${m.name}">${m.label} — ${m.note}${Ollama.models.includes(m.name) ? ' ✓' : ''}</option>`).join('') +
      Ollama.models.filter(m => !OLLAMA_MODELS.some(o => o.name === m))
        .map(m => `<option value="${m}">${m} (installed)</option>`).join('');
    ms.value = Ollama.model;
  };
  ms.onchange = () => Ollama.setModel(ms.value);

  const refresh = () => {
    $('ollama-dot').className = 'dot ' + (Ollama.online ? 'on' : 'off');
    $('ollama-dot').title = Ollama.online ? 'AI online (' + Ollama.model + ')' : 'AI offline — using built-in fallback recipes';
    $('btn-ollama-install').style.display = (Ollama.isDesktop() && !Ollama.installed) ? '' : 'none';
    fillModels();
  };
  fillModels();
  Ollama.check().then(refresh);

  $('btn-ollama-connect').onclick = () => { msg('Checking…'); Ollama.check().then(() => { refresh();
    msg(Ollama.online ? 'AI online ✓' : (Ollama.isDesktop() ? 'No AI yet — click Install AI.' : 'No Ollama found. Run:  OLLAMA_ORIGINS=* ollama serve')); }); };
  $('btn-ollama-install').onclick = () => { msg('Installing the local AI… (first time can take a minute)');
    Ollama.install(line => msg(line)).then(() => Ollama.check()).then(() => { refresh();
      msg(Ollama.installed ? 'Installed ✓ — pick a model and click Get.' : 'Couldn’t auto-install — get it from ollama.com.'); })
      .catch(e => msg('Install failed: ' + e.message)); };
  $('btn-ollama-pull').onclick = () => { const m = ms.value; msg('Downloading ' + m + '…');
    Ollama.pull(m, line => msg(line)).then(() => Ollama.check()).then(() => { Ollama.setModel(m); refresh(); msg('Ready: ' + m + ' ✓'); })
      .catch(e => msg('Download failed: ' + e.message)); };

  $('btn-combine').onclick = async () => {
    const a = $('craft-a').value, b = $('craft-b').value;
    if (!a || !b) return;
    $('craft-result').textContent = '…';
    const r = await Craft.combine(a, b);
    if (r) $('craft-result').textContent = `${Craft.items[a].emoji} + ${Craft.items[b].emoji} = ${r.emoji} ${r.name}`;
    fillItems(); renderLog();
  };

  $('director-on').onchange = e => { Director.enabled = e.target.checked; };

  let timer = null;
  $('craft-auto').onchange = e => {
    if (timer) { clearInterval(timer); timer = null; }
    if (e.target.checked) timer = setInterval(async () => {
      const r = await Craft.experiment();
      if (r) { fillItems(); renderLog(); }
    }, Ollama.online ? 3500 : 1400);
  };
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
  // bind to the VISIBLE display canvas, not renderer.canvas (the offscreen low-res
  // buffer, which isn't in the DOM — listeners there never fire). screenToTile/zoomAt/
  // pan all take display-space coords, so the display rect is the right reference too.
  const canvas = renderer.display;
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
    renderer.zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1 : -1);
  }, { passive: false });
}

window.addEventListener('DOMContentLoaded', init);
