// creature.js — one AI agent.
// Two species, both fully driven by their own neural-net brain:
//   • grazer  — eats plants, must learn to find food AND flee hunters
//   • hunter  — eats grazers, must learn to chase them down
// Nothing is scripted. Good brains survive, reproduce, and spread (evolution).

class Creature {
  constructor(species, x, y, energy, brain, hue, generation) {
    this.species = species;        // 'grazer' | 'hunter'
    this.x = x;
    this.y = y;
    this.energy = energy;
    this.brain = brain;
    this.hue = hue;
    this.generation = generation;
    this.age = 0;
    this.alive = true;
  }

  // Look around: build the 14 numbers the brain reads.
  sense(world, sim) {
    const R = CONFIG.visionRadius;
    let plDx = 0, plDy = 0, plMag = 0;   // plants (food for grazers)
    let prDx = 0, prDy = 0, prMag = 0;   // prey (food for hunters)
    let thDx = 0, thDy = 0, thMag = 0;   // threats (things that eat me)
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

        const food = world.food[i];
        if (food > 0) { plDx += dx * inv * food; plDy += dy * inv * food; plMag += food; }

        const other = sim.grid[i];
        if (other) {
          if (other.species === this.species) crowd++;
          else if (this.species === 'hunter') {     // a grazer = prey
            prDx += dx * inv; prDy += dy * inv; prMag++;
          } else {                                   // a hunter = threat
            thDx += dx * inv; thDy += dy * inv; thMag++;
          }
        }
      }
    }
    const plL = Math.hypot(plDx, plDy) || 1;
    const prL = Math.hypot(prDx, prDy) || 1;
    const thL = Math.hypot(thDx, thDy) || 1;
    return [
      Math.min(1, this.energy / CONFIG.maxEnergy),
      Math.min(1, this.age / CONFIG.maxAge),
      plDx / plL, plDy / plL, Math.min(1, plMag / 6),
      prDx / prL, prDy / prL, Math.min(1, prMag / 4),
      thDx / thL, thDy / thL, Math.min(1, thMag / 4),
      Math.min(1, crowd / 6),
      1, // bias
    ];
  }

  step(world, sim) {
    if (!this.alive) return null;
    const out = this.brain.forward(this.sense(world, sim));
    // outputs: 0=up 1=down 2=left 3=right 4=reproduce

    let dir = 0, best = out[0];
    for (let k = 1; k < 4; k++) if (out[k] > best) { best = out[k]; dir = k; }
    const DX = [0, 0, -1, 1], DY = [-1, 1, 0, 0];
    const nx = this.x + DX[dir], ny = this.y + DY[dir];

    // move into an empty, walkable tile (creatures block one another)
    if (world.walkable(nx, ny) && !sim.grid[world.idx(nx, ny)]) {
      this.moveTo(sim, nx, ny);
      this.energy -= CONFIG.moveCost;
    }

    if (this.species === 'grazer') {
      // graze the plants on this tile
      const got = world.eat(this.x, this.y);
      if (got > 0) this.energy = Math.min(CONFIG.maxEnergy, this.energy + got * CONFIG.foodValue);
    } else {
      // hunters bite one adjacent grazer per tick
      const N = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      for (const [dx, dy] of N) {
        const ax = this.x + dx, ay = this.y + dy;
        if (!world.inBounds(ax, ay)) continue;
        const prey = sim.grid[world.idx(ax, ay)];
        if (prey && prey.species === 'grazer') {
          sim.kill(prey);
          this.energy = Math.min(CONFIG.maxEnergy, this.energy + CONFIG.preyEnergy);
          break;
        }
      }
    }

    // cost of living
    this.energy -= this.species === 'hunter' ? CONFIG.hunterMetabolism : CONFIG.metabolism;
    this.age++;
    if (this.energy <= 0 || this.age > CONFIG.maxAge) { sim.kill(this); return null; }

    // Reproduce when well-fed. (Gating this on a brain output stalled
    // evolution — nothing was ever born, so there was no selection. The real
    // skill under selection is GATHERING the energy: foraging, fleeing, and
    // hunting, all of which the brain fully controls.)
    if (this.energy > CONFIG.reproduceThreshold && sim.canReproduce(this.species)) {
      return this.reproduce(world, sim);
    }
    return null;
  }

  moveTo(sim, nx, ny) {
    sim.grid[sim.world.idx(this.x, this.y)] = null;
    this.x = nx;
    this.y = ny;
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
      if (world.walkable(x, y) && !sim.grid[world.idx(x, y)]) {
        const brain = this.brain.clone();
        brain.mutate(CONFIG.mutationRate, CONFIG.mutationAmount);
        this.energy -= CONFIG.reproduceCost;
        const hue = (this.hue + (Math.random() * 2 - 1) * CONFIG.hueDrift + 360) % 360;
        const child = new Creature(this.species, x, y, CONFIG.reproduceCost * 0.7,
                                   brain, hue, this.generation + 1);
        sim.grid[world.idx(x, y)] = child;
        return child;
      }
    }
    return null;
  }
}
