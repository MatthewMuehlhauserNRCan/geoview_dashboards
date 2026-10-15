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
  // Applies (or clears, via undefined/empty) an attribute filter (SQL-like WHERE expression) on
  // a layer already loaded in this map - e.g. so a filter panel can restrict what the map shows.
  setLayerFilter(layerId: string, expression: string | undefined): void;
  // Fires the moment a layer finishes loading (not just when it starts) - lets dependent data
  // sources react instantly instead of polling. Returns an unsubscribe function.
  onLayerLoaded(callback: (layerId: string) => void): () => void;
}
