import * as THREE from 'three';
import {
  BLOCK_IDS,
  BLOCKS,
  CHUNK_HEIGHT,
  CHUNK_SIZE,
  getIndex,
} from './blocks';
import { TILES_PER_ROW } from './textures';
import type { Chunk, World } from './world';

interface FaceDef {
  dir: [number, number, number];
  uvKey: 'top' | 'side' | 'bottom' | 'front';
  shade: number;
  corners: Array<{
    pos: [number, number, number];
    uv: [number, number];
    aoSide1: [number, number, number];
    aoSide2: [number, number, number];
    aoCorner: [number, number, number];
  }>;
}

const FACES: FaceDef[] = [
  // +Y (Top)
  {
    dir: [0, 1, 0],
    uvKey: 'top',
    shade: 1.0,
    corners: [
      { pos: [0, 1, 1], uv: [0, 0], aoSide1: [-1, 1, 0], aoSide2: [0, 1, 1], aoCorner: [-1, 1, 1] },
      { pos: [1, 1, 1], uv: [1, 0], aoSide1: [1, 1, 0], aoSide2: [0, 1, 1], aoCorner: [1, 1, 1] },
      { pos: [1, 1, 0], uv: [1, 1], aoSide1: [1, 1, 0], aoSide2: [0, 1, -1], aoCorner: [1, 1, -1] },
      { pos: [0, 1, 0], uv: [0, 1], aoSide1: [-1, 1, 0], aoSide2: [0, 1, -1], aoCorner: [-1, 1, -1] },
    ],
  },
  // -Y (Bottom)
  {
    dir: [0, -1, 0],
    uvKey: 'bottom',
    shade: 0.56,
    corners: [
      { pos: [0, 0, 0], uv: [0, 0], aoSide1: [-1, -1, 0], aoSide2: [0, -1, -1], aoCorner: [-1, -1, -1] },
      { pos: [1, 0, 0], uv: [1, 0], aoSide1: [1, -1, 0], aoSide2: [0, -1, -1], aoCorner: [1, -1, -1] },
      { pos: [1, 0, 1], uv: [1, 1], aoSide1: [1, -1, 0], aoSide2: [0, -1, 1], aoCorner: [1, -1, 1] },
      { pos: [0, 0, 1], uv: [0, 1], aoSide1: [-1, -1, 0], aoSide2: [0, -1, 1], aoCorner: [-1, -1, 1] },
    ],
  },
  // +X (East)
  {
    dir: [1, 0, 0],
    uvKey: 'side',
    shade: 0.84,
    corners: [
      { pos: [1, 0, 1], uv: [0, 0], aoSide1: [1, -1, 0], aoSide2: [1, 0, 1], aoCorner: [1, -1, 1] },
      { pos: [1, 0, 0], uv: [1, 0], aoSide1: [1, -1, 0], aoSide2: [1, 0, -1], aoCorner: [1, -1, -1] },
      { pos: [1, 1, 0], uv: [1, 1], aoSide1: [1, 1, 0], aoSide2: [1, 0, -1], aoCorner: [1, 1, -1] },
      { pos: [1, 1, 1], uv: [0, 1], aoSide1: [1, 1, 0], aoSide2: [1, 0, 1], aoCorner: [1, 1, 1] },
    ],
  },
  // -X (West)
  {
    dir: [-1, 0, 0],
    uvKey: 'side',
    shade: 0.84,
    corners: [
      { pos: [0, 0, 0], uv: [0, 0], aoSide1: [-1, -1, 0], aoSide2: [-1, 0, -1], aoCorner: [-1, -1, -1] },
      { pos: [0, 0, 1], uv: [1, 0], aoSide1: [-1, -1, 0], aoSide2: [-1, 0, 1], aoCorner: [-1, -1, 1] },
      { pos: [0, 1, 1], uv: [1, 1], aoSide1: [-1, 1, 0], aoSide2: [-1, 0, 1], aoCorner: [-1, 1, 1] },
      { pos: [0, 1, 0], uv: [0, 1], aoSide1: [-1, 1, 0], aoSide2: [-1, 0, -1], aoCorner: [-1, 1, -1] },
    ],
  },
  // +Z (South / Front)
  {
    dir: [0, 0, 1],
    uvKey: 'front',
    shade: 0.78,
    corners: [
      { pos: [0, 0, 1], uv: [0, 0], aoSide1: [-1, 0, 1], aoSide2: [0, -1, 1], aoCorner: [-1, -1, 1] },
      { pos: [1, 0, 1], uv: [1, 0], aoSide1: [1, 0, 1], aoSide2: [0, -1, 1], aoCorner: [1, -1, 1] },
      { pos: [1, 1, 1], uv: [1, 1], aoSide1: [1, 0, 1], aoSide2: [0, 1, 1], aoCorner: [1, 1, 1] },
      { pos: [0, 1, 1], uv: [0, 1], aoSide1: [-1, 0, 1], aoSide2: [0, 1, 1], aoCorner: [-1, 1, 1] },
    ],
  },
  // -Z (North)
  {
    dir: [0, 0, -1],
    uvKey: 'side',
    shade: 0.76,
    corners: [
      { pos: [1, 0, 0], uv: [0, 0], aoSide1: [1, 0, -1], aoSide2: [0, -1, -1], aoCorner: [1, -1, -1] },
      { pos: [0, 0, 0], uv: [1, 0], aoSide1: [-1, 0, -1], aoSide2: [0, -1, -1], aoCorner: [-1, -1, -1] },
      { pos: [0, 1, 0], uv: [1, 1], aoSide1: [-1, 0, -1], aoSide2: [0, 1, -1], aoCorner: [-1, 1, -1] },
      { pos: [1, 1, 0], uv: [0, 1], aoSide1: [1, 0, -1], aoSide2: [0, 1, -1], aoCorner: [1, 1, -1] },
    ],
  },
];

const AO_TABLE = [1.0, 0.8, 0.65, 0.5] as const;

export interface ChunkMeshResult {
  opaqueGeometry: THREE.BufferGeometry | null;
  transparentGeometry: THREE.BufferGeometry | null;
  crossGeometry: THREE.BufferGeometry | null;
  opaqueLightData: Float32Array | null;
  transparentLightData: Float32Array | null;
  crossLightData: Float32Array | null;
}

interface MeshBuilder {
  positions: number[];
  normals: number[];
  uvs: number[];
  colors: number[];
  lightData: number[];
  indices: number[];
  vertexCount: number;
}

function createBuilder(): MeshBuilder {
  return {
    positions: [],
    normals: [],
    uvs: [],
    colors: [],
    lightData: [],
    indices: [],
    vertexCount: 0,
  };
}

function finalizeBuilder(b: MeshBuilder): { geometry: THREE.BufferGeometry | null; lightData: Float32Array | null } {
  if (b.vertexCount === 0) return { geometry: null, lightData: null };
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(b.positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(b.normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(b.uvs, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(b.colors, 3));
  geo.setIndex(b.indices);
  geo.computeBoundingSphere();
  return { geometry: geo, lightData: new Float32Array(b.lightData) };
}

/**
 * Custom BufferGeometry chunk mesher with Face Culling, real 3-neighbor Vertex Ambient Occlusion,
 * Cross-Mesh X-planes (Tall Grass, Red Flower, Oak Sapling) with DoubleSide + alphaTest 0.5,
 * lowered Water top face (-0.12), Chest front lock face, Torch geometry, and BFS lighting.
 */
export class ChunkMesher {
  public static buildChunk(world: World, chunk: Chunk, ambientDayFactor: number): ChunkMeshResult {
    const opaque = createBuilder();
    const transparent = createBuilder();
    const cross = createBuilder();
    const baseX = chunk.cx * CHUNK_SIZE;
    const baseZ = chunk.cz * CHUNK_SIZE;
    const tileStep = 1 / TILES_PER_ROW;
    const uvPad = 0.0008;

    const isNether = world.dimension === 'nether';
    const minAmbient = isNether ? 0.28 : 0.08;

    const isOccluder = (wx: number, wy: number, wz: number): boolean => {
      const id = world.getBlock(wx, wy, wz);
      const d = BLOCKS[id];
      return d ? d.solid && !d.transparent : false;
    };

    const pushCrossMesh = (
      b: MeshBuilder,
      lx: number,
      y: number,
      lz: number,
      wx: number,
      wz: number,
      tileUv: [number, number],
      fullBright = false
    ) => {
      const [tx, ty] = tileUv;
      const u0 = tx * tileStep + uvPad;
      const u1 = (tx + 1) * tileStep - uvPad;
      const v0 = 1 - (ty + 1) * tileStep + uvPad;
      const v1 = 1 - ty * tileStep - uvPad;

      const skyL = fullBright ? 0 : world.getSkyLight(wx, y, wz) / 15;
      const blkL = fullBright ? 1.0 : world.getBlockLight(wx, y, wz) / 15;
      const combined = fullBright ? 1.0 : Math.max(minAmbient, Math.max(skyL * ambientDayFactor, blkL));
      const shade = fullBright ? 1.0 : 0.94;
      const finalBr = Math.min(1.0, combined * shade);
      const warmBoost = fullBright ? 0.16 : blkL > skyL * ambientDayFactor ? 0.12 * blkL : 0;
      const cr = Math.min(1, finalBr + warmBoost * 0.5 + (isNether ? 0.06 : 0));
      const cg = Math.min(1, finalBr + warmBoost * 0.15);
      const cb = Math.max(0.05, finalBr - warmBoost * 0.35 - (isNether ? 0.03 : 0));

      // Two diagonal intersecting X-planes inside the voxel
      const inset = 0.14;
      const planes: Array<Array<[number, number, number]>> = [
        [
          [lx + inset, y, lz + inset],
          [lx + 1 - inset, y, lz + 1 - inset],
          [lx + 1 - inset, y + 0.92, lz + 1 - inset],
          [lx + inset, y + 0.92, lz + inset],
        ],
        [
          [lx + 1 - inset, y, lz + inset],
          [lx + inset, y, lz + 1 - inset],
          [lx + inset, y + 0.92, lz + 1 - inset],
          [lx + 1 - inset, y + 0.92, lz + inset],
        ],
      ];

      for (const quad of planes) {
        const base = b.vertexCount;
        const qUvs: Array<[number, number]> = [
          [u0, v0],
          [u1, v0],
          [u1, v1],
          [u0, v1],
        ];
        for (let i = 0; i < 4; i++) {
          b.positions.push(quad[i][0], quad[i][1], quad[i][2]);
          b.normals.push(0, 1, 0);
          b.uvs.push(qUvs[i][0], qUvs[i][1]);
          b.colors.push(cr, cg, cb);
          b.lightData.push(skyL, blkL, shade);
        }
        b.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
        b.vertexCount += 4;
      }
    };

    const pushTorch = (
      b: MeshBuilder,
      lx: number,
      y: number,
      lz: number,
      uvTile: [number, number] = BLOCKS[BLOCK_IDS.TORCH].uvs.side,
      tint: [number, number, number] = [1.0, 0.96, 0.85]
    ) => {
      const [tx, ty] = uvTile;
      const u0 = tx * tileStep + 0.42 * tileStep;
      const u1 = tx * tileStep + 0.58 * tileStep;
      const vBottom = 1 - (ty + 1) * tileStep + uvPad;
      const vTop = 1 - ty * tileStep - 0.18 * tileStep;

      const x0 = lx + 0.43;
      const x1 = lx + 0.57;
      const y0 = y;
      const y1 = y + 0.65;
      const z0 = lz + 0.43;
      const z1 = lz + 0.57;

      const addQuad = (
        p0: [number, number, number],
        p1: [number, number, number],
        p2: [number, number, number],
        p3: [number, number, number],
        nx: number,
        ny: number,
        nz: number,
        va: number,
        vb: number
      ) => {
        const base = b.vertexCount;
        const pts = [p0, p1, p2, p3];
        const qUvs: Array<[number, number]> = [
          [u0, va],
          [u1, va],
          [u1, vb],
          [u0, vb],
        ];
        for (let i = 0; i < 4; i++) {
          b.positions.push(pts[i][0], pts[i][1], pts[i][2]);
          b.normals.push(nx, ny, nz);
          b.uvs.push(qUvs[i][0], qUvs[i][1]);
          b.colors.push(tint[0], tint[1], tint[2]);
          b.lightData.push(0, 1.0, 1.0);
        }
        b.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
        b.vertexCount += 4;
      };

      addQuad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], 0, 0, 1, vBottom, vTop);
      addQuad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], 0, 0, -1, vBottom, vTop);
      addQuad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], 1, 0, 0, vBottom, vTop);
      addQuad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], -1, 0, 0, vBottom, vTop);
      const flameV0 = 1 - (ty + 0.34) * tileStep;
      const flameV1 = 1 - (ty + 0.2) * tileStep;
      addQuad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], 0, 1, 0, flameV0, flameV1);
    };

    const pushCustomBox = (
      b: MeshBuilder,
      x0: number,
      y0: number,
      z0: number,
      x1: number,
      y1: number,
      z1: number,
      wx: number,
      wy: number,
      wz: number,
      topUv: [number, number],
      sideUv: [number, number],
      bottomUv: [number, number]
    ) => {
      const skyL = world.getSkyLight(wx, wy, wz) / 15;
      const blkL = world.getBlockLight(wx, wy, wz) / 15;
      const combined = Math.max(0.1, Math.max(skyL * ambientDayFactor, blkL));
      const warmBoost = blkL > skyL * ambientDayFactor ? 0.12 * blkL : 0;

      const boxFaces: Array<{
        pts: Array<[number, number, number]>;
        norm: [number, number, number];
        uvTile: [number, number];
        shade: number;
      }> = [
        { pts: [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], norm: [0, 1, 0], uvTile: topUv, shade: 1.0 },
        { pts: [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], norm: [0, -1, 0], uvTile: bottomUv, shade: 0.56 },
        { pts: [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], norm: [1, 0, 0], uvTile: sideUv, shade: 0.84 },
        { pts: [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], norm: [-1, 0, 0], uvTile: sideUv, shade: 0.84 },
        { pts: [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], norm: [0, 0, 1], uvTile: sideUv, shade: 0.78 },
        { pts: [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], norm: [0, 0, -1], uvTile: sideUv, shade: 0.76 },
      ];

      for (const bf of boxFaces) {
        const [tx, ty] = bf.uvTile;
        const u0 = tx * tileStep + uvPad;
        const u1 = (tx + 1) * tileStep - uvPad;
        const v0 = 1 - (ty + 1) * tileStep + uvPad;
        const v1 = 1 - ty * tileStep - uvPad;
        const finalBr = Math.min(1.0, combined * bf.shade);
        const cr = Math.min(1, finalBr + warmBoost * 0.5);
        const cg = Math.min(1, finalBr + warmBoost * 0.15);
        const cb = Math.max(0.05, finalBr - warmBoost * 0.35);

        const base = b.vertexCount;
        const qUvs: Array<[number, number]> = [
          [u0, v0],
          [u1, v0],
          [u1, v1],
          [u0, v1],
        ];
        for (let i = 0; i < 4; i++) {
          b.positions.push(bf.pts[i][0], bf.pts[i][1], bf.pts[i][2]);
          b.normals.push(bf.norm[0], bf.norm[1], bf.norm[2]);
          b.uvs.push(qUvs[i][0], qUvs[i][1]);
          b.colors.push(cr, cg, cb);
          b.lightData.push(skyL, blkL, bf.shade);
        }
        b.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
        b.vertexCount += 4;
      }
    };

    for (let y = 0; y < CHUNK_HEIGHT; y++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const wz = baseZ + lz;
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          const id = chunk.blocks[getIndex(lx, y, lz)];
          if (id === BLOCK_IDS.AIR) continue;

          const def = BLOCKS[id];
          if (!def) continue;

          if (id === BLOCK_IDS.TORCH || def.isSoulTorch) {
            pushTorch(
              opaque,
              lx,
              y,
              lz,
              def.uvs.side,
              def.isSoulTorch ? [0.76, 0.97, 1.0] : [1.0, 0.96, 0.85]
            );
            continue;
          }

          const wx = baseX + lx;
          if (def.crossMesh) {
            pushCrossMesh(cross, lx, y, lz, wx, wz, def.uvs.side, id === BLOCK_IDS.FIRE);
            continue;
          }

          if (def.isHalfHeight) {
            const isBed = id === BLOCK_IDS.BED;
            pushCustomBox(
              opaque,
              isBed ? lx + 0.02 : lx,
              y,
              isBed ? lz + 0.02 : lz,
              isBed ? lx + 0.98 : lx + 1,
              y + (isBed ? 0.55 : 0.5),
              isBed ? lz + 0.98 : lz + 1,
              wx,
              y + 1,
              wz,
              def.uvs.top,
              def.uvs.side,
              def.uvs.bottom
            );
            continue;
          }

          if (def.isLantern) {
            // Glowing hanging/standing lantern body + iron cap
            pushCustomBox(
              opaque,
              lx + 0.31,
              y + 0.02,
              lz + 0.31,
              lx + 0.69,
              y + 0.58,
              lz + 0.69,
              wx,
              y,
              wz,
              def.uvs.top,
              def.uvs.side,
              def.uvs.bottom
            );
            pushCustomBox(
              opaque,
              lx + 0.38,
              y + 0.58,
              lz + 0.38,
              lx + 0.62,
              y + 0.72,
              lz + 0.62,
              wx,
              y,
              wz,
              def.uvs.top,
              def.uvs.side,
              def.uvs.bottom
            );
            continue;
          }

          if (def.isLadder) {
            // Thin climbable panel snapped against adjacent solid wall (or default -Z wall)
            const northSolid = BLOCKS[world.getBlock(wx, y, wz - 1)]?.solid;
            const southSolid = BLOCKS[world.getBlock(wx, y, wz + 1)]?.solid;
            const westSolid = BLOCKS[world.getBlock(wx - 1, y, wz)]?.solid;
            const eastSolid = BLOCKS[world.getBlock(wx + 1, y, wz)]?.solid;
            if (southSolid && !northSolid) {
              pushCustomBox(transparent, lx + 0.04, y, lz + 0.88, lx + 0.96, y + 1, lz + 0.98, wx, y, wz, def.uvs.top, def.uvs.side, def.uvs.bottom);
            } else if (westSolid && !northSolid) {
              pushCustomBox(transparent, lx + 0.02, y, lz + 0.04, lx + 0.12, y + 1, lz + 0.96, wx, y, wz, def.uvs.top, def.uvs.side, def.uvs.bottom);
            } else if (eastSolid && !northSolid) {
              pushCustomBox(transparent, lx + 0.88, y, lz + 0.04, lx + 0.98, y + 1, lz + 0.96, wx, y, wz, def.uvs.top, def.uvs.side, def.uvs.bottom);
            } else {
              pushCustomBox(transparent, lx + 0.04, y, lz + 0.02, lx + 0.96, y + 1, lz + 0.12, wx, y, wz, def.uvs.top, def.uvs.side, def.uvs.bottom);
            }
            continue;
          }

          if (def.isFence || def.isWall) {
            const postHalf = def.isWall ? 0.25 : 0.125;
            const connects = (nx: number, nz: number): boolean => {
              const nid = world.getBlock(nx, y, nz);
              const nd = BLOCKS[nid];
              return Boolean(nd && (nd.isFence || nd.isWall || (nd.solid && !nd.transparent)));
            };
            // Center post
            pushCustomBox(
              opaque,
              lx + 0.5 - postHalf,
              y,
              lz + 0.5 - postHalf,
              lx + 0.5 + postHalf,
              y + 1,
              lz + 0.5 + postHalf,
              wx,
              y + 1,
              wz,
              def.uvs.top,
              def.uvs.side,
              def.uvs.bottom
            );
            const railY0 = def.isWall ? y : y + 0.35;
            const railY1 = def.isWall ? y + 0.82 : y + 0.52;
            const railHalf = def.isWall ? 0.18 : 0.07;
            const addBars = (x0: number, z0: number, x1: number, z1: number) => {
              pushCustomBox(opaque, x0, railY0, z0, x1, railY1, z1, wx, y + 1, wz, def.uvs.top, def.uvs.side, def.uvs.bottom);
              if (def.isFence) {
                pushCustomBox(opaque, x0, y + 0.72, z0, x1, y + 0.88, z1, wx, y + 1, wz, def.uvs.top, def.uvs.side, def.uvs.bottom);
              }
            };
            if (connects(wx + 1, wz)) addBars(lx + 0.5, lz + 0.5 - railHalf, lx + 1, lz + 0.5 + railHalf);
            if (connects(wx - 1, wz)) addBars(lx, lz + 0.5 - railHalf, lx + 0.5, lz + 0.5 + railHalf);
            if (connects(wx, wz + 1)) addBars(lx + 0.5 - railHalf, lz + 0.5, lx + 0.5 + railHalf, lz + 1);
            if (connects(wx, wz - 1)) addBars(lx + 0.5 - railHalf, lz, lx + 0.5 + railHalf, lz + 0.5);
            continue;
          }

          if (def.isStairs) {
            // 2-tier stepped stair block
            pushCustomBox(
              opaque,
              lx,
              y,
              lz,
              lx + 1,
              y + 0.5,
              lz + 1,
              wx,
              y + 1,
              wz,
              def.uvs.top,
              def.uvs.side,
              def.uvs.bottom
            );
            pushCustomBox(
              opaque,
              lx,
              y + 0.5,
              lz,
              lx + 1,
              y + 1,
              lz + 0.5,
              wx,
              y + 1,
              wz,
              def.uvs.top,
              def.uvs.side,
              def.uvs.bottom
            );
            continue;
          }

          if (def.isDoor) {
            // Closed thin paneled door (blocks passage)
            pushCustomBox(
              transparent,
              lx,
              y,
              lz + 0.41,
              lx + 1,
              y + 1.95,
              lz + 0.59,
              wx,
              y + 1,
              wz,
              def.uvs.top,
              def.uvs.side,
              def.uvs.bottom
            );
            continue;
          }

          if (def.isDoorOpen) {
            // Open door swung 90 degrees flush against the -X doorway edge
            pushCustomBox(
              transparent,
              lx + 0.02,
              y,
              lz,
              lx + 0.18,
              y + 1.95,
              lz + 1,
              wx,
              y + 1,
              wz,
              def.uvs.top,
              def.uvs.side,
              def.uvs.bottom
            );
            continue;
          }

          if (def.isTrapdoor) {
            pushCustomBox(
              transparent,
              lx,
              y,
              lz,
              lx + 1,
              y + 0.18,
              lz + 1,
              wx,
              y + 1,
              wz,
              def.uvs.top,
              def.uvs.side,
              def.uvs.bottom
            );
            continue;
          }

          if (def.isTrapdoorOpen) {
            pushCustomBox(
              transparent,
              lx,
              y,
              lz + 0.82,
              lx + 1,
              y + 1,
              lz + 1,
              wx,
              y + 1,
              wz,
              def.uvs.top,
              def.uvs.side,
              def.uvs.bottom
            );
            continue;
          }

          if (def.isFenceGate) {
            // Side hinge posts + closed center gate bars
            pushCustomBox(opaque, lx, y + 0.15, lz + 0.42, lx + 0.14, y + 0.95, lz + 0.58, wx, y + 1, wz, def.uvs.top, def.uvs.side, def.uvs.bottom);
            pushCustomBox(opaque, lx + 0.86, y + 0.15, lz + 0.42, lx + 1, y + 0.95, lz + 0.58, wx, y + 1, wz, def.uvs.top, def.uvs.side, def.uvs.bottom);
            pushCustomBox(opaque, lx + 0.14, y + 0.34, lz + 0.45, lx + 0.86, y + 0.54, lz + 0.55, wx, y + 1, wz, def.uvs.top, def.uvs.side, def.uvs.bottom);
            pushCustomBox(opaque, lx + 0.14, y + 0.68, lz + 0.45, lx + 0.86, y + 0.88, lz + 0.55, wx, y + 1, wz, def.uvs.top, def.uvs.side, def.uvs.bottom);
            continue;
          }

          if (def.isFenceGateOpen) {
            // Two gate doors swung open outward along +/-Z
            pushCustomBox(opaque, lx, y + 0.15, lz + 0.42, lx + 0.14, y + 0.95, lz + 0.98, wx, y + 1, wz, def.uvs.top, def.uvs.side, def.uvs.bottom);
            pushCustomBox(opaque, lx + 0.86, y + 0.15, lz + 0.42, lx + 1, y + 0.95, lz + 0.98, wx, y + 1, wz, def.uvs.top, def.uvs.side, def.uvs.bottom);
            continue;
          }

          if (def.isIronBars) {
            const connectsBar = (nx: number, nz: number): boolean => {
              const nid = world.getBlock(nx, y, nz);
              const nd = BLOCKS[nid];
              return Boolean(nd && (nd.isIronBars || nd.isWall || (nd.solid && !nd.transparent)));
            };
            pushCustomBox(transparent, lx + 0.44, y, lz + 0.44, lx + 0.56, y + 1, lz + 0.56, wx, y, wz, def.uvs.top, def.uvs.side, def.uvs.bottom);
            if (connectsBar(wx + 1, wz)) pushCustomBox(transparent, lx + 0.5, y, lz + 0.45, lx + 1, y + 1, lz + 0.55, wx, y, wz, def.uvs.top, def.uvs.side, def.uvs.bottom);
            if (connectsBar(wx - 1, wz)) pushCustomBox(transparent, lx, y, lz + 0.45, lx + 0.5, y + 1, lz + 0.55, wx, y, wz, def.uvs.top, def.uvs.side, def.uvs.bottom);
            if (connectsBar(wx, wz + 1)) pushCustomBox(transparent, lx + 0.45, y, lz + 0.5, lx + 0.55, y + 1, lz + 1, wx, y, wz, def.uvs.top, def.uvs.side, def.uvs.bottom);
            if (connectsBar(wx, wz - 1)) pushCustomBox(transparent, lx + 0.45, y, lz, lx + 0.55, y + 1, lz + 0.5, wx, y, wz, def.uvs.top, def.uvs.side, def.uvs.bottom);
            continue;
          }

          if (def.isEnchantingTable) {
            // 0.75-height obsidian/crimson table + floating crimson-gold spellbook above
            pushCustomBox(opaque, lx, y, lz, lx + 1, y + 0.75, lz + 1, wx, y + 1, wz, def.uvs.top, def.uvs.side, def.uvs.bottom);
            pushCustomBox(opaque, lx + 0.3, y + 0.84, lz + 0.34, lx + 0.7, y + 0.94, lz + 0.66, wx, y + 1, wz, def.uvs.top, def.uvs.top, def.uvs.top);
            continue;
          }

          if (def.isAnvil) {
            // Stepped dark forged iron anvil silhouette
            pushCustomBox(opaque, lx + 0.14, y, lz + 0.14, lx + 0.86, y + 0.25, lz + 0.86, wx, y + 1, wz, def.uvs.top, def.uvs.side, def.uvs.bottom);
            pushCustomBox(opaque, lx + 0.28, y + 0.25, lz + 0.28, lx + 0.72, y + 0.62, lz + 0.72, wx, y + 1, wz, def.uvs.top, def.uvs.side, def.uvs.bottom);
            pushCustomBox(opaque, lx + 0.08, y + 0.62, lz + 0.18, lx + 0.92, y + 1.0, lz + 0.82, wx, y + 1, wz, def.uvs.top, def.uvs.side, def.uvs.bottom);
            continue;
          }

          if (def.isCampfire) {
            // Low crossed log hearth + bright roaring flame cross-mesh on top
            pushCustomBox(opaque, lx + 0.04, y, lz + 0.04, lx + 0.96, y + 0.34, lz + 0.96, wx, y + 1, wz, def.uvs.top, def.uvs.side, def.uvs.bottom);
            pushCrossMesh(cross, lx, y + 0.22, lz, wx, wz, BLOCKS[BLOCK_IDS.FIRE].uvs.side, true);
            continue;
          }

          const isWater = id === BLOCK_IDS.WATER;
          const isLava = id === BLOCK_IDS.LAVA;
          const isPortal = id === BLOCK_IDS.NETHER_PORTAL;
          const isGlassLike = Boolean(def.isStainedGlass);
          const isGlowstone =
            id === BLOCK_IDS.GLOWSTONE ||
            id === BLOCK_IDS.SEA_LANTERN ||
            id === BLOCK_IDS.REDSTONE_LAMP ||
            id === BLOCK_IDS.JACK_O_LANTERN;
          const isMagma = id === BLOCK_IDS.MAGMA_BLOCK;
          // Lava renders in opaque pass (bright viscous molten surface); Portal renders in transparent pass
          const target = def.transparent && !isLava ? transparent : opaque;

          for (let f = 0; f < 6; f++) {
            const face = FACES[f];
            const [dx, dy, dz] = face.dir;
            const nwx = wx + dx;
            const nwy = y + dy;
            const nwz = wz + dz;
            const neighborId = world.getBlock(nwx, nwy, nwz);
            const neighborDef = BLOCKS[neighborId];

            if (isWater) {
              if (neighborId === BLOCK_IDS.WATER) continue;
              if (neighborDef && neighborDef.solid && !neighborDef.transparent) continue;
            } else if (isLava) {
              if (neighborId === BLOCK_IDS.LAVA) continue;
              if (neighborDef && neighborDef.solid && !neighborDef.transparent) continue;
            } else if (isPortal) {
              if (neighborId === BLOCK_IDS.NETHER_PORTAL) continue;
              if (neighborDef && neighborDef.solid && !neighborDef.transparent) continue;
            } else if (isGlassLike) {
              if (neighborId === id) continue;
              if (neighborDef && neighborDef.solid && !neighborDef.transparent) continue;
            } else if (!def.transparent) {
              if (neighborDef && !neighborDef.transparent) continue;
            } else {
              if (neighborDef && !neighborDef.transparent) continue;
            }

            const selfEmissive = isLava || isGlowstone || isPortal;
            const skyL = selfEmissive ? 0 : world.getSkyLight(nwx, nwy, nwz) / 15;
            const rawBlkL = world.getBlockLight(nwx, nwy, nwz) / 15;
            const blkL = selfEmissive ? 1.0 : isMagma ? Math.max(0.65, rawBlkL) : rawBlkL;
            const combinedLight = selfEmissive
              ? 1.0
              : Math.max(minAmbient, Math.max(skyL * ambientDayFactor, blkL));

            const uvPair =
              face.uvKey === 'front'
                ? def.uvs.front ?? def.uvs.side
                : def.uvs[face.uvKey];
            const [tx, ty] = uvPair;
            const u0 = tx * tileStep + uvPad;
            const u1 = (tx + 1) * tileStep - uvPad;
            const v0 = 1 - (ty + 1) * tileStep + uvPad;
            const v1 = 1 - ty * tileStep - uvPad;

            const base = target.vertexCount;
            const aoVals: number[] = [1, 1, 1, 1];

            for (let c = 0; c < 4; c++) {
              const corner = face.corners[c];
              let py = y + corner.pos[1];
              // Lower liquid top surfaces when above is Air; Dirt Path lowered by -0.06
              if (isWater && corner.pos[1] === 1 && world.getBlock(wx, y + 1, wz) === BLOCK_IDS.AIR) {
                py -= 0.12;
              } else if (isLava && corner.pos[1] === 1 && world.getBlock(wx, y + 1, wz) === BLOCK_IDS.AIR) {
                py -= 0.1;
              } else if (def.isPath && corner.pos[1] === 1) {
                py -= 0.06;
              }

              let ao = 1.0;
              if (!isWater && !selfEmissive) {
                const s1 = isOccluder(
                  wx + corner.aoSide1[0],
                  y + corner.aoSide1[1],
                  wz + corner.aoSide1[2]
                )
                  ? 1
                  : 0;
                const s2 = isOccluder(
                  wx + corner.aoSide2[0],
                  y + corner.aoSide2[1],
                  wz + corner.aoSide2[2]
                )
                  ? 1
                  : 0;
                const cn = isOccluder(
                  wx + corner.aoCorner[0],
                  y + corner.aoCorner[1],
                  wz + corner.aoCorner[2]
                )
                  ? 1
                  : 0;
                const occCount = s1 && s2 ? 3 : s1 + s2 + cn;
                ao = AO_TABLE[occCount];
              }
              aoVals[c] = ao;

              const aoShade = selfEmissive ? 1.0 : ao * face.shade;
              const finalBr = Math.min(1.0, combinedLight * aoShade);
              const warmBoost = isPortal ? 0 : blkL > skyL * ambientDayFactor ? 0.12 * blkL : 0;

              let cr = Math.min(1, finalBr + warmBoost * 0.5);
              let cg = Math.min(1, finalBr + warmBoost * 0.15);
              let cb = Math.max(0.05, finalBr - warmBoost * 0.35);

              if (isPortal) {
                cr = 0.98;
                cg = 0.56;
                cb = 1.0;
              } else if (isLava) {
                cr = 1.0;
                cg = 0.92;
                cb = 0.72;
              } else if (isNether && !isGlowstone) {
                cr = Math.min(1, cr * 1.08 + 0.05);
                cg = Math.min(1, cg * 0.88 + 0.01);
                cb = Math.max(0.04, cb * 0.78);
              }

              target.positions.push(lx + corner.pos[0], py, lz + corner.pos[2]);
              target.normals.push(dx, dy, dz);
              target.uvs.push(corner.uv[0] === 0 ? u0 : u1, corner.uv[1] === 0 ? v0 : v1);
              target.colors.push(cr, cg, cb);
              target.lightData.push(skyL, blkL, aoShade);
            }

            if (aoVals[0] + aoVals[2] > aoVals[1] + aoVals[3]) {
              target.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
            } else {
              target.indices.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
            }
            target.vertexCount += 4;
          }
        }
      }
    }

    const op = finalizeBuilder(opaque);
    const tr = finalizeBuilder(transparent);
    const cr = finalizeBuilder(cross);

    return {
      opaqueGeometry: op.geometry,
      transparentGeometry: tr.geometry,
      crossGeometry: cr.geometry,
      opaqueLightData: op.lightData,
      transparentLightData: tr.lightData,
      crossLightData: cr.lightData,
    };
  }

  public static relightGeometry(
    geometry: THREE.BufferGeometry | null,
    lightData: Float32Array | null,
    ambientDayFactor: number,
    isNether = false
  ): void {
    if (!geometry || !lightData) return;
    const colorAttr = geometry.getAttribute('color') as THREE.BufferAttribute | undefined;
    if (!colorAttr) return;
    const arr = colorAttr.array as Float32Array;
    const count = colorAttr.count;
    const minAmb = isNether ? 0.28 : 0.08;
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const skyL = lightData[i3];
      const blkL = lightData[i3 + 1];
      const aoShade = lightData[i3 + 2];
      const combined = Math.max(minAmb, Math.max(skyL * ambientDayFactor, blkL));
      const finalBr = Math.min(1.0, combined * aoShade);
      const warmBoost = blkL > skyL * ambientDayFactor ? 0.12 * blkL : 0;
      let cr = Math.min(1, finalBr + warmBoost * 0.5);
      let cg = Math.min(1, finalBr + warmBoost * 0.15);
      let cb = Math.max(0.05, finalBr - warmBoost * 0.35);
      if (isNether) {
        cr = Math.min(1, cr * 1.08 + 0.05);
        cg = Math.min(1, cg * 0.88 + 0.01);
        cb = Math.max(0.04, cb * 0.78);
      }
      arr[i3] = cr;
      arr[i3 + 1] = cg;
      arr[i3 + 2] = cb;
    }
    colorAttr.needsUpdate = true;
  }
}
