import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateUsageLevel,
  calculatePowerDrainTenthsPerSecond,
  getEffectiveAILevel,
  getNextPedroLocation,
  getNextRajoyLocation,
  getNextMonteroLocation,
  createInitialNightState,
  toggleLeftDoor,
  toggleRightDoor,
  toggleLeftLight,
  toggleRightLight,
  toggleMonitor,
  selectCamera,
  resolveAbascalDoorArrival,
  stepGameSimulation,
} from './rules';

test('calculateUsageLevel computes exact FNAF 1 usage pips (1 to 5)', () => {
  assert.equal(
    calculateUsageLevel({
      leftDoorClosed: false,
      rightDoorClosed: false,
      leftLightOn: false,
      rightLightOn: false,
      monitorOpen: false,
    }),
    1
  );

  assert.equal(
    calculateUsageLevel({
      leftDoorClosed: true,
      rightDoorClosed: true,
      leftLightOn: true,
      rightLightOn: false,
      monitorOpen: false,
    }),
    4
  );

  assert.equal(
    calculateUsageLevel({
      leftDoorClosed: true,
      rightDoorClosed: true,
      leftLightOn: true,
      rightLightOn: true,
      monitorOpen: true,
    }),
    5
  );
});

test('getEffectiveAILevel applies FNAF 1 hourly AI increments at 2 AM, 3 AM, and 4 AM', () => {
  // Rajoy (Bonnie) gets +1 at 2 AM, +1 at 3 AM, +1 at 4 AM
  assert.equal(getEffectiveAILevel(5, 'rajoy', 1), 5);
  assert.equal(getEffectiveAILevel(5, 'rajoy', 2), 6);
  assert.equal(getEffectiveAILevel(5, 'rajoy', 3), 7);
  assert.equal(getEffectiveAILevel(5, 'rajoy', 4), 8);

  // Montero (Chica) and Abascal (Foxy) get +1 at 3 AM and +1 at 4 AM
  assert.equal(getEffectiveAILevel(4, 'montero', 2), 4);
  assert.equal(getEffectiveAILevel(4, 'montero', 3), 5);
  assert.equal(getEffectiveAILevel(4, 'montero', 4), 6);

  // Pedro (Freddy) does not get automatic hourly increments and caps at 20
  assert.equal(getEffectiveAILevel(10, 'pedro', 4), 10);
  assert.equal(getEffectiveAILevel(19, 'rajoy', 5), 20);
});

test('Pedro-Freddy stealth rules: waits on stage for Rajoy/Montero and freezes when monitor is open', () => {
  // Still on stage while Rajoy is on CAM_1A
  assert.equal(
    getNextPedroLocation({
      current: 'CAM_1A',
      monitorOpen: false,
      activeCam: 'CAM_1A',
      rightDoorClosed: false,
      rajoyLocation: 'CAM_1A',
      monteroLocation: 'CAM_1B',
    }),
    'CAM_1A'
  );

  // Leaves stage once both Rajoy and Montero left CAM_1A and monitor is closed
  assert.equal(
    getNextPedroLocation({
      current: 'CAM_1A',
      monitorOpen: false,
      activeCam: 'CAM_1A',
      rightDoorClosed: false,
      rajoyLocation: 'CAM_1B',
      monteroLocation: 'CAM_1B',
    }),
    'CAM_1B'
  );

  // At CAM_4B: watching CAM_4B freezes Pedro even if Right Door is open
  assert.equal(
    getNextPedroLocation({
      current: 'CAM_4B',
      monitorOpen: true,
      activeCam: 'CAM_4B',
      rightDoorClosed: false,
      rajoyLocation: 'CAM_2A',
      monteroLocation: 'CAM_4A',
    }),
    'CAM_4B'
  );

  // At CAM_4B: closing Right Door blocks Pedro and sends him back to CAM_4A
  assert.equal(
    getNextPedroLocation({
      current: 'CAM_4B',
      monitorOpen: false,
      activeCam: 'CAM_1A',
      rightDoorClosed: true,
      rajoyLocation: 'CAM_2A',
      monteroLocation: 'CAM_4A',
    }),
    'CAM_4A'
  );

  // At CAM_4B: looking at a different camera with Right Door open lets Pedro enter the office
  assert.equal(
    getNextPedroLocation({
      current: 'CAM_4B',
      monitorOpen: true,
      activeCam: 'CAM_1C',
      rightDoorClosed: false,
      rajoyLocation: 'CAM_2A',
      monteroLocation: 'CAM_4A',
    }),
    'OFFICE_INSIDE'
  );
});

test('Rajoy-Bonnie and Montero-Chica follow West and East wing movement paths', () => {
  assert.equal(getNextRajoyLocation('CAM_1A', 0.2), 'CAM_1B');
  assert.equal(getNextRajoyLocation('CAM_2B', 0.2), 'LEFT_DOOR');
  assert.equal(getNextMonteroLocation('CAM_1A', 0.5), 'CAM_1B');
  assert.equal(getNextMonteroLocation('CAM_4B', 0.2), 'RIGHT_DOOR');
});

test('Abascal-Foxy door bang drains 1% + 5%*bangs when Left Door is closed, and jumpscares when open', () => {
  let state = createInitialNightState(2);
  state.abascalStage = 3;
  state.abascalSprinting = true;
  state = toggleLeftDoor(state); // Close Left Door

  // First bang drains 10 tenths (1%)
  const afterFirstBang = resolveAbascalDoorArrival(state, 0.2);
  assert.equal(afterFirstBang.powerTenths, 990);
  assert.equal(afterFirstBang.abascalBangsCount, 1);
  assert.equal(afterFirstBang.abascalSprinting, false);
  assert.equal(afterFirstBang.jumpscareBy, null);

  // Second bang drains 60 tenths (6%) -> 990 - 60 = 930
  const afterSecondBang = resolveAbascalDoorArrival(afterFirstBang, 0.2);
  assert.equal(afterSecondBang.powerTenths, 930);
  assert.equal(afterSecondBang.abascalBangsCount, 2);

  // Open Left Door -> triggers immediate jumpscare by Abascal
  let openState = toggleLeftDoor(afterSecondBang);
  assert.equal(openState.leftDoorClosed, false);
  const afterOpenArrival = resolveAbascalDoorArrival(openState, 0.2);
  assert.equal(afterOpenArrival.jumpscareBy, 'abascal');
});

test('Opening monitor turns off hallway lights, and viewing CAM_2A at Abascal Stage 3 triggers sprint', () => {
  let state = createInitialNightState(2);
  state = toggleLeftLight(state);
  assert.equal(state.leftLightOn, true);

  state = toggleRightLight(state);
  assert.equal(state.rightLightOn, true);
  assert.equal(state.leftLightOn, false);

  state.abascalStage = 3;
  state = toggleMonitor(state, 0.5);
  assert.equal(state.rightLightOn, false);
  assert.equal(state.monitorOpen, true);

  state = selectCamera(state, 'CAM_2A');
  assert.equal(state.abascalSprinting, true);
  assert.equal(state.lastAudioCue, 'foxy_sprint');
});

test('Power outage sequence triggers at 0% battery and opens all doors', () => {
  let state = createInitialNightState(1);
  state = toggleLeftDoor(state);
  state = toggleRightDoor(state);
  state.powerTenths = 0.05;

  const next = stepGameSimulation(state, 0.05, () => 0.99);
  assert.equal(next.powerOutage, true);
  assert.equal(next.outagePhase, 'dark_wait');
  assert.equal(next.leftDoorClosed, false);
  assert.equal(next.rightDoorClosed, false);
  assert.equal(next.usageLevel, 0);
});

test('6:00 AM triggers victory state cleanly', () => {
  let state = createInitialNightState(1, undefined, 45);
  state.elapsedSeconds = 45 * 6 - 0.02;
  const next = stepGameSimulation(state, 0.05, () => 0.5);
  assert.equal(next.currentHour, 6);
  assert.equal(next.status, 'victory');
  assert.equal(next.lastAudioCue, 'victory_chime');
});

test('Power drain scales strictly upwards with higher usage levels', () => {
  const d1 = calculatePowerDrainTenthsPerSecond(1, 1);
  const d3 = calculatePowerDrainTenthsPerSecond(3, 1);
  const d5 = calculatePowerDrainTenthsPerSecond(5, 1);
  assert.ok(d1 < d3);
  assert.ok(d3 < d5);
});

test('Endo-03 easter egg triggers with 1/1000 chance in CAM_3 only when Rajoy is absent and disappears when leaving CAM_3', () => {
  let state = createInitialNightState(1);
  state = toggleMonitor(state, 0.5);
  assert.equal(state.endo03Active, false);

  // Roll < 0.001 on CAM_3 when Rajoy is at CAM_1A -> activates Endo-03
  state = selectCamera(state, 'CAM_3', 0.0005);
  assert.equal(state.activeCam, 'CAM_3');
  assert.equal(state.endo03Active, true);

  // Switching to another camera and coming back with normal roll clears Endo-03
  state = selectCamera(state, 'CAM_1B', 0.0001);
  assert.equal(state.endo03Active, false);
  state = selectCamera(state, 'CAM_3', 0.001); // 0.001 is not < 0.001
  assert.equal(state.endo03Active, false);

  // Cannot trigger if Rajoy-Bonnie is currently in CAM_3
  state.rajoyLocation = 'CAM_3';
  state = selectCamera(state, 'CAM_1A', 0.5);
  state = selectCamera(state, 'CAM_3', 0.0001);
  assert.equal(state.endo03Active, false);

  // Closing monitor resets Endo-03
  state.rajoyLocation = 'CAM_1A';
  state = selectCamera(state, 'CAM_1A', 0.5);
  state = selectCamera(state, 'CAM_3', 0.0002);
  assert.equal(state.endo03Active, true);
  state = toggleMonitor(state, 0.5);
  assert.equal(state.monitorOpen, false);
  assert.equal(state.endo03Active, false);
});

test('Echenique-Golden Freddy triggers at 1/1000 on monitor flip, is banished if monitor is raised < 2.5s, and kills at >= 2.5s', () => {
  let state = createInitialNightState(1);
  // Open monitor with normal roll
  state = toggleMonitor(state, 0.5, 0.5, 0.5);
  assert.equal(state.monitorOpen, true);
  assert.equal(state.goldenFreddyActive, false);

  // Close monitor with 1/1000 roll (< 0.001) -> spawns Echenique-Golden Freddy in office
  state = toggleMonitor(state, 0.5, 0.5, 0.0004);
  assert.equal(state.monitorOpen, false);
  assert.equal(state.goldenFreddyActive, true);
  assert.equal(state.lastAudioCue, 'golden_laugh');

  // Wait 2.0 seconds (< 2.5s) -> still alive
  for (let i = 0; i < 40; i++) {
    state = stepGameSimulation(state, 0.05, () => 0.99);
  }
  assert.equal(state.jumpscareBy, null);
  assert.equal(state.goldenFreddyActive, true);

  // Raise monitor before 2.5s -> banishes Echenique-Golden Freddy!
  state = toggleMonitor(state, 0.5, 0.5, 0.5);
  assert.equal(state.monitorOpen, true);
  assert.equal(state.goldenFreddyActive, false);
  assert.equal(state.goldenFreddyTimer, 0);

  // Trigger again via CAM_2B 1/1000 poster -> close monitor -> wait >= 2.5s -> fatal jumpscare!
  state = selectCamera(state, 'CAM_2B', 0.5, 0.0003);
  assert.equal(state.goldenFreddyPosterActive, true);
  state = toggleMonitor(state, 0.5, 0.5, 0.5);
  assert.equal(state.goldenFreddyActive, true);

  // Step 2.55 seconds (51 steps of 0.05s)
  for (let i = 0; i < 51; i++) {
    state = stepGameSimulation(state, 0.05, () => 0.99);
  }
  assert.equal(state.jumpscareBy, 'echenique');
  assert.equal(state.lastAudioCue, 'golden_jumpscare');
});


