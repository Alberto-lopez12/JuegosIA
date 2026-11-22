import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SoundEngine } from './audio';
import {
  ALL_SAPLING_IDS,
  applyArmorDamageReduction,
  BLOCK_IDS,
  BLOCKS,
  calculateTotalArmorPoints,
  canHarvestBlock,
  CHUNK_SIZE,
  getItemDef,
  getMiningSpeedMultiplier,
  getWeaponDamage,
  isBlockSolid,
} from './blocks';
import {
  addItemToInventory,
  executeVillagerTrade,
  getFuelDuration,
  getSmeltOutput,
  SMELT_TIME_SECONDS,
  VILLAGER_TITLES,
  VILLAGER_TRADES,
} from './crafting';
import { EntityManager, FirstPersonHand, PlayerAvatar } from './entities';
import { ChunkMesher } from './mesher';
import { parseSeedInput } from './noise';
import {
  aabbIntersectsBlock,
  EYE_HEIGHT_CROUCHING,
  EYE_HEIGHT_STANDING,
  getPlayerAABB,
  PlayerPhysicsState,
  stepPlayerPhysics,
} from './physics';
import {
  buildSafeReturnPortal,
  findNearestPortal,
  findSafeReturnPortalY,
  findValidPortalFrame,
  scalePortalCoordinates,
} from './portal';
import { raycastVoxel } from './raycast';
import {
  deleteWorldById,
  generateWorldId,
  listWorlds,
  loadGlobalSettings,
  loadWorldById,
  saveGlobalSettings,
  saveWorldData,
  validateSavedWorldJson,
} from './storage';
import { TextureAtlasGenerator } from './textures';
import type {
  ActiveVillagerTrade,
  ArmorSlots,
  ChestTileEntity,
  CreateWorldConfig,
  DebugInfo,
  Difficulty,
  DimensionId,
  DimensionSaveSlice,
  DiscoveredStructure,
  FurnaceTileEntity,
  GameMode,
  GamePhase,
  GlobalSettings,
  HUDState,
  ItemId,
  ModalType,
  RaycastHit,
  RunStats,
  SavedWorldData,
  SlotOrNull,
  TileEntityData,
  ToastMessage,
  TouchControlsMode,
  Waypoint,
  WorldMeta,
  WorldType,
} from './types';
import { WeatherSystem } from './weather';
import { chunkKey, World, worldToChunkCoord } from './world';

export { validateSavedWorldJson };

const TICKS_PER_DAY = 24000;
const DAY_DURATION_SECONDS = 900; // 15 real minutes per full day
const TICKS_PER_SECOND = TICKS_PER_DAY / DAY_DURATION_SECONDS;
const EAT_DURATION_SECONDS = 1.2;
const CLOUD_ALTITUDE = 118;
const CLOUD_SPAN = 192;
const CLOUD_SPEED = 0.6;

interface ChunkRenderEntry {
  opaqueMesh: THREE.Mesh | null;
  transparentMesh: THREE.Mesh | null;
  crossMesh: THREE.Mesh | null;
  opaqueLightData: Float32Array | null;
  transparentLightData: Float32Array | null;
  crossLightData: Float32Array | null;
}

interface CloudBlock {
  mesh: THREE.Mesh;
  baseX: number;
  baseZ: number;
}

export type DamageSource =
  | 'mob'
  | 'arrow'
  | 'fireball'
  | 'explosion'
  | 'fall'
  | 'drown'
  | 'lava'
  | 'fire'
  | 'magma'
  | 'cactus';

function createEmptyDimensionSlice(): DimensionSaveSlice {
  return {
    blockEdits: [],
    tileEntities: [],
    exploredChunks: {},
    discoveredStructures: [],
    waypoints: [],
  };
}

// Reusable scratch vectors (zero GC in render loop)
const _skyColor = new THREE.Color();
const _sunColor = new THREE.Color();
const _hemiSky = new THREE.Color();
const _hemiGround = new THREE.Color();
const _cloudColor = new THREE.Color();

function detectSoftwareWebGL(): boolean {
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2') || probe.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) ?? '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

function getCardinalDirection(yaw: number): { cardinal: string; yawDeg: number } {
  // Look vector is (-sin(yaw), 0, -cos(yaw)); yaw=0 faces North (-Z)
  let deg = ((-yaw * 180) / Math.PI) % 360;
  if (deg < 0) deg += 360;
  let cardinal = 'Norte (-Z)';
  if (deg >= 45 && deg < 135) cardinal = 'Este (+X)';
  else if (deg >= 135 && deg < 225) cardinal = 'Sur (+Z)';
  else if (deg >= 225 && deg < 315) cardinal = 'Oeste (-X)';
  return { cardinal, yawDeg: Math.round(deg) };
}

function parseHexRgb(hex: string): [number, number, number] {
  const clean = hex.startsWith('#') ? hex.slice(1) : hex;
  const n = parseInt(clean, 16);
  if (Number.isNaN(n)) return [128, 128, 128];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export class VoxelEngine {
  private readonly container: HTMLElement;
  private readonly onHUDChange: (state: HUDState) => void;
  public readonly atlas: TextureAtlasGenerator;
  public readonly sound = new SoundEngine();

  private readonly isSoftwareGl: boolean;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly fog: THREE.Fog;
  private readonly sunLight: THREE.DirectionalLight;
  private readonly hemiLight: THREE.HemisphereLight;
  private readonly sunMesh: THREE.Mesh;
  private readonly moonMesh: THREE.Mesh;
  private readonly celestialPivot = new THREE.Group();
  private readonly cloudGroup = new THREE.Group();
  private readonly cloudMaterial: THREE.MeshLambertMaterial;
  private readonly cloudBlocks: CloudBlock[] = [];
  private cloudDriftOffset = 0;

  private readonly opaqueMaterial: THREE.MeshLambertMaterial;
  private readonly transparentMaterial: THREE.MeshLambertMaterial;
  private readonly crossMaterial: THREE.MeshLambertMaterial;
  private readonly itemAtlasMaterial: THREE.MeshLambertMaterial;
  private readonly outlineMesh: THREE.LineSegments;
  private readonly crackMesh: THREE.Mesh;
  private readonly crackMaterial: THREE.MeshBasicMaterial;
  private readonly firstPersonHand: FirstPersonHand;
  private readonly playerAvatar: PlayerAvatar;

  private world: World;
  private entities: EntityManager;
  private readonly weather: WeatherSystem;
  private readonly chunkMeshes = new Map<string, ChunkRenderEntry>();
  private readonly chunkGroup = new THREE.Group();

  // Simulation & World Metadata
  private phase: GamePhase = 'title';
  private modal: ModalType = 'none';
  private pointerLocked = false;
  private settings: GlobalSettings;
  private renderDistance = 5;
  private worldId = generateWorldId();
  private worldName = 'Mundo Nuevo';
  private currentDimension: DimensionId = 'overworld';
  private dimStates: Record<DimensionId, DimensionSaveSlice> = {
    overworld: createEmptyDimensionSlice(),
    nether: createEmptyDimensionSlice(),
  };
  private gameMode: GameMode = 'survival';
  private difficulty: Difficulty = 'normal';
  private worldType: WorldType = 'default';
  private bonusChest = false;
  private seed = 42073;
  private seedLabel = '42073';
  private worldTime = 4800; // bright crisp morning
  private dayCount = 1;
  private lastRelightDayFactor = 1.0;
  private worldsList: WorldMeta[] = [];

  // Nether Portal & Fire/Lava Hazard State
  private portalStandTimer = 0;
  private portalCooldown = 0;
  private lastPortalEmitBucket = -1;
  private onFireTimer = 0;
  private lastOnFireFlag = false;
  private lavaDamageTimer = 0;
  private burnDamageTimer = 0;
  private magmaDamageTimer = 0;
  private lavaBubbleTimer = 2.5;

  // Mobile / Touch controls state
  private readonly isTouchDevice: boolean;
  private touchControlsMode: TouchControlsMode = 'auto';
  private touchForward = 0;
  private touchStrafe = 0;
  private touchSprint = false;
  private touchJumpHeld = false;
  private touchFlyDown = false;
  private touchCrouch = false;
  private touchMineHeld = false;
  private touchUseHeld = false;

  private player: PlayerPhysicsState = {
    x: 8.5,
    y: 60,
    z: 8.5,
    vx: 0,
    vy: 0,
    vz: 0,
    onGround: false,
    inWater: false,
    headInWater: false,
    crouching: false,
    sprinting: false,
    isFlying: false,
    peakAirY: 60,
    coyoteTimer: 0,
  };
  private initialSpawn: [number, number, number] = [8.5, 60, 8.5];
  private bedSpawn: [number, number, number] | null = null;
  private yaw = 0.55;
  private pitch = -0.14;
  private currentEyeHeight = EYE_HEIGHT_STANDING;
  private currentFov = 75;
  private lastSpaceTapTime = 0;
  private creativeBreakCooldown = 0;

  private health = 20;
  private readonly maxHealth = 20;
  private hunger = 20;
  private readonly maxHunger = 20;
  private oxygen = 10;
  private readonly maxOxygen = 10;
  private oxygenDrainTimer = 0;
  private drownDamageTimer = 0;
  private hungerTickTimer = 0;
  private regenTimer = 0;
  private hurtFlash = 0;
  private invulnTimer = 0;
  private cameraTrauma = 0;
  private footstepAccum = 0;

  // Bed sleep animation state
  private sleepAnimTimer = 0;
  private sleepSwitchedTime = false;
  private sleepingAlpha = 0;
  private lastSleepEmitBucket = -1;

  private selectedSlot = 0;
  private inventory: SlotOrNull[] = new Array<SlotOrNull>(36).fill(null);
  private enderChestSlots: SlotOrNull[] = new Array<SlotOrNull>(27).fill(null);
  private armor: ArmorSlots = [null, null, null, null];
  private activeTileEntityKey: string | null = null;
  private activeTrade: ActiveVillagerTrade | null = null;
  private noteBlockPitches = new Map<string, number>();
  private bowCharging = false;
  private bowChargeTime = 0;
  private lastBowEmitBucket = 0;
  private cactusDamageTimer = 0;
  private campfireSmokeTimer = 0;
  private targetEntityHint: string | null = null;
  private lastTargetEntityHint: string | null = null;
  private saveStatus = '';
  private saveStatusTimer = 0;
  private stats: RunStats = {
    blocksMined: 0,
    blocksPlaced: 0,
    mobsDefeated: 0,
    dayReached: 1,
  };

  // Exploration, Waypoints & Toasts
  private readonly exploredChunks = new Map<string, string>();
  private exploredVersion = 0;
  private waypoints: Waypoint[] = [];
  private discoveredStructures: DiscoveredStructure[] = [];
  private structureScanTimer = 0;
  private toasts: Array<ToastMessage & { expiresAt: number }> = [];
  private nextToastId = 1;

  // Camera, Debug & Minimap toggles
  private thirdPerson = false;
  private showDebug = false;
  private showMinimap = true;
  private smoothedFps = 60;
  private lastPendingChunks = 0;

  // Input state
  private readonly keys = new Set<string>();
  private jumpJustPressed = false;
  private leftMouseHeld = false;
  private rightMouseHeld = false;
  private rightMouseJustPressed = false;
  private leftMouseJustPressed = false;

  // Mining & Eating state
  private currentHit: RaycastHit | null = null;
  private miningPosKey: string | null = null;
  private breakProgress = 0;
  private mineSoundTimer = 0;
  private attackCooldown = 0;
  private eatTimer = 0;
  private eatSoundTimer = 0;

  // Loop & lifecycle
  private running = true;
  private frameId = 0;
  private lastTime = performance.now();
  private flyoverAngle = 0;
  private hudSyncTimer = 0;
  private lastCoordsKey = '';
  private lastTargetName: string | null = null;
  private lastTimeBucket = -1;
  private readonly resizeObserver: ResizeObserver;

  constructor(container: HTMLElement, onHUDChange: (state: HUDState) => void) {
    this.container = container;
    this.onHUDChange = onHUDChange;
    this.isSoftwareGl = detectSoftwareWebGL();
    this.isTouchDevice =
      typeof window !== 'undefined' &&
      ('ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0);
    this.settings = loadGlobalSettings();
    this.renderDistance = this.settings.renderDistance;
    this.touchControlsMode = this.settings.touchControlsMode;
    this.sound.setVolume(this.settings.volume);
    this.worldsList = listWorlds();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2)
    );
    this.renderer.setSize(
      container.clientWidth || window.innerWidth,
      container.clientHeight || window.innerHeight
    );
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.fog = new THREE.Fog(0x8bc8ff, 36, this.renderDistance * CHUNK_SIZE);
    this.scene.fog = this.fog;
    this.scene.background = new THREE.Color(0x8bc8ff);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const aspect =
      (container.clientWidth || window.innerWidth) /
      Math.max(1, container.clientHeight || window.innerHeight);
    this.camera = new THREE.PerspectiveCamera(75, aspect, 0.08, 280);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);

    this.sunLight = new THREE.DirectionalLight(0xfff4dd, 0.85);
    this.sunLight.position.set(50, 100, 30);
    this.scene.add(this.sunLight);

    this.hemiLight = new THREE.HemisphereLight(0xbce2ff, 0x56644a, 0.72);
    this.scene.add(this.hemiLight);

    this.sunMesh = new THREE.Mesh(
      new THREE.BoxGeometry(16, 16, 2),
      new THREE.MeshBasicMaterial({ color: 0xffe66b, fog: false })
    );
    this.sunMesh.position.set(0, 155, 0);
    this.sunMesh.lookAt(0, 0, 0);

    this.moonMesh = new THREE.Mesh(
      new THREE.BoxGeometry(13, 13, 2),
      new THREE.MeshBasicMaterial({ color: 0xeef5ff, fog: false })
    );
    this.moonMesh.position.set(0, -155, 0);
    this.moonMesh.lookAt(0, 0, 0);

    this.celestialPivot.add(this.sunMesh, this.moonMesh);
    this.scene.add(this.celestialPivot);

    // Volumetric procedural pixel clouds at Y = 118 (opacity 0.82)
    this.cloudMaterial = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.82,
      emissive: 0x3b4859,
      emissiveIntensity: 0.35,
    });
    this.buildVolumetricClouds();
    this.scene.add(this.cloudGroup);

    // Procedural Texture Atlas + Shared Materials
    this.atlas = new TextureAtlasGenerator();
    this.opaqueMaterial = new THREE.MeshLambertMaterial({
      map: this.atlas.texture,
      vertexColors: true,
    });
    this.transparentMaterial = new THREE.MeshLambertMaterial({
      map: this.atlas.texture,
      vertexColors: true,
      transparent: true,
      opacity: 0.78,
      alphaTest: 0.12,
      side: THREE.DoubleSide,
    });
    this.crossMaterial = new THREE.MeshLambertMaterial({
      map: this.atlas.texture,
      vertexColors: true,
      side: THREE.DoubleSide,
      alphaTest: 0.5,
    });
    this.itemAtlasMaterial = new THREE.MeshLambertMaterial({
      map: this.atlas.texture,
    });

    this.scene.add(this.chunkGroup);

    const boxEdges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004));
    this.outlineMesh = new THREE.LineSegments(
      boxEdges,
      new THREE.LineBasicMaterial({ color: 0x000000 })
    );
    this.outlineMesh.visible = false;
    this.scene.add(this.outlineMesh);

    this.crackMaterial = new THREE.MeshBasicMaterial({
      map: this.atlas.crackTextures[0],
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    this.crackMesh = new THREE.Mesh(new THREE.BoxGeometry(1.006, 1.006, 1.006), this.crackMaterial);
    this.crackMesh.visible = false;
    this.scene.add(this.crackMesh);

    this.firstPersonHand = new FirstPersonHand(this.itemAtlasMaterial);
    this.camera.add(this.firstPersonHand.root);

    this.playerAvatar = new PlayerAvatar();
    this.scene.add(this.playerAvatar.group);

    this.world = new World(this.seed, this.worldType);
    this.entities = new EntityManager(this.scene, this.itemAtlasMaterial);
    this.weather = new WeatherSystem(this.scene);
    this.applyGraphicsQuality();

    this.resetWorldState(this.seed, false);

    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      const modeParam = params.get('mode');
      if (modeParam === 'creative') {
        this.gameMode = 'creative';
      }
      this.startGame(false);
      if (params.get('dim') === 'nether') {
        this.switchDimension('nether');
      }
    } else {
      this.setPhase('title');
    }

    (window as unknown as { __VOXEL_ENGINE__?: VoxelEngine }).__VOXEL_ENGINE__ = this;

    this.bindEvents();
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.emitHUD();
    this.scheduleNextFrame();
  }

  private applyGraphicsQuality(): void {
    const fast = this.settings.graphicsQuality === 'fast';
    this.weather.setQuality(this.settings.graphicsQuality);
    for (let i = 0; i < this.cloudBlocks.length; i++) {
      this.cloudBlocks[i].mesh.visible = !fast || i % 2 === 0;
    }
  }

  public pushToast(text: string, tone: ToastMessage['tone'] = 'info', durationMs = 3500): void {
    const now = performance.now();
    this.toasts.push({
      id: this.nextToastId++,
      text,
      tone,
      expiresAt: now + durationMs,
    });
    if (this.toasts.length > 4) {
      this.toasts.shift();
    }
    this.emitHUD();
  }

  private buildVolumetricClouds(): void {
    const clusters: Array<[number, number, number, number, number]> = [
      [-76, -64, 24, 3.2, 14],
      [-64, -58, 14, 3.2, 18],
      [-20, -72, 28, 3.2, 14],
      [38, -60, 22, 3.2, 16],
      [78, -28, 20, 3.2, 12],
      [-82, 4, 26, 3.2, 14],
      [-32, -8, 18, 3.2, 12],
      [18, -12, 26, 3.2, 16],
      [26, -4, 16, 3.2, 10],
      [68, 24, 24, 3.2, 14],
      [-58, 48, 22, 3.2, 16],
      [-8, 56, 28, 3.2, 14],
      [44, 68, 20, 3.2, 12],
      [-16, 18, 20, 3.2, 12],
      [-46, 22, 16, 3.2, 10],
    ];
    for (const [bx, bz, w, h, d] of clusters) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this.cloudMaterial);
      m.position.set(bx, CLOUD_ALTITUDE, bz);
      this.cloudGroup.add(m);
      this.cloudBlocks.push({ mesh: m, baseX: bx, baseZ: bz });
    }
  }

  private updateVolumetricClouds(dt: number, dayFactor: number): void {
    this.cloudDriftOffset = (this.cloudDriftOffset + CLOUD_SPEED * dt) % CLOUD_SPAN;
    const halfSpan = CLOUD_SPAN * 0.5;
    const px = this.player.x;
    const pz = this.player.z;

    for (const cb of this.cloudBlocks) {
      let rx = ((cb.baseX + this.cloudDriftOffset - px + halfSpan) % CLOUD_SPAN + CLOUD_SPAN) % CLOUD_SPAN - halfSpan;
      let rz = ((cb.baseZ - pz + halfSpan) % CLOUD_SPAN + CLOUD_SPAN) % CLOUD_SPAN - halfSpan;
      cb.mesh.position.set(px + rx, CLOUD_ALTITUDE, pz + rz);
    }

    // Darken clouds smoothly at night
    const brightness = THREE.MathUtils.lerp(0.28, 1.0, dayFactor);
    _cloudColor.setRGB(brightness * 0.96, brightness * 0.98, brightness);
    this.cloudMaterial.color.copy(_cloudColor);
    this.cloudMaterial.emissiveIntensity = THREE.MathUtils.lerp(0.08, 0.42, dayFactor);
  }

  private clearAllChunkMeshes(): void {
    for (const entry of this.chunkMeshes.values()) {
      if (entry.opaqueMesh) {
        this.chunkGroup.remove(entry.opaqueMesh);
        entry.opaqueMesh.geometry.dispose();
      }
      if (entry.transparentMesh) {
        this.chunkGroup.remove(entry.transparentMesh);
        entry.transparentMesh.geometry.dispose();
      }
      if (entry.crossMesh) {
        this.chunkGroup.remove(entry.crossMesh);
        entry.crossMesh.geometry.dispose();
      }
    }
    this.chunkMeshes.clear();
  }

  /**
   * Pure Survival Mode: starts with completely empty 36-slot inventory and 4 empty armor slots.
   */
  private setupStarterInventory(): void {
    this.inventory = new Array<SlotOrNull>(36).fill(null);
    this.armor = [null, null, null, null];
    this.playerAvatar.syncArmor(this.armor);
    this.selectedSlot = 0;
  }

  public hasSavedWorld(): boolean {
    return this.worldsList.length > 0;
  }

  private flushActiveDimensionSlice(): void {
    const edits: Array<[number, number, number, number]> = [];
    for (const [key, id] of this.world.blockEdits.entries()) {
      const [x, y, z] = key.split(',').map(Number);
      edits.push([x, y, z, id]);
    }
    const exploredObj: Record<string, string> = {};
    for (const [k, v] of this.exploredChunks.entries()) {
      exploredObj[k] = v;
    }
    this.dimStates[this.currentDimension] = {
      blockEdits: edits,
      tileEntities: Array.from(this.world.tileEntities.values()).map((te) =>
        te.type === 'chest'
          ? { type: 'chest', key: te.key, slots: te.slots.map((s) => (s ? { ...s } : null)) }
          : {
              ...te,
              type: 'furnace',
              input: te.input ? { ...te.input } : null,
              fuel: te.fuel ? { ...te.fuel } : null,
              output: te.output ? { ...te.output } : null,
            }
      ),
      exploredChunks: exploredObj,
      discoveredStructures: this.discoveredStructures.map((s) => ({ ...s })),
      waypoints: this.waypoints.map((w) => ({ ...w })),
    };
  }

  private hydrateDimensionSlice(slice: DimensionSaveSlice): void {
    this.world.blockEdits.clear();
    for (const [x, y, z, id] of slice.blockEdits ?? []) {
      this.world.blockEdits.set(`${x},${y},${z}`, id);
    }
    this.world.tileEntities.clear();
    for (const te of slice.tileEntities ?? []) {
      if (te.type === 'chest') {
        const slots = new Array<SlotOrNull>(27).fill(null);
        for (let i = 0; i < 27; i++) slots[i] = te.slots?.[i] ?? null;
        this.world.tileEntities.set(te.key, { type: 'chest', key: te.key, slots });
      } else if (te.type === 'furnace') {
        this.world.tileEntities.set(te.key, {
          type: 'furnace',
          key: te.key,
          input: te.input ? { ...te.input } : null,
          fuel: te.fuel ? { ...te.fuel } : null,
          output: te.output ? { ...te.output } : null,
          burnTime: te.burnTime ?? 0,
          burnDuration: te.burnDuration ?? 1,
          cookProgress: te.cookProgress ?? 0,
        });
      }
    }
    this.exploredChunks.clear();
    for (const [k, v] of Object.entries(slice.exploredChunks ?? {})) {
      if (typeof v === 'string') this.exploredChunks.set(k, v);
    }
    this.exploredVersion++;
    this.discoveredStructures = (slice.discoveredStructures ?? []).map((s) => ({ ...s }));
    this.waypoints = (slice.waypoints ?? []).map((w) => ({ ...w }));
  }

  /**
   * Cleanly switches active dimension between Overworld and The Nether (1:8 coordinate scale),
   * persisting all edits/maps/tileEntities per dimension and disposing WebGL chunk geometries
   * & dimension-local entities to prevent any memory leak.
   */
  public switchDimension(target: DimensionId): void {
    if (target === this.currentDimension) return;
    const fromDim = this.currentDimension;

    this.flushActiveDimensionSlice();
    this.sound.playPortalTravel();
    this.sound.updateRainAudio(0, false);
    this.sound.updatePortalAmbient(0);
    this.sound.stopJukebox();
    this.bowCharging = false;
    this.bowChargeTime = 0;

    this.activeTileEntityKey = null;
    this.activeTrade = null;
    this.currentHit = null;
    this.targetEntityHint = null;
    this.miningPosKey = null;
    this.breakProgress = 0;
    this.outlineMesh.visible = false;
    this.crackMesh.visible = false;
    this.portalStandTimer = 0;
    this.lastPortalEmitBucket = -1;
    this.onFireTimer = 0;
    this.lastOnFireFlag = false;
    this.lavaDamageTimer = 0;
    this.burnDamageTimer = 0;
    this.magmaDamageTimer = 0;
    this.cactusDamageTimer = 0;

    this.clearAllChunkMeshes();
    this.entities.clearForDimensionSwitch();

    const scaled = scalePortalCoordinates(this.player.x, this.player.z, fromDim, target);
    this.currentDimension = target;
    this.world = new World(this.seed, this.worldType, target);
    this.hydrateDimensionSlice(this.dimStates[target]);

    // Pre-generate destination chunks around scaled coordinates
    const pcx = worldToChunkCoord(scaled.x);
    const pcz = worldToChunkCoord(scaled.z);
    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) {
        this.world.generateChunk(pcx + dx, pcz + dz);
      }
    }

    // Search for an existing portal within 16 blocks or build a safe 4x3 Obsidian platform + 4x5 lit portal
    const existing = findNearestPortal(
      (x, y, z) => this.world.getBlock(x, y, z),
      scaled.x,
      scaled.z,
      16
    );
    let arrival: { x: number; y: number; z: number };
    if (existing) {
      // Ensure safe landing footing right in front of the existing portal
      const landZ = existing.z + 1;
      if (!isBlockSolid(this.world.getBlock(existing.x, existing.y - 1, landZ))) {
        this.world.setBlock(existing.x, existing.y - 1, landZ, BLOCK_IDS.OBSIDIAN, true);
      }
      if (isBlockSolid(this.world.getBlock(existing.x, existing.y, landZ))) {
        this.world.setBlock(existing.x, existing.y, landZ, BLOCK_IDS.AIR, true);
      }
      if (isBlockSolid(this.world.getBlock(existing.x, existing.y + 1, landZ))) {
        this.world.setBlock(existing.x, existing.y + 1, landZ, BLOCK_IDS.AIR, true);
      }
      arrival = { x: existing.x + 0.5, y: existing.y + 0.05, z: landZ + 0.55 };
    } else {
      const safeY = findSafeReturnPortalY(
        (x, y, z) => this.world.getBlock(x, y, z),
        scaled.x,
        scaled.z,
        target
      );
      arrival = buildSafeReturnPortal(
        (x, y, z, id) => {
          this.world.setBlock(x, y, z, id, true);
        },
        scaled.x,
        safeY,
        scaled.z
      );
    }

    this.player.x = arrival.x;
    this.player.y = arrival.y;
    this.player.z = arrival.z;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.vz = 0;
    this.player.peakAirY = arrival.y;
    this.player.inPortal = false;
    this.player.inLava = false;
    this.player.headInLava = false;
    this.player.inFire = false;
    this.portalCooldown = 4.0;

    // Update map slices & build fresh chunk meshes for destination
    this.drainPendingStructureMobs();
    const dayFactor = this.updateAtmosphere(0, 0);
    this.lastRelightDayFactor = dayFactor;
    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) {
        this.recordExploredChunk(pcx + dx, pcz + dz);
        this.rebuildChunkMesh(pcx + dx, pcz + dz, dayFactor);
      }
    }

    // Orient camera away from the portal face into the open destination vista
    this.yaw = Math.PI;
    this.pitch = -0.06;

    this.saveWorld(true);
    this.pushToast(
      target === 'nether' ? 'Has entrado en El Nether (escala 1:8)' : 'Has regresado al Overworld',
      target === 'nether' ? 'warn' : 'success',
      4000
    );
    this.emitHUD();
  }

  private buildSavePayload(): SavedWorldData {
    this.flushActiveDimensionSlice();
    const ow = this.dimStates.overworld;
    const ne = this.dimStates.nether;
    return {
      version: 4,
      id: this.worldId,
      name: this.worldName,
      currentDimension: this.currentDimension,
      gameMode: this.gameMode,
      difficulty: this.difficulty,
      worldType: this.worldType,
      bonusChest: this.bonusChest,
      lastPlayed: Date.now(),
      seed: this.seed,
      seedLabel: this.seedLabel,
      worldTime: this.worldTime,
      dayCount: this.dayCount,
      weather: this.weather.weather,
      initialSpawn: [...this.initialSpawn],
      bedSpawn: this.bedSpawn ? [...this.bedSpawn] : null,
      player: {
        x: this.player.x,
        y: this.player.y,
        z: this.player.z,
        yaw: this.yaw,
        pitch: this.pitch,
        health: this.health,
        hunger: this.hunger,
        oxygen: this.oxygen,
        selectedSlot: this.selectedSlot,
        isFlying: Boolean(this.player.isFlying),
      },
      inventory: this.inventory.map((s) => (s ? { ...s } : null)),
      enderChestSlots: this.enderChestSlots.map((s) => (s ? { ...s } : null)),
      armor: this.armor.map((s) => (s ? { ...s } : null)) as ArmorSlots,
      // Legacy top-level mirrors Overworld slice for backward compatibility
      blockEdits: ow.blockEdits.map((e) => [e[0], e[1], e[2], e[3]]),
      tileEntities: ow.tileEntities,
      waypoints: ow.waypoints.map((w) => ({ ...w })),
      discoveredStructures: ow.discoveredStructures.map((s) => ({ ...s })),
      exploredChunks: { ...ow.exploredChunks },
      overworld: {
        blockEdits: ow.blockEdits.map((e) => [e[0], e[1], e[2], e[3]]),
        tileEntities: ow.tileEntities,
        exploredChunks: { ...ow.exploredChunks },
        discoveredStructures: ow.discoveredStructures.map((s) => ({ ...s })),
        waypoints: ow.waypoints.map((w) => ({ ...w })),
      },
      nether: {
        blockEdits: ne.blockEdits.map((e) => [e[0], e[1], e[2], e[3]]),
        tileEntities: ne.tileEntities,
        exploredChunks: { ...ne.exploredChunks },
        discoveredStructures: ne.discoveredStructures.map((s) => ({ ...s })),
        waypoints: ne.waypoints.map((w) => ({ ...w })),
      },
      stats: { ...this.stats },
    };
  }

  public saveWorld(silent = false): void {
    try {
      const data = this.buildSavePayload();
      const ok = saveWorldData(data);
      this.worldsList = listWorlds();
      if (ok) {
        if (!silent) {
          this.saveStatus = 'Mundo guardado';
          this.saveStatusTimer = 2.6;
          this.sound.playClick();
          this.pushToast('Mundo guardado correctamente', 'success', 2400);
        }
      } else if (!silent) {
        this.saveStatus = 'Error al guardar';
        this.saveStatusTimer = 2.6;
      }
      this.emitHUD();
    } catch {
      if (!silent) {
        this.saveStatus = 'Error al guardar';
        this.saveStatusTimer = 2.6;
        this.emitHUD();
      }
    }
  }

  public exportWorldJson(): string {
    return JSON.stringify(this.buildSavePayload(), null, 2);
  }

  public importWorldJson(raw: string): { ok: boolean; error?: string } {
    const check = validateSavedWorldJson(raw);
    if (!check.ok || !check.data) {
      return { ok: false, error: check.error };
    }
    const loaded = this.applySavedWorldData(check.data);
    if (!loaded) {
      return { ok: false, error: 'No se pudo cargar el mundo desde el archivo.' };
    }
    saveWorldData(check.data);
    this.worldsList = listWorlds();
    this.saveStatus = 'Mundo importado';
    this.saveStatusTimer = 3.0;
    this.setPhase('playing');
    this.sound.playClick();
    return { ok: true };
  }

  public loadSavedWorld(): boolean {
    const list = listWorlds();
    this.worldsList = list;
    if (list.length === 0) return false;
    return this.playWorldById(list[0].id);
  }

  public playWorldById(id: string): boolean {
    const data = loadWorldById(id);
    if (!data) return false;
    const ok = this.applySavedWorldData(data);
    if (ok) {
      this.saveStatus = 'Mundo cargado';
      this.saveStatusTimer = 2.4;
      this.setPhase('playing');
      this.sound.playClick();
    }
    return ok;
  }

  public deleteWorld(id: string): void {
    this.worldsList = deleteWorldById(id);
    this.sound.playClick();
    this.emitHUD();
  }

  public createAndPlayWorld(config: CreateWorldConfig): void {
    const parsed = parseSeedInput(config.seedText);
    this.worldId = generateWorldId();
    this.worldName = config.name.trim() || 'Nuevo Mundo';
    this.gameMode = config.gameMode;
    this.difficulty = config.difficulty;
    this.worldType = config.worldType;
    this.bonusChest = config.bonusChest;

    this.resetWorldState(parsed.seed, false, parsed.label);
    if (this.bonusChest && this.gameMode === 'survival') {
      this.spawnBonusChestNearSpawn();
    }
    this.saveWorld(true);
    this.setPhase('playing');
    this.sound.playClick();
    if (this.gameMode === 'creative') {
      this.pushToast('Modo Creativo: Doble Espacio para volar · E Catálogo', 'info', 4200);
    }
  }

  public updateSettings(partial: Partial<GlobalSettings>): void {
    this.settings = {
      ...this.settings,
      ...partial,
    };
    this.renderDistance = Math.max(3, Math.min(7, Math.round(this.settings.renderDistance)));
    this.settings.renderDistance = this.renderDistance;
    this.touchControlsMode = this.settings.touchControlsMode;
    this.sound.setVolume(this.settings.volume);
    this.fog.near = Math.max(20, (this.renderDistance - 2) * CHUNK_SIZE);
    this.fog.far = this.renderDistance * CHUNK_SIZE;
    this.applyGraphicsQuality();
    if (!this.isTouchControlsActive()) {
      this.clearTouchInputs();
      this.touchCrouch = false;
    }
    saveGlobalSettings(this.settings);
    this.emitHUD();
  }

  public returnToTitle(autoSave = true): void {
    if (autoSave && (this.phase === 'playing' || this.phase === 'paused')) {
      this.saveWorld(true);
    }
    this.worldsList = listWorlds();
    this.setPhase('title');
  }

  private applySavedWorldData(data: SavedWorldData): boolean {
    try {
      this.worldId = data.id || generateWorldId();
      this.worldName = data.name || 'Mundo Guardado';
      this.gameMode = data.gameMode === 'creative' ? 'creative' : 'survival';
      this.difficulty = data.difficulty ?? 'normal';
      this.worldType = data.worldType ?? 'default';
      this.bonusChest = Boolean(data.bonusChest);
      this.seed = data.seed;
      this.seedLabel = data.seedLabel ?? String(data.seed);
      this.currentDimension = data.currentDimension === 'nether' ? 'nether' : 'overworld';

      // Rebuild per-dimension save slices (supporting legacy v1..v3 saves seamlessly)
      const legacyTileEntities: TileEntityData[] = [...(data.tileEntities ?? [])];
      for (const oldF of (data.furnaces ?? []) as Array<
        FurnaceTileEntity & { smeltProgress?: number }
      >) {
        if (!legacyTileEntities.some((t) => t.key === oldF.key)) {
          legacyTileEntities.push({
            type: 'furnace',
            key: oldF.key,
            input: oldF.input ? { ...oldF.input } : null,
            fuel: oldF.fuel ? { ...oldF.fuel } : null,
            output: oldF.output ? { ...oldF.output } : null,
            burnTime: oldF.burnTime ?? 0,
            burnDuration: oldF.burnDuration ?? 1,
            cookProgress: oldF.cookProgress ?? oldF.smeltProgress ?? 0,
          });
        }
      }

      const owSlice: DimensionSaveSlice = data.overworld
        ? {
            blockEdits: data.overworld.blockEdits ?? [],
            tileEntities: data.overworld.tileEntities ?? [],
            exploredChunks: data.overworld.exploredChunks ?? {},
            discoveredStructures: data.overworld.discoveredStructures ?? [],
            waypoints: data.overworld.waypoints ?? [],
          }
        : {
            blockEdits: data.blockEdits ?? [],
            tileEntities: legacyTileEntities,
            exploredChunks: data.exploredChunks ?? {},
            discoveredStructures: data.discoveredStructures ?? [],
            waypoints: data.waypoints ?? [],
          };

      const neSlice: DimensionSaveSlice = data.nether
        ? {
            blockEdits: data.nether.blockEdits ?? [],
            tileEntities: data.nether.tileEntities ?? [],
            exploredChunks: data.nether.exploredChunks ?? {},
            discoveredStructures: data.nether.discoveredStructures ?? [],
            waypoints: data.nether.waypoints ?? [],
          }
        : createEmptyDimensionSlice();

      this.dimStates = { overworld: owSlice, nether: neSlice };

      this.clearAllChunkMeshes();
      this.entities.dispose();
      this.world = new World(this.seed, this.worldType, this.currentDimension);
      this.hydrateDimensionSlice(this.dimStates[this.currentDimension]);

      this.entities = new EntityManager(this.scene, this.itemAtlasMaterial);
      this.weather.setWeather(data.weather === 'storm' ? 'storm' : 'clear');

      this.worldTime = data.worldTime ?? 4800;
      this.dayCount = data.dayCount ?? 1;
      this.player.x = data.player.x;
      this.player.y = data.player.y;
      this.player.z = data.player.z;
      this.player.vx = this.player.vy = this.player.vz = 0;
      this.player.peakAirY = data.player.y;
      this.player.isFlying = this.gameMode === 'creative' && Boolean(data.player.isFlying);
      this.yaw = data.player.yaw ?? 0.5;
      this.pitch = data.player.pitch ?? -0.1;
      this.health = data.player.health ?? 20;
      this.hunger = data.player.hunger ?? 20;
      this.oxygen = data.player.oxygen ?? 10;
      this.selectedSlot = data.player.selectedSlot ?? 0;

      if (data.initialSpawn) {
        this.initialSpawn = [data.initialSpawn[0], data.initialSpawn[1], data.initialSpawn[2]];
      } else {
        const owProbe =
          this.currentDimension === 'overworld'
            ? this.world
            : new World(this.seed, this.worldType, 'overworld');
        const fallbackSpawn = owProbe.findSpawnPoint();
        this.initialSpawn = [fallbackSpawn.x, fallbackSpawn.y, fallbackSpawn.z];
      }
      this.bedSpawn = data.bedSpawn
        ? [data.bedSpawn[0], data.bedSpawn[1], data.bedSpawn[2]]
        : null;

      this.inventory = new Array<SlotOrNull>(36).fill(null);
      if (Array.isArray(data.inventory)) {
        for (let i = 0; i < 36; i++) {
          this.inventory[i] = data.inventory[i] ?? null;
        }
      }

      this.enderChestSlots = new Array<SlotOrNull>(27).fill(null);
      if (Array.isArray(data.enderChestSlots)) {
        for (let i = 0; i < 27; i++) {
          this.enderChestSlots[i] = data.enderChestSlots[i] ?? null;
        }
      }
      this.noteBlockPitches.clear();
      this.bowCharging = false;
      this.bowChargeTime = 0;
      this.sound.stopJukebox();

      this.armor = [null, null, null, null];
      if (Array.isArray(data.armor)) {
        for (let i = 0; i < 4; i++) {
          this.armor[i] = data.armor[i] ?? null;
        }
      }
      this.playerAvatar.syncArmor(this.armor);

      this.activeTileEntityKey = null;
      this.activeTrade = null;
      this.sleepAnimTimer = 0;
      this.sleepingAlpha = 0;
      this.portalStandTimer = 0;
      this.portalCooldown = 1.5;
      this.onFireTimer = 0;
      this.lastOnFireFlag = false;
      this.stats = data.stats ?? {
        blocksMined: 0,
        blocksPlaced: 0,
        mobsDefeated: 0,
        dayReached: this.dayCount,
      };

      this.bootstrapSpawnChunks();
      this.syncHeldHand();
      this.updateAtmosphere(0, 0);
      return true;
    } catch {
      return false;
    }
  }

  public resetWorldState(newSeed: number, _clearSaved = false, seedLabel?: string): void {
    this.seed = newSeed >>> 0;
    this.seedLabel = seedLabel ?? String(this.seed);
    this.currentDimension = 'overworld';
    this.dimStates = {
      overworld: createEmptyDimensionSlice(),
      nether: createEmptyDimensionSlice(),
    };
    this.clearAllChunkMeshes();
    this.world.chunks.clear();
    this.world.tileEntities.clear();
    this.world.saplings.clear();
    this.world.blockEdits.clear();
    this.entities.dispose();
    this.world = new World(this.seed, this.worldType, 'overworld');
    this.entities = new EntityManager(this.scene, this.itemAtlasMaterial);
    this.weather.setWeather('clear');
    this.activeTileEntityKey = null;
    this.activeTrade = null;
    this.currentHit = null;
    this.targetEntityHint = null;
    this.outlineMesh.visible = false;
    this.crackMesh.visible = false;
    this.clearTouchInputs();
    this.exploredChunks.clear();
    this.exploredVersion++;
    this.waypoints = [];
    this.discoveredStructures = [];
    this.toasts = [];
    this.sleepAnimTimer = 0;
    this.sleepingAlpha = 0;
    this.portalStandTimer = 0;
    this.portalCooldown = 0;
    this.lastPortalEmitBucket = -1;
    this.onFireTimer = 0;
    this.lastOnFireFlag = false;
    this.lavaDamageTimer = 0;
    this.burnDamageTimer = 0;
    this.magmaDamageTimer = 0;
    this.cactusDamageTimer = 0;
    this.enderChestSlots = new Array<SlotOrNull>(27).fill(null);
    this.noteBlockPitches.clear();
    this.bowCharging = false;
    this.bowChargeTime = 0;
    this.sound.stopJukebox();

    const spawn = this.world.findSpawnPoint();
    this.initialSpawn = [spawn.x, spawn.y, spawn.z];
    this.bedSpawn = null;
    this.player = {
      x: spawn.x,
      y: spawn.y,
      z: spawn.z,
      vx: 0,
      vy: 0,
      vz: 0,
      onGround: false,
      inWater: false,
      headInWater: false,
      inLava: false,
      headInLava: false,
      inPortal: false,
      inFire: false,
      onSoulSand: false,
      onMagma: false,
      crouching: false,
      sprinting: false,
      isFlying: false,
      peakAirY: spawn.y,
      coyoteTimer: 0,
    };
    this.yaw = 0.55;
    this.pitch = -0.12;
    this.health = 20;
    this.hunger = 20;
    this.oxygen = 10;
    this.oxygenDrainTimer = 0;
    this.drownDamageTimer = 0;
    this.eatTimer = 0;
    this.worldTime = 4800;
    this.dayCount = 1;
    this.hurtFlash = 0;
    this.stats = {
      blocksMined: 0,
      blocksPlaced: 0,
      mobsDefeated: 0,
      dayReached: 1,
    };

    this.setupStarterInventory();
    this.bootstrapSpawnChunks();
    this.spawnInitialWildlife();
    this.syncHeldHand();
    this.updateAtmosphere(0, 0);
    this.emitHUD();
  }

  private recordExploredChunk(cx: number, cz: number): void {
    const chunk = this.world.getChunk(cx, cz);
    if (!chunk) return;
    this.exploredChunks.set(chunkKey(cx, cz), this.world.encodeChunkMapSlice(chunk));
    this.exploredVersion++;
  }

  private drainPendingStructureMobs(): void {
    while (this.world.pendingVillagerSpawns.length > 0) {
      const spec = this.world.pendingVillagerSpawns.shift()!;
      this.entities.spawnVillager(
        spec.id,
        spec.wx,
        spec.wy,
        spec.wz,
        spec.homeX,
        spec.homeZ,
        spec.profession
      );
    }
    while (this.world.pendingBlazeSpawns.length > 0) {
      const spec = this.world.pendingBlazeSpawns.shift()!;
      this.entities.spawnBlaze(
        spec.wx,
        spec.wy,
        spec.wz,
        spec.homeX,
        spec.homeZ,
        spec.id
      );
    }
  }

  private spawnBonusChestNearSpawn(): void {
    const baseX = Math.floor(this.player.x);
    const baseZ = Math.floor(this.player.z);
    const offsets: Array<[number, number]> = [
      [2, 0],
      [0, 2],
      [-2, 0],
      [0, -2],
      [2, 2],
    ];
    for (const [ox, oz] of offsets) {
      const cx = baseX + ox;
      const cz = baseZ + oz;
      const top = this.world.getHighestBlockAt(cx, cz);
      const y = top.y + 1;
      if (y > 2 && y < 120 && top.blockId !== BLOCK_IDS.WATER) {
        this.world.setBlock(cx, y, cz, BLOCK_IDS.CHEST);
        const chest = this.world.getOrCreateChest(cx, y, cz);
        chest.slots[0] = { id: 'wood_pickaxe', count: 1, durability: 60 };
        chest.slots[1] = { id: BLOCK_IDS.OAK_PLANKS, count: 4 };
        chest.slots[2] = { id: 'stick', count: 2 };
        chest.slots[3] = { id: 'apple', count: 2 };
        chest.slots[4] = { id: BLOCK_IDS.TORCH, count: 2 };

        // Place 2 torches flanking the bonus chest
        const torchDirs: Array<[number, number]> = [
          [1, 0],
          [-1, 0],
        ];
        for (const [tx, tz] of torchDirs) {
          const tTop = this.world.getHighestBlockAt(cx + tx, cz + tz);
          if (tTop.blockId !== BLOCK_IDS.WATER && Math.abs(tTop.y - top.y) <= 1) {
            this.world.setBlock(cx + tx, tTop.y + 1, cz + tz, BLOCK_IDS.TORCH);
          }
        }
        return;
      }
    }
  }

  private bootstrapSpawnChunks(): void {
    const pcx = worldToChunkCoord(this.player.x);
    const pcz = worldToChunkCoord(this.player.z);
    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) {
        this.world.generateChunk(pcx + dx, pcz + dz);
        this.recordExploredChunk(pcx + dx, pcz + dz);
      }
    }
    this.drainPendingStructureMobs();
    const dayFactor = this.computeAmbientDayFactor();
    this.lastRelightDayFactor = dayFactor;
    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) {
        this.rebuildChunkMesh(pcx + dx, pcz + dz, dayFactor);
      }
    }
    const bx = Math.floor(this.player.x);
    const bz = Math.floor(this.player.z);
    for (let y = Math.floor(this.player.y); y < 120; y++) {
      if (
        !isBlockSolid(this.world.getBlock(bx, y, bz)) &&
        !isBlockSolid(this.world.getBlock(bx, y + 1, bz))
      ) {
        this.player.y = Math.max(this.player.y, y + 0.05);
        break;
      }
    }

    const footY = Math.floor(this.player.y);
    let bestYaw = this.yaw;
    let bestClear = -1;
    for (let i = 0; i < 8; i++) {
      const testYaw = (i * Math.PI) / 4;
      const fx = -Math.sin(testYaw);
      const fz = -Math.cos(testYaw);
      let clearSteps = 0;
      for (let s = 1; s <= 10; s++) {
        const tx = Math.floor(this.player.x + fx * s);
        const tz = Math.floor(this.player.z + fz * s);
        if (
          !isBlockSolid(this.world.getBlock(tx, footY, tz)) &&
          !isBlockSolid(this.world.getBlock(tx, footY + 1, tz))
        ) {
          clearSteps++;
        } else {
          break;
        }
      }
      if (clearSteps > bestClear) {
        bestClear = clearSteps;
        bestYaw = testYaw;
      }
    }
    this.yaw = bestYaw;
  }

  private spawnInitialWildlife(): void {
    const pigOffsets: Array<[number, number]> = [
      [8, -6],
      [-8, 9],
    ];
    for (const [ox, oz] of pigOffsets) {
      const wx = Math.floor(this.player.x + ox);
      const wz = Math.floor(this.player.z + oz);
      const sy = this.world.getSurfaceHeightAt(wx, wz) + 1;
      if (sy > 2 && this.world.getBlock(wx, sy - 1, wz) === BLOCK_IDS.GRASS) {
        this.entities.spawnPig(wx + 0.5, sy, wz + 0.5);
      }
    }
    const sheepOffsets: Array<[number, number]> = [
      [11, 8],
      [-10, -8],
    ];
    for (const [ox, oz] of sheepOffsets) {
      const wx = Math.floor(this.player.x + ox);
      const wz = Math.floor(this.player.z + oz);
      const sy = this.world.getSurfaceHeightAt(wx, wz) + 1;
      if (sy > 2 && this.world.getBlock(wx, sy - 1, wz) === BLOCK_IDS.GRASS) {
        this.entities.spawnSheep(wx + 0.5, sy, wz + 0.5);
      }
    }
  }

  // ---- Public API called by React UI ----

  private clearTouchInputs(): void {
    this.touchForward = 0;
    this.touchStrafe = 0;
    this.touchSprint = false;
    this.touchJumpHeld = false;
    this.touchFlyDown = false;
    this.touchMineHeld = false;
    this.touchUseHeld = false;
  }

  public isTouchControlsActive(): boolean {
    if (this.touchControlsMode === 'on') return true;
    if (this.touchControlsMode === 'off') return false;
    return this.isTouchDevice;
  }

  public cycleTouchControlsMode(): void {
    const order: TouchControlsMode[] = ['auto', 'on', 'off'];
    const idx = order.indexOf(this.touchControlsMode);
    const next = order[(idx + 1) % order.length];
    this.updateSettings({ touchControlsMode: next });
    this.sound.playClick();
  }

  public setTouchJoystick(forward: number, strafe: number, sprint: boolean): void {
    this.touchForward = Math.max(-1, Math.min(1, forward));
    this.touchStrafe = Math.max(-1, Math.min(1, strafe));
    this.touchSprint = sprint;
  }

  public rotateCamera(deltaYaw: number, deltaPitch: number): void {
    if (this.phase !== 'playing' || this.modal !== 'none') return;
    const scale = this.settings.sensitivity;
    this.yaw -= deltaYaw * scale;
    this.pitch = Math.max(
      -Math.PI * 0.49,
      Math.min(Math.PI * 0.49, this.pitch - deltaPitch * scale)
    );
  }

  public setTouchJump(held: boolean): void {
    if (held && !this.touchJumpHeld) {
      this.jumpJustPressed = true;
    }
    this.touchJumpHeld = held;
  }

  public setTouchFlyDown(held: boolean): void {
    this.touchFlyDown = held;
  }

  public toggleCreativeFlight(): void {
    if (this.gameMode !== 'creative') return;
    this.player.isFlying = !this.player.isFlying;
    this.player.vy = 0;
    this.sound.playClick();
    this.emitHUD();
  }

  public toggleTouchCrouch(): void {
    this.touchCrouch = !this.touchCrouch;
    this.sound.playClick();
    this.emitHUD();
  }

  public setTouchMine(held: boolean): void {
    if (held && !this.touchMineHeld) {
      this.leftMouseJustPressed = true;
    }
    this.touchMineHeld = held;
    if (!held && !this.leftMouseHeld) {
      this.breakProgress = 0;
      this.miningPosKey = null;
      this.crackMesh.visible = false;
    }
  }

  public setTouchUse(held: boolean): void {
    if (held && !this.touchUseHeld) {
      this.rightMouseJustPressed = true;
    }
    this.touchUseHeld = held;
    if (!held && !this.rightMouseHeld && this.eatTimer > 0) {
      this.eatTimer = 0;
      this.emitHUD();
    }
  }

  public setPhase(next: GamePhase): void {
    this.phase = next;
    document.body.dataset.state = next;
    if (next !== 'playing') {
      this.keys.clear();
      this.leftMouseHeld = false;
      this.rightMouseHeld = false;
      this.clearTouchInputs();
      this.eatTimer = 0;
      this.releasePointerLock();
      this.sound.updateRainAudio(0, false);
      this.sound.updatePortalAmbient(0);
    }
    if (next === 'playing') {
      this.modal = 'none';
      this.activeTileEntityKey = null;
      this.activeTrade = null;
      this.firstPersonHand.root.visible = !this.thirdPerson;
      this.playerAvatar.group.visible = this.thirdPerson;
    } else if (next === 'title') {
      this.modal = 'none';
      this.outlineMesh.visible = false;
      this.crackMesh.visible = false;
      this.firstPersonHand.root.visible = false;
      this.playerAvatar.group.visible = false;
    }
    this.emitHUD();
  }

  public startGame(loadExisting = false): void {
    if (loadExisting && this.hasSavedWorld()) {
      this.loadSavedWorld();
      return;
    }
    this.setPhase('playing');
    this.sound.playClick();
  }

  public previewSeed(seedInput?: string | number): { seed: number; label: string } {
    const parsed = parseSeedInput(seedInput);
    this.resetWorldState(parsed.seed, false, parsed.label);
    this.setPhase('title');
    this.sound.playClick();
    return parsed;
  }

  public playWithSeed(seedInput?: string | number): void {
    const parsed = parseSeedInput(seedInput);
    if (parsed.seed !== this.seed || this.stats.blocksMined > 0 || this.stats.blocksPlaced > 0) {
      this.resetWorldState(parsed.seed, false, parsed.label);
    } else {
      this.seedLabel = parsed.label;
    }
    this.setPhase('playing');
    this.sound.playClick();
  }

  public startNewWorld(seedInput?: string | number): void {
    const parsed = parseSeedInput(seedInput);
    this.worldId = generateWorldId();
    this.resetWorldState(parsed.seed, false, parsed.label);
    this.setPhase('playing');
    this.sound.playClick();
  }

  public respawnPlayer(): void {
    // Dying in The Nether returns the player safely to their Overworld spawn/bed
    if (this.currentDimension !== 'overworld') {
      this.flushActiveDimensionSlice();
      this.clearAllChunkMeshes();
      this.entities.clearForDimensionSwitch();
      this.currentDimension = 'overworld';
      this.world = new World(this.seed, this.worldType, 'overworld');
      this.hydrateDimensionSlice(this.dimStates.overworld);
    }
    const [sx, sy, sz] = this.bedSpawn ?? this.initialSpawn;
    this.player.x = sx;
    this.player.y = sy;
    this.player.z = sz;
    this.player.vx = this.player.vy = this.player.vz = 0;
    this.player.peakAirY = sy;
    this.player.isFlying = false;
    this.player.inLava = false;
    this.player.headInLava = false;
    this.player.inPortal = false;
    this.player.inFire = false;
    this.portalStandTimer = 0;
    this.portalCooldown = 0;
    this.onFireTimer = 0;
    this.lastOnFireFlag = false;
    this.lavaDamageTimer = 0;
    this.burnDamageTimer = 0;
    this.magmaDamageTimer = 0;
    this.health = this.maxHealth;
    this.hunger = this.maxHunger;
    this.oxygen = this.maxOxygen;
    this.hurtFlash = 0;
    this.invulnTimer = 2.0;
    this.bootstrapSpawnChunks();
    this.updateAtmosphere(0, 0);
    this.setPhase('playing');
    this.sound.playClick();
  }

  public setModal(modal: ModalType, tileEntityKey: string | null = null): void {
    const wasChest = this.modal === 'chest';
    this.modal = modal;
    this.activeTileEntityKey = tileEntityKey;
    if (modal !== 'trade') {
      this.activeTrade = null;
    }
    if (wasChest && modal === 'none') {
      this.sound.playChest(false);
    }
    if (modal !== 'none') {
      this.keys.clear();
      this.leftMouseHeld = false;
      this.rightMouseHeld = false;
      this.eatTimer = 0;
      this.releasePointerLock();
    }
    this.emitHUD();
  }

  public openInventoryOrCreative(): void {
    if (this.phase !== 'playing') return;
    this.sound.playClick();
    if (this.modal !== 'none') {
      this.setModal('none');
    } else {
      this.setModal(this.gameMode === 'creative' ? 'creative' : 'inventory');
    }
  }

  public toggleWorldMap(): void {
    if (this.phase !== 'playing') return;
    this.sound.playClick();
    if (this.modal === 'map') {
      this.setModal('none');
    } else {
      this.setModal('map');
    }
  }

  public giveCreativeItem(itemId: ItemId, targetSlot?: number): void {
    if (this.gameMode !== 'creative') return;
    const def = getItemDef(itemId);
    if (!def) return;
    const slotIdx =
      targetSlot !== undefined
        ? Math.max(0, Math.min(8, targetSlot))
        : this.selectedSlot;
    this.inventory[slotIdx] = {
      id: itemId,
      count: def.maxStack,
      durability: def.maxDurability,
    };
    this.selectedSlot = slotIdx;
    this.syncHeldHand();
    this.sound.playClick();
    this.emitHUD();
  }

  public clearHotbarSlot(index: number): void {
    if (index < 0 || index > 8) return;
    this.inventory[index] = null;
    this.syncHeldHand();
    this.sound.playClick();
    this.emitHUD();
  }

  public executeTrade(offerId: string): boolean {
    if (!this.activeTrade) return false;
    const offer = this.activeTrade.offers.find((o) => o.id === offerId);
    if (!offer) return false;
    const ok = executeVillagerTrade(this.inventory, offer);
    if (ok) {
      this.sound.playTrade();
      this.syncHeldHand();
      const rewardName = getItemDef(offer.rewardId)?.name ?? 'Objeto';
      this.pushToast(`Intercambio: +${offer.rewardCount} ${rewardName}`, 'success', 2600);
      this.emitHUD();
    }
    return ok;
  }

  public toggleWeather(): void {
    const next = this.weather.toggleWeather();
    this.sound.playClick();
    this.pushToast(next === 'storm' ? 'Clima: Tormenta' : 'Clima: Despejado', 'info', 2500);
    this.emitHUD();
  }

  public addWaypoint(name: string, x: number, z: number, color: string): void {
    const trimmed = name.trim() || 'Marcador';
    this.waypoints.push({
      id: `wp_${Date.now().toString(36)}_${Math.floor(Math.random() * 999)}`,
      name: trimmed.slice(0, 24),
      x: Math.round(x),
      z: Math.round(z),
      color,
    });
    this.sound.playClick();
    this.pushToast(`Marcador creado: ${trimmed}`, 'success', 2200);
    this.emitHUD();
  }

  public removeWaypoint(id: string): void {
    this.waypoints = this.waypoints.filter((w) => w.id !== id);
    this.sound.playClick();
    this.emitHUD();
  }

  public getExploredChunks(): ReadonlyMap<string, string> {
    return this.exploredChunks;
  }

  public getPlayerTransform(): { x: number; y: number; z: number; yaw: number } {
    return { x: this.player.x, y: this.player.y, z: this.player.z, yaw: this.yaw };
  }

  public requestPointerLock(): void {
    if (this.phase !== 'playing' || this.modal !== 'none' || this.isTouchControlsActive()) return;
    try {
      this.renderer.domElement.requestPointerLock?.();
    } catch {
      // Headless or mobile browsers may decline pointer lock
    }
  }

  public releasePointerLock(): void {
    if (document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock?.();
    }
  }

  public setSelectedSlot(index: number): void {
    const clamped = ((index % 9) + 9) % 9;
    if (this.selectedSlot === clamped) return;
    this.selectedSlot = clamped;
    this.eatTimer = 0;
    this.bowCharging = false;
    this.bowChargeTime = 0;
    this.syncHeldHand();
    this.emitHUD();
  }

  public updateInventory(nextInventory: SlotOrNull[]): void {
    this.inventory = nextInventory.map((s) => (s ? { ...s } : null));
    this.syncHeldHand();
    this.emitHUD();
  }

  public updateArmor(nextArmor: ArmorSlots): void {
    this.armor = nextArmor.map((s) => (s ? { ...s } : null)) as ArmorSlots;
    this.playerAvatar.syncArmor(this.armor);
    this.emitHUD();
  }

  public updateFurnace(updated: FurnaceTileEntity): void {
    this.world.tileEntities.set(updated.key, {
      ...updated,
      type: 'furnace',
      input: updated.input ? { ...updated.input } : null,
      fuel: updated.fuel ? { ...updated.fuel } : null,
      output: updated.output ? { ...updated.output } : null,
    });
    this.emitHUD();
  }

  public updateChest(updated: ChestTileEntity): void {
    if (updated.key === 'ender_chest') {
      this.enderChestSlots = updated.slots.map((s) => (s ? { ...s } : null));
      this.emitHUD();
      return;
    }
    this.world.tileEntities.set(updated.key, {
      type: 'chest',
      key: updated.key,
      slots: updated.slots.map((s) => (s ? { ...s } : null)),
    });
    this.emitHUD();
  }

  public toggleMute(): void {
    this.sound.muted = !this.sound.muted;
    if (this.sound.muted) {
      this.sound.updateRainAudio(0, false);
      this.sound.updatePortalAmbient(0);
    }
    this.emitHUD();
  }

  public toggleMinimap(): void {
    this.showMinimap = !this.showMinimap;
    this.sound.playClick();
    this.emitHUD();
  }

  public toggleThirdPerson(): void {
    this.thirdPerson = !this.thirdPerson;
    this.firstPersonHand.root.visible = !this.thirdPerson && this.phase === 'playing';
    this.playerAvatar.group.visible = this.thirdPerson && this.phase === 'playing';
    this.sound.playClick();
    this.emitHUD();
  }

  public toggleDebug(): void {
    this.showDebug = !this.showDebug;
    this.emitHUD();
  }

  public setRenderDistance(dist: number): void {
    this.updateSettings({ renderDistance: dist });
  }

  public advanceTime(ticks = 3000): void {
    this.worldTime += ticks;
    while (this.worldTime >= TICKS_PER_DAY) {
      this.worldTime -= TICKS_PER_DAY;
      this.dayCount += 1;
      this.stats.dayReached = Math.max(this.stats.dayReached, this.dayCount);
    }
    this.sound.playClick();
    this.emitHUD();
  }

  public getIconDataUrls(): Record<string, string> {
    return this.atlas.iconDataUrls;
  }

  /**
   * Renders the permanent top-right topographic minimap with mobs, structures & rim-clamped waypoints.
   */
  public drawMinimap(ctx: CanvasRenderingContext2D, size: number): void {
    const radius = 48;
    const grid = radius * 2;
    const px = Math.floor(this.player.x);
    const pz = Math.floor(this.player.z);

    const img = ctx.createImageData(size, size);
    const data = img.data;

    for (let py = 0; py < size; py++) {
      const wz = pz + Math.floor((py / size) * grid - radius);
      for (let pxi = 0; pxi < size; pxi++) {
        const wx = px + Math.floor((pxi / size) * grid - radius);
        const top = this.world.getHighestBlockAt(wx, wz);
        const north = this.world.getHighestBlockAt(wx, wz - 1);
        const west = this.world.getHighestBlockAt(wx - 1, wz);

        const def = BLOCKS[top.blockId];
        const [br, bg, bb] = parseHexRgb(def?.mapColor ?? '#5ea33c');

        let shade = 1.0;
        if (top.blockId === BLOCK_IDS.WATER) {
          shade = 0.92 + Math.sin((wx + wz) * 0.25) * 0.05;
        } else if (top.blockId === BLOCK_IDS.LAVA) {
          shade = 1.02 + Math.sin((wx - wz) * 0.3) * 0.08;
        } else {
          const slope = (top.y - north.y) + (top.y - west.y) * 0.5;
          shade = THREE.MathUtils.clamp(0.95 + slope * 0.1 + (top.y - 48) * 0.004, 0.58, 1.24);
        }

        const idx = (py * size + pxi) * 4;
        data[idx] = Math.min(255, Math.max(0, Math.round(br * shade)));
        data[idx + 1] = Math.min(255, Math.max(0, Math.round(bg * shade)));
        data[idx + 2] = Math.min(255, Math.max(0, Math.round(bb * shade)));
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);

    // Subtle chunk grid lines
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.16)';
    ctx.lineWidth = 1;
    const scale = size / grid;
    const firstChunkX = Math.ceil((px - radius) / CHUNK_SIZE) * CHUNK_SIZE;
    for (let wx = firstChunkX; wx <= px + radius; wx += CHUNK_SIZE) {
      const sx = Math.round((wx - (px - radius)) * scale) + 0.5;
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, size);
      ctx.stroke();
    }
    const firstChunkZ = Math.ceil((pz - radius) / CHUNK_SIZE) * CHUNK_SIZE;
    for (let wz = firstChunkZ; wz <= pz + radius; wz += CHUNK_SIZE) {
      const sy = Math.round((wz - (pz - radius)) * scale) + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, sy);
      ctx.lineTo(size, sy);
      ctx.stroke();
    }

    const half = size * 0.5;

    // Nearby mobs (color-coded dots)
    for (const mob of this.entities.mobs) {
      if (mob.dead) continue;
      const sx = half + (mob.x - this.player.x) * scale;
      const sy = half + (mob.z - this.player.z) * scale;
      if (sx < 4 || sx > size - 4 || sy < 4 || sy > size - 4) continue;
      ctx.beginPath();
      ctx.arc(sx, sy, mob.kind === 'villager' || mob.kind === 'ghast' ? 2.6 : 2.1, 0, Math.PI * 2);
      ctx.fillStyle =
        mob.kind === 'villager'
          ? '#34d399'
          : mob.kind === 'zombie_piglin'
          ? '#f472b6'
          : mob.kind === 'zombie' ||
            mob.kind === 'skeleton' ||
            mob.kind === 'ghast' ||
            mob.kind === 'blaze'
          ? '#ef4444'
          : '#fef08a';
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }

    // Discovered structures pins
    for (const st of this.discoveredStructures) {
      const sx = half + (st.x - this.player.x) * scale;
      const sy = half + (st.z - this.player.z) * scale;
      if (sx < 3 || sx > size - 3 || sy < 3 || sy > size - 3) continue;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle =
        st.type === 'village'
          ? '#fbbf24'
          : st.type === 'desert_pyramid'
          ? '#f97316'
          : st.type === 'nether_fortress'
          ? '#dc2626'
          : '#38bdf8';
      ctx.fillRect(-3, -3, 6, 6);
      ctx.strokeStyle = '#111111';
      ctx.lineWidth = 1;
      ctx.strokeRect(-3, -3, 6, 6);
      ctx.restore();
    }

    // Waypoints (clamped to rim if outside minimap bounds)
    const pad = 6;
    for (const wp of this.waypoints) {
      let sx = half + (wp.x - this.player.x) * scale;
      let sy = half + (wp.z - this.player.z) * scale;
      const clamped = sx < pad || sx > size - pad || sy < pad || sy > size - pad;
      if (clamped) {
        const dx = sx - half;
        const dy = sy - half;
        const maxComp = Math.max(Math.abs(dx), Math.abs(dy), 1);
        const factor = (half - pad) / maxComp;
        sx = half + dx * factor;
        sy = half + dy * factor;
      }
      ctx.beginPath();
      ctx.arc(sx, sy, clamped ? 3.2 : 3.8, 0, Math.PI * 2);
      ctx.fillStyle = wp.color;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    // Center rotated player directional arrow
    ctx.save();
    ctx.translate(half, half);
    ctx.rotate(-this.yaw);
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  private syncHeldHand(): void {
    const held = this.inventory[this.selectedSlot];
    this.firstPersonHand.setHeldItem(held ? held.id : null);
  }

  // ---- Input & DOM Listeners ----

  private readonly onKeyDown = (e: KeyboardEvent) => {
    if (
      document.activeElement instanceof HTMLInputElement ||
      document.activeElement instanceof HTMLTextAreaElement
    ) {
      return;
    }

    const code = e.code;

    // F3 Technical Debug HUD (prevent browser search bar)
    if (code === 'F3') {
      e.preventDefault();
      this.toggleDebug();
      return;
    }

    // F5 Third-Person Camera Toggle (prevent browser page refresh)
    if (code === 'F5') {
      e.preventDefault();
      if (this.phase === 'playing') {
        this.toggleThirdPerson();
      }
      return;
    }

    if (this.phase === 'title') {
      return;
    }

    if (this.phase === 'gameover') {
      if (code === 'Enter' || code === 'Space') {
        e.preventDefault();
        this.respawnPlayer();
      }
      return;
    }

    // Pause toggle: Esc or P
    if (code === 'KeyP' || code === 'Escape') {
      if (this.modal !== 'none') {
        e.preventDefault();
        this.setModal('none');
        return;
      }
      if (this.phase === 'playing') {
        e.preventDefault();
        this.setPhase('paused');
        return;
      }
      if (this.phase === 'paused') {
        e.preventDefault();
        this.setPhase('playing');
        return;
      }
    }

    // Inventory / Creative Catalog toggle: E
    if (code === 'KeyE' && this.phase === 'playing') {
      e.preventDefault();
      this.openInventoryOrCreative();
      return;
    }

    // Fullscreen World Map toggle: M
    if (code === 'KeyM' && this.phase === 'playing') {
      if (this.modal === 'none' || this.modal === 'map') {
        e.preventDefault();
        this.toggleWorldMap();
        return;
      }
    }

    // Audio Mute toggle: N
    if (code === 'KeyN') {
      this.toggleMute();
      return;
    }

    // Quick Save: K
    if (code === 'KeyK' && this.phase === 'playing' && this.modal === 'none') {
      this.saveWorld();
      return;
    }

    // Time forward hotkey: T
    if (code === 'KeyT' && this.phase === 'playing' && this.modal === 'none') {
      this.advanceTime(3000);
      return;
    }

    if (this.phase !== 'playing' || this.modal !== 'none') return;

    if (code.startsWith('Digit')) {
      const n = Number(code.slice(5));
      if (n >= 1 && n <= 9) {
        this.setSelectedSlot(n - 1);
      }
    }

    if (code === 'Space' && !this.keys.has('Space')) {
      const now = performance.now();
      if (this.gameMode === 'creative' && now - this.lastSpaceTapTime < 300) {
        this.lastSpaceTapTime = 0;
        this.toggleCreativeFlight();
      } else {
        this.lastSpaceTapTime = now;
        this.jumpJustPressed = true;
      }
    }
    if (code === 'Space') e.preventDefault();
    this.keys.add(code);
  };

  private readonly onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private readonly onMouseMove = (e: MouseEvent) => {
    if (this.phase !== 'playing' || this.modal !== 'none') return;
    if (document.pointerLockElement === this.renderer.domElement) {
      const sens = 0.0022 * this.settings.sensitivity;
      this.yaw -= e.movementX * sens;
      this.pitch = Math.max(
        -Math.PI * 0.49,
        Math.min(Math.PI * 0.49, this.pitch - e.movementY * sens)
      );
    }
  };

  private readonly onMouseDown = (e: MouseEvent) => {
    if (this.phase !== 'playing' || this.modal !== 'none') return;
    if (e.target !== this.renderer.domElement) return;
    if (this.isTouchControlsActive()) return;

    if (document.pointerLockElement !== this.renderer.domElement) {
      this.requestPointerLock();
    }

    if (e.button === 0) {
      this.leftMouseHeld = true;
      this.leftMouseJustPressed = true;
    } else if (e.button === 1) {
      // Middle-Click Pick Block in Creative Mode
      if (this.gameMode === 'creative' && this.currentHit) {
        e.preventDefault();
        this.giveCreativeItem(this.currentHit.blockId, this.selectedSlot);
      }
    } else if (e.button === 2) {
      e.preventDefault();
      this.rightMouseHeld = true;
      this.rightMouseJustPressed = true;
    }
  };

  private readonly onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) {
      this.leftMouseHeld = false;
      this.breakProgress = 0;
      this.miningPosKey = null;
      this.crackMesh.visible = false;
    } else if (e.button === 2) {
      this.rightMouseHeld = false;
      if (this.bowCharging) {
        this.firePlayerArrow();
      }
      if (this.eatTimer > 0) {
        this.eatTimer = 0;
        this.emitHUD();
      }
    }
  };

  private readonly onWheel = (e: WheelEvent) => {
    if (this.phase !== 'playing' || this.modal !== 'none') return;
    if (Math.abs(e.deltaY) < 1) return;
    const step = e.deltaY > 0 ? 1 : -1;
    this.setSelectedSlot(this.selectedSlot + step);
  };

  private readonly onContextMenu = (e: MouseEvent) => {
    if (e.target === this.renderer.domElement) {
      e.preventDefault();
    }
  };

  private readonly onPointerLockChange = () => {
    const locked = document.pointerLockElement === this.renderer.domElement;
    this.pointerLocked = locked;
    if (!locked) {
      this.leftMouseHeld = false;
      this.rightMouseHeld = false;
      this.eatTimer = 0;
      this.bowCharging = false;
      this.bowChargeTime = 0;
      this.breakProgress = 0;
      this.crackMesh.visible = false;
    }
    this.emitHUD();
  };

  private readonly onWindowBlur = () => {
    this.keys.clear();
    this.leftMouseHeld = false;
    this.rightMouseHeld = false;
    this.eatTimer = 0;
    this.bowCharging = false;
    this.bowChargeTime = 0;
  };

  private readonly onContextLost = (e: Event) => {
    e.preventDefault();
  };

  private bindEvents(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('wheel', this.onWheel, { passive: true });
    window.addEventListener('contextmenu', this.onContextMenu);
    window.addEventListener('blur', this.onWindowBlur);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    this.renderer.domElement.addEventListener('webglcontextlost', this.onContextLost);
  }

  private handleResize(): void {
    const w = Math.max(1, this.container.clientWidth || window.innerWidth);
    const h = Math.max(1, this.container.clientHeight || window.innerHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  // ---- Chunk Priority Streaming (max 2 chunks / frame) ----

  private streamChunks(dayFactor: number): void {
    const pcx = worldToChunkCoord(this.player.x);
    const pcz = worldToChunkCoord(this.player.z);
    const rd = this.renderDistance;

    for (const [key, chunk] of this.world.chunks.entries()) {
      const dist = Math.max(Math.abs(chunk.cx - pcx), Math.abs(chunk.cz - pcz));
      if (dist > rd + 1) {
        const entry = this.chunkMeshes.get(key);
        if (entry) {
          if (entry.opaqueMesh) {
            this.chunkGroup.remove(entry.opaqueMesh);
            entry.opaqueMesh.geometry.dispose();
          }
          if (entry.transparentMesh) {
            this.chunkGroup.remove(entry.transparentMesh);
            entry.transparentMesh.geometry.dispose();
          }
          if (entry.crossMesh) {
            this.chunkGroup.remove(entry.crossMesh);
            entry.crossMesh.geometry.dispose();
          }
          this.chunkMeshes.delete(key);
        }
        this.world.chunks.delete(key);
      }
    }

    const pending: Array<{ cx: number; cz: number; distSq: number; needsGen: boolean }> = [];
    for (let dz = -rd; dz <= rd; dz++) {
      for (let dx = -rd; dx <= rd; dx++) {
        if (dx * dx + dz * dz > (rd + 0.5) * (rd + 0.5)) continue;
        const cx = pcx + dx;
        const cz = pcz + dz;
        const chunk = this.world.getChunk(cx, cz);
        if (!chunk) {
          pending.push({ cx, cz, distSq: dx * dx + dz * dz, needsGen: true });
        } else if (chunk.dirty || !this.chunkMeshes.has(chunkKey(cx, cz))) {
          pending.push({ cx, cz, distSq: dx * dx + dz * dz, needsGen: false });
        }
      }
    }

    this.lastPendingChunks = pending.length;
    if (pending.length === 0) return;
    pending.sort((a, b) => a.distSq - b.distSq);

    const limit = Math.min(2, pending.length);
    for (let i = 0; i < limit; i++) {
      const job = pending[i];
      if (job.needsGen) {
        this.world.generateChunk(job.cx, job.cz);
        this.recordExploredChunk(job.cx, job.cz);
      }
      this.rebuildChunkMesh(job.cx, job.cz, dayFactor);
    }
    this.drainPendingStructureMobs();
  }

  private rebuildChunkMesh(cx: number, cz: number, dayFactor: number): void {
    const chunk = this.world.getChunk(cx, cz);
    if (!chunk) return;
    if (chunk.lightDirty) {
      this.world.computeChunkLight(chunk);
    }

    const key = chunkKey(cx, cz);
    const prev = this.chunkMeshes.get(key);
    if (prev) {
      if (prev.opaqueMesh) {
        this.chunkGroup.remove(prev.opaqueMesh);
        prev.opaqueMesh.geometry.dispose();
      }
      if (prev.transparentMesh) {
        this.chunkGroup.remove(prev.transparentMesh);
        prev.transparentMesh.geometry.dispose();
      }
      if (prev.crossMesh) {
        this.chunkGroup.remove(prev.crossMesh);
        prev.crossMesh.geometry.dispose();
      }
    }

    const built = ChunkMesher.buildChunk(this.world, chunk, dayFactor);
    let opaqueMesh: THREE.Mesh | null = null;
    let transparentMesh: THREE.Mesh | null = null;
    let crossMesh: THREE.Mesh | null = null;

    if (built.opaqueGeometry) {
      opaqueMesh = new THREE.Mesh(built.opaqueGeometry, this.opaqueMaterial);
      opaqueMesh.position.set(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE);
      this.chunkGroup.add(opaqueMesh);
    }
    if (built.transparentGeometry) {
      transparentMesh = new THREE.Mesh(built.transparentGeometry, this.transparentMaterial);
      transparentMesh.position.set(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE);
      transparentMesh.renderOrder = 2;
      this.chunkGroup.add(transparentMesh);
    }
    if (built.crossGeometry) {
      crossMesh = new THREE.Mesh(built.crossGeometry, this.crossMaterial);
      crossMesh.position.set(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE);
      this.chunkGroup.add(crossMesh);
    }

    this.chunkMeshes.set(key, {
      opaqueMesh,
      transparentMesh,
      crossMesh,
      opaqueLightData: built.opaqueLightData,
      transparentLightData: built.transparentLightData,
      crossLightData: built.crossLightData,
    });
    chunk.dirty = false;
  }

  // ---- Day/Night Cycle & Sky Interpolation ----

  private computeAmbientDayFactor(): number {
    if (this.currentDimension === 'nether') return 0.35;
    const sunAngle = (this.worldTime / TICKS_PER_DAY) * Math.PI * 2;
    const sunElev = Math.sin(sunAngle);
    return THREE.MathUtils.clamp((sunElev + 0.25) / 1.15, 0.16, 1.0);
  }

  private updateAtmosphere(dt: number, stormDarkness = 0): number {
    if (this.phase === 'playing' && this.modal === 'none') {
      this.worldTime += TICKS_PER_SECOND * dt;
      if (this.worldTime >= TICKS_PER_DAY) {
        this.worldTime -= TICKS_PER_DAY;
        this.dayCount += 1;
        this.stats.dayReached = Math.max(this.stats.dayReached, this.dayCount);
      }
    }

    // Crimson volcanic Nether atmosphere (no Sun, Moon, Clouds, or Day/Night cycle)
    if (this.currentDimension === 'nether') {
      this.celestialPivot.visible = false;
      this.cloudGroup.visible = false;
      if (this.player.headInLava) {
        _skyColor.setHex(0x9b2408);
        this.fog.near = 1;
        this.fog.far = 8;
      } else {
        _skyColor.setHex(0x3b0a0a);
        this.fog.near = 10;
        this.fog.far = Math.min(54, this.renderDistance * CHUNK_SIZE * 0.68);
      }
      (this.scene.background as THREE.Color).copy(_skyColor);
      this.fog.color.copy(_skyColor);

      this.sunLight.position.set(this.player.x + 24, this.player.y + 42, this.player.z + 18);
      this.sunLight.color.setHex(0xff8c5a);
      this.sunLight.intensity = 0.55;
      _hemiSky.setHex(0xb84a39);
      _hemiGround.setHex(0x3a1410);
      this.hemiLight.color.copy(_hemiSky);
      this.hemiLight.groundColor.copy(_hemiGround);
      this.hemiLight.intensity = 0.72;
      return 0.35;
    }

    this.celestialPivot.visible = true;
    this.cloudGroup.visible = true;

    const sunAngle = (this.worldTime / TICKS_PER_DAY) * Math.PI * 2;
    const sunElev = Math.sin(sunAngle);
    const dayFactor = this.computeAmbientDayFactor() * (1 - stormDarkness * 0.42);

    this.celestialPivot.position.set(this.player.x, this.player.y, this.player.z);
    this.celestialPivot.rotation.z = sunAngle - Math.PI * 0.5;

    const nightCol = 0x0b1224;
    const dawnCol = 0xf29f6d;
    const noonCol = 0x7ec0ff;
    const sunsetCol = 0xe87a54;

    if (sunElev >= 0) {
      const t = Math.min(1, sunElev / 0.45);
      const isMorning = Math.cos(sunAngle) >= 0;
      _skyColor.setHex(isMorning ? dawnCol : sunsetCol).lerp(_sunColor.setHex(noonCol), t);
    } else {
      const t = Math.min(1, -sunElev / 0.32);
      const isDusk = Math.cos(sunAngle) < 0;
      _skyColor.setHex(isDusk ? sunsetCol : dawnCol).lerp(_sunColor.setHex(nightCol), t);
    }

    if (stormDarkness > 0.01) {
      _skyColor.lerp(_sunColor.setHex(0x4a5568), Math.min(0.72, stormDarkness * 1.45));
    }

    if (this.player.headInLava) {
      _skyColor.setHex(0x9b2408);
    } else if (this.player.headInWater) {
      _skyColor.lerp(_sunColor.setHex(0x164a85), 0.72);
    }

    (this.scene.background as THREE.Color).copy(_skyColor);
    this.fog.color.copy(_skyColor);
    const stormFogScale = 1 - stormDarkness * 0.35;
    if (this.player.headInLava) {
      this.fog.near = 1;
      this.fog.far = 8;
    } else if (this.player.headInWater) {
      this.fog.near = 2;
      this.fog.far = 18;
    } else {
      this.fog.near = Math.max(16, (this.renderDistance - 2) * CHUNK_SIZE * stormFogScale);
      this.fog.far = this.renderDistance * CHUNK_SIZE * stormFogScale;
    }

    this.sunLight.position.set(
      this.player.x + Math.cos(sunAngle) * 80,
      this.player.y + Math.max(12, Math.abs(sunElev) * 90),
      this.player.z + 25
    );
    this.sunLight.intensity = (0.2 + dayFactor * 0.72) * (1 - stormDarkness * 0.55);
    this.sunLight.color.setHex(sunElev > 0.2 ? 0xfff5df : sunElev > -0.1 ? 0xffb37a : 0x6f8ec9);

    _hemiSky.setHex(sunElev > 0 ? 0xbce2ff : 0x263961);
    _hemiGround.setHex(sunElev > 0 ? 0x526147 : 0x181f29);
    this.hemiLight.color.copy(_hemiSky);
    this.hemiLight.groundColor.copy(_hemiGround);
    this.hemiLight.intensity = 0.28 + dayFactor * 0.5;

    this.updateVolumetricClouds(dt, dayFactor);

    if (Math.abs(dayFactor - this.lastRelightDayFactor) > 0.035) {
      this.lastRelightDayFactor = dayFactor;
      for (const entry of this.chunkMeshes.values()) {
        ChunkMesher.relightGeometry(entry.opaqueMesh?.geometry ?? null, entry.opaqueLightData, dayFactor, false);
        ChunkMesher.relightGeometry(entry.transparentMesh?.geometry ?? null, entry.transparentLightData, dayFactor, false);
        ChunkMesher.relightGeometry(entry.crossMesh?.geometry ?? null, entry.crossLightData, dayFactor, false);
      }
    }

    return dayFactor;
  }

  // ---- Background Furnace TileEntity Ticking ----

  private updateFurnaces(dt: number): void {
    let activeChanged = false;
    for (const te of this.world.tileEntities.values()) {
      if (te.type !== 'furnace') continue;
      const f = te;
      const smeltResult = getSmeltOutput(f.input?.id);
      const canOutput =
        smeltResult !== null &&
        (!f.output || (f.output.id === smeltResult && f.output.count < 64));

      const prevBurn = Math.round(f.burnTime * 5);
      const prevProg = Math.round(f.cookProgress * 5);

      if (f.burnTime > 0) {
        f.burnTime = Math.max(0, f.burnTime - dt);
      }

      if (f.burnTime <= 0 && canOutput && f.fuel && f.fuel.count > 0) {
        const dur = getFuelDuration(f.fuel.id);
        if (dur > 0) {
          f.burnTime = dur;
          f.burnDuration = dur;
          f.fuel.count -= 1;
          if (f.fuel.count <= 0) f.fuel = null;
          if (f.key === this.activeTileEntityKey) activeChanged = true;
        }
      }

      if (f.burnTime > 0 && canOutput && f.input && smeltResult !== null) {
        f.cookProgress += dt;
        if (f.cookProgress >= SMELT_TIME_SECONDS) {
          f.cookProgress = 0;
          f.input.count -= 1;
          if (f.input.count <= 0) f.input = null;
          if (!f.output) {
            f.output = { id: smeltResult, count: 1 };
          } else {
            f.output.count += 1;
          }
          if (f.key === this.activeTileEntityKey) activeChanged = true;
        }
      } else if (!canOutput) {
        f.cookProgress = 0;
      }

      if (
        f.key === this.activeTileEntityKey &&
        (Math.round(f.burnTime * 5) !== prevBurn || Math.round(f.cookProgress * 5) !== prevProg)
      ) {
        activeChanged = true;
      }
    }

    if (activeChanged && this.modal === 'furnace') {
      this.emitHUD();
    }
  }

  // ---- Combat, Armor Mitigation, Oxygen, Eating, Mining & Placement ----

  private damagePlayer(
    amount: number,
    source: DamageSource = 'mob',
    dirX = 0,
    dirZ = 0
  ): void {
    if (this.phase !== 'playing' || this.invulnTimer > 0 || this.gameMode === 'creative') return;

    let finalDamage = amount;
    if (
      source === 'mob' ||
      source === 'arrow' ||
      source === 'fireball' ||
      source === 'explosion'
    ) {
      const armorPts = calculateTotalArmorPoints(this.armor);
      if (armorPts > 0) {
        finalDamage = applyArmorDamageReduction(amount, armorPts);
        this.damageEquippedArmor();
      }
    }

    this.health = Math.max(0, this.health - Math.max(1, Math.round(finalDamage)));
    this.hurtFlash = 0.35;
    this.invulnTimer = 0.55;
    this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.55);
    if (dirX !== 0 || dirZ !== 0) {
      this.player.vx += dirX * 5.2;
      this.player.vz += dirZ * 5.2;
      this.player.vy = Math.max(this.player.vy, 3.6);
    }
    this.sound.playHurt();

    if (this.health <= 0) {
      this.setPhase('gameover');
    } else {
      this.emitHUD();
    }
  }

  private damageEquippedArmor(): void {
    let broken = false;
    for (let i = 0; i < 4; i++) {
      const slot = this.armor[i];
      if (!slot || slot.durability === undefined) continue;
      slot.durability -= 1;
      if (slot.durability <= 0) {
        this.armor[i] = null;
        broken = true;
      }
    }
    if (broken) {
      this.playerAvatar.syncArmor(this.armor);
    }
  }

  private damageHeldTool(): void {
    const slot = this.inventory[this.selectedSlot];
    if (!slot || slot.durability === undefined) return;
    slot.durability -= 1;
    if (slot.durability <= 0) {
      this.inventory[this.selectedSlot] = null;
      this.syncHeldHand();
    }
    this.emitHUD();
  }

  private getPlayerLookDirection(): [number, number, number] {
    const cosPitch = Math.cos(this.pitch);
    return [
      -Math.sin(this.yaw) * cosPitch,
      Math.sin(this.pitch),
      -Math.cos(this.yaw) * cosPitch,
    ];
  }

  private explodeAt(wx: number, wy: number, wz: number, radius = 3.5): void {
    this.sound.playExplosion();
    this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.85);
    this.entities.particles.emitBlockBurst(wx - 0.5, wy - 0.5, wz - 0.5, '#ff7b1c', 18);
    this.entities.particles.emitBlockBurst(wx - 0.5, wy - 0.5, wz - 0.5, '#facc15', 10);
    this.entities.particles.emitBlockBurst(wx - 0.5, wy - 0.5, wz - 0.5, '#52525b', 10);

    const rCeil = Math.ceil(radius);
    const cx0 = Math.floor(wx);
    const cy0 = Math.floor(wy);
    const cz0 = Math.floor(wz);
    const touchedChunks = new Set<string>();

    for (let dy = -rCeil; dy <= rCeil; dy++) {
      const by = cy0 + dy;
      if (by <= 0 || by >= 127) continue;
      for (let dz = -rCeil; dz <= rCeil; dz++) {
        for (let dx = -rCeil; dx <= rCeil; dx++) {
          const dist = Math.hypot(dx, dy, dz);
          if (dist > radius * (0.85 + Math.random() * 0.25)) continue;
          const bx = cx0 + dx;
          const bz = cz0 + dz;
          const id = this.world.getBlock(bx, by, bz);
          if (
            id === BLOCK_IDS.AIR ||
            id === BLOCK_IDS.WATER ||
            id === BLOCK_IDS.LAVA ||
            BLOCKS[id]?.explosionResistant
          ) {
            continue;
          }
          if (id === BLOCK_IDS.TNT) {
            this.world.setBlock(bx, by, bz, BLOCK_IDS.AIR, true);
            this.entities.spawnPrimedTnt(bx + 0.5, by, bz + 0.5, 0.55 + Math.random() * 0.45);
            touchedChunks.add(`${worldToChunkCoord(bx)},${worldToChunkCoord(bz)}`);
            continue;
          }
          if (this.world.setBlock(bx, by, bz, BLOCK_IDS.AIR, true)) {
            this.world.tileEntities.delete(`${bx},${by},${bz}`);
            touchedChunks.add(`${worldToChunkCoord(bx)},${worldToChunkCoord(bz)}`);
          }
        }
      }
    }

    for (const k of touchedChunks) {
      const [tcx, tcz] = k.split(',').map(Number);
      this.recordExploredChunk(tcx, tcz);
    }

    // Distance-scaled blast damage to player (Survival)
    const pdx = this.player.x - wx;
    const pdy = this.player.y + 0.9 - wy;
    const pdz = this.player.z - wz;
    const pDist = Math.hypot(pdx, pdy, pdz);
    if (pDist < radius * 1.45) {
      const factor = 1 - pDist / (radius * 1.45);
      const hLen = Math.hypot(pdx, pdz) || 1;
      this.damagePlayer(Math.max(2, Math.round(12 * factor)), 'explosion', pdx / hLen, pdz / hLen);
    }

    // Distance-scaled blast damage to nearby mobs
    for (const mob of this.entities.mobs) {
      if (mob.dead) continue;
      const mdx = mob.x - wx;
      const mdy = mob.y + mob.height * 0.5 - wy;
      const mdz = mob.z - wz;
      const mDist = Math.hypot(mdx, mdy, mdz);
      if (mDist < radius * 1.45) {
        const factor = 1 - mDist / (radius * 1.45);
        const hLen = Math.hypot(mdx, mdz) || 1;
        const killed = mob.takeDamage(Math.max(2, 14 * factor), mdx / hLen, mdz / hLen);
        if (killed) {
          for (const drop of mob.getDrops()) {
            this.entities.spawnDroppedItem(drop.itemId, drop.count, mob.x, mob.y + 0.5, mob.z);
          }
        }
      }
    }
  }

  private extinguishConnectedPortal(startX: number, startY: number, startZ: number): void {
    const queue: Array<[number, number, number]> = [];
    const visited = new Set<string>();
    const dirs: Array<[number, number, number]> = [
      [0, 0, 0],
      [1, 0, 0],
      [-1, 0, 0],
      [0, 1, 0],
      [0, -1, 0],
      [0, 0, 1],
      [0, 0, -1],
    ];
    for (const [dx, dy, dz] of dirs) {
      const nx = startX + dx;
      const ny = startY + dy;
      const nz = startZ + dz;
      if (this.world.getBlock(nx, ny, nz) === BLOCK_IDS.NETHER_PORTAL) {
        const k = `${nx},${ny},${nz}`;
        if (!visited.has(k)) {
          visited.add(k);
          queue.push([nx, ny, nz]);
        }
      }
    }

    let head = 0;
    while (head < queue.length && head < 256) {
      const [cx, cy, cz] = queue[head++];
      this.world.setBlock(cx, cy, cz, BLOCK_IDS.AIR, true);
      for (let i = 1; i < dirs.length; i++) {
        const [dx, dy, dz] = dirs[i];
        const nx = cx + dx;
        const ny = cy + dy;
        const nz = cz + dz;
        const k = `${nx},${ny},${nz}`;
        if (!visited.has(k) && this.world.getBlock(nx, ny, nz) === BLOCK_IDS.NETHER_PORTAL) {
          visited.add(k);
          queue.push([nx, ny, nz]);
        }
      }
    }
  }

  private trySleepInBed(hx: number, hy: number, hz: number): void {
    // Classic Nether rule: Beds explode violently when used in The Nether!
    if (this.currentDimension === 'nether') {
      this.world.setBlock(hx, hy, hz, BLOCK_IDS.AIR, true);
      this.explodeAt(hx + 0.5, hy + 0.5, hz + 0.5, 4.0);
      this.pushToast('¡Las camas explotan en el Nether!', 'warn', 3600);
      return;
    }

    this.bedSpawn = [hx + 0.5, hy + 0.65, hz + 0.5];
    this.pushToast('Punto de reaparición establecido', 'success', 2800);

    const isNightOrStorm =
      this.worldTime >= 12500 || this.worldTime < 500 || this.weather.weather === 'storm';
    if (!isNightOrStorm) {
      this.pushToast('Solo puedes dormir por la noche o durante tormentas', 'warn', 3200);
      return;
    }
    if (this.sleepAnimTimer <= 0) {
      this.sleepAnimTimer = 1.5;
      this.sleepSwitchedTime = false;
      this.lastSleepEmitBucket = -1;
      this.sound.playBedSleep();
    }
  }

  /**
   * Settles Sand, Red Sand, and Gravel downward when placed in midair or undermined.
   */
  private settleGravityColumn(wx: number, startY: number, wz: number): void {
    let y = startY;
    let moved = false;
    while (y < 126) {
      const id = this.world.getBlock(wx, y, wz);
      if (!BLOCKS[id]?.isGravityBlock) break;
      let destY = y;
      while (destY > 1) {
        const below = this.world.getBlock(wx, destY - 1, wz);
        if (
          below === BLOCK_IDS.AIR ||
          below === BLOCK_IDS.WATER ||
          below === BLOCK_IDS.LAVA ||
          below === BLOCK_IDS.TALL_GRASS
        ) {
          destY--;
        } else {
          break;
        }
      }
      if (destY < y) {
        this.world.setBlock(wx, y, wz, BLOCK_IDS.AIR, true);
        this.world.setBlock(wx, destY, wz, id, true);
        moved = true;
      }
      y++;
    }
    if (moved) {
      this.recordExploredChunk(worldToChunkCoord(wx), worldToChunkCoord(wz));
    }
  }

  /**
   * Sponge absorbs all water blocks within a 3-block Manhattan/cube radius upon placement.
   */
  private absorbWaterWithSponge(cx: number, cy: number, cz: number): void {
    let absorbed = 0;
    const touched = new Set<string>();
    for (let dy = -3; dy <= 3; dy++) {
      const by = cy + dy;
      if (by <= 0 || by >= 127) continue;
      for (let dz = -3; dz <= 3; dz++) {
        for (let dx = -3; dx <= 3; dx++) {
          const bx = cx + dx;
          const bz = cz + dz;
          if (this.world.getBlock(bx, by, bz) === BLOCK_IDS.WATER) {
            this.world.setBlock(bx, by, bz, BLOCK_IDS.AIR, true);
            absorbed++;
            touched.add(`${worldToChunkCoord(bx)},${worldToChunkCoord(bz)}`);
          }
        }
      }
    }
    if (absorbed > 0) {
      for (const k of touched) {
        const [tcx, tcz] = k.split(',').map(Number);
        this.recordExploredChunk(tcx, tcz);
      }
      this.sound.playSplash();
      this.entities.particles.emitBlockBurst(cx, cy + 0.5, cz, '#38bdf8', 14);
      this.pushToast(`Esponja absorbió ${absorbed} bloques de agua`, 'info', 2200);
    }
  }

  private firePlayerArrow(): void {
    if (!this.bowCharging) return;
    const charge = Math.max(0.2, Math.min(1.0, this.bowChargeTime));
    this.bowCharging = false;
    this.bowChargeTime = 0;
    this.lastBowEmitBucket = 0;

    const isCreative = this.gameMode === 'creative';
    if (!isCreative) {
      const arrowIdx = this.inventory.findIndex((s) => s && s.id === 'arrow' && s.count > 0);
      if (arrowIdx < 0) {
        this.emitHUD();
        return;
      }
      const arrowSlot = this.inventory[arrowIdx]!;
      arrowSlot.count -= 1;
      if (arrowSlot.count <= 0) this.inventory[arrowIdx] = null;
      this.damageHeldTool();
    }

    const [dirX, dirY, dirZ] = this.getPlayerLookDirection();
    const eyeX = this.player.x;
    const eyeY = this.player.y + this.currentEyeHeight - 0.08;
    const eyeZ = this.player.z;
    const speed = 15 + 24 * charge;
    const damage = 3 + Math.round(7 * charge);
    this.entities.spawnArrow(
      eyeX + dirX * 0.65,
      eyeY + dirY * 0.65,
      eyeZ + dirZ * 0.65,
      dirX * speed,
      dirY * speed + 1.1,
      dirZ * speed,
      'player',
      damage
    );
    this.sound.playBowShoot();
    this.firstPersonHand.triggerSwing();
    this.playerAvatar.triggerSwing();
    this.emitHUD();
  }

  private showCompassToast(): void {
    const target = this.bedSpawn ?? this.initialSpawn;
    const dx = target[0] - this.player.x;
    const dz = target[2] - this.player.z;
    const dist = Math.round(Math.hypot(dx, dz));
    let dir = 'Norte';
    const angle = (Math.atan2(dx, -dz) * 180) / Math.PI;
    const norm = (angle + 360) % 360;
    if (norm >= 22.5 && norm < 67.5) dir = 'Noreste';
    else if (norm >= 67.5 && norm < 112.5) dir = 'Este';
    else if (norm >= 112.5 && norm < 157.5) dir = 'Sureste';
    else if (norm >= 157.5 && norm < 202.5) dir = 'Sur';
    else if (norm >= 202.5 && norm < 247.5) dir = 'Suroeste';
    else if (norm >= 247.5 && norm < 292.5) dir = 'Oeste';
    else if (norm >= 292.5 && norm < 337.5) dir = 'Noroeste';
    const label = this.bedSpawn ? 'Cama' : 'Spawn';
    this.sound.playClick();
    this.pushToast(
      `🧭 Brújula → ${label} (${Math.round(target[0])}, ${Math.round(target[2])}) · ${dist}m al ${dir}`,
      'info',
      3600
    );
  }

  private showClockToast(): void {
    const totalMinutes = Math.floor(((this.worldTime + 6000) % TICKS_PER_DAY) / (TICKS_PER_DAY / 1440));
    const hh = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
    const mm = String(totalMinutes % 60).padStart(2, '0');
    const phaseLabel =
      this.currentDimension === 'nether'
        ? 'Nether (sin ciclo)'
        : this.worldTime < 1000
        ? 'Amanecer'
        : this.worldTime < 12000
        ? 'Día'
        : this.worldTime < 13800
        ? 'Atardecer'
        : 'Noche';
    this.sound.playClick();
    this.pushToast(`🕒 Reloj: ${hh}:${mm} · ${phaseLabel} · Día ${this.dayCount}`, 'info', 3400);
  }

  private isCompostableItem(itemId: ItemId | null): boolean {
    if (itemId === null) return false;
    if (typeof itemId === 'string') {
      return (
        itemId === 'wheat' ||
        itemId === 'apple' ||
        itemId === 'melon_slice' ||
        itemId === 'carrot' ||
        itemId === 'cookie' ||
        itemId === 'bread'
      );
    }
    const def = BLOCKS[itemId];
    return Boolean(
      def?.isLeaves ||
        ALL_SAPLING_IDS.includes(itemId) ||
        itemId === BLOCK_IDS.TALL_GRASS ||
        itemId === BLOCK_IDS.RED_FLOWER ||
        itemId === BLOCK_IDS.DANDELION ||
        itemId === BLOCK_IDS.BLUE_ORCHID ||
        itemId === BLOCK_IDS.SUGAR_CANE ||
        itemId === BLOCK_IDS.PUMPKIN ||
        itemId === BLOCK_IDS.MELON ||
        itemId === BLOCK_IDS.RED_MUSHROOM ||
        itemId === BLOCK_IDS.BROWN_MUSHROOM ||
        itemId === BLOCK_IDS.HAY_BALE
    );
  }

  private handleInteractions(dt: number): void {
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.creativeBreakCooldown = Math.max(0, this.creativeBreakCooldown - dt);

    const [dirX, dirY, dirZ] = this.getPlayerLookDirection();
    const eyeX = this.player.x;
    const eyeY = this.player.y + this.currentEyeHeight;
    const eyeZ = this.player.z;

    const hit = raycastVoxel(
      eyeX,
      eyeY,
      eyeZ,
      dirX,
      dirY,
      dirZ,
      (x, y, z) => this.world.getBlock(x, y, z),
      5.0
    );
    this.currentHit = hit;

    // Check if aiming at a Villager, Shearable Sheep, or interactive block for contextual HUD prompt
    const heldSlot = this.inventory[this.selectedSlot];
    const heldId: ItemId | null = heldSlot ? heldSlot.id : null;
    const heldDef = getItemDef(heldId);
    const isCreative = this.gameMode === 'creative';

    const lookedVillager = this.entities.findLookedAtVillager(
      eyeX,
      eyeY,
      eyeZ,
      dirX,
      dirY,
      dirZ,
      4.2
    );
    const lookedSheep =
      heldId === 'shears'
        ? this.entities.findLookedAtSheep(eyeX, eyeY, eyeZ, dirX, dirY, dirZ, 4.0)
        : null;

    if (lookedVillager) {
      this.targetEntityHint = `Clic Der: Comerciar (${VILLAGER_TITLES[lookedVillager.profession]})`;
    } else if (lookedSheep) {
      this.targetEntityHint = 'Clic Der: Esquilar Oveja (2-3 Lana)';
    } else if (hit) {
      const bid = hit.blockId;
      if (bid === BLOCK_IDS.BED) {
        this.targetEntityHint = 'Clic Der: Dormir y fijar reaparición';
      } else if (bid === BLOCK_IDS.TNT) {
        this.targetEntityHint = 'Clic Der: Encender TNT';
      } else if (
        bid === BLOCK_IDS.OAK_DOOR ||
        bid === BLOCK_IDS.OAK_DOOR_OPEN ||
        bid === BLOCK_IDS.IRON_DOOR ||
        bid === BLOCK_IDS.IRON_DOOR_OPEN ||
        bid === BLOCK_IDS.OAK_TRAPDOOR ||
        bid === BLOCK_IDS.OAK_TRAPDOOR_OPEN ||
        bid === BLOCK_IDS.OAK_FENCE_GATE ||
        bid === BLOCK_IDS.OAK_FENCE_GATE_OPEN
      ) {
        this.targetEntityHint = 'Clic Der: Abrir / Cerrar';
      } else if (bid === BLOCK_IDS.JUKEBOX) {
        this.targetEntityHint = 'Clic Der: Reproducir / Detener música';
      } else if (bid === BLOCK_IDS.NOTE_BLOCK) {
        this.targetEntityHint = 'Clic Der: Tocar nota y cambiar tono';
      } else if (bid === BLOCK_IDS.ANVIL) {
        this.targetEntityHint = 'Clic Der: Reparar herramienta en mano';
      } else if (bid === BLOCK_IDS.ENDER_CHEST) {
        this.targetEntityHint = 'Clic Der: Abrir Cofre de Ender compartido';
      } else if (bid === BLOCK_IDS.BARREL) {
        this.targetEntityHint = 'Clic Der: Abrir Barril';
      } else if (bid === BLOCK_IDS.COMPOSTER) {
        this.targetEntityHint = 'Clic Der con planta: Producir Polvo de Hueso';
      } else {
        this.targetEntityHint = null;
      }
    } else {
      this.targetEntityHint = null;
    }

    if (hit) {
      this.outlineMesh.visible = true;
      this.outlineMesh.position.set(hit.pos[0] + 0.5, hit.pos[1] + 0.5, hit.pos[2] + 0.5);
    } else {
      this.outlineMesh.visible = false;
    }

    // 1. Left-click one-shot: deflect Ghast fireball OR melee attack mob (with Critical Hit when falling in air!)
    if (this.leftMouseJustPressed) {
      this.leftMouseJustPressed = false;
      this.firstPersonHand.triggerSwing();
      this.playerAvatar.triggerSwing();
      if (this.attackCooldown <= 0) {
        if (this.entities.tryDeflectFireball(eyeX, eyeY, eyeZ, dirX, dirY, dirZ)) {
          this.attackCooldown = 0.25;
          this.sound.playCriticalHit();
          this.pushToast('¡Bola de fuego devuelta!', 'success', 2200);
          return;
        }
        const dmg = getWeaponDamage(heldId);
        const isCritical = !this.player.onGround && this.player.vy < -0.5 && !this.player.inWater;
        const atk = this.entities.tryAttackMob(
          eyeX,
          eyeY,
          eyeZ,
          dirX,
          dirY,
          dirZ,
          dmg,
          isCritical
        );
        if (atk.hit && atk.kind) {
          this.attackCooldown = 0.35;
          if (atk.critical) {
            this.sound.playCriticalHit();
          } else {
            this.sound.playMobHit(atk.kind);
          }
          if (!isCreative) this.damageHeldTool();
          if (atk.killed) {
            this.stats.mobsDefeated += 1;
            this.emitHUD();
          }
          return;
        }
      }

      // Creative Mode: Instant 1-click block breaking (any block above y=0, no dropped items)
      if (isCreative && hit && hit.pos[1] > 0 && this.creativeBreakCooldown <= 0) {
        const [hx, hy, hz] = hit.pos;
        const blockDef = BLOCKS[hit.blockId];
        this.world.setBlock(hx, hy, hz, BLOCK_IDS.AIR);
        this.settleGravityColumn(hx, hy + 1, hz);
        if (hit.blockId === BLOCK_IDS.OBSIDIAN || hit.blockId === BLOCK_IDS.NETHER_PORTAL) {
          this.extinguishConnectedPortal(hx, hy, hz);
        }
        this.recordExploredChunk(worldToChunkCoord(hx), worldToChunkCoord(hz));
        this.sound.playBlockBreak(blockDef?.tool === 'pickaxe');
        if (blockDef) {
          this.entities.particles.emitBlockBurst(hx, hy, hz, blockDef.particleColor, 9);
        }
        this.world.tileEntities.delete(`${hx},${hy},${hz}`);
        this.stats.blocksMined += 1;
        this.creativeBreakCooldown = 0.16;
        this.emitHUD();
        return;
      }
    }

    // 2. Left-click / touch mine held: Creative rapid break or Survival progressive crack 0..9
    const miningActive = this.leftMouseHeld || this.touchMineHeld;
    if (miningActive && hit) {
      const [hx, hy, hz] = hit.pos;
      const blockDef = BLOCKS[hit.blockId];
      if (isCreative) {
        if (hy > 0 && this.creativeBreakCooldown <= 0) {
          this.world.setBlock(hx, hy, hz, BLOCK_IDS.AIR);
          this.settleGravityColumn(hx, hy + 1, hz);
          if (hit.blockId === BLOCK_IDS.OBSIDIAN || hit.blockId === BLOCK_IDS.NETHER_PORTAL) {
            this.extinguishConnectedPortal(hx, hy, hz);
          }
          this.recordExploredChunk(worldToChunkCoord(hx), worldToChunkCoord(hz));
          this.sound.playBlockBreak(blockDef?.tool === 'pickaxe');
          if (blockDef) {
            this.entities.particles.emitBlockBurst(hx, hy, hz, blockDef.particleColor, 8);
          }
          this.world.tileEntities.delete(`${hx},${hy},${hz}`);
          this.stats.blocksMined += 1;
          this.creativeBreakCooldown = 0.2;
          this.emitHUD();
        }
        this.breakProgress = 0;
        this.crackMesh.visible = false;
      } else if (!blockDef || blockDef.hardness < 0) {
        this.breakProgress = 0;
        this.crackMesh.visible = false;
      } else {
        const key = `${hx},${hy},${hz}`;
        if (key !== this.miningPosKey) {
          this.miningPosKey = key;
          this.breakProgress = 0;
        }

        const speedMult = getMiningSpeedMultiplier(hit.blockId, heldId);
        const breakTime = Math.max(0.05, blockDef.hardness / Math.max(0.05, speedMult));
        this.breakProgress += dt / breakTime;

        this.mineSoundTimer -= dt;
        if (this.mineSoundTimer <= 0) {
          this.mineSoundTimer = 0.24;
          this.sound.playMineHit(blockDef.tool === 'pickaxe');
          this.entities.particles.emitBlockBurst(hx, hy, hz, blockDef.particleColor, 4);
        }

        const stage = Math.min(9, Math.floor(this.breakProgress * 10));
        this.crackMaterial.map = this.atlas.crackTextures[stage];
        this.crackMaterial.needsUpdate = true;
        this.crackMesh.position.set(hx + 0.5, hy + 0.5, hz + 0.5);
        this.crackMesh.visible = !blockDef.crossMesh;

        if (this.breakProgress >= 1.0) {
          const canDrop = canHarvestBlock(hit.blockId, heldId);
          this.world.setBlock(hx, hy, hz, BLOCK_IDS.AIR);
          this.settleGravityColumn(hx, hy + 1, hz);
          if (hit.blockId === BLOCK_IDS.OBSIDIAN || hit.blockId === BLOCK_IDS.NETHER_PORTAL) {
            this.extinguishConnectedPortal(hx, hy, hz);
          }
          this.recordExploredChunk(worldToChunkCoord(hx), worldToChunkCoord(hz));
          this.sound.playBlockBreak(blockDef.tool === 'pickaxe');
          this.entities.particles.emitBlockBurst(hx, hy, hz, blockDef.particleColor, 11);

          if (blockDef.isLeaves) {
            if (heldId === 'shears') {
              this.entities.spawnDroppedItem(hit.blockId, 1, hx + 0.5, hy + 0.45, hz + 0.5);
            } else {
              const roll = Math.random();
              const saplingDrop =
                hit.blockId === BLOCK_IDS.BIRCH_LEAVES
                  ? BLOCK_IDS.BIRCH_SAPLING
                  : hit.blockId === BLOCK_IDS.SPRUCE_LEAVES
                  ? BLOCK_IDS.SPRUCE_SAPLING
                  : hit.blockId === BLOCK_IDS.JUNGLE_LEAVES
                  ? BLOCK_IDS.JUNGLE_SAPLING
                  : hit.blockId === BLOCK_IDS.ACACIA_LEAVES
                  ? BLOCK_IDS.ACACIA_SAPLING
                  : BLOCK_IDS.OAK_SAPLING;
              if (hit.blockId === BLOCK_IDS.OAK_LEAVES && roll < 0.08) {
                this.entities.spawnDroppedItem('apple', 1, hx + 0.5, hy + 0.45, hz + 0.5);
              } else if (roll < 0.22) {
                this.entities.spawnDroppedItem(saplingDrop, 1, hx + 0.5, hy + 0.45, hz + 0.5);
              }
            }
          } else if (hit.blockId === BLOCK_IDS.GRAVEL && canDrop) {
            if (Math.random() < 0.2) {
              this.entities.spawnDroppedItem('flint', 1, hx + 0.5, hy + 0.45, hz + 0.5);
            } else {
              this.entities.spawnDroppedItem(BLOCK_IDS.GRAVEL, 1, hx + 0.5, hy + 0.45, hz + 0.5);
            }
          } else if (canDrop && blockDef.drop !== null) {
            const dropCount = blockDef.dropCount ?? 1;
            this.entities.spawnDroppedItem(blockDef.drop, dropCount, hx + 0.5, hy + 0.45, hz + 0.5);
          }

          const te = this.world.tileEntities.get(key);
          if (te) {
            if (te.type === 'chest') {
              for (const s of te.slots) {
                if (s && s.count > 0) {
                  this.entities.spawnDroppedItem(s.id, s.count, hx + 0.5, hy + 0.5, hz + 0.5);
                }
              }
            } else if (te.type === 'furnace') {
              for (const s of [te.input, te.fuel, te.output]) {
                if (s && s.count > 0) {
                  this.entities.spawnDroppedItem(s.id, s.count, hx + 0.5, hy + 0.5, hz + 0.5);
                }
              }
            }
            this.world.tileEntities.delete(key);
          }

          this.stats.blocksMined += 1;
          this.damageHeldTool();
          this.breakProgress = 0;
          this.miningPosKey = null;
          this.crackMesh.visible = false;
          this.emitHUD();
        }
      }
    } else {
      this.breakProgress = 0;
      this.miningPosKey = null;
      this.crackMesh.visible = false;
    }

    // 3. Right-click press: Villager trade, Sheep shear, Tools (Bow/Compass/Clock/Buckets/Hoe/BoneMeal/Flint&Steel), Interactive Blocks, or Place Block
    if (this.rightMouseJustPressed) {
      this.rightMouseJustPressed = false;

      if (lookedVillager) {
        this.activeTrade = {
          villagerId: lookedVillager.villagerId,
          profession: lookedVillager.profession,
          title: VILLAGER_TITLES[lookedVillager.profession],
          offers: VILLAGER_TRADES[lookedVillager.profession],
        };
        this.sound.playClick();
        this.setModal('trade');
        return;
      }

      if (lookedSheep && heldId === 'shears') {
        if (lookedSheep.shear()) {
          const woolCount = 2 + (Math.random() < 0.5 ? 1 : 0);
          this.entities.spawnDroppedItem(
            BLOCK_IDS.WHITE_WOOL,
            woolCount,
            lookedSheep.x,
            lookedSheep.y + 0.7,
            lookedSheep.z
          );
          this.entities.particles.emitBlockBurst(
            lookedSheep.x - 0.5,
            lookedSheep.y + 0.7,
            lookedSheep.z - 0.5,
            '#f1f5f9',
            10
          );
          this.sound.playShear();
          this.firstPersonHand.triggerSwing();
          if (!isCreative) this.damageHeldTool();
          this.pushToast(`Esquilaste ${woolCount}× Lana Blanca`, 'success', 2000);
          return;
        }
      }

      // Utility handheld items usable anywhere (Compass, Clock, Bow)
      if (heldId === 'compass') {
        this.showCompassToast();
        return;
      }
      if (heldId === 'clock') {
        this.showClockToast();
        return;
      }
      if (heldId === 'bow') {
        const hasArrows =
          isCreative || this.inventory.some((s) => s && s.id === 'arrow' && s.count > 0);
        if (hasArrows) {
          this.bowCharging = true;
          this.bowChargeTime = 0;
          this.lastBowEmitBucket = 0;
          this.emitHUD();
        } else {
          this.pushToast('Necesitas flechas en el inventario para disparar el Arco', 'warn', 2400);
        }
        return;
      }

      // Interactive Blocks (unless crouching to place against them)
      if (hit && !this.player.crouching) {
        const [hx, hy, hz] = hit.pos;
        const key = `${hx},${hy},${hz}`;
        if (hit.blockId === BLOCK_IDS.BED) {
          this.trySleepInBed(hx, hy, hz);
          return;
        }
        if (hit.blockId === BLOCK_IDS.CRAFTING_TABLE) {
          this.sound.playClick();
          this.setModal('crafting');
          return;
        }
        if (hit.blockId === BLOCK_IDS.FURNACE) {
          this.world.getOrCreateFurnace(hx, hy, hz);
          this.sound.playClick();
          this.setModal('furnace', key);
          return;
        }
        if (hit.blockId === BLOCK_IDS.CHEST || hit.blockId === BLOCK_IDS.BARREL) {
          this.world.getOrCreateChest(hx, hy, hz);
          this.sound.playChest(true);
          this.setModal('chest', key);
          return;
        }
        if (hit.blockId === BLOCK_IDS.ENDER_CHEST) {
          this.sound.playChest(true);
          this.entities.particles.emitBlockBurst(hx, hy + 0.6, hz, '#a855f7', 10);
          this.setModal('chest', 'ender_chest');
          return;
        }
        if (hit.blockId === BLOCK_IDS.TNT) {
          this.world.setBlock(hx, hy, hz, BLOCK_IDS.AIR, true);
          this.entities.spawnPrimedTnt(hx + 0.5, hy, hz + 0.5, 3.0);
          this.sound.playTntFuse();
          this.firstPersonHand.triggerSwing();
          if (heldId === 'flint_and_steel' && !isCreative) this.damageHeldTool();
          return;
        }
        // Doors, Trapdoors, Fence Gates toggle
        const toggleMap: Record<number, { next: number; opening: boolean }> = {
          [BLOCK_IDS.OAK_DOOR]: { next: BLOCK_IDS.OAK_DOOR_OPEN, opening: true },
          [BLOCK_IDS.OAK_DOOR_OPEN]: { next: BLOCK_IDS.OAK_DOOR, opening: false },
          [BLOCK_IDS.IRON_DOOR]: { next: BLOCK_IDS.IRON_DOOR_OPEN, opening: true },
          [BLOCK_IDS.IRON_DOOR_OPEN]: { next: BLOCK_IDS.IRON_DOOR, opening: false },
          [BLOCK_IDS.OAK_TRAPDOOR]: { next: BLOCK_IDS.OAK_TRAPDOOR_OPEN, opening: true },
          [BLOCK_IDS.OAK_TRAPDOOR_OPEN]: { next: BLOCK_IDS.OAK_TRAPDOOR, opening: false },
          [BLOCK_IDS.OAK_FENCE_GATE]: { next: BLOCK_IDS.OAK_FENCE_GATE_OPEN, opening: true },
          [BLOCK_IDS.OAK_FENCE_GATE_OPEN]: { next: BLOCK_IDS.OAK_FENCE_GATE, opening: false },
        };
        const toggled = toggleMap[hit.blockId];
        if (toggled) {
          this.world.setBlock(hx, hy, hz, toggled.next, true);
          this.sound.playDoorToggle(toggled.opening);
          this.firstPersonHand.triggerSwing();
          return;
        }
        if (hit.blockId === BLOCK_IDS.JUKEBOX) {
          const playing = this.sound.toggleJukebox();
          this.entities.particles.emitBlockBurst(
            hx,
            hy + 0.9,
            hz,
            playing ? '#38bdf8' : '#94a3b8',
            8
          );
          this.pushToast(
            playing ? '🎵 Tocadiscos reproduciendo melodía' : '🔇 Tocadiscos detenido',
            'info',
            2200
          );
          return;
        }
        if (hit.blockId === BLOCK_IDS.NOTE_BLOCK) {
          const prev = this.noteBlockPitches.get(key) ?? -1;
          const next = (prev + 1) % 25;
          this.noteBlockPitches.set(key, next);
          this.sound.playNoteBlock(next);
          const noteColors = ['#f43f5e', '#f59e0b', '#10b981', '#38bdf8', '#a855f7'];
          this.entities.particles.emitBlockBurst(
            hx,
            hy + 0.95,
            hz,
            noteColors[next % noteColors.length],
            6
          );
          return;
        }
        if (hit.blockId === BLOCK_IDS.ANVIL) {
          if (heldSlot && heldDef?.maxDurability !== undefined) {
            if ((heldSlot.durability ?? heldDef.maxDurability) < heldDef.maxDurability) {
              heldSlot.durability = heldDef.maxDurability;
              this.sound.playAnvilRepair();
              this.entities.particles.emitBlockBurst(hx, hy + 0.9, hz, '#e2e8f0', 10);
              this.pushToast(`🔨 Reparado al 100%: ${heldDef.name}`, 'success', 2600);
              this.emitHUD();
            } else {
              this.sound.playClick();
              this.pushToast(`${heldDef.name} ya tiene durabilidad completa`, 'info', 2200);
            }
          } else {
            this.sound.playClick();
            this.pushToast('Sostén una herramienta o armadura dañada para repararla', 'info', 2600);
          }
          return;
        }
        if (hit.blockId === BLOCK_IDS.COMPOSTER) {
          if (heldSlot && this.isCompostableItem(heldId)) {
            if (!isCreative) {
              heldSlot.count -= 1;
              if (heldSlot.count <= 0) {
                this.inventory[this.selectedSlot] = null;
                this.syncHeldHand();
              }
            }
            const leftover = addItemToInventory(this.inventory, 'bone_meal', 1);
            if (leftover > 0) {
              this.entities.spawnDroppedItem('bone_meal', leftover, hx + 0.5, hy + 1.0, hz + 0.5);
            }
            this.sound.playBoneMeal();
            this.entities.particles.emitBlockBurst(hx, hy + 0.85, hz, '#4ade80', 8);
            this.pushToast('Compostador → +1 Polvo de Hueso', 'success', 1800);
            this.emitHUD();
            return;
          }
        }
        if (hit.blockId === BLOCK_IDS.ENCHANTING_TABLE) {
          this.sound.playClick();
          this.entities.particles.emitBlockBurst(hx, hy + 0.9, hz, '#c084fc', 10);
          this.pushToast('✨ Mesa de Encantamientos activa', 'info', 2200);
          return;
        }
      }

      // Buckets (Empty / Water / Lava)
      if (hit && heldSlot && heldId === 'bucket') {
        const adjX = hit.pos[0] + hit.normal[0];
        const adjY = hit.pos[1] + hit.normal[1];
        const adjZ = hit.pos[2] + hit.normal[2];
        const targetPos: [number, number, number] | null =
          hit.blockId === BLOCK_IDS.WATER || hit.blockId === BLOCK_IDS.LAVA
            ? hit.pos
            : this.world.getBlock(adjX, adjY, adjZ) === BLOCK_IDS.WATER ||
              this.world.getBlock(adjX, adjY, adjZ) === BLOCK_IDS.LAVA
            ? [adjX, adjY, adjZ]
            : null;
        if (targetPos) {
          const [fx, fy, fz] = targetPos;
          const fluid = this.world.getBlock(fx, fy, fz);
          this.world.setBlock(fx, fy, fz, BLOCK_IDS.AIR, true);
          this.recordExploredChunk(worldToChunkCoord(fx), worldToChunkCoord(fz));
          const filledId: ItemId = fluid === BLOCK_IDS.LAVA ? 'lava_bucket' : 'water_bucket';
          if (isCreative) {
            this.inventory[this.selectedSlot] = { id: filledId, count: 1 };
          } else if (heldSlot.count === 1) {
            this.inventory[this.selectedSlot] = { id: filledId, count: 1 };
          } else {
            heldSlot.count -= 1;
            const leftover = addItemToInventory(this.inventory, filledId, 1);
            if (leftover > 0) {
              this.entities.spawnDroppedItem(filledId, 1, this.player.x, this.player.y + 0.6, this.player.z);
            }
          }
          this.sound.playBucket(true);
          this.syncHeldHand();
          this.firstPersonHand.triggerSwing();
          this.emitHUD();
          return;
        }
      }
      if (hit && heldSlot && (heldId === 'water_bucket' || heldId === 'lava_bucket')) {
        const px = hit.pos[0] + hit.normal[0];
        const py = hit.pos[1] + hit.normal[1];
        const pz = hit.pos[2] + hit.normal[2];
        if (heldId === 'water_bucket' && this.currentDimension === 'nether') {
          this.entities.particles.emitBlockBurst(px, py, pz, '#e2e8f0', 14);
          this.sound.playFireSizzle();
          this.firstPersonHand.triggerSwing();
          if (!isCreative) {
            this.inventory[this.selectedSlot] = { id: 'bucket', count: 1 };
            this.syncHeldHand();
          }
          this.pushToast('💨 El agua se evapora al instante en el Nether', 'warn', 2800);
          this.emitHUD();
          return;
        }
        const existingId = this.world.getBlock(px, py, pz);
        if (
          existingId === BLOCK_IDS.AIR ||
          existingId === BLOCK_IDS.WATER ||
          existingId === BLOCK_IDS.LAVA ||
          existingId === BLOCK_IDS.TALL_GRASS
        ) {
          this.world.setBlock(
            px,
            py,
            pz,
            heldId === 'lava_bucket' ? BLOCK_IDS.LAVA : BLOCK_IDS.WATER,
            true
          );
          this.recordExploredChunk(worldToChunkCoord(px), worldToChunkCoord(pz));
          if (!isCreative) {
            this.inventory[this.selectedSlot] = { id: 'bucket', count: 1 };
            this.syncHeldHand();
          }
          this.sound.playBucket(false);
          this.firstPersonHand.triggerSwing();
          this.emitHUD();
          return;
        }
      }

      // Hoe: till Grass/Dirt into Farmland
      if (hit && heldSlot && heldDef?.toolCategory === 'hoe') {
        const [hx, hy, hz] = hit.pos;
        if (
          (hit.blockId === BLOCK_IDS.GRASS ||
            hit.blockId === BLOCK_IDS.DIRT ||
            hit.blockId === BLOCK_IDS.SNOW_GRASS) &&
          this.world.getBlock(hx, hy + 1, hz) === BLOCK_IDS.AIR
        ) {
          this.world.setBlock(hx, hy, hz, BLOCK_IDS.FARMLAND, true);
          this.sound.playHoeTill();
          this.entities.particles.emitBlockBurst(hx, hy + 0.8, hz, '#6b4728', 7);
          this.firstPersonHand.triggerSwing();
          if (!isCreative) this.damageHeldTool();
          this.emitHUD();
          return;
        }
      }

      // Bone Meal: instant sapling tree growth
      if (hit && heldSlot && heldId === 'bone_meal') {
        const [hx, hy, hz] = hit.pos;
        if (ALL_SAPLING_IDS.includes(hit.blockId)) {
          this.world.growTree(hx, hy, hz, hit.blockId);
          this.recordExploredChunk(worldToChunkCoord(hx), worldToChunkCoord(hz));
          this.sound.playBoneMeal();
          this.entities.particles.emitBlockBurst(hx, hy + 0.6, hz, '#4ade80', 14);
          this.firstPersonHand.triggerSwing();
          if (!isCreative) {
            heldSlot.count -= 1;
            if (heldSlot.count <= 0) {
              this.inventory[this.selectedSlot] = null;
              this.syncHeldHand();
            }
          }
          this.emitHUD();
          return;
        }
      }

      // Flint & Steel: Ignite valid Obsidian Nether Portal frame OR place Fire
      if (hit && heldSlot && heldId === 'flint_and_steel') {
        const px = hit.pos[0] + hit.normal[0];
        const py = hit.pos[1] + hit.normal[1];
        const pz = hit.pos[2] + hit.normal[2];
        const frame = findValidPortalFrame(
          (x, y, z) => this.world.getBlock(x, y, z),
          px,
          py,
          pz
        );
        if (frame) {
          for (const [cx, cy, cz] of frame.interiorCells) {
            this.world.setBlock(cx, cy, cz, BLOCK_IDS.NETHER_PORTAL, true);
            this.entities.particles.emitBlockBurst(cx, cy, cz, '#a855f7', 5);
          }
          this.sound.playPortalActivate();
          this.firstPersonHand.triggerSwing();
          this.playerAvatar.triggerSwing();
          if (!isCreative) this.damageHeldTool();
          this.pushToast('¡Portal del Nether encendido!', 'success', 3400);
          this.emitHUD();
          return;
        }
        if (
          this.world.getBlock(px, py, pz) === BLOCK_IDS.AIR &&
          isBlockSolid(this.world.getBlock(px, py - 1, pz))
        ) {
          this.world.setBlock(px, py, pz, BLOCK_IDS.FIRE, true);
          this.entities.particles.emitBlockBurst(px, py, pz, '#ff8c24', 7);
          this.sound.playFlintAndSteel();
          this.firstPersonHand.triggerSwing();
          this.playerAvatar.triggerSwing();
          if (!isCreative) this.damageHeldTool();
          this.emitHUD();
          return;
        }
      }

      // Place held block adjacent to hit face
      if (hit && heldSlot && heldDef?.isBlock && heldDef.blockId !== undefined) {
        const px = hit.pos[0] + hit.normal[0];
        const py = hit.pos[1] + hit.normal[1];
        const pz = hit.pos[2] + hit.normal[2];

        // Classic Nether rule: Water evaporates instantly into steam in The Nether
        if (heldDef.blockId === BLOCK_IDS.WATER && this.currentDimension === 'nether') {
          this.entities.particles.emitBlockBurst(px, py, pz, '#e2e8f0', 14);
          this.sound.playFireSizzle();
          this.firstPersonHand.triggerSwing();
          this.pushToast('El agua se evapora al instante en el Nether', 'warn', 2800);
          return;
        }

        const existingId = this.world.getBlock(px, py, pz);
        const canReplace =
          existingId === BLOCK_IDS.AIR ||
          existingId === BLOCK_IDS.WATER ||
          existingId === BLOCK_IDS.LAVA ||
          existingId === BLOCK_IDS.FIRE ||
          existingId === BLOCK_IDS.TALL_GRASS;

        let placementValid = canReplace;
        if (
          placementValid &&
          (ALL_SAPLING_IDS.includes(heldDef.blockId) ||
            heldDef.blockId === BLOCK_IDS.RED_FLOWER ||
            heldDef.blockId === BLOCK_IDS.DANDELION ||
            heldDef.blockId === BLOCK_IDS.BLUE_ORCHID)
        ) {
          const belowId = this.world.getBlock(px, py - 1, pz);
          placementValid =
            belowId === BLOCK_IDS.DIRT ||
            belowId === BLOCK_IDS.GRASS ||
            belowId === BLOCK_IDS.SNOW_GRASS ||
            belowId === BLOCK_IDS.FARMLAND ||
            belowId === BLOCK_IDS.PODZOL;
        } else if (placementValid && heldDef.blockId === BLOCK_IDS.CACTUS) {
          const belowId = this.world.getBlock(px, py - 1, pz);
          placementValid =
            belowId === BLOCK_IDS.SAND ||
            belowId === BLOCK_IDS.RED_SAND ||
            belowId === BLOCK_IDS.CACTUS;
        }

        if (placementValid) {
          const pBox = getPlayerAABB(this.player.x, this.player.y, this.player.z);
          const blockSolid = BLOCKS[heldDef.blockId]?.solid ?? true;
          if (!blockSolid || !aabbIntersectsBlock(pBox, px, py, pz)) {
            if (this.world.setBlock(px, py, pz, heldDef.blockId)) {
              if (heldDef.blockId === BLOCK_IDS.SPONGE) {
                this.absorbWaterWithSponge(px, py, pz);
              }
              if (BLOCKS[heldDef.blockId]?.isGravityBlock) {
                this.settleGravityColumn(px, py, pz);
              }
              this.recordExploredChunk(worldToChunkCoord(px), worldToChunkCoord(pz));
              if (!isCreative) {
                heldSlot.count -= 1;
                if (heldSlot.count <= 0) {
                  this.inventory[this.selectedSlot] = null;
                  this.syncHeldHand();
                }
              }
              this.stats.blocksPlaced += 1;
              this.sound.playBlockPlace();
              this.firstPersonHand.triggerSwing();
              this.playerAvatar.triggerSwing();
              this.emitHUD();
            }
          }
        }
      }
    }

    // 3.5 Bow draw charging tick
    const useActive = this.rightMouseHeld || this.touchUseHeld;
    if (this.bowCharging) {
      if (useActive && heldId === 'bow') {
        this.bowChargeTime = Math.min(1.0, this.bowChargeTime + dt * 1.15);
        const bucket = Math.round(this.bowChargeTime * 10);
        if (bucket !== this.lastBowEmitBucket) {
          this.lastBowEmitBucket = bucket;
          this.emitHUD();
        }
      } else {
        this.firePlayerArrow();
      }
    }

    // 4. Right-click / touch use held: Hold-to-Eat food for 1.2s when hungry (or Golden Apple anytime)
    const canEatFood =
      !isCreative &&
      useActive &&
      heldSlot &&
      heldDef?.foodValue &&
      (this.hunger < this.maxHunger || Boolean(heldDef.healAmount));
    if (canEatFood && heldSlot && heldDef?.foodValue) {
      const prevStep = Math.floor((this.eatTimer / EAT_DURATION_SECONDS) * 8);
      this.eatTimer += dt;
      this.eatSoundTimer -= dt;
      if (this.eatSoundTimer <= 0) {
        this.eatSoundTimer = 0.28;
        this.sound.playEat();
        const crumbColor =
          heldSlot.id === 'golden_apple'
            ? '#facc15'
            : heldSlot.id === 'apple' || heldSlot.id === 'melon_slice'
            ? '#db2828'
            : heldSlot.id === 'cooked_porkchop' ||
              heldSlot.id === 'cooked_beef' ||
              heldSlot.id === 'bread' ||
              heldSlot.id === 'cookie'
            ? '#c9854c'
            : '#f09ba0';
        this.entities.particles.emitBlockBurst(
          eyeX + dirX * 0.55 - 0.5,
          eyeY + dirY * 0.55 - 0.5,
          eyeZ + dirZ * 0.55 - 0.5,
          crumbColor,
          3
        );
      }

      if (this.eatTimer >= EAT_DURATION_SECONDS) {
        this.eatTimer = 0;
        this.hunger = Math.min(this.maxHunger, this.hunger + heldDef.foodValue);
        if (heldDef.healAmount) {
          this.health = Math.min(this.maxHealth, this.health + heldDef.healAmount);
          this.entities.particles.emitCriticalBurst(this.player.x, this.player.y + 1.2, this.player.z);
          this.pushToast(`✨ Manzana Dorada: +${heldDef.healAmount} Salud`, 'success', 2600);
        }
        heldSlot.count -= 1;
        if (heldSlot.count <= 0) {
          this.inventory[this.selectedSlot] = null;
          this.syncHeldHand();
        }
        this.sound.playEat();
        this.emitHUD();
      } else if (Math.floor((this.eatTimer / EAT_DURATION_SECONDS) * 8) !== prevStep) {
        this.emitHUD();
      }
    } else if (this.eatTimer > 0) {
      this.eatTimer = 0;
      this.emitHUD();
    }
  }

  // ---- Main Simulation & Render Loop ----

  private readonly tick = () => {
    if (!this.running) return;
    const now = performance.now();
    const rawDt = Math.max(0.001, (now - this.lastTime) / 1000);
    const dt = Math.min(0.05, rawDt);
    this.lastTime = now;
    this.smoothedFps = this.smoothedFps * 0.9 + (1 / rawDt) * 0.1;

    const playerBiome = this.world.getBiomeAt(
      Math.floor(this.player.x),
      Math.floor(this.player.z)
    );
    const weatherUpdate = this.weather.update(
      dt,
      this.player.x,
      this.player.y,
      this.player.z,
      playerBiome,
      this.phase === 'playing' && this.modal === 'none',
      this.currentDimension
    );
    if (weatherUpdate.weatherChanged) {
      this.emitHUD();
    }

    const dayFactor = this.updateAtmosphere(dt, weatherUpdate.stormDarkness);
    this.streamChunks(dayFactor);
    this.updateFurnaces(dt);

    // Expire active toasts
    if (this.toasts.length > 0) {
      const before = this.toasts.length;
      this.toasts = this.toasts.filter((t) => t.expiresAt > now);
      if (this.toasts.length !== before) {
        this.emitHUD();
      }
    }

    if (this.saveStatusTimer > 0) {
      this.saveStatusTimer -= dt;
      if (this.saveStatusTimer <= 0) {
        this.saveStatus = '';
        this.emitHUD();
      }
    }

    // Bed sleep transition animation (1.5s fade to black -> dawn -> fade back)
    if (this.sleepAnimTimer > 0) {
      this.sleepAnimTimer = Math.max(0, this.sleepAnimTimer - dt);
      const progress = 1 - this.sleepAnimTimer / 1.5;
      this.sleepingAlpha = progress < 0.5 ? progress * 2 : (1 - progress) * 2;
      if (progress >= 0.5 && !this.sleepSwitchedTime) {
        this.sleepSwitchedTime = true;
        if (this.worldTime >= 1000) {
          this.dayCount += 1;
          this.stats.dayReached = Math.max(this.stats.dayReached, this.dayCount);
        }
        this.worldTime = 1000;
        this.weather.setWeather('clear');
        this.health = Math.min(this.maxHealth, this.health + 4);
        this.pushToast('Has dormido hasta el amanecer', 'success', 2800);
      }
      if (this.sleepAnimTimer <= 0) {
        this.sleepingAlpha = 0;
        this.emitHUD();
      } else {
        const bucket = Math.round(this.sleepingAlpha * 16);
        if (bucket !== this.lastSleepEmitBucket) {
          this.lastSleepEmitBucket = bucket;
          this.emitHUD();
        }
      }
    }

    if (this.phase === 'title') {
      this.outlineMesh.visible = false;
      this.crackMesh.visible = false;
      this.sound.updateRainAudio(0, false);
      this.flyoverAngle += dt * 0.1;
      const radius = 26;
      const cx = this.player.x + Math.cos(this.flyoverAngle) * radius;
      const cz = this.player.z + Math.sin(this.flyoverAngle) * radius;
      const cy = Math.max(this.player.y + 18, 72) + Math.sin(this.flyoverAngle * 1.4) * 2.0;
      this.camera.position.set(cx, cy, cz);
      this.camera.lookAt(this.player.x, this.player.y + 2.5, this.player.z);
    } else if (this.phase === 'playing') {
      const canControl = this.modal === 'none' && this.sleepAnimTimer <= 0;
      const isCreative = this.gameMode === 'creative';

      // Ambient rain audio (Overworld only, attenuated indoors)
      if (this.currentDimension === 'nether') {
        this.sound.updateRainAudio(0, false);
      } else {
        const indoors =
          this.world.getSkyLight(
            Math.floor(this.player.x),
            Math.floor(this.player.y + 1.5),
            Math.floor(this.player.z)
          ) < 15;
        this.sound.updateRainAudio(weatherUpdate.rainAudioIntensity, indoors);
      }

      // Tick planted Oak Saplings
      this.world.tickSaplings(dt);

      // Keyboard fallback look (Arrow keys)
      if (canControl) {
        const turnSpeed = 2.0 * dt;
        if (this.keys.has('ArrowLeft')) this.yaw += turnSpeed;
        if (this.keys.has('ArrowRight')) this.yaw -= turnSpeed;
        if (this.keys.has('ArrowUp')) this.pitch = Math.min(Math.PI * 0.48, this.pitch + turnSpeed * 0.75);
        if (this.keys.has('ArrowDown')) this.pitch = Math.max(-Math.PI * 0.48, this.pitch - turnSpeed * 0.75);
      }

      const keyForward = canControl
        ? (this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('KeyS') ? 1 : 0)
        : 0;
      const keyStrafe = canControl
        ? (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0)
        : 0;
      const forward = canControl
        ? Math.max(-1, Math.min(1, keyForward + this.touchForward))
        : 0;
      const strafe = canControl
        ? Math.max(-1, Math.min(1, keyStrafe + this.touchStrafe))
        : 0;

      const wasFlying = Boolean(this.player.isFlying);
      const stepRes = stepPlayerPhysics(
        this.player,
        {
          forward,
          strafe,
          jumpHeld: canControl && (this.keys.has('Space') || this.touchJumpHeld),
          jumpJustPressed: canControl && this.jumpJustPressed,
          flyDown:
            canControl &&
            Boolean(this.player.isFlying) &&
            (this.keys.has('ShiftLeft') ||
              this.keys.has('KeyC') ||
              this.keys.has('ControlLeft') ||
              this.touchFlyDown),
          sprint:
            canControl &&
            !this.player.isFlying &&
            (this.keys.has('ShiftLeft') || this.touchSprint) &&
            (isCreative || this.hunger > 4),
          crouch:
            canControl &&
            !this.player.isFlying &&
            (this.keys.has('KeyC') || this.keys.has('ControlLeft') || this.touchCrouch),
          yaw: this.yaw,
        },
        dt,
        (x, y, z) => this.world.getBlock(x, y, z)
      );
      this.jumpJustPressed = false;
      if (wasFlying !== Boolean(this.player.isFlying)) {
        this.emitHUD();
      }

      if (stepRes.splashed) {
        this.sound.playSplash();
      }
      if (stepRes.bounced) {
        this.sound.playSlimeBounce();
      }
      if (!isCreative && stepRes.fallDamage > 0) {
        this.damagePlayer(stepRes.fallDamage, 'fall');
      }

      // Nether Portal standing transition & cooldown
      if (this.portalCooldown > 0) {
        this.portalCooldown = Math.max(0, this.portalCooldown - dt);
      }
      const portalThreshold = isCreative ? 0.3 : 3.5;
      if (canControl && this.player.inPortal && this.portalCooldown <= 0) {
        this.portalStandTimer += dt;
        const pct = Math.min(1, this.portalStandTimer / portalThreshold);
        this.sound.updatePortalAmbient(0.5 + pct * 0.5);
        const bucket = Math.round(pct * 16);
        if (bucket !== this.lastPortalEmitBucket) {
          this.lastPortalEmitBucket = bucket;
          this.emitHUD();
        }
        if (this.portalStandTimer >= portalThreshold) {
          const targetDim: DimensionId =
            this.currentDimension === 'overworld' ? 'nether' : 'overworld';
          this.switchDimension(targetDim);
          return;
        }
      } else {
        this.sound.updatePortalAmbient(this.player.inPortal ? 0.35 : 0);
        if (this.portalStandTimer > 0) {
          this.portalStandTimer = Math.max(0, this.portalStandTimer - dt * 2.5);
          const bucket = Math.round((this.portalStandTimer / portalThreshold) * 16);
          if (bucket !== this.lastPortalEmitBucket) {
            this.lastPortalEmitBucket = bucket;
            this.emitHUD();
          }
        }
      }

      // Lava, Fire, Magma & Burn hazards (Survival only)
      if (!isCreative) {
        if (this.player.inLava) {
          this.lavaDamageTimer += dt;
          if (this.lavaDamageTimer >= 0.6) {
            this.lavaDamageTimer -= 0.6;
            this.damagePlayer(4, 'lava');
          }
          this.onFireTimer = 5.0;
        } else {
          this.lavaDamageTimer = 0;
        }

        if (this.player.inFire) {
          this.onFireTimer = Math.max(this.onFireTimer, 4.0);
        }

        if (this.player.onMagma && !this.player.crouching) {
          this.magmaDamageTimer += dt;
          if (this.magmaDamageTimer >= 1.0) {
            this.magmaDamageTimer -= 1.0;
            this.damagePlayer(1, 'magma');
          }
        } else {
          this.magmaDamageTimer = 0;
        }

        if (this.onFireTimer > 0) {
          if (this.player.inWater) {
            this.onFireTimer = 0;
            this.burnDamageTimer = 0;
            this.sound.playFireSizzle();
          } else {
            this.onFireTimer = Math.max(0, this.onFireTimer - dt);
            this.burnDamageTimer += dt;
            if (this.burnDamageTimer >= 1.0) {
              this.burnDamageTimer -= 1.0;
              this.damagePlayer(1, 'fire');
            }
          }
        } else {
          this.burnDamageTimer = 0;
        }
        if (this.player.touchingCactus) {
          this.cactusDamageTimer += dt;
          if (this.cactusDamageTimer >= 0.7) {
            this.cactusDamageTimer -= 0.7;
            this.damagePlayer(1, 'cactus');
          }
        } else {
          this.cactusDamageTimer = 0;
        }
      } else {
        this.onFireTimer = 0;
        this.lavaDamageTimer = 0;
        this.burnDamageTimer = 0;
        this.magmaDamageTimer = 0;
        this.cactusDamageTimer = 0;
      }

      const fireFlag = this.onFireTimer > 0;
      if (fireFlag !== this.lastOnFireFlag) {
        this.lastOnFireFlag = fireFlag;
        this.emitHUD();
      }

      // Occasional ambient lava bubbles in The Nether
      if (this.currentDimension === 'nether') {
        this.lavaBubbleTimer -= dt;
        if (this.lavaBubbleTimer <= 0) {
          this.lavaBubbleTimer = 3.2 + Math.random() * 3.8;
          if (this.player.y < 54) {
            this.sound.playLavaBubble();
          }
        }
      }

      // Oxygen / Drowning (Survival only)
      if (!isCreative && this.player.headInWater) {
        if (this.oxygen > 0) {
          this.oxygenDrainTimer += dt;
          if (this.oxygenDrainTimer >= 1.5) {
            this.oxygenDrainTimer -= 1.5;
            this.oxygen = Math.max(0, this.oxygen - 1);
            this.sound.playBubblePop();
            this.emitHUD();
          }
        } else {
          this.drownDamageTimer += dt;
          if (this.drownDamageTimer >= 1.0) {
            this.drownDamageTimer -= 1.0;
            this.sound.playBubblePop();
            this.damagePlayer(2, 'drown');
          }
        }
      } else {
        this.oxygenDrainTimer = 0;
        this.drownDamageTimer = 0;
        if (this.oxygen < this.maxOxygen) {
          this.oxygen = this.maxOxygen;
          this.emitHUD();
        }
      }

      // Footsteps synced to distance traveled
      if (this.player.onGround && !this.player.isFlying && stepRes.movedDist > 0.001) {
        this.footstepAccum += stepRes.movedDist;
        const stride = this.player.sprinting ? 1.85 : 2.15;
        if (this.footstepAccum >= stride) {
          this.footstepAccum = 0;
          const underId = this.world.getBlock(
            Math.floor(this.player.x),
            Math.floor(this.player.y - 0.1),
            Math.floor(this.player.z)
          );
          const mat =
            underId === BLOCK_IDS.STONE ||
            underId === BLOCK_IDS.COBBLESTONE ||
            underId === BLOCK_IDS.MOSSY_COBBLESTONE ||
            underId === BLOCK_IDS.SANDSTONE ||
            underId === BLOCK_IDS.BRICKS
              ? 'stone'
              : underId === BLOCK_IDS.SAND || underId === BLOCK_IDS.SNOW_BLOCK || underId === BLOCK_IDS.SNOW_GRASS
              ? 'sand'
              : underId === BLOCK_IDS.OAK_LOG || underId === BLOCK_IDS.OAK_PLANKS || underId === BLOCK_IDS.CHEST
              ? 'wood'
              : 'grass';
          this.sound.playFootstep(mat);
        }
      }

      // Hunger & Regen (Survival only; Peaceful auto-heals and never drains hunger)
      if (!isCreative) {
        if (this.difficulty === 'peaceful') {
          if (this.hunger < this.maxHunger) {
            this.hunger = this.maxHunger;
            this.emitHUD();
          }
          if (this.health < this.maxHealth) {
            this.regenTimer += dt;
            if (this.regenTimer >= 1.5) {
              this.regenTimer = 0;
              this.health = Math.min(this.maxHealth, this.health + 2);
              this.emitHUD();
            }
          }
        } else {
          this.hungerTickTimer += dt * (this.player.sprinting ? 2.4 : 0.45);
          if (this.hungerTickTimer >= 28) {
            this.hungerTickTimer = 0;
            if (this.hunger > 0) {
              this.hunger -= 1;
              this.emitHUD();
            }
          }
          if (this.hunger >= 18 && this.health < this.maxHealth) {
            this.regenTimer += dt;
            if (this.regenTimer >= 4.0) {
              this.regenTimer = 0;
              this.health = Math.min(this.maxHealth, this.health + 1);
              this.emitHUD();
            }
          } else {
            this.regenTimer = 0;
          }
        }
      }

      if (this.invulnTimer > 0) this.invulnTimer = Math.max(0, this.invulnTimer - dt);
      if (this.hurtFlash > 0) {
        this.hurtFlash = Math.max(0, this.hurtFlash - dt);
        if (this.hurtFlash === 0) this.emitHUD();
      }
      this.cameraTrauma = Math.max(0, this.cameraTrauma - dt * 2.4);

      const targetEye = this.player.crouching ? EYE_HEIGHT_CROUCHING : EYE_HEIGHT_STANDING;
      this.currentEyeHeight = THREE.MathUtils.damp(this.currentEyeHeight, targetEye, 14, dt);
      const targetFov = this.bowCharging
        ? 75 - Math.min(1, this.bowChargeTime) * 13
        : this.player.sprinting || this.player.isFlying
        ? 82
        : 75;
      if (Math.abs(this.currentFov - targetFov) > 0.05) {
        this.currentFov = THREE.MathUtils.damp(this.currentFov, targetFov, 10, dt);
        this.camera.fov = this.currentFov;
        this.camera.updateProjectionMatrix();
      }

      this.playerAvatar.update(
        dt,
        this.player.x,
        this.player.y,
        this.player.z,
        this.yaw,
        this.pitch,
        stepRes.movedDist,
        this.player.crouching
      );

      const eyeX = this.player.x;
      const eyeY = this.player.y + this.currentEyeHeight;
      const eyeZ = this.player.z;
      const shake = this.cameraTrauma * this.cameraTrauma * 0.06;

      if (this.thirdPerson) {
        const [dirX, dirY, dirZ] = this.getPlayerLookDirection();
        const maxCamDist = 3.5;
        const backHit = raycastVoxel(
          eyeX,
          eyeY,
          eyeZ,
          -dirX,
          -dirY,
          -dirZ,
          (x, y, z) => {
            const id = this.world.getBlock(x, y, z);
            return isBlockSolid(id) ? id : BLOCK_IDS.AIR;
          },
          maxCamDist
        );
        let camDist = maxCamDist;
        if (backHit) {
          const hitDist = Math.hypot(
            backHit.pos[0] + 0.5 - eyeX,
            backHit.pos[1] + 0.5 - eyeY,
            backHit.pos[2] + 0.5 - eyeZ
          );
          camDist = Math.max(0.7, hitDist - 0.65);
        }
        this.camera.position.set(
          eyeX - dirX * camDist,
          eyeY - dirY * camDist + 0.25,
          eyeZ - dirZ * camDist
        );
      } else {
        this.camera.position.set(eyeX, eyeY, eyeZ);
      }

      this.camera.rotation.set(
        this.pitch + (Math.random() - 0.5) * shake,
        this.yaw + (Math.random() - 0.5) * shake,
        (Math.random() - 0.5) * shake * 1.4
      );

      if (canControl) {
        this.handleInteractions(dt);
      }

      this.firstPersonHand.update(
        dt,
        stepRes.movedDist,
        this.leftMouseHeld || this.touchMineHeld,
        this.eatTimer / EAT_DURATION_SECONDS
      );

      const isNight = dayFactor < 0.36;
      this.entities.update(
        dt,
        this.player.x,
        this.player.y,
        this.player.z,
        isNight,
        this.difficulty,
        this.currentDimension,
        (x, y, z) => this.world.getBlock(x, y, z),
        (x, y, z) => this.world.getSkyLight(x, y, z),
        (x, y, z) => Math.max(this.world.getSkyLight(x, y, z) * dayFactor, this.world.getBlockLight(x, y, z)),
        (x, z) => this.world.getSurfaceHeightAt(x, z),
        (itemId, count) => {
          const leftover = addItemToInventory(this.inventory, itemId, count);
          if (leftover < count) {
            this.sound.playPickup();
            this.syncHeldHand();
            this.emitHUD();
            return true;
          }
          return false;
        },
        (dmg, source, dx, dz) => this.damagePlayer(dmg, source, dx, dz),
        () => this.sound.playBowShoot(),
        () => this.sound.playArrowHit(),
        (wx, wy, wz) => this.explodeAt(wx, wy, wz, 3.0),
        (secs) => {
          if (!isCreative) {
            this.onFireTimer = Math.max(this.onFireTimer, secs);
          }
        },
        () => this.sound.playGhastScream(),
        (wx, wy, wz) => this.explodeAt(wx, wy, wz, 3.5)
      );

      // Ambient rising smoke particles above nearby Campfires
      this.campfireSmokeTimer += dt;
      if (this.campfireSmokeTimer >= 0.45) {
        this.campfireSmokeTimer = 0;
        const px0 = Math.floor(this.player.x);
        const py0 = Math.floor(this.player.y);
        const pz0 = Math.floor(this.player.z);
        for (let dy = -3; dy <= 4; dy++) {
          for (let dz = -6; dz <= 6; dz++) {
            for (let dx = -6; dx <= 6; dx++) {
              if (this.world.getBlock(px0 + dx, py0 + dy, pz0 + dz) === BLOCK_IDS.CAMPFIRE) {
                this.entities.particles.emitBlockBurst(
                  px0 + dx,
                  py0 + dy + 0.55,
                  pz0 + dz,
                  '#94a3b8',
                  2
                );
              }
            }
          }
        }
      }

      // Periodic nearby structure discovery check (every 0.8s)
      this.structureScanTimer += dt;
      if (this.structureScanTimer >= 0.8) {
        this.structureScanTimer = 0;
        const nearby = this.world.getNearbyStructures(this.player.x, this.player.z, 6);
        for (const s of nearby) {
          const d = Math.hypot(this.player.x - s.centerX, this.player.z - s.centerZ);
          const centerChunkExplored = this.exploredChunks.has(
            chunkKey(worldToChunkCoord(s.centerX), worldToChunkCoord(s.centerZ))
          );
          if (
            (d <= s.radius + 20 || centerChunkExplored) &&
            !this.discoveredStructures.some((ds) => ds.id === s.id)
          ) {
            this.discoveredStructures.push({
              id: s.id,
              type: s.type,
              name: s.name,
              x: s.centerX,
              z: s.centerZ,
            });
            this.pushToast(`Has descubierto: ${s.name}`, 'info', 4000);
          }
        }
      }

      // Low-frequency HUD sync (0.2s)
      this.hudSyncTimer += dt;
      if (this.hudSyncTimer >= 0.2) {
        this.hudSyncTimer = 0;
        const cx = Math.floor(this.player.x);
        const cy = Math.floor(this.player.y);
        const cz = Math.floor(this.player.z);
        const coordsKey = `${cx},${cy},${cz},${this.player.headInWater ? 1 : 0},${this.player.inLava ? 1 : 0},${this.currentDimension}`;
        const targetName = this.currentHit ? (BLOCKS[this.currentHit.blockId]?.name ?? null) : null;
        const timeBucket = Math.floor(this.worldTime / 250);
        if (
          this.showDebug ||
          coordsKey !== this.lastCoordsKey ||
          targetName !== this.lastTargetName ||
          this.targetEntityHint !== this.lastTargetEntityHint ||
          timeBucket !== this.lastTimeBucket
        ) {
          this.lastCoordsKey = coordsKey;
          this.lastTargetName = targetName;
          this.lastTargetEntityHint = this.targetEntityHint;
          this.lastTimeBucket = timeBucket;
          this.emitHUD();
        }
      }
    }

    this.renderer.render(this.scene, this.camera);
    this.scheduleNextFrame();
  };

  private scheduleNextFrame(): void {
    if (!this.running) return;
    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (gl && typeof gl.fenceSync === 'function') {
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (!this.running) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          this.frameId = window.setTimeout(cb, 80);
        }
      };
      this.frameId = window.setTimeout(poll, 5);
    } else {
      this.frameId = window.setTimeout(cb, 90);
    }
  }

  private buildDebugInfo(cx: number, cy: number, cz: number): DebugInfo {
    const { cardinal, yawDeg } = getCardinalDirection(this.yaw);
    return {
      fps: Math.round(this.smoothedFps),
      chunksLoaded: this.world.chunks.size,
      chunksQueued: this.lastPendingChunks,
      entityCount: this.entities.getTotalEntityCount(),
      mobCount: this.entities.mobs.length,
      drawCalls: this.renderer.info.render.calls,
      exactPos: [
        Number(this.player.x.toFixed(2)),
        Number(this.player.y.toFixed(2)),
        Number(this.player.z.toFixed(2)),
      ],
      chunkCoords: [worldToChunkCoord(cx), worldToChunkCoord(cz)],
      cardinal,
      yawDeg,
      skyLight: this.world.getSkyLight(cx, cy + 1, cz),
      blockLight: this.world.getBlockLight(cx, cy + 1, cz),
    };
  }

  private emitHUD(): void {
    const cx = Math.floor(this.player.x);
    const cy = Math.floor(this.player.y);
    const cz = Math.floor(this.player.z);

    let activeFurnace: FurnaceTileEntity | null = null;
    let activeChest: ChestTileEntity | null = null;
    if (this.activeTileEntityKey === 'ender_chest') {
      activeChest = {
        type: 'chest',
        key: 'ender_chest',
        slots: this.enderChestSlots.map((s) => (s ? { ...s } : null)),
      };
    } else if (this.activeTileEntityKey) {
      const te: TileEntityData | undefined = this.world.tileEntities.get(this.activeTileEntityKey);
      if (te?.type === 'furnace') {
        activeFurnace = {
          ...te,
          input: te.input ? { ...te.input } : null,
          fuel: te.fuel ? { ...te.fuel } : null,
          output: te.output ? { ...te.output } : null,
        };
      } else if (te?.type === 'chest') {
        activeChest = {
          ...te,
          slots: te.slots.map((s) => (s ? { ...s } : null)),
        };
      }
    }

    const portalThreshold = this.gameMode === 'creative' ? 0.3 : 3.5;

    this.onHUDChange({
      phase: this.phase,
      modal: this.modal,
      pointerLocked: this.pointerLocked,
      worldId: this.worldId,
      worldName: this.worldName,
      dimension: this.currentDimension,
      gameMode: this.gameMode,
      difficulty: this.difficulty,
      worldType: this.worldType,
      isFlying: Boolean(this.player.isFlying),
      weather: this.weather.weather,
      sleepingAlpha: this.sleepingAlpha,
      portalProgress: Math.min(1, this.portalStandTimer / portalThreshold),
      inLava: Boolean(this.player.inLava),
      onFireTimer: this.onFireTimer,
      health: this.health,
      maxHealth: this.maxHealth,
      hunger: this.hunger,
      maxHunger: this.maxHunger,
      oxygen: this.oxygen,
      maxOxygen: this.maxOxygen,
      armorPoints: calculateTotalArmorPoints(this.armor),
      armor: this.armor.map((s) => (s ? { ...s } : null)) as ArmorSlots,
      selectedSlot: this.selectedSlot,
      inventory: this.inventory.map((s) => (s ? { ...s } : null)),
      activeFurnace,
      activeChest,
      activeTrade: this.activeTrade
        ? { ...this.activeTrade, offers: [...this.activeTrade.offers] }
        : null,
      worldTime: this.worldTime,
      dayCount: this.dayCount,
      biome: this.world.getBiomeAt(cx, cz),
      coords: [cx, cy, cz],
      initialSpawn: [...this.initialSpawn],
      bedSpawn: this.bedSpawn ? [...this.bedSpawn] : null,
      underwater: this.player.headInWater,
      hurtFlash: this.hurtFlash,
      eatingProgress: Math.min(1, this.eatTimer / EAT_DURATION_SECONDS),
      bowCharge: this.bowCharging ? Math.min(1, this.bowChargeTime) : 0,
      thirdPerson: this.thirdPerson,
      showDebug: this.showDebug,
      showMinimap: this.showMinimap,
      debugInfo: this.buildDebugInfo(cx, cy, cz),
      muted: this.sound.muted,
      renderDistance: this.renderDistance,
      settings: { ...this.settings },
      seed: this.seed,
      seedLabel: this.seedLabel,
      touchControlsMode: this.touchControlsMode,
      touchControlsActive: this.isTouchControlsActive(),
      touchCrouching: this.touchCrouch,
      hasSavedWorld: this.hasSavedWorld(),
      worldsList: [...this.worldsList],
      saveStatus: this.saveStatus,
      targetBlockName: this.currentHit ? (BLOCKS[this.currentHit.blockId]?.name ?? null) : null,
      targetEntityHint: this.targetEntityHint,
      waypoints: this.waypoints.map((w) => ({ ...w })),
      discoveredStructures: this.discoveredStructures.map((s) => ({ ...s })),
      toasts: this.toasts.map(({ id, text, tone }) => ({ id, text, tone })),
      exploredVersion: this.exploredVersion,
      stats: { ...this.stats },
    });
  }

  public dispose(): void {
    this.running = false;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    const win = window as unknown as { __VOXEL_ENGINE__?: VoxelEngine };
    if (win.__VOXEL_ENGINE__ === this) {
      delete win.__VOXEL_ENGINE__;
    }
    this.resizeObserver.disconnect();
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('contextmenu', this.onContextMenu);
    window.removeEventListener('blur', this.onWindowBlur);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLost);

    this.clearAllChunkMeshes();
    this.entities.dispose();
    this.weather.dispose();
    this.sound.dispose();
    this.playerAvatar.dispose();
    this.atlas.dispose();

    for (const cb of this.cloudBlocks) {
      cb.mesh.geometry.dispose();
    }
    this.cloudMaterial.dispose();
    this.sunMesh.geometry.dispose();
    (this.sunMesh.material as THREE.Material).dispose();
    this.moonMesh.geometry.dispose();
    (this.moonMesh.material as THREE.Material).dispose();

    this.opaqueMaterial.dispose();
    this.transparentMaterial.dispose();
    this.crossMaterial.dispose();
    this.itemAtlasMaterial.dispose();
    this.outlineMesh.geometry.dispose();
    (this.outlineMesh.material as THREE.Material).dispose();
    this.crackMesh.geometry.dispose();
    this.crackMaterial.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
