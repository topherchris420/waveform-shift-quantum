/** Stateless common-random-number draws: policy branches cannot shift a PRNG stream. */
export function draw(seed: number, ...keys: (number | string)[]): number {
  let hash = seed >>> 0;
  for (const c of keys.join("|"))
    hash = Math.imul(hash ^ c.charCodeAt(0), 16777619) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 16), 0x21f0aaad);
  hash = Math.imul(hash ^ (hash >>> 15), 0x735a2d97);
  return ((hash ^ (hash >>> 15)) >>> 0) / 4294967296;
}

/** Stateless standard-normal draw using two independently keyed uniforms. */
export function normalDraw(seed: number, ...keys: (number | string)[]): number {
  const u = Math.max(1e-12, draw(seed, ...keys, "normal-u"));
  const v = draw(seed, ...keys, "normal-v");
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
