import { useMemo } from 'react';
import { Box, FormControl, InputLabel, MenuItem, Select, Typography } from '@mui/material';
import type { DashboardConfig, MapPanelConfig } from '../config/types';
import { MapPanel } from '../panels/MapPanel';
import { useEditorStore } from './store';

// All top-level map panels across every page (map panels nested inside a tab/stack aren't
// included - discovering their layers would need that tab/stack to be active, out of scope for v1).
export function useMapPanels(config: DashboardConfig): MapPanelConfig[] {
  return useMemo(() => {
    const result: MapPanelConfig[] = [];
    for (const page of config.pages) {
      for (const panel of page.panels) {
        if (panel.type === 'map') result.push(panel);
      }
    }
    return result;
  }, [config.pages]);
}

// Renders a REAL, live GeoView map for one of the dashboard's map panels, so the map-layer
// data source dialog can read its actual queryable layers (via the same map registry the
// end-viewer dashboard uses) instead of requiring the author to type layer paths blind.
export function MapPreview() {
  const config = useEditorStore((s) => s.config);
  const previewMapPanelId = useEditorStore((s) => s.previewMapPanelId);
  const setPreviewMapPanelId = useEditorStore((s) => s.setPreviewMapPanelId);

  const mapPanels = useMapPanels(config);

  const selected = mapPanels.find((p) => p.id === previewMapPanelId) ?? mapPanels[0];
  const hasConfig = selected && Object.keys(selected.config ?? {}).length > 0;

  if (mapPanels.length === 0) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Add a map panel to preview it here and discover its layers as data sources.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <FormControl size="small" sx={{ mb: 1 }}>
        <InputLabel>Previewing map</InputLabel>
        <Select label="Previewing map" value={selected?.id ?? ''} onChange={(e) => setPreviewMapPanelId(e.target.value)}>
          {mapPanels.map((p) => (
            <MenuItem key={p.id} value={p.id}>
              {p.title || p.id}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <Box sx={{ flex: 1, minHeight: 320 }}>
        {selected && hasConfig && <MapPanel key={selected.id} panel={selected} />}
        {selected && !hasConfig && (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
            Paste a valid GeoView map config for "{selected.title || selected.id}" in its inspector to preview it here.
          </Typography>
        )}
      </Box>
    </Box>
  );
}
