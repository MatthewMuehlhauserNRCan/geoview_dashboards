export type LayerGeometryType = 'point' | 'line' | 'polygon' | 'unknown';

export interface DashboardMapLayerInfo {
  id: string;
  name: string;
  geometryType: LayerGeometryType;
  // true only for vector layers whose individual features can be read (raster/tile layers can't be)
  queryable: boolean;
}

// One legend swatch (e.g. one category of a unique-value renderer) within a layer's legend.
export interface DashboardLegendItem {
  name: string;
  // base64 image, or null for an entry with no visual swatch
  icon: string | null;
  isVisible: boolean;
  // This item's raw value for each of DashboardMapLegendLayer.fields (same order), when
  // resolvable from the layer's style config - only needed/used for a MULTI-field classification
  // (a single-field one is matched by `name` directly instead, see LegendPanel's emitFilter).
  values?: (string | number)[];
}

export interface DashboardMapLegendLayer {
  layerId: string;
  layerName: string;
  visible: boolean;
  // The attribute field(s) these items classify by, when resolvable (unique-value renderers
  // only - absent for class-breaks/simple styles, or no style config). ESRI unique-value
  // renderers can classify on up to 3 fields combined, not just one.
  fields?: string[];
  items: DashboardLegendItem[];
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
  // Legend data (swatch icon + label) for every layer on this map, for a legend panel to render.
  getMapLegend(): Promise<DashboardMapLegendLayer[]>;
  setLayerVisible(layerId: string, visible: boolean): void;
  // `itemName` must match a `DashboardLegendItem.name` previously returned by `getMapLegend()`.
  setLegendItemVisible(layerId: string, itemName: string, visible: boolean): void;
}

