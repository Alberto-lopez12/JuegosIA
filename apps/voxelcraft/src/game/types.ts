export type GamePhase = 'title' | 'playing' | 'paused' | 'gameover';

export type ModalType =
  | 'none'
  | 'inventory'
  | 'crafting'
  | 'furnace'
  | 'chest'
  | 'creative'
  | 'map'
  | 'trade';

export type GameMode = 'survival' | 'creative';

export type Difficulty = 'peaceful' | 'easy' | 'normal' | 'hard';

export type WorldType = 'default' | 'superflat' | 'amplified';

export type GraphicsQuality = 'fast' | 'fancy';

export type WeatherType = 'clear' | 'storm';

export type TouchControlsMode = 'auto' | 'on' | 'off';

export type DimensionId = 'overworld' | 'nether';

export type BiomeType =
  | 'Plains'
  | 'Desert'
  | 'Mountains'
  | 'Snowy Taiga'
  | 'Jungle'
  | 'Swamp'
  | 'Savanna'
  | 'Badlands'
  | 'Nether Wastes'
  | 'Soul Sand Valley';

export type ToolCategory = 'none' | 'pickaxe' | 'axe' | 'shovel' | 'sword' | 'hoe' | 'shears' | 'bow';

export type ToolTier = 'none' | 'wood' | 'stone' | 'iron' | 'gold' | 'diamond' | 'netherite';

export type ArmorSlotType = 'helmet' | 'chestplate' | 'leggings' | 'boots';

export type CreativeCategory =
  | 'building'
  | 'colors'
  | 'nature'
  | 'functional'
  | 'tools'
  | 'misc';

export type VillagerProfession = 'farmer' | 'blacksmith' | 'librarian';

export type StructureType =
  | 'village'
  | 'desert_pyramid'
  | 'watchtower'
  | 'nether_fortress';

export type ArmorSlots = [SlotOrNull, SlotOrNull, SlotOrNull, SlotOrNull]; // [helmet, chestplate, leggings, boots]

export type ItemId =
  | number // Block IDs 1..183+
  | 'stick'
  | 'coal'
  | 'charcoal'
  | 'iron_ingot'
  | 'gold_ingot'
  | 'copper_ingot'
  | 'diamond'
  | 'emerald'
  | 'lapis_lazuli'
  | 'redstone_dust'
  | 'netherite_scrap'
  | 'netherite_ingot'
  | 'wheat'
  | 'bread'
  | 'cookie'
  | 'baked_potato'
  | 'golden_apple'
  | 'melon_slice'
  | 'raw_beef'
  | 'cooked_beef'
  | 'apple'
  | 'raw_porkchop'
  | 'cooked_porkchop'
  | 'rotten_flesh'
  | 'flint'
  | 'flint_and_steel'
  | 'nether_quartz'
  | 'glowstone_dust'
  | 'blaze_rod'
  | 'blaze_powder'
  | 'gold_nugget'
  | 'ghast_tear'
  | 'paper'
  | 'book'
  | 'string'
  | 'feather'
  | 'bone'
  | 'bone_meal'
  | 'gunpowder'
  | 'clay_ball'
  | 'brick'
  | 'leather'
  | 'red_dye'
  | 'yellow_dye'
  | 'blue_dye'
  | 'green_dye'
  | 'black_dye'
  | 'white_dye'
  | 'orange_dye'
  | 'purple_dye'
  | 'bow'
  | 'arrow'
  | 'shears'
  | 'bucket'
  | 'water_bucket'
  | 'lava_bucket'
  | 'compass'
  | 'clock'
  | 'wood_pickaxe'
  | 'stone_pickaxe'
  | 'iron_pickaxe'
  | 'gold_pickaxe'
  | 'diamond_pickaxe'
  | 'netherite_pickaxe'
  | 'wood_axe'
  | 'stone_axe'
  | 'iron_axe'
  | 'gold_axe'
  | 'diamond_axe'
  | 'netherite_axe'
  | 'wood_shovel'
  | 'stone_shovel'
  | 'iron_shovel'
  | 'gold_shovel'
  | 'diamond_shovel'
  | 'netherite_shovel'
  | 'wood_sword'
  | 'stone_sword'
  | 'iron_sword'
  | 'gold_sword'
  | 'diamond_sword'
  | 'netherite_sword'
  | 'wood_hoe'
  | 'stone_hoe'
  | 'iron_hoe'
  | 'diamond_hoe'
  | 'netherite_hoe'
  | 'leather_helmet'
  | 'leather_chestplate'
  | 'leather_leggings'
  | 'leather_boots'
  | 'iron_helmet'
  | 'iron_chestplate'
  | 'iron_leggings'
  | 'iron_boots'
  | 'diamond_helmet'
  | 'diamond_chestplate'
  | 'diamond_leggings'
  | 'diamond_boots'
  | 'netherite_helmet'
  | 'netherite_chestplate'
  | 'netherite_leggings'
  | 'netherite_boots';

export interface BlockUVs {
  top: [number, number];
  side: [number, number];
  bottom: [number, number];
  front?: [number, number];
}

export interface BlockDef {
  id: number;
  name: string;
  englishId?: string;
  solid: boolean;
  transparent: boolean;
  liquid: boolean;
  crossMesh?: boolean;
  isHalfHeight?: boolean;
  isStairs?: boolean;
  isDoor?: boolean;
  isDoorOpen?: boolean;
  isLadder?: boolean;
  isFence?: boolean;
  isWall?: boolean;
  isLantern?: boolean;
  isPath?: boolean;
  isPortal?: boolean;
  isLava?: boolean;
  isGravityBlock?: boolean;
  isSlippery?: boolean;
  isCactus?: boolean;
  isHayBale?: boolean;
  isStainedGlass?: boolean;
  isLeaves?: boolean;
  isSapling?: boolean;
  isTrapdoor?: boolean;
  isTrapdoorOpen?: boolean;
  isFenceGate?: boolean;
  isFenceGateOpen?: boolean;
  isIronBars?: boolean;
  isSlime?: boolean;
  isCampfire?: boolean;
  isEnchantingTable?: boolean;
  isAnvil?: boolean;
  isSoulTorch?: boolean;
  explosionResistant?: boolean;
  minPickaxeTier?: ToolTier;
  hardness: number; // seconds with hand (-1 = indestructible in survival)
  tool: ToolCategory;
  requiresTool: boolean;
  drop: ItemId | null;
  uvs: BlockUVs;
  lightLevel: number; // 0..15
  particleColor: string;
  mapColor: string;
  creativeCategory?: CreativeCategory;
  sortOrder?: number;
}

export interface ItemDef {
  id: ItemId;
  name: string;
  englishId: string;
  maxStack: number;
  isBlock: boolean;
  blockId?: number;
  toolCategory?: ToolCategory;
  toolTier?: ToolTier;
  maxDurability?: number;
  miningMultiplier?: number;
  attackDamage?: number;
  foodValue?: number;
  healAmount?: number; // instant HP restored on eat (e.g. Golden Apple)
  fuelTime?: number; // seconds
  armorSlot?: ArmorSlotType;
  armorPoints?: number;
  creativeCategory: CreativeCategory;
  sortOrder: number;
}

export interface InventorySlot {
  id: ItemId;
  count: number;
  durability?: number;
}

export type SlotOrNull = InventorySlot | null;

export interface FurnaceTileEntity {
  type: 'furnace';
  key: string; // "x,y,z"
  input: SlotOrNull;
  fuel: SlotOrNull;
  output: SlotOrNull;
  burnTime: number;
  burnDuration: number;
  cookProgress: number; // 0..5 seconds
}

export interface ChestTileEntity {
  type: 'chest';
  key: string; // "x,y,z"
  slots: SlotOrNull[]; // 27 slots
}

export type TileEntityData = FurnaceTileEntity | ChestTileEntity;

export interface RaycastHit {
  hit: boolean;
  pos: [number, number, number];
  normal: [number, number, number];
  blockId: number;
}

export interface RunStats {
  blocksMined: number;
  blocksPlaced: number;
  mobsDefeated: number;
  dayReached: number;
}

export interface GlobalSettings {
  sensitivity: number; // 0.3..2.5
  renderDistance: number; // 3..7
  volume: number; // 0..100
  touchControlsMode: TouchControlsMode;
  graphicsQuality: GraphicsQuality;
}

export interface WorldMeta {
  id: string;
  name: string;
  gameMode: GameMode;
  difficulty: Difficulty;
  worldType: WorldType;
  seed: number;
  seedLabel: string;
  bonusChest: boolean;
  lastPlayed: number;
  dayCount: number;
}

export interface CreateWorldConfig {
  name: string;
  gameMode: GameMode;
  difficulty: Difficulty;
  worldType: WorldType;
  seedText: string;
  bonusChest: boolean;
}

export interface Waypoint {
  id: string;
  name: string;
  x: number;
  z: number;
  color: string;
}

export interface DiscoveredStructure {
  id: string;
  type: StructureType;
  name: string;
  x: number;
  z: number;
}

export interface TradeOffer {
  id: string;
  costId: ItemId;
  costCount: number;
  rewardId: ItemId;
  rewardCount: number;
}

export interface ActiveVillagerTrade {
  villagerId: string;
  profession: VillagerProfession;
  title: string;
  offers: TradeOffer[];
}

export interface ToastMessage {
  id: number;
  text: string;
  tone?: 'info' | 'success' | 'warn';
}

export interface DebugInfo {
  fps: number;
  chunksLoaded: number;
  chunksQueued: number;
  entityCount: number;
  mobCount: number;
  drawCalls: number;
  exactPos: [number, number, number];
  chunkCoords: [number, number];
  cardinal: string;
  yawDeg: number;
  skyLight: number;
  blockLight: number;
}

export interface HUDState {
  phase: GamePhase;
  modal: ModalType;
  pointerLocked: boolean;
  worldId: string;
  worldName: string;
  dimension: DimensionId;
  gameMode: GameMode;
  difficulty: Difficulty;
  worldType: WorldType;
  isFlying: boolean;
  weather: WeatherType;
  sleepingAlpha: number; // 0..1 fade to black when sleeping
  portalProgress: number; // 0..1 swirling purple Nether portal transition
  inLava: boolean;
  onFireTimer: number; // seconds remaining burning
  bowCharge: number; // 0..1 bow draw tension
  health: number;
  maxHealth: number;
  hunger: number;
  maxHunger: number;
  oxygen: number; // 0..10 bubbles
  maxOxygen: number;
  armorPoints: number; // 0..20
  armor: ArmorSlots;
  selectedSlot: number;
  inventory: SlotOrNull[];
  activeFurnace: FurnaceTileEntity | null;
  activeChest: ChestTileEntity | null;
  activeTrade: ActiveVillagerTrade | null;
  worldTime: number;
  dayCount: number;
  biome: BiomeType;
  coords: [number, number, number];
  initialSpawn: [number, number, number];
  bedSpawn: [number, number, number] | null;
  underwater: boolean;
  hurtFlash: number;
  eatingProgress: number; // 0..1
  thirdPerson: boolean;
  showDebug: boolean;
  showMinimap: boolean;
  debugInfo: DebugInfo;
  muted: boolean;
  renderDistance: number;
  settings: GlobalSettings;
  seed: number;
  seedLabel: string;
  touchControlsMode: TouchControlsMode;
  touchControlsActive: boolean;
  touchCrouching: boolean;
  hasSavedWorld: boolean;
  worldsList: WorldMeta[];
  saveStatus: string;
  targetBlockName: string | null;
  targetEntityHint: string | null;
  waypoints: Waypoint[];
  discoveredStructures: DiscoveredStructure[];
  toasts: ToastMessage[];
  exploredVersion: number;
  stats: RunStats;
}

export interface DimensionSaveSlice {
  blockEdits: Array<[number, number, number, number]>;
  tileEntities: TileEntityData[];
  exploredChunks: Record<string, string>;
  discoveredStructures: DiscoveredStructure[];
  waypoints: Waypoint[];
}

export interface SavedWorldData {
  version: number;
  id: string;
  name: string;
  currentDimension?: DimensionId;
  gameMode: GameMode;
  difficulty: Difficulty;
  worldType: WorldType;
  bonusChest?: boolean;
  lastPlayed: number;
  seed: number;
  seedLabel?: string;
  worldTime: number;
  dayCount: number;
  weather?: WeatherType;
  initialSpawn?: [number, number, number];
  bedSpawn?: [number, number, number] | null;
  player: {
    x: number;
    y: number;
    z: number;
    yaw: number;
    pitch: number;
    health: number;
    hunger: number;
    oxygen?: number;
    selectedSlot: number;
    isFlying?: boolean;
  };
  inventory: SlotOrNull[];
  armor?: ArmorSlots;
  // Legacy / Overworld top-level fields kept for backward compatibility
  blockEdits: Array<[number, number, number, number]>;
  tileEntities?: TileEntityData[];
  furnaces?: FurnaceTileEntity[];
  waypoints?: Waypoint[];
  discoveredStructures?: DiscoveredStructure[];
  exploredChunks?: Record<string, string>;
  // Multi-dimension independent slices (v4+)
  overworld?: DimensionSaveSlice;
  nether?: DimensionSaveSlice;
  enderChestSlots?: SlotOrNull[];
  stats: RunStats;
}
