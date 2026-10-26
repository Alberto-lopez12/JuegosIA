import {
  AnimatronicAILevels,
  AnimatronicId,
  AnimatronicLocation,
  CameraId,
  NightSimulationState,
  RunSummarySnapshot,
} from './types';

export const DEFAULT_HOUR_DURATION_SECONDS = 45; // 45s per in-game hour => 4m30s full night

/**
 * Canonical FNAF 1 starting AI levels per Night (1-5) plus Custom Night (6).
 */
export function getNightInitialAILevels(
  nightNumber: number,
  customLevels?: AnimatronicAILevels
): AnimatronicAILevels {
  if (nightNumber === 6 && customLevels) {
    return {
      pedro: Math.max(0, Math.min(20, Math.round(customLevels.pedro))),
      rajoy: Math.max(0, Math.min(20, Math.round(customLevels.rajoy))),
      montero: Math.max(0, Math.min(20, Math.round(customLevels.montero))),
      abascal: Math.max(0, Math.min(20, Math.round(customLevels.abascal))),
    };
  }

  switch (nightNumber) {
    case 1:
      // On Night 1 we start Rajoy & Montero with brisk activity so the player experiences action right away,
      // and they also ramp up at 2 AM, 3 AM, and 4 AM!
      return { pedro: 0, rajoy: 3, montero: 2, abascal: 1 };
    case 2:
      return { pedro: 1, rajoy: 6, montero: 4, abascal: 3 };
    case 3:
      return { pedro: 3, rajoy: 7, montero: 6, abascal: 5 };
    case 4:
      return { pedro: 5, rajoy: 9, montero: 8, abascal: 8 };
    case 5:
      return { pedro: 8, rajoy: 12, montero: 11, abascal: 10 };
    default:
      return { pedro: 20, rajoy: 20, montero: 20, abascal: 20 };
  }
}

/**
 * Exact FNAF 1 hourly AI increments:
 * - 2 AM: Rajoy (Bonnie) +1
 * - 3 AM: Rajoy (Bonnie) +1, Montero (Chica) +1, Abascal (Foxy) +1
 * - 4 AM: Rajoy (Bonnie) +1, Montero (Chica) +1, Abascal (Foxy) +1
 */
export function getEffectiveAILevel(
  baseLevel: number,
  id: AnimatronicId,
  currentHour: number
): number {
  let bonus = 0;
  if (id === 'rajoy') {
    if (currentHour >= 2) bonus += 1;
    if (currentHour >= 3) bonus += 1;
    if (currentHour >= 4) bonus += 1;
  } else if (id === 'montero' || id === 'abascal') {
    if (currentHour >= 3) bonus += 1;
    if (currentHour >= 4) bonus += 1;
  }
  return Math.max(0, Math.min(20, baseLevel + bonus));
}

/**
 * Calculates Usage Bar pips (1 to 5) exactly like FNAF 1:
 * Base = 1 (fan/office)
 * +1 Left Door closed
 * +1 Right Door closed
 * +1 Left Light on
 * +1 Right Light on
 * +1 CCTV Monitor open
 */
export function calculateUsageLevel(state: {
  leftDoorClosed: boolean;
  rightDoorClosed: boolean;
  leftLightOn: boolean;
  rightLightOn: boolean;
  monitorOpen: boolean;
}): number {
  let usage = 1;
  if (state.leftDoorClosed) usage += 1;
  if (state.rightDoorClosed) usage += 1;
  if (state.leftLightOn) usage += 1;
  if (state.rightLightOn) usage += 1;
  if (state.monitorOpen) usage += 1;
  return Math.min(5, usage);
}

/**
 * Calculates power drain in tenths of a percent per second (1000 = 100.0%).
 * Usage 1 drains ~1.04 tenths/sec (lasts ~960s solo), Usage 2 drains ~2.1 tenths/sec,
 * Usage 3 drains ~3.2 tenths/sec, Usage 4 drains ~4.4 tenths/sec, Usage 5 drains ~5.6 tenths/sec,
 * plus a slight passive night multiplier on Nights 2-6 just like FNAF 1.
 */
export function calculatePowerDrainTenthsPerSecond(
  usageLevel: number,
  nightNumber: number
): number {
  const clampedUsage = Math.max(1, Math.min(5, usageLevel));
  const baseDrainByUsage: Record<number, number> = {
    1: 1.05,
    2: 2.15,
    3: 3.3,
    4: 4.5,
    5: 5.8,
  };
  const nightPassiveFactor = 1 + Math.min(5, Math.max(0, nightNumber - 1)) * 0.06;
  return baseDrainByUsage[clampedUsage] * nightPassiveFactor;
}

/**
 * Formats currentHour (0..6) into standard FNAF clock display ("12 AM", "1 AM", ..., "6 AM").
 */
export function formatFnafHour(hour: number): string {
  if (hour <= 0) return '12 AM';
  return `${Math.min(6, hour)} AM`;
}

/**
 * Movement check: rolls 1..20; succeeds if roll <= effectiveAI (and effectiveAI > 0).
 */
export function canAnimatronicMove(effectiveAI: number, roll1To20: number): boolean {
  if (effectiveAI <= 0) return false;
  return roll1To20 <= effectiveAI;
}

/**
 * Rajoy-Bonnie's West Wing movement graph:
 * CAM_1A -> CAM_1B or CAM_5
 * CAM_1B -> CAM_5 or CAM_2A
 * CAM_5  -> CAM_1B or CAM_2A
 * CAM_2A -> CAM_3 or CAM_2B
 * CAM_3  -> CAM_2A or LEFT_DOOR
 * CAM_2B -> LEFT_DOOR or CAM_3
 */
export function getNextRajoyLocation(
  current: AnimatronicLocation,
  rngValue0To1: number
): AnimatronicLocation {
  switch (current) {
    case 'CAM_1A':
      return rngValue0To1 < 0.65 ? 'CAM_1B' : 'CAM_5';
    case 'CAM_1B':
      return rngValue0To1 < 0.45 ? 'CAM_5' : 'CAM_2A';
    case 'CAM_5':
      return rngValue0To1 < 0.35 ? 'CAM_1B' : 'CAM_2A';
    case 'CAM_2A':
      return rngValue0To1 < 0.4 ? 'CAM_3' : 'CAM_2B';
    case 'CAM_3':
      return rngValue0To1 < 0.35 ? 'CAM_2A' : 'LEFT_DOOR';
    case 'CAM_2B':
      return rngValue0To1 < 0.75 ? 'LEFT_DOOR' : 'CAM_3';
    default:
      return 'CAM_1B';
  }
}

/**
 * Montero-Chica's East Wing movement graph:
 * CAM_1A -> CAM_1B
 * CAM_1B -> CAM_7 or CAM_6
 * CAM_7  -> CAM_6 or CAM_4A
 * CAM_6  -> CAM_4A or CAM_7
 * CAM_4A -> CAM_4B or CAM_1B
 * CAM_4B -> RIGHT_DOOR or CAM_4A
 */
export function getNextMonteroLocation(
  current: AnimatronicLocation,
  rngValue0To1: number
): AnimatronicLocation {
  switch (current) {
    case 'CAM_1A':
      return 'CAM_1B';
    case 'CAM_1B':
      return rngValue0To1 < 0.55 ? 'CAM_7' : 'CAM_6';
    case 'CAM_7':
      return rngValue0To1 < 0.5 ? 'CAM_6' : 'CAM_4A';
    case 'CAM_6':
      return rngValue0To1 < 0.75 ? 'CAM_4A' : 'CAM_7';
    case 'CAM_4A':
      return rngValue0To1 < 0.8 ? 'CAM_4B' : 'CAM_1B';
    case 'CAM_4B':
      return rngValue0To1 < 0.75 ? 'RIGHT_DOOR' : 'CAM_4A';
    default:
      return 'CAM_1B';
  }
}

/**
 * Pedro-Freddy's deterministic East Wing stealth path:
 * CAM_1A -> CAM_1B -> CAM_7 -> CAM_6 -> CAM_4A -> CAM_4B -> OFFICE_INSIDE
 * Rule 1: Stays on CAM_1A until both Rajoy and Montero have left CAM_1A.
 * Rule 2: Freezes whenever monitorOpen is true while advancing along the cameras.
 * Rule 3: At CAM_4B, he only enters OFFICE_INSIDE if Right Door is open AND the player is NOT watching CAM_4B.
 *         If Right Door is closed when he attempts to enter, he retreats to CAM_4A.
 */
export function getNextPedroLocation(params: {
  current: AnimatronicLocation;
  monitorOpen: boolean;
  activeCam: CameraId;
  rightDoorClosed: boolean;
  rajoyLocation: AnimatronicLocation;
  monteroLocation: AnimatronicLocation;
}): AnimatronicLocation {
  const {
    current,
    monitorOpen,
    activeCam,
    rightDoorClosed,
    rajoyLocation,
    monteroLocation,
  } = params;

  if (current === 'CAM_1A') {
    if (rajoyLocation === 'CAM_1A' || monteroLocation === 'CAM_1A') {
      return 'CAM_1A';
    }
    if (monitorOpen) return 'CAM_1A';
    return 'CAM_1B';
  }

  if (current === 'CAM_4B') {
    // Watching Pedro on CAM_4B locks him in place
    if (monitorOpen && activeCam === 'CAM_4B') {
      return 'CAM_4B';
    }
    if (rightDoorClosed) {
      return 'CAM_4A';
    }
    // Enters office if monitor is open on a DIFFERENT camera while Right Door is open,
    // or if left unchecked at 4B with door open
    return 'OFFICE_INSIDE';
  }

  // Standard camera progression freezes while monitor is open
  if (monitorOpen) {
    return current;
  }

  switch (current) {
    case 'CAM_1B':
      return 'CAM_7';
    case 'CAM_7':
      return 'CAM_6';
    case 'CAM_6':
      return 'CAM_4A';
    case 'CAM_4A':
      return 'CAM_4B';
    default:
      return current;
  }
}

/**
 * Creates a fresh initial NightSimulationState.
 */
export function createInitialNightState(
  nightNumber: number = 1,
  customLevels?: AnimatronicAILevels,
  hourDurationSeconds: number = DEFAULT_HOUR_DURATION_SECONDS
): NightSimulationState {
  const baseAI = getNightInitialAILevels(nightNumber, customLevels);
  return {
    nightNumber,
    baseAI,
    elapsedSeconds: 0,
    hourDurationSeconds,
    currentHour: 0,
    powerTenths: 1000,
    usageLevel: 1,
    leftDoorClosed: false,
    rightDoorClosed: false,
    leftLightOn: false,
    rightLightOn: false,
    leftJammed: false,
    rightJammed: false,
    monitorOpen: false,
    activeCam: 'CAM_1A',
    cameraStaticTimer: 0,
    fanOn: true,

    pedroLocation: 'CAM_1A',
    rajoyLocation: 'CAM_1A',
    monteroLocation: 'CAM_1A',
    abascalStage: 0,
    abascalSprinting: false,
    abascalSprintProgress: 0,
    abascalWaitTimer: 0,
    abascalStallTimer: 0,
    abascalBangsCount: 0,
    endo03Active: false,
    goldenFreddyPosterActive: false,
    goldenFreddyActive: false,
    goldenFreddyTimer: 0,

    pedroTimer: 0,
    rajoyTimer: 0,
    monteroTimer: 0,
    abascalTimer: 0,

    rajoyDoorTimer: 0,
    monteroDoorTimer: 0,
    pedroCornerTimer: 0,

    powerOutage: false,
    outagePhase: 'none',
    outageTimer: 0,

    status: 'playing',
    jumpscareBy: null,
    jumpscareTimer: 0,
    lastEventBanner: null,
    lastAudioCue: 'none',
    audioCueCounter: 0,
  };
}

/**
 * Toggles the Left Security Door [A].
 * If Left Door controls are jammed by Rajoy inside the office, triggers 'door_jammed' audio cue.
 */
export function toggleLeftDoor(state: NightSimulationState): NightSimulationState {
  if (state.powerOutage || state.status !== 'playing') return state;
  if (state.leftJammed) {
    return {
      ...state,
      lastAudioCue: 'door_jammed',
      audioCueCounter: state.audioCueCounter + 1,
    };
  }
  const leftDoorClosed = !state.leftDoorClosed;
  const next = { ...state, leftDoorClosed };
  next.usageLevel = calculateUsageLevel(next);
  return next;
}

/**
 * Toggles the Right Security Door [D].
 * If Right Door controls are jammed by Montero inside the office, triggers 'door_jammed' audio cue.
 */
export function toggleRightDoor(state: NightSimulationState): NightSimulationState {
  if (state.powerOutage || state.status !== 'playing') return state;
  if (state.rightJammed) {
    return {
      ...state,
      lastAudioCue: 'door_jammed',
      audioCueCounter: state.audioCueCounter + 1,
    };
  }
  const rightDoorClosed = !state.rightDoorClosed;
  const next = { ...state, rightDoorClosed };
  next.usageLevel = calculateUsageLevel(next);
  return next;
}

/**
 * Toggles the Left Hallway Light [Q].
 * Turning on Left Light automatically turns off Right Light (just like FNAF 1).
 */
export function toggleLeftLight(state: NightSimulationState): NightSimulationState {
  if (state.powerOutage || state.status !== 'playing' || state.monitorOpen) return state;
  if (state.leftJammed) {
    return {
      ...state,
      lastAudioCue: 'door_jammed',
      audioCueCounter: state.audioCueCounter + 1,
    };
  }
  const leftLightOn = !state.leftLightOn;
  const next: NightSimulationState = {
    ...state,
    leftLightOn,
    rightLightOn: leftLightOn ? false : state.rightLightOn,
  };
  if (leftLightOn && state.rajoyLocation === 'LEFT_DOOR') {
    next.lastAudioCue = 'window_scare';
    next.audioCueCounter = state.audioCueCounter + 1;
  }
  next.usageLevel = calculateUsageLevel(next);
  return next;
}

/**
 * Toggles the Right Hallway Light [E].
 * Turning on Right Light automatically turns off Left Light.
 */
export function toggleRightLight(state: NightSimulationState): NightSimulationState {
  if (state.powerOutage || state.status !== 'playing' || state.monitorOpen) return state;
  if (state.rightJammed) {
    return {
      ...state,
      lastAudioCue: 'door_jammed',
      audioCueCounter: state.audioCueCounter + 1,
    };
  }
  const rightLightOn = !state.rightLightOn;
  const next: NightSimulationState = {
    ...state,
    rightLightOn,
    leftLightOn: rightLightOn ? false : state.leftLightOn,
  };
  if (rightLightOn && state.monteroLocation === 'RIGHT_DOOR') {
    next.lastAudioCue = 'window_scare';
    next.audioCueCounter = state.audioCueCounter + 1;
  }
  next.usageLevel = calculateUsageLevel(next);
  return next;
}

/**
 * Toggles the CCTV Monitor [Space].
 * - Opening the monitor automatically turns off both hallway lights, banishes Echenique-Golden Freddy
 *   if he was sitting in the office (< 2.5s counterplay), or has a 1/1000 chance to trigger his CAM 2B poster.
 * - Closing the monitor applies a brief stall cooldown on Abascal-Foxy (1.5s to 5.5s),
 *   clears any Endo-03 Easter Egg, triggers any waiting office jumpscare, or spawns Echenique-Golden Freddy
 *   in the office if his poster was active or with a 1/1000 chance on monitor flip!
 */
export function toggleMonitor(
  state: NightSimulationState,
  rngValue0To1: number = 0.5,
  endoRngValue0To1: number = Math.random(),
  goldenRngValue0To1: number = Math.random()
): NightSimulationState {
  if (state.powerOutage || state.status !== 'playing' || state.jumpscareBy) {
    return state;
  }

  const monitorOpen = !state.monitorOpen;
  let next: NightSimulationState = {
    ...state,
    monitorOpen,
    leftLightOn: false,
    rightLightOn: false,
    endo03Active: false,
  };

  if (!monitorOpen) {
    // Closing monitor: stall Abascal-Foxy for 1.5s - 5.5s
    next.abascalStallTimer = 1.5 + rngValue0To1 * 4.0;

    // If Rajoy or Montero snuck into the office while monitor was open, pulling down monitor triggers jumpscare!
    if (next.rajoyLocation === 'OFFICE_INSIDE') {
      next.jumpscareBy = 'rajoy';
      next.jumpscareTimer = 0.9;
      next.lastAudioCue = 'jumpscare';
      next.audioCueCounter = state.audioCueCounter + 1;
    } else if (next.monteroLocation === 'OFFICE_INSIDE') {
      next.jumpscareBy = 'montero';
      next.jumpscareTimer = 0.9;
      next.lastAudioCue = 'jumpscare';
      next.audioCueCounter = state.audioCueCounter + 1;
    } else if (next.pedroLocation === 'OFFICE_INSIDE') {
      next.jumpscareBy = 'pedro';
      next.jumpscareTimer = 0.9;
      next.lastAudioCue = 'jumpscare';
      next.audioCueCounter = state.audioCueCounter + 1;
    } else if (state.goldenFreddyPosterActive || goldenRngValue0To1 < 0.001) {
      // Echenique-Golden Freddy manifests slumped in the office! Player has 2.5 seconds to pull up the monitor.
      next.goldenFreddyActive = true;
      next.goldenFreddyPosterActive = false;
      next.goldenFreddyTimer = 0;
      next.lastAudioCue = 'golden_laugh';
      next.audioCueCounter = state.audioCueCounter + 1;
    }
  } else {
    // Opening the monitor while Echenique-Golden Freddy is in the office (< 2.5s) banishes him!
    if (state.goldenFreddyActive) {
      next.goldenFreddyActive = false;
      next.goldenFreddyPosterActive = false;
      next.goldenFreddyTimer = 0;
    } else if (goldenRngValue0To1 < 0.001) {
      // 1/1000 chance on raising the monitor to trigger Golden Freddy's hallucination poster
      next.goldenFreddyPosterActive = true;
      if (next.activeCam === 'CAM_2B') {
        next.lastAudioCue = 'golden_laugh';
        next.audioCueCounter = state.audioCueCounter + 1;
      }
    }

    // Opening monitor on CAM_2A when Abascal is at stage 3 immediately triggers his sprint!
    if (next.activeCam === 'CAM_2A' && next.abascalStage === 3 && !next.abascalSprinting) {
      next.abascalSprinting = true;
      next.abascalSprintProgress = 0;
      next.lastAudioCue = 'foxy_sprint';
      next.audioCueCounter = state.audioCueCounter + 1;
    }
    // 1/1000 Easter Egg check if opening monitor directly onto CAM_3 while Rajoy is absent
    if (next.activeCam === 'CAM_3' && next.rajoyLocation !== 'CAM_3') {
      next.endo03Active = endoRngValue0To1 < 0.001;
    }
  }

  next.usageLevel = calculateUsageLevel(next);
  return next;
}

/**
 * Switches the active CCTV camera.
 * - Includes the 1/1000 Easter Egg roll for Endo-03 when switching to CAM_3 while Rajoy-Bonnie is not in CAM_3.
 * - Includes the 1/1000 Easter Egg roll for Echenique-Golden Freddy's poster when switching to CAM_2B.
 */
export function selectCamera(
  state: NightSimulationState,
  camId: CameraId,
  rngValue0To1: number = Math.random(),
  goldenRngValue0To1: number = Math.random()
): NightSimulationState {
  if (state.powerOutage || state.status !== 'playing') return state;
  const triggeredGoldenPoster =
    state.goldenFreddyPosterActive || (camId === 'CAM_2B' && goldenRngValue0To1 < 0.001);

  const next: NightSimulationState = {
    ...state,
    activeCam: camId,
    cameraStaticTimer: 0.18,
    endo03Active:
      camId === 'CAM_3' && state.rajoyLocation !== 'CAM_3'
        ? rngValue0To1 < 0.001
        : false,
    goldenFreddyPosterActive: triggeredGoldenPoster,
  };

  if (camId === 'CAM_2B' && triggeredGoldenPoster && !state.goldenFreddyPosterActive) {
    next.lastAudioCue = 'golden_laugh';
    next.audioCueCounter = state.audioCueCounter + 1;
  }

  // Viewing CAM_2A while Abascal is at Stage 3 triggers his visible hallway sprint!
  if (
    next.monitorOpen &&
    camId === 'CAM_2A' &&
    next.abascalStage === 3 &&
    !next.abascalSprinting
  ) {
    next.abascalSprinting = true;
    next.abascalSprintProgress = 0;
    next.lastAudioCue = 'foxy_sprint';
    next.audioCueCounter = state.audioCueCounter + 1;
  }

  return next;
}

/**
 * Resolves Abascal-Foxy arriving at the Left Office Door after sprinting down CAM_2A.
 * - If Left Door is closed: he bangs on the door, drains (10 + 50 * prevBangs) tenths of power (1% + 5%*bangs),
 *   and resets back to Stage 0 or 1 in CAM_1C.
 * - If Left Door is open: he bursts in and triggers an immediate jumpscare!
 */
export function resolveAbascalDoorArrival(
  state: NightSimulationState,
  rngValue0To1: number = 0.4
): NightSimulationState {
  if (state.leftDoorClosed) {
    const drainTenths = 10 + state.abascalBangsCount * 50; // 1% first bang, 6% second, 11% third...
    const nextPower = Math.max(0, state.powerTenths - drainTenths);
    return {
      ...state,
      powerTenths: nextPower,
      abascalSprinting: false,
      abascalSprintProgress: 0,
      abascalStage: rngValue0To1 < 0.5 ? 0 : 1,
      abascalWaitTimer: 0,
      abascalBangsCount: state.abascalBangsCount + 1,
      lastEventBanner: `¡Abascal-Foxy ha golpeado la Puerta Izquierda! (-${Math.round(drainTenths / 10)}% Energía)`,
      lastAudioCue: 'foxy_bang',
      audioCueCounter: state.audioCueCounter + 1,
    };
  }

  // Left door was open -> immediate Jumpscare!
  return {
    ...state,
    abascalSprinting: false,
    abascalSprintProgress: 1,
    monitorOpen: false,
    leftLightOn: false,
    rightLightOn: false,
    jumpscareBy: 'abascal',
    jumpscareTimer: 0.9,
    lastAudioCue: 'jumpscare',
    audioCueCounter: state.audioCueCounter + 1,
  };
}

/**
 * Advances the night simulation by `rawDt` seconds (clamped to <= 0.05s).
 */
export function stepGameSimulation(
  state: NightSimulationState,
  rawDt: number,
  rng: () => number = Math.random
): NightSimulationState {
  if (state.status !== 'playing') return state;
  const dt = Math.min(Math.max(0, rawDt), 0.05);
  if (dt === 0) return state;

  let next: NightSimulationState = { ...state };

  // 1. Handle active Jumpscare animation countdown before transitioning to 'defeat'
  if (next.jumpscareBy) {
    next.jumpscareTimer = Math.max(0, next.jumpscareTimer - dt);
    if (next.jumpscareTimer <= 0) {
      next.status = 'defeat';
    }
    return next;
  }

  // 1b. Handle Echenique-Golden Freddy 2.5-second lethal countdown in the office!
  if (next.goldenFreddyActive && !next.monitorOpen) {
    next.goldenFreddyTimer += dt;
    if (next.goldenFreddyTimer >= 2.5) {
      next.goldenFreddyActive = false;
      next.jumpscareBy = 'echenique';
      next.jumpscareTimer = 1.1;
      next.lastAudioCue = 'golden_jumpscare';
      next.audioCueCounter += 1;
      return next;
    }
  }

  // 2. Advance Night Clock (12:00 AM -> 6:00 AM)
  next.elapsedSeconds += dt;
  const newHour = Math.floor(next.elapsedSeconds / next.hourDurationSeconds);
  if (newHour >= 6) {
    next.currentHour = 6;
    next.status = 'victory';
    next.monitorOpen = false;
    next.leftLightOn = false;
    next.rightLightOn = false;
    next.lastAudioCue = 'victory_chime';
    next.audioCueCounter += 1;
    return next;
  }
  next.currentHour = newHour;

  // Decay camera static timer
  if (next.cameraStaticTimer > 0) {
    next.cameraStaticTimer = Math.max(0, next.cameraStaticTimer - dt);
  }

  // 3. Handle Power Outage Sequence (0% Battery -> Pedro-Freddy's Toreador March)
  if (next.powerOutage) {
    next.outageTimer += dt;
    if (next.outagePhase === 'dark_wait' && next.outageTimer >= 3.5) {
      next.outagePhase = 'toreador_song';
      next.outageTimer = 0;
    } else if (next.outagePhase === 'toreador_song' && next.outageTimer >= 9.0) {
      next.outagePhase = 'pitch_black';
      next.outageTimer = 0;
    } else if (next.outagePhase === 'pitch_black' && next.outageTimer >= 2.5) {
      next.outagePhase = 'jumpscare';
      next.jumpscareBy = 'pedro';
      next.jumpscareTimer = 0.95;
      next.lastAudioCue = 'jumpscare';
      next.audioCueCounter += 1;
    }
    return next;
  }

  // 4. Drain Battery Power
  next.usageLevel = calculateUsageLevel(next);
  const drainPerSec = calculatePowerDrainTenthsPerSecond(
    next.usageLevel,
    next.nightNumber
  );
  next.powerTenths = Math.max(0, next.powerTenths - drainPerSec * dt);

  if (next.powerTenths <= 0) {
    next.powerTenths = 0;
    next.powerOutage = true;
    next.outagePhase = 'dark_wait';
    next.outageTimer = 0;
    next.leftDoorClosed = false;
    next.rightDoorClosed = false;
    next.leftLightOn = false;
    next.rightLightOn = false;
    next.monitorOpen = false;
    next.fanOn = false;
    next.usageLevel = 0;
    next.lastEventBanner = '¡APAGÓN TOTAL EN MONCLOA! Batería al 0%';
    next.lastAudioCue = 'power_down';
    next.audioCueCounter += 1;
    return next;
  }

  // 5. Abascal-Foxy Sprint & Stage Logic
  if (next.abascalStallTimer > 0 && !next.monitorOpen) {
    next.abascalStallTimer = Math.max(0, next.abascalStallTimer - dt);
  }

  if (next.abascalSprinting) {
    // Sprints down CAM_2A in ~1.75 seconds!
    next.abascalSprintProgress += dt / 1.75;
    if (next.abascalSprintProgress >= 1) {
      next = resolveAbascalDoorArrival(next, rng());
      return next;
    }
  } else if (next.abascalStage === 3) {
    // Waiting at Stage 3 to sprint if player never checks CAM_2A
    next.abascalWaitTimer += dt;
    if (next.abascalWaitTimer >= 14.0) {
      next.abascalSprinting = true;
      next.abascalSprintProgress = 0;
      next.lastAudioCue = 'foxy_sprint';
      next.audioCueCounter += 1;
    }
  } else {
    // Abascal-Foxy movement check every 5.01s
    next.abascalTimer += dt;
    if (next.abascalTimer >= 5.01) {
      next.abascalTimer -= 5.01;
      const effAbascalAI = getEffectiveAILevel(
        next.baseAI.abascal,
        'abascal',
        next.currentHour
      );
      const roll = Math.floor(rng() * 20) + 1;
      // Stalled if monitor is open OR stall timer is active
      if (!next.monitorOpen && next.abascalStallTimer <= 0 && canAnimatronicMove(effAbascalAI, roll)) {
        next.abascalStage = Math.min(3, next.abascalStage + 1) as 0 | 1 | 2 | 3;
        if (next.abascalStage === 3) {
          next.abascalWaitTimer = 0;
        }
      }
    }
  }

  // 6. Rajoy-Bonnie AI Movement & Door Check (interval: 4.97s)
  if (next.rajoyLocation === 'LEFT_DOOR') {
    next.rajoyDoorTimer += dt;
    if (next.rajoyDoorTimer >= 5.2) {
      next.rajoyDoorTimer = 0;
      if (next.leftDoorClosed) {
        // Blocked by Left Door -> retreats to Dining Area (CAM_1B)
        next.rajoyLocation = 'CAM_1B';
        next.leftLightOn = false;
      } else {
        // Door is open! If monitor is open, he sneaks in and jams the left buttons;
        // if player has been ignoring the left door for too long, he attacks!
        const effRajoyAI = getEffectiveAILevel(next.baseAI.rajoy, 'rajoy', next.currentHour);
        const roll = Math.floor(rng() * 20) + 1;
        if (canAnimatronicMove(effRajoyAI, roll)) {
          if (next.monitorOpen) {
            next.rajoyLocation = 'OFFICE_INSIDE';
            next.leftJammed = true;
            next.leftLightOn = false;
          } else {
            next.jumpscareBy = 'rajoy';
            next.jumpscareTimer = 0.9;
            next.leftLightOn = false;
            next.lastAudioCue = 'jumpscare';
            next.audioCueCounter += 1;
            return next;
          }
        }
      }
    }
  } else if (next.rajoyLocation === 'OFFICE_INSIDE') {
    // If Rajoy is inside the office and player still has monitor up for > 12s, forces monitor down!
    next.rajoyDoorTimer += dt;
    if (next.rajoyDoorTimer >= 12.0 || !next.monitorOpen) {
      next.monitorOpen = false;
      next.jumpscareBy = 'rajoy';
      next.jumpscareTimer = 0.9;
      next.lastAudioCue = 'jumpscare';
      next.audioCueCounter += 1;
      return next;
    }
  } else {
    next.rajoyTimer += dt;
    if (next.rajoyTimer >= 4.97) {
      next.rajoyTimer -= 4.97;
      const effRajoyAI = getEffectiveAILevel(next.baseAI.rajoy, 'rajoy', next.currentHour);
      const roll = Math.floor(rng() * 20) + 1;
      if (canAnimatronicMove(effRajoyAI, roll)) {
        const prevLoc = next.rajoyLocation;
        const newLoc = getNextRajoyLocation(prevLoc, rng());
        next.rajoyLocation = newLoc;
        next.rajoyDoorTimer = 0;
        if (newLoc === 'CAM_3') {
          next.endo03Active = false;
        }
        if (next.monitorOpen && (next.activeCam === prevLoc || next.activeCam === newLoc)) {
          next.cameraStaticTimer = 0.45;
        }
      }
    }
  }

  // 7. Montero-Chica AI Movement & Door Check (interval: 4.98s)
  if (next.monteroLocation === 'RIGHT_DOOR') {
    next.monteroDoorTimer += dt;
    if (next.monteroDoorTimer >= 5.4) {
      next.monteroDoorTimer = 0;
      if (next.rightDoorClosed) {
        // Blocked by Right Door -> retreats to East Hall (CAM_4A) or Dining Area (CAM_1B)
        next.monteroLocation = rng() < 0.6 ? 'CAM_4A' : 'CAM_1B';
        next.rightLightOn = false;
      } else {
        const effMonteroAI = getEffectiveAILevel(
          next.baseAI.montero,
          'montero',
          next.currentHour
        );
        const roll = Math.floor(rng() * 20) + 1;
        if (canAnimatronicMove(effMonteroAI, roll)) {
          if (next.monitorOpen) {
            next.monteroLocation = 'OFFICE_INSIDE';
            next.rightJammed = true;
            next.rightLightOn = false;
          } else {
            next.jumpscareBy = 'montero';
            next.jumpscareTimer = 0.9;
            next.rightLightOn = false;
            next.lastAudioCue = 'jumpscare';
            next.audioCueCounter += 1;
            return next;
          }
        }
      }
    }
  } else if (next.monteroLocation === 'OFFICE_INSIDE') {
    next.monteroDoorTimer += dt;
    if (next.monteroDoorTimer >= 12.0 || !next.monitorOpen) {
      next.monitorOpen = false;
      next.jumpscareBy = 'montero';
      next.jumpscareTimer = 0.9;
      next.lastAudioCue = 'jumpscare';
      next.audioCueCounter += 1;
      return next;
    }
  } else {
    next.monteroTimer += dt;
    if (next.monteroTimer >= 4.98) {
      next.monteroTimer -= 4.98;
      const effMonteroAI = getEffectiveAILevel(
        next.baseAI.montero,
        'montero',
        next.currentHour
      );
      const roll = Math.floor(rng() * 20) + 1;
      if (canAnimatronicMove(effMonteroAI, roll)) {
        const prevLoc = next.monteroLocation;
        const newLoc = getNextMonteroLocation(prevLoc, rng());
        next.monteroLocation = newLoc;
        next.monteroDoorTimer = 0;
        if (newLoc === 'CAM_6') {
          next.lastAudioCue = 'kitchen_clatter';
          next.audioCueCounter += 1;
        }
        if (next.monitorOpen && (next.activeCam === prevLoc || next.activeCam === newLoc)) {
          next.cameraStaticTimer = 0.45;
        }
      }
    }
  }

  // 8. Pedro-Freddy AI Movement & Stealth Logic (interval: 3.02s)
  if (next.pedroLocation === 'OFFICE_INSIDE') {
    next.pedroCornerTimer += dt;
    if (!next.monitorOpen && next.pedroCornerTimer >= 1.5) {
      next.jumpscareBy = 'pedro';
      next.jumpscareTimer = 0.95;
      next.lastAudioCue = 'jumpscare';
      next.audioCueCounter += 1;
      return next;
    }
  } else {
    next.pedroTimer += dt;
    if (next.pedroTimer >= 3.02) {
      next.pedroTimer -= 3.02;
      const effPedroAI = getEffectiveAILevel(next.baseAI.pedro, 'pedro', next.currentHour);
      const roll = Math.floor(rng() * 20) + 1;
      if (canAnimatronicMove(effPedroAI, roll)) {
        const prevLoc = next.pedroLocation;
        const newLoc = getNextPedroLocation({
          current: prevLoc,
          monitorOpen: next.monitorOpen,
          activeCam: next.activeCam,
          rightDoorClosed: next.rightDoorClosed,
          rajoyLocation: next.rajoyLocation,
          monteroLocation: next.monteroLocation,
        });
        if (newLoc !== prevLoc) {
          next.pedroLocation = newLoc;
          next.pedroCornerTimer = 0;
          next.lastAudioCue = 'pedro_laugh';
          next.audioCueCounter += 1;
          if (next.monitorOpen && (next.activeCam === prevLoc || next.activeCam === newLoc)) {
            next.cameraStaticTimer = 0.45;
          }
        }
      }
    }
  }

  next.usageLevel = calculateUsageLevel(next);
  return next;
}

/**
 * Builds an immutable end-of-run snapshot for Victory or Game Over modals.
 */
export function buildRunSummarySnapshot(
  state: NightSimulationState
): RunSummarySnapshot {
  const names: Record<AnimatronicId, string> = {
    pedro: 'Pedro-Freddy (El Presidente)',
    rajoy: 'Rajoy-Bonnie (Ala Oeste)',
    montero: 'Montero-Chica (Ala Este)',
    abascal: 'Abascal-Foxy (Sprint Cala 1C)',
    echenique: 'Echenique-Golden Freddy (Anomalía 1/1000)',
  };

  let cause = 'Turno completado hasta las 6:00 AM.';
  if (state.status === 'defeat') {
    if (state.powerOutage) {
      cause = 'Apagón energético (0% Batería) — Marcha de Pedro-Freddy en la oscuridad.';
    } else if (state.jumpscareBy === 'echenique') {
      cause =
        'Echenique-Golden Freddy permaneció más de 2.5 segundos en el despacho sin que subieras el monitor CCTV.';
    } else if (state.jumpscareBy === 'abascal') {
      cause = 'Abascal-Foxy irrumpió por el Pasillo Oeste (CAM 2A) con la Puerta Izquierda abierta.';
    } else if (state.jumpscareBy === 'rajoy') {
      cause = 'Rajoy-Bonnie entró desde el punto ciego izquierdo y bloqueó los controles.';
    } else if (state.jumpscareBy === 'montero') {
      cause = 'Montero-Chica entró desde la ventana derecha con la Puerta Derecha abierta.';
    } else if (state.jumpscareBy === 'pedro') {
      cause = 'Pedro-Freddy se infiltró desde la Esquina Este (CAM 4B) sin vigilancia.';
    }
  }

  return {
    outcome: state.status === 'victory' ? 'victory' : 'defeat',
    nightNumber: state.nightNumber,
    hourReached: state.status === 'victory' ? '6 AM' : formatFnafHour(state.currentHour),
    powerRemainingPercent: Math.max(0, Math.floor(state.powerTenths / 10)),
    jumpscareBy: state.jumpscareBy,
    causeOfDefeat: state.jumpscareBy
      ? `${names[state.jumpscareBy]} · ${cause}`
      : cause,
    abascalBangs: state.abascalBangsCount,
    aiLevels: { ...state.baseAI },
  };
}
