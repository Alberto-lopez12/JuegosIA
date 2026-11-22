import React from 'react';
import { getItemDef } from '../game/blocks';
import { countItemInInventory } from '../game/crafting';
import type { ActiveVillagerTrade, SlotOrNull } from '../game/types';

interface VillagerTradeModalProps {
  trade: ActiveVillagerTrade;
  inventory: SlotOrNull[];
  icons: Record<string, string>;
  onExecuteTrade: (offerId: string) => void;
  onClose: () => void;
}

export const VillagerTradeModal: React.FC<VillagerTradeModalProps> = ({
  trade,
  inventory,
  icons,
  onExecuteTrade,
  onClose,
}) => {
  const emeralds = countItemInInventory(inventory, 'emerald');
  const emeraldIcon = icons['emerald'];

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/68 p-4 pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-label={`Comercio con ${trade.title}`}
      data-testid="villager-trade-modal"
      onClick={onClose}
    >
      <div
        className="mc-panel w-full max-w-lg p-5 text-[#222222] flex flex-col gap-4 max-h-[88vh] overflow-y-auto"
        style={{ touchAction: 'pan-y' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b-2 border-[#8c8c8c] pb-2.5">
          <div>
            <h2 className="font-pixel text-sm sm:text-base">{trade.title}</h2>
            <p className="text-[11px] text-[#454545]">
              Intercambia recursos por esmeraldas y equipamiento
            </p>
          </div>
          <div className="flex items-center gap-1.5 bg-[#203524] text-emerald-300 border-2 border-[#3f7a4b] px-2.5 py-1">
            {emeraldIcon && (
              <img src={emeraldIcon} alt="Esmeralda" className="w-5 h-5 pixelated" />
            )}
            <span className="font-pixel text-xs tabular-nums">{emeralds}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {trade.offers.map((offer) => {
            const costDef = getItemDef(offer.costId);
            const rewardDef = getItemDef(offer.rewardId);
            const owned = countItemInInventory(inventory, offer.costId);
            const canAfford = owned >= offer.costCount;

            return (
              <div
                key={offer.id}
                className="flex items-center justify-between gap-2 bg-[#b2b2b2] border-2 border-[#787878] p-2.5"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {/* Cost */}
                  <div className="flex items-center gap-1.5 bg-[#8b8b8b] border border-[#525252] px-2 py-1">
                    {icons[String(offer.costId)] && (
                      <img
                        src={icons[String(offer.costId)]}
                        alt={costDef?.name ?? ''}
                        className="w-7 h-7 pixelated shrink-0"
                      />
                    )}
                    <div className="text-xs leading-tight">
                      <div className="font-pixel text-[11px] text-white" style={{ textShadow: '1px 1px 0 #000' }}>
                        ×{offer.costCount}
                      </div>
                      <div className="text-[10px] text-[#222] truncate max-w-[90px]">
                        {costDef?.name ?? String(offer.costId)}
                      </div>
                    </div>
                  </div>

                  <span className="font-pixel text-sm text-[#3d3d3d]" aria-hidden="true">
                    →
                  </span>

                  {/* Reward */}
                  <div className="flex items-center gap-1.5 bg-[#8b8b8b] border border-[#525252] px-2 py-1">
                    {icons[String(offer.rewardId)] && (
                      <img
                        src={icons[String(offer.rewardId)]}
                        alt={rewardDef?.name ?? ''}
                        className="w-7 h-7 pixelated shrink-0"
                      />
                    )}
                    <div className="text-xs leading-tight">
                      <div className="font-pixel text-[11px] text-amber-200" style={{ textShadow: '1px 1px 0 #000' }}>
                        ×{offer.rewardCount}
                      </div>
                      <div className="text-[10px] text-[#222] truncate max-w-[105px]">
                        {rewardDef?.name ?? String(offer.rewardId)}
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={!canAfford}
                  onClick={() => onExecuteTrade(offer.id)}
                  className={`px-3 py-2 font-pixel text-[10px] sm:text-xs text-white shrink-0 ${
                    canAfford ? 'mc-button-primary cursor-pointer' : 'mc-button opacity-50 cursor-not-allowed'
                  }`}
                >
                  Cambiar
                </button>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mc-button w-full py-2 font-pixel text-xs text-white cursor-pointer"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
};
