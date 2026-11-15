import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  HOTEL_BED_INTERACT_X,
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
  INTRO_DOOR_ENTER_X,
  INTRO_DOOR_STOP_X,
  INTRO_OUTSIDE_MIN_X,
  INTRO_OUTSIDE_SPAWN_X,
  INTRO_WALK_SPEED_PX_PER_SEC,
  POST_NIGHT_2_BED_SLEEP_PROMPT,
  POST_NIGHT_2_WRONG_ROOM_DIALOGUE,
  POST_NIGHT_3_BLACKOUT_MIN_DURATION_SEC,
  POST_NIGHT_3_FLOOR_3_THINKING_DURATION_SEC,
  POST_NIGHT_3_HALLUCINATIONS_DIALOGUE,
  POST_NIGHT_3_HOSPITAL_TABS,
  POST_NIGHT_3_HOTEL_PHONE_TABS,
  POST_NIGHT_3_JUMPSCARE_VISUAL_DURATION_SEC,
  POST_NIGHT_3_PHONE_DECISION_PROMPT,
  POST_NIGHT_3_PHONE_PAUSE_MS,
  POST_NIGHT_3_RABBIT_DRAG_DURATION_SEC,
  PROTAGONIST_NAME_FROM_NIGHT_3,
  PostNight1DialogueTab,
  PostNight3MinigamePhase,
  getHotelFloorRooms,
  getHotelHallwayCameraX,
  getNearbyHotelHallwayRoom,
  getNearbyReceptionist,
  getPostNight3Floor2FlickerState,
  getPostNight3Floor3FlickerState,
  getPostNight3RabbitDragState,
  isNearElevatorDown,
  isNearElevatorUp,
  isNearHotelBed,
  isNearHotelExteriorDoor,
  isNearHotelHallwayExitDoor,
  isNearHotelLightSwitch,
  isNearHotelPhone,
  isNearHotelRoomCentralDoor,
  projectFirstPersonCorridorProp,
} from '../game/rules';
import { soundController } from '../game/audio';

interface EightBitPostNight3MinigameProps {
  onComplete: (answeredHotelCall?: boolean) => void;
}

interface FlattenedChar {
  char: string;
  slightTremble: boolean;
  slowTremble: boolean;
  glitchText: boolean;
  highlightedText: boolean;
}

export const EightBitPostNight3Minigame: React.FC<EightBitPostNight3MinigameProps> = ({
  onComplete,
}) => {
  const initialParams = useMemo(() => {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      return {
        phaseParam: sp.get('postnight3_phase') as PostNight3MinigamePhase | null,
        floorParam: Number(sp.get('hotel_floor')),
        pxParam: Number(sp.get('player_x')),
        fpParam: Number(sp.get('fp_progress')),
        jumpscareTParam: sp.get('jumpscare_t') !== null ? Number(sp.get('jumpscare_t')) : NaN,
      };
    }
    return {
      phaseParam: null,
      floorParam: NaN,
      pxParam: NaN,
      fpParam: NaN,
      jumpscareTParam: NaN,
    };
  }, []);

  const [phase, setPhase] = useState<PostNight3MinigamePhase>(() => {
    if (initialParams.phaseParam) {
      return initialParams.phaseParam;
    }
    return 'FP_WALK_TO_DOOR';
  });

  const [hotelFloor, setHotelFloor] = useState<1 | 2 | 3>(() => {
    if (
      initialParams.floorParam === 1 ||
      initialParams.floorParam === 2 ||
      initialParams.floorParam === 3
    ) {
      return initialParams.floorParam;
    }
    if (initialParams.phaseParam === 'FLOOR_2_FLICKER_EVENT') return 2;
    if (
      initialParams.phaseParam === 'FLOOR_3_FLICKER_EVENT' ||
      initialParams.phaseParam === 'FLOOR_3_THINKING_PAUSE' ||
      initialParams.phaseParam === 'FLOOR_3_POST_FLICKER_DIALOGUE'
    ) {
      return 3;
    }
    return 1;
  });

  const initialPlayerX = useMemo(() => {
    if (!Number.isNaN(initialParams.pxParam) && initialParams.pxParam > 0) {
      return initialParams.pxParam;
    }
    if (
      phase === 'FLOOR_2_FLICKER_EVENT' ||
      phase === 'FLOOR_3_FLICKER_EVENT' ||
      phase === 'FLOOR_3_THINKING_PAUSE' ||
      phase === 'FLOOR_3_POST_FLICKER_DIALOGUE'
    ) {
      return 1480;
    }
    if (
      phase === 'HOTEL_ROOM_FREE_ROAM' ||
      phase === 'HOTEL_ROOM_PHONE_DECISION' ||
      phase === 'HOTEL_ROOM_PHONE_CONVERSATION'
    ) {
      return HOTEL_CENTRAL_DOOR_X;
    }
    if (
      phase === 'HOTEL_ROOM_BED_PROMPT' ||
      phase === 'HOTEL_ROOM_NIGHT_EXIT_WALK'
    ) {
      return HOTEL_BED_STAND_X;
    }
    if (phase === 'FACILITY_NIGHT_EXTERIOR_WALK') {
      return INTRO_OUTSIDE_SPAWN_X;
    }
    return HOTEL_EXTERIOR_SPAWN_X;
  }, [initialParams.pxParam, phase]);

  const [hospitalTabIndex, setHospitalTabIndex] = useState<number>(0);
  const [phoneTabIndex, setPhoneTabIndex] = useState<number>(0);
  const [activeReceptionistId, setActiveReceptionistId] = useState<number | null>(null);
  const [roomLightOn, setRoomLightOn] = useState<boolean>(true);
  const [phoneResolved, setPhoneResolved] = useState<boolean>(
    () =>
      phase === 'HOTEL_ROOM_BED_PROMPT' ||
      phase === 'HOTEL_ROOM_SLEEP_ANIMATION' ||
      phase === 'HOTEL_ROOM_WAKE_ANIMATION' ||
      phase === 'HOTEL_ROOM_NIGHT_EXIT_WALK'
  );
  const [answeredHotelCall, setAnsweredHotelCall] = useState<boolean>(false);
  const [selectedChoice, setSelectedChoice] = useState<'SI' | 'NO'>('SI');

  // Proximity UI states
  const [hallwayCameraX, setHallwayCameraX] = useState<number>(() =>
    getHotelHallwayCameraX(initialPlayerX)
  );
  const [nearHotelExteriorDoor, setNearHotelExteriorDoor] = useState<boolean>(() =>
    isNearHotelExteriorDoor(initialPlayerX)
  );
  const [nearHallwayExitDoor, setNearHallwayExitDoor] = useState<boolean>(() =>
    isNearHotelHallwayExitDoor(initialPlayerX)
  );
  const [nearbyReceptionist, setNearbyReceptionist] = useState<number | null>(() =>
    getNearbyReceptionist(initialPlayerX)?.id ?? null
  );
  const [nearElevatorDown, setNearElevatorDown] = useState<boolean>(() =>
    isNearElevatorDown(initialPlayerX)
  );
  const [nearElevatorUp, setNearElevatorUp] = useState<boolean>(() =>
    isNearElevatorUp(initialPlayerX)
  );
  const [nearRoom303Door, setNearRoom303Door] = useState<boolean>(false);
  const [nearbyLockedRoomNumber, setNearbyLockedRoomNumber] = useState<string | null>(null);
  const [nearLightSwitch, setNearLightSwitch] = useState<boolean>(() =>
    isNearHotelLightSwitch(initialPlayerX)
  );
  const [nearPhone, setNearPhone] = useState<boolean>(() =>
    isNearHotelPhone(initialPlayerX)
  );
  const [nearBed, setNearBed] = useState<boolean>(() => isNearHotelBed(initialPlayerX));
  const [nearRoomCentralDoor, setNearRoomCentralDoor] = useState<boolean>(() =>
    isNearHotelRoomCentralDoor(initialPlayerX)
  );

  const [revealedCount, setRevealedCount] = useState<number>(0);
  const [trembleTick, setTrembleTick] = useState<number>(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const phaseRef = useRef<PostNight3MinigamePhase>(phase);
  phaseRef.current = phase;

  const floorRef = useRef<1 | 2 | 3>(hotelFloor);
  floorRef.current = hotelFloor;

  const roomLightOnRef = useRef<boolean>(roomLightOn);
  roomLightOnRef.current = roomLightOn;

  const phoneResolvedRef = useRef<boolean>(phoneResolved);
  phoneResolvedRef.current = phoneResolved;

  const answeredHotelCallRef = useRef<boolean>(answeredHotelCall);
  answeredHotelCallRef.current = answeredHotelCall;

  const selectedChoiceRef = useRef<'SI' | 'NO'>(selectedChoice);
  selectedChoiceRef.current = selectedChoice;

  const keysRef = useRef<{ left: boolean; right: boolean; up: boolean; down: boolean }>({
    left: false,
    right: false,
    up: false,
    down: false,
  });

  const simRef = useRef({
    fpProgress:
      !Number.isNaN(initialParams.fpParam) && initialParams.fpParam >= 0
        ? Math.min(1, initialParams.fpParam)
        : phase === 'FP_DOOR_CREAK_TURN_BACK_PROMPT'
        ? 1
        : 0,
    playerX: initialPlayerX,
    facing: (
      phase === 'FLOOR_2_FLICKER_EVENT' ||
      phase === 'FLOOR_3_FLICKER_EVENT' ||
      phase === 'FLOOR_3_THINKING_PAUSE' ||
      phase === 'FLOOR_3_POST_FLICKER_DIALOGUE'
        ? -1
        : 1
    ) as -1 | 1,
    walkCycle: 0,
    fadeAlpha: 0,
    phaseTimerSec: 0,
    dragElapsedSec: 0,
    elevatorTargetFloor: 1 as 1 | 2 | 3,
    elevatorSwitched: false,
    floor2FlickerDone: false,
    floor3FlickerDone:
      phase === 'FLOOR_3_THINKING_PAUSE' || phase === 'FLOOR_3_POST_FLICKER_DIALOGUE',
    lastFlickerSoundCycle: 0,
    autoWalkStage: 'TO_SWITCH' as 'TO_SWITCH' | 'AT_SWITCH_PAUSE' | 'TO_BED',
    switchPauseSec: 0,
  });

  // Stop any lingering office animatronic footsteps or rain loops on mount/unmount
  useEffect(() => {
    soundController.stopAll(false, false);
    soundController.stopRainLoop();
    return () => {
      soundController.stopRainLoop();
      soundController.stopPhoneRingSequence();
    };
  }, []);

  // Reset default Yes/No selection to 'SI' when opening a decision prompt
  useEffect(() => {
    if (phase === 'HOTEL_ROOM_PHONE_DECISION' || phase === 'HOTEL_ROOM_BED_PROMPT') {
      setSelectedChoice('SI');
      selectedChoiceRef.current = 'SI';
    }
  }, [phase]);

  // Determine active dialogue tab
  const activeTab: PostNight1DialogueTab | null = useMemo(() => {
    if (phase === 'HOSPITAL_DIALOGUE') {
      return POST_NIGHT_3_HOSPITAL_TABS[hospitalTabIndex] || null;
    }
    if (phase === 'HOTEL_RECEPTIONIST_DIALOGUE' && activeReceptionistId !== null) {
      const rec = HOTEL_RECEPTIONISTS.find((r) => r.id === activeReceptionistId);
      return {
        speaker: `RECEPCIONISTA ${activeReceptionistId}`,
        speakerColor: '#38bdf8',
        segments: [{ text: rec?.dialogueText || '' }],
      };
    }
    if (phase === 'HOTEL_WRONG_ROOM_DIALOGUE') {
      return {
        ...POST_NIGHT_2_WRONG_ROOM_DIALOGUE,
        speaker: PROTAGONIST_NAME_FROM_NIGHT_3,
      };
    }
    if (phase === 'FLOOR_3_POST_FLICKER_DIALOGUE') {
      return POST_NIGHT_3_HALLUCINATIONS_DIALOGUE;
    }
    if (phase === 'HOTEL_ROOM_PHONE_DECISION') {
      return POST_NIGHT_3_PHONE_DECISION_PROMPT;
    }
    if (phase === 'HOTEL_ROOM_PHONE_CONVERSATION') {
      return POST_NIGHT_3_HOTEL_PHONE_TABS[phoneTabIndex] || null;
    }
    if (phase === 'HOTEL_ROOM_BED_PROMPT') {
      return {
        ...POST_NIGHT_2_BED_SLEEP_PROMPT,
        speaker: PROTAGONIST_NAME_FROM_NIGHT_3,
      };
    }
    return null;
  }, [phase, hospitalTabIndex, activeReceptionistId, phoneTabIndex]);

  const flattenedChars: FlattenedChar[] = useMemo(() => {
    if (!activeTab) return [];
    const list: FlattenedChar[] = [];
    for (const seg of activeTab.segments) {
      for (const ch of seg.text) {
        list.push({
          char: ch,
          slightTremble: Boolean(seg.slightTremble),
          slowTremble: Boolean(seg.slowTremble),
          glitchText: Boolean(seg.glitchText),
          highlightedText: Boolean(seg.highlightedText),
        });
      }
    }
    return list;
  }, [activeTab]);

  const flattenedLenRef = useRef<number>(flattenedChars.length);
  flattenedLenRef.current = flattenedChars.length;

  const revealedCountRef = useRef<number>(revealedCount);
  revealedCountRef.current = revealedCount;

  const typewriterTimerRef = useRef<number | null>(null);

  // Typewriter effect
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
        const delayMs = nextCharObj.slowTremble ? 95 : 22;
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

  // Tremble & glitch animation timer
  useEffect(() => {
    if (!activeTab) return;
    const interval = window.setInterval(() => {
      setTrembleTick((t) => (t + 1) % 1000);
    }, 65);
    return () => window.clearInterval(interval);
  }, [activeTab]);

  // Ringing phone audio while in Room 303 before the phone call is answered or ignored
  useEffect(() => {
    const shouldRingInRoom =
      (phase === 'HOTEL_ROOM_FREE_ROAM' || phase === 'HOTEL_ROOM_PHONE_DECISION') &&
      !phoneResolved;

    if (shouldRingInRoom) {
      soundController.startPhoneRingSequence();
    } else {
      soundController.stopPhoneRingSequence();
    }

    return () => {
      soundController.stopPhoneRingSequence();
    };
  }, [phase, phoneResolved]);

  // 2-second silence pause before Tab 4 ("Y también te daré una compensación más grande de dinero.")
  useEffect(() => {
    if (phase !== 'HOTEL_ROOM_PHONE_PAUSE_2S') return;
    const timer = window.setTimeout(() => {
      setPhoneTabIndex(4);
      setPhase('HOTEL_ROOM_PHONE_CONVERSATION');
    }, POST_NIGHT_3_PHONE_PAUSE_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  // Trigger elevator floor change with fade-to-black
  const triggerElevatorFloorChange = useCallback((nextFloor: 1 | 2 | 3) => {
    soundController.playCameraBlip();
    keysRef.current.left = false;
    keysRef.current.right = false;
    simRef.current.elevatorTargetFloor = nextFloor;
    simRef.current.elevatorSwitched = false;
    simRef.current.phaseTimerSec = 0;
    simRef.current.fadeAlpha = 0;
    phaseRef.current = 'HOTEL_ELEVATOR_FADE';
    setPhase('HOTEL_ELEVATOR_FADE');
  }, []);

  // Enter Room 303 on Floor 3 -> immediately starts ringing phone & opens the Accept/Ignore prompt
  const enterRoom303 = useCallback(() => {
    soundController.playDoorSlam(true);
    keysRef.current.left = false;
    keysRef.current.right = false;
    simRef.current.playerX = HOTEL_CENTRAL_DOOR_X;
    simRef.current.facing = -1;
    setRoomLightOn(true);
    roomLightOnRef.current = true;
    setPhoneResolved(false);
    phoneResolvedRef.current = false;
    phaseRef.current = 'HOTEL_ROOM_PHONE_DECISION';
    setPhase('HOTEL_ROOM_PHONE_DECISION');
  }, []);

  // Choice: Accept or Ignore the Room 303 phone call
  const handlePhoneDecision = useCallback((accept: boolean) => {
    soundController.stopPhoneRingSequence();
    soundController.playWoodClick();
    setPhoneResolved(true);
    phoneResolvedRef.current = true;
    setAnsweredHotelCall(accept);
    answeredHotelCallRef.current = accept;

    if (accept) {
      setPhoneTabIndex(0);
      phaseRef.current = 'HOTEL_ROOM_PHONE_CONVERSATION';
      setPhase('HOTEL_ROOM_PHONE_CONVERSATION');
    } else {
      phaseRef.current = 'HOTEL_ROOM_FREE_ROAM';
      setPhase('HOTEL_ROOM_FREE_ROAM');
    }
  }, []);

  // Choice: Sleep in Bed ("¿Quieres irte a dormir?")
  const handleBedSleepChoice = useCallback((wantsToSleep: boolean) => {
    soundController.playWoodClick();
    if (!wantsToSleep) {
      phaseRef.current = 'HOTEL_ROOM_FREE_ROAM';
      setPhase('HOTEL_ROOM_FREE_ROAM');
      return;
    }

    if (roomLightOnRef.current) {
      simRef.current.autoWalkStage = 'TO_SWITCH';
      simRef.current.switchPauseSec = 0;
      phaseRef.current = 'HOTEL_ROOM_TURN_OFF_LIGHTS_WALK';
      setPhase('HOTEL_ROOM_TURN_OFF_LIGHTS_WALK');
    } else {
      simRef.current.phaseTimerSec = 0;
      phaseRef.current = 'HOTEL_ROOM_SLEEP_ANIMATION';
      setPhase('HOTEL_ROOM_SLEEP_ANIMATION');
    }
  }, []);

  // Advance active dialogue on Enter
  const handleAdvanceDialogue = useCallback(() => {
    const currentPhase = phaseRef.current;

    if (currentPhase === 'FP_DOOR_CREAK_TURN_BACK_PROMPT') {
      soundController.playCameraBlip();
      simRef.current.phaseTimerSec = 0;
      phaseRef.current = 'FP_LOOKING_BACK_EMPTY';
      setPhase('FP_LOOKING_BACK_EMPTY');
      return;
    }
    if (currentPhase === 'FP_LOOKING_BACK_EMPTY') {
      soundController.playNightmareJumpscare();
      simRef.current.phaseTimerSec = 0;
      phaseRef.current = 'FP_NIGHTMARE_8BIT_JUMPSCARE';
      setPhase('FP_NIGHTMARE_8BIT_JUMPSCARE');
      return;
    }

    if (!activeTab) return;

    if (revealedCountRef.current < flattenedLenRef.current) {
      if (typewriterTimerRef.current !== null) {
        window.clearTimeout(typewriterTimerRef.current);
        typewriterTimerRef.current = null;
      }
      revealedCountRef.current = flattenedLenRef.current;
      setRevealedCount(flattenedLenRef.current);
      return;
    }

    if (activeTab.hasYesNoChoice) {
      if (currentPhase === 'HOTEL_ROOM_PHONE_DECISION') {
        handlePhoneDecision(selectedChoiceRef.current === 'SI');
      } else if (currentPhase === 'HOTEL_ROOM_BED_PROMPT') {
        handleBedSleepChoice(selectedChoiceRef.current === 'SI');
      }
      return;
    }

    soundController.playCameraBlip();

    if (currentPhase === 'HOSPITAL_DIALOGUE') {
      if (hospitalTabIndex + 1 < POST_NIGHT_3_HOSPITAL_TABS.length) {
        setHospitalTabIndex((idx) => idx + 1);
      } else {
        // After Tab 4 ("¡LO NECESITOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOO!"), push nurse & escape!
        soundController.playDoorSlam(false);
        simRef.current.phaseTimerSec = 0;
        simRef.current.fadeAlpha = 0;
        phaseRef.current = 'HOSPITAL_ESCAPE_ANIMATION';
        setPhase('HOSPITAL_ESCAPE_ANIMATION');
      }
      return;
    }

    if (currentPhase === 'HOTEL_RECEPTIONIST_DIALOGUE') {
      setActiveReceptionistId(null);
      phaseRef.current = 'HOTEL_HALLWAY';
      setPhase('HOTEL_HALLWAY');
      return;
    }

    if (currentPhase === 'HOTEL_WRONG_ROOM_DIALOGUE') {
      phaseRef.current = 'HOTEL_HALLWAY';
      setPhase('HOTEL_HALLWAY');
      return;
    }

    if (currentPhase === 'FLOOR_3_POST_FLICKER_DIALOGUE') {
      phaseRef.current = 'HOTEL_HALLWAY';
      setPhase('HOTEL_HALLWAY');
      return;
    }

    if (currentPhase === 'HOTEL_ROOM_PHONE_CONVERSATION') {
      const nextIdx = phoneTabIndex + 1;
      if (nextIdx < POST_NIGHT_3_HOTEL_PHONE_TABS.length) {
        const nextTab = POST_NIGHT_3_HOTEL_PHONE_TABS[nextIdx];
        if (nextTab.pauseBeforeShowMs && nextTab.pauseBeforeShowMs > 0) {
          phaseRef.current = 'HOTEL_ROOM_PHONE_PAUSE_2S';
          setPhase('HOTEL_ROOM_PHONE_PAUSE_2S');
        } else {
          setPhoneTabIndex(nextIdx);
        }
      } else {
        phaseRef.current = 'HOTEL_ROOM_FREE_ROAM';
        setPhase('HOTEL_ROOM_FREE_ROAM');
      }
      return;
    }
  }, [activeTab, handleBedSleepChoice, handlePhoneDecision, hospitalTabIndex, phoneTabIndex]);

  // Interact [E] handler — uses clean, appropriate sound effects (NEVER animatronic footsteps!)
  const handleInteractE = useCallback(() => {
    const currentPhase = phaseRef.current;
    const px = simRef.current.playerX;

    if (currentPhase === 'HOTEL_DAY_EXTERIOR_WALK') {
      if (isNearHotelExteriorDoor(px)) {
        soundController.playDoorSlam(true);
        keysRef.current.left = false;
        keysRef.current.right = false;
        simRef.current.phaseTimerSec = 0;
        simRef.current.fadeAlpha = 0;
        phaseRef.current = 'HOTEL_DAY_ENTERING_FADE';
        setPhase('HOTEL_DAY_ENTERING_FADE');
      }
      return;
    }

    if (currentPhase === 'HOTEL_HALLWAY') {
      const floor = floorRef.current;

      if (floor === 1 && isNearHotelHallwayExitDoor(px)) {
        soundController.playDoorSlam(true);
        keysRef.current.left = false;
        keysRef.current.right = false;
        simRef.current.playerX = HOTEL_EXTERIOR_DOOR_X;
        phaseRef.current = 'HOTEL_DAY_EXTERIOR_WALK';
        setPhase('HOTEL_DAY_EXTERIOR_WALK');
        return;
      }

      if (floor === 1) {
        const rec = getNearbyReceptionist(px);
        if (rec) {
          soundController.playCameraBlip();
          keysRef.current.left = false;
          keysRef.current.right = false;
          setActiveReceptionistId(rec.id);
          phaseRef.current = 'HOTEL_RECEPTIONIST_DIALOGUE';
          setPhase('HOTEL_RECEPTIONIST_DIALOGUE');
          return;
        }
      }

      const nearbyRoom = getNearbyHotelHallwayRoom(floor, px);
      if (nearbyRoom) {
        if (floor === 3 && nearbyRoom.isPlayerRoom) {
          enterRoom303();
          return;
        }
        soundController.playLockedDoorRattle();
        keysRef.current.left = false;
        keysRef.current.right = false;
        phaseRef.current = 'HOTEL_WRONG_ROOM_DIALOGUE';
        setPhase('HOTEL_WRONG_ROOM_DIALOGUE');
        return;
      }

      if (isNearElevatorDown(px) && floor > 1) {
        triggerElevatorFloorChange((floor - 1) as 1 | 2 | 3);
        return;
      }

      if (isNearElevatorUp(px) && floor < 3) {
        triggerElevatorFloorChange((floor + 1) as 1 | 2 | 3);
        return;
      }
      return;
    }

    if (currentPhase === 'HOTEL_ROOM_FREE_ROAM') {
      if (!phoneResolvedRef.current && isNearHotelPhone(px)) {
        soundController.playCameraBlip();
        keysRef.current.left = false;
        keysRef.current.right = false;
        phaseRef.current = 'HOTEL_ROOM_PHONE_DECISION';
        setPhase('HOTEL_ROOM_PHONE_DECISION');
        return;
      }
      if (isNearHotelLightSwitch(px)) {
        soundController.playWoodClick();
        setRoomLightOn((prev) => {
          const next = !prev;
          roomLightOnRef.current = next;
          return next;
        });
        return;
      }
      if (isNearHotelBed(px)) {
        soundController.playCameraBlip();
        keysRef.current.left = false;
        keysRef.current.right = false;
        phaseRef.current = 'HOTEL_ROOM_BED_PROMPT';
        setPhase('HOTEL_ROOM_BED_PROMPT');
        return;
      }
      return;
    }

    if (currentPhase === 'HOTEL_ROOM_NIGHT_EXIT_WALK') {
      if (isNearHotelRoomCentralDoor(px)) {
        soundController.playDoorSlam(true);
        keysRef.current.left = false;
        keysRef.current.right = false;
        simRef.current.phaseTimerSec = 0;
        simRef.current.fadeAlpha = 0;
        phaseRef.current = 'HOTEL_EXIT_TO_FACILITY_FADE_OUT';
        setPhase('HOTEL_EXIT_TO_FACILITY_FADE_OUT');
        return;
      }
      if (isNearHotelLightSwitch(px)) {
        soundController.playWoodClick();
        setRoomLightOn((prev) => {
          const next = !prev;
          roomLightOnRef.current = next;
          return next;
        });
        return;
      }
    }
  }, [enterRoom303, triggerElevatorFloorChange]);

  // Keyboard listeners
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const code = e.code;
      const keyLower = e.key.toLowerCase();

      if (
        phaseRef.current === 'HOTEL_ROOM_PHONE_DECISION' ||
        phaseRef.current === 'HOTEL_ROOM_BED_PROMPT'
      ) {
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

      if (code === 'KeyW' || code === 'ArrowUp') {
        keysRef.current.up = true;
        if (phaseRef.current === 'FP_LOOKING_BACK_EMPTY') {
          e.preventDefault();
          soundController.playNightmareJumpscare();
          simRef.current.phaseTimerSec = 0;
          phaseRef.current = 'FP_NIGHTMARE_8BIT_JUMPSCARE';
          setPhase('FP_NIGHTMARE_8BIT_JUMPSCARE');
        }
      }
      if (code === 'KeyS' || code === 'ArrowDown') {
        keysRef.current.down = true;
        if (phaseRef.current === 'FP_DOOR_CREAK_TURN_BACK_PROMPT') {
          e.preventDefault();
          soundController.playCameraBlip();
          simRef.current.phaseTimerSec = 0;
          phaseRef.current = 'FP_LOOKING_BACK_EMPTY';
          setPhase('FP_LOOKING_BACK_EMPTY');
          return;
        }
        if (phaseRef.current === 'FP_LOOKING_BACK_EMPTY') {
          e.preventDefault();
          soundController.playNightmareJumpscare();
          simRef.current.phaseTimerSec = 0;
          phaseRef.current = 'FP_NIGHTMARE_8BIT_JUMPSCARE';
          setPhase('FP_NIGHTMARE_8BIT_JUMPSCARE');
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
        e.preventDefault();
        handleInteractE();
        return;
      }

      if (code === 'Enter' || code === 'NumpadEnter') {
        e.preventDefault();
        e.stopPropagation();
        handleAdvanceDialogue();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const code = e.code;
      if (code === 'KeyW' || code === 'ArrowUp') keysRef.current.up = false;
      if (code === 'KeyS' || code === 'ArrowDown') keysRef.current.down = false;
      if (code === 'KeyA' || code === 'ArrowLeft') keysRef.current.left = false;
      if (code === 'KeyD' || code === 'ArrowRight') keysRef.current.right = false;
    };

    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
    };
  }, [handleAdvanceDialogue, handleInteractE]);

  // Main 60Hz Canvas Loop
  useEffect(() => {
    let raf = 0;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      const sim = simRef.current;
      let currentPhase = phaseRef.current;
      const currentFloor = floorRef.current;

      // 1. First-person corridor advancing with W (NO animatronic footsteps MP3!)
      if (currentPhase === 'FP_WALK_TO_DOOR') {
        if (keysRef.current.up) {
          sim.fpProgress = Math.min(1, sim.fpProgress + dt * 0.44);
          if (sim.fpProgress >= 1) {
            soundController.playCreakSound(); // Eerie wooden floorboard/door creak behind Richard!
            sim.phaseTimerSec = 0;
            currentPhase = 'FP_DOOR_CREAK_TURN_BACK_PROMPT';
            phaseRef.current = currentPhase;
            setPhase(currentPhase);
          }
        }
      } else if (currentPhase === 'FP_NIGHTMARE_8BIT_JUMPSCARE') {
        if (!Number.isNaN(initialParams.jumpscareTParam)) {
          sim.phaseTimerSec = initialParams.jumpscareTParam;
        } else {
          sim.phaseTimerSec += dt;
          if (sim.phaseTimerSec >= POST_NIGHT_3_JUMPSCARE_VISUAL_DURATION_SEC) {
            sim.phaseTimerSec = 0;
            currentPhase = 'FP_BLACKOUT';
            phaseRef.current = currentPhase;
            setPhase(currentPhase);
          }
        }
      } else if (currentPhase === 'FP_BLACKOUT') {
        sim.phaseTimerSec += dt;
        // Wait until the jumpscare audio ("Jumpscare_nightmare", 3.66s) finishes completely before starting the rabbit drag!
        const audioDone =
          !soundController.isNightmareJumpscarePlaying() || sim.phaseTimerSec >= 1.2;
        if (sim.phaseTimerSec >= POST_NIGHT_3_BLACKOUT_MIN_DURATION_SEC && audioDone) {
          sim.phaseTimerSec = 0;
          sim.dragElapsedSec = 0;
          sim.fadeAlpha = 0;
          currentPhase = 'EXTERIOR_DRAGGED_BY_RABBIT';
          phaseRef.current = currentPhase;
          setPhase(currentPhase);
        }
      } else if (currentPhase === 'EXTERIOR_DRAGGED_BY_RABBIT') {
        sim.phaseTimerSec += dt;
        sim.dragElapsedSec += dt;
        if (sim.phaseTimerSec >= POST_NIGHT_3_RABBIT_DRAG_DURATION_SEC) {
          sim.phaseTimerSec = 0;
          sim.fadeAlpha = 0;
          currentPhase = 'EXTERIOR_DRAG_FADE_OUT';
          phaseRef.current = currentPhase;
          setPhase(currentPhase);
        }
      } else if (currentPhase === 'EXTERIOR_DRAG_FADE_OUT') {
        sim.phaseTimerSec += dt;
        sim.dragElapsedSec += dt;
        sim.fadeAlpha = Math.min(1, sim.phaseTimerSec / 0.85);
        if (sim.phaseTimerSec >= 0.9) {
          sim.phaseTimerSec = 0;
          sim.fadeAlpha = 1;
          currentPhase = 'HOSPITAL_WAKE_ANIMATION';
          phaseRef.current = currentPhase;
          setPhase(currentPhase);
        }
      } else if (currentPhase === 'HOSPITAL_WAKE_ANIMATION') {
        sim.phaseTimerSec += dt;
        sim.fadeAlpha = Math.max(0, 1 - sim.phaseTimerSec / 0.8);
        if (sim.phaseTimerSec >= 1.1) {
          sim.fadeAlpha = 0;
          setHospitalTabIndex(0);
          currentPhase = 'HOSPITAL_DIALOGUE';
          phaseRef.current = currentPhase;
          setPhase(currentPhase);
        }
      } else if (currentPhase === 'HOSPITAL_ESCAPE_ANIMATION') {
        sim.phaseTimerSec += dt;
        if (sim.phaseTimerSec > 1.1) {
          sim.fadeAlpha = Math.min(1, (sim.phaseTimerSec - 1.1) / 0.7);
        }
        if (sim.phaseTimerSec >= 1.85) {
          sim.fadeAlpha = 0;
          sim.playerX = HOTEL_EXTERIOR_SPAWN_X;
          sim.facing = 1;
          setNearHotelExteriorDoor(isNearHotelExteriorDoor(HOTEL_EXTERIOR_SPAWN_X));
          currentPhase = 'HOTEL_DAY_EXTERIOR_WALK';
          phaseRef.current = currentPhase;
          setPhase(currentPhase);
        }
      } else if (currentPhase === 'HOTEL_DAY_EXTERIOR_WALK') {
        const dir: -1 | 0 | 1 =
          keysRef.current.right && !keysRef.current.left
            ? 1
            : keysRef.current.left && !keysRef.current.right
            ? -1
            : 0;
        if (dir !== 0) {
          sim.facing = dir;
          sim.walkCycle += dt;
          sim.playerX = Math.max(
            HOTEL_EXTERIOR_MIN_X,
            Math.min(HOTEL_EXTERIOR_MAX_X, sim.playerX + dir * INTRO_WALK_SPEED_PX_PER_SEC * dt)
          );
        }
        setNearHotelExteriorDoor(isNearHotelExteriorDoor(sim.playerX));
      } else if (currentPhase === 'HOTEL_DAY_ENTERING_FADE') {
        sim.phaseTimerSec += dt;
        sim.fadeAlpha = Math.min(1, sim.phaseTimerSec / 0.75);
        if (sim.phaseTimerSec >= 0.8) {
          sim.fadeAlpha = 0;
          sim.playerX = 180;
          sim.facing = 1;
          setHotelFloor(1);
          floorRef.current = 1;
          setHallwayCameraX(getHotelHallwayCameraX(180));
          currentPhase = 'HOTEL_HALLWAY';
          phaseRef.current = currentPhase;
          setPhase(currentPhase);
        }
      } else if (currentPhase === 'HOTEL_ELEVATOR_FADE') {
        sim.phaseTimerSec += dt;
        const halfDur = 0.42;
        if (sim.phaseTimerSec < halfDur) {
          sim.fadeAlpha = Math.min(1, sim.phaseTimerSec / halfDur);
        } else {
          if (!sim.elevatorSwitched) {
            sim.elevatorSwitched = true;
            const targetFloor = sim.elevatorTargetFloor;
            setHotelFloor(targetFloor);
            floorRef.current = targetFloor;
            if (targetFloor === 2 && !sim.floor2FlickerDone) {
              sim.playerX = 1480;
              sim.facing = -1;
            } else if (targetFloor === 3 && !sim.floor3FlickerDone) {
              sim.playerX = 1480;
              sim.facing = -1;
            }
            setHallwayCameraX(getHotelHallwayCameraX(sim.playerX));
          }
          sim.fadeAlpha = Math.max(0, 1 - (sim.phaseTimerSec - halfDur) / halfDur);
        }

        if (sim.phaseTimerSec >= halfDur * 2) {
          sim.fadeAlpha = 0;
          const targetFloor = sim.elevatorTargetFloor;
          if (targetFloor === 2 && !sim.floor2FlickerDone) {
            sim.phaseTimerSec = 0;
            sim.lastFlickerSoundCycle = 0;
            currentPhase = 'FLOOR_2_FLICKER_EVENT';
            phaseRef.current = currentPhase;
            setPhase(currentPhase);
          } else if (targetFloor === 3 && !sim.floor3FlickerDone) {
            sim.phaseTimerSec = 0;
            sim.lastFlickerSoundCycle = 0;
            currentPhase = 'FLOOR_3_FLICKER_EVENT';
            phaseRef.current = currentPhase;
            setPhase(currentPhase);
          } else {
            currentPhase = 'HOTEL_HALLWAY';
            phaseRef.current = currentPhase;
            setPhase(currentPhase);
          }
        }
      } else if (currentPhase === 'HOTEL_HALLWAY') {
        const dir: -1 | 0 | 1 =
          keysRef.current.right && !keysRef.current.left
            ? 1
            : keysRef.current.left && !keysRef.current.right
            ? -1
            : 0;
        if (dir !== 0) {
          sim.facing = dir;
          sim.walkCycle += dt;
          sim.playerX = Math.max(
            HOTEL_HALLWAY_MIN_X,
            Math.min(
              HOTEL_HALLWAY_MAX_X,
              sim.playerX + dir * (INTRO_WALK_SPEED_PX_PER_SEC * 1.45) * dt
            )
          );
        }

        const camX = getHotelHallwayCameraX(sim.playerX);
        setHallwayCameraX((prev) => (Math.abs(prev - camX) >= 0.5 ? camX : prev));
        setNearHallwayExitDoor(currentFloor === 1 && isNearHotelHallwayExitDoor(sim.playerX));

        const rec = currentFloor === 1 ? getNearbyReceptionist(sim.playerX) : null;
        setNearbyReceptionist(rec ? rec.id : null);
        setNearElevatorDown(currentFloor > 1 && isNearElevatorDown(sim.playerX));
        setNearElevatorUp(currentFloor < 3 && isNearElevatorUp(sim.playerX));

        const nearbyRoom = getNearbyHotelHallwayRoom(currentFloor, sim.playerX);
        if (nearbyRoom) {
          if (currentFloor === 3 && nearbyRoom.isPlayerRoom) {
            setNearRoom303Door(true);
            setNearbyLockedRoomNumber(null);
          } else {
            setNearRoom303Door(false);
            setNearbyLockedRoomNumber(nearbyRoom.roomNumber);
          }
        } else {
          setNearRoom303Door(false);
          setNearbyLockedRoomNumber(null);
        }
      } else if (currentPhase === 'FLOOR_2_FLICKER_EVENT') {
        sim.phaseTimerSec += dt;
        const fState = getPostNight3Floor2FlickerState(sim.phaseTimerSec);
        if (fState.flickerIndex !== sim.lastFlickerSoundCycle) {
          sim.lastFlickerSoundCycle = fState.flickerIndex;
          soundController.playCameraBlip();
        }
        if (fState.completed) {
          sim.floor2FlickerDone = true;
          currentPhase = 'HOTEL_HALLWAY';
          phaseRef.current = currentPhase;
          setPhase(currentPhase);
        }
      } else if (currentPhase === 'FLOOR_3_FLICKER_EVENT') {
        sim.phaseTimerSec += dt;
        const fState = getPostNight3Floor3FlickerState(sim.phaseTimerSec);
        if (fState.flickerIndex !== sim.lastFlickerSoundCycle) {
          sim.lastFlickerSoundCycle = fState.flickerIndex;
          soundController.playCameraBlip();
        }
        if (fState.completed) {
          sim.floor3FlickerDone = true;
          sim.phaseTimerSec = 0;
          currentPhase = 'FLOOR_3_THINKING_PAUSE';
          phaseRef.current = currentPhase;
          setPhase(currentPhase);
        }
      } else if (currentPhase === 'FLOOR_3_THINKING_PAUSE') {
        sim.phaseTimerSec += dt;
        if (sim.phaseTimerSec >= POST_NIGHT_3_FLOOR_3_THINKING_DURATION_SEC) {
          sim.phaseTimerSec = 0;
          currentPhase = 'FLOOR_3_POST_FLICKER_DIALOGUE';
          phaseRef.current = currentPhase;
          setPhase(currentPhase);
        }
      } else if (
        currentPhase === 'HOTEL_ROOM_FREE_ROAM' ||
        currentPhase === 'HOTEL_ROOM_NIGHT_EXIT_WALK'
      ) {
        const dir: -1 | 0 | 1 =
          keysRef.current.right && !keysRef.current.left
            ? 1
            : keysRef.current.left && !keysRef.current.right
            ? -1
            : 0;
        if (dir !== 0) {
          sim.facing = dir;
          sim.walkCycle += dt;
          sim.playerX = Math.max(
            HOTEL_MIN_WALK_X,
            Math.min(HOTEL_MAX_WALK_X, sim.playerX + dir * INTRO_WALK_SPEED_PX_PER_SEC * dt)
          );
        }
        setNearLightSwitch(isNearHotelLightSwitch(sim.playerX));
        setNearPhone(
          currentPhase === 'HOTEL_ROOM_FREE_ROAM' &&
            !phoneResolvedRef.current &&
            isNearHotelPhone(sim.playerX)
        );
        setNearBed(currentPhase === 'HOTEL_ROOM_FREE_ROAM' && isNearHotelBed(sim.playerX));
        setNearRoomCentralDoor(
          currentPhase === 'HOTEL_ROOM_NIGHT_EXIT_WALK' && isNearHotelRoomCentralDoor(sim.playerX)
        );
      } else if (currentPhase === 'HOTEL_ROOM_TURN_OFF_LIGHTS_WALK') {
        const walkSpeed = 155;
        if (sim.autoWalkStage === 'TO_SWITCH') {
          const dir = sim.playerX < HOTEL_LIGHT_SWITCH_X ? 1 : -1;
          sim.facing = dir;
          sim.walkCycle += dt;
          const nextX = sim.playerX + dir * walkSpeed * dt;
          if (Math.abs(nextX - HOTEL_LIGHT_SWITCH_X) <= 6) {
            sim.playerX = HOTEL_LIGHT_SWITCH_X;
            sim.autoWalkStage = 'AT_SWITCH_PAUSE';
            sim.switchPauseSec = 0;
            soundController.playWoodClick();
            setRoomLightOn(false);
            roomLightOnRef.current = false;
          } else {
            sim.playerX = nextX;
          }
        } else if (sim.autoWalkStage === 'AT_SWITCH_PAUSE') {
          sim.switchPauseSec += dt;
          if (sim.switchPauseSec >= 0.35) {
            sim.autoWalkStage = 'TO_BED';
          }
        } else {
          const dir = sim.playerX > HOTEL_BED_STAND_X ? -1 : 1;
          sim.facing = dir;
          sim.walkCycle += dt;
          const nextX = sim.playerX + dir * walkSpeed * dt;
          if (Math.abs(nextX - HOTEL_BED_STAND_X) <= 6) {
            sim.playerX = HOTEL_BED_STAND_X;
            sim.phaseTimerSec = 0;
            currentPhase = 'HOTEL_ROOM_SLEEP_ANIMATION';
            phaseRef.current = currentPhase;
            setPhase(currentPhase);
          } else {
            sim.playerX = nextX;
          }
        }
      } else if (currentPhase === 'HOTEL_ROOM_SLEEP_ANIMATION') {
        sim.phaseTimerSec += dt;
        if (sim.phaseTimerSec >= 2.2) {
          sim.fadeAlpha = Math.min(1, (sim.phaseTimerSec - 2.2) / 0.9);
        }
        if (sim.phaseTimerSec >= 3.2) {
          sim.phaseTimerSec = 0;
          currentPhase = 'HOTEL_ROOM_WAKE_ANIMATION';
          phaseRef.current = currentPhase;
          setPhase(currentPhase);
        }
      } else if (currentPhase === 'HOTEL_ROOM_WAKE_ANIMATION') {
        sim.phaseTimerSec += dt;
        if (sim.phaseTimerSec < 0.8) {
          sim.fadeAlpha = Math.max(0, 1 - sim.phaseTimerSec / 0.8);
        } else {
          sim.fadeAlpha = 0;
        }
        if (sim.phaseTimerSec >= 2.4) {
          sim.playerX = HOTEL_BED_STAND_X;
          sim.facing = 1;
          setNearRoomCentralDoor(isNearHotelRoomCentralDoor(HOTEL_BED_STAND_X));
          currentPhase = 'HOTEL_ROOM_NIGHT_EXIT_WALK';
          phaseRef.current = currentPhase;
          setPhase(currentPhase);
        }
      } else if (currentPhase === 'HOTEL_EXIT_TO_FACILITY_FADE_OUT') {
        sim.phaseTimerSec += dt;
        sim.fadeAlpha = Math.min(1, sim.phaseTimerSec / 0.85);
        if (sim.phaseTimerSec >= 0.9) {
          sim.phaseTimerSec = 0;
          sim.fadeAlpha = 1;
          sim.playerX = INTRO_OUTSIDE_SPAWN_X;
          sim.facing = 1;
          currentPhase = 'FACILITY_NIGHT_EXTERIOR_FADE_IN';
          phaseRef.current = currentPhase;
          setPhase(currentPhase);
        }
      } else if (currentPhase === 'FACILITY_NIGHT_EXTERIOR_FADE_IN') {
        sim.phaseTimerSec += dt;
        sim.fadeAlpha = Math.max(0, 1 - sim.phaseTimerSec / 0.85);
        if (sim.phaseTimerSec >= 0.9) {
          sim.fadeAlpha = 0;
          currentPhase = 'FACILITY_NIGHT_EXTERIOR_WALK';
          phaseRef.current = currentPhase;
          setPhase(currentPhase);
        }
      } else if (currentPhase === 'FACILITY_NIGHT_EXTERIOR_WALK') {
        const dir: -1 | 0 | 1 =
          keysRef.current.right && !keysRef.current.left
            ? 1
            : keysRef.current.left && !keysRef.current.right
            ? -1
            : 0;
        if (dir !== 0) {
          sim.facing = dir;
          sim.walkCycle += dt;
          sim.playerX = Math.max(
            INTRO_OUTSIDE_MIN_X,
            Math.min(INTRO_DOOR_STOP_X, sim.playerX + dir * INTRO_WALK_SPEED_PX_PER_SEC * dt)
          );
          if (sim.playerX >= INTRO_DOOR_STOP_X) {
            soundController.playDoorSlam(true);
            sim.phaseTimerSec = 0;
            sim.fadeAlpha = 0;
            currentPhase = 'FACILITY_NIGHT_ENTERING_FADE_OUT';
            phaseRef.current = currentPhase;
            setPhase(currentPhase);
          }
        }
      } else if (currentPhase === 'FACILITY_NIGHT_ENTERING_FADE_OUT') {
        sim.walkCycle += dt;
        sim.facing = 1;
        if (sim.playerX < INTRO_DOOR_ENTER_X) {
          sim.playerX = Math.min(INTRO_DOOR_ENTER_X, sim.playerX + dt * 95);
        }
        sim.phaseTimerSec += dt;
        sim.fadeAlpha = Math.min(1, sim.phaseTimerSec / 0.85);
        if (sim.phaseTimerSec >= 0.9) {
          currentPhase = 'COMPLETED';
          phaseRef.current = currentPhase;
          setPhase(currentPhase);
          onComplete(answeredHotelCallRef.current);
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
          ctx.clearRect(0, 0, W, H);

          if (
            currentPhase === 'FP_WALK_TO_DOOR' ||
            currentPhase === 'FP_DOOR_CREAK_TURN_BACK_PROMPT' ||
            currentPhase === 'FP_LOOKING_BACK_EMPTY' ||
            currentPhase === 'FP_NIGHTMARE_8BIT_JUMPSCARE' ||
            currentPhase === 'FP_BLACKOUT'
          ) {
            drawFirstPersonPizzeriaCorridorScene(
              ctx,
              W,
              H,
              currentPhase,
              sim.fpProgress,
              sim.phaseTimerSec,
              timeSec
            );
          } else if (
            currentPhase === 'EXTERIOR_DRAGGED_BY_RABBIT' ||
            currentPhase === 'EXTERIOR_DRAG_FADE_OUT'
          ) {
            // Monotonic sim.dragElapsedSec guarantees the rabbit never resets during fade-out!
            drawExteriorDraggedByRabbitScene(ctx, W, H, sim.dragElapsedSec, timeSec);
          } else if (
            currentPhase === 'HOSPITAL_WAKE_ANIMATION' ||
            currentPhase === 'HOSPITAL_DIALOGUE' ||
            currentPhase === 'HOSPITAL_ESCAPE_ANIMATION'
          ) {
            drawHospitalRoomScene(
              ctx,
              W,
              H,
              currentPhase,
              hospitalTabIndex,
              sim.phaseTimerSec,
              timeSec
            );
          } else if (
            currentPhase === 'HOTEL_DAY_EXTERIOR_WALK' ||
            currentPhase === 'HOTEL_DAY_ENTERING_FADE'
          ) {
            const isWalking =
              currentPhase === 'HOTEL_DAY_EXTERIOR_WALK' &&
              (keysRef.current.left || keysRef.current.right);
            drawHotelExteriorSceneShared(
              ctx,
              W,
              H,
              timeSec,
              sim.playerX,
              sim.facing,
              sim.walkCycle,
              isWalking,
              true // Daytime sky behind the exact same 3-story hotel!
            );
          } else if (
            currentPhase === 'HOTEL_HALLWAY' ||
            currentPhase === 'HOTEL_ELEVATOR_FADE' ||
            currentPhase === 'HOTEL_RECEPTIONIST_DIALOGUE' ||
            currentPhase === 'HOTEL_WRONG_ROOM_DIALOGUE' ||
            currentPhase === 'FLOOR_2_FLICKER_EVENT' ||
            currentPhase === 'FLOOR_3_FLICKER_EVENT' ||
            currentPhase === 'FLOOR_3_THINKING_PAUSE' ||
            currentPhase === 'FLOOR_3_POST_FLICKER_DIALOGUE'
          ) {
            const f2State =
              currentPhase === 'FLOOR_2_FLICKER_EVENT'
                ? getPostNight3Floor2FlickerState(sim.phaseTimerSec)
                : null;
            const f3State =
              currentPhase === 'FLOOR_3_FLICKER_EVENT'
                ? getPostNight3Floor3FlickerState(sim.phaseTimerSec)
                : null;
            const isWalking =
              currentPhase === 'HOTEL_HALLWAY' &&
              (keysRef.current.left || keysRef.current.right);
            const isThinkingOnFloor3 = currentPhase === 'FLOOR_3_THINKING_PAUSE';

            drawHotelHallwaySceneShared(
              ctx,
              W,
              H,
              timeSec,
              currentFloor,
              sim.playerX,
              sim.facing,
              sim.walkCycle,
              isWalking,
              f2State,
              f3State,
              isThinkingOnFloor3
            );
          } else if (
            currentPhase === 'HOTEL_ROOM_FREE_ROAM' ||
            currentPhase === 'HOTEL_ROOM_PHONE_DECISION' ||
            currentPhase === 'HOTEL_ROOM_PHONE_PAUSE_2S' ||
            currentPhase === 'HOTEL_ROOM_PHONE_CONVERSATION' ||
            currentPhase === 'HOTEL_ROOM_BED_PROMPT' ||
            currentPhase === 'HOTEL_ROOM_TURN_OFF_LIGHTS_WALK' ||
            currentPhase === 'HOTEL_ROOM_SLEEP_ANIMATION' ||
            currentPhase === 'HOTEL_ROOM_WAKE_ANIMATION' ||
            currentPhase === 'HOTEL_ROOM_NIGHT_EXIT_WALK' ||
            currentPhase === 'HOTEL_EXIT_TO_FACILITY_FADE_OUT'
          ) {
            const isWalking =
              ((currentPhase === 'HOTEL_ROOM_FREE_ROAM' ||
                currentPhase === 'HOTEL_ROOM_NIGHT_EXIT_WALK') &&
                (keysRef.current.left || keysRef.current.right)) ||
              (currentPhase === 'HOTEL_ROOM_TURN_OFF_LIGHTS_WALK' &&
                sim.autoWalkStage !== 'AT_SWITCH_PAUSE');
            drawHotelRoomSceneShared(
              ctx,
              W,
              H,
              timeSec,
              currentPhase,
              sim.phaseTimerSec,
              sim.playerX,
              sim.facing,
              sim.walkCycle,
              isWalking,
              roomLightOnRef.current,
              !phoneResolvedRef.current
            );
          } else {
            const isWalking =
              (currentPhase === 'FACILITY_NIGHT_EXTERIOR_WALK' &&
                (keysRef.current.left || keysRef.current.right)) ||
              currentPhase === 'FACILITY_NIGHT_ENTERING_FADE_OUT';
            drawFacilityNightExteriorSceneShared(
              ctx,
              W,
              H,
              timeSec,
              sim.playerX,
              sim.facing,
              sim.walkCycle,
              isWalking
            );
          }

          // Classic 8-Bit CRT Scanlines Overlay
          ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
          for (let sy = 0; sy < H; sy += 6) {
            ctx.fillRect(0, sy, W, 3);
          }

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
  }, [hospitalTabIndex, onComplete]);

  const renderDialogueSegments = () => {
    if (!activeTab) return null;
    let remaining = revealedCount;

    return activeTab.segments.map((seg, segIdx) => {
      if (remaining <= 0) return null;
      const visibleText = seg.text.slice(0, remaining);
      remaining -= visibleText.length;

      if (seg.highlightedText) {
        return (
          <span
            key={segIdx}
            data-testid="highlighted-text-segment"
            className="inline-block px-2 py-1 rounded bg-amber-500/25 border border-amber-400 text-amber-300 font-black tracking-wide shadow-[0_0_14px_rgba(245,158,11,0.45)]"
          >
            {visibleText}
          </span>
        );
      }

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

      if (seg.slowTremble || seg.slightTremble) {
        return (
          <span key={segIdx} className="inline">
            {visibleText.split('').map((ch, idx) => {
              if (ch === ' ') return <span key={idx}> </span>;
              const seed = idx * 17 + trembleTick * 13;
              const amp = seg.slowTremble ? 0.95 : 0.7;
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

  const toHallwayScreenLeftPct = (worldX: number): string => {
    const pct = ((worldX - hallwayCameraX) / HOTEL_HALLWAY_VIEWPORT_WIDTH) * 100;
    return `${Math.max(4, Math.min(96, pct)).toFixed(2)}%`;
  };

  const activeReceptionistWorldX =
    HOTEL_RECEPTIONISTS.find((r) => r.id === nearbyReceptionist)?.x ?? 290;
  const activeLockedRoomWorldX =
    getHotelFloorRooms(hotelFloor).find((r) => r.roomNumber === nearbyLockedRoomNumber)?.x ?? 580;

  return (
    <div
      data-testid="post-night3-minigame"
      data-phase={phase}
      data-floor={hotelFloor}
      data-room-light={roomLightOn ? 'on' : 'off'}
      data-phone-resolved={phoneResolved ? 'true' : 'false'}
      className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center select-none overflow-hidden font-mono"
    >
      <div className="relative w-full h-full flex items-center justify-center bg-black overflow-hidden">
        <canvas
          ref={canvasRef}
          width={960}
          height={540}
          className="w-full h-full object-contain bg-black"
          style={{ imageRendering: 'pixelated' }}
        />

        {/* FIRST-PERSON CONTROLS OVERLAY (NO IMMERSION-BREAKING CREAK TEXT BANNERS!) */}
        {phase === 'FP_WALK_TO_DOOR' && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center">
            <button
              type="button"
              data-testid="fp-advance-w-btn"
              onClick={() => {
                simRef.current.fpProgress = 1;
                soundController.playCreakSound();
                simRef.current.phaseTimerSec = 0;
                phaseRef.current = 'FP_DOOR_CREAK_TURN_BACK_PROMPT';
                setPhase('FP_DOOR_CREAK_TURN_BACK_PROMPT');
              }}
              className="px-5 py-2 rounded-lg bg-zinc-950/90 border border-amber-400/80 text-amber-300 font-bold text-xs uppercase tracking-widest shadow-2xl hover:bg-zinc-900 cursor-pointer"
            >
              MANTÉN PULSADO [W] PARA AVANZAR HACIA LA PUERTA ▶
            </button>
          </div>
        )}

        {phase === 'FP_DOOR_CREAK_TURN_BACK_PROMPT' && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center">
            <button
              type="button"
              data-testid="fp-turn-back-s-btn"
              onClick={() => {
                soundController.playCameraBlip();
                simRef.current.phaseTimerSec = 0;
                phaseRef.current = 'FP_LOOKING_BACK_EMPTY';
                setPhase('FP_LOOKING_BACK_EMPTY');
              }}
              className="px-5 py-2 rounded-lg bg-zinc-950/90 border border-amber-400 text-amber-300 font-bold text-xs uppercase tracking-widest shadow-2xl hover:bg-zinc-900 cursor-pointer"
            >
              PULSA [S] PARA DARTE LA VUELTA
            </button>
          </div>
        )}

        {phase === 'FP_LOOKING_BACK_EMPTY' && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center">
            <button
              type="button"
              data-testid="fp-turn-front-btn"
              onClick={() => {
                soundController.playNightmareJumpscare();
                simRef.current.phaseTimerSec = 0;
                phaseRef.current = 'FP_NIGHTMARE_8BIT_JUMPSCARE';
                setPhase('FP_NIGHTMARE_8BIT_JUMPSCARE');
              }}
              className="px-5 py-2 rounded-lg bg-zinc-950/90 border border-amber-400 text-amber-300 font-bold text-xs uppercase tracking-widest shadow-2xl hover:bg-zinc-900 cursor-pointer"
            >
              PULSA [S] O [W] PARA VOLVER A DARTE LA VUELTA
            </button>
          </div>
        )}

        {/* 2-SECOND PAUSE ON THE PHONE LINE BEFORE TAB 4 */}
        {phase === 'HOTEL_ROOM_PHONE_PAUSE_2S' && (
          <div
            data-testid="hotel-phone-pause-box"
            className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[80vw] max-w-[80vw] bg-zinc-950/95 border-2 border-red-500/80 rounded-xl p-6 shadow-2xl text-center"
          >
            <div className="text-xs font-bold text-red-400 uppercase tracking-widest mb-2">
              ??? · LÍNEA TELEFÓNICA
            </div>
            <div className="text-xl font-bold text-zinc-300 tracking-widest animate-pulse">
              ...
            </div>
          </div>
        )}

        {/* FLOATING [E] POPOVERS (MATCHING NIGHT 2->3 HOTEL) */}
        {phase === 'HOTEL_DAY_EXTERIOR_WALK' && nearHotelExteriorDoor && (
          <button
            type="button"
            data-testid="hotel-exterior-enter-btn"
            aria-label="Entrar al hotel [E]"
            onClick={handleInteractE}
            className="absolute top-[52%] left-[50%] -translate-x-1/2 -translate-y-1/2 z-20 px-2 py-0.5 bg-zinc-950/95 hover:bg-zinc-900 border-2 border-amber-400 text-amber-300 text-xs font-extrabold shadow-lg cursor-pointer animate-bounce"
          >
            E
          </button>
        )}

        {phase === 'HOTEL_HALLWAY' && nearHallwayExitDoor && (
          <button
            type="button"
            data-testid="hotel-hallway-exit-btn"
            aria-label="Salir del hotel [E]"
            onClick={handleInteractE}
            style={{
              left: toHallwayScreenLeftPct(HOTEL_HALLWAY_EXIT_DOOR_X),
            }}
            className="absolute top-[46%] -translate-x-1/2 -translate-y-1/2 z-20 px-2 py-0.5 bg-zinc-950/95 hover:bg-zinc-900 border-2 border-amber-400 text-amber-300 text-xs font-extrabold shadow-lg cursor-pointer animate-bounce"
          >
            E
          </button>
        )}

        {phase === 'HOTEL_HALLWAY' && nearbyReceptionist !== null && (
          <button
            type="button"
            data-testid="hotel-receptionist-talk-btn"
            aria-label={`Hablar con recepcionista ${nearbyReceptionist} [E]`}
            onClick={handleInteractE}
            style={{
              left: toHallwayScreenLeftPct(activeReceptionistWorldX),
            }}
            className="absolute top-[46%] -translate-x-1/2 -translate-y-1/2 z-20 px-2 py-0.5 bg-zinc-950/95 hover:bg-zinc-900 border-2 border-amber-400 text-amber-300 text-xs font-extrabold shadow-lg cursor-pointer animate-bounce"
          >
            E
          </button>
        )}

        {phase === 'HOTEL_HALLWAY' && nearbyLockedRoomNumber !== null && (
          <button
            type="button"
            data-testid="hotel-try-locked-room-btn"
            aria-label={`Intentar abrir habitación ${nearbyLockedRoomNumber} [E]`}
            onClick={handleInteractE}
            style={{
              left: toHallwayScreenLeftPct(activeLockedRoomWorldX),
            }}
            className="absolute top-[46%] -translate-x-1/2 -translate-y-1/2 z-20 px-2 py-0.5 bg-zinc-950/95 hover:bg-zinc-900 border-2 border-amber-400 text-amber-300 text-xs font-extrabold shadow-lg cursor-pointer animate-bounce"
          >
            E
          </button>
        )}

        {phase === 'HOTEL_HALLWAY' && nearElevatorDown && (
          <button
            type="button"
            data-testid="hotel-elevator-down-btn"
            aria-label="Bajar en ascensor izquierdo [E]"
            onClick={handleInteractE}
            style={{
              left: toHallwayScreenLeftPct(HOTEL_ELEVATOR_DOWN_X),
            }}
            className="absolute top-[46%] -translate-x-1/2 -translate-y-1/2 z-20 px-2 py-0.5 bg-zinc-950/95 hover:bg-zinc-900 border-2 border-amber-400 text-amber-300 text-xs font-extrabold shadow-lg cursor-pointer animate-bounce"
          >
            E
          </button>
        )}

        {phase === 'HOTEL_HALLWAY' && nearElevatorUp && (
          <button
            type="button"
            data-testid="hotel-elevator-up-btn"
            aria-label="Subir en ascensor derecho [E]"
            onClick={handleInteractE}
            style={{
              left: toHallwayScreenLeftPct(HOTEL_ELEVATOR_UP_X),
            }}
            className="absolute top-[46%] -translate-x-1/2 -translate-y-1/2 z-20 px-2 py-0.5 bg-zinc-950/95 hover:bg-zinc-900 border-2 border-amber-400 text-amber-300 text-xs font-extrabold shadow-lg cursor-pointer animate-bounce"
          >
            E
          </button>
        )}

        {phase === 'HOTEL_HALLWAY' && nearRoom303Door && (
          <button
            type="button"
            data-testid="hotel-enter-room-303-btn"
            aria-label="Entrar a habitación 303 [E]"
            onClick={handleInteractE}
            style={{
              left: toHallwayScreenLeftPct(HOTEL_PLAYER_ROOM_303_X),
            }}
            className="absolute top-[46%] -translate-x-1/2 -translate-y-1/2 z-20 px-2 py-0.5 bg-zinc-950/95 hover:bg-zinc-900 border-2 border-amber-400 text-amber-300 text-xs font-extrabold shadow-lg cursor-pointer animate-bounce"
          >
            E
          </button>
        )}

        {(phase === 'HOTEL_ROOM_FREE_ROAM' || phase === 'HOTEL_ROOM_NIGHT_EXIT_WALK') &&
          nearLightSwitch &&
          !nearRoomCentralDoor && (
            <button
              type="button"
              data-testid="hotel-light-switch-btn"
              aria-label="Interruptor de luz [E]"
              onClick={handleInteractE}
              style={{
                left: `${(HOTEL_LIGHT_SWITCH_X / 960) * 100}%`,
              }}
              className="absolute top-[48%] -translate-x-1/2 -translate-y-1/2 z-20 px-2 py-0.5 bg-zinc-950/95 hover:bg-zinc-900 border-2 border-amber-400 text-amber-300 text-xs font-extrabold shadow-lg cursor-pointer animate-bounce"
            >
              E
            </button>
          )}

        {phase === 'HOTEL_ROOM_FREE_ROAM' && nearPhone && !phoneResolved && (
          <button
            type="button"
            data-testid="hotel-phone-ringing-interact-btn"
            aria-label="Contestar teléfono [E]"
            onClick={handleInteractE}
            style={{
              left: `${(HOTEL_PHONE_X / 960) * 100}%`,
              top: '46%',
            }}
            className="absolute -translate-x-1/2 -translate-y-full z-20 px-2 py-0.5 bg-zinc-950/95 hover:bg-zinc-900 border-2 border-red-400 text-red-300 text-xs font-extrabold shadow-lg cursor-pointer animate-bounce"
          >
            E
          </button>
        )}

        {phase === 'HOTEL_ROOM_FREE_ROAM' && nearBed && (
          <button
            type="button"
            data-testid="hotel-bed-interact-btn"
            aria-label="Ir a dormir en la cama [E]"
            onClick={handleInteractE}
            className="absolute top-[52%] left-[25%] -translate-x-1/2 -translate-y-1/2 z-20 px-2 py-0.5 bg-zinc-950/95 hover:bg-zinc-900 border-2 border-amber-400 text-amber-300 text-xs font-extrabold shadow-lg cursor-pointer animate-bounce"
          >
            E
          </button>
        )}

        {phase === 'HOTEL_ROOM_NIGHT_EXIT_WALK' && nearRoomCentralDoor && (
          <button
            type="button"
            data-testid="hotel-room-exit-door-btn"
            aria-label="Salir de la habitación rumbo al local [E]"
            onClick={handleInteractE}
            className="absolute top-[46%] left-[50%] -translate-x-1/2 -translate-y-1/2 z-20 px-2 py-0.5 bg-zinc-950/95 hover:bg-zinc-900 border-2 border-amber-400 text-amber-300 text-xs font-extrabold shadow-lg cursor-pointer animate-bounce"
          >
            E
          </button>
        )}

        {/* DIALOGUE BOX OVERLAY */}
        {activeTab && (
          <div
            data-testid="post-night3-dialogue-box"
            onClick={() => {
              if (!activeTab.hasYesNoChoice) {
                handleAdvanceDialogue();
              }
            }}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[80vw] max-w-[80vw] bg-zinc-950/95 border-2 border-zinc-400 rounded-xl p-5 sm:p-6 shadow-2xl cursor-pointer"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5 mb-3">
              <div className="flex items-center gap-2.5">
                <span
                  data-testid="post-night3-speaker"
                  className="text-sm sm:text-base font-bold uppercase tracking-widest px-2.5 py-0.5 rounded bg-zinc-900 border border-zinc-700"
                  style={{ color: activeTab.speakerColor }}
                >
                  {activeTab.speaker}
                </span>
                {(phase === 'HOTEL_ROOM_PHONE_DECISION' ||
                  phase === 'HOTEL_ROOM_PHONE_CONVERSATION') && (
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
              data-testid="post-night3-dialogue-text"
              className="text-base sm:text-xl text-zinc-100 font-semibold leading-relaxed min-h-[3.5rem]"
            >
              {renderDialogueSegments()}
            </div>

            {/* YES / NO CHOICE BUTTONS (EXACT NIGHT 2 STYLE FROM image_581e8d95.png) */}
            {phase === 'HOTEL_ROOM_PHONE_DECISION' && (
              <div
                data-testid="post-night3-yes-no-choices"
                className="mt-4 pt-3 border-t border-zinc-800 flex items-center justify-around gap-6"
              >
                <button
                  type="button"
                  data-testid="hotel-phone-accept-btn"
                  onMouseEnter={() => {
                    setSelectedChoice('SI');
                    selectedChoiceRef.current = 'SI';
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePhoneDecision(true);
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
                  data-testid="hotel-phone-ignore-btn"
                  onMouseEnter={() => {
                    setSelectedChoice('NO');
                    selectedChoiceRef.current = 'NO';
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePhoneDecision(false);
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
            )}

            {phase === 'HOTEL_ROOM_BED_PROMPT' && (
              <div
                data-testid="post-night3-bed-yes-no-choices"
                className="mt-4 pt-3 border-t border-zinc-800 flex items-center justify-around gap-6"
              >
                <button
                  type="button"
                  data-testid="hotel-bed-yes-btn"
                  onMouseEnter={() => {
                    setSelectedChoice('SI');
                    selectedChoiceRef.current = 'SI';
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleBedSleepChoice(true);
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
                  data-testid="hotel-bed-no-btn"
                  onMouseEnter={() => {
                    setSelectedChoice('NO');
                    selectedChoiceRef.current = 'NO';
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleBedSleepChoice(false);
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
            )}

            {!activeTab.hasYesNoChoice && (
              <div className="mt-3 flex items-center justify-end pt-2 border-t border-zinc-900">
                <button
                  type="button"
                  data-testid="post-night3-enter-btn"
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

// ============================================================================
// SHARED PIXEL ART HELPERS (100% COHERENT WITH INTRO & NIGHT 2->3 MINIGAMES)
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

function draw8BitProtagonist(
  ctx: CanvasRenderingContext2D,
  x: number,
  groundY: number,
  facing: -1 | 1,
  walkPhase: number,
  isWalking: boolean,
  isThinking = false,
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
}

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

function drawRuinedWoodenBuilding(ctx: CanvasRenderingContext2D, groundY: number) {
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
  drawPixelRect(ctx, wx - 6, wy + 12, 88, 12, '#78350f');
  drawPixelRect(ctx, wx - 4, wy + 42, 84, 12, '#65320d');

  // Dark entrance doorway on the left side of the building
  const doorX = bx + 28; // 683
  const doorW = 68;
  const doorH = 116;
  const doorY = groundY - doorH;
  drawPixelRect(ctx, doorX - 8, doorY - 8, doorW + 16, doorH + 8, '#5c2d10');
  drawPixelRect(ctx, doorX, doorY, doorW, doorH, '#030305');
  drawPixelRect(ctx, doorX + 4, doorY + 4, 44, 10, '#451a03');
}

// ============================================================================
// SCENE 1: 8-BIT FIRST-PERSON PIZZERIA CORRIDOR & INTIMIDATING JAW-BITE JUMPSCARE
// ============================================================================

function drawFirstPersonPizzeriaCorridorScene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  phase: PostNight3MinigamePhase,
  fpProgress: number,
  phaseTimerSec: number,
  timeSec: number
) {
  if (phase === 'FP_BLACKOUT') {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);
    return;
  }

  const cx = w / 2;
  const bobY =
    phase === 'FP_WALK_TO_DOOR' && fpProgress > 0 && fpProgress < 1
      ? Math.round(Math.sin(fpProgress * 32) * 4)
      : 0;
  const cy = Math.round(h * 0.46 + bobY);

  // Base dark background
  ctx.fillStyle = '#040407';
  ctx.fillRect(0, 0, w, h);

  const isLookingBack = phase === 'FP_LOOKING_BACK_EMPTY';
  // Far wall / doorway rectangle in the center of the corridor
  const scale = isLookingBack ? 0.62 : 0.65 + fpProgress * 0.95;
  const farW = Math.round(176 * scale);
  const farH = Math.round(236 * scale);
  const farLeft = Math.round(cx - farW / 2);
  const farRight = Math.round(cx + farW / 2);
  const farTop = Math.round(cy - farH * 0.48);
  const farBottom = Math.round(cy + farH * 0.52);

  // 1. CEILING (Dark weathered rafters & hanging lamps that move past overhead as Richard advances!)
  ctx.fillStyle = '#0a0910';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(w, 0);
  ctx.lineTo(farRight, farTop);
  ctx.lineTo(farLeft, farTop);
  ctx.closePath();
  ctx.fill();

  const ceilingWorldZList = [0.26, 0.52, 0.78, 1.04, 1.26];
  for (let i = 0; i < ceilingWorldZList.length; i++) {
    const zW = ceilingWorldZList[i];
    const proj = projectFirstPersonCorridorProp(zW, fpProgress, isLookingBack);
    if (!proj.visible) continue;
    const t = proj.wallT; // 0 at far wall -> 1 at near top edge
    const ry = Math.round(farTop * (1 - t));
    const lx = Math.round(farLeft * (1 - t));
    const rx = Math.round(farRight + (w - farRight) * t);
    const beamH = Math.max(4, Math.round(6 * proj.scale));
    ctx.fillStyle = '#16120e';
    ctx.fillRect(lx, ry, rx - lx, beamH);

    // Hanging ceiling lamps at z = 0.26, 0.78, 1.26 (the first two pass behind the player's head as they advance!)
    if (i % 2 === 0) {
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

  // 2. PERSPECTIVE BLACK & WHITE CHECKERED PIZZERIA FLOOR (Scrolls continuously past the camera!)
  const floorRows = 10;
  const worldFloorShift = isLookingBack ? 0 : fpProgress * 7.5;
  const fracShift = worldFloorShift - Math.floor(worldFloorShift);
  const rowParityShift = Math.floor(worldFloorShift);

  for (let r = 0; r < floorRows; r++) {
    const t0 = Math.max(0, (r + fracShift * 0.85) / floorRows);
    const t1 = Math.min(1, (r + 1 + fracShift * 0.85) / floorRows);
    const p0 = Math.pow(t0, 1.48);
    const p1 = Math.pow(t1, 1.48);

    const y0 = Math.round(farBottom + (h - farBottom) * p0);
    const y1 = Math.round(farBottom + (h - farBottom) * p1);
    const left0 = Math.round(farLeft * (1 - p0));
    const right0 = Math.round(farRight + (w - farRight) * p0);
    const left1 = Math.round(farLeft * (1 - p1));
    const right1 = Math.round(farRight + (w - farRight) * p1);

    const cols = 8;
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

  // 3. LEFT & RIGHT PERSPECTIVE PIZZERIA WALLS (Upper Brick, Red/Black Checkered Band, Lower Wood Wainscoting)
  ctx.fillStyle = '#1d1922';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(farLeft, farTop);
  ctx.lineTo(farLeft, farBottom);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#1d1922';
  ctx.beginPath();
  ctx.moveTo(w, 0);
  ctx.lineTo(farRight, farTop);
  ctx.lineTo(farRight, farBottom);
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();

  // Lower wooden wainscoting on Left & Right walls
  const wainsNearTop = Math.round(h * 0.62 + bobY);
  const wainsFarTop = Math.round(farTop + (farBottom - farTop) * 0.62);

  ctx.fillStyle = '#231309';
  ctx.beginPath();
  ctx.moveTo(0, wainsNearTop);
  ctx.lineTo(farLeft, wainsFarTop);
  ctx.lineTo(farLeft, farBottom);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(w, wainsNearTop);
  ctx.lineTo(farRight, wainsFarTop);
  ctx.lineTo(farRight, farBottom);
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();

  // Iconic Pizzeria Red & White/Black Checkered Wall Stripe Band along both walls!
  const stripeSegments = 12;
  const bandNearTop = wainsNearTop - 34;
  const bandNearBot = wainsNearTop + 6;
  const bandFarTop = wainsFarTop - Math.round(16 * scale);
  const bandFarBot = wainsFarTop + Math.round(4 * scale);

  for (let s = 0; s < stripeSegments; s++) {
    const t0 = s / stripeSegments;
    const t1 = (s + 1) / stripeSegments;

    // Left wall stripe segment
    const lx0 = Math.round(farLeft * t0);
    const lx1 = Math.round(farLeft * t1);
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

    // Right wall stripe segment
    const rx0 = Math.round(w - (w - farRight) * t0);
    const rx1 = Math.round(w - (w - farRight) * t1);
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

  // ========================================================================
  // 4. COHERENT 3D PERSPECTIVE WALL PROPS (OBJECTS MOVE PAST & BEHIND THE PLAYER AS RICHARD ADVANCES!)
  // ========================================================================
  // Helper to compute (x, y) on the left or right wall at perspective parameter wallT (0=far, 1=near camera edge)
  const getWallAnchor = (side: 'left' | 'right', wallT: number, heightFrac = 0.34) => {
    const x =
      side === 'left'
        ? Math.round(farLeft * (1 - wallT))
        : Math.round(farRight + (w - farRight) * wallT);
    const wallTopAtX = Math.round(farTop * (1 - wallT));
    const wainsTopAtX = Math.round(wainsFarTop + (wainsNearTop - wainsFarTop) * wallT);
    const y = Math.round(wallTopAtX + (wainsTopAtX - wallTopAtX) * heightFrac);
    return { x, y };
  };

  // Prop A (zWorld = 0.34): Framed "PARTY" Animatronic Poster on Left Wall (starts in foreground, quickly left behind!)
  {
    const proj = projectFirstPersonCorridorProp(0.34, fpProgress, isLookingBack);
    if (proj.visible) {
      const side = isLookingBack ? 'right' : 'left';
      const pos = getWallAnchor(side, proj.wallT, 0.30);
      const s = Math.max(0.45, Math.min(1.65, proj.scale * 0.72));
      const pw = Math.round(68 * s);
      const ph = Math.round(84 * s);
      const px = side === 'left' ? pos.x - Math.round(pw * 0.5) : pos.x - Math.round(pw * 0.5);
      const py = pos.y - Math.round(ph * 0.35);
      drawPixelRect(ctx, px - 4, py - 4, pw + 8, ph + 8, '#eab308');
      drawPixelRect(ctx, px, py, pw, ph, '#0f172a');
      drawPixelRect(ctx, px + Math.round(8 * s), py + Math.round(34 * s), Math.round(14 * s), Math.round(34 * s), '#2563eb');
      drawPixelRect(ctx, px + Math.round(26 * s), py + Math.round(28 * s), Math.round(16 * s), Math.round(40 * s), '#78350f');
      drawPixelRect(ctx, px + Math.round(46 * s), py + Math.round(34 * s), Math.round(14 * s), Math.round(34 * s), '#eab308');
      drawPixelRect(ctx, px + Math.round(8 * s), py + Math.round(8 * s), pw - Math.round(16 * s), Math.round(10 * s), '#dc2626');
    }
  }

  // Prop B (zWorld = 0.38): Pair of Children's Drawings on Right Wall (starts in foreground, left behind as player walks!)
  {
    const proj = projectFirstPersonCorridorProp(0.38, fpProgress, isLookingBack);
    if (proj.visible) {
      const side = isLookingBack ? 'left' : 'right';
      const pos = getWallAnchor(side, proj.wallT, 0.34);
      const s = Math.max(0.45, Math.min(1.65, proj.scale * 0.76));
      const d1w = Math.round(36 * s);
      const d1h = Math.round(44 * s);
      const dx = pos.x - Math.round(d1w * 0.8);
      const dy = pos.y - Math.round(d1h * 0.3);
      drawPixelRect(ctx, dx, dy, d1w, d1h, '#fef9c3');
      drawPixelRect(ctx, dx + Math.round(8 * s), dy + Math.round(12 * s), Math.round(16 * s), Math.round(22 * s), '#78350f');
      drawPixelRect(ctx, dx + Math.round(42 * s), dy + Math.round(12 * s), Math.round(32 * s), Math.round(40 * s), '#e0f2fe');
      drawPixelRect(ctx, dx + Math.round(50 * s), dy + Math.round(22 * s), Math.round(16 * s), Math.round(20 * s), '#eab308');
    }
  }

  // Prop C (zWorld = 0.68): Blue Paper-Plate Pal on Left Wall (mid-hallway: approaches and then passes behind the camera!)
  {
    const proj = projectFirstPersonCorridorProp(0.68, fpProgress, isLookingBack);
    if (proj.visible) {
      const side = isLookingBack ? 'right' : 'left';
      const pos = getWallAnchor(side, proj.wallT, 0.45);
      const s = Math.max(0.45, Math.min(1.75, proj.scale * 0.95));
      const pw = Math.round(24 * s);
      const px = pos.x - Math.round(pw * 0.5);
      const py = pos.y - Math.round(pw * 0.4);
      drawPixelRect(ctx, px, py, pw, pw, '#f8fafc');
      drawPixelRect(ctx, px + Math.round(4 * s), py + Math.round(5 * s), Math.max(4, Math.round(4 * s)), Math.max(4, Math.round(4 * s)), '#2563eb');
      drawPixelRect(ctx, px + Math.round(14 * s), py + Math.round(5 * s), Math.max(4, Math.round(4 * s)), Math.max(4, Math.round(4 * s)), '#2563eb');
      drawPixelRect(ctx, px + Math.round(4 * s), py - Math.round(10 * s), Math.max(4, Math.round(4 * s)), Math.round(10 * s), '#60a5fa');
      drawPixelRect(ctx, px + Math.round(14 * s), py - Math.round(10 * s), Math.max(4, Math.round(4 * s)), Math.round(10 * s), '#60a5fa');
    }
  }

  // Prop D (zWorld = 0.72): Pink Child's Drawing on Right Wall (mid-hallway: approaches and passes behind the camera!)
  {
    const proj = projectFirstPersonCorridorProp(0.72, fpProgress, isLookingBack);
    if (proj.visible) {
      const side = isLookingBack ? 'left' : 'right';
      const pos = getWallAnchor(side, proj.wallT, 0.44);
      const s = Math.max(0.45, Math.min(1.75, proj.scale * 0.95));
      const dw = Math.round(30 * s);
      const dh = Math.round(36 * s);
      const dx = pos.x - Math.round(dw * 0.5);
      const dy = pos.y - Math.round(dh * 0.4);
      drawPixelRect(ctx, dx, dy, dw, dh, '#fce7f3');
      drawPixelRect(ctx, dx + Math.round(7 * s), dy + Math.round(8 * s), Math.round(16 * s), Math.round(20 * s), '#dc2626');
    }
  }

  // Prop E (zWorld = 1.06): Industrial Fuse Box & Warning Conduit on Left Wall near the Exit Door
  // (Starts small in the distance and enters the left mid-ground when Richard reaches the door!)
  {
    const proj = projectFirstPersonCorridorProp(1.06, fpProgress, isLookingBack);
    if (proj.visible) {
      const side = isLookingBack ? 'right' : 'left';
      const pos = getWallAnchor(side, proj.wallT, 0.42);
      const s = Math.max(0.35, Math.min(1.5, proj.scale * 0.85));
      const bw = Math.round(36 * s);
      const bh = Math.round(48 * s);
      const bx = pos.x - Math.round(bw * 0.5);
      const by = pos.y - Math.round(bh * 0.4);
      drawPixelRect(ctx, bx + Math.round(bw * 0.4), by - Math.round(28 * s), Math.max(4, Math.round(6 * s)), Math.round(28 * s), '#27272a');
      drawPixelRect(ctx, bx - 4, by - 4, bw + 8, bh + 8, '#18181b');
      drawPixelRect(ctx, bx, by, bw, bh, '#3f3f46');
      drawPixelRect(ctx, bx + Math.round(8 * s), by + Math.round(10 * s), Math.round(16 * s), Math.round(12 * s), '#eab308');
      drawPixelRect(ctx, bx + Math.round(10 * s), by + Math.round(30 * s), Math.max(4, Math.round(6 * s)), Math.max(4, Math.round(6 * s)), '#dc2626');
    }
  }

  // Prop F (zWorld = 1.10): Torn Safety Notice & Emergency Light on Right Wall near the Exit Door
  {
    const proj = projectFirstPersonCorridorProp(1.10, fpProgress, isLookingBack);
    if (proj.visible) {
      const side = isLookingBack ? 'left' : 'right';
      const pos = getWallAnchor(side, proj.wallT, 0.40);
      const s = Math.max(0.35, Math.min(1.5, proj.scale * 0.85));
      const nw = Math.round(34 * s);
      const nh = Math.round(42 * s);
      const nx = pos.x - Math.round(nw * 0.5);
      const ny = pos.y - Math.round(nh * 0.4);
      drawPixelRect(ctx, nx - 2, ny - 2, nw + 4, nh + 4, '#451a03');
      drawPixelRect(ctx, nx, ny, nw, nh, '#d6d3d1');
      drawPixelRect(ctx, nx + Math.round(6 * s), ny + Math.round(6 * s), nw - Math.round(12 * s), Math.round(8 * s), '#991b1b');
      drawPixelRect(ctx, nx + Math.round(6 * s), ny + Math.round(20 * s), nw - Math.round(14 * s), Math.round(4 * s), '#27272a');
      drawPixelRect(ctx, nx + Math.round(6 * s), ny + Math.round(28 * s), nw - Math.round(18 * s), Math.round(4 * s), '#27272a');
    }
  }

  // 5. END OF CORRIDOR (EITHER THE EXIT DOOR AHEAD OR THE EMPTY CORRIDOR ARCH BEHIND)
  ctx.fillStyle = '#14101a';
  ctx.fillRect(farLeft, farTop, farW, farH);
  // Checkered stripe continuing across the back wall
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

  if (isLookingBack) {
    // Looking back down the pizzeria corridor with the flashlight: dark empty archway to the office
    const archW = Math.round(farW * 0.56);
    const archH = Math.round(farH * 0.78);
    const archX = Math.round(cx - archW / 2);
    const archY = farBottom - archH;
    drawPixelRect(ctx, archX - 8, archY - 8, archW + 16, archH + 8, '#451a03');
    drawPixelRect(ctx, archX, archY, archW, archH, '#020205');
  } else {
    // Looking forward at the Pizzeria Exit Door
    const doorW = Math.round(farW * 0.62);
    const doorH = Math.round(farH * 0.82);
    const doorX = Math.round(cx - doorW / 2);
    const doorY = farBottom - doorH;

    // Glowing Red EXIT Sign above the local's door
    const signW = Math.max(36, Math.round(doorW * 0.44));
    const signH = Math.max(14, Math.round(doorH * 0.09));
    drawPixelRect(ctx, cx - signW / 2 - 2, doorY - signH - 14, signW + 4, signH + 4, '#27272a');
    drawPixelRect(ctx, cx - signW / 2, doorY - signH - 12, signW, signH, '#991b1b');
    ctx.fillStyle = '#fecaca';
    ctx.font = `bold ${Math.max(9, Math.round(signH * 0.75))}px "IBM Plex Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('EXIT', cx, doorY - 15);

    // Heavy wooden pizzeria exit door
    drawPixelRect(ctx, doorX - 8, doorY - 8, doorW + 16, doorH + 8, '#3f220f');
    drawPixelRect(ctx, doorX, doorY, doorW, doorH, '#5c2d10');
    drawPixelRect(
      ctx,
      doorX + Math.round(doorW * 0.12),
      doorY + Math.round(doorH * 0.08),
      Math.round(doorW * 0.76),
      Math.round(doorH * 0.36),
      '#451a03'
    );
    drawPixelRect(
      ctx,
      doorX + Math.round(doorW * 0.12),
      doorY + Math.round(doorH * 0.52),
      Math.round(doorW * 0.76),
      Math.round(doorH * 0.38),
      '#451a03'
    );
    // Brass push-plate & doorknob
    drawPixelRect(
      ctx,
      doorX + doorW - Math.max(16, Math.round(doorW * 0.2)),
      doorY + Math.round(doorH * 0.48),
      10,
      10,
      '#fde047'
    );
  }

  // 6. FLASHLIGHT BEAM VIGNETTE:
  // 20% more focused cone (outer radius reduced from 380 -> 304, inner radius 34) and illuminates significantly less!
  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.fillRect(0, 0, w, h);

  const flashGrad = ctx.createRadialGradient(cx, cy, 34, cx, cy, 304);
  flashGrad.addColorStop(0, 'rgba(254, 240, 138, 0.08)');
  flashGrad.addColorStop(0.36, 'rgba(10, 8, 6, 0.58)');
  flashGrad.addColorStop(0.66, 'rgba(2, 2, 4, 0.90)');
  flashGrad.addColorStop(0.88, 'rgba(0, 0, 0, 0.985)');
  flashGrad.addColorStop(1, 'rgba(0, 0, 0, 0.998)');
  ctx.fillStyle = flashGrad;
  ctx.fillRect(0, 0, w, h);

  // ==========================================================================
  // 7. REBUILT 8-BIT STILL NIGHTMARE JUMPSCARE (0.00s -> 3.15s, SYNCED TO 3.66s AUDIO)
  // ==========================================================================
  if (phase === 'FP_NIGHTMARE_8BIT_JUMPSCARE') {
    const t = Math.max(0, Math.min(POST_NIGHT_3_JUMPSCARE_VISUAL_DURATION_SEC, phaseTimerSec));
    // Multi-Phase Horror Choreography:
    // - Phase 1 (0.00..0.52s): Stalking Lunge out of the dark doorway into the dying flashlight beam (keeping the strong start)
    // - Phase 2 (0.52..1.55s): Predatory Face-Grab! Giant 4-taloned hands slam onto the screen edges while Still Nightmare's
    //   lower mandible violently dislocates downward (jawOpen -> 168px) with 3 concentric rings of razor fangs & VHS glitch tears!
    // - Phase 3 (1.55..2.65s): Frenzied Double-Bite Mauling! Still Nightmare's colossal skull surges into the lens (scale -> 2.95x),
    //   thrashing diagonally as his curved upper & lower fanged jaws slam shut (1.55..1.92s), wrench back open with stretching
    //   crimson sinews (1.92..2.22s), and crush shut a second fatal time (2.22..2.65s) shattering the camera lens!
    // - Phase 4 (2.65..3.15s): Grinding blood-soaked fangs & arterial gore drenching the screen into pitch-black blackout!

    let lungeScale: number;
    let jawOpen: number;
    let headTiltRad = 0;
    let grabHandsProgress = 0;
    let bloodFloodAlpha = 0;

    if (t < 0.52) {
      // Phase 1: Erupting from the dark doorway
      const p = t / 0.52;
      const easeOut = 1 - Math.pow(1 - p, 2.4);
      lungeScale = 0.58 + easeOut * 0.42; // 0.58 -> 1.00
      jawOpen = 16 + easeOut * 78; // 16 -> 94
      headTiltRad = Math.sin(p * Math.PI) * 0.04;
      grabHandsProgress = Math.max(0, (p - 0.35) / 0.65);
    } else if (t < 1.55) {
      // Phase 2: Face-Grab & Grotesque Jaw Hyper-Dislocation
      const p = (t - 0.52) / 1.03;
      const surge = Math.pow(p, 1.35);
      lungeScale = 1.00 + surge * 0.84; // 1.00 -> 1.84
      // Jaw unhinges wider and wider with violent hydraulic spasms
      const spasm = (Math.floor(timeSec * 42) % 3) * 6;
      jawOpen = 94 + Math.min(1, p * 1.35) * 74 + spasm; // up to ~174px gaping abyss!
      headTiltRad = Math.sin(t * 26) * 0.065;
      grabHandsProgress = 1;
    } else if (t < 1.92) {
      // Phase 3A: First Savage Bite Slamming Shut Into the Camera!
      const p = (t - 1.55) / 0.37;
      const slam = Math.pow(p, 2.2);
      lungeScale = 1.84 + slam * 0.68; // 1.84 -> 2.52
      jawOpen = Math.max(4, 168 * (1 - slam)); // 168 -> 4 (CRUNCH!)
      headTiltRad = -0.09 * slam;
      grabHandsProgress = 1;
    } else if (t < 2.22) {
      // Phase 3B: Ripping Wrench-Open with Stretching Crimson Sinews
      const p = (t - 1.92) / 0.30;
      const rip = 1 - Math.pow(1 - p, 2);
      lungeScale = 2.52 + rip * 0.18; // 2.52 -> 2.70
      jawOpen = 4 + rip * 138; // 4 -> 142
      headTiltRad = -0.09 + rip * 0.19; // tilts to +0.10 rad
      grabHandsProgress = 1;
    } else if (t < 2.65) {
      // Phase 3C: Second Fatal Crushing Bite Engulfing the Entire Viewport!
      const p = (t - 2.22) / 0.43;
      const crunch = Math.pow(p, 2.1);
      lungeScale = 2.70 + crunch * 0.48; // 2.70 -> 3.18
      jawOpen = Math.max(0, 142 * (1 - crunch)); // 142 -> 0 (FATAL CRUSH!)
      headTiltRad = 0.10 * (1 - crunch) - 0.04 * crunch;
      grabHandsProgress = 1;
      bloodFloodAlpha = crunch * 0.45;
    } else {
      // Phase 4: Grinding Interlocked Fangs into Darkness
      const p = (t - 2.65) / 0.50;
      lungeScale = 3.18 + p * 0.18;
      jawOpen = (Math.floor(timeSec * 55) % 2) * 8;
      headTiltRad = ((Math.floor(timeSec * 40) % 3) - 1) * 0.03;
      grabHandsProgress = 1;
      bloodFloodAlpha = Math.min(0.96, 0.45 + p * 0.52);
    }

    const shakeAmp = t >= 1.55 ? 24 : t >= 0.52 ? 15 : 9;
    const jx = Math.round(Math.sin(timeSec * 135) * shakeAmp);
    const jy = Math.round(Math.cos(timeSec * 160) * (shakeAmp * 0.85));

    // Visceral crimson/black strobe over the pizzeria hallway
    const strobeRed = Math.floor(timeSec * 36) % 2 === 0;
    ctx.fillStyle = strobeRed ? 'rgba(60, 4, 10, 0.90)' : 'rgba(4, 1, 3, 0.94)';
    ctx.fillRect(0, 0, w, h);

    // ========================================================================
    // GIANT SKELETAL RAZOR-CLAWED HANDS GRABBING THE EDGES OF THE PLAYER'S SCREEN
    // ========================================================================
    if (grabHandsProgress > 0.05) {
      const handInX = Math.round((1 - grabHandsProgress) * 140);
      const handGripY = Math.round(h * 0.52 + Math.sin(timeSec * 48) * 10);

      const drawScreenGrabbingClaw = (side: -1 | 1) => {
        ctx.save();
        const baseX = side === -1 ? -24 - handInX + jx * 0.6 : w + 24 + handInX + jx * 0.6;
        ctx.translate(baseX, handGripY);
        // Gaunt armored forearm & steel wrist joint
        drawPixelRect(ctx, side === -1 ? -40 : -56, -76, 96, 152, '#07070b');
        drawPixelRect(ctx, side === -1 ? -20 : -52, -56, 72, 112, '#1f1f29');
        drawPixelRect(ctx, side === -1 ? 12 : -56, -42, 44, 84, '#52525b'); // Exposed hydraulic wrist

        // 4 Long Curved Razor Talons clamping inward onto the camera frame!
        const fingerOffsetsY = [-92, -34, 24, 82];
        const fingerLengths = [128, 148, 142, 116];
        for (let f = 0; f < 4; f++) {
          const fy = fingerOffsetsY[f];
          const flen = fingerLengths[f];
          const dir = side === -1 ? 1 : -1;
          // Dark metal finger phalanges
          drawPixelRect(
            ctx,
            dir === 1 ? 36 : -36 - Math.round(flen * 0.45),
            fy - 14,
            Math.round(flen * 0.45),
            28,
            '#3f3f46'
          );
          // Gleaming bone/steel middle blade
          drawPixelRect(
            ctx,
            dir === 1 ? 36 + Math.round(flen * 0.42) : -36 - Math.round(flen * 0.82),
            fy - 10,
            Math.round(flen * 0.40),
            20,
            '#d4d4d8'
          );
          // Blood-drenched needle talon tip digging into the screen!
          drawPixelRect(
            ctx,
            dir === 1 ? 36 + Math.round(flen * 0.78) : -36 - flen,
            fy - 6,
            Math.round(flen * 0.26),
            14,
            '#dc2626'
          );
          drawPixelRect(
            ctx,
            dir === 1 ? 36 + flen - 6 : -36 - flen - 8,
            fy - 4,
            14,
            10,
            '#7f1d1d'
          );
        }
        ctx.restore();
      };

      drawScreenGrabbingClaw(-1);
      drawScreenGrabbingClaw(1);
    }

    // ========================================================================
    // STILL NIGHTMARE'S EMACIATED TORSO, SKULL & UNHINGED TRIPLE-ROW FANGED MAW
    // ========================================================================
    ctx.save();
    ctx.translate(cx + jx, h * 0.54 + jy);
    ctx.rotate(headTiltRad);
    ctx.scale(lungeScale, lungeScale);

    const upperLiftY = -Math.round(jawOpen * 0.42);
    const lowerDropY = Math.round(jawOpen * 0.58);

    // 1. Exposed Endoskeleton Ribcage, Spine & Pulsing Crimson Core Below the Jaw (visible during lunge/grab)
    if (lungeScale < 2.3) {
      drawPixelRect(ctx, -124, 56, 248, 140, '#050508');
      drawPixelRect(ctx, -96, 68, 192, 110, '#111118');
      // Central steel spine & horizontal ribs
      drawPixelRect(ctx, -14, 64, 28, 116, '#52525b');
      for (let ry = 76; ry <= 156; ry += 20) {
        drawPixelRect(ctx, -84, ry, 168, 8, '#a1a1aa');
      }
      // Pulsing red danger heart inside the ribcage
      drawPixelRect(ctx, -20, 96, 40, 32, '#991b1b');
      drawPixelRect(ctx, -12, 102, 24, 20, '#ef4444');
      // Half-destroyed golden bowtie at the throat
      drawPixelRect(ctx, -64, 46, 52, 24, '#ca8a04');
      drawPixelRect(ctx, -12, 50, 24, 18, '#854d0e');
      drawPixelRect(ctx, 12, 52, 28, 12, '#713f12');
    }

    // 2. Cavernous Abyssal Throat, Hydraulic Jaw Pistons & Pharyngeal Inner Gullet Rings
    const mawTopY = -28 + upperLiftY;
    const mawBotY = 36 + lowerDropY;
    const mawH = Math.max(16, mawBotY - mawTopY);

    drawPixelRect(ctx, -172, mawTopY, 344, mawH, '#020001');
    drawPixelRect(ctx, -148, mawTopY + 10, 296, Math.max(10, mawH - 20), '#1f0205');
    drawPixelRect(ctx, -118, mawTopY + 22, 236, Math.max(8, mawH - 44), '#3b060a');
    drawPixelRect(ctx, -86, mawTopY + 34, 172, Math.max(6, mawH - 68), '#090002');

    // Pulsing concentric crimson throat rings deep inside the gullet
    if (jawOpen > 28) {
      const ringMidY = Math.round((mawTopY + mawBotY) * 0.5);
      drawPixelRect(ctx, -96, ringMidY - Math.round(mawH * 0.28), 192, 6, '#7f1d1d');
      drawPixelRect(ctx, -96, ringMidY + Math.round(mawH * 0.28), 192, 6, '#7f1d1d');
      drawPixelRect(ctx, -64, ringMidY - Math.round(mawH * 0.16), 128, 6, '#dc2626');
      drawPixelRect(ctx, -64, ringMidY + Math.round(mawH * 0.16), 128, 6, '#dc2626');
      drawPixelRect(ctx, -36, ringMidY - 8, 72, 16, '#020001');
    }

    // Exposed Hydraulic Jaw Struts & Torn Cheek Sinews on Both Sides of the Dislocated Maw
    drawPixelRect(ctx, -166, mawTopY + 4, 16, mawH - 8, '#52525b');
    drawPixelRect(ctx, 150, mawTopY + 4, 16, mawH - 8, '#52525b');
    drawPixelRect(ctx, -146, mawTopY + 8, 10, mawH - 16, '#991b1b');
    drawPixelRect(ctx, 136, mawTopY + 8, 10, mawH - 16, '#991b1b');
    drawPixelRect(ctx, -130, mawTopY + 12, 8, mawH - 24, '#a1a1aa');
    drawPixelRect(ctx, 122, mawTopY + 12, 8, mawH - 24, '#a1a1aa');

    // 2nd & 3rd Inner Rows of Metallic Endoskeleton & Pharyngeal Gullet Fangs!
    if (jawOpen > 18) {
      for (let it = 0; it < 11; it++) {
        const itx = -115 + it * 22;
        const innerLen = it % 2 === 0 ? 36 : 26;
        // Upper 2nd-row steel endoskeleton fangs
        drawPixelRect(ctx, itx, mawTopY + 14, 12, innerLen, '#a1a1aa');
        drawPixelRect(ctx, itx + 2, mawTopY + 14 + innerLen - 10, 8, 14, '#991b1b');
        // Lower 2nd-row steel endoskeleton fangs
        drawPixelRect(ctx, itx, mawBotY - 14 - innerLen, 12, innerLen, '#a1a1aa');
        drawPixelRect(ctx, itx + 2, mawBotY - 18 - innerLen, 8, 14, '#991b1b');
      }

      // Stretching visceral strands of crimson blood & saliva across the open maw!
      const strandXList = [-126, -82, -34, 16, 68, 118];
      for (let sIdx = 0; sIdx < strandXList.length; sIdx++) {
        const sx = strandXList[sIdx];
        drawPixelRect(
          ctx,
          sx,
          mawTopY + 16,
          4,
          Math.max(12, mawH - 32),
          sIdx % 2 === 0 ? '#991b1b' : '#dc2626'
        );
        drawPixelRect(ctx, sx - 2, mawTopY + Math.round(mawH * 0.46), 8, 14, '#ef4444');
      }
    }

    // 3. DEMACRADO (EMACIATED / WITHERED) UPPER SKULL, ROTTED FLESH & CAVernous BLEEDING EYE SOCKETS
    // Tattered Golden-Brown Top Hat
    drawPixelRect(ctx, -108, -218 + upperLiftY, 216, 18, '#a16207');
    drawPixelRect(ctx, -74, -280 + upperLiftY, 148, 64, '#854d0e');
    drawPixelRect(ctx, -74, -232 + upperLiftY, 148, 14, '#09090b');
    drawPixelRect(ctx, -52, -268 + upperLiftY, 28, 16, '#020001');
    drawPixelRect(ctx, 22, -258 + upperLiftY, 32, 18, '#020001');

    // Shredded Animatronic Ears with Exposed Steel Endoskeleton Frames
    drawPixelRect(ctx, -208, -194 + upperLiftY, 62, 56, '#09090d');
    drawPixelRect(ctx, -196, -182 + upperLiftY, 38, 36, '#52525b');
    drawPixelRect(ctx, -186, -172 + upperLiftY, 20, 18, '#7f1d1d');
    drawPixelRect(ctx, 146, -192 + upperLiftY, 60, 54, '#09090d');
    drawPixelRect(ctx, 158, -180 + upperLiftY, 36, 32, '#3f3f46');
    drawPixelRect(ctx, 178, -194 + upperLiftY, 24, 16, '#020001');

    // Sculpted, Emaciated Upper Cranium (Narrowed hollow temples + wide menacing cheekbones)
    drawPixelRect(ctx, -164, -172 + upperLiftY, 328, 54, '#08080c');
    drawPixelRect(ctx, -180, -122 + upperLiftY, 360, 56, '#0c0c12');
    drawPixelRect(ctx, -152, -162 + upperLiftY, 304, 84, '#151218');
    // Exposed steel cranium plates & crimson rot fissures on the forehead
    drawPixelRect(ctx, -132, -156 + upperLiftY, 72, 24, '#3f3f46');
    drawPixelRect(ctx, -122, -150 + upperLiftY, 52, 14, '#71717a');
    drawPixelRect(ctx, 44, -156 + upperLiftY, 80, 24, '#450a0a');
    drawPixelRect(ctx, 56, -150 + upperLiftY, 56, 14, '#7f1d1d');
    // Deep jagged skull fracture splitting the brow
    drawPixelRect(ctx, -8, -168 + upperLiftY, 14, 48, '#020001');
    drawPixelRect(ctx, -18, -140 + upperLiftY, 14, 30, '#020001');

    // Fierce Angled Crimson V-Brow Ridges Above the Eye Sockets
    for (let bStep = 0; bStep < 6; bStep++) {
      drawPixelRect(
        ctx,
        -142 + bStep * 18,
        -138 + bStep * 4 + upperLiftY,
        22,
        10,
        '#991b1b'
      );
      drawPixelRect(
        ctx,
        120 - bStep * 18,
        -138 + bStep * 4 + upperLiftY,
        22,
        10,
        '#991b1b'
      );
    }

    // Cavernous, Sunken Eye Sockets with Arterial Blood Tears Pouring Down the Snout
    drawPixelRect(ctx, -142, -126 + upperLiftY, 102, 68, '#010102');
    drawPixelRect(ctx, 40, -126 + upperLiftY, 102, 68, '#010102');
    drawPixelRect(ctx, -138, -62 + upperLiftY, 94, 8, '#7f1d1d');
    drawPixelRect(ctx, 44, -62 + upperLiftY, 94, 8, '#7f1d1d');
    drawPixelRect(ctx, -110, -56 + upperLiftY, 14, 32, '#991b1b');
    drawPixelRect(ctx, -84, -56 + upperLiftY, 10, 26, '#dc2626');
    drawPixelRect(ctx, 74, -56 + upperLiftY, 14, 32, '#991b1b');
    drawPixelRect(ctx, 98, -56 + upperLiftY, 10, 26, '#dc2626');

    // Hypnotic, Crazed Ringed Nightmare Eyes Jittering Violently Inside the Sockets
    const eyeJitterX = ((Math.floor(timeSec * 65) % 3) - 1) * 3;
    const eyeJitterY = ((Math.floor(timeSec * 55) % 3) - 1) * 2;
    // Left eye
    drawPixelRect(ctx, -112 + eyeJitterX, -112 + eyeJitterY + upperLiftY, 42, 42, '#7f1d1d');
    drawPixelRect(ctx, -104 + eyeJitterX, -104 + eyeJitterY + upperLiftY, 26, 26, '#ef4444');
    drawPixelRect(ctx, -96 + eyeJitterX, -96 + eyeJitterY + upperLiftY, 10, 10, '#ffffff');
    // Right eye
    drawPixelRect(ctx, 70 - eyeJitterX, -112 + eyeJitterY + upperLiftY, 42, 42, '#7f1d1d');
    drawPixelRect(ctx, 78 - eyeJitterX, -104 + eyeJitterY + upperLiftY, 26, 26, '#ef4444');
    drawPixelRect(ctx, 86 - eyeJitterX, -96 + eyeJitterY + upperLiftY, 10, 10, '#ffffff');

    // Curved Withered Snout Arch & Raw Bleeding Upper Gum Line
    drawPixelRect(ctx, -184, -66 + upperLiftY, 368, 44, '#0c0a0e');
    drawPixelRect(ctx, -172, -60 + upperLiftY, 344, 36, '#1c1417');
    // Skeletal nasal cavity
    drawPixelRect(ctx, -42, -74 + upperLiftY, 84, 32, '#020204');
    drawPixelRect(ctx, -32, -68 + upperLiftY, 26, 20, '#27272a');
    drawPixelRect(ctx, 6, -68 + upperLiftY, 26, 20, '#27272a');
    // Curved upper gum arch (outer edges curve slightly downward for an organic predatory jaw arch!)
    for (let gx = -176; gx < 176; gx += 22) {
      const archCurveY = Math.round(Math.pow(Math.abs(gx) / 176, 2) * 14);
      drawPixelRect(ctx, gx, -26 + archCurveY + upperLiftY, 24, 16, '#7f1d1d');
      drawPixelRect(ctx, gx, -18 + archCurveY + upperLiftY, 24, 12, '#991b1b');
    }

    // 4. 15 CURVED, OVERCROWDED UPPER RAZOR FANGS DRIPPING WITH BLOOD
    const upperToothLengths = [64, 46, 56, 44, 60, 48, 54, 44, 54, 48, 60, 44, 56, 46, 64];
    for (let tIdx = 0; tIdx < 15; tIdx++) {
      const tx = -168 + tIdx * 23;
      const archY = Math.round(Math.pow(Math.abs(tx + 9) / 176, 2) * 14);
      const toothLen = upperToothLengths[tIdx];
      const baseTopY = -10 + archY + upperLiftY;

      drawPixelRect(ctx, tx, baseTopY - 4, 18, 8, '#991b1b');
      drawPixelRect(
        ctx,
        tx,
        baseTopY,
        18,
        Math.round(toothLen * 0.46),
        tIdx % 2 === 0 ? '#e4e4e7' : '#d6d3d1'
      );
      drawPixelRect(
        ctx,
        tx + 3,
        baseTopY + Math.round(toothLen * 0.46),
        12,
        Math.round(toothLen * 0.30),
        '#f4f4f5'
      );
      drawPixelRect(
        ctx,
        tx + 5,
        baseTopY + Math.round(toothLen * 0.76),
        8,
        Math.round(toothLen * 0.28),
        '#dc2626'
      );
      drawPixelRect(ctx, tx + 6, baseTopY + toothLen, 6, 10, '#7f1d1d');
    }

    // 5. CURVED DISLOCATED LOWER MANDIBLE & 14 INTERLOCKING UPWARD RAZOR FANGS
    const jawY = 34 + lowerDropY;
    drawPixelRect(ctx, -176, jawY, 352, 84, '#08080c');
    drawPixelRect(ctx, -162, jawY + 8, 324, 68, '#181216');
    drawPixelRect(ctx, -140, jawY + 24, 280, 44, '#3f3f46'); // Exposed steel mandible bar
    drawPixelRect(ctx, -112, jawY + 32, 224, 28, '#450a0a');

    for (let gx = -168; gx < 168; gx += 22) {
      const archCurveY = -Math.round(Math.pow(Math.abs(gx) / 176, 2) * 12);
      drawPixelRect(ctx, gx, jawY - 10 + archCurveY, 24, 16, '#7f1d1d');
      drawPixelRect(ctx, gx, jawY - 6 + archCurveY, 24, 10, '#991b1b');
    }

    const lowerToothLengths = [58, 42, 52, 40, 56, 44, 50, 50, 44, 56, 40, 52, 42, 58];
    for (let tIdx = 0; tIdx < 14; tIdx++) {
      const tx = -156 + tIdx * 23;
      const archY = -Math.round(Math.pow(Math.abs(tx + 9) / 176, 2) * 12);
      const toothLen = lowerToothLengths[tIdx];
      const baseBotY = jawY + archY;

      drawPixelRect(
        ctx,
        tx,
        baseBotY - Math.round(toothLen * 0.46),
        18,
        Math.round(toothLen * 0.46),
        tIdx % 2 === 0 ? '#d4d4d8' : '#e7e5e4'
      );
      drawPixelRect(
        ctx,
        tx + 3,
        baseBotY - Math.round(toothLen * 0.76),
        12,
        Math.round(toothLen * 0.30),
        '#f4f4f5'
      );
      drawPixelRect(
        ctx,
        tx + 5,
        baseBotY - toothLen,
        8,
        Math.round(toothLen * 0.28),
        '#dc2626'
      );
      drawPixelRect(ctx, tx + 6, baseBotY - toothLen - 8, 6, 10, '#7f1d1d');
    }

    ctx.restore();

    // ========================================================================
    // VHS CHROMATIC GLITCH SLICES & DARKENING VIGNETTE
    // ========================================================================
    // Red/Cyan horizontal VHS glitch tear bars during the scream
    for (let g = 0; g < 4; g++) {
      const gy = ((Math.floor(timeSec * 290) + g * 137) % h);
      const gh = 4 + (g % 2) * 4;
      ctx.fillStyle =
        g % 2 === 0 ? 'rgba(239, 68, 68, 0.38)' : 'rgba(56, 189, 248, 0.26)';
      ctx.fillRect(0, gy, w, gh);
    }

    if (bloodFloodAlpha > 0) {
      ctx.fillStyle = `rgba(38, 2, 5, ${bloodFloodAlpha.toFixed(3)})`;
      ctx.fillRect(0, 0, w, h);
    }
  }
}

// ============================================================================
// SCENE 2: EXTERIOR DRAGGED BY DARK RABBIT (SLOWER & HALTING "A TROMPICONES")
// ============================================================================

function drawExteriorDraggedByRabbitScene(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  elapsedSec: number,
  timeSec: number
) {
  // Exact same exterior environment & ruined wooden local from Intro & Night 2->3!
  ctx.fillStyle = '#04070d';
  ctx.fillRect(0, 0, W, H);

  const groundY = 368;
  drawPixelRect(ctx, 120, 48, 8, 8, '#94a3b8');
  drawPixelRect(ctx, 310, 72, 4, 4, '#64748b');
  drawPixelRect(ctx, 520, 40, 8, 8, '#94a3b8');

  for (let tx = 40; tx < 640; tx += 76) {
    draw8BitPineTree(ctx, tx, groundY, 1.2);
  }

  drawPixelRect(ctx, 0, groundY, W, H - groundY, '#09140e');
  drawPixelRect(ctx, 0, groundY, 740, 36, '#1c1917');
  drawPixelRect(ctx, 40, groundY + 8, 680, 20, '#292524');

  // Authentic ruined wooden facility on the right (doorway at x = 683..751)
  drawRuinedWoodenBuilding(ctx, groundY);

  // Slower, halting ("a trompicones") drag state over 6.4s!
  const dragState = getPostNight3RabbitDragState(elapsedSec);
  const startX = 665;
  const { rabbitX, richardX, isHeaving, rabbitLeanX, bodyBumpY } = dragState;
  const dragY = groundY + 14;

  // Continuous trail of crimson blood smeared along the gravel path behind Richard,
  // with thicker blood clots pooled at each halting heave ("trompicón")!
  const trailWidth = Math.max(12, startX - richardX + 32);
  drawPixelRect(ctx, richardX, dragY - 8, trailWidth, 12, '#450a0a');
  drawPixelRect(ctx, richardX + 4, dragY - 6, trailWidth - 8, 8, '#991b1b');
  for (let sx = Math.floor(richardX); sx <= startX + 16; sx += 22) {
    const isClotNode = Math.floor((startX - sx) / 44) % 2 === 0;
    const splatterH = isClotNode ? 10 : 5;
    drawPixelRect(ctx, sx, dragY - 7, isClotNode ? 16 : 10, splatterH, '#dc2626');
  }

  // Unconscious Richard being dragged horizontally on the ground (jolts during each heave!)
  const rxBody = Math.round(richardX);
  const ryBody = Math.round(dragY + bodyBumpY);
  // Legs
  drawPixelRect(ctx, rxBody + 28, ryBody - 16, 28, 12, '#1e293b');
  drawPixelRect(ctx, rxBody + 52, ryBody - 18, 8, 14, '#271509');
  // Blue jacket torso with bloodstains
  drawPixelRect(ctx, rxBody, ryBody - 20, 32, 16, '#1e3a8a');
  drawPixelRect(ctx, rxBody + 8, ryBody - 18, 16, 10, '#991b1b');
  // Head & hair
  drawPixelRect(ctx, rxBody - 18, ryBody - 22, 20, 16, '#fcd34d');
  drawPixelRect(ctx, rxBody - 18, ryBody - 24, 20, 6, '#451a03');
  // Dragged arm stretched taut toward the dark rabbit
  drawPixelRect(ctx, rxBody - 36, ryBody - 18, 22, 8, '#172554');

  // Dark Silhouette Rabbit (Black Bonnie) hauling Richard in heavy, halting lurches ("a trompicones")
  const stepLift = isHeaving ? 4 : 0;
  const rbx = Math.round(rabbitX);
  const rby = Math.round(dragY - stepLift);

  // Shadow pool
  drawPixelRect(ctx, rbx - 24, dragY - 4, 48, 8, 'rgba(0,0,0,0.75)');
  // Long rabbit ears (lean forward during each heave yank)
  drawPixelRect(ctx, rbx - 16 + rabbitLeanX, rby - 134, 10, 36, '#18181b');
  drawPixelRect(ctx, rbx - 14 + rabbitLeanX, rby - 132, 8, 32, '#020204');
  drawPixelRect(ctx, rbx + 4 + rabbitLeanX, rby - 130, 10, 32, '#18181b');
  drawPixelRect(ctx, rbx + 6 + rabbitLeanX, rby - 128, 8, 28, '#020204');
  // Head
  drawPixelRect(ctx, rbx - 20 + rabbitLeanX, rby - 98, 40, 30, '#020204');
  // Eerie glowing eye looking left
  drawPixelRect(ctx, rbx - 14 + rabbitLeanX, rby - 86, 6, 6, '#ffffff');
  drawPixelRect(ctx, rbx - 14 + rabbitLeanX, rby - 86, 4, 4, '#ef4444');
  // Torso & planted/striding legs
  drawPixelRect(ctx, rbx - 22 + Math.round(rabbitLeanX * 0.5), rby - 68, 44, 42, '#020204');
  drawPixelRect(ctx, rbx - 18 + (isHeaving ? -4 : 0), dragY - 26 - stepLift, 14, 26, '#020204');
  drawPixelRect(ctx, rbx + 4 + (isHeaving ? 4 : 0), dragY - 26, 14, 26, '#020204');
  // Arm reaching back gripping Richard's arm (yanks taut during each heave)
  drawPixelRect(
    ctx,
    rbx + 16 + Math.round(rabbitLeanX * 0.5),
    rby - 48 + (isHeaving ? 2 : 0),
    28,
    10,
    '#020204'
  );
  // Suppress unused timeSec lint warning
  void timeSec;
}

// ============================================================================
// SCENE 3: HOSPITAL ROOM SCENE (APPROVED BY USER — KEPT INTACT)
// ============================================================================

function drawHospitalRoomScene(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  phase: PostNight3MinigamePhase,
  hospitalTabIndex: number,
  phaseTimerSec: number,
  timeSec: number
) {
  const floorY = 415;

  // Clinical hospital walls (daylight white & soft teal lower wall)
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(0, 0, w, floorY - 120);
  ctx.fillStyle = '#99f6e4';
  ctx.fillRect(0, floorY - 120, w, 120);
  ctx.fillStyle = '#0d9488';
  ctx.fillRect(0, floorY - 124, w, 6);

  // Clean tiled hospital floor
  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(0, floorY, w, h - floorY);
  ctx.fillStyle = '#94a3b8';
  for (let x = 0; x < w; x += 48) {
    ctx.fillRect(x, floorY, 2, h - floorY);
  }

  // Daylight Hospital Window
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(140, 96, 130, 120);
  ctx.fillStyle = '#7dd3fc';
  ctx.fillRect(146, 102, 56, 108);
  ctx.fillRect(208, 102, 56, 108);

  // Hospital Red Cross Sign on wall
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(440, 96, 64, 64);
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 3;
  ctx.strokeRect(440, 96, 64, 64);
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(464, 108, 16, 40);
  ctx.fillRect(452, 120, 40, 16);

  // Hospital Room Exit Door on the right (x = 760)
  const doorW = 68;
  const doorH = 116;
  const doorX = 760 - doorW / 2;
  const doorY = floorY - doorH;
  ctx.fillStyle = '#475569';
  ctx.fillRect(doorX - 6, doorY - 6, doorW + 12, doorH + 6);
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(doorX, doorY, doorW, doorH);
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(doorX + 14, doorY + 16, 40, 36);
  ctx.fillStyle = '#eab308';
  ctx.fillRect(doorX + doorW - 14, doorY + 56, 8, 8);

  // Heart Monitor & IV Stand next to bed
  ctx.fillStyle = '#334155';
  ctx.fillRect(190, floorY - 110, 44, 110);
  ctx.fillStyle = '#022c22';
  ctx.fillRect(194, floorY - 104, 36, 28);
  // Green ECG pulse line
  ctx.fillStyle = '#10b981';
  const pulseX = 196 + (Math.floor(timeSec * 30) % 30);
  ctx.fillRect(196, floorY - 90, 32, 2);
  ctx.fillRect(pulseX, floorY - 98, 4, 16);

  // Hospital Bed (x = 250..410)
  ctx.fillStyle = '#64748b';
  ctx.fillRect(250, floorY - 78, 12, 78);
  ctx.fillRect(410, floorY - 56, 12, 56);
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(262, floorY - 52, 148, 28);
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(300, floorY - 50, 108, 24);
  // Pillow
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(266, floorY - 62, 34, 12);

  // Nurse standing at x = 468 (pushed back during HOSPITAL_ESCAPE_ANIMATION)
  const nursePushX =
    phase === 'HOSPITAL_ESCAPE_ANIMATION'
      ? Math.min(48, phaseTimerSec * 95)
      : 0;
  const nurseX = Math.round(468 + nursePushX);
  // Legs
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(nurseX - 10, floorY - 34, 8, 34);
  ctx.fillRect(nurseX + 2, floorY - 34, 8, 34);
  // White Nurse Uniform
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(nurseX - 14, floorY - 72, 28, 40);
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(nurseX - 2, floorY - 60, 4, 12);
  ctx.fillRect(nurseX - 6, floorY - 56, 12, 4);
  // Head & Nurse Cap
  ctx.fillStyle = '#fde68a';
  ctx.fillRect(nurseX - 11, floorY - 94, 22, 22);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(nurseX - 12, floorY - 102, 24, 8);
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(nurseX - 2, floorY - 100, 4, 4);
  ctx.fillStyle = '#09090b';
  ctx.fillRect(nurseX - 6, floorY - 86, 4, 4);

  if (phase === 'HOSPITAL_ESCAPE_ANIMATION') {
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('!', nurseX, floorY - 110);

    const runX = Math.min(760, 350 + phaseTimerSec * 290);
    draw8BitProtagonist(ctx, runX, floorY + 4, 1, phaseTimerSec * 1.4, true, false, timeSec);
  } else {
    const sittingUp = hospitalTabIndex >= 4 ? 10 : 0;
    ctx.fillStyle = '#fcd34d';
    ctx.fillRect(274, floorY - 74 - sittingUp, 22, 20);
    ctx.fillStyle = '#451a03';
    ctx.fillRect(274, floorY - 78 - sittingUp, 22, 6);
    ctx.fillStyle = '#09090b';
    ctx.fillRect(290, floorY - 68 - sittingUp, 4, 4);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(274, floorY - 72 - sittingUp, 22, 4);

    if (phase === 'HOSPITAL_DIALOGUE' && hospitalTabIndex === 3) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(284, floorY - 118, 52, 26);
      ctx.fillStyle = '#09090b';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('...', 310, floorY - 100);
    }
  }
}

// ============================================================================
// SCENE 4: EXACT SAME HOTEL EXTERIOR, HALLWAYS & ROOM 303 AS NIGHT 2->3
// ============================================================================

function drawHotelExteriorSceneShared(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  timeSec: number,
  playerX: number,
  playerFacing: -1 | 1,
  walkCycle: number,
  isWalking: boolean,
  isDaytime: boolean
) {
  if (isDaytime) {
    // Daytime sky when Richard arrives at the hotel in the middle of the day after escaping the hospital
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(0, 0, W, H);
    // Sun & 8-bit clouds in the upper corners
    drawPixelRect(ctx, 28, 20, 36, 36, '#fde047');
    drawPixelRect(ctx, 880, 24, 56, 16, '#f8fafc');
  } else {
    ctx.fillStyle = '#070b16';
    ctx.fillRect(0, 0, W, H);
    drawPixelRect(ctx, 40, 24, 4, 4, '#cbd5e1');
    drawPixelRect(ctx, 910, 32, 4, 4, '#e2e8f0');
  }

  const groundY = 424;

  // Side trees flanking the grand hotel wings (identical to Night 2->3)
  draw8BitPineTree(ctx, 36, groundY, 1.25);
  draw8BitPineTree(ctx, 924, groundY, 1.25);

  // Street & sidewalk (identical to Night 2->3)
  drawPixelRect(ctx, 0, groundY, W, H - groundY, '#111827');
  drawPixelRect(ctx, 0, groundY, W, 28, '#334155');
  drawPixelRect(ctx, 0, groundY + 24, W, 4, '#64748b');

  // Grand 3-Story Hotel Building Facade (identical to Night 2->3)
  const hx = 72;
  const hw = 816;
  const hh = 378;
  const hy = groundY - hh; // y = 46

  // Ornate Rooftop Balustrade & Cornice
  drawPixelRect(ctx, hx - 16, hy - 16, hw + 32, 16, '#ca8a04');
  drawPixelRect(ctx, hx - 12, hy - 12, hw + 24, 8, '#fef08a');

  // Main refined cream/limestone hotel facade
  drawPixelRect(ctx, hx, hy, hw, hh, '#d6c79c');
  drawPixelRect(ctx, hx + 8, hy + 8, hw - 16, hh - 8, '#f5f0e1');

  // Vertical architectural pilasters separating the grand wings
  const pilasters = [hx + 12, 240, 384, 576, 720, hx + hw - 28];
  for (const px of pilasters) {
    drawPixelRect(ctx, px, hy + 8, 16, hh - 8, '#e5dcc2');
  }

  // Horizontal floor cornices dividing Planta 3 (top), Planta 2 (middle), and Planta 1 (ground)
  drawPixelRect(ctx, hx - 6, hy + 126, hw + 12, 10, '#ca8a04');
  drawPixelRect(ctx, hx - 4, hy + 128, hw + 8, 4, '#fef08a');
  drawPixelRect(ctx, hx - 6, hy + 252, hw + 12, 10, '#ca8a04');
  drawPixelRect(ctx, hx - 4, hy + 254, hw + 8, 4, '#fef08a');

  // Grand Illuminated "★ HOTEL ★" Rooftop Sign
  drawPixelRect(ctx, 376, 4, 208, 28, '#1e1b4b');
  drawPixelRect(ctx, 380, 8, 200, 20, '#eab308');
  ctx.fillStyle = '#09090b';
  ctx.font = 'bold 16px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('★ HOTEL ★', 480, 23);

  // 6 Symmetrical Window Columns across the 3 realistic stories
  const winCols = [116, 180, 280, 628, 756, 820];
  for (let f = 0; f < 3; f++) {
    const wy = hy + 24 + f * 126;
    for (const wx of winCols) {
      drawPixelRect(ctx, wx - 4, wy - 4, 52, 76, '#78350f');
      const isLit = (f + wx) % 3 !== 0;
      drawPixelRect(
        ctx,
        wx,
        wy,
        44,
        68,
        isDaytime ? '#bae6fd' : isLit ? '#fef08a' : '#1e293b'
      );
      drawPixelRect(ctx, wx + 20, wy, 4, 68, '#78350f');
      drawPixelRect(ctx, wx, wy + 32, 44, 4, '#78350f');
      drawPixelRect(ctx, wx - 8, wy + 68, 60, 6, '#ca8a04');
    }
  }

  // Center Suite Windows on Planta 3 and Planta 2
  const centerCols = [416, 496];
  for (let f = 0; f < 2; f++) {
    const wy = hy + 24 + f * 126;
    for (const wx of centerCols) {
      drawPixelRect(ctx, wx - 4, wy - 4, 56, 76, '#78350f');
      drawPixelRect(ctx, wx, wy, 48, 68, isDaytime ? '#bae6fd' : '#fef08a');
      drawPixelRect(ctx, wx + 22, wy, 4, 68, '#78350f');
      drawPixelRect(ctx, wx, wy + 32, 48, 4, '#78350f');
      drawPixelRect(ctx, wx - 8, wy + 68, 64, 6, '#ca8a04');
    }
  }

  // Grand Hotel Entrance Double Doors on Planta 1
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
}

function drawHallwayBlackSilhouetteBonnie(
  ctx: CanvasRenderingContext2D,
  x: number,
  floorY: number,
  handReachProgress = 0
) {
  // Dark shadow pool
  drawPixelRect(ctx, x - 28, floorY - 4, 56, 8, 'rgba(0, 0, 0, 0.85)');
  // Eerie dark aura
  drawPixelRect(ctx, x - 28, floorY - 120, 56, 118, 'rgba(0, 0, 0, 0.45)');

  // Long iconic rabbit ears (pitch-black silhouette)
  drawPixelRect(ctx, x - 16, floorY - 134, 12, 38, '#18181b');
  drawPixelRect(ctx, x - 14, floorY - 132, 8, 34, '#020204');
  drawPixelRect(ctx, x + 4, floorY - 130, 12, 34, '#18181b');
  drawPixelRect(ctx, x + 6, floorY - 128, 8, 30, '#020204');

  // Head
  drawPixelRect(ctx, x - 20, floorY - 98, 40, 32, '#18181b');
  drawPixelRect(ctx, x - 16, floorY - 94, 32, 26, '#020204');

  // White glowing pinprick eyes staring toward Richard on the right
  drawPixelRect(ctx, x - 4, floorY - 84, 4, 4, '#ffffff');
  drawPixelRect(ctx, x + 8, floorY - 84, 4, 4, '#ffffff');

  // Torso & legs
  drawPixelRect(ctx, x - 22, floorY - 64, 44, 40, '#020204');
  drawPixelRect(ctx, x - 28, floorY - 60, 8, 32, '#09090b');

  // Right arm slowly raising toward Richard (who is to the right at x = 1480) when handReachProgress > 0
  if (handReachProgress > 0) {
    const reachLen = Math.round(12 + handReachProgress * 36);
    const armY = Math.round(floorY - 56 - handReachProgress * 16);
    drawPixelRect(ctx, x + 20, armY, reachLen, 10, '#020204');
    drawPixelRect(ctx, x + 18 + reachLen, armY - 2, 6, 14, '#09090b');
  } else {
    drawPixelRect(ctx, x + 20, floorY - 60, 8, 32, '#09090b');
  }

  drawPixelRect(ctx, x - 16, floorY - 24, 12, 24, '#020204');
  drawPixelRect(ctx, x + 4, floorY - 24, 12, 24, '#020204');
}

function drawHotelHallwaySceneShared(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  timeSec: number,
  floor: 1 | 2 | 3,
  playerX: number,
  playerFacing: -1 | 1,
  walkCycle: number,
  isWalking: boolean,
  f2State: ReturnType<typeof getPostNight3Floor2FlickerState> | null,
  f3State: ReturnType<typeof getPostNight3Floor3FlickerState> | null,
  isThinkingOnFloor3 = false
) {
  const hallwayLightOn = f2State ? f2State.lightOn : f3State ? f3State.lightOn : true;
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

  // Outer golden-ivory frame along the long corridor (100% identical to Night 2->3)
  drawPixelRect(ctx, hallLeft - 8, hallTop - 8, hallW + 16, hallH + 64, '#d6c79c');
  drawPixelRect(ctx, hallLeft - 4, hallTop - 4, hallW + 8, hallH + 56, '#fef9c3');

  // Wallpaper & wainscoting matching the hotel's refined white & gold aesthetic
  drawPixelRect(ctx, hallLeft, hallTop, hallW, hallH, '#f5f0e1');
  for (let wx = hallLeft + 12; wx < hallRight - 8; wx += 28) {
    drawPixelRect(ctx, wx, hallTop + 12, 8, hallH - 76, '#ede3c8');
  }
  drawPixelRect(ctx, hallLeft, hallTop, hallW, 12, '#eab308');
  drawPixelRect(ctx, hallLeft, floorY - 68, hallW, 68, '#faf8f5');
  drawPixelRect(ctx, hallLeft, floorY - 72, hallW, 6, '#eab308');

  // Red & gold hotel hallway carpet runner over oak floor
  drawPixelRect(ctx, hallLeft, floorY, hallW, 48, '#78350f');
  drawPixelRect(ctx, hallLeft, floorY + 8, hallW, 32, '#991b1b');
  drawPixelRect(ctx, hallLeft, floorY + 8, hallW, 4, '#eab308');
  drawPixelRect(ctx, hallLeft, floorY + 36, hallW, 4, '#eab308');

  if (floor === 1) {
    // --- FLOOR 1 LEFT: MAIN ENTRANCE/EXIT DOOR (x = 140, height = 116px) ---
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

    // --- FLOOR 1 RECEPTION DESK & 2 RECEPTIONISTS (x = 240..440) ---
    const counterX = 240;
    const counterW = 200;
    const counterTopY = floorY - 56;

    // Back office key-rack board behind receptionists
    drawPixelRect(ctx, counterX + 12, hallTop + 72, counterW - 24, 72, '#451a03');
    drawPixelRect(ctx, counterX + 16, hallTop + 76, counterW - 32, 64, '#5c2d10');
    for (let kx = counterX + 28; kx < counterX + counterW - 24; kx += 24) {
      drawPixelRect(ctx, kx, hallTop + 90, 6, 10, '#fde047');
      drawPixelRect(ctx, kx, hallTop + 114, 6, 10, '#fde047');
    }

    // Draw the 2 Receptionists behind the counter (x = 290 and x = 390)
    draw8BitReceptionist(ctx, HOTEL_RECEPTIONISTS[0].x, counterTopY, 1);
    draw8BitReceptionist(ctx, HOTEL_RECEPTIONISTS[1].x, counterTopY, 2);

    // Polished wood & brass reception counter in front of receptionists
    drawPixelRect(ctx, counterX - 4, counterTopY, counterW + 8, 8, '#eab308');
    drawPixelRect(ctx, counterX, counterTopY + 8, counterW, 48, '#5c2d10');
    drawPixelRect(ctx, counterX + 8, counterTopY + 14, counterW - 16, 36, '#78350f');
    drawPixelRect(ctx, counterX + 94, counterTopY - 6, 12, 6, '#fde047');
  }

  // --- NUMBERED HOTEL ROOM DOORS (101-104, 201-204, 301-304) ---
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

  // --- 2 CHARACTERISTIC METALLIC ELEVATORS AT THE FAR RIGHT END ---
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

  // Floor 2 Flicker Event: 4 flickers in 1s, showing Black Bonnie on #2 ('far') and #4 ('closer')
  if (floor === 2 && f2State && f2State.showBlackBonnie) {
    const bonnieX = f2State.distanceStage === 'far' ? 1040 : 1240;
    drawHallwayBlackSilhouetteBonnie(ctx, bonnieX, floorY + 8, 0);
  }

  // Floor 3 Flicker Event: 7 fast flickers approaching on #3 ('far'), #5 ('mid'), #7 ('close') + slow hand reach!
  if (floor === 3 && f3State && f3State.showBlackBonnie) {
    const bonnieX =
      f3State.distanceStage === 'far'
        ? 1040
        : f3State.distanceStage === 'mid'
        ? 1230
        : 1412;
    drawHallwayBlackSilhouetteBonnie(ctx, bonnieX, floorY + 8, f3State.handReachProgress);
  }

  // Draw Protagonist (96px tall) — with 1.5s thinking pose & thought bubble right after the rabbit vanishes on Floor 3!
  draw8BitProtagonist(
    ctx,
    playerX,
    floorY + 8,
    playerFacing,
    walkCycle,
    isWalking,
    isThinkingOnFloor3,
    timeSec
  );

  if (isThinkingOnFloor3) {
    const bubbleX = playerX - 26;
    const bubbleY = floorY - 126;
    drawPixelRect(ctx, bubbleX - 2, bubbleY - 2, 52, 24, '#09090b');
    drawPixelRect(ctx, bubbleX, bubbleY, 48, 20, '#ffffff');
    drawPixelRect(ctx, playerX - 4, bubbleY + 22, 8, 6, '#ffffff');
    const dotCount = (Math.floor(timeSec * 4) % 3) + 1;
    for (let d = 0; d < dotCount; d++) {
      drawPixelRect(ctx, bubbleX + 10 + d * 12, bubbleY + 8, 6, 6, '#09090b');
    }
  }

  // Hallway Ceiling Lamps & Warm Lighting along the entire long corridor
  const lampPositions = [260, 560, 860, 1160, 1460];
  for (const lx of lampPositions) {
    drawPixelRect(ctx, lx - 16, hallTop, 32, 10, '#ca8a04');
    drawPixelRect(
      ctx,
      lx - 12,
      hallTop + 10,
      24,
      6,
      hallwayLightOn ? '#fef08a' : '#3f3f46'
    );
  }

  if (!hallwayLightOn) {
    ctx.fillStyle = 'rgba(2, 4, 10, 0.88)';
    ctx.fillRect(hallLeft, hallTop, hallW, hallH + 48);
  } else {
    ctx.fillStyle = 'rgba(254, 240, 138, 0.10)';
    ctx.fillRect(hallLeft, hallTop + 16, hallW, hallH);
  }

  ctx.restore();

  // Screen-anchored Floor indicator plaque on upper left (100% identical to Night 2->3)
  drawPixelRect(ctx, 76, hallTop + 18, 116, 28, '#1e1b4b');
  drawPixelRect(ctx, 80, hallTop + 22, 108, 20, '#271509');
  ctx.fillStyle = '#fde047';
  ctx.font = 'bold 13px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`PLANTA ${floor}`, 134, hallTop + 37);
}

function drawHotelRoomSceneShared(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  timeSec: number,
  currentPhase: PostNight3MinigamePhase,
  phaseTimerSec: number,
  playerX: number,
  playerFacing: -1 | 1,
  walkCycle: number,
  isWalking: boolean,
  ceilingLightOn: boolean,
  phoneRinging: boolean
) {
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

  // Window at top-right (daytime sky before sleeping; night sky after waking for the night shift!)
  const isNightTimeInRoom =
    currentPhase === 'HOTEL_ROOM_SLEEP_ANIMATION' ||
    currentPhase === 'HOTEL_ROOM_WAKE_ANIMATION' ||
    currentPhase === 'HOTEL_ROOM_NIGHT_EXIT_WALK' ||
    currentPhase === 'HOTEL_EXIT_TO_FACILITY_FADE_OUT';
  const winX = 636;
  const winY = 86;
  const winW = 128;
  const winH = 92;
  drawPixelRect(ctx, winX - 8, winY - 8, winW + 16, winH + 16, '#ffffff');
  drawPixelRect(ctx, winX - 12, winY + winH + 4, winW + 24, 8, '#eab308');
  if (isNightTimeInRoom) {
    drawPixelRect(ctx, winX, winY, winW, winH, '#090d16');
    drawPixelRect(ctx, winX + 24, winY + 18, 12, 12, '#f8fafc');
    drawPixelRect(ctx, winX + 92, winY + 26, 4, 4, '#cbd5e1');
  } else {
    drawPixelRect(ctx, winX, winY, winW, winH, '#38bdf8');
    drawPixelRect(ctx, winX + 20, winY + 16, 16, 16, '#fde047');
    drawPixelRect(ctx, winX + 76, winY + 22, 32, 10, '#f8fafc');
  }
  drawPixelRect(ctx, winX + 62, winY, 4, winH, '#f8fafc');
  drawPixelRect(ctx, winX, winY + 44, winW, 4, '#f8fafc');
  drawPixelRect(ctx, winX - 16, winY - 12, winW + 32, 6, '#ca8a04');
  drawPixelRect(ctx, winX - 14, winY - 6, 14, winH + 10, '#facc15');
  drawPixelRect(ctx, winX + winW, winY - 6, 14, winH + 10, '#facc15');

  // Door in the middle (x = 446..514, identical to Night 2->3)
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

  // Wall light switch next to the door (HOTEL_LIGHT_SWITCH_X = 538)
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

  const phoneShake = phoneRinging ? (Math.floor(timeSec * 20) % 2 === 0 ? -2 : 2) : 0;
  drawPixelRect(ctx, HOTEL_PHONE_X - 16 + phoneShake, deskTopY - 14, 32, 14, '#dc2626');
  drawPixelRect(ctx, HOTEL_PHONE_X - 20 + phoneShake, deskTopY - 22, 40, 8, '#ef4444');
  if (phoneRinging) {
    drawPixelRect(ctx, HOTEL_PHONE_X - 24, deskTopY - 44, 48, 16, '#18181b');
    drawPixelRect(ctx, HOTEL_PHONE_X - 22, deskTopY - 42, 44, 12, '#7f1d1d');
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 10px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('RING!', HOTEL_PHONE_X, deskTopY - 33);
  }

  // Protagonist rendering (getting into bed / waking up / walking)
  if (currentPhase === 'HOTEL_ROOM_SLEEP_ANIMATION') {
    if (phaseTimerSec < 0.9) {
      drawPixelRect(ctx, bedX + 36, floorY - 70, 24, 26, '#1e3a8a');
      drawPixelRect(ctx, bedX + 38, floorY - 90, 20, 20, '#fcd34d');
      drawPixelRect(ctx, bedX + 36, floorY - 94, 24, 8, '#451a03');
      drawPixelRect(ctx, bedX + 44, floorY - 82, 4, 4, '#09090b');
    } else {
      drawPixelRect(ctx, bedX + 24, floorY - 58, 20, 16, '#fcd34d');
      drawPixelRect(ctx, bedX + 22, floorY - 62, 16, 6, '#451a03');
      drawPixelRect(ctx, bedX + 44, floorY - 50, 56, 14, '#eab308');
      drawPixelRect(ctx, bedX + 34, floorY - 50, 6, 2, '#09090b');
    }
  } else if (currentPhase === 'HOTEL_ROOM_WAKE_ANIMATION') {
    if (phaseTimerSec < 0.8) {
      drawPixelRect(ctx, bedX + 24, floorY - 58, 20, 16, '#fcd34d');
      drawPixelRect(ctx, bedX + 22, floorY - 62, 16, 6, '#451a03');
      drawPixelRect(ctx, bedX + 44, floorY - 50, 56, 14, '#eab308');
    } else if (phaseTimerSec < 1.6) {
      drawPixelRect(ctx, bedX + 36, floorY - 70, 24, 26, '#1e3a8a');
      drawPixelRect(ctx, bedX + 38, floorY - 90, 20, 20, '#fcd34d');
      drawPixelRect(ctx, bedX + 36, floorY - 94, 24, 8, '#451a03');
      drawPixelRect(ctx, bedX + 52, floorY - 82, 4, 4, '#09090b');
    } else {
      const standProgress = Math.min(1, (phaseTimerSec - 1.6) / 0.8);
      const standX = bedX + 64 + standProgress * (HOTEL_BED_STAND_X - (bedX + 64));
      draw8BitProtagonist(ctx, standX, floorY + 8, 1, standProgress * 2, true, false, timeSec);
    }
  } else {
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
  }

  // Room lighting (warm cone when on, bedside lamp always on)
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
}

// ============================================================================
// SCENE 5: NIGHT RETURN TO THE AUTHENTIC RUINED WOODEN FACILITY FOR NIGHT 4
// ============================================================================

function drawFacilityNightExteriorSceneShared(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  timeSec: number,
  playerX: number,
  playerFacing: -1 | 1,
  walkCycle: number,
  isWalking: boolean
) {
  ctx.fillStyle = '#04070d';
  ctx.fillRect(0, 0, W, H);

  const groundY = 368;
  drawPixelRect(ctx, 120, 48, 8, 8, '#94a3b8');
  drawPixelRect(ctx, 310, 72, 4, 4, '#64748b');
  drawPixelRect(ctx, 520, 40, 8, 8, '#94a3b8');

  for (let tx = 40; tx < 640; tx += 76) {
    draw8BitPineTree(ctx, tx, groundY, 1.2);
  }

  drawPixelRect(ctx, 0, groundY, W, H - groundY, '#09140e');
  drawPixelRect(ctx, 0, groundY, 740, 36, '#1c1917');
  drawPixelRect(ctx, 40, groundY + 8, 680, 20, '#292524');

  drawRuinedWoodenBuilding(ctx, groundY);

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
}
