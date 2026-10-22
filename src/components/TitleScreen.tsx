import React, { useEffect, useRef, useState } from 'react';
import {
  ANIMATRONIC_DOSSIERS,
  ANIMATRONIC_FACE_CROPS,
  AnimatronicAILevels,
  AnimatronicId,
} from '../game/types';
import { drawAnimatronicCharacter } from './AnimatronicRenderer';

interface TitleScreenProps {
  selectedNight: number;
  customAI: AnimatronicAILevels;
  onStartGame: (nightNumber: number, customLevels?: AnimatronicAILevels) => void;
  onUpdateCustomAI: (levels: AnimatronicAILevels) => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  selectedNight,
  customAI,
  onStartGame,
  onUpdateCustomAI,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [activeSubModal, setActiveSubModal] = useState<'none' | 'nights' | 'dossier'>('none');
  const [showcaseChar, setShowcaseChar] = useState<AnimatronicId>('pedro');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    const startTime = performance.now();

    const resize = () => {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const render = (now: number) => {
      const t = (now - startTime) / 1000;
      const w = canvas.width;
      const h = canvas.height;

      ctx.clearRect(0, 0, w, h);

      // Deep dark surveillance backdrop (40% calm negative space on the left for title lockup)
      const bg = ctx.createRadialGradient(w * 0.7, h * 0.5, 20, w * 0.65, h * 0.5, w * 0.65);
      bg.addColorStop(0, '#131b2e');
      bg.addColorStop(0.55, '#070a12');
      bg.addColorStop(1, '#030407');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // Subtle CRT static lines on the right side
      ctx.fillStyle = 'rgba(148, 163, 184, 0.04)';
      for (let i = 0; i < 18; i++) {
        const y = ((t * 95 + i * 53) % h);
        ctx.fillRect(w * 0.38, y, w * 0.62, 2);
      }

      // Spotlight cone on the right 62% of the screen
      const twitchGlitch = Math.sin(t * 17) > 0.92;
      const pose = twitchGlitch ? 'closeup' : 'stalk';

      drawAnimatronicCharacter(
        ctx,
        showcaseChar,
        w * 0.68,
        h * 0.63,
        Math.min(w, h) * 0.0038,
        {
          pose,
          time: t,
          jawOpen: twitchGlitch ? 0.55 : 0.1 + 0.08 * Math.sin(t * 2.5),
          eyeGlow: 1.2,
        }
      );

      // Left-side contrast scrim so typography is 100% legible over calm negative space
      const scrim = ctx.createLinearGradient(0, 0, w * 0.58, 0);
      scrim.addColorStop(0, 'rgba(3, 4, 7, 0.96)');
      scrim.addColorStop(0.75, 'rgba(3, 4, 7, 0.82)');
      scrim.addColorStop(1, 'rgba(3, 4, 7, 0)');
      ctx.fillStyle = scrim;
      ctx.fillRect(0, 0, w, h);

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, [showcaseChar]);

  const adjustAI = (key: keyof AnimatronicAILevels, delta: number) => {
    const nextVal = Math.max(0, Math.min(20, customAI[key] + delta));
    onUpdateCustomAI({ ...customAI, [key]: nextVal });
  };

  return (
    <div className="relative w-full h-full overflow-hidden select-none">
      {/* Live Canvas2D Animatronic Surveillance Stage */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full block pointer-events-none"
      />
      <div className="absolute inset-0 crt-scanlines pointer-events-none" />

      {/* Main Asymmetric Left-Third Title Lockup */}
      <div className="relative z-10 flex flex-col justify-between h-full px-8 py-8 md:px-16 md:py-12 max-w-2xl">
        {/* Top REC Camera Stamp */}
        <div className="flex items-center gap-3 font-mono-tech text-xs tracking-widest text-slate-400">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-600" />
          <span>CIRCUITO CERRADO · COMPLEJO DE LA MONCLOA · CAM 01A</span>
        </div>

        {/* Center Bespoke Inline SVG Title Lockup & <= 3 Primary Menu Actions */}
        <div className="my-auto py-2">
          <svg
            viewBox="0 0 680 175"
            className="w-full max-w-[540px] h-auto mb-5 drop-shadow-[0_10px_25px_rgba(0,0,0,0.9)]"
            role="img"
            aria-label="Five Nights in Moncloa"
          >
            {/* Institutional Crest Arch & Frame */}
            <rect
              x="4"
              y="8"
              width="672"
              height="158"
              rx="6"
              fill="rgba(9, 13, 22, 0.88)"
              stroke="#dc2626"
              strokeWidth="2.5"
            />
            <line x1="20" y1="24" x2="660" y2="24" stroke="#475569" strokeWidth="1" />
            <line x1="20" y1="150" x2="660" y2="150" stroke="#475569" strokeWidth="1" />

            <text
              x="28"
              y="48"
              fill="#facc15"
              fontFamily="JetBrains Mono, monospace"
              fontSize="13"
              fontWeight="700"
              letterSpacing="3.2"
            >
              EXPEDIENTE DE SEGURIDAD NOCTURNA · 12:00 AM — 06:00 AM
            </text>

            <text
              x="26"
              y="104"
              fill="#f8fafc"
              fontFamily="Oswald, sans-serif"
              fontSize="52"
              fontWeight="700"
              letterSpacing="2"
            >
              FIVE NIGHTS IN
            </text>
            <text
              x="398"
              y="104"
              fill="#ef4444"
              fontFamily="Oswald, sans-serif"
              fontSize="52"
              fontWeight="700"
              letterSpacing="2"
            >
              MONCLOA
            </text>

            <text
              x="28"
              y="136"
              fill="#94a3b8"
              fontFamily="Plus Jakarta Sans, sans-serif"
              fontSize="13.5"
              fontWeight="600"
              letterSpacing="1.4"
            >
              PEDRO (FREDDY) · RAJOY (BONNIE) · MONTERO (CHICA) · ABASCAL (FOXY)
            </text>
          </svg>

          {/* Interactive Character Switcher Preview Tabs with Politician Portrait Mugshots */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5 max-w-lg">
            {(
              [
                { id: 'pedro', name: 'Pedro', role: 'FREDDY' },
                { id: 'rajoy', name: 'Rajoy', role: 'BONNIE' },
                { id: 'montero', name: 'Montero', role: 'CHICA' },
                { id: 'abascal', name: 'Abascal', role: 'FOXY' },
              ] as { id: AnimatronicId; name: string; role: string }[]
            ).map((item) => {
              const crop = ANIMATRONIC_FACE_CROPS[item.id];
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setShowcaseChar(item.id)}
                  className={`px-2.5 py-1.5 text-left font-mono-tech rounded border flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    showcaseChar === item.id
                      ? 'bg-red-950/90 border-red-500 text-white'
                      : 'bg-slate-900/80 border-slate-700 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  <img
                    src={crop.src}
                    alt={`${item.name} (${item.role})`}
                    referrerPolicy="no-referrer"
                    style={{ objectPosition: crop.objectPosition }}
                    className="w-7 h-7 rounded-full object-cover border border-slate-500 shrink-0"
                  />
                  <div className="leading-tight">
                    <div className="text-xs font-bold text-white">{item.name}</div>
                    <div className="text-[10px] text-amber-400">{item.role}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* <= 3 Primary Menu Actions */}
          <div className="flex flex-col gap-3 max-w-lg">
            <button
              type="button"
              data-start="true"
              onClick={(e) => {
                e.currentTarget.blur();
                onStartGame(selectedNight, selectedNight === 6 ? customAI : undefined);
              }}
              className="w-full py-3.5 px-5 bg-red-700 hover:bg-red-600 active:bg-red-800 text-white font-display text-lg sm:text-xl tracking-wider uppercase rounded border border-red-400/50 shadow-[0_0_25px_rgba(220,38,38,0.4)] transition-transform active:scale-[0.99] text-left flex items-center justify-between gap-4 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>
                INICIAR GUARDIA ·{' '}
                {selectedNight === 6 ? 'CUSTOM NIGHT' : `NOCHE ${selectedNight}`}
              </span>
              <span className="font-mono-tech text-xs sm:text-sm text-red-100">[ENTER]</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubModal('nights')}
              className="w-full py-3 px-5 bg-slate-900/90 hover:bg-slate-800 text-slate-100 font-display text-base sm:text-lg tracking-wide uppercase rounded border border-slate-700 transition-colors text-left flex items-center justify-between gap-4 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>SELECCIONAR NOCHE / CUSTOM AI</span>
              <span className="font-mono-tech text-xs text-amber-400">NOCHES 1–6</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubModal('dossier')}
              className="w-full py-3 px-5 bg-slate-900/90 hover:bg-slate-800 text-slate-200 font-display text-base sm:text-lg tracking-wide uppercase rounded border border-slate-700 transition-colors text-left flex items-center justify-between gap-4 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>DOSSIER DE ANIMATRÓNICOS</span>
              <span className="font-mono-tech text-xs text-sky-400">4 EXPEDIENTES</span>
            </button>
          </div>
        </div>

        {/* Single Flat Borderless Control Hint Line in Bottom Safe Margin */}
        <div className="font-mono-tech text-xs text-slate-400 tracking-wide">
          [A / D] Puertas Blindadas · [Q / E] Luces de Pasillo · [Espacio] Monitor CCTV · [1-9] Cámaras · [P] Pausa
        </div>
      </div>

      {/* Sub-Modal: Night Selection & Custom Night (20/20/20/20) AI Tuner */}
      {activeSubModal === 'nights' && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Seleccionar Noche y Nivel de IA"
        >
          <div className="w-full max-w-xl bg-slate-950 border-2 border-slate-700 rounded-lg p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-800">
              <h2 className="font-display text-2xl text-white uppercase tracking-wide">
                SELECCIÓN DE TURNO Y CUSTOM NIGHT
              </h2>
              <button
                type="button"
                onClick={() => setActiveSubModal('none')}
                className="px-3 py-1 text-xs font-mono-tech bg-slate-800 hover:bg-slate-700 text-slate-200 rounded cursor-pointer"
              >
                CERRAR [ESC]
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-6">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    onStartGame(n, n === 6 ? customAI : undefined);
                  }}
                  className={`p-3 rounded border text-left transition-colors cursor-pointer ${
                    selectedNight === n
                      ? 'bg-red-950/90 border-red-500 text-white'
                      : 'bg-slate-900 border-slate-700 text-slate-200 hover:border-slate-500'
                  }`}
                >
                  <div className="font-display text-base uppercase">
                    {n === 6 ? 'NOCHE 6 · CUSTOM' : `NOCHE ${n}`}
                  </div>
                  <div className="font-mono-tech text-xs text-slate-400 mt-0.5">
                    {n === 1 && 'IA Suave · Tutorial'}
                    {n === 2 && 'Abascal-Foxy Activo'}
                    {n === 3 && 'Pedro Sale a Escena'}
                    {n === 4 && 'Alta Agresividad'}
                    {n === 5 && 'Crisis Total en Moncloa'}
                    {n === 6 && 'Ajuste Manual 0–20'}
                  </div>
                </button>
              ))}
            </div>

            {/* Custom Night (0-20) AI Sliders */}
            <div className="bg-slate-900/90 border border-slate-800 rounded p-4 mb-5">
              <div className="flex items-center justify-between mb-3">
                <span className="font-display text-sm uppercase tracking-wider text-amber-400">
                  CONFIGURADOR DE IA · NOCHE PERSONALIZADA (0 A 20)
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateCustomAI({ pedro: 20, rajoy: 20, montero: 20, abascal: 20 })
                  }
                  className="px-2.5 py-1 text-xs font-mono-tech bg-red-900/80 hover:bg-red-800 text-red-100 rounded border border-red-600 cursor-pointer whitespace-nowrap shrink-0"
                >
                  MODO 20/20/20/20
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(
                  [
                    { key: 'pedro', name: 'Pedro-Freddy' },
                    { key: 'rajoy', name: 'Rajoy-Bonnie' },
                    { key: 'montero', name: 'Montero-Chica' },
                    { key: 'abascal', name: 'Abascal-Foxy' },
                  ] as { key: keyof AnimatronicAILevels; name: string }[]
                ).map((item) => {
                  const crop = ANIMATRONIC_FACE_CROPS[item.key];
                  return (
                    <div
                      key={item.key}
                      className="flex items-center justify-between bg-slate-950 p-2.5 rounded border border-slate-800"
                    >
                      <div className="flex items-center gap-2.5">
                        <img
                          src={crop.src}
                          alt={item.name}
                          referrerPolicy="no-referrer"
                          style={{ objectPosition: crop.objectPosition }}
                          className="w-9 h-9 rounded object-cover border border-slate-600 shrink-0"
                        />
                        <span className="text-xs font-semibold text-slate-200">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          aria-label={`Disminuir IA de ${item.name}`}
                          onClick={() => adjustAI(item.key, -1)}
                          className="w-7 h-7 rounded bg-slate-800 hover:bg-slate-700 text-white font-mono-tech text-sm cursor-pointer"
                        >
                          -
                        </button>
                        <span className="w-7 text-center font-mono-tech text-sm font-bold text-amber-400">
                          {customAI[item.key]}
                        </span>
                        <button
                          type="button"
                          aria-label={`Aumentar IA de ${item.name}`}
                          onClick={() => adjustAI(item.key, 1)}
                          className="w-7 h-7 rounded bg-slate-800 hover:bg-slate-700 text-white font-mono-tech text-sm cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => onStartGame(6, customAI)}
                className="px-5 py-2.5 bg-red-700 hover:bg-red-600 text-white font-display text-base uppercase tracking-wider rounded cursor-pointer whitespace-nowrap shrink-0"
              >
                JUGAR NOCHE PERSONALIZADA ({customAI.pedro}/{customAI.rajoy}/{customAI.montero}/
                {customAI.abascal})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Modal: Tactical Animatronic Dossier */}
      {activeSubModal === 'dossier' && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Dossier de Animatrónicos"
        >
          <div className="w-full max-w-3xl max-h-[88vh] overflow-y-auto bg-slate-950 border-2 border-slate-700 rounded-lg p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-800">
              <h2 className="font-display text-2xl text-white uppercase tracking-wide">
                MANUAL DEL GUARDIA · PATRONES DE ATAQUE 1 A 1
              </h2>
              <button
                type="button"
                onClick={() => setActiveSubModal('none')}
                className="px-3 py-1 text-xs font-mono-tech bg-slate-800 hover:bg-slate-700 text-slate-200 rounded cursor-pointer"
              >
                CERRAR
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ANIMATRONIC_DOSSIERS.map((d) => {
                const crop = ANIMATRONIC_FACE_CROPS[d.id];
                return (
                  <div
                    key={d.id}
                    className="bg-slate-900/90 border border-slate-800 rounded p-4 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-3 mb-2.5">
                        <img
                          src={d.portraitUrl}
                          alt={d.name}
                          referrerPolicy="no-referrer"
                          style={{ objectPosition: crop.objectPosition }}
                          className="w-12 h-12 rounded-md object-cover border-2 border-slate-600 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="font-display text-lg text-white uppercase truncate">
                              {d.name}
                            </h3>
                            <span className="font-mono-tech text-xs text-amber-400 shrink-0">
                              {d.fnafCounterpart}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 font-mono-tech truncate">
                            {d.wing}
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed mb-3">
                        {d.behaviorSummary}
                      </p>
                    </div>
                    <div className="pt-2 border-t border-slate-800 text-xs text-emerald-300">
                      <strong>Contramedida:</strong> {d.counterplayTip}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
