// meta.js — the META layer: culture, religion, language and TECH AGES.
// Every kingdom grows a personality. It advances through Ages (Stone → Bronze →
// … → Arcane) as its people and cities grow — more advanced realms field bigger,
// stronger armies and snowball into empires. It carries a Culture (a trait, an art
// style, a motto) and a Religion (a faith, a deity, a holy symbol, a tenet). Faiths
// spread to weaker neighbours and clash in holy wars. The local LLM writes each
// civilization's identity and even a word of its language; procedural seeds fill in
// instantly and offline. This is the "meta" half of WorldBox — history, not biology.

// --- technology ages: a realm climbs these as it grows ---
const AGES = [
  { name: 'Stone Age',     emoji: '🪨', need: 0 },
  { name: 'Bronze Age',    emoji: '⚒️', need: 11 },
  { name: 'Iron Age',      emoji: '🗡️', need: 19 },
  { name: 'Classical Age', emoji: '🏛️', need: 29 },
  { name: 'Feudal Age',    emoji: '🏰', need: 43 },
  { name: 'Renaissance',   emoji: '🎨', need: 62 },
  { name: 'Industrial Age',emoji: '🏭', need: 88 },
  { name: 'Arcane Age',    emoji: '🔮', need: 120 },
];

// procedural seeds — instant + offline, themed loosely per species
const CULT_TRAIT = ['proud', 'curious', 'warlike', 'peaceful', 'mystic', 'cunning', 'stoic', 'wandering', 'devout', 'industrious', 'honourable', 'secretive'];
const CULT_ART = ['carvings', 'tapestry', 'song', 'masonry', 'runes', 'mosaics', 'totems', 'frescoes', 'ironwork', 'glasswork'];
const CULT_MOTTO = ['Strength in stone', 'The dawn is ours', 'None shall pass', 'Roots run deep', 'By tooth and will', 'The old ways hold', 'Rise, then rise again', 'Blood remembers', 'Forge the future', 'We endure'];
const FAITH_NAME = ['the Old Light', 'the Deep Root', 'the Ember Path', 'the Tide Creed', 'the Stone Pact', 'the Sky Choir', 'the Ash Faith', 'the Green Word', 'the Iron Vow', 'the Dusk Order'];
const FAITH_DEITY = ['Aurel', 'Mograth', 'Sylphine', 'Tor', 'Vael', 'Umbra', 'Kethen', 'Brigga', 'Nox', 'Solenne'];
const FAITH_SYMBOL = ['☀️', '🌙', '🔥', '🌊', '⛰️', '🌳', '⭐', '🦴', '⚜️', '🕯️'];
const FAITH_TENET = ['the strong shall shelter the weak', 'all things return to the soil', 'the flame must never die', 'honour the tides and the dead', 'what is forged cannot be broken', 'wander far, fear nothing', 'the night hides the true name', 'grow, and let others grow'];
const HELLO = ['Vaela', 'Khorin', 'Suun', 'Brakka', 'Lithil', 'Oroth', 'Senn', 'Draum', 'Ylla', 'Korr'];

const Meta = {
  pending: false,

  // give a brand-new kingdom an instant identity (procedural; LLM enriches later)
  seed(k) {
    if (k.culture) return;
    const r = (n) => Math.floor((k.id * 2654435761) % 1000 / 1000 * n) % n; // id-stable pick
    k.tech = 0;
    k.might = 1; k.armyCap = 8;
    k.culture = {
      trait: CULT_TRAIT[(r(CULT_TRAIT.length) + k.id) % CULT_TRAIT.length],
      art: CULT_ART[(k.id * 3) % CULT_ART.length],
      motto: CULT_MOTTO[(k.id * 7) % CULT_MOTTO.length],
      hello: HELLO[(k.id * 5) % HELLO.length],
      llm: false,
    };
    k.religion = {
      name: FAITH_NAME[(k.id * 5) % FAITH_NAME.length],
      deity: FAITH_DEITY[(k.id * 11) % FAITH_DEITY.length],
      symbol: FAITH_SYMBOL[(k.id * 13) % FAITH_SYMBOL.length],
      tenet: FAITH_TENET[(k.id * 17) % FAITH_TENET.length],
      llm: false,
    };
  },

  ageOf(k) { return AGES[k.tech || 0]; },

  update(sim) {
    const ks = Kingdoms.list;
    if (!ks.length) return;
    for (const k of ks) this.seed(k);

    // count developed cities per realm in ONE pass over the map
    const structOwner = {};
    const struct = sim.world && sim.world.struct, terr = Kingdoms.territory;
    if (struct && terr) {
      for (let i = 0; i < struct.length; i++) {
        if (struct[i] < 0) continue;
        const o = terr[i];
        if (o) structOwner[o] = (structOwner[o] || 0) + 1;
      }
    }

    // advance technology ages
    for (const k of ks) {
      const score = (k.pop || 0) + 2 * (structOwner[k.id] || 0) + Math.floor((k.age || 0) / 30) + 3 * (k.conquests || 0);
      let t = k.tech || 0;
      while (t < AGES.length - 1 && score >= AGES[t + 1].need) {
        t++;
        Kingdoms.log(`${AGES[t].emoji} ${k.name} entered the ${AGES[t].name}`);
      }
      k.tech = t;
      k.might = 1 + t * 0.18;            // advanced realms hit harder in sieges
      k.armyCap = Math.min(26, 8 + t * 2); // …and field bigger armies
    }

    // faith: holy wars between neighbours of different religions; the strong convert the weak
    this._faith(ks);

    // let the LLM flesh out one realm's culture & religion per pass
    if (typeof Ollama !== 'undefined' && Ollama.online && !this.pending) {
      const need = ks.find(k => k.culture && !k.culture.llm);
      if (need) this._llm(need);
    }
  },

  _faith(ks) {
    for (let i = 0; i < ks.length; i++)
      for (let j = i + 1; j < ks.length; j++) {
        const a = ks[i], b = ks[j];
        const near = (a.cx - b.cx) ** 2 + (a.cy - b.cy) ** 2 < 55 * 55;
        if (!near || !a.religion || !b.religion) continue;
        const same = a.religion.name === b.religion.name;
        if (same) continue;
        // holy war: occasionally two faiths come to blows
        if (a.relations[b.id] !== 'war' && Math.random() < 0.06) {
          a.relations[b.id] = 'war'; b.relations[a.id] = 'war';
          Kingdoms.log(`${a.religion.symbol} Holy war — ${a.name} (${a.religion.name}) vs ${b.name} (${b.religion.name})`);
        }
        // conversion: a much larger realm spreads its faith to a weaker neighbour
        const big = a.pop >= b.pop * 1.6 ? a : (b.pop >= a.pop * 1.6 ? b : null);
        if (big && Math.random() < 0.04) {
          const small = big === a ? b : a;
          small.religion = { name: big.religion.name, deity: big.religion.deity, symbol: big.religion.symbol, tenet: big.religion.tenet, llm: big.religion.llm };
          Kingdoms.log(`🙏 ${small.name} converted to ${big.religion.name}`);
        }
      }
  },

  async _llm(k) {
    this.pending = true;
    try {
      const sys = 'You are a worldbuilder for a fantasy sandbox. Invent a CULTURE and RELIGION for one kingdom. ' +
        'Reply ONLY compact JSON, no prose: ' +
        '{"trait":"one adjective","art":"one art-form word","motto":"under 6 words","faith":"faith name 1-2 words",' +
        '"deity":"god name 1-2 words","symbol":"ONE emoji","tenet":"a belief under 8 words","hello":"an invented greeting word"}.';
      const usr = `The kingdom ${k.name}, a realm of ${k.species}s, currently in the ${this.ageOf(k).name}.`;
      const out = await Ollama.chat(sys, usr, { json: true, temperature: 1.05, maxTokens: 160 });
      const m = out.match(/\{[\s\S]*\}/);
      if (m && Kingdoms.byId[k.id]) {
        const j = JSON.parse(m[0]);
        if (j.trait) k.culture.trait = String(j.trait).slice(0, 16);
        if (j.art) k.culture.art = String(j.art).slice(0, 18);
        if (j.motto) k.culture.motto = String(j.motto).slice(0, 40);
        if (j.hello) k.culture.hello = String(j.hello).replace(/["'.,!]/g, '').slice(0, 16);
        if (j.faith) k.religion.name = String(j.faith).slice(0, 22);
        if (j.deity) k.religion.deity = String(j.deity).slice(0, 18);
        if (j.symbol) { const s = [...String(j.symbol).trim()][0]; if (s) k.religion.symbol = s; }
        if (j.tenet) k.religion.tenet = String(j.tenet).slice(0, 50);
        k.culture.llm = true; k.religion.llm = true;
      }
    } catch (e) {
    } finally { this.pending = false; }
  },

  // a faith-flavoured line for the world director's context
  summary() {
    const faiths = {};
    for (const k of Kingdoms.list) if (k.religion) faiths[k.religion.name] = (faiths[k.religion.name] || 0) + (k.pop || 0);
    const top = Object.entries(faiths).sort((a, b) => b[1] - a[1]).slice(0, 3).map(f => f[0]);
    return top.length ? `Faiths: ${top.join(', ')}.` : '';
  },
};
