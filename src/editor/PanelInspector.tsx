import { useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteIcon from '@mui/icons-material/Delete';
import MapIcon from '@mui/icons-material/Map';
import DatasetIcon from '@mui/icons-material/Dataset';
import type { DataSourceConfig, GridPanel, LeafPanelConfig, LinkingChannel } from '../config/types';
import { LEAF_PANEL_TYPES, PANEL_TYPE_LABELS, createDefaultLeafPanel } from './panelDefaults';
import { useEditorStore } from './store';
import { AddPanelDialog } from './AddPanelDialog';
import { ChartSourcesDialog } from './ChartSourcesDialog';
import { ChartColorsDialog } from './ChartColorsDialog';
import { generateId } from './idUtils';

interface MapPanelOption {
  id: string;
  label: string;
}

interface LeafPanelFieldsProps {
  leafPanel: LeafPanelConfig;
  dataSources: DataSourceConfig[];
  channels: LinkingChannel[];
  mapPanelOptions: MapPanelOption[];
  onChange: (updater: (panel: LeafPanelConfig) => LeafPanelConfig) => void;
}

// Common fields (id/title/dataSource/linking) shared by every leaf panel type, plus the
// type-specific fields for whichever `leafPanel.type` is selected. Reused both for a
// top-level grid panel and for panels nested inside a `tab`/`stack`'s tabs/items.
export function LeafPanelFields({ leafPanel, dataSources, channels, mapPanelOptions, onChange }: LeafPanelFieldsProps) {
  const setPreviewMapPanelId = useEditorStore((s) => s.setPreviewMapPanelId);
  const addChannel = useEditorStore((s) => s.addChannel);
  const [configText, setConfigText] = useState(() =>
    leafPanel.type === 'map' ? JSON.stringify(leafPanel.config ?? {}, null, 2) : '',
  );
  const [configError, setConfigError] = useState<string | undefined>();
  const [chartSourcesDialogOpen, setChartSourcesDialogOpen] = useState(false);
  const [chartColorsDialogOpen, setChartColorsDialogOpen] = useState(false);

  const commitConfigText = () => {
    try {
      const parsed = JSON.parse(configText || '{}');
      setConfigError(undefined);
      onChange((p) => (p.type === 'map' ? { ...p, config: parsed } : p));
    } catch {
      setConfigError('Invalid JSON - changes not saved until this is fixed.');
    }
  };

  const selectedDataSource = dataSources.find((ds) => ds.id === leafPanel.dataSource);
  const isChartMultiSource = leafPanel.type === 'chart' && Boolean(leafPanel.sources?.length);
  const chartSourceIds =
    leafPanel.type === 'chart'
      ? (leafPanel.sources?.length ? leafPanel.sources.map((s) => s.dataSourceId) : leafPanel.dataSource ? [leafPanel.dataSource] : [])
      : [];

  // One control covers both "a single chart grouped by a field" and "one value per data source" -
  // picking 1 data source behaves like the former, picking several switches to the latter
  // (preserving any labels already set for ids that stay selected).
  const handleChartDataSourceChange = (next: string[]) => {
    onChange((p) => {
      if (p.type !== 'chart') return p;
      if (next.length <= 1) return { ...p, dataSource: next[0], sources: undefined };
      const existing = p.sources ?? [];
      return { ...p, dataSource: undefined, sources: next.map((id) => existing.find((s) => s.dataSourceId === id) ?? { dataSourceId: id }) };
    });
  };

  return (
    <Stack spacing={2}>
      <TextField label="Id" value={leafPanel.id} size="small" fullWidth disabled helperText="Set when the panel was created" />
      <TextField
        label="Title"
        value={leafPanel.title ?? ''}
        size="small"
        fullWidth
        onChange={(e) => onChange((p) => ({ ...p, title: e.target.value }))}
      />
      {leafPanel.type === 'chart' ? (
        <FormControl size="small" fullWidth>
          <InputLabel>Data source(s)</InputLabel>
          <Select
            multiple
            label="Data source(s)"
            value={chartSourceIds}
            renderValue={(selected) => (
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {(selected as string[]).map((id) => (
                  <Chip key={id} label={id} size="small" />
                ))}
              </Box>
            )}
            onChange={(e) => {
              const value = typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value;
              handleChartDataSourceChange(value);
            }}
          >
            {dataSources.map((ds) => (
              <MenuItem key={ds.id} value={ds.id} title={`${ds.id} (${ds.type})`} selected={chartSourceIds.includes(ds.id)}>
                {ds.id} ({ds.type})
              </MenuItem>
            ))}
          </Select>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
            Pick one for a single chart grouped by Field (below), or several for one value per data
            source (e.g. one bar per sublayer) - not supported for scatter.
          </Typography>
        </FormControl>
      ) : (
        <FormControl size="small" fullWidth disabled={isChartMultiSource}>
          <InputLabel>Data source</InputLabel>
          <Select
            label="Data source"
            value={leafPanel.dataSource ?? ''}
            SelectDisplayProps={{ title: selectedDataSource ? `${selectedDataSource.id} (${selectedDataSource.type})` : '' }}
            onChange={(e) => onChange((p) => ({ ...p, dataSource: e.target.value || undefined }))}
          >
            <MenuItem value="">None</MenuItem>
            {dataSources.map((ds) => (
              <MenuItem key={ds.id} value={ds.id} title={`${ds.id} (${ds.type})`}>
                {ds.id} ({ds.type})
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}


      <FormControl size="small" fullWidth disabled={channels.length === 0}>
        <InputLabel>Emits (on interaction)</InputLabel>
        <Select
          multiple
          label="Emits (on interaction)"
          value={leafPanel.interactions?.emits ?? []}
          renderValue={(selected) => (
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {(selected as string[]).map((v) => (
                <Chip key={v} label={v} size="small" />
              ))}
            </Box>
          )}
          onChange={(e) => {
            const value = typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value;
            onChange((p) => ({ ...p, interactions: { ...p.interactions, emits: value } }));
          }}
        >
          {channels.map((c) => (
            <MenuItem key={c.id} value={c.id} selected={(leafPanel.interactions?.emits ?? []).includes(c.id)}>
              {c.id}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl size="small" fullWidth disabled={channels.length === 0}>
        <InputLabel>Listens to</InputLabel>
        <Select
          multiple
          label="Listens to"
          value={leafPanel.interactions?.listensTo ?? []}
          renderValue={(selected) => (
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {(selected as string[]).map((v) => (
                <Chip key={v} label={v} size="small" />
              ))}
            </Box>
          )}
          onChange={(e) => {
            const value = typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value;
            onChange((p) => ({ ...p, interactions: { ...p.interactions, listensTo: value } }));
          }}
        >
          {channels.map((c) => (
            <MenuItem key={c.id} value={c.id} selected={(leafPanel.interactions?.listensTo ?? []).includes(c.id)}>
              {c.id}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      {channels.length === 0 && (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            No linking channels defined yet - these stay disabled until one exists.
          </Typography>
          <Button size="small" onClick={() => addChannel({ id: generateId('channel'), type: 'filter' })}>
            + New channel
          </Button>
        </Stack>
      )}

      <Divider />

      {leafPanel.type === 'map' && (
        <Stack spacing={1}>
          <TextField
            label="Config URL"
            placeholder="https://example.com/maps/my-map-config.json"
            helperText="Optional - fetches the GeoView map config from a separate file instead of the JSON below (keeps a complex map config out of this dashboard's own config)."
            value={leafPanel.configUrl ?? ''}
            fullWidth
            size="small"
            onChange={(e) => onChange((p) => (p.type === 'map' ? { ...p, configUrl: e.target.value || undefined } : p))}
          />
          <Typography variant="subtitle2">GeoView map config (JSON)</Typography>
          <TextField
            value={configText}
            onChange={(e) => setConfigText(e.target.value)}
            onBlur={commitConfigText}
            multiline
            minRows={8}
            maxRows={16}
            size="small"
            fullWidth
            disabled={Boolean(leafPanel.configUrl)}
            placeholder='{ "map": { ... } }'
            helperText={leafPanel.configUrl ? 'Ignored while Config URL is set.' : undefined}
            sx={{ fontFamily: 'monospace' }}
          />
          {configError && <Alert severity="error">{configError}</Alert>}
          <Button size="small" startIcon={<MapIcon />} onClick={() => setPreviewMapPanelId(leafPanel.id)}>
            Preview this map (needed to discover its layers as data sources)
          </Button>
        </Stack>
      )}

      {leafPanel.type === 'chart' && (
        <Stack spacing={2}>
          <FormControl size="small" fullWidth>
            <InputLabel>Chart type</InputLabel>
            <Select
              label="Chart type"
              value={leafPanel.chartType}
              onChange={(e) => onChange((p) => (p.type === 'chart' ? { ...p, chartType: e.target.value as typeof p.chartType } : p))}
            >
              <MenuItem value="bar">Bar</MenuItem>
              <MenuItem value="line">Line</MenuItem>
              <MenuItem value="pie">Pie</MenuItem>
              <MenuItem value="scatter">Scatter</MenuItem>
              <MenuItem value="histogram">Histogram</MenuItem>
            </Select>
          </FormControl>
          {leafPanel.chartType === 'pie' && (
            <>
              <FormControl size="small" fullWidth>
                <InputLabel>Legend position</InputLabel>
                <Select
                  label="Legend position"
                  value={leafPanel.legendPosition ?? 'right'}
                  onChange={(e) =>
                    onChange((p) => (p.type === 'chart' ? { ...p, legendPosition: e.target.value as typeof p.legendPosition } : p))
                  }
                >
                  <MenuItem value="right">Right (stacked vertically)</MenuItem>
                  <MenuItem value="left">Left (stacked vertically)</MenuItem>
                  <MenuItem value="top">Top</MenuItem>
                  <MenuItem value="bottom">Bottom</MenuItem>
                  <MenuItem value="none">Hidden</MenuItem>
                </Select>
              </FormControl>
              <FormControlLabel
                label="Label each slice directly"
                control={
                  <Checkbox
                    checked={Boolean(leafPanel.showSliceLabels)}
                    onChange={(e) => onChange((p) => (p.type === 'chart' ? { ...p, showSliceLabels: e.target.checked } : p))}
                  />
                }
              />
            </>
          )}
          <TextField
            label="Field (categorical field to aggregate by)"
            value={leafPanel.field ?? ''}
            size="small"
            fullWidth
            disabled={Boolean(leafPanel.sources?.length)}
            helperText={leafPanel.sources?.length ? 'Ignored while multiple data sources are selected above.' : undefined}
            onChange={(e) => onChange((p) => (p.type === 'chart' ? { ...p, field: e.target.value || undefined } : p))}
          />
          {Boolean(leafPanel.field) && !leafPanel.sources?.length && (
            <Box>
              <Button size="small" variant="outlined" startIcon={<DatasetIcon />} onClick={() => setChartColorsDialogOpen(true)}>
                Customize colors{leafPanel.colors && Object.keys(leafPanel.colors).length ? ` (${Object.keys(leafPanel.colors).length})` : ''}
              </Button>
              <ChartColorsDialog
                key={String(chartColorsDialogOpen)}
                open={chartColorsDialogOpen}
                onClose={() => setChartColorsDialogOpen(false)}
                colors={leafPanel.colors ?? {}}
                onChange={(next) =>
                  onChange((p) => (p.type === 'chart' ? { ...p, colors: Object.keys(next).length ? next : undefined } : p))
                }
              />
            </Box>
          )}
          <FormControl size="small" fullWidth disabled={Boolean(leafPanel.sources?.length)}>
            <InputLabel>Aggregation</InputLabel>
            <Select
              label="Aggregation"
              value={leafPanel.aggregation ?? 'count'}
              onChange={(e) =>
                onChange((p) =>
                  p.type === 'chart' ? { ...p, aggregation: e.target.value as typeof p.aggregation } : p,
                )
              }
            >
              <MenuItem value="count">Count (number of rows per group)</MenuItem>
              <MenuItem value="sum">Sum</MenuItem>
              <MenuItem value="avg">Average</MenuItem>
              <MenuItem value="min">Min</MenuItem>
              <MenuItem value="max">Max</MenuItem>
            </Select>
          </FormControl>
          {leafPanel.aggregation && leafPanel.aggregation !== 'count' && !leafPanel.sources?.length && (
            <TextField
              label="Value field (numeric field to aggregate)"
              value={leafPanel.valueField ?? ''}
              size="small"
              fullWidth
              onChange={(e) => onChange((p) => (p.type === 'chart' ? { ...p, valueField: e.target.value || undefined } : p))}
            />
          )}

          {Boolean(leafPanel.sources?.length) && (
            <Box>
              <Button size="small" variant="outlined" startIcon={<DatasetIcon />} onClick={() => setChartSourcesDialogOpen(true)}>
                Customize labels/colors
              </Button>
              <ChartSourcesDialog
                open={chartSourcesDialogOpen}
                onClose={() => setChartSourcesDialogOpen(false)}
                sources={leafPanel.sources ?? []}
                onChange={(next) => onChange((p) => (p.type === 'chart' ? { ...p, sources: next } : p))}
              />
            </Box>
          )}
        </Stack>
      )}


      {leafPanel.type === 'stat' && (
        <Stack spacing={2}>
          <FormControl size="small" fullWidth>
            <InputLabel>Aggregation</InputLabel>
            <Select
              label="Aggregation"
              value={leafPanel.aggregation ?? 'count'}
              onChange={(e) =>
                onChange((p) => (p.type === 'stat' ? { ...p, aggregation: e.target.value as typeof p.aggregation } : p))
              }
            >
              <MenuItem value="count">Count (number of matching rows)</MenuItem>
              <MenuItem value="sum">Sum (total of a numeric field)</MenuItem>
              <MenuItem value="avg">Average</MenuItem>
              <MenuItem value="min">Min</MenuItem>
              <MenuItem value="max">Max</MenuItem>
            </Select>
          </FormControl>
          {leafPanel.aggregation && leafPanel.aggregation !== 'count' && (
            <TextField
              label="Field (numeric field to aggregate)"
              value={leafPanel.field ?? ''}
              size="small"
              fullWidth
              onChange={(e) => onChange((p) => (p.type === 'stat' ? { ...p, field: e.target.value || undefined } : p))}
            />
          )}
          <FormControl size="small" fullWidth>
            <InputLabel>Display</InputLabel>
            <Select
              label="Display"
              value={leafPanel.display ?? 'number'}
              onChange={(e) =>
                onChange((p) => (p.type === 'stat' ? { ...p, display: e.target.value as 'number' | 'gauge' } : p))
              }
            >
              <MenuItem value="number">Plain number</MenuItem>
              <MenuItem value="gauge">Gauge</MenuItem>
            </Select>
          </FormControl>
          {leafPanel.display === 'gauge' && (
            <Stack spacing={2}>
              <Stack direction="row" spacing={2}>
                <TextField
                  label="Gauge min"
                  type="number"
                  value={leafPanel.gauge?.min ?? 0}
                  size="small"
                  fullWidth
                  onChange={(e) =>
                    onChange((p) =>
                      p.type === 'stat' ? { ...p, gauge: { ...p.gauge, min: e.target.value === '' ? undefined : Number(e.target.value) } } : p,
                    )
                  }
                />
                <TextField
                  label="Gauge max"
                  type="number"
                  value={leafPanel.gauge?.max ?? ''}
                  placeholder="Defaults to this stat's unfiltered total"
                  size="small"
                  fullWidth
                  onChange={(e) =>
                    onChange((p) =>
                      p.type === 'stat' ? { ...p, gauge: { ...p.gauge, max: e.target.value === '' ? undefined : Number(e.target.value) } } : p,
                    )
                  }
                />
              </Stack>
              <FormControl size="small" fullWidth>
                <InputLabel>Gauge label</InputLabel>
                <Select
                  label="Gauge label"
                  value={leafPanel.gauge?.label ?? 'value'}
                  onChange={(e) =>
                    onChange((p) =>
                      p.type === 'stat'
                        ? { ...p, gauge: { ...p.gauge, label: e.target.value as 'value' | 'percentage' | 'both' } }
                        : p,
                    )
                  }
                >
                  <MenuItem value="value">Value</MenuItem>
                  <MenuItem value="percentage">Percentage (of gauge min..max)</MenuItem>
                  <MenuItem value="both">Both (value, with percentage underneath)</MenuItem>
                </Select>
              </FormControl>
            </Stack>
          )}
        </Stack>
      )}

      {leafPanel.type === 'legend' && (
        <Stack spacing={2}>
          <FormControl size="small" fullWidth>
            <InputLabel>Map panel</InputLabel>
            <Select
              label="Map panel"
              value={leafPanel.mapPanelId ?? ''}
              onChange={(e) => onChange((p) => (p.type === 'legend' ? { ...p, mapPanelId: e.target.value || undefined } : p))}
            >
              <MenuItem value="">None</MenuItem>
              {mapPanelOptions.map((m) => (
                <MenuItem key={m.id} value={m.id}>
                  {m.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControlLabel
            control={
              <Checkbox
                checked={leafPanel.showLayerHeaders ?? true}
                onChange={(e) => onChange((p) => (p.type === 'legend' ? { ...p, showLayerHeaders: e.target.checked } : p))}
              />
            }
            label="Show layer header (name + toggle-all) above each layer's items"
          />
        </Stack>
      )}

      {leafPanel.type === 'table' && (
        <FormControl size="small" fullWidth>
          <InputLabel>Zoom to feature row action</InputLabel>
          <Select
            label="Zoom to feature row action"
            value={leafPanel.showZoomToFeature === undefined ? 'auto' : leafPanel.showZoomToFeature ? 'show' : 'hide'}
            onChange={(e) =>
              onChange((p) =>
                p.type === 'table'
                  ? { ...p, showZoomToFeature: e.target.value === 'auto' ? undefined : e.target.value === 'show' }
                  : p,
              )
            }
          >
            <MenuItem value="auto">Auto-detect (only shown when the map layer supports it)</MenuItem>
            <MenuItem value="show">Always show</MenuItem>
            <MenuItem value="hide">Always hide</MenuItem>
          </Select>
        </FormControl>
      )}

      {leafPanel.type === 'filter' && (
        <Stack spacing={1}>
          <Typography variant="subtitle2">Fields (requires a map-layer data source)</Typography>
          {leafPanel.fields.map((f, index) => (
            <Stack key={index} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <TextField
                label="Field"
                value={f.field}
                size="small"
                onChange={(e) =>
                  onChange((p) =>
                    p.type === 'filter' ? { ...p, fields: p.fields.map((x, i) => (i === index ? { ...x, field: e.target.value } : x)) } : p,
                  )
                }
              />
              <TextField
                label="Label"
                value={f.label ?? ''}
                size="small"
                onChange={(e) =>
                  onChange((p) =>
                    p.type === 'filter'
                      ? { ...p, fields: p.fields.map((x, i) => (i === index ? { ...x, label: e.target.value || undefined } : x)) }
                      : p,
                  )
                }
              />
              <IconButton
                size="small"
                onClick={() => onChange((p) => (p.type === 'filter' ? { ...p, fields: p.fields.filter((_, i) => i !== index) } : p))}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Stack>
          ))}
          <Button
            size="small"
            onClick={() => onChange((p) => (p.type === 'filter' ? { ...p, fields: [...p.fields, { field: '' }] } : p))}
          >
            Add field
          </Button>
        </Stack>
      )}

      {leafPanel.type === 'text' && (
        <Stack spacing={1.5}>
          <TextField
            label="Content URL"
            placeholder="https://example.com/notes.md"
            helperText="Optional - fetches a remote markdown document instead of the Content field below, and is always rendered as markdown."
            value={leafPanel.contentUrl ?? ''}
            fullWidth
            size="small"
            onChange={(e) => onChange((p) => (p.type === 'text' ? { ...p, contentUrl: e.target.value || undefined } : p))}
          />
          <TextField
            label="Content"
            value={leafPanel.content ?? ''}
            multiline
            minRows={4}
            fullWidth
            size="small"
            disabled={Boolean(leafPanel.contentUrl)}
            helperText={leafPanel.contentUrl ? 'Ignored while Content URL is set.' : undefined}
            onChange={(e) => onChange((p) => (p.type === 'text' ? { ...p, content: e.target.value } : p))}
          />
          <FormControl size="small" fullWidth disabled={Boolean(leafPanel.contentUrl)}>
            <InputLabel>Format</InputLabel>
            <Select
              label="Format"
              value={leafPanel.format ?? 'plain'}
              onChange={(e) =>
                onChange((p) => (p.type === 'text' ? { ...p, format: e.target.value as 'plain' | 'markdown' } : p))
              }
            >
              <MenuItem value="plain">Plain text</MenuItem>
              <MenuItem value="markdown">Markdown</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      )}
    </Stack>
  );
}

interface PanelInspectorProps {
  pageId: string;
  panel: import('../config/types').GridPanel;
  dataSources: DataSourceConfig[];
  channels: LinkingChannel[];
  mapPanelOptions: MapPanelOption[];
}

export function PanelInspector({ pageId, panel, dataSources, channels, mapPanelOptions }: PanelInspectorProps) {
  const updatePanel = useEditorStore((s) => s.updatePanel);

  const updateTop = (updater: (p: typeof panel) => typeof panel) => updatePanel(pageId, panel.id, updater as never);

  if (panel.type === 'tab' || panel.type === 'stack') {
    return (
      <Stack spacing={2}>
        <Typography variant="overline" color="text.secondary">
          {PANEL_TYPE_LABELS[panel.type]}
        </Typography>
        <TextField label="Id" value={panel.id} size="small" fullWidth disabled />
        <TextField
          label="Title"
          value={panel.title ?? ''}
          size="small"
          fullWidth
          onChange={(e) => updateTop((p) => ({ ...p, title: e.target.value }))}
        />
        {panel.type === 'stack' && (
          <FormControl size="small" fullWidth>
            <InputLabel>Direction</InputLabel>
            <Select
              label="Direction"
              value={panel.direction ?? 'column'}
              onChange={(e) => updateTop((p) => (p.type === 'stack' ? { ...p, direction: e.target.value as 'row' | 'column' } : p))}
            >
              <MenuItem value="column">Column (stacked vertically)</MenuItem>
              <MenuItem value="row">Row (side by side)</MenuItem>
            </Select>
          </FormControl>
        )}
        <Divider />
        <NestedPanelList
          pageId={pageId}
          panel={panel}
          dataSources={dataSources}
          channels={channels}
          mapPanelOptions={mapPanelOptions}
          updateTop={updateTop}
        />
      </Stack>
    );
  }

  return (
    <LeafPanelFields
      key={panel.id}
      leafPanel={panel}
      dataSources={dataSources}
      channels={channels}
      mapPanelOptions={mapPanelOptions}
      onChange={(updater) => updateTop((p) => updater(p as LeafPanelConfig) as typeof p)}
    />
  );
}

// Narrowed GridPanel variants (i.e. still carrying `layout`, unlike the plain TabPanelConfig/
// StackPanelConfig types) - casts below restate what `panel`'s own narrowed type already
// guarantees at runtime, while keeping `layout` intact (a plain `as TabPanelConfig` cast would
// silently drop it, since TabPanelConfig itself has no `layout` field).
type GridTabPanel = Extract<GridPanel, { type: 'tab' }>;
type GridStackPanel = Extract<GridPanel, { type: 'stack' }>;
type NestedHostPanel = GridTabPanel | GridStackPanel;

interface NestedPanelListProps {
  pageId: string;
  panel: NestedHostPanel;
  dataSources: DataSourceConfig[];
  channels: LinkingChannel[];
  mapPanelOptions: MapPanelOption[];
  updateTop: (updater: (p: GridPanel) => GridPanel) => void;
}

// `tab`/`stack` both hold a list of nested leaf panels (tabs[].panel / items), each editable
// inline via an accordion reusing the same LeafPanelFields form as a top-level panel.
function NestedPanelList({ panel, dataSources, channels, mapPanelOptions, updateTop }: NestedPanelListProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const isTab = panel.type === 'tab';
  const entries: { key: string; label: string; leaf: LeafPanelConfig }[] = isTab
    ? (panel as GridTabPanel).tabs.map((t) => ({ key: t.id, label: t.label, leaf: t.panel }))
    : (panel as GridStackPanel).items.map((item, i) => ({ key: item.id, label: `Item ${i + 1}`, leaf: item }));

  const removeEntry = (key: string) => {
    updateTop((p) =>
      isTab
        ? { ...(p as GridTabPanel), tabs: (p as GridTabPanel).tabs.filter((t) => t.id !== key) }
        : { ...(p as GridStackPanel), items: (p as GridStackPanel).items.filter((item) => item.id !== key) },
    );
  };

  const updateEntryLeaf = (key: string, updater: (leaf: LeafPanelConfig) => LeafPanelConfig) => {
    updateTop((p) =>
      isTab
        ? { ...(p as GridTabPanel), tabs: (p as GridTabPanel).tabs.map((t) => (t.id === key ? { ...t, panel: updater(t.panel) } : t)) }
        : {
            ...(p as GridStackPanel),
            items: (p as GridStackPanel).items.map((item) => (item.id === key ? updater(item) : item)),
          },
    );
  };

  const updateTabLabel = (key: string, label: string) => {
    updateTop((p) => ({ ...(p as GridTabPanel), tabs: (p as GridTabPanel).tabs.map((t) => (t.id === key ? { ...t, label } : t)) }));
  };

  return (
    <Stack spacing={1}>
      <Typography variant="subtitle2">{isTab ? 'Tabs' : 'Items'}</Typography>
      {entries.map(({ key, label, leaf }) => (
        <Accordion key={key} disableGutters>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', pr: 1 }}>
              <Typography variant="body2">
                {label} ({PANEL_TYPE_LABELS[leaf.type]})
              </Typography>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  removeEntry(key);
                }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Stack spacing={2}>
              {isTab && (
                <TextField label="Tab label" value={label} size="small" fullWidth onChange={(e) => updateTabLabel(key, e.target.value)} />
              )}
              <LeafPanelFields
                leafPanel={leaf}
                dataSources={dataSources}
                channels={channels}
                mapPanelOptions={mapPanelOptions}
                onChange={(updater) => updateEntryLeaf(key, updater)}
              />
            </Stack>
          </AccordionDetails>
        </Accordion>
      ))}
      <Button size="small" onClick={() => setAddDialogOpen(true)}>
        {isTab ? 'Add tab' : 'Add item'}
      </Button>
      <NestedAddDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        onPick={(leaf) => {
          updateTop((p) =>
            isTab
              ? {
                  ...(p as GridTabPanel),
                  tabs: [...(p as GridTabPanel).tabs, { id: leaf.id, label: `Tab ${(p as GridTabPanel).tabs.length + 1}`, panel: leaf }],
                }
              : { ...(p as GridStackPanel), items: [...(p as GridStackPanel).items, leaf] },
          );
        }}
      />
    </Stack>
  );
}

interface NestedAddDialogProps {
  open: boolean;
  onClose: () => void;
  onPick: (leaf: LeafPanelConfig) => void;
}

function NestedAddDialog({ open, onClose, onPick }: NestedAddDialogProps) {
  return (
    <AddPanelDialog
      open={open}
      onClose={onClose}
      types={LEAF_PANEL_TYPES}
      onPick={(type) => onPick(createDefaultLeafPanel(type as LeafPanelConfig['type']))}
    />
  );
}

