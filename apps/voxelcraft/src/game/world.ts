import {
  ALL_SAPLING_IDS,
  BLOCK_IDS,
  BLOCKS,
  CHUNK_HEIGHT,
  CHUNK_SIZE,
  getIndex,
  LAVA_LEVEL,
  SEA_LEVEL,
} from './blocks';
import {
  BIOME_RELIEF_PROFILES,
  BLEND_KERNEL_WEIGHTS,
  computeSurfaceHeightFromBlended,
  isCaveAt,
  sampleClimateBiome,
  sampleNetherBiome,
  sampleNetherDensity,
  sampleTerrainColumn,
  SeededNoise,
  type BlendedTerrainParams,
} from './noise';
import {
  StructureGenerator,
  type StructureBlazeSpec,
  type StructureDescriptor,
  type StructureVillagerSpec,
} from './structures';
import type {
  BiomeType,
  ChestTileEntity,
  DimensionId,
  FurnaceTileEntity,
  TileEntityData,
  WorldType,
} from './types';

export const CHUNK_VOLUME = CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE;

export class Chunk {
  public readonly blocks: Uint16Array;
  public readonly light: Uint8Array;
  public dirty = true;
  public lightDirty = true;

  constructor(public readonly cx: number, public readonly cz: number) {
    this.blocks = new Uint16Array(CHUNK_VOLUME);
    this.light = new Uint8Array(CHUNK_VOLUME);
  }

  public getBlock(x: number, y: number, z: number): number {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
      return 0;
    }
    return this.blocks[getIndex(x, y, z)];
  }

  public setBlock(x: number, y: number, z: number, id: number): void {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
      return;
    }
    this.blocks[getIndex(x, y, z)] = id;
    this.dirty = true;
    this.lightDirty = true;
  }

  public getSkyLight(x: number, y: number, z: number): number {
    if (y >= CHUNK_HEIGHT) return 15;
    if (y < 0 || x < 0 || x >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE) return 0;
    return (this.light[getIndex(x, y, z)] >>> 4) & 0x0f;
  }

  public setSkyLight(x: number, y: number, z: number, val: number): void {
    const idx = getIndex(x, y, z);
    this.light[idx] = (this.light[idx] & 0x0f) | ((val & 0x0f) << 4);
  }

  public getBlockLight(x: number, y: number, z: number): number {
    if (y < 0 || y >= CHUNK_HEIGHT || x < 0 || x >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE) {
      return 0;
    }
    return this.light[getIndex(x, y, z)] & 0x0f;
  }

  public setBlockLight(x: number, y: number, z: number, val: number): void {
    const idx = getIndex(x, y, z);
    this.light[idx] = (this.light[idx] & 0xf0) | (val & 0x0f);
  }
}

export function chunkKey(cx: number, cz: number): string {
  return `${cx},${cz}`;
}

export function worldToChunkCoord(w: number): number {
  return Math.floor(w / CHUNK_SIZE);
}

export function worldToLocalCoord(w: number): number {
  return ((w % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
}

const NEIGHBOR_DIRS: ReadonlyArray<[number, number, number]> = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

/**
 * Fixed 24-block horizontal Terracotta strata for Badlands mesas:
 * predominantly Orange, Brown, and Light Gray Terracotta with thin 1-2 block
 * accents of Red, Yellow, and White Terracotta.
 */
const BADLANDS_STRATA: ReadonlyArray<number> = [
  BLOCK_IDS.ORANGE_TERRACOTTA,
  BLOCK_IDS.ORANGE_TERRACOTTA,
  BLOCK_IDS.BROWN_TERRACOTTA,
  BLOCK_IDS.BROWN_TERRACOTTA,
  BLOCK_IDS.RED_TERRACOTTA,
  BLOCK_IDS.ORANGE_TERRACOTTA,
  BLOCK_IDS.LIGHT_GRAY_TERRACOTTA,
  BLOCK_IDS.LIGHT_GRAY_TERRACOTTA,
  BLOCK_IDS.YELLOW_TERRACOTTA,
  BLOCK_IDS.ORANGE_TERRACOTTA,
  BLOCK_IDS.ORANGE_TERRACOTTA,
  BLOCK_IDS.BROWN_TERRACOTTA,
  BLOCK_IDS.WHITE_TERRACOTTA,
  BLOCK_IDS.LIGHT_GRAY_TERRACOTTA,
  BLOCK_IDS.ORANGE_TERRACOTTA,
  BLOCK_IDS.RED_TERRACOTTA,
  BLOCK_IDS.RED_TERRACOTTA,
  BLOCK_IDS.BROWN_TERRACOTTA,
  BLOCK_IDS.BROWN_TERRACOTTA,
  BLOCK_IDS.ORANGE_TERRACOTTA,
  BLOCK_IDS.YELLOW_TERRACOTTA,
  BLOCK_IDS.LIGHT_GRAY_TERRACOTTA,
  BLOCK_IDS.ORANGE_TERRACOTTA,
  BLOCK_IDS.BROWN_TERRACOTTA,
];

/**
 * Pure voxel World container holding Chunk Map, TileEntities (Chests & Furnaces),
 * Sapling growth timers, deterministic biomes/ores/caves/vegetation/trees, and BFS lighting.
 */
export class World {
  public readonly chunks = new Map<string, Chunk>();
  public readonly noise: SeededNoise;
  public readonly worldType: WorldType;
  public readonly dimension: DimensionId;
  public readonly structures: StructureGenerator;
  public readonly blockEdits = new Map<string, number>();
  /** Persistent tile entity storage keyed by "x,y,z" (Chests & Furnaces) */
  public readonly tileEntities = new Map<string, TileEntityData>();
  /** Planted Oak Sapling growth timers keyed by "x,y,z" -> remaining seconds */
  public readonly saplings = new Map<string, number>();
  /** Villagers queued by newly generated Village chunks, drained by VoxelEngine */
  public readonly pendingVillagerSpawns: StructureVillagerSpec[] = [];
  private readonly spawnedVillagerIds = new Set<string>();
  /** Blazes queued by newly generated Nether Fortress Blaze Platforms, drained by VoxelEngine */
  public readonly pendingBlazeSpawns: StructureBlazeSpec[] = [];
  private readonly spawnedBlazeIds = new Set<string>();

  constructor(
    public readonly seed: number,
    worldType: WorldType = 'default',
    dimension: DimensionId = 'overworld'
  ) {
    this.worldType = worldType;
    this.dimension = dimension;
    this.noise = new SeededNoise(dimension === 'nether' ? ((seed ^ 0x5f3759df) >>> 0) : seed);
    this.structures = new StructureGenerator(this.noise, worldType, dimension);
  }

  public getChunk(cx: number, cz: number): Chunk | undefined {
    return this.chunks.get(chunkKey(cx, cz));
  }

  public getBiomeAt(wx: number, wz: number): BiomeType {
    if (this.dimension === 'nether') {
      return sampleNetherBiome(this.noise, wx, wz);
    }
    return sampleTerrainColumn(this.noise, wx, wz, this.worldType).biome;
  }

  public getSurfaceHeightAt(wx: number, wz: number): number {
    if (this.dimension === 'nether') {
      return this.getHighestBlockAt(wx, wz).y;
    }
    return sampleTerrainColumn(this.noise, wx, wz, this.worldType).height;
  }

  public getNearbyStructures(wx: number, wz: number, chunkRadius = 10): StructureDescriptor[] {
    return this.structures.getStructuresNearWorldPos(wx, wz, chunkRadius);
  }

  public getBlock(wx: number, wy: number, wz: number): number {
    if (wy < 0) return BLOCK_IDS.BEDROCK;
    if (wy >= CHUNK_HEIGHT) return BLOCK_IDS.AIR;
    const cx = worldToChunkCoord(wx);
    const cz = worldToChunkCoord(wz);
    const chunk = this.chunks.get(chunkKey(cx, cz));
    if (!chunk) return BLOCK_IDS.AIR;
    return chunk.getBlock(worldToLocalCoord(wx), wy, worldToLocalCoord(wz));
  }

  public getHighestBlockAt(wx: number, wz: number): { y: number; blockId: number } {
    const cx = worldToChunkCoord(wx);
    const cz = worldToChunkCoord(wz);
    const chunk = this.chunks.get(chunkKey(cx, cz));
    if (this.dimension === 'nether') {
      if (!chunk) {
        return { y: LAVA_LEVEL, blockId: BLOCK_IDS.LAVA };
      }
      const lx = worldToLocalCoord(wx);
      const lz = worldToLocalCoord(wz);
      return this.scanNetherColumnSurface(chunk, lx, lz);
    }
    if (!chunk) {
      if (this.worldType === 'superflat') {
        return { y: 4, blockId: BLOCK_IDS.GRASS };
      }
      const col = sampleTerrainColumn(this.noise, wx, wz, this.worldType);
      const id =
        col.height <= SEA_LEVEL
          ? BLOCK_IDS.WATER
          : col.biome === 'Desert'
          ? BLOCK_IDS.SAND
          : col.biome === 'Badlands'
          ? BLOCK_IDS.ORANGE_TERRACOTTA
          : col.biome === 'Snowy Taiga'
          ? BLOCK_IDS.SNOW_GRASS
          : col.biome === 'Mountains' && col.height > 82
          ? BLOCK_IDS.SNOW_BLOCK
          : BLOCK_IDS.GRASS;
      return { y: Math.max(col.height, SEA_LEVEL), blockId: id };
    }
    const lx = worldToLocalCoord(wx);
    const lz = worldToLocalCoord(wz);
    for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
      const id = chunk.blocks[getIndex(lx, y, lz)];
      const def = BLOCKS[id];
      if (
        id !== BLOCK_IDS.AIR &&
        !def?.crossMesh &&
        id !== BLOCK_IDS.TORCH &&
        !def?.isSoulTorch &&
        !def?.isLantern &&
        id !== BLOCK_IDS.FIRE
      ) {
        return { y, blockId: id };
      }
    }
    return { y: 0, blockId: BLOCK_IDS.BEDROCK };
  }

  /**
   * Scans downward from Y=110 inside the Nether, skipping the Bedrock/Netherrack ceiling
   * until an open cavern pocket is encountered, then returning the first navigable surface
   * (Nether Bricks, Netherrack, Soul Sand, Magma, or Lava).
   */
  private scanNetherColumnSurface(chunk: Chunk, lx: number, lz: number): { y: number; blockId: number } {
    let sawAir = false;
    for (let y = 110; y >= 4; y--) {
      const id = chunk.blocks[getIndex(lx, y, lz)];
      const open =
        id === BLOCK_IDS.AIR ||
        id === BLOCK_IDS.FIRE ||
        id === BLOCK_IDS.TORCH ||
        id === BLOCK_IDS.NETHER_PORTAL;
      if (open) {
        sawAir = true;
        continue;
      }
      if (sawAir) {
        return { y, blockId: id };
      }
    }
    // Solid ceiling-to-floor Netherrack column
    const midId = chunk.blocks[getIndex(lx, 64, lz)] || BLOCK_IDS.NETHERRACK;
    return { y: 64, blockId: midId };
  }

  /**
   * Builds a compact 512-byte (256 x Uint16) surface map slice for Fog-of-War world map rendering:
   * lower 14 bits = surface blockId (0..16383), upper 2 bits = height contour tier (0..3).
   */
  public encodeChunkMapSlice(chunk: Chunk): string {
    const bytes = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * 2);
    const isNether = this.dimension === 'nether';
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        let topId: number = isNether ? BLOCK_IDS.NETHERRACK : BLOCK_IDS.GRASS;
        let topY = 0;
        if (isNether) {
          const hit = this.scanNetherColumnSurface(chunk, lx, lz);
          topId = hit.blockId;
          topY = hit.y;
        } else {
          for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
            const id = chunk.blocks[getIndex(lx, y, lz)];
            const def = BLOCKS[id];
            if (
              id !== BLOCK_IDS.AIR &&
              !def?.crossMesh &&
              id !== BLOCK_IDS.TORCH &&
              !def?.isSoulTorch &&
              !def?.isLantern &&
              id !== BLOCK_IDS.FIRE
            ) {
              topId = id;
              topY = y;
              break;
            }
          }
        }
        const tier = isNether
          ? topY <= LAVA_LEVEL
            ? 0
            : topY < 48
            ? 1
            : topY < 62
            ? 2
            : 3
          : topY < 43
          ? 0
          : topY < 56
          ? 1
          : topY < 72
          ? 2
          : 3;
        const packed = (topId & 0x3fff) | (tier << 14);
        const offset = (lz * CHUNK_SIZE + lx) * 2;
        bytes[offset] = packed & 0xff;
        bytes[offset + 1] = (packed >>> 8) & 0xff;
      }
    }
    let bin = '';
    for (let i = 0; i < bytes.length; i++) {
      bin += String.fromCharCode(bytes[i]);
    }
    return typeof btoa === 'function' ? btoa(bin) : Buffer.from(bytes).toString('base64');
  }

  public getSkyLight(wx: number, wy: number, wz: number): number {
    if (wy >= CHUNK_HEIGHT) return 15;
    if (wy < 0) return 0;
    const cx = worldToChunkCoord(wx);
    const cz = worldToChunkCoord(wz);
    const chunk = this.chunks.get(chunkKey(cx, cz));
    if (!chunk) return 15;
    return chunk.getSkyLight(worldToLocalCoord(wx), wy, worldToLocalCoord(wz));
  }

  public getBlockLight(wx: number, wy: number, wz: number): number {
    if (wy < 0 || wy >= CHUNK_HEIGHT) return 0;
    const cx = worldToChunkCoord(wx);
    const cz = worldToChunkCoord(wz);
    const chunk = this.chunks.get(chunkKey(cx, cz));
    if (!chunk) return 0;
    return chunk.getBlockLight(worldToLocalCoord(wx), wy, worldToLocalCoord(wz));
  }

  public getOrCreateChest(x: number, y: number, z: number): ChestTileEntity {
    const key = `${x},${y},${z}`;
    const existing = this.tileEntities.get(key);
    if (existing && existing.type === 'chest') return existing;
    const created: ChestTileEntity = {
      type: 'chest',
      key,
      slots: new Array(27).fill(null),
    };
    this.tileEntities.set(key, created);
    return created;
  }

  public getOrCreateFurnace(x: number, y: number, z: number): FurnaceTileEntity {
    const key = `${x},${y},${z}`;
    const existing = this.tileEntities.get(key);
    if (existing && existing.type === 'furnace') return existing;
    const created: FurnaceTileEntity = {
      type: 'furnace',
      key,
      input: null,
      fuel: null,
      output: null,
      burnTime: 0,
      burnDuration: 1,
      cookProgress: 0,
    };
    this.tileEntities.set(key, created);
    return created;
  }

  public setBlock(wx: number, wy: number, wz: number, id: number, recordEdit = true): boolean {
    if (wy <= 0 || wy >= CHUNK_HEIGHT) return false;
    const cx = worldToChunkCoord(wx);
    const cz = worldToChunkCoord(wz);
    const chunk = this.chunks.get(chunkKey(cx, cz));
    if (!chunk) return false;

    const lx = worldToLocalCoord(wx);
    const lz = worldToLocalCoord(wz);
    if (chunk.getBlock(lx, wy, lz) === id) return false;

    chunk.setBlock(lx, wy, lz, id);
    const editKey = `${wx},${wy},${wz}`;
    if (recordEdit) {
      this.blockEdits.set(editKey, id);
    }

    // Tile entity & sapling hooks
    if (id === BLOCK_IDS.CHEST || id === BLOCK_IDS.BARREL) {
      this.getOrCreateChest(wx, wy, wz);
    } else if (id === BLOCK_IDS.FURNACE) {
      this.getOrCreateFurnace(wx, wy, wz);
    } else if (ALL_SAPLING_IDS.includes(id)) {
      this.saplings.set(editKey, 18 + Math.random() * 24);
    } else {
      if (this.saplings.has(editKey)) this.saplings.delete(editKey);
    }

    this.recomputeChunkAndNeighborLight(cx, cz);

    if (lx === 0) this.markChunkDirty(cx - 1, cz);
    if (lx === CHUNK_SIZE - 1) this.markChunkDirty(cx + 1, cz);
    if (lz === 0) this.markChunkDirty(cx, cz - 1);
    if (lz === CHUNK_SIZE - 1) this.markChunkDirty(cx, cz + 1);

    return true;
  }

  /**
   * Advances planted Saplings (all 5 wood species) and grows mature ones into full Trees.
   */
  public tickSaplings(dt: number): void {
    for (const [key, remaining] of this.saplings.entries()) {
      const next = remaining - dt;
      if (next > 0) {
        this.saplings.set(key, next);
        continue;
      }
      this.saplings.delete(key);
      const [wx, wy, wz] = key.split(',').map(Number);
      const curId = this.getBlock(wx, wy, wz);
      if (!ALL_SAPLING_IDS.includes(curId)) continue;
      this.growTree(wx, wy, wz, curId);
    }
  }

  public growOakTree(wx: number, baseY: number, wz: number): void {
    this.growTree(wx, baseY, wz, BLOCK_IDS.OAK_SAPLING);
  }

  public growTree(wx: number, baseY: number, wz: number, saplingId: number = BLOCK_IDS.OAK_SAPLING): void {
    const speciesMap: Record<number, { log: number; leaves: number; heightBonus: number }> = {
      [BLOCK_IDS.OAK_SAPLING]: { log: BLOCK_IDS.OAK_LOG, leaves: BLOCK_IDS.OAK_LEAVES, heightBonus: 0 },
      [BLOCK_IDS.BIRCH_SAPLING]: { log: BLOCK_IDS.BIRCH_LOG, leaves: BLOCK_IDS.BIRCH_LEAVES, heightBonus: 1 },
      [BLOCK_IDS.SPRUCE_SAPLING]: { log: BLOCK_IDS.SPRUCE_LOG, leaves: BLOCK_IDS.SPRUCE_LEAVES, heightBonus: 2 },
      [BLOCK_IDS.JUNGLE_SAPLING]: { log: BLOCK_IDS.JUNGLE_LOG, leaves: BLOCK_IDS.JUNGLE_LEAVES, heightBonus: 3 },
      [BLOCK_IDS.ACACIA_SAPLING]: { log: BLOCK_IDS.ACACIA_LOG, leaves: BLOCK_IDS.ACACIA_LEAVES, heightBonus: 1 },
    };
    const spec = speciesMap[saplingId] ?? speciesMap[BLOCK_IDS.OAK_SAPLING];
    const trunkHeight = 4 + spec.heightBonus + Math.floor(Math.random() * 2);
    const topY = baseY + trunkHeight - 1;
    // Place leaves
    for (let dy = -2; dy <= 1; dy++) {
      const ly = topY + dy;
      if (ly <= 0 || ly >= CHUNK_HEIGHT) continue;
      const radius = dy === 1 ? 1 : 2;
      for (let dz = -radius; dz <= radius; dz++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.abs(dx) === radius && Math.abs(dz) === radius && dy >= 0) continue;
          const cur = this.getBlock(wx + dx, ly, wz + dz);
          if (cur === BLOCK_IDS.AIR || ALL_SAPLING_IDS.includes(cur)) {
            this.setBlock(wx + dx, ly, wz + dz, spec.leaves, true);
          }
        }
      }
    }
    // Place trunk
    for (let y = baseY; y <= topY; y++) {
      if (y > 0 && y < CHUNK_HEIGHT) {
        this.setBlock(wx, y, wz, spec.log, true);
      }
    }
  }

  private markChunkDirty(cx: number, cz: number): void {
    const c = this.chunks.get(chunkKey(cx, cz));
    if (c) c.dirty = true;
  }

  private getTreeAt(
    tx: number,
    tz: number
  ): { baseY: number; trunkHeight: number; snowy: boolean; logId: number; leavesId: number } | null {
    if (Math.abs(tx) <= 4 && Math.abs(tz) <= 4) return null;

    // Fast O(1) hash rejection skips >96% of columns before any noise sampling
    const h = this.noise.hash2D(tx, tz, 913);
    if (h > 0.038) return null;

    // Fast climate rejection before full height evaluation (no trees in Desert, Badlands, Mountains)
    const climate = sampleClimateBiome(this.noise, tx, tz);
    if (
      climate.biome !== 'Plains' &&
      climate.biome !== 'Snowy Taiga' &&
      climate.biome !== 'Jungle' &&
      climate.biome !== 'Swamp' &&
      climate.biome !== 'Savanna'
    ) {
      return null;
    }

    // Natural biome tree density: sparse in Plains/Savanna, dense in Jungle/Snowy Taiga
    const densityThreshold =
      climate.biome === 'Jungle'
        ? 0.038
        : climate.biome === 'Snowy Taiga'
        ? 0.024
        : climate.biome === 'Swamp'
        ? 0.014
        : climate.biome === 'Plains'
        ? 0.0075
        : 0.0055; // Savanna
    if (h > densityThreshold) return null;

    const spacing =
      climate.biome === 'Jungle' || climate.biome === 'Snowy Taiga'
        ? 2
        : climate.biome === 'Swamp'
        ? 3
        : climate.biome === 'Plains'
        ? 4
        : 5;

    for (let dx = -spacing; dx <= spacing; dx++) {
      for (let dz = -spacing; dz <= spacing; dz++) {
        if (dx === 0 && dz === 0) continue;
        if (this.noise.hash2D(tx + dx, tz + dz, 913) < h) return null;
      }
    }

    const col = sampleTerrainColumn(this.noise, tx, tz, this.worldType);
    // Never spawn trees inside water, rivers, or sandy/gravel beaches (<= SEA_LEVEL + 2)
    if (col.isRiver || col.riverChannel > 0.05) return null;
    const minY = col.biome === 'Swamp' ? SEA_LEVEL + 1 : SEA_LEVEL + 3;
    if (col.height < minY || col.height >= 74) return null;

    const trunkHeight = 4 + Math.floor(this.noise.hash2D(tx, tz, 1777) * 3);
    if (col.biome === 'Snowy Taiga') {
      return {
        baseY: col.height + 1,
        trunkHeight: trunkHeight + 1,
        snowy: true,
        logId: BLOCK_IDS.SPRUCE_LOG,
        leavesId: BLOCK_IDS.SPRUCE_LEAVES,
      };
    }
    if (col.biome === 'Jungle') {
      return {
        baseY: col.height + 1,
        trunkHeight: trunkHeight + 4 + Math.floor(this.noise.hash2D(tx, tz, 1993) * 3),
        snowy: false,
        logId: BLOCK_IDS.JUNGLE_LOG,
        leavesId: BLOCK_IDS.JUNGLE_LEAVES,
      };
    }
    if (col.biome === 'Savanna') {
      return {
        baseY: col.height + 1,
        trunkHeight: trunkHeight + 1,
        snowy: false,
        logId: BLOCK_IDS.ACACIA_LOG,
        leavesId: BLOCK_IDS.ACACIA_LEAVES,
      };
    }
    if (col.biome === 'Swamp') {
      return {
        baseY: col.height + 1,
        trunkHeight,
        snowy: false,
        logId: BLOCK_IDS.OAK_LOG,
        leavesId: BLOCK_IDS.OAK_LEAVES,
      };
    }

    // Plains: Oak (65%) & Birch (35%) groves
    const speciesRoll = this.noise.hash2D(Math.floor(tx / 24), Math.floor(tz / 24), 4813);
    const localRoll = this.noise.hash2D(tx, tz, 4831);
    const isBirch = speciesRoll < 0.32 || localRoll < 0.25;
    return {
      baseY: col.height + 1,
      trunkHeight,
      snowy: false,
      logId: isBirch ? BLOCK_IDS.BIRCH_LOG : BLOCK_IDS.OAK_LOG,
      leavesId: isBirch ? BLOCK_IDS.BIRCH_LEAVES : BLOCK_IDS.OAK_LEAVES,
    };
  }

  /**
   * Generates chunk terrain, 4 biomes, caves, Coal/Iron/Gold/Diamond veins,
   * cross-chunk trees (snow-capped in Snowy Taiga), and Plains Tall Grass / Red Flowers.
   */
  public generateChunk(cx: number, cz: number): Chunk {
    const key = chunkKey(cx, cz);
    const existing = this.chunks.get(key);
    if (existing) return existing;

    const chunk = new Chunk(cx, cz);
    const baseX = cx * CHUNK_SIZE;
    const baseZ = cz * CHUNK_SIZE;

    if (this.dimension === 'nether') {
      this.generateNetherChunk(chunk, cx, cz);
    } else if (this.worldType === 'superflat') {
      // Superplano: Bedrock Y=0, 3 Dirt Y=1..3, Grass Y=4
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          chunk.blocks[getIndex(lx, 0, lz)] = BLOCK_IDS.BEDROCK;
          chunk.blocks[getIndex(lx, 1, lz)] = BLOCK_IDS.DIRT;
          chunk.blocks[getIndex(lx, 2, lz)] = BLOCK_IDS.DIRT;
          chunk.blocks[getIndex(lx, 3, lz)] = BLOCK_IDS.DIRT;
          chunk.blocks[getIndex(lx, 4, lz)] = BLOCK_IDS.GRASS;
        }
      }
    } else {
      // 1. Coarse 4-block Gaussian-blended terrain parameter grid (53x speedup over per-column 5x5)
      // Sample 11x11 climate nodes covering local offsets -12..+28 (step 4)
      const CLIMATE_N = 11;
      const climateGrid: BiomeType[] = new Array(CLIMATE_N * CLIMATE_N);
      for (let iz = 0; iz < CLIMATE_N; iz++) {
        const wz = baseZ + (iz - 3) * 4;
        for (let ix = 0; ix < CLIMATE_N; ix++) {
          const wx = baseX + (ix - 3) * 4;
          climateGrid[iz * CLIMATE_N + ix] = sampleClimateBiome(this.noise, wx, wz).biome;
        }
      }

      // Convolve with 5x5 Gaussian kernel into 7x7 coarse blended nodes covering local -4..+20 (step 4)
      const COARSE_N = 7;
      const coarseParams: BlendedTerrainParams[] = new Array(COARSE_N * COARSE_N);
      for (let gz = 0; gz < COARSE_N; gz++) {
        for (let gx = 0; gx < COARSE_N; gx++) {
          let baseHeight = 0;
          let heightScale = 0;
          let badlandsWeight = 0;
          let mountainWeight = 0;
          let swampWeight = 0;
          let desertWeight = 0;
          let savannaWeight = 0;
          let k = 0;
          for (let kz = 0; kz < 5; kz++) {
            const rowOffset = (gz + kz) * CLIMATE_N + gx;
            for (let kx = 0; kx < 5; kx++) {
              const b = climateGrid[rowOffset + kx];
              const w = BLEND_KERNEL_WEIGHTS[k++];
              const prof = BIOME_RELIEF_PROFILES[b];
              baseHeight += prof.baseHeight * w;
              heightScale += prof.heightScale * w;
              if (b === 'Badlands') badlandsWeight += w;
              else if (b === 'Mountains') mountainWeight += w;
              else if (b === 'Swamp') swampWeight += w;
              else if (b === 'Desert') desertWeight += w;
              else if (b === 'Savanna') savannaWeight += w;
            }
          }
          coarseParams[gz * COARSE_N + gx] = {
            baseHeight,
            heightScale,
            badlandsWeight,
            mountainWeight,
            swampWeight,
            desertWeight,
            savannaWeight,
          };
        }
      }

      // Compute 20x20 height & river halo (local coords -2..+17) via bilinear interpolation of coarse grid
      const HALO_N = CHUNK_SIZE + 4; // 20
      const haloHeight = new Int16Array(HALO_N * HALO_N);
      const haloRiverChannel = new Float32Array(HALO_N * HALO_N);
      const interp: BlendedTerrainParams = {
        baseHeight: 46,
        heightScale: 9,
        badlandsWeight: 0,
        mountainWeight: 0,
        swampWeight: 0,
        desertWeight: 0,
        savannaWeight: 0,
      };

      for (let hz = 0; hz < HALO_N; hz++) {
        const lz = hz - 2;
        const wz = baseZ + lz;
        const fz = (lz + 4) * 0.25;
        const gz0 = Math.floor(fz);
        const tz = fz - gz0;
        const gz1 = gz0 + 1;
        const row0 = gz0 * COARSE_N;
        const row1 = gz1 * COARSE_N;

        for (let hx = 0; hx < HALO_N; hx++) {
          const lx = hx - 2;
          const wx = baseX + lx;
          const fx = (lx + 4) * 0.25;
          const gx0 = Math.floor(fx);
          const tx = fx - gx0;
          const gx1 = gx0 + 1;

          const p00 = coarseParams[row0 + gx0];
          const p10 = coarseParams[row0 + gx1];
          const p01 = coarseParams[row1 + gx0];
          const p11 = coarseParams[row1 + gx1];
          const w00 = (1 - tx) * (1 - tz);
          const w10 = tx * (1 - tz);
          const w01 = (1 - tx) * tz;
          const w11 = tx * tz;

          interp.baseHeight = p00.baseHeight * w00 + p10.baseHeight * w10 + p01.baseHeight * w01 + p11.baseHeight * w11;
          interp.heightScale = p00.heightScale * w00 + p10.heightScale * w10 + p01.heightScale * w01 + p11.heightScale * w11;
          interp.badlandsWeight =
            p00.badlandsWeight * w00 + p10.badlandsWeight * w10 + p01.badlandsWeight * w01 + p11.badlandsWeight * w11;
          interp.mountainWeight =
            p00.mountainWeight * w00 + p10.mountainWeight * w10 + p01.mountainWeight * w01 + p11.mountainWeight * w11;
          interp.swampWeight =
            p00.swampWeight * w00 + p10.swampWeight * w10 + p01.swampWeight * w01 + p11.swampWeight * w11;
          interp.desertWeight =
            p00.desertWeight * w00 + p10.desertWeight * w10 + p01.desertWeight * w01 + p11.desertWeight * w11;
          interp.savannaWeight =
            p00.savannaWeight * w00 + p10.savannaWeight * w10 + p01.savannaWeight * w01 + p11.savannaWeight * w11;

          const res = computeSurfaceHeightFromBlended(this.noise, wx, wz, interp, this.worldType);
          const hIdx = hz * HALO_N + hx;
          haloHeight[hIdx] = res.height;
          haloRiverChannel[hIdx] = res.river.channel;
        }
      }

      // Cache per-column biome & surface height for vegetation pass
      const colBiomes: BiomeType[] = new Array(CHUNK_SIZE * CHUNK_SIZE);
      const colHeights = new Int16Array(CHUNK_SIZE * CHUNK_SIZE);

      // 1b. Fill voxel columns: biomes, sinuous riverbeds, beaches, Badlands strata, caves & ores
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const wz = baseZ + lz;
        const hz = lz + 2;
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          const wx = baseX + lx;
          const hx = lx + 2;
          const hIdx = hz * HALO_N + hx;
          const surfY = haloHeight[hIdx];
          const riverChannel = haloRiverChannel[hIdx];
          const biome = sampleClimateBiome(this.noise, wx, wz).biome;

          const colIdx = lz * CHUNK_SIZE + lx;
          colBiomes[colIdx] = biome;
          colHeights[colIdx] = surfY;

          const hX = haloHeight[hIdx + 1];
          const hZ = haloHeight[hIdx + HALO_N];
          const slope = Math.max(Math.abs(hX - surfY), Math.abs(hZ - surfY));

          // Check coastal / river water adjacency within 2-block diamond neighborhood in seamless halo
          let nearWater = surfY <= SEA_LEVEL;
          if (!nearWater && surfY <= SEA_LEVEL + 2) {
            nearWater =
              haloHeight[hIdx - 1] <= SEA_LEVEL ||
              haloHeight[hIdx + 1] <= SEA_LEVEL ||
              haloHeight[hIdx - HALO_N] <= SEA_LEVEL ||
              haloHeight[hIdx + HALO_N] <= SEA_LEVEL ||
              haloHeight[hIdx - 2] <= SEA_LEVEL ||
              haloHeight[hIdx + 2] <= SEA_LEVEL ||
              haloHeight[hIdx - HALO_N * 2] <= SEA_LEVEL ||
              haloHeight[hIdx + HALO_N * 2] <= SEA_LEVEL ||
              haloHeight[hIdx - HALO_N - 1] <= SEA_LEVEL ||
              haloHeight[hIdx - HALO_N + 1] <= SEA_LEVEL ||
              haloHeight[hIdx + HALO_N - 1] <= SEA_LEVEL ||
              haloHeight[hIdx + HALO_N + 1] <= SEA_LEVEL;
          }

          const isBeach =
            surfY >= SEA_LEVEL - 1 &&
            surfY <= SEA_LEVEL + 2 &&
            nearWater &&
            biome !== 'Badlands' &&
            (biome !== 'Swamp' || riverChannel > 0.25) &&
            (biome !== 'Mountains' || slope < 2);

          // Gentle +-1 block horizontal wave for Badlands mesa strata
          const strataWave =
            biome === 'Badlands'
              ? Math.max(-1, Math.min(1, Math.round(this.noise.noise2D(wx * 0.012, wz * 0.012) * 1.8)))
              : 0;

          chunk.blocks[getIndex(lx, 0, lz)] = BLOCK_IDS.BEDROCK;

          for (let y = 1; y <= Math.max(surfY, SEA_LEVEL); y++) {
            if (y > surfY) {
              chunk.blocks[getIndex(lx, y, lz)] = BLOCK_IDS.WATER;
              continue;
            }

            if (y < surfY - 2 && !(surfY <= SEA_LEVEL && y > surfY - 4)) {
              if (isCaveAt(this.noise, wx, y, wz)) {
                chunk.blocks[getIndex(lx, y, lz)] = BLOCK_IDS.AIR;
                continue;
              }
            }

            let blockId: number = y <= 14 ? BLOCK_IDS.DEEPSLATE : BLOCK_IDS.STONE;

            if (biome === 'Badlands') {
              // Badlands: low canyon floor uses RED_SANDSTONE / ORANGE_TERRACOTTA (never white SAND)
              if (surfY <= SEA_LEVEL) {
                if (y >= surfY - 1 && riverChannel > 0.12 && this.noise.hash2D(wx, wz, 3319) < 0.2) {
                  blockId = BLOCK_IDS.CLAY_BLOCK;
                } else if (y >= surfY - 2) {
                  blockId = BLOCK_IDS.RED_SANDSTONE;
                }
              } else if (y >= 46 && surfY > 48) {
                const sIdx = (((y + strataWave) % BADLANDS_STRATA.length) + BADLANDS_STRATA.length) % BADLANDS_STRATA.length;
                blockId = BADLANDS_STRATA[sIdx];
              } else if (y === surfY) {
                blockId = this.noise.hash2D(wx, wz, 3491) < 0.45 ? BLOCK_IDS.RED_SANDSTONE : BLOCK_IDS.ORANGE_TERRACOTTA;
              } else if (y >= surfY - 3) {
                blockId = BLOCK_IDS.RED_SANDSTONE;
              }
            } else if (surfY <= SEA_LEVEL && riverChannel > 0.12) {
              // Sinuous riverbed: SAND / CLAY_BLOCK patches (or GRAVEL in cold Snowy Taiga)
              if (y >= surfY - 1 && this.noise.hash2D(wx, wz, 3319) < 0.22) {
                blockId = BLOCK_IDS.CLAY_BLOCK;
              } else if (y >= surfY - 2) {
                blockId = biome === 'Snowy Taiga' ? BLOCK_IDS.GRAVEL : BLOCK_IDS.SAND;
              }
            } else if (isBeach && y >= surfY - 2) {
              // Coastal & riverbank beaches: GRAVEL in cold Snowy Taiga, SAND in temperate/warm biomes
              blockId = biome === 'Snowy Taiga' ? BLOCK_IDS.GRAVEL : BLOCK_IDS.SAND;
            } else if (biome === 'Desert') {
              if (y >= surfY - 3) {
                blockId = BLOCK_IDS.SAND;
              }
            } else if (biome === 'Snowy Taiga') {
              if (surfY <= SEA_LEVEL) {
                if (y >= surfY - 2) {
                  blockId = BLOCK_IDS.GRAVEL;
                }
              } else if (y === surfY) {
                blockId = BLOCK_IDS.SNOW_GRASS;
              } else if (y >= surfY - 3) {
                blockId = BLOCK_IDS.DIRT;
              }
            } else if (biome === 'Mountains') {
              if (surfY > 82 && y >= surfY - 1) {
                blockId = BLOCK_IDS.SNOW_BLOCK;
              } else if (slope >= 2 || surfY >= 70) {
                blockId = BLOCK_IDS.STONE;
              } else if (y === surfY && surfY > SEA_LEVEL) {
                blockId = BLOCK_IDS.GRASS;
              } else if (y >= surfY - 2) {
                blockId = BLOCK_IDS.DIRT;
              }
            } else if (biome === 'Swamp') {
              if (surfY <= SEA_LEVEL) {
                if (y >= surfY - 1 && this.noise.hash2D(wx, wz, 3319) < 0.32) {
                  blockId = BLOCK_IDS.CLAY_BLOCK;
                } else {
                  blockId = y >= surfY - 2 ? BLOCK_IDS.DIRT : blockId;
                }
              } else if (y === surfY) {
                blockId = BLOCK_IDS.GRASS;
              } else if (y >= surfY - 3) {
                blockId = BLOCK_IDS.DIRT;
              }
            } else if (biome === 'Savanna') {
              if (surfY <= SEA_LEVEL) {
                blockId = y >= surfY - 2 ? BLOCK_IDS.SAND : blockId;
              } else if (y === surfY) {
                blockId = this.noise.hash2D(wx, wz, 3911) < 0.2 ? BLOCK_IDS.DIRT_PATH : BLOCK_IDS.GRASS;
              } else if (y >= surfY - 3) {
                blockId = BLOCK_IDS.DIRT;
              }
            } else {
              // Plains & Jungle
              if (surfY <= SEA_LEVEL) {
                if (y >= surfY - 1 && surfY >= SEA_LEVEL - 4 && this.noise.hash2D(wx, wz, 3319) < 0.14) {
                  blockId = BLOCK_IDS.CLAY_BLOCK;
                } else {
                  blockId = y >= surfY - 2 ? BLOCK_IDS.SAND : blockId;
                }
              } else if (y === surfY) {
                blockId = BLOCK_IDS.GRASS;
              } else if (y >= surfY - 3) {
                blockId = BLOCK_IDS.DIRT;
              }
            }

            // Mineral veins in Stone/Deepslate: Coal (Y=10..75), Iron (Y=5..52)
            if (blockId === BLOCK_IDS.STONE || blockId === BLOCK_IDS.DEEPSLATE) {
              if (y >= 5 && y <= 52) {
                const ironN = this.noise.noise3D(
                  (wx + this.noise.caveOffsetX) * 0.16 + 50,
                  y * 0.16,
                  (wz + this.noise.caveOffsetZ) * 0.16 - 50
                );
                if (ironN > 0.52) {
                  blockId = BLOCK_IDS.IRON_ORE;
                }
              }
              if ((blockId === BLOCK_IDS.STONE || blockId === BLOCK_IDS.DEEPSLATE) && y >= 10 && y <= 75) {
                const coalN = this.noise.noise3D(
                  (wx + this.noise.caveOffsetX) * 0.14 - 80,
                  y * 0.14,
                  (wz + this.noise.caveOffsetZ) * 0.14 + 30
                );
                if (coalN > 0.46) {
                  blockId = BLOCK_IDS.COAL_ORE;
                }
              }
            }

            chunk.blocks[getIndex(lx, y, lz)] = blockId;
          }
        }
      }

      // 2. Deterministic Ore & Rock Clusters
      const stoneOrDeep = [BLOCK_IDS.STONE, BLOCK_IDS.DEEPSLATE];
      this.carveOreVeins(chunk, cx, cz, BLOCK_IDS.GRANITE, 16, 62, 8, 18, 2, 2207, BLOCK_IDS.STONE);
      this.carveOreVeins(chunk, cx, cz, BLOCK_IDS.DIORITE, 16, 62, 8, 18, 2, 2311, BLOCK_IDS.STONE);
      this.carveOreVeins(chunk, cx, cz, BLOCK_IDS.ANDESITE, 16, 62, 8, 18, 2, 2417, BLOCK_IDS.STONE);
      this.carveOreVeins(chunk, cx, cz, BLOCK_IDS.GRAVEL, 12, 55, 6, 14, 2, 2531, BLOCK_IDS.STONE);
      this.carveOreVeins(chunk, cx, cz, BLOCK_IDS.COPPER_ORE, 20, 65, 4, 8, 5, 2909, BLOCK_IDS.STONE);
      this.carveOreVeins(chunk, cx, cz, BLOCK_IDS.GOLD_ORE, 5, 30, 3, 6, 4, 3101, stoneOrDeep);
      this.carveOreVeins(chunk, cx, cz, BLOCK_IDS.LAPIS_ORE, 8, 28, 3, 6, 3, 3517, stoneOrDeep);
      this.carveOreVeins(chunk, cx, cz, BLOCK_IDS.REDSTONE_ORE, 2, 16, 4, 7, 5, 3719, stoneOrDeep);
      this.carveOreVeins(chunk, cx, cz, BLOCK_IDS.DIAMOND_ORE, 2, 16, 2, 4, 3, 7919, stoneOrDeep);

      // 3. Cross-chunk trees (Oak, Birch, Spruce, Jungle, Acacia) — strictly on dry grass/snow grass
      for (let tz = baseZ - 2; tz < baseZ + CHUNK_SIZE + 2; tz++) {
        for (let tx = baseX - 2; tx < baseX + CHUNK_SIZE + 2; tx++) {
          const tree = this.getTreeAt(tx, tz);
          if (!tree) continue;

          const { baseY, trunkHeight, snowy, logId, leavesId } = tree;
          const tlx = tx - baseX;
          const tlz = tz - baseZ;

          // Double-check solid dry grass/snow ground when trunk lies in this chunk
          if (tlx >= 0 && tlx < CHUNK_SIZE && tlz >= 0 && tlz < CHUNK_SIZE) {
            const under = chunk.blocks[getIndex(tlx, baseY - 1, tlz)];
            if (under !== BLOCK_IDS.GRASS && under !== BLOCK_IDS.SNOW_GRASS && under !== BLOCK_IDS.DIRT_PATH) {
              continue;
            }
          }

          const topY = baseY + trunkHeight - 1;

          for (let dy = -2; dy <= 1; dy++) {
            const ly = topY + dy;
            if (ly <= 0 || ly >= CHUNK_HEIGHT) continue;
            const radius = dy === 1 ? 1 : 2;
            for (let dz = -radius; dz <= radius; dz++) {
              for (let dx = -radius; dx <= radius; dx++) {
                if (Math.abs(dx) === radius && Math.abs(dz) === radius) {
                  if (dy === 1 || dy === 0 || (dy === -2 && this.noise.hash3D(tx + dx, ly, tz + dz, 42) > 0.45)) {
                    continue;
                  }
                }
                const wx = tx + dx;
                const wz = tz + dz;
                const lx = wx - baseX;
                const lz = wz - baseZ;
                if (lx >= 0 && lx < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE) {
                  const idx = getIndex(lx, ly, lz);
                  if (chunk.blocks[idx] === BLOCK_IDS.AIR) {
                    chunk.blocks[idx] = leavesId;
                    if (snowy && dy === 1 && ly + 1 < CHUNK_HEIGHT) {
                      const aboveIdx = getIndex(lx, ly + 1, lz);
                      if (chunk.blocks[aboveIdx] === BLOCK_IDS.AIR) {
                        chunk.blocks[aboveIdx] = BLOCK_IDS.SNOW_BLOCK;
                      }
                    }
                  }
                }
              }
            }
          }

          if (tlx >= 0 && tlx < CHUNK_SIZE && tlz >= 0 && tlz < CHUNK_SIZE) {
            for (let y = baseY; y <= topY; y++) {
              if (y > 0 && y < CHUNK_HEIGHT) {
                chunk.blocks[getIndex(tlx, y, tlz)] = logId;
              }
            }
          }
        }
      }

      // 4. Surface vegetation (reuses cached colBiomes & colHeights in O(1))
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const wz = baseZ + lz;
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          const wx = baseX + lx;
          const colIdx = lz * CHUNK_SIZE + lx;
          const biome = colBiomes[colIdx];
          const y = colHeights[colIdx];
          if (y <= SEA_LEVEL || y + 3 >= CHUNK_HEIGHT) continue;
          const ground = chunk.blocks[getIndex(lx, y, lz)];
          if (chunk.blocks[getIndex(lx, y + 1, lz)] !== BLOCK_IDS.AIR) continue;

          if ((biome === 'Desert' || biome === 'Badlands') && (ground === BLOCK_IDS.SAND || ground === BLOCK_IDS.RED_SANDSTONE)) {
            const cr = this.noise.hash2D(wx, wz, 6131);
            if (cr < 0.008 && lx > 0 && lx < CHUNK_SIZE - 1 && lz > 0 && lz < CHUNK_SIZE - 1) {
              const cHeight = 2 + (cr < 0.003 ? 1 : 0);
              for (let cy = 1; cy <= cHeight; cy++) {
                chunk.blocks[getIndex(lx, y + cy, lz)] = BLOCK_IDS.CACTUS;
              }
            }
          } else if (biome === 'Jungle' && ground === BLOCK_IDS.GRASS) {
            const jr = this.noise.hash2D(wx, wz, 6411);
            if (jr < 0.018) {
              chunk.blocks[getIndex(lx, y + 1, lz)] = BLOCK_IDS.MELON;
            } else if (jr < 0.34) {
              chunk.blocks[getIndex(lx, y + 1, lz)] = BLOCK_IDS.TALL_GRASS;
            }
          } else if (biome === 'Swamp' && ground === BLOCK_IDS.GRASS) {
            const sr = this.noise.hash2D(wx, wz, 6521);
            if (y === SEA_LEVEL + 1 && sr < 0.06) {
              const caneH = 2 + Math.floor(this.noise.hash2D(wx, wz, 6529) * 2);
              for (let cy = 1; cy <= caneH; cy++) {
                chunk.blocks[getIndex(lx, y + cy, lz)] = BLOCK_IDS.SUGAR_CANE;
              }
            } else if (sr < 0.032) {
              chunk.blocks[getIndex(lx, y + 1, lz)] = sr < 0.016 ? BLOCK_IDS.RED_MUSHROOM : BLOCK_IDS.BROWN_MUSHROOM;
            } else if (sr < 0.05) {
              chunk.blocks[getIndex(lx, y + 1, lz)] = BLOCK_IDS.BLUE_ORCHID;
            } else if (sr < 0.22) {
              chunk.blocks[getIndex(lx, y + 1, lz)] = BLOCK_IDS.TALL_GRASS;
            }
          } else if (biome === 'Savanna' && ground === BLOCK_IDS.GRASS) {
            const vr = this.noise.hash2D(wx, wz, 6611);
            if (vr < 0.16) {
              chunk.blocks[getIndex(lx, y + 1, lz)] = BLOCK_IDS.TALL_GRASS;
            }
          } else if (
            (biome === 'Plains' || biome === 'Jungle') &&
            (ground === BLOCK_IDS.SAND || ground === BLOCK_IDS.GRASS) &&
            y === SEA_LEVEL + 1 &&
            this.noise.hash2D(wx, wz, 6217) < 0.05
          ) {
            // Shoreline Sugar Cane right beside water
            const caneH = 2 + Math.floor(this.noise.hash2D(wx, wz, 6229) * 2);
            for (let cy = 1; cy <= caneH; cy++) {
              chunk.blocks[getIndex(lx, y + cy, lz)] = BLOCK_IDS.SUGAR_CANE;
            }
          } else if (biome === 'Plains' && ground === BLOCK_IDS.GRASS) {
            const r = this.noise.hash2D(wx, wz, 5521);
            if (r < 0.015) {
              chunk.blocks[getIndex(lx, y + 1, lz)] = BLOCK_IDS.RED_FLOWER;
            } else if (r < 0.03) {
              chunk.blocks[getIndex(lx, y + 1, lz)] = BLOCK_IDS.DANDELION;
            } else if (r < 0.04) {
              chunk.blocks[getIndex(lx, y + 1, lz)] = BLOCK_IDS.BLUE_ORCHID;
            } else if (r < 0.046) {
              chunk.blocks[getIndex(lx, y + 1, lz)] = r < 0.043 ? BLOCK_IDS.RED_MUSHROOM : BLOCK_IDS.BROWN_MUSHROOM;
            } else if (r < 0.05) {
              chunk.blocks[getIndex(lx, y + 1, lz)] = r < 0.048 ? BLOCK_IDS.PUMPKIN : BLOCK_IDS.MELON;
            } else if (r < 0.18) {
              chunk.blocks[getIndex(lx, y + 1, lz)] = BLOCK_IDS.TALL_GRASS;
            }
          }
        }
      }

      // 4.5 Procedural Structures (Villages, Desert Pyramids, Watchtowers)
      const structOut = this.structures.stampIntoChunk(chunk.blocks, cx, cz);
      for (const chestSpec of structOut.chests) {
        const cKey = `${chestSpec.wx},${chestSpec.wy},${chestSpec.wz}`;
        if (!this.tileEntities.has(cKey)) {
          this.tileEntities.set(cKey, {
            type: 'chest',
            key: cKey,
            slots: chestSpec.slots,
          });
        }
      }
      for (const vSpec of structOut.villagers) {
        if (!this.spawnedVillagerIds.has(vSpec.id)) {
          this.spawnedVillagerIds.add(vSpec.id);
          this.pendingVillagerSpawns.push(vSpec);
        }
      }
    }

    // 5. Apply persisted player edits inside this chunk
    for (const [editKey, editId] of this.blockEdits.entries()) {
      const parts = editKey.split(',');
      const ex = Number(parts[0]);
      const ey = Number(parts[1]);
      const ez = Number(parts[2]);
      if (worldToChunkCoord(ex) === cx && worldToChunkCoord(ez) === cz) {
        if (ey > 0 && ey < CHUNK_HEIGHT) {
          chunk.blocks[getIndex(worldToLocalCoord(ex), ey, worldToLocalCoord(ez))] = editId;
        }
      }
    }

    this.chunks.set(key, chunk);
    this.computeChunkLight(chunk);
    this.markChunkDirty(cx - 1, cz);
    this.markChunkDirty(cx + 1, cz);
    this.markChunkDirty(cx, cz - 1);
    this.markChunkDirty(cx, cz + 1);
    return chunk;
  }

  /**
   * Generates cavernous Nether terrain:
   * - Bedrock floor (Y=0..3) and Bedrock roof (Y=124..127)
   * - 3D multi-octave Netherrack halls, overhangs & valleys
   * - Lava ocean at LAVA_LEVEL=31 + occasional glowing lava falls
   * - Nether Wastes & Soul Sand Valley sub-biomes
   * - Magma shores (Y=28..35), Quartz Ore veins (Y=10..115), hanging Glowstone clusters (Y=80..118), natural Fire
   * - Nether Fortresses with Treasure Chests & Blaze Platforms
   */
  private generateNetherChunk(chunk: Chunk, cx: number, cz: number): void {
    const baseX = cx * CHUNK_SIZE;
    const baseZ = cz * CHUNK_SIZE;

    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const wz = baseZ + lz;
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const wx = baseX + lx;
        const subBiome = sampleNetherBiome(this.noise, wx, wz);

        // Bedrock floor (Y=0 solid, Y=1..3 irregular)
        chunk.blocks[getIndex(lx, 0, lz)] = BLOCK_IDS.BEDROCK;
        for (let y = 1; y <= 3; y++) {
          const r = this.noise.hash3D(wx, y, wz, 2101);
          chunk.blocks[getIndex(lx, y, lz)] = r < (4 - y) * 0.34 ? BLOCK_IDS.BEDROCK : BLOCK_IDS.NETHERRACK;
        }

        // Bedrock ceiling (Y=127 solid, Y=124..126 irregular)
        chunk.blocks[getIndex(lx, CHUNK_HEIGHT - 1, lz)] = BLOCK_IDS.BEDROCK;
        for (let y = 124; y <= 126; y++) {
          const r = this.noise.hash3D(wx, y, wz, 2203);
          chunk.blocks[getIndex(lx, y, lz)] = r < (y - 123) * 0.34 ? BLOCK_IDS.BEDROCK : BLOCK_IDS.NETHERRACK;
        }

        // 3D Cavernous Netherrack + Lava Ocean (Y=4..123)
        for (let y = 4; y <= 123; y++) {
          const density = sampleNetherDensity(this.noise, wx, y, wz);
          if (density > 0) {
            chunk.blocks[getIndex(lx, y, lz)] = BLOCK_IDS.NETHERRACK;
          } else if (y <= LAVA_LEVEL) {
            chunk.blocks[getIndex(lx, y, lz)] = BLOCK_IDS.LAVA;
          } else {
            chunk.blocks[getIndex(lx, y, lz)] = BLOCK_IDS.AIR;
          }
        }

        // Surface dressing: Soul Sand Valleys, Magma shores (Y=28..35), and natural Fire patches
        for (let y = 5; y <= 116; y++) {
          const idx = getIndex(lx, y, lz);
          if (chunk.blocks[idx] !== BLOCK_IDS.NETHERRACK) continue;
          const above = chunk.blocks[getIndex(lx, y + 1, lz)];
          const exposed = above === BLOCK_IDS.AIR || above === BLOCK_IDS.LAVA;
          if (!exposed) continue;

          if (subBiome === 'Soul Sand Valley' && y <= 92) {
            chunk.blocks[idx] = BLOCK_IDS.SOUL_SAND;
            if (y - 1 >= 4 && chunk.blocks[getIndex(lx, y - 1, lz)] === BLOCK_IDS.NETHERRACK) {
              chunk.blocks[getIndex(lx, y - 1, lz)] = BLOCK_IDS.SOUL_SAND;
            }
          } else if (y >= 28 && y <= 35) {
            const magmaN = this.noise.noise3D(wx * 0.12 + 19, y * 0.14, wz * 0.12 - 23);
            if (magmaN > 0.28) {
              chunk.blocks[idx] = BLOCK_IDS.MAGMA_BLOCK;
            } else if (magmaN < -0.34 && y <= 34) {
              chunk.blocks[idx] = BLOCK_IDS.SOUL_SAND;
            }
          }

          // Natural flickering fire patches on exposed Netherrack above lava level
          if (
            above === BLOCK_IDS.AIR &&
            y > LAVA_LEVEL + 1 &&
            y < 96 &&
            chunk.blocks[idx] === BLOCK_IDS.NETHERRACK
          ) {
            const fireRoll = this.noise.hash3D(wx, y, wz, 6421);
            if (fireRoll < 0.014) {
              chunk.blocks[getIndex(lx, y + 1, lz)] = BLOCK_IDS.FIRE;
            }
          }
        }
      }
    }

    // Nether Quartz Ore veins (Y=10..115), Magma pockets (Y=28..35) & rare Ancient Debris (Y=8..22)
    this.carveOreVeins(chunk, cx, cz, BLOCK_IDS.NETHER_QUARTZ_ORE, 10, 115, 4, 8, 9, 5171, BLOCK_IDS.NETHERRACK);
    this.carveOreVeins(chunk, cx, cz, BLOCK_IDS.MAGMA_BLOCK, 28, 35, 3, 6, 4, 5399, BLOCK_IDS.NETHERRACK);
    this.carveOreVeins(chunk, cx, cz, BLOCK_IDS.ANCIENT_DEBRIS, 8, 22, 1, 3, 2, 5741, BLOCK_IDS.NETHERRACK);

    // Hanging Glowstone stalactite clusters clinging to undersides of ceilings (Y=80..118)
    const glowClusters = 3;
    for (let g = 0; g < glowClusters; g++) {
      const salt = 6101 + g * 83;
      const gx = 2 + Math.floor(this.noise.hash2D(cx, cz, salt) * (CHUNK_SIZE - 4));
      const gz = 2 + Math.floor(this.noise.hash2D(cx, cz, salt + 17) * (CHUNK_SIZE - 4));
      let anchorY = -1;
      for (let y = 116; y >= 82; y--) {
        if (
          chunk.blocks[getIndex(gx, y, gz)] === BLOCK_IDS.NETHERRACK &&
          chunk.blocks[getIndex(gx, y - 1, gz)] === BLOCK_IDS.AIR
        ) {
          anchorY = y - 1;
          break;
        }
      }
      if (anchorY < 80) continue;
      // Branching stalactite cluster of 10..18 Glowstone blocks
      let px = gx;
      let py = anchorY;
      let pz = gz;
      const count = 10 + Math.floor(this.noise.hash2D(cx, cz, salt + 31) * 9);
      for (let i = 0; i < count; i++) {
        if (px >= 1 && px < CHUNK_SIZE - 1 && py >= 76 && py <= anchorY && pz >= 1 && pz < CHUNK_SIZE - 1) {
          if (chunk.blocks[getIndex(px, py, pz)] === BLOCK_IDS.AIR) {
            chunk.blocks[getIndex(px, py, pz)] = BLOCK_IDS.GLOWSTONE;
          }
        }
        const dirRoll = this.noise.hash3D(cx + i, py, cz + g, salt + 53);
        if (dirRoll < 0.36) py -= 1;
        else if (dirRoll < 0.52) px += 1;
        else if (dirRoll < 0.68) px -= 1;
        else if (dirRoll < 0.84) pz += 1;
        else pz -= 1;
      }
    }

    // Occasional vertical Lava waterfall streaming from ceiling cavern pockets
    if (this.noise.hash2D(cx, cz, 7741) < 0.24) {
      const lx = 3 + Math.floor(this.noise.hash2D(cx, cz, 7753) * (CHUNK_SIZE - 6));
      const lz = 3 + Math.floor(this.noise.hash2D(cx, cz, 7759) * (CHUNK_SIZE - 6));
      let startY = -1;
      for (let y = 108; y >= 68; y--) {
        if (
          chunk.blocks[getIndex(lx, y, lz)] === BLOCK_IDS.NETHERRACK &&
          chunk.blocks[getIndex(lx, y - 1, lz)] === BLOCK_IDS.AIR
        ) {
          startY = y - 1;
          break;
        }
      }
      if (startY > LAVA_LEVEL + 10) {
        for (let y = startY; y > LAVA_LEVEL; y--) {
          const cur = chunk.blocks[getIndex(lx, y, lz)];
          if (cur !== BLOCK_IDS.AIR && cur !== BLOCK_IDS.FIRE) break;
          chunk.blocks[getIndex(lx, y, lz)] = BLOCK_IDS.LAVA;
        }
      }
    }

    // Stamp Nether Fortresses (bridges, covered halls, Treasure Rooms & Blaze Platforms)
    const structOut = this.structures.stampIntoChunk(chunk.blocks, cx, cz);
    for (const chestSpec of structOut.chests) {
      const cKey = `${chestSpec.wx},${chestSpec.wy},${chestSpec.wz}`;
      if (!this.tileEntities.has(cKey)) {
        this.tileEntities.set(cKey, {
          type: 'chest',
          key: cKey,
          slots: chestSpec.slots,
        });
      }
    }
    for (const bSpec of structOut.blazes) {
      if (!this.spawnedBlazeIds.has(bSpec.id)) {
        this.spawnedBlazeIds.add(bSpec.id);
        this.pendingBlazeSpawns.push(bSpec);
      }
    }
  }

  private carveOreVeins(
    chunk: Chunk,
    cx: number,
    cz: number,
    oreBlockId: number,
    minY: number,
    maxY: number,
    minVeinSize: number,
    maxVeinSize: number,
    veinsPerChunk: number,
    salt: number,
    hostBlockId: number | number[] = BLOCK_IDS.STONE
  ): void {
    const hosts = Array.isArray(hostBlockId) ? hostBlockId : [hostBlockId];
    for (let v = 0; v < veinsPerChunk; v++) {
      const s = salt + v * 97;
      let vx = Math.floor(this.noise.hash2D(cx, cz, s) * CHUNK_SIZE);
      let vy = minY + Math.floor(this.noise.hash2D(cx, cz, s + 13) * (maxY - minY + 1));
      let vz = Math.floor(this.noise.hash2D(cx, cz, s + 29) * CHUNK_SIZE);
      const count =
        minVeinSize +
        Math.floor(this.noise.hash2D(cx, cz, s + 41) * (maxVeinSize - minVeinSize + 1));

      for (let i = 0; i < count; i++) {
        if (vx >= 0 && vx < CHUNK_SIZE && vy >= minY && vy <= maxY && vz >= 0 && vz < CHUNK_SIZE) {
          const idx = getIndex(vx, vy, vz);
          if (hosts.includes(chunk.blocks[idx])) {
            chunk.blocks[idx] = oreBlockId;
          }
        }
        const dir = Math.floor(this.noise.hash3D(cx + i, vy, cz + v, s + 67) * 6);
        const [dx, dy, dz] = NEIGHBOR_DIRS[dir];
        vx += dx;
        vy += dy;
        vz += dz;
      }
    }
  }

  public computeChunkLight(chunk: Chunk): void {
    chunk.light.fill(0);
    const skyQueue: number[] = [];
    const blockQueue: number[] = [];
    const hasSky = this.dimension !== 'nether';

    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        let sunBlocked = !hasSky;
        for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
          const idx = getIndex(lx, y, lz);
          const id = chunk.blocks[idx];
          const def = BLOCKS[id];

          if (!sunBlocked) {
            if (
              id === BLOCK_IDS.AIR ||
              def?.isStainedGlass ||
              id === BLOCK_IDS.TORCH ||
              def?.isSoulTorch ||
              def?.isLantern ||
              def?.isLadder ||
              def?.isDoor ||
              def?.isDoorOpen ||
              def?.isTrapdoor ||
              def?.isTrapdoorOpen ||
              def?.isFence ||
              def?.isFenceGate ||
              def?.isFenceGateOpen ||
              def?.isWall ||
              def?.isIronBars ||
              def?.isCampfire ||
              def?.crossMesh
            ) {
              chunk.setSkyLight(lx, y, lz, 15);
              skyQueue.push(idx);
            } else if (id === BLOCK_IDS.WATER || def?.isLeaves) {
              chunk.setSkyLight(lx, y, lz, 13);
              skyQueue.push(idx);
              sunBlocked = true;
            } else {
              sunBlocked = true;
            }
          }

          if (def && def.lightLevel > 0) {
            chunk.setBlockLight(lx, y, lz, def.lightLevel);
            blockQueue.push(idx);
          }
        }
      }
    }

    const borderChecks: Array<[number, number, number, number]> = [
      [0, -1, 0, CHUNK_SIZE - 1],
      [CHUNK_SIZE - 1, 1, 0, 0],
      [0, 0, -1, CHUNK_SIZE - 1],
      [CHUNK_SIZE - 1, 0, 1, 0],
    ];
    for (const [edge, dcx, dcz, nEdge] of borderChecks) {
      const neighbor = this.chunks.get(chunkKey(chunk.cx + dcx, chunk.cz + dcz));
      if (!neighbor) continue;
      for (let i = 0; i < CHUNK_SIZE; i++) {
        const lx = dcx !== 0 ? edge : i;
        const lz = dcz !== 0 ? edge : i;
        const nlx = dcx !== 0 ? nEdge : i;
        const nlz = dcz !== 0 ? nEdge : i;
        for (let y = 1; y < CHUNK_HEIGHT; y++) {
          const id = chunk.blocks[getIndex(lx, y, lz)];
          if (!BLOCKS[id]?.transparent) continue;
          const nBlockL = neighbor.getBlockLight(nlx, y, nlz);
          if (nBlockL > 1) {
            const cur = chunk.getBlockLight(lx, y, lz);
            if (nBlockL - 1 > cur) {
              chunk.setBlockLight(lx, y, lz, nBlockL - 1);
              blockQueue.push(getIndex(lx, y, lz));
            }
          }
          const nSkyL = neighbor.getSkyLight(nlx, y, nlz);
          if (nSkyL > 1) {
            const curS = chunk.getSkyLight(lx, y, lz);
            if (nSkyL - 1 > curS) {
              chunk.setSkyLight(lx, y, lz, nSkyL - 1);
              skyQueue.push(getIndex(lx, y, lz));
            }
          }
        }
      }
    }

    let head = 0;
    while (head < skyQueue.length) {
      const idx = skyQueue[head++];
      const lx = idx & 15;
      const lz = (idx >>> 4) & 15;
      const y = idx >>> 8;
      const level = (chunk.light[idx] >>> 4) & 0x0f;
      if (level <= 1) continue;

      for (let d = 0; d < 6; d++) {
        const [dx, dy, dz] = NEIGHBOR_DIRS[d];
        const nx = lx + dx;
        const ny = y + dy;
        const nz = lz + dz;
        if (nx < 0 || nx >= CHUNK_SIZE || ny < 0 || ny >= CHUNK_HEIGHT || nz < 0 || nz >= CHUNK_SIZE) {
          continue;
        }
        const nIdx = getIndex(nx, ny, nz);
        const nId = chunk.blocks[nIdx];
        if (!BLOCKS[nId]?.transparent) continue;
        const atten = nId === BLOCK_IDS.WATER || BLOCKS[nId]?.isLeaves ? 2 : 1;
        const nextLevel = dy === -1 && level === 15 && (nId === BLOCK_IDS.AIR || BLOCKS[nId]?.crossMesh) ? 15 : level - atten;
        if (nextLevel > ((chunk.light[nIdx] >>> 4) & 0x0f)) {
          chunk.setSkyLight(nx, ny, nz, nextLevel);
          skyQueue.push(nIdx);
        }
      }
    }

    head = 0;
    while (head < blockQueue.length) {
      const idx = blockQueue[head++];
      const lx = idx & 15;
      const lz = (idx >>> 4) & 15;
      const y = idx >>> 8;
      const level = chunk.light[idx] & 0x0f;
      if (level <= 1) continue;

      for (let d = 0; d < 6; d++) {
        const [dx, dy, dz] = NEIGHBOR_DIRS[d];
        const nx = lx + dx;
        const ny = y + dy;
        const nz = lz + dz;
        if (nx < 0 || nx >= CHUNK_SIZE || ny < 0 || ny >= CHUNK_HEIGHT || nz < 0 || nz >= CHUNK_SIZE) {
          continue;
        }
        const nIdx = getIndex(nx, ny, nz);
        const nId = chunk.blocks[nIdx];
        if (!BLOCKS[nId]?.transparent) continue;
        const nextLevel = level - 1;
        if (nextLevel > (chunk.light[nIdx] & 0x0f)) {
          chunk.setBlockLight(nx, ny, nz, nextLevel);
          blockQueue.push(nIdx);
        }
      }
    }

    chunk.lightDirty = false;
    chunk.dirty = true;
  }

  public recomputeChunkAndNeighborLight(cx: number, cz: number): void {
    const center = this.chunks.get(chunkKey(cx, cz));
    if (center) this.computeChunkLight(center);
    const offsets: Array<[number, number]> = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ];
    for (const [dx, dz] of offsets) {
      const n = this.chunks.get(chunkKey(cx + dx, cz + dz));
      if (n) this.computeChunkLight(n);
    }
  }

  /**
   * Computes a safe spawn position on dry, solid, walkable terrain near (0, 0).
   * Avoids rivers, submerged basins, and sheer cliffs while preserving the seed's genuine biome.
   */
  public findSpawnPoint(): { x: number; y: number; z: number } {
    if (this.dimension === 'nether') {
      return this.findNetherSpawnPoint();
    }
    if (this.worldType === 'superflat') {
      return { x: 0.5, y: 5.05, z: 0.5 };
    }
    let dryFallback: { x: number; y: number; z: number } | null = null;
    let bestFallback: { x: number; y: number; z: number; h: number } | null = null;

    for (let r = 0; r <= 64; r += 2) {
      const steps = r === 0 ? 1 : 12;
      for (let a = 0; a < steps; a++) {
        const wx = Math.round(Math.cos((a * Math.PI * 2) / steps) * r);
        const wz = Math.round(Math.sin((a * Math.PI * 2) / steps) * r);
        const col = sampleTerrainColumn(this.noise, wx, wz, this.worldType);
        if (!bestFallback || col.height > bestFallback.h) {
          bestFallback = {
            x: wx + 0.5,
            y: Math.max(col.height, SEA_LEVEL) + 1.05,
            z: wz + 0.5,
            h: col.height,
          };
        }
        if (col.height > SEA_LEVEL && !col.isRiver) {
          if (!dryFallback) {
            dryFallback = { x: wx + 0.5, y: col.height + 1.05, z: wz + 0.5 };
          }
          // Ideal spawn: solidly above water/rivers and not on an extreme cliff
          if (col.height >= SEA_LEVEL + 2 && col.height <= 76) {
            const hX = sampleTerrainColumn(this.noise, wx + 1, wz, this.worldType).height;
            const hZ = sampleTerrainColumn(this.noise, wx, wz + 1, this.worldType).height;
            if (Math.abs(hX - col.height) <= 2 && Math.abs(hZ - col.height) <= 2) {
              return { x: wx + 0.5, y: col.height + 1.05, z: wz + 0.5 };
            }
          }
        }
      }
    }
    if (dryFallback) {
      return dryFallback;
    }
    if (bestFallback) {
      return { x: bestFallback.x, y: bestFallback.y, z: bestFallback.z };
    }
    const fallback = sampleTerrainColumn(this.noise, 0, 0, this.worldType);
    return { x: 0.5, y: Math.max(fallback.height, SEA_LEVEL) + 2, z: 0.5 };
  }

  public findNetherSpawnPoint(): { x: number; y: number; z: number } {
    // Ensure origin chunks are generated so we inspect actual carved Nether cavities
    for (let cz = -1; cz <= 1; cz++) {
      for (let cx = -1; cx <= 1; cx++) {
        this.generateChunk(cx, cz);
      }
    }
    for (let r = 0; r <= 14; r += 2) {
      for (let dz = -r; dz <= r; dz += 2) {
        for (let dx = -r; dx <= r; dx += 2) {
          for (let y = 34; y <= 90; y++) {
            const floor = this.getBlock(dx, y - 1, dz);
            const fDef = BLOCKS[floor];
            if (!fDef || !fDef.solid || floor === BLOCK_IDS.LAVA || floor === BLOCK_IDS.MAGMA_BLOCK) continue;
            if (
              this.getBlock(dx, y, dz) === BLOCK_IDS.AIR &&
              this.getBlock(dx, y + 1, dz) === BLOCK_IDS.AIR
            ) {
              return { x: dx + 0.5, y: y + 0.05, z: dz + 0.5 };
            }
          }
        }
      }
    }
    return { x: 0.5, y: 52.05, z: 0.5 };
  }
}

export function decodeChunkMapSlice(encoded: string): Uint16Array {
  const cells = new Uint16Array(CHUNK_SIZE * CHUNK_SIZE);
  try {
    const bin = typeof atob === 'function' ? atob(encoded) : Buffer.from(encoded, 'base64').toString('binary');
    if (bin.length >= CHUNK_SIZE * CHUNK_SIZE * 2) {
      for (let i = 0; i < cells.length; i++) {
        cells[i] = bin.charCodeAt(i * 2) | (bin.charCodeAt(i * 2 + 1) << 8);
      }
    } else {
      // Backward compatibility for legacy 256-byte slices (6-bit blockId + 2-bit height tier)
      const len = Math.min(cells.length, bin.length);
      for (let i = 0; i < len; i++) {
        const b = bin.charCodeAt(i);
        const oldId = b & 0x3f;
        const oldTier = (b >>> 6) & 0x03;
        cells[i] = oldId | (oldTier << 14);
      }
    }
  } catch {
    // fallback empty
  }
  return cells;
}
