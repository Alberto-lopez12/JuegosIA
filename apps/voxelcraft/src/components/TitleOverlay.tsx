import React, { useMemo, useState } from 'react';
import { generateRandomSeed } from '../game/noise';
import type {
  CreateWorldConfig,
  Difficulty,
  GameMode,
  GlobalSettings,
  WorldMeta,
  WorldType,
} from '../game/types';
import { OptionsModal } from './OptionsModal';

const SPLASH_PHRASES = [
  '¡100% Procedural!',
  '¡Ahora con Aldeas!',
  '¡Vuela en Creativo!',
  '¡Explora el Mapa!',
  '¡Comercia Esmeraldas!',
  '¡Semillas reales!',
  '¡Tormentas dinámicas!',
];

type MenuScreen = 'title' | 'worlds' | 'create';

interface TitleOverlayProps {
  seedLabel: string;
  worldsList: WorldMeta[];
  settings: GlobalSettings;
  touchControlsActive: boolean;
  onPlayWorld: (id: string) => void;
  onCreateWorld: (config: CreateWorldConfig) => void;
  onDeleteWorld: (id: string) => void;
  onPreviewSeed: (seedInput: string) => { seed: number; label: string } | undefined;
  onUpdateSettings: (partial: Partial<GlobalSettings>) => void;
}

const DIFFICULTY_ORDER: Difficulty[] = ['peaceful', 'easy', 'normal', 'hard'];
const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  peaceful: 'Pacífico',
  easy: 'Fácil',
  normal: 'Normal',
  hard: 'Difícil',
};

const WORLD_TYPE_ORDER: WorldType[] = ['default', 'superflat', 'amplified'];
const WORLD_TYPE_LABELS: Record<WorldType, string> = {
  default: 'Por Defecto',
  superflat: 'Superplano',
  amplified: 'Amplificado',
};

function formatDate(ts: number): string {
  try {
    return new Date(ts).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export const TitleOverlay: React.FC<TitleOverlayProps> = ({
  seedLabel,
  worldsList,
  settings,
  touchControlsActive,
  onPlayWorld,
  onCreateWorld,
  onDeleteWorld,
  onPreviewSeed,
  onUpdateSettings,
}) => {
  const [screen, setScreen] = useState<MenuScreen>('title');
  const [showOptions, setShowOptions] = useState(false);
  const [showControls, setShowControls] = useState(false);

  // World Selector state
  const [selectedWorldId, setSelectedWorldId] = useState<string | null>(
    worldsList[0]?.id ?? null
  );
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Create World form state
  const [worldName, setWorldName] = useState('Nuevo Mundo');
  const [gameMode, setGameMode] = useState<GameMode>('survival');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [worldType, setWorldType] = useState<WorldType>('default');
  const [seedText, setSeedText] = useState(seedLabel);
  const [bonusChest, setBonusChest] = useState(false);

  const splashText = useMemo(() => {
    const idx = Math.floor(Math.random() * SPLASH_PHRASES.length);
    return SPLASH_PHRASES[idx];
  }, []);

  const effectiveSelectedId =
    selectedWorldId && worldsList.some((w) => w.id === selectedWorldId)
      ? selectedWorldId
      : worldsList[0]?.id ?? null;

  const handleOpenCreate = () => {
    setWorldName(`Mundo ${worldsList.length + 1}`);
    setGameMode('survival');
    setDifficulty('normal');
    setWorldType('default');
    setBonusChest(false);
    setSeedText('');
    setConfirmDeleteId(null);
    setScreen('create');
  };

  const handleRandomSeed = () => {
    const rnd = String(generateRandomSeed());
    setSeedText(rnd);
    onPreviewSeed(rnd);
  };

  const handleSubmitCreate = (e: React.FormEvent) => {
    e.preventDefault();
    onCreateWorld({
      name: worldName.trim() || 'Nuevo Mundo',
      gameMode,
      difficulty,
      worldType,
      seedText,
      bonusChest: gameMode === 'survival' ? bonusChest : false,
    });
  };

  return (
    <div className="fixed inset-0 z-20 flex flex-col items-center justify-between px-4 py-5 sm:py-8 pointer-events-none select-none">
      {/* Subtle atmospheric contrast vignette over 3D orbital panorama */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            screen === 'title'
              ? 'radial-gradient(ellipse at center, rgba(0,0,0,0.06) 35%, rgba(6,10,14,0.48) 100%)'
              : 'rgba(8, 11, 15, 0.56)',
        }}
      />

      {/* SCREEN 1: CLASSIC MINECRAFT TITLE SCREEN */}
      {screen === 'title' && (
        <>
          <div className="relative z-10 flex flex-col items-center mt-3 sm:mt-8">
            <div className="relative inline-block">
              <svg
                viewBox="0 0 680 144"
                className="w-[330px] sm:w-[540px] md:w-[600px] max-w-[92vw] h-auto drop-shadow-[0_10px_0_rgba(12,15,12,0.88)]"
                role="img"
                aria-label="VOXELCRAFT"
              >
                <text
                  x="340"
                  y="96"
                  textAnchor="middle"
                  fontFamily="'Silkscreen', monospace"
                  fontSize="68"
                  fontWeight="700"
                  letterSpacing="4"
                  fill="#262925"
                  stroke="#0f120f"
                  strokeWidth="16"
                  paintOrder="stroke fill"
                >
                  VOXELCRAFT
                </text>
                <text
                  x="340"
                  y="88"
                  textAnchor="middle"
                  fontFamily="'Silkscreen', monospace"
                  fontSize="68"
                  fontWeight="700"
                  letterSpacing="4"
                  fill="#7c827b"
                  stroke="#242923"
                  strokeWidth="10"
                  paintOrder="stroke fill"
                >
                  VOXELCRAFT
                </text>
                <text
                  x="340"
                  y="82"
                  textAnchor="middle"
                  fontFamily="'Silkscreen', monospace"
                  fontSize="68"
                  fontWeight="700"
                  letterSpacing="4"
                  fill="#e4e8e1"
                  stroke="#323831"
                  strokeWidth="6"
                  paintOrder="stroke fill"
                >
                  VOXELCRAFT
                </text>
                <rect x="116" y="106" width="448" height="9" fill="#529e38" stroke="#162611" strokeWidth="2.5" />
                <rect x="116" y="115" width="448" height="8" fill="#7c5534" stroke="#162611" strokeWidth="2.5" />
              </svg>

              <div
                data-testid="splash-text"
                className="mc-splash-text absolute -right-2 sm:right-2 bottom-0 sm:bottom-1 font-pixel text-xs sm:text-base md:text-lg text-[#ffff55] whitespace-nowrap pointer-events-none"
              >
                {splashText}
              </div>
            </div>
          </div>

          <div className="relative z-10 w-full max-w-[400px] flex flex-col gap-3 pointer-events-auto my-auto pt-4">
            <button
              type="button"
              data-start="true"
              onClick={() => setScreen('worlds')}
              className="mc-stone-btn w-full py-3.5 px-6 font-pixel text-sm sm:text-base tracking-wider cursor-pointer whitespace-nowrap"
            >
              UN JUGADOR
            </button>

            <button
              type="button"
              onClick={() => setShowOptions(true)}
              className="mc-stone-btn w-full py-3 px-6 font-pixel text-xs sm:text-sm tracking-wide cursor-pointer whitespace-nowrap"
            >
              OPCIONES...
            </button>

            <button
              type="button"
              onClick={() => setShowControls(true)}
              className="mc-stone-btn w-full py-3 px-6 font-pixel text-xs sm:text-sm tracking-wide cursor-pointer whitespace-nowrap"
            >
              CONTROLES Y AYUDA
            </button>
          </div>

          <div className="relative z-10 w-full flex items-end justify-between text-[11px] sm:text-xs font-mono-hud text-white/95 px-1">
            <span style={{ textShadow: '1px 1px 0 #000, 0 2px 4px rgba(0,0,0,0.85)' }}>
              VoxelCraft v2.0
            </span>
            <span
              className="text-right"
              style={{ textShadow: '1px 1px 0 #000, 0 2px 4px rgba(0,0,0,0.85)' }}
            >
              Motor WebGL + Three.js
            </span>
          </div>
        </>
      )}

      {/* SCREEN 2: WORLD SELECTOR ("UN JUGADOR") */}
      {screen === 'worlds' && (
        <div
          className="relative z-10 w-full max-w-2xl h-full max-h-[88vh] flex flex-col pointer-events-auto my-auto bg-[#1b1f23]/92 border-4 border-[#4d5359] shadow-[0_14px_40px_rgba(0,0,0,0.8)]"
          role="region"
          aria-label="Seleccionar Mundo"
          data-testid="world-selector-screen"
        >
          <div className="px-5 py-3.5 border-b-2 border-[#3c4147] text-center bg-[#14171a]">
            <h1 className="font-pixel text-base sm:text-lg text-white tracking-wide">
              Seleccionar Mundo
            </h1>
          </div>

          <div
            className="flex-1 overflow-y-auto p-3 sm:p-4 flex flex-col gap-2"
            style={{ touchAction: 'pan-y' }}
          >
            {worldsList.length === 0 ? (
              <div className="flex-1 min-h-[200px] flex flex-col items-center justify-center text-center gap-3 p-6 border-2 border-dashed border-[#444a50] text-stone-300">
                <p className="font-pixel text-xs sm:text-sm text-white">
                  Aún no tienes mundos guardados
                </p>
                <p className="text-xs text-stone-400 max-w-sm">
                  Crea tu primer mundo en Supervivencia o Creativo con semillas deterministas, aldeas, templos y mapa interactivo.
                </p>
                <button
                  type="button"
                  onClick={handleOpenCreate}
                  className="mc-button-primary px-5 py-2.5 font-pixel text-xs text-white cursor-pointer mt-1"
                >
                  Crear un mundo nuevo
                </button>
              </div>
            ) : (
              worldsList.map((w) => {
                const selected = w.id === effectiveSelectedId;
                const confirmingDelete = confirmDeleteId === w.id;
                return (
                  <div
                    key={w.id}
                    className={`border-2 transition-colors ${
                      selected
                        ? 'bg-[#2a332b] border-[#8ce06e]'
                        : 'bg-[#22262b] border-[#3d4248] hover:border-[#6a7078]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedWorldId(w.id);
                        setConfirmDeleteId(null);
                      }}
                      onDoubleClick={() => onPlayWorld(w.id)}
                      className="w-full text-left px-3.5 py-2.5 flex items-center justify-between gap-3 cursor-pointer"
                    >
                      <div className="min-w-0">
                        <div className="font-pixel text-xs sm:text-sm text-white truncate">
                          {w.name}
                        </div>
                        <div className="text-[11px] font-mono-hud text-stone-300 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span
                            className={
                              w.gameMode === 'creative' ? 'text-sky-300 font-bold' : 'text-emerald-300 font-bold'
                            }
                          >
                            {w.gameMode === 'creative' ? 'Creativo' : 'Supervivencia'}
                          </span>
                          <span>·</span>
                          <span>{DIFFICULTY_LABELS[w.difficulty] ?? w.difficulty}</span>
                          <span>·</span>
                          <span>{WORLD_TYPE_LABELS[w.worldType] ?? 'Por Defecto'}</span>
                          <span>·</span>
                          <span>Día {w.dayCount}</span>
                        </div>
                        <div className="text-[10px] font-mono-hud text-stone-400 mt-0.5">
                          Semilla: {w.seedLabel} · Última vez: {formatDate(w.lastPlayed)}
                        </div>
                      </div>
                      {selected && (
                        <span className="shrink-0 font-pixel text-[10px] text-emerald-300 hidden sm:inline">
                          SELECCIONADO
                        </span>
                      )}
                    </button>

                    {confirmingDelete && (
                      <div className="px-3.5 py-2 bg-[#3b1515] border-t border-rose-500/50 flex flex-wrap items-center justify-between gap-2 text-xs text-rose-100">
                        <span>¿Eliminar &ldquo;{w.name}&rdquo; permanentemente?</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="mc-button px-3 py-1 font-pixel text-[10px] text-white cursor-pointer"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteWorld(w.id);
                              setConfirmDeleteId(null);
                            }}
                            className="px-3 py-1 bg-rose-700 hover:bg-rose-600 border-2 border-rose-300 font-pixel text-[10px] text-white cursor-pointer"
                          >
                            Sí, Eliminar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className="p-3.5 sm:p-4 bg-[#14171a] border-t-2 border-[#3c4147] flex flex-col gap-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                disabled={!effectiveSelectedId}
                onClick={() => effectiveSelectedId && onPlayWorld(effectiveSelectedId)}
                className="mc-stone-btn py-2.5 px-4 font-pixel text-xs cursor-pointer"
              >
                Jugar en el mundo seleccionado
              </button>
              <button
                type="button"
                onClick={handleOpenCreate}
                className="mc-button-primary py-2.5 px-4 font-pixel text-xs text-white cursor-pointer"
              >
                Crear un mundo nuevo
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={!effectiveSelectedId}
                onClick={() => effectiveSelectedId && setConfirmDeleteId(effectiveSelectedId)}
                className="mc-stone-btn py-2 px-4 font-pixel text-xs cursor-pointer"
              >
                Eliminar
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmDeleteId(null);
                  setScreen('title');
                }}
                className="mc-stone-btn py-2 px-4 font-pixel text-xs cursor-pointer"
              >
                Volver
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SCREEN 3: CREATE NEW WORLD */}
      {screen === 'create' && (
        <form
          onSubmit={handleSubmitCreate}
          className="relative z-10 w-full max-w-xl flex flex-col pointer-events-auto my-auto bg-[#1b1f23]/94 border-4 border-[#4d5359] shadow-[0_14px_40px_rgba(0,0,0,0.85)] max-h-[92vh] overflow-y-auto"
          style={{ touchAction: 'pan-y' }}
          aria-label="Crear un Mundo Nuevo"
          data-testid="create-world-screen"
        >
          <div className="px-5 py-3.5 border-b-2 border-[#3c4147] text-center bg-[#14171a]">
            <h1 className="font-pixel text-base sm:text-lg text-white tracking-wide">
              Crear un Mundo Nuevo
            </h1>
          </div>

          <div className="p-4 sm:p-5 flex flex-col gap-3.5 text-white">
            {/* World Name */}
            <div className="flex flex-col gap-1">
              <label htmlFor="create-world-name" className="text-xs font-mono-hud text-stone-300">
                Nombre del Mundo
              </label>
              <input
                id="create-world-name"
                type="text"
                maxLength={32}
                value={worldName}
                onChange={(e) => setWorldName(e.target.value)}
                placeholder="Nuevo Mundo"
                className="px-3 py-2 bg-[#101316] border-2 border-[#4d5359] text-sm font-mono-hud text-white focus:outline-none focus:border-[#ffff80]"
              />
            </div>

            {/* Mode & Difficulty */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                data-testid="create-mode-btn"
                onClick={() => setGameMode((m) => (m === 'survival' ? 'creative' : 'survival'))}
                className="mc-stone-btn py-2.5 px-3 font-pixel text-[11px] cursor-pointer"
              >
                Modo: {gameMode === 'survival' ? 'Supervivencia' : 'Creativo'}
              </button>

              <button
                type="button"
                data-testid="create-difficulty-btn"
                onClick={() =>
                  setDifficulty((d) => DIFFICULTY_ORDER[(DIFFICULTY_ORDER.indexOf(d) + 1) % DIFFICULTY_ORDER.length])
                }
                className="mc-stone-btn py-2.5 px-3 font-pixel text-[11px] cursor-pointer"
              >
                Dificultad: {DIFFICULTY_LABELS[difficulty]}
              </button>
            </div>

            {/* World Type & Bonus Chest */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                data-testid="create-worldtype-btn"
                onClick={() =>
                  setWorldType((t) => WORLD_TYPE_ORDER[(WORLD_TYPE_ORDER.indexOf(t) + 1) % WORLD_TYPE_ORDER.length])
                }
                className="mc-stone-btn py-2.5 px-3 font-pixel text-[11px] cursor-pointer"
              >
                Tipo: {WORLD_TYPE_LABELS[worldType]}
              </button>

              <button
                type="button"
                data-testid="create-bonuschest-btn"
                disabled={gameMode === 'creative'}
                onClick={() => setBonusChest((b) => !b)}
                className="mc-stone-btn py-2.5 px-3 font-pixel text-[11px] cursor-pointer"
              >
                Cofre Inicial: {gameMode === 'creative' ? 'No' : bonusChest ? 'Sí' : 'No'}
              </button>
            </div>

            {/* Seed Input + Random Dice Button */}
            <div className="flex flex-col gap-1">
              <label htmlFor="create-world-seed" className="text-xs font-mono-hud text-stone-300">
                Semilla del Mundo (texto o número, vacío = aleatoria)
              </label>
              <div className="flex items-stretch gap-2">
                <input
                  id="create-world-seed"
                  type="text"
                  value={seedText}
                  onChange={(e) => setSeedText(e.target.value)}
                  placeholder="Ej: españa, 42073 o vacío..."
                  className="flex-1 min-w-0 px-3 py-2 bg-[#101316] border-2 border-[#4d5359] text-sm font-mono-hud text-white placeholder:text-stone-500 focus:outline-none focus:border-[#ffff80]"
                />
                <button
                  type="button"
                  onClick={handleRandomSeed}
                  aria-label="Generar semilla aleatoria"
                  className="mc-stone-btn px-3 py-2 font-pixel text-xs cursor-pointer shrink-0"
                >
                  🎲 Azar
                </button>
              </div>
            </div>

            <div className="text-[11px] font-mono-hud text-stone-300 bg-[#121619] border border-[#32383e] px-3 py-2 leading-relaxed">
              {gameMode === 'creative'
                ? 'Creativo: invulnerable, vuelo libre (doble Espacio), rotura instantánea y catálogo infinito con E.'
                : 'Supervivencia: inventario vacío, recolección, crafteo, aldeas con comercio, camas y clima dinámico.'}
            </div>
          </div>

          <div className="p-4 bg-[#14171a] border-t-2 border-[#3c4147] grid grid-cols-2 gap-2.5">
            <button
              type="submit"
              data-testid="confirm-create-world-btn"
              className="mc-button-primary py-2.5 px-4 font-pixel text-xs text-white cursor-pointer"
            >
              Crear Mundo Nuevo
            </button>
            <button
              type="button"
              onClick={() => setScreen('worlds')}
              className="mc-stone-btn py-2.5 px-4 font-pixel text-xs cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* OPTIONS MODAL */}
      {showOptions && (
        <OptionsModal
          settings={settings}
          touchControlsActive={touchControlsActive}
          onUpdateSettings={onUpdateSettings}
          onClose={() => setShowOptions(false)}
        />
      )}

      {/* CONTROLS & HELP MODAL */}
      {showControls && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4 pointer-events-auto"
          role="dialog"
          aria-modal="true"
          aria-label="Controles y Ayuda de VoxelCraft"
          onClick={() => setShowControls(false)}
        >
          <div
            className="mc-panel w-full max-w-lg max-h-[85vh] overflow-y-auto p-5 text-[#222222] flex flex-col gap-4"
            style={{ touchAction: 'pan-y' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b-2 border-[#8c8c8c] pb-2">
              <h2 className="font-pixel text-base tracking-tight">Controles y Ayuda</h2>
              <button
                type="button"
                onClick={() => setShowControls(false)}
                className="mc-button px-3 py-1 font-pixel text-xs text-white cursor-pointer"
              >
                Cerrar
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
              <div className="bg-[#b2b2b2] p-3 border border-[#7c7c7c] flex flex-col gap-1.5">
                <h3 className="font-pixel text-xs text-[#1f1f1f] mb-1">PC (Teclado y Ratón)</h3>
                <div className="flex justify-between gap-2"><span>Moverse</span><span className="font-mono-hud font-bold">W A S D</span></div>
                <div className="flex justify-between gap-2"><span>Saltar / Volar (×2)</span><span className="font-mono-hud font-bold">Espacio</span></div>
                <div className="flex justify-between gap-2"><span>Correr / Bajar vuelo</span><span className="font-mono-hud font-bold">Shift / C</span></div>
                <div className="flex justify-between gap-2"><span>Picar / Atacar</span><span className="font-mono-hud font-bold">Clic Izq</span></div>
                <div className="flex justify-between gap-2"><span>Usar / Comerciar / Cama</span><span className="font-mono-hud font-bold">Clic Der</span></div>
                <div className="flex justify-between gap-2"><span>Copiar Bloque (Creativo)</span><span className="font-mono-hud font-bold">Clic Central</span></div>
                <div className="flex justify-between gap-2"><span>Inventario / Catálogo</span><span className="font-mono-hud font-bold">E</span></div>
                <div className="flex justify-between gap-2"><span>Mapa Completo</span><span className="font-mono-hud font-bold">M</span></div>
                <div className="flex justify-between gap-2"><span>Debug / 3ª Pers. / Pausa</span><span className="font-mono-hud font-bold">F3 / F5 / Esc</span></div>
              </div>

              <div className="bg-[#b2b2b2] p-3 border border-[#7c7c7c] flex flex-col gap-1.5">
                <h3 className="font-pixel text-xs text-[#1f1f1f] mb-1">Móvil y Consejos</h3>
                <div className="flex justify-between gap-2"><span>Caminar / Correr</span><span className="font-mono-hud font-bold">Joystick Izq</span></div>
                <div className="flex justify-between gap-2"><span>Cámara</span><span className="font-mono-hud font-bold">Deslizar Der</span></div>
                <div className="flex justify-between gap-2"><span>Vuelo Creativo</span><span className="font-mono-hud font-bold">Volar + Subir/Bajar</span></div>
                <div className="flex justify-between gap-2"><span>Mapa y Marcadores</span><span className="font-mono-hud font-bold">Botón Mapa (M)</span></div>
                <p className="text-[11px] text-[#303030] mt-1.5 leading-snug">
                  Explora cerca del origen para descubrir Aldeas (comercia con Aldeanos con clic derecho), Pirámides del Desierto y Torres de Vigilancia con cofres de tesoro.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
