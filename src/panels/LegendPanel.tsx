import { useCallback, useEffect, useState } from 'react';
import { Box, Button, List, ListItemButton, ListItemIcon, ListItemText, Typography } from '@mui/material';
import type { LegendPanelConfig } from '../config/types';
import type { DashboardLegendItem, DashboardMapLegendLayer } from '../map/types';
import { PanelContainer } from './PanelContainer';
import { useMapHandle } from '../map/registry';
import { useSetChannelField } from '../linking/useChannel';
import { makeCompositeField, makeCompositeValue } from '../linking/rowFilter';

interface LegendPanelProps {
  panel: LegendPanelConfig;
}

export function LegendPanel({ panel }: LegendPanelProps) {
  const mapHandle = useMapHandle(panel.mapPanelId ?? '');
  const [layers, setLayers] = useState<DashboardMapLegendLayer[]>([]);
  const channel = panel.interactions?.emits?.[0] ?? '';
  const setField = useSetChannelField(channel);

  const refresh = useCallback(() => {
    mapHandle?.getMapLegend().then(setLayers);
  }, [mapHandle]);

  // Refetch whenever a layer finishes loading - the map panel can still be adding layers after
  // its handle first registers, so the initial legend may otherwise be missing late-loading ones.
  useEffect(() => {
    refresh();
    return mapHandle?.onLayerLoaded(refresh);
  }, [mapHandle, refresh]);

  // Pushes which items are still checked to the linking channel, so other panels (table, chart,
  // stat, ...) can filter by the same field(s) - e.g. unchecking an item hides those rows
  // elsewhere too. A SINGLE-field classification is filtered by each item's display `name`, NOT a
  // resolved raw/coded value: GeoView's own feature queries (what table/chart/stat's data comes
  // from) return domain/alias-TRANSLATED display values for classified fields, so a row's value
  // for that field already IS the same string as the legend's item name - confirmed via GeoView's
  // own test suite (`testEsriFeatureDomainFieldQueryValue`). A MULTI-field classification (e.g. 3
  // fields combined into one symbology, confirmed possible via GeoView's real `esri-renderer.ts`)
  // can't be represented as one simple field - a checked item is a specific TUPLE of per-field
  // values, so it uses a composite field key (the real field names joined) + composite value
  // (each item's resolved per-field values joined the same way, see `mapHandleAdapter.ts`'s
  // `resolveLegendFields`) so chart/table/stat's `rowMatchesFieldFilter` can match the exact
  // combination instead of accidentally OR-ing across every checked item's individual values.
  // This intentionally uses its OWN channel (see sampleConfig's "cesi-legend-filter"), separate
  // from the filter panel's shared channel: the map's own backend/style filter needs the raw
  // coded value for a domain-coded field (confirmed via GeoView's layer-filters docs - client-
  // side vector filtering evaluates the raw, untranslated feature attribute), so feeding a
  // display name into that channel could silently match zero features (the original "all hidden"
  // bug). The map itself doesn't need this channel at all - it's already kept in sync directly
  // via `setItemVisibility`/`setLayerVisible` below. Only item-level toggles feed this (not the
  // per-layer map-visibility toggle); the reverse direction (another panel's filter unchecking a
  // legend item) isn't done yet.
  const emitFilter = useCallback(
    (updatedLayers: DashboardMapLegendLayer[]) => {
      if (!channel) return;
      for (const layer of updatedLayers) {
        if (!layer.fields || layer.fields.length === 0) continue;
        const allVisible = layer.items.every((item) => item.isVisible);
        const visibleItems = layer.items.filter((item) => item.isVisible);

        if (layer.fields.length === 1) {
          setField(layer.fields[0], allVisible ? [] : visibleItems.map((item) => item.name));
          continue;
        }

        const field = makeCompositeField(layer.fields);
        setField(
          field,
          allVisible ? [] : visibleItems.filter((item) => item.values !== undefined).map((item) => makeCompositeValue(item.values!)),
        );
      }
    },
    [channel, setField],
  );

  const toggleLayer = (layerId: string, visible: boolean) => {
    mapHandle?.setLayerVisible(layerId, visible);
    setLayers((prev) => prev.map((layer) => (layer.layerId === layerId ? { ...layer, visible } : layer)));
  };

  const toggleItem = (layerId: string, itemName: string, visible: boolean) => {
    mapHandle?.setLegendItemVisible(layerId, itemName, visible);
    setLayers((prev) => {
      const next = prev.map((layer) =>
        layer.layerId === layerId
          ? { ...layer, items: layer.items.map((item) => (item.name === itemName ? { ...item, isVisible: visible } : item)) }
          : layer,
      );
      emitFilter(next);
      return next;
    });
  };

  const hasHidden = layers.some((layer) => !layer.visible || layer.items.some((item) => !item.isVisible));

  // Undoes every layer/item toggle in one click (back to "everything visible") instead of
  // requiring the user to click each hidden layer/item individually.
  const clearSelection = () => {
    for (const layer of layers) {
      if (!layer.visible) mapHandle?.setLayerVisible(layer.layerId, true);
      for (const item of layer.items) {
        if (!item.isVisible) mapHandle?.setLegendItemVisible(layer.layerId, item.name, true);
      }
    }
    const next = layers.map((layer) => ({
      ...layer,
      visible: true,
      items: layer.items.map((item) => ({ ...item, isVisible: true })),
    }));
    setLayers(next);
    emitFilter(next);
  };

  if (!panel.mapPanelId) {
    return <PanelContainer title={panel.title}>Legend needs a map panel configured</PanelContainer>;
  }
  if (!mapHandle) {
    return <PanelContainer title={panel.title}>Loading map…</PanelContainer>;
  }

  const showLayerHeaders = panel.showLayerHeaders ?? true;

  return (
    <PanelContainer
      title={panel.title}
      disablePadding
      bodyOverflow="auto"
      headerAction={hasHidden && (
        <Button size="small" onClick={clearSelection}>
          Clear selection
        </Button>
      )}
    >
      {layers.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
          No layers on this map.
        </Typography>
      ) : (
        <List dense disablePadding>
          {layers.map((layer) => (
            <Box key={layer.layerId}>
              {showLayerHeaders && (
                <LegendRow
                  label={layer.layerName}
                  visible={layer.visible}
                  onClick={() => toggleLayer(layer.layerId, !layer.visible)}
                  header
                />
              )}
              {layer.items.map((item) => (
                <LegendItemRow
                  key={item.name}
                  item={item}
                  indent={showLayerHeaders}
                  onClick={() => toggleItem(layer.layerId, item.name, !item.isVisible)}
                />
              ))}
            </Box>
          ))}
        </List>
      )}
    </PanelContainer>
  );
}

interface LegendRowProps {
  label: string;
  visible: boolean;
  onClick: () => void;
  header?: boolean;
  icon?: string | null;
  indent?: boolean;
}

// Matches GeoView's own legend styling (packages/geoview-core/.../legend-layer-items.tsx): no
// checkbox - a colored left bar (theme primary = checked, grey = unchecked) plus italic text for
// the unchecked state, instead of a MUI Checkbox control. GeoView itself uses a custom green-ish
// palette extension this app doesn't have - substituted the theme's own primary color instead, so
// a custom-themed dashboard's legend matches its own color scheme rather than a hardcoded green.
function LegendRow({ label, visible, onClick, header = false, icon, indent = false }: LegendRowProps) {
  return (
    <ListItemButton
      dense
      disableRipple
      onClick={onClick}
      aria-pressed={visible}
      sx={{
        pl: indent ? 4 : 2,
        borderLeft: '5px solid',
        borderColor: visible ? 'primary.main' : 'grey.400',
        ...(header && { bgcolor: 'action.hover' }),
      }}
    >
      {icon !== undefined && (
        <ListItemIcon sx={{ minWidth: 32 }}>{icon && <img src={icon} alt="" style={{ width: 20, height: 20 }} />}</ListItemIcon>
      )}
      <ListItemText
        primary={label}
        slotProps={{
          primary: {
            sx: {
              fontWeight: header ? 600 : 400,
              textTransform: header ? 'uppercase' : 'none',
              letterSpacing: header ? 0.5 : 'normal',
              fontSize: header ? '0.8rem' : 'inherit',
              fontStyle: visible ? 'normal' : 'italic',
              color: visible ? 'text.primary' : 'text.secondary',
            },
          },
        }}
      />
    </ListItemButton>
  );
}

function LegendItemRow({ item, indent, onClick }: { item: DashboardLegendItem; indent: boolean; onClick: () => void }) {
  return <LegendRow label={item.name} visible={item.isVisible} onClick={onClick} icon={item.icon} indent={indent} />;
}
