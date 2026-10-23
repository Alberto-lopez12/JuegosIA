import React, { useId } from 'react';
import { CharacterId, FACE_CROP_CONFIG } from '../data/fnafMapData';

interface SpriteProps {
  className?: string;
  isJumpscare?: boolean;
  scale?: number;
}

interface MoncloaHeadProps {
  characterId: CharacterId;
  /** Target bounding box for the full head (Upper Mask + Lower Jaw combined) */
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  borderColor: string;
  innerBorderColor?: string;
  eyeColorOuter: string;
  eyeColorInner: string;
  teethStyle?: 'RECT' | 'SHARP_FOXY';
  isFoxyEyepatch?: boolean;
  hasFreddyNose?: boolean;
  hasPuppetTears?: boolean;
  hasRosyCheeks?: boolean;
}

/**
 * CORE ENGINE: "FIVE NIGHTS IN THE MONCLOA" STYLE SPLIT ANIMATRONIC HEAD + JAW
 * Replicates the exact aesthetic of /assets/aistudio/image_d5ecf7a2.png:
 * - Splits the head into an Upper Faceplate (forehead to upper lip) and a Lower Articulated Jaw (mouth/chin).
 * - Maps ONLY the tightly-cropped face coordinates (FACE_CROP_CONFIG) across both pieces (zero background/torso!).
 * - Adds metallic corner rivets, top-center & diagonal cheek seam lines, horizontal CRT scanlines,
 *   concentric glowing animatronic eyes (or Foxy's eyepatch), and robotic teeth along the jaw seam.
 */
export const MoncloaAnimatronicHead: React.FC<MoncloaHeadProps> = ({
  characterId,
  x = 64,
  y = 62,
  width = 132,
  height = 138,
  borderColor,
  innerBorderColor = '#18181b',
  eyeColorOuter,
  eyeColorInner,
  teethStyle = 'RECT',
  isFoxyEyepatch = false,
  hasFreddyNose = false,
  hasPuppetTears = false,
  hasRosyCheeks = false,
}) => {
  const uid = useId();
  const clipId = `moncloa-clip-${uid}`;
  const scanId = `moncloa-scan-${uid}`;

  const crop = FACE_CROP_CONFIG[characterId];

  // Geometry of Upper Mask vs Lower Articulated Jaw (matching image_d5ecf7a2.png proportions)
  const upperX = x;
  const upperY = y;
  const upperW = width;
  const upperH = Math.round(height * 0.66); // ~91px

  const jawGap = 4;
  const jawInset = Math.round(width * 0.09); // slightly narrower jaw like reference
  const jawX = x + jawInset;
  const jawY = upperY + upperH + jawGap;
  const jawW = width - jawInset * 2;
  const jawH = height - upperH - jawGap; // ~43px

  // Compute exact <image> position & size so the normalized face box (cx, cy, cw, ch)
  // fills [x, x + width] x [y, y + height] with zero background visible
  const imgW = width / crop.cw;
  const imgH = height / crop.ch;
  const imgX = x - crop.cx * imgW;
  const imgY = y - crop.cy * imgH;

  // Eye coordinates inside the Upper Mask
  const leftEyeX = x + width * 0.31;
  const rightEyeX = x + width * 0.69;
  const eyeY = y + upperH * 0.49;

  // Teeth coordinates along the bottom edge of the Upper Mask
  const teethY = upperY + upperH - 8;

  return (
    <g>
      <defs>
        {/* Combined ClipPath for Upper Mask + Lower Jaw so the cropped face spans across both pieces */}
        <clipPath id={clipId}>
          <rect x={upperX} y={upperY} width={upperW} height={upperH} rx="22" />
          <rect x={jawX} y={jawY} width={jawW} height={jawH} rx="15" />
        </clipPath>
        {/* Subtle horizontal CRT scanline pattern over the face */}
        <pattern id={scanId} width="8" height="4" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="8" y2="0" stroke="rgba(0,0,0,0.32)" strokeWidth="1.3" />
        </pattern>
      </defs>

      {/* Dark backing behind the split jaw gap */}
      <rect
        x={jawX + 4}
        y={upperY + upperH - 4}
        width={jawW - 8}
        height={jawGap + 10}
        fill="#09090b"
      />

      {/* CROPPED STREAMER FACE SPANNING UPPER MASK + LOWER JAW */}
      <g clipPath={`url(#${clipId})`}>
        <image
          href={crop.src}
          x={imgX}
          y={imgY}
          width={imgW}
          height={imgH}
          preserveAspectRatio="none"
        />
        {/* Scanline overlay inside mask */}
        <rect x={x} y={y} width={width} height={height} fill={`url(#${scanId})`} />
        {/* Very subtle vignette inside mask */}
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          fill="rgba(10, 20, 8, 0.08)"
        />
      </g>

      {/* PUPPET TEAR STREAKS (For KNekro / Phantom Puppet) */}
      {hasPuppetTears && (
        <g opacity="0.85">
          <path
            d={`M${leftEyeX} ${eyeY + 14} L${leftEyeX} ${jawY + jawH - 4}`}
            stroke="#a855f7"
            strokeWidth="5"
          />
          <path
            d={`M${rightEyeX} ${eyeY + 14} L${rightEyeX} ${jawY + jawH - 4}`}
            stroke="#a855f7"
            strokeWidth="5"
          />
        </g>
      )}

      {/* ROSY ANIMATRONIC CHEEKS (For Chiqui-Ibai & KNekro) */}
      {hasRosyCheeks && (
        <g opacity="0.82">
          <circle cx={upperX + 18} cy={eyeY + 20} r="10" fill="#ef4444" />
          <circle cx={upperX + upperW - 18} cy={eyeY + 20} r="10" fill="#ef4444" />
        </g>
      )}

      {/* FOXY FOREHEAD GREEN/YELLOW BAR (For IShowSpeed, matching #1 in image_d5ecf7a2.png) */}
      {isFoxyEyepatch && (
        <rect
          x={upperX + 10}
          y={upperY - 14}
          width={upperW - 20}
          height="14"
          rx="3"
          fill="#14532d"
          stroke="#eab308"
          strokeWidth="3"
        />
      )}

      {/* UPPER FACEPLATE METALLIC CASING BORDER */}
      <rect
        x={upperX}
        y={upperY}
        width={upperW}
        height={upperH}
        rx="22"
        fill="none"
        stroke={innerBorderColor}
        strokeWidth="8"
      />
      <rect
        x={upperX}
        y={upperY}
        width={upperW}
        height={upperH}
        rx="22"
        fill="none"
        stroke={borderColor}
        strokeWidth="5"
      />

      {/* LOWER ARTICULATED JAW CASING BORDER */}
      <rect
        x={jawX}
        y={jawY}
        width={jawW}
        height={jawH}
        rx="15"
        fill="none"
        stroke={innerBorderColor}
        strokeWidth="7"
      />
      <rect
        x={jawX}
        y={jawY}
        width={jawW}
        height={jawH}
        rx="15"
        fill="none"
        stroke={borderColor}
        strokeWidth="4.5"
      />

      {/* MONCLOA-STYLE PANEL SEAM LINES (Top vertical + bottom diagonal cheek seams) */}
      <line
        x1={x + width / 2}
        y1={upperY + 3}
        x2={x + width / 2}
        y2={upperY + 20}
        stroke="#27272a"
        strokeWidth="2.5"
      />
      <line
        x1={upperX + 5}
        y1={upperY + upperH - 12}
        x2={upperX + 22}
        y2={upperY + upperH - 24}
        stroke="#27272a"
        strokeWidth="2.5"
      />
      <line
        x1={upperX + upperW - 5}
        y1={upperY + upperH - 12}
        x2={upperX + upperW - 22}
        y2={upperY + upperH - 24}
        stroke="#27272a"
        strokeWidth="2.5"
      />

      {/* 6 METALLIC RIVETS / SCREWS IN CORNERS (Exact match to reference image_d5ecf7a2.png) */}
      <circle cx={upperX + 11} cy={upperY + 12} r="3.8" fill="#9ca3af" stroke="#18181b" strokeWidth="1" />
      <circle cx={upperX + upperW - 11} cy={upperY + 12} r="3.8" fill="#9ca3af" stroke="#18181b" strokeWidth="1" />
      <circle cx={upperX + 11} cy={upperY + upperH - 10} r="3.8" fill="#9ca3af" stroke="#18181b" strokeWidth="1" />
      <circle cx={upperX + upperW - 11} cy={upperY + upperH - 10} r="3.8" fill="#9ca3af" stroke="#18181b" strokeWidth="1" />
      <circle cx={jawX + 10} cy={jawY + 10} r="3.5" fill="#9ca3af" stroke="#18181b" strokeWidth="1" />
      <circle cx={jawX + jawW - 10} cy={jawY + 10} r="3.5" fill="#9ca3af" stroke="#18181b" strokeWidth="1" />

      {/* FREDDY DARK OVAL NOSE (For El Rubius Chepudo, matching #3 in image_d5ecf7a2.png) */}
      {hasFreddyNose && (
        <ellipse
          cx={x + width / 2}
          cy={eyeY + 22}
          rx="11"
          ry="8.5"
          fill="#271206"
          stroke="#09090b"
          strokeWidth="1.5"
        />
      )}

      {/* ANIMATRONIC EYES OVERLAID ON THE STREAMER'S EYES */}
      {isFoxyEyepatch ? (
        <>
          {/* Foxy Diagonal Eyepatch Strap + Black Patch on Left Eye (matching #1 in image_d5ecf7a2.png) */}
          <line
            x1={upperX + 4}
            y1={upperY + 18}
            x2={leftEyeX + 26}
            y2={eyeY + 10}
            stroke="#09090b"
            strokeWidth="6"
          />
          <circle
            cx={leftEyeX + 4}
            cy={eyeY}
            r="16"
            fill="#09090b"
            stroke="#eab308"
            strokeWidth="2.5"
          />
          {/* Glowing Concentric Animatronic Right Eye */}
          <circle cx={rightEyeX} cy={eyeY} r="15" fill="rgba(15,23,42,0.75)" />
          <circle cx={rightEyeX} cy={eyeY} r="10.5" fill={eyeColorOuter} />
          <circle cx={rightEyeX} cy={eyeY} r="6.5" fill={eyeColorInner} />
          <circle cx={rightEyeX} cy={eyeY} r="3.5" fill="#ffffff" />
        </>
      ) : (
        <>
          {/* Left Concentric Glowing Animatronic Eye */}
          <circle cx={leftEyeX} cy={eyeY} r="16" fill="rgba(15,23,42,0.75)" />
          <circle cx={leftEyeX} cy={eyeY} r="11" fill={eyeColorOuter} />
          <circle cx={leftEyeX} cy={eyeY} r="6.5" fill={eyeColorInner} />
          <circle cx={leftEyeX} cy={eyeY} r="3.5" fill="#ffffff" />

          {/* Right Concentric Glowing Animatronic Eye */}
          <circle cx={rightEyeX} cy={eyeY} r="16" fill="rgba(15,23,42,0.75)" />
          <circle cx={rightEyeX} cy={eyeY} r="11" fill={eyeColorOuter} />
          <circle cx={rightEyeX} cy={eyeY} r="6.5" fill={eyeColorInner} />
          <circle cx={rightEyeX} cy={eyeY} r="3.5" fill="#ffffff" />
        </>
      )}

      {/* ANIMATRONIC TEETH ROW ALONG JAW SEAM */}
      {teethStyle === 'SHARP_FOXY' ? (
        // 7 Sharp Triangular Teeth (matching #1 Foxy in image_d5ecf7a2.png)
        <g>
          {[0, 1, 2, 3, 4, 5, 6].map((idx) => {
            const tx = jawX + 12 + idx * 12;
            const ty = upperY + upperH;
            return (
              <polygon
                key={idx}
                points={`${tx},${ty} ${tx + 5},${ty - 10} ${tx + 10},${ty}`}
                fill="#e5e7eb"
                stroke="#374151"
                strokeWidth="0.8"
              />
            );
          })}
        </g>
      ) : (
        // 5 Two-Tone Rectangular Animatronic Teeth (matching #2, #3, #4 in image_d5ecf7a2.png)
        <g>
          {[0, 1, 2, 3, 4].map((idx) => {
            const tx = jawX + 16 + idx * 15;
            return (
              <g key={idx}>
                <rect x={tx} y={teethY} width="11" height="5" fill="#9ca3af" />
                <rect x={tx} y={teethY + 5} width="11" height="5" fill="#e5e7eb" />
              </g>
            );
          })}
        </g>
      )}
    </g>
  );
};

/**
 * Standalone Moncloa-style Face-Only Head SVG for Desk Bobbleheads, CAM 07 Arcade Screen & Wall Drawings!
 */
export const StreamerFaceOnlyAvatar: React.FC<{
  id: CharacterId;
  className?: string;
}> = ({ id, className = '' }) => {
  const colorMap: Record<
    CharacterId,
    { border: string; eyeOut: string; eyeIn: string; foxy?: boolean; freddy?: boolean; tears?: boolean }
  > = {
    AURONPLAY: { border: '#65a30d', eyeOut: '#4d7c0f', eyeIn: '#a3e635' },
    RUBIUS_CHEPUDO: { border: '#92400e', eyeOut: '#0284c7', eyeIn: '#38bdf8', freddy: true },
    CRISTININI: { border: '#ec4899', eyeOut: '#db2777', eyeIn: '#f472b6' },
    CHIQUI_IBAI: { border: '#2563eb', eyeOut: '#be123c', eyeIn: '#fb7185' },
    ISHOWSPEED: { border: '#b91c1c', eyeOut: '#ca8a04', eyeIn: '#facc15', foxy: true },
    ARIGAMEPLAYS: { border: '#eab308', eyeOut: '#7e22ce', eyeIn: '#c084fc' },
    KNEKRO: { border: '#a3e635', eyeOut: '#6d28d9', eyeIn: '#c4b5fd', tears: true },
  };
  const cfg = colorMap[id];

  return (
    <svg viewBox="48 44 164 168" className={`select-none ${className}`} fill="none">
      <MoncloaAnimatronicHead
        characterId={id}
        x={64}
        y={56}
        width={132}
        height={142}
        borderColor={cfg.border}
        eyeColorOuter={cfg.eyeOut}
        eyeColorInner={cfg.eyeIn}
        teethStyle={cfg.foxy ? 'SHARP_FOXY' : 'RECT'}
        isFoxyEyepatch={cfg.foxy}
        hasFreddyNose={cfg.freddy}
        hasPuppetTears={cfg.tears}
      />
    </svg>
  );
};

/**
 * 1. AURONPLAY AS SPRINGTRAP (Moncloa Face-Only Mask + Withered Bunny Ears & Suit)
 */
export const AuronSpringtrapSprite: React.FC<
  SpriteProps & { pose?: 'standing' | 'vent' | 'window' | 'jumpscare' }
> = ({ className = '', pose = 'standing' }) => {
  return (
    <svg
      viewBox="0 0 260 320"
      className={`select-none drop-shadow-[0_0_22px_rgba(132,204,22,0.65)] ${className}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Left Withered Bunny Ear (Moncloa style double-tone ear) */}
      <rect
        x="74"
        y="8"
        width="30"
        height="58"
        rx="14"
        transform="rotate(-8 74 8)"
        fill="#4d5d27"
        stroke="#65a30d"
        strokeWidth="4"
      />
      <rect
        x="81"
        y="16"
        width="16"
        height="40"
        rx="8"
        transform="rotate(-8 81 16)"
        fill="#84cc16"
        opacity="0.65"
      />

      {/* Right Broken Bunny Ear (Bent in half like Springtrap) */}
      <path
        d="M154 64 L164 18 L196 30 L180 64 Z"
        fill="#4d5d27"
        stroke="#65a30d"
        strokeWidth="4"
      />
      <path d="M170 22 L188 8 L206 18" stroke="#9ca3af" strokeWidth="3" fill="none" />
      <circle cx="188" cy="8" r="4.5" fill="#ef4444" />

      {/* Body / Springtrap Rotten Torso */}
      {pose !== 'vent' && (
        <g>
          <path
            d="M52 204 C52 178, 208 178, 208 204 L224 310 L36 310 Z"
            fill="#1f2416"
            stroke="#65a30d"
            strokeWidth="4"
          />
          <path
            d="M84 210 L176 210 L166 290 L94 290 Z"
            fill="#3b481e"
            stroke="#171c0c"
            strokeWidth="3"
          />
          <path d="M100 228 L160 228" stroke="#71717a" strokeWidth="4" />
          <path d="M104 244 L156 244" stroke="#71717a" strokeWidth="4" />
          <rect
            x="102"
            y="260"
            width="56"
            height="22"
            rx="3"
            fill="#111827"
            stroke="#84cc16"
            strokeWidth="2"
          />
          <text
            x="130"
            y="275"
            textAnchor="middle"
            fill="#a3e635"
            fontSize="13"
            fontFamily="VT323, monospace"
            fontWeight="bold"
          >
            0% IRPF
          </text>
        </g>
      )}

      {/* MONCLOA-STYLE FACE-ONLY HEAD + JAW */}
      <MoncloaAnimatronicHead
        characterId="AURONPLAY"
        x={64}
        y={60}
        width={132}
        height={140}
        borderColor="#65a30d"
        eyeColorOuter="#3f6212"
        eyeColorInner="#a3e635"
        teethStyle="RECT"
      />

      {pose === 'jumpscare' && (
        <text
          x="130"
          y="312"
          textAnchor="middle"
          fill="#ef4444"
          fontSize="24"
          fontFamily="VT323, monospace"
          fontWeight="bold"
        >
          ¡ABDUZCAN A HACIENDA!
        </text>
      )}
    </svg>
  );
};

/**
 * 2. EL RUBIUS (CHEPUDO) AS PHANTOM FREDDY
 * Tightly crops ONLY Rubius's face inside the Moncloa-style Freddy head + jaw
 * (with top hat, bear ears, cyan glowing eyes & bear nose) attached to his hunched Chepa body!
 */
export const RubiusChepudoSprite: React.FC<SpriteProps> = ({ className = '' }) => {
  return (
    <svg
      viewBox="0 0 300 280"
      className={`select-none drop-shadow-[0_0_20px_rgba(163,230,53,0.65)] ${className}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* MASSIVE GAMER HUNCHBACK (LA CHEPA LEGENDARIA) */}
      <path
        d="M98 202 C85 58, 234 32, 268 158 L272 270 L88 270 Z"
        fill="#283618"
        stroke="#84cc16"
        strokeWidth="4"
      />
      <path d="M138 92 L244 108" stroke="#111809" strokeWidth="6" />
      <path d="M132 125 L254 140" stroke="#111809" strokeWidth="6" />
      <path d="M128 158 L260 172" stroke="#111809" strokeWidth="6" />

      <path d="M204 66 L230 40 L292 40" stroke="#a3e635" strokeWidth="2" />
      <text x="232" y="34" fill="#a3e635" fontSize="15" fontFamily="VT323, monospace">
        CHEPA NIVEL 99
      </text>

      {/* Freddy Round Bear Ears & Top Hat with Yellow Band (matching #3 in image_d5ecf7a2.png) */}
      <circle cx="24" cy="88" r="18" fill="#451a03" stroke="#78350f" strokeWidth="5" />
      <circle cx="152" cy="88" r="18" fill="#451a03" stroke="#78350f" strokeWidth="5" />
      <rect x="46" y="54" width="84" height="10" rx="2" fill="#09090b" />
      <rect x="58" y="16" width="60" height="40" rx="2" fill="#09090b" />
      <rect x="58" y="42" width="60" height="8" fill="#eab308" />

      {/* MONCLOA-STYLE FACE-ONLY FREDDY HEAD + JAW FOR RUBIUS */}
      <MoncloaAnimatronicHead
        characterId="RUBIUS_CHEPUDO"
        x={24}
        y={64}
        width={128}
        height={138}
        borderColor="#92400e"
        eyeColorOuter="#0284c7"
        eyeColorInner="#38bdf8"
        hasFreddyNose
        teethStyle="RECT"
      />

      {/* Bowtie */}
      <polygon points="88,214 66,204 66,224" fill="#dc2626" />
      <polygon points="88,214 110,204 110,224" fill="#dc2626" />
      <circle cx="88" cy="214" r="5" fill="#09090b" />
    </svg>
  );
};

/**
 * 3. CRISTININI AS PHANTOM MANGLE
 * Tightly crops ONLY Cristinini's face inside the Moncloa-style Mangle head + jaw.
 */
export const CristininiMangleSprite: React.FC<SpriteProps> = ({ className = '' }) => {
  return (
    <svg
      viewBox="0 0 260 280"
      className={`select-none drop-shadow-[0_0_20px_rgba(236,72,153,0.65)] ${className}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Ceiling Mechanical Wires & Tangled Mangle Cables */}
      <path d="M92 0 L98 68" stroke="#52525b" strokeWidth="6" />
      <path d="M130 0 C110 30, 150 45, 130 68" stroke="#84cc16" strokeWidth="4" fill="none" />
      <path d="M168 0 C188 40, 150 60, 196 88" stroke="#ec4899" strokeWidth="4" fill="none" />

      {/* Tangled Endoskeleton Limbs below */}
      <path d="M86 206 L64 262 L98 272" stroke="#71717a" strokeWidth="6" fill="none" />
      <path d="M154 206 L176 262 L142 272" stroke="#71717a" strokeWidth="6" fill="none" />

      {/* Second Endoskeleton Head on cable */}
      <circle cx="206" cy="96" r="22" fill="#27272a" stroke="#a3e635" strokeWidth="3" />
      <circle cx="198" cy="93" r="4.5" fill="#bef264" />
      <circle cx="214" cy="93" r="4.5" fill="#bef264" />
      <rect x="195" y="104" width="22" height="7" fill="#09090b" />

      {/* Fox Ears */}
      <polygon points="68,68 48,26 94,54" fill="#db2777" stroke="#f472b6" strokeWidth="3" />
      <polygon points="172,68 192,26 146,54" fill="#db2777" stroke="#f472b6" strokeWidth="3" />

      {/* MONCLOA-STYLE FACE-ONLY HEAD + JAW */}
      <MoncloaAnimatronicHead
        characterId="CRISTININI"
        x={54}
        y={62}
        width={132}
        height={138}
        borderColor="#ec4899"
        eyeColorOuter="#be185d"
        eyeColorInner="#f472b6"
        teethStyle="RECT"
      />

      {/* Pink Bowtie */}
      <polygon points="120,214 96,204 96,224" fill="#ec4899" />
      <polygon points="120,214 144,204 144,224" fill="#ec4899" />
      <circle cx="120" cy="214" r="6" fill="#facc15" />
    </svg>
  );
};

/**
 * 4. CHIQUI-IBAI AS PHANTOM BALLOON BOY
 * Tightly crops ONLY Chiqui-Ibai's face (no Spain shirt or stadium!) inside the Moncloa-style head + jaw.
 */
export const ChiquiIbaiSprite: React.FC<SpriteProps> = ({ className = '' }) => {
  return (
    <svg
      viewBox="0 0 260 280"
      className={`select-none drop-shadow-[0_0_24px_rgba(132,204,22,0.75)] ${className}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Striped Balloon Boy Body */}
      <ellipse cx="130" cy="236" rx="76" ry="42" fill="#365314" stroke="#1a2e05" strokeWidth="4" />
      <path d="M66 222 L194 222" stroke="#dc2626" strokeWidth="10" />
      <path d="M58 240 L202 240" stroke="#2563eb" strokeWidth="10" />

      {/* Balloon Boy Striped Propeller Beanie Cap */}
      <path
        d="M74 64 C74 26, 186 26, 186 64 Z"
        fill="#dc2626"
        stroke="#2563eb"
        strokeWidth="4"
      />
      <path d="M108 34 L98 64" stroke="#2563eb" strokeWidth="10" />
      <path d="M152 34 L162 64" stroke="#2563eb" strokeWidth="10" />
      <line x1="130" y1="14" x2="130" y2="34" stroke="#eab308" strokeWidth="5" />
      <ellipse cx="130" cy="14" rx="40" ry="6" fill="#eab308" stroke="#713f12" strokeWidth="2" />
      <circle cx="130" cy="14" r="5" fill="#dc2626" />

      {/* MONCLOA-STYLE FACE-ONLY HEAD + JAW */}
      <MoncloaAnimatronicHead
        characterId="CHIQUI_IBAI"
        x={64}
        y={60}
        width={132}
        height={138}
        borderColor="#3b82f6"
        eyeColorOuter="#be123c"
        eyeColorInner="#fb7185"
        hasRosyCheeks
        teethStyle="RECT"
      />

      {/* Sign */}
      <rect
        x="42"
        y="244"
        width="176"
        height="28"
        rx="4"
        fill="#eab308"
        stroke="#18181b"
        strokeWidth="3"
      />
      <text
        x="130"
        y="263"
        textAnchor="middle"
        fill="#09090b"
        fontSize="17"
        fontFamily="VT323, monospace"
        fontWeight="bold"
      >
        ¡CHIQUI-IBAI TE VEO!
      </text>
    </svg>
  );
};

/**
 * 5. ISHOWSPEED AS PHANTOM FOXY
 * Exact replica of character #1 in image_d5ecf7a2.png:
 * Tightly crops ONLY Speed's face (zero bare chest or stadium!), adds Foxy's red pointed ears,
 * green/yellow forehead bar, diagonal black eyepatch, yellow animatronic eye, and 7 sharp triangular teeth!
 */
export const IShowSpeedFoxySprite: React.FC<SpriteProps> = ({ className = '' }) => {
  return (
    <svg
      viewBox="0 0 260 300"
      className={`select-none drop-shadow-[0_0_22px_rgba(220,38,38,0.7)] ${className}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Foxy Pointed Red Animatronic Ears (matching #1 in image_d5ecf7a2.png) */}
      <polygon points="68,72 44,18 90,54" fill="#991b1b" stroke="#b91c1c" strokeWidth="3" />
      <polygon points="192,72 216,18 170,54" fill="#991b1b" stroke="#b91c1c" strokeWidth="3" />

      {/* Torso */}
      <path
        d="M62 204 L198 204 L212 292 L48 292 Z"
        fill="#991b1b"
        stroke="#14532d"
        strokeWidth="4"
      />
      <text
        x="130"
        y="256"
        textAnchor="middle"
        fill="#facc15"
        fontSize="44"
        fontFamily="Oswald, sans-serif"
        fontWeight="bold"
      >
        7
      </text>

      {/* Foxy Pirate Hook on Right Arm */}
      <path d="M202 232 L236 204" stroke="#52525b" strokeWidth="10" strokeLinecap="round" />
      <path
        d="M236 204 C256 184, 250 152, 224 162"
        stroke="#e4e4e7"
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
      />

      {/* MONCLOA-STYLE FOXY HEAD + JAW FOR ISHOWSPEED */}
      <MoncloaAnimatronicHead
        characterId="ISHOWSPEED"
        x={64}
        y={60}
        width={132}
        height={138}
        borderColor="#b91c1c"
        eyeColorOuter="#ca8a04"
        eyeColorInner="#fde047"
        teethStyle="SHARP_FOXY"
        isFoxyEyepatch
      />

      {/* Barking Banner */}
      <rect
        x="56"
        y="264"
        width="148"
        height="26"
        rx="4"
        fill="#09090b"
        stroke="#ef4444"
        strokeWidth="2.5"
      />
      <text
        x="130"
        y="282"
        textAnchor="middle"
        fill="#facc15"
        fontSize="18"
        fontFamily="VT323, monospace"
        fontWeight="bold"
      >
        ARF! ARF! SEWY!!
      </text>
    </svg>
  );
};

/**
 * 6. ARIGAMEPLAYS AS PHANTOM CHICA (WITH 3,99$ TAG)
 * Exact replica of character #4 (Chica) in image_d5ecf7a2.png:
 * Tightly crops ONLY Ari's face (zero room/headphones/chair!), yellow Chica casing with top tuft,
 * purple side tabs, glowing purple concentric animatronic eyes, rectangular teeth, and 3,99$ bib!
 */
export const AriGameplaysChicaSprite: React.FC<SpriteProps & { showPriceTag?: boolean }> = ({
  className = '',
  showPriceTag = true,
}) => {
  return (
    <svg
      viewBox="0 0 260 300"
      className={`select-none drop-shadow-[0_0_20px_rgba(236,72,153,0.7)] ${className}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Chica Yellow Top Tuft & Purple Side Tabs (matching #4 in image_d5ecf7a2.png) */}
      <ellipse cx="130" cy="34" rx="20" ry="24" fill="#eab308" />
      <rect x="52" y="102" width="10" height="36" rx="2" fill="#9333ea" />
      <rect x="198" y="102" width="10" height="36" rx="2" fill="#9333ea" />

      {/* Chica Bib / Torso with "3,99$" */}
      <path
        d="M62 194 L198 194 L214 288 L46 288 Z"
        fill="#eab308"
        stroke="#9333ea"
        strokeWidth="4"
      />
      <ellipse cx="130" cy="226" rx="58" ry="34" fill="#f4f4f5" stroke="#ec4899" strokeWidth="4" />
      <text
        x="130"
        y="240"
        textAnchor="middle"
        fill="#db2777"
        fontSize="38"
        fontFamily="VT323, monospace"
        fontWeight="bold"
      >
        3,99$
      </text>

      {/* MONCLOA-STYLE CHICA HEAD + JAW FOR ARIGAMEPLAYS */}
      <MoncloaAnimatronicHead
        characterId="ARIGAMEPLAYS"
        x={64}
        y={52}
        width={132}
        height={138}
        borderColor="#eab308"
        eyeColorOuter="#7e22ce"
        eyeColorInner="#d8b4fe"
        teethStyle="RECT"
      />

      {showPriceTag && (
        <g>
          <rect
            x="36"
            y="250"
            width="188"
            height="42"
            rx="6"
            fill="#09090b"
            stroke="#ec4899"
            strokeWidth="3"
          />
          <text
            x="130"
            y="281"
            textAnchor="middle"
            fill="#f472b6"
            fontSize="38"
            fontFamily="VT323, monospace"
            fontWeight="bold"
          >
            ★ 3,99$ ★
          </text>
        </g>
      )}
    </svg>
  );
};

/**
 * 7. KNEKRO AS PHANTOM PUPPET (CAM 08 & OFFICE FACE-BLOCK)
 * Tightly crops ONLY KNekro's face (zero truck background, suit jacket, or hand on tie!)
 * inside the Moncloa-style Puppet head + jaw with purple tears and rosy cheeks!
 */
export const KNekroPuppetSprite: React.FC<SpriteProps & { closeUp?: boolean }> = ({
  className = '',
  closeUp = false,
}) => {
  return (
    <svg
      viewBox="0 0 260 320"
      className={`select-none drop-shadow-[0_0_26px_rgba(163,230,53,0.75)] ${className}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Vertical Marionette Puppet Strings from the Ceiling */}
      <line x1="65" y1="0" x2="65" y2="65" stroke="#a3e635" strokeWidth="2" strokeDasharray="4 4" />
      <line x1="130" y1="0" x2="130" y2="55" stroke="#a3e635" strokeWidth="2.5" />
      <line x1="195" y1="0" x2="195" y2="65" stroke="#a3e635" strokeWidth="2" strokeDasharray="4 4" />

      {/* Elongated Phantom Puppet Body with White & Green/Black Stripes */}
      <path
        d="M78 198 C65 235, 62 280, 56 315 L204 315 C198 280, 195 235, 182 198 Z"
        fill="#090d07"
        stroke="#84cc16"
        strokeWidth="3.5"
      />
      <path
        d="M78 210 C32 225, 22 265, 36 305"
        stroke="#18181b"
        strokeWidth="16"
        strokeLinecap="round"
      />
      <path
        d="M78 210 C32 225, 22 265, 36 305"
        stroke="#d9f99d"
        strokeWidth="12"
        strokeDasharray="10 12"
        strokeLinecap="round"
      />
      <path
        d="M182 210 C228 225, 238 265, 224 305"
        stroke="#18181b"
        strokeWidth="16"
        strokeLinecap="round"
      />
      <path
        d="M182 210 C228 225, 238 265, 224 305"
        stroke="#d9f99d"
        strokeWidth="12"
        strokeDasharray="10 12"
        strokeLinecap="round"
      />

      {/* Puppet White Buttons on Chest */}
      <circle cx="130" cy="232" r="7" fill="#ecfccb" />
      <circle cx="130" cy="256" r="7" fill="#ecfccb" />
      <circle cx="130" cy="280" r="7" fill="#ecfccb" />

      {/* MONCLOA-STYLE FACE-ONLY HEAD + JAW FOR KNEKRO */}
      <MoncloaAnimatronicHead
        characterId="KNEKRO"
        x={60}
        y={52}
        width={140}
        height={144}
        borderColor="#e4e4e7"
        eyeColorOuter="#6d28d9"
        eyeColorInner="#c4b5fd"
        hasPuppetTears
        hasRosyCheeks
        teethStyle="RECT"
      />

      {closeUp && (
        <g>
          <rect
            x="24"
            y="282"
            width="212"
            height="32"
            rx="4"
            fill="#09090b"
            stroke="#a3e635"
            strokeWidth="2.5"
          />
          <text
            x="130"
            y="304"
            textAnchor="middle"
            fill="#ecfccb"
            fontSize="20"
            fontFamily="VT323, monospace"
            fontWeight="bold"
          >
            «¿PERO ESTO QUÉ ES, CHAVALES?»
          </text>
        </g>
      )}
    </svg>
  );
};

/**
 * HACIENDA SECURITY GUARD BADGE / AVATAR
 */
export const HaciendaGuardBadge: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg viewBox="0 0 120 120" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <polygon
      points="60,6 108,26 98,86 60,114 22,86 12,26"
      fill="#1e293b"
      stroke="#eab308"
      strokeWidth="5"
    />
    <polygon
      points="60,16 98,32 90,80 60,102 30,80 22,32"
      fill="#0f172a"
      stroke="#ca8a04"
      strokeWidth="2"
    />
    <rect x="34" y="34" width="52" height="14" rx="2" fill="#dc2626" />
    <text
      x="60"
      y="45"
      textAnchor="middle"
      fill="#ffffff"
      fontSize="11"
      fontFamily="Oswald, sans-serif"
      fontWeight="bold"
    >
      AEAT · HACIENDA
    </text>
    <text
      x="60"
      y="72"
      textAnchor="middle"
      fill="#facc15"
      fontSize="22"
      fontFamily="VT323, monospace"
      fontWeight="bold"
    >
      INSPECTOR
    </text>
    <text
      x="60"
      y="90"
      textAnchor="middle"
      fill="#94a3b8"
      fontSize="11"
      fontFamily="VT323, monospace"
    >
      MISIÓN: ANDORRA
    </text>
  </svg>
);

export const CharacterPortrait: React.FC<{ id: CharacterId; className?: string }> = ({
  id,
  className = '',
}) => {
  switch (id) {
    case 'AURONPLAY':
      return <AuronSpringtrapSprite className={className} />;
    case 'RUBIUS_CHEPUDO':
      return <RubiusChepudoSprite className={className} />;
    case 'CRISTININI':
      return <CristininiMangleSprite className={className} />;
    case 'CHIQUI_IBAI':
      return <ChiquiIbaiSprite className={className} />;
    case 'ISHOWSPEED':
      return <IShowSpeedFoxySprite className={className} />;
    case 'ARIGAMEPLAYS':
      return <AriGameplaysChicaSprite className={className} />;
    case 'KNEKRO':
      return <KNekroPuppetSprite className={className} />;
  }
};
