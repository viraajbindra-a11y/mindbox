// creature.js — one AI agent of any species.
// Its species "model" (from species.js) sets its body and diet; its own
// neural-net brain makes every decision. Each tick it senses, thinks, moves,
// eats (plants and/or prey), and — when well-fed — breeds a mutated child.
// Nothing is scripted: smart behavior has to be evolved.

class Creature {
  constructor(species, x, y, energy, brain, hue, generation, size, vision) {
    this.species = species;          // a key into SPECIES
    this.def = SPECIES[species];
    this.x = x; this.y = y;
    this.energy = energy;
    this.brain = brain;
    this.hue = hue;                  // lineage color (drifts around def.hue)
    this.generation = generation;
    this.size = size || this.def.size;
    this.vision = vision || this.def.vision;
    this.maxE = this.def.maxEnergy * this.size;
    this.age = 0;
    this.alive = true;
  }

  enterable(world, x, y) {
    if (!world.inBounds(x, y)) return false;
    const d = this.def.domain;
    if (d === 'air') return true;            // flies over land and water
    const water = world.isWater(x, y);
    return d === 'water' ? water : !water;   // water-only vs land-only
  }

  // 14 senses: own state, nearest plant / prey / threat directions, crowding.
  sense(world, sim) {
    const R = this.vision;
    const eatsPlant = this.def.diet !== 'meat';
    const preds = PREDATORS_OF[this.species];
    let plDx = 0, plDy = 0, plMag = 0;
    let prDx = 0, prDy = 0, prMag = 0;
    let thDx = 0, thDy = 0, thMag = 0;
    let crowd = 0;

    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        if (dx === 0 && dy === 0) continue;
        const x = this.x + dx, y = this.y + dy;
        if (!world.inBounds(x, y)) continue;
        const d2 = dx * dx + dy * dy;
        if (d2 > R * R) continue;
        const inv = 1 / Math.sqrt(d2);
        const i = world.idx(x, y);

        if (eatsPlant) {
          const food = world.food[i];
          if (food > 0) { plDx += dx * inv * food; plDy += dy * inv * food; plMag += food; }
        }
        const o = sim.grid[i];
        if (o) {
          if (o.species === this.species) crowd++;
          else if (this.def.eatsSet.has(o.species) && canHunt(this, o)) {
            prDx += dx * inv; prDy += dy * inv; prMag++;
          } else if (preds.has(o.species)) {
            thDx += dx * inv; thDy += dy * inv; thMag++;
          }
        }
      }
    }
    const plL = Math.hypot(plDx, plDy) || 1;
    const prL = Math.hypot(prDx, prDy) || 1;
    const thL = Math.hypot(thDx, thDy) || 1;
    this._threat = Math.min(1, thMag / 3);   // danger level, used as a learning penalty
    return [
      Math.min(1, this.energy / this.maxE),
      Math.min(1, this.age / this.def.maxAge),
      plDx / plL, plDy / plL, Math.min(1, plMag / 6),
      prDx / prL, prDy / prL, Math.min(1, prMag / 4),
      thDx / thL, thDy / thL, Math.min(1, thMag / 4),
      Math.min(1, crowd / 6),
      Math.min(1, world.food[world.idx(this.x, this.y)] / 0.9),  // food under me
      1, // bias
    ];
  }

  step(world, sim) {
    if (!this.alive) return null;
    const energyBefore = this.energy;
    const x = this.sense(world, sim);
    const a = this.brain.act(x);          // 0=up 1=down 2=left 3=right (sampled)

    // execute exactly the action it chose, so the reward credits that choice
    const DX = [0, 0, -1, 1], DY = [-1, 1, 0, 0];
    const nx = this.x + DX[a], ny = this.y + DY[a];
    if (this.enterable(world, nx, ny) && !sim.grid[world.idx(nx, ny)]) {
      this.moveTo(sim, nx, ny);
      this.energy -= CONFIG.moveCost;
    }

    // eat plants on this tile (if it's a plant-eater)
    if (this.def.diet !== 'meat') {
      const got = world.eat(this.x, this.y);
      if (got > 0) this.energy = Math.min(this.maxE, this.energy + got * this.def.foodValue);
    }
    // bite one adjacent prey (if it's a meat-eater)
    if (this.def.diet !== 'plant') {
      const N = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      for (const [dx, dy] of N) {
        const ax = this.x + dx, ay = this.y + dy;
        if (!world.inBounds(ax, ay)) continue;
        const prey = sim.grid[world.idx(ax, ay)];
        if (prey && this.def.eatsSet.has(prey.species) && canHunt(this, prey)) {
          sim.kill(prey);
          this.energy = Math.min(this.maxE, this.energy + this.def.preyEnergy);
          break;
        }
      }
    }

    this.energy -= this.def.metabolism * this.size;   // cost of living
    this.age++;

    // TRAIN ITSELF: reward = energy gained this step, minus the danger of
    // lingering near a predator. The brain reinforces whatever it just did.
    const L = CONFIG.learn;
    const reward = (this.energy - energyBefore) * L.rewardScale - L.threatPenalty * this._threat;
    this.brain.learn(reward, L);

    if (this.energy <= 0 || this.age > this.def.maxAge) { sim.kill(this); return null; }

    if (this.energy > this.def.reproduceAt * this.size && sim.canReproduce(this.species)) {
      return this.reproduce(world, sim);
    }
    return null;
  }

  moveTo(sim, nx, ny) {
    sim.grid[sim.world.idx(this.x, this.y)] = null;
    this.x = nx; this.y = ny;
    sim.grid[sim.world.idx(nx, ny)] = this;
  }

  reproduce(world, sim) {
    const spots = [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,1],[-1,1],[1,-1]];
    for (let s = spots.length - 1; s > 0; s--) {
      const j = Math.floor(Math.random() * (s + 1));
      [spots[s], spots[j]] = [spots[j], spots[s]];
    }
    for (const [dx, dy] of spots) {
      const x = this.x + dx, y = this.y + dy;
      if (this.enterable(world, x, y) && !sim.grid[world.idx(x, y)]) {
        const brain = new Brain(CONFIG.brainLayers);   // child is born blank; it trains itself
        this.energy -= this.def.reproduceCost * this.size;
        const hue = (this.hue + (Math.random() * 2 - 1) * CONFIG.hueDrift + 360) % 360;
        const size = Math.max(0.6, Math.min(1.7, this.size + randn() * 0.06));
        let vision = this.vision;
        if (Math.random() < CONFIG.mutationRate) vision += Math.random() < 0.5 ? -1 : 1;
        vision = Math.max(3, Math.min(8, vision));
        const child = new Creature(this.species, x, y, this.def.reproduceCost * this.size * 0.7,
                                   brain, hue, this.generation + 1, size, vision);
        sim.grid[world.idx(x, y)] = child;
        return child;
      }
    }
    return null;
  }
}
