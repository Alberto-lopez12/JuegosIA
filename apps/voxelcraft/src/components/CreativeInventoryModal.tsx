import React, { useMemo, useState } from 'react';
import { CREATIVE_CATALOG, getItemDef } from '../game/blocks';
import type { CreativeCategory, ItemId, SlotOrNull } from '../game/types';

interface CreativeInventoryModalProps {
  inventory: SlotOrNull[];
  selectedSlot: number;
  icons: Record<string, string>;
  onGiveItem: (itemId: ItemId, targetSlot?: number) => void;
  onSelectSlot: (idx: number) => void;
  onClearHotbarSlot: (idx: number) => void;
  onClose: () => void;
}

const TABS: Array<{ id: CreativeCategory; label: string }> = [
  { id: 'building', label: 'Construcción' },
  { id: 'nature', label: 'Naturaleza' },
  { id: 'tools', label: 'Herramientas' },
  { id: 'misc', label: 'Comida y Varios' },
];

export const CreativeInventoryModal: React.FC<CreativeInventoryModalProps> = ({
  inventory,
  selectedSlot,
  icons,
  onGiveItem,
  onSelectSlot,
  onClearHotbarSlot,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<CreativeCategory>('building');
  const [search, setSearch] = useState('');

  const visibleItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q) {
      const all = [
        ...CREATIVE_CATALOG.building,
        ...CREATIVE_CATALOG.nature,
        ...CREATIVE_CATALOG.tools,
        ...CREATIVE_CATALOG.misc,
      ];
      return all.filter((def) => def.name.toLowerCase().includes(q));
    }
    return CREATIVE_CATALOG[activeTab];
  }, [activeTab, search]);

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/68 p-3 sm:p-5 pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Catálogo de Modo Creativo"
      data-testid="creative-inventory-modal"
      onClick={onClose}
    >
      <div
        className="mc-panel w-full max-w-2xl max-h-[88vh] p-4 sm:p-5 text-[#222222] flex flex-col gap-3"
        style={{ touchAction: 'pan-y' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-[#8c8c8c] pb-2">
          <div>
            <h2 className="font-pixel text-sm sm:text-base">Inventario Creativo</h2>
            <p className="text-[11px] text-[#454545]">
              Haz clic en cualquier bloque u objeto para equipar un stack completo en el slot activo.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mc-button px-3 py-1 font-pixel text-xs text-white cursor-pointer"
          >
            Cerrar (E)
          </button>
        </div>

        {/* Category Tabs + Search Input */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="flex flex-wrap gap-1 flex-1" role="tablist" aria-label="Categorías">
            {TABS.map((tab) => {
              const active = !search.trim() && activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setSearch('');
                    setActiveTab(tab.id);
                  }}
                  className={`px-2.5 py-1.5 font-pixel text-[10px] sm:text-[11px] cursor-pointer border-2 ${
                    active
                      ? 'bg-[#4e8c3a] border-[#8ce06e] text-white'
                      : 'bg-[#7c7c7c] border-[#555] text-white hover:bg-[#8d8d8d]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
          <label htmlFor="creative-search" className="sr-only">
            Buscar objeto o bloque
          </label>
          <input
            id="creative-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar bloque..."
            className="sm:w-44 px-2.5 py-1.5 bg-[#191d22] text-white text-xs font-mono-hud border-2 border-[#4c4c4c] placeholder:text-stone-400"
          />
        </div>

        {/* Scrollable Item Grid */}
        <div className="flex-1 min-h-[210px] max-h-[340px] overflow-y-auto bg-[#a6a6a6] border-2 border-[#6e6e6e] p-2.5">
          {visibleItems.length === 0 ? (
            <div className="h-32 flex items-center justify-center text-xs font-mono-hud text-[#3b3b3b]">
              No se encontraron objetos para &ldquo;{search}&rdquo;.
            </div>
          ) : (
            <div className="grid grid-cols-5 sm:grid-cols-8 gap-1.5">
              {visibleItems.map((def) => {
                const iconUrl = icons[String(def.id)];
                return (
                  <button
                    key={String(def.id)}
                    type="button"
                    aria-label={`Obtener ${def.name}`}
                    title={`${def.name} (×${def.maxStack})`}
                    onClick={() => onGiveItem(def.id, selectedSlot)}
                    className="group relative aspect-square bg-[#8b8b8b] hover:bg-[#a8c499] border-2 border-t-[#545454] border-l-[#545454] border-b-[#e5e5e5] border-r-[#e5e5e5] flex flex-col items-center justify-center p-1 cursor-pointer"
                  >
                    {iconUrl && (
                      <img
                        src={iconUrl}
                        alt={def.name}
                        className="w-8 h-8 sm:w-9 sm:h-9 pixelated pointer-events-none"
                        draggable={false}
                      />
                    )}
                    <span className="mt-0.5 text-[8px] leading-tight text-center text-[#1a1a1a] font-medium line-clamp-1 w-full">
                      {def.name}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Interactive 9-Slot Hotbar Strip (Click to select slot, Right-Click or trash to clear) */}
        <div className="flex flex-col gap-1.5 pt-1 border-t-2 border-[#8c8c8c]">
          <div className="flex items-center justify-between text-[11px] text-[#3a3a3a]">
            <span className="font-bold">Barra Rápida (Slot activo: #{selectedSlot + 1})</span>
            <button
              type="button"
              onClick={() => onClearHotbarSlot(selectedSlot)}
              className="px-2 py-0.5 bg-[#7a2e2e] hover:bg-[#993b3b] text-white font-pixel text-[10px] cursor-pointer"
            >
              Vaciar Slot
            </button>
          </div>
          <div className="grid grid-cols-9 gap-1 bg-[#707070] p-1.5 border-2 border-[#4a4a4a]">
            {Array.from({ length: 9 }, (_, i) => {
              const slot = inventory[i];
              const def = slot ? getItemDef(slot.id) : null;
              const iconUrl = slot ? icons[String(slot.id)] : undefined;
              const isSelected = i === selectedSlot;
              return (
                <button
                  key={i}
                  type="button"
                  aria-label={`Barra rápida slot ${i + 1}${def ? `: ${def.name}` : ': vacío'}`}
                  title="Clic: seleccionar · Clic derecho: vaciar"
                  onClick={() => onSelectSlot(i)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    onClearHotbarSlot(i);
                  }}
                  className={`relative aspect-square flex items-center justify-center cursor-pointer ${
                    isSelected
                      ? 'bg-[#669955] border-2 border-white'
                      : 'bg-[#8b8b8b] border border-[#3a3a3a] hover:bg-[#9e9e9e]'
                  }`}
                >
                  {iconUrl && (
                    <img
                      src={iconUrl}
                      alt={def?.name ?? ''}
                      className="w-7 h-7 sm:w-8 sm:h-8 pixelated pointer-events-none"
                      draggable={false}
                    />
                  )}
                  {slot && slot.count > 1 && (
                    <span
                      className="absolute bottom-0 right-0.5 text-[9px] font-pixel text-white leading-none"
                      style={{ textShadow: '1px 1px 0 #000' }}
                    >
                      {slot.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
