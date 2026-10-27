import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AnimatronicId,
  AnimatronicState,
  CampaignProgress,
  CustomAILevels,
  DEMO_FEEDBACK_TEXT,
  DEMO_GAMEJOLT_URL,
  DEMO_MAX_PLAYABLE_NIGHT,
  DEMO_THANKS_HOLD_SECONDS,
  DEMO_THANKS_TITLE,
  INITIAL_CAMPAIGN_PROGRESS,
  NodeId,
  OfficeDefenseState,
  VENT_CLOSED_MAX_WAIT_SEC,
  apply2AMNightmareActivation,
  apply3AMPhaseShift,
  calculatePowerDrain,
  createInitialAnimatronics,
  getNightConfig,
  getPostVictoryAction,
  isCustomNightUnlocked,
  isExtraNightsSectionUnlocked,
  isGameplayFrozenByNarrative,
  isNight7Unlocked,
  recordNightVictory,
  stepAnimatronicMovement,
} from './game/rules';
import { hitTestOfficeWallButtons, renderOfficeScene } from './game/officeRenderer';
import { drawAnimatronic } from './game/animatronicsRenderer';
import { soundController } from './game/audio';
import { TitleScreen } from './components/TitleScreen';
import { CameraMonitorOverlay } from './components/CameraMonitorOverlay';
import { AnimatronicBestiaryModal } from './components/AnimatronicBestiaryModal';
import { VictoryClockSequence } from './components/VictoryClockSequence';
import { EightBitIntroMinigame } from './components/EightBitIntroMinigame';
import { OfficePhoneNarrativeOverlay } from './components/OfficePhoneNarrativeOverlay';

type ShellState =
  | 'title'
  | 'intro_minigame'
  | 'playing'
  | 'paused'
  | 'victory_clock'
  | 'demo_complete'
  | 'gameover';

interface EndOfRunSnapshot {
  outcome: 'victory' | 'defeat';
  nightNumber: number;
  nightLabel: string;
  hourReached: number;
  powerRemaining: number;
  killedBy: AnimatronicId | null;
  blockedAttacksCount: number;
  newlyUnlockedNote?: string;
}

interface NightTransitionState {
  active: boolean;
  heavyGlitchPhase: boolean;
  nightNumber: number;
  nightTitleQuoted: string;
}

const SAVE_STORAGE_KEY = 'still_nights_save_v3';
const HOUR_DURATION_SECONDS = 51; // 51s per in-game hour (306s = 5m 06s per full 6-hour night)

export default function App() {
  const [shellState, setShellState] = useState<ShellState>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('demo_end') === '1') {
        return 'demo_complete';
      }
      if (params.get('intro') === '1') {
        return 'intro_minigame';
      }
      if (params.get('autostart') === '1') {
        return 'playing';
      }
    }
    return 'title';
  });

  // Campaign progression state (persisted in localStorage, capped at Night 2 for the Demo)
  const [progress, setProgress] = useState<CampaignProgress>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('unlock_all') === '1') {
        return {
          hasStartedNewGame: true,
          currentCampaignNight: DEMO_MAX_PLAYABLE_NIGHT,
          highestNightCompleted: DEMO_MAX_PLAYABLE_NIGHT,
        };
      }
      try {
        const raw = window.localStorage.getItem(SAVE_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<CampaignProgress>;
          if (
            typeof parsed.hasStartedNewGame === 'boolean' &&
            typeof parsed.currentCampaignNight === 'number' &&
            typeof parsed.highestNightCompleted === 'number'
          ) {
            return {
              hasStartedNewGame: parsed.hasStartedNewGame,
              currentCampaignNight: Math.min(DEMO_MAX_PLAYABLE_NIGHT, Math.max(1, parsed.currentCampaignNight)),
              highestNightCompleted: Math.min(DEMO_MAX_PLAYABLE_NIGHT, Math.max(0, parsed.highestNightCompleted)),
            };
          }
        }
      } catch {
        // Ignore storage read errors
      }
    }
    return INITIAL_CAMPAIGN_PROGRESS;
  });

  // Persist progress changes to localStorage
  useEffect(() => {
    try {
      window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(progress));
    } catch {
      // Ignore storage write errors
    }
  }, [progress]);

  const [selectedNight, setSelectedNight] = useState<number>(1);
  const [customAI, setCustomAI] = useState<CustomAILevels>({
    freddy: 20,
    bonnie: 20,
    chica: 20,
    nightmare: 20,
    blob: 20,
  });
  const [extrasOpen, setExtrasOpen] = useState<boolean>(false);
  const [muted, setMuted] = useState<boolean>(false);
  const [hoveringWallSwitch, setHoveringWallSwitch] = useState<boolean>(false);
  const [devSkipToast, setDevSkipToast] = useState<string | null>(null);
  const [officeNarrativeActive, setOfficeNarrativeActive] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('office_narrative') === '1') return true;
    }
    return false;
  });

  // Night Transition Screen State ("12:00 AM Noche X" + '"Nombre de la noche"' + Heavy Glitch if not a fresh New Game)
  const [nightTransition, setNightTransition] = useState<NightTransitionState>({
    active: false,
    heavyGlitchPhase: false,
    nightNumber: 1,
    nightTitleQuoted: '"El Despertar de Still Freddy"',
  });
  const transitionTimerRef = useRef<number[]>([]);

  // Live HUD discrete states
  const [currentHour, setCurrentHour] = useState<number>(0); // 0 = 12 AM, 1 = 1 AM ... 6 = 6 AM
  const [powerInt, setPowerInt] = useState<number>(100);
  const [usageBars, setUsageBars] = useState<number>(1);
  const [viewZone, setViewZone] = useState<'left' | 'center' | 'right'>('center');
  const [defense, setDefense] = useState<OfficeDefenseState>({
    leftDoorClosed: false,
    rightDoorClosed: false,
    ventClosed: false,
    leftLightOn: false,
    rightLightOn: false,
    cameraOpen: false,
  });
  const [selectedCam, setSelectedCam] = useState<NodeId>('CAM_1A');
  const [animatronics, setAnimatronics] = useState<Record<AnimatronicId, AnimatronicState>>(() =>
    createInitialAnimatronics(getNightConfig(1))
  );
  const [staticBurst, setStaticBurst] = useState<number>(0);
  const [acousticAlert, setAcousticAlert] = useState<string>('SISTEMA ACÚSTICO EN LÍNEA');
  const [endSnapshot, setEndSnapshot] = useState<EndOfRunSnapshot | null>(null);

  // Mutable simulation refs for 60Hz loop without React re-render overhead
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const shellStateRef = useRef<ShellState>(shellState);
  shellStateRef.current = shellState;

  const nightTransitionRef = useRef<NightTransitionState>(nightTransition);
  nightTransitionRef.current = nightTransition;

  const officeNarrativeRef = useRef<boolean>(officeNarrativeActive);
  officeNarrativeRef.current = officeNarrativeActive;

  const defenseRef = useRef<OfficeDefenseState>(defense);
  defenseRef.current = defense;

  const animsRef = useRef<Record<AnimatronicId, AnimatronicState>>(animatronics);
  animsRef.current = animatronics;

  const simRef = useRef({
    elapsedNightSec: 0,
    hour: 0,
    power: 100,
    panX: 0,
    targetPanX: 0,
    panVel: 0, // Velocity from mouse edge panning (strictly directional per half of screen)
    leftDoorAnim: 0,
    rightDoorAnim: 0,
    ventDoorAnim: 0,
    officeFlickerMs: 0,
    jumpscareActive: false,
    jumpscareBy: null as AnimatronicId | null,
    jumpscareTimerSec: 0,
    blockedCount: 0,
    phaseShift2AMDone: false,
    phaseShift3AMDone: false,
  });

  // Sync body[data-state] attribute & keep background audio loops active
  useEffect(() => {
    document.body.dataset.state = shellState;
    soundController.ensureBackgroundLoops(shellState === 'title');
  }, [shellState]);

  // Start looped creepy ambience + soft menu music on first user gesture ONLY when in the main menu
  useEffect(() => {
    const startAudioOnGesture = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest?.('[data-menu-exit="true"]')) {
        return;
      }
      if (shellStateRef.current === 'title') {
        soundController.ensureBackgroundLoops(true);
      }
    };
    window.addEventListener('pointerdown', startAudioOnGesture, { passive: true });
    window.addEventListener('keydown', startAudioOnGesture, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', startAudioOnGesture);
      window.removeEventListener('keydown', startAudioOnGesture);
    };
  }, []);

  const clearTransitionTimers = useCallback(() => {
    transitionTimerRef.current.forEach((id) => window.clearTimeout(id));
    transitionTimerRef.current = [];
  }, []);

  const dismissNightTransition = useCallback(() => {
    clearTransitionTimers();
    setNightTransition((prev) => ({ ...prev, active: false, heavyGlitchPhase: false }));
  }, [clearTransitionTimers]);

  const setOfficeLookTarget = useCallback(
    (panTarget: number) => {
      dismissNightTransition();
      const clamped = Math.max(-1, Math.min(1, panTarget));
      simRef.current.panVel = 0;
      simRef.current.targetPanX = clamped;
      if (clamped < -0.35) setViewZone('left');
      else if (clamped > 0.35) setViewZone('right');
      else setViewZone('center');
    },
    [dismissNightTransition]
  );

  const startNight = useCallback(
    (
      nightToStart = selectedNight,
      customLevels = customAI,
      options?: {
        isContinuationOrRetry?: boolean;
        skipTransition?: boolean;
        suppressTransitionSound?: boolean;
        enableOfficeNarrative?: boolean;
      }
    ) => {
      clearTransitionTimers();
      soundController.stopPhoneRingSequence();
      const clampedNight = Math.min(DEMO_MAX_PLAYABLE_NIGHT, Math.max(1, nightToStart));
      setSelectedNight(clampedNight);
      const cfg = getNightConfig(clampedNight, customLevels);
      const initialAnims = createInitialAnimatronics(cfg);
      const urlParams = new URLSearchParams(window.location.search);
      const isCam4ADemo = urlParams.get('cam4a_demo') === '1';
      if (isCam4ADemo) {
        initialAnims.freddy.location = 'CAM_4A';
      }

      const shouldRunNarrative = Boolean(options?.enableOfficeNarrative) && clampedNight === 1;
      setOfficeNarrativeActive(shouldRunNarrative);
      officeNarrativeRef.current = shouldRunNarrative;

      const initialDefense: OfficeDefenseState = {
        leftDoorClosed: false,
        rightDoorClosed: false,
        ventClosed: false,
        leftLightOn: false,
        rightLightOn: false,
        cameraOpen: false,
      };

      simRef.current = {
        elapsedNightSec: 0,
        hour: 0,
        power: 100,
        panX: 0,
        targetPanX: 0,
        panVel: 0,
        leftDoorAnim: 0,
        rightDoorAnim: 0,
        ventDoorAnim: 0,
        officeFlickerMs: 0,
        jumpscareActive: false,
        jumpscareBy: null,
        jumpscareTimerSec: 0,
        blockedCount: 0,
        phaseShift2AMDone: false,
        phaseShift3AMDone: false,
      };

      setViewZone('center');
      setDefense(initialDefense);
      defenseRef.current = initialDefense;
      setAnimatronics(initialAnims);
      animsRef.current = initialAnims;
      setCurrentHour(0);
      setPowerInt(100);
      setUsageBars(1);
      setSelectedCam(isCam4ADemo ? 'CAM_4A' : 'CAM_1A');
      setEndSnapshot(null);
      setAcousticAlert(
        clampedNight === 2
          ? '12:00 AM · STILL FREDDY Y STILL BONNIE ACTIVOS (CHICA DESPIERTA 3 AM)'
          : 'SENSORES DE PASILLOS Y CONDUCTOS ACTIVOS'
      );

      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      shellStateRef.current = 'playing';
      document.body.dataset.state = 'playing';
      setShellState('playing');
      soundController.stopMenuMusic();
      soundController.ensureBackgroundLoops(false);

      if (options?.skipTransition) {
        setNightTransition({
          active: false,
          heavyGlitchPhase: false,
          nightNumber: clampedNight,
          nightTitleQuoted: `"${cfg.subtitle}"`,
        });
        return;
      }

      const isNotNewGame = Boolean(options?.isContinuationOrRetry) || clampedNight > 1;

      setNightTransition({
        active: true,
        heavyGlitchPhase: isNotNewGame,
        nightNumber: clampedNight,
        nightTitleQuoted: `"${cfg.subtitle}"`,
      });

      if (isNotNewGame) {
        const t1 = window.setTimeout(() => {
          setNightTransition((prev) => ({ ...prev, heavyGlitchPhase: false }));
        }, 650);
        transitionTimerRef.current.push(t1);
      }

      const t2 = window.setTimeout(() => {
        setNightTransition((prev) => ({ ...prev, active: false, heavyGlitchPhase: false }));
      }, isNotNewGame ? 2200 : 1700);
      transitionTimerRef.current.push(t2);
    },
    [selectedNight, customAI, clearTransitionTimers]
  );

  // Start a New Game from the Main Menu -> stops main menu music & static immediately and launches the 8-Bit Story Intro Minigame!
  const handleStartNewGame = useCallback(() => {
    clearTransitionTimers();
    shellStateRef.current = 'intro_minigame';
    document.body.dataset.state = 'intro_minigame';
    soundController.stopPhoneRingSequence();
    soundController.stopMenuMusic();
    soundController.ensureBackgroundLoops(false);
    setProgress((prev) => ({
      ...prev,
      hasStartedNewGame: true,
      currentCampaignNight: 1,
    }));
    setShellState('intro_minigame');
  }, [clearTransitionTimers]);

  // Continue Campaign from the Main Menu (capped at Night 2 in the Demo)
  const handleContinueCampaign = useCallback(() => {
    if (!progress.hasStartedNewGame) return;
    shellStateRef.current = 'playing';
    soundController.stopMenuMusic();
    soundController.ensureBackgroundLoops(false);
    const nightToPlay = Math.min(DEMO_MAX_PLAYABLE_NIGHT, progress.currentCampaignNight);
    startNight(nightToPlay, customAI, {
      isContinuationOrRetry: true,
      enableOfficeNarrative: false,
    });
  }, [progress.hasStartedNewGame, progress.currentCampaignNight, customAI, startNight]);

  // Reset all saved progress after holding the "Borrar Progreso" button for 3 seconds
  const handleResetProgress = useCallback(() => {
    try {
      window.localStorage.removeItem(SAVE_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
    setProgress(INITIAL_CAMPAIGN_PROGRESS);
    setSelectedNight(1);
  }, []);

  // Extra Nights are locked in the Demo
  const handleLaunchExtraNight = useCallback(
    (_nightNum: number) => {
      return;
    },
    []
  );

  // Initialize autostart if needed
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      const requestedNight = Number(params.get('night')) === 2 ? 2 : 1;
      setProgress((prev) => ({
        ...prev,
        hasStartedNewGame: true,
        currentCampaignNight: requestedNight,
      }));
      startNight(requestedNight, customAI, {
        skipTransition: true,
        enableOfficeNarrative: params.get('office_narrative') === '1',
      });
    }
    return () => clearTransitionTimers();
  }, []);

  // Defense control handlers (optional preserveLook when clicking directly on physical wall switches)
  const toggleLeftDoor = useCallback(
    (opts?: { preserveLook?: boolean }) => {
      if (shellStateRef.current !== 'playing' || simRef.current.power <= 0) return;
      if (!opts?.preserveLook) {
        setOfficeLookTarget(-1);
      } else {
        dismissNightTransition();
      }
      setDefense((prev) => {
        const next = { ...prev, leftDoorClosed: !prev.leftDoorClosed };
        defenseRef.current = next;
        soundController.playDoorSlam(next.leftDoorClosed);
        setUsageBars(calculatePowerDrain(next).usageBars);
        return next;
      });
    },
    [setOfficeLookTarget, dismissNightTransition]
  );

  const toggleRightDoor = useCallback(
    (opts?: { preserveLook?: boolean }) => {
      if (shellStateRef.current !== 'playing' || simRef.current.power <= 0) return;
      if (!opts?.preserveLook) {
        setOfficeLookTarget(1);
      } else {
        dismissNightTransition();
      }
      setDefense((prev) => {
        const next = { ...prev, rightDoorClosed: !prev.rightDoorClosed };
        defenseRef.current = next;
        soundController.playDoorSlam(next.rightDoorClosed);
        setUsageBars(calculatePowerDrain(next).usageBars);
        return next;
      });
    },
    [setOfficeLookTarget, dismissNightTransition]
  );

  const toggleVentSeal = useCallback(() => {
    if (shellStateRef.current !== 'playing' || simRef.current.power <= 0) return;
    dismissNightTransition();
    setDefense((prev) => {
      const next = { ...prev, ventClosed: !prev.ventClosed };
      defenseRef.current = next;
      soundController.playDoorSlam(next.ventClosed);
      setUsageBars(calculatePowerDrain(next).usageBars);
      return next;
    });
  }, [dismissNightTransition]);

  const toggleLeftLight = useCallback(
    (opts?: { preserveLook?: boolean }) => {
      if (shellStateRef.current !== 'playing' || simRef.current.power <= 0) return;
      if (!opts?.preserveLook) {
        setOfficeLookTarget(-1);
      } else {
        dismissNightTransition();
      }
      setDefense((prev) => {
        const next = {
          ...prev,
          leftLightOn: !prev.leftLightOn,
          rightLightOn: false,
        };
        defenseRef.current = next;
        soundController.playCameraBlip();
        setUsageBars(calculatePowerDrain(next).usageBars);
        return next;
      });
    },
    [setOfficeLookTarget, dismissNightTransition]
  );

  const toggleRightLight = useCallback(
    (opts?: { preserveLook?: boolean }) => {
      if (shellStateRef.current !== 'playing' || simRef.current.power <= 0) return;
      if (!opts?.preserveLook) {
        setOfficeLookTarget(1);
      } else {
        dismissNightTransition();
      }
      setDefense((prev) => {
        const next = {
          ...prev,
          rightLightOn: !prev.rightLightOn,
          leftLightOn: false,
        };
        defenseRef.current = next;
        soundController.playCameraBlip();
        setUsageBars(calculatePowerDrain(next).usageBars);
        return next;
      });
    },
    [setOfficeLookTarget, dismissNightTransition]
  );

  const toggleCameraMonitor = useCallback(() => {
    if (shellStateRef.current !== 'playing' || simRef.current.power <= 0) return;
    dismissNightTransition();
    setDefense((prev) => {
      const next = {
        ...prev,
        cameraOpen: !prev.cameraOpen,
        leftLightOn: false,
        rightLightOn: false,
      };
      defenseRef.current = next;
      soundController.playCameraBlip();
      setStaticBurst(0.6);
      setUsageBars(calculatePowerDrain(next).usageBars);
      return next;
    });
  }, [dismissNightTransition]);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      soundController.setMuted(next);
      return next;
    });
  }, []);

  // Developer / Master Shortcut: Control + Ñ
  // - Inside the 8-bit intro minigame: skips straight into the Night 1 Office narrative.
  // - Inside a night: completes the current night via the 12:00 AM -> 6:00 AM Clock Counter Animation.
  // - On the Main Menu: unlocks the 5 main nights (Extra Nights section unlocked with ONLY Night 6 playable;
  //   Night 7 and Night 8 Custom Night remain locked until you actually play and beat Night 6 and Night 7!).
  const triggerSkipNightAndUnlockAll = useCallback(() => {
    dismissNightTransition();
    soundController.stopPhoneRingSequence();
    setOfficeNarrativeActive(false);
    officeNarrativeRef.current = false;

    if (shellStateRef.current === 'intro_minigame') {
      setDevSkipToast('⚡ [CTRL+Ñ] MINIJUEGO 8-BIT SALTADO · ENTRANDO A LA OFICINA');
      window.setTimeout(() => setDevSkipToast(null), 3000);
      startNight(1, customAI, {
        isContinuationOrRetry: false,
        skipTransition: true,
        enableOfficeNarrative: true,
      });
      return;
    }

    if (shellStateRef.current === 'playing' || shellStateRef.current === 'paused') {
      setProgress((prev) => recordNightVictory(prev, selectedNight));

      const unlockNote =
        selectedNight === 1
          ? 'COMANDO CTRL+Ñ: NOCHE 1 COMPLETADA · AVANZANDO A NOCHE 2'
          : 'COMANDO CTRL+Ñ: NOCHE 2 (FIN DE LA DEMO) COMPLETADA';

      setDevSkipToast(`⚡ [CTRL+Ñ] ${unlockNote}`);
      window.setTimeout(() => setDevSkipToast(null), 3500);

      const cfg = getNightConfig(selectedNight, customAI);
      const snap: EndOfRunSnapshot = {
        outcome: 'victory',
        nightNumber: selectedNight,
        nightLabel: cfg.label,
        hourReached: 6,
        powerRemaining: Math.max(1, Math.round(simRef.current.power)),
        killedBy: null,
        blockedAttacksCount: simRef.current.blockedCount,
        newlyUnlockedNote: unlockNote,
      };
      setEndSnapshot(snap);
      setShellState('victory_clock');
    } else if (shellStateRef.current === 'title') {
      setProgress({
        hasStartedNewGame: true,
        currentCampaignNight: DEMO_MAX_PLAYABLE_NIGHT,
        highestNightCompleted: DEMO_MAX_PLAYABLE_NIGHT,
      });
      setDevSkipToast(
        '⚡ [CTRL+Ñ] DEMO: NOCHES 1 Y 2 DESBLOQUEADAS (RESTO BLOQUEADO EN VERSIÓN DEMO)'
      );
      window.setTimeout(() => setDevSkipToast(null), 3800);
    }
  }, [dismissNightTransition, selectedNight, customAI, startNight]);

  // Automatic return to Main Menu after showing the Demo Completion screen ("Muchas gracias por jugar la demo")
  useEffect(() => {
    if (shellState !== 'demo_complete') return;
    const timer = window.setTimeout(() => {
      soundController.stopAll(false);
      clearTransitionTimers();
      setShellState('title');
    }, DEMO_THANKS_HOLD_SECONDS * 1000);
    return () => window.clearTimeout(timer);
  }, [shellState, clearTransitionTimers]);

  // Keyboard shortcuts (including Control + Ñ to skip nights & unlock progression)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const code = e.code;
      const keyLower = e.key.toLowerCase();

      // Control + Ñ (or Semicolon physical key on Spanish layout while holding Ctrl)
      if (
        (e.ctrlKey || e.metaKey) &&
        (keyLower === 'ñ' || code === 'Semicolon' || keyLower === '~')
      ) {
        e.preventDefault();
        triggerSkipNightAndUnlockAll();
        return;
      }

      if (shellStateRef.current === 'intro_minigame') {
        return;
      }

      if (shellStateRef.current === 'title') {
        if ((code === 'Enter' || code === 'Space') && !extrasOpen) {
          e.preventDefault();
          handleStartNewGame();
        }
        return;
      }

      if (code === 'Escape' || code === 'KeyP') {
        e.preventDefault();
        dismissNightTransition();
        if (shellStateRef.current === 'playing') {
          setShellState('paused');
        } else if (shellStateRef.current === 'paused') {
          setShellState('playing');
        }
        return;
      }

      if (code === 'KeyM') {
        toggleMute();
        return;
      }

      if (code === 'KeyR' && (shellStateRef.current === 'playing' || shellStateRef.current === 'paused')) {
        startNight(selectedNight, customAI, { isContinuationOrRetry: true });
        return;
      }

      if (shellStateRef.current !== 'playing') return;

      // While the Night 1 Office Monologue / Phone Call is active, all HUD & defense actions are disabled;
      // the player is only allowed to look left or right inside the office!
      if (officeNarrativeRef.current) {
        if (code === 'ArrowLeft' || code === 'KeyA') {
          setOfficeLookTarget(simRef.current.targetPanX - 0.85);
        } else if (code === 'ArrowRight' || code === 'KeyD') {
          setOfficeLookTarget(simRef.current.targetPanX + 0.85);
        }
        return;
      }

      if (code === 'KeyA') toggleLeftDoor();
      else if (code === 'KeyD') toggleRightDoor();
      else if (code === 'KeyW') toggleVentSeal();
      else if (code === 'KeyQ') toggleLeftLight();
      else if (code === 'KeyE') toggleRightLight();
      else if (code === 'KeyS' || code === 'Space') {
        e.preventDefault();
        toggleCameraMonitor();
      } else if (code === 'ArrowLeft') {
        setOfficeLookTarget(simRef.current.targetPanX - 0.85);
      } else if (code === 'ArrowRight') {
        setOfficeLookTarget(simRef.current.targetPanX + 0.85);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    extrasOpen,
    selectedNight,
    customAI,
    triggerSkipNightAndUnlockAll,
    handleStartNewGame,
    startNight,
    dismissNightTransition,
    setOfficeLookTarget,
    toggleLeftDoor,
    toggleRightDoor,
    toggleVentSeal,
    toggleLeftLight,
    toggleRightLight,
    toggleCameraMonitor,
    toggleMute,
  ]);

  // Main 60Hz Canvas & Gameplay Simulation Loop
  useEffect(() => {
    let raf = 0;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(rawDt, 0.05); // Clamped dt

      const sim = simRef.current;

      if (shellStateRef.current === 'playing') {
        const cfg = getNightConfig(selectedNight, customAI);

        // CRITICAL: While Night Transition or Night 1 Office Monologue / Phone Call is active,
        // the clock (12:00 AM), power (100%), and animatronic AI do NOT advance or drain!
        if (!isGameplayFrozenByNarrative(nightTransitionRef.current.active, officeNarrativeRef.current)) {
          // 1. If Jumpscare is active, animate jumpscare for 1.75s before transitioning to Game Over modal
          if (sim.jumpscareActive && sim.jumpscareBy) {
            sim.jumpscareTimerSec += dt;
            const canvas = canvasRef.current;
            if (canvas) {
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#090406';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                drawAnimatronic(
                  ctx,
                  sim.jumpscareBy,
                  canvas.width / 2,
                  canvas.height * 0.58,
                  2.55,
                  now / 1000,
                  true,
                  1,
                  sim.jumpscareTimerSec
                );
              }
            }

            const jumpscareDurationSec = sim.jumpscareBy === 'nightmare' ? 2.25 : 1.75;
            if (sim.jumpscareTimerSec >= jumpscareDurationSec) {
              const snap: EndOfRunSnapshot = {
                outcome: 'defeat',
                nightNumber: selectedNight,
                nightLabel: cfg.label,
                hourReached: sim.hour,
                powerRemaining: Math.max(0, Math.round(sim.power)),
                killedBy: sim.jumpscareBy,
                blockedAttacksCount: sim.blockedCount,
              };
              setEndSnapshot(snap);
              setShellState('gameover');
            }
            raf = requestAnimationFrame(tick);
            return;
          }

          // 2. Advance Night Clock (12 AM -> 6 AM, 51s per hour)
          sim.elapsedNightSec += dt;
          const newHour = Math.min(6, Math.floor(sim.elapsedNightSec / HOUR_DURATION_SECONDS));
          if (newHour !== sim.hour) {
            sim.hour = newHour;
            setCurrentHour(newHour);

            // Check 6:00 AM Victory! Launches the 12:00 AM -> 6:00 AM Clock Counter Animation
            if (newHour >= 6) {
              let unlockBanner: string | undefined;
              if (selectedNight === 1) {
                unlockBanner = 'EXPEDIENTE DESBLOQUEADO EN EXTRAS: STILL FREDDY';
              } else if (selectedNight === 2) {
                unlockBanner = 'EXPEDIENTE DESBLOQUEADO EN EXTRAS: STILL BONNIE';
              } else if (selectedNight === 3) {
                unlockBanner = 'EXPEDIENTE DESBLOQUEADO EN EXTRAS: STILL CHICA Y STILL NIGHTMARE';
              } else if (selectedNight === 5) {
                unlockBanner =
                  '¡NOCHES EXTRA (NOCHE 6) Y EXPEDIENTE DE THE THING DESBLOQUEADOS EN EXTRAS!';
              } else if (selectedNight === 6) {
                unlockBanner = '¡NOCHE 7 (PESADILLA) DESBLOQUEADA EN EXTRAS!';
              } else if (selectedNight === 7) {
                unlockBanner = '¡NOCHE 8 (CUSTOM NIGHT 20/20/20/20) DESBLOQUEADA EN EXTRAS!';
              }

              setProgress((prev) => recordNightVictory(prev, selectedNight));

              const snap: EndOfRunSnapshot = {
                outcome: 'victory',
                nightNumber: selectedNight,
                nightLabel: cfg.label,
                hourReached: 6,
                powerRemaining: Math.max(0, Math.round(sim.power)),
                killedBy: null,
                blockedAttacksCount: sim.blockedCount,
                newlyUnlockedNote: unlockBanner,
              };
              setEndSnapshot(snap);
              setShellState('victory_clock');
              raf = requestAnimationFrame(tick);
              return;
            }

            // Check 2:00 AM Phase Shift (Night 3 Still Nightmare activation in CAM 03 bathrooms)
            if (newHour === 2 && cfg.has2AMNightmareActivation && !sim.phaseShift2AMDone) {
              sim.phaseShift2AMDone = true;
              const shifted2AM = apply2AMNightmareActivation(animsRef.current, cfg);
              animsRef.current = shifted2AM.animatronics;
              setAnimatronics(shifted2AM.animatronics);
              soundController.dispatchEvents(shifted2AM.events);
              setAcousticAlert(
                '¡2:00 AM! STILL NIGHTMARE SE HA ACTIVADO EN LOS BAÑOS (CAM 03)'
              );
            }

            // Check 3:00 AM Phase Shift (Night 2 Chica activation OR Nights 6 & 7 FNAF 4 Split Phase Shift)
            if (
              newHour === 3 &&
              (cfg.isFnaf4SplitNight || cfg.has3AMPhaseChange) &&
              !sim.phaseShift3AMDone
            ) {
              sim.phaseShift3AMDone = true;
              const shifted = apply3AMPhaseShift(animsRef.current, cfg);
              animsRef.current = shifted.animatronics;
              setAnimatronics(shifted.animatronics);
              soundController.dispatchEvents(shifted.events);
              if (cfg.isFnaf4SplitNight) {
                setAcousticAlert(
                  '¡3:00 AM! STILL ANIMATRONICS DESACTIVADOS · ¡THE THING HA DESPERTADO!'
                );
              } else {
                setAcousticAlert(
                  '¡3:00 AM! STILL CHICA SE HA ACTIVADO EN SALA DE MANTENIMIENTO (CAM 5)'
                );
              }
            }
          }

          // 3. Power Drain Calculation
          if (sim.power > 0) {
            const { drainPerSecond } = calculatePowerDrain(defenseRef.current);
            sim.power = Math.max(0, sim.power - drainPerSecond * dt);
            const roundedPower = Math.ceil(sim.power);
            if (roundedPower !== powerInt) {
              setPowerInt(roundedPower);
            }

            // Power Outage! All doors/vents/lights open and force off
            if (sim.power <= 0) {
              const powerlessDefense: OfficeDefenseState = {
                leftDoorClosed: false,
                rightDoorClosed: false,
                ventClosed: false,
                leftLightOn: false,
                rightLightOn: false,
                cameraOpen: false,
              };
              defenseRef.current = powerlessDefense;
              setDefense(powerlessDefense);
              setUsageBars(1);
              soundController.playPhaseShift3AM();
              setAcousticAlert('¡ENERGÍA AGOTADA! SISTEMAS DE DEFENSA DESCONECTADOS');
            }
          }

          // 4. Decay 1.5s Office Light Flicker timer & camera static burst
          if (sim.officeFlickerMs > 0) {
            sim.officeFlickerMs = Math.max(0, sim.officeFlickerMs - dt * 1000);
          }
          setStaticBurst((prev) => (prev > 0.02 ? Math.max(0, prev - dt * 1.4) : 0));

          // 5. Step Each Active Animatronic's Movement Timer & Fast Closed-Vent Retreat (2-3s max)
          let updatedAny = false;
          const nextAnims: Record<AnimatronicId, AnimatronicState> = { ...animsRef.current };

          (['freddy', 'bonnie', 'chica', 'nightmare', 'blob'] as AnimatronicId[]).forEach((id) => {
            const rawAnim = nextAnims[id];
            if (!rawAnim.active || rawAnim.aiLevel <= 0) return;

            let currentPatience = rawAnim.patienceTimer;
            let forceClosedVentRetreat = false;
            if (rawAnim.location === 'VENT_OFFICE' && defenseRef.current.ventClosed) {
              currentPatience += dt;
              if (currentPatience >= VENT_CLOSED_MAX_WAIT_SEC) {
                forceClosedVentRetreat = true;
              }
            } else {
              currentPatience = 0;
            }

            const anim: AnimatronicState = {
              ...rawAnim,
              patienceTimer: currentPatience,
            };

            const elapsedSinceMove = sim.elapsedNightSec - anim.lastMovedAt;
            if (forceClosedVentRetreat || elapsedSinceMove >= anim.moveCooldown) {
              const roll1To20 = forceClosedVentRetreat ? 1 : Math.floor(Math.random() * 20) + 1;
              const branchRoll = Math.random();
              const freddyFakeoutRoll = Math.random();

              const result = stepAnimatronicMovement(
                { ...anim, lastMovedAt: sim.elapsedNightSec },
                defenseRef.current,
                roll1To20,
                branchRoll,
                freddyFakeoutRoll
              );

              nextAnims[id] = result.nextState;
              updatedAny = true;

              if (result.audioEvents.length > 0) {
                soundController.dispatchEvents(result.audioEvents);
                setStaticBurst(0.45);

                if (result.audioEvents.includes('VENT_RETREAT_FLICKER')) {
                  sim.blockedCount += 1;
                  setAcousticAlert(
                    `¡${anim.name.toUpperCase()} SE HA IDO DEL CONDUCTO! (PARPADEO 1.5s)`
                  );
                } else if (result.audioEvents.includes('DOOR_KNOCK')) {
                  sim.blockedCount += 1;
                  setAcousticAlert(
                    id === 'nightmare'
                      ? '¡STILL NIGHTMARE BLOQUEADO EN PUERTA! (REGRESA A BAÑOS FASE 2)'
                      : `¡${anim.name.toUpperCase()} BLOQUEADO EN PUERTA!`
                  );
                } else if (result.audioEvents.includes('NIGHTMARE_FOOTSTEPS')) {
                  setAcousticAlert('¡PASOS PESADOS DE STILL NIGHTMARE EN EL PASILLO!');
                } else if (result.audioEvents.includes('FREDDY_VENT_FAKEOUT')) {
                  setAcousticAlert(`SONIDO EN CONDUCTO DE VENTILACIÓN (${anim.name})`);
                  window.setTimeout(() => {
                    if (shellStateRef.current === 'playing') {
                      setAcousticAlert('¡STILL FREDDY HA GOLPEADO EL CONDUCTO Y SE RÍE!');
                    }
                  }, 1000);
                } else if (result.audioEvents.includes('VENT_CRAWL')) {
                  setAcousticAlert(`SONIDO EN CONDUCTO DE VENTILACIÓN (${anim.name})`);
                } else if (result.audioEvents.includes('FOOTSTEPS')) {
                  setAcousticAlert(`PASOS DETECTADOS EN EL EDIFICIO (${anim.name})`);
                }
              }

              if (result.triggerOfficeFlickerMs > 0) {
                sim.officeFlickerMs = result.triggerOfficeFlickerMs;
              }

              if (result.triggeredJumpscareBy) {
                sim.jumpscareActive = true;
                sim.jumpscareBy = result.triggeredJumpscareBy;
                sim.jumpscareTimerSec = 0;
                if (defenseRef.current.cameraOpen) {
                  const closedCam = { ...defenseRef.current, cameraOpen: false };
                  defenseRef.current = closedCam;
                  setDefense(closedCam);
                }
              }
            } else {
              nextAnims[id] = anim;
            }
          });

          if (updatedAny) {
            animsRef.current = nextAnims;
            setAnimatronics(nextAnims);
          } else {
            animsRef.current = nextAnims;
          }
        }

        // Apply half-screen directional mouse pan velocity (only pans left when mouse is in left half,
        // and only pans right when mouse is in right half — never snaps back on slight movement)
        if (sim.panVel !== 0 && !defenseRef.current.cameraOpen) {
          sim.targetPanX = Math.max(-1, Math.min(1, sim.targetPanX + sim.panVel * dt));
        }

        // Smooth Mechanical Door & Vent Shutter Interpolation
        const doorSpeed = dt * 6.5;
        sim.leftDoorAnim +=
          ((defenseRef.current.leftDoorClosed ? 1 : 0) - sim.leftDoorAnim) * doorSpeed;
        sim.rightDoorAnim +=
          ((defenseRef.current.rightDoorClosed ? 1 : 0) - sim.rightDoorAnim) * doorSpeed;
        sim.ventDoorAnim +=
          ((defenseRef.current.ventClosed ? 1 : 0) - sim.ventDoorAnim) * doorSpeed;
        sim.panX += (sim.targetPanX - sim.panX) * Math.min(1, dt * 8.5);

        // Render the Detailed Wide Office Scene onto Canvas
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            renderOfficeScene(ctx, {
              width: canvas.width,
              height: canvas.height,
              timeSec: now / 1000,
              panX: sim.panX,
              powerRemaining: sim.power,
              defense: defenseRef.current,
              animatronics: animsRef.current,
              officeFlickerRemainingMs: sim.officeFlickerMs,
              leftDoorAnim: sim.leftDoorAnim,
              rightDoorAnim: sim.rightDoorAnim,
              ventDoorAnim: sim.ventDoorAnim,
            });
          }
        }
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [selectedNight, customAI, powerInt]);

  // Helper to convert a MouseEvent on the office container/canvas into canvas pixel coordinates (1440x900)
  const getCanvasCoordinates = (e: React.MouseEvent<HTMLElement>): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    // Account for object-cover scaling
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  // Directional half-screen panning + hover detection over physical wall switches:
  // "haz que la oficina solo gira hacia un lado si el raton esta en la mitad a la que se va a girar por que si no gira con cualquier leve movimiento"
  const handleOfficeMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (shellState !== 'playing' || defense.cameraOpen) {
      simRef.current.panVel = 0;
      return;
    }

    const coords = getCanvasCoordinates(e);
    if (coords && canvasRef.current && !officeNarrativeActive) {
      const hit = hitTestOfficeWallButtons(
        coords.x,
        coords.y,
        canvasRef.current.width,
        canvasRef.current.height,
        simRef.current.panX
      );
      setHoveringWallSwitch(hit !== null);
    } else if (officeNarrativeActive) {
      setHoveringWallSwitch(false);
    }

    if ((e.target as HTMLElement).closest('button')) {
      simRef.current.panVel = 0;
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const normX = ((e.clientX - rect.left) / rect.width) * 2 - 1; // -1 (left edge) to +1 (right edge), 0 = center

    // Deadzone of 36% on each side of center:
    // - Only turns LEFT (panVel < 0) when the cursor is well into the LEFT half (normX < -0.36).
    // - Only turns RIGHT (panVel > 0) when the cursor is well into the RIGHT half (normX > +0.36).
    // - Otherwise panVel = 0 so the camera stays steady where it is (allowing you to click wall buttons without turning back!).
    const deadzone = 0.36;
    if (normX < -deadzone) {
      const intensity = (Math.abs(normX) - deadzone) / (1 - deadzone); // 0..1
      simRef.current.panVel = -intensity * 1.85;
      if (simRef.current.targetPanX < -0.35) setViewZone('left');
      else if (simRef.current.targetPanX <= 0.35) setViewZone('center');
    } else if (normX > deadzone) {
      const intensity = (normX - deadzone) / (1 - deadzone); // 0..1
      simRef.current.panVel = intensity * 1.85;
      if (simRef.current.targetPanX > 0.35) setViewZone('right');
      else if (simRef.current.targetPanX >= -0.35) setViewZone('center');
    } else {
      simRef.current.panVel = 0;
    }
  };

  // Click handler for physical wall switch buttons (DOOR / LIGHT / VENT) drawn on the office canvas
  const handleOfficeCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (
      shellState !== 'playing' ||
      defense.cameraOpen ||
      nightTransition.active ||
      officeNarrativeActive
    ) {
      return;
    }
    const coords = getCanvasCoordinates(e);
    if (!coords || !canvasRef.current) return;

    const action = hitTestOfficeWallButtons(
      coords.x,
      coords.y,
      canvasRef.current.width,
      canvasRef.current.height,
      simRef.current.panX
    );

    if (action === 'LEFT_DOOR') {
      toggleLeftDoor({ preserveLook: true });
    } else if (action === 'LEFT_LIGHT') {
      toggleLeftLight({ preserveLook: true });
    } else if (action === 'RIGHT_DOOR') {
      toggleRightDoor({ preserveLook: true });
    } else if (action === 'RIGHT_LIGHT') {
      toggleRightLight({ preserveLook: true });
    } else if (action === 'VENT_SEAL') {
      toggleVentSeal();
    }
  };

  const formattedHour = currentHour === 0 ? '12:00 AM' : `${currentHour}:00 AM`;
  const activeNightConfig = getNightConfig(selectedNight, customAI);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-zinc-950 text-zinc-100 select-none font-['Plus_Jakarta_Sans']">
      {/* Toast Notification when Ctrl + Ñ is pressed */}
      {devSkipToast && (
        <div
          data-testid="ctrl-ntilde-toast"
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-xl bg-amber-500 text-zinc-950 font-mono text-xs font-bold shadow-2xl border-2 border-amber-200 pointer-events-none"
        >
          {devSkipToast}
        </div>
      )}

      {/* 1. TITLE SCREEN STATE */}
      {shellState === 'title' && (
        <TitleScreen
          progress={progress}
          onNewGame={handleStartNewGame}
          onContinueGame={handleContinueCampaign}
          onOpenExtras={() => setExtrasOpen(true)}
          onResetProgress={handleResetProgress}
        />
      )}

      {/* 1B. 8-BIT STORY INTRO MINIGAME STATE */}
      {shellState === 'intro_minigame' && (
        <EightBitIntroMinigame
          onComplete={() => {
            startNight(1, customAI, {
              isContinuationOrRetry: false,
              skipTransition: true,
              enableOfficeNarrative: true,
            });
          }}
        />
      )}

      {/* 2. PLAYING / PAUSED / GAMEOVER OFFICE CANVAS & DIEGETIC HUD */}
      {shellState !== 'title' &&
        shellState !== 'intro_minigame' &&
        shellState !== 'demo_complete' && (
        <div
          onMouseMove={handleOfficeMouseMove}
          onMouseLeave={() => {
            simRef.current.panVel = 0;
            setHoveringWallSwitch(false);
          }}
          className="relative w-full h-full overflow-hidden"
        >
          {/* Main Office & Jumpscare Canvas (with interactive physical wall buttons) */}
          <canvas
            ref={canvasRef}
            width={1440}
            height={900}
            data-testid="office-canvas"
            onClick={handleOfficeCanvasClick}
            className={`w-full h-full object-cover ${
              hoveringWallSwitch ? 'cursor-pointer' : 'cursor-default'
            }`}
          />

          {/* NIGHT TRANSITION OVERLAY ("12:00 AM Noche X" + '"Nombre de la noche"' + Heavy Glitch if not a new game) */}
          {nightTransition.active && (
            <div
              onClick={dismissNightTransition}
              data-testid="night-transition-overlay"
              className="fixed inset-0 z-30 bg-black flex flex-col items-center justify-center p-6 text-center cursor-pointer pointer-events-auto"
            >
              {nightTransition.heavyGlitchPhase ? (
                <div className="space-y-4">
                  <div className="text-red-500 font-mono text-sm tracking-widest uppercase">
                    SEÑAL CORRUPTA · INTERFERENCIA DE SISTEMA
                  </div>
                  <div className="text-6xl sm:text-7xl font-bold font-mono tracking-tighter text-white translate-x-2 skew-x-6">
                    12:00 AM
                  </div>
                  <div className="text-3xl sm:text-4xl font-bold font-['Barlow_Condensed'] uppercase tracking-widest text-sky-400 -translate-x-3">
                    Noche {nightTransition.nightNumber}
                  </div>
                  <div className="text-lg font-mono text-red-400">
                    {nightTransition.nightTitleQuoted}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-5xl sm:text-6xl font-bold font-mono tracking-tight text-white tabular-nums">
                    12:00 AM
                  </div>
                  <div className="text-3xl sm:text-4xl font-bold font-['Barlow_Condensed'] uppercase tracking-widest text-zinc-100">
                    Noche {nightTransition.nightNumber}
                  </div>
                  <div className="text-base sm:text-lg font-mono text-amber-400 pt-2">
                    {nightTransition.nightTitleQuoted}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* NIGHT 1 OFFICE MONOLOGUE + 3X RINGING PHONE + ??? CALLER OVERLAY */}
          {shellState === 'playing' && !nightTransition.active && officeNarrativeActive && (
            <OfficePhoneNarrativeOverlay
              onComplete={() => {
                setOfficeNarrativeActive(false);
                officeNarrativeRef.current = false;
                setAcousticAlert('LLAMADA FINALIZADA · ¡TURNO DE VIGILANCIA EN CURSO!');
              }}
            />
          )}

          {/* World-Matched Perimeter HUD — completely hidden while the Night 1 Office Monologue / Phone Call is active! */}
          {!officeNarrativeActive && (
          <div className="fixed inset-0 w-full h-full pointer-events-none flex flex-col justify-between p-4 sm:p-6 z-20">
            {/* TOP PERIMETER: Power & Acoustic Status (Left) + Pan Indicator + Night Clock & Utility Buttons (Right) */}
            <div className="w-full flex items-start justify-between gap-4">
              {/* Top-Left Cluster: Power Remaining + Usage Bars + Acoustic/Flicker Alert */}
              <div className="bg-zinc-950/85 border border-zinc-800 rounded-xl px-4 py-3 shadow-xl space-y-2 pointer-events-auto">
                <div className="flex items-baseline gap-4">
                  <div>
                    <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                      ENERGÍA RESTANTE
                    </div>
                    <div
                      className={`text-3xl font-bold font-mono tabular-nums ${
                        powerInt <= 20 ? 'text-red-500' : 'text-zinc-100'
                      }`}
                    >
                      {powerInt}%
                    </div>
                  </div>

                  {/* Graphical 5-pip Usage Socket */}
                  <div>
                    <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-1">
                      USO
                    </div>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((bar) => {
                        const active = bar <= usageBars;
                        const barColor =
                          bar <= 2
                            ? 'bg-emerald-500'
                            : bar === 3
                            ? 'bg-amber-400'
                            : 'bg-red-600';
                        return (
                          <div
                            key={bar}
                            className={`w-3.5 h-5 rounded-sm border ${
                              active
                                ? `${barColor} border-white/30`
                                : 'bg-zinc-900 border-zinc-700'
                            }`}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Live Acoustic & Vent Retreat Flicker Readout */}
                <div className="text-xs font-mono text-amber-300 max-w-md truncate">
                  {acousticAlert}
                </div>
              </div>

              {/* Top-Right Cluster: Clock, Night Label, and Utility Icon Buttons */}
              <div className="flex items-start gap-3 pointer-events-auto">
                <div className="bg-zinc-950/85 border border-zinc-800 rounded-xl px-4 py-2.5 text-right shadow-xl">
                  <div className="text-3xl font-bold font-mono tabular-nums tracking-tight text-white">
                    {formattedHour}
                  </div>
                  <div className="text-xs font-mono font-semibold text-red-400">
                    {activeNightConfig.label}
                    {activeNightConfig.isFnaf4SplitNight &&
                      (currentHour < 3 ? ' · FASE STILL' : ' · FASE THE THING')}
                    {activeNightConfig.nightNumber === 2 &&
                      (currentHour < 3 ? ' · FREDDY + BONNIE' : ' · + CHICA ACTIVA')}
                    {activeNightConfig.nightNumber === 3 &&
                      (currentHour < 2 ? ' · TRÍO STILL' : ' · + NIGHTMARE ACTIVO')}
                  </div>
                </div>

                {/* Compact Clickable Utility Controls (Mute [M], Pause [P], Restart [R]) */}
                <div className="flex items-center gap-1.5 bg-zinc-950/85 border border-zinc-800 rounded-xl p-1.5">
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label={muted ? 'Activar Sonido [M]' : 'Silenciar [M]'}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      toggleMute();
                    }}
                    className="w-10 h-10 flex items-center justify-center rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 text-xs font-mono font-bold"
                  >
                    {muted ? 'MUTE' : 'SND'}
                  </button>
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label="Pausar Juego [P]"
                    onClick={(e) => {
                      e.currentTarget.blur();
                      dismissNightTransition();
                      setShellState((s) => (s === 'playing' ? 'paused' : 'playing'));
                    }}
                    className="w-10 h-10 flex items-center justify-center rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 text-xs font-mono font-bold"
                  >
                    [P]
                  </button>
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label="Reiniciar Noche [R]"
                    onClick={(e) => {
                      e.currentTarget.blur();
                      startNight(selectedNight, customAI, { isContinuationOrRetry: true });
                    }}
                    className="w-10 h-10 flex items-center justify-center rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 text-xs font-mono font-bold"
                  >
                    [R]
                  </button>
                </div>
              </div>
            </div>

            {/* BOTTOM PERIMETER: Clean HUD with Dark 16-Bit "CAMARAS" Button & Two Filled Arrows Centered at Bottom */}
            <div className="w-full flex items-end justify-center">
              <button
                type="button"
                data-testid="camera-monitor-toggle-btn"
                aria-label={defense.cameraOpen ? 'Cerrar Cámaras' : 'Abrir Cámaras'}
                onClick={toggleCameraMonitor}
                className="pointer-events-auto group px-9 py-2.5 bg-zinc-950/95 hover:bg-zinc-900 text-zinc-200 hover:text-white border-2 border-zinc-700 hover:border-zinc-500 shadow-[0_6px_24px_rgba(0,0,0,0.95),inset_0_2px_0_rgba(255,255,255,0.08)] transition-all flex items-center justify-center gap-5 cursor-pointer"
                style={{ imageRendering: 'pixelated' }}
              >
                {/* Left Filled 16-Bit Pixel Arrow */}
                <svg
                  width="20"
                  height="14"
                  viewBox="0 0 20 14"
                  className={`fill-current text-zinc-300 group-hover:text-white transition-transform ${
                    defense.cameraOpen ? 'rotate-180' : ''
                  }`}
                  aria-hidden="true"
                >
                  {/* 16-bit stepped filled double/thick arrow */}
                  <polygon points="10,2 18,10 14,10 10,6 6,10 2,10" />
                  <polygon points="10,6 16,12 4,12" />
                </svg>

                {/* 16-Bit Pixel/Block Typography: CAMARAS */}
                <span
                  className="font-mono font-black text-base sm:text-lg tracking-[0.34em] uppercase text-zinc-100 drop-shadow-[2px_2px_0_rgba(0,0,0,1)]"
                  style={{
                    fontVariantNumeric: 'tabular-nums',
                    textShadow: '2px 2px 0px #000000, -1px -1px 0px #27272a',
                  }}
                >
                  CAMARAS
                </span>

                {/* Right Filled 16-Bit Pixel Arrow */}
                <svg
                  width="20"
                  height="14"
                  viewBox="0 0 20 14"
                  className={`fill-current text-zinc-300 group-hover:text-white transition-transform ${
                    defense.cameraOpen ? 'rotate-180' : ''
                  }`}
                  aria-hidden="true"
                >
                  {/* 16-bit stepped filled double/thick arrow */}
                  <polygon points="10,2 18,10 14,10 10,6 6,10 2,10" />
                  <polygon points="10,6 16,12 4,12" />
                </svg>
              </button>
            </div>
          </div>
          )}

          {/* 3. CAMERA & VENTILATION MONITOR OVERLAY */}
          <CameraMonitorOverlay
            isOpen={defense.cameraOpen}
            selectedCam={selectedCam}
            onSelectCam={setSelectedCam}
            onCloseMonitor={toggleCameraMonitor}
            animatronics={animatronics}
            staticBurst={staticBurst}
            ventClosed={defense.ventClosed}
            onToggleVent={toggleVentSeal}
            powerInt={powerInt}
            formattedHour={formattedHour}
            nightLabel={activeNightConfig.label}
          />
        </div>
      )}

      {/* 4. PAUSE MODAL ('paused') */}
      {shellState === 'paused' && (
        <div
          className="fixed inset-0 z-40 bg-black/80 flex items-center justify-center p-4 pointer-events-auto"
          role="dialog"
          aria-modal="true"
          aria-label="Juego en Pausa"
        >
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-xl p-6 space-y-5 shadow-2xl">
            <div>
              <div className="text-xs font-mono text-red-400 uppercase">
                {activeNightConfig.label} · {formattedHour}
              </div>
              <h2 className="text-3xl font-bold font-['Barlow_Condensed'] uppercase tracking-wide text-white mt-1">
                Guardia Nocturna en Pausa
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-zinc-900/60 border border-zinc-800 rounded-lg p-3 font-mono">
              <div>
                <div className="text-xs text-zinc-400">Energía</div>
                <div className="text-xl font-bold text-zinc-100 tabular-nums">{powerInt}%</div>
              </div>
              <div>
                <div className="text-xs text-zinc-400">Ataques Bloqueados</div>
                <div className="text-xl font-bold text-emerald-400 tabular-nums">
                  {simRef.current.blockedCount}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => setShellState('playing')}
                className="w-full py-3 text-sm font-bold uppercase tracking-wider bg-red-700 hover:bg-red-600 text-white rounded-lg transition-colors"
              >
                Reanudar Guardia [Esc / P]
              </button>
              <button
                type="button"
                onClick={() => startNight(selectedNight, customAI, { isContinuationOrRetry: true })}
                className="w-full py-2.5 text-xs font-mono font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg transition-colors"
              >
                Reiniciar Noche [R]
              </button>
              <button
                type="button"
                onClick={() => {
                  soundController.stopAll(false);
                  clearTransitionTimers();
                  setShellState('title');
                }}
                className="w-full py-2.5 text-xs font-mono font-semibold bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border border-zinc-800 rounded-lg transition-colors"
              >
                Volver al Menú Principal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4B. 12:00 AM -> 6:00 AM CLOCK COUNTER + CONFETTI ('victory_clock') */}
      {shellState === 'victory_clock' && endSnapshot && (
        <VictoryClockSequence
          nightLabel={endSnapshot.nightLabel}
          onSequenceComplete={() => {
            const action = getPostVictoryAction(endSnapshot.nightNumber);
            if (action.type === 'next_night') {
              startNight(action.nextNightNumber, customAI, { isContinuationOrRetry: true });
            } else if (action.type === 'demo_complete') {
              soundController.stopAll(false);
              clearTransitionTimers();
              setShellState('demo_complete');
            } else {
              soundController.stopAll(false);
              clearTransitionTimers();
              setShellState('title');
            }
          }}
        />
      )}

      {/* 4C. DEMO COMPLETION SCREEN AFTER NIGHT 2 ('demo_complete') */}
      {shellState === 'demo_complete' && (
        <div
          data-testid="demo-complete-screen"
          className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-6 text-center select-none pointer-events-auto"
          role="dialog"
          aria-modal="true"
          aria-label="Fin de la Demo"
        >
          <div className="max-w-4xl w-full bg-zinc-950/90 border-2 border-red-900/80 rounded-2xl px-8 py-12 shadow-[0_0_60px_rgba(0,0,0,0.95)] space-y-6">
            <div className="text-xs font-mono uppercase tracking-[0.38em] text-amber-400">
              STILL NIGHTS- DEMO · NOCHE 2 COMPLETADA
            </div>

            <h1
              data-testid="demo-thanks-heading"
              className="text-4xl sm:text-6xl font-bold font-['Barlow_Condensed'] uppercase tracking-wider text-amber-50 drop-shadow-[0_4px_16px_rgba(220,38,38,0.45)]"
            >
              {DEMO_THANKS_TITLE}
            </h1>

            <div className="pt-2 space-y-3">
              <p
                data-testid="demo-feedback-line"
                className="text-sm sm:text-base font-mono text-zinc-200 leading-relaxed select-text"
              >
                {DEMO_FEEDBACK_TEXT.split(DEMO_GAMEJOLT_URL)[0]}
                <a
                  href={DEMO_GAMEJOLT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-400 hover:text-amber-300 underline decoration-amber-500/70 underline-offset-4 font-bold transition-colors whitespace-nowrap"
                >
                  {DEMO_GAMEJOLT_URL}
                </a>
              </p>
            </div>

            <div className="pt-6 flex flex-col items-center gap-3">
              <button
                type="button"
                data-testid="demo-return-menu-btn"
                onClick={() => {
                  soundController.playWoodClick();
                  soundController.stopAll(false);
                  clearTransitionTimers();
                  setShellState('title');
                }}
                className="px-8 py-3.5 text-sm font-mono font-bold uppercase tracking-widest bg-red-800 hover:bg-red-700 text-amber-50 border border-amber-500/40 rounded-xl shadow-lg transition-colors cursor-pointer"
              >
                Volver al Menú Principal
              </button>
              <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest">
                Regresando automáticamente al menú principal...
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 5. VICTORY / GAME OVER MODAL ('gameover') */}
      {shellState === 'gameover' && endSnapshot && (
        <div
          className="fixed inset-0 z-40 bg-black/88 flex items-center justify-center p-4 pointer-events-auto"
          role="dialog"
          aria-modal="true"
          aria-label={endSnapshot.outcome === 'victory' ? 'Noche Superada 6 AM' : 'Fin de la Partida'}
        >
          <div className="w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-xl p-6 space-y-5 shadow-2xl">
            <div>
              <div className="text-xs font-mono uppercase tracking-wider text-zinc-400">
                {endSnapshot.nightLabel}
              </div>
              <h2
                className={`text-4xl font-bold font-['Barlow_Condensed'] uppercase tracking-wide mt-1 ${
                  endSnapshot.outcome === 'victory' ? 'text-emerald-400' : 'text-red-500'
                }`}
              >
                {endSnapshot.outcome === 'victory'
                  ? '6:00 AM · ¡Noche Superada!'
                  : 'Fin del Turno · Jumpscare'}
              </h2>
              <p className="text-sm text-zinc-300 mt-1">
                {endSnapshot.outcome === 'victory'
                  ? 'Has sobrevivido hasta las 6:00 AM manteniendo a raya a las abominaciones del edificio.'
                  : `Has sido atrapado por ${
                      endSnapshot.killedBy === 'freddy'
                        ? 'Still Freddy'
                        : endSnapshot.killedBy === 'bonnie'
                        ? 'Still Bonnie'
                        : endSnapshot.killedBy === 'chica'
                        ? 'Still Chica'
                        : endSnapshot.killedBy === 'nightmare'
                        ? 'Still Nightmare'
                        : 'The Thing'
                    }.`}
              </p>
              {endSnapshot.newlyUnlockedNote && (
                <div className="mt-3 px-3 py-2 rounded-lg bg-amber-950/60 border border-amber-500/60 text-xs font-mono font-bold text-amber-300">
                  ★ {endSnapshot.newlyUnlockedNote}
                </div>
              )}
            </div>

            {/* 3 Tabular-Nums Stat Tiles */}
            <div className="grid grid-cols-3 gap-3 bg-zinc-900/70 border border-zinc-800 rounded-lg p-3.5 font-mono">
              <div>
                <div className="text-[11px] text-zinc-400">Hora Alcanzada</div>
                <div className="text-lg font-bold text-white tabular-nums">
                  {endSnapshot.hourReached === 0 ? '12 AM' : `${endSnapshot.hourReached} AM`}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-zinc-400">Energía Final</div>
                <div className="text-lg font-bold text-amber-400 tabular-nums">
                  {endSnapshot.powerRemaining}%
                </div>
              </div>
              <div>
                <div className="text-[11px] text-zinc-400">Bloqueos</div>
                <div className="text-lg font-bold text-emerald-400 tabular-nums">
                  {endSnapshot.blockedAttacksCount}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {endSnapshot.outcome === 'victory' && selectedNight === 1 && (
                <button
                  type="button"
                  data-start="true"
                  onClick={() => {
                    startNight(2, customAI, { isContinuationOrRetry: true });
                  }}
                  className="flex-1 py-3 px-4 text-sm font-bold uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 text-zinc-950 rounded-lg transition-colors whitespace-nowrap"
                >
                  Continuar: Noche 2
                </button>
              )}

              <button
                type="button"
                data-start="true"
                onClick={() =>
                  startNight(selectedNight, customAI, { isContinuationOrRetry: true })
                }
                className="flex-1 py-3 px-4 text-sm font-bold uppercase tracking-wider bg-red-700 hover:bg-red-600 text-white rounded-lg transition-colors whitespace-nowrap"
              >
                Reintentar Noche {selectedNight}
              </button>

              <button
                type="button"
                onClick={() => {
                  soundController.stopAll(false);
                  clearTransitionTimers();
                  setShellState('title');
                }}
                className="py-3 px-4 text-xs font-mono font-semibold bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-lg transition-colors whitespace-nowrap"
              >
                Menú Principal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. EXTRAS MODAL */}
      <AnimatronicBestiaryModal
        isOpen={extrasOpen}
        onClose={() => setExtrasOpen(false)}
        progress={progress}
        customAI={customAI}
        onChangeCustomAI={setCustomAI}
        onLaunchExtraNight={handleLaunchExtraNight}
      />
    </main>
  );
}
