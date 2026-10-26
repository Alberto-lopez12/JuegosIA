import {
  ANIMATRONIC_FACE_CROPS,
  AnimatronicId,
  CameraId,
  NightSimulationState,
} from '../game/types';

export interface OfficeHitboxes {
  leftDoorBtn: { x: number; y: number; w: number; h: number };
  leftLightBtn: { x: number; y: number; w: number; h: number };
  rightDoorBtn: { x: number; y: number; w: number; h: number };
  rightLightBtn: { x: number; y: number; w: number; h: number };
  posterNose: { x: number; y: number; r: number };
  fanToggle: { x: number; y: number; r: number };
}

// Preload and cache the 4 politician face images for 60 FPS Canvas2D rendering
const faceImageCache: Partial<Record<AnimatronicId, HTMLImageElement>> = {};

function getPoliticianFaceImage(id: AnimatronicId): HTMLImageElement | null {
  if (typeof window === 'undefined' || typeof Image === 'undefined') return null;
  let img = faceImageCache[id];
  if (!img) {
    img = new Image();
    img.src = ANIMATRONIC_FACE_CROPS[id].src;
    faceImageCache[id] = img;
  }
  if (img.complete && img.naturalWidth > 0) {
    return img;
  }
  return null;
}

// Eagerly trigger preload in browser environments
if (typeof window !== 'undefined') {
  (['pedro', 'rajoy', 'montero', 'abascal', 'echenique'] as AnimatronicId[]).forEach((id) => {
    getPoliticianFaceImage(id);
  });
}

/**
 * Draws an articulated político-animatronic character at (cx, cy) with given scale and pose,
 * using the real uploaded photograph of each politician rigged as a two-part articulated animatronic head.
 */
export function drawAnimatronicCharacter(
  ctx: CanvasRenderingContext2D,
  id: AnimatronicId,
  cx: number,
  cy: number,
  scale: number,
  options: {
    pose?:
      | 'stage'
      | 'stalk'
      | 'closeup'
      | 'window'
      | 'sprint'
      | 'jumpscare'
      | 'dark_eyes'
      | 'slumped';
    time?: number;
    jawOpen?: number; // 0..1
    eyeGlow?: number; // 0..1
  } = {}
) {
  const {
    pose = 'stage',
    time = 0,
    jawOpen = pose === 'jumpscare'
      ? 0.55 + 0.45 * Math.sin(time * 38)
      : pose === 'slumped'
      ? 0.38
      : 0.14 + 0.1 * Math.sin(time * 3),
    eyeGlow = 1,
  } = options;

  const faceImg = getPoliticianFaceImage(id);
  const crop = ANIMATRONIC_FACE_CROPS[id];

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  // Subtle servo breathing / twitching
  const twitchX =
    pose === 'jumpscare'
      ? Math.sin(time * 55) * 8
      : pose === 'slumped'
      ? Math.sin(time * 48) * 1.2
      : Math.sin(time * 2.3) * 1.5;
  const twitchAngle =
    pose === 'jumpscare'
      ? Math.sin(time * 42) * 0.14
      : pose === 'slumped'
      ? 0.28 + Math.sin(time * 35) * 0.02
      : pose === 'closeup'
      ? Math.sin(time * 7) * 0.06
      : Math.sin(time * 1.8) * 0.02;

  ctx.translate(twitchX, 0);

  // Special mode for Power Outage Toreador March (ghostly Pedro face + blazing endoskeleton eyes)
  if (pose === 'dark_eyes') {
    const flicker = Math.sin(time * 27) > -0.35 ? 1 : 0.15;
    ctx.globalAlpha = flicker;

    if (faceImg) {
      ctx.save();
      ctx.globalAlpha = flicker * 0.35;
      ctx.beginPath();
      ctx.roundRect(-42, -74, 84, 84, 20);
      ctx.clip();
      const sx = faceImg.naturalWidth * crop.fx;
      const sy = faceImg.naturalHeight * crop.fy;
      const sw = faceImg.naturalWidth * crop.fw;
      const sh = faceImg.naturalHeight * crop.fh;
      ctx.drawImage(faceImg, sx, sy, sw, sh, -42, -74, 84, 84);
      ctx.restore();
    } else {
      ctx.fillStyle = 'rgba(35, 45, 65, 0.38)';
      ctx.beginPath();
      ctx.arc(0, -32, 42, 0, Math.PI * 2);
      ctx.fill();
    }

    // Glowing cyan-white endoskeleton eyes over the politician's eye sockets
    ctx.shadowColor = '#67e8f9';
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#ecfeff';
    ctx.beginPath();
    ctx.arc(crop.leftEye.x, crop.leftEye.y, 7, 0, Math.PI * 2);
    ctx.arc(crop.rightEye.x, crop.rightEye.y, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0891b2';
    ctx.beginPath();
    ctx.arc(crop.leftEye.x, crop.leftEye.y, 3, 0, Math.PI * 2);
    ctx.arc(crop.rightEye.x, crop.rightEye.y, 3, 0, Math.PI * 2);
    ctx.fill();

    // Faint glowing endoskeleton teeth row
    ctx.fillStyle = 'rgba(226, 232, 240, 0.65)';
    for (let i = -3; i <= 3; i++) {
      ctx.fillRect(i * 7 - 2.5, -12 + Math.sin(time * 12) * 3, 5, 7);
    }
    ctx.restore();
    return;
  }

  // 1. TORSO & SHOULDERS (Endoskeleton + Suit Plating)
  if (pose !== 'closeup') {
    // Endoskeleton waist & spine
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-26, 55, 52, 48);
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    for (let y = 62; y <= 94; y += 10) {
      ctx.beginPath();
      ctx.moveTo(-24, y);
      ctx.lineTo(24, y);
      ctx.stroke();
    }

    // Main Torso Armor
    const torsoColors: Record<AnimatronicId, string> = {
      pedro: '#172554', // Presidential navy suit over brown bear animatronic frame
      rajoy: '#1e3a8a', // PP Royal Blue / Bonnie indigo
      montero: '#eab308', // Chica Gold with purple jacket trim
      abascal: '#7f1d1d', // Foxy crimson-rust with Vox green coat
      echenique: '#ca8a04', // Golden Freddy tarnished antique gold suit
    };

    ctx.fillStyle = torsoColors[id];
    ctx.beginPath();
    ctx.roundRect(-52, 12, 104, 86, 18);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#0f172a';
    ctx.stroke();

    // Character-specific Torso Details
    if (id === 'pedro') {
      // Presidential crisp shirt V, crimson tie, and PSOE rose LED pin
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.moveTo(-20, 14);
      ctx.lineTo(20, 14);
      ctx.lineTo(0, 62);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.moveTo(-5, 18);
      ctx.lineTo(5, 18);
      ctx.lineTo(8, 56);
      ctx.lineTo(0, 66);
      ctx.lineTo(-8, 56);
      ctx.closePath();
      ctx.fill();

      // Lapel Rose Pin
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(-28, 34, 5, 0, Math.PI * 2);
      ctx.fill();

      // Right arm holding vintage silver microphone
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(50, 22, 22, 52);
      ctx.fillStyle = '#94a3b8';
      ctx.beginPath();
      ctx.arc(68, 18, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#334155';
      ctx.stroke();
    } else if (id === 'echenique') {
      // Echenique-Golden Freddy: Weathered golden belly plate, black bow tie, limp slumped arms & legs
      ctx.fillStyle = '#eab308';
      ctx.beginPath();
      ctx.ellipse(0, 56, 34, 34, 0, 0, Math.PI * 2);
      ctx.fill();

      // Classic Golden Freddy Black/Dark-Navy Bowtie
      ctx.fillStyle = '#090d16';
      ctx.beginPath();
      ctx.moveTo(0, 22);
      ctx.lineTo(-22, 12);
      ctx.lineTo(-22, 32);
      ctx.closePath();
      ctx.moveTo(0, 22);
      ctx.lineTo(22, 12);
      ctx.lineTo(22, 32);
      ctx.closePath();
      ctx.fill();

      // Limp slumped golden arms hanging down at the sides with exposed wires
      ctx.fillStyle = '#a16207';
      ctx.beginPath();
      ctx.roundRect(-74, 18, 22, 74, 10);
      ctx.roundRect(52, 18, 22, 74, 10);
      ctx.fill();
      ctx.strokeStyle = '#090d16';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Slumped seated legs splayed out in front when in office ('slumped' pose)
      if (pose === 'slumped') {
        ctx.fillStyle = '#a16207';
        ctx.beginPath();
        ctx.roundRect(-58, 86, 38, 42, 12);
        ctx.roundRect(20, 86, 38, 42, 12);
        ctx.fill();
        ctx.stroke();

        // Endoskeleton foot soles facing viewer
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.ellipse(-40, 124, 20, 14, -0.2, 0, Math.PI * 2);
        ctx.ellipse(40, 124, 20, 14, 0.2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (id === 'rajoy') {
      // Light blue belly plate + Red Bonnie Bowtie + Electric Guitar
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.ellipse(0, 56, 34, 34, 0, 0, Math.PI * 2);
      ctx.fill();

      // Red Bowtie
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.moveTo(0, 22);
      ctx.lineTo(-22, 12);
      ctx.lineTo(-22, 32);
      ctx.closePath();
      ctx.moveTo(0, 22);
      ctx.lineTo(22, 12);
      ctx.lineTo(22, 32);
      ctx.closePath();
      ctx.fill();

      // Red V-Body Electric Guitar across torso
      ctx.save();
      ctx.rotate(-0.28);
      ctx.fillStyle = '#b91c1c';
      ctx.beginPath();
      ctx.moveTo(-38, 35);
      ctx.lineTo(25, 25);
      ctx.lineTo(5, 78);
      ctx.lineTo(-15, 58);
      ctx.lineTo(-35, 78);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#fef2f2';
      ctx.lineWidth = 2;
      ctx.stroke();
      // Guitar neck
      ctx.fillStyle = '#fde047';
      ctx.fillRect(18, 38, 65, 8);
      ctx.restore();
    } else if (id === 'montero') {
      // Purple ministerial lapels + White "¡A LEGISLAR!" Bib + Mr. Cupcake on Left Tray
      ctx.fillStyle = '#6b21a8';
      ctx.fillRect(-50, 16, 22, 75);
      ctx.fillRect(28, 16, 22, 75);

      // Bib
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.arc(0, 44, 34, 0, Math.PI);
      ctx.fill();
      ctx.strokeStyle = '#cbd5e1';
      ctx.stroke();

      ctx.fillStyle = '#7e22ce';
      ctx.font = 'bold 9px Oswald, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('¡A LEGISLAR!', 0, 62);

      // Mr. Cupcake on tray
      ctx.save();
      ctx.translate(-64, 34 + Math.sin(time * 4) * 3);
      ctx.fillStyle = '#d97706';
      ctx.fillRect(-12, 6, 24, 16);
      ctx.fillStyle = '#ec4899';
      ctx.beginPath();
      ctx.arc(0, 4, 15, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(-5, 0, 4, 0, Math.PI * 2);
      ctx.arc(5, 0, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(-5, 0, 1.5, 0, Math.PI * 2);
      ctx.arc(5, 0, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#a855f7';
      ctx.fillRect(-2, -18, 4, 10);
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(0, -21, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (id === 'abascal') {
      // Vox-green Corsair Coat + Withered Endoskeleton Ribs + Gleaming Steel Hook
      ctx.fillStyle = '#14532d';
      ctx.fillRect(-52, 14, 28, 82);
      ctx.fillRect(24, 14, 28, 82);

      // Gold epaulets
      ctx.fillStyle = '#eab308';
      ctx.fillRect(-56, 12, 24, 8);
      ctx.fillRect(32, 12, 24, 8);

      // Exposed metallic endoskeleton ribs in center chest
      ctx.fillStyle = '#090d16';
      ctx.fillRect(-22, 24, 44, 58);
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 3;
      for (let r = 32; r <= 72; r += 12) {
        ctx.beginPath();
        ctx.moveTo(-18, r);
        ctx.lineTo(18, r);
        ctx.stroke();
      }

      // Gleaming Steel Pirate Hook on right arm
      ctx.save();
      ctx.translate(-64, 48);
      ctx.rotate(pose === 'sprint' ? -0.45 + Math.sin(time * 20) * 0.3 : -0.15);
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.arc(0, 12, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, -10, 16, 0.2, Math.PI * 1.35);
      ctx.stroke();
      ctx.restore();
    }
  }

  // 2. ARTICULATED NECK & TWO-PIECE PHOTO-ANIMATRONIC HEAD ASSEMBLY
  ctx.save();
  ctx.rotate(twitchAngle);

  // Endoskeleton neck pistons & cables
  ctx.fillStyle = '#334155';
  ctx.fillRect(-16, -8, 32, 24);
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-10, -6);
  ctx.lineTo(-10, 14);
  ctx.moveTo(10, -6);
  ctx.lineTo(10, 14);
  ctx.stroke();

  const frameColors: Record<AnimatronicId, string> = {
    pedro: '#92400e', // Freddy bronze-brown animatronic casing
    rajoy: '#2563eb', // Bonnie cobalt-blue animatronic casing
    montero: '#eab308', // Chica gold-purple animatronic casing
    abascal: '#991b1b', // Foxy crimson-iron animatronic casing
    echenique: '#eab308', // Golden Freddy bright antique gold casing
  };

  // ANIMATRONIC EARS (Behind Head)
  if (id === 'pedro' || id === 'echenique') {
    // Round Freddy / Golden Freddy Animatronic Ears
    ctx.fillStyle = id === 'echenique' ? '#ca8a04' : '#78350f';
    ctx.beginPath();
    ctx.arc(-44, -68, 16, 0, Math.PI * 2);
    ctx.arc(44, -68, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#090d16';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = id === 'echenique' ? '#713f12' : '#451a03';
    ctx.beginPath();
    ctx.arc(-44, -68, 9, 0, Math.PI * 2);
    ctx.arc(44, -68, 9, 0, Math.PI * 2);
    ctx.fill();
  } else if (id === 'rajoy') {
    // Tall Segmented Bonnie Rabbit Ears
    [-25, 25].forEach((ex, i) => {
      ctx.save();
      ctx.translate(ex, -76);
      ctx.rotate(i === 0 ? -0.14 : 0.16);
      ctx.fillStyle = '#1d4ed8';
      ctx.beginPath();
      ctx.roundRect(-11, -50, 22, 48, 10);
      ctx.fill();
      ctx.strokeStyle = '#090d16';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.fillStyle = '#93c5fd';
      ctx.beginPath();
      ctx.roundRect(-6, -44, 12, 34, 6);
      ctx.fill();
      ctx.restore();
    });
  } else if (id === 'montero') {
    // Chica top feather tuft + purple animatronic side-servos
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.ellipse(0, -86, 14, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#090d16';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#7e22ce';
    ctx.fillRect(-50, -48, 8, 22);
    ctx.fillRect(42, -48, 8, 22);
  } else if (id === 'abascal') {
    // Pointed Foxy Ears with metallic inner servos
    [-40, 40].forEach((ex, i) => {
      ctx.save();
      ctx.translate(ex, -66);
      ctx.rotate(i === 0 ? -0.45 : 0.45);
      ctx.fillStyle = '#991b1b';
      ctx.beginPath();
      ctx.moveTo(-14, 0);
      ctx.lineTo(0, -40);
      ctx.lineTo(14, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#090d16';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();
    });
  }

  // HEAD DIMENSIONS & JAW SPLIT GEOMETRY
  const headX = -45;
  const headY = -78;
  const headW = 90;
  const headH = 88;
  const upperH = Math.round(headH * crop.jawSplitRatio); // ~62px
  const lowerH = headH - upperH; // ~26px
  const splitY = headY + upperH;
  const jawOffset = Math.max(0, jawOpen) * 20;

  // INTERNAL ENDOSKELETON MOUTH CAVITY (Revealed when the politician's jaw opens!)
  ctx.fillStyle = '#020617';
  ctx.beginPath();
  ctx.roundRect(-36, splitY - 12, 72, 26 + jawOffset, 8);
  ctx.fill();
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Hydraulic jaw wires inside mouth cavity
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-28, splitY - 6);
  ctx.lineTo(-24, splitY + jawOffset + 6);
  ctx.moveTo(28, splitY - 6);
  ctx.lineTo(24, splitY + jawOffset + 6);
  ctx.stroke();

  // Upper Endoskeleton Teeth Row (Fixed to upper cranium)
  ctx.fillStyle = '#e2e8f0';
  for (let t = -22; t <= 22; t += 9) {
    ctx.fillRect(t - 3.5, splitY - 2, 7, 6);
  }

  // 2A. UPPER CRANIUM FACEPLATE (With Politician Photo Upper Face)
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(headX, headY, headW, upperH, [22, 22, 5, 5]);
  ctx.clip();

  if (faceImg) {
    const sx = faceImg.naturalWidth * crop.fx;
    const sy = faceImg.naturalHeight * crop.fy;
    const sw = faceImg.naturalWidth * crop.fw;
    const sh = faceImg.naturalHeight * crop.fh * crop.jawSplitRatio;
    ctx.drawImage(faceImg, sx, sy, sw, sh, headX, headY, headW, upperH);
    if (id === 'echenique') {
      // Subtle golden-amber hallucination wash over Echenique's upper face
      ctx.fillStyle = 'rgba(234, 179, 8, 0.22)';
      ctx.fillRect(headX, headY, headW, upperH);
    }
  } else {
    ctx.fillStyle = frameColors[id];
    ctx.fillRect(headX, headY, headW, upperH);
  }

  // Subtle FNAF Sister-Location-style animatronic faceplate seam lines & metallic shading
  const seamGrad = ctx.createRadialGradient(0, headY + upperH * 0.5, 22, 0, headY + upperH * 0.5, 56);
  seamGrad.addColorStop(0, 'rgba(0,0,0,0)');
  seamGrad.addColorStop(1, 'rgba(2, 6, 23, 0.42)');
  ctx.fillStyle = seamGrad;
  ctx.fillRect(headX, headY, headW, upperH);

  ctx.strokeStyle = 'rgba(15, 23, 42, 0.55)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, headY);
  ctx.lineTo(0, headY + 14);
  ctx.moveTo(headX, splitY - 16);
  ctx.lineTo(headX + 14, splitY - 8);
  ctx.moveTo(headX + headW, splitY - 16);
  ctx.lineTo(headX + headW - 14, splitY - 8);
  ctx.stroke();
  ctx.restore();

  // Outer metallic casing rim for Upper Cranium
  ctx.strokeStyle = frameColors[id];
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.roundRect(headX, headY, headW, upperH, [22, 22, 5, 5]);
  ctx.stroke();

  // Corner servo rivets on Upper Cranium
  ctx.fillStyle = '#94a3b8';
  [
    [headX + 8, headY + 10],
    [headX + headW - 8, headY + 10],
    [headX + 6, splitY - 6],
    [headX + headW - 6, splitY - 6],
  ].forEach(([rx, ry]) => {
    ctx.beginPath();
    ctx.arc(rx, ry, 2.2, 0, Math.PI * 2);
    ctx.fill();
  });

  // 2B. ARTICULATED LOWER JAW PLATE (With Politician Photo Mouth/Chin/Beard)
  ctx.save();
  ctx.translate(0, jawOffset);

  // Lower Endoskeleton Teeth Row along the top of the moving jaw
  ctx.fillStyle = '#f8fafc';
  if (id === 'abascal') {
    for (let t = -24; t <= 24; t += 8) {
      ctx.beginPath();
      ctx.moveTo(t - 3.5, splitY);
      ctx.lineTo(t, splitY - 7);
      ctx.lineTo(t + 3.5, splitY);
      ctx.closePath();
      ctx.fill();
    }
  } else {
    for (let t = -22; t <= 22; t += 9) {
      ctx.fillRect(t - 3.5, splitY - 6, 7, 7);
    }
  }

  const jawW = headW - 8;
  const jawX = -jawW / 2;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(jawX, splitY, jawW, lowerH + 4, [4, 4, 18, 18]);
  ctx.clip();

  if (faceImg) {
    const sx = faceImg.naturalWidth * crop.fx;
    const sy =
      faceImg.naturalHeight * (crop.fy + crop.fh * crop.jawSplitRatio);
    const sw = faceImg.naturalWidth * crop.fw;
    const sh = faceImg.naturalHeight * crop.fh * (1 - crop.jawSplitRatio);
    ctx.drawImage(faceImg, sx, sy, sw, sh, headX, splitY, headW, lowerH + 4);
    if (id === 'echenique') {
      ctx.fillStyle = 'rgba(234, 179, 8, 0.22)';
      ctx.fillRect(jawX, splitY, jawW, lowerH + 4);
    }
  } else {
    ctx.fillStyle = frameColors[id];
    ctx.fillRect(jawX, splitY, jawW, lowerH + 4);
  }

  // Subtle jaw shadow
  ctx.fillStyle = 'rgba(2, 6, 23, 0.25)';
  ctx.fillRect(jawX, splitY, jawW, 4);
  ctx.restore();

  // Metallic Casing Rim for Lower Articulated Jaw
  ctx.strokeStyle = frameColors[id];
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(jawX, splitY, jawW, lowerH + 4, [4, 4, 18, 18]);
  ctx.stroke();

  // Jaw Hinge Bolts
  ctx.fillStyle = '#cbd5e1';
  ctx.beginPath();
  ctx.arc(jawX + 6, splitY + 7, 2.5, 0, Math.PI * 2);
  ctx.arc(jawX + jawW - 6, splitY + 7, 2.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore(); // End moving lower jaw

  // 2C. ANIMATRONIC EYE OVERLAYS, PIRATE EYEPATCH & PRESIDENTIAL TOP HAT
  const irisColors: Record<AnimatronicId, string> = {
    pedro: '#38bdf8', // Ice blue Freddy eyes
    rajoy: '#f43f5e', // Crimson-magenta Bonnie eyes
    montero: '#c084fc', // Bright violet Chica eyes
    abascal: '#facc15', // Glowing golden Foxy eye
    echenique: '#fef08a', // Golden Freddy eerie pinprick light
  };

  const eyes = [crop.leftEye, crop.rightEye];
  eyes.forEach((eyePos, idx) => {
    // Echenique-Golden Freddy always has hollow pitch-black eye sockets with tiny white pinpricks!
    if (id === 'echenique') {
      ctx.save();
      ctx.fillStyle = '#020617';
      ctx.beginPath();
      ctx.arc(eyePos.x, eyePos.y, 9.5, 0, Math.PI * 2);
      ctx.fill();

      // Tiny ghostly white pinprick pupil
      ctx.shadowColor = '#fef08a';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(eyePos.x, eyePos.y, 2.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    // Abascal-Foxy wears a Pirate Eyepatch over his right eye (idx === 0)
    if (id === 'abascal' && idx === 0) {
      ctx.save();
      // Diagonal eyepatch strap across forehead
      ctx.strokeStyle = '#090d16';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(-44, -62);
      ctx.lineTo(14, -36);
      ctx.stroke();

      // Flip-up eyepatch in jumpscare, closed in normal/stalk
      const patchOffsetY = pose === 'jumpscare' ? -14 : 0;
      ctx.fillStyle = '#090d16';
      ctx.beginPath();
      ctx.arc(eyePos.x, eyePos.y + patchOffsetY, 10.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
      if (pose !== 'jumpscare') return;
    }

    // In stalk, window, closeup, sprint, or jumpscare poses, ignite the FNAF glowing endoskeleton eyes!
    if (
      pose === 'stalk' ||
      pose === 'window' ||
      pose === 'jumpscare' ||
      pose === 'sprint' ||
      pose === 'closeup'
    ) {
      const glowRadius = pose === 'jumpscare' ? 7 : pose === 'closeup' ? 4.5 : 5.5;
      ctx.save();
      ctx.fillStyle = 'rgba(2, 6, 23, 0.72)';
      ctx.beginPath();
      ctx.arc(eyePos.x, eyePos.y, glowRadius + 3.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowColor = irisColors[id];
      ctx.shadowBlur = 14 * eyeGlow;
      ctx.fillStyle = irisColors[id];
      ctx.beginPath();
      ctx.arc(eyePos.x, eyePos.y, glowRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(eyePos.x, eyePos.y, glowRadius * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  });

  // Character-Specific Headgear over the Photo Cranium
  if (id === 'pedro' || id === 'echenique') {
    // Black Presidential Freddy / Golden Freddy Top Hat
    ctx.fillStyle = '#090d16';
    ctx.fillRect(-36, -83, 72, 8);
    ctx.fillRect(-25, -115, 50, 34);
    ctx.fillStyle = id === 'echenique' ? '#1e293b' : '#eab308';
    ctx.fillRect(-25, -89, 50, 5);

    // Subtle animatronic nose button highlight (for the Celebrate poster Nose Honk easter egg!)
    ctx.fillStyle = 'rgba(9, 13, 22, 0.45)';
    ctx.beginPath();
    ctx.ellipse(0, -30, 8, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (id === 'abascal') {
    // Corsair Green Bandana Header
    ctx.fillStyle = '#14532d';
    ctx.fillRect(-43, -80, 86, 8);
    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-43, -80, 86, 8);
  }

  ctx.restore(); // End head assembly
  ctx.restore(); // End character transform
}

/**
 * Renders the panoramic Security Office in La Moncloa on a Canvas2D context.
 * Returns interactive hitboxes in canvas coordinate space.
 */
export function drawOfficeScene(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: NightSimulationState,
  panNormalized: number, // -1 (far left) to +1 (far right)
  doorAnim: { left: number; right: number }, // 0 (open) to 1 (closed)
  time: number
): OfficeHitboxes {
  ctx.save();
  ctx.clearRect(0, 0, width, height);

  // Virtual panoramic width is 1.5x the viewport width
  const worldW = Math.round(width * 1.5);
  const maxOffset = (worldW - width) / 2;
  const panOffsetX = -panNormalized * maxOffset;
  const baseCenterOffset = -(worldW - width) / 2;

  ctx.save();
  ctx.translate(baseCenterOffset + panOffsetX, 0);

  const isOutage = state.powerOutage;

  // 1. BACK WALL & PERSPECTIVE ROOM GEOMETRY
  const wallGrad = ctx.createLinearGradient(0, 0, 0, height);
  wallGrad.addColorStop(0, isOutage ? '#020305' : '#0c1017');
  wallGrad.addColorStop(0.55, isOutage ? '#04060a' : '#161e2e');
  wallGrad.addColorStop(1, isOutage ? '#020305' : '#090d14');
  ctx.fillStyle = wallGrad;
  ctx.fillRect(0, 0, worldW, height);

  // Checkered FNAF security floor at bottom 22%
  const floorY = height * 0.78;
  ctx.fillStyle = isOutage ? '#030407' : '#0b0f19';
  ctx.fillRect(0, floorY, worldW, height - floorY);

  const tileCols = 24;
  const tileW = worldW / tileCols;
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < tileCols; c++) {
      if ((r + c) % 2 === 0) {
        ctx.fillStyle = isOutage ? 'rgba(255,255,255,0.015)' : 'rgba(226, 232, 240, 0.06)';
        ctx.fillRect(c * tileW, floorY + r * ((height - floorY) / 4), tileW, (height - floorY) / 4);
      }
    }
  }

  // Red & Black institutional wainscot stripe across the wall
  if (!isOutage) {
    ctx.fillStyle = '#7f1d1d';
    ctx.fillRect(0, height * 0.56, worldW, 14);
    // Small black-and-white checkered trim along the stripe
    for (let x = 0; x < worldW; x += 22) {
      ctx.fillStyle = (x / 22) % 2 === 0 ? '#f8fafc' : '#090d16';
      ctx.fillRect(x, height * 0.56 + 3, 11, 8);
    }
  }

  // Ceiling pipes & overhead fluorescent lamp
  ctx.strokeStyle = isOutage ? '#0f172a' : '#334155';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(worldW * 0.12, height * 0.06);
  ctx.lineTo(worldW * 0.88, height * 0.06);
  ctx.stroke();

  if (!isOutage) {
    const flicker = Math.sin(time * 19) > -0.92 ? 0.14 : 0.05;
    const lampGrad = ctx.createRadialGradient(
      worldW * 0.5,
      height * 0.08,
      10,
      worldW * 0.5,
      height * 0.42,
      width * 0.55
    );
    lampGrad.addColorStop(0, `rgba(254, 249, 195, ${flicker})`);
    lampGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = lampGrad;
    ctx.fillRect(0, 0, worldW, height);
  }

  // 2. LEFT DOORWAY & LEFT WINDOW (West Wing Access)
  // Positioned so when panned full left (panNormalized = -1), the doorway sits cleanly beside the left switch housing
  const doorW = worldW * 0.125;
  const leftDoorX = worldW * 0.095;
  const doorY = height * 0.14;
  const doorH = floorY - doorY;

  // Hallway interior behind Left Door
  const leftHallLit = state.leftLightOn && !isOutage && Math.sin(time * 43) > -0.6;
  ctx.fillStyle = leftHallLit ? '#334155' : '#030508';
  ctx.fillRect(leftDoorX, doorY, doorW, doorH);

  // If Left Hallway Light is ON and Rajoy-Bonnie is at LEFT_DOOR, draw him looming in the doorway!
  if (leftHallLit && state.rajoyLocation === 'LEFT_DOOR') {
    // Dramatic warning backlight in corridor
    const scareGrad = ctx.createRadialGradient(
      leftDoorX + doorW * 0.5,
      doorY + doorH * 0.45,
      10,
      leftDoorX + doorW * 0.5,
      doorY + doorH * 0.45,
      doorW * 0.9
    );
    scareGrad.addColorStop(0, 'rgba(59, 130, 246, 0.42)');
    scareGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = scareGrad;
    ctx.fillRect(leftDoorX, doorY, doorW, doorH);

    drawAnimatronicCharacter(
      ctx,
      'rajoy',
      leftDoorX + doorW * 0.54,
      doorY + doorH * 0.52,
      Math.min(width, height) * 0.0022,
      { pose: 'window', time }
    );
  }

  // If Power Outage Toreador Song phase is active, draw Pedro-Freddy's glowing eyes in the Left Doorway!
  if (isOutage && state.outagePhase === 'toreador_song') {
    drawAnimatronicCharacter(
      ctx,
      'pedro',
      leftDoorX + doorW * 0.52,
      doorY + doorH * 0.46,
      Math.min(width, height) * 0.0021,
      { pose: 'dark_eyes', time }
    );
  }

  // Animated Left Hydraulic Blast Door
  if (doorAnim.left > 0.01) {
    const curDoorH = doorH * doorAnim.left;
    ctx.fillStyle = '#334155';
    ctx.fillRect(leftDoorX, doorY, doorW, curDoorH);

    // Corrugated steel ribs
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 3;
    for (let ry = doorY + 24; ry < doorY + curDoorH - 16; ry += 28) {
      ctx.beginPath();
      ctx.moveTo(leftDoorX + 6, ry);
      ctx.lineTo(leftDoorX + doorW - 6, ry);
      ctx.stroke();
    }

    // Yellow-black hazard bottom stripe
    ctx.fillStyle = '#eab308';
    ctx.fillRect(leftDoorX, doorY + curDoorH - 16, doorW, 16);
  }

  // Steel Doorframe Bevel
  ctx.strokeStyle = isOutage ? '#1e293b' : '#475569';
  ctx.lineWidth = 8;
  ctx.strokeRect(leftDoorX, doorY, doorW, doorH);

  // LEFT WINDOW (Between Left Door and Center Desk)
  const winW = worldW * 0.09;
  const winH = height * 0.34;
  const leftWinX = leftDoorX + doorW + worldW * 0.025;
  const winY = height * 0.22;

  ctx.fillStyle = leftHallLit ? '#475569' : '#04070d';
  ctx.fillRect(leftWinX, winY, winW, winH);
  if (leftHallLit && state.rajoyLocation === 'LEFT_DOOR') {
    // Cast Rajoy's ominous silhouette across the window glass!
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.arc(leftWinX + winW * 0.4, winY + winH * 0.55, winW * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = isOutage ? '#1e293b' : '#334155';
  ctx.lineWidth = 6;
  ctx.strokeRect(leftWinX, winY, winW, winH);

  // 3. RIGHT WINDOW & RIGHT DOORWAY (East Wing Access)
  // Symmetric to Left Doorway so when panned full right (panNormalized = +1), the entire Right Doorway is visible beside the right switch housing
  const rightDoorX = worldW - leftDoorX - doorW; // worldW * 0.78
  const rightWinX = rightDoorX - worldW * 0.025 - winW;
  const rightHallLit = state.rightLightOn && !isOutage && Math.sin(time * 41) > -0.6;

  // Right Window
  ctx.fillStyle = rightHallLit ? '#475569' : '#04070d';
  ctx.fillRect(rightWinX, winY, winW, winH);

  // In FNAF 1, Chica (Montero-Chica) appears staring right through the Right Office Window!
  if (rightHallLit && state.monteroLocation === 'RIGHT_DOOR') {
    ctx.save();
    ctx.beginPath();
    ctx.rect(rightWinX, winY, winW, winH);
    ctx.clip();
    drawAnimatronicCharacter(
      ctx,
      'montero',
      rightWinX + winW * 0.5,
      winY + winH * 0.68,
      Math.min(width, height) * 0.002,
      { pose: 'window', time }
    );
    ctx.restore();
  }
  ctx.strokeStyle = isOutage ? '#1e293b' : '#334155';
  ctx.lineWidth = 6;
  ctx.strokeRect(rightWinX, winY, winW, winH);

  // Right Doorway interior
  ctx.fillStyle = rightHallLit ? '#334155' : '#030508';
  ctx.fillRect(rightDoorX, doorY, doorW, doorH);

  // If Right Hallway Light is ON and Pedro-Freddy or Montero-Chica is at RIGHT_DOOR, show doorway presence
  if (rightHallLit && state.pedroLocation === 'RIGHT_DOOR') {
    drawAnimatronicCharacter(
      ctx,
      'pedro',
      rightDoorX + doorW * 0.48,
      doorY + doorH * 0.52,
      Math.min(width, height) * 0.0022,
      { pose: 'window', time }
    );
  }

  // Animated Right Hydraulic Blast Door
  if (doorAnim.right > 0.01) {
    const curDoorH = doorH * doorAnim.right;
    ctx.fillStyle = '#334155';
    ctx.fillRect(rightDoorX, doorY, doorW, curDoorH);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 3;
    for (let ry = doorY + 24; ry < doorY + curDoorH - 16; ry += 28) {
      ctx.beginPath();
      ctx.moveTo(rightDoorX + 6, ry);
      ctx.lineTo(rightDoorX + doorW - 6, ry);
      ctx.stroke();
    }
    ctx.fillStyle = '#eab308';
    ctx.fillRect(rightDoorX, doorY + curDoorH - 16, doorW, 16);
  }

  ctx.strokeStyle = isOutage ? '#1e293b' : '#475569';
  ctx.lineWidth = 8;
  ctx.strokeRect(rightDoorX, doorY, doorW, doorH);

  // 4. CENTER POSTER ("CELEBRATE! — PALACIO DE LA MONCLOA") & WALL DECOR
  const posterX = worldW * 0.38;
  const posterY = height * 0.16;
  const posterW = worldW * 0.16;
  const posterH = height * 0.34;

  ctx.fillStyle = isOutage ? '#090d16' : '#0f172a';
  ctx.fillRect(posterX, posterY, posterW, posterH);
  ctx.strokeStyle = isOutage ? '#1e293b' : '#eab308';
  ctx.lineWidth = 3;
  ctx.strokeRect(posterX, posterY, posterW, posterH);

  if (!isOutage) {
    ctx.fillStyle = '#facc15';
    ctx.font = `bold ${Math.max(11, Math.round(height * 0.022))}px Oswald, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('¡CELEBRATE EN MONCLOA!', posterX + posterW / 2, posterY + 24);

    // Mini portrait silhouettes of Rajoy, Pedro, Montero on the poster
    drawAnimatronicCharacter(
      ctx,
      'rajoy',
      posterX + posterW * 0.24,
      posterY + posterH * 0.68,
      posterH * 0.0022,
      { pose: 'stage', time: 0 }
    );
    drawAnimatronicCharacter(
      ctx,
      'montero',
      posterX + posterW * 0.76,
      posterY + posterH * 0.68,
      posterH * 0.0022,
      { pose: 'stage', time: 0 }
    );
    drawAnimatronicCharacter(
      ctx,
      'pedro',
      posterX + posterW * 0.5,
      posterY + posterH * 0.65,
      posterH * 0.0026,
      { pose: 'stage', time: 0 }
    );
  }

  // Secondary corkboard / B.O.E. rules sheet on the right of the poster
  const boardX = worldW * 0.565;
  const boardY = height * 0.2;
  const boardW = worldW * 0.075;
  const boardH = height * 0.24;
  ctx.fillStyle = isOutage ? '#090d16' : '#1e293b';
  ctx.fillRect(boardX, boardY, boardW, boardH);
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 2;
  ctx.strokeRect(boardX, boardY, boardW, boardH);
  if (!isOutage) {
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(boardX + 8, boardY + 8, boardW * 0.42, boardH * 0.45);
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(boardX + boardW * 0.54, boardY + 14, boardW * 0.36, boardH * 0.38);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(boardX + 12, boardY + boardH * 0.6, boardW * 0.72, boardH * 0.28);
  }

  // 5. SECURITY DESK, CRT MONITORS & SPINNING BRASS DESK FAN
  const deskX = worldW * 0.33;
  const deskY = height * 0.61;
  const deskW = worldW * 0.34;
  const deskH = height * 0.28;

  // Desk top & mahogany front panel
  ctx.fillStyle = isOutage ? '#070a10' : '#271712';
  ctx.fillRect(deskX, deskY, deskW, deskH);
  ctx.fillStyle = isOutage ? '#0b0f17' : '#3f251d';
  ctx.fillRect(deskX - 14, deskY, deskW + 28, 18);
  ctx.strokeStyle = '#090d16';
  ctx.lineWidth = 3;
  ctx.strokeRect(deskX - 14, deskY, deskW + 28, 18);

  // Small Desk CRT Monitors (left side of desk)
  const crtX = deskX + deskW * 0.08;
  const crtY = deskY - height * 0.13;
  const crtW = deskW * 0.24;
  const crtH = height * 0.13;
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(crtX, crtY, crtW, crtH);
  ctx.fillStyle = isOutage ? '#020617' : '#0f172a';
  ctx.fillRect(crtX + 6, crtY + 6, crtW - 12, crtH - 12);
  if (!isOutage) {
    // Mini scanlines inside desk CRT
    ctx.fillStyle = 'rgba(56, 189, 248, 0.18)';
    ctx.fillRect(
      crtX + 6,
      crtY + 6 + ((time * 40) % (crtH - 18)),
      crtW - 12,
      4
    );
  }

  // Iconic Oscillating Desk Fan (center of desk)
  const fanCx = deskX + deskW * 0.52;
  const fanCy = deskY - height * 0.11;
  const fanR = Math.min(width, height) * 0.068;

  // Fan stand & base
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(fanCx - 6, fanCy + fanR * 0.7, 12, height * 0.11 - fanR * 0.7);
  ctx.beginPath();
  ctx.ellipse(fanCx, deskY + 2, 28, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Spinning Fan Blades
  ctx.save();
  ctx.translate(fanCx, fanCy);
  const bladeAngle = state.fanOn && !isOutage ? time * 24 : 0.4;
  ctx.rotate(bladeAngle);
  for (let b = 0; b < 4; b++) {
    ctx.rotate(Math.PI / 2);
    ctx.fillStyle = isOutage ? '#1e293b' : '#64748b';
    ctx.beginPath();
    ctx.ellipse(0, -fanR * 0.48, fanR * 0.22, fanR * 0.44, 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Fan wire cage
  ctx.strokeStyle = isOutage ? '#1e293b' : '#475569';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(fanCx, fanCy, fanR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(fanCx, fanCy, fanR * 0.2, 0, Math.PI * 2);
  ctx.fill();

  // Red & White Striped Cup with Straw on Right of Desk
  const cupX = deskX + deskW * 0.8;
  const cupY = deskY - 38;
  ctx.fillStyle = isOutage ? '#1e293b' : '#dc2626';
  ctx.fillRect(cupX, cupY, 22, 38);
  if (!isOutage) {
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(cupX, cupY + 12, 22, 10);
  }

  // 6. TACTILE DOOR & LIGHT WALL BUTTON PANELS (Left & Right)
  const panelW = Math.max(46, worldW * 0.036);
  const panelH = Math.max(124, height * 0.22);
  const leftPanelX = leftDoorX - panelW - 14;
  const rightPanelX = rightDoorX + doorW + 14;
  const panelY = height * 0.42;

  const drawWallPanel = (px: number, py: number) => {
    const btnPad = 7;
    const btnW = panelW - btnPad * 2;
    const btnH = (panelH - btnPad * 3) / 2;
    const doorBtnY = py + btnPad;
    const lightBtnY = py + btnPad * 2 + btnH;

    return {
      doorRect: { x: px + btnPad, y: doorBtnY, w: btnW, h: btnH },
      lightRect: { x: px + btnPad, y: lightBtnY, w: btnW, h: btnH },
    };
  };

  const leftBtns = drawWallPanel(leftPanelX, panelY);
  const rightBtns = drawWallPanel(rightPanelX, panelY);

  // 7. ECHENIQUE-GOLDEN FREDDY SLUMPED IN THE OFFICE (1/1000 Easter Egg — 2.5s to raise monitor!)
  if (state.goldenFreddyActive && !isOutage) {
    const unit = Math.min(width, height);
    drawAnimatronicCharacter(
      ctx,
      'echenique',
      worldW * 0.47,
      height * 0.72,
      unit * 0.0029,
      {
        pose: 'slumped',
        time,
      }
    );
  }

  ctx.restore(); // End world translation

  // Peripheral Vignette for atmospheric tension
  const vig = ctx.createRadialGradient(
    width / 2,
    height / 2,
    width * 0.25,
    width / 2,
    height / 2,
    width * 0.72
  );
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, isOutage ? 'rgba(0,0,0,0.92)' : 'rgba(0,0,0,0.68)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, width, height);

  // Rapid FNAF 1 "IT'S ME / ¡SOY YO!" Hallucination Flashes while Echenique-Golden Freddy is in the office
  if (state.goldenFreddyActive && !isOutage) {
    const urgency = Math.min(1, state.goldenFreddyTimer / 2.5);
    const flickerHit = Math.sin(time * (38 + urgency * 35)) > 0.25;
    if (flickerHit) {
      ctx.fillStyle = `rgba(234, 179, 8, ${0.08 + urgency * 0.14})`;
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = '#fef08a';
      ctx.font = `bold ${Math.round(height * 0.09)}px Oswald, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(
        Math.sin(time * 60) > 0 ? '¡SOY YO!' : "IT'S ME",
        width * (0.5 + Math.sin(time * 95) * 0.04),
        height * (0.34 + Math.cos(time * 75) * 0.05)
      );
    }
  }

  ctx.restore();

  // Convert world coordinates to screen coordinates for hitboxes
  const toScreenX = (wx: number) => wx + panOffsetX - (worldW - width) / 2;

  return {
    leftDoorBtn: {
      x: toScreenX(leftBtns.doorRect.x),
      y: leftBtns.doorRect.y,
      w: leftBtns.doorRect.w,
      h: leftBtns.doorRect.h,
    },
    leftLightBtn: {
      x: toScreenX(leftBtns.lightRect.x),
      y: leftBtns.lightRect.y,
      w: leftBtns.lightRect.w,
      h: leftBtns.lightRect.h,
    },
    rightDoorBtn: {
      x: toScreenX(rightBtns.doorRect.x),
      y: rightBtns.doorRect.y,
      w: rightBtns.doorRect.w,
      h: rightBtns.doorRect.h,
    },
    rightLightBtn: {
      x: toScreenX(rightBtns.lightRect.x),
      y: rightBtns.lightRect.y,
      w: rightBtns.lightRect.w,
      h: rightBtns.lightRect.h,
    },
    posterNose: {
      x: toScreenX(posterX + posterW * 0.5),
      y: posterY + posterH * 0.56,
      r: 30,
    },
    fanToggle: {
      x: toScreenX(fanCx),
      y: fanCy,
      r: fanR,
    },
  };
}

/**
 * Draws the classic metallic robotic Endo-03 (1/1000 Easter Egg in CAM_3)
 * staring directly into the camera lens with wide glowing optical eyes and articulated steel skeleton.
 */
export function drawEndo03Character(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale: number,
  time: number
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  // Subtle mechanical micro-jitter
  const jitterX = Math.sin(time * 31) * 0.9;
  const headTilt = Math.sin(time * 2.4) * 0.035;
  ctx.translate(jitterX, 0);

  // 1. ENDOSKELETON TORSO, SPINE, RIBS & HYDRAULIC PISTONS
  // Central spinal column
  ctx.fillStyle = '#334155';
  ctx.fillRect(-10, -10, 20, 115);
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 2;
  for (let sy = -4; sy <= 96; sy += 9) {
    ctx.strokeRect(-12, sy, 24, 5);
  }

  // Clavicle & Shoulder Servo Mounts
  ctx.fillStyle = '#475569';
  ctx.fillRect(-58, 12, 116, 10);
  ctx.fillStyle = '#94a3b8';
  [-56, 56].forEach((sx) => {
    ctx.beginPath();
    ctx.arc(sx, 17, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  });

  // Articulated Steel Arms & Pistons
  [-56, 56].forEach((ax, idx) => {
    ctx.save();
    ctx.translate(ax, 22);
    ctx.rotate(idx === 0 ? 0.12 : -0.12);
    ctx.fillStyle = '#475569';
    ctx.fillRect(-7, 0, 14, 46);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    ctx.strokeRect(-7, 0, 14, 46);
    // Elbow joint
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.arc(0, 48, 8, 0, Math.PI * 2);
    ctx.fill();
    // Forearm
    ctx.fillStyle = '#334155';
    ctx.fillRect(-6, 50, 12, 38);
    ctx.restore();
  });

  // Metallic Ribcage (5 paired chrome ribs around hollow core)
  ctx.fillStyle = '#020617';
  ctx.fillRect(-34, 24, 68, 62);
  for (let ry = 28; ry <= 76; ry += 12) {
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(-36, ry, 30, 6);
    ctx.fillRect(6, ry, 30, 6);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-36, ry, 30, 6);
    ctx.strokeRect(6, ry, 30, 6);
  }
  // Central sternum bar
  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(-5, 22, 10, 64);

  // Diagonal hydraulic waist pistons & red/blue power cables
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-26, 24);
  ctx.lineTo(-14, 88);
  ctx.stroke();
  ctx.strokeStyle = '#38bdf8';
  ctx.beginPath();
  ctx.moveTo(26, 24);
  ctx.lineTo(14, 88);
  ctx.stroke();

  // 2. ENDOSKELETON SKULL, EARS, JAW & STARING OPTICAL LENSES
  ctx.save();
  ctx.rotate(headTilt);

  // Metallic Ear-Servo Brackets
  [-42, 42].forEach((ex, i) => {
    ctx.save();
    ctx.translate(ex, -68);
    ctx.rotate(i === 0 ? -0.25 : 0.25);
    ctx.fillStyle = '#475569';
    ctx.fillRect(-6, -24, 12, 24);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    ctx.strokeRect(-6, -24, 12, 24);
    ctx.beginPath();
    ctx.arc(0, -26, 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });

  // Upper Steel Cranium Casing
  ctx.fillStyle = '#475569';
  ctx.beginPath();
  ctx.roundRect(-40, -82, 80, 56, [18, 18, 6, 6]);
  ctx.fill();
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Cranial center seam & forehead bolts
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -82);
  ctx.lineTo(0, -26);
  ctx.stroke();
  ctx.fillStyle = '#e2e8f0';
  [
    [-30, -72],
    [30, -72],
    [-32, -34],
    [32, -34],
  ].forEach(([bx, by]) => {
    ctx.beginPath();
    ctx.arc(bx, by, 2.5, 0, Math.PI * 2);
    ctx.fill();
  });

  // Deep Recessed Dark Eye Sockets
  [-17, 17].forEach((ex) => {
    ctx.fillStyle = '#020617';
    ctx.beginPath();
    ctx.arc(ex, -54, 13.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Glowing White/Cyan Optical Eyeballs Staring Straight Into the Lens
    ctx.save();
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 14;
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(ex, -54, 9.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Metallic iris ring
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ex, -54, 5.5, 0, Math.PI * 2);
    ctx.stroke();

    // Pinpoint black pupil locked onto the viewer
    ctx.fillStyle = '#020617';
    ctx.beginPath();
    ctx.arc(ex, -54, 2.8, 0, Math.PI * 2);
    ctx.fill();

    // Specular lens glint
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ex - 2.5, -56.5, 1.6, 0, Math.PI * 2);
    ctx.fill();
  });

  // Articulated Lower Endoskeleton Jaw & Double Row of Steel Teeth
  const jawDrop = 4 + Math.sin(time * 4) * 2;
  ctx.fillStyle = '#020617';
  ctx.fillRect(-28, -26, 56, 16 + jawDrop);

  // Upper teeth row
  ctx.fillStyle = '#f1f5f9';
  for (let tx = -22; tx <= 22; tx += 8.5) {
    ctx.fillRect(tx - 3, -26, 6, 7);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.strokeRect(tx - 3, -26, 6, 7);
  }

  // Lower jaw frame & lower teeth row
  ctx.save();
  ctx.translate(0, jawDrop);
  ctx.fillStyle = '#475569';
  ctx.beginPath();
  ctx.roundRect(-32, -10, 64, 18, [4, 4, 12, 12]);
  ctx.fill();
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.fillStyle = '#f1f5f9';
  for (let tx = -22; tx <= 22; tx += 8.5) {
    ctx.fillRect(tx - 3, -16, 6, 7);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.strokeRect(tx - 3, -16, 6, 7);
  }
  ctx.restore();

  ctx.restore(); // End head tilt
  ctx.restore(); // End Endo-03 transform
}

/**
 * Helper: Draws a perspective black-and-white FNAF checkered floor across a room
 */
function drawCheckeredFloor(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  floorY: number,
  rows: number = 5,
  cols: number = 16
) {
  const floorH = height - floorY;
  ctx.fillStyle = '#070b12';
  ctx.fillRect(-width * 0.1, floorY, width * 1.2, floorH);

  const totalW = width * 1.2;
  const startX = -width * 0.1;
  const tileW = totalW / cols;
  const rowH = floorH / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if ((r + c) % 2 === 0) {
        ctx.fillStyle = 'rgba(226, 232, 240, 0.075)';
        ctx.fillRect(startX + c * tileW, floorY + r * rowH, tileW, rowH);
      }
    }
  }

  // Baseboard shadow line
  ctx.fillStyle = '#020617';
  ctx.fillRect(startX, floorY - 4, totalW, 6);
}

/**
 * Helper: Draws the signature FNAF red-black-white checkered wainscot wall stripe
 */
function drawFnafWallStripe(
  ctx: CanvasRenderingContext2D,
  xStart: number,
  xEnd: number,
  y: number,
  stripeH: number = 14
) {
  ctx.fillStyle = '#7f1d1d';
  ctx.fillRect(xStart, y, xEnd - xStart, stripeH);
  const checkW = 14;
  for (let x = xStart; x < xEnd; x += checkW * 2) {
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(x, y + 3, checkW, stripeH - 6);
    ctx.fillStyle = '#090d16';
    ctx.fillRect(x + checkW, y + 3, checkW, stripeH - 6);
  }
}

/**
 * Helper: Draws hanging ceiling wire bundles for atmospheric FNAF clutter
 */
function drawHangingWires(
  ctx: CanvasRenderingContext2D,
  x: number,
  topY: number,
  length: number,
  sway: number = 0
) {
  ctx.save();
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 2.5;
  [-6, 0, 7].forEach((offset, idx) => {
    ctx.beginPath();
    ctx.moveTo(x + offset, topY);
    ctx.quadraticCurveTo(
      x + offset + (idx - 1) * 10 + sway,
      topY + length * 0.55,
      x + offset + (idx - 1) * 4 + sway * 1.4,
      topY + length * (0.75 + idx * 0.12)
    );
    ctx.stroke();
  });
  ctx.restore();
}

/**
 * Helper: Draws a framed institutional/FNAF wall poster
 */
function drawWallPoster(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  title: string,
  subtitle: string,
  accentColor: string = '#eab308'
) {
  ctx.save();
  ctx.fillStyle = '#0b0f19';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 2.5;
  ctx.strokeRect(x, y, w, h);

  // Header band
  ctx.fillStyle = accentColor;
  ctx.fillRect(x + 4, y + 4, w - 8, 14);
  ctx.fillStyle = '#020617';
  ctx.font = 'bold 9px Oswald, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, x + w / 2, y + 14);

  // Graphic emblem or rules lines inside poster
  ctx.fillStyle = '#cbd5e1';
  ctx.font = 'bold 8px Oswald, sans-serif';
  ctx.fillText(subtitle, x + w / 2, y + h - 8);

  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 1.5;
  for (let ly = y + 26; ly < y + h - 18; ly += 8) {
    ctx.beginPath();
    ctx.moveTo(x + 10, ly);
    ctx.lineTo(x + w - 10, ly);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Renders the live CCTV Camera feed for the active camera (`CAM_1A` .. `CAM_7`).
 */
export function drawCameraScene(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: NightSimulationState,
  time: number
) {
  ctx.save();
  ctx.clearRect(0, 0, width, height);

  const camId: CameraId = state.activeCam;

  // Special case: CAM_6 (Cocina Oficial — Audio Only, just like FNAF 1!)
  if (camId === 'CAM_6') {
    ctx.fillStyle = '#05070b';
    ctx.fillRect(0, 0, width, height);

    const someoneInKitchen =
      state.monteroLocation === 'CAM_6' || state.pedroLocation === 'CAM_6';

    // Live audio waveform bars
    const barCount = 32;
    const barW = (width * 0.5) / barCount;
    const startX = width * 0.25;
    const midY = height * 0.54;

    for (let i = 0; i < barCount; i++) {
      const amp = someoneInKitchen
        ? (Math.sin(time * 18 + i * 0.7) * 0.5 + 0.5) * 68 + 8
        : 4 + Math.sin(time * 4 + i) * 2;
      ctx.fillStyle = someoneInKitchen ? '#f59e0b' : '#334155';
      ctx.fillRect(startX + i * barW, midY - amp / 2, barW - 4, amp);
    }

    ctx.restore();
    return;
  }

  // Slow automatic horizontal security camera pan
  const panShift = Math.sin(time * 0.38) * (width * 0.04);
  ctx.save();
  ctx.translate(panShift, 0);

  // Night-vision desaturated room background
  const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
  bgGrad.addColorStop(0, '#070b12');
  bgGrad.addColorStop(0.6, '#111827');
  bgGrad.addColorStop(1, '#090d16');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(-width * 0.1, 0, width * 1.2, height);

  // Room-Specific Architectural Structures + Animatronics
  const unit = Math.min(width, height);

  if (camId === 'CAM_1A') {
    // TRIBUNA DE HONOR (Show Stage)
    // Velvet curtains on sides & golden Moncloa seal arch
    ctx.fillStyle = '#450a0a';
    ctx.fillRect(-width * 0.05, 0, width * 0.2, height * 0.8);
    ctx.fillRect(width * 0.85, 0, width * 0.2, height * 0.8);

    // Stage platform
    ctx.fillStyle = '#271712';
    ctx.fillRect(0, height * 0.72, width, height * 0.28);
    ctx.fillStyle = '#d97706';
    ctx.fillRect(0, height * 0.72, width, 6);

    // Overhead spotlights
    const spotGrad = ctx.createRadialGradient(
      width * 0.5,
      height * 0.15,
      20,
      width * 0.5,
      height * 0.5,
      width * 0.45
    );
    spotGrad.addColorStop(0, 'rgba(254, 240, 138, 0.16)');
    spotGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = spotGrad;
    ctx.fillRect(0, 0, width, height);

    if (state.rajoyLocation === 'CAM_1A') {
      drawAnimatronicCharacter(ctx, 'rajoy', width * 0.28, height * 0.56, unit * 0.0022, {
        pose: 'stage',
        time,
      });
    }
    if (state.monteroLocation === 'CAM_1A') {
      drawAnimatronicCharacter(ctx, 'montero', width * 0.72, height * 0.56, unit * 0.0022, {
        pose: 'stage',
        time,
      });
    }
    if (state.pedroLocation === 'CAM_1A') {
      drawAnimatronicCharacter(ctx, 'pedro', width * 0.5, height * 0.53, unit * 0.0025, {
        pose: 'stage',
        time,
      });
    }
  } else if (camId === 'CAM_1B') {
    // SALÓN DE COLUMNAS (Dining Area — FNAF 1 Banquet Hall + Moncloa Columns)
    const floorY = height * 0.64;
    drawCheckeredFloor(ctx, width, height, floorY, 6, 18);
    drawFnafWallStripe(ctx, -width * 0.08, width * 1.08, height * 0.48, 12);

    // Double wooden institutional doors on the back wall (center-left)
    ctx.fillStyle = '#1e1b18';
    ctx.fillRect(width * 0.31, height * 0.24, width * 0.1, floorY - height * 0.24);
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 3;
    ctx.strokeRect(width * 0.31, height * 0.24, width * 0.1, floorY - height * 0.24);
    ctx.beginPath();
    ctx.moveTo(width * 0.36, height * 0.24);
    ctx.lineTo(width * 0.36, floorY);
    ctx.stroke();

    // Framed posters on the back wall
    drawWallPoster(
      ctx,
      width * 0.61,
      height * 0.24,
      86,
      104,
      'HEMICICLO',
      'SESIÓN CONTINUA',
      '#ef4444'
    );
    drawWallPoster(
      ctx,
      width * 0.06,
      height * 0.25,
      78,
      96,
      'CELEBRATE!',
      'LA MONCLOA',
      '#eab308'
    );

    // Fluted Marble Columns with Bases & Capitals
    [0.18, 0.5, 0.82].forEach((px) => {
      const colX = width * px;
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(colX - 24, height * 0.06, 48, floorY - height * 0.06);
      // Column fluting lines
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      [-12, 0, 12].forEach((fl) => {
        ctx.beginPath();
        ctx.moveTo(colX + fl, height * 0.09);
        ctx.lineTo(colX + fl, floorY - 8);
        ctx.stroke();
      });
      // Capital & base molding
      ctx.fillStyle = '#475569';
      ctx.fillRect(colX - 30, height * 0.05, 60, 12);
      ctx.fillRect(colX - 30, floorY - 12, 60, 12);
    });

    // Overhead Festive Bunting Garlands (Triangle Pennants) & Hanging Lamps
    const pennantColors = ['#dc2626', '#eab308', '#2563eb', '#9333ea', '#16a34a'];
    for (let gx = width * 0.05; gx < width * 0.92; gx += 34) {
      const sag = Math.sin(((gx - width * 0.05) / (width * 0.87)) * Math.PI) * 22;
      const py = height * 0.1 + sag;
      ctx.fillStyle = pennantColors[Math.floor(gx / 34) % pennantColors.length];
      ctx.beginPath();
      ctx.moveTo(gx, py);
      ctx.lineTo(gx + 22, py);
      ctx.lineTo(gx + 11, py + 20);
      ctx.closePath();
      ctx.fill();
    }

    // Two Hanging Ceiling Lamps with Volumetric Cones
    [0.32, 0.68].forEach((lx) => {
      const lampX = width * lx;
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(lampX, 0);
      ctx.lineTo(lampX, height * 0.16);
      ctx.stroke();

      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.moveTo(lampX - 24, height * 0.18);
      ctx.lineTo(lampX + 24, height * 0.18);
      ctx.lineTo(lampX + 10, height * 0.14);
      ctx.lineTo(lampX - 10, height * 0.14);
      ctx.closePath();
      ctx.fill();

      const cone = ctx.createRadialGradient(
        lampX,
        height * 0.18,
        8,
        lampX,
        height * 0.55,
        width * 0.24
      );
      cone.addColorStop(0, 'rgba(254, 249, 195, 0.13)');
      cone.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = cone;
      ctx.fillRect(lampX - width * 0.25, height * 0.18, width * 0.5, height * 0.7);
    });

    // Animatronics standing behind or between the banquet tables
    if (state.pedroLocation === 'CAM_1B') {
      // Pedro hides deep in the dark shadow between columns with glowing eyes!
      drawAnimatronicCharacter(ctx, 'pedro', width * 0.5, height * 0.45, unit * 0.0018, {
        pose: 'dark_eyes',
        time,
      });
    }
    if (state.rajoyLocation === 'CAM_1B') {
      drawAnimatronicCharacter(ctx, 'rajoy', width * 0.34, height * 0.53, unit * 0.0021, {
        pose: 'stalk',
        time,
      });
    }
    if (state.monteroLocation === 'CAM_1B') {
      drawAnimatronicCharacter(ctx, 'montero', width * 0.66, height * 0.54, unit * 0.0021, {
        pose: 'stalk',
        time,
      });
    }

    // Long Banquet Tables with Chairs, Pleated Tablecloths & FNAF Party Hats
    [0.3, 0.68].forEach((tx) => {
      const tableCx = width * tx;
      const tableY = height * 0.66;
      const tableW = 220;

      // Chairs behind table
      [-75, -25, 25, 75].forEach((chOff) => {
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(tableCx + chOff - 14, tableY - 26, 28, 28);
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 2;
        ctx.strokeRect(tableCx + chOff - 14, tableY - 26, 28, 28);
      });

      // Table legs & shadow
      ctx.fillStyle = '#090d16';
      ctx.fillRect(tableCx - tableW / 2 + 16, tableY + 24, 14, 70);
      ctx.fillRect(tableCx + tableW / 2 - 30, tableY + 24, 14, 70);

      // White tablecloth with red FNAF festive trim
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(tableCx - tableW / 2, tableY, tableW, 28);
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(tableCx - tableW / 2, tableY + 20, tableW, 5);

      // Party Hats & Confetti Cups on each table!
      [-65, 0, 65].forEach((hx, hIdx) => {
        const hatX = tableCx + hx;
        ctx.fillStyle = hIdx === 1 ? '#eab308' : hIdx === 0 ? '#2563eb' : '#16a34a';
        ctx.beginPath();
        ctx.moveTo(hatX - 11, tableY);
        ctx.lineTo(hatX + 11, tableY);
        ctx.lineTo(hatX, tableY - 24);
        ctx.closePath();
        ctx.fill();
        // Pom-pom on top of party hat
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.arc(hatX, tableY - 25, 3.5, 0, Math.PI * 2);
        ctx.fill();
      });
    });
  } else if (camId === 'CAM_1C') {
    // CALA DEL CORSARIO (Pirate Cove — Abascal-Foxy's 4 Stages!)
    const stage = state.abascalStage;

    // Checkered stage floor at bottom of CAM 1C
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, height * 0.76, width, height * 0.24);
    for (let cx = 0; cx < width; cx += 48) {
      ctx.fillStyle = (cx / 48) % 2 === 0 ? 'rgba(248,250,252,0.08)' : 'rgba(9,13,22,0.4)';
      ctx.fillRect(cx, height * 0.76, 24, height * 0.24);
    }

    // Dark interior behind curtain
    ctx.fillStyle = '#020409';
    ctx.fillRect(width * 0.22, height * 0.1, width * 0.56, height * 0.66);

    // Draw Abascal depending on Stage 1 or Stage 2
    if (stage === 1) {
      // Peeking through the curtains with glowing golden eye
      drawAnimatronicCharacter(ctx, 'abascal', width * 0.5, height * 0.52, unit * 0.0022, {
        pose: 'stalk',
        time,
      });
    }

    // Starry Pleated Curtains (parted based on stage)
    const curtainGap = stage === 0 ? 6 : stage === 1 ? width * 0.12 : width * 0.36;
    const leftCurtainW = Math.max(40, width * 0.32 - curtainGap / 2);
    const rightCurtainX = width * 0.5 + curtainGap / 2;

    const drawPleatedCurtain = (xStart: number, wCurtain: number) => {
      ctx.fillStyle = '#14532d';
      ctx.fillRect(xStart, height * 0.1, wCurtain, height * 0.66);
      // Pleat shadows
      const folds = 6;
      const foldW = wCurtain / folds;
      for (let f = 0; f < folds; f++) {
        ctx.fillStyle = f % 2 === 0 ? 'rgba(0,0,0,0.28)' : 'rgba(255,255,255,0.05)';
        ctx.fillRect(xStart + f * foldW, height * 0.1, foldW * 0.5, height * 0.66);
      }
      // Golden stars pattern on Pirate Cove curtains
      ctx.fillStyle = '#eab308';
      for (let sy = height * 0.22; sy < height * 0.68; sy += 90) {
        for (let sx = xStart + 28; sx < xStart + wCurtain - 20; sx += 75) {
          ctx.beginPath();
          ctx.arc(sx, sy, 6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // Gold bottom fringe
      ctx.fillStyle = '#ca8a04';
      ctx.fillRect(xStart, height * 0.75, wCurtain, 6);
    };

    drawPleatedCurtain(width * 0.18, leftCurtainW);
    drawPleatedCurtain(rightCurtainX, leftCurtainW);

    if (stage === 2) {
      // Standing menacingly IN FRONT of the curtains!
      drawAnimatronicCharacter(ctx, 'abascal', width * 0.48, height * 0.58, unit * 0.0028, {
        pose: 'closeup',
        time,
      });
    }

    // "FUERA DE SERVICIO / ¡SE HA IDO!" Sign on wooden stand (Left side, clear of Mini-Map!)
    const signX = width * 0.14;
    const signY = height * 0.55;
    // Wooden stand legs
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(signX + 35, signY + 70);
    ctx.lineTo(signX + 15, height * 0.84);
    ctx.moveTo(signX + 135, signY + 70);
    ctx.lineTo(signX + 155, height * 0.84);
    ctx.stroke();

    ctx.fillStyle = stage === 3 ? '#fef2f2' : '#e2e8f0';
    ctx.fillRect(signX, signY, 170, 76);
    ctx.strokeStyle = stage === 3 ? '#dc2626' : '#334155';
    ctx.lineWidth = 4;
    ctx.strokeRect(signX, signY, 170, 76);

    ctx.fillStyle = stage === 3 ? '#dc2626' : '#0f172a';
    ctx.font = 'bold 16px Oswald, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      stage === 3 ? '¡SE HA IDO!' : 'FUERA DE',
      signX + 85,
      signY + 32
    );
    ctx.fillText(
      stage === 3 ? '¡CIERRA PUERTA IZQ!' : 'SERVICIO',
      signX + 85,
      signY + 56
    );
  } else if (camId === 'CAM_2A') {
    // PASILLO OESTE A (West Hall — Abascal-Foxy's Sprint Corridor!)
    const farLeft = width * 0.34;
    const farRight = width * 0.66;
    const farTop = height * 0.26;
    const farBot = height * 0.7;

    // Perspective Checkered Corridor Floor (trapezoid from farBot to height)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(farLeft, farBot);
    ctx.lineTo(farRight, farBot);
    ctx.lineTo(width * 1.05, height);
    ctx.lineTo(-width * 0.05, height);
    ctx.closePath();
    ctx.clip();
    drawCheckeredFloor(ctx, width, height, farBot, 6, 14);
    ctx.restore();

    // Dark far end of hallway
    ctx.fillStyle = '#03060c';
    ctx.fillRect(farLeft, farTop, farRight - farLeft, farBot - farTop);

    // Perspective Hallway Walls & Ceiling
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(farLeft, farTop);
    ctx.moveTo(width, 0);
    ctx.lineTo(farRight, farTop);
    ctx.moveTo(0, height);
    ctx.lineTo(farLeft, farBot);
    ctx.moveTo(width, height);
    ctx.lineTo(farRight, farBot);
    ctx.stroke();

    // Converging Red & Black FNAF Wainscot Stripes along Left & Right Walls
    ctx.strokeStyle = '#991b1b';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(0, height * 0.64);
    ctx.lineTo(farLeft, height * 0.54);
    ctx.moveTo(width, height * 0.64);
    ctx.lineTo(farRight, height * 0.54);
    ctx.stroke();

    // Recessed Side Doorways along Left Wall (Archivo CAM 3 entrance & Despacho Auxiliar)
    [
      { x1: width * 0.08, x2: width * 0.16, yTop: height * 0.24, yBot: height * 0.88 },
      { x1: width * 0.22, x2: width * 0.28, yTop: height * 0.28, yBot: height * 0.78 },
    ].forEach((d) => {
      ctx.fillStyle = '#090d16';
      ctx.beginPath();
      ctx.moveTo(d.x1, d.yTop);
      ctx.lineTo(d.x2, d.yTop + 14);
      ctx.lineTo(d.x2, d.yBot - 24);
      ctx.lineTo(d.x1, d.yBot);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      // Brass doorknob
      ctx.fillStyle = '#eab308';
      ctx.beginPath();
      ctx.arc(d.x2 - 8, (d.yTop + d.yBot) * 0.52, 3.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // Framed Posters on Right Corridor Wall
    drawWallPoster(
      ctx,
      width * 0.73,
      height * 0.27,
      78,
      96,
      'ALA OESTE',
      'VIGILANCIA',
      '#3b82f6'
    );
    drawWallPoster(
      ctx,
      width * 0.84,
      height * 0.23,
      90,
      110,
      'B.O.E.',
      'SILENCIO',
      '#dc2626'
    );

    // Overhead Caged Corridor Lamps & Hanging Wires
    drawHangingWires(ctx, width * 0.28, height * 0.06, 75, Math.sin(time * 2) * 3);
    drawHangingWires(ctx, width * 0.72, height * 0.04, 85, -Math.sin(time * 2.2) * 3);

    [0.14, 0.24].forEach((ly, idx) => {
      const lampY = height * ly;
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(width * 0.5, lampY, idx === 0 ? 9 : 6, 0, Math.PI * 2);
      ctx.fill();
      const pool = ctx.createRadialGradient(
        width * 0.5,
        lampY,
        4,
        width * 0.5,
        lampY + 90,
        width * 0.25
      );
      pool.addColorStop(0, 'rgba(254, 240, 138, 0.12)');
      pool.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = pool;
      ctx.fillRect(width * 0.25, lampY, width * 0.5, height * 0.6);
    });

    if (state.abascalSprinting) {
      // Animated sprinting Abascal-Foxy charging toward the camera!
      const p = state.abascalSprintProgress;
      const sprintScale = unit * (0.0012 + p * 0.0028);
      const sprintY = height * (0.45 + p * 0.25) + Math.abs(Math.sin(time * 28)) * 18;
      drawAnimatronicCharacter(ctx, 'abascal', width * 0.5, sprintY, sprintScale, {
        pose: 'sprint',
        time,
      });
    } else if (state.rajoyLocation === 'CAM_2A') {
      drawAnimatronicCharacter(ctx, 'rajoy', width * 0.5, height * 0.55, unit * 0.0022, {
        pose: 'stalk',
        time,
      });
    }
  } else if (camId === 'CAM_2B') {
    // ESQUINA OESTE B (West Hall Corner — Right outside the Left Security Door!)
    const floorY = height * 0.72;
    drawCheckeredFloor(ctx, width, height, floorY, 5, 16);
    drawFnafWallStripe(ctx, -width * 0.08, width * 1.08, height * 0.54, 14);

    // Corner junction vertical wall seam
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(width * 0.2, 0);
    ctx.lineTo(width * 0.2, floorY);
    ctx.stroke();

    // Industrial Electrical Breaker Box on Left Wall
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(width * 0.06, height * 0.26, 84, 110);
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(width * 0.06, height * 0.26, 84, 110);
    // High-voltage yellow hazard triangle
    ctx.fillStyle = '#eab308';
    ctx.beginPath();
    ctx.moveTo(width * 0.06 + 42, height * 0.26 + 26);
    ctx.lineTo(width * 0.06 + 60, height * 0.26 + 56);
    ctx.lineTo(width * 0.06 + 24, height * 0.26 + 56);
    ctx.closePath();
    ctx.fill();

    // Iconic Large Framed West Corner Poster ("CELEBRATE / MONCLOA" — Mutates to Echenique-Golden Freddy 1/1000!)
    if (state.goldenFreddyPosterActive) {
      const px = width * 0.27;
      const py = height * 0.14;
      const pw = width * 0.2;
      const ph = height * 0.34;
      ctx.save();
      ctx.fillStyle = '#090d16';
      ctx.fillRect(px, py, pw, ph);
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 3;
      ctx.strokeRect(px, py, pw, ph);

      ctx.beginPath();
      ctx.rect(px + 2, py + 2, pw - 4, ph - 4);
      ctx.clip();
      drawAnimatronicCharacter(
        ctx,
        'echenique',
        px + pw * 0.5,
        py + ph * 0.72,
        ph * 0.0042,
        { pose: 'closeup', time }
      );
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 12px Oswald, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('¡SOY YO! · IT\'S ME', px + pw * 0.5, py + ph - 8);
      ctx.restore();
    } else {
      drawWallPoster(
        ctx,
        width * 0.27,
        height * 0.14,
        width * 0.2,
        height * 0.34,
        '¡VIGILANCIA ACTIVA!',
        'COMPLEJO DE LA MONCLOA',
        '#eab308'
      );
    }

    // Pinned B.O.E. Notice Board next to the poster
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(width * 0.52, height * 0.2, width * 0.14, height * 0.22);
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.strokeRect(width * 0.52, height * 0.2, width * 0.14, height * 0.22);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(width * 0.535, height * 0.23, width * 0.05, height * 0.08);
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(width * 0.6, height * 0.24, width * 0.045, height * 0.07);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(width * 0.54, height * 0.33, width * 0.09, height * 0.06);

    // Hang wires from ceiling & ribbed metal trash bin with crumpled paper balls on floor
    drawHangingWires(ctx, width * 0.38, 0, 95, Math.sin(time * 1.7) * 4);
    drawHangingWires(ctx, width * 0.68, 0, 110, -Math.sin(time * 2.1) * 4);

    // Metal trash can in left corner
    const binX = width * 0.22;
    const binY = floorY - 68;
    ctx.fillStyle = '#334155';
    ctx.fillRect(binX, binY, 54, 72);
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    ctx.strokeRect(binX, binY, 54, 72);
    for (let ry = binY + 14; ry < binY + 64; ry += 14) {
      ctx.beginPath();
      ctx.moveTo(binX + 4, ry);
      ctx.lineTo(binX + 50, ry);
      ctx.stroke();
    }
    // Crumpled B.O.E. paper balls on floor near bin
    ctx.fillStyle = '#cbd5e1';
    [
      [binX - 18, floorY + 12],
      [binX + 68, floorY + 18],
      [binX + 52, floorY + 30],
    ].forEach(([px, py]) => {
      ctx.beginPath();
      ctx.arc(px, py, 7, 0, Math.PI * 2);
      ctx.fill();
    });

    if (state.rajoyLocation === 'CAM_2B') {
      drawAnimatronicCharacter(ctx, 'rajoy', width * 0.54, height * 0.62, unit * 0.0031, {
        pose: 'closeup',
        time,
      });
    }
  } else if (camId === 'CAM_3') {
    // ARCHIVO DEL B.O.E. (Supply Closet — With 1/1000 Endo-03 Easter Egg!)
    const floorY = height * 0.74;
    drawCheckeredFloor(ctx, width, height, floorY, 5, 14);
    drawFnafWallStripe(ctx, -width * 0.08, width * 1.08, height * 0.58, 12);

    // Left & Right Heavy Metal Archive Shelving Racks packed with B.O.E. Binders & Boxes
    const drawClosetShelfRack = (rackX: number, rackW: number) => {
      // Vertical steel posts
      ctx.fillStyle = '#334155';
      ctx.fillRect(rackX, height * 0.14, 10, floorY - height * 0.14);
      ctx.fillRect(rackX + rackW - 10, height * 0.14, 10, floorY - height * 0.14);

      const binderColors = ['#991b1b', '#1e3a8a', '#b45309', '#065f46', '#4c1d95'];
      [0.24, 0.44, 0.64].forEach((sy, sIdx) => {
        const shelfY = height * sy;
        // B.O.E. Binders & Archive Boxes sitting on shelf
        for (let bx = rackX + 14; bx < rackX + rackW - 28; bx += 22) {
          if ((bx + sIdx) % 3 === 0) {
            // Cardboard archive box
            ctx.fillStyle = '#78350f';
            ctx.fillRect(bx, shelfY - 34, 36, 34);
            ctx.strokeStyle = '#d97706';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(bx, shelfY - 34, 36, 34);
            ctx.fillStyle = '#fef3c7';
            ctx.fillRect(bx + 6, shelfY - 22, 24, 10);
            bx += 18;
          } else {
            // Tall B.O.E. Binder
            ctx.fillStyle = binderColors[(Math.floor(bx) + sIdx) % binderColors.length];
            ctx.fillRect(bx, shelfY - 42, 16, 42);
            ctx.fillStyle = '#e2e8f0';
            ctx.fillRect(bx + 3, shelfY - 34, 10, 8);
          }
        }
        // Steel shelf plank
        ctx.fillStyle = '#475569';
        ctx.fillRect(rackX, shelfY, rackW, 10);
      });
    };

    drawClosetShelfRack(width * 0.05, width * 0.25);
    drawClosetShelfRack(width * 0.68, width * 0.24);

    // Cleaning Props: Mop Bucket, Wooden Mop & Broom leaning against shelves
    const bucketX = width * 0.32;
    const bucketY = floorY - 36;
    ctx.fillStyle = '#ca8a04';
    ctx.fillRect(bucketX, bucketY, 46, 38);
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 2;
    ctx.strokeRect(bucketX, bucketY, 46, 38);
    // Mop handle leaning out of bucket
    ctx.strokeStyle = '#a16207';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(bucketX + 22, bucketY + 6);
    ctx.lineTo(bucketX - 18, height * 0.34);
    ctx.stroke();

    // Swinging Overhead Caged Bulb casting a swaying light cone!
    const bulbSway = Math.sin(time * 2.1) * 28;
    const bulbX = width * 0.5 + bulbSway;
    const bulbY = height * 0.18;

    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(width * 0.5, 0);
    ctx.lineTo(bulbX, bulbY);
    ctx.stroke();

    const coneGrad = ctx.createRadialGradient(
      bulbX,
      bulbY,
      6,
      bulbX,
      height * 0.56,
      width * 0.34
    );
    coneGrad.addColorStop(0, 'rgba(254, 240, 138, 0.22)');
    coneGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = coneGrad;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(bulbX, bulbY + 6, 9, 0, Math.PI * 2);
    ctx.fill();

    // Render either Rajoy-Bonnie OR the 1/1000 Endo-03 Easter Egg (when Rajoy is not here!)
    if (state.rajoyLocation === 'CAM_3') {
      drawAnimatronicCharacter(ctx, 'rajoy', width * 0.5, height * 0.64, unit * 0.0032, {
        pose: 'closeup',
        time,
      });
    } else if (state.endo03Active) {
      drawEndo03Character(ctx, width * 0.5, height * 0.64, unit * 0.0033, time);
    }
  } else if (camId === 'CAM_4A') {
    // PASILLO ESTE A (East Hall — Pedro-Freddy & Montero-Chica's Corridor!)
    const farLeft = width * 0.34;
    const farRight = width * 0.66;
    const farTop = height * 0.26;
    const farBot = height * 0.7;

    // Perspective Checkered Floor
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(farLeft, farBot);
    ctx.lineTo(farRight, farBot);
    ctx.lineTo(width * 1.05, height);
    ctx.lineTo(-width * 0.05, height);
    ctx.closePath();
    ctx.clip();
    drawCheckeredFloor(ctx, width, height, farBot, 6, 14);
    ctx.restore();

    // Dark far end of East Hallway
    ctx.fillStyle = '#03060c';
    ctx.fillRect(farLeft, farTop, farRight - farLeft, farBot - farTop);

    // Perspective Corridor Lines
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(farLeft, farTop);
    ctx.moveTo(width, 0);
    ctx.lineTo(farRight, farTop);
    ctx.moveTo(0, height);
    ctx.lineTo(farLeft, farBot);
    ctx.moveTo(width, height);
    ctx.lineTo(farRight, farBot);
    ctx.stroke();

    // Converging Red & Black FNAF Wainscot Stripes
    ctx.strokeStyle = '#991b1b';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(0, height * 0.64);
    ctx.lineTo(farLeft, height * 0.54);
    ctx.moveTo(width, height * 0.64);
    ctx.lineTo(farRight, height * 0.54);
    ctx.stroke();

    // Framed Posters along Left & Right East Hall Walls (just like FNAF 1's 3 East Hall posters!)
    drawWallPoster(
      ctx,
      width * 0.08,
      height * 0.22,
      88,
      108,
      'PRESIDENTE',
      'LA MONCLOA',
      '#dc2626'
    );
    drawWallPoster(
      ctx,
      width * 0.2,
      height * 0.28,
      74,
      90,
      ' CONSEJO ',
      'MINISTERIAL',
      '#eab308'
    );
    drawWallPoster(
      ctx,
      width * 0.74,
      height * 0.25,
      84,
      102,
      'PROTOCOLO',
      'NO CORRER',
      '#a855f7'
    );

    // Exposed Ceiling Steam Pipes & Hanging Wires
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(width * 0.18, 0);
    ctx.lineTo(width * 0.4, farTop);
    ctx.stroke();
    drawHangingWires(ctx, width * 0.64, height * 0.05, 80, Math.sin(time * 1.9) * 3);

    // Overhead corridor lamp glow
    const eastPool = ctx.createRadialGradient(
      width * 0.5,
      height * 0.16,
      6,
      width * 0.5,
      height * 0.5,
      width * 0.28
    );
    eastPool.addColorStop(0, 'rgba(254, 240, 138, 0.11)');
    eastPool.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = eastPool;
    ctx.fillRect(width * 0.2, height * 0.1, width * 0.6, height * 0.7);

    if (state.monteroLocation === 'CAM_4A') {
      drawAnimatronicCharacter(ctx, 'montero', width * 0.48, height * 0.56, unit * 0.0023, {
        pose: 'stalk',
        time,
      });
    }
    if (state.pedroLocation === 'CAM_4A') {
      drawAnimatronicCharacter(ctx, 'pedro', width * 0.52, height * 0.52, unit * 0.0022, {
        pose: 'stalk',
        time,
      });
    }
  } else if (camId === 'CAM_4B') {
    // ESQUINA ESTE B (East Hall Corner — Critical Chokepoint with FNAF 1 "RULES" Board!)
    const floorY = height * 0.72;
    drawCheckeredFloor(ctx, width, height, floorY, 5, 16);
    drawFnafWallStripe(ctx, -width * 0.08, width * 1.08, height * 0.54, 14);

    // Corner junction wall line
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(width * 0.78, 0);
    ctx.lineTo(width * 0.78, floorY);
    ctx.stroke();

    // Iconic East Hall Corner "REGLAMENTO DE SEGURIDAD (RULES FOR SAFETY)" Framed Board
    const rulesX = width * 0.48;
    const rulesY = height * 0.12;
    const rulesW = width * 0.24;
    const rulesH = height * 0.36;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(rulesX, rulesY, rulesW, rulesH);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 3;
    ctx.strokeRect(rulesX, rulesY, rulesW, rulesH);

    ctx.fillStyle = '#eab308';
    ctx.font = 'bold 13px Oswald, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('REGLAMENTO DE MONCLOA', rulesX + rulesW / 2, rulesY + 22);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.textAlign = 'left';
    const rulesList = [
      '1. NO CORRER EN PASILLOS',
      '2. NO GRITAR AL MICRO',
      '3. NO TOCAR A PEDRO',
      '4. AHORRAR BATERÍA',
      '5. VIGILAR LA CALA 1C',
      '6. SALIR ANTES DE 6 AM',
    ];
    rulesList.forEach((line, idx) => {
      ctx.fillText(line, rulesX + 14, rulesY + 44 + idx * 18);
    });

    // Wall-mounted Red Fire Extinguisher on Left
    const extX = width * 0.16;
    const extY = height * 0.36;
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.roundRect(extX, extY, 26, 64, 8);
    ctx.fill();
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(extX + 4, extY + 18, 18, 20);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(extX + 8, extY - 10, 10, 10);

    // Tall Steel "ARCHIVO CLASIFICADO" Filing Cabinet on Right Corner
    const cabX = width * 0.8;
    const cabY = floorY - 160;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(cabX, cabY, 92, 160);
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(cabX, cabY, 92, 160);
    for (let d = 0; d < 3; d++) {
      const dy = cabY + 10 + d * 50;
      ctx.strokeRect(cabX + 8, dy, 76, 42);
      ctx.fillStyle = '#eab308';
      ctx.fillRect(cabX + 34, dy + 12, 24, 8);
    }

    drawHangingWires(ctx, width * 0.32, 0, 90, Math.sin(time * 2) * 3);

    if (state.pedroLocation === 'CAM_4B') {
      drawAnimatronicCharacter(ctx, 'pedro', width * 0.42, height * 0.64, unit * 0.0033, {
        pose: 'closeup',
        time,
      });
    } else if (state.monteroLocation === 'CAM_4B') {
      drawAnimatronicCharacter(ctx, 'montero', width * 0.46, height * 0.64, unit * 0.0032, {
        pose: 'closeup',
        time,
      });
    }
  } else if (camId === 'CAM_5') {
    // SALA DE PRENSA Y TALLER (Backstage — Spare Animatronic Heads & Seated Endoskeleton!)
    const floorY = height * 0.74;
    drawCheckeredFloor(ctx, width, height, floorY, 5, 16);
    drawFnafWallStripe(ctx, -width * 0.08, width * 1.08, height * 0.56, 12);

    // Heavy Reinforced Backstage Security Door on the left-back wall
    const bDoorX = width * 0.06;
    const bDoorY = height * 0.2;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(bDoorX, bDoorY, width * 0.14, floorY - bDoorY);
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 4;
    ctx.strokeRect(bDoorX, bDoorY, width * 0.14, floorY - bDoorY);
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(bDoorX + 14, bDoorY + 24, width * 0.14 - 28, 22);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px Oswald, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TALLER TÉCNICO', bDoorX + width * 0.07, bDoorY + 39);

    // Two-Tier Heavy Industrial Shelving on Back Wall holding Spare Animatronic Heads & Parts!
    const shelfX = width * 0.24;
    const shelfW = width * 0.64;
    [height * 0.34, height * 0.52].forEach((sy) => {
      ctx.fillStyle = '#334155';
      ctx.fillRect(shelfX, sy, shelfW, 12);
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 2;
      ctx.strokeRect(shelfX, sy, shelfW, 12);
    });
    // Vertical shelf uprights
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(shelfX, height * 0.14, 10, floorY - height * 0.14);
    ctx.fillRect(shelfX + shelfW - 10, height * 0.14, 10, floorY - height * 0.14);

    // Detailed Spare Animatronic Heads on the Shelves (Freddy, Bonnie, Chica empty shells with hollow dark eyes!)
    const drawSpareHeadMask = (
      hx: number,
      hy: number,
      shellColor: string,
      earType: 'bear' | 'bunny' | 'chick'
    ) => {
      ctx.save();
      ctx.translate(hx, hy);
      if (earType === 'bear') {
        ctx.fillStyle = shellColor;
        ctx.beginPath();
        ctx.arc(-20, -24, 8, 0, Math.PI * 2);
        ctx.arc(20, -24, 8, 0, Math.PI * 2);
        ctx.fill();
      } else if (earType === 'bunny') {
        ctx.fillStyle = shellColor;
        ctx.fillRect(-16, -42, 9, 22);
        ctx.fillRect(7, -42, 9, 22);
      }
      ctx.fillStyle = shellColor;
      ctx.beginPath();
      ctx.roundRect(-22, -22, 44, 38, 10);
      ctx.fill();
      ctx.strokeStyle = '#090d16';
      ctx.lineWidth = 2;
      ctx.stroke();
      // Hollow pitch-black eye sockets (creepy FNAF 1 Backstage look!)
      ctx.fillStyle = '#020617';
      ctx.beginPath();
      ctx.arc(-9, -6, 6, 0, Math.PI * 2);
      ctx.arc(9, -6, 6, 0, Math.PI * 2);
      ctx.fill();
      // Faint pinprick reflection when Rajoy is in CAM 5
      if (state.rajoyLocation === 'CAM_5') {
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.arc(-9, -6, 1.5, 0, Math.PI * 2);
        ctx.arc(9, -6, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    };

    // Top shelf spare heads
    drawSpareHeadMask(width * 0.34, height * 0.34 - 16, '#78350f', 'bear');
    drawSpareHeadMask(width * 0.48, height * 0.34 - 16, '#1d4ed8', 'bunny');
    drawSpareHeadMask(width * 0.62, height * 0.34 - 16, '#ca8a04', 'chick');
    drawSpareHeadMask(width * 0.76, height * 0.34 - 16, '#92400e', 'bear');

    // Middle shelf spare parts & endoskeleton limbs
    drawSpareHeadMask(width * 0.38, height * 0.52 - 16, '#1e3a8a', 'bunny');
    ctx.fillStyle = '#64748b';
    ctx.fillRect(width * 0.52, height * 0.52 - 14, 68, 12);
    ctx.fillRect(width * 0.68, height * 0.52 - 26, 44, 24);

    // Central Workshop Table with a Slumped Inactive Endoskeleton Chassis on top!
    const benchX = width * 0.28;
    const benchY = height * 0.68;
    const benchW = width * 0.44;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(benchX, benchY, benchW, 18);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(benchX + 18, benchY + 18, 16, 80);
    ctx.fillRect(benchX + benchW - 34, benchY + 18, 16, 80);

    // Inactive Endoskeleton sitting on the worktable (when Rajoy isn't blocking the close-up)
    if (state.rajoyLocation !== 'CAM_5') {
      drawEndo03Character(ctx, width * 0.5, height * 0.6, unit * 0.0019, time * 0.2);
    } else {
      drawAnimatronicCharacter(ctx, 'rajoy', width * 0.52, height * 0.65, unit * 0.0034, {
        pose: 'closeup',
        time,
      });
    }

    drawHangingWires(ctx, width * 0.45, 0, 85, Math.sin(time * 1.5) * 3);
    drawHangingWires(ctx, width * 0.78, 0, 95, -Math.sin(time * 1.8) * 3);
  } else if (camId === 'CAM_7') {
    // ASEOS MINISTERIALES (Restrooms — Tiled Corridor, Vanity Mirror, Sinks & Neon Signs!)
    const floorY = height * 0.72;
    drawCheckeredFloor(ctx, width, height, floorY, 5, 18);

    // Ceramic Tile Wainscot on Lower Half of Restroom Corridor Walls
    const tileTopY = height * 0.44;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-width * 0.05, tileTopY, width * 1.1, floorY - tileTopY);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
    ctx.lineWidth = 1;
    for (let tx = 0; tx < width; tx += 28) {
      ctx.beginPath();
      ctx.moveTo(tx, tileTopY);
      ctx.lineTo(tx, floorY);
      ctx.stroke();
    }
    for (let ty = tileTopY; ty < floorY; ty += 22) {
      ctx.beginPath();
      ctx.moveTo(0, ty);
      ctx.lineTo(width, ty);
      ctx.stroke();
    }
    drawFnafWallStripe(ctx, -width * 0.08, width * 1.08, tileTopY - 12, 12);

    // Left ("CABALLEROS") & Right ("SEÑORAS") Restroom Entrance Alcoves
    [
      { x: width * 0.14, label: 'CABALLEROS', color: '#38bdf8' },
      { x: width * 0.64, label: 'SEÑORAS', color: '#f472b6' },
    ].forEach((alc) => {
      const alcW = width * 0.22;
      const alcY = height * 0.18;
      const alcH = floorY - alcY;

      // Dark doorway alcove
      ctx.fillStyle = '#03060c';
      ctx.fillRect(alc.x, alcY, alcW, alcH);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 4;
      ctx.strokeRect(alc.x, alcY, alcW, alcH);

      // Illuminated Header Sign above doorway
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(alc.x + alcW * 0.15, alcY - 28, alcW * 0.7, 22);
      ctx.strokeStyle = alc.color;
      ctx.lineWidth = 2;
      ctx.strokeRect(alc.x + alcW * 0.15, alcY - 28, alcW * 0.7, 22);
      ctx.fillStyle = alc.color;
      ctx.font = 'bold 11px Oswald, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(alc.label, alc.x + alcW * 0.5, alcY - 13);
    });

    // Central Restroom Vanity Wall: Framed Mirror, Dual Porcelain Sinks & Soap Dispenser
    const vanityX = width * 0.4;
    const vanityW = width * 0.2;
    // Framed Mirror
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(vanityX, height * 0.22, vanityW, height * 0.18);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 3;
    ctx.strokeRect(vanityX, height * 0.22, vanityW, height * 0.18);
    // Diagonal mirror reflection streaks
    ctx.strokeStyle = 'rgba(248, 250, 252, 0.18)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(vanityX + 16, height * 0.38);
    ctx.lineTo(vanityX + 54, height * 0.24);
    ctx.moveTo(vanityX + 42, height * 0.38);
    ctx.lineTo(vanityX + 74, height * 0.24);
    ctx.stroke();

    // Dual Sinks Counter
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(vanityX - 10, height * 0.5, vanityW + 20, 18);
    ctx.fillStyle = '#64748b';
    ctx.fillRect(vanityX + 20, height * 0.5 + 18, 12, floorY - (height * 0.5 + 18));
    ctx.fillRect(
      vanityX + vanityW - 32,
      height * 0.5 + 18,
      12,
      floorY - (height * 0.5 + 18)
    );

    if (state.monteroLocation === 'CAM_7') {
      drawAnimatronicCharacter(ctx, 'montero', width * 0.5, height * 0.56, unit * 0.0024, {
        pose: 'stalk',
        time,
      });
    }
    if (state.pedroLocation === 'CAM_7') {
      drawAnimatronicCharacter(ctx, 'pedro', width * 0.75, height * 0.5, unit * 0.002, {
        pose: 'dark_eyes',
        time,
      });
    }
  }

  ctx.restore(); // End panShift

  // VHS Static & Interference Overlay
  const staticIntensity = state.cameraStaticTimer > 0 ? 0.55 : 0.08;
  ctx.fillStyle = `rgba(226, 232, 240, ${staticIntensity * 0.25})`;
  for (let i = 0; i < (state.cameraStaticTimer > 0 ? 36 : 8); i++) {
    const sy = ((time * 240 + i * 73) % height);
    ctx.fillRect(0, sy, width, state.cameraStaticTimer > 0 ? 6 : 2);
  }

  ctx.restore();
}

/**
 * Renders the full-screen animated Jumpscare sequence when an animatronic attacks!
 */
export function drawJumpscareScene(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  attacker: AnimatronicId,
  jumpscareTimer: number,
  time: number
) {
  ctx.save();
  const unit = Math.min(width, height);

  if (attacker === 'echenique') {
    // Iconic FNAF 1 Golden Freddy Giant Head Full-Screen Jumpscare!
    const flash = Math.sin(time * 80) > 0;
    ctx.fillStyle = flash ? '#1c1502' : '#020305';
    ctx.fillRect(0, 0, width, height);

    const shakeX = Math.sin(time * 125) * 14;
    const shakeY = Math.cos(time * 110) * 12;

    drawAnimatronicCharacter(
      ctx,
      'echenique',
      width / 2 + shakeX,
      height * 0.72 + shakeY,
      unit * 0.0068,
      {
        pose: 'closeup',
        time,
        jawOpen: 0.75 + 0.15 * Math.sin(time * 60),
        eyeGlow: 1.8,
      }
    );

    if (Math.sin(time * 55) > 0.3) {
      ctx.fillStyle = 'rgba(254, 240, 138, 0.85)';
      ctx.font = `bold ${Math.round(height * 0.08)}px Oswald, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('¡SOY YO! · IT\'S ME', width / 2, height * 0.14);
    }

    ctx.restore();
    return;
  }

  // Violent strobe background for standard animatronics
  const flash = Math.sin(time * 65) > 0;
  ctx.fillStyle = flash ? '#1f0707' : '#030508';
  ctx.fillRect(0, 0, width, height);

  const progress = Math.min(1, Math.max(0, 1 - jumpscareTimer / 0.9));
  const scale = unit * (0.0028 + progress * 0.0024);

  const shakeX = Math.sin(time * 90) * 18;
  const shakeY = Math.cos(time * 82) * 14;

  drawAnimatronicCharacter(
    ctx,
    attacker,
    width / 2 + shakeX,
    height * 0.62 + shakeY,
    scale,
    {
      pose: 'jumpscare',
      time,
      jawOpen: 0.4 + 0.6 * Math.abs(Math.sin(time * 35)),
      eyeGlow: 1.5,
    }
  );

  ctx.restore();
}
