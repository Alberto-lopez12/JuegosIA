import React, { useEffect, useRef, useState } from 'react';
import { CampaignProgress, isExtraNightsSectionUnlocked } from '../game/rules';
import { drawAnimatronic } from '../game/animatronicsRenderer';
import { soundController } from '../game/audio';

interface Props {
  progress: CampaignProgress;
  onNewGame: () => void;
  onContinueGame: () => void;
  onOpenExtras: () => void;
  onResetProgress: () => void;
}

export const TitleScreen: React.FC<Props> = ({
  progress,
  onNewGame,
  onContinueGame,
  onOpenExtras,
  onResetProgress,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // 3-second hold-to-reset progress state
  const [holdPercent, setHoldPercent] = useState<number>(0);
  const [justReset, setJustReset] = useState<boolean>(false);
  const holdRafRef = useRef<number | null>(null);
  const holdStartRef = useRef<number | null>(null);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFullscreen = () => {
    soundController.playWoodClick();
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const stopHoldReset = () => {
    if (holdRafRef.current !== null) {
      cancelAnimationFrame(holdRafRef.current);
      holdRafRef.current = null;
    }
    holdStartRef.current = null;
    setHoldPercent(0);
  };

  const startHoldReset = () => {
    soundController.playWoodClick();
    stopHoldReset();
    setJustReset(false);
    holdStartRef.current = performance.now();

    const tickHold = (now: number) => {
      if (holdStartRef.current === null) return;
      const elapsedMs = now - holdStartRef.current;
      const pct = Math.min(100, (elapsedMs / 3000) * 100);
      setHoldPercent(pct);

      if (elapsedMs >= 3000) {
        stopHoldReset();
        soundController.playHeavyGlitchTransition();
        onResetProgress();
        setJustReset(true);
        window.setTimeout(() => setJustReset(false), 2200);
        return;
      }
      holdRafRef.current = requestAnimationFrame(tickHold);
    };

    holdRafRef.current = requestAnimationFrame(tickHold);
  };

  useEffect(() => {
    return () => {
      if (holdRafRef.current !== null) {
        cancelAnimationFrame(holdRafRef.current);
      }
    };
  }, []);

  // Main Menu Stage Showcase:
  // Keep exact independent glitch timings:
  // - Still Freddy: every 3 to 5 seconds (3.0 + Math.random() * 2.0)
  // - Still Bonnie: every 3 to 7 seconds (3.0 + Math.random() * 4.0)
  // - Still Chica: fastest, every 2 to 5 seconds (2.0 + Math.random() * 3.0)
  useEffect(() => {
    let raf = 0;
    const start = performance.now();

    let nextFreddyGlitch = 3.0 + Math.random() * 2.0;
    let endFreddyGlitch = 0;

    let nextBonnieGlitch = 3.0 + Math.random() * 4.0;
    let endBonnieGlitch = 0;

    let nextChicaGlitch = 2.0 + Math.random() * 3.0;
    let endChicaGlitch = 0;

    // Independent remnant static glitch bursts ("que la estatica tambien tenga glitcheos en los que haya mas estatica de lo habitual pero sin que sea nada loco")
    let nextStaticGlitch = 2.4 + Math.random() * 3.2;
    let endStaticGlitch = 0;

    const loop = (now: number) => {
      const canvas = canvasRef.current;
      if (canvas) {
        // Sync canvas resolution to actual viewport so fullscreen never distorts or shifts positions left
        const targetW = window.innerWidth || 1440;
        const targetH = window.innerHeight || 900;
        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW;
          canvas.height = targetH;
        }

        const ctx = canvas.getContext('2d');
        if (ctx) {
          const w = canvas.width;
          const h = canvas.height;
          const t = (now - start) / 1000;
          const responsiveScale = Math.min(w / 1440, h / 900);

          // Independent Freddy glitch check (3-5s)
          if (t >= nextFreddyGlitch) {
            endFreddyGlitch = t + 0.34;
            nextFreddyGlitch = t + 3.0 + Math.random() * 2.0;
          }
          // Independent Bonnie glitch check (3-7s)
          if (t >= nextBonnieGlitch) {
            endBonnieGlitch = t + 0.34;
            nextBonnieGlitch = t + 3.0 + Math.random() * 4.0;
          }
          // Independent Chica glitch check (2-5s, the fastest!)
          if (t >= nextChicaGlitch) {
            endChicaGlitch = t + 0.34;
            nextChicaGlitch = t + 2.0 + Math.random() * 3.0;
          }
          // Independent Static glitch check (2.4-5.6s)
          if (t >= nextStaticGlitch) {
            endStaticGlitch = t + 0.28;
            nextStaticGlitch = t + 2.4 + Math.random() * 3.2;
          }

          const freddyGlitchAmt = t < endFreddyGlitch ? 1 : 0;
          const bonnieGlitchAmt = t < endBonnieGlitch ? 1 : 0;
          const chicaGlitchAmt = t < endChicaGlitch ? 1 : 0;
          const staticGlitchActive = t < endStaticGlitch;
          const anyGlitching =
            freddyGlitchAmt > 0 || bonnieGlitchAmt > 0 || chicaGlitchAmt > 0;

          ctx.clearRect(0, 0, w, h);

          // Atmospheric dark security stage background centered on the right-side animatronic trio
          const bg = ctx.createRadialGradient(
            w * 0.69,
            h * 0.56,
            40 * responsiveScale,
            w * 0.69,
            h * 0.56,
            w * 0.58
          );
          bg.addColorStop(0, anyGlitching ? '#4c111d' : '#38141d');
          bg.addColorStop(0.58, '#13131c');
          bg.addColorStop(1, '#040407');
          ctx.fillStyle = bg;
          ctx.fillRect(0, 0, w, h);

          // Left of trio: Still Bonnie (3-7s independent glitch)
          drawAnimatronic(
            ctx,
            'bonnie',
            w * 0.50,
            h * 0.63,
            1.95 * responsiveScale,
            t,
            false,
            bonnieGlitchAmt
          );

          // Right of trio: Still Chica (2-5s fastest independent glitch)
          drawAnimatronic(
            ctx,
            'chica',
            w * 0.87,
            h * 0.63,
            1.95 * responsiveScale,
            t,
            false,
            chicaGlitchAmt
          );

          // Center Front of trio: Still Freddy (3-5s independent glitch, largest centerpiece)
          drawAnimatronic(
            ctx,
            'freddy',
            w * 0.69,
            h * 0.60,
            2.28 * responsiveScale,
            t,
            false,
            freddyGlitchAmt
          );

          // Subtle CRT scanlines
          ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
          for (let y = 0; y < h; y += 4) {
            ctx.fillRect(0, y, w, 1.5);
          }

          // Remnant VHS / Security Monitor Static with periodic moderate static glitches
          const trackingY = ((t * 55) % (h + 120)) - 60;
          const trackGrad = ctx.createLinearGradient(0, trackingY - 28, 0, trackingY + 28);
          trackGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
          trackGrad.addColorStop(
            0.5,
            staticGlitchActive ? 'rgba(255, 255, 255, 0.085)' : 'rgba(255, 255, 255, 0.035)'
          );
          trackGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
          ctx.fillStyle = trackGrad;
          ctx.fillRect(0, trackingY - 28, w, 56);

          // Extra horizontal static glitch bands when staticGlitchActive triggers (noticeable but not excessive)
          if (staticGlitchActive) {
            for (let b = 0; b < 3; b++) {
              const bandY = Math.random() * h;
              const bandH = 6 + Math.random() * 18;
              ctx.fillStyle = `rgba(244, 244, 245, ${0.055 + Math.random() * 0.065})`;
              ctx.fillRect(0, bandY, w, bandH);
            }
          }

          // Static snow flecks (more flecks & slightly higher opacity during a static glitch burst)
          const snowCount = staticGlitchActive ? 115 : 42;
          for (let i = 0; i < snowCount; i++) {
            const sx = Math.random() * w;
            const sy = Math.random() * h;
            const sw = (staticGlitchActive ? 12 : 6) + Math.random() * (staticGlitchActive ? 48 : 28);
            const sh = 1 + Math.random() * (staticGlitchActive ? 2.4 : 1.8);
            const alpha = staticGlitchActive
              ? 0.06 + Math.random() * 0.11
              : 0.03 + Math.random() * 0.055;
            ctx.fillStyle = `rgba(244, 244, 245, ${alpha})`;
            ctx.fillRect(sx, sy, sw, sh);
          }
        }
      }
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const extraNightsVisible = isExtraNightsSectionUnlocked(progress.highestNightCompleted);
  const remainingHoldSec = Math.max(0, (3 * (100 - holdPercent)) / 100).toFixed(1);

  const renderBurnedWoodTexture = (variant: 'ember' | 'charred' | 'locked' = 'charred') => {
    const baseTop =
      variant === 'ember' ? '#2c1008' : variant === 'locked' ? '#120b08' : '#1f0d07';
    const baseMid =
      variant === 'ember' ? '#1f0a05' : variant === 'locked' ? '#0d0806' : '#160905';
    const baseBot =
      variant === 'ember' ? '#260d06' : variant === 'locked' ? '#100907' : '#1b0b06';
    const grainStroke =
      variant === 'ember' ? '#5c2010' : variant === 'locked' ? '#241712' : '#3d190c';
    const crackStroke = '#070302';

    return (
      <svg
        viewBox="0 0 440 68"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full pointer-events-none"
        aria-hidden="true"
      >
        {/* Charred/Burned Wood Planks */}
        <rect x="0" y="0" width="440" height="23" fill={baseTop} />
        <rect x="0" y="23" width="440" height="22" fill={baseMid} />
        <rect x="0" y="45" width="440" height="23" fill={baseBot} />

        {/* Burned Wood Grain & Scorch Streaks */}
        <path
          d="M0 6 Q 90 2, 190 8 T 440 5 M0 15 Q 110 19, 240 12 T 440 16 M0 30 Q 120 26, 260 33 T 440 29 M0 39 Q 95 43, 210 36 T 440 40 M0 52 Q 130 48, 280 55 T 440 51 M0 61 Q 100 65, 230 58 T 440 62"
          stroke={grainStroke}
          strokeWidth="2"
          fill="none"
          opacity="0.85"
        />
        {/* Carbonized Black Scorch Patches & Plank Seams */}
        <line x1="0" y1="23" x2="440" y2="23" stroke={crackStroke} strokeWidth="2.2" />
        <line x1="0" y1="45" x2="440" y2="45" stroke={crackStroke} strokeWidth="2.2" />
        <path
          d="M58 0 L66 14 L59 23 L70 38 L62 68 M245 0 L238 18 L249 34 L240 49 L251 68 M374 0 L382 21 L371 42 L380 68"
          stroke={crackStroke}
          strokeWidth="2.4"
          fill="none"
          opacity="0.9"
        />
        {/* Charred Wood Knots */}
        <ellipse
          cx="142"
          cy="12"
          rx="14"
          ry="4.5"
          fill="#090402"
          stroke={grainStroke}
          strokeWidth="1.2"
        />
        <ellipse
          cx="318"
          cy="34"
          rx="16"
          ry="5"
          fill="#090402"
          stroke={grainStroke}
          strokeWidth="1.2"
        />
        {/* Scorched Corner Iron Nails */}
        <circle cx="12" cy="11" r="2.5" fill="#0c0a09" stroke="#44403c" strokeWidth="1" />
        <circle cx="12" cy="57" r="2.5" fill="#0c0a09" stroke="#44403c" strokeWidth="1" />
        <circle cx="428" cy="11" r="2.5" fill="#0c0a09" stroke="#44403c" strokeWidth="1" />
        <circle cx="428" cy="57" r="2.5" fill="#0c0a09" stroke="#44403c" strokeWidth="1" />
      </svg>
    );
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-zinc-950 select-none">
      {/* Full-bleed responsive background canvas */}
      <canvas
        ref={canvasRef}
        width={1440}
        height={900}
        className="absolute inset-0 w-full h-full block pointer-events-none"
      />

      {/* Left-third negative space gradient scrim for crisp typography */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/75 to-transparent pointer-events-none" />

      {/* Full-width Title Content Container (anchored cleanly in both windowed & fullscreen modes) */}
      <div className="relative z-10 w-full h-full px-8 sm:px-14 lg:px-20 py-7 flex flex-col justify-between">
        {/* Top Full-Width Unboxed Header: STILL NIGHTS with Solid Wood Inside Every Letter + Moderate Distressed Grain */}
        <header className="w-full pt-1 pointer-events-none">
          <div data-testid="main-menu-title" className="w-full">
            <svg
              viewBox="-20 -10 1240 165"
              className="w-full h-auto max-h-[135px] drop-shadow-[0_10px_28px_rgba(0,0,0,0.95)]"
              aria-label="STILL NIGHTS"
            >
              <defs>
                {/* Solid Warm Oak & Cedar Wood Plank Pattern (Fills 100% of every letter so there is plenty of wood) */}
                <pattern
                  id="solid-wood-plank-pattern"
                  width="260"
                  height="66"
                  patternUnits="userSpaceOnUse"
                >
                  {/* Solid Warm Wood Planks */}
                  <rect x="0" y="0" width="260" height="22" fill="#9a4416" />
                  <rect x="0" y="22" width="260" height="22" fill="#883a11" />
                  <rect x="0" y="44" width="260" height="22" fill="#934014" />

                  {/* Warm Woodgrain Highlights */}
                  <path
                    d="M0 5 Q 65 2, 130 7 T 260 5 M0 14 Q 75 18, 150 11 T 260 15 M0 28 Q 85 24, 170 30 T 260 27 M0 37 Q 55 41, 140 34 T 260 38 M0 51 Q 95 47, 185 54 T 260 50 M0 59 Q 70 63, 155 57 T 260 61"
                    stroke="#cc6428"
                    strokeWidth="2.5"
                    fill="none"
                  />
                  {/* Deep Wood Fiber Lines */}
                  <path
                    d="M0 9 Q 95 12, 190 8 T 260 10 M0 19 Q 50 16, 120 20 T 260 18 M0 33 Q 105 37, 205 31 T 260 34 M0 55 Q 80 52, 165 58 T 260 55"
                    stroke="#4a1c07"
                    strokeWidth="2"
                    fill="none"
                  />

                  {/* Wood Knots */}
                  <ellipse
                    cx="74"
                    cy="11"
                    rx="14"
                    ry="5"
                    fill="#5c2309"
                    stroke="#c25e24"
                    strokeWidth="1.4"
                  />
                  <ellipse
                    cx="192"
                    cy="33"
                    rx="16"
                    ry="5.5"
                    fill="#4a1c07"
                    stroke="#b4531f"
                    strokeWidth="1.4"
                  />
                  <ellipse
                    cx="124"
                    cy="55"
                    rx="13"
                    ry="4.5"
                    fill="#5c2309"
                    stroke="#c25e24"
                    strokeWidth="1.4"
                  />

                  {/* Plank Seams */}
                  <line x1="0" y1="22" x2="260" y2="22" stroke="#2e1003" strokeWidth="2.2" />
                  <line x1="0" y1="44" x2="260" y2="44" stroke="#2e1003" strokeWidth="2.2" />

                  {/* Moderate Wood Cracks & Iron Nails */}
                  <path
                    d="M42 0 L47 14 L40 22 L49 38 L43 66 M168 0 L162 18 L171 35 L164 66"
                    stroke="#290f03"
                    strokeWidth="2.2"
                    fill="none"
                  />
                  <circle cx="16" cy="11" r="2.6" fill="#1c1917" stroke="#57534e" strokeWidth="1" />
                  <circle cx="16" cy="33" r="2.6" fill="#1c1917" stroke="#57534e" strokeWidth="1" />
                  <circle cx="142" cy="11" r="2.6" fill="#1c1917" stroke="#57534e" strokeWidth="1" />
                  <circle cx="244" cy="55" r="2.6" fill="#1c1917" stroke="#57534e" strokeWidth="1" />
                </pattern>

                {/* Darker Solid Wood Backing Pattern (fills all internal holes of Rubik Dirt so every letter is solid wood) */}
                <pattern
                  id="weathered-bark-overlay"
                  width="260"
                  height="66"
                  patternUnits="userSpaceOnUse"
                >
                  <rect x="0" y="0" width="260" height="22" fill="#5c2309" />
                  <rect x="0" y="22" width="260" height="22" fill="#4a1c07" />
                  <rect x="0" y="44" width="260" height="22" fill="#542008" />
                  <path
                    d="M0 10 Q 80 4, 160 12 T 260 8 M0 30 Q 70 36, 150 27 T 260 32 M0 52 Q 90 46, 180 56 T 260 51"
                    stroke="#7c310e"
                    strokeWidth="2.4"
                    fill="none"
                  />
                  <line x1="0" y1="22" x2="260" y2="22" stroke="#240b02" strokeWidth="2" />
                  <line x1="0" y1="44" x2="260" y2="44" stroke="#240b02" strokeWidth="2" />
                </pattern>

                {/* 3D Carved Wood Drop Shadow (crisp and tight so letter counters stay completely open) */}
                <filter id="wood-carve-shadow" x="-5%" y="-10%" width="110%" height="130%">
                  <feDropShadow dx="0" dy="2.5" stdDeviation="0" floodColor="#140601" />
                  <feDropShadow dx="0" dy="4" stdDeviation="3.5" floodColor="rgba(185,28,28,0.28)" />
                </filter>

                {/* Half-Destroyed Mask: uses exact measured glyph coordinates to carve open S & G counters and missing wood chunks */}
                <mask id="half-destroyed-title-mask">
                  <rect x="-20" y="-10" width="1240" height="175" fill="white" />
                  <g fill="black" stroke="black" strokeLinejoin="round" strokeLinecap="round">
                    {/* Ending 2 Left Top Star (centered at x: 28, y: 38) half-destroyed Rubik Dirt splinter notches */}
                    <polygon points="16,27 22,30 18,35" />
                    <polygon points="39,43 45,49 37,51" />
                    <circle cx="25" cy="37" r="1.5" />
                    <circle cx="32" cy="33" r="1.2" />
                    <circle cx="29" cy="43" r="1.4" />

                    {/* Good Ending 1 Left Bottom Star (centered at x: 28, y: 98) half-destroyed Rubik Dirt splinter notches */}
                    <polygon points="16,87 22,90 18,95" />
                    <polygon points="39,103 45,109 37,111" />
                    <circle cx="25" cy="97" r="1.5" />
                    <circle cx="32" cy="93" r="1.2" />
                    <circle cx="29" cy="103" r="1.4" />

                    {/* Left 'S' (x: 84..164): open upper-right and lower-left counters so S is 100% clear */}
                    <polygon points="116,52 168,49 168,65 116,63" />
                    <polygon points="80,82 132,84 132,96 80,99" />
                    {/* Left 'S' half-destroyed splinter notches */}
                    <polygon points="98,32 110,32 104,47" />
                    <polygon points="138,100 150,115 132,115" />

                    {/* 'T' (x: 181..260) half-destroyed splinter notches */}
                    <polygon points="196,32 210,32 203,49" />
                    <polygon points="228,72 246,79 228,86" />

                    {/* 'I' (x: 276..318) half-destroyed splinter notch */}
                    <polygon points="274,64 294,71 274,78" />

                    {/* First 'L' (x: 336..408) half-destroyed splinter notches */}
                    <polygon points="334,52 356,59 334,66" />
                    <polygon points="376,97 390,115 370,115" />

                    {/* Second 'L' (x: 425..495) half-destroyed splinter notches */}
                    <polygon points="423,70 445,77 423,84" />
                    <polygon points="464,97 478,115 458,115" />

                    {/* 'N' (x: 551..636) half-destroyed splinter notches */}
                    <polygon points="549,58 571,65 549,72" />
                    <polygon points="614,44 638,51 614,58" />

                    {/* Second 'I' (x: 654..696) half-destroyed splinter notch */}
                    <polygon points="676,68 698,75 676,82" />

                    {/* 'G' (x: 714..800): open inner C-bowl and upper-right throat gap above the G crossbar */}
                    <polygon points="748,52 804,50 804,68 748,67" />
                    <polygon points="740,50 762,50 762,94 740,94" />
                    <polygon points="755,84 772,84 772,96 755,96" />
                    {/* 'G' half-destroyed splinter notches */}
                    <polygon points="714,52 732,59 714,66" />
                    <polygon points="750,101 764,115 744,115" />

                    {/* 'H' (x: 817..905) half-destroyed splinter notches */}
                    <polygon points="815,52 838,59 815,66" />
                    <polygon points="882,80 906,87 882,94" />

                    {/* Second 'T' (x: 923..1000) half-destroyed splinter notches */}
                    <polygon points="942,32 956,32 949,49" />
                    <polygon points="968,72 986,79 968,86" />

                    {/* Right 'S' (x: 1018..1098): open upper-right and lower-left counters so S is 100% clear */}
                    <polygon points="1050,52 1102,49 1102,65 1050,63" />
                    <polygon points="1014,82 1066,84 1066,96 1014,99" />
                    {/* Right 'S' half-destroyed splinter notches */}
                    <polygon points="1032,32 1044,32 1038,47" />
                    <polygon points="1072,100 1084,115 1066,115" />
                  </g>
                </mask>
              </defs>

              <g filter="url(#wood-carve-shadow)" mask="url(#half-destroyed-title-mask)">
                {/* Ending 2 Star (Post-Night 5 No-Documents Sacrifice Ending): Positioned on the left side directly ABOVE the previous left star ("añade una estreña en la parte izquierda pero por encima de la anterior") */}
                {progress.ending2Unlocked && (
                  <g data-testid="ending-2-wood-star">
                    <polygon
                      points="28,10 36,29 56,29 40,41 46,61 28,49 10,61 16,41 0,29 20,29"
                      fill="none"
                      stroke="#1f0a02"
                      strokeWidth="3.2"
                      strokeLinejoin="round"
                    />
                    <polygon
                      points="28,10 36,29 56,29 40,41 46,61 28,49 10,61 16,41 0,29 20,29"
                      fill="url(#solid-wood-plank-pattern)"
                      stroke="#1f0a02"
                      strokeWidth="1.6"
                      strokeLinejoin="round"
                    />
                  </g>
                )}

                {/* Good Ending 1 Star: Rendered on the left side with the exact same wooden-plank texture, bevel, and half-destroyed Rubik Dirt style as the game title ("una estrella con el mismo tipo de tipografía que el titulo del juego") */}
                {progress.ending1Unlocked && (
                  <g data-testid="good-ending-wood-star">
                    <polygon
                      points="28,70 36,89 56,89 40,101 46,121 28,109 10,121 16,101 0,89 20,89"
                      fill="none"
                      stroke="#1f0a02"
                      strokeWidth="3.2"
                      strokeLinejoin="round"
                    />
                    <polygon
                      points="28,70 36,89 56,89 40,101 46,121 28,109 10,121 16,101 0,89 20,89"
                      fill="url(#solid-wood-plank-pattern)"
                      stroke="#1f0a02"
                      strokeWidth="1.6"
                      strokeLinejoin="round"
                    />
                  </g>
                )}

                {/* Thin dark outer wood bevel BEHIND the letters so the wood planks inside stay bright and unobstructed */}
                <text
                  x="600"
                  y="114"
                  textAnchor="middle"
                  fill="none"
                  stroke="#1f0a02"
                  strokeWidth="2.0"
                  strokeLinejoin="round"
                  paintOrder="stroke fill"
                  fontFamily="'Rubik Dirt', 'Barlow Condensed', sans-serif"
                  fontSize="114"
                  letterSpacing="18"
                >
                  STILL NIGHTS
                </text>

                {/* Half-Destroyed Wood Plank Surface: stroke="none" keeps wood planks warm and bright while Rubik Dirt's natural holes + mask splinters create a true half-destroyed look */}
                <text
                  x="600"
                  y="114"
                  textAnchor="middle"
                  fill="url(#solid-wood-plank-pattern)"
                  stroke="none"
                  fontFamily="'Rubik Dirt', 'Barlow Condensed', sans-serif"
                  fontSize="114"
                  letterSpacing="18"
                >
                  STILL NIGHTS
                </text>
              </g>

              {/* Bad Ending 2 Trophy Star (Post-Night 4 No-Documents route): Black star with a white outline positioned directly ABOVE the first Bad Ending star ("otra estrella negra con contorno blanco que debe situarse por encima que la del anterior bad ending") */}
              {progress.badEnding2Unlocked && (
                <g
                  data-testid="bad-ending-2-black-star"
                  transform="translate(1148, 38) scale(0.82)"
                  className="drop-shadow-[0_0_12px_rgba(244,244,245,0.55)]"
                >
                  <polygon
                    points="0,-34 9.5,-11 34,-11 14.5,4 22,28 0,13.5 -22,28 -14.5,4 -34,-11 -9.5,-11"
                    fill="#050508"
                    stroke="#f4f4f5"
                    strokeWidth="3.8"
                    strokeLinejoin="round"
                  />
                </g>
              )}

              {/* Bad Ending 1 Trophy Star (Post-Night 5 Ending 1 QTE fail): Black star with a light outline right next to the 'S' ("una estrella negra con contorno claro justo al lado de la S") */}
              {progress.badEnding1Unlocked && (
                <g
                  data-testid="bad-ending-black-star"
                  transform="translate(1148, 98) scale(0.82)"
                  className="drop-shadow-[0_0_12px_rgba(244,244,245,0.55)]"
                >
                  <polygon
                    points="0,-34 9.5,-11 34,-11 14.5,4 22,28 0,13.5 -22,28 -14.5,4 -34,-11 -9.5,-11"
                    fill="#050508"
                    stroke="#f4f4f5"
                    strokeWidth="3.8"
                    strokeLinejoin="round"
                  />
                </g>
              )}
            </svg>
          </div>
          <div className="w-full flex items-center justify-center gap-4 mt-0.5">
            <span className="h-[1px] flex-1 max-w-[260px] bg-gradient-to-r from-transparent via-amber-800/80 to-red-700" />
            <p className="font-mono text-xs sm:text-sm font-semibold tracking-[0.42em] text-red-500 uppercase">
              FACILITY 87 · FNAF FANGAME
            </p>
            <span className="h-[1px] flex-1 max-w-[260px] bg-gradient-to-l from-transparent via-amber-800/80 to-red-700" />
          </div>
        </header>

        {/* Classic FNAF Main Menu Stack with Burned Wood Texture ("textura quemada"), Hover Lift & Wood Audio */}
        <div className="w-full max-w-[440px] space-y-3.5 my-auto py-4">
          {/* 1. Nueva Partida */}
          <button
            type="button"
            data-start="true"
            data-menu-exit="true"
            data-testid="new-game-btn"
            onMouseEnter={() => soundController.playWoodHover()}
            onPointerDown={() => soundController.stopMenuMusic()}
            onClick={() => {
              soundController.stopMenuMusic();
              soundController.playWoodClick();
              if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen?.().catch(() => {});
              }
              onNewGame();
            }}
            className="group relative overflow-hidden w-full px-7 py-4 text-left text-2xl font-bold tracking-wider uppercase font-['Barlow_Condensed'] text-amber-50 rounded-xl shadow-[0_8px_20px_rgba(0,0,0,0.85),inset_0_1px_1px_rgba(251,146,60,0.25)] border-2 border-red-900/90 hover:border-amber-600/90 transition-all duration-150 ease-out hover:-translate-y-1.5 flex items-center justify-between cursor-pointer"
          >
            {renderBurnedWoodTexture('ember')}
            <div className="absolute inset-0 bg-gradient-to-r from-red-950/35 via-transparent to-black/45 group-hover:from-amber-900/25 pointer-events-none transition-colors" />
            <span className="relative z-10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)] tracking-[0.1em]">
              Nueva Partida
            </span>
            <span className="relative z-10 text-xs font-mono font-semibold text-amber-300 drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]">
              Noche 1
            </span>
          </button>

          {/* 2. Continuar (Locked if a New Game hasn't been started yet) */}
          <button
            type="button"
            data-menu-exit="true"
            data-testid="continue-game-btn"
            disabled={!progress.hasStartedNewGame}
            onMouseEnter={() => {
              if (progress.hasStartedNewGame) {
                soundController.playWoodHover();
              }
            }}
            onPointerDown={() => {
              if (progress.hasStartedNewGame) {
                soundController.stopMenuMusic();
              }
            }}
            onClick={() => {
              if (progress.hasStartedNewGame) {
                soundController.stopMenuMusic();
                soundController.playWoodClick();
                onContinueGame();
              }
            }}
            className={`group relative overflow-hidden w-full px-7 py-4 text-left text-2xl font-bold tracking-wider uppercase font-['Barlow_Condensed'] rounded-xl border-2 transition-all duration-150 ease-out flex items-center justify-between ${
              progress.hasStartedNewGame
                ? 'text-amber-50 border-amber-950/90 hover:border-amber-700/80 shadow-[0_8px_20px_rgba(0,0,0,0.85)] hover:-translate-y-1.5 cursor-pointer'
                : 'text-zinc-600 border-zinc-900/80 opacity-75 cursor-not-allowed'
            }`}
          >
            {renderBurnedWoodTexture(progress.hasStartedNewGame ? 'charred' : 'locked')}
            <span className="relative z-10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)] tracking-[0.1em]">
              Continuar
            </span>
            <span className="relative z-10 text-xs font-mono font-semibold drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]">
              {progress.hasStartedNewGame
                ? `Noche ${progress.currentCampaignNight}`
                : 'BLOQUEADO'}
            </span>
          </button>

          {/* 3. Extras (Only shows Expedientes until Night 5 is beaten; then reveals Noches Extra) */}
          <button
            type="button"
            data-testid="extras-btn"
            onMouseEnter={() => soundController.playWoodHover()}
            onClick={() => {
              soundController.playWoodClick();
              onOpenExtras();
            }}
            className="group relative overflow-hidden w-full px-7 py-3.5 text-left text-xl font-bold tracking-wider uppercase font-['Barlow_Condensed'] text-amber-50 border-2 border-amber-950/90 hover:border-amber-700/80 rounded-xl shadow-[0_8px_20px_rgba(0,0,0,0.85)] transition-all duration-150 ease-out hover:-translate-y-1.5 flex items-center justify-between cursor-pointer"
          >
            {renderBurnedWoodTexture('charred')}
            <span className="relative z-10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)] tracking-[0.1em]">
              Extras
            </span>
            <span className="relative z-10 text-xs font-mono font-semibold text-amber-400 drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]">
              {extraNightsVisible ? 'Noches Extra · Expedientes' : 'Expedientes'}
            </span>
          </button>

          {/* 4. Row with Pantalla Completa + Small 3-Second Hold Reset Progress Button */}
          <div className="flex items-stretch gap-2.5">
            <button
              type="button"
              data-testid="fullscreen-btn"
              onMouseEnter={() => soundController.playWoodHover()}
              onClick={toggleFullscreen}
              className="group relative overflow-hidden flex-1 px-5 py-3 text-left text-sm font-mono font-semibold text-amber-100/90 border-2 border-amber-950/85 hover:border-amber-700/80 rounded-xl shadow-[0_6px_16px_rgba(0,0,0,0.85)] transition-all duration-150 ease-out hover:-translate-y-1.5 flex items-center justify-between cursor-pointer"
            >
              {renderBurnedWoodTexture('charred')}
              <span className="relative z-10 drop-shadow-[0_2px_3px_rgba(0,0,0,0.95)]">
                {isFullscreen ? 'Salir Pantalla Completa' : 'Pantalla Completa'}
              </span>
              <span className="relative z-10 text-xs text-amber-500/80">[F11]</span>
            </button>

            {/* Small Hold-3-Seconds Button to Delete Saved Progress */}
            <button
              type="button"
              data-testid="reset-progress-btn"
              onMouseEnter={() => soundController.playWoodHover()}
              onMouseDown={startHoldReset}
              onMouseUp={stopHoldReset}
              onMouseLeave={stopHoldReset}
              onTouchStart={(e) => {
                e.preventDefault();
                startHoldReset();
              }}
              onTouchEnd={stopHoldReset}
              onTouchCancel={stopHoldReset}
              title="Mantén pulsado 3 segundos para borrar todos los datos de guardado"
              className="group relative overflow-hidden px-3.5 py-2.5 text-xs font-mono font-semibold text-amber-200/80 hover:text-red-300 border-2 border-amber-950/85 hover:border-red-800/80 rounded-xl shadow-[0_6px_16px_rgba(0,0,0,0.85)] transition-all duration-150 ease-out hover:-translate-y-1.5 shrink-0 flex flex-col items-center justify-center min-w-[138px] cursor-pointer"
            >
              {renderBurnedWoodTexture('charred')}
              {/* Red progress bar fill during 3-second hold */}
              {holdPercent > 0 && (
                <div
                  className="absolute inset-y-0 left-0 bg-red-800/75 pointer-events-none z-10"
                  style={{ width: `${holdPercent}%` }}
                />
              )}
              <span className="relative z-20 leading-tight drop-shadow-[0_2px_3px_rgba(0,0,0,0.95)]">
                {justReset
                  ? '¡Datos Borrados!'
                  : holdPercent > 0
                  ? `Borrando (${remainingHoldSec}s)`
                  : 'Borrar Progreso'}
              </span>
              <span className="relative z-20 text-[10px] text-amber-500/75 leading-tight">
                {justReset ? 'Reiniciado' : 'Mantén 3s'}
              </span>
            </button>
          </div>
        </div>

        {/* Bottom Bar: Author Credit on Bottom-Left (same font) + Bottom-Right Created Logo Emblem (reduced by 15%) */}
        <div className="w-full flex items-end justify-between gap-4">
          <div data-testid="author-credit" className="text-xs font-mono text-zinc-400">
            realizado por Alberto_exe2
          </div>

          {/* Created Logo Icon moved to Bottom-Right Corner & scaled down by 15% (56x56px instead of 66x66px) */}
          <div
            data-testid="bottom-right-logo-emblem"
            className="shrink-0 pointer-events-none drop-shadow-[0_4px_20px_rgba(220,38,38,0.55)]"
          >
            <svg
              width="56"
              height="56"
              viewBox="0 0 68 68"
              aria-label="Emblema Still Freddy"
            >
              <circle
                cx="34"
                cy="34"
                r="31"
                fill="#18181b"
                stroke="#dc2626"
                strokeWidth="3"
              />
              {/* Still Freddy one-eyed emblem icon */}
              <circle cx="23" cy="27" r="6.5" fill="#ef4444" />
              <circle
                cx="45"
                cy="27"
                r="6.5"
                fill="#09090b"
                stroke="#52525b"
                strokeWidth="2"
              />
              <rect x="19" y="45" width="30" height="6" fill="#d4d4d8" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};

