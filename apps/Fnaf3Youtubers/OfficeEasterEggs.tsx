import React, { useState } from 'react';
import { StreamerImageId } from '../data/fnafMapData';
import { StreamerFaceOnlyAvatar } from './YoutuberSprites';

/**
 * 1. FREDDY POSTER IN THE OFFICE (CLICKABLE NOSE EASTER EGG!)
 * Plays the user's attached MP3 `/assets/aistudio/fnaf-12-3-freddys-nose-sound_4aa767d6.mp3`
 * whenever the player clicks on Freddy's nose!
 */
export const FreddyOfficePoster: React.FC<{ onHonkNose: () => void }> = ({ onHonkNose }) => {
  const [honkEffect, setHonkEffect] = useState<boolean>(false);
  const [honkCount, setHonkCount] = useState<number>(0);

  const handleNoseClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onHonkNose();
    setHonkCount((c) => c + 1);
    setHonkEffect(true);
    setTimeout(() => setHonkEffect(false), 260);
  };

  return (
    <div
      onClick={handleNoseClick}
      title="¡Pulsa la nariz de Freddy!"
      className="relative w-[155px] h-[215px] bg-[#0e150b] border-4 border-[#324a24] hover:border-amber-400 shadow-[0_6px_25px_rgba(0,0,0,0.85)] p-2 flex flex-col items-center justify-between select-none cursor-pointer group"
    >
      {/* Scotch Tape at top corners */}
      <div className="absolute -top-2 -left-2 w-7 h-3 bg-amber-200/30 -rotate-12 pointer-events-none" />
      <div className="absolute -top-2 -right-2 w-7 h-3 bg-amber-200/30 rotate-12 pointer-events-none" />

      {/* Poster Title Header */}
      <div className="text-center leading-none">
        <div className="text-lg font-crt font-bold text-amber-400 tracking-wider">
          ANDORRA FRIGHT!
        </div>
        <div className="text-xs font-crt text-[#8fb873]">CELEBRATE 0% IRPF</div>
      </div>

      {/* Freddy Fazbear Illustration with Interactive Nose */}
      <svg viewBox="0 0 140 140" className="w-32 h-32 overflow-visible">
        {/* Freddy Top Hat */}
        <rect x="46" y="6" width="48" height="8" rx="2" fill="#18181b" stroke="#52525b" strokeWidth="1.5" />
        <rect x="54" y="-14" width="32" height="22" rx="2" fill="#18181b" stroke="#52525b" strokeWidth="1.5" />

        {/* Bear Ears */}
        <circle cx="32" cy="32" r="14" fill="#78350f" stroke="#271206" strokeWidth="3" />
        <circle cx="32" cy="32" r="7" fill="#451a03" />
        <circle cx="108" cy="32" r="14" fill="#78350f" stroke="#271206" strokeWidth="3" />
        <circle cx="108" cy="32" r="7" fill="#451a03" />

        {/* Freddy Head */}
        <rect x="28" y="24" width="84" height="78" rx="28" fill="#78350f" stroke="#271206" strokeWidth="3" />

        {/* Eyebrows */}
        <path d="M40 42 L60 45" stroke="#09090b" strokeWidth="4" strokeLinecap="round" />
        <path d="M100 42 L80 45" stroke="#09090b" strokeWidth="4" strokeLinecap="round" />

        {/* Eyes */}
        <circle cx="50" cy="56" r="9" fill="#09090b" />
        <circle cx="50" cy="56" r="4" fill="#38bdf8" />
        <circle cx="90" cy="56" r="9" fill="#09090b" />
        <circle cx="90" cy="56" r="4" fill="#38bdf8" />

        {/* Tan Muzzle / Snout */}
        <ellipse cx="70" cy="78" rx="28" ry="18" fill="#b45309" stroke="#271206" strokeWidth="2.5" />
        <circle cx="52" cy="78" r="2" fill="#271206" />
        <circle cx="56" cy="83" r="2" fill="#271206" />
        <circle cx="88" cy="78" r="2" fill="#271206" />
        <circle cx="84" cy="83" r="2" fill="#271206" />

        {/* Freddy Bowtie & Jaw */}
        <rect x="52" y="98" width="36" height="12" rx="3" fill="#1c1917" />
        <rect x="56" y="102" width="6" height="5" fill="#e7e5e4" />
        <rect x="64" y="102" width="6" height="5" fill="#e7e5e4" />
        <rect x="72" y="102" width="6" height="5" fill="#e7e5e4" />
        <polygon points="70,115 54,108 54,122" fill="#dc2626" />
        <polygon points="70,115 86,108 86,122" fill="#dc2626" />
        <circle cx="70" cy="115" r="4" fill="#991b1b" />

        {/* CLICKABLE FREDDY NOSE HOTSPOT! */}
        <g onClick={handleNoseClick} className="cursor-pointer group">
          <circle cx="70" cy="70" r="22" fill="transparent" />
          <ellipse
            cx="70"
            cy="70"
            rx={honkEffect ? 13 : 10}
            ry={honkEffect ? 9 : 7}
            fill={honkEffect ? '#ef4444' : '#09090b'}
            stroke="#fbbf24"
            strokeWidth={honkEffect ? '2' : '0.8'}
            className="transition-all duration-100 group-hover:scale-110"
          />
          <ellipse cx="67" cy="68" rx="3.5" ry="2" fill="#ffffff" opacity="0.75" />
        </g>

        {honkEffect && (
          <g>
            <text
              x="70"
              y="22"
              textAnchor="middle"
              fill="#facc15"
              fontSize="20"
              fontFamily="VT323, monospace"
              fontWeight="bold"
            >
              ♪ HONK! ♪
            </text>
          </g>
        )}
      </svg>

      <div className="text-center text-xs font-crt text-amber-300/90 leading-none">
        {honkCount > 0 ? `NARIZ PULSADA: ${honkCount}x` : '¡PULSA LA NARIZ DE FREDDY!'}
      </div>
    </div>
  );
};

/**
 * 2. CHILDREN'S DRAWINGS OF STREAMERS ON THE OFFICE WALL
 */
export const ChildrenStreamerDrawings: React.FC<{ onInteract: () => void }> = ({ onInteract }) => {
  const [selectedDrawing, setSelectedDrawing] = useState<string | null>(null);

  const drawings: {
    id: string;
    title: string;
    streamerId: StreamerImageId;
    caption: string;
    rotation: string;
    badge: string;
  }[] = [
    {
      id: 'd1',
      title: 'MI DÍA EN ANDORRA',
      streamerId: 'AURONPLAY',
      caption:
        '«Dibujo de un niño: AuronPlay corriendo con una bolsa de bitcoins mientras el Inspector de Hacienda llora.»',
      rotation: '-rotate-3',
      badge: '0% IRPF',
    },
    {
      id: 'd2',
      title: 'LA CHEPA MÁGICA',
      streamerId: 'RUBIUS_CHEPUDO',
      caption:
        '«Dibujo infantil: El Rubius doblado en ángulo de 90 grados jugando al Rust a las 4 de la mañana.»',
      rotation: 'rotate-2',
      badge: 'CHEPA',
    },
    {
      id: 'd3',
      title: 'EL ABUELO CAM 08',
      streamerId: 'KNEKRO',
      caption:
        '«Dibujo con ceras: KNekro en traje en el pasillo de la CAM 08 listo para taparte toda la pantalla.»',
      rotation: '-rotate-2',
      badge: 'KNEKRO',
    },
  ];

  return (
    <div className="relative flex flex-col gap-2 select-none">
      <div className="flex items-center gap-2">
        {drawings.map((d) => (
          <button
            key={d.id}
            onClick={() => {
              onInteract();
              setSelectedDrawing(d.caption);
              setTimeout(() => setSelectedDrawing(null), 3200);
            }}
            className={`w-24 h-28 bg-[#e7e5e4] text-zinc-900 border-2 border-zinc-400 p-1.5 flex flex-col items-center justify-between shadow-md hover:scale-110 transition-transform cursor-pointer ${d.rotation}`}
          >
            <div className="w-full text-[11px] font-crt font-bold text-red-700 leading-none text-center border-b border-zinc-300 pb-0.5">
              {d.title}
            </div>
            <div className="relative w-14 h-16 overflow-hidden flex items-center justify-center">
              <StreamerFaceOnlyAvatar id={d.streamerId} className="w-full h-full" />
            </div>
            <div className="text-[10px] font-crt text-zinc-700 font-bold text-center leading-none">
              {d.badge}
            </div>
          </button>
        ))}
      </div>

      {selectedDrawing && (
        <div className="absolute -bottom-16 left-0 right-0 z-30 bg-black/95 border border-amber-400 px-2.5 py-1.5 text-xs font-crt text-amber-200 shadow-xl">
          {selectedDrawing}
        </div>
      )}
    </div>
  );
};

/**
 * 3. INTERACTIVE DESK BOBBLEHEAD TOYS WITH MONCLOA-STYLE STREAMER ANIMATRONIC HEADS!
 */
export const DeskBobbleheads: React.FC<{ onBoing: (pitch: number) => void }> = ({ onBoing }) => {
  const [bouncingId, setBouncingId] = useState<string | null>(null);
  const [quoteToast, setQuoteToast] = useState<string | null>(null);

  const bobbles: {
    id: string;
    name: string;
    streamerId: StreamerImageId;
    color: string;
    pitch: number;
    quote: string;
  }[] = [
    {
      id: 'auron_mini',
      name: 'AURON',
      streamerId: 'AURONPLAY',
      color: '#84cc16',
      pitch: 0.9,
      quote: '«¡Abduzcan ese IRPF!»',
    },
    {
      id: 'knekro_mini',
      name: 'KNEKRO',
      streamerId: 'KNEKRO',
      color: '#a855f7',
      pitch: 1.05,
      quote: '«¡Pero esto qué es, chavales! Vigila la CAM 08.»',
    },
    {
      id: 'ibai_mini',
      name: 'IBAI',
      streamerId: 'CHIQUI_IBAI',
      color: '#3b82f6',
      pitch: 1.25,
      quote: '«¡Bueeenas tardes Hacienda!»',
    },
    {
      id: 'ari_mini',
      name: '3,99$',
      streamerId: 'ARIGAMEPLAYS',
      color: '#ec4899',
      pitch: 1.5,
      quote: '«¡3,99$ en la CAM 07!»',
    },
  ];

  const handleClickBobble = (b: typeof bobbles[0]) => {
    onBoing(b.pitch);
    setBouncingId(b.id);
    setQuoteToast(b.quote);
    setTimeout(() => setBouncingId(null), 450);
    setTimeout(() => setQuoteToast(null), 2000);
  };

  return (
    <div className="relative flex flex-col items-center select-none">
      {quoteToast && (
        <div className="absolute -top-9 whitespace-nowrap bg-black/95 border border-lime-400 px-2.5 py-0.5 text-sm font-crt text-lime-300 z-20">
          {quoteToast}
        </div>
      )}
      <div className="flex items-end gap-2 bg-[#0c1309]/95 border-2 border-[#365314] px-2.5 py-2">
        {bobbles.map((b) => {
          const isBouncing = bouncingId === b.id;
          return (
            <button
              key={b.id}
              onClick={() => handleClickBobble(b)}
              className="flex flex-col items-center group cursor-pointer"
              title={`Pulsar figura de ${b.name}`}
            >
              {/* Moncloa-style Cropped Streamer Animatronic Head on a Spring */}
              <div
                className={`w-12 h-14 flex items-center justify-center transition-transform ${
                  isBouncing ? '-translate-y-3 rotate-12 scale-115' : 'group-hover:-translate-y-1'
                }`}
              >
                <StreamerFaceOnlyAvatar
                  id={b.streamerId}
                  className="w-full h-full pointer-events-none drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]"
                />
              </div>
              {/* Spring Neck */}
              <div className="w-2 h-2 border-x border-zinc-400 bg-zinc-700" />
              {/* Pedestal Base */}
              <div className="w-12 h-4 bg-zinc-800 border border-zinc-600 text-[10px] font-crt text-amber-300 leading-none flex items-center justify-center">
                {b.name}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

