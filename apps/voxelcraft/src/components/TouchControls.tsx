import React, { useRef, useState } from 'react';
import type { GameMode } from '../game/types';

interface TouchControlsProps {
  gameMode: GameMode;
  isFlying: boolean;
  crouching: boolean;
  onJoystickChange: (forward: number, strafe: number, sprint: boolean) => void;
  onRotateCamera: (deltaYaw: number, deltaPitch: number) => void;
  onJumpChange: (held: boolean) => void;
  onFlyDownChange: (held: boolean) => void;
  onToggleFlight: () => void;
  onToggleCrouch: () => void;
  onMineChange: (held: boolean) => void;
  onUseChange: (held: boolean) => void;
  onOpenMap: () => void;
}

const JOYSTICK_RADIUS = 56;
const KNOB_MAX_DIST = 38;
const LOOK_SENSITIVITY = 0.0052;

export const TouchControls: React.FC<TouchControlsProps> = ({
  gameMode,
  isFlying,
  crouching,
  onJoystickChange,
  onRotateCamera,
  onJumpChange,
  onFlyDownChange,
  onToggleFlight,
  onToggleCrouch,
  onMineChange,
  onUseChange,
  onOpenMap,
}) => {
  const joyRef = useRef<HTMLDivElement | null>(null);
  const joyPointerId = useRef<number | null>(null);
  const [knobOffset, setKnobOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [sprinting, setSprinting] = useState(false);

  const lookPointerId = useRef<number | null>(null);
  const lastLookPos = useRef<{ x: number; y: number } | null>(null);

  const [minePressed, setMinePressed] = useState(false);
  const [usePressed, setUsePressed] = useState(false);
  const [jumpPressed, setJumpPressed] = useState(false);
  const [downPressed, setDownPressed] = useState(false);

  const isCreative = gameMode === 'creative';

  const updateJoystickFromClient = (clientX: number, clientY: number) => {
    const el = joyRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width * 0.5;
    const cy = rect.top + rect.height * 0.5;

    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    const clampedDist = Math.min(dist, KNOB_MAX_DIST);
    if (dist > 0.001) {
      dx = (dx / dist) * clampedDist;
      dy = (dy / dist) * clampedDist;
    }

    setKnobOffset({ x: dx, y: dy });

    const normMag = clampedDist / KNOB_MAX_DIST;
    if (normMag < 0.14) {
      setSprinting(false);
      onJoystickChange(0, 0, false);
      return;
    }

    const forward = -dy / KNOB_MAX_DIST;
    const strafe = dx / KNOB_MAX_DIST;
    const isSprint = normMag >= 0.86 && forward > 0.35;
    setSprinting(isSprint);
    onJoystickChange(forward, strafe, isSprint);
  };

  const resetJoystick = () => {
    joyPointerId.current = null;
    setKnobOffset({ x: 0, y: 0 });
    setSprinting(false);
    onJoystickChange(0, 0, false);
  };

  return (
    <div
      className="fixed inset-0 z-10 pointer-events-none select-none"
      style={{ touchAction: 'none' }}
      data-testid="touch-controls"
    >
      {/* Free-screen Touch Look Zone */}
      <div
        data-testid="touch-look-zone"
        aria-label="Zona táctil de cámara"
        className="fixed inset-0 pointer-events-auto"
        style={{ touchAction: 'none' }}
        onPointerDown={(e) => {
          if (lookPointerId.current !== null) return;
          lookPointerId.current = e.pointerId;
          lastLookPos.current = { x: e.clientX, y: e.clientY };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (e.pointerId !== lookPointerId.current || !lastLookPos.current) return;
          const dx = e.clientX - lastLookPos.current.x;
          const dy = e.clientY - lastLookPos.current.y;
          lastLookPos.current = { x: e.clientX, y: e.clientY };
          onRotateCamera(dx * LOOK_SENSITIVITY, dy * LOOK_SENSITIVITY);
        }}
        onPointerUp={(e) => {
          if (e.pointerId !== lookPointerId.current) return;
          lookPointerId.current = null;
          lastLookPos.current = null;
        }}
        onPointerCancel={(e) => {
          if (e.pointerId !== lookPointerId.current) return;
          lookPointerId.current = null;
          lastLookPos.current = null;
        }}
      />

      {/* Bottom-Left Virtual Analog Joystick + Discrete Map Button */}
      <div className="fixed left-3.5 bottom-24 sm:left-6 sm:bottom-28 flex flex-col items-start gap-2.5 pointer-events-auto">
        <button
          type="button"
          tabIndex={-1}
          data-testid="touch-btn-map"
          aria-label="Abrir mapa del mundo"
          style={{ touchAction: 'none' }}
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onOpenMap();
          }}
          className="px-3 py-1.5 bg-[#281e15]/85 border-2 border-amber-300/65 text-amber-200 font-pixel text-[9px] flex items-center gap-1.5 cursor-pointer shadow-[0_3px_10px_rgba(0,0,0,0.45)]"
        >
          <span>MAPA (M)</span>
        </button>

        <div
          ref={joyRef}
          data-testid="touch-joystick"
          role="slider"
          aria-label="Joystick virtual de movimiento"
          aria-valuenow={Math.round(Math.hypot(knobOffset.x, knobOffset.y))}
          tabIndex={-1}
          style={{
            width: JOYSTICK_RADIUS * 2,
            height: JOYSTICK_RADIUS * 2,
            touchAction: 'none',
          }}
          className={`relative rounded-full flex items-center justify-center border-2 transition-colors ${
            sprinting
              ? 'bg-emerald-950/45 border-amber-300 shadow-[0_0_0_3px_rgba(251,191,36,0.35)]'
              : 'bg-black/38 border-white/35'
          }`}
          onPointerDown={(e) => {
            e.stopPropagation();
            if (joyPointerId.current !== null) return;
            joyPointerId.current = e.pointerId;
            e.currentTarget.setPointerCapture(e.pointerId);
            updateJoystickFromClient(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => {
            e.stopPropagation();
            if (e.pointerId !== joyPointerId.current) return;
            updateJoystickFromClient(e.clientX, e.clientY);
          }}
          onPointerUp={(e) => {
            e.stopPropagation();
            if (e.pointerId !== joyPointerId.current) return;
            resetJoystick();
          }}
          onPointerCancel={(e) => {
            e.stopPropagation();
            if (e.pointerId !== joyPointerId.current) return;
            resetJoystick();
          }}
        >
          <span className="absolute top-2 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-white/45 rounded-full pointer-events-none" />
          <span className="absolute bottom-2 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-white/35 rounded-full pointer-events-none" />
          <span className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-white/35 rounded-full pointer-events-none" />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-white/35 rounded-full pointer-events-none" />

          <div
            className={`w-11 h-11 rounded-full border-2 pointer-events-none shadow-[0_4px_10px_rgba(0,0,0,0.55)] ${
              sprinting
                ? 'bg-amber-300/80 border-white'
                : 'bg-white/60 border-white/90'
            }`}
            style={{
              transform: `translate(${knobOffset.x}px, ${knobOffset.y}px)`,
            }}
          />
        </div>
        {sprinting && (
          <div
            className="w-full text-center font-pixel text-[9px] text-amber-300 tracking-wide pointer-events-none"
            style={{ textShadow: '1px 1px 0 #000' }}
          >
            SPRINT
          </div>
        )}
      </div>

      {/* Bottom-Right Ergonomic Action Button Cluster (with Creative Flight Controls when Creative) */}
      <div className="fixed right-3 bottom-24 sm:right-6 sm:bottom-28 flex flex-col items-end gap-2 pointer-events-auto">
        {/* Creative Mode Flight Row */}
        {isCreative && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              tabIndex={-1}
              data-testid="touch-btn-fly-toggle"
              aria-label={isFlying ? 'Desactivar vuelo' : 'Activar vuelo'}
              aria-pressed={isFlying}
              style={{ touchAction: 'none' }}
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onToggleFlight();
              }}
              className={`px-3 py-2 rounded-full border-2 font-pixel text-[8px] cursor-pointer shadow-[0_4px_10px_rgba(0,0,0,0.45)] ${
                isFlying
                  ? 'bg-sky-600/85 border-sky-200 text-white'
                  : 'bg-black/52 border-sky-300/50 text-sky-100'
              }`}
            >
              {isFlying ? 'VOLANDO' : 'VOLAR'}
            </button>

            {isFlying && (
              <button
                type="button"
                tabIndex={-1}
                data-testid="touch-btn-fly-down"
                aria-label="Descender en vuelo"
                style={{ touchAction: 'none' }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  setDownPressed(true);
                  onFlyDownChange(true);
                }}
                onPointerUp={(e) => {
                  e.stopPropagation();
                  setDownPressed(false);
                  onFlyDownChange(false);
                }}
                onPointerCancel={(e) => {
                  e.stopPropagation();
                  setDownPressed(false);
                  onFlyDownChange(false);
                }}
                className={`w-[50px] h-[50px] rounded-full border-2 flex flex-col items-center justify-center gap-0.5 cursor-pointer shadow-[0_4px_12px_rgba(0,0,0,0.45)] ${
                  downPressed
                    ? 'bg-sky-500/80 border-white text-white scale-95'
                    : 'bg-black/52 border-sky-300/60 text-sky-100'
                }`}
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                  <path d="M12 5v14M5 12l7 7 7-7" />
                </svg>
                <span className="font-pixel text-[7px] leading-none">BAJAR</span>
              </button>
            )}
          </div>
        )}

        {/* Middle Row: Crouch + Jump / Ascend */}
        <div className="flex items-center gap-2.5">
          {!isFlying && (
            <button
              type="button"
              tabIndex={-1}
              data-testid="touch-btn-crouch"
              aria-label={crouching ? 'Desactivar agachado seguro' : 'Agacharse (Borde seguro)'}
              aria-pressed={crouching}
              style={{ touchAction: 'none' }}
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onToggleCrouch();
              }}
              className={`w-[52px] h-[52px] rounded-full border-2 flex flex-col items-center justify-center gap-0.5 cursor-pointer shadow-[0_4px_12px_rgba(0,0,0,0.45)] ${
                crouching
                  ? 'bg-amber-500/80 border-amber-200 text-white'
                  : 'bg-black/48 border-white/40 text-stone-100'
              }`}
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.3" aria-hidden="true">
                <circle cx="12" cy="6" r="2.2" />
                <path d="M9 11l3 2 3-2M12 13v4l-3 3M12 17l3 3" />
              </svg>
              <span className="font-pixel text-[7px] leading-none">AGACH</span>
            </button>
          )}

          <button
            type="button"
            tabIndex={-1}
            data-testid="touch-btn-jump"
            aria-label={isFlying ? 'Subir en vuelo' : 'Saltar o nadar hacia arriba'}
            style={{ touchAction: 'none' }}
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
              setJumpPressed(true);
              onJumpChange(true);
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              setJumpPressed(false);
              onJumpChange(false);
            }}
            onPointerCancel={(e) => {
              e.stopPropagation();
              setJumpPressed(false);
              onJumpChange(false);
            }}
            className={`w-[56px] h-[56px] rounded-full border-2 flex flex-col items-center justify-center gap-0.5 cursor-pointer shadow-[0_4px_12px_rgba(0,0,0,0.45)] ${
              jumpPressed
                ? 'bg-sky-500/75 border-white text-white scale-95'
                : 'bg-black/48 border-white/40 text-stone-100'
            }`}
          >
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
            <span className="font-pixel text-[7px] leading-none">
              {isFlying ? 'SUBIR' : 'SALTAR'}
            </span>
          </button>
        </div>

        {/* Bottom Primary Row: PICAR / ATACAR + USAR / COLOCAR */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            tabIndex={-1}
            data-testid="touch-btn-mine"
            aria-label="Picar bloque o atacar"
            style={{ touchAction: 'none' }}
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
              setMinePressed(true);
              onMineChange(true);
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              setMinePressed(false);
              onMineChange(false);
            }}
            onPointerCancel={(e) => {
              e.stopPropagation();
              setMinePressed(false);
              onMineChange(false);
            }}
            className={`w-[64px] h-[64px] rounded-full border-2 flex flex-col items-center justify-center gap-1 cursor-pointer shadow-[0_5px_16px_rgba(0,0,0,0.55)] ${
              minePressed
                ? 'bg-rose-600/80 border-white text-white scale-95'
                : 'bg-[#2b1f1f]/70 border-rose-300/65 text-rose-100'
            }`}
          >
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
              <path d="M14.5 5.5l4 4M4 20l10.5-10.5M9 5c3.5-1 7.5 1 10 4.5" />
            </svg>
            <span className="font-pixel text-[8px] leading-none">PICAR</span>
          </button>

          <button
            type="button"
            tabIndex={-1}
            data-testid="touch-btn-use"
            aria-label="Usar, colocar bloque o comer"
            style={{ touchAction: 'none' }}
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
              setUsePressed(true);
              onUseChange(true);
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              setUsePressed(false);
              onUseChange(false);
            }}
            onPointerCancel={(e) => {
              e.stopPropagation();
              setUsePressed(false);
              onUseChange(false);
            }}
            className={`w-[64px] h-[64px] rounded-full border-2 flex flex-col items-center justify-center gap-1 cursor-pointer shadow-[0_5px_16px_rgba(0,0,0,0.55)] ${
              usePressed
                ? 'bg-emerald-600/80 border-white text-white scale-95'
                : 'bg-[#1a2b20]/70 border-emerald-300/65 text-emerald-100'
            }`}
          >
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
              <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
              <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" />
            </svg>
            <span className="font-pixel text-[8px] leading-none">USAR</span>
          </button>
        </div>
      </div>
    </div>
  );
};
