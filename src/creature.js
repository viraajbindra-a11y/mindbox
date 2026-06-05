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
    // animation/view state (set during step, read by the renderer)
    this.face = Math.random() < 0.5 ? 1 : -1;   // facing left/right
    this.anim = Math.random() * 6;              // limb phase (desynced per creature)
    this.animState = 'idle';
    this.justMoved = false;
    this.justAte = false;
    this.wood = 0; this.stone = 0; this.buildCd = 0;   // builder inventory
  }

  enterable(world, x, y) {
    if (!world.inBounds(x, y)) return false;
    const d = this.def.domain;
    if (d === 'air') return true;            // flies over land and water
    const water = world.isWater(x, y);
    if (d === 'water') return water;
    if (water) return false;
    // a wall blocks everyone except builders (whose kin raised it)
    if (world.struct[world.idx(x, y)] === STRUCT_BY_KEY.wall.id && !this.def.builder) return false;
    return true;
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
    // can I step each way? (1 = blocked by water/edge/another creature) — teaches obstacle avoidance
    const BDX = [0, 0, -1, 1], BDY = [-1, 1, 0, 0];
    const blk = [0, 0, 0, 0];
    for (let d = 0; d < 4; d++) {
      const bx = this.x + BDX[d], by = this.y + BDY[d];
      blk[d] = (this.enterable(world, bx, by) && !sim.grid[world.idx(bx, by)]) ? 0 : 1;
    }
    const dayT = (sim.tickCount / CONFIG.dayLength) % 1;          // time of day (cyclic)
    return [
      Math.min(1, this.energy / this.maxE),
      Math.min(1, this.age / this.def.maxAge),
      plDx / plL, plDy / plL, Math.min(1, plMag / 6),
      prDx / prL, prDy / prL, Math.min(1, prMag / 4),
      thDx / thL, thDy / thL, Math.min(1, thMag / 4),
      Math.min(1, crowd / 6),
      Math.min(1, world.food[world.idx(this.x, this.y)] / 0.9),  // food under me
      blk[0], blk[1], blk[2], blk[3],
      Math.sin(dayT * 6.2832), Math.cos(dayT * 6.2832),
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
    this.justMoved = false;
    this.justAte = false;
    if (this.enterable(world, nx, ny) && !sim.grid[world.idx(nx, ny)]) {
      if (a === 2) this.face = -1; else if (a === 3) this.face = 1;
      this.moveTo(sim, nx, ny);
      this.energy -= CONFIG.moveCost;
      this.justMoved = true;
    }

    // eat plants on this tile (if it's a plant-eater)
    if (this.def.diet !== 'meat') {
      const got = world.eat(this.x, this.y);
      if (got > 0) { this.energy = Math.min(this.maxE, this.energy + got * this.def.foodValue); this.justAte = true; }
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
          this.justAte = true;
          break;
        }
      }
    }

    if (this.def.builder) this._gatherAndBuild(world, sim);   // sapients gather + build

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

  // gather wood from trees / stone from ore, and raise structures from a tech tree
  _gatherAndBuild(world, sim) {
    if (this.buildCd > 0) this.buildCd--;
    for (const [dx, dy] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const ax = this.x + dx, ay = this.y + dy;
      if (!world.inBounds(ax, ay)) continue;
      const i = world.idx(ax, ay);
      if (world.tree[i] && this.wood < CONFIG.invMax) {
        this.wood += CONFIG.gatherRate;
        if (Math.random() < 0.06) world.tree[i] = 0;     // tree gets felled
        break;
      }
      if (world.ore[i] && this.stone < CONFIG.invMax) {
        this.stone += CONFIG.gatherRate * (world.ore[i] === 2 ? 1.4 : 1);
        if (Math.random() < 0.05) world.ore[i] = 0;       // vein runs out
        break;
      }
    }
    if (this.buildCd > 0) return;
    // build the best (highest-tier) structure we can afford and have the prerequisite for
    for (let t = STRUCTS.length - 1; t >= 0; t--) {
      const st = STRUCTS[t];
      if (this.wood < st.cost.wood || this.stone < st.cost.stone) continue;
      if (st.requires && !sim.hasStructNear(this.x, this.y, st.requires, CONFIG.buildRadius)) continue;
      if (sim.hasStructNear(this.x, this.y, st.key, st.spacing)) continue;   // don't stack duplicates
      const spot = this._buildSpot(world, sim);
      if (spot < 0) continue;
      sim.build(spot, st.id);
      this.wood -= st.cost.wood; this.stone -= st.cost.stone;
      this.buildCd = CONFIG.buildCooldown;
      break;
    }
  }

  _buildSpot(world, sim) {
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [0, 0]]) {
      const x = this.x + dx, y = this.y + dy;
      if (!world.inBounds(x, y) || world.isWater(x, y)) continue;
      const i = world.idx(x, y);
      if (world.struct[i] >= 0) continue;          // already built on
      if ((dx || dy) && sim.grid[i]) continue;     // tile taken by another creature
      return i;
    }
    return -1;
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
