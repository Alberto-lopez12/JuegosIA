export type AnimatronicId = 'freddy' | 'bonnie' | 'chica' | 'nightmare' | 'blob';

export type NodeId =
  | 'CAM_1A' // Escenario Principal (Main Stage)
  | 'CAM_1B' // Área de Comedor (Dining Hall)
  | 'CAM_2A' // Pasillo Oeste Norte (West Hall North)
  | 'CAM_2B' // Esquina Pasillo Oeste (West Hall Corner)
  | 'CAM_3'  // Pasillo de Baños y Conexión (Restrooms Corridor)
  | 'CAM_4A' // Pasillo Este Norte (East Hall North)
  | 'CAM_4B' // Esquina Pasillo Este (East Hall Corner)
  | 'CAM_5'  // Sala de Mantenimiento (Parts & Service)
  | 'VENT_WEST'    // Conducto Sector Oeste
  | 'VENT_CENTRAL' // Conducto Central del Edificio
  | 'VENT_EAST'    // Conducto Sector Este
  | 'VENT_OFFICE'  // Conducto Superior de la Oficina
  | 'BATHROOM_HALL_RIGHT' // Ruta corta de Still Nightmare hacia Puerta Derecha (oculto en cámaras)
  | 'BATHROOM_HALL_LEFT_1' // Ruta larga paso 1 de Still Nightmare hacia Puerta Izquierda (oculto en cámaras)
  | 'BATHROOM_HALL_LEFT_2' // Ruta larga paso 2 de Still Nightmare hacia Puerta Izquierda (oculto en cámaras)
  | 'DOOR_LEFT'    // Umbral Ventana/Puerta Izquierda
  | 'DOOR_RIGHT'   // Umbral Ventana/Puerta Derecha
  | 'OFFICE_INSIDE'; // Dentro de la Oficina (Jumpscare)

export type NightmareBathroomStage = 1 | 2 | 3 | 4;

export interface CustomAILevels {
  freddy: number;
  bonnie: number;
  chica: number;
  nightmare?: number;
  blob: number;
}

export interface AnimatronicState {
  id: AnimatronicId;
  name: string;
  aiLevel: number;
  active: boolean;
  location: NodeId;
  homeLocation: NodeId;
  patienceTimer: number; // seconds waiting at closed vent before retreating (2-3s max)
  moveCooldown: number;
  lastMovedAt: number;
  bathroomStage?: NightmareBathroomStage; // 1: closed, 2: red eye, 3: hand & head peeking, 4: wide open with claw marks
}

export interface CampaignProgress {
  hasStartedNewGame: boolean; // True once the player clicks "Nueva Partida"
  currentCampaignNight: number; // 1 to 5 (main campaign nights)
  highestNightCompleted: number; // 0 to 8 (tracks beaten nights for unlocking dossiers & extra nights)
}

export const INITIAL_CAMPAIGN_PROGRESS: CampaignProgress = {
  hasStartedNewGame: false,
  currentCampaignNight: 1,
  highestNightCompleted: 0,
};

/**
 * Determines which animatronic dossiers are unlocked in Extras based on highestNightCompleted:
 * - Complete Night 1 -> unlocks Still Freddy ('freddy')
 * - Complete Night 2 -> unlocks Still Bonnie ('bonnie')
 * - Complete Night 3 -> unlocks Still Chica ('chica') & Still Nightmare ('nightmare')
 * - Complete Night 5 -> unlocks & reveals The Thing ('blob')
 */
export function getUnlockedDossiers(highestNightCompleted: number): Record<AnimatronicId, boolean> {
  return {
    freddy: highestNightCompleted >= 1,
    bonnie: highestNightCompleted >= 2,
    chica: highestNightCompleted >= 3,
    nightmare: highestNightCompleted >= 3,
    blob: highestNightCompleted >= 5,
  };
}

/**
 * The entire Extra Nights section (Night 6, Night 7, Custom Night) and The Thing's dossier
 * remain completely hidden/invisible until Night 5 (the main game) is completed.
 */
export function isExtraNightsSectionUnlocked(highestNightCompleted: number): boolean {
  return highestNightCompleted >= 5;
}

/**
 * Night 7 in Extras is locked until Night 6 is completed.
 */
export function isNight7Unlocked(highestNightCompleted: number): boolean {
  return highestNightCompleted >= 6;
}

/**
 * Night 8 (Custom Night) in Extras is locked until Night 7 is completed.
 */
export function isCustomNightUnlocked(highestNightCompleted: number): boolean {
  return highestNightCompleted >= 7;
}

export const DEMO_MAX_PLAYABLE_NIGHT = 2;
export const DEMO_THANKS_HOLD_SECONDS = 6.5;
export const DEMO_THANKS_TITLE = 'Muchas gracias por jugar la demo';
export const DEMO_GAMEJOLT_URL =
  'https://gamejolt.com/games/FiveNightsAtFreddysStillNights/1111520';
export const DEMO_FEEDBACK_TEXT = `Deja feedback en la pagina de gamejolt: ${DEMO_GAMEJOLT_URL}`;

export function isNightPlayableInDemo(nightNumber: number): boolean {
  return nightNumber === 1 || nightNumber === 2;
}

/**
 * Advances campaign state when a night is completed at 6:00 AM.
 * In the Demo version, progression is capped at Night 2 (only Nights 1 & 2 are playable).
 */
export function recordNightVictory(
  progress: CampaignProgress,
  completedNight: number
): CampaignProgress {
  const clampedCompleted = Math.min(DEMO_MAX_PLAYABLE_NIGHT, completedNight);
  const nextHighest = Math.min(
    DEMO_MAX_PLAYABLE_NIGHT,
    Math.max(progress.highestNightCompleted, clampedCompleted)
  );
  const nextCampaignNight =
    clampedCompleted >= 1 && clampedCompleted < DEMO_MAX_PLAYABLE_NIGHT
      ? Math.max(progress.currentCampaignNight, clampedCompleted + 1)
      : progress.currentCampaignNight;

  return {
    hasStartedNewGame: true,
    currentCampaignNight: Math.min(DEMO_MAX_PLAYABLE_NIGHT, nextCampaignNight),
    highestNightCompleted: nextHighest,
  };
}

/**
 * Duration in seconds that the 6:00 AM screen stays displayed before automatically transitioning.
 */
export const POST_6AM_HOLD_SECONDS = 4.0;

export type PostVictoryAction =
  | { type: 'next_night'; nextNightNumber: number }
  | { type: 'demo_complete' }
  | { type: 'main_menu' };

/**
 * Determines the automatic transition after holding 6:00 AM for 4 seconds in the Demo:
 * - Night 1 automatically advances to Night 2.
 * - Night 2 transitions to the Demo Completion thank-you screen before returning to the Main Menu.
 */
export function getPostVictoryAction(completedNight: number): PostVictoryAction {
  if (completedNight === 1) {
    return {
      type: 'next_night',
      nextNightNumber: 2,
    };
  }
  return { type: 'demo_complete' };
}

export type GameAudioEvent =
  | 'FOOTSTEPS'
  | 'NIGHTMARE_FOOTSTEPS'
  | 'VENT_CRAWL'
  | 'FREDDY_VENT_FAKEOUT'
  | 'VENT_RETREAT_FLICKER'
  | 'DOOR_KNOCK'
  | 'PHASE_SHIFT_3AM'
  | 'JUMPSCARE'
  | 'NIGHTMARE_JUMPSCARE';

/**
 * Delay in milliseconds between Freddy striking the ventilation duct (playing the vent footsteps sound)
 * and laughing with "Risa-Freddy" (~1 second later).
 */
export const FREDDY_VENT_LAUGH_DELAY_MS = 1000;

export interface NightConfig {
  nightNumber: number; // 1 to 8
  label: string;
  subtitle: string;
  isFnaf4SplitNight: boolean; // True on Night 6 and Night 7 (12AM-3AM Still Quartet, 3AM-6AM The Thing)
  has2AMNightmareActivation?: boolean; // True on Night 3 (Still Nightmare activates at 2:00 AM)
  has3AMPhaseChange?: boolean; // True on Night 2 (Chica wakes at 3AM) and Nights 6 & 7 (The Thing wakes at 3AM)
  initialAI: Required<CustomAILevels>;
  phase2AMAI?: Required<CustomAILevels>; // Used at 2 AM on Night 3
  phase2AI?: Required<CustomAILevels>; // Used at 3 AM on Night 2, Night 6, and Night 7
}

export const VENT_NODES: ReadonlySet<NodeId> = new Set<NodeId>([
  'VENT_WEST',
  'VENT_CENTRAL',
  'VENT_EAST',
  'VENT_OFFICE',
]);

export function isVentNode(node: NodeId): boolean {
  return VENT_NODES.has(node);
}

/**
 * Maximum time (in seconds) an animatronic waits at VENT_OFFICE while the vent is closed
 * before retreating and triggering the 1.5s office light flicker (2.5 seconds -> between 2 and 3 seconds).
 */
export const VENT_CLOSED_MAX_WAIT_SEC = 2.5;

export function getNightConfig(
  nightNumber: number,
  customAI: CustomAILevels = { freddy: 20, bonnie: 20, chica: 20, nightmare: 20, blob: 20 }
): NightConfig {
  const nightmareCustom = customAI.nightmare ?? 20;
  switch (nightNumber) {
    case 1:
      return {
        nightNumber: 1,
        label: 'NOCHE 1',
        subtitle: 'El Despertar de Still Freddy',
        isFnaf4SplitNight: false,
        has3AMPhaseChange: false,
        initialAI: { freddy: 6, bonnie: 0, chica: 0, nightmare: 0, blob: 0 },
      };
    case 2:
      // Fairer Night 2: Still Freddy & Still Bonnie active from 12:00 AM; Still Chica wakes up at 3:00 AM!
      return {
        nightNumber: 2,
        label: 'NOCHE 2',
        subtitle: 'Sala de Mantenimiento y Escenario',
        isFnaf4SplitNight: false,
        has3AMPhaseChange: true,
        initialAI: { freddy: 6, bonnie: 7, chica: 0, nightmare: 0, blob: 0 },
        phase2AI: { freddy: 6, bonnie: 7, chica: 6, nightmare: 0, blob: 0 },
      };
    case 3:
      // Night 3: Still Nightmare activates at 2:00 AM from the bathrooms (CAM_3)!
      return {
        nightNumber: 3,
        label: 'NOCHE 3',
        subtitle: 'Presión en los Pasillos',
        isFnaf4SplitNight: false,
        has2AMNightmareActivation: true,
        has3AMPhaseChange: false,
        initialAI: { freddy: 10, bonnie: 10, chica: 9, nightmare: 0, blob: 0 },
        phase2AMAI: { freddy: 10, bonnie: 10, chica: 9, nightmare: 10, blob: 0 },
      };
    case 4:
      return {
        nightNumber: 4,
        label: 'NOCHE 4',
        subtitle: 'Asedio Mecánico',
        isFnaf4SplitNight: false,
        has3AMPhaseChange: false,
        initialAI: { freddy: 13, bonnie: 13, chica: 12, nightmare: 13, blob: 0 },
      };
    case 5:
      return {
        nightNumber: 5,
        label: 'NOCHE 5',
        subtitle: 'La Llegada de The Thing',
        isFnaf4SplitNight: false,
        has3AMPhaseChange: false,
        initialAI: { freddy: 0, bonnie: 0, chica: 0, nightmare: 0, blob: 15 },
      };
    case 6:
      return {
        nightNumber: 6,
        label: 'NOCHE 6 (EXTRA)',
        subtitle: '12AM-3AM: Still Animatronics · 3AM-6AM: The Thing',
        isFnaf4SplitNight: true,
        has3AMPhaseChange: true,
        initialAI: { freddy: 12, bonnie: 12, chica: 12, nightmare: 12, blob: 0 },
        phase2AI: { freddy: 0, bonnie: 0, chica: 0, nightmare: 0, blob: 16 },
      };
    case 7:
      return {
        nightNumber: 7,
        label: 'NOCHE 7 (PESADILLA)',
        subtitle: 'Ciclo Partido Extremo · Dificultad Aumentada',
        isFnaf4SplitNight: true,
        has3AMPhaseChange: true,
        initialAI: { freddy: 16, bonnie: 16, chica: 16, nightmare: 16, blob: 0 },
        phase2AI: { freddy: 0, bonnie: 0, chica: 0, nightmare: 0, blob: 19 },
      };
    case 8:
    default: {
      const isMax =
        customAI.freddy === 20 &&
        customAI.bonnie === 20 &&
        customAI.chica === 20 &&
        nightmareCustom === 20 &&
        customAI.blob === 20;
      return {
        nightNumber: 8,
        label: isMax ? 'NOCHE 8 (20/20/20/20)' : 'NOCHE PERSONALIZADA',
        subtitle: isMax
          ? 'Modo 20/20/20/20 · Protocolo de Caos Total'
          : `IA: Freddy ${customAI.freddy} · Bonnie ${customAI.bonnie} · Chica ${customAI.chica} · Nightmare ${nightmareCustom} · The Thing ${customAI.blob}`,
        isFnaf4SplitNight: false,
        has3AMPhaseChange: false,
        initialAI: {
          freddy: customAI.freddy,
          bonnie: customAI.bonnie,
          chica: customAI.chica,
          nightmare: nightmareCustom,
          blob: customAI.blob,
        },
      };
    }
  }
}

export function getActiveAIForHour(
  config: NightConfig,
  hour: number
): Required<CustomAILevels> {
  if ((config.isFnaf4SplitNight || config.has3AMPhaseChange) && hour >= 3 && config.phase2AI) {
    return { ...config.phase2AI };
  }
  if (config.has2AMNightmareActivation && hour >= 2 && config.phase2AMAI) {
    return { ...config.phase2AMAI };
  }
  return { ...config.initialAI };
}

export function createInitialAnimatronics(
  config: NightConfig
): Record<AnimatronicId, AnimatronicState> {
  const ai = getActiveAIForHour(config, 0);
  return {
    freddy: {
      id: 'freddy',
      name: 'Still Freddy',
      aiLevel: ai.freddy,
      active: ai.freddy > 0,
      location: 'CAM_1A',
      homeLocation: 'CAM_1A',
      patienceTimer: 0,
      moveCooldown: 4.2,
      lastMovedAt: 0,
    },
    bonnie: {
      id: 'bonnie',
      name: 'Still Bonnie',
      aiLevel: ai.bonnie,
      active: ai.bonnie > 0,
      location: 'CAM_1A',
      homeLocation: 'CAM_1A',
      patienceTimer: 0,
      moveCooldown: 4.6,
      lastMovedAt: 0,
    },
    chica: {
      id: 'chica',
      name: 'Still Chica',
      aiLevel: ai.chica,
      active: ai.chica > 0,
      location: 'CAM_5',
      homeLocation: 'CAM_5',
      patienceTimer: 0,
      moveCooldown: 4.8,
      lastMovedAt: 0,
    },
    nightmare: {
      id: 'nightmare',
      name: 'Still Nightmare',
      aiLevel: ai.nightmare,
      active: ai.nightmare > 0,
      location: 'CAM_3',
      homeLocation: 'CAM_3',
      patienceTimer: 0,
      moveCooldown: 4.4,
      lastMovedAt: 0,
      bathroomStage: 1,
    },
    blob: {
      id: 'blob',
      name: 'The Thing',
      aiLevel: ai.blob,
      active: ai.blob > 0,
      location: 'CAM_5',
      homeLocation: 'CAM_5',
      patienceTimer: 0,
      moveCooldown: 3.3,
      lastMovedAt: 0,
    },
  };
}

/**
 * Activates Still Nightmare on Night 3 at 2:00 AM starting in the men's bathroom (CAM_3, stage 1).
 */
export function apply2AMNightmareActivation(
  animatronics: Record<AnimatronicId, AnimatronicState>,
  config: NightConfig
): {
  animatronics: Record<AnimatronicId, AnimatronicState>;
  events: GameAudioEvent[];
} {
  if (!config.has2AMNightmareActivation || !config.phase2AMAI) {
    return { animatronics, events: [] };
  }
  const next: Record<AnimatronicId, AnimatronicState> = {
    ...animatronics,
    nightmare: {
      ...animatronics.nightmare,
      aiLevel: config.phase2AMAI.nightmare,
      active: config.phase2AMAI.nightmare > 0,
      location: 'CAM_3',
      bathroomStage: animatronics.nightmare.bathroomStage ?? 1,
      patienceTimer: 0,
    },
  };
  // Still Nightmare makes no footsteps while inside the bathroom
  return {
    animatronics: next,
    events: [],
  };
}

export function apply3AMPhaseShift(
  animatronics: Record<AnimatronicId, AnimatronicState>,
  config: NightConfig
): {
  animatronics: Record<AnimatronicId, AnimatronicState>;
  events: GameAudioEvent[];
} {
  if (!config.phase2AI) {
    return { animatronics, events: [] };
  }

  // Case A: Night 2 — Freddy & Bonnie keep their positions, while Still Chica activates at 3:00 AM in CAM_5!
  if (!config.isFnaf4SplitNight && config.has3AMPhaseChange) {
    const next: Record<AnimatronicId, AnimatronicState> = {
      ...animatronics,
      freddy: {
        ...animatronics.freddy,
        aiLevel: config.phase2AI.freddy,
        active: config.phase2AI.freddy > 0,
      },
      bonnie: {
        ...animatronics.bonnie,
        aiLevel: config.phase2AI.bonnie,
        active: config.phase2AI.bonnie > 0,
      },
      chica: {
        ...animatronics.chica,
        aiLevel: config.phase2AI.chica,
        active: config.phase2AI.chica > 0,
        location: animatronics.chica.active ? animatronics.chica.location : 'CAM_5',
        patienceTimer: 0,
      },
    };
    return {
      animatronics: next,
      events: ['FOOTSTEPS'],
    };
  }

  // Case B: Nights 6 & 7 (FNAF 4 Split Night) — Still Quartet deactivates and The Thing awakens at 3:00 AM!
  const next: Record<AnimatronicId, AnimatronicState> = {
    freddy: {
      ...animatronics.freddy,
      aiLevel: config.phase2AI.freddy,
      active: config.phase2AI.freddy > 0,
      location: 'CAM_1A',
      patienceTimer: 0,
    },
    bonnie: {
      ...animatronics.bonnie,
      aiLevel: config.phase2AI.bonnie,
      active: config.phase2AI.bonnie > 0,
      location: 'CAM_1A',
      patienceTimer: 0,
    },
    chica: {
      ...animatronics.chica,
      aiLevel: config.phase2AI.chica,
      active: config.phase2AI.chica > 0,
      location: 'CAM_5',
      patienceTimer: 0,
    },
    nightmare: {
      ...animatronics.nightmare,
      aiLevel: config.phase2AI.nightmare,
      active: config.phase2AI.nightmare > 0,
      location: 'CAM_3',
      bathroomStage: 1,
      patienceTimer: 0,
    },
    blob: {
      ...animatronics.blob,
      aiLevel: config.phase2AI.blob,
      active: config.phase2AI.blob > 0,
      location: 'CAM_5',
      patienceTimer: 0,
    },
  };
  return {
    animatronics: next,
    events: ['PHASE_SHIFT_3AM', 'VENT_CRAWL'],
  };
}

export const MOVEMENT_GRAPH: Record<AnimatronicId, Partial<Record<NodeId, NodeId[]>>> = {
  freddy: {
    CAM_1A: ['CAM_1B'],
    CAM_1B: ['CAM_4A', 'VENT_CENTRAL', 'VENT_EAST'],
    CAM_4A: ['CAM_4B', 'VENT_EAST'],
    CAM_4B: ['DOOR_RIGHT'],
    VENT_CENTRAL: ['VENT_OFFICE', 'VENT_EAST'],
    VENT_EAST: ['VENT_OFFICE'],
    DOOR_RIGHT: ['OFFICE_INSIDE'],
    VENT_OFFICE: ['OFFICE_INSIDE'],
  },
  bonnie: {
    CAM_1A: ['CAM_1B', 'CAM_2A'],
    CAM_1B: ['CAM_2A', 'CAM_5'],
    CAM_5: ['CAM_1B', 'CAM_2A'],
    CAM_2A: ['CAM_2B', 'DOOR_LEFT'],
    CAM_2B: ['DOOR_LEFT'],
    DOOR_LEFT: ['OFFICE_INSIDE'],
  },
  chica: {
    CAM_5: ['CAM_1B'],
    CAM_1B: ['CAM_3', 'CAM_4A'],
    CAM_3: ['CAM_4A'],
    CAM_4A: ['CAM_4B', 'DOOR_RIGHT'],
    CAM_4B: ['DOOR_RIGHT'],
    DOOR_RIGHT: ['OFFICE_INSIDE'],
  },
  nightmare: {
    CAM_3: ['BATHROOM_HALL_RIGHT', 'BATHROOM_HALL_LEFT_1'],
    BATHROOM_HALL_RIGHT: ['DOOR_RIGHT'],
    BATHROOM_HALL_LEFT_1: ['BATHROOM_HALL_LEFT_2'],
    BATHROOM_HALL_LEFT_2: ['DOOR_LEFT'],
    DOOR_RIGHT: ['OFFICE_INSIDE'],
    DOOR_LEFT: ['OFFICE_INSIDE'],
  },
  blob: {
    CAM_5: ['CAM_1B', 'VENT_CENTRAL', 'VENT_WEST'],
    CAM_1B: ['CAM_2A', 'CAM_4A', 'VENT_CENTRAL'],
    CAM_2A: ['CAM_2B', 'VENT_WEST'],
    CAM_2B: ['DOOR_LEFT'],
    CAM_4A: ['CAM_4B', 'VENT_EAST'],
    CAM_4B: ['DOOR_RIGHT'],
    VENT_WEST: ['VENT_OFFICE', 'CAM_2B'],
    VENT_CENTRAL: ['VENT_OFFICE', 'VENT_WEST', 'VENT_EAST'],
    VENT_EAST: ['VENT_OFFICE', 'CAM_4B'],
    DOOR_LEFT: ['OFFICE_INSIDE'],
    DOOR_RIGHT: ['OFFICE_INSIDE'],
    VENT_OFFICE: ['OFFICE_INSIDE'],
  },
};

/**
 * Returns true if the given animatronic is visible on standard security camera feeds at its current node.
 * Still Nightmare is only visible via his bathroom door states in CAM_3 (never visible in hallway cameras
 * or vents; outside CAM_3 he can only be seen with the office door lights).
 */
export function isAnimatronicVisibleOnCamera(anim: AnimatronicState, cameraNode: NodeId): boolean {
  if (!anim.active) return false;
  if (anim.id === 'nightmare') {
    return false; // Rendered diegetically via the men's bathroom door states in CAM_3
  }
  return anim.location === cameraNode;
}

/**
 * Returns true when Still Freddy is in a room from which he can enter the ventilation network
 * (e.g. CAM_1B or CAM_4A).
 */
export function canFreddyEnterVentFrom(node: NodeId): boolean {
  if (isVentNode(node)) return false;
  const nextNodes = MOVEMENT_GRAPH.freddy[node] || [];
  return nextNodes.some((target) => isVentNode(target));
}

/**
 * Returns the probability (0.03 to 0.20) that Still Freddy hits the ventilation duct
 * (playing the vent footsteps sound and laughing 1s later with "Risa-Freddy")
 * when he is at a node where he can enter the ventilation:
 * - AI <= 0 -> 0%
 * - AI = 1 (low AI) -> 3% (0.03)
 * - AI = 20 (high AI) -> 20% (0.20)
 */
export function getFreddyVentFakeoutProbability(aiLevel: number): number {
  if (aiLevel <= 0) return 0;
  const clamped = Math.max(1, Math.min(20, aiLevel));
  return Number((0.03 + ((clamped - 1) / 19) * (0.20 - 0.03)).toFixed(4));
}

export interface OfficeDefenseState {
  leftDoorClosed: boolean;
  rightDoorClosed: boolean;
  ventClosed: boolean;
  leftLightOn: boolean;
  rightLightOn: boolean;
  cameraOpen: boolean;
}

export function calculatePowerDrain(defense: OfficeDefenseState): {
  usageBars: number;
  drainPerSecond: number;
} {
  let bars = 1;
  if (defense.leftDoorClosed) bars += 1;
  if (defense.rightDoorClosed) bars += 1;
  if (defense.ventClosed) bars += 1;
  if (defense.leftLightOn || defense.rightLightOn || defense.cameraOpen) bars += 1;

  const drainPerSecond = 0.14 + (bars - 1) * 0.21;
  return { usageBars: Math.min(5, bars), drainPerSecond };
}

/**
 * Evaluates a single movement opportunity for an animatronic (FNAF 1 style roll 1..20 <= aiLevel).
 * Handles door/vent blocking, sound emission (footsteps vs vent sound), Freddy's vent strike + laugh
 * fake-out (3% at low AI up to 20% at high AI when at a vent-entry room), the 1.5s office light flicker
 * when an animatronic retreats from the ventilation duct, and Still Nightmare's Foxy-style 4-stage
 * bathroom progression + dual route choice + reset to Stage 2 when blocked!
 */
export function stepAnimatronicMovement(
  anim: AnimatronicState,
  defense: OfficeDefenseState,
  roll1To20: number,
  choiceRoll0To1: number,
  freddyFakeoutRoll0To1 = 1
): {
  nextState: AnimatronicState;
  audioEvents: GameAudioEvent[];
  triggerOfficeFlickerMs: number;
  triggeredJumpscareBy: AnimatronicId | null;
} {
  if (!anim.active || anim.aiLevel <= 0) {
    return {
      nextState: anim,
      audioEvents: [],
      triggerOfficeFlickerMs: 0,
      triggeredJumpscareBy: null,
    };
  }

  // Dedicated Still Nightmare Foxy-style bathroom progression & hallway sprint mechanic
  if (anim.id === 'nightmare') {
    if (roll1To20 > anim.aiLevel) {
      return {
        nextState: anim,
        audioEvents: [],
        triggerOfficeFlickerMs: 0,
        triggeredJumpscareBy: null,
      };
    }

    const stage = anim.bathroomStage ?? 1;

    // While inside the bathroom in stages 1 or 2, advance silently to the next bathroom stage (no footsteps!)
    if (anim.location === 'CAM_3' && stage === 1) {
      return {
        nextState: {
          ...anim,
          bathroomStage: 2,
          patienceTimer: 0,
        },
        audioEvents: [],
        triggerOfficeFlickerMs: 0,
        triggeredJumpscareBy: null,
      };
    }

    if (anim.location === 'CAM_3' && stage === 2) {
      return {
        nextState: {
          ...anim,
          bathroomStage: 3,
          patienceTimer: 0,
        },
        audioEvents: [],
        triggerOfficeFlickerMs: 0,
        triggeredJumpscareBy: null,
      };
    }

    // Leaving the bathroom (Stage 3 -> Stage 4: door wide open with claw marks):
    // Chooses between Option 1 (Right side of office, closer/faster: BATHROOM_HALL_RIGHT -> DOOR_RIGHT)
    // and Option 2 (Left side of office, takes slightly longer: BATHROOM_HALL_LEFT_1 -> BATHROOM_HALL_LEFT_2 -> DOOR_LEFT).
    // Emits NIGHTMARE_FOOTSTEPS as he walks through the building!
    if (anim.location === 'CAM_3' && stage >= 3) {
      const goRightCloser = choiceRoll0To1 < 0.5;
      return {
        nextState: {
          ...anim,
          bathroomStage: 4,
          location: goRightCloser ? 'BATHROOM_HALL_RIGHT' : 'BATHROOM_HALL_LEFT_1',
          patienceTimer: 0,
        },
        audioEvents: ['NIGHTMARE_FOOTSTEPS'],
        triggerOfficeFlickerMs: 0,
        triggeredJumpscareBy: null,
      };
    }

    if (anim.location === 'BATHROOM_HALL_RIGHT') {
      return {
        nextState: {
          ...anim,
          bathroomStage: 4,
          location: 'DOOR_RIGHT',
          patienceTimer: 0,
        },
        audioEvents: ['NIGHTMARE_FOOTSTEPS'],
        triggerOfficeFlickerMs: 0,
        triggeredJumpscareBy: null,
      };
    }

    if (anim.location === 'BATHROOM_HALL_LEFT_1') {
      return {
        nextState: {
          ...anim,
          bathroomStage: 4,
          location: 'BATHROOM_HALL_LEFT_2',
          patienceTimer: 0,
        },
        audioEvents: ['NIGHTMARE_FOOTSTEPS'],
        triggerOfficeFlickerMs: 0,
        triggeredJumpscareBy: null,
      };
    }

    if (anim.location === 'BATHROOM_HALL_LEFT_2') {
      return {
        nextState: {
          ...anim,
          bathroomStage: 4,
          location: 'DOOR_LEFT',
          patienceTimer: 0,
        },
        audioEvents: ['NIGHTMARE_FOOTSTEPS'],
        triggerOfficeFlickerMs: 0,
        triggeredJumpscareBy: null,
      };
    }

    if (anim.location === 'DOOR_RIGHT') {
      if (defense.rightDoorClosed) {
        // Blocked! Resets back to the bathroom at Stage 2 ("volverá al baño en el segundo estado")
        return {
          nextState: {
            ...anim,
            location: 'CAM_3',
            bathroomStage: 2,
            patienceTimer: 0,
          },
          audioEvents: ['DOOR_KNOCK', 'NIGHTMARE_FOOTSTEPS'],
          triggerOfficeFlickerMs: 0,
          triggeredJumpscareBy: null,
        };
      }
      return {
        nextState: {
          ...anim,
          location: 'OFFICE_INSIDE',
        },
        audioEvents: ['NIGHTMARE_JUMPSCARE'],
        triggerOfficeFlickerMs: 0,
        triggeredJumpscareBy: 'nightmare',
      };
    }

    if (anim.location === 'DOOR_LEFT') {
      if (defense.leftDoorClosed) {
        // Blocked! Resets back to the bathroom at Stage 2 ("volverá al baño en el segundo estado")
        return {
          nextState: {
            ...anim,
            location: 'CAM_3',
            bathroomStage: 2,
            patienceTimer: 0,
          },
          audioEvents: ['DOOR_KNOCK', 'NIGHTMARE_FOOTSTEPS'],
          triggerOfficeFlickerMs: 0,
          triggeredJumpscareBy: null,
        };
      }
      return {
        nextState: {
          ...anim,
          location: 'OFFICE_INSIDE',
        },
        audioEvents: ['NIGHTMARE_JUMPSCARE'],
        triggerOfficeFlickerMs: 0,
        triggeredJumpscareBy: 'nightmare',
      };
    }
  }

  // Additional Still Freddy mechanic: when Freddy is at a room where he can enter the ventilation
  // (CAM_1B or CAM_4A), he has a 3% (low AI) to 20% (high AI) chance to strike the ventilation duct
  // (producing the vent footsteps sound) and laugh 1 second later ("Risa-Freddy")!
  if (
    anim.id === 'freddy' &&
    canFreddyEnterVentFrom(anim.location) &&
    freddyFakeoutRoll0To1 < getFreddyVentFakeoutProbability(anim.aiLevel)
  ) {
    return {
      nextState: {
        ...anim,
        patienceTimer: 0,
      },
      audioEvents: ['FREDDY_VENT_FAKEOUT'],
      triggerOfficeFlickerMs: 0,
      triggeredJumpscareBy: null,
    };
  }

  // If the animatronic is at VENT_OFFICE and the vent is closed, always allow immediate retreat regardless of AI roll!
  const isBlockedAtClosedVent = anim.location === 'VENT_OFFICE' && defense.ventClosed;

  if (!isBlockedAtClosedVent && roll1To20 > anim.aiLevel) {
    return {
      nextState: anim,
      audioEvents: [],
      triggerOfficeFlickerMs: 0,
      triggeredJumpscareBy: null,
    };
  }

  const currentLoc = anim.location;

  if (currentLoc === 'DOOR_LEFT') {
    if (defense.leftDoorClosed) {
      const retreatOptions: NodeId[] = anim.id === 'blob' ? ['CAM_2A', 'VENT_WEST'] : ['CAM_1B', 'CAM_2A'];
      const retreatLoc = retreatOptions[Math.floor(choiceRoll0To1 * retreatOptions.length)] || 'CAM_1B';
      const enteredVent = isVentNode(retreatLoc);
      return {
        nextState: {
          ...anim,
          location: retreatLoc,
          patienceTimer: 0,
        },
        audioEvents: ['DOOR_KNOCK', enteredVent ? 'VENT_CRAWL' : 'FOOTSTEPS'],
        triggerOfficeFlickerMs: 0,
        triggeredJumpscareBy: null,
      };
    } else {
      return {
        nextState: { ...anim, location: 'OFFICE_INSIDE' },
        audioEvents: ['JUMPSCARE'],
        triggerOfficeFlickerMs: 0,
        triggeredJumpscareBy: anim.id,
      };
    }
  }

  if (currentLoc === 'DOOR_RIGHT') {
    if (defense.rightDoorClosed) {
      const retreatOptions: NodeId[] =
        anim.id === 'freddy'
          ? ['CAM_1B', 'VENT_EAST']
          : anim.id === 'blob'
          ? ['CAM_4A', 'VENT_EAST']
          : ['CAM_1B', 'CAM_3'];
      const retreatLoc = retreatOptions[Math.floor(choiceRoll0To1 * retreatOptions.length)] || 'CAM_1B';
      const enteredVent = isVentNode(retreatLoc);
      return {
        nextState: {
          ...anim,
          location: retreatLoc,
          patienceTimer: 0,
        },
        audioEvents: ['DOOR_KNOCK', enteredVent ? 'VENT_CRAWL' : 'FOOTSTEPS'],
        triggerOfficeFlickerMs: 0,
        triggeredJumpscareBy: null,
      };
    } else {
      return {
        nextState: { ...anim, location: 'OFFICE_INSIDE' },
        audioEvents: ['JUMPSCARE'],
        triggerOfficeFlickerMs: 0,
        triggeredJumpscareBy: anim.id,
      };
    }
  }

  if (currentLoc === 'VENT_OFFICE') {
    if (defense.ventClosed) {
      // Blocked by Top-Center Office Vent! Retreats after 2-3s max and triggers 1.5s office light flicker
      const retreatOptions: NodeId[] =
        anim.id === 'freddy' ? ['CAM_1B', 'CAM_4A'] : ['CAM_5', 'CAM_1B'];
      const retreatLoc = retreatOptions[Math.floor(choiceRoll0To1 * retreatOptions.length)] || 'CAM_1B';
      return {
        nextState: {
          ...anim,
          location: retreatLoc,
          patienceTimer: 0,
        },
        audioEvents: ['VENT_RETREAT_FLICKER', 'FOOTSTEPS'],
        triggerOfficeFlickerMs: 1500,
        triggeredJumpscareBy: null,
      };
    } else {
      return {
        nextState: { ...anim, location: 'OFFICE_INSIDE' },
        audioEvents: ['JUMPSCARE'],
        triggerOfficeFlickerMs: 0,
        triggeredJumpscareBy: anim.id,
      };
    }
  }

  const transitions = MOVEMENT_GRAPH[anim.id][currentLoc] || [];
  if (transitions.length === 0) {
    return {
      nextState: anim,
      audioEvents: [],
      triggerOfficeFlickerMs: 0,
      triggeredJumpscareBy: null,
    };
  }

  const nextLoc = transitions[Math.min(transitions.length - 1, Math.floor(choiceRoll0To1 * transitions.length))];
  const wasInVent = isVentNode(currentLoc);
  const nowInVent = isVentNode(nextLoc);

  const audioEvents: GameAudioEvent[] = [];
  if (nowInVent) {
    audioEvents.push('VENT_CRAWL');
  } else {
    audioEvents.push('FOOTSTEPS');
  }

  const leftVentSystem = wasInVent && !nowInVent && nextLoc !== 'OFFICE_INSIDE';
  if (leftVentSystem) {
    audioEvents.push('VENT_RETREAT_FLICKER');
  }

  return {
    nextState: {
      ...anim,
      location: nextLoc,
      patienceTimer: 0,
    },
    audioEvents,
    triggerOfficeFlickerMs: leftVentSystem ? 1500 : 0,
    triggeredJumpscareBy: null,
  };
}

// ============================================================================
// STORY MODE: 8-BIT INTRO MINIGAME & NIGHT 1 OFFICE PHONE NARRATIVE
// ============================================================================

export type IntroMinigamePhase =
  | 'DRIVING_DIALOGUE'
  | 'DRIVING_FADE_OUT'
  | 'OUTSIDE_FADE_IN'
  | 'OUTSIDE_EXIT_DIALOGUE'
  | 'OUTSIDE_WALK'
  | 'OUTSIDE_DOOR_DIALOGUE'
  | 'ENTERING_BUILDING_FADE_OUT'
  | 'COMPLETED';

export interface IntroDialogueLine {
  speaker: string;
  speakerColor: string;
  text: string;
}

export const INTRO_DRIVING_DIALOGUES: readonly IntroDialogueLine[] = [
  {
    speaker: 'PROTAGONISTA',
    speakerColor: '#fde047',
    text: 'Seguro que es allí a donde tengo que ir',
  },
  {
    speaker: 'INTERLOCUTOR',
    speakerColor: '#7dd3fc',
    text: 'Sí, allí es, pero recuerda llegar un rato antes de empezar tu turno, te tienen que explicar todo bien',
  },
];

export const INTRO_OUTSIDE_CAR_DIALOGUE: IntroDialogueLine = {
  speaker: 'PROTAGONISTA',
  speakerColor: '#fde047',
  text: 'Es la primera vez que me toca hacer un trabajo a estas horas, estoy muy lejos de casa, pero en principio, hay un hotel cerca de aquí',
};

export const INTRO_OUTSIDE_DOOR_DIALOGUE: IntroDialogueLine = {
  speaker: 'PROTAGONISTA',
  speakerColor: '#fde047',
  text: 'Este sitio... está hecho una porquería, ¿De verdad que aquí se paga lo que anunciaron?',
};

export const INTRO_OUTSIDE_SPAWN_X = 210;
export const INTRO_OUTSIDE_MIN_X = 120;
export const INTRO_DOOR_STOP_X = 635;
export const INTRO_DOOR_ENTER_X = 708;
export const INTRO_WALK_SPEED_PX_PER_SEC = 155;

export function stepIntroWalkPosition(
  currentX: number,
  direction: -1 | 0 | 1,
  dtSec: number
): { x: number; reachedDoorStop: boolean } {
  const nextRaw = currentX + direction * INTRO_WALK_SPEED_PX_PER_SEC * dtSec;
  const clamped = Math.max(INTRO_OUTSIDE_MIN_X, Math.min(INTRO_DOOR_STOP_X, nextRaw));
  return {
    x: clamped,
    reachedDoorStop: clamped >= INTRO_DOOR_STOP_X,
  };
}

export interface DialogueSegment {
  text: string;
  slowTremble?: boolean;
}

export interface OfficeNarrativeTab {
  speaker: string;
  speakerColor: string;
  segments: DialogueSegment[];
}

export const NIGHT_1_OFFICE_MONOLOGUE_TABS: readonly OfficeNarrativeTab[] = [
  {
    speaker: 'PROTAGONISTA',
    speakerColor: '#fde047',
    segments: [
      {
        text: '¿Cómo es posible que yo tenga que trabajar vigilando esto? No, no hay nada de valor aquí, y ¿se supone que la gente viene aquí a celebrar fiestas?',
      },
    ],
  },
  {
    speaker: 'PROTAGONISTA',
    speakerColor: '#fde047',
    segments: [
      {
        text: '... En fin, qué remedio, me dijeron que me llamarían a las 12 A.M',
      },
    ],
  },
];

export const PHONE_RING_TOTAL_LOOPS = 3;
export const PHONE_RING_GAP_MS = 1000;

export const NIGHT_1_PHONE_CALL_TABS: readonly OfficeNarrativeTab[] = [
  {
    speaker: '???',
    speakerColor: '#f87171',
    segments: [
      {
        text: 'Ah, ah, has venido, no esperaba que al final fueses a hacerlo',
      },
    ],
  },
  {
    speaker: '???',
    speakerColor: '#f87171',
    segments: [
      {
        text: 'No me convenció mucho cuando llamaste a nuestro anuncio, pero has venido, mira, te explico este trabajo rápido',
      },
    ],
  },
  {
    speaker: '???',
    speakerColor: '#f87171',
    segments: [
      {
        text: 'Este local es de mi familia, y ya sé que no está en las mejores condiciones, pero no me negarás que es un chollazo',
      },
    ],
  },
  {
    speaker: '???',
    speakerColor: '#f87171',
    segments: [
      {
        text: 'Tu trabajo solo es vigilar que nadie se cuele en el local hasta las 6 A.M, después podrás irte a casa, no te preocupes, llegaran en un rato los del turno de día',
      },
    ],
  },
  {
    speaker: '???',
    speakerColor: '#f87171',
    segments: [
      {
        text: 'Si te ha quedado todo claro, espero que pases buena noche, yo tengo ',
      },
      {
        text: '"ASUNTOS PENDIENTES"',
        slowTremble: true,
      },
    ],
  },
  {
    speaker: '???',
    speakerColor: '#f87171',
    segments: [
      {
        text: '¡Ejem, ejem, lo dicho, pásalo bien!',
      },
    ],
  },
];

export type Night1OfficeNarrativePhase =
  | 'OFFICE_MONOLOGUE'
  | 'PHONE_RINGING'
  | 'PHONE_CALL_DIALOGUE'
  | 'COMPLETED';

export interface Night1OfficeNarrativeState {
  phase: Night1OfficeNarrativePhase;
  tabIndex: number;
  ringCount: number; // 1..3 during PHONE_RINGING
}

export const INITIAL_NIGHT_1_OFFICE_NARRATIVE_STATE: Night1OfficeNarrativeState = {
  phase: 'OFFICE_MONOLOGUE',
  tabIndex: 0,
  ringCount: 0,
};

/**
 * Advances the Night 1 Office Narrative when the player presses Enter on a dialogue tab,
 * or when the 3-loop phone ring sequence finishes.
 */
export function advanceNight1OfficeNarrative(
  state: Night1OfficeNarrativeState,
  event: 'PRESS_ENTER' | 'PHONE_RINGS_DONE'
): Night1OfficeNarrativeState {
  if (state.phase === 'OFFICE_MONOLOGUE' && event === 'PRESS_ENTER') {
    if (state.tabIndex + 1 < NIGHT_1_OFFICE_MONOLOGUE_TABS.length) {
      return {
        ...state,
        tabIndex: state.tabIndex + 1,
      };
    }
    return {
      phase: 'PHONE_RINGING',
      tabIndex: 0,
      ringCount: 1,
    };
  }

  if (state.phase === 'PHONE_RINGING' && event === 'PHONE_RINGS_DONE') {
    return {
      phase: 'PHONE_CALL_DIALOGUE',
      tabIndex: 0,
      ringCount: PHONE_RING_TOTAL_LOOPS,
    };
  }

  if (state.phase === 'PHONE_CALL_DIALOGUE' && event === 'PRESS_ENTER') {
    if (state.tabIndex + 1 < NIGHT_1_PHONE_CALL_TABS.length) {
      return {
        ...state,
        tabIndex: state.tabIndex + 1,
      };
    }
    return {
      phase: 'COMPLETED',
      tabIndex: 0,
      ringCount: PHONE_RING_TOTAL_LOOPS,
    };
  }

  return state;
}

/**
 * Returns true when the Night 1 office clock, power drain, and animatronic AI must remain frozen
 * ("hasta que no acaben los dialogos el tiempo y la energia del juego no deben bajar nada").
 */
export function isGameplayFrozenByNarrative(
  nightTransitionActive: boolean,
  officeNarrativeActive: boolean
): boolean {
  return nightTransitionActive || officeNarrativeActive;
}

