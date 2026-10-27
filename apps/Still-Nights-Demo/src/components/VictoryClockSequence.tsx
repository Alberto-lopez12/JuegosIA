import React, { useEffect, useRef, useState } from 'react';
import { soundController } from '../game/audio';
import { POST_6AM_HOLD_SECONDS } from '../game/rules';

interface Props {
  nightLabel: string;
  onSequenceComplete: () => void;
}

interface ConfettiPiece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  sizeW: number;
  sizeH: number;
  color: string;
  angle: number;
  spinSpeed: number;
  wobblePhase: number;
}

const CONFETTI_COLORS = [
  '#facc15', // gold
  '#ef4444', // red
  '#38bdf8', // sky blue
  '#4ade80', // emerald
  '#f472b6', // pink
  '#a855f7', // purple
  '#fb923c', // orange
];

export function formatClockCounterMinute(displayMinute: number): string {
  const clamped = Math.max(0, Math.min(360, Math.floor(displayMinute)));
  const rawHour = Math.floor(clamped / 60);
  const hourNumber = rawHour === 0 ? 12 : rawHour;
  const minuteNumber = clamped % 60;
  return `${hourNumber}:${String(minuteNumber).padStart(2, '0')} AM`;
}

export function getClockSpeedMinPerSec(currentMinFloat: number): number {
  if (currentMinFloat < 300) {
    return 240; // 12:00 AM -> 5:00 AM: very fast
  } else if (currentMinFloat < 350) {
    const p = (currentMinFloat - 300) / 50; // 5:00 AM -> 5:50 AM: slows down
    return 75 * (1 - p) + 22 * p;
  } else if (currentMinFloat < 358) {
    const p = (currentMinFloat - 350) / 8; // 5:50 AM -> 5:58 AM: slows down much more
    return 14 * (1 - p) + 4.2 * p;
  } else {
    // 5:58 AM -> 6:00 AM: 0.5 seconds per number (2.0 numbers/sec)
    return 2.0;
  }
}

/**
 * Deterministic timeline from 12:00 AM (0) to 6:00 AM (360):
 * - 0.0s .. 1.2s: 12:00 AM -> 5:00 AM (0..300, very fast)
 * - 1.2s .. 2.2s: 5:00 AM -> 5:50 AM (300..350, slows down)
 * - 2.2s .. 3.1s: 5:50 AM -> 5:58 AM (350..358, slows down much more)
 * - 3.1s .. 3.6s (0.5s): 5:58 AM (358)
 * - 3.6s .. 4.1s (0.5s): 5:59 AM (359)
 * - >= 4.1s: 6:00 AM (360)
 */
export function getCounterMinuteAtElapsedSec(elapsedSec: number): number {
  if (elapsedSec <= 0) return 0;
  if (elapsedSec < 1.2) {
    const p = elapsedSec / 1.2;
    return Math.floor(p * 300);
  }
  if (elapsedSec < 2.2) {
    const p = (elapsedSec - 1.2) / 1.0;
    const eased = 1 - Math.pow(1 - p, 1.5);
    return Math.min(349, 300 + Math.floor(eased * 50));
  }
  if (elapsedSec < 3.1) {
    const p = (elapsedSec - 2.2) / 0.9;
    const eased = 1 - Math.pow(1 - p, 1.6);
    return Math.min(357, 350 + Math.floor(eased * 8));
  }
  if (elapsedSec < 3.6) {
    return 358; // 5:58 AM for 0.5s
  }
  if (elapsedSec < 4.1) {
    return 359; // 5:59 AM for 0.5s
  }
  return 360; // 6:00 AM
}

export const VictoryClockSequence: React.FC<Props> = ({
  nightLabel,
  onSequenceComplete,
}) => {
  const [displayMinute, setDisplayMinute] = useState<number>(0); // 0 = 12:00 AM ... 360 = 6:00 AM
  const [reached6AM, setReached6AM] = useState<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const completedRef = useRef<boolean>(false);
  const onCompleteRef = useRef(onSequenceComplete);
  onCompleteRef.current = onSequenceComplete;

  useEffect(() => {
    // Start the clock-tick audio loop while the counter climbs from 12:00 AM to 6:00 AM
    soundController.stopAll(false);
    soundController.startClockTickLoop();

    let raf = 0;
    const startTime = performance.now();
    let lastTime = startTime;
    let hit6AM = false;
    let hit6AMTime = 0;
    const confetti: ConfettiPiece[] = [];

    const spawnSideConfetti = (w: number, h: number) => {
      // Launch confetti cannons from BOTH left and right sides of the screen
      const countPerSide = 85;
      for (let i = 0; i < countPerSide; i++) {
        // Left side cannon
        confetti.push({
          x: -8,
          y: h * (0.22 + Math.random() * 0.55),
          vx: 360 + Math.random() * 580,
          vy: -420 - Math.random() * 440,
          sizeW: 9 + Math.random() * 9,
          sizeH: 5 + Math.random() * 6,
          color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          angle: Math.random() * Math.PI * 2,
          spinSpeed: (Math.random() - 0.5) * 11,
          wobblePhase: Math.random() * Math.PI * 2,
        });

        // Right side cannon
        confetti.push({
          x: w + 8,
          y: h * (0.22 + Math.random() * 0.55),
          vx: -(360 + Math.random() * 580),
          vy: -420 - Math.random() * 440,
          sizeW: 9 + Math.random() * 9,
          sizeH: 5 + Math.random() * 6,
          color: CONFETTI_COLORS[(i + 3) % CONFETTI_COLORS.length],
          angle: Math.random() * Math.PI * 2,
          spinSpeed: (Math.random() - 0.5) * 11,
          wobblePhase: Math.random() * Math.PI * 2,
        });
      }
    };

    const tick = (now: number) => {
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(rawDt, 0.12);
      const elapsedSec = (now - startTime) / 1000;

      const canvas = canvasRef.current;
      if (canvas) {
        const targetW = window.innerWidth || 1440;
        const targetH = window.innerHeight || 900;
        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW;
          canvas.height = targetH;
        }
      }

      if (!hit6AM) {
        const intMin = getCounterMinuteAtElapsedSec(elapsedSec);
        setDisplayMinute(intMin);

        if (intMin >= 360) {
          hit6AM = true;
          hit6AMTime = now;
          setDisplayMinute(360);
          setReached6AM(true);

          // Fade out Clock-tick and trigger Fnaf-win-sound ONLY when reaching 6:00 AM!
          soundController.fadeOutClockTick(650);
          soundController.playWinSound6AM();

          if (canvas) {
            spawnSideConfetti(canvas.width, canvas.height);
          }
        }
      } else {
        const post6AMTimerSec = (now - hit6AMTime) / 1000;
        // Stay on 6:00 AM for 4 seconds without showing options, then automatically advance
        if (post6AMTimerSec >= POST_6AM_HOLD_SECONDS && !completedRef.current) {
          completedRef.current = true;
          onCompleteRef.current();
          return;
        }
      }

      // Render Confetti on Canvas once 6:00 AM is reached
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          if (hit6AM && confetti.length > 0) {
            const post6AMSec = (now - hit6AMTime) / 1000;
            for (const c of confetti) {
              c.x += c.vx * dt + Math.sin(post6AMSec * 6 + c.wobblePhase) * 45 * dt;
              c.y += c.vy * dt;
              c.vx *= Math.pow(0.42, dt); // air drag on horizontal burst
              c.vy += 680 * dt; // gravity
              c.angle += c.spinSpeed * dt;

              ctx.save();
              ctx.translate(c.x, c.y);
              ctx.rotate(c.angle);
              ctx.fillStyle = c.color;
              ctx.fillRect(-c.sizeW / 2, -c.sizeH / 2, c.sizeW, c.sizeH);
              ctx.restore();
            }
          }
        }
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      soundController.fadeOutClockTick(250);
    };
  }, []);

  // Format minute (0..360) as "12:00 AM" .. "5:59 AM" -> "6:00 AM"
  const rawHour = Math.floor(displayMinute / 60);
  const hourNumber = rawHour === 0 ? 12 : rawHour;
  const minuteNumber = displayMinute % 60;
  const formattedCounterTime = `${hourNumber}:${String(minuteNumber).padStart(2, '0')} AM`;

  return (
    <div
      data-testid="victory-clock-sequence"
      className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center select-none overflow-hidden"
    >
      {/* Side Confetti Canvas */}
      <canvas
        ref={canvasRef}
        width={1440}
        height={900}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />

      <div className="relative z-10 flex flex-col items-center text-center px-6 space-y-5">
        <div className="text-xs sm:text-sm font-mono uppercase tracking-[0.38em] text-zinc-400">
          {nightLabel} · FIN DEL TURNO NOCTURNO
        </div>

        {/* Digital Clock Counter */}
        <div
          data-testid="victory-clock-digits"
          className={`font-mono font-bold tabular-nums tracking-tight leading-none transition-transform duration-300 ${
            reached6AM
              ? 'text-[clamp(4.5rem,12vw,9.5rem)] text-emerald-400 scale-110 drop-shadow-[0_0_45px_rgba(52,211,153,0.65)]'
              : displayMinute >= 350
              ? 'text-[clamp(4.2rem,11vw,8.6rem)] text-amber-300'
              : 'text-[clamp(4rem,10.5vw,8.2rem)] text-zinc-100'
          }`}
        >
          {formattedCounterTime}
        </div>

        <div className="h-8 flex items-center justify-center">
          {reached6AM ? (
            <span className="text-sm sm:text-base font-mono font-bold tracking-[0.3em] text-amber-300 uppercase">
              ¡6:00 AM ALCANZADAS · NOCHE COMPLETADA!
            </span>
          ) : (
            <span className="text-xs font-mono tracking-[0.25em] text-zinc-500 uppercase">
              {displayMinute < 300
                ? 'AVANZANDO REGISTRO HORARIO...'
                : displayMinute < 358
                ? 'ACERCÁNDOSE AL AMANECER...'
                : 'ÚLTIMOS SEGUNDOS DE LA GUARDIA...'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

