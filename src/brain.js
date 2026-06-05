// brain.js
// A creature's mind: a RECURRENT policy network that trains itself online.
//
// The big upgrade over a plain reflex net is MEMORY: a recurrent hidden state
// (h carries over from the previous tick through Whh), so a creature can
// remember what it just saw and learn multi-step behaviour — keep chasing that
// prey, keep fleeing that wolf — instead of reacting only to the current frame.
//
// It learns by policy gradient with eligibility traces (REINFORCE-with-traces):
//  1. sense → update memory → sample a move from its policy (so it explores),
//  2. get a reward (energy gained from eating/hunting, minus danger),
//  3. nudge its own weights so moves that beat its expected reward get likelier;
//     eligibility traces carry the credit back to the moves that set it up.
//
// Born knowing nothing (action weights start at zero → random moves); learns
// purely from its own experience. Nothing is scripted.

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
    this.ni = ni; this.nh = nh; this.no = no;
    this.Wxh = new Float32Array(ni * nh);   // input → hidden
    this.Whh = new Float32Array(nh * nh);   // hidden(prev) → hidden  (memory)
    this.bh  = new Float32Array(nh);
    this.Wha = new Float32Array(nh * no);   // hidden → action logits (starts 0 = random policy)
    this.ba  = new Float32Array(no);
    for (let i = 0; i < this.Wxh.length; i++) this.Wxh[i] = randn() * 0.3;
    // Whh starts at 0 → no memory at birth (acts as a clean feedforward net);
    // the creature LEARNS to use memory only where it actually helps.
    // eligibility traces
    this.eWxh = new Float32Array(ni * nh);
    this.eWhh = new Float32Array(nh * nh);
    this.ebh  = new Float32Array(nh);
    this.eWha = new Float32Array(nh * no);
    this.eba  = new Float32Array(no);
    // recurrent state + caches
    this.h = new Float32Array(nh);
    this.hPrev = new Float32Array(nh);
    this.probs = new Float32Array(no);
    this.x = null; this.lastA = 0; this.baseline = 0;
  }

  _hidden(x, hPrev) {
    const { ni, nh } = this;
    const h = new Float32Array(nh);
    for (let j = 0; j < nh; j++) {
      let s = this.bh[j];
      for (let i = 0; i < ni; i++) s += x[i] * this.Wxh[i * nh + j];
      for (let k = 0; k < nh; k++) s += hPrev[k] * this.Whh[k * nh + j];
      h[j] = Math.tanh(s);                 // bounded → stays numerically stable
    }
    return h;
  }

  _policy(h, probs) {
    const { nh, no } = this;
    let maxz = -1e9;
    for (let k = 0; k < no; k++) {
      let s = this.ba[k];
      for (let j = 0; j < nh; j++) s += h[j] * this.Wha[j * no + k];
      probs[k] = s; if (s > maxz) maxz = s;
    }
    let sum = 0;
    for (let k = 0; k < no; k++) { probs[k] = Math.exp(probs[k] - maxz); sum += probs[k]; }
    for (let k = 0; k < no; k++) probs[k] /= sum;
  }

  // sense → remember → choose an action (sampled, so it explores)
  act(x) {
    this.hPrev = this.h;
    this.h = this._hidden(x, this.hPrev);
    this._policy(this.h, this.probs);
    this.x = x;
    let r = Math.random(), a = this.no - 1;
    for (let k = 0; k < this.no; k++) { r -= this.probs[k]; if (r <= 0) { a = k; break; } }
    this.lastA = a;
    return a;
  }

  // learn from the reward earned by that action
  learn(reward, hp) {
    const { ni, nh, no } = this;
    const x = this.x, h = this.h, hPrev = this.hPrev, a = this.lastA, p = this.probs;
    if (!x) return;
    this.baseline += hp.baselineLR * (reward - this.baseline);
    let adv = reward - this.baseline;
    if (adv > 3) adv = 3; else if (adv < -3) adv = -3;   // clip for stability
    const decay = hp.traceDecay;

    const dz = new Float32Array(no);
    for (let k = 0; k < no; k++) dz[k] = (k === a ? 1 : 0) - p[k];
    for (let k = 0; k < no; k++) {
      this.eba[k] = decay * this.eba[k] + dz[k];
      for (let j = 0; j < nh; j++) this.eWha[j * no + k] = decay * this.eWha[j * no + k] + dz[k] * h[j];
    }
    // backprop into hidden (truncated BPTT: treat hPrev as a fixed input)
    const dh = new Float32Array(nh);
    for (let j = 0; j < nh; j++) {
      let s = 0;
      for (let k = 0; k < no; k++) s += dz[k] * this.Wha[j * no + k];
      dh[j] = s * (1 - h[j] * h[j]);
    }
    for (let j = 0; j < nh; j++) {
      this.ebh[j] = decay * this.ebh[j] + dh[j];
      for (let i = 0; i < ni; i++) this.eWxh[i * nh + j] = decay * this.eWxh[i * nh + j] + dh[j] * x[i];
      for (let k = 0; k < nh; k++) this.eWhh[k * nh + j] = decay * this.eWhh[k * nh + j] + dh[j] * hPrev[k];
    }

    const lr = hp.lr, wd = hp.weightDecay;
    for (let k = 0; k < no; k++) {
      this.ba[k] += lr * adv * this.eba[k];
      for (let j = 0; j < nh; j++) { const i2 = j * no + k; this.Wha[i2] += lr * adv * this.eWha[i2] - wd * this.Wha[i2]; }
    }
    for (let j = 0; j < nh; j++) {
      this.bh[j] += lr * adv * this.ebh[j];
      for (let i = 0; i < ni; i++) { const i1 = i * nh + j; this.Wxh[i1] += lr * adv * this.eWxh[i1] - wd * this.Wxh[i1]; }
      for (let k = 0; k < nh; k++) { const i3 = k * nh + j; this.Whh[i3] += lr * adv * this.eWhh[i3] - wd * this.Whh[i3]; }
    }
  }

  // for the inspector: [inputs, hidden, action-probabilities] without changing state
  trace(x) {
    const h = this._hidden(x, this.h);
    const probs = new Float32Array(this.no);
    this._policy(h, probs);
    return [x, h, probs];
  }

  getArrays() { return [this.Wxh, this.Whh, this.bh, this.Wha, this.ba]; }
  setArrays(a) {
    if (a[0]) this.Wxh = a[0]; if (a[1]) this.Whh = a[1]; if (a[2]) this.bh = a[2];
    if (a[3]) this.Wha = a[3]; if (a[4]) this.ba = a[4];
    return this;
  }
}

// alias so older references keep working
const NeuralNet = Brain;
