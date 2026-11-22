import { useCallback, useEffect, useRef, useState } from 'react';
import { CreativeInventoryModal } from './components/CreativeInventoryModal';
import { HUD } from './components/HUD';
import { InventoryModal } from './components/InventoryModal';
import { StatusModals } from './components/StatusModals';
import { TitleOverlay } from './components/TitleOverlay';
import { TouchControls } from './components/TouchControls';
import { VillagerTradeModal } from './components/VillagerTradeModal';
import { WorldMapModal } from './components/WorldMapModal';
import { VoxelEngine } from './game/engine';
import type { HUDState } from './game/types';

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<VoxelEngine | null>(null);
  const [hud, setHud] = useState<HUDState | null>(null);
  const [icons, setIcons] = useState<Record<string, string>>({});

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const engine = new VoxelEngine(container, (nextHud) => {
      setHud(nextHud);
    });
    engineRef.current = engine;
    setIcons(engine.getIconDataUrls());

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const handleDrawMinimap = useCallback((ctx: CanvasRenderingContext2D, size: number) => {
    engineRef.current?.drawMinimap(ctx, size);
  }, []);

  const handleGetExploredChunks = useCallback(() => {
    return engineRef.current?.getExploredChunks() ?? new Map<string, string>();
  }, []);

  const handleGetPlayerTransform = useCallback(() => {
    return engineRef.current?.getPlayerTransform() ?? { x: 0, y: 60, z: 0, yaw: 0 };
  }, []);

  const showSurvivalInventoryModal =
    hud &&
    hud.phase === 'playing' &&
    (hud.modal === 'inventory' ||
      hud.modal === 'crafting' ||
      hud.modal === 'furnace' ||
      hud.modal === 'chest');

  return (
    <main
      className="relative w-full h-full overflow-hidden bg-[#0e141b] select-none"
      style={{ touchAction: 'none' }}
    >
      {/* Isolated WebGL Canvas Container (never torn down by React HUD updates) */}
      <div
        ref={mountRef}
        data-testid="voxel-canvas-container"
        className="w-full h-full"
        style={{ touchAction: 'none' }}
      />

      {hud && hud.phase === 'title' && (
        <TitleOverlay
          seedLabel={hud.seedLabel}
          worldsList={hud.worldsList}
          settings={hud.settings}
          touchControlsActive={hud.touchControlsActive}
          onPlayWorld={(id) => engineRef.current?.playWorldById(id)}
          onCreateWorld={(cfg) => engineRef.current?.createAndPlayWorld(cfg)}
          onDeleteWorld={(id) => engineRef.current?.deleteWorld(id)}
          onPreviewSeed={(seedInput) => engineRef.current?.previewSeed(seedInput)}
          onUpdateSettings={(partial) => engineRef.current?.updateSettings(partial)}
        />
      )}

      {hud && hud.phase === 'playing' && hud.modal === 'none' && hud.touchControlsActive && (
        <TouchControls
          gameMode={hud.gameMode}
          isFlying={hud.isFlying}
          crouching={hud.touchCrouching}
          onJoystickChange={(fwd, strafe, sprint) =>
            engineRef.current?.setTouchJoystick(fwd, strafe, sprint)
          }
          onRotateCamera={(dyaw, dpitch) => engineRef.current?.rotateCamera(dyaw, dpitch)}
          onJumpChange={(held) => engineRef.current?.setTouchJump(held)}
          onFlyDownChange={(held) => engineRef.current?.setTouchFlyDown(held)}
          onToggleFlight={() => engineRef.current?.toggleCreativeFlight()}
          onToggleCrouch={() => engineRef.current?.toggleTouchCrouch()}
          onMineChange={(held) => engineRef.current?.setTouchMine(held)}
          onUseChange={(held) => engineRef.current?.setTouchUse(held)}
          onOpenMap={() => engineRef.current?.toggleWorldMap()}
        />
      )}

      {hud && (
        <HUD
          hud={hud}
          icons={icons}
          onSelectSlot={(idx) => engineRef.current?.setSelectedSlot(idx)}
          onToggleMute={() => engineRef.current?.toggleMute()}
          onOpenWorldMap={() => engineRef.current?.toggleWorldMap()}
          onToggleThirdPerson={() => engineRef.current?.toggleThirdPerson()}
          onAdvanceTime={() => engineRef.current?.advanceTime(3000)}
          onSaveWorld={() => engineRef.current?.saveWorld()}
          onOpenInventory={() => engineRef.current?.openInventoryOrCreative()}
          onPause={() => engineRef.current?.setPhase('paused')}
          onRequestLock={() => engineRef.current?.requestPointerLock()}
          onDrawMinimap={handleDrawMinimap}
        />
      )}

      {showSurvivalInventoryModal && hud && (
        <InventoryModal
          modal={hud.modal}
          inventory={hud.inventory}
          armor={hud.armor}
          activeFurnace={hud.activeFurnace}
          activeChest={hud.activeChest}
          icons={icons}
          onUpdateInventory={(inv) => engineRef.current?.updateInventory(inv)}
          onUpdateArmor={(a) => engineRef.current?.updateArmor(a)}
          onUpdateFurnace={(f) => engineRef.current?.updateFurnace(f)}
          onUpdateChest={(c) => engineRef.current?.updateChest(c)}
          onClose={() => engineRef.current?.setModal('none')}
        />
      )}

      {hud && hud.phase === 'playing' && hud.modal === 'creative' && (
        <CreativeInventoryModal
          inventory={hud.inventory}
          selectedSlot={hud.selectedSlot}
          icons={icons}
          onGiveItem={(id, slot) => engineRef.current?.giveCreativeItem(id, slot)}
          onSelectSlot={(idx) => engineRef.current?.setSelectedSlot(idx)}
          onClearHotbarSlot={(idx) => engineRef.current?.clearHotbarSlot(idx)}
          onClose={() => engineRef.current?.setModal('none')}
        />
      )}

      {hud && hud.phase === 'playing' && hud.modal === 'map' && (
        <WorldMapModal
          worldName={hud.worldName}
          dimension={hud.dimension}
          exploredVersion={hud.exploredVersion}
          getExploredChunks={handleGetExploredChunks}
          getPlayerTransform={handleGetPlayerTransform}
          initialSpawn={hud.initialSpawn}
          bedSpawn={hud.bedSpawn}
          discoveredStructures={hud.discoveredStructures}
          waypoints={hud.waypoints}
          onAddWaypoint={(name, x, z, color) => engineRef.current?.addWaypoint(name, x, z, color)}
          onRemoveWaypoint={(id) => engineRef.current?.removeWaypoint(id)}
          onClose={() => engineRef.current?.setModal('none')}
        />
      )}

      {hud && hud.phase === 'playing' && hud.modal === 'trade' && hud.activeTrade && (
        <VillagerTradeModal
          trade={hud.activeTrade}
          inventory={hud.inventory}
          icons={icons}
          onExecuteTrade={(offerId) => engineRef.current?.executeTrade(offerId)}
          onClose={() => engineRef.current?.setModal('none')}
        />
      )}

      {hud && (hud.phase === 'paused' || hud.phase === 'gameover') && (
        <StatusModals
          hud={hud}
          onResume={() => engineRef.current?.setPhase('playing')}
          onSave={() => engineRef.current?.saveWorld()}
          onExportWorld={() => engineRef.current?.exportWorldJson() ?? '{}'}
          onImportWorld={(json) =>
            engineRef.current?.importWorldJson(json) ?? { ok: false, error: 'Motor no inicializado.' }
          }
          onUpdateSettings={(partial) => engineRef.current?.updateSettings(partial)}
          onToggleWeather={() => engineRef.current?.toggleWeather()}
          onReturnTitle={() => engineRef.current?.returnToTitle(hud.phase === 'paused')}
          onRespawn={() => engineRef.current?.respawnPlayer()}
        />
      )}
    </main>
  );
}
