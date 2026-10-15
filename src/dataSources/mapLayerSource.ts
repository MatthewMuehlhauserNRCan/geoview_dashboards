import type { MapLayerDataSourceConfig } from '../config/types';
import type { DashboardMapHandle } from '../map/types';
import type { DataSourceProvider } from './types';
import { getMapHandle } from '../map/registry';

// The map handle registers as soon as GeoView creates the MapViewer, but GeoView still loads
// each configured layer asynchronously after that - so a layer can legitimately be missing from
// listLayers() for a few seconds after the map itself is "ready". Poll instead of failing fast.
async function waitForLayer(map: DashboardMapHandle, layerId: string, timeoutMs = 15000, intervalMs = 300) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const layer = map.listLayers().find((candidate) => candidate.id === layerId);
    if (layer || Date.now() >= deadline) return layer;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

export const mapLayerSource: DataSourceProvider = {
  async fetch(source) {
    const config = source as MapLayerDataSourceConfig;
    const map = getMapHandle(config.mapPanelId);
    if (!map) {
      throw new Error(`Map panel "${config.mapPanelId}" isn't loaded yet`);
    }

    const layer = await waitForLayer(map, config.layerId);
    if (!layer) {
      throw new Error(`Layer "${config.layerId}" was not found on map panel "${config.mapPanelId}"`);
    }
    if (!layer.queryable) {
      throw new Error(`Layer "${config.layerId}" has no accessible feature data (not a queryable vector layer)`);
    }

    return map.getLayerFeatures(config.layerId);
  },
};

