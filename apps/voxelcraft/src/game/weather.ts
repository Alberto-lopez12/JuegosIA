import * as THREE from 'three';
import type { BiomeType, DimensionId, GraphicsQuality, WeatherType } from './types';

function createPrecipitationTexture(kind: 'rain' | 'snow' | 'ember'): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.clearRect(0, 0, 16, 16);
  if (kind === 'rain') {
    const grad = ctx.createLinearGradient(8, 0, 8, 16);
    grad.addColorStop(0, 'rgba(180,220,255,0)');
    grad.addColorStop(0.25, 'rgba(170,215,255,0.85)');
    grad.addColorStop(0.85, 'rgba(215,240,255,0.95)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(7, 1, 2, 14);
  } else if (kind === 'ember') {
    ctx.fillStyle = 'rgba(255,110,30,0.45)';
    ctx.fillRect(3, 3, 10, 10);
    ctx.fillStyle = 'rgba(255,175,55,0.88)';
    ctx.fillRect(5, 5, 6, 6);
    ctx.fillStyle = 'rgba(255,240,175,0.98)';
    ctx.fillRect(7, 7, 2, 2);
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fillRect(6, 3, 4, 10);
    ctx.fillRect(3, 6, 10, 4);
    ctx.fillStyle = 'rgba(220,240,255,0.65)';
    ctx.fillRect(5, 5, 6, 6);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Lightweight recyclable THREE.Points precipitation system (zero per-frame GC).
 * Cycles naturally every 6–12 minutes between Clear and Storm, rendering fast blue rain
 * in temperate biomes, gentle drifting snow in Snowy Taiga / high peaks, and dry overcast in Desert.
 */
export class WeatherSystem {
  public weather: WeatherType = 'clear';
  public intensity = 0; // 0..1 smooth blend
  public nextChangeTimer: number;

  private readonly maxParticles = 1400;
  private activeCount = 1400;
  private readonly geometry: THREE.BufferGeometry;
  private readonly material: THREE.PointsMaterial;
  private readonly rainTex: THREE.CanvasTexture | null;
  private readonly snowTex: THREE.CanvasTexture | null;
  private readonly emberTex: THREE.CanvasTexture | null;
  private currentMode: 'rain' | 'snow' | 'ember' = 'rain';
  public readonly points: THREE.Points;
  private readonly positions: Float32Array;
  private readonly phases: Float32Array;
  private readonly boxRadius = 22;
  private readonly boxHeight = 24;
  private elapsed = 0;

  constructor(scene: THREE.Scene) {
    this.nextChangeTimer = 360 + Math.random() * 360; // 6–12 min natural cycle
    this.positions = new Float32Array(this.maxParticles * 3);
    this.phases = new Float32Array(this.maxParticles);
    this.rainTex = createPrecipitationTexture('rain');
    this.snowTex = createPrecipitationTexture('snow');
    this.emberTex = createPrecipitationTexture('ember');

    for (let i = 0; i < this.maxParticles; i++) {
      this.positions[i * 3] = (Math.random() - 0.5) * this.boxRadius * 2;
      this.positions[i * 3 + 1] = Math.random() * this.boxHeight;
      this.positions[i * 3 + 2] = (Math.random() - 0.5) * this.boxRadius * 2;
      this.phases[i] = Math.random() * Math.PI * 2;
    }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setDrawRange(0, this.activeCount);

    this.material = new THREE.PointsMaterial({
      color: 0xaad6ff,
      map: this.rainTex,
      size: 0.72,
      transparent: true,
      opacity: 0,
      alphaTest: 0.05,
      depthWrite: false,
      sizeAttenuation: true,
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.points.visible = false;
    scene.add(this.points);
  }

  public setQuality(quality: GraphicsQuality): void {
    this.activeCount = quality === 'fast' ? 600 : this.maxParticles;
    this.geometry.setDrawRange(0, this.activeCount);
  }

  public setWeather(next: WeatherType): void {
    this.weather = next;
    this.nextChangeTimer = 360 + Math.random() * 360;
  }

  public toggleWeather(): WeatherType {
    const next: WeatherType = this.weather === 'clear' ? 'storm' : 'clear';
    this.setWeather(next);
    return next;
  }

  /**
   * Advances weather cycle & particle kinematics.
   * Returns rain audio intensity (0..1; 0 in Desert or Snow).
   */
  public update(
    dt: number,
    playerX: number,
    playerY: number,
    playerZ: number,
    biome: BiomeType,
    allowCycle: boolean,
    dimension: DimensionId = 'overworld'
  ): { rainAudioIntensity: number; stormDarkness: number; weatherChanged: boolean } {
    // In The Nether: no rain/snow; float glowing volcanic ash & orange-red embers upward
    if (dimension === 'nether') {
      this.points.visible = true;
      this.elapsed += dt;
      if (this.currentMode !== 'ember') {
        this.currentMode = 'ember';
        this.material.map = this.emberTex;
        this.material.needsUpdate = true;
      }
      this.material.color.setHex(biome === 'Soul Sand Valley' ? 0xc2d8e8 : 0xff7c2e);
      this.material.size = 0.36;
      this.material.opacity = 0.85;

      const emberCount = Math.min(this.activeCount, 420);
      this.geometry.setDrawRange(0, emberCount);
      const r = this.boxRadius;
      const h = this.boxHeight;
      const minY = playerY - 8;
      const maxY = playerY + h - 6;

      const posAttr = this.geometry.getAttribute('position') as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      for (let i = 0; i < emberCount; i++) {
        const i3 = i * 3;
        let px = arr[i3];
        let py = arr[i3 + 1];
        let pz = arr[i3 + 2];
        const ph = this.phases[i];

        py += (1.1 + (ph % 1.0) * 0.9) * dt;
        px += Math.sin(this.elapsed * 0.9 + ph) * 0.65 * dt;
        pz += Math.cos(this.elapsed * 0.8 + ph) * 0.65 * dt;

        if (py > maxY || py < minY || Math.abs(px - playerX) > r || Math.abs(pz - playerZ) > r) {
          py = minY + Math.random() * 6;
          px = playerX + (Math.random() - 0.5) * r * 2;
          pz = playerZ + (Math.random() - 0.5) * r * 2;
        }
        arr[i3] = px;
        arr[i3 + 1] = py;
        arr[i3 + 2] = pz;
      }
      posAttr.needsUpdate = true;
      return { rainAudioIntensity: 0, stormDarkness: 0, weatherChanged: false };
    }

    this.geometry.setDrawRange(0, this.activeCount);

    let weatherChanged = false;
    if (allowCycle) {
      this.nextChangeTimer -= dt;
      if (this.nextChangeTimer <= 0) {
        this.weather = this.weather === 'clear' ? 'storm' : 'clear';
        this.nextChangeTimer = this.weather === 'storm' ? 180 + Math.random() * 240 : 360 + Math.random() * 360;
        weatherChanged = true;
      }
    }

    const target = this.weather === 'storm' ? 1 : 0;
    this.intensity += (target - this.intensity) * Math.min(1, dt * 1.4);
    if (Math.abs(target - this.intensity) < 0.005) this.intensity = target;

    const isDesert = biome === 'Desert';
    const isSnow = biome === 'Snowy Taiga' || playerY > 82;
    const showParticles = this.intensity > 0.02 && !isDesert;

    this.points.visible = showParticles;
    if (!showParticles) {
      return {
        rainAudioIntensity: 0,
        stormDarkness: this.intensity * (isDesert ? 0.25 : 0.38),
        weatherChanged,
      };
    }

    this.elapsed += dt;
    const desiredMode = isSnow ? 'snow' : 'rain';
    if (desiredMode !== this.currentMode) {
      this.currentMode = desiredMode;
      this.material.map = isSnow ? this.snowTex : this.rainTex;
      this.material.needsUpdate = true;
    }
    this.material.color.setHex(isSnow ? 0xf2f8ff : 0x9cd0ff);
    this.material.size = isSnow ? 0.42 : 0.72;
    this.material.opacity = this.intensity * (isSnow ? 0.88 : 0.72);

    const fallSpeed = isSnow ? 2.6 : 19.5;
    const swayAmp = isSnow ? 1.15 : 0.4;
    const r = this.boxRadius;
    const h = this.boxHeight;
    const minY = playerY - 4;
    const maxY = playerY + h - 4;

    const posAttr = this.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;

    for (let i = 0; i < this.activeCount; i++) {
      const i3 = i * 3;
      let px = arr[i3];
      let py = arr[i3 + 1];
      let pz = arr[i3 + 2];

      py -= fallSpeed * dt;
      if (isSnow) {
        const ph = this.phases[i];
        px += Math.sin(this.elapsed * 1.6 + ph) * swayAmp * dt;
        pz += Math.cos(this.elapsed * 1.3 + ph) * swayAmp * dt;
      } else {
        px += 1.2 * dt; // subtle wind slant
      }

      // Wrap seamlessly around player bounding volume
      if (py < minY || py > maxY) {
        py = maxY - (Math.random() * 2.5);
        px = playerX + (Math.random() - 0.5) * r * 2;
        pz = playerZ + (Math.random() - 0.5) * r * 2;
      }
      if (px - playerX > r) px -= r * 2;
      else if (px - playerX < -r) px += r * 2;
      if (pz - playerZ > r) pz -= r * 2;
      else if (pz - playerZ < -r) pz += r * 2;

      arr[i3] = px;
      arr[i3 + 1] = py;
      arr[i3 + 2] = pz;
    }

    posAttr.needsUpdate = true;

    return {
      rainAudioIntensity: isSnow ? 0 : this.intensity,
      stormDarkness: this.intensity * 0.4,
      weatherChanged,
    };
  }

  public dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.rainTex?.dispose();
    this.snowTex?.dispose();
    this.emberTex?.dispose();
  }
}
