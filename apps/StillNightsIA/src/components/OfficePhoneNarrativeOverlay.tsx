import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  NIGHT_1_OFFICE_MONOLOGUE_TABS,
  Night1OfficeNarrativeState,
  OfficeNarrativeTab,
  advanceNight1OfficeNarrative,
  canSkipPhoneRings,
  getInitialOfficeNarrativeState,
  getOfficeCallTabs,
  getOfficePostCallMonologueTabs,
} from '../game/rules';
import { soundController } from '../game/audio';

interface OfficePhoneNarrativeOverlayProps {
  nightNumber?: number;
  onComplete: () => void;
}

interface FlattenedChar {
  char: string;
  slightTremble: boolean;
  slowTremble: boolean;
  vividTremble: boolean;
  largeTremble: boolean;
  glitchText: boolean;
  shrinkingText: boolean;
}

export const OfficePhoneNarrativeOverlay: React.FC<OfficePhoneNarrativeOverlayProps> = ({
  nightNumber = 1,
  onComplete,
}) => {
  const [narrativeState, setNarrativeState] = useState<Night1OfficeNarrativeState>(() =>
    getInitialOfficeNarrativeState(nightNumber)
  );
  const [revealedCount, setRevealedCount] = useState<number>(0);
  const [trembleTick, setTrembleTick] = useState<number>(0);

  const stateRef = useRef<Night1OfficeNarrativeState>(narrativeState);
  stateRef.current = narrativeState;

  const revealedCountRef = useRef<number>(revealedCount);
  revealedCountRef.current = revealedCount;

  // Reset narrative state if nightNumber changes
  useEffect(() => {
    const initial = getInitialOfficeNarrativeState(nightNumber);
    stateRef.current = initial;
    setNarrativeState(initial);
  }, [nightNumber]);

  // Determine active dialogue tab (if in OFFICE_MONOLOGUE, PHONE_CALL_DIALOGUE, or POST_CALL_MONOLOGUE)
  const activeTab: OfficeNarrativeTab | null = useMemo(() => {
    if (narrativeState.phase === 'OFFICE_MONOLOGUE') {
      return NIGHT_1_OFFICE_MONOLOGUE_TABS[narrativeState.tabIndex] || null;
    }
    if (narrativeState.phase === 'PHONE_CALL_DIALOGUE') {
      const callTabs = getOfficeCallTabs(nightNumber);
      return callTabs[narrativeState.tabIndex] || null;
    }
    if (narrativeState.phase === 'POST_CALL_MONOLOGUE') {
      const postCallTabs = getOfficePostCallMonologueTabs(nightNumber);
      return postCallTabs[narrativeState.tabIndex] || null;
    }
    return null;
  }, [narrativeState.phase, narrativeState.tabIndex, nightNumber]);

  // Flatten segments into individual characters with effect flags
  const flattenedChars: FlattenedChar[] = useMemo(() => {
    if (!activeTab) return [];
    const list: FlattenedChar[] = [];
    for (const seg of activeTab.segments) {
      for (const ch of seg.text) {
        list.push({
          char: ch,
          slightTremble: Boolean(seg.slightTremble),
          slowTremble: Boolean(seg.slowTremble),
          vividTremble: Boolean(seg.vividTremble),
          largeTremble: Boolean(seg.largeTremble),
          glitchText: Boolean(seg.glitchText),
          shrinkingText: Boolean(seg.shrinkingText),
        });
      }
    }
    return list;
  }, [activeTab]);

  const flattenedLenRef = useRef<number>(flattenedChars.length);
  flattenedLenRef.current = flattenedChars.length;

  const typewriterTimerRef = useRef<number | null>(null);

  // Variable-speed typewriter effect:
  // Normal text types at ~22ms/char; slowTremble / largeTremble types slower (~95-115ms/char)
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

      const typedChar = flattenedChars[currentIdx]?.char ?? ' ';
      if (typedChar.trim().length > 0 && nextIdx % 3 === 1) {
        soundController.playCameraBlip();
      }

      if (nextIdx < flattenedChars.length) {
        const nextCharObj = flattenedChars[nextIdx];
        const delayMs = nextCharObj.slowTremble || nextCharObj.largeTremble ? 115 : 22;
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

  // Letter-shake/glitch timer when any animated character is present
  useEffect(() => {
    const hasAnimatedText = flattenedChars.some(
      (c) =>
        c.slightTremble ||
        c.slowTremble ||
        c.vividTremble ||
        c.largeTremble ||
        c.glitchText
    );
    if (!hasAnimatedText) return;

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
          const next = advanceNight1OfficeNarrative(prev, 'PHONE_RINGS_DONE', nightNumber);
          stateRef.current = next;
          return next;
        });
      }
    );

    return () => {
      soundController.stopPhoneRingSequence();
    };
  }, [narrativeState.phase, nightNumber]);

  // Advance when pressing Enter (or skipping the 3 phone rings on Night 2, Night 3 & Night 4)
  const handlePressEnter = useCallback(() => {
    const current = stateRef.current;

    if (current.phase === 'PHONE_RINGING') {
      if (canSkipPhoneRings(nightNumber)) {
        soundController.stopPhoneRingSequence();
        const next = advanceNight1OfficeNarrative(current, 'PRESS_ENTER', nightNumber);
        stateRef.current = next;
        setNarrativeState(next);
      }
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

    const next = advanceNight1OfficeNarrative(current, 'PRESS_ENTER', nightNumber);
    stateRef.current = next;
    setNarrativeState(next);
    if (next.phase === 'COMPLETED') {
      soundController.stopPhoneRingSequence();
      onComplete();
    }
  }, [nightNumber, onComplete]);

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

  const renderDialogueSegments = () => {
    if (!activeTab) return null;
    let remaining = revealedCount;

    return activeTab.segments.map((seg, segIdx) => {
      if (remaining <= 0) return null;
      const visibleText = seg.text.slice(0, remaining);
      remaining -= visibleText.length;

      if (seg.shrinkingText) {
        const totalChars = Math.max(1, seg.text.length - 1);
        return (
          <span key={segIdx} data-testid="shrinking-text-segment" className="inline">
            {visibleText.split('').map((ch, idx) => {
              const progress = idx / totalChars; // 0 (start, big) -> 1 (end, small)
              const fontSizeEm = 1.55 - progress * 0.92; // 1.55em down to 0.63em
              const opacity = 1 - progress * 0.25;
              return (
                <span
                  key={idx}
                  data-testid="shrinking-letter"
                  style={{
                    fontSize: `${fontSizeEm.toFixed(3)}em`,
                    opacity: Number(opacity.toFixed(2)),
                    lineHeight: 1.2,
                  }}
                >
                  {ch}
                </span>
              );
            })}
          </span>
        );
      }

      if (seg.glitchText) {
        return (
          <span key={segIdx} data-testid="glitched-text-segment" className="inline">
            {visibleText.split('').map((ch, idx) => {
              if (ch === ' ') return <span key={idx}> </span>;
              const seed = idx * 23 + trembleTick * 19;
              const gx = ((seed % 5) - 2) * 1.15;
              const gy = (((seed * 7) % 5) - 2) * 0.95;
              const skew = ((seed % 7) - 3) * 4;
              const invertTint = seed % 6 === 0;
              return (
                <span
                  key={idx}
                  data-testid="glitched-letter"
                  style={{
                    display: 'inline-block',
                    transform: `translate(${gx.toFixed(2)}px, ${gy.toFixed(2)}px) skewX(${skew}deg)`,
                    color: invertTint ? '#38bdf8' : '#f43f5e',
                    textShadow: '-2px 0 #ef4444, 2px 0 #22d3ee, 0 0 8px rgba(244, 63, 94, 0.8)',
                    fontWeight: 900,
                  }}
                >
                  {ch}
                </span>
              );
            })}
          </span>
        );
      }

      if (seg.largeTremble) {
        return (
          <span key={segIdx} data-testid="large-trembling-segment" className="inline">
            {visibleText.split('').map((ch, idx) => {
              if (ch === ' ') return <span key={idx}> </span>;
              const seed = idx * 19 + trembleTick * 17;
              const dx = ((seed % 5) - 2) * 1.45;
              const dy = (((seed * 11) % 5) - 2) * 1.45;
              return (
                <span
                  key={idx}
                  data-testid="large-trembling-letter"
                  style={{
                    display: 'inline-block',
                    fontSize: '1.45em',
                    lineHeight: 1.1,
                    transform: `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px)`,
                    color: '#ef4444',
                    textShadow: '0 0 12px rgba(239, 68, 68, 0.95), 0 0 4px #7f1d1d',
                    fontWeight: 900,
                  }}
                >
                  {ch}
                </span>
              );
            })}
          </span>
        );
      }

      if (seg.vividTremble || seg.slowTremble || seg.slightTremble) {
        return (
          <span key={segIdx} className="inline">
            {visibleText.split('').map((ch, idx) => {
              if (ch === ' ') return <span key={idx}> </span>;
              const seed = idx * 17 + trembleTick * 13;
              if (seg.vividTremble) {
                // "letras lentas y con mucha vida" -> lively, energetic wave & bounce
                const waveX = Math.sin(trembleTick * 0.75 + idx * 0.95) * 2.2;
                const waveY = Math.cos(trembleTick * 0.95 + idx * 0.8) * 3.0;
                return (
                  <span
                    key={idx}
                    data-testid="vivid-trembling-letter"
                    style={{
                      display: 'inline-block',
                      transform: `translate(${waveX.toFixed(2)}px, ${waveY.toFixed(2)}px)`,
                      color: '#ef4444',
                      textShadow: '0 0 10px rgba(239, 68, 68, 0.9)',
                      fontWeight: 900,
                    }}
                  >
                    {ch}
                  </span>
                );
              }

              const amp = seg.slowTremble ? 0.95 : 0.75;
              const dx = ((seed % 3) - 1) * amp;
              const dy = (((seed * 7) % 3) - 1) * amp;
              return (
                <span
                  key={idx}
                  data-testid="trembling-letter"
                  style={{
                    display: 'inline-block',
                    transform: `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px)`,
                    color: seg.slowTremble ? '#ef4444' : '#fde047',
                    textShadow: seg.slowTremble
                      ? '0 0 6px rgba(239, 68, 68, 0.75)'
                      : '0 0 5px rgba(253, 224, 71, 0.45)',
                    fontWeight: 900,
                  }}
                >
                  {ch}
                </span>
              );
            })}
          </span>
        );
      }

      return <span key={segIdx}>{visibleText}</span>;
    });
  };

  const skipAllowed = canSkipPhoneRings(nightNumber);

  return (
    <div
      data-testid="office-phone-narrative-overlay"
      data-narrative-phase={narrativeState.phase}
      data-night-number={nightNumber}
      className="fixed inset-x-0 bottom-10 z-30 flex justify-center px-4 pointer-events-auto select-none"
    >
      {narrativeState.phase === 'PHONE_RINGING' ? (
        <div
          data-testid="office-phone-ringing-box"
          onClick={skipAllowed ? handlePressEnter : undefined}
          className={`w-[80vw] max-w-[80vw] bg-zinc-950/95 border-2 border-red-500/90 rounded-xl p-6 shadow-2xl flex flex-col items-center text-center space-y-3 ${
            skipAllowed ? 'cursor-pointer' : ''
          }`}
        >
          <div className="flex items-center gap-3 text-red-400 font-mono text-sm font-bold uppercase tracking-widest animate-pulse">
            <span className="inline-block w-3 h-3 rounded-full bg-red-500" />
            LLAMADA ENTRANTE · TELÉFONO DE LA OFICINA
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-white tracking-wider">
            * RING... RING... *
          </div>
          <div className="text-xs font-mono text-zinc-400">
            12:00 AM · MUEVE EL RATÓN A LOS LADOS PARA MIRAR LA OFICINA
          </div>
          {skipAllowed && (
            <button
              type="button"
              data-testid="skip-phone-rings-btn"
              onClick={(e) => {
                e.stopPropagation();
                handlePressEnter();
              }}
              className="mt-1 px-3.5 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-zinc-950 font-mono text-xs font-bold uppercase tracking-wider transition-colors"
            >
              PULSA [ENTER] PARA SALTAR TONOS ▶
            </button>
          )}
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
              {renderDialogueSegments()}
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

