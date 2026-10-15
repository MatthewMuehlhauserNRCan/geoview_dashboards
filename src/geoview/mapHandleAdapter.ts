import type { DashboardMapHandle, DashboardMapLayerInfo, LayerGeometryType } from '../map/types';
import type { GeoViewFeatureInfoEntry, GeoViewMapViewer } from './cgpvTypes';

// Bridges a live GeoView MapViewer to the app's generic DashboardMapHandle contract.
export function createGeoviewMapHandle(mapViewer: GeoViewMapViewer): DashboardMapHandle {
  return {
    listLayers(): DashboardMapLayerInfo[] {
      return mapViewer.layer.getGeoviewLayerIds().map((layerPath) => {
        const layer = mapViewer.layer.getGeoviewLayerRegularIfExists(layerPath);
        const style = layer?.getStyle();
        const [firstGeometryKey] = style ? Object.keys(style) : [];
        return {
          id: layerPath,
          name: layer?.getLayerName?.() ?? layerPath,
          geometryType: toLayerGeometryType(firstGeometryKey),
          queryable: layer?.getQueryable() ?? false,
        };
      });
    },
    async getLayerFeatures(layerPath: string) {
      // GeoView itself rejects layers that can't produce a feature list (e.g. raster/WMS layers
      // throw NotImplementedError here), so no separate vector-type check is needed on our side.
      const result = await mapViewer.layer.allFeatureInfoLayerSet.queryLayer(layerPath);
      return result.results.map(flattenFieldInfo);
    },
  };
}

// GeoView's style objects are keyed by OpenLayers geometry type names ('Point'/'LineString'/'Polygon').
function toLayerGeometryType(rawGeometryType: string | undefined): LayerGeometryType {
  switch (rawGeometryType) {
    case 'Point':
      return 'point';
    case 'LineString':
      return 'line';
    case 'Polygon':
      return 'polygon';
    default:
      return 'unknown';
  }
}

function flattenFieldInfo(entry: GeoViewFeatureInfoEntry): Record<string, unknown> {
  const record: Record<string, unknown> = {};
  for (const [field, info] of Object.entries(entry.fieldInfo ?? {})) {
    record[field] = info?.value;
  }
  return record;
}
