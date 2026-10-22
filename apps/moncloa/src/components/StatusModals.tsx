import React from 'react';
import { ANIMATRONIC_FACE_CROPS, RunSummarySnapshot } from '../game/types';

interface PauseModalProps {
  nightNumber: number;
  hourLabel: string;
  powerPercent: number;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onResume: () => void;
  onRestart: () => void;
  onReturnTitle: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  nightNumber,
  hourLabel,
  powerPercent,
  isFullscreen,
  onToggleFullscreen,
  onResume,
  onRestart,
  onReturnTitle,
}) => {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4 pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Juego en Pausa"
    >
      <div className="w-full max-w-md bg-slate-950 border-2 border-slate-700 rounded-lg p-6 shadow-2xl">
        <h2 className="font-display text-3xl text-white uppercase tracking-wider mb-1">
          GUARDIA EN PAUSA
        </h2>
        <p className="font-mono-tech text-xs text-slate-400 mb-5">
          SISTEMA DE VIGILANCIA DE LA MONCLOA · TURNO SUSPENDIDO
        </p>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-slate-900 border border-slate-800 rounded p-3">
            <div className="font-mono-tech text-[10px] text-slate-400 uppercase">NOCHE</div>
            <div className="font-display text-2xl text-white font-mono-tech mt-0.5">
              {nightNumber === 6 ? 'CUSTOM' : nightNumber}
            </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded p-3">
            <div className="font-mono-tech text-[10px] text-slate-400 uppercase">HORA ACTUAL</div>
            <div className="font-display text-2xl text-amber-400 font-mono-tech mt-0.5">
              {hourLabel}
            </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded p-3">
            <div className="font-mono-tech text-[10px] text-slate-400 uppercase">BATERÍA</div>
            <div className="font-display text-2xl text-emerald-400 font-mono-tech mt-0.5">
              {powerPercent}%
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onResume}
            className="w-full py-3 bg-emerald-700 hover:bg-emerald-600 text-white font-display text-lg uppercase tracking-wider rounded cursor-pointer whitespace-nowrap shrink-0"
          >
            REANUDAR GUARDIA [P / ESC]
          </button>
          <button
            type="button"
            onClick={onToggleFullscreen}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-amber-300 font-display text-base uppercase tracking-wider rounded border border-slate-600 cursor-pointer whitespace-nowrap shrink-0"
          >
            {isFullscreen ? 'SALIR DE PANTALLA COMPLETA [F]' : 'PANTALLA COMPLETA [F]'}
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-100 font-display text-base uppercase tracking-wider rounded border border-slate-600 cursor-pointer whitespace-nowrap shrink-0"
          >
            REINICIAR NOCHE [R]
          </button>
          <button
            type="button"
            onClick={onReturnTitle}
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 font-display text-base uppercase tracking-wider rounded border border-slate-800 cursor-pointer whitespace-nowrap shrink-0"
          >
            MENÚ PRINCIPAL
          </button>
        </div>
      </div>
    </div>
  );
};

interface EndOfRunModalProps {
  snapshot: RunSummarySnapshot;
  onPlayAgainOrNext: (nextNightNumber: number) => void;
  onReturnTitle: () => void;
}

export const EndOfRunModal: React.FC<EndOfRunModalProps> = ({
  snapshot,
  onPlayAgainOrNext,
  onReturnTitle,
}) => {
  const isVictory = snapshot.outcome === 'victory';
  const nextNight = isVictory ? Math.min(6, snapshot.nightNumber + 1) : snapshot.nightNumber;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/85 p-4 pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-label={isVictory ? '6:00 AM Turno Superado' : 'Fin de la Partida'}
    >
      <div
        className={`w-full max-w-lg bg-slate-950 border-2 rounded-lg p-6 shadow-2xl ${
          isVictory ? 'border-amber-500' : 'border-red-600'
        }`}
      >
        <div className="font-mono-tech text-xs uppercase tracking-widest mb-1 text-slate-400">
          {isVictory
            ? 'PALACIO DE LA MONCLOA · FIN DEL TURNO NOCTURNO'
            : 'SEÑAL INTERRUMPIDA · GUARDIA NEUTRALIZADO'}
        </div>

        <h2
          className={`font-display text-4xl uppercase tracking-wider mb-2 ${
            isVictory ? 'text-amber-400' : 'text-red-500'
          }`}
        >
          {isVictory ? '6:00 AM · ¡NOCHE SUPERADA!' : 'GAME OVER · JUMPSCARE'}
        </h2>

        <div className="flex items-center gap-3.5 mb-5">
          {snapshot.jumpscareBy && (
            <img
              src={ANIMATRONIC_FACE_CROPS[snapshot.jumpscareBy].src}
              alt={snapshot.jumpscareBy}
              referrerPolicy="no-referrer"
              style={{
                objectPosition: ANIMATRONIC_FACE_CROPS[snapshot.jumpscareBy].objectPosition,
              }}
              className="w-14 h-14 rounded-md object-cover border-2 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)] shrink-0"
            />
          )}
          <p className="text-sm text-slate-300 leading-relaxed">{snapshot.causeOfDefeat}</p>
        </div>

        {/* 3 Tabular-Nums Stat Tiles */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-slate-900 border border-slate-800 rounded p-3">
            <div className="font-mono-tech text-[10px] text-slate-400 uppercase">
              HORA ALCANZADA
            </div>
            <div className="font-display text-2xl text-white font-mono-tech mt-0.5">
              {snapshot.hourReached}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded p-3">
            <div className="font-mono-tech text-[10px] text-slate-400 uppercase">
              ENERGÍA RESTANTE
            </div>
            <div className="font-display text-2xl text-emerald-400 font-mono-tech mt-0.5">
              {snapshot.powerRemainingPercent}%
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded p-3">
            <div className="font-mono-tech text-[10px] text-slate-400 uppercase">
              GOLPES DE ABASCAL
            </div>
            <div className="font-display text-2xl text-amber-400 font-mono-tech mt-0.5">
              {snapshot.abascalBangs}
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            data-start="true"
            onClick={(e) => {
              e.currentTarget.blur();
              onPlayAgainOrNext(nextNight);
            }}
            className={`flex-1 py-3 px-5 font-display text-lg uppercase tracking-wider rounded text-white cursor-pointer whitespace-nowrap shrink-0 ${
              isVictory
                ? 'bg-amber-600 hover:bg-amber-500'
                : 'bg-red-700 hover:bg-red-600'
            }`}
          >
            {isVictory
              ? `CONTINUAR A NOCHE ${nextNight} [ENTER]`
              : `REINTENTAR NOCHE ${snapshot.nightNumber} [ENTER]`}
          </button>

          <button
            type="button"
            onClick={onReturnTitle}
            className="py-3 px-5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-display text-base uppercase tracking-wider rounded border border-slate-600 cursor-pointer whitespace-nowrap shrink-0"
          >
            MENÚ PRINCIPAL
          </button>
        </div>
      </div>
    </div>
  );
};
