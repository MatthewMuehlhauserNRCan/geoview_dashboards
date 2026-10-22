import type { DashboardLegendItem, DashboardMapHandle, DashboardMapLayerInfo, DashboardMapLegendLayer, LayerGeometryType, MapExtent } from '../map/types';
import { setRowExtent } from '../map/rowExtent';
import type {
  DomainLayerStatusChangedDelegate,
  MapMoveEndDelegate,
  MapViewer,
  TypeFeatureInfoEntry,
  TypeLayerStyleConfig,
  TypeLegendItem,
} from './cgpvTypes';

// Bridges a live GeoView MapViewer to the app's generic DashboardMapHandle contract.
export function createGeoviewMapHandle(mapViewer: MapViewer): DashboardMapHandle {
  // Keyed by layer path - lets `setLegendItemVisible` look up the real GeoView item object
  // `setItemVisibility` requires (geometryType etc.), from just the item name `getMapLegend()`
  // already handed out.
  const legendItemsByLayer = new Map<string, TypeLegendItem[]>();
  // Keyed by layer path - the field name GeoView marks as this layer's object-id field (if any),
  // found once from a queried feature's `fieldInfo`. Lets `zoomToFeature`/`canZoomToFeature` find
  // a row's real feature by that field's VALUE (itself one of the row's own plain values) rather
  // than by object identity, which breaks across refetches/HMR/stale caches.
  const oidFieldByLayer = new Map<string, string>();

  // Shared by getViewExtent() and onViewExtentChanged() below - undefined whenever the map isn't
  // fully ready to compute a view extent from yet (e.g. called right as `registerMap()` fires,
  // before GeoView has finished attaching its own internal OL map/view - confirmed to genuinely
  // happen in practice, not just a theoretical race: `mapViewer.map` itself can still be undefined
  // at that moment) - wrapped defensively rather than trusting every intermediate property/method
  // to already be populated the instant a MapViewer object exists. ALSO rejects a degenerate
  // result (zero/negative size, non-finite or zero-area extent) - confirmed in practice that a
  // layout reflow (e.g. switching tabs elsewhere on the page, resizing this map's own container)
  // can trigger a moveend/resize cycle where `mapViewer.map.getSize()` is momentarily read mid-
  // transition, before the resize has fully settled; emitting THAT onto the shared view-extent
  // channel would wrongly filter out every chart/table row for every listener until the next real
  // pan/zoom corrects it - safer to just skip this one read and keep the previous good value.
  function getViewExtent(): MapExtent | undefined {
    try {
      const size = mapViewer.map?.getSize();
      if (!size || size[0] <= 0 || size[1] <= 0) return undefined;
      const extent = mapViewer.getView().calculateExtent(size) as MapExtent;
      const [minX, minY, maxX, maxY] = extent;
      if (![minX, minY, maxX, maxY].every(Number.isFinite)) return undefined;
      if (maxX <= minX || maxY <= minY) return undefined;
      return extent;
    } catch {
      return undefined;
    }
  }

  return {
    listLayers(): DashboardMapLayerInfo[] {
      // Iterate the already-filtered "regular" layers directly (not getGeoviewLayerPaths(), which
      // also includes group-layer paths - e.g. the implicit group GeoView wraps around an
      // esriDynamic service's sublayers - and getGeoviewLayerRegularIfExists() THROWS rather than
      // returning undefined for those).
      return mapViewer.layer.getGeoviewLayersRegulars().map((layer) => {
        const layerPath = layer.getLayerPath();
        const style = layer.getStyle();
        const [firstGeometryKey] = style ? Object.keys(style) : [];
        return {
          id: layerPath,
          name: layer.getLayerName() ?? layerPath,
          geometryType: toLayerGeometryType(firstGeometryKey),
          queryable: layer.getQueryable() ?? false,
        };
      });
    },
    async getLayerFeatures(layerPath: string) {
      // GeoView itself rejects layers that can't produce a feature list (e.g. raster/WMS layers
      // throw NotImplementedError here), so no separate vector-type check is needed on our side.
      const result = await mapViewer.layer.allFeatureInfoLayerSet.queryLayer(layerPath);
      if (!oidFieldByLayer.has(layerPath)) {
        const oidField = Object.keys(result.results[0]?.fieldInfo ?? {}).find(
          (key) => result.results[0].fieldInfo[key]?.dataType === 'oid',
        );
        if (oidField) oidFieldByLayer.set(layerPath, oidField);
      }
      const rows = result.results.map((entry) => {
        const row = flattenFieldInfo(entry);
        // Not every layer type/query includes geometry (e.g. some "all features" bulk queries
        // strip it for performance - see the zoom-to-feature notes in docs/ARCHITECTURE.md) - rows
        // without a resolvable extent simply don't participate in map-view-extent filtering later.
        setRowExtent(row, (entry.extent ?? entry.geometry?.getExtent()) as MapExtent | undefined);
        return row;
      });

      // `esriDynamic`'s own "all features" query NEVER includes geometry (GeoView deliberately
      // strips it there for performance, confirmed in its real source: "We do not query the
      // geometry anymore") - every other queryable layer type's bulk query does include it. Rather
      // than leave this layer type permanently unable to participate in map-view-extent filtering,
      // recover geometry with ONE extra bulk request keyed by OID - `LayerController` (the
      // `controllers.*` registry, same one MapPanel already uses for resize) exposes exactly this:
      // `queryLayerEsriDynamic(layerPath, objectIds)` returns features WITH geometry via a single
      // combined ArcGIS REST query, not one request per feature.
      const oidField = oidFieldByLayer.get(layerPath);
      if (oidField && result.results[0]?.geoviewLayerType === 'esriDynamic') {
        const objectIds = rows.map((row) => Number(row[oidField])).filter((id) => Number.isFinite(id));
        if (objectIds.length > 0) {
          try {
            const withGeometry = await mapViewer.controllers.layerController.queryLayerEsriDynamic(layerPath, objectIds);
            const extentByOid = new Map<number, MapExtent>();
            for (const entry of withGeometry) {
              const oidValue = Number(entry.fieldInfo?.[oidField]?.value);
              const extent = entry.geometry?.getExtent() as MapExtent | undefined;
              if (Number.isFinite(oidValue) && extent) extentByOid.set(oidValue, extent);
            }
            for (const row of rows) {
              const extent = extentByOid.get(Number(row[oidField]));
              if (extent) setRowExtent(row, extent);
            }
          } catch {
            // Best-effort recovery only - rows simply stay without a resolvable extent (same as
            // any other layer type/query that doesn't carry geometry) if this fails.
          }
        }
      }

      return rows;
    },
    setLayerFilter(layerPath: string, expression: string | undefined) {
      // The 'panel' filter category is specifically reserved for custom filter UIs like ours (as
      // opposed to 'data'/'time', which are GeoView's own data-table/time-slider categories).
      mapViewer.layer.getGeoviewLayerRegularIfExists(layerPath)?.setLayerFiltersPanel(expression || undefined);
    },
    onLayerLoaded(callback: (layerId: string) => void) {
      const handler: DomainLayerStatusChangedDelegate = (_layerDomain, event) => {
        if (event.status === 'loaded') callback(event.config.layerPath);
      };
      mapViewer.layer.onLayerStatusChanged(handler);
      return () => mapViewer.layer.offLayerStatusChanged(handler);
    },
    async getMapLegend(): Promise<DashboardMapLegendLayer[]> {
      const results = await Promise.allSettled(
        // Same reasoning as listLayers(): iterate regular layers directly, not
        // getGeoviewLayerPaths() + getGeoviewLayerRegularIfExists() (throws for group paths).
        mapViewer.layer.getGeoviewLayersRegulars().map(async (layer): Promise<DashboardMapLegendLayer | undefined> => {
          const layerPath = layer.getLayerPath();

          mapViewer.layer.legendsLayerSet.queryLegend(layer);
          // A legend that genuinely never arrives (e.g. a layer errored) shouldn't block every
          // other layer's legend from showing - fall back to an empty swatch list after a timeout.
          const event = await Promise.race([
            mapViewer.layer.legendsLayerSet.waitForLegendQueried(layerPath, true),
            new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 8000)),
          ]);
          const items = event?.items ?? [];
          legendItemsByLayer.set(layerPath, items);
          const resolved = resolveLegendFields(event?.styleConfig);

          return {
            layerId: layerPath,
            layerName: layer.getLayerName() ?? layerPath,
            visible: layer.getVisible(),
            fields: resolved?.fields,
            items: items.map(
              (item): DashboardLegendItem => ({
                name: item.name,
                icon: normalizeIcon(item.icon),
                isVisible: item.isVisible,
                values: resolved?.valuesByLabel.get(item.name),
              }),
            ),
          };
        }),
      );
      return results.flatMap((result) => (result.status === 'fulfilled' && result.value ? [result.value] : []));
    },
    setLayerVisible(layerPath: string, visible: boolean) {
      mapViewer.layer.getGeoviewLayerRegularIfExists(layerPath)?.setVisible(visible);
    },
    setLegendItemVisible(layerPath: string, itemName: string, visible: boolean) {
      const item = legendItemsByLayer.get(layerPath)?.find((candidate) => candidate.name === itemName);
      if (item) void mapViewer.layer.setItemVisibility(layerPath, item, visible, false);
    },
    canZoomToFeature(layerPath: string) {
      return oidFieldByLayer.has(layerPath);
    },
    async zoomToFeature(layerPath: string, row: Record<string, unknown>) {
      const oidField = oidFieldByLayer.get(layerPath);
      const oidValue = oidField ? row[oidField] : undefined;
      if (!oidField || typeof oidValue !== 'number') return;

      // Same real API GeoView's own data table uses to resolve a feature's extent by id when a
      // bulk "all features" query didn't carry geometry (confirmed via its real source).
      const extent = await mapViewer.layer
        .getGeoviewLayerRegularIfExists(layerPath)
        ?.getExtentFromFeatures([oidValue], mapViewer.getProjection(), oidField)
        .catch(() => undefined);
      if (!extent) return;

      const [minX, minY, maxX, maxY] = extent;
      // A point (or any other single-coordinate geometry) has a zero-area extent - fitting the
      // view to a literal zero-size box doesn't zoom in meaningfully, so pan to its center and
      // ensure at least a reasonable zoom level instead.
      if (minX === maxX && minY === maxY) {
        const MIN_POINT_ZOOM = 8;
        // GeoView's own `mapViewer.setCenter()` expects lon/lat and transforms it into the
        // view's projection internally (confirmed via its real source) - our extent is already
        // in the view's projection, so setting the OL View's center directly (no conversion)
        // is what's actually needed here, not GeoView's lon/lat-expecting wrapper.
        mapViewer.getView().setCenter([minX, minY]);
        if ((mapViewer.getView().getZoom() ?? 0) < MIN_POINT_ZOOM) mapViewer.setMapZoomLevel(MIN_POINT_ZOOM);
      } else {
        await mapViewer.zoomToExtent(extent);
      }
      // Only the extent (not the real geometry) is available from an id-based lookup, so a
      // persistent per-feature highlight (which needs the actual geometry to draw) isn't
      // possible here - the bbox flash is the closest meaningful equivalent.
      mapViewer.featureHighlight.removeHighlight('all');
      mapViewer.featureHighlight.highlightGeolocatorBBox(extent, false);
    },
    getViewExtent,
    onViewExtentChanged(callback) {
      const handler: MapMoveEndDelegate = () => {
        const extent = getViewExtent();
        if (extent) callback(extent);
      };
      mapViewer.onMapMoveEnd(handler);
      return () => mapViewer.offMapMoveEnd(handler);
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

// Legend items are matched against rows (table/chart/stat) by their display `name` directly when
// the classification is on a SINGLE field, NOT a resolved raw/coded value - GeoView's own feature
// queries return domain/alias-translated display values for classified fields (confirmed from
// GeoView's own test suite), so a row's value for the classified field already IS the same
// display string as the legend's item name. A classification can also be based on MULTIPLE
// fields combined (ESRI unique-value renderers support up to 3, confirmed via GeoView's real
// `esri-renderer.ts` - `field1`/`field2`/`field3`) - a composite display name can't be reliably
// decomposed back into per-field values, so that case instead needs each item's raw per-field
// tuple from the style config's `info.values` (aligned with `fields`, in the same order renderer
// values are always stored - confirmed via `#processUniqueValueRenderer`/`searchUniqueValueEntry`
// in GeoView's real source).
function resolveLegendFields(
  styleConfig: TypeLayerStyleConfig | undefined,
): { fields: string[]; valuesByLabel: Map<string, (string | number)[]> } | undefined {
  if (!styleConfig) return undefined;
  for (const settings of Object.values(styleConfig)) {
    if (!settings || settings.fields.length === 0) continue;

    const valuesByLabel = new Map<string, (string | number)[]>();
    for (const info of settings.info) {
      // `values: ['']` is how GeoView marks a default/catch-all class with no real value.
      if (info.label !== undefined && !(info.values.length === 1 && info.values[0] === '')) valuesByLabel.set(info.label, info.values);
    }
    return { fields: settings.fields, valuesByLabel };
  }
  return undefined;
}

function flattenFieldInfo(entry: TypeFeatureInfoEntry): Record<string, unknown> {
  const record: Record<string, unknown> = {};
  for (const [field, info] of Object.entries(entry.fieldInfo ?? {})) {
    record[field] = info?.value;
  }
  return record;
}

// GeoView's base64 icons don't consistently include the `data:` URI prefix - normalize so <img
// src> always works regardless.
function normalizeIcon(icon: string | null | undefined): string | null {
  if (!icon) return null;
  return icon.startsWith('data:') ? icon : `data:image/png;base64,${icon}`;
}
