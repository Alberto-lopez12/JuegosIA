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
  badEnding1Unlocked?: boolean; // True once the player gets the Still Nothing Bad Ending in Post-Night 5 Ending 1
  badEnding2Unlocked?: boolean; // True once the player gets the Still Nothing Bad Ending in Post-Night 4 (No Documents route)
  ending1Unlocked?: boolean; // True once the player completes the Post-Night 5 Good Ending (Bank donation)
  ending2Unlocked?: boolean; // True once the player completes the Post-Night 5 No-Documents Ending (Sacrifice for sister)
  answeredNight3HotelCall?: boolean; // Persists whether the player answered the Room 303 phone call in Post-Night 3
  collectedNight4Papers?: boolean; // Persists whether the player collected the secret closet documents in Night 4
}

export const INITIAL_CAMPAIGN_PROGRESS: CampaignProgress = {
  hasStartedNewGame: false,
  currentCampaignNight: 1,
  highestNightCompleted: 0,
  badEnding1Unlocked: false,
  badEnding2Unlocked: false,
  ending1Unlocked: false,
  ending2Unlocked: false,
  answeredNight3HotelCall: true,
  collectedNight4Papers: false,
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

/**
 * Advances campaign state when a night is completed at 6:00 AM.
 */
export function recordNightVictory(
  progress: CampaignProgress,
  completedNight: number
): CampaignProgress {
  const nextHighest = Math.max(progress.highestNightCompleted, completedNight);
  const nextCampaignNight =
    completedNight >= 1 && completedNight < 5
      ? Math.max(progress.currentCampaignNight, completedNight + 1)
      : progress.currentCampaignNight;

  return {
    hasStartedNewGame: true,
    currentCampaignNight: Math.min(5, nextCampaignNight),
    highestNightCompleted: nextHighest,
    badEnding1Unlocked: progress.badEnding1Unlocked ?? false,
    badEnding2Unlocked: progress.badEnding2Unlocked ?? false,
    ending1Unlocked: progress.ending1Unlocked ?? false,
    ending2Unlocked: progress.ending2Unlocked ?? false,
    answeredNight3HotelCall: progress.answeredNight3HotelCall ?? true,
    collectedNight4Papers: progress.collectedNight4Papers ?? false,
  };
}

export function unlockBadEnding1Star(progress: CampaignProgress): CampaignProgress {
  if (progress.badEnding1Unlocked) {
    return progress;
  }
  return {
    ...progress,
    badEnding1Unlocked: true,
  };
}

export function unlockBadEnding2Star(progress: CampaignProgress): CampaignProgress {
  if (progress.badEnding2Unlocked) {
    return progress;
  }
  return {
    ...progress,
    badEnding2Unlocked: true,
  };
}

export function unlockEnding1Star(progress: CampaignProgress): CampaignProgress {
  if (progress.ending1Unlocked) {
    return progress;
  }
  return {
    ...progress,
    ending1Unlocked: true,
  };
}

export function unlockEnding2Star(progress: CampaignProgress): CampaignProgress {
  if (progress.ending2Unlocked) {
    return progress;
  }
  return {
    ...progress,
    ending2Unlocked: true,
  };
}

/**
 * Duration in seconds that the 6:00 AM screen stays displayed before automatically transitioning.
 */
export const POST_6AM_HOLD_SECONDS = 4.0;

export type PostVictoryAction =
  | { type: 'next_night'; nextNightNumber: number }
  | { type: 'main_menu' };

/**
 * Determines the automatic transition after holding 6:00 AM for 4 seconds:
 * - Nights 1 to 4 automatically advance to the next night (Night 2..5) without showing options.
 * - Night 5 (final campaign night) and Extra Nights (6, 7, 8) return to the Main Menu.
 */
export function getPostVictoryAction(completedNight: number): PostVictoryAction {
  if (completedNight >= 1 && completedNight < 5) {
    return {
      type: 'next_night',
      nextNightNumber: completedNight + 1,
    };
  }
  return { type: 'main_menu' };
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
      moveCooldown: 3.63, // 10% slower than previous 3.3s cooldown
      lastMovedAt: 0,
    },
  };
}

export const THE_THING_BASE_MOVE_COOLDOWN_SEC = 3.63;
export const THE_THING_CORRIDOR_FLICKER_VISIBLE_DURATION_SEC = 0.5;
export const THE_THING_CORRIDOR_FLICKER_CYCLE_SEC = 1.25;

export interface TheThingCorridorFlickerState {
  corridorLit: boolean;
  naturalBrightness: number;
  showTheThingInCorridor: boolean;
  flickerIndex: number;
  timeInCycleSec: number;
}

/**
 * Models the natural ambient hallway light flicker in the left/right office corridors
 * and determines when The Thing ('blob') briefly appears in the hallway:
 * - Each natural flicker cycle is 1.25s: the first 0.50s is the active ON flicker pulse,
 *   followed by a dim/flickering interval.
 * - When The Thing approaches via the doors, turning on the manual door light does NOT reveal him.
 * - Instead, during SOME (and ONLY SOME — 1 out of every 4 natural flicker pulses) of the natural
 *   hallway light flickers, he appears in that hallway for exactly 0.5 seconds (`0.00s <= timeInCycleSec < 0.50s`).
 */
export function getTheThingCorridorFlickerState(
  timeSec: number,
  side: 'left' | 'right',
  powerRemaining: number
): TheThingCorridorFlickerState {
  if (powerRemaining <= 0) {
    return {
      corridorLit: false,
      naturalBrightness: 0.04,
      showTheThingInCorridor: false,
      flickerIndex: 0,
      timeInCycleSec: 0,
    };
  }

  const phaseOffset = side === 'left' ? 0 : 0.625;
  const shiftedTime = Math.max(0, timeSec + phaseOffset);
  const flickerIndex = Math.floor(shiftedTime / THE_THING_CORRIDOR_FLICKER_CYCLE_SEC);
  const timeInCycleSec =
    shiftedTime - flickerIndex * THE_THING_CORRIDOR_FLICKER_CYCLE_SEC;

  // Natural 0.5s ON flicker pulse at the start of each cycle, plus a brief secondary micro-flicker
  const inPrimaryHalfSecondPulse =
    timeInCycleSec >= 0 &&
    timeInCycleSec < THE_THING_CORRIDOR_FLICKER_VISIBLE_DURATION_SEC;
  const inSecondaryMicroPulse = timeInCycleSec >= 0.78 && timeInCycleSec < 0.96;
  const corridorLit = inPrimaryHalfSecondPulse || inSecondaryMicroPulse;
  const naturalBrightness = corridorLit ? 0.56 : 0.12;

  // Only on SOME natural flickers (1 out of every 4 primary 0.5s pulses, never on secondary micro-pulses!)
  const isSelectedFlickerCycle = flickerIndex % 4 === 1;
  const showTheThingInCorridor = inPrimaryHalfSecondPulse && isSelectedFlickerCycle;

  return {
    corridorLit,
    naturalBrightness,
    showTheThingInCorridor,
    flickerIndex,
    timeInCycleSec,
  };
}

/**
 * Returns true when The Thing is hunting alone and the other animatronics (Still Bonnie in CAM_1A,
 * Still Chica in CAM_5, and Still Nightmare in CAM_3 — excluding Still Freddy who was already seen
 * devastated in the interlude) should appear on the floor of their initial rooms, devastated,
 * dismembered, and covered in blood.
 */
export function shouldShowDestroyedAnimatronicCorpses(
  animatronics: Record<AnimatronicId, AnimatronicState>
): boolean {
  return Boolean(
    animatronics.blob?.active &&
      !animatronics.bonnie?.active &&
      !animatronics.chica?.active &&
      !animatronics.nightmare?.active
  );
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
    CAM_3: ['CAM_4B', 'CAM_2A'],
    CAM_4B: ['DOOR_RIGHT'],
    CAM_2A: ['CAM_2B'],
    CAM_2B: ['DOOR_LEFT'],
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
 * Returns true if the given animatronic is visible on security camera feeds at its current node.
 * Still Nightmare is visible on cameras (in CAM_3 during stages 2 & 3, and on hallway cameras
 * CAM_4B, CAM_2A, CAM_2B as he approaches), or via the office door lights when about to attack
 * at DOOR_LEFT / DOOR_RIGHT (never visible directly in the unlit office hallway).
 */
export function isAnimatronicVisibleOnCamera(anim: AnimatronicState, cameraNode: NodeId): boolean {
  if (!anim.active) return false;
  if (anim.id === 'nightmare') {
    if (cameraNode === 'CAM_3') {
      return anim.location === 'CAM_3' && (anim.bathroomStage === 2 || anim.bathroomStage === 3);
    }
    return anim.location === cameraNode;
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

export const POWER_DRAIN_MULTIPLIER = 0.85; // Reduced energy consumption by another 5% (15% total reduction)

export function calculatePowerDrain(defense: OfficeDefenseState): {
  usageBars: number;
  drainPerSecond: number;
} {
  let bars = 1;
  if (defense.leftDoorClosed) bars += 1;
  if (defense.rightDoorClosed) bars += 1;
  if (defense.ventClosed) bars += 1;
  if (defense.leftLightOn || defense.rightLightOn || defense.cameraOpen) bars += 1;

  const baseDrainPerSecond = 0.14 + (bars - 1) * 0.21;
  const drainPerSecond = Number((baseDrainPerSecond * POWER_DRAIN_MULTIPLIER).toFixed(5));
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
    // Chooses between Option 1 (Right side of office, closer/faster: CAM_4B -> DOOR_RIGHT)
    // and Option 2 (Left side of office, takes slightly longer: CAM_2A -> CAM_2B -> DOOR_LEFT).
    // Emits NIGHTMARE_FOOTSTEPS as he walks through the building!
    if (anim.location === 'CAM_3' && stage >= 3) {
      const goRightCloser = choiceRoll0To1 < 0.5;
      return {
        nextState: {
          ...anim,
          bathroomStage: 4,
          location: goRightCloser ? 'CAM_4B' : 'CAM_2A',
          patienceTimer: 0,
        },
        audioEvents: ['NIGHTMARE_FOOTSTEPS'],
        triggerOfficeFlickerMs: 0,
        triggeredJumpscareBy: null,
      };
    }

    if (anim.location === 'CAM_4B' || anim.location === 'BATHROOM_HALL_RIGHT') {
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

    if (anim.location === 'CAM_2A' || anim.location === 'BATHROOM_HALL_LEFT_1') {
      return {
        nextState: {
          ...anim,
          bathroomStage: 4,
          location: 'CAM_2B',
          patienceTimer: 0,
        },
        audioEvents: ['NIGHTMARE_FOOTSTEPS'],
        triggerOfficeFlickerMs: 0,
        triggeredJumpscareBy: null,
      };
    }

    if (anim.location === 'CAM_2B' || anim.location === 'BATHROOM_HALL_LEFT_2') {
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
    text: 'Seguro que es allí a donde tengo que ir.',
  },
  {
    speaker: 'INTERLOCUTOR',
    speakerColor: '#7dd3fc',
    text: 'Sí, allí es, pero recuerda llegar un rato antes de empezar tu turno, te tienen que explicar todo bien.',
  },
];

export const INTRO_OUTSIDE_CAR_DIALOGUE: IntroDialogueLine = {
  speaker: 'PROTAGONISTA',
  speakerColor: '#fde047',
  text: 'Es la primera vez que me toca hacer un trabajo a estas horas. Estoy muy lejos de casa, pero, en principio, hay un hotel cerca de aquí.',
};

export const INTRO_OUTSIDE_DOOR_DIALOGUE: IntroDialogueLine = {
  speaker: 'PROTAGONISTA',
  speakerColor: '#fde047',
  text: 'Este sitio... está hecho una porquería. ¿De verdad que aquí se paga lo que anunciaron?',
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
  slightTremble?: boolean;
  slowTremble?: boolean;
  vividTremble?: boolean;
  largeTremble?: boolean;
  glitchText?: boolean;
  shrinkingText?: boolean;
}

export interface OfficeNarrativeTab {
  speaker: string;
  speakerColor: string;
  segments: DialogueSegment[];
}

export const PROTAGONIST_NAME_FROM_NIGHT_3 = 'RICHARD';

export function getProtagonistSpeakerName(nightNumber: number, afterNight3PhoneCall = false): string {
  if (nightNumber > 3 || (nightNumber === 3 && afterNight3PhoneCall)) {
    return PROTAGONIST_NAME_FROM_NIGHT_3;
  }
  return 'PROTAGONISTA';
}

export const NIGHT_1_OFFICE_MONOLOGUE_TABS: readonly OfficeNarrativeTab[] = [
  {
    speaker: 'PROTAGONISTA',
    speakerColor: '#fde047',
    segments: [
      {
        text: '¿Cómo es posible que yo tenga que trabajar vigilando esto? No, no hay nada de valor aquí, ¿y se supone que la gente viene aquí a celebrar fiestas?',
      },
    ],
  },
  {
    speaker: 'PROTAGONISTA',
    speakerColor: '#fde047',
    segments: [
      {
        text: '... En fin, qué remedio. Me dijeron que me llamarían a las 12:00 A.M.',
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
        text: 'Ah, ah, has venido. No esperaba que al final fueses a hacerlo.',
      },
    ],
  },
  {
    speaker: '???',
    speakerColor: '#f87171',
    segments: [
      {
        text: 'No me convenció mucho cuando llamaste a nuestro anuncio, pero has venido. Mira, te explico este trabajo rápido.',
      },
    ],
  },
  {
    speaker: '???',
    speakerColor: '#f87171',
    segments: [
      {
        text: 'Este local es de mi familia, y ya sé que no está en las mejores condiciones, pero no me negarás que es un chollazo.',
      },
    ],
  },
  {
    speaker: '???',
    speakerColor: '#f87171',
    segments: [
      {
        text: 'Tu trabajo solo es vigilar que nadie se cuele en el local hasta las 6:00 A.M. Después podrás irte a casa; no te preocupes, llegarán en un rato los del turno de día.',
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
        text: '"ASUNTOS PENDIENTES".',
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

export const NIGHT_2_PHONE_CALL_TABS: readonly OfficeNarrativeTab[] = [
  {
    speaker: '???',
    speakerColor: '#f87171',
    segments: [
      {
        text: 'Vaya, vaya, veo que la oferta era muy ',
      },
      {
        text: 'irresistible.',
        slightTremble: true,
      },
    ],
  },
  {
    speaker: '???',
    speakerColor: '#f87171',
    segments: [
      {
        text: 'Bueno, esta es tu segunda noche aquí y aquí conocerás a otro de mis "juguetitos".',
      },
    ],
  },
  {
    speaker: '???',
    speakerColor: '#f87171',
    segments: [
      {
        text: 'Seguro que esperas que te diga algo para evitarlo, pero entonces, ¿qué gracia tendría arruinarle la sorpresa a mis empleados?',
      },
    ],
  },
  {
    speaker: '???',
    speakerColor: '#f87171',
    segments: [
      {
        text: 'El caso es como ayer: vigila que no se cuele nadie hasta las 6:00 A.M. Luego podrás volver al hotel con total tranquilidad.',
      },
    ],
  },
  {
    speaker: '???',
    speakerColor: '#f87171',
    segments: [
      {
        text: '¡HASTA MAÑANA, JAJAJAJAJA!',
        slowTremble: true,
        vividTremble: true,
      },
    ],
  },
];

export const NIGHT_2_POST_CALL_MONOLOGUE_TABS: readonly OfficeNarrativeTab[] = [
  {
    speaker: 'PROTAGONISTA',
    speakerColor: '#fde047',
    segments: [
      {
        text: 'Capullo.',
      },
    ],
  },
];

export const NIGHT_3_PHONE_CALL_TABS: readonly OfficeNarrativeTab[] = [
  {
    speaker: '???',
    speakerColor: '#f87171',
    segments: [
      {
        text: 'Vaya, vaya, vaya, no esperaba verte esta noche, la verdad me has dejado sorprendido.',
      },
    ],
  },
  {
    speaker: '???',
    speakerColor: '#f87171',
    segments: [
      {
        text: '¿Seguro que no quieres un trabajo ',
      },
      {
        text: 'FIJO AQUÍ',
        slightTremble: true,
      },
      {
        text: '?',
      },
    ],
  },
  {
    speaker: '???',
    speakerColor: '#f87171',
    segments: [
      {
        text: 'Lo estás haciendo bien, ',
      },
      {
        text: 'AMIGO MÍO',
        glitchText: true,
      },
      {
        text: ', creo que te has ganado una pequeña explicación.',
      },
    ],
  },
  {
    speaker: '???',
    speakerColor: '#f87171',
    segments: [
      {
        text: 'Hace mucho tiempo, el gerente que llevaba este local desapareció sin dejar rastro y con él todo su imperio.',
      },
    ],
  },
  {
    speaker: '???',
    speakerColor: '#f87171',
    segments: [
      {
        text: 'Mi familia compró el local poco después con la intención de renovarlo y darle un lavado de cara.',
      },
    ],
  },
  {
    speaker: '???',
    speakerColor: '#f87171',
    segments: [
      {
        text: 'Sin embargo, a uno de mis queridos ',
      },
      {
        text: 'FAMILIARES',
        glitchText: true,
      },
      {
        text: ', le ocurrió un "',
      },
      {
        text: 'Accidente',
        slightTremble: true,
      },
      {
        text: '". Nunca supimos qué fue lo que le pasó...',
      },
    ],
  },
  {
    speaker: '???',
    speakerColor: '#f87171',
    segments: [
      {
        text: 'Porque nunca encontramos el cuerpo, JAJAJAJA.',
        slightTremble: true,
      },
    ],
  },
  {
    speaker: '???',
    speakerColor: '#f87171',
    segments: [
      {
        text: 'O quizás sí que lo encontramos... Cómo me gustaría comprobarlo, ya queda poco, ',
      },
      {
        text: 'JEJEJE.',
        slightTremble: true,
      },
    ],
  },
  {
    speaker: '???',
    speakerColor: '#f87171',
    segments: [
      {
        text: 'Disfruta de la noche, solo te quedan 3 y tu hermana logrará salvarse de esa enfermedad. Vamos, ',
      },
      {
        text: 'RICHARD, te están esperando.',
        slowTremble: true,
      },
    ],
  },
];

export const NIGHT_3_POST_CALL_MONOLOGUE_TABS: readonly OfficeNarrativeTab[] = [
  {
    speaker: PROTAGONIST_NAME_FROM_NIGHT_3,
    speakerColor: '#fde047',
    segments: [
      {
        text: '¿Có-cómo sabe mi nombre?',
      },
    ],
  },
  {
    speaker: PROTAGONIST_NAME_FROM_NIGHT_3,
    speakerColor: '#fde047',
    segments: [
      {
        text: 'Lo hago por mi hermana, lo hago por mi hermana, lo...',
        shrinkingText: true,
      },
    ],
  },
];

export const NIGHT_4_PHONE_CALL_TABS: readonly OfficeNarrativeTab[] = [
  {
    speaker: '???',
    speakerColor: '#f87171',
    segments: [
      {
        text: 'Bien, bien, te explicaré tu trabajo esta noche, como veo que se te da bien eso de defenderte de mis ',
      },
      {
        text: 'juguetitos',
        slightTremble: true,
      },
      {
        text: '.',
      },
    ],
  },
  {
    speaker: '???',
    speakerColor: '#f87171',
    segments: [
      {
        text: 'Voy a necesitar que encuentres las llaves para acceder al armario en la cámara 05,',
      },
    ],
  },
  {
    speaker: '???',
    speakerColor: '#f87171',
    segments: [
      {
        text: 'Estas llaves están por toda la pizzería, pero me acuerdo de dónde estaba la primera, creo que era en la cámara 04.',
      },
    ],
  },
  {
    speaker: '???',
    speakerColor: '#f87171',
    segments: [
      {
        text: 'Esos papeles son de vital importancia, recupéralos y te ganarás una gran recompensa, una muy ',
      },
      {
        text: 'JUGOSA',
        slowTremble: true,
      },
      {
        text: '.',
      },
    ],
  },
  {
    speaker: '???',
    speakerColor: '#f87171',
    segments: [
      {
        text: 'Pero bueno, lo importante es que ahora estás ahí, disfruta de la noche.',
      },
    ],
  },
  {
    speaker: '???',
    speakerColor: '#f87171',
    segments: [
      {
        text: 'Seguro que mañana ',
      },
      {
        text: 'TODO ACABA',
        largeTremble: true,
      },
      {
        text: ', ji ji ji ji ji ji...',
      },
    ],
  },
];

export function getOfficeCallTabs(nightNumber = 1): readonly OfficeNarrativeTab[] {
  if (nightNumber === 4) return NIGHT_4_PHONE_CALL_TABS;
  if (nightNumber === 3) return NIGHT_3_PHONE_CALL_TABS;
  if (nightNumber === 2) return NIGHT_2_PHONE_CALL_TABS;
  return NIGHT_1_PHONE_CALL_TABS;
}

export function getOfficePostCallMonologueTabs(nightNumber = 1): readonly OfficeNarrativeTab[] {
  if (nightNumber === 3) return NIGHT_3_POST_CALL_MONOLOGUE_TABS;
  if (nightNumber === 2) return NIGHT_2_POST_CALL_MONOLOGUE_TABS;
  return [];
}

export type Night1OfficeNarrativePhase =
  | 'OFFICE_MONOLOGUE'
  | 'PHONE_RINGING'
  | 'PHONE_CALL_DIALOGUE'
  | 'POST_CALL_MONOLOGUE'
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

export const INITIAL_NIGHT_2_OFFICE_NARRATIVE_STATE: Night1OfficeNarrativeState = {
  phase: 'PHONE_RINGING',
  tabIndex: 0,
  ringCount: 1,
};

export function getInitialOfficeNarrativeState(nightNumber = 1): Night1OfficeNarrativeState {
  if (nightNumber === 2 || nightNumber === 3 || nightNumber === 4) {
    return { ...INITIAL_NIGHT_2_OFFICE_NARRATIVE_STATE };
  }
  return { ...INITIAL_NIGHT_1_OFFICE_NARRATIVE_STATE };
}

export function canSkipPhoneRings(nightNumber = 1): boolean {
  return nightNumber === 2 || nightNumber === 3 || nightNumber === 4;
}

/**
 * Returns the 8-bit story minigame corresponding to a campaign night when pressing "Continuar":
 * - Night 1 -> 'intro_minigame'
 * - Night 2 -> 'post_night1_minigame'
 * - Night 3 -> 'post_night2_minigame'
 * - Night 4 -> 'post_night3_minigame'
 * - Night 5 -> 'post_night4_minigame'
 * - Night 6+ -> null (starts the night directly)
 */
export function getMinigameForCampaignNight(
  nightNumber: number
):
  | 'intro_minigame'
  | 'post_night1_minigame'
  | 'post_night2_minigame'
  | 'post_night3_minigame'
  | 'post_night4_minigame'
  | null {
  if (nightNumber === 1) return 'intro_minigame';
  if (nightNumber === 2) return 'post_night1_minigame';
  if (nightNumber === 3) return 'post_night2_minigame';
  if (nightNumber === 4) return 'post_night3_minigame';
  if (nightNumber === 5) return 'post_night4_minigame';
  return null;
}

/**
 * Advances the Office Narrative (Night 1, Night 2, or Night 3) when the player presses Enter on a dialogue tab,
 * skips the 3 phone rings on Night 2/3, or when the 3-loop phone ring sequence finishes.
 */
export function advanceNight1OfficeNarrative(
  state: Night1OfficeNarrativeState,
  event: 'PRESS_ENTER' | 'PHONE_RINGS_DONE',
  nightNumber = 1
): Night1OfficeNarrativeState {
  const callTabs = getOfficeCallTabs(nightNumber);
  const postCallTabs = getOfficePostCallMonologueTabs(nightNumber);

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

  if (
    state.phase === 'PHONE_RINGING' &&
    (event === 'PHONE_RINGS_DONE' || (event === 'PRESS_ENTER' && canSkipPhoneRings(nightNumber)))
  ) {
    return {
      phase: 'PHONE_CALL_DIALOGUE',
      tabIndex: 0,
      ringCount: PHONE_RING_TOTAL_LOOPS,
    };
  }

  if (state.phase === 'PHONE_CALL_DIALOGUE' && event === 'PRESS_ENTER') {
    if (state.tabIndex + 1 < callTabs.length) {
      return {
        ...state,
        tabIndex: state.tabIndex + 1,
      };
    }
    if (postCallTabs.length > 0) {
      return {
        phase: 'POST_CALL_MONOLOGUE',
        tabIndex: 0,
        ringCount: PHONE_RING_TOTAL_LOOPS,
      };
    }
    return {
      phase: 'COMPLETED',
      tabIndex: 0,
      ringCount: PHONE_RING_TOTAL_LOOPS,
    };
  }

  if (state.phase === 'POST_CALL_MONOLOGUE' && event === 'PRESS_ENTER') {
    if (state.tabIndex + 1 < postCallTabs.length) {
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

// ============================================================================
// STORY MODE PART 2: POST-NIGHT 1 8-BIT MINIGAME (NIGHT 1 -> NIGHT 2 BRIDGE)
// ============================================================================

export type PostNight1MinigamePhase =
  | 'EXIT_BUILDING_DIALOGUE'
  | 'WALK_TO_CAR'
  | 'MOUNT_CAR_FADE_OUT'
  | 'REVERSE_DRIVING_FADE_IN'
  | 'REVERSE_DRIVING_CRUISE'
  | 'REVERSE_DRIVING_THUNDER_DIALOGUE'
  | 'REVERSE_DRIVING_BONNIE_SWERVE'
  | 'HOTEL_WAKE_ANIMATION'
  | 'HOTEL_WAKE_DIALOGUE'
  | 'HOTEL_PHONE_RINGING_WALK'
  | 'HOTEL_PHONE_CONVERSATION'
  | 'HOTEL_CHOICE_NO_FEEDBACK'
  | 'HOTEL_FADE_OUT'
  | 'RETURN_OUTSIDE_FADE_IN'
  | 'RETURN_OUTSIDE_WALK'
  | 'RETURN_OUTSIDE_DOOR_DIALOGUE'
  | 'RETURN_ENTERING_FADE_OUT'
  | 'COMPLETED';

/**
 * Returns true when the Post-Night 1 minigame is in a scene where it is raining outside,
 * allowing the rain audio loop to play continuously across consecutive rain scenes without restarting.
 */
export function isPostNight1RainPhase(phase: PostNight1MinigamePhase): boolean {
  return (
    phase === 'EXIT_BUILDING_DIALOGUE' ||
    phase === 'WALK_TO_CAR' ||
    phase === 'MOUNT_CAR_FADE_OUT' ||
    phase === 'REVERSE_DRIVING_FADE_IN' ||
    phase === 'REVERSE_DRIVING_CRUISE' ||
    phase === 'REVERSE_DRIVING_THUNDER_DIALOGUE' ||
    phase === 'REVERSE_DRIVING_BONNIE_SWERVE' ||
    phase === 'RETURN_OUTSIDE_FADE_IN' ||
    phase === 'RETURN_OUTSIDE_WALK' ||
    phase === 'RETURN_OUTSIDE_DOOR_DIALOGUE' ||
    phase === 'RETURN_ENTERING_FADE_OUT'
  );
}

export interface PostNight1TextSegment {
  text: string;
  slightTremble?: boolean;
  slowTremble?: boolean;
  glitchText?: boolean;
  highlightedText?: boolean;
  fadingText?: boolean;
}

export interface PostNight1DialogueTab {
  speaker: string;
  speakerColor: string;
  segments: PostNight1TextSegment[];
  autoCutOffAfterTyped?: boolean;
  thinkingAnimationAfterPrefix?: string;
  hasYesNoChoice?: boolean;
  pauseBeforeShowMs?: number;
}

export const POST_NIGHT_1_EXIT_DIALOGUE_TABS: readonly PostNight1DialogueTab[] = [
  {
    speaker: 'PROTAGONISTA',
    speakerColor: '#fde047',
    segments: [
      {
        text: '¡NO VUELVO AQUÍ NI LOCO, NO VOLVERÉ AQUÍ NUNCA!',
      },
    ],
  },
  {
    speaker: 'PROTAGONISTA',
    speakerColor: '#fde047',
    segments: [
      {
        text: '¿Qué era esa ',
      },
      {
        text: 'COSA?',
        slowTremble: true,
      },
    ],
  },
];

export const POST_NIGHT_1_CAR_STOP_X = INTRO_OUTSIDE_SPAWN_X; // 210

export function stepWalkBackToCar(
  currentX: number,
  direction: -1 | 0 | 1,
  dtSec: number
): { x: number; reachedCar: boolean } {
  const nextRaw = currentX + direction * INTRO_WALK_SPEED_PX_PER_SEC * dtSec;
  const clamped = Math.max(POST_NIGHT_1_CAR_STOP_X, Math.min(INTRO_DOOR_STOP_X, nextRaw));
  return {
    x: clamped,
    reachedCar: clamped <= POST_NIGHT_1_CAR_STOP_X + 4,
  };
}

export const POST_NIGHT_1_THUNDER_DELAY_SEC = 4.0;
export const POST_NIGHT_1_GLASS_BREAK_TIME_SEC = 0.45;

export const POST_NIGHT_1_THUNDER_DIALOGUE: PostNight1DialogueTab = {
  speaker: 'PROTAGONISTA',
  speakerColor: '#fde047',
  segments: [
    {
      text: '¡QUÉ NOCHE DE PERROS!',
    },
  ],
};

export const POST_NIGHT_1_HOTEL_WAKE_DIALOGUE: PostNight1DialogueTab = {
  speaker: 'PROTAGONISTA',
  speakerColor: '#fde047',
  segments: [
    {
      text: '¡¿PERO QUÉ COJO...?! ¿DÓNDE ESTOY? ¿QUÉ HA PASADO CON MI COCHE Y CONMIGO?',
    },
  ],
};

export const HOTEL_BED_STAND_X = 285;
export const HOTEL_MIN_WALK_X = 215;
export const HOTEL_MAX_WALK_X = 720;
export const HOTEL_LIGHT_SWITCH_X = 548;
export const HOTEL_LIGHT_SWITCH_INTERACT_RADIUS = 22;
export const HOTEL_PHONE_X = 676;
export const HOTEL_PHONE_INTERACT_RADIUS = 72;

export function isNearHotelPhone(playerX: number): boolean {
  return Math.abs(playerX - HOTEL_PHONE_X) <= HOTEL_PHONE_INTERACT_RADIUS;
}

export function isNearHotelLightSwitch(playerX: number): boolean {
  return Math.abs(playerX - HOTEL_LIGHT_SWITCH_X) <= HOTEL_LIGHT_SWITCH_INTERACT_RADIUS;
}

export const POST_NIGHT_1_HOTEL_PHONE_TABS: readonly PostNight1DialogueTab[] = [
  {
    speaker: '???',
    speakerColor: '#f87171',
    segments: [
      {
        text: '¡OYE, OYE! ¿ESTÁS BIEN? TE LLAMÉ ANTES Y NO CONTESTABAS.',
      },
    ],
  },
  {
    speaker: '???',
    speakerColor: '#f87171',
    segments: [
      {
        text: 'Cambiando de tema, ¿qué tal el primer día de guardia?',
      },
    ],
  },
  {
    speaker: 'PROTAGONISTA',
    speakerColor: '#fde047',
    segments: [
      {
        text: '¡¿Que qué tal?! ¡NO VUELVO AHÍ NI LOCO! ¡Me querían matar, sucia rata! ¿Por qué no me dijiste nada?',
      },
    ],
  },
  {
    speaker: '???',
    speakerColor: '#f87171',
    segments: [
      {
        text: 'JA, JA, JA',
        slightTremble: true,
      },
      {
        text: ', me gusta darle una sorpresa a los nuevos empleados.',
      },
    ],
  },
  {
    speaker: 'PROTAGONISTA',
    speakerColor: '#fde047',
    autoCutOffAfterTyped: true,
    segments: [
      {
        text: '¡SERÁS HIJO DE PU... ',
      },
    ],
  },
  {
    speaker: '???',
    speakerColor: '#f87171',
    segments: [
      {
        text: 'Mira, hagamos un trato: si vas 4 noches más, te pagaré el triple de lo prometido. Creo que es una buena oferta.',
      },
    ],
  },
  {
    speaker: 'PROTAGONISTA',
    speakerColor: '#fde047',
    segments: [
      {
        text: '¡Yo ni loco hago tratos contigo, sabandija! ¡Yo me voy a mi casa!',
      },
    ],
  },
  {
    speaker: '???',
    speakerColor: '#f87171',
    segments: [
      {
        text: '¿Y cómo pretendes hacerlo? Tu coche está destrozado.',
      },
    ],
  },
  {
    speaker: '???',
    speakerColor: '#f87171',
    segments: [
      {
        text: 'Además, si te vas ahora, no conseguirás el dinero suficiente para pagar el tratamiento de tu hermana pequeña.',
      },
    ],
  },
  {
    speaker: 'PROTAGONISTA',
    speakerColor: '#fde047',
    thinkingAnimationAfterPrefix: '¿Pero cómo sabes eso?',
    segments: [
      {
        text: '¿Pero cómo sabes eso? ¡Desgraciado, si te veo en algún momento, te mato!',
      },
    ],
  },
  {
    speaker: '???',
    speakerColor: '#f87171',
    hasYesNoChoice: true,
    segments: [
      {
        text: 'JAJAJA',
        slightTremble: true,
      },
      {
        text: ', ¡qué gracioso eres! Bueno, ',
      },
      {
        text: '¿ACEPTAS?',
        slowTremble: true,
      },
    ],
  },
];

export const POST_NIGHT_1_NO_CONSTRUCTION_MESSAGE =
  'No puedes hacer eso, aún está en construcción.';

export const POST_NIGHT_1_RETURN_DOOR_DIALOGUE: PostNight1DialogueTab = {
  speaker: 'PROTAGONISTA',
  speakerColor: '#fde047',
  segments: [
    {
      text: 'Esto lo hago por ti, hermana. Aguanta un poco más.',
    },
  ],
};

export function shouldTriggerPostNight1Minigame(completedNight: number): boolean {
  return completedNight === 1;
}

export const DEFAULT_CUSTOM_AI_LEVELS: CustomAILevels = {
  freddy: 0,
  bonnie: 0,
  chica: 0,
  nightmare: 0,
  blob: 0,
};

export interface CustomNightAngerState {
  clampedLevel: number;
  normalizedAnger: number; // 0..1
  browAngleRad: number; // 0..0.64 rad (~36 deg downward scowl)
  eyeGlowAlpha: number; // 0..1
  shakeAmplitude: number; // px tremor
  moodLabel: string;
}

export function getCustomNightAngerState(aiLevel: number): CustomNightAngerState {
  const clampedLevel = Math.max(0, Math.min(20, Math.round(aiLevel || 0)));
  const normalizedAnger = clampedLevel / 20;
  const browAngleRad = normalizedAnger * 0.62;
  const eyeGlowAlpha = clampedLevel === 0 ? 0 : 0.25 + normalizedAnger * 0.75;
  const shakeAmplitude = clampedLevel >= 12 ? ((clampedLevel - 11) / 9) * 2.6 : 0;

  let moodLabel = 'INACTIVO';
  if (clampedLevel >= 1 && clampedLevel <= 5) {
    moodLabel = 'ALERTA';
  } else if (clampedLevel >= 6 && clampedLevel <= 11) {
    moodLabel = 'HOSTIL';
  } else if (clampedLevel >= 12 && clampedLevel <= 17) {
    moodLabel = 'CABREADO';
  } else if (clampedLevel >= 18) {
    moodLabel = 'FURIA TOTAL';
  }

  return {
    clampedLevel,
    normalizedAnger,
    browAngleRad,
    eyeGlowAlpha,
    shakeAmplitude,
    moodLabel,
  };
}

// ============================================================================
// STORY MODE PART 3: POST-NIGHT 2 8-BIT MINIGAME (NIGHT 2 -> NIGHT 3 BRIDGE)
// ============================================================================

export type PostNight2MinigamePhase =
  | 'HOTEL_EXTERIOR_WALK'
  | 'HOTEL_EXTERIOR_ENTERING_FADE'
  | 'HOTEL_HALLWAY'
  | 'HOTEL_ELEVATOR_FADE'
  | 'HOTEL_RECEPTIONIST_DIALOGUE'
  | 'HOTEL_WRONG_ROOM_DIALOGUE'
  | 'FLOOR_3_FLICKER_EVENT'
  | 'FLOOR_3_POST_FLICKER_DIALOGUE'
  | 'FLOOR_3_ROOM_303_STOP_DIALOGUE'
  | 'HOTEL_ROOM_FREE_ROAM'
  | 'HOTEL_ROOM_BED_PROMPT'
  | 'HOTEL_ROOM_TURN_OFF_LIGHTS_WALK'
  | 'HOTEL_ROOM_SLEEP_ANIMATION'
  | 'HOTEL_ROOM_WAKE_ANIMATION'
  | 'HOTEL_ROOM_WAKE_DIALOGUE'
  | 'HOTEL_ROOM_NIGHT_EXIT_WALK'
  | 'HOTEL_EXIT_TO_FACILITY_FADE_OUT'
  | 'FACILITY_EXTERIOR_FADE_IN'
  | 'FACILITY_EXTERIOR_WALK'
  | 'FACILITY_EXTERIOR_THINKING'
  | 'FACILITY_ENTERING_FADE_OUT'
  | 'COMPLETED';

export function shouldTriggerPostNight2Minigame(completedNight: number): boolean {
  return completedNight === 2;
}

export const HOTEL_EXTERIOR_SPAWN_X = 170;
export const HOTEL_EXTERIOR_MIN_X = 90;
export const HOTEL_EXTERIOR_MAX_X = 870;
export const HOTEL_EXTERIOR_DOOR_X = 480;
export const HOTEL_EXTERIOR_DOOR_INTERACT_RADIUS = 58;

export function isNearHotelExteriorDoor(playerX: number): boolean {
  return Math.abs(playerX - HOTEL_EXTERIOR_DOOR_X) <= HOTEL_EXTERIOR_DOOR_INTERACT_RADIUS;
}

// Long scrolling hotel hallway ("haz el pasillo para llegar a los ascensores mas largos tipo que el protagonista se tenga que desplazar y deje atras habitaciones")
export const HOTEL_HALLWAY_VIEWPORT_WIDTH = 960;
export const HOTEL_HALLWAY_WORLD_WIDTH = 1760;
export const HOTEL_HALLWAY_MIN_X = 110;
export const HOTEL_HALLWAY_MAX_X = 1650;
export const HOTEL_HALLWAY_EXIT_DOOR_X = 140;
export const HOTEL_HALLWAY_EXIT_INTERACT_RADIUS = 48;

export function getHotelHallwayCameraX(playerX: number): number {
  const maxScroll = HOTEL_HALLWAY_WORLD_WIDTH - HOTEL_HALLWAY_VIEWPORT_WIDTH;
  return Math.max(0, Math.min(maxScroll, playerX - HOTEL_HALLWAY_VIEWPORT_WIDTH * 0.5));
}

export function isNearHotelHallwayExitDoor(playerX: number): boolean {
  return Math.abs(playerX - HOTEL_HALLWAY_EXIT_DOOR_X) <= HOTEL_HALLWAY_EXIT_INTERACT_RADIUS;
}

export interface HotelReceptionistConfig {
  id: number;
  x: number;
  dialogueText: string;
}

export const HOTEL_RECEPTIONISTS: readonly HotelReceptionistConfig[] = [
  { id: 1, x: 290, dialogueText: 'Bienvenido al hotel.' },
  { id: 2, x: 390, dialogueText: 'Su habitación es la 303.' },
];

export const HOTEL_RECEPTIONIST_INTERACT_RADIUS = 42;

export function getNearbyReceptionist(playerX: number): HotelReceptionistConfig | null {
  let closest: HotelReceptionistConfig | null = null;
  let minDist = Infinity;
  for (const r of HOTEL_RECEPTIONISTS) {
    const dist = Math.abs(playerX - r.x);
    if (dist <= HOTEL_RECEPTIONIST_INTERACT_RADIUS && dist < minDist) {
      minDist = dist;
      closest = r;
    }
  }
  return closest;
}

export interface HotelRoomDoorConfig {
  roomNumber: string;
  indexFromLeft: number; // 1, 2, 3, 4
  x: number;
  isPlayerRoom: boolean;
}

export const HOTEL_ELEVATOR_DOWN_X = 1510; // Left elevator at the end of the long hallway: go down
export const HOTEL_ELEVATOR_UP_X = 1610; // Right elevator at the end of the long hallway: go up
export const HOTEL_ELEVATOR_INTERACT_RADIUS = 42;

export function isNearElevatorDown(playerX: number): boolean {
  return Math.abs(playerX - HOTEL_ELEVATOR_DOWN_X) <= HOTEL_ELEVATOR_INTERACT_RADIUS;
}

export function isNearElevatorUp(playerX: number): boolean {
  return Math.abs(playerX - HOTEL_ELEVATOR_UP_X) <= HOTEL_ELEVATOR_INTERACT_RADIUS;
}

/**
 * Returns the 4 numbered hotel room doors spaced along the long scrolling hallway on each of the 3 floors:
 * - Floor 1: 101, 102, 103, 104 (none enterable -> "La llave no funciona, esta no es mi habitación.")
 * - Floor 2: 201, 202, 203, 204 (none enterable -> "La llave no funciona, esta no es mi habitación.")
 * - Floor 3: 301, 302, 303, 304 (only the 3rd from the left, 303, is the player's room!)
 */
export function getHotelFloorRooms(floor: 1 | 2 | 3): readonly HotelRoomDoorConfig[] {
  if (floor === 1) {
    return [
      { roomNumber: '101', indexFromLeft: 1, x: 580, isPlayerRoom: false },
      { roomNumber: '102', indexFromLeft: 2, x: 820, isPlayerRoom: false },
      { roomNumber: '103', indexFromLeft: 3, x: 1060, isPlayerRoom: false },
      { roomNumber: '104', indexFromLeft: 4, x: 1300, isPlayerRoom: false },
    ];
  }
  if (floor === 2) {
    return [
      { roomNumber: '201', indexFromLeft: 1, x: 340, isPlayerRoom: false },
      { roomNumber: '202', indexFromLeft: 2, x: 640, isPlayerRoom: false },
      { roomNumber: '203', indexFromLeft: 3, x: 940, isPlayerRoom: false },
      { roomNumber: '204', indexFromLeft: 4, x: 1240, isPlayerRoom: false },
    ];
  }
  return [
    { roomNumber: '301', indexFromLeft: 1, x: 340, isPlayerRoom: false },
    { roomNumber: '302', indexFromLeft: 2, x: 640, isPlayerRoom: false },
    { roomNumber: '303', indexFromLeft: 3, x: 940, isPlayerRoom: true },
    { roomNumber: '304', indexFromLeft: 4, x: 1240, isPlayerRoom: false },
  ];
}

export const HOTEL_PLAYER_ROOM_303_X = 940;
export const HOTEL_ROOM_DOOR_INTERACT_RADIUS = 44;

export function getNearbyHotelHallwayRoom(
  floor: 1 | 2 | 3,
  playerX: number
): HotelRoomDoorConfig | null {
  const rooms = getHotelFloorRooms(floor);
  for (const room of rooms) {
    if (Math.abs(playerX - room.x) <= HOTEL_ROOM_DOOR_INTERACT_RADIUS) {
      return room;
    }
  }
  return null;
}

export const FLOOR_3_FLICKER_TOTAL_COUNT = 5;
// ~30% faster light flickers (reduced from 0.52s to 0.36s per flicker cycle)
export const FLOOR_3_SINGLE_FLICKER_DURATION_SEC = 0.36;

export interface Floor3FlickerState {
  flickerIndex: number; // 1..5 while active, 5 when completed
  lightOn: boolean;
  showBlackBonnie: boolean;
  completed: boolean;
}

/**
 * Computes the 3rd-floor hallway light flicker sequence (5 flickers total, ~30% faster):
 * - During flickers 2 and 4 when the light flashes ON, the black silhouette rabbit (Bonnie) appears!
 * - Once all 5 flickers complete, the light stays ON and the black rabbit has disappeared.
 */
export function getFloor3FlickerState(elapsedSec: number): Floor3FlickerState {
  const totalDuration = FLOOR_3_FLICKER_TOTAL_COUNT * FLOOR_3_SINGLE_FLICKER_DURATION_SEC;
  if (elapsedSec >= totalDuration) {
    return {
      flickerIndex: FLOOR_3_FLICKER_TOTAL_COUNT,
      lightOn: true,
      showBlackBonnie: false,
      completed: true,
    };
  }

  const rawCycle = Math.floor(Math.max(0, elapsedSec) / FLOOR_3_SINGLE_FLICKER_DURATION_SEC);
  const flickerIndex = Math.min(FLOOR_3_FLICKER_TOTAL_COUNT, rawCycle + 1); // 1..5
  const phaseInCycle =
    (Math.max(0, elapsedSec) % FLOOR_3_SINGLE_FLICKER_DURATION_SEC) /
    FLOOR_3_SINGLE_FLICKER_DURATION_SEC;

  // Each flicker cycle starts with a dark dip (0.00..0.32), then flashes ON (0.32..0.84), then brief dip (0.84..1.00)
  const lightOn = phaseInCycle >= 0.32 && phaseInCycle <= 0.84;
  const showBlackBonnie = lightOn && (flickerIndex === 2 || flickerIndex === 4);

  return {
    flickerIndex,
    lightOn,
    showBlackBonnie,
    completed: false,
  };
}

export const POST_NIGHT_2_WRONG_ROOM_DIALOGUE: PostNight1DialogueTab = {
  speaker: 'PROTAGONISTA',
  speakerColor: '#fde047',
  segments: [
    {
      text: 'La llave no funciona, esta no es mi habitación.',
    },
  ],
};

export const POST_NIGHT_2_FLICKER_DIALOGUE: PostNight1DialogueTab = {
  speaker: 'PROTAGONISTA',
  speakerColor: '#fde047',
  segments: [
    {
      text: '¿Qué era ',
    },
    {
      text: 'ESO',
      slowTremble: true,
    },
    {
      text: '?',
    },
  ],
};

export const POST_NIGHT_2_ROOM_303_DIALOGUE: PostNight1DialogueTab = {
  speaker: 'PROTAGONISTA',
  speakerColor: '#fde047',
  segments: [
    {
      text: 'Esta es mi habitación. Bueno, supongo que habrá que entrar.',
    },
  ],
};

export const POST_NIGHT_2_BED_SLEEP_PROMPT: PostNight1DialogueTab = {
  speaker: 'PROTAGONISTA',
  speakerColor: '#fde047',
  hasYesNoChoice: true,
  segments: [
    {
      text: '¿Quieres irte a dormir?',
    },
  ],
};

export const POST_NIGHT_2_WAKE_DIALOGUE: PostNight1DialogueTab = {
  speaker: 'PROTAGONISTA',
  speakerColor: '#fde047',
  segments: [
    {
      text: 'Solo 3 noches más, aguanta por favor.',
    },
  ],
};

export const HOTEL_CENTRAL_DOOR_X = 480;
export const HOTEL_CENTRAL_DOOR_INTERACT_RADIUS = 38;
export const HOTEL_BED_INTERACT_X = 250;
export const HOTEL_BED_INTERACT_RADIUS = 56;

export function isNearHotelBed(playerX: number): boolean {
  return Math.abs(playerX - HOTEL_BED_INTERACT_X) <= HOTEL_BED_INTERACT_RADIUS;
}

export function isNearHotelRoomCentralDoor(playerX: number): boolean {
  return Math.abs(playerX - HOTEL_CENTRAL_DOOR_X) <= HOTEL_CENTRAL_DOOR_INTERACT_RADIUS;
}

export const POST_NIGHT_2_SLEEP_FREDDY_LAUGH_TIME_SEC = 2.0;
export const POST_NIGHT_2_FACILITY_THINKING_DURATION_SEC = 3.0;

// ============================================================================
// STORY MODE PART 4: POST-NIGHT 3 8-BIT MINIGAME (NIGHT 3 -> NIGHT 4 BRIDGE)
// ============================================================================

export type PostNight3MinigamePhase =
  | 'FP_WALK_TO_DOOR'
  | 'FP_DOOR_CREAK_TURN_BACK_PROMPT'
  | 'FP_LOOKING_BACK_EMPTY'
  | 'FP_NIGHTMARE_8BIT_JUMPSCARE'
  | 'FP_BLACKOUT'
  | 'EXTERIOR_DRAGGED_BY_RABBIT'
  | 'EXTERIOR_DRAG_FADE_OUT'
  | 'HOSPITAL_WAKE_ANIMATION'
  | 'HOSPITAL_DIALOGUE'
  | 'HOSPITAL_ESCAPE_ANIMATION'
  | 'HOTEL_DAY_EXTERIOR_WALK'
  | 'HOTEL_DAY_ENTERING_FADE'
  | 'HOTEL_HALLWAY'
  | 'HOTEL_ELEVATOR_FADE'
  | 'HOTEL_RECEPTIONIST_DIALOGUE'
  | 'HOTEL_WRONG_ROOM_DIALOGUE'
  | 'FLOOR_2_FLICKER_EVENT'
  | 'FLOOR_3_FLICKER_EVENT'
  | 'FLOOR_3_THINKING_PAUSE'
  | 'FLOOR_3_POST_FLICKER_DIALOGUE'
  | 'HOTEL_ROOM_FREE_ROAM'
  | 'HOTEL_ROOM_PHONE_DECISION'
  | 'HOTEL_ROOM_PHONE_PAUSE_2S'
  | 'HOTEL_ROOM_PHONE_CONVERSATION'
  | 'HOTEL_ROOM_BED_PROMPT'
  | 'HOTEL_ROOM_TURN_OFF_LIGHTS_WALK'
  | 'HOTEL_ROOM_SLEEP_ANIMATION'
  | 'HOTEL_ROOM_WAKE_ANIMATION'
  | 'HOTEL_ROOM_NIGHT_EXIT_WALK'
  | 'HOTEL_EXIT_TO_FACILITY_FADE_OUT'
  | 'FACILITY_NIGHT_EXTERIOR_FADE_IN'
  | 'FACILITY_NIGHT_EXTERIOR_WALK'
  | 'FACILITY_NIGHT_ENTERING_FADE_OUT'
  | 'COMPLETED';

export function shouldTriggerPostNight3Minigame(completedNight: number): boolean {
  return completedNight === 3;
}

export const POST_NIGHT_3_HOSPITAL_TABS: readonly PostNight1DialogueTab[] = [
  {
    speaker: 'ENFERMERA',
    speakerColor: '#67e8f9',
    segments: [
      {
        text: '¡Has despertado! Había gente aquí que no pensaba que fueses a hacerlo. ¿Sabrías decir qué te ha pasado?',
      },
    ],
  },
  {
    speaker: PROTAGONIST_NAME_FROM_NIGHT_3,
    speakerColor: '#fde047',
    segments: [
      {
        text: 'No, no sé bien qué me ha pasado, tengo los recuerdos difusos, pero tengo que irme de aquí, me necesitan en un sitio.',
      },
    ],
  },
  {
    speaker: 'ENFERMERA',
    speakerColor: '#67e8f9',
    segments: [
      {
        text: 'No, no deberías, tienes lesiones y lo mejor será que descanses y reposes durante unos días.',
      },
    ],
  },
  {
    speaker: 'RICHARD (PENSAMIENTO)',
    speakerColor: '#f87171',
    segments: [
      {
        text: '"Si sigues así podrás pagar el tratamiento de tu hermana pequeña..."',
      },
    ],
  },
  {
    speaker: PROTAGONIST_NAME_FROM_NIGHT_3,
    speakerColor: '#fde047',
    segments: [
      {
        text: 'No, no, no, necesito ir, lo necesito... ',
      },
      {
        text: '¡LO NECESITOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOO!',
        glitchText: true,
      },
    ],
  },
];

// Post-Night 3 First-Person Jumpscare & Exterior Rabbit Drag Timing/Physics:
// - Jumpscare MP3 ("Jumpscare_nightmare_0a94c193.mp3") is 3.66s long.
// - Visual jumpscare plays for 3.15s, followed by a 0.55s blackout (3.70s total, plus audio-end check)
//   so the exterior rabbit drag NEVER starts before the jumpscare sound finishes.
export const POST_NIGHT_3_JUMPSCARE_AUDIO_DURATION_SEC = 3.66;
export const POST_NIGHT_3_JUMPSCARE_VISUAL_DURATION_SEC = 3.15;
export const POST_NIGHT_3_BLACKOUT_MIN_DURATION_SEC = 0.55;
export const POST_NIGHT_3_RABBIT_DRAG_DURATION_SEC = 6.4;

export interface PostNight3RabbitDragState {
  progress: number; // 0..1 halting ("a trompicones") progress
  rabbitX: number;
  richardX: number;
  isHeaving: boolean; // true during the sharp pull phase of each cycle
  rabbitLeanX: number; // forward lean/yank offset in px
  bodyBumpY: number; // gravel jolt on Richard's body during a heave
  completed: boolean;
}

/**
 * Computes the slower, halting ("a trompicones") exterior drag animation where the dark rabbit
 * drags Richard in 7 distinct strain-and-heave cycles over 6.4 seconds.
 */
export function getPostNight3RabbitDragState(elapsedSec: number): PostNight3RabbitDragState {
  const clamped = Math.max(0, Math.min(POST_NIGHT_3_RABBIT_DRAG_DURATION_SEC, elapsedSec));
  const totalCycles = 7;
  const cycleDuration = POST_NIGHT_3_RABBIT_DRAG_DURATION_SEC / totalCycles;
  const rawCycle = clamped / cycleDuration;
  const cycleIdx = Math.min(totalCycles - 1, Math.floor(rawCycle));
  const phaseInCycle = clamped >= POST_NIGHT_3_RABBIT_DRAG_DURATION_SEC ? 1 : rawCycle - cycleIdx;

  // Each cycle has a slow strain/pause phase (0..0.46) where the rabbit barely creeps (10% of step),
  // followed by a sudden jerky heave/yank phase (0.46..1.0) where it lurches the remaining 90% of the step!
  let cycleStepProgress: number;
  let isHeaving = false;
  let rabbitLeanX = 0;
  let bodyBumpY = 0;

  if (phaseInCycle < 0.46) {
    const p = phaseInCycle / 0.46;
    cycleStepProgress = p * 0.1;
    isHeaving = false;
    rabbitLeanX = Math.round(p * 3);
    bodyBumpY = 0;
  } else {
    const p = (phaseInCycle - 0.46) / 0.54;
    // Fast initial yank that settles at the end of the heave
    const heaveEase = 1 - Math.pow(1 - p, 2.3);
    cycleStepProgress = 0.1 + heaveEase * 0.9;
    isHeaving = p < 0.78;
    rabbitLeanX = isHeaving ? -4 : 0;
    bodyBumpY = p > 0.12 && p < 0.68 ? -3 : 0;
  }

  const progress = Math.min(1, (cycleIdx + cycleStepProgress) / totalCycles);
  const startX = 665;
  const totalDragDistance = 320; // Slower, heavy 320px drag over 6.4s
  const rabbitX = startX - progress * totalDragDistance;
  const richardX = rabbitX + 68;

  return {
    progress,
    rabbitX,
    richardX,
    isHeaving,
    rabbitLeanX,
    bodyBumpY,
    completed: elapsedSec >= POST_NIGHT_3_RABBIT_DRAG_DURATION_SEC,
  };
}

export interface CorridorPropProjection {
  visible: boolean;
  wallT: number; // 0 = at far wall (small), 1 = at near camera edge (large), >1 = passed behind camera
  scale: number;
}

/**
 * Projects a corridor prop at world coordinate `zWorld` (0 = start of hall, 1.35 = exit door)
 * into first-person screen perspective as the player advances (`fpProgress` 0..1).
 * As `fpProgress` increases, props closer than the door have `wallT` increase past 1.0 and
 * disappear behind the player ("dejar atrás cosas").
 */
export function projectFirstPersonCorridorProp(
  zWorld: number,
  fpProgress: number,
  isLookingBack = false
): CorridorPropProjection {
  const zDoor = 1.35;
  const maxCameraWalk = 0.85; // At fpProgress=1, camera is at z=0.85 (0.50 units in front of the door)
  const zCam = isLookingBack ? maxCameraWalk : Math.max(0, Math.min(1, fpProgress)) * maxCameraWalk;

  const zRel = isLookingBack ? zCam - zWorld : zWorld - zCam;
  const zFarPlane = isLookingBack ? zCam + 0.15 : zDoor - zCam;

  // If the prop is behind the camera (zRel <= 0.11) or beyond the far wall, it is no longer in view
  if (zRel <= 0.11 || zRel > zFarPlane + 0.02) {
    return {
      visible: false,
      wallT: zRel <= 0.11 ? 1.25 : -0.1,
      scale: 1,
    };
  }

  // Perspective interpolation along the wall from farPlane (wallT = 0) to near camera clip (wallT = 1)
  const nearClip = 0.12;
  const invRel = 1 / zRel;
  const invFar = 1 / zFarPlane;
  const invNear = 1 / nearClip;
  const wallT = Math.max(0, (invRel - invFar) / (invNear - invFar));
  const scale = Math.max(0.35, Math.min(2.4, 0.48 / zRel));

  return {
    visible: wallT >= 0 && wallT <= 1.06,
    wallT,
    scale,
  };
}

// Floor 2 in Post-Night 3: 4 flickers in 1.0 second, showing the dark rabbit on flicker 2 (far) and flicker 4 (closer)
export const FLOOR_2_P3_FLICKER_TOTAL_COUNT = 4;
export const FLOOR_2_P3_SINGLE_FLICKER_DURATION_SEC = 0.25; // 4 * 0.25s = 1.0s

export interface PostNight3Floor2FlickerState {
  flickerIndex: number; // 1..4
  lightOn: boolean;
  showBlackBonnie: boolean;
  distanceStage: 'none' | 'far' | 'closer';
  completed: boolean;
}

export function getPostNight3Floor2FlickerState(elapsedSec: number): PostNight3Floor2FlickerState {
  const totalDuration = FLOOR_2_P3_FLICKER_TOTAL_COUNT * FLOOR_2_P3_SINGLE_FLICKER_DURATION_SEC;
  if (elapsedSec >= totalDuration) {
    return {
      flickerIndex: FLOOR_2_P3_FLICKER_TOTAL_COUNT,
      lightOn: true,
      showBlackBonnie: false,
      distanceStage: 'none',
      completed: true,
    };
  }

  const rawCycle = Math.floor(Math.max(0, elapsedSec) / FLOOR_2_P3_SINGLE_FLICKER_DURATION_SEC);
  const flickerIndex = Math.min(FLOOR_2_P3_FLICKER_TOTAL_COUNT, rawCycle + 1); // 1..4
  const phaseInCycle =
    (Math.max(0, elapsedSec) % FLOOR_2_P3_SINGLE_FLICKER_DURATION_SEC) /
    FLOOR_2_P3_SINGLE_FLICKER_DURATION_SEC;

  const lightOn = phaseInCycle >= 0.3 && phaseInCycle <= 0.85;
  const showBlackBonnie = lightOn && (flickerIndex === 2 || flickerIndex === 4);
  const distanceStage =
    !showBlackBonnie ? 'none' : flickerIndex === 2 ? 'far' : 'closer';

  return {
    flickerIndex,
    lightOn,
    showBlackBonnie,
    distanceStage,
    completed: false,
  };
}

// Floor 3 in Post-Night 3:
// - 7 very fast flickers (0.16s each = 1.12s total), approaching on flickers 3, 5, and 7
// - Then when very close (after flicker 7), slowly raises its hand to touch the player (1.7s, +0.5s slower)
// - Then the light flickers one final time (0.28s) and the figure disappears!
export const FLOOR_3_P3_FLICKER_TOTAL_COUNT = 7;
export const FLOOR_3_P3_SINGLE_FLICKER_DURATION_SEC = 0.16;
export const FLOOR_3_P3_HAND_REACH_DURATION_SEC = 1.7;
export const FLOOR_3_P3_FINAL_VANISH_FLICKER_SEC = 0.28;

export interface PostNight3Floor3FlickerState {
  flickerIndex: number; // 1..7 during fast flickers, 8 during hand reach & final vanish
  lightOn: boolean;
  showBlackBonnie: boolean;
  distanceStage: 'none' | 'far' | 'mid' | 'close';
  handReachProgress: number; // 0..1 while slowly raising hand to touch Richard
  completed: boolean;
}

export function getPostNight3Floor3FlickerState(elapsedSec: number): PostNight3Floor3FlickerState {
  const fastFlickersDuration =
    FLOOR_3_P3_FLICKER_TOTAL_COUNT * FLOOR_3_P3_SINGLE_FLICKER_DURATION_SEC;
  const handReachEnd = fastFlickersDuration + FLOOR_3_P3_HAND_REACH_DURATION_SEC;
  const totalDuration = handReachEnd + FLOOR_3_P3_FINAL_VANISH_FLICKER_SEC;

  if (elapsedSec >= totalDuration) {
    return {
      flickerIndex: 8,
      lightOn: true,
      showBlackBonnie: false,
      distanceStage: 'none',
      handReachProgress: 1,
      completed: true,
    };
  }

  // Phase 1: 7 very fast flickers, approaching on 3 ('far'), 5 ('mid'), and 7 ('close')
  if (elapsedSec < fastFlickersDuration) {
    const rawCycle = Math.floor(Math.max(0, elapsedSec) / FLOOR_3_P3_SINGLE_FLICKER_DURATION_SEC);
    const flickerIndex = Math.min(FLOOR_3_P3_FLICKER_TOTAL_COUNT, rawCycle + 1); // 1..7
    const phaseInCycle =
      (Math.max(0, elapsedSec) % FLOOR_3_P3_SINGLE_FLICKER_DURATION_SEC) /
      FLOOR_3_P3_SINGLE_FLICKER_DURATION_SEC;

    const lightOn = phaseInCycle >= 0.28 && phaseInCycle <= 0.86;
    const isBonnieCycle = flickerIndex === 3 || flickerIndex === 5 || flickerIndex === 7;
    const showBlackBonnie = lightOn && isBonnieCycle;
    const distanceStage = !showBlackBonnie
      ? 'none'
      : flickerIndex === 3
      ? 'far'
      : flickerIndex === 5
      ? 'mid'
      : 'close';

    return {
      flickerIndex,
      lightOn,
      showBlackBonnie,
      distanceStage,
      handReachProgress: 0,
      completed: false,
    };
  }

  // Phase 2: Standing very close and slowly raising its hand to touch Richard
  if (elapsedSec < handReachEnd) {
    const reachProgress = Math.max(
      0,
      Math.min(1, (elapsedSec - fastFlickersDuration) / FLOOR_3_P3_HAND_REACH_DURATION_SEC)
    );
    return {
      flickerIndex: 7,
      lightOn: true,
      showBlackBonnie: true,
      distanceStage: 'close',
      handReachProgress: reachProgress,
      completed: false,
    };
  }

  // Phase 3: Final light flicker & vanish
  const vanishPhase = (elapsedSec - handReachEnd) / FLOOR_3_P3_FINAL_VANISH_FLICKER_SEC;
  const lightOn = vanishPhase >= 0.65;
  return {
    flickerIndex: 8,
    lightOn,
    showBlackBonnie: false,
    distanceStage: 'none',
    handReachProgress: 1,
    completed: false,
  };
}

export const POST_NIGHT_3_FLOOR_3_THINKING_DURATION_SEC = 1.5;

export const POST_NIGHT_3_HALLUCINATIONS_DIALOGUE: PostNight1DialogueTab = {
  speaker: PROTAGONIST_NAME_FROM_NIGHT_3,
  speakerColor: '#fde047',
  segments: [
    {
      text: 'Alucinaciones, sí, eso, tiene que ser eso.',
    },
  ],
};

export const POST_NIGHT_3_PHONE_DECISION_PROMPT: PostNight1DialogueTab = {
  speaker: PROTAGONIST_NAME_FROM_NIGHT_3,
  speakerColor: '#fde047',
  hasYesNoChoice: true,
  segments: [
    {
      text: 'El teléfono está sonando. ¿Quieres contestar la llamada o ignorarla?',
    },
  ],
};

export const POST_NIGHT_3_PHONE_PAUSE_MS = 2000;

export const POST_NIGHT_3_HOTEL_PHONE_TABS: readonly PostNight1DialogueTab[] = [
  {
    speaker: '???',
    speakerColor: '#f87171',
    segments: [
      {
        text: 'Ah, por fin despiertas. Bien, tengo un trabajo importante para ti esta noche.',
      },
    ],
  },
  {
    speaker: '???',
    speakerColor: '#f87171',
    segments: [
      {
        text: 'TIENES QUE BUSCAR EN EL LOCAL UNOS PAPELES QUE ESTÁN EN LA SALA DE ALMACÉN, EN UNA PUERTA SECRETA QUE HAY.',
        highlightedText: true,
      },
    ],
  },
  {
    speaker: '???',
    speakerColor: '#f87171',
    segments: [
      {
        text: 'Si lo haces, te compensaré contándote un secreto muy importante.',
      },
    ],
  },
  {
    speaker: PROTAGONIST_NAME_FROM_NIGHT_3,
    speakerColor: '#fde047',
    segments: [
      {
        text: '¿Solo eso de compensación?',
      },
    ],
  },
  {
    speaker: '???',
    speakerColor: '#f87171',
    pauseBeforeShowMs: POST_NIGHT_3_PHONE_PAUSE_MS,
    segments: [
      {
        text: 'Y también te daré una compensación más grande de dinero.',
      },
    ],
  },
  {
    speaker: '???',
    speakerColor: '#f87171',
    segments: [
      {
        text: 'Pero es muy importante que lo hagas. ',
      },
      {
        text: 'Tu futuro puede llegar a depender de esto.',
        slowTremble: true,
      },
    ],
  },
  {
    speaker: PROTAGONIST_NAME_FROM_NIGHT_3,
    speakerColor: '#fde047',
    segments: [
      {
        text: 'De acuerdo, lo haré, pero no me pidas NADA MÁS. No lo hago por ti, lo hago por el dinero.',
      },
    ],
  },
  {
    speaker: '???',
    speakerColor: '#f87171',
    segments: [
      {
        text: '¡JAJAJA, ESO ES LO QUE QUERÍA OÍR! Que tengas buen turno esta noche, te llamaré allí.',
      },
    ],
  },
];

// ============================================================================
// NIGHT 4 PUZZLE: 3 OFFICE NOTES, CAM 05 CLOSET KEYPAD, 4 KEYS & 4 DOOR LOCKS
// ============================================================================

export type Night4KeyId = 1 | 2 | 3 | 4;

export interface Night4OfficeNote {
  order: 1 | 2 | 3;
  digit: string;
  locationDescription: string;
}

export const NIGHT_4_CLOSET_CODE = '472';

/**
 * Generates a pseudo-random 3-digit code ('000'..'999' with distinct digits so each note has a clear number)
 * for the Night 4 secret closet keypad.
 */
export function generateNight4SecretCode(rng: () => number = Math.random): string {
  const pool = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
  let code = '';
  for (let i = 0; i < 3; i++) {
    const idx = Math.max(0, Math.min(pool.length - 1, Math.floor(rng() * pool.length)));
    code += pool[idx];
    pool.splice(idx, 1);
  }
  return code;
}

export function getNight4OfficeNotes(
  secretCode = NIGHT_4_CLOSET_CODE
): readonly Night4OfficeNote[] {
  const safeCode = /^\d{3}$/.test(secretCode) ? secretCode : NIGHT_4_CLOSET_CODE;
  return [
    {
      order: 1,
      digit: safeCode[0],
      locationDescription:
        'Pared inferior izquierda al empezar a girar del centro hacia la izquierda',
    },
    {
      order: 2,
      digit: safeCode[1],
      locationDescription: 'A la derecha del conducto central de la oficina',
    },
    {
      order: 3,
      digit: safeCode[2],
      locationDescription:
        'En la pared lateral del pasillo derecho de la oficina al iluminar desde la puerta',
    },
  ];
}

export const NIGHT_4_OFFICE_NOTES: readonly Night4OfficeNote[] =
  getNight4OfficeNotes(NIGHT_4_CLOSET_CODE);

export const NIGHT_4_KEY_PICKUP_TEXT = 'llave recogida';

export interface Night4PuzzleState {
  active: boolean;
  secretCode: string;
  keypadInput: string;
  keypadError: boolean;
  closetUnlocked: boolean;
  closetOpenProgress: number; // 0 (closed closet) -> 1 (fully open revealing the hidden door)
  keyLocations: Record<Night4KeyId, NodeId>;
  keysCollected: Record<Night4KeyId, boolean>;
  locksUnlocked: Record<Night4KeyId, boolean>; // 1 (top) to 4 (bottom)
  hiddenDoorOpen: boolean;
  hiddenDoorOpenProgress: number; // 0 (closed) -> 1 (swung open revealing the written papers)
  papersCollected: boolean;
}

/**
 * Creates the initial Night 4 Puzzle state:
 * - Generates a pseudo-random 3-digit `secretCode` for the 3 office notes and CAM 05 keypad.
 * - Key 1 is always in CAM_4B (on the floor from 12:00 AM).
 * - Key 2 spawns at 2:00 AM in either CAM_1A or CAM_1B (semi-camouflaged).
 * - Key 3 spawns at 3:00 AM in CAM_3 (semi-camouflaged).
 * - Key 4 spawns at 4:30 AM (halfway between 4 AM and 5 AM) in either CAM_2A or CAM_2B (semi-camouflaged).
 */
export function createInitialNight4PuzzleState(
  isNight4: boolean,
  rollKey2 = Math.random(),
  rollKey4 = Math.random(),
  customCodeOrRng?: string | (() => number)
): Night4PuzzleState {
  const secretCode =
    typeof customCodeOrRng === 'string' && /^\d{3}$/.test(customCodeOrRng)
      ? customCodeOrRng
      : typeof customCodeOrRng === 'function'
      ? generateNight4SecretCode(customCodeOrRng)
      : generateNight4SecretCode();

  return {
    active: isNight4,
    secretCode,
    keypadInput: '',
    keypadError: false,
    closetUnlocked: false,
    closetOpenProgress: 0,
    keyLocations: {
      1: 'CAM_4B',
      2: rollKey2 < 0.5 ? 'CAM_1A' : 'CAM_1B',
      3: 'CAM_3',
      4: rollKey4 < 0.5 ? 'CAM_2A' : 'CAM_2B',
    },
    keysCollected: {
      1: false,
      2: false,
      3: false,
      4: false,
    },
    locksUnlocked: {
      1: false,
      2: false,
      3: false,
      4: false,
    },
    hiddenDoorOpen: false,
    hiddenDoorOpenProgress: 0,
    papersCollected: false,
  };
}

/**
 * Determines whether a specific key (1..4) has spawned based on elapsed night time:
 * - Key 1: 12:00 AM (0.0 hours -> >= 0s)
 * - Key 2: 2:00 AM (2.0 hours -> >= 2 * hourDurationSec)
 * - Key 3: 3:00 AM (3.0 hours -> >= 3 * hourDurationSec)
 * - Key 4: 4:30 AM (4.5 hours, halfway between 4 and 5 AM -> >= 4.5 * hourDurationSec)
 */
export function isNight4KeySpawned(
  keyId: Night4KeyId,
  elapsedNightSec: number,
  hourDurationSec = 51
): boolean {
  if (keyId === 1) return elapsedNightSec >= 0;
  if (keyId === 2) return elapsedNightSec >= 2 * hourDurationSec;
  if (keyId === 3) return elapsedNightSec >= 3 * hourDurationSec;
  if (keyId === 4) return elapsedNightSec >= 4.5 * hourDurationSec;
  return false;
}

/**
 * Returns the Night4KeyId visible in `cameraNode` at the current `elapsedNightSec`,
 * or null if no uncollected spawned key is in that camera.
 */
export function getVisibleNight4KeyOnCamera(
  puzzle: Night4PuzzleState,
  cameraNode: NodeId,
  elapsedNightSec: number,
  hourDurationSec = 51
): Night4KeyId | null {
  if (!puzzle.active) return null;
  const keyIds: Night4KeyId[] = [1, 2, 3, 4];
  for (const keyId of keyIds) {
    if (
      !puzzle.keysCollected[keyId] &&
      puzzle.keyLocations[keyId] === cameraNode &&
      isNight4KeySpawned(keyId, elapsedNightSec, hourDurationSec)
    ) {
      return keyId;
    }
  }
  return null;
}

/**
 * Collects a key on Night 4 when the player clicks it on the camera feed.
 */
export function collectNight4Key(
  puzzle: Night4PuzzleState,
  keyId: Night4KeyId
): Night4PuzzleState {
  if (!puzzle.active || puzzle.keysCollected[keyId]) return puzzle;
  return {
    ...puzzle,
    keysCollected: {
      ...puzzle.keysCollected,
      [keyId]: true,
    },
  };
}

/**
 * Appends a digit ('0'..'9') to the CAM 05 closet keypad.
 * When 3 digits are entered:
 * - If it matches `puzzle.secretCode`, `closetUnlocked` becomes true!
 * - Otherwise `keypadError` becomes true so the UI can shake/flash red and reset.
 */
export function enterNight4KeypadDigit(
  puzzle: Night4PuzzleState,
  digit: string
): {
  nextState: Night4PuzzleState;
  justUnlockedCloset: boolean;
  triggeredWrongCode: boolean;
} {
  if (!puzzle.active || puzzle.closetUnlocked) {
    return { nextState: puzzle, justUnlockedCloset: false, triggeredWrongCode: false };
  }
  const cleanDigit = digit.replace(/[^0-9]/g, '').slice(0, 1);
  if (!cleanDigit) {
    return { nextState: puzzle, justUnlockedCloset: false, triggeredWrongCode: false };
  }

  const baseInput = puzzle.keypadError || puzzle.keypadInput.length >= 3 ? '' : puzzle.keypadInput;
  const nextInput = `${baseInput}${cleanDigit}`;

  if (nextInput.length < 3) {
    return {
      nextState: {
        ...puzzle,
        keypadInput: nextInput,
        keypadError: false,
      },
      justUnlockedCloset: false,
      triggeredWrongCode: false,
    };
  }

  const targetCode = puzzle.secretCode || NIGHT_4_CLOSET_CODE;
  if (nextInput === targetCode) {
    return {
      nextState: {
        ...puzzle,
        keypadInput: nextInput,
        keypadError: false,
        closetUnlocked: true,
      },
      justUnlockedCloset: true,
      triggeredWrongCode: false,
    };
  }

  return {
    nextState: {
      ...puzzle,
      keypadInput: nextInput,
      keypadError: true,
    },
    justUnlockedCloset: false,
    triggeredWrongCode: true,
  };
}

/**
 * Returns the next lock (1..4 from top to bottom) that has not been unlocked yet, or null if all 4 are unlocked.
 */
export function getNextLockedNight4DoorLock(puzzle: Night4PuzzleState): Night4KeyId | null {
  const order: Night4KeyId[] = [1, 2, 3, 4];
  for (const id of order) {
    if (!puzzle.locksUnlocked[id]) return id;
  }
  return null;
}

/**
 * Attempts to unlock one of the 4 vertical locks (1 = top, 2 = second, 3 = third, 4 = bottom)
 * on the hidden door in CAM 05.
 * - Each lock `k` requires Key `k` AND must be unlocked in top-to-bottom sequence (1 -> 2 -> 3 -> 4).
 * - If the player clicks a lock that is not next in sequence, or doesn't have its associated key,
 *   or uses a mismatched selectedKey, the lock shakes side-to-side and the screen shakes slightly!
 * - If valid, the lock unlocks and falls down with the "heavy-door-lock-unlocking" sound.
 */
export function attemptUnlockNight4DoorLock(
  puzzle: Night4PuzzleState,
  lockId: Night4KeyId,
  selectedKeyId?: Night4KeyId | null
): {
  nextState: Night4PuzzleState;
  unlocked: boolean;
  triggerShake: boolean;
} {
  if (!puzzle.active || !puzzle.closetUnlocked || puzzle.locksUnlocked[lockId]) {
    return { nextState: puzzle, unlocked: false, triggerShake: false };
  }

  const nextExpectedLock = getNextLockedNight4DoorLock(puzzle);
  const hasAssociatedKey = puzzle.keysCollected[lockId];
  const keyMatches = selectedKeyId === undefined || selectedKeyId === null || selectedKeyId === lockId;

  if (lockId === nextExpectedLock && hasAssociatedKey && keyMatches) {
    return {
      nextState: {
        ...puzzle,
        locksUnlocked: {
          ...puzzle.locksUnlocked,
          [lockId]: true,
        },
      },
      unlocked: true,
      triggerShake: false,
    };
  }

  return {
    nextState: puzzle,
    unlocked: false,
    triggerShake: true,
  };
}

/**
 * Returns true when all 4 locks on the CAM 05 hidden door have been unlocked and fallen.
 */
export function areAllNight4LocksUnlocked(puzzle: Night4PuzzleState): boolean {
  return (
    puzzle.locksUnlocked[1] &&
    puzzle.locksUnlocked[2] &&
    puzzle.locksUnlocked[3] &&
    puzzle.locksUnlocked[4]
  );
}

/**
 * Opens the hidden door in CAM 05 when the player clicks the door handle (manillar) after all 4 locks have fallen.
 */
export function attemptOpenNight4HiddenDoor(puzzle: Night4PuzzleState): {
  nextState: Night4PuzzleState;
  opened: boolean;
  triggerShake: boolean;
} {
  if (!puzzle.active || !puzzle.closetUnlocked || puzzle.hiddenDoorOpen) {
    return { nextState: puzzle, opened: false, triggerShake: false };
  }
  if (!areAllNight4LocksUnlocked(puzzle)) {
    return { nextState: puzzle, opened: false, triggerShake: true };
  }
  return {
    nextState: {
      ...puzzle,
      hiddenDoorOpen: true,
    },
    opened: true,
    triggerShake: false,
  };
}

/**
 * Collects the secret written papers inside the open hidden door in CAM 05.
 */
export function collectNight4SecretPapers(puzzle: Night4PuzzleState): {
  nextState: Night4PuzzleState;
  collected: boolean;
} {
  if (!puzzle.active || !puzzle.hiddenDoorOpen || puzzle.papersCollected) {
    return { nextState: puzzle, collected: false };
  }
  return {
    nextState: {
      ...puzzle,
      papersCollected: true,
    },
    collected: true,
  };
}

// ============================================================================
// STORY MODE PART 5: POST-NIGHT 4 8-BIT MINIGAME (NIGHT 4 -> NIGHT 5 BRIDGE)
// ============================================================================

export type PostNight4MinigamePhase =
  | 'HOTEL_EXTERIOR_WALK'
  | 'HOTEL_EXTERIOR_ENTERING_FADE'
  | 'HOTEL_HALLWAY'
  | 'HOTEL_ELEVATOR_FADE'
  | 'HOTEL_RECEPTIONIST_DIALOGUE'
  | 'HOTEL_WRONG_ROOM_DIALOGUE'
  | 'HOTEL_ROOM_FREE_ROAM'
  | 'HOTEL_ROOM_BED_PROMPT'
  | 'HOTEL_ROOM_TURN_OFF_LIGHTS_WALK'
  | 'FP_SLEEP_BLINKING'
  | 'FP_RABBIT_JUMPSCARE'
  | 'FP_RABBIT_BLACKOUT'
  | 'CHAIR_TIED_LAUGH_INTRO'
  | 'CHAIR_TIED_INITIAL_DIALOGUE'
  | 'CHAIR_TIED_HAND_OVER_PROMPT'
  | 'CHAIR_TIED_HANDING_OVER_ANIM'
  | 'CHAIR_TIED_POST_HANDOVER_DIALOGUE'
  | 'FP_THE_THING_APPROACH_REVEAL'
  | 'FP_TAPE_RIP_AND_DIALOGUE'
  | 'FP_STILL_FREDDY_EMERGE_PAUSE'
  | 'FP_FINAL_GOOD_LUCK_DIALOGUE'
  | 'FINAL_FADE_TO_NIGHT_5'
  | 'NO_DOCS_FLOOR_STAND_UP'
  | 'NO_DOCS_FLOOR_CONFUSED_DIALOGUE'
  | 'NO_DOCS_SHADOW_VOICE_DIALOGUE'
  | 'NO_DOCS_FP_THE_THING_REVEAL'
  | 'NO_DOCS_FP_LAUGH_AND_BROTHER_DIALOGUE'
  | 'NO_DOCS_FP_STILL_FREDDY_EMERGE_PAUSE'
  | 'NO_DOCS_FP_PAY_FAILURES_DIALOGUE'
  | 'NO_DOCS_FP_LUNGE_ATTACK'
  | 'NO_DOCS_FP_CIRCLE_QTE'
  | 'NO_DOCS_FP_KICK_IMPACT'
  | 'NO_DOCS_FADE_OUT_SCREAM_DIALOGUE'
  | 'NO_DOCS_FP_FAIL_JUMPSCARE'
  | 'NO_DOCS_BAD_ENDING_STILL_NOTHING'
  | 'NO_DOCS_BAD_ENDING_FADE_OUT'
  | 'COMPLETED';

export function shouldTriggerPostNight4Minigame(completedNight: number): boolean {
  return completedNight === 4;
}

// Bed sleep sequence: 0.5s black after lying down -> open eyes (0.4s) -> 1.0s open -> blink 1 (0.5s) -> 1.0s open -> blink 2 (0.5s) -> 1.0s open -> blink 3 (0.55s) where Dark Rabbit appears and jumpscares!
export const POST_NIGHT_4_BLINK_INITIAL_BLACK_SEC = 0.5;
export const POST_NIGHT_4_BLINK_OPEN_HOLD_SEC = 1.0;
export const POST_NIGHT_4_BLINK_TOTAL_DURATION_SEC = 5.45;

// Synced to Jumpscare_dark_rabbit_final_c46aea63.mp3 (~3.10s):
// - Distortion effect starts at 2.0s ("el efecto de distorsion debe empezar en el segundo 2")
// - Fade to black starts at 2.5s ("y el fundido a negro en el 2 y medio de jumpscare")
export const POST_NIGHT_4_RABBIT_DISTORTION_START_SEC = 2.0;
export const POST_NIGHT_4_RABBIT_FADE_START_SEC = 2.5;
export const POST_NIGHT_4_RABBIT_JUMPSCARE_DURATION_SEC = 3.1;
export const POST_NIGHT_4_CHAIR_LAUGH_INTRO_DURATION_SEC = 1.6;
export const POST_NIGHT_4_HAND_OVER_ANIM_DURATION_SEC = 1.0;
export const POST_NIGHT_4_THE_THING_APPROACH_DURATION_SEC = 2.6;
export const POST_NIGHT_4_FREDDY_EMERGE_DURATION_SEC = 1.2;
export const POST_NIGHT_4_FREDDY_POST_EMERGE_PAUSE_SEC = 1.0;

export interface PostNight4BlinkState {
  blinkNumber: 1 | 2 | 3;
  eyelidClosure: number; // 0 = wide open, 1 = completely closed/black
  showDarkRabbit: boolean; // True on the 3rd blink when the eyelids reopen
  completed: boolean;
}

/**
 * Computes the pre-sleep first-person bed sequence:
 * - `0.00s..0.50s`: Screen stays in blackout (`eyelidClosure = 1.0`) for half a second after lying down.
 * - `0.50s..0.90s`: Starts opening eyes (`eyelidClosure` `1.0 -> 0.0`).
 * - `0.90s..1.90s`: Stays 1 full second with eyes open (`eyelidClosure = 0.0`), then does Blink 1 (`1.90s..2.40s`).
 * - `2.40s..3.40s`: Stays 1 full second with eyes open (`eyelidClosure = 0.0`), then does Blink 2 (`3.40s..3.90s`).
 * - `3.90s..4.90s`: Stays 1 full second with eyes open (`eyelidClosure = 0.0`), then does Blink 3 (`4.90s..5.45s`)
 *   where Dark Rabbit appears at the foot of the bed and immediately triggers his jumpscare!
 */
export function getPostNight4BlinkState(elapsedSec: number): PostNight4BlinkState {
  const t = Math.max(0, Math.min(POST_NIGHT_4_BLINK_TOTAL_DURATION_SEC, elapsedSec));

  // 1. 0.00s..0.50s: Initial half-second blackout after lying down in bed
  if (t < POST_NIGHT_4_BLINK_INITIAL_BLACK_SEC) {
    return {
      blinkNumber: 1,
      eyelidClosure: 1.0,
      showDarkRabbit: false,
      completed: false,
    };
  }

  // 2. 0.50s..0.90s: Opening eyes for the first time
  if (t < 0.90) {
    const p = (t - 0.50) / 0.40;
    const closure = 1.0 - Math.sin(p * (Math.PI / 2));
    return {
      blinkNumber: 1,
      eyelidClosure: Math.max(0, Math.min(1, closure)),
      showDarkRabbit: false,
      completed: false,
    };
  }

  // 3. 0.90s..1.90s: Hold eyes wide open for 1.0 second before Blink 1
  if (t < 1.90) {
    return {
      blinkNumber: 1,
      eyelidClosure: 0,
      showDarkRabbit: false,
      completed: false,
    };
  }

  // 4. 1.90s..2.40s: Blink 1 (close 0.25s, open 0.25s)
  if (t < 2.40) {
    const p = (t - 1.90) / 0.50;
    const closure = Math.sin(p * Math.PI);
    return {
      blinkNumber: 1,
      eyelidClosure: Math.max(0, Math.min(1, closure)),
      showDarkRabbit: false,
      completed: false,
    };
  }

  // 5. 2.40s..3.40s: Hold eyes wide open for 1.0 second before Blink 2
  if (t < 3.40) {
    return {
      blinkNumber: 2,
      eyelidClosure: 0,
      showDarkRabbit: false,
      completed: false,
    };
  }

  // 6. 3.40s..3.90s: Blink 2 (close 0.25s, open 0.25s)
  if (t < 3.90) {
    const p = (t - 3.40) / 0.50;
    const closure = Math.sin(p * Math.PI);
    return {
      blinkNumber: 2,
      eyelidClosure: Math.max(0, Math.min(1, closure)),
      showDarkRabbit: false,
      completed: false,
    };
  }

  // 7. 3.90s..4.90s: Hold eyes wide open for 1.0 second before Blink 3
  if (t < 4.90) {
    return {
      blinkNumber: 3,
      eyelidClosure: 0,
      showDarkRabbit: false,
      completed: false,
    };
  }

  // 8. 4.90s..5.45s: Blink 3 — eyelids shut, Dark Rabbit appears at foot of bed, eyes snap open -> jumpscare!
  const p = (t - 4.90) / 0.55;
  let closure: number;
  let showDarkRabbit = false;

  if (p < 0.42) {
    // Closing into the 3rd blink
    closure = Math.sin((p / 0.42) * (Math.PI / 2));
    showDarkRabbit = false;
  } else if (p < 0.56) {
    // Eyes fully shut at the bottom of the 3rd blink — Dark Rabbit materializes!
    closure = 1.0;
    showDarkRabbit = true;
  } else {
    // Eyes snap open on the 3rd blink revealing Dark Rabbit right in front of Richard!
    const openP = (p - 0.56) / 0.44;
    closure = Math.max(0, 1.0 - Math.sin(openP * (Math.PI / 2)));
    showDarkRabbit = true;
  }

  return {
    blinkNumber: 3,
    eyelidClosure: Math.max(0, Math.min(1, closure)),
    showDarkRabbit,
    completed: elapsedSec >= POST_NIGHT_4_BLINK_TOTAL_DURATION_SEC,
  };
}

export interface PostNight4RabbitJumpscareState {
  stage: 'COIL_AT_BED_FOOT' | 'LEAP_ACROSS_BED' | 'MAUL_AND_SCREECH_CLIMAX';
  progress: number; // 0..1 across full 3.10s audio
  lungeProgress: number; // 0 at foot of bed -> 1 point-blank in Richard's face
  scale: number; // Continuous scale from 1.0x at foot of bed -> 4.25x point-blank
  arcOffsetY: number; // Parabolic vertical crouch & leap trajectory across the bed
  jawOpenProgress: number; // 0 (closed silhouette) -> 1 (unhinged screaming maw)
  clawGrabProgress: number; // 0 (arms at sides) -> 1 (claws lunging forward grabbing camera)
  headTiltDeg: number; // Predatory head tilt & Dutch-angle distortion tilt
  shakeAmplitude: number; // Camera impact & distortion shake intensity
  distortionActive: boolean; // True starting at 2.0s
  blackoutAlpha: number; // 0 until 2.5s, then fades 0 -> 1 between 2.5s and 3.05s
  completed: boolean;
}

/**
 * Computes the fast, super-detailed Dark Rabbit jumpscare in Room 303 synced to
 * `Jumpscare_dark_rabbit_final_c46aea63.mp3` (3.10s):
 * - Stage 1 (`COIL_AT_BED_FOOT`, 0.00s..0.08s): Instant spring crouch behind the footboard.
 * - Stage 2 (`LEAP_ACROSS_BED`, 0.08s..0.28s): Explosive 0.20s leap across the bed straight into Richard's face.
 * - Stage 3 (`MAUL_AND_SCREECH_CLIMAX`, 0.28s..3.10s): Point-blank mauling in Richard's face:
 *   - At `t = 2.00s` (`POST_NIGHT_4_RABBIT_DISTORTION_START_SEC`), the heavy final distortion effect starts
 *     (matching the user's 2nd reference screenshot with Dutch-angle head tilt, intense shake & VHS tear bars).
 *   - At `t = 2.50s` (`POST_NIGHT_4_RABBIT_FADE_START_SEC`), the fade-to-black begins over the distorted climax
 *     without ever resetting or looping the jump animation!
 */
export function getPostNight4RabbitJumpscareState(
  elapsedSec: number
): PostNight4RabbitJumpscareState {
  const t = Math.max(0, Math.min(POST_NIGHT_4_RABBIT_JUMPSCARE_DURATION_SEC, elapsedSec));
  const progress = t / POST_NIGHT_4_RABBIT_JUMPSCARE_DURATION_SEC;

  if (t < 0.08) {
    // Stage 1: Instant 0.08s coil outside the foot of the bed before vaulting
    const p = t / 0.08;
    const smoothP = p * p * (3 - 2 * p);
    return {
      stage: 'COIL_AT_BED_FOOT',
      progress,
      lungeProgress: smoothP * 0.18,
      scale: 1.0 + smoothP * 0.28,
      arcOffsetY: Math.round(smoothP * 32),
      jawOpenProgress: smoothP * 0.45,
      clawGrabProgress: smoothP * 0.42,
      headTiltDeg: Math.sin(t * 45) * (6 + smoothP * 8),
      shakeAmplitude: 5 + smoothP * 8,
      distortionActive: false,
      blackoutAlpha: 0,
      completed: false,
    };
  }

  if (t < 0.28) {
    // Stage 2: Super-fast 0.20s explosive leap across the bed into Richard's face (0.08s..0.28s)
    const p = (t - 0.08) / 0.20;
    const accelP = Math.pow(p, 1.12);
    const leapArc = (1 - p) * 32 - Math.sin(p * Math.PI) * 64 + p * 8;
    return {
      stage: 'LEAP_ACROSS_BED',
      progress,
      lungeProgress: 0.18 + accelP * 0.74,
      scale: 1.28 + accelP * 1.82, // 1.28x -> 3.10x in just 0.20s!
      arcOffsetY: Math.round(leapArc),
      jawOpenProgress: 0.45 + accelP * 0.50,
      clawGrabProgress: Math.min(1, 0.42 + p * 0.58),
      headTiltDeg: Math.sin(t * 50) * (12 + p * 8),
      shakeAmplitude: 13 + accelP * 12,
      distortionActive: false,
      blackoutAlpha: 0,
      completed: false,
    };
  }

  // Stage 3: Point-blank mauling (0.28s..2.00s), heavy distortion at 2.00s, and fade-to-black at 2.50s..3.10s!
  const p = (t - 0.28) / (POST_NIGHT_4_RABBIT_JUMPSCARE_DURATION_SEC - 0.28);
  const distortionActive = t >= POST_NIGHT_4_RABBIT_DISTORTION_START_SEC;
  const blackoutAlpha =
    t < POST_NIGHT_4_RABBIT_FADE_START_SEC
      ? 0
      : Math.min(1, (t - POST_NIGHT_4_RABBIT_FADE_START_SEC) / 0.52);

  const bassBoost = distortionActive ? 1.0 : 0.42;
  const jawSnapWave = distortionActive
    ? 0.92 + Math.abs(Math.sin(t * 36)) * 0.08
    : 0.78 + Math.abs(Math.sin(t * 30)) * 0.22;

  // During the >= 2.0s distortion climax, lock into the menacing tilted Dutch-angle frame (like image_559a082b.png) with high-frequency jitter
  const headTiltDeg = distortionActive
    ? 17 + Math.sin(t * 65) * 4.5
    : Math.sin(t * 38) * 14;

  return {
    stage: 'MAUL_AND_SCREECH_CLIMAX',
    progress,
    lungeProgress: Math.min(1, 0.92 + p * 0.08),
    scale: 3.1 + Math.pow(p, 0.9) * 1.15, // 3.10x -> 4.25x engulfing the screen
    arcOffsetY: Math.round(8 + Math.cos(t * 48) * (10 + bassBoost * 10)),
    jawOpenProgress: jawSnapWave,
    clawGrabProgress: 1.0,
    headTiltDeg,
    shakeAmplitude: 20 + bassBoost * 16,
    distortionActive,
    blackoutAlpha,
    completed: elapsedSec >= POST_NIGHT_4_RABBIT_JUMPSCARE_DURATION_SEC,
  };
}

export const POST_NIGHT_4_CHAIR_INITIAL_DIALOGUE: PostNight1DialogueTab = {
  speaker: '???',
  speakerColor: '#f87171',
  segments: [
    {
      text: 'Vaya, vaya, vaya, debo reconocer que no esperaba que fueras a llegar tan lejos, pero veo que has recuperado mis documentos, dámelos.',
    },
  ],
};

export const POST_NIGHT_4_HAND_OVER_PROMPT_TEXT = 'Pulsa E para entregarle los documentos';

export const POST_NIGHT_4_CHAIR_POST_HANDOVER_DIALOGUE: PostNight1DialogueTab = {
  speaker: '???',
  speakerColor: '#f87171',
  segments: [
    {
      text: 'Bien, bien, veo que ya va siendo hora de que te lo cuente.',
    },
  ],
};

export const POST_NIGHT_4_THE_THING_REVEAL_TABS: readonly PostNight1DialogueTab[] = [
  {
    speaker: '???',
    speakerColor: '#f87171',
    segments: [
      {
        text: 'Bien, bien, ¿y qué te parece mi aspecto?',
      },
    ],
  },
  {
    speaker: PROTAGONIST_NAME_FROM_NIGHT_3,
    speakerColor: '#fde047',
    segments: [
      {
        text: 'Tú, tú, desgraciado, me has arruinado la vida... ¿Qué, qué, qué se supone que eres, eh? ¿Un matojo de cables mugrientos?',
      },
    ],
  },
  {
    speaker: 'THE THING',
    speakerColor: '#f87171',
    segments: [
      {
        text: 'Yo, soy, ',
      },
      {
        text: 'SOMOS, THE THING',
        glitchText: true,
        slightTremble: true,
      },
      {
        text: ', y llevábamos mucho tiempo queriendo recuperar esto.',
      },
    ],
  },
  {
    speaker: 'THE THING',
    speakerColor: '#f87171',
    segments: [
      {
        text: 'Estos papeles son ',
      },
      {
        text: 'mi billete / nuestro billete',
        glitchText: true,
      },
      {
        text: ' a la libertad.',
      },
    ],
  },
  {
    speaker: 'THE THING',
    speakerColor: '#f87171',
    segments: [
      {
        text: 'Como has hecho un trabajo excelente, jugaremos a algo: si sobrevives esta noche, te dejaré huir, pero si pierdes, serás una gran adición a mi familia.',
      },
    ],
  },
  {
    speaker: 'THE THING',
    speakerColor: '#f87171',
    segments: [
      {
        text: '¿Verdad que sí, hermano?',
      },
    ],
  },
];

/**
 * Keeps the speaker name as `'???'` until the exact moment in Tab 2 where he says
 * `"Yo, soy, SOMOS, THE THING"` (when `typedChars` reaches `"SOMOS, THE THING"` at index 9),
 * preserving the mystery up to the reveal!
 */
export function getPostNight4RevealSpeakerName(tabIndex: number, typedChars: number): string {
  const tab = POST_NIGHT_4_THE_THING_REVEAL_TABS[tabIndex];
  if (!tab) return '???';
  if (tabIndex === 0) return '???';
  if (tabIndex === 2 && typedChars < 9) {
    return '???';
  }
  return tab.speaker;
}

export const POST_NIGHT_4_FINAL_GOOD_LUCK_TAB: PostNight1DialogueTab = {
  speaker: 'THE THING',
  speakerColor: '#f87171',
  segments: [
    {
      text: 'Qué ganas tengo de jugar, ',
    },
    {
      text: 'QUE TENGAS MUUUCHA SUERTEE..............',
      slightTremble: true,
      fadingText: true,
    },
  ],
};

// ============================================================================
// POST-NIGHT 4 ROUTE B: COMPLETED NIGHT 4 WITHOUT COLLECTING THE DOCUMENTS
// ("Vale, ahora vamos a explorar el segundo final que es si te pasas la noche 4 sin haber recogido los documentos...")
// ============================================================================

export const POST_NIGHT_4_FLOOR_STAND_UP_DURATION_SEC = 2.4;
export const POST_NIGHT_4_NO_DOCS_LUNGE_DURATION_SEC = 0.55;
export const POST_NIGHT_4_CIRCLE_QTE_REQUIRED_HITS = 3;
export const POST_NIGHT_4_CIRCLE_QTE_ROUND_DURATION_SEC = 1.45;
export const POST_NIGHT_4_CIRCLE_QTE_START_SCALE = 2.35;
export const POST_NIGHT_4_CIRCLE_QTE_END_SCALE = 0.55;
export const POST_NIGHT_4_CIRCLE_QTE_MIN_HIT_SCALE = 0.70;
export const POST_NIGHT_4_CIRCLE_QTE_MAX_HIT_SCALE = 1.35;

export interface PostNight4FloorStandUpState {
  stage: 'LYING_DAZED' | 'KNEELING_CONFUSED' | 'STANDING_UP' | 'STANDING_CONFUSED';
  standProgress: number; // 0 = flat on floor, 1 = completely standing up
  headLookDir: -1 | 1;
  showConfusionMarks: boolean;
  completed: boolean;
}

/**
 * Computes Richard's confused wake-up & stand-up animation on the floor of the even darker room
 * ("Richard aparece en una sala aun mas oscura (con una tenue luz en el techo) en el suelo,
 * y con una animacion de confundido debe levantarse, y cuando este completamente de pie debe decir
 * 'Donde- donde estoy'").
 */
export function getPostNight4FloorStandUpState(
  elapsedSec: number
): PostNight4FloorStandUpState {
  const t = Math.max(0, elapsedSec);

  if (t < 0.75) {
    return {
      stage: 'LYING_DAZED',
      standProgress: 0,
      headLookDir: Math.floor(t * 4) % 2 === 0 ? 1 : -1,
      showConfusionMarks: true,
      completed: false,
    };
  }

  if (t < 1.55) {
    const p = (t - 0.75) / 0.80;
    const smooth = p * p * (3 - 2 * p);
    return {
      stage: 'KNEELING_CONFUSED',
      standProgress: smooth * 0.5,
      headLookDir: Math.floor(t * 3.5) % 2 === 0 ? -1 : 1,
      showConfusionMarks: true,
      completed: false,
    };
  }

  if (t < POST_NIGHT_4_FLOOR_STAND_UP_DURATION_SEC) {
    const p = (t - 1.55) / (POST_NIGHT_4_FLOOR_STAND_UP_DURATION_SEC - 1.55);
    const smooth = p * p * (3 - 2 * p);
    return {
      stage: 'STANDING_UP',
      standProgress: 0.5 + smooth * 0.5,
      headLookDir: p < 0.5 ? -1 : 1,
      showConfusionMarks: true,
      completed: false,
    };
  }

  return {
    stage: 'STANDING_CONFUSED',
    standProgress: 1.0,
    headLookDir: Math.floor(t * 2.5) % 2 === 0 ? -1 : 1,
    showConfusionMarks: true,
    completed: true,
  };
}

export const POST_NIGHT_4_NO_DOCS_CONFUSED_TAB: PostNight1DialogueTab = {
  speaker: PROTAGONIST_NAME_FROM_NIGHT_3,
  speakerColor: '#fde047',
  segments: [
    {
      text: '¿Dónde- dónde estoy?',
    },
  ],
};

export const POST_NIGHT_4_NO_DOCS_SHADOW_TABS: readonly PostNight1DialogueTab[] = [
  {
    speaker: '???',
    speakerColor: '#f87171',
    segments: [
      {
        text: 'Vaya, vaya, me sorprende que hayas llegado tan lejos.',
      },
    ],
  },
  {
    speaker: '???',
    speakerColor: '#f87171',
    segments: [
      {
        text: 'Pero me has ',
      },
      {
        text: 'FALLADO',
        slowTremble: true,
      },
      {
        text: ' y yo, no soporto los fracasos.',
      },
    ],
  },
];

export const POST_NIGHT_4_NO_DOCS_BROTHER_TABS: readonly PostNight1DialogueTab[] = [
  {
    speaker: '???',
    speakerColor: '#f87171',
    segments: [
      {
        text: 'Bueno, bueno, ¿qué te parece?',
      },
    ],
  },
  {
    speaker: '???',
    speakerColor: '#f87171',
    segments: [
      {
        text: 'Ha costado mucho tiempo llegar hasta aquí, ¿verdad, hermano?',
      },
    ],
  },
];

export const POST_NIGHT_4_NO_DOCS_PAY_FAILURES_TAB: PostNight1DialogueTab = {
  speaker: 'THE THING',
  speakerColor: '#f87171',
  segments: [
    {
      text: 'Pagarás por tus fracasos.',
      slightTremble: true,
    },
  ],
};

export const POST_NIGHT_4_NO_DOCS_FINAL_SCREAM_TAB: PostNight1DialogueTab = {
  speaker: 'THE THING',
  speakerColor: '#f87171',
  segments: [
    {
      text: '¡PAGARÁS POR ',
    },
    {
      text: 'TOOOOOOOOOOOODO!',
      slowTremble: true,
    },
  ],
};

export interface PostNight4CircleQteState {
  ringScale: number; // Starts at 2.35 and shrinks down to 0.55
  isInHitZone: boolean; // True when ringScale is aligned with the [E] circle (0.70..1.35)
  missedByTimeout: boolean; // True when ringScale shrinks past the inner hit zone (< 0.68) without pressing E
}

/**
 * Computes the shrinking circle state for the No-Documents QTE:
 * - Outer circle starts at `ringScale = 2.35` and closes inward toward the `[E]` circle (`scale = 1.0`).
 * - When `ringScale` is within `[0.70, 1.35]`, pressing `[E]` succeeds!
 * - If the player lets the circle close past `0.68` without pressing `[E]`, it triggers a miss -> Bad Ending.
 */
export function getPostNight4CircleQteState(
  roundElapsedSec: number
): PostNight4CircleQteState {
  const clampedT = Math.max(
    0,
    Math.min(POST_NIGHT_4_CIRCLE_QTE_ROUND_DURATION_SEC, roundElapsedSec)
  );
  const progress = clampedT / POST_NIGHT_4_CIRCLE_QTE_ROUND_DURATION_SEC;
  const ringScale =
    POST_NIGHT_4_CIRCLE_QTE_START_SCALE -
    progress * (POST_NIGHT_4_CIRCLE_QTE_START_SCALE - POST_NIGHT_4_CIRCLE_QTE_END_SCALE);

  const isInHitZone =
    ringScale >= POST_NIGHT_4_CIRCLE_QTE_MIN_HIT_SCALE &&
    ringScale <= POST_NIGHT_4_CIRCLE_QTE_MAX_HIT_SCALE;

  const missedByTimeout = ringScale < POST_NIGHT_4_CIRCLE_QTE_MIN_HIT_SCALE - 0.02;

  return {
    ringScale: Number(ringScale.toFixed(3)),
    isInHitZone,
    missedByTimeout,
  };
}

/**
 * Evaluates whether pressing `[E]` at the given `ringScale` hits or misses the target `[E]` circle.
 */
export function evaluatePostNight4CircleQtePress(
  ringScale: number
): 'HIT' | 'MISS' {
  if (
    ringScale >= POST_NIGHT_4_CIRCLE_QTE_MIN_HIT_SCALE &&
    ringScale <= POST_NIGHT_4_CIRCLE_QTE_MAX_HIT_SCALE
  ) {
    return 'HIT';
  }
  return 'MISS';
}

// ============================================================================
// POST-NIGHT 5 ENDING 1 (ROUTE: ANSWERED PHONE IN NIGHT 3->4 + COLLECTED DOCS IN NIGHT 4)
// ============================================================================

export type PostNight5EndingPhase =
  | 'FP_OFFICE_REWARD_VOICE'
  | 'FADE_OFFICE_TO_CLOSET'
  | 'FP_CLOSET_LOOK_AROUND_AND_OPEN'
  | 'FP_GRABBED_FROM_BEHIND'
  | 'FP_SPIN_AROUND_TO_FACE'
  | 'FP_QTE_RESIST_AND_KICK'
  | 'FP_QTE_SUCCESS_KICK_IMPACT'
  | 'FP_QTE_FAIL_JUMPSCARE'
  | 'BAD_ENDING_STILL_NOTHING'
  | 'BAD_ENDING_FADE_OUT'
  | 'FP_FLEE_CUT_1_GRAB_MONEY'
  | 'FP_FLEE_CUT_2_HALL_SCREAM_1'
  | 'FP_FLEE_CUT_3_HALL_SCREAM_2'
  | 'FP_FLEE_CUT_4_EXIT_SCREAM_3'
  | 'FADE_TO_BANK_EXTERIOR'
  | 'BANK_EXTERIOR_WALK'
  | 'FADE_TO_BANK_INTERIOR'
  | 'BANK_INTERIOR_WALK'
  | 'BANK_RECEPTIONIST_CHOICE'
  | 'BANK_NO_CONSTRUCTION_MODAL'
  | 'GOOD_ENDING_FADE_TO_MENU'
  // Route 2 (No-Documents Post-Night 5 Ending):
  | 'NO_DOCS_FP_LEFT_HALL_AND_TURN'
  | 'NO_DOCS_FP_RUN_1_OFFICE'
  | 'NO_DOCS_FP_RUN_2_CORRIDOR'
  | 'NO_DOCS_FP_RUN_3_CORRIDOR'
  | 'NO_DOCS_FP_RUN_4_SISTER'
  | 'NO_DOCS_FP_BRAKE_AT_EXIT'
  | 'NO_DOCS_FP_TURN_TO_THING'
  | 'NO_DOCS_FP_THING_OFFER_MONEY'
  | 'NO_DOCS_FADE_TO_CAM05'
  | 'NO_DOCS_FP_REACH_FOR_MONEY'
  | 'NO_DOCS_FP_IMPALED_BY_CLAW'
  | 'NO_DOCS_FP_THROWN_TO_FLOOR'
  | 'NO_DOCS_FP_DYING_AUTOMATIC_DIALOGUE'
  | 'NO_DOCS_FP_SLOW_DEATH_BLINK';

export function shouldTriggerPostNight5Ending(
  completedNightNumber: number,
  answeredPhoneInNight3Interlude = true,
  collectedPapersInNight4 = true
): boolean {
  return (
    completedNightNumber === 5 &&
    answeredPhoneInNight3Interlude &&
    collectedPapersInNight4
  );
}

export function shouldTriggerPostNight5NoDocsEnding(
  completedNightNumber: number,
  collectedPapersInNight4 = false
): boolean {
  return completedNightNumber === 5 && !collectedPapersInNight4;
}

export const POST_NIGHT_5_OFFICE_REWARD_TAB: PostNight1DialogueTab = {
  speaker: 'THE THING',
  speakerColor: '#f87171',
  segments: [
    {
      text: 'Bien hecho, tú ganas, ven al almacén para recoger tu ',
    },
    {
      text: 'RECOMPENSA',
      slowTremble: true,
    },
  ],
};

export const POST_NIGHT_5_GRAB_REWARD_TAB: PostNight1DialogueTab = {
  speaker: 'THE THING',
  speakerColor: '#f87171',
  segments: [
    {
      text: '¡AQUÍ ESTÁ TU RECOMPENSA!',
      slowTremble: true,
    },
  ],
};

export const POST_NIGHT_5_FLEE_SCREAM_TABS: readonly PostNight1DialogueTab[] = [
  {
    speaker: 'THE THING',
    speakerColor: '#f87171',
    segments: [
      {
        text: '¡NOOOOOOOO!',
        slowTremble: true,
      },
    ],
  },
  {
    speaker: 'THE THING',
    speakerColor: '#f87171',
    segments: [
      {
        text: '¡Todo es culpa tuya!',
        slightTremble: true,
      },
    ],
  },
  {
    speaker: 'THE THING',
    speakerColor: '#f87171',
    segments: [
      {
        text: '¡Volveremos a encontrarnos!',
        slightTremble: true,
      },
    ],
  },
];

export const POST_NIGHT_5_BANK_DONATE_TAB: PostNight1DialogueTab = {
  speaker: 'RECEPCIONISTA DEL BANCO',
  speakerColor: '#38bdf8',
  segments: [
    {
      text: '¿QUIERES DONAR EL DINERO PARA EL TRATAMIENTO DE TU HERMANA?',
    },
  ],
};

export const POST_NIGHT_5_BANK_NO_CONSTRUCTION_TAB: PostNight1DialogueTab = {
  speaker: 'SISTEMA',
  speakerColor: '#fbbf24',
  segments: [
    {
      text: 'No puedes hacer eso aún (ruta en construcción para otro final).',
    },
  ],
};

export const POST_NIGHT_5_QTE_DURATION_SEC = 3.0;
export const POST_NIGHT_5_QTE_REQUIRED_PRESSES = 3;
export const BAD_ENDING_TITLE_DELAY_SEC = 2.0;
export const BAD_ENDING_TITLE_FADE_DURATION_SEC = 2.2;

export interface PostNight5ClosetLookState {
  cameraYaw: number; // -1 = looking deep left down hallway, 0 = centered on half-open CAM 05 door, +1 = looking deep right
  doorOpenProgress: number; // 0 = half-open, 1 = pushed wide open as Richard leans in to enter
  approachProgress: number; // 0 = standing close to CAM 05 door, 1 = stepping right into the doorway threshold
  stepLabel:
    | 'STOP_AT_DOOR'
    | 'LOOK_LEFT'
    | 'WAIT_ONE_SEC'
    | 'LOOK_RIGHT'
    | 'WAIT_RIGHT_ONE_SEC'
    | 'RETURN_CENTER'
    | 'OPENING_DOOR'
    | 'ABOUT_TO_ENTER';
  completed: boolean;
}

/**
 * Computes the first-person camera look-left -> wait 1s -> look-right -> wait 1s -> return center -> open CAM 05 door
 * animation timeline before The Thing grabs Richard from behind:
 * - 0.00s .. 0.65s: Protagonist stops close to the half-open CAM 05 door (yaw = 0)
 * - 0.65s .. 1.35s: Turns head deep to the left side (yaw: 0 -> -1)
 * - 1.35s .. 2.35s: Waits 1.0 full second looking down the left side (yaw = -1)
 * - 2.35s .. 3.25s: Turns head across to look deep to the right side (yaw: -1 -> +1)
 * - 3.25s .. 4.25s: Waits 1.0 full second looking down the right side (yaw = +1, symmetric with left!)
 * - 4.25s .. 4.90s: Turns head back to center on the CAM 05 door (yaw: +1 -> 0)
 * - 4.90s .. 6.10s: Steps even closer, reaches out with his detailed hand, and pushes the CAM 05 door open
 */
export function getPostNight5ClosetLookState(elapsedSec: number): PostNight5ClosetLookState {
  const t = Math.max(0, elapsedSec);
  if (t < 0.65) {
    const p = t / 0.65;
    const smooth = p * p * (3 - 2 * p);
    return {
      cameraYaw: 0,
      doorOpenProgress: 0,
      approachProgress: smooth * 0.35,
      stepLabel: 'STOP_AT_DOOR',
      completed: false,
    };
  }
  if (t < 1.35) {
    const p = (t - 0.65) / 0.7;
    const smooth = p * p * (3 - 2 * p);
    return {
      cameraYaw: -smooth,
      doorOpenProgress: 0,
      approachProgress: 0.35,
      stepLabel: 'LOOK_LEFT',
      completed: false,
    };
  }
  if (t < 2.35) {
    return {
      cameraYaw: -1,
      doorOpenProgress: 0,
      approachProgress: 0.35,
      stepLabel: 'WAIT_ONE_SEC',
      completed: false,
    };
  }
  if (t < 3.25) {
    const p = (t - 2.35) / 0.9;
    const smooth = p * p * (3 - 2 * p);
    return {
      cameraYaw: -1 + smooth * 2,
      doorOpenProgress: 0,
      approachProgress: 0.35,
      stepLabel: 'LOOK_RIGHT',
      completed: false,
    };
  }
  if (t < 4.25) {
    return {
      cameraYaw: 1,
      doorOpenProgress: 0,
      approachProgress: 0.35,
      stepLabel: 'WAIT_RIGHT_ONE_SEC',
      completed: false,
    };
  }
  if (t < 4.90) {
    const p = (t - 4.25) / 0.65;
    const smooth = p * p * (3 - 2 * p);
    return {
      cameraYaw: 1 - smooth,
      doorOpenProgress: 0,
      approachProgress: 0.35 + smooth * 0.15,
      stepLabel: 'RETURN_CENTER',
      completed: false,
    };
  }
  if (t < 6.10) {
    const p = Math.min(1, (t - 4.90) / 1.2);
    const smooth = p * p * (3 - 2 * p);
    return {
      cameraYaw: 0,
      doorOpenProgress: smooth,
      approachProgress: 0.5 + smooth * 0.5,
      stepLabel: 'OPENING_DOOR',
      completed: false,
    };
  }
  return {
    cameraYaw: 0,
    doorOpenProgress: 1,
    approachProgress: 1,
    stepLabel: 'ABOUT_TO_ENTER',
    completed: true,
  };
}

export const BANK_EXTERIOR_MIN_X = 70;
export const BANK_EXTERIOR_MAX_X = 890;
export const BANK_EXTERIOR_START_X = 160;
export const BANK_EXTERIOR_DOOR_X = 640;
export const BANK_EXTERIOR_DOOR_INTERACT_RADIUS = 85;

export const BANK_INTERIOR_MIN_X = 80;
export const BANK_INTERIOR_MAX_X = 860;
export const BANK_INTERIOR_START_X = 150;
export const BANK_RECEPTIONIST_X = 670;
export const BANK_RECEPTIONIST_INTERACT_RADIUS = 95;

export function isNearBankExteriorDoor(playerX: number): boolean {
  return Math.abs(playerX - BANK_EXTERIOR_DOOR_X) <= BANK_EXTERIOR_DOOR_INTERACT_RADIUS;
}

export function isNearBankReceptionist(playerX: number): boolean {
  return Math.abs(playerX - BANK_RECEPTIONIST_X) <= BANK_RECEPTIONIST_INTERACT_RADIUS;
}

// ============================================================================
// POST-NIGHT 5 ENDING 2 (ROUTE: COMPLETED NIGHT 5 WITHOUT COLLECTING DOCUMENTS)
// ============================================================================

export const POST_NIGHT_5_NO_DOCS_RUN_SCREAM_TABS: readonly PostNight1DialogueTab[] = [
  {
    speaker: 'THE THING',
    speakerColor: '#f87171',
    segments: [
      {
        text: '¡VUELVE AQUÍ!',
        slightTremble: true,
      },
    ],
  },
  {
    speaker: 'THE THING',
    speakerColor: '#f87171',
    segments: [
      {
        text: '¡TRAIDOOOOR!',
        slightTremble: true,
      },
    ],
  },
  {
    speaker: 'THE THING',
    speakerColor: '#f87171',
    segments: [
      {
        text: '¡ME PROMETISTE LOS DOCUMENTOS!',
        slightTremble: true,
      },
    ],
  },
  {
    speaker: 'THE THING',
    speakerColor: '#f87171',
    segments: [
      {
        text: '¡¿ES QUE ACASO NO TE IMPORTA TU HERMANA?!',
        slightTremble: true,
      },
    ],
  },
];

export const POST_NIGHT_5_NO_DOCS_OFFER_MONEY_TAB: PostNight1DialogueTab = {
  speaker: 'THE THING',
  speakerColor: '#f87171',
  segments: [
    {
      text: 'Bien, bien, ven aquí y te llevarás el dinero.',
    },
  ],
};

export const POST_NIGHT_5_NO_DOCS_DYING_TAB: PostNight1DialogueTab = {
  speaker: 'THE THING',
  speakerColor: '#f87171',
  segments: [
    {
      text: 'No te preocupes Richard, tu hermana vivirá ',
    },
    {
      text: 'A COSTA DE TU VIDA',
      slowTremble: true,
    },
  ],
};

export const POST_NIGHT_5_NO_DOCS_LEFT_HALL_DURATION_SEC = 1.85;
export const POST_NIGHT_5_NO_DOCS_LEFT_TURN_DURATION_SEC = 0.85;
export const POST_NIGHT_5_NO_DOCS_AUTO_DIALOGUE_HOLD_SEC = 2.0;
export const POST_NIGHT_5_NO_DOCS_REACH_MONEY_DURATION_SEC = 3.0;
export const POST_NIGHT_5_NO_DOCS_SLOW_DEATH_BLINK_DURATION_SEC = 4.4;

export interface PostNight5NoDocsRunAndTurnState {
  leftCorridorProgress: number; // 0 -> 1 running along the left corridor outside the office toward the corner
  turnLeftProgress: number; // 0 = facing down the left corridor corner, 1 = turned 90° left into the main exit corridor
  exitCorridorCameraYaw: number; // +1.15 -> 0 as Richard turns 90° left to face the EXIT door
  isRunning: boolean; // true while running, false the instant Richard brakes dead in front of the EXIT door
  hasBrakedDead: boolean; // true once Richard brakes dead right in front of the EXIT door
  theThingShouldSpeak: boolean; // false while running in the left office corridor, true once turning left into the exit corridor
}

/**
 * Computes the continuous, fade-free first-person running sequence at the start of the No-Documents Ending:
 * 1. `NO_DOCS_FP_LEFT_HALL_AND_TURN` (0.00s .. 1.85s): Richard runs down the Left Corridor from the Office
 *    toward the corner intersection (The Thing has not started speaking yet).
 * 2. `NO_DOCS_FP_RUN_1_OFFICE`: Richard smoothly turns 90° to the left (over 0.85s, with zero fade to black)
 *    into the Grand Entrance / Exit Corridor, and The Thing immediately begins screaming ("¡VUELVE AQUÍ!").
 * 3. `NO_DOCS_FP_RUN_2_CORRIDOR` .. `NO_DOCS_FP_RUN_4_SISTER`: Continuous smooth run down the Exit Corridor
 *    until "¡¿ES QUE ACASO NO TE IMPORTA TU HERMANA?!" finishes typing (`timeSinceDialogueDone >= 0`),
 *    at which exact instant Richard brakes dead (`isRunning = false`, `hasBrakedDead = true`) and all running
 *    and corridor bobbing animations stop completely.
 */
export function getPostNight5NoDocsRunAndTurnState(
  phase: PostNight5EndingPhase,
  phaseElapsedSec: number,
  timeSinceDialogueDone = -1
): PostNight5NoDocsRunAndTurnState {
  const t = Math.max(0, phaseElapsedSec);

  if (phase === 'NO_DOCS_FP_LEFT_HALL_AND_TURN') {
    const rawProgress = Math.min(1, t / POST_NIGHT_5_NO_DOCS_LEFT_HALL_DURATION_SEC);
    return {
      leftCorridorProgress: Number(rawProgress.toFixed(3)),
      turnLeftProgress: 0,
      exitCorridorCameraYaw: 1.15,
      isRunning: true,
      hasBrakedDead: false,
      theThingShouldSpeak: false,
    };
  }

  if (phase === 'NO_DOCS_FP_RUN_1_OFFICE') {
    const rawTurn = Math.min(1, t / POST_NIGHT_5_NO_DOCS_LEFT_TURN_DURATION_SEC);
    const smoothTurn = rawTurn * rawTurn * (3 - 2 * rawTurn);
    const exitCorridorCameraYaw = (1 - smoothTurn) * 1.15;
    return {
      leftCorridorProgress: 1,
      turnLeftProgress: Number(smoothTurn.toFixed(3)),
      exitCorridorCameraYaw: Number(exitCorridorCameraYaw.toFixed(3)),
      isRunning: true,
      hasBrakedDead: false,
      theThingShouldSpeak: true,
    };
  }

  if (phase === 'NO_DOCS_FP_RUN_2_CORRIDOR' || phase === 'NO_DOCS_FP_RUN_3_CORRIDOR') {
    return {
      leftCorridorProgress: 1,
      turnLeftProgress: 1,
      exitCorridorCameraYaw: 0,
      isRunning: true,
      hasBrakedDead: false,
      theThingShouldSpeak: true,
    };
  }

  if (phase === 'NO_DOCS_FP_RUN_4_SISTER') {
    const hasBrakedDead = timeSinceDialogueDone >= 0;
    return {
      leftCorridorProgress: 1,
      turnLeftProgress: 1,
      exitCorridorCameraYaw: 0,
      isRunning: !hasBrakedDead,
      hasBrakedDead,
      theThingShouldSpeak: true,
    };
  }

  return {
    leftCorridorProgress: 1,
    turnLeftProgress: 1,
    exitCorridorCameraYaw: 0,
    isRunning: false,
    hasBrakedDead: true,
    theThingShouldSpeak: false,
  };
}

export interface PostNight5NoDocsDyingVisionState {
  blurPx: number; // Progressively increasing blur as Richard loses consciousness
  eyelidCloseProgress: number; // 0 = eyes open, 1 = eyes completely shut
  crouchProgress: number; // 0 = The Thing standing, 1 = The Thing crouched down at floor level
  completed: boolean;
}

/**
 * Computes the blinking, increasingly blurry vision & The Thing's crouching posture while Richard lies
 * on his side on the CAM 05 floor (`isFinalDeathBlink = false`), and the final slow death blink
 * where his eyes slowly close forever while the screen gets blurrier (`isFinalDeathBlink = true`).
 */
export function getPostNight5NoDocsDyingVisionState(
  elapsedSec: number,
  isFinalDeathBlink: boolean
): PostNight5NoDocsDyingVisionState {
  const t = Math.max(0, elapsedSec);

  if (!isFinalDeathBlink) {
    // During automatic dialogue ("durante este proceso debe estar parpadeando y con la vision cada vez mas borrosa"):
    // - The Thing crouches down smoothly in the first 1.25s
    const crouchRaw = Math.min(1, t / 1.25);
    const crouchProgress = crouchRaw * crouchRaw * (3 - 2 * crouchRaw);

    // - Vision blur increases steadily from 1.2px up to 5.8px
    const blurPx = Number(Math.min(5.8, 1.2 + t * 0.85).toFixed(2));

    // - Periodic heavy dying blinks every ~1.65s
    const cycle = (t % 1.65) / 1.65;
    let eyelidCloseProgress = 0.08;
    if (cycle > 0.62 && cycle < 0.92) {
      const blinkWave = Math.sin(((cycle - 0.62) / 0.30) * Math.PI);
      eyelidCloseProgress = Number((0.08 + blinkWave * 0.68).toFixed(3));
    }

    return {
      blurPx,
      eyelidCloseProgress,
      crouchProgress: Number(crouchProgress.toFixed(3)),
      completed: false,
    };
  }

  // Final slow death blink ("hacer un parpadeo lento de muerte en el que la pantalla de va volviendo cada vez mas borrosa mientras cierrra los ojos lentamente"):
  const progress = Math.min(1, t / POST_NIGHT_5_NO_DOCS_SLOW_DEATH_BLINK_DURATION_SEC);
  const blurPx = Number((5.8 + progress * 12.2).toFixed(2));

  let eyelidCloseProgress = 1;
  if (progress < 0.36) {
    // First heavy droop to 78% closed
    const p = progress / 0.36;
    const smooth = p * p * (3 - 2 * p);
    eyelidCloseProgress = 0.22 + smooth * 0.56;
  } else if (progress < 0.56) {
    // Weak last effort to open slightly (78% -> 46%)
    const p = (progress - 0.36) / 0.20;
    const smooth = p * p * (3 - 2 * p);
    eyelidCloseProgress = 0.78 - smooth * 0.32;
  } else {
    // Slow, irreversible final eye closure into total darkness (46% -> 100%)
    const p = Math.min(1, (progress - 0.56) / 0.36);
    const smooth = p * p * (3 - 2 * p);
    eyelidCloseProgress = 0.46 + smooth * 0.54;
  }

  return {
    blurPx,
    eyelidCloseProgress: Number(Math.min(1, eyelidCloseProgress).toFixed(3)),
    crouchProgress: 1,
    completed: t >= POST_NIGHT_5_NO_DOCS_SLOW_DEATH_BLINK_DURATION_SEC,
  };
}



