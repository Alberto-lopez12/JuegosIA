import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FLOOR_3_FLICKER_TOTAL_COUNT,
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
  INTRO_DOOR_ENTER_X,
  INTRO_DOOR_STOP_X,
  INTRO_OUTSIDE_SPAWN_X,
  INTRO_WALK_SPEED_PX_PER_SEC,
  POST_NIGHT_2_BED_SLEEP_PROMPT,
  POST_NIGHT_2_FACILITY_THINKING_DURATION_SEC,
  POST_NIGHT_2_FLICKER_DIALOGUE,
  POST_NIGHT_2_ROOM_303_DIALOGUE,
  POST_NIGHT_2_SLEEP_FREDDY_LAUGH_TIME_SEC,
  POST_NIGHT_2_WAKE_DIALOGUE,
  POST_NIGHT_2_WRONG_ROOM_DIALOGUE,
  PostNight1DialogueTab,
  PostNight2MinigamePhase,
  getFloor3FlickerState,
  getHotelFloorRooms,
  getHotelHallwayCameraX,
  getNearbyHotelHallwayRoom,
  getNearbyReceptionist,
  isNearElevatorDown,
  isNearElevatorUp,
  isNearHotelBed,
  isNearHotelExteriorDoor,
  isNearHotelHallwayExitDoor,
  isNearHotelLightSwitch,
  isNearHotelRoomCentralDoor,
  stepIntroWalkPosition,
} from '../game/rules';
import { soundController } from '../game/audio';

interface EightBitPostNight2MinigameProps {
  onComplete: () => void;
}

export const EightBitPostNight2Minigame: React.FC<EightBitPostNight2MinigameProps> = ({
  onComplete,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const initialParams = useMemo(() => {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      return {
        phaseParam: sp.get('postnight2_phase') as PostNight2MinigamePhase | null,
        floorParam: Number(sp.get('hotel_floor')),
        pxParam: Number(sp.get('player_x')),
        wokenParam: sp.get('woken') === '1',
      };
    }
    return { phaseParam: null, floorParam: NaN, pxParam: NaN, wokenParam: false };
  }, []);

  const [phase, setPhase] = useState<PostNight2MinigamePhase>(() => {
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
      initialParams.phaseParam === 'FLOOR_3_FLICKER_EVENT' ||
      initialParams.phaseParam === 'FLOOR_3_POST_FLICKER_DIALOGUE' ||
      initialParams.phaseParam === 'FLOOR_3_ROOM_303_STOP_DIALOGUE'
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
      phase === 'FLOOR_3_FLICKER_EVENT' ||
      phase === 'FLOOR_3_POST_FLICKER_DIALOGUE'
    ) {
      return 1480;
    }
    if (phase === 'FLOOR_3_ROOM_303_STOP_DIALOGUE') {
      return HOTEL_PLAYER_ROOM_303_X;
    }
    if (phase === 'HOTEL_ROOM_FREE_ROAM') {
      return HOTEL_CENTRAL_DOOR_X;
    }
    if (
      phase === 'HOTEL_ROOM_BED_PROMPT' ||
      phase === 'HOTEL_ROOM_WAKE_DIALOGUE' ||
      phase === 'HOTEL_ROOM_NIGHT_EXIT_WALK'
    ) {
      return HOTEL_BED_STAND_X;
    }
    if (phase === 'FACILITY_EXTERIOR_WALK') {
      return INTRO_OUTSIDE_SPAWN_X;
    }
    if (phase === 'FACILITY_EXTERIOR_THINKING') {
      return INTRO_DOOR_STOP_X;
    }
    return HOTEL_EXTERIOR_SPAWN_X;
  }, []);

  const [roomLightOn, setRoomLightOn] = useState<boolean>(() => !initialParams.wokenParam);
  const [hasWokenForNightShift, setHasWokenForNightShift] = useState<boolean>(
    () =>
      initialParams.wokenParam ||
      phase === 'HOTEL_ROOM_WAKE_ANIMATION' ||
      phase === 'HOTEL_ROOM_WAKE_DIALOGUE' ||
      phase === 'HOTEL_ROOM_NIGHT_EXIT_WALK'
  );
  const [activeReceptionistId, setActiveReceptionistId] = useState<number>(1);
  const [selectedChoice, setSelectedChoice] = useState<'SI' | 'NO'>('SI');
  const [typedChars, setTypedChars] = useState<number>(0);
  const [trembleTick, setTrembleTick] = useState<number>(0);

  // Camera scroll X & proximity states for [E] popovers
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
  const [nearRoomCentralDoor, setNearRoomCentralDoor] = useState<boolean>(() =>
    isNearHotelRoomCentralDoor(initialPlayerX)
  );

  const phaseRef = useRef<PostNight2MinigamePhase>(phase);
  phaseRef.current = phase;

  const currentFloorRef = useRef<1 | 2 | 3>(currentFloor);
  currentFloorRef.current = currentFloor;

  const roomLightOnRef = useRef<boolean>(roomLightOn);
  roomLightOnRef.current = roomLightOn;

  const hasWokenRef = useRef<boolean>(hasWokenForNightShift);
  hasWokenRef.current = hasWokenForNightShift;

  const typedCharsRef = useRef<number>(typedChars);
  typedCharsRef.current = typedChars;

  const simRef = useRef({
    fadeAlpha: 0,
    playerX: initialPlayerX,
    playerFacing: (
      phase === 'FLOOR_3_FLICKER_EVENT' || phase === 'FLOOR_3_POST_FLICKER_DIALOGUE'
        ? -1
        : 1
    ) as -1 | 1,
    walkCycle: 0,
    elevatorTargetFloor: 1 as 1 | 2 | 3,
    elevatorFadeStage: 'FADE_OUT' as 'FADE_OUT' | 'FADE_IN',
    floor3FlickerTriggered:
      phase === 'FLOOR_3_POST_FLICKER_DIALOGUE' ||
      phase === 'FLOOR_3_ROOM_303_STOP_DIALOGUE' ||
      initialParams.wokenParam,
    floor3Room303StopTriggered:
      phase === 'FLOOR_3_ROOM_303_STOP_DIALOGUE' || initialParams.wokenParam,
    flickerElapsedSec: 0,
    turnOffLightStage: 'TO_SWITCH' as 'TO_SWITCH' | 'AT_SWITCH_PAUSE' | 'BACK_TO_BED',
    switchPauseSec: 0,
    sleepElapsedSec: 0,
    freddyLaughPlayed: false,
    wakeElapsedSec: 0,
    thinkingElapsedSec: 0,
    keysHeld: {
      left: false,
      right: false,
    },
  });

  // Ensure rain audio and any lingering office footsteps are strictly OFF during the entire Night 3 minigame
  useEffect(() => {
    soundController.stopAll(false, false);
    soundController.stopRainLoop();
    return () => {
      soundController.stopRainLoop();
    };
  }, []);

  // Determine active dialogue tab
  const activeTab: PostNight1DialogueTab | null = useMemo(() => {
    if (phase === 'HOTEL_RECEPTIONIST_DIALOGUE') {
      const rec =
        HOTEL_RECEPTIONISTS.find((r) => r.id === activeReceptionistId) ||
        HOTEL_RECEPTIONISTS[0];
      return {
        speaker: `RECEPCIONISTA ${rec.id}`,
        speakerColor: '#38bdf8',
        segments: [{ text: rec.dialogueText }],
      };
    }
    if (phase === 'HOTEL_WRONG_ROOM_DIALOGUE') {
      return POST_NIGHT_2_WRONG_ROOM_DIALOGUE;
    }
    if (phase === 'FLOOR_3_POST_FLICKER_DIALOGUE') {
      return POST_NIGHT_2_FLICKER_DIALOGUE;
    }
    if (phase === 'FLOOR_3_ROOM_303_STOP_DIALOGUE') {
      return POST_NIGHT_2_ROOM_303_DIALOGUE;
    }
    if (phase === 'HOTEL_ROOM_BED_PROMPT') {
      return POST_NIGHT_2_BED_SLEEP_PROMPT;
    }
    if (phase === 'HOTEL_ROOM_WAKE_DIALOGUE') {
      return POST_NIGHT_2_WAKE_DIALOGUE;
    }
    return null;
  }, [phase, activeReceptionistId]);

  const fullDialogueText = useMemo(() => {
    if (!activeTab) return '';
    return activeTab.segments.map((s) => s.text).join('');
  }, [activeTab]);

  // Typewriter effect for dialogues
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

    setTypedChars(0);
    typedCharsRef.current = 0;

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

      const nextChar = fullDialogueText[current] ?? ' ';
      if (nextChar.trim().length > 0 && next % 3 === 1) {
        soundController.playCameraBlip();
      }

      const isSlow = current >= slowStartIdx;
      timerId = window.setTimeout(stepTypewriter, isSlow ? 95 : 22);
    };

    timerId = window.setTimeout(stepTypewriter, 25);
    return () => {
      cancelled = true;
      if (timerId !== null) window.clearTimeout(timerId);
    };
  }, [activeTab, fullDialogueText]);

  // Tremble animation ticker for "ESO"
  useEffect(() => {
    if (!activeTab) return;
    const id = window.setInterval(() => {
      setTrembleTick((t) => (t + 1) % 1000);
    }, 55);
    return () => window.clearInterval(id);
  }, [activeTab]);

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
    setNearHallwayExitDoor(floor === 1 && hasWokenRef.current && isNearHotelHallwayExitDoor(px));
  }, []);

  const syncRoomProximities = useCallback((px: number) => {
    setNearLightSwitch(isNearHotelLightSwitch(px));
    setNearBed(isNearHotelBed(px));
    setNearRoomCentralDoor(isNearHotelRoomCentralDoor(px));
  }, []);

  // Interaction actions ([E])
  const handleEnterHotelFromOutside = useCallback(() => {
    if (phaseRef.current !== 'HOTEL_EXTERIOR_WALK') return;
    if (!isNearHotelExteriorDoor(simRef.current.playerX)) return;
    soundController.playDoorSlam(true);
    simRef.current.keysHeld.left = false;
    simRef.current.keysHeld.right = false;
    simRef.current.fadeAlpha = 0;
    setPhase('HOTEL_EXTERIOR_ENTERING_FADE');
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
    setPhase('HOTEL_RECEPTIONIST_DIALOGUE');
  }, []);

  // Going UP in the right elevator triggers a fade-to-black transition ("cada vez que subas de piso, tiene que haber un fundido a negro")
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
    setPhase('HOTEL_ELEVATOR_FADE');
  }, []);

  // Going DOWN in the left elevator also triggers a fade-to-black transition ("lo mismo para bajar")
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
    setPhase('HOTEL_ELEVATOR_FADE');
  }, []);

  const handleEnterRoom303 = useCallback(() => {
    if (phaseRef.current !== 'HOTEL_HALLWAY' || currentFloorRef.current !== 3) return;
    if (hasWokenRef.current) return;
    const room = getNearbyHotelHallwayRoom(3, simRef.current.playerX);
    if (!room || !room.isPlayerRoom) return;
    soundController.playDoorSlam(true);
    simRef.current.keysHeld.left = false;
    simRef.current.keysHeld.right = false;
    simRef.current.playerX = HOTEL_CENTRAL_DOOR_X;
    simRef.current.playerFacing = -1;
    syncRoomProximities(HOTEL_CENTRAL_DOOR_X);
    setPhase('HOTEL_ROOM_FREE_ROAM');
  }, [syncRoomProximities]);

  // Trying to open any non-player hotel room door ("la llave no funciona, esta no es mi habitacion")
  const handleTryWrongRoomDoor = useCallback(() => {
    if (phaseRef.current !== 'HOTEL_HALLWAY') return;
    const room = getNearbyHotelHallwayRoom(currentFloorRef.current, simRef.current.playerX);
    if (!room || room.isPlayerRoom) return;
    soundController.playLockedDoorRattle();
    simRef.current.keysHeld.left = false;
    simRef.current.keysHeld.right = false;
    setPhase('HOTEL_WRONG_ROOM_DIALOGUE');
  }, []);

  const handleToggleRoomLight = useCallback(() => {
    if (
      phaseRef.current !== 'HOTEL_ROOM_FREE_ROAM' &&
      phaseRef.current !== 'HOTEL_ROOM_NIGHT_EXIT_WALK'
    ) {
      return;
    }
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
      setPhase('HOTEL_ROOM_TURN_OFF_LIGHTS_WALK');
    } else {
      simRef.current.sleepElapsedSec = 0;
      simRef.current.freddyLaughPlayed = false;
      setPhase('HOTEL_ROOM_SLEEP_ANIMATION');
    }
  }, []);

  const handleChooseSleepNo = useCallback(() => {
    if (phaseRef.current !== 'HOTEL_ROOM_BED_PROMPT') return;
    soundController.playWoodClick();
    setPhase('HOTEL_ROOM_FREE_ROAM');
  }, []);

  const handleExitRoomToHallwayAtNight = useCallback(() => {
    if (phaseRef.current !== 'HOTEL_ROOM_NIGHT_EXIT_WALK') return;
    if (!isNearHotelRoomCentralDoor(simRef.current.playerX)) return;
    soundController.playDoorSlam(true);
    simRef.current.keysHeld.left = false;
    simRef.current.keysHeld.right = false;
    setCurrentFloor(3);
    currentFloorRef.current = 3;
    simRef.current.playerX = HOTEL_PLAYER_ROOM_303_X;
    simRef.current.playerFacing = 1;
    syncHallwayProximities(HOTEL_PLAYER_ROOM_303_X, 3);
    setPhase('HOTEL_HALLWAY');
  }, [syncHallwayProximities]);

  const handleExitHotelToFacility = useCallback(() => {
    if (phaseRef.current !== 'HOTEL_HALLWAY' || currentFloorRef.current !== 1) return;
    if (!hasWokenRef.current || !isNearHotelHallwayExitDoor(simRef.current.playerX)) return;
    soundController.playDoorSlam(true);
    simRef.current.keysHeld.left = false;
    simRef.current.keysHeld.right = false;
    simRef.current.fadeAlpha = 0;
    setPhase('HOTEL_EXIT_TO_FACILITY_FADE_OUT');
  }, []);

  const handleAdvanceDialogue = useCallback(() => {
    const currentPhase = phaseRef.current;
    if (!activeTab) return;

    if (typedCharsRef.current < fullDialogueText.length) {
      typedCharsRef.current = fullDialogueText.length;
      setTypedChars(fullDialogueText.length);
      return;
    }

    soundController.playCameraBlip();

    if (currentPhase === 'HOTEL_RECEPTIONIST_DIALOGUE') {
      setPhase('HOTEL_HALLWAY');
      return;
    }
    if (currentPhase === 'HOTEL_WRONG_ROOM_DIALOGUE') {
      setPhase('HOTEL_HALLWAY');
      return;
    }
    if (currentPhase === 'FLOOR_3_POST_FLICKER_DIALOGUE') {
      setPhase('HOTEL_HALLWAY');
      return;
    }
    if (currentPhase === 'FLOOR_3_ROOM_303_STOP_DIALOGUE') {
      syncHallwayProximities(simRef.current.playerX, 3);
      setPhase('HOTEL_HALLWAY');
      return;
    }
    if (currentPhase === 'HOTEL_ROOM_WAKE_DIALOGUE') {
      syncRoomProximities(simRef.current.playerX);
      setPhase('HOTEL_ROOM_NIGHT_EXIT_WALK');
      return;
    }
  }, [activeTab, fullDialogueText.length, syncHallwayProximities, syncRoomProximities]);

  // Keyboard listener
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const currentPhase = phaseRef.current;

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
          return;
        }
        if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
          e.preventDefault();
          setSelectedChoice('NO');
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          if (selectedChoice === 'SI') {
            handleChooseSleepYes();
          } else {
            handleChooseSleepNo();
          }
          return;
        }
        return;
      }

      if (e.key === 'Enter') {
        if (
          currentPhase === 'HOTEL_RECEPTIONIST_DIALOGUE' ||
          currentPhase === 'HOTEL_WRONG_ROOM_DIALOGUE' ||
          currentPhase === 'FLOOR_3_POST_FLICKER_DIALOGUE' ||
          currentPhase === 'FLOOR_3_ROOM_303_STOP_DIALOGUE' ||
          currentPhase === 'HOTEL_ROOM_WAKE_DIALOGUE'
        ) {
          e.preventDefault();
          handleAdvanceDialogue();
          return;
        }
      }

      if (e.key === 'e' || e.key === 'E') {
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
          if (floor === 1 && hasWokenRef.current && isNearHotelHallwayExitDoor(px)) {
            e.preventDefault();
            handleExitHotelToFacility();
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
            if (room.isPlayerRoom && !hasWokenRef.current) {
              handleEnterRoom303();
            } else if (!room.isPlayerRoom) {
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
        if (currentPhase === 'HOTEL_ROOM_NIGHT_EXIT_WALK') {
          const px = simRef.current.playerX;
          if (isNearHotelRoomCentralDoor(px)) {
            e.preventDefault();
            handleExitRoomToHallwayAtNight();
            return;
          }
          if (isNearHotelLightSwitch(px)) {
            e.preventDefault();
            handleToggleRoomLight();
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
    fullDialogueText.length,
    selectedChoice,
    handleAdvanceDialogue,
    handleChooseSleepNo,
    handleChooseSleepYes,
    handleEnterHotelFromOutside,
    handleEnterRoom303,
    handleExitHotelToFacility,
    handleExitRoomToHallwayAtNight,
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

    // Protagonist scaled to ~96px tall so doors (116px) and rooms match realistic human proportions
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

      // 8-Bit Thought Bubble
      if (isThinking) {
        drawPixelRect(ctx, x - 6, groundY - 108, 6, 6, '#f8fafc');
        drawPixelRect(ctx, x - 14, groundY - 118, 8, 8, '#f8fafc');
        drawPixelRect(ctx, x - 38, groundY - 146, 52, 24, '#f8fafc');
        drawPixelRect(ctx, x - 34, groundY - 142, 44, 16, '#09090b');
        const dots = (Math.floor(timeSec * 6) % 3) + 1;
        for (let d = 0; d < dots; d++) {
          drawPixelRect(ctx, x - 26 + d * 12, groundY - 136, 6, 6, '#fde047');
        }
      }
    };

    // Draws a hotel receptionist NPC standing behind the reception counter (scaled to match protagonist)
    const draw8BitReceptionist = (
      ctx: CanvasRenderingContext2D,
      x: number,
      counterTopY: number,
      variant: 1 | 2
    ) => {
      // Uniform torso (burgundy hotel vest & white shirt)
      drawPixelRect(ctx, x - 14, counterTopY - 36, 28, 36, variant === 1 ? '#7f1d1d' : '#1e3a8a');
      drawPixelRect(ctx, x - 4, counterTopY - 34, 8, 28, '#f8fafc');
      drawPixelRect(ctx, x - 2, counterTopY - 30, 4, 16, '#eab308'); // Tie / badge
      // Head
      drawPixelRect(ctx, x - 12, counterTopY - 60, 24, 24, variant === 1 ? '#fde68a' : '#fed7aa');
      // Hair / Hotel Bellhop Cap
      drawPixelRect(ctx, x - 14, counterTopY - 66, 28, 8, variant === 1 ? '#991b1b' : '#271509');
      drawPixelRect(ctx, x - 10, counterTopY - 62, 20, 4, '#eab308');
      // Eyes
      drawPixelRect(ctx, x - 6, counterTopY - 50, 4, 4, '#09090b');
      drawPixelRect(ctx, x + 2, counterTopY - 50, 4, 4, '#09090b');
    };

    // Draws the black silhouette rabbit (Bonnie) that attacked the player in the car,
    // appearing in the 3rd-floor hallway during flickers 2 and 4!
    const drawHallwayBlackSilhouetteBonnie = (
      ctx: CanvasRenderingContext2D,
      x: number,
      floorY: number
    ) => {
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

      // White glowing pinprick eyes staring toward the player on the right
      drawPixelRect(ctx, x - 4, floorY - 84, 4, 4, '#ffffff');
      drawPixelRect(ctx, x + 8, floorY - 84, 4, 4, '#ffffff');

      // Torso & legs
      drawPixelRect(ctx, x - 22, floorY - 64, 44, 40, '#020204');
      drawPixelRect(ctx, x - 28, floorY - 60, 8, 32, '#09090b');
      drawPixelRect(ctx, x + 20, floorY - 60, 8, 32, '#09090b');
      drawPixelRect(ctx, x - 16, floorY - 24, 12, 24, '#020204');
      drawPixelRect(ctx, x + 4, floorY - 24, 12, 24, '#020204');
    };

    // Grand, realistic 3-story hotel exterior facade ("el hotel por fuera hazlo como mas grande representando lo de los 3 pisos de manera mas realista")
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
      // Clear dawn/night sky (NO RAIN)
      ctx.fillStyle = '#070b16';
      ctx.fillRect(0, 0, W, H);

      // Stars
      drawPixelRect(ctx, 40, 24, 4, 4, '#cbd5e1');
      drawPixelRect(ctx, 910, 32, 4, 4, '#e2e8f0');

      const groundY = 424;

      // Side trees flanking the grand hotel wings
      draw8BitPineTree(ctx, 36, groundY, 1.25);
      draw8BitPineTree(ctx, 924, groundY, 1.25);

      // Street & sidewalk
      drawPixelRect(ctx, 0, groundY, W, H - groundY, '#111827');
      drawPixelRect(ctx, 0, groundY, W, 28, '#334155');
      drawPixelRect(ctx, 0, groundY + 24, W, 4, '#64748b');

      // Grand 3-Story Hotel Building Facade (x = 72..888, width = 816px, height = 378px -> 3 stories of 126px each!)
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

      // Grand Illuminated "GRAND HOTEL" Rooftop Sign
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
          drawPixelRect(ctx, wx, wy, 44, 68, isLit ? '#fef08a' : '#1e293b');
          drawPixelRect(ctx, wx + 20, wy, 4, 68, '#78350f');
          drawPixelRect(ctx, wx, wy + 32, 44, 4, '#78350f');
          // Decorative balcony rail under each window
          drawPixelRect(ctx, wx - 8, wy + 68, 60, 6, '#ca8a04');
        }
      }

      // Center Suite Windows on Planta 3 and Planta 2 (above the main entrance lobby)
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

      // Grand Hotel Entrance Double Doors on Planta 1 (HOTEL_EXTERIOR_DOOR_X = 480, height = 116px to match 96px protagonist!)
      const doorW = 92;
      const doorH = 116;
      const doorX = HOTEL_EXTERIOR_DOOR_X - doorW / 2;
      const doorY = groundY - doorH;
      // Red & gold hotel marquee canopy awning
      drawPixelRect(ctx, doorX - 28, doorY - 24, doorW + 56, 20, '#991b1b');
      drawPixelRect(ctx, doorX - 24, doorY - 8, doorW + 48, 6, '#eab308');
      // Brass & glass double entrance doors
      drawPixelRect(ctx, doorX - 6, doorY - 4, doorW + 12, doorH + 4, '#ca8a04');
      drawPixelRect(ctx, doorX, doorY, doorW, doorH, '#451a03');
      drawPixelRect(ctx, doorX + 8, doorY + 10, 32, doorH - 20, '#fef08a');
      drawPixelRect(ctx, doorX + 52, doorY + 10, 32, doorH - 20, '#fef08a');
      drawPixelRect(ctx, doorX + 44, doorY, 4, doorH, '#ca8a04');
      // Brass door handles at waist/hand height
      drawPixelRect(ctx, doorX + 36, doorY + 60, 6, 10, '#fde047');
      drawPixelRect(ctx, doorX + 50, doorY + 60, 6, 10, '#fde047');

      // Warm entrance lantern glow on sidewalk
      ctx.fillStyle = 'rgba(254, 240, 138, 0.20)';
      ctx.fillRect(doorX - 20, groundY, doorW + 40, 22);

      // Protagonist outside hotel (96px tall vs 116px entrance doors)
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

    const drawHotelHallwayScene = (
      ctx: CanvasRenderingContext2D,
      W: number,
      H: number,
      timeSec: number,
      floor: 1 | 2 | 3,
      playerX: number,
      playerFacing: -1 | 1,
      walkCycle: number,
      isWalking: boolean,
      hallwayLightOn: boolean,
      showBlackBonnie: boolean
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

      // Outer golden-ivory frame along the long corridor
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
        // Golden reception bell on counter
        drawPixelRect(ctx, counterX + 94, counterTopY - 6, 12, 6, '#fde047');
      }

      // --- NUMBERED HOTEL ROOM DOORS (101-104, 201-204, 301-304; height = 116px to match 96px protagonist!) ---
      const rooms = getHotelFloorRooms(floor);
      for (const room of rooms) {
        const dw = 68;
        const dh = 116;
        const dx = room.x - dw / 2;
        const dy = floorY - dh;

        // Door frame
        drawPixelRect(ctx, dx - 6, dy - 6, dw + 12, dh + 6, '#ffffff');
        drawPixelRect(ctx, dx - 4, dy - 4, dw + 8, dh + 4, '#eab308');
        // Door body
        drawPixelRect(ctx, dx, dy, dw, dh, '#78350f');
        drawPixelRect(ctx, dx + 6, dy + 6, dw - 12, dh - 12, '#92400e');
        drawPixelRect(ctx, dx + 12, dy + 12, dw - 24, 38, '#5c2d10');
        drawPixelRect(ctx, dx + 12, dy + 60, dw - 24, 42, '#5c2d10');
        // Brass doorknob at natural waist/hand height
        drawPixelRect(ctx, dx + dw - 14, dy + 56, 6, 6, '#fde047');

        // Number plaque above the door with standard hotel nomenclature (101..304)
        drawPixelRect(ctx, room.x - 20, dy - 26, 40, 18, '#18181b');
        drawPixelRect(ctx, room.x - 18, dy - 24, 36, 14, '#27272a');
        ctx.fillStyle = '#fde047';
        ctx.font = 'bold 11px "IBM Plex Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(room.roomNumber, room.x, dy - 13);
      }

      // --- 2 CHARACTERISTIC METALLIC ELEVATORS AT THE FAR RIGHT END OF THE LONG HALLWAY ---
      // Left Elevator (HOTEL_ELEVATOR_DOWN_X = 1510 -> BAJAR) & Right Elevator (HOTEL_ELEVATOR_UP_X = 1610 -> SUBIR)
      const elevators = [
        { x: HOTEL_ELEVATOR_DOWN_X, arrow: '▼', label: 'BAJAR' },
        { x: HOTEL_ELEVATOR_UP_X, arrow: '▲', label: 'SUBIR' },
      ];

      for (const elev of elevators) {
        const ew = 64;
        const eh = 122;
        const ex = elev.x - ew / 2;
        const ey = floorY - eh;

        // Brushed dark steel outer frame
        drawPixelRect(ctx, ex - 6, ey - 8, ew + 12, eh + 8, '#475569');
        drawPixelRect(ctx, ex - 4, ey - 4, ew + 8, eh + 4, '#94a3b8');

        // Characteristic metallic silver/steel double elevator doors (#cbd5e1 / #94a3b8)
        drawPixelRect(ctx, ex, ey, ew, eh, '#cbd5e1');
        drawPixelRect(ctx, ex + 4, ey + 4, ew / 2 - 6, eh - 8, '#94a3b8');
        drawPixelRect(ctx, ex + ew / 2 + 2, ey + 4, ew / 2 - 6, eh - 8, '#94a3b8');
        // Metallic sheen stripes
        drawPixelRect(ctx, ex + 8, ey + 10, 6, eh - 20, '#e2e8f0');
        drawPixelRect(ctx, ex + ew / 2 + 6, ey + 10, 6, eh - 20, '#e2e8f0');
        // Center door seam
        drawPixelRect(ctx, elev.x - 2, ey, 4, eh, '#334155');

        // Digital floor & arrow indicator panel above elevator
        drawPixelRect(ctx, elev.x - 22, ey - 28, 44, 18, '#09090b');
        drawPixelRect(ctx, elev.x - 20, ey - 26, 40, 14, '#1e293b');
        ctx.fillStyle = elev.arrow === '▼' ? '#38bdf8' : '#4ade80';
        ctx.font = 'bold 11px "IBM Plex Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${elev.arrow} P${floor}`, elev.x, dyIndicatorY(ey));
      }

      // If on Floor 3 during flicker #2 or #4, draw the Black Silhouette Rabbit (Bonnie) in the hallway!
      if (floor === 3 && showBlackBonnie) {
        drawHallwayBlackSilhouetteBonnie(ctx, 1180, floorY + 8);
      }

      // Draw Protagonist (96px tall)
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
        // Dark blackout during hallway flicker off-phase
        ctx.fillStyle = 'rgba(2, 4, 10, 0.88)';
        ctx.fillRect(hallLeft, hallTop, hallW, hallH + 48);
      } else {
        // Warm hallway lighting glow
        ctx.fillStyle = 'rgba(254, 240, 138, 0.10)';
        ctx.fillRect(hallLeft, hallTop + 16, hallW, hallH);
      }

      ctx.restore();

      // Screen-anchored Floor indicator plaque on upper left
      drawPixelRect(ctx, 76, hallTop + 18, 116, 28, '#1e1b4b');
      drawPixelRect(ctx, 80, hallTop + 22, 108, 20, '#271509');
      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 13px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`PLANTA ${floor}`, 134, hallTop + 37);
    };

    function dyIndicatorY(ey: number): number {
      return ey - 15;
    }

    const drawHotelRoomScene = (
      ctx: CanvasRenderingContext2D,
      W: number,
      H: number,
      timeSec: number,
      currentPhase: PostNight2MinigamePhase,
      sleepElapsed: number,
      wakeElapsed: number,
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

      // Door in the middle (scaled proportionally to the 96px protagonist: 68x116, centered at x = 480)
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

      // Wall light switch next to the door (at shoulder/chest height, HOTEL_LIGHT_SWITCH_X = 538)
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

      // --- PROTAGONIST RENDERING (GETTING INTO BED / WAKING UP / WALKING) ---
      if (currentPhase === 'HOTEL_ROOM_SLEEP_ANIMATION') {
        if (sleepElapsed < 0.9) {
          drawPixelRect(ctx, bedX + 36, floorY - 70, 24, 26, '#1e3a8a');
          drawPixelRect(ctx, bedX + 38, floorY - 90, 20, 20, '#fcd34d');
          drawPixelRect(ctx, bedX + 36, floorY - 94, 24, 8, '#451a03');
          drawPixelRect(ctx, bedX + 44, floorY - 82, 4, 4, '#09090b');
        } else {
          drawPixelRect(ctx, bedX + 24, floorY - 58, 20, 16, '#fcd34d');
          drawPixelRect(ctx, bedX + 22, floorY - 62, 16, 6, '#451a03');
          drawPixelRect(ctx, bedX + 44, floorY - 50, 56, 14, '#eab308');

          if (sleepElapsed < 1.7) {
            drawPixelRect(ctx, bedX + 34, floorY - 52, 4, 4, '#09090b');
          } else if (sleepElapsed < 2.4) {
            drawPixelRect(ctx, bedX + 34, floorY - 50, 6, 2, '#09090b');
          } else {
            drawPixelRect(ctx, bedX + 34, floorY - 50, 6, 2, '#92400e');
          }
        }
      } else if (currentPhase === 'HOTEL_ROOM_WAKE_ANIMATION') {
        if (wakeElapsed < 0.9) {
          drawPixelRect(ctx, bedX + 24, floorY - 58, 20, 16, '#fcd34d');
          drawPixelRect(ctx, bedX + 22, floorY - 62, 16, 6, '#451a03');
          drawPixelRect(ctx, bedX + 44, floorY - 50, 56, 14, '#eab308');
        } else if (wakeElapsed < 1.8) {
          drawPixelRect(ctx, bedX + 36, floorY - 70, 24, 26, '#1e3a8a');
          drawPixelRect(ctx, bedX + 38, floorY - 90, 20, 20, '#fcd34d');
          drawPixelRect(ctx, bedX + 36, floorY - 94, 24, 8, '#451a03');
          drawPixelRect(ctx, bedX + 52, floorY - 82, 4, 4, '#09090b');
        } else {
          const standProgress = Math.min(1, (wakeElapsed - 1.8) / 0.8);
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

      // --- ROOM LIGHTING (WARM CONE WHEN ON, BEDSIDE LAMP ALWAYS ON) ---
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

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const sim = simRef.current;
      const currentPhase = phaseRef.current;

      // 1. Update Simulation per Phase
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
          setPhase('HOTEL_HALLWAY');
        }
      } else if (currentPhase === 'HOTEL_ELEVATOR_FADE') {
        // Fade-to-black when going UP or DOWN between hotel floors ("cada vez que subas de piso, tiene que haber un fundido a negro (lo mismo para bajar)")
        if (sim.elevatorFadeStage === 'FADE_OUT') {
          sim.fadeAlpha = Math.min(1, sim.fadeAlpha + dt * 2.2);
          if (sim.fadeAlpha >= 1) {
            const nextFloor = sim.elevatorTargetFloor;
            setCurrentFloor(nextFloor);
            currentFloorRef.current = nextFloor;

            if (nextFloor === 3 && !sim.floor3FlickerTriggered) {
              sim.playerX = 1480;
              sim.playerFacing = -1;
            }
            syncHallwayProximities(sim.playerX, nextFloor);
            sim.elevatorFadeStage = 'FADE_IN';
          }
        } else {
          sim.fadeAlpha = Math.max(0, sim.fadeAlpha - dt * 2.2);
          if (sim.fadeAlpha <= 0) {
            sim.fadeAlpha = 0;
            if (currentFloorRef.current === 3 && !sim.floor3FlickerTriggered) {
              sim.floor3FlickerTriggered = true;
              sim.flickerElapsedSec = 0;
              setPhase('FLOOR_3_FLICKER_EVENT');
            } else {
              setPhase('HOTEL_HALLWAY');
            }
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
          // Slightly faster walk speed in the long hallway so scrolling feels brisk and responsive
          sim.playerX = Math.max(
            HOTEL_HALLWAY_MIN_X,
            Math.min(
              HOTEL_HALLWAY_MAX_X,
              sim.playerX + moveDir * (INTRO_WALK_SPEED_PX_PER_SEC * 1.45) * dt
            )
          );
          const floor = currentFloorRef.current;
          syncHallwayProximities(sim.playerX, floor);

          // On Floor 3 before sleeping, reaching Room 303 (3rd door from the left, x = 940) automatically stops the player and triggers the room dialogue!
          if (
            floor === 3 &&
            !sim.floor3Room303StopTriggered &&
            Math.abs(sim.playerX - HOTEL_PLAYER_ROOM_303_X) <= 12
          ) {
            sim.floor3Room303StopTriggered = true;
            sim.playerX = HOTEL_PLAYER_ROOM_303_X;
            sim.keysHeld.left = false;
            sim.keysHeld.right = false;
            syncHallwayProximities(HOTEL_PLAYER_ROOM_303_X, 3);
            setPhase('FLOOR_3_ROOM_303_STOP_DIALOGUE');
          }
        }
      } else if (currentPhase === 'FLOOR_3_FLICKER_EVENT') {
        const prevFlicker = getFloor3FlickerState(sim.flickerElapsedSec);
        sim.flickerElapsedSec += dt;
        const nextFlicker = getFloor3FlickerState(sim.flickerElapsedSec);

        if (prevFlicker.lightOn !== nextFlicker.lightOn && !nextFlicker.lightOn) {
          soundController.playCameraBlip();
        }

        if (nextFlicker.completed) {
          setPhase('FLOOR_3_POST_FLICKER_DIALOGUE');
        }
      } else if (
        currentPhase === 'HOTEL_ROOM_FREE_ROAM' ||
        currentPhase === 'HOTEL_ROOM_NIGHT_EXIT_WALK'
      ) {
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
            sim.sleepElapsedSec = 0;
            sim.freddyLaughPlayed = false;
            setPhase('HOTEL_ROOM_SLEEP_ANIMATION');
          } else {
            sim.playerX = nextX;
          }
        }
      } else if (currentPhase === 'HOTEL_ROOM_SLEEP_ANIMATION') {
        sim.sleepElapsedSec += dt;
        if (
          !sim.freddyLaughPlayed &&
          sim.sleepElapsedSec >= POST_NIGHT_2_SLEEP_FREDDY_LAUGH_TIME_SEC
        ) {
          sim.freddyLaughPlayed = true;
          soundController.playFreddyLaugh(0.95);
        }
        if (sim.sleepElapsedSec >= 2.6) {
          sim.fadeAlpha = Math.min(1, (sim.sleepElapsedSec - 2.6) / 1.1);
        }
        if (sim.sleepElapsedSec >= 3.8) {
          sim.wakeElapsedSec = 0;
          setHasWokenForNightShift(true);
          hasWokenRef.current = true;
          setPhase('HOTEL_ROOM_WAKE_ANIMATION');
        }
      } else if (currentPhase === 'HOTEL_ROOM_WAKE_ANIMATION') {
        sim.wakeElapsedSec += dt;
        if (sim.wakeElapsedSec < 0.8) {
          sim.fadeAlpha = Math.max(0, 1 - sim.wakeElapsedSec / 0.8);
        } else {
          sim.fadeAlpha = 0;
        }
        if (sim.wakeElapsedSec >= 2.6) {
          sim.playerX = HOTEL_BED_STAND_X;
          sim.playerFacing = 1;
          syncRoomProximities(HOTEL_BED_STAND_X);
          setPhase('HOTEL_ROOM_WAKE_DIALOGUE');
        }
      } else if (currentPhase === 'HOTEL_EXIT_TO_FACILITY_FADE_OUT') {
        sim.fadeAlpha = Math.min(1, sim.fadeAlpha + dt * 0.95);
        if (sim.fadeAlpha >= 1) {
          sim.playerX = INTRO_OUTSIDE_SPAWN_X;
          sim.playerFacing = 1;
          setPhase('FACILITY_EXTERIOR_FADE_IN');
        }
      } else if (currentPhase === 'FACILITY_EXTERIOR_FADE_IN') {
        sim.fadeAlpha = Math.max(0, sim.fadeAlpha - dt * 0.95);
        if (sim.fadeAlpha <= 0) {
          setPhase('FACILITY_EXTERIOR_WALK');
        }
      } else if (currentPhase === 'FACILITY_EXTERIOR_WALK') {
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
            sim.thinkingElapsedSec = 0;
            setPhase('FACILITY_EXTERIOR_THINKING');
          }
        }
      } else if (currentPhase === 'FACILITY_EXTERIOR_THINKING') {
        sim.thinkingElapsedSec += dt;
        if (sim.thinkingElapsedSec >= POST_NIGHT_2_FACILITY_THINKING_DURATION_SEC) {
          sim.fadeAlpha = 0;
          setPhase('FACILITY_ENTERING_FADE_OUT');
        }
      } else if (currentPhase === 'FACILITY_ENTERING_FADE_OUT') {
        sim.walkCycle += dt;
        sim.playerFacing = 1;
        if (sim.playerX < INTRO_DOOR_ENTER_X) {
          sim.playerX = Math.min(INTRO_DOOR_ENTER_X, sim.playerX + dt * 95);
        }
        sim.fadeAlpha = Math.min(1, sim.fadeAlpha + dt * 0.9);
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
            currentPhase === 'HOTEL_WRONG_ROOM_DIALOGUE' ||
            currentPhase === 'FLOOR_3_FLICKER_EVENT' ||
            currentPhase === 'FLOOR_3_POST_FLICKER_DIALOGUE' ||
            currentPhase === 'FLOOR_3_ROOM_303_STOP_DIALOGUE' ||
            currentPhase === 'HOTEL_EXIT_TO_FACILITY_FADE_OUT'
          ) {
            const isWalking =
              currentPhase === 'HOTEL_HALLWAY' &&
              (sim.keysHeld.left || sim.keysHeld.right);
            const flickerState =
              currentPhase === 'FLOOR_3_FLICKER_EVENT'
                ? getFloor3FlickerState(sim.flickerElapsedSec)
                : {
                    flickerIndex: FLOOR_3_FLICKER_TOTAL_COUNT,
                    lightOn: true,
                    showBlackBonnie: false,
                    completed: true,
                  };
            drawHotelHallwayScene(
              ctx,
              W,
              H,
              timeSec,
              currentFloorRef.current,
              sim.playerX,
              sim.playerFacing,
              sim.walkCycle,
              isWalking,
              flickerState.lightOn,
              flickerState.showBlackBonnie
            );
          } else if (
            currentPhase === 'HOTEL_ROOM_FREE_ROAM' ||
            currentPhase === 'HOTEL_ROOM_BED_PROMPT' ||
            currentPhase === 'HOTEL_ROOM_TURN_OFF_LIGHTS_WALK' ||
            currentPhase === 'HOTEL_ROOM_SLEEP_ANIMATION' ||
            currentPhase === 'HOTEL_ROOM_WAKE_ANIMATION' ||
            currentPhase === 'HOTEL_ROOM_WAKE_DIALOGUE' ||
            currentPhase === 'HOTEL_ROOM_NIGHT_EXIT_WALK'
          ) {
            const isWalking =
              ((currentPhase === 'HOTEL_ROOM_FREE_ROAM' ||
                currentPhase === 'HOTEL_ROOM_NIGHT_EXIT_WALK') &&
                (sim.keysHeld.left || sim.keysHeld.right)) ||
              (currentPhase === 'HOTEL_ROOM_TURN_OFF_LIGHTS_WALK' &&
                sim.turnOffLightStage !== 'AT_SWITCH_PAUSE');
            drawHotelRoomScene(
              ctx,
              W,
              H,
              timeSec,
              currentPhase,
              sim.sleepElapsedSec,
              sim.wakeElapsedSec,
              sim.playerX,
              sim.playerFacing,
              sim.walkCycle,
              isWalking,
              roomLightOnRef.current
            );
          } else {
            // --- SCENE 4: FACILITY EXTERIOR AT NIGHT (NO RAIN, NO CAR, THINKING ANIMATION BEFORE ENTERING) ---
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

            const isWalking =
              (currentPhase === 'FACILITY_EXTERIOR_WALK' &&
                (sim.keysHeld.left || sim.keysHeld.right)) ||
              currentPhase === 'FACILITY_ENTERING_FADE_OUT';
            const isThinking = currentPhase === 'FACILITY_EXTERIOR_THINKING';

            draw8BitProtagonist(
              ctx,
              sim.playerX,
              groundY + 10,
              sim.playerFacing,
              sim.walkCycle,
              isWalking,
              isThinking,
              timeSec
            );
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
  }, [onComplete, syncHallwayProximities, syncRoomProximities]);

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
            data-testid="post-night2-slow-tremble-text"
            className="inline-block whitespace-nowrap"
          >
            {visibleText.split('').map((ch, charIdx) => {
              const seed = charIdx * 17 + trembleTick * 13;
              const dx = ((seed % 3) - 1) * 0.65;
              const dy = (((seed * 7) % 3) - 1) * 0.65;
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

  return (
    <div
      data-testid="eight-bit-post-night2-minigame"
      data-phase={phase}
      data-floor={currentFloor}
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

        {/* 1. Hotel Exterior Door [E] Popover (only when near the door) */}
        {phase === 'HOTEL_EXTERIOR_WALK' && nearExteriorDoor && (
          <button
            type="button"
            data-testid="hotel-exterior-enter-btn"
            aria-label="Entrar al hotel [E]"
            onClick={handleEnterHotelFromOutside}
            className="absolute top-[52%] left-[50%] -translate-x-1/2 -translate-y-1/2 px-2 py-0.5 bg-zinc-950/95 hover:bg-zinc-900 border-2 border-amber-400 text-amber-300 text-xs font-extrabold shadow-lg cursor-pointer animate-bounce"
          >
            E
          </button>
        )}

        {/* 2. Floor 1 Receptionist [E] Popover (only when near a receptionist) */}
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
            className="absolute top-[46%] -translate-x-1/2 -translate-y-1/2 px-2 py-0.5 bg-zinc-950/95 hover:bg-zinc-900 border-2 border-amber-400 text-amber-300 text-xs font-extrabold shadow-lg cursor-pointer animate-bounce"
          >
            E
          </button>
        )}

        {/* 3. Left Elevator (BAJAR) [E] Popover (only when on Floor 2 or 3 and standing in front of Left Elevator) */}
        {phase === 'HOTEL_HALLWAY' && currentFloor > 1 && nearElevatorDown && (
          <button
            type="button"
            data-testid="hotel-elevator-down-btn"
            aria-label="Bajar en ascensor izquierdo [E]"
            onClick={handleUseElevatorDown}
            style={{
              left: toHallwayScreenLeftPct(HOTEL_ELEVATOR_DOWN_X),
            }}
            className="absolute top-[46%] -translate-x-1/2 -translate-y-1/2 px-2 py-0.5 bg-zinc-950/95 hover:bg-zinc-900 border-2 border-amber-400 text-amber-300 text-xs font-extrabold shadow-lg cursor-pointer animate-bounce"
          >
            E
          </button>
        )}

        {/* 4. Right Elevator (SUBIR) [E] Popover (only when on Floor 1 or 2 and standing in front of Right Elevator) */}
        {phase === 'HOTEL_HALLWAY' && currentFloor < 3 && nearElevatorUp && (
          <button
            type="button"
            data-testid="hotel-elevator-up-btn"
            aria-label="Subir en ascensor derecho [E]"
            onClick={handleUseElevatorUp}
            style={{
              left: toHallwayScreenLeftPct(HOTEL_ELEVATOR_UP_X),
            }}
            className="absolute top-[46%] -translate-x-1/2 -translate-y-1/2 px-2 py-0.5 bg-zinc-950/95 hover:bg-zinc-900 border-2 border-amber-400 text-amber-300 text-xs font-extrabold shadow-lg cursor-pointer animate-bounce"
          >
            E
          </button>
        )}

        {/* 5A. Floor 3 Room 303 Door [E] Popover (3rd room from left - player's room) */}
        {phase === 'HOTEL_HALLWAY' &&
          currentFloor === 3 &&
          nearbyHallwayRoom?.isPlayerRoom &&
          !hasWokenForNightShift && (
            <button
              type="button"
              data-testid="hotel-enter-room-303-btn"
              aria-label="Entrar a habitación 303 [E]"
              onClick={handleEnterRoom303}
              style={{
                left: toHallwayScreenLeftPct(nearbyHallwayRoom.x),
              }}
              className="absolute top-[46%] -translate-x-1/2 -translate-y-1/2 px-2 py-0.5 bg-zinc-950/95 hover:bg-zinc-900 border-2 border-amber-400 text-amber-300 text-xs font-extrabold shadow-lg cursor-pointer animate-bounce"
            >
              E
            </button>
          )}

        {/* 5B. Any Non-Player Hotel Room Door [E] Popover ("pon que el personaje pueda intentar abrir cualquier puerta y si no es la suya que diga la llave no funciona, esta no es mi habitacion") */}
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
              className="absolute top-[46%] -translate-x-1/2 -translate-y-1/2 px-2 py-0.5 bg-zinc-950/95 hover:bg-zinc-900 border-2 border-amber-400 text-amber-300 text-xs font-extrabold shadow-lg cursor-pointer animate-bounce"
            >
              E
            </button>
          )}

        {/* 6. Floor 1 Main Hotel Exit Door [E] Popover (after waking up at night to go to work) */}
        {phase === 'HOTEL_HALLWAY' &&
          currentFloor === 1 &&
          hasWokenForNightShift &&
          nearHallwayExitDoor && (
            <button
              type="button"
              data-testid="hotel-hallway-exit-btn"
              aria-label="Salir del hotel hacia el local [E]"
              onClick={handleExitHotelToFacility}
              style={{
                left: toHallwayScreenLeftPct(HOTEL_HALLWAY_EXIT_DOOR_X),
              }}
              className="absolute top-[46%] -translate-x-1/2 -translate-y-1/2 px-2 py-0.5 bg-zinc-950/95 hover:bg-zinc-900 border-2 border-amber-400 text-amber-300 text-xs font-extrabold shadow-lg cursor-pointer animate-bounce"
            >
              E
            </button>
          )}

        {/* 7. Hotel Room Light Switch [E] Popover */}
        {(phase === 'HOTEL_ROOM_FREE_ROAM' || phase === 'HOTEL_ROOM_NIGHT_EXIT_WALK') &&
          nearLightSwitch &&
          !nearRoomCentralDoor && (
            <button
              type="button"
              data-testid="hotel-light-switch-btn"
              aria-label="Interruptor de luz [E]"
              onClick={handleToggleRoomLight}
              style={{
                left: `${(HOTEL_LIGHT_SWITCH_X / 960) * 100}%`,
              }}
              className="absolute top-[48%] -translate-x-1/2 -translate-y-1/2 px-2 py-0.5 bg-zinc-950/95 hover:bg-zinc-900 border-2 border-amber-400 text-amber-300 text-xs font-extrabold shadow-lg cursor-pointer animate-bounce"
            >
              E
            </button>
          )}

        {/* 8. Hotel Room Bed [E] Popover (before sleeping) */}
        {phase === 'HOTEL_ROOM_FREE_ROAM' && nearBed && (
          <button
            type="button"
            data-testid="hotel-bed-interact-btn"
            aria-label="Ir a dormir en la cama [E]"
            onClick={handleInteractBed}
            className="absolute top-[52%] left-[25%] -translate-x-1/2 -translate-y-1/2 px-2 py-0.5 bg-zinc-950/95 hover:bg-zinc-900 border-2 border-amber-400 text-amber-300 text-xs font-extrabold shadow-lg cursor-pointer animate-bounce"
          >
            E
          </button>
        )}

        {/* 9. Hotel Room Central Door [E] Popover (after waking up at night to leave room) */}
        {phase === 'HOTEL_ROOM_NIGHT_EXIT_WALK' && nearRoomCentralDoor && (
          <button
            type="button"
            data-testid="hotel-room-exit-door-btn"
            aria-label="Salir de la habitación al pasillo [E]"
            onClick={handleExitRoomToHallwayAtNight}
            className="absolute top-[46%] left-[50%] -translate-x-1/2 -translate-y-1/2 px-2 py-0.5 bg-zinc-950/95 hover:bg-zinc-900 border-2 border-amber-400 text-amber-300 text-xs font-extrabold shadow-lg cursor-pointer animate-bounce"
          >
            E
          </button>
        )}

        {/* Dialogue Box */}
        {activeTab && (
          <div
            data-testid="post-night2-dialogue-box"
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
                  data-testid="post-night2-speaker-badge"
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
              data-testid="post-night2-dialogue-text"
              className="text-base sm:text-xl text-zinc-100 font-semibold leading-relaxed min-h-[3.5rem]"
            >
              {renderSegmentedDialogueText()}
            </div>

            {activeTab.hasYesNoChoice ? (
              <div
                data-testid="post-night2-yes-no-choices"
                className="mt-4 pt-3 border-t border-zinc-800 flex items-center justify-around gap-6"
              >
                <button
                  type="button"
                  data-testid="post-night2-choice-yes"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleChooseSleepYes();
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
                  data-testid="post-night2-choice-no"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleChooseSleepNo();
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
                  data-testid="post-night2-dialogue-enter-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAdvanceDialogue();
                  }}
                  className="px-3.5 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold uppercase tracking-wider transition-colors"
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
