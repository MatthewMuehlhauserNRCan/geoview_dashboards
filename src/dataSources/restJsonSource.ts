import type { RestJsonDataSourceConfig } from '../config/types';
import type { DataSourceProvider, DataSourceRecord } from './types';

// ArcGIS REST `query` endpoints (FeatureServer/MapServer) always wrap rows as
// `{ features: [{ attributes: {...} }] }`, not a plain array - unwrap that shape into flat
// attribute rows so a `rest-json` source can point straight at one, like any other JSON API.
function isArcGisFeatureSet(data: unknown): data is { features: { attributes: DataSourceRecord }[] } {
  if (typeof data !== 'object' || data === null) return false;
  const features = (data as { features?: unknown }).features;
  return Array.isArray(features) && features.every((feature) => typeof feature === 'object' && feature !== null && 'attributes' in feature);
}

export function normalizeRestJsonRows(data: unknown): DataSourceRecord[] {
  if (isArcGisFeatureSet(data)) {
    return data.features.map((feature) => feature.attributes);
  }
  return Array.isArray(data) ? (data as DataSourceRecord[]) : [data as DataSourceRecord];
}

export const restJsonSource: DataSourceProvider = {
  async fetch(source) {
    const config = source as RestJsonDataSourceConfig;
    const response = await fetch(config.url);
    if (!response.ok) {
      throw new Error(`Failed to fetch data source "${config.id}": ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    return normalizeRestJsonRows(data);
  },
};
