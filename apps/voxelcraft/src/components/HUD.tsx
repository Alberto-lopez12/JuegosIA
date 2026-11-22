import React, { useEffect, useRef } from 'react';
import { getItemDef } from '../game/blocks';
import type { HUDState, SlotOrNull } from '../game/types';

interface HUDProps {
  hud: HUDState;
  icons: Record<string, string>;
  onSelectSlot: (idx: number) => void;
  onToggleMute: () => void;
  onOpenWorldMap: () => void;
  onToggleThirdPerson: () => void;
  onAdvanceTime: () => void;
  onSaveWorld: () => void;
  onOpenInventory: () => void;
  onPause: () => void;
  onRequestLock: () => void;
  onDrawMinimap: (ctx: CanvasRenderingContext2D, size: number) => void;
}

function formatWorldClock(worldTime: number): { clock: string; label: string } {
  const totalHours = ((worldTime / 1000) + 6) % 24;
  const hh = Math.floor(totalHours);
  const mm = Math.floor((totalHours - hh) * 60);
  const clock = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  let label = 'Día';
  if (worldTime < 1500 || worldTime >= 22500) label = 'Amanecer';
  else if (worldTime < 11000) label = 'Mediodía';
  else if (worldTime < 13800) label = 'Atardecer';
  else label = 'Noche';
  return { clock, label };
}

function PixelHeart({ state }: { state: 'full' | 'half' | 'empty' }) {
  return (
    <svg viewBox="0 0 9 9" className="w-3.5 h-3.5 sm:w-5 sm:h-5 pixelated drop-shadow-[0_1px_0_rgba(0,0,0,0.85)]" aria-hidden="true">
      <path d="M1 1h2v1h1v1h1V2h1V1h2v1h1v3H8v1H7v1H6v1H5v1H4V8H3V7H2V6H1V5H0V2h1V1z" fill="#191919" />
      <path d="M1 2h2v1h1v1h1V3h1V2h2v3H7v1H6v1H5v1H4V7H3V6H2V5H1V2z" fill="#3a191c" />
      {state === 'full' && (
        <>
          <path d="M1 2h2v1h1v1h1V3h1V2h2v3H7v1H6v1H5v1H4V7H3V6H2V5H1V2z" fill="#d92626" />
          <rect x="2" y="2" width="1" height="1" fill="#ff8f8f" />
          <rect x="6" y="2" width="1" height="1" fill="#ff6b6b" />
        </>
      )}
      {state === 'half' && (
        <>
          <path d="M1 2h2v1h1v4H3V6H2V5H1V2z" fill="#d92626" />
          <rect x="2" y="2" width="1" height="1" fill="#ff8f8f" />
        </>
      )}
    </svg>
  );
}

function PixelArmorShield({ state }: { state: 'full' | 'half' | 'empty' }) {
  return (
    <svg viewBox="0 0 9 9" className="w-3.5 h-3.5 sm:w-5 sm:h-5 pixelated drop-shadow-[0_1px_0_rgba(0,0,0,0.85)]" aria-hidden="true">
      <path d="M1 0h7v5H7v2H6v1H5v1H4V8H3V7H2V5H1V0z" fill="#17191c" />
      <path d="M2 1h5v4H6v1H5v1H4V6H3V5H2V1z" fill="#3a404a" />
      {state === 'full' && (
        <>
          <path d="M2 1h5v4H6v1H5v1H4V6H3V5H2V1z" fill="#c7d0db" />
          <rect x="2" y="1" width="2" height="3" fill="#eef4fa" />
          <rect x="5" y="1" width="2" height="4" fill="#9aa5b4" />
        </>
      )}
      {state === 'half' && (
        <>
          <path d="M2 1h3v6H4V6H3V5H2V1z" fill="#c7d0db" />
          <rect x="2" y="1" width="2" height="3" fill="#eef4fa" />
        </>
      )}
    </svg>
  );
}

function PixelHunger({ state }: { state: 'full' | 'half' | 'empty' }) {
  return (
    <svg viewBox="0 0 9 9" className="w-3.5 h-3.5 sm:w-5 sm:h-5 pixelated drop-shadow-[0_1px_0_rgba(0,0,0,0.85)]" aria-hidden="true">
      <path d="M4 1h3v1h1v3H7v1H5v1H4v1H2V7H1V6h1V5h1V4h1V1z" fill="#191919" />
      <path d="M4 2h3v3H6v1H4V5H3v1H2V5h1V4h1V2z" fill="#3d281a" />
      {state === 'full' && (
        <>
          <path d="M4 2h3v3H6v1H4V2z" fill="#c77b38" />
          <rect x="5" y="2" width="1" height="1" fill="#f0b675" />
          <rect x="2" y="6" width="1" height="1" fill="#e8dcc8" />
        </>
      )}
      {state === 'half' && (
        <>
          <path d="M4 2h2v3H4V2z" fill="#c77b38" />
          <rect x="2" y="6" width="1" height="1" fill="#e8dcc8" />
        </>
      )}
    </svg>
  );
}

function PixelBubble({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 9 9" className="w-3.5 h-3.5 sm:w-5 sm:h-5 pixelated drop-shadow-[0_1px_0_rgba(0,0,0,0.85)]" aria-hidden="true">
      {filled ? (
        <>
          <path d="M2 1h5v1h1v5H7v1H2V7H1V2h1V1z" fill="#0d4f8b" />
          <path d="M2 2h5v5H2V2z" fill="#38bdf8" />
          <rect x="3" y="2" width="2" height="1" fill="#e0f2fe" />
          <rect x="2" y="3" width="1" height="2" fill="#bae6fd" />
        </>
      ) : (
        <>
          <rect x="2" y="2" width="1" height="1" fill="#7dd3fc" opacity="0.45" />
          <rect x="6" y="2" width="1" height="1" fill="#7dd3fc" opacity="0.45" />
          <rect x="2" y="6" width="1" height="1" fill="#7dd3fc" opacity="0.45" />
          <rect x="6" y="6" width="1" height="1" fill="#7dd3fc" opacity="0.45" />
        </>
      )}
    </svg>
  );
}

function DurabilityBar({ slot }: { slot: SlotOrNull }) {
  if (!slot || slot.durability === undefined) return null;
  const def = getItemDef(slot.id);
  if (!def?.maxDurability || slot.durability >= def.maxDurability) return null;
  const pct = Math.max(0, Math.min(100, (slot.durability / def.maxDurability) * 100));
  const color = pct > 55 ? '#4ade80' : pct > 25 ? '#facc15' : '#ef4444';
  return (
    <div className="absolute left-1 right-1 bottom-1 h-1 bg-black/80 pointer-events-none">
      <div className="h-full" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}

export const HUD: React.FC<HUDProps> = ({
  hud,
  icons,
  onSelectSlot,
  onToggleMute,
  onOpenWorldMap,
  onToggleThirdPerson,
  onAdvanceTime,
  onSaveWorld,
  onOpenInventory,
  onPause,
  onRequestLock,
  onDrawMinimap,
}) => {
  const minimapCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawMinimapRef = useRef(onDrawMinimap);
  drawMinimapRef.current = onDrawMinimap;

  // Refresh permanent 136x136 minimap at 4 Hz without React re-renders
  useEffect(() => {
    if (hud.phase !== 'playing' || !hud.showMinimap) return;
    const renderMap = () => {
      const canvas = minimapCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      drawMinimapRef.current(ctx, 136);
    };
    renderMap();
    const id = window.setInterval(renderMap, 250);
    return () => window.clearInterval(id);
  }, [hud.phase, hud.showMinimap]);

  if (hud.phase !== 'playing') return null;

  const isCreative = hud.gameMode === 'creative';
  const heldSlot = hud.inventory[hud.selectedSlot];
  const heldDef = heldSlot ? getItemDef(heldSlot.id) : null;
  const { clock, label } = formatWorldClock(hud.worldTime);
  const lowHealth = !isCreative && hud.health <= 6;
  const showOxygen = !isCreative && (hud.underwater || hud.oxygen < hud.maxOxygen);

  return (
    <div className="fixed inset-0 z-20 pointer-events-none select-none">
      {/* Underwater blue tint */}
      {hud.underwater && !hud.inLava && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{ backgroundColor: 'rgba(15, 65, 160, 0.38)' }}
        />
      )}

      {/* Molten Lava orange screen tint */}
      {hud.inLava && (
        <div
          data-testid="lava-tint-overlay"
          className="fixed inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(circle, rgba(234, 88, 12, 0.56) 20%, rgba(154, 34, 8, 0.82) 100%)',
          }}
        />
      )}

      {/* Burning peripheral fiery glow (Survival only) */}
      {!isCreative && hud.onFireTimer > 0 && (
        <div
          data-testid="burning-overlay"
          className="fixed inset-0 pointer-events-none"
          style={{
            boxShadow:
              'inset 0 -90px 100px -15px rgba(249, 115, 22, 0.72), inset 0 0 60px 14px rgba(220, 38, 38, 0.5)',
          }}
        />
      )}

      {/* Nether Portal swirling purple transition overlay */}
      {hud.portalProgress > 0.01 && (
        <div
          data-testid="portal-swirl-overlay"
          className="fixed inset-0 z-30 pointer-events-none flex items-center justify-center"
          style={{
            opacity: Math.min(0.95, 0.25 + hud.portalProgress * 0.75),
            background:
              'repeating-radial-gradient(circle at center, rgba(168, 85, 247, 0.55) 0px, rgba(88, 28, 135, 0.72) 28px, rgba(216, 180, 254, 0.35) 56px)',
          }}
        >
          <div className="px-4 py-2 bg-[#1c072b]/85 border-2 border-purple-400/80 font-pixel text-xs sm:text-sm text-purple-100 tracking-wider">
            {hud.dimension === 'overworld'
              ? 'Entrando en El Nether...'
              : 'Regresando al Overworld...'}
          </div>
        </div>
      )}

      {/* Damage / Low-HP peripheral vignette (Survival only) */}
      {!isCreative && (hud.hurtFlash > 0 || lowHealth) && (
        <div
          className="fixed inset-0 pointer-events-none transition-opacity duration-150"
          style={{
            boxShadow:
              hud.hurtFlash > 0
                ? 'inset 0 0 110px 36px rgba(220, 38, 38, 0.65)'
                : 'inset 0 0 80px 18px rgba(185, 28, 28, 0.35)',
          }}
        />
      )}

      {/* Bed sleep fade-to-black curtain */}
      {hud.sleepingAlpha > 0.01 && (
        <div
          className="fixed inset-0 z-40 pointer-events-none bg-black flex items-center justify-center"
          style={{ opacity: hud.sleepingAlpha }}
        >
          <span className="font-pixel text-sm sm:text-base text-amber-200 tracking-wider">
            Durmiendo hasta el amanecer...
          </span>
        </div>
      )}

      {/* Top-Center Minimalist Toast Notifications */}
      {hud.toasts.length > 0 && (
        <div
          className="fixed top-12 sm:top-14 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-1.5 pointer-events-none max-w-[90vw]"
          aria-live="polite"
        >
          {hud.toasts.map((t) => (
            <div
              key={t.id}
              className={`px-3 py-1.5 border text-xs font-mono-hud shadow-[0_4px_14px_rgba(0,0,0,0.65)] ${
                t.tone === 'success'
                  ? 'bg-[#122619]/92 border-emerald-400/70 text-emerald-100'
                  : t.tone === 'warn'
                  ? 'bg-[#2e1e10]/92 border-amber-400/70 text-amber-100'
                  : 'bg-[#141921]/92 border-sky-300/60 text-white'
              }`}
            >
              {t.text}
            </div>
          ))}
        </div>
      )}

      {/* Centered Crosshair (+) + Eating Progress + Contextual Villager/Bed Prompt */}
      {hud.modal === 'none' && (
        <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex flex-col items-center">
          <div style={{ mixBlendMode: 'difference' }} aria-hidden="true">
            <div className="relative w-6 h-6">
              <div className="absolute left-1/2 top-0.5 bottom-0.5 w-[2px] -translate-x-1/2 bg-white" />
              <div className="absolute top-1/2 left-0.5 right-0.5 h-[2px] -translate-y-1/2 bg-white" />
            </div>
          </div>
          {hud.eatingProgress > 0 && (
            <div className="mt-2 w-12 h-1.5 bg-black/75 border border-white/40 overflow-hidden">
              <div
                className="h-full bg-amber-400"
                style={{ width: `${Math.round(hud.eatingProgress * 100)}%` }}
              />
            </div>
          )}
          {hud.targetEntityHint && (
            <div
              className="mt-3 px-2.5 py-1 bg-black/72 border border-white/30 text-[11px] font-mono-hud text-amber-200 whitespace-nowrap"
              data-testid="target-entity-hint"
            >
              {hud.targetEntityHint}
            </div>
          )}
        </div>
      )}

      {/* Top-Left Touch Pause (II) button when touch controls are active */}
      {hud.touchControlsActive && (
        <button
          type="button"
          tabIndex={-1}
          data-testid="touch-btn-pause"
          aria-label="Pausar juego (II)"
          onClick={(e) => {
            e.stopPropagation();
            e.currentTarget.blur();
            onPause();
          }}
          className="fixed top-3 left-3 z-20 w-11 h-11 flex items-center justify-center bg-black/60 hover:bg-black/80 border-2 border-white/35 text-white cursor-pointer pointer-events-auto"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden="true">
            <rect x="6" y="5" width="4" height="14" />
            <rect x="14" y="5" width="4" height="14" />
          </svg>
        </button>
      )}

      {/* Top-Left World Readout */}
      {!hud.showDebug && (
        <div
          className={`fixed top-3.5 ${
            hud.touchControlsActive
              ? 'left-16 max-w-[calc(100vw-204px)] sm:max-w-none'
              : 'left-4 max-w-[calc(100vw-160px)] sm:max-w-none'
          } flex flex-col gap-0.5 text-white`}
          style={{ textShadow: '0 2px 3px rgba(0,0,0,0.9), 1px 1px 0 rgba(0,0,0,0.85)' }}
        >
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 sm:gap-2 text-[11px] sm:text-xs font-mono-hud tracking-tight leading-tight">
            {hud.dimension === 'nether' ? (
              <>
                <span
                  data-testid="hud-dimension-badge"
                  className="font-pixel text-[10px] sm:text-[11px] text-rose-400"
                >
                  The Nether
                </span>
                <span className="opacity-60">·</span>
                <span className="text-orange-200">{hud.biome}</span>
              </>
            ) : (
              <>
                <span className="font-pixel text-[10px] sm:text-[11px] text-amber-200">Día {hud.dayCount}</span>
                <span className="opacity-60">·</span>
                <span>{clock}</span>
                <span className="hidden sm:inline opacity-60">·</span>
                <span className="hidden sm:inline">{label}</span>
                <span className="opacity-60">·</span>
                <span>{hud.biome}</span>
                {hud.weather === 'storm' && (
                  <>
                    <span className="opacity-60">·</span>
                    <span className="text-sky-300">Tormenta</span>
                  </>
                )}
              </>
            )}
          </div>
          <div className="text-[10px] sm:text-[11px] font-mono-hud text-stone-200/90 flex items-center gap-1.5">
            {isCreative && (
              <span className="text-sky-300 font-bold">
                Creativo{hud.isFlying ? ' (Vuelo)' : ''}
              </span>
            )}
            {hud.targetBlockName && (
              <>
                {isCreative && <span className="opacity-60">·</span>}
                <span className="text-emerald-200">{hud.targetBlockName}</span>
              </>
            )}
            {hud.thirdPerson && (
              <>
                <span className="opacity-60">·</span>
                <span className="text-sky-200">3ª Persona</span>
              </>
            )}
          </div>
          {hud.saveStatus && (
            <div className="text-xs font-medium text-emerald-300 mt-0.5" role="status">
              {hud.saveStatus}
            </div>
          )}
        </div>
      )}

      {/* F3 Technical Debug Overlay */}
      {hud.showDebug && (
        <>
          <div
            data-testid="f3-debug-left"
            className={`fixed ${
              hud.touchControlsActive ? 'top-16 left-3' : 'top-4 left-4'
            } bg-black/68 border border-white/15 px-3 py-2 font-mono-hud text-[11px] leading-relaxed text-stone-100`}
          >
            <div className="text-amber-300 font-bold">VoxelCraft v2.0 (WebGL2)</div>
            <div>FPS: <span className="text-emerald-300">{hud.debugInfo.fps}</span> · Draw Calls: {hud.debugInfo.drawCalls}</div>
            <div>Chunks: {hud.debugInfo.chunksLoaded} cargados · {hud.debugInfo.chunksQueued} en cola (RD: {hud.renderDistance})</div>
            <div>Entidades: {hud.debugInfo.entityCount} (Mobs: {hud.debugInfo.mobCount}) · Clima: {hud.dimension === 'nether' ? 'ceniza' : hud.weather}</div>
            <div>
              Dimensión:{' '}
              <span className={hud.dimension === 'nether' ? 'text-rose-400 font-bold' : 'text-emerald-300'}>
                {hud.dimension === 'nether' ? 'The Nether' : 'Overworld'}
              </span>{' '}
              · Semilla: {hud.seedLabel}
            </div>
            <div>
              Modo: {hud.gameMode} ({hud.difficulty})
            </div>
          </div>

          <div
            data-testid="f3-debug-right"
            className="fixed bottom-4 left-4 bg-black/68 border border-white/15 px-3 py-2 font-mono-hud text-[11px] leading-relaxed text-stone-100"
          >
            <div>
              XYZ: {hud.debugInfo.exactPos[0].toFixed(2)} / {hud.debugInfo.exactPos[1].toFixed(2)} / {hud.debugInfo.exactPos[2].toFixed(2)}
            </div>
            <div>Chunk: {hud.debugInfo.chunkCoords[0]}, {hud.debugInfo.chunkCoords[1]} · {hud.debugInfo.cardinal} ({hud.debugInfo.yawDeg}°)</div>
            <div>Bioma: <span className={hud.dimension === 'nether' ? 'text-orange-300' : 'text-sky-300'}>{hud.biome}</span> · Luz: Sky {hud.debugInfo.skyLight} / Block {hud.debugInfo.blockLight}</div>
          </div>
        </>
      )}

      {/* Top-Right Utility Controls + Permanent Framed Minimap (136x136 desktop / 96x96 mobile) */}
      <div className="fixed top-3 right-3 sm:top-4 sm:right-4 flex flex-col items-end gap-2">
        <div className="flex items-center gap-1 sm:gap-1.5 pointer-events-auto">
          <button
            type="button"
            tabIndex={-1}
            aria-label="Cambiar cámara (F5)"
            title="Cámara 1ª / 3ª persona (F5)"
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleThirdPerson();
            }}
            className={`w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center bg-black/55 hover:bg-black/75 border cursor-pointer ${
              hud.thirdPerson ? 'border-sky-300 text-sky-300' : 'border-white/25 text-stone-100'
            }`}
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </button>

          <button
            type="button"
            tabIndex={-1}
            aria-label="Abrir mapa del mundo (M)"
            title="Mapa del Mundo (M)"
            onClick={(e) => {
              e.currentTarget.blur();
              onOpenWorldMap();
            }}
            className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center bg-black/55 hover:bg-black/75 border border-amber-300/75 text-amber-200 cursor-pointer"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2">
              <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
              <line x1="8" y1="2" x2="8" y2="18" />
              <line x1="16" y1="6" x2="16" y2="22" />
            </svg>
          </button>

          <button
            type="button"
            tabIndex={-1}
            aria-label="Adelantar tiempo (T)"
            title="Adelantar ciclo día/noche (T)"
            onClick={(e) => {
              e.currentTarget.blur();
              onAdvanceTime();
            }}
            className="hidden sm:flex w-9 h-9 items-center justify-center bg-black/55 hover:bg-black/75 border border-white/25 text-amber-200 cursor-pointer"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1" />
            </svg>
          </button>

          {!hud.touchControlsActive && (
            <button
              type="button"
              tabIndex={-1}
              aria-label={isCreative ? 'Abrir catálogo creativo (E)' : 'Abrir inventario (E)'}
              title={isCreative ? 'Catálogo Creativo (E)' : 'Inventario (E)'}
              onClick={(e) => {
                e.currentTarget.blur();
                onOpenInventory();
              }}
              className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center bg-black/55 hover:bg-black/75 border border-white/25 text-stone-100 cursor-pointer"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
              </svg>
            </button>
          )}

          <button
            type="button"
            tabIndex={-1}
            aria-label="Guardar mundo (K)"
            title="Guardar mundo (K)"
            onClick={(e) => {
              e.currentTarget.blur();
              onSaveWorld();
            }}
            className="hidden sm:flex w-9 h-9 items-center justify-center bg-black/55 hover:bg-black/75 border border-white/25 text-emerald-300 cursor-pointer"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
          </button>

          <button
            type="button"
            tabIndex={-1}
            aria-label={hud.muted ? 'Activar sonido (N)' : 'Silenciar sonido (N)'}
            title={hud.muted ? 'Activar sonido (N)' : 'Silenciar (N)'}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleMute();
            }}
            className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center bg-black/55 hover:bg-black/75 border border-white/25 text-stone-100 cursor-pointer"
          >
            {hud.muted ? (
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-rose-400" fill="none" stroke="currentColor" strokeWidth="2.2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M15.5 8.5a5 5 0 0 1 0 7" />
                <path d="M18.5 5.5a9 9 0 0 1 0 13" />
              </svg>
            )}
          </button>

          {!hud.touchControlsActive && (
            <button
              type="button"
              tabIndex={-1}
              aria-label="Pausar juego (P)"
              title="Pausa (Esc / P)"
              onClick={(e) => {
                e.currentTarget.blur();
                onPause();
              }}
              className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center bg-black/55 hover:bg-black/75 border border-white/25 text-stone-100 cursor-pointer"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                <rect x="6" y="5" width="4" height="14" />
                <rect x="14" y="5" width="4" height="14" />
              </svg>
            </button>
          )}
        </div>

        {/* Permanent Stone/Wood Framed Minimap (136x136 desktop / 96x96 mobile) with N/S/E/O & XYZ below */}
        {hud.showMinimap && (
          <div
            data-testid="minimap-container"
            className="flex flex-col items-center pointer-events-auto"
          >
            <button
              type="button"
              tabIndex={-1}
              aria-label="Abrir mapa completo (M)"
              title="Clic para abrir el Mapa Completo (M)"
              onClick={(e) => {
                e.stopPropagation();
                e.currentTarget.blur();
                onOpenWorldMap();
              }}
              className={`p-1.5 border-2 shadow-[0_6px_18px_rgba(0,0,0,0.68)] cursor-pointer ${
                hud.dimension === 'nether'
                  ? 'bg-[#2a1014] border-t-[#9b3232] border-l-[#9b3232] border-b-[#160608] border-r-[#160608]'
                  : 'bg-[#36281c] border-t-[#8c6b4a] border-l-[#8c6b4a] border-b-[#1a120b] border-r-[#1a120b]'
              }`}
            >
              <div className="relative w-[96px] h-[96px] sm:w-[136px] sm:h-[136px] border border-black/80">
                <canvas
                  ref={minimapCanvasRef}
                  width={136}
                  height={136}
                  className="block w-full h-full pixelated"
                />
                <span
                  className="absolute top-0.5 left-1/2 -translate-x-1/2 text-[9px] font-pixel text-amber-200 leading-none pointer-events-none"
                  style={{ textShadow: '1px 1px 0 #000, -1px -1px 0 #000' }}
                >
                  N
                </span>
                <span
                  className="absolute bottom-0.5 left-1/2 -translate-x-1/2 text-[8px] font-pixel text-white/90 leading-none pointer-events-none"
                  style={{ textShadow: '1px 1px 0 #000' }}
                >
                  S
                </span>
                <span
                  className="absolute left-0.5 top-1/2 -translate-y-1/2 text-[8px] font-pixel text-white/90 leading-none pointer-events-none"
                  style={{ textShadow: '1px 1px 0 #000' }}
                >
                  O
                </span>
                <span
                  className="absolute right-0.5 top-1/2 -translate-y-1/2 text-[8px] font-pixel text-white/90 leading-none pointer-events-none"
                  style={{ textShadow: '1px 1px 0 #000' }}
                >
                  E
                </span>
              </div>
            </button>
            <div
              className="mt-1 px-2 py-0.5 bg-black/68 border border-[#685038] text-[10px] font-mono-hud text-stone-100 tabular-nums"
              data-testid="minimap-coords"
            >
              X {hud.coords[0]} · Y {hud.coords[1]} · Z {hud.coords[2]}
            </div>
          </div>
        )}
      </div>

      {/* Subtle Pointer-Lock Prompt (desktop only) */}
      {hud.modal === 'none' && !hud.pointerLocked && !hud.showDebug && !hud.touchControlsActive && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 pointer-events-auto hidden md:block">
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onRequestLock();
            }}
            className="px-3 py-1 text-[11px] font-medium text-white/95 bg-black/50 hover:bg-black/75 border border-white/20 cursor-pointer whitespace-nowrap"
          >
            {isCreative
              ? 'Clic cámara · 2×Espacio Volar · E Catálogo · M Mapa'
              : 'Clic cámara · F3 Debug · F5 3ª Persona · M Mapa'}
          </button>
        </div>
      )}

      {/* Bottom Cluster: Survival Bars (hidden in Creative) + Held Item Name + 9-Slot Hotbar */}
      <div className="fixed bottom-2.5 sm:bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-0.5 sm:gap-1 max-w-[98vw]">
        {isCreative && hud.isFlying && (
          <div
            className="px-2.5 py-0.5 bg-sky-900/80 border border-sky-300/70 font-pixel text-[9px] text-sky-100 tracking-wider mb-0.5"
            data-testid="creative-flight-badge"
          >
            VUELO ACTIVO · ESPACIO SUBIR / SHIFT-C BAJAR
          </div>
        )}

        {/* Held Item Name */}
        <div
          className="h-4 sm:h-5 text-[11px] sm:text-xs font-medium text-white tracking-wide"
          style={{ textShadow: '0 2px 3px rgba(0,0,0,0.95)' }}
          data-testid="held-item-name"
        >
          {heldDef ? heldDef.name : ''}
        </div>

        {/* Survival-only Status Bars (completely hidden in Creative Mode) */}
        {!isCreative && (
          <>
            {(hud.armorPoints > 0 || showOxygen) && (
              <div className="w-[348px] sm:w-[454px] max-w-[96vw] flex items-center justify-between px-0.5 h-4 sm:h-5">
                <div
                  className="flex items-center gap-0.5"
                  data-testid="armor-bar"
                  aria-label={`Armadura ${hud.armorPoints} de 20`}
                >
                  {hud.armorPoints > 0 &&
                    Array.from({ length: 10 }, (_, i) => {
                      const unit = hud.armorPoints - i * 2;
                      const state = unit >= 2 ? 'full' : unit === 1 ? 'half' : 'empty';
                      return <PixelArmorShield key={i} state={state} />;
                    })}
                </div>

                <div
                  className="flex items-center gap-0.5"
                  data-testid="oxygen-bar"
                  aria-label={`Oxígeno ${hud.oxygen} de ${hud.maxOxygen}`}
                >
                  {showOxygen &&
                    Array.from({ length: 10 }, (_, i) => {
                      const idx = 9 - i;
                      return <PixelBubble key={i} filled={idx < hud.oxygen} />;
                    })}
                </div>
              </div>
            )}

            <div
              className="w-[348px] sm:w-[454px] max-w-[96vw] flex items-center justify-between px-0.5 mb-0.5"
              data-testid="survival-vitals"
            >
              <div className="flex items-center gap-0.5" aria-label={`Salud ${hud.health} de ${hud.maxHealth}`}>
                {Array.from({ length: 10 }, (_, i) => {
                  const hpUnit = hud.health - i * 2;
                  const state = hpUnit >= 2 ? 'full' : hpUnit === 1 ? 'half' : 'empty';
                  return <PixelHeart key={i} state={state} />;
                })}
              </div>
              <div className="flex items-center gap-0.5" aria-label={`Hambre ${hud.hunger} de ${hud.maxHunger}`}>
                {Array.from({ length: 10 }, (_, i) => {
                  const idx = 9 - i;
                  const hUnit = hud.hunger - idx * 2;
                  const state = hUnit >= 2 ? 'full' : hUnit === 1 ? 'half' : 'empty';
                  return <PixelHunger key={i} state={state} />;
                })}
              </div>
            </div>
          </>
        )}

        {/* 9-Slot Hotbar + Touch Inventory Button */}
        <div
          className="flex items-center p-1 bg-[#1e1e1e]/85 border-2 border-[#3c3c3c] shadow-[0_6px_20px_rgba(0,0,0,0.65)] pointer-events-auto"
          role="toolbar"
          aria-label="Barra rápida de inventario"
          data-testid="hotbar"
        >
          {Array.from({ length: 9 }, (_, i) => {
            const slot = hud.inventory[i];
            const def = slot ? getItemDef(slot.id) : null;
            const selected = hud.selectedSlot === i;
            const iconUrl = slot ? icons[String(slot.id)] : undefined;

            return (
              <button
                key={i}
                type="button"
                tabIndex={-1}
                aria-label={`Slot ${i + 1}${def ? `: ${def.name} (${slot?.count})` : ': vacío'}`}
                onClick={(e) => {
                  e.stopPropagation();
                  e.currentTarget.blur();
                  onSelectSlot(i);
                }}
                className={`relative w-[34px] h-[34px] sm:w-12 sm:h-12 flex items-center justify-center cursor-pointer ${
                  selected
                    ? 'bg-[#6b6b6b] border-[2px] sm:border-[3px] border-white z-10 scale-[1.04]'
                    : 'bg-[#464646]/90 border border-[#2a2a2a] sm:border-2 hover:bg-[#595959]'
                }`}
              >
                <span className="hidden sm:block absolute top-0.5 left-1 text-[9px] font-mono-hud text-stone-300/80 pointer-events-none">
                  {i + 1}
                </span>
                {iconUrl && (
                  <img
                    src={iconUrl}
                    alt={def?.name ?? ''}
                    className="w-6 h-6 sm:w-8 sm:h-8 pixelated pointer-events-none"
                    draggable={false}
                  />
                )}
                {slot && slot.count > 1 && (
                  <span
                    className="absolute bottom-0 right-0.5 sm:bottom-0.5 sm:right-1 text-[9px] sm:text-[11px] font-pixel text-white pointer-events-none leading-none"
                    style={{ textShadow: '1px 1px 0 #000, -1px -1px 0 #000' }}
                  >
                    {slot.count}
                  </span>
                )}
                <DurabilityBar slot={slot} />
              </button>
            );
          })}

          {hud.touchControlsActive && (
            <button
              type="button"
              tabIndex={-1}
              data-testid="hotbar-inventory-btn"
              aria-label={isCreative ? 'Abrir catálogo creativo (E)' : 'Abrir inventario (E)'}
              title={isCreative ? 'Catálogo Creativo (E)' : 'Inventario (E)'}
              onClick={(e) => {
                e.stopPropagation();
                e.currentTarget.blur();
                onOpenInventory();
              }}
              className="relative w-[36px] h-[34px] sm:w-12 sm:h-12 ml-1 flex items-center justify-center bg-[#5a5a5a] hover:bg-[#707070] border-2 border-[#a8a8a8] border-b-[#2b2b2b] border-r-[#2b2b2b] text-white cursor-pointer"
            >
              <span className="font-pixel text-sm sm:text-base leading-none tracking-tighter">···</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
