import * as THREE from 'three';
import { BLOCK_IDS, BLOCKS, COLOR_PALETTE, ITEMS } from './blocks';
import type { ItemId } from './types';

export const ATLAS_SIZE = 512;
export const TILE_SIZE = 16;
export const TILES_PER_ROW = 32;

function seededRand(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = Math.imul(s ^ (s >>> 15), s | 1);
    s ^= s + Math.imul(s ^ (s >>> 7), s | 61);
    return ((s ^ (s >>> 14)) >>> 0) / 4294967296;
  };
}

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function rgb(r: number, g: number, b: number, a = 1): string {
  return a >= 1
    ? `rgb(${clampByte(r)},${clampByte(g)},${clampByte(b)})`
    : `rgba(${clampByte(r)},${clampByte(g)},${clampByte(b)},${a.toFixed(2)})`;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const n = parseInt(clean, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Generates a 512x512 procedural pixel-art Texture Atlas (32x32 tiles of 16x16 px = 1,024 slots),
 * crack stage textures (0..9), DataURL item/block icons for React UI, and mob textures.
 */
export class TextureAtlasGenerator {
  public readonly canvas: HTMLCanvasElement;
  public readonly texture: THREE.CanvasTexture;
  public readonly crackTextures: THREE.CanvasTexture[] = [];
  public readonly iconDataUrls: Record<string, string> = {};

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = ATLAS_SIZE;
    this.canvas.height = ATLAS_SIZE;
    const ctx = this.canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);

    this.drawAllBlockTiles(ctx);

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.generateMipmaps = false;
    this.texture.needsUpdate = true;

    this.generateCrackTextures();
    this.generateAllItemIcons();
  }

  private drawTile(
    ctx: CanvasRenderingContext2D,
    tx: number,
    ty: number,
    painter: (p: (x: number, y: number, color: string) => void, rand: () => number) => void
  ): void {
    const ox = tx * TILE_SIZE;
    const oy = ty * TILE_SIZE;
    const rand = seededRand(tx * 73856093 ^ ty * 19349663 ^ 1337);
    const put = (x: number, y: number, color: string) => {
      if (x < 0 || x >= 16 || y < 0 || y >= 16) return;
      ctx.fillStyle = color;
      ctx.fillRect(ox + x, oy + y, 1, 1);
    };
    painter(put, rand);
  }

  private drawAllBlockTiles(ctx: CanvasRenderingContext2D): void {
    // (1,0) Stone
    this.drawTile(ctx, 1, 0, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          let v = 128 + (rand() - 0.5) * 28;
          if ((y % 4 === 0 && (x + y) % 5 === 0) || rand() < 0.08) v -= 18;
          if (rand() < 0.07) v += 16;
          p(x, y, rgb(v, v + 1, v + 3));
        }
      }
    });

    // (2,0) Dirt
    this.drawTile(ctx, 2, 0, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const n = (rand() - 0.5) * 26;
          const pebble = rand() < 0.07 ? 20 : 0;
          p(x, y, rgb(134 + n + pebble, 96 + n * 0.8 + pebble, 67 + n * 0.7 + pebble));
        }
      }
    });

    // (3,0) Grass Top
    this.drawTile(ctx, 3, 0, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const n = (rand() - 0.5) * 32;
          const blade = (x + y * 3) % 7 === 0 ? 14 : 0;
          p(x, y, rgb(88 + n * 0.7 + blade * 0.5, 152 + n + blade, 58 + n * 0.6));
        }
      }
    });

    // (4,0) Grass Side (green overhang over dirt)
    this.drawTile(ctx, 4, 0, (p, rand) => {
      const overhang = [3, 4, 3, 5, 4, 3, 4, 6, 4, 3, 5, 4, 3, 4, 5, 3];
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const n = (rand() - 0.5) * 26;
          if (y < overhang[x]) {
            const shade = y === overhang[x] - 1 ? -16 : 0;
            p(x, y, rgb(86 + n * 0.7 + shade, 148 + n + shade, 56 + n * 0.5 + shade));
          } else {
            const topShadow = y === overhang[x] ? -18 : 0;
            p(x, y, rgb(134 + n + topShadow, 96 + n * 0.8 + topShadow, 67 + n * 0.6 + topShadow));
          }
        }
      }
    });

    // (5,0) Sand
    this.drawTile(ctx, 5, 0, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const ripple = Math.sin((x + y * 0.6) * 0.7) * 6;
          const n = (rand() - 0.5) * 18 + ripple;
          p(x, y, rgb(222 + n, 207 + n, 154 + n * 0.8));
        }
      }
    });

    // (6,0) Water (semi-translucent shimmering blue)
    this.drawTile(ctx, 6, 0, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const wave = Math.sin((x * 0.8 + y * 0.5)) * 12;
          const n = (rand() - 0.5) * 12 + wave;
          const foam = (y % 5 === 1 && x % 6 < 3) ? 24 : 0;
          p(x, y, rgb(42 + n * 0.4 + foam, 118 + n * 0.7 + foam, 208 + n * 0.5 + foam, 0.82));
        }
      }
    });

    // (7,0) Oak Log Top (concentric wood rings)
    this.drawTile(ctx, 7, 0, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const isBark = x === 0 || x === 15 || y === 0 || y === 15;
          const n = (rand() - 0.5) * 16;
          if (isBark) {
            p(x, y, rgb(92 + n, 68 + n * 0.8, 42 + n * 0.7));
          } else {
            const d = Math.hypot(x - 7.5, y - 7.5);
            const ring = Math.floor(d) % 2 === 0 ? -12 : 10;
            p(x, y, rgb(172 + ring + n, 136 + ring + n * 0.8, 86 + ring * 0.8 + n * 0.6));
          }
        }
      }
    });

    // (8,0) Oak Log Side (vertical bark streaks)
    this.drawTile(ctx, 8, 0, (p, rand) => {
      for (let x = 0; x < 16; x++) {
        const colTone = (x % 3 === 0 ? -14 : x % 3 === 1 ? 8 : 0);
        for (let y = 0; y < 16; y++) {
          const furrow = ((x * 5 + y) % 11 === 0) ? -18 : 0;
          const n = (rand() - 0.5) * 16;
          p(x, y, rgb(104 + colTone + furrow + n, 78 + colTone * 0.8 + furrow + n * 0.8, 48 + colTone * 0.6 + n * 0.6));
        }
      }
    });

    // (9,0) Oak Leaves (cutout alpha gaps + layered green foliage)
    this.drawTile(ctx, 9, 0, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const hole = rand() < 0.22 && !((x === 0 || x === 15) && (y === 0 || y === 15));
          if (hole) continue; // transparent pixel
          const n = (rand() - 0.5) * 34;
          const highlight = ((x + y) % 4 === 0) ? 16 : -6;
          p(x, y, rgb(52 + n * 0.6 + highlight * 0.4, 122 + n + highlight, 38 + n * 0.5));
        }
      }
    });

    // (10,0) Oak Planks (horizontal wooden boards with seams)
    this.drawTile(ctx, 10, 0, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        const board = Math.floor(y / 4);
        const isSeamY = y % 4 === 0;
        const seamX = (board * 7 + 4) % 16;
        for (let x = 0; x < 16; x++) {
          const n = (rand() - 0.5) * 14;
          const grain = ((x + board * 3) % 5 === 0) ? -8 : 4;
          if (isSeamY || x === seamX) {
            p(x, y, rgb(118 + n * 0.6, 86 + n * 0.5, 48 + n * 0.4));
          } else {
            p(x, y, rgb(184 + grain + n, 144 + grain + n * 0.8, 86 + grain * 0.7 + n * 0.6));
          }
        }
      }
    });

    // (11,0) Crafting Table Top (3x3 grid lines on warm wood)
    this.drawTile(ctx, 11, 0, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const border = x === 0 || x === 15 || y === 0 || y === 15;
          const grid = x === 5 || x === 10 || y === 5 || y === 10;
          const n = (rand() - 0.5) * 12;
          if (border) {
            p(x, y, rgb(108 + n, 72 + n * 0.8, 38 + n * 0.6));
          } else if (grid) {
            p(x, y, rgb(76 + n * 0.5, 50 + n * 0.5, 28 + n * 0.5));
          } else {
            p(x, y, rgb(174 + n, 128 + n * 0.8, 72 + n * 0.6));
          }
        }
      }
    });

    // (12,0) Crafting Table Side (wood paneling + iron saw/hammer details)
    this.drawTile(ctx, 12, 0, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const n = (rand() - 0.5) * 14;
          if (y < 3) {
            p(x, y, rgb(116 + n, 78 + n * 0.8, 42 + n * 0.6));
          } else if (x === 0 || x === 15 || y === 15) {
            p(x, y, rgb(104 + n, 70 + n * 0.8, 38 + n * 0.6));
          } else {
            p(x, y, rgb(166 + n, 122 + n * 0.8, 68 + n * 0.6));
          }
        }
      }
      // Draw small silver saw & hammer silhouettes on the side
      for (let y = 5; y <= 11; y++) {
        p(4, y, '#c8d0d8');
        p(5, y, '#8e969f');
      }
      p(4, 12, '#694423');
      p(5, 12, '#694423');
      for (let x = 9; x <= 12; x++) p(x, 6, '#b8c0c8');
      for (let y = 7; y <= 12; y++) p(10, y, '#734a26');
    });

    // (13,0) Furnace Top (smooth stone slab with dark border)
    this.drawTile(ctx, 13, 0, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const border = x === 0 || x === 15 || y === 0 || y === 15;
          const n = (rand() - 0.5) * 18;
          const v = border ? 86 + n : 138 + n;
          p(x, y, rgb(v, v, v + 2));
        }
      }
    });

    // (14,0) Furnace Front/Side (stone masonry + dark firebox opening & ember glow)
    this.drawTile(ctx, 14, 0, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const n = (rand() - 0.5) * 20;
          const seam = y === 0 || y === 5 || y === 15 || x === 0 || x === 15;
          const v = seam ? 78 + n : 124 + n;
          p(x, y, rgb(v, v, v + 2));
        }
      }
      // Upper grill opening
      for (let y = 2; y <= 4; y++) {
        for (let x = 3; x <= 12; x++) {
          p(x, y, x % 2 === 0 ? '#2b2b2e' : '#1b1b1d');
        }
      }
      // Lower firebox with warm glowing coals
      for (let y = 8; y <= 13; y++) {
        for (let x = 3; x <= 12; x++) {
          if (y >= 11 && x >= 4 && x <= 11) {
            p(x, y, (x + y) % 2 === 0 ? '#ff8b24' : '#d64515');
          } else {
            p(x, y, '#1d1c20');
          }
        }
      }
    });

    // (15,0) Coal Ore (stone with dark coal flecks)
    this.drawTile(ctx, 15, 0, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const v = 126 + (rand() - 0.5) * 26;
          p(x, y, rgb(v, v, v + 2));
        }
      }
      const flecks = [
        [3, 3], [4, 3], [4, 4], [10, 4], [11, 4], [11, 5],
        [6, 8], [7, 8], [7, 9], [8, 9], [12, 11], [13, 11], [12, 12],
        [3, 12], [4, 12], [4, 13],
      ];
      for (const [fx, fy] of flecks) {
        p(fx, fy, '#242529');
        p(fx + 1, fy, '#3a3b42');
      }
    });

    // (0,1) Iron Ore (stone with peach/tan metallic flecks)
    this.drawTile(ctx, 0, 1, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const v = 126 + (rand() - 0.5) * 26;
          p(x, y, rgb(v, v, v + 2));
        }
      }
      const flecks = [
        [2, 4], [3, 4], [3, 5], [9, 3], [10, 3], [10, 4],
        [6, 7], [7, 7], [7, 8], [11, 10], [12, 10], [12, 11],
        [4, 12], [5, 12], [5, 13],
      ];
      for (const [fx, fy] of flecks) {
        p(fx, fy, '#d8af91');
        p(fx + 1, fy, '#b58465');
      }
    });

    // (1,1) Bedrock (high-contrast dark indestructible rock)
    this.drawTile(ctx, 1, 1, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const r = rand();
          const v = r < 0.3 ? 32 : r < 0.65 ? 58 : r < 0.88 ? 84 : 112;
          p(x, y, rgb(v, v, v + 2));
        }
      }
    });

    // (2,1) Glass (transparent center, crisp pale cyan frame + diagonal glint)
    this.drawTile(ctx, 2, 1, (p) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const border = x === 0 || x === 15 || y === 0 || y === 15;
          const glint = (x === 3 && y === 3) || (x === 4 && y === 2) || (x === 2 && y === 4) ||
            (x === 11 && y === 12) || (x === 12 && y === 11);
          if (border) {
            p(x, y, 'rgba(198, 232, 240, 0.92)');
          } else if (glint) {
            p(x, y, 'rgba(255, 255, 255, 0.85)');
          } else {
            p(x, y, 'rgba(190, 235, 248, 0.14)');
          }
        }
      }
    });

    // (3,1) Torch (wooden stick + fiery ember tip)
    this.drawTile(ctx, 3, 1, (p) => {
      for (let y = 6; y < 16; y++) {
        p(7, y, '#8a6236');
        p(8, y, '#6b4924');
      }
      // Flame / ember head
      p(7, 5, '#ff8811');
      p(8, 5, '#e85d0c');
      p(7, 4, '#ffd93d');
      p(8, 4, '#ffae19');
      p(7, 3, '#fff6a1');
      p(8, 3, '#ffd93d');
    });

    // (4,1) Cobblestone (chunky interlocking stone blocks)
    this.drawTile(ctx, 4, 1, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const mortar =
            y === 0 || y === 5 || y === 10 || y === 15 ||
            (y < 5 && (x === 0 || x === 8)) ||
            (y >= 5 && y < 10 && (x === 4 || x === 12)) ||
            (y >= 10 && (x === 2 || x === 9));
          const n = (rand() - 0.5) * 28;
          const v = mortar ? 74 + n * 0.4 : 134 + n;
          p(x, y, rgb(v, v, v + 2));
        }
      }
    });

    // (5,1) Gold Ore (stone with gleaming gold nuggets)
    this.drawTile(ctx, 5, 1, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const v = 124 + (rand() - 0.5) * 24;
          p(x, y, rgb(v, v, v + 2));
        }
      }
      const flecks = [
        [3, 3], [4, 3], [4, 4], [10, 3], [11, 3], [11, 4],
        [6, 7], [7, 7], [7, 8], [11, 10], [12, 10], [12, 11],
        [3, 11], [4, 11], [4, 12],
      ];
      for (const [fx, fy] of flecks) {
        p(fx, fy, '#ffe359');
        p(fx + 1, fy, '#d9a422');
      }
    });

    // (6,1) Diamond Ore (stone with bright cyan crystal flecks)
    this.drawTile(ctx, 6, 1, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const v = 120 + (rand() - 0.5) * 24;
          p(x, y, rgb(v, v, v + 3));
        }
      }
      const flecks = [
        [2, 3], [3, 3], [3, 4], [10, 4], [11, 4], [10, 5],
        [6, 8], [7, 8], [6, 9], [11, 11], [12, 11], [12, 12],
        [3, 12], [4, 12],
      ];
      for (const [fx, fy] of flecks) {
        p(fx, fy, '#72f7ff');
        p(fx + 1, fy, '#28b8c9');
      }
    });

    // (7,1) Snow Block / Snow Top (crisp bright winter snow with icy blue grain)
    this.drawTile(ctx, 7, 1, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const n = (rand() - 0.5) * 14;
          const glint = rand() < 0.08 ? 10 : 0;
          p(x, y, rgb(236 + n * 0.5 + glint, 244 + n * 0.4 + glint, 252 + n * 0.3));
        }
      }
    });

    // (8,1) Snow Grass Side (white snowy overhang over dirt)
    this.drawTile(ctx, 8, 1, (p, rand) => {
      const overhang = [4, 5, 4, 6, 5, 4, 5, 6, 4, 4, 5, 6, 4, 5, 4, 5];
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const n = (rand() - 0.5) * 22;
          if (y < overhang[x]) {
            const shade = y === overhang[x] - 1 ? -18 : 0;
            p(x, y, rgb(235 + n * 0.3 + shade, 243 + n * 0.3 + shade, 250 + shade));
          } else {
            const topShadow = y === overhang[x] ? -18 : 0;
            p(x, y, rgb(134 + n + topShadow, 96 + n * 0.8 + topShadow, 67 + n * 0.6 + topShadow));
          }
        }
      }
    });

    // (9,1) Tall Grass (transparent alpha background + lush diagonal grass blades)
    this.drawTile(ctx, 9, 1, (p, rand) => {
      const blades: Array<[number, number, number]> = [
        [2, 15, 7], [4, 15, 4], [5, 15, 9], [7, 15, 3],
        [9, 15, 6], [10, 15, 3], [12, 15, 5], [13, 15, 8],
      ];
      for (const [bx, botY, topY] of blades) {
        let cx = bx;
        for (let y = botY; y >= topY; y--) {
          if (y < botY - 3 && rand() < 0.35) {
            cx += bx < 8 ? -1 : 1;
          }
          const t = (botY - y) / Math.max(1, botY - topY);
          p(cx, y, rgb(58 + t * 38, 128 + t * 52, 34 + t * 22));
          if (y > topY + 2) {
            p(cx + (bx < 8 ? 1 : -1), y, rgb(44 + t * 26, 102 + t * 40, 28 + t * 14));
          }
        }
      }
    });

    // (10,1) Red Flower (Poppy: green stem + leaves + vibrant crimson blossom)
    this.drawTile(ctx, 10, 1, (p) => {
      // Stem
      for (let y = 8; y < 16; y++) {
        p(7, y, '#3e8c2e');
        p(8, y, '#2c6b20');
      }
      // Side leaves
      p(6, 12, '#4ba837');
      p(5, 11, '#58bd42');
      p(9, 11, '#3e8c2e');
      p(10, 10, '#4ba837');
      // Red poppy petals
      const petals = [
        [6, 4], [7, 4], [8, 4], [9, 4],
        [5, 5], [6, 5], [7, 5], [8, 5], [9, 5], [10, 5],
        [5, 6], [6, 6], [7, 6], [8, 6], [9, 6], [10, 6],
        [6, 7], [7, 7], [8, 7], [9, 7],
      ];
      for (const [x, y] of petals) {
        const hi = y <= 5 && x >= 6 && x <= 8;
        p(x, y, hi ? '#ff4d4d' : '#d62424');
      }
      // Dark center
      p(7, 6, '#381212');
      p(8, 6, '#260a0a');
    });

    // (11,1) Chest Top/Bottom (framed dark oak lid with warm wood planks)
    this.drawTile(ctx, 11, 1, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const border = x === 0 || x === 15 || y === 0 || y === 15;
          const trim = x === 1 || x === 14 || y === 1 || y === 14;
          const n = (rand() - 0.5) * 14;
          if (border) {
            p(x, y, rgb(66 + n * 0.4, 44 + n * 0.4, 22 + n * 0.3));
          } else if (trim) {
            p(x, y, rgb(124 + n * 0.5, 84 + n * 0.5, 38 + n * 0.4));
          } else {
            const seam = y % 4 === 0 ? -14 : 0;
            p(x, y, rgb(168 + seam + n, 118 + seam * 0.8 + n * 0.8, 54 + seam * 0.5 + n * 0.5));
          }
        }
      }
    });

    // (12,1) Chest Front (framed oak planks + horizontal lid seam + silver/gold clasp lock)
    this.drawTile(ctx, 12, 1, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const border = x === 0 || x === 15 || y === 0 || y === 15;
          const lidLine = y === 5;
          const n = (rand() - 0.5) * 14;
          if (border || lidLine) {
            p(x, y, rgb(62 + n * 0.3, 42 + n * 0.3, 20 + n * 0.3));
          } else {
            const grain = (x % 4 === 0) ? -10 : 0;
            p(x, y, rgb(164 + grain + n, 114 + grain * 0.8 + n * 0.8, 50 + grain * 0.5 + n * 0.5));
          }
        }
      }
      // Metallic latch clasp centered across lid seam
      for (let y = 4; y <= 8; y++) {
        for (let x = 6; x <= 9; x++) {
          const rim = x === 6 || x === 9 || y === 4 || y === 8;
          p(x, y, rim ? '#6e7378' : y <= 6 ? '#eceff2' : '#c2c8cf');
        }
      }
      p(7, 6, '#3a3d42');
      p(8, 6, '#3a3d42');
    });

    // (13,1) Chest Side (framed oak planks + horizontal lid seam)
    this.drawTile(ctx, 13, 1, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const border = x === 0 || x === 15 || y === 0 || y === 15;
          const lidLine = y === 5;
          const n = (rand() - 0.5) * 14;
          if (border || lidLine) {
            p(x, y, rgb(62 + n * 0.3, 42 + n * 0.3, 20 + n * 0.3));
          } else {
            const grain = (x % 4 === 0) ? -10 : 0;
            p(x, y, rgb(160 + grain + n, 110 + grain * 0.8 + n * 0.8, 48 + grain * 0.5 + n * 0.5));
          }
        }
      }
    });

    // (14,1) Bricks (terracotta red bricks with crisp light gray mortar)
    this.drawTile(ctx, 14, 1, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        const row = Math.floor(y / 4);
        const isMortarY = y % 4 === 0;
        const offsetX = (row % 2) * 4;
        for (let x = 0; x < 16; x++) {
          const isMortarX = (x + offsetX) % 8 === 0;
          const n = (rand() - 0.5) * 20;
          if (isMortarY || isMortarX) {
            const m = 186 + n * 0.5;
            p(x, y, rgb(m, m - 2, m - 4));
          } else {
            const shade = y % 4 === 1 ? 14 : y % 4 === 3 ? -14 : 0;
            p(x, y, rgb(166 + shade + n, 76 + shade * 0.5 + n * 0.6, 58 + shade * 0.4 + n * 0.5));
          }
        }
      }
    });

    // (15,1) Oak Sapling (tiny young oak tree cross-mesh sprite)
    this.drawTile(ctx, 15, 1, (p, rand) => {
      // Tiny wooden trunk
      for (let y = 9; y < 16; y++) {
        p(7, y, '#7c5832');
        p(8, y, '#5c3e1f');
      }
      // Small leafy crown
      for (let y = 3; y <= 10; y++) {
        for (let x = 3; x <= 12; x++) {
          const d = Math.hypot(x - 7.5, y - 6.5);
          if (d <= 4.3 && rand() > 0.16) {
            const hi = y <= 5 ? 18 : 0;
            p(x, y, rgb(52 + hi * 0.6, 134 + hi, 38 + hi * 0.4));
          }
        }
      }
    });

    // (0,2) White Wool (soft woven off-white fabric pixels)
    this.drawTile(ctx, 0, 2, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const weave = ((x + y) % 2 === 0 ? 5 : -5);
          const n = (rand() - 0.5) * 12 + weave;
          p(x, y, rgb(235 + n, 236 + n, 238 + n));
        }
      }
    });

    // (1,2) Sandstone Top/Bottom (smooth carved sandstone surface)
    this.drawTile(ctx, 1, 2, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const border = x === 0 || x === 15 || y === 0 || y === 15 ? -10 : 0;
          const n = (rand() - 0.5) * 16 + border;
          p(x, y, rgb(224 + n, 206 + n * 0.9, 150 + n * 0.7));
        }
      }
    });

    // (2,2) Sandstone Side (smooth top band + layered sedimentary strata)
    this.drawTile(ctx, 2, 2, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        const band = y < 3 ? 12 : y === 3 || y === 11 ? -16 : y % 4 === 0 ? -7 : 0;
        for (let x = 0; x < 16; x++) {
          const n = (rand() - 0.5) * 16;
          p(x, y, rgb(220 + band + n, 200 + band + n * 0.9, 144 + band * 0.7 + n * 0.7));
        }
      }
    });

    // (3,2) Chiseled Sandstone (desert temple carved hieroglyph emblem)
    this.drawTile(ctx, 3, 2, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const frame = x === 0 || x === 15 || y === 0 || y === 15 || x === 2 || x === 13 || y === 2 || y === 13;
          const n = (rand() - 0.5) * 14;
          const shade = frame ? -20 : 6;
          p(x, y, rgb(218 + shade + n, 196 + shade + n * 0.85, 138 + shade * 0.7 + n * 0.7));
        }
      }
      // Carved inner sun/face motif
      const glyph = [
        [5, 5], [6, 5], [9, 5], [10, 5],
        [5, 6], [6, 6], [9, 6], [10, 6],
        [7, 7], [8, 7],
        [6, 8], [7, 8], [8, 8], [9, 8],
        [6, 9], [9, 9],
        [5, 10], [6, 10], [9, 10], [10, 10],
      ];
      for (const [gx, gy] of glyph) {
        p(gx, gy, '#8f7946');
      }
    });

    // (4,2) Mossy Cobblestone (cobblestone interwoven with deep forest moss)
    this.drawTile(ctx, 4, 2, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const mortar =
            y === 0 || y === 5 || y === 10 || y === 15 ||
            (y < 5 && (x === 0 || x === 8)) ||
            (y >= 5 && y < 10 && (x === 4 || x === 12)) ||
            (y >= 10 && (x === 2 || x === 9));
          const mossPatch = ((x * 7 + y * 13) % 11 < 4 && (mortar || rand() < 0.65));
          const n = (rand() - 0.5) * 26;
          if (mossPatch) {
            p(x, y, rgb(64 + n * 0.6, 114 + n * 0.9, 52 + n * 0.5));
          } else {
            const v = mortar ? 72 + n * 0.4 : 130 + n;
            p(x, y, rgb(v, v, v + 2));
          }
        }
      }
    });

    // (5,2) Oak Door (classic paneled oak wood door with top window cutouts & iron handle)
    this.drawTile(ctx, 5, 2, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const frame = x <= 1 || x >= 14 || y <= 1 || y >= 14 || y === 8 || x === 7 || x === 8;
          const windowCut = (y >= 3 && y <= 6) && ((x >= 3 && x <= 5) || (x >= 10 && x <= 12));
          if (windowCut) {
            p(x, y, 'rgba(180, 224, 238, 0.28)');
            continue;
          }
          const n = (rand() - 0.5) * 14;
          const dark = frame ? -18 : (x % 3 === 0 ? -8 : 6);
          p(x, y, rgb(156 + dark + n, 112 + dark * 0.8 + n * 0.7, 62 + dark * 0.6 + n * 0.5));
        }
      }
      // Iron hinges & door handle
      p(1, 3, '#4e5258');
      p(1, 12, '#4e5258');
      p(12, 9, '#d0d5db');
      p(12, 10, '#8d949c');
    });

    // (6,2) Cobblestone Stairs texture (crisp dressed masonry blocks)
    this.drawTile(ctx, 6, 2, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const seam = y === 0 || y === 7 || y === 8 || y === 15 || x === 0 || x === 8;
          const n = (rand() - 0.5) * 22;
          const v = seam ? 78 + n * 0.4 : 138 + n;
          p(x, y, rgb(v, v, v + 3));
        }
      }
    });

    // (7,2) Bed Top (white pillow band + crimson wool blanket with quilt border)
    this.drawTile(ctx, 7, 2, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const n = (rand() - 0.5) * 14;
          if (y < 5) {
            const rim = x === 0 || x === 15 || y === 0 || y === 4 ? -18 : 0;
            p(x, y, rgb(240 + rim + n * 0.5, 240 + rim + n * 0.5, 244 + rim + n * 0.4));
          } else if (y === 5) {
            p(x, y, rgb(225 + n * 0.4, 222 + n * 0.4, 222 + n * 0.4));
          } else {
            const border = x === 0 || x === 15 || y === 15 ? -24 : 0;
            const fold = y === 7 ? 14 : 0;
            p(x, y, rgb(198 + border + fold + n, 44 + border * 0.4 + n * 0.4, 44 + border * 0.4 + n * 0.4));
          }
        }
      }
    });

    // (8,2) Bed Side (red mattress over oak wood bed frame & legs)
    this.drawTile(ctx, 8, 2, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const n = (rand() - 0.5) * 14;
          if (y < 6) {
            const pillowSide = x < 5;
            if (pillowSide) {
              p(x, y, rgb(236 + n * 0.5, 236 + n * 0.5, 240 + n * 0.5));
            } else {
              p(x, y, rgb(188 + n, 40 + n * 0.4, 40 + n * 0.4));
            }
          } else if (y < 11) {
            p(x, y, rgb(156 + n, 112 + n * 0.8, 62 + n * 0.6));
          } else if (x < 3 || x > 12) {
            p(x, y, rgb(118 + n * 0.7, 82 + n * 0.6, 44 + n * 0.5));
          }
        }
      }
    });

    // (9,2) Dirt Path Top (compacted golden-ochre village road with tiny pebbles)
    this.drawTile(ctx, 9, 2, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const n = (rand() - 0.5) * 24;
          const speck = rand() < 0.1 ? -18 : rand() < 0.08 ? 16 : 0;
          p(x, y, rgb(178 + n + speck, 148 + n * 0.85 + speck, 92 + n * 0.65 + speck));
        }
      }
    });

    // (10,2) Farmland Top (dark rich tilled soil furrows)
    this.drawTile(ctx, 10, 2, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        const furrow = y % 4 === 1 ? -22 : y % 4 === 0 ? 10 : 0;
        for (let x = 0; x < 16; x++) {
          const n = (rand() - 0.5) * 16;
          p(x, y, rgb(104 + furrow + n, 68 + furrow * 0.8 + n * 0.7, 38 + furrow * 0.6 + n * 0.5));
        }
      }
    });

    // (11,2) Wheat Crops (golden wheat stalks cross-mesh sprite)
    this.drawTile(ctx, 11, 2, (p, rand) => {
      const stalks = [2, 4, 6, 9, 11, 13];
      for (const sx of stalks) {
        const topY = 2 + Math.floor(rand() * 3);
        for (let y = 15; y >= topY; y--) {
          const isHead = y <= topY + 4;
          if (isHead) {
            p(sx, y, y % 2 === 0 ? '#f0ca54' : '#d6a431');
            if (sx + 1 < 16 && y % 2 === 1) p(sx + 1, y, '#e6b83e');
          } else {
            p(sx, y, y > 11 ? '#729434' : '#b8a23b');
          }
        }
      }
    });

    // (12,2) Obsidian (deep volcanic black-indigo with crystalline purple highlights)
    this.drawTile(ctx, 12, 2, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const r = rand();
          if (r < 0.14) {
            p(x, y, '#3f2263');
          } else if (r < 0.24) {
            p(x, y, '#291542');
          } else if (r < 0.3) {
            p(x, y, '#593385');
          } else {
            const v = 14 + (rand() - 0.5) * 14;
            p(x, y, rgb(v + 4, v, v + 12));
          }
        }
      }
    });

    // (13,2) Netherrack (porous crimson volcanic rock)
    this.drawTile(ctx, 13, 2, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const pore = ((x * 5 + y * 9) % 13 === 0) || rand() < 0.16;
          const n = (rand() - 0.5) * 28;
          if (pore) {
            p(x, y, rgb(78 + n * 0.4, 24 + n * 0.3, 24 + n * 0.3));
          } else {
            p(x, y, rgb(134 + n, 52 + n * 0.5, 50 + n * 0.5));
          }
        }
      }
    });

    // (14,2) Soul Sand (dark brown sand with haunting sunken soul faces)
    this.drawTile(ctx, 14, 2, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const n = (rand() - 0.5) * 20;
          p(x, y, rgb(84 + n, 64 + n * 0.8, 50 + n * 0.7));
        }
      }
      // Two eerie recessed faces
      const faceSpots = [
        [3, 4], [4, 4], [6, 4], [7, 4], [4, 6], [5, 6], [6, 6], [5, 7],
        [10, 9], [11, 9], [13, 9], [14, 9], [11, 11], [12, 11], [13, 11], [12, 12],
      ];
      for (const [fx, fy] of faceSpots) {
        p(fx, fy, '#2d2018');
      }
    });

    // (15,2) Glowstone (luminous golden crystalline clusters with amber veins)
    this.drawTile(ctx, 15, 2, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const cell = ((x * 3 + y * 5) % 7);
          const n = (rand() - 0.5) * 24;
          if (cell === 0 || rand() < 0.14) {
            p(x, y, rgb(166 + n * 0.5, 114 + n * 0.5, 42 + n * 0.3));
          } else if (cell <= 2) {
            p(x, y, rgb(255, 244 + n * 0.3, 170 + n * 0.5));
          } else {
            p(x, y, rgb(242 + n * 0.4, 206 + n * 0.5, 96 + n * 0.5));
          }
        }
      }
    });

    // (0,3) Nether Bricks (dark charred crimson fortress bricks)
    this.drawTile(ctx, 0, 3, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        const row = Math.floor(y / 4);
        const mortarY = y % 4 === 0;
        const off = (row % 2) * 4;
        for (let x = 0; x < 16; x++) {
          const mortarX = (x + off) % 8 === 0;
          const n = (rand() - 0.5) * 16;
          if (mortarY || mortarX) {
            p(x, y, rgb(28 + n * 0.3, 14 + n * 0.2, 18 + n * 0.2));
          } else {
            const hi = y % 4 === 1 ? 10 : y % 4 === 3 ? -8 : 0;
            p(x, y, rgb(66 + hi + n, 30 + hi * 0.5 + n * 0.5, 38 + hi * 0.5 + n * 0.5));
          }
        }
      }
    });

    // (1,3) Nether Quartz Ore (white quartz crystals embedded in Netherrack)
    this.drawTile(ctx, 1, 3, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const n = (rand() - 0.5) * 26;
          p(x, y, rgb(132 + n, 50 + n * 0.5, 48 + n * 0.5));
        }
      }
      const crystals = [
        [3, 3], [4, 3], [4, 4], [5, 4],
        [10, 4], [11, 4], [11, 5], [12, 5], [10, 5],
        [5, 10], [6, 10], [6, 11], [7, 11], [5, 11],
        [11, 11], [12, 11], [12, 12],
      ];
      for (const [cx, cy] of crystals) {
        p(cx, cy, (cx + cy) % 2 === 0 ? '#f5efe6' : '#d6ccc0');
      }
    });

    // (2,3) Magma Block (charred volcanic crust cracked with molten orange-yellow veins)
    this.drawTile(ctx, 2, 3, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const vein = Math.sin(x * 0.75 + y * 0.45) + Math.cos(y * 0.85 - x * 0.35);
          const n = (rand() - 0.5) * 18;
          if (vein > 1.05) {
            p(x, y, rgb(255, 200 + n * 0.5, 50));
          } else if (vein > 0.55) {
            p(x, y, rgb(235 + n * 0.4, 96 + n * 0.5, 18));
          } else {
            p(x, y, rgb(56 + n * 0.5, 22 + n * 0.3, 18 + n * 0.3));
          }
        }
      }
    });

    // (3,3) Lava (incandescent bright molten magma pools with yellow hot streaks)
    this.drawTile(ctx, 3, 3, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const wave = Math.sin(x * 0.5 + y * 0.35) * 0.6 + Math.cos(y * 0.65 - x * 0.4) * 0.5;
          const n = (rand() - 0.5) * 20;
          if (wave > 0.55) {
            p(x, y, rgb(255, 232 + n * 0.3, 86));
          } else if (wave > -0.1) {
            p(x, y, rgb(252, 126 + n * 0.5, 16));
          } else {
            p(x, y, rgb(212 + n * 0.4, 62 + n * 0.4, 12));
          }
        }
      }
    });

    // (4,3) Nether Portal (translucent swirling violet-magenta vortex)
    this.drawTile(ctx, 4, 3, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const dx = x - 7.5;
          const dy = y - 7.5;
          const dist = Math.hypot(dx, dy);
          const angle = Math.atan2(dy, dx);
          const swirl = Math.sin(dist * 1.15 - angle * 2.0);
          const n = (rand() - 0.5) * 24;
          const r = Math.min(255, Math.max(90, Math.round(168 + swirl * 52 + n)));
          const g = Math.min(180, Math.max(24, Math.round(52 + swirl * 34 + n * 0.5)));
          const b = Math.min(255, Math.max(150, Math.round(235 + swirl * 20 + n * 0.4)));
          p(x, y, `rgba(${r},${g},${b},0.82)`);
        }
      }
    });

    // (5,3) Fire (animated-style licking orange-yellow flames cross-mesh)
    this.drawTile(ctx, 5, 3, (p, rand) => {
      for (let y = 1; y < 16; y++) {
        for (let x = 1; x < 15; x++) {
          const hFrac = (15 - y) / 14;
          const tongue =
            Math.abs(x - 4) < 3.2 - hFrac * 2.4 ||
            Math.abs(x - 8) < 4.0 - hFrac * 2.8 ||
            Math.abs(x - 12) < 3.0 - hFrac * 2.4;
          if (!tongue && y < 12) continue;
          if (y < 3 && rand() > 0.45) continue;
          if (y >= 11) {
            p(x, y, rand() < 0.4 ? '#fff4a3' : '#ffcf33');
          } else if (y >= 6) {
            p(x, y, rand() < 0.35 ? '#ffb41c' : '#ff7b14');
          } else {
            p(x, y, rand() < 0.5 ? '#ff5514' : '#e6360a');
          }
        }
      }
    });

    // (6,3) Quartz Block (smooth polished off-white marble with subtle beveled border)
    this.drawTile(ctx, 6, 3, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const border = x === 0 || x === 15 || y === 0 || y === 15 ? -14 : 0;
          const n = (rand() - 0.5) * 8;
          p(x, y, rgb(242 + border + n, 236 + border + n, 226 + border + n));
        }
      }
    });

    // =========================================================================
    // ROW 4: 4 NEW WOOD FAMILIES (Birch, Spruce, Jungle, Acacia)
    // =========================================================================
    const drawWoodFamily = (
      startCol: number,
      barkRgb: [number, number, number],
      ringRgb: [number, number, number],
      plankRgb: [number, number, number],
      leafRgb: [number, number, number],
      birchStripes = false
    ) => {
      // Top of log (concentric rings)
      this.drawTile(ctx, startCol, 4, (p, rand) => {
        for (let y = 0; y < 16; y++) {
          for (let x = 0; x < 16; x++) {
            const isBark = x === 0 || x === 15 || y === 0 || y === 15;
            const n = (rand() - 0.5) * 14;
            if (isBark) {
              p(x, y, rgb(barkRgb[0] + n, barkRgb[1] + n, barkRgb[2] + n));
            } else {
              const ring = Math.floor(Math.hypot(x - 7.5, y - 7.5)) % 2 === 0 ? -11 : 9;
              p(x, y, rgb(ringRgb[0] + ring + n, ringRgb[1] + ring + n, ringRgb[2] + ring * 0.8 + n));
            }
          }
        }
      });
      // Side of log
      this.drawTile(ctx, startCol + 1, 4, (p, rand) => {
        for (let y = 0; y < 16; y++) {
          for (let x = 0; x < 16; x++) {
            const n = (rand() - 0.5) * 16;
            if (birchStripes) {
              const knot =
                ((y === 3 || y === 9 || y === 13) && ((x + y * 3) % 7 < 3)) ||
                ((y === 6) && (x >= 10 && x <= 13));
              if (knot) {
                p(x, y, rgb(52 + n * 0.5, 50 + n * 0.5, 48 + n * 0.5));
              } else {
                p(x, y, rgb(232 + n * 0.6, 228 + n * 0.6, 220 + n * 0.6));
              }
            } else {
              const colTone = x % 3 === 0 ? -14 : x % 3 === 1 ? 8 : 0;
              const furrow = (x * 5 + y) % 11 === 0 ? -18 : 0;
              p(
                x,
                y,
                rgb(
                  barkRgb[0] + colTone + furrow + n,
                  barkRgb[1] + colTone * 0.85 + furrow + n * 0.85,
                  barkRgb[2] + colTone * 0.7 + n * 0.7
                )
              );
            }
          }
        }
      });
      // Planks
      this.drawTile(ctx, startCol + 2, 4, (p, rand) => {
        for (let y = 0; y < 16; y++) {
          const board = Math.floor(y / 4);
          const seamY = y % 4 === 0;
          const seamX = (board * 7 + 4) % 16;
          for (let x = 0; x < 16; x++) {
            const n = (rand() - 0.5) * 14;
            const grain = (x + board * 3) % 5 === 0 ? -8 : 5;
            if (seamY || x === seamX) {
              p(x, y, rgb(plankRgb[0] * 0.64 + n * 0.5, plankRgb[1] * 0.62 + n * 0.5, plankRgb[2] * 0.58 + n * 0.4));
            } else {
              p(x, y, rgb(plankRgb[0] + grain + n, plankRgb[1] + grain * 0.9 + n * 0.85, plankRgb[2] + grain * 0.7 + n * 0.7));
            }
          }
        }
      });
      // Leaves (cutout alpha gaps)
      this.drawTile(ctx, startCol + 3, 4, (p, rand) => {
        for (let y = 0; y < 16; y++) {
          for (let x = 0; x < 16; x++) {
            const hole = rand() < 0.22 && !((x === 0 || x === 15) && (y === 0 || y === 15));
            if (hole) continue;
            const n = (rand() - 0.5) * 32;
            const hi = (x + y) % 4 === 0 ? 16 : -6;
            p(x, y, rgb(leafRgb[0] + n * 0.6 + hi * 0.5, leafRgb[1] + n + hi, leafRgb[2] + n * 0.5 + hi * 0.3));
          }
        }
      });
      // Sapling (cross-mesh)
      this.drawTile(ctx, startCol + 4, 4, (p, rand) => {
        for (let y = 9; y < 16; y++) {
          p(7, y, rgb(barkRgb[0], barkRgb[1], barkRgb[2]));
          p(8, y, rgb(barkRgb[0] * 0.78, barkRgb[1] * 0.78, barkRgb[2] * 0.78));
        }
        for (let y = 3; y <= 10; y++) {
          for (let x = 3; x <= 12; x++) {
            if (Math.hypot(x - 7.5, y - 6.5) <= 4.2 && rand() > 0.16) {
              const hi = y <= 5 ? 18 : 0;
              p(x, y, rgb(leafRgb[0] + hi * 0.6, leafRgb[1] + hi, leafRgb[2] + hi * 0.4));
            }
          }
        }
      });
    };

    // Birch (0..4,4), Spruce (5..9,4), Jungle (10..14,4), Acacia (15..19,4)
    drawWoodFamily(0, [222, 218, 210], [218, 204, 158], [216, 200, 148], [116, 174, 62], true);
    drawWoodFamily(5, [62, 42, 24], [126, 92, 54], [118, 84, 50], [42, 92, 66], false);
    drawWoodFamily(10, [94, 78, 44], [182, 132, 98], [178, 126, 94], [46, 154, 40], false);
    drawWoodFamily(15, [112, 108, 102], [198, 104, 52], [194, 102, 48], [118, 148, 50], false);

    // =========================================================================
    // ROW 5: NATURAL BLOCKS & PLANTS (Gravel..Sugar Cane)
    // =========================================================================
    // (0,5) Gravel
    this.drawTile(ctx, 0, 5, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const r = rand();
          const v = r < 0.25 ? 104 : r < 0.55 ? 132 : r < 0.82 ? 156 : 178;
          const warm = r > 0.7 ? 6 : -3;
          p(x, y, rgb(v + warm, v, v - warm * 0.5));
        }
      }
    });

    // (1,5) Clay Block
    this.drawTile(ctx, 1, 5, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const n = (rand() - 0.5) * 14;
          p(x, y, rgb(156 + n, 164 + n, 182 + n));
        }
      }
    });

    // (2,5) Ice (translucent frosty blue with crisp white diagonal streaks)
    this.drawTile(ctx, 2, 5, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const streak = (x + y === 6 || x + y === 7 || x + y === 19) && x > 1 && x < 14;
          const border = x === 0 || x === 15 || y === 0 || y === 15;
          const n = (rand() - 0.5) * 14;
          if (streak) {
            p(x, y, 'rgba(235, 250, 255, 0.88)');
          } else if (border) {
            p(x, y, 'rgba(170, 220, 255, 0.82)');
          } else {
            p(x, y, rgb(134 + n, 198 + n, 252, 0.72));
          }
        }
      }
    });

    // (3,5) Packed Ice (opaque dense glacier blue)
    this.drawTile(ctx, 3, 5, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const streak = (x + y === 7 || x + y === 20) && rand() > 0.2;
          const n = (rand() - 0.5) * 18;
          p(x, y, streak ? rgb(188, 224, 255) : rgb(126 + n, 174 + n, 242 + n * 0.5));
        }
      }
    });

    // (4,5) Cactus Top
    this.drawTile(ctx, 4, 5, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const rim = x === 0 || x === 15 || y === 0 || y === 15;
          const n = (rand() - 0.5) * 16;
          p(x, y, rim ? rgb(32, 74, 24) : rgb(62 + n, 134 + n, 46 + n * 0.5));
        }
      }
    });

    // (5,5) Cactus Side (vertical ribs + dark needles)
    this.drawTile(ctx, 5, 5, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const rib = x % 4 === 0 ? -18 : x % 4 === 2 ? 12 : 0;
          const spine = x % 4 === 0 && y % 5 === 2;
          const n = (rand() - 0.5) * 14;
          p(x, y, spine ? '#1c2b16' : rgb(54 + rib + n, 126 + rib + n, 40 + rib * 0.5 + n * 0.5));
        }
      }
    });

    // (6,5) Pumpkin Top
    this.drawTile(ctx, 6, 5, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const stem = x >= 6 && x <= 9 && y >= 6 && y <= 9;
          const n = (rand() - 0.5) * 16;
          p(x, y, stem ? rgb(98 + n, 108 + n, 44) : rgb(214 + n, 122 + n * 0.7, 24 + n * 0.3));
        }
      }
    });

    // (7,5) Pumpkin Side (ribbed orange)
    this.drawTile(ctx, 7, 5, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const rib = x % 4 === 0 ? -24 : x % 4 === 2 ? 12 : 0;
          const n = (rand() - 0.5) * 14;
          p(x, y, rgb(218 + rib + n, 122 + rib * 0.7 + n * 0.7, 26 + n * 0.4));
        }
      }
    });

    // (8,5) Pumpkin Carved Front & (9,5) Jack o'Lantern Lit Front
    const drawPumpkinFace = (tx: number, lit: boolean) => {
      this.drawTile(ctx, tx, 5, (p, rand) => {
        for (let y = 0; y < 16; y++) {
          for (let x = 0; x < 16; x++) {
            const rib = x % 4 === 0 ? -22 : x % 4 === 2 ? 10 : 0;
            const n = (rand() - 0.5) * 14;
            p(x, y, rgb(218 + rib + n, 122 + rib * 0.7 + n * 0.7, 26 + n * 0.4));
          }
        }
        const carve = lit ? '#ffeb70' : '#2e1605';
        const carveHi = lit ? '#ffffff' : '#4a2408';
        // Eyes
        const eyes = [
          [3, 4], [4, 4], [4, 5], [5, 5], [3, 5],
          [10, 5], [11, 5], [12, 5], [11, 4], [12, 4],
          [7, 7], [8, 7],
        ];
        for (const [ex, ey] of eyes) p(ex, ey, ey === 4 ? carveHi : carve);
        // Zig-zag grin
        for (let x = 3; x <= 12; x++) {
          const y = x % 3 === 0 ? 11 : 10;
          p(x, y, carve);
          p(x, y + 1, lit ? '#ffae19' : '#1f0e03');
        }
      });
    };
    drawPumpkinFace(8, false);
    drawPumpkinFace(9, true);

    // (10,5) Melon Top & (11,5) Melon Side
    this.drawTile(ctx, 10, 5, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const d = Math.hypot(x - 7.5, y - 7.5);
          const n = (rand() - 0.5) * 16;
          p(x, y, d < 2.2 ? '#596e26' : rgb(124 + n, 182 + n, 52 + n * 0.5));
        }
      }
    });
    this.drawTile(ctx, 11, 5, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const darkStripe = x % 4 === 0 || (x % 4 === 1 && (x + y) % 3 === 0);
          const n = (rand() - 0.5) * 16;
          p(x, y, darkStripe ? rgb(72 + n * 0.6, 128 + n * 0.8, 32) : rgb(146 + n, 198 + n, 60));
        }
      }
    });

    // (12,5) Hay Bale Top & (13,5) Hay Bale Side (with red twine bands)
    this.drawTile(ctx, 12, 5, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const n = (rand() - 0.5) * 28;
          p(x, y, rgb(210 + n, 174 + n * 0.85, 56 + n * 0.4));
        }
      }
    });
    this.drawTile(ctx, 13, 5, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        const band = y === 4 || y === 11;
        for (let x = 0; x < 16; x++) {
          const n = (rand() - 0.5) * 24;
          if (band) {
            p(x, y, rgb(172 + n * 0.4, 42 + n * 0.3, 34 + n * 0.3));
          } else {
            const straw = x % 2 === 0 ? 10 : -10;
            p(x, y, rgb(214 + straw + n, 178 + straw * 0.8 + n * 0.8, 56 + n * 0.4));
          }
        }
      }
    });

    // (14,5) Dandelion (bright yellow flower)
    this.drawTile(ctx, 14, 5, (p) => {
      for (let y = 8; y < 16; y++) {
        p(7, y, '#459432');
        p(8, y, '#327324');
      }
      p(6, 12, '#57b03f');
      p(9, 11, '#459432');
      for (let y = 4; y <= 7; y++) {
        for (let x = 5; x <= 10; x++) {
          if ((x === 5 || x === 10) && (y === 4 || y === 7)) continue;
          p(x, y, y <= 5 ? '#fff066' : '#f2c71d');
        }
      }
    });

    // (15,5) Blue Orchid (vivid sky-blue blossom cluster)
    this.drawTile(ctx, 15, 5, (p) => {
      for (let y = 7; y < 16; y++) {
        p(7, y, '#327a34');
        p(8, y, '#245e26');
      }
      p(5, 11, '#3d8f40');
      p(10, 10, '#3d8f40');
      const petals = [
        [6, 3], [7, 3], [8, 3], [9, 3],
        [4, 4], [5, 4], [6, 4], [7, 4], [8, 4], [9, 4], [10, 4], [11, 4],
        [5, 5], [6, 5], [7, 5], [8, 5], [9, 5], [10, 5],
        [4, 6], [6, 6], [7, 6], [8, 6], [9, 6], [11, 6],
        [6, 7], [9, 7],
      ];
      for (const [x, y] of petals) {
        p(x, y, y <= 4 ? '#96e9ff' : '#2fb6eb');
      }
      p(7, 5, '#ffffff');
      p(8, 5, '#d1f7ff');
    });

    // (16,5) Red Mushroom & (17,5) Brown Mushroom
    this.drawTile(ctx, 16, 5, (p) => {
      for (let y = 10; y < 16; y++) {
        p(7, y, '#ede6d8');
        p(8, y, '#d4cbb8');
      }
      for (let y = 6; y <= 10; y++) {
        for (let x = 4; x <= 11; x++) {
          if (y === 6 && (x === 4 || x === 11)) continue;
          const spot = (x === 6 && y === 7) || (x === 9 && y === 8) || (x === 5 && y === 9);
          p(x, y, spot ? '#f7f3eb' : y <= 7 ? '#eb3b3b' : '#bd2222');
        }
      }
    });
    this.drawTile(ctx, 17, 5, (p) => {
      for (let y = 10; y < 16; y++) {
        p(7, y, '#e3d8c5');
        p(8, y, '#c7baa5');
      }
      for (let y = 7; y <= 10; y++) {
        for (let x = 4; x <= 11; x++) {
          if (y === 7 && (x === 4 || x === 11)) continue;
          p(x, y, y <= 8 ? '#ab7b52' : '#855a36');
        }
      }
    });

    // (18,5) Sugar Cane (segmented bamboo-green reeds)
    this.drawTile(ctx, 18, 5, (p) => {
      const stalks = [3, 7, 11];
      for (const sx of stalks) {
        for (let y = 1; y < 16; y++) {
          const node = y % 5 === 0;
          p(sx, y, node ? '#5c9c33' : '#94db5c');
          p(sx + 1, y, node ? '#487d27' : '#73ba41');
        }
      }
    });

    // =========================================================================
    // ROW 6: STONES, DEEPSLATE, BRICKS & ARCHITECTURAL VARIANTS
    // =========================================================================
    const drawIgneous = (tx: number, base: [number, number, number], speck1: [number, number, number], speck2: [number, number, number], polished: boolean) => {
      this.drawTile(ctx, tx, 6, (p, rand) => {
        for (let y = 0; y < 16; y++) {
          for (let x = 0; x < 16; x++) {
            const border = polished && (x === 0 || x === 15 || y === 0 || y === 15);
            const hi = polished && (x === 1 || y === 1);
            const r = rand();
            const n = (rand() - 0.5) * (polished ? 10 : 22);
            if (border) {
              p(x, y, rgb(base[0] * 0.72, base[1] * 0.72, base[2] * 0.72));
            } else if (hi) {
              p(x, y, rgb(base[0] + 18, base[1] + 18, base[2] + 18));
            } else if (!polished && r < 0.16) {
              p(x, y, rgb(speck1[0] + n * 0.4, speck1[1] + n * 0.4, speck1[2] + n * 0.4));
            } else if (!polished && r < 0.28) {
              p(x, y, rgb(speck2[0] + n * 0.4, speck2[1] + n * 0.4, speck2[2] + n * 0.4));
            } else {
              p(x, y, rgb(base[0] + n, base[1] + n, base[2] + n));
            }
          }
        }
      });
    };
    drawIgneous(0, [158, 110, 94], [110, 74, 62], [204, 166, 152], false); // Granite
    drawIgneous(1, [166, 116, 100], [120, 82, 70], [210, 174, 160], true); // Polished Granite
    drawIgneous(2, [202, 202, 208], [134, 134, 142], [238, 238, 242], false); // Diorite
    drawIgneous(3, [212, 212, 218], [150, 150, 158], [244, 244, 248], true); // Polished Diorite
    drawIgneous(4, [138, 140, 144], [102, 104, 108], [174, 176, 180], false); // Andesite
    drawIgneous(5, [146, 148, 152], [116, 118, 122], [182, 184, 188], true); // Polished Andesite

    // (6,6) Deepslate Top & (7,6) Deepslate Side
    this.drawTile(ctx, 6, 6, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const n = (rand() - 0.5) * 18;
          const swirl = (x + y * 2) % 5 === 0 ? -10 : 6;
          p(x, y, rgb(70 + swirl + n, 72 + swirl + n, 82 + swirl + n));
        }
      }
    });
    this.drawTile(ctx, 7, 6, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        const layer = y % 3 === 0 ? -12 : y % 3 === 1 ? 8 : 0;
        for (let x = 0; x < 16; x++) {
          const n = (rand() - 0.5) * 16;
          p(x, y, rgb(66 + layer + n, 68 + layer + n, 78 + layer + n));
        }
      }
    });

    // (8,6) Cobbled Deepslate
    this.drawTile(ctx, 8, 6, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const mortar = y % 5 === 0 || (y < 5 && x % 8 === 0) || (y >= 5 && y < 10 && (x + 4) % 8 === 0) || (y >= 10 && (x + 2) % 7 === 0);
          const n = (rand() - 0.5) * 18;
          const v = mortar ? 40 + n * 0.4 : 74 + n;
          p(x, y, rgb(v, v + 2, v + 8));
        }
      }
    });

    // (9,6) Deepslate Bricks
    this.drawTile(ctx, 9, 6, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        const row = Math.floor(y / 8);
        const mortar = y === 0 || y === 8 || ((xOff => xOff)(0) === 1);
        for (let x = 0; x < 16; x++) {
          const mx = (x + row * 8) % 16 === 0 || (x + row * 8) % 16 === 8;
          const n = (rand() - 0.5) * 14;
          const v = mortar || mx ? 36 : y % 8 === 1 ? 82 + n : 64 + n;
          p(x, y, rgb(v, v + 2, v + 8));
        }
      }
    });

    // (10,6) Stone Bricks, (11,6) Mossy, (12,6) Cracked, (13,6) Chiseled
    const drawStoneBricks = (tx: number, mode: 'clean' | 'mossy' | 'cracked') => {
      this.drawTile(ctx, tx, 6, (p, rand) => {
        for (let y = 0; y < 16; y++) {
          const row = Math.floor(y / 8);
          for (let x = 0; x < 16; x++) {
            const mortar = y === 0 || y === 8 || (x + row * 8) % 16 === 0 || (x + row * 8) % 16 === 8;
            const n = (rand() - 0.5) * 18;
            if (mode === 'mossy' && ((x * 5 + y * 9) % 11 < 3) && (mortar || rand() < 0.65)) {
              p(x, y, rgb(66 + n * 0.6, 118 + n * 0.8, 52 + n * 0.5));
            } else {
              const v = mortar ? 74 : y % 8 === 1 ? 148 + n : 128 + n;
              p(x, y, rgb(v, v + 1, v + 3));
            }
          }
        }
        if (mode === 'cracked') {
          const cracks = [[3, 2], [4, 3], [5, 3], [6, 4], [11, 5], [10, 6], [10, 7], [5, 10], [6, 11], [6, 12], [7, 13], [12, 11], [13, 12]];
          for (const [cx, cy] of cracks) p(cx, cy, '#47494d');
        }
      });
    };
    drawStoneBricks(10, 'clean');
    drawStoneBricks(11, 'mossy');
    drawStoneBricks(12, 'cracked');

    // (13,6) Chiseled Stone Bricks (concentric carved squares)
    this.drawTile(ctx, 13, 6, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
          const groove = Math.abs(d - 7.5) < 0.6 || Math.abs(d - 4.5) < 0.6 || Math.abs(d - 1.5) < 0.6;
          const n = (rand() - 0.5) * 14;
          const v = groove ? 76 + n * 0.4 : 136 + n;
          p(x, y, rgb(v, v + 1, v + 3));
        }
      }
    });

    // (14,6) Smooth Stone
    this.drawTile(ctx, 14, 6, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const border = x === 0 || x === 15 || y === 0 || y === 15;
          const n = (rand() - 0.5) * 10;
          const v = border ? 124 + n : 162 + n;
          p(x, y, rgb(v, v + 1, v + 3));
        }
      }
    });

    // (15,6) Red Sandstone Top & (16,6) Red Sandstone Side
    this.drawTile(ctx, 15, 6, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const border = x === 0 || x === 15 || y === 0 || y === 15 ? -14 : 0;
          const n = (rand() - 0.5) * 16 + border;
          p(x, y, rgb(188 + n, 92 + n * 0.7, 40 + n * 0.4));
        }
      }
    });
    this.drawTile(ctx, 16, 6, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        const band = y < 3 ? 12 : y === 3 || y === 11 ? -18 : y % 4 === 0 ? -8 : 0;
        for (let x = 0; x < 16; x++) {
          const n = (rand() - 0.5) * 16;
          p(x, y, rgb(184 + band + n, 88 + band * 0.7 + n * 0.7, 38 + n * 0.4));
        }
      }
    });

    // (17,6) Smooth Quartz
    this.drawTile(ctx, 17, 6, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const n = (rand() - 0.5) * 6;
          p(x, y, rgb(246 + n, 241 + n, 232 + n));
        }
      }
    });

    // =========================================================================
    // ROW 7: MINERAL STORAGE BLOCKS & NEW ORES (Coal..Netherite)
    // =========================================================================
    const drawMetalBlock = (tx: number, hi: [number, number, number], mid: [number, number, number], lo: [number, number, number], beveled = true) => {
      this.drawTile(ctx, tx, 7, (p, rand) => {
        for (let y = 0; y < 16; y++) {
          for (let x = 0; x < 16; x++) {
            const n = (rand() - 0.5) * 12;
            const isTopLeft = beveled && (x <= 1 || y <= 1);
            const isBotRight = beveled && (x >= 14 || y >= 14);
            const innerRim = beveled && (x === 3 || x === 12 || y === 3 || y === 12);
            const c = isBotRight ? lo : isTopLeft ? hi : innerRim ? lo : mid;
            const glint = x + y === 7 || x + y === 8 ? 16 : 0;
            p(x, y, rgb(c[0] + glint + n, c[1] + glint + n, c[2] + glint + n));
          }
        }
      });
    };

    const drawOreTile = (tx: number, fleckHi: string, fleckLo: string) => {
      this.drawTile(ctx, tx, 7, (p, rand) => {
        for (let y = 0; y < 16; y++) {
          for (let x = 0; x < 16; x++) {
            const v = 124 + (rand() - 0.5) * 24;
            p(x, y, rgb(v, v, v + 2));
          }
        }
        const flecks = [
          [2, 3], [3, 3], [3, 4], [10, 3], [11, 3], [10, 4],
          [6, 7], [7, 7], [7, 8], [11, 10], [12, 10], [11, 11],
          [3, 11], [4, 11], [4, 12],
        ];
        for (const [fx, fy] of flecks) {
          p(fx, fy, fleckHi);
          p(fx + 1, fy, fleckLo);
        }
      });
    };

    drawMetalBlock(0, [54, 56, 62], [32, 34, 40], [16, 17, 20], false); // Coal Block
    drawMetalBlock(1, [242, 246, 250], [216, 222, 228], [156, 164, 174], true); // Iron Block
    drawMetalBlock(2, [255, 242, 128], [245, 202, 46], [184, 128, 18], true); // Gold Block
    drawMetalBlock(3, [156, 255, 255], [72, 232, 238], [28, 152, 168], true); // Diamond Block
    drawMetalBlock(4, [132, 255, 174], [38, 212, 108], [16, 124, 62], true); // Emerald Block
    drawOreTile(5, '#3b6ef5', '#1d3da8'); // Lapis Ore
    drawMetalBlock(6, [66, 114, 240], [32, 72, 186], [20, 46, 128], false); // Lapis Block
    drawOreTile(7, '#ff3b30', '#b51414'); // Redstone Ore
    drawMetalBlock(8, [255, 92, 76], [214, 34, 26], [134, 16, 14], true); // Redstone Block
    drawOreTile(9, '#ed8c58', '#3da682'); // Copper Ore (orange + verdigris)
    drawMetalBlock(10, [242, 146, 102], [208, 110, 68], [148, 72, 44], true); // Copper Block

    // (11,7) Ancient Debris Top (concentric dark metallic spiral) & (12,7) Side
    this.drawTile(ctx, 11, 7, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const ring = Math.floor(Math.hypot(x - 7.5, y - 7.5)) % 2 === 0 ? 14 : -12;
          const n = (rand() - 0.5) * 14;
          p(x, y, rgb(104 + ring + n, 78 + ring + n, 68 + ring + n));
        }
      }
    });
    this.drawTile(ctx, 12, 7, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        const plate = y < 3 || y > 12 ? 14 : y === 3 || y === 12 ? -18 : 0;
        for (let x = 0; x < 16; x++) {
          const n = (rand() - 0.5) * 16;
          p(x, y, rgb(96 + plate + n, 72 + plate + n, 62 + plate + n));
        }
      }
    });
    drawMetalBlock(13, [104, 92, 108], [68, 60, 72], [38, 32, 42], true); // Netherite Block

    // =========================================================================
    // ROW 8: FUNCTIONAL & INTERACTIVE BLOCKS (TNT..Jukebox)
    // =========================================================================
    // (0,8) TNT Top (bundled dynamite sticks + white fuse cords)
    this.drawTile(ctx, 0, 8, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const grid = x % 4 === 0 || y % 4 === 0;
          const center = x >= 6 && x <= 9 && y >= 6 && y <= 9;
          const n = (rand() - 0.5) * 12;
          if (center) {
            p(x, y, (x + y) % 2 === 0 ? '#2b2b2e' : '#e6e6e6');
          } else if (grid) {
            p(x, y, '#851b14');
          } else {
            p(x, y, rgb(216 + n, 52 + n * 0.4, 38 + n * 0.4));
          }
        }
      }
    });

    // (1,8) TNT Side (classic crimson dynamite sticks + crisp white band with pixel "TNT")
    this.drawTile(ctx, 1, 8, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const n = (rand() - 0.5) * 12;
          if (y >= 5 && y <= 10) {
            p(x, y, y === 5 || y === 10 ? '#d8d8dc' : '#f5f5f7');
          } else {
            const stickSeam = x % 4 === 0 ? -24 : 0;
            p(x, y, rgb(214 + stickSeam + n, 48 + stickSeam * 0.3 + n * 0.3, 36 + n * 0.3));
          }
        }
      }
      // Pixel letters "TNT" in center white band (y = 6..9)
      const tntPixels = [
        // T (x=2..4)
        [2, 6], [3, 6], [4, 6], [3, 7], [3, 8], [3, 9],
        // N (x=6..9)
        [6, 6], [6, 7], [6, 8], [6, 9], [7, 7], [8, 8], [9, 6], [9, 7], [9, 8], [9, 9],
        // T (x=11..13)
        [11, 6], [12, 6], [13, 6], [12, 7], [12, 8], [12, 9],
      ];
      for (const [px, py] of tntPixels) p(px, py, '#17171a');
    });

    // (2,8) TNT Bottom
    this.drawTile(ctx, 2, 8, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const grid = x % 4 === 0 || y % 4 === 0;
          const n = (rand() - 0.5) * 12;
          p(x, y, grid ? '#851b14' : rgb(212 + n, 50 + n * 0.4, 36 + n * 0.4));
        }
      }
    });

    // (3,8) Bookshelf Side (oak shelves packed with colorful book spines)
    this.drawTile(ctx, 3, 8, (p, rand) => {
      const spineColors = ['#c93232', '#2f65c4', '#2e9c4a', '#d9a426', '#8a3eb8', '#c4632b', '#e8dec8'];
      for (let y = 0; y < 16; y++) {
        const shelf = y <= 1 || y === 7 || y === 8 || y >= 14;
        for (let x = 0; x < 16; x++) {
          const n = (rand() - 0.5) * 12;
          if (shelf) {
            p(x, y, rgb(174 + n, 134 + n * 0.8, 78 + n * 0.6));
          } else {
            const bookIdx = Math.floor(x / 2) + (y > 8 ? 3 : 0);
            const isGap = x % 2 === 0 && (y === 2 || y === 9) && bookIdx % 3 === 0;
            if (isGap) {
              p(x, y, '#362415');
            } else {
              const c = hexToRgb(spineColors[bookIdx % spineColors.length]);
              const stripe = y === 4 || y === 11 ? 24 : 0;
              p(x, y, rgb(c[0] + stripe + n, c[1] + stripe + n, c[2] + stripe + n));
            }
          }
        }
      }
    });

    // (4,8) Lantern (wrought iron cage with warm glowing candle core)
    this.drawTile(ctx, 4, 8, (p) => {
      // Top ring & chain
      p(7, 1, '#58606b');
      p(8, 1, '#58606b');
      p(7, 2, '#3d434c');
      p(8, 2, '#3d434c');
      // Cap
      for (let x = 5; x <= 10; x++) p(x, 3, '#3c424b');
      for (let x = 4; x <= 11; x++) p(x, 4, '#2a2f36');
      // Glass & glowing flame body
      for (let y = 5; y <= 13; y++) {
        p(4, y, '#2e333b');
        p(11, y, '#2e333b');
        for (let x = 5; x <= 10; x++) {
          const core = x >= 6 && x <= 9 && y >= 7 && y <= 11;
          p(x, y, core ? (y <= 8 ? '#fff7b2' : '#ffbf36') : '#e08324');
        }
      }
      // Base
      for (let x = 4; x <= 11; x++) p(x, 14, '#2a2f36');
      for (let x = 5; x <= 10; x++) p(x, 15, '#1d2126');
    });

    // (5,8) Sea Lantern (luminous prismarine frame + aquamarine glowing core)
    this.drawTile(ctx, 5, 8, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const border = x <= 1 || x >= 14 || y <= 1 || y >= 14;
          const dist = Math.hypot(x - 7.5, y - 7.5);
          const n = (rand() - 0.5) * 14;
          if (border) {
            p(x, y, rgb(104 + n, 174 + n, 166 + n));
          } else if (dist < 4.5) {
            p(x, y, rgb(228 + n * 0.4, 255, 248));
          } else {
            p(x, y, rgb(156 + n, 232 + n, 222 + n));
          }
        }
      }
    });

    // (6,8) Redstone Lamp (glowing amber lattice inside dark bronze frame)
    this.drawTile(ctx, 6, 8, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const frame = x === 0 || x === 15 || y === 0 || y === 15 || x === 7 || x === 8 || y === 7 || y === 8;
          const n = (rand() - 0.5) * 14;
          if (frame) {
            p(x, y, rgb(118 + n * 0.5, 68 + n * 0.4, 34 + n * 0.3));
          } else {
            p(x, y, rgb(255, 222 + n * 0.6, 118 + n * 0.6));
          }
        }
      }
    });

    // (7,8) Ladder (vertical wooden rails + 4 horizontal rungs, transparent background)
    this.drawTile(ctx, 7, 8, (p) => {
      for (let y = 0; y < 16; y++) {
        p(2, y, '#9c7240');
        p(3, y, '#735129');
        p(12, y, '#9c7240');
        p(13, y, '#735129');
      }
      for (const ry of [2, 6, 10, 14]) {
        for (let x = 1; x <= 14; x++) {
          p(x, ry, '#b88a50');
          p(x, ry + 1, '#7a562c');
        }
      }
    });

    // (8,8) Iron Door (heavy steel panels + rivets + barred window)
    this.drawTile(ctx, 8, 8, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const windowCut = y >= 3 && y <= 6 && ((x >= 3 && x <= 5) || (x >= 10 && x <= 12));
          if (windowCut) {
            p(x, y, 'rgba(180, 220, 235, 0.25)');
            continue;
          }
          const frame = x <= 1 || x >= 14 || y <= 1 || y >= 14 || y === 8;
          const n = (rand() - 0.5) * 10;
          const v = frame ? 168 + n : 218 + n;
          p(x, y, rgb(v, v + 3, v + 7));
        }
      }
      p(12, 9, '#5e6670');
      p(12, 10, '#3f454d');
    });

    // (9,8) Sponge (porous golden sea sponge)
    this.drawTile(ctx, 9, 8, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const pore = ((x * 5 + y * 7) % 13 === 0) || ((x === 3 || x === 11) && (y === 4 || y === 12));
          const n = (rand() - 0.5) * 20;
          p(x, y, pore ? rgb(148 + n * 0.4, 134 + n * 0.4, 32) : rgb(216 + n, 206 + n * 0.9, 66 + n * 0.5));
        }
      }
    });

    // (10,8) Jukebox Top (dark mahogany top with vinyl disc slot) & (11,8) Jukebox Side
    this.drawTile(ctx, 10, 8, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const border = x <= 1 || x >= 14 || y <= 1 || y >= 14;
          const slot = y === 7 && x >= 4 && x <= 11;
          const n = (rand() - 0.5) * 14;
          if (slot) {
            p(x, y, '#171316');
          } else if (border) {
            p(x, y, rgb(88 + n * 0.5, 48 + n * 0.4, 30 + n * 0.3));
          } else {
            p(x, y, rgb(126 + n, 72 + n * 0.7, 44 + n * 0.5));
          }
        }
      }
    });
    this.drawTile(ctx, 11, 8, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const border = x === 0 || x === 15 || y === 0 || y === 15;
          const speaker = x >= 4 && x <= 11 && y >= 4 && y <= 11 && (x + y) % 2 === 0;
          const n = (rand() - 0.5) * 14;
          if (border) {
            p(x, y, rgb(76 + n * 0.4, 42 + n * 0.3, 26 + n * 0.3));
          } else if (speaker) {
            p(x, y, '#291711');
          } else {
            p(x, y, rgb(118 + n, 68 + n * 0.7, 42 + n * 0.5));
          }
        }
      }
    });

    // =========================================================================
    // ROWS 9..12: 16-COLOR PALETTE GENERATED VIA generateTintedTile()
    // Row 9: Wool (cols 1..15), Row 10: Concrete (0..15), Row 11: Terracotta (0..15), Row 12: Stained Glass (0..15)
    // =========================================================================
    COLOR_PALETTE.forEach((col, i) => {
      if (i > 0) {
        this.generateTintedTile(ctx, i, 9, 'wool', col.hex);
      }
      this.generateTintedTile(ctx, i, 10, 'concrete', col.hex);
      this.generateTintedTile(ctx, i, 11, 'terracotta', col.terracottaHex);
      this.generateTintedTile(ctx, i, 12, 'stained_glass', col.hex);
    });

    // =========================================================================
    // ROW 13: 20 CLASSIC MINECRAFT EXPANSION BLOCKS (cols 0..30)
    // =========================================================================
    // (0,13) Enchanting Table Top (obsidian edge + crimson velvet cloth + diamond corner studs)
    this.drawTile(ctx, 0, 13, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const edge = x === 0 || x === 15 || y === 0 || y === 15;
          const trim = x === 1 || x === 14 || y === 1 || y === 14;
          const diamond = (x === 2 || x === 13) && (y === 2 || y === 13);
          const n = (rand() - 0.5) * 14;
          if (edge) {
            p(x, y, rgb(22 + n * 0.4, 14 + n * 0.3, 36 + n * 0.5));
          } else if (diamond) {
            p(x, y, '#68f0f5');
          } else if (trim) {
            p(x, y, '#47b8bd');
          } else {
            p(x, y, rgb(164 + n, 30 + n * 0.4, 48 + n * 0.4));
          }
        }
      }
    });

    // (1,13) Enchanting Table Side (crimson drape over dark obsidian with diamond inlays)
    this.drawTile(ctx, 1, 13, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const n = (rand() - 0.5) * 14;
          if (y < 4) {
            p(x, y, rgb(156 + n, 26 + n * 0.4, 44 + n * 0.4));
          } else if (y === 4 && (x === 3 || x === 12)) {
            p(x, y, '#68f0f5');
          } else if (y === 4 && x >= 5 && x <= 10) {
            p(x, y, '#e6b83e');
          } else {
            const speck = rand() < 0.16 ? 26 : 0;
            p(x, y, rgb(24 + speck + n * 0.4, 15 + speck * 0.4 + n * 0.3, 38 + speck * 1.4 + n * 0.5));
          }
        }
      }
    });

    // (2,13) Anvil Top & (3,13) Anvil Side (forged dark charcoal iron)
    this.drawTile(ctx, 2, 13, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const rim = x <= 1 || x >= 14 || y <= 1 || y >= 14;
          const n = (rand() - 0.5) * 14;
          const v = rim ? 54 + n : 88 + n;
          p(x, y, rgb(v, v + 2, v + 6));
        }
      }
    });
    this.drawTile(ctx, 3, 13, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const hi = y === 0 || y === 1 ? 18 : y === 15 ? -14 : 0;
          const n = (rand() - 0.5) * 12;
          const v = 64 + hi + n;
          p(x, y, rgb(v, v + 2, v + 6));
        }
      }
    });

    // (4,13) Ender Chest Top, (5,13) Front (glowing purple eye clasp), (6,13) Side
    const drawEnderChestBase = (tx: number, hasFrontClasp: boolean) => {
      this.drawTile(ctx, tx, 13, (p, rand) => {
        for (let y = 0; y < 16; y++) {
          for (let x = 0; x < 16; x++) {
            const border = x <= 1 || x >= 14 || y <= 1 || y >= 14;
            const seam = tx !== 4 && y === 5;
            const n = (rand() - 0.5) * 14;
            if (seam) {
              p(x, y, '#0c1418');
            } else if (border) {
              p(x, y, rgb(22 + n * 0.4, 48 + n * 0.5, 52 + n * 0.5));
            } else {
              const star = rand() < 0.08 ? 30 : 0;
              p(x, y, rgb(18 + star + n * 0.4, 34 + star * 0.5 + n * 0.5, 42 + star + n * 0.5));
            }
          }
        }
        if (hasFrontClasp) {
          for (let y = 4; y <= 8; y++) {
            for (let x = 6; x <= 9; x++) {
              p(x, y, y === 6 && (x === 7 || x === 8) ? '#e0a3ff' : '#9c3be8');
            }
          }
        }
      });
    };
    drawEnderChestBase(4, false);
    drawEnderChestBase(5, true);
    drawEnderChestBase(6, false);

    // (7,13) Soul Torch (charred handle + radiant cyan-blue soul flame)
    this.drawTile(ctx, 7, 13, (p) => {
      for (let y = 7; y < 16; y++) {
        p(7, y, '#6e4e2e');
        p(8, y, '#4a331d');
      }
      // Cyan flame
      p(7, 2, '#d6ffff');
      p(8, 3, '#a6fbff');
      p(6, 4, '#2cd8f5');
      p(7, 4, '#b8fcff');
      p(8, 4, '#6cf2ff');
      p(9, 4, '#1cb4d6');
      p(6, 5, '#19a3c4');
      p(7, 5, '#59ecff');
      p(8, 5, '#2bd4f2');
      p(9, 5, '#148aa8');
      p(7, 6, '#147f9c');
      p(8, 6, '#147f9c');
    });

    // (8,13) Soul Lantern (iron cage + electric cyan soul core)
    this.drawTile(ctx, 8, 13, (p) => {
      p(7, 1, '#585d66');
      p(8, 1, '#444850');
      p(7, 2, '#444850');
      p(8, 2, '#585d66');
      for (let x = 5; x <= 10; x++) {
        p(x, 3, '#3c4048');
        p(x, 4, '#4e535c');
        p(x, 12, '#3c4048');
        p(x, 13, '#2b2e34');
      }
      for (let y = 5; y <= 11; y++) {
        p(4, y, '#3c4048');
        p(11, y, '#2e3138');
        for (let x = 5; x <= 10; x++) {
          const core = x >= 6 && x <= 9 && y >= 6 && y <= 10;
          const bar = x === 5 || x === 10;
          p(x, y, bar ? '#198ca8' : core ? '#c2feff' : '#32dcf5');
        }
      }
    });

    // (9,13) Campfire Top (crossed oak logs + glowing ember bed) & (10,13) Side
    this.drawTile(ctx, 9, 13, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const log = (y <= 3 || y >= 12) || (x <= 3 || x >= 12);
          const n = (rand() - 0.5) * 18;
          if (log) {
            p(x, y, rgb(104 + n, 72 + n * 0.8, 42 + n * 0.6));
          } else {
            const hot = rand() < 0.35;
            p(x, y, hot ? '#ffcf38' : rand() < 0.7 ? '#ff6914' : '#3b1e14');
          }
        }
      }
    });
    this.drawTile(ctx, 10, 13, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const n = (rand() - 0.5) * 16;
          if (y < 6) {
            const tongue = (x >= 4 && x <= 11 && y >= 2) || (x >= 6 && x <= 9);
            if (tongue) {
              p(x, y, y <= 2 ? '#ff6a14' : y <= 4 ? '#ffb824' : '#fff08a');
            }
          } else {
            const logSeam = y === 10 || y === 11;
            const end = x <= 2 || x >= 13;
            if (logSeam) {
              p(x, y, '#291c12');
            } else if (end) {
              p(x, y, rgb(156 + n, 118 + n * 0.8, 72 + n * 0.6));
            } else {
              p(x, y, rgb(108 + n, 74 + n * 0.8, 44 + n * 0.6));
            }
          }
        }
      }
    });

    // (11,13) Barrel Top (oak lid + iron latch handle) & (12,13) Barrel Side (vertical staves + iron hoops)
    this.drawTile(ctx, 11, 13, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const rim = x === 0 || x === 15 || y === 0 || y === 15;
          const handle = y === 4 && x >= 6 && x <= 9;
          const seam = x % 4 === 0;
          const n = (rand() - 0.5) * 14;
          if (handle) {
            p(x, y, '#2c2f36');
          } else if (rim) {
            p(x, y, rgb(86 + n * 0.5, 58 + n * 0.4, 34 + n * 0.3));
          } else {
            const d = seam ? -18 : 0;
            p(x, y, rgb(146 + d + n, 104 + d * 0.8 + n * 0.7, 62 + d * 0.6 + n * 0.5));
          }
        }
      }
    });
    this.drawTile(ctx, 12, 13, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        const hoop = y === 2 || y === 3 || y === 12 || y === 13;
        for (let x = 0; x < 16; x++) {
          const n = (rand() - 0.5) * 14;
          if (hoop) {
            const rivet = x % 5 === 2 && (y === 2 || y === 12);
            p(x, y, rivet ? '#888e99' : rgb(62 + n * 0.5, 66 + n * 0.5, 74 + n * 0.5));
          } else {
            const seam = x % 4 === 0 ? -18 : 0;
            p(x, y, rgb(144 + seam + n, 102 + seam * 0.8 + n * 0.7, 60 + seam * 0.6 + n * 0.5));
          }
        }
      }
    });

    // (13,13) Smithing Table Top (dark forged iron anvil plate) & (14,13) Side (dark mahogany + hammer/tongs)
    this.drawTile(ctx, 13, 13, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const border = x <= 1 || x >= 14 || y <= 1 || y >= 14;
          const n = (rand() - 0.5) * 12;
          const v = border ? 44 + n : 68 + n;
          p(x, y, rgb(v, v + 3, v + 10));
        }
      }
    });
    this.drawTile(ctx, 14, 13, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const n = (rand() - 0.5) * 12;
          if (y < 4) {
            p(x, y, rgb(58 + n, 62 + n, 72 + n));
          } else {
            const leg = x <= 2 || x >= 13;
            p(x, y, leg ? rgb(54 + n * 0.5, 28 + n * 0.4, 24 + n * 0.4) : rgb(82 + n, 44 + n * 0.6, 36 + n * 0.5));
          }
        }
      }
      // Small iron hammer icon on side
      for (let y = 6; y <= 11; y++) p(7, y, '#c29258');
      for (let x = 5; x <= 9; x++) {
        p(x, 6, '#bfc6d1');
        p(x, 7, '#8e96a3');
      }
    });

    // (15,13) Cartography Table Top (parchment map with compass rose) & (16,13) Side
    this.drawTile(ctx, 15, 13, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const frame = x <= 1 || x >= 14 || y <= 1 || y >= 14;
          const n = (rand() - 0.5) * 12;
          if (frame) {
            p(x, y, rgb(110 + n, 74 + n * 0.7, 42 + n * 0.5));
          } else {
            const river = (x === 6 && y >= 3 && y <= 10) || (y === 9 && x >= 6 && x <= 12);
            const green = x >= 9 && x <= 12 && y >= 3 && y <= 6;
            p(x, y, river ? '#4e91c7' : green ? '#7aa856' : rgb(224 + n, 206 + n, 162 + n));
          }
        }
      }
    });
    this.drawTile(ctx, 16, 13, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const n = (rand() - 0.5) * 12;
          const post = x <= 2 || x >= 13 || y <= 2;
          p(x, y, post ? rgb(98 + n, 64 + n * 0.7, 36 + n * 0.5) : rgb(138 + n, 94 + n * 0.7, 54 + n * 0.5));
        }
      }
      for (let y = 5; y <= 11; y++) {
        for (let x = 4; x <= 11; x++) {
          p(x, y, y === 5 || y === 11 ? '#c7ae7b' : '#e6d3a3');
        }
      }
    });

    // (17,13) Stonecutter Top (stone base + central metallic saw slot) & (18,13) Side
    this.drawTile(ctx, 17, 13, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const slot = y === 7 || y === 8;
          const blade = slot && x >= 3 && x <= 12 && x % 2 === 0;
          const n = (rand() - 0.5) * 14;
          if (blade) {
            p(x, y, '#dce3ed');
          } else if (slot && x >= 2 && x <= 13) {
            p(x, y, '#2b2e34');
          } else {
            const v = 148 + n;
            p(x, y, rgb(v, v + 1, v + 3));
          }
        }
      }
    });
    this.drawTile(ctx, 18, 13, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const n = (rand() - 0.5) * 16;
          if (y < 6) {
            // Protruding toothed iron sawblade silhouette
            const d = Math.hypot(x - 7.5, y - 6);
            if (d <= 5.2 && d >= 1.5) {
              p(x, y, (x + y) % 2 === 0 ? '#dce3ed' : '#9aa3b0');
            }
          } else {
            const mortar = y === 6 || y === 11 || x === 0 || x === 8;
            const v = mortar ? 86 : 142 + n;
            p(x, y, rgb(v, v + 1, v + 3));
          }
        }
      }
    });

    // (19,13) Composter Top (wooden bin walls + dark rich compost soil) & (20,13) Side
    this.drawTile(ctx, 19, 13, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const rim = x <= 1 || x >= 14 || y <= 1 || y >= 14;
          const n = (rand() - 0.5) * 16;
          if (rim) {
            p(x, y, rgb(142 + n, 98 + n * 0.7, 54 + n * 0.5));
          } else {
            const leaf = rand() < 0.16;
            p(x, y, leaf ? '#6a8a38' : rgb(84 + n, 58 + n * 0.7, 34 + n * 0.5));
          }
        }
      }
    });
    this.drawTile(ctx, 20, 13, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        const band = y === 3 || y === 12;
        for (let x = 0; x < 16; x++) {
          const n = (rand() - 0.5) * 14;
          const slat = x % 3 === 0 ? -16 : 0;
          if (band) {
            p(x, y, rgb(92 + n * 0.5, 62 + n * 0.4, 34 + n * 0.3));
          } else {
            p(x, y, rgb(146 + slat + n, 102 + slat * 0.7 + n * 0.7, 58 + slat * 0.5 + n * 0.5));
          }
        }
      }
    });

    // (21,13) Cauldron Top (cast-iron rim + dark water interior) & (22,13) Side (cast iron + feet)
    this.drawTile(ctx, 21, 13, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const rim = x <= 1 || x >= 14 || y <= 1 || y >= 14;
          const n = (rand() - 0.5) * 12;
          if (rim) {
            const v = 78 + n;
            p(x, y, rgb(v, v + 2, v + 5));
          } else {
            p(x, y, rgb(42 + n * 0.4, 78 + n * 0.5, 118 + n * 0.6));
          }
        }
      }
    });
    this.drawTile(ctx, 22, 13, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const n = (rand() - 0.5) * 12;
          const notch = y >= 13 && x >= 5 && x <= 10;
          if (notch) {
            p(x, y, '#1e2026');
          } else {
            const rim = y <= 1 ? 16 : y === 2 ? -14 : 0;
            const v = 68 + rim + n;
            p(x, y, rgb(v, v + 2, v + 6));
          }
        }
      }
    });

    // (23,13) Oak Trapdoor (framed oak grate with 4 transparent window cutouts)
    this.drawTile(ctx, 23, 13, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const hole =
            ((x >= 3 && x <= 6) || (x >= 9 && x <= 12)) &&
            ((y >= 3 && y <= 6) || (y >= 9 && y <= 12));
          if (hole) continue;
          const edge = x === 0 || x === 15 || y === 0 || y === 15;
          const n = (rand() - 0.5) * 14;
          const d = edge ? -22 : 0;
          p(x, y, rgb(164 + d + n, 118 + d * 0.8 + n * 0.7, 66 + d * 0.6 + n * 0.5));
        }
      }
      // Iron hinge bolts
      p(2, 1, '#585d66');
      p(13, 1, '#585d66');
      p(7, 14, '#c4cbd4');
      p(8, 14, '#8b929c');
    });

    // (24,13) Iron Bars (thin metallic grating with open transparent spacing)
    this.drawTile(ctx, 24, 13, (p) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const vBar = x === 3 || x === 4 || x === 11 || x === 12;
          const hBar = y === 3 || y === 12 || ((y === 7 || y === 8) && x >= 3 && x <= 12);
          if (vBar || hBar) {
            const hi = x === 3 || x === 11 || y === 3 || y === 12;
            p(x, y, hi ? '#a8b0bc' : '#565c66');
          }
        }
      }
    });

    // (25,13) Note Block (warm acoustic mahogany box with carved treble note speaker grille)
    this.drawTile(ctx, 25, 13, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const border = x === 0 || x === 15 || y === 0 || y === 15;
          const n = (rand() - 0.5) * 14;
          p(x, y, border ? rgb(72 + n * 0.4, 40 + n * 0.3, 24 + n * 0.3) : rgb(134 + n, 78 + n * 0.7, 48 + n * 0.5));
        }
      }
      // Carved musical note emblem
      const note = [
        [6, 10], [7, 10], [6, 11], [7, 11],
        [7, 5], [7, 6], [7, 7], [7, 8], [7, 9],
        [8, 5], [9, 5], [10, 5], [10, 6], [10, 7],
      ];
      for (const [nx, ny] of note) p(nx, ny, '#2e160d');
    });

    // (26,13) Slime Block (translucent bright jelly lime outer shell + dense inner core)
    this.drawTile(ctx, 26, 13, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const inner = x >= 4 && x <= 11 && y >= 4 && y <= 11;
          const bubble = (x === 5 && y === 5) || (x === 6 && y === 5) || (x === 10 && y === 9);
          const n = (rand() - 0.5) * 16;
          if (bubble) {
            p(x, y, 'rgba(218, 255, 184, 0.92)');
          } else if (inner) {
            p(x, y, rgb(96 + n, 198 + n, 64 + n * 0.5, 0.92));
          } else {
            p(x, y, rgb(124 + n, 224 + n, 88 + n * 0.5, 0.68));
          }
        }
      }
    });

    // (27,13) Bone Block Top (concentric bone marrow cross-section) & (28,13) Side (fluted ivory pillars)
    this.drawTile(ctx, 27, 13, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const d = Math.hypot(x - 7.5, y - 7.5);
          const n = (rand() - 0.5) * 12;
          const shade = d < 2.8 ? -28 : d < 5.5 ? -8 : 8;
          p(x, y, rgb(232 + shade + n, 226 + shade + n, 204 + shade + n));
        }
      }
    });
    this.drawTile(ctx, 28, 13, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const ridge = x % 4 === 0 ? -18 : x % 4 === 2 ? 10 : 0;
          const cap = y <= 1 || y >= 14 ? 8 : 0;
          const n = (rand() - 0.5) * 10;
          p(x, y, rgb(232 + ridge + cap + n, 226 + ridge + cap + n, 206 + ridge + cap + n));
        }
      }
    });

    // (29,13) Prismarine (oceanic cobbled teal shards) & (30,13) Prismarine Bricks (clean teal masonry)
    this.drawTile(ctx, 29, 13, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const crack = (x * 5 + y * 7) % 13 === 0 || (x === 0 || y === 0);
          const n = (rand() - 0.5) * 22;
          if (crack) {
            p(x, y, rgb(42 + n * 0.4, 96 + n * 0.5, 92 + n * 0.5));
          } else {
            p(x, y, rgb(84 + n, 162 + n, 148 + n));
          }
        }
      }
    });
    this.drawTile(ctx, 30, 13, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        const row = Math.floor(y / 4);
        const mortarY = y % 4 === 0;
        const off = (row % 2) * 4;
        for (let x = 0; x < 16; x++) {
          const mortarX = (x + off) % 8 === 0;
          const n = (rand() - 0.5) * 14;
          if (mortarY || mortarX) {
            p(x, y, rgb(46 + n * 0.4, 108 + n * 0.5, 98 + n * 0.5));
          } else {
            const hi = y % 4 === 1 ? 14 : 0;
            p(x, y, rgb(86 + hi + n, 182 + hi + n, 164 + hi + n));
          }
        }
      }
    });
  }

  /**
   * Procedurally renders a 16x16 color-tinted material tile (Wool, Concrete, Terracotta, or Stained Glass).
   */
  public generateTintedTile(
    ctx: CanvasRenderingContext2D,
    tx: number,
    ty: number,
    basePattern: 'wool' | 'concrete' | 'terracotta' | 'stained_glass',
    hexColor: string
  ): void {
    const [br, bg, bb] = hexToRgb(hexColor);
    this.drawTile(ctx, tx, ty, (p, rand) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          if (basePattern === 'wool') {
            const weave = (x + y) % 2 === 0 ? 9 : -9;
            const knot = (x % 4 === 0 && y % 4 === 0) ? -12 : 0;
            const n = (rand() - 0.5) * 14 + weave + knot;
            p(x, y, rgb(br + n, bg + n, bb + n));
          } else if (basePattern === 'concrete') {
            const n = (rand() - 0.5) * 9;
            p(x, y, rgb(br + n, bg + n, bb + n));
          } else if (basePattern === 'terracotta') {
            const band = Math.sin(y * 0.65) * 6;
            const n = (rand() - 0.5) * 15 + band;
            p(x, y, rgb(br + n, bg + n, bb + n));
          } else {
            // stained_glass
            const border = x === 0 || x === 15 || y === 0 || y === 15;
            const glint =
              (x === 3 && y === 3) || (x === 4 && y === 2) || (x === 2 && y === 4) ||
              (x === 11 && y === 12) || (x === 12 && y === 11);
            if (border) {
              p(x, y, rgb(br * 0.92 + 20, bg * 0.92 + 20, bb * 0.92 + 20, 0.94));
            } else if (glint) {
              p(x, y, rgb(Math.min(255, br + 110), Math.min(255, bg + 110), Math.min(255, bb + 110), 0.85));
            } else {
              p(x, y, rgb(br, bg, bb, 0.46));
            }
          }
        }
      }
    });
  }

  /**
   * Generates 10 progressive crack overlay textures (stages 0..9) for block mining feedback.
   */
  private generateCrackTextures(): void {
    for (let stage = 0; stage < 10; stage++) {
      const c = document.createElement('canvas');
      c.width = 16;
      c.height = 16;
      const ctx = c.getContext('2d')!;
      ctx.clearRect(0, 0, 16, 16);

      const rand = seededRand(5001);
      const branches = 2 + Math.floor(stage * 0.9);
      const maxSteps = 2 + stage * 1.4;

      ctx.fillStyle = `rgba(10, 10, 10, ${(0.35 + stage * 0.06).toFixed(2)})`;
      for (let b = 0; b < branches; b++) {
        let cx = 8 + Math.floor((rand() - 0.5) * 4);
        let cy = 8 + Math.floor((rand() - 0.5) * 4);
        const angle = (b / branches) * Math.PI * 2 + rand() * 0.7;
        for (let s = 0; s < maxSteps; s++) {
          ctx.fillRect(Math.round(cx), Math.round(cy), 1, 1);
          if (stage >= 5 && s % 2 === 0) {
            ctx.fillRect(Math.round(cx) + 1, Math.round(cy), 1, 1);
          }
          cx += Math.cos(angle + (rand() - 0.5) * 1.1);
          cy += Math.sin(angle + (rand() - 0.5) * 1.1);
        }
      }

      const tex = new THREE.CanvasTexture(c);
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.generateMipmaps = false;
      tex.needsUpdate = true;
      this.crackTextures.push(tex);
    }
  }

  /**
   * Generates crisp DataURL icons for every block and item (tools, coal, iron ingot, food)
   * directly from the offscreen procedural canvases for React HUD/Inventory/Crafting/Furnace UI.
   */
  private generateAllItemIcons(): void {
    // 1. Block icons rendered as crisp mini isometric 3D cubes (or flat sprites for Torch, Door, Ladder, Lantern & crossMesh plants)
    for (const key of Object.keys(BLOCKS)) {
      const id = Number(key);
      if (id === 0 || id === 5) continue;
      const b = BLOCKS[id];
      if (
        id === BLOCK_IDS.TORCH ||
        b.isSoulTorch ||
        b.crossMesh ||
        b.isDoor ||
        b.isDoorOpen ||
        b.isLadder ||
        b.isLantern ||
        b.isIronBars ||
        b.isTrapdoor ||
        b.isCampfire
      ) {
        this.iconDataUrls[String(id)] = this.extractTileDataUrl(b.uvs.side[0], b.uvs.side[1]);
      } else {
        this.iconDataUrls[String(id)] = this.renderIsometricBlockIcon(
          b.uvs.top,
          b.uvs.front ?? b.uvs.side,
          b.uvs.side,
          Boolean(b.isHalfHeight || b.isEnchantingTable)
        );
      }
    }

    // 2. Non-block items & tools drawn pixel-by-pixel on 16x16 offscreen canvas
    const drawIcon = (id: ItemId, fn: (p: (x: number, y: number, color: string) => void) => void) => {
      const c = document.createElement('canvas');
      c.width = 16;
      c.height = 16;
      const ctx = c.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      fn((x, y, color) => {
        if (x >= 0 && x < 16 && y >= 0 && y < 16) {
          ctx.fillStyle = color;
          ctx.fillRect(x, y, 1, 1);
        }
      });
      this.iconDataUrls[String(id)] = c.toDataURL('image/png');
    };

    // Stick
    drawIcon('stick', (p) => {
      for (let i = 3; i <= 12; i++) {
        p(i, 15 - i, '#7d562d');
        p(i, 14 - i, '#a17340');
      }
    });

    // Coal
    drawIcon('coal', (p) => {
      const pts = [
        [6, 4], [7, 4], [8, 4], [9, 4],
        [5, 5], [6, 5], [7, 5], [8, 5], [9, 5], [10, 5],
        [4, 6], [5, 6], [6, 6], [7, 6], [8, 6], [9, 6], [10, 6], [11, 6],
        [4, 7], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [10, 7], [11, 7],
        [4, 8], [5, 8], [6, 8], [7, 8], [8, 8], [9, 8], [10, 8], [11, 8],
        [5, 9], [6, 9], [7, 9], [8, 9], [9, 9], [10, 9],
        [6, 10], [7, 10], [8, 10], [9, 10],
      ];
      for (const [x, y] of pts) {
        p(x, y, (x + y) % 3 === 0 ? '#40424a' : '#222328');
      }
      p(6, 5, '#595c66');
      p(7, 5, '#595c66');
    });

    // Iron Ingot
    drawIcon('iron_ingot', (p) => {
      for (let y = 6; y <= 10; y++) {
        for (let x = 3; x <= 12; x++) {
          if ((y === 6 && (x < 5 || x > 10)) || (y === 10 && (x < 4 || x > 11))) continue;
          const top = y <= 7;
          p(x, y, top ? '#e9eef2' : y === 8 ? '#c3cbd1' : '#8d969e');
        }
      }
      p(6, 7, '#ffffff');
      p(7, 7, '#ffffff');
    });

    // Gold Ingot
    drawIcon('gold_ingot', (p) => {
      for (let y = 6; y <= 10; y++) {
        for (let x = 3; x <= 12; x++) {
          if ((y === 6 && (x < 5 || x > 10)) || (y === 10 && (x < 4 || x > 11))) continue;
          const top = y <= 7;
          p(x, y, top ? '#fff07c' : y === 8 ? '#f2c12e' : '#b88212');
        }
      }
      p(6, 7, '#ffffff');
      p(7, 7, '#fff9bd');
    });

    // Diamond Gem
    drawIcon('diamond', (p) => {
      const pts = [
        [6, 3], [7, 3], [8, 3], [9, 3],
        [4, 4], [5, 4], [6, 4], [7, 4], [8, 4], [9, 4], [10, 4], [11, 4],
        [3, 5], [4, 5], [5, 5], [6, 5], [7, 5], [8, 5], [9, 5], [10, 5], [11, 5], [12, 5],
        [3, 6], [4, 6], [5, 6], [6, 6], [7, 6], [8, 6], [9, 6], [10, 6], [11, 6], [12, 6],
        [4, 7], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [10, 7], [11, 7],
        [5, 8], [6, 8], [7, 8], [8, 8], [9, 8], [10, 8],
        [6, 9], [7, 9], [8, 9], [9, 9],
        [7, 10], [8, 10],
      ];
      for (const [x, y] of pts) {
        const hi = y <= 5 && x <= 8;
        const rim = y >= 9 || x === 12 || x === 3;
        p(x, y, hi ? '#a8ffff' : rim ? '#1997a8' : '#3ce6ed');
      }
      p(5, 5, '#ffffff');
      p(6, 5, '#ffffff');
    });

    // Emerald Gem
    drawIcon('emerald', (p) => {
      for (let y = 3; y <= 12; y++) {
        for (let x = 5; x <= 10; x++) {
          if ((y === 3 || y === 12) && (x === 5 || x === 10)) continue;
          const border = x === 5 || x === 10 || y === 3 || y === 12;
          const hi = x <= 7 && y <= 6;
          p(x, y, border ? '#0b6e35' : hi ? '#80ffb5' : '#1fd169');
        }
      }
      p(6, 5, '#d9ffe8');
      p(7, 5, '#ffffff');
    });

    // Wheat bundle
    drawIcon('wheat', (p) => {
      for (let i = 0; i < 10; i++) {
        const x = 3 + i;
        const y = 12 - i;
        p(x, y, i > 4 ? '#f2cc52' : '#96a83b');
        p(x + 1, y, i > 4 ? '#d4a12a' : '#7a8f2e');
        if (i > 4) p(x, y - 1, '#ffe480');
      }
      p(6, 9, '#9e5324');
      p(7, 10, '#9e5324');
    });

    // Bread loaf
    drawIcon('bread', (p) => {
      for (let y = 5; y <= 11; y++) {
        for (let x = 3; x <= 12; x++) {
          if ((y === 5 || y === 11) && (x === 3 || x === 12)) continue;
          const top = y <= 7;
          const crust = y === 5 || y === 11 || x === 3 || x === 12;
          const slash = (x === 6 && y === 6) || (x === 9 && y === 6);
          p(x, y, slash ? '#f5dc9d' : crust ? '#8a5221' : top ? '#d69747' : '#b87832');
        }
      }
    });

    // Apple
    drawIcon('apple', (p) => {
      p(8, 3, '#6e4722');
      p(9, 2, '#5c391a');
      p(10, 3, '#4da836');
      p(11, 3, '#3b8728');
      for (let y = 5; y <= 12; y++) {
        for (let x = 4; x <= 11; x++) {
          const d = Math.hypot(x - 7.5, y - 8.5);
          if (d <= 4.1 && !(y === 5 && (x === 7 || x === 8))) {
            p(x, y, d > 3.2 ? '#9e1919' : (x <= 6 && y <= 7) ? '#ff7070' : '#db2525');
          }
        }
      }
      p(6, 7, '#ffd4d4');
    });

    // Raw Porkchop
    drawIcon('raw_porkchop', (p) => {
      for (let y = 5; y <= 11; y++) {
        for (let x = 3; x <= 12; x++) {
          if (Math.hypot(x - 7.5, y - 8) < 4.4) {
            const rim = Math.hypot(x - 7.5, y - 8) > 3.3;
            p(x, y, rim ? '#f5d2d2' : (x + y) % 3 === 0 ? '#e37e84' : '#f09ba0');
          }
        }
      }
    });

    // Cooked Porkchop
    drawIcon('cooked_porkchop', (p) => {
      for (let y = 5; y <= 11; y++) {
        for (let x = 3; x <= 12; x++) {
          if (Math.hypot(x - 7.5, y - 8) < 4.4) {
            const rim = Math.hypot(x - 7.5, y - 8) > 3.3;
            p(x, y, rim ? '#7a4524' : (x + y) % 3 === 0 ? '#b8723d' : '#c9854c');
          }
        }
      }
    });

    // Rotten Flesh
    drawIcon('rotten_flesh', (p) => {
      for (let y = 4; y <= 12; y++) {
        for (let x = 4; x <= 11; x++) {
          if (Math.abs(x - 7.5) + Math.abs(y - 8) < 5.2) {
            p(x, y, (x * 3 + y) % 4 === 0 ? '#658042' : '#8a513b');
          }
        }
      }
    });

    // Tools generator (Wood, Stone, Iron, Gold, Diamond, Netherite)
    const tiers: Array<{ key: 'wood' | 'stone' | 'iron' | 'gold' | 'diamond' | 'netherite'; hi: string; mid: string; lo: string; hasHoe: boolean }> = [
      { key: 'wood', hi: '#c2995a', mid: '#9c743e', lo: '#6e4e26', hasHoe: true },
      { key: 'stone', hi: '#b2b6ba', mid: '#84888c', lo: '#575a5e', hasHoe: true },
      { key: 'iron', hi: '#f2f6fa', mid: '#c6ced6', lo: '#7d8690', hasHoe: true },
      { key: 'gold', hi: '#fff380', mid: '#f2c12e', lo: '#b57f10', hasHoe: false },
      { key: 'diamond', hi: '#9efcff', mid: '#3be3eb', lo: '#178fa1', hasHoe: true },
      { key: 'netherite', hi: '#7b6c80', mid: '#4e4452', lo: '#2a242d', hasHoe: true },
    ];

    for (const t of tiers) {
      // Pickaxe
      drawIcon(`${t.key}_pickaxe` as ItemId, (p) => {
        for (let i = 2; i <= 10; i++) {
          p(i, 15 - i, '#7a522a');
          p(i + 1, 15 - i, '#593b1d');
        }
        const head = [
          [5, 2], [6, 2], [7, 2], [8, 2], [9, 2], [10, 2], [11, 2],
          [11, 3], [12, 3], [12, 4], [13, 4], [13, 5], [13, 6], [13, 7], [13, 8],
          [10, 3], [11, 4], [12, 5], [12, 6], [12, 7],
        ];
        for (const [x, y] of head) {
          p(x, y, y <= 3 ? t.hi : x >= 13 ? t.lo : t.mid);
        }
      });

      // Axe
      drawIcon(`${t.key}_axe` as ItemId, (p) => {
        for (let i = 2; i <= 11; i++) {
          p(i, 15 - i, '#7a522a');
        }
        for (let y = 2; y <= 7; y++) {
          for (let x = 7; x <= 12; x++) {
            if (x + y < 11 || x + y > 18) continue;
            p(x, y, y <= 3 ? t.hi : x === 12 ? t.lo : t.mid);
          }
        }
      });

      // Shovel
      drawIcon(`${t.key}_shovel` as ItemId, (p) => {
        for (let i = 2; i <= 10; i++) {
          p(i, 15 - i, '#7a522a');
        }
        for (let y = 2; y <= 6; y++) {
          for (let x = 9; x <= 13; x++) {
            if (x === 9 && y === 2) continue;
            if (x === 13 && y === 6) continue;
            p(x, y, y <= 3 ? t.hi : x === 13 ? t.lo : t.mid);
          }
        }
      });

      // Sword
      drawIcon(`${t.key}_sword` as ItemId, (p) => {
        p(2, 13, '#593b1d');
        p(3, 12, '#7a522a');
        p(4, 11, '#7a522a');
        p(3, 9, '#5e4526');
        p(4, 10, '#5e4526');
        p(5, 11, '#5e4526');
        p(6, 12, '#5e4526');
        for (let i = 5; i <= 13; i++) {
          p(i, 15 - i, t.hi);
          p(i, 16 - i, t.mid);
          if (i < 13) p(i + 1, 16 - i, t.lo);
        }
      });

      // Hoe
      if (t.hasHoe) {
        drawIcon(`${t.key}_hoe` as ItemId, (p) => {
          for (let i = 2; i <= 10; i++) {
            p(i, 15 - i, '#7a522a');
            p(i + 1, 15 - i, '#593b1d');
          }
          const blade = [
            [6, 3], [7, 3], [8, 3], [9, 3], [10, 3], [11, 3],
            [7, 4], [8, 4], [9, 4], [10, 4], [11, 4], [12, 4], [12, 5],
          ];
          for (const [x, y] of blade) {
            p(x, y, y === 3 ? t.hi : x >= 12 ? t.lo : t.mid);
          }
        });
      }
    }

    // Armor icons (Leather, Iron, Diamond, Netherite)
    const armorTiers: Array<{ key: 'leather' | 'iron' | 'diamond' | 'netherite'; hi: string; mid: string; lo: string }> = [
      { key: 'leather', hi: '#c98e55', mid: '#9e6635', lo: '#6b411d' },
      { key: 'iron', hi: '#f0f4f8', mid: '#bfc8d1', lo: '#78828c' },
      { key: 'diamond', hi: '#9efcff', mid: '#3be3eb', lo: '#178fa1' },
      { key: 'netherite', hi: '#7b6c80', mid: '#4e4452', lo: '#2a242d' },
    ];

    for (const a of armorTiers) {
      // Helmet
      drawIcon(`${a.key}_helmet` as ItemId, (p) => {
        for (let y = 3; y <= 11; y++) {
          for (let x = 3; x <= 12; x++) {
            if (y === 3 && (x === 3 || x === 12)) continue;
            if (y >= 8 && x >= 5 && x <= 10) continue; // visor opening
            const col = y <= 5 ? a.hi : x <= 4 || x >= 11 ? a.lo : a.mid;
            p(x, y, col);
          }
        }
      });

      // Chestplate
      drawIcon(`${a.key}_chestplate` as ItemId, (p) => {
        for (let y = 2; y <= 13; y++) {
          for (let x = 2; x <= 13; x++) {
            if (y <= 4 && x >= 6 && x <= 9) continue; // neck cutout
            if (y >= 8 && (x <= 3 || x >= 12)) continue; // sleeve bottom
            const col = y <= 4 || x === 7 ? a.hi : x === 2 || x === 13 || y === 13 ? a.lo : a.mid;
            p(x, y, col);
          }
        }
      });

      // Leggings
      drawIcon(`${a.key}_leggings` as ItemId, (p) => {
        for (let y = 2; y <= 13; y++) {
          for (let x = 4; x <= 11; x++) {
            if (y >= 7 && x >= 7 && x <= 8) continue; // gap between legs
            const col = y <= 3 ? a.hi : x === 4 || x === 11 || y === 13 ? a.lo : a.mid;
            p(x, y, col);
          }
        }
      });

      // Boots
      drawIcon(`${a.key}_boots` as ItemId, (p) => {
        for (let y = 6; y <= 13; y++) {
          // Left boot
          for (let x = 2; x <= 6; x++) {
            if (y <= 9 && x === 2) continue;
            p(x, y, y === 6 ? a.hi : y === 13 ? a.lo : a.mid);
          }
          // Right boot
          for (let x = 9; x <= 13; x++) {
            if (y <= 9 && x === 13) continue;
            p(x, y, y === 6 ? a.hi : y === 13 ? a.lo : a.mid);
          }
        }
      });
    }

    // Nether items icons
    drawIcon('flint', (p) => {
      const pts = [
        [7, 3], [8, 3], [6, 4], [7, 4], [8, 4], [9, 4],
        [5, 5], [6, 5], [7, 5], [8, 5], [9, 5], [10, 5],
        [4, 6], [5, 6], [6, 6], [7, 6], [8, 6], [9, 6], [10, 6], [11, 6],
        [4, 7], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [10, 7], [11, 7],
        [4, 8], [5, 8], [6, 8], [7, 8], [8, 8], [9, 8], [10, 8], [11, 8],
        [5, 9], [6, 9], [7, 9], [8, 9], [9, 9], [10, 9],
        [5, 10], [6, 10], [7, 10], [8, 10], [9, 10],
        [6, 11], [7, 11], [8, 11],
      ];
      for (const [x, y] of pts) {
        p(x, y, y <= 5 ? '#7c7f85' : x >= 10 || y >= 10 ? '#24262b' : '#4a4d54');
      }
    });

    drawIcon('flint_and_steel', (p) => {
      // Curved steel C-striker (left/top)
      const steel = [
        [4, 3], [5, 3], [6, 3], [7, 3],
        [3, 4], [4, 4], [7, 4], [8, 4],
        [3, 5], [3, 6], [3, 7], [3, 8],
        [4, 8], [4, 9], [5, 9],
      ];
      for (const [x, y] of steel) p(x, y, x <= 4 ? '#edf2f7' : '#9aa4b0');
      // Dark flint pebble (bottom-right)
      for (let y = 8; y <= 13; y++) {
        for (let x = 8; x <= 13; x++) {
          if (x + y < 17 || x + y > 25) continue;
          p(x, y, y <= 9 ? '#5b5f66' : '#26282e');
        }
      }
      // Spark between them
      p(7, 7, '#ffe066');
      p(8, 6, '#ff922b');
    });

    drawIcon('nether_quartz', (p) => {
      const pts = [
        [7, 2], [8, 2], [6, 3], [7, 3], [8, 3], [9, 3],
        [5, 4], [6, 4], [7, 4], [8, 4], [9, 4], [10, 4],
        [4, 5], [5, 5], [6, 5], [7, 5], [8, 5], [9, 5], [10, 5], [11, 5],
        [4, 6], [5, 6], [6, 6], [7, 6], [8, 6], [9, 6], [10, 6], [11, 6],
        [5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [10, 7],
        [5, 8], [6, 8], [7, 8], [8, 8], [9, 8], [10, 8],
        [6, 9], [7, 9], [8, 9], [9, 9], [7, 10], [8, 10],
      ];
      for (const [x, y] of pts) {
        p(x, y, y <= 4 ? '#ffffff' : x >= 10 || y >= 9 ? '#cfc6ba' : '#ede7de');
      }
    });

    drawIcon('glowstone_dust', (p) => {
      const specks = [
        [7, 3], [8, 4], [6, 5], [7, 5], [8, 5], [9, 5],
        [5, 6], [6, 6], [7, 6], [8, 6], [9, 6], [10, 6],
        [4, 7], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [10, 7], [11, 7],
        [5, 8], [6, 8], [7, 8], [8, 8], [9, 8], [10, 8],
        [6, 9], [7, 9], [8, 9], [9, 9], [5, 10], [8, 10], [10, 10],
      ];
      for (const [x, y] of specks) {
        p(x, y, (x + y) % 3 === 0 ? '#fff5a8' : (x + y) % 2 === 0 ? '#ffd43b' : '#e09f1f');
      }
    });

    drawIcon('blaze_rod', (p) => {
      for (let i = 2; i <= 13; i++) {
        p(i, 15 - i, '#fff3a1');
        p(i, 16 - i, '#ffae19');
        if (i < 13) p(i + 1, 16 - i, '#d96b0b');
      }
    });

    drawIcon('blaze_powder', (p) => {
      const specks = [
        [6, 4], [8, 4], [5, 5], [7, 5], [9, 5], [10, 5],
        [4, 6], [6, 6], [7, 6], [8, 6], [9, 6], [11, 6],
        [5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [10, 7],
        [4, 8], [6, 8], [7, 8], [8, 8], [10, 8],
        [6, 9], [7, 9], [9, 9], [7, 10],
      ];
      for (const [x, y] of specks) {
        p(x, y, (x + y) % 3 === 0 ? '#ffe066' : (x + y) % 2 === 0 ? '#ff8c1a' : '#e0480b');
      }
    });

    drawIcon('gold_nugget', (p) => {
      for (let y = 5; y <= 10; y++) {
        for (let x = 5; x <= 10; x++) {
          if ((x === 5 || x === 10) && (y === 5 || y === 10)) continue;
          p(x, y, y <= 6 ? '#fff28c' : x >= 9 || y >= 9 ? '#b87d14' : '#f5c527');
        }
      }
    });

    drawIcon('ghast_tear', (p) => {
      const tear = [
        [7, 2], [8, 2], [7, 3], [8, 3],
        [6, 4], [7, 4], [8, 4], [9, 4],
        [5, 5], [6, 5], [7, 5], [8, 5], [9, 5], [10, 5],
        [5, 6], [6, 6], [7, 6], [8, 6], [9, 6], [10, 6],
        [5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [10, 7],
        [5, 8], [6, 8], [7, 8], [8, 8], [9, 8], [10, 8],
        [6, 9], [7, 9], [8, 9], [9, 9],
        [7, 10], [8, 10],
      ];
      for (const [x, y] of tear) {
        p(x, y, x <= 6 && y <= 7 ? '#ffffff' : y >= 9 ? '#93c5d4' : '#d8f1f7');
      }
    });

    // =========================================================================
    // MEGA-EXPANSION PIXEL-ART ICONS (Bow, Arrow, Shears, Buckets, Foods, Materials, Dyes)
    // =========================================================================
    // Bow
    drawIcon('bow', (p) => {
      const arc = [[4, 2], [5, 2], [6, 3], [7, 3], [8, 4], [9, 5], [10, 6], [11, 7], [11, 8], [12, 9], [12, 10], [12, 11], [11, 12], [11, 13]];
      for (const [x, y] of arc) {
        p(x, y, '#8f5f32');
        p(x + 1, y, '#69421e');
      }
      for (let i = 0; i < 10; i++) {
        p(4 + Math.floor(i * 0.7), 3 + i, '#dcdcdc');
      }
    });

    // Arrow
    drawIcon('arrow', (p) => {
      for (let i = 3; i <= 11; i++) {
        p(i, 15 - i, '#8c6234');
      }
      // Flint tip
      p(11, 3, '#c8cfd6');
      p(12, 3, '#e8eef5');
      p(12, 4, '#9aa3ad');
      p(10, 3, '#88919b');
      // White fletching
      p(2, 12, '#f5f5f5');
      p(3, 13, '#e0e0e0');
      p(4, 13, '#f5f5f5');
      p(2, 13, '#cccccc');
    });

    // Shears
    drawIcon('shears', (p) => {
      const blades = [[3, 3], [4, 4], [5, 5], [6, 6], [7, 7], [8, 8], [12, 3], [11, 4], [10, 5], [9, 6], [8, 7]];
      for (const [x, y] of blades) p(x, y, y <= 5 ? '#f0f4f8' : '#b2bcc6');
      // Red/iron finger handles
      const handles = [[4, 9], [5, 9], [4, 10], [6, 10], [4, 11], [5, 11], [9, 9], [10, 9], [11, 10], [9, 10], [10, 11], [11, 11]];
      for (const [x, y] of handles) p(x, y, '#c94038');
    });

    // Buckets (Empty, Water, Lava)
    const drawBucket = (id: ItemId, fill?: [string, string]) => {
      drawIcon(id, (p) => {
        for (let y = 5; y <= 12; y++) {
          const w = y <= 7 ? 5 : y <= 10 ? 4 : 3;
          for (let x = 8 - w; x < 8 + w; x++) {
            const rim = x === 8 - w || x === 7 + w || y === 12;
            p(x, y, rim ? '#6e7680' : x < 7 ? '#dde4ec' : '#a7b1bc');
          }
        }
        // Top oval
        for (let x = 4; x <= 11; x++) {
          p(x, 4, '#eef3f8');
          p(x, 5, fill ? fill[0] : '#4b5159');
          if (fill && x >= 5 && x <= 10) p(x, 6, fill[1]);
        }
      });
    };
    drawBucket('bucket');
    drawBucket('water_bucket', ['#3da4ff', '#1c78e0']);
    drawBucket('lava_bucket', ['#ffe047', '#ff6b14']);

    // Golden Apple
    drawIcon('golden_apple', (p) => {
      p(8, 3, '#7a5226');
      p(9, 2, '#63401c');
      p(10, 3, '#d9b532');
      for (let y = 5; y <= 12; y++) {
        for (let x = 4; x <= 11; x++) {
          const d = Math.hypot(x - 7.5, y - 8.5);
          if (d <= 4.1 && !(y === 5 && (x === 7 || x === 8))) {
            p(x, y, d > 3.2 ? '#b88212' : x <= 6 && y <= 7 ? '#fff8a8' : '#f7c928');
          }
        }
      }
      p(6, 7, '#ffffff');
    });

    // Cookie
    drawIcon('cookie', (p) => {
      for (let y = 4; y <= 11; y++) {
        for (let x = 4; x <= 11; x++) {
          if (Math.hypot(x - 7.5, y - 7.5) <= 4.1) {
            const chip = (x === 6 && y === 6) || (x === 9 && y === 6) || (x === 7 && y === 9) || (x === 10 && y === 9);
            p(x, y, chip ? '#4a2b16' : y <= 6 ? '#de9e52' : '#bd7d36');
          }
        }
      }
    });

    // Baked Potato
    drawIcon('baked_potato', (p) => {
      for (let y = 5; y <= 11; y++) {
        for (let x = 3; x <= 12; x++) {
          if (Math.hypot((x - 7.5) * 0.85, (y - 8) * 1.15) <= 3.7) {
            p(x, y, y <= 6 ? '#f5d27a' : y >= 10 ? '#9c6424' : '#d6993e');
          }
        }
      }
      p(6, 7, '#fff2bd');
      p(7, 7, '#fff2bd');
    });

    // Melon Slice
    drawIcon('melon_slice', (p) => {
      for (let y = 5; y <= 12; y++) {
        for (let x = 3; x <= 12; x++) {
          if (x + y < 14 || y > 11) continue;
          const rind = y === 11 || x === 12;
          const seed = (x === 7 && y === 8) || (x === 9 && y === 9) || (x === 10 && y === 7);
          p(x, y, rind ? '#4ea632' : seed ? '#261e1a' : '#f04248');
        }
      }
    });

    // Raw Beef & Cooked Beef
    drawIcon('raw_beef', (p) => {
      for (let y = 5; y <= 11; y++) {
        for (let x = 3; x <= 12; x++) {
          if (Math.hypot((x - 7.5) * 0.9, y - 8) < 4.2) {
            const rim = Math.hypot((x - 7.5) * 0.9, y - 8) > 3.2;
            p(x, y, rim ? '#f2c7c7' : (x + y) % 3 === 0 ? '#a82222' : '#d13434');
          }
        }
      }
    });
    drawIcon('cooked_beef', (p) => {
      for (let y = 5; y <= 11; y++) {
        for (let x = 3; x <= 12; x++) {
          if (Math.hypot((x - 7.5) * 0.9, y - 8) < 4.2) {
            const rim = Math.hypot((x - 7.5) * 0.9, y - 8) > 3.2;
            p(x, y, rim ? '#4d2914' : (x + y) % 3 === 0 ? '#784222' : '#965732');
          }
        }
      }
    });

    // Charcoal
    drawIcon('charcoal', (p) => {
      for (let y = 4; y <= 11; y++) {
        for (let x = 4; x <= 11; x++) {
          if (Math.hypot(x - 7.5, y - 7.5) <= 3.9) {
            p(x, y, (x + y) % 3 === 0 ? '#574e44' : '#2e2924');
          }
        }
      }
      p(6, 6, '#756a5d');
    });

    // Copper Ingot & Netherite Ingot
    const drawIngot = (id: ItemId, hi: string, mid: string, lo: string) => {
      drawIcon(id, (p) => {
        for (let y = 6; y <= 10; y++) {
          for (let x = 3; x <= 12; x++) {
            if ((y === 6 && (x < 5 || x > 10)) || (y === 10 && (x < 4 || x > 11))) continue;
            p(x, y, y <= 7 ? hi : y === 8 ? mid : lo);
          }
        }
      });
    };
    drawIngot('copper_ingot', '#f7b288', '#d97648', '#8f4726');
    drawIngot('netherite_ingot', '#807085', '#4e4452', '#262029');

    // Netherite Scrap
    drawIcon('netherite_scrap', (p) => {
      for (let y = 5; y <= 11; y++) {
        for (let x = 4; x <= 11; x++) {
          if (Math.abs(x - 7.5) + Math.abs(y - 8) < 5.1) {
            p(x, y, y <= 6 ? '#8f7264' : x >= 9 ? '#3d2c26' : '#63493e');
          }
        }
      }
    });

    // Lapis Lazuli
    drawIcon('lapis_lazuli', (p) => {
      for (let y = 4; y <= 11; y++) {
        for (let x = 5; x <= 10; x++) {
          if ((y === 4 || y === 11) && (x === 5 || x === 10)) continue;
          p(x, y, y <= 6 ? '#548aff' : x >= 9 ? '#183799' : '#2957d6');
        }
      }
    });

    // Redstone Dust
    drawIcon('redstone_dust', (p) => {
      for (let y = 4; y <= 11; y++) {
        for (let x = 4; x <= 11; x++) {
          if (Math.hypot(x - 7.5, y - 7.5) <= 4.0 && (x + y) % 5 !== 0) {
            p(x, y, (x + y) % 3 === 0 ? '#ff6b6b' : '#d91c1c');
          }
        }
      }
    });

    // Clay Ball
    drawIcon('clay_ball', (p) => {
      for (let y = 4; y <= 11; y++) {
        for (let x = 4; x <= 11; x++) {
          if (Math.hypot(x - 7.5, y - 7.5) <= 3.8) {
            p(x, y, y <= 6 ? '#bec6d6' : x >= 9 ? '#7d8596' : '#9ca5b8');
          }
        }
      }
    });

    // Brick
    drawIngot('brick', '#c76954', '#a64b38', '#6e2e20');

    // Paper
    drawIcon('paper', (p) => {
      for (let y = 3; y <= 12; y++) {
        for (let x = 4; x <= 11; x++) {
          const border = x === 4 || x === 11 || y === 3 || y === 12;
          p(x, y, border ? '#c4c9d1' : y % 3 === 0 && x >= 6 && x <= 9 ? '#d8dde6' : '#f7f8fa');
        }
      }
    });

    // Book
    drawIcon('book', (p) => {
      for (let y = 3; y <= 12; y++) {
        for (let x = 4; x <= 11; x++) {
          const pages = x === 11 || y === 12;
          const spine = x === 4 || x === 5;
          p(x, y, pages ? '#f0ead8' : spine ? '#5c361a' : '#8c542b');
        }
      }
      p(7, 6, '#e6c24c');
      p(8, 6, '#e6c24c');
    });

    // Leather
    drawIcon('leather', (p) => {
      for (let y = 3; y <= 12; y++) {
        for (let x = 3; x <= 12; x++) {
          if ((y === 3 || y === 12) && (x >= 6 && x <= 9)) continue;
          if ((x === 3 || x === 12) && (y >= 6 && y <= 9)) continue;
          p(x, y, y <= 5 ? '#c47641' : y >= 10 ? '#733f1d' : '#9e592b');
        }
      }
    });

    // String
    drawIcon('string', (p) => {
      const pts = [[4, 12], [5, 11], [6, 11], [7, 10], [8, 9], [8, 8], [7, 7], [6, 6], [7, 5], [8, 4], [9, 4], [10, 5], [11, 6], [11, 7]];
      for (const [x, y] of pts) {
        p(x, y, '#f2f4f7');
        p(x + 1, y, '#c2c8d1');
      }
    });

    // Feather
    drawIcon('feather', (p) => {
      for (let i = 3; i <= 12; i++) {
        p(i, 15 - i, '#d4d8de');
        if (i >= 5) {
          p(i - 1, 15 - i, '#ffffff');
          p(i, 14 - i, '#f5f7fa');
          p(i - 2, 15 - i, '#e4e8ee');
        }
      }
    });

    // Bone
    drawIcon('bone', (p) => {
      for (let i = 4; i <= 11; i++) {
        p(i, 15 - i, '#f0eee6');
        p(i, 14 - i, '#d6d2c5');
      }
      const knobs = [[3, 11], [3, 12], [4, 12], [11, 3], [12, 3], [12, 4]];
      for (const [x, y] of knobs) p(x, y, '#faf8f2');
    });

    // Bone Meal
    drawIcon('bone_meal', (p) => {
      for (let y = 4; y <= 11; y++) {
        for (let x = 4; x <= 11; x++) {
          if (Math.hypot(x - 7.5, y - 7.5) <= 4.0 && (x * 3 + y) % 5 !== 0) {
            p(x, y, (x + y) % 2 === 0 ? '#ffffff' : '#d6d4cc');
          }
        }
      }
    });

    // Gunpowder
    drawIcon('gunpowder', (p) => {
      for (let y = 4; y <= 11; y++) {
        for (let x = 4; x <= 11; x++) {
          if (Math.hypot(x - 7.5, y - 7.5) <= 4.0 && (x * 2 + y) % 4 !== 0) {
            p(x, y, (x + y) % 3 === 0 ? '#8c9096' : '#4a4d54');
          }
        }
      }
    });

    // 8 Dyes (droplet / pigment pouch shape)
    const dyeSpecs: Array<[ItemId, string, string]> = [
      ['red_dye', '#ff544d', '#b8241d'],
      ['orange_dye', '#ff9b42', '#cc5f14'],
      ['yellow_dye', '#fff066', '#d6aa18'],
      ['green_dye', '#76cc4b', '#3d7822'],
      ['blue_dye', '#5e88ff', '#2445b5'],
      ['purple_dye', '#c46bff', '#7527a8'],
      ['white_dye', '#ffffff', '#c4c9d1'],
      ['black_dye', '#484a54', '#18191f'],
    ];
    for (const [dyeId, hi, lo] of dyeSpecs) {
      drawIcon(dyeId, (p) => {
        for (let y = 4; y <= 12; y++) {
          for (let x = 4; x <= 11; x++) {
            const d = Math.hypot(x - 7.5, (y - 8.5) * 0.95);
            if (d <= 3.8 || (y === 3 && (x === 7 || x === 8))) {
              p(x, y, x <= 7 && y <= 7 ? hi : lo);
            }
          }
        }
      });
    }

    // Compass (steel bezel + red north needle)
    drawIcon('compass', (p) => {
      for (let y = 3; y <= 12; y++) {
        for (let x = 3; x <= 12; x++) {
          const d = Math.hypot(x - 7.5, y - 7.5);
          if (d <= 5.0 && d >= 3.6) {
            p(x, y, y <= 6 ? '#cfd6e0' : '#6f7785');
          } else if (d < 3.6) {
            p(x, y, '#262930');
          }
        }
      }
      // Red north pointer & white south pointer
      p(7, 5, '#ff3b30');
      p(8, 5, '#ff3b30');
      p(7, 6, '#ff594f');
      p(8, 6, '#ff3b30');
      p(7, 7, '#ffffff');
      p(8, 8, '#c7cdd6');
      p(7, 9, '#9ba3b0');
      p(8, 10, '#9ba3b0');
    });

    // Clock (gold bezel + split sky-day / star-night face)
    drawIcon('clock', (p) => {
      for (let y = 3; y <= 12; y++) {
        for (let x = 3; x <= 12; x++) {
          const d = Math.hypot(x - 7.5, y - 7.5);
          if (d <= 5.0 && d >= 3.6) {
            p(x, y, y <= 6 ? '#ffea70' : '#b88218');
          } else if (d < 3.6) {
            p(x, y, y <= 7 ? '#52a7f2' : '#1b2042');
          }
        }
      }
      // Golden sun on top half & silver moon dot below
      p(7, 5, '#ffeb59');
      p(8, 5, '#ffd426');
      p(7, 6, '#ffd426');
      p(8, 6, '#ffab19');
      p(8, 9, '#e4ecff');
      p(6, 10, '#a6b6e0');
    });

    // Ensure every item in ITEMS has an icon
    for (const key of Object.keys(ITEMS)) {
      if (!this.iconDataUrls[key]) {
        this.iconDataUrls[key] = this.extractTileDataUrl(1, 0);
      }
    }
  }

  private extractTileDataUrl(tx: number, ty: number): string {
    const c = document.createElement('canvas');
    c.width = 16;
    c.height = 16;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.canvas, tx * 16, ty * 16, 16, 16, 0, 0, 16, 16);
    return c.toDataURL('image/png');
  }

  private renderIsometricBlockIcon(
    topUv: [number, number],
    leftUv: [number, number],
    rightUv: [number, number] = leftUv,
    halfHeight = false
  ): string {
    const c = document.createElement('canvas');
    c.width = 32;
    c.height = 32;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;

    const topC = document.createElement('canvas');
    topC.width = 16;
    topC.height = 16;
    topC.getContext('2d')!.drawImage(this.canvas, topUv[0] * 16, topUv[1] * 16, 16, 16, 0, 0, 16, 16);

    const leftC = document.createElement('canvas');
    leftC.width = 16;
    leftC.height = 16;
    leftC.getContext('2d')!.drawImage(this.canvas, leftUv[0] * 16, leftUv[1] * 16, 16, 16, 0, 0, 16, 16);

    const rightC = document.createElement('canvas');
    rightC.width = 16;
    rightC.height = 16;
    rightC.getContext('2d')!.drawImage(this.canvas, rightUv[0] * 16, rightUv[1] * 16, 16, 16, 0, 0, 16, 16);

    const yOff = halfHeight ? 7 : 0;
    const sideScale = halfHeight ? 0.46 : 0.92;

    // Top diamond
    ctx.save();
    ctx.translate(16, 3 + yOff);
    ctx.transform(0.82, 0.41, -0.82, 0.41, 0, 0);
    ctx.drawImage(topC, 0, 0, 16, 16);
    ctx.restore();

    // Left face (front lock on chest)
    ctx.save();
    ctx.translate(3, 9.5 + yOff);
    ctx.transform(0.82, 0.41, 0, sideScale, 0, 0);
    ctx.drawImage(leftC, 0, 0, 16, 16);
    ctx.fillStyle = 'rgba(0,0,0,0.14)';
    ctx.fillRect(0, 0, 16, 16);
    ctx.restore();

    // Right face
    ctx.save();
    ctx.translate(16, 16 + yOff);
    ctx.transform(0.82, -0.41, 0, sideScale, 0, 0);
    ctx.drawImage(rightC, 0, 0, 16, 16);
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.fillRect(0, 0, 16, 16);
    ctx.restore();

    return c.toDataURL('image/png');
  }

  public dispose(): void {
    this.texture.dispose();
    for (const t of this.crackTextures) t.dispose();
  }
}

/**
 * Generates crisp procedural face textures for Pig, Zombie, Sheep, Skeleton, Villager, and Player Avatar.
 */
export function createMobFaceTexture(
  kind:
    | 'pig'
    | 'zombie'
    | 'sheep'
    | 'skeleton'
    | 'player'
    | 'villager'
    | 'zombie_piglin'
    | 'ghast'
    | 'blaze'
): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 16;
  c.height = 16;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  if (kind === 'pig') {
    ctx.fillStyle = '#f2a2a8';
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = '#e58e95';
    ctx.fillRect(1, 2, 2, 2);
    ctx.fillRect(12, 1, 2, 2);
    ctx.fillRect(2, 13, 3, 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(2, 6, 3, 2);
    ctx.fillRect(11, 6, 3, 2);
    ctx.fillStyle = '#1b1b1b';
    ctx.fillRect(2, 6, 2, 2);
    ctx.fillRect(12, 6, 2, 2);
    ctx.fillStyle = '#f6b8bc';
    ctx.fillRect(4, 9, 8, 5);
    ctx.fillStyle = '#9c5258';
    ctx.fillRect(5, 11, 2, 2);
    ctx.fillRect(9, 11, 2, 2);
  } else if (kind === 'sheep') {
    ctx.fillStyle = '#d9c6b8';
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = '#f0f2f5';
    ctx.fillRect(0, 0, 16, 4);
    ctx.fillRect(0, 4, 2, 4);
    ctx.fillRect(14, 4, 2, 4);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(3, 6, 3, 2);
    ctx.fillRect(10, 6, 3, 2);
    ctx.fillStyle = '#1c1c1e';
    ctx.fillRect(4, 6, 2, 2);
    ctx.fillRect(10, 6, 2, 2);
    ctx.fillStyle = '#e3a6a6';
    ctx.fillRect(6, 10, 4, 3);
    ctx.fillStyle = '#8c6960';
    ctx.fillRect(7, 13, 2, 1);
  } else if (kind === 'skeleton') {
    ctx.fillStyle = '#dcded8';
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = '#c2c4be';
    ctx.fillRect(0, 0, 16, 2);
    ctx.fillRect(1, 13, 14, 3);
    ctx.fillStyle = '#1b1d1e';
    ctx.fillRect(3, 6, 3, 3);
    ctx.fillRect(10, 6, 3, 3);
    ctx.fillStyle = '#383b3d';
    ctx.fillRect(7, 9, 2, 2);
    ctx.fillStyle = '#1f2123';
    ctx.fillRect(3, 12, 10, 2);
    ctx.fillStyle = '#dcded8';
    ctx.fillRect(5, 12, 1, 2);
    ctx.fillRect(8, 12, 1, 2);
    ctx.fillRect(11, 12, 1, 2);
  } else if (kind === 'player') {
    ctx.fillStyle = '#d9a47c';
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = '#4a301c';
    ctx.fillRect(0, 0, 16, 4);
    ctx.fillRect(0, 4, 2, 3);
    ctx.fillRect(14, 4, 2, 3);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(3, 7, 3, 2);
    ctx.fillRect(10, 7, 3, 2);
    ctx.fillStyle = '#2d4785';
    ctx.fillRect(4, 7, 2, 2);
    ctx.fillRect(10, 7, 2, 2);
    ctx.fillStyle = '#b8805a';
    ctx.fillRect(7, 9, 2, 2);
    ctx.fillStyle = '#5c3c24';
    ctx.fillRect(5, 12, 6, 2);
  } else if (kind === 'villager') {
    ctx.fillStyle = '#c9936d';
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = '#b57e59';
    ctx.fillRect(0, 0, 16, 2);
    ctx.fillStyle = '#4a321f';
    ctx.fillRect(2, 5, 12, 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(3, 7, 3, 2);
    ctx.fillRect(10, 7, 3, 2);
    ctx.fillStyle = '#2e8c45';
    ctx.fillRect(4, 7, 2, 2);
    ctx.fillRect(10, 7, 2, 2);
    ctx.fillStyle = '#754c32';
    ctx.fillRect(6, 13, 4, 1);
  } else if (kind === 'zombie_piglin') {
    // Half pinkish piglin face, half decayed greenish zombie skull
    ctx.fillStyle = '#e2989e';
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = '#5c8549';
    ctx.fillRect(8, 0, 8, 9);
    ctx.fillRect(10, 9, 6, 7);
    ctx.fillStyle = '#d6d2c4'; // exposed bone
    ctx.fillRect(10, 2, 4, 3);
    // Eyes
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(2, 6, 3, 2);
    ctx.fillStyle = '#1b1b1b';
    ctx.fillRect(3, 6, 2, 2);
    ctx.fillStyle = '#293d1f';
    ctx.fillRect(11, 6, 3, 2);
    ctx.fillStyle = '#e04f4f';
    ctx.fillRect(12, 6, 1, 1);
    // Snout & tusk
    ctx.fillStyle = '#cc7a80';
    ctx.fillRect(4, 9, 6, 5);
    ctx.fillStyle = '#5c2a2e';
    ctx.fillRect(5, 10, 1, 2);
    ctx.fillRect(8, 10, 1, 2);
    ctx.fillStyle = '#f5f0e6';
    ctx.fillRect(3, 12, 1, 2);
  } else if (kind === 'ghast') {
    // Pale ghostly white giant cube with dark tear streaks and crying/screaming mouth
    ctx.fillStyle = '#eceef2';
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = '#d4d8e0';
    ctx.fillRect(0, 13, 16, 3);
    ctx.fillRect(0, 0, 16, 1);
    // Sad closed/glowing dark eyes + tear streaks
    ctx.fillStyle = '#262930';
    ctx.fillRect(2, 5, 4, 2);
    ctx.fillRect(10, 5, 4, 2);
    ctx.fillStyle = '#9aa8b8';
    ctx.fillRect(3, 7, 2, 5);
    ctx.fillRect(11, 7, 2, 5);
    // Open dark mouth with fiery red core
    ctx.fillStyle = '#1e1c21';
    ctx.fillRect(6, 9, 4, 4);
    ctx.fillStyle = '#d93626';
    ctx.fillRect(7, 10, 2, 2);
  } else if (kind === 'blaze') {
    // Glowing golden-orange armored head with bright white-yellow eyes
    ctx.fillStyle = '#e89d1c';
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = '#b85c0b';
    ctx.fillRect(0, 0, 16, 3);
    ctx.fillRect(0, 12, 16, 4);
    ctx.fillStyle = '#3b1c06';
    ctx.fillRect(2, 6, 12, 3);
    ctx.fillStyle = '#fff9c4';
    ctx.fillRect(3, 6, 3, 2);
    ctx.fillRect(10, 6, 3, 2);
    ctx.fillStyle = '#ffd43b';
    ctx.fillRect(6, 11, 4, 2);
  } else {
    ctx.fillStyle = '#5c8a47';
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = '#476e36';
    ctx.fillRect(0, 0, 16, 3);
    ctx.fillRect(2, 12, 4, 2);
    ctx.fillRect(11, 4, 3, 2);
    ctx.fillStyle = '#151c12';
    ctx.fillRect(3, 6, 3, 2);
    ctx.fillRect(10, 6, 3, 2);
    ctx.fillStyle = '#8b1f1f';
    ctx.fillRect(4, 6, 1, 1);
    ctx.fillRect(11, 6, 1, 1);
    ctx.fillStyle = '#24381b';
    ctx.fillRect(5, 11, 6, 2);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}
