import * as THREE from 'three';
import { BLOCK_IDS, BLOCKS, getItemDef, isBlockSolid } from './blocks';
import { GRAVITY, moveAABBWithCollisions } from './physics';
import { raycastVoxel, type BlockGetter } from './raycast';
import { createMobFaceTexture, TILES_PER_ROW } from './textures';
import type { ArmorSlots, Difficulty, DimensionId, ItemId, VillagerProfession } from './types';

// Scratch objects outside render loop (zero GC)
const _dummy = new THREE.Object3D();
const _color = new THREE.Color();
const _arrowDir = new THREE.Vector3();
const _upVec = new THREE.Vector3(0, 1, 0);

export type MobKind =
  | 'pig'
  | 'sheep'
  | 'zombie'
  | 'skeleton'
  | 'villager'
  | 'zombie_piglin'
  | 'ghast'
  | 'blaze';

export interface MobDrop {
  itemId: ItemId;
  count: number;
}

export interface MobUpdateContext {
  dt: number;
  playerX: number;
  playerY: number;
  playerZ: number;
  isDay: boolean;
  dimension: DimensionId;
  getBlock: BlockGetter;
  getSkyLight: (x: number, y: number, z: number) => number;
  onDamagePlayer: (amount: number, source: 'mob' | 'arrow' | 'fireball', dirX: number, dirZ: number) => void;
  onShootArrow: (x: number, y: number, z: number, vx: number, vy: number, vz: number) => void;
  onShootFireball: (
    kind: 'ghast' | 'blaze',
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number
  ) => void;
  onGhastScream: () => void;
  onEmitParticles: (wx: number, wy: number, wz: number, hexColor: string, count?: number) => void;
}

/**
 * Zero-GC pooled 3D ParticleSystem using a single InstancedMesh ring buffer.
 * Emits mini-cubes on block hit/break, critical hits, eating crumbs, and undead fire embers.
 */
export class ParticleSystem {
  private readonly capacity = 320;
  public readonly mesh: THREE.InstancedMesh;
  private readonly px = new Float32Array(320);
  private readonly py = new Float32Array(320);
  private readonly pz = new Float32Array(320);
  private readonly vx = new Float32Array(320);
  private readonly vy = new Float32Array(320);
  private readonly vz = new Float32Array(320);
  private readonly life = new Float32Array(320);
  private readonly maxLife = new Float32Array(320);
  private readonly scale = new Float32Array(320);
  private cursor = 0;

  constructor(scene: THREE.Scene) {
    const geo = new THREE.BoxGeometry(0.14, 0.14, 0.14);
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    this.mesh = new THREE.InstancedMesh(geo, mat, this.capacity);
    this.mesh.frustumCulled = false;
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(this.capacity * 3),
      3
    );

    _dummy.scale.set(0, 0, 0);
    _dummy.updateMatrix();
    for (let i = 0; i < this.capacity; i++) {
      this.mesh.setMatrixAt(i, _dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    scene.add(this.mesh);
  }

  public emitBlockBurst(wx: number, wy: number, wz: number, hexColor: string, count = 10): void {
    _color.set(hexColor);
    for (let i = 0; i < count; i++) {
      const idx = this.cursor;
      this.cursor = (this.cursor + 1) % this.capacity;

      this.px[idx] = wx + 0.15 + Math.random() * 0.7;
      this.py[idx] = wy + 0.15 + Math.random() * 0.7;
      this.pz[idx] = wz + 0.15 + Math.random() * 0.7;
      this.vx[idx] = (Math.random() - 0.5) * 4.2;
      this.vy[idx] = 2.2 + Math.random() * 3.2;
      this.vz[idx] = (Math.random() - 0.5) * 4.2;
      this.maxLife[idx] = 0.5 + Math.random() * 0.18;
      this.life[idx] = this.maxLife[idx];
      this.scale[idx] = 0.7 + Math.random() * 0.6;

      const jitter = 0.85 + Math.random() * 0.3;
      this.mesh.setColorAt(idx, _color.clone().multiplyScalar(jitter));
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  public emitCriticalBurst(wx: number, wy: number, wz: number): void {
    const colors = ['#ffe94d', '#ffb81c', '#fff7ad'];
    for (let i = 0; i < 14; i++) {
      const idx = this.cursor;
      this.cursor = (this.cursor + 1) % this.capacity;
      const angle = (i / 14) * Math.PI * 2 + Math.random() * 0.3;
      const speed = 2.6 + Math.random() * 2.4;

      this.px[idx] = wx;
      this.py[idx] = wy;
      this.pz[idx] = wz;
      this.vx[idx] = Math.cos(angle) * speed;
      this.vy[idx] = 2.4 + Math.random() * 2.6;
      this.vz[idx] = Math.sin(angle) * speed;
      this.maxLife[idx] = 0.48 + Math.random() * 0.2;
      this.life[idx] = this.maxLife[idx];
      this.scale[idx] = 0.95 + Math.random() * 0.55;

      _color.set(colors[i % colors.length]);
      this.mesh.setColorAt(idx, _color);
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  public update(dt: number): void {
    let anyActive = false;
    for (let i = 0; i < this.capacity; i++) {
      if (this.life[i] <= 0) continue;
      anyActive = true;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        _dummy.position.set(0, -100, 0);
        _dummy.scale.set(0, 0, 0);
        _dummy.updateMatrix();
        this.mesh.setMatrixAt(i, _dummy.matrix);
        continue;
      }

      this.vy[i] += GRAVITY * 0.65 * dt;
      this.px[i] += this.vx[i] * dt;
      this.py[i] += this.vy[i] * dt;
      this.pz[i] += this.vz[i] * dt;

      const frac = this.life[i] / this.maxLife[i];
      const s = this.scale[i] * (0.4 + 0.6 * frac);
      _dummy.position.set(this.px[i], this.py[i], this.pz[i]);
      _dummy.rotation.set(this.life[i] * 5, this.life[i] * 7, 0);
      _dummy.scale.set(s, s, s);
      _dummy.updateMatrix();
      this.mesh.setMatrixAt(i, _dummy.matrix);
    }
    if (anyActive) {
      this.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  public dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}

/**
 * Builds a small 0.28 cube with exact atlas UVs for a dropped block/item.
 */
function buildDroppedCubeGeometry(itemId: ItemId): THREE.BoxGeometry {
  const geo = new THREE.BoxGeometry(0.28, 0.28, 0.28);
  const uvAttr = geo.getAttribute('uv') as THREE.BufferAttribute;
  const tileStep = 1 / TILES_PER_ROW;
  const pad = 0.002;

  let topUv: [number, number] = [1, 0];
  let sideUv: [number, number] = [1, 0];
  let frontUv: [number, number] = [1, 0];
  let botUv: [number, number] = [1, 0];

  if (typeof itemId === 'number' && BLOCKS[itemId]) {
    topUv = BLOCKS[itemId].uvs.top;
    sideUv = BLOCKS[itemId].uvs.side;
    frontUv = BLOCKS[itemId].uvs.front ?? sideUv;
    botUv = BLOCKS[itemId].uvs.bottom;
  } else if (itemId === 'coal') {
    topUv = sideUv = frontUv = botUv = [15, 0];
  } else if (itemId === 'iron_ingot') {
    topUv = sideUv = frontUv = botUv = [0, 1];
  } else if (itemId === 'gold_ingot') {
    topUv = sideUv = frontUv = botUv = [5, 1];
  } else if (itemId === 'diamond') {
    topUv = sideUv = frontUv = botUv = [6, 1];
  } else if (itemId === 'stick') {
    topUv = sideUv = frontUv = botUv = [10, 0];
  }

  // Three.js BoxGeometry face order: +X, -X, +Y, -Y, +Z (front), -Z
  const faceTiles: Array<[number, number]> = [
    sideUv,
    sideUv,
    topUv,
    botUv,
    frontUv,
    sideUv,
  ];

  for (let f = 0; f < 6; f++) {
    const [tx, ty] = faceTiles[f];
    const u0 = tx * tileStep + pad;
    const u1 = (tx + 1) * tileStep - pad;
    const v0 = 1 - (ty + 1) * tileStep + pad;
    const v1 = 1 - ty * tileStep - pad;
    const base = f * 4;
    uvAttr.setXY(base, u0, v1);
    uvAttr.setXY(base + 1, u1, v1);
    uvAttr.setXY(base + 2, u0, v0);
    uvAttr.setXY(base + 3, u1, v0);
  }
  uvAttr.needsUpdate = true;
  return geo;
}

export class DroppedItem {
  public readonly mesh: THREE.Mesh;
  public x: number;
  public y: number;
  public z: number;
  public vx: number;
  public vy: number;
  public vz: number;
  public age = 0;
  public collected = false;
  private readonly bobPhase: number;

  constructor(
    public readonly itemId: ItemId,
    public readonly count: number,
    x: number,
    y: number,
    z: number,
    atlasMaterial: THREE.Material
  ) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.vx = (Math.random() - 0.5) * 2.2;
    this.vy = 3.2 + Math.random() * 1.4;
    this.vz = (Math.random() - 0.5) * 2.2;
    this.bobPhase = Math.random() * Math.PI * 2;

    const geo = buildDroppedCubeGeometry(itemId);
    const nonBlockTint =
      itemId === 'raw_porkchop' || itemId === 'raw_beef' || itemId === 'raw_chicken'
        ? 0xf09aa0
        : itemId === 'cooked_porkchop' || itemId === 'cooked_beef' || itemId === 'cooked_chicken'
        ? 0xb8723d
        : itemId === 'rotten_flesh'
        ? 0x7a5c3c
        : itemId === 'apple'
        ? 0xdb2828
        : itemId === 'golden_apple'
        ? 0xffd738
        : itemId === 'melon_slice'
        ? 0xe84848
        : itemId === 'cookie' || itemId === 'baked_potato'
        ? 0xc98a42
        : itemId === 'carrot'
        ? 0xf07c1e
        : itemId === 'iron_ingot' || itemId === 'bucket' || itemId === 'shears'
        ? 0xdce4ec
        : itemId === 'water_bucket'
        ? 0x3898ff
        : itemId === 'lava_bucket'
        ? 0xff621a
        : itemId === 'gold_ingot' || itemId === 'clock'
        ? 0xf5c836
        : itemId === 'compass'
        ? 0xb8c2cc
        : itemId === 'diamond'
        ? 0x4ae8f0
        : itemId === 'emerald'
        ? 0x22d16b
        : itemId === 'netherite_ingot' || itemId === 'netherite_scrap'
        ? 0x4a4347
        : itemId === 'copper_ingot'
        ? 0xd97b54
        : itemId === 'amethyst_shard'
        ? 0xb366f5
        : itemId === 'lapis_lazuli'
        ? 0x2654c7
        : itemId === 'redstone_dust'
        ? 0xd92626
        : itemId === 'bone' || itemId === 'bone_meal' || itemId === 'sugar' || itemId === 'paper' || itemId === 'feather' || itemId === 'string'
        ? 0xedece4
        : itemId === 'gunpowder'
        ? 0x5c6066
        : itemId === 'slime_ball'
        ? 0x74d158
        : itemId === 'ender_pearl'
        ? 0x1e8f7a
        : itemId === 'book' || itemId === 'leather'
        ? 0x9e6635
        : itemId === 'music_disc'
        ? 0x24262b
        : itemId === 'bow' || itemId === 'arrow'
        ? 0x8f6636
        : itemId === 'bread'
        ? 0xc98b3e
        : itemId === 'wheat'
        ? 0xe6c449
        : itemId === 'flint'
        ? 0x434852
        : itemId === 'flint_and_steel'
        ? 0xcbd4de
        : itemId === 'nether_quartz'
        ? 0xefeae0
        : itemId === 'glowstone_dust'
        ? 0xffcf48
        : itemId === 'blaze_rod'
        ? 0xffb319
        : itemId === 'blaze_powder'
        ? 0xff7b1c
        : itemId === 'gold_nugget'
        ? 0xf7cf3d
        : itemId === 'ghast_tear'
        ? 0xd6f1f7
        : typeof itemId === 'string' && itemId.startsWith('netherite_')
        ? 0x4a4347
        : typeof itemId === 'string' && itemId.startsWith('diamond_')
        ? 0x4ae8f0
        : typeof itemId === 'string' && itemId.startsWith('gold_')
        ? 0xf5c836
        : typeof itemId === 'string' && itemId.startsWith('iron_')
        ? 0xcbd4de
        : typeof itemId === 'string' && itemId.startsWith('leather_')
        ? 0x9e6635
        : typeof itemId === 'string' && itemId.endsWith('_dye')
        ? 0xe879f9
        : null;

    const mat = nonBlockTint
      ? new THREE.MeshLambertMaterial({ color: nonBlockTint })
      : atlasMaterial;
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.set(x, y, z);
  }

  public update(dt: number, getBlock: BlockGetter): void {
    this.age += dt;
    this.vy += GRAVITY * 0.7 * dt;
    const res = moveAABBWithCollisions(this, this, 0.28, 0.28, 0.28, dt, getBlock);
    if (res.onGround) {
      this.vx *= Math.exp(-8 * dt);
      this.vz *= Math.exp(-8 * dt);
    }

    const bob = Math.sin(this.age * 3.6 + this.bobPhase) * 0.08;
    this.mesh.position.set(this.x, this.y + 0.2 + bob, this.z);
    this.mesh.rotation.y += dt * 2.2;
  }

  public dispose(sharedAtlasMaterial: THREE.Material): void {
    this.mesh.geometry.dispose();
    if (this.mesh.material !== sharedAtlasMaterial) {
      (this.mesh.material as THREE.Material).dispose();
    }
  }
}

/**
 * ArrowEntity: elongated projectile shot by Skeletons (or future bows).
 * Moves under -14.0 m/s² gravity, aligns along 3D velocity vector, sticks in solid blocks for 10s,
 * and deals 3 damage + knockback on hit.
 */
export class ArrowEntity {
  public readonly group = new THREE.Group();
  public x: number;
  public y: number;
  public z: number;
  public vx: number;
  public vy: number;
  public vz: number;
  public readonly owner: 'mob' | 'player';
  public readonly damage: number;
  public stuck = false;
  public stuckTimer = 0;
  public age = 0;
  public dead = false;
  private readonly materials: THREE.Material[] = [];

  constructor(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    owner: 'mob' | 'player' = 'mob',
    damage = 3
  ) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.vx = vx;
    this.vy = vy;
    this.vz = vz;
    this.owner = owner;
    this.damage = damage;

    const shaftMat = new THREE.MeshLambertMaterial({ color: 0x8a6136 });
    const tipMat = new THREE.MeshLambertMaterial({ color: 0xc5cdd4 });
    const fletchMat = new THREE.MeshLambertMaterial({ color: owner === 'player' ? 0xffe484 : 0xf4f6f8 });
    this.materials.push(shaftMat, tipMat, fletchMat);

    // Oriented along +Z by default, then lookAt rotates it along velocity
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.055, 0.72), shaftMat);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.14), tipMat);
    tip.position.z = 0.38;
    const fletchH = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.025, 0.16), fletchMat);
    fletchH.position.z = -0.3;
    const fletchV = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.18, 0.16), fletchMat);
    fletchV.position.z = -0.3;

    this.group.add(shaft, tip, fletchH, fletchV);
    this.group.position.set(x, y, z);
    this.orientAlongVelocity();
  }

  private orientAlongVelocity(): void {
    const speed = Math.hypot(this.vx, this.vy, this.vz);
    if (speed > 0.05) {
      _arrowDir.set(this.x + this.vx, this.y + this.vy, this.z + this.vz);
      this.group.lookAt(_arrowDir);
    }
  }

  public update(
    dt: number,
    playerX: number,
    playerY: number,
    playerZ: number,
    mobs: Mob[],
    getBlock: BlockGetter,
    onHitPlayer: (dmg: number, dirX: number, dirZ: number) => void,
    onHitMob: (mob: Mob, dmg: number, dirX: number, dirZ: number) => void,
    onStickBlock: () => void
  ): boolean {
    this.age += dt;
    if (this.dead) return true;

    if (this.stuck) {
      this.stuckTimer += dt;
      return this.stuckTimer >= 10.0;
    }

    // Gravity -14.0 m/s²
    this.vy -= 14.0 * dt;

    // Sub-step to avoid tunneling through blocks or entities
    const steps = 2;
    const stepDt = dt / steps;
    for (let s = 0; s < steps; s++) {
      const nx = this.x + this.vx * stepDt;
      const ny = this.y + this.vy * stepDt;
      const nz = this.z + this.vz * stepDt;

      // Solid block collision
      if (isBlockSolid(getBlock(Math.floor(nx), Math.floor(ny), Math.floor(nz)))) {
        this.stuck = true;
        this.vx = this.vy = this.vz = 0;
        onStickBlock();
        return false;
      }

      this.x = nx;
      this.y = ny;
      this.z = nz;

      // Player AABB hit check (mob arrows only)
      if (
        this.owner === 'mob' &&
        Math.abs(this.x - playerX) < 0.42 &&
        Math.abs(this.z - playerZ) < 0.42 &&
        this.y >= playerY &&
        this.y <= playerY + 1.8
      ) {
        const hLen = Math.hypot(this.vx, this.vz) || 1;
        onHitPlayer(this.damage, this.vx / hLen, this.vz / hLen);
        this.dead = true;
        return true;
      }

      // Mob hit check (player arrows hit immediately; mob arrows skip shooter grace window)
      if (this.owner === 'player' || this.age > 0.14) {
        for (const mob of mobs) {
          if (mob.dead) continue;
          if (
            Math.abs(this.x - mob.x) < mob.width * 0.65 &&
            Math.abs(this.z - mob.z) < mob.width * 0.65 &&
            this.y >= mob.y &&
            this.y <= mob.y + mob.height
          ) {
            const hLen = Math.hypot(this.vx, this.vz) || 1;
            onHitMob(mob, this.damage, this.vx / hLen, this.vz / hLen);
            this.dead = true;
            return true;
          }
        }
      }
    }

    this.group.position.set(this.x, this.y, this.z);
    this.orientAlongVelocity();
    return this.age > 15;
  }

  public dispose(): void {
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
    for (const m of this.materials) m.dispose();
  }
}

/**
 * PrimedTntEntity: lit TNT block that hops, obeys gravity, flashes white/red for its fuse duration,
 * swells slightly right before detonation, and triggers an explosion.
 */
export class PrimedTntEntity {
  public readonly mesh: THREE.Mesh;
  public x: number;
  public y: number;
  public z: number;
  public vx: number;
  public vy: number;
  public vz: number;
  public fuse: number;
  private readonly maxFuse: number;
  private readonly flashMaterial: THREE.MeshBasicMaterial;
  private readonly baseMaterial: THREE.Material;

  constructor(x: number, y: number, z: number, atlasMaterial: THREE.Material, fuse = 3.0) {
    this.x = x;
    this.y = y;
    this.z = z;
    const angle = Math.random() * Math.PI * 2;
    this.vx = Math.cos(angle) * 1.1;
    this.vy = 4.2;
    this.vz = Math.sin(angle) * 1.1;
    this.fuse = fuse;
    this.maxFuse = fuse;
    this.baseMaterial = atlasMaterial;
    this.flashMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

    const geo = buildDroppedCubeGeometry(BLOCK_IDS.TNT);
    geo.scale(3.45, 3.45, 3.45); // ~0.966 block cube
    this.mesh = new THREE.Mesh(geo, atlasMaterial);
    this.mesh.position.set(x, y + 0.5, z);
  }

  public update(dt: number, getBlock: BlockGetter): boolean {
    this.fuse -= dt;
    this.vy += GRAVITY * dt;
    const res = moveAABBWithCollisions(this, this, 0.9, 0.9, 0.9, dt, getBlock);
    if (res.onGround) {
      this.vx *= Math.exp(-10 * dt);
      this.vz *= Math.exp(-10 * dt);
    }

    // Accelerating white flash as fuse approaches 0
    const elapsed = this.maxFuse - this.fuse;
    const freq = this.fuse < 0.8 ? 16 : 6;
    const isFlash = Math.floor(elapsed * freq) % 2 === 0;
    this.mesh.material = isFlash ? this.flashMaterial : this.baseMaterial;

    // Swell dramatically in the final 0.35s before detonation
    const swell = this.fuse < 0.35 ? 1 + (0.35 - this.fuse) * 0.85 : 1;
    this.mesh.scale.set(swell, swell, swell);
    this.mesh.position.set(this.x, this.y + 0.5, this.z);
    return this.fuse <= 0;
  }

  public dispose(): void {
    this.mesh.geometry.dispose();
    this.flashMaterial.dispose();
  }
}

export class FireballProjectile {
  public readonly group = new THREE.Group();
  public x: number;
  public y: number;
  public z: number;
  public vx: number;
  public vy: number;
  public vz: number;
  public readonly kind: 'ghast' | 'blaze';
  public deflected = false;
  public age = 0;
  public dead = false;
  private readonly materials: THREE.Material[] = [];

  constructor(
    kind: 'ghast' | 'blaze',
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number
  ) {
    this.kind = kind;
    this.x = x;
    this.y = y;
    this.z = z;
    this.vx = vx;
    this.vy = vy;
    this.vz = vz;

    const size = kind === 'ghast' ? 0.64 : 0.34;
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xfff08a });
    const shellMat = new THREE.MeshBasicMaterial({
      color: kind === 'ghast' ? 0xff5a1f : 0xff8c1a,
      transparent: true,
      opacity: 0.72,
    });
    this.materials.push(coreMat, shellMat);

    const core = new THREE.Mesh(new THREE.BoxGeometry(size * 0.65, size * 0.65, size * 0.65), coreMat);
    const shell = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), shellMat);
    this.group.add(core, shell);
    this.group.position.set(x, y, z);
  }

  public update(
    dt: number,
    playerX: number,
    playerY: number,
    playerZ: number,
    mobs: Mob[],
    getBlock: BlockGetter,
    onHitPlayer: (kind: 'ghast' | 'blaze', wx: number, wy: number, wz: number, dirX: number, dirZ: number) => void,
    onHitBlock: (kind: 'ghast' | 'blaze', wx: number, wy: number, wz: number) => void,
    onDeflectedHitMob: (mob: Mob, wx: number, wy: number, wz: number, dirX: number, dirZ: number) => void,
    onTrail: (wx: number, wy: number, wz: number, col: string) => void
  ): boolean {
    this.age += dt;
    if (this.dead) return true;

    const steps = 2;
    const stepDt = dt / steps;
    for (let s = 0; s < steps; s++) {
      const nx = this.x + this.vx * stepDt;
      const ny = this.y + this.vy * stepDt;
      const nz = this.z + this.vz * stepDt;

      if (isBlockSolid(getBlock(Math.floor(nx), Math.floor(ny), Math.floor(nz)))) {
        onHitBlock(this.kind, nx, ny, nz);
        this.dead = true;
        return true;
      }

      this.x = nx;
      this.y = ny;
      this.z = nz;

      const hLen = Math.hypot(this.vx, this.vz) || 1;
      // Player hit check (skip if deflected by player)
      if (!this.deflected) {
        const hitR = this.kind === 'ghast' ? 0.62 : 0.45;
        if (
          Math.abs(this.x - playerX) < hitR &&
          Math.abs(this.z - playerZ) < hitR &&
          this.y >= playerY - 0.1 &&
          this.y <= playerY + 1.85
        ) {
          onHitPlayer(this.kind, this.x, this.y, this.z, this.vx / hLen, this.vz / hLen);
          this.dead = true;
          return true;
        }
      } else {
        // Deflected fireball can strike Ghasts (insta-kill!) or any Nether mob
        for (const mob of mobs) {
          if (mob.dead) continue;
          const r = mob.width * 0.65 + 0.45;
          if (
            Math.abs(this.x - mob.x) < r &&
            Math.abs(this.z - mob.z) < r &&
            this.y >= mob.y - 0.2 &&
            this.y <= mob.y + mob.height + 0.3
          ) {
            onDeflectedHitMob(mob, this.x, this.y, this.z, this.vx / hLen, this.vz / hLen);
            this.dead = true;
            return true;
          }
        }
      }
    }

    if (Math.random() < dt * 22) {
      onTrail(this.x - 0.5, this.y - 0.5, this.z - 0.5, this.deflected ? '#ffee55' : '#ff6b1a');
    }

    this.group.position.set(this.x, this.y, this.z);
    this.group.rotation.x += dt * 7;
    this.group.rotation.y += dt * 9;
    return this.age > 8.5;
  }

  public dispose(): void {
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
    for (const m of this.materials) m.dispose();
  }
}

export abstract class Mob {
  public readonly group = new THREE.Group();
  public x: number;
  public y: number;
  public z: number;
  public vx = 0;
  public vy = 0;
  public vz = 0;
  public yaw = 0;
  public onGround = false;
  public hp: number;
  public readonly maxHp: number;
  public hurtTimer = 0;
  public burnTickTimer = 0;
  public dead = false;
  public deathTimer = 0;
  public walkPhase = 0;

  protected readonly materials: THREE.MeshLambertMaterial[] = [];
  protected readonly originalColors: THREE.Color[] = [];
  protected readonly legs: THREE.Object3D[] = [];
  protected headGroup: THREE.Object3D | null = null;
  protected burnsInSunlight = false;
  protected flying = false;
  public fireImmune = false;

  constructor(
    public readonly kind: MobKind,
    public readonly width: number,
    public readonly height: number,
    maxHp: number,
    x: number,
    y: number,
    z: number
  ) {
    this.maxHp = maxHp;
    this.hp = maxHp;
    this.x = x;
    this.y = y;
    this.z = z;
    this.group.position.set(x, y, z);
  }

  protected registerMat(mat: THREE.MeshLambertMaterial): THREE.MeshLambertMaterial {
    this.materials.push(mat);
    this.originalColors.push(mat.color.clone());
    return mat;
  }

  public takeDamage(amount: number, knockX: number, knockZ: number): boolean {
    if (this.dead) return false;
    this.hp -= amount;
    this.hurtTimer = 0.28;
    const len = Math.hypot(knockX, knockZ);
    if (len > 0.001) {
      this.vx = (knockX / len) * 6.5;
      this.vz = (knockZ / len) * 6.5;
      this.vy = 4.4;
    }
    this.onMobDamaged(knockX, knockZ);
    if (this.hp <= 0) {
      this.dead = true;
      this.deathTimer = 0.42;
      return true;
    }
    return false;
  }

  protected abstract onMobDamaged(knockX: number, knockZ: number): void;
  public abstract getDrops(): MobDrop[];
  public abstract updateAI(ctx: MobUpdateContext): void;

  /**
   * Returns true if moving toward (dirX, dirZ) leads to a drop > maxSafeDrop blocks.
   */
  protected hasTallCliffAhead(
    dirX: number,
    dirZ: number,
    getBlock: BlockGetter,
    maxSafeDrop = 2
  ): boolean {
    const checkX = Math.floor(this.x + dirX * 1.15);
    const checkZ = Math.floor(this.z + dirZ * 1.15);
    const footY = Math.floor(this.y);
    for (let dy = 0; dy <= maxSafeDrop; dy++) {
      if (isBlockSolid(getBlock(checkX, footY - 1 - dy, checkZ))) {
        return false;
      }
    }
    return true;
  }

  public tick(ctx: MobUpdateContext): boolean {
    const { dt, getBlock } = ctx;
    if (this.dead) {
      this.deathTimer -= dt;
      this.group.rotation.z = THREE.MathUtils.lerp(
        this.group.rotation.z,
        Math.PI * 0.48,
        1 - Math.exp(-12 * dt)
      );
      this.setHurtTint(true);
      return this.deathTimer <= 0;
    }

    // Undead sunlight burning (Zombies & Skeletons burn in daytime when exposed to direct skyLight >= 12)
    if (this.burnsInSunlight && ctx.isDay) {
      const bx = Math.floor(this.x);
      const by = Math.floor(this.y + this.height * 0.85);
      const bz = Math.floor(this.z);
      const inWater = getBlock(bx, Math.floor(this.y + 0.3), bz) === BLOCK_IDS.WATER;
      if (!inWater && ctx.getSkyLight(bx, by, bz) >= 12) {
        this.burnTickTimer += dt;
        if (Math.random() < dt * 7) {
          ctx.onEmitParticles(this.x - 0.5, this.y + this.height * 0.5, this.z - 0.5, '#ff7b1c', 2);
        }
        if (this.burnTickTimer >= 1.0) {
          this.burnTickTimer = 0;
          this.takeDamage(2, 0, 0);
        }
      }
    }

    if (this.hurtTimer > 0) {
      this.hurtTimer -= dt;
      this.setHurtTint(this.hurtTimer > 0);
    }

    this.updateAI(ctx);

    if (this.flying) {
      // Flying / levitating mobs (Ghast, Blaze) glide without gravity while avoiding solid blocks
      const nextX = this.x + this.vx * dt;
      const nextY = this.y + this.vy * dt;
      const nextZ = this.z + this.vz * dt;
      if (!isBlockSolid(getBlock(Math.floor(nextX), Math.floor(this.y + this.height * 0.5), Math.floor(this.z)))) {
        this.x = nextX;
      } else {
        this.vx *= -0.5;
      }
      if (!isBlockSolid(getBlock(Math.floor(this.x), Math.floor(nextY + (this.vy > 0 ? this.height : 0)), Math.floor(this.z)))) {
        this.y = Math.max(6, Math.min(118, nextY));
      } else {
        this.vy *= -0.4;
      }
      if (!isBlockSolid(getBlock(Math.floor(this.x), Math.floor(this.y + this.height * 0.5), Math.floor(nextZ)))) {
        this.z = nextZ;
      } else {
        this.vz *= -0.5;
      }
      this.group.position.set(this.x, this.y, this.z);
      this.group.rotation.y = this.yaw;
      return false;
    }

    // Gravity & AABB movement
    this.vy += GRAVITY * dt;
    if (this.vy < -35) this.vy = -35;
    const res = moveAABBWithCollisions(this, this, this.width, this.height, this.width, dt, getBlock);
    this.onGround = res.onGround;

    // Auto-jump over 1-block obstacles when blocked horizontally
    if ((res.hitX || res.hitZ) && this.onGround) {
      const aheadX = Math.floor(this.x + Math.sin(this.yaw) * (this.width * 0.65 + 0.35));
      const aheadZ = Math.floor(this.z + Math.cos(this.yaw) * (this.width * 0.65 + 0.35));
      const footY = Math.floor(this.y);
      if (
        isBlockSolid(getBlock(aheadX, footY, aheadZ)) &&
        !isBlockSolid(getBlock(aheadX, footY + 1, aheadZ))
      ) {
        this.vy = 7.6;
        this.onGround = false;
      }
    }

    const hSpeed = Math.hypot(this.vx, this.vz);
    if (hSpeed > 0.25) {
      this.walkPhase += dt * hSpeed * 3.8;
    }
    const swing = hSpeed > 0.25 ? Math.sin(this.walkPhase) * 0.55 : 0;
    for (let i = 0; i < this.legs.length; i++) {
      this.legs[i].rotation.x = i % 2 === 0 ? swing : -swing;
    }

    this.group.position.set(this.x, this.y, this.z);
    this.group.rotation.y = this.yaw;
    return false;
  }

  private setHurtTint(flash: boolean): void {
    for (let i = 0; i < this.materials.length; i++) {
      if (flash) {
        this.materials[i].color.setHex(0xff5252);
      } else {
        this.materials[i].color.copy(this.originalColors[i]);
      }
    }
  }

  public dispose(): void {
    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
      }
    });
    for (const m of this.materials) {
      if (m.map) m.map.dispose();
      m.dispose();
    }
  }
}

/**
 * Passive Pig Mob: composite 7-part procedural model, wanders randomly, flees when hit.
 */
export class PigMob extends Mob {
  private wanderTimer = 1.5;
  private targetDirX = 0;
  private targetDirZ = 0;
  private panicTimer = 0;

  constructor(x: number, y: number, z: number) {
    super('pig', 0.85, 0.9, 10, x, y, z);

    const pinkBody = this.registerMat(new THREE.MeshLambertMaterial({ color: 0xf2a2a8 }));
    const pinkDark = this.registerMat(new THREE.MeshLambertMaterial({ color: 0xd9848b }));
    const faceMat = this.registerMat(
      new THREE.MeshLambertMaterial({ color: 0xffffff, map: createMobFaceTexture('pig') })
    );

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.48, 0.95), pinkBody);
    body.position.set(0, 0.54, 0);
    this.group.add(body);

    const head = new THREE.Group();
    head.position.set(0, 0.68, 0.58);
    const headMats = [pinkBody, pinkBody, pinkBody, pinkBody, faceMat, pinkBody];
    const headCube = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.44, 0.44), headMats);
    head.add(headCube);

    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 0.12), pinkDark);
    snout.position.set(0, -0.07, 0.24);
    head.add(snout);

    this.group.add(head);
    this.headGroup = head;

    const legGeo = new THREE.BoxGeometry(0.18, 0.34, 0.18);
    legGeo.translate(0, -0.17, 0);
    const legOffsets: Array<[number, number]> = [
      [-0.2, 0.32],
      [0.2, 0.32],
      [0.2, -0.32],
      [-0.2, -0.32],
    ];
    for (const [lx, lz] of legOffsets) {
      const leg = new THREE.Mesh(legGeo, pinkDark);
      leg.position.set(lx, 0.34, lz);
      this.group.add(leg);
      this.legs.push(leg);
    }
  }

  protected onMobDamaged(knockX: number, knockZ: number): void {
    this.panicTimer = 4.0;
    const len = Math.hypot(knockX, knockZ) || 1;
    this.targetDirX = knockX / len;
    this.targetDirZ = knockZ / len;
  }

  public getDrops(): MobDrop[] {
    const drops: MobDrop[] = [{ itemId: 'raw_porkchop', count: Math.random() < 0.45 ? 2 : 1 }];
    if (Math.random() < 0.5) drops.push({ itemId: 'leather', count: 1 });
    return drops;
  }

  public updateAI(ctx: MobUpdateContext): void {
    const { dt } = ctx;
    if (this.panicTimer > 0) {
      this.panicTimer -= dt;
      const speed = 3.9;
      this.vx = THREE.MathUtils.lerp(this.vx, this.targetDirX * speed, 1 - Math.exp(-8 * dt));
      this.vz = THREE.MathUtils.lerp(this.vz, this.targetDirZ * speed, 1 - Math.exp(-8 * dt));
      this.yaw = Math.atan2(this.targetDirX, this.targetDirZ);
      return;
    }

    this.wanderTimer -= dt;
    if (this.wanderTimer <= 0) {
      this.wanderTimer = 2.0 + Math.random() * 3.5;
      if (Math.random() < 0.35) {
        this.targetDirX = 0;
        this.targetDirZ = 0;
      } else {
        const a = Math.random() * Math.PI * 2;
        this.targetDirX = Math.sin(a);
        this.targetDirZ = Math.cos(a);
      }
    }

    const speed = 1.45;
    this.vx = THREE.MathUtils.lerp(this.vx, this.targetDirX * speed, 1 - Math.exp(-6 * dt));
    this.vz = THREE.MathUtils.lerp(this.vz, this.targetDirZ * speed, 1 - Math.exp(-6 * dt));
    if (Math.hypot(this.targetDirX, this.targetDirZ) > 0.1) {
      this.yaw = Math.atan2(this.targetDirX, this.targetDirZ);
    }
  }
}

/**
 * Passive Sheep Mob: spawns in Plains with woolly white body, pale gray head, and 4 legs.
 * Avoids tall cliffs (>2 blocks drop), flees when hit, and drops 1–2 White Wool + 1 raw food.
 */
export class SheepMob extends Mob {
  private wanderTimer = 2.0;
  private targetDirX = 0;
  private targetDirZ = 0;
  private panicTimer = 0;
  public sheared = false;
  private readonly bodyMesh: THREE.Mesh;
  private readonly fleeceCapMesh: THREE.Mesh;
  private readonly woolMat: THREE.MeshLambertMaterial;

  constructor(x: number, y: number, z: number) {
    super('sheep', 0.9, 1.25, 10, x, y, z);

    this.woolMat = this.registerMat(new THREE.MeshLambertMaterial({ color: 0xf1f3f5 }));
    const woolShade = this.registerMat(new THREE.MeshLambertMaterial({ color: 0xdce0e6 }));
    const headSkin = this.registerMat(new THREE.MeshLambertMaterial({ color: 0xd4c2b4 }));
    const legMat = this.registerMat(new THREE.MeshLambertMaterial({ color: 0xbba89a }));
    const faceMat = this.registerMat(
      new THREE.MeshLambertMaterial({ color: 0xffffff, map: createMobFaceTexture('sheep') })
    );

    // Woolly blocky body
    this.bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.62, 1.05), this.woolMat);
    this.bodyMesh.position.set(0, 0.72, 0);
    this.group.add(this.bodyMesh);

    // Extra fluffy dorsal ridge
    this.fleeceCapMesh = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.96), woolShade);
    this.fleeceCapMesh.position.set(0, 1.04, 0);
    this.group.add(this.fleeceCapMesh);

    // Head with woolly crown
    const head = new THREE.Group();
    head.position.set(0, 0.96, 0.62);
    const headMats = [headSkin, headSkin, this.woolMat, headSkin, faceMat, this.woolMat];
    const headCube = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.46), headMats);
    head.add(headCube);
    this.group.add(head);
    this.headGroup = head;

    // 4 Legs (woolly upper + beige lower hooves)
    const legGeo = new THREE.BoxGeometry(0.2, 0.48, 0.2);
    legGeo.translate(0, -0.24, 0);
    const legOffsets: Array<[number, number]> = [
      [-0.24, 0.34],
      [0.24, 0.34],
      [0.24, -0.34],
      [-0.24, -0.34],
    ];
    for (const [lx, lz] of legOffsets) {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(lx, 0.48, lz);
      this.group.add(leg);
      this.legs.push(leg);
    }
  }

  public shear(): boolean {
    if (this.sheared || this.dead) return false;
    this.sheared = true;
    this.fleeceCapMesh.visible = false;
    this.bodyMesh.scale.set(0.84, 0.84, 0.92);
    this.woolMat.color.setHex(0xd4c2b4);
    const idx = this.materials.indexOf(this.woolMat);
    if (idx >= 0) this.originalColors[idx].setHex(0xd4c2b4);
    return true;
  }

  protected onMobDamaged(knockX: number, knockZ: number): void {
    this.panicTimer = 4.2;
    const len = Math.hypot(knockX, knockZ) || 1;
    this.targetDirX = knockX / len;
    this.targetDirZ = knockZ / len;
  }

  public getDrops(): MobDrop[] {
    const drops: MobDrop[] = [{ itemId: 'raw_beef', count: 1 }];
    if (!this.sheared) {
      drops.unshift({ itemId: BLOCK_IDS.WHITE_WOOL, count: Math.random() < 0.5 ? 2 : 1 });
    }
    return drops;
  }

  public updateAI(ctx: MobUpdateContext): void {
    const { dt, getBlock } = ctx;
    if (this.panicTimer > 0) {
      this.panicTimer -= dt;
      if (this.hasTallCliffAhead(this.targetDirX, this.targetDirZ, getBlock, 2)) {
        // Turn away from cliff even when panicking
        const tx = this.targetDirX;
        this.targetDirX = -this.targetDirZ;
        this.targetDirZ = tx;
      }
      const speed = 3.6;
      this.vx = THREE.MathUtils.lerp(this.vx, this.targetDirX * speed, 1 - Math.exp(-8 * dt));
      this.vz = THREE.MathUtils.lerp(this.vz, this.targetDirZ * speed, 1 - Math.exp(-8 * dt));
      this.yaw = Math.atan2(this.targetDirX, this.targetDirZ);
      return;
    }

    this.wanderTimer -= dt;
    if (this.wanderTimer <= 0) {
      this.wanderTimer = 2.2 + Math.random() * 3.8;
      if (Math.random() < 0.4) {
        this.targetDirX = 0;
        this.targetDirZ = 0;
      } else {
        const a = Math.random() * Math.PI * 2;
        this.targetDirX = Math.sin(a);
        this.targetDirZ = Math.cos(a);
      }
    }

    // Avoid walking off cliffs > 2 blocks high
    if (
      Math.hypot(this.targetDirX, this.targetDirZ) > 0.1 &&
      this.hasTallCliffAhead(this.targetDirX, this.targetDirZ, getBlock, 2)
    ) {
      this.targetDirX = -this.targetDirX;
      this.targetDirZ = -this.targetDirZ;
      this.wanderTimer = 1.5;
    }

    const speed = 1.3;
    this.vx = THREE.MathUtils.lerp(this.vx, this.targetDirX * speed, 1 - Math.exp(-6 * dt));
    this.vz = THREE.MathUtils.lerp(this.vz, this.targetDirZ * speed, 1 - Math.exp(-6 * dt));
    if (Math.hypot(this.targetDirX, this.targetDirZ) > 0.1) {
      this.yaw = Math.atan2(this.targetDirX, this.targetDirZ);
    }
  }
}

/**
 * Hostile Zombie Mob: spawns at night/dark caves, chases player within 16 blocks,
 * deals 2 damage every 1.2s, and burns in direct daytime sunlight (skyLight >= 12).
 */
export class ZombieMob extends Mob {
  private attackCooldown = 0;
  private windupTimer = 0;
  private wanderAngle = Math.random() * Math.PI * 2;
  private wanderTimer = 2.0;
  private readonly arms: THREE.Object3D[] = [];

  constructor(x: number, y: number, z: number) {
    super('zombie', 0.65, 1.85, 20, x, y, z);
    this.burnsInSunlight = true;

    const skinMat = this.registerMat(new THREE.MeshLambertMaterial({ color: 0x5c8a47 }));
    const shirtMat = this.registerMat(new THREE.MeshLambertMaterial({ color: 0x2c8991 }));
    const pantsMat = this.registerMat(new THREE.MeshLambertMaterial({ color: 0x3b4880 }));
    const faceMat = this.registerMat(
      new THREE.MeshLambertMaterial({ color: 0xffffff, map: createMobFaceTexture('zombie') })
    );

    const legGeo = new THREE.BoxGeometry(0.22, 0.72, 0.22);
    legGeo.translate(0, -0.36, 0);
    for (const lx of [-0.13, 0.13]) {
      const leg = new THREE.Mesh(legGeo, pantsMat);
      leg.position.set(lx, 0.72, 0);
      this.group.add(leg);
      this.legs.push(leg);
    }

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.26), shirtMat);
    torso.position.set(0, 1.07, 0);
    this.group.add(torso);

    const headMats = [skinMat, skinMat, skinMat, skinMat, faceMat, skinMat];
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.46, 0.46), headMats);
    head.position.set(0, 1.65, 0);
    this.group.add(head);
    this.headGroup = head;

    const armGeo = new THREE.BoxGeometry(0.2, 0.65, 0.2);
    armGeo.translate(0, -0.25, 0);
    for (const ax of [-0.36, 0.36]) {
      const arm = new THREE.Mesh(armGeo, skinMat);
      arm.position.set(ax, 1.32, 0);
      arm.rotation.x = -Math.PI * 0.45;
      this.group.add(arm);
      this.arms.push(arm);
    }
  }

  protected onMobDamaged(): void {
    this.windupTimer = 0;
  }

  public getDrops(): MobDrop[] {
    const drops: MobDrop[] = [{ itemId: 'rotten_flesh', count: Math.random() < 0.5 ? 2 : 1 }];
    if (Math.random() < 0.12) drops.push({ itemId: 'iron_ingot', count: 1 });
    return drops;
  }

  public updateAI(ctx: MobUpdateContext): void {
    const { dt, playerX, playerY, playerZ, onDamagePlayer } = ctx;
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const dz = playerZ - this.z;
    const dist = Math.hypot(dx, dy, dz);

    if (dist < 16.0) {
      const hDist = Math.hypot(dx, dz) || 1;
      const nx = dx / hDist;
      const nz = dz / hDist;
      this.yaw = Math.atan2(nx, nz);

      const speed = 2.65;
      if (dist > 1.35) {
        this.vx = THREE.MathUtils.lerp(this.vx, nx * speed, 1 - Math.exp(-7 * dt));
        this.vz = THREE.MathUtils.lerp(this.vz, nz * speed, 1 - Math.exp(-7 * dt));
      } else {
        this.vx *= Math.exp(-8 * dt);
        this.vz *= Math.exp(-8 * dt);
      }

      if (dist <= 1.85 && this.attackCooldown <= 0) {
        this.windupTimer += dt;
        const windupProgress = Math.min(1, this.windupTimer / 0.25);
        for (const arm of this.arms) {
          arm.rotation.x = -Math.PI * (0.45 + 0.35 * windupProgress);
        }
        if (this.windupTimer >= 0.25) {
          onDamagePlayer(2, 'mob', nx, nz);
          this.attackCooldown = 1.2;
          this.windupTimer = 0;
        }
      } else {
        this.windupTimer = 0;
        for (const arm of this.arms) {
          arm.rotation.x = THREE.MathUtils.lerp(
            arm.rotation.x,
            -Math.PI * 0.45,
            1 - Math.exp(-10 * dt)
          );
        }
      }
    } else {
      this.windupTimer = 0;
      this.wanderTimer -= dt;
      if (this.wanderTimer <= 0) {
        this.wanderTimer = 2.5 + Math.random() * 3.0;
        this.wanderAngle = Math.random() * Math.PI * 2;
      }
      this.vx = THREE.MathUtils.lerp(this.vx, Math.sin(this.wanderAngle) * 1.1, 1 - Math.exp(-5 * dt));
      this.vz = THREE.MathUtils.lerp(this.vz, Math.cos(this.wanderAngle) * 1.1, 1 - Math.exp(-5 * dt));
      this.yaw = this.wanderAngle;
    }
  }
}

/**
 * Hostile Skeleton Mob: slender bony 3D model holding a wooden bow in its right hand.
 * Spawns at night/dark caves, burns in daytime sunlight (skyLight >= 12), detects player at 18 blocks,
 * maintains 10–12 block combat distance with line-of-sight, and fires Arrows every 2.2s.
 */
export class SkeletonMob extends Mob {
  private shootCooldown = 1.4;
  private wanderAngle = Math.random() * Math.PI * 2;
  private wanderTimer = 2.0;
  private strafeSign = Math.random() < 0.5 ? 1 : -1;
  private readonly rightArm: THREE.Group;

  constructor(x: number, y: number, z: number) {
    super('skeleton', 0.62, 1.9, 18, x, y, z);
    this.burnsInSunlight = true;

    const boneMat = this.registerMat(new THREE.MeshLambertMaterial({ color: 0xdcded8 }));
    const boneDark = this.registerMat(new THREE.MeshLambertMaterial({ color: 0xb6b9b2 }));
    const bowWood = this.registerMat(new THREE.MeshLambertMaterial({ color: 0x7c5329 }));
    const bowString = this.registerMat(new THREE.MeshLambertMaterial({ color: 0xe6e6e6 }));
    const faceMat = this.registerMat(
      new THREE.MeshLambertMaterial({ color: 0xffffff, map: createMobFaceTexture('skeleton') })
    );

    // Slender bony legs
    const legGeo = new THREE.BoxGeometry(0.11, 0.74, 0.11);
    legGeo.translate(0, -0.37, 0);
    for (const lx of [-0.14, 0.14]) {
      const leg = new THREE.Mesh(legGeo, boneMat);
      leg.position.set(lx, 0.74, 0);
      this.group.add(leg);
      this.legs.push(leg);
    }

    // Spine & ribcage
    const spine = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.7, 0.12), boneDark);
    spine.position.set(0, 1.09, 0);
    this.group.add(spine);
    for (let r = 0; r < 3; r++) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, 0.2), boneMat);
      rib.position.set(0, 0.94 + r * 0.17, 0);
      this.group.add(rib);
    }

    // Skull
    const headMats = [boneMat, boneMat, boneMat, boneMat, faceMat, boneMat];
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.44, 0.44), headMats);
    head.position.set(0, 1.66, 0);
    this.group.add(head);
    this.headGroup = head;

    // Left slender arm
    const armGeo = new THREE.BoxGeometry(0.1, 0.64, 0.1);
    armGeo.translate(0, -0.26, 0);
    const leftArm = new THREE.Mesh(armGeo, boneMat);
    leftArm.position.set(-0.3, 1.34, 0);
    leftArm.rotation.x = -Math.PI * 0.35;
    this.group.add(leftArm);

    // Right arm holding procedural Bow
    this.rightArm = new THREE.Group();
    this.rightArm.position.set(0.3, 1.34, 0);
    const rArmMesh = new THREE.Mesh(armGeo, boneMat);
    this.rightArm.add(rArmMesh);

    const bowGroup = new THREE.Group();
    bowGroup.position.set(0, -0.5, 0.14);
    const bowCenter = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.32, 0.06), bowWood);
    const bowUpper = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.26, 0.055), bowWood);
    bowUpper.position.set(0, 0.24, -0.08);
    bowUpper.rotation.x = -0.45;
    const bowLower = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.26, 0.055), bowWood);
    bowLower.position.set(0, -0.24, -0.08);
    bowLower.rotation.x = 0.45;
    const stringMesh = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.68, 0.02), bowString);
    stringMesh.position.set(0, 0, -0.14);
    bowGroup.add(bowCenter, bowUpper, bowLower, stringMesh);
    this.rightArm.add(bowGroup);

    this.rightArm.rotation.x = -Math.PI * 0.48;
    this.group.add(this.rightArm);
  }

  protected onMobDamaged(): void {
    this.strafeSign = -this.strafeSign;
  }

  public getDrops(): MobDrop[] {
    return [
      { itemId: 'bone', count: Math.random() < 0.5 ? 2 : 1 },
      { itemId: 'arrow', count: Math.random() < 0.5 ? 2 : 1 },
    ];
  }

  public updateAI(ctx: MobUpdateContext): void {
    const { dt, playerX, playerY, playerZ, getBlock, onShootArrow } = ctx;
    this.shootCooldown = Math.max(0, this.shootCooldown - dt);

    const dx = playerX - this.x;
    const dy = (playerY + 1.1) - (this.y + 1.5);
    const dz = playerZ - this.z;
    const hDist = Math.hypot(dx, dz);
    const dist = Math.hypot(dx, dy, dz);

    if (dist < 18.0) {
      const nx = dx / (hDist || 1);
      const nz = dz / (hDist || 1);
      this.yaw = Math.atan2(nx, nz);

      // Line of sight check using voxel DDA
      const losRay = raycastVoxel(
        this.x,
        this.y + 1.55,
        this.z,
        dx / (dist || 1),
        dy / (dist || 1),
        dz / (dist || 1),
        getBlock,
        Math.min(18, dist - 0.5)
      );
      const hasLOS = !losRay || !isBlockSolid(losRay.blockId);

      // Maintain 10-12 block distance while strafing slightly
      let desiredVx = 0;
      let desiredVz = 0;
      if (hDist > 12.0 || !hasLOS) {
        desiredVx = nx * 2.5;
        desiredVz = nz * 2.5;
      } else if (hDist < 9.5) {
        desiredVx = -nx * 1.9 + -nz * this.strafeSign * 1.2;
        desiredVz = -nz * 1.9 + nx * this.strafeSign * 1.2;
      } else {
        desiredVx = -nz * this.strafeSign * 1.3;
        desiredVz = nx * this.strafeSign * 1.3;
      }

      this.vx = THREE.MathUtils.lerp(this.vx, desiredVx, 1 - Math.exp(-6 * dt));
      this.vz = THREE.MathUtils.lerp(this.vz, desiredVz, 1 - Math.exp(-6 * dt));

      // Draw bow arm and fire arrow every 2.2s when LOS is clear
      const aimLift = this.shootCooldown < 0.45 ? -Math.PI * 0.55 : -Math.PI * 0.46;
      this.rightArm.rotation.x = THREE.MathUtils.lerp(this.rightArm.rotation.x, aimLift, 1 - Math.exp(-10 * dt));

      if (hasLOS && this.shootCooldown <= 0) {
        this.shootCooldown = 2.2;
        const speed = 19.5;
        const flightTime = dist / speed;
        // Slight ballistic arc compensation for -14.0 m/s² gravity
        const aimY = dy + 0.5 * 14.0 * flightTime * flightTime * 0.85;
        const norm = Math.hypot(dx, aimY, dz) || 1;
        onShootArrow(
          this.x + nx * 0.55,
          this.y + 1.48,
          this.z + nz * 0.55,
          (dx / norm) * speed,
          (aimY / norm) * speed,
          (dz / norm) * speed
        );
      }
    } else {
      this.wanderTimer -= dt;
      if (this.wanderTimer <= 0) {
        this.wanderTimer = 2.5 + Math.random() * 3.0;
        this.wanderAngle = Math.random() * Math.PI * 2;
      }
      this.vx = THREE.MathUtils.lerp(this.vx, Math.sin(this.wanderAngle) * 1.1, 1 - Math.exp(-5 * dt));
      this.vz = THREE.MathUtils.lerp(this.vz, Math.cos(this.wanderAngle) * 1.1, 1 - Math.exp(-5 * dt));
      this.yaw = this.wanderAngle;
    }
  }
}

/**
 * Friendly Villager NPC: spawns in Villages with distinct profession robes
 * (Farmer brown, Blacksmith charcoal apron, Librarian ivory/crimson), tall head + nose,
 * crossed arms, wanders village paths by day, shelters near home at night, and trades with emeralds.
 */
export class VillagerMob extends Mob {
  public readonly villagerId: string;
  public readonly profession: VillagerProfession;
  private readonly homeX: number;
  private readonly homeZ: number;
  private wanderTimer = 2.0;
  private targetDirX = 0;
  private targetDirZ = 0;

  constructor(
    villagerId: string,
    x: number,
    y: number,
    z: number,
    homeX: number,
    homeZ: number,
    profession: VillagerProfession
  ) {
    super('villager', 0.65, 1.9, 20, x, y, z);
    this.villagerId = villagerId;
    this.profession = profession;
    this.homeX = homeX;
    this.homeZ = homeZ;

    const robeColor =
      profession === 'farmer'
        ? 0x7c532e
        : profession === 'blacksmith'
        ? 0x45494f
        : 0xe6e1d3;
    const trimColor =
      profession === 'farmer'
        ? 0xb58d43
        : profession === 'blacksmith'
        ? 0x26282b
        : 0x9e2a2b;

    const skinMat = this.registerMat(new THREE.MeshLambertMaterial({ color: 0xc9936d }));
    const robeMat = this.registerMat(new THREE.MeshLambertMaterial({ color: robeColor }));
    const trimMat = this.registerMat(new THREE.MeshLambertMaterial({ color: trimColor }));
    const faceMat = this.registerMat(
      new THREE.MeshLambertMaterial({ color: 0xffffff, map: createMobFaceTexture('villager') })
    );

    // Legs
    const legGeo = new THREE.BoxGeometry(0.22, 0.68, 0.22);
    legGeo.translate(0, -0.34, 0);
    for (const lx of [-0.13, 0.13]) {
      const leg = new THREE.Mesh(legGeo, trimMat);
      leg.position.set(lx, 0.68, 0);
      this.group.add(leg);
      this.legs.push(leg);
    }

    // Long profession robe torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.84, 0.34), robeMat);
    torso.position.set(0, 1.02, 0);
    this.group.add(torso);

    // Belt / apron trim
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.16, 0.36), trimMat);
    belt.position.set(0, 0.86, 0);
    this.group.add(belt);

    // Crossed villager arms in front
    const arms = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.24, 0.24), robeMat);
    arms.position.set(0, 1.18, 0.18);
    arms.rotation.x = -0.35;
    this.group.add(arms);

    // Tall villager head + iconic protruding nose
    const head = new THREE.Group();
    head.position.set(0, 1.66, 0);
    const headMats = [skinMat, skinMat, skinMat, skinMat, faceMat, skinMat];
    const headCube = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.56, 0.46), headMats);
    head.add(headCube);

    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, 0.14), skinMat);
    nose.position.set(0, -0.09, 0.28);
    head.add(nose);

    if (profession === 'farmer') {
      // Straw hat brim
      const hat = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.08, 0.68), trimMat);
      hat.position.set(0, 0.26, 0);
      head.add(hat);
    } else if (profession === 'librarian') {
      // Red scholar cap
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.5), trimMat);
      cap.position.set(0, 0.26, 0);
      head.add(cap);
    }

    this.group.add(head);
    this.headGroup = head;
  }

  protected onMobDamaged(knockX: number, knockZ: number): void {
    const len = Math.hypot(knockX, knockZ) || 1;
    this.targetDirX = knockX / len;
    this.targetDirZ = knockZ / len;
    this.wanderTimer = 1.5;
  }

  public getDrops(): MobDrop[] {
    return [{ itemId: 'emerald', count: 1 }];
  }

  public updateAI(ctx: MobUpdateContext): void {
    const { dt, playerX, playerZ, isDay, getBlock } = ctx;
    const dxHome = this.homeX - this.x;
    const dzHome = this.homeZ - this.z;
    const homeDist = Math.hypot(dxHome, dzHome);
    const dxP = playerX - this.x;
    const dzP = playerZ - this.z;
    const playerDist = Math.hypot(dxP, dzP);

    // At night, return toward home house
    if (!isDay && homeDist > 2.4) {
      this.targetDirX = dxHome / homeDist;
      this.targetDirZ = dzHome / homeDist;
      const speed = 1.85;
      this.vx = THREE.MathUtils.lerp(this.vx, this.targetDirX * speed, 1 - Math.exp(-6 * dt));
      this.vz = THREE.MathUtils.lerp(this.vz, this.targetDirZ * speed, 1 - Math.exp(-6 * dt));
      this.yaw = Math.atan2(this.targetDirX, this.targetDirZ);
      return;
    }

    // Look curiously toward player when nearby
    if (playerDist < 4.2) {
      this.vx *= Math.exp(-8 * dt);
      this.vz *= Math.exp(-8 * dt);
      this.yaw = Math.atan2(dxP, dzP);
      return;
    }

    this.wanderTimer -= dt;
    if (this.wanderTimer <= 0) {
      this.wanderTimer = 2.4 + Math.random() * 3.5;
      if (homeDist > 16) {
        this.targetDirX = dxHome / homeDist;
        this.targetDirZ = dzHome / homeDist;
      } else if (Math.random() < 0.45) {
        this.targetDirX = 0;
        this.targetDirZ = 0;
      } else {
        const a = Math.random() * Math.PI * 2;
        this.targetDirX = Math.sin(a);
        this.targetDirZ = Math.cos(a);
      }
    }

    if (
      Math.hypot(this.targetDirX, this.targetDirZ) > 0.1 &&
      this.hasTallCliffAhead(this.targetDirX, this.targetDirZ, getBlock, 2)
    ) {
      this.targetDirX = -this.targetDirX;
      this.targetDirZ = -this.targetDirZ;
    }

    const speed = 1.25;
    this.vx = THREE.MathUtils.lerp(this.vx, this.targetDirX * speed, 1 - Math.exp(-6 * dt));
    this.vz = THREE.MathUtils.lerp(this.vz, this.targetDirZ * speed, 1 - Math.exp(-6 * dt));
    if (Math.hypot(this.targetDirX, this.targetDirZ) > 0.1) {
      this.yaw = Math.atan2(this.targetDirX, this.targetDirZ);
    }
  }
}

/**
 * Neutral Nether Mob: Zombie Piglin (Zombified Piglin).
 * Spawns in packs of 2–3, immune to fire/lava, carries a golden sword.
 * Peaceful until provoked — hitting one angers the whole pack within 16 blocks!
 */
export class ZombiePiglinMob extends Mob {
  public angerTimer = 0;
  private attackCooldown = 0;
  private wanderTimer = 2.5;
  private wanderAngle = Math.random() * Math.PI * 2;
  private readonly rightArm: THREE.Group;

  constructor(x: number, y: number, z: number) {
    super('zombie_piglin', 0.65, 1.9, 20, x, y, z);
    this.fireImmune = true;

    const skinMat = this.registerMat(new THREE.MeshLambertMaterial({ color: 0xe69ca2 }));
    const rotMat = this.registerMat(new THREE.MeshLambertMaterial({ color: 0x5c7d41 }));
    const clothMat = this.registerMat(new THREE.MeshLambertMaterial({ color: 0x6b4528 }));
    const goldMat = this.registerMat(new THREE.MeshLambertMaterial({ color: 0xf7cf3d }));
    const hiltMat = this.registerMat(new THREE.MeshLambertMaterial({ color: 0x6e4720 }));
    const faceMat = this.registerMat(
      new THREE.MeshLambertMaterial({ color: 0xffffff, map: createMobFaceTexture('zombie_piglin') })
    );

    const legGeo = new THREE.BoxGeometry(0.22, 0.72, 0.22);
    legGeo.translate(0, -0.36, 0);
    for (const lx of [-0.13, 0.13]) {
      const leg = new THREE.Mesh(legGeo, clothMat);
      leg.position.set(lx, 0.72, 0);
      this.group.add(leg);
      this.legs.push(leg);
    }

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.26), skinMat);
    torso.position.set(0, 1.07, 0);
    this.group.add(torso);
    const ribPatch = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.34, 0.28), rotMat);
    ribPatch.position.set(0.11, 1.12, 0);
    this.group.add(ribPatch);
    const loincloth = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.24, 0.28), clothMat);
    loincloth.position.set(0, 0.8, 0);
    this.group.add(loincloth);

    const headMats = [rotMat, skinMat, skinMat, skinMat, faceMat, rotMat];
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.46, 0.46), headMats);
    head.position.set(0, 1.65, 0);
    this.group.add(head);
    this.headGroup = head;

    // Left arm
    const armGeo = new THREE.BoxGeometry(0.2, 0.65, 0.2);
    armGeo.translate(0, -0.25, 0);
    const leftArm = new THREE.Mesh(armGeo, skinMat);
    leftArm.position.set(-0.36, 1.32, 0);
    leftArm.rotation.x = -0.35;
    this.group.add(leftArm);

    // Right arm holding Golden Sword
    this.rightArm = new THREE.Group();
    this.rightArm.position.set(0.36, 1.32, 0);
    this.rightArm.add(new THREE.Mesh(armGeo, rotMat));
    const swordHilt = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.06), hiltMat);
    swordHilt.position.set(0, -0.52, 0.16);
    swordHilt.rotation.x = Math.PI * 0.42;
    const swordGuard = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.06), goldMat);
    swordGuard.position.set(0, -0.5, 0.26);
    const swordBlade = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.52, 0.03), goldMat);
    swordBlade.position.set(0, -0.44, 0.52);
    swordBlade.rotation.x = Math.PI * 0.42;
    this.rightArm.add(swordHilt, swordGuard, swordBlade);
    this.rightArm.rotation.x = -0.45;
    this.group.add(this.rightArm);
  }

  public provoke(duration = 25): void {
    this.angerTimer = Math.max(this.angerTimer, duration);
  }

  protected onMobDamaged(): void {
    this.provoke(28);
  }

  public getDrops(): MobDrop[] {
    return [
      { itemId: 'gold_nugget', count: Math.random() < 0.5 ? 2 : 1 },
      { itemId: 'rotten_flesh', count: 1 },
    ];
  }

  public updateAI(ctx: MobUpdateContext): void {
    const { dt, playerX, playerY, playerZ, onDamagePlayer } = ctx;
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    if (this.angerTimer > 0) this.angerTimer = Math.max(0, this.angerTimer - dt);

    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const dz = playerZ - this.z;
    const dist = Math.hypot(dx, dy, dz);

    if (this.angerTimer > 0 && dist < 24) {
      const hDist = Math.hypot(dx, dz) || 1;
      const nx = dx / hDist;
      const nz = dz / hDist;
      this.yaw = Math.atan2(nx, nz);
      const speed = 3.35;
      if (dist > 1.35) {
        this.vx = THREE.MathUtils.lerp(this.vx, nx * speed, 1 - Math.exp(-8 * dt));
        this.vz = THREE.MathUtils.lerp(this.vz, nz * speed, 1 - Math.exp(-8 * dt));
      } else {
        this.vx *= Math.exp(-8 * dt);
        this.vz *= Math.exp(-8 * dt);
      }
      this.rightArm.rotation.x = -Math.PI * 0.42 - Math.sin(this.walkPhase * 1.4) * 0.35;
      if (dist <= 1.95 && this.attackCooldown <= 0) {
        onDamagePlayer(4, 'mob', nx, nz);
        this.attackCooldown = 1.0;
      }
    } else {
      this.rightArm.rotation.x = THREE.MathUtils.lerp(this.rightArm.rotation.x, -0.35, 1 - Math.exp(-6 * dt));
      this.wanderTimer -= dt;
      if (this.wanderTimer <= 0) {
        this.wanderTimer = 2.4 + Math.random() * 3.2;
        this.wanderAngle = Math.random() * Math.PI * 2;
      }
      const speed = 1.15;
      this.vx = THREE.MathUtils.lerp(this.vx, Math.sin(this.wanderAngle) * speed, 1 - Math.exp(-5 * dt));
      this.vz = THREE.MathUtils.lerp(this.vz, Math.cos(this.wanderAngle) * speed, 1 - Math.exp(-5 * dt));
      this.yaw = this.wanderAngle;
    }
  }
}

/**
 * Hostile Flying Nether Mob: Ghast.
 * Iconic 3.2x3.2x3.2 ghostly white cube with 9 animated tentacles underneath.
 * Detects player up to 32 blocks, screams and fires explosive deflectable Fireballs every 3.5s.
 */
export class GhastMob extends Mob {
  private readonly tentacles: THREE.Mesh[] = [];
  private animTime = Math.random() * Math.PI * 2;
  private shootTimer = 2.6;
  private driftAngle = Math.random() * Math.PI * 2;
  private driftTimer = 3.0;
  private targetY: number;

  constructor(x: number, y: number, z: number) {
    super('ghast', 3.2, 3.2, 10, x, y, z);
    this.flying = true;
    this.fireImmune = true;
    this.targetY = y;

    const bodyMat = this.registerMat(new THREE.MeshLambertMaterial({ color: 0xf4f5f7 }));
    const tentacleMat = this.registerMat(new THREE.MeshLambertMaterial({ color: 0xdce1e8 }));
    const faceMat = this.registerMat(
      new THREE.MeshLambertMaterial({ color: 0xffffff, map: createMobFaceTexture('ghast') })
    );

    const bodyMats = [bodyMat, bodyMat, bodyMat, bodyMat, faceMat, bodyMat];
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3.2, 3.2), bodyMats);
    body.position.set(0, 1.6, 0);
    this.group.add(body);

    // 9 hanging animated tentacles in a 3x3 grid beneath the cube
    for (let tz = -1; tz <= 1; tz++) {
      for (let tx = -1; tx <= 1; tx++) {
        const len = 1.45 + ((tx + tz + 4) % 3) * 0.45;
        const geo = new THREE.BoxGeometry(0.32, len, 0.32);
        geo.translate(0, -len * 0.5, 0);
        const tentacle = new THREE.Mesh(geo, tentacleMat);
        tentacle.position.set(tx * 0.95, 0.05, tz * 0.95);
        this.group.add(tentacle);
        this.tentacles.push(tentacle);
      }
    }
  }

  protected onMobDamaged(): void {
    this.driftAngle += Math.PI * 0.6;
  }

  public getDrops(): MobDrop[] {
    return [
      { itemId: 'ghast_tear', count: Math.random() < 0.45 ? 2 : 1 },
      { itemId: 'gunpowder', count: Math.random() < 0.5 ? 2 : 1 },
    ];
  }

  public updateAI(ctx: MobUpdateContext): void {
    const { dt, playerX, playerY, playerZ, onShootFireball, onGhastScream } = ctx;
    this.animTime += dt * 3.1;
    for (let i = 0; i < this.tentacles.length; i++) {
      this.tentacles[i].rotation.x = Math.sin(this.animTime + i * 0.7) * 0.28;
      this.tentacles[i].rotation.z = Math.cos(this.animTime * 0.8 + i * 0.5) * 0.16;
    }

    this.driftTimer -= dt;
    if (this.driftTimer <= 0) {
      this.driftTimer = 3.0 + Math.random() * 3.0;
      this.driftAngle = Math.random() * Math.PI * 2;
      this.targetY = Math.max(44, Math.min(84, playerY + 7 + (Math.random() - 0.5) * 10));
    }

    const dx = playerX - this.x;
    const dy = (playerY + 1.1) - (this.y + 1.2);
    const dz = playerZ - this.z;
    const dist = Math.hypot(dx, dy, dz);

    if (dist < 32) {
      const hDist = Math.hypot(dx, dz) || 1;
      this.yaw = Math.atan2(dx / hDist, dz / hDist);
      // Float slowly around mid-range altitude
      const desiredVx = Math.sin(this.driftAngle) * 1.4;
      const desiredVz = Math.cos(this.driftAngle) * 1.4;
      const desiredVy = THREE.MathUtils.clamp((this.targetY - this.y) * 0.45, -1.6, 1.6);
      this.vx = THREE.MathUtils.lerp(this.vx, desiredVx, 1 - Math.exp(-3 * dt));
      this.vy = THREE.MathUtils.lerp(this.vy, desiredVy, 1 - Math.exp(-3 * dt));
      this.vz = THREE.MathUtils.lerp(this.vz, desiredVz, 1 - Math.exp(-3 * dt));

      this.shootTimer -= dt;
      if (this.shootTimer <= 0) {
        this.shootTimer = 3.5;
        onGhastScream();
        const speed = 13.5;
        const norm = dist || 1;
        const fx = this.x + (dx / norm) * 2.1;
        const fy = this.y + 1.1;
        const fz = this.z + (dz / norm) * 2.1;
        onShootFireball('ghast', fx, fy, fz, (dx / norm) * speed, (dy / norm) * speed, (dz / norm) * speed);
      }
    } else {
      this.vx = THREE.MathUtils.lerp(this.vx, Math.sin(this.driftAngle) * 1.6, 1 - Math.exp(-2 * dt));
      this.vz = THREE.MathUtils.lerp(this.vz, Math.cos(this.driftAngle) * 1.6, 1 - Math.exp(-2 * dt));
      this.vy = THREE.MathUtils.lerp(this.vy, Math.sin(this.animTime * 0.4) * 0.6, 1 - Math.exp(-2 * dt));
      this.yaw = this.driftAngle;
    }
  }
}

/**
 * Hostile Nether Fortress Mob: Blaze.
 * Golden glowing head surrounded by 8 orbiting golden rods & smoke particles.
 * Levitates and fires 3-shot burning fireball bursts every 3.2s; drops Blaze Rods.
 */
export class BlazeMob extends Mob {
  public readonly blazeId?: string;
  private readonly homeX: number;
  private readonly homeZ: number;
  private readonly upperRing = new THREE.Group();
  private readonly lowerRing = new THREE.Group();
  private animTime = Math.random() * Math.PI * 2;
  private burstCooldown = 2.2;
  private shotsRemaining = 0;
  private shotDelay = 0;
  private hoverY: number;

  constructor(x: number, y: number, z: number, homeX = x, homeZ = z, blazeId?: string) {
    super('blaze', 0.85, 1.85, 20, x, y, z);
    this.flying = true;
    this.fireImmune = true;
    this.homeX = homeX;
    this.homeZ = homeZ;
    this.blazeId = blazeId;
    this.hoverY = y;

    const headMat = this.registerMat(new THREE.MeshLambertMaterial({ color: 0xf7b928 }));
    const rodMat = this.registerMat(new THREE.MeshLambertMaterial({ color: 0xffd23f }));
    const coreMat = this.registerMat(new THREE.MeshLambertMaterial({ color: 0x3b2a1e }));
    const faceMat = this.registerMat(
      new THREE.MeshLambertMaterial({ color: 0xffffff, map: createMobFaceTexture('blaze') })
    );

    const headMats = [headMat, headMat, headMat, headMat, faceMat, headMat];
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.54, 0.54), headMats);
    head.position.set(0, 1.48, 0);
    this.group.add(head);
    this.headGroup = head;

    const smokeCore = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.72, 0.28), coreMat);
    smokeCore.position.set(0, 0.85, 0);
    this.group.add(smokeCore);

    // 2 orbiting rings of 4 golden blaze rods
    const rodGeo = new THREE.BoxGeometry(0.11, 0.62, 0.11);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const uRod = new THREE.Mesh(rodGeo, rodMat);
      uRod.position.set(Math.cos(a) * 0.58, 1.12, Math.sin(a) * 0.58);
      this.upperRing.add(uRod);

      const lRod = new THREE.Mesh(rodGeo, rodMat);
      lRod.position.set(Math.cos(a + 0.78) * 0.42, 0.58, Math.sin(a + 0.78) * 0.42);
      this.lowerRing.add(lRod);
    }
    this.group.add(this.upperRing, this.lowerRing);
  }

  protected onMobDamaged(): void {
    this.hoverY = Math.min(110, this.y + 1.2);
  }

  public getDrops(): MobDrop[] {
    return [{ itemId: 'blaze_rod', count: Math.random() < 0.45 ? 2 : 1 }];
  }

  public updateAI(ctx: MobUpdateContext): void {
    const { dt, playerX, playerY, playerZ, onShootFireball, onEmitParticles } = ctx;
    this.animTime += dt;
    this.upperRing.rotation.y = this.animTime * 2.8;
    this.lowerRing.rotation.y = -this.animTime * 3.6;

    if (Math.random() < dt * 8) {
      onEmitParticles(this.x - 0.5, this.y + 0.9, this.z - 0.5, '#ff881c', 1);
    }

    const dx = playerX - this.x;
    const dy = (playerY + 1.1) - (this.y + 1.35);
    const dz = playerZ - this.z;
    const hDist = Math.hypot(dx, dz) || 1;
    const dist = Math.hypot(dx, dy, dz);

    if (dist < 22) {
      this.yaw = Math.atan2(dx / hDist, dz / hDist);
      const targetHover = Math.max(this.hoverY, playerY + 1.8);
      const desiredVy = THREE.MathUtils.clamp((targetHover - this.y) * 1.1 + Math.sin(this.animTime * 2.5) * 0.45, -2.0, 2.0);
      let desiredVx = 0;
      let desiredVz = 0;
      if (hDist > 11) {
        desiredVx = (dx / hDist) * 2.3;
        desiredVz = (dz / hDist) * 2.3;
      } else if (hDist < 6) {
        desiredVx = -(dx / hDist) * 1.6;
        desiredVz = -(dz / hDist) * 1.6;
      }
      this.vx = THREE.MathUtils.lerp(this.vx, desiredVx, 1 - Math.exp(-5 * dt));
      this.vy = THREE.MathUtils.lerp(this.vy, desiredVy, 1 - Math.exp(-5 * dt));
      this.vz = THREE.MathUtils.lerp(this.vz, desiredVz, 1 - Math.exp(-5 * dt));

      if (this.shotsRemaining > 0) {
        this.shotDelay -= dt;
        if (this.shotDelay <= 0) {
          this.shotsRemaining--;
          this.shotDelay = 0.28;
          const speed = 15.5;
          const norm = dist || 1;
          onShootFireball(
            'blaze',
            this.x + (dx / hDist) * 0.75,
            this.y + 1.35,
            this.z + (dz / hDist) * 0.75,
            (dx / norm) * speed,
            (dy / norm) * speed,
            (dz / norm) * speed
          );
        }
      } else {
        this.burstCooldown -= dt;
        if (this.burstCooldown <= 0) {
          this.shotsRemaining = 3;
          this.shotDelay = 0;
          this.burstCooldown = 3.2;
        }
      }
    } else {
      // Hover peacefully near home platform
      const hx = this.homeX - this.x;
      const hz = this.homeZ - this.z;
      const hd = Math.hypot(hx, hz);
      const vxT = hd > 6 ? (hx / hd) * 1.6 : Math.cos(this.animTime * 0.7) * 0.8;
      const vzT = hd > 6 ? (hz / hd) * 1.6 : Math.sin(this.animTime * 0.7) * 0.8;
      this.vx = THREE.MathUtils.lerp(this.vx, vxT, 1 - Math.exp(-3 * dt));
      this.vz = THREE.MathUtils.lerp(this.vz, vzT, 1 - Math.exp(-3 * dt));
      this.vy = Math.sin(this.animTime * 2.2) * 0.45;
      this.yaw += dt * 0.4;
    }
  }
}

/**
 * Articulated 3D Voxel Player Avatar rendered when F5 Third-Person camera is active.
 * Animates head look, legs/arms walk cycle, crouch posture, swing, and reflects equipped armor colors.
 */
export class PlayerAvatar {
  public readonly group = new THREE.Group();
  private readonly headGroup = new THREE.Group();
  private readonly bodyGroup = new THREE.Group();
  private readonly leftArm: THREE.Mesh;
  private readonly rightArm: THREE.Mesh;
  private readonly leftLeg: THREE.Mesh;
  private readonly rightLeg: THREE.Mesh;
  private readonly helmetMesh: THREE.Mesh;
  private readonly chestMesh: THREE.Mesh;
  private readonly leftLegArmor: THREE.Mesh;
  private readonly rightLegArmor: THREE.Mesh;
  private readonly leftBootArmor: THREE.Mesh;
  private readonly rightBootArmor: THREE.Mesh;
  private readonly materials: THREE.Material[] = [];
  private walkPhase = 0;
  private swingTimer = 0;

  constructor() {
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xd9a47c });
    const hairMat = new THREE.MeshLambertMaterial({ color: 0x4a301c });
    const shirtMat = new THREE.MeshLambertMaterial({ color: 0x2a95ad });
    const pantsMat = new THREE.MeshLambertMaterial({ color: 0x3b4899 });
    const shoeMat = new THREE.MeshLambertMaterial({ color: 0x4b4b4f });
    const faceMat = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      map: createMobFaceTexture('player'),
    });

    const helmMat = new THREE.MeshLambertMaterial({ color: 0xc0c8d0 });
    const chestMat = new THREE.MeshLambertMaterial({ color: 0xc0c8d0 });
    const legArmorMat = new THREE.MeshLambertMaterial({ color: 0xc0c8d0 });
    const bootArmorMat = new THREE.MeshLambertMaterial({ color: 0xc0c8d0 });

    this.materials.push(
      skinMat,
      hairMat,
      shirtMat,
      pantsMat,
      shoeMat,
      faceMat,
      helmMat,
      chestMat,
      legArmorMat,
      bootArmorMat
    );

    // Legs (pivoted at hip y = 0.72)
    const legGeo = new THREE.BoxGeometry(0.22, 0.72, 0.22);
    legGeo.translate(0, -0.36, 0);
    this.leftLeg = new THREE.Mesh(legGeo, pantsMat);
    this.leftLeg.position.set(-0.125, 0.72, 0);
    this.rightLeg = new THREE.Mesh(legGeo, pantsMat);
    this.rightLeg.position.set(0.125, 0.72, 0);

    // Leggings + Boots overlays
    const legOverlayGeo = new THREE.BoxGeometry(0.25, 0.48, 0.25);
    legOverlayGeo.translate(0, -0.24, 0);
    this.leftLegArmor = new THREE.Mesh(legOverlayGeo, legArmorMat);
    this.rightLegArmor = new THREE.Mesh(legOverlayGeo, legArmorMat);
    this.leftLeg.add(this.leftLegArmor);
    this.rightLeg.add(this.rightLegArmor);

    const bootGeo = new THREE.BoxGeometry(0.26, 0.22, 0.26);
    bootGeo.translate(0, -0.62, 0);
    this.leftBootArmor = new THREE.Mesh(bootGeo, bootArmorMat);
    this.rightBootArmor = new THREE.Mesh(bootGeo, bootArmorMat);
    this.leftLeg.add(this.leftBootArmor);
    this.rightLeg.add(this.rightBootArmor);

    // Upper body group (for slight crouch lean)
    this.bodyGroup.position.set(0, 0.72, 0);
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.68, 0.24), shirtMat);
    torso.position.set(0, 0.34, 0);
    this.bodyGroup.add(torso);

    this.chestMesh = new THREE.Mesh(new THREE.BoxGeometry(0.53, 0.71, 0.29), chestMat);
    this.chestMesh.position.set(0, 0.34, 0);
    this.bodyGroup.add(this.chestMesh);

    // Arms (pivoted at shoulder)
    const armGeo = new THREE.BoxGeometry(0.2, 0.66, 0.2);
    armGeo.translate(0, -0.26, 0);
    this.leftArm = new THREE.Mesh(armGeo, skinMat);
    this.leftArm.position.set(-0.35, 0.62, 0);
    this.rightArm = new THREE.Mesh(armGeo, skinMat);
    this.rightArm.position.set(0.35, 0.62, 0);
    this.bodyGroup.add(this.leftArm, this.rightArm);

    // Head (faces -Z so yaw aligns with player forward)
    this.headGroup.position.set(0, 0.68, 0);
    const headMats = [hairMat, hairMat, hairMat, skinMat, hairMat, faceMat];
    const headCube = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), headMats);
    headCube.position.set(0, 0.23, 0);
    this.headGroup.add(headCube);

    this.helmetMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.34, 0.5), helmMat);
    this.helmetMesh.position.set(0, 0.3, 0);
    this.headGroup.add(this.helmetMesh);

    this.bodyGroup.add(this.headGroup);
    this.group.add(this.leftLeg, this.rightLeg, this.bodyGroup);
    this.group.visible = false;

    this.syncArmor([null, null, null, null]);
  }

  public triggerSwing(): void {
    this.swingTimer = 0.25;
  }

  public syncArmor(armor: ArmorSlots): void {
    const tierHex = (id: ItemId | undefined): number | null => {
      if (!id || typeof id !== 'string') return null;
      if (id.startsWith('netherite_')) return 0x443a3d;
      if (id.startsWith('diamond_')) return 0x3ce6ed;
      if (id.startsWith('gold_')) return 0xf5c836;
      if (id.startsWith('iron_')) return 0xd4dce3;
      if (id.startsWith('leather_')) return 0x9c6234;
      return null;
    };

    const hCol = tierHex(armor[0]?.id);
    this.helmetMesh.visible = hCol !== null;
    if (hCol !== null) (this.helmetMesh.material as THREE.MeshLambertMaterial).color.setHex(hCol);

    const cCol = tierHex(armor[1]?.id);
    this.chestMesh.visible = cCol !== null;
    if (cCol !== null) (this.chestMesh.material as THREE.MeshLambertMaterial).color.setHex(cCol);

    const lCol = tierHex(armor[2]?.id);
    this.leftLegArmor.visible = lCol !== null;
    this.rightLegArmor.visible = lCol !== null;
    if (lCol !== null) (this.leftLegArmor.material as THREE.MeshLambertMaterial).color.setHex(lCol);

    const bCol = tierHex(armor[3]?.id);
    this.leftBootArmor.visible = bCol !== null;
    this.rightBootArmor.visible = bCol !== null;
    if (bCol !== null) (this.leftBootArmor.material as THREE.MeshLambertMaterial).color.setHex(bCol);
  }

  public update(
    dt: number,
    x: number,
    y: number,
    z: number,
    yaw: number,
    pitch: number,
    movedDist: number,
    crouching: boolean
  ): void {
    this.group.position.set(x, y, z);
    this.group.rotation.y = yaw;
    this.headGroup.rotation.x = THREE.MathUtils.clamp(pitch, -1.1, 1.1);
    this.bodyGroup.rotation.x = crouching ? 0.28 : 0;
    this.bodyGroup.position.y = crouching ? 0.62 : 0.72;

    if (movedDist > 0.002) {
      this.walkPhase += movedDist * 3.8;
    }
    const swing = movedDist > 0.002 ? Math.sin(this.walkPhase) * 0.65 : 0;
    this.leftLeg.rotation.x = swing;
    this.rightLeg.rotation.x = -swing;
    this.leftArm.rotation.x = -swing * 0.85;

    if (this.swingTimer > 0) {
      this.swingTimer = Math.max(0, this.swingTimer - dt);
      const s = Math.sin((this.swingTimer / 0.25) * Math.PI);
      this.rightArm.rotation.x = -0.35 - s * 1.15;
    } else {
      this.rightArm.rotation.x = swing * 0.85;
    }
  }

  public dispose(): void {
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
    for (const m of this.materials) {
      if ('map' in m && (m as THREE.MeshLambertMaterial).map) {
        (m as THREE.MeshLambertMaterial).map!.dispose();
      }
      m.dispose();
    }
  }
}

/**
 * First-person held block/tool group attached to the camera's lower-right corner
 * with walking bob, mining/attack swing, and hold-to-eat chew animation.
 */
export class FirstPersonHand {
  public readonly root = new THREE.Group();
  private readonly holder = new THREE.Group();
  private currentItem: ItemId | null = null;
  private mesh: THREE.Object3D | null = null;
  private bobTime = 0;
  private swingProgress = 0;
  private swinging = false;

  constructor(private readonly atlasMaterial: THREE.Material) {
    this.root.position.set(0.42, -0.36, -0.62);
    this.root.add(this.holder);
    this.setHeldItem(null);
  }

  public triggerSwing(): void {
    this.swinging = true;
    this.swingProgress = 0;
  }

  public setHeldItem(itemId: ItemId | null): void {
    if (this.currentItem === itemId && this.mesh) return;
    this.currentItem = itemId;
    if (this.mesh) {
      this.holder.remove(this.mesh);
      this.mesh.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          if (o.material !== this.atlasMaterial) {
            (o.material as THREE.Material).dispose();
          }
        }
      });
      this.mesh = null;
    }

    if (itemId === null) {
      const armGroup = new THREE.Group();
      const skinMat = new THREE.MeshLambertMaterial({ color: 0xd9a780 });
      const cuffMat = new THREE.MeshLambertMaterial({ color: 0xc5906a });
      const sleeveMat = new THREE.MeshLambertMaterial({ color: 0x2bb5c9 });

      const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.34, 0.17), skinMat);
      forearm.position.set(0, 0.08, 0);

      const wristTrim = new THREE.Mesh(new THREE.BoxGeometry(0.174, 0.03, 0.174), cuffMat);
      wristTrim.position.set(0, -0.09, 0);

      const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.182, 0.22, 0.182), sleeveMat);
      sleeve.position.set(0, -0.21, 0);

      armGroup.add(forearm, wristTrim, sleeve);
      armGroup.rotation.set(-0.55, -0.32, 0.28);
      armGroup.position.set(0.03, -0.02, 0.04);
      this.mesh = armGroup;
    } else if (typeof itemId === 'number' && BLOCKS[itemId]) {
      if (itemId === BLOCK_IDS.TORCH || itemId === BLOCK_IDS.SOUL_TORCH) {
        const g = new THREE.Group();
        const stick = new THREE.Mesh(
          new THREE.BoxGeometry(0.06, 0.34, 0.06),
          new THREE.MeshLambertMaterial({ color: 0x8a6236 })
        );
        const tip = new THREE.Mesh(
          new THREE.BoxGeometry(0.075, 0.08, 0.075),
          new THREE.MeshBasicMaterial({
            color: itemId === BLOCK_IDS.SOUL_TORCH ? 0x38f2ff : 0xffd23f,
          })
        );
        tip.position.y = 0.18;
        g.add(stick, tip);
        g.rotation.set(-0.2, 0.2, 0.12);
        this.mesh = g;
      } else {
        const geo = buildDroppedCubeGeometry(itemId);
        geo.scale(1.15, 1.15, 1.15);
        const cube = new THREE.Mesh(geo, this.atlasMaterial);
        cube.rotation.set(0.18, -0.62, 0.08);
        this.mesh = cube;
      }
    } else {
      const def = getItemDef(itemId);
      const g = new THREE.Group();
      const tierColor =
        def?.toolTier === 'netherite'
          ? 0x4e464a
          : def?.toolTier === 'diamond'
          ? 0x45e8f0
          : def?.toolTier === 'gold'
          ? 0xf5c836
          : def?.toolTier === 'iron'
          ? 0xd6dee6
          : def?.toolTier === 'stone'
          ? 0x8f9499
          : 0xb08446;
      const tierDark =
        def?.toolTier === 'netherite'
          ? 0x2f292c
          : def?.toolTier === 'diamond'
          ? 0x1a94a6
          : def?.toolTier === 'gold'
          ? 0xb88212
          : def?.toolTier === 'iron'
          ? 0x9aa4ae
          : def?.toolTier === 'stone'
          ? 0x62666b
          : 0x855f31;

      const handleMat = new THREE.MeshLambertMaterial({ color: 0x734b24 });
      const headMat = new THREE.MeshLambertMaterial({ color: tierColor });
      const darkMat = new THREE.MeshLambertMaterial({ color: tierDark });

      if (def?.toolCategory === 'pickaxe') {
        const handle = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.44, 0.044), handleMat);
        handle.position.set(0, -0.02, 0);
        const center = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.065, 0.056), darkMat);
        center.position.set(0, 0.19, 0);
        const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.058, 0.048), headMat);
        leftArm.position.set(-0.11, 0.16, 0);
        leftArm.rotation.z = 0.35;
        const leftTip = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.046, 0.042), headMat);
        leftTip.position.set(-0.175, 0.115, 0);
        leftTip.rotation.z = 0.72;
        const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.058, 0.048), headMat);
        rightArm.position.set(0.11, 0.16, 0);
        rightArm.rotation.z = -0.35;
        const rightTip = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.046, 0.042), headMat);
        rightTip.position.set(0.175, 0.115, 0);
        rightTip.rotation.z = -0.72;
        g.add(handle, center, leftArm, leftTip, rightArm, rightTip);
      } else if (def?.toolCategory === 'axe') {
        const handle = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.45, 0.044), handleMat);
        const collar = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.08, 0.058), darkMat);
        collar.position.set(0, 0.17, 0);
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.044), headMat);
        blade.position.set(-0.085, 0.16, 0);
        const edge = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.19, 0.032), headMat);
        edge.position.set(-0.155, 0.145, 0);
        g.add(handle, collar, blade, edge);
      } else if (def?.toolCategory === 'shovel') {
        const handle = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.42, 0.044), handleMat);
        const neck = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.06, 0.05), darkMat);
        neck.position.set(0, 0.2, 0);
        const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.145, 0.036), headMat);
        scoop.position.set(0, 0.27, 0);
        g.add(handle, neck, scoop);
      } else if (def?.toolCategory === 'hoe') {
        const handle = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.44, 0.044), handleMat);
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.055, 0.044), headMat);
        head.position.set(-0.07, 0.2, 0);
        const prong = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.09, 0.04), darkMat);
        prong.position.set(-0.14, 0.155, 0);
        g.add(handle, head, prong);
      } else if (def?.toolCategory === 'sword') {
        const pommel = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.05, 0.06), darkMat);
        pommel.position.y = -0.21;
        const grip = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.14, 0.042), handleMat);
        grip.position.y = -0.13;
        const guard = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.048, 0.062), darkMat);
        guard.position.y = -0.045;
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.34, 0.028), headMat);
        blade.position.y = 0.14;
        const tip = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.06, 0.026), headMat);
        tip.position.y = 0.33;
        g.add(pommel, grip, guard, blade, tip);
      } else if (itemId === 'bow') {
        const stringMat = new THREE.MeshLambertMaterial({ color: 0xe6e6e6 });
        const center = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.22, 0.045), handleMat);
        const upper = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.04), handleMat);
        upper.position.set(0, 0.18, 0.06);
        upper.rotation.x = 0.45;
        const lower = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.04), handleMat);
        lower.position.set(0, -0.18, 0.06);
        lower.rotation.x = -0.45;
        const cord = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.54, 0.015), stringMat);
        cord.position.set(0, 0, 0.11);
        g.add(center, upper, lower, cord);
      } else {
        const col =
          itemId === 'coal'
            ? 0x26282e
            : itemId === 'iron_ingot' || itemId === 'bucket' || itemId === 'shears' || itemId === 'compass'
            ? 0xdce4ec
            : itemId === 'water_bucket'
            ? 0x3898ff
            : itemId === 'lava_bucket'
            ? 0xff621a
            : itemId === 'gold_ingot' || itemId === 'golden_apple' || itemId === 'clock'
            ? 0xf5c836
            : itemId === 'diamond'
            ? 0x4ae8f0
            : itemId === 'netherite_ingot' || itemId === 'netherite_scrap'
            ? 0x4e464a
            : itemId === 'copper_ingot'
            ? 0xd97b54
            : itemId === 'amethyst_shard'
            ? 0xb366f5
            : itemId === 'lapis_lazuli'
            ? 0x2654c7
            : itemId === 'redstone_dust'
            ? 0xd92626
            : itemId === 'apple' || itemId === 'melon_slice'
            ? 0xdb2828
            : itemId === 'raw_porkchop' || itemId === 'raw_beef' || itemId === 'raw_chicken'
            ? 0xf09aa0
            : itemId === 'cooked_porkchop' || itemId === 'cooked_beef' || itemId === 'cooked_chicken'
            ? 0xb8723d
            : itemId === 'bone' || itemId === 'bone_meal'
            ? 0xedece4
            : itemId === 'flint'
            ? 0x454a54
            : itemId === 'flint_and_steel'
            ? 0xd6dee6
            : itemId === 'nether_quartz'
            ? 0xf2eee4
            : itemId === 'glowstone_dust'
            ? 0xffcf48
            : itemId === 'blaze_rod'
            ? 0xffb319
            : itemId === 'blaze_powder'
            ? 0xff7b1c
            : itemId === 'gold_nugget'
            ? 0xf7cf3d
            : itemId === 'ghast_tear'
            ? 0xd6f1f7
            : def?.armorSlot
            ? tierColor
            : 0x8f6636;
        const itemCube = new THREE.Mesh(
          itemId === 'blaze_rod'
            ? new THREE.BoxGeometry(0.055, 0.36, 0.055)
            : new THREE.BoxGeometry(0.17, 0.17, 0.07),
          new THREE.MeshLambertMaterial({ color: col })
        );
        g.add(itemCube);
      }
      g.rotation.set(-0.35, -0.35, 0.18);
      this.mesh = g;
    }

    if (this.mesh) {
      this.holder.add(this.mesh);
    }
  }

  public update(dt: number, movedDist: number, isMining: boolean, eatingProgress = 0): void {
    if (movedDist > 0.002) {
      this.bobTime += movedDist * 3.2;
    }
    const bobX = Math.cos(this.bobTime) * 0.025;
    const bobY = Math.abs(Math.sin(this.bobTime)) * 0.028;

    if (eatingProgress > 0) {
      // Bring food toward center/mouth and chew rapidly
      const chew = Math.sin(eatingProgress * Math.PI * 12) * 0.045;
      this.holder.position.set(-0.18 + bobX * 0.3, 0.12 + chew, -0.05);
      this.holder.rotation.set(0.32 + chew * 2, 0.45, -0.15);
      return;
    }

    if (isMining && !this.swinging) {
      this.triggerSwing();
    }

    let swingRotX = 0;
    let swingRotY = 0;
    let swingPosZ = 0;

    if (this.swinging) {
      this.swingProgress += dt * 5.2;
      if (this.swingProgress >= 1) {
        this.swinging = false;
        this.swingProgress = 0;
      } else {
        const s = Math.sin(this.swingProgress * Math.PI);
        swingRotX = -s * 0.95;
        swingRotY = s * 0.4;
        swingPosZ = -s * 0.18;
      }
    }

    this.holder.position.set(bobX, -bobY, swingPosZ);
    this.holder.rotation.set(swingRotX, swingRotY, 0);
  }
}

/**
 * Manages all DroppedItems, Mobs (Pig, Sheep, Zombie, Skeleton), Arrows, and ParticleSystem.
 */
export class EntityManager {
  public readonly droppedItems: DroppedItem[] = [];
  public readonly mobs: Mob[] = [];
  public readonly arrows: ArrowEntity[] = [];
  public readonly fireballs: FireballProjectile[] = [];
  public readonly primedTnts: PrimedTntEntity[] = [];
  public readonly particles: ParticleSystem;
  private spawnTimer = 3.5;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly atlasMaterial: THREE.Material
  ) {
    this.particles = new ParticleSystem(scene);
  }

  public spawnDroppedItem(itemId: ItemId, count: number, x: number, y: number, z: number): void {
    const item = new DroppedItem(itemId, count, x, y, z, this.atlasMaterial);
    this.droppedItems.push(item);
    this.scene.add(item.mesh);
  }

  public spawnPig(x: number, y: number, z: number): void {
    const pig = new PigMob(x, y, z);
    this.mobs.push(pig);
    this.scene.add(pig.group);
  }

  public spawnSheep(x: number, y: number, z: number): void {
    const sheep = new SheepMob(x, y, z);
    this.mobs.push(sheep);
    this.scene.add(sheep.group);
  }

  public spawnZombie(x: number, y: number, z: number): void {
    const zmb = new ZombieMob(x, y, z);
    this.mobs.push(zmb);
    this.scene.add(zmb.group);
  }

  public spawnSkeleton(x: number, y: number, z: number): void {
    const skel = new SkeletonMob(x, y, z);
    this.mobs.push(skel);
    this.scene.add(skel.group);
  }

  public spawnVillager(
    villagerId: string,
    x: number,
    y: number,
    z: number,
    homeX: number,
    homeZ: number,
    profession: VillagerProfession
  ): void {
    if (this.mobs.some((m) => m instanceof VillagerMob && m.villagerId === villagerId)) return;
    const v = new VillagerMob(villagerId, x, y, z, homeX, homeZ, profession);
    this.mobs.push(v);
    this.scene.add(v.group);
  }

  public findLookedAtVillager(
    eyeX: number,
    eyeY: number,
    eyeZ: number,
    dirX: number,
    dirY: number,
    dirZ: number,
    maxDist = 4.2
  ): VillagerMob | null {
    let best: VillagerMob | null = null;
    let bestDist = maxDist;
    for (const mob of this.mobs) {
      if (mob.dead || !(mob instanceof VillagerMob)) continue;
      const cx = mob.x;
      const cy = mob.y + mob.height * 0.55;
      const cz = mob.z;
      const vx = cx - eyeX;
      const vy = cy - eyeY;
      const vz = cz - eyeZ;
      const proj = vx * dirX + vy * dirY + vz * dirZ;
      if (proj < 0 || proj > bestDist) continue;
      const perpSq = vx * vx + vy * vy + vz * vz - proj * proj;
      const radius = 0.72;
      if (perpSq <= radius * radius) {
        bestDist = proj;
        best = mob;
      }
    }
    return best;
  }

  public findLookedAtSheep(
    eyeX: number,
    eyeY: number,
    eyeZ: number,
    dirX: number,
    dirY: number,
    dirZ: number,
    maxDist = 4.0
  ): SheepMob | null {
    let best: SheepMob | null = null;
    let bestDist = maxDist;
    for (const mob of this.mobs) {
      if (mob.dead || !(mob instanceof SheepMob) || mob.sheared) continue;
      const cx = mob.x;
      const cy = mob.y + mob.height * 0.55;
      const cz = mob.z;
      const vx = cx - eyeX;
      const vy = cy - eyeY;
      const vz = cz - eyeZ;
      const proj = vx * dirX + vy * dirY + vz * dirZ;
      if (proj < 0 || proj > bestDist) continue;
      const perpSq = vx * vx + vy * vy + vz * vz - proj * proj;
      if (perpSq <= 0.8 * 0.8) {
        bestDist = proj;
        best = mob;
      }
    }
    return best;
  }

  public spawnZombiePiglin(x: number, y: number, z: number): void {
    const zp = new ZombiePiglinMob(x, y, z);
    this.mobs.push(zp);
    this.scene.add(zp.group);
  }

  public spawnGhast(x: number, y: number, z: number): void {
    const g = new GhastMob(x, y, z);
    this.mobs.push(g);
    this.scene.add(g.group);
  }

  public spawnBlaze(
    x: number,
    y: number,
    z: number,
    homeX = x,
    homeZ = z,
    blazeId?: string
  ): void {
    if (blazeId && this.mobs.some((m) => m instanceof BlazeMob && m.blazeId === blazeId)) return;
    const b = new BlazeMob(x, y, z, homeX, homeZ, blazeId);
    this.mobs.push(b);
    this.scene.add(b.group);
  }

  public spawnFireball(
    kind: 'ghast' | 'blaze',
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number
  ): void {
    const fb = new FireballProjectile(kind, x, y, z, vx, vy, vz);
    this.fireballs.push(fb);
    this.scene.add(fb.group);
  }

  /**
   * Checks if player left-click punches a midair Ghast Fireball and deflects it back along aim!
   */
  public tryDeflectFireball(
    eyeX: number,
    eyeY: number,
    eyeZ: number,
    dirX: number,
    dirY: number,
    dirZ: number
  ): boolean {
    let best: FireballProjectile | null = null;
    let bestDist = 4.6;
    for (const fb of this.fireballs) {
      if (fb.dead || fb.kind !== 'ghast') continue;
      const vx = fb.x - eyeX;
      const vy = fb.y - eyeY;
      const vz = fb.z - eyeZ;
      const proj = vx * dirX + vy * dirY + vz * dirZ;
      if (proj < 0 || proj > bestDist) continue;
      const perpSq = vx * vx + vy * vy + vz * vz - proj * proj;
      if (perpSq <= 1.1 * 1.1) {
        bestDist = proj;
        best = fb;
      }
    }
    if (!best) return false;
    const speed = 19.0;
    best.vx = dirX * speed;
    best.vy = dirY * speed;
    best.vz = dirZ * speed;
    best.deflected = true;
    best.age = 0;
    this.particles.emitCriticalBurst(best.x, best.y, best.z);
    return true;
  }

  public spawnArrow(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    owner: 'mob' | 'player' = 'mob',
    damage = 3
  ): void {
    const arrow = new ArrowEntity(x, y, z, vx, vy, vz, owner, damage);
    this.arrows.push(arrow);
    this.scene.add(arrow.group);
  }

  public spawnPrimedTnt(x: number, y: number, z: number, fuse = 3.0): void {
    const tnt = new PrimedTntEntity(x, y, z, this.atlasMaterial, fuse);
    this.primedTnts.push(tnt);
    this.scene.add(tnt.mesh);
  }

  public getTotalEntityCount(): number {
    return (
      this.mobs.length +
      this.droppedItems.length +
      this.arrows.length +
      this.fireballs.length +
      this.primedTnts.length
    );
  }

  /**
   * Ray-sphere/AABB attack check from player eyes along camera direction up to 3.5 blocks.
   * Supports Critical Hits (1.5x damage + golden star particle burst) and Zombie Piglin pack aggro.
   */
  public tryAttackMob(
    eyeX: number,
    eyeY: number,
    eyeZ: number,
    dirX: number,
    dirY: number,
    dirZ: number,
    baseDamage: number,
    isCritical = false
  ): { hit: boolean; kind?: MobKind; killed?: boolean; critical?: boolean } {
    let bestMob: Mob | null = null;
    let bestDist = 3.8;

    for (const mob of this.mobs) {
      if (mob.dead) continue;
      const cx = mob.x;
      const cy = mob.y + mob.height * 0.55;
      const cz = mob.z;
      const vx = cx - eyeX;
      const vy = cy - eyeY;
      const vz = cz - eyeZ;
      const proj = vx * dirX + vy * dirY + vz * dirZ;
      if (proj < 0 || proj > bestDist) continue;
      const perpSq = vx * vx + vy * vy + vz * vz - proj * proj;
      const radius = Math.max(mob.width * 0.65, mob.height * 0.52);
      if (perpSq <= radius * radius) {
        bestDist = proj;
        bestMob = mob;
      }
    }

    if (!bestMob) return { hit: false };
    const finalDamage = isCritical ? baseDamage * 1.5 : baseDamage;
    const killed = bestMob.takeDamage(finalDamage, dirX, dirZ);

    // Pack aggro: hitting a Zombie Piglin angers all Zombie Piglins within 16 blocks!
    if (bestMob instanceof ZombiePiglinMob) {
      for (const other of this.mobs) {
        if (other instanceof ZombiePiglinMob && !other.dead) {
          if (Math.hypot(other.x - bestMob.x, other.z - bestMob.z) <= 16) {
            other.provoke(28);
          }
        }
      }
    }

    const bloodColor =
      bestMob.kind === 'pig'
        ? '#f2a2a8'
        : bestMob.kind === 'sheep'
        ? '#f0f2f5'
        : bestMob.kind === 'skeleton'
        ? '#dcded8'
        : bestMob.kind === 'ghast'
        ? '#f0f4f8'
        : bestMob.kind === 'blaze'
        ? '#ffae24'
        : bestMob.kind === 'zombie_piglin'
        ? '#e09198'
        : '#5c8a47';

    this.particles.emitBlockBurst(
      bestMob.x - 0.5,
      bestMob.y + bestMob.height * 0.5,
      bestMob.z - 0.5,
      bloodColor,
      killed ? 14 : 6
    );
    if (isCritical) {
      this.particles.emitCriticalBurst(bestMob.x, bestMob.y + bestMob.height * 0.65, bestMob.z);
    }

    if (killed) {
      for (const drop of bestMob.getDrops()) {
        this.spawnDroppedItem(drop.itemId, drop.count, bestMob.x, bestMob.y + 0.5, bestMob.z);
      }
    }
    return { hit: true, kind: bestMob.kind, killed, critical: isCritical };
  }

  public update(
    dt: number,
    playerX: number,
    playerY: number,
    playerZ: number,
    isNight: boolean,
    difficulty: Difficulty,
    dimension: DimensionId,
    getBlock: BlockGetter,
    getSkyLight: (x: number, y: number, z: number) => number,
    getLightLevel: (x: number, y: number, z: number) => number,
    getSurfaceY: (x: number, z: number) => number,
    onPickupItem: (itemId: ItemId, count: number) => boolean,
    onDamagePlayer: (amount: number, source: 'mob' | 'arrow' | 'fireball', dirX: number, dirZ: number) => void,
    onArrowShootSound: () => void,
    onArrowHitSound: () => void,
    onFireballExplode?: (wx: number, wy: number, wz: number) => void,
    onIgnitePlayer?: (seconds: number) => void,
    onGhastScream?: () => void,
    onTntExplode?: (wx: number, wy: number, wz: number) => void
  ): void {
    this.particles.update(dt);

    // 0. Update Primed TNT entities
    for (let i = this.primedTnts.length - 1; i >= 0; i--) {
      const tnt = this.primedTnts[i];
      if (Math.random() < dt * 14) {
        this.particles.emitBlockBurst(tnt.x - 0.5, tnt.y + 0.9, tnt.z - 0.5, '#cbd5e1', 1);
      }
      const detonated = tnt.update(dt, getBlock);
      if (detonated) {
        const tx = tnt.x;
        const ty = tnt.y + 0.4;
        const tz = tnt.z;
        this.scene.remove(tnt.mesh);
        tnt.dispose();
        this.primedTnts.splice(i, 1);
        onTntExplode?.(tx, ty, tz);
      }
    }

    const dmgScale =
      difficulty === 'peaceful' ? 0 : difficulty === 'easy' ? 0.5 : difficulty === 'hard' ? 1.5 : 1.0;

    // In Peaceful mode, immediately despawn hostile mobs
    if (difficulty === 'peaceful') {
      for (let i = this.mobs.length - 1; i >= 0; i--) {
        const m = this.mobs[i];
        if (m.kind === 'zombie' || m.kind === 'skeleton' || m.kind === 'ghast' || m.kind === 'blaze') {
          this.scene.remove(m.group);
          m.dispose();
          this.mobs.splice(i, 1);
        }
      }
    }

    // 1. Update DroppedItems + magnetic pull within 1.6 blocks
    for (let i = this.droppedItems.length - 1; i >= 0; i--) {
      const item = this.droppedItems[i];
      item.update(dt, getBlock);

      const dx = playerX - item.x;
      const dy = playerY + 0.85 - item.y;
      const dz = playerZ - item.z;
      const dist = Math.hypot(dx, dy, dz);

      if (item.age > 0.35 && dist < 1.6) {
        const pull = (1.6 - dist) * 10 * dt;
        item.x += (dx / (dist || 1)) * pull;
        item.y += (dy / (dist || 1)) * pull;
        item.z += (dz / (dist || 1)) * pull;
        if (dist < 0.72) {
          if (onPickupItem(item.itemId, item.count)) {
            this.scene.remove(item.mesh);
            item.dispose(this.atlasMaterial);
            this.droppedItems.splice(i, 1);
            continue;
          }
        }
      }

      if (item.age > 180) {
        this.scene.remove(item.mesh);
        item.dispose(this.atlasMaterial);
        this.droppedItems.splice(i, 1);
      }
    }

    // 2. Update Arrows
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const arrow = this.arrows[i];
      const shouldRemove = arrow.update(
        dt,
        playerX,
        playerY,
        playerZ,
        this.mobs,
        getBlock,
        (dmg, dx, dz) => {
          onArrowHitSound();
          if (dmgScale > 0) onDamagePlayer(dmg * dmgScale, 'arrow', dx, dz);
        },
        (mob, dmg, dx, dz) => {
          onArrowHitSound();
          const killed = mob.takeDamage(dmg, dx, dz);
          if (killed) {
            for (const drop of mob.getDrops()) {
              this.spawnDroppedItem(drop.itemId, drop.count, mob.x, mob.y + 0.5, mob.z);
            }
          }
        },
        () => onArrowHitSound()
      );
      if (shouldRemove) {
        this.scene.remove(arrow.group);
        arrow.dispose();
        this.arrows.splice(i, 1);
      }
    }

    // 2.5 Update Nether Fireballs (Ghast explosive & Blaze burning projectiles)
    for (let i = this.fireballs.length - 1; i >= 0; i--) {
      const fb = this.fireballs[i];
      const shouldRemove = fb.update(
        dt,
        playerX,
        playerY,
        playerZ,
        this.mobs,
        getBlock,
        (kind, wx, wy, wz, dx, dz) => {
          if (kind === 'ghast') {
            onFireballExplode?.(wx, wy, wz);
            if (dmgScale > 0) onDamagePlayer(6 * dmgScale, 'fireball', dx, dz);
          } else {
            this.particles.emitBlockBurst(wx - 0.5, wy - 0.5, wz - 0.5, '#ff771c', 10);
            if (dmgScale > 0) {
              onDamagePlayer(3 * dmgScale, 'fireball', dx, dz);
              onIgnitePlayer?.(3.0);
            }
          }
        },
        (kind, wx, wy, wz) => {
          if (kind === 'ghast') {
            onFireballExplode?.(wx, wy, wz);
          } else {
            this.particles.emitBlockBurst(wx - 0.5, wy - 0.5, wz - 0.5, '#ff8822', 8);
          }
        },
        (mob, wx, wy, wz, dx, dz) => {
          // Return to Sender! Deflected Ghast fireball insta-kills Ghasts!
          onFireballExplode?.(wx, wy, wz);
          const dmg = mob.kind === 'ghast' ? 999 : 14;
          const killed = mob.takeDamage(dmg, dx, dz);
          if (killed) {
            for (const drop of mob.getDrops()) {
              this.spawnDroppedItem(drop.itemId, drop.count, mob.x, mob.y + 0.5, mob.z);
            }
          }
        },
        (wx, wy, wz, col) => this.particles.emitBlockBurst(wx, wy, wz, col, 1)
      );
      if (shouldRemove) {
        this.scene.remove(fb.group);
        fb.dispose();
        this.fireballs.splice(i, 1);
      }
    }

    // 3. Update Mobs
    const mobCtx: MobUpdateContext = {
      dt,
      playerX,
      playerY,
      playerZ,
      isDay: !isNight,
      dimension,
      getBlock,
      getSkyLight,
      onDamagePlayer: (amt, src, dx, dz) => {
        if (dmgScale > 0) onDamagePlayer(amt * dmgScale, src, dx, dz);
      },
      onShootArrow: (x, y, z, vx, vy, vz) => {
        this.spawnArrow(x, y, z, vx, vy, vz);
        onArrowShootSound();
      },
      onShootFireball: (kind, x, y, z, vx, vy, vz) => {
        this.spawnFireball(kind, x, y, z, vx, vy, vz);
        onArrowShootSound();
      },
      onGhastScream: () => {
        onGhastScream?.();
      },
      onEmitParticles: (wx, wy, wz, col, count) => this.particles.emitBlockBurst(wx, wy, wz, col, count),
    };

    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const mob = this.mobs[i];
      const remove = mob.tick(mobCtx);
      const distToPlayer = Math.hypot(mob.x - playerX, mob.z - playerZ);
      const despawnRadius = mob.kind === 'villager' ? 115 : mob.kind === 'ghast' ? 92 : 72;
      if (remove || distToPlayer > despawnRadius) {
        this.scene.remove(mob.group);
        mob.dispose();
        this.mobs.splice(i, 1);
      }
    }

    // 4. Ambient Mob Spawning (Dimension-aware)
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      if (dimension === 'nether') {
        this.spawnTimer = 4.0;
        const piglinCount = this.mobs.filter((m) => m.kind === 'zombie_piglin').length;
        const ghastCount = this.mobs.filter((m) => m.kind === 'ghast').length;
        const blazeCount = this.mobs.filter((m) => m.kind === 'blaze').length;

        const angle = Math.random() * Math.PI * 2;
        const radius = 14 + Math.random() * 20;
        const sx = Math.floor(playerX + Math.cos(angle) * radius);
        const sz = Math.floor(playerZ + Math.sin(angle) * radius);

        // Spawn Zombie Piglin pack (2-3) on open Netherrack/Soul Sand/Nether Bricks
        if (piglinCount < 6 && Math.random() < 0.6) {
          const sy = getSurfaceY(sx, sz) + 1;
          const ground = getBlock(sx, sy - 1, sz);
          if (
            (ground === BLOCK_IDS.NETHERRACK ||
              ground === BLOCK_IDS.SOUL_SAND ||
              ground === BLOCK_IDS.NETHER_BRICKS) &&
            getBlock(sx, sy, sz) === BLOCK_IDS.AIR &&
            getBlock(sx, sy + 1, sz) === BLOCK_IDS.AIR
          ) {
            const packSize = 2 + (Math.random() < 0.5 ? 1 : 0);
            for (let p = 0; p < packSize && piglinCount + p < 7; p++) {
              const ox = sx + (p === 0 ? 0 : p === 1 ? 1 : -1);
              if (getBlock(ox, sy, sz) === BLOCK_IDS.AIR) {
                this.spawnZombiePiglin(ox + 0.5, sy, sz + 0.5);
              }
            }
          }
        } else if (difficulty !== 'peaceful' && ghastCount < 2 && Math.random() < 0.5) {
          // Spawn floating Ghast in open upper cavern space
          const gy = Math.max(46, Math.min(82, Math.floor(playerY + 10 + Math.random() * 12)));
          if (
            getBlock(sx, gy, sz) === BLOCK_IDS.AIR &&
            getBlock(sx, gy + 2, sz) === BLOCK_IDS.AIR &&
            getBlock(sx + 1, gy + 1, sz + 1) === BLOCK_IDS.AIR
          ) {
            this.spawnGhast(sx + 0.5, gy, sz + 0.5);
          }
        } else if (difficulty !== 'peaceful' && blazeCount < 4) {
          // Spawn Blazes around Nether Brick fortresses
          const sy = getSurfaceY(sx, sz) + 1;
          if (getBlock(sx, sy - 1, sz) === BLOCK_IDS.NETHER_BRICKS && getBlock(sx, sy, sz) === BLOCK_IDS.AIR) {
            this.spawnBlaze(sx + 0.5, sy + 0.5, sz + 0.5, sx + 0.5, sz + 0.5);
          }
        }
        return;
      }

      this.spawnTimer = difficulty === 'hard' && isNight ? 2.8 : 4.2;
      const pigCount = this.mobs.filter((m) => m.kind === 'pig').length;
      const sheepCount = this.mobs.filter((m) => m.kind === 'sheep').length;
      const zombieCount = this.mobs.filter((m) => m.kind === 'zombie').length;
      const skeletonCount = this.mobs.filter((m) => m.kind === 'skeleton').length;

      const angle = Math.random() * Math.PI * 2;
      const radius = 14 + Math.random() * 18;
      const sx = Math.floor(playerX + Math.cos(angle) * radius);
      const sz = Math.floor(playerZ + Math.sin(angle) * radius);
      const sy = getSurfaceY(sx, sz) + 1;
      const groundId = getBlock(sx, sy - 1, sz);
      const spawnBlock = getBlock(sx, sy, sz);

      if (
        groundId !== BLOCK_IDS.WATER &&
        groundId !== BLOCK_IDS.LAVA &&
        groundId !== BLOCK_IDS.AIR &&
        (spawnBlock === BLOCK_IDS.AIR || BLOCKS[spawnBlock]?.crossMesh)
      ) {
        const light = getLightLevel(sx, sy, sz);
        if (!isNight && groundId === BLOCK_IDS.GRASS) {
          if (sheepCount < 4 && (sheepCount <= pigCount || Math.random() < 0.5)) {
            this.spawnSheep(sx + 0.5, sy, sz + 0.5);
          } else if (pigCount < 4) {
            this.spawnPig(sx + 0.5, sy, sz + 0.5);
          }
        } else if (difficulty !== 'peaceful' && (isNight || light < 7)) {
          const maxHostile = difficulty === 'hard' ? 6 : 4;
          if (skeletonCount < Math.max(2, maxHostile - 1) && (skeletonCount < zombieCount || Math.random() < 0.45)) {
            this.spawnSkeleton(sx + 0.5, sy, sz + 0.5);
          } else if (zombieCount < maxHostile) {
            this.spawnZombie(sx + 0.5, sy, sz + 0.5);
          }
        }
      }
    }
  }

  /**
   * Cleanly removes and disposes all dimension-local entities (mobs, projectiles, drops)
   * when switching between Overworld and The Nether without destroying the ParticleSystem.
   */
  public clearForDimensionSwitch(): void {
    for (const item of this.droppedItems) {
      this.scene.remove(item.mesh);
      item.dispose(this.atlasMaterial);
    }
    this.droppedItems.length = 0;
    for (const arrow of this.arrows) {
      this.scene.remove(arrow.group);
      arrow.dispose();
    }
    this.arrows.length = 0;
    for (const fb of this.fireballs) {
      this.scene.remove(fb.group);
      fb.dispose();
    }
    this.fireballs.length = 0;
    for (const mob of this.mobs) {
      this.scene.remove(mob.group);
      mob.dispose();
    }
    this.mobs.length = 0;
    for (const tnt of this.primedTnts) {
      this.scene.remove(tnt.mesh);
      tnt.dispose();
    }
    this.primedTnts.length = 0;
    this.spawnTimer = 2.0;
  }

  public dispose(): void {
    this.clearForDimensionSwitch();
    this.particles.dispose();
  }
}

// Keep unused scratch ref cleanly scoped for future orientation helpers
void _upVec;
