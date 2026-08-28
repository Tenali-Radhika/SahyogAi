/** Deterministic PRNG (mulberry32) so demo/seed data is reproducible across runs. */
export function mulberry32(seed: number) {
  let a = seed;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashStringToSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h;
}

export type Random = () => number;

export function randInt(rand: Random, min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

export function randRange(rand: Random, min: number, max: number): number {
  return rand() * (max - min) + min;
}

export function choice<T>(rand: Random, items: readonly T[]): T {
  return items[Math.floor(rand() * items.length)];
}

/** Approximate Gaussian noise via sum of uniforms (fine for synthetic demo data). */
export function gaussianNoise(rand: Random, mean: number, stdDev: number): number {
  const u1 = rand() || 1e-9;
  const u2 = rand();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * stdDev;
}
