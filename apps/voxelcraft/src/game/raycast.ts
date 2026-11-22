import { BLOCK_IDS } from './blocks';
import type { RaycastHit } from './types';

export type BlockGetter = (x: number, y: number, z: number) => number;

/**
 * Fast Voxel Traversal (Amanatides & Woo DDA) from ray origin along normalized dir
 * up to maxDistance (default 5.0 blocks). Skips Air (0) and Water (5).
 */
export function raycastVoxel(
  originX: number,
  originY: number,
  originZ: number,
  dirX: number,
  dirY: number,
  dirZ: number,
  getBlock: BlockGetter,
  maxDistance = 5.0
): RaycastHit | null {
  const len = Math.hypot(dirX, dirY, dirZ);
  if (len < 1e-8) return null;
  const dx = dirX / len;
  const dy = dirY / len;
  const dz = dirZ / len;

  let x = Math.floor(originX);
  let y = Math.floor(originY);
  let z = Math.floor(originZ);

  const stepX = dx > 0 ? 1 : dx < 0 ? -1 : 0;
  const stepY = dy > 0 ? 1 : dy < 0 ? -1 : 0;
  const stepZ = dz > 0 ? 1 : dz < 0 ? -1 : 0;

  const tDeltaX = dx !== 0 ? Math.abs(1 / dx) : Infinity;
  const tDeltaY = dy !== 0 ? Math.abs(1 / dy) : Infinity;
  const tDeltaZ = dz !== 0 ? Math.abs(1 / dz) : Infinity;

  let tMaxX =
    dx > 0
      ? (x + 1 - originX) * tDeltaX
      : dx < 0
      ? (originX - x) * tDeltaX
      : Infinity;
  let tMaxY =
    dy > 0
      ? (y + 1 - originY) * tDeltaY
      : dy < 0
      ? (originY - y) * tDeltaY
      : Infinity;
  let tMaxZ =
    dz > 0
      ? (z + 1 - originZ) * tDeltaZ
      : dz < 0
      ? (originZ - z) * tDeltaZ
      : Infinity;

  let nx = 0;
  let ny = 0;
  let nz = 0;
  let t = 0;

  // Check starting voxel if already inside a selectable non-air, non-water block
  const startId = getBlock(x, y, z);
  if (startId !== BLOCK_IDS.AIR && startId !== BLOCK_IDS.WATER) {
    return {
      hit: true,
      pos: [x, y, z],
      normal: [0, 1, 0],
      blockId: startId,
    };
  }

  for (let i = 0; i < 64; i++) {
    if (tMaxX < tMaxY) {
      if (tMaxX < tMaxZ) {
        t = tMaxX;
        if (t > maxDistance) break;
        x += stepX;
        tMaxX += tDeltaX;
        nx = -stepX;
        ny = 0;
        nz = 0;
      } else {
        t = tMaxZ;
        if (t > maxDistance) break;
        z += stepZ;
        tMaxZ += tDeltaZ;
        nx = 0;
        ny = 0;
        nz = -stepZ;
      }
    } else {
      if (tMaxY < tMaxZ) {
        t = tMaxY;
        if (t > maxDistance) break;
        y += stepY;
        tMaxY += tDeltaY;
        nx = 0;
        ny = -stepY;
        nz = 0;
      } else {
        t = tMaxZ;
        if (t > maxDistance) break;
        z += stepZ;
        tMaxZ += tDeltaZ;
        nx = 0;
        ny = 0;
        nz = -stepZ;
      }
    }

    const blockId = getBlock(x, y, z);
    if (blockId !== BLOCK_IDS.AIR && blockId !== BLOCK_IDS.WATER) {
      return {
        hit: true,
        pos: [x, y, z],
        normal: [nx, ny, nz],
        blockId,
      };
    }
  }

  return null;
}
