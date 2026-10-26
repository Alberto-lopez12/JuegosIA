/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AnimatronicAILevels,
  CAMERAS,
  CameraId,
  GameScreenState,
  NightSimulationState,
  PHONE_GUY_CALLS,
  RunSummarySnapshot,
} from './game/types';
import {
  buildRunSummarySnapshot,
  createInitialNightState,
  formatFnafHour,
  selectCamera,
  stepGameSimulation,
  toggleLeftDoor,
  toggleLeftLight,
  toggleMonitor,
  toggleRightDoor,
  toggleRightLight,
} from './game/rules';
import {
  OfficeHitboxes,
  drawJumpscareScene,
  drawOfficeScene,
} from './components/AnimatronicRenderer';
import { TitleScreen } from './components/TitleScreen';
import { CCTVMonitor } from './components/CCTVMonitor';
import { EndOfRunModal, PauseModal } from './components/StatusModals';
import { soundEngine } from './game/soundEngine';

export default function App() {
  const initialAutostart =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('autostart') === '1';

  const [screenState, setScreenState] = useState<GameScreenState>(
    initialAutostart ? 'playing' : 'title'
  );
  const [selectedNight, setSelectedNight] = useState<number>(1);
  const [customAI, setCustomAI] = useState<AnimatronicAILevels>({
    pedro: 10,
    rajoy: 12,
    montero: 12,
    abascal: 10,
  });

  // Live simulation ref (mutated in 60Hz loop without causing 60Hz React re-renders)
  const simRef = useRef<NightSimulationState>(createInitialNightState(1));
  const [hudState, setHudState] = useState<NightSimulationState>(() => simRef.current);
  const [runSnapshot, setRunSnapshot] = useState<RunSummarySnapshot | null>(null);
  const [muted, setMuted] = useState<boolean>(false);
  const [callMuted, setCallMuted] = useState<boolean>(false);
  const [callLineIndex, setCallLineIndex] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Canvas & camera panning refs
  const officeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const panTargetRef = useRef<number>(0); // -1 (left) to +1 (right)
  const panCurrentRef = useRef<number>(0);
  const mouseNormXRef = useRef<number>(0); // -1 (left edge) to +1 (right edge)
  const mouseActiveRef = useRef<boolean>(false);
  const doorAnimRef = useRef<{ left: number; right: number }>({ left: 0, right: 0 });
  const hitboxesRef = useRef<OfficeHitboxes | null>(null);
  const keysHeldRef = useRef<Set<string>>(new Set());
  const lastAudioCueCounterRef = useRef<number>(0);
  const toreadorNoteStepRef = useRef<number>(0);

  // Sync document.body.dataset.state
  useEffect(() => {
    document.body.dataset.state = screenState;
  }, [screenState]);

  // Track Fullscreen state changes
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const handleToggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Ignore if blocked by iframe permissions
    }
  }, []);

  const syncHudFromSim = useCallback((nextSim: NightSimulationState) => {
    simRef.current = nextSim;
    setHudState({ ...nextSim });
  }, []);

  // Trigger procedural Web Audio cues whenever sim emits a new cue
  const processAudioCues = useCallback((sim: NightSimulationState) => {
    if (sim.audioCueCounter === lastAudioCueCounterRef.current) return;
    lastAudioCueCounterRef.current = sim.audioCueCounter;

    switch (sim.lastAudioCue) {
      case 'pedro_laugh':
        soundEngine.playPedroLaugh();
        break;
      case 'kitchen_clatter':
        soundEngine.playKitchenClatter();
        break;
      case 'foxy_sprint':
        soundEngine.playFoxySprint();
        break;
      case 'foxy_bang':
        soundEngine.playFoxyDoorBang();
        break;
      case 'window_scare':
        soundEngine.playWindowScareSting();
        break;
      case 'door_jammed':
        soundEngine.playJammedBuzzer();
        break;
      case 'power_down':
        soundEngine.playPowerDown();
        break;
      case 'jumpscare':
        soundEngine.playJumpscareScream();
        break;
      case 'golden_laugh':
        soundEngine.playGoldenLaugh();
        break;
      case 'golden_jumpscare':
        soundEngine.playGoldenJumpscareScream();
        break;
      case 'victory_chime':
        soundEngine.playVictoryChime();
        break;
      default:
        break;
    }
  }, []);

  // Start or restart a night
  const handleStartNight = useCallback(
    (nightNum: number, customLevels?: AnimatronicAILevels) => {
      soundEngine.stopAllScreams();
      const levels = customLevels || (nightNum === 6 ? customAI : undefined);
      const fresh = createInitialNightState(nightNum, levels);
      simRef.current = fresh;
      lastAudioCueCounterRef.current = 0;
      toreadorNoteStepRef.current = 0;
      doorAnimRef.current = { left: 0, right: 0 };
      panTargetRef.current = 0;
      panCurrentRef.current = 0;
      keysHeldRef.current.clear();

      setSelectedNight(nightNum);
      setHudState(fresh);
      setRunSnapshot(null);
      setCallMuted(false);
      setCallLineIndex(0);
      setScreenState('playing');
      document.body.dataset.state = 'playing';

      soundEngine.startAmbientDrone();
      soundEngine.setLightHum(false);
    },
    [customAI]
  );

  // Advance Phone Guy subtitle lines every 7 seconds during the opening of a night
  useEffect(() => {
    if (screenState !== 'playing' || callMuted) return;
    const lines = PHONE_GUY_CALLS[selectedNight] || PHONE_GUY_CALLS[1];
    if (callLineIndex >= lines.length) return;

    const timer = window.setTimeout(() => {
      setCallLineIndex((prev) => prev + 1);
    }, 6500);
    return () => window.clearTimeout(timer);
  }, [screenState, selectedNight, callMuted, callLineIndex]);

  // Interactive handlers for doors, lights, and monitor
  const handleToggleLeftDoor = useCallback(() => {
    if (screenState !== 'playing') return;
    const prev = simRef.current;
    const next = toggleLeftDoor(prev);
    if (next.leftDoorClosed !== prev.leftDoorClosed) {
      soundEngine.playDoorSlam(next.leftDoorClosed);
    }
    processAudioCues(next);
    syncHudFromSim(next);
  }, [screenState, processAudioCues, syncHudFromSim]);

  const handleToggleRightDoor = useCallback(() => {
    if (screenState !== 'playing') return;
    const prev = simRef.current;
    const next = toggleRightDoor(prev);
    if (next.rightDoorClosed !== prev.rightDoorClosed) {
      soundEngine.playDoorSlam(next.rightDoorClosed);
    }
    processAudioCues(next);
    syncHudFromSim(next);
  }, [screenState, processAudioCues, syncHudFromSim]);

  const handleToggleLeftLight = useCallback(() => {
    if (screenState !== 'playing') return;
    const next = toggleLeftLight(simRef.current);
    soundEngine.setLightHum(next.leftLightOn || next.rightLightOn);
    processAudioCues(next);
    syncHudFromSim(next);
  }, [screenState, processAudioCues, syncHudFromSim]);

  const handleToggleRightLight = useCallback(() => {
    if (screenState !== 'playing') return;
    const next = toggleRightLight(simRef.current);
    soundEngine.setLightHum(next.leftLightOn || next.rightLightOn);
    processAudioCues(next);
    syncHudFromSim(next);
  }, [screenState, processAudioCues, syncHudFromSim]);

  const handleToggleMonitor = useCallback(() => {
    if (screenState !== 'playing') return;
    const prev = simRef.current;
    const next = toggleMonitor(prev, Math.random());
    if (next.monitorOpen !== prev.monitorOpen) {
      soundEngine.playMonitorFlip(next.monitorOpen);
      soundEngine.setLightHum(false);
    }
    processAudioCues(next);
    syncHudFromSim(next);
  }, [screenState, processAudioCues, syncHudFromSim]);

  const handleSelectCamera = useCallback(
    (camId: CameraId) => {
      if (screenState !== 'playing') return;
      const next = selectCamera(simRef.current, camId);
      soundEngine.playCameraBlip();
      processAudioCues(next);
      syncHudFromSim(next);
    },
    [screenState, processAudioCues, syncHudFromSim]
  );

  // Main 60Hz Canvas2D & Simulation Loop
  useEffect(() => {
    const canvas = officeCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let lastTime = performance.now();
    let hudSyncAccumulator = 0;

    const resize = () => {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const loop = (now: number) => {
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(Math.max(0, rawDt), 0.05);
      const timeSec = now / 1000;

      if (screenState === 'playing') {
        // Keyboard panning support (ArrowLeft / ArrowRight)
        if (keysHeldRef.current.has('ArrowLeft')) {
          panTargetRef.current = Math.max(-1, panTargetRef.current - dt * 2.2);
          mouseActiveRef.current = false;
        }
        if (keysHeldRef.current.has('ArrowRight')) {
          panTargetRef.current = Math.min(1, panTargetRef.current + dt * 2.2);
          mouseActiveRef.current = false;
        }

        // FNAF 1 edge-scroll assist when cursor is held near either side
        if (!simRef.current.monitorOpen && mouseActiveRef.current) {
          const mx = mouseNormXRef.current;
          if (Math.abs(mx) > 0.2) {
            const dir = Math.sign(mx);
            const speed = ((Math.abs(mx) - 0.2) / 0.8) * 2.4;
            panTargetRef.current = Math.max(
              -1,
              Math.min(1, panTargetRef.current + dir * speed * dt)
            );
          }
        }

        // Smooth camera damping
        panCurrentRef.current +=
          (panTargetRef.current - panCurrentRef.current) * Math.min(1, dt * 12);

        // Step simulation
        const prevSim = simRef.current;
        const nextSim = stepGameSimulation(prevSim, dt);
        simRef.current = nextSim;

        // Smooth hydraulic door animation (0..1)
        const targetLeft = nextSim.leftDoorClosed ? 1 : 0;
        const targetRight = nextSim.rightDoorClosed ? 1 : 0;
        doorAnimRef.current.left +=
          (targetLeft - doorAnimRef.current.left) * Math.min(1, dt * 14);
        doorAnimRef.current.right +=
          (targetRight - doorAnimRef.current.right) * Math.min(1, dt * 14);

        // Toreador music box notes during power outage
        if (nextSim.powerOutage && nextSim.outagePhase === 'toreador_song') {
          const noteIdx = Math.floor(nextSim.outageTimer / 0.55);
          if (noteIdx > toreadorNoteStepRef.current) {
            toreadorNoteStepRef.current = noteIdx;
            soundEngine.playToreadorNote(noteIdx);
          }
        }

        processAudioCues(nextSim);

        // Check if simulation transitioned to victory or defeat
        if (nextSim.status === 'victory' || nextSim.status === 'defeat') {
          const snap = buildRunSummarySnapshot(nextSim);
          setRunSnapshot(snap);
          setHudState({ ...nextSim });
          setScreenState('gameover');
          document.body.dataset.state = 'gameover';
        } else {
          // Throttle React HUD sync to ~5Hz or when discrete states change
          hudSyncAccumulator += dt;
          const discreteChanged =
            prevSim.currentHour !== nextSim.currentHour ||
            Math.floor(prevSim.powerTenths / 10) !== Math.floor(nextSim.powerTenths / 10) ||
            prevSim.usageLevel !== nextSim.usageLevel ||
            prevSim.powerOutage !== nextSim.powerOutage ||
            prevSim.jumpscareBy !== nextSim.jumpscareBy ||
            prevSim.abascalStage !== nextSim.abascalStage ||
            prevSim.abascalSprinting !== nextSim.abascalSprinting ||
            prevSim.lastEventBanner !== nextSim.lastEventBanner;

          if (discreteChanged || hudSyncAccumulator >= 0.2) {
            hudSyncAccumulator = 0;
            setHudState({ ...nextSim });
          }
        }
      }

      // Render Office or Active Jumpscare onto Canvas
      const activeSim = simRef.current;
      if (activeSim.jumpscareBy && activeSim.jumpscareTimer > 0) {
        drawJumpscareScene(
          ctx,
          canvas.width,
          canvas.height,
          activeSim.jumpscareBy,
          activeSim.jumpscareTimer,
          timeSec
        );
      } else {
        hitboxesRef.current = drawOfficeScene(
          ctx,
          canvas.width,
          canvas.height,
          activeSim,
          panCurrentRef.current,
          doorAnimRef.current,
          timeSec
        );
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, [screenState, processAudioCues]);

  // Global mousemove listener so hovering over right/left HUD buttons never stops camera panning
  useEffect(() => {
    const onWindowMouseMove = (e: MouseEvent) => {
      if (window.innerWidth <= 0) return;
      const normX = (e.clientX / window.innerWidth) * 2 - 1; // -1 to +1
      mouseNormXRef.current = Math.max(-1, Math.min(1, normX));
      mouseActiveRef.current = true;

      if (screenState === 'playing' && !simRef.current.monitorOpen) {
        // Reaching 62% toward either screen edge pans 100% to that doorway (-1 or +1)
        const target = Math.max(-1, Math.min(1, normX / 0.62));
        panTargetRef.current = target;
      }
    };

    window.addEventListener('mousemove', onWindowMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', onWindowMouseMove);
  }, [screenState]);

  // Unified Keyboard Shortcuts & Focus-Loss Hygiene
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      keysHeldRef.current.add(e.key);

      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        handleToggleFullscreen();
        return;
      }

      if (screenState === 'title') {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleStartNight(selectedNight, selectedNight === 6 ? customAI : undefined);
        }
        return;
      }

      if (screenState === 'gameover') {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const nextN =
            runSnapshot?.outcome === 'victory'
              ? Math.min(6, selectedNight + 1)
              : selectedNight;
          handleStartNight(nextN);
        }
        return;
      }

      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        e.preventDefault();
        setScreenState((prev) => (prev === 'playing' ? 'paused' : 'playing'));
        return;
      }

      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        setMuted((prev) => {
          const next = !prev;
          soundEngine.setMuted(next);
          return next;
        });
        return;
      }

      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        handleStartNight(selectedNight);
        return;
      }

      if (screenState !== 'playing') return;

      switch (e.key) {
        case 'a':
        case 'A':
          handleToggleLeftDoor();
          break;
        case 'd':
        case 'D':
          handleToggleRightDoor();
          break;
        case 'q':
        case 'Q':
          handleToggleLeftLight();
          break;
        case 'e':
        case 'E':
          handleToggleRightLight();
          break;
        case ' ':
          e.preventDefault();
          handleToggleMonitor();
          break;
        default: {
          // Camera hotkeys 1-9, 0, -
          const matchedCam = CAMERAS.find((c) => c.keyHint === e.key);
          if (matchedCam) {
            if (!simRef.current.monitorOpen) {
              handleToggleMonitor();
            }
            handleSelectCamera(matchedCam.id);
          }
          break;
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysHeldRef.current.delete(e.key);
    };

    const clearHeldInputs = () => {
      keysHeldRef.current.clear();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearHeldInputs);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearHeldInputs);
    };
  }, [
    screenState,
    selectedNight,
    customAI,
    runSnapshot,
    handleStartNight,
    handleToggleFullscreen,
    handleToggleLeftDoor,
    handleToggleRightDoor,
    handleToggleLeftLight,
    handleToggleRightLight,
    handleToggleMonitor,
    handleSelectCamera,
  ]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (screenState !== 'playing' || hudState.monitorOpen) return;
    soundEngine.startAmbientDrone();

    const boxes = hitboxesRef.current;
    if (!boxes) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const inside = (b: { x: number; y: number; w: number; h: number }) =>
      x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;

    if (inside(boxes.leftDoorBtn)) {
      handleToggleLeftDoor();
    } else if (inside(boxes.leftLightBtn)) {
      handleToggleLeftLight();
    } else if (inside(boxes.rightDoorBtn)) {
      handleToggleRightDoor();
    } else if (inside(boxes.rightLightBtn)) {
      handleToggleRightLight();
    } else if (
      Math.hypot(x - boxes.posterNose.x, y - boxes.posterNose.y) <= boxes.posterNose.r
    ) {
      // Iconic FNAF Easter Egg: Clicking Pedro-Freddy's nose on the Celebrate poster honks!
      soundEngine.playNoseHonk();
    } else if (
      Math.hypot(x - boxes.fanToggle.x, y - boxes.fanToggle.y) <= boxes.fanToggle.r
    ) {
      simRef.current = { ...simRef.current, fanOn: !simRef.current.fanOn };
      setHudState({ ...simRef.current });
    }
  };

  const powerPercent = Math.max(0, Math.floor(hudState.powerTenths / 10));
  const hourDisplay = formatFnafHour(hudState.currentHour);
  const phoneCallLines = PHONE_GUY_CALLS[selectedNight] || PHONE_GUY_CALLS[1];
  const currentPhoneLine =
    !callMuted && callLineIndex < phoneCallLines.length
      ? phoneCallLines[callLineIndex]
      : null;

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-black select-none">
      {/* Persistent Isolated Office Canvas */}
      <div className="fixed inset-0 z-0">
        <canvas
          ref={officeCanvasRef}
          data-testid="office-canvas"
          onClick={handleCanvasClick}
          className="w-full h-full block cursor-crosshair"
        />
      </div>

      {/* Title Screen */}
      {screenState === 'title' && (
        <div className="fixed inset-0 z-20">
          <TitleScreen
            selectedNight={selectedNight}
            customAI={customAI}
            isFullscreen={isFullscreen}
            onToggleFullscreen={handleToggleFullscreen}
            onStartGame={handleStartNight}
            onUpdateCustomAI={setCustomAI}
          />
        </div>
      )}

      {/* Active Playing HUD & Controls */}
      {(screenState === 'playing' || screenState === 'paused') && (
        <div className="fixed inset-0 z-10 pointer-events-none">
          {/* Top-Left Phone Guy Security Briefing Box */}
          <div className="absolute top-4 left-4 flex flex-col gap-2 max-w-md">
            {currentPhoneLine && (
              <div className="pointer-events-auto bg-slate-950/90 border border-slate-700 rounded px-3.5 py-2.5 shadow-lg">
                <div className="flex items-center justify-between gap-4 mb-1">
                  <span className="font-mono-tech text-[11px] font-bold text-sky-400 uppercase tracking-wider">
                    LLAMADA ENTRANTE · COMISARIO DE GUARDIA
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.currentTarget.blur();
                      setCallMuted(true);
                    }}
                    className="px-2 py-0.5 text-[10px] font-mono-tech bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-600 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    SILENCIAR LLAMADA
                  </button>
                </div>
                <p className="text-xs text-slate-200 leading-snug">{currentPhoneLine}</p>
              </div>
            )}

            {hudState.lastEventBanner && (
              <div className="bg-red-950/90 border border-red-500/80 rounded px-3 py-1.5 font-mono-tech text-xs text-red-200 shadow">
                {hudState.lastEventBanner}
              </div>
            )}
          </div>

          {/* Top-Right FNAF Clock, Night Readout & Utility Icon Buttons */}
          <div className="absolute top-4 right-4 flex items-start gap-4">
            <div className="text-right bg-slate-950/80 border border-slate-800 px-3.5 py-2 rounded">
              <div
                className="font-display text-3xl md:text-4xl text-white leading-none font-mono-tech tracking-wider"
                data-testid="hud-clock"
              >
                {hourDisplay}
              </div>
              <div className="font-mono-tech text-xs text-amber-400 tracking-widest uppercase mt-1">
                {selectedNight === 6 ? 'NOCHE CUSTOM' : `NOCHE ${selectedNight}`}
              </div>
            </div>

            {/* Compact Top-Right Utility Controls (Fullscreen [F], Mute [M], Pause [P], Restart [R]) */}
            <div className="flex items-center gap-1.5 pointer-events-auto">
              <button
                type="button"
                tabIndex={-1}
                title={isFullscreen ? 'Salir de Pantalla Completa [F]' : 'Pantalla Completa [F]'}
                aria-label={
                  isFullscreen ? 'Salir de Pantalla Completa [F]' : 'Pantalla Completa [F]'
                }
                onClick={(e) => {
                  e.currentTarget.blur();
                  handleToggleFullscreen();
                }}
                className="w-10 h-10 flex items-center justify-center bg-slate-950/90 hover:bg-slate-800 border border-slate-700 rounded text-slate-200 cursor-pointer"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                  {isFullscreen ? (
                    <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
                  ) : (
                    <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
                  )}
                </svg>
              </button>

              <button
                type="button"
                tabIndex={-1}
                title={muted ? 'Activar Audio [M]' : 'Silenciar Audio [M]'}
                aria-label={muted ? 'Activar Audio [M]' : 'Silenciar Audio [M]'}
                onClick={(e) => {
                  e.currentTarget.blur();
                  setMuted((prev) => {
                    const next = !prev;
                    soundEngine.setMuted(next);
                    return next;
                  });
                }}
                className="w-10 h-10 flex items-center justify-center bg-slate-950/90 hover:bg-slate-800 border border-slate-700 rounded text-slate-200 cursor-pointer"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                  {muted ? (
                    <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                  ) : (
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                  )}
                </svg>
              </button>

              <button
                type="button"
                tabIndex={-1}
                title="Pausar Partida [P]"
                aria-label="Pausar Partida [P]"
                onClick={(e) => {
                  e.currentTarget.blur();
                  setScreenState((prev) => (prev === 'playing' ? 'paused' : 'playing'));
                }}
                className="w-10 h-10 flex items-center justify-center bg-slate-950/90 hover:bg-slate-800 border border-slate-700 rounded text-slate-200 cursor-pointer"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
              </button>

              <button
                type="button"
                tabIndex={-1}
                title="Reiniciar Noche [R]"
                aria-label="Reiniciar Noche [R]"
                onClick={(e) => {
                  e.currentTarget.blur();
                  handleStartNight(selectedNight);
                }}
                className="w-10 h-10 flex items-center justify-center bg-slate-950/90 hover:bg-slate-800 border border-slate-700 rounded text-slate-200 cursor-pointer"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                  <path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Diegetic Perimeter Industrial Door & Light Control Panels (Left & Right Edges) */}
          {!hudState.monitorOpen && !hudState.powerOutage && (
            <>
              <div className="absolute left-3 top-1/2 -translate-y-1/2 bg-slate-950/95 border-2 border-slate-600 rounded-lg p-2 flex flex-col gap-2 shadow-2xl pointer-events-auto">
                <div className="font-mono-tech text-[10px] text-center text-slate-400 tracking-wider uppercase">
                  ALA OESTE
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    handleToggleLeftDoor();
                  }}
                  className={`w-28 py-3 px-2 rounded border-2 font-display text-xs uppercase tracking-wider shadow-inner transition-colors cursor-pointer whitespace-nowrap shrink-0 flex flex-col items-center gap-0.5 ${
                    hudState.leftDoorClosed
                      ? 'bg-emerald-700 border-emerald-300 text-white shadow-[0_0_12px_rgba(16,185,129,0.5)]'
                      : 'bg-red-800 hover:bg-red-700 border-red-400 text-white'
                  }`}
                >
                  <span>PUERTA IZQ. [A]</span>
                  <span className="font-mono-tech text-[10px] opacity-90">
                    {hudState.leftDoorClosed ? 'CERRADA' : 'ABIERTA'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    handleToggleLeftLight();
                  }}
                  className={`w-28 py-3 px-2 rounded border-2 font-display text-xs uppercase tracking-wider shadow-inner transition-colors cursor-pointer whitespace-nowrap shrink-0 flex flex-col items-center gap-0.5 ${
                    hudState.leftLightOn
                      ? 'bg-sky-400 border-white text-slate-950 font-bold shadow-[0_0_14px_rgba(56,189,248,0.8)]'
                      : 'bg-slate-800 hover:bg-slate-700 border-slate-500 text-slate-200'
                  }`}
                >
                  <span>LUZ IZQ. [Q]</span>
                  <span className="font-mono-tech text-[10px] opacity-90">
                    {hudState.leftLightOn ? 'ACTIVA' : 'APAGADA'}
                  </span>
                </button>
              </div>

              <div className="absolute right-3 top-1/2 -translate-y-1/2 bg-slate-950/95 border-2 border-slate-600 rounded-lg p-2 flex flex-col gap-2 shadow-2xl pointer-events-auto">
                <div className="font-mono-tech text-[10px] text-center text-slate-400 tracking-wider uppercase">
                  ALA ESTE
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    handleToggleRightDoor();
                  }}
                  className={`w-28 py-3 px-2 rounded border-2 font-display text-xs uppercase tracking-wider shadow-inner transition-colors cursor-pointer whitespace-nowrap shrink-0 flex flex-col items-center gap-0.5 ${
                    hudState.rightDoorClosed
                      ? 'bg-emerald-700 border-emerald-300 text-white shadow-[0_0_12px_rgba(16,185,129,0.5)]'
                      : 'bg-red-800 hover:bg-red-700 border-red-400 text-white'
                  }`}
                >
                  <span>PUERTA DER. [D]</span>
                  <span className="font-mono-tech text-[10px] opacity-90">
                    {hudState.rightDoorClosed ? 'CERRADA' : 'ABIERTA'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    handleToggleRightLight();
                  }}
                  className={`w-28 py-3 px-2 rounded border-2 font-display text-xs uppercase tracking-wider shadow-inner transition-colors cursor-pointer whitespace-nowrap shrink-0 flex flex-col items-center gap-0.5 ${
                    hudState.rightLightOn
                      ? 'bg-amber-400 border-white text-slate-950 font-bold shadow-[0_0_14px_rgba(251,191,36,0.8)]'
                      : 'bg-slate-800 hover:bg-slate-700 border-slate-500 text-slate-200'
                  }`}
                >
                  <span>LUZ DER. [E]</span>
                  <span className="font-mono-tech text-[10px] opacity-90">
                    {hudState.rightLightOn ? 'ACTIVA' : 'APAGADA'}
                  </span>
                </button>
              </div>
            </>
          )}

          {/* Bottom-Left Power Left % & 5-Pip Graphical Usage Meter */}
          <div className="absolute bottom-4 left-4 bg-slate-950/90 border border-slate-800 rounded px-4 py-3 shadow-xl">
            <div className="flex items-baseline gap-2 mb-2">
              <span className="font-mono-tech text-xs text-slate-400 uppercase tracking-wider">
                ENERGÍA:
              </span>
              <span
                className={`font-display text-2xl font-mono-tech ${
                  powerPercent <= 20 ? 'text-red-500' : 'text-white'
                }`}
                data-testid="hud-power"
              >
                {powerPercent}%
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-mono-tech text-xs text-slate-400 uppercase tracking-wider">
                CONSUMO:
              </span>
              <div
                className="flex items-center gap-1"
                data-testid="hud-usage"
                aria-label={`Nivel de consumo ${hudState.usageLevel} de 5`}
              >
                {[1, 2, 3, 4, 5].map((pip) => {
                  const active = pip <= hudState.usageLevel;
                  const pipColor =
                    pip <= 2
                      ? 'bg-emerald-500 border-emerald-300'
                      : pip === 3
                      ? 'bg-amber-400 border-amber-200'
                      : 'bg-red-600 border-red-300';
                  return (
                    <span
                      key={pip}
                      className={`inline-block w-4 h-5 rounded-xs border ${
                        active ? pipColor : 'bg-slate-900 border-slate-700'
                      }`}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bottom-Center Iconic FNAF CCTV Monitor Flip Bar */}
          {!hudState.powerOutage && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-auto">
              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  handleToggleMonitor();
                }}
                className="px-8 py-2.5 bg-slate-900/95 hover:bg-slate-800 text-slate-100 font-display text-sm md:text-base uppercase tracking-widest rounded border-2 border-slate-500 shadow-2xl flex items-center gap-3 cursor-pointer whitespace-nowrap shrink-0"
              >
                <span>
                  {hudState.monitorOpen
                    ? '▼ BAJAR MONITOR DE CÁMARAS [ESPACIO] ▼'
                    : '▲ ABRIR MONITOR CCTV · 11 CÁMARAS [ESPACIO] ▲'}
                </span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Fullscreen CCTV Monitor Overlay */}
      {screenState === 'playing' && hudState.monitorOpen && (
        <CCTVMonitor
          state={hudState}
          onSelectCamera={handleSelectCamera}
          onCloseMonitor={handleToggleMonitor}
        />
      )}

      {/* Pause Modal */}
      {screenState === 'paused' && (
        <PauseModal
          nightNumber={selectedNight}
          hourLabel={hourDisplay}
          powerPercent={powerPercent}
          isFullscreen={isFullscreen}
          onToggleFullscreen={handleToggleFullscreen}
          onResume={() => setScreenState('playing')}
          onRestart={() => handleStartNight(selectedNight)}
          onReturnTitle={() => setScreenState('title')}
        />
      )}

      {/* Victory (6:00 AM) or Defeat (Jumpscare) Modal */}
      {screenState === 'gameover' && runSnapshot && (
        <EndOfRunModal
          snapshot={runSnapshot}
          onPlayAgainOrNext={(nextN) => handleStartNight(nextN)}
          onReturnTitle={() => setScreenState('title')}
        />
      )}
    </main>
  );
}
