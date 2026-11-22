import { BLOCK_IDS, BLOCKS, isBlockSolid } from './blocks';
import type { BlockGetter } from './raycast';

export const PLAYER_WIDTH = 0.6;
export const PLAYER_HEIGHT = 1.8;
export const PLAYER_DEPTH = 0.6;
export const EYE_HEIGHT_STANDING = 1.62;
export const EYE_HEIGHT_CROUCHING = 1.35;

export const GRAVITY = -26.0;
export const WATER_GRAVITY = -5.0;
export const JUMP_VELOCITY = 8.4;
export const WALK_SPEED = 4.3;
export const SPRINT_SPEED = 5.8;
export const CROUCH_SPEED_FACTOR = 0.4;

export interface AABB {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export interface PlayerPhysicsState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  onGround: boolean;
  inWater: boolean;
  headInWater: boolean;
  inLava?: boolean;
  headInLava?: boolean;
  inPortal?: boolean;
  inFire?: boolean;
  onSoulSand?: boolean;
  onMagma?: boolean;
  onIce?: boolean;
  onLadder?: boolean;
  touchingCactus?: boolean;
  crouching: boolean;
  sprinting: boolean;
  isFlying?: boolean;
  peakAirY: number;
  coyoteTimer: number;
}

export interface PlayerInputState {
  forward: number; // -1..1
  strafe: number; // -1..1
  jumpHeld: boolean;
  jumpJustPressed: boolean;
  flyDown?: boolean;
  sprint: boolean;
  crouch: boolean;
  yaw: number;
}

export interface PhysicsStepResult {
  landed: boolean;
  fallDamage: number;
  splashed: boolean;
  bounced: boolean;
  movedDist: number;
}

export function getPlayerAABB(
  x: number,
  y: number,
  z: number,
  width = PLAYER_WIDTH,
  height = PLAYER_HEIGHT,
  depth = PLAYER_DEPTH
): AABB {
  const hw = width * 0.5;
  const hd = depth * 0.5;
  return {
    minX: x - hw,
    maxX: x + hw,
    minY: y,
    maxY: y + height,
    minZ: z - hd,
    maxZ: z + hd,
  };
}

export function aabbIntersectsBlock(aabb: AABB, bx: number, by: number, bz: number): boolean {
  return (
    aabb.minX < bx + 1 &&
    aabb.maxX > bx &&
    aabb.minY < by + 1 &&
    aabb.maxY > by &&
    aabb.minZ < bz + 1 &&
    aabb.maxZ > bz
  );
}

export function collidesWithSolidWorld(
  x: number,
  y: number,
  z: number,
  width: number,
  height: number,
  depth: number,
  getBlock: BlockGetter
): boolean {
  const hw = width * 0.5;
  const hd = depth * 0.5;
  const eps = 1e-4;
  const minBx = Math.floor(x - hw + eps);
  const maxBx = Math.floor(x + hw - eps);
  const minBy = Math.floor(y + eps);
  const maxBy = Math.floor(y + height - eps);
  const minBz = Math.floor(z - hd + eps);
  const maxBz = Math.floor(z + hd - eps);

  for (let by = minBy; by <= maxBy; by++) {
    for (let bz = minBz; bz <= maxBz; bz++) {
      for (let bx = minBx; bx <= maxBx; bx++) {
        if (isBlockSolid(getBlock(bx, by, bz))) {
          return true;
        }
      }
    }
  }
  return false;
}

export function aabbIntersectsBlockId(
  x: number,
  y: number,
  z: number,
  width: number,
  height: number,
  depth: number,
  getBlock: BlockGetter,
  targetBlockId: number
): boolean {
  const hw = width * 0.5;
  const hd = depth * 0.5;
  const minBx = Math.floor(x - hw);
  const maxBx = Math.floor(x + hw);
  const minBy = Math.floor(y + 0.08);
  const maxBy = Math.floor(y + height - 0.08);
  const minBz = Math.floor(z - hd);
  const maxBz = Math.floor(z + hd);

  for (let by = minBy; by <= maxBy; by++) {
    for (let bz = minBz; bz <= maxBz; bz++) {
      for (let bx = minBx; bx <= maxBx; bx++) {
        if (getBlock(bx, by, bz) === targetBlockId) {
          return true;
        }
      }
    }
  }
  return false;
}

export function aabbIntersectsWater(
  x: number,
  y: number,
  z: number,
  width: number,
  height: number,
  depth: number,
  getBlock: BlockGetter
): boolean {
  return aabbIntersectsBlockId(x, y, z, width, height, depth, getBlock, BLOCK_IDS.WATER);
}

/**
 * Safe-Edge check: returns true if the footprint has a solid block directly underneath
 * OR within a safe 1-block step-down (preventing falls > 1 block when crouching).
 */
function hasSafeGroundSupport(
  x: number,
  y: number,
  z: number,
  width: number,
  depth: number,
  getBlock: BlockGetter,
  allowOneBlockDrop = false
): boolean {
  const hw = width * 0.5;
  const hd = depth * 0.5;
  const eps = 1e-3;
  const checkY = Math.floor(y - 0.08);
  const minBx = Math.floor(x - hw + eps);
  const maxBx = Math.floor(x + hw - eps);
  const minBz = Math.floor(z - hd + eps);
  const maxBz = Math.floor(z + hd - eps);

  for (let bz = minBz; bz <= maxBz; bz++) {
    for (let bx = minBx; bx <= maxBx; bx++) {
      if (isBlockSolid(getBlock(bx, checkY, bz))) {
        return true;
      }
      if (allowOneBlockDrop && isBlockSolid(getBlock(bx, checkY - 1, bz))) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Axis-separated AABB collision resolution (Y first, then X, then Z) for both player and mobs.
 */
export function moveAABBWithCollisions(
  pos: { x: number; y: number; z: number },
  vel: { vx: number; vy: number; vz: number },
  width: number,
  height: number,
  depth: number,
  dt: number,
  getBlock: BlockGetter,
  preventLedgeFall = false,
  wasOnGround = false
): { onGround: boolean; hitX: boolean; hitZ: boolean } {
  const hw = width * 0.5;
  const hd = depth * 0.5;
  const eps = 1e-4;

  let onGround = false;
  let hitX = false;
  let hitZ = false;

  // 1. Resolve Y axis first
  const dy = vel.vy * dt;
  const nextY = pos.y + dy;
  if (dy !== 0) {
    const minBx = Math.floor(pos.x - hw + eps);
    const maxBx = Math.floor(pos.x + hw - eps);
    const minBz = Math.floor(pos.z - hd + eps);
    const maxBz = Math.floor(pos.z + hd - eps);

    if (dy < 0) {
      const checkBy = Math.floor(nextY);
      let collided = false;
      for (let bz = minBz; bz <= maxBz && !collided; bz++) {
        for (let bx = minBx; bx <= maxBx; bx++) {
          if (isBlockSolid(getBlock(bx, checkBy, bz))) {
            collided = true;
            break;
          }
        }
      }
      if (collided) {
        pos.y = checkBy + 1;
        vel.vy = 0;
        onGround = true;
      } else {
        pos.y = nextY;
      }
    } else {
      const checkBy = Math.floor(nextY + height);
      let collided = false;
      for (let bz = minBz; bz <= maxBz && !collided; bz++) {
        for (let bx = minBx; bx <= maxBx; bx++) {
          if (isBlockSolid(getBlock(bx, checkBy, bz))) {
            collided = true;
            break;
          }
        }
      }
      if (collided) {
        pos.y = checkBy - height - eps;
        vel.vy = 0;
      } else {
        pos.y = nextY;
      }
    }
  } else {
    onGround = hasSafeGroundSupport(pos.x, pos.y, pos.z, width, depth, getBlock, false);
  }

  const canAutoStepTo = (targetX: number, targetZ: number): boolean => {
    if (!wasOnGround && !onGround) return false;
    const footBy = Math.floor(pos.y + 0.05);
    const minBx = Math.floor(targetX - hw + eps);
    const maxBx = Math.floor(targetX + hw - eps);
    const minBz = Math.floor(targetZ - hd + eps);
    const maxBz = Math.floor(targetZ + hd - eps);
    let sawStepBlock = false;
    for (let bz = minBz; bz <= maxBz; bz++) {
      for (let bx = minBx; bx <= maxBx; bx++) {
        const bid = getBlock(bx, footBy, bz);
        if (!isBlockSolid(bid)) continue;
        const bdef = BLOCKS[bid];
        if (bdef?.isStairs || bdef?.isHalfHeight) {
          sawStepBlock = true;
        } else {
          return false;
        }
      }
    }
    if (!sawStepBlock) return false;
    const stepTopY = footBy + 1;
    return !collidesWithSolidWorld(targetX, stepTopY, targetZ, width, height, depth, getBlock);
  };

  // 2. Resolve X axis
  const dx = vel.vx * dt;
  if (dx !== 0) {
    const nextX = pos.x + dx;
    if (
      preventLedgeFall &&
      wasOnGround &&
      !hasSafeGroundSupport(nextX, pos.y, pos.z, width, depth, getBlock, true)
    ) {
      vel.vx = 0;
    } else if (collidesWithSolidWorld(nextX, pos.y, pos.z, width, height, depth, getBlock)) {
      if (canAutoStepTo(nextX, pos.z)) {
        pos.y = Math.floor(pos.y + 0.05) + 1;
        pos.x = nextX;
        onGround = true;
      } else {
        if (dx > 0) {
          const blockX = Math.floor(nextX + hw - eps);
          pos.x = blockX - hw - eps;
        } else {
          const blockX = Math.floor(nextX - hw + eps);
          pos.x = blockX + 1 + hw + eps;
        }
        vel.vx = 0;
        hitX = true;
      }
    } else {
      pos.x = nextX;
    }
  }

  // 3. Resolve Z axis
  const dz = vel.vz * dt;
  if (dz !== 0) {
    const nextZ = pos.z + dz;
    if (
      preventLedgeFall &&
      wasOnGround &&
      !hasSafeGroundSupport(pos.x, pos.y, nextZ, width, depth, getBlock, true)
    ) {
      vel.vz = 0;
    } else if (collidesWithSolidWorld(pos.x, pos.y, nextZ, width, height, depth, getBlock)) {
      if (canAutoStepTo(pos.x, nextZ)) {
        pos.y = Math.floor(pos.y + 0.05) + 1;
        pos.z = nextZ;
        onGround = true;
      } else {
        if (dz > 0) {
          const blockZ = Math.floor(nextZ + hd - eps);
          pos.z = blockZ - hd - eps;
        } else {
          const blockZ = Math.floor(nextZ - hd + eps);
          pos.z = blockZ + 1 + hd + eps;
        }
        vel.vz = 0;
        hitZ = true;
      }
    } else {
      pos.z = nextZ;
    }
  }

  return { onGround, hitX, hitZ };
}

export function calculateFallDamage(
  fallDistance: number,
  landedInWater: boolean,
  landedOnHayBale = false,
  landedOnSlime = false
): number {
  if (landedInWater || landedOnSlime || fallDistance <= 3.5) return 0;
  const raw = Math.max(0, Math.floor(fallDistance - 3));
  if (landedOnHayBale) {
    return Math.max(0, Math.floor(raw * 0.2));
  }
  return raw;
}

export function stepPlayerPhysics(
  state: PlayerPhysicsState,
  input: PlayerInputState,
  dt: number,
  getBlock: BlockGetter
): PhysicsStepResult {
  const prevX = state.x;
  const prevZ = state.z;
  const wasOnGround = state.onGround;
  const wasInWater = state.inWater;

  // Water, Lava, Portal, Fire, Soul Sand & Magma detection
  state.inWater = aabbIntersectsWater(
    state.x,
    state.y,
    state.z,
    PLAYER_WIDTH,
    PLAYER_HEIGHT,
    PLAYER_DEPTH,
    getBlock
  );
  state.inLava = aabbIntersectsBlockId(
    state.x,
    state.y,
    state.z,
    PLAYER_WIDTH,
    PLAYER_HEIGHT,
    PLAYER_DEPTH,
    getBlock,
    BLOCK_IDS.LAVA
  );
  state.inPortal = aabbIntersectsBlockId(
    state.x,
    state.y,
    state.z,
    PLAYER_WIDTH,
    PLAYER_HEIGHT,
    PLAYER_DEPTH,
    getBlock,
    BLOCK_IDS.NETHER_PORTAL
  );
  state.inFire = aabbIntersectsBlockId(
    state.x,
    state.y,
    state.z,
    PLAYER_WIDTH,
    PLAYER_HEIGHT,
    PLAYER_DEPTH,
    getBlock,
    BLOCK_IDS.FIRE
  );
  state.onLadder = aabbIntersectsBlockId(
    state.x,
    state.y,
    state.z,
    PLAYER_WIDTH,
    PLAYER_HEIGHT,
    PLAYER_DEPTH,
    getBlock,
    BLOCK_IDS.LADDER
  );
  state.touchingCactus = aabbIntersectsBlockId(
    state.x,
    state.y,
    state.z,
    PLAYER_WIDTH + 0.16,
    PLAYER_HEIGHT,
    PLAYER_DEPTH + 0.16,
    getBlock,
    BLOCK_IDS.CACTUS
  );
  const eyeY = state.y + (state.crouching ? EYE_HEIGHT_CROUCHING : EYE_HEIGHT_STANDING);
  const headBlock = getBlock(Math.floor(state.x), Math.floor(eyeY), Math.floor(state.z));
  state.headInWater = headBlock === BLOCK_IDS.WATER;
  state.headInLava = headBlock === BLOCK_IDS.LAVA;

  const groundBlock = getBlock(
    Math.floor(state.x),
    Math.floor(state.y - 0.12),
    Math.floor(state.z)
  );
  state.onSoulSand = state.onGround && groundBlock === BLOCK_IDS.SOUL_SAND;
  state.onMagma = state.onGround && groundBlock === BLOCK_IDS.MAGMA_BLOCK;
  state.onIce =
    state.onGround && (groundBlock === BLOCK_IDS.ICE || groundBlock === BLOCK_IDS.PACKED_ICE);

  const splashed = !wasInWater && state.inWater && state.vy < -3.0;

  state.crouching = input.crouch;
  state.sprinting =
    input.sprint && input.forward > 0 && !state.crouching && !state.inWater && !state.inLava;

  // Horizontal direction projected on XZ plane of camera yaw
  // Three.js camera looks down -Z when yaw=0, +X is right.
  const sinY = Math.sin(input.yaw);
  const cosY = Math.cos(input.yaw);
  const forwardX = -sinY;
  const forwardZ = -cosY;
  const rightX = cosY;
  const rightZ = -sinY;

  let wishX = forwardX * input.forward + rightX * input.strafe;
  let wishZ = forwardZ * input.forward + rightZ * input.strafe;
  const wishLen = Math.hypot(wishX, wishZ);
  if (wishLen > 1e-4) {
    wishX /= wishLen;
    wishZ /= wishLen;
  }

  let targetSpeed = state.sprinting ? SPRINT_SPEED : WALK_SPEED;
  if (state.isFlying) {
    targetSpeed *= 1.5;
  } else {
    if (state.crouching) targetSpeed *= CROUCH_SPEED_FACTOR;
    if (state.inWater) targetSpeed *= 0.6;
    if (state.inLava) targetSpeed *= 0.35; // Lava is 65% slower (more viscous than water)
    if (state.onSoulSand) targetSpeed *= 0.6; // Soul Sand slows movement by 40%
    if (state.onIce) targetSpeed *= 1.25; // Slippery glacier boost
  }

  // Ground vs Ice vs Air vs Water/Lava vs Flight friction & acceleration
  const accel = state.isFlying
    ? 11.0
    : state.inLava
      ? 4.2
      : state.inWater
        ? 6.0
        : state.onIce
          ? 2.0
          : state.onGround
            ? 14.0
            : 4.2;
  const blend = 1 - Math.exp(-accel * dt);
  state.vx += (wishX * targetSpeed - state.vx) * blend;
  state.vz += (wishZ * targetSpeed - state.vz) * blend;

  // Coyote time for responsive jumping
  if (state.onGround) {
    state.coyoteTimer = 0.09;
  } else {
    state.coyoteTimer = Math.max(0, state.coyoteTimer - dt);
  }

  // Gravity & Jumping / Climbing / Swimming / Lava / Creative Flight
  if (state.isFlying) {
    const ascend = input.jumpHeld ? 7.4 : 0;
    const descend = input.flyDown || input.crouch ? 7.4 : 0;
    const targetVy = ascend - descend;
    state.vy += (targetVy - state.vy) * (1 - Math.exp(-12.0 * dt));
    if (Math.abs(state.vy) < 0.03 && targetVy === 0) state.vy = 0;
    state.peakAirY = state.y;
  } else if (state.onLadder) {
    // Ladder climbing: cancels gravity & fall damage
    if (input.jumpHeld || input.forward > 0.1) {
      state.vy = 3.6;
    } else if (input.forward < -0.1) {
      state.vy = -2.6;
    } else if (input.crouch) {
      state.vy = 0;
    } else {
      state.vy = -0.25;
    }
    state.peakAirY = state.y;
  } else if (state.inLava) {
    state.vy += WATER_GRAVITY * 0.72 * dt;
    const lavaDrag = Math.exp(-5.4 * dt);
    state.vx *= lavaDrag;
    state.vz *= lavaDrag;
    state.vy *= Math.exp(-4.2 * dt);
    if (input.jumpHeld) {
      state.vy = Math.min(state.vy + 14.0 * dt, 2.5);
    }
    state.peakAirY = state.y;
  } else if (state.inWater) {
    state.vy += WATER_GRAVITY * dt;
    // Viscous water drag
    const waterDrag = Math.exp(-3.8 * dt);
    state.vx *= waterDrag;
    state.vz *= waterDrag;
    state.vy *= Math.exp(-2.8 * dt);
    if (input.jumpHeld) {
      state.vy = Math.min(state.vy + 18.0 * dt, 3.6);
    }
    state.peakAirY = state.y;
  } else {
    if ((input.jumpJustPressed || input.jumpHeld) && (state.onGround || state.coyoteTimer > 0)) {
      if (state.onGround || input.jumpJustPressed) {
        state.vy = JUMP_VELOCITY;
        state.onGround = false;
        state.coyoteTimer = 0;
        state.peakAirY = state.y;
      }
    }
    state.vy += GRAVITY * dt;
    if (state.vy < -50) state.vy = -50;
  }

  const impactVy = state.vy;
  const descendingInFlight = Boolean(state.isFlying && state.vy < -0.1);
  const res = moveAABBWithCollisions(
    state,
    state,
    PLAYER_WIDTH,
    PLAYER_HEIGHT,
    PLAYER_DEPTH,
    dt,
    getBlock,
    !state.isFlying && state.crouching && !state.inWater && !state.inLava && !state.onLadder,
    wasOnGround
  );
  state.onGround = res.onGround;

  // Touching solid ground while descending in Creative flight exits flight automatically
  if (state.isFlying && res.onGround && descendingInFlight) {
    state.isFlying = false;
  }

  // Track peak air Y and compute fall damage / Slime Block rebound upon landing
  let fallDamage = 0;
  let landed = false;
  let bounced = false;
  if (state.isFlying || state.inWater || state.inLava || state.onLadder) {
    state.peakAirY = state.y;
  } else if (!state.onGround) {
    if (wasOnGround || state.y > state.peakAirY) {
      state.peakAirY = Math.max(state.peakAirY, state.y);
    }
  } else if (!wasOnGround && state.onGround) {
    landed = true;
    const fallDist = state.peakAirY - state.y;
    const landedBlock = getBlock(
      Math.floor(state.x),
      Math.floor(state.y - 0.12),
      Math.floor(state.z)
    );
    const onSlime = landedBlock === BLOCK_IDS.SLIME_BLOCK;
    fallDamage = calculateFallDamage(
      fallDist,
      state.inWater,
      landedBlock === BLOCK_IDS.HAY_BALE,
      onSlime
    );
    if (onSlime && !state.crouching && (fallDist > 0.65 || impactVy < -4.0)) {
      state.vy = Math.min(13.8, Math.max(6.4, Math.abs(impactVy) * 0.82));
      state.onGround = false;
      bounced = true;
    }
    state.peakAirY = state.y;
  } else {
    state.peakAirY = state.y;
  }

  const movedDist = Math.hypot(state.x - prevX, state.z - prevZ);
  return { landed, fallDamage, splashed, bounced, movedDist };
}
