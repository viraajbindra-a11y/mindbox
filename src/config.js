// config.js — every tunable number in one place. UI sliders edit these live.
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
  maxPop: 1100,           // hard safety cap on total creatures (per-species caps live in species.js)

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
  foodGrowth: 0.012,

  // --- evolution / learning ---
  mutationRate: 0.12,
  mutationAmount: 0.35,
  hueDrift: 8,

  // brain: 14 senses -> 12 hidden -> 5 actions
  brainLayers: [14, 12, 5],

  // --- fire / disasters ---
  fireDuration: 26,
  fireDamage: 16,
  fireSpread: 0.20,

  // --- atmosphere ---
  dayLength: 1200,        // ticks per full day/night cycle (visual only)

  // --- speed ---
  ticksPerFrame: 3,
};
