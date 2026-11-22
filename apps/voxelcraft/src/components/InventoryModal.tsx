import React, { useEffect, useMemo, useState } from 'react';
import { ARMOR_SLOT_ORDER, calculateTotalArmorPoints, getItemDef } from '../game/blocks';
import {
  addItemToInventory,
  getFuelDuration,
  getSmeltOutput,
  matchRecipe,
  RECIPES,
  SMELT_TIME_SECONDS,
} from '../game/crafting';
import type {
  ArmorSlots,
  ChestTileEntity,
  FurnaceTileEntity,
  ItemId,
  ModalType,
  SlotOrNull,
} from '../game/types';

interface InventoryModalProps {
  modal: ModalType;
  inventory: SlotOrNull[];
  armor: ArmorSlots;
  activeFurnace: FurnaceTileEntity | null;
  activeChest: ChestTileEntity | null;
  icons: Record<string, string>;
  onUpdateInventory: (next: SlotOrNull[]) => void;
  onUpdateArmor: (next: ArmorSlots) => void;
  onUpdateFurnace: (updated: FurnaceTileEntity) => void;
  onUpdateChest: (updated: ChestTileEntity) => void;
  onClose: () => void;
}

const ARMOR_LABELS = ['Casco', 'Peto', 'Grebas', 'Botas'] as const;

function cloneSlots(slots: SlotOrNull[]): SlotOrNull[] {
  return slots.map((s) => (s ? { ...s } : null));
}

function transferToSlotArray(
  targetSlots: SlotOrNull[],
  item: NonNullable<SlotOrNull>
): number {
  const maxStack = getItemDef(item.id)?.maxStack ?? 64;
  let rem = item.count;
  if (maxStack > 1) {
    for (let i = 0; i < targetSlots.length && rem > 0; i++) {
      const t = targetSlots[i];
      if (t && t.id === item.id && t.count < maxStack) {
        const add = Math.min(maxStack - t.count, rem);
        t.count += add;
        rem -= add;
      }
    }
  }
  for (let i = 0; i < targetSlots.length && rem > 0; i++) {
    if (!targetSlots[i]) {
      const put = Math.min(maxStack, rem);
      targetSlots[i] = { ...item, count: put };
      rem -= put;
    }
  }
  return rem;
}

function getArmorPieceColor(slot: SlotOrNull): string | null {
  if (!slot || typeof slot.id !== 'string') return null;
  if (slot.id.startsWith('diamond_')) return '#3ce6ed';
  if (slot.id.startsWith('iron_')) return '#cfd8e3';
  if (slot.id.startsWith('leather_')) return '#9e6635';
  return null;
}

function PlayerSilhouettePreview({ armor }: { armor: ArmorSlots }) {
  const helmCol = getArmorPieceColor(armor[0]);
  const chestCol = getArmorPieceColor(armor[1]);
  const legCol = getArmorPieceColor(armor[2]);
  const bootCol = getArmorPieceColor(armor[3]);
  const totalPts = calculateTotalArmorPoints(armor);

  return (
    <div className="flex flex-col items-center justify-center bg-[#23272e] border-2 border-[#5c5c5c] px-3 py-2 w-[92px] h-[188px]">
      <svg viewBox="0 0 36 64" className="w-[66px] h-[126px] pixelated" aria-label="Vista previa del jugador">
        {/* Head */}
        <rect x="11" y="4" width="14" height="14" fill="#d9a47c" />
        <rect x="11" y="4" width="14" height="4" fill="#4a301c" />
        <rect x="14" y="10" width="2" height="2" fill="#2d4785" />
        <rect x="20" y="10" width="2" height="2" fill="#2d4785" />
        {helmCol && (
          <>
            <rect x="10" y="3" width="16" height="6" fill={helmCol} />
            <rect x="10" y="9" width="2" height="5" fill={helmCol} />
            <rect x="24" y="9" width="2" height="5" fill={helmCol} />
          </>
        )}

        {/* Arms */}
        <rect x="4" y="19" width="6" height="20" fill="#d9a47c" />
        <rect x="26" y="19" width="6" height="20" fill="#d9a47c" />
        <rect x="4" y="19" width="6" height="9" fill={chestCol ?? '#2a95ad'} />
        <rect x="26" y="19" width="6" height="9" fill={chestCol ?? '#2a95ad'} />

        {/* Torso */}
        <rect x="10" y="19" width="16" height="20" fill={chestCol ?? '#2a95ad'} />

        {/* Legs */}
        <rect x="10" y="40" width="7" height="18" fill={legCol ?? '#3b4899'} />
        <rect x="19" y="40" width="7" height="18" fill={legCol ?? '#3b4899'} />

        {/* Boots */}
        <rect x="10" y="53" width="7" height="7" fill={bootCol ?? '#4b4b4f'} />
        <rect x="19" y="53" width="7" height="7" fill={bootCol ?? '#4b4b4f'} />
      </svg>
      <div className="mt-1 text-[10px] font-mono-hud text-sky-200 tracking-tight">
        DEF {totalPts}/20
      </div>
    </div>
  );
}

export const InventoryModal: React.FC<InventoryModalProps> = ({
  modal,
  inventory,
  armor,
  activeFurnace,
  activeChest,
  icons,
  onUpdateInventory,
  onUpdateArmor,
  onUpdateFurnace,
  onUpdateChest,
  onClose,
}) => {
  const gridSize: 2 | 3 = modal === 'crafting' ? 3 : 2;
  const [craftGrid, setCraftGrid] = useState<SlotOrNull[]>(() =>
    new Array<SlotOrNull>(gridSize * gridSize).fill(null)
  );
  const [cursorItem, setCursorItem] = useState<SlotOrNull>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hoveredName, setHoveredName] = useState<string>('');

  useEffect(() => {
    setCraftGrid(new Array<SlotOrNull>(gridSize * gridSize).fill(null));
    setCursorItem(null);
  }, [modal, gridSize]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  const matchedRecipe = useMemo(() => {
    if (modal !== 'inventory' && modal !== 'crafting') return null;
    return matchRecipe(craftGrid, gridSize);
  }, [craftGrid, gridSize, modal]);

  if (modal === 'none') return null;

  const handleCloseSafely = () => {
    const nextInv = cloneSlots(inventory);
    let dirty = false;
    for (const s of craftGrid) {
      if (s && s.count > 0) {
        addItemToInventory(nextInv, s.id, s.count, s.durability);
        dirty = true;
      }
    }
    if (cursorItem && cursorItem.count > 0) {
      addItemToInventory(nextInv, cursorItem.id, cursorItem.count, cursorItem.durability);
      dirty = true;
    }
    if (dirty) onUpdateInventory(nextInv);
    setCraftGrid(new Array<SlotOrNull>(gridSize * gridSize).fill(null));
    setCursorItem(null);
    onClose();
  };

  const interactWithSlot = (
    current: SlotOrNull,
    button: number,
    allowPlace = true
  ): { nextSlot: SlotOrNull; nextCursor: SlotOrNull } => {
    const slot = current ? { ...current } : null;
    const cursor = cursorItem ? { ...cursorItem } : null;

    if (button === 0) {
      if (!cursor) {
        return { nextSlot: null, nextCursor: slot };
      }
      if (!allowPlace) return { nextSlot: slot, nextCursor: cursor };
      if (!slot) {
        return { nextSlot: cursor, nextCursor: null };
      }
      if (slot.id === cursor.id) {
        const maxStack = getItemDef(slot.id)?.maxStack ?? 64;
        if (maxStack > 1 && slot.count < maxStack) {
          const add = Math.min(maxStack - slot.count, cursor.count);
          slot.count += add;
          cursor.count -= add;
          return { nextSlot: slot, nextCursor: cursor.count > 0 ? cursor : null };
        }
      }
      return { nextSlot: cursor, nextCursor: slot };
    }

    if (button === 2) {
      if (!cursor) {
        if (!slot) return { nextSlot: null, nextCursor: null };
        const take = Math.ceil(slot.count / 2);
        const remain = slot.count - take;
        return {
          nextSlot: remain > 0 ? { ...slot, count: remain } : null,
          nextCursor: { ...slot, count: take },
        };
      }
      if (!allowPlace) return { nextSlot: slot, nextCursor: cursor };
      if (!slot) {
        cursor.count -= 1;
        return {
          nextSlot: { ...cursor, count: 1 },
          nextCursor: cursor.count > 0 ? cursor : null,
        };
      }
      if (slot.id === cursor.id) {
        const maxStack = getItemDef(slot.id)?.maxStack ?? 64;
        if (slot.count < maxStack) {
          slot.count += 1;
          cursor.count -= 1;
          return { nextSlot: slot, nextCursor: cursor.count > 0 ? cursor : null };
        }
      }
      return { nextSlot: slot, nextCursor: cursor };
    }

    return { nextSlot: slot, nextCursor: cursor };
  };

  const handleArmorSlotClick = (armorIdx: number, e: React.MouseEvent) => {
    e.preventDefault();
    const expectedType = ARMOR_SLOT_ORDER[armorIdx];
    const nextArmor = armor.map((s) => (s ? { ...s } : null)) as ArmorSlots;

    // Shift-click unequip back to inventory
    if (e.shiftKey && e.button === 0 && !cursorItem && nextArmor[armorIdx]) {
      const nextInv = cloneSlots(inventory);
      const piece = nextArmor[armorIdx]!;
      const rem = addItemToInventory(nextInv, piece.id, piece.count, piece.durability);
      if (rem === 0) {
        nextArmor[armorIdx] = null;
        onUpdateInventory(nextInv);
        onUpdateArmor(nextArmor);
      }
      return;
    }

    // Validate item type when placing into an armor slot
    if (cursorItem) {
      const def = getItemDef(cursorItem.id);
      if (def?.armorSlot !== expectedType) return;
    }

    const { nextSlot, nextCursor } = interactWithSlot(nextArmor[armorIdx], e.button, true);
    nextArmor[armorIdx] = nextSlot;
    setCursorItem(nextCursor);
    onUpdateArmor(nextArmor);
  };

  const handleChestSlotClick = (chestIdx: number, e: React.MouseEvent) => {
    e.preventDefault();
    if (!activeChest) return;
    const nextChestSlots = cloneSlots(activeChest.slots);

    // Shift-click quick transfer from Chest -> Player Inventory
    if (e.shiftKey && e.button === 0 && !cursorItem && nextChestSlots[chestIdx]) {
      const moving = nextChestSlots[chestIdx]!;
      const nextInv = cloneSlots(inventory);
      const rem = transferToSlotArray(nextInv, moving);
      nextChestSlots[chestIdx] = rem > 0 ? { ...moving, count: rem } : null;
      onUpdateInventory(nextInv);
      onUpdateChest({ ...activeChest, slots: nextChestSlots });
      return;
    }

    const { nextSlot, nextCursor } = interactWithSlot(nextChestSlots[chestIdx], e.button, true);
    nextChestSlots[chestIdx] = nextSlot;
    setCursorItem(nextCursor);
    onUpdateChest({ ...activeChest, slots: nextChestSlots });
  };

  const handleInventorySlotClick = (idx: number, e: React.MouseEvent) => {
    e.preventDefault();
    const nextInv = cloneSlots(inventory);

    if (e.shiftKey && e.button === 0 && !cursorItem && nextInv[idx]) {
      const moving = nextInv[idx]!;
      const movingDef = getItemDef(moving.id);

      // 1. Shift-click inside Chest modal -> quick transfer Inventory -> Chest
      if (modal === 'chest' && activeChest) {
        const nextChestSlots = cloneSlots(activeChest.slots);
        const rem = transferToSlotArray(nextChestSlots, moving);
        nextInv[idx] = rem > 0 ? { ...moving, count: rem } : null;
        onUpdateInventory(nextInv);
        onUpdateChest({ ...activeChest, slots: nextChestSlots });
        return;
      }

      // 2. Shift-click inside Furnace modal -> route smeltable to input, fuel to fuel
      if (modal === 'furnace' && activeFurnace) {
        const nextF: FurnaceTileEntity = {
          ...activeFurnace,
          input: activeFurnace.input ? { ...activeFurnace.input } : null,
          fuel: activeFurnace.fuel ? { ...activeFurnace.fuel } : null,
          output: activeFurnace.output ? { ...activeFurnace.output } : null,
        };
        if (getSmeltOutput(moving.id) !== null) {
          const arr: SlotOrNull[] = [nextF.input];
          const rem = transferToSlotArray(arr, moving);
          nextF.input = arr[0];
          nextInv[idx] = rem > 0 ? { ...moving, count: rem } : null;
          onUpdateInventory(nextInv);
          onUpdateFurnace(nextF);
          return;
        }
        if (getFuelDuration(moving.id) > 0) {
          const arr: SlotOrNull[] = [nextF.fuel];
          const rem = transferToSlotArray(arr, moving);
          nextF.fuel = arr[0];
          nextInv[idx] = rem > 0 ? { ...moving, count: rem } : null;
          onUpdateInventory(nextInv);
          onUpdateFurnace(nextF);
          return;
        }
      }

      // 3. Shift-click an Armor piece in Inventory -> auto-equip into matching empty Armor slot
      if (modal === 'inventory' && movingDef?.armorSlot) {
        const targetArmorIdx = ARMOR_SLOT_ORDER.indexOf(movingDef.armorSlot);
        if (targetArmorIdx !== -1 && !armor[targetArmorIdx]) {
          const nextArmor = armor.map((s) => (s ? { ...s } : null)) as ArmorSlots;
          nextArmor[targetArmorIdx] = { ...moving };
          nextInv[idx] = null;
          onUpdateInventory(nextInv);
          onUpdateArmor(nextArmor);
          return;
        }
      }

      // 4. Default Shift-click: swap between hotbar (0..8) and main inventory (9..35)
      const start = idx < 9 ? 9 : 0;
      const end = idx < 9 ? 36 : 9;
      const maxStack = movingDef?.maxStack ?? 64;
      let rem = moving.count;
      for (let i = start; i < end && rem > 0; i++) {
        const target = nextInv[i];
        if (target && target.id === moving.id && target.count < maxStack) {
          const add = Math.min(maxStack - target.count, rem);
          target.count += add;
          rem -= add;
        }
      }
      for (let i = start; i < end && rem > 0; i++) {
        if (!nextInv[i]) {
          nextInv[i] = { ...moving, count: rem };
          rem = 0;
        }
      }
      nextInv[idx] = rem > 0 ? { ...moving, count: rem } : null;
      onUpdateInventory(nextInv);
      return;
    }

    const { nextSlot, nextCursor } = interactWithSlot(nextInv[idx], e.button, true);
    nextInv[idx] = nextSlot;
    setCursorItem(nextCursor);
    onUpdateInventory(nextInv);
  };

  const handleCraftSlotClick = (idx: number, e: React.MouseEvent) => {
    e.preventDefault();
    const nextGrid = cloneSlots(craftGrid);
    const { nextSlot, nextCursor } = interactWithSlot(nextGrid[idx], e.button, true);
    nextGrid[idx] = nextSlot;
    setCraftGrid(nextGrid);
    setCursorItem(nextCursor);
  };

  const handleCraftOutputClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!matchedRecipe) return;
    const outDef = getItemDef(matchedRecipe.result.id);
    if (!outDef) return;

    const outCount = matchedRecipe.result.count;

    if (e.shiftKey) {
      const nextInv = cloneSlots(inventory);
      const leftover = addItemToInventory(
        nextInv,
        matchedRecipe.result.id,
        outCount,
        outDef.maxDurability
      );
      if (leftover > 0) return;
      const nextGrid = craftGrid.map((s) => {
        if (!s) return null;
        return s.count > 1 ? { ...s, count: s.count - 1 } : null;
      });
      setCraftGrid(nextGrid);
      onUpdateInventory(nextInv);
      return;
    }

    if (cursorItem) {
      if (cursorItem.id !== matchedRecipe.result.id) return;
      if (cursorItem.count + outCount > outDef.maxStack) return;
      setCursorItem({ ...cursorItem, count: cursorItem.count + outCount });
    } else {
      setCursorItem({
        id: matchedRecipe.result.id,
        count: outCount,
        durability: outDef.maxDurability,
      });
    }

    const nextGrid = craftGrid.map((s) => {
      if (!s) return null;
      return s.count > 1 ? { ...s, count: s.count - 1 } : null;
    });
    setCraftGrid(nextGrid);
  };

  const handleFurnaceSlotClick = (which: 'input' | 'fuel' | 'output', e: React.MouseEvent) => {
    e.preventDefault();
    if (!activeFurnace) return;
    const nextF: FurnaceTileEntity = {
      ...activeFurnace,
      input: activeFurnace.input ? { ...activeFurnace.input } : null,
      fuel: activeFurnace.fuel ? { ...activeFurnace.fuel } : null,
      output: activeFurnace.output ? { ...activeFurnace.output } : null,
    };

    if (which === 'output') {
      if (!nextF.output) return;
      if (e.shiftKey) {
        const nextInv = cloneSlots(inventory);
        const rem = addItemToInventory(nextInv, nextF.output.id, nextF.output.count);
        nextF.output = rem > 0 ? { ...nextF.output, count: rem } : null;
        onUpdateInventory(nextInv);
        onUpdateFurnace(nextF);
        return;
      }
      if (!cursorItem) {
        setCursorItem(nextF.output);
        nextF.output = null;
        onUpdateFurnace(nextF);
      } else if (cursorItem.id === nextF.output.id) {
        const maxStack = getItemDef(cursorItem.id)?.maxStack ?? 64;
        const add = Math.min(maxStack - cursorItem.count, nextF.output.count);
        if (add > 0) {
          setCursorItem({ ...cursorItem, count: cursorItem.count + add });
          nextF.output.count -= add;
          if (nextF.output.count <= 0) nextF.output = null;
          onUpdateFurnace(nextF);
        }
      }
      return;
    }

    // Shift-click input/fuel back to inventory
    if (e.shiftKey && e.button === 0 && !cursorItem && nextF[which]) {
      const nextInv = cloneSlots(inventory);
      const rem = addItemToInventory(nextInv, nextF[which]!.id, nextF[which]!.count);
      nextF[which] = rem > 0 ? { ...nextF[which]!, count: rem } : null;
      onUpdateInventory(nextInv);
      onUpdateFurnace(nextF);
      return;
    }

    const { nextSlot, nextCursor } = interactWithSlot(nextF[which], e.button, true);
    nextF[which] = nextSlot;
    setCursorItem(nextCursor);
    onUpdateFurnace(nextF);
  };

  const tryAutoFillRecipe = (recipeId: string) => {
    const recipe = RECIPES.find((r) => r.id === recipeId);
    if (!recipe) return;

    const workingInv = cloneSlots(inventory);
    for (const s of craftGrid) {
      if (s && s.count > 0) addItemToInventory(workingInv, s.id, s.count, s.durability);
    }

    const needed: Array<{ slotIdx: number; itemId: ItemId }> = [];
    if (recipe.type === 'shapeless' && recipe.ingredients) {
      recipe.ingredients.forEach((id, i) => needed.push({ slotIdx: i, itemId: id }));
    } else if (recipe.type === 'shaped' && recipe.pattern) {
      const ph = recipe.pattern.length;
      const pw = recipe.pattern[0].length;
      if (ph > gridSize || pw > gridSize) return;
      for (let r = 0; r < ph; r++) {
        for (let c = 0; c < pw; c++) {
          const id = recipe.pattern[r][c];
          if (id !== null) {
            needed.push({ slotIdx: r * gridSize + c, itemId: id });
          }
        }
      }
    }

    const newGrid = new Array<SlotOrNull>(gridSize * gridSize).fill(null);
    for (const req of needed) {
      const invIdx = workingInv.findIndex((s) => s && s.id === req.itemId && s.count > 0);
      if (invIdx === -1) return;
      workingInv[invIdx]!.count -= 1;
      if (workingInv[invIdx]!.count <= 0) workingInv[invIdx] = null;
      newGrid[req.slotIdx] = { id: req.itemId, count: 1 };
    }

    onUpdateInventory(workingInv);
    setCraftGrid(newGrid);
  };

  const canCraftRecipe = (recipeId: string): boolean => {
    const recipe = RECIPES.find((r) => r.id === recipeId);
    if (!recipe) return false;
    if (recipe.type === 'shaped' && recipe.pattern) {
      if (recipe.pattern.length > gridSize || recipe.pattern[0].length > gridSize) return false;
    }
    const counts = new Map<string, number>();
    for (const s of [...inventory, ...craftGrid]) {
      if (s) counts.set(String(s.id), (counts.get(String(s.id)) ?? 0) + s.count);
    }
    const reqs: ItemId[] =
      recipe.type === 'shapeless'
        ? recipe.ingredients ?? []
        : (recipe.pattern?.flat().filter((x): x is ItemId => x !== null) ?? []);
    const reqCounts = new Map<string, number>();
    for (const r of reqs) reqCounts.set(String(r), (reqCounts.get(String(r)) ?? 0) + 1);
    for (const [k, needed] of reqCounts.entries()) {
      if ((counts.get(k) ?? 0) < needed) return false;
    }
    return true;
  };

  const renderSlotButton = (
    slot: SlotOrNull,
    label: string,
    onMouseDown: (e: React.MouseEvent) => void,
    testId?: string,
    placeholder?: string
  ) => {
    const def = slot ? getItemDef(slot.id) : null;
    const iconUrl = slot ? icons[String(slot.id)] : undefined;
    const durPct =
      slot && slot.durability !== undefined && def?.maxDurability && slot.durability < def.maxDurability
        ? Math.max(0, Math.min(100, (slot.durability / def.maxDurability) * 100))
        : null;

    return (
      <button
        type="button"
        data-testid={testId}
        aria-label={def ? `${label}: ${def.name} (${slot?.count})` : `${label}: vacío`}
        onMouseDown={onMouseDown}
        onContextMenu={(e) => e.preventDefault()}
        onMouseEnter={() => setHoveredName(def ? def.name : placeholder ?? '')}
        onMouseLeave={() => setHoveredName('')}
        className="mc-slot relative w-11 h-11 flex items-center justify-center cursor-pointer"
      >
        {!iconUrl && placeholder && (
          <span className="text-[8px] font-bold uppercase text-[#5c5c5c]/80 pointer-events-none select-none">
            {placeholder}
          </span>
        )}
        {iconUrl && (
          <img
            src={iconUrl}
            alt={def?.name ?? ''}
            className="w-8 h-8 pixelated pointer-events-none"
            draggable={false}
          />
        )}
        {slot && slot.count > 1 && (
          <span
            className="absolute bottom-0.5 right-1 text-[10px] font-pixel text-white leading-none pointer-events-none"
            style={{ textShadow: '1px 1px 0 #000' }}
          >
            {slot.count}
          </span>
        )}
        {durPct !== null && (
          <div className="absolute left-1 right-1 bottom-1 h-1 bg-black/80 pointer-events-none">
            <div
              className="h-full"
              style={{
                width: `${durPct}%`,
                backgroundColor: durPct > 55 ? '#4ade80' : durPct > 25 ? '#facc15' : '#ef4444',
              }}
            />
          </div>
        )}
      </button>
    );
  };

  const smeltPct = activeFurnace
    ? Math.min(100, (activeFurnace.cookProgress / SMELT_TIME_SECONDS) * 100)
    : 0;
  const burnPct =
    activeFurnace && activeFurnace.burnDuration > 0
      ? Math.min(100, (activeFurnace.burnTime / activeFurnace.burnDuration) * 100)
      : 0;

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-4"
      onContextMenu={(e) => e.preventDefault()}
      role="dialog"
      aria-modal="true"
      aria-label={
        modal === 'crafting'
          ? 'Mesa de Crafteo'
          : modal === 'furnace'
          ? 'Horno'
          : modal === 'chest'
          ? 'Cofre'
          : 'Inventario'
      }
    >
      <div className="flex flex-col md:flex-row gap-3 items-start max-w-[96vw]">
        {/* Quick Recipe Guide for Crafting/Inventory */}
        {(modal === 'inventory' || modal === 'crafting') && (
          <div className="mc-panel p-3 w-56 max-h-[500px] flex flex-col text-[#2b2b2b]">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-pixel text-xs uppercase tracking-tight">Recetas ({gridSize}×{gridSize})</h2>
            </div>
            <div className="grid grid-cols-3 gap-1.5 overflow-y-auto pr-1">
              {RECIPES.filter((r) => {
                if (r.type === 'shaped' && r.pattern) {
                  return r.pattern.length <= gridSize && r.pattern[0].length <= gridSize;
                }
                return true;
              }).map((recipe) => {
                const craftable = canCraftRecipe(recipe.id);
                const iconUrl = icons[String(recipe.result.id)];
                return (
                  <button
                    key={recipe.id}
                    type="button"
                    disabled={!craftable}
                    title={`${recipe.name} (x${recipe.result.count})`}
                    aria-label={`Rellenar receta ${recipe.name}`}
                    onClick={() => tryAutoFillRecipe(recipe.id)}
                    onMouseEnter={() => setHoveredName(`${recipe.name} ×${recipe.result.count}`)}
                    onMouseLeave={() => setHoveredName('')}
                    className={`mc-slot relative w-full aspect-square flex items-center justify-center ${
                      craftable
                        ? 'cursor-pointer ring-1 ring-emerald-700/70'
                        : 'opacity-45 cursor-not-allowed'
                    }`}
                  >
                    {iconUrl && (
                      <img
                        src={iconUrl}
                        alt={recipe.name}
                        className="w-7 h-7 pixelated pointer-events-none"
                        draggable={false}
                      />
                    )}
                    {recipe.result.count > 1 && (
                      <span
                        className="absolute bottom-0.5 right-1 text-[9px] font-pixel text-white"
                        style={{ textShadow: '1px 1px 0 #000' }}
                      >
                        {recipe.result.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] text-[#444] leading-snug">
              Clic en una receta iluminada para colocar materiales, o arrastra manualmente.
            </p>
          </div>
        )}

        {/* Main Minecraft Beveled Panel */}
        <div className="mc-panel p-4 text-[#2c2c2c] min-w-[446px]">
          <div className="flex items-center justify-between mb-3">
            <h1 className="font-pixel text-sm tracking-tight">
              {modal === 'crafting'
                ? 'Mesa de Crafteo 3×3'
                : modal === 'furnace'
                ? 'Horno de Fundición'
                : modal === 'chest'
                ? 'Cofre (27 ranuras)'
                : 'Inventario, Armadura y Crafteo'}
            </h1>
            <button
              type="button"
              onClick={handleCloseSafely}
              aria-label="Cerrar menú"
              className="mc-button px-2.5 py-1 text-xs font-pixel text-white cursor-pointer"
            >
              Cerrar (E)
            </button>
          </div>

          {/* Inventory Modal Top: 4 Armor Slots + Player Silhouette + 2x2 Crafting */}
          {modal === 'inventory' && (
            <div className="flex items-center justify-between gap-4 px-3 py-3 mb-3 bg-[#b3b3b3] border border-[#8a8a8a]">
              <div className="flex items-center gap-2.5">
                <div className="flex flex-col gap-1" data-testid="armor-slots">
                  {ARMOR_LABELS.map((label, idx) => (
                    <React.Fragment key={label}>
                      {renderSlotButton(
                        armor[idx],
                        `Armadura ${label}`,
                        (e) => handleArmorSlotClick(idx, e),
                        `armor-slot-${idx}`,
                        label.slice(0, 4)
                      )}
                    </React.Fragment>
                  ))}
                </div>
                <PlayerSilhouettePreview armor={armor} />
              </div>

              <div className="flex items-center gap-3 pr-1">
                <div
                  className="grid gap-1"
                  style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}
                  data-testid="craft-grid"
                >
                  {craftGrid.map((slot, idx) => (
                    <React.Fragment key={idx}>
                      {renderSlotButton(
                        slot,
                        `Crafteo ${idx + 1}`,
                        (e) => handleCraftSlotClick(idx, e),
                        `craft-slot-${idx}`
                      )}
                    </React.Fragment>
                  ))}
                </div>

                <div className="text-xl font-bold text-[#525252]" aria-hidden="true">
                  →
                </div>

                <div>
                  {renderSlotButton(
                    matchedRecipe
                      ? { id: matchedRecipe.result.id, count: matchedRecipe.result.count }
                      : null,
                    'Resultado de crafteo',
                    handleCraftOutputClick,
                    'craft-output'
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 3x3 Crafting Table Modal Top */}
          {modal === 'crafting' && (
            <div className="flex items-center justify-center gap-5 py-3 mb-3 bg-[#b3b3b3] border border-[#8a8a8a]">
              <div
                className="grid gap-1"
                style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}
                data-testid="craft-grid"
              >
                {craftGrid.map((slot, idx) => (
                  <React.Fragment key={idx}>
                    {renderSlotButton(
                      slot,
                      `Crafteo ${idx + 1}`,
                      (e) => handleCraftSlotClick(idx, e),
                      `craft-slot-${idx}`
                    )}
                  </React.Fragment>
                ))}
              </div>

              <div className="text-2xl font-bold text-[#525252]" aria-hidden="true">
                →
              </div>

              <div>
                {renderSlotButton(
                  matchedRecipe
                    ? { id: matchedRecipe.result.id, count: matchedRecipe.result.count }
                    : null,
                  'Resultado de crafteo',
                  handleCraftOutputClick,
                  'craft-output'
                )}
              </div>
            </div>
          )}

          {/* Chest 27-Slot Storage Grid */}
          {modal === 'chest' && activeChest && (
            <div className="mb-3">
              <div className="mb-1 text-[11px] font-bold text-[#3f3f3f] flex items-center justify-between">
                <span>Almacenamiento del Cofre</span>
                <span className="font-normal text-[#4b4b4b]">Shift+Clic para transferir rápido</span>
              </div>
              <div className="grid grid-cols-9 gap-1 p-1.5 bg-[#b3b3b3] border border-[#8a8a8a]" data-testid="chest-grid">
                {activeChest.slots.map((slot, idx) => (
                  <React.Fragment key={idx}>
                    {renderSlotButton(
                      slot,
                      `Cofre ${idx + 1}`,
                      (e) => handleChestSlotClick(idx, e),
                      `chest-slot-${idx}`
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}

          {/* Furnace Modal Top */}
          {modal === 'furnace' && activeFurnace && (
            <div className="flex items-center justify-center gap-6 py-4 mb-3 bg-[#b3b3b3] border border-[#8a8a8a]">
              <div className="flex flex-col items-center gap-2">
                <span className="text-[10px] font-bold uppercase text-[#444]">Entrada</span>
                {renderSlotButton(
                  activeFurnace.input,
                  'Entrada del horno',
                  (e) => handleFurnaceSlotClick('input', e),
                  'furnace-input'
                )}

                <div className="relative w-7 h-7 flex items-end justify-center bg-[#6e6e6e] border border-[#444] overflow-hidden">
                  <div
                    className="w-full transition-all duration-150"
                    style={{
                      height: `${burnPct}%`,
                      background: 'linear-gradient(to top, #ea580c, #facc15)',
                    }}
                  />
                </div>

                {renderSlotButton(
                  activeFurnace.fuel,
                  'Combustible del horno',
                  (e) => handleFurnaceSlotClick('fuel', e),
                  'furnace-fuel'
                )}
                <span className="text-[10px] font-bold uppercase text-[#444]">Combustible</span>
              </div>

              <div className="flex flex-col items-center gap-1">
                <div className="w-24 h-4 bg-[#6e6e6e] border-2 border-[#373737] overflow-hidden">
                  <div
                    className="h-full bg-[#f59e0b] transition-all duration-150"
                    style={{ width: `${smeltPct}%` }}
                  />
                </div>
                <span className="text-[11px] font-mono-hud text-[#333]">
                  {Math.round(smeltPct)}%
                </span>
              </div>

              <div className="flex flex-col items-center gap-2">
                <span className="text-[10px] font-bold uppercase text-[#444]">Salida</span>
                {renderSlotButton(
                  activeFurnace.output,
                  'Salida del horno',
                  (e) => handleFurnaceSlotClick('output', e),
                  'furnace-output'
                )}
              </div>
            </div>
          )}

          {/* Main Inventory (Slots 9..35) */}
          <div className="mb-1 text-[11px] font-bold text-[#3f3f3f] flex items-center justify-between">
            <span>Inventario</span>
            <span className="font-normal text-[#4b4b4b] h-4">
              {hoveredName || 'Clic izq: mover · Clic der: 1 unidad · Shift: rápido'}
            </span>
          </div>
          <div className="grid grid-cols-9 gap-1 mb-3">
            {Array.from({ length: 27 }, (_, i) => {
              const idx = i + 9;
              return (
                <React.Fragment key={idx}>
                  {renderSlotButton(
                    inventory[idx],
                    `Inventario ${i + 1}`,
                    (e) => handleInventorySlotClick(idx, e),
                    `inv-slot-${idx}`
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* Hotbar (Slots 0..8) */}
          <div className="mb-1 text-[11px] font-bold text-[#3f3f3f]">Barra rápida (1–9)</div>
          <div className="grid grid-cols-9 gap-1">
            {Array.from({ length: 9 }, (_, idx) => (
              <React.Fragment key={idx}>
                {renderSlotButton(
                  inventory[idx],
                  `Hotbar ${idx + 1}`,
                  (e) => handleInventorySlotClick(idx, e),
                  `inv-slot-${idx}`
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Floating Cursor Stack */}
      {cursorItem && (
        <div
          className="fixed pointer-events-none z-50 w-10 h-10 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center"
          style={{ left: mousePos.x, top: mousePos.y }}
        >
          {icons[String(cursorItem.id)] && (
            <img
              src={icons[String(cursorItem.id)]}
              alt=""
              className="w-9 h-9 pixelated drop-shadow-[0_3px_4px_rgba(0,0,0,0.65)]"
            />
          )}
          {cursorItem.count > 1 && (
            <span
              className="absolute bottom-0 right-0 text-xs font-pixel text-white"
              style={{ textShadow: '1px 1px 0 #000' }}
            >
              {cursorItem.count}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
