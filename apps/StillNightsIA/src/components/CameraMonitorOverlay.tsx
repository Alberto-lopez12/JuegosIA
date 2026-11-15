import React, { useEffect, useRef, useState } from 'react';
import {
  AnimatronicId,
  AnimatronicState,
  NIGHT_4_KEY_PICKUP_TEXT,
  Night4KeyId,
  Night4PuzzleState,
  NodeId,
  areAllNight4LocksUnlocked,
  getNextLockedNight4DoorLock,
  getVisibleNight4KeyOnCamera,
  isAnimatronicVisibleOnCamera,
  isVentNode,
} from '../game/rules';
import {
  CAMERA_NODES,
  getNight4Cam05DoorGeometry,
  getNight4CameraKeyPosition,
  renderCameraFeed,
} from '../game/cameraRenderer';
import { soundController } from '../game/audio';

interface FloatingPickupText {
  id: number;
  text: string;
  leftPct: number;
  topPct: number;
}

interface Props {
  isOpen: boolean;
  selectedCam: NodeId;
  onSelectCam: (cam: NodeId) => void;
  onCloseMonitor: () => void;
  animatronics: Record<AnimatronicId, AnimatronicState>;
  staticBurst: number;
  ventClosed: boolean;
  onToggleVent: () => void;
  powerInt: number;
  formattedHour: string;
  nightLabel: string;
  night4Puzzle?: Night4PuzzleState;
  elapsedNightSec?: number;
  hourDurationSec?: number;
  onCollectKey?: (keyId: Night4KeyId) => void;
  onEnterKeypadDigit?: (digit: string) => {
    justUnlockedCloset: boolean;
    triggeredWrongCode: boolean;
  };
  onClearKeypad?: () => void;
  onAttemptUnlockLock?: (
    lockId: Night4KeyId,
    selectedKeyId?: Night4KeyId | null
  ) => {
    unlocked: boolean;
    triggerShake: boolean;
  };
  onAttemptOpenHiddenDoor?: () => {
    opened: boolean;
    triggerShake: boolean;
  };
  onCollectSecretPapers?: () => {
    collected: boolean;
  };
}

export const CameraMonitorOverlay: React.FC<Props> = ({
  isOpen,
  selectedCam,
  onSelectCam,
  onCloseMonitor,
  animatronics,
  staticBurst,
  ventClosed,
  onToggleVent,
  powerInt,
  formattedHour,
  nightLabel,
  night4Puzzle,
  elapsedNightSec = 0,
  hourDurationSec = 51,
  onCollectKey,
  onEnterKeypadDigit,
  onClearKeypad,
  onAttemptUnlockLock,
  onAttemptOpenHiddenDoor,
  onCollectSecretPapers,
}) => {
  // Separate mode state: 'BUILDING' (normal room cameras) vs 'VENT' (ventilation cameras)
  const [monitorMode, setMonitorMode] = useState<'BUILDING' | 'VENT'>(() =>
    isVentNode(selectedCam) ? 'VENT' : 'BUILDING'
  );
  const [screenShake, setScreenShake] = useState<boolean>(false);
  const [floatingTexts, setFloatingTexts] = useState<FloatingPickupText[]>([]);
  const [selectedKeyId, setSelectedKeyId] = useState<Night4KeyId | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animsRef = useRef(animatronics);
  animsRef.current = animatronics;
  const staticRef = useRef(staticBurst);
  staticRef.current = staticBurst;
  const puzzleRef = useRef(night4Puzzle);
  puzzleRef.current = night4Puzzle;
  const elapsedSecRef = useRef(elapsedNightSec);
  elapsedSecRef.current = elapsedNightSec;

  const lockShakeTimersRef = useRef<Record<Night4KeyId, number>>({
    1: 0,
    2: 0,
    3: 0,
    4: 0,
  });
  const lockFallProgressRef = useRef<Record<Night4KeyId, number>>({
    1: 0,
    2: 0,
    3: 0,
    4: 0,
  });
  const shakeTimeoutRef = useRef<number | null>(null);

  const triggerMildScreenShake = () => {
    setScreenShake(true);
    if (shakeTimeoutRef.current !== null) {
      window.clearTimeout(shakeTimeoutRef.current);
    }
    shakeTimeoutRef.current = window.setTimeout(() => {
      setScreenShake(false);
    }, 360);
  };

  const spawnFloatingText = (text: string, leftPct: number, topPct: number) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setFloatingTexts((prev) => [...prev, { id, text, leftPct, topPct }]);
    window.setTimeout(() => {
      setFloatingTexts((prev) => prev.filter((item) => item.id !== id));
    }, 1250);
  };

  // Keep monitorMode in sync if selectedCam changes externally
  useEffect(() => {
    setMonitorMode(isVentNode(selectedCam) ? 'VENT' : 'BUILDING');
  }, [selectedCam]);

  useEffect(() => {
    if (!isOpen) return;
    let raf = 0;
    const start = performance.now();
    let lastNow = start;

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - lastNow) / 1000);
      lastNow = now;

      // Update lock shake and lock fall animation timers
      const p = puzzleRef.current;
      ([1, 2, 3, 4] as Night4KeyId[]).forEach((k) => {
        if (lockShakeTimersRef.current[k] > 0) {
          lockShakeTimersRef.current[k] = Math.max(0, lockShakeTimersRef.current[k] - dt);
        }
        if (p?.locksUnlocked[k]) {
          lockFallProgressRef.current[k] = Math.min(1, lockFallProgressRef.current[k] + dt * 1.85);
        } else {
          lockFallProgressRef.current[k] = 0;
        }
      });

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          renderCameraFeed(
            ctx,
            canvas.width,
            canvas.height,
            selectedCam,
            animsRef.current,
            (now - start) / 1000,
            staticRef.current,
            p
              ? {
                  puzzle: p,
                  elapsedNightSec: elapsedSecRef.current,
                  hourDurationSec,
                  lockShakeTimersSec: lockShakeTimersRef.current,
                  lockFallProgress: lockFallProgressRef.current,
                }
              : undefined
          );
        }
      }
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [isOpen, selectedCam, hourDurationSec]);

  if (!isOpen) return null;

  const handleToggleMonitorMode = () => {
    soundController.playCameraBlip();
    if (monitorMode === 'BUILDING') {
      setMonitorMode('VENT');
      if (!isVentNode(selectedCam)) {
        onSelectCam('VENT_CENTRAL');
      }
    } else {
      setMonitorMode('BUILDING');
      if (isVentNode(selectedCam)) {
        onSelectCam('CAM_1A');
      }
    }
  };

  const currentMeta =
    CAMERA_NODES.find((c) => c.id === selectedCam) || CAMERA_NODES[0];

  const visibleNodes = CAMERA_NODES.filter((n) => n.sector === monitorMode);

  const occupantsHere = (Object.values(animatronics) as AnimatronicState[]).filter((a) =>
    isAnimatronicVisibleOnCamera(a, selectedCam)
  );

  // Night 4 puzzle visible key on the current camera
  const visibleKeyOnCam =
    night4Puzzle?.active && monitorMode === 'BUILDING'
      ? getVisibleNight4KeyOnCamera(night4Puzzle, selectedCam, elapsedNightSec, hourDurationSec)
      : null;

  const keyPlacement =
    visibleKeyOnCam !== null ? getNight4CameraKeyPosition(selectedCam, 760, 520) : null;

  const cam05Geom = getNight4Cam05DoorGeometry(760, 520);

  const handleCollectKeyClick = (keyId: Night4KeyId, leftPct: number, topPct: number) => {
    soundController.playKeyGet();
    spawnFloatingText(NIGHT_4_KEY_PICKUP_TEXT, leftPct, topPct);
    onCollectKey?.(keyId);
  };

  const handleLockClick = (lockId: Night4KeyId) => {
    if (!night4Puzzle || !night4Puzzle.closetUnlocked || night4Puzzle.locksUnlocked[lockId]) {
      return;
    }
    const res = onAttemptUnlockLock?.(lockId, selectedKeyId);
    if (res?.unlocked) {
      soundController.playHeavyDoorLockUnlock();
      if (selectedKeyId === lockId) {
        setSelectedKeyId(null);
      }
    } else if (res?.triggerShake) {
      lockShakeTimersRef.current[lockId] = 0.48;
      triggerMildScreenShake();
      soundController.playLockedDoorRattle();
    }
  };

  const handleDoorManillarClick = () => {
    if (!night4Puzzle || !night4Puzzle.closetUnlocked || night4Puzzle.hiddenDoorOpen) return;
    const res = onAttemptOpenHiddenDoor?.();
    if (res?.opened) {
      soundController.playCreakSound();
    } else if (res?.triggerShake) {
      const nextLocked = getNextLockedNight4DoorLock(night4Puzzle);
      if (nextLocked) {
        lockShakeTimersRef.current[nextLocked] = 0.48;
      }
      triggerMildScreenShake();
      soundController.playLockedDoorRattle();
    }
  };

  const handlePapersClick = () => {
    if (!night4Puzzle || !night4Puzzle.hiddenDoorOpen || night4Puzzle.papersCollected) return;
    const res = onCollectSecretPapers?.();
    if (res?.collected) {
      soundController.playKeyGet();
      const leftPct = ((cam05Geom.papers.x + cam05Geom.papers.w * 0.5) / 760) * 100;
      const topPct = ((cam05Geom.papers.y + cam05Geom.papers.h * 0.3) / 520) * 100;
      spawnFloatingText('papeles recogidos', leftPct, topPct);
    }
  };

  const handleDigitPress = (digit: string) => {
    soundController.playCameraBlip();
    const res = onEnterKeypadDigit?.(digit);
    if (res?.justUnlockedCloset) {
      soundController.playCreakSound();
    } else if (res?.triggeredWrongCode) {
      triggerMildScreenShake();
      soundController.playLockedDoorRattle();
    }
  };

  return (
    <div
      data-testid="camera-monitor-overlay"
      data-screen-shake={screenShake ? 'true' : 'false'}
      style={
        screenShake
          ? { transform: 'translate(3px, -2px)' }
          : undefined
      }
      className="fixed inset-0 z-30 bg-zinc-950 flex flex-col justify-between p-4 sm:p-6 pointer-events-auto transition-transform duration-75"
      aria-label="Monitor de Cámaras y Conductos de Ventilación"
    >
      {/* Top Camera Monitor Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-4">
          <span
            className={`px-2.5 py-1 text-xs font-mono font-bold rounded border ${
              monitorMode === 'VENT'
                ? 'bg-sky-900/90 text-sky-200 border-sky-600'
                : 'bg-red-900/90 text-red-200 border-red-700'
            }`}
          >
            REC · {currentMeta.shortCode}
          </span>
          <div>
            <h2 className="text-xl font-bold text-zinc-100 font-['Barlow_Condensed'] tracking-wide">
              {currentMeta.name}
            </h2>
            <p className="text-xs text-zinc-400">{currentMeta.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-3 text-xs font-mono text-zinc-300 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-lg tabular-nums">
            <span>ENERGÍA: {powerInt}%</span>
            <span>·</span>
            <span className="text-white font-bold">{formattedHour}</span>
            <span>·</span>
            <span className="text-red-400">{nightLabel}</span>
          </div>
          <button
            type="button"
            onClick={onToggleVent}
            className={`px-3.5 py-2 text-xs font-mono font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
              ventClosed
                ? 'bg-emerald-800 border-emerald-600 text-white'
                : 'bg-zinc-900 border-zinc-700 text-zinc-200 hover:bg-zinc-800'
            }`}
          >
            {ventClosed ? 'Conducto Oficina: CERRADO [W]' : 'Sellar Conducto Oficina [W]'}
          </button>
        </div>
      </div>

      {/* Main Feed + Separated Facility / Ventilation Blueprint Map */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 my-4 flex-1 min-h-0">
        {/* Left: Live CRT Camera Feed */}
        <div className="lg:col-span-7 relative bg-zinc-950 border-2 border-zinc-800 rounded-xl overflow-hidden flex flex-col justify-between">
          <canvas
            ref={canvasRef}
            width={760}
            height={520}
            className="w-full h-full object-fill"
          />

          {/* NIGHT 4 PUZZLE: Collected Keys Strip & Papers Status (Top-Left of CRT Feed) */}
          {night4Puzzle?.active && (
            <div
              data-testid="night4-keys-hud"
              className="absolute top-3 left-3 z-20 flex flex-wrap items-center gap-1.5 bg-zinc-950/90 border border-zinc-700 rounded-lg px-2.5 py-1.5 font-mono text-[11px]"
            >
              <span className="text-zinc-400 mr-1">LLAVES:</span>
              {([1, 2, 3, 4] as Night4KeyId[]).map((kId) => {
                const collected = night4Puzzle.keysCollected[kId];
                const used = night4Puzzle.locksUnlocked[kId];
                const isSelected = selectedKeyId === kId;
                return (
                  <button
                    key={kId}
                    type="button"
                    disabled={!collected || used}
                    data-testid={`night4-inventory-key-${kId}`}
                    onClick={() => setSelectedKeyId((prev) => (prev === kId ? null : kId))}
                    className={`px-2 py-0.5 rounded border text-[10px] font-bold transition-colors ${
                      used
                        ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-400 line-through'
                        : collected
                        ? isSelected
                          ? 'bg-amber-400 text-zinc-950 border-white'
                          : 'bg-amber-950/90 text-amber-300 border-amber-500 hover:bg-amber-900'
                        : 'bg-zinc-900/80 text-zinc-600 border-zinc-800'
                    }`}
                  >
                    #{kId}
                  </button>
                );
              })}
              {night4Puzzle.papersCollected && (
                <span
                  data-testid="night4-papers-collected-badge"
                  className="ml-1.5 px-2 py-0.5 rounded bg-emerald-900/90 border border-emerald-500 text-emerald-200 font-bold text-[10px]"
                >
                  PAPELES RECOGIDOS
                </span>
              )}
            </div>
          )}

          {/* NIGHT 4 PUZZLE: Clickable Key Hitbox on Camera Floor (CAM 4B, 1A/1B, 03, 2A/2B) */}
          {visibleKeyOnCam !== null && keyPlacement && (
            <button
              type="button"
              data-testid={`night4-pickup-key-${visibleKeyOnCam}`}
              aria-label={`Recoger llave ${visibleKeyOnCam}`}
              onClick={() =>
                handleCollectKeyClick(
                  visibleKeyOnCam,
                  (keyPlacement.x / 760) * 100,
                  (keyPlacement.y / 520) * 100
                )
              }
              style={{
                left: `${(keyPlacement.x / 760) * 100}%`,
                top: `${(keyPlacement.y / 520) * 100}%`,
                width: `${((keyPlacement.hitRadius * 2) / 760) * 100}%`,
                height: `${((keyPlacement.hitRadius * 2) / 520) * 100}%`,
                transform: 'translate(-50%, -50%)',
              }}
              className="absolute z-20 rounded-full cursor-pointer bg-transparent hover:bg-amber-400/10 border border-transparent hover:border-amber-400/40 transition-colors"
            />
          )}

          {/* NIGHT 4 PUZZLE: Embedded Numeric Keypad Panel on the Right Side of the CAM 05 Closet (~7% larger) */}
          {night4Puzzle?.active &&
            selectedCam === 'CAM_5' &&
            !night4Puzzle.closetUnlocked && (
              <div
                data-testid="cam05-keypad-panel"
                style={{
                  left: '50.9%',
                  top: '28.5%',
                  width: '14.15%',
                  minWidth: '103px',
                }}
                className="absolute z-20 bg-zinc-950/95 border-2 border-zinc-700 rounded p-2 shadow-[inset_0_2px_10px_rgba(0,0,0,0.95),0_4px_12px_rgba(0,0,0,0.85)] font-mono"
              >
                <div className="flex items-center justify-between text-[8.5px] font-bold uppercase tracking-wider text-zinc-400 mb-1 px-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 inline-block" />
                  <span>ARMARIO</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 inline-block" />
                </div>
                <div
                  data-testid="cam05-keypad-display"
                  className={`w-full py-1 px-1 mb-1.5 rounded border text-center text-[13px] font-bold tracking-[0.28em] ${
                    night4Puzzle.keypadError
                      ? 'bg-red-950 border-red-500 text-red-300'
                      : 'bg-zinc-900 border-zinc-700 text-emerald-400'
                  }`}
                >
                  {night4Puzzle.keypadError
                    ? 'ERR'
                    : night4Puzzle.keypadInput.padEnd(3, '_')}
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                    <button
                      key={d}
                      type="button"
                      data-testid={`cam05-key-${d}`}
                      onClick={() => handleDigitPress(d)}
                      className="py-1.5 rounded bg-zinc-800/95 hover:bg-zinc-700 active:bg-amber-500 active:text-zinc-950 text-zinc-200 border border-zinc-600 text-[11px] leading-none font-bold cursor-pointer"
                    >
                      {d}
                    </button>
                  ))}
                  <button
                    type="button"
                    data-testid="cam05-key-clear"
                    onClick={() => {
                      soundController.playCameraBlip();
                      onClearKeypad?.();
                    }}
                    className="py-1.5 rounded bg-red-950/85 hover:bg-red-900 text-red-200 border border-red-700 text-[8.5px] leading-none font-bold cursor-pointer"
                  >
                    CLR
                  </button>
                  <button
                    type="button"
                    data-testid="cam05-key-0"
                    onClick={() => handleDigitPress('0')}
                    className="py-1.5 rounded bg-zinc-800/95 hover:bg-zinc-700 active:bg-amber-500 active:text-zinc-950 text-zinc-200 border border-zinc-600 text-[11px] leading-none font-bold cursor-pointer"
                  >
                    0
                  </button>
                  <div className="flex items-center justify-center text-[7.5px] text-zinc-500 leading-none">
                    3 DÍG
                  </div>
                </div>
              </div>
            )}

          {/* NIGHT 4 PUZZLE: Interactive 4 Vertical Locks, Door Handle (Manillar), and Secret Papers in CAM 05 */}
          {night4Puzzle?.active &&
            selectedCam === 'CAM_5' &&
            night4Puzzle.closetUnlocked &&
            night4Puzzle.closetOpenProgress >= 0.7 && (
              <>
                {/* 4 Vertical Locks (Top = 1 to Bottom = 4) while Hidden Door is closed */}
                {!night4Puzzle.hiddenDoorOpen &&
                  ([1, 2, 3, 4] as Night4KeyId[]).map((lockId) => {
                    if (night4Puzzle.locksUnlocked[lockId]) return null;
                    const rect = cam05Geom.locks[lockId];
                    return (
                      <button
                        key={lockId}
                        type="button"
                        data-testid={`cam05-lock-${lockId}`}
                        aria-label={`Cerradura ${lockId}`}
                        onClick={() => handleLockClick(lockId)}
                        style={{
                          left: `${(rect.x / 760) * 100}%`,
                          top: `${(rect.y / 520) * 100}%`,
                          width: `${(rect.w / 760) * 100}%`,
                          height: `${(rect.h / 520) * 100}%`,
                        }}
                        className="absolute z-20 cursor-pointer bg-transparent hover:bg-amber-400/15 border border-transparent hover:border-amber-400/60 rounded transition-colors"
                      />
                    );
                  })}

                {/* Door Handle (Manillar) */}
                {!night4Puzzle.hiddenDoorOpen && (
                  <button
                    type="button"
                    data-testid="cam05-door-manillar"
                    aria-label="Manillar de la puerta secreta"
                    onClick={handleDoorManillarClick}
                    style={{
                      left: `${(cam05Geom.handle.x / 760) * 100}%`,
                      top: `${(cam05Geom.handle.y / 520) * 100}%`,
                      width: `${(cam05Geom.handle.w / 760) * 100}%`,
                      height: `${(cam05Geom.handle.h / 520) * 100}%`,
                    }}
                    className={`absolute z-20 cursor-pointer rounded transition-colors ${
                      areAllNight4LocksUnlocked(night4Puzzle)
                        ? 'bg-amber-400/15 hover:bg-amber-400/30 border border-amber-400'
                        : 'bg-transparent hover:bg-zinc-500/15 border border-transparent'
                    }`}
                  />
                )}

                {/* Secret Written Papers inside Open Hidden Door */}
                {night4Puzzle.hiddenDoorOpen &&
                  night4Puzzle.hiddenDoorOpenProgress >= 0.5 &&
                  !night4Puzzle.papersCollected && (
                    <button
                      type="button"
                      data-testid="cam05-secret-papers"
                      aria-label="Recoger papeles secretos"
                      onClick={handlePapersClick}
                      style={{
                        left: `${(cam05Geom.papers.x / 760) * 100}%`,
                        top: `${(cam05Geom.papers.y / 520) * 100}%`,
                        width: `${(cam05Geom.papers.w / 760) * 100}%`,
                        height: `${(cam05Geom.papers.h / 520) * 100}%`,
                      }}
                      className="absolute z-20 cursor-pointer bg-amber-300/10 hover:bg-amber-300/25 border border-amber-300/70 rounded transition-colors"
                    />
                  )}
              </>
            )}

          {/* Rising Floating Pickup Texts ("llave recogida" / "papeles recogidos") */}
          {floatingTexts.map((ft) => (
            <div
              key={ft.id}
              data-testid="floating-pickup-text"
              style={{
                left: `${ft.leftPct}%`,
                top: `${ft.topPct}%`,
                transform: 'translate(-50%, -120%)',
              }}
              className="absolute z-30 pointer-events-none px-2.5 py-1 rounded bg-zinc-950/90 border border-amber-400 text-amber-300 font-mono text-xs font-bold uppercase tracking-wider shadow-lg animate-bounce"
            >
              {ft.text}
            </div>
          ))}

          {/* Overlay telemetry inside CRT feed */}
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between px-3 py-2 bg-black/80 border border-zinc-800 rounded text-xs font-mono">
            <span className="text-zinc-300">
              SISTEMA ACTIVO: {monitorMode === 'VENT' ? 'RED DE CONDUCTOS' : 'CÁMARAS DE SALAS'}
            </span>
            <span className={occupantsHere.length > 0 ? 'text-red-400 font-bold' : 'text-emerald-400'}>
              {occupantsHere.length > 0
                ? `DETECTADO: ${occupantsHere.map((o) => o.name).join(' + ')}`
                : 'SIN SEÑAL DE ANIMATRÓNICOS EN SECTOR'}
            </span>
          </div>
        </div>

        {/* Right: Mode-Switched Map & Camera Selector */}
        <div className="lg:col-span-5 bg-zinc-950/95 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between">
          <div>
            {/* Dedicated Mode Toggle Header & Button separating Normal Cams from Vent Cams */}
            <div className="flex items-center justify-between gap-2 mb-3">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-100 font-mono">
                  {monitorMode === 'BUILDING'
                    ? 'Plano de Cámaras Normales'
                    : 'Plano de Conductos de Ventilación'}
                </h3>
                <p className="text-[11px] font-mono text-zinc-400">
                  {monitorMode === 'BUILDING'
                    ? '8 Cámaras de Salas y Pasillos'
                    : '4 Sensores Internos de Ventilación'}
                </p>
              </div>

              <button
                type="button"
                onClick={handleToggleMonitorMode}
                className={`px-3.5 py-2 text-xs font-mono font-bold rounded-lg border-2 transition-colors whitespace-nowrap shrink-0 ${
                  monitorMode === 'BUILDING'
                    ? 'bg-sky-700 hover:bg-sky-600 text-white border-sky-400'
                    : 'bg-red-700 hover:bg-red-600 text-white border-red-400'
                }`}
              >
                {monitorMode === 'BUILDING'
                  ? 'Cambiar a Ventilación'
                  : 'Cambiar a Cámaras Normales'}
              </button>
            </div>

            {/* Interactive Map Diagram (Displays ONLY the active mode's network!) */}
            <div className="relative w-full h-64 bg-zinc-900/75 border border-zinc-800 rounded-lg overflow-hidden mb-3">
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className="absolute inset-0 w-full h-full pointer-events-none"
              >
                {monitorMode === 'BUILDING' ? (
                  /* Normal Room Corridors Blueprint (including CAM 03 Restrooms access connected to Office Hallway) */
                  <g stroke="#52525b" strokeWidth="1.5">
                    <line x1="48" y1="12" x2="46" y2="32" />
                    <line x1="16" y1="24" x2="46" y2="32" />
                    <line x1="46" y1="32" x2="82" y2="38" />
                    <line x1="46" y1="32" x2="28" y2="56" />
                    <line x1="28" y1="56" x2="28" y2="76" />
                    <line x1="28" y1="76" x2="48" y2="90" />
                    <line x1="46" y1="32" x2="68" y2="56" />
                    <line x1="82" y1="38" x2="68" y2="56" />
                    <line x1="68" y1="56" x2="68" y2="76" />
                    <line x1="68" y1="76" x2="48" y2="90" />
                    {/* Restrooms (BAÑOS) branch connected to CAM 03 */}
                    <line x1="82" y1="38" x2="90" y2="23" />
                    <rect
                      x="81"
                      y="13"
                      width="17"
                      height="10"
                      fill="#0f172a"
                      stroke="#475569"
                      strokeWidth="1"
                    />
                    <text
                      x="89.5"
                      y="19.5"
                      fill="#cbd5e1"
                      stroke="none"
                      fontSize="3.4"
                      textAnchor="middle"
                      fontFamily="monospace"
                    >
                      BAÑOS
                    </text>
                  </g>
                ) : (
                  /* Ventilation Ductwork Blueprint */
                  <g stroke="#0ea5e9" strokeWidth="1.8" strokeDasharray="3,2">
                    <line x1="20" y1="58" x2="48" y2="36" />
                    <line x1="78" y1="58" x2="48" y2="36" />
                    <line x1="20" y1="58" x2="48" y2="74" />
                    <line x1="48" y1="36" x2="48" y2="74" />
                    <line x1="78" y1="58" x2="48" y2="74" />
                    <line x1="48" y1="74" x2="48" y2="90" />
                  </g>
                )}

                {/* Office Marker at Bottom Center */}
                <rect
                  x="41"
                  y="85"
                  width="14"
                  height="11"
                  fill="#18181b"
                  stroke="#eab308"
                  strokeWidth="1.2"
                />
                <text
                  x="48"
                  y="92"
                  fill="#fef08a"
                  fontSize="4"
                  textAnchor="middle"
                  fontFamily="monospace"
                >
                  OFICINA
                </text>
              </svg>

              {/* Map Node Buttons for ONLY the currently selected monitorMode */}
              {visibleNodes.map((node) => {
                const isSelected = selectedCam === node.id;
                const isVent = node.sector === 'VENT';
                return (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => {
                      onSelectCam(node.id);
                      soundController.playCameraBlip();
                    }}
                    style={{
                      left: `${node.mapX}%`,
                      top: `${node.mapY}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                    className={`absolute px-2 py-1 text-[11px] font-mono font-bold rounded border transition-colors whitespace-nowrap ${
                      isSelected
                        ? isVent
                          ? 'bg-sky-500 text-zinc-950 border-white z-10'
                          : 'bg-red-600 text-white border-white z-10'
                        : isVent
                        ? 'bg-sky-950/95 text-sky-300 border-sky-700 hover:bg-sky-900'
                        : 'bg-zinc-900/95 text-zinc-200 border-zinc-600 hover:bg-zinc-800'
                    }`}
                  >
                    {node.shortCode}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dedicated Button List for the Active Camera Mode */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-zinc-300">
                {monitorMode === 'BUILDING'
                  ? 'Seleccionar Cámara de Sala:'
                  : 'Seleccionar Conducto de Ventilación:'}
              </span>
              <span className="text-[11px] font-mono text-zinc-400">
                Modo: {monitorMode === 'BUILDING' ? 'SALAS' : 'VENTILACIÓN'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {visibleNodes.map((node) => {
                const isSelected = selectedCam === node.id;
                return (
                  <button
                    key={node.id}
                    type="button"
                    data-testid={`cam-btn-${node.id}`}
                    onClick={() => {
                      onSelectCam(node.id);
                      soundController.playCameraBlip();
                    }}
                    className={`px-2.5 py-2 text-xs font-mono font-semibold rounded-lg border transition-colors whitespace-nowrap ${
                      isSelected
                        ? monitorMode === 'VENT'
                          ? 'bg-sky-600 text-white border-sky-300'
                          : 'bg-red-700 text-white border-red-400'
                        : monitorMode === 'VENT'
                        ? 'bg-sky-950/60 text-sky-300 border-sky-800 hover:bg-sky-900/60'
                        : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800'
                    }`}
                  >
                    {node.shortCode}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM PERIMETER: Identical 16-Bit "CAMARAS" Button with Downward-Pointing Arrows to Close Monitor */}
      <div className="w-full flex items-end justify-center pt-1">
        <button
          type="button"
          data-testid="camera-monitor-close-btn"
          aria-label="Cerrar Cámaras"
          onClick={onCloseMonitor}
          className="pointer-events-auto group min-w-[460px] sm:min-w-[500px] px-20 py-3.5 bg-zinc-950/95 hover:bg-zinc-900 text-zinc-200 hover:text-white border-2 border-zinc-700 hover:border-zinc-500 shadow-[0_6px_24px_rgba(0,0,0,0.95),inset_0_2px_0_rgba(255,255,255,0.08)] transition-all flex items-center justify-between gap-9 cursor-pointer"
          style={{ imageRendering: 'pixelated' }}
        >
          {/* Left Filled 16-Bit Pixel Arrow Pointing Down */}
          <svg
            width="24"
            height="16"
            viewBox="0 0 20 14"
            className="fill-current text-zinc-300 group-hover:text-white transition-transform shrink-0 rotate-180"
            aria-hidden="true"
          >
            <polygon points="10,2 18,10 14,10 10,6 6,10 2,10" />
            <polygon points="10,6 16,12 4,12" />
          </svg>

          {/* 16-Bit Pixel/Block Typography: CAMARAS */}
          <span
            className="font-mono font-black text-lg sm:text-xl tracking-[0.38em] uppercase text-zinc-100 drop-shadow-[2px_2px_0_rgba(0,0,0,1)]"
            style={{
              fontVariantNumeric: 'tabular-nums',
              textShadow: '2px 2px 0px #000000, -1px -1px 0px #27272a',
            }}
          >
            CAMARAS
          </span>

          {/* Right Filled 16-Bit Pixel Arrow Pointing Down */}
          <svg
            width="24"
            height="16"
            viewBox="0 0 20 14"
            className="fill-current text-zinc-300 group-hover:text-white transition-transform shrink-0 rotate-180"
            aria-hidden="true"
          >
            <polygon points="10,2 18,10 14,10 10,6 6,10 2,10" />
            <polygon points="10,6 16,12 4,12" />
          </svg>
        </button>
      </div>
    </div>
  );
};
