// Minimal complex 2×2 linear algebra for verification only.
//
// Deliberately independent of the closed-form propagator in physics.ts: the
// reference exponential here uses scaling-and-squaring of a Taylor series, so
// agreement between the two is evidence, not a tautology.

export interface C2 {
  re: [[number, number], [number, number]];
  im: [[number, number], [number, number]];
}

const zero = (): C2 => ({
  re: [
    [0, 0],
    [0, 0],
  ],
  im: [
    [0, 0],
    [0, 0],
  ],
});

export const identity2 = (): C2 => ({
  re: [
    [1, 0],
    [0, 1],
  ],
  im: [
    [0, 0],
    [0, 0],
  ],
});

export function mul2(a: C2, b: C2): C2 {
  const out = zero();
  for (let i = 0; i < 2; i += 1) {
    for (let j = 0; j < 2; j += 1) {
      let re = 0;
      let im = 0;
      for (let k = 0; k < 2; k += 1) {
        re += a.re[i][k] * b.re[k][j] - a.im[i][k] * b.im[k][j];
        im += a.re[i][k] * b.im[k][j] + a.im[i][k] * b.re[k][j];
      }
      out.re[i][j] = re;
      out.im[i][j] = im;
    }
  }
  return out;
}

export function add2(a: C2, b: C2, scale = 1): C2 {
  const out = zero();
  for (let i = 0; i < 2; i += 1) {
    for (let j = 0; j < 2; j += 1) {
      out.re[i][j] = a.re[i][j] + scale * b.re[i][j];
      out.im[i][j] = a.im[i][j] + scale * b.im[i][j];
    }
  }
  return out;
}

export function adjoint2(a: C2): C2 {
  const out = zero();
  for (let i = 0; i < 2; i += 1) {
    for (let j = 0; j < 2; j += 1) {
      out.re[i][j] = a.re[j][i];
      out.im[i][j] = -a.im[j][i];
    }
  }
  return out;
}

/** Largest entrywise modulus of a − b. */
export function maxAbsDiff2(a: C2, b: C2): number {
  let m = 0;
  for (let i = 0; i < 2; i += 1) {
    for (let j = 0; j < 2; j += 1) {
      m = Math.max(m, Math.hypot(a.re[i][j] - b.re[i][j], a.im[i][j] - b.im[i][j]));
    }
  }
  return m;
}

/** exp(−i H dt) for a real 2×2 H, by scaling-and-squaring a Taylor series. */
export function expmMinusIHdt(H: readonly (readonly number[])[], dt: number): C2 {
  // M = −i H dt has zero real part and imaginary part −H dt.
  const M = zero();
  let norm = 0;
  for (let i = 0; i < 2; i += 1) {
    for (let j = 0; j < 2; j += 1) {
      M.im[i][j] = -H[i][j] * dt;
      norm = Math.max(norm, Math.abs(M.im[i][j]) * 2);
    }
  }
  const squarings = Math.max(0, Math.ceil(Math.log2(norm / 0.25 + 1e-300)));
  const scale = 2 ** -squarings;
  const A = zero();
  for (let i = 0; i < 2; i += 1) for (let j = 0; j < 2; j += 1) A.im[i][j] = M.im[i][j] * scale;

  let result = identity2();
  let term = identity2();
  for (let k = 1; k <= 24; k += 1) {
    term = mul2(term, A);
    for (let i = 0; i < 2; i += 1) {
      for (let j = 0; j < 2; j += 1) {
        term.re[i][j] /= k;
        term.im[i][j] /= k;
      }
    }
    result = add2(result, term);
  }
  for (let s = 0; s < squarings; s += 1) result = mul2(result, result);
  return result;
}
