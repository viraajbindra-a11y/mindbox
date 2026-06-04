// brain.js
// A small feed-forward neural network — the "mind" of one creature.
// Every tick the creature feeds in what it senses, and the brain returns
// what it wants to do. The numbers inside (the weights) ARE the creature's
// personality and skill. There is no scripted behavior anywhere — a creature
// only knows what its brain has learned.
//
// "Learning" happens because when a creature reproduces, its child copies
// this brain with tiny random changes (mutations). Brains that survive and
// reproduce spread through the world. That is evolution: the population gets
// smarter over time, all by itself.

function randn() {
  // A random number from a bell curve (Box–Muller). Used for init + mutation.
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

class NeuralNet {
  constructor(layers, weights, biases) {
    this.layers = layers;                       // e.g. [10, 8, 5]
    this.weights = weights || NeuralNet._initWeights(layers);
    this.biases = biases || NeuralNet._initBiases(layers);
  }

  static _initWeights(layers) {
    const w = [];
    for (let l = 0; l < layers.length - 1; l++) {
      const inN = layers[l], outN = layers[l + 1];
      const arr = new Float32Array(inN * outN);
      const scale = Math.sqrt(2 / inN);         // sensible starting spread
      for (let i = 0; i < arr.length; i++) arr[i] = randn() * scale;
      w.push(arr);
    }
    return w;
  }

  static _initBiases(layers) {
    const b = [];
    for (let l = 1; l < layers.length; l++) b.push(new Float32Array(layers[l]));
    return b;
  }

  // Feed senses through the network and get the creature's wishes back.
  forward(inputs) {
    let act = inputs;
    for (let l = 0; l < this.weights.length; l++) {
      const inN = this.layers[l], outN = this.layers[l + 1];
      const w = this.weights[l], bias = this.biases[l];
      const next = new Float32Array(outN);
      const last = (l === this.weights.length - 1);
      for (let o = 0; o < outN; o++) {
        let sum = bias[o];
        for (let i = 0; i < inN; i++) sum += act[i] * w[i * outN + o];
        // hidden layers: tanh (-1..1). output layer: sigmoid (0..1).
        next[o] = last ? 1 / (1 + Math.exp(-sum)) : Math.tanh(sum);
      }
      act = next;
    }
    return act;
  }

  // Like forward(), but returns every layer's activations (for the brain
  // visualizer, so you can watch a creature "think").
  trace(inputs) {
    const acts = [inputs];
    let act = inputs;
    for (let l = 0; l < this.weights.length; l++) {
      const inN = this.layers[l], outN = this.layers[l + 1];
      const w = this.weights[l], bias = this.biases[l];
      const next = new Float32Array(outN);
      const last = (l === this.weights.length - 1);
      for (let o = 0; o < outN; o++) {
        let sum = bias[o];
        for (let i = 0; i < inN; i++) sum += act[i] * w[i * outN + o];
        next[o] = last ? 1 / (1 + Math.exp(-sum)) : Math.tanh(sum);
      }
      acts.push(next);
      act = next;
    }
    return acts;
  }

  clone() {
    return new NeuralNet(
      this.layers,
      this.weights.map(a => a.slice()),
      this.biases.map(a => a.slice())
    );
  }

  // Randomly nudge some weights. This is where new ideas come from.
  mutate(rate, amount) {
    for (const arr of this.weights)
      for (let i = 0; i < arr.length; i++)
        if (Math.random() < rate) arr[i] += randn() * amount;
    for (const arr of this.biases)
      for (let i = 0; i < arr.length; i++)
        if (Math.random() < rate) arr[i] += randn() * amount;
  }
}
