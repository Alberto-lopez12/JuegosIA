import React, { useEffect, useRef, useState } from 'react';
import {
  AnimatronicId,
  CampaignProgress,
  CustomAILevels,
  getUnlockedDossiers,
  isCustomNightUnlocked,
  isExtraNightsSectionUnlocked,
  isNight7Unlocked,
} from '../game/rules';
import { drawAnimatronic } from '../game/animatronicsRenderer';
import { soundController } from '../game/audio';

interface AnimatronicProfile {
  id: AnimatronicId;
  name: string;
  requiredNightToUnlock: number;
  classification: string;
  activeNights: string;
  originRoom: string;
  attackVectors: string;
  anatomyNotes: string[];
  behaviorSummary: string;
}

export const ANIMATRONIC_PROFILES: AnimatronicProfile[] = [
  {
    id: 'freddy',
    name: 'Still Freddy',
    requiredNightToUnlock: 1,
    classification: 'Variante Demacrada · Líder Principal',
    activeNights: 'Noche 1 a 4 · Noches 6 y 7 (12AM–3AM) · Noche 8 (Custom)',
    originRoom: 'CAM 1A — Sala Principal (Escenario)',
    attackVectors: 'Puerta Derecha [D] y Conducto Central Superior [W]',
    anatomyNotes: [
      'Ojo izquierdo ausente: cuenca vacía oscura con cables chispeantes expuestos.',
      'Mandíbula superior inexistente: cráneo superior cortado dejando al descubierto dientes metálicos del endoesqueleto.',
      'Partes inferiores demacradas: abdomen, pelvis y piernas desgarradas mostrando costillas hidráulicas.',
    ],
    behaviorSummary:
      'Único animatrónico activo durante la Noche 1. Acecha desde el Escenario hacia el Pasillo Este o se introduce en la red de conductos para atacar por la Puerta Derecha o el Conducto Superior de la oficina.',
  },
  {
    id: 'bonnie',
    name: 'Still Bonnie',
    requiredNightToUnlock: 2,
    classification: 'Variante Realista Deteriorada',
    activeNights: 'Noche 2 (desde 12AM) a 4 · Noches 6 y 7 (12AM–3AM) · Noche 8 (Custom)',
    originRoom: 'CAM 1A — Sala Principal de Animatrónicos',
    attackVectors: 'Puerta Izquierda [A]',
    anatomyNotes: [
      'Pierna del endoesqueleto totalmente expuesta con pistones, tibia metálica y rótula descubierta.',
      'Cables sueltos de cobre y alta tensión que cuelgan y se enredan desde su brazo mecánico dañado.',
      'Guitarra eléctrica en V destrozada, con el cuerpo astillado y cuerdas reventadas.',
    ],
    behaviorSummary:
      'Se activa en la Noche 2 desde las 12:00 AM junto a Still Freddy. Parte de la Sala Principal y avanza hacia la Puerta Izquierda con patrones y probabilidades inspiradas en FNAF 1.',
  },
  {
    id: 'chica',
    name: 'Still Chica',
    requiredNightToUnlock: 3,
    classification: 'Variante de Mantenimiento',
    activeNights: 'Noche 2 (despierta 3AM) · Noches 3 y 4 · Noches 6 y 7 (12AM–3AM)',
    originRoom: 'CAM 5 — Sala de Mantenimiento',
    attackVectors: 'Puerta Derecha [D]',
    anatomyNotes: [
      'Pico completamente arrancado, revelando la cavidad bucal oscura y dentadura del endoesqueleto.',
      'Cupcake medio destruido en su bandeja, con glaseado partido y un ojo colgando de un resorte.',
      'Dientes afilados que sobresalen directamente de una abertura articulada en la parte baja del abdomen.',
      'Falta total del brazo derecho, dejando un muñón mecánico con cables colgantes.',
    ],
    behaviorSummary:
      'En la Noche 2 despierta a las 3:00 AM desde la Sala de Mantenimiento (CAM 5). Cruza el Comedor y la Cocina (CAM 3) y presiona por el Pasillo Este hasta la Puerta Derecha.',
  },
  {
    id: 'nightmare',
    name: 'Still Nightmare',
    requiredNightToUnlock: 3,
    classification: 'Variante Demacrada · Baños',
    activeNights: 'Noche 3 (despierta 2AM) · Noche 4 · Noches 6 y 7 (12AM–3AM) · Noche 8 (Custom)',
    originRoom: 'CAM 03 — Baño de Hombres (WC · M)',
    attackVectors: 'Puerta Derecha [D] (Ruta Corta) · Puerta Izquierda [A] (Ruta Larga)',
    anatomyNotes: [
      'Pajarita dorada a medio destruir con el ala derecha desgarrada.',
      'Agujero central en la parte frontal del torso que deja ver las costillas y núcleo del endoesqueleto.',
      'Piernas con carcasa semitransparente oscura que permite distinguir la estructura metálica interna.',
      'No entra en conductos ni aparece en cámaras de pasillos tras salir del baño; solo es visible con las luces de la oficina.',
    ],
    behaviorSummary:
      'Se activa en la Noche 3 a las 2:00 AM en el baño de hombres (CAM 03) con 4 fases: puerta cerrada, ojo rojo en la oscuridad, mano apoyada asomando la cabeza, y puerta abierta con marcas de garras. Al salir elige entre ir rápido por la Puerta Derecha o tardar un poco más hacia la Puerta Izquierda; al ser bloqueado regresa al estado 2.',
  },
  {
    id: 'blob',
    name: 'The Thing',
    requiredNightToUnlock: 5,
    classification: 'Amalgama Multi-Animatrónico',
    activeNights: 'Noche 5 (En Solitario) · Noches 6 y 7 (3AM–6AM) · Noche 8 (20/20/20/20)',
    originRoom: 'CAM 5 — Sala de Mantenimiento / Red de Conductos',
    attackVectors: 'Puerta Izquierda [A] · Puerta Derecha [D] · Conducto Central [W]',
    anatomyNotes: [
      'Máscara superior dividida de Funtime Freddy que se abre en placas para mostrar el cráneo del endoesqueleto.',
      'Cabeza rediseñada de Balloon Boy a la derecha con media cara de endoesqueleto expuesta, cables saliendo del ojo izquierdo y dientes afilados.',
      'Cabeza rediseñada de Bonnet a la izquierda con ambas cuencas oculares destruidas y boca sin dientes.',
      'Piernas metálicas de Foxy y brazos segmentados de Toy Freddy unidos al torso de cables.',
    ],
    behaviorSummary:
      'Único activo en la Noche 5, y jefe de la fase 3 AM–6 AM en las Noches 6 y 7. Posee un patrón hiper-agresivo capaz de infiltrarse por Puerta Izquierda, Puerta Derecha y el Conducto Central.',
  },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  progress: CampaignProgress;
  customAI: CustomAILevels;
  onChangeCustomAI: (next: CustomAILevels) => void;
  onLaunchExtraNight: (nightNumber: number) => void;
}

export const AnimatronicBestiaryModal: React.FC<Props> = ({
  isOpen,
  onClose,
  progress,
  customAI,
  onChangeCustomAI,
  onLaunchExtraNight,
}) => {
  const extraNightsVisible = isExtraNightsSectionUnlocked(progress.highestNightCompleted);
  const [activeTab, setActiveTab] = useState<'NIGHTS' | 'DOSSIERS'>(() =>
    extraNightsVisible ? 'NIGHTS' : 'DOSSIERS'
  );
  useEffect(() => {
    if (extraNightsVisible) {
      setActiveTab('NIGHTS');
    }
  }, [extraNightsVisible]);
  const [selectedId, setSelectedId] = useState<AnimatronicId>('freddy');
  const [previewJumpscare, setPreviewJumpscare] = useState(false);
  const jumpscareStartRef = useRef<number>(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const unlockedDossiers = getUnlockedDossiers(progress.highestNightCompleted);
  const night7Unlocked = isNight7Unlocked(progress.highestNightCompleted);
  const customNightUnlocked = isCustomNightUnlocked(progress.highestNightCompleted);

  const effectiveTab = extraNightsVisible ? activeTab : 'DOSSIERS';
  const effectiveSelectedId =
    !extraNightsVisible && selectedId === 'blob' ? 'freddy' : selectedId;

  const visibleProfiles = ANIMATRONIC_PROFILES.filter(
    (p) => p.id !== 'blob' || extraNightsVisible
  );

  const profile =
    visibleProfiles.find((p) => p.id === effectiveSelectedId) || visibleProfiles[0];
  const isCurrentProfileUnlocked = unlockedDossiers[profile.id];

  useEffect(() => {
    if (!isOpen || effectiveTab !== 'DOSSIERS') return;
    let animFrame = 0;
    const start = performance.now();

    const loop = (now: number) => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const t = (now - start) / 1000;
          const jsElapsed = previewJumpscare
            ? Math.max(0, (now - jumpscareStartRef.current) / 1000)
            : 0;

          ctx.clearRect(0, 0, canvas.width, canvas.height);

          const grad = ctx.createRadialGradient(
            canvas.width / 2,
            canvas.height * 0.45,
            20,
            canvas.width / 2,
            canvas.height * 0.5,
            220
          );
          grad.addColorStop(
            0,
            previewJumpscare ? 'rgba(153, 27, 27, 0.45)' : 'rgba(63, 63, 70, 0.35)'
          );
          grad.addColorStop(1, 'rgba(9, 9, 11, 0.95)');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          if (isCurrentProfileUnlocked) {
            drawAnimatronic(
              ctx,
              profile.id,
              canvas.width / 2,
              canvas.height * 0.55,
              previewJumpscare ? 1.48 : 1.35,
              t,
              previewJumpscare,
              previewJumpscare ? 1 : 0,
              jsElapsed
            );
          } else {
            ctx.save();
            ctx.filter = 'brightness(0.06) contrast(2)';
            drawAnimatronic(
              ctx,
              profile.id,
              canvas.width / 2,
              canvas.height * 0.55,
              1.35,
              t,
              false
            );
            ctx.restore();

            ctx.fillStyle = '#ef4444';
            ctx.font = 'bold 14px "IBM Plex Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText('ARCHIVO CLASIFICADO / BLOQUEADO', canvas.width / 2, canvas.height / 2);
          }
        }
      }
      animFrame = requestAnimationFrame(loop);
    };

    animFrame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animFrame);
  }, [isOpen, effectiveTab, profile.id, previewJumpscare, isCurrentProfileUnlocked]);

  if (!isOpen) return null;

  const triggerTestJumpscare = () => {
    if (!isCurrentProfileUnlocked) return;
    if ((jumpscareStartRef as React.MutableRefObject<number & { timerId?: number }>).current) {
      const prevTimer = (jumpscareStartRef as unknown as { timerId?: number }).timerId;
      if (prevTimer) window.clearTimeout(prevTimer);
    }
    jumpscareStartRef.current = performance.now();
    setPreviewJumpscare(true);
    if (profile.id === 'nightmare') {
      soundController.playNightmareJumpscare();
    } else {
      soundController.playJumpscare();
    }
    (jumpscareStartRef as unknown as { timerId?: number }).timerId = window.setTimeout(() => {
      setPreviewJumpscare(false);
    }, 2700);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/88 p-4 pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Menú de Extras"
    >
      <div className="w-full max-w-5xl bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-zinc-800 bg-zinc-900/60">
          <div>
            <h2 className="text-2xl font-bold tracking-wide text-zinc-100 uppercase font-['Barlow_Condensed']">
              {extraNightsVisible
                ? 'Extras · Noches Especiales y Expedientes'
                : 'Extras · Expedientes de Animatrónicos'}
            </h2>
            <p className="text-xs text-zinc-400 font-mono">
              {extraNightsVisible
                ? `Noches superadas: ${progress.highestNightCompleted} · Supera Noche 6 para Noche 7, y Noche 7 para Custom Night`
                : `Noches superadas: ${progress.highestNightCompleted} · Desbloquea expedientes al superar las Noches 1, 2 y 3 (Completa la Noche 5 para más)`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {extraNightsVisible && (
              <button
                type="button"
                data-testid="extras-tab-nights"
                onClick={() => {
                  setActiveTab('NIGHTS');
                  soundController.playCameraBlip();
                }}
                className={`px-4 py-2 text-xs font-mono font-bold rounded-lg transition-colors whitespace-nowrap ${
                  effectiveTab === 'NIGHTS'
                    ? 'bg-red-700 text-white'
                    : 'bg-zinc-900 text-zinc-300 border border-zinc-700 hover:bg-zinc-800'
                }`}
              >
                Noches Extra (6, 7 y Custom)
              </button>
            )}
            <button
              type="button"
              data-testid="extras-tab-dossiers"
              onClick={() => {
                setActiveTab('DOSSIERS');
                soundController.playCameraBlip();
              }}
              className={`px-4 py-2 text-xs font-mono font-bold rounded-lg transition-colors whitespace-nowrap ${
                effectiveTab === 'DOSSIERS'
                  ? 'bg-red-700 text-white'
                  : 'bg-zinc-900 text-zinc-300 border border-zinc-700 hover:bg-zinc-800'
              }`}
            >
              Expedientes de Animatrónicos
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-zinc-200 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Cerrar Extras
            </button>
          </div>
        </div>

        {/* TAB 1: EXTRA NIGHTS (SEQUENTIAL UNLOCK: NIGHT 6 -> NIGHT 7 -> NIGHT 8 CUSTOM NIGHT) */}
        {extraNightsVisible && effectiveTab === 'NIGHTS' && (
          <div className="p-6 overflow-y-auto space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Night 6 Card */}
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 flex flex-col justify-between space-y-4">
                <div>
                  <div className="text-xs font-mono text-amber-400">
                    DESBLOQUEADA · DESAFÍO ESTILO FNAF 4
                  </div>
                  <h3 className="text-2xl font-bold text-white font-['Barlow_Condensed'] uppercase tracking-wide mt-1">
                    Noche 6 (Extra)
                  </h3>
                  <p className="text-sm text-zinc-300 mt-2 leading-relaxed">
                    De 12:00 AM a 3:00 AM atacan Still Freddy, Still Bonnie y Still Chica. Al dar las 3:00 AM se desactivan y despierta <strong className="text-red-400">The Thing</strong> hasta las 6:00 AM.
                  </p>
                </div>
                <button
                  type="button"
                  data-testid="play-night-6-btn"
                  onClick={() => onLaunchExtraNight(6)}
                  className="w-full py-3 px-4 text-sm font-bold uppercase tracking-wider bg-red-700 hover:bg-red-600 text-white rounded-lg transition-colors"
                >
                  Jugar Noche 6 (Extra)
                </button>
              </div>

              {/* Night 7 Card (Locked until Night 6 is completed!) */}
              <div
                className={`border rounded-xl p-5 flex flex-col justify-between space-y-4 ${
                  night7Unlocked
                    ? 'bg-zinc-900/60 border-zinc-800'
                    : 'bg-zinc-950/80 border-zinc-800/60 opacity-75'
                }`}
              >
                <div>
                  <div className="text-xs font-mono text-red-400">
                    {night7Unlocked
                      ? 'DESBLOQUEADA · DIFICULTAD EXTREMA'
                      : 'BLOQUEADA · SUPERA LA NOCHE 6 PARA ACCEDER'}
                  </div>
                  <h3 className="text-2xl font-bold text-white font-['Barlow_Condensed'] uppercase tracking-wide mt-1">
                    Noche 7 (Pesadilla)
                  </h3>
                  <p className="text-sm text-zinc-300 mt-2 leading-relaxed">
                    Repite el ciclo partido 12 AM–3 AM (Still Animatronics) y 3 AM–6 AM (The Thing) con niveles de agresividad superiores.
                  </p>
                </div>
                <button
                  type="button"
                  data-testid="play-night-7-btn"
                  disabled={!night7Unlocked}
                  onClick={() => {
                    if (night7Unlocked) onLaunchExtraNight(7);
                  }}
                  className={`w-full py-3 px-4 text-sm font-bold uppercase tracking-wider rounded-lg transition-colors ${
                    night7Unlocked
                      ? 'bg-red-700 hover:bg-red-600 text-white cursor-pointer'
                      : 'bg-zinc-900 text-zinc-500 border border-zinc-800 cursor-not-allowed'
                  }`}
                >
                  {night7Unlocked
                    ? 'Jugar Noche 7 (Pesadilla)'
                    : 'Noche 7 Bloqueada (Supera la Noche 6)'}
                </button>
              </div>
            </div>

            {/* Night 8: Custom Night & 20/20/20/20 (Locked until Night 7 is completed!) */}
            <div
              className={`border rounded-xl p-5 space-y-4 ${
                customNightUnlocked
                  ? 'bg-zinc-900/50 border-zinc-800'
                  : 'bg-zinc-950/80 border-zinc-800/60 opacity-75'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-mono text-amber-400">
                    {customNightUnlocked
                      ? 'NOCHE 8 · CUSTOM NIGHT DESBLOQUEADA'
                      : 'BLOQUEADA · SUPERA LA NOCHE 7 PARA DESBLOQUEAR CUSTOM NIGHT'}
                  </div>
                  <h3 className="text-2xl font-bold text-white font-['Barlow_Condensed'] uppercase tracking-wide">
                    Configurador de IA &amp; Modo 20/20/20/20
                  </h3>
                </div>
                <button
                  type="button"
                  disabled={!customNightUnlocked}
                  onClick={() => {
                    if (!customNightUnlocked) return;
                    onChangeCustomAI({ freddy: 20, bonnie: 20, chica: 20, nightmare: 20, blob: 20 });
                    soundController.playCameraBlip();
                  }}
                  className={`px-3.5 py-2 text-xs font-mono font-bold rounded-lg transition-colors whitespace-nowrap ${
                    customNightUnlocked
                      ? 'bg-amber-500 hover:bg-amber-400 text-zinc-950 cursor-pointer'
                      : 'bg-zinc-900 text-zinc-600 border border-zinc-800 cursor-not-allowed'
                  }`}
                >
                  Seleccionar 20/20/20/20
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(
                  [
                    ['freddy', 'Still Freddy'],
                    ['bonnie', 'Still Bonnie'],
                    ['chica', 'Still Chica'],
                    ['nightmare', 'Still Nightmare'],
                    ['blob', 'The Thing'],
                  ] as [AnimatronicId, string][]
                ).map(([id, label]) => (
                  <div
                    key={id}
                    className="flex items-center justify-between gap-3 bg-zinc-950/70 border border-zinc-800 rounded-lg p-3"
                  >
                    <label
                      htmlFor={`extras-ai-${id}`}
                      className="text-xs font-mono font-semibold text-zinc-200 w-28 shrink-0"
                    >
                      {label}
                    </label>
                    <input
                      id={`extras-ai-${id}`}
                      type="range"
                      min={0}
                      max={20}
                      disabled={!customNightUnlocked}
                      value={customAI[id] ?? 20}
                      onChange={(e) =>
                        onChangeCustomAI({
                          ...customAI,
                          [id]: Number(e.target.value),
                        })
                      }
                      className="flex-1 accent-red-600 cursor-pointer disabled:cursor-not-allowed"
                    />
                    <span className="text-sm font-mono font-bold text-amber-400 w-8 text-right tabular-nums">
                      {customAI[id] ?? 20}
                    </span>
                  </div>
                ))}
              </div>

              <button
                type="button"
                data-testid="play-night-8-btn"
                disabled={!customNightUnlocked}
                onClick={() => {
                  if (customNightUnlocked) onLaunchExtraNight(8);
                }}
                className={`w-full py-3 px-5 text-sm font-bold uppercase tracking-wider rounded-lg transition-colors ${
                  customNightUnlocked
                    ? 'bg-red-700 hover:bg-red-600 text-white cursor-pointer'
                    : 'bg-zinc-900 text-zinc-500 border border-zinc-800 cursor-not-allowed'
                }`}
              >
                {customNightUnlocked
                  ? `Iniciar Noche 8 (${customAI.freddy}/${customAI.bonnie}/${customAI.chica}/${customAI.nightmare ?? 20}/${customAI.blob})`
                  : 'Custom Night Bloqueada (Supera la Noche 7)'}
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: ANIMATRONIC DOSSIERS */}
        {effectiveTab === 'DOSSIERS' && (
          <>
            <div className="flex items-center gap-2 px-6 py-3 bg-zinc-900/40 border-b border-zinc-800 overflow-x-auto">
              {visibleProfiles.map((item) => {
                const isUnlocked = unlockedDossiers[item.id];
                return (
                  <button
                    key={item.id}
                    type="button"
                    data-testid={`dossier-tab-${item.id}`}
                    onClick={() => {
                      setSelectedId(item.id);
                      soundController.playCameraBlip();
                    }}
                    className={`px-4 py-2 text-xs font-mono font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                      profile.id === item.id
                        ? 'bg-red-700 text-white'
                        : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                    }`}
                  >
                    {item.name} {isUnlocked ? '· DESBLOQUEADO' : `· BLOQUEADO (Noche ${item.requiredNightToUnlock})`}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 overflow-y-auto">
              {/* Left: Live Render Canvas */}
              <div className="lg:col-span-5 flex flex-col items-center justify-between bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
                <canvas
                  ref={canvasRef}
                  width={380}
                  height={340}
                  className="w-full max-w-[380px] h-[320px] rounded border border-zinc-800 bg-zinc-950"
                />
                <div className="w-full flex flex-wrap items-center justify-between gap-2 mt-4">
                  <button
                    type="button"
                    data-testid="test-jumpscare-btn"
                    disabled={!isCurrentProfileUnlocked}
                    onClick={triggerTestJumpscare}
                    className={`flex-1 px-3 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                      isCurrentProfileUnlocked
                        ? 'bg-red-800 hover:bg-red-700 text-white'
                        : 'bg-zinc-900 text-zinc-600 cursor-not-allowed'
                    }`}
                  >
                    Probar Jumpscare
                  </button>
                  <button
                    type="button"
                    disabled={!isCurrentProfileUnlocked}
                    onClick={() =>
                      profile.id === 'nightmare'
                        ? soundController.playNightmareFootsteps(0.95)
                        : soundController.playFootsteps(0.95)
                    }
                    className={`px-3 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                      isCurrentProfileUnlocked
                        ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
                        : 'bg-zinc-900 text-zinc-600 cursor-not-allowed'
                    }`}
                  >
                    Audio Pasos
                  </button>
                  <button
                    type="button"
                    disabled={!isCurrentProfileUnlocked}
                    onClick={() => soundController.playVentCrawl(0.95)}
                    className={`px-3 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                      isCurrentProfileUnlocked
                        ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
                        : 'bg-zinc-900 text-zinc-600 cursor-not-allowed'
                    }`}
                  >
                    Audio Conducto
                  </button>
                </div>
              </div>

              {/* Right: Dossier Details or Locked Notice */}
              <div className="lg:col-span-7 flex flex-col justify-between space-y-4">
                {isCurrentProfileUnlocked ? (
                  <>
                    <div>
                      <div className="text-xs text-red-400 font-mono">
                        {profile.classification} · {profile.activeNights}
                      </div>
                      <h3 className="text-3xl font-bold text-white font-['Barlow_Condensed'] tracking-wide mt-1">
                        {profile.name}
                      </h3>
                      <p className="text-sm text-zinc-300 mt-2 leading-relaxed">
                        {profile.behaviorSummary}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-zinc-900/60 border border-zinc-800 rounded-lg p-4">
                      <div>
                        <div className="text-xs text-zinc-400">Punto de Partida</div>
                        <div className="text-sm font-semibold text-zinc-100 mt-0.5">
                          {profile.originRoom}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-zinc-400">Vectores de Ataque a Oficina</div>
                        <div className="text-sm font-semibold text-amber-400 mt-0.5">
                          {profile.attackVectors}
                        </div>
                      </div>
                    </div>

                    <div className="bg-zinc-900/40 border border-zinc-800 rounded-lg p-4">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                        Características Anatómicas Confirmadas
                      </h4>
                      <ul className="space-y-2 text-sm text-zinc-200">
                        {profile.anatomyNotes.map((note, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-red-500 font-bold">·</span>
                            <span>{note}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                ) : (
                  <div className="h-full flex flex-col items-start justify-center bg-zinc-900/40 border border-zinc-800 rounded-xl p-6 space-y-3">
                    <div className="text-xs font-mono uppercase tracking-widest text-red-500">
                      ACCESO DENEGADO · EXPEDIENTE BLOQUEADO
                    </div>
                    <h3 className="text-3xl font-bold text-zinc-200 font-['Barlow_Condensed'] uppercase">
                      {profile.name} — Clasificado
                    </h3>
                    <p className="text-sm text-zinc-400 leading-relaxed">
                      Para desbloquear el expediente anatómico y técnico de{' '}
                      <strong className="text-zinc-200">{profile.name}</strong>, debes completar la{' '}
                      <strong className="text-amber-400">
                        Noche {profile.requiredNightToUnlock}
                      </strong>{' '}
                      en el modo campaña.
                    </p>
                    <div className="text-xs font-mono text-zinc-500 pt-2">
                      Orden de desbloqueo: Noche 1 (Still Freddy) · Noche 2 (Still Bonnie) · Noche 3 (Still Chica)
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
