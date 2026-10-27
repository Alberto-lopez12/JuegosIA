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
        {/* Top Full-Width Unboxed Header: STILL NIGHTS- DEMO with Solid Wood Inside Every Letter + Moderate Distressed Grain */}
        <header className="w-full pt-1 pointer-events-none">
          <div data-testid="main-menu-title" className="w-full">
            <svg
              viewBox="0 0 1200 150"
              className="w-full h-auto max-h-[135px] drop-shadow-[0_10px_28px_rgba(0,0,0,0.95)]"
              aria-label="STILL NIGHTS- DEMO"
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

                {/* Darker Solid Wood Backing Pattern */}
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

                {/* 3D Carved Wood Drop Shadow */}
                <filter id="wood-carve-shadow" x="-5%" y="-10%" width="110%" height="130%">
                  <feDropShadow dx="0" dy="2.5" stdDeviation="0" floodColor="#140601" />
                  <feDropShadow dx="0" dy="4" stdDeviation="3.5" floodColor="rgba(185,28,28,0.28)" />
                </filter>

                {/* Edge splinter & counter mask so STILL NIGHTS- DEMO keeps S, G, D, O counters wide open */}
                <mask id="half-destroyed-title-mask">
                  <rect x="0" y="0" width="1200" height="160" fill="white" />
                  <g fill="black" stroke="black" strokeLinejoin="round" strokeLinecap="round">
                    {/* Splinter notches along top/bottom of wood letters */}
                    <polygon points="95,42 105,42 100,54" />
                    <polygon points="188,104 198,116 184,116" />
                    <polygon points="295,42 306,42 301,53" />
                    <polygon points="415,104 426,116 410,116" />
                    <polygon points="525,42 536,42 530,54" />
                    <polygon points="648,104 660,116 644,116" />
                    <polygon points="782,42 794,42 788,54" />
                    <polygon points="920,104 932,116 916,116" />
                    <polygon points="1045,42 1056,42 1050,54" />
                  </g>
                </mask>
              </defs>

              <g filter="url(#wood-carve-shadow)" mask="url(#half-destroyed-title-mask)">
                {/* Thin dark outer wood bevel BEHIND the letters so the wood planks inside stay bright and unobstructed */}
                <text
                  x="600"
                  y="110"
                  textAnchor="middle"
                  fill="none"
                  stroke="#1f0a02"
                  strokeWidth="2.0"
                  strokeLinejoin="round"
                  paintOrder="stroke fill"
                  fontFamily="'Rubik Dirt', 'Barlow Condensed', sans-serif"
                  fontSize="82"
                  letterSpacing="8"
                >
                  STILL NIGHTS- DEMO
                </text>

                {/* Half-Destroyed Wood Plank Surface */}
                <text
                  x="600"
                  y="110"
                  textAnchor="middle"
                  fill="url(#solid-wood-plank-pattern)"
                  stroke="none"
                  fontFamily="'Rubik Dirt', 'Barlow Condensed', sans-serif"
                  fontSize="82"
                  letterSpacing="8"
                >
                  STILL NIGHTS- DEMO
                </text>
              </g>
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

          {/* 2. Continuar (Only allows Night 1 or Night 2 in the Demo; Locked if a New Game hasn't been started yet) */}
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
                ? `Noche ${Math.min(2, progress.currentCampaignNight)}`
                : 'BLOQUEADO'}
            </span>
          </button>

          {/* 3. Extras (Locked in the Demo version) */}
          <button
            type="button"
            data-testid="extras-btn"
            disabled
            className="group relative overflow-hidden w-full px-7 py-3.5 text-left text-xl font-bold tracking-wider uppercase font-['Barlow_Condensed'] text-zinc-600 border-2 border-zinc-900/80 rounded-xl opacity-75 flex items-center justify-between cursor-not-allowed"
          >
            {renderBurnedWoodTexture('locked')}
            <span className="relative z-10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)] tracking-[0.1em]">
              Extras
            </span>
            <span className="relative z-10 text-xs font-mono font-semibold text-zinc-500 drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]">
              BLOQUEADO
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

