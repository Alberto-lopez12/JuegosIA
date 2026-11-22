import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyArmorDamageReduction,
  BLOCK_IDS,
  BLOCKS,
  calculateTotalArmorPoints,
  canHarvestBlock,
  CREATIVE_CATALOG,
  getIndex,
  getMiningSpeedMultiplier,
  LAVA_LEVEL,
  SEA_LEVEL,
} from './blocks';
import {
  addItemToInventory,
  countItemInInventory,
  executeVillagerTrade,
  getFuelDuration,
  getSmeltOutput,
  matchRecipe,
  VILLAGER_TRADES,
} from './crafting';
import { validateSavedWorldJson } from './engine';
import {
  generateRandomSeed,
  hashSeedString,
  parseSeedInput,
  sampleTerrainColumn,
  SeededNoise,
} from './noise';
import {
  calculateFallDamage,
  PlayerPhysicsState,
  stepPlayerPhysics,
} from './physics';
import {
  buildSafeReturnPortal,
  findNearestPortal,
  findValidPortalFrame,
  scalePortalCoordinates,
} from './portal';
import { raycastVoxel } from './raycast';
import {
  deleteWorldById,
  listWorlds,
  loadGlobalSettings,
  loadWorldById,
  saveGlobalSettings,
  saveWorldData,
} from './storage';
import { StructureGenerator } from './structures';
import type { ArmorSlots, SavedWorldData, SlotOrNull } from './types';
import { decodeChunkMapSlice, World } from './world';

test('getIndex computes O(1) spatial index for 16x128x16 chunk', () => {
  assert.equal(getIndex(0, 0, 0), 0);
  assert.equal(getIndex(1, 0, 0), 1);
  assert.equal(getIndex(0, 0, 1), 16);
  assert.equal(getIndex(0, 1, 0), 256);
  assert.equal(getIndex(15, 127, 15), 16 * 128 * 16 - 1);
});

test('BLOCKS catalog includes all 27 blocks (0..26) with crossMesh, mapColor, and harvest rules', () => {
  for (let id = 0; id <= 26; id++) {
    assert.ok(BLOCKS[id], `Block ID ${id} should exist`);
    assert.ok(BLOCKS[id].mapColor, `Block ID ${id} should define mapColor`);
  }
  assert.equal(BLOCKS[13].name, 'Piedra Base');
  assert.equal(BLOCKS[13].hardness, -1);
  assert.equal(BLOCKS[15].lightLevel, 14);
  assert.equal(BLOCKS[BLOCK_IDS.TALL_GRASS].crossMesh, true);
  assert.equal(BLOCKS[BLOCK_IDS.RED_FLOWER].crossMesh, true);
  assert.equal(BLOCKS[BLOCK_IDS.OAK_SAPLING].crossMesh, true);
  assert.equal(BLOCKS[BLOCK_IDS.TALL_GRASS].solid, false);
  assert.ok(BLOCKS[BLOCK_IDS.CHEST].uvs.front, 'Chest should have distinct front lock UV');

  assert.equal(canHarvestBlock(BLOCK_IDS.STONE, null), false);
  assert.equal(getMiningSpeedMultiplier(BLOCK_IDS.STONE, null), 0.2);
  assert.equal(canHarvestBlock(BLOCK_IDS.STONE, 'wood_pickaxe'), true);
  assert.equal(canHarvestBlock(BLOCK_IDS.GOLD_ORE, 'iron_pickaxe'), true);
  assert.equal(canHarvestBlock(BLOCK_IDS.DIAMOND_ORE, 'diamond_pickaxe'), true);
  assert.equal(canHarvestBlock(BLOCK_IDS.DIRT, null), true);
});

test('SeededNoise & terrain generation cover all 4 biomes including Snowy Taiga, bedrock, and Gold/Diamond ores', () => {
  const n1 = new SeededNoise(12345);
  const n2 = new SeededNoise(12345);
  assert.equal(n1.fbm2D(12.3, -45.6, 4), n2.fbm2D(12.3, -45.6, 4));
  assert.equal(n1.noise3D(1.5, 2.5, 3.5), n2.noise3D(1.5, 2.5, 3.5));

  const biomesSeen = new Set<string>();
  for (let z = -500; z <= 500; z += 25) {
    for (let x = -500; x <= 500; x += 25) {
      const col = sampleTerrainColumn(n1, x, z);
      assert.ok(col.height >= 28 && col.height <= 95, `Height ${col.height} out of [28,95]`);
      biomesSeen.add(col.biome);
    }
  }
  assert.ok(biomesSeen.has('Plains'), 'Should generate Plains biome');
  assert.ok(biomesSeen.has('Desert'), 'Should generate Desert biome');
  assert.ok(biomesSeen.has('Mountains'), 'Should generate Mountains biome');
  assert.ok(biomesSeen.has('Snowy Taiga'), 'Should generate Snowy Taiga biome');

  const world = new World(42073);
  let foundGold = false;
  let foundDiamond = false;
  for (let cz = -1; cz <= 1; cz++) {
    for (let cx = -1; cx <= 1; cx++) {
      const chunk = world.generateChunk(cx, cz);
      for (let z = 0; z < 16; z++) {
        for (let x = 0; x < 16; x++) {
          assert.equal(chunk.getBlock(x, 0, z), BLOCK_IDS.BEDROCK);
          for (let y = 1; y <= 30; y++) {
            const b = chunk.getBlock(x, y, z);
            if (b === BLOCK_IDS.GOLD_ORE) {
              assert.ok(y >= 5 && y <= 30, 'Gold Ore must spawn within Y=5..30');
              foundGold = true;
            }
            if (b === BLOCK_IDS.DIAMOND_ORE) {
              assert.ok(y >= 2 && y <= 16, 'Diamond Ore must spawn within Y=2..16');
              foundDiamond = true;
            }
          }
        }
      }
    }
  }
  assert.ok(foundGold, 'Should generate Gold Ore veins');
  assert.ok(foundDiamond, 'Should generate Diamond Ore veins');
  assert.equal(SEA_LEVEL, 42);
});

test('BFS skyLight and blockLight propagate through air, crossMesh, and Torch', () => {
  const world = new World(777);
  const chunk = world.generateChunk(0, 0);
  assert.equal(chunk.getSkyLight(8, 120, 8), 15);

  for (let y = 19; y <= 23; y++) {
    for (let z = 4; z <= 10; z++) {
      for (let x = 4; x <= 10; x++) {
        const isInterior = y >= 20 && y <= 22 && x >= 5 && x <= 9 && z >= 5 && z <= 9;
        chunk.setBlock(x, y, z, isInterior ? BLOCK_IDS.AIR : BLOCK_IDS.STONE);
      }
    }
  }
  chunk.setBlock(7, 20, 7, BLOCK_IDS.TORCH);
  world.computeChunkLight(chunk);

  assert.equal(chunk.getBlockLight(7, 20, 7), 14);
  assert.equal(chunk.getBlockLight(8, 20, 7), 13);
  assert.equal(chunk.getBlockLight(9, 20, 7), 12);
  assert.equal(chunk.getSkyLight(7, 20, 7), 0);
});

test('World tileEntities persist Chests & Furnaces and Oak Saplings grow into full trees', () => {
  const world = new World(999);
  world.generateChunk(0, 0);

  world.setBlock(5, 80, 5, BLOCK_IDS.CHEST);
  const chest = world.getOrCreateChest(5, 80, 5);
  assert.equal(chest.type, 'chest');
  assert.equal(chest.slots.length, 27);
  chest.slots[0] = { id: 'diamond', count: 5 };
  assert.equal(world.getOrCreateChest(5, 80, 5).slots[0]?.count, 5);

  world.setBlock(6, 80, 5, BLOCK_IDS.FURNACE);
  const furnace = world.getOrCreateFurnace(6, 80, 5);
  assert.equal(furnace.type, 'furnace');
  assert.equal(furnace.cookProgress, 0);

  // Plant sapling on dirt and fast-forward timer
  world.setBlock(8, 80, 8, BLOCK_IDS.DIRT);
  world.setBlock(8, 81, 8, BLOCK_IDS.OAK_SAPLING);
  assert.ok(world.saplings.has('8,81,8'));
  world.tickSaplings(60);
  assert.equal(world.getBlock(8, 81, 8), BLOCK_IDS.OAK_LOG, 'Sapling should grow into Oak Log trunk');
  assert.equal(world.getBlock(8, 82, 8), BLOCK_IDS.OAK_LOG);
});

test('Crafting & smelting match Chest, Bricks, Gold/Diamond tools, and all Armor tiers', () => {
  const slot = (id: NonNullable<SlotOrNull>['id']): SlotOrNull => ({ id, count: 1 });

  const planks = matchRecipe([null, slot(BLOCK_IDS.OAK_LOG), null, null], 2);
  assert.equal(planks?.result.id, BLOCK_IDS.OAK_PLANKS);
  assert.equal(planks?.result.count, 4);

  const sticks = matchRecipe([slot(BLOCK_IDS.OAK_PLANKS), null, slot(BLOCK_IDS.OAK_PLANKS), null], 2);
  assert.equal(sticks?.result.id, 'stick');
  assert.equal(sticks?.result.count, 4);

  const P = slot(BLOCK_IDS.OAK_PLANKS);
  const table = matchRecipe([P, P, P, P], 2);
  assert.equal(table?.result.id, BLOCK_IDS.CRAFTING_TABLE);

  // 8 Oak Planks ring -> Chest
  const chest = matchRecipe([P, P, P, P, null, P, P, P, P], 3);
  assert.equal(chest?.result.id, BLOCK_IDS.CHEST);

  // 8 Cobblestone ring -> Furnace
  const C = slot(BLOCK_IDS.COBBLESTONE);
  const furnace = matchRecipe([C, C, C, C, null, C, C, C, C], 3);
  assert.equal(furnace?.result.id, BLOCK_IDS.FURNACE);

  // Bricks (2x2 Stone or 2x2 Cobblestone + Dirt)
  const bricks = matchRecipe([slot(BLOCK_IDS.STONE), slot(BLOCK_IDS.STONE), slot(BLOCK_IDS.STONE), slot(BLOCK_IDS.STONE)], 2);
  assert.equal(bricks?.result.id, BLOCK_IDS.BRICKS);
  const bricksCobble = matchRecipe([slot(BLOCK_IDS.COBBLESTONE), slot(BLOCK_IDS.DIRT), slot(BLOCK_IDS.DIRT), slot(BLOCK_IDS.COBBLESTONE)], 2);
  assert.equal(bricksCobble?.result.id, BLOCK_IDS.BRICKS);

  // Diamond Pickaxe & Gold Sword
  const D = slot('diamond');
  const G = slot('gold_ingot');
  const S = slot('stick');
  assert.equal(matchRecipe([D, D, D, null, S, null, null, S, null], 3)?.result.id, 'diamond_pickaxe');
  assert.equal(matchRecipe([null, G, null, null, G, null, null, S, null], 3)?.result.id, 'gold_sword');

  // Iron Chestplate & Diamond Helmet
  const I = slot('iron_ingot');
  assert.equal(matchRecipe([I, null, I, I, I, I, I, I, I], 3)?.result.id, 'iron_chestplate');
  assert.equal(matchRecipe([D, D, D, D, null, D, null, null, null], 3)?.result.id, 'diamond_helmet');

  // Furnace smelting rules
  assert.equal(getSmeltOutput(BLOCK_IDS.IRON_ORE), 'iron_ingot');
  assert.equal(getSmeltOutput(BLOCK_IDS.GOLD_ORE), 'gold_ingot');
  assert.equal(getSmeltOutput('raw_porkchop'), 'cooked_porkchop');
  assert.equal(getSmeltOutput(BLOCK_IDS.SAND), BLOCK_IDS.GLASS);
  assert.equal(getSmeltOutput(BLOCK_IDS.COBBLESTONE), BLOCK_IDS.STONE);
  assert.ok(getFuelDuration('coal') > 0);
  assert.ok(getFuelDuration(BLOCK_IDS.OAK_PLANKS) > 0);

  // Inventory stacking max 64
  const inv: SlotOrNull[] = new Array(36).fill(null);
  assert.equal(addItemToInventory(inv, BLOCK_IDS.DIRT, 70), 0);
  assert.equal(inv[0]?.count, 64);
  assert.equal(inv[1]?.count, 6);
});

test('Armor points sum cleanly across tiers and mitigate combat damage correctly', () => {
  const leatherSet: ArmorSlots = [
    { id: 'leather_helmet', count: 1 },
    { id: 'leather_chestplate', count: 1 },
    { id: 'leather_leggings', count: 1 },
    { id: 'leather_boots', count: 1 },
  ];
  const ironSet: ArmorSlots = [
    { id: 'iron_helmet', count: 1 },
    { id: 'iron_chestplate', count: 1 },
    { id: 'iron_leggings', count: 1 },
    { id: 'iron_boots', count: 1 },
  ];
  const diamondSet: ArmorSlots = [
    { id: 'diamond_helmet', count: 1 },
    { id: 'diamond_chestplate', count: 1 },
    { id: 'diamond_leggings', count: 1 },
    { id: 'diamond_boots', count: 1 },
  ];

  assert.equal(calculateTotalArmorPoints(leatherSet), 7);
  assert.equal(calculateTotalArmorPoints(ironSet), 15);
  assert.equal(calculateTotalArmorPoints(diamondSet), 20);

  // Full Diamond (20 pts): 10 * (1 - 20 * 0.032) = 10 * 0.36 = 3.6
  assert.ok(Math.abs(applyArmorDamageReduction(10, 20) - 3.6) < 0.001);
  // Zero armor: raw damage unchanged
  assert.equal(applyArmorDamageReduction(5, 0), 5);
});

test('Fast Voxel Traversal DDA hits target voxel with exact position and face normal', () => {
  const getBlock = (x: number, y: number, z: number) =>
    x === 3 && y === 10 && z === 0 ? BLOCK_IDS.STONE : BLOCK_IDS.AIR;

  const hit = raycastVoxel(0.5, 10.5, 0.5, 1, 0, 0, getBlock, 5.0);
  assert.ok(hit);
  assert.deepEqual(hit.pos, [3, 10, 0]);
  assert.deepEqual(hit.normal, [-1, 0, 0]);
  assert.equal(hit.blockId, BLOCK_IDS.STONE);

  const miss = raycastVoxel(-4.0, 10.5, 0.5, 1, 0, 0, getBlock, 5.0);
  assert.equal(miss, null);
});

test('AABB physics resolves Safe-Edge crouch (>1 block drop guard vs 1-block step) and fall damage', () => {
  // Elevated platform at y=10 (x=0..1, z=0..1) with NO safe drop around it
  const cliffBlock = (x: number, y: number, z: number) =>
    y === 10 && x >= 0 && x <= 1 && z >= 0 && z <= 1 ? BLOCK_IDS.STONE : BLOCK_IDS.AIR;

  const p: PlayerPhysicsState = {
    x: 1.0,
    y: 11.0,
    z: 1.0,
    vx: 0,
    vy: 0,
    vz: 0,
    onGround: true,
    inWater: false,
    headInWater: false,
    crouching: true,
    sprinting: false,
    peakAirY: 11.0,
    coyoteTimer: 0.09,
  };

  for (let i = 0; i < 40; i++) {
    stepPlayerPhysics(
      p,
      { forward: 1, strafe: 0, jumpHeld: false, jumpJustPressed: false, sprint: false, crouch: true, yaw: 0 },
      0.05,
      cliffBlock
    );
  }
  assert.equal(p.onGround, true);
  assert.ok(p.y >= 11.0, 'Crouching player must not fall off >1-block cliff');

  // Fall damage formula
  assert.equal(calculateFallDamage(3.4, false), 0);
  assert.equal(calculateFallDamage(7.2, false), 4);
  assert.equal(calculateFallDamage(15.0, true), 0);
});

test('validateSavedWorldJson accepts valid v2 world backups and rejects malformed JSON', () => {
  const valid = JSON.stringify({
    version: 2,
    seed: 42073,
    worldTime: 4800,
    dayCount: 2,
    player: { x: 8.5, y: 60, z: 8.5, yaw: 0, pitch: 0, health: 20, hunger: 20, oxygen: 10, selectedSlot: 0 },
    inventory: new Array(36).fill(null),
    armor: [null, null, null, null],
    blockEdits: [[1, 50, 1, BLOCK_IDS.CHEST]],
    tileEntities: [{ type: 'chest', key: '1,50,1', slots: new Array(27).fill(null) }],
    stats: { blocksMined: 5, blocksPlaced: 3, mobsDefeated: 1, dayReached: 2 },
  });
  assert.equal(validateSavedWorldJson(valid).ok, true);
  assert.equal(validateSavedWorldJson('{invalid').ok, false);
  assert.equal(validateSavedWorldJson(JSON.stringify({ seed: 'bad' })).ok, false);
});

test('cyrb128 seed hashing & real terrain divergence across text/numeric seeds and pure survival bare-hand harvest', () => {
  // Deterministic hashing for text (including Unicode) and numbers
  const sSpain1 = parseSeedInput('españa');
  const sSpain2 = parseSeedInput('españa');
  const sMinecraft = parseSeedInput('minecraft');
  const sNumeric = parseSeedInput('42073');
  assert.equal(sSpain1.seed, sSpain2.seed);
  assert.equal(sSpain1.label, 'españa');
  assert.notEqual(sSpain1.seed, sMinecraft.seed);
  assert.equal(sNumeric.seed, 42073);
  assert.equal(hashSeedString('minecraft'), sMinecraft.seed);

  // Empty seed generates 6-digit random number
  const blank = parseSeedInput('   ');
  assert.ok(blank.seed >= 100000 && blank.seed <= 999999);
  const rnd = generateRandomSeed();
  assert.ok(rnd >= 100000 && rnd <= 999999);

  // Same seed produces byte-for-byte identical chunks; different seeds diverge strongly
  const wA1 = new World(sSpain1.seed);
  const wA2 = new World(sSpain2.seed);
  const wB = new World(sMinecraft.seed);
  const cA1 = wA1.generateChunk(0, 0);
  const cA2 = wA2.generateChunk(0, 0);
  const cB = wB.generateChunk(0, 0);

  let identicalDiffs = 0;
  let crossSeedDiffs = 0;
  for (let i = 0; i < cA1.blocks.length; i++) {
    if (cA1.blocks[i] !== cA2.blocks[i]) identicalDiffs++;
    if (cA1.blocks[i] !== cB.blocks[i]) crossSeedDiffs++;
  }
  assert.equal(identicalDiffs, 0, 'Same seed must generate 100% identical terrain');
  assert.ok(crossSeedDiffs > 1000, `Distinct seeds must generate genuinely different worlds (diffs=${crossSeedDiffs})`);

  // Spawn point near (0, 0) lands on solid surface above sea level
  const spawn = wA1.findSpawnPoint();
  assert.ok(Math.hypot(spawn.x, spawn.z) <= 68, 'Spawn should be near (0, 0)');
  assert.ok(spawn.y > SEA_LEVEL, 'Spawn should be above sea level');

  // Pure survival progression: Oak Log must be harvestable with empty hand
  assert.equal(canHarvestBlock(BLOCK_IDS.OAK_LOG, null), true);
});

test('v2.0 block catalog (0..35) and Creative catalog tabs are complete', () => {
  for (let id = 0; id <= 35; id++) {
    assert.ok(BLOCKS[id], `Block ID ${id} should exist`);
    assert.ok(BLOCKS[id].mapColor, `Block ID ${id} should define mapColor`);
  }
  assert.ok(CREATIVE_CATALOG.building.length >= 10);
  assert.ok(CREATIVE_CATALOG.nature.length >= 8);
  assert.ok(CREATIVE_CATALOG.tools.length >= 10);
  assert.ok(CREATIVE_CATALOG.misc.length >= 8);
});

test('Superplano and Amplificado world types generate expected terrain profiles', () => {
  const flatWorld = new World(42073, 'superflat');
  const flatChunk = flatWorld.generateChunk(0, 0);
  assert.equal(flatChunk.getBlock(4, 0, 4), BLOCK_IDS.BEDROCK);
  assert.equal(flatChunk.getBlock(4, 1, 4), BLOCK_IDS.DIRT);
  assert.equal(flatChunk.getBlock(4, 3, 4), BLOCK_IDS.DIRT);
  assert.equal(flatChunk.getBlock(4, 4, 4), BLOCK_IDS.GRASS);
  assert.equal(flatChunk.getBlock(4, 5, 4), BLOCK_IDS.AIR);
  assert.equal(flatWorld.findSpawnPoint().y, 5.05);

  const noise = new SeededNoise(42073);
  let maxDefault = 0;
  let maxAmp = 0;
  for (let x = -200; x <= 200; x += 20) {
    for (let z = -200; z <= 200; z += 20) {
      maxDefault = Math.max(maxDefault, sampleTerrainColumn(noise, x, z, 'default').height);
      maxAmp = Math.max(maxAmp, sampleTerrainColumn(noise, x, z, 'amplified').height);
    }
  }
  assert.ok(maxAmp > maxDefault, `Amplified peaks (${maxAmp}) should exceed Default (${maxDefault})`);
});

test('StructureGenerator deterministically plans structures and stamps them across chunks', () => {
  const noise = new SeededNoise(42073);
  const genA = new StructureGenerator(noise, 'default');
  const genB = new StructureGenerator(new SeededNoise(42073), 'default');
  const flatGen = new StructureGenerator(noise, 'superflat');

  assert.equal(flatGen.getRegionStructure(0, 0), null, 'Superflat should not generate structures');

  const typesSeen = new Set<string>();
  for (let rx = -3; rx <= 3; rx++) {
    for (let rz = -3; rz <= 3; rz++) {
      const a = genA.getRegionStructure(rx, rz);
      const b = genB.getRegionStructure(rx, rz);
      assert.deepEqual(a, b, 'Structure planning must be deterministic');
      if (a) typesSeen.add(a.type);
    }
  }
  assert.ok(typesSeen.size >= 2, `Should generate multiple structure types (got ${[...typesSeen].join(',')})`);

  // Verify world chunk stamping generates chests or villagers for the spawn-region structure
  const s0 = genA.getRegionStructure(0, 0);
  assert.ok(s0, 'Spawn region (0,0) should plan a landmark structure on default seed 42073');
  if (s0) {
    const world = new World(42073, 'default');
    const ccx = Math.floor(s0.centerX / 16);
    const ccz = Math.floor(s0.centerZ / 16);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        world.generateChunk(ccx + dx, ccz + dz);
      }
    }
    assert.ok(
      world.tileEntities.size > 0 || world.pendingVillagerSpawns.length > 0,
      'Stamped landmark structure should register chests or villagers'
    );
  }
});

test('Creative flight physics disables gravity, ascends/descends, and lands cleanly', () => {
  const floorBlock = (_x: number, y: number, _z: number) =>
    y <= 10 ? BLOCK_IDS.STONE : BLOCK_IDS.AIR;

  const p: PlayerPhysicsState = {
    x: 0.5,
    y: 15.0,
    z: 0.5,
    vx: 0,
    vy: 0,
    vz: 0,
    onGround: false,
    inWater: false,
    headInWater: false,
    crouching: false,
    sprinting: false,
    isFlying: true,
    peakAirY: 15.0,
    coyoteTimer: 0,
  };

  // Hovering in Creative mode keeps altitude without gravity drop
  stepPlayerPhysics(
    p,
    { forward: 0, strafe: 0, jumpHeld: false, jumpJustPressed: false, sprint: false, crouch: false, flyDown: false, yaw: 0 },
    0.05,
    floorBlock
  );
  assert.equal(p.y, 15.0, 'Hovering in flight should not fall');
  assert.equal(p.isFlying, true);

  // Ascending with Space rises cleanly
  const beforeAscend = p.y;
  stepPlayerPhysics(
    p,
    { forward: 0, strafe: 0, jumpHeld: true, jumpJustPressed: false, sprint: false, crouch: false, flyDown: false, yaw: 0 },
    0.05,
    floorBlock
  );
  assert.ok(p.y > beforeAscend, 'Holding Space while flying should ascend');

  // Descending until ground contact automatically disables flight
  for (let i = 0; i < 40 && p.isFlying; i++) {
    stepPlayerPhysics(
      p,
      { forward: 0, strafe: 0, jumpHeld: false, jumpJustPressed: false, sprint: false, crouch: false, flyDown: true, yaw: 0 },
      0.05,
      floorBlock
    );
  }
  assert.equal(p.onGround, true);
  assert.equal(p.isFlying, false, 'Touching solid ground while descending should exit flight');
});

test('v2.0 recipes (Bed, Door, Stairs, Sandstone, Bread) and Villager emerald trades work', () => {
  const s = (id: NonNullable<SlotOrNull>['id']): SlotOrNull => ({ id, count: 1 });
  const W = s(BLOCK_IDS.WHITE_WOOL);
  const P = s(BLOCK_IDS.OAK_PLANKS);
  const C = s(BLOCK_IDS.COBBLESTONE);
  const Sa = s(BLOCK_IDS.SAND);
  const Wh = s('wheat');

  assert.equal(matchRecipe([W, W, W, P, P, P, null, null, null], 3)?.result.id, BLOCK_IDS.BED);
  assert.equal(matchRecipe([P, P, null, P, P, null, P, P, null], 3)?.result.id, BLOCK_IDS.OAK_DOOR);
  assert.equal(matchRecipe([C, null, null, C, C, null, C, C, C], 3)?.result.id, BLOCK_IDS.COBBLESTONE_STAIRS);
  assert.equal(matchRecipe([Sa, Sa, Sa, Sa], 2)?.result.id, BLOCK_IDS.SANDSTONE);
  assert.equal(matchRecipe([Wh, Wh, Wh, null, null, null, null, null, null], 3)?.result.id, 'bread');

  // Villager trade execution
  const inv: SlotOrNull[] = new Array(36).fill(null);
  addItemToInventory(inv, BLOCK_IDS.OAK_LOG, 20);
  const offer = VILLAGER_TRADES.farmer[0]; // 16 Oak Logs -> 1 Emerald
  assert.equal(executeVillagerTrade(inv, offer), true);
  assert.equal(countItemInInventory(inv, BLOCK_IDS.OAK_LOG), 4);
  assert.equal(countItemInInventory(inv, 'emerald'), 1);
  // Second trade fails due to insufficient logs
  assert.equal(executeVillagerTrade(inv, offer), false);
});

test('Multi-world storage CRUD, global settings, and Fog-of-War chunk slice codec round-trip', () => {
  const mem = new Map<string, string>();
  const fakeStorage = {
    get length() {
      return mem.size;
    },
    clear() {
      mem.clear();
    },
    getItem(k: string) {
      return mem.get(k) ?? null;
    },
    key(i: number) {
      return Array.from(mem.keys())[i] ?? null;
    },
    removeItem(k: string) {
      mem.delete(k);
    },
    setItem(k: string, v: string) {
      mem.set(k, v);
    },
  };
  const prevStorage = (globalThis as unknown as { localStorage?: Storage }).localStorage;
  (globalThis as unknown as { localStorage?: Storage }).localStorage = fakeStorage as unknown as Storage;

  try {
    saveGlobalSettings({
      sensitivity: 1.4,
      renderDistance: 6,
      volume: 65,
      touchControlsMode: 'on',
      graphicsQuality: 'fast',
    });
    const loadedSettings = loadGlobalSettings();
    assert.equal(loadedSettings.renderDistance, 6);
    assert.equal(loadedSettings.graphicsQuality, 'fast');
    assert.equal(loadedSettings.touchControlsMode, 'on');

    const worldSave: SavedWorldData = {
      version: 3,
      id: 'w_test_1',
      name: 'Aldea Norte',
      gameMode: 'creative',
      difficulty: 'normal',
      worldType: 'default',
      bonusChest: false,
      lastPlayed: Date.now(),
      seed: 123456,
      seedLabel: '123456',
      worldTime: 2400,
      dayCount: 3,
      weather: 'clear',
      player: { x: 1, y: 65, z: 2, yaw: 0, pitch: 0, health: 20, hunger: 20, oxygen: 10, selectedSlot: 0 },
      inventory: new Array(36).fill(null),
      armor: [null, null, null, null],
      blockEdits: [],
      tileEntities: [],
      waypoints: [{ id: 'wp1', name: 'Base', x: 10, z: -5, color: '#ef4444' }],
      discoveredStructures: [],
      exploredChunks: {},
      stats: { blocksMined: 2, blocksPlaced: 4, mobsDefeated: 0, dayReached: 3 },
    };

    assert.equal(saveWorldData(worldSave), true);
    const list = listWorlds();
    assert.equal(list.length, 1);
    assert.equal(list[0].name, 'Aldea Norte');
    assert.equal(list[0].gameMode, 'creative');

    const loaded = loadWorldById('w_test_1');
    assert.ok(loaded);
    assert.equal(loaded?.waypoints?.[0]?.name, 'Base');

    const afterDelete = deleteWorldById('w_test_1');
    assert.equal(afterDelete.length, 0);
    assert.equal(loadWorldById('w_test_1'), null);
  } finally {
    if (prevStorage === undefined) {
      delete (globalThis as unknown as { localStorage?: Storage }).localStorage;
    } else {
      (globalThis as unknown as { localStorage?: Storage }).localStorage = prevStorage;
    }
  }

  // Fog-of-War base64 chunk slice round-trip
  const flatWorld = new World(777, 'superflat');
  const chunk = flatWorld.generateChunk(0, 0);
  const encoded = flatWorld.encodeChunkMapSlice(chunk);
  const decoded = decodeChunkMapSlice(encoded);
  assert.equal(decoded.length, 256);
  assert.equal(decoded[0] & 0x3f, BLOCK_IDS.GRASS);
});

test('Nether block catalog (36..46), Diamond pickaxe Obsidian rule, explosion resistance & Creative catalog', () => {
  for (let id = 36; id <= 46; id++) {
    assert.ok(BLOCKS[id], `Nether Block ID ${id} should exist`);
    assert.ok(BLOCKS[id].mapColor, `Nether Block ID ${id} should define mapColor`);
  }
  assert.equal(BLOCKS[BLOCK_IDS.OBSIDIAN].explosionResistant, true);
  assert.equal(BLOCKS[BLOCK_IDS.NETHER_BRICKS].explosionResistant, true);
  assert.equal(BLOCKS[BLOCK_IDS.BEDROCK].explosionResistant, true);
  assert.equal(BLOCKS[BLOCK_IDS.NETHERRACK].explosionResistant, undefined);

  assert.equal(BLOCKS[BLOCK_IDS.GLOWSTONE].lightLevel, 15);
  assert.equal(BLOCKS[BLOCK_IDS.LAVA].lightLevel, 15);
  assert.equal(BLOCKS[BLOCK_IDS.FIRE].lightLevel, 15);
  assert.equal(BLOCKS[BLOCK_IDS.NETHER_PORTAL].lightLevel, 11);
  assert.equal(BLOCKS[BLOCK_IDS.MAGMA_BLOCK].lightLevel, 5);
  assert.equal(BLOCKS[BLOCK_IDS.FIRE].crossMesh, true);
  assert.equal(LAVA_LEVEL, 31);

  // Obsidian requires Diamond pickaxe
  assert.equal(canHarvestBlock(BLOCK_IDS.OBSIDIAN, null), false);
  assert.equal(canHarvestBlock(BLOCK_IDS.OBSIDIAN, 'iron_pickaxe'), false);
  assert.equal(canHarvestBlock(BLOCK_IDS.OBSIDIAN, 'diamond_pickaxe'), true);

  // Creative catalog exposes Nether essentials
  const allCreative = [
    ...CREATIVE_CATALOG.building,
    ...CREATIVE_CATALOG.nature,
    ...CREATIVE_CATALOG.tools,
    ...CREATIVE_CATALOG.misc,
  ].map((d) => d.id);
  assert.ok(allCreative.includes(BLOCK_IDS.OBSIDIAN));
  assert.ok(allCreative.includes(BLOCK_IDS.NETHERRACK));
  assert.ok(allCreative.includes(BLOCK_IDS.GLOWSTONE));
  assert.ok(allCreative.includes(BLOCK_IDS.NETHER_BRICKS));
  assert.ok(allCreative.includes('flint_and_steel'));
});

test('All 7 Nether crafting recipes match accurately', () => {
  const s = (id: NonNullable<SlotOrNull>['id']): SlotOrNull => ({ id, count: 1 });
  const C = s(BLOCK_IDS.COBBLESTONE);
  const I = s('iron_ingot');
  const Fl = s('flint');
  const Q = s('nether_quartz');
  const Gd = s('glowstone_dust');
  const Br = s('blaze_rod');
  const Gn = s('gold_nugget');
  const Nr = s(BLOCK_IDS.NETHERRACK);

  // 1. 2 Cobblestone -> 1 Flint
  const flint = matchRecipe([C, C, null, null], 2);
  assert.equal(flint?.result.id, 'flint');
  assert.equal(flint?.result.count, 1);

  // 2. Iron Ingot + Flint -> Flint & Steel
  const fns = matchRecipe([I, null, null, Fl], 2);
  assert.equal(fns?.result.id, 'flint_and_steel');

  // 3. 2x2 Nether Quartz -> Quartz Block
  assert.equal(matchRecipe([Q, Q, Q, Q], 2)?.result.id, BLOCK_IDS.QUARTZ_BLOCK);

  // 4. 2x2 Glowstone Dust -> Glowstone
  assert.equal(matchRecipe([Gd, Gd, Gd, Gd], 2)?.result.id, BLOCK_IDS.GLOWSTONE);

  // 5. 1 Blaze Rod -> 2 Blaze Powder
  const bp = matchRecipe([Br, null, null, null], 2);
  assert.equal(bp?.result.id, 'blaze_powder');
  assert.equal(bp?.result.count, 2);

  // 6. 3x3 Gold Nuggets -> 1 Gold Ingot
  assert.equal(matchRecipe([Gn, Gn, Gn, Gn, Gn, Gn, Gn, Gn, Gn], 3)?.result.id, 'gold_ingot');

  // 7. 2x2 Netherrack -> 2 Nether Bricks
  const nb = matchRecipe([Nr, Nr, Nr, Nr], 2);
  assert.equal(nb?.result.id, BLOCK_IDS.NETHER_BRICKS);
  assert.equal(nb?.result.count, 2);
});

test('Nether Portal frame validation (XY/ZY, cornerless), 1:8 scaling, and safe return portal builder', () => {
  const voxels = new Map<string, number>();
  const getB = (x: number, y: number, z: number) => voxels.get(`${x},${y},${z}`) ?? BLOCK_IDS.AIR;
  const setB = (x: number, y: number, z: number, id: number) => voxels.set(`${x},${y},${z}`, id);

  // Build a classic cornerless 4x5 Obsidian frame along XY plane at z=0 (interior x=1..2, y=10..12)
  setB(1, 9, 0, BLOCK_IDS.OBSIDIAN);
  setB(2, 9, 0, BLOCK_IDS.OBSIDIAN);
  setB(1, 13, 0, BLOCK_IDS.OBSIDIAN);
  setB(2, 13, 0, BLOCK_IDS.OBSIDIAN);
  for (let y = 10; y <= 12; y++) {
    setB(0, y, 0, BLOCK_IDS.OBSIDIAN);
    setB(3, y, 0, BLOCK_IDS.OBSIDIAN);
  }
  const frameXY = findValidPortalFrame(getB, 1, 10, 0);
  assert.ok(frameXY, 'Cornerless 2x3 XY Obsidian frame must validate');
  assert.equal(frameXY?.axis, 'x');
  assert.equal(frameXY?.width, 2);
  assert.equal(frameXY?.height, 3);
  assert.equal(frameXY?.interiorCells.length, 6);

  // Break one side block -> must become invalid
  setB(0, 11, 0, BLOCK_IDS.AIR);
  assert.equal(findValidPortalFrame(getB, 1, 10, 0), null, 'Broken Obsidian frame must fail validation');

  // Build a ZY frame at x=20 (interior z=1..2, y=20..22)
  for (let z = 1; z <= 2; z++) {
    setB(20, 19, z, BLOCK_IDS.OBSIDIAN);
    setB(20, 23, z, BLOCK_IDS.OBSIDIAN);
  }
  for (let y = 20; y <= 22; y++) {
    setB(20, y, 0, BLOCK_IDS.OBSIDIAN);
    setB(20, y, 3, BLOCK_IDS.OBSIDIAN);
  }
  const frameZY = findValidPortalFrame(getB, 20, 21, 2);
  assert.ok(frameZY, 'ZY Obsidian frame must validate');
  assert.equal(frameZY?.axis, 'z');

  // 1:8 / 8:1 coordinate scaling
  assert.deepEqual(scalePortalCoordinates(80, -64, 'overworld', 'nether'), { x: 10, z: -8 });
  assert.deepEqual(scalePortalCoordinates(10, -8, 'nether', 'overworld'), { x: 80, z: -64 });

  // Safe return portal construction + findNearestPortal
  const retVoxels = new Map<string, number>();
  const arrival = buildSafeReturnPortal(
    (x, y, z, id) => retVoxels.set(`${x},${y},${z}`, id),
    10,
    46,
    -8
  );
  const getRet = (x: number, y: number, z: number) => retVoxels.get(`${x},${y},${z}`) ?? BLOCK_IDS.AIR;
  assert.equal(getRet(Math.floor(arrival.x), Math.floor(arrival.y) - 1, Math.floor(arrival.z)), BLOCK_IDS.OBSIDIAN);
  assert.equal(getRet(Math.floor(arrival.x), Math.floor(arrival.y), Math.floor(arrival.z)), BLOCK_IDS.AIR);
  const nearest = findNearestPortal(getRet, 10, -8, 16);
  assert.ok(nearest, 'findNearestPortal should locate freshly constructed return portal');
  assert.equal(nearest?.y, 46);
});

test('Nether world generation, Bedrock ceiling/floor, Lava sea, Fortress stamping & below-roof map scan', () => {
  const nether = new World(42073, 'default', 'nether');
  let sawNetherrack = false;
  let sawLava = false;
  let sawQuartz = false;
  let sawNonBedrockMap = false;

  for (let cz = -1; cz <= 1; cz++) {
    for (let cx = -1; cx <= 1; cx++) {
      const chunk = nether.generateChunk(cx, cz);
      // Bedrock floor at Y=0 and Bedrock ceiling at Y=127
      assert.equal(chunk.getBlock(4, 0, 4), BLOCK_IDS.BEDROCK);
      assert.equal(chunk.getBlock(4, 127, 4), BLOCK_IDS.BEDROCK);
      // No sunlight in Nether
      assert.equal(chunk.getSkyLight(8, 60, 8), 0);

      for (let i = 0; i < chunk.blocks.length; i++) {
        const b = chunk.blocks[i];
        if (b === BLOCK_IDS.NETHERRACK) sawNetherrack = true;
        if (b === BLOCK_IDS.LAVA) sawLava = true;
        if (b === BLOCK_IDS.NETHER_QUARTZ_ORE) sawQuartz = true;
      }

      const slice = decodeChunkMapSlice(nether.encodeChunkMapSlice(chunk));
      for (let i = 0; i < slice.length; i++) {
        if ((slice[i] & 0x3f) !== BLOCK_IDS.BEDROCK) {
          sawNonBedrockMap = true;
          break;
        }
      }
    }
  }
  assert.ok(sawNetherrack, 'Nether chunks must contain Netherrack');
  assert.ok(sawLava, 'Nether chunks must generate Y=31 Lava ocean');
  assert.ok(sawQuartz, 'Nether chunks must generate Nether Quartz Ore veins');
  assert.ok(sawNonBedrockMap, 'Nether map slice must scan below Bedrock ceiling');

  // Verify guaranteed Fortress in region (0, 0) stamps Nether Bricks, chests, and Blaze spawns
  const fortress = nether.structures.getRegionStructure(0, 0);
  assert.ok(fortress && fortress.type === 'nether_fortress', 'Region (0,0) in Nether must plan a Nether Fortress');
  if (fortress) {
    const fcx = Math.floor(fortress.centerX / 16);
    const fcz = Math.floor(fortress.centerZ / 16);
    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) {
        nether.generateChunk(fcx + dx, fcz + dz);
      }
    }
    assert.ok(nether.tileEntities.size >= 1, 'Nether Fortress should populate treasure vault chests');
    assert.ok(nether.pendingBlazeSpawns.length >= 1, 'Nether Fortress should schedule Blaze spawns');
  }
});

test('Soul Sand 40% slow, Lava 65% slow, and multi-dimension v4 persistence round-trip', () => {
  // Compare walking speed on Stone vs Soul Sand
  const makePlayer = (): PlayerPhysicsState => ({
    x: 0.5,
    y: 11.0,
    z: 0.5,
    vx: 0,
    vy: 0,
    vz: 0,
    onGround: true,
    inWater: false,
    headInWater: false,
    crouching: false,
    sprinting: false,
    peakAirY: 11.0,
    coyoteTimer: 0.09,
  });

  const pStone = makePlayer();
  const pSoul = makePlayer();
  const pLava = makePlayer();
  for (let i = 0; i < 20; i++) {
    stepPlayerPhysics(
      pStone,
      { forward: 1, strafe: 0, jumpHeld: false, jumpJustPressed: false, sprint: false, crouch: false, yaw: 0 },
      0.05,
      (_x, y) => (y <= 10 ? BLOCK_IDS.STONE : BLOCK_IDS.AIR)
    );
    stepPlayerPhysics(
      pSoul,
      { forward: 1, strafe: 0, jumpHeld: false, jumpJustPressed: false, sprint: false, crouch: false, yaw: 0 },
      0.05,
      (_x, y) => (y <= 10 ? BLOCK_IDS.SOUL_SAND : BLOCK_IDS.AIR)
    );
    stepPlayerPhysics(
      pLava,
      { forward: 1, strafe: 0, jumpHeld: false, jumpJustPressed: false, sprint: false, crouch: false, yaw: 0 },
      0.05,
      (_x, y) => (y <= 10 ? BLOCK_IDS.STONE : y === 11 ? BLOCK_IDS.LAVA : BLOCK_IDS.AIR)
    );
  }
  const distStone = Math.abs(pStone.z - 0.5);
  const distSoul = Math.abs(pSoul.z - 0.5);
  const distLava = Math.abs(pLava.z - 0.5);
  assert.equal(pSoul.onSoulSand, true);
  assert.equal(pLava.inLava, true);
  assert.ok(distSoul < distStone * 0.72, `Soul Sand distance (${distSoul}) should be ~60% of Stone (${distStone})`);
  assert.ok(distLava < distStone * 0.5, `Lava distance (${distLava}) should be ~35% of Stone (${distStone})`);

  // Multi-dimension v4 JSON validation & independent slices
  const v4 = JSON.stringify({
    version: 4,
    id: 'w_nether_v4',
    name: 'Expedición Nether',
    currentDimension: 'nether',
    gameMode: 'survival',
    difficulty: 'normal',
    worldType: 'default',
    lastPlayed: Date.now(),
    seed: 998877,
    worldTime: 6000,
    dayCount: 4,
    player: { x: 2.5, y: 50, z: -3.5, yaw: 0, pitch: 0, health: 18, hunger: 18, oxygen: 10, selectedSlot: 0 },
    inventory: new Array(36).fill(null),
    blockEdits: [[0, 64, 0, BLOCK_IDS.OBSIDIAN]],
    overworld: {
      blockEdits: [[0, 64, 0, BLOCK_IDS.OBSIDIAN]],
      tileEntities: [],
      exploredChunks: { '0,0': 'AAAA' },
      discoveredStructures: [],
      waypoints: [{ id: 'w1', name: 'Portal Casa', x: 0, z: 0, color: '#a855f7' }],
    },
    nether: {
      blockEdits: [[1, 46, 1, BLOCK_IDS.NETHER_PORTAL]],
      tileEntities: [],
      exploredChunks: { '0,0': 'BBBB' },
      discoveredStructures: [{ id: 'nf1', type: 'nether_fortress', name: 'Fortaleza del Nether', x: 40, z: -20 }],
      waypoints: [{ id: 'w2', name: 'Fortaleza', x: 40, z: -20, color: '#ef4444' }],
    },
    stats: { blocksMined: 12, blocksPlaced: 20, mobsDefeated: 3, dayReached: 4 },
  });
  const parsed = validateSavedWorldJson(v4);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.data?.currentDimension, 'nether');
  assert.equal(parsed.data?.overworld?.waypoints.length, 1);
  assert.equal(parsed.data?.nether?.discoveredStructures[0]?.type, 'nether_fortress');
  assert.equal(parsed.data?.nether?.blockEdits[0]?.[3], BLOCK_IDS.NETHER_PORTAL);
});



