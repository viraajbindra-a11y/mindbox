# 🧠 MindBox

A **WorldBox-style god sandbox** where every creature is its own **AI agent**.

Each creature carries a small **neural-network brain**. Every tick it senses the
world around it, its brain decides what to do, and it moves / eats / fights /
breeds. Nothing is scripted — a creature only knows what evolution has taught it.

You play the god: shape the land, grow forests, and hurl meteors.

👉 **Open `index.html` in any browser.** No install, no build step.

(or serve it: `python3 -m http.server 8000` then visit `http://localhost:8000`)

## What makes it tick

- **Biome world** — oceans, beaches, grassland, forest, savanna, mountains, and
  snow, generated from elevation + moisture noise into a continent.
- **27 species, each its own model** (in `src/species.js`): herbivores (sheep,
  rabbit, deer, cow, chicken, penguin, mammoth), carnivores (wolf, fox, lion,
  snake), omnivores (bear, boar), aquatic life (fish, shark, crab, whale,
  octopus), the four kingdoms (human, elf, dwarf, orc) — who go to **war** with
  each other — and monsters (slime, skeleton, demon, golem, and a flying 🐉
  **dragon** apex). Each has its own diet, habitat, body, and evolving brain.
  Adding a new creature is a single table row.
- **Evolution, not scripting.** When a creature is well-fed it reproduces; the
  child copies its brain with small **mutations**. Better brains survive and
  spread. A creature's **color** is inherited, so you can watch winning families
  take over the map.
- **Evolvable bodies.** `size` and `vision` are genes too. Bigger grazers can
  resist smaller hunters, so the two species get caught in a **size arms race** —
  grazers grow to escape, hunters grow to catch.
- **A living food chain.** Grazer and hunter populations rise and crash in
  predator–prey cycles that nobody programmed. The side graph shows it live.

## Controls

| | |
|---|---|
| **Move** | pan the camera (or right-drag anywhere; scroll to zoom) |
| **Terrain** | brush land, water, mountains, forest, grass, sand |
| **Life** | pick any of 27 species to spawn, 💀 smite an area, or 🔍 **Inspect** a creature |
| **Disasters** | ☄️ meteor, 🔥 spreading fire, ⚡ lightning, 💣 bomb |
| **Brush** | size of the terrain/disaster brush |

**🔍 Inspect** a creature to watch its actual neural network *think* in real time —
left nodes are its senses, right nodes are its actions (move + breed).

**💾 Save / 📂 Load** stores the entire world *and* every creature's brain in your
browser, so your evolved civilization survives a refresh.

The sliders tune **speed**, **food growth**, and **mutation rate** live.

## How it's built

Plain HTML + Canvas + JavaScript — no libraries, no build.

| file | what it is |
|------|-----------|
| `src/config.js`   | every tunable number |
| `src/noise.js`    | value noise for terrain generation |
| `src/brain.js`    | the neural network (a creature's mind) |
| `src/world.js`    | the grid: biomes, food, fire, terraforming |
| `src/creature.js` | one AI agent: sense → think → act → breed |
| `src/sim.js`      | runs time, evolution, disasters, save/load |
| `src/render.js`   | pan/zoom camera, biomes, creatures, day/night |
| `src/main.js`     | toolbar, graph, brain viewer, the main loop |

## Ideas for next

- **Lifetime learning** — brains that also learn *during* a creature's own life
  (reinforcement learning), not only across generations.
- A third species, herding/flocking, disease, seasons.
- Tribes & buildings (toward true WorldBox civilizations).
