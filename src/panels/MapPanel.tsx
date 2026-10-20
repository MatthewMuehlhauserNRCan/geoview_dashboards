import { useEffect, useRef } from 'react';
import { useTheme } from '@mui/material/styles';
import { Box } from '@mui/material';

import type { MapPanelConfig } from '../config/types';
import { PanelContainer } from './PanelContainer';
import { useMapRegistryStore } from '../map/registry';
import { loadCgpv } from '../geoview/loadCgpv';
import { createGeoviewMapHandle } from '../geoview/mapHandleAdapter';
import { runMapLifecycleStep } from '../geoview/mapLifecycle';
import type { MapViewer } from '../geoview/cgpvTypes';

interface MapPanelProps {
  panel: MapPanelConfig;
}

export function MapPanel({ panel }: MapPanelProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const theme = useTheme();
  const mapViewerRef = useRef<MapViewer | null>(null);
  const registerMap = useMapRegistryStore((state) => state.registerMap);
  const unregisterMap = useMapRegistryStore((state) => state.unregisterMap);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

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

        const mapViewer = await window.cgpv!.api.createMapFromConfigFast(mapDivId, JSON.stringify(panel.config));
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
  }, [panel.id, panel.config, registerMap, unregisterMap]);

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
