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

test('Campaign progression & Extras unlocks: Extra Nights & The Thing hidden until N5 beaten, Night 7 after N6', () => {
  let p = { ...INITIAL_CAMPAIGN_PROGRESS };
  assert.equal(p.hasStartedNewGame, false);
  assert.equal(isExtraNightsSectionUnlocked(p.highestNightCompleted), false);
  assert.deepEqual(getUnlockedDossiers(p.highestNightCompleted), {
    freddy: false,
    bonnie: false,
    chica: false,
    nightmare: false,
    blob: false,
  });
  assert.equal(isNight7Unlocked(p.highestNightCompleted), false);

  // Beat Night 1 -> Freddy unlocked, campaign moves to Night 2, Extra Nights still hidden
  p = recordNightVictory(p, 1);
  assert.equal(p.hasStartedNewGame, true);
  assert.equal(p.currentCampaignNight, 2);
  assert.equal(isExtraNightsSectionUnlocked(p.highestNightCompleted), false);
  assert.deepEqual(getUnlockedDossiers(p.highestNightCompleted), {
    freddy: true,
    bonnie: false,
    chica: false,
    nightmare: false,
    blob: false,
  });

  // Beat Night 2 -> Bonnie unlocked
  p = recordNightVictory(p, 2);
  assert.equal(getUnlockedDossiers(p.highestNightCompleted).bonnie, true);

  // Beat Night 3 -> Chica & Nightmare unlocked, Extra Nights & The Thing still hidden
  p = recordNightVictory(p, 3);
  assert.equal(getUnlockedDossiers(p.highestNightCompleted).chica, true);
  assert.equal(getUnlockedDossiers(p.highestNightCompleted).nightmare, true);
  assert.equal(getUnlockedDossiers(p.highestNightCompleted).blob, false);
  assert.equal(isExtraNightsSectionUnlocked(p.highestNightCompleted), false);

  // Beat Night 5 -> Extra Nights section (Night 6) & The Thing dossier unlocked; Night 7 and Custom Night locked
  p = recordNightVictory(p, 5);
  assert.equal(isExtraNightsSectionUnlocked(p.highestNightCompleted), true);
  assert.equal(getUnlockedDossiers(p.highestNightCompleted).blob, true);
  assert.equal(isNight7Unlocked(p.highestNightCompleted), false);

  // Beat Night 6 -> Night 7 unlocked in Extras, Custom Night still locked
  p = recordNightVictory(p, 6);
  assert.equal(isNight7Unlocked(p.highestNightCompleted), true);

  // Beat Night 7 -> Night 8 (Custom Night) unlocked in Extras
  p = recordNightVictory(p, 7);
  assert.equal(p.highestNightCompleted, 7);
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

test('Post-6AM victory holds for 4 seconds without options and auto-advances Nights 1-4 or returns to Main Menu on Night 5+', async () => {
  const { POST_6AM_HOLD_SECONDS, getPostVictoryAction } = await import('./rules');

  assert.equal(POST_6AM_HOLD_SECONDS, 4.0);

  assert.deepEqual(getPostVictoryAction(1), { type: 'next_night', nextNightNumber: 2 });
  assert.deepEqual(getPostVictoryAction(2), { type: 'next_night', nextNightNumber: 3 });
  assert.deepEqual(getPostVictoryAction(3), { type: 'next_night', nextNightNumber: 4 });
  assert.deepEqual(getPostVictoryAction(4), { type: 'next_night', nextNightNumber: 5 });

  // Night 5 (final campaign night) and Extra Nights return to Main Menu
  assert.deepEqual(getPostVictoryAction(5), { type: 'main_menu' });
  assert.deepEqual(getPostVictoryAction(6), { type: 'main_menu' });
  assert.deepEqual(getPostVictoryAction(7), { type: 'main_menu' });
  assert.deepEqual(getPostVictoryAction(8), { type: 'main_menu' });
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
  assert.equal(INTRO_DRIVING_DIALOGUES[0].text, 'Seguro que es allí a donde tengo que ir.');
  assert.ok(INTRO_DRIVING_DIALOGUES[1].text.includes('Sí, allí es, pero recuerda llegar un rato antes'));
  assert.ok(INTRO_OUTSIDE_CAR_DIALOGUE.text.includes('Es la primera vez que me toca hacer un trabajo a estas horas.'));
  assert.equal(
    INTRO_OUTSIDE_DOOR_DIALOGUE.text,
    'Este sitio... está hecho una porquería. ¿De verdad que aquí se paga lo que anunciaron?'
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
  assert.equal(isGameplayFrozenByNarrative(false, state.phase !== 'COMPLETED'), true);
  assert.equal(state.phase, 'OFFICE_MONOLOGUE');
  assert.equal(state.tabIndex, 0);

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

test('Still Nightmare: activates on Night 3 at 2:00 AM, advances through 4 bathroom stages silently, is visible on cameras (CAM_3 stages 2-3 & hallway cameras CAM_4B/2A/2B), emits NIGHTMARE_FOOTSTEPS when walking, and resets to stage 2 when blocked at door', async () => {
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

  // At 2:00 AM on Night 3, Still Nightmare activates in CAM_3 at stage 1 (door closed -> not detected yet)
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

  // Stage 1 -> Stage 2 (red eye in darkness): silent in bathroom, visible on CAM_3
  const stepTo2 = stepAnimatronicMovement(nightmare, openDefense, 1, 0.2);
  nightmare = stepTo2.nextState;
  assert.equal(nightmare.location, 'CAM_3');
  assert.equal(nightmare.bathroomStage, 2);
  assert.equal(isAnimatronicVisibleOnCamera(nightmare, 'CAM_3'), true);
  assert.deepEqual(stepTo2.audioEvents, []);

  // Stage 2 -> Stage 3 (hand on door + head peeking): silent in bathroom, visible on CAM_3
  const stepTo3 = stepAnimatronicMovement(nightmare, openDefense, 1, 0.2);
  nightmare = stepTo3.nextState;
  assert.equal(nightmare.location, 'CAM_3');
  assert.equal(nightmare.bathroomStage, 3);
  assert.equal(isAnimatronicVisibleOnCamera(nightmare, 'CAM_3'), true);
  assert.deepEqual(stepTo3.audioEvents, []);

  // Stage 3 -> Stage 4 (leaves bathroom, door wide open with claw marks): emits NIGHTMARE_FOOTSTEPS
  // With branchRoll < 0.5, chooses Right Hallway (closer to office: CAM_4B -> DOOR_RIGHT)
  const stepLeaveRight = stepAnimatronicMovement(nightmare, openDefense, 1, 0.2);
  const nightmareRight = stepLeaveRight.nextState;
  assert.equal(nightmareRight.bathroomStage, 4);
  assert.equal(nightmareRight.location, 'CAM_4B');
  assert.deepEqual(stepLeaveRight.audioEvents, ['NIGHTMARE_FOOTSTEPS']);
  // Visible on CAM_4B security camera!
  assert.equal(isAnimatronicVisibleOnCamera(nightmareRight, 'CAM_4B'), true);
  assert.equal(isAnimatronicVisibleOnCamera(nightmareRight, 'CAM_3'), false);

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

  // Also test Left Route (slightly longer: CAM_2A -> CAM_2B -> DOOR_LEFT)
  const stepLeaveLeft = stepAnimatronicMovement(nightmare, openDefense, 1, 0.8);
  assert.equal(stepLeaveLeft.nextState.location, 'CAM_2A');
  assert.equal(isAnimatronicVisibleOnCamera(stepLeaveLeft.nextState, 'CAM_2A'), true);
  assert.deepEqual(stepLeaveLeft.audioEvents, ['NIGHTMARE_FOOTSTEPS']);

  const stepLeft2 = stepAnimatronicMovement(stepLeaveLeft.nextState, openDefense, 1, 0.8);
  assert.equal(stepLeft2.nextState.location, 'CAM_2B');
  assert.equal(isAnimatronicVisibleOnCamera(stepLeft2.nextState, 'CAM_2B'), true);
  assert.deepEqual(stepLeft2.audioEvents, ['NIGHTMARE_FOOTSTEPS']);

  const stepLeftDoor = stepAnimatronicMovement(stepLeft2.nextState, openDefense, 1, 0.8);
  assert.equal(stepLeftDoor.nextState.location, 'DOOR_LEFT');
  assert.deepEqual(stepLeftDoor.audioEvents, ['NIGHTMARE_FOOTSTEPS']);

  // Attacking an open left door triggers NIGHTMARE_JUMPSCARE
  const attackOpenLeft = stepAnimatronicMovement(stepLeftDoor.nextState, openDefense, 1, 0.8);
  assert.equal(attackOpenLeft.triggeredJumpscareBy, 'nightmare');
  assert.deepEqual(attackOpenLeft.audioEvents, ['NIGHTMARE_JUMPSCARE']);
});

test('Post-Night 1 8-Bit Story Minigame: exit dialogue, walk back to car, 4s thunder, hotel phone call, selective trembling, light switch, thinking animation, SI/NO choice & continuous rain phases', async () => {
  const {
    INTRO_DOOR_STOP_X,
    POST_NIGHT_1_CAR_STOP_X,
    POST_NIGHT_1_EXIT_DIALOGUE_TABS,
    POST_NIGHT_1_THUNDER_DELAY_SEC,
    POST_NIGHT_1_GLASS_BREAK_TIME_SEC,
    POST_NIGHT_1_THUNDER_DIALOGUE,
    POST_NIGHT_1_HOTEL_WAKE_DIALOGUE,
    POST_NIGHT_1_HOTEL_PHONE_TABS,
    POST_NIGHT_1_NO_CONSTRUCTION_MESSAGE,
    POST_NIGHT_1_RETURN_DOOR_DIALOGUE,
    HOTEL_PHONE_X,
    HOTEL_LIGHT_SWITCH_X,
    HOTEL_BED_STAND_X,
    isNearHotelPhone,
    isNearHotelLightSwitch,
    isPostNight1RainPhase,
    shouldTriggerPostNight1Minigame,
    stepWalkBackToCar,
  } = await import('./rules');

  // Triggers specifically after Night 1
  assert.equal(shouldTriggerPostNight1Minigame(1), true);
  assert.equal(shouldTriggerPostNight1Minigame(2), false);

  // Continuous rain phase detection across consecutive rain scenes vs hotel interior
  assert.equal(isPostNight1RainPhase('EXIT_BUILDING_DIALOGUE'), true);
  assert.equal(isPostNight1RainPhase('WALK_TO_CAR'), true);
  assert.equal(isPostNight1RainPhase('MOUNT_CAR_FADE_OUT'), true);
  assert.equal(isPostNight1RainPhase('REVERSE_DRIVING_CRUISE'), true);
  assert.equal(isPostNight1RainPhase('REVERSE_DRIVING_BONNIE_SWERVE'), true);
  assert.equal(isPostNight1RainPhase('HOTEL_WAKE_DIALOGUE'), false);
  assert.equal(isPostNight1RainPhase('HOTEL_PHONE_CONVERSATION'), false);
  assert.equal(isPostNight1RainPhase('RETURN_OUTSIDE_WALK'), true);

  // Scene 1: Exit building 2-tab dialogue ("¡NO VUELVO AQUÍ NI LOCO..." -> "¿Qué era esa COSA?" slow & shaking)
  assert.equal(POST_NIGHT_1_EXIT_DIALOGUE_TABS.length, 2);
  assert.equal(
    POST_NIGHT_1_EXIT_DIALOGUE_TABS[0].segments[0].text,
    '¡NO VUELVO AQUÍ NI LOCO, NO VOLVERÉ AQUÍ NUNCA!'
  );
  assert.equal(POST_NIGHT_1_EXIT_DIALOGUE_TABS[1].segments[0].text, '¿Qué era esa ');
  assert.equal(POST_NIGHT_1_EXIT_DIALOGUE_TABS[1].segments[1].text, 'COSA?');
  assert.equal(POST_NIGHT_1_EXIT_DIALOGUE_TABS[1].segments[1].slowTremble, true);

  // Walking left from establishment door (635) reaches car at 210
  const walkStep1 = stepWalkBackToCar(INTRO_DOOR_STOP_X, -1, 0.5);
  assert.ok(walkStep1.x < INTRO_DOOR_STOP_X && !walkStep1.reachedCar);
  const walkToCarDone = stepWalkBackToCar(INTRO_DOOR_STOP_X, -1, 5.0);
  assert.equal(walkToCarDone.x, POST_NIGHT_1_CAR_STOP_X);
  assert.equal(walkToCarDone.reachedCar, true);

  // Scene 2: 4-second thunder delay + "¡QUÉ NOCHE DE PERROS!" + mid-jumpscare glass break timing
  assert.equal(POST_NIGHT_1_THUNDER_DELAY_SEC, 4.0);
  assert.equal(POST_NIGHT_1_GLASS_BREAK_TIME_SEC, 0.45);
  assert.equal(POST_NIGHT_1_THUNDER_DIALOGUE.segments[0].text, '¡QUÉ NOCHE DE PERROS!');

  // Scene 3: Hotel room wake dialogue + light switch & phone proximity + 11 conversation tabs
  assert.equal(
    POST_NIGHT_1_HOTEL_WAKE_DIALOGUE.segments[0].text,
    '¡¿PERO QUÉ COJO...?! ¿DÓNDE ESTOY? ¿QUÉ HA PASADO CON MI COCHE Y CONMIGO?'
  );
  assert.equal(isNearHotelPhone(HOTEL_BED_STAND_X), false);
  assert.equal(isNearHotelPhone(HOTEL_PHONE_X - 20), true);
  assert.equal(isNearHotelLightSwitch(HOTEL_BED_STAND_X), false);
  assert.equal(isNearHotelLightSwitch(HOTEL_LIGHT_SWITCH_X - 15), true);

  assert.equal(POST_NIGHT_1_HOTEL_PHONE_TABS.length, 11);
  assert.equal(POST_NIGHT_1_HOTEL_PHONE_TABS[0].speaker, '???');
  // Tab 4 (index 3) has slightTremble ONLY on "JA, JA, JA", while the rest is still
  assert.equal(POST_NIGHT_1_HOTEL_PHONE_TABS[3].speaker, '???');
  assert.equal(POST_NIGHT_1_HOTEL_PHONE_TABS[3].segments.length, 2);
  assert.equal(POST_NIGHT_1_HOTEL_PHONE_TABS[3].segments[0].text, 'JA, JA, JA');
  assert.equal(POST_NIGHT_1_HOTEL_PHONE_TABS[3].segments[0].slightTremble, true);
  assert.equal(
    POST_NIGHT_1_HOTEL_PHONE_TABS[3].segments[1].text,
    ', me gusta darle una sorpresa a los nuevos empleados.'
  );
  assert.equal(Boolean(POST_NIGHT_1_HOTEL_PHONE_TABS[3].segments[1].slightTremble), false);
  assert.equal(Boolean(POST_NIGHT_1_HOTEL_PHONE_TABS[3].segments[1].slowTremble), false);

  // Tab 5 (index 4) has autoCutOffAfterTyped on "¡SERÁS HIJO DE PU... "
  assert.equal(POST_NIGHT_1_HOTEL_PHONE_TABS[4].autoCutOffAfterTyped, true);
  assert.equal(POST_NIGHT_1_HOTEL_PHONE_TABS[4].segments[0].text, '¡SERÁS HIJO DE PU... ');

  // Tab 10 (index 9) triggers 8-bit thinking animation after "¿Pero cómo sabes eso?"
  assert.equal(
    POST_NIGHT_1_HOTEL_PHONE_TABS[9].thinkingAnimationAfterPrefix,
    '¿Pero cómo sabes eso?'
  );

  // Tab 11 (index 10) has slightTremble ONLY on "JAJAJA" and slowTremble ONLY on "¿ACEPTAS?", while middle phrase is still
  const finalPhoneTab = POST_NIGHT_1_HOTEL_PHONE_TABS[10];
  assert.equal(finalPhoneTab.speaker, '???');
  assert.equal(finalPhoneTab.hasYesNoChoice, true);
  assert.equal(finalPhoneTab.segments.length, 3);
  assert.equal(finalPhoneTab.segments[0].text, 'JAJAJA');
  assert.equal(finalPhoneTab.segments[0].slightTremble, true);
  assert.equal(finalPhoneTab.segments[1].text, ', ¡qué gracioso eres! Bueno, ');
  assert.equal(Boolean(finalPhoneTab.segments[1].slightTremble), false);
  assert.equal(Boolean(finalPhoneTab.segments[1].slowTremble), false);
  assert.equal(finalPhoneTab.segments[2].text, '¿ACEPTAS?');
  assert.equal(finalPhoneTab.segments[2].slowTremble, true);

  // Choosing NO shows construction message
  assert.equal(
    POST_NIGHT_1_NO_CONSTRUCTION_MESSAGE,
    'No puedes hacer eso, aún está en construcción.'
  );

  // Scene 4: Returning outside without car door dialogue
  assert.equal(
    POST_NIGHT_1_RETURN_DOOR_DIALOGUE.segments[0].text,
    'Esto lo hago por ti, hermana. Aguanta un poco más.'
  );
});

test('Night 2 Office Phone Call (skip 3 rings with Enter, irresistible tremble, juguetitos, vivid HASTA MAÑANA JAJAJAJAJA, post-call Capullo), Continue minigame routing, and 5% power drain reduction', async () => {
  const {
    POWER_DRAIN_MULTIPLIER,
    NIGHT_2_PHONE_CALL_TABS,
    NIGHT_2_POST_CALL_MONOLOGUE_TABS,
    advanceNight1OfficeNarrative,
    calculatePowerDrain,
    canSkipPhoneRings,
    getInitialOfficeNarrativeState,
    getMinigameForCampaignNight,
  } = await import('./rules');

  // 1. Additional 5% lower energy consumption (0.85 total multiplier)
  assert.equal(POWER_DRAIN_MULTIPLIER, 0.85);
  const idleDrain = calculatePowerDrain({
    leftDoorClosed: false,
    rightDoorClosed: false,
    ventClosed: false,
    leftLightOn: false,
    rightLightOn: false,
    cameraOpen: false,
  });
  assert.equal(idleDrain.drainPerSecond, Number((0.14 * 0.85).toFixed(5)));

  // 2. Continue button launches corresponding 8-bit minigame for Nights 1, 2, 3, 4, and 5
  assert.equal(getMinigameForCampaignNight(1), 'intro_minigame');
  assert.equal(getMinigameForCampaignNight(2), 'post_night1_minigame');
  assert.equal(getMinigameForCampaignNight(3), 'post_night2_minigame');
  assert.equal(getMinigameForCampaignNight(4), 'post_night3_minigame');
  assert.equal(getMinigameForCampaignNight(5), 'post_night4_minigame');
  assert.equal(getMinigameForCampaignNight(6), null);

  // 3. Night 2 starts directly in PHONE_RINGING and allows skipping the 3 rings with Enter
  assert.equal(canSkipPhoneRings(1), false);
  assert.equal(canSkipPhoneRings(2), true);

  let state = getInitialOfficeNarrativeState(2);
  assert.equal(state.phase, 'PHONE_RINGING');

  // Pressing Enter during PHONE_RINGING on Night 2 skips the 3 rings immediately
  state = advanceNight1OfficeNarrative(state, 'PRESS_ENTER', 2);
  assert.equal(state.phase, 'PHONE_CALL_DIALOGUE');
  assert.equal(state.tabIndex, 0);

  // Verify all 5 tabs of Night 2 phone call
  assert.equal(NIGHT_2_PHONE_CALL_TABS.length, 5);
  assert.equal(NIGHT_2_PHONE_CALL_TABS[0].segments[0].text, 'Vaya, vaya, veo que la oferta era muy ');
  assert.equal(NIGHT_2_PHONE_CALL_TABS[0].segments[1].text, 'irresistible.');
  assert.equal(NIGHT_2_PHONE_CALL_TABS[0].segments[1].slightTremble, true);
  assert.ok(NIGHT_2_PHONE_CALL_TABS[1].segments[0].text.includes('"juguetitos"'));
  assert.ok(NIGHT_2_PHONE_CALL_TABS[2].segments[0].text.includes('arruinarle la sorpresa a mis empleados'));
  assert.ok(NIGHT_2_PHONE_CALL_TABS[3].segments[0].text.includes('hasta las 6:00 A.M.'));
  assert.equal(NIGHT_2_PHONE_CALL_TABS[4].segments[0].text, '¡HASTA MAÑANA, JAJAJAJAJA!');
  assert.equal(NIGHT_2_PHONE_CALL_TABS[4].segments[0].slowTremble, true);
  assert.equal(NIGHT_2_PHONE_CALL_TABS[4].segments[0].vividTremble, true);

  // Advance through tabs 0..4
  for (let i = 0; i < 4; i++) {
    state = advanceNight1OfficeNarrative(state, 'PRESS_ENTER', 2);
    assert.equal(state.phase, 'PHONE_CALL_DIALOGUE');
    assert.equal(state.tabIndex, i + 1);
  }

  // Pressing Enter on the final call tab hangs up and transitions to POST_CALL_MONOLOGUE ("Capullo.")
  state = advanceNight1OfficeNarrative(state, 'PRESS_ENTER', 2);
  assert.equal(state.phase, 'POST_CALL_MONOLOGUE');
  assert.equal(state.tabIndex, 0);
  assert.equal(NIGHT_2_POST_CALL_MONOLOGUE_TABS[0].speaker, 'PROTAGONISTA');
  assert.equal(NIGHT_2_POST_CALL_MONOLOGUE_TABS[0].segments[0].text, 'Capullo.');

  // Pressing Enter on "Capullo." completes the narrative and starts Night 2 normally
  state = advanceNight1OfficeNarrative(state, 'PRESS_ENTER', 2);
  assert.equal(state.phase, 'COMPLETED');
});

test('Custom Night defaults start at 0 and getCustomNightAngerState makes animatronics progressively angrier from 0 to 20', async () => {
  const { DEFAULT_CUSTOM_AI_LEVELS, getCustomNightAngerState } = await import('./rules');

  assert.equal(DEFAULT_CUSTOM_AI_LEVELS.freddy, 0);
  assert.equal(DEFAULT_CUSTOM_AI_LEVELS.bonnie, 0);
  assert.equal(DEFAULT_CUSTOM_AI_LEVELS.chica, 0);
  assert.equal(DEFAULT_CUSTOM_AI_LEVELS.nightmare, 0);
  assert.equal(DEFAULT_CUSTOM_AI_LEVELS.blob, 0);

  const anger0 = getCustomNightAngerState(0);
  const anger5 = getCustomNightAngerState(5);
  const anger10 = getCustomNightAngerState(10);
  const anger15 = getCustomNightAngerState(15);
  const anger20 = getCustomNightAngerState(20);

  assert.equal(anger0.moodLabel, 'INACTIVO');
  assert.equal(anger0.browAngleRad, 0);
  assert.equal(anger5.moodLabel, 'ALERTA');
  assert.equal(anger10.moodLabel, 'HOSTIL');
  assert.equal(anger15.moodLabel, 'CABREADO');
  assert.equal(anger20.moodLabel, 'FURIA TOTAL');

  assert.ok(anger0.browAngleRad < anger5.browAngleRad);
  assert.ok(anger5.browAngleRad < anger10.browAngleRad);
  assert.ok(anger10.browAngleRad < anger15.browAngleRad);
  assert.ok(anger15.browAngleRad < anger20.browAngleRad);
  assert.ok(anger20.shakeAmplitude > anger15.shakeAmplitude);
});

test('Post-Night 2 (Night 3) 8-bit hotel minigame rules: 3 floors, receptionist lines, locked room key dialogue, long hallway camera scroll, 30% faster 5-flicker black Bonnie on 2 & 4, Room 303 stop, and wake dialogue', async () => {
  const {
    FLOOR_3_SINGLE_FLICKER_DURATION_SEC,
    HOTEL_ELEVATOR_DOWN_X,
    HOTEL_ELEVATOR_UP_X,
    HOTEL_EXTERIOR_DOOR_X,
    HOTEL_HALLWAY_VIEWPORT_WIDTH,
    HOTEL_HALLWAY_WORLD_WIDTH,
    HOTEL_RECEPTIONISTS,
    POST_NIGHT_2_FLICKER_DIALOGUE,
    POST_NIGHT_2_ROOM_303_DIALOGUE,
    POST_NIGHT_2_WAKE_DIALOGUE,
    POST_NIGHT_2_WRONG_ROOM_DIALOGUE,
    getFloor3FlickerState,
    getHotelFloorRooms,
    getHotelHallwayCameraX,
    getNearbyHotelHallwayRoom,
    getNearbyReceptionist,
    isNearElevatorDown,
    isNearElevatorUp,
    isNearHotelExteriorDoor,
    shouldTriggerPostNight2Minigame,
  } = await import('./rules');

  // 1. Triggers after Night 2 victory
  assert.equal(shouldTriggerPostNight2Minigame(1), false);
  assert.equal(shouldTriggerPostNight2Minigame(2), true);
  assert.equal(shouldTriggerPostNight2Minigame(3), false);

  // 2. Hotel exterior door proximity [E]
  assert.equal(isNearHotelExteriorDoor(180), false);
  assert.equal(isNearHotelExteriorDoor(HOTEL_EXTERIOR_DOOR_X), true);

  // 3. Receptionists on Floor 1: "Bienvenido al hotel." and "Su habitación es la 303."
  assert.equal(HOTEL_RECEPTIONISTS.length, 2);
  assert.equal(HOTEL_RECEPTIONISTS[0].dialogueText, 'Bienvenido al hotel.');
  assert.equal(HOTEL_RECEPTIONISTS[1].dialogueText, 'Su habitación es la 303.');
  assert.ok(getNearbyReceptionist(HOTEL_RECEPTIONISTS[0].x) !== null);
  assert.equal(getNearbyReceptionist(600), null);

  // 4. Numbered hotel rooms across 3 floors; only 3rd room on Floor 3 (303) is player's room
  const floor1Rooms = getHotelFloorRooms(1);
  const floor2Rooms = getHotelFloorRooms(2);
  const floor3Rooms = getHotelFloorRooms(3);
  assert.deepEqual(
    floor1Rooms.map((r) => r.roomNumber),
    ['101', '102', '103', '104']
  );
  assert.deepEqual(
    floor2Rooms.map((r) => r.roomNumber),
    ['201', '202', '203', '204']
  );
  assert.deepEqual(
    floor3Rooms.map((r) => r.roomNumber),
    ['301', '302', '303', '304']
  );
  assert.equal(floor1Rooms.some((r) => r.isPlayerRoom), false);
  assert.equal(floor2Rooms.some((r) => r.isPlayerRoom), false);
  assert.equal(floor3Rooms[2].roomNumber, '303');
  assert.equal(floor3Rooms[2].isPlayerRoom, true);
  assert.equal(getNearbyHotelHallwayRoom(1, floor1Rooms[0].x)?.roomNumber, '101');
  assert.equal(
    POST_NIGHT_2_WRONG_ROOM_DIALOGUE.segments[0].text,
    'La llave no funciona, esta no es mi habitación.'
  );

  // 5. Long hallway scrolls horizontally from 0 up to (WORLD_WIDTH - VIEWPORT_WIDTH)
  assert.ok(HOTEL_HALLWAY_WORLD_WIDTH > HOTEL_HALLWAY_VIEWPORT_WIDTH);
  assert.equal(getHotelHallwayCameraX(150), 0);
  assert.equal(
    getHotelHallwayCameraX(HOTEL_ELEVATOR_UP_X),
    HOTEL_HALLWAY_WORLD_WIDTH - HOTEL_HALLWAY_VIEWPORT_WIDTH
  );

  // 6. Left elevator goes down, Right elevator goes up
  assert.equal(isNearElevatorDown(HOTEL_ELEVATOR_DOWN_X), true);
  assert.equal(isNearElevatorUp(HOTEL_ELEVATOR_UP_X), true);

  // 7. Floor 3 5-flicker event (~30% faster: 0.36s per cycle) shows black silhouette Bonnie on flicker #2 and flicker #4
  assert.equal(FLOOR_3_SINGLE_FLICKER_DURATION_SEC, 0.36);
  const dur = FLOOR_3_SINGLE_FLICKER_DURATION_SEC;
  const f1 = getFloor3FlickerState(0.5 * dur); // Flicker 1 flash ON phase
  assert.equal(f1.flickerIndex, 1);
  assert.equal(f1.lightOn, true);
  assert.equal(f1.showBlackBonnie, false);

  const f2 = getFloor3FlickerState(dur + 0.5 * dur); // Flicker 2 flash ON phase
  assert.equal(f2.flickerIndex, 2);
  assert.equal(f2.lightOn, true);
  assert.equal(f2.showBlackBonnie, true);

  const f3 = getFloor3FlickerState(2 * dur + 0.5 * dur); // Flicker 3 flash ON phase
  assert.equal(f3.flickerIndex, 3);
  assert.equal(f3.lightOn, true);
  assert.equal(f3.showBlackBonnie, false);

  const f4 = getFloor3FlickerState(3 * dur + 0.5 * dur); // Flicker 4 flash ON phase
  assert.equal(f4.flickerIndex, 4);
  assert.equal(f4.lightOn, true);
  assert.equal(f4.showBlackBonnie, true);

  const f5 = getFloor3FlickerState(4 * dur + 0.5 * dur); // Flicker 5 flash ON phase
  assert.equal(f5.flickerIndex, 5);
  assert.equal(f5.lightOn, true);
  assert.equal(f5.showBlackBonnie, false);

  const fDone = getFloor3FlickerState(5 * dur + 0.05);
  assert.equal(fDone.completed, true);
  assert.equal(fDone.showBlackBonnie, false);

  // 8. Key dialogue lines match exact specifications
  assert.equal(POST_NIGHT_2_FLICKER_DIALOGUE.segments[0].text, '¿Qué era ');
  assert.equal(POST_NIGHT_2_FLICKER_DIALOGUE.segments[1].text, 'ESO');
  assert.equal(POST_NIGHT_2_FLICKER_DIALOGUE.segments[1].slowTremble, true);
  assert.equal(
    POST_NIGHT_2_ROOM_303_DIALOGUE.segments[0].text,
    'Esta es mi habitación. Bueno, supongo que habrá que entrar.'
  );
  assert.equal(
    POST_NIGHT_2_WAKE_DIALOGUE.segments[0].text,
    'Solo 3 noches más, aguanta por favor.'
  );
});

test('Night 3 Office Phone Call: skip rings with Enter, 9 mysterious caller tabs (FIJO AQUÍ tremble, AMIGO MÍO & FAMILIARES glitch, Accidente & JEJEJE tremble, full-tab cuerpo tremble, RICHARD slowTremble), protagonist renamed to RICHARD, and 2 post-call tabs with shrinking text', async () => {
  const {
    NIGHT_3_PHONE_CALL_TABS,
    NIGHT_3_POST_CALL_MONOLOGUE_TABS,
    PROTAGONIST_NAME_FROM_NIGHT_3,
    advanceNight1OfficeNarrative,
    canSkipPhoneRings,
    getInitialOfficeNarrativeState,
    getProtagonistSpeakerName,
  } = await import('./rules');

  // 1. Night 3 allows skipping phone rings with Enter and starts in PHONE_RINGING
  assert.equal(canSkipPhoneRings(3), true);
  let state = getInitialOfficeNarrativeState(3);
  assert.equal(state.phase, 'PHONE_RINGING');

  // Press Enter to skip the 3 rings
  state = advanceNight1OfficeNarrative(state, 'PRESS_ENTER', 3);
  assert.equal(state.phase, 'PHONE_CALL_DIALOGUE');
  assert.equal(state.tabIndex, 0);

  // 2. Verify all 9 tabs of Night 3 phone call
  assert.equal(NIGHT_3_PHONE_CALL_TABS.length, 9);
  assert.ok(
    NIGHT_3_PHONE_CALL_TABS[0].segments[0].text.includes('no esperaba verte esta noche')
  );
  assert.equal(NIGHT_3_PHONE_CALL_TABS[1].segments[1].text, 'FIJO AQUÍ');
  assert.equal(NIGHT_3_PHONE_CALL_TABS[1].segments[1].slightTremble, true);
  assert.equal(NIGHT_3_PHONE_CALL_TABS[2].segments[1].text, 'AMIGO MÍO');
  assert.equal(NIGHT_3_PHONE_CALL_TABS[2].segments[1].glitchText, true);
  assert.ok(
    NIGHT_3_PHONE_CALL_TABS[3].segments[0].text.includes('el gerente que llevaba este local desapareció')
  );
  assert.ok(
    NIGHT_3_PHONE_CALL_TABS[4].segments[0].text.includes('Mi familia compró el local poco después')
  );
  assert.equal(NIGHT_3_PHONE_CALL_TABS[5].segments[1].text, 'FAMILIARES');
  assert.equal(NIGHT_3_PHONE_CALL_TABS[5].segments[1].glitchText, true);
  assert.equal(NIGHT_3_PHONE_CALL_TABS[5].segments[3].text, 'Accidente');
  assert.equal(NIGHT_3_PHONE_CALL_TABS[5].segments[3].slightTremble, true);
  assert.equal(
    NIGHT_3_PHONE_CALL_TABS[6].segments[0].text,
    'Porque nunca encontramos el cuerpo, JAJAJAJA.'
  );
  assert.equal(NIGHT_3_PHONE_CALL_TABS[6].segments[0].slightTremble, true);
  assert.equal(NIGHT_3_PHONE_CALL_TABS[7].segments[1].text, 'JEJEJE.');
  assert.equal(NIGHT_3_PHONE_CALL_TABS[7].segments[1].slightTremble, true);
  assert.equal(
    NIGHT_3_PHONE_CALL_TABS[8].segments[1].text,
    'RICHARD, te están esperando.'
  );
  assert.equal(NIGHT_3_PHONE_CALL_TABS[8].segments[1].slowTremble, true);

  // Advance through all 9 call tabs
  for (let i = 0; i < 8; i++) {
    state = advanceNight1OfficeNarrative(state, 'PRESS_ENTER', 3);
    assert.equal(state.phase, 'PHONE_CALL_DIALOGUE');
    assert.equal(state.tabIndex, i + 1);
  }

  // 3. Pressing Enter on Tab 9 transitions to POST_CALL_MONOLOGUE where speaker is now RICHARD
  state = advanceNight1OfficeNarrative(state, 'PRESS_ENTER', 3);
  assert.equal(state.phase, 'POST_CALL_MONOLOGUE');
  assert.equal(state.tabIndex, 0);

  assert.equal(PROTAGONIST_NAME_FROM_NIGHT_3, 'RICHARD');
  assert.equal(getProtagonistSpeakerName(2), 'PROTAGONISTA');
  assert.equal(getProtagonistSpeakerName(3, false), 'PROTAGONISTA');
  assert.equal(getProtagonistSpeakerName(3, true), 'RICHARD');
  assert.equal(getProtagonistSpeakerName(4), 'RICHARD');

  assert.equal(NIGHT_3_POST_CALL_MONOLOGUE_TABS.length, 2);
  assert.equal(NIGHT_3_POST_CALL_MONOLOGUE_TABS[0].speaker, 'RICHARD');
  assert.equal(
    NIGHT_3_POST_CALL_MONOLOGUE_TABS[0].segments[0].text,
    '¿Có-cómo sabe mi nombre?'
  );

  // Advance to 2nd post-call tab ("Lo hago por mi hermana, lo hago por mi hermana, lo..." with shrinkingText)
  state = advanceNight1OfficeNarrative(state, 'PRESS_ENTER', 3);
  assert.equal(state.phase, 'POST_CALL_MONOLOGUE');
  assert.equal(state.tabIndex, 1);
  assert.equal(NIGHT_3_POST_CALL_MONOLOGUE_TABS[1].speaker, 'RICHARD');
  assert.equal(
    NIGHT_3_POST_CALL_MONOLOGUE_TABS[1].segments[0].text,
    'Lo hago por mi hermana, lo hago por mi hermana, lo...'
  );
  assert.equal(NIGHT_3_POST_CALL_MONOLOGUE_TABS[1].segments[0].shrinkingText, true);

  // Final Enter completes the narrative and starts Night 3 gameplay
  state = advanceNight1OfficeNarrative(state, 'PRESS_ENTER', 3);
  assert.equal(state.phase, 'COMPLETED');
});

test('Post-Night 3 (Night 4) 8-bit minigame rules: hospital nurse & Richard glitched outburst, Floor 2 4-flicker in 1s, Floor 3 7-fast-flickers + slow hand reach + vanish, Hallucinations dialogue, and Room 303 optional phone call with highlighted tab & 2s pause', async () => {
  const {
    FLOOR_2_P3_SINGLE_FLICKER_DURATION_SEC,
    FLOOR_3_P3_FLICKER_TOTAL_COUNT,
    FLOOR_3_P3_HAND_REACH_DURATION_SEC,
    FLOOR_3_P3_SINGLE_FLICKER_DURATION_SEC,
    POST_NIGHT_3_HALLUCINATIONS_DIALOGUE,
    POST_NIGHT_3_HOSPITAL_TABS,
    POST_NIGHT_3_HOTEL_PHONE_TABS,
    POST_NIGHT_3_PHONE_PAUSE_MS,
    getPostNight3Floor2FlickerState,
    getPostNight3Floor3FlickerState,
    shouldTriggerPostNight3Minigame,
  } = await import('./rules');

  // 1. Triggers after Night 3 victory
  assert.equal(shouldTriggerPostNight3Minigame(2), false);
  assert.equal(shouldTriggerPostNight3Minigame(3), true);
  assert.equal(shouldTriggerPostNight3Minigame(4), false);

  // 2. Hospital dialogue tabs (5 tabs: Nurse, Richard, Nurse, Richard Thought, Richard glitched LO NECESITOOOO...)
  assert.equal(POST_NIGHT_3_HOSPITAL_TABS.length, 5);
  assert.equal(POST_NIGHT_3_HOSPITAL_TABS[0].speaker, 'ENFERMERA');
  assert.ok(POST_NIGHT_3_HOSPITAL_TABS[0].segments[0].text.includes('¡Has despertado!'));
  assert.equal(POST_NIGHT_3_HOSPITAL_TABS[1].speaker, 'RICHARD');
  assert.ok(POST_NIGHT_3_HOSPITAL_TABS[1].segments[0].text.includes('tengo los recuerdos difusos'));
  assert.equal(POST_NIGHT_3_HOSPITAL_TABS[2].speaker, 'ENFERMERA');
  assert.ok(POST_NIGHT_3_HOSPITAL_TABS[2].segments[0].text.includes('tienes lesiones'));
  assert.ok(
    POST_NIGHT_3_HOSPITAL_TABS[3].segments[0].text.includes('el tratamiento de tu hermana pequeña')
  );
  assert.equal(POST_NIGHT_3_HOSPITAL_TABS[4].speaker, 'RICHARD');
  assert.ok(
    POST_NIGHT_3_HOSPITAL_TABS[4].segments[1].text.includes('¡LO NECESITOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOO!')
  );
  assert.equal(POST_NIGHT_3_HOSPITAL_TABS[4].segments[1].glitchText, true);

  // 3. Floor 2: 4 flickers in 1.0 second (0.25s each), showing dark rabbit on flicker 2 ('far') and flicker 4 ('closer')
  assert.equal(FLOOR_2_P3_SINGLE_FLICKER_DURATION_SEC, 0.25);
  const f2_1 = getPostNight3Floor2FlickerState(0.125);
  assert.equal(f2_1.flickerIndex, 1);
  assert.equal(f2_1.showBlackBonnie, false);

  const f2_2 = getPostNight3Floor2FlickerState(0.25 + 0.125);
  assert.equal(f2_2.flickerIndex, 2);
  assert.equal(f2_2.showBlackBonnie, true);
  assert.equal(f2_2.distanceStage, 'far');

  const f2_3 = getPostNight3Floor2FlickerState(0.5 + 0.125);
  assert.equal(f2_3.flickerIndex, 3);
  assert.equal(f2_3.showBlackBonnie, false);

  const f2_4 = getPostNight3Floor2FlickerState(0.75 + 0.125);
  assert.equal(f2_4.flickerIndex, 4);
  assert.equal(f2_4.showBlackBonnie, true);
  assert.equal(f2_4.distanceStage, 'closer');

  const f2_done = getPostNight3Floor2FlickerState(1.05);
  assert.equal(f2_done.completed, true);
  assert.equal(f2_done.showBlackBonnie, false);

  // 4. Floor 3: 7 fast flickers approaching on 3 ('far'), 5 ('mid'), 7 ('close') -> slow hand reach -> final vanish flicker
  const d3 = FLOOR_3_P3_SINGLE_FLICKER_DURATION_SEC;
  const f3_3 = getPostNight3Floor3FlickerState(2 * d3 + 0.5 * d3);
  assert.equal(f3_3.flickerIndex, 3);
  assert.equal(f3_3.showBlackBonnie, true);
  assert.equal(f3_3.distanceStage, 'far');

  const f3_5 = getPostNight3Floor3FlickerState(4 * d3 + 0.5 * d3);
  assert.equal(f3_5.flickerIndex, 5);
  assert.equal(f3_5.showBlackBonnie, true);
  assert.equal(f3_5.distanceStage, 'mid');

  const f3_7 = getPostNight3Floor3FlickerState(6 * d3 + 0.5 * d3);
  assert.equal(f3_7.flickerIndex, 7);
  assert.equal(f3_7.showBlackBonnie, true);
  assert.equal(f3_7.distanceStage, 'close');

  assert.equal(FLOOR_3_P3_HAND_REACH_DURATION_SEC, 1.7);
  const handReachMid = getPostNight3Floor3FlickerState(
    FLOOR_3_P3_FLICKER_TOTAL_COUNT * d3 + FLOOR_3_P3_HAND_REACH_DURATION_SEC * 0.5
  );
  assert.equal(handReachMid.showBlackBonnie, true);
  assert.equal(handReachMid.distanceStage, 'close');
  assert.ok(handReachMid.handReachProgress > 0.4 && handReachMid.handReachProgress < 0.6);

  const f3_done = getPostNight3Floor3FlickerState(
    FLOOR_3_P3_FLICKER_TOTAL_COUNT * d3 + FLOOR_3_P3_HAND_REACH_DURATION_SEC + 0.35
  );
  assert.equal(f3_done.completed, true);
  assert.equal(f3_done.showBlackBonnie, false);

  // 5. Hallucinations dialogue & Room 303 optional phone call tabs
  assert.equal(POST_NIGHT_3_HALLUCINATIONS_DIALOGUE.speaker, 'RICHARD');
  assert.equal(
    POST_NIGHT_3_HALLUCINATIONS_DIALOGUE.segments[0].text,
    'Alucinaciones, sí, eso, tiene que ser eso.'
  );

  assert.equal(POST_NIGHT_3_HOTEL_PHONE_TABS.length, 8);
  assert.equal(POST_NIGHT_3_HOTEL_PHONE_TABS[1].segments[0].highlightedText, true);
  assert.ok(
    POST_NIGHT_3_HOTEL_PHONE_TABS[1].segments[0].text.includes('TIENES QUE BUSCAR EN EL LOCAL UNOS PAPELES')
  );
  assert.equal(POST_NIGHT_3_HOTEL_PHONE_TABS[3].speaker, 'RICHARD');
  assert.equal(POST_NIGHT_3_HOTEL_PHONE_TABS[4].pauseBeforeShowMs, POST_NIGHT_3_PHONE_PAUSE_MS);
  assert.equal(POST_NIGHT_3_PHONE_PAUSE_MS, 2000);
  assert.equal(
    POST_NIGHT_3_HOTEL_PHONE_TABS[5].segments[1].text,
    'Tu futuro puede llegar a depender de esto.'
  );
  assert.equal(POST_NIGHT_3_HOTEL_PHONE_TABS[5].segments[1].slowTremble, true);
  assert.equal(POST_NIGHT_3_HOTEL_PHONE_TABS[6].speaker, 'RICHARD');
  assert.ok(
    POST_NIGHT_3_HOTEL_PHONE_TABS[7].segments[0].text.includes('¡JAJAJA, ESO ES LO QUE QUERÍA OÍR!')
  );
});

test('Night 4 Office Phone Call (6 tabs, juguetitos tremble, JUGOSA tremble, TODO ACABA largeTremble, immediate completion), 1.5s Floor 3 thinking pause, and non-overlapping hotel room door vs light switch ranges', async () => {
  const {
    HOTEL_CENTRAL_DOOR_X,
    HOTEL_LIGHT_SWITCH_X,
    NIGHT_4_PHONE_CALL_TABS,
    POST_NIGHT_3_FLOOR_3_THINKING_DURATION_SEC,
    advanceNight1OfficeNarrative,
    canSkipPhoneRings,
    getInitialOfficeNarrativeState,
    getOfficeCallTabs,
    getOfficePostCallMonologueTabs,
    isNearHotelLightSwitch,
    isNearHotelRoomCentralDoor,
  } = await import('./rules');

  // 1. 1.5s Floor 3 thinking pause after the rabbit vanishes before Richard speaks
  assert.equal(POST_NIGHT_3_FLOOR_3_THINKING_DURATION_SEC, 1.5);

  // 2. Hotel room light switch range never overlaps the central exit door
  assert.equal(isNearHotelRoomCentralDoor(HOTEL_CENTRAL_DOOR_X), true);
  assert.equal(isNearHotelLightSwitch(HOTEL_CENTRAL_DOOR_X), false);
  assert.equal(isNearHotelLightSwitch(HOTEL_LIGHT_SWITCH_X), true);
  assert.equal(isNearHotelRoomCentralDoor(HOTEL_LIGHT_SWITCH_X), false);
  for (let px = 200; px <= 750; px++) {
    const bothActive = isNearHotelRoomCentralDoor(px) && isNearHotelLightSwitch(px);
    assert.equal(
      bothActive,
      false,
      `Door and light switch must never overlap at playerX=${px}`
    );
  }

  // 3. Night 4 office phone call starts in PHONE_RINGING, allows skipping rings with Enter, has 6 tabs, and finishes immediately after Tab 6
  assert.equal(canSkipPhoneRings(4), true);
  assert.equal(getOfficeCallTabs(4), NIGHT_4_PHONE_CALL_TABS);
  assert.equal(getOfficePostCallMonologueTabs(4).length, 0);

  let state = getInitialOfficeNarrativeState(4);
  assert.equal(state.phase, 'PHONE_RINGING');

  // Skip phone rings with Enter
  state = advanceNight1OfficeNarrative(state, 'PRESS_ENTER', 4);
  assert.equal(state.phase, 'PHONE_CALL_DIALOGUE');
  assert.equal(state.tabIndex, 0);

  assert.equal(NIGHT_4_PHONE_CALL_TABS.length, 6);
  // Tab 1: "juguetitos" with slightTremble
  assert.ok(
    NIGHT_4_PHONE_CALL_TABS[0].segments[0].text.includes(
      'Bien, bien, te explicaré tu trabajo esta noche'
    )
  );
  assert.equal(NIGHT_4_PHONE_CALL_TABS[0].segments[1].text, 'juguetitos');
  assert.equal(NIGHT_4_PHONE_CALL_TABS[0].segments[1].slightTremble, true);

  // Tab 2: "cámara 05"
  assert.ok(NIGHT_4_PHONE_CALL_TABS[1].segments[0].text.includes('cámara 05'));

  // Tab 3: "cámara 04"
  assert.ok(NIGHT_4_PHONE_CALL_TABS[2].segments[0].text.includes('cámara 04'));

  // Tab 4: "JUGOSA" with slowTremble
  assert.ok(
    NIGHT_4_PHONE_CALL_TABS[3].segments[0].text.includes('Esos papeles son de vital importancia')
  );
  assert.equal(NIGHT_4_PHONE_CALL_TABS[3].segments[1].text, 'JUGOSA');
  assert.equal(NIGHT_4_PHONE_CALL_TABS[3].segments[1].slowTremble, true);

  // Tab 5: "disfruta de la noche"
  assert.ok(NIGHT_4_PHONE_CALL_TABS[4].segments[0].text.includes('disfruta de la noche'));

  // Tab 6: "TODO ACABA" with largeTremble + ", ji ji ji ji ji ji..."
  assert.equal(NIGHT_4_PHONE_CALL_TABS[5].segments[0].text, 'Seguro que mañana ');
  assert.equal(NIGHT_4_PHONE_CALL_TABS[5].segments[1].text, 'TODO ACABA');
  assert.equal(NIGHT_4_PHONE_CALL_TABS[5].segments[1].largeTremble, true);
  assert.equal(NIGHT_4_PHONE_CALL_TABS[5].segments[2].text, ', ji ji ji ji ji ji...');

  // Advance through Tabs 0..5
  for (let i = 0; i < 5; i++) {
    state = advanceNight1OfficeNarrative(state, 'PRESS_ENTER', 4);
    assert.equal(state.phase, 'PHONE_CALL_DIALOGUE');
    assert.equal(state.tabIndex, i + 1);
  }

  // Pressing Enter on Tab 6 (index 5) completes the Night 4 phone call immediately
  state = advanceNight1OfficeNarrative(state, 'PRESS_ENTER', 4);
  assert.equal(state.phase, 'COMPLETED');
});

test('Night 4 Secret Closet & 4-Key Puzzle: pseudo-random 3-digit office notes, keypad unlock, timed key spawns (12AM CAM_4B, 2AM CAM_1A/1B, 3AM CAM_3, 4:30AM CAM_2A/2B), top-to-bottom 4 locks, door handle, and secret papers', async () => {
  const {
    NIGHT_4_KEY_PICKUP_TEXT,
    areAllNight4LocksUnlocked,
    attemptOpenNight4HiddenDoor,
    attemptUnlockNight4DoorLock,
    collectNight4Key,
    collectNight4SecretPapers,
    createInitialNight4PuzzleState,
    enterNight4KeypadDigit,
    generateNight4SecretCode,
    getNextLockedNight4DoorLock,
    getNight4OfficeNotes,
    getVisibleNight4KeyOnCamera,
    isNight4KeySpawned,
  } = await import('./rules');

  // 1. Pseudo-random 3-digit code generation produces valid 3-digit codes that vary across RNG seeds
  const codeA = generateNight4SecretCode(() => 0.15);
  const codeB = generateNight4SecretCode(() => 0.75);
  assert.match(codeA, /^\d{3}$/);
  assert.match(codeB, /^\d{3}$/);
  assert.notEqual(codeA, codeB);

  const dynamicNotes = getNight4OfficeNotes(codeA);
  assert.equal(dynamicNotes.length, 3);
  assert.equal(dynamicNotes[0].order, 1);
  assert.equal(dynamicNotes[0].digit, codeA[0]);
  assert.equal(dynamicNotes[1].order, 2);
  assert.equal(dynamicNotes[1].digit, codeA[1]);
  assert.equal(dynamicNotes[2].order, 3);
  assert.equal(dynamicNotes[2].digit, codeA[2]);
  assert.equal(NIGHT_4_KEY_PICKUP_TEXT, 'llave recogida');

  // 2. Create initial puzzle state (key2Roll=0.2 -> CAM_1A, key4Roll=0.8 -> CAM_2B, pseudo-random code from RNG)
  let state = createInitialNight4PuzzleState(true, 0.2, 0.8, () => 0.75);
  assert.equal(state.active, true);
  assert.equal(state.secretCode, codeB);
  assert.equal(state.keyLocations[1], 'CAM_4B');
  assert.equal(state.keyLocations[2], 'CAM_1A');
  assert.equal(state.keyLocations[3], 'CAM_3');
  assert.equal(state.keyLocations[4], 'CAM_2B');
  assert.equal(state.closetUnlocked, false);

  const hourSec = 51;

  // 3. Key spawn schedule:
  // - Key 1: 12:00 AM (0s) in CAM_4B
  // - Key 2: 2:00 AM (102s) in CAM_1A or CAM_1B
  // - Key 3: 3:00 AM (153s) in CAM_3
  // - Key 4: 4:30 AM (229.5s) in CAM_2A or CAM_2B
  assert.equal(isNight4KeySpawned(1, 0, hourSec), true);
  assert.equal(isNight4KeySpawned(2, 101, hourSec), false);
  assert.equal(isNight4KeySpawned(2, 102, hourSec), true);
  assert.equal(isNight4KeySpawned(3, 152, hourSec), false);
  assert.equal(isNight4KeySpawned(3, 153, hourSec), true);
  assert.equal(isNight4KeySpawned(4, 229, hourSec), false);
  assert.equal(isNight4KeySpawned(4, 229.5, hourSec), true);

  // Check visible keys on cameras before collection
  assert.equal(getVisibleNight4KeyOnCamera(state, 'CAM_4B', 0, hourSec), 1);
  assert.equal(getVisibleNight4KeyOnCamera(state, 'CAM_1A', 50, hourSec), null);
  assert.equal(getVisibleNight4KeyOnCamera(state, 'CAM_1A', 102, hourSec), 2);
  assert.equal(getVisibleNight4KeyOnCamera(state, 'CAM_3', 153, hourSec), 3);
  assert.equal(getVisibleNight4KeyOnCamera(state, 'CAM_2B', 229.5, hourSec), 4);

  // 4. Enter wrong code first ("000") -> sets keypadError and keeps closet locked
  let kp = enterNight4KeypadDigit(state, '0');
  kp = enterNight4KeypadDigit(kp.nextState, '0');
  kp = enterNight4KeypadDigit(kp.nextState, '0');
  assert.equal(kp.triggeredWrongCode, true);
  assert.equal(kp.justUnlockedCloset, false);
  assert.equal(kp.nextState.closetUnlocked, false);
  assert.equal(kp.nextState.keypadError, true);

  // Enter the run's pseudo-random 3-digit secretCode -> unlocks closet in CAM 05
  kp = enterNight4KeypadDigit(kp.nextState, state.secretCode[0]);
  kp = enterNight4KeypadDigit(kp.nextState, state.secretCode[1]);
  kp = enterNight4KeypadDigit(kp.nextState, state.secretCode[2]);
  assert.equal(kp.justUnlockedCloset, true);
  assert.equal(kp.nextState.closetUnlocked, true);
  state = { ...kp.nextState, closetOpenProgress: 1 };

  // 5. Attempting to unlock Lock 1 without Key 1 shakes the lock and screen
  assert.equal(getNextLockedNight4DoorLock(state), 1);
  const tryWithoutKey = attemptUnlockNight4DoorLock(state, 1);
  assert.equal(tryWithoutKey.unlocked, false);
  assert.equal(tryWithoutKey.triggerShake, true);

  // Collect Key 1 and Key 2
  state = collectNight4Key(state, 1);
  state = collectNight4Key(state, 2);
  assert.equal(getVisibleNight4KeyOnCamera(state, 'CAM_4B', 0, hourSec), null);

  // Attempting to unlock Lock 2 before Lock 1 (out of top-to-bottom sequence) shakes the lock
  const tryOutOfOrder = attemptUnlockNight4DoorLock(state, 2);
  assert.equal(tryOutOfOrder.unlocked, false);
  assert.equal(tryOutOfOrder.triggerShake, true);

  // Unlock Lock 1 (top) with Key 1 -> succeeds!
  const unlock1 = attemptUnlockNight4DoorLock(state, 1);
  assert.equal(unlock1.unlocked, true);
  assert.equal(unlock1.triggerShake, false);
  state = unlock1.nextState;
  assert.equal(getNextLockedNight4DoorLock(state), 2);

  // Unlock Lock 2 with Key 2 -> succeeds!
  const unlock2 = attemptUnlockNight4DoorLock(state, 2);
  assert.equal(unlock2.unlocked, true);
  state = unlock2.nextState;

  // Door handle cannot open the hidden door while Locks 3 and 4 are still locked
  assert.equal(areAllNight4LocksUnlocked(state), false);
  assert.equal(attemptOpenNight4HiddenDoor(state).opened, false);

  // Collect Keys 3 & 4 and unlock Locks 3 & 4 in sequence
  state = collectNight4Key(state, 3);
  state = collectNight4Key(state, 4);
  state = attemptUnlockNight4DoorLock(state, 3).nextState;
  state = attemptUnlockNight4DoorLock(state, 4).nextState;
  assert.equal(areAllNight4LocksUnlocked(state), true);

  // 6. Click door handle (manillar) -> opens hidden door, then click secret papers -> collects them
  const openDoorRes = attemptOpenNight4HiddenDoor(state);
  assert.equal(openDoorRes.opened, true);
  state = { ...openDoorRes.nextState, hiddenDoorOpenProgress: 1 };
  assert.equal(state.hiddenDoorOpen, true);

  const papersRes = collectNight4SecretPapers(state);
  assert.equal(papersRes.collected, true);
  assert.equal(papersRes.nextState.papersCollected, true);
});

test('Post-Night 3 Interlude Refinements: 3D corridor prop progression leaves objects behind, jumpscare audio sync, and slower halting rabbit drag ("a trompicones")', async () => {
  const {
    POST_NIGHT_3_BLACKOUT_MIN_DURATION_SEC,
    POST_NIGHT_3_JUMPSCARE_AUDIO_DURATION_SEC,
    POST_NIGHT_3_JUMPSCARE_VISUAL_DURATION_SEC,
    POST_NIGHT_3_RABBIT_DRAG_DURATION_SEC,
    getPostNight3RabbitDragState,
    projectFirstPersonCorridorProp,
  } = await import('./rules');

  // 1. Jumpscare visual + blackout duration covers the full 3.66s jumpscare scream before rabbit drag starts
  assert.equal(POST_NIGHT_3_JUMPSCARE_AUDIO_DURATION_SEC, 3.66);
  assert.equal(POST_NIGHT_3_JUMPSCARE_VISUAL_DURATION_SEC, 3.15);
  assert.ok(
    POST_NIGHT_3_JUMPSCARE_VISUAL_DURATION_SEC + POST_NIGHT_3_BLACKOUT_MIN_DURATION_SEC >=
      POST_NIGHT_3_JUMPSCARE_AUDIO_DURATION_SEC
  );

  // 2. 3D corridor perspective projection moves wall/ceiling props outward and leaves them behind as player walks forward
  const posterAtStart = projectFirstPersonCorridorProp(0.34, 0, false);
  const paperPalAtStart = projectFirstPersonCorridorProp(0.68, 0, false);
  const fuseBoxAtStart = projectFirstPersonCorridorProp(1.06, 0, false);

  assert.equal(posterAtStart.visible, true);
  assert.equal(paperPalAtStart.visible, true);
  assert.ok(posterAtStart.wallT > paperPalAtStart.wallT); // Closer prop has larger wallT

  // At mid-corridor (fpProgress = 0.5), the framed poster (z=0.34) is already behind the player!
  const posterAtMid = projectFirstPersonCorridorProp(0.34, 0.5, false);
  const paperPalAtMid = projectFirstPersonCorridorProp(0.68, 0.5, false);
  assert.equal(posterAtMid.visible, false);
  assert.ok(posterAtMid.wallT > 1);
  assert.equal(paperPalAtMid.visible, true);
  assert.ok(paperPalAtMid.wallT > paperPalAtStart.wallT); // Paper-plate pal moved closer/outward

  // At the door (fpProgress = 1.0), both the poster (z=0.34) and paper-plate pal (z=0.68) have been left behind,
  // while the fuse box near the door (z=1.06) is now close and visible on the wall
  const posterAtDoor = projectFirstPersonCorridorProp(0.34, 1.0, false);
  const paperPalAtDoor = projectFirstPersonCorridorProp(0.68, 1.0, false);
  const fuseBoxAtDoor = projectFirstPersonCorridorProp(1.06, 1.0, false);
  assert.equal(posterAtDoor.visible, false);
  assert.equal(paperPalAtDoor.visible, false);
  assert.equal(fuseBoxAtDoor.visible, true);
  assert.ok(fuseBoxAtDoor.scale > fuseBoxAtStart.scale);

  // 3. Slower, halting ("a trompicones") rabbit drag over 6.4 seconds
  assert.equal(POST_NIGHT_3_RABBIT_DRAG_DURATION_SEC, 6.4);
  const dragStart = getPostNight3RabbitDragState(0);
  assert.equal(dragStart.progress, 0);
  assert.equal(dragStart.completed, false);

  // Cycle duration is 6.4 / 7 ≈ 0.914s.
  // At 20% of cycle 1 (~0.18s), rabbit is in the slow strain/pause phase (isHeaving = false)
  const strainPhase = getPostNight3RabbitDragState(0.18);
  assert.equal(strainPhase.isHeaving, false);

  // At 60% of cycle 1 (~0.55s), rabbit is in the sharp heave/yank phase (isHeaving = true, leaning left)
  const heavePhase = getPostNight3RabbitDragState(0.55);
  assert.equal(heavePhase.isHeaving, true);
  assert.ok(heavePhase.rabbitLeanX < -2);
  assert.ok(heavePhase.rabbitX < strainPhase.rabbitX);

  const dragEnd = getPostNight3RabbitDragState(6.4);
  assert.equal(dragEnd.progress, 1);
  assert.equal(dragEnd.completed, true);
});

test('Post-Night 4 (Night 5) 8-bit interlude rules: 0.5s black + 1s open holds + 3rd blink dark rabbit (5.45s), 3.1s fast jumpscare with 2.0s distortion & 2.5s fade-to-black, 1.75s The Thing reveal, tied-to-chair handover prompt, speaker ??? until SOMOS THE THING, Still Freddy 1s pause, and fading/trembling final line', async () => {
  const {
    POST_NIGHT_4_BLINK_INITIAL_BLACK_SEC,
    POST_NIGHT_4_BLINK_OPEN_HOLD_SEC,
    POST_NIGHT_4_BLINK_TOTAL_DURATION_SEC,
    POST_NIGHT_4_CHAIR_INITIAL_DIALOGUE,
    POST_NIGHT_4_CHAIR_POST_HANDOVER_DIALOGUE,
    POST_NIGHT_4_FINAL_GOOD_LUCK_TAB,
    POST_NIGHT_4_FREDDY_POST_EMERGE_PAUSE_SEC,
    POST_NIGHT_4_HAND_OVER_PROMPT_TEXT,
    POST_NIGHT_4_RABBIT_DISTORTION_START_SEC,
    POST_NIGHT_4_RABBIT_FADE_START_SEC,
    POST_NIGHT_4_RABBIT_JUMPSCARE_DURATION_SEC,
    POST_NIGHT_4_THE_THING_APPROACH_DURATION_SEC,
    POST_NIGHT_4_THE_THING_REVEAL_TABS,
    getPostNight4BlinkState,
    getPostNight4RabbitJumpscareState,
    getPostNight4RevealSpeakerName,
    shouldTriggerPostNight4Minigame,
  } = await import('./rules');

  // 1. Triggers after Night 4 victory & 2.6s The Thing reveal from the gloom
  assert.equal(shouldTriggerPostNight4Minigame(3), false);
  assert.equal(shouldTriggerPostNight4Minigame(4), true);
  assert.equal(shouldTriggerPostNight4Minigame(5), false);
  assert.equal(POST_NIGHT_4_THE_THING_APPROACH_DURATION_SEC, 2.6);

  // 2. Pre-sleep bed sequence:
  // - 0.00s..0.50s: black screen (eyes closed = 1)
  // - 0.50s..0.90s: opening eyes
  // - 0.90s..1.90s: 1.0s eyes open
  // - 1.90s..2.40s: Blink 1
  // - 2.40s..3.40s: 1.0s eyes open
  // - 3.40s..3.90s: Blink 2
  // - 3.90s..4.90s: 1.0s eyes open
  // - 4.90s..5.45s: Blink 3 -> Dark Rabbit appears!
  assert.equal(POST_NIGHT_4_BLINK_INITIAL_BLACK_SEC, 0.5);
  assert.equal(POST_NIGHT_4_BLINK_OPEN_HOLD_SEC, 1.0);
  assert.equal(POST_NIGHT_4_BLINK_TOTAL_DURATION_SEC, 5.45);

  const initialBlack = getPostNight4BlinkState(0.25);
  assert.equal(initialBlack.eyelidClosure, 1);
  assert.equal(initialBlack.showDarkRabbit, false);

  const openHold1 = getPostNight4BlinkState(1.40);
  assert.equal(openHold1.eyelidClosure, 0);
  assert.equal(openHold1.showDarkRabbit, false);

  const blink1 = getPostNight4BlinkState(2.15);
  assert.equal(blink1.blinkNumber, 1);
  assert.ok(blink1.eyelidClosure > 0.7);
  assert.equal(blink1.showDarkRabbit, false);

  const openHold2 = getPostNight4BlinkState(2.90);
  assert.equal(openHold2.eyelidClosure, 0);
  assert.equal(openHold2.showDarkRabbit, false);

  const blink2 = getPostNight4BlinkState(3.65);
  assert.equal(blink2.blinkNumber, 2);
  assert.ok(blink2.eyelidClosure > 0.7);
  assert.equal(blink2.showDarkRabbit, false);

  const openHold3 = getPostNight4BlinkState(4.40);
  assert.equal(openHold3.eyelidClosure, 0);
  assert.equal(openHold3.showDarkRabbit, false);

  const blink3Closed = getPostNight4BlinkState(5.16);
  assert.equal(blink3Closed.blinkNumber, 3);
  assert.ok(blink3Closed.eyelidClosure > 0.7);
  assert.equal(blink3Closed.showDarkRabbit, true);

  const blink3OpenWithRabbit = getPostNight4BlinkState(5.38);
  assert.equal(blink3OpenWithRabbit.blinkNumber, 3);
  assert.equal(blink3OpenWithRabbit.showDarkRabbit, true);
  assert.equal(blink3OpenWithRabbit.completed, false);

  const blinkDone = getPostNight4BlinkState(5.45);
  assert.equal(blinkDone.completed, true);
  assert.equal(blinkDone.showDarkRabbit, true);

  // 2B. Faster Dark Rabbit jumpscare synced to Jumpscare_dark_rabbit_final (3.1s total):
  // - 0.00s..0.08s: coil
  // - 0.08s..0.28s: fast leap across the bed
  // - 2.00s: distortion effect begins
  // - 2.50s: fade to black begins
  assert.equal(POST_NIGHT_4_RABBIT_JUMPSCARE_DURATION_SEC, 3.1);
  assert.equal(POST_NIGHT_4_RABBIT_DISTORTION_START_SEC, 2.0);
  assert.equal(POST_NIGHT_4_RABBIT_FADE_START_SEC, 2.5);

  const jsCoil = getPostNight4RabbitJumpscareState(0.04);
  const jsLeap = getPostNight4RabbitJumpscareState(0.18);
  const jsEarlyMaul = getPostNight4RabbitJumpscareState(1.20);
  const jsDistortion = getPostNight4RabbitJumpscareState(2.20);
  const jsFadeBlack = getPostNight4RabbitJumpscareState(2.75);
  const jsEnd = getPostNight4RabbitJumpscareState(3.10);

  assert.equal(jsCoil.stage, 'COIL_AT_BED_FOOT');
  assert.equal(jsLeap.stage, 'LEAP_ACROSS_BED');
  assert.equal(jsEarlyMaul.stage, 'MAUL_AND_SCREECH_CLIMAX');
  assert.equal(jsEarlyMaul.distortionActive, false);
  assert.equal(jsEarlyMaul.blackoutAlpha, 0);

  assert.equal(jsDistortion.distortionActive, true);
  assert.equal(jsDistortion.blackoutAlpha, 0);
  assert.ok(jsDistortion.shakeAmplitude > jsEarlyMaul.shakeAmplitude);

  assert.equal(jsFadeBlack.distortionActive, true);
  assert.ok(jsFadeBlack.blackoutAlpha > 0.4 && jsFadeBlack.blackoutAlpha < 1);
  assert.equal(jsEnd.blackoutAlpha, 1);
  assert.equal(jsEnd.completed, true);

  // 3. Tied to a chair initial dialogue, [E] handover prompt, and post-handover dialogue
  assert.equal(POST_NIGHT_4_CHAIR_INITIAL_DIALOGUE.speaker, '???');
  assert.ok(
    POST_NIGHT_4_CHAIR_INITIAL_DIALOGUE.segments[0].text.includes(
      'veo que has recuperado mis documentos, dámelos.'
    )
  );
  assert.equal(POST_NIGHT_4_HAND_OVER_PROMPT_TEXT, 'Pulsa E para entregarle los documentos');
  assert.equal(
    POST_NIGHT_4_CHAIR_POST_HANDOVER_DIALOGUE.segments[0].text,
    'Bien, bien, veo que ya va siendo hora de que te lo cuente.'
  );

  // 4. First-person reveal of The Thing & tape rip dialogue (6 tabs):
  // Speaker stays '???' on Tab 0 ("Bien, bien, ¿y qué te parece mi aspecto?") and while typing "Yo, soy, " on Tab 2,
  // switching to 'THE THING' only when "SOMOS, THE THING" is spoken!
  assert.equal(POST_NIGHT_4_THE_THING_REVEAL_TABS.length, 6);
  assert.equal(POST_NIGHT_4_THE_THING_REVEAL_TABS[0].speaker, '???');
  assert.equal(getPostNight4RevealSpeakerName(0, 99), '???');
  assert.equal(
    POST_NIGHT_4_THE_THING_REVEAL_TABS[0].segments[0].text,
    'Bien, bien, ¿y qué te parece mi aspecto?'
  );
  assert.equal(POST_NIGHT_4_THE_THING_REVEAL_TABS[1].speaker, 'RICHARD');
  assert.equal(getPostNight4RevealSpeakerName(1, 99), 'RICHARD');
  assert.ok(
    POST_NIGHT_4_THE_THING_REVEAL_TABS[1].segments[0].text.includes('¿Un matojo de cables mugrientos?')
  );
  assert.equal(getPostNight4RevealSpeakerName(2, 4), '???');
  assert.equal(getPostNight4RevealSpeakerName(2, 12), 'THE THING');
  assert.equal(POST_NIGHT_4_THE_THING_REVEAL_TABS[2].segments[1].text, 'SOMOS, THE THING');
  assert.equal(POST_NIGHT_4_THE_THING_REVEAL_TABS[2].segments[1].glitchText, true);
  assert.equal(
    POST_NIGHT_4_THE_THING_REVEAL_TABS[3].segments[1].text,
    'mi billete / nuestro billete'
  );
  assert.equal(POST_NIGHT_4_THE_THING_REVEAL_TABS[3].segments[1].glitchText, true);
  assert.ok(
    POST_NIGHT_4_THE_THING_REVEAL_TABS[4].segments[0].text.includes(
      'serás una gran adición a mi familia.'
    )
  );
  assert.equal(
    POST_NIGHT_4_THE_THING_REVEAL_TABS[5].segments[0].text,
    '¿Verdad que sí, hermano?'
  );

  // 5. Still Freddy emerges from the shadows + 1s pause + fading/trembling final line
  assert.equal(POST_NIGHT_4_FREDDY_POST_EMERGE_PAUSE_SEC, 1.0);
  assert.equal(POST_NIGHT_4_FINAL_GOOD_LUCK_TAB.speaker, 'THE THING');
  assert.equal(POST_NIGHT_4_FINAL_GOOD_LUCK_TAB.segments[0].text, 'Qué ganas tengo de jugar, ');
  assert.equal(
    POST_NIGHT_4_FINAL_GOOD_LUCK_TAB.segments[1].text,
    'QUE TENGAS MUUUCHA SUERTEE..............'
  );
  assert.equal(POST_NIGHT_4_FINAL_GOOD_LUCK_TAB.segments[1].slightTremble, true);
  assert.equal(POST_NIGHT_4_FINAL_GOOD_LUCK_TAB.segments[1].fadingText, true);
});

test('Night 5 The Thing refinements: 10% slower movement cooldown (3.63s), 0.5s natural corridor flicker visibility on ONLY SOME flickers, and destroyed animatronic corpses in initial rooms', async () => {
  const {
    THE_THING_BASE_MOVE_COOLDOWN_SEC,
    THE_THING_CORRIDOR_FLICKER_CYCLE_SEC,
    THE_THING_CORRIDOR_FLICKER_VISIBLE_DURATION_SEC,
    apply3AMPhaseShift,
    createInitialAnimatronics,
    getNightConfig,
    getTheThingCorridorFlickerState,
    shouldShowDestroyedAnimatronicCorpses,
  } = await import('./rules');

  // 1. The Thing is 10% slower (3.3s * 1.10 = 3.63s)
  assert.equal(THE_THING_BASE_MOVE_COOLDOWN_SEC, 3.63);
  const night5Anims = createInitialAnimatronics(getNightConfig(5));
  assert.equal(night5Anims.blob.moveCooldown, 3.63);

  // 2. Natural hallway light flickers every cycle, and The Thing appears for 0.5s during ONLY SOME flickers (1 out of 4)
  assert.equal(THE_THING_CORRIDOR_FLICKER_VISIBLE_DURATION_SEC, 0.5);
  assert.equal(THE_THING_CORRIDOR_FLICKER_CYCLE_SEC, 1.25);

  // For Left corridor: flickerIndex 1 (t = 1 * 1.25 = 1.25 .. 1.75) is a selected 0.5s flicker
  const leftFlickerSelected = getTheThingCorridorFlickerState(1.40, 'left', 100);
  assert.equal(leftFlickerSelected.corridorLit, true);
  assert.equal(leftFlickerSelected.showTheThingInCorridor, true);

  // After 0.5s within that same cycle (t = 1.25 + 0.60 = 1.85), The Thing is no longer visible
  const leftAfterHalfSec = getTheThingCorridorFlickerState(1.85, 'left', 100);
  assert.equal(leftAfterHalfSec.showTheThingInCorridor, false);

  // On non-selected natural flickers (e.g., flickerIndex 0, t = 0.15), the hallway light flickers ON, but The Thing does NOT appear
  const leftFlickerNotSelected = getTheThingCorridorFlickerState(0.15, 'left', 100);
  assert.equal(leftFlickerNotSelected.corridorLit, true);
  assert.equal(leftFlickerNotSelected.showTheThingInCorridor, false);

  // When power is out (0%), no natural hallway flicker occurs
  const noPowerState = getTheThingCorridorFlickerState(1.40, 'left', 0);
  assert.equal(noPowerState.corridorLit, false);
  assert.equal(noPowerState.showTheThingInCorridor, false);

  // 3. Destroyed animatronic corpses appear when The Thing hunts alone (Night 5 and 3AM-6AM on Nights 6/7)
  const night1Anims = createInitialAnimatronics(getNightConfig(1));
  const night4Anims = createInitialAnimatronics(getNightConfig(4));
  assert.equal(shouldShowDestroyedAnimatronicCorpses(night1Anims), false);
  assert.equal(shouldShowDestroyedAnimatronicCorpses(night4Anims), false);
  assert.equal(shouldShowDestroyedAnimatronicCorpses(night5Anims), true);

  const night6Config = getNightConfig(6);
  const night6Start = createInitialAnimatronics(night6Config);
  assert.equal(shouldShowDestroyedAnimatronicCorpses(night6Start), false);
  const night6After3AM = apply3AMPhaseShift(night6Start, night6Config).animatronics;
  assert.equal(shouldShowDestroyedAnimatronicCorpses(night6After3AM), true);
});

test('Post-Night 5 Ending 1 (Answered Phone + Collected Docs route): office reward voice, CAM 05 look-left/wait-1s/look-right/open timeline, 3s 3-E QTE, Still Nothing Bad Ending star unlock, and Bank donation choice', async () => {
  const {
    BANK_EXTERIOR_DOOR_X,
    BANK_RECEPTIONIST_X,
    INITIAL_CAMPAIGN_PROGRESS,
    POST_NIGHT_5_BANK_DONATE_TAB,
    POST_NIGHT_5_FLEE_SCREAM_TABS,
    POST_NIGHT_5_GRAB_REWARD_TAB,
    POST_NIGHT_5_OFFICE_REWARD_TAB,
    POST_NIGHT_5_QTE_DURATION_SEC,
    POST_NIGHT_5_QTE_REQUIRED_PRESSES,
    getPostNight5ClosetLookState,
    isNearBankExteriorDoor,
    isNearBankReceptionist,
    shouldTriggerPostNight5Ending,
    unlockBadEnding1Star,
  } = await import('./rules');

  // 1. Triggers after Night 5 when phone was answered in Night 3->4 and papers were collected in Night 4
  assert.equal(shouldTriggerPostNight5Ending(5, true, true), true);
  assert.equal(shouldTriggerPostNight5Ending(4, true, true), false);
  assert.equal(shouldTriggerPostNight5Ending(5, false, true), false);
  assert.equal(shouldTriggerPostNight5Ending(5, true, false), false);

  // 2. Scene 1 Office dialogue: "Bien hecho, tú ganas, ven al almacén para recoger tu RECOMPENSA" with trembling RECOMPENSA
  assert.equal(POST_NIGHT_5_OFFICE_REWARD_TAB.speaker, 'THE THING');
  assert.equal(
    POST_NIGHT_5_OFFICE_REWARD_TAB.segments[0].text,
    'Bien hecho, tú ganas, ven al almacén para recoger tu '
  );
  assert.equal(POST_NIGHT_5_OFFICE_REWARD_TAB.segments[1].text, 'RECOMPENSA');
  assert.equal(POST_NIGHT_5_OFFICE_REWARD_TAB.segments[1].slowTremble, true);

  // 3. Scene 2 CAM 05 door timeline: stop -> look left -> wait 1s -> look right -> wait 1s on right -> return center -> open door -> about to enter
  assert.equal(getPostNight5ClosetLookState(0.2).stepLabel, 'STOP_AT_DOOR');
  assert.equal(getPostNight5ClosetLookState(1.0).stepLabel, 'LOOK_LEFT');
  const waitLeftState = getPostNight5ClosetLookState(1.8);
  assert.equal(waitLeftState.stepLabel, 'WAIT_ONE_SEC');
  assert.equal(waitLeftState.cameraYaw, -1);
  assert.equal(getPostNight5ClosetLookState(2.8).stepLabel, 'LOOK_RIGHT');
  const waitRightState = getPostNight5ClosetLookState(3.8);
  assert.equal(waitRightState.stepLabel, 'WAIT_RIGHT_ONE_SEC');
  assert.equal(waitRightState.cameraYaw, 1);
  assert.equal(getPostNight5ClosetLookState(4.5).stepLabel, 'RETURN_CENTER');
  const openState = getPostNight5ClosetLookState(5.5);
  assert.equal(openState.stepLabel, 'OPENING_DOOR');
  assert.ok(openState.doorOpenProgress > 0.2 && openState.doorOpenProgress < 0.9);
  assert.ok(openState.approachProgress > 0.6);
  const doneState = getPostNight5ClosetLookState(6.2);
  assert.equal(doneState.completed, true);
  assert.equal(doneState.doorOpenProgress, 1);
  assert.equal(doneState.approachProgress, 1);

  // 4. Scene 3 & 4: Grab reward shout + 3-second 3-press [E] QTE
  assert.equal(POST_NIGHT_5_GRAB_REWARD_TAB.segments[0].text, '¡AQUÍ ESTÁ TU RECOMPENSA!');
  assert.equal(POST_NIGHT_5_QTE_DURATION_SEC, 3.0);
  assert.equal(POST_NIGHT_5_QTE_REQUIRED_PRESSES, 3);

  // 5. Branch A (Bad Ending): unlocks the black star with light outline on the Main Menu
  assert.equal(INITIAL_CAMPAIGN_PROGRESS.badEnding1Unlocked, false);
  const withStar = unlockBadEnding1Star(INITIAL_CAMPAIGN_PROGRESS);
  assert.equal(withStar.badEnding1Unlocked, true);

  // 6. Branch B (Good Ending): 3 flee screams across fade-to-black blinks + Bank door & Receptionist interactions
  assert.equal(POST_NIGHT_5_FLEE_SCREAM_TABS.length, 3);
  assert.equal(POST_NIGHT_5_FLEE_SCREAM_TABS[0].segments[0].text, '¡NOOOOOOOO!');
  assert.equal(POST_NIGHT_5_FLEE_SCREAM_TABS[1].segments[0].text, '¡Todo es culpa tuya!');
  assert.equal(POST_NIGHT_5_FLEE_SCREAM_TABS[2].segments[0].text, '¡Volveremos a encontrarnos!');

  assert.equal(isNearBankExteriorDoor(160), false);
  assert.equal(isNearBankExteriorDoor(BANK_EXTERIOR_DOOR_X), true);
  assert.equal(isNearBankReceptionist(150), false);
  assert.equal(isNearBankReceptionist(BANK_RECEPTIONIST_X), true);
  assert.equal(
    POST_NIGHT_5_BANK_DONATE_TAB.segments[0].text,
    '¿QUIERES DONAR EL DINERO PARA EL TRATAMIENTO DE TU HERMANA?'
  );
});

test('Post-Night 4 Interlude (No-Documents route): floor stand-up confused animation, shadow voice tabs, brother tabs, pay failures tab, shrinking circle [E] QTE, and fade-out scream', async () => {
  const {
    POST_NIGHT_4_CIRCLE_QTE_REQUIRED_HITS,
    POST_NIGHT_4_CIRCLE_QTE_ROUND_DURATION_SEC,
    POST_NIGHT_4_FLOOR_STAND_UP_DURATION_SEC,
    POST_NIGHT_4_NO_DOCS_BROTHER_TABS,
    POST_NIGHT_4_NO_DOCS_CONFUSED_TAB,
    POST_NIGHT_4_NO_DOCS_FINAL_SCREAM_TAB,
    POST_NIGHT_4_NO_DOCS_PAY_FAILURES_TAB,
    POST_NIGHT_4_NO_DOCS_SHADOW_TABS,
    evaluatePostNight4CircleQtePress,
    getPostNight4CircleQteState,
    getPostNight4FloorStandUpState,
  } = await import('./rules');

  // 1. Confused floor stand-up timeline (2.4s total): LYING_DAZED -> KNEELING_CONFUSED -> STANDING_UP -> STANDING_CONFUSED
  assert.equal(POST_NIGHT_4_FLOOR_STAND_UP_DURATION_SEC, 2.4);
  assert.equal(getPostNight4FloorStandUpState(0.2).stage, 'LYING_DAZED');
  assert.equal(getPostNight4FloorStandUpState(0.9).stage, 'KNEELING_CONFUSED');
  assert.equal(getPostNight4FloorStandUpState(1.8).stage, 'STANDING_UP');
  const stoodUp = getPostNight4FloorStandUpState(2.4);
  assert.equal(stoodUp.stage, 'STANDING_CONFUSED');
  assert.equal(stoodUp.completed, true);

  // 2. Dialogue sequence for No-Documents route
  assert.equal(POST_NIGHT_4_NO_DOCS_CONFUSED_TAB.speaker, 'RICHARD');
  assert.equal(POST_NIGHT_4_NO_DOCS_CONFUSED_TAB.segments[0].text, '¿Dónde- dónde estoy?');

  assert.equal(POST_NIGHT_4_NO_DOCS_SHADOW_TABS.length, 2);
  assert.equal(
    POST_NIGHT_4_NO_DOCS_SHADOW_TABS[0].segments[0].text,
    'Vaya, vaya, me sorprende que hayas llegado tan lejos.'
  );
  assert.equal(POST_NIGHT_4_NO_DOCS_SHADOW_TABS[1].segments[1].text, 'FALLADO');
  assert.equal(POST_NIGHT_4_NO_DOCS_SHADOW_TABS[1].segments[1].slowTremble, true);

  assert.equal(POST_NIGHT_4_NO_DOCS_BROTHER_TABS.length, 2);
  assert.equal(
    POST_NIGHT_4_NO_DOCS_BROTHER_TABS[0].segments[0].text,
    'Bueno, bueno, ¿qué te parece?'
  );
  assert.equal(
    POST_NIGHT_4_NO_DOCS_BROTHER_TABS[1].segments[0].text,
    'Ha costado mucho tiempo llegar hasta aquí, ¿verdad, hermano?'
  );

  assert.equal(
    POST_NIGHT_4_NO_DOCS_PAY_FAILURES_TAB.segments[0].text,
    'Pagarás por tus fracasos.'
  );

  assert.equal(
    POST_NIGHT_4_NO_DOCS_FINAL_SCREAM_TAB.segments[0].text,
    '¡PAGARÁS POR '
  );
  assert.equal(
    POST_NIGHT_4_NO_DOCS_FINAL_SCREAM_TAB.segments[1].text,
    'TOOOOOOOOOOOODO!'
  );
  assert.equal(POST_NIGHT_4_NO_DOCS_FINAL_SCREAM_TAB.segments[1].slowTremble, true);

  // 3. Shrinking Circle [E] QTE:
  // - Early in the round (e.g. 0.2s), ringScale > 1.35 -> pressing [E] misses!
  assert.equal(POST_NIGHT_4_CIRCLE_QTE_REQUIRED_HITS, 3);
  assert.equal(POST_NIGHT_4_CIRCLE_QTE_ROUND_DURATION_SEC, 1.45);

  const earlyState = getPostNight4CircleQteState(0.2);
  assert.equal(earlyState.isInHitZone, false);
  assert.equal(earlyState.missedByTimeout, false);
  assert.equal(evaluatePostNight4CircleQtePress(earlyState.ringScale), 'MISS');

  // - When the shrinking circle reaches the [E] circle (e.g. 1.05s, ringScale ~1.05), pressing [E] hits!
  const hitZoneState = getPostNight4CircleQteState(1.05);
  assert.equal(hitZoneState.isInHitZone, true);
  assert.equal(hitZoneState.missedByTimeout, false);
  assert.equal(evaluatePostNight4CircleQtePress(hitZoneState.ringScale), 'HIT');

  // - If the player waits too long and lets the circle close past the minimum threshold (e.g. 1.42s), missedByTimeout = true!
  const lateState = getPostNight4CircleQteState(1.42);
  assert.equal(lateState.isInHitZone, false);
  assert.equal(lateState.missedByTimeout, true);

  // 4. Ending Trophy Stars (badEnding1Unlocked, badEnding2Unlocked, ending1Unlocked)
  const {
    INITIAL_CAMPAIGN_PROGRESS,
    recordNightVictory,
    unlockBadEnding1Star,
    unlockBadEnding2Star,
    unlockEnding1Star,
  } = await import('./rules');

  let prog = INITIAL_CAMPAIGN_PROGRESS;
  assert.equal(Boolean(prog.badEnding1Unlocked), false);
  assert.equal(Boolean(prog.badEnding2Unlocked), false);
  assert.equal(Boolean(prog.ending1Unlocked), false);

  prog = unlockBadEnding2Star(prog);
  assert.equal(prog.badEnding2Unlocked, true);
  assert.equal(Boolean(prog.badEnding1Unlocked), false);

  prog = unlockEnding1Star(prog);
  assert.equal(prog.ending1Unlocked, true);
  assert.equal(prog.badEnding2Unlocked, true);

  prog = unlockBadEnding1Star(prog);
  assert.equal(prog.badEnding1Unlocked, true);

  // Preserved across night victories
  const afterVictory = recordNightVictory(prog, 4);
  assert.equal(afterVictory.badEnding1Unlocked, true);
  assert.equal(afterVictory.badEnding2Unlocked, true);
  assert.equal(afterVictory.ending1Unlocked, true);
});

test('Post-Night 5 No-Documents Ending (Ending 2) rules: running screams from Office to Exit, braking & turning to The Thing, CAM 05 impalement & automatic dying dialogue with trembling A COSTA DE TU VIDA, progressive blur & slow death blink, and unlockEnding2Star', async () => {
  const {
    INITIAL_CAMPAIGN_PROGRESS,
    POST_NIGHT_5_NO_DOCS_AUTO_DIALOGUE_HOLD_SEC,
    POST_NIGHT_5_NO_DOCS_DYING_TAB,
    POST_NIGHT_5_NO_DOCS_LEFT_HALL_DURATION_SEC,
    POST_NIGHT_5_NO_DOCS_LEFT_TURN_DURATION_SEC,
    POST_NIGHT_5_NO_DOCS_OFFER_MONEY_TAB,
    POST_NIGHT_5_NO_DOCS_REACH_MONEY_DURATION_SEC,
    POST_NIGHT_5_NO_DOCS_RUN_SCREAM_TABS,
    POST_NIGHT_5_NO_DOCS_SLOW_DEATH_BLINK_DURATION_SEC,
    getPostNight5NoDocsDyingVisionState,
    getPostNight5NoDocsRunAndTurnState,
    recordNightVictory,
    shouldTriggerPostNight5Ending,
    shouldTriggerPostNight5NoDocsEnding,
    unlockEnding2Star,
  } = await import('./rules');

  // 1. Triggers when Night 5 is completed without having collected Night 4 documents
  assert.equal(shouldTriggerPostNight5NoDocsEnding(4, false), false);
  assert.equal(shouldTriggerPostNight5NoDocsEnding(5, true), false);
  assert.equal(shouldTriggerPostNight5NoDocsEnding(5, false), true);
  assert.equal(shouldTriggerPostNight5Ending(5, true, false), false);

  // 1B. Left Office Corridor run -> smooth 90° left turn into Exit Corridor -> full stop on braking
  assert.equal(POST_NIGHT_5_NO_DOCS_LEFT_HALL_DURATION_SEC, 1.85);
  assert.equal(POST_NIGHT_5_NO_DOCS_LEFT_TURN_DURATION_SEC, 0.85);

  const leftHallMid = getPostNight5NoDocsRunAndTurnState('NO_DOCS_FP_LEFT_HALL_AND_TURN', 0.925, -1);
  assert.ok(leftHallMid.leftCorridorProgress > 0.45 && leftHallMid.leftCorridorProgress < 0.55);
  assert.equal(leftHallMid.turnLeftProgress, 0);
  assert.equal(leftHallMid.isRunning, true);
  assert.equal(leftHallMid.hasBrakedDead, false);
  assert.equal(leftHallMid.theThingShouldSpeak, false);

  const turnMid = getPostNight5NoDocsRunAndTurnState('NO_DOCS_FP_RUN_1_OFFICE', 0.425, -1);
  assert.equal(turnMid.leftCorridorProgress, 1);
  assert.ok(turnMid.turnLeftProgress > 0.4 && turnMid.turnLeftProgress < 0.6);
  assert.ok(turnMid.exitCorridorCameraYaw > 0.4 && turnMid.exitCorridorCameraYaw < 0.7);
  assert.equal(turnMid.isRunning, true);
  assert.equal(turnMid.theThingShouldSpeak, true);

  const turnDone = getPostNight5NoDocsRunAndTurnState('NO_DOCS_FP_RUN_1_OFFICE', 1.0, -1);
  assert.equal(turnDone.turnLeftProgress, 1);
  assert.equal(turnDone.exitCorridorCameraYaw, 0);
  assert.equal(turnDone.isRunning, true);

  // While "¡¿ES QUE ACASO NO TE IMPORTA TU HERMANA?!" is still typing (timeSinceDialogueDone < 0), Richard is running
  const runSisterTyping = getPostNight5NoDocsRunAndTurnState('NO_DOCS_FP_RUN_4_SISTER', 0.6, -1);
  assert.equal(runSisterTyping.isRunning, true);
  assert.equal(runSisterTyping.hasBrakedDead, false);

  // The exact instant typing finishes (timeSinceDialogueDone >= 0), Richard brakes dead and running stops completely
  const runSisterBraked = getPostNight5NoDocsRunAndTurnState('NO_DOCS_FP_RUN_4_SISTER', 1.4, 0.05);
  assert.equal(runSisterBraked.isRunning, false);
  assert.equal(runSisterBraked.hasBrakedDead, true);

  // 2. 4 background screams while running from Office toward EXIT + 2.0s hold between automatic dialogues + 3.0s reach-for-money duration
  assert.equal(POST_NIGHT_5_NO_DOCS_AUTO_DIALOGUE_HOLD_SEC, 2.0);
  assert.equal(POST_NIGHT_5_NO_DOCS_REACH_MONEY_DURATION_SEC, 3.0);
  assert.equal(POST_NIGHT_5_NO_DOCS_RUN_SCREAM_TABS.length, 4);
  assert.equal(POST_NIGHT_5_NO_DOCS_RUN_SCREAM_TABS[0].segments[0].text, '¡VUELVE AQUÍ!');
  assert.equal(POST_NIGHT_5_NO_DOCS_RUN_SCREAM_TABS[1].segments[0].text, '¡TRAIDOOOOR!');
  assert.equal(
    POST_NIGHT_5_NO_DOCS_RUN_SCREAM_TABS[2].segments[0].text,
    '¡ME PROMETISTE LOS DOCUMENTOS!'
  );
  assert.equal(
    POST_NIGHT_5_NO_DOCS_RUN_SCREAM_TABS[3].segments[0].text,
    '¡¿ES QUE ACASO NO TE IMPORTA TU HERMANA?!'
  );

  // 3. The Thing offering the money after Richard brakes dead at the EXIT door and turns around
  assert.equal(
    POST_NIGHT_5_NO_DOCS_OFFER_MONEY_TAB.segments[0].text,
    'Bien, bien, ven aquí y te llevarás el dinero.'
  );

  // 4. Automatic dying dialogue when The Thing crouches over Richard on the CAM 05 floor
  assert.equal(
    POST_NIGHT_5_NO_DOCS_DYING_TAB.segments[0].text,
    'No te preocupes Richard, tu hermana vivirá '
  );
  assert.equal(POST_NIGHT_5_NO_DOCS_DYING_TAB.segments[1].text, 'A COSTA DE TU VIDA');
  assert.equal(POST_NIGHT_5_NO_DOCS_DYING_TAB.segments[1].slowTremble, true);

  // 5. Progressive blur & blinking eyelids during dying dialogue and slow death blink
  const visionStart = getPostNight5NoDocsDyingVisionState(0.1, false);
  const visionMid = getPostNight5NoDocsDyingVisionState(2.5, false);
  assert.ok(visionMid.blurPx > visionStart.blurPx);
  assert.equal(visionMid.completed, false);

  const deathBlinkMid = getPostNight5NoDocsDyingVisionState(2.2, true);
  assert.ok(deathBlinkMid.blurPx > visionMid.blurPx);
  assert.ok(deathBlinkMid.eyelidCloseProgress > 0.4);
  assert.equal(deathBlinkMid.completed, false);

  const deathBlinkDone = getPostNight5NoDocsDyingVisionState(
    POST_NIGHT_5_NO_DOCS_SLOW_DEATH_BLINK_DURATION_SEC + 0.1,
    true
  );
  assert.equal(deathBlinkDone.eyelidCloseProgress, 1);
  assert.equal(deathBlinkDone.completed, true);

  // 6. unlockEnding2Star unlocks the second wooden star on the left side (above ending1Unlocked)
  let prog = INITIAL_CAMPAIGN_PROGRESS;
  assert.equal(Boolean(prog.ending2Unlocked), false);
  prog = unlockEnding2Star(prog);
  assert.equal(prog.ending2Unlocked, true);
  const afterVictory = recordNightVictory(prog, 5);
  assert.equal(afterVictory.ending2Unlocked, true);
});



