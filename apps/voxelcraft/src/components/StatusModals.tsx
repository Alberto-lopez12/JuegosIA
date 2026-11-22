import React, { useRef, useState } from 'react';
import type { GlobalSettings, HUDState } from '../game/types';
import { OptionsModal } from './OptionsModal';

interface StatusModalsProps {
  hud: HUDState;
  onResume: () => void;
  onSave: () => void;
  onExportWorld: () => string;
  onImportWorld: (json: string) => { ok: boolean; error?: string };
  onUpdateSettings: (partial: Partial<GlobalSettings>) => void;
  onToggleWeather: () => void;
  onReturnTitle: () => void;
  onRespawn: () => void;
}

export const StatusModals: React.FC<StatusModalsProps> = ({
  hud,
  onResume,
  onSave,
  onExportWorld,
  onImportWorld,
  onUpdateSettings,
  onToggleWeather,
  onReturnTitle,
  onRespawn,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [showOptions, setShowOptions] = useState(false);
  const [importFeedback, setImportFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );

  const handleExportClick = () => {
    try {
      const json = onExportWorld();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `voxelcraft-${hud.worldName.toLowerCase().replace(/\s+/g, '-')}-day-${hud.dayCount}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setImportFeedback({ type: 'ok', text: 'Backup JSON exportado correctamente.' });
    } catch {
      setImportFeedback({ type: 'err', text: 'No se pudo exportar el archivo JSON.' });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      const res = onImportWorld(text);
      if (!res.ok) {
        setImportFeedback({ type: 'err', text: res.error ?? 'Archivo JSON inválido.' });
      } else {
        setImportFeedback(null);
      }
    };
    reader.onerror = () => {
      setImportFeedback({ type: 'err', text: 'Error al leer el archivo seleccionado.' });
    };
    reader.readAsText(file);
  };

  if (hud.phase === 'paused') {
    if (showOptions) {
      return (
        <OptionsModal
          settings={hud.settings}
          touchControlsActive={hud.touchControlsActive}
          onUpdateSettings={onUpdateSettings}
          onClose={() => setShowOptions(false)}
        />
      );
    }

    return (
      <div
        className="fixed inset-0 z-30 flex items-center justify-center bg-black/62 p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Juego en pausa"
      >
        <div className="mc-panel w-full max-w-md p-6 text-[#262626] flex flex-col gap-3.5 max-h-[90vh] overflow-y-auto">
          <div className="text-center">
            <h1 className="font-pixel text-lg tracking-tight">Juego en Pausa</h1>
            <p className="text-[11px] font-mono-hud text-[#4a4a4a] mt-0.5">
              {hud.worldName} · {hud.gameMode === 'creative' ? 'Creativo' : 'Supervivencia'} · Semilla {hud.seedLabel}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center bg-[#b0b0b0] p-2.5 border border-[#7c7c7c]">
            <div>
              <div className="text-[10px] font-bold uppercase text-[#4a4a4a]">Día</div>
              <div className="font-pixel text-base tabular-nums">{hud.dayCount}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase text-[#4a4a4a]">Picados</div>
              <div className="font-pixel text-base tabular-nums">{hud.stats.blocksMined}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase text-[#4a4a4a]">Colocados</div>
              <div className="font-pixel text-base tabular-nums">{hud.stats.blocksPlaced}</div>
            </div>
          </div>

          {importFeedback && (
            <div
              role="status"
              className={`px-2.5 py-1.5 text-xs font-medium border ${
                importFeedback.type === 'ok'
                  ? 'bg-emerald-900/15 border-emerald-700 text-emerald-900'
                  : 'bg-rose-900/15 border-rose-700 text-rose-900'
              }`}
            >
              {importFeedback.text}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileChange}
            className="hidden"
            aria-hidden="true"
          />

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={onResume}
              className="mc-button-primary w-full py-2.5 font-pixel text-sm text-white cursor-pointer"
            >
              Reanudar
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setShowOptions(true)}
                className="mc-button py-2.5 font-pixel text-xs text-white cursor-pointer"
              >
                Opciones...
              </button>
              <button
                type="button"
                data-testid="toggle-weather-btn"
                onClick={onToggleWeather}
                className="mc-button py-2.5 font-pixel text-xs text-white cursor-pointer"
              >
                Clima: {hud.weather === 'storm' ? 'Tormenta' : 'Despejado'}
              </button>
            </div>

            <button
              type="button"
              onClick={onSave}
              className="mc-button w-full py-2.5 font-pixel text-xs text-white cursor-pointer"
            >
              Guardar Mundo
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleExportClick}
                className="mc-button py-2 font-pixel text-[11px] text-white cursor-pointer"
              >
                Exportar (.json)
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mc-button py-2 font-pixel text-[11px] text-white cursor-pointer"
              >
                Importar (.json)
              </button>
            </div>

            <button
              type="button"
              onClick={onReturnTitle}
              className="mc-button w-full py-2.5 font-pixel text-xs text-white cursor-pointer"
            >
              Guardar y Salir al Menú
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (hud.phase === 'gameover') {
    return (
      <div
        className="fixed inset-0 z-30 flex items-center justify-center bg-[#3a0909]/75 p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Has muerto"
      >
        <div className="mc-panel w-full max-w-md p-6 text-[#262626] flex flex-col gap-4">
          <h1 className="font-pixel text-xl text-center text-[#8f1d1d]">¡Has Muerto!</h1>

          <div className="grid grid-cols-3 gap-2 text-center bg-[#b0b0b0] p-3 border border-[#7c7c7c]">
            <div>
              <div className="text-[10px] font-bold uppercase text-[#4a4a4a]">Día</div>
              <div className="font-pixel text-base tabular-nums">{hud.stats.dayReached}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase text-[#4a4a4a]">Bloques</div>
              <div className="font-pixel text-base tabular-nums">{hud.stats.blocksMined}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase text-[#4a4a4a]">Mobs</div>
              <div className="font-pixel text-base tabular-nums">{hud.stats.mobsDefeated}</div>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 mt-1">
            <button
              type="button"
              data-start="true"
              onClick={onRespawn}
              className="mc-button-primary w-full py-3 font-pixel text-sm text-white cursor-pointer"
            >
              {hud.bedSpawn ? 'Reaparecer en Cama' : 'Reaparecer'}
            </button>
            <button
              type="button"
              onClick={onReturnTitle}
              className="mc-button w-full py-2.5 font-pixel text-xs text-white cursor-pointer"
            >
              Menú Principal
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
