import { create } from 'zustand';
import type { DashboardMapHandle } from './types';

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
