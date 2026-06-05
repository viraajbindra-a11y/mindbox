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
  fox:  sp({ name: 'Fox', emoji: '🦊', hue: 22, diet: 'meat', eats: ['rabbit', 'chicken'], size: 0.8, vision: 6,
             metabolism: 0.15, maxEnergy: 130, preyEnergy: 50, reproduceAt: 85, start: 12, min: 3, cap: 80 }),
  lion: sp({ name: 'Lion', emoji: '🦁', hue: 42, diet: 'meat', eats: ['deer', 'cow', 'sheep', 'boar', 'mammoth'],
             strong: true, size: 1.25, vision: 6, metabolism: 0.22, maxEnergy: 200, preyEnergy: 72,
             reproduceAt: 130, start: 8, min: 2, cap: 55, habitat: [B.SAVANNA, B.GRASS] }),
  snake: sp({ name: 'Snake', emoji: '🐍', hue: 135, diet: 'meat', eats: ['rabbit', 'chicken'], size: 0.7, vision: 5,
             metabolism: 0.12, maxEnergy: 120, preyEnergy: 46, reproduceAt: 80, start: 12, min: 3, cap: 80,
             habitat: [B.SAVANNA, B.SAND] }),

  // ---------------- omnivores (land) ----------------
  bear: sp({ name: 'Bear', emoji: '🐻', hue: 20, diet: 'omni', eats: ['sheep', 'deer', 'fish'],
             size: 1.3, vision: 5, metabolism: 0.2, maxEnergy: 210, preyEnergy: 58, foodValue: 28,
             reproduceAt: 135, start: 8, min: 2, cap: 60, habitat: [B.FOREST] }),
  boar: sp({ name: 'Boar', emoji: '🐗', hue: 285, diet: 'omni', eats: ['rabbit'], size: 1.0, vision: 5,
             metabolism: 0.16, maxEnergy: 160, preyEnergy: 44, foodValue: 26, reproduceAt: 100,
             start: 14, min: 3, cap: 90 }),

  // ---------------- aquatic (water) ----------------
  fish:  sp({ name: 'Fish', emoji: '🐟', hue: 198, domain: 'water', size: 0.7, vision: 4, metabolism: 0.1,
              maxEnergy: 100, foodValue: 24, reproduceAt: 65, reproduceCost: 42, maxAge: 1500,
              start: 60, min: 10, cap: 260 }),
  shark: sp({ name: 'Shark', emoji: '🦈', hue: 208, domain: 'water', diet: 'meat', eats: ['fish', 'penguin', 'crab'],
              strong: true, size: 1.3, vision: 6, metabolism: 0.2, maxEnergy: 200, preyEnergy: 66,
              reproduceAt: 130, start: 7, min: 2, cap: 55 }),

  // ---------------- sapients (land, go to war) ----------------
  human: sp({ name: 'Human', emoji: '🧑', hue: 35, diet: 'omni', builder: true, eats: ['sheep', 'deer', 'boar', 'orc'],
              size: 1.0, vision: 6, metabolism: 0.16, maxEnergy: 170, preyEnergy: 54, foodValue: 28,
              reproduceAt: 110, start: 16, min: 3, cap: 120 }),
  orc:   sp({ name: 'Orc', emoji: '👹', hue: 110, diet: 'omni', builder: true, eats: ['sheep', 'deer', 'human'],
              size: 1.1, vision: 6, metabolism: 0.18, maxEnergy: 180, preyEnergy: 56, foodValue: 26,
              reproduceAt: 115, start: 14, min: 3, cap: 110 }),

  // ---------------- apex (flies over everything) ----------------
  dragon: sp({ name: 'Dragon', emoji: '🐉', hue: 2, domain: 'air', diet: 'meat',
               eats: ['sheep', 'rabbit', 'deer', 'cow', 'wolf', 'fox', 'boar', 'human', 'orc', 'fish',
                      'elf', 'dwarf', 'mammoth', 'chicken'],
               strong: true, size: 1.5, vision: 8, metabolism: 0.24, maxEnergy: 300, preyEnergy: 120,
               reproduceAt: 220, reproduceCost: 140, maxAge: 5000, start: 2, min: 1, cap: 10 }),

  // ---------------- the other two kingdoms ----------------
  elf:   sp({ name: 'Elf', emoji: '🧝', hue: 150, diet: 'omni', builder: true, eats: ['rabbit', 'deer', 'orc'],
              vision: 7, metabolism: 0.15, maxEnergy: 165, preyEnergy: 52, reproduceAt: 108,
              start: 14, min: 3, cap: 110 }),
  dwarf: sp({ name: 'Dwarf', emoji: '🧔', hue: 30, diet: 'omni', builder: true, eats: ['boar', 'sheep', 'orc'],
              size: 0.95, vision: 5, metabolism: 0.16, maxEnergy: 175, preyEnergy: 54, reproduceAt: 112,
              start: 14, min: 3, cap: 100 }),

  // ---------------- more animals ----------------
  chicken: sp({ name: 'Chicken', emoji: '🐔', hue: 50, size: 0.6, metabolism: 0.1, maxEnergy: 90,
                foodValue: 22, reproduceAt: 58, reproduceCost: 38, maxAge: 1300, start: 50, min: 8, cap: 220 }),
  penguin: sp({ name: 'Penguin', emoji: '🐧', hue: 210, size: 0.85, metabolism: 0.13, maxEnergy: 130,
                foodValue: 26, reproduceAt: 92, start: 16, min: 3, cap: 90, habitat: [B.SNOW, B.SAND] }),
  mammoth: sp({ name: 'Mammoth', emoji: '🦣', hue: 25, size: 1.65, vision: 5, metabolism: 0.22,
                maxEnergy: 260, foodValue: 38, reproduceAt: 170, reproduceCost: 110, start: 8, min: 2, cap: 40,
                habitat: [B.SNOW] }),

  // ---------------- more aquatic ----------------
  crab:    sp({ name: 'Crab', emoji: '🦀', hue: 10, domain: 'water', size: 0.7, metabolism: 0.1,
                maxEnergy: 110, foodValue: 24, reproduceAt: 70, start: 24, min: 5, cap: 130 }),
  whale:   sp({ name: 'Whale', emoji: '🐋', hue: 215, domain: 'water', size: 1.7, vision: 5,
                metabolism: 0.18, maxEnergy: 280, foodValue: 40, reproduceAt: 180, reproduceCost: 120,
                start: 6, min: 2, cap: 28 }),
  octopus: sp({ name: 'Octopus', emoji: '🐙', hue: 300, domain: 'water', diet: 'meat',
                eats: ['fish', 'crab'], size: 1.0, vision: 6, metabolism: 0.16, maxEnergy: 160,
                preyEnergy: 56, reproduceAt: 105, start: 8, min: 2, cap: 60 }),

  // ---------------- monsters & undead ----------------
  slime:    sp({ name: 'Slime', emoji: '🟢', hue: 110, diet: 'omni', eats: ['chicken'], size: 0.8,
                 metabolism: 0.1, maxEnergy: 120, foodValue: 22, preyEnergy: 30, reproduceAt: 70,
                 reproduceCost: 44, start: 16, min: 3, cap: 160 }),
  skeleton: sp({ name: 'Skeleton', emoji: '💀', hue: 50, diet: 'meat',
                 eats: ['sheep', 'deer', 'human', 'elf', 'dwarf', 'chicken'], size: 1.0, vision: 6,
                 metabolism: 0.1, maxEnergy: 150, preyEnergy: 58, reproduceAt: 110, start: 8, min: 2, cap: 70 }),
  demon:    sp({ name: 'Demon', emoji: '😈', hue: 0, diet: 'meat',
                 eats: ['sheep', 'deer', 'human', 'orc', 'wolf', 'mammoth', 'slime'], strong: true,
                 size: 1.3, vision: 7, metabolism: 0.22, maxEnergy: 220, preyEnergy: 80, reproduceAt: 150,
                 reproduceCost: 95, start: 4, min: 1, cap: 30 }),
  golem:    sp({ name: 'Golem', emoji: '🗿', hue: 30, diet: 'meat', eats: ['human', 'orc', 'sheep'],
                 strong: true, size: 1.5, vision: 4, metabolism: 0.12, maxEnergy: 260, preyEnergy: 60,
                 reproduceAt: 160, reproduceCost: 110, maxAge: 5000, start: 4, min: 1, cap: 24,
                 habitat: [B.ROCK] }),
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
