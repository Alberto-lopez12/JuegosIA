import React from 'react';
import { Wrench, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';

export type RebootTarget = 'AUDIO' | 'CAMERA' | 'VENTILATION' | 'ALL' | null;

interface MaintenancePanelProps {
  audioError: boolean;
  cameraError: boolean;
  ventilationError: boolean;
  rebootingTarget: RebootTarget;
  rebootProgress: number; // 0 to 100
  onStartReboot: (target: 'AUDIO' | 'CAMERA' | 'VENTILATION' | 'ALL') => void;
  onClosePanel: () => void;
}

export const MaintenancePanel: React.FC<MaintenancePanelProps> = ({
  audioError,
  cameraError,
  ventilationError,
  rebootingTarget,
  rebootProgress,
  onStartReboot,
  onClosePanel,
}) => {
  const isBusy = rebootingTarget !== null;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/85 p-4 select-none">
      {/* Classic FNAF 3 Orange/Amber CRT Terminal Box */}
      <div className="relative w-full max-w-3xl bg-[#0b0904] border-4 border-amber-700/80 shadow-[0_0_60px_rgba(0,0,0,0.95)] p-6 md:p-10 overflow-hidden">
        <div className="absolute inset-0 crt-scanlines z-20" />
        <div className="absolute inset-0 crt-vignette z-20" />

        <div className="relative z-25">
          {/* Header */}
          <div className="flex items-center justify-between border-b-2 border-amber-600/60 pb-3 mb-6">
            <div className="flex items-center gap-3">
              <Wrench className="w-8 h-8 text-amber-500" />
              <h2 className="text-4xl md:text-5xl font-crt text-amber-400 tracking-widest">
                SISTEMA DE MANTENIMIENTO AEAT
              </h2>
            </div>
            <span className="text-xl font-crt text-amber-600">TERMINAL v3.03</span>
          </div>

          <p className="text-xl font-crt text-amber-200/80 mb-6">
            Selecciona un subsistema dañado por los fantasmas andorranos para reiniciarlo:
          </p>

          {/* Systems List */}
          <div className="space-y-4 mb-8">
            {/* 1. Audio Devices */}
            <div className="flex items-center justify-between bg-[#141007] border-2 border-amber-800/70 p-4">
              <div>
                <div className="text-3xl font-crt text-amber-300 tracking-wider">
                  &gt; DISPOSITIVOS DE AUDIO («¡ABDUZCAN!»)
                </div>
                <div className="text-base font-crt text-amber-600">
                  Señuelo de voz en cámaras para alejar a AuronPlay
                </div>
              </div>
              <div className="flex items-center gap-4">
                {audioError ? (
                  <span className="flex items-center gap-1.5 text-2xl font-crt text-red-500 animate-pulse">
                    <AlertTriangle className="w-6 h-6" /> ERROR
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-2xl font-crt text-lime-400">
                    <CheckCircle2 className="w-6 h-6" /> OK
                  </span>
                )}
                <button
                  onClick={() => onStartReboot('AUDIO')}
                  disabled={isBusy}
                  className="px-5 py-2 bg-amber-900/50 hover:bg-amber-700/60 disabled:opacity-40 border-2 border-amber-500 text-amber-200 font-crt text-2xl tracking-wider cursor-pointer"
                >
                  {rebootingTarget === 'AUDIO' ? 'REINICIANDO...' : 'REINICIAR'}
                </button>
              </div>
            </div>

            {/* 2. Camera System */}
            <div className="flex items-center justify-between bg-[#141007] border-2 border-amber-800/70 p-4">
              <div>
                <div className="text-3xl font-crt text-amber-300 tracking-wider">
                  &gt; SISTEMA DE CÁMARAS CCTV
                </div>
                <div className="text-base font-crt text-amber-600">
                  Transmisión de vídeo de salas CAM 01–10 y conductos CAM 11–15
                </div>
              </div>
              <div className="flex items-center gap-4">
                {cameraError ? (
                  <span className="flex items-center gap-1.5 text-2xl font-crt text-red-500 animate-pulse">
                    <AlertTriangle className="w-6 h-6" /> ERROR
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-2xl font-crt text-lime-400">
                    <CheckCircle2 className="w-6 h-6" /> OK
                  </span>
                )}
                <button
                  onClick={() => onStartReboot('CAMERA')}
                  disabled={isBusy}
                  className="px-5 py-2 bg-amber-900/50 hover:bg-amber-700/60 disabled:opacity-40 border-2 border-amber-500 text-amber-200 font-crt text-2xl tracking-wider cursor-pointer"
                >
                  {rebootingTarget === 'CAMERA' ? 'REINICIANDO...' : 'REINICIAR'}
                </button>
              </div>
            </div>

            {/* 3. Ventilation */}
            <div className="flex items-center justify-between bg-[#141007] border-2 border-amber-800/70 p-4">
              <div>
                <div className="text-3xl font-crt text-amber-300 tracking-wider">
                  &gt; VENTILACIÓN DE LA OFICINA
                </div>
                <div className="text-base font-crt text-amber-600">
                  Evita el apagón por falta de oxígeno y las alucinaciones dobles de AuronPlay
                </div>
              </div>
              <div className="flex items-center gap-4">
                {ventilationError ? (
                  <span className="flex items-center gap-1.5 text-2xl font-crt text-red-500 animate-pulse">
                    <AlertTriangle className="w-6 h-6" /> ERROR CRÍTICO
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-2xl font-crt text-lime-400">
                    <CheckCircle2 className="w-6 h-6" /> OK
                  </span>
                )}
                <button
                  onClick={() => onStartReboot('VENTILATION')}
                  disabled={isBusy}
                  className="px-5 py-2 bg-amber-900/50 hover:bg-amber-700/60 disabled:opacity-40 border-2 border-amber-500 text-amber-200 font-crt text-2xl tracking-wider cursor-pointer"
                >
                  {rebootingTarget === 'VENTILATION' ? 'REINICIANDO...' : 'REINICIAR'}
                </button>
              </div>
            </div>
          </div>

          {/* Reboot All & Progress Bar */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-t-2 border-amber-800/60 pt-5">
            <button
              onClick={() => onStartReboot('ALL')}
              disabled={isBusy}
              className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-red-950/70 hover:bg-red-900/80 disabled:opacity-40 border-2 border-red-500 text-red-200 font-crt text-3xl tracking-widest cursor-pointer"
            >
              <RefreshCw className={`w-6 h-6 ${rebootingTarget === 'ALL' ? 'animate-spin' : ''}`} />
              &gt; REINICIAR TODO (REBOOT ALL)
            </button>

            <button
              onClick={onClosePanel}
              disabled={isBusy}
              className="w-full md:w-auto px-8 py-3 bg-amber-800/40 hover:bg-amber-700/60 disabled:opacity-40 border-2 border-amber-400 text-amber-100 font-crt text-3xl tracking-widest cursor-pointer"
            >
              ◀ SALIR DEL PANEL
            </button>
          </div>

          {/* Active Reboot Progress Indicator */}
          {isBusy && (
            <div className="mt-6 bg-black border-2 border-amber-500 p-3">
              <div className="flex justify-between text-2xl font-crt text-amber-300 mb-1">
                <span>REINICIANDO SISTEMA ({rebootingTarget})... POR FAVOR ESPERE</span>
                <span>{Math.round(rebootProgress)}%</span>
              </div>
              <div className="w-full h-5 bg-amber-950 overflow-hidden">
                <div
                  className="h-full bg-amber-400 transition-all duration-150"
                  style={{ width: `${rebootProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
