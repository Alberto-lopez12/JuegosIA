import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BLOCKS, CHUNK_SIZE } from '../game/blocks';
import type { DimensionId, DiscoveredStructure, Waypoint } from '../game/types';
import { decodeChunkMapSlice } from '../game/world';

interface WorldMapModalProps {
  worldName: string;
  dimension: DimensionId;
  exploredVersion: number;
  getExploredChunks: () => ReadonlyMap<string, string>;
  getPlayerTransform: () => { x: number; y: number; z: number; yaw: number };
  initialSpawn: [number, number, number];
  bedSpawn: [number, number, number] | null;
  discoveredStructures: DiscoveredStructure[];
  waypoints: Waypoint[];
  onAddWaypoint: (name: string, x: number, z: number, color: string) => void;
  onRemoveWaypoint: (id: string) => void;
  onClose: () => void;
}

const WAYPOINT_COLORS = [
  { hex: '#ef4444', label: 'Rojo' },
  { hex: '#f59e0b', label: 'Ámbar' },
  { hex: '#10b981', label: 'Esmeralda' },
  { hex: '#38bdf8', label: 'Cielo' },
  { hex: '#a855f7', label: 'Violeta' },
  { hex: '#f43f5e', label: 'Rosa' },
];

function parseHexRgb(hex: string): [number, number, number] {
  const clean = hex.startsWith('#') ? hex.slice(1) : hex;
  const n = parseInt(clean, 16);
  if (Number.isNaN(n)) return [128, 128, 128];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const WorldMapModal: React.FC<WorldMapModalProps> = ({
  worldName,
  dimension,
  exploredVersion,
  getExploredChunks,
  getPlayerTransform,
  initialSpawn,
  bedSpawn,
  discoveredStructures,
  waypoints,
  onAddWaypoint,
  onRemoveWaypoint,
  onClose,
}) => {
  const isNether = dimension === 'nether';
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const tileCacheRef = useRef<Map<string, { raw: string; canvas: HTMLCanvasElement }>>(new Map());

  useEffect(() => {
    tileCacheRef.current.clear();
  }, [dimension]);

  const initialPlayer = useMemo(() => getPlayerTransform(), [getPlayerTransform]);
  const [center, setCenter] = useState<{ x: number; z: number }>({
    x: initialPlayer.x,
    z: initialPlayer.z,
  });
  const [zoom, setZoom] = useState<number>(2.5); // pixels per world block (0.6 .. 6)
  const [waypointMode, setWaypointMode] = useState(false);
  const [pendingWp, setPendingWp] = useState<{ x: number; z: number } | null>(null);
  const [wpName, setWpName] = useState('');
  const [wpColor, setWpColor] = useState(WAYPOINT_COLORS[0].hex);
  const [cursorCoords, setCursorCoords] = useState<{ x: number; z: number } | null>(null);

  const dragRef = useRef<{
    active: boolean;
    pointerId: number;
    startX: number;
    startY: number;
    origCx: number;
    origCz: number;
    moved: boolean;
  } | null>(null);

  const getOrBuildChunkTile = useCallback((key: string, encoded: string): HTMLCanvasElement => {
    const cached = tileCacheRef.current.get(key);
    if (cached && cached.raw === encoded) return cached.canvas;

    const tile = document.createElement('canvas');
    tile.width = CHUNK_SIZE;
    tile.height = CHUNK_SIZE;
    const tctx = tile.getContext('2d')!;
    const img = tctx.createImageData(CHUNK_SIZE, CHUNK_SIZE);
    const bytes = decodeChunkMapSlice(encoded);
    const tierShades = [0.84, 0.96, 1.08, 1.2];

    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const b = bytes[lz * CHUNK_SIZE + lx];
        const blockId = b & 0x3f;
        const tier = (b >>> 6) & 0x03;
        const [r, g, bl] = parseHexRgb(BLOCKS[blockId]?.mapColor ?? '#6ca443');
        let shade = tierShades[tier];
        // Subtle north-edge contour contrast
        if (lz > 0) {
          const prevTier = (bytes[(lz - 1) * CHUNK_SIZE + lx] >>> 6) & 0x03;
          if (tier > prevTier) shade *= 1.12;
          else if (tier < prevTier) shade *= 0.88;
        }
        const idx = (lz * CHUNK_SIZE + lx) * 4;
        img.data[idx] = Math.min(255, Math.round(r * shade));
        img.data[idx + 1] = Math.min(255, Math.round(g * shade));
        img.data[idx + 2] = Math.min(255, Math.round(bl * shade));
        img.data[idx + 3] = 255;
      }
    }
    tctx.putImageData(img, 0, 0);
    tileCacheRef.current.set(key, { raw: encoded, canvas: tile });
    return tile;
  }, []);

  const screenToWorld = useCallback(
    (clientX: number, clientY: number): { x: number; z: number } | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const sx = clientX - rect.left;
      const sy = clientY - rect.top;
      const wx = center.x + (sx - rect.width * 0.5) / zoom;
      const wz = center.z + (sy - rect.height * 0.5) / zoom;
      return { x: Math.round(wx), z: Math.round(wz) };
    },
    [center.x, center.z, zoom]
  );

  // Render full parchment cartographic map canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const w = Math.max(300, Math.floor(container.clientWidth));
    const h = Math.max(240, Math.floor(container.clientHeight));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Warm antique parchment (Overworld) or dark crimson-obsidian chart (Nether)
    ctx.fillStyle = isNether ? '#2a1114' : '#c8b68e';
    ctx.fillRect(0, 0, w, h);

    // Subtle cartographic parchment grid
    const halfW = w * 0.5;
    const halfH = h * 0.5;
    const worldToScreenX = (wx: number) => halfW + (wx - center.x) * zoom;
    const worldToScreenY = (wz: number) => halfH + (wz - center.z) * zoom;

    const minWx = center.x - halfW / zoom;
    const maxWx = center.x + halfW / zoom;
    const minWz = center.z - halfH / zoom;
    const maxWz = center.z + halfH / zoom;

    const gridStep = zoom < 1.2 ? 64 : 32;
    ctx.strokeStyle = isNether ? 'rgba(235, 110, 82, 0.16)' : 'rgba(92, 72, 46, 0.16)';
    ctx.lineWidth = 1;
    const startGx = Math.floor(minWx / gridStep) * gridStep;
    for (let wx = startGx; wx <= maxWx; wx += gridStep) {
      const sx = Math.round(worldToScreenX(wx)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, h);
      ctx.stroke();
    }
    const startGz = Math.floor(minWz / gridStep) * gridStep;
    for (let wz = startGz; wz <= maxWz; wz += gridStep) {
      const sy = Math.round(worldToScreenY(wz)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, sy);
      ctx.lineTo(w, sy);
      ctx.stroke();
    }

    // Draw all explored chunks (Fog of War revealed)
    ctx.imageSmoothingEnabled = false;
    const explored = getExploredChunks();
    const tilePx = CHUNK_SIZE * zoom;
    for (const [key, encoded] of explored.entries()) {
      const [cxStr, czStr] = key.split(',');
      const cx = Number(cxStr);
      const cz = Number(czStr);
      const wx = cx * CHUNK_SIZE;
      const wz = cz * CHUNK_SIZE;
      if (wx + CHUNK_SIZE < minWx || wx > maxWx || wz + CHUNK_SIZE < minWz || wz > maxWz) {
        continue;
      }
      const sx = worldToScreenX(wx);
      const sy = worldToScreenY(wz);
      const tile = getOrBuildChunkTile(key, encoded);
      ctx.drawImage(tile, sx, sy, Math.ceil(tilePx) + 0.5, Math.ceil(tilePx) + 0.5);
    }

    // Draw Spawn point marker
    const drawPinLabel = (sx: number, sy: number, text: string, bg: string) => {
      ctx.font = 'bold 11px monospace';
      const tw = ctx.measureText(text).width;
      ctx.fillStyle = 'rgba(18, 16, 14, 0.82)';
      ctx.fillRect(sx - tw * 0.5 - 4, sy + 10, tw + 8, 16);
      ctx.strokeStyle = bg;
      ctx.lineWidth = 1;
      ctx.strokeRect(sx - tw * 0.5 - 4, sy + 10, tw + 8, 16);
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, sx, sy + 18);
    };

    if (!isNether) {
      const spX = worldToScreenX(initialSpawn[0]);
      const spY = worldToScreenY(initialSpawn[2]);
      ctx.save();
      ctx.translate(spX, spY);
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#38bdf8';
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('S', 0, 0.5);
      ctx.restore();
      drawPinLabel(spX, spY, 'Spawn', '#38bdf8');

      // Bed respawn marker (Overworld only)
      if (bedSpawn) {
        const bx = worldToScreenX(bedSpawn[0]);
        const by = worldToScreenY(bedSpawn[2]);
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(bx - 7, by - 5, 14, 10);
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(bx - 7, by - 5, 5, 10);
        ctx.strokeStyle = '#111111';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(bx - 7, by - 5, 14, 10);
        drawPinLabel(bx, by, 'Cama', '#ef4444');
      }
    }

    // Discovered structures
    for (const st of discoveredStructures) {
      const sx = worldToScreenX(st.x);
      const sy = worldToScreenY(st.z);
      ctx.save();
      ctx.translate(sx, sy);
      if (st.type === 'village') {
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.moveTo(0, -8);
        ctx.lineTo(8, -1);
        ctx.lineTo(6, -1);
        ctx.lineTo(6, 7);
        ctx.lineTo(-6, 7);
        ctx.lineTo(-6, -1);
        ctx.lineTo(-8, -1);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#1f160d';
        ctx.lineWidth = 1.6;
        ctx.stroke();
      } else if (st.type === 'desert_pyramid') {
        ctx.fillStyle = '#ea580c';
        ctx.beginPath();
        ctx.moveTo(0, -8);
        ctx.lineTo(8, 7);
        ctx.lineTo(-8, 7);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#1f160d';
        ctx.lineWidth = 1.6;
        ctx.stroke();
      } else if (st.type === 'nether_fortress') {
        // Crenellated crimson Nether Fortress emblem
        ctx.fillStyle = '#b91c1c';
        ctx.fillRect(-7, -5, 14, 12);
        ctx.fillRect(-7, -8, 4, 4);
        ctx.fillRect(-2, -8, 4, 4);
        ctx.fillRect(3, -8, 4, 4);
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-7, -5, 14, 12);
      } else {
        ctx.fillStyle = '#60a5fa';
        ctx.fillRect(-6, -7, 12, 14);
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.6;
        ctx.strokeRect(-6, -7, 12, 14);
      }
      ctx.restore();
      drawPinLabel(
        sx,
        sy,
        st.name,
        st.type === 'village'
          ? '#f59e0b'
          : st.type === 'desert_pyramid'
          ? '#ea580c'
          : st.type === 'nether_fortress'
          ? '#dc2626'
          : '#60a5fa'
      );
    }

    // User Waypoints
    for (const wp of waypoints) {
      const sx = worldToScreenX(wp.x);
      const sy = worldToScreenY(wp.z);
      ctx.save();
      ctx.translate(sx, sy);
      ctx.beginPath();
      ctx.arc(0, 0, 6.5, 0, Math.PI * 2);
      ctx.fillStyle = wp.color;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
      drawPinLabel(sx, sy, wp.name, wp.color);
    }

    // Player directional arrow
    const pl = getPlayerTransform();
    const px = worldToScreenX(pl.x);
    const py = worldToScreenY(pl.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-pl.yaw);
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(7, 8);
    ctx.lineTo(0, 4);
    ctx.lineTo(-7, 8);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // Cardinal compass stamp inside map corners
    ctx.font = 'bold 14px monospace';
    ctx.fillStyle = isNether ? 'rgba(255, 224, 198, 0.85)' : 'rgba(42, 30, 18, 0.85)';
    ctx.textAlign = 'center';
    ctx.fillText('N', halfW, 18);
    ctx.fillText('S', halfW, h - 10);
    ctx.textAlign = 'left';
    ctx.fillText('O', 12, halfH + 4);
    ctx.textAlign = 'right';
    ctx.fillText('E', w - 12, halfH + 4);
  }, [
    isNether,
    center,
    zoom,
    exploredVersion,
    getExploredChunks,
    getPlayerTransform,
    getOrBuildChunkTile,
    initialSpawn,
    bedSpawn,
    discoveredStructures,
    waypoints,
  ]);

  const handleOpenWaypointAt = (wx: number, wz: number) => {
    // If right-clicking directly on an existing waypoint, remove it immediately
    const hitExisting = waypoints.find(
      (w) => Math.hypot((w.x - wx) * zoom, (w.z - wz) * zoom) <= 16
    );
    if (hitExisting) {
      onRemoveWaypoint(hitExisting.id);
      return;
    }
    setPendingWp({ x: wx, z: wz });
    setWpName(`Marca ${waypoints.length + 1}`);
  };

  const handleConfirmWaypoint = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingWp) return;
    onAddWaypoint(wpName, pendingWp.x, pendingWp.z, wpColor);
    setPendingWp(null);
    setWaypointMode(false);
  };

  const exploredCount = getExploredChunks().size;

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/75 p-2 sm:p-5 pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Mapa del Mundo"
      data-testid="world-map-modal"
    >
      <div
        className={`w-full h-full max-w-6xl max-h-[92vh] border-4 shadow-[0_14px_42px_rgba(0,0,0,0.85)] flex flex-col overflow-hidden ${
          isNether ? 'bg-[#2a1216] border-[#7a2c2c]' : 'bg-[#36281c] border-[#6c5138]'
        }`}
      >
        {/* Header Bar */}
        <div
          className={`flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2.5 border-b-2 text-[#f5e7c9] ${
            isNether ? 'bg-[#1e0b0e] border-[#6b2424]' : 'bg-[#281d14] border-[#5b432e]'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="font-pixel text-sm sm:text-base tracking-wide truncate">
              Mapa · {worldName}
            </h2>
            <span
              data-testid="world-map-dimension"
              className={`px-2 py-0.5 text-[10px] font-pixel border ${
                isNether
                  ? 'bg-rose-950/90 border-rose-500/70 text-rose-200'
                  : 'bg-emerald-950/80 border-emerald-500/60 text-emerald-200'
              }`}
            >
              {isNether ? 'The Nether' : 'Overworld'}
            </span>
            <span className="hidden sm:inline font-mono-hud text-xs text-[#cbb894]">
              {exploredCount} chunks explorados
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.6, Number((z * 0.8).toFixed(2))))}
              aria-label="Alejar mapa"
              className="mc-button px-2.5 py-1 font-pixel text-xs text-white cursor-pointer"
            >
              -
            </button>
            <span className="font-mono-hud text-xs w-11 text-center tabular-nums">
              {Math.round(zoom * 40)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(6, Number((z * 1.25).toFixed(2))))}
              aria-label="Acercar mapa"
              className="mc-button px-2.5 py-1 font-pixel text-xs text-white cursor-pointer"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => {
                const p = getPlayerTransform();
                setCenter({ x: p.x, z: p.z });
              }}
              className="mc-button px-2.5 py-1 font-pixel text-[10px] sm:text-xs text-white cursor-pointer"
            >
              Centrar
            </button>
            <button
              type="button"
              onClick={() => setWaypointMode((v) => !v)}
              className={`px-2.5 py-1 font-pixel text-[10px] sm:text-xs cursor-pointer border-2 ${
                waypointMode
                  ? 'bg-emerald-700 border-emerald-300 text-white'
                  : 'mc-button text-white'
              }`}
            >
              {waypointMode ? 'Toca el mapa...' : '+ Marcador'}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar mapa (M)"
              className="mc-button-primary px-3 py-1 font-pixel text-xs text-white cursor-pointer"
            >
              Cerrar (M)
            </button>
          </div>
        </div>

        {/* Main Interactive Cartographic Canvas + Side Waypoints List */}
        <div className="relative flex-1 flex min-h-0">
          <div
            ref={containerRef}
            className="relative flex-1 min-w-0 min-h-0 overflow-hidden cursor-grab active:cursor-grabbing"
            style={{ touchAction: 'none' }}
          >
            <canvas
              ref={canvasRef}
              data-testid="world-map-canvas"
              className="block w-full h-full"
              onContextMenu={(e) => {
                e.preventDefault();
                const wpos = screenToWorld(e.clientX, e.clientY);
                if (wpos) handleOpenWaypointAt(wpos.x, wpos.z);
              }}
              onWheel={(e) => {
                e.preventDefault();
                const factor = e.deltaY < 0 ? 1.15 : 0.87;
                setZoom((z) => Math.max(0.6, Math.min(6, Number((z * factor).toFixed(2)))));
              }}
              onPointerDown={(e) => {
                if (e.button === 2) return;
                e.currentTarget.setPointerCapture(e.pointerId);
                dragRef.current = {
                  active: true,
                  pointerId: e.pointerId,
                  startX: e.clientX,
                  startY: e.clientY,
                  origCx: center.x,
                  origCz: center.z,
                  moved: false,
                };
              }}
              onPointerMove={(e) => {
                const wpos = screenToWorld(e.clientX, e.clientY);
                setCursorCoords(wpos);
                const d = dragRef.current;
                if (!d || !d.active || d.pointerId !== e.pointerId) return;
                const dx = e.clientX - d.startX;
                const dy = e.clientY - d.startY;
                if (Math.hypot(dx, dy) > 4) d.moved = true;
                setCenter({
                  x: d.origCx - dx / zoom,
                  z: d.origCz - dy / zoom,
                });
              }}
              onPointerUp={(e) => {
                const d = dragRef.current;
                if (d && d.pointerId === e.pointerId) {
                  const wasTap = !d.moved;
                  dragRef.current = null;
                  if (wasTap && waypointMode) {
                    const wpos = screenToWorld(e.clientX, e.clientY);
                    if (wpos) handleOpenWaypointAt(wpos.x, wpos.z);
                  }
                }
              }}
            />

            {/* Inline Waypoint Creation Popover */}
            {pendingWp && (
              <div className="absolute inset-0 bg-black/45 flex items-center justify-center p-4">
                <form
                  onSubmit={handleConfirmWaypoint}
                  className="mc-panel w-full max-w-xs p-4 text-[#222] flex flex-col gap-3"
                >
                  <div className="font-pixel text-sm">Nuevo Marcador</div>
                  <div className="font-mono-hud text-xs text-[#444]">
                    Coordenadas: X {pendingWp.x}, Z {pendingWp.z}
                  </div>
                  <label htmlFor="wp-name-input" className="sr-only">
                    Nombre del marcador
                  </label>
                  <input
                    id="wp-name-input"
                    type="text"
                    autoFocus
                    maxLength={24}
                    value={wpName}
                    onChange={(e) => setWpName(e.target.value)}
                    placeholder="Nombre del marcador..."
                    className="px-2.5 py-1.5 bg-[#1a1d21] text-white text-xs font-mono-hud border-2 border-[#555]"
                  />
                  <div className="flex items-center justify-between gap-1.5">
                    {WAYPOINT_COLORS.map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        aria-label={`Color ${c.label}`}
                        onClick={() => setWpColor(c.hex)}
                        className={`w-7 h-7 rounded-full border-2 cursor-pointer ${
                          wpColor === c.hex ? 'border-white scale-110' : 'border-black/50'
                        }`}
                        style={{ backgroundColor: c.hex }}
                      />
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setPendingWp(null)}
                      className="mc-button py-1.5 font-pixel text-xs text-white cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="mc-button-primary py-1.5 font-pixel text-xs text-white cursor-pointer"
                    >
                      Guardar
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>

          {/* Right Legend & Waypoints Panel (desktop) */}
          <aside
            className={`hidden md:flex w-60 border-l-2 p-3 flex-col gap-3 text-[#f2e2c2] overflow-y-auto ${
              isNether ? 'bg-[#220e11] border-[#6b2424]' : 'bg-[#2b2016] border-[#5b432e]'
            }`}
          >
            <div>
              <h3 className="font-pixel text-xs text-amber-300 mb-2">Leyenda</h3>
              <ul className="text-xs font-mono-hud flex flex-col gap-1.5">
                {isNether ? (
                  <>
                    <li className="flex items-center gap-2">
                      <span className="w-3 h-3 bg-[#b91c1c] inline-block border border-amber-200" />
                      Fortaleza ({discoveredStructures.filter((s) => s.type === 'nether_fortress').length})
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-3 h-3 bg-[#f97316] inline-block border border-black" />
                      Mar de Lava (Y=31)
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-3 h-3 bg-[#7a312e] inline-block border border-black" />
                      Netherrack / Almas
                    </li>
                  </>
                ) : (
                  <>
                    <li className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-[#38bdf8] inline-block border border-black" />
                      Spawn ({Math.round(initialSpawn[0])}, {Math.round(initialSpawn[2])})
                    </li>
                    {bedSpawn && (
                      <li className="flex items-center gap-2">
                        <span className="w-3 h-3 bg-[#dc2626] inline-block border border-black" />
                        Cama ({Math.round(bedSpawn[0])}, {Math.round(bedSpawn[2])})
                      </li>
                    )}
                    <li className="flex items-center gap-2">
                      <span className="w-3 h-3 bg-[#f59e0b] inline-block border border-black" />
                      Aldea ({discoveredStructures.filter((s) => s.type === 'village').length})
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-3 h-3 bg-[#ea580c] inline-block border border-black" />
                      Pirámide ({discoveredStructures.filter((s) => s.type === 'desert_pyramid').length})
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-3 h-3 bg-[#60a5fa] inline-block border border-black" />
                      Torre ({discoveredStructures.filter((s) => s.type === 'watchtower').length})
                    </li>
                  </>
                )}
              </ul>
            </div>

            <div className="border-t border-[#5b432e] pt-3 flex-1 flex flex-col gap-2">
              <h3 className="font-pixel text-xs text-amber-300">
                Marcadores ({waypoints.length})
              </h3>
              {waypoints.length === 0 ? (
                <p className="text-[11px] text-[#baa684] leading-snug">
                  Haz clic derecho en cualquier punto del mapa para fijar un marcador.
                </p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {waypoints.map((wp) => (
                    <div
                      key={wp.id}
                      className="flex items-center justify-between gap-1.5 bg-[#1e160f] border border-[#5b432e] px-2 py-1.5 text-xs"
                    >
                      <button
                        type="button"
                        onClick={() => setCenter({ x: wp.x, z: wp.z })}
                        className="flex items-center gap-2 min-w-0 text-left cursor-pointer"
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/70"
                          style={{ backgroundColor: wp.color }}
                        />
                        <div className="min-w-0">
                          <div className="truncate font-bold">{wp.name}</div>
                          <div className="text-[10px] font-mono-hud text-[#baa684]">
                            {wp.x}, {wp.z}
                          </div>
                        </div>
                      </button>
                      <button
                        type="button"
                        aria-label={`Eliminar marcador ${wp.name}`}
                        onClick={() => onRemoveWaypoint(wp.id)}
                        className="px-1.5 py-0.5 text-[10px] bg-rose-900/70 hover:bg-rose-700 text-white cursor-pointer"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>

        {/* Dedicated Footer Bar (never overlaps parchment compass letters) */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-1.5 bg-[#241b12] border-t-2 border-[#5b432e] text-[11px] font-mono-hud text-[#d9c49e]">
          <span>
            {cursorCoords
              ? `Cursor: X ${cursorCoords.x} · Z ${cursorCoords.z}`
              : 'Arrastra para mover · Rueda para zoom'}
          </span>
          <span className="text-[#baa684]">Clic derecho: crear/borrar marcador</span>
        </div>
      </div>
    </div>
  );
};
