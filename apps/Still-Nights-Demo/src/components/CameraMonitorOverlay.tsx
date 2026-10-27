import React, { useEffect, useRef, useState } from 'react';
import {
  AnimatronicId,
  AnimatronicState,
  NodeId,
  isAnimatronicVisibleOnCamera,
  isVentNode,
} from '../game/rules';
import { CAMERA_NODES, renderCameraFeed } from '../game/cameraRenderer';
import { soundController } from '../game/audio';

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
}) => {
  // Separate mode state: 'BUILDING' (normal room cameras) vs 'VENT' (ventilation cameras)
  const [monitorMode, setMonitorMode] = useState<'BUILDING' | 'VENT'>(() =>
    isVentNode(selectedCam) ? 'VENT' : 'BUILDING'
  );

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animsRef = useRef(animatronics);
  animsRef.current = animatronics;
  const staticRef = useRef(staticBurst);
  staticRef.current = staticBurst;

  // Keep monitorMode in sync if selectedCam changes externally
  useEffect(() => {
    setMonitorMode(isVentNode(selectedCam) ? 'VENT' : 'BUILDING');
  }, [selectedCam]);

  useEffect(() => {
    if (!isOpen) return;
    let raf = 0;
    const start = performance.now();

    const loop = (now: number) => {
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
            staticRef.current
          );
        }
      }
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [isOpen, selectedCam]);

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

  const anyInBuildingVents = (Object.values(animatronics) as AnimatronicState[]).some(
    (a) => a.active && isVentNode(a.location)
  );

  return (
    <div
      className="fixed inset-0 z-30 bg-zinc-950 flex flex-col justify-between p-4 sm:p-6 pointer-events-auto"
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
          {anyInBuildingVents && (
            <span className="text-xs font-mono font-semibold text-amber-400">
              ALERTA: Ruido en Ventilación
            </span>
          )}
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
          <button
            type="button"
            onClick={onCloseMonitor}
            className="px-4 py-2 text-xs font-mono font-bold bg-zinc-200 text-zinc-950 hover:bg-white rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            Bajar Monitor [S / Espacio]
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
    </div>
  );
};
