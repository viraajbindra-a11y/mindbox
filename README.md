# 🧠 MindBox

**▶️ PLAY NOW — <https://viraajbindra-a11y.github.io/mindbox/>** (any browser, no install)

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

## AI crafting with a local LLM (Ollama)

The world can use a **local large language model** for real *Infinite-Craft-style*
invention — combine two things and the model makes up the result. It all runs on
your own machine; nothing goes to the cloud.

**Desktop app (recommended) — bundles & manages the AI for you:**

```bash
npm install      # one time
npm start        # launches the MindBox app
```

In the **🧪 AI Craft** panel: click **Install AI** (sets up Ollama), pick a model
and click **Get** to download it, then combine items or flip on *"let the AI
invent on its own."* **A bigger model = smarter agents = a better game** (the
panel lists models from tiny/fast to big/smart). Build an installer with
`npm run dist`.

**Plain web page instead?** Run your own Ollama with the browser allowed in:

```bash
OLLAMA_ORIGINS=* ollama serve
ollama pull llama3.2
```

No Ollama at all? The craft panel still works on a **built-in fallback** recipe
table — just not endless.

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
- **A hand-drawn, animated world.** Zoom in and every creature is a little
  procedurally-drawn animal (no emoji) that **walks** (legs swing), **eats** (head
  dips), and **sleeps** (lies down with zzz at night). A **day/night** sky cycles
  sunrise → noon → sunset → night, and a four-season **year** recolours the land
  (green spring → orange autumn → pale winter) and changes how fast plants grow.

## Controls

| | |
|---|---|
| **Move** | pan the camera (or right-drag anywhere; scroll to zoom) |
| **Terrain** | brush 11 biomes: land, water, mountains, forest, grass, beach, desert, jungle, swamp, snow, mushroom |
| **Life** | pick any of 27 species to spawn, 💀 smite an area, or 🔍 **Inspect** a creature |
| **Disasters** | ☄️ meteor, 🔥 fire, ⚡ bolt, 💣 bomb, 🌪 tornado, 🌋 volcano, 🌊 tsunami, ☠️ plague, ✨ bless, 🐉 summon |
| **Brush** | size of the terrain/disaster brush |
| **🗺 Minimap** | whole world at a glance — click to jump |

## Civilizations (the WorldBox port, complete)

Humans, elves, dwarves and orcs gather wood & ore and **build villages — the
buildings themselves are invented by the local LLM** from the resources poured
in. Villages become **named kingdoms** with organic, house-driven territory,
**cultures, religions and tech AGES** (Stone → … → Arcane; the LLM writes each
civilization's identity). Faiths spread, reconcile old enemies and forge
**alliances** that fight **bloc wars**; realms **trade** (gold routes + roads),
**rebel**, raise armies, **besiege and conquer** each other — and from the
**Bronze Age** they sail: ⛵ colonists settle far islands, advanced realms
launch amphibious invasions. Flip on 🔮 **"Let the AI run the world"** and the
LLM becomes the god-storyteller, unleashing plagues, raids and dragons with a
written reason in the 📜 world-history log.

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
| `src/sprites.js`  | procedurally-drawn animated animal models |
| `src/structures.js` | the build/tech tree (recipes + building art) |
| `src/render.js`   | pan/zoom camera, biomes, day/night sky, seasons |
| `src/ollama.js`   | talks to a local LLM (desktop bridge or web fetch) |
| `src/craft.js`    | infinite-craft discovery (LLM invention + fallback) |
| `src/main.js`     | toolbar, census, graph, live brain viewer, AI panel |
| `electron/`       | desktop app: installs/runs Ollama, pulls models |

## Done since v0.1 (all shipped)

- ~~Memory in the brain (recurrent)~~ ✅ recurrent self-training brains
- ~~disease, seasons~~ ✅ plague + 4 seasons + day/night
- ~~Tribes & buildings (toward true WorldBox civilizations)~~ ✅ the whole
  civilization layer: kingdoms, territory, war & conquest, culture/religion/tech
  ages, alliances, trade, roads, rebellion, seafaring — plus an LLM world
  director, synthesized sound, and a desktop app build.
