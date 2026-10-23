import React from 'react';
import {
  CameraId,
  VentCameraId,
  CAMERA_NODES,
  ROOM_CAMERAS,
  VENT_CAMERAS,
  AuronPosition,
} from '../data/fnafMapData';
import {
  AuronSpringtrapSprite,
  CristininiMangleSprite,
  ChiquiIbaiSprite,
  KNekroPuppetSprite,
  StreamerFaceOnlyAvatar,
} from './YoutuberSprites';
import { Volume2, ShieldAlert, Radio, EyeOff, Lock } from 'lucide-react';

interface CameraMonitorProps {
  currentCam: CameraId;
  mapLayer: 'ROOMS' | 'VENTS';
  auronPos: AuronPosition;
  sealedVent: VentCameraId | null;
  audioError: boolean;
  cameraError: boolean;
  audioCooldown: number;
  chiquiIbaiCam: CameraId | null;
  cristininiCam04Active: boolean;
  ariArcadeCam07Active: boolean;
  knekroCam08Active: boolean;
  staticBurst: boolean;
  onSelectCam: (cam: CameraId) => void;
  onToggleMapLayer: () => void;
  onPlayAudio: () => void;
  onCloseMonitor: () => void;
}

export const CameraMonitor: React.FC<CameraMonitorProps> = ({
  currentCam,
  mapLayer,
  auronPos,
  sealedVent,
  audioError,
  cameraError,
  audioCooldown,
  chiquiIbaiCam,
  cristininiCam04Active,
  ariArcadeCam07Active,
  knekroCam08Active,
  staticBurst,
  onSelectCam,
  onToggleMapLayer,
  onPlayAudio,
  onCloseMonitor,
}) => {
  const camNode = CAMERA_NODES[currentCam];
  const isAuronHere = auronPos === currentCam;
  const isChiquiHere = chiquiIbaiCam === currentCam && !camNode.isVent;
  const isCristininiHere = currentCam === 'CAM_04' && cristininiCam04Active;
  const isAriHere = currentCam === 'CAM_07' && ariArcadeCam07Active;
  const isKNekroHere = currentCam === 'CAM_08' && knekroCam08Active;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/85 p-3 md:p-6 select-none">
      {/* Outer FNAF 3 Monitor Bezel */}
      <div className="relative w-full max-w-6xl h-[88vh] bg-[#070b06] border-4 border-[#324228] shadow-[0_0_60px_rgba(0,0,0,0.95)] flex flex-col md:flex-row overflow-hidden">
        {/* CRT Scanlines inside Monitor */}
        <div className="absolute inset-0 crt-scanlines z-20" />
        <div className="absolute inset-0 crt-vignette z-20" />

        {/* LEFT / MAIN CAMERA FEED */}
        <div className="relative flex-1 h-full bg-[#091108] overflow-hidden flex flex-col justify-between p-4 md:p-6">
          {/* Top Camera Header */}
          <div className="relative z-25 flex items-center justify-between border-b border-[#3a5229]/60 pb-2">
            <div className="flex items-center gap-3">
              <div className="w-3.5 h-3.5 bg-red-600 rounded-full animate-pulse" />
              <span className="text-2xl md:text-3xl font-crt tracking-wider text-[#b7e486]">
                {camNode.label} — {camNode.name}
              </span>
            </div>
            <div className="text-lg font-crt text-[#84a964]">
              {camNode.isVent ? 'CONDUCTO DE VENTILACIÓN (DOBLE CLIC PARA SELLAR)' : 'CIRCUITO CERRADO ANDORRA'}
            </div>
          </div>

          {/* CAMERA VIDEO CONTENT OR VIDEO ERROR */}
          <div className="relative flex-1 my-3 border border-[#2d4020] bg-[#060a05] overflow-hidden flex items-center justify-center">
            {/* Heavy Static Burst when switching cams or when Auron moves */}
            {staticBurst && (
              <div className="absolute inset-0 z-30 bg-[#1a2614] flex flex-col items-center justify-center opacity-95">
                <div className="text-3xl font-crt text-[#b7e486] tracking-widest animate-pulse">
                  SINCRONIZANDO SEÑAL...
                </div>
              </div>
            )}

            {cameraError ? (
              <div className="flex flex-col items-center justify-center text-center p-6 z-20">
                <EyeOff className="w-16 h-16 text-red-500 mb-3 animate-bounce" />
                <p className="text-4xl font-crt text-red-500 tracking-widest">
                  ERROR DE VÍDEO — SEÑAL PERDIDA
                </p>
                <p className="text-xl font-crt text-[#8ca878] mt-2">
                  Abre el Panel de Mantenimiento (Izquierda en la Oficina) y reinicia Camera System
                </p>
              </div>
            ) : (
              <>
                {/* Background Room Architecture SVG (Vents untouched, Rooms CAM 01 - CAM 10 uniquely detailed) */}
                <svg
                  viewBox="0 0 800 450"
                  className="absolute inset-0 w-full h-full object-cover opacity-75"
                  preserveAspectRatio="none"
                >
                  {camNode.isVent ? (
                    // Vent Tunnel Perspective (UNTOUCHED AS REQUESTED)
                    <g>
                      <rect width="800" height="450" fill="#090d08" />
                      <polygon points="0,0 800,0 620,110 180,110" fill="#131c10" stroke="#2c3e23" strokeWidth="2" />
                      <polygon points="0,450 800,450 620,340 180,340" fill="#0e160c" stroke="#2c3e23" strokeWidth="2" />
                      <polygon points="0,0 180,110 180,340 0,450" fill="#10180e" stroke="#2c3e23" strokeWidth="2" />
                      <polygon points="800,0 620,110 620,340 800,450" fill="#10180e" stroke="#2c3e23" strokeWidth="2" />
                      <rect x="180" y="110" width="440" height="230" fill="#050804" stroke="#364f2a" strokeWidth="3" />
                      {/* Vent Ribs */}
                      <rect x="90" y="55" width="620" height="340" fill="none" stroke="#23331c" strokeWidth="4" />
                      <rect x="240" y="145" width="320" height="160" fill="none" stroke="#1a2615" strokeWidth="3" />
                    </g>
                  ) : (
                    // Common Fazbear's Fright / Andorra Bunker Base Architecture + Per-Camera Unique Scene
                    <g>
                      {/* Base Dark Grimy Walls */}
                      <rect width="800" height="450" fill="#080e07" />
                      {/* Left & Right Perspective Side Walls */}
                      <polygon points="0,0 140,45 140,330 0,450" fill="#0d160b" stroke="#26381d" strokeWidth="2" />
                      <polygon points="800,0 660,45 660,330 800,450" fill="#0d160b" stroke="#26381d" strokeWidth="2" />
                      {/* Ceiling */}
                      <polygon points="0,0 800,0 660,45 140,45" fill="#060a05" stroke="#1f2e18" strokeWidth="2" />
                      {/* Grimy Wainscoting Stripe along Walls */}
                      <line x1="0" y1="265" x2="140" y2="230" stroke="#2d4422" strokeWidth="4" />
                      <line x1="140" y1="230" x2="660" y2="230" stroke="#25381c" strokeWidth="3" />
                      <line x1="660" y1="230" x2="800" y2="265" stroke="#2d4422" strokeWidth="4" />

                      {/* Perspective Checkerboard Floor */}
                      <polygon points="140,330 660,330 800,450 0,450" fill="#101a0d" stroke="#2c4022" strokeWidth="2" />
                      <line x1="70" y1="390" x2="730" y2="390" stroke="#1c2c16" strokeWidth="2" />
                      <line x1="105" y1="360" x2="695" y2="360" stroke="#182613" strokeWidth="1.5" />
                      <line x1="35" y1="420" x2="765" y2="420" stroke="#1c2c16" strokeWidth="2" />
                      <line x1="220" y1="330" x2="90" y2="450" stroke="#1e2f18" strokeWidth="2" />
                      <line x1="310" y1="330" x2="245" y2="450" stroke="#1e2f18" strokeWidth="2" />
                      <line x1="400" y1="330" x2="400" y2="450" stroke="#1e2f18" strokeWidth="2" />
                      <line x1="490" y1="330" x2="555" y2="450" stroke="#1e2f18" strokeWidth="2" />
                      <line x1="580" y1="330" x2="710" y2="450" stroke="#1e2f18" strokeWidth="2" />

                      {/* Ceiling Industrial Pipes */}
                      <rect x="140" y="32" width="520" height="10" fill="#182413" stroke="#2e4423" strokeWidth="1.5" />
                      <rect x="160" y="16" width="480" height="8" fill="#121b0e" stroke="#23351b" strokeWidth="1" />

                      {/* =========================================================
                          CAM 01: SALIDA FISCAL (EXIT HALL)
                          Emergency Double Doors + Glowing Freddy Shell Stand + AEAT Boxes
                         ========================================================= */}
                      {currentCam === 'CAM_01' && (
                        <g>
                          {/* Glowing Red/Amber EXIT Sign at Top Center */}
                          <rect x="330" y="55" width="140" height="34" rx="3" fill="#290d0d" stroke="#ef4444" strokeWidth="2.5" />
                          <text x="400" y="79" textAnchor="middle" fill="#fca5a5" fontSize="22" fontFamily="VT323, monospace" fontWeight="bold">
                            EXIT · ADUANA
                          </text>
                          {/* Double Steel Emergency Exit Doors */}
                          <rect x="300" y="98" width="200" height="232" fill="#111a0e" stroke="#365314" strokeWidth="3" />
                          <line x1="400" y1="98" x2="400" y2="330" stroke="#2c4220" strokeWidth="3" />
                          {/* Door Push Panic Bars */}
                          <rect x="312" y="210" width="76" height="10" fill="#3f5730" stroke="#65a30d" strokeWidth="1" />
                          <rect x="412" y="210" width="76" height="10" fill="#3f5730" stroke="#65a30d" strokeWidth="1" />
                          {/* Door reinforced windows */}
                          <rect x="330" y="122" width="40" height="58" fill="#070c06" stroke="#365314" strokeWidth="2" />
                          <rect x="430" y="122" width="40" height="58" fill="#070c06" stroke="#365314" strokeWidth="2" />

                          {/* FNAF 3 Classic Freddy Shell on Metal Stand (Left) */}
                          <line x1="205" y1="205" x2="205" y2="345" stroke="#3f4f36" strokeWidth="8" />
                          <polygon points="170,345 240,345 225,332 185,332" fill="#273520" />
                          {/* Empty Freddy Torso */}
                          <rect x="176" y="195" width="58" height="68" rx="12" fill="#2c1d11" stroke="#5c3a21" strokeWidth="2" />
                          <polygon points="205,208 193,202 193,214" fill="#991b1b" />
                          <polygon points="205,208 217,202 217,214" fill="#991b1b" />
                          {/* Empty Freddy Head with Eerie Lamp Inside */}
                          <circle cx="182" cy="142" r="9" fill="#2c1d11" stroke="#5c3a21" strokeWidth="2" />
                          <circle cx="228" cy="142" r="9" fill="#2c1d11" stroke="#5c3a21" strokeWidth="2" />
                          <rect x="188" y="124" width="34" height="16" fill="#09090b" stroke="#52525b" strokeWidth="1.5" />
                          <rect x="178" y="140" width="54" height="48" rx="14" fill="#3b2514" stroke="#6b4423" strokeWidth="2" />
                          <circle cx="194" cy="160" r="7" fill="#09090b" />
                          <circle cx="194" cy="160" r="3.5" fill="#f59e0b" />
                          <circle cx="216" cy="160" r="7" fill="#09090b" />
                          <circle cx="216" cy="160" r="3.5" fill="#f59e0b" />

                          {/* Stacked Hacienda Seizure Boxes (Right) */}
                          <rect x="545" y="255" width="95" height="75" fill="#231f14" stroke="#65a30d" strokeWidth="2" />
                          <text x="592" y="288" textAnchor="middle" fill="#a3e635" fontSize="15" fontFamily="VT323, monospace">
                            EMBARGO AEAT
                          </text>
                          <text x="592" y="308" textAnchor="middle" fill="#84cc16" fontSize="13" fontFamily="VT323, monospace">
                            EXP. ANDORRA
                          </text>
                          <rect x="560" y="198" width="72" height="57" fill="#1c1912" stroke="#4d7c0f" strokeWidth="2" />
                          <text x="596" y="230" textAnchor="middle" fill="#bef264" fontSize="14" fontFamily="VT323, monospace">
                            MOD. 720
                          </text>
                          {/* Dangling Ceiling Wires */}
                          <path d="M260,42 Q270,95 255,135" fill="none" stroke="#365314" strokeWidth="3" />
                          <path d="M530,42 Q515,88 535,125" fill="none" stroke="#365314" strokeWidth="2.5" />
                        </g>
                      )}

                      {/* =========================================================
                          CAM 02: PASILLO ADUANA (FRONT HALL)
                          Office Window Glass reflection + Wall Bonnie Sconce + Vent CAM 15
                         ========================================================= */}
                      {currentCam === 'CAM_02' && (
                        <g>
                          {/* Distant Corridor Archway */}
                          <rect x="290" y="75" width="220" height="255" fill="#060a05" stroke="#2d4422" strokeWidth="3" />
                          {/* Hanging Cage Light in Corridor */}
                          <line x1="400" y1="42" x2="400" y2="95" stroke="#4d7c0f" strokeWidth="2" />
                          <polygon points="385,95 415,95 422,112 378,112" fill="#1e2f18" stroke="#84cc16" strokeWidth="1.5" />
                          <circle cx="400" cy="114" r="6" fill="#d9f99d" />

                          {/* Left Wall: Side View of the Hacienda Office Window */}
                          <polygon points="155,105 265,125 265,245 155,265" fill="#0c1914" stroke="#4d7c0f" strokeWidth="3" />
                          <line x1="170" y1="125" x2="195" y2="245" stroke="#84cc16" strokeWidth="1.5" opacity="0.35" />
                          <text x="210" y="185" textAnchor="middle" fill="#84cc16" fontSize="14" fontFamily="VT323, monospace">
                            VENTANA OFICINA
                          </text>

                          {/* Classic FNAF 3 Glowing Bonnie Mask Sconce on Pillar */}
                          <rect x="528" y="115" width="46" height="44" rx="10" fill="#1e293b" stroke="#64748b" strokeWidth="2" />
                          <rect x="533" y="80" width="12" height="35" rx="5" fill="#1e293b" stroke="#64748b" strokeWidth="2" />
                          <rect x="557" y="85" width="12" height="30" rx="5" fill="#1e293b" stroke="#64748b" strokeWidth="2" />
                          <circle cx="542" cy="135" r="5" fill="#facc15" />
                          <circle cx="560" cy="135" r="5" fill="#facc15" />

                          {/* Filing Cabinets & Tax Poster (Right) */}
                          <rect x="585" y="175" width="65" height="155" fill="#141f11" stroke="#365314" strokeWidth="2" />
                          <rect x="593" y="188" width="49" height="38" fill="#0d150b" stroke="#2c4220" strokeWidth="1.5" />
                          <rect x="593" y="236" width="49" height="38" fill="#0d150b" stroke="#2c4220" strokeWidth="1.5" />
                          <rect x="593" y="284" width="49" height="38" fill="#0d150b" stroke="#2c4220" strokeWidth="1.5" />

                          {/* Vent Grate to CAM 15 at Bottom Left */}
                          <rect x="165" y="280" width="75" height="46" fill="#050804" stroke="#4d7c0f" strokeWidth="2" />
                          <line x1="172" y1="292" x2="232" y2="292" stroke="#2e4423" strokeWidth="2" />
                          <line x1="172" y1="304" x2="232" y2="304" stroke="#2e4423" strokeWidth="2" />
                          <line x1="172" y1="316" x2="232" y2="316" stroke="#2e4423" strokeWidth="2" />
                          <text x="202" y="275" textAnchor="middle" fill="#84cc16" fontSize="12" fontFamily="VT323, monospace">
                            VENT CAM 15
                          </text>
                        </g>
                      )}

                      {/* =========================================================
                          CAM 03: DESPACHO CONTABLE
                          Cluttered Tax Desk + Bitcoin CRT Monitors + Paper Shredder + Drawings
                         ========================================================= */}
                      {currentCam === 'CAM_03' && (
                        <g>
                          {/* Wall Crayon Drawings & Andorra Tax Calendar */}
                          <rect x="185" y="88" width="60" height="75" fill="#d6d3d1" stroke="#57534e" strokeWidth="2" />
                          <circle cx="215" cy="115" r="12" fill="#84cc16" />
                          <text x="215" y="150" textAnchor="middle" fill="#1c1917" fontSize="11" fontFamily="VT323, monospace">
                            0% IRPF
                          </text>
                          <rect x="260" y="95" width="55" height="68" fill="#e7e5e4" stroke="#57534e" strokeWidth="2" />
                          <text x="287" y="135" textAnchor="middle" fill="#b91c1c" fontSize="12" fontFamily="VT323, monospace">
                            HACIENDA NO
                          </text>

                          {/* Large Accounting Desk */}
                          <rect x="230" y="235" width="320" height="95" fill="#1a1610" stroke="#4d7c0f" strokeWidth="2.5" />
                          <rect x="245" y="250" width="90" height="72" fill="#120f0b" stroke="#365314" strokeWidth="1.5" />
                          <rect x="445" y="250" width="90" height="72" fill="#120f0b" stroke="#365314" strokeWidth="1.5" />

                          {/* Dual Retro CRT Monitors on Desk with BTC Chart */}
                          <rect x="275" y="158" width="95" height="76" rx="5" fill="#141e12" stroke="#65a30d" strokeWidth="2.5" />
                          <rect x="285" y="167" width="75" height="54" fill="#071206" />
                          <polyline points="290,210 308,195 322,202 340,178 355,172" fill="none" stroke="#a3e635" strokeWidth="2.5" />
                          <text x="322" y="184" textAnchor="middle" fill="#bef264" fontSize="12" fontFamily="VT323, monospace">
                            BTC +420%
                          </text>

                          {/* Stacked Folders (Modelo 720) */}
                          <rect x="395" y="195" width="65" height="12" fill="#365314" stroke="#84cc16" strokeWidth="1" />
                          <rect x="400" y="182" width="62" height="12" fill="#3f6212" stroke="#84cc16" strokeWidth="1" />
                          <rect x="392" y="169" width="66" height="12" fill="#4d7c0f" stroke="#a3e635" strokeWidth="1" />
                          <text x="425" y="225" textAnchor="middle" fill="#a3e635" fontSize="14" fontFamily="VT323, monospace">
                            FACTURAS B
                          </text>

                          {/* Overflowing Paper Shredder on the Right */}
                          <rect x="575" y="225" width="70" height="105" fill="#18181b" stroke="#52525b" strokeWidth="2" />
                          <rect x="582" y="212" width="56" height="15" fill="#27272a" stroke="#ef4444" strokeWidth="1.5" />
                          {/* Shredded tax strips spilling out */}
                          <line x1="590" y1="245" x2="585" y2="325" stroke="#d9f99d" strokeWidth="2" strokeDasharray="6 4" />
                          <line x1="605" y1="245" x2="608" y2="325" stroke="#bef264" strokeWidth="2" strokeDasharray="5 3" />
                          <line x1="620" y1="245" x2="616" y2="325" stroke="#d9f99d" strokeWidth="2" strokeDasharray="7 4" />
                          <line x1="632" y1="245" x2="638" y2="325" stroke="#a3e635" strokeWidth="2" strokeDasharray="6 3" />
                          <text x="610" y="205" textAnchor="middle" fill="#f87171" fontSize="13" fontFamily="VT323, monospace">
                            TRITURADORA
                          </text>
                        </g>
                      )}

                      {/* =========================================================
                          CAM 04: GALERÍA STREAMER (EAST HALL)
                          YouTube Diamond/Gold Plaques + Ceiling Hatch & Mic Arms + Foxy Lamp
                         ========================================================= */}
                      {currentCam === 'CAM_04' && (
                        <g>
                          {/* Open Ceiling Hatch & Hanging Studio Mic Cables (where Cristinini hangs!) */}
                          <rect x="190" y="10" width="160" height="34" fill="#040703" stroke="#4d7c0f" strokeWidth="2" />
                          <path d="M225,44 Q240,115 215,175" fill="none" stroke="#4d7c0f" strokeWidth="3" />
                          <path d="M285,44 Q270,100 295,155" fill="none" stroke="#365314" strokeWidth="2.5" />
                          {/* Dangling Studio Microphone */}
                          <line x1="330" y1="44" x2="310" y2="115" stroke="#52525b" strokeWidth="4" />
                          <rect x="302" y="112" width="16" height="26" rx="6" fill="#27272a" stroke="#a3e635" strokeWidth="1.5" />

                          {/* YouTube Diamond & Gold Play Button Plaques on Back Wall */}
                          <g transform="rotate(-4 395 145)">
                            <rect x="350" y="105" width="90" height="110" rx="4" fill="#142211" stroke="#a3e635" strokeWidth="2.5" />
                            <polygon points="375,135 420,135 420,168 375,168" fill="#365314" stroke="#bef264" strokeWidth="1.5" />
                            <polygon points="390,143 390,160 408,151.5" fill="#ecfccb" />
                            <text x="395" y="190" textAnchor="middle" fill="#d9f99d" fontSize="14" fontFamily="VT323, monospace">
                              10M SUBS VIP
                            </text>
                            <text x="395" y="206" textAnchor="middle" fill="#84cc16" fontSize="12" fontFamily="VT323, monospace">
                              DIAMOND PLAQUE
                            </text>
                          </g>

                          <g transform="rotate(3 510 155)">
                            <rect x="470" y="115" width="80" height="96" rx="4" fill="#1c1910" stroke="#facc15" strokeWidth="2" />
                            <polygon points="502,145 502,162 520,153.5" fill="#fde047" />
                            <text x="510" y="192" textAnchor="middle" fill="#fef08a" fontSize="13" fontFamily="VT323, monospace">
                              1M SUBS GOLD
                            </text>
                          </g>

                          {/* Classic FNAF 3 Foxy Head Wall Lamp on Right Stand */}
                          <line x1="605" y1="215" x2="605" y2="335" stroke="#3f4f36" strokeWidth="7" />
                          <polygon points="575,180 635,180 645,215 565,215" fill="#451a03" stroke="#dc2626" strokeWidth="2" />
                          <circle cx="592" cy="198" r="5" fill="#facc15" />
                          <rect x="606" y="193" width="12" height="10" fill="#09090b" />
                        </g>
                      )}

                      {/* =========================================================
                          CAM 05: PASILLO CENTRAL PIRINEOS
                          Pipe Arches + Spare Animatronic Parts Shelf + Star Garland + Vent CAM 14
                         ========================================================= */}
                      {currentCam === 'CAM_05' && (
                        <g>
                          {/* Star Garland Draped Across Ceiling */}
                          <path d="M145,55 Q400,125 655,55" fill="none" stroke="#4d7c0f" strokeWidth="2" strokeDasharray="6 4" />
                          <polygon points="270,82 276,96 262,90 278,90 264,96" fill="#a3e635" />
                          <polygon points="400,94 406,108 392,102 408,102 394,108" fill="#facc15" />
                          <polygon points="530,82 536,96 522,90 538,90 524,96" fill="#a3e635" />

                          {/* Metal Storage Rack with Spare Animatronic Heads (Left) */}
                          <rect x="165" y="115" width="115" height="215" fill="none" stroke="#3f5730" strokeWidth="4" />
                          <line x1="165" y1="185" x2="280" y2="185" stroke="#3f5730" strokeWidth="4" />
                          <line x1="165" y1="255" x2="280" y2="255" stroke="#3f5730" strokeWidth="4" />
                          {/* Spare Endoskeleton Skulls on Shelves */}
                          <rect x="182" y="142" width="34" height="40" rx="6" fill="#27272a" stroke="#71717a" strokeWidth="2" />
                          <circle cx="192" cy="158" r="4" fill="#ef4444" />
                          <circle cx="206" cy="158" r="4" fill="#ef4444" />
                          <rect x="230" y="145" width="36" height="37" rx="8" fill="#365314" stroke="#84cc16" strokeWidth="1.5" />
                          <rect x="195" y="212" width="44" height="40" rx="8" fill="#1e293b" stroke="#64748b" strokeWidth="2" />

                          {/* Andorra Tax Haven Poster & Directional Sign (Right) */}
                          <rect x="520" y="110" width="110" height="130" fill="#121e0e" stroke="#4d7c0f" strokeWidth="2.5" />
                          <text x="575" y="142" textAnchor="middle" fill="#a3e635" fontSize="18" fontFamily="VT323, monospace">
                            PIRINEOS VIP
                          </text>
                          <text x="575" y="168" textAnchor="middle" fill="#bef264" fontSize="24" fontFamily="VT323, monospace">
                            IRPF 10%
                          </text>
                          <text x="575" y="195" textAnchor="middle" fill="#84cc16" fontSize="14" fontFamily="VT323, monospace">
                            RESIDENCIA PASIVA
                          </text>
                          <text x="575" y="220" textAnchor="middle" fill="#65a30d" fontSize="13" fontFamily="VT323, monospace">
                            ← SALA ARCADE
                          </text>

                          {/* Vent Grate to CAM 14 */}
                          <rect x="545" y="275" width="80" height="50" fill="#050804" stroke="#4d7c0f" strokeWidth="2" />
                          <line x1="552" y1="290" x2="618" y2="290" stroke="#2e4423" strokeWidth="2" />
                          <line x1="552" y1="305" x2="618" y2="305" stroke="#2e4423" strokeWidth="2" />
                          <text x="585" y="270" textAnchor="middle" fill="#84cc16" fontSize="12" fontFamily="VT323, monospace">
                            VENT CAM 14
                          </text>
                        </g>
                      )}

                      {/* =========================================================
                          CAM 06: CRUCE DE SERVIDORES
                          Andorra Telecom Server Racks + Blinking LEDs + Rusted Endoskeleton
                         ========================================================= */}
                      {currentCam === 'CAM_06' && (
                        <g>
                          {/* Server Rack Left: ANDORRA TELECOM */}
                          <rect x="165" y="80" width="135" height="250" fill="#0c130a" stroke="#4d7c0f" strokeWidth="3" />
                          <text x="232" y="104" textAnchor="middle" fill="#a3e635" fontSize="16" fontFamily="VT323, monospace">
                            ANDORRA TELECOM
                          </text>
                          {[120, 155, 190, 225, 260, 295].map((yPos, i) => (
                            <g key={yPos}>
                              <rect x="178" y={yPos} width="108" height="24" fill="#141f10" stroke="#2e4423" strokeWidth="1.5" />
                              <circle cx="192" cy={yPos + 12} r="4" fill={i % 2 === 0 ? '#84cc16' : '#facc15'} />
                              <circle cx="206" cy={yPos + 12} r="4" fill="#22c55e" />
                              <circle cx="220" cy={yPos + 12} r="4" fill={i === 3 ? '#ef4444' : '#84cc16'} />
                              <line x1="238" y1={yPos + 12} x2="276" y2={yPos + 12} stroke="#365314" strokeWidth="3" />
                            </g>
                          ))}

                          {/* Server Rack Right: VPN ANTI-HACIENDA */}
                          <rect x="515" y="85" width="125" height="245" fill="#0c130a" stroke="#365314" strokeWidth="3" />
                          <text x="577" y="108" textAnchor="middle" fill="#84cc16" fontSize="15" fontFamily="VT323, monospace">
                            PROXY BUNKER #2
                          </text>
                          {[125, 165, 205, 245, 285].map((yPos, i) => (
                            <g key={yPos}>
                              <rect x="528" y={yPos} width="98" height="28" fill="#141f10" stroke="#2e4423" strokeWidth="1.5" />
                              <circle cx="542" cy={yPos + 14} r="4" fill="#a3e635" />
                              <circle cx="556" cy={yPos + 14} r="4" fill={i % 2 === 1 ? '#ef4444' : '#84cc16'} />
                            </g>
                          ))}

                          {/* Slumped Rusted Endoskeleton in Center-Back + Fiber Cables */}
                          <path d="M300,320 Q400,365 515,320" fill="none" stroke="#65a30d" strokeWidth="5" />
                          <path d="M300,330 Q410,385 515,328" fill="none" stroke="#365314" strokeWidth="4" />
                          <rect x="372" y="195" width="56" height="48" rx="8" fill="#18181b" stroke="#52525b" strokeWidth="2" />
                          <circle cx="388" cy="215" r="5" fill="#f59e0b" />
                          <circle cx="412" cy="215" r="5" fill="#09090b" />
                          <line x1="382" y1="232" x2="418" y2="232" stroke="#71717a" strokeWidth="3" strokeDasharray="4 3" />
                          <rect x="365" y="245" width="70" height="82" rx="6" fill="#18181b" stroke="#3f3f46" strokeWidth="2" />
                          <line x1="375" y1="262" x2="425" y2="262" stroke="#52525b" strokeWidth="3" />
                          <line x1="375" y1="280" x2="425" y2="280" stroke="#52525b" strokeWidth="3" />
                          <line x1="375" y1="298" x2="425" y2="298" stroke="#52525b" strokeWidth="3" />
                        </g>
                      )}

                      {/* =========================================================
                          CAM 07: SALA ARCADE 3,99$
                          AriGameplays 3,99$ Cabinet (Right) + Secondary KOI Cabinet (Left) + Arcade Stools
                         ========================================================= */}
                      {currentCam === 'CAM_07' && (
                        <g>
                          {/* Neon Retro Wall Sign */}
                          <rect x="275" y="55" width="155" height="36" rx="4" fill="#111c0d" stroke="#84cc16" strokeWidth="2" />
                          <text x="352" y="79" textAnchor="middle" fill="#bef264" fontSize="20" fontFamily="VT323, monospace">
                            ★ ZONA ARCADE VIP ★
                          </text>

                          {/* Secondary Vintage Arcade Machine on Left: KOI INVADERS */}
                          <rect x="175" y="95" width="145" height="238" rx="6" fill="#131c10" stroke="#365314" strokeWidth="3" />
                          <rect x="186" y="105" width="123" height="24" fill="#1e2f18" stroke="#65a30d" strokeWidth="1.5" />
                          <text x="247" y="122" textAnchor="middle" fill="#a3e635" fontSize="16" fontFamily="VT323, monospace">
                            ANDORRA INVADERS
                          </text>
                          <rect x="192" y="136" width="111" height="105" rx="4" fill="#070d06" stroke="#2e4423" strokeWidth="2" />
                          <text x="247" y="182" textAnchor="middle" fill="#4d7c0f" fontSize="16" fontFamily="VT323, monospace">
                            HIGH SCORE:
                          </text>
                          <text x="247" y="204" textAnchor="middle" fill="#84cc16" fontSize="18" fontFamily="VT323, monospace">
                            999.990 €
                          </text>
                          <polygon points="182,248 313,248 324,268 171,268" fill="#1f2e18" stroke="#3f5730" strokeWidth="2" />
                          <circle cx="210" cy="258" r="5" fill="#84cc16" />
                          <circle cx="280" cy="258" r="4" fill="#facc15" />

                          {/* Arcade Stools */}
                          <line x1="247" y1="305" x2="247" y2="355" stroke="#52525b" strokeWidth="6" />
                          <ellipse cx="247" cy="302" rx="26" ry="8" fill="#365314" stroke="#84cc16" strokeWidth="2" />
                          <line x1="385" y1="312" x2="385" y2="365" stroke="#52525b" strokeWidth="6" />
                          <ellipse cx="385" cy="309" rx="26" ry="8" fill="#831843" stroke="#ec4899" strokeWidth="2" />

                          {/* Primary Arcade Cabinet in CAM 07 (ARIGAMEPLAYS + 3,99$) */}
                          <rect
                            x="450"
                            y="70"
                            width="180"
                            height="265"
                            rx="8"
                            fill="#18181b"
                            stroke={isAriHere ? '#ec4899' : '#4d7c0f'}
                            strokeWidth="4"
                          />
                          {/* Arcade Marquee Top */}
                          <rect x="462" y="80" width="156" height="30" fill="#27272a" stroke="#a3e635" strokeWidth="2" />
                          <text
                            x="540"
                            y="101"
                            textAnchor="middle"
                            fill={isAriHere ? '#f472b6' : '#a3e635'}
                            fontSize="20"
                            fontFamily="VT323, monospace"
                            fontWeight="bold"
                          >
                            ARIGAMEPLAYS ARCADE
                          </text>
                          {/* Arcade Screen */}
                          <rect
                            x="468"
                            y="118"
                            width="144"
                            height="135"
                            rx="6"
                            fill={isAriHere ? '#1f0916' : '#0b1409'}
                            stroke={isAriHere ? '#f472b6' : '#365314'}
                            strokeWidth="3"
                          />
                          {!isAriHere && (
                            <text x="540" y="190" textAnchor="middle" fill="#4d7c0f" fontSize="18" fontFamily="VT323, monospace">
                              INSERT 3,99$
                            </text>
                          )}
                          {/* Controls Deck */}
                          <polygon points="460,260 620,260 635,285 445,285" fill="#27272a" stroke="#52525b" strokeWidth="2" />
                          <circle cx="495" cy="272" r="6" fill="#ef4444" />
                          <circle cx="575" cy="272" r="5" fill="#ec4899" />
                          <circle cx="592" cy="272" r="5" fill="#3b82f6" />
                        </g>
                      )}

                      {/* =========================================================
                          CAM 08: PASILLO DEL ABUELO (KNEKRO)
                          Claustrophobic Corridor + Puppet Music Box + Vintage Pokémon/LoL Trophies
                         ========================================================= */}
                      {currentCam === 'CAM_08' && (
                        <g>
                          {/* Deep Claustrophobic Hallway Doorframe */}
                          <rect x="275" y="70" width="250" height="260" fill="#050904" stroke="#2c4220" strokeWidth="3" />
                          {/* Overhead Swinging Lamp & Light Cone */}
                          <polygon points="400,95 275,330 525,330" fill="#84cc16" opacity="0.06" />
                          <line x1="400" y1="42" x2="400" y2="92" stroke="#65a30d" strokeWidth="2.5" />
                          <polygon points="382,92 418,92 426,108 374,108" fill="#1a2914" stroke="#a3e635" strokeWidth="2" />
                          <circle cx="400" cy="110" r="6" fill="#ecfccb" />

                          {/* Framed Vintage Trophies on Left Wall (KNekro Lore) */}
                          <rect x="162" y="105" width="95" height="72" fill="#121d0e" stroke="#65a30d" strokeWidth="2" />
                          <text x="209" y="132" textAnchor="middle" fill="#fde047" fontSize="14" fontFamily="VT323, monospace">
                            🏆 POKÉMON 1999
                          </text>
                          <text x="209" y="154" textAnchor="middle" fill="#a3e635" fontSize="13" fontFamily="VT323, monospace">
                            EL ABUELO KNEKRO
                          </text>

                          {/* Unwound Puppet Music Box in Lower Left Corner */}
                          <rect x="172" y="248" width="88" height="82" fill="#1e1b4b" stroke="#a855f7" strokeWidth="2.5" />
                          <line x1="216" y1="248" x2="216" y2="330" stroke="#facc15" strokeWidth="6" />
                          <line x1="172" y1="289" x2="260" y2="289" stroke="#facc15" strokeWidth="6" />
                          <text x="216" y="238" textAnchor="middle" fill="#d8b4fe" fontSize="13" fontFamily="VT323, monospace">
                            CAJA DE MÚSICA
                          </text>

                          {/* Right Wall: Damp Brick Cracks & Vent Grate CAM 12 */}
                          <rect x="548" y="115" width="90" height="90" fill="#10190c" stroke="#365314" strokeWidth="2" />
                          <text x="593" y="152" textAnchor="middle" fill="#84cc16" fontSize="15" fontFamily="VT323, monospace">
                            CAM 08
                          </text>
                          <text x="593" y="175" textAnchor="middle" fill="#bef264" fontSize="13" fontFamily="VT323, monospace">
                            NO MIRAR FIJO
                          </text>
                          <rect x="552" y="275" width="80" height="48" fill="#050804" stroke="#4d7c0f" strokeWidth="2" />
                          <line x1="558" y1="290" x2="625" y2="290" stroke="#2e4423" strokeWidth="2" />
                          <line x1="558" y1="305" x2="625" y2="305" stroke="#2e4423" strokeWidth="2" />
                          <text x="592" y="270" textAnchor="middle" fill="#84cc16" fontSize="12" fontFamily="VT323, monospace">
                            VENT CAM 12
                          </text>
                        </g>
                      )}

                      {/* =========================================================
                          CAM 09: BÚNKER ANDORRA NORTE (AURONPLAY SPAWN ROOM)
                          Armored Bank Vault Door + Broken Restraint Chains + Tax Haven Money Bags
                         ========================================================= */}
                      {currentCam === 'CAM_09' && (
                        <g>
                          {/* Circular Armored Vault Door in Back Wall */}
                          <rect x="255" y="65" width="290" height="265" fill="#0c140a" stroke="#365314" strokeWidth="3" />
                          <circle cx="400" cy="198" r="105" fill="#142011" stroke="#65a30d" strokeWidth="5" />
                          <circle cx="400" cy="198" r="82" fill="#091008" stroke="#3f6212" strokeWidth="3" />
                          {/* Vault Wheel Spokes */}
                          <circle cx="400" cy="198" r="22" fill="#1e2f18" stroke="#a3e635" strokeWidth="3" />
                          <line x1="400" y1="150" x2="400" y2="246" stroke="#84cc16" strokeWidth="4" />
                          <line x1="352" y1="198" x2="448" y2="198" stroke="#84cc16" strokeWidth="4" />
                          <text x="400" y="86" textAnchor="middle" fill="#bef264" fontSize="18" fontFamily="VT323, monospace">
                            BÓVEDA ACORAZADA #09 · ORIGEN AURON
                          </text>

                          {/* Broken Animatronic Restraint Chains Hanging from Ceiling */}
                          <line x1="215" y1="42" x2="215" y2="185" stroke="#52525b" strokeWidth="5" strokeDasharray="8 4" />
                          <circle cx="215" cy="192" r="9" fill="none" stroke="#a3e635" strokeWidth="3" />
                          <line x1="585" y1="42" x2="585" y2="175" stroke="#52525b" strokeWidth="5" strokeDasharray="8 4" />
                          <circle cx="585" cy="182" r="9" fill="none" stroke="#a3e635" strokeWidth="3" />

                          {/* Andorra Money Sacks & Gold Bullion Pallet (Left) */}
                          <ellipse cx="205" cy="302" rx="38" ry="32" fill="#27381c" stroke="#65a30d" strokeWidth="2" />
                          <text x="205" y="310" textAnchor="middle" fill="#bef264" fontSize="24" fontFamily="VT323, monospace">
                            €€
                          </text>
                          <rect x="550" y="275" width="84" height="50" fill="#050804" stroke="#4d7c0f" strokeWidth="2" />
                          <line x1="556" y1="290" x2="628" y2="290" stroke="#2e4423" strokeWidth="2" />
                          <line x1="556" y1="305" x2="628" y2="305" stroke="#2e4423" strokeWidth="2" />
                          <text x="592" y="270" textAnchor="middle" fill="#84cc16" fontSize="12" fontFamily="VT323, monospace">
                            VENT CAM 11
                          </text>
                        </g>
                      )}

                      {/* =========================================================
                          CAM 10: SALA DE CRIPTO-MINERÍA
                          GPU Mining Rigs + Spinning Fans + Sparking 999 kW Power Meter + Coolant Drums
                         ========================================================= */}
                      {currentCam === 'CAM_10' && (
                        <g>
                          {/* Left & Center Multi-GPU Mining Racks */}
                          <rect x="165" y="92" width="235" height="235" fill="#0b1309" stroke="#4d7c0f" strokeWidth="3" />
                          <text x="282" y="114" textAnchor="middle" fill="#bef264" fontSize="17" fontFamily="VT323, monospace">
                            RIG MINADO ANDORRA · 120 GPUs
                          </text>
                          {[130, 190, 250].map((rowY) => (
                            <g key={rowY}>
                              <rect x="178" y={rowY} width="208" height="46" fill="#121e0f" stroke="#365314" strokeWidth="2" />
                              {[202, 248, 294, 340].map((fanX) => (
                                <g key={fanX}>
                                  <circle cx={fanX} cy={rowY + 23} r="16" fill="#070c06" stroke="#65a30d" strokeWidth="2" />
                                  <line x1={fanX - 10} y1={rowY + 13} x2={fanX + 10} y2={rowY + 33} stroke="#84cc16" strokeWidth="2" />
                                  <line x1={fanX + 10} y1={rowY + 13} x2={fanX - 10} y2={rowY + 33} stroke="#84cc16" strokeWidth="2" />
                                  <circle cx={fanX} cy={rowY + 23} r="4" fill="#a3e635" />
                                </g>
                              ))}
                            </g>
                          ))}

                          {/* Sparking High-Voltage Power Meter (Right) */}
                          <rect x="445" y="105" width="115" height="135" rx="4" fill="#162112" stroke="#facc15" strokeWidth="2.5" />
                          <text x="502" y="130" textAnchor="middle" fill="#fde047" fontSize="16" fontFamily="VT323, monospace">
                            CONSUMO ELÉCTRICO
                          </text>
                          <rect x="460" y="140" width="85" height="42" fill="#060a05" stroke="#65a30d" strokeWidth="1.5" />
                          <text x="502" y="168" textAnchor="middle" fill="#ef4444" fontSize="22" fontFamily="VT323, monospace">
                            999.9 kW
                          </text>
                          <text x="502" y="205" textAnchor="middle" fill="#a3e635" fontSize="13" fontFamily="VT323, monospace">
                            TARIFA PIRINEOS
                          </text>
                          <text x="502" y="225" textAnchor="middle" fill="#facc15" fontSize="12" fontFamily="VT323, monospace">
                            ⚡ SOBRECARGA ⚡
                          </text>

                          {/* Coolant Barrel & Vent Grate CAM 14 */}
                          <rect x="455" y="255" width="65" height="75" rx="6" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
                          <line x1="455" y1="280" x2="520" y2="280" stroke="#38bdf8" strokeWidth="2" />
                          <text x="487" y="305" textAnchor="middle" fill="#7dd3fc" fontSize="12" fontFamily="VT323, monospace">
                            COOLANT
                          </text>
                          <rect x="550" y="275" width="84" height="50" fill="#050804" stroke="#4d7c0f" strokeWidth="2" />
                          <line x1="556" y1="290" x2="628" y2="290" stroke="#2e4423" strokeWidth="2" />
                          <line x1="556" y1="305" x2="628" y2="305" stroke="#2e4423" strokeWidth="2" />
                          <text x="592" y="270" textAnchor="middle" fill="#84cc16" fontSize="12" fontFamily="VT323, monospace">
                            VENT CAM 14
                          </text>
                        </g>
                      )}
                    </g>
                  )}
                </svg>

                {/* ARIGAMEPLAYS FACE + 3,99$ ON THE ARCADE MACHINE IN CAM 07 */}
                {isAriHere && (
                  <div className="absolute right-[14%] top-[14%] w-48 md:w-56 flex flex-col items-center z-20 animate-pulse">
                    <div className="w-36 h-40 overflow-hidden rounded border-2 border-pink-500 bg-black/95 flex items-center justify-center shadow-[0_0_25px_rgba(236,72,153,0.8)] p-1">
                      <StreamerFaceOnlyAvatar id="ARIGAMEPLAYS" className="w-full h-full" />
                    </div>
                    <div className="mt-1 px-4 py-1 bg-black border-2 border-pink-500 shadow-[0_0_20px_rgba(236,72,153,0.9)]">
                      <span className="text-3xl md:text-4xl font-crt font-bold text-pink-400 tracking-wider">
                        3,99$
                      </span>
                    </div>
                    <span className="mt-1 text-sm font-crt text-pink-300 bg-black/90 px-2">
                      ¡CAMBIA DE CÁMARA RÁPIDO!
                    </span>
                  </div>
                )}

                {/* CRISTININI (PHANTOM MANGLE) HANGING IN CAM 04 */}
                {isCristininiHere && (
                  <div className="absolute top-0 left-1/4 z-20 flex flex-col items-center animate-bounce">
                    <CristininiMangleSprite className="w-52 h-56" />
                    <div className="bg-black/90 border border-pink-500 px-3 py-1 text-pink-400 font-crt text-xl">
                      ¡CRISTININI EN CAM 04! ¡APARTA LA MIRADA!
                    </div>
                  </div>
                )}

                {/* KNEKRO (PHANTOM PUPPET) STANDING IN CAM 08 HALLWAY */}
                {isKNekroHere && (
                  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center animate-pulse">
                    <KNekroPuppetSprite className="w-64 h-76 md:w-72 md:h-84" />
                    <div className="bg-black/95 border-2 border-lime-400 px-4 py-1 text-lime-300 font-crt text-2xl tracking-wider shadow-xl">
                      ¡KNEKRO EN CAM 08! ¡CAMBIA DE CÁMARA ANTES DE QUE TE BLOQUEE!
                    </div>
                  </div>
                )}


                {/* AURONPLAY (SPRINGTRAP) IN CURRENT CAMERA */}
                {isAuronHere && (
                  <div className="relative z-15 flex flex-col items-center justify-center">
                    <AuronSpringtrapSprite
                      pose={camNode.isVent ? 'vent' : 'standing'}
                      className={
                        camNode.isVent
                          ? 'w-56 h-56 md:w-64 md:h-64 animate-pulse'
                          : 'w-60 h-68 md:w-72 md:h-80'
                      }
                    />
                    <div className="mt-1 bg-black/85 border border-[#84cc16] px-3 py-0.5 text-[#bef264] font-crt text-xl tracking-wider">
                      {camNode.isVent
                        ? '¡AURONPLAY EN EL CONDUCTO! ¡HAZ DOBLE CLIC EN LA CÁMARA PARA SELLAR!'
                        : 'AURONPLAY DETECTADO — USA PLAY AUDIO EN UNA SALA CERCANA'}
                    </div>
                  </div>
                )}

                {/* CHIQUI-IBAI (PHANTOM BALLOON BOY) COVERING THE ENTIRE CAMERA LENS */}
                {isChiquiHere && (
                  <div className="absolute inset-0 z-25 bg-black/75 flex flex-col items-center justify-center animate-pulse">
                    <ChiquiIbaiSprite className="w-72 h-72 md:w-96 md:h-96 scale-110" />
                    <div className="bg-red-950/90 border-2 border-red-500 px-4 py-1 text-2xl font-crt text-yellow-300 tracking-widest">
                      ¡CHIQUI-IBAI! ¡CAMBIA DE CÁMARA YA!
                    </div>
                  </div>
                )}

                {/* SEALED VENT OVERLAY */}
                {camNode.isVent && sealedVent === currentCam && (
                  <div className="absolute inset-0 z-25 bg-black/60 border-4 border-amber-500/80 flex flex-col items-center justify-center">
                    <Lock className="w-16 h-16 text-amber-400 mb-2" />
                    <span className="text-3xl font-crt text-amber-300 tracking-widest">
                      COMPUERTA FISCAL SELLADA ({currentCam})
                    </span>
                  </div>
                )}
              </>
            )}

            {/* Room Description Subtitle */}
            <div className="absolute bottom-3 left-3 right-3 z-25 flex items-center justify-between text-base font-crt text-[#8fb873] bg-black/70 px-3 py-1 border border-[#2c4021]">
              <span>{camNode.description}</span>
              <span>DOBLE CLIC EN CAM 11-15 = SELLAR CONDUCTO</span>
            </div>
          </div>

          {/* BOTTOM CONTROLS BAR (PLAY AUDIO & CLOSE MONITOR) */}
          <div className="relative z-25 flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={onPlayAudio}
              disabled={audioError || audioCooldown > 0 || camNode.isVent}
              className={`flex items-center gap-2.5 px-5 py-2.5 border-2 font-crt text-2xl tracking-wider transition-colors cursor-pointer ${
                audioError
                  ? 'bg-red-950/60 border-red-600 text-red-400 cursor-not-allowed'
                  : camNode.isVent
                  ? 'bg-zinc-900 border-zinc-700 text-zinc-500 cursor-not-allowed'
                  : audioCooldown > 0
                  ? 'bg-[#172411] border-[#4b6b37] text-[#7ea167] cursor-wait'
                  : 'bg-[#1c3113] hover:bg-[#2a481c] border-[#84cc16] text-[#d9f99d]'
              }`}
            >
              <Volume2 className="w-6 h-6" />
              {audioError
                ? 'ERROR DE AUDIO (REINICIAR)'
                : camNode.isVent
                ? 'AUDIO SOLO EN SALAS (CAM 01-10)'
                : audioCooldown > 0
                ? `RECARGANDO AUDIO (${audioCooldown}s)...`
                : 'PLAY AUDIO («¡ABDUZCAN!»)'}
            </button>

            <button
              onClick={onCloseMonitor}
              className="px-6 py-2.5 bg-[#26381b] hover:bg-[#365227] border-2 border-[#a3e635] text-[#ecfccb] font-crt text-2xl tracking-widest cursor-pointer"
            >
              ▼ BAJAR MONITOR DE CÁMARAS ▼
            </button>
          </div>
        </div>

        {/* RIGHT SIDE: INTERACTIVE FNAF 3 MAP & CAMERA BUTTONS */}
        <div className="relative z-25 w-full md:w-88 lg:w-96 bg-[#060a05] border-t-2 md:border-t-0 md:border-l-2 border-[#2f4522] p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[#2f4522] pb-2 mb-3">
              <div>
                <h3 className="text-2xl font-crt text-[#b7e486] tracking-wider">
                  {mapLayer === 'ROOMS' ? 'MAPA DE SALAS (CAM 01-10)' : 'CONDUCTOS VENT (CAM 11-15)'}
                </h3>
                <p className="text-sm font-crt text-[#7ca063]">
                  {mapLayer === 'ROOMS'
                    ? 'Atrae a AuronPlay con Play Audio'
                    : 'Doble clic en CAM 11-15 para sellar conducto'}
                </p>
              </div>
              <Radio className="w-6 h-6 text-[#84cc16] animate-pulse" />
            </div>

            {/* Interactive Schematic Map Box */}
            <div className="relative w-full h-72 bg-[#040703] border-2 border-[#354f26] mb-3 overflow-hidden">
              {/* Schematic Corridor Lines */}
              <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full">
                {mapLayer === 'ROOMS' ? (
                  <g stroke="#2c471f" strokeWidth="1.4" fill="none">
                    {/* Room connections */}
                    <line x1="28" y1="16" x2="78" y2="18" />
                    <line x1="28" y1="16" x2="24" y2="44" />
                    <line x1="78" y1="18" x2="42" y2="26" />
                    <line x1="78" y1="18" x2="56" y2="38" />
                    <line x1="42" y1="26" x2="24" y2="44" />
                    <line x1="42" y1="26" x2="56" y2="38" />
                    <line x1="42" y1="26" x2="48" y2="54" />
                    <line x1="24" y1="44" x2="48" y2="54" />
                    <line x1="56" y1="38" x2="48" y2="54" />
                    <line x1="56" y1="38" x2="80" y2="52" />
                    <line x1="48" y1="54" x2="80" y2="52" />
                    <line x1="48" y1="54" x2="68" y2="76" />
                    <line x1="80" y1="52" x2="68" y2="76" />
                    <line x1="80" y1="52" x2="84" y2="78" />
                    <line x1="84" y1="78" x2="68" y2="76" />
                    <line x1="68" y1="76" x2="42" y2="80" />
                    {/* Connection to Office */}
                    <line x1="42" y1="80" x2="48" y2="93" stroke="#ef4444" strokeDasharray="2 2" />
                    <line x1="68" y1="76" x2="56" y2="93" stroke="#ef4444" strokeDasharray="2 2" />
                  </g>
                ) : (
                  <g stroke="#eab308" strokeWidth="1.3" strokeDasharray="2 2" fill="none">
                    {/* CAM 09 (28,16) -> CAM 11 (48,14) -> CAM 07 (42,26) */}
                    <polyline points="28,16 48,14 42,26" />
                    {/* CAM 08 (24,44) -> CAM 12 (14,64) -> CAM 01 (42,80) */}
                    <polyline points="24,44 14,64 42,80" />
                    {/* CAM 07 (42,26) -> CAM 13 (32,60) -> CAM 01 (42,80) */}
                    <polyline points="42,26 32,60 42,80" />
                    {/* CAM 10 (78,18) & CAM 05 (48,54) -> CAM 14 (88,38) -> Office (56,93) */}
                    <line x1="78" y1="18" x2="88" y2="38" />
                    <line x1="48" y1="54" x2="88" y2="38" stroke="#f59e0b" strokeWidth="1.5" />
                    <line x1="88" y1="38" x2="56" y2="93" stroke="#ef4444" />
                    {/* CAM 02 (68,76) -> CAM 15 (68,90) -> Office (56,93) */}
                    <polyline points="68,76 68,90 56,93" stroke="#ef4444" />
                  </g>
                )}

                {/* YOU ARE HERE: HACIENDA OFFICE */}
                <rect x="44" y="89" width="16" height="9" fill="#172554" stroke="#facc15" strokeWidth="1.2" />
                <text x="52" y="95" textAnchor="middle" fill="#fde047" fontSize="4.2" fontFamily="monospace">
                  HACIENDA
                </text>
              </svg>

              {/* Camera Node Buttons on Map */}
              {(mapLayer === 'ROOMS' ? ROOM_CAMERAS : VENT_CAMERAS).map((camId) => {
                const node = CAMERA_NODES[camId];
                const isSelected = currentCam === camId;
                const isSealed = sealedVent === camId;

                return (
                  <button
                    key={camId}
                    onClick={() => onSelectCam(camId)}
                    style={{ left: `${node.x}%`, top: `${node.y}%` }}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 px-2 py-0.5 text-sm font-crt tracking-tight border transition-transform cursor-pointer ${
                      isSelected
                        ? 'bg-[#84cc16] text-black border-white font-bold scale-110 z-10'
                        : isSealed
                        ? 'bg-amber-500 text-black border-amber-200 font-bold'
                        : 'bg-[#111c0d] text-[#a3e635] border-[#4d7c0f] hover:bg-[#1e3316]'
                    }`}
                  >
                    {node.label}
                    {isSealed ? ' [X]' : ''}
                  </button>
                );
              })}
            </div>

            {/* Toggle Map Layer Button (Just like FNAF 3 "MAP TOGGLE") */}
            <button
              onClick={onToggleMapLayer}
              className="w-full py-2.5 bg-[#162410] hover:bg-[#223819] border-2 border-[#65a30d] text-[#d9f99d] font-crt text-xl tracking-widest cursor-pointer mb-3"
            >
              ⇄ CAMBIAR MAPA: {mapLayer === 'ROOMS' ? 'VER CONDUCTOS (CAM 11-15)' : 'VER SALAS (CAM 01-10)'}
            </button>
          </div>

          {/* Quick Tips Box */}
          <div className="bg-[#0b1309] border border-[#2f4522] p-3 text-sm font-crt text-[#99bd80] space-y-1">
            <div className="flex items-center gap-1.5 text-amber-400 font-bold text-base">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>MANUAL DEL INSPECTOR DE HACIENDA:</span>
            </div>
            <p>• AuronPlay va hacia la oficina. Usa PLAY AUDIO en una cámara vecina para hacerlo retroceder.</p>
            <p>• Si Auron entra en CAM 11–15, haz DOBLE CLIC sobre esa cámara para cerrar la compuerta.</p>
            <p>• Si ves a AriGameplays (3,99$), Cristinini o Chiqui-Ibai en cámara, ¡cambia de cámara al instante!</p>
          </div>
        </div>
      </div>
    </div>
  );
};
