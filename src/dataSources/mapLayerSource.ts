import type { MapLayerDataSourceConfig } from '../config/types';
import type { DataSourceProvider } from './types';
import { getMapHandle } from '../map/registry';

export const mapLayerSource: DataSourceProvider = {
  async fetch(source) {
    const config = source as MapLayerDataSourceConfig;
    const map = getMapHandle(config.mapPanelId);
    if (!map) {
      throw new Error(`Map panel "${config.mapPanelId}" isn't loaded yet`);
    }

    // useDataSource only enables this query once useLayerReady has confirmed the layer is
    // present, so a missing layer here would mean it disappeared after that check - still worth
    // a clear error rather than a silent crash.
    const layer = map.listLayers().find((candidate) => candidate.id === config.layerId);
    if (!layer) {
      throw new Error(`Layer "${config.layerId}" was not found on map panel "${config.mapPanelId}"`);
    }
    if (!layer.queryable) {
      throw new Error(`Layer "${config.layerId}" has no accessible feature data (not a queryable vector layer)`);
    }

    return map.getLayerFeatures(config.layerId);
  },
};


