import { BLOCK_IDS, CHUNK_HEIGHT, isBlockSolid, LAVA_LEVEL } from './blocks';
import type { BlockGetter } from './raycast';
import type { DimensionId } from './types';

export interface ValidPortalFrame {
  axis: 'x' | 'z';
  originX: number;
  originY: number;
  originZ: number;
  width: number;
  height: number;
  interiorCells: Array<[number, number, number]>;
}

const MIN_PORTAL_WIDTH = 2;
const MIN_PORTAL_HEIGHT = 3;
const MAX_PORTAL_SPAN = 10;

function isPortalInteriorEmpty(blockId: number): boolean {
  return (
    blockId === BLOCK_IDS.AIR ||
    blockId === BLOCK_IDS.FIRE ||
    blockId === BLOCK_IDS.NETHER_PORTAL
  );
}

/**
 * Validates a rectangular vertical Obsidian frame oriented along either the X or Z axis.
 * Accepts 2x3 up to 10x10 interior openings (classic Minecraft rule: the 4 outer corners are optional).
 */
function probeAxisFrame(
  getBlock: BlockGetter,
  startX: number,
  startY: number,
  startZ: number,
  axis: 'x' | 'z'
): ValidPortalFrame | null {
  if (!isPortalInteriorEmpty(getBlock(startX, startY, startZ))) return null;

  const dx = axis === 'x' ? 1 : 0;
  const dz = axis === 'z' ? 1 : 0;

  // 1. Descend to find the bottom Obsidian rail
  let bottomY = startY;
  let steps = 0;
  while (bottomY > 1 && steps <= MAX_PORTAL_SPAN) {
    const below = getBlock(startX, bottomY - 1, startZ);
    if (below === BLOCK_IDS.OBSIDIAN) break;
    if (!isPortalInteriorEmpty(below)) return null;
    bottomY--;
    steps++;
  }
  if (getBlock(startX, bottomY - 1, startZ) !== BLOCK_IDS.OBSIDIAN) return null;

  // 2. Walk negative along axis to find the left Obsidian pillar
  let minOffset = 0;
  while (minOffset > -MAX_PORTAL_SPAN) {
    const nextX = startX + (minOffset - 1) * dx;
    const nextZ = startZ + (minOffset - 1) * dz;
    const b = getBlock(nextX, bottomY, nextZ);
    if (b === BLOCK_IDS.OBSIDIAN) break;
    if (!isPortalInteriorEmpty(b)) return null;
    minOffset--;
  }
  const leftX = startX + minOffset * dx;
  const leftZ = startZ + minOffset * dz;
  if (getBlock(leftX - dx, bottomY, leftZ - dz) !== BLOCK_IDS.OBSIDIAN) return null;

  // 3. Measure interior width walking positive along axis
  let width = 0;
  while (width <= MAX_PORTAL_SPAN) {
    const curX = leftX + width * dx;
    const curZ = leftZ + width * dz;
    const b = getBlock(curX, bottomY, curZ);
    if (b === BLOCK_IDS.OBSIDIAN) break;
    if (!isPortalInteriorEmpty(b)) return null;
    width++;
  }
  if (width < MIN_PORTAL_WIDTH || width > MAX_PORTAL_SPAN) return null;
  if (getBlock(leftX + width * dx, bottomY, leftZ + width * dz) !== BLOCK_IDS.OBSIDIAN) {
    return null;
  }

  // 4. Measure interior height walking upward
  let height = 0;
  while (height <= MAX_PORTAL_SPAN && bottomY + height < CHUNK_HEIGHT - 1) {
    const b = getBlock(leftX, bottomY + height, leftZ);
    if (b === BLOCK_IDS.OBSIDIAN) break;
    if (!isPortalInteriorEmpty(b)) return null;
    height++;
  }
  if (height < MIN_PORTAL_HEIGHT || height > MAX_PORTAL_SPAN) return null;
  if (getBlock(leftX, bottomY + height, leftZ) !== BLOCK_IDS.OBSIDIAN) return null;

  // 5. Verify top & bottom horizontal Obsidian rails
  for (let w = 0; w < width; w++) {
    const cx = leftX + w * dx;
    const cz = leftZ + w * dz;
    if (getBlock(cx, bottomY - 1, cz) !== BLOCK_IDS.OBSIDIAN) return null;
    if (getBlock(cx, bottomY + height, cz) !== BLOCK_IDS.OBSIDIAN) return null;
  }

  // 6. Verify left & right vertical Obsidian pillars
  for (let h = 0; h < height; h++) {
    const cy = bottomY + h;
    if (getBlock(leftX - dx, cy, leftZ - dz) !== BLOCK_IDS.OBSIDIAN) return null;
    if (getBlock(leftX + width * dx, cy, leftZ + width * dz) !== BLOCK_IDS.OBSIDIAN) return null;
  }

  // 7. Verify entire interior opening is clear & collect cells
  const interiorCells: Array<[number, number, number]> = [];
  for (let h = 0; h < height; h++) {
    for (let w = 0; w < width; w++) {
      const cx = leftX + w * dx;
      const cy = bottomY + h;
      const cz = leftZ + w * dz;
      if (!isPortalInteriorEmpty(getBlock(cx, cy, cz))) return null;
      interiorCells.push([cx, cy, cz]);
    }
  }

  return {
    axis,
    originX: leftX,
    originY: bottomY,
    originZ: leftZ,
    width,
    height,
    interiorCells,
  };
}

/**
 * Checks whether the given Air coordinate sits inside a valid Obsidian Nether Portal frame
 * along either the XY or ZY plane.
 */
export function findValidPortalFrame(
  getBlock: BlockGetter,
  startX: number,
  startY: number,
  startZ: number
): ValidPortalFrame | null {
  return (
    probeAxisFrame(getBlock, startX, startY, startZ, 'x') ??
    probeAxisFrame(getBlock, startX, startY, startZ, 'z')
  );
}

/**
 * Computes scaled destination coordinates between Overworld and Nether (1:8 scale).
 */
export function scalePortalCoordinates(
  x: number,
  z: number,
  from: DimensionId,
  to: DimensionId
): { x: number; z: number } {
  if (from === 'overworld' && to === 'nether') {
    return { x: Math.floor(x / 8), z: Math.floor(z / 8) };
  }
  if (from === 'nether' && to === 'overworld') {
    return { x: Math.floor(x * 8), z: Math.floor(z * 8) };
  }
  return { x: Math.floor(x), z: Math.floor(z) };
}

/**
 * Searches within `radius` blocks horizontally for an existing Nether Portal block.
 * Returns the bottom-most cell of the closest portal column if found.
 */
export function findNearestPortal(
  getBlock: BlockGetter,
  centerX: number,
  centerZ: number,
  radius = 16
): { x: number; y: number; z: number } | null {
  let best: { x: number; y: number; z: number; distSq: number } | null = null;
  for (let dz = -radius; dz <= radius; dz++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const wx = centerX + dx;
      const wz = centerZ + dz;
      const d2 = dx * dx + dz * dz;
      if (best && d2 >= best.distSq) continue;
      for (let y = 4; y <= 118; y++) {
        if (getBlock(wx, y, wz) === BLOCK_IDS.NETHER_PORTAL) {
          // Walk down to the bottom of this portal column
          let py = y;
          while (py > 2 && getBlock(wx, py - 1, wz) === BLOCK_IDS.NETHER_PORTAL) {
            py--;
          }
          best = { x: wx, y: py, z: wz, distSq: d2 };
          break;
        }
      }
    }
  }
  return best ? { x: best.x, y: best.y, z: best.z } : null;
}

/**
 * Finds a safe ground Y for placing a return portal in either Overworld or Nether.
 * In the Nether, scans Y=36..96 for solid ground with 4 blocks of air headroom above lava;
 * if suspended over the lava sea, falls back cleanly to Y=46 where a 4x3 Obsidian platform is built.
 */
export function findSafeReturnPortalY(
  getBlock: BlockGetter,
  wx: number,
  wz: number,
  dimension: DimensionId
): number {
  if (dimension === 'nether') {
    for (let y = 36; y <= 96; y++) {
      const floor = getBlock(wx, y - 1, wz);
      if (isBlockSolid(floor) && floor !== BLOCK_IDS.BEDROCK) {
        let clear = true;
        for (let h = 0; h < 4; h++) {
          const b = getBlock(wx, y + h, wz);
          if (b !== BLOCK_IDS.AIR && b !== BLOCK_IDS.FIRE) {
            clear = false;
            break;
          }
        }
        if (clear) return y;
      }
    }
    return Math.max(LAVA_LEVEL + 15, 46);
  }

  // Overworld: find highest solid non-liquid surface
  for (let y = 112; y >= 24; y--) {
    const b = getBlock(wx, y, wz);
    if (b === BLOCK_IDS.WATER) {
      return y + 1;
    }
    if (isBlockSolid(b) && b !== BLOCK_IDS.OAK_LEAVES) {
      return y + 1;
    }
  }
  return 64;
}

/**
 * Builds a complete 4x5 lit Obsidian portal on a safe 4x3 Obsidian platform,
 * clearing headroom around it so the player always arrives safely with solid footing.
 * Returns the exact standing spawn coordinates right in front of the portal.
 */
export function buildSafeReturnPortal(
  setBlock: (x: number, y: number, z: number, id: number) => void,
  centerX: number,
  baseY: number,
  centerZ: number
): { x: number; y: number; z: number } {
  const originX = centerX - 1; // Frame occupies originX .. originX+3 (4 wide)
  const y0 = Math.max(5, Math.min(114, baseY));

  // 1. Clear safe 4x4x4 chamber around the portal & forward vista (+Z)
  for (let y = y0; y <= y0 + 3; y++) {
    for (let dz = -1; dz <= 2; dz++) {
      for (let dx = 0; dx <= 3; dx++) {
        setBlock(originX + dx, y, centerZ + dz, BLOCK_IDS.AIR);
      }
    }
  }

  // 2. Solid 4x3 Obsidian landing platform beneath the portal
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = 0; dx <= 3; dx++) {
      setBlock(originX + dx, y0 - 1, centerZ + dz, BLOCK_IDS.OBSIDIAN);
    }
  }

  // 3. Classic 4x5 Obsidian frame along X plane at centerZ
  for (let dx = 0; dx <= 3; dx++) {
    setBlock(originX + dx, y0 - 1, centerZ, BLOCK_IDS.OBSIDIAN);
    setBlock(originX + dx, y0 + 3, centerZ, BLOCK_IDS.OBSIDIAN);
  }
  for (let dy = 0; dy <= 2; dy++) {
    setBlock(originX, y0 + dy, centerZ, BLOCK_IDS.OBSIDIAN);
    setBlock(originX + 3, y0 + dy, centerZ, BLOCK_IDS.OBSIDIAN);
  }

  // 4. Fill 2x3 interior with lit Nether Portal blocks
  for (let dy = 0; dy <= 2; dy++) {
    setBlock(originX + 1, y0 + dy, centerZ, BLOCK_IDS.NETHER_PORTAL);
    setBlock(originX + 2, y0 + dy, centerZ, BLOCK_IDS.NETHER_PORTAL);
  }

  // Place player centered on the front Obsidian landing ledge cleanly outside the portal block
  return {
    x: originX + 2.0,
    y: y0 + 0.05,
    z: centerZ + 1.55,
  };
}
