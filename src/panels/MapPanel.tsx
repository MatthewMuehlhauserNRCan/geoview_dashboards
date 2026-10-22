import { useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '@mui/material/styles';
import { Box } from '@mui/material';

import type { DataSourceConfig, MapPanelConfig } from '../config/types';
import { PanelContainer } from './PanelContainer';
import { useMapHandle, useMapRegistryStore } from '../map/registry';
import { loadCgpv } from '../geoview/loadCgpv';
import { createGeoviewMapHandle } from '../geoview/mapHandleAdapter';
import { runMapLifecycleStep } from '../geoview/mapLifecycle';
import type { MapViewer } from '../geoview/cgpvTypes';
import { useListenChannels } from '../linking/useChannel';
import { CHART_SOURCE_FIELD, CHART_SOURCE_UNIVERSE_FIELD } from '../linking/rowFilter';

interface MapPanelProps {
  panel: MapPanelConfig;
  dataSources?: DataSourceConfig[];
}

export function MapPanel({ panel, dataSources = [] }: MapPanelProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const theme = useTheme();
  const mapViewerRef = useRef<MapViewer | null>(null);
  const registerMap = useMapRegistryStore((state) => state.registerMap);
  const unregisterMap = useMapRegistryStore((state) => state.unregisterMap);
  const mapHandle = useMapHandle(panel.id);
  const sourceSelectionFilter = useListenChannels(panel.interactions?.listensTo ?? []);
  const selectedSourceIds = sourceSelectionFilter?.[CHART_SOURCE_FIELD];
  const chartSourceUniverse = sourceSelectionFilter?.[CHART_SOURCE_UNIVERSE_FIELD];

  // Lets an author link to a separate GeoView map config file instead of embedding it inline
  // (keeps a complex map config out of the dashboard's own JSON) - fetched the same way
  // TextPanel fetches `contentUrl`, not routed through the dataSources/useDataSource machinery.
  const {
    data: fetchedConfig,
    isLoading: isConfigLoading,
    error: configFetchError,
  } = useQuery({
    queryKey: ['map-panel-config', panel.configUrl],
    queryFn: async () => {
      const response = await fetch(panel.configUrl!);
      if (!response.ok) {
        throw new Error(`Failed to fetch map config "${panel.configUrl}": ${response.status} ${response.statusText}`);
      }
      return (await response.json()) as Record<string, unknown>;
    },
    enabled: Boolean(panel.configUrl),
  });

  // `configUrl` wins over an inline `config` when both are set (schema requires at least one).
  const resolvedConfig = panel.configUrl ? fetchedConfig : panel.config;

  useEffect(() => {
    const container = containerRef.current;
    // Still waiting on `configUrl` to resolve (or it failed) - nothing to create a map from yet.
    if (!container || resolvedConfig === undefined) return undefined;

    // GeoView's own built-in auto-resize (useEffectHostResizeSync) doesn't reliably pick up
    // this panel's layout-driven resizes, so we drive it explicitly instead.
    const resizeObserver = new ResizeObserver(([entry]) => {
      const height = entry?.contentRect.height;
      if (height) mapViewerRef.current?.controllers.uiController.resizeMapHeight(height);
    });
    resizeObserver.observe(container);

    // Stable per-panel id (not regenerated per mount): anything that needs to address this
    // specific map later (multiple map panels, "zoom map X" style interactions) needs it to
    // survive mount/cleanup churn - React 18 StrictMode's dev-only double-invoke included.
    // The create/delete calls below are serialized per id (see mapLifecycle.ts) so that
    // double-invoke can't race two calls against the same id.
    const mapDivId = `geoview-map-${panel.id}`;
    let cancelled = false;

    void runMapLifecycleStep(mapDivId, async () => {
      if (cancelled) return;

      const mapDiv = document.createElement('div');
      mapDiv.id = mapDivId;
      mapDiv.style.width = '100%';
      mapDiv.style.height = '100%';
      container.appendChild(mapDiv);

      try {
        await loadCgpv();
        if (cancelled) {
          mapDiv.remove();
          return;
        }

        const mapViewer = await window.cgpv!.api.createMapFromConfigFast(mapDivId, JSON.stringify(resolvedConfig));
        if (cancelled) {
          await window.cgpv!.api.deleteMapViewer(mapDivId, true).catch(() => undefined);
          return;
        }

        mapViewerRef.current = mapViewer;
        registerMap(panel.id, createGeoviewMapHandle(mapViewer));
      } catch (error) {
        console.error(`Failed to load GeoView map for panel "${panel.id}"`, error);
        // GeoView can partially register a MapViewer for the div even when it later fails
        // config validation, which would collide with a retry using the same div id.
        await window.cgpv?.api.deleteMapViewer(mapDivId, true).catch(() => undefined);
        mapDiv.remove();
      }
    });

    return () => {
      cancelled = true;
      resizeObserver.disconnect();
      mapViewerRef.current = null;
      unregisterMap(panel.id);
      void runMapLifecycleStep(mapDivId, async () => {
        await window.cgpv?.api.deleteMapViewer(mapDivId, true).catch(() => undefined);
      });
    };
  }, [panel.id, resolvedConfig, registerMap, unregisterMap]);

  // Lets another panel's click-selection (e.g. a multi-source chart's "one bar per data source"
  // mode) drive which of THIS map's layers are shown - routed through the normal linking-channel
  // system via the reserved CHART_SOURCE_FIELD, not a direct cross-component call. Only layers
  // backed by a `map-layer` data source that's part of the chart's OWN `sources[]` universe are
  // affected (CHART_SOURCE_UNIVERSE_FIELD) - a layer whose data source was never listed on that
  // chart to begin with is left alone, not hidden just because something ELSE got selected; an
  // empty/missing selection means "unconstrained" (show all), matching the rest of the app's
  // filter convention.
  const selectedSourceIdsKey = useMemo(() => selectedSourceIds?.join(',') ?? '', [selectedSourceIds]);
  const chartSourceUniverseKey = useMemo(() => chartSourceUniverse?.join(',') ?? '', [chartSourceUniverse]);
  useEffect(() => {
    if (!mapHandle || !chartSourceUniverse) return;
    const ownMapLayerSources = dataSources.filter(
      (source): source is Extract<DataSourceConfig, { type: 'map-layer' }> =>
        source.type === 'map-layer' && source.mapPanelId === panel.id && chartSourceUniverse.includes(source.id),
    );
    for (const source of ownMapLayerSources) {
      const visible = !selectedSourceIds || selectedSourceIds.length === 0 || selectedSourceIds.includes(source.id);
      mapHandle.setLayerVisible(source.layerId, visible);
    }
  }, [mapHandle, panel.id, dataSources, selectedSourceIds, selectedSourceIdsKey, chartSourceUniverse, chartSourceUniverseKey]);

  if (panel.configUrl) {
    if (isConfigLoading) {
      return (
        <PanelContainer title={panel.title} expandable={false} disablePadding>
          <div>Loading map config…</div>
        </PanelContainer>
      );
    }
    if (configFetchError) {
      return (
        <PanelContainer title={panel.title} expandable={false} disablePadding>
          <div>{(configFetchError as Error).message}</div>
        </PanelContainer>
      );
    }
  }

  return (
    // GeoView already has its own fullscreen control, so this panel doesn't need ours too
    <PanelContainer title={panel.title} expandable={false} disablePadding>
      {/* box-sizing: border-box keeps this div's total footprint at exactly 100% of its parent
          Cell even with the border added (otherwise the border would add 2px on top of 100%,
          overflowing the Cell) - the map then renders just inside the border, not under it.
          GeoView's own map has MANY internal tab stops (zoom, geolocate, basemap, layers, ...) -
          tabbing all the way through them to reach the rest of the page is slow at best, and a
          genuine keyboard trap at worst (WCAG 2.1.2). `tabIndex={-1}` makes this container itself
          focusable only programmatically (never via sequential Tab, so it adds no new stop) -
          pressing Escape anywhere inside moves focus here, which (being outside the map's own
          internal tab sequence) lets the very next Tab continue straight on to whatever's after
          the map in the page, instead of its dozens of internal controls. */}
      <Box
        ref={containerRef}
        tabIndex={-1}
        aria-label="Interactive map. Press Escape to exit the map and continue tabbing through the page."
        onKeyDown={(event) => {
          if (event.key === 'Escape') containerRef.current?.focus();
        }}
        sx={{ width: '100%', height: '100%', border: `1px solid ${theme.palette.divider}`, boxSizing: 'border-box' }}
      >
      </Box>
    </PanelContainer>
  );
}
