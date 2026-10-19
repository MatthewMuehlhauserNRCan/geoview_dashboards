import type { DashboardLegendItem, DashboardMapHandle, DashboardMapLayerInfo, DashboardMapLegendLayer, LayerGeometryType } from '../map/types';
import type { DomainLayerStatusChangedDelegate, MapViewer, TypeFeatureInfoEntry, TypeLayerStyleConfig, TypeLegendItem } from './cgpvTypes';

// Bridges a live GeoView MapViewer to the app's generic DashboardMapHandle contract.
export function createGeoviewMapHandle(mapViewer: MapViewer): DashboardMapHandle {
  // Keyed by layer path - lets `setLegendItemVisible` look up the real GeoView item object
  // `setItemVisibility` requires (geometryType etc.), from just the item name `getMapLegend()`
  // already handed out.
  const legendItemsByLayer = new Map<string, TypeLegendItem[]>();

  return {
    listLayers(): DashboardMapLayerInfo[] {
      return mapViewer.layer.getGeoviewLayerPaths().map((layerPath) => {
        const layer = mapViewer.layer.getGeoviewLayerRegularIfExists(layerPath);
        const style = layer?.getStyle();
        const [firstGeometryKey] = style ? Object.keys(style) : [];
        return {
          id: layerPath,
          name: layer?.getLayerName() ?? layerPath,
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
        mapViewer.layer.getGeoviewLayerPaths().map(async (layerPath): Promise<DashboardMapLegendLayer | undefined> => {
          const layer = mapViewer.layer.getGeoviewLayerRegularIfExists(layerPath);
          if (!layer) return undefined;

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
