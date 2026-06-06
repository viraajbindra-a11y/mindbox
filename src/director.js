// director.js — the LOCAL LLM as the world's god-storyteller.
// Every so often it's handed a summary of the world (kingdoms, season, recent
// history) and chooses ONE event to make happen — a plague, a bandit raid, a
// summoned monster, a blessing, a meteor — or peace. It targets a real kingdom
// and writes a dramatic reason into the world-history log. Offline, a random
// fallback keeps the drama going. This is "the AI runs the world."

const DIRECTOR_SYS =
  'You are the god-storyteller directing a living fantasy world of kingdoms and creatures. ' +
  'Each turn you choose ONE event to make happen, or let there be peace. Aim for drama and ' +
  'consequences, but keep the world alive (do not wipe everyone out). ' +
  'Reply ONLY compact JSON: {"action":"one of: plague, raid, monster, blessing, meteor, peace",' +
  '"target":"a kingdom name from the list, or random","reason":"one short dramatic sentence"}.';

const DIRECTOR_ICON = { plague: '☠️', raid: '⚔️', monster: '🐉', blessing: '✨', meteor: '☄️', peace: '🕊️' };

const Director = {
  enabled: false,
  busy: false,

  async consider(sim) {
    if (!this.enabled || this.busy) return;
    if (typeof Ollama === 'undefined' || !Ollama.online) { this._fallback(sim); return; }
    this.busy = true;
    try {
      const out = await Ollama.chat(DIRECTOR_SYS, this._summary(sim), { json: true, temperature: 1.0, maxTokens: 150 });
      const m = out.match(/\{[\s\S]*\}/);
      if (m) this._exec(sim, JSON.parse(m[0]));
    } catch (e) {
    } finally { this.busy = false; }
  },

  _summary(sim) {
    const ks = Kingdoms.list.slice().sort((a, b) => b.pop - a.pop).slice(0, 8);
    const lines = ks.map(k => `${k.name} (${k.species}, pop ${k.pop})`).join('; ');
    const st = sim.stats();
    const faith = (typeof Meta !== 'undefined' && Meta.summary) ? ' ' + Meta.summary() : '';
    return `Season ${seasonAt(sim.tickCount).name}, year ${yearNumber(sim.tickCount)}. ` +
      `World population ${st.pop}. Kingdoms: ${lines || 'none yet'}.${faith} ` +
      `Recent events: ${(Kingdoms.events || []).slice(0, 3).join(' / ') || 'all quiet'}. What happens next?`;
  },

  _targetCapital(sim, name) {
    if (name && name !== 'random') {
      const k = Kingdoms.list.find(k => k.name.toLowerCase() === String(name).toLowerCase());
      if (k) return [k.cx, k.cy];
    }
    const k = Kingdoms.list[(Math.random() * Kingdoms.list.length) | 0];
    if (k) return [k.cx, k.cy];
    return [(sim.world.w * Math.random()) | 0, (sim.world.h * Math.random()) | 0];
  },

  _exec(sim, a) {
    const act = String(a.action || '').toLowerCase();
    if (!DIRECTOR_ICON[act]) return;
    const [cx, cy] = this._targetCapital(sim, a.target);
    if (act === 'plague') sim.plague(cx, cy, 6);
    else if (act === 'raid') sim.raid(cx, cy);
    else if (act === 'monster') sim.summon(cx, cy);
    else if (act === 'blessing') sim.blessing(cx, cy, 7);
    else if (act === 'meteor') sim.meteor(cx, cy);
    // 'peace' → nothing
    const reason = (cleanLLM(a.reason) || act).slice(0, 120);   // keep crude narration out of the history log
    Kingdoms.log(`${DIRECTOR_ICON[act]} ${reason}`);
  },

  // offline: an occasional random event so the world still has drama
  _fallback(sim) {
    if (Math.random() > 0.4 || !Kingdoms.list.length) return;
    const k = Kingdoms.list[(Math.random() * Kingdoms.list.length) | 0];
    const acts = ['plague', 'raid', 'monster', 'blessing', 'meteor'];
    const act = acts[(Math.random() * acts.length) | 0];
    this._exec(sim, { action: act, target: k.name, reason: `${act} befalls ${k.name}` });
  },
};
