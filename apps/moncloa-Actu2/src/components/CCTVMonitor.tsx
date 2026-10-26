import React, { useEffect, useRef } from 'react';
import {
  CAMERAS,
  CameraId,
  NightSimulationState,
} from '../game/types';
import { drawCameraScene } from './AnimatronicRenderer';

interface CCTVMonitorProps {
  state: NightSimulationState;
  onSelectCamera: (camId: CameraId) => void;
  onCloseMonitor: () => void;
}

export const CCTVMonitor: React.FC<CCTVMonitorProps> = ({
  state,
  onSelectCamera,
  onCloseMonitor,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<NightSimulationState>(state);
  stateRef.current = state;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    const start = performance.now();

    const resize = () => {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const loop = (now: number) => {
      const t = (now - start) / 1000;
      drawCameraScene(ctx, canvas.width, canvas.height, stateRef.current, t);
      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  const currentCamMeta =
    CAMERAS.find((c) => c.id === state.activeCam) || CAMERAS[0];

  // Determine which animatronics are visible on the currently selected camera for live diagnostic readouts
  const presentAnimatronics: string[] = [];
  if (state.activeCam !== 'CAM_6') {
    if (state.pedroLocation === state.activeCam) presentAnimatronics.push('Pedro-Freddy');
    if (state.rajoyLocation === state.activeCam) presentAnimatronics.push('Rajoy-Bonnie');
    if (state.monteroLocation === state.activeCam) presentAnimatronics.push('Montero-Chica');
    if (state.activeCam === 'CAM_1C') {
      const foxyLabels = [
        'Cortina Cerrada (Fase 0)',
        'Abascal Asomando (Fase 1)',
        'Abascal Fuera de Cortina (Fase 2)',
        '¡CALA VACÍA! (Fase 3)',
      ];
      presentAnimatronics.push(foxyLabels[state.abascalStage]);
    }
    if (state.activeCam === 'CAM_2A' && state.abascalSprinting) {
      presentAnimatronics.push('¡ABASCAL-FOXY CORRIENDO AL DESPACHO!');
    }
    if (
      state.activeCam === 'CAM_3' &&
      state.endo03Active &&
      state.rajoyLocation !== 'CAM_3'
    ) {
      presentAnimatronics.push('ENDO-03 (ANOMALÍA 1/1000)');
    }
    if (state.activeCam === 'CAM_2B' && state.goldenFreddyPosterActive) {
      presentAnimatronics.push('ECHENIQUE-GOLDEN FREDDY (ANOMALÍA 1/1000)');
    }
  }

  return (
    <div
      className="fixed inset-0 z-20 pointer-events-auto select-none"
      data-testid="cctv-monitor"
    >
      {/* Fullscreen CCTV Room Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full block pointer-events-none"
      />

      {/* CRT Scanline & VHS Border Frame */}
      <div className="absolute inset-0 crt-scanlines pointer-events-none border-[10px] border-slate-800/90" />

      {/* Top-Left Camera Feed Label & REC Status */}
      <div className="absolute top-20 left-8 z-30 pointer-events-none">
        <div className="flex items-center gap-3 mb-1">
          <span className="inline-block w-3.5 h-3.5 rounded-full bg-red-600" />
          <span className="font-display text-2xl md:text-3xl text-white tracking-wider uppercase drop-shadow">
            CAM {currentCamMeta.shortCode} · {currentCamMeta.name}
          </span>
        </div>
        <div className="font-mono-tech text-xs text-slate-300 tracking-wider">
          EQUIVALENTE FNAF: {currentCamMeta.fnafEquivalent.toUpperCase()} ·{' '}
          {presentAnimatronics.length > 0
            ? `DETECTADO: ${presentAnimatronics.join(' + ')}`
            : 'SECTOR DESPEJADO'}
        </div>

        {currentCamMeta.audioOnly && (
          <div className="mt-4 px-4 py-2 bg-slate-950/90 border border-amber-500/60 rounded text-amber-300 font-mono-tech text-sm">
            - CÁMARA DESACTIVADA · SOLO SEÑAL DE AUDIO -
            {(state.monteroLocation === 'CAM_6' || state.pedroLocation === 'CAM_6') && (
              <div className="text-red-400 font-bold mt-1">
                ¡RUIDO METÁLICO DETECTADO EN LA COCINA OFICIAL!
              </div>
            )}
          </div>
        )}
      </div>

      {/* Interactive Palacio de la Moncloa Schematic Floorplan & Camera Selector (Bottom Right) */}
      <div className="absolute bottom-16 right-6 z-30 w-[340px] sm:w-[390px] bg-slate-950/90 border-2 border-slate-600 rounded p-3 shadow-2xl">
        <div className="flex items-center justify-between gap-2 mb-2 pb-1 border-b border-slate-800">
          <span className="font-mono-tech text-xs font-bold text-slate-200 tracking-wide whitespace-nowrap shrink-0">
            MAPA MONCLOA · 11 CÁMARAS
          </span>
          <span className="font-mono-tech text-[11px] text-emerald-400 whitespace-nowrap shrink-0">
            TECLAS [1–9, 0, -]
          </span>
        </div>

        {/* Schematic SVG Blueprint + Overlay Camera Buttons */}
        <div className="relative w-full h-[230px] bg-slate-900/80 border border-slate-800 rounded overflow-hidden">
          <svg
            viewBox="0 0 100 100"
            className="absolute inset-0 w-full h-full stroke-slate-600 fill-none"
            strokeWidth="0.8"
          >
            {/* Show Stage 1A & Dining Area 1B */}
            <rect x="35" y="4" width="28" height="12" />
            <rect x="28" y="16" width="42" height="28" />
            {/* Backstage 5 & Pirate Cove 1C */}
            <rect x="8" y="16" width="18" height="16" />
            <rect x="14" y="34" width="14" height="14" />
            {/* Restrooms 7 & Kitchen 6 */}
            <rect x="72" y="18" width="20" height="18" />
            <rect x="72" y="46" width="22" height="20" />
            {/* Supply Closet 3 */}
            <rect x="12" y="54" width="16" height="16" />
            {/* West Hall 2A/2B & East Hall 4A/4B */}
            <rect x="30" y="44" width="12" height="44" />
            <rect x="56" y="44" width="12" height="44" />
            {/* Security Office (YOU) */}
            <rect
              x="42"
              y="76"
              width="14"
              height="18"
              stroke="#38bdf8"
              strokeWidth="1.2"
              fill="rgba(56, 189, 248, 0.12)"
            />
            <text
              x="49"
              y="87"
              fill="#38bdf8"
              stroke="none"
              fontSize="4.5"
              fontFamily="JetBrains Mono, monospace"
              textAnchor="middle"
            >
              TÚ
            </text>
          </svg>

          {CAMERAS.map((cam) => {
            const isActive = state.activeCam === cam.id;
            return (
              <button
                key={cam.id}
                type="button"
                aria-label={`Cámara ${cam.shortCode} ${cam.name}`}
                onClick={() => onSelectCamera(cam.id)}
                style={{ left: `${cam.mapX}%`, top: `${cam.mapY}%` }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 px-2 py-1 rounded font-mono-tech text-[11px] font-bold border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-emerald-600 border-emerald-300 text-white shadow-[0_0_10px_rgba(16,185,129,0.8)]'
                    : 'bg-slate-800/95 border-slate-500 text-slate-200 hover:bg-slate-700'
                }`}
              >
                CAM {cam.shortCode}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onCloseMonitor}
          className="mt-2.5 w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 font-display text-sm uppercase tracking-wider rounded border border-slate-500 cursor-pointer whitespace-nowrap shrink-0"
        >
          BAJAR MONITOR CCTV [ESPACIO]
        </button>
      </div>
    </div>
  );
};
