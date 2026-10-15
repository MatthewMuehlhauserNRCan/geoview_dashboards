export type LayerGeometryType = 'point' | 'line' | 'polygon' | 'unknown';

export interface DashboardMapLayerInfo {
  id: string;
  name: string;
  geometryType: LayerGeometryType;
  // true only for vector layers whose individual features can be read (raster/tile layers can't be)
  queryable: boolean;
}

// Contract a map panel must satisfy once it's loaded, so data sources can read its layers.
export interface DashboardMapHandle {
  listLayers(): DashboardMapLayerInfo[];
  getLayerFeatures(layerId: string): Promise<Record<string, unknown>[]>;
}
