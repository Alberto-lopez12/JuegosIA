import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  INTRO_DOOR_ENTER_X,
  INTRO_DOOR_STOP_X,
  INTRO_DRIVING_DIALOGUES,
  INTRO_OUTSIDE_CAR_DIALOGUE,
  INTRO_OUTSIDE_DOOR_DIALOGUE,
  INTRO_OUTSIDE_SPAWN_X,
  IntroDialogueLine,
  IntroMinigamePhase,
  stepIntroWalkPosition,
} from '../game/rules';

interface EightBitIntroMinigameProps {
  onComplete: () => void;
}

export const EightBitIntroMinigame: React.FC<EightBitIntroMinigameProps> = ({ onComplete }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [phase, setPhase] = useState<IntroMinigamePhase>('DRIVING_DIALOGUE');
  const [drivingDialogueIdx, setDrivingDialogueIdx] = useState<number>(0);
  const [typedChars, setTypedChars] = useState<number>(0);

  const phaseRef = useRef<IntroMinigamePhase>(phase);
  phaseRef.current = phase;

  const drivingIdxRef = useRef<number>(drivingDialogueIdx);
  drivingIdxRef.current = drivingDialogueIdx;

  const typedCharsRef = useRef<number>(typedChars);
  typedCharsRef.current = typedChars;

  const simRef = useRef({
    scrollOffset: 0,
    fadeAlpha: 0,
    playerX: INTRO_OUTSIDE_SPAWN_X,
    playerFacing: 1 as -1 | 1,
    walkCycle: 0,
    keysHeld: {
      left: false,
      right: false,
    },
  });

  // Current active dialogue line (if in a dialogue phase)
  const activeDialogue: IntroDialogueLine | null =
    phase === 'DRIVING_DIALOGUE'
      ? INTRO_DRIVING_DIALOGUES[drivingDialogueIdx] || null
      : phase === 'OUTSIDE_EXIT_DIALOGUE'
      ? INTRO_OUTSIDE_CAR_DIALOGUE
      : phase === 'OUTSIDE_DOOR_DIALOGUE'
      ? INTRO_OUTSIDE_DOOR_DIALOGUE
      : null;

  // Typewriter effect for the active 8-bit dialogue line
  useEffect(() => {
    if (!activeDialogue) {
      setTypedChars(0);
      typedCharsRef.current = 0;
      return;
    }
    setTypedChars(0);
    typedCharsRef.current = 0;
    const fullLen = activeDialogue.text.length;
    const interval = window.setInterval(() => {
      setTypedChars((prev) => {
        if (prev >= fullLen) {
          window.clearInterval(interval);
          typedCharsRef.current = fullLen;
          return fullLen;
        }
        const next = prev + 1;
        typedCharsRef.current = next;
        return next;
      });
    }, 22);
    return () => window.clearInterval(interval);
  }, [phase, drivingDialogueIdx, activeDialogue]);

  // Advance dialogue with Enter (or click on the dialogue prompt)
  const handleAdvanceDialogue = useCallback(() => {
    const currentPhase = phaseRef.current;

    if (currentPhase === 'DRIVING_DIALOGUE') {
      const line = INTRO_DRIVING_DIALOGUES[drivingIdxRef.current];
      if (line && typedCharsRef.current < line.text.length) {
        typedCharsRef.current = line.text.length;
        setTypedChars(line.text.length);
        return;
      }
      if (drivingIdxRef.current + 1 < INTRO_DRIVING_DIALOGUES.length) {
        setDrivingDialogueIdx((idx) => idx + 1);
      } else {
        // Fade to black while car continues driving in the central frame
        simRef.current.fadeAlpha = 0;
        setPhase('DRIVING_FADE_OUT');
      }
      return;
    }

    if (currentPhase === 'OUTSIDE_EXIT_DIALOGUE') {
      if (typedCharsRef.current < INTRO_OUTSIDE_CAR_DIALOGUE.text.length) {
        typedCharsRef.current = INTRO_OUTSIDE_CAR_DIALOGUE.text.length;
        setTypedChars(INTRO_OUTSIDE_CAR_DIALOGUE.text.length);
        return;
      }
      setPhase('OUTSIDE_WALK');
      return;
    }

    if (currentPhase === 'OUTSIDE_DOOR_DIALOGUE') {
      if (typedCharsRef.current < INTRO_OUTSIDE_DOOR_DIALOGUE.text.length) {
        typedCharsRef.current = INTRO_OUTSIDE_DOOR_DIALOGUE.text.length;
        setTypedChars(INTRO_OUTSIDE_DOOR_DIALOGUE.text.length);
        return;
      }
      simRef.current.fadeAlpha = 0;
      setPhase('ENTERING_BUILDING_FADE_OUT');
    }
  }, []);

  // Keyboard listener: Enter advances dialogues; A/D or ArrowLeft/ArrowRight walks in OUTSIDE_WALK
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const code = e.code;
      if (code === 'Enter' || code === 'NumpadEnter') {
        e.preventDefault();
        handleAdvanceDialogue();
        return;
      }

      if (code === 'KeyA' || code === 'ArrowLeft') {
        simRef.current.keysHeld.left = true;
      } else if (code === 'KeyD' || code === 'ArrowRight') {
        simRef.current.keysHeld.right = true;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const code = e.code;
      if (code === 'KeyA' || code === 'ArrowLeft') {
        simRef.current.keysHeld.left = false;
      } else if (code === 'KeyD' || code === 'ArrowRight') {
        simRef.current.keysHeld.right = false;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [handleAdvanceDialogue]);

  // Main 8-Bit Canvas Animation & State Loop
  useEffect(() => {
    let raf = 0;
    let lastTime = performance.now();

    const drawPixelRect = (
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      w: number,
      h: number,
      color: string
    ) => {
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(x / 4) * 4, Math.round(y / 4) * 4, Math.round(w / 4) * 4, Math.round(h / 4) * 4);
    };

    const draw8BitPineTree = (ctx: CanvasRenderingContext2D, baseX: number, baseY: number, scale = 1) => {
      const s = 4 * scale;
      // Trunk
      drawPixelRect(ctx, baseX - s * 1.5, baseY - s * 4, s * 3, s * 4, '#3b2314');
      // Layered dark green pixel foliage (classic FNAF / FNAC 3 8-bit style)
      drawPixelRect(ctx, baseX - s * 6, baseY - s * 8, s * 12, s * 4, '#0c2e1c');
      drawPixelRect(ctx, baseX - s * 5, baseY - s * 12, s * 10, s * 4, '#113b25');
      drawPixelRect(ctx, baseX - s * 3.5, baseY - s * 16, s * 7, s * 4, '#164a2f');
      drawPixelRect(ctx, baseX - s * 2, baseY - s * 19, s * 4, s * 3, '#1d5c3b');
    };

    const draw8BitCar = (
      ctx: CanvasRenderingContext2D,
      cx: number,
      cy: number,
      isDriving: boolean,
      timeSec: number,
      hasOccupants: boolean
    ) => {
      const bounceY = isDriving ? (Math.floor(timeSec * 12) % 2) * 4 : 0;
      const y = cy + bounceY;

      // Headlight beam in 8-bit steps
      if (isDriving) {
        drawPixelRect(ctx, cx + 68, y - 4, 96, 28, 'rgba(253, 224, 71, 0.16)');
        drawPixelRect(ctx, cx + 164, y - 12, 120, 44, 'rgba(253, 224, 71, 0.09)');
      } else {
        drawPixelRect(ctx, cx + 68, y + 2, 48, 16, 'rgba(253, 224, 71, 0.08)');
      }

      // Car main chassis (retro purple/crimson 8-bit sedan)
      drawPixelRect(ctx, cx - 72, y - 8, 144, 28, '#581c87');
      drawPixelRect(ctx, cx - 68, y - 4, 136, 20, '#6b21a8');
      // Cabin / roof
      drawPixelRect(ctx, cx - 44, y - 28, 84, 20, '#4c1d95');
      // Windows
      drawPixelRect(ctx, cx - 36, y - 24, 32, 14, '#0f172a');
      drawPixelRect(ctx, cx + 2, y - 24, 32, 14, '#0f172a');

      // 8-Bit Driver & Passenger silhouettes inside the car during driving scene
      if (hasOccupants) {
        // Passenger / Interlocutor (back/left window)
        drawPixelRect(ctx, cx - 26, y - 22, 12, 10, '#38bdf8');
        // Protagonist driving (front/right window)
        drawPixelRect(ctx, cx + 10, y - 22, 12, 10, '#facc15');
      }

      // Headlights & Taillights
      drawPixelRect(ctx, cx + 64, y - 2, 8, 10, '#fde047');
      drawPixelRect(ctx, cx - 72, y - 2, 8, 10, '#ef4444');

      // Wheels (animated spokes when driving)
      const wheelToggle = isDriving && Math.floor(timeSec * 16) % 2 === 1;
      drawPixelRect(ctx, cx - 52, y + 12, 28, 16, '#09090b');
      drawPixelRect(ctx, cx + 24, y + 12, 28, 16, '#09090b');
      drawPixelRect(
        ctx,
        cx - 44,
        y + 16,
        12,
        8,
        wheelToggle ? '#a1a1aa' : '#52525b'
      );
      drawPixelRect(
        ctx,
        cx + 32,
        y + 16,
        12,
        8,
        wheelToggle ? '#52525b' : '#a1a1aa'
      );
    };

    const draw8BitProtagonist = (
      ctx: CanvasRenderingContext2D,
      x: number,
      groundY: number,
      facing: -1 | 1,
      walkPhase: number,
      isWalking: boolean
    ) => {
      const legOffset = isWalking ? (Math.floor(walkPhase * 8) % 2 === 0 ? 4 : -4) : 0;

      // Shadow
      drawPixelRect(ctx, x - 14, groundY - 4, 28, 6, 'rgba(0,0,0,0.55)');

      // Legs
      drawPixelRect(ctx, x - 10, groundY - 24 + (legOffset > 0 ? -4 : 0), 8, 22, '#1e293b');
      drawPixelRect(ctx, x + 2, groundY - 24 + (legOffset < 0 ? -4 : 0), 8, 22, '#0f172a');

      // Security Guard / Protagonist Torso (Jacket)
      drawPixelRect(ctx, x - 12, groundY - 52, 24, 28, '#1e3a8a');
      drawPixelRect(ctx, x - 4, groundY - 48, 8, 20, '#93c5fd'); // Shirt stripe

      // Arms
      drawPixelRect(ctx, x - 16, groundY - 48, 6, 20, '#172554');
      drawPixelRect(ctx, x + 10, groundY - 48, 6, 20, '#172554');

      // Head
      drawPixelRect(ctx, x - 10, groundY - 72, 20, 20, '#fcd34d');
      // Hair / Cap
      drawPixelRect(ctx, x - 12, groundY - 76, 24, 8, '#451a03');
      // Eye facing direction
      if (facing >= 0) {
        drawPixelRect(ctx, x + 4, groundY - 64, 4, 4, '#09090b');
      } else {
        drawPixelRect(ctx, x - 8, groundY - 64, 4, 4, '#09090b');
      }
    };

    const drawRuinedWoodenBuilding = (ctx: CanvasRenderingContext2D, groundY: number) => {
      const bx = 655;
      const bw = 275;
      const bh = 230;
      const by = groundY - bh;

      // Crumbling jagged wooden roof
      drawPixelRect(ctx, bx - 16, by - 24, bw + 32, 24, '#271509');
      // Missing/broken roof chunks for dilapidated look
      drawPixelRect(ctx, bx + 44, by - 28, 36, 12, '#04070d');
      drawPixelRect(ctx, bx + 168, by - 26, 48, 10, '#04070d');

      // Main weathered wooden wall
      drawPixelRect(ctx, bx, by, bw, bh, '#3f220f');

      // Horizontal 8-bit wood planks & dark rot gaps
      for (let py = by + 8; py < groundY - 8; py += 16) {
        drawPixelRect(ctx, bx + 4, py, bw - 8, 4, '#241207');
        // Broken plank holes / rot patches
        const holeOffset = ((py * 17) % 160) + 24;
        drawPixelRect(ctx, bx + holeOffset, py - 4, 28, 8, '#170b04');
      }

      // Crooked decayed wooden sign above entrance ("STILL" / ruined boards)
      drawPixelRect(ctx, bx + 28, by + 20, 156, 32, '#1f1006');
      drawPixelRect(ctx, bx + 32, by + 24, 148, 24, '#542e14');
      // Faded pixel letters on sign
      drawPixelRect(ctx, bx + 44, by + 30, 16, 12, '#a16207');
      drawPixelRect(ctx, bx + 68, by + 30, 16, 12, '#713f12');
      drawPixelRect(ctx, bx + 92, by + 34, 16, 8, '#a16207');
      drawPixelRect(ctx, bx + 116, by + 28, 16, 12, '#713f12');
      drawPixelRect(ctx, bx + 140, by + 32, 20, 10, '#a16207');

      // Boarded-up window on the right side of the facade
      const wx = bx + 150;
      const wy = by + 86;
      drawPixelRect(ctx, wx, wy, 76, 68, '#09090b');
      // Criss-crossed wooden planks nailed over the window
      drawPixelRect(ctx, wx - 6, wy + 12, 88, 12, '#78350f');
      drawPixelRect(ctx, wx - 4, wy + 42, 84, 12, '#65320d');

      // Dark, ominous entrance doorway on the left side of the building (where player walks in)
      const doorX = bx + 28; // 683
      const doorW = 68;
      const doorH = 116;
      const doorY = groundY - doorH;
      // Door frame (splintered wood)
      drawPixelRect(ctx, doorX - 8, doorY - 8, doorW + 16, doorH + 8, '#5c2d10');
      // Pitch-black interior doorway
      drawPixelRect(ctx, doorX, doorY, doorW, doorH, '#030305');
      // Hanging broken board at top of doorway
      drawPixelRect(ctx, doorX + 4, doorY + 4, 44, 10, '#451a03');
    };

    // 8-Bit Rain Renderer for BOTH Scene 1 (driving) and Scene 2 (outside walking to the local)
    const draw8BitRain = (
      ctx: CanvasRenderingContext2D,
      W: number,
      H: number,
      timeSec: number,
      isDrivingScene: boolean
    ) => {
      // Background layer of 8-bit rain streaks
      const backDropCount = 64;
      for (let i = 0; i < backDropCount; i++) {
        const seedX = (i * 137) % W;
        const seedY = (i * 293) % H;
        // In the driving scene, rain slants slightly faster to the left due to car motion
        const driftX = isDrivingScene ? timeSec * 220 : timeSec * 65;
        const fallY = timeSec * 520;
        const rx = (((seedX - driftX) % W) + W) % W;
        const ry = (seedY + fallY) % H;
        drawPixelRect(ctx, rx, ry, 4, 12, 'rgba(56, 189, 248, 0.38)');
      }

      // Foreground layer of bright 8-bit pixel raindrops
      const frontDropCount = 52;
      for (let i = 0; i < frontDropCount; i++) {
        const seedX = (i * 199 + 48) % W;
        const seedY = (i * 317 + 92) % H;
        const driftX = isDrivingScene ? timeSec * 310 : timeSec * 90;
        const fallY = timeSec * 680;
        const rx = (((seedX - driftX) % W) + W) % W;
        const ry = (seedY + fallY) % H;
        drawPixelRect(ctx, rx, ry, 4, 16, 'rgba(147, 197, 253, 0.62)');
        drawPixelRect(ctx, rx, ry + 12, 4, 4, 'rgba(224, 242, 254, 0.8)');
      }

      // 8-Bit Pixel Rain Splashes on the road / ground / roofs
      const splashCount = 26;
      const tickStep = Math.floor(timeSec * 14);
      for (let s = 0; s < splashCount; s++) {
        if ((s + tickStep) % 3 !== 0) continue;
        const sx = ((s * 173 + tickStep * 64) % (W - 32)) + 16;
        const sy = isDrivingScene
          ? 204 + ((s * 47) % 112) // Road surface in Scene 1
          : 364 + ((s * 53) % 56); // Gravel path & puddles in Scene 2
        drawPixelRect(ctx, sx - 4, sy, 4, 4, 'rgba(186, 230, 253, 0.72)');
        drawPixelRect(ctx, sx + 4, sy, 4, 4, 'rgba(186, 230, 253, 0.72)');
        drawPixelRect(ctx, sx, sy - 4, 4, 4, 'rgba(125, 211, 252, 0.55)');
      }
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const sim = simRef.current;
      const currentPhase = phaseRef.current;

      // 1. Update simulation per phase
      if (currentPhase === 'DRIVING_DIALOGUE' || currentPhase === 'DRIVING_FADE_OUT') {
        // Scroll trees & road markings to the left continuously
        sim.scrollOffset = (sim.scrollOffset + dt * 260) % 160;

        if (currentPhase === 'DRIVING_FADE_OUT') {
          sim.fadeAlpha = Math.min(1, sim.fadeAlpha + dt * 0.85);
          if (sim.fadeAlpha >= 1) {
            sim.playerX = INTRO_OUTSIDE_SPAWN_X;
            sim.playerFacing = 1;
            setPhase('OUTSIDE_FADE_IN');
          }
        }
      } else if (currentPhase === 'OUTSIDE_FADE_IN') {
        sim.fadeAlpha = Math.max(0, sim.fadeAlpha - dt * 0.95);
        if (sim.fadeAlpha <= 0) {
          setPhase('OUTSIDE_EXIT_DIALOGUE');
        }
      } else if (currentPhase === 'OUTSIDE_WALK') {
        const moveDir: -1 | 0 | 1 =
          sim.keysHeld.right && !sim.keysHeld.left
            ? 1
            : sim.keysHeld.left && !sim.keysHeld.right
            ? -1
            : 0;

        if (moveDir !== 0) {
          sim.playerFacing = moveDir;
          sim.walkCycle += dt;
          const stepped = stepIntroWalkPosition(sim.playerX, moveDir, dt);
          sim.playerX = stepped.x;

          // Automatically brake right before entering the ruined wooden local!
          if (stepped.reachedDoorStop) {
            sim.keysHeld.left = false;
            sim.keysHeld.right = false;
            setPhase('OUTSIDE_DOOR_DIALOGUE');
          }
        }
      } else if (currentPhase === 'ENTERING_BUILDING_FADE_OUT') {
        // Protagonist walks into the dark doorway while screen fades to black
        sim.walkCycle += dt;
        sim.playerFacing = 1;
        if (sim.playerX < INTRO_DOOR_ENTER_X) {
          sim.playerX = Math.min(INTRO_DOOR_ENTER_X, sim.playerX + dt * 95);
        }
        sim.fadeAlpha = Math.min(1, sim.fadeAlpha + dt * 0.85);
        if (sim.fadeAlpha >= 1) {
          setPhase('COMPLETED');
          onComplete();
          return;
        }
      }

      // 2. Render 8-Bit Scene
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = false;
          const W = canvas.width; // 960
          const H = canvas.height; // 540

          // Base dark night sky
          ctx.fillStyle = '#04070d';
          ctx.fillRect(0, 0, W, H);

          const isDrivingScene =
            currentPhase === 'DRIVING_DIALOGUE' || currentPhase === 'DRIVING_FADE_OUT';

          if (isDrivingScene) {
            // --- SCENE 1: DRIVING ALONG FOREST ROAD (CENTER FRAME) ---
            // Top & bottom forest ground
            drawPixelRect(ctx, 0, 0, W, 196, '#05140d');
            drawPixelRect(ctx, 0, 324, W, H - 324, '#05140d');

            // Highway asphalt in the middle
            drawPixelRect(ctx, 0, 196, W, 128, '#18181b');
            drawPixelRect(ctx, 0, 196, W, 8, '#3f3f46');
            drawPixelRect(ctx, 0, 316, W, 8, '#3f3f46');

            // Looping dashed road line scrolling left
            for (let rx = -160; rx < W + 160; rx += 80) {
              const drawX = rx - (sim.scrollOffset % 80);
              drawPixelRect(ctx, drawX, 256, 40, 8, '#ca8a04');
            }

            // Looping top forest trees scrolling left
            for (let tx = -160; tx < W + 160; tx += 80) {
              const drawX = tx - (sim.scrollOffset % 80);
              draw8BitPineTree(ctx, drawX + 20, 140, 1.0);
              draw8BitPineTree(ctx, drawX + 56, 184, 1.15);
            }

            // Central Car Frame
            draw8BitCar(ctx, W * 0.44, 248, true, now / 1000, true);

            // Looping bottom foreground forest trees scrolling left
            for (let tx = -160; tx < W + 160; tx += 80) {
              const drawX = tx - (sim.scrollOffset % 80);
              draw8BitPineTree(ctx, drawX + 36, 430, 1.25);
            }
          } else {
            // --- SCENE 2: OUTSIDE THE RUINED WOODEN BUILDING ---
            const groundY = 368;

            // Distant 8-bit stars / moon
            drawPixelRect(ctx, 120, 48, 8, 8, '#94a3b8');
            drawPixelRect(ctx, 310, 72, 4, 4, '#64748b');
            drawPixelRect(ctx, 520, 40, 8, 8, '#94a3b8');

            // Background forest treeline
            for (let tx = 40; tx < 640; tx += 76) {
              draw8BitPineTree(ctx, tx, groundY, 1.2);
            }

            // Dirt & gravel path leading to the ruined wooden building
            drawPixelRect(ctx, 0, groundY, W, H - groundY, '#09140e');
            drawPixelRect(ctx, 0, groundY, 740, 36, '#1c1917');
            drawPixelRect(ctx, 40, groundY + 8, 680, 20, '#292524');

            // Dilapidated Wooden Building on the right
            drawRuinedWoodenBuilding(ctx, groundY);

            // Parked Car on the left
            draw8BitCar(ctx, 118, groundY - 12, false, now / 1000, false);

            // Protagonist (exited the car, walking toward the entrance)
            const isWalking =
              (currentPhase === 'OUTSIDE_WALK' &&
                (sim.keysHeld.left || sim.keysHeld.right)) ||
              currentPhase === 'ENTERING_BUILDING_FADE_OUT';

            draw8BitProtagonist(
              ctx,
              sim.playerX,
              groundY + 14,
              sim.playerFacing,
              sim.walkCycle,
              isWalking
            );
          }

          // 8-Bit Rain in BOTH Scene 1 (driving) and Scene 2 (walking to the ruined wooden local)
          draw8BitRain(ctx, W, H, now / 1000, isDrivingScene);

          // Classic FNAF 3 / FNAC 3 CRT Scanlines Overlay
          ctx.fillStyle = 'rgba(0, 0, 0, 0.34)';
          for (let sy = 0; sy < H; sy += 6) {
            ctx.fillRect(0, sy, W, 3);
          }

          // Fade-to-Black / Fade-from-Black Curtain
          if (sim.fadeAlpha > 0) {
            ctx.fillStyle = `rgba(0, 0, 0, ${sim.fadeAlpha.toFixed(3)})`;
            ctx.fillRect(0, 0, W, H);
          }
        }
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onComplete]);

  return (
    <div
      data-testid="eight-bit-intro-minigame"
      data-phase={phase}
      className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center select-none font-mono"
    >
      {/* 8-Bit Viewport Frame */}
      <div className="relative w-full h-full flex items-center justify-center bg-black overflow-hidden">
        <canvas
          ref={canvasRef}
          width={960}
          height={540}
          className="w-full h-full object-contain"
          style={{ imageRendering: 'pixelated' }}
        />

        {/* Walk Prompt Banner during OUTSIDE_WALK */}
        {phase === 'OUTSIDE_WALK' && (
          <div
            data-testid="intro-walk-hud"
            className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-black/90 border-4 border-zinc-300 px-6 py-3 flex flex-col sm:flex-row items-center gap-4 shadow-2xl"
          >
            <div className="text-xs sm:text-sm text-amber-300 font-bold tracking-wider uppercase text-center">
              CAMINA HACIA EL LOCAL DE MADERA [A / D o FLECHAS ◄ ►]
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                data-testid="intro-walk-left-btn"
                onMouseDown={() => {
                  simRef.current.keysHeld.left = true;
                }}
                onMouseUp={() => {
                  simRef.current.keysHeld.left = false;
                }}
                onMouseLeave={() => {
                  simRef.current.keysHeld.left = false;
                }}
                className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border-2 border-zinc-400 text-xs font-bold"
              >
                ◄ IZQ
              </button>
              <button
                type="button"
                data-testid="intro-walk-right-btn"
                onMouseDown={() => {
                  simRef.current.keysHeld.right = true;
                }}
                onMouseUp={() => {
                  simRef.current.keysHeld.right = false;
                }}
                onMouseLeave={() => {
                  simRef.current.keysHeld.right = false;
                }}
                onClick={() => {
                  // Also allow single click step or fast-walk for testing convenience
                  const stepped = stepIntroWalkPosition(
                    simRef.current.playerX,
                    1,
                    0.45
                  );
                  simRef.current.playerX = stepped.x;
                  if (stepped.reachedDoorStop) {
                    simRef.current.keysHeld.right = false;
                    setPhase('OUTSIDE_DOOR_DIALOGUE');
                  }
                }}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black border-2 border-white text-xs font-bold"
              >
                CAMINAR ►
              </button>
            </div>
          </div>
        )}

        {/* Retro 8-Bit Dialogue Box */}
        {activeDialogue && (
          <div
            data-testid="intro-dialogue-box"
            onClick={handleAdvanceDialogue}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[80vw] max-w-[80vw] bg-black/95 border-4 border-white p-5 sm:p-6 shadow-2xl cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <span
                className="text-xs sm:text-sm font-bold tracking-widest uppercase"
                style={{ color: activeDialogue.speakerColor }}
              >
                [{activeDialogue.speaker}]
              </span>
              <span className="text-[11px] text-zinc-400 uppercase tracking-widest">
                MINIJUEGO 8-BIT
              </span>
            </div>

            <p
              data-testid="intro-dialogue-text"
              className="text-base sm:text-xl text-white font-bold leading-relaxed min-h-[3.5rem]"
            >
              “{activeDialogue.text.slice(0, typedChars)}”
            </p>

            <div className="mt-3 flex items-center justify-end">
              <button
                type="button"
                data-testid="intro-dialogue-enter-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAdvanceDialogue();
                }}
                className="px-3 py-1 bg-zinc-900 hover:bg-zinc-800 border-2 border-amber-400 text-amber-300 text-xs font-bold uppercase tracking-wider animate-pulse"
              >
                PULSA [ENTER] PARA CONTINUAR ▶
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
