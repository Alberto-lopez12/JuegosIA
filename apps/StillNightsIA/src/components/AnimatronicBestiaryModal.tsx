import React, { useEffect, useRef, useState } from 'react';
import {
  AnimatronicId,
  CampaignProgress,
  CustomAILevels,
  getCustomNightAngerState,
  getUnlockedDossiers,
  isCustomNightUnlocked,
  isExtraNightsSectionUnlocked,
  isNight7Unlocked,
} from '../game/rules';
import { drawAnimatronic, drawCustomNightPortrait } from '../game/animatronicsRenderer';
import { soundController } from '../game/audio';

interface CustomPortraitCardProps {
  id: AnimatronicId;
  label: string;
  level: number;
  disabled: boolean;
  onChangeLevel: (nextLevel: number) => void;
}

const CustomNightPortraitCard: React.FC<CustomPortraitCardProps> = ({
  id,
  label,
  level,
  disabled,
  onChangeLevel,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const levelRef = useRef<number>(level);
  levelRef.current = level;

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const render = (now: number) => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          drawCustomNightPortrait(
            ctx,
            id,
            canvas.width,
            canvas.height,
            levelRef.current,
            (now - start) / 1000
          );
        }
      }
      raf = requestAnimationFrame(render);
    };
    render(start);
    return () => cancelAnimationFrame(raf);
  }, [id, level]);

  const anger = getCustomNightAngerState(level);
  const borderClass =
    level >= 15
      ? 'border-red-600/80 shadow-[0_0_18px_rgba(220,38,38,0.25)]'
      : level >= 7
      ? 'border-amber-700/70'
      : 'border-amber-950/60';

  return (
    <div
      data-testid={`custom-night-card-${id}`}
      data-anger-mood={anger.moodLabel}
      className={`bg-[#0b0605]/95 border ${borderClass} rounded-xl p-2.5 flex flex-col items-center justify-between gap-2 transition-colors`}
    >
      {/* Portrait Frame with Animatronic Face (no mood text badge) */}
      <div className="relative w-full aspect-[16/15] rounded-lg overflow-hidden border border-zinc-800/90 bg-zinc-950">
        <canvas
          ref={canvasRef}
          width={160}
          height={150}
          className="w-full h-full block object-cover"
        />
      </div>

      {/* Animatronic Name */}
      <div className="text-sm font-bold font-['Barlow_Condensed'] uppercase tracking-wider text-amber-100 text-center truncate w-full">
        {label}
      </div>

      {/* FNAF-Style Counter: ◀ [ 0 .. 20 ] ▶ */}
      <div className="w-full flex items-center justify-between bg-[#140a07] border border-amber-950/80 rounded-lg p-1">
        <button
          type="button"
          data-testid={`ai-dec-${id}`}
          aria-label={`Bajar IA de ${label}`}
          disabled={disabled || level <= 0}
          onClick={() => {
            if (disabled) return;
            soundController.playWoodClick();
            onChangeLevel(Math.max(0, level - 1));
          }}
          className="w-8 h-8 flex items-center justify-center rounded bg-zinc-900 hover:bg-red-950/80 text-amber-200 hover:text-white border border-amber-900/40 font-mono font-bold text-sm transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
        >
          ◀
        </button>

        <span
          data-testid={`ai-val-${id}`}
          className={`font-mono font-black text-xl tabular-nums ${
            level === 0
              ? 'text-zinc-500'
              : level < 12
              ? 'text-amber-400'
              : 'text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.6)]'
          }`}
        >
          {level}
        </span>

        <button
          type="button"
          data-testid={`ai-inc-${id}`}
          aria-label={`Subir IA de ${label}`}
          disabled={disabled || level >= 20}
          onClick={() => {
            if (disabled) return;
            soundController.playWoodClick();
            onChangeLevel(Math.min(20, level + 1));
          }}
          className="w-8 h-8 flex items-center justify-center rounded bg-zinc-900 hover:bg-red-950/80 text-amber-200 hover:text-white border border-amber-900/40 font-mono font-bold text-sm transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
        >
          ▶
        </button>
      </div>
    </div>
  );
};

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
    activeNights: 'Noche 1 a 4 · Noches 6 y 7 · Noche 8 (Custom)',
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
    activeNights: 'Noche 2 a 4 · Noches 6 y 7 · Noche 8 (Custom)',
    originRoom: 'CAM 1A — Sala Principal de Animatrónicos',
    attackVectors: 'Puerta Izquierda [A]',
    anatomyNotes: [
      'Pierna del endoesqueleto totalmente expuesta con pistones, tibia metálica y rótula descubierta.',
      'Cables sueltos de cobre y alta tensión que cuelgan y se enredan desde su brazo mecánico dañado.',
      'Guitarra eléctrica en V destrozada, con el cuerpo astillado y cuerdas reventadas.',
    ],
    behaviorSummary:
      'Despierta en la Noche 2 desde las 12:00 AM junto a Still Freddy. Abandona el Escenario para merodear por el Comedor, la Sala de Mantenimiento y el Pasillo Oeste hasta apostarse frente a la Puerta Izquierda de la oficina.',
  },
  {
    id: 'chica',
    name: 'Still Chica',
    requiredNightToUnlock: 3,
    classification: 'Variante de Mantenimiento',
    activeNights: 'Noche 2 a 4 · Noches 6 y 7 · Noche 8 (Custom)',
    originRoom: 'CAM 5 — Sala de Mantenimiento',
    attackVectors: 'Puerta Derecha [D]',
    anatomyNotes: [
      'Pico completamente arrancado, revelando la cavidad bucal oscura y dentadura del endoesqueleto.',
      'Cupcake medio destruido en su bandeja, con glaseado partido y un ojo colgando de un resorte.',
      'Dientes afilados que sobresalen directamente de una abertura articulada en la parte baja del abdomen.',
      'Falta total del brazo derecho, dejando un muñón mecánico con cables colgantes.',
    ],
    behaviorSummary:
      'Permanece inactiva en la Sala de Mantenimiento hasta que dan las 3:00 AM de la Noche 2. A partir de esa hora comienza a deambular por el Comedor y la zona de los Baños, avanzando de forma implacable por el Pasillo Este para atacar por la Puerta Derecha.',
  },
  {
    id: 'nightmare',
    name: 'Still Nightmare',
    requiredNightToUnlock: 3,
    classification: 'Variante Demacrada · Baños',
    activeNights: 'Noche 3 y 4 · Noches 6 y 7 · Noche 8 (Custom)',
    originRoom: 'CAM 03 — Baño de Hombres (WC · M)',
    attackVectors: 'Puerta Derecha [D] (Ruta Corta) · Puerta Izquierda [A] (Ruta Larga)',
    anatomyNotes: [
      'Pajarita dorada a medio destruir con el ala derecha desgarrada.',
      'Agujero central en la parte frontal del torso que deja ver las costillas y núcleo del endoesqueleto.',
      'Piernas con carcasa semitransparente oscura que permite distinguir la estructura metálica interna.',
      'No entra en conductos ni se ve en el pasillo desde la oficina; solo es visible por las cámaras o desde las luces cuando está a punto de atacar.',
    ],
    behaviorSummary:
      'Acecha desde el interior de los Baños a partir de las 2:00 AM de la Noche 3. Solo puede verse por las cámaras o desde las luces de la oficina cuando ya está a punto de atacar; cuando es bloqueado en la puerta, vuelve a los baños.',
  },
  {
    id: 'blob',
    name: 'The Thing',
    requiredNightToUnlock: 5,
    classification: 'Amalgama [REDACTED] · Entidad Nº [REDACTED]-█▓▒░ · Nivel [REDACTED]',
    activeNights: 'Noche 5 · [REDACTED] · Protocolo █▓▒░',
    originRoom: 'CAM 5 — [REDACTED] / Sector [REDACTED] — Red de [REDACTED]',
    attackVectors: '[REDACTED] · Puerta Izquierda [A] · Puerta Derecha [D] · [REDACTED] · █▓▒░',
    anatomyNotes: [
      'Máscara superior dividida de [REDACTED] ensamblada sobre un cráneo de [REDACTED] que se abre en placas durante [REDACTED].',
      'Cabeza adherida al costado derecho con media cara de [REDACTED] expuesta, cables saliendo del ojo izquierdo y restos de [REDACTED].',
      'Carcasa rosada a la izquierda con ambas cuencas oculares destruidas en el incidente [REDACTED]; registro original: [REDACTED] // █▓▒░.',
      'Piernas metálicas de [REDACTED] y brazos segmentados fusionados a un núcleo de [REDACTED] tras la clausura de [REDACTED].',
      'Señal biométrica y de audio corrompida: [REDACTED] — archivo sobreescrito por [REDACTED] (Error 0x87█▓).',
    ],
    behaviorSummary:
      'Anomalía crítica detectada en el sector [REDACTED]. Durante la Noche 5 el resto de unidades quedan [REDACTED] tras un fallo masivo en [REDACTED] provocado por [REDACTED]. Su origen exacto es [REDACTED] y su patrón de caza en [REDACTED] permite infiltrarse por ambos pasillos y [REDACTED] mientras distorsiona las cámaras con interferencia █▓▒░.',
  },
];

const renderWithRedactedGlitches = (text: string) => {
  const parts = text.split(/(\[REDACTED\]|█▓▒░|█▓)/g);
  return parts.map((part, idx) => {
    if (part === '[REDACTED]' || part === '█▓▒░' || part === '█▓') {
      return (
        <span
          key={idx}
          data-testid="redacted-glitch-token"
          className="inline-block px-1.5 py-0.5 mx-0.5 bg-red-950/90 text-red-400 border border-red-500/60 font-mono text-xs font-black tracking-wider uppercase shadow-[2px_0_0_rgba(56,189,248,0.65),-2px_0_0_rgba(239,68,68,0.85)] animate-pulse"
        >
          {part}
        </span>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
};

const renderBurnedWoodButtonTexture = () => (
  <svg
    viewBox="0 0 440 64"
    preserveAspectRatio="none"
    className="absolute inset-0 w-full h-full pointer-events-none"
    aria-hidden="true"
  >
    <rect x="0" y="0" width="440" height="21" fill="#1f0d07" />
    <rect x="0" y="21" width="440" height="22" fill="#160905" />
    <rect x="0" y="43" width="440" height="21" fill="#1b0b06" />
    <path
      d="M0 6 Q 90 2, 190 8 T 440 5 M0 15 Q 110 19, 240 12 T 440 16 M0 28 Q 120 24, 260 31 T 440 27 M0 37 Q 95 41, 210 34 T 440 38 M0 50 Q 130 46, 280 53 T 440 49 M0 58 Q 100 62, 230 55 T 440 59"
      stroke="#3d190c"
      strokeWidth="2"
      fill="none"
      opacity="0.85"
    />
    <line x1="0" y1="21" x2="440" y2="21" stroke="#070302" strokeWidth="2.2" />
    <line x1="0" y1="43" x2="440" y2="43" stroke="#070302" strokeWidth="2.2" />
    <circle cx="12" cy="11" r="2.5" fill="#0c0a09" stroke="#44403c" strokeWidth="1" />
    <circle cx="12" cy="53" r="2.5" fill="#0c0a09" stroke="#44403c" strokeWidth="1" />
    <circle cx="428" cy="11" r="2.5" fill="#0c0a09" stroke="#44403c" strokeWidth="1" />
    <circle cx="428" cy="53" r="2.5" fill="#0c0a09" stroke="#44403c" strokeWidth="1" />
  </svg>
);

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
            const isBlob = profile.id === 'blob';
            const blobGlitch = isBlob
              ? 0.55 + Math.abs(Math.sin(t * 28)) * 0.45
              : 0;
            drawAnimatronic(
              ctx,
              profile.id,
              canvas.width / 2 + (isBlob ? Math.sin(t * 95) * 4.5 : 0),
              canvas.height * 0.55 + (isBlob ? Math.cos(t * 82) * 3 : 0),
              previewJumpscare ? 1.48 : 1.35,
              t,
              previewJumpscare,
              previewJumpscare ? 1 : blobGlitch,
              jsElapsed
            );

            if (isBlob) {
              // Extra heavy signal corruption, horizontal slice tearing & [REDACTED] interference for The Thing
              for (let b = 0; b < 5; b++) {
                const barY = ((t * 190 + b * 67) % canvas.height);
                const barH = 3 + (b % 3) * 3;
                ctx.fillStyle =
                  b % 2 === 0
                    ? 'rgba(239, 68, 68, 0.32)'
                    : 'rgba(56, 189, 248, 0.26)';
                ctx.fillRect(0, barY, canvas.width, barH);
              }
              if (Math.floor(t * 14) % 3 === 0) {
                ctx.fillStyle = 'rgba(239, 68, 68, 0.88)';
                ctx.font = 'bold 11px "IBM Plex Mono", monospace';
                ctx.textAlign = 'left';
                ctx.fillText(
                  'ERR // [REDACTED] 0x87█▓▒░',
                  14 + (Math.sin(t * 60) * 6),
                  24 + ((Math.floor(t * 9) * 37) % (canvas.height - 40))
                );
              }
            }
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

  const fLevel = customAI.freddy ?? 0;
  const bLevel = customAI.bonnie ?? 0;
  const cLevel = customAI.chica ?? 0;
  const nLevel = customAI.nightmare ?? 0;
  const tLevel = customAI.blob ?? 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Menú de Extras"
    >
      <div className="w-full max-w-5xl bg-gradient-to-b from-[#130906] via-[#0b0706] to-[#070505] border-2 border-amber-900/50 rounded-xl overflow-hidden shadow-[0_24px_70px_rgba(0,0,0,0.95)] flex flex-col max-h-[92vh]">
        {/* Header: Only "EXTRAS" title + Large Wide Buttons filling the remaining horizontal space */}
        <div className="flex flex-wrap items-center justify-between gap-5 px-6 py-4 border-b border-amber-900/40 bg-[#180b07]/85">
          <h2
            data-testid="extras-modal-title"
            className="text-4xl sm:text-5xl font-black tracking-wider text-amber-100 uppercase font-['Barlow_Condensed'] shrink-0"
          >
            EXTRAS
          </h2>

          <div className="flex-1 flex items-center gap-3 min-w-[280px]">
            {extraNightsVisible && (
              <button
                type="button"
                data-testid="extras-tab-nights"
                onClick={() => {
                  setActiveTab('NIGHTS');
                  soundController.playWoodClick();
                }}
                className={`flex-1 py-3.5 px-5 text-sm sm:text-base font-mono font-bold uppercase tracking-wider rounded-lg border transition-colors whitespace-nowrap cursor-pointer text-center ${
                  effectiveTab === 'NIGHTS'
                    ? 'bg-red-800 text-amber-100 border-amber-500/60 shadow-md'
                    : 'bg-[#120906] text-zinc-300 border-amber-950/80 hover:border-amber-700/50'
                }`}
              >
                Noches Adicionales
              </button>
            )}
            <button
              type="button"
              data-testid="extras-tab-dossiers"
              onClick={() => {
                setActiveTab('DOSSIERS');
                soundController.playWoodClick();
              }}
              className={`flex-1 py-3.5 px-5 text-sm sm:text-base font-mono font-bold uppercase tracking-wider rounded-lg border transition-colors whitespace-nowrap cursor-pointer text-center ${
                effectiveTab === 'DOSSIERS'
                  ? 'bg-red-800 text-amber-100 border-amber-500/60 shadow-md'
                  : 'bg-[#120906] text-zinc-300 border-amber-950/80 hover:border-amber-700/50'
              }`}
            >
              Expedientes
            </button>
            <button
              type="button"
              onClick={() => {
                soundController.playWoodClick();
                onClose();
              }}
              className="py-3.5 px-7 text-sm sm:text-base font-mono font-bold uppercase tracking-wider text-amber-200 bg-[#22100a] hover:bg-[#2f160e] border border-amber-800/50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Volver
            </button>
          </div>
        </div>

        {/* TAB 1: EXTRA NIGHTS (NO MECHANICS EXPLANATIONS + FACE COUNTER CUSTOM NIGHT STARTING AT 0) */}
        {extraNightsVisible && effectiveTab === 'NIGHTS' && (
          <div className="p-6 overflow-y-auto space-y-6">
            {/* Night 6 & Night 7 Clean Cards (No mechanics spoilers/explanations) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Night 6 Card */}
              <div className="bg-[#140a07]/90 border border-amber-900/45 rounded-xl p-5 flex items-center justify-between gap-4 shadow-lg">
                <div>
                  <div className="text-[11px] font-mono uppercase tracking-widest text-amber-400">
                    NOCHE ADICIONAL · DESBLOQUEADA
                  </div>
                  <h3 className="text-3xl font-bold text-amber-50 font-['Barlow_Condensed'] uppercase tracking-wider mt-0.5">
                    Noche 6
                  </h3>
                </div>
                <button
                  type="button"
                  data-testid="play-night-6-btn"
                  onClick={() => onLaunchExtraNight(6)}
                  className="py-3 px-6 text-sm font-bold uppercase tracking-wider bg-red-800 hover:bg-red-700 text-amber-50 border border-amber-500/40 rounded-lg transition-colors cursor-pointer shrink-0"
                >
                  Iniciar Noche 6
                </button>
              </div>

              {/* Night 7 Card */}
              <div
                className={`border rounded-xl p-5 flex items-center justify-between gap-4 shadow-lg ${
                  night7Unlocked
                    ? 'bg-[#140a07]/90 border-amber-900/45'
                    : 'bg-[#0a0605]/80 border-zinc-800/70 opacity-75'
                }`}
              >
                <div>
                  <div className="text-[11px] font-mono uppercase tracking-widest text-red-400">
                    {night7Unlocked ? 'MODO PESADILLA · DESBLOQUEADA' : 'BLOQUEADA'}
                  </div>
                  <h3 className="text-3xl font-bold text-amber-50 font-['Barlow_Condensed'] uppercase tracking-wider mt-0.5">
                    Noche 7
                  </h3>
                </div>
                <button
                  type="button"
                  data-testid="play-night-7-btn"
                  disabled={!night7Unlocked}
                  onClick={() => {
                    if (night7Unlocked) onLaunchExtraNight(7);
                  }}
                  className={`py-3 px-6 text-sm font-bold uppercase tracking-wider rounded-lg transition-colors shrink-0 ${
                    night7Unlocked
                      ? 'bg-red-800 hover:bg-red-700 text-amber-50 border border-amber-500/40 cursor-pointer'
                      : 'bg-zinc-900 text-zinc-500 border border-zinc-800 cursor-not-allowed'
                  }`}
                >
                  {night7Unlocked ? 'Iniciar Noche 7' : 'Bloqueada'}
                </button>
              </div>
            </div>

            {/* Night 8: Custom Night with Animatronic Portrait Counters (0 to 20, getting angrier) */}
            <div
              className={`border rounded-xl p-5 space-y-5 shadow-xl ${
                customNightUnlocked
                  ? 'bg-[#120806]/90 border-amber-900/50'
                  : 'bg-[#0a0605]/80 border-zinc-800/70 opacity-75'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-950/70 pb-3.5">
                <div>
                  <div className="text-[11px] font-mono uppercase tracking-widest text-amber-400">
                    {customNightUnlocked ? 'NOCHE PERSONALIZADA' : 'NOCHE PERSONALIZADA · BLOQUEADA'}
                  </div>
                  <h3
                    data-testid="custom-night-heading"
                    className="text-2xl sm:text-3xl font-bold text-amber-50 font-['Barlow_Condensed'] uppercase tracking-wider"
                  >
                    Custom Night
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    data-testid="reset-custom-ai-btn"
                    disabled={!customNightUnlocked}
                    onClick={() => {
                      if (!customNightUnlocked) return;
                      onChangeCustomAI({ freddy: 0, bonnie: 0, chica: 0, nightmare: 0, blob: 0 });
                      soundController.playWoodClick();
                    }}
                    className={`px-3.5 py-2 text-xs font-mono font-bold rounded-lg border transition-colors whitespace-nowrap ${
                      customNightUnlocked
                        ? 'bg-[#1b0d09] hover:bg-[#28130d] text-amber-200 border-amber-800/60 cursor-pointer'
                        : 'bg-zinc-900 text-zinc-600 border-zinc-800 cursor-not-allowed'
                    }`}
                  >
                    Reiniciar (0)
                  </button>
                  <button
                    type="button"
                    data-testid="max-custom-ai-btn"
                    disabled={!customNightUnlocked}
                    onClick={() => {
                      if (!customNightUnlocked) return;
                      onChangeCustomAI({ freddy: 20, bonnie: 20, chica: 20, nightmare: 20, blob: 20 });
                      soundController.playWoodClick();
                    }}
                    className={`px-3.5 py-2 text-xs font-mono font-bold rounded-lg transition-colors whitespace-nowrap ${
                      customNightUnlocked
                        ? 'bg-amber-500 hover:bg-amber-400 text-zinc-950 cursor-pointer'
                        : 'bg-zinc-900 text-zinc-600 border border-zinc-800 cursor-not-allowed'
                    }`}
                  >
                    20/20/20/20
                  </button>
                </div>
              </div>

              {/* 5 Animatronic Face Cards with 0..20 Counters */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
                {(
                  [
                    ['freddy', 'Still Freddy', fLevel],
                    ['bonnie', 'Still Bonnie', bLevel],
                    ['chica', 'Still Chica', cLevel],
                    ['nightmare', 'Still Nightmare', nLevel],
                    ['blob', 'The Thing', tLevel],
                  ] as [AnimatronicId, string, number][]
                ).map(([id, label, level]) => (
                  <CustomNightPortraitCard
                    key={id}
                    id={id}
                    label={label}
                    level={level}
                    disabled={!customNightUnlocked}
                    onChangeLevel={(nextLevel) =>
                      onChangeCustomAI({
                        ...customAI,
                        [id]: nextLevel,
                      })
                    }
                  />
                ))}
              </div>

              <button
                type="button"
                data-testid="play-night-8-btn"
                disabled={!customNightUnlocked}
                onClick={() => {
                  if (customNightUnlocked) onLaunchExtraNight(8);
                }}
                className={`w-full py-3.5 px-5 text-sm font-bold uppercase tracking-widest rounded-lg transition-colors ${
                  customNightUnlocked
                    ? 'bg-red-800 hover:bg-red-700 text-amber-50 border border-amber-500/50 shadow-lg cursor-pointer'
                    : 'bg-zinc-900 text-zinc-500 border border-zinc-800 cursor-not-allowed'
                }`}
              >
                {customNightUnlocked
                  ? `Iniciar Custom Night (${fLevel} / ${bLevel} / ${cLevel} / ${nLevel} / ${tLevel})`
                  : 'Custom Night Bloqueada'}
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: ANIMATRONIC DOSSIERS */}
        {effectiveTab === 'DOSSIERS' && (
          <>
            <div className="flex items-center gap-2 px-6 py-3 bg-[#150a07]/80 border-b border-amber-900/35 overflow-x-auto">
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
                        {renderWithRedactedGlitches(profile.classification)} ·{' '}
                        {renderWithRedactedGlitches(profile.activeNights)}
                      </div>
                      <h3
                        className={`text-3xl font-bold text-white font-['Barlow_Condensed'] tracking-wide mt-1 ${
                          profile.id === 'blob'
                            ? 'drop-shadow-[2px_0_0_rgba(239,68,68,0.9)] translate-x-0.5'
                            : ''
                        }`}
                      >
                        {profile.name}
                        {profile.id === 'blob' && (
                          <span className="ml-3 text-xs font-mono uppercase tracking-widest px-2 py-0.5 rounded bg-red-950/90 text-red-400 border border-red-500/60 align-middle animate-pulse">
                            [ARCHIVO CORRUPTO // █▓▒░]
                          </span>
                        )}
                      </h3>
                      <p className="text-sm text-zinc-300 mt-2 leading-relaxed">
                        {renderWithRedactedGlitches(profile.behaviorSummary)}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-zinc-900/60 border border-zinc-800 rounded-lg p-4">
                      <div>
                        <div className="text-xs text-zinc-400">Punto de Partida</div>
                        <div className="text-sm font-semibold text-zinc-100 mt-0.5">
                          {renderWithRedactedGlitches(profile.originRoom)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-zinc-400">Vectores de Ataque a Oficina</div>
                        <div className="text-sm font-semibold text-amber-400 mt-0.5">
                          {renderWithRedactedGlitches(profile.attackVectors)}
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
                            <span>{renderWithRedactedGlitches(note)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Locked Burned-Wood Aesthetic "REDACTED" Lore Button (present on all animatronics) */}
                    <button
                      type="button"
                      disabled
                      data-testid="dossier-redacted-lore-btn"
                      aria-label="Archivo de Lore Redacted (Bloqueado)"
                      className="relative w-full py-3.5 px-6 rounded-lg overflow-hidden border-2 border-amber-900/50 shadow-[0_6px_20px_rgba(0,0,0,0.85)] flex items-center justify-center gap-3 cursor-not-allowed opacity-90 select-none"
                    >
                      {renderBurnedWoodButtonTexture()}
                      <span className="relative z-10 font-mono font-black text-sm sm:text-base tracking-[0.35em] uppercase text-red-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]">
                        🔒 REDACTED
                      </span>
                    </button>
                  </>
                ) : (
                  <div className="h-full flex flex-col items-start justify-between bg-zinc-900/40 border border-zinc-800 rounded-xl p-6 space-y-4">
                    <div className="space-y-3">
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
                        Orden de desbloqueo: Noche 1 (Still Freddy) · Noche 2 (Still Bonnie) · Noche 3 (Still Chica y Still Nightmare)
                      </div>
                    </div>

                    {/* Locked Burned-Wood Aesthetic "REDACTED" Lore Button */}
                    <button
                      type="button"
                      disabled
                      data-testid="dossier-redacted-lore-btn"
                      aria-label="Archivo de Lore Redacted (Bloqueado)"
                      className="relative w-full py-3.5 px-6 rounded-lg overflow-hidden border-2 border-amber-900/50 shadow-[0_6px_20px_rgba(0,0,0,0.85)] flex items-center justify-center gap-3 cursor-not-allowed opacity-85 select-none"
                    >
                      {renderBurnedWoodButtonTexture()}
                      <span className="relative z-10 font-mono font-black text-sm sm:text-base tracking-[0.35em] uppercase text-red-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]">
                        🔒 REDACTED
                      </span>
                    </button>
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
