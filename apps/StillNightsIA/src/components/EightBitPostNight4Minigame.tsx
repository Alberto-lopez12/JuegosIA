import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BAD_ENDING_TITLE_DELAY_SEC,
  BAD_ENDING_TITLE_FADE_DURATION_SEC,
  HOTEL_BED_STAND_X,
  HOTEL_CENTRAL_DOOR_X,
  HOTEL_ELEVATOR_DOWN_X,
  HOTEL_ELEVATOR_UP_X,
  HOTEL_EXTERIOR_DOOR_X,
  HOTEL_EXTERIOR_MAX_X,
  HOTEL_EXTERIOR_MIN_X,
  HOTEL_EXTERIOR_SPAWN_X,
  HOTEL_HALLWAY_EXIT_DOOR_X,
  HOTEL_HALLWAY_MAX_X,
  HOTEL_HALLWAY_MIN_X,
  HOTEL_HALLWAY_VIEWPORT_WIDTH,
  HOTEL_HALLWAY_WORLD_WIDTH,
  HOTEL_LIGHT_SWITCH_X,
  HOTEL_MAX_WALK_X,
  HOTEL_MIN_WALK_X,
  HOTEL_PHONE_X,
  HOTEL_PLAYER_ROOM_303_X,
  HOTEL_RECEPTIONISTS,
  HotelRoomDoorConfig,
  INTRO_WALK_SPEED_PX_PER_SEC,
  POST_NIGHT_2_BED_SLEEP_PROMPT,
  POST_NIGHT_2_WRONG_ROOM_DIALOGUE,
  POST_NIGHT_4_BLINK_TOTAL_DURATION_SEC,
  POST_NIGHT_4_CHAIR_INITIAL_DIALOGUE,
  POST_NIGHT_4_CHAIR_LAUGH_INTRO_DURATION_SEC,
  POST_NIGHT_4_CHAIR_POST_HANDOVER_DIALOGUE,
  POST_NIGHT_4_CIRCLE_QTE_REQUIRED_HITS,
  POST_NIGHT_4_CIRCLE_QTE_START_SCALE,
  POST_NIGHT_4_FINAL_GOOD_LUCK_TAB,
  POST_NIGHT_4_FLOOR_STAND_UP_DURATION_SEC,
  POST_NIGHT_4_FREDDY_EMERGE_DURATION_SEC,
  POST_NIGHT_4_FREDDY_POST_EMERGE_PAUSE_SEC,
  POST_NIGHT_4_HAND_OVER_ANIM_DURATION_SEC,
  POST_NIGHT_4_HAND_OVER_PROMPT_TEXT,
  POST_NIGHT_4_NO_DOCS_BROTHER_TABS,
  POST_NIGHT_4_NO_DOCS_CONFUSED_TAB,
  POST_NIGHT_4_NO_DOCS_FINAL_SCREAM_TAB,
  POST_NIGHT_4_NO_DOCS_LUNGE_DURATION_SEC,
  POST_NIGHT_4_NO_DOCS_PAY_FAILURES_TAB,
  POST_NIGHT_4_NO_DOCS_SHADOW_TABS,
  POST_NIGHT_4_RABBIT_JUMPSCARE_DURATION_SEC,
  POST_NIGHT_4_THE_THING_APPROACH_DURATION_SEC,
  POST_NIGHT_4_THE_THING_REVEAL_TABS,
  PROTAGONIST_NAME_FROM_NIGHT_3,
  PostNight1DialogueTab,
  PostNight1TextSegment,
  PostNight4FloorStandUpState,
  PostNight4MinigamePhase,
  evaluatePostNight4CircleQtePress,
  getHotelFloorRooms,
  getHotelHallwayCameraX,
  getNearbyHotelHallwayRoom,
  getNearbyReceptionist,
  getPostNight4BlinkState,
  getPostNight4CircleQteState,
  getPostNight4FloorStandUpState,
  getPostNight4RabbitJumpscareState,
  getPostNight4RevealSpeakerName,
  isNearElevatorDown,
  isNearElevatorUp,
  isNearHotelBed,
  isNearHotelExteriorDoor,
  isNearHotelHallwayExitDoor,
  isNearHotelLightSwitch,
} from '../game/rules';
import { soundController } from '../game/audio';

interface EightBitPostNight4MinigameProps {
  collectedDocuments?: boolean;
  onComplete: () => void;
  onReturnToTitle?: () => void;
  onUnlockBadEnding2?: () => void;
}

export const EightBitPostNight4Minigame: React.FC<EightBitPostNight4MinigameProps> = ({
  collectedDocuments = true,
  onComplete,
  onReturnToTitle,
  onUnlockBadEnding2,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const completedRef = useRef<boolean>(false);
  const unlockedBadEndingRef = useRef<boolean>(false);

  const initialParams = useMemo(() => {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      const phaseParam = sp.get('postnight4_phase') as PostNight4MinigamePhase | null;
      const noDocsParam =
        sp.get('no_docs') === '1' ||
        sp.get('docs') === '0' ||
        Boolean(phaseParam && phaseParam.startsWith('NO_DOCS_'));
      const forceDocsParam = sp.get('docs') === '1';
      return {
        phaseParam,
        floorParam: Number(sp.get('hotel_floor')),
        pxParam: Number(sp.get('player_x')),
        blinkTParam: sp.get('blink_t') !== null ? Number(sp.get('blink_t')) : NaN,
        jumpscareTParam: sp.get('jumpscare_t') !== null ? Number(sp.get('jumpscare_t')) : NaN,
        revealTParam: sp.get('reveal_t') !== null ? Number(sp.get('reveal_t')) : NaN,
        fullTextParam: sp.get('full_text') === '1',
        collectedDocsOverride: forceDocsParam
          ? true
          : noDocsParam
          ? false
          : null,
      };
    }
    return {
      phaseParam: null,
      floorParam: NaN,
      pxParam: NaN,
      blinkTParam: NaN,
      jumpscareTParam: NaN,
      revealTParam: NaN,
      fullTextParam: false,
      collectedDocsOverride: null as boolean | null,
    };
  }, []);

  const hasCollectedDocs =
    initialParams.collectedDocsOverride !== null
      ? initialParams.collectedDocsOverride
      : collectedDocuments;
  const hasCollectedDocsRef = useRef<boolean>(hasCollectedDocs);
  hasCollectedDocsRef.current = hasCollectedDocs;

  const onReturnToTitleRef = useRef(onReturnToTitle);
  onReturnToTitleRef.current = onReturnToTitle;

  const onUnlockBadEnding2Ref = useRef(onUnlockBadEnding2);
  onUnlockBadEnding2Ref.current = onUnlockBadEnding2;

  const [phase, setPhase] = useState<PostNight4MinigamePhase>(() => {
    if (initialParams.phaseParam) {
      return initialParams.phaseParam;
    }
    return 'HOTEL_EXTERIOR_WALK';
  });

  const [currentFloor, setCurrentFloor] = useState<1 | 2 | 3>(() => {
    if (
      initialParams.floorParam === 1 ||
      initialParams.floorParam === 2 ||
      initialParams.floorParam === 3
    ) {
      return initialParams.floorParam;
    }
    if (
      initialParams.phaseParam &&
      (initialParams.phaseParam.startsWith('HOTEL_ROOM') ||
        initialParams.phaseParam.startsWith('FP_'))
    ) {
      return 3;
    }
    return 1;
  });

  const initialPlayerX = useMemo(() => {
    if (!Number.isNaN(initialParams.pxParam) && initialParams.pxParam > 0) {
      return initialParams.pxParam;
    }
    if (phase === 'HOTEL_ROOM_FREE_ROAM') {
      return HOTEL_CENTRAL_DOOR_X;
    }
    if (
      phase === 'HOTEL_ROOM_BED_PROMPT' ||
      phase === 'HOTEL_ROOM_TURN_OFF_LIGHTS_WALK' ||
      phase === 'FP_SLEEP_BLINKING'
    ) {
      return HOTEL_BED_STAND_X;
    }
    return HOTEL_EXTERIOR_SPAWN_X;
  }, [initialParams.pxParam, phase]);

  const [roomLightOn, setRoomLightOn] = useState<boolean>(() => {
    if (
      initialParams.phaseParam === 'FP_SLEEP_BLINKING' ||
      initialParams.phaseParam === 'FP_RABBIT_JUMPSCARE' ||
      initialParams.phaseParam === 'FP_RABBIT_BLACKOUT'
    ) {
      return false;
    }
    return true;
  });

  const [activeReceptionistId, setActiveReceptionistId] = useState<number>(1);
  const [revealTabIndex, setRevealTabIndex] = useState<number>(0);
  const [noDocsTabIndex, setNoDocsTabIndex] = useState<number>(0);
  const [selectedChoice, setSelectedChoice] = useState<'SI' | 'NO'>('SI');
  const [typedChars, setTypedChars] = useState<number>(() =>
    initialParams.fullTextParam ? 999 : 0
  );
  const [trembleTick, setTrembleTick] = useState<number>(0);

  // Circle QTE states for the No-Documents route
  const [circleQteHits, setCircleQteHits] = useState<number>(0);
  const [circleQteRingScale, setCircleQteRingScale] = useState<number>(
    POST_NIGHT_4_CIRCLE_QTE_START_SCALE
  );
  const [circleQteInZone, setCircleQteInZone] = useState<boolean>(false);
  const [badEndingElapsedSec, setBadEndingElapsedSec] = useState<number>(0);

  // Camera scroll X & proximity states for floating [E] popovers (100% identical to Night 2 & Night 3)
  const [hallwayCameraX, setHallwayCameraX] = useState<number>(() =>
    getHotelHallwayCameraX(initialPlayerX)
  );
  const [nearExteriorDoor, setNearExteriorDoor] = useState<boolean>(() =>
    isNearHotelExteriorDoor(initialPlayerX)
  );
  const [nearbyReceptionistId, setNearbyReceptionistId] = useState<number | null>(() =>
    getNearbyReceptionist(initialPlayerX)?.id ?? null
  );
  const [nearElevatorDown, setNearElevatorDown] = useState<boolean>(() =>
    isNearElevatorDown(initialPlayerX)
  );
  const [nearElevatorUp, setNearElevatorUp] = useState<boolean>(() =>
    isNearElevatorUp(initialPlayerX)
  );
  const [nearbyHallwayRoom, setNearbyHallwayRoom] = useState<HotelRoomDoorConfig | null>(() =>
    getNearbyHotelHallwayRoom(currentFloor, initialPlayerX)
  );
  const [nearHallwayExitDoor, setNearHallwayExitDoor] = useState<boolean>(() =>
    isNearHotelHallwayExitDoor(initialPlayerX)
  );
  const [nearLightSwitch, setNearLightSwitch] = useState<boolean>(() =>
    isNearHotelLightSwitch(initialPlayerX)
  );
  const [nearBed, setNearBed] = useState<boolean>(() => isNearHotelBed(initialPlayerX));

  const phaseRef = useRef<PostNight4MinigamePhase>(phase);
  phaseRef.current = phase;

  const currentFloorRef = useRef<1 | 2 | 3>(currentFloor);
  currentFloorRef.current = currentFloor;

  const roomLightOnRef = useRef<boolean>(roomLightOn);
  roomLightOnRef.current = roomLightOn;

  const revealTabIndexRef = useRef<number>(revealTabIndex);
  revealTabIndexRef.current = revealTabIndex;

  const noDocsTabIndexRef = useRef<number>(noDocsTabIndex);
  noDocsTabIndexRef.current = noDocsTabIndex;

  const selectedChoiceRef = useRef<'SI' | 'NO'>(selectedChoice);
  selectedChoiceRef.current = selectedChoice;

  const typedCharsRef = useRef<number>(typedChars);
  typedCharsRef.current = typedChars;

  const circleQteHitsRef = useRef<number>(circleQteHits);
  circleQteHitsRef.current = circleQteHits;

  const circleQteRingScaleRef = useRef<number>(circleQteRingScale);
  circleQteRingScaleRef.current = circleQteRingScale;

  const simRef = useRef({
    fadeAlpha: 0,
    playerX: initialPlayerX,
    playerFacing: (phase === 'HOTEL_ROOM_FREE_ROAM' ? -1 : 1) as -1 | 1,
    walkCycle: 0,
    elevatorTargetFloor: 1 as 1 | 2 | 3,
    elevatorFadeStage: 'FADE_OUT' as 'FADE_OUT' | 'FADE_IN',
    turnOffLightStage: 'TO_SWITCH' as
      | 'TO_SWITCH'
      | 'AT_SWITCH_PAUSE'
      | 'BACK_TO_BED'
      | 'LIE_DOWN_FADE',
    switchPauseSec: 0,
    phaseTimerSec:
      !Number.isNaN(initialParams.blinkTParam)
        ? initialParams.blinkTParam
        : !Number.isNaN(initialParams.jumpscareTParam)
        ? initialParams.jumpscareTParam
        : !Number.isNaN(initialParams.revealTParam)
        ? initialParams.revealTParam
        : 0,
    blinkElapsedSec: !Number.isNaN(initialParams.blinkTParam) ? initialParams.blinkTParam : 0,
    theThingRevealProgress:
      phase === 'FP_TAPE_RIP_AND_DIALOGUE' ||
      phase === 'FP_STILL_FREDDY_EMERGE_PAUSE' ||
      phase === 'FP_FINAL_GOOD_LUCK_DIALOGUE' ||
      phase === 'FINAL_FADE_TO_NIGHT_5' ||
      phase === 'NO_DOCS_FP_LAUGH_AND_BROTHER_DIALOGUE' ||
      phase === 'NO_DOCS_FP_STILL_FREDDY_EMERGE_PAUSE' ||
      phase === 'NO_DOCS_FP_PAY_FAILURES_DIALOGUE'
        ? 1
        : !Number.isNaN(initialParams.revealTParam)
        ? Math.min(1, initialParams.revealTParam / POST_NIGHT_4_THE_THING_APPROACH_DURATION_SEC)
        : 0,
    tapeRipProgress:
      phase === 'FP_STILL_FREDDY_EMERGE_PAUSE' ||
      phase === 'FP_FINAL_GOOD_LUCK_DIALOGUE' ||
      phase === 'FINAL_FADE_TO_NIGHT_5'
        ? 1
        : 0,
    freddyEmergeProgress:
      phase === 'FP_FINAL_GOOD_LUCK_DIALOGUE' ||
      phase === 'FINAL_FADE_TO_NIGHT_5' ||
      phase === 'NO_DOCS_FP_PAY_FAILURES_DIALOGUE' ||
      phase === 'NO_DOCS_FP_LUNGE_ATTACK'
        ? 1
        : 0,
    documentsHandedOver:
      phase === 'CHAIR_TIED_POST_HANDOVER_DIALOGUE' ||
      phase === 'FP_THE_THING_APPROACH_REVEAL' ||
      phase === 'FP_TAPE_RIP_AND_DIALOGUE' ||
      phase === 'FP_STILL_FREDDY_EMERGE_PAUSE' ||
      phase === 'FP_FINAL_GOOD_LUCK_DIALOGUE' ||
      phase === 'FINAL_FADE_TO_NIGHT_5',
    qteRoundElapsedSec: 0,
    lastQteHitTimeSec: -10,
    keysHeld: {
      left: false,
      right: false,
    },
  });

  // Stop any lingering office animatronic footsteps, office fan, or rain loops on mount/unmount (identical to Night 2 & 3)
  useEffect(() => {
    soundController.stopAll(false, false);
    soundController.stopRainLoop();
    soundController.stopOfficeFanLoop();
    return () => {
      soundController.stopRainLoop();
      soundController.stopOfficeFanLoop();
      soundController.stopPhoneRingSequence();
    };
  }, []);

  // Determine active dialogue tab (using exact Night 2 / Night 3 dialogue structure)
  const activeTab: PostNight1DialogueTab | null = useMemo(() => {
    if (phase === 'HOTEL_RECEPTIONIST_DIALOGUE') {
      const rec =
        HOTEL_RECEPTIONISTS.find((r) => r.id === activeReceptionistId) || HOTEL_RECEPTIONISTS[0];
      return {
        speaker: `RECEPCIONISTA ${rec.id}`,
        speakerColor: '#38bdf8',
        segments: [{ text: rec.dialogueText }],
      };
    }
    if (phase === 'HOTEL_WRONG_ROOM_DIALOGUE') {
      return {
        ...POST_NIGHT_2_WRONG_ROOM_DIALOGUE,
        speaker: PROTAGONIST_NAME_FROM_NIGHT_3,
      };
    }
    if (phase === 'HOTEL_ROOM_BED_PROMPT') {
      return {
        ...POST_NIGHT_2_BED_SLEEP_PROMPT,
        speaker: PROTAGONIST_NAME_FROM_NIGHT_3,
      };
    }
    if (phase === 'CHAIR_TIED_INITIAL_DIALOGUE') {
      return POST_NIGHT_4_CHAIR_INITIAL_DIALOGUE;
    }
    if (phase === 'CHAIR_TIED_POST_HANDOVER_DIALOGUE') {
      return POST_NIGHT_4_CHAIR_POST_HANDOVER_DIALOGUE;
    }
    if (phase === 'FP_TAPE_RIP_AND_DIALOGUE') {
      return POST_NIGHT_4_THE_THING_REVEAL_TABS[revealTabIndex] || null;
    }
    if (phase === 'FP_FINAL_GOOD_LUCK_DIALOGUE') {
      return POST_NIGHT_4_FINAL_GOOD_LUCK_TAB;
    }
    // No-Documents Route Dialogues
    if (phase === 'NO_DOCS_FLOOR_CONFUSED_DIALOGUE') {
      return POST_NIGHT_4_NO_DOCS_CONFUSED_TAB;
    }
    if (phase === 'NO_DOCS_SHADOW_VOICE_DIALOGUE') {
      return POST_NIGHT_4_NO_DOCS_SHADOW_TABS[noDocsTabIndex] || null;
    }
    if (phase === 'NO_DOCS_FP_LAUGH_AND_BROTHER_DIALOGUE') {
      return POST_NIGHT_4_NO_DOCS_BROTHER_TABS[noDocsTabIndex] || null;
    }
    if (phase === 'NO_DOCS_FP_PAY_FAILURES_DIALOGUE') {
      return POST_NIGHT_4_NO_DOCS_PAY_FAILURES_TAB;
    }
    if (phase === 'NO_DOCS_FADE_OUT_SCREAM_DIALOGUE') {
      return POST_NIGHT_4_NO_DOCS_FINAL_SCREAM_TAB;
    }
    return null;
  }, [phase, activeReceptionistId, revealTabIndex, noDocsTabIndex]);

  // Unlock the second Bad Ending black star (positioned above the first Bad Ending star) if player fails the No-Documents Circle QTE and reaches Still Nothing
  useEffect(() => {
    if (phase === 'NO_DOCS_BAD_ENDING_STILL_NOTHING' && !unlockedBadEndingRef.current) {
      unlockedBadEndingRef.current = true;
      onUnlockBadEnding2Ref.current?.();
    }
  }, [phase]);

  const fullDialogueText = useMemo(() => {
    if (!activeTab) return '';
    return activeTab.segments.map((s) => s.text).join('');
  }, [activeTab]);

  // Typewriter effect (identical to EightBitPostNight2Minigame & EightBitPostNight3Minigame)
  useEffect(() => {
    if (!activeTab) {
      setTypedChars(0);
      typedCharsRef.current = 0;
      return;
    }

    const totalLen = fullDialogueText.length;
    if (totalLen === 0) {
      setTypedChars(0);
      typedCharsRef.current = 0;
      return;
    }

    if (initialParams.fullTextParam) {
      setTypedChars(totalLen);
      typedCharsRef.current = totalLen;
      return;
    }

    setTypedChars(0);
    typedCharsRef.current = 0;

    let slowStartIdx = totalLen + 1;
    let running = 0;
    for (const seg of activeTab.segments) {
      if ((seg.slowTremble || seg.fadingText) && slowStartIdx > totalLen) {
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

      const nextChar = fullDialogueText[current] ?? ' ';
      if (nextChar.trim().length > 0 && next % 3 === 1) {
        soundController.playCameraBlip();
      }

      const isSlow = current >= slowStartIdx;
      timerId = window.setTimeout(stepTypewriter, isSlow ? 65 : 22);
    };

    timerId = window.setTimeout(stepTypewriter, 25);
    return () => {
      cancelled = true;
      if (timerId !== null) window.clearTimeout(timerId);
    };
  }, [activeTab, fullDialogueText, initialParams.fullTextParam]);

  // Tremble & glitch animation ticker
  useEffect(() => {
    const id = window.setInterval(() => {
      setTrembleTick((t) => (t + 1) % 10000);
    }, 55);
    return () => window.clearInterval(id);
  }, []);

  const syncHallwayProximities = useCallback((px: number, floor: 1 | 2 | 3) => {
    const camX = getHotelHallwayCameraX(px);
    setHallwayCameraX((prev) => (Math.abs(prev - camX) >= 0.5 ? camX : prev));
    const rec = floor === 1 ? getNearbyReceptionist(px) : null;
    setNearbyReceptionistId(rec ? rec.id : null);
    setNearElevatorDown(floor > 1 && isNearElevatorDown(px));
    setNearElevatorUp(floor < 3 && isNearElevatorUp(px));
    const room = getNearbyHotelHallwayRoom(floor, px);
    setNearbyHallwayRoom((prev) =>
      prev?.roomNumber !== room?.roomNumber ? room : prev
    );
    setNearHallwayExitDoor(floor === 1 && isNearHotelHallwayExitDoor(px));
  }, []);

  const syncRoomProximities = useCallback((px: number) => {
    setNearLightSwitch(isNearHotelLightSwitch(px));
    setNearBed(isNearHotelBed(px));
  }, []);

  // Interaction actions ([E]) — 100% identical to EightBitPostNight2Minigame & EightBitPostNight3Minigame
  const handleEnterHotelFromOutside = useCallback(() => {
    if (phaseRef.current !== 'HOTEL_EXTERIOR_WALK') return;
    if (!isNearHotelExteriorDoor(simRef.current.playerX)) return;
    soundController.playDoorSlam(true);
    simRef.current.keysHeld.left = false;
    simRef.current.keysHeld.right = false;
    simRef.current.fadeAlpha = 0;
    phaseRef.current = 'HOTEL_EXTERIOR_ENTERING_FADE';
    setPhase('HOTEL_EXTERIOR_ENTERING_FADE');
  }, []);

  const handleExitHotelToOutside = useCallback(() => {
    if (phaseRef.current !== 'HOTEL_HALLWAY' || currentFloorRef.current !== 1) return;
    if (!isNearHotelHallwayExitDoor(simRef.current.playerX)) return;
    soundController.playDoorSlam(true);
    simRef.current.keysHeld.left = false;
    simRef.current.keysHeld.right = false;
    simRef.current.playerX = HOTEL_EXTERIOR_DOOR_X;
    setNearExteriorDoor(isNearHotelExteriorDoor(HOTEL_EXTERIOR_DOOR_X));
    phaseRef.current = 'HOTEL_EXTERIOR_WALK';
    setPhase('HOTEL_EXTERIOR_WALK');
  }, []);

  const handleInteractReceptionist = useCallback((recId?: number) => {
    if (phaseRef.current !== 'HOTEL_HALLWAY' || currentFloorRef.current !== 1) return;
    const targetRec =
      recId !== undefined
        ? HOTEL_RECEPTIONISTS.find((r) => r.id === recId) || null
        : getNearbyReceptionist(simRef.current.playerX);
    if (!targetRec) return;
    soundController.playCameraBlip();
    simRef.current.keysHeld.left = false;
    simRef.current.keysHeld.right = false;
    setActiveReceptionistId(targetRec.id);
    phaseRef.current = 'HOTEL_RECEPTIONIST_DIALOGUE';
    setPhase('HOTEL_RECEPTIONIST_DIALOGUE');
  }, []);

  const handleUseElevatorUp = useCallback(() => {
    if (phaseRef.current !== 'HOTEL_HALLWAY') return;
    const floor = currentFloorRef.current;
    if (floor >= 3 || !isNearElevatorUp(simRef.current.playerX)) return;
    soundController.playCameraBlip();
    simRef.current.keysHeld.left = false;
    simRef.current.keysHeld.right = false;
    const nextFloor = (floor + 1) as 2 | 3;
    simRef.current.elevatorTargetFloor = nextFloor;
    simRef.current.elevatorFadeStage = 'FADE_OUT';
    simRef.current.fadeAlpha = 0;
    phaseRef.current = 'HOTEL_ELEVATOR_FADE';
    setPhase('HOTEL_ELEVATOR_FADE');
  }, []);

  const handleUseElevatorDown = useCallback(() => {
    if (phaseRef.current !== 'HOTEL_HALLWAY') return;
    const floor = currentFloorRef.current;
    if (floor <= 1 || !isNearElevatorDown(simRef.current.playerX)) return;
    soundController.playCameraBlip();
    simRef.current.keysHeld.left = false;
    simRef.current.keysHeld.right = false;
    const nextFloor = (floor - 1) as 1 | 2;
    simRef.current.elevatorTargetFloor = nextFloor;
    simRef.current.elevatorFadeStage = 'FADE_OUT';
    simRef.current.fadeAlpha = 0;
    phaseRef.current = 'HOTEL_ELEVATOR_FADE';
    setPhase('HOTEL_ELEVATOR_FADE');
  }, []);

  const handleEnterRoom303 = useCallback(() => {
    if (phaseRef.current !== 'HOTEL_HALLWAY' || currentFloorRef.current !== 3) return;
    const room = getNearbyHotelHallwayRoom(3, simRef.current.playerX);
    if (!room || !room.isPlayerRoom) return;
    soundController.playDoorSlam(true);
    simRef.current.keysHeld.left = false;
    simRef.current.keysHeld.right = false;
    simRef.current.playerX = HOTEL_CENTRAL_DOOR_X;
    simRef.current.playerFacing = -1;
    syncRoomProximities(HOTEL_CENTRAL_DOOR_X);
    phaseRef.current = 'HOTEL_ROOM_FREE_ROAM';
    setPhase('HOTEL_ROOM_FREE_ROAM');
  }, [syncRoomProximities]);

  const handleTryWrongRoomDoor = useCallback(() => {
    if (phaseRef.current !== 'HOTEL_HALLWAY') return;
    const room = getNearbyHotelHallwayRoom(currentFloorRef.current, simRef.current.playerX);
    if (!room || room.isPlayerRoom) return;
    soundController.playLockedDoorRattle();
    simRef.current.keysHeld.left = false;
    simRef.current.keysHeld.right = false;
    phaseRef.current = 'HOTEL_WRONG_ROOM_DIALOGUE';
    setPhase('HOTEL_WRONG_ROOM_DIALOGUE');
  }, []);

  const handleToggleRoomLight = useCallback(() => {
    if (phaseRef.current !== 'HOTEL_ROOM_FREE_ROAM') return;
    if (!isNearHotelLightSwitch(simRef.current.playerX)) return;
    soundController.playWoodClick();
    setRoomLightOn((prev) => {
      const next = !prev;
      roomLightOnRef.current = next;
      return next;
    });
  }, []);

  const handleInteractBed = useCallback(() => {
    if (phaseRef.current !== 'HOTEL_ROOM_FREE_ROAM') return;
    if (!isNearHotelBed(simRef.current.playerX)) return;
    soundController.playCameraBlip();
    simRef.current.keysHeld.left = false;
    simRef.current.keysHeld.right = false;
    setSelectedChoice('SI');
    selectedChoiceRef.current = 'SI';
    phaseRef.current = 'HOTEL_ROOM_BED_PROMPT';
    setPhase('HOTEL_ROOM_BED_PROMPT');
  }, []);

  const handleChooseSleepYes = useCallback(() => {
    if (phaseRef.current !== 'HOTEL_ROOM_BED_PROMPT') return;
    soundController.playWoodClick();
    simRef.current.keysHeld.left = false;
    simRef.current.keysHeld.right = false;

    if (roomLightOnRef.current) {
      simRef.current.turnOffLightStage = 'TO_SWITCH';
      simRef.current.switchPauseSec = 0;
      phaseRef.current = 'HOTEL_ROOM_TURN_OFF_LIGHTS_WALK';
      setPhase('HOTEL_ROOM_TURN_OFF_LIGHTS_WALK');
    } else {
      simRef.current.turnOffLightStage = 'LIE_DOWN_FADE';
      simRef.current.fadeAlpha = 0;
      phaseRef.current = 'HOTEL_ROOM_TURN_OFF_LIGHTS_WALK';
      setPhase('HOTEL_ROOM_TURN_OFF_LIGHTS_WALK');
    }
  }, []);

  const handleChooseSleepNo = useCallback(() => {
    if (phaseRef.current !== 'HOTEL_ROOM_BED_PROMPT') return;
    soundController.playWoodClick();
    phaseRef.current = 'HOTEL_ROOM_FREE_ROAM';
    setPhase('HOTEL_ROOM_FREE_ROAM');
  }, []);

  const handleHandOverDocuments = useCallback(() => {
    if (phaseRef.current !== 'CHAIR_TIED_HAND_OVER_PROMPT') return;
    soundController.playCameraBlip();
    simRef.current.phaseTimerSec = 0;
    phaseRef.current = 'CHAIR_TIED_HANDING_OVER_ANIM';
    setPhase('CHAIR_TIED_HANDING_OVER_ANIM');
  }, []);

  const handleAdvanceDialogue = useCallback(() => {
    const currentPhase = phaseRef.current;
    if (!activeTab) return;

    if (typedCharsRef.current < fullDialogueText.length) {
      typedCharsRef.current = fullDialogueText.length;
      setTypedChars(fullDialogueText.length);
      return;
    }

    if (currentPhase === 'HOTEL_ROOM_BED_PROMPT') {
      if (selectedChoiceRef.current === 'SI') {
        handleChooseSleepYes();
      } else {
        handleChooseSleepNo();
      }
      return;
    }

    soundController.playCameraBlip();

    if (
      currentPhase === 'HOTEL_RECEPTIONIST_DIALOGUE' ||
      currentPhase === 'HOTEL_WRONG_ROOM_DIALOGUE'
    ) {
      phaseRef.current = 'HOTEL_HALLWAY';
      setPhase('HOTEL_HALLWAY');
      return;
    }

    if (currentPhase === 'CHAIR_TIED_INITIAL_DIALOGUE') {
      phaseRef.current = 'CHAIR_TIED_HAND_OVER_PROMPT';
      setPhase('CHAIR_TIED_HAND_OVER_PROMPT');
      return;
    }

    if (currentPhase === 'CHAIR_TIED_POST_HANDOVER_DIALOGUE') {
      simRef.current.phaseTimerSec = 0;
      simRef.current.theThingRevealProgress = 0;
      soundController.playPhaseShift3AM();
      phaseRef.current = 'FP_THE_THING_APPROACH_REVEAL';
      setPhase('FP_THE_THING_APPROACH_REVEAL');
      return;
    }

    if (currentPhase === 'FP_TAPE_RIP_AND_DIALOGUE') {
      const nextIdx = revealTabIndexRef.current + 1;
      if (nextIdx < POST_NIGHT_4_THE_THING_REVEAL_TABS.length) {
        revealTabIndexRef.current = nextIdx;
        setRevealTabIndex(nextIdx);
      } else {
        // After "¿Verdad que sí, hermano?" -> Still Freddy emerges from the shadows + 1s pause!
        simRef.current.phaseTimerSec = 0;
        simRef.current.freddyEmergeProgress = 0;
        phaseRef.current = 'FP_STILL_FREDDY_EMERGE_PAUSE';
        setPhase('FP_STILL_FREDDY_EMERGE_PAUSE');
      }
      return;
    }

    if (currentPhase === 'FP_FINAL_GOOD_LUCK_DIALOGUE') {
      simRef.current.phaseTimerSec = 0;
      simRef.current.fadeAlpha = 0;
      phaseRef.current = 'FINAL_FADE_TO_NIGHT_5';
      setPhase('FINAL_FADE_TO_NIGHT_5');
      return;
    }

    // --- NO-DOCUMENTS ROUTE DIALOGUE TRANSITIONS ---
    if (currentPhase === 'NO_DOCS_FLOOR_CONFUSED_DIALOGUE') {
      noDocsTabIndexRef.current = 0;
      setNoDocsTabIndex(0);
      phaseRef.current = 'NO_DOCS_SHADOW_VOICE_DIALOGUE';
      setPhase('NO_DOCS_SHADOW_VOICE_DIALOGUE');
      return;
    }

    if (currentPhase === 'NO_DOCS_SHADOW_VOICE_DIALOGUE') {
      const nextIdx = noDocsTabIndexRef.current + 1;
      if (nextIdx < POST_NIGHT_4_NO_DOCS_SHADOW_TABS.length) {
        noDocsTabIndexRef.current = nextIdx;
        setNoDocsTabIndex(nextIdx);
      } else {
        simRef.current.phaseTimerSec = 0;
        simRef.current.theThingRevealProgress = 0;
        soundController.playPhaseShift3AM();
        phaseRef.current = 'NO_DOCS_FP_THE_THING_REVEAL';
        setPhase('NO_DOCS_FP_THE_THING_REVEAL');
      }
      return;
    }

    if (currentPhase === 'NO_DOCS_FP_LAUGH_AND_BROTHER_DIALOGUE') {
      const nextIdx = noDocsTabIndexRef.current + 1;
      if (nextIdx < POST_NIGHT_4_NO_DOCS_BROTHER_TABS.length) {
        noDocsTabIndexRef.current = nextIdx;
        setNoDocsTabIndex(nextIdx);
      } else {
        // Reuses the exact Demacrado Still Freddy emergence beside The Thing + 1s pause
        simRef.current.phaseTimerSec = 0;
        simRef.current.freddyEmergeProgress = 0;
        phaseRef.current = 'NO_DOCS_FP_STILL_FREDDY_EMERGE_PAUSE';
        setPhase('NO_DOCS_FP_STILL_FREDDY_EMERGE_PAUSE');
      }
      return;
    }

    if (currentPhase === 'NO_DOCS_FP_PAY_FAILURES_DIALOGUE') {
      simRef.current.phaseTimerSec = 0;
      soundController.playDoorSlam(true);
      phaseRef.current = 'NO_DOCS_FP_LUNGE_ATTACK';
      setPhase('NO_DOCS_FP_LUNGE_ATTACK');
      return;
    }

    if (currentPhase === 'NO_DOCS_FADE_OUT_SCREAM_DIALOGUE') {
      if (!completedRef.current) {
        completedRef.current = true;
        phaseRef.current = 'COMPLETED';
        setPhase('COMPLETED');
        onComplete();
      }
      return;
    }
  }, [activeTab, fullDialogueText.length, handleChooseSleepNo, handleChooseSleepYes, onComplete]);

  // Press [E] during the Shrinking Circle QTE in the No-Documents route
  const handleCircleQtePressE = useCallback(() => {
    if (phaseRef.current !== 'NO_DOCS_FP_CIRCLE_QTE') return;
    const outcome = evaluatePostNight4CircleQtePress(circleQteRingScaleRef.current);

    if (outcome === 'HIT') {
      const nextHits = circleQteHitsRef.current + 1;
      circleQteHitsRef.current = nextHits;
      setCircleQteHits(nextHits);
      simRef.current.lastQteHitTimeSec = simRef.current.phaseTimerSec;

      if (nextHits < POST_NIGHT_4_CIRCLE_QTE_REQUIRED_HITS) {
        // Hits 1 & 2: First-person hand shove + reset closing circle for next round
        soundController.playDoorKnock();
        simRef.current.qteRoundElapsedSec = 0;
        circleQteRingScaleRef.current = POST_NIGHT_4_CIRCLE_QTE_START_SCALE;
        setCircleQteRingScale(POST_NIGHT_4_CIRCLE_QTE_START_SCALE);
        setCircleQteInZone(false);
      } else {
        // Hit 3: Kick impact knocking The Thing back -> Fade to black with "PAGARAS POR TOOOOOOOOOOOODO" -> Night 5
        soundController.playDoorSlam(true);
        simRef.current.phaseTimerSec = 0;
        phaseRef.current = 'NO_DOCS_FP_KICK_IMPACT';
        setPhase('NO_DOCS_FP_KICK_IMPACT');
      }
    } else {
      // Missed circle timing -> Jumpscare -> Bad Ending
      soundController.playJumpscare();
      simRef.current.phaseTimerSec = 0;
      phaseRef.current = 'NO_DOCS_FP_FAIL_JUMPSCARE';
      setPhase('NO_DOCS_FP_FAIL_JUMPSCARE');
    }
  }, []);

  // Click anywhere after "BAD ENDING" appears to fade to black and return to Main Menu
  const handleBadEndingScreenClick = useCallback(() => {
    if (phaseRef.current !== 'NO_DOCS_BAD_ENDING_STILL_NOTHING') return;
    if (simRef.current.phaseTimerSec < BAD_ENDING_TITLE_DELAY_SEC + 0.5) return;
    soundController.playWoodClick();
    simRef.current.phaseTimerSec = 0;
    simRef.current.fadeAlpha = 0;
    phaseRef.current = 'NO_DOCS_BAD_ENDING_FADE_OUT';
    setPhase('NO_DOCS_BAD_ENDING_FADE_OUT');
  }, []);

  // Keyboard listener (matching EightBitPostNight2Minigame & EightBitPostNight3Minigame)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const currentPhase = phaseRef.current;

      if (currentPhase === 'NO_DOCS_FP_CIRCLE_QTE') {
        if ((e.key === 'e' || e.key === 'E' || e.code === 'KeyE') && !e.repeat) {
          e.preventDefault();
          handleCircleQtePressE();
        }
        return;
      }

      if (currentPhase === 'NO_DOCS_BAD_ENDING_STILL_NOTHING') {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          handleBadEndingScreenClick();
        }
        return;
      }

      if (currentPhase === 'HOTEL_ROOM_BED_PROMPT') {
        if (typedCharsRef.current < fullDialogueText.length) {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleAdvanceDialogue();
          }
          return;
        }
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
          e.preventDefault();
          setSelectedChoice('SI');
          selectedChoiceRef.current = 'SI';
          soundController.playCameraBlip();
          return;
        }
        if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
          e.preventDefault();
          setSelectedChoice('NO');
          selectedChoiceRef.current = 'NO';
          soundController.playCameraBlip();
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          if (selectedChoiceRef.current === 'SI') {
            handleChooseSleepYes();
          } else {
            handleChooseSleepNo();
          }
          return;
        }
        return;
      }

      if (e.key === 'Enter') {
        if (activeTab) {
          e.preventDefault();
          handleAdvanceDialogue();
          return;
        }
      }

      if (e.key === 'e' || e.key === 'E') {
        if (currentPhase === 'CHAIR_TIED_HAND_OVER_PROMPT') {
          e.preventDefault();
          handleHandOverDocuments();
          return;
        }
        if (currentPhase === 'HOTEL_EXTERIOR_WALK') {
          if (isNearHotelExteriorDoor(simRef.current.playerX)) {
            e.preventDefault();
            handleEnterHotelFromOutside();
          }
          return;
        }
        if (currentPhase === 'HOTEL_HALLWAY') {
          const floor = currentFloorRef.current;
          const px = simRef.current.playerX;
          if (floor === 1 && isNearHotelHallwayExitDoor(px)) {
            e.preventDefault();
            handleExitHotelToOutside();
            return;
          }
          if (floor === 1 && getNearbyReceptionist(px)) {
            e.preventDefault();
            handleInteractReceptionist();
            return;
          }
          if (floor < 3 && isNearElevatorUp(px)) {
            e.preventDefault();
            handleUseElevatorUp();
            return;
          }
          if (floor > 1 && isNearElevatorDown(px)) {
            e.preventDefault();
            handleUseElevatorDown();
            return;
          }
          const room = getNearbyHotelHallwayRoom(floor, px);
          if (room) {
            e.preventDefault();
            if (room.isPlayerRoom) {
              handleEnterRoom303();
            } else {
              handleTryWrongRoomDoor();
            }
            return;
          }
          return;
        }
        if (currentPhase === 'HOTEL_ROOM_FREE_ROAM') {
          const px = simRef.current.playerX;
          if (isNearHotelLightSwitch(px)) {
            e.preventDefault();
            handleToggleRoomLight();
            return;
          }
          if (isNearHotelBed(px)) {
            e.preventDefault();
            handleInteractBed();
            return;
          }
          return;
        }
      }

      if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') {
        simRef.current.keysHeld.right = true;
      }
      if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') {
        simRef.current.keysHeld.left = true;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') {
        simRef.current.keysHeld.right = false;
      }
      if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') {
        simRef.current.keysHeld.left = false;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [
    activeTab,
    fullDialogueText.length,
    handleAdvanceDialogue,
    handleBadEndingScreenClick,
    handleChooseSleepNo,
    handleChooseSleepYes,
    handleCircleQtePressE,
    handleEnterHotelFromOutside,
    handleEnterRoom303,
    handleExitHotelToOutside,
    handleHandOverDocuments,
    handleInteractBed,
    handleInteractReceptionist,
    handleToggleRoomLight,
    handleTryWrongRoomDoor,
    handleUseElevatorDown,
    handleUseElevatorUp,
  ]);

  // Main 60fps 8-Bit Simulation & Canvas Render Loop
  useEffect(() => {
    let raf = 0;
    let lastTime = performance.now();

    // 100% IDENTICAL 4x4 8-BIT PIXEL GRID QUANTIZATION AS NIGHTS 1, 2, AND 3
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

    // 100% IDENTICAL 8-BIT PINE TREE AS NIGHTS 2 & 3
    const draw8BitPineTree = (
      ctx: CanvasRenderingContext2D,
      cx: number,
      baseY: number,
      scale = 1
    ) => {
      const s = 4 * scale;
      drawPixelRect(ctx, cx - s, baseY - s * 5, s * 2, s * 5, '#29170b');
      drawPixelRect(ctx, cx - s * 5, baseY - s * 10, s * 10, s * 5, '#0c291b');
      drawPixelRect(ctx, cx - s * 4, baseY - s * 15, s * 8, s * 5, '#133825');
      drawPixelRect(ctx, cx - s * 2, baseY - s * 19, s * 4, s * 4, '#1b4730');
    };

    // 100% IDENTICAL PROTAGONIST SPRITE & 4-FRAME WALKING ANIMATION AS NIGHTS 2 & 3
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

      // Left Leg & Animated Shoe (32px leg assembly)
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
      if (isThinking) {
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

      // Head (24x24) & Hair/Cap (total height ~96px)
      const headBob = isThinking ? (Math.floor(timeSec * 4) % 2) * 2 : bodyBobY;
      drawPixelRect(ctx, x - 12, groundY - 92 + headBob, 24, 24, '#fcd34d');
      drawPixelRect(ctx, x - 14, groundY - 96 + headBob, 28, 8, '#451a03');
      if (facing >= 0) {
        drawPixelRect(ctx, x + 4, groundY - 82 + headBob, 4, 4, '#09090b');
      } else {
        drawPixelRect(ctx, x - 8, groundY - 82 + headBob, 4, 4, '#09090b');
      }
    };

    // 100% IDENTICAL RECEPTIONIST SPRITE AS NIGHTS 2 & 3
    const draw8BitReceptionist = (
      ctx: CanvasRenderingContext2D,
      x: number,
      counterTopY: number,
      variant: 1 | 2
    ) => {
      drawPixelRect(ctx, x - 14, counterTopY - 36, 28, 36, variant === 1 ? '#7f1d1d' : '#1e3a8a');
      drawPixelRect(ctx, x - 4, counterTopY - 34, 8, 28, '#f8fafc');
      drawPixelRect(ctx, x - 2, counterTopY - 30, 4, 16, '#eab308');
      drawPixelRect(ctx, x - 12, counterTopY - 60, 24, 24, variant === 1 ? '#fde68a' : '#fed7aa');
      drawPixelRect(ctx, x - 14, counterTopY - 66, 28, 8, variant === 1 ? '#991b1b' : '#271509');
      drawPixelRect(ctx, x - 10, counterTopY - 62, 20, 4, '#eab308');
      drawPixelRect(ctx, x - 6, counterTopY - 50, 4, 4, '#09090b');
      drawPixelRect(ctx, x + 2, counterTopY - 50, 4, 4, '#09090b');
    };

    // 100% IDENTICAL HOTEL EXTERIOR SCENE AS NIGHT 2
    const drawHotelExteriorScene = (
      ctx: CanvasRenderingContext2D,
      W: number,
      H: number,
      timeSec: number,
      playerX: number,
      playerFacing: -1 | 1,
      walkCycle: number,
      isWalking: boolean
    ) => {
      ctx.fillStyle = '#070b16';
      ctx.fillRect(0, 0, W, H);

      drawPixelRect(ctx, 40, 24, 4, 4, '#cbd5e1');
      drawPixelRect(ctx, 910, 32, 4, 4, '#e2e8f0');

      const groundY = 424;

      draw8BitPineTree(ctx, 36, groundY, 1.25);
      draw8BitPineTree(ctx, 924, groundY, 1.25);

      drawPixelRect(ctx, 0, groundY, W, H - groundY, '#111827');
      drawPixelRect(ctx, 0, groundY, W, 28, '#334155');
      drawPixelRect(ctx, 0, groundY + 24, W, 4, '#64748b');

      const hx = 72;
      const hw = 816;
      const hh = 378;
      const hy = groundY - hh; // y = 46

      drawPixelRect(ctx, hx - 16, hy - 16, hw + 32, 16, '#ca8a04');
      drawPixelRect(ctx, hx - 12, hy - 12, hw + 24, 8, '#fef08a');

      drawPixelRect(ctx, hx, hy, hw, hh, '#d6c79c');
      drawPixelRect(ctx, hx + 8, hy + 8, hw - 16, hh - 8, '#f5f0e1');

      const pilasters = [hx + 12, 240, 384, 576, 720, hx + hw - 28];
      for (const px of pilasters) {
        drawPixelRect(ctx, px, hy + 8, 16, hh - 8, '#e5dcc2');
      }

      drawPixelRect(ctx, hx - 6, hy + 126, hw + 12, 10, '#ca8a04');
      drawPixelRect(ctx, hx - 4, hy + 128, hw + 8, 4, '#fef08a');
      drawPixelRect(ctx, hx - 6, hy + 252, hw + 12, 10, '#ca8a04');
      drawPixelRect(ctx, hx - 4, hy + 254, hw + 8, 4, '#fef08a');

      drawPixelRect(ctx, 376, 4, 208, 28, '#1e1b4b');
      drawPixelRect(ctx, 380, 8, 200, 20, '#eab308');
      ctx.fillStyle = '#09090b';
      ctx.font = 'bold 16px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('★ HOTEL ★', 480, 23);

      const winCols = [116, 180, 280, 628, 756, 820];
      for (let f = 0; f < 3; f++) {
        const wy = hy + 24 + f * 126;
        for (const wx of winCols) {
          drawPixelRect(ctx, wx - 4, wy - 4, 52, 76, '#78350f');
          const isLit = (f + wx) % 3 !== 0;
          drawPixelRect(ctx, wx, wy, 44, 68, isLit ? '#fef08a' : '#1e293b');
          drawPixelRect(ctx, wx + 20, wy, 4, 68, '#78350f');
          drawPixelRect(ctx, wx, wy + 32, 44, 4, '#78350f');
          drawPixelRect(ctx, wx - 8, wy + 68, 60, 6, '#ca8a04');
        }
      }

      const centerCols = [416, 496];
      for (let f = 0; f < 2; f++) {
        const wy = hy + 24 + f * 126;
        for (const wx of centerCols) {
          drawPixelRect(ctx, wx - 4, wy - 4, 56, 76, '#78350f');
          drawPixelRect(ctx, wx, wy, 48, 68, '#fef08a');
          drawPixelRect(ctx, wx + 22, wy, 4, 68, '#78350f');
          drawPixelRect(ctx, wx, wy + 32, 48, 4, '#78350f');
          drawPixelRect(ctx, wx - 8, wy + 68, 64, 6, '#ca8a04');
        }
      }

      const doorW = 92;
      const doorH = 116;
      const doorX = HOTEL_EXTERIOR_DOOR_X - doorW / 2;
      const doorY = groundY - doorH;
      drawPixelRect(ctx, doorX - 28, doorY - 24, doorW + 56, 20, '#991b1b');
      drawPixelRect(ctx, doorX - 24, doorY - 8, doorW + 48, 6, '#eab308');
      drawPixelRect(ctx, doorX - 6, doorY - 4, doorW + 12, doorH + 4, '#ca8a04');
      drawPixelRect(ctx, doorX, doorY, doorW, doorH, '#451a03');
      drawPixelRect(ctx, doorX + 8, doorY + 10, 32, doorH - 20, '#fef08a');
      drawPixelRect(ctx, doorX + 52, doorY + 10, 32, doorH - 20, '#fef08a');
      drawPixelRect(ctx, doorX + 44, doorY, 4, doorH, '#ca8a04');
      drawPixelRect(ctx, doorX + 36, doorY + 60, 6, 10, '#fde047');
      drawPixelRect(ctx, doorX + 50, doorY + 60, 6, 10, '#fde047');

      ctx.fillStyle = 'rgba(254, 240, 138, 0.20)';
      ctx.fillRect(doorX - 20, groundY, doorW + 40, 22);

      draw8BitProtagonist(
        ctx,
        playerX,
        groundY + 10,
        playerFacing,
        walkCycle,
        isWalking,
        false,
        timeSec
      );
    };

    // 100% IDENTICAL HOTEL HALLWAY SCENE AS NIGHTS 2 & 3
    const drawHotelHallwayScene = (
      ctx: CanvasRenderingContext2D,
      W: number,
      H: number,
      timeSec: number,
      floor: 1 | 2 | 3,
      playerX: number,
      playerFacing: -1 | 1,
      walkCycle: number,
      isWalking: boolean
    ) => {
      const camX = getHotelHallwayCameraX(playerX);
      const hallLeft = 48;
      const hallRight = HOTEL_HALLWAY_WORLD_WIDTH - 48; // 1712
      const hallTop = 72;
      const floorY = 384;
      const hallW = hallRight - hallLeft;
      const hallH = floorY - hallTop;

      ctx.fillStyle = '#030408';
      ctx.fillRect(0, 0, W, H);

      ctx.save();
      ctx.translate(-Math.round(camX), 0);

      drawPixelRect(ctx, hallLeft - 8, hallTop - 8, hallW + 16, hallH + 64, '#d6c79c');
      drawPixelRect(ctx, hallLeft - 4, hallTop - 4, hallW + 8, hallH + 56, '#fef9c3');

      drawPixelRect(ctx, hallLeft, hallTop, hallW, hallH, '#f5f0e1');
      for (let wx = hallLeft + 12; wx < hallRight - 8; wx += 28) {
        drawPixelRect(ctx, wx, hallTop + 12, 8, hallH - 76, '#ede3c8');
      }
      drawPixelRect(ctx, hallLeft, hallTop, hallW, 12, '#eab308');
      drawPixelRect(ctx, hallLeft, floorY - 68, hallW, 68, '#faf8f5');
      drawPixelRect(ctx, hallLeft, floorY - 72, hallW, 6, '#eab308');

      drawPixelRect(ctx, hallLeft, floorY, hallW, 48, '#78350f');
      drawPixelRect(ctx, hallLeft, floorY + 8, hallW, 32, '#991b1b');
      drawPixelRect(ctx, hallLeft, floorY + 8, hallW, 4, '#eab308');
      drawPixelRect(ctx, hallLeft, floorY + 36, hallW, 4, '#eab308');

      if (floor === 1) {
        const exitDoorW = 68;
        const exitDoorH = 116;
        const exitDoorX = HOTEL_HALLWAY_EXIT_DOOR_X - exitDoorW / 2;
        const exitDoorY = floorY - exitDoorH;
        drawPixelRect(ctx, exitDoorX - 6, exitDoorY - 6, exitDoorW + 12, exitDoorH + 6, '#eab308');
        drawPixelRect(ctx, exitDoorX, exitDoorY, exitDoorW, exitDoorH, '#451a03');
        drawPixelRect(ctx, exitDoorX + 10, exitDoorY + 12, exitDoorW - 20, 52, '#fef08a');
        drawPixelRect(ctx, exitDoorX + 18, exitDoorY - 22, 32, 12, '#166534');
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px "IBM Plex Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('EXIT', exitDoorX + 34, exitDoorY - 13);

        const counterX = 240;
        const counterW = 200;
        const counterTopY = floorY - 56;

        drawPixelRect(ctx, counterX + 12, hallTop + 72, counterW - 24, 72, '#451a03');
        drawPixelRect(ctx, counterX + 16, hallTop + 76, counterW - 32, 64, '#5c2d10');
        for (let kx = counterX + 28; kx < counterX + counterW - 24; kx += 24) {
          drawPixelRect(ctx, kx, hallTop + 90, 6, 10, '#fde047');
          drawPixelRect(ctx, kx, hallTop + 114, 6, 10, '#fde047');
        }

        draw8BitReceptionist(ctx, HOTEL_RECEPTIONISTS[0].x, counterTopY, 1);
        draw8BitReceptionist(ctx, HOTEL_RECEPTIONISTS[1].x, counterTopY, 2);

        drawPixelRect(ctx, counterX - 4, counterTopY, counterW + 8, 8, '#eab308');
        drawPixelRect(ctx, counterX, counterTopY + 8, counterW, 48, '#5c2d10');
        drawPixelRect(ctx, counterX + 8, counterTopY + 14, counterW - 16, 36, '#78350f');
        drawPixelRect(ctx, counterX + 94, counterTopY - 6, 12, 6, '#fde047');
      }

      const rooms = getHotelFloorRooms(floor);
      for (const room of rooms) {
        const dw = 68;
        const dh = 116;
        const dx = room.x - dw / 2;
        const dy = floorY - dh;

        drawPixelRect(ctx, dx - 6, dy - 6, dw + 12, dh + 6, '#ffffff');
        drawPixelRect(ctx, dx - 4, dy - 4, dw + 8, dh + 4, '#eab308');
        drawPixelRect(ctx, dx, dy, dw, dh, '#78350f');
        drawPixelRect(ctx, dx + 6, dy + 6, dw - 12, dh - 12, '#92400e');
        drawPixelRect(ctx, dx + 12, dy + 12, dw - 24, 38, '#5c2d10');
        drawPixelRect(ctx, dx + 12, dy + 60, dw - 24, 42, '#5c2d10');
        drawPixelRect(ctx, dx + dw - 14, dy + 56, 6, 6, '#fde047');

        drawPixelRect(ctx, room.x - 20, dy - 26, 40, 18, '#18181b');
        drawPixelRect(ctx, room.x - 18, dy - 24, 36, 14, '#27272a');
        ctx.fillStyle = '#fde047';
        ctx.font = 'bold 11px "IBM Plex Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(room.roomNumber, room.x, dy - 13);
      }

      const elevators = [
        { x: HOTEL_ELEVATOR_DOWN_X, arrow: '▼', label: 'BAJAR' },
        { x: HOTEL_ELEVATOR_UP_X, arrow: '▲', label: 'SUBIR' },
      ];

      for (const elev of elevators) {
        const ew = 64;
        const eh = 122;
        const ex = elev.x - ew / 2;
        const ey = floorY - eh;

        drawPixelRect(ctx, ex - 6, ey - 8, ew + 12, eh + 8, '#475569');
        drawPixelRect(ctx, ex - 4, ey - 4, ew + 8, eh + 4, '#94a3b8');
        drawPixelRect(ctx, ex, ey, ew, eh, '#cbd5e1');
        drawPixelRect(ctx, ex + 4, ey + 4, ew / 2 - 6, eh - 8, '#94a3b8');
        drawPixelRect(ctx, ex + ew / 2 + 2, ey + 4, ew / 2 - 6, eh - 8, '#94a3b8');
        drawPixelRect(ctx, ex + 8, ey + 10, 6, eh - 20, '#e2e8f0');
        drawPixelRect(ctx, ex + ew / 2 + 6, ey + 10, 6, eh - 20, '#e2e8f0');
        drawPixelRect(ctx, elev.x - 2, ey, 4, eh, '#334155');

        drawPixelRect(ctx, elev.x - 22, ey - 28, 44, 18, '#09090b');
        drawPixelRect(ctx, elev.x - 20, ey - 26, 40, 14, '#1e293b');
        ctx.fillStyle = elev.arrow === '▼' ? '#38bdf8' : '#4ade80';
        ctx.font = 'bold 11px "IBM Plex Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${elev.arrow} P${floor}`, elev.x, ey - 15);
      }

      draw8BitProtagonist(
        ctx,
        playerX,
        floorY + 8,
        playerFacing,
        walkCycle,
        isWalking,
        false,
        timeSec
      );

      const lampPositions = [260, 560, 860, 1160, 1460];
      for (const lx of lampPositions) {
        drawPixelRect(ctx, lx - 16, hallTop, 32, 10, '#ca8a04');
        drawPixelRect(ctx, lx - 12, hallTop + 10, 24, 6, '#fef08a');
      }

      ctx.fillStyle = 'rgba(254, 240, 138, 0.10)';
      ctx.fillRect(hallLeft, hallTop + 16, hallW, hallH);

      ctx.restore();

      drawPixelRect(ctx, 76, hallTop + 18, 116, 28, '#1e1b4b');
      drawPixelRect(ctx, 80, hallTop + 22, 108, 20, '#271509');
      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 13px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`PLANTA ${floor}`, 134, hallTop + 37);
    };

    // 100% IDENTICAL HOTEL ROOM 303 SCENE AS NIGHTS 2 & 3 (INCLUDING BEDSIDE RADIAL LIGHT!)
    const drawHotelRoomScene = (
      ctx: CanvasRenderingContext2D,
      W: number,
      H: number,
      timeSec: number,
      playerX: number,
      playerFacing: -1 | 1,
      walkCycle: number,
      isWalking: boolean,
      ceilingLightOn: boolean
    ) => {
      const roomLeft = 140;
      const roomRight = 820;
      const roomTop = 64;
      const floorY = 380;
      const roomW = roomRight - roomLeft;
      const roomH = floorY - roomTop;

      ctx.fillStyle = '#030408';
      ctx.fillRect(0, 0, W, H);

      drawPixelRect(ctx, roomLeft - 8, roomTop - 8, roomW + 16, roomH + 64, '#d6c79c');
      drawPixelRect(ctx, roomLeft - 4, roomTop - 4, roomW + 8, roomH + 56, '#fef9c3');

      drawPixelRect(ctx, roomLeft, roomTop, roomW, roomH, '#f5f0e1');
      for (let wx = roomLeft + 12; wx < roomRight - 8; wx += 24) {
        drawPixelRect(ctx, wx, roomTop + 12, 8, roomH - 80, '#ede3c8');
      }

      drawPixelRect(ctx, roomLeft, roomTop, roomW, 10, '#eab308');
      drawPixelRect(ctx, roomLeft, roomTop + 10, roomW, 4, '#fef08a');

      drawPixelRect(ctx, roomLeft, floorY - 72, roomW, 72, '#faf8f5');
      drawPixelRect(ctx, roomLeft, floorY - 76, roomW, 6, '#eab308');
      drawPixelRect(ctx, roomLeft, floorY - 70, roomW, 4, '#fef08a');
      for (let px = roomLeft + 20; px < roomRight - 40; px += 68) {
        drawPixelRect(ctx, px, floorY - 58, 48, 42, '#eee8d5');
        drawPixelRect(ctx, px + 4, floorY - 54, 40, 34, '#ffffff');
      }
      drawPixelRect(ctx, roomLeft, floorY - 8, roomW, 8, '#d6c79c');

      drawPixelRect(ctx, roomLeft, floorY, roomW, 48, '#78350f');
      drawPixelRect(ctx, roomLeft, floorY, roomW, 8, '#92400e');
      for (let fx = roomLeft; fx < roomRight; fx += 64) {
        drawPixelRect(ctx, fx, floorY, 4, 48, '#451a03');
      }

      // Window at top-right
      const winX = 636;
      const winY = 86;
      const winW = 128;
      const winH = 92;
      drawPixelRect(ctx, winX - 8, winY - 8, winW + 16, winH + 16, '#ffffff');
      drawPixelRect(ctx, winX - 12, winY + winH + 4, winW + 24, 8, '#eab308');
      drawPixelRect(ctx, winX, winY, winW, winH, '#090d16');
      drawPixelRect(ctx, winX + 24, winY + 18, 12, 12, '#f8fafc');
      drawPixelRect(ctx, winX + 92, winY + 26, 4, 4, '#cbd5e1');
      drawPixelRect(ctx, winX + 62, winY, 4, winH, '#f8fafc');
      drawPixelRect(ctx, winX, winY + 44, winW, 4, '#f8fafc');
      drawPixelRect(ctx, winX - 16, winY - 12, winW + 32, 6, '#ca8a04');
      drawPixelRect(ctx, winX - 14, winY - 6, 14, winH + 10, '#facc15');
      drawPixelRect(ctx, winX + winW, winY - 6, 14, winH + 10, '#facc15');

      // Door in the middle
      const doorW = 68;
      const doorH = 116;
      const doorX = 446;
      const doorY = floorY - doorH;
      drawPixelRect(ctx, doorX - 8, doorY - 8, doorW + 16, doorH + 8, '#ffffff');
      drawPixelRect(ctx, doorX - 4, doorY - 4, doorW + 8, doorH + 4, '#eab308');
      drawPixelRect(ctx, doorX, doorY, doorW, doorH, '#78350f');
      drawPixelRect(ctx, doorX + 6, doorY + 6, doorW - 12, doorH - 12, '#92400e');
      drawPixelRect(ctx, doorX + 12, doorY + 12, doorW - 24, 38, '#5c2d10');
      drawPixelRect(ctx, doorX + 16, doorY + 16, doorW - 32, 30, '#78350f');
      drawPixelRect(ctx, doorX + 12, doorY + 62, doorW - 24, 42, '#5c2d10');
      drawPixelRect(ctx, doorX + 16, doorY + 66, doorW - 32, 34, '#78350f');
      drawPixelRect(ctx, doorX + 24, doorY + 24, 20, 8, '#fde047');
      drawPixelRect(ctx, doorX + doorW - 14, doorY + 56, 8, 8, '#fde047');

      // Wall light switch next to the door
      const switchX = HOTEL_LIGHT_SWITCH_X;
      const switchY = floorY - 72;
      drawPixelRect(ctx, switchX - 8, switchY - 12, 16, 24, '#e2e8f0');
      drawPixelRect(ctx, switchX - 6, switchY - 10, 12, 20, '#ffffff');
      drawPixelRect(
        ctx,
        switchX - 4,
        ceilingLightOn ? switchY - 6 : switchY,
        8,
        8,
        ceilingLightOn ? '#eab308' : '#475569'
      );

      // Bed on the left (x = 168..292)
      const bedX = 168;
      const bedW = 124;
      drawPixelRect(ctx, bedX, floorY - 80, 16, 80, '#5c2d10');
      drawPixelRect(ctx, bedX + 4, floorY - 84, 12, 8, '#eab308');
      drawPixelRect(ctx, bedX, floorY - 32, bedW, 20, '#78350f');
      drawPixelRect(ctx, bedX, floorY - 12, 12, 12, '#451a03');
      drawPixelRect(ctx, bedX + bedW - 12, floorY - 12, 12, 12, '#451a03');
      drawPixelRect(ctx, bedX + 16, floorY - 46, bedW - 20, 16, '#ffffff');
      drawPixelRect(ctx, bedX + 20, floorY - 56, 32, 12, '#f8fafc');
      drawPixelRect(ctx, bedX + 48, floorY - 46, bedW - 52, 18, '#fef08a');
      drawPixelRect(ctx, bedX + 56, floorY - 46, bedW - 60, 14, '#eab308');

      // Bedside nightstand & small warm lamp
      const nightstandX = 300;
      const nightstandW = 48;
      const nightstandTopY = floorY - 44;
      drawPixelRect(ctx, nightstandX, nightstandTopY, nightstandW, 38, '#5c2d10');
      drawPixelRect(ctx, nightstandX + 4, nightstandTopY + 4, nightstandW - 8, 30, '#78350f');
      drawPixelRect(ctx, nightstandX - 2, nightstandTopY, nightstandW + 4, 6, '#92400e');
      drawPixelRect(ctx, nightstandX + 8, nightstandTopY + 10, nightstandW - 16, 14, '#451a03');
      drawPixelRect(ctx, nightstandX + 20, nightstandTopY + 15, 8, 4, '#fde047');

      const bedsideLampX = nightstandX + 24;
      const bedsideLampBaseY = nightstandTopY;
      drawPixelRect(ctx, bedsideLampX - 8, bedsideLampBaseY - 4, 16, 4, '#ca8a04');
      drawPixelRect(ctx, bedsideLampX - 4, bedsideLampBaseY - 12, 8, 8, '#eab308');
      drawPixelRect(ctx, bedsideLampX - 14, bedsideLampBaseY - 26, 28, 14, '#fef08a');
      drawPixelRect(ctx, bedsideLampX - 10, bedsideLampBaseY - 24, 20, 10, '#ffffff');
      drawPixelRect(ctx, bedsideLampX - 14, bedsideLampBaseY - 28, 28, 4, '#eab308');

      // Chest of drawers & telephone on the right
      const deskX = 640;
      const deskW = 84;
      const deskTopY = floorY - 56;
      drawPixelRect(ctx, deskX - 4, deskTopY, deskW + 8, 8, '#92400e');
      drawPixelRect(ctx, deskX, deskTopY + 4, deskW, 4, '#eab308');
      drawPixelRect(ctx, deskX, deskTopY + 8, deskW, 44, '#5c2d10');
      drawPixelRect(ctx, deskX + 4, deskTopY + 10, deskW - 8, 40, '#78350f');
      for (let d = 0; d < 3; d++) {
        const dy = deskTopY + 12 + d * 12;
        drawPixelRect(ctx, deskX + 8, dy, deskW - 16, 10, '#451a03');
        drawPixelRect(ctx, deskX + 10, dy + 2, deskW - 20, 6, '#5c2d10');
        drawPixelRect(ctx, deskX + deskW / 2 - 6, dy + 3, 12, 4, '#fde047');
      }
      drawPixelRect(ctx, HOTEL_PHONE_X - 16, deskTopY - 14, 32, 14, '#dc2626');
      drawPixelRect(ctx, HOTEL_PHONE_X - 20, deskTopY - 22, 40, 8, '#ef4444');

      draw8BitProtagonist(
        ctx,
        playerX,
        floorY + 8,
        playerFacing,
        walkCycle,
        isWalking,
        false,
        timeSec
      );

      // Room lighting (warm cone when on, bedside lamp always on — identical to Night 2 & 3!)
      const lampCx = 480;
      const coneTopY = roomTop + 28;
      const coneBottomY = floorY + 48;
      const bedsideLightCx = bedsideLampX;
      const bedsideLightCy = bedsideLampBaseY - 20;

      if (ceilingLightOn) {
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
        ctx.restore();
      } else {
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
    };

    // ========================================================================
    // FIRST-PERSON ROOM 303 BED BLINKING SCENE (3 BLINKS IN 2.5S)
    // Uses the exact Room 303 wallpaper, wainscoting, door, window, desk+phone,
    // and bedside lamp glow from drawHotelRoomScene!
    // ========================================================================
    const drawFirstPersonRoom303BlinkingScene = (
      ctx: CanvasRenderingContext2D,
      W: number,
      H: number,
      timeSec: number,
      blinkElapsedSec: number,
      backgroundOnly: boolean = false
    ) => {
      const blinkState = getPostNight4BlinkState(blinkElapsedSec);
      const roomLeft = 32;
      const roomRight = 928;
      const roomTop = 36;
      const floorY = 396;
      const roomW = roomRight - roomLeft;
      const roomH = floorY - roomTop;

      ctx.fillStyle = '#030408';
      ctx.fillRect(0, 0, W, H);

      // Room 303 outer frame (occupies > 93% of width so side bars are ~3.3%, well under 5%)
      drawPixelRect(ctx, roomLeft - 8, roomTop - 8, roomW + 16, roomH + 112, '#d6c79c');
      drawPixelRect(ctx, roomLeft - 4, roomTop - 4, roomW + 8, roomH + 104, '#fef9c3');

      // Room 303 cream & gold striped wallpaper
      drawPixelRect(ctx, roomLeft, roomTop, roomW, roomH, '#f5f0e1');
      for (let wx = roomLeft + 12; wx < roomRight - 8; wx += 24) {
        drawPixelRect(ctx, wx, roomTop + 12, 8, roomH - 80, '#ede3c8');
      }
      drawPixelRect(ctx, roomLeft, roomTop, roomW, 12, '#eab308');
      drawPixelRect(ctx, roomLeft, roomTop + 12, roomW, 4, '#fef08a');

      // Room 303 white & gold wainscoting panels
      drawPixelRect(ctx, roomLeft, floorY - 80, roomW, 80, '#faf8f5');
      drawPixelRect(ctx, roomLeft, floorY - 84, roomW, 6, '#eab308');
      drawPixelRect(ctx, roomLeft, floorY - 78, roomW, 4, '#fef08a');
      for (let px = roomLeft + 24; px < roomRight - 44; px += 72) {
        drawPixelRect(ctx, px, floorY - 64, 52, 48, '#eee8d5');
        drawPixelRect(ctx, px + 4, floorY - 60, 44, 40, '#ffffff');
      }
      drawPixelRect(ctx, roomLeft, floorY - 8, roomW, 8, '#d6c79c');

      // Room 303 oak wooden floor planks
      drawPixelRect(ctx, roomLeft, floorY, roomW, 100, '#78350f');
      drawPixelRect(ctx, roomLeft, floorY, roomW, 8, '#92400e');
      for (let fx = roomLeft; fx < roomRight; fx += 64) {
        drawPixelRect(ctx, fx, floorY, 4, 100, '#451a03');
      }

      // Room 303 Window on the right
      const winX = 688;
      const winY = 72;
      const winW = 152;
      const winH = 108;
      drawPixelRect(ctx, winX - 8, winY - 8, winW + 16, winH + 16, '#ffffff');
      drawPixelRect(ctx, winX - 12, winY + winH + 4, winW + 24, 8, '#eab308');
      drawPixelRect(ctx, winX, winY, winW, winH, '#090d16');
      drawPixelRect(ctx, winX + 28, winY + 20, 12, 12, '#f8fafc');
      drawPixelRect(ctx, winX + 108, winY + 32, 4, 4, '#cbd5e1');
      drawPixelRect(ctx, winX + 74, winY, 4, winH, '#f8fafc');
      drawPixelRect(ctx, winX, winY + 52, winW, 4, '#f8fafc');
      drawPixelRect(ctx, winX - 16, winY - 12, winW + 32, 6, '#ca8a04');
      drawPixelRect(ctx, winX - 14, winY - 6, 14, winH + 10, '#facc15');
      drawPixelRect(ctx, winX + winW, winY - 6, 14, winH + 10, '#facc15');

      // Room 303 Central Wooden Door & Wall Light Switch seen from the bed
      const doorW = 88;
      const doorH = 148;
      const doorX = 436;
      const doorY = floorY - doorH;
      drawPixelRect(ctx, doorX - 8, doorY - 8, doorW + 16, doorH + 8, '#ffffff');
      drawPixelRect(ctx, doorX - 4, doorY - 4, doorW + 8, doorH + 4, '#eab308');
      drawPixelRect(ctx, doorX, doorY, doorW, doorH, '#78350f');
      drawPixelRect(ctx, doorX + 8, doorY + 8, doorW - 16, doorH - 16, '#92400e');
      drawPixelRect(ctx, doorX + 16, doorY + 16, doorW - 32, 48, '#5c2d10');
      drawPixelRect(ctx, doorX + 20, doorY + 20, doorW - 40, 40, '#78350f');
      drawPixelRect(ctx, doorX + 16, doorY + 78, doorW - 32, 54, '#5c2d10');
      drawPixelRect(ctx, doorX + 20, doorY + 82, doorW - 40, 46, '#78350f');
      drawPixelRect(ctx, doorX + 32, doorY + 32, 24, 8, '#fde047');
      drawPixelRect(ctx, doorX + doorW - 18, doorY + 72, 8, 8, '#fde047');

      // Wall light switch (OFF)
      drawPixelRect(ctx, 548, floorY - 88, 16, 24, '#e2e8f0');
      drawPixelRect(ctx, 550, floorY - 86, 12, 20, '#ffffff');
      drawPixelRect(ctx, 552, floorY - 76, 8, 8, '#475569');

      // Chest of drawers & red telephone on the right
      const deskX = 700;
      const deskW = 108;
      const deskTopY = floorY - 68;
      drawPixelRect(ctx, deskX - 4, deskTopY, deskW + 8, 8, '#92400e');
      drawPixelRect(ctx, deskX, deskTopY + 4, deskW, 4, '#eab308');
      drawPixelRect(ctx, deskX, deskTopY + 8, deskW, 56, '#5c2d10');
      drawPixelRect(ctx, deskX + 4, deskTopY + 12, deskW - 8, 48, '#78350f');
      for (let d = 0; d < 3; d++) {
        const dy = deskTopY + 14 + d * 16;
        drawPixelRect(ctx, deskX + 10, dy, deskW - 20, 12, '#451a03');
        drawPixelRect(ctx, deskX + deskW / 2 - 8, dy + 4, 16, 4, '#fde047');
      }
      drawPixelRect(ctx, deskX + 34, deskTopY - 16, 36, 16, '#dc2626');
      drawPixelRect(ctx, deskX + 30, deskTopY - 24, 44, 8, '#ef4444');

      // Bedside nightstand & warm lamp on the left foreground
      const nightstandX = 128;
      const nightstandW = 68;
      const nightstandTopY = floorY - 56;
      drawPixelRect(ctx, nightstandX, nightstandTopY, nightstandW, 48, '#5c2d10');
      drawPixelRect(ctx, nightstandX + 4, nightstandTopY + 4, nightstandW - 8, 40, '#78350f');
      drawPixelRect(ctx, nightstandX + 12, nightstandTopY + 14, nightstandW - 24, 16, '#451a03');
      drawPixelRect(ctx, nightstandX + 28, nightstandTopY + 20, 12, 4, '#fde047');
      const bedsideLampX = nightstandX + 34;
      const bedsideLampBaseY = nightstandTopY;
      drawPixelRect(ctx, bedsideLampX - 12, bedsideLampBaseY - 4, 24, 4, '#ca8a04');
      drawPixelRect(ctx, bedsideLampX - 6, bedsideLampBaseY - 16, 12, 12, '#eab308');
      drawPixelRect(ctx, bedsideLampX - 20, bedsideLampBaseY - 36, 40, 20, '#fef08a');
      drawPixelRect(ctx, bedsideLampX - 14, bedsideLampBaseY - 32, 28, 12, '#ffffff');
      drawPixelRect(ctx, bedsideLampX - 20, bedsideLampBaseY - 40, 40, 4, '#eab308');

      // Ceiling lamp fixture (OFF)
      drawPixelRect(ctx, 472, roomTop, 16, 16, '#ca8a04');
      drawPixelRect(ctx, 452, roomTop + 16, 56, 10, '#eab308');
      drawPixelRect(ctx, 456, roomTop + 24, 48, 8, '#52525b');

      // First-person bed sheets & gold blanket in the bottom foreground
      drawPixelRect(ctx, 200, 428, 560, 64, '#78350f');
      drawPixelRect(ctx, 216, 408, 528, 24, '#fef08a');
      drawPixelRect(ctx, 216, 428, 528, 60, '#eab308');

      // Room 303 dark night lighting + warm bedside lamp glow
      const bedsideLightCx = bedsideLampX;
      const bedsideLightCy = bedsideLampBaseY - 26;
      ctx.save();
      const darkGrad = ctx.createRadialGradient(
        bedsideLightCx,
        bedsideLightCy,
        24,
        bedsideLightCx,
        bedsideLightCy,
        250
      );
      darkGrad.addColorStop(0, 'rgba(5, 8, 18, 0.10)');
      darkGrad.addColorStop(0.55, 'rgba(5, 8, 18, 0.48)');
      darkGrad.addColorStop(1, 'rgba(5, 8, 18, 0.80)');
      ctx.fillStyle = darkGrad;
      ctx.fillRect(roomLeft, roomTop, roomW, roomH + 100);
      ctx.restore();

      ctx.save();
      const bedsideGrad = ctx.createRadialGradient(
        bedsideLightCx,
        bedsideLightCy,
        8,
        bedsideLightCx,
        bedsideLightCy,
        150
      );
      bedsideGrad.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
      bedsideGrad.addColorStop(0.35, 'rgba(254, 240, 138, 0.42)');
      bedsideGrad.addColorStop(0.7, 'rgba(250, 204, 21, 0.18)');
      bedsideGrad.addColorStop(1, 'rgba(250, 204, 21, 0)');
      ctx.fillStyle = bedsideGrad;
      ctx.beginPath();
      ctx.arc(bedsideLightCx, bedsideLightCy, 150, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      if (backgroundOnly) {
        return;
      }

      // ON THE 3RD BLINK: The Dark Silhouette Rabbit stands looming right at the foot of the bed!
      if (blinkState.showDarkRabbit) {
        const rx = 480;
        const twitchX = (Math.floor(timeSec * 30) % 3 - 1) * 4;

        // Dark shadow aura
        drawPixelRect(ctx, rx - 116 + twitchX, 84, 232, 344, 'rgba(0, 0, 0, 0.65)');

        // Long iconic rabbit ears
        drawPixelRect(ctx, rx - 52 + twitchX, 84, 36, 108, '#18181b');
        drawPixelRect(ctx, rx - 48 + twitchX, 88, 28, 100, '#020204');
        drawPixelRect(ctx, rx + 16 + twitchX, 80, 36, 112, '#18181b');
        drawPixelRect(ctx, rx + 20 + twitchX, 84, 28, 104, '#020204');

        // Head
        drawPixelRect(ctx, rx - 68 + twitchX, 188, 136, 104, '#18181b');
        drawPixelRect(ctx, rx - 64 + twitchX, 192, 128, 96, '#020204');

        // Glowing white pinprick eyes staring straight at Richard in bed
        drawPixelRect(ctx, rx - 32 + twitchX, 224, 12, 12, '#ffffff');
        drawPixelRect(ctx, rx + 20 + twitchX, 224, 12, 12, '#ffffff');

        // Pitch-black torso & arms looming over the bed
        drawPixelRect(ctx, rx - 92 + twitchX, 292, 184, 148, '#020204');
        drawPixelRect(ctx, rx - 116 + twitchX, 300, 24, 128, '#09090b');
        drawPixelRect(ctx, rx + 92 + twitchX, 300, 24, 128, '#09090b');
      }

      // First-person Eyelid Blinking Overlay (0.5s black -> open -> 1s open -> blink 1 -> 1s open -> blink 2 -> 1s open -> blink 3)
      const closeRatio = blinkState.eyelidClosure;
      if (closeRatio >= 0.99) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, W, H);
      } else if (closeRatio > 0.01) {
        const lidHeight = Math.ceil((H / 2 + 24) * closeRatio);
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, W, lidHeight);
        ctx.fillRect(0, H - lidHeight, W, lidHeight);

        const gradTop = ctx.createLinearGradient(0, lidHeight, 0, lidHeight + 48);
        gradTop.addColorStop(0, 'rgba(0,0,0,0.92)');
        gradTop.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gradTop;
        ctx.fillRect(0, lidHeight, W, 48);

        const gradBot = ctx.createLinearGradient(0, H - lidHeight - 48, 0, H - lidHeight);
        gradBot.addColorStop(0, 'rgba(0,0,0,0)');
        gradBot.addColorStop(1, 'rgba(0,0,0,0.92)');
        ctx.fillStyle = gradBot;
        ctx.fillRect(0, H - lidHeight - 48, W, 48);
      }
    };

    // ========================================================================
    // FIRST-PERSON DARK RABBIT 8-BIT SUPER-DETAILED POUNCE JUMPSCARE (3.10s)
    // - Fast explosive pounce across the bed (0.00s..0.28s)
    // - Close-up mauling (0.28s..2.00s)
    // - Final distortion effect starting at 2.00s (matching image_559a082b.png)
    // - Fade to black starting at 2.50s without ever restarting the animation!
    // ========================================================================
    const drawFirstPersonDarkRabbitJumpscare = (
      ctx: CanvasRenderingContext2D,
      W: number,
      H: number,
      timeSec: number,
      jumpscareTimerSec: number
    ) => {
      const js = getPostNight4RabbitJumpscareState(jumpscareTimerSec);
      const shakeX = Math.round(Math.sin(timeSec * 145) * js.shakeAmplitude);
      const shakeY = Math.round(Math.cos(timeSec * 170) * (js.shakeAmplitude * 0.82));

      // 1. Keep Room 303 clearly visible in the background shaking & recoiling as the rabbit vaults across the bed!
      ctx.save();
      const roomZoom = 1 + js.lungeProgress * 0.12;
      ctx.translate(W / 2 + Math.round(shakeX * 0.45), H / 2 + Math.round(shakeY * 0.45));
      ctx.scale(roomZoom, roomZoom);
      ctx.translate(-W / 2, -H / 2);
      drawFirstPersonRoom303BlinkingScene(ctx, W, H, timeSec, 1.2, true);

      // Bed blanket & footboard physical interaction as the Dark Rabbit vaults from outside the bed onto the sheets!
      if (js.stage === 'COIL_AT_BED_FOOT') {
        for (let side = -1; side <= 1; side += 2) {
          const gripX = 480 + side * 108;
          drawPixelRect(ctx, gripX - 24, 396, 48, 20, '#09090b');
          for (let c = 0; c < 5; c++) {
            drawPixelRect(ctx, gripX - 20 + c * 9, 412, 6, 20, '#e4e4e7');
            drawPixelRect(ctx, gripX - 20 + c * 9, 428, 6, 6, '#dc2626');
          }
        }
      } else {
        const indentSpread = Math.round(64 + js.lungeProgress * 120);
        drawPixelRect(ctx, 480 - indentSpread, 416, indentSpread * 2, 20, 'rgba(9, 9, 11, 0.52)');
        drawPixelRect(
          ctx,
          480 - indentSpread + 24,
          436,
          (indentSpread - 24) * 2,
          24,
          'rgba(9, 9, 11, 0.65)'
        );
        for (let s = -2; s <= 2; s++) {
          drawPixelRect(ctx, 480 + s * 36 - 4, 412, 8, 52, '#451a03');
          drawPixelRect(ctx, 480 + s * 36 - 2, 416, 4, 44, '#7f1d1d');
        }
      }
      ctx.restore();

      // Subtle horror strobe over Room 303 as the rabbit lunges closer
      const darkOverlayAlpha = Math.min(0.42, js.lungeProgress * 0.34);
      const isCrimsonFlash =
        js.stage === 'MAUL_AND_SCREECH_CLIMAX' && Math.floor(timeSec * 28) % 3 === 0;
      ctx.fillStyle = isCrimsonFlash
        ? `rgba(72, 6, 14, ${darkOverlayAlpha.toFixed(2)})`
        : `rgba(4, 4, 10, ${darkOverlayAlpha.toFixed(2)})`;
      ctx.fillRect(0, 0, W, H);

      const bitePulse =
        js.stage === 'MAUL_AND_SCREECH_CLIMAX' ? Math.sin(timeSec * 40) * 0.16 : 0;
      const effectiveScale = js.scale + bitePulse;
      const anchorX = W / 2 + shakeX;
      const anchorY = 244 + js.arcOffsetY + shakeY;

      // 2. Parabolic Motion Afterimages (Ghost Trail) during the explosive leap across the bed
      if (
        js.stage === 'LEAP_ACROSS_BED' ||
        (js.stage === 'MAUL_AND_SCREECH_CLIMAX' && jumpscareTimerSec < 0.52)
      ) {
        for (let g = 2; g >= 1; g--) {
          const trailRatio = g * 0.24;
          const ghostScale = Math.max(0.95, effectiveScale * (1 - trailRatio * 0.42));
          const ghostX = W / 2 + Math.round(shakeX * (1 - trailRatio));
          const ghostY = Math.round(anchorY * (1 - trailRatio) + 264 * trailRatio);
          ctx.save();
          ctx.globalAlpha = 0.22 / g;
          ctx.translate(ghostX, ghostY);
          ctx.scale(ghostScale, ghostScale);
          drawPixelRect(ctx, -64, -168, 40, 112, '#09090b');
          drawPixelRect(ctx, 24, -168, 40, 112, '#09090b');
          drawPixelRect(ctx, -76, -60, 152, 96, '#050508');
          drawPixelRect(ctx, -96, 44, 192, 136, '#050508');
          drawPixelRect(ctx, -148, 0, 48, 128, '#09090b');
          drawPixelRect(ctx, 100, 0, 48, 128, '#09090b');
          drawPixelRect(ctx, -40, -26, 12, 12, '#ef4444');
          drawPixelRect(ctx, 28, -26, 12, 12, '#ef4444');
          ctx.restore();
        }
      }

      // 3. Super-Detailed Animated Dark Rabbit Body Pouncing from Outside the Bed into the Camera!
      ctx.save();
      ctx.translate(anchorX, anchorY);
      ctx.rotate((js.headTiltDeg * Math.PI) / 180);
      ctx.scale(effectiveScale, effectiveScale);

      // Swirling dark shadow tendrils & speed lines radiating behind the leaping rabbit
      drawPixelRect(ctx, -116, -152, 232, 316, 'rgba(0, 0, 0, 0.56)');
      for (let t = 0; t < 8; t++) {
        const tendrilSide = t % 2 === 0 ? -1 : 1;
        const tendrilY = -108 + t * 32 + Math.round(Math.sin(timeSec * 32 + t) * 12);
        const tendrilLen = Math.round(36 + js.lungeProgress * 52);
        drawPixelRect(
          ctx,
          tendrilSide < 0 ? -96 - tendrilLen : 96,
          tendrilY,
          tendrilLen,
          10,
          t % 3 === 0 ? '#18181b' : '#09090b'
        );
      }

      // Digitigrade 3-Segment Hind Legs & Pelvis vaulting over the footboard and kicking backward!
      if (js.lungeProgress < 0.92) {
        const legExt = Math.round(js.lungeProgress * 64);
        const kneeBend =
          js.stage === 'COIL_AT_BED_FOOT' ? -24 : Math.round(js.lungeProgress * 28);
        drawPixelRect(ctx, -64, 148, 128, 28, '#18181b');
        drawPixelRect(ctx, -56, 152, 112, 20, '#050508');
        for (let side = -1; side <= 1; side += 2) {
          const lx = side < 0 ? -68 : 24;
          const thighY = 164 + kneeBend;
          drawPixelRect(ctx, lx, thighY, 44, 44, '#27272a');
          drawPixelRect(ctx, lx + 4, thighY + 4, 36, 36, '#050508');
          drawPixelRect(ctx, lx + 8, thighY + 40, 28, 12, '#3f3f46');
          const shinY = thighY + 48 + Math.round(legExt * 0.45);
          drawPixelRect(ctx, lx + 4, shinY, 36, 44, '#18181b');
          drawPixelRect(ctx, lx + 8, shinY + 4, 28, 36, '#050508');
          for (let hc = 0; hc < 3; hc++) {
            drawPixelRect(ctx, lx + 4 + hc * 12, shinY + 40, 8, 16, '#d4d4d8');
          }
        }
      }

      // Pitch-black Ribcage, Spinal Vertebrae & Shoulders surging forward over the bed
      const shoulderSpread = Math.round(js.clawGrabProgress * 44);
      drawPixelRect(
        ctx,
        -96 - shoulderSpread / 2,
        40,
        192 + shoulderSpread,
        120,
        '#27272a'
      );
      drawPixelRect(
        ctx,
        -88 - shoulderSpread / 2,
        44,
        176 + shoulderSpread,
        112,
        '#050508'
      );
      drawPixelRect(ctx, -8, 44, 16, 112, '#27272a');
      drawPixelRect(ctx, -40, 52, 80, 16, '#18181b');
      drawPixelRect(ctx, -14, 48, 28, 24, '#3f3f46');
      for (let ry = 76; ry <= 140; ry += 16) {
        drawPixelRect(ctx, -64, ry, 52, 8, '#18181b');
        drawPixelRect(ctx, 12, ry, 52, 8, '#18181b');
        drawPixelRect(ctx, -4, ry - 2, 8, 12, '#52525b');
      }

      // Articulated 3-Segment Shadow Arms & 5 Blood-Tipped Razor Claws
      const clawSlashWave =
        js.stage === 'MAUL_AND_SCREECH_CLIMAX' ? Math.round(Math.sin(timeSec * 36) * 20) : 0;
      const armReachY = Math.round(48 - js.clawGrabProgress * 108) + clawSlashWave;
      const armOutX = Math.round(
        104 + Math.sin(js.lungeProgress * Math.PI) * 32 + js.clawGrabProgress * 44
      );

      const drawArticulatedShadowArm = (side: -1 | 1, waveOffset: number) => {
        const shoulderX = side < 0 ? -96 - shoulderSpread / 2 : 72 + shoulderSpread / 2;
        const elbowX = side < 0 ? -armOutX - 24 : armOutX - 16;
        const handX = side < 0 ? -armOutX - 48 : armOutX - 16;
        const handY = armReachY + waveOffset;

        drawPixelRect(ctx, shoulderX, 40, 28, 28, '#3f3f46');
        drawPixelRect(ctx, shoulderX + 4, 44, 20, 20, '#09090b');
        drawPixelRect(ctx, elbowX, handY + 52, 44, 72, '#27272a');
        drawPixelRect(ctx, elbowX + 4, handY + 56, 36, 64, '#050508');

        drawPixelRect(ctx, elbowX + 6, handY + 36, 32, 20, '#52525b');
        drawPixelRect(ctx, elbowX + 10, handY + 40, 24, 12, '#18181b');

        drawPixelRect(ctx, handX + 4, handY + 8, 56, 40, '#27272a');
        drawPixelRect(ctx, handX + 8, handY + 12, 48, 32, '#050508');

        drawPixelRect(ctx, handX, handY - 16, 64, 32, '#18181b');
        drawPixelRect(ctx, handX + 4, handY - 12, 56, 24, '#050508');

        const clawLen = Math.round(28 + js.clawGrabProgress * 36);
        for (let c = 0; c < 5; c++) {
          const cx = handX + c * 13;
          const extraMid = c === 1 || c === 2 || c === 3 ? 10 : 0;
          const cy = handY - 16 - clawLen - extraMid;
          drawPixelRect(ctx, cx, handY - 18, 10, 6, '#52525b');
          drawPixelRect(ctx, cx + 1, cy + 12, 8, clawLen + extraMid - 12, '#d4d4d8');
          drawPixelRect(ctx, cx + 2, cy + 4, 6, 12, '#f4f4f5');
          drawPixelRect(ctx, cx + 1, cy, 8, 8, '#dc2626');
          drawPixelRect(ctx, cx + 3, cy - 4, 4, 4, '#ef4444');
        }
      };

      drawArticulatedShadowArm(-1, 0);
      drawArticulatedShadowArm(1, -clawSlashWave * 2);

      // Articulated 3-Segment Iconic Rabbit Ears
      const earWhipL = Math.round(Math.sin(timeSec * 38) * (js.lungeProgress * 14));
      const earWhipR = Math.round(Math.cos(timeSec * 42) * (js.lungeProgress * 14));
      const earBendY = js.stage === 'LEAP_ACROSS_BED' ? 24 : 0;
      for (let side = -1; side <= 1; side += 2) {
        const baseX = side < 0 ? -60 : 20;
        const whip = side < 0 ? earWhipL : earWhipR;
        drawPixelRect(ctx, baseX, -108 + earBendY, 40, 52, '#27272a');
        drawPixelRect(ctx, baseX + 4, -104 + earBendY, 32, 44, '#050508');
        drawPixelRect(ctx, baseX + 10, -96 + earBendY, 20, 32, '#18181b');
        drawPixelRect(ctx, baseX + 8, -118 + earBendY, 24, 12, '#52525b');
        drawPixelRect(ctx, baseX + whip, -176 + earBendY, 40, 60, '#27272a');
        drawPixelRect(ctx, baseX + 4 + whip, -172 + earBendY, 32, 52, '#050508');
        drawPixelRect(ctx, baseX + 10 + whip, -160 + earBendY, 20, 36, '#18181b');
      }

      // Upper Shadow Rabbit Cranium, Forehead Seam & Snout Muzzle
      drawPixelRect(ctx, -80, -64, 160, 96, '#27272a');
      drawPixelRect(ctx, -76, -60, 152, 88, '#050508');
      drawPixelRect(ctx, -4, -60, 8, 48, '#18181b');
      drawPixelRect(ctx, -84, -12, 16, 36, '#18181b');
      drawPixelRect(ctx, 68, -12, 16, 36, '#18181b');
      drawPixelRect(ctx, -60, -6, 120, 38, '#18181b');
      drawPixelRect(ctx, -56, -2, 112, 30, '#09090b');
      drawPixelRect(ctx, -20, -6, 40, 14, '#000000');
      drawPixelRect(ctx, -48, 8, 8, 8, '#27272a');
      drawPixelRect(ctx, -36, 14, 8, 8, '#27272a');
      drawPixelRect(ctx, 40, 8, 8, 8, '#27272a');
      drawPixelRect(ctx, 28, 14, 8, 8, '#27272a');

      // Furrowed Angry Shadow Brow Ridges
      drawPixelRect(ctx, -60, -48, 48, 10, '#3f3f46');
      drawPixelRect(ctx, 12, -48, 48, 10, '#3f3f46');
      drawPixelRect(ctx, -24, -44, 16, 8, '#52525b');
      drawPixelRect(ctx, 8, -44, 16, 8, '#52525b');

      // Deep Hollow Eye Sockets + Blazing White/Crimson Pinpoint Eyes
      drawPixelRect(ctx, -58, -38, 46, 34, '#000000');
      drawPixelRect(ctx, 12, -38, 46, 34, '#000000');
      if (js.jawOpenProgress > 0.12) {
        drawPixelRect(ctx, -50, -32, 30, 22, '#7f1d1d');
        drawPixelRect(ctx, 20, -32, 30, 22, '#7f1d1d');
        drawPixelRect(ctx, -46, -28, 22, 14, '#ef4444');
        drawPixelRect(ctx, 24, -28, 22, 14, '#ef4444');
      }
      const pupilJitterX = (Math.floor(timeSec * 45) % 3 - 1) * 2;
      drawPixelRect(ctx, -40 + pupilJitterX, -26, 12, 12, '#ffffff');
      drawPixelRect(ctx, 28 + pupilJitterX, -26, 12, 12, '#ffffff');

      // Unhinging Shadow Jaw & Double Rows of Razor Fangs
      const jawSnapOsc =
        js.stage === 'MAUL_AND_SCREECH_CLIMAX' && !js.distortionActive
          ? Math.round(Math.abs(Math.sin(timeSec * 30)) * 22)
          : 0;
      const jawGap = Math.max(0, Math.round(js.jawOpenProgress * 88) - jawSnapOsc);
      if (jawGap > 4) {
        drawPixelRect(ctx, -72, 20, 12, jawGap + 16, '#3f3f46');
        drawPixelRect(ctx, 60, 20, 12, jawGap + 16, '#3f3f46');

        drawPixelRect(ctx, -64, 24, 128, jawGap + 24, '#000000');
        if (jawGap > 24) {
          drawPixelRect(ctx, -48, 34, 96, jawGap - 6, '#27050a');
          drawPixelRect(ctx, -32, 42, 64, Math.max(8, jawGap - 20), '#450a0a');
          drawPixelRect(ctx, -18, 50, 36, Math.max(4, jawGap - 36), '#000000');
        }

        drawPixelRect(ctx, -68, 24 + jawGap, 136, 32, '#27272a');
        drawPixelRect(ctx, -64, 28 + jawGap, 128, 24, '#050508');

        const toothH = Math.min(24, Math.max(6, Math.round(jawGap * 0.35)));
        for (let tx = -56; tx <= 48; tx += 16) {
          drawPixelRect(ctx, tx, 24, 8, toothH, '#f4f4f5');
          drawPixelRect(ctx, tx + 2, 24 + toothH - 4, 4, 4, '#dc2626');
          drawPixelRect(ctx, tx, 24 + jawGap - toothH, 8, toothH, '#f4f4f5');
          drawPixelRect(ctx, tx + 2, 24 + jawGap - toothH, 4, 4, '#dc2626');
        }
        if (jawGap > 36) {
          const innerToothH = Math.round(toothH * 0.72);
          for (let itx = -36; itx <= 28; itx += 16) {
            drawPixelRect(ctx, itx, 24 + toothH, 6, innerToothH, '#a1a1aa');
            drawPixelRect(
              ctx,
              itx,
              24 + jawGap - toothH - innerToothH,
              6,
              innerToothH,
              '#a1a1aa'
            );
          }
          drawPixelRect(ctx, -44, 24 + toothH, 4, jawGap - toothH * 2, 'rgba(220, 38, 38, 0.55)');
          drawPixelRect(ctx, 36, 24 + toothH, 4, jawGap - toothH * 2, 'rgba(220, 38, 38, 0.55)');
        }
      }

      ctx.restore();

      // 4. Final Distortion Effect starting at 2.00s ("el efecto de distorsion debe empezar en el segundo 2")
      // Matches the 2nd reference screenshot (image_559a082b.png) with horizontal crimson & white tear bars!
      if (js.distortionActive) {
        const fixedPositions = [0.16, 0.38, 0.62, 0.85];
        fixedPositions.forEach((ratio, idx) => {
          const jitterY = Math.round(Math.sin(timeSec * 90 + idx * 2.1) * 12);
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
          const by = Math.floor(((timeSec * 420 + b * 173) % H) / 4) * 4;
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

      // 5. Progressive Fade to Black starting at 2.50s ("y el fundido a negro en el 2 y medio de jumpscare")
      // Darkens directly over the distorted climax frame without ever restarting the pounce animation!
      if (js.blackoutAlpha > 0) {
        ctx.fillStyle = `rgba(0, 0, 0, ${js.blackoutAlpha.toFixed(3)})`;
        ctx.fillRect(0, 0, W, H);
      }
    };

    // ========================================================================
    // THIRD-PERSON SCENE: RICHARD TIED HANDS & FEET TO A CHAIR UNDER A VERY DIM
    // OVERHEAD LIGHT IN THE LOCAL'S BACKROOM, WITH 1 SINGLE DARK SILHOUETTE
    // ========================================================================
    const drawChairTiedThirdPersonScene = (
      ctx: CanvasRenderingContext2D,
      W: number,
      H: number,
      timeSec: number,
      currentPhase: PostNight4MinigamePhase,
      phaseTimerSec: number,
      documentsHandedOver: boolean
    ) => {
      ctx.fillStyle = '#030408';
      ctx.fillRect(0, 0, W, H);

      const floorY = 412;
      const roomLeft = 24;
      const roomRight = 936;
      const roomW = roomRight - roomLeft;

      // Wide pizzeria backroom wall & wainscoting (side bars <= 2.5% of screen!)
      drawPixelRect(ctx, roomLeft, 40, roomW, floorY - 40, '#090910');
      drawPixelRect(ctx, roomLeft, floorY - 96, roomW, 96, '#140c08');
      for (let cx = roomLeft; cx < roomRight; cx += 32) {
        drawPixelRect(ctx, cx, floorY - 104, 16, 8, '#3b0a0a');
        drawPixelRect(ctx, cx + 16, floorY - 104, 16, 8, '#27272a');
      }

      // Dark checkered/concrete floor
      drawPixelRect(ctx, 0, floorY, W, H - floorY, '#090b10');
      drawPixelRect(ctx, roomLeft, floorY, roomW, 8, '#18181b');

      // Overhead hanging lamp above Richard
      const lampX = 384;
      drawPixelRect(ctx, lampX - 4, 0, 8, 68, '#27272a');
      drawPixelRect(ctx, lampX - 24, 68, 48, 12, '#3f3f46');
      drawPixelRect(ctx, lampX - 12, 80, 24, 8, '#fde047');

      // Very dim overhead light cone ("con una luz muy tenue proveniente de arriba")
      ctx.save();
      const dimCone = ctx.createLinearGradient(lampX, 88, lampX, floorY + 24);
      dimCone.addColorStop(0, 'rgba(253, 224, 71, 0.22)');
      dimCone.addColorStop(0.5, 'rgba(253, 224, 71, 0.09)');
      dimCone.addColorStop(1, 'rgba(253, 224, 71, 0.02)');
      ctx.fillStyle = dimCone;
      ctx.beginPath();
      ctx.moveTo(lampX - 20, 88);
      ctx.lineTo(lampX + 20, 88);
      ctx.lineTo(lampX + 240, floorY + 20);
      ctx.lineTo(lampX - 180, floorY + 20);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // --- RICHARD TIED HANDS AND FEET TO A WOODEN CHAIR (x = 300) ---
      const chairX = 300;
      drawPixelRect(ctx, chairX - 32, floorY - 4, 72, 8, 'rgba(0,0,0,0.75)');
      drawPixelRect(ctx, chairX - 28, floorY - 108, 12, 108, '#451a03');
      drawPixelRect(ctx, chairX - 24, floorY - 48, 52, 12, '#5c2d10');
      drawPixelRect(ctx, chairX + 16, floorY - 44, 12, 44, '#451a03');

      drawPixelRect(ctx, chairX + 8, floorY - 44, 12, 36, '#1e293b');
      drawPixelRect(ctx, chairX + 8, floorY - 8, 16, 8, '#451a03');
      drawPixelRect(ctx, chairX + 4, floorY - 24, 24, 4, '#ca8a04');
      drawPixelRect(ctx, chairX + 4, floorY - 16, 24, 4, '#a16207');

      drawPixelRect(ctx, chairX - 16, floorY - 84, 28, 36, '#1e3a8a');
      drawPixelRect(ctx, chairX - 4, floorY - 80, 8, 28, '#93c5fd');
      drawPixelRect(ctx, chairX - 24, floorY - 76, 12, 28, '#172554');
      drawPixelRect(ctx, chairX - 28, floorY - 56, 12, 8, '#fcd34d');
      drawPixelRect(ctx, chairX - 32, floorY - 72, 48, 4, '#ca8a04');
      drawPixelRect(ctx, chairX - 32, floorY - 60, 48, 4, '#a16207');

      drawPixelRect(ctx, chairX - 12, floorY - 108, 24, 24, '#fcd34d');
      drawPixelRect(ctx, chairX - 14, floorY - 112, 28, 8, '#451a03');
      drawPixelRect(ctx, chairX + 4, floorY - 98, 4, 4, '#09090b');
      drawPixelRect(ctx, chairX, floorY - 92, 16, 8, '#94a3b8');
      drawPixelRect(ctx, chairX + 4, floorY - 92, 12, 4, '#cbd5e1');

      // --- DARK SILHOUETTE OF THE THING STANDING IN FRONT OF RICHARD (x = 588) ---
      const figX = 588;
      const laughBob =
        currentPhase === 'CHAIR_TIED_LAUGH_INTRO'
          ? (Math.floor(timeSec * 16) % 2) * 4
          : (Math.floor(timeSec * 2) % 2) * 4;

      drawPixelRect(ctx, figX - 44, floorY - 4, 88, 8, 'rgba(0,0,0,0.92)');

      drawPixelRect(ctx, figX - 28, floorY - 48, 20, 48, '#040407');
      drawPixelRect(ctx, figX + 8, floorY - 48, 20, 48, '#040407');
      drawPixelRect(ctx, figX - 36, floorY - 136 + laughBob, 72, 92, '#040407');
      drawPixelRect(ctx, figX - 32, floorY - 132 + laughBob, 64, 84, '#07070c');
      drawPixelRect(ctx, figX - 24, floorY - 176 + laughBob, 48, 40, '#040407');
      drawPixelRect(ctx, figX - 12, floorY - 160 + laughBob, 8, 8, '#7f1d1d');

      if (currentPhase === 'CHAIR_TIED_HANDING_OVER_ANIM') {
        const p = Math.min(1, phaseTimerSec / POST_NIGHT_4_HAND_OVER_ANIM_DURATION_SEC);
        const docX = chairX + 16 + p * (figX - 52 - (chairX + 16));
        const docY = floorY - 68 - Math.sin(p * Math.PI) * 16;
        drawPixelRect(ctx, docX, docY, 28, 20, '#fde68a');
        drawPixelRect(ctx, docX + 4, docY + 4, 20, 4, '#78350f');
        drawPixelRect(ctx, docX + 4, docY + 12, 16, 4, '#dc2626');
      } else if (documentsHandedOver) {
        drawPixelRect(ctx, figX - 56, floorY - 84 + laughBob, 28, 20, '#ca8a04');
        drawPixelRect(ctx, figX - 52, floorY - 80 + laughBob, 20, 4, '#78350f');
      }
    };

    // ========================================================================
    // FIRST-PERSON HIGH-DETAIL 8-BIT REVEAL OF THE THING & DEMACRADO STILL FREDDY
    // - Full-screen framing: room walls span x = 20..940 (side borders are only 2.08%
    //   of the screen, well under the requested <= 5% limit!).
    // - Faster, dynamic 1.75s emergence with heavy mechanical stride bobbing,
    //   articulated 3-head movement, segmented endoskeleton neck vertebrae & pistons,
    //   glowing furnace core inside the writhing cable torso, and sparking wires!
    // ========================================================================
    const drawFirstPersonStillFreddyFromShadows = (
      ctx: CanvasRenderingContext2D,
      timeSec: number,
      emergeProgress: number
    ) => {
      const p = Math.max(0, Math.min(1, emergeProgress));
      const fx = 96 + p * 96;
      const fy = 284 + Math.round(Math.sin(timeSec * 3.5) * 4);

      ctx.save();
      ctx.globalAlpha = p;
      ctx.translate(fx, fy);

      // 1. TORN TOP HAT & EARS
      drawPixelRect(ctx, -56, -200, 84, 12, '#18181b');
      drawPixelRect(ctx, -36, -244, 60, 44, '#18181b');
      drawPixelRect(ctx, -84, -192, 28, 28, '#5c2d0c');
      drawPixelRect(ctx, -76, -184, 16, 16, '#3b1a06');
      drawPixelRect(ctx, 48, -192, 8, 24, '#71717a');
      drawPixelRect(ctx, 56, -196, 20, 20, '#52525b');
      drawPixelRect(ctx, 60, -192, 12, 12, '#09090b');

      // 2. HALF-HEAD TORN OFF EXPOSING THE ENDOSKELETON
      drawPixelRect(ctx, -72, -184, 72, 68, '#6b3410');
      drawPixelRect(ctx, -68, -176, 64, 56, '#4a2208');
      drawPixelRect(ctx, -8, -184, 12, 16, '#3b1a06');
      drawPixelRect(ctx, -12, -152, 12, 20, '#3b1a06');
      drawPixelRect(ctx, -4, -128, 8, 12, '#3b1a06');

      drawPixelRect(ctx, 0, -180, 68, 64, '#52525b');
      drawPixelRect(ctx, 4, -176, 60, 56, '#71717a');
      drawPixelRect(ctx, 8, -172, 48, 12, '#a1a1aa');
      drawPixelRect(ctx, 12, -156, 44, 32, '#27272a');
      drawPixelRect(ctx, 48, -172, 8, 48, '#a1a1aa');
      drawPixelRect(ctx, 4, -132, 56, 12, '#52525b');

      drawPixelRect(ctx, -52, -164, 36, 32, '#09090b');
      drawPixelRect(ctx, -44, -156, 20, 20, '#ef4444');
      drawPixelRect(ctx, -40, -152, 8, 8, '#ffffff');

      drawPixelRect(ctx, 12, -164, 36, 32, '#18181b');
      drawPixelRect(ctx, 16, -160, 28, 24, '#09090b');
      drawPixelRect(ctx, 24, -152, 8, 36, '#ef4444');
      drawPixelRect(ctx, 36, -148, 4, 32, '#38bdf8');
      drawPixelRect(ctx, 28, -148, 4, 4, '#fde047');

      drawPixelRect(ctx, -52, -116, 104, 16, '#3f3f46');
      for (let tx = -44; tx <= 36; tx += 12) {
        drawPixelRect(ctx, tx, -100, 8, 16, '#e4e4e7');
      }
      drawPixelRect(ctx, -56, -68, 56, 32, '#4a2208');
      drawPixelRect(ctx, 0, -68, 52, 28, '#52525b');
      drawPixelRect(ctx, 4, -64, 44, 20, '#71717a');
      for (let tx = -44; tx <= 36; tx += 12) {
        drawPixelRect(ctx, tx, -80, 8, 12, '#d4d4d8');
      }

      // 3. DEMACRADO TORSO WITH PART OF CHEST (INCLUDING ENDOSKELETON) RIPPED OUT
      drawPixelRect(ctx, -80, -32, 92, 108, '#5c2d0c');
      drawPixelRect(ctx, -72, -24, 72, 92, '#4a2208');
      drawPixelRect(ctx, -28, -28, 32, 20, '#991b1b');

      drawPixelRect(ctx, -68, 76, 68, 60, '#18181b');
      drawPixelRect(ctx, -16, -24, 16, 160, '#71717a');
      for (let ry = 80; ry <= 120; ry += 16) {
        drawPixelRect(ctx, -60, ry, 52, 8, '#a1a1aa');
      }

      drawPixelRect(ctx, -4, -28, 88, 144, '#07080e');
      drawPixelRect(ctx, 44, -32, 36, 24, '#4a2208');
      drawPixelRect(ctx, 36, -20, 24, 12, '#3b1a06');
      drawPixelRect(ctx, -8, -16, 12, 24, '#3b1a06');
      drawPixelRect(ctx, -12, 20, 12, 28, '#3b1a06');
      drawPixelRect(ctx, -8, 56, 12, 20, '#3b1a06');

      drawPixelRect(ctx, -4, -8, 24, 8, '#a1a1aa');
      drawPixelRect(ctx, 16, -4, 8, 8, '#52525b');
      drawPixelRect(ctx, -4, 16, 32, 8, '#71717a');
      drawPixelRect(ctx, 24, 20, 8, 8, '#d4d4d8');
      drawPixelRect(ctx, -4, 40, 20, 8, '#a1a1aa');
      drawPixelRect(ctx, -4, 68, 28, 8, '#71717a');

      drawPixelRect(ctx, 8, -8, 8, 76, '#dc2626');
      drawPixelRect(ctx, 24, -12, 4, 88, '#38bdf8');
      drawPixelRect(ctx, 40, -16, 8, 64, '#eab308');
      drawPixelRect(ctx, 56, -8, 4, 72, '#ef4444');

      ctx.restore();
    };

    const drawFirstPersonTheThingRevealScene = (
      ctx: CanvasRenderingContext2D,
      W: number,
      H: number,
      timeSec: number,
      currentPhase: PostNight4MinigamePhase,
      revealProgress: number,
      tapeRipProgress: number,
      freddyEmergeProgress: number
    ) => {
      // Dark pizzeria backroom background spanning 96% of screen width (side bars = 2.08% each, < 5%!)
      ctx.fillStyle = '#020306';
      ctx.fillRect(0, 0, W, H);

      const roomLeft = 20;
      const roomRight = 940;
      const roomW = roomRight - roomLeft;

      drawPixelRect(ctx, roomLeft, 16, roomW, 412, '#090b14');
      // Subtle vertical wall paneling & exposed industrial pipes in the backroom
      for (let wx = roomLeft + 32; wx < roomRight - 24; wx += 64) {
        drawPixelRect(ctx, wx, 24, 4, 280, '#0d101d');
      }
      drawPixelRect(ctx, roomLeft + 44, 16, 12, 412, '#141824');
      drawPixelRect(ctx, roomRight - 56, 16, 12, 412, '#141824');

      // Pizzeria lower wood wainscoting & red/white/black checkered strip across the full room width
      drawPixelRect(ctx, roomLeft, 316, roomW, 112, '#180d09');
      for (let cx = roomLeft; cx < roomRight; cx += 32) {
        drawPixelRect(ctx, cx, 304, 16, 12, '#5c0f0f');
        drawPixelRect(ctx, cx + 16, 304, 16, 12, '#d4d4d8');
        drawPixelRect(ctx, cx + 8, 296, 16, 8, '#18181b');
      }
      // Checkered backroom floor at bottom
      drawPixelRect(ctx, roomLeft, 428, roomW, H - 428, '#0c0e17');
      for (let fx = roomLeft; fx < roomRight; fx += 48) {
        drawPixelRect(ctx, fx, 428, 24, H - 428, '#181b28');
      }

      // Smooth illumination from the silhouette of his final form in the darkness (0..0.28)
      // to full bright illumination (0.28..0.95) as he steps out of the shadows into the light!
      const detailLit = Math.max(0, Math.min(1, (revealProgress - 0.28) / 0.67));

      // Overhead industrial lamp fixture & volumetric spotlight cone
      drawPixelRect(ctx, W / 2 - 4, 0, 8, 24, '#27272a');
      drawPixelRect(ctx, W / 2 - 32, 24, 64, 12, '#3f3f46');
      drawPixelRect(ctx, W / 2 - 20, 36, 40, 8, '#fef08a');

      ctx.save();
      const spotAlpha = 0.08 + detailLit * 0.42;
      const spotGrad = ctx.createRadialGradient(W / 2, 48, 24, W / 2, 250, 480);
      spotGrad.addColorStop(0, `rgba(254, 249, 195, ${spotAlpha.toFixed(3)})`);
      spotGrad.addColorStop(0.45, `rgba(253, 224, 71, ${(spotAlpha * 0.58).toFixed(3)})`);
      spotGrad.addColorStop(0.78, `rgba(220, 38, 38, ${(spotAlpha * 0.26).toFixed(3)})`);
      spotGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = spotGrad;
      ctx.fillRect(roomLeft, 16, roomW, H - 16);
      ctx.restore();

      // Still Freddy emerging from the shadows on the left (when freddyEmergeProgress > 0)
      if (freddyEmergeProgress > 0) {
        drawFirstPersonStillFreddyFromShadows(ctx, timeSec, freddyEmergeProgress);
      }

      // THE THING approaching from the gloom (penumbra) into the spotlight!
      const swayY = Math.round(Math.sin(timeSec * 3.2) * 4);
      const scale = 0.68 + revealProgress * 0.52;
      const cx = W / 2 + (freddyEmergeProgress > 0 ? freddyEmergeProgress * 92 : 0);
      const cy = 286 + (1 - revealProgress) * 36 + swayY;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);

      const ffX = 0;
      const ffY = -188;
      const bonnetX = -192;
      const bonnetY = -104;
      const bbX = 192;
      const bbY = -100;
      const maskSplit = 36;
      const screamJaw = Math.round(Math.abs(Math.sin(timeSec * 18)) * 12);
      const wireShift = Math.round(Math.sin(timeSec * 15) * 4);

      const renderTheThingFinalFormLayer = (isSilhouetteBase: boolean) => {
        const sDark = '#040407';
        const sMid = '#08080e';
        const sEdge = '#0c0d14';

        // 1. Foxy's Withered Red Thigh Casings, Knee Pistons & Exposed Endoskeleton Shins at the Base
        drawPixelRect(ctx, -100, 96, 60, 68, isSilhouetteBase ? sDark : '#991b1b');
        drawPixelRect(ctx, -92, 104, 44, 52, isSilhouetteBase ? sMid : '#7f1d1d');
        drawPixelRect(ctx, 40, 96, 60, 68, isSilhouetteBase ? sDark : '#991b1b');
        drawPixelRect(ctx, 48, 104, 44, 52, isSilhouetteBase ? sMid : '#7f1d1d');
        // Knee joints & bare steel shin struts
        drawPixelRect(ctx, -88, 160, 36, 12, isSilhouetteBase ? sEdge : '#52525b');
        drawPixelRect(ctx, 52, 160, 36, 12, isSilhouetteBase ? sEdge : '#52525b');
        drawPixelRect(ctx, -80, 172, 24, 60, isSilhouetteBase ? sMid : '#d4d4d8');
        drawPixelRect(ctx, 56, 172, 24, 60, isSilhouetteBase ? sMid : '#d4d4d8');
        drawPixelRect(ctx, -72, 172, 8, 60, isSilhouetteBase ? sDark : '#52525b');
        drawPixelRect(ctx, 64, 172, 8, 60, isSilhouetteBase ? sDark : '#52525b');

        // 2. Massive Amalgam Torso of Writhing Wires, Steel Ribs & Glowing Furnace Core
        drawPixelRect(ctx, -132, -60, 264, 168, isSilhouetteBase ? sDark : '#18181b');
        drawPixelRect(ctx, -116, -76, 232, 188, isSilhouetteBase ? sMid : '#27272a');

        // Glowing crimson endoskeleton furnace core & vertical spine inside the cable mass
        drawPixelRect(ctx, -12, -68, 24, 172, isSilhouetteBase ? sEdge : '#52525b');
        drawPixelRect(ctx, -28, -20, 56, 48, isSilhouetteBase ? '#3b0707' : '#7f1d1d');
        drawPixelRect(ctx, -16, -8, 32, 24, isSilhouetteBase ? '#7f1d1d' : '#ef4444');
        if (!isSilhouetteBase) {
          drawPixelRect(ctx, -8, -4, 16, 12, '#fecaca');
        }

        // Writhing multi-layered cables & steel rib conduits across torso
        for (let i = -4; i <= 4; i++) {
          const waveY = Math.round(Math.sin(timeSec * 6 + i * 1.1) * 8);
          const wireY = i * 18 + waveY;
          const wireCol = isSilhouetteBase
            ? sEdge
            : i % 3 === 0
            ? '#52525b'
            : i % 3 === 1
            ? '#ef4444'
            : '#38bdf8';
          drawPixelRect(ctx, -128, wireY, 256, 12, wireCol);
          drawPixelRect(ctx, -100, wireY - 8, 200, 8, isSilhouetteBase ? sDark : '#3f3f46');
          if (!isSilhouetteBase && i % 2 === 0) {
            drawPixelRect(ctx, -112, wireY + 4, 224, 4, '#a1a1aa');
          }
        }

        // Ribbed metallic shoulder pauldrons & collarbone assembly
        drawPixelRect(ctx, -148, -64, 36, 24, isSilhouetteBase ? sEdge : '#52525b');
        drawPixelRect(ctx, 112, -64, 36, 24, isSilhouetteBase ? sEdge : '#52525b');

        // 3. Toy Freddy's Segmented Brown/Orange Arms, Exposed Elbow/Wrist Joints & Claws
        const armCol = isSilhouetteBase ? sDark : '#9a3412';
        const armTrim = isSilhouetteBase ? sEdge : '#f97316';
        const jointCol = isSilhouetteBase ? sMid : '#71717a';
        // Left upper arm, elbow joint, forearm & clawed hand
        drawPixelRect(ctx, -188, -48, 52, 72, armTrim);
        drawPixelRect(ctx, -184, -44, 44, 64, armCol);
        drawPixelRect(ctx, -180, 20, 36, 12, jointCol);
        drawPixelRect(ctx, -196, 28, 48, 68, armTrim);
        drawPixelRect(ctx, -192, 32, 40, 60, armCol);
        for (let c = 0; c < 3; c++) {
          drawPixelRect(ctx, -192 + c * 14, 96, 8, 16, isSilhouetteBase ? sEdge : '#d4d4d8');
        }

        // Right upper arm, elbow joint, forearm & hand (clutching stolen documents ONLY if collectedDocuments is true)
        drawPixelRect(ctx, 136, -48, 52, 72, armTrim);
        drawPixelRect(ctx, 140, -44, 44, 64, armCol);
        drawPixelRect(ctx, 144, 20, 36, 12, jointCol);
        drawPixelRect(ctx, 148, 28, 48, 68, armTrim);
        drawPixelRect(ctx, 152, 32, 40, 60, armCol);

        if (hasCollectedDocsRef.current) {
          // Stolen documents folder clutched in the right hand
          drawPixelRect(ctx, 140, 76, 68, 48, isSilhouetteBase ? sMid : '#eab308');
          drawPixelRect(ctx, 148, 84, 52, 32, isSilhouetteBase ? sEdge : '#fef08a');
          drawPixelRect(ctx, 152, 90, 40, 8, isSilhouetteBase ? sDark : '#dc2626');
          if (!isSilhouetteBase) {
            drawPixelRect(ctx, 152, 102, 36, 4, '#451a03');
            drawPixelRect(ctx, 152, 110, 28, 4, '#451a03');
          }
        } else {
          for (let c = 0; c < 3; c++) {
            drawPixelRect(ctx, 152 + c * 14, 96, 8, 16, isSilhouetteBase ? sEdge : '#d4d4d8');
          }
        }

        // 4. Three Articulated Metallic Endoskeleton Neck Struts with Pistons & Power Cables
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
            drawPixelRect(ctx, sx - 14, sy - 12, 28, 20, isSilhouetteBase ? sDark : '#52525b');
            drawPixelRect(
              ctx,
              sx - 8,
              sy - 8,
              16,
              12,
              isSilhouetteBase ? sMid : s % 2 === 0 ? '#e4e4e7' : '#27272a'
            );
            if (!isSilhouetteBase && s % 3 === 0) {
              drawPixelRect(ctx, sx - 16, sy - 4, 4, 12, cableColor);
            }
          }
        };

        drawPixelStrut(0, -52, ffX, ffY + 24, '#ef4444');
        drawPixelStrut(-48, -32, bonnetX, bonnetY, '#ec4899');
        drawPixelStrut(48, -32, bbX, bbY, '#38bdf8');

        // HEAD B (LEFT SIDE ON STRUT): Bonnet (100% original design as in image_222aef6f.png)
        ctx.save();
        ctx.translate(bonnetX, bonnetY);
        const bonnetCol = isSilhouetteBase ? sDark : '#f472b6';
        const bonnetTrim = isSilhouetteBase ? sEdge : '#db2777';

        drawPixelRect(ctx, -32, -88, 20, 48, bonnetTrim);
        drawPixelRect(ctx, -28, -84, 12, 44, bonnetCol);
        drawPixelRect(ctx, 12, -84, 20, 44, bonnetTrim);
        drawPixelRect(ctx, 16, -80, 12, 40, bonnetCol);

        drawPixelRect(ctx, -44, -40, 88, 80, bonnetTrim);
        drawPixelRect(ctx, -40, -36, 80, 72, bonnetCol);

        drawPixelRect(ctx, -28, -24, 20, 20, '#09090b');
        drawPixelRect(ctx, 8, -24, 20, 20, '#09090b');
        drawPixelRect(ctx, -24, -32, 4, 12, isSilhouetteBase ? sMid : '#71717a');
        drawPixelRect(ctx, 16, -32, 4, 12, isSilhouetteBase ? sMid : '#71717a');

        drawPixelRect(ctx, -28, 8, 56, 24, '#09090b');
        ctx.restore();

        // HEAD C (RIGHT SIDE ON STRUT): Balloon Boy / Ennard (Half mask with cap, half ribbed endoskeleton & sparking wires)
        ctx.save();
        ctx.translate(bbX, bbY);
        drawPixelRect(ctx, -44, -40, 44, 80, isSilhouetteBase ? sDark : '#fed7aa');
        drawPixelRect(ctx, -40, -56, 40, 20, isSilhouetteBase ? sMid : '#2563eb');
        drawPixelRect(ctx, -24, -76, 24, 20, isSilhouetteBase ? sEdge : '#dc2626');

        drawPixelRect(ctx, 0, -40, 44, 80, isSilhouetteBase ? sEdge : '#52525b');
        drawPixelRect(ctx, 4, -36, 36, 72, isSilhouetteBase ? sDark : '#9ca3af');
        drawPixelRect(ctx, 0, -40, 4, 80, isSilhouetteBase ? sMid : '#e4e4e7');
        if (!isSilhouetteBase) {
          for (let ry = -32; ry <= -12; ry += 8) {
            drawPixelRect(ctx, 8, ry, 28, 4, '#52525b');
          }
        }

        drawPixelRect(ctx, -28, -20, 20, 20, '#09090b');
        drawPixelRect(ctx, -20, -12, 8, 8, isSilhouetteBase ? '#7f1d1d' : '#ef4444');
        drawPixelRect(ctx, 8, -20, 20, 20, '#09090b');

        drawPixelRect(ctx, 20, -16, 44, 4, isSilhouetteBase ? sEdge : '#ef4444');
        drawPixelRect(ctx, 24, -8 + wireShift, 48, 4, isSilhouetteBase ? sMid : '#38bdf8');
        drawPixelRect(ctx, 16, 0 - wireShift, 40, 4, isSilhouetteBase ? sEdge : '#eab308');
        if (!isSilhouetteBase && Math.floor(timeSec * 16) % 2 === 0) {
          drawPixelRect(ctx, 64, -8 + wireShift, 8, 8, '#fef08a');
        }

        drawPixelRect(ctx, -32, 8, 64, 24, '#09090b');
        if (!isSilhouetteBase) {
          for (let tx = -28; tx <= 20; tx += 12) {
            drawPixelRect(ctx, tx, 8, 8, 8, '#ffffff');
            drawPixelRect(ctx, tx, 24, 8, 8, '#ffffff');
          }
        }
        ctx.restore();

        // HEAD A (TOP CENTER): Funtime Freddy / Puppet Split-Faceplate Head Revealing Inner Endoskeleton!
        ctx.save();
        ctx.translate(ffX, ffY);

        // Exposed inner metallic endoskeleton skull & cranial struts
        drawPixelRect(ctx, -52, -56, 104, 104, isSilhouetteBase ? sEdge : '#52525b');
        drawPixelRect(ctx, -44, -48, 88, 88, isSilhouetteBase ? sDark : '#18181b');
        if (!isSilhouetteBase) {
          drawPixelRect(ctx, -4, -48, 8, 52, '#71717a');
          drawPixelRect(ctx, -40, -40, 80, 6, '#3f3f46');
        }
        drawPixelRect(ctx, -36, -32, 24, 24, '#09090b');
        drawPixelRect(ctx, 12, -32, 24, 24, '#09090b');
        drawPixelRect(ctx, -28, -24, 12, 12, isSilhouetteBase ? '#7f1d1d' : '#ef4444');
        drawPixelRect(ctx, 16, -24, 12, 12, isSilhouetteBase ? '#7f1d1d' : '#ef4444');
        if (!isSilhouetteBase) {
          drawPixelRect(ctx, -24, -20, 4, 4, '#ffffff');
          drawPixelRect(ctx, 20, -20, 4, 4, '#ffffff');
        }

        // Unhinged screaming endoskeleton jaw with double rows of teeth
        drawPixelRect(ctx, -36, 8, 72, 32 + screamJaw, '#09090b');
        for (let tx = -32; tx <= 24; tx += 12) {
          drawPixelRect(ctx, tx, 8, 8, 12, isSilhouetteBase ? sMid : '#ffffff');
          drawPixelRect(ctx, tx, 28 + screamJaw, 8, 12, isSilhouetteBase ? sMid : '#ffffff');
        }

        // Left & Right White/Pink Split Faceplates sliding open outward
        drawPixelRect(ctx, -68 - maskSplit, -64, 64, 112, isSilhouetteBase ? sEdge : '#cbd5e1');
        drawPixelRect(ctx, -64 - maskSplit, -60, 56, 104, isSilhouetteBase ? sDark : '#ffffff');
        drawPixelRect(ctx, -56 - maskSplit, 4, 24, 24, isSilhouetteBase ? sMid : '#ec4899');
        drawPixelRect(ctx, -44 - maskSplit, -32, 24, 24, '#09090b');
        drawPixelRect(ctx, -60 - maskSplit, -84, 24, 24, isSilhouetteBase ? sEdge : '#f472b6');

        drawPixelRect(ctx, 4 + maskSplit, -64, 64, 112, isSilhouetteBase ? sEdge : '#cbd5e1');
        drawPixelRect(ctx, 8 + maskSplit, -60, 56, 104, isSilhouetteBase ? sDark : '#ffffff');
        drawPixelRect(ctx, 32 + maskSplit, 4, 24, 24, isSilhouetteBase ? sMid : '#ec4899');
        drawPixelRect(ctx, 20 + maskSplit, -32, 24, 24, '#09090b');
        drawPixelRect(ctx, 36 + maskSplit, -84, 24, 24, isSilhouetteBase ? sEdge : '#f472b6');

        drawPixelRect(ctx, -36, -96, 72, 12, '#09090b');
        drawPixelRect(ctx, -24, -132, 48, 36, isSilhouetteBase ? sDark : '#18181b');
        ctx.restore();
      };

      // 1. Always render the dark final-form silhouette base
      renderTheThingFinalFormLayer(true);

      // 2. Smoothly illuminate the exact same final-form geometry as he enters the overhead spotlight
      if (detailLit > 0.01) {
        ctx.save();
        ctx.globalAlpha = detailLit;
        renderTheThingFinalFormLayer(false);
        ctx.restore();
      }

      ctx.restore();

      // First-person duct tape over Richard's lips being ripped off by The Thing (ONLY in the documents chair route!)
      if (
        currentPhase === 'FP_THE_THING_APPROACH_REVEAL' ||
        (currentPhase === 'FP_TAPE_RIP_AND_DIALOGUE' && tapeRipProgress < 1)
      ) {
        const ripP = currentPhase === 'FP_THE_THING_APPROACH_REVEAL' ? 0 : tapeRipProgress;
        const tapeX = W / 2 - 168 + ripP * 260;
        const tapeY = H - 120 - ripP * 44;
        const tapeAlpha = Math.max(0, 1 - ripP * 1.1);

        ctx.save();
        ctx.globalAlpha = tapeAlpha;
        drawPixelRect(ctx, tapeX, tapeY, 336, 56, '#64748b');
        drawPixelRect(ctx, tapeX + 8, tapeY + 8, 320, 40, '#94a3b8');
        drawPixelRect(ctx, tapeX + 16, tapeY + 20, 304, 16, '#cbd5e1');

        if (currentPhase === 'FP_TAPE_RIP_AND_DIALOGUE' && ripP < 1) {
          drawPixelRect(ctx, tapeX + 140, tapeY - 64, 48, 76, '#7c2d12');
          drawPixelRect(ctx, tapeX + 132, tapeY - 12, 16, 32, '#cbd5e1');
          drawPixelRect(ctx, tapeX + 160, tapeY - 12, 16, 32, '#cbd5e1');
          drawPixelRect(ctx, tapeX + 188, tapeY - 12, 16, 32, '#cbd5e1');
        }
        ctx.restore();
      }
    };

    // ========================================================================
    // NO-DOCUMENTS ROUTE SCENE 1: EVEN DARKER ROOM WITH DIM CEILING LIGHT &
    // RICHARD WAKING UP ON THE FLOOR CONFUSED
    // ("Richard aparece en una sala aun mas oscura (con una tenue luz en el techo)
    //  en el suelo, y con una animacion de confundido debe levantarse")
    // ========================================================================
    const drawNoDocsDarkFloorScene = (
      ctx: CanvasRenderingContext2D,
      W: number,
      H: number,
      timeSec: number,
      currentPhase: PostNight4MinigamePhase,
      elapsedSec: number
    ) => {
      // Pitch-black outer void & even darker backroom walls
      ctx.fillStyle = '#010103';
      ctx.fillRect(0, 0, W, H);

      drawPixelRect(ctx, 120, 36, 720, 384, '#030408');
      drawPixelRect(ctx, 120, 344, 720, 76, '#05060c');
      // Subtle floor tiles in near-total darkness
      for (let fx = 120; fx < 840; fx += 48) {
        drawPixelRect(ctx, fx, 344, 24, 76, '#080a12');
      }

      // Dim light fixture on the ceiling ("una tenue luz en el techo")
      const lightX = 336;
      const flicker = Math.sin(timeSec * 14) > 0.92 ? 0.65 : 1;
      drawPixelRect(ctx, lightX - 4, 36, 8, 28, '#18181b');
      drawPixelRect(ctx, lightX - 24, 64, 48, 10, '#27272a');
      drawPixelRect(ctx, lightX - 12, 74, 24, 6, flicker < 1 ? '#a16207' : '#fde047');

      // Soft dim overhead light cone illuminating Richard on the floor
      ctx.save();
      const coneGrad = ctx.createRadialGradient(lightX, 82, 10, lightX, 290, 220);
      coneGrad.addColorStop(0, `rgba(254, 240, 138, ${(0.18 * flicker).toFixed(3)})`);
      coneGrad.addColorStop(0.55, `rgba(253, 224, 71, ${(0.07 * flicker).toFixed(3)})`);
      coneGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = coneGrad;
      ctx.fillRect(120, 36, 720, 384);
      ctx.restore();

      const standState: PostNight4FloorStandUpState =
        currentPhase === 'NO_DOCS_FLOOR_STAND_UP'
          ? getPostNight4FloorStandUpState(elapsedSec)
          : {
              stage: 'STANDING_CONFUSED',
              standProgress: 1,
              headLookDir: (Math.floor(timeSec * 2.2) % 2 === 0 ? -1 : 1) as -1 | 1,
              showConfusionMarks: true,
              completed: true,
            };

      const groundY = 368;
      const rx = lightX;

      if (standState.stage === 'LYING_DAZED') {
        // Richard lying flat on the floor, head twitching dazedly
        const headShakeX = Math.round(Math.sin(timeSec * 18) * 2);
        drawPixelRect(ctx, rx - 48, groundY - 6, 96, 8, 'rgba(0,0,0,0.65)');
        // Legs & shoes lying horizontally
        drawPixelRect(ctx, rx - 44, groundY - 18, 32, 14, '#1e293b');
        drawPixelRect(ctx, rx - 52, groundY - 22, 10, 18, '#451a03');
        // Blue guard jacket torso lying horizontally
        drawPixelRect(ctx, rx - 12, groundY - 22, 36, 18, '#1e3a8a');
        drawPixelRect(ctx, rx - 16, groundY - 14, 24, 8, '#172554');
        // Head & cap on the right side of the floor
        drawPixelRect(ctx, rx + 24 + headShakeX, groundY - 26, 22, 20, '#fcd34d');
        drawPixelRect(ctx, rx + 22 + headShakeX, groundY - 30, 24, 6, '#451a03');
        drawPixelRect(ctx, rx + 36 + headShakeX, groundY - 18, 4, 4, '#09090b');
      } else if (standState.stage === 'KNEELING_CONFUSED') {
        // Richard pushing himself up onto his knees, shaking his head in confusion
        const lookDir = standState.headLookDir;
        drawPixelRect(ctx, rx - 24, groundY - 4, 48, 6, 'rgba(0,0,0,0.6)');
        // Bent knees on the floor
        drawPixelRect(ctx, rx - 16, groundY - 18, 14, 16, '#1e293b');
        drawPixelRect(ctx, rx + 2, groundY - 18, 14, 16, '#0f172a');
        drawPixelRect(ctx, rx - 22, groundY - 8, 12, 8, '#451a03');
        drawPixelRect(ctx, rx + 10, groundY - 8, 12, 8, '#271509');
        // Torso leaning forward slightly
        drawPixelRect(ctx, rx - 14, groundY - 50, 28, 32, '#1e3a8a');
        drawPixelRect(ctx, rx - 4, groundY - 46, 8, 24, '#93c5fd');
        // One hand on the floor, one hand near his head in confusion
        drawPixelRect(ctx, rx - 20, groundY - 44, 6, 28, '#172554');
        drawPixelRect(ctx, rx + 14, groundY - 56, 6, 22, '#172554');
        drawPixelRect(ctx, rx + 14, groundY - 60, 6, 6, '#fcd34d');
        // Head looking left and right in confusion
        drawPixelRect(ctx, rx - 12, groundY - 74, 24, 24, '#fcd34d');
        drawPixelRect(ctx, rx - 14, groundY - 78, 28, 8, '#451a03');
        drawPixelRect(ctx, lookDir === 1 ? rx + 4 : rx - 8, groundY - 64, 4, 4, '#09090b');
      } else if (standState.stage === 'STANDING_UP') {
        // Rising from knees to full standing height
        const riseOffset = Math.round((1 - (standState.standProgress - 0.5) / 0.5) * 18);
        draw8BitProtagonist(
          ctx,
          rx,
          groundY + riseOffset,
          standState.headLookDir,
          0,
          false,
          true,
          timeSec
        );
      } else {
        // Completely standing up, looking around confused ("cuando este completamente de pie debe decir Donde- donde estoy")
        const facingDir: -1 | 1 =
          currentPhase === 'NO_DOCS_SHADOW_VOICE_DIALOGUE'
            ? 1 // Turns toward the voice in the darkness on the right!
            : standState.headLookDir;
        draw8BitProtagonist(ctx, rx, groundY, facingDir, 0, false, true, timeSec);
      }

      // Floating 8-bit "?" confusion marks above Richard's head while confused
      if (
        standState.stage === 'KNEELING_CONFUSED' ||
        standState.stage === 'STANDING_CONFUSED'
      ) {
        const qBobY = Math.round(Math.sin(timeSec * 7) * 4);
        const qBaseY =
          standState.stage === 'KNEELING_CONFUSED'
            ? groundY - 98 + qBobY
            : groundY - 118 + qBobY;
        ctx.save();
        ctx.fillStyle = '#fde047';
        ctx.font = 'bold 16px "IBM Plex Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('?', rx - 18, qBaseY);
        ctx.fillText('?', rx + 18, qBaseY - 4);
        ctx.restore();
      }

      // Deep darkness on the right side where The Thing speaks before revealing himself
      if (currentPhase === 'NO_DOCS_SHADOW_VOICE_DIALOGUE') {
        const pulse = 0.55 + 0.45 * Math.sin(timeSec * 8);
        ctx.save();
        ctx.globalAlpha = pulse;
        drawPixelRect(ctx, 688, 212, 6, 6, '#ef4444');
        drawPixelRect(ctx, 704, 212, 6, 6, '#ef4444');
        ctx.restore();
      }
    };

    // ========================================================================
    // NO-DOCUMENTS ROUTE SCENE 2: REUSED FIRST-PERSON LUNGE, SHRINKING CIRCLE
    // QTE, PUSH & KICK ANIMATION, AND ADAPTED CLOSE-UP JUMPSCARE
    // Reuses the exact geometry & animations from EightBitPostNight5EndingMinigame!
    // ========================================================================
    const drawScreenGrabbingClawsReused = (
      ctx: CanvasRenderingContext2D,
      w: number,
      h: number,
      grabHandsProgress: number,
      timeSec: number,
      jx: number,
      clawPushBackPx = 0
    ) => {
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
    };

    const drawDetailedFirstPersonResistHandsReused = (
      ctx: CanvasRenderingContext2D,
      W: number,
      H: number,
      qteHitsCount: number,
      shovePulse: number,
      timeSec: number
    ) => {
      const strainJitterX = Math.round(Math.sin(timeSec * 75) * (3 + qteHitsCount * 2));
      const strainJitterY = Math.round(Math.cos(timeSec * 85) * (3 + qteHitsCount * 2));
      const shoveUpY = Math.round(shovePulse * 68 + qteHitsCount * 14);
      const shoveOutX = Math.round(shovePulse * 48 + qteHitsCount * 18);

      const drawSingleDetailedArmAndHand = (side: -1 | 1) => {
        ctx.save();
        const baseX =
          side === -1
            ? 196 - shoveOutX + strainJitterX
            : W - 196 + shoveOutX - strainJitterX;
        const baseY = 356 - shoveUpY + strainJitterY;
        ctx.translate(baseX, baseY);

        const sleeveH = Math.max(180, H - baseY + 60);
        drawPixelRect(ctx, -38, 40, 76, sleeveH, '#172554');
        drawPixelRect(ctx, -32, 40, 64, sleeveH, '#1e3a8a');
        drawPixelRect(ctx, -32, 26, 64, 14, '#93c5fd');

        drawPixelRect(ctx, -36, -12, 72, 38, '#f59e0b');
        drawPixelRect(ctx, -32, -8, 64, 30, '#fcd34d');

        const thumbX = side === -1 ? 32 : -52;
        drawPixelRect(ctx, thumbX, -10, 20, 18, '#f59e0b');
        drawPixelRect(ctx, thumbX + 2, -8, 16, 14, '#fcd34d');

        const fingerOffsetsX = [-32, -14, 4, 22];
        const fingerHeights = [28, 32, 28, 24];
        for (let f = 0; f < 4; f++) {
          const fx = fingerOffsetsX[f];
          const fh = fingerHeights[f] + Math.round(shovePulse * 8);
          const fy = -12 - fh;
          drawPixelRect(ctx, fx, fy, 12, fh, '#f59e0b');
          drawPixelRect(ctx, fx, fy + 4, 10, fh - 4, '#fcd34d');
        }

        if (shovePulse > 0.05) {
          const sparkSpread = Math.round((1 - shovePulse) * 40);
          drawPixelRect(ctx, -44 - sparkSpread, -40 - sparkSpread, 14, 4, '#fef08a');
          drawPixelRect(ctx, 32 + sparkSpread, -44 - sparkSpread, 14, 4, '#ffffff');
        }

        ctx.restore();
      };

      drawSingleDetailedArmAndHand(-1);
      drawSingleDetailedArmAndHand(1);
    };

    const drawNoDocsLungeAndCircleQteScene = (
      ctx: CanvasRenderingContext2D,
      W: number,
      H: number,
      timeSec: number,
      currentPhase: PostNight4MinigamePhase,
      elapsedSec: number,
      qteHitsCount: number,
      lastHitTimeSec: number
    ) => {
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

      // Demacrado Still Freddy remains visible in the background on the left while The Thing lunges!
      drawFirstPersonStillFreddyFromShadows(ctx, timeSec, 1);

      const isLunge = currentPhase === 'NO_DOCS_FP_LUNGE_ATTACK';
      const isJumpscare = currentPhase === 'NO_DOCS_FP_FAIL_JUMPSCARE';
      const isKick =
        currentPhase === 'NO_DOCS_FP_KICK_IMPACT' ||
        currentPhase === 'NO_DOCS_FADE_OUT_SCREAM_DIALOGUE';
      const timeSinceHit = Math.max(0, elapsedSec - lastHitTimeSec);
      const shovePulse =
        currentPhase === 'NO_DOCS_FP_CIRCLE_QTE' &&
        lastHitTimeSec > 0 &&
        timeSinceHit < 0.36
          ? Math.pow(1 - timeSinceHit / 0.36, 1.3)
          : 0;

      let scale = 1.68;
      let extraMaskSplit = 48;
      let extraJawOpen = 16;
      let shakeAmp = 4 + shovePulse * 16;
      let cxOffset = W / 2;
      let cyOffset = 430;

      if (isLunge) {
        // Lunges from his standing position beside Still Freddy (cx = W/2 + 92, cy = 286, scale = 1.20)
        // straight at the player into close-up grab (cx = W/2, cy = 430, scale = 1.68)!
        const lungeP = Math.min(1, elapsedSec / 0.55);
        const easeLunge = 1 - Math.pow(1 - lungeP, 3);
        scale = 1.2 + easeLunge * 0.48;
        cxOffset = W / 2 + Math.round((1 - easeLunge) * 92);
        cyOffset = 286 + Math.round(easeLunge * 144);
        extraMaskSplit = Math.round(36 + easeLunge * 12);
        shakeAmp = 12 * easeLunge;
      } else if (currentPhase === 'NO_DOCS_FP_CIRCLE_QTE') {
        scale = 1.68 - qteHitsCount * 0.09 - shovePulse * 0.11;
        cyOffset = 430 - shovePulse * 18;
      } else if (isKick) {
        const kickP =
          currentPhase === 'NO_DOCS_FADE_OUT_SCREAM_DIALOGUE'
            ? 1
            : Math.min(1, elapsedSec / 0.8);
        scale = Math.max(0.85, 1.52 - kickP * 0.67);
        cyOffset = 430 - kickP * 110;
        shakeAmp = 18 * (1 - kickP) + (currentPhase === 'NO_DOCS_FADE_OUT_SCREAM_DIALOGUE' ? 6 : 0);
      } else if (isJumpscare) {
        const jsT = elapsedSec;
        const lungeP = Math.min(1, jsT / 0.52);
        scale = 1.68 + lungeP * 1.22 + Math.sin(timeSec * 44) * 0.14;
        cyOffset = 430 + lungeP * 140;
        extraMaskSplit = 72;
        extraJawOpen = 38 + Math.round(Math.abs(Math.sin(timeSec * 34)) * 26);
        shakeAmp = 26;

        const strobeRed = Math.floor(timeSec * 32) % 2 === 0;
        ctx.fillStyle = strobeRed ? 'rgba(68, 4, 12, 0.78)' : 'rgba(4, 2, 6, 0.82)';
        ctx.fillRect(0, 0, W, H);
      }

      const jx = Math.round(Math.sin(timeSec * 135) * shakeAmp);
      const jy = Math.round(Math.cos(timeSec * 160) * (shakeAmp * 0.85));

      ctx.save();
      ctx.translate(cxOffset + jx, cyOffset + jy);
      ctx.scale(scale, scale);

      const ffX = 0;
      const ffY = -188;
      const bonnetX = -192;
      const bonnetY = -104;
      const bbX = 192;
      const bbY = -100;
      const maskSplit = extraMaskSplit;
      const screamJaw = extraJawOpen + Math.round(Math.abs(Math.sin(timeSec * 18)) * 12);
      const wireShift = Math.round(Math.sin(timeSec * 15) * 4);

      drawPixelRect(ctx, -100, 96, 60, 68, '#991b1b');
      drawPixelRect(ctx, -92, 104, 44, 52, '#7f1d1d');
      drawPixelRect(ctx, 40, 96, 60, 68, '#991b1b');
      drawPixelRect(ctx, 48, 104, 44, 52, '#7f1d1d');
      drawPixelRect(ctx, -88, 160, 36, 12, '#52525b');
      drawPixelRect(ctx, 52, 160, 36, 12, '#52525b');
      drawPixelRect(ctx, -80, 172, 24, 60, '#d4d4d8');
      drawPixelRect(ctx, 56, 172, 24, 60, '#d4d4d8');

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

      // HEAD B (LEFT): Bonnet
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

      ctx.restore();

      // Reused Screen-Grabbing Claws holding Richard from both sides
      if (!isKick) {
        const grabProgress = isLunge ? Math.min(1, elapsedSec / 0.45) : 1;
        const clawPushBackPx =
          currentPhase === 'NO_DOCS_FP_CIRCLE_QTE'
            ? Math.round(qteHitsCount * 22 + shovePulse * 48)
            : 0;
        drawScreenGrabbingClawsReused(
          ctx,
          W,
          H,
          grabProgress,
          timeSec,
          jx,
          clawPushBackPx
        );
      }

      // Reused First-Person Resist Hands pushing back on QTE hits 1 & 2
      if (currentPhase === 'NO_DOCS_FP_CIRCLE_QTE') {
        drawDetailedFirstPersonResistHandsReused(
          ctx,
          W,
          H,
          qteHitsCount,
          shovePulse,
          timeSec
        );
      }

      // Reused First-Person Boot Kick Animation on 3rd hit ("haciendo la misma animcion del final uno de empujar y luego una patada")
      if (currentPhase === 'NO_DOCS_FP_KICK_IMPACT') {
        const kickP = Math.min(1, elapsedSec / 0.65);
        const bootY = Math.round(520 - Math.sin(kickP * Math.PI) * 320);
        drawPixelRect(ctx, 428, bootY + 76, 104, 260, '#1e293b');
        drawPixelRect(ctx, 408, bootY, 144, 84, '#271509');
        drawPixelRect(ctx, 408, bootY, 144, 20, '#451a03');
        for (let tx = 416; tx < 544; tx += 24) {
          drawPixelRect(ctx, tx, bootY - 6, 14, 6, '#18181b');
        }
      }

      // Distortion & Blackout during Failed Circle QTE Jumpscare
      if (isJumpscare) {
        if (elapsedSec >= 1.95) {
          const fixedPositions = [0.16, 0.38, 0.62, 0.85];
          fixedPositions.forEach((ratio, idx) => {
            const jitterY = Math.round(Math.sin(timeSec * 90 + idx * 2.1) * 12);
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
            const by = Math.floor(((timeSec * 420 + b * 173) % H) / 4) * 4;
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
        if (elapsedSec >= 2.65) {
          const blackoutAlpha = Math.min(1, (elapsedSec - 2.65) / 0.85);
          ctx.fillStyle = `rgba(0, 0, 0, ${blackoutAlpha.toFixed(3)})`;
          ctx.fillRect(0, 0, W, H);
        }
      }
    };

    const drawStillNothingBadEndingSceneReused = (
      ctx: CanvasRenderingContext2D,
      W: number,
      H: number,
      timeSec: number
    ) => {
      ctx.fillStyle = '#020306';
      ctx.fillRect(0, 0, W, H);

      const roomLeft = 20;
      const roomRight = 940;
      const roomW = roomRight - roomLeft;

      drawPixelRect(ctx, roomLeft, 16, roomW, 412, '#06070d');
      drawPixelRect(ctx, roomLeft, 428, roomW, H - 428, '#090b12');

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

      drawPixelRect(ctx, -68, 108, 52, 76, '#3730a3');
      drawPixelRect(ctx, -64, 112, 44, 68, '#312e81');
      drawPixelRect(ctx, 16, 108, 52, 44, '#3730a3');
      drawPixelRect(ctx, 28, 152, 28, 32, '#71717a');

      drawPixelRect(ctx, -84, -32, 168, 140, '#3730a3');
      drawPixelRect(ctx, -76, -24, 152, 124, '#312e81');
      drawPixelRect(ctx, -52, 0, 104, 84, '#818cf8');

      drawPixelRect(ctx, 16, 28, 68, 56, '#09090b');
      drawPixelRect(ctx, 20, 36, 56, 8, '#a1a1aa');
      drawPixelRect(ctx, 20, 56, 56, 8, '#71717a');
      drawPixelRect(ctx, 12, 24, 16, 60, '#991b1b');

      drawPixelRect(ctx, -40, -28, 80, 20, '#dc2626');
      drawPixelRect(ctx, -12, -24, 24, 12, '#991b1b');

      drawPixelRect(ctx, -128, -24, 40, 112, '#3730a3');
      drawPixelRect(ctx, -124, -20, 32, 104, '#312e81');
      drawPixelRect(ctx, 88, -24, 40, 60, '#3730a3');
      drawPixelRect(ctx, 96, 36, 24, 52, '#71717a');

      drawPixelRect(ctx, -56, -200, 84, 12, '#18181b');
      drawPixelRect(ctx, -36, -244, 60, 44, '#18181b');
      drawPixelRect(ctx, -84, -192, 28, 28, '#5c2d0c');
      drawPixelRect(ctx, -76, -184, 16, 16, '#3b1a06');
      drawPixelRect(ctx, 48, -192, 8, 24, '#71717a');
      drawPixelRect(ctx, 56, -196, 20, 20, '#52525b');

      drawPixelRect(ctx, -72, -184, 72, 68, '#6b3410');
      drawPixelRect(ctx, -68, -176, 64, 56, '#4a2208');
      drawPixelRect(ctx, 0, -180, 68, 64, '#52525b');
      drawPixelRect(ctx, 4, -176, 60, 56, '#71717a');
      drawPixelRect(ctx, 8, -172, 48, 12, '#a1a1aa');
      drawPixelRect(ctx, 12, -156, 44, 32, '#27272a');
      drawPixelRect(ctx, 12, -164, 36, 32, '#09090b');

      drawPixelRect(ctx, -52, -116, 104, 16, '#3f3f46');
      for (let tx = -44; tx <= 36; tx += 12) {
        drawPixelRect(ctx, tx, -100, 8, 16, '#e4e4e7');
      }
      drawPixelRect(ctx, -56, -68, 56, 32, '#4a2208');
      drawPixelRect(ctx, 0, -68, 52, 28, '#52525b');
      for (let tx = -44; tx <= 36; tx += 12) {
        drawPixelRect(ctx, tx, -80, 8, 12, '#d4d4d8');
      }

      drawPixelRect(ctx, -52, -164, 36, 32, '#09090b');
      const swingX = Math.round(Math.sin(timeSec * 2.5) * 4);
      drawPixelRect(ctx, -38, -140, 8, 44, '#991b1b');
      drawPixelRect(ctx, -36 + Math.round(swingX * 0.5), -128, 4, 32, '#ef4444');
      const eyeX = -36 + swingX;
      const eyeY = -92;
      drawPixelRect(ctx, eyeX - 14, eyeY - 14, 28, 28, '#f8fafc');
      drawPixelRect(ctx, eyeX - 12, eyeY - 8, 6, 4, '#ef4444');
      drawPixelRect(ctx, eyeX - 6, eyeY - 6, 14, 14, '#0284c7');
      drawPixelRect(ctx, eyeX - 2, eyeY - 2, 8, 8, '#09090b');
      drawPixelRect(ctx, eyeX + 2, eyeY - 4, 4, 4, '#ffffff');

      ctx.restore();
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      const sim = simRef.current;
      let currentPhase = phaseRef.current;

      // 1. Update Simulation per Phase (matching Night 2 & Night 3 speeds & transitions)
      if (currentPhase === 'HOTEL_EXTERIOR_WALK') {
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
            HOTEL_EXTERIOR_MIN_X,
            Math.min(HOTEL_EXTERIOR_MAX_X, sim.playerX + moveDir * INTRO_WALK_SPEED_PX_PER_SEC * dt)
          );
          const near = isNearHotelExteriorDoor(sim.playerX);
          setNearExteriorDoor((prev) => (prev !== near ? near : prev));
        }
      } else if (currentPhase === 'HOTEL_EXTERIOR_ENTERING_FADE') {
        sim.fadeAlpha = Math.min(1, sim.fadeAlpha + dt * 1.4);
        if (sim.fadeAlpha >= 1) {
          sim.fadeAlpha = 0;
          setCurrentFloor(1);
          currentFloorRef.current = 1;
          sim.playerX = 180;
          sim.playerFacing = 1;
          syncHallwayProximities(180, 1);
          currentPhase = 'HOTEL_HALLWAY';
          phaseRef.current = currentPhase;
          setPhase(currentPhase);
        }
      } else if (currentPhase === 'HOTEL_ELEVATOR_FADE') {
        if (sim.elevatorFadeStage === 'FADE_OUT') {
          sim.fadeAlpha = Math.min(1, sim.fadeAlpha + dt * 2.2);
          if (sim.fadeAlpha >= 1) {
            const nextFloor = sim.elevatorTargetFloor;
            setCurrentFloor(nextFloor);
            currentFloorRef.current = nextFloor;
            syncHallwayProximities(sim.playerX, nextFloor);
            sim.elevatorFadeStage = 'FADE_IN';
          }
        } else {
          sim.fadeAlpha = Math.max(0, sim.fadeAlpha - dt * 2.2);
          if (sim.fadeAlpha <= 0) {
            sim.fadeAlpha = 0;
            currentPhase = 'HOTEL_HALLWAY';
            phaseRef.current = currentPhase;
            setPhase(currentPhase);
          }
        }
      } else if (currentPhase === 'HOTEL_HALLWAY') {
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
            HOTEL_HALLWAY_MIN_X,
            Math.min(
              HOTEL_HALLWAY_MAX_X,
              sim.playerX + moveDir * (INTRO_WALK_SPEED_PX_PER_SEC * 1.45) * dt
            )
          );
          syncHallwayProximities(sim.playerX, currentFloorRef.current);
        }
      } else if (currentPhase === 'HOTEL_ROOM_FREE_ROAM') {
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
          syncRoomProximities(sim.playerX);
        }
      } else if (currentPhase === 'HOTEL_ROOM_TURN_OFF_LIGHTS_WALK') {
        const walkSpeed = 155;
        if (sim.turnOffLightStage === 'TO_SWITCH') {
          const dir = sim.playerX < HOTEL_LIGHT_SWITCH_X ? 1 : -1;
          sim.playerFacing = dir;
          sim.walkCycle += dt;
          const nextX = sim.playerX + dir * walkSpeed * dt;
          if (Math.abs(nextX - HOTEL_LIGHT_SWITCH_X) <= 6) {
            sim.playerX = HOTEL_LIGHT_SWITCH_X;
            sim.turnOffLightStage = 'AT_SWITCH_PAUSE';
            sim.switchPauseSec = 0;
            soundController.playWoodClick();
            setRoomLightOn(false);
            roomLightOnRef.current = false;
          } else {
            sim.playerX = nextX;
          }
        } else if (sim.turnOffLightStage === 'AT_SWITCH_PAUSE') {
          sim.switchPauseSec += dt;
          if (sim.switchPauseSec >= 0.35) {
            sim.turnOffLightStage = 'BACK_TO_BED';
          }
        } else if (sim.turnOffLightStage === 'BACK_TO_BED') {
          const dir = sim.playerX > HOTEL_BED_STAND_X ? -1 : 1;
          sim.playerFacing = dir;
          sim.walkCycle += dt;
          const nextX = sim.playerX + dir * walkSpeed * dt;
          if (Math.abs(nextX - HOTEL_BED_STAND_X) <= 6) {
            sim.playerX = HOTEL_BED_STAND_X;
            sim.fadeAlpha = 0;
            sim.turnOffLightStage = 'LIE_DOWN_FADE';
          } else {
            sim.playerX = nextX;
          }
        } else if (sim.turnOffLightStage === 'LIE_DOWN_FADE') {
          // Fade to black as Richard lies down in bed ("cuando vaya a dormir y se acueste tiene que ser un fundido negro")
          sim.fadeAlpha = Math.min(1, sim.fadeAlpha + dt * 2.5);
          if (sim.fadeAlpha >= 1) {
            sim.fadeAlpha = 0;
            sim.phaseTimerSec = 0;
            sim.blinkElapsedSec = 0;
            currentPhase = 'FP_SLEEP_BLINKING';
            phaseRef.current = currentPhase;
            setPhase(currentPhase);
          }
        }
      } else if (currentPhase === 'FP_SLEEP_BLINKING') {
        if (Number.isNaN(initialParams.blinkTParam)) {
          sim.blinkElapsedSec += dt;
          if (sim.blinkElapsedSec >= POST_NIGHT_4_BLINK_TOTAL_DURATION_SEC) {
            sim.blinkElapsedSec = POST_NIGHT_4_BLINK_TOTAL_DURATION_SEC;
            sim.phaseTimerSec = 0;
            soundController.playDarkRabbitJumpscare();
            currentPhase = 'FP_RABBIT_JUMPSCARE';
            phaseRef.current = currentPhase;
            setPhase(currentPhase);
          }
        }
      } else if (currentPhase === 'FP_RABBIT_JUMPSCARE') {
        if (Number.isNaN(initialParams.jumpscareTParam)) {
          sim.phaseTimerSec += dt;
          if (sim.phaseTimerSec >= POST_NIGHT_4_RABBIT_JUMPSCARE_DURATION_SEC) {
            sim.phaseTimerSec = 0;
            sim.fadeAlpha = 1;
            currentPhase = 'FP_RABBIT_BLACKOUT';
            phaseRef.current = currentPhase;
            setPhase(currentPhase);
          }
        }
      } else if (currentPhase === 'FP_RABBIT_BLACKOUT') {
        sim.phaseTimerSec += dt;
        sim.fadeAlpha = 1;
        if (sim.phaseTimerSec >= 0.45) {
          sim.phaseTimerSec = 0;
          if (hasCollectedDocsRef.current) {
            sim.fadeAlpha = 0;
            soundController.playFreddyLaugh(0.95);
            currentPhase = 'CHAIR_TIED_LAUGH_INTRO';
          } else {
            sim.fadeAlpha = 1;
            currentPhase = 'NO_DOCS_FLOOR_STAND_UP';
          }
          phaseRef.current = currentPhase;
          setPhase(currentPhase);
        }
      } else if (currentPhase === 'CHAIR_TIED_LAUGH_INTRO') {
        sim.phaseTimerSec += dt;
        if (sim.phaseTimerSec >= POST_NIGHT_4_CHAIR_LAUGH_INTRO_DURATION_SEC) {
          sim.phaseTimerSec = 0;
          currentPhase = 'CHAIR_TIED_INITIAL_DIALOGUE';
          phaseRef.current = currentPhase;
          setPhase(currentPhase);
        }
      } else if (currentPhase === 'CHAIR_TIED_HANDING_OVER_ANIM') {
        sim.phaseTimerSec += dt;
        if (sim.phaseTimerSec >= POST_NIGHT_4_HAND_OVER_ANIM_DURATION_SEC) {
          sim.documentsHandedOver = true;
          sim.phaseTimerSec = 0;
          currentPhase = 'CHAIR_TIED_POST_HANDOVER_DIALOGUE';
          phaseRef.current = currentPhase;
          setPhase(currentPhase);
        }
      } else if (currentPhase === 'FP_THE_THING_APPROACH_REVEAL') {
        if (Number.isNaN(initialParams.revealTParam)) {
          sim.phaseTimerSec += dt;
          sim.theThingRevealProgress = Math.min(
            1,
            sim.phaseTimerSec / POST_NIGHT_4_THE_THING_APPROACH_DURATION_SEC
          );
          if (sim.phaseTimerSec >= POST_NIGHT_4_THE_THING_APPROACH_DURATION_SEC) {
            sim.theThingRevealProgress = 1;
            sim.phaseTimerSec = 0;
            sim.tapeRipProgress = 0;
            revealTabIndexRef.current = 0;
            setRevealTabIndex(0);
            soundController.playDoorSlam(true);
            currentPhase = 'FP_TAPE_RIP_AND_DIALOGUE';
            phaseRef.current = currentPhase;
            setPhase(currentPhase);
          }
        }
      } else if (currentPhase === 'FP_TAPE_RIP_AND_DIALOGUE') {
        sim.phaseTimerSec += dt;
        if (sim.tapeRipProgress < 1) {
          sim.tapeRipProgress = Math.min(1, sim.phaseTimerSec / 0.65);
        }
      } else if (currentPhase === 'FP_STILL_FREDDY_EMERGE_PAUSE') {
        sim.phaseTimerSec += dt;
        sim.freddyEmergeProgress = Math.min(
          1,
          sim.phaseTimerSec / POST_NIGHT_4_FREDDY_EMERGE_DURATION_SEC
        );
        const totalWaitSec =
          POST_NIGHT_4_FREDDY_EMERGE_DURATION_SEC + POST_NIGHT_4_FREDDY_POST_EMERGE_PAUSE_SEC;
        if (sim.phaseTimerSec >= totalWaitSec) {
          sim.freddyEmergeProgress = 1;
          sim.phaseTimerSec = 0;
          currentPhase = 'FP_FINAL_GOOD_LUCK_DIALOGUE';
          phaseRef.current = currentPhase;
          setPhase(currentPhase);
        }
      } else if (currentPhase === 'NO_DOCS_FLOOR_STAND_UP') {
        sim.phaseTimerSec += dt;
        sim.fadeAlpha = Math.max(0, 1 - sim.phaseTimerSec / 0.65);
        if (sim.phaseTimerSec >= POST_NIGHT_4_FLOOR_STAND_UP_DURATION_SEC) {
          sim.fadeAlpha = 0;
          sim.phaseTimerSec = 0;
          currentPhase = 'NO_DOCS_FLOOR_CONFUSED_DIALOGUE';
          phaseRef.current = currentPhase;
          setPhase(currentPhase);
        }
      } else if (currentPhase === 'NO_DOCS_FP_THE_THING_REVEAL') {
        if (Number.isNaN(initialParams.revealTParam)) {
          sim.phaseTimerSec += dt;
          sim.theThingRevealProgress = Math.min(
            1,
            sim.phaseTimerSec / POST_NIGHT_4_THE_THING_APPROACH_DURATION_SEC
          );
          if (sim.phaseTimerSec >= POST_NIGHT_4_THE_THING_APPROACH_DURATION_SEC) {
            sim.theThingRevealProgress = 1;
            sim.phaseTimerSec = 0;
            noDocsTabIndexRef.current = 0;
            setNoDocsTabIndex(0);
            soundController.playFreddyLaugh(0.95);
            currentPhase = 'NO_DOCS_FP_LAUGH_AND_BROTHER_DIALOGUE';
            phaseRef.current = currentPhase;
            setPhase(currentPhase);
          }
        }
      } else if (currentPhase === 'NO_DOCS_FP_STILL_FREDDY_EMERGE_PAUSE') {
        sim.phaseTimerSec += dt;
        sim.freddyEmergeProgress = Math.min(
          1,
          sim.phaseTimerSec / POST_NIGHT_4_FREDDY_EMERGE_DURATION_SEC
        );
        const totalWaitSec =
          POST_NIGHT_4_FREDDY_EMERGE_DURATION_SEC + POST_NIGHT_4_FREDDY_POST_EMERGE_PAUSE_SEC;
        if (sim.phaseTimerSec >= totalWaitSec) {
          sim.freddyEmergeProgress = 1;
          sim.phaseTimerSec = 0;
          currentPhase = 'NO_DOCS_FP_PAY_FAILURES_DIALOGUE';
          phaseRef.current = currentPhase;
          setPhase(currentPhase);
        }
      } else if (currentPhase === 'NO_DOCS_FP_LUNGE_ATTACK') {
        sim.phaseTimerSec += dt;
        if (sim.phaseTimerSec >= POST_NIGHT_4_NO_DOCS_LUNGE_DURATION_SEC) {
          sim.phaseTimerSec = 0;
          sim.qteRoundElapsedSec = 0;
          sim.lastQteHitTimeSec = -1;
          circleQteHitsRef.current = 0;
          setCircleQteHits(0);
          circleQteRingScaleRef.current = POST_NIGHT_4_CIRCLE_QTE_START_SCALE;
          setCircleQteRingScale(POST_NIGHT_4_CIRCLE_QTE_START_SCALE);
          setCircleQteInZone(false);
          currentPhase = 'NO_DOCS_FP_CIRCLE_QTE';
          phaseRef.current = currentPhase;
          setPhase(currentPhase);
        }
      } else if (currentPhase === 'NO_DOCS_FP_CIRCLE_QTE') {
        sim.phaseTimerSec += dt;
        sim.qteRoundElapsedSec += dt;
        const qteState = getPostNight4CircleQteState(sim.qteRoundElapsedSec);
        circleQteRingScaleRef.current = qteState.ringScale;
        setCircleQteRingScale(qteState.ringScale);
        setCircleQteInZone(qteState.isInHitZone);
        if (qteState.missedByTimeout) {
          sim.phaseTimerSec = 0;
          sim.fadeAlpha = 0;
          soundController.playJumpscare();
          currentPhase = 'NO_DOCS_FP_FAIL_JUMPSCARE';
          phaseRef.current = currentPhase;
          setPhase(currentPhase);
        }
      } else if (currentPhase === 'NO_DOCS_FP_KICK_IMPACT') {
        sim.phaseTimerSec += dt;
        if (sim.phaseTimerSec >= 0.85) {
          sim.phaseTimerSec = 0;
          sim.fadeAlpha = 0;
          currentPhase = 'NO_DOCS_FADE_OUT_SCREAM_DIALOGUE';
          phaseRef.current = currentPhase;
          setPhase(currentPhase);
        }
      } else if (currentPhase === 'NO_DOCS_FADE_OUT_SCREAM_DIALOGUE') {
        sim.phaseTimerSec += dt;
        sim.fadeAlpha = Math.min(1, sim.phaseTimerSec / 1.6);
      } else if (currentPhase === 'NO_DOCS_FP_FAIL_JUMPSCARE') {
        sim.phaseTimerSec += dt;
        if (
          sim.phaseTimerSec >= 4.55 &&
          (!soundController.isJumpscarePlaying() || sim.phaseTimerSec >= 5.2)
        ) {
          sim.phaseTimerSec = 0;
          sim.fadeAlpha = 1;
          setBadEndingElapsedSec(0);
          if (!unlockedBadEndingRef.current) {
            unlockedBadEndingRef.current = true;
            onUnlockBadEnding2Ref.current?.();
          }
          currentPhase = 'NO_DOCS_BAD_ENDING_STILL_NOTHING';
          phaseRef.current = currentPhase;
          setPhase(currentPhase);
        }
      } else if (currentPhase === 'NO_DOCS_BAD_ENDING_STILL_NOTHING') {
        sim.phaseTimerSec += dt;
        sim.fadeAlpha = Math.max(0, 1 - sim.phaseTimerSec / 1.1);
        setBadEndingElapsedSec(sim.phaseTimerSec);
      } else if (currentPhase === 'NO_DOCS_BAD_ENDING_FADE_OUT') {
        sim.phaseTimerSec += dt;
        sim.fadeAlpha = Math.min(1, sim.phaseTimerSec / 1.2);
        if (sim.phaseTimerSec >= 1.35) {
          if (!completedRef.current) {
            completedRef.current = true;
            currentPhase = 'COMPLETED';
            phaseRef.current = currentPhase;
            setPhase(currentPhase);
            if (onReturnToTitleRef.current) {
              onReturnToTitleRef.current();
            } else {
              onComplete();
            }
          }
          return;
        }
      } else if (currentPhase === 'FINAL_FADE_TO_NIGHT_5') {
        sim.phaseTimerSec += dt;
        sim.fadeAlpha = Math.min(1, sim.phaseTimerSec / 1.4);
        if (sim.phaseTimerSec >= 1.55) {
          if (!completedRef.current) {
            completedRef.current = true;
            currentPhase = 'COMPLETED';
            phaseRef.current = currentPhase;
            setPhase(currentPhase);
            onComplete();
          }
          return;
        }
      }

      // 2. Render Active 8-Bit Scene
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = false;
          const W = canvas.width;
          const H = canvas.height;
          const timeSec = now / 1000;

          if (
            currentPhase === 'HOTEL_EXTERIOR_WALK' ||
            currentPhase === 'HOTEL_EXTERIOR_ENTERING_FADE'
          ) {
            const isWalking =
              currentPhase === 'HOTEL_EXTERIOR_WALK' &&
              (sim.keysHeld.left || sim.keysHeld.right);
            drawHotelExteriorScene(
              ctx,
              W,
              H,
              timeSec,
              sim.playerX,
              sim.playerFacing,
              sim.walkCycle,
              isWalking
            );
          } else if (
            currentPhase === 'HOTEL_HALLWAY' ||
            currentPhase === 'HOTEL_ELEVATOR_FADE' ||
            currentPhase === 'HOTEL_RECEPTIONIST_DIALOGUE' ||
            currentPhase === 'HOTEL_WRONG_ROOM_DIALOGUE'
          ) {
            const isWalking =
              currentPhase === 'HOTEL_HALLWAY' &&
              (sim.keysHeld.left || sim.keysHeld.right);
            drawHotelHallwayScene(
              ctx,
              W,
              H,
              timeSec,
              currentFloorRef.current,
              sim.playerX,
              sim.playerFacing,
              sim.walkCycle,
              isWalking
            );
          } else if (
            currentPhase === 'HOTEL_ROOM_FREE_ROAM' ||
            currentPhase === 'HOTEL_ROOM_BED_PROMPT' ||
            currentPhase === 'HOTEL_ROOM_TURN_OFF_LIGHTS_WALK'
          ) {
            const isWalking =
              (currentPhase === 'HOTEL_ROOM_FREE_ROAM' &&
                (sim.keysHeld.left || sim.keysHeld.right)) ||
              (currentPhase === 'HOTEL_ROOM_TURN_OFF_LIGHTS_WALK' &&
                (sim.turnOffLightStage === 'TO_SWITCH' ||
                  sim.turnOffLightStage === 'BACK_TO_BED'));
            drawHotelRoomScene(
              ctx,
              W,
              H,
              timeSec,
              sim.playerX,
              sim.playerFacing,
              sim.walkCycle,
              isWalking,
              roomLightOnRef.current
            );
          } else if (currentPhase === 'FP_SLEEP_BLINKING') {
            drawFirstPersonRoom303BlinkingScene(ctx, W, H, timeSec, sim.blinkElapsedSec);
          } else if (currentPhase === 'FP_RABBIT_JUMPSCARE') {
            drawFirstPersonDarkRabbitJumpscare(ctx, W, H, timeSec, sim.phaseTimerSec);
          } else if (currentPhase === 'FP_RABBIT_BLACKOUT') {
            // Pure blackout after the 2.5s..3.1s fade-to-black — NEVER restarts the jumpscare animation!
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, W, H);
          } else if (
            currentPhase === 'CHAIR_TIED_LAUGH_INTRO' ||
            currentPhase === 'CHAIR_TIED_INITIAL_DIALOGUE' ||
            currentPhase === 'CHAIR_TIED_HAND_OVER_PROMPT' ||
            currentPhase === 'CHAIR_TIED_HANDING_OVER_ANIM' ||
            currentPhase === 'CHAIR_TIED_POST_HANDOVER_DIALOGUE'
          ) {
            drawChairTiedThirdPersonScene(
              ctx,
              W,
              H,
              timeSec,
              currentPhase,
              sim.phaseTimerSec,
              sim.documentsHandedOver
            );
          } else if (
            currentPhase === 'NO_DOCS_FLOOR_STAND_UP' ||
            currentPhase === 'NO_DOCS_FLOOR_CONFUSED_DIALOGUE' ||
            currentPhase === 'NO_DOCS_SHADOW_VOICE_DIALOGUE'
          ) {
            drawNoDocsDarkFloorScene(
              ctx,
              W,
              H,
              timeSec,
              currentPhase,
              sim.phaseTimerSec
            );
          } else if (
            currentPhase === 'NO_DOCS_FP_LUNGE_ATTACK' ||
            currentPhase === 'NO_DOCS_FP_CIRCLE_QTE' ||
            currentPhase === 'NO_DOCS_FP_KICK_IMPACT' ||
            currentPhase === 'NO_DOCS_FADE_OUT_SCREAM_DIALOGUE' ||
            currentPhase === 'NO_DOCS_FP_FAIL_JUMPSCARE'
          ) {
            drawNoDocsLungeAndCircleQteScene(
              ctx,
              W,
              H,
              timeSec,
              currentPhase,
              sim.phaseTimerSec,
              circleQteHitsRef.current,
              sim.lastQteHitTimeSec
            );
          } else if (
            currentPhase === 'NO_DOCS_BAD_ENDING_STILL_NOTHING' ||
            currentPhase === 'NO_DOCS_BAD_ENDING_FADE_OUT'
          ) {
            drawStillNothingBadEndingSceneReused(ctx, W, H, timeSec);
          } else {
            drawFirstPersonTheThingRevealScene(
              ctx,
              W,
              H,
              timeSec,
              currentPhase,
              sim.theThingRevealProgress,
              sim.tapeRipProgress,
              sim.freddyEmergeProgress
            );
          }

          // Classic 8-Bit CRT Scanlines Overlay (100% identical to Night 2 & Night 3)
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
  }, [
    initialParams.blinkTParam,
    initialParams.jumpscareTParam,
    initialParams.revealTParam,
    onComplete,
    syncHallwayProximities,
    syncRoomProximities,
  ]);

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

      if (seg.glitchText) {
        return (
          <span key={segIdx} data-testid="glitched-text-segment" className="inline">
            {visibleText.split('').map((ch, idx) => {
              if (ch === ' ') return <span key={idx}> </span>;
              const seed = idx * 23 + trembleTick * 19;
              const gx = ((seed % 5) - 2) * 1.3;
              const gy = (((seed * 7) % 5) - 2) * 1.1;
              const skew = ((seed % 7) - 3) * 5;
              const invertTint = seed % 5 === 0;
              return (
                <span
                  key={idx}
                  data-testid="glitched-letter"
                  style={{
                    display: 'inline-block',
                    transform: `translate(${gx.toFixed(2)}px, ${gy.toFixed(2)}px) skewX(${skew}deg)`,
                    color: invertTint ? '#38bdf8' : '#f43f5e',
                    textShadow: '-2px 0 #ef4444, 2px 0 #22d3ee, 0 0 8px rgba(244, 63, 94, 0.85)',
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

  // Helper to convert hallway world X coordinate to screen percentage (0..100%)
  const toHallwayScreenLeftPct = (worldX: number): string => {
    const pct = ((worldX - hallwayCameraX) / HOTEL_HALLWAY_VIEWPORT_WIDTH) * 100;
    return `${Math.max(4, Math.min(96, pct)).toFixed(2)}%`;
  };

  const activeReceptionistWorldX =
    HOTEL_RECEPTIONISTS.find((r) => r.id === nearbyReceptionistId)?.x ?? 290;

  const badEndingTitleAlpha =
    phase === 'NO_DOCS_BAD_ENDING_STILL_NOTHING' || phase === 'NO_DOCS_BAD_ENDING_FADE_OUT'
      ? Math.max(
          0,
          Math.min(1, (badEndingElapsedSec - BAD_ENDING_TITLE_DELAY_SEC) / 2.2)
        )
      : 0;

  return (
    <div
      data-testid="eight-bit-post-night4-minigame"
      data-phase={phase}
      data-floor={currentFloor}
      data-room-light={roomLightOn ? 'on' : 'off'}
      data-collected-docs={collectedDocuments ? 'true' : 'false'}
      onClick={() => {
        if (phase === 'NO_DOCS_BAD_ENDING_STILL_NOTHING') {
          handleBadEndingScreenClick();
        }
      }}
      className={`fixed inset-0 z-50 bg-black flex flex-col items-center justify-center select-none font-mono ${
        phase === 'NO_DOCS_BAD_ENDING_STILL_NOTHING' &&
        badEndingElapsedSec >= BAD_ENDING_TITLE_DELAY_SEC + 0.5
          ? 'cursor-pointer'
          : ''
      }`}
    >
      <div className="relative w-full h-full flex items-center justify-center bg-black overflow-hidden">
        <canvas
          ref={canvasRef}
          width={960}
          height={540}
          className="w-full h-full object-fill bg-black"
          style={{ imageRendering: 'pixelated' }}
        />

        {/* BAD ENDING SLOW FADE-IN TITLE AT TOP (Exact Rubik Dirt wood typography from TitleScreen.tsx) */}
        {(phase === 'NO_DOCS_BAD_ENDING_STILL_NOTHING' ||
          phase === 'NO_DOCS_BAD_ENDING_FADE_OUT') &&
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
                    id="postnight4-bad-ending-wood-plank-pattern"
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
                  fill="url(#postnight4-bad-ending-wood-plank-pattern)"
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

        {/* NO-DOCUMENTS ROUTE: SHRINKING CIRCLE [E] TIMING QTE */}
        {phase === 'NO_DOCS_FP_CIRCLE_QTE' && (
          <div
            data-testid="postnight4-circle-qte"
            data-in-zone={circleQteInZone ? 'true' : 'false'}
            className="absolute top-[52%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 flex flex-col items-center justify-center"
          >
            <div className="relative w-20 h-20 flex items-center justify-center">
              {/* Outer hit-zone boundary indicator around the target [E] circle */}
              <div
                aria-hidden="true"
                className={`pointer-events-none absolute inset-0 rounded-full border-2 border-dashed transition-colors ${
                  circleQteInZone
                    ? 'border-emerald-400/90 shadow-[0_0_24px_rgba(52,211,153,0.65)]'
                    : 'border-amber-400/45'
                }`}
              />

              {/* Closing/Shrinking Outer Circle ("un circulo que se cierra y cuando llega al circulo de la E pulsar para acertar") */}
              <div
                data-testid="postnight4-shrinking-ring"
                aria-hidden="true"
                style={{
                  transform: `scale(${circleQteRingScale.toFixed(3)})`,
                }}
                className={`pointer-events-none absolute w-16 h-16 rounded-full border-4 transition-colors duration-75 ${
                  circleQteInZone
                    ? 'border-emerald-400 shadow-[0_0_28px_rgba(52,211,153,0.95)]'
                    : 'border-amber-400 shadow-[0_0_18px_rgba(251,191,36,0.75)]'
                }`}
              />

              {/* Target [E] Circle at Center */}
              <button
                type="button"
                data-testid="postnight4-circle-qte-btn"
                data-hits={circleQteHits}
                onClick={handleCircleQtePressE}
                className={`relative z-10 w-16 h-16 rounded-full flex items-center justify-center border-4 font-extrabold text-2xl cursor-pointer transition-colors ${
                  circleQteInZone
                    ? 'bg-emerald-950/95 border-emerald-400 text-emerald-300 shadow-[0_0_26px_rgba(16,185,129,0.85)]'
                    : 'bg-zinc-950/95 border-amber-400 text-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.5)]'
                }`}
              >
                E
              </button>
            </div>
          </div>
        )}

        {/* 1. Hotel Exterior Door [E] Popover (100% identical to Night 2 & Night 3) */}
        {phase === 'HOTEL_EXTERIOR_WALK' && nearExteriorDoor && (
          <button
            type="button"
            data-testid="hotel-exterior-enter-btn"
            aria-label="Entrar al hotel [E]"
            onClick={handleEnterHotelFromOutside}
            className="absolute top-[52%] left-[50%] -translate-x-1/2 -translate-y-1/2 z-20 px-2 py-0.5 bg-zinc-950/95 hover:bg-zinc-900 border-2 border-amber-400 text-amber-300 text-xs font-extrabold shadow-lg cursor-pointer animate-bounce"
          >
            E
          </button>
        )}

        {/* 2. Floor 1 Receptionist [E] Popover */}
        {phase === 'HOTEL_HALLWAY' && currentFloor === 1 && nearbyReceptionistId !== null && (
          <button
            type="button"
            data-testid="hotel-receptionist-interact-btn"
            data-receptionist-id={nearbyReceptionistId}
            aria-label={`Hablar con recepcionista ${nearbyReceptionistId} [E]`}
            onClick={() => handleInteractReceptionist(nearbyReceptionistId)}
            style={{
              left: toHallwayScreenLeftPct(activeReceptionistWorldX),
            }}
            className="absolute top-[46%] -translate-x-1/2 -translate-y-1/2 z-20 px-2 py-0.5 bg-zinc-950/95 hover:bg-zinc-900 border-2 border-amber-400 text-amber-300 text-xs font-extrabold shadow-lg cursor-pointer animate-bounce"
          >
            E
          </button>
        )}

        {/* 3. Left Elevator (BAJAR) [E] Popover */}
        {phase === 'HOTEL_HALLWAY' && currentFloor > 1 && nearElevatorDown && (
          <button
            type="button"
            data-testid="hotel-elevator-down-btn"
            aria-label="Bajar en ascensor izquierdo [E]"
            onClick={handleUseElevatorDown}
            style={{
              left: toHallwayScreenLeftPct(HOTEL_ELEVATOR_DOWN_X),
            }}
            className="absolute top-[46%] -translate-x-1/2 -translate-y-1/2 z-20 px-2 py-0.5 bg-zinc-950/95 hover:bg-zinc-900 border-2 border-amber-400 text-amber-300 text-xs font-extrabold shadow-lg cursor-pointer animate-bounce"
          >
            E
          </button>
        )}

        {/* 4. Right Elevator (SUBIR) [E] Popover */}
        {phase === 'HOTEL_HALLWAY' && currentFloor < 3 && nearElevatorUp && (
          <button
            type="button"
            data-testid="hotel-elevator-up-btn"
            aria-label="Subir en ascensor derecho [E]"
            onClick={handleUseElevatorUp}
            style={{
              left: toHallwayScreenLeftPct(HOTEL_ELEVATOR_UP_X),
            }}
            className="absolute top-[46%] -translate-x-1/2 -translate-y-1/2 z-20 px-2 py-0.5 bg-zinc-950/95 hover:bg-zinc-900 border-2 border-amber-400 text-amber-300 text-xs font-extrabold shadow-lg cursor-pointer animate-bounce"
          >
            E
          </button>
        )}

        {/* 5A. Floor 3 Room 303 Door [E] Popover */}
        {phase === 'HOTEL_HALLWAY' &&
          currentFloor === 3 &&
          nearbyHallwayRoom?.isPlayerRoom && (
            <button
              type="button"
              data-testid="hotel-enter-room-303-btn"
              aria-label="Entrar a habitación 303 [E]"
              onClick={handleEnterRoom303}
              style={{
                left: toHallwayScreenLeftPct(HOTEL_PLAYER_ROOM_303_X),
              }}
              className="absolute top-[46%] -translate-x-1/2 -translate-y-1/2 z-20 px-2 py-0.5 bg-zinc-950/95 hover:bg-zinc-900 border-2 border-amber-400 text-amber-300 text-xs font-extrabold shadow-lg cursor-pointer animate-bounce"
            >
              E
            </button>
          )}

        {/* 5B. Any Non-Player Hotel Room Door [E] Popover */}
        {phase === 'HOTEL_HALLWAY' &&
          nearbyHallwayRoom &&
          !nearbyHallwayRoom.isPlayerRoom && (
            <button
              type="button"
              data-testid="hotel-try-locked-room-btn"
              data-room-number={nearbyHallwayRoom.roomNumber}
              aria-label={`Intentar abrir habitación ${nearbyHallwayRoom.roomNumber} [E]`}
              onClick={handleTryWrongRoomDoor}
              style={{
                left: toHallwayScreenLeftPct(nearbyHallwayRoom.x),
              }}
              className="absolute top-[46%] -translate-x-1/2 -translate-y-1/2 z-20 px-2 py-0.5 bg-zinc-950/95 hover:bg-zinc-900 border-2 border-amber-400 text-amber-300 text-xs font-extrabold shadow-lg cursor-pointer animate-bounce"
            >
              E
            </button>
          )}

        {/* 6. Floor 1 Main Hotel Exit Door [E] Popover */}
        {phase === 'HOTEL_HALLWAY' &&
          currentFloor === 1 &&
          nearHallwayExitDoor && (
            <button
              type="button"
              data-testid="hotel-hallway-exit-btn"
              aria-label="Salir del hotel [E]"
              onClick={handleExitHotelToOutside}
              style={{
                left: toHallwayScreenLeftPct(HOTEL_HALLWAY_EXIT_DOOR_X),
              }}
              className="absolute top-[46%] -translate-x-1/2 -translate-y-1/2 z-20 px-2 py-0.5 bg-zinc-950/95 hover:bg-zinc-900 border-2 border-amber-400 text-amber-300 text-xs font-extrabold shadow-lg cursor-pointer animate-bounce"
            >
              E
            </button>
          )}

        {/* 7. Hotel Room Light Switch [E] Popover */}
        {phase === 'HOTEL_ROOM_FREE_ROAM' && nearLightSwitch && (
          <button
            type="button"
            data-testid="hotel-light-switch-btn"
            aria-label="Interruptor de luz [E]"
            onClick={handleToggleRoomLight}
            style={{
              left: `${(HOTEL_LIGHT_SWITCH_X / 960) * 100}%`,
            }}
            className="absolute top-[48%] -translate-x-1/2 -translate-y-1/2 z-20 px-2 py-0.5 bg-zinc-950/95 hover:bg-zinc-900 border-2 border-amber-400 text-amber-300 text-xs font-extrabold shadow-lg cursor-pointer animate-bounce"
          >
            E
          </button>
        )}

        {/* 8. Hotel Room Bed [E] Popover */}
        {phase === 'HOTEL_ROOM_FREE_ROAM' && nearBed && (
          <button
            type="button"
            data-testid="hotel-bed-interact-btn"
            aria-label="Ir a dormir en la cama [E]"
            onClick={handleInteractBed}
            className="absolute top-[52%] left-[25%] -translate-x-1/2 -translate-y-1/2 z-20 px-2 py-0.5 bg-zinc-950/95 hover:bg-zinc-900 border-2 border-amber-400 text-amber-300 text-xs font-extrabold shadow-lg cursor-pointer animate-bounce"
          >
            E
          </button>
        )}

        {/* 9. Tied to Chair — Hand Over Documents [E] Prompt */}
        {phase === 'CHAIR_TIED_HAND_OVER_PROMPT' && (
          <>
            <button
              type="button"
              onClick={handleHandOverDocuments}
              className="absolute top-[48%] left-[38%] -translate-x-1/2 -translate-y-1/2 z-20 px-2 py-0.5 bg-zinc-950/95 hover:bg-zinc-900 border-2 border-amber-400 text-amber-300 text-xs font-extrabold shadow-lg cursor-pointer animate-bounce"
            >
              E
            </button>
            <div
              data-testid="postnight4-handover-prompt"
              className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center"
            >
              <button
                type="button"
                data-testid="postnight4-handover-btn"
                onClick={handleHandOverDocuments}
                className="px-5 py-2 rounded-lg bg-zinc-950/90 border border-amber-400 text-amber-300 font-bold text-xs uppercase tracking-widest shadow-2xl hover:bg-zinc-900 cursor-pointer"
              >
                {POST_NIGHT_4_HAND_OVER_PROMPT_TEXT}
              </button>
            </div>
          </>
        )}

        {/* 10. Standard 8-Bit Dialogue Box (100% identical to Night 2 & Night 3) */}
        {activeTab && (
          <div
            data-testid="postnight4-dialogue-box"
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
                  data-testid="postnight4-speaker"
                  className="text-sm sm:text-base font-bold uppercase tracking-widest px-2.5 py-0.5 rounded bg-zinc-900 border border-zinc-700"
                  style={{ color: activeTab.speakerColor }}
                >
                  {phase === 'FP_TAPE_RIP_AND_DIALOGUE'
                    ? getPostNight4RevealSpeakerName(revealTabIndex, typedChars)
                    : activeTab.speaker}
                </span>
              </div>
              <span className="text-[11px] text-zinc-400 uppercase tracking-widest">
                HISTORIA 8-BIT
              </span>
            </div>

            <div
              data-testid="postnight4-dialogue-text"
              className="text-base sm:text-xl text-zinc-100 font-semibold leading-relaxed min-h-[3.5rem]"
            >
              {renderSegmentedDialogueText()}
            </div>

            {activeTab.hasYesNoChoice ? (
              <div
                data-testid="postnight4-yes-no-choices"
                className="mt-4 pt-3 border-t border-zinc-800 flex items-center justify-around gap-6"
              >
                <button
                  type="button"
                  data-testid="postnight4-sleep-yes-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleChooseSleepYes();
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
                  data-testid="postnight4-sleep-no-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleChooseSleepNo();
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
              <div className="mt-3 flex items-center justify-end pt-2 border-t border-zinc-900">
                <button
                  type="button"
                  data-testid="postnight4-dialogue-next-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAdvanceDialogue();
                  }}
                  className="px-3.5 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                >
                  PULSA [ENTER] PARA CONTINUAR ▶
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

