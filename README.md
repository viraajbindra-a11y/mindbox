# 🧠 MindBox

A **WorldBox-style god sandbox** where every creature is its own **AI agent**.

Each creature carries a small **neural-network brain**. Every tick it senses the
world, its brain decides what to do, and it moves / eats / fights / breeds.
Nothing is scripted — and nothing is pre-trained: **every creature is born
knowing nothing and teaches itself to survive while it lives** (online
reinforcement learning). It gets "rewarded" for gaining energy by eating and
hunting, and learns which moves lead there.

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
  **dragon** apex). Each has its own diet, habitat, and body.
  Adding a new creature is a single table row.
- **Lifetime learning, not scripting.** A newborn's brain starts blank — at first
  it just moves at random. As it lives, a reward signal (energy gained from
  eating/hunting, minus the danger of lingering near a predator) teaches it which
  moves pay off. It literally learns to forage and hunt *during its own life*.
  Click 🔍 **Inspect** to watch one's weights change as it learns. (Measured: a
  self-training creature finds ~4× more food than one with learning switched off.)
- **Bodies still evolve.** `size` and `vision` are genes passed to offspring with
  small mutations, so the *bodies* adapt across generations — a predator/prey
  **size arms race** (bigger prey resist smaller hunters) — even as each *mind*
  trains itself from scratch.
- **A living food web.** All 27 species' populations rise and crash in
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
| `src/species.js`  | the model for every creature type (one row each) |
| `src/brain.js`    | the self-training brain (online reinforcement learning) |
| `src/world.js`    | the grid: biomes, food, fire, terraforming |
| `src/creature.js` | one AI agent: sense → act → learn → breed |
| `src/sim.js`      | runs time, immigration, disasters, save/load |
| `src/render.js`   | pan/zoom camera, biomes, emoji creatures, day/night |
| `src/main.js`     | toolbar, census, graph, live brain viewer, main loop |

## Ideas for next

- Memory in the brain (recurrent) so it can learn things that take several steps.
- Herding/flocking rewards, disease, seasons.
- Tribes & buildings (toward true WorldBox civilizations).
