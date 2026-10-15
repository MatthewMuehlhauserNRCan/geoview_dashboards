// Minimal duck-typed view of the parts of GeoView's global `cgpv` API this app uses.
// GeoView has no npm package/types here; it's loaded as a global script (see loadCgpv.ts).
// Verified against the real source (Canadian-Geospatial-Platform/geoview, develop branch):
// - api.ts: createMapFromConfigFast, hasMapViewer, deleteMapViewer
// - layer.ts (LayerApi): getGeoviewLayerIds, getGeoviewLayerRegularIfExists, allFeatureInfoLayerSet
// - gv-layers/abstract-gv-layer.ts: getQueryable()

export interface GeoViewFieldEntry {
  value?: unknown;
}

// TODO: confirmed the `fieldInfo` shape exists, but the exact TypeFieldEntry fields beyond
// `value` weren't fetched from source yet - revisit if flattened records look wrong at runtime.
export interface GeoViewFeatureInfoEntry {
  fieldInfo?: Record<string, GeoViewFieldEntry | undefined>;
}

export interface GeoViewFeatureInfoResult {
  results: GeoViewFeatureInfoEntry[];
}

export interface GeoViewLayer {
  getLayerPath(): string;
  getLayerName?(): string;
  getQueryable(): boolean;
  // Per-geometry-type style entries (e.g. keyed by 'Point'/'LineString'/'Polygon'), or undefined
  // if no style has been computed yet - method is always present, its return value isn't.
  getStyle(): Record<string, unknown> | undefined;
}

export interface GeoViewMapViewer {
  mapId: string;
  layer: {
    getGeoviewLayerIds(): string[];
    getGeoviewLayerRegularIfExists(layerPath: string): GeoViewLayer | undefined;
    allFeatureInfoLayerSet: {
      queryLayer(layerPath: string): Promise<GeoViewFeatureInfoResult>;
    };
  };
  controllers: {
    // Upstream (PR #3685, "map resizes to fill container"): re-syncs the map shell's
    // appHeight to an explicit height. GeoView's own auto-detect (useEffectHostResizeSync)
    // exists but doesn't reliably pick up our panel's layout-driven resizes.
    uiController: {
      resizeMapHeight(height: number): void;
    };
  };
}

export interface CgpvApi {
  createMapFromConfigFast(divId: string, mapConfig: string, divHeight?: number): Promise<GeoViewMapViewer>;
  hasMapViewer(mapId: string): boolean;
  deleteMapViewer(mapId: string, deleteContainer: boolean): Promise<void>;
}

export interface CgpvGlobal {
  api: CgpvApi;
}

declare global {
  interface Window {
    cgpv?: CgpvGlobal;
  }
}
