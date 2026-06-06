// config.js — every tunable number in one place. UI sliders edit these live.

// biome ids (defined here so species.js, world.js and render.js can all use them)
const B = {
  DEEP: 0, SHALLOW: 1, SAND: 2, GRASS: 3,
  FOREST: 4, SAVANNA: 5, ROCK: 6, SNOW: 7,
  // WorldBox-style biomes:
  SWAMP: 8, JUNGLE: 9, DESERT: 10, TUNDRA: 11, TAIGA: 12, MUSHROOM: 13,
};

const CONFIG = {
  // --- world / drawing ---
  gridW: 160,
  gridH: 100,
  cell: 6,                // base pixels per tile (camera can zoom)

  // --- starting life ---
  startGrazers: 90,
  startHunters: 14,
  minGrazers: 12,         // immigration floor so the world never fully dies
  minHunters: 6,          // keep predators around so the food chain persists
  maxPop: 720,            // hard safety cap on total creatures
  capScale: 0.24,         // scales every species' cap. Lower = fewer creatures,
                          // more food per creature, longer lives, far less churn
                          // (an overcrowded world looks chaotic — this calms it)

  // --- senses ---
  visionRadius: 5,

  // --- energy ---
  startEnergy: 70,
  maxEnergy: 160,
  metabolism: 0.16,       // grazer cost of living per tick
  hunterMetabolism: 0.20, // hunters burn more
  moveCost: 0.04,
  foodValue: 30,          // energy a grazer gets from a full plant tile
  preyEnergy: 70,         // energy a hunter gets from eating a grazer

  // --- reproduction ---
  reproduceThreshold: 100,
  reproduceCost: 70,
  maxAge: 3000,

  // --- plants ---
  foodStart: 0.4,
  foodGrowth: 0.009,

  // --- evolution / learning ---
  mutationRate: 0.12,
  mutationAmount: 0.35,
  hueDrift: 8,

  // brain: 20 senses -> 16 recurrent hidden -> 4 move actions (recurrent actor-critic)
  brainLayers: [20, 16, 4],

  // online reinforcement learning — how each creature trains its own brain in life
  learn: {
    lr: 0.08,            // how fast the policy updates
    traceDecay: 0.88,    // how far back credit for a reward reaches (memory of recent moves)
    baselineLR: 0.02,    // how fast its "expected reward" adapts
    weightDecay: 0.0006, // keeps weights from blowing up
    rewardScale: 0.05,   // scales the energy-change reward
    threatPenalty: 0.5,  // dislike of sitting next to a predator (teaches fleeing)
  },

  // --- fire / disasters ---
  fireDuration: 26,
  fireDamage: 16,
  fireSpread: 0.20,

  // --- plague (a spreading sickness) ---
  plagueDamage: 0.5,      // energy lost per tick while infected
  plagueSpread: 0.05,     // chance per tick to infect an adjacent creature
  plagueDuration: 500,    // ticks an infection lasts

  // --- AI world director ---
  directorEvery: 700,     // ticks between the LLM director's decisions

  // --- atmosphere ---
  dayLength: 1200,        // ticks per full day/night cycle
  yearLength: 4800,       // ticks per year (4 seasons, ~one day each)

  // --- resources & building (sapients gather wood/stone and build structures) ---
  gatherRate: 0.6,        // resource gained per tick next to a tree / ore
  invMax: 40,             // max wood or stone a creature carries
  oreChance: 0.22,        // fraction of mountain tiles that hold ore
  treeRegrow: 0.0010,     // chance a forest tile regrows a tree each tick
  buildRadius: 7,         // how near a village/kin must be to build
  buildThreshold: 8,      // total resources a builder pours in to make a building
  buildCooldown: 60,      // ticks a builder waits between builds
  farmFood: 0.05,         // food a farm tops up on nearby tiles each tick

  // --- speed ---
  ticksPerFrame: 2,       // sim steps per frame; lower = calmer, easier to follow
};

// --- seasons (a year is 4 seasons) ---
// food: how fast plants grow this season; tint/strength: how the land is recoloured
const SEASONS = [
  { name: 'Spring', emoji: '🌱', food: 1.25, tint: [120, 200, 110], strength: 0.16 },
  { name: 'Summer', emoji: '☀️', food: 1.10, tint: [205, 200, 90],  strength: 0.10 },
  { name: 'Autumn', emoji: '🍂', food: 0.70, tint: [178, 110, 48],  strength: 0.34 },
  { name: 'Winter', emoji: '❄️', food: 0.40, tint: [212, 220, 228], strength: 0.44 },
];
function yearPhase(tick) { return (tick / CONFIG.yearLength) % 1; }        // 0..1 through the year
function seasonAt(tick) { return SEASONS[Math.floor(yearPhase(tick) * 4) % 4]; }
function yearNumber(tick) { return Math.floor(tick / CONFIG.yearLength) + 1; }
// smoothly blended season values (so transitions aren't abrupt)
function seasonBlend(tick) {
  const p = yearPhase(tick) * 4;
  const i = Math.floor(p) % 4, f = p - Math.floor(p);
  const a = SEASONS[i], b = SEASONS[(i + 1) % 4];
  const L = (x, y) => x + (y - x) * f;
  return {
    food: L(a.food, b.food),
    tint: [L(a.tint[0], b.tint[0]), L(a.tint[1], b.tint[1]), L(a.tint[2], b.tint[2])],
    strength: L(a.strength, b.strength),
  };
}

// --- content filter for LLM-generated text -------------------------------------
// The local model sometimes returns crude or NSFW text (e.g. a kingdom name).
// MindBox is a kids' game, so every generated string shown to the player is
// screened: if it trips the blocklist we return '' and the caller falls back to a
// safe procedural value. Better to drop a name than print something gross.
const LLM_BAD = /(fuck|shit|cunt|\bcock|\bdick|pussy|penis|vagina|masturbat|\bcum\b|cumshot|orgasm|porn|nsfw|\brape|whore|\bslut|bitch|\banal\b|\banus|nigg|\bfag|retard|nazi|hitler|naked|\bnude|horny|erotic|genital|testicl|scrotum|semen|ejacul|\bclit|dildo|blow\W?job|hand\W?job|boner|\bsex|titties|titty|\btits\b|molest|pedophil|incest|bestial|\bass\b|asshole|\bdamn\b|\bhell\b|\bpiss|\bturd|\bcrap\b|\bkkk\b)/i;
function cleanLLM(text) {
  if (text == null) return '';
  const s = String(text);
  return LLM_BAD.test(s) ? '' : s;
}
