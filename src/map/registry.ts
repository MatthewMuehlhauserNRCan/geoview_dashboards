import { useEffect, useState } from 'react';
import { create } from 'zustand';
import type { DashboardMapHandle, DashboardMapLayerInfo } from './types';

interface MapRegistryState {
  maps: Record<string, DashboardMapHandle>;
  registerMap: (panelId: string, handle: DashboardMapHandle) => void;
  unregisterMap: (panelId: string) => void;
}

// Tracks live map instances by panel id so other panels/data sources can read their layers.
export const useMapRegistryStore = create<MapRegistryState>((set) => ({
  maps: {},
  registerMap: (panelId, handle) => set((state) => ({ maps: { ...state.maps, [panelId]: handle } })),
  unregisterMap: (panelId) =>
    set((state) => {
      const nextMaps = { ...state.maps };
      delete nextMaps[panelId];
      return { maps: nextMaps };
    }),
}));

// Non-reactive lookup for use outside React (e.g. inside a data source provider's fetch()).
export function getMapHandle(panelId: string): DashboardMapHandle | undefined {
  return useMapRegistryStore.getState().maps[panelId];
}

// Reactive lookup: re-renders when this map panel registers/unregisters.
export function useMapHandle(panelId: string): DashboardMapHandle | undefined {
  return useMapRegistryStore((state) => state.maps[panelId]);
}

// Reactively resolves once a specific layer appears on a map panel's handle. The map handle
// registers as soon as GeoView creates the MapViewer, but GeoView still loads each configured
// layer asynchronously after that - so `listLayers()` can legitimately not include a layer yet
// even though the handle itself already exists. Reacts to the handle's real `onLayerLoaded`
// event (no polling) - giving dependent queries a React state change the instant GeoView
// reports the layer loaded, instead of only ever refreshing on next remount (e.g. switching
// tabs away and back).
export function useLayerReady(mapPanelId: string, layerId: string): DashboardMapLayerInfo | undefined {
  const mapHandle = useMapHandle(mapPanelId);
  const [layer, setLayer] = useState<DashboardMapLayerInfo | undefined>();

  useEffect(() => {
    if (!mapHandle) {
      setLayer(undefined);
      return undefined;
    }
    const check = () => setLayer(mapHandle.listLayers().find((candidate) => candidate.id === layerId));
    // Already loaded by the time this mounts (e.g. remounted after a prior successful load).
    check();
    return mapHandle.onLayerLoaded((loadedLayerId) => {
      if (loadedLayerId === layerId) check();
    });
  }, [mapHandle, layerId]);


  return layer;
}
