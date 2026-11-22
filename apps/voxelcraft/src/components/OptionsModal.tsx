import React from 'react';
import type { GlobalSettings, GraphicsQuality, TouchControlsMode } from '../game/types';

interface OptionsModalProps {
  settings: GlobalSettings;
  touchControlsActive: boolean;
  onUpdateSettings: (partial: Partial<GlobalSettings>) => void;
  onClose: () => void;
}

export const OptionsModal: React.FC<OptionsModalProps> = ({
  settings,
  touchControlsActive,
  onUpdateSettings,
  onClose,
}) => {
  const cycleTouchMode = () => {
    const order: TouchControlsMode[] = ['auto', 'on', 'off'];
    const next = order[(order.indexOf(settings.touchControlsMode) + 1) % order.length];
    onUpdateSettings({ touchControlsMode: next });
  };

  const toggleGraphics = () => {
    const next: GraphicsQuality = settings.graphicsQuality === 'fancy' ? 'fast' : 'fancy';
    onUpdateSettings({ graphicsQuality: next });
  };

  const touchLabel =
    settings.touchControlsMode === 'auto'
      ? `Auto (${touchControlsActive ? 'Activo' : 'PC'})`
      : settings.touchControlsMode === 'on'
      ? 'Sí'
      : 'No';

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4 pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Opciones de VoxelCraft"
      onClick={onClose}
    >
      <div
        className="mc-panel w-full max-w-lg p-5 sm:p-6 text-[#222222] flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
        style={{ touchAction: 'pan-y' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b-2 border-[#8c8c8c] pb-2">
          <h2 className="font-pixel text-base sm:text-lg tracking-tight">Opciones</h2>
          <span className="font-mono-hud text-[11px] text-[#4b4b4b]">Guardado automático</span>
        </div>

        <div className="flex flex-col gap-3.5 bg-[#b2b2b2] p-4 border-2 border-[#7c7c7c]">
          {/* Mouse Sensitivity */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs font-bold text-[#222]">
              <label htmlFor="opt-sensitivity">Sensibilidad del ratón</label>
              <span className="font-mono-hud tabular-nums">
                {Math.round(settings.sensitivity * 100)}%
              </span>
            </div>
            <input
              id="opt-sensitivity"
              type="range"
              min={0.3}
              max={2.5}
              step={0.1}
              value={settings.sensitivity}
              onChange={(e) => onUpdateSettings({ sensitivity: Number(e.target.value) })}
              className="w-full accent-[#4e8c3a] cursor-pointer"
            />
          </div>

          {/* Render Distance */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs font-bold text-[#222]">
              <label htmlFor="opt-render-distance">Distancia de renderizado</label>
              <span className="font-mono-hud tabular-nums">{settings.renderDistance} chunks</span>
            </div>
            <input
              id="opt-render-distance"
              type="range"
              min={3}
              max={7}
              step={1}
              value={settings.renderDistance}
              onChange={(e) => onUpdateSettings({ renderDistance: Number(e.target.value) })}
              className="w-full accent-[#4e8c3a] cursor-pointer"
            />
          </div>

          {/* Master Volume */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs font-bold text-[#222]">
              <label htmlFor="opt-volume">Volumen maestro</label>
              <span className="font-mono-hud tabular-nums">{settings.volume}%</span>
            </div>
            <input
              id="opt-volume"
              type="range"
              min={0}
              max={100}
              step={5}
              value={settings.volume}
              onChange={(e) => onUpdateSettings({ volume: Number(e.target.value) })}
              className="w-full accent-[#4e8c3a] cursor-pointer"
            />
          </div>

          {/* Touch Controls & Graphics Quality */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              data-testid="opt-touch-mode-btn"
              onClick={cycleTouchMode}
              className="mc-button py-2.5 px-3 font-pixel text-[11px] text-white cursor-pointer"
            >
              Táctil: {touchLabel}
            </button>
            <button
              type="button"
              data-testid="opt-graphics-btn"
              onClick={toggleGraphics}
              className="mc-button py-2.5 px-3 font-pixel text-[11px] text-white cursor-pointer"
            >
              Gráficos: {settings.graphicsQuality === 'fancy' ? 'Detallado' : 'Rápido'}
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mc-button-primary w-full py-2.5 font-pixel text-sm text-white cursor-pointer"
        >
          Listo
        </button>
      </div>
    </div>
  );
};
