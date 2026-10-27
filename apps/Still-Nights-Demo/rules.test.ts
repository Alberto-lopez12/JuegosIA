import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getNightConfig,
  getActiveAIForHour,
  createInitialAnimatronics,
  apply3AMPhaseShift,
  stepAnimatronicMovement,
  calculatePowerDrain,
  MOVEMENT_GRAPH,
  INITIAL_CAMPAIGN_PROGRESS,
  getUnlockedDossiers,
  isExtraNightsSectionUnlocked,
  isNight7Unlocked,
  recordNightVictory,
  VENT_CLOSED_MAX_WAIT_SEC,
} from './rules';

test('Night 1 activates only Still Freddy and attacks via Right Door or Vent', () => {
  const config = getNightConfig(1);
  const anims = createInitialAnimatronics(config);

  assert.equal(anims.freddy.active, true);
  assert.equal(anims.bonnie.active, false);
  assert.equal(anims.chica.active, false);
  assert.equal(anims.blob.active, false);

  assert.deepEqual(MOVEMENT_GRAPH.freddy.CAM_4B, ['DOOR_RIGHT']);
  assert.ok(MOVEMENT_GRAPH.freddy.VENT_EAST?.includes('VENT_OFFICE'));
});

test('Night 2 activates Freddy & Bonnie at 12:00 AM and activates Still Chica at 3:00 AM in CAM_5', () => {
  const config = getNightConfig(2);
  const anims = createInitialAnimatronics(config);

  // At 12:00 AM, only Freddy and Bonnie are active; Chica is inactive in CAM_5
  assert.equal(anims.freddy.active, true);
  assert.equal(anims.bonnie.active, true);
  assert.equal(anims.bonnie.location, 'CAM_1A');
  assert.equal(anims.chica.active, false);
  assert.equal(anims.chica.location, 'CAM_5');
  assert.equal(anims.blob.active, false);

  // At 3:00 AM, apply3AMPhaseShift activates Chica in CAM_5 while preserving Freddy & Bonnie
  const animsWithBonnieMoved = {
    ...anims,
    bonnie: { ...anims.bonnie, location: 'CAM_2A' as const },
  };
  const shifted3AM = apply3AMPhaseShift(animsWithBonnieMoved, config);
  assert.equal(shifted3AM.animatronics.freddy.active, true);
  assert.equal(shifted3AM.animatronics.bonnie.active, true);
  assert.equal(shifted3AM.animatronics.bonnie.location, 'CAM_2A');
  assert.equal(shifted3AM.animatronics.chica.active, true);
  assert.ok(shifted3AM.animatronics.chica.aiLevel > 0);
  assert.equal(shifted3AM.animatronics.chica.location, 'CAM_5');
});

test('Night 5 activates ONLY The Thing', () => {
  const config = getNightConfig(5);
  const anims = createInitialAnimatronics(config);

  assert.equal(anims.freddy.active, false);
  assert.equal(anims.bonnie.active, false);
  assert.equal(anims.chica.active, false);
  assert.equal(anims.blob.active, true);
  assert.equal(anims.blob.name, 'The Thing');
  assert.equal(config.subtitle, 'La Llegada de The Thing');
});

test('Nights 6 and 7 follow FNAF 4 split mechanic: Still Trio 12AM-3AM, The Thing 3AM-6AM', () => {
  const config6 = getNightConfig(6);
  const config7 = getNightConfig(7);

  const aiHour2 = getActiveAIForHour(config6, 2);
  assert.ok(aiHour2.freddy > 0 && aiHour2.bonnie > 0 && aiHour2.chica > 0);
  assert.equal(aiHour2.blob, 0);

  const aiHour3 = getActiveAIForHour(config6, 3);
  assert.equal(aiHour3.freddy, 0);
  assert.equal(aiHour3.bonnie, 0);
  assert.equal(aiHour3.chica, 0);
  assert.ok(aiHour3.blob > 0);

  assert.ok(config7.initialAI.freddy > config6.initialAI.freddy);
  assert.ok((config7.phase2AI?.blob ?? 0) > (config6.phase2AI?.blob ?? 0));

  const initialAnims = createInitialAnimatronics(config6);
  const shifted = apply3AMPhaseShift(initialAnims, config6);
  assert.equal(shifted.animatronics.freddy.active, false);
  assert.equal(shifted.animatronics.bonnie.active, false);
  assert.equal(shifted.animatronics.chica.active, false);
  assert.equal(shifted.animatronics.blob.active, true);
});

test('Night 8 Custom Night 20/20/20/20 activates all 4 animatronics at level 20', () => {
  const config8 = getNightConfig(8, { freddy: 20, bonnie: 20, chica: 20, blob: 20 });
  const anims = createInitialAnimatronics(config8);

  assert.equal(config8.label, 'NOCHE 8 (20/20/20/20)');
  assert.equal(anims.freddy.aiLevel, 20);
  assert.equal(anims.bonnie.aiLevel, 20);
  assert.equal(anims.chica.aiLevel, 20);
  assert.equal(anims.blob.aiLevel, 20);
});

test('Closed vent forces retreat within 2-3s (VENT_CLOSED_MAX_WAIT_SEC = 2.5s) even if AI roll is 20', () => {
  assert.ok(VENT_CLOSED_MAX_WAIT_SEC >= 2 && VENT_CLOSED_MAX_WAIT_SEC <= 3);
  const config = getNightConfig(1);
  const anims = createInitialAnimatronics(config);

  const freddyAtOfficeVent = { ...anims.freddy, location: 'VENT_OFFICE' as const, aiLevel: 6 };
  const stepBlocked = stepAnimatronicMovement(
    freddyAtOfficeVent,
    {
      leftDoorClosed: false,
      rightDoorClosed: false,
      ventClosed: true,
      leftLightOn: false,
      rightLightOn: false,
      cameraOpen: false,
    },
    20,
    0.2
  );
  assert.notEqual(stepBlocked.nextState.location, 'OFFICE_INSIDE');
  assert.equal(stepBlocked.triggerOfficeFlickerMs, 1500);
  assert.ok(stepBlocked.audioEvents.includes('VENT_RETREAT_FLICKER'));
  assert.equal(stepBlocked.triggeredJumpscareBy, null);
});

test('Demo progression cap: only Nights 1 and 2 are playable and campaign progression caps at Night 2', async () => {
  const { DEMO_MAX_PLAYABLE_NIGHT, isNightPlayableInDemo } = await import('./rules');

  assert.equal(DEMO_MAX_PLAYABLE_NIGHT, 2);
  assert.equal(isNightPlayableInDemo(1), true);
  assert.equal(isNightPlayableInDemo(2), true);
  assert.equal(isNightPlayableInDemo(3), false);
  assert.equal(isNightPlayableInDemo(5), false);
  assert.equal(isNightPlayableInDemo(6), false);

  let p = { ...INITIAL_CAMPAIGN_PROGRESS };
  assert.equal(p.hasStartedNewGame, false);
  assert.equal(isExtraNightsSectionUnlocked(p.highestNightCompleted), false);

  // Beat Night 1 -> campaign moves to Night 2
  p = recordNightVictory(p, 1);
  assert.equal(p.hasStartedNewGame, true);
  assert.equal(p.currentCampaignNight, 2);
  assert.equal(p.highestNightCompleted, 1);

  // Beat Night 2 -> campaign stays capped at Night 2 (never advances to Night 3 in the Demo)
  p = recordNightVictory(p, 2);
  assert.equal(p.currentCampaignNight, 2);
  assert.equal(p.highestNightCompleted, 2);
  assert.equal(isExtraNightsSectionUnlocked(p.highestNightCompleted), false);
});

test('Power drain increases accurately with doors, vent, and lights/cameras', () => {
  const idle = calculatePowerDrain({
    leftDoorClosed: false,
    rightDoorClosed: false,
    ventClosed: false,
    leftLightOn: false,
    rightLightOn: false,
    cameraOpen: false,
  });
  const full = calculatePowerDrain({
    leftDoorClosed: true,
    rightDoorClosed: true,
    ventClosed: true,
    leftLightOn: true,
    rightLightOn: false,
    cameraOpen: true,
  });

  assert.equal(idle.usageBars, 1);
  assert.equal(full.usageBars, 5);
  assert.ok(full.drainPerSecond > idle.drainPerSecond);
});

test('12:00 AM -> 6:00 AM victory clock counter formats minutes and slows to 0.5s per step from 5:58 to 6:00', async () => {
  const { formatClockCounterMinute, getClockSpeedMinPerSec } = await import(
    '../components/VictoryClockSequence'
  );
  const { isCustomNightUnlocked } = await import('./rules');

  assert.equal(isCustomNightUnlocked(5), false);
  assert.equal(isCustomNightUnlocked(6), false);
  assert.equal(isCustomNightUnlocked(7), true);

  assert.equal(formatClockCounterMinute(0), '12:00 AM');
  assert.equal(formatClockCounterMinute(60), '1:00 AM');
  assert.equal(formatClockCounterMinute(300), '5:00 AM');
  assert.equal(formatClockCounterMinute(350), '5:50 AM');
  assert.equal(formatClockCounterMinute(358), '5:58 AM');
  assert.equal(formatClockCounterMinute(359), '5:59 AM');
  assert.equal(formatClockCounterMinute(360), '6:00 AM');

  // 12:00 AM -> 5:00 AM is very fast
  const fastSpeed = getClockSpeedMinPerSec(120);
  // 5:00 AM -> 5:50 AM slows down
  const midSpeed = getClockSpeedMinPerSec(330);
  // 5:50 AM -> 5:58 AM slows down much more
  const slowSpeed = getClockSpeedMinPerSec(355);
  // 5:58 AM and 5:59 AM advance at 2.0 numbers/sec (0.5 seconds per number)
  assert.ok(fastSpeed > midSpeed);
  assert.ok(midSpeed > slowSpeed);
  assert.equal(getClockSpeedMinPerSec(358), 2.0);
  assert.equal(getClockSpeedMinPerSec(359), 2.0);
});

test('Post-6AM victory in Demo: Night 1 advances to Night 2, and Night 2 triggers Demo Completion screen with GameJolt link', async () => {
  const {
    POST_6AM_HOLD_SECONDS,
    DEMO_THANKS_TITLE,
    DEMO_GAMEJOLT_URL,
    DEMO_FEEDBACK_TEXT,
    getPostVictoryAction,
  } = await import('./rules');

  assert.equal(POST_6AM_HOLD_SECONDS, 4.0);
  assert.equal(DEMO_THANKS_TITLE, 'Muchas gracias por jugar la demo');
  assert.equal(
    DEMO_GAMEJOLT_URL,
    'https://gamejolt.com/games/FiveNightsAtFreddysStillNights/1111520'
  );
  assert.equal(
    DEMO_FEEDBACK_TEXT,
    'Deja feedback en la pagina de gamejolt: https://gamejolt.com/games/FiveNightsAtFreddysStillNights/1111520'
  );

  assert.deepEqual(getPostVictoryAction(1), { type: 'next_night', nextNightNumber: 2 });
  assert.deepEqual(getPostVictoryAction(2), { type: 'demo_complete' });
});

test('Still Freddy vent strike + laugh mechanic: 3% at low AI (1) up to 20% at high AI (20) when able to enter vent', async () => {
  const {
    FREDDY_VENT_LAUGH_DELAY_MS,
    canFreddyEnterVentFrom,
    getFreddyVentFakeoutProbability,
  } = await import('./rules');

  // Delay between vent footsteps sound and Risa-Freddy is 1.0s (1000ms)
  assert.equal(FREDDY_VENT_LAUGH_DELAY_MS, 1000);

  // Freddy can enter ventilation from CAM_1B and CAM_4A, not from CAM_1A or inside a vent
  assert.equal(canFreddyEnterVentFrom('CAM_1A'), false);
  assert.equal(canFreddyEnterVentFrom('CAM_1B'), true);
  assert.equal(canFreddyEnterVentFrom('CAM_4A'), true);
  assert.equal(canFreddyEnterVentFrom('VENT_EAST'), false);

  // Probability scales from 3% (AI=1) to 20% (AI=20)
  assert.equal(getFreddyVentFakeoutProbability(0), 0);
  assert.equal(getFreddyVentFakeoutProbability(1), 0.03);
  assert.equal(getFreddyVentFakeoutProbability(20), 0.20);
  const probLow = getFreddyVentFakeoutProbability(6);
  const probMid = getFreddyVentFakeoutProbability(12);
  assert.ok(probLow > 0.03 && probLow < probMid);
  assert.ok(probMid < 0.20);

  // When Freddy is at CAM_1B and fakeoutRoll < probability, he emits FREDDY_VENT_FAKEOUT and stays outside the vent
  const config = getNightConfig(1);
  const anims = createInitialAnimatronics(config);
  const freddyAtCam1B = { ...anims.freddy, location: 'CAM_1B' as const, aiLevel: 20 };

  const fakeoutStep = stepAnimatronicMovement(
    freddyAtCam1B,
    {
      leftDoorClosed: false,
      rightDoorClosed: false,
      ventClosed: false,
      leftLightOn: false,
      rightLightOn: false,
      cameraOpen: false,
    },
    10,
    0.5,
    0.15 // < 0.20 (20% max AI probability)
  );
  assert.deepEqual(fakeoutStep.audioEvents, ['FREDDY_VENT_FAKEOUT']);
  assert.equal(fakeoutStep.nextState.location, 'CAM_1B');
});

test('8-Bit Intro Minigame dialogues & walking stop trigger before ruined wooden building entrance', async () => {
  const {
    INTRO_DRIVING_DIALOGUES,
    INTRO_OUTSIDE_CAR_DIALOGUE,
    INTRO_OUTSIDE_DOOR_DIALOGUE,
    INTRO_OUTSIDE_SPAWN_X,
    INTRO_DOOR_STOP_X,
    stepIntroWalkPosition,
  } = await import('./rules');

  assert.equal(INTRO_DRIVING_DIALOGUES.length, 2);
  assert.equal(INTRO_DRIVING_DIALOGUES[0].text, 'Seguro que es allí a donde tengo que ir');
  assert.ok(INTRO_DRIVING_DIALOGUES[1].text.includes('Sí, allí es, pero recuerda llegar un rato antes'));
  assert.ok(INTRO_OUTSIDE_CAR_DIALOGUE.text.includes('Es la primera vez que me toca hacer un trabajo a estas horas'));
  assert.equal(
    INTRO_OUTSIDE_DOOR_DIALOGUE.text,
    'Este sitio... está hecho una porquería, ¿De verdad que aquí se paga lo que anunciaron?'
  );

  // Walking right from the parked car eventually stops automatically at INTRO_DOOR_STOP_X
  let x = INTRO_OUTSIDE_SPAWN_X;
  const step1 = stepIntroWalkPosition(x, 1, 0.5);
  assert.ok(step1.x > x && !step1.reachedDoorStop);

  const stepToDoor = stepIntroWalkPosition(x, 1, 5.0);
  assert.equal(stepToDoor.x, INTRO_DOOR_STOP_X);
  assert.equal(stepToDoor.reachedDoorStop, true);
});

test('Night 1 Office Monologue, 3x Ringing Phone (1s gap), ??? Caller Dialogues & trembling ASUNTOS PENDIENTES', async () => {
  const {
    INITIAL_NIGHT_1_OFFICE_NARRATIVE_STATE,
    NIGHT_1_OFFICE_MONOLOGUE_TABS,
    NIGHT_1_PHONE_CALL_TABS,
    PHONE_RING_TOTAL_LOOPS,
    PHONE_RING_GAP_MS,
    advanceNight1OfficeNarrative,
    isGameplayFrozenByNarrative,
  } = await import('./rules');

  assert.equal(PHONE_RING_TOTAL_LOOPS, 3);
  assert.equal(PHONE_RING_GAP_MS, 1000);
  assert.equal(NIGHT_1_OFFICE_MONOLOGUE_TABS.length, 2);
  assert.equal(NIGHT_1_PHONE_CALL_TABS.length, 6);

  // Verify Tab 5 (index 4) has the slowTremble segment for "ASUNTOS PENDIENTES"
  const tab5 = NIGHT_1_PHONE_CALL_TABS[4];
  assert.equal(tab5.speaker, '???');
  const trembleSeg = tab5.segments.find((s) => s.slowTremble);
  assert.ok(trembleSeg);
  assert.ok(trembleSeg.text.includes('ASUNTOS PENDIENTES'));

  // Step through state machine: 2 monologue tabs -> PHONE_RINGING -> 6 phone call tabs -> COMPLETED
  let state = { ...INITIAL_NIGHT_1_OFFICE_NARRATIVE_STATE };
  assert.equal(state.phase, 'OFFICE_MONOLOGUE');
  assert.equal(state.tabIndex, 0);
  assert.equal(isGameplayFrozenByNarrative(false, state.phase !== 'COMPLETED'), true);

  state = advanceNight1OfficeNarrative(state, 'PRESS_ENTER');
  assert.equal(state.phase, 'OFFICE_MONOLOGUE');
  assert.equal(state.tabIndex, 1);

  state = advanceNight1OfficeNarrative(state, 'PRESS_ENTER');
  assert.equal(state.phase, 'PHONE_RINGING');

  state = advanceNight1OfficeNarrative(state, 'PHONE_RINGS_DONE');
  assert.equal(state.phase, 'PHONE_CALL_DIALOGUE');
  assert.equal(state.tabIndex, 0);

  for (let i = 0; i < 5; i++) {
    state = advanceNight1OfficeNarrative(state, 'PRESS_ENTER');
    assert.equal(state.phase, 'PHONE_CALL_DIALOGUE');
    assert.equal(state.tabIndex, i + 1);
  }

  // Final Enter on Tab 6 ("¡Ejem, ejem, lo dicho, pásalo bien!") finishes the call and unfreezes gameplay
  state = advanceNight1OfficeNarrative(state, 'PRESS_ENTER');
  assert.equal(state.phase, 'COMPLETED');
  assert.equal(isGameplayFrozenByNarrative(false, state.phase !== 'COMPLETED'), false);
});

test('Still Nightmare: activates on Night 3 at 2:00 AM, advances through 4 bathroom stages silently, emits NIGHTMARE_FOOTSTEPS when walking, and resets to stage 2 when blocked at door', async () => {
  const {
    apply2AMNightmareActivation,
    isAnimatronicVisibleOnCamera,
  } = await import('./rules');

  const config3 = getNightConfig(3);
  const anims = createInitialAnimatronics(config3);

  // At 12:00 AM on Night 3, Still Nightmare is inactive in CAM_3 at stage 1 (door closed)
  assert.equal(anims.nightmare.active, false);
  assert.equal(anims.nightmare.location, 'CAM_3');
  assert.equal(anims.nightmare.bathroomStage, 1);

  // At 2:00 AM on Night 3, Still Nightmare activates in CAM_3 at stage 1
  const shifted2AM = apply2AMNightmareActivation(anims, config3);
  let nightmare = shifted2AM.animatronics.nightmare;
  assert.equal(nightmare.active, true);
  assert.ok(nightmare.aiLevel > 0);
  assert.equal(nightmare.location, 'CAM_3');
  assert.equal(nightmare.bathroomStage, 1);
  assert.equal(isAnimatronicVisibleOnCamera(nightmare, 'CAM_3'), false);

  const openDefense = {
    leftDoorClosed: false,
    rightDoorClosed: false,
    ventClosed: false,
    leftLightOn: false,
    rightLightOn: false,
    cameraOpen: false,
  };

  // Stage 1 -> Stage 2 (red eye in darkness): silent in bathroom (no footsteps)
  const stepTo2 = stepAnimatronicMovement(nightmare, openDefense, 1, 0.2);
  nightmare = stepTo2.nextState;
  assert.equal(nightmare.location, 'CAM_3');
  assert.equal(nightmare.bathroomStage, 2);
  assert.deepEqual(stepTo2.audioEvents, []);

  // Stage 2 -> Stage 3 (hand on door + head peeking): silent in bathroom (no footsteps)
  const stepTo3 = stepAnimatronicMovement(nightmare, openDefense, 1, 0.2);
  nightmare = stepTo3.nextState;
  assert.equal(nightmare.location, 'CAM_3');
  assert.equal(nightmare.bathroomStage, 3);
  assert.deepEqual(stepTo3.audioEvents, []);

  // Stage 3 -> Stage 4 (leaves bathroom, door wide open with claw marks): emits NIGHTMARE_FOOTSTEPS
  // With branchRoll < 0.5, chooses Right Hallway (closer to office: BATHROOM_HALL_RIGHT -> DOOR_RIGHT)
  const stepLeaveRight = stepAnimatronicMovement(nightmare, openDefense, 1, 0.2);
  const nightmareRight = stepLeaveRight.nextState;
  assert.equal(nightmareRight.bathroomStage, 4);
  assert.equal(nightmareRight.location, 'BATHROOM_HALL_RIGHT');
  assert.deepEqual(stepLeaveRight.audioEvents, ['NIGHTMARE_FOOTSTEPS']);
  // Hidden on standard cameras while walking in corridors
  assert.equal(isAnimatronicVisibleOnCamera(nightmareRight, 'CAM_4A'), false);
  assert.equal(isAnimatronicVisibleOnCamera(nightmareRight, 'CAM_4B'), false);

  // Next step on Right Route reaches DOOR_RIGHT and emits NIGHTMARE_FOOTSTEPS
  const stepToRightDoor = stepAnimatronicMovement(nightmareRight, openDefense, 1, 0.2);
  assert.equal(stepToRightDoor.nextState.location, 'DOOR_RIGHT');
  assert.deepEqual(stepToRightDoor.audioEvents, ['NIGHTMARE_FOOTSTEPS']);

  // If Right Door is closed when Nightmare attacks from DOOR_RIGHT, he resets to CAM_3 at Stage 2!
  const closedRightDefense = { ...openDefense, rightDoorClosed: true };
  const blockedRight = stepAnimatronicMovement(stepToRightDoor.nextState, closedRightDefense, 1, 0.2);
  assert.equal(blockedRight.nextState.location, 'CAM_3');
  assert.equal(blockedRight.nextState.bathroomStage, 2);
  assert.deepEqual(blockedRight.audioEvents, ['DOOR_KNOCK', 'NIGHTMARE_FOOTSTEPS']);
  assert.equal(blockedRight.triggeredJumpscareBy, null);

  // Also test Left Route (slightly longer: BATHROOM_HALL_LEFT_1 -> BATHROOM_HALL_LEFT_2 -> DOOR_LEFT)
  const stepLeaveLeft = stepAnimatronicMovement(nightmare, openDefense, 1, 0.8);
  assert.equal(stepLeaveLeft.nextState.location, 'BATHROOM_HALL_LEFT_1');
  assert.deepEqual(stepLeaveLeft.audioEvents, ['NIGHTMARE_FOOTSTEPS']);

  const stepLeft2 = stepAnimatronicMovement(stepLeaveLeft.nextState, openDefense, 1, 0.8);
  assert.equal(stepLeft2.nextState.location, 'BATHROOM_HALL_LEFT_2');
  assert.deepEqual(stepLeft2.audioEvents, ['NIGHTMARE_FOOTSTEPS']);

  const stepLeftDoor = stepAnimatronicMovement(stepLeft2.nextState, openDefense, 1, 0.8);
  assert.equal(stepLeftDoor.nextState.location, 'DOOR_LEFT');
  assert.deepEqual(stepLeftDoor.audioEvents, ['NIGHTMARE_FOOTSTEPS']);

  // Attacking an open left door triggers NIGHTMARE_JUMPSCARE
  const attackOpenLeft = stepAnimatronicMovement(stepLeftDoor.nextState, openDefense, 1, 0.8);
  assert.equal(attackOpenLeft.triggeredJumpscareBy, 'nightmare');
  assert.deepEqual(attackOpenLeft.audioEvents, ['NIGHTMARE_JUMPSCARE']);
});

