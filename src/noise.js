// noise.js — smooth value noise, used to generate natural-looking terrain
// (continents, mountains, moisture). Two independent Noise objects give us
// an elevation map and a moisture map; together they decide each tile's biome.
class Noise {
  constructor() {
    this.r = new Float32Array(256 * 256);
    for (let i = 0; i < this.r.length; i++) this.r[i] = Math.random();
  }
  _v(ix, iy) { return this.r[((iy & 255) * 256) + (ix & 255)]; }
  _smooth(t) { return t * t * (3 - 2 * t); }

  value(x, y) {
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const u = this._smooth(x - x0), v = this._smooth(y - y0);
    const a = this._v(x0, y0) * (1 - u) + this._v(x0 + 1, y0) * u;
    const b = this._v(x0, y0 + 1) * (1 - u) + this._v(x0 + 1, y0 + 1) * u;
    return a * (1 - v) + b * v;
  }

  // Sum several octaves for natural detail (big shapes + small wrinkles).
  fractal(x, y, octaves = 4) {
    let amp = 1, freq = 1, sum = 0, norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += amp * this.value(x * freq, y * freq);
      norm += amp;
      amp *= 0.5;
      freq *= 2;
    }
    return sum / norm;
  }
}
