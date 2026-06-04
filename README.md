# 🧠 MindBox

A WorldBox-style sandbox where **every creature is its own AI**.

Each creature carries a small **neural network brain**. Every tick it senses
what's around it (food, other creatures, its own hunger), its brain decides
what to do, and it moves / eats / reproduces. Nothing is hand-coded — a
creature only knows what its brain has figured out.

## How it "learns"

When a creature reproduces, the child copies the parent's brain **with small
random mutations**. Creatures that are good at finding food live longer and
have more children, so their brains spread. Over a few minutes you'll watch
the whole population get noticeably smarter — that's **evolution** doing the
learning.

Children inherit their parent's **color**, so when one color floods the map,
that family's brain is the current "winner."

## Run it

Just open `index.html` in a browser. (No install, no build step.)

Or serve the folder:

```
cd mindbox
python3 -m http.server 8000
# open http://localhost:8000
```

## Controls

- **Pause / New World** — stop time or generate a fresh map
- **Speed** — how many simulation steps per frame
- **Food growth** — how fast food regrows (more food = easier life)
- **Mutation %** — how wild the children's brains can get
- **God tools** — click/drag the world to drop 🌱 food, 🐣 spawn a creature,
  or ⚡ smite an area

## Files

| file | what it is |
|------|-----------|
| `src/config.js`   | all the tunable numbers |
| `src/brain.js`    | the neural network (a creature's mind) |
| `src/world.js`    | the grid, terrain, and food |
| `src/creature.js` | one AI agent: sense → think → act |
| `src/sim.js`      | runs time, births, deaths, evolution |
| `src/render.js`   | draws everything |
| `src/main.js`     | UI + the main loop |

## Ideas for next

- Give each creature **lifetime learning** (its brain updates from rewards
  during its own life, not just across generations)
- Add **predators vs prey**, plants, and seasons
- A live **graph** of population & average lifespan
- Let creatures **remember** (a tiny memory input fed back each tick)
