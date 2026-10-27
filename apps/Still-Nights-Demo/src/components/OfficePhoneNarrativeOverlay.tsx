import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  INITIAL_NIGHT_1_OFFICE_NARRATIVE_STATE,
  NIGHT_1_OFFICE_MONOLOGUE_TABS,
  NIGHT_1_PHONE_CALL_TABS,
  Night1OfficeNarrativeState,
  OfficeNarrativeTab,
  PHONE_RING_TOTAL_LOOPS,
  advanceNight1OfficeNarrative,
} from '../game/rules';
import { soundController } from '../game/audio';

interface OfficePhoneNarrativeOverlayProps {
  onComplete: () => void;
}

interface FlattenedChar {
  char: string;
  slowTremble: boolean;
}

export const OfficePhoneNarrativeOverlay: React.FC<OfficePhoneNarrativeOverlayProps> = ({
  onComplete,
}) => {
  const [narrativeState, setNarrativeState] = useState<Night1OfficeNarrativeState>(
    INITIAL_NIGHT_1_OFFICE_NARRATIVE_STATE
  );
  const [revealedCount, setRevealedCount] = useState<number>(0);
  const [trembleTick, setTrembleTick] = useState<number>(0);

  const stateRef = useRef<Night1OfficeNarrativeState>(narrativeState);
  stateRef.current = narrativeState;

  const revealedCountRef = useRef<number>(revealedCount);
  revealedCountRef.current = revealedCount;

  // Determine active dialogue tab (if in OFFICE_MONOLOGUE or PHONE_CALL_DIALOGUE)
  const activeTab: OfficeNarrativeTab | null = useMemo(() => {
    if (narrativeState.phase === 'OFFICE_MONOLOGUE') {
      return NIGHT_1_OFFICE_MONOLOGUE_TABS[narrativeState.tabIndex] || null;
    }
    if (narrativeState.phase === 'PHONE_CALL_DIALOGUE') {
      return NIGHT_1_PHONE_CALL_TABS[narrativeState.tabIndex] || null;
    }
    return null;
  }, [narrativeState.phase, narrativeState.tabIndex]);

  // Flatten segments into individual characters with slowTremble flag
  const flattenedChars: FlattenedChar[] = useMemo(() => {
    if (!activeTab) return [];
    const list: FlattenedChar[] = [];
    for (const seg of activeTab.segments) {
      for (const ch of seg.text) {
        list.push({
          char: ch,
          slowTremble: Boolean(seg.slowTremble),
        });
      }
    }
    return list;
  }, [activeTab]);

  const flattenedLenRef = useRef<number>(flattenedChars.length);
  flattenedLenRef.current = flattenedChars.length;

  const typewriterTimerRef = useRef<number | null>(null);

  // Variable-speed typewriter effect:
  // Normal text types at ~22ms/char; "ASUNTOS PENDIENTES" (slowTremble) types much slower (~145ms/char)
  useEffect(() => {
    if (typewriterTimerRef.current !== null) {
      window.clearTimeout(typewriterTimerRef.current);
      typewriterTimerRef.current = null;
    }

    if (!activeTab || flattenedChars.length === 0) {
      setRevealedCount(0);
      revealedCountRef.current = 0;
      return;
    }

    setRevealedCount(0);
    revealedCountRef.current = 0;
    let cancelled = false;

    const stepChar = (currentIdx: number) => {
      if (cancelled) return;
      if (
        currentIdx >= flattenedChars.length ||
        revealedCountRef.current >= flattenedChars.length
      ) {
        return;
      }

      const nextIdx = currentIdx + 1;
      revealedCountRef.current = nextIdx;
      setRevealedCount(nextIdx);

      if (nextIdx < flattenedChars.length) {
        const nextCharObj = flattenedChars[nextIdx];
        const delayMs = nextCharObj.slowTremble ? 145 : 22;
        typewriterTimerRef.current = window.setTimeout(() => stepChar(nextIdx), delayMs);
      }
    };

    typewriterTimerRef.current = window.setTimeout(() => stepChar(0), 25);

    return () => {
      cancelled = true;
      if (typewriterTimerRef.current !== null) {
        window.clearTimeout(typewriterTimerRef.current);
        typewriterTimerRef.current = null;
      }
    };
  }, [activeTab, flattenedChars]);

  // Subtle letter-shake timer when any slowTremble character is present
  useEffect(() => {
    const hasTremble = flattenedChars.some((c) => c.slowTremble);
    if (!hasTremble) return;

    const interval = window.setInterval(() => {
      setTrembleTick((t) => (t + 1) % 1000);
    }, 75);
    return () => window.clearInterval(interval);
  }, [flattenedChars]);

  // Trigger the 3x ringing phone loop with 1s gap when entering PHONE_RINGING phase
  useEffect(() => {
    if (narrativeState.phase !== 'PHONE_RINGING') return;

    soundController.startPhoneRingSequence(
      (ringNum) => {
        setNarrativeState((prev) =>
          prev.phase === 'PHONE_RINGING' ? { ...prev, ringCount: ringNum } : prev
        );
      },
      () => {
        setNarrativeState((prev) => {
          const next = advanceNight1OfficeNarrative(prev, 'PHONE_RINGS_DONE');
          stateRef.current = next;
          return next;
        });
      }
    );

    return () => {
      soundController.stopPhoneRingSequence();
    };
  }, [narrativeState.phase]);

  // Advance when pressing Enter
  const handlePressEnter = useCallback(() => {
    const current = stateRef.current;

    if (current.phase === 'PHONE_RINGING') {
      return;
    }

    // If text is still typing, first Enter reveals the full line and stops the typewriter timer
    if (revealedCountRef.current < flattenedLenRef.current) {
      if (typewriterTimerRef.current !== null) {
        window.clearTimeout(typewriterTimerRef.current);
        typewriterTimerRef.current = null;
      }
      revealedCountRef.current = flattenedLenRef.current;
      setRevealedCount(flattenedLenRef.current);
      return;
    }

    const next = advanceNight1OfficeNarrative(current, 'PRESS_ENTER');
    stateRef.current = next;
    setNarrativeState(next);
    if (next.phase === 'COMPLETED') {
      soundController.stopPhoneRingSequence();
      onComplete();
    }
  }, [onComplete]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'NumpadEnter') {
        e.preventDefault();
        e.stopPropagation();
        handlePressEnter();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [handlePressEnter]);

  if (narrativeState.phase === 'COMPLETED') {
    return null;
  }

  // Group revealed characters into normal text vs slowTremble spans so "ASUNTOS PENDIENTES" stays together without breaking mid-word
  const revealedSlice = flattenedChars.slice(0, revealedCount);
  const normalChars = revealedSlice.filter((c) => !c.slowTremble);
  const trembleChars = revealedSlice.filter((c) => c.slowTremble);

  return (
    <div
      data-testid="office-phone-narrative-overlay"
      data-narrative-phase={narrativeState.phase}
      className="fixed inset-x-0 bottom-10 z-30 flex justify-center px-4 pointer-events-auto select-none"
    >
      {narrativeState.phase === 'PHONE_RINGING' ? (
        <div
          data-testid="office-phone-ringing-box"
          className="w-[80vw] max-w-[80vw] bg-zinc-950/95 border-2 border-red-500/90 rounded-xl p-6 shadow-2xl flex flex-col items-center text-center space-y-3"
        >
          <div className="flex items-center gap-3 text-red-400 font-mono text-sm font-bold uppercase tracking-widest animate-pulse">
            <span className="inline-block w-3 h-3 rounded-full bg-red-500" />
            LLAMADA ENTRANTE · TELÉFONO DE LA OFICINA
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-white tracking-wider">
            * RING... RING... * ({narrativeState.ringCount} / {PHONE_RING_TOTAL_LOOPS})
          </div>
          <div className="text-xs font-mono text-zinc-400">
            12:00 AM · MUEVE EL RATÓN A LOS LADOS PARA MIRAR LA OFICINA
          </div>
        </div>
      ) : (
        activeTab && (
          <div
            data-testid="office-narrative-dialogue-box"
            onClick={handlePressEnter}
            className="w-[80vw] max-w-[80vw] bg-zinc-950/95 border-2 border-zinc-400 rounded-xl p-6 sm:p-7 shadow-2xl cursor-pointer font-mono"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5 mb-3">
              <div className="flex items-center gap-2.5">
                <span
                  data-testid="office-narrative-speaker"
                  className="text-sm sm:text-base font-bold uppercase tracking-widest px-2.5 py-0.5 rounded bg-zinc-900 border border-zinc-700"
                  style={{ color: activeTab.speakerColor }}
                >
                  {activeTab.speaker}
                </span>
                {narrativeState.phase === 'PHONE_CALL_DIALOGUE' && (
                  <span className="text-xs text-red-400 uppercase tracking-wider">
                    ● LÍNEA TELEFÓNICA ACTIVA
                  </span>
                )}
              </div>

              <span className="text-[11px] text-zinc-400 uppercase tracking-wider">
                12:00 AM
              </span>
            </div>

            <div
              data-testid="office-narrative-text"
              className="text-base sm:text-xl text-zinc-100 leading-relaxed min-h-[4.25rem] font-semibold"
            >
              <span>{normalChars.map((item) => item.char).join('')}</span>
              {trembleChars.length > 0 && (
                <span className="inline-block whitespace-nowrap">
                  {trembleChars.map((item, idx) => {
                    // Subtle micro-tremble (±0.55px) so letters move slightly without jumping wildly
                    const seed = idx * 17 + trembleTick * 13;
                    const dx = ((seed % 3) - 1) * 0.55;
                    const dy = (((seed * 7) % 3) - 1) * 0.55;
                    return (
                      <span
                        key={idx}
                        data-testid="trembling-letter"
                        style={{
                          display: 'inline-block',
                          transform: `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px)`,
                          color: '#ef4444',
                          textShadow: '0 0 6px rgba(239, 68, 68, 0.75)',
                          fontWeight: 900,
                        }}
                      >
                        {item.char === ' ' ? '\u00A0' : item.char}
                      </span>
                    );
                  })}
                </span>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between pt-2 border-t border-zinc-900">
              <span className="text-[11px] text-zinc-500">
                Puedes mirar a izquierda y derecha moviendo el ratón
              </span>
              <button
                type="button"
                data-testid="office-narrative-enter-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePressEnter();
                }}
                className="px-3.5 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold uppercase tracking-wider transition-colors"
              >
                PULSA [ENTER] PARA CONTINUAR ▶
              </button>
            </div>
          </div>
        )
      )}
    </div>
  );
};
