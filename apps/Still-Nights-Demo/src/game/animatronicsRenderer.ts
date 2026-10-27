import { AnimatronicId } from './rules';

/**
 * Draws the 4 bespoke animatronics onto a CanvasRenderingContext2D with intricate anatomical fidelity.
 * Supports independent, controlled FNAF-style per-animatronic glitch twitches (`glitchAmount` 0..1) for the Main Menu!
 */
export function drawAnimatronic(
  ctx: CanvasRenderingContext2D,
  id: AnimatronicId,
  cx: number,
  cy: number,
  scale: number,
  timeSec: number,
  isJumpscare = false,
  glitchAmount = 0,
  jumpscareElapsedSec = 0
) {
  ctx.save();
  ctx.translate(cx, cy);

  const isGlitching = glitchAmount > 0.01;
  const jitterX = isJumpscare
    ? Math.sin(timeSec * 65) * 9
    : isGlitching
    ? Math.sin(timeSec * 90) * 7 * glitchAmount
    : Math.sin(timeSec * 3.2) * 1.5;
  const jitterY = isJumpscare
    ? Math.cos(timeSec * 55) * 7
    : isGlitching
    ? Math.cos(timeSec * 78) * 4 * glitchAmount
    : Math.cos(timeSec * 2.4) * 1.5;

  ctx.translate(jitterX, jitterY);

  // Controlled mechanical body twitch during menu glitch (less exaggerated, eerie FNAF feel)
  if (isGlitching && !isJumpscare) {
    const snapAngle =
      Math.sin(timeSec * 65 + (id === 'freddy' ? 1 : id === 'bonnie' ? 2.5 : 4)) *
      0.065 *
      glitchAmount;
    ctx.rotate(snapAngle);
    ctx.scale(scale, scale);
  } else {
    ctx.scale(scale, scale);
  }

  // Subtle displaced ghost silhouette behind the animatronic during menu glitch
  if (isGlitching && !isJumpscare) {
    ctx.save();
    ctx.translate(Math.sin(timeSec * 110) * 5.5, -2.5);
    ctx.globalAlpha = 0.28;
    if (id === 'freddy') drawStillFreddy(ctx, timeSec, false, glitchAmount, 0);
    else if (id === 'bonnie') drawStillBonnie(ctx, timeSec, false, glitchAmount, 0);
    else if (id === 'chica') drawStillChica(ctx, timeSec, false, glitchAmount, 0);
    else if (id === 'nightmare') drawStillNightmare(ctx, timeSec, false, glitchAmount, 0);
    else drawTheBlob(ctx, timeSec, false, 0);
    ctx.restore();
  }

  if (id === 'freddy') {
    drawStillFreddy(ctx, timeSec, isJumpscare, glitchAmount, jumpscareElapsedSec);
  } else if (id === 'bonnie') {
    drawStillBonnie(ctx, timeSec, isJumpscare, glitchAmount, jumpscareElapsedSec);
  } else if (id === 'chica') {
    drawStillChica(ctx, timeSec, isJumpscare, glitchAmount, jumpscareElapsedSec);
  } else if (id === 'nightmare') {
    drawStillNightmare(ctx, timeSec, isJumpscare, glitchAmount, jumpscareElapsedSec);
  } else {
    drawTheBlob(ctx, timeSec, isJumpscare, jumpscareElapsedSec);
  }

  // Subtle localized horizontal signal interference bars across this animatronic when glitching
  if (isGlitching) {
    ctx.fillStyle = 'rgba(239, 68, 68, 0.26)';
    ctx.fillRect(-52, -82 + Math.sin(timeSec * 85) * 24, 104, 4);
    ctx.fillStyle = 'rgba(56, 189, 248, 0.22)';
    ctx.fillRect(-48, -28 + Math.cos(timeSec * 105) * 28, 96, 3);
  }

  ctx.restore();
}

function drawStillFreddy(
  ctx: CanvasRenderingContext2D,
  t: number,
  isJumpscare: boolean,
  glitchAmount = 0,
  jumpscareElapsedSec = 0
) {
  const isGlitch = glitchAmount > 0.01;
  const reachProgress = isJumpscare ? Math.min(1, jumpscareElapsedSec / 0.45) : 0;

  // DEMACIATED LOWER LEGS & PELVIS (Exposed Endoskeleton Ribs & Pistons)
  ctx.strokeStyle = '#52525b';
  ctx.lineWidth = 5;
  ctx.fillStyle = '#27272a';
  ctx.fillRect(-34, 58, 16, 62);
  ctx.fillRect(18, 58, 16, 62);

  ctx.strokeStyle = '#a1a1aa';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-26, 60);
  ctx.lineTo(-26, 118);
  ctx.moveTo(26, 60);
  ctx.lineTo(26, 118);
  ctx.stroke();

  // Tattered knee patches
  ctx.fillStyle = '#451a03';
  ctx.fillRect(-36, 75, 20, 14);
  ctx.fillRect(16, 82, 20, 12);

  // Pelvis endoskeleton cage (demaciated lower abdomen)
  ctx.fillStyle = '#18181b';
  ctx.fillRect(-38, 22, 76, 38);
  ctx.strokeStyle = '#71717a';
  ctx.lineWidth = 2.5;
  for (let y = 26; y <= 52; y += 8) {
    ctx.beginPath();
    ctx.moveTo(-32, y);
    ctx.lineTo(32, y);
    ctx.stroke();
  }
  ctx.fillStyle = '#a1a1aa';
  ctx.fillRect(-5, 16, 10, 44);

  // Upper Torso (Withered dark brown shell, decayed at the bottom)
  ctx.fillStyle = '#5c2d0c';
  ctx.beginPath();
  ctx.moveTo(-48, -32);
  ctx.lineTo(48, -32);
  ctx.lineTo(42, 24);
  ctx.lineTo(22, 14);
  ctx.lineTo(8, 28);
  ctx.lineTo(-12, 15);
  ctx.lineTo(-30, 26);
  ctx.lineTo(-44, 18);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#291304';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Tattered bowtie
  ctx.fillStyle = '#991b1b';
  ctx.beginPath();
  ctx.moveTo(0, -24);
  ctx.lineTo(-16, -31);
  ctx.lineTo(-16, -17);
  ctx.closePath();
  ctx.moveTo(0, -24);
  ctx.lineTo(16, -31);
  ctx.lineTo(14, -19);
  ctx.closePath();
  ctx.fill();

  // ARMS: During normal/glitch, hang at sides; during jumpscare, move forward/inward toward the security guard
  if (!isJumpscare) {
    const armJerk = isGlitch ? Math.sin(t * 75) * 0.16 : 0;
    ctx.save();
    ctx.translate(-58, -24);
    ctx.rotate(armJerk);
    ctx.fillStyle = '#4a2208';
    ctx.fillRect(-10, -4, 18, 52);
    ctx.fillStyle = '#3f3f46';
    ctx.fillRect(-7, 48, 12, 28);
    ctx.restore();

    ctx.save();
    ctx.translate(58, -24);
    ctx.rotate(-armJerk);
    ctx.fillStyle = '#4a2208';
    ctx.fillRect(-8, -4, 18, 52);
    ctx.fillStyle = '#3f3f46';
    ctx.fillRect(-5, 48, 12, 28);
    ctx.restore();
  }

  // HEAD: crisp, creepy FNAF head twitch during independent menu glitch
  ctx.save();
  if (isGlitch && !isJumpscare) {
    ctx.translate(Math.sin(t * 95) * 5, -Math.abs(Math.cos(t * 80)) * 4);
    ctx.rotate(Math.cos(t * 70) * 0.18);
  }

  // Top Hat + Ears
  ctx.fillStyle = '#18181b';
  ctx.fillRect(-20, -118, 40, 26);
  ctx.fillRect(-30, -94, 60, 6);

  ctx.fillStyle = '#5c2d0c';
  ctx.beginPath();
  ctx.arc(-38, -86, 12, 0, Math.PI * 2);
  ctx.arc(38, -86, 12, 0, Math.PI * 2);
  ctx.fill();

  // Upper Cranium Casing (stops at cheekbones — NO UPPER JAW!)
  ctx.fillStyle = '#6b3410';
  ctx.beginPath();
  ctx.roundRect(-40, -90, 80, 34, [16, 16, 4, 4]);
  ctx.fill();

  // EYE SOCKETS:
  ctx.fillStyle = '#09090b';
  ctx.beginPath();
  ctx.arc(-18, -72, 10, 0, Math.PI * 2);
  ctx.arc(18, -72, 11, 0, Math.PI * 2); // Freddy's Left Eye (MISSING!)
  ctx.fill();

  // Freddy's Right Eye (present - flares bright red/white on glitch)
  ctx.fillStyle = isGlitch || isJumpscare ? '#ef4444' : '#e4e4e7';
  ctx.beginPath();
  ctx.arc(-18, -72, isGlitch || isJumpscare ? 6 : 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = isGlitch || isJumpscare ? '#ffffff' : '#ef4444';
  ctx.beginPath();
  ctx.arc(-18, -72, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Freddy's Left Eye (MISSING - empty torn socket with hanging wires)
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(16, -74);
  ctx.lineTo(24, -60);
  ctx.moveTo(20, -70);
  ctx.lineTo(14, -56);
  ctx.stroke();

  // NON-EXISTENT UPPER JAW ("mandíbula superior inexistente")
  ctx.fillStyle = '#27272a';
  ctx.fillRect(-24, -56, 48, 8);
  ctx.fillStyle = '#d4d4d8';
  for (let x = -20; x <= 16; x += 6) {
    ctx.fillRect(x, -48, 4, 9);
  }

  // Hanging lower jaw
  const jawDrop = isJumpscare
    ? 16 + Math.abs(Math.sin(t * 55)) * 12
    : isGlitch
    ? 7 + Math.abs(Math.sin(t * 55)) * 5
    : 4;
  ctx.fillStyle = '#4a2208';
  ctx.beginPath();
  ctx.roundRect(-28, -32 + jawDrop, 56, 16, 6);
  ctx.fill();
  ctx.fillStyle = '#a1a1aa';
  for (let x = -20; x <= 16; x += 6) {
    ctx.fillRect(x, -38 + jawDrop, 4, 6);
  }
  ctx.restore();

  // JUMPSCARE FOREGROUND REACHING ARMS: Freddy's arms stay strictly PARALLEL (not crossed) with claws reaching forward
  if (isJumpscare) {
    const parallelShakeY = Math.sin(t * 38) * 3;
    const armScale = 1 + reachProgress * 0.36;

    // Left arm reaching forward in parallel (vertical/parallel alignment, zero crossing angle)
    ctx.save();
    ctx.translate(-54, -28 - reachProgress * 16 + parallelShakeY);
    ctx.scale(armScale, armScale);
    ctx.fillStyle = '#4a2208';
    ctx.beginPath();
    ctx.roundRect(-11, -6, 22, 48, 6);
    ctx.fill();
    ctx.fillStyle = '#3f3f46';
    ctx.fillRect(-8, 40, 16, 28);
    // Parallel mechanical claws
    ctx.fillStyle = '#d4d4d8';
    for (let c = -6; c <= 6; c += 6) {
      ctx.beginPath();
      ctx.moveTo(c - 2, 68);
      ctx.lineTo(c, 84);
      ctx.lineTo(c + 2, 68);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Right arm reaching forward in parallel (strictly parallel to left arm)
    ctx.save();
    ctx.translate(54, -28 - reachProgress * 16 - parallelShakeY);
    ctx.scale(armScale, armScale);
    ctx.fillStyle = '#4a2208';
    ctx.beginPath();
    ctx.roundRect(-11, -6, 22, 48, 6);
    ctx.fill();
    ctx.fillStyle = '#3f3f46';
    ctx.fillRect(-8, 40, 16, 28);
    // Parallel mechanical claws
    ctx.fillStyle = '#d4d4d8';
    for (let c = -6; c <= 6; c += 6) {
      ctx.beginPath();
      ctx.moveTo(c - 2, 68);
      ctx.lineTo(c, 84);
      ctx.lineTo(c + 2, 68);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawStillBonnie(
  ctx: CanvasRenderingContext2D,
  t: number,
  isJumpscare: boolean,
  glitchAmount = 0,
  jumpscareElapsedSec = 0
) {
  const isGlitch = glitchAmount > 0.01;
  const approachProgress = isJumpscare ? Math.min(1, jumpscareElapsedSec / 0.48) : 0;

  ctx.save();
  if (isJumpscare) {
    // Bonnie lunges much closer to the guard's face during his jumpscare
    const faceZoom = 1 + approachProgress * 0.62;
    ctx.translate(0, approachProgress * 34);
    ctx.scale(faceZoom, faceZoom);
  }

  // Character's Right Leg (viewer's left): Weathered indigo casing
  ctx.fillStyle = '#312e81';
  ctx.fillRect(-36, 46, 22, 72);

  // Character's Left Leg (viewer's right): EXPOSED ENDOSKELETON LEG
  ctx.fillStyle = '#52525b';
  ctx.fillRect(16, 46, 8, 72);
  ctx.fillStyle = '#a1a1aa';
  ctx.fillRect(26, 50, 4, 66);
  ctx.fillStyle = '#27272a';
  ctx.beginPath();
  ctx.arc(21, 78, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#d4d4d8';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#71717a';
  ctx.fillRect(12, 114, 24, 6);

  // TORSO
  ctx.fillStyle = '#3730a3';
  ctx.beginPath();
  ctx.roundRect(-44, -30, 88, 78, 12);
  ctx.fill();
  ctx.fillStyle = '#4338ca';
  ctx.beginPath();
  ctx.ellipse(0, 10, 26, 32, 0, 0, Math.PI * 2);
  ctx.fill();

  // Red Bowtie
  ctx.fillStyle = '#dc2626';
  ctx.beginPath();
  ctx.moveTo(0, -22);
  ctx.lineTo(-18, -30);
  ctx.lineTo(-18, -14);
  ctx.closePath();
  ctx.moveTo(0, -22);
  ctx.lineTo(18, -30);
  ctx.lineTo(18, -14);
  ctx.closePath();
  ctx.fill();

  // DAMAGED MECHANICAL ARM WITH LOOSE HANGING CABLES (coils & tangles dynamically during jumpscare!)
  const armTwitch = isJumpscare
    ? -0.35 + Math.sin(t * 35) * 0.18
    : isGlitch
    ? Math.cos(t * 80) * 0.18
    : 0;
  ctx.save();
  ctx.translate(-58, -24);
  ctx.rotate(armTwitch);
  ctx.fillStyle = '#52525b';
  ctx.fillRect(-8, -2, 16, 44);

  if (isJumpscare) {
    // Dynamic cable entangling / coiling while screaming at the guard
    const coilSpeed = t * 24 + jumpscareElapsedSec * 12;
    const colors = ['#ef4444', '#eab308', '#38bdf8', '#f97316'];
    ctx.lineWidth = 3;
    for (let c = 0; c < colors.length; c++) {
      const phase = coilSpeed + c * 1.65;
      ctx.strokeStyle = colors[c];
      ctx.beginPath();
      ctx.moveTo(-4 + c * 3, 38);
      const cp1x = Math.sin(phase) * 28;
      const cp1y = 52 + Math.cos(phase * 1.3) * 10;
      const cp2x = -Math.sin(phase * 1.2) * 30;
      const cp2y = 70 + Math.sin(phase * 0.9) * 12;
      const endX = Math.cos(phase * 1.5) * 18;
      const endY = 88 + Math.sin(phase * 1.7) * 8;
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endX, endY);
      ctx.bezierCurveTo(
        endX + Math.sin(phase * 2) * 16,
        endY - 14,
        endX - Math.cos(phase * 2) * 16,
        endY + 10,
        Math.sin(phase) * 8,
        64 + c * 5
      );
      ctx.stroke();
    }
  } else {
    const sway = isGlitch ? Math.sin(t * 65) * 8 : Math.sin(t * 4) * 4;
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-4, 38);
    ctx.quadraticCurveTo(-14 + sway, 62, 0 + sway, 86);
    ctx.stroke();
    ctx.strokeStyle = '#eab308';
    ctx.beginPath();
    ctx.moveTo(2, 40);
    ctx.quadraticCurveTo(10 - sway, 66, -6 - sway, 92);
    ctx.stroke();
    ctx.strokeStyle = '#38bdf8';
    ctx.beginPath();
    ctx.moveTo(6, 36);
    ctx.quadraticCurveTo(-2 + sway, 59, 8 + sway, 79);
    ctx.stroke();
  }
  ctx.restore();

  // Other arm holding the DESTROYED GUITAR
  ctx.fillStyle = '#312e81';
  ctx.fillRect(46, -26, 18, 56);

  // SHATTERED / DESTROYED V-GUITAR strapped across torso/right side
  ctx.save();
  ctx.translate(18, 16);
  ctx.rotate(isGlitch ? -0.35 + Math.sin(t * 75) * 0.12 : -0.35);
  ctx.fillStyle = '#991b1b';
  ctx.beginPath();
  ctx.moveTo(-24, -12);
  ctx.lineTo(20, -18);
  ctx.lineTo(36, 22);
  ctx.lineTo(12, 8);
  ctx.lineTo(2, 18);
  ctx.lineTo(-12, 10);
  ctx.lineTo(-22, 20);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#1c1917';
  ctx.fillRect(-58, -6, 38, 8);
  ctx.strokeStyle = '#d4d4d8';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-54, -4);
  ctx.lineTo(10, -2);
  ctx.moveTo(-54, 0);
  ctx.quadraticCurveTo(-20, -18, 5, -12);
  ctx.moveTo(-54, 3);
  ctx.quadraticCurveTo(-15, 22, 8, 16);
  ctx.stroke();
  ctx.restore();

  // HEAD & LONG ARTICULATED RABBIT EARS
  ctx.save();
  if (isGlitch && !isJumpscare) {
    ctx.translate(Math.cos(t * 95) * 5.5, -Math.abs(Math.sin(t * 80)) * 4.5);
    ctx.rotate(-Math.sin(t * 70) * 0.20);
  }
  ctx.fillStyle = '#312e81';
  ctx.fillRect(-30, -135, 16, 44);
  ctx.fillRect(14, -125, 16, 34);
  ctx.fillStyle = '#71717a';
  ctx.fillRect(18, -142, 8, 20);

  ctx.fillStyle = '#3730a3';
  ctx.beginPath();
  ctx.roundRect(-36, -88, 72, 54, 14);
  ctx.fill();

  // Eye sockets
  ctx.fillStyle = '#09090b';
  ctx.beginPath();
  ctx.arc(-15, -66, 10, 0, Math.PI * 2);
  ctx.arc(15, -66, 10, 0, Math.PI * 2);
  ctx.fill();

  // Intact Right Eye (viewer's left)
  ctx.fillStyle = isJumpscare || isGlitch ? '#ff0040' : '#f43f5e';
  ctx.beginPath();
  ctx.arc(-15, -66, isGlitch || isJumpscare ? 5.5 : 4, 0, Math.PI * 2);
  ctx.fill();

  // Muzzle & teeth (drawn before the dangling eye so the popped-out eye hangs in front of the muzzle!)
  const jawDrop = isJumpscare
    ? 14 + Math.abs(Math.sin(t * 60)) * 10
    : isGlitch
    ? 5 + Math.abs(Math.sin(t * 60)) * 4
    : 0;
  ctx.fillStyle = '#1e1b4b';
  ctx.beginPath();
  ctx.roundRect(-24, -48 + jawDrop, 48, 18, 6);
  ctx.fill();
  ctx.fillStyle = '#d4d4d8';
  for (let x = -18; x <= 14; x += 6) {
    ctx.fillRect(x, -36 + jawDrop, 4, 6);
  }

  // Bonnie's Left Eye (viewer's right): During jumpscare, pops out of its socket and dangles/swings on a cable!
  if (isJumpscare) {
    const eyePopProgress = Math.min(1, jumpscareElapsedSec / 0.35);
    const swingX = Math.sin(t * 24) * 12 * eyePopProgress;
    const bounceY = Math.abs(Math.cos(t * 28)) * 6 * eyePopProgress;
    const eyeX = 15 + swingX;
    const eyeY = -66 + eyePopProgress * 38 + bounceY;

    // Sparking inner socket
    ctx.fillStyle = '#27272a';
    ctx.beginPath();
    ctx.arc(15, -66, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // Optic cable connecting socket (15, -66) to the popped-out dangling eyeball
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(15, -66);
    ctx.quadraticCurveTo(15 + swingX * 1.35, -66 + (eyeY + 66) * 0.5, eyeX, eyeY);
    ctx.stroke();

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(13, -66);
    ctx.quadraticCurveTo(13 - swingX * 0.6, -66 + (eyeY + 66) * 0.55, eyeX - 2, eyeY);
    ctx.stroke();

    // Dangling mechanical eyeball casing + glowing crimson iris
    ctx.fillStyle = '#e4e4e7';
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, 8.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#18181b';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    ctx.fillStyle = '#ff0040';
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, 4.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(eyeX - 1.5, eyeY - 1.5, 1.8, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = isGlitch ? '#ff0040' : '#f43f5e';
    ctx.beginPath();
    ctx.arc(15, -66, isGlitch ? 5.5 : 4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
  ctx.restore();
}

function drawStillChica(
  ctx: CanvasRenderingContext2D,
  t: number,
  isJumpscare: boolean,
  glitchAmount = 0,
  jumpscareElapsedSec = 0
) {
  const isGlitch = glitchAmount > 0.01;
  // Two-stage jumpscare:
  // Stage 1 (0.0s -> 1.0s): Chica screams with her normal upper head mouth wide open
  // Stage 2 (1.0s+): Upper head mouth stops animating, and the lower-abdomen mouth expands to fill the ENTIRE screen!
  const abdomenPhase =
    isJumpscare && jumpscareElapsedSec >= 1.0
      ? Math.min(1, (jumpscareElapsedSec - 1.0) / 0.42)
      : 0;

  // Legs
  ctx.fillStyle = '#a16207';
  ctx.fillRect(-32, 48, 20, 62);
  ctx.fillRect(12, 48, 20, 62);
  ctx.fillStyle = '#ea580c';
  ctx.fillRect(-36, 106, 26, 10);
  ctx.fillRect(10, 106, 26, 10);

  // Torso (Dirty withered yellow)
  ctx.fillStyle = '#ca8a04';
  ctx.beginPath();
  ctx.roundRect(-46, -30, 92, 80, 16);
  ctx.fill();

  // Torn Bib
  ctx.fillStyle = '#e4e4e7';
  ctx.beginPath();
  ctx.moveTo(-30, -28);
  ctx.lineTo(30, -28);
  ctx.lineTo(22, 6);
  ctx.lineTo(-18, 10);
  ctx.closePath();
  ctx.fill();

  // MISSING RIGHT ARM SOCKET WITH SPARKING WIRES
  ctx.fillStyle = '#09090b';
  ctx.beginPath();
  ctx.arc(-46, -16, 12, 0, Math.PI * 2);
  ctx.fill();
  const wireWhip = isGlitch || (isJumpscare && abdomenPhase === 0) ? Math.sin(t * 95) * 6 : 0;
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-48, -14);
  ctx.lineTo(-64 + wireWhip, 18);
  ctx.moveTo(-44, -10);
  ctx.lineTo(-56 - wireWhip, 26);
  ctx.stroke();
  ctx.strokeStyle = '#38bdf8';
  ctx.beginPath();
  ctx.moveTo(-50, -18);
  ctx.lineTo(-68 + wireWhip, 8);
  ctx.stroke();

  // LEFT ARM holding the HALF-DESTROYED CUPCAKE
  ctx.save();
  if (isGlitch) {
    ctx.translate(54, -20);
    ctx.rotate(Math.sin(t * 85) * 0.20);
    ctx.translate(-54, 20);
  }
  ctx.fillStyle = '#a16207';
  ctx.fillRect(46, -24, 18, 50);

  ctx.save();
  ctx.translate(64, 10);
  ctx.fillStyle = '#78350f';
  ctx.fillRect(-14, 4, 28, 16);
  ctx.fillStyle = '#db2777';
  ctx.beginPath();
  ctx.arc(-4, 0, 12, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = '#3f3f46';
  ctx.fillRect(0, -10, 12, 14);
  ctx.fillStyle = '#fde047';
  ctx.beginPath();
  ctx.arc(-6, -2, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#a1a1aa';
  ctx.beginPath();
  ctx.moveTo(6, -2);
  ctx.lineTo(14, 8);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(14, 8, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.restore();

  // HEAD WITH TORN-OFF BEAK: Screams ONLY during the first 1.0s (abdomenPhase === 0).
  // Once abdomenPhase > 0, the upper mouth stops animating completely!
  ctx.save();
  if (isGlitch && !isJumpscare) {
    ctx.translate(Math.sin(t * 115) * 6, -Math.abs(Math.cos(t * 100)) * 5);
    ctx.rotate(Math.sin(t * 85) * 0.22);
  } else if (isJumpscare && abdomenPhase === 0) {
    ctx.translate(0, -4 + Math.sin(t * 65) * 3);
    ctx.scale(1.12, 1.12);
  }
  ctx.fillStyle = '#ca8a04';
  ctx.beginPath();
  ctx.arc(0, -64, 36, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#09090b';
  ctx.beginPath();
  ctx.arc(-15, -72, 11, 0, Math.PI * 2);
  ctx.arc(15, -72, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = isGlitch || isJumpscare ? '#ef4444' : '#f8fafc';
  ctx.beginPath();
  ctx.arc(-15, -72, 7.5, 0, Math.PI * 2);
  ctx.arc(15, -72, 7.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = isGlitch || isJumpscare ? '#ffffff' : '#9333ea';
  ctx.beginPath();
  ctx.arc(-15, -72, 3.5, 0, Math.PI * 2);
  ctx.arc(15, -72, 3.5, 0, Math.PI * 2);
  ctx.fill();

  // TORN-OFF BEAK CAVITY (stops animating as soon as abdomenPhase > 0!)
  const beakGape =
    isJumpscare && abdomenPhase === 0
      ? 16 + Math.abs(Math.sin(t * 58)) * 10
      : isGlitch
      ? 5
      : 0;
  ctx.fillStyle = '#09090b';
  ctx.beginPath();
  ctx.roundRect(-22, -56, 44, 28 + beakGape, 6);
  ctx.fill();
  ctx.strokeStyle = '#713f12';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.fillStyle = '#e4e4e7';
  for (let x = -16; x <= 12; x += 6) {
    ctx.fillRect(x, -54, 4, 7);
    ctx.fillRect(x, -36 + beakGape, 4, 7);
  }
  ctx.restore();

  // TEETH PROTRUDING FROM LOWER ABDOMEN:
  // After 1.0s, expands massively so the stomach mouth fills the ENTIRE screen to engulf the viewer!
  ctx.save();
  if (abdomenPhase > 0) {
    const fullScreenScale = 1 + Math.pow(abdomenPhase, 1.25) * 6.8;
    ctx.translate(0, -18 * abdomenPhase);
    ctx.scale(fullScreenScale, fullScreenScale);
    ctx.translate(0, -28);
  }
  const stomachGnash =
    abdomenPhase > 0
      ? 48 * abdomenPhase
      : isGlitch
      ? Math.abs(Math.sin(t * 85)) * 3
      : 0;

  // Outer yellow torso frame around the expanding stomach mouth
  if (abdomenPhase > 0.05) {
    ctx.fillStyle = '#a16207';
    ctx.beginPath();
    ctx.roundRect(
      -48 - abdomenPhase * 24,
      2 - abdomenPhase * 18,
      96 + abdomenPhase * 48,
      54 + stomachGnash + abdomenPhase * 24,
      14
    );
    ctx.fill();
  }

  ctx.fillStyle = '#050507';
  ctx.beginPath();
  ctx.roundRect(
    -32 - abdomenPhase * 20,
    14 - abdomenPhase * 16,
    64 + abdomenPhase * 40,
    28 + stomachGnash,
    10
  );
  ctx.fill();
  ctx.strokeStyle = '#991b1b';
  ctx.lineWidth = 3.5;
  ctx.stroke();

  // Deep inner gullet rings as the stomach mouth fills the viewport
  if (abdomenPhase > 0.1) {
    for (let r = 1; r <= 3; r++) {
      ctx.strokeStyle = `rgba(185, 28, 28, ${0.42 - r * 0.1})`;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.ellipse(
        0,
        14 - abdomenPhase * 16 + (28 + stomachGnash) * 0.5,
        (28 + abdomenPhase * 14) * (1 - r * 0.22),
        (14 + stomachGnash * 0.35) * (1 - r * 0.22),
        0,
        0,
        Math.PI * 2
      );
      ctx.stroke();
    }
  }

  // Closing bite at the very end of the jumpscare (1.48s+)
  const biteClose =
    jumpscareElapsedSec > 1.48 ? Math.min(1, (jumpscareElapsedSec - 1.48) / 0.22) * 14 : 0;

  ctx.fillStyle = '#f4f4f5';
  const leftBound = -26 - Math.floor(abdomenPhase * 16);
  const rightBound = 22 + Math.floor(abdomenPhase * 16);
  const topY = 14 - abdomenPhase * 16;
  const bottomY = 14 - abdomenPhase * 16 + 28 + stomachGnash;
  const toothLen = 13 + abdomenPhase * 12 + biteClose;
  for (let x = leftBound; x <= rightBound; x += 8) {
    // Upper stomach teeth
    ctx.beginPath();
    ctx.moveTo(x, topY);
    ctx.lineTo(x + 3.5, topY + toothLen);
    ctx.lineTo(x + 7, topY);
    ctx.closePath();
    ctx.fill();
    // Lower stomach teeth
    ctx.beginPath();
    ctx.moveTo(x + 1, bottomY);
    ctx.lineTo(x + 4, bottomY - toothLen);
    ctx.lineTo(x + 7, bottomY);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawTheBlob(
  ctx: CanvasRenderingContext2D,
  t: number,
  isJumpscare: boolean,
  jumpscareElapsedSec = 0
) {
  // In less than 1 second (~0.45s), all 3 heads emerge outward from the main body on metallic endoskeleton struts
  const splitProgress = isJumpscare
    ? Math.min(1, Math.max(0.15, jumpscareElapsedSec / 0.45))
    : 0;

  // 1. FOXY'S LEGS
  ctx.fillStyle = '#7f1d1d';
  ctx.fillRect(-38, 44, 24, 28);
  ctx.fillRect(14, 44, 24, 28);
  ctx.fillStyle = '#a1a1aa';
  ctx.fillRect(-30, 72, 8, 44);
  ctx.fillRect(22, 72, 8, 44);
  ctx.fillStyle = '#52525b';
  ctx.fillRect(-38, 112, 24, 7);
  ctx.fillRect(14, 112, 24, 7);

  // 2. MASSIVE AMALGAM TORSO OF WIRES & MOLTEN CABLES
  ctx.fillStyle = '#18181b';
  ctx.beginPath();
  ctx.ellipse(0, 4, 54, 48, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#3f3f46';
  ctx.lineWidth = 5;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(-46, i * 11);
    ctx.bezierCurveTo(
      -15,
      i * 11 + Math.sin(t * 4 + i) * 12,
      15,
      i * 11 - Math.cos(t * 4 + i) * 12,
      46,
      i * 11
    );
    ctx.stroke();
  }

  // 3. TOY FREDDY'S ARMS
  ctx.fillStyle = '#7c2d12';
  ctx.beginPath();
  ctx.roundRect(-78, -24, 24, 34, 10);
  ctx.roundRect(-82, 12, 22, 34, 10);
  ctx.roundRect(54, -24, 24, 34, 10);
  ctx.roundRect(60, 12, 22, 34, 10);
  ctx.fill();
  ctx.strokeStyle = '#ea580c';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Compute positions for the 3 heads emerging from the main body
  const ffX = 0;
  const ffY = -68 - splitProgress * 16;

  const bonnetX = -34 - splitProgress * 64; // Moves to the left of the screen
  const bonnetY = -22 - splitProgress * 10;

  const bbX = 34 + splitProgress * 64; // Moves to the right of the screen
  const bbY = -18 - splitProgress * 10;

  // 4. METALLIC ENDOSKELETON BARS CONNECTING ALL 3 HEADS TO THE MAIN BODY (so they never look like they float!)
  const drawEndoStrut = (x1: number, y1: number, x2: number, y2: number) => {
    ctx.save();
    // Outer dark steel beam
    ctx.strokeStyle = '#3f3f46';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Inner bright hydraulic chrome rod
    ctx.strokeStyle = '#a1a1aa';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Mechanical cross-ribs / joints along the bar
    const steps = 4;
    for (let s = 1; s < steps; s++) {
      const rx = x1 + ((x2 - x1) * s) / steps;
      const ry = y1 + ((y2 - y1) * s) / steps;
      ctx.fillStyle = '#18181b';
      ctx.beginPath();
      ctx.arc(rx, ry, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#d4d4d8';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.restore();
  };

  // Draw the 3 metallic endoskeleton struts emerging from the central torso core (0, -14)
  drawEndoStrut(0, -20, ffX, ffY + 10);
  drawEndoStrut(-18, -10, bonnetX, bonnetY);
  drawEndoStrut(18, -10, bbX, bbY);

  // ============================================================================
  // HEAD A (TOP CENTER): FUNTIME FREDDY (Mask opens left & right during jumpscare to reveal screaming Endoskeleton!)
  // ============================================================================
  ctx.save();
  ctx.translate(ffX, ffY);
  const maskOpenOffset = splitProgress * 22;
  const screamJaw = isJumpscare ? 10 + Math.abs(Math.sin(t * 60)) * 8 : 0;

  // Inner Endoskeleton Skull (exposed when the Funtime Freddy faceplates split open)
  ctx.fillStyle = '#27272a';
  ctx.beginPath();
  ctx.roundRect(-22, -24, 44, 44, 8);
  ctx.fill();
  ctx.strokeStyle = '#a1a1aa';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Endoskeleton cranium metal grille & glowing eyes
  ctx.fillStyle = '#09090b';
  ctx.beginPath();
  ctx.arc(-10, -8, 6.5, 0, Math.PI * 2);
  ctx.arc(10, -8, 6.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = isJumpscare ? '#ef4444' : '#38bdf8';
  ctx.beginPath();
  ctx.arc(-10, -8, 3.2, 0, Math.PI * 2);
  ctx.arc(10, -8, 3.2, 0, Math.PI * 2);
  ctx.fill();

  // Endoskeleton screaming jaw & metal teeth
  ctx.fillStyle = '#18181b';
  ctx.fillRect(-16, 4, 32, 14 + screamJaw);
  ctx.fillStyle = '#e4e4e7';
  for (let x = -14; x <= 12; x += 5) {
    ctx.fillRect(x, 4, 3, 5);
    ctx.fillRect(x, 13 + screamJaw, 3, 5);
  }

  // Left Funtime Freddy Faceplate (splits outward to the left)
  ctx.save();
  ctx.translate(-maskOpenOffset, 0);
  ctx.rotate(-splitProgress * 0.22);
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.roundRect(-32, -28, 30, 52, 10);
  ctx.fill();
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#ec4899';
  ctx.beginPath();
  ctx.arc(-20, 2, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#09090b';
  ctx.beginPath();
  ctx.arc(-14, -10, 8, 0, Math.PI * 2);
  ctx.fill();
  if (!isJumpscare) {
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(-14, -10, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Right Funtime Freddy Faceplate (splits outward to the right)
  ctx.save();
  ctx.translate(maskOpenOffset, 0);
  ctx.rotate(splitProgress * 0.22);
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.roundRect(2, -26, 30, 52, 10);
  ctx.fill();
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#ec4899';
  ctx.beginPath();
  ctx.arc(20, 2, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#09090b';
  ctx.beginPath();
  ctx.arc(16, -10, 8, 0, Math.PI * 2);
  ctx.fill();
  if (!isJumpscare) {
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(16, -10, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.restore();

  // ============================================================================
  // HEAD B (LEFT SIDE): BONNET (Both eyes destroyed & toothless mouth, extends left on metallic bar)
  // ============================================================================
  ctx.save();
  ctx.translate(bonnetX, bonnetY);
  ctx.rotate(isJumpscare ? -0.12 + Math.sin(t * 55) * 0.08 : -0.28);

  // Pink Rabbit Ears
  ctx.fillStyle = '#f472b6';
  ctx.fillRect(-13, -38, 8, 22);
  ctx.fillRect(5, -36, 8, 20);

  // Bonnet Cranium
  ctx.beginPath();
  ctx.arc(0, -10, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#be185d';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // BOTH EYES DESTROYED (Hollow shattered black sockets with fracture lines, no pupils)
  ctx.fillStyle = '#09090b';
  ctx.beginPath();
  ctx.arc(-8, -13, 6.5, 0, Math.PI * 2);
  ctx.arc(8, -13, 6.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#52525b';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  // Cracks around destroyed eye sockets
  ctx.moveTo(-8, -19);
  ctx.lineTo(-11, -24);
  ctx.moveTo(-14, -13);
  ctx.lineTo(-18, -10);
  ctx.moveTo(8, -19);
  ctx.lineTo(12, -24);
  ctx.moveTo(14, -13);
  ctx.lineTo(18, -11);
  ctx.stroke();

  // TOOTHLESS MOUTH ("sin dientes en la boca", opens wide in a dark hollow scream)
  const bonnetJawOpen = isJumpscare ? 14 + Math.abs(Math.sin(t * 62)) * 6 : 5;
  ctx.fillStyle = '#09090b';
  ctx.beginPath();
  ctx.roundRect(-12, -2, 24, 8 + bonnetJawOpen, 6);
  ctx.fill();
  ctx.strokeStyle = '#9d174d';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  // ============================================================================
  // HEAD C (RIGHT SIDE): BALLOON BOY REDESIGN
  // (Half head shows exposed metallic endoskeleton, cables coming out of left eye, sharp teeth)
  // ============================================================================
  ctx.save();
  ctx.translate(bbX, bbY);
  ctx.rotate(isJumpscare ? 0.12 - Math.sin(t * 55) * 0.08 : 0.25);

  const bbJawOpen = isJumpscare ? 13 + Math.abs(Math.sin(t * 64)) * 7 : 3;

  // Left half of head (viewer's left): Intact plastic casing + blue/red propeller cap
  ctx.fillStyle = '#fed7aa';
  ctx.beginPath();
  ctx.arc(0, -8, 21, Math.PI * 0.5, Math.PI * 1.5);
  ctx.fill();

  // Right half of head (Balloon Boy's Left Hemisphere): EXPOSED METALLIC ENDOSKELETON HALF-HEAD
  ctx.fillStyle = '#3f3f46';
  ctx.beginPath();
  ctx.arc(0, -8, 21, -Math.PI * 0.5, Math.PI * 0.5);
  ctx.fill();
  ctx.strokeStyle = '#a1a1aa';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Metallic endoskeleton plates & structural seams on exposed half
  ctx.strokeStyle = '#d4d4d8';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, -29);
  ctx.lineTo(0, 14);
  ctx.moveTo(2, -18);
  ctx.lineTo(18, -18);
  ctx.moveTo(2, -2);
  ctx.lineTo(19, -2);
  ctx.stroke();

  // Half-remaining cap on left side
  ctx.fillStyle = '#2563eb';
  ctx.beginPath();
  ctx.arc(0, -16, 19, Math.PI, Math.PI * 1.55);
  ctx.lineTo(0, -16);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(-10, -34, 10, 16);

  // Eye Sockets (Right eye has sinister pupil; Left eye on endo half has cables coming out!)
  ctx.fillStyle = '#09090b';
  ctx.beginPath();
  ctx.arc(-8, -10, 5.5, 0, Math.PI * 2);
  ctx.arc(8, -10, 6.5, 0, Math.PI * 2); // Balloon Boy's Left Eye Socket
  ctx.fill();

  // Intact eye pupil
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(-8, -10, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // CABLES PROTRUDING FROM BALLOON BOY'S LEFT EYE SOCKET ("con cables saliendo del ojo izquierdo")
  const bbWireWave = Math.sin(t * (isJumpscare ? 45 : 8)) * 4;
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#ef4444';
  ctx.beginPath();
  ctx.moveTo(8, -10);
  ctx.quadraticCurveTo(18, -14 + bbWireWave, 26, -4 + bbWireWave);
  ctx.stroke();

  ctx.strokeStyle = '#38bdf8';
  ctx.beginPath();
  ctx.moveTo(9, -9);
  ctx.quadraticCurveTo(20, -4 - bbWireWave, 28, 6 - bbWireWave);
  ctx.stroke();

  ctx.strokeStyle = '#eab308';
  ctx.beginPath();
  ctx.moveTo(7, -8);
  ctx.quadraticCurveTo(15, 2 + bbWireWave, 22, 12);
  ctx.stroke();

  // MOUTH WITH SHARP POINTED TEETH ("abriendo su boca con dientes afilados")
  ctx.fillStyle = '#09090b';
  ctx.beginPath();
  ctx.roundRect(-14, 0, 28, 8 + bbJawOpen, 5);
  ctx.fill();

  ctx.fillStyle = '#f8fafc';
  for (let x = -12; x <= 10; x += 5.5) {
    // Upper sharp fang
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 2.5, 5.5);
    ctx.lineTo(x + 5, 0);
    ctx.closePath();
    ctx.fill();

    // Lower sharp fang
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 8 + bbJawOpen);
    ctx.lineTo(x + 2.5, 2.5 + bbJawOpen);
    ctx.lineTo(x + 5, 8 + bbJawOpen);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Renders the top-down (zenithal) office environment backdrop for Still Nightmare's jumpscare:
 * checkered floor from above, top of the security desk, fan blades from above, monitors, and soda cup.
 */
function drawZenithalOfficeBackdrop(ctx: CanvasRenderingContext2D, t: number) {
  ctx.save();
  // Top-down checkered floor tiles
  const tileSize = 42;
  for (let gx = -320; gx < 320; gx += tileSize) {
    for (let gy = -240; gy < 240; gy += tileSize) {
      const isEven = (Math.floor((gx + 320) / tileSize) + Math.floor((gy + 240) / tileSize)) % 2 === 0;
      ctx.fillStyle = isEven ? '#16161f' : '#09090d';
      ctx.fillRect(gx, gy, tileSize, tileSize);
    }
  }

  // Radial vignette around the overhead camera
  const vig = ctx.createRadialGradient(0, 0, 40, 0, 0, 300);
  vig.addColorStop(0, 'rgba(220, 38, 38, 0.08)');
  vig.addColorStop(0.65, 'rgba(0, 0, 0, 0.55)');
  vig.addColorStop(1, 'rgba(0, 0, 0, 0.92)');
  ctx.fillStyle = vig;
  ctx.fillRect(-340, -260, 680, 520);

  // Top-down view of the security desk at the bottom of the frame
  ctx.fillStyle = '#27272a';
  ctx.strokeStyle = '#52525b';
  ctx.lineWidth = 3;
  ctx.fillRect(-190, 92, 380, 110);
  ctx.strokeRect(-190, 92, 380, 110);

  // CRT monitor tops on left of desk (top-down view)
  ctx.fillStyle = '#18181b';
  ctx.fillRect(-168, 104, 74, 58);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-162, 108, 62, 8);

  // Oscillating desk fan seen from directly above
  ctx.save();
  ctx.translate(12, 134);
  ctx.rotate(t * 20);
  ctx.fillStyle = '#71717a';
  for (let b = 0; b < 4; b++) {
    ctx.rotate(Math.PI / 2);
    ctx.fillRect(-5, -24, 10, 24);
  }
  ctx.restore();
  ctx.strokeStyle = '#a1a1aa';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(12, 134, 26, 0, Math.PI * 2);
  ctx.stroke();

  // Soda cup top-down circle (red/white rim + straw dot)
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.arc(118, 136, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#dc2626';
  ctx.beginPath();
  ctx.arc(118, 136, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Draws Still Nightmare:
 * - Gaunt black animatronic inspired by Nightmare from FNAF 4
 * - Half-destroyed golden bowtie
 * - Front chest hole exposing internal metallic endoskeleton ribs and core
 * - Semi-transparent dark legs allowing the internal endoskeleton legs to be seen
 * - Jumpscare:
 *   - 0.0s to 1.5s: Zenithal (top-down) view of the office while lunging upward toward the viewer
 *   - 1.5s+: Opens his mouth wide and zooms in so the open mouth covers almost the entire screen
 */
function drawStillNightmare(
  ctx: CanvasRenderingContext2D,
  t: number,
  isJumpscare: boolean,
  glitchAmount = 0,
  jumpscareElapsedSec = 0
) {
  const isGlitch = glitchAmount > 0.01;

  // Two-stage jumpscare:
  // Stage 1 (0.0s -> 1.5s): Zenithal office view while Still Nightmare lunges upward toward the camera
  // Stage 2 (1.5s+): Opens mouth wide and gets so close that his mouth covers nearly the entire screen
  const lungePhase = isJumpscare ? Math.min(1, jumpscareElapsedSec / 1.5) : 0;
  const mouthCoverPhase =
    isJumpscare && jumpscareElapsedSec >= 1.5
      ? Math.min(1, (jumpscareElapsedSec - 1.5) / 0.42)
      : 0;

  if (isJumpscare) {
    drawZenithalOfficeBackdrop(ctx, t);
  }

  ctx.save();
  if (isJumpscare && mouthCoverPhase === 0) {
    // Zenithal upward lunge toward the overhead camera (scales up from the office floor toward the lens)
    const zenithScale = 0.72 + Math.pow(lungePhase, 1.35) * 0.92;
    const zenithOffsetY = (1 - lungePhase) * 32;
    ctx.translate(0, zenithOffsetY);
    ctx.scale(zenithScale, zenithScale);
  }

  // 1. SEMI-TRANSPARENT LEGS WITH VISIBLE ENDOSKELETON INSIDE
  // First draw the internal metallic endoskeleton legs (pistons, knee joints, struts)
  ctx.fillStyle = '#71717a';
  ctx.fillRect(-31, 48, 8, 68);
  ctx.fillRect(23, 48, 8, 68);

  // Secondary hydraulic rods along the legs
  ctx.strokeStyle = '#d4d4d8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-22, 50);
  ctx.lineTo(-22, 114);
  ctx.moveTo(20, 50);
  ctx.lineTo(20, 114);
  ctx.stroke();

  // Horizontal endoskeleton leg rings & knee joints
  ctx.fillStyle = '#3f3f46';
  for (let ly = 56; ly <= 104; ly += 16) {
    ctx.fillRect(-35, ly, 18, 4);
    ctx.fillRect(17, ly, 18, 4);
  }
  ctx.fillStyle = '#a1a1aa';
  ctx.beginPath();
  ctx.arc(-26, 80, 6.5, 0, Math.PI * 2);
  ctx.arc(26, 80, 6.5, 0, Math.PI * 2);
  ctx.fill();

  // Metal endoskeleton clawed feet
  ctx.fillStyle = '#52525b';
  ctx.fillRect(-38, 112, 24, 8);
  ctx.fillRect(14, 112, 24, 8);

  // Semi-transparent smoky dark outer leg casings ("sus piernas deben tener un color mas transparente dejando ver su endoesqueleto un poco")
  ctx.fillStyle = 'rgba(12, 12, 18, 0.44)';
  ctx.strokeStyle = 'rgba(220, 38, 38, 0.42)';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.roundRect(-38, 46, 24, 68, 6);
  ctx.roundRect(14, 46, 24, 68, 6);
  ctx.fill();
  ctx.stroke();

  // 2. GAUNT BLACK TORSO WITH FRONT CHEST HOLE SHOWING ENDOSKELETON
  // Gaunt waist & broad intimidating shoulders
  ctx.fillStyle = '#09090e';
  ctx.strokeStyle = '#27272a';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(-50, -34);
  ctx.lineTo(50, -34);
  ctx.lineTo(38, 14);
  ctx.lineTo(32, 46);
  ctx.lineTo(-32, 46);
  ctx.lineTo(-38, 14);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Jagged hole in the front chest ("su parte de enfrente debe tener un agujero en la que se vea su endoesqueleto")
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-24, -14);
  ctx.lineTo(-8, -20);
  ctx.lineTo(14, -17);
  ctx.lineTo(26, -4);
  ctx.lineTo(22, 22);
  ctx.lineTo(6, 34);
  ctx.lineTo(-14, 30);
  ctx.lineTo(-26, 12);
  ctx.closePath();
  ctx.fillStyle = '#030305';
  ctx.fill();
  ctx.clip();

  // Exposed internal endoskeleton spine, ribs, and glowing danger core inside the chest hole
  ctx.fillStyle = '#71717a';
  ctx.fillRect(-5, -22, 10, 58);
  ctx.strokeStyle = '#d4d4d8';
  ctx.lineWidth = 3;
  for (let ry = -12; ry <= 26; ry += 9) {
    ctx.beginPath();
    ctx.moveTo(-26, ry);
    ctx.quadraticCurveTo(0, ry + 4, 26, ry);
    ctx.stroke();
  }
  // Pulsing red mechanical heart/sensor inside the endoskeleton chest
  ctx.fillStyle = 'rgba(239, 68, 68, 0.85)';
  ctx.beginPath();
  ctx.arc(4, 4, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Jagged torn casing rim around the chest hole
  ctx.strokeStyle = '#3f3f46';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-24, -14);
  ctx.lineTo(-8, -20);
  ctx.lineTo(14, -17);
  ctx.lineTo(26, -4);
  ctx.lineTo(22, 22);
  ctx.lineTo(6, 34);
  ctx.lineTo(-14, 30);
  ctx.lineTo(-26, 12);
  ctx.closePath();
  ctx.stroke();

  // 3. HALF-DESTROYED BOWTIE ("su pajarita tiene que estar a medio destruir")
  // Left wing of golden bowtie is intact; center knot is cracked; right wing is torn/shredded with hanging wires
  ctx.fillStyle = '#eab308';
  ctx.strokeStyle = '#713f12';
  ctx.lineWidth = 1.5;
  // Intact left bowtie wing
  ctx.beginPath();
  ctx.moveTo(-2, -25);
  ctx.lineTo(-22, -34);
  ctx.lineTo(-20, -16);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Cracked center knot
  ctx.fillStyle = '#ca8a04';
  ctx.fillRect(-4, -29, 7, 8);
  // Shredded / half-missing right bowtie remnant (jagged stump + torn yellow threads)
  ctx.fillStyle = '#a16207';
  ctx.beginPath();
  ctx.moveTo(3, -27);
  ctx.lineTo(12, -31);
  ctx.lineTo(8, -24);
  ctx.lineTo(14, -21);
  ctx.lineTo(3, -22);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(10, -26);
  ctx.lineTo(18, -19);
  ctx.moveTo(8, -22);
  ctx.lineTo(15, -14);
  ctx.stroke();

  // 4. GAUNT ARMS & RAZOR CLAWS (Reach upward during zenithal jumpscare)
  const armAngle = isJumpscare
    ? -0.45 - lungePhase * 0.35 + Math.sin(t * 45) * 0.12
    : isGlitch
    ? Math.sin(t * 80) * 0.18
    : 0.08;

  const drawNightmareArm = (side: -1 | 1) => {
    ctx.save();
    ctx.translate(side * 54, -26);
    ctx.rotate(side * armAngle);
    // Gaunt dark upper & lower arm with exposed endoskeleton gap
    ctx.fillStyle = '#0d0d14';
    ctx.strokeStyle = '#27272a';
    ctx.lineWidth = 1.8;
    ctx.fillRect(-9, -4, 18, 32);
    ctx.strokeRect(-9, -4, 18, 32);
    // Exposed elbow rod
    ctx.fillStyle = '#a1a1aa';
    ctx.fillRect(-4, 28, 8, 12);
    // Forearm
    ctx.fillStyle = '#0d0d14';
    ctx.fillRect(-10, 38, 20, 26);
    // Long metallic claws
    ctx.fillStyle = '#e4e4e7';
    for (let c = -7; c <= 7; c += 7) {
      ctx.beginPath();
      ctx.moveTo(c - 2.5, 64);
      ctx.lineTo(c, 84);
      ctx.lineTo(c + 2.5, 64);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  };

  drawNightmareArm(-1);
  drawNightmareArm(1);

  // 5. HEAD, YELLOW TOP HAT, PIERCING RED EYES & MASSIVE JAW
  // After 1.5s in jumpscare (mouthCoverPhase > 0), the head & open mouth zoom in massively to cover almost the entire screen!
  ctx.save();
  if (mouthCoverPhase > 0) {
    const fullScreenMouthScale = 1 + Math.pow(mouthCoverPhase, 1.2) * 6.5;
    ctx.translate(0, 42 * mouthCoverPhase);
    ctx.scale(fullScreenMouthScale, fullScreenMouthScale);
    ctx.translate(0, 52);
  } else if (isGlitch && !isJumpscare) {
    ctx.translate(Math.sin(t * 105) * 6, -Math.abs(Math.cos(t * 90)) * 5);
    ctx.rotate(Math.sin(t * 78) * 0.2);
  }

  // Yellow/Gold Nightmare Top Hat (with torn brim)
  ctx.fillStyle = '#ca8a04';
  ctx.strokeStyle = '#713f12';
  ctx.lineWidth = 2;
  ctx.fillRect(-20, -122, 40, 28);
  ctx.strokeRect(-20, -122, 40, 28);
  ctx.fillStyle = '#18181b';
  ctx.fillRect(-20, -102, 40, 6);
  ctx.fillStyle = '#eab308';
  ctx.fillRect(-32, -96, 64, 6);

  // Dark gaunt ears
  ctx.fillStyle = '#09090e';
  ctx.strokeStyle = '#27272a';
  ctx.beginPath();
  ctx.arc(-40, -86, 12, 0, Math.PI * 2);
  ctx.arc(40, -86, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Gaunt intimidating black cranium & withered snout
  ctx.fillStyle = '#0a0a0f';
  ctx.strokeStyle = '#27272a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-42, -92, 84, 48, 14);
  ctx.fill();
  ctx.stroke();

  // Deep hollow eye sockets + glowing red eyes
  ctx.fillStyle = '#020204';
  ctx.beginPath();
  ctx.arc(-17, -70, 11, 0, Math.PI * 2);
  ctx.arc(17, -70, 11, 0, Math.PI * 2);
  ctx.fill();

  // Menacing crimson eye glow
  ctx.fillStyle = '#dc2626';
  ctx.beginPath();
  ctx.arc(-17, -70, isJumpscare || isGlitch ? 6.5 : 5, 0, Math.PI * 2);
  ctx.arc(17, -70, isJumpscare || isGlitch ? 6.5 : 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(-17, -70, 2.2, 0, Math.PI * 2);
  ctx.arc(17, -70, 2.2, 0, Math.PI * 2);
  ctx.fill();

  //Muzzle & Wide-Open Mouth Cavity (After 1.5s, opens wide and covers nearly the entire screen!)
  const jawOpen =
    mouthCoverPhase > 0
      ? 54 * mouthCoverPhase + 18
      : isJumpscare
      ? 16 + Math.abs(Math.sin(t * 58)) * 10
      : isGlitch
      ? 8
      : 4;

  const mouthHalfW = 30 + mouthCoverPhase * 24;
  const mouthTopY = -50 - mouthCoverPhase * 14;
  const mouthH = 22 + jawOpen;

  // Outer jaw framing
  ctx.fillStyle = '#09090e';
  ctx.strokeStyle = '#3f3f46';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(-mouthHalfW - 6, mouthTopY - 4, (mouthHalfW + 6) * 2, mouthH + 10, 10);
  ctx.fill();
  ctx.stroke();

  // Pitch-black abyssal mouth interior
  ctx.fillStyle = '#020204';
  ctx.beginPath();
  ctx.roundRect(-mouthHalfW, mouthTopY, mouthHalfW * 2, mouthH, 8);
  ctx.fill();
  ctx.strokeStyle = '#991b1b';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Inner metallic endoskeleton throat rings visible when mouth opens wide
  if (mouthCoverPhase > 0.05 || isJumpscare) {
    for (let r = 1; r <= 3; r++) {
      ctx.strokeStyle = `rgba(220, 38, 38, ${0.45 - r * 0.1})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(
        0,
        mouthTopY + mouthH * 0.5,
        mouthHalfW * (1 - r * 0.22),
        (mouthH * 0.45) * (1 - r * 0.22),
        0,
        0,
        Math.PI * 2
      );
      ctx.stroke();
    }
  }

  // Double rows of long razor-sharp Nightmare teeth (top and bottom)
  ctx.fillStyle = '#e4e4e7';
  const toothLen = 11 + mouthCoverPhase * 14;
  const stepX = 7.5;
  for (let x = -mouthHalfW + 4; x <= mouthHalfW - 8; x += stepX) {
    // Upper fang
    ctx.beginPath();
    ctx.moveTo(x, mouthTopY);
    ctx.lineTo(x + 3.2, mouthTopY + toothLen);
    ctx.lineTo(x + 6.4, mouthTopY);
    ctx.closePath();
    ctx.fill();

    // Lower fang
    ctx.beginPath();
    ctx.moveTo(x + 0.5, mouthTopY + mouthH);
    ctx.lineTo(x + 3.2, mouthTopY + mouthH - toothLen);
    ctx.lineTo(x + 6.4, mouthTopY + mouthH);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
  ctx.restore();
}

