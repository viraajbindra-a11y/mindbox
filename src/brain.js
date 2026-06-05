// brain.js
// A creature's mind: a small policy network that TRAINS ITSELF DURING ITS LIFE.
//
// Every creature is born knowing nothing — its output weights start at zero, so
// at first it just moves at random. Each tick it:
//   1. senses the world, picks an action (a move direction) from a probability
//      distribution the network produces (so it explores),
//   2. sees what happened and gets a REWARD (gaining energy from eating/hunting
//      is good; losing energy or sitting next to a predator is bad),
//   3. nudges its own weights so the actions that led to reward become more
//      likely.
//
// This is online reinforcement learning (policy gradient with eligibility
// traces — REINFORCE/actor-style). No scripting, no evolution required: a
// creature literally learns to find food and hunt by doing it.

function randn() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

class Brain {
  constructor(layers) {
    this.layers = layers;                 // [inputs, hidden, actions]
    const [ni, nh, no] = layers;
    this.W1 = new Float32Array(ni * nh);
    this.b1 = new Float32Array(nh);
    this.W2 = new Float32Array(nh * no);  // starts at 0 → uniform (random) policy
    this.b2 = new Float32Array(no);
    // small random hidden weights break symmetry so different hidden units learn
    // different features; the creature still "starts with nothing" useful.
    for (let i = 0; i < this.W1.length; i++) this.W1[i] = randn() * 0.3;
    // eligibility traces (short-term memory of "which weights caused my actions")
    this.eW1 = new Float32Array(ni * nh);
    this.eb1 = new Float32Array(nh);
    this.eW2 = new Float32Array(nh * no);
    this.eb2 = new Float32Array(no);
    this.probs = new Float32Array(no);
    this.baseline = 0;                    // running average reward
    this.x = null; this.h = null; this.lastA = 0;
  }

  _forward(x) {
    const [ni, nh, no] = this.layers;
    const h = new Float32Array(nh);
    for (let j = 0; j < nh; j++) {
      let s = this.b1[j];
      for (let i = 0; i < ni; i++) s += x[i] * this.W1[i * nh + j];
      h[j] = Math.tanh(s);
    }
    const p = this.probs;
    let maxz = -1e9;
    for (let k = 0; k < no; k++) {
      let s = this.b2[k];
      for (let j = 0; j < nh; j++) s += h[j] * this.W2[j * no + k];
      p[k] = s; if (s > maxz) maxz = s;
    }
    let sum = 0;
    for (let k = 0; k < no; k++) { p[k] = Math.exp(p[k] - maxz); sum += p[k]; }
    for (let k = 0; k < no; k++) p[k] /= sum;
    return h;
  }

  // choose an action (sampled from the policy, so the creature explores)
  act(x) {
    this.h = this._forward(x);
    this.x = x;
    let r = Math.random(), a = this.layers[2] - 1;
    for (let k = 0; k < this.layers[2]; k++) { r -= this.probs[k]; if (r <= 0) { a = k; break; } }
    this.lastA = a;
    return a;
  }

  // learn from the reward earned by the action just taken
  learn(reward, hp) {
    const [ni, nh, no] = this.layers;
    const x = this.x, h = this.h, a = this.lastA, p = this.probs;
    if (!x) return;
    const decay = hp.traceDecay;
    // ∂ log π(a) / ∂ logit_k  =  1{k=a} − π_k
    const dz = new Float32Array(no);
    for (let k = 0; k < no; k++) dz[k] = (k === a ? 1 : 0) - p[k];
    // accumulate output-layer traces
    for (let k = 0; k < no; k++) {
      this.eb2[k] = decay * this.eb2[k] + dz[k];
      for (let j = 0; j < nh; j++) this.eW2[j * no + k] = decay * this.eW2[j * no + k] + dz[k] * h[j];
    }
    // backprop into hidden, accumulate hidden-layer traces
    const dh = new Float32Array(nh);
    for (let j = 0; j < nh; j++) {
      let s = 0;
      for (let k = 0; k < no; k++) s += dz[k] * this.W2[j * no + k];
      dh[j] = s * (1 - h[j] * h[j]);
    }
    for (let j = 0; j < nh; j++) {
      this.eb1[j] = decay * this.eb1[j] + dh[j];
      for (let i = 0; i < ni; i++) this.eW1[i * nh + j] = decay * this.eW1[i * nh + j] + dh[j] * x[i];
    }
    // advantage = reward − expected reward; nudge weights along the traces
    this.baseline += hp.baselineLR * (reward - this.baseline);
    const d = reward - this.baseline, lr = hp.lr, wd = hp.weightDecay;
    for (let k = 0; k < no; k++) {
      this.b2[k] += lr * d * this.eb2[k];
      for (let j = 0; j < nh; j++) { const i2 = j * no + k; this.W2[i2] += lr * d * this.eW2[i2] - wd * this.W2[i2]; }
    }
    for (let j = 0; j < nh; j++) {
      this.b1[j] += lr * d * this.eb1[j];
      for (let i = 0; i < ni; i++) { const i1 = i * nh + j; this.W1[i1] += lr * d * this.eW1[i1] - wd * this.W1[i1]; }
    }
  }

  // pure forward for the inspector: [inputs, hidden, action-probabilities]
  trace(x) {
    const h = this._forward(x);
    return [x, h, this.probs.slice()];
  }

  setWeights(W1, b1, W2, b2) { this.W1 = W1; this.b1 = b1; this.W2 = W2; this.b2 = b2; return this; }
}

// alias so older references keep working
const NeuralNet = Brain;
