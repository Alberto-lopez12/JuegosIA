import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  CameraId,
  VentCameraId,
  AuronPosition,
  CAMERA_NODES,
  CHARACTER_DOSSIERS,
  CharacterId,
} from './data/fnafMapData';
import {
  AuronSpringtrapSprite,
  RubiusChepudoSprite,
  CristininiMangleSprite,
  IShowSpeedFoxySprite,
  AriGameplaysChicaSprite,
  KNekroPuppetSprite,
  HaciendaGuardBadge,
  CharacterPortrait,
} from './components/YoutuberSprites';
import { CameraMonitor } from './components/CameraMonitor';
import { MaintenancePanel, RebootTarget } from './components/MaintenancePanel';
import {
  FreddyOfficePoster,
  ChildrenStreamerDrawings,
  DeskBobbleheads,
} from './components/OfficeEasterEggs';
import { useSoundEffects, NIGHT_PHONE_CALLS } from './utils/sound';
import {
  Volume2,
  VolumeX,
  Wrench,
  Cctv,
  AlertTriangle,
  BookOpen,
  Play,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Flame,
  Tv,
  PhoneOff,
  Sparkles,
  Maximize2,
  Minimize2,
  Trash2,
} from 'lucide-react';

type GameScreen =
  | 'TITLE'
  | 'DOSSIER'
  | 'EXTRAS'
  | 'NIGHT_INTRO'
  | 'PLAYING'
  | 'GAME_OVER'
  | 'VICTORY_NIGHT'
  | 'CUSTOM_NIGHT';

interface AIWeights {
  AURONPLAY: number;
  RUBIUS_CHEPUDO: number;
  CRISTININI: number;
  CHIQUI_IBAI: number;
  ISHOWSPEED: number;
  ARIGAMEPLAYS: number;
  KNEKRO: number;
}

const SAVE_STORAGE_KEY = 'fnaf_andorra_save_v1';

interface SavedProgress {
  savedNight: number;
  night5Cleared: boolean;
  night6Cleared: boolean;
}

/**
 * CANONICAL FNAF 3 DIFFICULTY PROGRESSION:
 * - Night 1: ZERO animatronics & ZERO phantoms (100% faithful to FNAF 3 Night 1).
 * - Night 2: AuronPlay (Springtrap) + Chiqui-Ibai (BB) + AriGameplays (Chica 3,99$) + Cristinini (Mangle) + KNekro (Puppet CAM 08) activate!
 * - Night 3+: El Rubius Chepudo (Phantom Freddy) + IShowSpeed (Phantom Foxy) join the hunt!
 */
const NIGHT_PRESETS: Record<number, AIWeights> = {
  1: { AURONPLAY: 0, RUBIUS_CHEPUDO: 0, CRISTININI: 0, CHIQUI_IBAI: 0, ISHOWSPEED: 0, ARIGAMEPLAYS: 0, KNEKRO: 0 },
  2: { AURONPLAY: 7, RUBIUS_CHEPUDO: 0, CRISTININI: 6, CHIQUI_IBAI: 7, ISHOWSPEED: 0, ARIGAMEPLAYS: 7, KNEKRO: 6 },
  3: { AURONPLAY: 11, RUBIUS_CHEPUDO: 9, CRISTININI: 8, CHIQUI_IBAI: 9, ISHOWSPEED: 9, ARIGAMEPLAYS: 9, KNEKRO: 9 },
  4: { AURONPLAY: 15, RUBIUS_CHEPUDO: 12, CRISTININI: 12, CHIQUI_IBAI: 12, ISHOWSPEED: 12, ARIGAMEPLAYS: 13, KNEKRO: 13 },
  5: { AURONPLAY: 18, RUBIUS_CHEPUDO: 16, CRISTININI: 15, CHIQUI_IBAI: 16, ISHOWSPEED: 16, ARIGAMEPLAYS: 17, KNEKRO: 16 },
  6: { AURONPLAY: 20, RUBIUS_CHEPUDO: 18, CRISTININI: 18, CHIQUI_IBAI: 18, ISHOWSPEED: 18, ARIGAMEPLAYS: 18, KNEKRO: 18 },
};


export interface ActiveScareData {
  character: CharacterId;
  title: string;
  subtitle: string;
  direction: 'CENTER' | 'LEFT' | 'RIGHT';
  isLethal?: boolean;
}

export default function App() {
  // Persistent Save Progress (loaded from localStorage)
  const [savedNight, setSavedNight] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(SAVE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SavedProgress>;
        if (typeof parsed.savedNight === 'number' && parsed.savedNight >= 1 && parsed.savedNight <= 6) {
          return parsed.savedNight;
        }
      }
    } catch {
      // Ignore
    }
    return 1;
  });
  const [night5Cleared, setNight5Cleared] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(SAVE_STORAGE_KEY);
      if (raw) return Boolean((JSON.parse(raw) as Partial<SavedProgress>).night5Cleared);
    } catch {
      // Ignore
    }
    return false;
  });
  const [night6Cleared, setNight6Cleared] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(SAVE_STORAGE_KEY);
      if (raw) return Boolean((JSON.parse(raw) as Partial<SavedProgress>).night6Cleared);
    } catch {
      // Ignore
    }
    return false;
  });

  // 5-Second Hold-to-Reset Progress State
  const [isHoldingReset, setIsHoldingReset] = useState<boolean>(false);
  const [resetHoldProgress, setResetHoldProgress] = useState<number>(0);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // Navigation & Game State
  const [screen, setScreen] = useState<GameScreen>('TITLE');
  const [introPhase, setIntroPhase] = useState<'STATIC' | 'TEXT' | 'FADE_OUT'>('STATIC');
  const [night, setNight] = useState<number>(1);
  const [aiWeights, setAiWeights] = useState<AIWeights>(NIGHT_PRESETS[1]);
  const [soundMuted, setSoundMuted] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [officeScale, setOfficeScale] = useState<number>(1);

  // Extras Menu State
  const [selectedExtraChar, setSelectedExtraChar] = useState<CharacterId>('AURONPLAY');
  const [extraScarePreview, setExtraScarePreview] = useState<ActiveScareData | null>(null);


  // In-Game Clock (12 AM to 6 AM -> 0 to 6)
  const [hour, setHour] = useState<number>(0);
  const [, setSecondsInHour] = useState<number>(0);

  // Office Panning (-340px = Full Left Maintenance/Doorway, 0 = Center Window, +340px = Right Camera Monitor)
  const [officePan, setOfficePan] = useState<number>(0);
  const [panDirection, setPanDirection] = useState<'LEFT' | 'RIGHT' | 'NONE'>('NONE');

  // Active Panels
  const [monitorOpen, setMonitorOpen] = useState<boolean>(false);
  const [maintenanceOpen, setMaintenanceOpen] = useState<boolean>(false);
  const [currentCam, setCurrentCam] = useState<CameraId>('CAM_09');
  const [mapLayer, setMapLayer] = useState<'ROOMS' | 'VENTS'>('ROOMS');
  const [staticBurst, setStaticBurst] = useState<boolean>(false);

  // Systems & Errors
  const [audioError, setAudioError] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<boolean>(false);
  const [ventilationError, setVentilationError] = useState<boolean>(false);
  const [, setAudioUsesLeft] = useState<number>(5);
  const [audioCooldown, setAudioCooldown] = useState<number>(0);
  const [sealedVent, setSealedVent] = useState<VentCameraId | null>(null);
  const [rebootingTarget, setRebootingTarget] = useState<RebootTarget>(null);
  const [rebootProgress, setRebootProgress] = useState<number>(0);
  const [blackoutOpacity, setBlackoutOpacity] = useState<number>(0);

  // Animatronic Positions & 1:1 States
  // 1. AuronPlay (Springtrap)
  const [auronPos, setAuronPos] = useState<AuronPosition>('CAM_09');
  const [auronAttackSide, setAuronAttackSide] = useState<'LEFT' | 'RIGHT'>('LEFT');
  const [auronLuredBanner, setAuronLuredBanner] = useState<string | null>(null);

  // 2. El Rubius Chepudo (Phantom Freddy) - walks across window, ducks, then jumpscares
  const [rubiusWalking, setRubiusWalking] = useState<boolean>(false);
  const rubiusStareCounterRef = useRef<number>(0);

  // 3. Cristinini (Phantom Mangle) - hangs in CAM 04 -> drops to office window causing garbled audio error
  const [cristininiCam04, setCristininiCam04] = useState<boolean>(false);
  const [cristininiWindowAttack, setCristininiWindowAttack] = useState<boolean>(false);

  // 4. Chiqui-Ibai (Phantom Balloon Boy) - blocks camera lens -> forces monitor down & jumpscares
  const [chiquiIbaiCam, setChiquiIbaiCam] = useState<CameraId | null>(null);

  // 5. IShowSpeed (Phantom Foxy) - stands in left office when closing monitor -> jumpscares when looking left
  const [speedInOfficeLeft, setSpeedInOfficeLeft] = useState<boolean>(false);

  // 6. AriGameplays (Phantom Chica + 3,99$) - CAM 07 Arcade -> arms ambush at left office door!
  const [ariArcadeCam07, setAriArcadeCam07] = useState<boolean>(false);
  const [ariArmedInOffice, setAriArmedInOffice] = useState<boolean>(false);

  // 7. KNekro (Phantom Puppet) - CAM 08 -> blocks player's face in Office, follows view & locks cameras/panel!
  const [knekroCam08, setKnekroCam08] = useState<boolean>(false);
  const [knekroOfficeBlock, setKnekroOfficeBlock] = useState<boolean>(false);
  const [knekroBlockSecondsLeft, setKnekroBlockSecondsLeft] = useState<number>(0);

  // Active Jumpscare Overlay (Used in both Gameplay and Extras Jumpscare Tester!)
  const [activeJumpscare, setActiveJumpscare] = useState<ActiveScareData | null>(null);

  // Phone Guy Call State
  const [phoneCallActive, setPhoneCallActive] = useState<boolean>(true);
  const [phoneLineIndex, setPhoneLineIndex] = useState<number>(0);

  // Stable Refs for Phantom Camera Timers & Secret Cheat Code
  const phantomCamTimerRef = useRef<number | null>(null);
  const lastCamClickRef = useRef<{ cam: CameraId; time: number }>({ cam: 'CAM_09', time: 0 });
  const pressedKeysRef = useRef<Set<string>>(new Set());
  const recentCheatKeysRef = useRef<{ key: string; time: number }[]>([]);

  const sfx = useSoundEffects();

  // Persist Save Progress helper
  const persistSave = useCallback(
    (nextNight: number, n5 = night5Cleared, n6 = night6Cleared) => {
      setSavedNight(nextNight);
      setNight5Cleared(n5);
      setNight6Cleared(n6);
      try {
        localStorage.setItem(
          SAVE_STORAGE_KEY,
          JSON.stringify({
            savedNight: nextNight,
            night5Cleared: n5,
            night6Cleared: n6,
          })
        );
      } catch {
        // Ignore storage error
      }
    },
    [night5Cleared, night6Cleared]
  );


  const clearPhantomCamTimer = useCallback(() => {
    if (phantomCamTimerRef.current) {
      clearTimeout(phantomCamTimerRef.current);
      phantomCamTimerRef.current = null;
    }
  }, []);

  // Trigger a Phantom Jumpscare (100% reliable, forces panels down, plays distinct scream, breaks Ventilation)
  const triggerPhantomJumpscare = useCallback(
    (
      character: CharacterId,
      title: string,
      subtitle: string,
      direction: 'CENTER' | 'LEFT' | 'RIGHT' = 'CENTER'
    ) => {
      clearPhantomCamTimer();
      setMonitorOpen(false);
      setMaintenanceOpen(false);
      setVentilationError(true);
      if (character === 'CHIQUI_IBAI') {
        setCameraError(true);
      }
      setActiveJumpscare({
        character,
        title,
        subtitle,
        direction,
        isLethal: false,
      });
      if (!soundMuted) {
        sfx.playCharacterJumpscareSound(character);
      }
      setTimeout(() => {
        setActiveJumpscare(null);
      }, 1450);
    },
    [clearPhantomCamTimer, sfx, soundMuted]
  );

  // Trigger AuronPlay Lethal Jumpscare (From Left Doorway or Right Vent -> Game Over)
  const triggerAuronGameOver = useCallback(
    (side: 'LEFT' | 'RIGHT') => {
      clearPhantomCamTimer();
      sfx.stopPhoneGuyCall();
      setMonitorOpen(false);
      setMaintenanceOpen(false);
      setAuronAttackSide(side);
      setActiveJumpscare({
        character: 'AURONPLAY',
        title:
          side === 'LEFT'
            ? '¡AURONPLAY ENTRÓ POR LA PUERTA IZQUIERDA!'
            : '¡AURONPLAY SALIÓ DEL CONDUCTO DERECHO!',
        subtitle: '«¡Que no pago el IRPF en España, calvo de Hacienda! ¡ABDUZCAN!»',
        direction: side,
        isLethal: true,
      });
      if (!soundMuted) {
        sfx.playCharacterJumpscareSound('AURONPLAY');
      }
      setTimeout(() => {
        setActiveJumpscare(null);
        setScreen('GAME_OVER');
      }, 1900);
    },
    [clearPhantomCamTimer, sfx, soundMuted]
  );

  // Complete Current Night (6:00 AM Victory + Save Progress)
  const completeCurrentNight = useCallback(
    (completedNightNum: number) => {
      clearPhantomCamTimer();
      sfx.stopPhoneGuyCall();
      setMonitorOpen(false);
      setMaintenanceOpen(false);
      setKnekroOfficeBlock(false);
      setActiveJumpscare(null);
      if (!soundMuted) sfx.playVictoryChime();

      const nextSaved = completedNightNum < 5 ? Math.max(savedNight, completedNightNum + 1) : 5;
      const nextN5 = completedNightNum >= 5 ? true : night5Cleared;
      const nextN6 = completedNightNum >= 6 ? true : night6Cleared;
      persistSave(nextSaved, nextN5, nextN6);
      setScreen('VICTORY_NIGHT');
    },
    [clearPhantomCamTimer, sfx, soundMuted, savedNight, night5Cleared, night6Cleared, persistSave]
  );

  // Start a Night (if isNewGame = true, resets savedNight to 1 and saves immediately)
  const startNight = (targetNight: number, customWeights?: AIWeights, isNewGame = false) => {
    clearPhantomCamTimer();
    sfx.stopPhoneGuyCall();

    if (isNewGame) {
      persistSave(1, night5Cleared, night6Cleared);
    } else if (targetNight >= 1 && targetNight <= 5 && targetNight > savedNight) {
      persistSave(targetNight, night5Cleared, night6Cleared);
    }

    const weights = customWeights || NIGHT_PRESETS[targetNight] || NIGHT_PRESETS[1];
    setNight(targetNight);
    setAiWeights(weights);
    setHour(0);
    setSecondsInHour(0);
    setOfficePan(0);
    setMonitorOpen(false);
    setMaintenanceOpen(false);
    setCurrentCam('CAM_09');
    setMapLayer('ROOMS');
    setAudioError(false);
    setCameraError(false);
    setVentilationError(false);
    setAudioUsesLeft(Math.max(3, 6 - Math.floor(targetNight / 2)));
    setAudioCooldown(0);
    setSealedVent(null);
    setRebootingTarget(null);
    setRebootProgress(0);
    setBlackoutOpacity(0);

    // On Night 1, AuronPlay is NOT in the building yet!
    setAuronPos(weights.AURONPLAY > 0 ? 'CAM_09' : ('NONE' as unknown as AuronPosition));
    setRubiusWalking(false);
    rubiusStareCounterRef.current = 0;
    setCristininiCam04(false);
    setCristininiWindowAttack(false);
    setChiquiIbaiCam(null);
    setSpeedInOfficeLeft(false);
    setAriArcadeCam07(false);
    setAriArmedInOffice(false);
    setKnekroCam08(false);
    setKnekroOfficeBlock(false);
    setKnekroBlockSecondsLeft(0);
    setActiveJumpscare(null);
    setPhoneCallActive(true);
    setPhoneLineIndex(0);
    setIntroPhase('STATIC');
    setScreen('NIGHT_INTRO');

    // Play the user's attached FNAF 3 Night Start Sound!
    if (!soundMuted) {
      sfx.playNightStartSound();
    }

    setTimeout(() => {
      setIntroPhase('TEXT');
    }, 650);

    setTimeout(() => {
      setIntroPhase('FADE_OUT');
    }, 3100);

    setTimeout(() => {
      setScreen('PLAYING');
      sfx.startPhoneGuyCall(targetNight <= 5 ? targetNight : 5, soundMuted);
    }, 4100);
  };


  // Cycle Phone Guy subtitle lines while call is active
  useEffect(() => {
    if (screen !== 'PLAYING' || !phoneCallActive) return;
    const script = NIGHT_PHONE_CALLS[night] || NIGHT_PHONE_CALLS[5];
    const lineTimer = setInterval(() => {
      setPhoneLineIndex((idx) => {
        if (idx + 1 >= script.lines.length) {
          return idx;
        }
        return idx + 1;
      });
    }, 8500);
    return () => clearInterval(lineTimer);
  }, [screen, phoneCallActive, night]);

  const handleMutePhoneCall = () => {
    sfx.stopPhoneGuyCall();
    setPhoneCallActive(false);
  };

  // Smooth Office Horizontal Panning Loop
  useEffect(() => {
    if (screen !== 'PLAYING' || monitorOpen || maintenanceOpen || panDirection === 'NONE') return;
    const interval = setInterval(() => {
      setOfficePan((prev) => {
        const step = 18;
        if (panDirection === 'LEFT') {
          return Math.max(-340, prev - step);
        } else {
          return Math.min(340, prev + step);
        }
      });
    }, 24);
    return () => clearInterval(interval);
  }, [screen, monitorOpen, maintenanceOpen, panDirection]);

  // Toggle Fullscreen Mode (Browser API + graceful fallback)
  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {
      // Fallback toggle if iframe restricts native fullscreen
      setIsFullscreen((prev) => !prev);
    }
  }, []);

  // Sync fullscreen state & calculate responsive vertical scale so the 860px office never clips!
  useEffect(() => {
    const updateLayoutScale = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
      const vh = window.innerHeight;
      // Scale office height (860px) to fit comfortably inside any viewport height
      const scale = Math.min(1.08, Math.max(0.58, (vh - 20) / 860));
      setOfficeScale(scale);
    };
    updateLayoutScale();
    window.addEventListener('resize', updateLayoutScale);
    document.addEventListener('fullscreenchange', updateLayoutScale);
    return () => {
      window.removeEventListener('resize', updateLayoutScale);
      document.removeEventListener('fullscreenchange', updateLayoutScale);
    };
  }, []);

  // 5-Second Hold-to-Reset Progress Timer
  useEffect(() => {
    if (!isHoldingReset) {
      setResetHoldProgress(0);
      return;
    }
    const interval = setInterval(() => {
      setResetHoldProgress((prev) => {
        if (prev + 2 >= 100) {
          setIsHoldingReset(false);
          try {
            localStorage.removeItem(SAVE_STORAGE_KEY);
          } catch {
            // Ignore
          }
          setSavedNight(1);
          setNight(1);
          setNight5Cleared(false);
          setNight6Cleared(false);
          if (!soundMuted) sfx.playRebootTick(true);
          setStatusBanner('¡PROGRESO BORRADO! PARTIDA REINICIADA A LA NOCHE 1.');
          setTimeout(() => setStatusBanner(null), 3500);
          return 0;
        }
        return prev + 2;
      });
    }, 100); // 50 steps * 100ms = 5000ms (5.0 seconds)
    return () => clearInterval(interval);
  }, [isHoldingReset, sfx, soundMuted]);

  // Global Keyboard Shortcuts:
  // 1) SECRET CHEAT CODE: Control + 9 + Tab + R (skips current night to 6 AM or advances night in menu)
  // 2) F or F11 for Fullscreen
  // 3) A / D or Left / Right arrows to pan office
  useEffect(() => {
    const normalizeCheatKey = (e: KeyboardEvent): string | null => {
      if (e.key === 'Control' || e.code.startsWith('Control')) return 'CONTROL';
      if (e.key === '9' || e.code === 'Digit9' || e.code === 'Numpad9') return '9';
      if (e.key === 'Tab' || e.code === 'Tab') return 'TAB';
      if (e.key === 'r' || e.key === 'R' || e.code === 'KeyR') return 'R';
      return null;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const now = Date.now();
      const cheatToken = normalizeCheatKey(e);

      if (cheatToken) {
        pressedKeysRef.current.add(cheatToken);
        if (e.ctrlKey) {
          pressedKeysRef.current.add('CONTROL');
        }
        recentCheatKeysRef.current = [
          ...recentCheatKeysRef.current.filter((item) => now - item.time < 4000),
          { key: cheatToken, time: now },
        ];
        if (e.ctrlKey && !recentCheatKeysRef.current.some((i) => i.key === 'CONTROL')) {
          recentCheatKeysRef.current.push({ key: 'CONTROL', time: now });
        }

        // Prevent browser default on Tab or Ctrl+R while inputting the secret code
        const recentSet = new Set(recentCheatKeysRef.current.map((i) => i.key));
        if (
          (cheatToken === 'TAB' || cheatToken === 'R') &&
          (e.ctrlKey || recentSet.has('CONTROL') || recentSet.has('9'))
        ) {
          e.preventDefault();
        }

        // Check if all 4 keys (CONTROL, 9, TAB, R) have been pressed/held!
        const hasAllFour =
          ['CONTROL', '9', 'TAB', 'R'].every((k) => pressedKeysRef.current.has(k)) ||
          ['CONTROL', '9', 'TAB', 'R'].every((k) => recentSet.has(k));

        if (hasAllFour) {
          e.preventDefault();
          pressedKeysRef.current.clear();
          recentCheatKeysRef.current = [];

          if (screen === 'PLAYING' || screen === 'NIGHT_INTRO') {
            setStatusBanner(`⚡ CÓDIGO SECRETO [CTRL+9+TAB+R]: NOCHE ${night} SUPERADA ⚡`);
            setTimeout(() => setStatusBanner(null), 3500);
            completeCurrentNight(night);
          } else {
            const nextN = savedNight < 5 ? savedNight + 1 : 5;
            const unlock5 = savedNight >= 5 || night5Cleared;
            const unlock6 = savedNight >= 5 ? true : night6Cleared;
            persistSave(nextN, unlock5, unlock6);
            setNight(nextN);
            if (!soundMuted) sfx.playVictoryChime();
            setStatusBanner(
              `⚡ CÓDIGO SECRETO [CTRL+9+TAB+R]: AVANZADO A NOCHE ${nextN} ${
                unlock5 ? '(MODOS EXTRA DESBLOQUEADOS)' : ''
              } ⚡`
            );
            setTimeout(() => setStatusBanner(null), 3500);
          }
          return;
        }
      }

      if (e.key === 'f' || e.key === 'F' || e.key === 'F11') {
        e.preventDefault();
        toggleFullscreen();
        return;
      }
      if (screen !== 'PLAYING') return;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        setPanDirection('LEFT');
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        setPanDirection('RIGHT');
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const cheatToken = normalizeCheatKey(e);
      if (cheatToken) {
        pressedKeysRef.current.delete(cheatToken);
      }
      if (
        e.key === 'ArrowLeft' ||
        e.key === 'a' ||
        e.key === 'A' ||
        e.key === 'ArrowRight' ||
        e.key === 'd' ||
        e.key === 'D'
      ) {
        setPanDirection('NONE');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [
    screen,
    night,
    savedNight,
    night5Cleared,
    night6Cleared,
    completeCurrentNight,
    persistSave,
    sfx,
    soundMuted,
    toggleFullscreen,
  ]);

  // 1:1 OFFICE AMBUSH CHECKS (IShowSpeed & AriGameplays 3,99$)
  // When in the office (monitor closed):
  // - If AriGameplays was armed from CAM 07 Arcade and player lowers monitor or looks left -> Ari Jumpscares from LEFT!
  // - If IShowSpeed is standing on the left of the office and player pans left (officePan <= -70) -> Speed Jumpscares from LEFT!
  useEffect(() => {
    if (screen !== 'PLAYING' || monitorOpen || maintenanceOpen || activeJumpscare) return;

    if (ariArmedInOffice && officePan <= -40) {
      setAriArmedInOffice(false);
      triggerPhantomJumpscare(
        'ARIGAMEPLAYS',
        '¡ARIGAMEPLAYS (3,99$) TE HA ASALTADO EN LA OFICINA!',
        '«¡Miraste mi máquina arcade de 3,99$ y no te suscribiste!» — Ventilación fuera de servicio.',
        'LEFT'
      );
      return;
    }

    if (speedInOfficeLeft && officePan <= -75) {
      setSpeedInOfficeLeft(false);
      triggerPhantomJumpscare(
        'ISHOWSPEED',
        '¡ISHOWSPEED TE HA SALTADO LADRANDO EN LA OFICINA!',
        '«ARF! ARF! SEWY!! RONALDO EN ANDORRA!!» — Ventilación destrozada.',
        'LEFT'
      );
    }
  }, [
    screen,
    monitorOpen,
    maintenanceOpen,
    activeJumpscare,
    ariArmedInOffice,
    speedInOfficeLeft,
    officePan,
    triggerPhantomJumpscare,
  ]);

  // Main 1-Second Game Tick (Clock, Cooldowns, Ventilation Blackout, Rubius Stare)
  useEffect(() => {
    if (screen !== 'PLAYING' || activeJumpscare?.isLethal) return;

    // Night 1 progresses slightly faster (28s per hour) since there are no animatronics, Nights 2-6 = 40s per hour
    const secondsPerHour = night === 1 ? 28 : 40;

    const timer = setInterval(() => {
      // 1. Advance Clock
      setSecondsInHour((prev) => {
        if (prev + 1 >= secondsPerHour) {
          setHour((h) => {
            const nextH = h + 1;
            if (nextH >= 6) {
              completeCurrentNight(night);
            }
            return nextH;
          });
          return 0;
        }
        return prev + 1;
      });

      // 2. Audio Cooldown & KNekro Office Block Countdown
      setAudioCooldown((c) => Math.max(0, c - 1));
      setKnekroBlockSecondsLeft((s) => {
        if (s <= 1) {
          setKnekroOfficeBlock(false);
          return 0;
        }
        return s - 1;
      });


      // 3. Ventilation Alarm & Progressive Blackout
      if (ventilationError) {
        if (!soundMuted) sfx.playAlarmBeep();
        setBlackoutOpacity((b) => Math.min(0.88, b + 0.06));
      } else {
        setBlackoutOpacity((b) => Math.max(0, b - 0.15));
      }

      // 4. El Rubius Chepudo (Phantom Freddy) Window Walk Logic (Only if RUBIUS_CHEPUDO AI > 0)
      if (aiWeights.RUBIUS_CHEPUDO > 0) {
        if (rubiusWalking) {
          // If player is looking at the office without raising Camera Monitor or Maintenance Panel
          if (!monitorOpen && !maintenanceOpen) {
            rubiusStareCounterRef.current += 1;
            if (rubiusStareCounterRef.current >= 4) {
              rubiusStareCounterRef.current = 0;
              setRubiusWalking(false);
              triggerPhantomJumpscare(
                'RUBIUS_CHEPUDO',
                '¡EL RUBIUS CHEPUDO SE AGACHÓ Y SALTÓ SOBRE TI!',
                '«¡No me mires la chepa gamer, Inspector de Hacienda!» — Ventilación apagada.',
                'CENTER'
              );
            }
          }
        } else {
          // Chance to start walking across window
          if (Math.random() * 100 < aiWeights.RUBIUS_CHEPUDO * 1.1) {
            setRubiusWalking(true);
            rubiusStareCounterRef.current = 0;
            setTimeout(() => {
              setRubiusWalking(false);
              rubiusStareCounterRef.current = 0;
            }, 8500);
          }
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [
    screen,
    activeJumpscare,
    night,
    ventilationError,
    rubiusWalking,
    monitorOpen,
    maintenanceOpen,
    aiWeights.RUBIUS_CHEPUDO,
    sfx,
    soundMuted,
    triggerPhantomJumpscare,
    completeCurrentNight,
  ]);


  // AURONPLAY (SPRINGTRAP) AI MOVEMENT ENGINE (Every 4.2 seconds, disabled on Night 1 where AI = 0)
  useEffect(() => {
    if (screen !== 'PLAYING' || aiWeights.AURONPLAY <= 0 || activeJumpscare?.isLethal) return;

    const aiInterval = setInterval(() => {
      setAuronPos((prevPos) => {
        const effectiveAI = aiWeights.AURONPLAY + (ventilationError ? 4 : 0);
        if (Math.random() * 22 > effectiveAI) {
          return prevPos;
        }

        setStaticBurst(true);
        setTimeout(() => setStaticBurst(false), 240);

        // If Auron is at DOORWAY -> He attacks from the LEFT!
        if (prevPos === 'DOORWAY') {
          triggerAuronGameOver('LEFT');
          return 'OFFICE_ATTACK';
        }

        // If Auron is at WINDOW -> He moves to DOORWAY (or attacks if ventilation is out)
        if (prevPos === 'WINDOW') {
          if (ventilationError && Math.random() < 0.45) {
            triggerAuronGameOver('RIGHT');
            return 'OFFICE_ATTACK';
          }
          return 'DOORWAY';
        }

        if (prevPos === 'OFFICE_ATTACK' || !CAMERA_NODES[prevPos as CameraId]) {
          return prevPos;
        }

        const node = CAMERA_NODES[prevPos as CameraId];

        // If Auron is inside a VENT (CAM 11 - CAM 15)
        if (node.isVent) {
          if (sealedVent === prevPos) {
            const fallbackRooms: Record<VentCameraId, CameraId> = {
              CAM_11: 'CAM_09',
              CAM_12: 'CAM_08',
              CAM_13: 'CAM_07',
              CAM_14: 'CAM_05',
              CAM_15: 'CAM_02',
            };
            return fallbackRooms[prevPos as VentCameraId];
          }

          const dest = node.connectedRooms[0];
          if (dest === 'OFFICE_ATTACK') {
            // Attacked from CAM 14 or CAM 15 right-side vents!
            triggerAuronGameOver('RIGHT');
            return 'OFFICE_ATTACK';
          }
          return dest;
        }

        // Standard Room (CAM 01 - CAM 10)
        if (node.connectedVents.length > 0 && Math.random() < 0.38) {
          const targetVent = node.connectedVents[0];
          if (sealedVent !== targetVent) {
            return targetVent;
          }
        }

        const possibleMoves = node.connectedRooms;
        const forwardMoves = possibleMoves.filter((m) => {
          if (m === 'DOORWAY' || m === 'WINDOW') return true;
          if (m.startsWith('CAM_')) {
            const currNum = parseInt(prevPos.replace('CAM_', ''), 10);
            const nextNum = parseInt(m.replace('CAM_', ''), 10);
            return nextNum < currNum;
          }
          return false;
        });

        if (forwardMoves.length > 0 && Math.random() < 0.78) {
          return forwardMoves[Math.floor(Math.random() * forwardMoves.length)];
        }
        return possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
      });
    }, 4200);

    return () => clearInterval(aiInterval);
  }, [
    screen,
    aiWeights.AURONPLAY,
    activeJumpscare,
    ventilationError,
    sealedVent,
    triggerAuronGameOver,
  ]);

  // Maintenance Reboot Loop
  useEffect(() => {
    if (!rebootingTarget) return;
    const isAll = rebootingTarget === 'ALL';
    const step = isAll ? 15 : 25;

    const interval = setInterval(() => {
      setRebootProgress((prev) => {
        if (prev + step >= 100) {
          if (!soundMuted) sfx.playRebootTick(true);
          if (rebootingTarget === 'AUDIO' || rebootingTarget === 'ALL') {
            setAudioError(false);
            setAudioUsesLeft(Math.max(3, 6 - Math.floor(night / 2)));
          }
          if (rebootingTarget === 'CAMERA' || rebootingTarget === 'ALL') {
            setCameraError(false);
          }
          if (rebootingTarget === 'VENTILATION' || rebootingTarget === 'ALL') {
            setVentilationError(false);
            setBlackoutOpacity(0);
          }
          setRebootingTarget(null);
          return 0;
        }
        if (!soundMuted) sfx.playRebootTick(false);
        return prev + step;
      });
    }, 520);

    return () => clearInterval(interval);
  }, [rebootingTarget, night, sfx, soundMuted]);

  // Camera Selection, Double-Click Vent Sealing, and 100% Reliable Phantom Timers
  const handleSelectCam = (camId: CameraId) => {
    const now = Date.now();
    const isDouble =
      lastCamClickRef.current.cam === camId && now - lastCamClickRef.current.time < 450;
    lastCamClickRef.current = { cam: camId, time: now };

    const node = CAMERA_NODES[camId];

    // Double-clicking a Vent Camera (CAM 11 - CAM 15) seals it!
    if (node.isVent && isDouble) {
      setSealedVent(camId as VentCameraId);
      if (!soundMuted) sfx.playVentSealSound();
      return;
    }

    if (camId !== currentCam) {
      // Switching cameras cancels any pending phantom trap on the previous camera!
      clearPhantomCamTimer();
      setChiquiIbaiCam(null);
      setCristininiCam04(false);
      setAriArcadeCam07(false);
      setKnekroCam08(false);

      if (!soundMuted) sfx.playCamBlip();
      setStaticBurst(true);
      setTimeout(() => setStaticBurst(false), 160);
      setCurrentCam(camId);

      // Roll for Phantom spawns on the newly selected Room Camera (Only if AI > 0)
      if (!node.isVent && !cameraError) {
        // 1. CAM 04: Cristinini (Phantom Mangle)
        if (camId === 'CAM_04' && aiWeights.CRISTININI > 0 && Math.random() * 24 < aiWeights.CRISTININI) {
          setCristininiCam04(true);
          phantomCamTimerRef.current = window.setTimeout(() => {
            setCristininiCam04(false);
            setMonitorOpen(false);
            setCristininiWindowAttack(true);
            setAudioError(true);
            if (!soundMuted) sfx.playCristininiRadioBurst();
            setTimeout(() => {
              setCristininiWindowAttack(false);
            }, 5200);
          }, 1250);
          return;
        }

        // 2. CAM 07: AriGameplays (Phantom Chica + 3,99$ Arcade Machine)
        if (camId === 'CAM_07' && aiWeights.ARIGAMEPLAYS > 0 && Math.random() * 24 < aiWeights.ARIGAMEPLAYS) {
          setAriArcadeCam07(true);
          phantomCamTimerRef.current = window.setTimeout(() => {
            setAriArcadeCam07(false);
            setAriArmedInOffice(true);
            setMonitorOpen(false);
            setOfficePan(-120);
            triggerPhantomJumpscare(
              'ARIGAMEPLAYS',
              '¡ARIGAMEPLAYS (3,99$) HA SALIDO DE LA MÁQUINA ARCADE!',
              '«¡Viste los 3,99$ en la CAM 07 y no cambiaste de cámara!» — Ventilación apagada.',
              'LEFT'
            );
          }, 1350);
          return;
        }

        // 3. CAM 08: KNekro (Phantom Puppet) -> Blocks face in office & follows your view!
        if (camId === 'CAM_08' && aiWeights.KNEKRO > 0 && Math.random() * 24 < aiWeights.KNEKRO) {
          setKnekroCam08(true);
          phantomCamTimerRef.current = window.setTimeout(() => {
            setKnekroCam08(false);
            setMonitorOpen(false);
            setMaintenanceOpen(false);
            setVentilationError(true);
            setKnekroOfficeBlock(true);
            setKnekroBlockSecondsLeft(8);
            if (!soundMuted) sfx.playKNekroPuppetSound();
          }, 1300);
          return;
        }

        // 4. Any Room Camera: Chiqui-Ibai (Phantom Balloon Boy)
        if (aiWeights.CHIQUI_IBAI > 0 && Math.random() * 28 < aiWeights.CHIQUI_IBAI) {
          setChiquiIbaiCam(camId);
          phantomCamTimerRef.current = window.setTimeout(() => {
            setChiquiIbaiCam(null);
            triggerPhantomJumpscare(
              'CHIQUI_IBAI',
              '¡CHIQUI-IBAI HA SALTADO DE LA CÁMARA A TU CARA!',
              '«¡Bueeenas tardes amigos de Hacienda!» — Ventilación y Cámaras fuera de línea.',
              'CENTER'
            );
          }, 1150);
        }
      }
    }
  };


  // Play Audio Lure ("¡Abduzcan!") in Current Room Camera
  const handlePlayAudio = () => {
    if (audioError || audioCooldown > 0 || CAMERA_NODES[currentCam].isVent) return;
    if (!soundMuted) sfx.playAudioLureSound();
    setAudioCooldown(4);

    setAudioUsesLeft((uses) => {
      if (uses - 1 <= 0) {
        setAudioError(true);
        return 0;
      }
      return uses - 1;
    });

    const targetNode = CAMERA_NODES[currentCam];
    const canLureFromWindow =
      auronPos === 'WINDOW' && (currentCam === 'CAM_02' || currentCam === 'CAM_05');
    const canLureFromDoorway =
      auronPos === 'DOORWAY' && (currentCam === 'CAM_01' || currentCam === 'CAM_02');
    const isAdjacentRoom =
      typeof auronPos === 'string' &&
      auronPos.startsWith('CAM_') &&
      targetNode.connectedRooms.includes(auronPos);

    if (canLureFromWindow || canLureFromDoorway || isAdjacentRoom) {
      if (Math.random() < 0.88) {
        setAuronPos(currentCam);
        setAuronLuredBanner(`¡AuronPlay atraído hacia ${targetNode.label} con «¡Abduzcan!»!`);
        setTimeout(() => setAuronLuredBanner(null), 3000);
      }
    }
  };

  // Close Camera Monitor -> Clear camera traps & roll for IShowSpeed (Phantom Foxy) in Left Office
  const handleCloseMonitor = () => {
    clearPhantomCamTimer();
    setMonitorOpen(false);
    setChiquiIbaiCam(null);
    setCristininiCam04(false);
    setAriArcadeCam07(false);
    setKnekroCam08(false);


    if (aiWeights.ISHOWSPEED > 0 && Math.random() * 24 < aiWeights.ISHOWSPEED) {
      setSpeedInOfficeLeft(true);
      // If player is already looking left when lowering the monitor, trigger Speed immediately!
      if (officePan <= -60) {
        setTimeout(() => {
          setSpeedInOfficeLeft(false);
          triggerPhantomJumpscare(
            'ISHOWSPEED',
            '¡ISHOWSPEED ESTABA ESPERÁNDOTE EN LA OFICINA!',
            '«ARF! ARF! SEWY!!» — Bajaste la cámara mirando hacia su esquina.',
            'LEFT'
          );
        }, 250);
      }
    } else {
      setSpeedInOfficeLeft(false);
    }
  };

  // Test any Jumpscare on demand in the Extras Menu!
  const handleTestJumpscareInExtras = (
    charId: CharacterId,
    variant: 'LEFT' | 'RIGHT' | 'CENTER' = 'CENTER'
  ) => {
    if (charId === 'CRISTININI' && variant === 'CENTER') {
      if (!soundMuted) sfx.playCristininiRadioBurst();
    } else if (charId === 'KNEKRO') {
      if (!soundMuted) sfx.playKNekroPuppetSound();
    } else {
      if (!soundMuted) sfx.playCharacterJumpscareSound(charId);
    }

    const titles: Record<CharacterId, { title: string; subtitle: string }> = {
      AURONPLAY: {
        title:
          variant === 'RIGHT'
            ? 'JUMPSCARE AURONPLAY (CONDUCTO DERECHO CAM 14/15)'
            : 'JUMPSCARE AURONPLAY (PUERTA IZQUIERDA CAM 01)',
        subtitle: '«¡Que no pago el IRPF en España, calvo de Hacienda! ¡ABDUZCAN!»',
      },
      RUBIUS_CHEPUDO: {
        title: 'JUMPSCARE EL RUBIUS (CHEPUDO) — PHANTOM FREDDY',
        subtitle: '«¡Ostia mi espalda, llevo 14 horas streameando en Andorra!»',
      },
      CRISTININI: {
        title: 'ATAQUE DE RADIO DE CRISTININI — PHANTOM MANGLE',
        subtitle: '«¡Hola chicos! ¿Se acopla el micro? ¡Te rompo el sistema de Audio!»',
      },
      CHIQUI_IBAI: {
        title: 'JUMPSCARE CHIQUI-IBAI — PHANTOM BALLOON BOY',
        subtitle: '«¡Bueeenas tardes amigos de la Velada! ¡Te apago la ventilación!»',
      },
      ISHOWSPEED: {
        title: 'JUMPSCARE ISHOWSPEED — PHANTOM FOXY',
        subtitle: '«ARF! ARF! SEWY!! RONALDO EN ANDORRA BRO!!»',
      },
      ARIGAMEPLAYS: {
        title: 'JUMPSCARE ARIGAMEPLAYS (3,99$) — PHANTOM CHICA',
        subtitle: '«¡Suscríbete en la máquina arcade por 3,99$ o te embargo el oxígeno!»',
      },
      KNEKRO: {
        title: 'BLOQUEO DE KNEKRO — PHANTOM PUPPET (CAM 08)',
        subtitle: '«¡Pero esto qué es, chavales! Me planto delante de tu cara y no abres cámaras.»',
      },
    };


    setExtraScarePreview({
      character: charId,
      title: titles[charId].title,
      subtitle: titles[charId].subtitle,
      direction: variant,
      isLethal: charId === 'AURONPLAY',
    });

    setTimeout(() => {
      setExtraScarePreview(null);
    }, 1850);
  };

  const hasAnyError = audioError || cameraError || ventilationError;
  const activeCallScript = NIGHT_PHONE_CALLS[night] || NIGHT_PHONE_CALLS[5];

  return (
    <div className="relative w-screen h-screen bg-[#050804] text-[#d4e8c4] overflow-hidden select-none">
      {/* Global CRT Scanline & Vignette Overlays */}
      <div className="fixed inset-0 crt-scanlines z-40" />
      <div className="fixed inset-0 crt-vignette z-40" />

      {/* Global Toast for Secret Cheat Code or Progress Reset */}
      {statusBanner && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-black/95 border-2 border-[#a3e635] px-6 py-2 text-2xl font-crt text-[#ecfccb] shadow-[0_0_30px_rgba(163,230,53,0.6)] animate-bounce">
          {statusBanner}
        </div>
      )}

      {/* =====================================================================
          1. TITLE MENU SCREEN (CLEAN 1:1 FNAF 3 REPLICA WITH SAVE & 5s RESET)
         ===================================================================== */}
      {screen === 'TITLE' && (
        <div className="relative w-full h-full flex flex-col justify-between p-6 md:p-10 bg-gradient-to-r from-[#040703] via-[#0a1307] to-[#12200b]">
          {/* Top Bar */}
          <header className="relative z-30 flex items-center justify-between gap-6 border-b border-[#2e4722] pb-3">
            <div className="flex items-center gap-3 shrink-0">
              <HaciendaGuardBadge className="w-10 h-10" />
              <span className="text-2xl font-crt tracking-widest text-[#b7e486]">
                AGENCIA TRIBUTARIA · ANDORRA
              </span>
              {(night5Cleared || night6Cleared) && (
                <span className="text-2xl font-crt text-amber-400 tracking-widest ml-2">
                  {night5Cleared ? '★' : ''}
                  {night6Cleared ? '★' : ''}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={toggleFullscreen}
                className="flex items-center gap-2 px-4 py-1 bg-[#1b2e13] hover:bg-[#29471c] border border-[#84cc16] text-[#ecfccb] font-crt text-xl cursor-pointer"
                title="Atajo de teclado: F o F11"
              >
                {isFullscreen ? (
                  <Minimize2 className="w-5 h-5 text-[#a3e635]" />
                ) : (
                  <Maximize2 className="w-5 h-5 text-[#a3e635]" />
                )}
                {isFullscreen ? 'SALIR PANTALLA COMPLETA [F]' : 'PANTALLA COMPLETA [F]'}
              </button>

              <button
                onClick={() => setSoundMuted(!soundMuted)}
                className="flex items-center gap-2 px-4 py-1 bg-[#13200e] hover:bg-[#1e3416] border border-[#4d7c0f] text-[#b7e486] font-crt text-xl cursor-pointer"
              >
                {soundMuted ? <VolumeX className="w-5 h-5 text-red-400" /> : <Volume2 className="w-5 h-5" />}
                {soundMuted ? 'SONIDO: OFF' : 'SONIDO: ON'}
              </button>
            </div>
          </header>

          {/* Main Split Hero */}
          <div className="relative z-30 flex-1 grid grid-cols-1 lg:grid-cols-12 items-center gap-8 my-auto">
            {/* Left Menu Column (1:1 FNAF 3 Menu Stack without manual night buttons) */}
            <div className="lg:col-span-6 space-y-4">
              <div>
                <h1 className="text-5xl sm:text-6xl xl:text-7xl font-display font-bold uppercase tracking-tight text-[#d9f99d] leading-none drop-shadow-[0_0_25px_rgba(132,204,22,0.4)]">
                  FIVE NIGHTS AT <span className="text-[#84cc16]">ANDORRA 3</span>
                </h1>
                <p className="text-xl font-crt text-[#99bd80] mt-2 max-w-md">
                  Turno de vigilancia nocturna del <strong className="text-amber-300">Inspector de Hacienda</strong> en el búnker de los Pirineos.
                </p>
              </div>

              {/* Main Menu Actions */}
              <div className="space-y-2.5 max-w-md">
                {/* NEW GAME (Starts Night 1 and saves progress) */}
                <button
                  onClick={() => startNight(1, undefined, true)}
                  className="w-full flex items-center gap-3 px-5 py-2.5 bg-[#1b2e13] hover:bg-[#29471c] border-2 border-[#84cc16] text-[#ecfccb] font-crt text-2xl sm:text-3xl tracking-widest transition-all cursor-pointer group overflow-hidden"
                >
                  <Play className="w-6 h-6 text-[#a3e635] shrink-0 group-hover:translate-x-1 transition-transform" />
                  <span className="truncate">NUEVA PARTIDA</span>
                </button>

                {/* CONTINUE SAVED GAME */}
                <button
                  onClick={() => startNight(savedNight)}
                  className="w-full flex items-center justify-between px-5 py-2.5 bg-[#12200d] hover:bg-[#1e3616] border-2 border-[#65a30d] text-[#d9f99d] font-crt text-2xl sm:text-3xl tracking-widest transition-all cursor-pointer group overflow-hidden"
                >
                  <span className="flex items-center gap-3 truncate">
                    <Play className="w-6 h-6 text-amber-400 shrink-0 group-hover:translate-x-1 transition-transform" />
                    <span className="truncate">CONTINUAR</span>
                  </span>
                  <span className="text-xl font-crt text-amber-300 shrink-0">
                    NOCHE {savedNight}
                  </span>
                </button>

                {/* 6TH NIGHT (NIGHTMARE) - Appears when Night 5 is cleared or unlocked via cheat */}
                {night5Cleared && (
                  <button
                    onClick={() => startNight(6)}
                    className="w-full flex items-center gap-3 px-5 py-2 bg-red-950/80 hover:bg-red-900 border-2 border-red-500 text-red-200 font-crt text-2xl tracking-widest cursor-pointer overflow-hidden"
                  >
                    <Flame className="w-5 h-5 text-red-400 shrink-0" />
                    <span className="truncate">6ª NOCHE (NIGHTMARE)</span>
                  </button>
                )}

                <button
                  onClick={() => setScreen('EXTRAS')}
                  className="w-full flex items-center gap-3 px-5 py-2 bg-[#24111b] hover:bg-[#3b192c] border-2 border-pink-500 text-pink-200 font-crt text-2xl tracking-widest cursor-pointer overflow-hidden"
                >
                  <Sparkles className="w-5 h-5 text-pink-400 shrink-0" />
                  <span className="truncate">EXTRAS / JUMPSCARES</span>
                </button>

                <button
                  onClick={() => setScreen('CUSTOM_NIGHT')}
                  className="w-full flex items-center gap-3 px-5 py-2 bg-[#17120a] hover:bg-[#291f10] border-2 border-amber-500/80 text-amber-300 font-crt text-2xl tracking-widest cursor-pointer overflow-hidden"
                >
                  <Flame className="w-5 h-5 text-amber-400 shrink-0" />
                  <span className="truncate">NOCHE PERSONALIZADA</span>
                </button>

                <button
                  onClick={() => setScreen('DOSSIER')}
                  className="w-full flex items-center gap-3 px-5 py-2 bg-[#0d1609] hover:bg-[#172611] border border-[#4d7c0f] text-[#b7e486] font-crt text-xl tracking-widest cursor-pointer overflow-hidden"
                >
                  <BookOpen className="w-5 h-5 shrink-0" />
                  <span className="truncate">EXPEDIENTE YOUTUBERS</span>
                </button>

                {/* HOLD FOR 5 SECONDS TO RESET PROGRESS BUTTON */}
                <button
                  onMouseDown={() => setIsHoldingReset(true)}
                  onMouseUp={() => setIsHoldingReset(false)}
                  onMouseLeave={() => setIsHoldingReset(false)}
                  onTouchStart={() => setIsHoldingReset(true)}
                  onTouchEnd={() => setIsHoldingReset(false)}
                  className="relative w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#1c0a0a] hover:bg-[#2a0f0f] border border-red-700/80 text-red-300 font-crt text-lg tracking-wider cursor-pointer overflow-hidden select-none"
                >
                  {/* 5-Second Fill Bar */}
                  <div
                    className="absolute inset-y-0 left-0 bg-red-600/50 transition-all duration-100 pointer-events-none"
                    style={{ width: `${resetHoldProgress}%` }}
                  />
                  <Trash2 className="w-4 h-4 text-red-400 relative z-10 shrink-0" />
                  <span className="relative z-10 truncate">
                    {isHoldingReset
                      ? `REINICIANDO PROGRESO... (${Math.ceil(((100 - resetHoldProgress) / 100) * 5)}s)`
                      : 'MANTENER 5s PARA RESETEAR PROGRESO'}
                  </span>
                </button>
              </div>
            </div>

            {/* Right Column: Twitching AuronPlay Springtrap Showcase */}
            <div className="lg:col-span-6 flex flex-col items-center justify-center relative">
              <div className="relative w-full max-w-md p-5 bg-[#080f06]/90 border-2 border-[#365314] shadow-[0_0_80px_rgba(101,163,13,0.25)] flex flex-col items-center overflow-hidden">
                <div className="self-start text-base font-crt text-red-500 mb-1">
                  REC CAM 09 — BÚNKER ANDORRA
                </div>
                <AuronSpringtrapSprite className="w-56 h-64 md:w-68 md:h-76 animate-crt-flicker" />
                <div className="mt-2 text-center w-full">
                  <div className="text-2xl sm:text-3xl font-crt text-[#d9f99d] tracking-widest truncate">
                    AURONPLAY · SPRINGTRAP
                  </div>
                  <div className="text-base font-crt text-[#84a964] truncate">
                    Rubius · KNekro · Cristinini · Chiqui-Ibai · Speed · Ari (3,99$)
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Cast Bar */}
          <footer className="relative z-30 border-t border-[#263b1c] pt-2.5 flex flex-wrap items-center justify-between gap-2 text-base font-crt text-[#789a61]">
            <span>GUARDIA: INSPECTOR DE HACIENDA (AEAT) · PROGRESO GUARDADO: NOCHE {savedNight}</span>
            <span>PULSA [F] PARA PANTALLA COMPLETA · USA LOS BORDES O [A / D] PARA GIRAR</span>
          </footer>
        </div>
      )}

      {/* =====================================================================
          2. EXTRAS MENU & INTERACTIVE JUMPSCARE TESTER
         ===================================================================== */}
      {screen === 'EXTRAS' && (
        <div className="relative z-30 w-full h-full bg-[#060a05] p-6 md:p-10 overflow-y-auto flex flex-col justify-between">
          <div className="max-w-6xl mx-auto w-full">
            <div className="flex items-center justify-between border-b-2 border-pink-500 pb-4 mb-6">
              <div>
                <h2 className="text-4xl md:text-5xl font-crt text-pink-400 tracking-widest">
                  EXTRAS — PROBADOR DE JUMPSCARES
                </h2>
                <p className="text-xl font-crt text-[#99bd80]">
                  Selecciona cualquier YouTuber y prueba su Jumpscare a pantalla completa
                </p>
              </div>
              <button
                onClick={() => setScreen('TITLE')}
                className="px-6 py-2.5 bg-[#1e3315] hover:bg-[#2d4d20] border-2 border-[#84cc16] text-white font-crt text-2xl tracking-wider cursor-pointer"
              >
                ◀ VOLVER
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              {/* Left Character Selector List */}
              <div className="lg:col-span-5 space-y-2.5">
                {CHARACTER_DOSSIERS.map((c) => {
                  const isSelected = selectedExtraChar === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelectedExtraChar(c.id)}
                      className={`w-full p-3.5 border-2 text-left flex items-center justify-between transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#1f3314] border-[#a3e635] text-white'
                          : 'bg-[#0c1409] hover:bg-[#152410] border-[#2d4420] text-[#99bd80]'
                      }`}
                    >
                      <div className="truncate pr-2">
                        <div className="text-2xl font-crt font-bold tracking-wider truncate">
                          {c.youtuberName}
                        </div>
                        <div className="text-base font-crt text-amber-400 truncate">
                          {c.fnafCounterpart}
                        </div>
                      </div>
                      <span className="text-base font-crt px-2 py-0.5 bg-black/60 border border-current shrink-0">
                        {c.dangerType}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Right Interactive Model Showcase & Jumpscare Trigger Stage */}
              <div className="lg:col-span-7 bg-[#0a1208] border-2 border-[#4d7c0f] p-6 flex flex-col justify-between">
                {(() => {
                  const activeChar =
                    CHARACTER_DOSSIERS.find((c) => c.id === selectedExtraChar) ||
                    CHARACTER_DOSSIERS[0];
                  return (
                    <>
                      <div className="flex items-center justify-between border-b border-[#29421e] pb-3">
                        <div>
                          <h3 className="text-4xl font-crt text-[#ecfccb]">
                            {activeChar.youtuberName}
                          </h3>
                          <p className="text-xl font-crt text-amber-400">
                            Equivalente FNAF 3: {activeChar.fnafCounterpart}
                          </p>
                        </div>
                        <Tv className="w-8 h-8 text-[#84cc16]" />
                      </div>

                      {/* Character Stage Preview */}
                      <div className="relative my-4 h-72 bg-[#050904] border-2 border-[#253b1a] flex items-center justify-center overflow-hidden">
                        <CharacterPortrait id={activeChar.id} className="w-60 h-64" />
                        {activeChar.id === 'ARIGAMEPLAYS' && (
                          <div className="absolute bottom-3 right-3 bg-black border-2 border-pink-500 px-3 py-1 text-2xl font-crt text-pink-400">
                            ARCADE CAM 07: 3,99$
                          </div>
                        )}
                      </div>

                      <div className="space-y-3">
                        <p className="text-xl font-crt text-[#b8d8a0]">
                          {activeChar.mechanicSummary}
                        </p>
                        <div className="bg-black/60 border border-amber-700/60 p-3 text-lg font-crt text-amber-300">
                          <strong>CÓMO EVITARLO EN PARTIDA:</strong> {activeChar.counterplay}
                        </div>

                        {/* JUMPSCARE TRIGGER BUTTONS */}
                        <div className="pt-2 flex flex-wrap gap-3">
                          {activeChar.id === 'AURONPLAY' ? (
                            <>
                              <button
                                onClick={() => handleTestJumpscareInExtras('AURONPLAY', 'LEFT')}
                                className="flex-1 py-3 px-4 bg-red-900 hover:bg-red-800 border-2 border-red-400 text-white font-crt text-2xl tracking-widest cursor-pointer"
                              >
                                ▶ JUMPSCARE PUERTA IZQ
                              </button>
                              <button
                                onClick={() => handleTestJumpscareInExtras('AURONPLAY', 'RIGHT')}
                                className="flex-1 py-3 px-4 bg-amber-900 hover:bg-amber-800 border-2 border-amber-400 text-white font-crt text-2xl tracking-widest cursor-pointer"
                              >
                                ▶ JUMPSCARE CONDUCTO DER
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() =>
                                handleTestJumpscareInExtras(
                                  activeChar.id,
                                  activeChar.id === 'ISHOWSPEED' || activeChar.id === 'ARIGAMEPLAYS'
                                    ? 'LEFT'
                                    : 'CENTER'
                                )
                              }
                              className="w-full py-3.5 px-6 bg-pink-900 hover:bg-pink-800 border-2 border-pink-400 text-white font-crt text-3xl tracking-widest cursor-pointer"
                            >
                              ▶ PROBAR JUMPSCARE
                            </button>
                          )}
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* Fullscreen Jumpscare Preview Modal inside Extras */}
          {extraScarePreview && (
            <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-6">
              <div
                className={
                  extraScarePreview.direction === 'LEFT'
                    ? 'animate-jumpscare-left'
                    : extraScarePreview.direction === 'RIGHT'
                    ? 'animate-jumpscare-right'
                    : 'animate-jumpscare'
                }
              >
                <CharacterPortrait
                  id={extraScarePreview.character}
                  className="w-96 h-96 md:w-[460px] md:h-[460px]"
                />
              </div>
              <div className="mt-6 bg-red-950/95 border-4 border-red-500 px-8 py-4 text-center shadow-2xl">
                <div className="text-4xl md:text-5xl font-crt text-yellow-300 tracking-widest">
                  {extraScarePreview.title}
                </div>
                <div className="text-2xl font-crt text-red-200 mt-1">
                  {extraScarePreview.subtitle}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          3. DOSSIER / CHARACTER GUIDE MODAL
         ===================================================================== */}
      {screen === 'DOSSIER' && (
        <div className="relative z-30 w-full h-full bg-[#060a05] p-6 md:p-10 overflow-y-auto">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between border-b-2 border-[#4d7c0f] pb-4 mb-6">
              <div>
                <h2 className="text-5xl font-crt text-[#d9f99d] tracking-widest">
                  EXPEDIENTE FISCAL: YOUTUBERS EN ANDORRA
                </h2>
                <p className="text-xl font-crt text-[#8fb873]">
                  Guía de supervivencia 1:1 para el Inspector de Hacienda
                </p>
              </div>
              <button
                onClick={() => setScreen('TITLE')}
                className="px-6 py-2.5 bg-[#1e3315] hover:bg-[#2d4d20] border-2 border-[#84cc16] text-white font-crt text-2xl tracking-wider cursor-pointer"
              >
                ◀ VOLVER AL MENÚ
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {CHARACTER_DOSSIERS.map((c) => (
                <div
                  key={c.id}
                  className="bg-[#0b1309] border-2 border-[#355224] p-4 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between border-b border-[#253b1a] pb-2 mb-3">
                      <div>
                        <h3 className="text-3xl font-crt text-[#ecfccb]">{c.youtuberName}</h3>
                        <span className="text-lg font-crt text-amber-400">
                          Rol FNAF 3: {c.fnafCounterpart}
                        </span>
                      </div>
                      <span
                        className={`px-2.5 py-0.5 text-base font-crt border ${
                          c.dangerType === 'LETAL'
                            ? 'bg-red-950/80 border-red-500 text-red-300'
                            : 'bg-lime-950/80 border-lime-500 text-lime-300'
                        }`}
                      >
                        {c.dangerType}
                      </span>
                    </div>

                    <div className="h-44 bg-[#060a05] border border-[#233618] flex items-center justify-center mb-3 p-2">
                      <CharacterPortrait id={c.id} className="w-36 h-40" />
                    </div>

                    <p className="text-lg font-crt text-[#b8d8a0] mb-2">{c.mechanicSummary}</p>
                    <p className="text-base font-crt text-amber-300/90 bg-black/50 p-2 border border-amber-900/50">
                      <strong>CONTRAATAQUE HACIENDA:</strong> {c.counterplay}
                    </p>
                  </div>

                  <div className="mt-3 pt-2 border-t border-[#1f3015] text-base font-crt italic text-[#7fa366]">
                    {c.quote}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          4. CUSTOM NIGHT SCREEN (AUDITORÍA EXTREMA)
         ===================================================================== */}
      {screen === 'CUSTOM_NIGHT' && (
        <div className="relative z-30 w-full h-full bg-[#060a05] p-6 md:p-10 flex flex-col justify-between overflow-y-auto">
          <div className="max-w-5xl mx-auto w-full">
            <div className="flex items-center justify-between border-b-2 border-amber-500 pb-4 mb-6">
              <div>
                <h2 className="text-5xl font-crt text-amber-400 tracking-widest">
                  NOCHE PERSONALIZADA
                </h2>
                <p className="text-xl font-crt text-[#99bd80]">
                  Ajusta el nivel de IA (0 a 20) de cada YouTuber andorrano
                </p>
              </div>
              <button
                onClick={() => setScreen('TITLE')}
                className="px-6 py-2 bg-[#1c2b15] border-2 border-[#84cc16] text-[#d9f99d] font-crt text-2xl cursor-pointer"
              >
                ◀ VOLVER
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
              {CHARACTER_DOSSIERS.map((char) => {
                const level = aiWeights[char.id];
                return (
                  <div
                    key={char.id}
                    className="bg-[#0c1409] border-2 border-[#365314] p-4 flex flex-col items-center"
                  >
                    <div className="text-2xl font-crt text-[#ecfccb] mb-1">{char.youtuberName}</div>
                    <div className="text-base font-crt text-amber-400 mb-2">{char.fnafCounterpart}</div>
                    <div className="w-32 h-36 bg-black/60 border border-[#2a401d] flex items-center justify-center mb-3">
                      <CharacterPortrait id={char.id} className="w-28 h-32" />
                    </div>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() =>
                          setAiWeights((w) => ({ ...w, [char.id]: Math.max(0, w[char.id] - 1) }))
                        }
                        className="w-10 h-10 bg-[#1a2b12] border border-[#65a30d] text-2xl font-crt cursor-pointer"
                      >
                        -
                      </button>
                      <span className="text-4xl font-crt text-amber-300 w-12 text-center">
                        {level}
                      </span>
                      <button
                        onClick={() =>
                          setAiWeights((w) => ({ ...w, [char.id]: Math.min(20, w[char.id] + 1) }))
                        }
                        className="w-10 h-10 bg-[#1a2b12] border border-[#65a30d] text-2xl font-crt cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4">
              <button
                onClick={() =>
                  setAiWeights({
                    AURONPLAY: 20,
                    RUBIUS_CHEPUDO: 20,
                    CRISTININI: 20,
                    CHIQUI_IBAI: 20,
                    ISHOWSPEED: 20,
                    ARIGAMEPLAYS: 20,
                    KNEKRO: 20,
                  })
                }
                className="px-6 py-3 bg-red-950/80 hover:bg-red-900 border-2 border-red-500 text-red-200 font-crt text-2xl tracking-wider cursor-pointer"
              >
                MODO 7/20 (TODO A 20)
              </button>


              <button
                onClick={() => startNight(6, aiWeights)}
                className="px-10 py-3.5 bg-[#29471c] hover:bg-[#386126] border-2 border-[#a3e635] text-white font-crt text-3xl tracking-widest cursor-pointer"
              >
                ▶ INICIAR NOCHE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          5. NIGHT INTRO TRANSITION SCREEN (FNAF 3 CRT STATIC SWEEP + 12:00 AM + FADE TO BLACK)
         ===================================================================== */}
      {screen === 'NIGHT_INTRO' && (
        <div className="relative z-30 w-full h-full bg-black overflow-hidden flex flex-col items-center justify-center text-center p-6 select-none">
          {/* CRT Scanlines & Vignette */}
          <div className="absolute inset-0 crt-scanlines z-20 pointer-events-none" />
          <div className="absolute inset-0 crt-vignette z-20 pointer-events-none" />

          {/* Phase 1: Heavy FNAF 3 Green CRT Static Sweep & Horizontal Sync Bars */}
          {introPhase === 'STATIC' && (
            <div className="absolute inset-0 z-15 bg-[#0d1909] flex flex-col justify-between overflow-hidden">
              {Array.from({ length: 18 }).map((_, idx) => (
                <div
                  key={idx}
                  className="w-full bg-[#84cc16]/25 border-y border-[#bef264]/40 animate-pulse"
                  style={{
                    height: `${4 + (idx % 4) * 5}px`,
                    opacity: 0.25 + (idx % 3) * 0.25,
                  }}
                />
              ))}
              <div className="absolute inset-0 bg-gradient-to-b from-[#84cc16]/20 via-transparent to-[#365314]/35 animate-pulse" />
            </div>
          )}

          {/* Subtle green phosphor scanline bar moving across during TEXT phase */}
          {introPhase !== 'FADE_OUT' && (
            <div className="absolute inset-x-0 top-1/3 h-16 bg-gradient-to-b from-transparent via-[#84cc16]/12 to-transparent pointer-events-none animate-pulse" />
          )}

          {/* Center 12:00 AM & Night X Text with FNAF 3 VHS Jitter */}
          <div
            className={`relative z-25 flex flex-col items-center transition-all duration-700 ${
              introPhase === 'STATIC'
                ? 'scale-105 skew-x-3 opacity-85'
                : introPhase === 'TEXT'
                ? 'scale-100 skew-x-0 opacity-100'
                : 'scale-95 opacity-0'
            }`}
          >
            <div className="text-7xl md:text-8xl font-crt text-[#e2f9b8] tracking-[0.18em] drop-shadow-[0_0_24px_rgba(132,204,22,0.75)]">
              12:00 AM
            </div>
            <div className="w-64 h-[2px] bg-[#65a30d]/70 my-3 shadow-[0_0_12px_rgba(132,204,22,0.8)]" />
            <div className="text-4xl md:text-6xl font-crt text-[#a3e635] tracking-[0.22em] drop-shadow-[0_0_18px_rgba(132,204,22,0.65)]">
              {night === 6 ? 'NOCHE 6 — AUDITORÍA' : `NOCHE ${night}`}
            </div>
            <div className="mt-4 text-lg md:text-xl font-crt text-[#84cc16]/75 tracking-widest uppercase">
              AGENCIA TRIBUTARIA · BÚNKER FRONTERIZO DE ANDORRA
            </div>
          </div>

          {/* Phase 3: Smooth Fade-to-Black Curtain into the Office */}
          <div
            className={`fixed inset-0 bg-black z-30 pointer-events-none transition-opacity duration-900 ${
              introPhase === 'FADE_OUT' ? 'opacity-100' : 'opacity-0'
            }`}
          />
        </div>
      )}

      {/* =====================================================================
          6. ACTIVE GAMEPLAY: THE FNAF 3 HACIENDA OFFICE (WITH EASTER EGGS & FULLSCREEN)
         ===================================================================== */}
      {screen === 'PLAYING' && (
        <div
          className={`relative w-full h-full overflow-hidden ${
            ventilationError ? 'animate-alarm-red' : ''
          }`}
        >
          {/* Ventilation Blackout Overlay */}
          <div
            className="fixed inset-0 bg-black pointer-events-none z-20 transition-opacity duration-500"
            style={{ opacity: blackoutOpacity }}
          />

          {/* TOP HUD BAR: COMPACT FNAF 3 STYLE */}
          <div className="fixed top-3 left-4 right-4 z-25 flex items-start justify-between pointer-events-none">
            {/* Left HUD: Compact Status & Small Mute Call Button */}
            <div className="flex flex-col gap-1.5 pointer-events-auto">
              <div className="flex items-center gap-2.5 bg-black/80 border border-[#365314] px-3 py-1.5">
                <HaciendaGuardBadge className="w-9 h-9 shrink-0" />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-lg font-crt text-amber-400 tracking-wider leading-none">
                      INSPECTOR HACIENDA
                    </span>
                    <ShieldCheck className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="flex items-center gap-3 text-base font-crt leading-tight mt-0.5">
                    <span className={audioError ? 'text-red-500 animate-pulse' : 'text-[#8fb873]'}>
                      AUD: {audioError ? 'ERR' : 'OK'}
                    </span>
                    <span className={cameraError ? 'text-red-500 animate-pulse' : 'text-[#8fb873]'}>
                      CAM: {cameraError ? 'ERR' : 'OK'}
                    </span>
                    <span className={ventilationError ? 'text-red-500 animate-pulse' : 'text-[#8fb873]'}>
                      VENT: {ventilationError ? 'ERR' : 'OK'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Authentic Small FNAF 3 "MUTE CALL" Button */}
              {phoneCallActive && (
                <button
                  onClick={handleMutePhoneCall}
                  className="self-start flex items-center gap-1.5 px-2.5 py-0.5 bg-zinc-900/85 hover:bg-zinc-800 border border-zinc-500 text-zinc-200 font-crt text-base tracking-wider cursor-pointer"
                >
                  <PhoneOff className="w-3.5 h-3.5 text-red-400" />
                  MUTE CALL
                </button>
              )}
            </div>

            {/* Subtle Single-Line Phone Subtitle Strip at Top Center */}
            {phoneCallActive && (
              <div className="hidden lg:block max-w-xl bg-black/75 border border-amber-700/60 px-4 py-1.5 text-center">
                <span className="text-base font-crt text-amber-200/90 leading-tight">
                  {activeCallScript.lines[phoneLineIndex]}
                </span>
              </div>
            )}

            {/* Right HUD: Fullscreen Toggle + Night & Clock */}
            <div className="flex items-start gap-2 pointer-events-auto">
              <button
                onClick={toggleFullscreen}
                className="flex items-center gap-1.5 bg-black/80 hover:bg-[#1a2e12] border border-[#4d7c0f] px-3 py-1.5 text-[#d9f99d] font-crt text-lg cursor-pointer"
                title="Pantalla Completa (Tecla F)"
              >
                {isFullscreen ? (
                  <Minimize2 className="w-4 h-4 text-[#a3e635]" />
                ) : (
                  <Maximize2 className="w-4 h-4 text-[#a3e635]" />
                )}
                <span>{isFullscreen ? 'SALIR [F]' : 'PANTALLA COMPLETA [F]'}</span>
              </button>

              <div className="bg-black/80 border border-[#365314] px-4 py-1.5 text-right">
                <div className="text-4xl font-crt text-[#ecfccb] leading-none tabular-nums">
                  {hour === 0 ? '12' : hour} AM
                </div>
                <div className="text-lg font-crt text-[#84cc16] tracking-widest leading-none mt-1">
                  NOCHE {night}
                </div>
              </div>
            </div>
          </div>

          {/* Center Alert Toast if Auron was lured */}
          {auronLuredBanner && (
            <div className="fixed top-20 left-1/2 -translate-x-1/2 z-25 bg-[#1a2e05]/95 border border-[#a3e635] px-4 py-1 text-xl font-crt text-[#ecfccb]">
              {auronLuredBanner}
            </div>
          )}

          {/* LEFT & RIGHT EDGE HOVER ZONES FOR PANNING THE OFFICE */}
          <div
            onMouseEnter={() => setPanDirection('LEFT')}
            onMouseLeave={() => setPanDirection('NONE')}
            onClick={() => setOfficePan((p) => Math.max(-340, p - 120))}
            className="fixed left-0 top-24 bottom-24 w-16 z-20 flex items-center justify-start pl-1.5 bg-gradient-to-r from-black/60 to-transparent hover:from-[#1f3314]/60 cursor-pointer group"
          >
            <ChevronLeft className="w-9 h-9 text-[#a3e635] opacity-60 group-hover:opacity-100" />
          </div>

          <div
            onMouseEnter={() => setPanDirection('RIGHT')}
            onMouseLeave={() => setPanDirection('NONE')}
            onClick={() => setOfficePan((p) => Math.min(340, p + 120))}
            className="fixed right-0 top-24 bottom-24 w-16 z-20 flex items-center justify-end pr-1.5 bg-gradient-to-l from-black/60 to-transparent hover:from-[#1f3314]/60 cursor-pointer group"
          >
            <ChevronRight className="w-9 h-9 text-[#a3e635] opacity-60 group-hover:opacity-100" />
          </div>

          {/* =================================================================
              WIDE PANNABLE FNAF 3 OFFICE SCENE (AUTO-SCALED FOR ALL SCREENS!)
             ================================================================= */}
          <div
            className="relative h-full w-[172vw] min-w-[1680px] left-1/2 transition-transform duration-75 ease-out flex items-center justify-center origin-center"
            style={{
              transform: `translateX(calc(-50% - ${officePan}px)) scale(${officeScale})`,
            }}
          >
            {/* Office Room Background Architecture */}
            <div className="relative w-[1640px] h-[860px] bg-[#0b1309] border-y-8 border-[#1e2d17] shadow-inner overflow-hidden">
              {/* Green Grimy Tile Wall Pattern */}
              <div
                className="absolute inset-0 opacity-25"
                style={{
                  backgroundImage:
                    'linear-gradient(#29401e 2px, transparent 2px), linear-gradient(90deg, #29401e 2px, transparent 2px)',
                  backgroundSize: '64px 64px',
                }}
              />

              {/* LEFT SECTION OF OFFICE: DOORWAY + FREDDY POSTER EASTER EGG + MAINTENANCE TERMINAL */}
              <div className="absolute left-[40px] top-[95px] w-[420px] h-[660px]">
                {/* Left Exit Doorway to CAM 01 */}
                <div className="relative w-[215px] h-[580px] bg-[#040703] border-8 border-[#24361b] shadow-[inset_0_0_50px_#000] overflow-hidden flex items-center justify-center">
                  <div
                    className={`absolute top-4 w-7 h-7 rounded-full border-2 border-red-900 ${
                      auronPos === 'DOORWAY' || auronPos === 'CAM_01'
                        ? 'bg-red-600 shadow-[0_0_30px_#ef4444] animate-ping'
                        : 'bg-red-950'
                    }`}
                  />

                  {/* AURONPLAY PEEKING FROM THE LEFT DOORWAY */}
                  {auronPos === 'DOORWAY' && (
                    <div className="flex flex-col items-center animate-pulse">
                      <AuronSpringtrapSprite className="w-52 h-64 translate-x-3" />
                      <span className="bg-red-950 border border-red-500 text-red-200 font-crt text-lg px-2">
                        ¡AURON EN PUERTA!
                      </span>
                    </div>
                  )}

                  {/* ARIGAMEPLAYS ARMED AT LEFT DOORWAY IF PLAYER TRIGGERED CAM 07 */}
                  {ariArmedInOffice && (
                    <div className="flex flex-col items-center">
                      <AriGameplaysChicaSprite className="w-48 h-60" />
                    </div>
                  )}

                  <div className="absolute bottom-3 text-center text-sm font-crt text-[#5e7d4c]">
                    PUERTA IZQUIERDA (CAM 01)
                  </div>
                </div>

                {/* EASTER EGG #1: FREDDY POSTER WITH CLICKABLE NOSE HONK (Plays attached MP3!) */}
                <div className="absolute left-[242px] top-[35px] z-30">
                  <FreddyOfficePoster
                    onHonkNose={() => {
                      sfx.playFreddyNoseHonk();
                    }}
                  />
                </div>

                {/* Interactive Maintenance Terminal Button */}
                <button
                  onClick={() => {
                    if (knekroOfficeBlock) return;
                    setMaintenanceOpen(true);
                  }}
                  className={`absolute left-[230px] bottom-[80px] w-[190px] p-3.5 border-4 text-left transition-transform hover:scale-105 cursor-pointer shadow-2xl ${
                    hasAnyError
                      ? 'bg-red-950/90 border-red-500 text-red-200 animate-bounce'
                      : 'bg-[#1a1408] border-amber-500 text-amber-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <Wrench className="w-6 h-6 text-amber-400 shrink-0" />
                    <span className="text-xs font-crt bg-amber-500/20 px-1.5 py-0.5">
                      AEAT
                    </span>
                  </div>
                  <div className="text-xl font-crt font-bold tracking-wider leading-tight">
                    MANTENIMIENTO
                  </div>
                  <div className="text-sm font-crt text-amber-200/80 mt-0.5">
                    {knekroOfficeBlock
                      ? '¡BLOQUEADO POR KNEKRO!'
                      : hasAnyError
                      ? '¡REINICIAR ERROR!'
                      : 'Audio / Cam / Vent'}
                  </div>
                </button>
              </div>


              {/* ISHOWSPEED (PHANTOM FOXY) CROUCHING NEAR THE RELIC BOX ON THE LEFT */}
              {speedInOfficeLeft && (
                <div className="absolute left-[430px] bottom-[160px] z-20 flex flex-col items-center animate-bounce">
                  <IShowSpeedFoxySprite className="w-52 h-60" />
                  <div className="bg-red-950 border border-red-500 px-3 py-1 font-crt text-lg text-yellow-300">
                    ¡ISHOWSPEED! ¡SUBE CÁMARA!
                  </div>
                </div>
              )}

              {/* CENTER SECTION OF OFFICE: LARGE FRONT GLASS WINDOW & HACIENDA DESK */}
              <div className="absolute left-[490px] top-[95px] w-[660px] flex flex-col items-center">
                {/* Large FNAF 3 Front Office Window */}
                <div className="relative w-[620px] h-[380px] bg-[#060c05] border-8 border-[#2b4020] shadow-[inset_0_0_80px_rgba(0,0,0,0.95)] overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-b from-[#0d190a] via-[#070d06] to-[#040703]" />
                  <div className="absolute inset-x-0 top-12 h-1 bg-[#223619]/50" />
                  <div className="absolute inset-x-0 bottom-16 h-1 bg-[#223619]/50" />

                  <div className="absolute top-2 right-3 text-sm font-crt text-[#557544]">
                    VENTANAL CENTRAL · PASILLO CAM 02
                  </div>

                  {/* EL RUBIUS (CHEPUDO) LIMPING ACROSS THE WINDOW WITH HIS GIANT HUNCHBACK */}
                  {rubiusWalking && (
                    <div className="absolute bottom-2 right-0 w-72 h-68 animate-rubius-limp z-10 pointer-events-none">
                      <RubiusChepudoSprite className="w-68 h-64" />
                    </div>
                  )}

                  {/* CRISTININI (PHANTOM MANGLE) PEEKING AT THE WINDOW CAUSING AUDIO ERROR */}
                  {cristininiWindowAttack && (
                    <div className="absolute bottom-0 left-12 z-15 flex flex-col items-center animate-bounce">
                      <CristininiMangleSprite className="w-56 h-60" />
                    </div>
                  )}

                  {/* AURONPLAY (SPRINGTRAP) STARING DEAD AT YOU THROUGH THE WINDOW */}
                  {auronPos === 'WINDOW' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center z-15 animate-pulse">
                      <AuronSpringtrapSprite className="w-68 h-76" />
                    </div>
                  )}

                  {/* VENTILATION HALLUCINATION: FAKE AURON CLONE WHEN VENTILATION IS BROKEN */}
                  {ventilationError && auronPos !== 'WINDOW' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center opacity-45 pointer-events-none">
                      <AuronSpringtrapSprite className="w-60 h-68 blur-[1px]" />
                    </div>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.03] to-transparent pointer-events-none" />
                </div>

                {/* HACIENDA SECURITY GUARD DESK WITH BOBBLEHEAD TOYS */}
                <div className="relative w-[620px] h-[230px] bg-[#161c12] border-t-8 border-x-4 border-[#2e3d25] mt-[-6px] flex items-end justify-between px-6 pb-5 shadow-2xl">
                  <div className="w-44 h-34 bg-[#23190f] border-4 border-[#47331f] p-2 flex flex-col justify-between">
                    <div className="text-center text-sm font-crt text-amber-300 border-b border-amber-900 pb-0.5">
                      CAJA DE EMBARGOS AEAT
                    </div>
                    <div className="text-sm font-crt text-[#b8a692] leading-tight">
                      • Micro de Cristinini
                      <br />• Cascos del Rubius
                      <br />• Maillot Andorra 0%
                      <br />• Cartel 3,99$ Ari
                    </div>
                  </div>

                  {/* Classic Oscillating FNAF Desk Fan */}
                  <div className="flex flex-col items-center">
                    <div className="w-22 h-22 rounded-full border-4 border-zinc-600 bg-zinc-900 flex items-center justify-center relative">
                      <div
                        className={`w-18 h-18 border-t-4 border-b-4 border-lime-500/60 rounded-full ${
                          ventilationError ? '' : 'animate-spin'
                        }`}
                      />
                    </div>
                    <div className="w-12 h-5 bg-zinc-700 mt-[-4px]" />
                    <div className="mt-1 px-2.5 py-0.5 bg-amber-500 text-black font-crt font-bold text-base">
                      MODELO 720 · HACIENDA
                    </div>
                  </div>

                  {/* EASTER EGG #2: INTERACTIVE DESK BOBBLEHEAD FIGURINES */}
                  <DeskBobbleheads
                    onBoing={(pitch) => {
                      if (!soundMuted) sfx.playBobbleBoing(pitch);
                    }}
                  />
                </div>
              </div>

              {/* RIGHT SECTION OF OFFICE: CHILDREN STREAMER DRAWINGS + RIGHT VENT GRATE + CAMERA MONITOR */}
              <div className="absolute right-[55px] top-[95px] w-[340px] h-[610px] flex flex-col items-center justify-between">
                {/* EASTER EGG #3: CHILDREN'S DRAWINGS OF STREAMERS ON THE WALL */}
                <ChildrenStreamerDrawings
                  onInteract={() => {
                    if (!soundMuted) sfx.playBobbleBoing(1.35);
                  }}
                />

                {/* Right Office Vent Opening */}
                <div className="w-full p-3 bg-[#070b06] border-4 border-[#2b3d20] flex flex-col items-center">
                  <div className="text-base font-crt text-amber-400 mb-1">
                    CONDUCTO DERECHO (CAM 14 / 15)
                  </div>
                  <div className="w-44 h-20 bg-black border-4 border-zinc-700 flex flex-col justify-between p-2">
                    <div className="w-full h-1.5 bg-zinc-800" />
                    <div className="w-full h-1.5 bg-zinc-800" />
                    <div className="w-full h-1.5 bg-zinc-800" />
                    <div className="w-full h-1.5 bg-zinc-800" />
                  </div>
                  {(auronPos === 'CAM_14' || auronPos === 'CAM_15') && (
                    <div className="mt-1 text-base font-crt text-red-400 animate-pulse">
                      ¡RUIDO EN EL CONDUCTO!
                    </div>
                  )}
                </div>

                <button
                  onClick={() => {
                    if (knekroOfficeBlock) return;
                    setMonitorOpen(true);
                    if (!soundMuted) sfx.playCamBlip();
                  }}
                  className="w-full p-4 bg-[#13220e] hover:bg-[#1e3816] border-4 border-[#84cc16] text-[#ecfccb] shadow-[0_0_50px_rgba(132,204,22,0.3)] transition-transform hover:scale-105 cursor-pointer flex flex-col items-center text-center"
                >
                  <Cctv className="w-11 h-11 text-[#a3e635] mb-1.5" />
                  <span className="text-2xl font-crt font-bold tracking-widest">
                    MONITOR DE CÁMARAS
                  </span>
                  <span className="text-base font-crt text-[#a3e635]">
                    {knekroOfficeBlock ? '¡BLOQUEADO POR KNEKRO!' : 'CAM 01–10 y Conductos 11–15'}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* KNEKRO (PHANTOM PUPPET) 1:1 FNAF 3 OFFICE FACE-BLOCK OVERLAY!
              Stares closely into the player's eyes, moves with their camera view, and blocks opening panels! */}
          {knekroOfficeBlock && (
            <div className="fixed inset-0 z-25 pointer-events-none flex flex-col items-center justify-center bg-black/35 animate-pulse">
              <KNekroPuppetSprite
                closeUp
                className="w-96 h-96 md:w-[460px] md:h-[500px] scale-110 translate-y-4"
              />
              <div className="mt-2 bg-black/95 border-2 border-lime-400 px-5 py-1.5 text-center shadow-2xl">
                <div className="text-3xl font-crt text-lime-300 tracking-widest">
                  ¡KNEKRO (PHANTOM PUPPET) TE BLOQUEA LA CARA! ({knekroBlockSecondsLeft}s)
                </div>
                <div className="text-lg font-crt text-amber-300">
                  No puedes abrir Cámaras ni Mantenimiento hasta que se marche
                </div>
              </div>
            </div>
          )}

          {/* FIXED BOTTOM QUICK-ACCESS TOOLBAR */}
          <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-25 flex items-center gap-3 bg-black/90 border-2 border-[#4d7c0f] px-5 py-2 shadow-2xl">
            <button
              onClick={() => {
                if (knekroOfficeBlock) return;
                clearPhantomCamTimer();
                setMaintenanceOpen(true);
                setMonitorOpen(false);
              }}
              disabled={knekroOfficeBlock}
              className={`flex items-center gap-2 px-4 py-1.5 border-2 font-crt text-xl tracking-wider cursor-pointer ${
                knekroOfficeBlock
                  ? 'bg-zinc-900 border-zinc-700 text-zinc-500 cursor-not-allowed'
                  : hasAnyError
                  ? 'bg-red-950 border-red-500 text-red-200 animate-pulse'
                  : 'bg-[#1a1408] hover:bg-[#2b210d] border-amber-500 text-amber-300'
              }`}
            >
              <Wrench className="w-4 h-4" />
              ◀ MANTENIMIENTO {hasAnyError ? '(¡ERROR!)' : ''}
            </button>

            <button
              onClick={() => setOfficePan(0)}
              className="px-3.5 py-1.5 bg-[#121d0e] hover:bg-[#1c2e16] border border-[#4d7c0f] text-[#b7e486] font-crt text-lg cursor-pointer"
            >
              CENTRAR VISTA
            </button>

            <button
              onClick={() => {
                if (knekroOfficeBlock) return;
                setMonitorOpen(true);
                setMaintenanceOpen(false);
                if (!soundMuted) sfx.playCamBlip();
              }}
              disabled={knekroOfficeBlock}
              className={`flex items-center gap-2 px-4 py-1.5 border-2 font-crt text-xl tracking-wider cursor-pointer ${
                knekroOfficeBlock
                  ? 'bg-zinc-900 border-zinc-700 text-zinc-500 cursor-not-allowed'
                  : 'bg-[#1a2e12] hover:bg-[#28471c] border-[#84cc16] text-[#d9f99d]'
              }`}
            >
              <Cctv className="w-4 h-4" />
              CÁMARAS ▶
            </button>
          </div>

          {/* CAMERA MONITOR OVERLAY */}
          {monitorOpen && (
            <CameraMonitor
              currentCam={currentCam}
              mapLayer={mapLayer}
              auronPos={auronPos}
              sealedVent={sealedVent}
              audioError={audioError}
              cameraError={cameraError}
              audioCooldown={audioCooldown}
              chiquiIbaiCam={chiquiIbaiCam}
              cristininiCam04Active={cristininiCam04}
              ariArcadeCam07Active={ariArcadeCam07}
              knekroCam08Active={knekroCam08}
              staticBurst={staticBurst}
              onSelectCam={handleSelectCam}
              onToggleMapLayer={() => setMapLayer((m) => (m === 'ROOMS' ? 'VENTS' : 'ROOMS'))}
              onPlayAudio={handlePlayAudio}
              onCloseMonitor={handleCloseMonitor}
            />
          )}


          {/* MAINTENANCE PANEL OVERLAY */}
          {maintenanceOpen && (
            <MaintenancePanel
              audioError={audioError}
              cameraError={cameraError}
              ventilationError={ventilationError}
              rebootingTarget={rebootingTarget}
              rebootProgress={rebootProgress}
              onStartReboot={(target) => {
                setRebootingTarget(target);
                setRebootProgress(0);
              }}
              onClosePanel={() => setMaintenanceOpen(false)}
            />
          )}

          {/* UNIFIED 1:1 JUMPSCARE OVERLAY (PHANTOMS & LETHAL AURONPLAY) */}
          {activeJumpscare && (
            <div className="fixed inset-0 z-50 bg-black/92 flex flex-col items-center justify-center p-6">
              <div
                className={
                  activeJumpscare.direction === 'LEFT'
                    ? 'animate-jumpscare-left'
                    : activeJumpscare.direction === 'RIGHT'
                    ? 'animate-jumpscare-right'
                    : 'animate-jumpscare'
                }
              >
                {activeJumpscare.character === 'AURONPLAY' ? (
                  <AuronSpringtrapSprite
                    pose="jumpscare"
                    className="w-96 h-96 md:w-[480px] md:h-[480px]"
                  />
                ) : (
                  <CharacterPortrait
                    id={activeJumpscare.character}
                    className="w-92 h-92 md:w-[440px] md:h-[440px]"
                  />
                )}
              </div>
              <div className="mt-5 bg-red-950/95 border-4 border-red-500 px-7 py-3.5 text-center shadow-2xl">
                <div className="text-4xl md:text-5xl font-crt text-yellow-300 tracking-widest">
                  {activeJumpscare.title}
                </div>
                <div className="text-2xl font-crt text-red-200 mt-1">
                  {activeJumpscare.subtitle}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          7. GAME OVER SCREEN
         ===================================================================== */}
      {screen === 'GAME_OVER' && (
        <div className="relative z-30 w-full h-full bg-[#090404] flex flex-col items-center justify-center text-center p-6">
          <AlertTriangle className="w-20 h-20 text-red-500 mb-3 animate-bounce" />
          <h2 className="text-7xl md:text-8xl font-display font-bold text-red-500 tracking-wider">
            INSPECCIÓN FALLIDA (GAME OVER)
          </h2>
          <p className="text-3xl font-crt text-red-200 mt-2 max-w-xl">
            {auronAttackSide === 'LEFT'
              ? 'AuronPlay (Springtrap) entró por la puerta izquierda (CAM 01) y trasladó tu patrimonio a Andorra.'
              : 'AuronPlay (Springtrap) se coló por el conducto de ventilación derecho sin sellar.'}
          </p>

          <div className="my-6 p-4 bg-black/70 border-2 border-red-800">
            <AuronSpringtrapSprite className="w-48 h-56 mx-auto" />
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={() => startNight(night, aiWeights)}
              className="flex items-center gap-2 px-8 py-3.5 bg-red-900 hover:bg-red-800 border-2 border-red-400 text-white font-crt text-3xl tracking-widest cursor-pointer"
            >
              <RotateCcw className="w-7 h-7" />
              REINTENTAR NOCHE {night}
            </button>
            <button
              onClick={() => setScreen('TITLE')}
              className="px-8 py-3.5 bg-zinc-900 hover:bg-zinc-800 border-2 border-zinc-600 text-zinc-200 font-crt text-3xl tracking-widest cursor-pointer"
            >
              VOLVER AL MENÚ
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          8. 6:00 AM VICTORY SCREEN
         ===================================================================== */}
      {screen === 'VICTORY_NIGHT' && (
        <div className="relative z-30 w-full h-full bg-[#050b04] flex flex-col items-center justify-center text-center p-6">
          <div className="text-8xl md:text-9xl font-crt text-[#d9f99d] tracking-widest animate-bounce">
            6:00 AM
          </div>
          <h2 className="text-4xl md:text-5xl font-crt text-[#84cc16] mt-2 tracking-widest">
            ¡NOCHE {night} COMPLETADA CON ÉXITO!
          </h2>
          <p className="text-2xl font-crt text-amber-300 mt-3 max-w-xl">
            {night === 1
              ? 'Has completado tu primera noche de reconocimiento en la frontera de Andorra. ¡Prepárate, en la Noche 2 acaban de encontrar a AuronPlay!'
              : 'Has sobrevivido a AuronPlay, El Rubius Chepudo, Cristinini, Chiqui-Ibai, IShowSpeed y la máquina de 3,99$ de AriGameplays.'}
          </p>

          <div className="my-8 flex items-center gap-4 bg-[#0d190a] border-2 border-[#65a30d] px-8 py-4">
            <HaciendaGuardBadge className="w-20 h-20" />
            <div className="text-left">
              <div className="text-2xl font-crt text-amber-400">
                NÓMINA OFICIAL AGENCIA TRIBUTARIA
              </div>
              <div className="text-xl font-crt text-[#ecfccb]">
                TURNO NOCHE {night} SUPERADO · PRÓXIMO TURNO DESBLOQUEADO
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {night < 5 && (
              <button
                onClick={() => startNight(night + 1)}
                className="px-8 py-3.5 bg-[#29471c] hover:bg-[#386126] border-2 border-[#a3e635] text-white font-crt text-3xl tracking-widest cursor-pointer"
              >
                ▶ INICIAR NOCHE {night + 1}
              </button>
            )}
            <button
              onClick={() => setScreen('TITLE')}
              className="px-8 py-3.5 bg-[#121f0d] hover:bg-[#1d3315] border-2 border-[#65a30d] text-[#d9f99d] font-crt text-3xl tracking-widest cursor-pointer"
            >
              MENÚ PRINCIPAL
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
