import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { soundController } from '../game/audio';
import {
  BAD_ENDING_TITLE_DELAY_SEC,
  BAD_ENDING_TITLE_FADE_DURATION_SEC,
  BANK_EXTERIOR_DOOR_X,
  BANK_EXTERIOR_MAX_X,
  BANK_EXTERIOR_MIN_X,
  BANK_EXTERIOR_START_X,
  BANK_INTERIOR_MAX_X,
  BANK_INTERIOR_MIN_X,
  BANK_INTERIOR_START_X,
  BANK_RECEPTIONIST_X,
  INTRO_WALK_SPEED_PX_PER_SEC,
  POST_NIGHT_1_NO_CONSTRUCTION_MESSAGE,
  POST_NIGHT_5_BANK_DONATE_TAB,
  POST_NIGHT_5_FLEE_SCREAM_TABS,
  POST_NIGHT_5_GRAB_REWARD_TAB,
  POST_NIGHT_5_NO_DOCS_AUTO_DIALOGUE_HOLD_SEC,
  POST_NIGHT_5_NO_DOCS_DYING_TAB,
  POST_NIGHT_5_NO_DOCS_LEFT_HALL_DURATION_SEC,
  POST_NIGHT_5_NO_DOCS_OFFER_MONEY_TAB,
  POST_NIGHT_5_NO_DOCS_REACH_MONEY_DURATION_SEC,
  POST_NIGHT_5_NO_DOCS_RUN_SCREAM_TABS,
  POST_NIGHT_5_OFFICE_REWARD_TAB,
  POST_NIGHT_5_QTE_DURATION_SEC,
  POST_NIGHT_5_QTE_REQUIRED_PRESSES,
  PostNight1DialogueTab,
  PostNight1TextSegment,
  PostNight5EndingPhase,
  getPostNight5ClosetLookState,
  getPostNight5NoDocsDyingVisionState,
  getPostNight5NoDocsRunAndTurnState,
  isNearBankExteriorDoor,
  isNearBankReceptionist,
  projectFirstPersonCorridorProp,
} from '../game/rules';

interface EightBitPostNight5EndingMinigameProps {
  collectedDocuments?: boolean;
  onReturnToTitle: () => void;
  onUnlockBadEnding1: () => void;
  onUnlockEnding1?: () => void;
  onUnlockEnding2?: () => void;
}

const CANVAS_W = 960;
const CANVAS_H = 540;

export const EightBitPostNight5EndingMinigame: React.FC<EightBitPostNight5EndingMinigameProps> = ({
  collectedDocuments = true,
  onReturnToTitle,
  onUnlockBadEnding1,
  onUnlockEnding1,
  onUnlockEnding2,
}) => {
  const hasCollectedDocs = useMemo(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('no_docs') === '1' || params.get('collected_docs') === '0') {
        return false;
      }
      if (params.get('collected_docs') === '1') {
        return true;
      }
    }
    return Boolean(collectedDocuments);
  }, [collectedDocuments]);

  const [phase, setPhase] = useState<PostNight5EndingPhase>(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search).get('p5_phase');
      if (
        p === 'FP_OFFICE_REWARD_VOICE' ||
        p === 'FP_CLOSET_LOOK_AROUND_AND_OPEN' ||
        p === 'FP_GRABBED_FROM_BEHIND' ||
        p === 'FP_QTE_RESIST_AND_KICK' ||
        p === 'BAD_ENDING_STILL_NOTHING' ||
        p === 'FP_FLEE_CUT_1_GRAB_MONEY' ||
        p === 'FP_FLEE_CUT_2_HALL_SCREAM_1' ||
        p === 'BANK_EXTERIOR_WALK' ||
        p === 'BANK_INTERIOR_WALK' ||
        p === 'BANK_RECEPTIONIST_CHOICE' ||
        p === 'NO_DOCS_FP_LEFT_HALL_AND_TURN' ||
        p === 'NO_DOCS_FP_RUN_1_OFFICE' ||
        p === 'NO_DOCS_FP_RUN_2_CORRIDOR' ||
        p === 'NO_DOCS_FP_RUN_3_CORRIDOR' ||
        p === 'NO_DOCS_FP_RUN_4_SISTER' ||
        p === 'NO_DOCS_FP_BRAKE_AT_EXIT' ||
        p === 'NO_DOCS_FP_TURN_TO_THING' ||
        p === 'NO_DOCS_FP_THING_OFFER_MONEY' ||
        p === 'NO_DOCS_FADE_TO_CAM05' ||
        p === 'NO_DOCS_FP_REACH_FOR_MONEY' ||
        p === 'NO_DOCS_FP_IMPALED_BY_CLAW' ||
        p === 'NO_DOCS_FP_THROWN_TO_FLOOR' ||
        p === 'NO_DOCS_FP_DYING_AUTOMATIC_DIALOGUE' ||
        p === 'NO_DOCS_FP_SLOW_DEATH_BLINK'
      ) {
        return p;
      }
      if (
        new URLSearchParams(window.location.search).get('no_docs') === '1' ||
        new URLSearchParams(window.location.search).get('collected_docs') === '0'
      ) {
        return 'NO_DOCS_FP_LEFT_HALL_AND_TURN';
      }
    }
    return hasCollectedDocs ? 'FP_OFFICE_REWARD_VOICE' : 'NO_DOCS_FP_LEFT_HALL_AND_TURN';
  });

  const [typedChars, setTypedChars] = useState<number>(0);
  const [trembleTick, setTrembleTick] = useState<number>(0);
  const [qtePresses, setQtePresses] = useState<number>(0);
  const [qteRemainingSec, setQteRemainingSec] = useState<number>(POST_NIGHT_5_QTE_DURATION_SEC);
  const [badEndingElapsedSec, setBadEndingElapsedSec] = useState<number>(0);
  const [nearBankDoor, setNearBankDoor] = useState<boolean>(false);
  const [nearReceptionist, setNearReceptionist] = useState<boolean>(false);
  const [selectedChoice, setSelectedChoice] = useState<'SI' | 'NO'>('SI');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const phaseRef = useRef<PostNight5EndingPhase>(phase);
  phaseRef.current = phase;

  const typedCharsRef = useRef<number>(typedChars);
  typedCharsRef.current = typedChars;

  const selectedChoiceRef = useRef<'SI' | 'NO'>(selectedChoice);
  selectedChoiceRef.current = selectedChoice;

  const phaseElapsedSecRef = useRef<number>(0);
  const dialogueFinishedElapsedSecRef = useRef<number | null>(null);
  const brakedAtExitRef = useRef<boolean>(false);
  const noDocsCorridorProgressRef = useRef<number>(
    phase === 'NO_DOCS_FP_RUN_2_CORRIDOR'
      ? 0.32
      : phase === 'NO_DOCS_FP_RUN_3_CORRIDOR'
      ? 0.56
      : phase === 'NO_DOCS_FP_RUN_4_SISTER'
      ? 0.80
      : phase === 'NO_DOCS_FP_BRAKE_AT_EXIT' || phase === 'NO_DOCS_FP_TURN_TO_THING'
      ? 0.96
      : 0.08
  );
  const noDocsRunCycleSecRef = useRef<number>(0);
  const fadeAlphaRef = useRef<number>(0);
  const qtePressesRef = useRef<number>(qtePresses);
  qtePressesRef.current = qtePresses;
  const lastPressTimeSecRef = useRef<number>(-10);

  const playerXRef = useRef<number>(
    phase === 'BANK_INTERIOR_WALK' || phase === 'BANK_RECEPTIONIST_CHOICE'
      ? BANK_INTERIOR_START_X
      : BANK_EXTERIOR_START_X
  );
  const facingRef = useRef<-1 | 1>(1);
  const walkCycleRef = useRef<number>(0);
  const keysRef = useRef<{ left: boolean; right: boolean }>({ left: false, right: false });
  const finishedRef = useRef<boolean>(false);
  const laughFinishedRef = useRef<boolean>(false);
  const unlockedBadEndingRef = useRef<boolean>(false);
  const unlockedGoodEndingRef = useRef<boolean>(false);
  const unlockedEnding2Ref = useRef<boolean>(false);
  const [dyingBlurPx, setDyingBlurPx] = useState<number>(0);

  const onReturnToTitleRef = useRef(onReturnToTitle);
  onReturnToTitleRef.current = onReturnToTitle;

  const onUnlockBadEnding1Ref = useRef(onUnlockBadEnding1);
  onUnlockBadEnding1Ref.current = onUnlockBadEnding1;

  const onUnlockEnding1Ref = useRef(onUnlockEnding1);
  onUnlockEnding1Ref.current = onUnlockEnding1;

  const onUnlockEnding2Ref = useRef(onUnlockEnding2);
  onUnlockEnding2Ref.current = onUnlockEnding2;

  const transitionToPhase = useCallback((nextPhase: PostNight5EndingPhase) => {
    phaseRef.current = nextPhase;
    phaseElapsedSecRef.current = 0;
    dialogueFinishedElapsedSecRef.current = null;
    brakedAtExitRef.current = false;
    if (nextPhase === 'NO_DOCS_FP_LEFT_HALL_AND_TURN') {
      noDocsCorridorProgressRef.current = 0.08;
      noDocsRunCycleSecRef.current = 0;
    }
    fadeAlphaRef.current = 0;
    setTypedChars(0);
    typedCharsRef.current = 0;
    setPhase(nextPhase);
  }, []);

  // Active dialogue tab using the exact PostNight1DialogueTab structure from Night 1-4
  const activeTab: PostNight1DialogueTab | null = useMemo(() => {
    if (phase === 'FP_OFFICE_REWARD_VOICE') {
      return POST_NIGHT_5_OFFICE_REWARD_TAB;
    }
    if (phase === 'FP_GRABBED_FROM_BEHIND') {
      return POST_NIGHT_5_GRAB_REWARD_TAB;
    }
    if (phase === 'FP_FLEE_CUT_2_HALL_SCREAM_1') {
      return POST_NIGHT_5_FLEE_SCREAM_TABS[0];
    }
    if (phase === 'FP_FLEE_CUT_3_HALL_SCREAM_2') {
      return POST_NIGHT_5_FLEE_SCREAM_TABS[1];
    }
    if (phase === 'FP_FLEE_CUT_4_EXIT_SCREAM_3') {
      return POST_NIGHT_5_FLEE_SCREAM_TABS[2];
    }
    if (phase === 'BANK_RECEPTIONIST_CHOICE') {
      return {
        ...POST_NIGHT_5_BANK_DONATE_TAB,
        hasYesNoChoice: true,
      };
    }
    if (phase === 'BANK_NO_CONSTRUCTION_MODAL') {
      return {
        speaker: 'SISTEMA',
        speakerColor: '#f87171',
        segments: [{ text: POST_NIGHT_1_NO_CONSTRUCTION_MESSAGE }],
      };
    }
    if (phase === 'NO_DOCS_FP_RUN_1_OFFICE') {
      return POST_NIGHT_5_NO_DOCS_RUN_SCREAM_TABS[0];
    }
    if (phase === 'NO_DOCS_FP_RUN_2_CORRIDOR') {
      return POST_NIGHT_5_NO_DOCS_RUN_SCREAM_TABS[1];
    }
    if (phase === 'NO_DOCS_FP_RUN_3_CORRIDOR') {
      return POST_NIGHT_5_NO_DOCS_RUN_SCREAM_TABS[2];
    }
    if (phase === 'NO_DOCS_FP_RUN_4_SISTER') {
      return POST_NIGHT_5_NO_DOCS_RUN_SCREAM_TABS[3];
    }
    if (phase === 'NO_DOCS_FP_THING_OFFER_MONEY') {
      return POST_NIGHT_5_NO_DOCS_OFFER_MONEY_TAB;
    }
    if (phase === 'NO_DOCS_FP_DYING_AUTOMATIC_DIALOGUE') {
      return POST_NIGHT_5_NO_DOCS_DYING_TAB;
    }
    return null;
  }, [phase]);

  const fullDialogueText = useMemo(() => {
    if (!activeTab) return '';
    return activeTab.segments.map((s) => s.text).join('');
  }, [activeTab]);

  const fullDialogueTextLengthRef = useRef<number>(fullDialogueText.length);
  fullDialogueTextLengthRef.current = fullDialogueText.length;

  // Exact typewriter effect with slowTremble slowdown (95ms per char on RECOMPENSA / slowTremble, 30ms on No-Docs automatic dialogues, 22ms standard)
  useEffect(() => {
    if (!activeTab) {
      setTypedChars(0);
      typedCharsRef.current = 0;
      dialogueFinishedElapsedSecRef.current = null;
      return;
    }

    setTypedChars(0);
    typedCharsRef.current = 0;
    dialogueFinishedElapsedSecRef.current = null;
    const totalLen = fullDialogueText.length;

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
      if (current >= totalLen) return;

      const next = current + 1;
      typedCharsRef.current = next;
      setTypedChars(next);

      if (next >= totalLen && dialogueFinishedElapsedSecRef.current === null) {
        dialogueFinishedElapsedSecRef.current = phaseElapsedSecRef.current;
      }

      const nextChar = fullDialogueText[current] ?? ' ';
      if (nextChar.trim().length > 0 && next % 3 === 1) {
        soundController.playCameraBlip();
      }

      const isSlowChar = next > slowStartIdx;
      const isNoDocs = phaseRef.current.startsWith('NO_DOCS_');
      const delayMs = isSlowChar ? 95 : isNoDocs ? 32 : 22;
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

  // Exact 65ms trembleTick interval from EightBitPostNight3Minigame & EightBitPostNight4Minigame
  useEffect(() => {
    if (!activeTab) return;
    const interval = window.setInterval(() => {
      setTrembleTick((t) => (t + 1) % 1000);
    }, 65);
    return () => window.clearInterval(interval);
  }, [activeTab]);

  // Stop leftover sounds only on initial mount & unmount so phase transitions NEVER cut off active SFX
  useEffect(() => {
    soundController.stopAll(false, true);
    return () => {
      soundController.stopTheThingLaughFinal1();
      soundController.stopOfficeFanLoop();
    };
  }, []);

  // Keep office fan running during FP_OFFICE_REWARD_VOICE
  useEffect(() => {
    if (phase === 'FP_OFFICE_REWARD_VOICE') {
      soundController.startOfficeFanLoop();
    } else {
      soundController.stopOfficeFanLoop();
    }
  }, [phase]);

  // Play "Risa the thing-Final1.mp3" when The Thing grabs Richard from behind at the CAM 05 door
  // OR during the slow blurry death blink in the No-Documents Ending ("y se escucha de fondo la risa de the thing (final 1 cuando le agarra)")
  useEffect(() => {
    if (phase === 'FP_GRABBED_FROM_BEHIND') {
      laughFinishedRef.current = false;
      soundController.playDoorSlam(true);
      soundController.playTheThingLaughFinal1(() => {
        laughFinishedRef.current = true;
      });
    } else if (phase === 'NO_DOCS_FP_IMPALED_BY_CLAW') {
      soundController.playDoorSlam(true);
      soundController.playDoorKnock();
    } else if (phase === 'NO_DOCS_FP_THROWN_TO_FLOOR') {
      soundController.playDoorSlam(true);
    } else if (phase === 'NO_DOCS_FP_SLOW_DEATH_BLINK') {
      laughFinishedRef.current = false;
      if (!unlockedEnding2Ref.current) {
        unlockedEnding2Ref.current = true;
        onUnlockEnding2Ref.current?.();
      }
      soundController.playTheThingLaughFinal1(() => {
        laughFinishedRef.current = true;
      });
    }
  }, [phase]);

  // Play jumpscare scream if the player fails the 3-second QTE
  useEffect(() => {
    if (phase === 'FP_QTE_FAIL_JUMPSCARE') {
      soundController.playJumpscare();
    }
  }, [phase]);

  // Unlock the Bad Ending black star once when reaching Still Nothing
  useEffect(() => {
    if (phase === 'BAD_ENDING_STILL_NOTHING' && !unlockedBadEndingRef.current) {
      unlockedBadEndingRef.current = true;
      onUnlockBadEnding1Ref.current();
    }
  }, [phase]);

  // Unlock the Good Ending 1 wooden star once when completing the Bank Good Ending
  useEffect(() => {
    if (phase === 'GOOD_ENDING_FADE_TO_MENU' && !unlockedGoodEndingRef.current) {
      unlockedGoodEndingRef.current = true;
      onUnlockEnding1Ref.current?.();
    }
  }, [phase]);

  // Choice handlers at the Bank Receptionist
  const handleChooseDonateYes = useCallback(() => {
    if (phaseRef.current !== 'BANK_RECEPTIONIST_CHOICE') return;
    if (!unlockedGoodEndingRef.current) {
      unlockedGoodEndingRef.current = true;
      onUnlockEnding1Ref.current?.();
    }
    soundController.playCameraBlip();
    transitionToPhase('GOOD_ENDING_FADE_TO_MENU');
  }, [transitionToPhase]);

  const handleChooseDonateNo = useCallback(() => {
    if (phaseRef.current !== 'BANK_RECEPTIONIST_CHOICE') return;
    soundController.playCameraBlip();
    transitionToPhase('BANK_NO_CONSTRUCTION_MODAL');
  }, [transitionToPhase]);

  // Advance dialogue with Enter or click (ONLY for Canon Ending 1; all NO_DOCS_* conversations are 100% automatic!)
  const handleAdvanceDialogue = useCallback(() => {
    const currentPhase = phaseRef.current;

    // All conversations in the No-Documents ending (Ending 2) are strictly automatic and wait ~2 seconds between dialogues!
    if (currentPhase.startsWith('NO_DOCS_')) {
      return;
    }

    if (currentPhase === 'FP_FLEE_CUT_1_GRAB_MONEY') {
      soundController.playKeyGet();
      transitionToPhase('FP_FLEE_CUT_2_HALL_SCREAM_1');
      return;
    }

    if (!activeTab) return;

    if (typedCharsRef.current < fullDialogueText.length) {
      typedCharsRef.current = fullDialogueText.length;
      setTypedChars(fullDialogueText.length);
      return;
    }

    if (currentPhase === 'BANK_RECEPTIONIST_CHOICE') {
      if (selectedChoiceRef.current === 'SI') {
        handleChooseDonateYes();
      } else {
        handleChooseDonateNo();
      }
      return;
    }

    soundController.playCameraBlip();

    if (currentPhase === 'FP_OFFICE_REWARD_VOICE') {
      transitionToPhase('FADE_OFFICE_TO_CLOSET');
      return;
    }

    if (currentPhase === 'FP_FLEE_CUT_2_HALL_SCREAM_1') {
      transitionToPhase('FP_FLEE_CUT_3_HALL_SCREAM_2');
      return;
    }

    if (currentPhase === 'FP_FLEE_CUT_3_HALL_SCREAM_2') {
      transitionToPhase('FP_FLEE_CUT_4_EXIT_SCREAM_3');
      return;
    }

    if (currentPhase === 'FP_FLEE_CUT_4_EXIT_SCREAM_3') {
      soundController.playDoorSlam(true);
      transitionToPhase('FADE_TO_BANK_EXTERIOR');
      return;
    }

    if (currentPhase === 'BANK_NO_CONSTRUCTION_MODAL') {
      setSelectedChoice('SI');
      selectedChoiceRef.current = 'SI';
      transitionToPhase('BANK_RECEPTIONIST_CHOICE');
      return;
    }
  }, [
    activeTab,
    fullDialogueText.length,
    handleChooseDonateNo,
    handleChooseDonateYes,
    transitionToPhase,
  ]);

  // Press [E] during the 3-second QTE (3 presses: 1 & 2 resist, 3 kicks The Thing)
  const handleQtePressE = useCallback(() => {
    if (phaseRef.current !== 'FP_QTE_RESIST_AND_KICK') return;
    const nextPresses = qtePressesRef.current + 1;
    qtePressesRef.current = nextPresses;
    lastPressTimeSecRef.current = phaseElapsedSecRef.current;
    setQtePresses(nextPresses);

    if (nextPresses < POST_NIGHT_5_QTE_REQUIRED_PRESSES) {
      soundController.playDoorKnock();
    } else {
      soundController.playDoorSlam(true);
      transitionToPhase('FP_QTE_SUCCESS_KICK_IMPACT');
    }
  }, [transitionToPhase]);

  // Press [E] in 3rd-person Bank Exterior or Bank Interior
  const handleBankInteractE = useCallback(() => {
    if (
      phaseRef.current === 'BANK_EXTERIOR_WALK' &&
      isNearBankExteriorDoor(playerXRef.current)
    ) {
      keysRef.current.left = false;
      keysRef.current.right = false;
      soundController.playDoorSlam(true);
      transitionToPhase('FADE_TO_BANK_INTERIOR');
      return;
    }
    if (
      phaseRef.current === 'BANK_INTERIOR_WALK' &&
      isNearBankReceptionist(playerXRef.current)
    ) {
      keysRef.current.left = false;
      keysRef.current.right = false;
      soundController.playCameraBlip();
      setSelectedChoice('SI');
      selectedChoiceRef.current = 'SI';
      transitionToPhase('BANK_RECEPTIONIST_CHOICE');
    }
  }, [transitionToPhase]);

  // Click anywhere after "BAD ENDING" appears to fade to black and return to Main Menu
  const handleBadEndingScreenClick = useCallback(() => {
    if (phaseRef.current !== 'BAD_ENDING_STILL_NOTHING') return;
    if (phaseElapsedSecRef.current < BAD_ENDING_TITLE_DELAY_SEC + 0.5) return;
    soundController.playWoodClick();
    transitionToPhase('BAD_ENDING_FADE_OUT');
  }, [transitionToPhase]);

  // Keyboard listener (100% matching EightBitPostNight3Minigame & EightBitPostNight4Minigame)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const code = e.code;
      const keyLower = e.key.toLowerCase();

      if (phaseRef.current === 'FP_QTE_RESIST_AND_KICK') {
        if ((code === 'KeyE' || keyLower === 'e') && !e.repeat) {
          e.preventDefault();
          handleQtePressE();
        }
        return;
      }

      if (phaseRef.current === 'BAD_ENDING_STILL_NOTHING') {
        if (code === 'Enter' || code === 'Space') {
          e.preventDefault();
          handleBadEndingScreenClick();
        }
        return;
      }

      if (phaseRef.current === 'BANK_RECEPTIONIST_CHOICE') {
        if (code === 'ArrowLeft' || code === 'KeyA') {
          e.preventDefault();
          setSelectedChoice('SI');
          selectedChoiceRef.current = 'SI';
          soundController.playCameraBlip();
          return;
        }
        if (code === 'ArrowRight' || code === 'KeyD') {
          e.preventDefault();
          setSelectedChoice('NO');
          selectedChoiceRef.current = 'NO';
          soundController.playCameraBlip();
          return;
        }
      }

      if (code === 'KeyA' || code === 'ArrowLeft') {
        keysRef.current.left = true;
      }
      if (code === 'KeyD' || code === 'ArrowRight') {
        keysRef.current.right = true;
      }

      if (code === 'KeyE' || keyLower === 'e') {
        if (
          phaseRef.current === 'BANK_EXTERIOR_WALK' ||
          phaseRef.current === 'BANK_INTERIOR_WALK'
        ) {
          e.preventDefault();
          handleBankInteractE();
          return;
        }
        if (phaseRef.current === 'FP_FLEE_CUT_1_GRAB_MONEY') {
          e.preventDefault();
          handleAdvanceDialogue();
          return;
        }
      }

      if (code === 'Enter' || code === 'NumpadEnter') {
        e.preventDefault();
        e.stopPropagation();
        handleAdvanceDialogue();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const code = e.code;
      if (code === 'KeyA' || code === 'ArrowLeft') keysRef.current.left = false;
      if (code === 'KeyD' || code === 'ArrowRight') keysRef.current.right = false;
    };

    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
    };
  }, [
    handleAdvanceDialogue,
    handleBadEndingScreenClick,
    handleBankInteractE,
    handleQtePressE,
  ]);

  // Main 60Hz Simulation & Render Loop
  useEffect(() => {
    let raf = 0;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      phaseElapsedSecRef.current += dt;
      const elapsed = phaseElapsedSecRef.current;
      const currentPhase = phaseRef.current;

      if (
        fullDialogueTextLengthRef.current > 0 &&
        typedCharsRef.current >= fullDialogueTextLengthRef.current &&
        dialogueFinishedElapsedSecRef.current === null
      ) {
        dialogueFinishedElapsedSecRef.current = elapsed;
      }
      const timeSinceDialogueDone =
        dialogueFinishedElapsedSecRef.current !== null
          ? Math.max(0, elapsed - dialogueFinishedElapsedSecRef.current)
          : -1;

      // 1. State Machine Updates
      if (currentPhase === 'FADE_OFFICE_TO_CLOSET') {
        if (elapsed < 0.7) {
          fadeAlphaRef.current = Math.min(1, elapsed / 0.7);
        } else if (elapsed < 1.4) {
          fadeAlphaRef.current = Math.max(0, 1 - (elapsed - 0.7) / 0.7);
        } else {
          fadeAlphaRef.current = 0;
          transitionToPhase('FP_CLOSET_LOOK_AROUND_AND_OPEN');
        }
      } else if (currentPhase === 'FP_CLOSET_LOOK_AROUND_AND_OPEN') {
        const lookState = getPostNight5ClosetLookState(elapsed);
        if (lookState.completed) {
          transitionToPhase('FP_GRABBED_FROM_BEHIND');
        }
      } else if (currentPhase === 'FP_GRABBED_FROM_BEHIND') {
        // Wait for "Risa the thing-Final1.mp3" (~2.05s) to finish before spinning the camera around
        if ((laughFinishedRef.current && elapsed >= 1.85) || elapsed >= 2.45) {
          transitionToPhase('FP_SPIN_AROUND_TO_FACE');
        }
      } else if (currentPhase === 'FP_SPIN_AROUND_TO_FACE') {
        // Smooth 1.35s 180-degree whip-pan turn to face The Thing
        if (elapsed >= 1.35) {
          qtePressesRef.current = 0;
          setQtePresses(0);
          setQteRemainingSec(POST_NIGHT_5_QTE_DURATION_SEC);
          transitionToPhase('FP_QTE_RESIST_AND_KICK');
        }
      } else if (currentPhase === 'FP_QTE_RESIST_AND_KICK') {
        const rem = Math.max(0, Number((POST_NIGHT_5_QTE_DURATION_SEC - elapsed).toFixed(1)));
        setQteRemainingSec((prev) => (prev !== rem ? rem : prev));
        if (
          elapsed >= POST_NIGHT_5_QTE_DURATION_SEC &&
          qtePressesRef.current < POST_NIGHT_5_QTE_REQUIRED_PRESSES
        ) {
          transitionToPhase('FP_QTE_FAIL_JUMPSCARE');
        }
      } else if (currentPhase === 'FP_QTE_FAIL_JUMPSCARE') {
        // Let the full jumpscare scream audio play completely + hold in darkness before revealing Still Nothing
        const jumpscareAudioDone =
          !soundController.isJumpscarePlaying() || elapsed >= 5.2;
        if (elapsed >= 4.55 && jumpscareAudioDone) {
          setBadEndingElapsedSec(0);
          transitionToPhase('BAD_ENDING_STILL_NOTHING');
        }
      } else if (currentPhase === 'BAD_ENDING_STILL_NOTHING') {
        // Smooth fade-in from black at the start of Still Nothing reveal
        fadeAlphaRef.current = elapsed < 0.85 ? Math.max(0, 1 - elapsed / 0.85) : 0;
        const quantizedElapsed = Math.min(6, Number(elapsed.toFixed(2)));
        setBadEndingElapsedSec((prev) =>
          Math.abs(prev - quantizedElapsed) >= 0.04 ? quantizedElapsed : prev
        );
      } else if (currentPhase === 'BAD_ENDING_FADE_OUT') {
        fadeAlphaRef.current = Math.min(1, elapsed / 1.35);
        if (elapsed >= 1.45 && !finishedRef.current) {
          finishedRef.current = true;
          soundController.stopAll(false);
          onReturnToTitleRef.current();
          return;
        }
      } else if (currentPhase === 'FP_QTE_SUCCESS_KICK_IMPACT') {
        if (elapsed > 0.8) {
          fadeAlphaRef.current = Math.min(1, (elapsed - 0.8) / 0.5);
        }
        if (elapsed >= 1.35) {
          soundController.playKeyGet();
          transitionToPhase('FP_FLEE_CUT_1_GRAB_MONEY');
        }
      } else if (currentPhase === 'FP_FLEE_CUT_1_GRAB_MONEY') {
        if (elapsed < 0.45) {
          fadeAlphaRef.current = 1 - elapsed / 0.45;
        } else if (elapsed > 2.15) {
          fadeAlphaRef.current = Math.min(1, (elapsed - 2.15) / 0.45);
        } else {
          fadeAlphaRef.current = 0;
        }
        if (elapsed >= 2.65) {
          transitionToPhase('FP_FLEE_CUT_2_HALL_SCREAM_1');
        }
      } else if (
        currentPhase === 'FP_FLEE_CUT_2_HALL_SCREAM_1' ||
        currentPhase === 'FP_FLEE_CUT_3_HALL_SCREAM_2' ||
        currentPhase === 'FP_FLEE_CUT_4_EXIT_SCREAM_3'
      ) {
        // Fade-from-black blink at the start of each fleeing cut ("entre fundido a negro y fundido a negro")
        fadeAlphaRef.current = elapsed < 0.45 ? 1 - elapsed / 0.45 : 0;
      } else if (currentPhase === 'FADE_TO_BANK_EXTERIOR') {
        if (elapsed < 0.65) {
          fadeAlphaRef.current = Math.min(1, elapsed / 0.65);
        } else if (elapsed < 1.3) {
          playerXRef.current = BANK_EXTERIOR_START_X;
          facingRef.current = 1;
          fadeAlphaRef.current = Math.max(0, 1 - (elapsed - 0.65) / 0.65);
        } else {
          fadeAlphaRef.current = 0;
          playerXRef.current = BANK_EXTERIOR_START_X;
          facingRef.current = 1;
          setNearBankDoor(isNearBankExteriorDoor(BANK_EXTERIOR_START_X));
          transitionToPhase('BANK_EXTERIOR_WALK');
        }
      } else if (currentPhase === 'BANK_EXTERIOR_WALK') {
        const dir: -1 | 0 | 1 =
          keysRef.current.right && !keysRef.current.left
            ? 1
            : keysRef.current.left && !keysRef.current.right
            ? -1
            : 0;
        if (dir !== 0) {
          facingRef.current = dir;
          walkCycleRef.current += dt;
          playerXRef.current = Math.max(
            BANK_EXTERIOR_MIN_X,
            Math.min(BANK_EXTERIOR_MAX_X, playerXRef.current + dir * INTRO_WALK_SPEED_PX_PER_SEC * dt)
          );
        }
        const near = isNearBankExteriorDoor(playerXRef.current);
        setNearBankDoor((prev) => (prev !== near ? near : prev));
      } else if (currentPhase === 'FADE_TO_BANK_INTERIOR') {
        if (elapsed < 0.55) {
          fadeAlphaRef.current = Math.min(1, elapsed / 0.55);
        } else if (elapsed < 1.1) {
          playerXRef.current = BANK_INTERIOR_START_X;
          facingRef.current = 1;
          fadeAlphaRef.current = Math.max(0, 1 - (elapsed - 0.55) / 0.55);
        } else {
          fadeAlphaRef.current = 0;
          playerXRef.current = BANK_INTERIOR_START_X;
          facingRef.current = 1;
          setNearReceptionist(isNearBankReceptionist(BANK_INTERIOR_START_X));
          transitionToPhase('BANK_INTERIOR_WALK');
        }
      } else if (currentPhase === 'BANK_INTERIOR_WALK') {
        const dir: -1 | 0 | 1 =
          keysRef.current.right && !keysRef.current.left
            ? 1
            : keysRef.current.left && !keysRef.current.right
            ? -1
            : 0;
        if (dir !== 0) {
          facingRef.current = dir;
          walkCycleRef.current += dt;
          playerXRef.current = Math.max(
            BANK_INTERIOR_MIN_X,
            Math.min(BANK_INTERIOR_MAX_X, playerXRef.current + dir * INTRO_WALK_SPEED_PX_PER_SEC * dt)
          );
        }
        const near = isNearBankReceptionist(playerXRef.current);
        setNearReceptionist((prev) => (prev !== near ? near : prev));
      } else if (currentPhase === 'GOOD_ENDING_FADE_TO_MENU') {
        fadeAlphaRef.current = Math.min(1, elapsed / 1.4);
        if (elapsed >= 1.55 && !finishedRef.current) {
          finishedRef.current = true;
          soundController.stopAll(false);
          onReturnToTitleRef.current();
          return;
        }
      } else if (currentPhase === 'NO_DOCS_FP_LEFT_HALL_AND_TURN') {
        // Running down the Left Corridor from the Office toward the left-turn intersection (no dialogue yet, zero fade to black)
        noDocsRunCycleSecRef.current += dt;
        noDocsCorridorProgressRef.current = 0.08;
        if (elapsed >= POST_NIGHT_5_NO_DOCS_LEFT_HALL_DURATION_SEC) {
          transitionToPhase('NO_DOCS_FP_RUN_1_OFFICE');
        }
      } else if (currentPhase === 'NO_DOCS_FP_RUN_1_OFFICE') {
        // Smooth 90° left turn into the Grand Entrance Corridor while The Thing starts screaming "¡VUELVE AQUÍ!"
        noDocsRunCycleSecRef.current += dt;
        if (elapsed > 0.25) {
          noDocsCorridorProgressRef.current = Math.min(
            0.32,
            noDocsCorridorProgressRef.current + dt * 0.105
          );
        }
        // Automatic conversation 1 ("¡VUELVE AQUÍ!"): waits 2.0s after typing finishes before advancing
        if (timeSinceDialogueDone >= POST_NIGHT_5_NO_DOCS_AUTO_DIALOGUE_HOLD_SEC) {
          transitionToPhase('NO_DOCS_FP_RUN_2_CORRIDOR');
        }
      } else if (currentPhase === 'NO_DOCS_FP_RUN_2_CORRIDOR') {
        // Continuous run down the Grand Entrance Corridor ("¡TRAIDOOOOR!"): waits 2.0s after typing finishes
        noDocsRunCycleSecRef.current += dt;
        noDocsCorridorProgressRef.current = Math.min(
          0.56,
          noDocsCorridorProgressRef.current + dt * 0.10
        );
        if (timeSinceDialogueDone >= POST_NIGHT_5_NO_DOCS_AUTO_DIALOGUE_HOLD_SEC) {
          transitionToPhase('NO_DOCS_FP_RUN_3_CORRIDOR');
        }
      } else if (currentPhase === 'NO_DOCS_FP_RUN_3_CORRIDOR') {
        // Continuous run down the Grand Entrance Corridor ("¡ME PROMETISTE LOS DOCUMENTOS!"): waits 2.0s after typing finishes
        noDocsRunCycleSecRef.current += dt;
        noDocsCorridorProgressRef.current = Math.min(
          0.82,
          noDocsCorridorProgressRef.current + dt * 0.092
        );
        if (timeSinceDialogueDone >= POST_NIGHT_5_NO_DOCS_AUTO_DIALOGUE_HOLD_SEC) {
          transitionToPhase('NO_DOCS_FP_RUN_4_SISTER');
        }
      } else if (currentPhase === 'NO_DOCS_FP_RUN_4_SISTER') {
        // Runs up to the EXIT door while "¡¿ES QUE ACASO NO TE IMPORTA TU HERMANA?!" is typing,
        // and the exact instant typing finishes (timeSinceDialogueDone >= 0), Richard brakes dead
        // ("frenarse en seco") and ALL running/bobbing animations stop completely!
        if (timeSinceDialogueDone < 0) {
          noDocsRunCycleSecRef.current += dt;
          noDocsCorridorProgressRef.current = Math.min(
            0.96,
            noDocsCorridorProgressRef.current + dt * 0.115
          );
        } else {
          noDocsCorridorProgressRef.current = 0.96;
          if (!brakedAtExitRef.current) {
            brakedAtExitRef.current = true;
            soundController.playDoorKnock();
          }
        }
        if (timeSinceDialogueDone >= POST_NIGHT_5_NO_DOCS_AUTO_DIALOGUE_HOLD_SEC) {
          transitionToPhase('NO_DOCS_FP_BRAKE_AT_EXIT');
        }
      } else if (currentPhase === 'NO_DOCS_FP_BRAKE_AT_EXIT') {
        noDocsCorridorProgressRef.current = 0.96;
        if (elapsed >= 0.65) {
          transitionToPhase('NO_DOCS_FP_TURN_TO_THING');
        }
      } else if (currentPhase === 'NO_DOCS_FP_TURN_TO_THING') {
        if (elapsed >= 1.35) {
          transitionToPhase('NO_DOCS_FP_THING_OFFER_MONEY');
        }
      } else if (currentPhase === 'NO_DOCS_FP_THING_OFFER_MONEY') {
        // Automatic conversation 5 ("Bien, bien, ven aquí y te llevarás el dinero."): waits 2.0s after typing finishes
        if (timeSinceDialogueDone >= POST_NIGHT_5_NO_DOCS_AUTO_DIALOGUE_HOLD_SEC) {
          transitionToPhase('NO_DOCS_FADE_TO_CAM05');
        }
      } else if (currentPhase === 'NO_DOCS_FADE_TO_CAM05') {
        if (elapsed < 0.8) {
          fadeAlphaRef.current = Math.min(1, elapsed / 0.8);
        } else if (elapsed < 1.65) {
          fadeAlphaRef.current = Math.max(0, 1 - (elapsed - 0.8) / 0.85);
        } else {
          fadeAlphaRef.current = 0;
          transitionToPhase('NO_DOCS_FP_REACH_FOR_MONEY');
        }
      } else if (currentPhase === 'NO_DOCS_FP_REACH_FOR_MONEY') {
        // Dramatic 3.0-second scene where Richard reaches out toward the money before The Thing's hand impales him!
        if (elapsed >= POST_NIGHT_5_NO_DOCS_REACH_MONEY_DURATION_SEC) {
          transitionToPhase('NO_DOCS_FP_IMPALED_BY_CLAW');
        }
      } else if (currentPhase === 'NO_DOCS_FP_IMPALED_BY_CLAW') {
        if (elapsed >= 2.8) {
          transitionToPhase('NO_DOCS_FP_THROWN_TO_FLOOR');
        }
      } else if (currentPhase === 'NO_DOCS_FP_THROWN_TO_FLOOR') {
        if (elapsed >= 2.0) {
          transitionToPhase('NO_DOCS_FP_DYING_AUTOMATIC_DIALOGUE');
        }
      } else if (currentPhase === 'NO_DOCS_FP_DYING_AUTOMATIC_DIALOGUE') {
        const vision = getPostNight5NoDocsDyingVisionState(elapsed, false);
        const quantizedBlur = Number(vision.blurPx.toFixed(1));
        setDyingBlurPx((prev) => (Math.abs(prev - quantizedBlur) >= 0.2 ? quantizedBlur : prev));

        // Automatic unskippable transition: waits 2.0 full seconds after The Thing finishes speaking
        // ("No te preocupes Richard, tu hermana vivirá A COSTA DE TU VIDA") before the slow death blink
        if (timeSinceDialogueDone >= POST_NIGHT_5_NO_DOCS_AUTO_DIALOGUE_HOLD_SEC) {
          transitionToPhase('NO_DOCS_FP_SLOW_DEATH_BLINK');
        }
      } else if (currentPhase === 'NO_DOCS_FP_SLOW_DEATH_BLINK') {
        const vision = getPostNight5NoDocsDyingVisionState(elapsed, true);
        const quantizedBlur = Number(vision.blurPx.toFixed(1));
        setDyingBlurPx((prev) => (Math.abs(prev - quantizedBlur) >= 0.2 ? quantizedBlur : prev));

        if (vision.completed && !finishedRef.current) {
          finishedRef.current = true;
          soundController.stopAll(false);
          onReturnToTitleRef.current();
          return;
        }
      } else {
        setDyingBlurPx((prev) => (prev !== 0 ? 0 : prev));
      }

      // 2. Render Active 8-Bit Scene
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = false;
          const timeSec = now / 1000;
          const isWalking =
            (currentPhase === 'BANK_EXTERIOR_WALK' || currentPhase === 'BANK_INTERIOR_WALK') &&
            (keysRef.current.left || keysRef.current.right);

          renderEnding1Scene(ctx, {
            phase: currentPhase,
            elapsedSec: elapsed,
            timeSec,
            qtePresses: qtePressesRef.current,
            lastPressTimeSec: lastPressTimeSecRef.current,
            playerX: playerXRef.current,
            playerFacing: facingRef.current,
            walkCycle: walkCycleRef.current,
            isWalking,
            fadeAlpha: fadeAlphaRef.current,
            timeSinceDialogueDone,
            noDocsCorridorProgress: noDocsCorridorProgressRef.current,
            noDocsRunCycleSec: noDocsRunCycleSecRef.current,
          });
        }
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [transitionToPhase]);

  // Exact renderSegmentedDialogueText from EightBitPostNight4Minigame.tsx
  const renderSegmentedDialogueText = () => {
    if (!activeTab) return null;
    let remaining = typedChars;

    return activeTab.segments.map((seg: PostNight1TextSegment, segIdx: number) => {
      if (remaining <= 0) return null;

      let activeText = seg.text;
      if (seg.glitchText && seg.text.includes(' / ')) {
        const parts = seg.text.split(' / ');
        const altIndex = Math.floor(trembleTick / 4) % parts.length;
        activeText = parts[altIndex];
      }

      const visibleText = activeText.slice(0, remaining);
      remaining -= seg.text.length;

      if (seg.slowTremble || seg.slightTremble || seg.fadingText) {
        const totalChars = Math.max(1, activeText.length - 1);
        return (
          <span key={segIdx} className="inline">
            {visibleText.split('').map((ch, idx) => {
              if (ch === ' ') return <span key={idx}> </span>;
              const seed = idx * 17 + trembleTick * 13;
              const amp = seg.slowTremble ? 0.95 : 0.75;
              const dx = ((seed % 3) - 1) * amp;
              const dy = (((seed * 7) % 3) - 1) * amp;
              const fadeOpacity = seg.fadingText
                ? Math.max(0.12, 1 - (idx / totalChars) * 0.88)
                : 1;
              return (
                <span
                  key={idx}
                  data-testid="trembling-letter"
                  style={{
                    display: 'inline-block',
                    transform: `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px)`,
                    opacity: seg.fadingText ? Number(fadeOpacity.toFixed(2)) : undefined,
                    color: seg.slowTremble || seg.fadingText ? '#ef4444' : '#fde047',
                    textShadow:
                      seg.slowTremble || seg.fadingText
                        ? '0 0 8px rgba(239, 68, 68, 0.85)'
                        : '0 0 6px rgba(253, 224, 71, 0.5)',
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

  // Bad Ending title slow fade-in after 2.0 seconds
  const badEndingTitleAlpha =
    phase === 'BAD_ENDING_STILL_NOTHING'
      ? Math.max(
          0,
          Math.min(
            1,
            (badEndingElapsedSec - BAD_ENDING_TITLE_DELAY_SEC) / BAD_ENDING_TITLE_FADE_DURATION_SEC
          )
        )
      : phase === 'BAD_ENDING_FADE_OUT'
      ? 1
      : 0;

  return (
    <div
      data-testid="post-night5-ending-minigame"
      data-phase={phase}
      onClick={() => {
        if (phase === 'BAD_ENDING_STILL_NOTHING') {
          handleBadEndingScreenClick();
        } else if (phase === 'FP_FLEE_CUT_1_GRAB_MONEY') {
          handleAdvanceDialogue();
        }
      }}
      className={`fixed inset-0 z-50 bg-black flex flex-col items-center justify-center select-none font-mono ${
        phase === 'BAD_ENDING_STILL_NOTHING' && badEndingElapsedSec >= BAD_ENDING_TITLE_DELAY_SEC + 0.5
          ? 'cursor-pointer'
          : ''
      }`}
    >
      <div className="relative w-full h-full flex items-center justify-center bg-black overflow-hidden">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="w-full h-full object-fill bg-black"
          style={{
            imageRendering: 'pixelated',
            filter: dyingBlurPx > 0.05 ? `blur(${dyingBlurPx.toFixed(1)}px)` : undefined,
          }}
        />

        {/* BAD ENDING SLOW FADE-IN TITLE AT TOP (Exact Rubik Dirt wood typography from TitleScreen.tsx) */}
        {(phase === 'BAD_ENDING_STILL_NOTHING' || phase === 'BAD_ENDING_FADE_OUT') &&
          badEndingTitleAlpha > 0.01 && (
            <div
              data-testid="bad-ending-title-banner"
              style={{ opacity: badEndingTitleAlpha }}
              className="absolute top-6 inset-x-0 z-30 flex flex-col items-center pointer-events-none px-4"
            >
              <svg
                viewBox="0 0 900 130"
                className="w-full max-w-[720px] h-auto drop-shadow-[0_10px_28px_rgba(0,0,0,0.98)]"
                aria-label="BAD ENDING"
              >
                <defs>
                  <pattern
                    id="bad-ending-wood-plank-pattern"
                    width="260"
                    height="66"
                    patternUnits="userSpaceOnUse"
                  >
                    <rect x="0" y="0" width="260" height="22" fill="#9a4416" />
                    <rect x="0" y="22" width="260" height="22" fill="#883a11" />
                    <rect x="0" y="44" width="260" height="22" fill="#934014" />
                    <path
                      d="M0 5 Q 65 2, 130 7 T 260 5 M0 28 Q 85 24, 170 30 T 260 27 M0 51 Q 95 47, 185 54 T 260 50"
                      stroke="#cc6428"
                      strokeWidth="2.5"
                      fill="none"
                    />
                    <line x1="0" y1="22" x2="260" y2="22" stroke="#2e1003" strokeWidth="2.2" />
                    <line x1="0" y1="44" x2="260" y2="44" stroke="#2e1003" strokeWidth="2.2" />
                  </pattern>
                </defs>
                <text
                  x="450"
                  y="98"
                  textAnchor="middle"
                  fill="url(#bad-ending-wood-plank-pattern)"
                  stroke="#1f0a02"
                  strokeWidth="2.5"
                  paintOrder="stroke fill"
                  fontFamily="'Rubik Dirt', 'Barlow Condensed', sans-serif"
                  fontSize="96"
                  letterSpacing="14"
                >
                  BAD ENDING
                </text>
              </svg>
            </div>
          )}

        {/* Heartbeat QTE [E] Prompt that expels its border outward and fades out (instead of bouncing up and down) */}
        {phase === 'FP_QTE_RESIST_AND_KICK' && (
          <div className="absolute top-[52%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 flex items-center justify-center">
            <style>{`
              @keyframes qteHeartbeatCore {
                0%, 100% { transform: scale(1); }
                14% { transform: scale(1.11); }
                28% { transform: scale(0.98); }
                42% { transform: scale(1.07); }
                62% { transform: scale(1); }
              }
              @keyframes qteExpelBorderPrimary {
                0% {
                  transform: scale(1, 1);
                  opacity: 0.95;
                }
                75% {
                  transform: scale(1.52, 1.78);
                  opacity: 0.18;
                }
                100% {
                  transform: scale(1.68, 1.98);
                  opacity: 0;
                }
              }
              @keyframes qteExpelBorderSecondary {
                0%, 24% {
                  transform: scale(1, 1);
                  opacity: 0;
                }
                28% {
                  transform: scale(1.02, 1.04);
                  opacity: 0.78;
                }
                92% {
                  transform: scale(1.42, 1.65);
                  opacity: 0.08;
                }
                100% {
                  transform: scale(1.55, 1.82);
                  opacity: 0;
                }
              }
              @keyframes qtePressBurstBorder {
                0% {
                  transform: scale(1.02, 1.05);
                  opacity: 1;
                }
                100% {
                  transform: scale(1.85, 2.25);
                  opacity: 0;
                }
              }
            `}</style>

            {/* Primary Heartbeat Expelled Border Ring */}
            <span
              aria-hidden="true"
              style={{ animation: 'qteExpelBorderPrimary 0.62s cubic-bezier(0.16, 1, 0.3, 1) infinite' }}
              className="pointer-events-none absolute inset-0 border-2 border-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.75)]"
            />

            {/* Secondary Lub-Dub Echo Expelled Border Ring */}
            <span
              aria-hidden="true"
              style={{ animation: 'qteExpelBorderSecondary 0.62s cubic-bezier(0.16, 1, 0.3, 1) infinite' }}
              className="pointer-events-none absolute inset-0 border-2 border-red-500 shadow-[0_0_18px_rgba(239,68,68,0.65)]"
            />

            {/* Extra Shockwave Border Expelled on Each [E] Press */}
            {qtePresses > 0 && (
              <span
                key={`press-burst-${qtePresses}`}
                aria-hidden="true"
                style={{ animation: 'qtePressBurstBorder 0.38s ease-out forwards' }}
                className="pointer-events-none absolute inset-0 border-2 border-white shadow-[0_0_22px_rgba(254,240,138,0.95)]"
              />
            )}

            <button
              type="button"
              data-testid="qte-press-e-btn"
              onClick={handleQtePressE}
              style={{ animation: 'qteHeartbeatCore 0.62s ease-in-out infinite' }}
              className="relative z-10 px-4 py-1.5 bg-zinc-950/95 hover:bg-zinc-900 border-2 border-amber-400 text-amber-300 text-base font-extrabold shadow-[0_0_24px_rgba(245,158,11,0.45)] cursor-pointer"
            >
              E ({qtePresses}/{POST_NIGHT_5_QTE_REQUIRED_PRESSES}) · {qteRemainingSec.toFixed(1)}s
            </button>
          </div>
        )}

        {/* Bank Exterior Door [E] Popover (100% identical to Hotel Exterior Door [E] Popover in Night 2, 3 & 4) */}
        {phase === 'BANK_EXTERIOR_WALK' && nearBankDoor && (
          <button
            type="button"
            data-testid="bank-interact-e-btn"
            aria-label="Entrar al banco [E]"
            onClick={handleBankInteractE}
            style={{
              left: `${(BANK_EXTERIOR_DOOR_X / CANVAS_W) * 100}%`,
            }}
            className="absolute top-[52%] -translate-x-1/2 -translate-y-1/2 z-20 px-2 py-0.5 bg-zinc-950/95 hover:bg-zinc-900 border-2 border-amber-400 text-amber-300 text-xs font-extrabold shadow-lg cursor-pointer animate-bounce"
          >
            E
          </button>
        )}

        {/* Bank Interior Receptionist [E] Popover (100% identical to Hotel Receptionist [E] Popover in Night 2, 3 & 4) */}
        {phase === 'BANK_INTERIOR_WALK' && nearReceptionist && (
          <button
            type="button"
            data-testid="bank-interact-e-btn"
            aria-label="Hablar con la recepcionista [E]"
            onClick={handleBankInteractE}
            style={{
              left: `${(BANK_RECEPTIONIST_X / CANVAS_W) * 100}%`,
            }}
            className="absolute top-[46%] -translate-x-1/2 -translate-y-1/2 z-20 px-2 py-0.5 bg-zinc-950/95 hover:bg-zinc-900 border-2 border-amber-400 text-amber-300 text-xs font-extrabold shadow-lg cursor-pointer animate-bounce"
          >
            E
          </button>
        )}

        {/* Standard 8-Bit Dialogue Box (100% identical to Night 2, Night 3 & Night 4) */}
        {activeTab && (
          <div
            data-testid="post-night5-dialogue-box"
            onClick={() => {
              if (phase === 'NO_DOCS_FP_DYING_AUTOMATIC_DIALOGUE') return;
              if (!activeTab.hasYesNoChoice || typedChars < fullDialogueText.length) {
                handleAdvanceDialogue();
              }
            }}
            className={`absolute bottom-6 left-1/2 -translate-x-1/2 w-[80vw] max-w-[80vw] bg-zinc-950/95 border-2 border-zinc-400 rounded-xl p-5 sm:p-6 shadow-2xl ${
              phase === 'NO_DOCS_FP_DYING_AUTOMATIC_DIALOGUE' ? 'cursor-default' : 'cursor-pointer'
            }`}
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5 mb-3">
              <div className="flex items-center gap-2.5">
                <span
                  data-testid="post-night5-speaker"
                  className="text-sm sm:text-base font-bold uppercase tracking-widest px-2.5 py-0.5 rounded bg-zinc-900 border border-zinc-700"
                  style={{ color: activeTab.speakerColor }}
                >
                  {activeTab.speaker}
                </span>
              </div>
              <span className="text-[11px] text-zinc-400 uppercase tracking-widest">
                HISTORIA 8-BIT
              </span>
            </div>

            <div
              data-testid="post-night5-dialogue-text"
              className="text-base sm:text-xl text-zinc-100 font-semibold leading-relaxed min-h-[3.5rem]"
            >
              {renderSegmentedDialogueText()}
            </div>

            {activeTab.hasYesNoChoice && typedChars >= fullDialogueText.length ? (
              <div
                data-testid="post-night5-yes-no-choices"
                className="mt-4 pt-3 border-t border-zinc-800 flex items-center justify-around gap-6"
              >
                <button
                  type="button"
                  data-testid="bank-choice-yes-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleChooseDonateYes();
                  }}
                  onMouseEnter={() => {
                    setSelectedChoice('SI');
                    selectedChoiceRef.current = 'SI';
                  }}
                  className={`px-8 py-2.5 text-sm sm:text-base font-extrabold uppercase tracking-widest border-2 transition-colors cursor-pointer ${
                    selectedChoice === 'SI'
                      ? 'bg-amber-400 text-black border-white scale-105'
                      : 'bg-zinc-900 text-zinc-200 border-zinc-500 hover:bg-zinc-800'
                  }`}
                >
                  ► SÍ ◄
                </button>
                <button
                  type="button"
                  data-testid="bank-choice-no-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleChooseDonateNo();
                  }}
                  onMouseEnter={() => {
                    setSelectedChoice('NO');
                    selectedChoiceRef.current = 'NO';
                  }}
                  className={`px-8 py-2.5 text-sm sm:text-base font-extrabold uppercase tracking-widest border-2 transition-colors cursor-pointer ${
                    selectedChoice === 'NO'
                      ? 'bg-red-600 text-white border-white scale-105'
                      : 'bg-zinc-900 text-zinc-200 border-zinc-500 hover:bg-zinc-800'
                  }`}
                >
                  ► NO ◄
                </button>
              </div>
            ) : (
              phase !== 'FP_GRABBED_FROM_BEHIND' &&
              !phase.startsWith('NO_DOCS_') && (
                <div className="mt-3 flex items-center justify-end pt-2 border-t border-zinc-900">
                  <button
                    type="button"
                    data-testid="post-night5-enter-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAdvanceDialogue();
                    }}
                    className="px-3.5 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    PULSA [ENTER] PARA CONTINUAR ▶
                  </button>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// REUSED 8-BIT PIXEL HELPERS FROM INTERLUDES 2->3, 3->4 & 4->5
// ============================================================================

function drawPixelRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string
) {
  ctx.fillStyle = color;
  ctx.fillRect(
    Math.round(x / 4) * 4,
    Math.round(y / 4) * 4,
    Math.round(w / 4) * 4,
    Math.round(h / 4) * 4
  );
}

function draw8BitPineTree(
  ctx: CanvasRenderingContext2D,
  cx: number,
  baseY: number,
  scale = 1
) {
  const s = 4 * scale;
  drawPixelRect(ctx, cx - s, baseY - s * 5, s * 2, s * 5, '#29170b');
  drawPixelRect(ctx, cx - s * 5, baseY - s * 10, s * 10, s * 5, '#0c291b');
  drawPixelRect(ctx, cx - s * 4, baseY - s * 15, s * 8, s * 5, '#133825');
  drawPixelRect(ctx, cx - s * 2, baseY - s * 19, s * 4, s * 4, '#1b4730');
}

/**
 * Exact draw8BitProtagonist from EightBitPostNight3Minigame & EightBitPostNight4Minigame,
 * with `holdingMoney = true` so Richard holds the green bundle of money in his hand outside & inside the Bank!
 */
function draw8BitProtagonist(
  ctx: CanvasRenderingContext2D,
  x: number,
  groundY: number,
  facing: -1 | 1,
  walkPhase: number,
  isWalking: boolean,
  holdingMoney = false,
  timeSec = 0
) {
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

  // Left Leg & Animated Shoe
  drawPixelRect(ctx, x - 12 + leftStrideX, groundY - 32 + leftLiftY, 10, 24, '#1e293b');
  drawPixelRect(
    ctx,
    x - 12 + leftStrideX + (facing === 1 ? 0 : -4),
    groundY - 8 + leftLiftY,
    14,
    8,
    '#451a03'
  );

  // Right Leg & Animated Shoe
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

  // Arms
  drawPixelRect(
    ctx,
    x - 20,
    groundY - 64 + bodyBobY + (stepFrame === 3 ? -2 : 0),
    6,
    26,
    '#172554'
  );
  drawPixelRect(
    ctx,
    x + 14,
    groundY - 64 + bodyBobY + (stepFrame === 1 ? -2 : 0),
    6,
    26,
    '#172554'
  );

  // Money bundle held visibly in Richard's hand ("Richard con el dinero en la mano")
  if (holdingMoney) {
    const handX = facing === 1 ? x + 16 : x - 36;
    const handY = groundY - 48 + bodyBobY;
    drawPixelRect(ctx, handX, handY, 20, 12, '#15803d');
    drawPixelRect(ctx, handX + 4, handY + 2, 12, 8, '#22c55e');
    drawPixelRect(ctx, handX + 8, handY, 4, 12, '#fde047');
  }

  // Head (24x24) & Hair/Cap (total height ~96px)
  const headBob = bodyBobY + (Math.floor(timeSec * 2) % 2 === 0 ? 0 : 0);
  drawPixelRect(ctx, x - 12, groundY - 92 + headBob, 24, 24, '#fcd34d');
  drawPixelRect(ctx, x - 14, groundY - 96 + headBob, 28, 8, '#451a03');
  if (facing >= 0) {
    drawPixelRect(ctx, x + 4, groundY - 82 + headBob, 4, 4, '#09090b');
  } else {
    drawPixelRect(ctx, x - 8, groundY - 82 + headBob, 4, 4, '#09090b');
  }
}

/**
 * Exact draw8BitReceptionist from EightBitPostNight3Minigame & EightBitPostNight4Minigame
 */
function draw8BitReceptionist(
  ctx: CanvasRenderingContext2D,
  x: number,
  counterTopY: number,
  variant: 1 | 2
) {
  drawPixelRect(ctx, x - 14, counterTopY - 36, 28, 36, variant === 1 ? '#7f1d1d' : '#1e3a8a');
  drawPixelRect(ctx, x - 4, counterTopY - 34, 8, 28, '#f8fafc');
  drawPixelRect(ctx, x - 2, counterTopY - 30, 4, 16, '#eab308');
  drawPixelRect(ctx, x - 12, counterTopY - 60, 24, 24, variant === 1 ? '#fde68a' : '#fed7aa');
  drawPixelRect(ctx, x - 14, counterTopY - 66, 28, 8, variant === 1 ? '#991b1b' : '#271509');
  drawPixelRect(ctx, x - 10, counterTopY - 62, 20, 4, '#eab308');
  drawPixelRect(ctx, x - 6, counterTopY - 50, 4, 4, '#09090b');
  drawPixelRect(ctx, x + 2, counterTopY - 50, 4, 4, '#09090b');
}

// ============================================================================
// MAIN RENDER DISPATCHER
// ============================================================================

interface RenderEnding1Params {
  phase: PostNight5EndingPhase;
  elapsedSec: number;
  timeSec: number;
  qtePresses: number;
  lastPressTimeSec: number;
  playerX: number;
  playerFacing: -1 | 1;
  walkCycle: number;
  isWalking: boolean;
  fadeAlpha: number;
  timeSinceDialogueDone?: number;
  noDocsCorridorProgress?: number;
  noDocsRunCycleSec?: number;
}

function renderEnding1Scene(ctx: CanvasRenderingContext2D, p: RenderEnding1Params) {
  const W = CANVAS_W;
  const H = CANVAS_H;
  ctx.clearRect(0, 0, W, H);

  if (
    p.phase === 'FP_OFFICE_REWARD_VOICE' ||
    (p.phase === 'FADE_OFFICE_TO_CLOSET' && p.elapsedSec < 0.7)
  ) {
    drawFirstPerson8BitOfficeScene(ctx, W, H, p.timeSec);
  } else if (
    p.phase === 'FADE_OFFICE_TO_CLOSET' ||
    p.phase === 'FP_CLOSET_LOOK_AROUND_AND_OPEN' ||
    p.phase === 'FP_GRABBED_FROM_BEHIND'
  ) {
    const lookState =
      p.phase === 'FP_CLOSET_LOOK_AROUND_AND_OPEN'
        ? getPostNight5ClosetLookState(p.elapsedSec)
        : p.phase === 'FADE_OFFICE_TO_CLOSET'
        ? getPostNight5ClosetLookState(0)
        : getPostNight5ClosetLookState(6.2);

    const shakeX =
      p.phase === 'FP_GRABBED_FROM_BEHIND' ? Math.round(Math.sin(p.timeSec * 90) * 10) : 0;
    const shakeY =
      p.phase === 'FP_GRABBED_FROM_BEHIND' ? Math.round(Math.cos(p.timeSec * 110) * 8) : 0;

    ctx.save();
    ctx.translate(shakeX, shakeY);
    drawFirstPersonPizzeriaCorridorDoorScene(ctx, W, H, {
      doorMode: 'CAM_05_HALF_OPEN',
      fpProgress: 0.92 + lookState.approachProgress * 0.08,
      approachProgress: lookState.approachProgress,
      cameraYaw: lookState.cameraYaw,
      doorOpenProgress: lookState.doorOpenProgress,
      grabbedFromBehind: p.phase === 'FP_GRABBED_FROM_BEHIND',
      timeSec: p.timeSec,
    });
    ctx.restore();
  } else if (p.phase === 'FP_SPIN_AROUND_TO_FACE') {
    // Smooth, continuous 1.35s 180-degree whip-pan turn from the CAM 05 door to The Thing's face!
    const spinDuration = 1.35;
    const rawT = Math.max(0, Math.min(1, p.elapsedSec / spinDuration));
    // Smooth cubic ease-in-out for the 180-degree camera rotation
    const easeSpin =
      rawT < 0.5 ? 4 * rawT * rawT * rawT : 1 - Math.pow(-2 * rawT + 2, 3) / 2;

    // 1st half of the 180-degree turn: corridor swings smoothly across the screen
    if (easeSpin < 0.68) {
      const corridorYaw = easeSpin * 2.45;
      ctx.save();
      drawFirstPersonPizzeriaCorridorDoorScene(ctx, W, H, {
        doorMode: 'CAM_05_HALF_OPEN',
        fpProgress: 1.0,
        approachProgress: 1.0,
        cameraYaw: corridorYaw,
        doorOpenProgress: 1.0,
        grabbedFromBehind: true,
        timeSec: p.timeSec,
      });
      ctx.restore();
    }

    // 2nd half of the 180-degree turn: The Thing cross-pans smoothly in from the right into center close-up!
    if (easeSpin > 0.28) {
      const thingAlpha = Math.min(1, (easeSpin - 0.28) / 0.34);
      const panProgress = Math.min(1, (easeSpin - 0.28) / 0.72);
      const smoothPan = 1 - Math.pow(1 - panProgress, 3);
      const spinPanOffsetX = Math.round((1 - smoothPan) * 520);

      ctx.save();
      ctx.globalAlpha = thingAlpha;
      drawFirstPersonTheThingCloseUpQteAndJumpscare(ctx, W, H, p, spinPanOffsetX, smoothPan);
      ctx.restore();
    }

    // Smooth rotational whip-pan motion streaks at peak angular velocity (around 90 degrees)
    const blurEnvelope = Math.sin(easeSpin * Math.PI);
    if (blurEnvelope > 0.15) {
      ctx.save();
      ctx.fillStyle = `rgba(9, 6, 14, ${(blurEnvelope * 0.42).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
      for (let b = 0; b < 10; b++) {
        const streakY = ((b * 53 + Math.round(p.timeSec * 220)) % (H - 16)) + 8;
        const streakW = Math.round(180 + blurEnvelope * 340);
        const streakX = Math.round(((1 - easeSpin) * W + b * 97) % W) - Math.round(streakW / 2);
        drawPixelRect(
          ctx,
          streakX,
          streakY,
          streakW,
          4,
          b % 3 === 0
            ? `rgba(220, 38, 38, ${(blurEnvelope * 0.32).toFixed(2)})`
            : `rgba(212, 212, 216, ${(blurEnvelope * 0.22).toFixed(2)})`
        );
      }
      ctx.restore();
    }
  } else if (
    p.phase === 'FP_QTE_RESIST_AND_KICK' ||
    p.phase === 'FP_QTE_SUCCESS_KICK_IMPACT' ||
    p.phase === 'FP_QTE_FAIL_JUMPSCARE'
  ) {
    drawFirstPersonTheThingCloseUpQteAndJumpscare(ctx, W, H, p, 0, 1);
  } else if (
    p.phase === 'BAD_ENDING_STILL_NOTHING' ||
    p.phase === 'BAD_ENDING_FADE_OUT'
  ) {
    drawStillNothingBadEndingScene(ctx, W, H, p.timeSec);
  } else if (p.phase === 'FP_FLEE_CUT_1_GRAB_MONEY') {
    drawFirstPersonCam05GrabMoneyScene(ctx, W, H, p.elapsedSec, p.timeSec);
  } else if (
    p.phase === 'FP_FLEE_CUT_2_HALL_SCREAM_1' ||
    p.phase === 'FP_FLEE_CUT_3_HALL_SCREAM_2' ||
    p.phase === 'FP_FLEE_CUT_4_EXIT_SCREAM_3' ||
    (p.phase === 'FADE_TO_BANK_EXTERIOR' && p.elapsedSec < 0.65)
  ) {
    // Reuses the exact 1st-person pizzeria corridor from Interlude 3->4 as Richard sprints toward the EXIT door!
    // Keeps rendering the EXIT door during the first 0.65s of FADE_TO_BANK_EXTERIOR while fading out to black.
    const fpProgress =
      p.phase === 'FP_FLEE_CUT_2_HALL_SCREAM_1'
        ? Math.min(0.45, 0.22 + p.elapsedSec * 0.12)
        : p.phase === 'FP_FLEE_CUT_3_HALL_SCREAM_2'
        ? Math.min(0.78, 0.55 + p.elapsedSec * 0.12)
        : p.phase === 'FADE_TO_BANK_EXTERIOR'
        ? 1.0
        : Math.min(1.0, 0.85 + p.elapsedSec * 0.12);

    drawFirstPersonPizzeriaCorridorDoorScene(ctx, W, H, {
      doorMode: 'EXIT_DOOR',
      fpProgress,
      cameraYaw: 0,
      doorOpenProgress:
        p.phase === 'FP_FLEE_CUT_4_EXIT_SCREAM_3'
          ? Math.min(1, p.elapsedSec / 0.8)
          : p.phase === 'FADE_TO_BANK_EXTERIOR'
          ? 1.0
          : 0,
      grabbedFromBehind: false,
      holdingMoneyInFirstPerson: true,
      isRunning: true,
      timeSec: p.timeSec,
    });
  } else if (
    (p.phase === 'FADE_TO_BANK_EXTERIOR' && p.elapsedSec >= 0.65) ||
    p.phase === 'BANK_EXTERIOR_WALK' ||
    (p.phase === 'FADE_TO_BANK_INTERIOR' && p.elapsedSec < 0.55)
  ) {
    // Renders Bank Exterior after the screen reaches full black in FADE_TO_BANK_EXTERIOR,
    // during BANK_EXTERIOR_WALK, and during the fade-out half (elapsed < 0.55s) of FADE_TO_BANK_INTERIOR.
    const exteriorPlayerX =
      p.phase === 'FADE_TO_BANK_EXTERIOR' ? BANK_EXTERIOR_START_X : p.playerX;
    const exteriorFacing =
      p.phase === 'FADE_TO_BANK_EXTERIOR' ? 1 : p.playerFacing;

    drawBankExteriorSceneReusedStyle(
      ctx,
      W,
      H,
      p.timeSec,
      exteriorPlayerX,
      exteriorFacing,
      p.walkCycle,
      p.isWalking
    );
  } else if (
    (p.phase === 'FADE_TO_BANK_INTERIOR' && p.elapsedSec >= 0.55) ||
    p.phase === 'BANK_INTERIOR_WALK' ||
    p.phase === 'BANK_RECEPTIONIST_CHOICE' ||
    p.phase === 'BANK_NO_CONSTRUCTION_MODAL' ||
    p.phase === 'GOOD_ENDING_FADE_TO_MENU'
  ) {
    // Renders Bank Interior starting at BANK_INTERIOR_START_X (150, by the entrance door on the left)
    // once the screen has faded completely to black at elapsed >= 0.55s of FADE_TO_BANK_INTERIOR.
    const interiorPlayerX =
      p.phase === 'FADE_TO_BANK_INTERIOR' ? BANK_INTERIOR_START_X : p.playerX;
    const interiorFacing =
      p.phase === 'FADE_TO_BANK_INTERIOR' ? 1 : p.playerFacing;

    drawBankInteriorSceneReusedStyle(
      ctx,
      W,
      H,
      p.timeSec,
      interiorPlayerX,
      interiorFacing,
      p.walkCycle,
      p.isWalking
    );
  } else if (p.phase === 'NO_DOCS_FP_LEFT_HALL_AND_TURN') {
    // Corriendo en primera persona por el pasillo izquierdo que da a la oficina (CAM 2A / 2B)
    // hacia la esquina izquierda que conecta con el gran pasillo de entrada hacia la salida (sin fundidos a negro).
    const runState = getPostNight5NoDocsRunAndTurnState(
      p.phase,
      p.elapsedSec,
      p.timeSinceDialogueDone ?? -1
    );
    const runCycle = p.noDocsRunCycleSec ?? p.timeSec;
    drawFirstPersonLeftOfficeCorridorScene(
      ctx,
      W,
      H,
      runState.leftCorridorProgress,
      0,
      runCycle
    );
  } else if (
    p.phase === 'NO_DOCS_FP_RUN_1_OFFICE' ||
    p.phase === 'NO_DOCS_FP_RUN_2_CORRIDOR' ||
    p.phase === 'NO_DOCS_FP_RUN_3_CORRIDOR' ||
    p.phase === 'NO_DOCS_FP_RUN_4_SISTER' ||
    p.phase === 'NO_DOCS_FP_BRAKE_AT_EXIT'
  ) {
    // En NO_DOCS_FP_RUN_1_OFFICE, Richard gira suavemente 90° a la izquierda desde el pasillo izquierdo de la oficina
    // hacia el gran pasillo de entrada/salida (sin fundido a negro), justo cuando The Thing empieza a gritar "¡VUELVE AQUÍ!".
    // Después continúa corriendo de forma continua por el gran pasillo hasta que termina de escribirse
    // "¡¿ES QUE ACASO NO TE IMPORTA TU HERMANA?!", momento en el que frena en seco y TODA animación de correr se detiene por completo!
    const runState = getPostNight5NoDocsRunAndTurnState(
      p.phase,
      p.elapsedSec,
      p.timeSinceDialogueDone ?? -1
    );
    const hasBraked = runState.hasBrakedDead;
    const isRunning = runState.isRunning;
    const brakeElapsed =
      p.phase === 'NO_DOCS_FP_RUN_4_SISTER' && hasBraked
        ? Math.max(0, p.timeSinceDialogueDone ?? 0)
        : p.phase === 'NO_DOCS_FP_BRAKE_AT_EXIT'
        ? 1.0
        : 0;

    const runCycle = p.noDocsRunCycleSec ?? p.timeSec;
    const fpProgress = hasBraked ? 0.96 : p.noDocsCorridorProgress ?? 0.25;
    const approachProgress = hasBraked
      ? 0.85
      : Math.max(0, Math.min(0.85, (fpProgress - 0.72) / 0.28));

    const runBobX = isRunning ? Math.round(Math.sin(runCycle * 16) * 6) : 0;
    const runBobY = isRunning
      ? Math.round(Math.sin(runCycle * 16) * 5) +
        Math.round(Math.abs(Math.cos(runCycle * 16)) * 6)
      : brakeElapsed > 0 && brakeElapsed < 0.26
      ? Math.round(Math.sin((brakeElapsed / 0.26) * Math.PI) * 12)
      : 0;

    // 1. Render the Grand Entrance / Exit Corridor rotating in from the left (cameraYaw: +1.15 -> 0) and advancing smoothly
    drawFirstPersonPizzeriaCorridorDoorScene(ctx, W, H, {
      doorMode: 'EXIT_DOOR',
      fpProgress,
      approachProgress,
      cameraYaw: runState.exitCorridorCameraYaw,
      doorOpenProgress: 0,
      grabbedFromBehind: false,
      holdingMoneyInFirstPerson: false,
      isRunning,
      runBobPhase: runCycle,
      extraBobX: runBobX,
      extraBobY: runBobY,
      timeSec: p.timeSec,
    });

    // 2. During the smooth 90° left turn at the start of NO_DOCS_FP_RUN_1_OFFICE, pan the outgoing Left Office Corridor
    // corner wall smoothly off to the right so the two corridors join without any cut or fade to black!
    if (p.phase === 'NO_DOCS_FP_RUN_1_OFFICE' && runState.turnLeftProgress < 1) {
      drawFirstPersonLeftOfficeCorridorScene(
        ctx,
        W,
        H,
        1.0,
        runState.turnLeftProgress,
        runCycle
      );
    }
  } else if (p.phase === 'NO_DOCS_FP_TURN_TO_THING') {
    // "y al girarse se encontrara con the thing de frente" (kept untouched, with isRunning: false so corridor does not bob)
    const spinDuration = 1.35;
    const rawT = Math.max(0, Math.min(1, p.elapsedSec / spinDuration));
    const easeSpin =
      rawT < 0.5 ? 4 * rawT * rawT * rawT : 1 - Math.pow(-2 * rawT + 2, 3) / 2;

    if (easeSpin < 0.68) {
      const corridorYaw = easeSpin * 2.45;
      ctx.save();
      drawFirstPersonPizzeriaCorridorDoorScene(ctx, W, H, {
        doorMode: 'EXIT_DOOR',
        fpProgress: 0.96,
        approachProgress: 0.85,
        cameraYaw: corridorYaw,
        doorOpenProgress: 0,
        grabbedFromBehind: false,
        holdingMoneyInFirstPerson: false,
        isRunning: false,
        timeSec: p.timeSec,
      });
      ctx.restore();
    }

    if (easeSpin > 0.28) {
      const thingAlpha = Math.min(1, (easeSpin - 0.28) / 0.34);
      const panProgress = Math.min(1, (easeSpin - 0.28) / 0.72);
      const smoothPan = 1 - Math.pow(1 - panProgress, 3);
      const spinPanOffsetX = Math.round((1 - smoothPan) * 520);

      ctx.save();
      ctx.globalAlpha = thingAlpha;
      drawFirstPersonTheThingCloseUpQteAndJumpscare(ctx, W, H, p, spinPanOffsetX, smoothPan * 0.78);
      ctx.restore();
    }
  } else if (
    p.phase === 'NO_DOCS_FP_THING_OFFER_MONEY' ||
    (p.phase === 'NO_DOCS_FADE_TO_CAM05' && p.elapsedSec < 0.8)
  ) {
    // The Thing standing right in front of Richard offering the money in CAM 05
    drawFirstPersonTheThingCloseUpQteAndJumpscare(ctx, W, H, p, 0, 0.78);
  } else if (p.phase === 'NO_DOCS_FADE_TO_CAM05' && p.elapsedSec >= 0.8) {
    // Fading in at the ALMACEN (CAM 05) door as Richard enters to collect the money
    const enterT = Math.min(1, (p.elapsedSec - 0.8) / 0.85);
    drawFirstPersonPizzeriaCorridorDoorScene(ctx, W, H, {
      doorMode: 'CAM_05_HALF_OPEN',
      fpProgress: 0.94 + enterT * 0.06,
      approachProgress: 0.65 + enterT * 0.35,
      cameraYaw: 0,
      doorOpenProgress: enterT * 0.85,
      grabbedFromBehind: false,
      holdingMoneyInFirstPerson: false,
      timeSec: p.timeSec,
    });
  } else if (
    p.phase === 'NO_DOCS_FP_REACH_FOR_MONEY' ||
    p.phase === 'NO_DOCS_FP_IMPALED_BY_CLAW' ||
    p.phase === 'NO_DOCS_FP_THROWN_TO_FLOOR' ||
    p.phase === 'NO_DOCS_FP_DYING_AUTOMATIC_DIALOGUE' ||
    p.phase === 'NO_DOCS_FP_SLOW_DEATH_BLINK'
  ) {
    drawNoDocsCam05ImpaledAndDyingScene(ctx, W, H, p);
  }

  // Exact 8-Bit CRT Scanlines Overlay from EightBitPostNight3Minigame & EightBitPostNight4Minigame
  ctx.fillStyle = 'rgba(0, 0, 0, 0.34)';
  for (let sy = 0; sy < H; sy += 6) {
    ctx.fillRect(0, sy, W, 3);
  }

  // Fade-to-Black / Fade-from-Black Curtain
  if (p.fadeAlpha > 0) {
    ctx.fillStyle = `rgba(0, 0, 0, ${p.fadeAlpha.toFixed(3)})`;
    ctx.fillRect(0, 0, W, H);
  }
}

// ============================================================================
// SCENE 1B: 8-BIT FIRST-PERSON LEFT OFFICE CORRIDOR (CAM 2A / 2B) & 90° LEFT TURN
// Renders Richard sprinting out of the Security Office along the Left Corridor
// toward the end-of-hall intersection where the Grand Entrance / Exit Corridor
// opens up to the LEFT, and smoothly turning 90° left around the corner pillar!
// ============================================================================
function drawFirstPersonLeftOfficeCorridorScene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  leftCorridorProgress: number,
  turnLeftProgress: number,
  runCycleSec: number
) {
  // During the 90° left turn (turnLeftProgress: 0 -> 1), the Left Corridor end wall
  // swings smoothly to the right side of the screen as the Grand Entrance Corridor
  // on the left rotates into center view!
  const turnShiftX = Math.round(turnLeftProgress * w * 0.92);
  const bobX = turnLeftProgress > 0 ? 0 : Math.round(Math.sin(runCycleSec * 16) * 6);
  const bobY =
    turnLeftProgress > 0
      ? 0
      : Math.round(Math.sin(runCycleSec * 16) * 5) +
        Math.round(Math.abs(Math.cos(runCycleSec * 16)) * 6);

  const cx = Math.round(w * 0.54 + turnShiftX + bobX);
  const cy = Math.round(h * 0.46 + bobY);

  // Scale of the end-of-corridor corner wall grows as Richard runs from 0 -> 1
  const scale = 0.72 + leftCorridorProgress * 1.18;
  const farW = Math.round(210 * scale);
  const farH = Math.round(244 * scale);
  const farLeft = Math.round(cx - farW * 0.36);
  const farRight = Math.round(cx + farW * 0.64);
  const farTop = Math.round(cy - farH * 0.48);
  const farBottom = Math.round(cy + farH * 0.52);

  const nearLeftEdge = Math.min(-320, farLeft - 420);
  const nearRightEdge = Math.max(w + 480, farRight + 380);

  // Where the foreground left wall ends (`cornerLeftX`), creating a wide open 3D corridor
  // branching 90° to the LEFT between `cornerLeftX` (near left corner) and `farLeft` (far corner pillar)!
  const openTurnWallT = Math.max(0.14, Math.min(0.76, 0.32 + leftCorridorProgress * 0.42));
  const cornerLeftX = Math.round(farLeft + (nearLeftEdge - farLeft) * openTurnWallT);
  const cornerLeftTop = Math.round(farTop * (1 - openTurnWallT));
  const cornerLeftBottom = Math.round(farBottom + (h - farBottom) * Math.pow(openTurnWallT, 1.48));

  ctx.save();
  // During the 90° left turn (turnLeftProgress > 0), clip to the right of the far corner pillar (`farLeft - 6`)
  // so the Grand Entrance Corridor rendered underneath fills the entire open left turn seamlessly!
  if (turnLeftProgress > 0) {
    const clipX = Math.max(0, Math.round(farLeft - 8));
    ctx.beginPath();
    ctx.rect(clipX, 0, Math.max(0, w - clipX + 60), h);
    ctx.clip();
  } else {
    ctx.fillStyle = '#040407';
    ctx.fillRect(0, 0, w, h);
  }

  // 1. CEILING & RAFTERS OF THE LEFT OFFICE CORRIDOR
  ctx.fillStyle = '#0a0910';
  ctx.beginPath();
  ctx.moveTo(nearLeftEdge, 0);
  ctx.lineTo(nearRightEdge, 0);
  ctx.lineTo(farRight, farTop);
  ctx.lineTo(farLeft, farTop);
  ctx.closePath();
  ctx.fill();

  const ceilingWorldZList = [0.24, 0.48, 0.72, 0.96, 1.2];
  for (let i = 0; i < ceilingWorldZList.length; i++) {
    const proj = projectFirstPersonCorridorProp(
      ceilingWorldZList[i],
      leftCorridorProgress * 0.85,
      false
    );
    if (!proj.visible) continue;
    const t = proj.wallT;
    const ry = Math.round(farTop * (1 - t));
    const lx = Math.round(farLeft + (nearLeftEdge - farLeft) * t);
    const rx = Math.round(farRight + (nearRightEdge - farRight) * t);
    const beamH = Math.max(4, Math.round(6 * proj.scale));
    ctx.fillStyle = '#16120e';
    ctx.fillRect(lx, ry, rx - lx, beamH);
  }

  // 2. PERSPECTIVE BLACK & WHITE CHECKERED FLOOR (Scrolling rapidly as Richard runs)
  const floorRows = 10;
  const worldFloorShift = leftCorridorProgress * 8.5;
  const fracShift = worldFloorShift - Math.floor(worldFloorShift);
  const rowParityShift = Math.floor(worldFloorShift);

  for (let r = 0; r < floorRows; r++) {
    const t0 = Math.max(0, (r + fracShift * 0.85) / floorRows);
    const t1 = Math.min(1, (r + 1 + fracShift * 0.85) / floorRows);
    const p0 = Math.pow(t0, 1.48);
    const p1 = Math.pow(t1, 1.48);

    const y0 = Math.round(farBottom + (h - farBottom) * p0);
    const y1 = Math.round(farBottom + (h - farBottom) * p1);
    const left0 = Math.round(farLeft + (nearLeftEdge - farLeft) * p0);
    const right0 = Math.round(farRight + (nearRightEdge - farRight) * p0);
    const left1 = Math.round(farLeft + (nearLeftEdge - farLeft) * p1);
    const right1 = Math.round(farRight + (nearRightEdge - farRight) * p1);

    const cols = 12;
    for (let c = 0; c < cols; c++) {
      const c0 = c / cols;
      const c1 = (c + 1) / cols;
      const x00 = Math.round(left0 + (right0 - left0) * c0);
      const x01 = Math.round(left0 + (right0 - left0) * c1);
      const x10 = Math.round(left1 + (right1 - left1) * c0);
      const x11 = Math.round(left1 + (right1 - left1) * c1);

      const tileParity = (r - rowParityShift + c + 100) % 2 === 0;
      ctx.fillStyle = tileParity ? '#0e0e13' : '#b8c4d4';
      ctx.beginPath();
      ctx.moveTo(x00, y0);
      ctx.lineTo(x01, y0);
      ctx.lineTo(x11, y1);
      ctx.lineTo(x10, y1);
      ctx.closePath();
      ctx.fill();
    }
  }

  // 3. RIGHT WALL (Continuous wall from the Security Office up to the corner)
  const wainsNearTop = Math.round(h * 0.62 + bobY);
  const wainsFarTop = Math.round(farTop + (farBottom - farTop) * 0.62);

  ctx.fillStyle = '#1d1922';
  ctx.beginPath();
  ctx.moveTo(nearRightEdge, 0);
  ctx.lineTo(farRight, farTop);
  ctx.lineTo(farRight, farBottom);
  ctx.lineTo(nearRightEdge, h);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#231309';
  ctx.beginPath();
  ctx.moveTo(nearRightEdge, wainsNearTop);
  ctx.lineTo(farRight, wainsFarTop);
  ctx.lineTo(farRight, farBottom);
  ctx.lineTo(nearRightEdge, h);
  ctx.closePath();
  ctx.fill();

  // 4. LEFT WALL & OPEN 90° LEFT BRANCH ARCHWAY INTO THE GRAND ENTRANCE CORRIDOR
  // 4A. Open Left Branch Passageway (between `cornerLeftX` and `farLeft`) where the hallway turns 90° LEFT!
  if (turnLeftProgress === 0 && farLeft > cornerLeftX) {
    const openW = farLeft - cornerLeftX;
    // Deep recessed perpendicular hallway opening going off to the left
    const deepTopLeftY = Math.round(farTop + 18 * scale);
    const deepBotLeftY = Math.round(farBottom - 16 * scale);

    // Dark recessed ceiling of the left entrance corridor branch
    ctx.fillStyle = '#05040a';
    ctx.beginPath();
    ctx.moveTo(cornerLeftX, cornerLeftTop);
    ctx.lineTo(farLeft, farTop);
    ctx.lineTo(farLeft, deepTopLeftY);
    ctx.lineTo(cornerLeftX, deepTopLeftY);
    ctx.closePath();
    ctx.fill();

    // Recessed far wall of the perpendicular entrance corridor (angled deeper into the left distance)
    ctx.fillStyle = '#0d0b14';
    ctx.beginPath();
    ctx.moveTo(cornerLeftX, deepTopLeftY);
    ctx.lineTo(farLeft, farTop);
    ctx.lineTo(farLeft, farBottom);
    ctx.lineTo(cornerLeftX, deepBotLeftY);
    ctx.closePath();
    ctx.fill();

    const deepWainsFar = Math.round(farTop + (farBottom - farTop) * 0.62);
    const deepWainsLeft = Math.round(deepTopLeftY + (deepBotLeftY - deepTopLeftY) * 0.62);
    ctx.fillStyle = '#160c06';
    ctx.beginPath();
    ctx.moveTo(cornerLeftX, deepWainsLeft);
    ctx.lineTo(farLeft, deepWainsFar);
    ctx.lineTo(farLeft, farBottom);
    ctx.lineTo(cornerLeftX, deepBotLeftY);
    ctx.closePath();
    ctx.fill();

    // Perspective checkered floor tiles inside the open left hallway turn
    const branchTileCols = 6;
    for (let bc = 0; bc < branchTileCols; bc++) {
      const bt0 = bc / branchTileCols;
      const bt1 = (bc + 1) / branchTileCols;
      const bx0 = Math.round(cornerLeftX + openW * bt0);
      const bx1 = Math.round(cornerLeftX + openW * bt1);
      const byTop0 = Math.round(deepBotLeftY + (farBottom - deepBotLeftY) * bt0);
      const byTop1 = Math.round(deepBotLeftY + (farBottom - deepBotLeftY) * bt1);
      const byBot0 = Math.round(cornerLeftBottom + (farBottom - cornerLeftBottom) * bt0);
      const byBot1 = Math.round(cornerLeftBottom + (farBottom - cornerLeftBottom) * bt1);

      ctx.fillStyle = bc % 2 === 0 ? '#0c0c12' : '#94a3b8';
      ctx.beginPath();
      ctx.moveTo(bx0, byTop0);
      ctx.lineTo(bx1, byTop1);
      ctx.lineTo(bx1, byBot1);
      ctx.lineTo(bx0, byBot0);
      ctx.closePath();
      ctx.fill();
    }

    // Checkered stripe receding into the left hallway opening
    const branchSegs = 8;
    for (let bs = 0; bs < branchSegs; bs++) {
      const bt0 = bs / branchSegs;
      const bt1 = (bs + 1) / branchSegs;
      const bx0 = Math.round(cornerLeftX + openW * bt0);
      const bx1 = Math.round(cornerLeftX + openW * bt1);
      const by0 = Math.round(deepWainsLeft + (deepWainsFar - deepWainsLeft) * bt0) - 8;
      const by1 = Math.round(deepWainsLeft + (deepWainsFar - deepWainsLeft) * bt1) - 8;
      ctx.fillStyle = bs % 2 === 0 ? '#991b1b' : '#cbd5e1';
      ctx.beginPath();
      ctx.moveTo(bx0, by0);
      ctx.lineTo(bx1, by1);
      ctx.lineTo(bx1, by1 + 8);
      ctx.lineTo(bx0, by0 + 8);
      ctx.closePath();
      ctx.fill();
    }

    // Warm exit hallway light spilling out from the left entrance corridor
    const branchGlow = ctx.createLinearGradient(cornerLeftX, cy, farLeft + 20, cy);
    branchGlow.addColorStop(0, 'rgba(251, 191, 36, 0.24)');
    branchGlow.addColorStop(0.5, 'rgba(16, 185, 129, 0.14)');
    branchGlow.addColorStop(1, 'rgba(0, 0, 0, 0.25)');
    ctx.fillStyle = branchGlow;
    ctx.fillRect(cornerLeftX, cornerLeftTop, openW, cornerLeftBottom - cornerLeftTop);
  }

  // 4B. Foreground section of the left wall (from `nearLeftEdge` up to `cornerLeftX`, before the open left turn):
  if (turnLeftProgress === 0) {
    ctx.fillStyle = '#1d1922';
    ctx.beginPath();
    ctx.moveTo(nearLeftEdge, 0);
    ctx.lineTo(cornerLeftX, cornerLeftTop);
    ctx.lineTo(cornerLeftX, cornerLeftBottom);
    ctx.lineTo(nearLeftEdge, h);
    ctx.closePath();
    ctx.fill();

    const wainsCornerLeftTop = Math.round(
      wainsFarTop + (wainsNearTop - wainsFarTop) * openTurnWallT
    );
    ctx.fillStyle = '#231309';
    ctx.beginPath();
    ctx.moveTo(nearLeftEdge, wainsNearTop);
    ctx.lineTo(cornerLeftX, wainsCornerLeftTop);
    ctx.lineTo(cornerLeftX, cornerLeftBottom);
    ctx.lineTo(nearLeftEdge, h);
    ctx.closePath();
    ctx.fill();

    // Near left corner pillar edge at `cornerLeftX`
    drawPixelRect(
      ctx,
      cornerLeftX - 10,
      cornerLeftTop,
      14,
      cornerLeftBottom - cornerLeftTop,
      '#27272a'
    );
    drawPixelRect(
      ctx,
      cornerLeftX - 4,
      cornerLeftTop,
      4,
      cornerLeftBottom - cornerLeftTop,
      '#52525b'
    );
  }

  // Checkered Red/White/Black Pizzeria Stripe along Right Wall & Foreground Left Wall
  const stripeSegments = 16;
  const bandNearTop = wainsNearTop - 38;
  const bandNearBot = wainsNearTop + 6;
  const bandFarTop = wainsFarTop - Math.round(14 * Math.min(1.6, scale));
  const bandFarBot = wainsFarTop + Math.round(4 * Math.min(1.6, scale));

  for (let s = 0; s < stripeSegments; s++) {
    const t0 = s / stripeSegments;
    const t1 = (s + 1) / stripeSegments;
    const lyTop0 = Math.round(bandNearTop + (bandFarTop - bandNearTop) * t0);
    const lyTop1 = Math.round(bandNearTop + (bandFarTop - bandNearTop) * t1);
    const lyBot0 = Math.round(bandNearBot + (bandFarBot - bandNearBot) * t0);
    const lyBot1 = Math.round(bandNearBot + (bandFarBot - bandNearBot) * t1);
    const lyMid0 = Math.round((lyTop0 + lyBot0) / 2);
    const lyMid1 = Math.round((lyTop1 + lyBot1) / 2);
    const checkerParity = (s + rowParityShift + 100) % 2 === 0;

    // Right wall stripe (full length)
    const rx0 = Math.round(nearRightEdge + (farRight - nearRightEdge) * t0);
    const rx1 = Math.round(nearRightEdge + (farRight - nearRightEdge) * t1);
    ctx.fillStyle = checkerParity ? '#dc2626' : '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(rx0, lyTop0);
    ctx.lineTo(rx1, lyTop1);
    ctx.lineTo(rx1, lyMid1);
    ctx.lineTo(rx0, lyMid0);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = checkerParity ? '#09090b' : '#dc2626';
    ctx.beginPath();
    ctx.moveTo(rx0, lyMid0);
    ctx.lineTo(rx1, lyMid1);
    ctx.lineTo(rx1, lyBot1);
    ctx.lineTo(rx0, lyBot0);
    ctx.closePath();
    ctx.fill();

    // Foreground left wall stripe (up to `cornerLeftX`)
    if (turnLeftProgress === 0 && 1 - t0 > openTurnWallT) {
      const lx0 = Math.round(nearLeftEdge + (farLeft - nearLeftEdge) * t0);
      const lx1 = Math.min(cornerLeftX, Math.round(nearLeftEdge + (farLeft - nearLeftEdge) * t1));
      if (lx1 > lx0) {
        ctx.fillStyle = checkerParity ? '#dc2626' : '#f8fafc';
        ctx.beginPath();
        ctx.moveTo(lx0, lyTop0);
        ctx.lineTo(lx1, lyTop1);
        ctx.lineTo(lx1, lyMid1);
        ctx.lineTo(lx0, lyMid0);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = checkerParity ? '#09090b' : '#dc2626';
        ctx.beginPath();
        ctx.moveTo(lx0, lyMid0);
        ctx.lineTo(lx1, lyMid1);
        ctx.lineTo(lx1, lyBot1);
        ctx.lineTo(lx0, lyBot0);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  // Right Wall Props scrolling past as Richard sprints out of the Office along CAM 2A:
  const plaqueProj = projectFirstPersonCorridorProp(0.55, leftCorridorProgress * 0.65, false);
  if (plaqueProj.visible) {
    const wt = plaqueProj.wallT;
    const px = Math.round(farRight + (nearRightEdge - farRight) * wt);
    const py = Math.round(
      farTop * (1 - wt) + (wainsFarTop + (wainsNearTop - wainsFarTop) * wt - farTop * (1 - wt)) * 0.38
    );
    const ps = Math.max(0.65, Math.min(1.6, plaqueProj.scale * 0.9));
    drawPixelRect(
      ctx,
      px - Math.round(32 * ps),
      py - Math.round(22 * ps),
      Math.round(56 * ps),
      Math.round(38 * ps),
      '#18181b'
    );
    drawPixelRect(
      ctx,
      px - Math.round(28 * ps),
      py - Math.round(18 * ps),
      Math.round(48 * ps),
      Math.round(30 * ps),
      '#27272a'
    );
    drawPixelRect(
      ctx,
      px - Math.round(22 * ps),
      py - Math.round(10 * ps),
      Math.round(36 * ps),
      Math.round(8 * ps),
      '#eab308'
    );
  }

  // 5. END-OF-CORRIDOR CORNER WALL (Ahead of Richard before turning 90° left)
  ctx.fillStyle = '#14101a';
  ctx.fillRect(farLeft, farTop, farW, farH);
  ctx.fillStyle = '#231309';
  ctx.fillRect(farLeft, wainsFarTop, farW, farBottom - wainsFarTop);

  for (let bx = farLeft; bx < farRight - 8; bx += 16) {
    drawPixelRect(ctx, bx, wainsFarTop - 12, 8, 6, '#dc2626');
    drawPixelRect(ctx, bx + 8, wainsFarTop - 12, 8, 6, '#f8fafc');
    drawPixelRect(ctx, bx, wainsFarTop - 6, 8, 6, '#09090b');
    drawPixelRect(ctx, bx + 8, wainsFarTop - 6, 8, 6, '#dc2626');
  }

  // Far corner pillar framing the left turn on the end wall
  drawPixelRect(ctx, farLeft - 8, farTop, 14, farH, '#27272a');
  drawPixelRect(ctx, farLeft - 3, farTop, 4, farH, '#71717a');

  // Illuminated Green & White "[ ◄ EXIT / SALIDA ]" Directional Sign on the corner wall pointing LEFT!
  const signW = Math.round(118 * scale);
  const signH = Math.round(38 * scale);
  const signX = Math.round(farLeft + (farW - signW) * 0.46);
  const signY = Math.round(farTop + farH * 0.24);
  drawPixelRect(ctx, signX - 4, signY - 4, signW + 8, signH + 8, '#18181b');
  drawPixelRect(ctx, signX, signY, signW, signH, '#065f46');
  drawPixelRect(ctx, signX + 3, signY + 3, signW - 6, signH - 6, '#10b981');

  // Bold white left-pointing arrow "◄" + "EXIT" on the directional sign
  const arrowCx = Math.round(signX + signW * 0.22);
  const arrowCy = Math.round(signY + signH * 0.5);
  const arrowSize = Math.max(4, Math.round(9 * scale));
  drawPixelRect(ctx, arrowCx, arrowCy - Math.round(2 * scale), Math.round(16 * scale), Math.round(4 * scale), '#ecfdf5');
  drawPixelRect(ctx, arrowCx - Math.round(4 * scale), arrowCy - Math.round(5 * scale), Math.round(6 * scale), Math.round(10 * scale), '#ecfdf5');
  drawPixelRect(ctx, arrowCx - arrowSize, arrowCy - Math.round(2 * scale), Math.round(6 * scale), Math.round(4 * scale), '#ecfdf5');

  ctx.save();
  ctx.fillStyle = '#ecfdf5';
  ctx.font = `bold ${Math.max(10, Math.round(14 * scale))}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('EXIT', Math.round(signX + signW * 0.64), arrowCy);
  ctx.restore();

  // Subtle dark depth vignette on the corner wall
  const vignette = ctx.createRadialGradient(cx, cy, Math.round(60 * scale), cx, cy, Math.round(480));
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.58)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);

  ctx.restore();
}

// ============================================================================
// SCENE 1: 8-BIT FIRST-PERSON OFFICE SCENE (Coherent with Night 4 Backroom & Office)
// ============================================================================
function drawFirstPerson8BitOfficeScene(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  timeSec: number
) {
  ctx.fillStyle = '#020306';
  ctx.fillRect(0, 0, W, H);

  const roomLeft = 20;
  const roomRight = 940;
  const roomW = roomRight - roomLeft;

  // Back wall & vertical paneling matching EightBitPostNight4Minigame
  drawPixelRect(ctx, roomLeft, 16, roomW, 384, '#090b14');
  for (let wx = roomLeft + 32; wx < roomRight - 24; wx += 64) {
    drawPixelRect(ctx, wx, 24, 4, 240, '#0d101d');
  }

  // Lower wood wainscoting & red/white/black checkered pizzeria band
  drawPixelRect(ctx, roomLeft, 284, roomW, 116, '#180d09');
  for (let cx = roomLeft; cx < roomRight; cx += 32) {
    drawPixelRect(ctx, cx, 268, 16, 12, '#dc2626');
    drawPixelRect(ctx, cx + 16, 268, 16, 12, '#f8fafc');
    drawPixelRect(ctx, cx + 8, 260, 16, 8, '#09090b');
  }

  // Checkered office floor
  drawPixelRect(ctx, roomLeft, 400, roomW, H - 400, '#0c0e17');
  for (let fx = roomLeft; fx < roomRight; fx += 48) {
    drawPixelRect(ctx, fx, 400, 24, H - 400, '#181b28');
  }

  // Left & Right Office Doorways & Control Buttons
  drawPixelRect(ctx, 56, 68, 136, 332, '#27272a');
  drawPixelRect(ctx, 64, 76, 120, 324, '#030306');
  drawPixelRect(ctx, 204, 188, 24, 56, '#18181b');
  drawPixelRect(ctx, 208, 194, 16, 18, '#dc2626');
  drawPixelRect(ctx, 208, 220, 16, 18, '#e4e4e7');

  drawPixelRect(ctx, W - 192, 68, 136, 332, '#27272a');
  drawPixelRect(ctx, W - 184, 76, 120, 324, '#030306');
  drawPixelRect(ctx, W - 228, 188, 24, 56, '#18181b');
  drawPixelRect(ctx, W - 224, 194, 16, 18, '#dc2626');
  drawPixelRect(ctx, W - 224, 220, 16, 18, '#e4e4e7');

  // Center Celebrate Poster on front office wall
  drawPixelRect(ctx, 392, 64, 176, 124, '#eab308');
  drawPixelRect(ctx, 396, 68, 168, 116, '#0f172a');
  drawPixelRect(ctx, 424, 108, 28, 60, '#2563eb');
  drawPixelRect(ctx, 466, 96, 28, 72, '#78350f');
  drawPixelRect(ctx, 508, 108, 28, 60, '#eab308');
  drawPixelRect(ctx, 428, 78, 104, 14, '#dc2626');

  // Office Desk, CRT Monitors & Spinning Fan
  drawPixelRect(ctx, 268, 324, 424, 20, '#5c2d10');
  drawPixelRect(ctx, 284, 344, 392, 96, '#3f220f');

  drawPixelRect(ctx, 300, 256, 84, 68, '#27272a');
  drawPixelRect(ctx, 308, 264, 68, 52, '#052e16');
  drawPixelRect(ctx, 576, 256, 84, 68, '#27272a');
  drawPixelRect(ctx, 584, 264, 68, 52, '#052e16');

  // Oscillating Desk Fan
  drawPixelRect(ctx, 468, 296, 24, 28, '#27272a');
  drawPixelRect(ctx, 452, 316, 56, 8, '#3f3f46');
  drawPixelRect(ctx, 452, 240, 56, 56, '#18181b');
  const bladeFrame = Math.floor(timeSec * 20) % 2;
  if (bladeFrame === 0) {
    drawPixelRect(ctx, 476, 248, 8, 40, '#a1a1aa');
    drawPixelRect(ctx, 460, 264, 40, 8, '#a1a1aa');
  } else {
    drawPixelRect(ctx, 464, 252, 32, 8, '#a1a1aa');
    drawPixelRect(ctx, 464, 276, 32, 8, '#a1a1aa');
  }

  // Overhead office lamp & dim cone
  drawPixelRect(ctx, W / 2 - 4, 0, 8, 24, '#27272a');
  drawPixelRect(ctx, W / 2 - 28, 24, 56, 12, '#3f3f46');
  drawPixelRect(ctx, W / 2 - 16, 36, 32, 8, '#fef08a');

  ctx.save();
  const spotGrad = ctx.createRadialGradient(W / 2, 48, 24, W / 2, 260, 460);
  spotGrad.addColorStop(0, 'rgba(254, 249, 195, 0.22)');
  spotGrad.addColorStop(0.5, 'rgba(253, 224, 71, 0.08)');
  spotGrad.addColorStop(1, 'rgba(0, 0, 0, 0.72)');
  ctx.fillStyle = spotGrad;
  ctx.fillRect(roomLeft, 16, roomW, H - 16);
  ctx.restore();
}

// ============================================================================
// SCENE 2 & FLEE CUTS: EXACT REUSED 1ST-PERSON PIZZERIA CORRIDOR FROM INTERLUDE 3->4
// (`drawFirstPersonPizzeriaCorridorScene` in EightBitPostNight3Minigame.tsx)
// Adapted for:
// - `CAM_05_HALF_OPEN`: Standing right in front of the half-open CAM 05 door, looking left, waiting 1s, looking right, and opening the door!
// - `EXIT_DOOR`: Running toward the local's EXIT door between fade-to-black blinks while The Thing screams!
// ============================================================================
interface CorridorDoorSceneOptions {
  doorMode: 'CAM_05_HALF_OPEN' | 'EXIT_DOOR';
  fpProgress: number;
  approachProgress?: number; // 0 = close to CAM 05 door, 1 = stepping right into the open doorway
  cameraYaw: number; // -1 = looking deep left, 0 = centered on door, +1 = looking deep right
  doorOpenProgress: number; // 0 = half-open (for CAM 05) or closed (for EXIT), 1 = pushed wide open
  grabbedFromBehind: boolean;
  holdingMoneyInFirstPerson?: boolean;
  isRunning?: boolean;
  runBobPhase?: number;
  extraBobX?: number;
  extraBobY?: number;
  timeSec: number;
}

function drawFirstPersonPizzeriaCorridorDoorScene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  opts: CorridorDoorSceneOptions
) {
  const {
    doorMode,
    fpProgress,
    approachProgress = 0,
    cameraYaw,
    doorOpenProgress,
    grabbedFromBehind,
    holdingMoneyInFirstPerson,
    isRunning = true,
    runBobPhase,
    extraBobX = 0,
    extraBobY = 0,
    timeSec,
  } = opts;

  // Much wider horizontal head turn when looking left (-1) and right (+1) ("mirar mas a la derecha y mas a la izquierda")
  const yawShiftX = Math.round(-cameraYaw * 465);
  const cx = Math.round(w / 2 + yawShiftX + extraBobX);
  const activeBobPhase = runBobPhase ?? timeSec;
  const bobY =
    extraBobY !== 0 || isRunning === false
      ? extraBobY
      : doorMode === 'EXIT_DOOR'
      ? Math.round(Math.sin(activeBobPhase * 16) * 5)
      : doorOpenProgress > 0
      ? Math.round(Math.sin(doorOpenProgress * Math.PI) * 5)
      : Math.round(Math.sin(approachProgress * Math.PI * 2) * 3);
  const cy = Math.round(h * 0.46 + bobY);

  ctx.fillStyle = '#040407';
  ctx.fillRect(0, 0, w, h);

  // Richard stands much closer to the CAM 05 door and steps right up to the doorway threshold as he opens it!
  const scale =
    doorMode === 'CAM_05_HALF_OPEN'
      ? 1.92 + approachProgress * 0.46
      : 0.65 + fpProgress * 0.95;
  const farW = Math.round(176 * scale);
  const farH = Math.round(236 * scale);
  const farLeft = Math.round(cx - farW / 2);
  const farRight = Math.round(cx + farW / 2);
  const farTop = Math.round(cy - farH * 0.48);
  const farBottom = Math.round(cy + farH * 0.52);

  // Extended left/right corridor bounds so wide head turns (-465..+465) never clip or invert polygons
  const nearLeftEdge = Math.min(-420, farLeft - 360);
  const nearRightEdge = Math.max(w + 420, farRight + 360);

  // 1. CEILING (Dark weathered rafters & hanging lamps from EightBitPostNight3Minigame)
  ctx.fillStyle = '#0a0910';
  ctx.beginPath();
  ctx.moveTo(nearLeftEdge, 0);
  ctx.lineTo(nearRightEdge, 0);
  ctx.lineTo(farRight, farTop);
  ctx.lineTo(farLeft, farTop);
  ctx.closePath();
  ctx.fill();

  const ceilingWorldZList = [0.26, 0.52, 0.78, 1.04, 1.26];
  for (let i = 0; i < ceilingWorldZList.length; i++) {
    const zW = ceilingWorldZList[i];
    const proj = projectFirstPersonCorridorProp(zW, fpProgress, false);
    if (!proj.visible) continue;
    const t = proj.wallT;
    const ry = Math.round(farTop * (1 - t));
    const lx = Math.round(farLeft + (nearLeftEdge - farLeft) * t);
    const rx = Math.round(farRight + (nearRightEdge - farRight) * t);
    const beamH = Math.max(4, Math.round(6 * proj.scale));
    ctx.fillStyle = '#16120e';
    ctx.fillRect(lx, ry, rx - lx, beamH);

    if (i % 2 === 0 && ry > 0) {
      const lampS = Math.max(0.65, Math.min(1.85, proj.scale * 0.95));
      const wireH = Math.round(18 * lampS);
      const capW = Math.round(24 * lampS);
      const capH = Math.round(6 * lampS);
      const bulbW = Math.round(16 * lampS);
      const bulbH = Math.round(4 * lampS);
      drawPixelRect(ctx, cx - 2, ry, 4, wireH, '#27272a');
      drawPixelRect(ctx, cx - capW / 2, ry + wireH - 2, capW, capH, '#3f3f46');
      drawPixelRect(ctx, cx - bulbW / 2, ry + wireH + capH - 2, bulbW, bulbH, '#713f12');
    }
  }

  // 2. PERSPECTIVE BLACK & WHITE CHECKERED PIZZERIA FLOOR (Exact from EightBitPostNight3Minigame)
  const floorRows = 10;
  const worldFloorShift = (fpProgress + approachProgress * 0.18) * 7.5;
  const fracShift = worldFloorShift - Math.floor(worldFloorShift);
  const rowParityShift = Math.floor(worldFloorShift);

  for (let r = 0; r < floorRows; r++) {
    const t0 = Math.max(0, (r + fracShift * 0.85) / floorRows);
    const t1 = Math.min(1, (r + 1 + fracShift * 0.85) / floorRows);
    const p0 = Math.pow(t0, 1.48);
    const p1 = Math.pow(t1, 1.48);

    const y0 = Math.round(farBottom + (h - farBottom) * p0);
    const y1 = Math.round(farBottom + (h - farBottom) * p1);
    const left0 = Math.round(farLeft + (nearLeftEdge - farLeft) * p0);
    const right0 = Math.round(farRight + (nearRightEdge - farRight) * p0);
    const left1 = Math.round(farLeft + (nearLeftEdge - farLeft) * p1);
    const right1 = Math.round(farRight + (nearRightEdge - farRight) * p1);

    const cols = 12;
    for (let c = 0; c < cols; c++) {
      const c0 = c / cols;
      const c1 = (c + 1) / cols;
      const x00 = Math.round(left0 + (right0 - left0) * c0);
      const x01 = Math.round(left0 + (right0 - left0) * c1);
      const x10 = Math.round(left1 + (right1 - left1) * c0);
      const x11 = Math.round(left1 + (right1 - left1) * c1);

      const tileParity = (r - rowParityShift + c + 100) % 2 === 0;
      ctx.fillStyle = tileParity ? '#0e0e13' : '#b8c4d4';
      ctx.beginPath();
      ctx.moveTo(x00, y0);
      ctx.lineTo(x01, y0);
      ctx.lineTo(x11, y1);
      ctx.lineTo(x10, y1);
      ctx.closePath();
      ctx.fill();
    }
  }

  // 3. LEFT & RIGHT PERSPECTIVE PIZZERIA WALLS (Exact from EightBitPostNight3Minigame, extended for wide look)
  ctx.fillStyle = '#1d1922';
  ctx.beginPath();
  ctx.moveTo(nearLeftEdge, 0);
  ctx.lineTo(farLeft, farTop);
  ctx.lineTo(farLeft, farBottom);
  ctx.lineTo(nearLeftEdge, h);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#1d1922';
  ctx.beginPath();
  ctx.moveTo(nearRightEdge, 0);
  ctx.lineTo(farRight, farTop);
  ctx.lineTo(farRight, farBottom);
  ctx.lineTo(nearRightEdge, h);
  ctx.closePath();
  ctx.fill();

  const wainsNearTop = Math.round(h * 0.62 + bobY);
  const wainsFarTop = Math.round(farTop + (farBottom - farTop) * 0.62);

  ctx.fillStyle = '#231309';
  ctx.beginPath();
  ctx.moveTo(nearLeftEdge, wainsNearTop);
  ctx.lineTo(farLeft, wainsFarTop);
  ctx.lineTo(farLeft, farBottom);
  ctx.lineTo(nearLeftEdge, h);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(nearRightEdge, wainsNearTop);
  ctx.lineTo(farRight, wainsFarTop);
  ctx.lineTo(farRight, farBottom);
  ctx.lineTo(nearRightEdge, h);
  ctx.closePath();
  ctx.fill();

  // Iconic Pizzeria Red & White/Black Checkered Wall Stripe Band along both walls
  const stripeSegments = 16;
  const bandNearTop = wainsNearTop - 38;
  const bandNearBot = wainsNearTop + 6;
  const bandFarTop = wainsFarTop - Math.round(14 * Math.min(1.6, scale));
  const bandFarBot = wainsFarTop + Math.round(4 * Math.min(1.6, scale));

  for (let s = 0; s < stripeSegments; s++) {
    const t0 = s / stripeSegments;
    const t1 = (s + 1) / stripeSegments;

    const lx0 = Math.round(nearLeftEdge + (farLeft - nearLeftEdge) * t0);
    const lx1 = Math.round(nearLeftEdge + (farLeft - nearLeftEdge) * t1);
    const lyTop0 = Math.round(bandNearTop + (bandFarTop - bandNearTop) * t0);
    const lyTop1 = Math.round(bandNearTop + (bandFarTop - bandNearTop) * t1);
    const lyBot0 = Math.round(bandNearBot + (bandFarBot - bandNearBot) * t0);
    const lyBot1 = Math.round(bandNearBot + (bandFarBot - bandNearBot) * t1);
    const lyMid0 = Math.round((lyTop0 + lyBot0) / 2);
    const lyMid1 = Math.round((lyTop1 + lyBot1) / 2);

    const checkerParity = (s + rowParityShift + 100) % 2 === 0;
    ctx.fillStyle = checkerParity ? '#dc2626' : '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(lx0, lyTop0);
    ctx.lineTo(lx1, lyTop1);
    ctx.lineTo(lx1, lyMid1);
    ctx.lineTo(lx0, lyMid0);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = checkerParity ? '#09090b' : '#dc2626';
    ctx.beginPath();
    ctx.moveTo(lx0, lyMid0);
    ctx.lineTo(lx1, lyMid1);
    ctx.lineTo(lx1, lyBot1);
    ctx.lineTo(lx0, lyBot0);
    ctx.closePath();
    ctx.fill();

    const rx0 = Math.round(nearRightEdge + (farRight - nearRightEdge) * t0);
    const rx1 = Math.round(nearRightEdge + (farRight - nearRightEdge) * t1);
    ctx.fillStyle = checkerParity ? '#dc2626' : '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(rx0, lyTop0);
    ctx.lineTo(rx1, lyTop1);
    ctx.lineTo(rx1, lyMid1);
    ctx.lineTo(rx0, lyMid0);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = checkerParity ? '#09090b' : '#dc2626';
    ctx.beginPath();
    ctx.moveTo(rx0, lyMid0);
    ctx.lineTo(rx1, lyMid1);
    ctx.lineTo(rx1, lyBot1);
    ctx.lineTo(rx0, lyBot0);
    ctx.closePath();
    ctx.fill();
  }

  // 4. COHERENT 3D PERSPECTIVE WALL PROPS (Visible when looking deep left & deep right!)
  const getWallAnchor = (side: 'left' | 'right', wallT: number, heightFrac = 0.36) => {
    const x =
      side === 'left'
        ? Math.round(farLeft + (nearLeftEdge - farLeft) * wallT)
        : Math.round(farRight + (nearRightEdge - farRight) * wallT);
    const wallTopAtX = Math.round(farTop * (1 - wallT));
    const wainsTopAtX = Math.round(wainsFarTop + (wainsNearTop - wainsFarTop) * wallT);
    const y = Math.round(wallTopAtX + (wainsTopAtX - wallTopAtX) * heightFrac);
    return { x, y };
  };

  // Left Wall Props: Industrial Fuse Box + Vertical Conduit Pipes + Wall Vent Grille (visible when looking left!)
  {
    const posFuse = getWallAnchor('left', 0.28, 0.42);
    drawPixelRect(ctx, posFuse.x - 24, posFuse.y - 68, 8, 68, '#27272a');
    drawPixelRect(ctx, posFuse.x - 36, posFuse.y - 32, 56, 72, '#18181b');
    drawPixelRect(ctx, posFuse.x - 32, posFuse.y - 28, 48, 64, '#3f3f46');
    drawPixelRect(ctx, posFuse.x - 20, posFuse.y - 16, 24, 16, '#eab308');
    drawPixelRect(ctx, posFuse.x - 16, posFuse.y + 12, 12, 12, '#dc2626');

    const posPosterL = getWallAnchor('left', 0.56, 0.36);
    drawPixelRect(ctx, posPosterL.x - 44, posPosterL.y - 48, 76, 92, '#eab308');
    drawPixelRect(ctx, posPosterL.x - 40, posPosterL.y - 44, 68, 84, '#0f172a');
    drawPixelRect(ctx, posPosterL.x - 20, posPosterL.y - 20, 28, 48, '#78350f');
    drawPixelRect(ctx, posPosterL.x - 28, posPosterL.y - 36, 44, 10, '#dc2626');
  }

  // Right Wall Props: Torn Safety Notice + Pizzeria Wall Clock + Pipe Valve (visible when looking right!)
  {
    const posNotice = getWallAnchor('right', 0.28, 0.40);
    drawPixelRect(ctx, posNotice.x - 24, posNotice.y - 32, 52, 64, '#451a03');
    drawPixelRect(ctx, posNotice.x - 20, posNotice.y - 28, 44, 56, '#d6d3d1');
    drawPixelRect(ctx, posNotice.x - 14, posNotice.y - 20, 32, 10, '#991b1b');
    drawPixelRect(ctx, posNotice.x - 14, posNotice.y - 4, 28, 6, '#27272a');
    drawPixelRect(ctx, posNotice.x - 14, posNotice.y + 8, 24, 6, '#27272a');

    const posClockR = getWallAnchor('right', 0.56, 0.34);
    drawPixelRect(ctx, posClockR.x - 36, posClockR.y - 36, 68, 68, '#b91c1c');
    drawPixelRect(ctx, posClockR.x - 28, posClockR.y - 28, 52, 52, '#f8fafc');
    drawPixelRect(ctx, posClockR.x - 4, posClockR.y - 20, 4, 20, '#09090b');
    drawPixelRect(ctx, posClockR.x - 4, posClockR.y - 4, 16, 4, '#09090b');
  }

  // 5. END OF CORRIDOR WALL & DOOR (CAM 05 HALF-OPEN DOOR OR EXIT DOOR — MUCH CLOSER TO RICHARD!)
  ctx.fillStyle = '#14101a';
  ctx.fillRect(farLeft, farTop, farW, farH);
  for (let bx = farLeft; bx < farRight - 8; bx += 16) {
    drawPixelRect(
      ctx,
      bx,
      wainsFarTop - 12,
      8,
      8,
      Math.floor((bx - farLeft) / 16) % 2 === 0 ? '#dc2626' : '#f8fafc'
    );
    drawPixelRect(
      ctx,
      bx + 8,
      wainsFarTop - 12,
      8,
      8,
      Math.floor((bx - farLeft) / 16) % 2 === 0 ? '#f8fafc' : '#dc2626'
    );
  }

  const doorW = Math.round(farW * 0.66);
  const doorH = Math.round(farH * 0.84);
  const doorX = Math.round(cx - doorW / 2);
  const doorY = farBottom - doorH;

  // Overhead Sign ("ALMACEN" for the storage closet, or "EXIT" for the exit door)
  const signW = Math.max(68, Math.round(doorW * 0.58));
  const signH = Math.max(16, Math.round(doorH * 0.085));
  const signY = Math.max(8, doorY - signH - 14);
  drawPixelRect(ctx, cx - signW / 2 - 2, signY - 2, signW + 4, signH + 4, '#27272a');
  drawPixelRect(
    ctx,
    cx - signW / 2,
    signY,
    signW,
    signH,
    doorMode === 'CAM_05_HALF_OPEN' ? '#18181b' : '#991b1b'
  );
  ctx.fillStyle = doorMode === 'CAM_05_HALF_OPEN' ? '#fde047' : '#fecaca';
  ctx.font = `bold ${Math.max(10, Math.round(signH * 0.72))}px "IBM Plex Mono", monospace`;
  ctx.textAlign = 'center';
  ctx.fillText(doorMode === 'CAM_05_HALF_OPEN' ? 'ALMACEN' : 'EXIT', cx, signY + signH - 4);

  // Heavy wooden doorframe & dark storage interior behind the door
  drawPixelRect(ctx, doorX - 12, doorY - 10, doorW + 24, doorH + 10, '#3f220f');
  drawPixelRect(ctx, doorX - 4, doorY - 4, doorW + 8, doorH + 4, '#271509');
  drawPixelRect(ctx, doorX, doorY, doorW, doorH, '#030306');

  let doorknobX = doorX + Math.round(doorW * 0.5);
  let doorknobY = doorY + Math.round(doorH * 0.52);

  if (doorMode === 'CAM_05_HALF_OPEN') {
    // Glimpse of the metal locker inside ALMACEN through the slightly ajar gap on the right side
    const lockerW = Math.round(doorW * 0.34);
    const lockerH = Math.round(doorH * 0.74);
    const lockerX = doorX + doorW - lockerW - 8;
    const lockerY = doorY + doorH - lockerH;
    drawPixelRect(ctx, lockerX, lockerY, lockerW, lockerH, '#1e293b');
    drawPixelRect(ctx, lockerX + 4, lockerY + 4, lockerW - 8, lockerH - 8, '#0f172a');
    // Green bundle of money glinting inside the locker
    drawPixelRect(ctx, lockerX + 8, lockerY + Math.round(lockerH * 0.45), 24, 14, '#15803d');
    drawPixelRect(ctx, lockerX + 16, lockerY + Math.round(lockerH * 0.45), 6, 14, '#fde047');

    // Half-open wooden door leaf (slightly more closed initially at 70% width, swings open as doorOpenProgress -> 1)
    const leafRatio = 0.70 * (1 - doorOpenProgress * 0.68);
    const leafW = Math.max(28, Math.round(doorW * leafRatio));
    drawPixelRect(ctx, doorX, doorY, leafW, doorH, '#5c2d10');
    // Wood grain & recessed panels
    drawPixelRect(
      ctx,
      doorX + Math.round(leafW * 0.14),
      doorY + Math.round(doorH * 0.07),
      Math.max(8, Math.round(leafW * 0.72)),
      Math.round(doorH * 0.38),
      '#451a03'
    );
    drawPixelRect(
      ctx,
      doorX + Math.round(leafW * 0.14),
      doorY + Math.round(doorH * 0.52),
      Math.max(8, Math.round(leafW * 0.72)),
      Math.round(doorH * 0.38),
      '#451a03'
    );
    // Door thickness edge & brass lock plate + doorknob
    drawPixelRect(ctx, doorX + leafW - 6, doorY, 6, doorH, '#3b1a06');
    doorknobX = doorX + leafW - 18;
    doorknobY = doorY + Math.round(doorH * 0.50);
    drawPixelRect(ctx, doorknobX - 2, doorknobY - 12, 16, 36, '#713f12');
    drawPixelRect(ctx, doorknobX, doorknobY, 14, 14, '#fde047');
    drawPixelRect(ctx, doorknobX + 4, doorknobY + 4, 6, 6, '#fef9c3');
  } else {
    // EXIT DOOR (closed while running in cuts 2 & 3, swings open in cut 4)
    const leafRatio = 1 - doorOpenProgress * 0.72;
    const leafW = Math.max(24, Math.round(doorW * leafRatio));
    drawPixelRect(ctx, doorX, doorY, leafW, doorH, '#5c2d10');
    drawPixelRect(
      ctx,
      doorX + Math.round(leafW * 0.12),
      doorY + Math.round(doorH * 0.08),
      Math.max(8, Math.round(leafW * 0.76)),
      Math.round(doorH * 0.36),
      '#451a03'
    );
    drawPixelRect(
      ctx,
      doorX + Math.round(leafW * 0.12),
      doorY + Math.round(doorH * 0.52),
      Math.max(8, Math.round(leafW * 0.76)),
      Math.round(doorH * 0.38),
      '#451a03'
    );
    drawPixelRect(ctx, doorX + leafW - 16, doorY + Math.round(doorH * 0.48), 10, 10, '#fde047');
  }

  // 6. EXACT FLASHLIGHT BEAM VIGNETTE FROM EightBitPostNight3Minigame
  ctx.fillStyle = 'rgba(0, 0, 0, 0.24)';
  ctx.fillRect(0, 0, w, h);

  const flashCenterX = w / 2 + Math.round(yawShiftX * 0.22);
  const flashGrad = ctx.createRadialGradient(flashCenterX, cy, 44, flashCenterX, cy, 360);
  flashGrad.addColorStop(0, 'rgba(254, 240, 138, 0.10)');
  flashGrad.addColorStop(0.42, 'rgba(10, 8, 6, 0.52)');
  flashGrad.addColorStop(0.72, 'rgba(2, 2, 4, 0.88)');
  flashGrad.addColorStop(0.92, 'rgba(0, 0, 0, 0.98)');
  flashGrad.addColorStop(1, 'rgba(0, 0, 0, 0.998)');
  ctx.fillStyle = flashGrad;
  ctx.fillRect(0, 0, w, h);

  // 7. SUPER-DETAILED 8-BIT FIRST-PERSON HAND OPENING THE CAM 05 DOOR
  if (doorMode === 'CAM_05_HALF_OPEN' && doorOpenProgress > 0.01 && !grabbedFromBehind) {
    drawDetailedFirstPersonDoorHand(
      ctx,
      w,
      h,
      doorknobX,
      doorknobY,
      doorOpenProgress
    );
  }

  // First-person detailed hand clutching the money bundle while fleeing toward the EXIT door
  if (holdingMoneyInFirstPerson) {
    const handBobY = Math.round(Math.abs(Math.cos(timeSec * 18)) * 14);
    drawPixelRect(ctx, 660, 412 + handBobY, 72, 140, '#1e3a8a');
    drawPixelRect(ctx, 664, 396 + handBobY, 64, 16, '#93c5fd');
    drawPixelRect(ctx, 652, 360 + handBobY, 80, 40, '#fcd34d');
    drawPixelRect(ctx, 636, 324 + handBobY, 108, 44, '#15803d');
    drawPixelRect(ctx, 644, 332 + handBobY, 92, 28, '#22c55e');
    drawPixelRect(ctx, 680, 324 + handBobY, 20, 44, '#fde047');
    // Fingers wrapped around the money bundle
    for (let f = 0; f < 4; f++) {
      drawPixelRect(ctx, 648 + f * 18, 348 + handBobY, 14, 16, '#f59e0b');
      drawPixelRect(ctx, 650 + f * 18, 350 + handBobY, 10, 10, '#fde68a');
    }
  }

  // Exact Screen-Grabbing Claws from EightBitPostNight3Minigame when The Thing grabs Richard from behind!
  if (grabbedFromBehind) {
    drawScreenGrabbingClawsFromInterlude3(ctx, w, h, 1, timeSec, 0, 0);
  }
}

/**
 * Clean 8-bit first-person hand & forearm reaching up to grip the CAM 05 door handle
 * and push the wooden door inward (slightly simplified 8-bit detail as requested).
 */
function drawDetailedFirstPersonDoorHand(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  targetKnobX: number,
  targetKnobY: number,
  doorOpenProgress: number
) {
  const reachP = Math.min(1, doorOpenProgress / 0.35);
  const pushP = Math.max(0, (doorOpenProgress - 0.35) / 0.65);
  const smoothReach = reachP * reachP * (3 - 2 * reachP);

  const startHandX = Math.round(w * 0.42);
  const startHandY = h + 40;
  const handX = Math.round(startHandX + (targetKnobX - startHandX) * smoothReach);
  const handY = Math.round(
    startHandY + (targetKnobY + 8 - startHandY) * smoothReach - Math.sin(pushP * Math.PI) * 14
  );

  ctx.save();

  // 1. Clean 8-Bit Navy Guard Jacket Sleeve & Simple Light-Blue Cuff Trim
  const elbowX = handX - 24;
  const wristY = handY + 32;
  const sleeveH = Math.max(80, h - wristY + 40);

  drawPixelRect(ctx, elbowX - 4, wristY + 12, 68, sleeveH, '#172554');
  drawPixelRect(ctx, elbowX, wristY + 12, 60, sleeveH, '#1e3a8a');
  drawPixelRect(ctx, handX - 24, wristY, 60, 12, '#93c5fd');

  // 2. Clean 8-Bit Hand (Palm + Thumb + 4 Simple Blocky Fingers)
  drawPixelRect(ctx, handX - 24, handY, 60, 32, '#f59e0b');
  drawPixelRect(ctx, handX - 20, handY + 4, 52, 24, '#fcd34d');

  // Thumb on the right
  drawPixelRect(ctx, handX + 32, handY - 8, 18, 14, '#f59e0b');
  drawPixelRect(ctx, handX + 32, handY - 12, 16, 12, '#fcd34d');

  // 4 Simple 8-Bit Fingers gripping the handle
  const fingerWidths = [12, 12, 12, 12];
  const fingerHeights = [24, 28, 24, 20];
  const fingerOffsetsX = [-22, -6, 10, 24];

  for (let i = 0; i < 4; i++) {
    const fx = handX + fingerOffsetsX[i];
    const fw = fingerWidths[i];
    const fh = fingerHeights[i];
    const gripCurl = Math.round(pushP * 6);
    const fy = handY - fh + gripCurl;

    drawPixelRect(ctx, fx, fy, fw, fh, '#f59e0b');
    drawPixelRect(ctx, fx, fy + 4, fw - 2, fh - 4, '#fcd34d');
  }

  ctx.restore();
}

/**
 * Exact `drawScreenGrabbingClaw` reused from EightBitPostNight3Minigame.tsx (lines 2570-2627),
 * enhanced with `clawPushBackPx` so pressing [E] during the QTE visibly forces The Thing's claws outward!
 */
function drawScreenGrabbingClawsFromInterlude3(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  grabHandsProgress: number,
  timeSec: number,
  jx: number,
  clawPushBackPx = 0
) {
  const handInX = Math.round((1 - grabHandsProgress) * 140 + clawPushBackPx);
  const handGripY = Math.round(h * 0.52 + Math.sin(timeSec * 48) * 10);

  const drawSingleClaw = (side: -1 | 1) => {
    ctx.save();
    const baseX = side === -1 ? -24 - handInX + jx * 0.6 : w + 24 + handInX + jx * 0.6;
    ctx.translate(baseX, handGripY);
    drawPixelRect(ctx, side === -1 ? -40 : -56, -76, 96, 152, '#07070b');
    drawPixelRect(ctx, side === -1 ? -20 : -52, -56, 72, 112, '#9a3412');
    drawPixelRect(ctx, side === -1 ? 12 : -56, -42, 44, 84, '#52525b');

    const fingerOffsetsY = [-92, -34, 24, 82];
    const fingerLengths = [128, 148, 142, 116];
    for (let f = 0; f < 4; f++) {
      const fy = fingerOffsetsY[f];
      const flen = fingerLengths[f];
      const dir = side === -1 ? 1 : -1;
      drawPixelRect(
        ctx,
        dir === 1 ? 36 : -36 - Math.round(flen * 0.45),
        fy - 14,
        Math.round(flen * 0.45),
        28,
        '#3f3f46'
      );
      drawPixelRect(
        ctx,
        dir === 1 ? 36 + Math.round(flen * 0.42) : -36 - Math.round(flen * 0.82),
        fy - 10,
        Math.round(flen * 0.40),
        20,
        '#d4d4d8'
      );
      drawPixelRect(
        ctx,
        dir === 1 ? 36 + Math.round(flen * 0.78) : -36 - flen,
        fy - 6,
        Math.round(flen * 0.26),
        14,
        '#dc2626'
      );
    }
    ctx.restore();
  };

  drawSingleClaw(-1);
  drawSingleClaw(1);
}

/**
 * Clean 8-bit first-person hands & forearms for Richard resisting The Thing's grip
 * during the QTE (slightly simplified 8-bit detail as requested).
 */
function drawDetailedFirstPersonResistHands(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  qtePresses: number,
  shovePulse: number,
  timeSec: number
) {
  const strainJitterX = Math.round(Math.sin(timeSec * 75) * (3 + qtePresses * 2));
  const strainJitterY = Math.round(Math.cos(timeSec * 85) * (3 + qtePresses * 2));
  const shoveUpY = Math.round(shovePulse * 68 + qtePresses * 14);
  const shoveOutX = Math.round(shovePulse * 48 + qtePresses * 18);

  const drawSingleDetailedArmAndHand = (side: -1 | 1) => {
    ctx.save();
    const baseX =
      side === -1
        ? 196 - shoveOutX + strainJitterX
        : W - 196 + shoveOutX - strainJitterX;
    const baseY = 356 - shoveUpY + strainJitterY;
    ctx.translate(baseX, baseY);

    // 1. Clean 8-Bit Navy Guard Jacket Sleeve & Simple Cuff Trim
    const sleeveH = Math.max(180, H - baseY + 60);
    drawPixelRect(ctx, -38, 40, 76, sleeveH, '#172554');
    drawPixelRect(ctx, -32, 40, 64, sleeveH, '#1e3a8a');
    drawPixelRect(ctx, -32, 26, 64, 14, '#93c5fd');

    // 2. Clean 8-Bit Hand Gripping & Prying The Thing's Claw
    drawPixelRect(ctx, -36, -12, 72, 38, '#f59e0b');
    drawPixelRect(ctx, -32, -8, 64, 30, '#fcd34d');

    // Thumb pushing outward
    const thumbX = side === -1 ? 32 : -52;
    drawPixelRect(ctx, thumbX, -10, 20, 18, '#f59e0b');
    drawPixelRect(ctx, thumbX + 2, -8, 16, 14, '#fcd34d');

    // 4 Simple 8-Bit Fingers
    const fingerOffsetsX = [-32, -14, 4, 22];
    const fingerHeights = [28, 32, 28, 24];
    for (let f = 0; f < 4; f++) {
      const fx = fingerOffsetsX[f];
      const fh = fingerHeights[f] + Math.round(shovePulse * 8);
      const fy = -12 - fh;

      drawPixelRect(ctx, fx, fy, 12, fh, '#f59e0b');
      drawPixelRect(ctx, fx, fy + 4, 10, fh - 4, '#fcd34d');
    }

    // Impact sparks when pressing [E] (1st & 2nd presses!)
    if (shovePulse > 0.05) {
      const sparkSpread = Math.round((1 - shovePulse) * 40);
      drawPixelRect(ctx, -44 - sparkSpread, -40 - sparkSpread, 14, 4, '#fef08a');
      drawPixelRect(ctx, 32 + sparkSpread, -44 - sparkSpread, 14, 4, '#ffffff');
    }

    ctx.restore();
  };

  drawSingleDetailedArmAndHand(-1);
  drawSingleDetailedArmAndHand(1);
}

// ============================================================================
// CANONICAL THE THING FINAL FORM SPRITE (100% REUSED FROM INTERLUDE 4->5)
// Shared by Ending 1 Close-Up/QTE/Jumpscare AND Ending 2 (No-Documents) Crouching Death Scene!
// ============================================================================
function drawCanonicalTheThingAmalgamSprite(
  ctx: CanvasRenderingContext2D,
  timeSec: number,
  extraMaskSplit: number,
  extraJawOpen: number,
  options?: {
    crouched?: boolean;
    bloodiedRightClaw?: boolean;
  }
) {
  const isCrouched = Boolean(options?.crouched);
  const ffX = 0;
  const ffY = isCrouched ? -168 : -188;
  const bonnetX = -192;
  const bonnetY = isCrouched ? -88 : -104;
  const bbX = 192;
  const bbY = isCrouched ? -84 : -100;
  const maskSplit = extraMaskSplit;
  const screamJaw = extraJawOpen + Math.round(Math.abs(Math.sin(timeSec * 18)) * 12);
  const wireShift = Math.round(Math.sin(timeSec * 15) * 4);

  // 1. Foxy's Withered Red Thigh Casings & Shins (bent outward when crouched low over Richard on the floor)
  if (isCrouched) {
    drawPixelRect(ctx, -168, 48, 72, 64, '#991b1b');
    drawPixelRect(ctx, -160, 56, 56, 48, '#7f1d1d');
    drawPixelRect(ctx, 96, 48, 72, 64, '#991b1b');
    drawPixelRect(ctx, 104, 56, 56, 48, '#7f1d1d');
    drawPixelRect(ctx, -156, 108, 44, 16, '#52525b');
    drawPixelRect(ctx, 112, 108, 44, 16, '#52525b');
    drawPixelRect(ctx, -148, 124, 32, 44, '#d4d4d8');
    drawPixelRect(ctx, 116, 124, 32, 44, '#d4d4d8');
  } else {
    drawPixelRect(ctx, -100, 96, 60, 68, '#991b1b');
    drawPixelRect(ctx, -92, 104, 44, 52, '#7f1d1d');
    drawPixelRect(ctx, 40, 96, 60, 68, '#991b1b');
    drawPixelRect(ctx, 48, 104, 44, 52, '#7f1d1d');
    drawPixelRect(ctx, -88, 160, 36, 12, '#52525b');
    drawPixelRect(ctx, 52, 160, 36, 12, '#52525b');
    drawPixelRect(ctx, -80, 172, 24, 60, '#d4d4d8');
    drawPixelRect(ctx, 56, 172, 24, 60, '#d4d4d8');
  }

  // 2. Massive Amalgam Torso of Writhing Wires, Steel Ribs & Glowing Furnace Core
  drawPixelRect(ctx, -132, -60, 264, 168, '#18181b');
  drawPixelRect(ctx, -116, -76, 232, 188, '#27272a');
  drawPixelRect(ctx, -12, -68, 24, 172, '#52525b');
  drawPixelRect(ctx, -28, -20, 56, 48, '#7f1d1d');
  drawPixelRect(ctx, -16, -8, 32, 24, '#ef4444');
  drawPixelRect(ctx, -8, -4, 16, 12, '#fecaca');

  for (let i = -4; i <= 4; i++) {
    const waveY = Math.round(Math.sin(timeSec * 6 + i * 1.1) * 8);
    const wireY = i * 18 + waveY;
    const wireCol = i % 3 === 0 ? '#52525b' : i % 3 === 1 ? '#ef4444' : '#38bdf8';
    drawPixelRect(ctx, -128, wireY, 256, 12, wireCol);
    drawPixelRect(ctx, -100, wireY - 8, 200, 8, '#3f3f46');
    if (i % 2 === 0) {
      drawPixelRect(ctx, -112, wireY + 4, 224, 4, '#a1a1aa');
    }
  }

  drawPixelRect(ctx, -148, -64, 36, 24, '#52525b');
  drawPixelRect(ctx, 112, -64, 36, 24, '#52525b');

  // 3. Toy Freddy's Segmented Brown/Orange Arms
  drawPixelRect(ctx, -188, -48, 52, 72, '#f97316');
  drawPixelRect(ctx, -184, -44, 44, 64, '#9a3412');
  drawPixelRect(ctx, -180, 20, 36, 12, '#71717a');
  drawPixelRect(ctx, -196, 28, 48, 68, '#f97316');
  drawPixelRect(ctx, -192, 32, 40, 60, '#9a3412');

  drawPixelRect(ctx, 136, -48, 52, 72, '#f97316');
  drawPixelRect(ctx, 140, -44, 44, 64, '#9a3412');
  drawPixelRect(ctx, 144, 20, 36, 12, '#71717a');
  drawPixelRect(ctx, 148, 28, 48, 68, '#f97316');
  drawPixelRect(ctx, 152, 32, 40, 60, '#9a3412');

  // If The Thing just impaled Richard in Ending 2, his right animatronic hand/claws are drenched in crimson blood!
  if (options?.bloodiedRightClaw) {
    drawPixelRect(ctx, 144, 88, 56, 36, '#71717a');
    drawPixelRect(ctx, 148, 96, 48, 36, '#991b1b');
    for (let cx = 144; cx <= 188; cx += 14) {
      drawPixelRect(ctx, cx, 124, 10, 28, '#dc2626');
      drawPixelRect(ctx, cx + 2, 144, 6, 14, '#ef4444');
    }
  }

  // 4. Three Articulated Metallic Endoskeleton Neck Struts
  const drawPixelStrut = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    cableColor: string
  ) => {
    const steps = 12;
    for (let s = 0; s <= steps; s++) {
      const sx = x1 + ((x2 - x1) * s) / steps;
      const sy = y1 + ((y2 - y1) * s) / steps;
      drawPixelRect(ctx, sx - 14, sy - 12, 28, 20, '#52525b');
      drawPixelRect(
        ctx,
        sx - 8,
        sy - 8,
        16,
        12,
        s % 2 === 0 ? '#e4e4e7' : '#27272a'
      );
      if (s % 3 === 0) {
        drawPixelRect(ctx, sx - 16, sy - 4, 4, 12, cableColor);
      }
    }
  };

  drawPixelStrut(0, -52, ffX, ffY + 24, '#ef4444');
  drawPixelStrut(-48, -32, bonnetX, bonnetY, '#ec4899');
  drawPixelStrut(48, -32, bbX, bbY, '#38bdf8');

  // HEAD B (LEFT): Bonnet (100% original design from EightBitPostNight4Minigame)
  ctx.save();
  ctx.translate(bonnetX, bonnetY);
  drawPixelRect(ctx, -32, -88, 20, 48, '#db2777');
  drawPixelRect(ctx, -28, -84, 12, 44, '#f472b6');
  drawPixelRect(ctx, 12, -84, 20, 44, '#db2777');
  drawPixelRect(ctx, 16, -80, 12, 40, '#f472b6');
  drawPixelRect(ctx, -44, -40, 88, 80, '#db2777');
  drawPixelRect(ctx, -40, -36, 80, 72, '#f472b6');
  drawPixelRect(ctx, -28, -24, 20, 20, '#09090b');
  drawPixelRect(ctx, 8, -24, 20, 20, '#09090b');
  drawPixelRect(ctx, -24, -32, 4, 12, '#71717a');
  drawPixelRect(ctx, 16, -32, 4, 12, '#71717a');
  drawPixelRect(ctx, -28, 8, 56, 24, '#09090b');
  ctx.restore();

  // HEAD C (RIGHT): Balloon Boy / Ennard
  ctx.save();
  ctx.translate(bbX, bbY);
  drawPixelRect(ctx, -44, -40, 44, 80, '#fed7aa');
  drawPixelRect(ctx, -40, -56, 40, 20, '#2563eb');
  drawPixelRect(ctx, -24, -76, 24, 20, '#dc2626');
  drawPixelRect(ctx, 0, -40, 44, 80, '#52525b');
  drawPixelRect(ctx, 4, -36, 36, 72, '#9ca3af');
  drawPixelRect(ctx, 0, -40, 4, 80, '#e4e4e7');
  for (let ry = -32; ry <= -12; ry += 8) {
    drawPixelRect(ctx, 8, ry, 28, 4, '#52525b');
  }
  drawPixelRect(ctx, -28, -20, 20, 20, '#09090b');
  drawPixelRect(ctx, -20, -12, 8, 8, '#ef4444');
  drawPixelRect(ctx, 8, -20, 20, 20, '#09090b');
  drawPixelRect(ctx, 20, -16, 44, 4, '#ef4444');
  drawPixelRect(ctx, 24, -8 + wireShift, 48, 4, '#38bdf8');
  drawPixelRect(ctx, 16, 0 - wireShift, 40, 4, '#eab308');
  drawPixelRect(ctx, -32, 8, 64, 24, '#09090b');
  for (let tx = -28; tx <= 20; tx += 12) {
    drawPixelRect(ctx, tx, 8, 8, 8, '#ffffff');
    drawPixelRect(ctx, tx, 24, 8, 8, '#ffffff');
  }
  ctx.restore();

  // HEAD A (TOP CENTER): Funtime Freddy Split-Faceplate Head Wide Open!
  ctx.save();
  ctx.translate(ffX, ffY);
  drawPixelRect(ctx, -52, -56, 104, 104, '#52525b');
  drawPixelRect(ctx, -44, -48, 88, 88, '#18181b');
  drawPixelRect(ctx, -4, -48, 8, 52, '#71717a');
  drawPixelRect(ctx, -40, -40, 80, 6, '#3f3f46');
  drawPixelRect(ctx, -36, -32, 24, 24, '#09090b');
  drawPixelRect(ctx, 12, -32, 24, 24, '#09090b');
  drawPixelRect(ctx, -28, -24, 12, 12, '#ef4444');
  drawPixelRect(ctx, 16, -24, 12, 12, '#ef4444');
  drawPixelRect(ctx, -24, -20, 4, 4, '#ffffff');
  drawPixelRect(ctx, 20, -20, 4, 4, '#ffffff');

  drawPixelRect(ctx, -36, 8, 72, 32 + screamJaw, '#09090b');
  for (let tx = -32; tx <= 24; tx += 12) {
    drawPixelRect(ctx, tx, 8, 8, 12, '#ffffff');
    drawPixelRect(ctx, tx, 28 + screamJaw, 8, 12, '#ffffff');
  }

  // Left & Right White/Pink Split Faceplates open wide
  drawPixelRect(ctx, -68 - maskSplit, -64, 64, 112, '#cbd5e1');
  drawPixelRect(ctx, -64 - maskSplit, -60, 56, 104, '#ffffff');
  drawPixelRect(ctx, -56 - maskSplit, 4, 24, 24, '#ec4899');
  drawPixelRect(ctx, -44 - maskSplit, -32, 24, 24, '#09090b');
  drawPixelRect(ctx, -60 - maskSplit, -84, 24, 24, '#f472b6');

  drawPixelRect(ctx, 4 + maskSplit, -64, 64, 112, '#cbd5e1');
  drawPixelRect(ctx, 8 + maskSplit, -60, 56, 104, '#ffffff');
  drawPixelRect(ctx, 32 + maskSplit, 4, 24, 24, '#ec4899');
  drawPixelRect(ctx, 20 + maskSplit, -32, 24, 24, '#09090b');
  drawPixelRect(ctx, 36 + maskSplit, -84, 24, 24, '#f472b6');

  drawPixelRect(ctx, -36, -96, 72, 12, '#09090b');
  drawPixelRect(ctx, -24, -132, 48, 36, '#18181b');
  ctx.restore();
}

// ============================================================================
// SCENE 3 & 4: REUSED THE THING SPRITE FROM INTERLUDE 4->5 + QTE + ADAPTED GRAB JUMPSCARE
// (`renderTheThingFinalFormLayer` from EightBitPostNight4Minigame.tsx)
// ============================================================================
function drawFirstPersonTheThingCloseUpQteAndJumpscare(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  p: RenderEnding1Params,
  spinPanOffsetX = 0,
  spinZoomProgress = 1
) {
  // Exact backroom/corridor background from EightBitPostNight4Minigame.tsx
  ctx.fillStyle = '#020306';
  ctx.fillRect(0, 0, W, H);

  const roomLeft = 20;
  const roomRight = 940;
  const roomW = roomRight - roomLeft;

  drawPixelRect(ctx, roomLeft, 16, roomW, 412, '#090b14');
  for (let wx = roomLeft + 32; wx < roomRight - 24; wx += 64) {
    drawPixelRect(ctx, wx, 24, 4, 280, '#0d101d');
  }
  drawPixelRect(ctx, roomLeft, 316, roomW, 112, '#180d09');
  for (let cx = roomLeft; cx < roomRight; cx += 32) {
    drawPixelRect(ctx, cx, 304, 16, 12, '#5c0f0f');
    drawPixelRect(ctx, cx + 16, 304, 16, 12, '#d4d4d8');
    drawPixelRect(ctx, cx + 8, 296, 16, 8, '#18181b');
  }
  drawPixelRect(ctx, roomLeft, 428, roomW, H - 428, '#0c0e17');
  for (let fx = roomLeft; fx < roomRight; fx += 48) {
    drawPixelRect(ctx, fx, 428, 24, H - 428, '#181b28');
  }

  const isJumpscare = p.phase === 'FP_QTE_FAIL_JUMPSCARE';
  const isKick = p.phase === 'FP_QTE_SUCCESS_KICK_IMPACT';
  const isNoDocsOfferScene =
    p.phase === 'NO_DOCS_FP_TURN_TO_THING' ||
    p.phase === 'NO_DOCS_FP_THING_OFFER_MONEY' ||
    p.phase === 'NO_DOCS_FADE_TO_CAM05';
  const timeSincePress = Math.max(0, p.elapsedSec - p.lastPressTimeSec);
  const shovePulse =
    p.phase === 'FP_QTE_RESIST_AND_KICK' && timeSincePress < 0.36
      ? Math.pow(1 - timeSincePress / 0.36, 1.3)
      : 0;

  // Close-up scale focused on his open Funtime Freddy face ("bastante cerca de su cara de funtime freddy abierta")
  let scale = 1.68;
  let extraMaskSplit = 48;
  let extraJawOpen = 16;
  let shakeAmp = 4 + shovePulse * 16;
  let cyOffset = 430;

  if (p.phase === 'FP_SPIN_AROUND_TO_FACE') {
    scale = 1.24 + spinZoomProgress * 0.44;
    cyOffset = 382 + spinZoomProgress * 48;
    extraMaskSplit = Math.round(16 + spinZoomProgress * 32);
    shakeAmp = 6;
  } else if (isNoDocsOfferScene) {
    // Standing right in front of Richard at the EXIT door offering him the money in CAM 05
    scale = 1.18 + spinZoomProgress * 0.18;
    cyOffset = 368 + spinZoomProgress * 22;
    extraMaskSplit = 18;
    extraJawOpen = 8;
    shakeAmp = 2;
  } else if (p.phase === 'FP_QTE_RESIST_AND_KICK') {
    scale = 1.68 - p.qtePresses * 0.09 - shovePulse * 0.11;
    cyOffset = 430 - shovePulse * 18;
  } else if (isKick) {
    const kickP = Math.min(1, p.elapsedSec / 0.8);
    scale = Math.max(0.85, 1.52 - kickP * 0.67);
    cyOffset = 430 - kickP * 110;
    shakeAmp = 18 * (1 - kickP);
  } else if (isJumpscare) {
    // Adapted Grab Jumpscare: Claws yank the player straight into his open Funtime Freddy jaws, timed to the full Jumpscare audio!
    const jsT = p.elapsedSec;
    const lungeP = Math.min(1, jsT / 0.52);
    scale = 1.68 + lungeP * 1.22 + Math.sin(p.timeSec * 44) * 0.14;
    cyOffset = 430 + lungeP * 140;
    extraMaskSplit = 72;
    extraJawOpen = 38 + Math.round(Math.abs(Math.sin(p.timeSec * 34)) * 26);
    shakeAmp = 26;

    const strobeRed = Math.floor(p.timeSec * 32) % 2 === 0;
    ctx.fillStyle = strobeRed ? 'rgba(68, 4, 12, 0.78)' : 'rgba(4, 2, 6, 0.82)';
    ctx.fillRect(0, 0, W, H);
  }

  const jx = Math.round(Math.sin(p.timeSec * 135) * shakeAmp) + spinPanOffsetX;
  const jy = Math.round(Math.cos(p.timeSec * 160) * (shakeAmp * 0.85));

  // Render exact The Thing Final Form from EightBitPostNight4Minigame.tsx
  ctx.save();
  ctx.translate(W / 2 + jx, cyOffset + jy);
  ctx.scale(scale, scale);
  drawCanonicalTheThingAmalgamSprite(ctx, p.timeSec, extraMaskSplit, extraJawOpen);
  ctx.restore();

  // Reused Screen-Grabbing Claws holding Richard from both sides (pushed outward on QTE [E] presses 1 & 2!)
  if (!isKick && !isNoDocsOfferScene) {
    const clawPushBackPx =
      p.phase === 'FP_QTE_RESIST_AND_KICK'
        ? Math.round(p.qtePresses * 22 + shovePulse * 48)
        : 0;
    drawScreenGrabbingClawsFromInterlude3(ctx, W, H, 1, p.timeSec, jx, clawPushBackPx);
  }

  // Super-detailed First-Person Protagonist Hands & Forearms Resisting on QTE (idle grip + explosive shove on presses 1 & 2!)
  if (p.phase === 'FP_QTE_RESIST_AND_KICK') {
    drawDetailedFirstPersonResistHands(
      ctx,
      W,
      H,
      p.qtePresses,
      shovePulse,
      p.timeSec
    );
  }

  // First-person Kick Animation on 3rd [E] press ("y en el ultimo e le pega una patada")
  if (isKick) {
    const kickP = Math.min(1, p.elapsedSec / 0.65);
    const bootY = Math.round(520 - Math.sin(kickP * Math.PI) * 320);
    drawPixelRect(ctx, 428, bootY + 76, 104, 260, '#1e293b');
    drawPixelRect(ctx, 408, bootY, 144, 84, '#271509');
    drawPixelRect(ctx, 408, bootY, 144, 20, '#451a03');
    // Boot sole treads & impact sparks
    for (let tx = 416; tx < 544; tx += 24) {
      drawPixelRect(ctx, tx, bootY - 6, 14, 6, '#18181b');
    }
  }

  // Exact Distortion & Fade-to-Black from EightBitPostNight4Minigame.tsx during Adapted Grab Jumpscare,
  // timed so the full Jumpscare scream audio plays out completely before revealing Still Nothing!
  if (isJumpscare) {
    if (p.elapsedSec >= 1.95) {
      const fixedPositions = [0.16, 0.38, 0.62, 0.85];
      fixedPositions.forEach((ratio, idx) => {
        const jitterY = Math.round(Math.sin(p.timeSec * 90 + idx * 2.1) * 12);
        const by = Math.max(0, Math.min(H - 12, Math.floor((H * ratio + jitterY) / 4) * 4));
        drawPixelRect(
          ctx,
          0,
          by,
          W,
          8,
          idx % 2 === 0 ? 'rgba(255, 255, 255, 0.24)' : 'rgba(220, 38, 38, 0.36)'
        );
      });
      for (let b = 0; b < 3; b++) {
        const by = Math.floor(((p.timeSec * 420 + b * 173) % H) / 4) * 4;
        drawPixelRect(
          ctx,
          0,
          by,
          W,
          8,
          b % 2 === 0 ? 'rgba(220, 38, 38, 0.28)' : 'rgba(255, 255, 255, 0.18)'
        );
      }
    }
    if (p.elapsedSec >= 2.65) {
      const blackoutAlpha = Math.min(1, (p.elapsedSec - 2.65) / 0.85);
      ctx.fillStyle = `rgba(0, 0, 0, ${blackoutAlpha.toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    }
  }
}

// ============================================================================
// BRANCH A (BAD ENDING): "STILL NOTHING"
// Reuses the exact Demacrado Still Freddy head & endoskeleton geometry from
// EightBitPostNight4Minigame.tsx (`drawFirstPersonStillFreddyFromShadows`),
// adding the hanging human eye + half-intact Classic Bonnie body!
// ============================================================================
function drawStillNothingBadEndingScene(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  timeSec: number
) {
  ctx.fillStyle = '#020306';
  ctx.fillRect(0, 0, W, H);

  const roomLeft = 20;
  const roomRight = 940;
  const roomW = roomRight - roomLeft;

  drawPixelRect(ctx, roomLeft, 16, roomW, 412, '#06070d');
  drawPixelRect(ctx, roomLeft, 428, roomW, H - 428, '#090b12');

  // Dim spotlight overhead
  ctx.save();
  const spotGrad = ctx.createRadialGradient(W / 2, 120, 20, W / 2, 290, 360);
  spotGrad.addColorStop(0, 'rgba(254, 240, 138, 0.22)');
  spotGrad.addColorStop(0.55, 'rgba(185, 28, 28, 0.12)');
  spotGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = spotGrad;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  const cx = W / 2;
  const cy = 336;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1.18, 1.18);

  // 1. HALF-INTACT CLASSIC BONNIE BODY ("el resto del cuerpo de animatronico (correspondiente al bonnie clasico) debe estar medio intacto")
  // Classic Bonnie indigo-blue legs (left leg intact, right leg torn at shin showing endo)
  drawPixelRect(ctx, -68, 108, 52, 76, '#3730a3');
  drawPixelRect(ctx, -64, 112, 44, 68, '#312e81');
  drawPixelRect(ctx, 16, 108, 52, 44, '#3730a3');
  drawPixelRect(ctx, 28, 152, 28, 32, '#71717a');

  // Classic Bonnie indigo-blue torso + lavender belly patch + red bowtie
  drawPixelRect(ctx, -84, -32, 168, 140, '#3730a3');
  drawPixelRect(ctx, -76, -24, 152, 124, '#312e81');
  drawPixelRect(ctx, -52, 0, 104, 84, '#818cf8');

  // Half-intact damage on lower right side of Bonnie's torso exposing endoskeleton ribs & blood
  drawPixelRect(ctx, 16, 28, 68, 56, '#09090b');
  drawPixelRect(ctx, 20, 36, 56, 8, '#a1a1aa');
  drawPixelRect(ctx, 20, 56, 56, 8, '#71717a');
  drawPixelRect(ctx, 12, 24, 16, 60, '#991b1b');

  // Classic Bonnie Red Bowtie
  drawPixelRect(ctx, -40, -28, 80, 20, '#dc2626');
  drawPixelRect(ctx, -12, -24, 24, 12, '#991b1b');

  // Left & Right Classic Bonnie Arms (half-intact)
  drawPixelRect(ctx, -128, -24, 40, 112, '#3730a3');
  drawPixelRect(ctx, -124, -20, 32, 104, '#312e81');
  drawPixelRect(ctx, 88, -24, 40, 60, '#3730a3');
  drawPixelRect(ctx, 96, 36, 24, 52, '#71717a');

  // 2. DESTROYED GENERIC FREDDY HEAD + GENERIC ENDOSKELETON (Reused from drawFirstPersonStillFreddyFromShadows!)
  drawPixelRect(ctx, -56, -200, 84, 12, '#18181b');
  drawPixelRect(ctx, -36, -244, 60, 44, '#18181b');
  drawPixelRect(ctx, -84, -192, 28, 28, '#5c2d0c');
  drawPixelRect(ctx, -76, -184, 16, 16, '#3b1a06');
  drawPixelRect(ctx, 48, -192, 8, 24, '#71717a');
  drawPixelRect(ctx, 56, -196, 20, 20, '#52525b');

  // Half-head torn off exposing generic endoskeleton
  drawPixelRect(ctx, -72, -184, 72, 68, '#6b3410');
  drawPixelRect(ctx, -68, -176, 64, 56, '#4a2208');
  drawPixelRect(ctx, 0, -180, 68, 64, '#52525b');
  drawPixelRect(ctx, 4, -176, 60, 56, '#71717a');
  drawPixelRect(ctx, 8, -172, 48, 12, '#a1a1aa');
  drawPixelRect(ctx, 12, -156, 44, 32, '#27272a');
  drawPixelRect(ctx, 12, -164, 36, 32, '#09090b');

  // Freddy snout & endo jaw
  drawPixelRect(ctx, -52, -116, 104, 16, '#3f3f46');
  for (let tx = -44; tx <= 36; tx += 12) {
    drawPixelRect(ctx, tx, -100, 8, 16, '#e4e4e7');
  }
  drawPixelRect(ctx, -56, -68, 56, 32, '#4a2208');
  drawPixelRect(ctx, 0, -68, 52, 28, '#52525b');
  for (let tx = -44; tx <= 36; tx += 12) {
    drawPixelRect(ctx, tx, -80, 8, 12, '#d4d4d8');
  }

  // 3. HANGING HUMAN EYE ("pero debe tener un ojo (humano) fuera colgando")
  drawPixelRect(ctx, -52, -164, 36, 32, '#09090b'); // Empty dark socket
  const swingX = Math.round(Math.sin(timeSec * 2.5) * 4);
  // Bloody optic nerve cord hanging down from the left socket
  drawPixelRect(ctx, -38, -140, 8, 44, '#991b1b');
  drawPixelRect(ctx, -36 + Math.round(swingX * 0.5), -128, 4, 32, '#ef4444');
  // Dangling Human Eyeball (white sclera, blue human iris, black pupil, white glint)
  const eyeX = -36 + swingX;
  const eyeY = -92;
  drawPixelRect(ctx, eyeX - 14, eyeY - 14, 28, 28, '#f8fafc');
  drawPixelRect(ctx, eyeX - 12, eyeY - 8, 6, 4, '#ef4444');
  drawPixelRect(ctx, eyeX - 6, eyeY - 6, 14, 14, '#0284c7');
  drawPixelRect(ctx, eyeX - 2, eyeY - 2, 8, 8, '#09090b');
  drawPixelRect(ctx, eyeX + 2, eyeY - 4, 4, 4, '#ffffff');

  ctx.restore();
}

// ============================================================================
// BRANCH B CUT 1: FIRST-PERSON GRABBING MONEY FROM CAM 05 LOCKER
// ============================================================================
function drawFirstPersonCam05GrabMoneyScene(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  elapsedSec: number,
  timeSec: number
) {
  ctx.fillStyle = '#020306';
  ctx.fillRect(0, 0, W, H);

  const roomLeft = 20;
  const roomRight = 940;
  const roomW = roomRight - roomLeft;
  drawPixelRect(ctx, roomLeft, 16, roomW, 412, '#090b14');
  drawPixelRect(ctx, roomLeft, 316, roomW, 112, '#180d09');
  for (let cx = roomLeft; cx < roomRight; cx += 32) {
    drawPixelRect(ctx, cx, 304, 16, 12, '#5c0f0f');
    drawPixelRect(ctx, cx + 16, 304, 16, 12, '#d4d4d8');
  }

  // Open steel cabinet/locker where the Night 4 documents were kept
  const cabX = 280;
  const cabY = 48;
  const cabW = 400;
  const cabH = 420;
  drawPixelRect(ctx, cabX - 8, cabY - 8, cabW + 16, cabH + 16, '#475569');
  drawPixelRect(ctx, cabX, cabY, cabW, cabH, '#1e293b');
  drawPixelRect(ctx, cabX + 12, cabY + 12, cabW - 24, cabH - 24, '#0f172a');

  // Locker shelves
  drawPixelRect(ctx, cabX + 12, cabY + 148, cabW - 24, 12, '#334155');
  drawPixelRect(ctx, cabX + 12, cabY + 300, cabW - 24, 12, '#334155');

  // Empty folder from Night 4 documents on top shelf
  drawPixelRect(ctx, cabX + 56, cabY + 104, 76, 44, '#ca8a04');
  drawPixelRect(ctx, cabX + 64, cabY + 112, 60, 28, '#fef08a');

  // Bundles of green money bills being grabbed by Richard's hands in first-person
  const grabP = Math.min(1, elapsedSec / 1.2);
  const pullY = Math.round(grabP * 110);

  for (let i = 0; i < 3; i++) {
    const bx = cabX + 92 + i * 76;
    const by = cabY + 244 + (i === 1 ? pullY : Math.round(pullY * 0.7));
    drawPixelRect(ctx, bx, by, 64, 44, '#15803d');
    drawPixelRect(ctx, bx + 6, by + 6, 52, 32, '#22c55e');
    drawPixelRect(ctx, bx + 24, by, 16, 44, '#fde047');
  }

  // First-person hands grabbing the money bundles
  const handY = cabY + 264 + pullY + Math.round(Math.sin(timeSec * 10) * 4);
  drawPixelRect(ctx, 364, handY + 48, 68, 220, '#1e3a8a');
  drawPixelRect(ctx, 528, handY + 48, 68, 220, '#1e3a8a');
  drawPixelRect(ctx, 356, handY, 84, 52, '#fcd34d');
  drawPixelRect(ctx, 520, handY, 84, 52, '#fcd34d');
}

// ============================================================================
// 3RD-PERSON BANK EXTERIOR & INTERIOR (Reusing the exact architectural style,
// lighting cones, draw8BitProtagonist, and draw8BitReceptionist from Interludes 2, 3 & 4)
// ============================================================================
function drawBankExteriorSceneReusedStyle(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  timeSec: number,
  playerX: number,
  playerFacing: -1 | 1,
  walkCycle: number,
  isWalking: boolean
) {
  // Night/dawn sky & stars (exact from drawHotelExteriorSceneShared)
  ctx.fillStyle = '#070b16';
  ctx.fillRect(0, 0, W, H);
  drawPixelRect(ctx, 40, 24, 4, 4, '#cbd5e1');
  drawPixelRect(ctx, 910, 32, 4, 4, '#e2e8f0');

  const groundY = 424;

  // Flanking 8-bit pine trees (exact from drawHotelExteriorSceneShared)
  draw8BitPineTree(ctx, 36, groundY, 1.25);
  draw8BitPineTree(ctx, 924, groundY, 1.25);

  // Street & sidewalk (exact from drawHotelExteriorSceneShared)
  drawPixelRect(ctx, 0, groundY, W, H - groundY, '#111827');
  drawPixelRect(ctx, 0, groundY, W, 28, '#334155');
  drawPixelRect(ctx, 0, groundY + 24, W, 4, '#64748b');

  // Grand Classical Bank Facade (coherent with Hotel Exterior in Night 2, 3 & 4)
  const bx = 72;
  const bw = 816;
  const bh = 378;
  const by = groundY - bh; // y = 46

  // Rooftop Balustrade & Cornice
  drawPixelRect(ctx, bx - 16, by - 16, bw + 32, 16, '#64748b');
  drawPixelRect(ctx, bx - 12, by - 12, bw + 24, 8, '#cbd5e1');

  // Main marble/stone bank facade
  drawPixelRect(ctx, bx, by, bw, bh, '#94a3b8');
  drawPixelRect(ctx, bx + 8, by + 8, bw - 16, bh - 8, '#e2e8f0');

  // Classical stone pillars across the facade
  const pillars = [bx + 20, 240, 384, 536, 744, bx + bw - 36];
  for (const px of pillars) {
    drawPixelRect(ctx, px, by + 8, 20, bh - 8, '#cbd5e1');
    drawPixelRect(ctx, px - 4, by + 8, 28, 12, '#64748b');
    drawPixelRect(ctx, px - 4, groundY - 16, 28, 16, '#64748b');
  }

  // Horizontal cornices
  drawPixelRect(ctx, bx - 6, by + 126, bw + 12, 10, '#64748b');
  drawPixelRect(ctx, bx - 6, by + 252, bw + 12, 10, '#64748b');

  // Rooftop Illuminated "$ BANCO $" Sign
  drawPixelRect(ctx, 368, 4, 224, 28, '#0f172a');
  drawPixelRect(ctx, 372, 8, 216, 20, '#eab308');
  ctx.fillStyle = '#09090b';
  ctx.font = 'bold 16px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('$ BANCO $', 480, 23);

  // Bank Windows
  const winCols = [124, 184, 288, 436, 628, 792];
  for (let f = 0; f < 2; f++) {
    const wy = by + 28 + f * 126;
    for (const wx of winCols) {
      drawPixelRect(ctx, wx - 4, wy - 4, 52, 76, '#334155');
      drawPixelRect(ctx, wx, wy, 44, 68, '#fef08a');
      drawPixelRect(ctx, wx + 20, wy, 4, 68, '#334155');
      drawPixelRect(ctx, wx, wy + 32, 44, 4, '#334155');
    }
  }

  // Bank Entrance Double Doors at BANK_EXTERIOR_DOOR_X (640)
  const doorW = 92;
  const doorH = 116;
  const doorX = BANK_EXTERIOR_DOOR_X - doorW / 2;
  const doorY = groundY - doorH;
  drawPixelRect(ctx, doorX - 28, doorY - 24, doorW + 56, 20, '#1e3a8a');
  drawPixelRect(ctx, doorX - 24, doorY - 8, doorW + 48, 6, '#eab308');
  drawPixelRect(ctx, doorX - 6, doorY - 4, doorW + 12, doorH + 4, '#ca8a04');
  drawPixelRect(ctx, doorX, doorY, doorW, doorH, '#451a03');
  drawPixelRect(ctx, doorX + 8, doorY + 10, 32, doorH - 20, '#fef08a');
  drawPixelRect(ctx, doorX + 52, doorY + 10, 32, doorH - 20, '#fef08a');
  drawPixelRect(ctx, doorX + 44, doorY, 4, doorH, '#ca8a04');

  ctx.fillStyle = 'rgba(254, 240, 138, 0.20)';
  ctx.fillRect(doorX - 20, groundY, doorW + 40, 22);

  // Richard in 3rd-person holding the money in his hand!
  draw8BitProtagonist(
    ctx,
    playerX,
    groundY + 10,
    playerFacing,
    walkCycle,
    isWalking,
    true,
    timeSec
  );
}

function drawBankInteriorSceneReusedStyle(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  timeSec: number,
  playerX: number,
  playerFacing: -1 | 1,
  walkCycle: number,
  isWalking: boolean
) {
  // Framed interior lobby matching drawHotelRoomSceneShared & drawHotelHallwaySceneShared
  const roomLeft = 72;
  const roomRight = 888;
  const roomTop = 64;
  const floorY = 384;
  const roomW = roomRight - roomLeft;
  const roomH = floorY - roomTop;

  ctx.fillStyle = '#030408';
  ctx.fillRect(0, 0, W, H);

  drawPixelRect(ctx, roomLeft - 8, roomTop - 8, roomW + 16, roomH + 64, '#d6c79c');
  drawPixelRect(ctx, roomLeft - 4, roomTop - 4, roomW + 8, roomH + 56, '#fef9c3');

  // Wallpaper & wainscoting (exact from Hotel Lobby / Hallway)
  drawPixelRect(ctx, roomLeft, roomTop, roomW, roomH, '#f5f0e1');
  for (let wx = roomLeft + 12; wx < roomRight - 8; wx += 28) {
    drawPixelRect(ctx, wx, roomTop + 12, 8, roomH - 76, '#ede3c8');
  }
  drawPixelRect(ctx, roomLeft, roomTop, roomW, 12, '#eab308');
  drawPixelRect(ctx, roomLeft, floorY - 68, roomW, 68, '#faf8f5');
  drawPixelRect(ctx, roomLeft, floorY - 72, roomW, 6, '#eab308');

  // Red & gold carpet runner over oak floor
  drawPixelRect(ctx, roomLeft, floorY, roomW, 48, '#78350f');
  drawPixelRect(ctx, roomLeft, floorY + 8, roomW, 32, '#991b1b');
  drawPixelRect(ctx, roomLeft, floorY + 8, roomW, 4, '#eab308');
  drawPixelRect(ctx, roomLeft, floorY + 36, roomW, 4, '#eab308');

  // Left Entrance/Exit Door inside the Bank (x = 140)
  const exitDoorW = 68;
  const exitDoorH = 116;
  const exitDoorX = 140 - exitDoorW / 2;
  const exitDoorY = floorY - exitDoorH;
  drawPixelRect(ctx, exitDoorX - 6, exitDoorY - 6, exitDoorW + 12, exitDoorH + 6, '#eab308');
  drawPixelRect(ctx, exitDoorX, exitDoorY, exitDoorW, exitDoorH, '#451a03');
  drawPixelRect(ctx, exitDoorX + 10, exitDoorY + 12, exitDoorW - 20, 52, '#fef08a');

  // Bank Vault Door & Sign in the center-left background (x = 340)
  drawPixelRect(ctx, 292, floorY - 128, 108, 128, '#475569');
  drawPixelRect(ctx, 300, floorY - 120, 92, 120, '#94a3b8');
  drawPixelRect(ctx, 328, floorY - 80, 36, 36, '#334155');
  drawPixelRect(ctx, 340, floorY - 92, 12, 60, '#eab308');
  drawPixelRect(ctx, 316, floorY - 68, 60, 12, '#eab308');

  // Reception Desk & Receptionist at BANK_RECEPTIONIST_X (670) — exact style from Floor 1 Reception in Interludes 2, 3 & 4!
  const counterX = 560;
  const counterW = 220;
  const counterTopY = floorY - 56;

  drawPixelRect(ctx, counterX + 12, roomTop + 68, counterW - 24, 72, '#451a03');
  drawPixelRect(ctx, counterX + 16, roomTop + 72, counterW - 32, 64, '#5c2d10');
  ctx.fillStyle = '#fde047';
  ctx.font = 'bold 13px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('DONACIONES Y SALUD', counterX + counterW / 2, roomTop + 108);

  // Reused draw8BitReceptionist from EightBitPostNight3Minigame & EightBitPostNight4Minigame
  draw8BitReceptionist(ctx, BANK_RECEPTIONIST_X, counterTopY, 1);

  // Polished wood & brass reception counter in front of receptionist
  drawPixelRect(ctx, counterX - 4, counterTopY, counterW + 8, 8, '#eab308');
  drawPixelRect(ctx, counterX, counterTopY + 8, counterW, 48, '#5c2d10');
  drawPixelRect(ctx, counterX + 8, counterTopY + 14, counterW - 16, 36, '#78350f');
  drawPixelRect(ctx, BANK_RECEPTIONIST_X - 6, counterTopY - 6, 12, 6, '#fde047');

  // Richard in 3rd-person holding the money in his hand!
  draw8BitProtagonist(
    ctx,
    playerX,
    floorY + 8,
    playerFacing,
    walkCycle,
    isWalking,
    true,
    timeSec
  );

  // Warm overhead ceiling lamps & lighting cone (exact from Hotel Lobby / Room)
  for (const lx of [240, 480, 720]) {
    drawPixelRect(ctx, lx - 16, roomTop, 32, 10, '#ca8a04');
    drawPixelRect(ctx, lx - 12, roomTop + 10, 24, 6, '#fef08a');
  }
  ctx.fillStyle = 'rgba(254, 240, 138, 0.10)';
  ctx.fillRect(roomLeft, roomTop + 16, roomW, roomH);
}

// ============================================================================
// ENDING 2 (NO DOCUMENTS): CAM 05 REACHING FOR MONEY -> IMPALED THROUGH CHEST
// BY THE THING'S CLAW -> THROWN TO THE FLOOR -> THE THING CROUCHING OVER
// DYING RICHARD WITH AUTOMATIC DIALOGUE & SLOW BLURRY DEATH BLINK
// ============================================================================
function drawNoDocsCam05ImpaledAndDyingScene(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  p: RenderEnding1Params
) {
  ctx.fillStyle = '#020306';
  ctx.fillRect(0, 0, W, H);

  // 1. REACHING FOR MONEY (3.0 SECONDS DRAMATIC TENSION) OR IMPALED THROUGH THE CHEST FROM BEHIND
  if (
    p.phase === 'NO_DOCS_FP_REACH_FOR_MONEY' ||
    p.phase === 'NO_DOCS_FP_IMPALED_BY_CLAW'
  ) {
    const isImpaled = p.phase === 'NO_DOCS_FP_IMPALED_BY_CLAW';
    const reachNorm = isImpaled
      ? 1
      : Math.min(1, p.elapsedSec / POST_NIGHT_5_NO_DOCS_REACH_MONEY_DURATION_SEC);

    // Subtle tension tremor in the last 0.8s before impalement, then violent shock on impalement
    const preStrikeTension =
      !isImpaled && reachNorm > 0.72
        ? Math.round(Math.sin(p.timeSec * 55) * ((reachNorm - 0.72) / 0.28) * 3)
        : 0;
    const shakeX = isImpaled
      ? Math.round(
          Math.sin(p.timeSec * 95) * (p.elapsedSec < 0.55 ? 18 : 6)
        )
      : preStrikeTension;
    const shakeY = isImpaled
      ? Math.round(
          Math.cos(p.timeSec * 115) * (p.elapsedSec < 0.55 ? 15 : 5)
        )
      : 0;

    // Dramatic slow step-in zoom toward the open locker over the 3.0 seconds
    const approachZoom = isImpaled ? 1.08 : 1 + Math.pow(reachNorm, 1.3) * 0.08;

    ctx.save();
    ctx.translate(W / 2 + shakeX, H / 2 + shakeY);
    ctx.scale(approachZoom, approachZoom);
    ctx.translate(-W / 2, -H / 2);

    const roomLeft = 20;
    const roomRight = 940;
    const roomW = roomRight - roomLeft;
    drawPixelRect(ctx, roomLeft, 16, roomW, 412, '#090b14');
    drawPixelRect(ctx, roomLeft, 316, roomW, 112, '#180d09');
    for (let cx = roomLeft; cx < roomRight; cx += 32) {
      drawPixelRect(ctx, cx, 304, 16, 12, '#5c0f0f');
      drawPixelRect(ctx, cx + 16, 304, 16, 12, '#d4d4d8');
    }

    // Open steel cabinet/locker in CAM 05 where the money sits
    const cabX = 280;
    const cabY = 48;
    const cabW = 400;
    const cabH = 420;
    drawPixelRect(ctx, cabX - 8, cabY - 8, cabW + 16, cabH + 16, '#475569');
    drawPixelRect(ctx, cabX, cabY, cabW, cabH, '#1e293b');
    drawPixelRect(ctx, cabX + 12, cabY + 12, cabW - 24, cabH - 24, '#0f172a');

    // Locker shelves
    drawPixelRect(ctx, cabX + 12, cabY + 148, cabW - 24, 12, '#334155');
    drawPixelRect(ctx, cabX + 12, cabY + 300, cabW - 24, 12, '#334155');

    // Folder from Night 4 documents still sitting on the top shelf (since Richard didn't take them!)
    drawPixelRect(ctx, cabX + 56, cabY + 104, 76, 44, '#ca8a04');
    drawPixelRect(ctx, cabX + 64, cabY + 112, 60, 28, '#fef08a');

    // Green money bundles sitting on the middle shelf (untouched — Richard gets impaled right before touching them!)
    for (let i = 0; i < 3; i++) {
      const bx = cabX + 92 + i * 76;
      const by = cabY + 244;
      drawPixelRect(ctx, bx, by, 64, 44, '#15803d');
      drawPixelRect(ctx, bx + 6, by + 6, 52, 32, '#22c55e');
      drawPixelRect(ctx, bx + 24, by, 16, 44, '#fde047');
    }

    // In the final second of the 3-second reach (2.0s -> 3.0s), The Thing's ominous dark shadow falls over the locker from behind Richard!
    if (!isImpaled && reachNorm > 0.62) {
      const shadowAlpha = Math.min(0.55, ((reachNorm - 0.62) / 0.38) * 0.55);
      ctx.fillStyle = `rgba(9, 2, 6, ${shadowAlpha.toFixed(3)})`;
      ctx.fillRect(cabX + 16, cabY + 16, cabW - 32, cabH - 32);
    }

    // Richard's first-person hands slowly rising over 3.0 seconds toward the money bundles (or dropping in shock when impaled)
    const smoothReach = isImpaled
      ? Math.max(0.18, 1 - Math.min(1, p.elapsedSec / 0.75) * 0.68)
      : 1 - Math.pow(1 - Math.min(1, p.elapsedSec / 2.65), 2.4);
    const handY = Math.round(
      432 - smoothReach * 132 + Math.sin(p.timeSec * 10) * 3
    );
    const leftHandX = Math.round(304 + smoothReach * 32);
    const rightHandX = Math.round(572 - smoothReach * 32);

    // Left & right blue jacket sleeves & forearms reaching toward the money
    drawPixelRect(ctx, leftHandX + 8, handY + 48, 68, 240, '#1e3a8a');
    drawPixelRect(ctx, leftHandX + 16, handY + 40, 52, 16, '#e2e8f0');
    drawPixelRect(ctx, rightHandX + 8, handY + 48, 68, 240, '#1e3a8a');
    drawPixelRect(ctx, rightHandX + 16, handY + 40, 52, 16, '#e2e8f0');

    // Left & right palms and articulated fingers extending right toward the green cash bundles
    drawPixelRect(ctx, leftHandX, handY, 84, 44, '#fcd34d');
    drawPixelRect(ctx, rightHandX, handY, 84, 44, '#fcd34d');
    for (let f = 0; f < 4; f++) {
      const fingerTwitch =
        !isImpaled && reachNorm > 0.75
          ? Math.round(Math.sin(p.timeSec * 28 + f) * 4)
          : 0;
      drawPixelRect(
        ctx,
        leftHandX + 6 + f * 19,
        handY - 24 + fingerTwitch,
        14,
        24,
        '#fcd34d'
      );
      drawPixelRect(
        ctx,
        rightHandX + 6 + f * 19,
        handY - 24 - fingerTwitch,
        14,
        24,
        '#fcd34d'
      );
    }

    // IMPALED FROM BEHIND BY ONE OF THE THING'S HANDS/CLAWS!
    // ("cuando esta a punto de coger el dinero entonces debe ser atravesado por una de las manos de the thing
    // (que se vea defrente pues le ha atravesado todo el cuerpo)")
    if (isImpaled) {
      const thrustP = Math.min(1, p.elapsedSec / 0.22);
      const clawExtendY = Math.round((1 - thrustP) * 220);

      // Crimson blood splash across locker & screen
      ctx.fillStyle = 'rgba(153, 27, 27, 0.46)';
      ctx.fillRect(0, 0, W, H);
      drawPixelRect(ctx, 412, 180, 136, 168, 'rgba(127, 29, 29, 0.78)');
      drawPixelRect(ctx, 384, 212, 192, 96, 'rgba(185, 28, 28, 0.65)');

      // Torn blue jacket fabric & blood bursting outward from the center of Richard's chest (bottom-center of FP view)
      const chestCx = W / 2;
      const chestBaseY = H + 24 + clawExtendY;

      drawPixelRect(ctx, chestCx - 116, H - 96 + clawExtendY, 232, 108, '#172554');
      drawPixelRect(ctx, chestCx - 92, H - 108 + clawExtendY, 184, 112, '#7f1d1d');
      drawPixelRect(ctx, chestCx - 72, H - 100 + clawExtendY, 144, 96, '#dc2626');

      // The Thing's canonical Toy-Freddy orange/brown segmented forearm & hydraulic endoskeleton rods protruding forward out of Richard's chest!
      drawPixelRect(ctx, chestCx - 56, chestBaseY - 260, 112, 240, '#27272a');
      drawPixelRect(ctx, chestCx - 48, chestBaseY - 252, 96, 220, '#52525b');
      // Toy Freddy orange/brown segmented forearm plates (matching drawCanonicalTheThingAmalgamSprite!)
      drawPixelRect(ctx, chestCx - 52, chestBaseY - 208, 44, 164, '#f97316');
      drawPixelRect(ctx, chestCx - 48, chestBaseY - 200, 36, 148, '#9a3412');
      drawPixelRect(ctx, chestCx + 8, chestBaseY - 208, 44, 164, '#f97316');
      drawPixelRect(ctx, chestCx + 12, chestBaseY - 200, 36, 148, '#9a3412');
      // Hydraulic piston & blood streaks running down the metal arm
      drawPixelRect(ctx, chestCx - 8, chestBaseY - 256, 16, 224, '#a1a1aa');
      drawPixelRect(ctx, chestCx - 36, chestBaseY - 240, 20, 196, '#dc2626');
      drawPixelRect(ctx, chestCx + 16, chestBaseY - 224, 16, 180, '#b91c1c');

      // Massive metallic animatronic hand palm bursting forward at chest height
      const palmY = chestBaseY - 308;
      drawPixelRect(ctx, chestCx - 76, palmY, 152, 68, '#3f3f46');
      drawPixelRect(ctx, chestCx - 68, palmY + 8, 136, 52, '#71717a');
      drawPixelRect(ctx, chestCx - 52, palmY + 16, 104, 36, '#991b1b');

      // 4 razor-sharp blood-drenched animatronic claws splayed outward in front of the camera!
      const clawOffsets = [-68, -24, 20, 64];
      clawOffsets.forEach((ox, idx) => {
        const clawH = idx === 1 || idx === 2 ? 116 : 96;
        const clawTopY = palmY - clawH;
        // Segmented metallic finger
        drawPixelRect(ctx, chestCx + ox - 12, clawTopY + 36, 24, clawH - 36, '#52525b');
        drawPixelRect(ctx, chestCx + ox - 8, clawTopY + 40, 16, clawH - 44, '#a1a1aa');
        // Razor claw tip drenched in bright crimson blood
        drawPixelRect(ctx, chestCx + ox - 10, clawTopY + 12, 20, 28, '#e4e4e7');
        drawPixelRect(ctx, chestCx + ox - 6, clawTopY, 12, 20, '#dc2626');
        drawPixelRect(ctx, chestCx + ox - 4, clawTopY + 16, 8, 36, '#991b1b');
      });

      // Thumb claw on the left side of the hand
      drawPixelRect(ctx, chestCx - 108, palmY - 24, 36, 48, '#52525b');
      drawPixelRect(ctx, chestCx - 120, palmY - 44, 24, 28, '#e4e4e7');
      drawPixelRect(ctx, chestCx - 120, palmY - 48, 16, 16, '#dc2626');
    }

    ctx.restore();
    return;
  }

  // 2. THROWN TO THE FLOOR -> LYING ON SIDE UNABLE TO MOVE WHILE THE THING CROUCHES DOWN TO LOOK AT RICHARD
  // ("y que despues debe tirarlo al suelo con una animacion y como si se estuviese muriendo the thing debe
  // agacharse a ver al jugador (que esta tumbado de lado sin poder moverse)")
  const isThrownPhase = p.phase === 'NO_DOCS_FP_THROWN_TO_FLOOR';
  const fallProgress = isThrownPhase ? Math.min(1, p.elapsedSec / 0.85) : 1;
  const easeFall = 1 - Math.pow(1 - fallProgress, 3);

  // Camera rolls sideways (~13 degrees tilt + floor-level vertical offset) so the dialogue remains crisp while clearly showing Richard lying on his side on the floor!
  const sideTiltRad = easeFall * 0.21;
  const floorDropY = Math.round(easeFall * 28);
  const impactBounceY =
    isThrownPhase && p.elapsedSec > 0.75 && p.elapsedSec < 1.15
      ? Math.round(Math.sin((p.elapsedSec - 0.75) * 25) * 14)
      : 0;

  ctx.save();
  ctx.translate(W / 2, H / 2 + floorDropY + impactBounceY);
  ctx.rotate(sideTiltRad);
  ctx.translate(-W / 2, -H / 2);

  // CAM 05 background seen from floor level
  drawPixelRect(ctx, -120, -120, W + 240, 380, '#060810');
  drawPixelRect(ctx, -120, 220, W + 240, 96, '#180d09');
  for (let cx = -96; cx < W + 120; cx += 32) {
    drawPixelRect(ctx, cx, 212, 16, 12, '#5c0f0f');
    drawPixelRect(ctx, cx + 16, 212, 16, 12, '#d4d4d8');
  }

  // Checkered pizzeria/storage floor right up against the side of Richard's face
  drawPixelRect(ctx, -120, 300, W + 240, 360, '#0d0f17');
  for (let row = 0; row < 6; row++) {
    const ry = 304 + row * 44;
    for (let col = -3; col < 18; col++) {
      const rx = col * 64 + (row % 2 === 0 ? 0 : 32);
      drawPixelRect(
        ctx,
        rx,
        ry,
        64,
        44,
        (row + col) % 2 === 0 ? '#18181b' : '#27272a'
      );
    }
  }

  // Pool of crimson blood spreading on the floor tiles around Richard
  drawPixelRect(ctx, 180, 344, 600, 140, 'rgba(127, 29, 29, 0.75)');
  drawPixelRect(ctx, 260, 364, 440, 96, 'rgba(185, 28, 28, 0.65)');

  // THE THING CROUCHING DOWN ("the thing debe agacharse a ver al jugador")
  // Uses the 100% CANONICAL The Thing sprite (`drawCanonicalTheThingAmalgamSprite`: Funtime Freddy white/pink split faceplates,
  // Endo skull, Bonnet left head, Balloon Boy / Ennard right head, wire amalgam torso, Toy Freddy orange arms, Foxy red legs)
  // crouching down low to the floor to look directly at Richard!
  const crouchProgress = isThrownPhase
    ? Math.max(0, (p.elapsedSec - 0.55) / 1.15)
    : 1;
  const smoothCrouch = 1 - Math.pow(1 - Math.min(1, crouchProgress), 3);

  const thingCx = W / 2 + 12;
  // As The Thing crouches down, its canonical Funtime Freddy center head & glowing red eyes drop right into Richard's sideways floor-level view!
  const thingBodyCy = Math.round(236 + smoothCrouch * 124 + Math.sin(p.timeSec * 2.4) * 4);
  const thingScale = 0.96 + smoothCrouch * 0.22;
  const jawLaughOpen =
    p.phase === 'NO_DOCS_FP_SLOW_DEATH_BLINK'
      ? 22
      : 10;
  const faceplatesSplit =
    p.phase === 'NO_DOCS_FP_SLOW_DEATH_BLINK'
      ? 36
      : 22;

  ctx.save();
  ctx.translate(thingCx, thingBodyCy);
  // Slight predatory head/body tilt as The Thing leans down to look at Richard lying on his side
  ctx.rotate(-0.12 * smoothCrouch);
  ctx.scale(thingScale, thingScale);
  drawCanonicalTheThingAmalgamSprite(
    ctx,
    p.timeSec,
    faceplatesSplit,
    jawLaughOpen,
    {
      crouched: true,
      bloodiedRightClaw: true,
    }
  );
  ctx.restore();

  // Richard's limp left hand lying motionless on the bloodied floor tiles in the foreground
  drawPixelRect(ctx, 64, 384, 136, 48, '#1e3a8a');
  drawPixelRect(ctx, 188, 392, 68, 40, '#fcd34d');
  drawPixelRect(ctx, 196, 404, 52, 16, '#991b1b');

  ctx.restore();

  // 3. HEAVY BLINKING EYELIDS & DYING VIGNETTE
  // ("y durante este proceso debe estar parpadeando y con la vision cada vez mas borrosa y cuando termine de hablar
  // debe hacer un parpadeo lento de muerte en el que la pantalla de va volviendo cada vez mas borrosa mientras cierra los ojos lentamente")
  if (
    p.phase === 'NO_DOCS_FP_DYING_AUTOMATIC_DIALOGUE' ||
    p.phase === 'NO_DOCS_FP_SLOW_DEATH_BLINK'
  ) {
    const isFinalDeathBlink = p.phase === 'NO_DOCS_FP_SLOW_DEATH_BLINK';
    const vision = getPostNight5NoDocsDyingVisionState(p.elapsedSec, isFinalDeathBlink);

    // Red/dark dying vignette around the edges of vision
    const vigGrad = ctx.createRadialGradient(W / 2, H / 2, 80, W / 2, H / 2, 520);
    vigGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vigGrad.addColorStop(0.65, `rgba(69, 10, 10, ${(0.35 + vision.eyelidCloseProgress * 0.35).toFixed(3)})`);
    vigGrad.addColorStop(1, 'rgba(0, 0, 0, 0.95)');
    ctx.fillStyle = vigGrad;
    ctx.fillRect(0, 0, W, H);

    // Upper and lower eyelids closing inward from top and bottom of the screen
    const lidH = Math.ceil((H / 2 + 24) * vision.eyelidCloseProgress);
    if (lidH > 0) {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, W, lidH);
      ctx.fillRect(0, H - lidH, W, lidH);

      // Soft dark-red/black inner eyelid gradient edge
      if (vision.eyelidCloseProgress < 0.98) {
        ctx.fillStyle = 'rgba(24, 4, 6, 0.65)';
        ctx.fillRect(0, lidH, W, 16);
        ctx.fillRect(0, H - lidH - 16, W, 16);
      }
    }
  }
}

