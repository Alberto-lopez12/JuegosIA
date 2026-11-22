import type {
  DimensionId,
  DimensionSaveSlice,
  GlobalSettings,
  SavedWorldData,
  WorldMeta,
} from './types';

function createEmptyDimensionSlice(): DimensionSaveSlice {
  return {
    blockEdits: [],
    tileEntities: [],
    exploredChunks: {},
    discoveredStructures: [],
    waypoints: [],
  };
}

function normalizeDimensionSlice(raw: unknown): DimensionSaveSlice {
  if (!raw || typeof raw !== 'object') return createEmptyDimensionSlice();
  const s = raw as Partial<DimensionSaveSlice>;
  return {
    blockEdits: Array.isArray(s.blockEdits) ? s.blockEdits : [],
    tileEntities: Array.isArray(s.tileEntities) ? s.tileEntities : [],
    exploredChunks: s.exploredChunks && typeof s.exploredChunks === 'object' ? s.exploredChunks : {},
    discoveredStructures: Array.isArray(s.discoveredStructures) ? s.discoveredStructures : [],
    waypoints: Array.isArray(s.waypoints) ? s.waypoints : [],
  };
}

export const SETTINGS_STORAGE_KEY = 'voxelcraft_settings_v2';
export const WORLDS_INDEX_KEY = 'voxelcraft_worlds_list';
export const WORLD_KEY_PREFIX = 'voxelcraft_world_';
export const LEGACY_SAVE_KEY = 'voxelcraft_save_v1';
const LEGACY_TOUCH_KEY = 'voxelcraft_touch_mode_v1';

export const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  sensitivity: 1.0,
  renderDistance: 5,
  volume: 80,
  touchControlsMode: 'auto',
  graphicsQuality: 'fancy',
};

function getStore(): Storage | null {
  try {
    if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis && globalThis.localStorage) {
      return globalThis.localStorage;
    }
  } catch {
    // ignore private browsing / node without localStorage
  }
  return null;
}

export function generateWorldId(): string {
  const rand = Math.floor(Math.random() * 0xfffff)
    .toString(36)
    .padStart(4, '0');
  return `w_${Date.now().toString(36)}_${rand}`;
}

export function loadGlobalSettings(): GlobalSettings {
  const store = getStore();
  if (!store) return { ...DEFAULT_GLOBAL_SETTINGS };
  try {
    const raw = store.getItem(SETTINGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<GlobalSettings>;
      return {
        sensitivity:
          typeof parsed.sensitivity === 'number'
            ? Math.max(0.3, Math.min(2.5, parsed.sensitivity))
            : DEFAULT_GLOBAL_SETTINGS.sensitivity,
        renderDistance:
          typeof parsed.renderDistance === 'number'
            ? Math.max(3, Math.min(7, Math.round(parsed.renderDistance)))
            : DEFAULT_GLOBAL_SETTINGS.renderDistance,
        volume:
          typeof parsed.volume === 'number'
            ? Math.max(0, Math.min(100, Math.round(parsed.volume)))
            : DEFAULT_GLOBAL_SETTINGS.volume,
        touchControlsMode:
          parsed.touchControlsMode === 'auto' ||
          parsed.touchControlsMode === 'on' ||
          parsed.touchControlsMode === 'off'
            ? parsed.touchControlsMode
            : DEFAULT_GLOBAL_SETTINGS.touchControlsMode,
        graphicsQuality:
          parsed.graphicsQuality === 'fast' || parsed.graphicsQuality === 'fancy'
            ? parsed.graphicsQuality
            : DEFAULT_GLOBAL_SETTINGS.graphicsQuality,
      };
    }
    // Migrate legacy touch mode if present
    const legacyTouch = store.getItem(LEGACY_TOUCH_KEY);
    if (legacyTouch === 'auto' || legacyTouch === 'on' || legacyTouch === 'off') {
      return { ...DEFAULT_GLOBAL_SETTINGS, touchControlsMode: legacyTouch };
    }
  } catch {
    // ignore corrupt settings
  }
  return { ...DEFAULT_GLOBAL_SETTINGS };
}

export function saveGlobalSettings(settings: GlobalSettings): void {
  const store = getStore();
  if (!store) return;
  try {
    store.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore storage quota errors
  }
}

export function validateSavedWorldJson(raw: string): {
  ok: boolean;
  data?: SavedWorldData;
  error?: string;
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'Archivo JSON inválido o corrupto.' };
  }
  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, error: 'Estructura raíz inválida.' };
  }
  const obj = parsed as Record<string, unknown>;
  if (typeof obj.seed !== 'number' || !Number.isFinite(obj.seed)) {
    return { ok: false, error: 'Falta la semilla numérica (seed).' };
  }
  const player = obj.player as Record<string, unknown> | undefined;
  if (
    !player ||
    typeof player.x !== 'number' ||
    typeof player.y !== 'number' ||
    typeof player.z !== 'number'
  ) {
    return { ok: false, error: 'Datos de posición del jugador incompletos.' };
  }
  if (!Array.isArray(obj.inventory)) {
    return { ok: false, error: 'Falta el arreglo de inventario.' };
  }
  if (obj.blockEdits !== undefined && !Array.isArray(obj.blockEdits)) {
    return { ok: false, error: 'blockEdits debe ser un arreglo.' };
  }

  // Normalize missing v2/v3/v4 fields cleanly for backward compatibility
  const rawOverworldEdits = Array.isArray(obj.blockEdits)
    ? (obj.blockEdits as Array<[number, number, number, number]>)
    : [];
  const overworldSlice: DimensionSaveSlice = obj.overworld
    ? normalizeDimensionSlice(obj.overworld)
    : {
        blockEdits: rawOverworldEdits,
        tileEntities: Array.isArray(obj.tileEntities)
          ? (obj.tileEntities as SavedWorldData['tileEntities'] & [])
          : [],
        exploredChunks:
          obj.exploredChunks && typeof obj.exploredChunks === 'object'
            ? (obj.exploredChunks as Record<string, string>)
            : {},
        discoveredStructures: Array.isArray(obj.discoveredStructures)
          ? (obj.discoveredStructures as DimensionSaveSlice['discoveredStructures'])
          : [],
        waypoints: Array.isArray(obj.waypoints)
          ? (obj.waypoints as DimensionSaveSlice['waypoints'])
          : [],
      };
  const netherSlice: DimensionSaveSlice = obj.nether
    ? normalizeDimensionSlice(obj.nether)
    : createEmptyDimensionSlice();
  const currentDimension: DimensionId = obj.currentDimension === 'nether' ? 'nether' : 'overworld';

  const normalized: SavedWorldData = {
    ...(obj as unknown as SavedWorldData),
    version: typeof obj.version === 'number' ? obj.version : 4,
    id: typeof obj.id === 'string' && obj.id.trim() ? obj.id : generateWorldId(),
    name: typeof obj.name === 'string' && obj.name.trim() ? obj.name : 'Mundo Importado',
    gameMode: obj.gameMode === 'creative' ? 'creative' : 'survival',
    difficulty:
      obj.difficulty === 'peaceful' ||
      obj.difficulty === 'easy' ||
      obj.difficulty === 'normal' ||
      obj.difficulty === 'hard'
        ? obj.difficulty
        : 'normal',
    worldType:
      obj.worldType === 'superflat' || obj.worldType === 'amplified'
        ? obj.worldType
        : 'default',
    currentDimension,
    overworld: overworldSlice,
    nether: netherSlice,
    enderChestSlots: Array.isArray(obj.enderChestSlots)
      ? (obj.enderChestSlots as SavedWorldData['enderChestSlots'])
      : undefined,
    lastPlayed: typeof obj.lastPlayed === 'number' ? obj.lastPlayed : Date.now(),
    worldTime: typeof obj.worldTime === 'number' ? obj.worldTime : 4800,
    dayCount: typeof obj.dayCount === 'number' ? obj.dayCount : 1,
    blockEdits: overworldSlice.blockEdits,
    stats: (obj.stats as SavedWorldData['stats']) ?? {
      blocksMined: 0,
      blocksPlaced: 0,
      mobsDefeated: 0,
      dayReached: typeof obj.dayCount === 'number' ? obj.dayCount : 1,
    },
  };

  return { ok: true, data: normalized };
}

export function toWorldMeta(data: SavedWorldData): WorldMeta {
  return {
    id: data.id,
    name: data.name,
    gameMode: data.gameMode,
    difficulty: data.difficulty,
    worldType: data.worldType,
    seed: data.seed,
    seedLabel: data.seedLabel ?? String(data.seed),
    bonusChest: Boolean(data.bonusChest),
    lastPlayed: data.lastPlayed || Date.now(),
    dayCount: data.dayCount || 1,
  };
}

export function migrateLegacySaveIfNeeded(): void {
  const store = getStore();
  if (!store) return;
  try {
    const existingList = store.getItem(WORLDS_INDEX_KEY);
    const legacyRaw = store.getItem(LEGACY_SAVE_KEY);
    if (!legacyRaw) return;
    if (existingList) {
      const arr = JSON.parse(existingList) as WorldMeta[];
      if (Array.isArray(arr) && arr.length > 0) return;
    }
    const check = validateSavedWorldJson(legacyRaw);
    if (!check.ok || !check.data) return;
    const migrated: SavedWorldData = {
      ...check.data,
      id: 'legacy_world_1',
      name: check.data.name === 'Mundo Importado' ? 'Mundo Guardado' : check.data.name,
      lastPlayed: Date.now(),
    };
    saveWorldData(migrated);
  } catch {
    // ignore migration errors
  }
}

export function listWorlds(): WorldMeta[] {
  const store = getStore();
  if (!store) return [];
  migrateLegacySaveIfNeeded();
  try {
    const raw = store.getItem(WORLDS_INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as WorldMeta[])
      .filter((w) => w && typeof w.id === 'string' && typeof w.name === 'string')
      .sort((a, b) => (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0));
  } catch {
    return [];
  }
}

export function loadWorldById(id: string): SavedWorldData | null {
  const store = getStore();
  if (!store) return null;
  try {
    const raw = store.getItem(WORLD_KEY_PREFIX + id);
    if (!raw) return null;
    const check = validateSavedWorldJson(raw);
    if (!check.ok || !check.data) return null;
    return check.data;
  } catch {
    return null;
  }
}

export function saveWorldData(data: SavedWorldData): boolean {
  const store = getStore();
  if (!store) return false;
  const payload: SavedWorldData = {
    ...data,
    version: 4,
    currentDimension: data.currentDimension === 'nether' ? 'nether' : 'overworld',
    overworld: data.overworld ? normalizeDimensionSlice(data.overworld) : createEmptyDimensionSlice(),
    nether: data.nether ? normalizeDimensionSlice(data.nether) : createEmptyDimensionSlice(),
    lastPlayed: Date.now(),
  };

  const writePayload = (d: SavedWorldData): boolean => {
    try {
      store.setItem(WORLD_KEY_PREFIX + d.id, JSON.stringify(d));
      return true;
    } catch {
      return false;
    }
  };

  let saved = writePayload(payload);
  // If localStorage quota exceeded, trim exploredChunks across slices gracefully and retry
  if (!saved) {
    const trimChunks = (rec?: Record<string, string>): Record<string, string> => {
      if (!rec) return {};
      const keys = Object.keys(rec);
      const trimmed: Record<string, string> = {};
      const keepCount = Math.floor(keys.length / 2);
      for (let i = keys.length - keepCount; i < keys.length; i++) {
        trimmed[keys[i]] = rec[keys[i]];
      }
      return trimmed;
    };
    const trimmedPayload: SavedWorldData = {
      ...payload,
      exploredChunks: trimChunks(payload.exploredChunks),
      overworld: payload.overworld
        ? { ...payload.overworld, exploredChunks: trimChunks(payload.overworld.exploredChunks) }
        : undefined,
      nether: payload.nether
        ? { ...payload.nether, exploredChunks: trimChunks(payload.nether.exploredChunks) }
        : undefined,
    };
    saved = writePayload(trimmedPayload);
    if (!saved) {
      saved = writePayload({
        ...payload,
        exploredChunks: {},
        overworld: payload.overworld ? { ...payload.overworld, exploredChunks: {} } : undefined,
        nether: payload.nether ? { ...payload.nether, exploredChunks: {} } : undefined,
      });
    }
  }
  if (!saved) return false;

  try {
    const existing = listWorlds().filter((w) => w.id !== payload.id);
    existing.unshift(toWorldMeta(payload));
    store.setItem(WORLDS_INDEX_KEY, JSON.stringify(existing));
    return true;
  } catch {
    return false;
  }
}

export function deleteWorldById(id: string): WorldMeta[] {
  const store = getStore();
  if (!store) return [];
  try {
    store.removeItem(WORLD_KEY_PREFIX + id);
    const next = listWorlds().filter((w) => w.id !== id);
    store.setItem(WORLDS_INDEX_KEY, JSON.stringify(next));
    return next;
  } catch {
    return listWorlds();
  }
}
