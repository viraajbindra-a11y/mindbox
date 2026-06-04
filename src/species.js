// species.js — the MODEL for every creature type.
// Each entry here is a full species "model": its look, diet, habitat, body
// stats, who it eats, and how it breeds. Everything else in the game is
// data-driven from this table, so adding a new WorldBox creature is just one
// new row. Every creature still has its OWN neural-net brain and evolves.

// helper: fill in sensible defaults so each row stays short
function sp(o) {
  return Object.assign({
    domain: 'land',      // 'land' | 'water' | 'air' (where it can move)
    diet: 'plant',       // 'plant' | 'meat' | 'omni'
    eats: [],            // species keys this one can hunt
    strong: false,       // if true, ignores the size rule when hunting
    size: 1, vision: 5,
    metabolism: 0.16, maxEnergy: 160,
    foodValue: 30,       // plant energy multiplier (herbivores/omnivores)
    preyEnergy: 60,      // energy gained per kill (carnivores/omnivores)
    reproduceAt: 100, reproduceCost: 70, maxAge: 3000,
    start: 18, min: 4, cap: 140,
    hue: 100,
  }, o);
}

const SPECIES = {
  // ---------------- herbivores (land) ----------------
  sheep:  sp({ name: 'Sheep',  emoji: '🐑', hue: 92,  start: 46, min: 6, cap: 200 }),
  rabbit: sp({ name: 'Rabbit', emoji: '🐰', hue: 45,  size: 0.7, metabolism: 0.12, maxEnergy: 110,
               foodValue: 26, reproduceAt: 70, reproduceCost: 45, maxAge: 1600, start: 55, min: 8, cap: 240 }),
  deer:   sp({ name: 'Deer',   emoji: '🦌', hue: 28,  size: 1.1, vision: 6, metabolism: 0.18,
               maxEnergy: 180, foodValue: 32, reproduceAt: 115, start: 30, min: 5, cap: 150 }),
  cow:    sp({ name: 'Cow',    emoji: '🐄', hue: 320, size: 1.4, vision: 4, metabolism: 0.2,
               maxEnergy: 230, foodValue: 36, reproduceAt: 150, reproduceCost: 95, start: 22, min: 4, cap: 110 }),

  // ---------------- carnivores (land) ----------------
  wolf: sp({ name: 'Wolf', emoji: '🐺', hue: 222, diet: 'meat', eats: ['sheep', 'rabbit', 'deer'],
             size: 1.05, vision: 6, metabolism: 0.2, maxEnergy: 170, preyEnergy: 62, reproduceAt: 110,
             start: 14, min: 3, cap: 90 }),
  fox:  sp({ name: 'Fox', emoji: '🦊', hue: 22, diet: 'meat', eats: ['rabbit'], size: 0.8, vision: 6,
             metabolism: 0.15, maxEnergy: 130, preyEnergy: 50, reproduceAt: 85, start: 12, min: 3, cap: 80 }),
  lion: sp({ name: 'Lion', emoji: '🦁', hue: 42, diet: 'meat', eats: ['deer', 'cow', 'sheep', 'boar'],
             strong: true, size: 1.25, vision: 6, metabolism: 0.22, maxEnergy: 200, preyEnergy: 72,
             reproduceAt: 130, start: 8, min: 2, cap: 55 }),
  snake: sp({ name: 'Snake', emoji: '🐍', hue: 135, diet: 'meat', eats: ['rabbit'], size: 0.7, vision: 5,
             metabolism: 0.12, maxEnergy: 120, preyEnergy: 46, reproduceAt: 80, start: 12, min: 3, cap: 80 }),

  // ---------------- omnivores (land) ----------------
  bear: sp({ name: 'Bear', emoji: '🐻', hue: 20, diet: 'omni', eats: ['sheep', 'deer', 'fish'],
             size: 1.3, vision: 5, metabolism: 0.2, maxEnergy: 210, preyEnergy: 58, foodValue: 28,
             reproduceAt: 135, start: 8, min: 2, cap: 60 }),
  boar: sp({ name: 'Boar', emoji: '🐗', hue: 285, diet: 'omni', eats: ['rabbit'], size: 1.0, vision: 5,
             metabolism: 0.16, maxEnergy: 160, preyEnergy: 44, foodValue: 26, reproduceAt: 100,
             start: 14, min: 3, cap: 90 }),

  // ---------------- aquatic (water) ----------------
  fish:  sp({ name: 'Fish', emoji: '🐟', hue: 198, domain: 'water', size: 0.7, vision: 4, metabolism: 0.1,
              maxEnergy: 100, foodValue: 24, reproduceAt: 65, reproduceCost: 42, maxAge: 1500,
              start: 60, min: 10, cap: 260 }),
  shark: sp({ name: 'Shark', emoji: '🦈', hue: 208, domain: 'water', diet: 'meat', eats: ['fish'],
              strong: true, size: 1.3, vision: 6, metabolism: 0.2, maxEnergy: 200, preyEnergy: 66,
              reproduceAt: 130, start: 7, min: 2, cap: 55 }),

  // ---------------- sapients (land, go to war) ----------------
  human: sp({ name: 'Human', emoji: '🧑', hue: 35, diet: 'omni', eats: ['sheep', 'deer', 'boar', 'orc'],
              size: 1.0, vision: 6, metabolism: 0.16, maxEnergy: 170, preyEnergy: 54, foodValue: 28,
              reproduceAt: 110, start: 16, min: 3, cap: 120 }),
  orc:   sp({ name: 'Orc', emoji: '👹', hue: 110, diet: 'omni', eats: ['sheep', 'deer', 'human'],
              size: 1.1, vision: 6, metabolism: 0.18, maxEnergy: 180, preyEnergy: 56, foodValue: 26,
              reproduceAt: 115, start: 14, min: 3, cap: 110 }),

  // ---------------- apex (flies over everything) ----------------
  dragon: sp({ name: 'Dragon', emoji: '🐉', hue: 2, domain: 'air', diet: 'meat',
               eats: ['sheep', 'rabbit', 'deer', 'cow', 'wolf', 'fox', 'boar', 'human', 'orc', 'fish'],
               strong: true, size: 1.5, vision: 8, metabolism: 0.24, maxEnergy: 300, preyEnergy: 120,
               reproduceAt: 220, reproduceCost: 140, maxAge: 5000, start: 2, min: 1, cap: 10 }),
};

// derived lookups
const SPECIES_KEYS = Object.keys(SPECIES);
const SPECIES_LIST = SPECIES_KEYS.map(k => SPECIES[k]);
const PREDATORS_OF = {};
for (const k of SPECIES_KEYS) { SPECIES[k].key = k; SPECIES[k].eatsSet = new Set(SPECIES[k].eats); PREDATORS_OF[k] = new Set(); }
for (const k of SPECIES_KEYS) for (const prey of SPECIES[k].eats) if (PREDATORS_OF[prey]) PREDATORS_OF[prey].add(k);

// can predator p eat creature q right now? (membership + size rule)
function canHunt(p, q) {
  if (!p.def.eatsSet.has(q.species)) return false;
  if (p.def.strong) return true;
  return p.size + 0.15 >= q.size;   // bigger prey can resist
}
