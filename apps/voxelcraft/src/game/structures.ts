import { BLOCK_IDS, CHUNK_HEIGHT, CHUNK_SIZE, getIndex, LAVA_LEVEL, SEA_LEVEL } from './blocks';
import { sampleTerrainColumn, SeededNoise } from './noise';
import type {
  DimensionId,
  SlotOrNull,
  StructureType,
  VillagerProfession,
  WorldType,
} from './types';

export const STRUCTURE_REGION_CHUNKS = 10; // 160x160 block regions (Overworld)
export const NETHER_FORTRESS_REGION_CHUNKS = 12; // 192x192 block regions (Nether)

export interface StructureDescriptor {
  id: string;
  type: StructureType;
  name: string;
  centerX: number;
  centerZ: number;
  baseY: number;
  radius: number;
}

export interface StructureChestSpec {
  wx: number;
  wy: number;
  wz: number;
  slots: SlotOrNull[];
}

export interface StructureVillagerSpec {
  id: string;
  wx: number;
  wy: number;
  wz: number;
  homeX: number;
  homeZ: number;
  profession: VillagerProfession;
}

export interface StructureBlazeSpec {
  id: string;
  wx: number;
  wy: number;
  wz: number;
  homeX: number;
  homeZ: number;
}

export interface ChunkStructureOutput {
  chests: StructureChestSpec[];
  villagers: StructureVillagerSpec[];
  blazes: StructureBlazeSpec[];
}

function makeLootSlots(
  noise: SeededNoise,
  wx: number,
  wz: number,
  pool: Array<{ id: SlotOrNull extends null ? never : NonNullable<SlotOrNull>['id']; min: number; max: number; chance: number; durability?: number }>
): SlotOrNull[] {
  const slots: SlotOrNull[] = new Array(27).fill(null);
  let cursor = 0;
  for (let i = 0; i < pool.length && cursor < 27; i++) {
    const entry = pool[i];
    const roll = noise.hash2D(wx + i * 17, wz - i * 31, 9001 + i);
    if (roll <= entry.chance) {
      const cnt =
        entry.min +
        Math.floor(noise.hash2D(wx - i * 11, wz + i * 23, 9501 + i) * (entry.max - entry.min + 1));
      const slotIndex = Math.min(26, (cursor * 3 + Math.floor(roll * 7)) % 27);
      const idx = slots[slotIndex] ? cursor : slotIndex;
      slots[idx] = { id: entry.id, count: cnt, durability: entry.durability };
      cursor++;
    }
  }
  return slots;
}

/**
 * Deterministic procedural structure planner & chunk stamper.
 * Uses a 10x10 chunk region grid so Villages, Desert Pyramids, and Watchtowers never overlap
 * and generate identically block-for-block across chunk boundaries.
 */
export class StructureGenerator {
  private readonly cache = new Map<string, StructureDescriptor | null>();

  constructor(
    private readonly noise: SeededNoise,
    private readonly worldType: WorldType,
    private readonly dimension: DimensionId = 'overworld'
  ) {}

  private get regionChunks(): number {
    return this.dimension === 'nether' ? NETHER_FORTRESS_REGION_CHUNKS : STRUCTURE_REGION_CHUNKS;
  }

  public getRegionStructure(rx: number, rz: number): StructureDescriptor | null {
    if (this.dimension === 'nether') {
      return this.getNetherRegionStructure(rx, rz);
    }
    if (this.worldType === 'superflat') return null;
    const key = `${rx},${rz}`;
    if (this.cache.has(key)) return this.cache.get(key) ?? null;

    // 78% of regions contain a landmark structure; spawn region (0,0) always spawns one nearby
    const spawnRoll = this.noise.hash2D(rx, rz, 7103);
    if (!(rx === 0 && rz === 0) && spawnRoll > 0.78) {
      this.cache.set(key, null);
      return null;
    }

    let centerX: number;
    let centerZ: number;
    if (rx === 0 && rz === 0) {
      // Place reliably within ~36..68 blocks of (0,0) without colliding with initial spawn
      const angle = this.noise.hash2D(1, 2, 7121) * Math.PI * 2;
      const dist = 42 + this.noise.hash2D(3, 4, 7129) * 22;
      centerX = Math.round(Math.cos(angle) * dist);
      centerZ = Math.round(Math.sin(angle) * dist);
    } else {
      const minX = rx * STRUCTURE_REGION_CHUNKS * CHUNK_SIZE + 32;
      const minZ = rz * STRUCTURE_REGION_CHUNKS * CHUNK_SIZE + 32;
      const span = (STRUCTURE_REGION_CHUNKS - 4) * CHUNK_SIZE;
      centerX = minX + Math.floor(this.noise.hash2D(rx, rz, 7151) * span);
      centerZ = minZ + Math.floor(this.noise.hash2D(rx, rz, 7177) * span);
    }

    const col = sampleTerrainColumn(this.noise, centerX, centerZ, this.worldType);
    if (col.height <= SEA_LEVEL + 1 || col.height >= 92) {
      // Try one fallback offset inside region for dry land
      centerX += 20;
      centerZ -= 18;
      const retry = sampleTerrainColumn(this.noise, centerX, centerZ, this.worldType);
      if (retry.height <= SEA_LEVEL + 1 || retry.height >= 94) {
        this.cache.set(key, null);
        return null;
      }
      return this.buildDescriptor(key, rx, rz, centerX, centerZ, retry.height, retry.biome);
    }

    return this.buildDescriptor(key, rx, rz, centerX, centerZ, col.height, col.biome);
  }

  private getNetherRegionStructure(rx: number, rz: number): StructureDescriptor | null {
    const key = `n_${rx},${rz}`;
    if (this.cache.has(key)) return this.cache.get(key) ?? null;

    // Region (0,0) always spawns a Nether Fortress within easy reach of the initial Nether arrival
    const roll = this.noise.hash2D(rx, rz, 8821);
    if (!(rx === 0 && rz === 0) && roll > 0.68) {
      this.cache.set(key, null);
      return null;
    }

    let centerX: number;
    let centerZ: number;
    if (rx === 0 && rz === 0) {
      const angle = this.noise.hash2D(5, 9, 8831) * Math.PI * 2;
      const dist = 30 + this.noise.hash2D(7, 11, 8839) * 18;
      centerX = Math.round(Math.cos(angle) * dist);
      centerZ = Math.round(Math.sin(angle) * dist);
    } else {
      const regionBlocks = NETHER_FORTRESS_REGION_CHUNKS * CHUNK_SIZE;
      const minX = rx * regionBlocks + 36;
      const minZ = rz * regionBlocks + 36;
      const span = regionBlocks - 72;
      centerX = minX + Math.floor(this.noise.hash2D(rx, rz, 8861) * span);
      centerZ = minZ + Math.floor(this.noise.hash2D(rx, rz, 8887) * span);
    }

    const deckY = 55 + Math.floor(this.noise.hash2D(rx, rz, 8923) * 9); // Y = 55..63
    const desc: StructureDescriptor = {
      id: `nether_fortress_${rx}_${rz}`,
      type: 'nether_fortress',
      name: 'Fortaleza del Nether',
      centerX,
      centerZ,
      baseY: deckY,
      radius: 30,
    };
    this.cache.set(key, desc);
    return desc;
  }

  private buildDescriptor(
    key: string,
    rx: number,
    rz: number,
    centerX: number,
    centerZ: number,
    baseY: number,
    biome: string
  ): StructureDescriptor {
    const variantRoll = this.noise.hash2D(rx, rz, 7211);
    let type: StructureType;
    let name: string;
    let radius: number;

    if (biome === 'Desert') {
      type = 'desert_pyramid';
      name = 'Templo del Desierto';
      radius = 12;
    } else if (biome === 'Mountains' || (biome === 'Plains' && !(rx === 0 && rz === 0) && variantRoll > 0.62)) {
      type = 'watchtower';
      name = 'Torre de Vigilancia';
      radius = 8;
    } else {
      type = 'village';
      name = biome === 'Snowy Taiga' ? 'Aldea Nevada' : 'Aldea';
      radius = 24;
    }

    const desc: StructureDescriptor = {
      id: `${type}_${rx}_${rz}`,
      type,
      name,
      centerX,
      centerZ,
      baseY,
      radius,
    };
    this.cache.set(key, desc);
    return desc;
  }

  public getStructuresNearWorldPos(wx: number, wz: number, chunkRadius = 12): StructureDescriptor[] {
    if (this.dimension === 'overworld' && this.worldType === 'superflat') return [];
    const rc = this.regionChunks;
    const minRx = Math.floor((Math.floor(wx / CHUNK_SIZE) - chunkRadius) / rc);
    const maxRx = Math.floor((Math.floor(wx / CHUNK_SIZE) + chunkRadius) / rc);
    const minRz = Math.floor((Math.floor(wz / CHUNK_SIZE) - chunkRadius) / rc);
    const maxRz = Math.floor((Math.floor(wz / CHUNK_SIZE) + chunkRadius) / rc);
    const list: StructureDescriptor[] = [];
    for (let rz = minRz; rz <= maxRz; rz++) {
      for (let rx = minRx; rx <= maxRx; rx++) {
        const s = this.getRegionStructure(rx, rz);
        if (s) list.push(s);
      }
    }
    return list;
  }

  /**
   * Stamps any intersecting procedural structures into chunk `blocks` array cleanly across chunk borders.
   */
  public stampIntoChunk(
    blocks: Uint16Array,
    cx: number,
    cz: number
  ): ChunkStructureOutput {
    const out: ChunkStructureOutput = { chests: [], villagers: [], blazes: [] };
    if (this.dimension === 'overworld' && this.worldType === 'superflat') return out;

    const baseX = cx * CHUNK_SIZE;
    const baseZ = cz * CHUNK_SIZE;
    const maxX = baseX + CHUNK_SIZE - 1;
    const maxZ = baseZ + CHUNK_SIZE - 1;

    const rc = this.regionChunks;
    const centerRx = Math.floor(cx / rc);
    const centerRz = Math.floor(cz / rc);

    const setB = (wx: number, wy: number, wz: number, id: number) => {
      if (wx < baseX || wx > maxX || wz < baseZ || wz > maxZ) return;
      if (wy <= 0 || wy >= CHUNK_HEIGHT) return;
      blocks[getIndex(wx - baseX, wy, wz - baseZ)] = id;
    };

    const inChunk = (wx: number, wz: number) => wx >= baseX && wx <= maxX && wz >= baseZ && wz <= maxZ;

    for (let rz = centerRz - 1; rz <= centerRz + 1; rz++) {
      for (let rx = centerRx - 1; rx <= centerRx + 1; rx++) {
        const s = this.getRegionStructure(rx, rz);
        if (!s) continue;
        if (
          s.centerX + s.radius < baseX ||
          s.centerX - s.radius > maxX ||
          s.centerZ + s.radius < baseZ ||
          s.centerZ - s.radius > maxZ
        ) {
          continue;
        }

        if (s.type === 'village') {
          this.stampVillage(s, setB, inChunk, out);
        } else if (s.type === 'desert_pyramid') {
          this.stampDesertPyramid(s, setB, inChunk, out);
        } else if (s.type === 'watchtower') {
          this.stampWatchtower(s, setB, inChunk, out);
        } else if (s.type === 'nether_fortress') {
          this.stampNetherFortress(s, setB, inChunk, out);
        }
      }
    }

    return out;
  }

  private stampVillage(
    s: StructureDescriptor,
    setB: (wx: number, wy: number, wz: number, id: number) => void,
    inChunk: (wx: number, wz: number) => boolean,
    out: ChunkStructureOutput
  ): void {
    const cx = s.centerX;
    const cz = s.centerZ;
    const wellY = s.baseY;

    // 1. Dirt Path roads radiating N/S/E/W (3 blocks wide, following local terrain)
    for (let d = -18; d <= 18; d++) {
      for (let w = -1; w <= 1; w++) {
        // X-axis road
        const rx1 = cx + d;
        const rz1 = cz + w;
        const h1 = sampleTerrainColumn(this.noise, rx1, rz1, this.worldType).height;
        if (h1 > SEA_LEVEL) {
          setB(rx1, h1, rz1, BLOCK_IDS.DIRT_PATH);
          setB(rx1, h1 + 1, rz1, BLOCK_IDS.AIR);
          setB(rx1, h1 + 2, rz1, BLOCK_IDS.AIR);
        }
        // Z-axis road
        const rx2 = cx + w;
        const rz2 = cz + d;
        const h2 = sampleTerrainColumn(this.noise, rx2, rz2, this.worldType).height;
        if (h2 > SEA_LEVEL) {
          setB(rx2, h2, rz2, BLOCK_IDS.DIRT_PATH);
          setB(rx2, h2 + 1, rz2, BLOCK_IDS.AIR);
          setB(rx2, h2 + 2, rz2, BLOCK_IDS.AIR);
        }
      }
    }

    // 2. Central Village Well (5x5 footprint with cobblestone basin, water core, log pillars, plank roof)
    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) {
        const wx = cx + dx;
        const wz = cz + dz;
        const localH = sampleTerrainColumn(this.noise, wx, wz, this.worldType).height;
        for (let y = Math.min(localH, wellY - 3); y <= wellY; y++) {
          setB(wx, y, wz, BLOCK_IDS.COBBLESTONE);
        }
        for (let y = wellY + 1; y <= wellY + 5; y++) {
          setB(wx, y, wz, BLOCK_IDS.AIR);
        }
        const isEdge = Math.abs(dx) === 2 || Math.abs(dz) === 2;
        const isRim = Math.abs(dx) === 1 || Math.abs(dz) === 1;
        if (isEdge) {
          setB(wx, wellY, wz, BLOCK_IDS.COBBLESTONE);
        } else if (isRim) {
          setB(wx, wellY + 1, wz, BLOCK_IDS.COBBLESTONE);
        } else {
          setB(wx, wellY, wz, BLOCK_IDS.WATER);
          setB(wx, wellY - 1, wz, BLOCK_IDS.WATER);
        }
        if (Math.abs(dx) === 1 && Math.abs(dz) === 1) {
          setB(wx, wellY + 2, wz, BLOCK_IDS.OAK_LOG);
          setB(wx, wellY + 3, wz, BLOCK_IDS.OAK_LOG);
        }
        if (Math.abs(dx) <= 1 && Math.abs(dz) <= 1) {
          setB(wx, wellY + 4, wz, BLOCK_IDS.OAK_PLANKS);
        }
      }
    }
    setB(cx + 2, wellY + 1, cz, BLOCK_IDS.TORCH);
    setB(cx - 2, wellY + 1, cz, BLOCK_IDS.TORCH);

    // 3. Houses (3 small houses + 1 blacksmith) & 1 wheat farm placed cleanly around road quadrants
    const houses: Array<{
      ox: number;
      oz: number;
      w: number;
      d: number;
      isBlacksmith: boolean;
      profession: VillagerProfession;
      doorSide: 'S' | 'N' | 'E' | 'W';
    }> = [
      { ox: 7, oz: -10, w: 5, d: 5, isBlacksmith: false, profession: 'farmer', doorSide: 'S' },
      { ox: -12, oz: -10, w: 7, d: 5, isBlacksmith: true, profession: 'blacksmith', doorSide: 'S' },
      { ox: 7, oz: 5, w: 5, d: 5, isBlacksmith: false, profession: 'librarian', doorSide: 'N' },
      { ox: -12, oz: 5, w: 5, d: 5, isBlacksmith: false, profession: 'farmer', doorSide: 'N' },
    ];

    for (let hi = 0; hi < houses.length; hi++) {
      const h = houses[hi];
      const hx = cx + h.ox;
      const hz = cz + h.oz;
      const floorY = Math.max(
        SEA_LEVEL + 2,
        sampleTerrainColumn(this.noise, hx + Math.floor(h.w / 2), hz + Math.floor(h.d / 2), this.worldType).height
      );

      // Foundation down to solid ground + house walls & pitched roof
      for (let dz = 0; dz < h.d; dz++) {
        for (let dx = 0; dx < h.w; dx++) {
          const wx = hx + dx;
          const wz = hz + dz;
          const terrH = sampleTerrainColumn(this.noise, wx, wz, this.worldType).height;
          for (let y = Math.min(terrH - 1, floorY - 5); y <= floorY; y++) {
            setB(wx, y, wz, y === floorY ? BLOCK_IDS.OAK_PLANKS : BLOCK_IDS.COBBLESTONE);
          }

          const isCorner = (dx === 0 || dx === h.w - 1) && (dz === 0 || dz === h.d - 1);
          const isWall = dx === 0 || dx === h.w - 1 || dz === 0 || dz === h.d - 1;
          const doorX = Math.floor(h.w / 2);
          const isDoor =
            (h.doorSide === 'S' && dz === h.d - 1 && dx === doorX) ||
            (h.doorSide === 'N' && dz === 0 && dx === doorX);

          for (let dy = 1; dy <= 4; dy++) {
            const wy = floorY + dy;
            if (dy === 4) {
              setB(wx, wy, wz, isWall ? BLOCK_IDS.OAK_LOG : BLOCK_IDS.OAK_PLANKS);
            } else if (isCorner) {
              setB(wx, wy, wz, BLOCK_IDS.OAK_LOG);
            } else if (isDoor && (dy === 1 || dy === 2)) {
              setB(wx, wy, wz, dy === 1 ? BLOCK_IDS.OAK_DOOR : BLOCK_IDS.AIR);
            } else if (isWall) {
              const isWindow = dy === 2 && !isDoor && (dx === Math.floor(h.w / 2) || dz === Math.floor(h.d / 2));
              setB(
                wx,
                wy,
                wz,
                isWindow ? BLOCK_IDS.GLASS : h.isBlacksmith ? BLOCK_IDS.COBBLESTONE : BLOCK_IDS.OAK_PLANKS
              );
            } else {
              setB(wx, wy, wz, BLOCK_IDS.AIR);
            }
          }
          // Roof cap layer
          if (dx >= 1 && dx <= h.w - 2 && dz >= 1 && dz <= h.d - 2) {
            setB(wx, floorY + 5, wz, BLOCK_IDS.OAK_PLANKS);
          } else {
            setB(wx, floorY + 5, wz, BLOCK_IDS.AIR);
          }
        }
      }

      // Interior furnishings
      setB(hx + 1, floorY + 1, hz + 1, BLOCK_IDS.BED);
      setB(hx + 1, floorY + 2, hz + h.d - 2, BLOCK_IDS.TORCH);

      if (h.isBlacksmith) {
        setB(hx + h.w - 2, floorY + 1, hz + 1, BLOCK_IDS.FURNACE);
        setB(hx + h.w - 3, floorY + 1, hz + 1, BLOCK_IDS.FURNACE);
        const chestX = hx + h.w - 2;
        const chestY = floorY + 1;
        const chestZ = hz + h.d - 2;
        setB(chestX, chestY, chestZ, BLOCK_IDS.CHEST);
        if (inChunk(chestX, chestZ)) {
          out.chests.push({
            wx: chestX,
            wy: chestY,
            wz: chestZ,
            slots: makeLootSlots(this.noise, chestX, chestZ, [
              { id: 'emerald', min: 2, max: 5, chance: 0.95 },
              { id: 'iron_ingot', min: 2, max: 6, chance: 0.9 },
              { id: 'apple', min: 2, max: 5, chance: 0.85 },
              { id: 'bread', min: 2, max: 4, chance: 0.85 },
              { id: 'iron_pickaxe', min: 1, max: 1, chance: 0.55, durability: 250 },
              { id: 'iron_sword', min: 1, max: 1, chance: 0.45, durability: 250 },
              { id: BLOCK_IDS.OAK_SAPLING, min: 2, max: 4, chance: 0.7 },
            ]),
          });
        }
      } else if (h.profession === 'librarian') {
        setB(hx + h.w - 2, floorY + 1, hz + 1, BLOCK_IDS.BOOKSHELF);
        setB(hx + h.w - 2, floorY + 2, hz + 1, BLOCK_IDS.BOOKSHELF);
        setB(hx + 2, floorY + 3, hz + 2, BLOCK_IDS.LANTERN);
      } else {
        setB(
          hx + h.w - 2,
          floorY + 1,
          hz + 1,
          hi % 2 === 0 ? BLOCK_IDS.CRAFTING_TABLE : BLOCK_IDS.FURNACE
        );
      }

      // Spawn Villager right outside/near their house
      const vx = hx + Math.floor(h.w / 2);
      const vz = h.doorSide === 'S' ? hz + h.d + 1 : hz - 2;
      if (inChunk(vx, vz)) {
        const vy = sampleTerrainColumn(this.noise, vx, vz, this.worldType).height + 1;
        out.villagers.push({
          id: `${s.id}_v${hi}`,
          wx: vx + 0.5,
          wy: Math.max(vy, floorY + 1),
          wz: vz + 0.5,
          homeX: hx + Math.floor(h.w / 2) + 0.5,
          homeZ: hz + Math.floor(h.d / 2) + 0.5,
          profession: h.profession,
        });
      }
    }

    // 4. Mini Wheat Farm beside Eastern road
    const fx = cx + 13;
    const fz = cz - 3;
    const farmY = Math.max(SEA_LEVEL + 1, sampleTerrainColumn(this.noise, fx + 2, fz + 2, this.worldType).height);
    for (let dz = 0; dz < 6; dz++) {
      for (let dx = 0; dx < 5; dx++) {
        const wx = fx + dx;
        const wz = fz + dz;
        const isBorder = dx === 0 || dx === 4 || dz === 0 || dz === 5;
        setB(wx, farmY - 1, wz, BLOCK_IDS.DIRT);
        setB(wx, farmY + 2, wz, BLOCK_IDS.AIR);
        if (isBorder) {
          setB(wx, farmY, wz, BLOCK_IDS.OAK_LOG);
          setB(wx, farmY + 1, wz, BLOCK_IDS.AIR);
        } else if (dx === 2) {
          setB(wx, farmY, wz, BLOCK_IDS.WATER);
          setB(wx, farmY + 1, wz, BLOCK_IDS.AIR);
        } else {
          setB(wx, farmY, wz, BLOCK_IDS.FARMLAND);
          setB(wx, farmY + 1, wz, BLOCK_IDS.WHEAT_CROPS);
        }
      }
    }
  }

  private stampDesertPyramid(
    s: StructureDescriptor,
    setB: (wx: number, wy: number, wz: number, id: number) => void,
    inChunk: (wx: number, wz: number) => boolean,
    out: ChunkStructureOutput
  ): void {
    const cx = s.centerX;
    const cz = s.centerZ;
    const baseY = s.baseY;

    // Stepped pyramid body (half-width 8 down to 1)
    for (let layer = 0; layer <= 8; layer++) {
      const r = 8 - layer;
      const wy = baseY + layer;
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          const isOuter = Math.abs(dx) === r || Math.abs(dz) === r;
          const isFloor = layer === 0;
          if (isFloor) {
            for (let fy = baseY - 3; fy <= baseY; fy++) {
              setB(cx + dx, fy, cz + dz, BLOCK_IDS.SANDSTONE);
            }
          }
          if (isOuter || layer === 8) {
            const decorative = (layer === 3 || layer === 6) && (Math.abs(dx) % 2 === 0 || Math.abs(dz) % 2 === 0);
            setB(
              cx + dx,
              wy,
              cz + dz,
              decorative ? BLOCK_IDS.CHISELED_SANDSTONE : BLOCK_IDS.SANDSTONE
            );
          } else if (layer >= 1) {
            setB(cx + dx, wy, cz + dz, BLOCK_IDS.AIR);
          }
        }
      }
    }

    // Two front towers at +Z corners (dx = -7..-5 and +5..+7, dz = +6..+8)
    for (const side of [-1, 1]) {
      const tx0 = cx + side * 6;
      const tz0 = cz + 7;
      for (let dy = -2; dy <= 7; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          for (let dx = -1; dx <= 1; dx++) {
            const isChiseled = dy === 4 || dy === 7;
            setB(
              tx0 + dx,
              baseY + dy,
              tz0 + dz,
              isChiseled ? BLOCK_IDS.CHISELED_SANDSTONE : BLOCK_IDS.SANDSTONE
            );
          }
        }
      }
      setB(tx0, baseY + 8, tz0, BLOCK_IDS.TORCH);
    }

    // Entrance corridor on +Z face
    for (let dz = 6; dz <= 9; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        setB(cx + dx, baseY + 1, cz + dz, BLOCK_IDS.AIR);
        setB(cx + dx, baseY + 2, cz + dz, BLOCK_IDS.AIR);
        setB(cx + dx, baseY + 3, cz + dz, BLOCK_IDS.CHISELED_SANDSTONE);
      }
    }

    // Center shaft down to underground treasure chamber (baseY - 7 .. baseY - 3)
    for (let wy = baseY - 7; wy <= baseY - 1; wy++) {
      for (let dz = -3; dz <= 3; dz++) {
        for (let dx = -3; dx <= 3; dx++) {
          const isWall = Math.abs(dx) === 3 || Math.abs(dz) === 3 || wy === baseY - 7;
          if (wy >= baseY - 2) {
            if (Math.abs(dx) <= 1 && Math.abs(dz) <= 1) {
              setB(cx + dx, wy, cz + dz, BLOCK_IDS.AIR);
            }
          } else {
            setB(
              cx + dx,
              wy,
              cz + dz,
              isWall ? BLOCK_IDS.SANDSTONE : BLOCK_IDS.AIR
            );
          }
        }
      }
    }
    // Descending staircase blocks into chamber
    for (let step = 0; step < 5; step++) {
      setB(cx - 2, baseY - 1 - step, cz - 2 + step, BLOCK_IDS.COBBLESTONE_STAIRS);
    }
    setB(cx, baseY - 5, cz, BLOCK_IDS.CHISELED_SANDSTONE);
    setB(cx, baseY - 4, cz, BLOCK_IDS.TORCH);

    // 2 Treasure Chests inside chamber
    const chestPositions: Array<[number, number, number]> = [
      [cx - 2, baseY - 6, cz + 2],
      [cx + 2, baseY - 6, cz - 2],
    ];
    for (const [wx, wy, wz] of chestPositions) {
      setB(wx, wy, wz, BLOCK_IDS.CHEST);
      if (inChunk(wx, wz)) {
        out.chests.push({
          wx,
          wy,
          wz,
          slots: makeLootSlots(this.noise, wx, wz, [
            { id: 'diamond', min: 1, max: 3, chance: 0.78 },
            { id: 'emerald', min: 2, max: 5, chance: 0.9 },
            { id: 'gold_ingot', min: 3, max: 7, chance: 0.92 },
            { id: 'iron_ingot', min: 3, max: 6, chance: 0.85 },
            { id: 'iron_sword', min: 1, max: 1, chance: 0.5, durability: 250 },
            { id: 'bread', min: 2, max: 5, chance: 0.75 },
          ]),
        });
      }
    }
  }

  private stampWatchtower(
    s: StructureDescriptor,
    setB: (wx: number, wy: number, wz: number, id: number) => void,
    inChunk: (wx: number, wz: number) => boolean,
    out: ChunkStructureOutput
  ): void {
    const cx = s.centerX;
    const cz = s.centerZ;
    const baseY = s.baseY;
    const height = 12;

    // Foundation + 5x5 tower shaft of Cobblestone & Mossy Cobblestone
    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) {
        const wx = cx + dx;
        const wz = cz + dz;
        const terrH = sampleTerrainColumn(this.noise, wx, wz, this.worldType).height;
        for (let y = Math.min(terrH - 1, baseY - 4); y <= baseY; y++) {
          setB(wx, y, wz, BLOCK_IDS.COBBLESTONE);
        }

        const isWall = Math.abs(dx) === 2 || Math.abs(dz) === 2;
        const isDoor = dz === 2 && dx === 0;
        for (let dy = 1; dy <= height; dy++) {
          const wy = baseY + dy;
          if (isDoor && (dy === 1 || dy === 2)) {
            setB(wx, wy, wz, dy === 1 ? BLOCK_IDS.OAK_DOOR : BLOCK_IDS.AIR);
          } else if (isWall) {
            const isSlit = (dy === 5 || dy === 9) && (dx === 0 || dz === 0);
            if (isSlit) {
              setB(wx, wy, wz, BLOCK_IDS.AIR);
            } else {
              const mossy = this.noise.hash3D(wx, wy, wz, 4049) < 0.35;
              setB(wx, wy, wz, mossy ? BLOCK_IDS.MOSSY_COBBLESTONE : BLOCK_IDS.COBBLESTONE);
            }
          } else if (dy === 6 || dy === height) {
            // Intermediate & top wooden floor
            setB(wx, wy, wz, dx === 1 && dz === 1 && dy === 6 ? BLOCK_IDS.AIR : BLOCK_IDS.OAK_PLANKS);
          } else {
            setB(wx, wy, wz, BLOCK_IDS.AIR);
          }
        }
      }
    }

    // Interior stone stairs spiraling up along inner walls
    for (let dy = 1; dy < height; dy++) {
      const side = dy % 4;
      const sx = side === 0 ? -1 : side === 1 ? 0 : side === 2 ? 1 : 0;
      const sz = side === 0 ? 0 : side === 1 ? -1 : side === 2 ? 0 : 1;
      setB(cx + sx, baseY + dy, cz + sz, BLOCK_IDS.COBBLESTONE_STAIRS);
    }

    // Battlements (7x7 overhanging crown at height + 1) + corner torches
    for (let dz = -3; dz <= 3; dz++) {
      for (let dx = -3; dx <= 3; dx++) {
        const isRim = Math.abs(dx) === 3 || Math.abs(dz) === 3;
        if (isRim) {
          setB(cx + dx, baseY + height, cz + dz, BLOCK_IDS.COBBLESTONE);
          const crenel = (dx + dz) % 2 === 0;
          setB(cx + dx, baseY + height + 1, cz + dz, crenel ? BLOCK_IDS.MOSSY_COBBLESTONE : BLOCK_IDS.AIR);
        }
      }
    }
    setB(cx - 3, baseY + height + 2, cz - 3, BLOCK_IDS.TORCH);
    setB(cx + 3, baseY + height + 2, cz - 3, BLOCK_IDS.TORCH);
    setB(cx - 3, baseY + height + 2, cz + 3, BLOCK_IDS.TORCH);
    setB(cx + 3, baseY + height + 2, cz + 3, BLOCK_IDS.TORCH);

    // Top-floor supply Chest
    const chestX = cx;
    const chestY = baseY + height + 1;
    const chestZ = cz;
    setB(chestX, chestY, chestZ, BLOCK_IDS.CHEST);
    if (inChunk(chestX, chestZ)) {
      out.chests.push({
        wx: chestX,
        wy: chestY,
        wz: chestZ,
        slots: makeLootSlots(this.noise, chestX, chestZ, [
          { id: 'iron_ingot', min: 3, max: 6, chance: 0.9 },
          { id: 'coal', min: 6, max: 14, chance: 0.9 },
          { id: 'emerald', min: 1, max: 3, chance: 0.75 },
          { id: BLOCK_IDS.TORCH, min: 4, max: 12, chance: 0.9 },
          { id: 'cooked_porkchop', min: 2, max: 4, chance: 0.8 },
          { id: 'iron_helmet', min: 1, max: 1, chance: 0.5, durability: 165 },
        ]),
      });
    }
  }

  /**
   * Stamps a monumental Nether Fortress made of Nether Bricks:
   * - Elevated bridges spanning X & Z with crenellated railings and deep support pillars down into the lava sea
   * - Covered central crossing hall with arched windows, Glowstone ceiling lanterns, and torches
   * - North Treasure Room with 2 Nether loot chests
   * - East Blaze Platform with stairs, spawner plinth, and Blaze spawns
   */
  private stampNetherFortress(
    s: StructureDescriptor,
    setB: (wx: number, wy: number, wz: number, id: number) => void,
    inChunk: (wx: number, wz: number) => boolean,
    out: ChunkStructureOutput
  ): void {
    const cx = s.centerX;
    const cz = s.centerZ;
    const deckY = s.baseY;
    const pillarBottom = Math.max(5, LAVA_LEVEL - 24);

    // Helper: stamp a sturdy 2x2 Nether Brick support column descending down into lava / floor
    const stampPillar = (px: number, pz: number, topY: number) => {
      for (let y = pillarBottom; y <= topY; y++) {
        for (let dz = 0; dz <= 1; dz++) {
          for (let dx = 0; dx <= 1; dx++) {
            setB(px + dx, y, pz + dz, BLOCK_IDS.NETHER_BRICKS);
          }
        }
      }
    };

    // 1. Long Elevated Bridges along X (-24..+20) and Z (-20..+24), 5 blocks wide
    for (let d = -24; d <= 20; d++) {
      const wx = cx + d;
      for (let w = -2; w <= 2; w++) {
        const wz = cz + w;
        const isEdge = Math.abs(w) === 2;
        setB(wx, deckY - 1, wz, BLOCK_IDS.NETHER_BRICKS);
        setB(wx, deckY, wz, BLOCK_IDS.NETHER_BRICKS);
        // Clear headroom above bridge
        for (let dy = 1; dy <= 5; dy++) {
          setB(wx, deckY + dy, wz, BLOCK_IDS.AIR);
        }
        if (isEdge) {
          // Crenellated Nether Brick parapet railing
          setB(wx, deckY + 1, wz, BLOCK_IDS.NETHER_BRICKS);
          if (Math.abs(d) % 2 === 0) {
            setB(wx, deckY + 2, wz, BLOCK_IDS.NETHER_BRICKS);
          }
        }
      }
      if (Math.abs(d) >= 8 && Math.abs(d) % 9 === 0) {
        stampPillar(wx, cz - 2, deckY - 1);
        stampPillar(wx, cz + 1, deckY - 1);
      }
      if (Math.abs(d) >= 7 && Math.abs(d) % 8 === 0) {
        setB(wx, deckY + 2, cz - 2, BLOCK_IDS.TORCH);
        setB(wx, deckY + 2, cz + 2, BLOCK_IDS.TORCH);
      }
    }

    for (let d = -20; d <= 24; d++) {
      const wz = cz + d;
      for (let w = -2; w <= 2; w++) {
        const wx = cx + w;
        const isEdge = Math.abs(w) === 2;
        setB(wx, deckY - 1, wz, BLOCK_IDS.NETHER_BRICKS);
        setB(wx, deckY, wz, BLOCK_IDS.NETHER_BRICKS);
        for (let dy = 1; dy <= 5; dy++) {
          setB(wx, deckY + dy, wz, BLOCK_IDS.AIR);
        }
        if (isEdge) {
          setB(wx, deckY + 1, wz, BLOCK_IDS.NETHER_BRICKS);
          if (Math.abs(d) % 2 === 0) {
            setB(wx, deckY + 2, wz, BLOCK_IDS.NETHER_BRICKS);
          }
        }
      }
      if (Math.abs(d) >= 8 && Math.abs(d) % 9 === 0) {
        stampPillar(cx - 2, wz, deckY - 1);
        stampPillar(cx + 1, wz, deckY - 1);
      }
      if (Math.abs(d) >= 7 && Math.abs(d) % 8 === 0) {
        setB(cx - 2, deckY + 2, wz, BLOCK_IDS.TORCH);
        setB(cx + 2, deckY + 2, wz, BLOCK_IDS.TORCH);
      }
    }

    // 2. Covered Central Intersection Hall (11x11, deckY..deckY+7) with arched windows & Glowstone
    for (let dz = -5; dz <= 5; dz++) {
      for (let dx = -5; dx <= 5; dx++) {
        const wx = cx + dx;
        const wz = cz + dz;
        const isOuterX = Math.abs(dx) === 5;
        const isOuterZ = Math.abs(dz) === 5;
        const isWall = isOuterX || isOuterZ;
        const isCorridorDoor = (isOuterX && Math.abs(dz) <= 1) || (isOuterZ && Math.abs(dx) <= 1);
        const isWindow =
          isWall &&
          !isCorridorDoor &&
          ((isOuterX && Math.abs(dz) === 3) || (isOuterZ && Math.abs(dx) === 3));

        setB(wx, deckY - 1, wz, BLOCK_IDS.NETHER_BRICKS);
        setB(wx, deckY, wz, BLOCK_IDS.NETHER_BRICKS);

        for (let dy = 1; dy <= 7; dy++) {
          const wy = deckY + dy;
          if (dy === 6) {
            // Roof slab with central Glowstone lantern cross
            const isGlow =
              (Math.abs(dx) <= 1 && dz === 0) ||
              (Math.abs(dz) <= 1 && dx === 0) ||
              (Math.abs(dx) === 3 && Math.abs(dz) === 3);
            setB(wx, wy, wz, isGlow ? BLOCK_IDS.GLOWSTONE : BLOCK_IDS.NETHER_BRICKS);
          } else if (dy === 7) {
            // Rooftop battlements
            if (isWall && (dx + dz) % 2 === 0) {
              setB(wx, wy, wz, BLOCK_IDS.NETHER_BRICKS);
            } else {
              setB(wx, wy, wz, BLOCK_IDS.AIR);
            }
          } else if (isWall) {
            if (isCorridorDoor && dy <= 4) {
              setB(wx, wy, wz, BLOCK_IDS.AIR);
            } else if (isWindow && (dy === 2 || dy === 3)) {
              setB(wx, wy, wz, BLOCK_IDS.AIR);
            } else {
              setB(wx, wy, wz, BLOCK_IDS.NETHER_BRICKS);
            }
          } else {
            setB(wx, wy, wz, BLOCK_IDS.AIR);
          }
        }
      }
    }
    // 4 Corner support pillars beneath Central Hall
    stampPillar(cx - 5, cz - 5, deckY - 1);
    stampPillar(cx + 4, cz - 5, deckY - 1);
    stampPillar(cx - 5, cz + 4, deckY - 1);
    stampPillar(cx + 4, cz + 4, deckY - 1);
    // Interior lighting torches
    setB(cx - 4, deckY + 2, cz - 4, BLOCK_IDS.TORCH);
    setB(cx + 4, deckY + 2, cz - 4, BLOCK_IDS.TORCH);
    setB(cx - 4, deckY + 2, cz + 4, BLOCK_IDS.TORCH);
    setB(cx + 4, deckY + 2, cz + 4, BLOCK_IDS.TORCH);

    // 3. North Treasure Vault (centered at cx, cz - 23, 9x9)
    const tx = cx;
    const tz = cz - 23;
    for (let dz = -4; dz <= 4; dz++) {
      for (let dx = -4; dx <= 4; dx++) {
        const wx = tx + dx;
        const wz = tz + dz;
        const isWall = Math.abs(dx) === 4 || Math.abs(dz) === 4;
        const isEntrance = dz === 4 && Math.abs(dx) <= 1;
        setB(wx, deckY - 1, wz, BLOCK_IDS.NETHER_BRICKS);
        setB(wx, deckY, wz, BLOCK_IDS.NETHER_BRICKS);
        for (let dy = 1; dy <= 5; dy++) {
          if (dy === 5) {
            setB(
              wx,
              deckY + dy,
              wz,
              Math.abs(dx) <= 1 && Math.abs(dz) <= 1 ? BLOCK_IDS.GLOWSTONE : BLOCK_IDS.NETHER_BRICKS
            );
          } else if (isWall) {
            setB(wx, deckY + dy, wz, isEntrance && dy <= 3 ? BLOCK_IDS.AIR : BLOCK_IDS.NETHER_BRICKS);
          } else {
            setB(wx, deckY + dy, wz, BLOCK_IDS.AIR);
          }
        }
      }
    }
    stampPillar(tx - 4, tz - 4, deckY - 1);
    stampPillar(tx + 3, tz - 4, deckY - 1);
    setB(tx, deckY + 1, tz, BLOCK_IDS.MAGMA_BLOCK);
    setB(tx, deckY + 2, tz, BLOCK_IDS.FIRE);

    const fortressChests: Array<[number, number, number]> = [
      [tx - 3, deckY + 1, tz - 3],
      [tx + 3, deckY + 1, tz - 3],
    ];
    for (const [cwx, cwy, cwz] of fortressChests) {
      setB(cwx, cwy, cwz, BLOCK_IDS.CHEST);
      if (inChunk(cwx, cwz)) {
        out.chests.push({
          wx: cwx,
          wy: cwy,
          wz: cwz,
          slots: makeLootSlots(this.noise, cwx, cwz, [
            { id: 'diamond', min: 1, max: 3, chance: 0.72 },
            { id: 'gold_ingot', min: 3, max: 8, chance: 0.95 },
            { id: 'iron_ingot', min: 3, max: 7, chance: 0.88 },
            { id: BLOCK_IDS.OBSIDIAN, min: 2, max: 6, chance: 0.82 },
            { id: 'nether_quartz', min: 4, max: 12, chance: 0.9 },
            { id: 'blaze_powder', min: 1, max: 3, chance: 0.65 },
            { id: 'flint_and_steel', min: 1, max: 1, chance: 0.5, durability: 64 },
            { id: 'cooked_porkchop', min: 2, max: 5, chance: 0.8 },
          ]),
        });
      }
    }

    // 4. East Blaze Platform (centered at cx + 24, cz, 9x9 elevated arena with stairs & spawner)
    const bx = cx + 24;
    const bz = cz;
    const platY = deckY + 3;
    for (let dz = -4; dz <= 4; dz++) {
      for (let dx = -4; dx <= 4; dx++) {
        const wx = bx + dx;
        const wz = bz + dz;
        const isEdge = Math.abs(dx) === 4 || Math.abs(dz) === 4;
        const isStairOpening = dx === -4 && Math.abs(dz) <= 1;
        for (let y = deckY - 1; y <= platY; y++) {
          setB(wx, y, wz, BLOCK_IDS.NETHER_BRICKS);
        }
        for (let dy = 1; dy <= 6; dy++) {
          setB(wx, platY + dy, wz, BLOCK_IDS.AIR);
        }
        if (isEdge && !isStairOpening) {
          setB(wx, platY + 1, wz, BLOCK_IDS.NETHER_BRICKS);
          if ((dx + dz) % 2 === 0) {
            setB(wx, platY + 2, wz, BLOCK_IDS.NETHER_BRICKS);
          }
        }
      }
    }
    stampPillar(bx - 4, bz - 4, deckY - 1);
    stampPillar(bx + 3, bz - 4, deckY - 1);
    stampPillar(bx - 4, bz + 3, deckY - 1);
    stampPillar(bx + 3, bz + 3, deckY - 1);

    // Ascending staircase from East bridge (cx + 17..19) up onto Blaze platform
    for (let step = 0; step < 3; step++) {
      const sx = bx - 7 + step;
      for (let dz = -1; dz <= 1; dz++) {
        for (let y = deckY; y <= deckY + step + 1; y++) {
          setB(sx, y, bz + dz, BLOCK_IDS.NETHER_BRICKS);
        }
        for (let y = deckY + step + 2; y <= platY + 5; y++) {
          setB(sx, y, bz + dz, BLOCK_IDS.AIR);
        }
      }
    }

    // Glowing Blaze Spawner plinth in center of platform
    setB(bx, platY + 1, bz, BLOCK_IDS.MAGMA_BLOCK);
    setB(bx, platY + 2, bz, BLOCK_IDS.GLOWSTONE);
    setB(bx - 3, platY + 2, bz - 3, BLOCK_IDS.TORCH);
    setB(bx + 3, platY + 2, bz - 3, BLOCK_IDS.TORCH);
    setB(bx - 3, platY + 2, bz + 3, BLOCK_IDS.TORCH);
    setB(bx + 3, platY + 2, bz + 3, BLOCK_IDS.TORCH);

    const blazeSpots: Array<[number, number, string]> = [
      [bx - 2, bz - 1, `${s.id}_b0`],
      [bx + 2, bz + 1, `${s.id}_b1`],
    ];
    for (const [bwx, bwz, bid] of blazeSpots) {
      if (inChunk(bwx, bwz)) {
        out.blazes.push({
          id: bid,
          wx: bwx + 0.5,
          wy: platY + 2.2,
          wz: bwz + 0.5,
          homeX: bx + 0.5,
          homeZ: bz + 0.5,
        });
      }
    }
  }
}
