import {
  AnimatronicId,
  AnimatronicState,
  NightmareBathroomStage,
  NodeId,
  isAnimatronicVisibleOnCamera,
  isVentNode,
} from './rules';
import { drawAnimatronic } from './animatronicsRenderer';

export interface CameraRoomMeta {
  id: NodeId;
  shortCode: string;
  name: string;
  sector: 'BUILDING' | 'VENT';
  description: string;
  mapX: number; // percentage 0..100 on facility mini-map
  mapY: number; // percentage 0..100 on facility mini-map
}

export const CAMERA_NODES: CameraRoomMeta[] = [
  {
    id: 'CAM_1A',
    shortCode: 'CAM 1A',
    name: 'Escenario Principal (Destruido)',
    sector: 'BUILDING',
    description: 'Escenario de madera colapsado con telones rasgados y focos rotos.',
    mapX: 48,
    mapY: 12,
  },
  {
    id: 'CAM_1B',
    shortCode: 'CAM 1B',
    name: 'Comedor Central',
    sector: 'BUILDING',
    description: 'Mesas desordenadas con patas rotas, sillas volcadas y restos de fiesta.',
    mapX: 46,
    mapY: 32,
  },
  {
    id: 'CAM_5',
    shortCode: 'CAM 05',
    name: 'Sala de Mantenimiento',
    sector: 'BUILDING',
    description: 'Estanterías con artilugios viejos, carcasas y endoesqueletos cubiertos de polvo.',
    mapX: 16,
    mapY: 24,
  },
  {
    id: 'CAM_3',
    shortCode: 'CAM 03',
    name: 'Pasillo de Baños y Conexión',
    sector: 'BUILDING',
    description: 'Pasillo lateral de acceso a los baños conectado al corredor hacia la oficina.',
    mapX: 82,
    mapY: 38,
  },
  {
    id: 'CAM_2A',
    shortCode: 'CAM 2A',
    name: 'Pasillo Oeste Norte',
    sector: 'BUILDING',
    description: 'Pasillo oscuro con pósters laterales y una luz tenue que titila.',
    mapX: 28,
    mapY: 56,
  },
  {
    id: 'CAM_2B',
    shortCode: 'CAM 2B',
    name: 'Esquina Pasillo Oeste',
    sector: 'BUILDING',
    description: 'Tramo final del pasillo oeste sin luz, en oscuridad profunda y pósters laterales.',
    mapX: 28,
    mapY: 76,
  },
  {
    id: 'CAM_4A',
    shortCode: 'CAM 4A',
    name: 'Pasillo Este Norte',
    sector: 'BUILDING',
    description: 'Foco frontal desde la cámara. Los animatrónicos aquí se acercan al lente proyectando sombra.',
    mapX: 68,
    mapY: 56,
  },
  {
    id: 'CAM_4B',
    shortCode: 'CAM 4B',
    name: 'Esquina Pasillo Este',
    sector: 'BUILDING',
    description: 'Pasillo este con carteles en las paredes y franja decorativa hacia la oficina.',
    mapX: 68,
    mapY: 76,
  },
  // Ventilation Network Cameras across the building
  {
    id: 'VENT_WEST',
    shortCode: 'VENT OESTE',
    name: 'Conducto Sector Oeste',
    sector: 'VENT',
    description: 'Conducto de ventilación secundario conectado al Pasillo Oeste.',
    mapX: 20,
    mapY: 58,
  },
  {
    id: 'VENT_CENTRAL',
    shortCode: 'VENT CENTRAL',
    name: 'Conducto Principal Edificio',
    sector: 'VENT',
    description: 'Arteria central de ventilación bajo el techo del comedor.',
    mapX: 48,
    mapY: 36,
  },
  {
    id: 'VENT_EAST',
    shortCode: 'VENT ESTE',
    name: 'Conducto Sector Este',
    sector: 'VENT',
    description: 'Acceso de Still Freddy y The Thing hacia el conducto central.',
    mapX: 78,
    mapY: 58,
  },
  {
    id: 'VENT_OFFICE',
    shortCode: 'VENT OFICINA',
    name: 'Conducto Superior Oficina',
    sector: 'VENT',
    description: 'Conducto sobre tu escritorio. ¡Séllalo con [W] si hay intrusos!',
    mapX: 48,
    mapY: 74,
  },
];

/**
 * Helper to draw perspective checkered floor tiles in a room or corridor.
 */
function drawPerspectiveCheckeredFloor(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  floorY: number,
  alpha = 0.16,
  topSpanRatio = 0.56
) {
  ctx.save();
  const rows = 5;
  const cols = 8;
  const topLeftX = width * (0.5 - topSpanRatio / 2);
  const topWidth = width * topSpanRatio;

  for (let r = 0; r < rows; r++) {
    const t0 = r / rows;
    const t1 = (r + 1) / rows;
    const y0 = floorY + (height - floorY) * (t0 * t0 * 0.35 + t0 * 0.65);
    const y1 = floorY + (height - floorY) * (t1 * t1 * 0.35 + t1 * 0.65);

    const spread0 = topWidth + (width * 1.18 - topWidth) * t0;
    const spread1 = topWidth + (width * 1.18 - topWidth) * t1;
    const left0 = width * 0.5 - spread0 * 0.5;
    const left1 = width * 0.5 - spread1 * 0.5;

    for (let c = 0; c < cols; c++) {
      const isEven = (r + c) % 2 === 0;
      ctx.fillStyle = isEven
        ? `rgba(210, 214, 224, ${alpha})`
        : `rgba(10, 12, 18, ${alpha * 1.8})`;
      ctx.beginPath();
      ctx.moveTo(left0 + (spread0 * c) / cols, y0);
      ctx.lineTo(left0 + (spread0 * (c + 1)) / cols, y0);
      ctx.lineTo(left1 + (spread1 * (c + 1)) / cols, y1);
      ctx.lineTo(left1 + (spread1 * c) / cols, y1);
      ctx.closePath();
      ctx.fill();
    }
  }
  // Subtle perspective grid lines
  ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.45})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(topLeftX, floorY);
  ctx.lineTo(topLeftX + topWidth, floorY);
  ctx.stroke();
  ctx.restore();
}

/**
 * Helper to draw a perspective-skewed poster on a left or right corridor wall.
 */
function drawPerspectiveWallPoster(
  ctx: CanvasRenderingContext2D,
  side: 'left' | 'right',
  xNear: number,
  xFar: number,
  yTopNear: number,
  yBottomNear: number,
  yTopFar: number,
  yBottomFar: number,
  accentColor: string,
  label: string,
  brightness = 1,
  tornCorner = false
) {
  ctx.save();
  const x0 = side === 'left' ? xNear : xFar;
  const x1 = side === 'left' ? xFar : xNear;
  const yt0 = side === 'left' ? yTopNear : yTopFar;
  const yt1 = side === 'left' ? yTopFar : yTopNear;
  const yb0 = side === 'left' ? yBottomNear : yBottomFar;
  const yb1 = side === 'left' ? yBottomFar : yBottomNear;

  // Poster paper background
  ctx.fillStyle = `rgba(${Math.round(38 * brightness)}, ${Math.round(35 * brightness)}, ${Math.round(42 * brightness)}, 0.92)`;
  ctx.strokeStyle = `rgba(${Math.round(95 * brightness)}, ${Math.round(85 * brightness)}, ${Math.round(75 * brightness)}, 0.75)`;
  ctx.lineWidth = 1.5;

  ctx.beginPath();
  ctx.moveTo(x0, yt0);
  ctx.lineTo(x1, yt1);
  if (tornCorner) {
    ctx.lineTo(x1, yb1 - (yb1 - yt1) * 0.22);
    ctx.lineTo(x0 + (x1 - x0) * 0.68, yb0 + (yb1 - yb0) * 0.75);
  } else {
    ctx.lineTo(x1, yb1);
  }
  ctx.lineTo(x0, yb0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Inner illustration block inside poster
  const midX = (x0 + x1) * 0.5;
  const midY = (yt0 + yt1 + yb0 + yb1) * 0.25;
  const w = Math.abs(x1 - x0) * 0.55;
  const h = Math.abs(yb0 - yt0) * 0.42;

  ctx.fillStyle = accentColor;
  ctx.globalAlpha = 0.35 + brightness * 0.45;
  ctx.fillRect(midX - w * 0.5, midY - h * 0.5, w, h);

  // Glowing animatronic eye dots or header strip inside poster
  ctx.fillStyle = `rgba(255, 240, 200, ${0.25 + brightness * 0.5})`;
  ctx.fillRect(midX - w * 0.45, midY - h * 0.82, w * 0.9, Math.max(2, h * 0.16));

  // Tiny label text
  ctx.globalAlpha = 0.35 + brightness * 0.55;
  ctx.fillStyle = '#e4e4e7';
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(label, midX, midY + h * 0.72);
  ctx.restore();
}

/**
 * CAM 1A: Destroyed Main Stage ("en la camara 1A tiene que haber un escenario destruido")
 */
function renderCam1ADestroyedStage(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  timeSec: number
) {
  const floorY = height * 0.71;

  // Back stage wall with cracked masonry and peeling wallpaper
  const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
  bgGrad.addColorStop(0, '#07080d');
  bgGrad.addColorStop(0.65, '#13111c');
  bgGrad.addColorStop(1, '#09090f');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  drawPerspectiveCheckeredFloor(ctx, width, height, floorY, 0.14, 0.78);

  // Deep cracks on the back stage wall
  ctx.strokeStyle = '#050508';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(width * 0.36, height * 0.12);
  ctx.lineTo(width * 0.39, height * 0.26);
  ctx.lineTo(width * 0.34, height * 0.41);
  ctx.lineTo(width * 0.38, height * 0.58);
  ctx.moveTo(width * 0.64, height * 0.18);
  ctx.lineTo(width * 0.61, height * 0.35);
  ctx.lineTo(width * 0.66, height * 0.52);
  ctx.stroke();

  // Tilted, cracked "SHOW STAGE" banner hanging crookedly by one chain
  ctx.save();
  ctx.translate(width * 0.5, height * 0.16);
  ctx.rotate(0.09);
  ctx.fillStyle = '#1c1917';
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 2;
  ctx.fillRect(-130, -18, 260, 36);
  ctx.strokeRect(-130, -18, 260, 36);
  // Diagonal crack splitting the banner
  ctx.fillStyle = '#09090b';
  ctx.beginPath();
  ctx.moveTo(12, -18);
  ctx.lineTo(28, -18);
  ctx.lineTo(-4, 18);
  ctx.lineTo(-16, 18);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fca5a5';
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('SHOW  STAGE', 0, 5);
  ctx.restore();

  // Left & Right Torn Velvet Stage Curtains (with jagged ripped bottoms & holes)
  const drawTornCurtain = (startX: number, curtainW: number, isLeft: boolean) => {
    ctx.save();
    const grad = ctx.createLinearGradient(startX, 0, startX + curtainW, 0);
    grad.addColorStop(0, '#2a0608');
    grad.addColorStop(0.5, '#540d12');
    grad.addColorStop(1, '#1f0406');
    ctx.fillStyle = grad;

    ctx.beginPath();
    ctx.moveTo(startX, 0);
    ctx.lineTo(startX + curtainW, 0);
    // Ripped side edge curving inward
    ctx.lineTo(
      isLeft ? startX + curtainW * 0.82 : startX + curtainW * 1.0,
      floorY - 55
    );
    // Jagged torn bottom hem
    const steps = 7;
    for (let i = steps; i >= 0; i--) {
      const px = startX + (curtainW * i) / steps;
      const py =
        floorY -
        28 +
        (i % 2 === 0 ? 18 : -24) -
        (isLeft && i > 4 ? 32 : !isLeft && i < 3 ? 35 : 0);
      ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    // Vertical fold lines & tear slashes
    ctx.strokeStyle = '#180203';
    ctx.lineWidth = 2;
    for (let f = 1; f <= 4; f++) {
      const fx = startX + (curtainW * f) / 5;
      ctx.beginPath();
      ctx.moveTo(fx, 0);
      ctx.lineTo(fx + (f % 2 === 0 ? 6 : -5), floorY - 45);
      ctx.stroke();
    }
    // Ripped hole in curtain
    ctx.fillStyle = '#07080d';
    ctx.beginPath();
    ctx.moveTo(startX + curtainW * 0.45, height * 0.28);
    ctx.lineTo(startX + curtainW * 0.65, height * 0.34);
    ctx.lineTo(startX + curtainW * 0.52, height * 0.46);
    ctx.lineTo(startX + curtainW * 0.38, height * 0.39);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  drawTornCurtain(0, width * 0.21, true);
  drawTornCurtain(width * 0.79, width * 0.21, false);

  // Overhead Stage Truss & Dangling Broken Spotlights
  ctx.fillStyle = '#18181b';
  ctx.fillRect(width * 0.15, 0, width * 0.7, 16);
  // Broken spotlight dangling on a sparking wire on left-center
  const swing = Math.sin(timeSec * 3.1) * 8;
  ctx.strokeStyle = '#52525b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(width * 0.31, 16);
  ctx.lineTo(width * 0.31 + swing, height * 0.24);
  ctx.stroke();
  ctx.fillStyle = '#27272a';
  ctx.fillRect(width * 0.31 + swing - 10, height * 0.24, 20, 16);
  if (Math.sin(timeSec * 19) > 0.65) {
    ctx.strokeStyle = '#fde047';
    ctx.beginPath();
    ctx.moveTo(width * 0.31 + swing, height * 0.24 + 16);
    ctx.lineTo(width * 0.31 + swing - 9, height * 0.24 + 28);
    ctx.moveTo(width * 0.31 + swing, height * 0.24 + 16);
    ctx.lineTo(width * 0.31 + swing + 11, height * 0.24 + 25);
    ctx.stroke();
  }

  // Destroyed Wooden Stage Platform (caved-in middle-right section, splintered planks, exposed beams)
  const stageTopY = floorY - 34;
  const stageH = 54;
  // Dark under-stage cavity
  ctx.fillStyle = '#050406';
  ctx.fillRect(width * 0.12, stageTopY, width * 0.76, stageH);

  // Exposed broken vertical support beams inside the caved-in hole
  ctx.fillStyle = '#271206';
  for (let b = 0; b < 6; b++) {
    const bx = width * (0.18 + b * 0.12);
    ctx.fillRect(bx, stageTopY + 8, 10, stageH - 8);
  }

  // Splintered wooden stage deck planks with a collapsed gap around width * 0.56..0.70
  ctx.fillStyle = '#3b1a08';
  ctx.strokeStyle = '#1c0a02';
  ctx.lineWidth = 2;
  // Left intact-ish broken stage section
  ctx.beginPath();
  ctx.moveTo(width * 0.11, stageTopY);
  ctx.lineTo(width * 0.56, stageTopY);
  ctx.lineTo(width * 0.59, stageTopY + 18);
  ctx.lineTo(width * 0.53, stageTopY + 34);
  ctx.lineTo(width * 0.57, stageTopY + stageH);
  ctx.lineTo(width * 0.11, stageTopY + stageH);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Right collapsed stage section (sunken downward)
  ctx.beginPath();
  ctx.moveTo(width * 0.67, stageTopY + 12);
  ctx.lineTo(width * 0.89, stageTopY + 4);
  ctx.lineTo(width * 0.89, stageTopY + stageH);
  ctx.lineTo(width * 0.64, stageTopY + stageH);
  ctx.lineTo(width * 0.69, stageTopY + 28);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Horizontal wood plank lines & jagged cracks across stage front
  ctx.strokeStyle = '#5c280c';
  ctx.lineWidth = 1.5;
  for (let py = stageTopY + 10; py < stageTopY + stageH; py += 12) {
    ctx.beginPath();
    ctx.moveTo(width * 0.12, py);
    ctx.lineTo(width * 0.55, py + (py % 24 === 0 ? 3 : -2));
    ctx.moveTo(width * 0.68, py + 6);
    ctx.lineTo(width * 0.88, py + 2);
    ctx.stroke();
  }

  // Loose splintered boards & fallen broken star prop lying on the floor in front of stage
  ctx.save();
  ctx.translate(width * 0.62, floorY + 28);
  ctx.rotate(0.24);
  ctx.fillStyle = '#4a210a';
  ctx.fillRect(-48, -6, 96, 12);
  ctx.strokeStyle = '#1c0a02';
  ctx.strokeRect(-48, -6, 96, 12);
  ctx.restore();

  // Fallen cracked yellow stage star on left floor
  ctx.save();
  ctx.translate(width * 0.25, floorY + 26);
  ctx.rotate(-0.35);
  ctx.fillStyle = '#854d0e';
  ctx.strokeStyle = '#422006';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const outerAngle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
    const innerAngle = outerAngle + Math.PI / 5;
    ctx.lineTo(Math.cos(outerAngle) * 20, Math.sin(outerAngle) * 20);
    ctx.lineTo(Math.cos(innerAngle) * 9, Math.sin(innerAngle) * 9);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/**
 * CAM 1B: Dining Area ("en la camara 1B tambien tiene que tener mesas con todo desordenado y con menos patas")
 */
function renderCam1BMessyDining(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
) {
  const floorY = height * 0.62;

  const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
  bgGrad.addColorStop(0, '#080910');
  bgGrad.addColorStop(0.6, '#121521');
  bgGrad.addColorStop(1, '#090b11');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Back wall decorative wainscoting & torn party garland
  ctx.fillStyle = '#1a1025';
  ctx.fillRect(0, floorY - 70, width, 70);
  ctx.strokeStyle = '#4c1d95';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, floorY - 70);
  ctx.lineTo(width, floorY - 70);
  ctx.stroke();

  // Torn hanging triangle party bunting on back wall
  ctx.strokeStyle = '#3f3f46';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(width * 0.1, height * 0.18);
  ctx.quadraticCurveTo(width * 0.35, height * 0.32, width * 0.52, height * 0.42);
  ctx.stroke();
  const flagColors = ['#7f1d1d', '#78350f', '#1e3a8a', '#14532d'];
  for (let i = 0; i < 6; i++) {
    const fx = width * (0.14 + i * 0.06);
    const fy = height * (0.21 + i * 0.032);
    ctx.fillStyle = flagColors[i % flagColors.length];
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(fx + 14, fy + 4);
    ctx.lineTo(fx + 5, fy + 20);
    ctx.closePath();
    ctx.fill();
  }

  drawPerspectiveCheckeredFloor(ctx, width, height, floorY, 0.16, 0.72);

  // Helper to draw a messy tilted dining table with missing/broken legs & scattered party items
  const drawTiltedMessyTable = (
    cx: number,
    cy: number,
    tableW: number,
    tiltRad: number,
    missingRightLeg: boolean
  ) => {
    ctx.save();
    ctx.translate(cx, cy);

    // 1. Table Legs (fewer legs! Only 1 intact leg + 1 snapped stump; missing leg lies on the floor)
    ctx.fillStyle = '#27170c';
    ctx.strokeStyle = '#140b05';
    ctx.lineWidth = 2;

    if (missingRightLeg) {
      // Intact left leg
      ctx.fillRect(-tableW * 0.42, 4, 12, 62);
      // Snapped center-left leg stump (broken jagged end)
      ctx.beginPath();
      ctx.moveTo(-tableW * 0.08, 6);
      ctx.lineTo(-tableW * 0.08 + 11, 6);
      ctx.lineTo(-tableW * 0.08 + 9, 32);
      ctx.lineTo(-tableW * 0.08 + 4, 24);
      ctx.lineTo(-tableW * 0.08, 35);
      ctx.closePath();
      ctx.fill();
      // Right leg is completely MISSING — draw the broken leg lying horizontally on the floor!
      ctx.save();
      ctx.translate(tableW * 0.34, 64);
      ctx.rotate(0.28);
      ctx.fillRect(-32, -5, 64, 10);
      ctx.restore();
    } else {
      // Left leg is MISSING — lying on the floor to the left
      ctx.save();
      ctx.translate(-tableW * 0.36, 62);
      ctx.rotate(-0.22);
      ctx.fillRect(-30, -5, 60, 10);
      ctx.restore();
      // Snapped middle stump
      ctx.fillRect(tableW * 0.04, 8, 10, 26);
      // Only back-right leg intact
      ctx.fillRect(tableW * 0.36, 2, 12, 64);
    }

    // 2. Tilted Tabletop & Torn Stained Tablecloth
    ctx.save();
    ctx.rotate(tiltRad);

    // Wooden tabletop base
    ctx.fillStyle = '#451a03';
    ctx.fillRect(-tableW * 0.5, -14, tableW, 24);

    // Torn, stained party tablecloth slipping off the table
    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.moveTo(-tableW * 0.48, -14);
    ctx.lineTo(tableW * 0.48, -14);
    ctx.lineTo(tableW * 0.5, 8);
    // Jagged dirty cloth edge
    for (let i = 8; i >= 0; i--) {
      const tx = -tableW * 0.48 + (tableW * 0.96 * i) / 8;
      const ty = 12 + (i % 2 === 0 ? 14 : 2);
      ctx.lineTo(tx, ty);
    }
    ctx.closePath();
    ctx.fill();

    // Red & pizza grease stains on tablecloth
    ctx.fillStyle = 'rgba(127, 29, 29, 0.55)';
    ctx.beginPath();
    ctx.ellipse(-tableW * 0.15, -2, 24, 7, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // 3. Messy clutter on top of the tilted table:
    // Overturned soda cup + dark spilled puddle
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(-tableW * 0.32, -22, 14, 9);
    ctx.fillStyle = '#450a0a';
    ctx.beginPath();
    ctx.ellipse(-tableW * 0.2, -12, 18, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Fallen party hat on table
    ctx.fillStyle = '#eab308';
    ctx.beginPath();
    ctx.moveTo(tableW * 0.05, -14);
    ctx.lineTo(tableW * 0.14, -30);
    ctx.lineTo(tableW * 0.21, -12);
    ctx.closePath();
    ctx.fill();

    // Crooked open pizza box & messy paper plates
    ctx.fillStyle = '#a16207';
    ctx.fillRect(tableW * 0.22, -21, 34, 8);
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.ellipse(-tableW * 0.02, -13, 14, 4, -0.15, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // 4. Overturned chair & spilled trash on the floor around the table
    ctx.save();
    ctx.translate(missingRightLeg ? -tableW * 0.56 : tableW * 0.54, 48);
    ctx.rotate(missingRightLeg ? -1.15 : 1.22);
    ctx.fillStyle = '#1e1b4b';
    ctx.fillRect(-14, -22, 28, 8);
    ctx.fillRect(-14, -22, 6, 36);
    ctx.fillRect(8, -14, 6, 28);
    ctx.restore();

    // Fallen party hat & crumpled plate on floor
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(missingRightLeg ? 35 : -42, 68);
    ctx.lineTo(missingRightLeg ? 48 : -28, 52);
    ctx.lineTo(missingRightLeg ? 56 : -20, 70);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  };

  // Left table tilted down to the right (missing right leg)
  drawTiltedMessyTable(width * 0.26, floorY + 26, width * 0.34, 0.14, true);
  // Right table tilted down to the left (missing left leg)
  drawTiltedMessyTable(width * 0.74, floorY + 30, width * 0.34, -0.13, false);
}

/**
 * CAM 05: Parts & Service ("en la camara 05 quiero estanterias y artilugios viejos con polvo y suciedad")
 */
function renderCam05DustyPartsAndService(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  timeSec: number
) {
  const floorY = height * 0.74;

  // Grimy industrial room background
  const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
  bgGrad.addColorStop(0, '#060709');
  bgGrad.addColorStop(0.55, '#121318');
  bgGrad.addColorStop(1, '#08090c');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Grime & oil streaks dripping down the walls ("suciedad")
  ctx.fillStyle = 'rgba(20, 15, 10, 0.65)';
  for (let i = 0; i < 9; i++) {
    const gx = width * (0.08 + i * 0.105);
    const gh = 90 + (i % 3) * 55;
    ctx.fillRect(gx, 0, 14 + (i % 2) * 8, gh);
  }

  // Dirty concrete floor with oil puddles
  ctx.fillStyle = '#0c0d10';
  ctx.fillRect(0, floorY, width, height - floorY);
  ctx.fillStyle = 'rgba(15, 23, 15, 0.55)';
  ctx.beginPath();
  ctx.ellipse(width * 0.28, floorY + 42, 75, 16, 0.08, 0, Math.PI * 2);
  ctx.ellipse(width * 0.74, floorY + 55, 62, 14, -0.1, 0, Math.PI * 2);
  ctx.fill();

  // Heavy industrial shelving units on left, back, and right walls ("estanterias")
  const shelfY1 = height * 0.23;
  const shelfY2 = height * 0.45;
  const shelfY3 = height * 0.65;

  // Vertical steel shelf posts
  ctx.fillStyle = '#27272a';
  [0.06, 0.34, 0.66, 0.94].forEach((px) => {
    ctx.fillRect(width * px - 5, height * 0.1, 10, floorY - height * 0.1);
  });

  // Horizontal rusty shelves
  [shelfY1, shelfY2, shelfY3].forEach((sy) => {
    ctx.fillStyle = '#3f2e21';
    ctx.fillRect(width * 0.05, sy, width * 0.9, 12);
    ctx.strokeStyle = '#18181b';
    ctx.lineWidth = 2;
    ctx.strokeRect(width * 0.05, sy, width * 0.9, 12);
  });

  // Old contraptions, spare animatronic heads, endoskeleton parts & tools on the shelves ("artilugios viejos")
  // Shelf 1 (Top): Spare hollowed animatronic masks, old oscilloscope with cracked screen, rusty gears
  const drawSpareMask = (mx: number, my: number, color: string) => {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(mx, my, 18, 0, Math.PI * 2);
    ctx.fill();
    // Hollow dark eye sockets
    ctx.fillStyle = '#050507';
    ctx.beginPath();
    ctx.arc(mx - 6, my - 3, 4.5, 0, Math.PI * 2);
    ctx.arc(mx + 6, my - 3, 4.5, 0, Math.PI * 2);
    ctx.fill();
    // Sinister pinprick in one socket
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(mx - 7, my - 4, 2, 2);
    ctx.restore();
  };

  drawSpareMask(width * 0.14, shelfY1 - 16, '#451a03'); // Old Freddy mask
  drawSpareMask(width * 0.24, shelfY1 - 16, '#1e1b4b'); // Old Bonnie mask
  drawSpareMask(width * 0.82, shelfY1 - 16, '#713f12'); // Old Chica head shell

  // Vintage CRT oscilloscope / diagnostic contraption on top-right shelf
  ctx.fillStyle = '#27272a';
  ctx.fillRect(width * 0.68, shelfY1 - 38, 48, 38);
  ctx.fillStyle = '#052e16';
  ctx.fillRect(width * 0.69, shelfY1 - 33, 28, 22);
  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(width * 0.69, shelfY1 - 22);
  ctx.lineTo(width * 0.71, shelfY1 - 29);
  ctx.lineTo(width * 0.73, shelfY1 - 16);
  ctx.lineTo(width * 0.76, shelfY1 - 22);
  ctx.stroke();

  // Shelf 2 (Middle): Rusted gears, endoskeleton skull & ribcage, hydraulic canisters, tangled cables
  const drawGear = (gx: number, gy: number, r: number) => {
    ctx.save();
    ctx.fillStyle = '#52525b';
    ctx.strokeStyle = '#18181b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(gx, gy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#09090b';
    ctx.beginPath();
    ctx.arc(gx, gy, r * 0.38, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
  drawGear(width * 0.12, shelfY2 - 16, 15);
  drawGear(width * 0.16, shelfY2 - 12, 11);

  // Old Endoskeleton skull & jaw contraption on middle-left shelf
  ctx.fillStyle = '#71717a';
  ctx.fillRect(width * 0.23, shelfY2 - 34, 26, 22);
  ctx.fillStyle = '#09090b';
  ctx.fillRect(width * 0.25, shelfY2 - 29, 7, 7);
  ctx.fillRect(width * 0.30, shelfY2 - 29, 7, 7);
  // Metal teeth
  ctx.fillStyle = '#d4d4d8';
  for (let t = 0; t < 4; t++) {
    ctx.fillRect(width * 0.24 + t * 6, shelfY2 - 12, 4, 6);
  }

  // Old battery generator & pressure gauge contraption on middle-right shelf
  ctx.fillStyle = '#3f3f46';
  ctx.fillRect(width * 0.72, shelfY2 - 36, 42, 36);
  ctx.fillStyle = '#fef3c7';
  ctx.beginPath();
  ctx.arc(width * 0.76, shelfY2 - 22, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#dc2626';
  ctx.beginPath();
  ctx.moveTo(width * 0.76, shelfY2 - 22);
  ctx.lineTo(width * 0.76 + 6, shelfY2 - 27);
  ctx.stroke();

  // Shelf 3 (Bottom): Oil cans, toolboxes, severed animatronic arm & dangling wires
  ctx.fillStyle = '#7f1d1d';
  ctx.fillRect(width * 0.09, shelfY3 - 26, 44, 26); // Red toolbox
  ctx.fillStyle = '#78350f';
  ctx.fillRect(width * 0.18, shelfY3 - 22, 16, 22); // Oil can
  // Severed endoskeleton forearm on bottom-right shelf
  ctx.strokeStyle = '#a1a1aa';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(width * 0.74, shelfY3 - 8);
  ctx.lineTo(width * 0.83, shelfY3 - 14);
  ctx.lineTo(width * 0.87, shelfY3 - 6);
  ctx.stroke();

  // Thick Cobwebs in corners & between shelves ("polvo y suciedad")
  ctx.strokeStyle = 'rgba(212, 212, 216, 0.26)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  // Top-left cobweb
  ctx.moveTo(0, 0);
  ctx.lineTo(width * 0.16, 0);
  ctx.lineTo(0, height * 0.22);
  ctx.moveTo(0, 0);
  ctx.lineTo(width * 0.11, height * 0.11);
  ctx.quadraticCurveTo(width * 0.08, height * 0.04, width * 0.14, 0);
  // Top-right cobweb
  ctx.moveTo(width, 0);
  ctx.lineTo(width * 0.84, 0);
  ctx.lineTo(width, height * 0.22);
  ctx.stroke();

  // Swinging overhead work bulb + dusty light cone + floating dust motes
  const swing = Math.sin(timeSec * 2.2) * 18;
  const bulbX = width * 0.5 + swing;
  const bulbY = height * 0.16;

  const coneGrad = ctx.createRadialGradient(bulbX, bulbY, 8, bulbX, height * 0.55, width * 0.48);
  coneGrad.addColorStop(0, 'rgba(254, 240, 138, 0.22)');
  coneGrad.addColorStop(0.5, 'rgba(202, 138, 4, 0.08)');
  coneGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = coneGrad;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = '#52525b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(width * 0.5, 0);
  ctx.lineTo(bulbX, bulbY);
  ctx.stroke();
  ctx.fillStyle = '#fef08a';
  ctx.beginPath();
  ctx.arc(bulbX, bulbY, 7, 0, Math.PI * 2);
  ctx.fill();

  // Floating dust motes ("con polvo")
  ctx.fillStyle = 'rgba(254, 249, 195, 0.38)';
  for (let d = 0; d < 34; d++) {
    const dx = ((Math.sin(d * 19.3 + timeSec * 0.45) + 1) * 0.5) * width;
    const dy = ((Math.cos(d * 31.7 + timeSec * 0.35) + 1) * 0.5) * height;
    const r = 1 + (d % 3) * 0.8;
    ctx.beginPath();
    ctx.arc(dx, dy, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * CAM 03: Hallway accessing Restrooms & connecting to the Office Corridor
 * ("en la camara 03 debe haber un pasillo que accede a los baños y que conecte con el pasillo que lleva a la oficina")
 */
function renderCam03RestroomCorridorJunction(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  timeSec: number,
  mensBathroomStage: NightmareBathroomStage = 1
) {
  const floorY = height * 0.66;

  // Dark corridor junction background
  ctx.fillStyle = '#07090e';
  ctx.fillRect(0, 0, width, height);

  // Left Perspective Wall (Continuing down to the East Hallway -> Office)
  ctx.fillStyle = '#111420';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(width * 0.34, height * 0.16);
  ctx.lineTo(width * 0.34, floorY);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fill();

  // Center-Left Deep Corridor Tunnel (The main hallway connecting directly toward CAM 4A / Office!)
  ctx.fillStyle = '#030408';
  ctx.fillRect(width * 0.24, height * 0.16, width * 0.26, floorY - height * 0.16);

  // Directional Sign above/beside the Office Corridor connection
  ctx.fillStyle = '#18181b';
  ctx.strokeStyle = '#52525b';
  ctx.lineWidth = 1.5;
  ctx.fillRect(width * 0.25, height * 0.19, 145, 24);
  ctx.strokeRect(width * 0.25, height * 0.19, 145, 24);
  ctx.fillStyle = '#fca5a5';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('← PASILLO OFICINA', width * 0.25 + 72, height * 0.19 + 15);

  // Right Side Branch: The Hallway / Alcove that accesses the Restrooms ("pasillo que accede a los baños")
  const bathLeft = width * 0.52;
  const bathRight = width * 0.92;
  const bathTop = height * 0.14;

  // Tiled bathroom corridor walls
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(bathLeft, bathTop, bathRight - bathLeft, floorY - bathTop);

  // Subtle ceramic tile grid inside restroom corridor
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
  ctx.lineWidth = 1;
  for (let tx = bathLeft; tx <= bathRight; tx += 22) {
    ctx.beginPath();
    ctx.moveTo(tx, bathTop);
    ctx.lineTo(tx, floorY);
    ctx.stroke();
  }
  for (let ty = bathTop; ty <= floorY; ty += 20) {
    ctx.beginPath();
    ctx.moveTo(bathLeft, ty);
    ctx.lineTo(bathRight, ty);
    ctx.stroke();
  }

  const doorTopY = height * 0.27;
  const doorH = floorY - doorTopY;

  // Women's Restroom Door (WC · F) — always closed on the right
  const drawClosedRestroomDoor = (dx: number, dw: number, symbol: string) => {
    ctx.fillStyle = '#0b111e';
    ctx.fillRect(dx, doorTopY, dw, doorH);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.strokeRect(dx, doorTopY, dw, doorH);
    // Door handle
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(dx + dw - 14, doorTopY + doorH * 0.52, 6, 14);
    // Restroom plaque
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(dx + dw * 0.2, height * 0.33, dw * 0.6, 28);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(symbol, dx + dw * 0.5, height * 0.33 + 18);
  };

  // Men's Restroom Door (WC · M) with 4 Foxy-style states for Still Nightmare:
  // State 1: Door closed
  // State 2: Door slightly open, only a glowing red eye visible in the darkness
  // State 3: Still Nightmare resting one hand on the door and peeking his head out
  // State 4: Gone from bathroom; door is wide open showing the inner door face covered in claw marks
  const mDoorX = width * 0.56;
  const mDoorW = width * 0.14;

  if (mensBathroomStage === 1) {
    drawClosedRestroomDoor(mDoorX, mDoorW, 'WC · M');
  } else if (mensBathroomStage === 2) {
    // Pitch-black bathroom interior doorway
    ctx.fillStyle = '#010103';
    ctx.fillRect(mDoorX, doorTopY, mDoorW, doorH);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.strokeRect(mDoorX, doorTopY, mDoorW, doorH);

    // Partially ajar door leaf on the left (leaving a dark gap on the right side of the doorway)
    const ajarW = mDoorW * 0.64;
    ctx.fillStyle = '#0b111e';
    ctx.fillRect(mDoorX, doorTopY, ajarW, doorH);
    ctx.strokeStyle = '#475569';
    ctx.strokeRect(mDoorX, doorTopY, ajarW, doorH);

    // Restroom plaque on the ajar door
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(mDoorX + ajarW * 0.16, height * 0.33, ajarW * 0.68, 26);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('WC · M', mDoorX + ajarW * 0.5, height * 0.33 + 17);

    // Single glowing red eye shining in the pitch darkness of the gap
    const eyeX = mDoorX + ajarW + (mDoorW - ajarW) * 0.48;
    const eyeY = doorTopY + doorH * 0.34;
    const eyePulse = 0.8 + Math.sin(timeSec * 8) * 0.2;
    const eyeGlow = ctx.createRadialGradient(eyeX, eyeY, 1, eyeX, eyeY, 14);
    eyeGlow.addColorStop(0, `rgba(239, 68, 68, ${eyePulse})`);
    eyeGlow.addColorStop(0.5, `rgba(220, 38, 38, ${0.45 * eyePulse})`);
    eyeGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = eyeGlow;
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, 3.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, 1.4, 0, Math.PI * 2);
    ctx.fill();
  } else if (mensBathroomStage === 3) {
    // Pitch-black bathroom interior doorway
    ctx.fillStyle = '#010103';
    ctx.fillRect(mDoorX, doorTopY, mDoorW, doorH);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.strokeRect(mDoorX, doorTopY, mDoorW, doorH);

    // Half-open door leaf swung to the left side
    const openLeafW = mDoorW * 0.44;
    ctx.fillStyle = '#0b111e';
    ctx.fillRect(mDoorX, doorTopY, openLeafW, doorH);
    ctx.strokeStyle = '#475569';
    ctx.strokeRect(mDoorX, doorTopY, openLeafW, doorH);

    const doorEdgeX = mDoorX + openLeafW;
    const headX = doorEdgeX + 22;
    const headY = doorTopY + doorH * 0.34;

    // Still Nightmare's head peeking out from behind the door
    ctx.save();
    ctx.translate(headX, headY);
    ctx.rotate(0.14);
    // Yellow Nightmare top hat peeking out
    ctx.fillStyle = '#ca8a04';
    ctx.fillRect(-10, -32, 22, 12);
    ctx.fillStyle = '#eab308';
    ctx.fillRect(-15, -21, 32, 4);
    // Gaunt black cranium
    ctx.fillStyle = '#09090e';
    ctx.strokeStyle = '#27272a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, -8, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Glowing red eye
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(5, -10, 4.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(5, -10, 1.5, 0, Math.PI * 2);
    ctx.fill();
    // Snout & razor teeth peeking out
    ctx.fillStyle = '#050508';
    ctx.fillRect(-6, 1, 20, 10);
    ctx.fillStyle = '#e4e4e7';
    for (let tx = -4; tx <= 10; tx += 4.5) {
      ctx.fillRect(tx, 1, 2.5, 4);
      ctx.fillRect(tx, 7, 2.5, 4);
    }
    ctx.restore();

    // Still Nightmare's clawed hand gripping/resting on the edge of the door ("con una mano apoyada en la puerta")
    const handY = doorTopY + doorH * 0.54;
    ctx.fillStyle = '#0d0d14';
    ctx.strokeStyle = '#3f3f46';
    ctx.lineWidth = 1.5;
    ctx.fillRect(doorEdgeX - 8, handY - 8, 16, 16);
    ctx.strokeRect(doorEdgeX - 8, handY - 8, 16, 16);
    // 4 long metallic claws gripping the door face
    ctx.strokeStyle = '#e4e4e7';
    ctx.lineWidth = 2;
    for (let c = 0; c < 4; c++) {
      const cy = handY - 6 + c * 4.2;
      ctx.beginPath();
      ctx.moveTo(doorEdgeX - 4, cy);
      ctx.lineTo(doorEdgeX - 18, cy + 2);
      ctx.stroke();
    }
  } else {
    // Stage 4: Still Nightmare has left the bathroom!
    // Door is wide open ("abierta de par en par"), and the inside face of the door (now visible) has claw marks all over it!
    ctx.fillStyle = '#010103';
    ctx.fillRect(mDoorX, doorTopY, mDoorW, doorH);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.strokeRect(mDoorX, doorTopY, mDoorW, doorH);

    // Wide-open door swung outward to the left of the frame, showing the INSIDE surface of the door
    const openPanelX = mDoorX - mDoorW * 0.48;
    const openPanelW = mDoorW * 0.62;
    ctx.save();
    ctx.fillStyle = '#111827';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(mDoorX, doorTopY);
    ctx.lineTo(openPanelX, doorTopY + 8);
    ctx.lineTo(openPanelX, doorTopY + doorH - 6);
    ctx.lineTo(mDoorX, doorTopY + doorH);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Deep diagonal claw slashes across the entire inside surface of the open door ("unas marcas de garras por toda la puerta")
    const slashSets = [
      { yStart: doorTopY + 24, yEnd: doorTopY + 62 },
      { yStart: doorTopY + 74, yEnd: doorTopY + 118 },
      { yStart: doorTopY + 130, yEnd: doorTopY + 174 },
    ];
    slashSets.forEach((set) => {
      for (let g = 0; g < 4; g++) {
        const offset = g * 5.5;
        // Dark gouge shadow
        ctx.strokeStyle = '#020617';
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.moveTo(openPanelX + 8, set.yStart + offset);
        ctx.lineTo(openPanelX + openPanelW - 6, set.yEnd + offset);
        ctx.stroke();
        // Metallic/pale scratched inner wood/metal edge
        ctx.strokeStyle = 'rgba(248, 113, 113, 0.72)';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(openPanelX + 8, set.yStart + offset + 1);
        ctx.lineTo(openPanelX + openPanelW - 6, set.yEnd + offset + 1);
        ctx.stroke();
      }
    });
    ctx.restore();
  }

  drawClosedRestroomDoor(width * 0.74, width * 0.14, 'WC · F');

  // Restroom Corridor Header Sign ("BAÑOS / RESTROOMS") with flickering fluorescent tube
  const tubeFlicker = Math.sin(timeSec * 14) > -0.8 ? 0.9 : 0.35;
  ctx.fillStyle = '#0f172a';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1.5;
  ctx.fillRect(width * 0.58, height * 0.16, 175, 26);
  ctx.strokeRect(width * 0.58, height * 0.16, 175, 26);
  ctx.fillStyle = `rgba(186, 230, 253, ${tubeFlicker})`;
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('PASILLO BAÑOS / WC →', width * 0.58 + 87, height * 0.16 + 17);

  // Connecting Checkered Corridor Floor linking both passages
  drawPerspectiveCheckeredFloor(ctx, width, height, floorY, 0.15, 0.68);

  // Yellow "PISO MOJADO" caution cone at the junction corner between Bathrooms and Office Hallway
  ctx.save();
  ctx.translate(width * 0.51, floorY + 26);
  ctx.fillStyle = '#ca8a04';
  ctx.beginPath();
  ctx.moveTo(0, -24);
  ctx.lineTo(14, 12);
  ctx.lineTo(-14, 12);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#09090b';
  ctx.fillRect(-4, -10, 8, 12);
  ctx.restore();
}

/**
 * CAM 2A & CAM 2B: West Hallway
 * - CAM 2A: "un pasillo muy oscuro con una luz tenue que titila y que haya posters a los lados"
 * - CAM 2B: "lo mismo con la camara 2b solo que sin la luz y siendo todo mas oscuro"
 */
function renderWestCorridorCam(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  timeSec: number,
  hasFlickeringLight: boolean
) {
  const vpLeft = width * 0.34;
  const vpRight = width * 0.66;
  const vpTop = height * 0.22;
  const vpBottom = height * 0.66;

  // Flicker intensity for CAM 2A vs pitch darkness for CAM 2B
  let lightAlpha = 0;
  if (hasFlickeringLight) {
    const wave =
      Math.sin(timeSec * 11.3) * 0.4 +
      Math.cos(timeSec * 27.1) * 0.35 +
      Math.sin(timeSec * 4.7) * 0.25;
    lightAlpha = wave > -0.25 ? 0.55 + (wave + 0.25) * 0.35 : 0.12;
  }

  // Base ultra-dark corridor fill
  ctx.fillStyle = hasFlickeringLight ? '#030408' : '#010204';
  ctx.fillRect(0, 0, width, height);

  // Left & Right Perspective Corridor Walls
  const wallLum = hasFlickeringLight ? Math.round(14 + lightAlpha * 14) : 7;
  ctx.fillStyle = `rgb(${wallLum}, ${wallLum + 2}, ${wallLum + 8})`;
  // Left wall polygon
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(vpLeft, vpTop);
  ctx.lineTo(vpLeft, vpBottom);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fill();

  // Right wall polygon
  ctx.beginPath();
  ctx.moveTo(width, 0);
  ctx.lineTo(vpRight, vpTop);
  ctx.lineTo(vpRight, vpBottom);
  ctx.lineTo(width, height);
  ctx.closePath();
  ctx.fill();

  // Pitch-black far end of the corridor
  ctx.fillStyle = '#010103';
  ctx.fillRect(vpLeft, vpTop, vpRight - vpLeft, vpBottom - vpTop);

  // Perspective Floor Tiles (very dark in 2A, even darker in 2B)
  drawPerspectiveCheckeredFloor(
    ctx,
    width,
    height,
    vpBottom,
    hasFlickeringLight ? 0.08 + lightAlpha * 0.08 : 0.045,
    0.32
  );

  // Perspective wall borders
  ctx.strokeStyle = hasFlickeringLight
    ? `rgba(120, 130, 155, ${0.18 + lightAlpha * 0.15})`
    : 'rgba(65, 70, 90, 0.14)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(vpLeft, vpTop);
  ctx.moveTo(0, height);
  ctx.lineTo(vpLeft, vpBottom);
  ctx.moveTo(width, 0);
  ctx.lineTo(vpRight, vpTop);
  ctx.moveTo(width, height);
  ctx.lineTo(vpRight, vpBottom);
  // Wainscoting stripe along both walls
  ctx.moveTo(0, height * 0.62);
  ctx.lineTo(vpLeft, vpTop + (vpBottom - vpTop) * 0.62);
  ctx.moveTo(width, height * 0.62);
  ctx.lineTo(vpRight, vpTop + (vpBottom - vpTop) * 0.62);
  ctx.stroke();

  // Posters on BOTH sides of the corridor ("que haya posters a los lados")
  const posterBrightness = hasFlickeringLight ? 0.42 + lightAlpha * 0.48 : 0.22;

  // Left Wall Poster 1 (Foreground Left)
  drawPerspectiveWallPoster(
    ctx,
    'left',
    width * 0.07,
    width * 0.17,
    height * 0.18,
    height * 0.50,
    height * 0.23,
    height * 0.49,
    '#7c2d12',
    'FREDDY',
    posterBrightness,
    false
  );
  // Left Wall Poster 2 (Mid-corridor Left)
  drawPerspectiveWallPoster(
    ctx,
    'left',
    width * 0.21,
    width * 0.29,
    height * 0.25,
    height * 0.48,
    height * 0.28,
    height * 0.47,
    '#991b1b',
    'RULES',
    posterBrightness * 0.85,
    true
  );

  // Right Wall Poster 1 (Foreground Right)
  drawPerspectiveWallPoster(
    ctx,
    'right',
    width * 0.93,
    width * 0.83,
    height * 0.18,
    height * 0.50,
    height * 0.23,
    height * 0.49,
    '#1e3a8a',
    'BONNIE',
    posterBrightness,
    true
  );
  // Right Wall Poster 2 (Mid-corridor Right)
  drawPerspectiveWallPoster(
    ctx,
    'right',
    width * 0.79,
    width * 0.71,
    height * 0.25,
    height * 0.48,
    height * 0.28,
    height * 0.47,
    '#854d0e',
    'PARTY!',
    posterBrightness * 0.85,
    false
  );

  // Ceiling fixture & dim flickering light cone ONLY in CAM 2A ("una luz tenue que titila")
  ctx.strokeStyle = '#27272a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(width * 0.5, 0);
  ctx.lineTo(width * 0.5, height * 0.13);
  ctx.stroke();

  if (hasFlickeringLight) {
    // Dim flickering cone of light in CAM 2A
    const cone = ctx.createRadialGradient(
      width * 0.5,
      height * 0.14,
      4,
      width * 0.5,
      height * 0.55,
      width * 0.42
    );
    cone.addColorStop(0, `rgba(254, 243, 199, ${0.28 * lightAlpha})`);
    cone.addColorStop(0.45, `rgba(217, 119, 6, ${0.11 * lightAlpha})`);
    cone.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = cone;
    ctx.beginPath();
    ctx.moveTo(width * 0.46, height * 0.13);
    ctx.lineTo(width * 0.54, height * 0.13);
    ctx.lineTo(width * 0.88, height);
    ctx.lineTo(width * 0.12, height);
    ctx.closePath();
    ctx.fill();

    // Glowing flickering bulb
    ctx.fillStyle = `rgba(254, 240, 138, ${0.35 + lightAlpha * 0.65})`;
    ctx.beginPath();
    ctx.arc(width * 0.5, height * 0.14, 6, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // CAM 2B: Broken unlit bulb socket + extra darkness overlay ("sin la luz y siendo todo mas oscuro")
    ctx.fillStyle = '#18181b';
    ctx.fillRect(width * 0.5 - 5, height * 0.13, 10, 7);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.46)';
    ctx.fillRect(0, 0, width, height);
  }
}

/**
 * CAM 4A: East Hallway North with Camera-POV Spotlight & Looming Animatronic Shadow
 * ("en la camara 4A tiene que tener una luz apuntando al pasillo pero desde el punto de vista de la camara
 * y cuando haya un animatronico alli, que se vea la sombra por que ademas se acerque mucho a la camara")
 */
function renderCam4APovSpotlightHallway(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  occupants: AnimatronicState[],
  timeSec: number
) {
  const vpLeft = width * 0.32;
  const vpRight = width * 0.68;
  const vpTop = height * 0.20;
  const vpBottom = height * 0.66;

  // Base dark corridor
  ctx.fillStyle = '#040509';
  ctx.fillRect(0, 0, width, height);

  // Corridor side walls
  ctx.fillStyle = '#121520';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(vpLeft, vpTop);
  ctx.lineTo(vpLeft, vpBottom);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(width, 0);
  ctx.lineTo(vpRight, vpTop);
  ctx.lineTo(vpRight, vpBottom);
  ctx.lineTo(width, height);
  ctx.closePath();
  ctx.fill();

  // Back corridor recess
  ctx.fillStyle = '#080a10';
  ctx.fillRect(vpLeft, vpTop, vpRight - vpLeft, vpBottom - vpTop);

  // Perspective floor tiles
  drawPerspectiveCheckeredFloor(ctx, width, height, vpBottom, 0.16, 0.36);

  // Corridor architectural trim lines
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(vpLeft, vpTop);
  ctx.moveTo(0, height);
  ctx.lineTo(vpLeft, vpBottom);
  ctx.moveTo(width, 0);
  ctx.lineTo(vpRight, vpTop);
  ctx.moveTo(width, height);
  ctx.lineTo(vpRight, vpBottom);
  ctx.stroke();

  // Camera-POV Flashlight Beam pointing straight down the hallway from the camera lens!
  const beamCenterX = width * 0.5;
  const beamCenterY = height * 0.46;
  const povLight = ctx.createRadialGradient(
    beamCenterX,
    beamCenterY,
    width * 0.04,
    beamCenterX,
    beamCenterY,
    width * 0.48
  );
  povLight.addColorStop(0, 'rgba(255, 251, 235, 0.36)');
  povLight.addColorStop(0.45, 'rgba(226, 232, 240, 0.18)');
  povLight.addColorStop(0.78, 'rgba(30, 41, 59, 0.06)');
  povLight.addColorStop(1, 'rgba(0, 0, 0, 0.78)');
  ctx.fillStyle = povLight;
  ctx.fillRect(0, 0, width, height);

  // If an animatronic is present in CAM 4A, it approaches VERY CLOSE to the camera
  // and casts a huge dark shadow behind it onto the hallway walls & ceiling!
  if (occupants.length > 0) {
    occupants.forEach((anim, idx) => {
      const animX =
        occupants.length === 1
          ? width * 0.5
          : width * (0.36 + idx * 0.28);
      const animY = height * 0.72;
      const closeScale = 1.72;

      // 1. Huge Projected Shadow cast behind the animatronic onto the hallway walls by the camera's POV light
      ctx.save();
      const shadowSway = Math.sin(timeSec * 2.8) * 5;
      const sx = animX + shadowSway;
      const sy = animY - 75;

      // Outer shadow penumbra splayed across the left, back, and right corridor walls
      const umbraGrad = ctx.createRadialGradient(sx, sy - 30, 30, sx, sy - 30, 260);
      umbraGrad.addColorStop(0, 'rgba(0, 0, 0, 0.94)');
      umbraGrad.addColorStop(0.6, 'rgba(0, 0, 0, 0.72)');
      umbraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = umbraGrad;
      ctx.beginPath();
      ctx.ellipse(sx, sy - 25, 240, 195, 0, 0, Math.PI * 2);
      ctx.fill();

      // Magnified dark animatronic shadow silhouette projected onto the hallway walls behind the figure
      ctx.fillStyle = 'rgba(2, 2, 5, 0.92)';
      // Looming shadow head & ears/hat silhouette high on the back corridor wall
      ctx.beginPath();
      ctx.ellipse(sx, sy - 115, 92, 74, 0, 0, Math.PI * 2);
      ctx.fill();
      if (anim.id === 'freddy' || anim.id === 'blob') {
        // Shadow of top hat & ears on the ceiling/upper wall
        ctx.fillRect(sx - 44, sy - 220, 88, 52);
        ctx.beginPath();
        ctx.arc(sx - 88, sy - 160, 32, 0, Math.PI * 2);
        ctx.arc(sx + 88, sy - 160, 32, 0, Math.PI * 2);
        ctx.fill();
      } else if (anim.id === 'bonnie') {
        // Shadow of long rabbit ears on the upper wall
        ctx.fillRect(sx - 62, sy - 250, 34, 95);
        ctx.fillRect(sx + 28, sy - 235, 34, 80);
      }
      // Looming shadow shoulders & wide arms splayed across both side walls of the corridor
      ctx.beginPath();
      ctx.moveTo(sx - 210, sy + 95);
      ctx.lineTo(sx - 155, sy - 45);
      ctx.lineTo(sx + 155, sy - 45);
      ctx.lineTo(sx + 210, sy + 95);
      ctx.closePath();
      ctx.fill();

      // 2. Draw the Animatronic itself UP CLOSE to the camera lens with deep drop shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.96)';
      ctx.shadowBlur = 24;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = -18;
      drawAnimatronic(ctx, anim.id, animX, animY, closeScale, timeSec, false);
      ctx.restore();

      // Subtle rim-light glare on the close-up animatronic from the camera's POV spotlight
      const rimGrad = ctx.createRadialGradient(
        animX,
        animY - 60,
        10,
        animX,
        animY - 60,
        170
      );
      rimGrad.addColorStop(0, 'rgba(255, 250, 220, 0.14)');
      rimGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = rimGrad;
      ctx.fillRect(0, 0, width, height);
    });
  }
}

/**
 * CAM 4B: East Hallway Corner ("en la camara 4B que sea un pasillo con carteles a los lados
 * y no mucho contenido mas alla de la decoracion normal de la pared")
 */
function renderCam4BPosterCorridor(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
) {
  const vpLeft = width * 0.30;
  const vpRight = width * 0.70;
  const vpTop = height * 0.18;
  const vpBottom = height * 0.68;

  // Standard dark corridor background
  ctx.fillStyle = '#080a10';
  ctx.fillRect(0, 0, width, height);

  // Left & Right corridor walls
  ctx.fillStyle = '#141724';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(vpLeft, vpTop);
  ctx.lineTo(vpLeft, vpBottom);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(width, 0);
  ctx.lineTo(vpRight, vpTop);
  ctx.lineTo(vpRight, vpBottom);
  ctx.lineTo(width, height);
  ctx.closePath();
  ctx.fill();

  // Back wall leading to Right Office Door
  ctx.fillStyle = '#0d1018';
  ctx.fillRect(vpLeft, vpTop, vpRight - vpLeft, vpBottom - vpTop);

  // Standard FNAF Wall Decoration: Red & Checkered Wainscoting Trim Strip along the walls
  ctx.strokeStyle = '#991b1b';
  ctx.lineWidth = 6;
  ctx.beginPath();
  // Left wall red trim
  ctx.moveTo(0, height * 0.58);
  ctx.lineTo(vpLeft, vpTop + (vpBottom - vpTop) * 0.62);
  // Right wall red trim
  ctx.moveTo(width, height * 0.58);
  ctx.lineTo(vpRight, vpTop + (vpBottom - vpTop) * 0.62);
  // Back wall red trim
  ctx.moveTo(vpLeft, vpTop + (vpBottom - vpTop) * 0.62);
  ctx.lineTo(vpRight, vpTop + (vpBottom - vpTop) * 0.62);
  ctx.stroke();

  // Dashed black-and-white checker stripe inside the wall trim
  ctx.strokeStyle = '#e4e4e7';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.moveTo(0, height * 0.58);
  ctx.lineTo(vpLeft, vpTop + (vpBottom - vpTop) * 0.62);
  ctx.lineTo(vpRight, vpTop + (vpBottom - vpTop) * 0.62);
  ctx.lineTo(width, height * 0.58);
  ctx.stroke();
  ctx.setLineDash([]);

  // Corridor structural outlines
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(vpLeft, vpTop);
  ctx.moveTo(0, height);
  ctx.lineTo(vpLeft, vpBottom);
  ctx.moveTo(width, 0);
  ctx.lineTo(vpRight, vpTop);
  ctx.moveTo(width, height);
  ctx.lineTo(vpRight, vpBottom);
  ctx.stroke();

  // Clean perspective floor tiles (no extra clutter)
  drawPerspectiveCheckeredFloor(ctx, width, height, vpBottom, 0.14, 0.40);

  // Signs/posters on BOTH side walls ("con carteles a los lados")
  drawPerspectiveWallPoster(
    ctx,
    'left',
    width * 0.06,
    width * 0.16,
    height * 0.16,
    height * 0.46,
    height * 0.21,
    height * 0.45,
    '#b45309',
    'CHICA',
    0.72,
    false
  );
  drawPerspectiveWallPoster(
    ctx,
    'left',
    width * 0.19,
    width * 0.27,
    height * 0.23,
    height * 0.45,
    height * 0.26,
    height * 0.44,
    '#15803d',
    'NOTICE',
    0.68,
    false
  );
  drawPerspectiveWallPoster(
    ctx,
    'right',
    width * 0.94,
    width * 0.84,
    height * 0.16,
    height * 0.46,
    height * 0.21,
    height * 0.45,
    '#7f1d1d',
    'SHOWTIME',
    0.72,
    false
  );
  drawPerspectiveWallPoster(
    ctx,
    'right',
    width * 0.81,
    width * 0.73,
    height * 0.23,
    height * 0.45,
    height * 0.26,
    height * 0.44,
    '#1d4ed8',
    'SAFETY',
    0.68,
    false
  );
}

export function renderCameraFeed(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  selectedNode: NodeId,
  animatronics: Record<AnimatronicId, AnimatronicState>,
  timeSec: number,
  staticBurst: number
) {
  ctx.save();
  ctx.clearRect(0, 0, width, height);

  const isVent = isVentNode(selectedNode);
  const occupants = (Object.values(animatronics) as AnimatronicState[]).filter((a) =>
    isAnimatronicVisibleOnCamera(a, selectedNode)
  );
  const nightmareBathroomStage: NightmareBathroomStage =
    animatronics.nightmare?.bathroomStage ?? 1;

  // 1. Background Room, Corridor, or Ventilation Shaft Architecture
  if (isVent) {
    // Metallic Ventilation Tunnel Feed
    ctx.fillStyle = '#06080c';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 3;
    for (let i = 1; i <= 5; i++) {
      const insetX = width * 0.08 * i;
      const insetY = height * 0.08 * i;
      ctx.strokeRect(insetX, insetY, width - insetX * 2, height - insetY * 2);
    }
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(width * 0.4, height * 0.4);
    ctx.moveTo(width, 0);
    ctx.lineTo(width * 0.6, height * 0.4);
    ctx.moveTo(0, height);
    ctx.lineTo(width * 0.4, height * 0.6);
    ctx.moveTo(width, height);
    ctx.lineTo(width * 0.6, height * 0.6);
    ctx.stroke();
  } else if (selectedNode === 'CAM_1A') {
    renderCam1ADestroyedStage(ctx, width, height, timeSec);
  } else if (selectedNode === 'CAM_1B') {
    renderCam1BMessyDining(ctx, width, height);
  } else if (selectedNode === 'CAM_5') {
    renderCam05DustyPartsAndService(ctx, width, height, timeSec);
  } else if (selectedNode === 'CAM_3') {
    renderCam03RestroomCorridorJunction(ctx, width, height, timeSec, nightmareBathroomStage);
  } else if (selectedNode === 'CAM_2A') {
    renderWestCorridorCam(ctx, width, height, timeSec, true);
  } else if (selectedNode === 'CAM_2B') {
    renderWestCorridorCam(ctx, width, height, timeSec, false);
  } else if (selectedNode === 'CAM_4A') {
    // CAM 4A handles its own close-up animatronic + projected shadow from the camera's POV light!
    renderCam4APovSpotlightHallway(ctx, width, height, occupants, timeSec);
  } else if (selectedNode === 'CAM_4B') {
    renderCam4BPosterCorridor(ctx, width, height);
  }

  // 2. Render any active animatronics currently in `selectedNode` (except CAM_4A which renders them up-close with POV shadow)
  if (selectedNode !== 'CAM_4A') {
    occupants.forEach((anim, idx) => {
      const spreadX =
        occupants.length === 1
          ? width * 0.5
          : width * (0.32 + idx * (0.36 / Math.max(1, occupants.length - 1)));
      const posY = isVent ? height * 0.62 : height * 0.54;
      const scale = isVent ? 1.15 : 1.05;
      drawAnimatronic(ctx, anim.id, spreadX, posY, scale, timeSec, false);
    });

    // If in CAM 2B (no light, extra dark), dim any animatronic slightly so it blends into the oppressive darkness
    if (selectedNode === 'CAM_2B' && occupants.length > 0) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.fillRect(0, 0, width, height);
    }
  }

  // 3. Night-Vision Green / Monochrome CRT Scanlines & Static Noise
  ctx.fillStyle = isVent ? 'rgba(16, 185, 129, 0.06)' : 'rgba(148, 163, 184, 0.04)';
  ctx.fillRect(0, 0, width, height);

  // Horizontal CRT scanlines
  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  for (let y = 0; y < height; y += 4) {
    ctx.fillRect(0, y, width, 1.5);
  }

  // Static snow overlay (stronger right when camera switches or animatronic moves)
  const snowCount = Math.floor(120 + staticBurst * 750);
  ctx.fillStyle = `rgba(255, 255, 255, ${0.08 + staticBurst * 0.35})`;
  for (let i = 0; i < snowCount; i++) {
    const sx = ((Math.sin(i * 78.233 + timeSec * 43) + 1) * 0.5) * width;
    const sy = ((Math.cos(i * 45.164 + timeSec * 61) + 1) * 0.5) * height;
    ctx.fillRect(sx, sy, 14, 2);
  }

  ctx.restore();
}
