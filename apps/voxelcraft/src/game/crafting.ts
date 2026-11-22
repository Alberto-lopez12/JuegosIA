import { ALL_LOG_IDS, ALL_PLANKS_IDS, BLOCK_IDS, getItemDef } from './blocks';
import type { ItemId, SlotOrNull, TradeOffer, VillagerProfession } from './types';

export interface CraftingRecipe {
  id: string;
  name: string;
  type: 'shaped' | 'shapeless';
  pattern?: (ItemId | null)[][];
  ingredients?: ItemId[];
  /** When true, any of the 5 wood plank types matches OAK_PLANKS in this recipe */
  acceptsAnyPlank?: boolean;
  result: { id: ItemId; count: number };
}

export interface SmeltRecipe {
  id: string;
  name: string;
  input: ItemId;
  output: ItemId;
}

const B = BLOCK_IDS;

function toolSet(
  prefix: 'wood' | 'stone' | 'iron' | 'gold' | 'diamond' | 'netherite',
  label: string,
  mat: ItemId,
  hasHoe: boolean,
  acceptsAnyPlank = false
): CraftingRecipe[] {
  const list: CraftingRecipe[] = [
    {
      id: `${prefix}_pickaxe`,
      name: `Pico de ${label}`,
      type: 'shaped',
      acceptsAnyPlank,
      pattern: [
        [mat, mat, mat],
        [null, 'stick', null],
        [null, 'stick', null],
      ],
      result: { id: `${prefix}_pickaxe` as ItemId, count: 1 },
    },
    {
      id: `${prefix}_axe`,
      name: `Hacha de ${label}`,
      type: 'shaped',
      acceptsAnyPlank,
      pattern: [
        [mat, mat],
        [mat, 'stick'],
        [null, 'stick'],
      ],
      result: { id: `${prefix}_axe` as ItemId, count: 1 },
    },
    {
      id: `${prefix}_shovel`,
      name: `Pala de ${label}`,
      type: 'shaped',
      acceptsAnyPlank,
      pattern: [[mat], ['stick'], ['stick']],
      result: { id: `${prefix}_shovel` as ItemId, count: 1 },
    },
    {
      id: `${prefix}_sword`,
      name: `Espada de ${label}`,
      type: 'shaped',
      acceptsAnyPlank,
      pattern: [[mat], [mat], ['stick']],
      result: { id: `${prefix}_sword` as ItemId, count: 1 },
    },
  ];
  if (hasHoe) {
    list.push({
      id: `${prefix}_hoe`,
      name: `Azada de ${label}`,
      type: 'shaped',
      acceptsAnyPlank,
      pattern: [
        [mat, mat],
        [null, 'stick'],
        [null, 'stick'],
      ],
      result: { id: `${prefix}_hoe` as ItemId, count: 1 },
    });
  }
  return list;
}

function armorSet(
  prefix: 'leather' | 'iron' | 'diamond' | 'netherite',
  label: string,
  mat: ItemId,
  acceptsAnyPlank = false
): CraftingRecipe[] {
  return [
    {
      id: `${prefix}_helmet`,
      name: `Casco de ${label}`,
      type: 'shaped',
      acceptsAnyPlank,
      pattern: [
        [mat, mat, mat],
        [mat, null, mat],
      ],
      result: { id: `${prefix}_helmet` as ItemId, count: 1 },
    },
    {
      id: `${prefix}_chestplate`,
      name: `Pechera de ${label}`,
      type: 'shaped',
      acceptsAnyPlank,
      pattern: [
        [mat, null, mat],
        [mat, mat, mat],
        [mat, mat, mat],
      ],
      result: { id: `${prefix}_chestplate` as ItemId, count: 1 },
    },
    {
      id: `${prefix}_leggings`,
      name: `Grebas de ${label}`,
      type: 'shaped',
      acceptsAnyPlank,
      pattern: [
        [mat, mat, mat],
        [mat, null, mat],
        [mat, null, mat],
      ],
      result: { id: `${prefix}_leggings` as ItemId, count: 1 },
    },
    {
      id: `${prefix}_boots`,
      name: `Botas de ${label}`,
      type: 'shaped',
      acceptsAnyPlank,
      pattern: [
        [mat, null, mat],
        [mat, null, mat],
      ],
      result: { id: `${prefix}_boots` as ItemId, count: 1 },
    },
  ];
}

function mineralStoragePair(
  id: string,
  blockLabel: string,
  unitLabel: string,
  unitId: ItemId,
  blockId: number
): CraftingRecipe[] {
  return [
    {
      id: `${id}_block`,
      name: blockLabel,
      type: 'shaped',
      pattern: [
        [unitId, unitId, unitId],
        [unitId, unitId, unitId],
        [unitId, unitId, unitId],
      ],
      result: { id: blockId, count: 1 },
    },
    {
      id: `${id}_from_block`,
      name: `${unitLabel} (x9)`,
      type: 'shapeless',
      ingredients: [blockId],
      result: { id: unitId, count: 9 },
    },
  ];
}

const DYE_MAPPINGS: Array<{
  dye: ItemId;
  wool: number;
  concrete: number;
  terracotta: number;
  glass: number;
  label: string;
}> = [
  { dye: 'white_dye', wool: B.WHITE_WOOL, concrete: B.WHITE_CONCRETE, terracotta: B.WHITE_TERRACOTTA, glass: B.WHITE_STAINED_GLASS, label: 'Blanco' },
  { dye: 'orange_dye', wool: B.ORANGE_WOOL, concrete: B.ORANGE_CONCRETE, terracotta: B.ORANGE_TERRACOTTA, glass: B.ORANGE_STAINED_GLASS, label: 'Naranja' },
  { dye: 'yellow_dye', wool: B.YELLOW_WOOL, concrete: B.YELLOW_CONCRETE, terracotta: B.YELLOW_TERRACOTTA, glass: B.YELLOW_STAINED_GLASS, label: 'Amarillo' },
  { dye: 'green_dye', wool: B.GREEN_WOOL, concrete: B.GREEN_CONCRETE, terracotta: B.GREEN_TERRACOTTA, glass: B.GREEN_STAINED_GLASS, label: 'Verde' },
  { dye: 'blue_dye', wool: B.BLUE_WOOL, concrete: B.BLUE_CONCRETE, terracotta: B.BLUE_TERRACOTTA, glass: B.BLUE_STAINED_GLASS, label: 'Azul' },
  { dye: 'purple_dye', wool: B.PURPLE_WOOL, concrete: B.PURPLE_CONCRETE, terracotta: B.PURPLE_TERRACOTTA, glass: B.PURPLE_STAINED_GLASS, label: 'Morado' },
  { dye: 'red_dye', wool: B.RED_WOOL, concrete: B.RED_CONCRETE, terracotta: B.RED_TERRACOTTA, glass: B.RED_STAINED_GLASS, label: 'Rojo' },
  { dye: 'black_dye', wool: B.BLACK_WOOL, concrete: B.BLACK_CONCRETE, terracotta: B.BLACK_TERRACOTTA, glass: B.BLACK_STAINED_GLASS, label: 'Negro' },
];

const DYE_RECIPES: CraftingRecipe[] = [];
for (const dm of DYE_MAPPINGS) {
  if (dm.wool !== B.WHITE_WOOL) {
    DYE_RECIPES.push({
      id: `wool_${dm.dye}`,
      name: `Lana (${dm.label})`,
      type: 'shapeless',
      ingredients: [B.WHITE_WOOL, dm.dye],
      result: { id: dm.wool, count: 1 },
    });
  }
  DYE_RECIPES.push(
    {
      id: `concrete_${dm.dye}`,
      name: `Hormigón (${dm.label})`,
      type: 'shapeless',
      ingredients: [B.SAND, B.GRAVEL, dm.dye],
      result: { id: dm.concrete, count: 4 },
    },
    {
      id: `terracotta_${dm.dye}`,
      name: `Terracota (${dm.label})`,
      type: 'shapeless',
      ingredients: [B.CLAY_BLOCK, dm.dye],
      result: { id: dm.terracotta, count: 4 },
    },
    {
      id: `stained_glass_${dm.dye}`,
      name: `Cristal Tintado (${dm.label})`,
      type: 'shapeless',
      ingredients: [B.GLASS, dm.dye],
      result: { id: dm.glass, count: 2 },
    }
  );
}

export const RECIPES: CraftingRecipe[] = [
  // === WOOD FAMILIES ===
  { id: 'oak_planks', name: 'Tablones de Roble', type: 'shapeless', ingredients: [B.OAK_LOG], result: { id: B.OAK_PLANKS, count: 4 } },
  { id: 'birch_planks', name: 'Tablones de Abedul', type: 'shapeless', ingredients: [B.BIRCH_LOG], result: { id: B.BIRCH_PLANKS, count: 4 } },
  { id: 'spruce_planks', name: 'Tablones de Abeto', type: 'shapeless', ingredients: [B.SPRUCE_LOG], result: { id: B.SPRUCE_PLANKS, count: 4 } },
  { id: 'jungle_planks', name: 'Tablones de Jungla', type: 'shapeless', ingredients: [B.JUNGLE_LOG], result: { id: B.JUNGLE_PLANKS, count: 4 } },
  { id: 'acacia_planks', name: 'Tablones de Acacia', type: 'shapeless', ingredients: [B.ACACIA_LOG], result: { id: B.ACACIA_PLANKS, count: 4 } },

  // === BASIC & UTILITY BLOCKS ===
  {
    id: 'sticks',
    name: 'Palos',
    type: 'shaped',
    acceptsAnyPlank: true,
    pattern: [[B.OAK_PLANKS], [B.OAK_PLANKS]],
    result: { id: 'stick', count: 4 },
  },
  {
    id: 'crafting_table',
    name: 'Mesa de Crafteo',
    type: 'shaped',
    acceptsAnyPlank: true,
    pattern: [
      [B.OAK_PLANKS, B.OAK_PLANKS],
      [B.OAK_PLANKS, B.OAK_PLANKS],
    ],
    result: { id: B.CRAFTING_TABLE, count: 1 },
  },
  {
    id: 'chest',
    name: 'Cofre',
    type: 'shaped',
    acceptsAnyPlank: true,
    pattern: [
      [B.OAK_PLANKS, B.OAK_PLANKS, B.OAK_PLANKS],
      [B.OAK_PLANKS, null, B.OAK_PLANKS],
      [B.OAK_PLANKS, B.OAK_PLANKS, B.OAK_PLANKS],
    ],
    result: { id: B.CHEST, count: 1 },
  },
  {
    id: 'furnace',
    name: 'Horno',
    type: 'shaped',
    pattern: [
      [B.COBBLESTONE, B.COBBLESTONE, B.COBBLESTONE],
      [B.COBBLESTONE, null, B.COBBLESTONE],
      [B.COBBLESTONE, B.COBBLESTONE, B.COBBLESTONE],
    ],
    result: { id: B.FURNACE, count: 1 },
  },
  {
    id: 'torches',
    name: 'Antorchas',
    type: 'shaped',
    pattern: [['coal'], ['stick']],
    result: { id: B.TORCH, count: 4 },
  },
  {
    id: 'torches_charcoal',
    name: 'Antorchas (Carbón Vegetal)',
    type: 'shaped',
    pattern: [['charcoal'], ['stick']],
    result: { id: B.TORCH, count: 4 },
  },
  {
    id: 'lantern',
    name: 'Farol',
    type: 'shaped',
    pattern: [
      ['iron_ingot', 'iron_ingot', 'iron_ingot'],
      ['iron_ingot', B.TORCH, 'iron_ingot'],
      ['iron_ingot', 'iron_ingot', 'iron_ingot'],
    ],
    result: { id: B.LANTERN, count: 2 },
  },
  {
    id: 'sea_lantern',
    name: 'Linterna Marina',
    type: 'shaped',
    pattern: [
      [B.GLASS, 'lapis_lazuli', B.GLASS],
      ['lapis_lazuli', B.GLOWSTONE, 'lapis_lazuli'],
      [B.GLASS, 'lapis_lazuli', B.GLASS],
    ],
    result: { id: B.SEA_LANTERN, count: 2 },
  },
  {
    id: 'redstone_lamp',
    name: 'Lámpara de Redstone',
    type: 'shaped',
    pattern: [
      [null, 'redstone_dust', null],
      ['redstone_dust', B.GLOWSTONE, 'redstone_dust'],
      [null, 'redstone_dust', null],
    ],
    result: { id: B.REDSTONE_LAMP, count: 1 },
  },
  {
    id: 'tnt',
    name: 'TNT',
    type: 'shaped',
    pattern: [
      ['gunpowder', B.SAND, 'gunpowder'],
      [B.SAND, 'gunpowder', B.SAND],
      ['gunpowder', B.SAND, 'gunpowder'],
    ],
    result: { id: B.TNT, count: 1 },
  },
  {
    id: 'bookshelf',
    name: 'Estantería',
    type: 'shaped',
    acceptsAnyPlank: true,
    pattern: [
      [B.OAK_PLANKS, B.OAK_PLANKS, B.OAK_PLANKS],
      ['book', 'book', 'book'],
      [B.OAK_PLANKS, B.OAK_PLANKS, B.OAK_PLANKS],
    ],
    result: { id: B.BOOKSHELF, count: 1 },
  },
  {
    id: 'jukebox',
    name: 'Tocadiscos',
    type: 'shaped',
    acceptsAnyPlank: true,
    pattern: [
      [B.OAK_PLANKS, B.OAK_PLANKS, B.OAK_PLANKS],
      [B.OAK_PLANKS, 'diamond', B.OAK_PLANKS],
      [B.OAK_PLANKS, B.OAK_PLANKS, B.OAK_PLANKS],
    ],
    result: { id: B.JUKEBOX, count: 1 },
  },
  {
    id: 'ladder',
    name: 'Escalera de Mano',
    type: 'shaped',
    pattern: [
      ['stick', null, 'stick'],
      ['stick', 'stick', 'stick'],
      ['stick', null, 'stick'],
    ],
    result: { id: B.LADDER, count: 3 },
  },
  {
    id: 'bed',
    name: 'Cama',
    type: 'shaped',
    acceptsAnyPlank: true,
    pattern: [
      [B.WHITE_WOOL, B.WHITE_WOOL, B.WHITE_WOOL],
      [B.OAK_PLANKS, B.OAK_PLANKS, B.OAK_PLANKS],
    ],
    result: { id: B.BED, count: 1 },
  },
  {
    id: 'oak_door',
    name: 'Puerta de Roble',
    type: 'shaped',
    acceptsAnyPlank: true,
    pattern: [
      [B.OAK_PLANKS, B.OAK_PLANKS],
      [B.OAK_PLANKS, B.OAK_PLANKS],
      [B.OAK_PLANKS, B.OAK_PLANKS],
    ],
    result: { id: B.OAK_DOOR, count: 3 },
  },
  {
    id: 'iron_door',
    name: 'Puerta de Hierro',
    type: 'shaped',
    pattern: [
      ['iron_ingot', 'iron_ingot'],
      ['iron_ingot', 'iron_ingot'],
      ['iron_ingot', 'iron_ingot'],
    ],
    result: { id: B.IRON_DOOR, count: 3 },
  },
  {
    id: 'oak_fence',
    name: 'Valla de Roble',
    type: 'shaped',
    acceptsAnyPlank: true,
    pattern: [
      [B.OAK_PLANKS, 'stick', B.OAK_PLANKS],
      [B.OAK_PLANKS, 'stick', B.OAK_PLANKS],
    ],
    result: { id: B.OAK_FENCE, count: 3 },
  },
  {
    id: 'oak_slab',
    name: 'Losa de Roble',
    type: 'shaped',
    acceptsAnyPlank: true,
    pattern: [[B.OAK_PLANKS, B.OAK_PLANKS, B.OAK_PLANKS]],
    result: { id: B.OAK_SLAB, count: 6 },
  },
  {
    id: 'stone_brick_slab',
    name: 'Losa de Ladrillos de Piedra',
    type: 'shaped',
    pattern: [[B.STONE_BRICKS, B.STONE_BRICKS, B.STONE_BRICKS]],
    result: { id: B.STONE_BRICK_SLAB, count: 6 },
  },
  {
    id: 'cobblestone_wall',
    name: 'Muro de Piedra',
    type: 'shaped',
    pattern: [
      [B.COBBLESTONE, B.COBBLESTONE, B.COBBLESTONE],
      [B.COBBLESTONE, B.COBBLESTONE, B.COBBLESTONE],
    ],
    result: { id: B.COBBLESTONE_WALL, count: 6 },
  },
  {
    id: 'cobblestone_stairs',
    name: 'Escaleras de Piedra',
    type: 'shaped',
    pattern: [
      [B.COBBLESTONE, null, null],
      [B.COBBLESTONE, B.COBBLESTONE, null],
      [B.COBBLESTONE, B.COBBLESTONE, B.COBBLESTONE],
    ],
    result: { id: B.COBBLESTONE_STAIRS, count: 4 },
  },
  {
    id: 'jack_o_lantern',
    name: 'Calabaza Iluminada',
    type: 'shaped',
    pattern: [[B.PUMPKIN], [B.TORCH]],
    result: { id: B.JACK_O_LANTERN, count: 1 },
  },
  {
    id: 'hay_bale',
    name: 'Bala de Heno',
    type: 'shaped',
    pattern: [
      ['wheat', 'wheat', 'wheat'],
      ['wheat', 'wheat', 'wheat'],
      ['wheat', 'wheat', 'wheat'],
    ],
    result: { id: B.HAY_BALE, count: 1 },
  },
  {
    id: 'wheat_from_hay',
    name: 'Trigo (x9)',
    type: 'shapeless',
    ingredients: [B.HAY_BALE],
    result: { id: 'wheat', count: 9 },
  },
  {
    id: 'packed_ice',
    name: 'Hielo Compacto',
    type: 'shaped',
    pattern: [
      [B.ICE, B.ICE],
      [B.ICE, B.ICE],
    ],
    result: { id: B.PACKED_ICE, count: 1 },
  },

  // === STONES & ARCHITECTURAL BRICKS ===
  {
    id: 'stone_bricks',
    name: 'Ladrillos de Piedra',
    type: 'shaped',
    pattern: [
      [B.STONE, B.STONE],
      [B.STONE, B.STONE],
    ],
    result: { id: B.STONE_BRICKS, count: 4 },
  },
  {
    id: 'chiseled_stone_bricks',
    name: 'Ladrillos Cincelados',
    type: 'shaped',
    pattern: [[B.STONE_BRICK_SLAB], [B.STONE_BRICK_SLAB]],
    result: { id: B.CHISELED_STONE_BRICKS, count: 1 },
  },
  {
    id: 'mossy_stone_bricks',
    name: 'Ladrillos Musgosos',
    type: 'shapeless',
    ingredients: [B.STONE_BRICKS, B.TALL_GRASS],
    result: { id: B.MOSSY_STONE_BRICKS, count: 1 },
  },
  {
    id: 'bricks_from_clay',
    name: 'Ladrillos de Arcilla',
    type: 'shaped',
    pattern: [
      ['brick', 'brick'],
      ['brick', 'brick'],
    ],
    result: { id: B.BRICKS, count: 1 },
  },
  {
    id: 'bricks_cobble',
    name: 'Ladrillos (Adoquín)',
    type: 'shaped',
    pattern: [
      [B.COBBLESTONE, B.DIRT],
      [B.DIRT, B.COBBLESTONE],
    ],
    result: { id: B.BRICKS, count: 4 },
  },
  {
    id: 'polished_granite',
    name: 'Granito Pulido',
    type: 'shaped',
    pattern: [
      [B.GRANITE, B.GRANITE],
      [B.GRANITE, B.GRANITE],
    ],
    result: { id: B.POLISHED_GRANITE, count: 4 },
  },
  {
    id: 'polished_diorite',
    name: 'Diorita Pulida',
    type: 'shaped',
    pattern: [
      [B.DIORITE, B.DIORITE],
      [B.DIORITE, B.DIORITE],
    ],
    result: { id: B.POLISHED_DIORITE, count: 4 },
  },
  {
    id: 'polished_andesite',
    name: 'Andesita Pulida',
    type: 'shaped',
    pattern: [
      [B.ANDESITE, B.ANDESITE],
      [B.ANDESITE, B.ANDESITE],
    ],
    result: { id: B.POLISHED_ANDESITE, count: 4 },
  },
  {
    id: 'deepslate_bricks',
    name: 'Ladrillos de Pizarra',
    type: 'shaped',
    pattern: [
      [B.COBBLED_DEEPSLATE, B.COBBLED_DEEPSLATE],
      [B.COBBLED_DEEPSLATE, B.COBBLED_DEEPSLATE],
    ],
    result: { id: B.DEEPSLATE_BRICKS, count: 4 },
  },
  {
    id: 'sandstone',
    name: 'Arenisca',
    type: 'shaped',
    pattern: [
      [B.SAND, B.SAND],
      [B.SAND, B.SAND],
    ],
    result: { id: B.SANDSTONE, count: 2 },
  },
  {
    id: 'chiseled_sandstone',
    name: 'Arenisca Tallada',
    type: 'shaped',
    pattern: [[B.SANDSTONE], [B.SANDSTONE]],
    result: { id: B.CHISELED_SANDSTONE, count: 2 },
  },
  {
    id: 'red_sandstone',
    name: 'Arenisca Roja',
    type: 'shapeless',
    ingredients: [B.SANDSTONE, 'red_dye'],
    result: { id: B.RED_SANDSTONE, count: 2 },
  },

  // === MINERAL STORAGE BLOCKS (9 -> 1 & 1 -> 9) ===
  ...mineralStoragePair('coal', 'Bloque de Carbón', 'Carbón', 'coal', B.COAL_BLOCK),
  ...mineralStoragePair('iron', 'Bloque de Hierro', 'Lingote de Hierro', 'iron_ingot', B.IRON_BLOCK),
  ...mineralStoragePair('gold', 'Bloque de Oro', 'Lingote de Oro', 'gold_ingot', B.GOLD_BLOCK),
  ...mineralStoragePair('diamond', 'Bloque de Diamante', 'Diamante', 'diamond', B.DIAMOND_BLOCK),
  ...mineralStoragePair('emerald', 'Bloque de Esmeralda', 'Esmeralda', 'emerald', B.EMERALD_BLOCK),
  ...mineralStoragePair('lapis', 'Bloque de Lapislázuli', 'Lapislázuli', 'lapis_lazuli', B.LAPIS_BLOCK),
  ...mineralStoragePair('redstone', 'Bloque de Redstone', 'Polvo de Redstone', 'redstone_dust', B.REDSTONE_BLOCK),
  ...mineralStoragePair('copper', 'Bloque de Cobre', 'Lingote de Cobre', 'copper_ingot', B.COPPER_BLOCK),
  ...mineralStoragePair('netherite', 'Bloque de Netherita', 'Lingote de Netherita', 'netherite_ingot', B.NETHERITE_BLOCK),

  // === FOOD & MATERIALS ===
  {
    id: 'bread',
    name: 'Pan',
    type: 'shaped',
    pattern: [['wheat', 'wheat', 'wheat']],
    result: { id: 'bread', count: 1 },
  },
  {
    id: 'cookie',
    name: 'Galleta',
    type: 'shaped',
    pattern: [['wheat', 'wheat']],
    result: { id: 'cookie', count: 8 },
  },
  {
    id: 'golden_apple',
    name: 'Manzana Dorada',
    type: 'shaped',
    pattern: [
      ['gold_ingot', 'gold_ingot', 'gold_ingot'],
      ['gold_ingot', 'apple', 'gold_ingot'],
      ['gold_ingot', 'gold_ingot', 'gold_ingot'],
    ],
    result: { id: 'golden_apple', count: 1 },
  },
  {
    id: 'paper',
    name: 'Papel',
    type: 'shaped',
    pattern: [[B.SUGAR_CANE, B.SUGAR_CANE, B.SUGAR_CANE]],
    result: { id: 'paper', count: 3 },
  },
  {
    id: 'book',
    name: 'Libro',
    type: 'shapeless',
    ingredients: ['paper', 'paper', 'paper', 'leather'],
    result: { id: 'book', count: 1 },
  },
  {
    id: 'bone_meal',
    name: 'Polvo de Hueso',
    type: 'shapeless',
    ingredients: ['bone'],
    result: { id: 'bone_meal', count: 3 },
  },
  {
    id: 'clay_block_from_balls',
    name: 'Bloque de Arcilla',
    type: 'shaped',
    pattern: [
      ['clay_ball', 'clay_ball'],
      ['clay_ball', 'clay_ball'],
    ],
    result: { id: B.CLAY_BLOCK, count: 1 },
  },

  // === DYES FROM NATURAL ITEMS ===
  { id: 'red_dye', name: 'Tinte Rojo', type: 'shapeless', ingredients: [B.RED_FLOWER], result: { id: 'red_dye', count: 2 } },
  { id: 'yellow_dye', name: 'Tinte Amarillo', type: 'shapeless', ingredients: [B.DANDELION], result: { id: 'yellow_dye', count: 2 } },
  { id: 'blue_dye_orchid', name: 'Tinte Azul (Orquídea)', type: 'shapeless', ingredients: [B.BLUE_ORCHID], result: { id: 'blue_dye', count: 2 } },
  { id: 'blue_dye_lapis', name: 'Tinte Azul (Lapislázuli)', type: 'shapeless', ingredients: ['lapis_lazuli'], result: { id: 'blue_dye', count: 2 } },
  { id: 'orange_dye', name: 'Tinte Naranja', type: 'shapeless', ingredients: ['red_dye', 'yellow_dye'], result: { id: 'orange_dye', count: 2 } },
  { id: 'purple_dye', name: 'Tinte Morado', type: 'shapeless', ingredients: ['red_dye', 'blue_dye'], result: { id: 'purple_dye', count: 2 } },
  { id: 'white_dye', name: 'Tinte Blanco', type: 'shapeless', ingredients: ['bone_meal'], result: { id: 'white_dye', count: 1 } },
  { id: 'black_dye', name: 'Tinte Negro', type: 'shapeless', ingredients: ['coal'], result: { id: 'black_dye', count: 1 } },
  ...DYE_RECIPES,

  // === UTILITY TOOLS, BOW, ARROWS & NETHER ===
  {
    id: 'bow',
    name: 'Arco',
    type: 'shaped',
    pattern: [
      [null, 'stick', 'string'],
      ['stick', null, 'string'],
      [null, 'stick', 'string'],
    ],
    result: { id: 'bow', count: 1 },
  },
  {
    id: 'arrow',
    name: 'Flechas',
    type: 'shaped',
    pattern: [['flint'], ['stick'], ['feather']],
    result: { id: 'arrow', count: 4 },
  },
  {
    id: 'shears',
    name: 'Tijeras',
    type: 'shaped',
    pattern: [
      [null, 'iron_ingot'],
      ['iron_ingot', null],
    ],
    result: { id: 'shears', count: 1 },
  },
  {
    id: 'bucket',
    name: 'Cubo Vacío',
    type: 'shaped',
    pattern: [
      ['iron_ingot', null, 'iron_ingot'],
      [null, 'iron_ingot', null],
    ],
    result: { id: 'bucket', count: 1 },
  },
  {
    id: 'netherite_ingot',
    name: 'Lingote de Netherita',
    type: 'shapeless',
    ingredients: [
      'netherite_scrap',
      'netherite_scrap',
      'netherite_scrap',
      'netherite_scrap',
      'gold_ingot',
      'gold_ingot',
      'gold_ingot',
      'gold_ingot',
    ],
    result: { id: 'netherite_ingot', count: 1 },
  },
  {
    id: 'flint_from_cobble',
    name: 'Pedernal',
    type: 'shapeless',
    ingredients: [B.COBBLESTONE, B.COBBLESTONE],
    result: { id: 'flint', count: 1 },
  },
  {
    id: 'flint_from_gravel',
    name: 'Pedernal (Grava)',
    type: 'shapeless',
    ingredients: [B.GRAVEL, B.GRAVEL],
    result: { id: 'flint', count: 1 },
  },
  {
    id: 'flint_and_steel',
    name: 'Mechero',
    type: 'shapeless',
    ingredients: ['iron_ingot', 'flint'],
    result: { id: 'flint_and_steel', count: 1 },
  },
  {
    id: 'quartz_block',
    name: 'Bloque de Cuarzo',
    type: 'shaped',
    pattern: [
      ['nether_quartz', 'nether_quartz'],
      ['nether_quartz', 'nether_quartz'],
    ],
    result: { id: B.QUARTZ_BLOCK, count: 1 },
  },
  {
    id: 'glowstone_from_dust',
    name: 'Piedra Luminosa',
    type: 'shaped',
    pattern: [
      ['glowstone_dust', 'glowstone_dust'],
      ['glowstone_dust', 'glowstone_dust'],
    ],
    result: { id: B.GLOWSTONE, count: 1 },
  },
  {
    id: 'blaze_powder',
    name: 'Polvo de Blaze',
    type: 'shapeless',
    ingredients: ['blaze_rod'],
    result: { id: 'blaze_powder', count: 2 },
  },
  {
    id: 'gold_ingot_from_nuggets',
    name: 'Lingote de Oro (Pepitas)',
    type: 'shaped',
    pattern: [
      ['gold_nugget', 'gold_nugget', 'gold_nugget'],
      ['gold_nugget', 'gold_nugget', 'gold_nugget'],
      ['gold_nugget', 'gold_nugget', 'gold_nugget'],
    ],
    result: { id: 'gold_ingot', count: 1 },
  },
  {
    id: 'nether_bricks',
    name: 'Ladrillos del Nether',
    type: 'shaped',
    pattern: [
      [B.NETHERRACK, B.NETHERRACK],
      [B.NETHERRACK, B.NETHERRACK],
    ],
    result: { id: B.NETHER_BRICKS, count: 2 },
  },

  // === 20 CLASSIC MINECRAFT EXPANSION RECIPES ===
  {
    id: 'enchanting_table',
    name: 'Mesa de Encantamientos',
    type: 'shaped',
    pattern: [
      [null, 'book', null],
      ['diamond', B.OBSIDIAN, 'diamond'],
      [B.OBSIDIAN, B.OBSIDIAN, B.OBSIDIAN],
    ],
    result: { id: B.ENCHANTING_TABLE, count: 1 },
  },
  {
    id: 'anvil',
    name: 'Yunque',
    type: 'shaped',
    pattern: [
      [B.IRON_BLOCK, B.IRON_BLOCK, B.IRON_BLOCK],
      [null, 'iron_ingot', null],
      ['iron_ingot', 'iron_ingot', 'iron_ingot'],
    ],
    result: { id: B.ANVIL, count: 1 },
  },
  {
    id: 'ender_chest',
    name: 'Cofre de Ender',
    type: 'shaped',
    pattern: [
      [B.OBSIDIAN, B.OBSIDIAN, B.OBSIDIAN],
      [B.OBSIDIAN, 'blaze_powder', B.OBSIDIAN],
      [B.OBSIDIAN, B.OBSIDIAN, B.OBSIDIAN],
    ],
    result: { id: B.ENDER_CHEST, count: 1 },
  },
  {
    id: 'soul_torch',
    name: 'Antorcha de Almas',
    type: 'shaped',
    pattern: [['coal'], ['stick'], [B.SOUL_SAND]],
    result: { id: B.SOUL_TORCH, count: 4 },
  },
  {
    id: 'soul_lantern',
    name: 'Farol de Almas',
    type: 'shaped',
    pattern: [
      ['iron_ingot', 'iron_ingot', 'iron_ingot'],
      ['iron_ingot', B.SOUL_TORCH, 'iron_ingot'],
      ['iron_ingot', 'iron_ingot', 'iron_ingot'],
    ],
    result: { id: B.SOUL_LANTERN, count: 1 },
  },
  {
    id: 'campfire',
    name: 'Fogata',
    type: 'shaped',
    pattern: [
      [null, 'stick', null],
      ['stick', 'coal', 'stick'],
      [B.OAK_LOG, B.OAK_LOG, B.OAK_LOG],
    ],
    result: { id: B.CAMPFIRE, count: 1 },
  },
  {
    id: 'barrel',
    name: 'Barril',
    type: 'shaped',
    acceptsAnyPlank: true,
    pattern: [
      [B.OAK_PLANKS, B.OAK_SLAB, B.OAK_PLANKS],
      [B.OAK_PLANKS, null, B.OAK_PLANKS],
      [B.OAK_PLANKS, B.OAK_SLAB, B.OAK_PLANKS],
    ],
    result: { id: B.BARREL, count: 1 },
  },
  {
    id: 'smithing_table',
    name: 'Mesa de Herrería',
    type: 'shaped',
    acceptsAnyPlank: true,
    pattern: [
      ['iron_ingot', 'iron_ingot'],
      [B.OAK_PLANKS, B.OAK_PLANKS],
      [B.OAK_PLANKS, B.OAK_PLANKS],
    ],
    result: { id: B.SMITHING_TABLE, count: 1 },
  },
  {
    id: 'cartography_table',
    name: 'Mesa de Cartografía',
    type: 'shaped',
    acceptsAnyPlank: true,
    pattern: [
      ['paper', 'paper'],
      [B.OAK_PLANKS, B.OAK_PLANKS],
      [B.OAK_PLANKS, B.OAK_PLANKS],
    ],
    result: { id: B.CARTOGRAPHY_TABLE, count: 1 },
  },
  {
    id: 'stonecutter',
    name: 'Cortapiedras',
    type: 'shaped',
    pattern: [
      [null, 'iron_ingot', null],
      [B.STONE, B.STONE, B.STONE],
    ],
    result: { id: B.STONECUTTER, count: 1 },
  },
  {
    id: 'composter',
    name: 'Compostador',
    type: 'shaped',
    pattern: [
      [B.OAK_SLAB, null, B.OAK_SLAB],
      [B.OAK_SLAB, null, B.OAK_SLAB],
      [B.OAK_SLAB, B.OAK_SLAB, B.OAK_SLAB],
    ],
    result: { id: B.COMPOSTER, count: 1 },
  },
  {
    id: 'cauldron',
    name: 'Caldero',
    type: 'shaped',
    pattern: [
      ['iron_ingot', null, 'iron_ingot'],
      ['iron_ingot', null, 'iron_ingot'],
      ['iron_ingot', 'iron_ingot', 'iron_ingot'],
    ],
    result: { id: B.CAULDRON, count: 1 },
  },
  {
    id: 'oak_trapdoor',
    name: 'Trampilla de Roble',
    type: 'shaped',
    acceptsAnyPlank: true,
    pattern: [
      [B.OAK_PLANKS, B.OAK_PLANKS, B.OAK_PLANKS],
      [B.OAK_PLANKS, B.OAK_PLANKS, B.OAK_PLANKS],
    ],
    result: { id: B.OAK_TRAPDOOR, count: 2 },
  },
  {
    id: 'oak_fence_gate',
    name: 'Puerta de Valla de Roble',
    type: 'shaped',
    acceptsAnyPlank: true,
    pattern: [
      ['stick', B.OAK_PLANKS, 'stick'],
      ['stick', B.OAK_PLANKS, 'stick'],
    ],
    result: { id: B.OAK_FENCE_GATE, count: 1 },
  },
  {
    id: 'oak_stairs',
    name: 'Escaleras de Roble',
    type: 'shaped',
    acceptsAnyPlank: true,
    pattern: [
      [B.OAK_PLANKS, null, null],
      [B.OAK_PLANKS, B.OAK_PLANKS, null],
      [B.OAK_PLANKS, B.OAK_PLANKS, B.OAK_PLANKS],
    ],
    result: { id: B.OAK_STAIRS, count: 4 },
  },
  {
    id: 'iron_bars',
    name: 'Barrotes de Hierro',
    type: 'shaped',
    pattern: [
      ['iron_ingot', 'iron_ingot', 'iron_ingot'],
      ['iron_ingot', 'iron_ingot', 'iron_ingot'],
    ],
    result: { id: B.IRON_BARS, count: 16 },
  },
  {
    id: 'note_block',
    name: 'Bloque Musical',
    type: 'shaped',
    acceptsAnyPlank: true,
    pattern: [
      [B.OAK_PLANKS, B.OAK_PLANKS, B.OAK_PLANKS],
      [B.OAK_PLANKS, 'redstone_dust', B.OAK_PLANKS],
      [B.OAK_PLANKS, B.OAK_PLANKS, B.OAK_PLANKS],
    ],
    result: { id: B.NOTE_BLOCK, count: 1 },
  },
  {
    id: 'slime_block',
    name: 'Bloque de Slime',
    type: 'shaped',
    pattern: [
      ['green_dye', B.SUGAR_CANE, 'green_dye'],
      [B.SUGAR_CANE, 'clay_ball', B.SUGAR_CANE],
      ['green_dye', B.SUGAR_CANE, 'green_dye'],
    ],
    result: { id: B.SLIME_BLOCK, count: 2 },
  },
  ...mineralStoragePair('bone', 'Bloque de Huesos', 'Polvo de Hueso', 'bone_meal', B.BONE_BLOCK),
  {
    id: 'prismarine',
    name: 'Prismarina',
    type: 'shaped',
    pattern: [
      [B.COBBLESTONE, 'blue_dye'],
      ['green_dye', B.COBBLESTONE],
    ],
    result: { id: B.PRISMARINE, count: 4 },
  },
  {
    id: 'prismarine_bricks',
    name: 'Ladrillos de Prismarina',
    type: 'shaped',
    pattern: [
      [B.PRISMARINE, B.PRISMARINE],
      [B.PRISMARINE, B.PRISMARINE],
    ],
    result: { id: B.PRISMARINE_BRICKS, count: 4 },
  },
  {
    id: 'compass',
    name: 'Brújula',
    type: 'shaped',
    pattern: [
      [null, 'iron_ingot', null],
      ['iron_ingot', 'redstone_dust', 'iron_ingot'],
      [null, 'iron_ingot', null],
    ],
    result: { id: 'compass', count: 1 },
  },
  {
    id: 'clock',
    name: 'Reloj',
    type: 'shaped',
    pattern: [
      [null, 'gold_ingot', null],
      ['gold_ingot', 'redstone_dust', 'gold_ingot'],
      [null, 'gold_ingot', null],
    ],
    result: { id: 'clock', count: 1 },
  },

  // === TOOLS: Wood, Stone, Iron, Gold, Diamond, Netherite ===
  ...toolSet('wood', 'Madera', B.OAK_PLANKS, true, true),
  ...toolSet('stone', 'Piedra', B.COBBLESTONE, true),
  ...toolSet('iron', 'Hierro', 'iron_ingot', true),
  ...toolSet('gold', 'Oro', 'gold_ingot', false),
  ...toolSet('diamond', 'Diamante', 'diamond', true),
  ...toolSet('netherite', 'Netherita', 'netherite_ingot', true),

  // === ARMOR SETS: Leather (leather OR oak planks for early survival), Iron, Diamond, Netherite ===
  ...armorSet('leather', 'Cuero', 'leather'),
  ...armorSet('leather', 'Cuero (Madera)', B.OAK_PLANKS, true).map((r) => ({ ...r, id: `${r.id}_wood` })),
  ...armorSet('iron', 'Hierro', 'iron_ingot'),
  ...armorSet('diamond', 'Diamante', 'diamond'),
  ...armorSet('netherite', 'Netherita', 'netherite_ingot'),
];

function slotMatchesExpected(
  expected: ItemId | null,
  actual: ItemId | null,
  acceptsAnyPlank?: boolean
): boolean {
  if (expected === actual) return true;
  if (
    acceptsAnyPlank &&
    expected === B.OAK_PLANKS &&
    typeof actual === 'number' &&
    ALL_PLANKS_IDS.includes(actual)
  ) {
    return true;
  }
  return false;
}

/**
 * Matches a flat grid of length gridSize * gridSize against RECIPES (shaped & shapeless).
 */
export function matchRecipe(grid: SlotOrNull[], gridSize: 2 | 3): CraftingRecipe | null {
  let minR: number = gridSize;
  let maxR = -1;
  let minC: number = gridSize;
  let maxC = -1;
  const presentItems: ItemId[] = [];

  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const slot = grid[r * gridSize + c];
      if (slot && slot.count > 0) {
        if (r < minR) minR = r;
        if (r > maxR) maxR = r;
        if (c < minC) minC = c;
        if (c > maxC) maxC = c;
        presentItems.push(slot.id);
      }
    }
  }

  if (presentItems.length === 0) return null;

  const h = maxR - minR + 1;
  const w = maxC - minC + 1;

  for (const recipe of RECIPES) {
    if (recipe.type === 'shapeless' && recipe.ingredients) {
      if (presentItems.length !== recipe.ingredients.length) continue;
      const a = [...presentItems].map(String).sort();
      const b = [...recipe.ingredients].map(String).sort();
      let ok = true;
      for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
          ok = false;
          break;
        }
      }
      if (ok) return recipe;
    } else if (recipe.type === 'shaped' && recipe.pattern) {
      const ph = recipe.pattern.length;
      const pw = recipe.pattern[0].length;
      if (ph !== h || pw !== w) continue;

      const checkMatch = (mirrored: boolean): boolean => {
        for (let r = 0; r < ph; r++) {
          for (let c = 0; c < pw; c++) {
            const pc = mirrored ? pw - 1 - c : c;
            const expected = recipe.pattern![r][pc];
            const actual = grid[(minR + r) * gridSize + (minC + c)]?.id ?? null;
            if (!slotMatchesExpected(expected, actual, recipe.acceptsAnyPlank)) return false;
          }
        }
        return true;
      };

      if (checkMatch(false) || checkMatch(true)) {
        return recipe;
      }
    }
  }

  return null;
}

export const SMELT_TIME_SECONDS = 5.0;

export const SMELT_RECIPES: SmeltRecipe[] = [
  { id: 'smelt_iron', name: 'Lingote de Hierro', input: B.IRON_ORE, output: 'iron_ingot' },
  { id: 'smelt_gold', name: 'Lingote de Oro', input: B.GOLD_ORE, output: 'gold_ingot' },
  { id: 'smelt_copper', name: 'Lingote de Cobre', input: B.COPPER_ORE, output: 'copper_ingot' },
  { id: 'smelt_netherite', name: 'Fragmento de Netherita', input: B.ANCIENT_DEBRIS, output: 'netherite_scrap' },
  { id: 'smelt_glass', name: 'Cristal', input: B.SAND, output: B.GLASS },
  { id: 'smelt_stone', name: 'Piedra', input: B.COBBLESTONE, output: B.STONE },
  { id: 'smelt_smooth_stone', name: 'Piedra Lisa', input: B.STONE, output: B.SMOOTH_STONE },
  { id: 'smelt_cracked_bricks', name: 'Ladrillos Agrietados', input: B.STONE_BRICKS, output: B.CRACKED_STONE_BRICKS },
  { id: 'smelt_smooth_quartz', name: 'Cuarzo Liso', input: B.QUARTZ_BLOCK, output: B.SMOOTH_QUARTZ },
  { id: 'smelt_brick', name: 'Ladrillo Cocido', input: 'clay_ball', output: 'brick' },
  { id: 'smelt_green_dye', name: 'Tinte Verde', input: B.CACTUS, output: 'green_dye' },
  { id: 'smelt_charcoal', name: 'Carbón Vegetal', input: B.OAK_LOG, output: 'charcoal' },
  { id: 'smelt_pork', name: 'Chuleta Cocinada', input: 'raw_porkchop', output: 'cooked_porkchop' },
  { id: 'smelt_beef', name: 'Filete Asado', input: 'raw_beef', output: 'cooked_beef' },
];

export function getSmeltOutput(inputId: ItemId | null | undefined): ItemId | null {
  if (inputId === null || inputId === undefined) return null;
  if (typeof inputId === 'number' && ALL_LOG_IDS.includes(inputId)) return 'charcoal';
  const match = SMELT_RECIPES.find((r) => r.input === inputId);
  return match ? match.output : null;
}

export function getFuelDuration(fuelId: ItemId | null | undefined): number {
  if (fuelId === null || fuelId === undefined) return 0;
  return getItemDef(fuelId)?.fuelTime ?? 0;
}

export function addItemToInventory(
  inventory: SlotOrNull[],
  itemId: ItemId,
  count: number,
  durability?: number
): number {
  const def = getItemDef(itemId);
  if (!def) return count;
  const maxStack = def.maxStack;
  let remaining = count;

  if (maxStack > 1) {
    for (let i = 0; i < inventory.length && remaining > 0; i++) {
      const s = inventory[i];
      if (s && s.id === itemId && s.count < maxStack) {
        const space = maxStack - s.count;
        const add = Math.min(space, remaining);
        s.count += add;
        remaining -= add;
      }
    }
  }

  for (let i = 0; i < inventory.length && remaining > 0; i++) {
    if (!inventory[i]) {
      const add = Math.min(maxStack, remaining);
      inventory[i] = {
        id: itemId,
        count: add,
        durability: durability ?? def.maxDurability,
      };
      remaining -= add;
    }
  }

  return remaining;
}

export function countItemInInventory(inventory: SlotOrNull[], itemId: ItemId): number {
  let total = 0;
  for (const s of inventory) {
    if (s && s.id === itemId) total += s.count;
  }
  return total;
}

export function removeItemFromInventory(
  inventory: SlotOrNull[],
  itemId: ItemId,
  count: number
): boolean {
  if (countItemInInventory(inventory, itemId) < count) return false;
  let remaining = count;
  for (let i = 0; i < inventory.length && remaining > 0; i++) {
    const s = inventory[i];
    if (s && s.id === itemId) {
      const take = Math.min(s.count, remaining);
      s.count -= take;
      remaining -= take;
      if (s.count <= 0) inventory[i] = null;
    }
  }
  return remaining === 0;
}

export const VILLAGER_TITLES: Record<VillagerProfession, string> = {
  farmer: 'Aldeano Granjero',
  blacksmith: 'Aldeano Herrero',
  librarian: 'Aldeano Bibliotecario',
};

export const VILLAGER_TRADES: Record<VillagerProfession, TradeOffer[]> = {
  farmer: [
    { id: 'f_log_em', costId: BLOCK_IDS.OAK_LOG, costCount: 16, rewardId: 'emerald', rewardCount: 1 },
    { id: 'f_wheat_em', costId: 'wheat', costCount: 8, rewardId: 'emerald', rewardCount: 1 },
    { id: 'f_em_apple', costId: 'emerald', costCount: 1, rewardId: 'apple', rewardCount: 4 },
    { id: 'f_em_bread', costId: 'emerald', costCount: 1, rewardId: 'bread', rewardCount: 4 },
  ],
  blacksmith: [
    { id: 'b_coal_em', costId: 'coal', costCount: 10, rewardId: 'emerald', rewardCount: 1 },
    { id: 'b_iron_em', costId: 'iron_ingot', costCount: 4, rewardId: 'emerald', rewardCount: 1 },
    { id: 'b_em_pick', costId: 'emerald', costCount: 3, rewardId: 'iron_pickaxe', rewardCount: 1 },
    { id: 'b_em_sword', costId: 'emerald', costCount: 6, rewardId: 'diamond_sword', rewardCount: 1 },
  ],
  librarian: [
    { id: 'l_glass_em', costId: BLOCK_IDS.GLASS, costCount: 8, rewardId: 'emerald', rewardCount: 1 },
    { id: 'l_em_bookshelf', costId: 'emerald', costCount: 2, rewardId: BLOCK_IDS.BOOKSHELF, rewardCount: 1 },
    { id: 'l_em_lantern', costId: 'emerald', costCount: 1, rewardId: BLOCK_IDS.LANTERN, rewardCount: 4 },
    { id: 'l_em_bed', costId: 'emerald', costCount: 3, rewardId: BLOCK_IDS.BED, rewardCount: 1 },
  ],
};

/**
 * Executes a Villager emerald trade cleanly if the player has enough input items and space.
 */
export function executeVillagerTrade(
  inventory: SlotOrNull[],
  offer: TradeOffer
): boolean {
  if (countItemInInventory(inventory, offer.costId) < offer.costCount) {
    return false;
  }
  const cloned = inventory.map((s) => (s ? { ...s } : null));
  if (!removeItemFromInventory(cloned, offer.costId, offer.costCount)) {
    return false;
  }
  const rem = addItemToInventory(cloned, offer.rewardId, offer.rewardCount);
  if (rem > 0) {
    return false;
  }
  for (let i = 0; i < inventory.length; i++) {
    inventory[i] = cloned[i];
  }
  return true;
}
