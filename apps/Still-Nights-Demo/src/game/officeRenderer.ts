import { AnimatronicId, AnimatronicState, OfficeDefenseState } from './rules';
import { drawAnimatronic } from './animatronicsRenderer';

export interface OfficeRenderParams {
  width: number;
  height: number;
  timeSec: number;
  panX: number; // -1 (far left door) to 0 (center desk/vent) to +1 (far right door)
  powerRemaining: number;
  defense: OfficeDefenseState;
  animatronics: Record<AnimatronicId, AnimatronicState>;
  officeFlickerRemainingMs: number;
  leftDoorAnim: number;  // 0 = open, 1 = closed
  rightDoorAnim: number; // 0 = open, 1 = closed
  ventDoorAnim: number;  // 0 = open, 1 = closed
}

export function renderOfficeScene(
  ctx: CanvasRenderingContext2D,
  params: OfficeRenderParams
) {
  const {
    width,
    height,
    timeSec,
    panX,
    powerRemaining,
    defense,
    animatronics,
    officeFlickerRemainingMs,
    leftDoorAnim,
    rightDoorAnim,
    ventDoorAnim,
  } = params;

  ctx.save();
  ctx.clearRect(0, 0, width, height);

  // Wide 3100px virtual office width so the Left Door and Right Door are pushed far to the sides!
  // It is impossible to see both doors at once: you MUST pan left (-1) or right (+1) to check each side.
  const worldW = Math.max(width * 2.15, 3100);
  const maxOffset = (worldW - width) / 2;
  const offsetX = -panX * maxOffset;

  ctx.translate(width / 2 + offsetX, 0);

  // Determine main office light brightness (including the 1.5s vent-retreat flicker!)
  let officeLightMultiplier = powerRemaining > 0 ? 1.0 : 0.12;
  const isVentRetreatFlickering = officeFlickerRemainingMs > 0;
  if (isVentRetreatFlickering) {
    const pulse = Math.sin(timeSec * 55) * Math.cos(timeSec * 37);
    officeLightMultiplier = pulse > 0 ? 1.15 : 0.08;
  }

  // Side corridor ambient flickering lights ("una luz parpadeante que ilumine los pasillos laterales de la oficina")
  const leftCorridorFlicker =
    powerRemaining > 0
      ? (Math.sin(timeSec * 19) * Math.cos(timeSec * 7.3) > -0.25 ? 0.56 : 0.12)
      : 0.04;
  const rightCorridorFlicker =
    powerRemaining > 0
      ? (Math.cos(timeSec * 17.5) * Math.sin(timeSec * 9.1) > -0.25 ? 0.56 : 0.12)
      : 0.04;

  const leftHallBrightness = defense.leftLightOn ? 1.0 : leftCorridorFlicker;
  const rightHallBrightness = defense.rightLightOn ? 1.0 : rightCorridorFlicker;

  // 1. BACK WALL & GRIME TEXTURE
  const wallGrad = ctx.createLinearGradient(0, 0, 0, height);
  wallGrad.addColorStop(0, '#090a0f');
  wallGrad.addColorStop(0.5, '#18181f');
  wallGrad.addColorStop(1, '#0c0c12');
  ctx.fillStyle = wallGrad;
  ctx.fillRect(-worldW / 2, 0, worldW, height);

  // Vertical industrial wall panels & grime strips across the wide office
  ctx.fillStyle = 'rgba(255, 255, 255, 0.016)';
  for (let x = -worldW / 2; x < worldW / 2; x += 56) {
    ctx.fillRect(x, 0, 26, height * 0.78);
  }

  // Classic FNAF 1 Checkered Tile Strip along the middle-lower wall
  const stripeY = height * 0.53;
  const tileSize = 28;
  for (let x = -worldW / 2; x < worldW / 2; x += tileSize) {
    for (let row = 0; row < 3; row++) {
      const isWhite = (Math.floor((x + worldW) / tileSize) + row) % 2 === 0;
      ctx.fillStyle = isWhite ? 'rgba(212, 212, 216, 0.25)' : 'rgba(9, 9, 11, 0.74)';
      ctx.fillRect(x, stripeY + row * tileSize, tileSize, tileSize);
    }
  }
  ctx.fillStyle = '#7f1d1d';
  ctx.fillRect(-worldW / 2, stripeY - 8, worldW, 8);
  ctx.fillRect(-worldW / 2, stripeY + tileSize * 3, worldW, 8);

  // 2. FLOOR (Perspective Checkered Pizzeria Floor)
  const floorY = height * 0.74;
  const floorGrad = ctx.createLinearGradient(0, floorY, 0, height);
  floorGrad.addColorStop(0, '#09090d');
  floorGrad.addColorStop(1, '#181822');
  ctx.fillStyle = floorGrad;
  ctx.fillRect(-worldW / 2, floorY, worldW, height - floorY);

  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 2;
  for (let i = -22; i <= 22; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 75, floorY);
    ctx.lineTo(i * 125, height);
    ctx.stroke();
  }

  // 3. LEFT & RIGHT SIDE CORRIDORS PUSHED FAR TO THE EDGES OF THE WIDE OFFICE
  // Left Door is at [-1340, -1080], Right Door is at [+1080, +1340] (2420px apart!)
  const doorW = 260;
  const doorH = height * 0.74;
  const doorTop = height * 0.10;
  const leftDoorX = -1340;
  const rightDoorX = 1080;

  // --- LEFT CORRIDOR (Only shows distant animatronics in CAM_2B / CAM_2A!) ---
  drawSideCorridor(
    ctx,
    leftDoorX,
    doorTop,
    doorW,
    doorH,
    'left',
    leftHallBrightness,
    defense.leftLightOn,
    timeSec,
    animatronics
  );

  // --- RIGHT CORRIDOR (Only shows distant animatronics in CAM_4B / CAM_4A!) ---
  drawSideCorridor(
    ctx,
    rightDoorX,
    doorTop,
    doorW,
    doorH,
    'right',
    rightHallBrightness,
    defense.rightLightOn,
    timeSec,
    animatronics
  );

  // --- BLAST DOORS (Shutter animation) ---
  drawBlastDoor(ctx, leftDoorX, doorTop, doorW, doorH, leftDoorAnim);
  drawBlastDoor(ctx, rightDoorX, doorTop, doorW, doorH, rightDoorAnim);

  // Steel Door Frames
  ctx.strokeStyle = '#3f3f46';
  ctx.lineWidth = 16;
  ctx.strokeRect(leftDoorX, doorTop, doorW, doorH);
  ctx.strokeRect(rightDoorX, doorTop, doorW, doorH);

  // Physical FNAF 1 Wall Control Boxes (Interactive DOOR / LIGHT buttons mounted beside each doorway)
  drawWallSwitchBox(ctx, -1064, height * 0.40, defense.leftDoorClosed, defense.leftLightOn);
  drawWallSwitchBox(ctx, 1014, height * 0.40, defense.rightDoorClosed, defense.rightLightOn);

  // Large Side Observation Windows next to each door (pushed out to -995 and +795)
  // User spec: "cuando se acerquen solo se deberian ver en la ventana (cuando enciendas la luz)"
  drawSideWindow(
    ctx,
    -995,
    height * 0.16,
    200,
    height * 0.39,
    leftHallBrightness,
    defense.leftLightOn,
    'left',
    animatronics,
    timeSec
  );
  drawSideWindow(
    ctx,
    795,
    height * 0.16,
    200,
    height * 0.39,
    rightHallBrightness,
    defense.rightLightOn,
    'right',
    animatronics,
    timeSec
  );

  // Extra industrial wall details between center desk and the side windows (pipes, electrical conduits, fuse boxes)
  drawMidWallDetails(ctx, height);

  // 4. TOP-CENTER VENTILATION SHAFT ("un conducto de ventilación arriba en el centro")
  const ventW = 330;
  const ventH = 172;
  const ventX = -ventW / 2;
  const ventY = 14;
  drawTopCenterVent(ctx, ventX, ventY, ventW, ventH, ventDoorAnim, defense.ventClosed, animatronics, timeSec);

  // 5. WALL DETAILS: CELEBRATE POSTER, CHILDREN'S DRAWINGS, HANGING WIRES & PIPES
  drawOfficeWallDetails(ctx, height);

  // 6. CENTRAL SECURITY DESK, MULTI-CRT MONITORS, OSCILLATING FAN, SODA CUP & CLUTTER
  drawSecurityDeskAndProps(ctx, height, timeSec, isVentRetreatFlickering);

  // 7. OVERHEAD FLICKERING LIGHT CONE & SHADOW OVERLAY
  if (officeLightMultiplier < 0.95) {
    ctx.fillStyle = `rgba(0, 0, 0, ${Math.max(0, Math.min(0.88, 1 - officeLightMultiplier))})`;
    ctx.fillRect(-worldW / 2, 0, worldW, height);
  } else {
    const cone = ctx.createRadialGradient(0, 40, 40, 0, height * 0.45, 980);
    cone.addColorStop(0, 'rgba(254, 240, 138, 0.12)');
    cone.addColorStop(0.55, 'rgba(245, 158, 11, 0.04)');
    cone.addColorStop(1, 'rgba(0, 0, 0, 0.56)');
    ctx.fillStyle = cone;
    ctx.fillRect(-worldW / 2, 0, worldW, height);
  }

  // If 1.5s Vent Retreat Flicker is active, draw warning arc flash
  if (isVentRetreatFlickering) {
    ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
    ctx.fillRect(-worldW / 2, 0, worldW, height);
  }

  ctx.restore();
}

function drawMidWallDetails(ctx: CanvasRenderingContext2D, height: number) {
  ctx.save();
  // Left & Right electrical fuse boxes & vertical conduit pipes between the center desk and the far windows
  const positions = [-640, 560];
  positions.forEach((bx, idx) => {
    // Vertical steel conduit pipes
    ctx.fillStyle = '#27272a';
    ctx.fillRect(bx + 18, 0, 12, height * 0.52);
    ctx.fillRect(bx + 42, 0, 8, height * 0.52);

    // Industrial Breaker Box
    ctx.fillStyle = '#18181b';
    ctx.fillRect(bx, height * 0.24, 76, 105);
    ctx.strokeStyle = '#3f3f46';
    ctx.lineWidth = 3;
    ctx.strokeRect(bx, height * 0.24, 76, 105);

    // High-voltage yellow hazard triangle on breaker box
    ctx.fillStyle = '#eab308';
    ctx.beginPath();
    ctx.moveTo(bx + 38, height * 0.27);
    ctx.lineTo(bx + 24, height * 0.31);
    ctx.lineTo(bx + 52, height * 0.31);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#71717a';
    ctx.font = 'bold 8px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(idx === 0 ? 'SECTOR OESTE' : 'SECTOR ESTE', bx + 38, height * 0.34);
  });

  // Wall-mounted paper notices & facility safety rules
  ctx.fillStyle = '#d4d4d8';
  ctx.fillRect(-480, height * 0.26, 70, 92);
  ctx.fillStyle = '#18181b';
  ctx.font = 'bold 8px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('SAFETY RULES', -445, height * 0.285);
  ctx.fillStyle = '#52525b';
  for (let i = 0; i < 6; i++) {
    ctx.fillRect(-472, height * 0.30 + i * 9, 54, 3);
  }

  ctx.restore();
}

function drawSideCorridor(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  side: 'left' | 'right',
  brightness: number,
  activeSpotlight: boolean,
  timeSec: number,
  animatronics: Record<AnimatronicId, AnimatronicState>
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  ctx.fillStyle = '#040407';
  ctx.fillRect(x, y, w, h);

  const tubeX = x + w * 0.5;
  const tubeY = y + 32;

  // Corridor depth lines
  ctx.strokeStyle = `rgba(161, 161, 170, ${0.18 * brightness})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w * 0.25, y + h * 0.22);
  ctx.moveTo(x + w, y);
  ctx.lineTo(x + w * 0.75, y + h * 0.22);
  ctx.moveTo(x, y + h);
  ctx.lineTo(x + w * 0.25, y + h * 0.78);
  ctx.moveTo(x + w, y + h);
  ctx.lineTo(x + w * 0.75, y + h * 0.78);
  ctx.stroke();

  ctx.fillStyle = `rgba(24, 24, 32, ${brightness})`;
  ctx.fillRect(x + w * 0.25, y + h * 0.22, w * 0.5, h * 0.56);

  // Flickering corridor light cone
  const lightGrad = ctx.createRadialGradient(tubeX, tubeY + 20, 8, tubeX, y + h * 0.5, h * 0.65);
  const tint = activeSpotlight ? '224, 242, 254' : '253, 224, 71';
  lightGrad.addColorStop(0, `rgba(${tint}, ${0.58 * brightness})`);
  lightGrad.addColorStop(0.5, `rgba(${tint}, ${0.22 * brightness})`);
  lightGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = lightGrad;
  ctx.fillRect(x, y, w, h);

  ctx.fillStyle = brightness > 0.3 ? '#fef08a' : '#422006';
  ctx.fillRect(tubeX - 36, tubeY, 72, 7);

  // Only show animatronics in the corridor when they are FAR in the hall (CAM_2B/2A or CAM_4B/4A).
  // Once they reach DOOR_LEFT / DOOR_RIGHT, they are only visible in the side window when the light is turned on!
  const farHallNodes = side === 'left' ? ['CAM_2B', 'CAM_2A'] : ['CAM_4B', 'CAM_4A'];
  const animInFarHall = (Object.values(animatronics) as AnimatronicState[]).find(
    (a) => a.active && farHallNodes.includes(a.location)
  );

  if (animInFarHall && brightness > 0.18) {
    const isCloserCorner = animInFarHall.location === 'CAM_2B' || animInFarHall.location === 'CAM_4B';
    ctx.save();
    ctx.globalAlpha = Math.min(0.85, brightness * (isCloserCorner ? 0.95 : 0.65));
    drawAnimatronic(
      ctx,
      animInFarHall.id,
      x + w * 0.5,
      y + h * 0.52,
      isCloserCorner ? 0.82 : 0.56,
      timeSec,
      false
    );
    ctx.restore();
  }

  ctx.restore();
}

function drawSideWindow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  brightness: number,
  activeSpotlight: boolean,
  side: 'left' | 'right',
  animatronics: Record<AnimatronicId, AnimatronicState>,
  timeSec: number
) {
  ctx.save();
  ctx.fillStyle = '#07070c';
  ctx.fillRect(x, y, w, h);

  const targetDoorNode = side === 'left' ? 'DOOR_LEFT' : 'DOOR_RIGHT';
  const animAtDoor = (Object.values(animatronics) as AnimatronicState[]).find(
    (a) => a.active && a.location === targetDoorNode
  );

  ctx.fillStyle = activeSpotlight
    ? 'rgba(224, 242, 254, 0.30)'
    : `rgba(253, 224, 71, ${0.12 * brightness})`;
  ctx.fillRect(x, y, w, h);

  // Close-up animatronic at the door ONLY appears in the window when the player turns on the window light!
  if (animAtDoor && activeSpotlight) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.globalAlpha = 0.98;
    drawAnimatronic(ctx, animAtDoor.id, x + w * 0.5, y + h * 0.66, 1.38, timeSec, false);
    ctx.restore();
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.09)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x + 16, y + h - 16);
  ctx.lineTo(x + w - 16, y + 16);
  ctx.moveTo(x + 34, y + h - 16);
  ctx.lineTo(x + w - 16, y + 36);
  ctx.stroke();

  ctx.strokeStyle = '#27272a';
  ctx.lineWidth = 12;
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}

function drawBlastDoor(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  closedRatio: number
) {
  if (closedRatio <= 0.01) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  const currentH = h * closedRatio;
  const doorBottomY = y + currentH;

  const grad = ctx.createLinearGradient(x, y, x + w, y);
  grad.addColorStop(0, '#27272a');
  grad.addColorStop(0.5, '#52525b');
  grad.addColorStop(1, '#27272a');
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, currentH);

  ctx.strokeStyle = '#18181b';
  ctx.lineWidth = 4;
  for (let ry = doorBottomY - 36; ry > y; ry -= 32) {
    ctx.beginPath();
    ctx.moveTo(x, ry);
    ctx.lineTo(x + w, ry);
    ctx.stroke();
  }

  const hazardH = 28;
  ctx.fillStyle = '#eab308';
  ctx.fillRect(x, doorBottomY - hazardH, w, hazardH);
  ctx.fillStyle = '#18181b';
  for (let hx = x; hx < x + w; hx += 24) {
    ctx.beginPath();
    ctx.moveTo(hx, doorBottomY - hazardH);
    ctx.lineTo(hx + 12, doorBottomY - hazardH);
    ctx.lineTo(hx + 4, doorBottomY);
    ctx.lineTo(hx - 8, doorBottomY);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

function drawTopCenterVent(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  ventDoorAnim: number,
  ventClosed: boolean,
  animatronics: Record<AnimatronicId, AnimatronicState>,
  timeSec: number
) {
  ctx.save();

  ctx.fillStyle = '#27272a';
  ctx.fillRect(x - 16, y - 10, w + 32, h + 28);
  ctx.strokeStyle = '#52525b';
  ctx.lineWidth = 4;
  ctx.strokeRect(x - 16, y - 10, w + 32, h + 28);

  ctx.fillStyle = '#a1a1aa';
  const bolts = [
    [x - 8, y - 2],
    [x + w + 8, y - 2],
    [x - 8, y + h + 10],
    [x + w + 8, y + h + 10],
  ];
  bolts.forEach(([bx, by]) => {
    ctx.beginPath();
    ctx.arc(bx, by, 4.5, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  ctx.fillStyle = '#050508';
  ctx.fillRect(x, y, w, h);

  ctx.strokeStyle = '#27272a';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 34, y + 22, w - 68, h - 44);
  ctx.strokeRect(x + 68, y + 42, w - 136, h - 84);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + 68, y + 42);
  ctx.moveTo(x + w, y);
  ctx.lineTo(x + w - 68, y + 42);
  ctx.moveTo(x, y + h);
  ctx.lineTo(x + 68, y + h - 42);
  ctx.moveTo(x + w, y + h);
  ctx.lineTo(x + w - 68, y + h - 42);
  ctx.stroke();

  const animInVent = (Object.values(animatronics) as AnimatronicState[]).find(
    (a) => a.active && a.location === 'VENT_OFFICE'
  );
  if (animInVent) {
    drawAnimatronic(ctx, animInVent.id, x + w / 2, y + h * 0.78, 1.15, timeSec, false);
  }

  if (ventDoorAnim > 0.01) {
    const shutterH = h * ventDoorAnim;
    ctx.fillStyle = '#3f3f46';
    ctx.fillRect(x, y, w, shutterH);
    ctx.strokeStyle = '#18181b';
    ctx.lineWidth = 3;
    for (let sy = y + 18; sy < y + shutterH; sy += 22) {
      ctx.beginPath();
      ctx.moveTo(x, sy);
      ctx.lineTo(x + w, sy);
      ctx.stroke();
    }
    ctx.fillStyle = '#eab308';
    ctx.fillRect(x, y + shutterH - 14, w, 14);
  }

  ctx.restore();

  ctx.fillStyle = '#18181b';
  ctx.fillRect(x + w / 2 - 85, y + h + 2, 170, 18);
  ctx.fillStyle = ventClosed ? '#10b981' : animInVent ? '#ef4444' : '#a1a1aa';
  ctx.font = 'bold 11px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(
    ventClosed ? 'CONDUCTO: SELLADO' : animInVent ? '¡INTRUSO EN CONDUCTO!' : 'CONDUCTO CENTRAL [W]',
    x + w / 2,
    y + h + 15
  );

  ctx.restore();
}

function drawOfficeWallDetails(ctx: CanvasRenderingContext2D, height: number) {
  ctx.save();

  // 1. "CELEBRATE!" Poster on Center-Left Wall
  const px = -245;
  const py = height * 0.22;
  const pw = 158;
  const ph = 196;

  ctx.fillStyle = '#18181b';
  ctx.fillRect(px, py, pw, ph);
  ctx.strokeStyle = '#3f3f46';
  ctx.lineWidth = 3.5;
  ctx.strokeRect(px, py, pw, ph);

  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 20px "Barlow Condensed", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('CELEBRATE!', px + pw / 2, py + 28);

  ctx.fillStyle = '#3730a3';
  ctx.fillRect(px + 22, py + 60, 30, 76);
  ctx.fillStyle = '#6b3410';
  ctx.fillRect(px + 62, py + 50, 36, 86);
  ctx.fillStyle = '#ca8a04';
  ctx.fillRect(px + 108, py + 62, 30, 74);

  ctx.fillStyle = '#71717a';
  ctx.font = '10px "IBM Plex Mono", monospace';
  ctx.fillText('FACILITY 87', px + pw / 2, py + ph - 14);

  // 2. Children's Drawings taped on Center-Right Wall
  const drawings = [
    { x: 92, y: height * 0.22, rot: -0.06, title: 'OUR FRIENDS' },
    { x: 168, y: height * 0.24, rot: 0.08, title: 'STILL FREDDY' },
    { x: 112, y: height * 0.37, rot: 0.03, title: 'THE THING?' },
    { x: 184, y: height * 0.38, rot: -0.04, title: 'HELP US' },
  ];
  drawings.forEach((d) => {
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate(d.rot);
    ctx.fillStyle = '#d4d4d8';
    ctx.fillRect(0, 0, 58, 72);
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(d.title, 29, 14);
    ctx.strokeStyle = '#1d4ed8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(29, 32, 7, 0, Math.PI * 2);
    ctx.moveTo(29, 39);
    ctx.lineTo(29, 58);
    ctx.stroke();
    ctx.restore();
  });

  // 3. Hanging Ceiling Cables & Pipes
  ctx.strokeStyle = '#27272a';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-340, 0);
  ctx.quadraticCurveTo(-270, 120, -195, 0);
  ctx.moveTo(200, 0);
  ctx.quadraticCurveTo(265, 130, 345, 0);
  ctx.stroke();

  ctx.restore();
}

function drawSecurityDeskAndProps(
  ctx: CanvasRenderingContext2D,
  height: number,
  timeSec: number,
  isFlickering: boolean
) {
  ctx.save();

  const deskW = 680;
  const deskH = height * 0.39;
  const deskX = -deskW / 2;
  const deskY = height * 0.60;

  ctx.fillStyle = '#07070b';
  ctx.fillRect(deskX + 22, deskY + 32, deskW - 44, deskH);

  // Under-desk speaker grille (left side)
  ctx.fillStyle = '#18181b';
  ctx.fillRect(deskX + 36, deskY + 44, 155, 180);
  ctx.strokeStyle = '#27272a';
  ctx.lineWidth = 2;
  for (let sy = deskY + 56; sy < deskY + 210; sy += 12) {
    ctx.beginPath();
    ctx.moveTo(deskX + 46, sy);
    ctx.lineTo(deskX + 178, sy);
    ctx.stroke();
  }

  // Desk Metal Top Surface
  const deskGrad = ctx.createLinearGradient(deskX, deskY, deskX, deskY + 34);
  deskGrad.addColorStop(0, '#3f3f46');
  deskGrad.addColorStop(1, '#18181b');
  ctx.fillStyle = deskGrad;
  ctx.fillRect(deskX, deskY, deskW, 34);
  ctx.strokeStyle = '#52525b';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(deskX, deskY, deskW, 34);

  // --- PROP 1: MULTI-CRT SECURITY MONITOR STACK (Left side of desk) ---
  const crtPositions = [
    { x: deskX + 36, y: deskY - 88, w: 106, h: 84 },
    { x: deskX + 148, y: deskY - 80, w: 98, h: 76 },
    { x: deskX + 82, y: deskY - 160, w: 92, h: 70 },
  ];
  crtPositions.forEach((crt, idx) => {
    ctx.fillStyle = '#27272a';
    ctx.fillRect(crt.x, crt.y, crt.w, crt.h);
    ctx.strokeStyle = '#3f3f46';
    ctx.lineWidth = 3.5;
    ctx.strokeRect(crt.x, crt.y, crt.w, crt.h);

    ctx.fillStyle = isFlickering ? '#38bdf8' : idx === 0 ? '#052e16' : '#090d16';
    ctx.fillRect(crt.x + 7, crt.y + 7, crt.w - 14, crt.h - 16);

    ctx.strokeStyle = idx === 0 ? '#22c55e' : '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let sx = 0; sx < crt.w - 18; sx += 4) {
      const sy =
        crt.y +
        crt.h / 2 +
        Math.sin(timeSec * 8 + sx * 0.2 + idx) * 8;
      if (sx === 0) ctx.moveTo(crt.x + 9 + sx, sy);
      else ctx.lineTo(crt.x + 9 + sx, sy);
    }
    ctx.stroke();
  });

  // --- PROP 2: ICONIC FNAF OSCILLATING DESK FAN (Center of desk) ---
  const fanX = 20;
  const fanY = deskY - 86;
  ctx.fillStyle = '#18181b';
  ctx.beginPath();
  ctx.ellipse(fanX, deskY + 5, 40, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(fanX - 6, fanY + 24, 12, 64);

  ctx.save();
  ctx.translate(fanX, fanY);
  ctx.rotate(timeSec * 22);
  ctx.fillStyle = 'rgba(161, 161, 170, 0.75)';
  for (let b = 0; b < 4; b++) {
    ctx.rotate(Math.PI / 2);
    ctx.beginPath();
    ctx.ellipse(0, -28, 12, 28, 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.strokeStyle = '#52525b';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(fanX, fanY, 58, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(fanX, fanY, 13, 0, Math.PI * 2);
  ctx.fillStyle = '#27272a';
  ctx.fill();

  // --- PROP 3: RED & WHITE STRIPED SODA CUP WITH STRAW (Right side of desk) ---
  const cupX = 165;
  const cupY = deskY - 62;
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.moveTo(cupX - 18, cupY);
  ctx.lineTo(cupX + 18, cupY);
  ctx.lineTo(cupX + 13, cupY + 64);
  ctx.lineTo(cupX - 13, cupY + 64);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(cupX - 10, cupY + 2, 6, 60);
  ctx.fillRect(cupX + 4, cupY + 2, 6, 60);
  ctx.fillStyle = '#e4e4e7';
  ctx.fillRect(cupX - 20, cupY - 5, 40, 6);
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(cupX, cupY - 5);
  ctx.lineTo(cupX + 8, cupY - 28);
  ctx.lineTo(cupX + 20, cupY - 30);
  ctx.stroke();

  // --- PROP 4: CRUMPLED PAPER BALLS ON DESK ---
  const papers = [
    [-52, deskY + 10],
    [94, deskY + 15],
    [220, deskY + 8],
    [252, deskY + 18],
  ];
  ctx.fillStyle = '#d4d4d8';
  papers.forEach(([px, py]) => {
    ctx.beginPath();
    ctx.arc(px, py, 9, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.restore();
}

export type OfficeWallButtonAction =
  | 'LEFT_DOOR'
  | 'LEFT_LIGHT'
  | 'RIGHT_DOOR'
  | 'RIGHT_LIGHT'
  | 'VENT_SEAL';

/**
 * Hit-tests whether a canvas coordinate (in 0..width, 0..height) is over one of the physical
 * FNAF 1 wall switch buttons (Left Door, Left Light, Right Door, Right Light, or Center Vent).
 */
export function hitTestOfficeWallButtons(
  canvasX: number,
  canvasY: number,
  width: number,
  height: number,
  panX: number
): OfficeWallButtonAction | null {
  const worldW = Math.max(width * 2.15, 3100);
  const maxOffset = (worldW - width) / 2;
  const offsetX = -panX * maxOffset;

  const worldX = canvasX - (width / 2 + offsetX);
  const worldY = canvasY;

  const boxY = height * 0.40;
  const boxH = 140;

  // Left Wall Switch Box (x = -1064, w = 50, h = 140)
  if (worldX >= -1074 && worldX <= -1004 && worldY >= boxY - 6 && worldY <= boxY + boxH + 6) {
    if (worldY < boxY + boxH / 2) {
      return 'LEFT_DOOR';
    }
    return 'LEFT_LIGHT';
  }

  // Right Wall Switch Box (x = 1014, w = 50, h = 140)
  if (worldX >= 1004 && worldX <= 1074 && worldY >= boxY - 6 && worldY <= boxY + boxH + 6) {
    if (worldY < boxY + boxH / 2) {
      return 'RIGHT_DOOR';
    }
    return 'RIGHT_LIGHT';
  }

  // Top-Center Vent Frame / Shutter Switch (x in [-175, +175], y in [8, 206])
  if (worldX >= -175 && worldX <= 175 && worldY >= 8 && worldY <= 206) {
    return 'VENT_SEAL';
  }

  return null;
}

function drawWallSwitchBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  doorClosed: boolean,
  lightOn: boolean
) {
  ctx.save();
  const w = 50;
  const h = 140;

  // Heavy industrial steel housing
  ctx.fillStyle = '#141418';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#71717a';
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, w, h);

  // Inner recessed panel
  ctx.fillStyle = '#09090b';
  ctx.fillRect(x + 4, y + 4, w - 8, h - 8);

  // --- TOP PHYSICAL BUTTON: DOOR (Emerald when closed, Crimson when open) ---
  const doorBtnColor = doorClosed ? '#10b981' : '#dc2626';
  ctx.fillStyle = doorClosed ? '#065f46' : '#7f1d1d';
  ctx.fillRect(x + 8, y + 10, w - 16, 52);

  ctx.fillStyle = doorBtnColor;
  ctx.fillRect(x + 10, y + 12, w - 20, 44);

  // Subtle glow when active
  ctx.strokeStyle = doorClosed ? '#6ee7b7' : '#fca5a5';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 10, y + 12, w - 20, 44);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 9px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('DOOR', x + w / 2, y + 38);

  // --- BOTTOM PHYSICAL BUTTON: LIGHT (Amber/Yellow when on, Slate when off) ---
  ctx.fillStyle = lightOn ? '#78350f' : '#27272a';
  ctx.fillRect(x + 8, y + 76, w - 16, 52);

  ctx.fillStyle = lightOn ? '#facc15' : '#52525b';
  ctx.fillRect(x + 10, y + 78, w - 20, 44);

  ctx.strokeStyle = lightOn ? '#fef08a' : '#71717a';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 10, y + 78, w - 20, 44);

  ctx.fillStyle = lightOn ? '#09090b' : '#e4e4e7';
  ctx.font = 'bold 9px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('LIGHT', x + w / 2, y + 104);

  ctx.restore();
}

