import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  HOTEL_BED_STAND_X,
  HOTEL_LIGHT_SWITCH_X,
  HOTEL_MAX_WALK_X,
  HOTEL_MIN_WALK_X,
  HOTEL_PHONE_X,
  INTRO_DOOR_ENTER_X,
  INTRO_DOOR_STOP_X,
  INTRO_OUTSIDE_SPAWN_X,
  INTRO_WALK_SPEED_PX_PER_SEC,
  POST_NIGHT_1_CAR_STOP_X,
  POST_NIGHT_1_EXIT_DIALOGUE_TABS,
  POST_NIGHT_1_GLASS_BREAK_TIME_SEC,
  POST_NIGHT_1_HOTEL_PHONE_TABS,
  POST_NIGHT_1_HOTEL_WAKE_DIALOGUE,
  POST_NIGHT_1_NO_CONSTRUCTION_MESSAGE,
  POST_NIGHT_1_RETURN_DOOR_DIALOGUE,
  POST_NIGHT_1_THUNDER_DELAY_SEC,
  POST_NIGHT_1_THUNDER_DIALOGUE,
  PostNight1DialogueTab,
  PostNight1MinigamePhase,
  isNearHotelLightSwitch,
  isNearHotelPhone,
  isPostNight1RainPhase,
  stepIntroWalkPosition,
  stepWalkBackToCar,
} from '../game/rules';
import { soundController } from '../game/audio';

interface EightBitPostNight1MinigameProps {
  onComplete: () => void;
}

export const EightBitPostNight1Minigame: React.FC<EightBitPostNight1MinigameProps> = ({
  onComplete,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [phase, setPhase] = useState<PostNight1MinigamePhase>(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search).get('postnight1_phase');
      if (
        p === 'WALK_TO_CAR' ||
        p === 'REVERSE_DRIVING_THUNDER_DIALOGUE' ||
        p === 'REVERSE_DRIVING_BONNIE_SWERVE' ||
        p === 'HOTEL_WAKE_DIALOGUE' ||
        p === 'HOTEL_PHONE_RINGING_WALK' ||
        p === 'HOTEL_PHONE_CONVERSATION'
      ) {
        return p;
      }
    }
    return 'EXIT_BUILDING_DIALOGUE';
  });
  const [exitTabIdx, setExitTabIdx] = useState<number>(0);
  const [hotelPhoneTabIdx, setHotelPhoneTabIdx] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const idx = Number(new URLSearchParams(window.location.search).get('phone_tab'));
      if (!Number.isNaN(idx) && idx >= 0) return idx;
    }
    return 0;
  });
  const initialPlayerX = useMemo(() => {
    if (typeof window !== 'undefined') {
      const px = Number(new URLSearchParams(window.location.search).get('player_x'));
      if (!Number.isNaN(px) && px > 0) return px;
    }
    return phase === 'HOTEL_WAKE_DIALOGUE' ||
      phase === 'HOTEL_PHONE_RINGING_WALK' ||
      phase === 'HOTEL_PHONE_CONVERSATION'
      ? HOTEL_BED_STAND_X
      : INTRO_DOOR_STOP_X;
  }, []);

  const [typedChars, setTypedChars] = useState<number>(0);
  const [trembleTick, setTrembleTick] = useState<number>(0);
  const [isThinkingPause, setIsThinkingPause] = useState<boolean>(false);
  const [nearPhone, setNearPhone] = useState<boolean>(() => isNearHotelPhone(initialPlayerX));
  const [nearLightSwitch, setNearLightSwitch] = useState<boolean>(() =>
    isNearHotelLightSwitch(initialPlayerX)
  );
  const [roomLightOn, setRoomLightOn] = useState<boolean>(true);
  const [selectedChoice, setSelectedChoice] = useState<'SI' | 'NO'>('SI');

  const phaseRef = useRef<PostNight1MinigamePhase>(phase);
  phaseRef.current = phase;

  const roomLightOnRef = useRef<boolean>(roomLightOn);
  roomLightOnRef.current = roomLightOn;

  const exitTabIdxRef = useRef<number>(exitTabIdx);
  exitTabIdxRef.current = exitTabIdx;

  const hotelPhoneTabIdxRef = useRef<number>(hotelPhoneTabIdx);
  hotelPhoneTabIdxRef.current = hotelPhoneTabIdx;

  const typedCharsRef = useRef<number>(typedChars);
  typedCharsRef.current = typedChars;

  const isThinkingPauseRef = useRef<boolean>(isThinkingPause);
  isThinkingPauseRef.current = isThinkingPause;

  const simRef = useRef({
    scrollOffset: 0,
    fadeAlpha: 0,
    playerX: initialPlayerX,
    playerFacing: (
      phase === 'HOTEL_WAKE_DIALOGUE' ||
      phase === 'HOTEL_PHONE_RINGING_WALK' ||
      phase === 'HOTEL_PHONE_CONVERSATION'
        ? 1
        : -1
    ) as -1 | 1,
    walkCycle: 0,
    inCar: false,
    cruiseElapsedSec: 0,
    lightningFlashAlpha: 0,
    swerveElapsedSec: 0,
    glassBroken: false,
    wakeElapsedSec: 0,
    thinkingAnimActive: false,
    thinkingElapsedSec: 0,
    keysHeld: {
      left: false,
      right: false,
    },
  });

  // Determine the currently active dialogue tab (if in a dialogue phase)
  const activeTab: PostNight1DialogueTab | null = useMemo(() => {
    if (phase === 'EXIT_BUILDING_DIALOGUE') {
      return POST_NIGHT_1_EXIT_DIALOGUE_TABS[exitTabIdx] || null;
    }
    if (phase === 'REVERSE_DRIVING_THUNDER_DIALOGUE') {
      return POST_NIGHT_1_THUNDER_DIALOGUE;
    }
    if (phase === 'HOTEL_WAKE_DIALOGUE') {
      return POST_NIGHT_1_HOTEL_WAKE_DIALOGUE;
    }
    if (phase === 'HOTEL_PHONE_CONVERSATION') {
      return POST_NIGHT_1_HOTEL_PHONE_TABS[hotelPhoneTabIdx] || null;
    }
    if (phase === 'HOTEL_CHOICE_NO_FEEDBACK') {
      return {
        speaker: 'SISTEMA',
        speakerColor: '#f87171',
        segments: [{ text: POST_NIGHT_1_NO_CONSTRUCTION_MESSAGE }],
      };
    }
    if (phase === 'RETURN_OUTSIDE_DOOR_DIALOGUE') {
      return POST_NIGHT_1_RETURN_DOOR_DIALOGUE;
    }
    return null;
  }, [phase, exitTabIdx, hotelPhoneTabIdx]);

  const fullDialogueText = useMemo(() => {
    if (!activeTab) return '';
    return activeTab.segments.map((s) => s.text).join('');
  }, [activeTab]);

  // Manage continuous rain audio loop across consecutive rain scenes without restarting!
  useEffect(() => {
    if (isPostNight1RainPhase(phase)) {
      soundController.startRainLoop();
    } else {
      soundController.stopRainLoop();
    }
  }, [phase]);

  // Ensure rain loop and phone ring stop when the whole minigame unmounts
  useEffect(() => {
    return () => {
      soundController.stopRainLoop();
      soundController.stopPhoneRingSequence();
    };
  }, []);

  // Manage hotel phone infinite loop ringing when in HOTEL_PHONE_RINGING_WALK
  useEffect(() => {
    if (phase === 'HOTEL_PHONE_RINGING_WALK') {
      soundController.startInfinitePhoneRing();
      return () => {
        soundController.stopPhoneRingSequence();
      };
    }
  }, [phase]);

  // Typewriter effect supporting slowTremble segments, autoCutOffAfterTyped, and thinkingAnimationAfterPrefix
  useEffect(() => {
    if (!activeTab) {
      setTypedChars(0);
      typedCharsRef.current = 0;
      setIsThinkingPause(false);
      isThinkingPauseRef.current = false;
      simRef.current.thinkingAnimActive = false;
      return;
    }

    setTypedChars(0);
    typedCharsRef.current = 0;
    setIsThinkingPause(false);
    isThinkingPauseRef.current = false;
    simRef.current.thinkingAnimActive = false;

    const totalLen = fullDialogueText.length;
    const prefixPauseLen = activeTab.thinkingAnimationAfterPrefix
      ? activeTab.thinkingAnimationAfterPrefix.length
      : -1;

    // Determine at which character index slowTremble starts (if any)
    let slowStartIdx = totalLen + 1;
    let running = 0;
    for (const seg of activeTab.segments) {
      if (seg.slowTremble && slowStartIdx > totalLen) {
        slowStartIdx = running;
      }
      running += seg.text.length;
    }

    let cancelled = false;
    let timerId: number | null = null;

    const stepTypewriter = () => {
      if (cancelled) return;
      const current = typedCharsRef.current;

      if (current >= totalLen) {
        // If this tab automatically cuts off right as the insult reaches "¡SERÁS HIJO DE PU... "
        if (activeTab.autoCutOffAfterTyped && phaseRef.current === 'HOTEL_PHONE_CONVERSATION') {
          timerId = window.setTimeout(() => {
            if (cancelled) return;
            setHotelPhoneTabIdx((idx) =>
              Math.min(POST_NIGHT_1_HOTEL_PHONE_TABS.length - 1, idx + 1)
            );
          }, 360);
        }
        return;
      }

      const next = current + 1;
      typedCharsRef.current = next;
      setTypedChars(next);

      const nextChar = fullDialogueText[current] ?? ' ';
      if (nextChar.trim().length > 0 && next % 3 === 1) {
        soundController.playCameraBlip();
      }

      // Check if we just reached the "¿Pero cómo sabes eso?" thinking animation pause!
      if (prefixPauseLen > 0 && next === prefixPauseLen) {
        setIsThinkingPause(true);
        isThinkingPauseRef.current = true;
        simRef.current.thinkingAnimActive = true;
        simRef.current.thinkingElapsedSec = 0;
        simRef.current.playerFacing = -1; // Turns away briefly to think in 8-bit

        timerId = window.setTimeout(() => {
          if (cancelled) return;
          setIsThinkingPause(false);
          isThinkingPauseRef.current = false;
          simRef.current.thinkingAnimActive = false;
          simRef.current.playerFacing = 1; // Turns back to the phone ("y luego vuelve al telefono")
          stepTypewriter();
        }, 1450);
        return;
      }

      const isSlowChar = next > slowStartIdx;
      const delayMs = isSlowChar ? 145 : 22;
      timerId = window.setTimeout(stepTypewriter, delayMs);
    };

    timerId = window.setTimeout(stepTypewriter, 25);

    return () => {
      cancelled = true;
      if (timerId !== null) {
        window.clearTimeout(timerId);
      }
    };
  }, [activeTab, fullDialogueText]);

  // Subtle letter-shake timer (matching Night 1 OfficePhoneNarrativeOverlay) when slowTremble or slightTremble is present
  useEffect(() => {
    if (!activeTab) return;
    const hasTremble = activeTab.segments.some((s) => s.slowTremble || s.slightTremble);
    if (!hasTremble) return;

    const interval = window.setInterval(() => {
      setTrembleTick((t) => (t + 1) % 1000);
    }, 75);
    return () => window.clearInterval(interval);
  }, [activeTab]);

  const handleChooseYes = useCallback(() => {
    if (phaseRef.current !== 'HOTEL_PHONE_CONVERSATION') return;
    soundController.playCameraBlip();
    simRef.current.fadeAlpha = 0;
    setPhase('HOTEL_FADE_OUT');
  }, []);

  const handleChooseNo = useCallback(() => {
    if (phaseRef.current !== 'HOTEL_PHONE_CONVERSATION') return;
    soundController.playCameraBlip();
    setPhase('HOTEL_CHOICE_NO_FEEDBACK');
  }, []);

  const handleToggleRoomLight = useCallback(() => {
    if (phaseRef.current !== 'HOTEL_PHONE_RINGING_WALK') return;
    if (!isNearHotelLightSwitch(simRef.current.playerX)) return;
    soundController.playCameraBlip();
    setRoomLightOn((prev) => {
      const next = !prev;
      roomLightOnRef.current = next;
      return next;
    });
  }, []);

  const handleAnswerPhone = useCallback(() => {
    if (phaseRef.current !== 'HOTEL_PHONE_RINGING_WALK') return;
    if (!isNearHotelPhone(simRef.current.playerX)) return;
    soundController.stopPhoneRingSequence();
    soundController.playCameraBlip();
    simRef.current.keysHeld.left = false;
    simRef.current.keysHeld.right = false;
    simRef.current.playerFacing = 1;
    setHotelPhoneTabIdx(0);
    setPhase('HOTEL_PHONE_CONVERSATION');
  }, []);

  // Advance dialogue with Enter (or click on the dialogue prompt)
  const handleAdvanceDialogue = useCallback(() => {
    const currentPhase = phaseRef.current;
    if (isPostNight1RainPhase(currentPhase)) {
      soundController.startRainLoop();
    }
    if (!activeTab) return;

    // Don't skip past the 8-bit thinking animation while it's actively playing
    if (isThinkingPauseRef.current) {
      return;
    }

    // If still typing, complete typing first (unless it's the auto-cutoff insult, which jumps right to the cutoff)
    if (typedCharsRef.current < fullDialogueText.length) {
      if (activeTab.thinkingAnimationAfterPrefix) {
        const prefixLen = activeTab.thinkingAnimationAfterPrefix.length;
        if (typedCharsRef.current < prefixLen) {
          // Jump to the thinking animation point so the player still sees the 8-bit thinking animation
          typedCharsRef.current = prefixLen;
          setTypedChars(prefixLen);
          return;
        }
      }
      typedCharsRef.current = fullDialogueText.length;
      setTypedChars(fullDialogueText.length);
      if (activeTab.autoCutOffAfterTyped && currentPhase === 'HOTEL_PHONE_CONVERSATION') {
        setHotelPhoneTabIdx((idx) =>
          Math.min(POST_NIGHT_1_HOTEL_PHONE_TABS.length - 1, idx + 1)
        );
      }
      return;
    }

    if (currentPhase === 'EXIT_BUILDING_DIALOGUE') {
      if (exitTabIdxRef.current + 1 < POST_NIGHT_1_EXIT_DIALOGUE_TABS.length) {
        setExitTabIdx((idx) => idx + 1);
      } else {
        setPhase('WALK_TO_CAR');
      }
      return;
    }

    if (currentPhase === 'REVERSE_DRIVING_THUNDER_DIALOGUE') {
      // Right when the player presses Enter on "¡QUÉ NOCHE DE PERROS!", trigger the black silhouette Bonnie jumpscare at the car!
      simRef.current.swerveElapsedSec = 0;
      simRef.current.glassBroken = false;
      simRef.current.fadeAlpha = 0;
      soundController.playJumpscare();
      setPhase('REVERSE_DRIVING_BONNIE_SWERVE');
      return;
    }

    if (currentPhase === 'HOTEL_WAKE_DIALOGUE') {
      setNearPhone(isNearHotelPhone(simRef.current.playerX));
      setNearLightSwitch(isNearHotelLightSwitch(simRef.current.playerX));
      setPhase('HOTEL_PHONE_RINGING_WALK');
      return;
    }

    if (currentPhase === 'HOTEL_PHONE_CONVERSATION') {
      // If on the final tab with the SI / NO choice, Enter activates the highlighted choice
      if (activeTab.hasYesNoChoice) {
        if (selectedChoice === 'SI') {
          handleChooseYes();
        } else {
          handleChooseNo();
        }
        return;
      }

      if (hotelPhoneTabIdxRef.current + 1 < POST_NIGHT_1_HOTEL_PHONE_TABS.length) {
        setHotelPhoneTabIdx((idx) => idx + 1);
      }
      return;
    }

    if (currentPhase === 'HOTEL_CHOICE_NO_FEEDBACK') {
      // Return back to the SI / NO choice tab ("y volver a la eleccion")
      setSelectedChoice('SI');
      setPhase('HOTEL_PHONE_CONVERSATION');
      return;
    }

    if (currentPhase === 'RETURN_OUTSIDE_DOOR_DIALOGUE') {
      simRef.current.fadeAlpha = 0;
      setPhase('RETURN_ENTERING_FADE_OUT');
    }
  }, [activeTab, fullDialogueText, selectedChoice, handleChooseYes, handleChooseNo]);

  // Keyboard listener for Enter, E (answer phone OR toggle room light switch next to the door), and A/D or Left/Right movement / choice selection
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const code = e.code;
      const currentPhase = phaseRef.current;
      if (isPostNight1RainPhase(currentPhase)) {
        soundController.startRainLoop();
      }

      if (code === 'Enter' || code === 'NumpadEnter') {
        e.preventDefault();
        handleAdvanceDialogue();
        return;
      }

      if (code === 'KeyE') {
        if (currentPhase === 'HOTEL_PHONE_RINGING_WALK') {
          e.preventDefault();
          if (isNearHotelPhone(simRef.current.playerX)) {
            handleAnswerPhone();
          } else if (isNearHotelLightSwitch(simRef.current.playerX)) {
            handleToggleRoomLight();
          }
          return;
        }
        if (
          currentPhase === 'HOTEL_WAKE_DIALOGUE' ||
          currentPhase === 'HOTEL_PHONE_CONVERSATION'
        ) {
          if (isNearHotelLightSwitch(simRef.current.playerX)) {
            e.preventDefault();
            handleToggleRoomLight();
            return;
          }
        }
      }

      if (
        currentPhase === 'HOTEL_PHONE_CONVERSATION' &&
        POST_NIGHT_1_HOTEL_PHONE_TABS[hotelPhoneTabIdxRef.current]?.hasYesNoChoice
      ) {
        if (code === 'KeyA' || code === 'ArrowLeft') {
          setSelectedChoice('SI');
          return;
        }
        if (code === 'KeyD' || code === 'ArrowRight') {
          setSelectedChoice('NO');
          return;
        }
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
  }, [handleAdvanceDialogue, handleAnswerPhone, handleToggleRoomLight]);

  // Main 8-Bit Canvas Simulation & Rendering Loop
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
      ctx.fillRect(
        Math.round(x / 4) * 4,
        Math.round(y / 4) * 4,
        Math.round(w / 4) * 4,
        Math.round(h / 4) * 4
      );
    };

    const draw8BitPineTree = (
      ctx: CanvasRenderingContext2D,
      baseX: number,
      baseY: number,
      scale = 1,
      flashBoost = 0
    ) => {
      const s = 4 * scale;
      drawPixelRect(ctx, baseX - s * 1.5, baseY - s * 4, s * 3, s * 4, '#3b2314');
      drawPixelRect(
        ctx,
        baseX - s * 6,
        baseY - s * 8,
        s * 12,
        s * 4,
        flashBoost > 0.3 ? '#1e4d35' : '#0c2e1c'
      );
      drawPixelRect(
        ctx,
        baseX - s * 5,
        baseY - s * 12,
        s * 10,
        s * 4,
        flashBoost > 0.3 ? '#256343' : '#113b25'
      );
      drawPixelRect(
        ctx,
        baseX - s * 3.5,
        baseY - s * 16,
        s * 7,
        s * 4,
        flashBoost > 0.3 ? '#2f7a53' : '#164a2f'
      );
      drawPixelRect(
        ctx,
        baseX - s * 2,
        baseY - s * 19,
        s * 4,
        s * 3,
        flashBoost > 0.3 ? '#3b9466' : '#1d5c3b'
      );
    };

    // Supports both facing right (parked outside) and facing left (reverse driving away from the establishment)
    // plus shattered front windshield during the Bonnie car jumpscare
    const draw8BitCar = (
      ctx: CanvasRenderingContext2D,
      cx: number,
      cy: number,
      isDriving: boolean,
      timeSec: number,
      hasDriver: boolean,
      facingDir: -1 | 1 = 1,
      windshieldBroken = false
    ) => {
      const bounceY = isDriving ? (Math.floor(timeSec * 10) % 2) * 2 : 0;
      const y = cy + bounceY;

      // Headlight beam in 8-bit steps pointing in `facingDir`
      if (facingDir === 1) {
        if (isDriving) {
          drawPixelRect(ctx, cx + 68, y - 4, 96, 28, 'rgba(253, 224, 71, 0.16)');
          drawPixelRect(ctx, cx + 164, y - 12, 120, 44, 'rgba(253, 224, 71, 0.09)');
        } else {
          drawPixelRect(ctx, cx + 68, y + 2, 48, 16, 'rgba(253, 224, 71, 0.08)');
        }
      } else {
        // Facing LEFT (Reverse driving scene)
        if (isDriving) {
          drawPixelRect(ctx, cx - 164, y - 4, 96, 28, 'rgba(253, 224, 71, 0.18)');
          drawPixelRect(ctx, cx - 284, y - 12, 120, 44, 'rgba(253, 224, 71, 0.10)');
        }
      }

      // Car main chassis
      drawPixelRect(ctx, cx - 72, y - 8, 144, 28, '#581c87');
      drawPixelRect(ctx, cx - 68, y - 4, 136, 20, '#6b21a8');
      // Cabin / roof
      drawPixelRect(ctx, cx - 44, y - 28, 84, 20, '#4c1d95');
      // Windows
      drawPixelRect(ctx, cx - 36, y - 24, 32, 14, '#0f172a');
      drawPixelRect(ctx, cx + 2, y - 24, 32, 14, '#0f172a');

      // Front windshield glass along the leading cabin pillar
      if (facingDir === -1) {
        drawPixelRect(
          ctx,
          cx - 46,
          y - 26,
          10,
          18,
          windshieldBroken ? '#020617' : '#38bdf8'
        );
      } else {
        drawPixelRect(ctx, cx + 36, y - 26, 8, 18, '#38bdf8');
      }

      // Driver silhouette inside the front window corresponding to facingDir
      if (hasDriver) {
        if (facingDir === 1) {
          drawPixelRect(ctx, cx + 10, y - 22, 12, 10, '#facc15');
        } else {
          drawPixelRect(ctx, cx - 24, y - 22, 12, 10, '#facc15');
        }
      }

      // Shattered front windshield cracks & hole when broken mid-jumpscare!
      if (windshieldBroken && facingDir === -1) {
        // Jagged dark shattered hole in the front windshield & driver window
        drawPixelRect(ctx, cx - 44, y - 24, 16, 12, '#020204');
        // Bright 8-bit spiderweb glass cracks across the front windshield
        drawPixelRect(ctx, cx - 48, y - 26, 8, 4, '#e0f2fe');
        drawPixelRect(ctx, cx - 40, y - 22, 12, 4, '#bae6fd');
        drawPixelRect(ctx, cx - 32, y - 26, 8, 4, '#f8fafc');
        drawPixelRect(ctx, cx - 36, y - 16, 12, 4, '#7dd3fc');
        drawPixelRect(ctx, cx - 24, y - 20, 8, 4, '#e0f2fe');
      }

      // Headlights & Taillights swapped by facingDir
      if (facingDir === 1) {
        drawPixelRect(ctx, cx + 64, y - 2, 8, 10, '#fde047');
        drawPixelRect(ctx, cx - 72, y - 2, 8, 10, '#ef4444');
      } else {
        drawPixelRect(ctx, cx - 72, y - 2, 8, 10, '#fde047');
        drawPixelRect(ctx, cx + 64, y - 2, 8, 10, '#ef4444');
      }

      // Wheels
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

    // Draws the black silhouette figure of Bonnie lunging directly at the player inside the car,
    // smashing the front windshield in the middle of the jumpscare!
    const drawBlackSilhouetteBonnieOnCar = (
      ctx: CanvasRenderingContext2D,
      carX: number,
      carY: number,
      swerveSec: number,
      windshieldBroken: boolean
    ) => {
      // Lunge from the left road directly onto the front hood / windshield of the car
      const lungeProgress = Math.min(1, swerveSec / 0.25);
      const figX = carX - 180 + lungeProgress * 124; // Lands at carX - 56 (right over the front hood & windshield!)
      // Reduced vertical jitter so the silhouette and broken windshield are clearly appreciated
      const figY = carY - 12 + (Math.floor(swerveSec * 14) % 2) * 2;

      // Dark aura around the silhouette
      drawPixelRect(ctx, figX - 28, figY - 76, 64, 88, 'rgba(0, 0, 0, 0.45)');

      // Long iconic rabbit ears (pitch-black silhouette with subtle dark outline)
      drawPixelRect(ctx, figX - 18, figY - 88, 12, 36, '#18181b');
      drawPixelRect(ctx, figX - 16, figY - 86, 8, 32, '#020204');
      drawPixelRect(ctx, figX + 6, figY - 84, 12, 32, '#18181b');
      drawPixelRect(ctx, figX + 8, figY - 82, 8, 28, '#020204');

      // Silhouette Head lunging forward toward the driver window
      drawPixelRect(ctx, figX - 20, figY - 54, 44, 32, '#18181b');
      drawPixelRect(ctx, figX - 16, figY - 50, 36, 24, '#020204');

      // Silhouette Jaw & Snout open in a roar toward the driver inside the car
      drawPixelRect(ctx, figX - 8, figY - 26, 36, 12, '#020204');

      // Faint eerie white pinprick eyes staring right at the driver inside the car
      drawPixelRect(ctx, figX + 8, figY - 42, 4, 4, '#f8fafc');
      drawPixelRect(ctx, figX + 18, figY - 42, 4, 4, '#f8fafc');

      // Pitch-black torso & long clawed arms smashing through the front windshield
      drawPixelRect(ctx, figX - 22, figY - 18, 40, 36, '#020204');
      drawPixelRect(ctx, figX + 14, figY - 30, 32, 12, '#020204');
      drawPixelRect(ctx, figX + 18, figY - 12, 28, 10, '#020204');

      // Shattered front windshield cracks, jagged glass rim & flying shards once the front glass breaks mid-jumpscare!
      if (windshieldBroken) {
        // Jagged broken glass rim & spiderweb cracks along the front windshield & driver window
        drawPixelRect(ctx, carX - 46, carY - 28, 6, 20, '#020617');
        drawPixelRect(ctx, carX - 46, carY - 28, 8, 4, '#f8fafc');
        drawPixelRect(ctx, carX - 46, carY - 12, 8, 4, '#bae6fd');
        drawPixelRect(ctx, carX - 38, carY - 24, 14, 4, '#e0f2fe');
        drawPixelRect(ctx, carX - 34, carY - 18, 16, 4, '#7dd3fc');
        drawPixelRect(ctx, carX - 24, carY - 24, 10, 4, '#f8fafc');
        drawPixelRect(ctx, carX - 20, carY - 14, 10, 4, '#bae6fd');

        const shardAge = Math.max(0, swerveSec - POST_NIGHT_1_GLASS_BREAK_TIME_SEC);
        const burst = Math.min(28, shardAge * 48);
        drawPixelRect(ctx, carX - 44 + burst * 0.6, carY - 36 - burst * 0.4, 8, 4, '#e0f2fe');
        drawPixelRect(ctx, carX - 36 + burst * 0.8, carY - 44 - burst * 0.6, 6, 6, '#bae6fd');
        drawPixelRect(ctx, carX - 28 + burst * 0.9, carY - 28 - burst * 0.2, 8, 4, '#f8fafc');
        drawPixelRect(ctx, carX - 48 - burst * 0.5, carY - 32 - burst * 0.5, 6, 6, '#7dd3fc');
        drawPixelRect(ctx, carX - 20 + burst * 0.5, carY - 18 + burst * 0.2, 6, 4, '#e0f2fe');
      }
    };

    const draw8BitProtagonist = (
      ctx: CanvasRenderingContext2D,
      x: number,
      groundY: number,
      facing: -1 | 1,
      walkPhase: number,
      isWalking: boolean,
      isThinking = false,
      timeSec = 0
    ) => {
      // 4-step walking cycle for clear foot & leg stepping animation
      const stepFrame = isWalking ? Math.floor(walkPhase * 10) % 4 : 0;
      const leftStrideX =
        stepFrame === 1 ? 4 * facing : stepFrame === 3 ? -4 * facing : 0;
      const rightStrideX =
        stepFrame === 1 ? -4 * facing : stepFrame === 3 ? 4 * facing : 0;
      const leftLiftY = stepFrame === 1 ? -4 : 0;
      const rightLiftY = stepFrame === 3 ? -4 : 0;
      const bodyBobY = isWalking && (stepFrame === 1 || stepFrame === 3) ? -2 : 0;

      // Shadow
      drawPixelRect(ctx, x - 16, groundY - 4, 32, 6, 'rgba(0,0,0,0.55)');

      // Left Leg & Animated Foot/Shoe (32px leg assembly)
      drawPixelRect(ctx, x - 12 + leftStrideX, groundY - 32 + leftLiftY, 10, 24, '#1e293b');
      drawPixelRect(
        ctx,
        x - 12 + leftStrideX + (facing === 1 ? 0 : -4),
        groundY - 8 + leftLiftY,
        14,
        8,
        '#451a03'
      );

      // Right Leg & Animated Foot/Shoe
      drawPixelRect(ctx, x + 2 + rightStrideX, groundY - 32 + rightLiftY, 10, 24, '#0f172a');
      drawPixelRect(
        ctx,
        x + 2 + rightStrideX + (facing === 1 ? 0 : -4),
        groundY - 8 + rightLiftY,
        14,
        8,
        '#271509'
      );

      // Torso (Jacket - 36px tall, 28px wide)
      drawPixelRect(ctx, x - 14, groundY - 68 + bodyBobY, 28, 36, '#1e3a8a');
      drawPixelRect(ctx, x - 4, groundY - 64 + bodyBobY, 8, 28, '#93c5fd');

      // Arms (if thinking in 8-bit, one arm raises hand to chin; otherwise swings slightly when walking)
      drawPixelRect(
        ctx,
        x - 20,
        groundY - 64 + bodyBobY + (stepFrame === 3 ? -2 : 0),
        6,
        26,
        '#172554'
      );
      if (isThinking) {
        // Raised thinking arm + hand on chin
        drawPixelRect(ctx, x + 10, groundY - 76, 8, 20, '#172554');
        drawPixelRect(ctx, x + 6, groundY - 78, 8, 6, '#fcd34d');
      } else {
        drawPixelRect(
          ctx,
          x + 14,
          groundY - 64 + bodyBobY + (stepFrame === 1 ? -2 : 0),
          6,
          26,
          '#172554'
        );
      }

      // Head (24x24) & Hair/Cap (total height ~96px, matching 116px doors naturally)
      const headBob = isThinking ? (Math.floor(timeSec * 4) % 2) * 2 : bodyBobY;
      drawPixelRect(ctx, x - 12, groundY - 92 + headBob, 24, 24, '#fcd34d');
      // Hair / Cap
      drawPixelRect(ctx, x - 14, groundY - 96 + headBob, 28, 8, '#451a03');
      // Eye
      if (facing >= 0) {
        drawPixelRect(ctx, x + 4, groundY - 82 + headBob, 4, 4, '#09090b');
      } else {
        drawPixelRect(ctx, x - 8, groundY - 82 + headBob, 4, 4, '#09090b');
      }

      // 8-Bit Thought Bubble when thinking ("hace una animacion de pensar en 8 bit")
      if (isThinking) {
        drawPixelRect(ctx, x - 6, groundY - 108, 6, 6, '#f8fafc');
        drawPixelRect(ctx, x - 14, groundY - 118, 8, 8, '#f8fafc');
        drawPixelRect(ctx, x - 38, groundY - 146, 52, 24, '#f8fafc');
        drawPixelRect(ctx, x - 34, groundY - 142, 44, 16, '#09090b');
        // Animated "..." dots inside the 8-bit thought bubble
        const dots = (Math.floor(timeSec * 6) % 3) + 1;
        for (let d = 0; d < dots; d++) {
          drawPixelRect(ctx, x - 26 + d * 12, groundY - 136, 6, 6, '#fde047');
        }
      }
    };

    const drawRuinedWoodenBuilding = (ctx: CanvasRenderingContext2D, groundY: number) => {
      const bx = 655;
      const bw = 275;
      const bh = 230;
      const by = groundY - bh;

      drawPixelRect(ctx, bx - 16, by - 24, bw + 32, 24, '#271509');
      drawPixelRect(ctx, bx + 44, by - 28, 36, 12, '#04070d');
      drawPixelRect(ctx, bx + 168, by - 26, 48, 10, '#04070d');
      drawPixelRect(ctx, bx, by, bw, bh, '#3f220f');

      for (let py = by + 8; py < groundY - 8; py += 16) {
        drawPixelRect(ctx, bx + 4, py, bw - 8, 4, '#241207');
        const holeOffset = ((py * 17) % 160) + 24;
        drawPixelRect(ctx, bx + holeOffset, py - 4, 28, 8, '#170b04');
      }

      drawPixelRect(ctx, bx + 28, by + 20, 156, 32, '#1f1006');
      drawPixelRect(ctx, bx + 32, by + 24, 148, 24, '#542e14');
      drawPixelRect(ctx, bx + 44, by + 30, 16, 12, '#a16207');
      drawPixelRect(ctx, bx + 68, by + 30, 16, 12, '#713f12');
      drawPixelRect(ctx, bx + 92, by + 34, 16, 8, '#a16207');
      drawPixelRect(ctx, bx + 116, by + 28, 16, 12, '#713f12');
      drawPixelRect(ctx, bx + 140, by + 32, 20, 10, '#a16207');

      const wx = bx + 150;
      const wy = by + 86;
      drawPixelRect(ctx, wx, wy, 76, 68, '#09090b');
      drawPixelRect(ctx, wx - 6, wy + 12, 88, 12, '#78350f');
      drawPixelRect(ctx, wx - 4, wy + 42, 84, 12, '#65320d');

      const doorX = bx + 28;
      const doorW = 68;
      const doorH = 116;
      const doorY = groundY - doorH;
      drawPixelRect(ctx, doorX - 8, doorY - 8, doorW + 16, doorH + 8, '#5c2d10');
      drawPixelRect(ctx, doorX, doorY, doorW, doorH, '#030305');
      drawPixelRect(ctx, doorX + 4, doorY + 4, 44, 10, '#451a03');
    };

    const draw8BitRain = (
      ctx: CanvasRenderingContext2D,
      W: number,
      H: number,
      timeSec: number,
      isReverseDriving: boolean
    ) => {
      const backDropCount = 64;
      for (let i = 0; i < backDropCount; i++) {
        const seedX = (i * 137) % W;
        const seedY = (i * 293) % H;
        // When driving in reverse (leftward), rain streaks slant to the right relative to the car
        const driftX = isReverseDriving ? -timeSec * 220 : timeSec * 65;
        const fallY = timeSec * 520;
        const rx = (((seedX - driftX) % W) + W) % W;
        const ry = (seedY + fallY) % H;
        drawPixelRect(ctx, rx, ry, 4, 12, 'rgba(56, 189, 248, 0.38)');
      }

      const frontDropCount = 52;
      for (let i = 0; i < frontDropCount; i++) {
        const seedX = (i * 199 + 48) % W;
        const seedY = (i * 317 + 92) % H;
        const driftX = isReverseDriving ? -timeSec * 310 : timeSec * 90;
        const fallY = timeSec * 680;
        const rx = (((seedX - driftX) % W) + W) % W;
        const ry = (seedY + fallY) % H;
        drawPixelRect(ctx, rx, ry, 4, 16, 'rgba(147, 197, 253, 0.62)');
        drawPixelRect(ctx, rx, ry + 12, 4, 4, 'rgba(224, 242, 254, 0.8)');
      }

      const splashCount = 26;
      const tickStep = Math.floor(timeSec * 14);
      for (let s = 0; s < splashCount; s++) {
        if ((s + tickStep) % 3 !== 0) continue;
        const sx = ((s * 173 + tickStep * 64) % (W - 32)) + 16;
        const sy = isReverseDriving ? 204 + ((s * 47) % 112) : 364 + ((s * 53) % 56);
        drawPixelRect(ctx, sx - 4, sy, 4, 4, 'rgba(186, 230, 253, 0.72)');
        drawPixelRect(ctx, sx + 4, sy, 4, 4, 'rgba(186, 230, 253, 0.72)');
        drawPixelRect(ctx, sx, sy - 4, 4, 4, 'rgba(125, 211, 252, 0.55)');
      }
    };

    const drawHotelRoomScene = (
      ctx: CanvasRenderingContext2D,
      W: number,
      H: number,
      timeSec: number,
      currentPhase: PostNight1MinigamePhase,
      wakeElapsed: number,
      playerX: number,
      playerFacing: -1 | 1,
      walkCycle: number,
      isWalking: boolean,
      isThinking: boolean,
      ceilingLightOn: boolean
    ) => {
      const roomLeft = 140;
      const roomRight = 820;
      const roomTop = 64;
      const floorY = 380;
      const roomW = roomRight - roomLeft;
      const roomH = floorY - roomTop;

      // Outer black border
      ctx.fillStyle = '#030408';
      ctx.fillRect(0, 0, W, H);

      // Outer polished golden-ivory room frame
      drawPixelRect(ctx, roomLeft - 8, roomTop - 8, roomW + 16, roomH + 64, '#d6c79c');
      drawPixelRect(ctx, roomLeft - 4, roomTop - 4, roomW + 8, roomH + 56, '#fef9c3');

      // Upper hotel wall: refined warm ivory/cream white & polished soft yellow wallpaper stripes
      drawPixelRect(ctx, roomLeft, roomTop, roomW, roomH, '#f5f0e1');
      for (let wx = roomLeft + 12; wx < roomRight - 8; wx += 24) {
        drawPixelRect(ctx, wx, roomTop + 12, 8, roomH - 80, '#ede3c8');
      }

      // Polished warm yellow/gold crown molding at top of the wall
      drawPixelRect(ctx, roomLeft, roomTop, roomW, 10, '#eab308');
      drawPixelRect(ctx, roomLeft, roomTop + 10, roomW, 4, '#fef08a');

      // Lower wainscoting in crisp pearl white with polished golden-yellow chair rail
      drawPixelRect(ctx, roomLeft, floorY - 72, roomW, 72, '#faf8f5');
      drawPixelRect(ctx, roomLeft, floorY - 76, roomW, 6, '#eab308');
      drawPixelRect(ctx, roomLeft, floorY - 70, roomW, 4, '#fef08a');
      // Wainscoting recessed decorative panels
      for (let px = roomLeft + 20; px < roomRight - 40; px += 68) {
        drawPixelRect(ctx, px, floorY - 58, 48, 42, '#eee8d5');
        drawPixelRect(ctx, px + 4, floorY - 54, 40, 34, '#ffffff');
      }
      // Baseboard trim
      drawPixelRect(ctx, roomLeft, floorY - 8, roomW, 8, '#d6c79c');

      // Warm honey-oak floorboards
      drawPixelRect(ctx, roomLeft, floorY, roomW, 48, '#78350f');
      drawPixelRect(ctx, roomLeft, floorY, roomW, 8, '#92400e');
      for (let fx = roomLeft; fx < roomRight; fx += 64) {
        drawPixelRect(ctx, fx, floorY, 4, 48, '#451a03');
      }

      // --- WINDOW IN THE UPPER RIGHT ("mueve la ventana arriba a la derecha") ---
      const winX = 636;
      const winY = 86;
      const winW = 128;
      const winH = 92;
      // Polished white outer window frame + golden sill
      drawPixelRect(ctx, winX - 8, winY - 8, winW + 16, winH + 16, '#ffffff');
      drawPixelRect(ctx, winX - 12, winY + winH + 4, winW + 24, 8, '#eab308');
      // Dark night sky glass panes
      drawPixelRect(ctx, winX, winY, winW, winH, '#090d16');
      // Star & moonlight gleam in upper-right window
      drawPixelRect(ctx, winX + 24, winY + 18, 12, 12, '#f8fafc');
      drawPixelRect(ctx, winX + 92, winY + 26, 4, 4, '#cbd5e1');
      // Crisp white window mullions (crossbars)
      drawPixelRect(ctx, winX + 62, winY, 4, winH, '#f8fafc');
      drawPixelRect(ctx, winX, winY + 44, winW, 4, '#f8fafc');
      // Polished yellow-gold curtains framing the window
      drawPixelRect(ctx, winX - 16, winY - 12, winW + 32, 6, '#ca8a04');
      drawPixelRect(ctx, winX - 14, winY - 6, 14, winH + 10, '#facc15');
      drawPixelRect(ctx, winX + winW, winY - 6, 14, winH + 10, '#facc15');

      // --- DOOR IN THE MIDDLE (scaled proportionally to the 96px protagonist: 68x116) ---
      const doorW = 68;
      const doorH = 116;
      const doorX = 446; // Centered at x = 480
      const doorY = floorY - doorH;
      // Crisp white & polished gold door frame
      drawPixelRect(ctx, doorX - 8, doorY - 8, doorW + 16, doorH + 8, '#ffffff');
      drawPixelRect(ctx, doorX - 4, doorY - 4, doorW + 8, doorH + 4, '#eab308');
      // Elegant warm wood & cream paneled hotel door
      drawPixelRect(ctx, doorX, doorY, doorW, doorH, '#78350f');
      drawPixelRect(ctx, doorX + 6, doorY + 6, doorW - 12, doorH - 12, '#92400e');
      // Upper and lower recessed door panels
      drawPixelRect(ctx, doorX + 12, doorY + 12, doorW - 24, 38, '#5c2d10');
      drawPixelRect(ctx, doorX + 16, doorY + 16, doorW - 32, 30, '#78350f');
      drawPixelRect(ctx, doorX + 12, doorY + 62, doorW - 24, 42, '#5c2d10');
      drawPixelRect(ctx, doorX + 16, doorY + 66, doorW - 32, 34, '#78350f');
      // Golden room number plaque & brass doorknob at natural hand height
      drawPixelRect(ctx, doorX + 24, doorY + 24, 20, 8, '#fde047');
      drawPixelRect(ctx, doorX + doorW - 14, doorY + 56, 8, 8, '#fde047');
      drawPixelRect(ctx, doorX + doorW - 12, doorY + 58, 4, 4, '#ca8a04');

      // --- WALL LIGHT SWITCH NEXT TO THE DOOR (at chest/shoulder height) ---
      const switchX = HOTEL_LIGHT_SWITCH_X; // 538 (right next to the central door frame)
      const switchY = floorY - 72;
      // Switch wall plate
      drawPixelRect(ctx, switchX - 8, switchY - 12, 16, 24, '#e2e8f0');
      drawPixelRect(ctx, switchX - 6, switchY - 10, 12, 20, '#ffffff');
      // Rocker switch toggle (up/amber when ON, down/slate when OFF)
      drawPixelRect(
        ctx,
        switchX - 4,
        ceilingLightOn ? switchY - 6 : switchY,
        8,
        8,
        ceilingLightOn ? '#eab308' : '#475569'
      );

      // --- BED ON THE LEFT (x = 168..292) ---
      const bedX = 168;
      const bedW = 124;
      // Headboard
      drawPixelRect(ctx, bedX, floorY - 80, 16, 80, '#5c2d10');
      drawPixelRect(ctx, bedX + 4, floorY - 84, 12, 8, '#eab308');
      // Bed frame & legs
      drawPixelRect(ctx, bedX, floorY - 32, bedW, 20, '#78350f');
      drawPixelRect(ctx, bedX, floorY - 12, 12, 12, '#451a03');
      drawPixelRect(ctx, bedX + bedW - 12, floorY - 12, 12, 12, '#451a03');
      // Crisp white mattress & pillow
      drawPixelRect(ctx, bedX + 16, floorY - 46, bedW - 20, 16, '#ffffff');
      drawPixelRect(ctx, bedX + 20, floorY - 56, 32, 12, '#f8fafc');
      // Refined white & polished yellow-gold hotel bedspread
      drawPixelRect(ctx, bedX + 48, floorY - 46, bedW - 52, 18, '#fef08a');
      drawPixelRect(ctx, bedX + 56, floorY - 46, bedW - 60, 14, '#eab308');

      // --- BEDSIDE NIGHTSTAND ("mesilla") & SMALL LAMP NEXT TO THE BED ("al lado de la cama haya una mesilla con una pequeña lampara iluminando la zona cercana") ---
      const nightstandX = 300;
      const nightstandW = 48;
      const nightstandTopY = floorY - 44;
      // Nightstand cabinet body & legs
      drawPixelRect(ctx, nightstandX, nightstandTopY, nightstandW, 38, '#5c2d10');
      drawPixelRect(ctx, nightstandX + 4, nightstandTopY + 4, nightstandW - 8, 30, '#78350f');
      drawPixelRect(ctx, nightstandX - 2, nightstandTopY, nightstandW + 4, 6, '#92400e');
      drawPixelRect(ctx, nightstandX + 4, floorY - 6, 8, 6, '#451a03');
      drawPixelRect(ctx, nightstandX + nightstandW - 12, floorY - 6, 8, 6, '#451a03');
      // Nightstand small drawer + golden knob
      drawPixelRect(ctx, nightstandX + 8, nightstandTopY + 10, nightstandW - 16, 14, '#451a03');
      drawPixelRect(ctx, nightstandX + 10, nightstandTopY + 12, nightstandW - 20, 10, '#5c2d10');
      drawPixelRect(ctx, nightstandX + 20, nightstandTopY + 15, 8, 4, '#fde047');

      // Small bedside lamp on top of the nightstand (always ON, illuminating the nearby area!)
      const bedsideLampX = nightstandX + 24; // 324
      const bedsideLampBaseY = nightstandTopY;
      // Golden lamp base & stem
      drawPixelRect(ctx, bedsideLampX - 8, bedsideLampBaseY - 4, 16, 4, '#ca8a04');
      drawPixelRect(ctx, bedsideLampX - 4, bedsideLampBaseY - 12, 8, 8, '#eab308');
      // Warm glowing small lampshade
      drawPixelRect(ctx, bedsideLampX - 14, bedsideLampBaseY - 26, 28, 14, '#fef08a');
      drawPixelRect(ctx, bedsideLampX - 10, bedsideLampBaseY - 24, 20, 10, '#ffffff');
      drawPixelRect(ctx, bedsideLampX - 14, bedsideLampBaseY - 28, 28, 4, '#eab308');

      // --- CHEST OF DRAWERS ("el mueble donde esta situado el telefono debe ser de los que tiene cajones") & TELEPHONE ON THE RIGHT ---
      const deskX = 640;
      const deskW = 84;
      const deskTopY = floorY - 56;
      // Solid wooden dresser/cabinet body with golden top molding
      drawPixelRect(ctx, deskX - 4, deskTopY, deskW + 8, 8, '#92400e');
      drawPixelRect(ctx, deskX, deskTopY + 4, deskW, 4, '#eab308');
      drawPixelRect(ctx, deskX, deskTopY + 8, deskW, 44, '#5c2d10');
      drawPixelRect(ctx, deskX + 4, deskTopY + 10, deskW - 8, 40, '#78350f');
      // Cabinet feet
      drawPixelRect(ctx, deskX + 4, floorY - 4, 10, 4, '#451a03');
      drawPixelRect(ctx, deskX + deskW - 14, floorY - 4, 10, 4, '#451a03');
      // 3 stacked horizontal drawers with recessed borders and golden handles ("cajones")
      for (let d = 0; d < 3; d++) {
        const dy = deskTopY + 12 + d * 12;
        drawPixelRect(ctx, deskX + 8, dy, deskW - 16, 10, '#451a03');
        drawPixelRect(ctx, deskX + 10, dy + 2, deskW - 20, 6, '#5c2d10');
        // Golden drawer handle in the middle of each drawer
        drawPixelRect(ctx, deskX + deskW / 2 - 6, dy + 3, 12, 4, '#fde047');
      }

      // Hotel Telephone on the chest of drawers (HOTEL_PHONE_X = 676)
      const isRinging = currentPhase === 'HOTEL_PHONE_RINGING_WALK';
      const ringShakeX = isRinging ? (Math.floor(timeSec * 24) % 2 === 0 ? -4 : 4) : 0;
      const ringShakeY = isRinging ? (Math.floor(timeSec * 18) % 2 === 0 ? -4 : 0) : 0;
      // Phone base
      drawPixelRect(ctx, HOTEL_PHONE_X - 16 + ringShakeX, deskTopY - 14, 32, 14, '#dc2626');
      // Phone handset (lifted if in conversation)
      if (currentPhase === 'HOTEL_PHONE_CONVERSATION' || currentPhase === 'HOTEL_CHOICE_NO_FEEDBACK') {
        drawPixelRect(ctx, HOTEL_PHONE_X - 10, deskTopY - 18, 20, 6, '#991b1b');
      } else {
        drawPixelRect(ctx, HOTEL_PHONE_X - 20 + ringShakeX, deskTopY - 22 + ringShakeY, 40, 8, '#ef4444');
      }

      // 8-Bit Sound Waves when phone is ringing
      if (isRinging && Math.floor(timeSec * 6) % 2 === 0) {
        drawPixelRect(ctx, HOTEL_PHONE_X - 32, deskTopY - 34, 6, 12, '#fde047');
        drawPixelRect(ctx, HOTEL_PHONE_X + 26, deskTopY - 34, 6, 12, '#fde047');
        drawPixelRect(ctx, HOTEL_PHONE_X - 12, deskTopY - 44, 24, 6, '#fde047');
      }

      // --- PROTAGONIST RENDERING (WAKING UP IN BED vs STANDING/WALKING) ---
      if (currentPhase === 'HOTEL_WAKE_ANIMATION') {
        if (wakeElapsed < 1.1) {
          // Stage 1: Lying horizontally in bed
          drawPixelRect(ctx, bedX + 24, floorY - 58, 20, 16, '#fcd34d'); // Head on pillow
          drawPixelRect(ctx, bedX + 22, floorY - 62, 16, 6, '#451a03'); // Hair
          drawPixelRect(ctx, bedX + 44, floorY - 50, 56, 14, '#eab308'); // Body under blanket
        } else if (wakeElapsed < 2.2) {
          // Stage 2: Sitting up in bed
          drawPixelRect(ctx, bedX + 36, floorY - 70, 24, 26, '#1e3a8a'); // Upright torso on mattress
          drawPixelRect(ctx, bedX + 38, floorY - 90, 20, 20, '#fcd34d'); // Head
          drawPixelRect(ctx, bedX + 36, floorY - 94, 24, 8, '#451a03'); // Hair
          drawPixelRect(ctx, bedX + 52, floorY - 82, 4, 4, '#09090b'); // Eye looking right
        } else {
          // Stage 3: Getting out of bed
          const standProgress = Math.min(1, (wakeElapsed - 2.2) / 0.8);
          const standX = bedX + 64 + standProgress * (HOTEL_BED_STAND_X - (bedX + 64));
          draw8BitProtagonist(ctx, standX, floorY + 12, 1, standProgress * 2, true, false, timeSec);
        }
      } else {
        draw8BitProtagonist(
          ctx,
          playerX,
          floorY + 12,
          playerFacing,
          walkCycle,
          isWalking,
          isThinking,
          timeSec
        );
      }

      // --- ROOM LIGHTING: MAIN CEILING LIGHT CONE (TOGGLEABLE VIA SWITCH) + BEDSIDE LAMP LOCAL GLOW (ALWAYS ON) ---
      const lampCx = 480;
      const coneTopY = roomTop + 28;
      const coneBottomY = floorY + 48;
      const bedsideLightCx = bedsideLampX;
      const bedsideLightCy = bedsideLampBaseY - 20;

      if (ceilingLightOn) {
        // Soft warm ambient shading outside the main light cone
        ctx.save();
        ctx.fillStyle = 'rgba(15, 23, 42, 0.24)';
        ctx.beginPath();
        ctx.rect(roomLeft, roomTop, roomW, roomH + 48);
        ctx.moveTo(lampCx - 36, coneTopY);
        ctx.lineTo(lampCx + 36, coneTopY);
        ctx.lineTo(roomRight - 12, coneBottomY);
        ctx.lineTo(roomLeft + 12, coneBottomY);
        ctx.closePath();
        ctx.fill('evenodd');
        ctx.restore();

        // Warm golden gradient cone from ceiling lamp
        const coneGrad = ctx.createLinearGradient(lampCx, coneTopY, lampCx, coneBottomY);
        coneGrad.addColorStop(0, 'rgba(254, 240, 138, 0.52)');
        coneGrad.addColorStop(0.45, 'rgba(253, 224, 71, 0.26)');
        coneGrad.addColorStop(1, 'rgba(254, 249, 195, 0.14)');

        ctx.save();
        ctx.fillStyle = coneGrad;
        ctx.beginPath();
        ctx.moveTo(lampCx - 32, coneTopY);
        ctx.lineTo(lampCx + 32, coneTopY);
        ctx.lineTo(roomRight - 16, coneBottomY);
        ctx.lineTo(roomLeft + 16, coneBottomY);
        ctx.closePath();
        ctx.fill();

        const innerGrad = ctx.createLinearGradient(lampCx, coneTopY, lampCx, coneBottomY);
        innerGrad.addColorStop(0, 'rgba(255, 255, 255, 0.42)');
        innerGrad.addColorStop(0.5, 'rgba(254, 240, 138, 0.22)');
        innerGrad.addColorStop(1, 'rgba(253, 224, 71, 0.10)');
        ctx.fillStyle = innerGrad;
        ctx.beginPath();
        ctx.moveTo(lampCx - 16, coneTopY);
        ctx.lineTo(lampCx + 16, coneTopY);
        ctx.lineTo(lampCx + 210, coneBottomY);
        ctx.lineTo(lampCx - 210, coneBottomY);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else {
        // Main room light is OFF: darken the room EXCEPT the nearby area around the small bedside lamp!
        ctx.save();
        const darkGrad = ctx.createRadialGradient(
          bedsideLightCx,
          bedsideLightCy,
          18,
          bedsideLightCx,
          bedsideLightCy,
          145
        );
        darkGrad.addColorStop(0, 'rgba(5, 8, 18, 0.08)');
        darkGrad.addColorStop(0.55, 'rgba(5, 8, 18, 0.42)');
        darkGrad.addColorStop(1, 'rgba(5, 8, 18, 0.78)');
        ctx.fillStyle = darkGrad;
        ctx.fillRect(roomLeft, roomTop, roomW, roomH + 48);
        ctx.restore();
      }

      // Warm localized glow from the small bedside lamp ("pequeña lampara iluminando la zona cercana") — ALWAYS active!
      ctx.save();
      const bedsideGrad = ctx.createRadialGradient(
        bedsideLightCx,
        bedsideLightCy,
        6,
        bedsideLightCx,
        bedsideLightCy,
        118
      );
      bedsideGrad.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
      bedsideGrad.addColorStop(0.35, 'rgba(254, 240, 138, 0.42)');
      bedsideGrad.addColorStop(0.7, 'rgba(250, 204, 21, 0.18)');
      bedsideGrad.addColorStop(1, 'rgba(250, 204, 21, 0)');
      ctx.fillStyle = bedsideGrad;
      ctx.beginPath();
      ctx.arc(bedsideLightCx, bedsideLightCy, 118, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Ceiling Lamp Fixture drawn crisp on top of the ceiling apex
      drawPixelRect(ctx, lampCx - 8, roomTop, 16, 16, '#ca8a04');
      drawPixelRect(ctx, lampCx - 28, roomTop + 16, 56, 10, '#eab308');
      drawPixelRect(
        ctx,
        lampCx - 24,
        roomTop + 24,
        48,
        8,
        ceilingLightOn ? '#fef08a' : '#52525b'
      );
      drawPixelRect(
        ctx,
        lampCx - 16,
        roomTop + 28,
        32,
        4,
        ceilingLightOn ? '#ffffff' : '#3f3f46'
      );
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const sim = simRef.current;
      const currentPhase = phaseRef.current;

      // 1. Update Simulation per Phase
      if (currentPhase === 'WALK_TO_CAR') {
        const moveDir: -1 | 0 | 1 =
          sim.keysHeld.left && !sim.keysHeld.right
            ? -1
            : sim.keysHeld.right && !sim.keysHeld.left
            ? 1
            : 0;

        if (moveDir !== 0) {
          sim.playerFacing = moveDir;
          sim.walkCycle += dt;
          const stepped = stepWalkBackToCar(sim.playerX, moveDir, dt);
          sim.playerX = stepped.x;
          if (stepped.reachedCar) {
            sim.keysHeld.left = false;
            sim.keysHeld.right = false;
            sim.inCar = true;
            sim.fadeAlpha = 0;
            setPhase('MOUNT_CAR_FADE_OUT');
          }
        }
      } else if (currentPhase === 'MOUNT_CAR_FADE_OUT') {
        sim.fadeAlpha = Math.min(1, sim.fadeAlpha + dt * 0.9);
        if (sim.fadeAlpha >= 1) {
          sim.cruiseElapsedSec = 0;
          sim.lightningFlashAlpha = 0;
          setPhase('REVERSE_DRIVING_FADE_IN');
        }
      } else if (currentPhase === 'REVERSE_DRIVING_FADE_IN') {
        sim.scrollOffset = (sim.scrollOffset + dt * 260) % 160;
        sim.fadeAlpha = Math.max(0, sim.fadeAlpha - dt * 0.95);
        if (sim.fadeAlpha <= 0) {
          sim.cruiseElapsedSec = 0;
          setPhase('REVERSE_DRIVING_CRUISE');
        }
      } else if (currentPhase === 'REVERSE_DRIVING_CRUISE') {
        sim.scrollOffset = (sim.scrollOffset + dt * 260) % 160;
        sim.cruiseElapsedSec += dt;
        if (sim.cruiseElapsedSec >= POST_NIGHT_1_THUNDER_DELAY_SEC) {
          // Strike lightning & thunder after 4 seconds!
          sim.lightningFlashAlpha = 1.0;
          soundController.playThunderStrike();
          setPhase('REVERSE_DRIVING_THUNDER_DIALOGUE');
        }
      } else if (currentPhase === 'REVERSE_DRIVING_THUNDER_DIALOGUE') {
        sim.scrollOffset = (sim.scrollOffset + dt * 260) % 160;
        sim.lightningFlashAlpha = Math.max(0, sim.lightningFlashAlpha - dt * 1.15);
      } else if (currentPhase === 'REVERSE_DRIVING_BONNIE_SWERVE') {
        sim.scrollOffset = (sim.scrollOffset + dt * 320) % 160;
        sim.swerveElapsedSec += dt;

        // Break the front windshield and play "glass-break-sfx" in the middle of the jumpscare!
        if (sim.swerveElapsedSec >= POST_NIGHT_1_GLASS_BREAK_TIME_SEC && !sim.glassBroken) {
          sim.glassBroken = true;
          soundController.playGlassBreak();
        }

        // Start fading to black as the car half-derails/swerves on the road
        if (sim.swerveElapsedSec > 1.15) {
          sim.fadeAlpha = Math.min(1, sim.fadeAlpha + dt * 1.05);
        }
        if (sim.fadeAlpha >= 1 && sim.swerveElapsedSec >= 2.1) {
          sim.wakeElapsedSec = 0;
          sim.playerX = HOTEL_BED_STAND_X;
          sim.playerFacing = 1;
          setPhase('HOTEL_WAKE_ANIMATION');
        }
      } else if (currentPhase === 'HOTEL_WAKE_ANIMATION') {
        sim.wakeElapsedSec += dt;
        if (sim.wakeElapsedSec < 0.9) {
          sim.fadeAlpha = Math.max(0, 1 - sim.wakeElapsedSec / 0.8);
        } else {
          sim.fadeAlpha = 0;
        }
        if (sim.wakeElapsedSec >= 3.0) {
          sim.playerX = HOTEL_BED_STAND_X;
          sim.playerFacing = 1;
          setPhase('HOTEL_WAKE_DIALOGUE');
        }
      } else if (currentPhase === 'HOTEL_PHONE_RINGING_WALK') {
        const moveDir: -1 | 0 | 1 =
          sim.keysHeld.right && !sim.keysHeld.left
            ? 1
            : sim.keysHeld.left && !sim.keysHeld.right
            ? -1
            : 0;

        if (moveDir !== 0) {
          sim.playerFacing = moveDir;
          sim.walkCycle += dt;
          sim.playerX = Math.max(
            HOTEL_MIN_WALK_X,
            Math.min(HOTEL_MAX_WALK_X, sim.playerX + moveDir * INTRO_WALK_SPEED_PX_PER_SEC * dt)
          );
          const nowNearPhone = isNearHotelPhone(sim.playerX);
          setNearPhone((prev) => (prev !== nowNearPhone ? nowNearPhone : prev));
          const nowNearSwitch = isNearHotelLightSwitch(sim.playerX);
          setNearLightSwitch((prev) => (prev !== nowNearSwitch ? nowNearSwitch : prev));
        }
      } else if (currentPhase === 'HOTEL_FADE_OUT') {
        sim.fadeAlpha = Math.min(1, sim.fadeAlpha + dt * 0.9);
        if (sim.fadeAlpha >= 1) {
          sim.playerX = INTRO_OUTSIDE_SPAWN_X;
          sim.playerFacing = 1;
          sim.inCar = false;
          setPhase('RETURN_OUTSIDE_FADE_IN');
        }
      } else if (currentPhase === 'RETURN_OUTSIDE_FADE_IN') {
        sim.fadeAlpha = Math.max(0, sim.fadeAlpha - dt * 0.95);
        if (sim.fadeAlpha <= 0) {
          setPhase('RETURN_OUTSIDE_WALK');
        }
      } else if (currentPhase === 'RETURN_OUTSIDE_WALK') {
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
          if (stepped.reachedDoorStop) {
            sim.keysHeld.left = false;
            sim.keysHeld.right = false;
            setPhase('RETURN_OUTSIDE_DOOR_DIALOGUE');
          }
        }
      } else if (currentPhase === 'RETURN_ENTERING_FADE_OUT') {
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

      // 2. Render Active 8-Bit Scene
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = false;
          const W = canvas.width; // 960
          const H = canvas.height; // 540
          const timeSec = now / 1000;

          const isReverseDrivingScene =
            currentPhase === 'REVERSE_DRIVING_FADE_IN' ||
            currentPhase === 'REVERSE_DRIVING_CRUISE' ||
            currentPhase === 'REVERSE_DRIVING_THUNDER_DIALOGUE' ||
            currentPhase === 'REVERSE_DRIVING_BONNIE_SWERVE';

          const isHotelScene =
            currentPhase === 'HOTEL_WAKE_ANIMATION' ||
            currentPhase === 'HOTEL_WAKE_DIALOGUE' ||
            currentPhase === 'HOTEL_PHONE_RINGING_WALK' ||
            currentPhase === 'HOTEL_PHONE_CONVERSATION' ||
            currentPhase === 'HOTEL_CHOICE_NO_FEEDBACK' ||
            currentPhase === 'HOTEL_FADE_OUT';

          if (isHotelScene) {
            const isWalking =
              currentPhase === 'HOTEL_PHONE_RINGING_WALK' &&
              (sim.keysHeld.left || sim.keysHeld.right);
            drawHotelRoomScene(
              ctx,
              W,
              H,
              timeSec,
              currentPhase,
              sim.wakeElapsedSec,
              sim.playerX,
              sim.playerFacing,
              sim.walkCycle,
              isWalking,
              sim.thinkingAnimActive,
              roomLightOnRef.current
            );
          } else if (isReverseDrivingScene) {
            // --- SCENE 2: REVERSE DRIVING (CAR MOVING RIGHT-TO-LEFT, TREES SCROLLING LEFT-TO-RIGHT) ---
            const flash = sim.lightningFlashAlpha;
            ctx.fillStyle = flash > 0.35 ? '#cbd5e1' : '#04070d';
            ctx.fillRect(0, 0, W, H);

            // Top & bottom forest ground (illuminated when lightning flashes)
            drawPixelRect(ctx, 0, 0, W, 196, flash > 0.35 ? '#1e3a2f' : '#05140d');
            drawPixelRect(ctx, 0, 324, W, H - 324, flash > 0.35 ? '#1e3a2f' : '#05140d');

            // 8-Bit Jagged Lightning Bolt in the upper sky during thunder flash!
            if (flash > 0.12) {
              ctx.fillStyle = `rgba(224, 242, 254, ${Math.min(1, flash * 1.2).toFixed(2)})`;
              drawPixelRect(ctx, 310, 0, 12, 48, '#e0f2fe');
              drawPixelRect(ctx, 294, 44, 20, 12, '#bae6fd');
              drawPixelRect(ctx, 294, 52, 12, 52, '#e0f2fe');
              drawPixelRect(ctx, 302, 100, 24, 12, '#bae6fd');
              drawPixelRect(ctx, 318, 108, 10, 56, '#ffffff');
            }

            // Highway asphalt in the middle
            drawPixelRect(ctx, 0, 196, W, 128, flash > 0.45 ? '#334155' : '#18181b');
            drawPixelRect(ctx, 0, 196, W, 8, '#3f3f46');
            drawPixelRect(ctx, 0, 316, W, 8, '#3f3f46');

            // Looping dashed road line scrolling RIGHT (reverse direction!)
            for (let rx = -160; rx < W + 160; rx += 80) {
              const drawX = rx + (sim.scrollOffset % 80);
              drawPixelRect(ctx, drawX, 256, 40, 8, '#ca8a04');
            }

            // Looping top forest trees scrolling RIGHT
            for (let tx = -160; tx < W + 160; tx += 80) {
              const drawX = tx + (sim.scrollOffset % 80);
              draw8BitPineTree(ctx, drawX + 20, 140, 1.0, flash);
              draw8BitPineTree(ctx, drawX + 56, 184, 1.15, flash);
            }

            // Calculate car position: reduced shaking amplitude during Bonnie jumpscare so the scene and broken windshield are appreciated clearly!
            let carX = W * 0.54;
            let carY = 248;
            if (currentPhase === 'REVERSE_DRIVING_BONNIE_SWERVE') {
              const sw = sim.swerveElapsedSec;
              // Reduced, controlled swerve on the road ("el agitamiento del coche durante el jumpscare tiene que ser mas reducido para que se aprecie mejor")
              carY = 248 + Math.sin(sw * 11) * 9;
              carX = W * 0.54 + Math.cos(sw * 13) * 5;
              // Draw 8-bit black tire skid marks on the asphalt behind the swerving car
              for (let k = 1; k <= 6; k++) {
                const trailY = 248 + Math.sin(Math.max(0, sw - k * 0.05) * 11) * 9;
                drawPixelRect(ctx, carX + k * 24, trailY + 12, 20, 6, '#09090b');
                drawPixelRect(ctx, carX + k * 24, trailY - 8, 20, 6, '#09090b');
              }
            }

            // Draw Car facing LEFT (-1), with shattered front windshield once glassBroken triggers mid-jumpscare
            draw8BitCar(
              ctx,
              carX,
              carY,
              true,
              timeSec,
              true,
              -1,
              currentPhase === 'REVERSE_DRIVING_BONNIE_SWERVE' && sim.glassBroken
            );

            // If in REVERSE_DRIVING_BONNIE_SWERVE, draw the black silhouette of Bonnie attacking the player inside the car!
            if (currentPhase === 'REVERSE_DRIVING_BONNIE_SWERVE') {
              drawBlackSilhouetteBonnieOnCar(
                ctx,
                carX,
                carY,
                sim.swerveElapsedSec,
                sim.glassBroken
              );
            }

            // Looping bottom foreground forest trees scrolling RIGHT
            for (let tx = -160; tx < W + 160; tx += 80) {
              const drawX = tx + (sim.scrollOffset % 80);
              draw8BitPineTree(ctx, drawX + 36, 430, 1.25, flash);
            }

            draw8BitRain(ctx, W, H, timeSec, true);

            // Extra sky lightning flash overlay
            if (flash > 0.05) {
              ctx.fillStyle = `rgba(224, 242, 254, ${(flash * 0.55).toFixed(3)})`;
              ctx.fillRect(0, 0, W, H);
            }
          } else {
            // --- SCENE 1 (EXITING BUILDING WITH CAR) & SCENE 4 (RETURNING OUTSIDE WITHOUT CAR) ---
            const hasCar =
              currentPhase === 'EXIT_BUILDING_DIALOGUE' ||
              currentPhase === 'WALK_TO_CAR' ||
              currentPhase === 'MOUNT_CAR_FADE_OUT';

            ctx.fillStyle = '#04070d';
            ctx.fillRect(0, 0, W, H);

            const groundY = 368;
            drawPixelRect(ctx, 120, 48, 8, 8, '#94a3b8');
            drawPixelRect(ctx, 310, 72, 4, 4, '#64748b');
            drawPixelRect(ctx, 520, 40, 8, 8, '#94a3b8');

            for (let tx = 40; tx < 640; tx += 76) {
              draw8BitPineTree(ctx, tx, groundY, 1.2, 0);
            }

            drawPixelRect(ctx, 0, groundY, W, H - groundY, '#09140e');
            drawPixelRect(ctx, 0, groundY, 740, 36, '#1c1917');
            drawPixelRect(ctx, 40, groundY + 8, 680, 20, '#292524');

            drawRuinedWoodenBuilding(ctx, groundY);

            // In Scene 1 the car is parked on the left; in Scene 4 there is NO car ("solo que ahora no hay coche")
            if (hasCar) {
              draw8BitCar(ctx, 118, groundY - 12, false, timeSec, sim.inCar, 1, false);
            }

            if (!sim.inCar) {
              const isWalking =
                ((currentPhase === 'WALK_TO_CAR' || currentPhase === 'RETURN_OUTSIDE_WALK') &&
                  (sim.keysHeld.left || sim.keysHeld.right)) ||
                currentPhase === 'RETURN_ENTERING_FADE_OUT';

              draw8BitProtagonist(
                ctx,
                sim.playerX,
                groundY + 14,
                sim.playerFacing,
                sim.walkCycle,
                isWalking,
                false,
                timeSec
              );
            }

            draw8BitRain(ctx, W, H, timeSec, false);
          }

          // Classic 8-Bit CRT Scanlines Overlay
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

  // Helper to render segmented text with slightTremble or slowTremble (matching Night 1 OfficePhoneNarrativeOverlay)
  const renderSegmentedDialogueText = () => {
    if (!activeTab) return null;
    let remaining = typedChars;

    return activeTab.segments.map((seg, segIdx) => {
      if (remaining <= 0) return null;
      const visibleText = seg.text.slice(0, remaining);
      remaining -= visibleText.length;

      if (seg.slowTremble) {
        return (
          <span
            key={segIdx}
            data-testid="post-night1-slow-tremble-text"
            className="inline-block whitespace-nowrap"
          >
            {visibleText.split('').map((ch, charIdx) => {
              const seed = charIdx * 17 + trembleTick * 13;
              const dx = ((seed % 3) - 1) * 0.55;
              const dy = (((seed * 7) % 3) - 1) * 0.55;
              return (
                <span
                  key={charIdx}
                  data-testid="trembling-letter"
                  style={{
                    display: 'inline-block',
                    transform: `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px)`,
                    color: '#ef4444',
                    textShadow: '0 0 6px rgba(239, 68, 68, 0.75)',
                    fontWeight: 900,
                  }}
                >
                  {ch === ' ' ? '\u00A0' : ch}
                </span>
              );
            })}
          </span>
        );
      }

      if (seg.slightTremble) {
        return (
          <span
            key={segIdx}
            data-testid="post-night1-slight-tremble-text"
            className="inline-block"
          >
            {visibleText.split('').map((ch, charIdx) => {
              const seed = charIdx * 17 + trembleTick * 13;
              const dx = ((seed % 3) - 1) * 0.55;
              const dy = (((seed * 7) % 3) - 1) * 0.55;
              return (
                <span
                  key={charIdx}
                  style={{
                    display: 'inline-block',
                    transform: `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px)`,
                  }}
                >
                  {ch === ' ' ? '\u00A0' : ch}
                </span>
              );
            })}
          </span>
        );
      }

      return <span key={segIdx}>{visibleText}</span>;
    });
  };

  return (
    <div
      data-testid="eight-bit-post-night1-minigame"
      data-phase={phase}
      data-room-light={roomLightOn ? 'on' : 'off'}
      className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center select-none font-mono"
    >
      <div className="relative w-full h-full flex items-center justify-center bg-black overflow-hidden">
        <canvas
          ref={canvasRef}
          width={960}
          height={540}
          className="w-full h-full object-contain"
          style={{ imageRendering: 'pixelated' }}
        />

        {/* Small popover showing ONLY "E" next to the hotel door light switch ONLY when underneath/near it and able to activate it */}
        {phase === 'HOTEL_PHONE_RINGING_WALK' && nearLightSwitch && (
          <button
            type="button"
            data-testid="hotel-light-switch-btn"
            aria-label="Interruptor de luz [E]"
            onClick={handleToggleRoomLight}
            className="absolute top-[45%] left-[56%] -translate-x-1/2 -translate-y-1/2 px-2 py-0.5 bg-zinc-950/95 hover:bg-zinc-900 border-2 border-amber-400 text-amber-300 text-xs font-extrabold shadow-lg cursor-pointer animate-bounce"
          >
            E
          </button>
        )}

        {/* Scene 3 Hotel Room Phone Ringing: Small Pop-up "Responder a la llamada" [E] when near phone (no controls/objective banner) */}
        {phase === 'HOTEL_PHONE_RINGING_WALK' && nearPhone && (
          <button
            type="button"
            data-testid="hotel-answer-phone-popup"
            onClick={handleAnswerPhone}
            className="absolute top-[24%] left-[68%] -translate-x-1/2 bg-black/95 border-2 border-amber-400 px-4 py-2.5 flex flex-col items-center gap-1 shadow-2xl cursor-pointer animate-bounce"
          >
            <span className="text-xs sm:text-sm font-bold text-white tracking-wider">
              Responder a la llamada
            </span>
            <span className="px-2 py-0.5 bg-amber-400 text-black text-xs font-extrabold">
              [E]
            </span>
          </button>
        )}

        {/* Dialogue Box (matching Night 1 speaker badge & trembling letters) */}
        {activeTab && (
          <div
            data-testid="post-night1-dialogue-box"
            onClick={() => {
              if (!activeTab.hasYesNoChoice || typedChars < fullDialogueText.length) {
                handleAdvanceDialogue();
              }
            }}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[80vw] max-w-[80vw] bg-zinc-950/95 border-2 border-zinc-400 rounded-xl p-5 sm:p-6 shadow-2xl cursor-pointer"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5 mb-3">
              <div className="flex items-center gap-2.5">
                <span
                  data-testid="post-night1-speaker-badge"
                  className="text-sm sm:text-base font-bold uppercase tracking-widest px-2.5 py-0.5 rounded bg-zinc-900 border border-zinc-700"
                  style={{ color: activeTab.speakerColor }}
                >
                  {activeTab.speaker}
                </span>
                {phase === 'HOTEL_PHONE_CONVERSATION' && (
                  <span className="text-xs text-red-400 uppercase tracking-wider">
                    ● LÍNEA TELEFÓNICA ACTIVA
                  </span>
                )}
              </div>
              <span className="text-[11px] text-zinc-400 uppercase tracking-widest">
                HISTORIA 8-BIT
              </span>
            </div>

            <div
              data-testid="post-night1-dialogue-text"
              className="text-base sm:text-xl text-zinc-100 font-semibold leading-relaxed min-h-[3.5rem]"
            >
              {renderSegmentedDialogueText()}
            </div>

            {/* Bottom Controls: either SÍ (left) / NO (right) choice on "¿ACEPTAS?" or standard [ENTER] button */}
            {activeTab.hasYesNoChoice ? (
              <div
                data-testid="post-night1-yes-no-choices"
                className="mt-4 pt-3 border-t border-zinc-800 flex items-center justify-around gap-6"
              >
                <button
                  type="button"
                  data-testid="post-night1-choice-yes"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleChooseYes();
                  }}
                  onMouseEnter={() => setSelectedChoice('SI')}
                  className={`px-8 py-2.5 text-sm sm:text-base font-extrabold uppercase tracking-widest border-2 transition-colors ${
                    selectedChoice === 'SI'
                      ? 'bg-amber-400 text-black border-white scale-105'
                      : 'bg-zinc-900 text-zinc-200 border-zinc-500 hover:bg-zinc-800'
                  }`}
                >
                  ► SÍ ◄
                </button>
                <button
                  type="button"
                  data-testid="post-night1-choice-no"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleChooseNo();
                  }}
                  onMouseEnter={() => setSelectedChoice('NO')}
                  className={`px-8 py-2.5 text-sm sm:text-base font-extrabold uppercase tracking-widest border-2 transition-colors ${
                    selectedChoice === 'NO'
                      ? 'bg-red-600 text-white border-white scale-105'
                      : 'bg-zinc-900 text-zinc-200 border-zinc-500 hover:bg-zinc-800'
                  }`}
                >
                  ► NO ◄
                </button>
              </div>
            ) : (
              <div className="mt-3 flex items-center justify-end pt-2 border-t border-zinc-900">
                <button
                  type="button"
                  data-testid="post-night1-dialogue-enter-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAdvanceDialogue();
                  }}
                  className="px-3.5 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold uppercase tracking-wider transition-colors"
                >
                  {isThinkingPause
                    ? 'PENSANDO...'
                    : 'PULSA [ENTER] PARA CONTINUAR ▶'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

