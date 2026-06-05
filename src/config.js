// config.js — every tunable number in one place. UI sliders edit these live.

// biome ids (defined here so species.js, world.js and render.js can all use them)
const B = {
  DEEP: 0, SHALLOW: 1, SAND: 2, GRASS: 3,
  FOREST: 4, SAVANNA: 5, ROCK: 6, SNOW: 7,
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
  maxPop: 1000,           // hard safety cap on total creatures
  capScale: 0.5,          // scales every species' cap so the world settles
                          // below maxPop, leaving room for constant births

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

  // brain: 14 senses -> 12 hidden -> 4 move actions (a self-training policy net)
  brainLayers: [14, 12, 4],

  // online reinforcement learning — how each creature trains its own brain in life
  learn: {
    lr: 0.06,            // how fast it updates its weights
    traceDecay: 0.9,     // how far back credit for a reward reaches
    baselineLR: 0.02,    // how fast its "expected reward" adapts
    weightDecay: 0.0004, // keeps weights from blowing up
    rewardScale: 0.05,   // scales the energy-change reward
    threatPenalty: 0.5,  // dislike of sitting next to a predator (teaches fleeing)
  },

  // --- fire / disasters ---
  fireDuration: 26,
  fireDamage: 16,
  fireSpread: 0.20,

  // --- atmosphere ---
  dayLength: 1200,        // ticks per full day/night cycle (visual only)

  // --- speed ---
  ticksPerFrame: 3,
};
