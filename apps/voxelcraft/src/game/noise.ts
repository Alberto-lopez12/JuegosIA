import type { BiomeType, WorldType } from './types';

/**
 * Deterministic 128-bit hash (cyrb128) accepting any UTF-16 string (numbers, words, Unicode like "españa").
 */
export function cyrb128(str: string): [number, number, number, number] {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

/**
 * Deterministically converts any text string into a 32-bit unsigned integer seed.
 */
export function hashSeedString(input: string): number {
  const [h1] = cyrb128(input);
  return h1 >>> 0;
}

/**
 * Generates a random 6-digit numeric seed in [100000, 999999].
 */
export function generateRandomSeed(): number {
  return 100000 + Math.floor(Math.random() * 900000);
}

/**
 * Parses a user-supplied seed (number, text string, or empty) into a deterministic numeric seed + display label.
 */
export function parseSeedInput(raw?: string | number): { seed: number; label: string } {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const n = Math.abs(Math.floor(raw)) >>> 0;
    return { seed: n, label: String(n) };
  }
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  if (!trimmed) {
    const rnd = generateRandomSeed();
    return { seed: rnd, label: String(rnd) };
  }
  if (/^-?\d+$/.test(trimmed)) {
    const parsed = Number(trimmed);
    if (Number.isSafeInteger(parsed)) {
      const n = Math.abs(parsed) >>> 0;
      return { seed: n, label: trimmed };
    }
  }
  return { seed: hashSeedString(trimmed), label: trimmed };
}

/**
 * Deterministic seeded Perlin 2D & 3D noise generator in pure TypeScript.
 * Derives both permutation table and domain offsets from cyrb128(seed) so distinct
 * seeds produce genuinely different continents, biomes, caves, ores, and trees.
 */
export class SeededNoise {
  private perm: Uint8Array;
  public readonly biomeOffsetX: number;
  public readonly biomeOffsetZ: number;
  public readonly terrainOffsetX: number;
  public readonly terrainOffsetZ: number;
  public readonly caveOffsetX: number;
  public readonly caveOffsetZ: number;

  constructor(public readonly seed: number) {
    this.perm = new Uint8Array(512);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;

    const [h1, h2, h3, h4] = cyrb128(`voxelcraft_seed_${seed}`);
    let a = h1;
    let b = h2;
    let c = h3;
    let d = h4;
    // sfc32 PRNG seeded from cyrb128
    const nextRand = () => {
      a |= 0;
      b |= 0;
      c |= 0;
      d |= 0;
      const t = (((a + b) | 0) + d) | 0;
      d = (d + 1) | 0;
      a = b ^ (b >>> 9);
      b = (c + (c << 3)) | 0;
      c = (c << 21) | (c >>> 11);
      c = (c + t) | 0;
      return (t >>> 0) / 4294967296;
    };

    for (let i = 255; i > 0; i--) {
      const j = Math.floor(nextRand() * (i + 1));
      const tmp = p[i];
      p[i] = p[j];
      p[j] = tmp;
    }
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
    }

    this.biomeOffsetX = (nextRand() - 0.5) * 4000;
    this.biomeOffsetZ = (nextRand() - 0.5) * 4000;
    this.terrainOffsetX = (nextRand() - 0.5) * 4000;
    this.terrainOffsetZ = (nextRand() - 0.5) * 4000;
    this.caveOffsetX = (nextRand() - 0.5) * 2000;
    this.caveOffsetZ = (nextRand() - 0.5) * 2000;
  }

  private static fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private static lerp(a: number, b: number, t: number): number {
    return a + t * (b - a);
  }

  private static grad2(hash: number, x: number, y: number): number {
    const h = hash & 7;
    const u = h < 4 ? x : y;
    const v = h < 4 ? y : x;
    return ((h & 1) !== 0 ? -u : u) + ((h & 2) !== 0 ? -2.0 * v : 2.0 * v);
  }

  private static grad3(hash: number, x: number, y: number, z: number): number {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  public noise2D(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = SeededNoise.fade(xf);
    const v = SeededNoise.fade(yf);

    const p = this.perm;
    const aa = p[p[X] + Y];
    const ab = p[p[X] + Y + 1];
    const ba = p[p[X + 1] + Y];
    const bb = p[p[X + 1] + Y + 1];

    const x1 = SeededNoise.lerp(
      SeededNoise.grad2(aa, xf, yf),
      SeededNoise.grad2(ba, xf - 1, yf),
      u
    );
    const x2 = SeededNoise.lerp(
      SeededNoise.grad2(ab, xf, yf - 1),
      SeededNoise.grad2(bb, xf - 1, yf - 1),
      u
    );

    return SeededNoise.lerp(x1, x2, v) * 0.5;
  }

  public noise3D(x: number, y: number, z: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;

    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const zf = z - Math.floor(z);

    const u = SeededNoise.fade(xf);
    const v = SeededNoise.fade(yf);
    const w = SeededNoise.fade(zf);

    const p = this.perm;
    const A = p[X] + Y;
    const AA = p[A] + Z;
    const AB = p[A + 1] + Z;
    const B = p[X + 1] + Y;
    const BA = p[B] + Z;
    const BB = p[B + 1] + Z;

    return SeededNoise.lerp(
      SeededNoise.lerp(
        SeededNoise.lerp(SeededNoise.grad3(p[AA], xf, yf, zf), SeededNoise.grad3(p[BA], xf - 1, yf, zf), u),
        SeededNoise.lerp(SeededNoise.grad3(p[AB], xf, yf - 1, zf), SeededNoise.grad3(p[BB], xf - 1, yf - 1, zf), u),
        v
      ),
      SeededNoise.lerp(
        SeededNoise.lerp(SeededNoise.grad3(p[AA + 1], xf, yf, zf - 1), SeededNoise.grad3(p[BA + 1], xf - 1, yf, zf - 1), u),
        SeededNoise.lerp(SeededNoise.grad3(p[AB + 1], xf, yf - 1, zf - 1), SeededNoise.grad3(p[BB + 1], xf - 1, yf - 1, zf - 1), u),
        v
      ),
      w
    );
  }

  public fbm2D(x: number, y: number, octaves = 4, lacunarity = 2.0, gain = 0.5): number {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxVal = 0;
    for (let i = 0; i < octaves; i++) {
      total += this.noise2D(x * frequency, y * frequency) * amplitude;
      maxVal += amplitude;
      amplitude *= gain;
      frequency *= lacunarity;
    }
    return total / maxVal;
  }

  public hash2D(x: number, z: number, salt = 0): number {
    let h = Math.imul(x, 374761393) + Math.imul(z, 668265263) + Math.imul((this.seed ^ 0x9e3779b9) + salt, 1442695041);
    h = (h ^ (h >>> 13)) | 0;
    h = Math.imul(h, 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  public hash3D(x: number, y: number, z: number, salt = 0): number {
    let h =
      Math.imul(x, 374761393) +
      Math.imul(y, 1274126177) +
      Math.imul(z, 668265263) +
      Math.imul((this.seed ^ 0x85ebca6b) + salt, 1442695041);
    h = (h ^ (h >>> 13)) | 0;
    h = Math.imul(h, 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
}

export interface ColumnSample {
  biome: BiomeType;
  height: number;
  temperature: number;
  humidity: number;
  isRiver: boolean;
  riverChannel: number;
  riverValley: number;
}

export interface BiomeReliefProfile {
  baseHeight: number;
  heightScale: number;
}

export interface ClimateSample {
  biome: BiomeType;
  temperature: number;
  humidity: number;
  mountainNoise: number;
}

export interface BlendedTerrainParams {
  baseHeight: number;
  heightScale: number;
  badlandsWeight: number;
  mountainWeight: number;
  swampWeight: number;
  desertWeight: number;
  savannaWeight: number;
}

export interface RiverSample {
  riverNoise: number;
  channel: number;
  valley: number;
  isRiver: boolean;
}

/**
 * Per-biome relief profiles used by the 5x5 Gaussian terrain blender.
 */
export const BIOME_RELIEF_PROFILES: Record<BiomeType, BiomeReliefProfile> = {
  Swamp: { baseHeight: 42, heightScale: 4 },
  Plains: { baseHeight: 46, heightScale: 9 },
  Desert: { baseHeight: 46, heightScale: 9 },
  Savanna: { baseHeight: 46, heightScale: 9 },
  'Snowy Taiga': { baseHeight: 48, heightScale: 13 },
  Jungle: { baseHeight: 48, heightScale: 13 },
  Badlands: { baseHeight: 54, heightScale: 18 },
  Mountains: { baseHeight: 62, heightScale: 34 },
  'Nether Wastes': { baseHeight: 48, heightScale: 10 },
  'Soul Sand Valley': { baseHeight: 48, heightScale: 10 },
};

// Precomputed 5x5 Gaussian kernel (step 4 blocks: offsets -8, -4, 0, +4, +8)
export const BLEND_KERNEL_OFFSETS: ReadonlyArray<number> = [-8, -4, 0, 4, 8];
export const BLEND_KERNEL_WEIGHTS: ReadonlyArray<number> = (() => {
  const sigma = 6.4;
  const twoSigmaSq = 2 * sigma * sigma;
  const raw: number[] = [];
  let sum = 0;
  for (let iz = 0; iz < 5; iz++) {
    const dz = BLEND_KERNEL_OFFSETS[iz];
    for (let ix = 0; ix < 5; ix++) {
      const dx = BLEND_KERNEL_OFFSETS[ix];
      const w = Math.exp(-(dx * dx + dz * dz) / twoSigmaSq);
      raw.push(w);
      sum += w;
    }
  }
  return raw.map((w) => w / sum);
})();

/**
 * Samples macro-scale domain-warped Temperature [-1, 1], Humidity [-1, 1],
 * and Mountain/Continentality [0, 1] to assign one of the 8 Overworld biomes
 * with strict climatic coherence (cold zones never border desert/badlands).
 */
export function sampleClimateBiome(noise: SeededNoise, wx: number, wz: number): ClimateSample {
  // Organic domain warping before macro climate sampling (eliminates grid/linear bands)
  const warpedX = wx + noise.noise2D(wx * 0.012, wz * 0.012) * 28;
  const warpedZ = wz + noise.noise2D(wx * 0.012 + 100, wz * 0.012 + 100) * 28;

  const bx = warpedX + noise.biomeOffsetX;
  const bz = warpedZ + noise.biomeOffsetZ;

  // Macro-scale climate frequencies (~0.00185-0.00195, 2 smooth octaves -> 150-350 block regions)
  const rawTemp = noise.fbm2D(bx * 0.00185 + 11.3, bz * 0.00185 - 7.1, 2, 2.0, 0.45);
  const rawHum = noise.fbm2D(bx * 0.0019 - 31.7, bz * 0.0019 + 19.4, 2, 2.0, 0.45);
  const rawMtn = noise.fbm2D(bx * 0.00195 + 91.2, bz * 0.00195 + 44.8, 2, 2.0, 0.46);
  const rawLowland = noise.fbm2D(bx * 0.0021 - 63.4, bz * 0.0021 + 82.1, 2, 2.0, 0.45);

  // Normalize Perlin fbm (~[-0.4, +0.4]) cleanly into [-1.0, +1.0] and [0.0, 1.0]
  const temperature = Math.max(-1, Math.min(1, rawTemp * 2.95));
  const humidity = Math.max(-1, Math.min(1, rawHum * 2.95));
  // Mountain ranges occupy coherent ~14-18% alpine chains when exceeding 0.62
  const mountainNoise = Math.max(0, Math.min(1, rawMtn * 0.95 + 0.4));
  const lowland = Math.max(-1, Math.min(1, rawLowland * 2.5));

  let biome: BiomeType;
  if (mountainNoise > 0.62) {
    biome = 'Mountains';
  } else if (temperature < -0.35) {
    biome = 'Snowy Taiga';
  } else if (temperature < 0.25) {
    biome = humidity > 0.35 && lowland < 0.15 ? 'Swamp' : 'Plains';
  } else if (temperature < 0.6) {
    biome = humidity > 0.25 ? 'Jungle' : 'Savanna';
  } else {
    biome = humidity < -0.25 ? 'Badlands' : 'Desert';
  }

  return { biome, temperature, humidity, mountainNoise };
}

/**
 * Averages biome relief parameters over a 5x5 grid (step 4 blocks: -8..+8)
 * weighted by Gaussian distance so biome elevation transitions are completely smooth.
 */
export function getBlendedTerrainParams(
  noise: SeededNoise,
  wx: number,
  wz: number
): BlendedTerrainParams {
  let baseHeight = 0;
  let heightScale = 0;
  let badlandsWeight = 0;
  let mountainWeight = 0;
  let swampWeight = 0;
  let desertWeight = 0;
  let savannaWeight = 0;

  let k = 0;
  for (let iz = 0; iz < 5; iz++) {
    const sz = wz + BLEND_KERNEL_OFFSETS[iz];
    for (let ix = 0; ix < 5; ix++) {
      const sx = wx + BLEND_KERNEL_OFFSETS[ix];
      const w = BLEND_KERNEL_WEIGHTS[k++];
      const b = sampleClimateBiome(noise, sx, sz).biome;
      const profile = BIOME_RELIEF_PROFILES[b];
      baseHeight += profile.baseHeight * w;
      heightScale += profile.heightScale * w;
      if (b === 'Badlands') badlandsWeight += w;
      else if (b === 'Mountains') mountainWeight += w;
      else if (b === 'Swamp') swampWeight += w;
      else if (b === 'Desert') desertWeight += w;
      else if (b === 'Savanna') savannaWeight += w;
    }
  }

  return {
    baseHeight,
    heightScale,
    badlandsWeight,
    mountainWeight,
    swampWeight,
    desertWeight,
    savannaWeight,
  };
}

/**
 * Evaluates getBlendedTerrainParams on the world-aligned 4-block lattice and
 * bilinearly interpolates to (wx, wz). Guarantees exact 1:1 parity with chunk
 * generation and C0-smooth 1-block transitions across every biome border.
 */
export function getInterpolatedBlendedTerrainParams(
  noise: SeededNoise,
  wx: number,
  wz: number
): BlendedTerrainParams {
  const gx0 = Math.floor(wx / 4) * 4;
  const gz0 = Math.floor(wz / 4) * 4;
  const tx = (wx - gx0) * 0.25;
  const tz = (wz - gz0) * 0.25;

  if (tx === 0 && tz === 0) {
    return getBlendedTerrainParams(noise, gx0, gz0);
  }

  const p00 = getBlendedTerrainParams(noise, gx0, gz0);
  const p10 = getBlendedTerrainParams(noise, gx0 + 4, gz0);
  const p01 = getBlendedTerrainParams(noise, gx0, gz0 + 4);
  const p11 = getBlendedTerrainParams(noise, gx0 + 4, gz0 + 4);

  const w00 = (1 - tx) * (1 - tz);
  const w10 = tx * (1 - tz);
  const w01 = (1 - tx) * tz;
  const w11 = tx * tz;

  return {
    baseHeight: p00.baseHeight * w00 + p10.baseHeight * w10 + p01.baseHeight * w01 + p11.baseHeight * w11,
    heightScale: p00.heightScale * w00 + p10.heightScale * w10 + p01.heightScale * w01 + p11.heightScale * w11,
    badlandsWeight:
      p00.badlandsWeight * w00 + p10.badlandsWeight * w10 + p01.badlandsWeight * w01 + p11.badlandsWeight * w11,
    mountainWeight:
      p00.mountainWeight * w00 + p10.mountainWeight * w10 + p01.mountainWeight * w01 + p11.mountainWeight * w11,
    swampWeight: p00.swampWeight * w00 + p10.swampWeight * w10 + p01.swampWeight * w01 + p11.swampWeight * w11,
    desertWeight: p00.desertWeight * w00 + p10.desertWeight * w10 + p01.desertWeight * w01 + p11.desertWeight * w11,
    savannaWeight: p00.savannaWeight * w00 + p10.savannaWeight * w10 + p01.savannaWeight * w01 + p11.savannaWeight * w11,
  };
}

/**
 * Samples low-frequency sinuous river channels via ridged zero-crossing noise (freq = 0.003).
 * Where |riverNoise| < 0.045, carves terrain cleanly below SEA_LEVEL (42).
 */
export function sampleRiverFactor(noise: SeededNoise, wx: number, wz: number): RiverSample {
  const rx = wx + noise.terrainOffsetX;
  const rz = wz + noise.terrainOffsetZ;
  // Subtle meander warp so river ribbons twist organically across macro biomes
  const meanderX = rx + noise.noise2D(rx * 0.008 + 14.2, rz * 0.008 - 9.7) * 18;
  const meanderZ = rz + noise.noise2D(rx * 0.008 - 51.4, rz * 0.008 + 33.8) * 18;
  // Scaled into [-1, 1] so |riverNoise| < 0.045 carves realistic 10-18 block sinuous rivers
  const riverNoise = noise.fbm2D((meanderX + 312.7) * 0.003, (meanderZ - 241.3) * 0.003, 2, 2.0, 0.42) * 2.1;
  const absR = Math.abs(riverNoise);

  const channel = smoothstep(0.045, 0.012, absR);
  const valley = smoothstep(0.115, 0.038, absR);
  return {
    riverNoise,
    channel,
    valley,
    isRiver: absR < 0.045,
  };
}

/**
 * Computes final terrain surface Y from pre-blended biome relief parameters + FBM detail +
 * terraced Badlands mesas + mountain ridges + sinuous river carving.
 * Used both by single-column lookups and chunk-wide 4-block bilinear interpolation.
 */
export function computeSurfaceHeightFromBlended(
  noise: SeededNoise,
  wx: number,
  wz: number,
  blended: BlendedTerrainParams,
  worldType: WorldType = 'default',
  riverOverride?: RiverSample
): { height: number; river: RiverSample } {
  const river = riverOverride ?? sampleRiverFactor(noise, wx, wz);
  if (worldType === 'superflat') {
    return { height: 4, river };
  }

  const tx = wx + noise.terrainOffsetX;
  const tz = wz + noise.terrainOffsetZ;
  const amp = worldType === 'amplified' ? 1.85 : 1.0;

  const continental = noise.fbm2D(tx * 0.0042 - 17.5, tz * 0.0042 + 23.2, 2);
  const reliefFbm = noise.fbm2D(tx * 0.0115, tz * 0.0115, 4);
  const detailFbm = noise.fbm2D(tx * 0.028 + 200, tz * 0.028 - 130, 3);
  const lakeDip = noise.fbm2D(tx * 0.014 - 75, tz * 0.014 + 55, 2);

  // Base smoothly blended elevation across all 8 biomes
  let h =
    blended.baseHeight +
    (reliefFbm * 1.15 + continental * 0.45 + detailFbm * 0.25) * blended.heightScale * amp;

  // Natural shallow ponds in temperate/flat lowlands (suppressed in mountains & badlands)
  const pondMask = Math.max(0, 1 - blended.mountainWeight - blended.badlandsWeight);
  if (lakeDip < -0.26 && pondMask > 0.05) {
    h += (lakeDip + 0.26) * 28 * pondMask;
  }

  // Gentle wind-swept dunes in Desert
  if (blended.desertWeight > 0.01) {
    const duneWave = Math.sin(tx * 0.048 + reliefFbm * 3.5) * 1.9 * amp;
    h += duneWave * blended.desertWeight;
  }

  // Broad stepped plateaus in Savanna
  if (blended.savannaWeight > 0.01) {
    const savPlateau = smoothstep(0.04, 0.22, reliefFbm) * 4.5 * amp;
    h += savPlateau * blended.savannaWeight;
  }

  // Marshy shallow flats hovering around SEA_LEVEL (42) in Swamp
  if (blended.swampWeight > 0.01) {
    const swampPool = noise.fbm2D(tx * 0.042 + 17, tz * 0.042 - 29, 2);
    const swampTarget = 42.3 + swampPool * 3.2 + detailFbm * 0.8;
    h = h + (swampTarget - h) * blended.swampWeight * 0.65;
  }

  // Dramatic ridged mountain peaks exceeding Y=82 for snow-capped summits
  if (blended.mountainWeight > 0.01) {
    const ridge = 1 - Math.abs(noise.fbm2D(tx * 0.015 - 40, tz * 0.015 + 80, 3));
    const ridgeBoost = Math.max(0, ridge * ridge - 0.28) * 36 * amp;
    h += ridgeBoost * blended.mountainWeight;
  }

  // Badlands: steep canyon mesas rising 10 to 22 blocks with smooth flat-clamped tops
  if (blended.badlandsWeight > 0.01) {
    const mesaNoise = noise.fbm2D(tx * 0.0105 + 61, tz * 0.0105 - 47, 3);
    const tier1 = smoothstep(-0.07, 0.045, mesaNoise) * 11.5;
    const tier2 = smoothstep(0.135, 0.23, mesaNoise) * 9.5;
    // Soft plateau top clamp so canyon summits stay flat and iconic
    const rawMesaRise = tier1 + tier2;
    const clampedMesaRise = rawMesaRise > 19.5 ? 19.5 + (rawMesaRise - 19.5) * 0.25 : rawMesaRise;
    const canyonFloor = 45.2 + continental * 2.2 + detailFbm * 1.1;
    const mesaElevation = canyonFloor + clampedMesaRise * amp;
    h = h + (mesaElevation - h) * blended.badlandsWeight;
  }

  // Sinuous river valley easing + riverbed carving below SEA_LEVEL (42)
  if (river.valley > 0) {
    const bankTarget = Math.min(h, 43.4 + detailFbm * 1.1);
    const valleyStrength = blended.mountainWeight > 0.3 ? river.valley * 0.92 : river.valley * 0.82;
    h = h + (bankTarget - h) * valleyStrength;
  }
  if (river.channel > 0) {
    const bedTarget = Math.min(h, 36.2 + detailFbm * 1.3);
    h = h + (bedTarget - h) * river.channel;
  }

  const maxH = worldType === 'amplified' ? 114 : 95;
  const minH = worldType === 'amplified' ? 24 : 28;
  const height = Math.max(minH, Math.min(maxH, Math.round(h)));

  return { height, river };
}

/**
 * Evaluates 8 Overworld biomes (Plains, Desert, Mountains, Snowy Taiga, Jungle, Swamp, Savanna, Badlands)
 * from macro domain-warped climate noise and 5x5 Gaussian blended terrain heights.
 * Supports Default (Y in [28, 95]), Superflat (Y=4 Plains), and Amplified (peaks up to Y=114).
 */
export function sampleTerrainColumn(
  noise: SeededNoise,
  wx: number,
  wz: number,
  worldType: WorldType = 'default'
): ColumnSample {
  if (worldType === 'superflat') {
    return {
      biome: 'Plains',
      height: 4,
      temperature: 0.0,
      humidity: 0.0,
      isRiver: false,
      riverChannel: 0,
      riverValley: 0,
    };
  }

  const climate = sampleClimateBiome(noise, wx, wz);
  const blended = getInterpolatedBlendedTerrainParams(noise, wx, wz);
  const { height, river } = computeSurfaceHeightFromBlended(noise, wx, wz, blended, worldType);

  return {
    biome: climate.biome,
    height,
    temperature: climate.temperature,
    humidity: climate.humidity,
    isRiver: river.isRiver,
    riverChannel: river.channel,
    riverValley: river.valley,
  };
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function isCaveAt(noise: SeededNoise, wx: number, wy: number, wz: number): boolean {
  if (wy <= 2) return false;
  const n = (noise.noise3D((wx + noise.caveOffsetX) * 0.05, wy * 0.07, (wz + noise.caveOffsetZ) * 0.05) + 1) * 0.5;
  return n > 0.62;
}

/**
 * Samples the Nether sub-biome at (wx, wz): classic crimson Nether Wastes vs. Soul Sand Valley.
 */
export function sampleNetherBiome(
  noise: SeededNoise,
  wx: number,
  wz: number
): 'Nether Wastes' | 'Soul Sand Valley' {
  const n = noise.fbm2D(
    (wx + noise.biomeOffsetX) * 0.0095 + 143.7,
    (wz + noise.biomeOffsetZ) * 0.0095 - 91.3,
    2
  );
  return n > 0.16 ? 'Soul Sand Valley' : 'Nether Wastes';
}

/**
 * 3D multi-octave density function for cavernous Nether terrain (Y in 4..123).
 * Positive values are solid Netherrack; values <= 0 are carved caverns (filled with Lava at Y <= 31).
 */
export function sampleNetherDensity(
  noise: SeededNoise,
  wx: number,
  wy: number,
  wz: number
): number {
  const ox = wx + noise.terrainOffsetX * 0.5;
  const oz = wz + noise.terrainOffsetZ * 0.5;

  // Coarse 3D cavern structure + finer rocky overhangs
  const coarse = noise.noise3D(ox * 0.022, wy * 0.032, oz * 0.022);
  const medium = noise.noise3D(ox * 0.048 + 73.1, wy * 0.055 - 19.4, oz * 0.048 + 41.2) * 0.45;

  // 2D shelf bias creating walkable terrain bands around Y=34..58 while keeping vast lava lakes
  const shelfNoise = noise.fbm2D(ox * 0.014 - 31.5, oz * 0.014 + 57.2, 3);
  const floorBand = wy < 46 ? (44 - wy) * 0.032 + shelfNoise * 0.35 : 0;

  // Enforce solid bedrock-hugging floor & ceiling slabs with organic stalactite thickness
  let verticalBias = -0.14;
  if (wy <= 12) {
    verticalBias += (12 - wy) * 0.12;
  } else if (wy >= 106) {
    verticalBias += (wy - 106) * 0.085;
  } else if (wy >= 46 && wy <= 92) {
    // Encourage grand open halls & bridge vistas in the mid-Nether
    verticalBias -= 0.16;
  }

  return coarse + medium + floorBand + verticalBias;
}

