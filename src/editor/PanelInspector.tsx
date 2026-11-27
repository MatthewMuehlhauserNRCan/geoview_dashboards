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
  Dialog,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteIcon from '@mui/icons-material/Delete';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import MapIcon from '@mui/icons-material/Map';
import DatasetIcon from '@mui/icons-material/Dataset';
import type {
  ChartPanelConfig,
  DataSourceConfig,
  GridPanel,
  ImageItemConfig,
  ImagePanelConfig,
  LeafPanelConfig,
  LinkingChannel,
} from '../config/types';
import { toImageItems } from '../panels/imageItems';
import { LEAF_PANEL_TYPES, PANEL_TYPE_LABELS, createDefaultLeafPanel } from './panelDefaults';
import { useEditorStore } from './store';
import { AddPanelDialog } from './AddPanelDialog';
import { ChartSourcesDialog } from './ChartSourcesDialog';
import { ChartColorsDialog } from './ChartColorsDialog';
import { TableSourcesDialog } from './TableSourcesDialog';
import { CardStylesDialog } from './CardStylesDialog';
import { ExcludeValuesDialog } from './ExcludeValuesDialog';
import { generateId } from './idUtils';

interface MapPanelOption {
  id: string;
  label: string;
}

// Titles are off by default (undefined = no header shown at all) - this checkbox is the only way
// to turn one on, rather than an always-visible text field an author has to notice and clear.
function TitleField({ title, onChange }: { title: string | undefined; onChange: (title: string | undefined) => void }) {
  return (
    <Stack spacing={1}>
      <FormControlLabel
        label="Include title"
        control={
          <Checkbox checked={title !== undefined} onChange={(e) => onChange(e.target.checked ? (title ?? '') : undefined)} />
        }
      />
      {title !== undefined && <TextField label="Title" value={title} size="small" fullWidth onChange={(e) => onChange(e.target.value)} />}
    </Stack>
  );
}

interface LeafPanelFieldsProps {
  leafPanel: LeafPanelConfig;
  dataSources: DataSourceConfig[];
  channels: LinkingChannel[];
  mapPanelOptions: MapPanelOption[];
  onChange: (updater: (panel: LeafPanelConfig) => LeafPanelConfig) => void;
}


function parsePositiveInt(value: string): number | undefined {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
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
  const [tableSourcesDialogOpen, setTableSourcesDialogOpen] = useState(false);
  const [cardStylesDialogOpen, setCardStylesDialogOpen] = useState(false);
  const [excludeValuesDialogOpen, setExcludeValuesDialogOpen] = useState(false);

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
  const setChart = (patch: Partial<ChartPanelConfig>) => onChange((p) => (p.type === 'chart' ? { ...p, ...patch } : p));
  const isMultiSourcePanel = leafPanel.type === 'chart' || leafPanel.type === 'table';
  const isChartMultiSource = leafPanel.type === 'chart' && Boolean(leafPanel.sources?.length);
  const isCardsManual = leafPanel.type === 'cards' && Boolean(leafPanel.cards?.length);
  const multiSourceIds = isMultiSourcePanel
    ? (leafPanel.sources?.length ? leafPanel.sources.map((s) => s.dataSourceId) : leafPanel.dataSource ? [leafPanel.dataSource] : [])
    : [];

  // One control covers both "a single chart/table using one data source" and "one value per data
  // source"/"one merged table from several data sources" - picking 1 behaves like the former,
  // picking several switches to the latter (preserving any labels already set for ids that stay
  // selected). Shared between `chart` and `table`, the only two panel types with a `sources` mode.
  function nextSourcesFromIds(next: string[], existing: { dataSourceId: string; label?: string }[] | undefined) {
    return next.map((id) => existing?.find((s) => s.dataSourceId === id) ?? { dataSourceId: id });
  }
  const handleMultiSourceDataSourceChange = (next: string[]) => {
    onChange((p) => {
      if (p.type === 'chart') {
        if (next.length <= 1) return { ...p, dataSource: next[0], sources: undefined };
        return { ...p, dataSource: undefined, sources: nextSourcesFromIds(next, p.sources) };
      }
      if (p.type === 'table') {
        if (next.length <= 1) return { ...p, dataSource: next[0], sources: undefined };
        return { ...p, dataSource: undefined, sources: nextSourcesFromIds(next, p.sources) };
      }
      return p;
    });
  };

  return (
    <Stack spacing={2}>
      <TextField label="Id" value={leafPanel.id} size="small" fullWidth disabled helperText="Set when the panel was created" />
      <TitleField title={leafPanel.title} onChange={(title) => onChange((p) => ({ ...p, title }))} />
      {isMultiSourcePanel ? (
        <FormControl size="small" fullWidth>
          <InputLabel>Data source(s)</InputLabel>
          <Select
            multiple
            label="Data source(s)"
            value={multiSourceIds}
            renderValue={(selected) => (
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {(selected as string[]).map((id) => (
                  <Chip key={id} label={id} size="small" />
                ))}
              </Box>
            )}
            onChange={(e) => {
              const value = typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value;
              handleMultiSourceDataSourceChange(value);
            }}
          >
            {dataSources.map((ds) => (
              <MenuItem key={ds.id} value={ds.id} title={`${ds.id} (${ds.type})`} selected={multiSourceIds.includes(ds.id)}>
                {ds.id} ({ds.type})
              </MenuItem>
            ))}
          </Select>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
            {leafPanel.type === 'chart'
              ? 'Pick one for a single chart, or several for one bar per data source (or one series per source when Field is set).'
              : 'Pick one for a single table, or several to merge their rows into one table (adds a "Source" column).'}
          </Typography>
        </FormControl>
      ) : (
        <FormControl size="small" fullWidth disabled={isChartMultiSource || isCardsManual}>
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
            <MenuItem key={c.id} value={c.id} title={c.description || c.id} selected={(leafPanel.interactions?.emits ?? []).includes(c.id)}>
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
            <MenuItem key={c.id} value={c.id} title={c.description || c.id} selected={(leafPanel.interactions?.listensTo ?? []).includes(c.id)}>
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
          <Alert severity="info">
            "Emits" above has a special meaning for a map: when set, this map publishes its current
            view extent onto those channel(s) as the viewer pans/zooms. Chart/table panels
            listening to the same channel can then filter their own rows down to just what's
            currently visible on the map (on by default, with a viewer-facing toggle).
          </Alert>
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
          <FormControl size="small" fullWidth>
            <InputLabel>Legend position</InputLabel>
            <Select
              label="Legend position"
              value={leafPanel.legendPosition ?? (leafPanel.chartType === 'pie' ? 'right' : 'top')}
              onChange={(e) => setChart({ legendPosition: e.target.value as ChartPanelConfig['legendPosition'] })}
            >
              <MenuItem value="right">Right (stacked vertically)</MenuItem>
              <MenuItem value="left">Left (stacked vertically)</MenuItem>
              <MenuItem value="top">Top</MenuItem>
              <MenuItem value="bottom">Bottom</MenuItem>
              <MenuItem value="none">Hidden</MenuItem>
            </Select>
          </FormControl>
          {leafPanel.chartType === 'pie' && (
            <FormControlLabel
              label="Label each slice directly"
              control={<Checkbox checked={Boolean(leafPanel.showSliceLabels)} onChange={(e) => setChart({ showSliceLabels: e.target.checked })} />}
            />
          )}
          {leafPanel.chartType !== 'scatter' && (
            <FormControlLabel
              label="Show values on the chart"
              control={<Checkbox checked={Boolean(leafPanel.showValueLabels)} onChange={(e) => setChart({ showValueLabels: e.target.checked || undefined })} />}
            />
          )}
          {(leafPanel.chartType === 'bar' || leafPanel.chartType === 'line' || leafPanel.chartType === 'histogram') && (
            <FormControlLabel
              label="Stack series"
              control={<Checkbox checked={Boolean(leafPanel.stacked)} onChange={(e) => setChart({ stacked: e.target.checked || undefined })} />}
            />
          )}
          {(leafPanel.chartType === 'bar' || leafPanel.chartType === 'histogram') && (
            <FormControlLabel
              label="Horizontal bars"
              control={<Checkbox checked={Boolean(leafPanel.horizontal)} onChange={(e) => setChart({ horizontal: e.target.checked || undefined })} />}
            />
          )}
          {leafPanel.chartType !== 'scatter' && (
            <TextField
              label={leafPanel.chartType === 'histogram' ? 'Field (numeric field to bin)' : 'Field (categorical field to group by)'}
              value={leafPanel.field ?? ''}
              size="small"
              fullWidth
              helperText={
                leafPanel.sources?.length && leafPanel.chartType !== 'pie'
                  ? 'With several data sources: leave empty for one bar per source, or set to draw one series per source grouped by this field.'
                  : leafPanel.sources?.length
                    ? 'Ignored for pie while several data sources are selected (one slice per source).'
                    : 'Leave empty to plot one bar/point per raw row (X/Y fields below).'
              }
              onChange={(e) => setChart({ field: e.target.value || undefined })}
            />
          )}
          {!leafPanel.sources?.length && leafPanel.chartType !== 'pie' && (
            <TextField
              label="Series field (optional)"
              value={leafPanel.seriesField ?? ''}
              size="small"
              fullWidth
              helperText="Splits the chart into one series per distinct value of this field (e.g. grouped/stacked bars)."
              onChange={(e) => setChart({ seriesField: e.target.value || undefined })}
            />
          )}
          {Boolean(leafPanel.field || (leafPanel.seriesField && leafPanel.chartType !== 'pie')) && !leafPanel.sources?.length && (
            <Box>
              <Button size="small" variant="outlined" startIcon={<DatasetIcon />} onClick={() => setChartColorsDialogOpen(true)}>
                Customize colors{leafPanel.colors && Object.keys(leafPanel.colors).length ? ` (${Object.keys(leafPanel.colors).length})` : ''}
              </Button>
              <ChartColorsDialog
                key={String(chartColorsDialogOpen)}
                open={chartColorsDialogOpen}
                onClose={() => setChartColorsDialogOpen(false)}
                colors={leafPanel.colors ?? {}}
                keyedBy={leafPanel.seriesField && leafPanel.chartType !== 'pie' ? 'Series field' : 'Field'}
                onChange={(next) => setChart({ colors: Object.keys(next).length ? next : undefined })}
              />
            </Box>
          )}
          {leafPanel.chartType !== 'scatter' && (
            <FormControl size="small" fullWidth>
              <InputLabel>Aggregation</InputLabel>
              <Select
                label="Aggregation"
                value={leafPanel.aggregation ?? 'count'}
                onChange={(e) => setChart({ aggregation: e.target.value as ChartPanelConfig['aggregation'] })}
              >
                <MenuItem value="count">Count (number of rows per group)</MenuItem>
                <MenuItem value="sum">Sum</MenuItem>
                <MenuItem value="avg">Average</MenuItem>
                <MenuItem value="min">Min</MenuItem>
                <MenuItem value="max">Max</MenuItem>
              </Select>
            </FormControl>
          )}
          {leafPanel.chartType !== 'scatter' && leafPanel.aggregation && leafPanel.aggregation !== 'count' && (
            <TextField
              label="Value field (numeric field to aggregate)"
              value={leafPanel.valueField ?? ''}
              size="small"
              fullWidth
              onChange={(e) => setChart({ valueField: e.target.value || undefined })}
            />
          )}
          {Boolean(leafPanel.field) && leafPanel.chartType !== 'histogram' && !(leafPanel.sources?.length && leafPanel.chartType === 'pie') && (
            <Stack direction="row" spacing={1}>
              <FormControl size="small" fullWidth>
                <InputLabel>Sort</InputLabel>
                <Select
                  label="Sort"
                  value={leafPanel.sort ?? 'label'}
                  onChange={(e) => setChart({ sort: e.target.value === 'label' ? undefined : (e.target.value as ChartPanelConfig['sort']) })}
                >
                  <MenuItem value="label">By label</MenuItem>
                  <MenuItem value="value-desc">By value (largest first)</MenuItem>
                  <MenuItem value="value-asc">By value (smallest first)</MenuItem>
                </Select>
              </FormControl>
              <TextField
                label="Limit (top N + Other)"
                type="number"
                value={leafPanel.limit ?? ''}
                size="small"
                fullWidth
                slotProps={{ htmlInput: { min: 1 } }}
                onChange={(e) => setChart({ limit: parsePositiveInt(e.target.value) })}
              />
            </Stack>
          )}
          {leafPanel.chartType === 'histogram' && (
            <TextField
              label="Bins"
              type="number"
              value={leafPanel.bins ?? ''}
              placeholder="10"
              size="small"
              fullWidth
              slotProps={{ htmlInput: { min: 1 } }}
              onChange={(e) => setChart({ bins: parsePositiveInt(e.target.value) })}
            />
          )}
          {(leafPanel.chartType === 'scatter' || (!leafPanel.field && !leafPanel.sources?.length)) && (
            <Stack direction="row" spacing={1}>
              <TextField
                label={leafPanel.chartType === 'scatter' ? 'X field' : 'Label field (x)'}
                value={leafPanel.xField ?? ''}
                placeholder="auto"
                size="small"
                fullWidth
                onChange={(e) => setChart({ xField: e.target.value || undefined })}
              />
              <TextField
                label={leafPanel.chartType === 'scatter' ? 'Y field' : 'Value field (y)'}
                value={leafPanel.yField ?? ''}
                placeholder="auto"
                size="small"
                fullWidth
                onChange={(e) => setChart({ yField: e.target.value || undefined })}
              />
            </Stack>
          )}
          {leafPanel.chartType !== 'pie' && (
            <Stack direction="row" spacing={1}>
              <TextField
                label="X axis title"
                value={leafPanel.xAxisTitle ?? ''}
                placeholder="auto"
                size="small"
                fullWidth
                onChange={(e) => setChart({ xAxisTitle: e.target.value || undefined })}
              />
              <TextField
                label="Y axis title"
                value={leafPanel.yAxisTitle ?? ''}
                placeholder="auto"
                size="small"
                fullWidth
                onChange={(e) => setChart({ yAxisTitle: e.target.value || undefined })}
              />
            </Stack>
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
          <FormControlLabel
            label="Filter to current map view, when available"
            control={
              <Checkbox
                checked={leafPanel.filterToMapView ?? true}
                onChange={(e) => onChange((p) => (p.type === 'chart' ? { ...p, filterToMapView: e.target.checked } : p))}
              />
            }
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: -1 }}>
            Only applies while a listened channel is a map panel publishing its view extent (see the
            map panel's own "Emits" note) - the viewer can still toggle this off at runtime.
          </Typography>
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
        <Stack spacing={1}>
          {Boolean(leafPanel.sources?.length) && (
            <Box>
              <Button size="small" variant="outlined" startIcon={<DatasetIcon />} onClick={() => setTableSourcesDialogOpen(true)}>
                Customize labels
              </Button>
              <TableSourcesDialog
                open={tableSourcesDialogOpen}
                onClose={() => setTableSourcesDialogOpen(false)}
                sources={leafPanel.sources ?? []}
                onChange={(next) => onChange((p) => (p.type === 'table' ? { ...p, sources: next } : p))}
              />
            </Box>
          )}
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
              <MenuItem value="auto">
                {leafPanel.sources?.length ? 'Auto-detect (checked per row)' : 'Auto-detect (only shown when the map layer supports it)'}
              </MenuItem>
              <MenuItem value="show">Always show</MenuItem>
              <MenuItem value="hide">Always hide</MenuItem>
            </Select>
          </FormControl>
          <FormControlLabel
            label="Filter to current map view, when available"
            control={
              <Checkbox
                checked={leafPanel.filterToMapView ?? true}
                onChange={(e) => onChange((p) => (p.type === 'table' ? { ...p, filterToMapView: e.target.checked } : p))}
              />
            }
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: -1 }}>
            Only applies while a listened channel is a map panel publishing its view extent (see the
            map panel's own "Emits" note) - the viewer can still toggle this off at runtime.
          </Typography>
        </Stack>
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
            label="Template"
            placeholder={'## {{Header1_EN}}\n\n{{Text1_EN}}'}
            helperText="Optional - markdown with {{FieldName}} placeholders, filled in from Data source's row(s) (above), and/or {{$valueId}} dashboard values (see Values in the toolbar - no Data source needed for those). Wrap part of it in {{#Field}}...{{/Field}} to hide that whole section when Field is empty. Takes priority over Content/Content URL below."
            value={leafPanel.template ?? ''}
            multiline
            minRows={3}
            fullWidth
            size="small"
            onChange={(e) => onChange((p) => (p.type === 'text' ? { ...p, template: e.target.value || undefined } : p))}
          />
          {leafPanel.template && (
            <FormControlLabel
              control={
                <Checkbox
                  checked={leafPanel.repeatTemplate ?? true}
                  onChange={(e) =>
                    onChange((p) => (p.type === 'text' ? { ...p, repeatTemplate: e.target.checked } : p))
                  }
                />
              }
              label="Repeat template for every row (uncheck to use only the first row)"
            />
          )}
          {leafPanel.template && (
            <TextField
              label="No results text"
              placeholder="No data available."
              helperText="Optional - markdown shown instead of Template when Data source returns zero rows. Leave blank to render Template against an empty row instead."
              value={leafPanel.emptyContent ?? ''}
              multiline
              minRows={2}
              fullWidth
              size="small"
              onChange={(e) =>
                onChange((p) => (p.type === 'text' ? { ...p, emptyContent: e.target.value || undefined } : p))
              }
            />
          )}
          <TextField
            label="Content URL"
            placeholder="https://example.com/notes.md"
            helperText="Optional - fetches a remote markdown document instead of the Content field below, and is always rendered as markdown."
            value={leafPanel.contentUrl ?? ''}
            fullWidth
            size="small"
            disabled={Boolean(leafPanel.template)}
            onChange={(e) => onChange((p) => (p.type === 'text' ? { ...p, contentUrl: e.target.value || undefined } : p))}
          />
          <TextField
            label="Content"
            value={leafPanel.content ?? ''}
            multiline
            minRows={4}
            fullWidth
            size="small"
            disabled={Boolean(leafPanel.contentUrl) || Boolean(leafPanel.template)}
            helperText={
              leafPanel.template
                ? 'Ignored while Template is set.'
                : leafPanel.contentUrl
                  ? 'Ignored while Content URL is set.'
                  : undefined
            }
            onChange={(e) => onChange((p) => (p.type === 'text' ? { ...p, content: e.target.value } : p))}
          />
          <FormControl size="small" fullWidth disabled={Boolean(leafPanel.contentUrl) || Boolean(leafPanel.template)}>
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
          <TextField
            label="Footer"
            placeholder="Sources: [Canadian Meteorological Centre](https://weather.gc.ca) (CMC)"
            helperText="Optional - markdown pinned to the bottom of the panel (stays visible while the content scrolls), e.g. a source citation. Supports {{$valueId}} values and {{FieldName}} from Data source's first row."
            value={leafPanel.footer ?? ''}
            multiline
            minRows={2}
            fullWidth
            size="small"
            onChange={(e) => onChange((p) => (p.type === 'text' ? { ...p, footer: e.target.value || undefined } : p))}
          />
        </Stack>
      )}

      {leafPanel.type === 'image' && (
        <Stack spacing={1.5}>
          <ImageListFields panel={leafPanel} onChange={onChange} />
          <FormControl size="small" fullWidth>
            <InputLabel>Fit</InputLabel>
            <Select
              label="Fit"
              value={leafPanel.fit ?? 'contain'}
              onChange={(e) =>
                onChange((p) => (p.type === 'image' ? { ...p, fit: e.target.value as 'contain' | 'cover' | 'fill' } : p))
              }
            >
              <MenuItem value="contain">Contain (show whole image)</MenuItem>
              <MenuItem value="cover">Cover (fill panel, may crop)</MenuItem>
              <MenuItem value="fill">Fill (stretch to panel)</MenuItem>
            </Select>
          </FormControl>
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={leafPanel.lightbox ?? true}
                onChange={(e) =>
                  onChange((p) => (p.type === 'image' ? { ...p, lightbox: e.target.checked ? undefined : false } : p))
                }
              />
            }
            label="Open full screen when clicked"
          />
          {toImageItems(leafPanel).length > 1 && (
            <>
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={leafPanel.autoplay ?? false}
                    onChange={(e) =>
                      onChange((p) => (p.type === 'image' ? { ...p, autoplay: e.target.checked || undefined } : p))
                    }
                  />
                }
                label="Auto-advance (with pause button)"
              />
              {leafPanel.autoplay && (
                <TextField
                  label="Seconds per image"
                  type="number"
                  value={leafPanel.autoplaySeconds ?? ''}
                  placeholder="5"
                  fullWidth
                  size="small"
                  slotProps={{ htmlInput: { min: 1, step: 1 } }}
                  onChange={(e) => {
                    const seconds = Number(e.target.value);
                    onChange((p) =>
                      p.type === 'image' ? { ...p, autoplaySeconds: e.target.value && seconds > 0 ? seconds : undefined } : p,
                    );
                  }}
                />
              )}
            </>
          )}
        </Stack>
      )}

      {leafPanel.type === 'cards' && (
        <Stack spacing={1.5}>
          <TextField
            label="Columns"
            type="number"
            placeholder="Auto"
            helperText="Cards per row on wide screens (still wraps to fewer on narrower ones). Leave blank for a fully responsive auto-fit grid."
            value={leafPanel.columns ?? ''}
            fullWidth
            size="small"
            slotProps={{ htmlInput: { min: 1, step: 1 } }}
            onChange={(e) => {
              const columns = Number(e.target.value);
              onChange((p) => (p.type === 'cards' ? { ...p, columns: e.target.value && columns > 0 ? columns : undefined } : p));
            }}
          />
          <Divider />
          <Typography variant="subtitle2">Manual cards</Typography>
          <Typography variant="body2" color="text.secondary">
            Author a fixed list of cards directly here (takes priority over Data source below), or
            leave this empty and set Data source + Title field below to generate one card per row
            instead.
          </Typography>
          {(leafPanel.cards ?? []).map((card, index) => (
            <Accordion key={index} disableGutters>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>{card.title || `Card ${index + 1}`}</AccordionSummary>
              <AccordionDetails>
                <Stack spacing={1.5}>
                  <TextField
                    label="Title"
                    value={card.title}
                    fullWidth
                    size="small"
                    onChange={(e) =>
                      onChange((p) =>
                        p.type === 'cards'
                          ? { ...p, cards: (p.cards ?? []).map((c, i) => (i === index ? { ...c, title: e.target.value } : c)) }
                          : p,
                      )
                    }
                  />
                  <TextField
                    label="Header image URL"
                    helperText="Full-width image for the front of the card - expected to already include the card's own title/branding. Leave blank to show the title as plain text on a colored band instead."
                    value={card.icon ?? ''}
                    fullWidth
                    size="small"
                    onChange={(e) =>
                      onChange((p) =>
                        p.type === 'cards'
                          ? {
                              ...p,
                              cards: (p.cards ?? []).map((c, i) =>
                                i === index ? { ...c, icon: e.target.value || undefined } : c,
                              ),
                            }
                          : p,
                      )
                    }
                  />
                  <TextField
                    label="Color"
                    placeholder="e.g. #9c1f28"
                    helperText="Background for the fallback colored band (used only when Header image URL is blank)."
                    value={card.color ?? ''}
                    fullWidth
                    size="small"
                    onChange={(e) =>
                      onChange((p) =>
                        p.type === 'cards'
                          ? {
                              ...p,
                              cards: (p.cards ?? []).map((c, i) =>
                                i === index ? { ...c, color: e.target.value || undefined } : c,
                              ),
                            }
                          : p,
                      )
                    }
                  />
                  <TextField
                    label="Summary (markdown)"
                    value={card.summary ?? ''}
                    multiline
                    minRows={2}
                    fullWidth
                    size="small"
                    onChange={(e) =>
                      onChange((p) =>
                        p.type === 'cards'
                          ? {
                              ...p,
                              cards: (p.cards ?? []).map((c, i) =>
                                i === index ? { ...c, summary: e.target.value || undefined } : c,
                              ),
                            }
                          : p,
                      )
                    }
                  />
                  <TextField
                    label="Detail (markdown)"
                    value={card.detail ?? ''}
                    multiline
                    minRows={3}
                    fullWidth
                    size="small"
                    onChange={(e) =>
                      onChange((p) =>
                        p.type === 'cards'
                          ? {
                              ...p,
                              cards: (p.cards ?? []).map((c, i) =>
                                i === index ? { ...c, detail: e.target.value || undefined } : c,
                              ),
                            }
                          : p,
                      )
                    }
                  />
                  <Button
                    size="small"
                    color="error"
                    startIcon={<DeleteIcon />}
                    onClick={() =>
                      onChange((p) => (p.type === 'cards' ? { ...p, cards: (p.cards ?? []).filter((_, i) => i !== index) } : p))
                    }
                  >
                    Remove card
                  </Button>
                </Stack>
              </AccordionDetails>
            </Accordion>
          ))}
          <Button
            size="small"
            onClick={() => onChange((p) => (p.type === 'cards' ? { ...p, cards: [...(p.cards ?? []), { title: '' }] } : p))}
          >
            + Add card
          </Button>
          <Divider />
          <TextField
            label="Title field"
            helperText="Row field whose value becomes each card's title, and the key used to look up Card styles below. Ignored while Manual cards above are set."
            value={leafPanel.titleField ?? ''}
            fullWidth
            size="small"
            disabled={Boolean(leafPanel.cards?.length)}
            onChange={(e) => onChange((p) => (p.type === 'cards' ? { ...p, titleField: e.target.value || undefined } : p))}
          />
          <TextField
            label="Require fields (comma-separated)"
            helperText="Optional - only rows where EVERY one of these fields has a real value become a card (e.g. hide a mostly-blank placeholder row until its real content field is populated). Ignored while Manual cards above are set."
            value={(leafPanel.requireFields ?? []).join(', ')}
            fullWidth
            size="small"
            disabled={Boolean(leafPanel.cards?.length)}
            onChange={(e) => {
              const fields = e.target.value
                .split(',')
                .map((f) => f.trim())
                .filter(Boolean);
              onChange((p) => (p.type === 'cards' ? { ...p, requireFields: fields.length ? fields : undefined } : p));
            }}
          />
          <Box>
            <Button
              size="small"
              variant="outlined"
              startIcon={<DatasetIcon />}
              disabled={Boolean(leafPanel.cards?.length)}
              onClick={() => setExcludeValuesDialogOpen(true)}
            >
              Exclude specific values
              {leafPanel.excludeValues && Object.keys(leafPanel.excludeValues).length
                ? ` (${Object.keys(leafPanel.excludeValues).length})`
                : ''}
            </Button>
            <ExcludeValuesDialog
              key={String(excludeValuesDialogOpen)}
              open={excludeValuesDialogOpen}
              onClose={() => setExcludeValuesDialogOpen(false)}
              excludeValues={leafPanel.excludeValues ?? {}}
              onChange={(next) =>
                onChange((p) => (p.type === 'cards' ? { ...p, excludeValues: Object.keys(next).length ? next : undefined } : p))
              }
            />
          </Box>
          <TextField
            label="Summary template"
            placeholder={'**Activation Level**\n{{ActivationLevel}}'}
            helperText="Optional - markdown with {{FieldName}} placeholders, shown under the header on BOTH the front and the back (it never swaps away). Wrap part of it in {{#Field}}...{{/Field}} to hide that whole section when Field is empty. Ignored while Manual cards above are set."
            value={leafPanel.summaryTemplate ?? ''}
            multiline
            minRows={2}
            fullWidth
            size="small"
            disabled={Boolean(leafPanel.cards?.length)}
            onChange={(e) => onChange((p) => (p.type === 'cards' ? { ...p, summaryTemplate: e.target.value || undefined } : p))}
          />
          <TextField
            label="Detail template"
            placeholder={'{{#Activities}}**Current or Projected Activities**\n{{Activities}}{{/Activities}}'}
            helperText="Optional - markdown shown on the back of the card (below the title, which reappears as plain text there), revealed by hovering (desktop) or tapping the card's expand icon. Wrap part of it in {{#Field}}...{{/Field}} to hide that whole section when Field is empty. A card with no Header image AND nothing here has no back to flip to (shown statically). Ignored while Manual cards above are set."
            value={leafPanel.detailTemplate ?? ''}
            multiline
            minRows={3}
            fullWidth
            size="small"
            disabled={Boolean(leafPanel.cards?.length)}
            onChange={(e) => onChange((p) => (p.type === 'cards' ? { ...p, detailTemplate: e.target.value || undefined } : p))}
          />
          <TextField
            label="Icon field"
            helperText="Optional - row field holding the card's full front-of-card header image URL (should already include the card's own title/branding), if the data source provides one. Ignored while Manual cards above are set."
            value={leafPanel.iconField ?? ''}
            fullWidth
            size="small"
            disabled={Boolean(leafPanel.cards?.length)}
            onChange={(e) => onChange((p) => (p.type === 'cards' ? { ...p, iconField: e.target.value || undefined } : p))}
          />
          <TextField
            label="Color field"
            helperText="Optional - row field holding the fallback band's background color (used only when there's no header image), if the data source provides one. Ignored while Manual cards above are set."
            value={leafPanel.colorField ?? ''}
            fullWidth
            size="small"
            disabled={Boolean(leafPanel.cards?.length)}
            onChange={(e) => onChange((p) => (p.type === 'cards' ? { ...p, colorField: e.target.value || undefined } : p))}
          />
          <Box>
            <Button
              size="small"
              variant="outlined"
              startIcon={<DatasetIcon />}
              disabled={Boolean(leafPanel.cards?.length)}
              onClick={() => setCardStylesDialogOpen(true)}
            >
              Customize icons/colors
              {leafPanel.cardStyles && Object.keys(leafPanel.cardStyles).length ? ` (${Object.keys(leafPanel.cardStyles).length})` : ''}
            </Button>
            <CardStylesDialog
              key={String(cardStylesDialogOpen)}
              open={cardStylesDialogOpen}
              onClose={() => setCardStylesDialogOpen(false)}
              cardStyles={leafPanel.cardStyles ?? {}}
              onChange={(next) =>
                onChange((p) => (p.type === 'cards' ? { ...p, cardStyles: Object.keys(next).length ? next : undefined } : p))
              }
            />
          </Box>
          <TextField
            label="Default icon URL"
            helperText="Fallback header image when neither a card's own icon nor Customize icons/colors supplies one."
            value={leafPanel.defaultIcon ?? ''}
            fullWidth
            size="small"
            onChange={(e) => onChange((p) => (p.type === 'cards' ? { ...p, defaultIcon: e.target.value || undefined } : p))}
          />
          <TextField
            label="Default color"
            placeholder="e.g. #9c1f28 (falls back to the theme's primary color if unset)"
            value={leafPanel.defaultColor ?? ''}
            fullWidth
            size="small"
            onChange={(e) => onChange((p) => (p.type === 'cards' ? { ...p, defaultColor: e.target.value || undefined } : p))}
          />
          <TextField
            label="No results text"
            placeholder="No data available."
            helperText="Optional - shown instead of the (empty) grid when there are zero cards to show."
            value={leafPanel.emptyText ?? ''}
            fullWidth
            size="small"
            onChange={(e) => onChange((p) => (p.type === 'cards' ? { ...p, emptyText: e.target.value || undefined } : p))}
          />
        </Stack>
      )}
    </Stack>
  );
}

// Edits the image list. Any edit writes the normalized `images` array and drops the
// single-image `src`/`alt`/`link` shorthand, so there's only ever one source of truth.
function ImageListFields({
  panel,
  onChange,
}: {
  panel: ImagePanelConfig;
  onChange: (updater: (panel: LeafPanelConfig) => LeafPanelConfig) => void;
}) {
  const items = toImageItems(panel);
  const setItems = (update: (items: ImageItemConfig[]) => ImageItemConfig[]) =>
    onChange((p) => {
      if (p.type !== 'image') return p;
      const { src: _src, alt: _alt, link: _link, ...rest } = p;
      return { ...rest, images: update(toImageItems(p)) };
    });
  const updateItem = (index: number, patch: Partial<ImageItemConfig>) =>
    setItems((list) => list.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  const move = (index: number, delta: number) =>
    setItems((list) => {
      const next = [...list];
      const [item] = next.splice(index, 1);
      next.splice(index + delta, 0, item);
      return next;
    });

  return (
    <Stack spacing={1}>
      <Typography variant="subtitle2">Images</Typography>
      {items.length > 1 && (
        <Typography variant="caption" color="text.secondary">
          More than one image shows as a carousel with previous/next buttons.
        </Typography>
      )}
      {items.map((item, i) => (
        <Box key={i} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1 }}>
          <Stack spacing={1}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Typography variant="body2" sx={{ flex: 1 }}>
                Image {i + 1}
              </Typography>
              <IconButton size="small" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                <ArrowUpwardIcon fontSize="small" />
              </IconButton>
              <IconButton size="small" aria-label="Move down" disabled={i === items.length - 1} onClick={() => move(i, 1)}>
                <ArrowDownwardIcon fontSize="small" />
              </IconButton>
              <IconButton size="small" aria-label="Remove image" onClick={() => setItems((list) => list.filter((_, j) => j !== i))}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
            <TextField
              label="Image URL"
              placeholder="https://example.com/photo.jpg"
              value={item.src}
              fullWidth
              size="small"
              onChange={(e) => updateItem(i, { src: e.target.value })}
            />
            <TextField
              label="Alt text"
              value={item.alt ?? ''}
              fullWidth
              size="small"
              onChange={(e) => updateItem(i, { alt: e.target.value || undefined })}
            />
            <TextField
              label="Caption"
              value={item.caption ?? ''}
              fullWidth
              size="small"
              onChange={(e) => updateItem(i, { caption: e.target.value || undefined })}
            />
            <TextField
              label="Panel title for this image"
              helperText="Optional - replaces the panel's title while this image is showing."
              value={item.title ?? ''}
              fullWidth
              size="small"
              onChange={(e) => updateItem(i, { title: e.target.value || undefined })}
            />
            <TextField
              label="Link URL"
              placeholder="https://example.com"
              helperText="Optional - clicking the image opens this in a new tab instead of full screen."
              value={item.link ?? ''}
              fullWidth
              size="small"
              onChange={(e) => updateItem(i, { link: e.target.value || undefined })}
            />
          </Stack>
        </Box>
      ))}
      <Button size="small" onClick={() => setItems((list) => [...list, { src: '' }])} sx={{ alignSelf: 'flex-start' }}>
        Add image
      </Button>
    </Stack>
  );
}

interface PanelInspectorProps {
  pageId: string;
  panel: import('../config/types').GridPanel;
  pagePanels: GridPanel[];
  dataSources: DataSourceConfig[];
  channels: LinkingChannel[];
  mapPanelOptions: MapPanelOption[];
}

export function PanelInspector({ pageId, panel, pagePanels, dataSources, channels, mapPanelOptions }: PanelInspectorProps) {
  const updatePanel = useEditorStore((s) => s.updatePanel);
  const promoteToContainer = useEditorStore((s) => s.promoteToContainer);

  const updateTop = (updater: (p: typeof panel) => typeof panel) => updatePanel(pageId, panel.id, updater as never);

  if (panel.type === 'tab' || panel.type === 'stack') {
    return (
      <Stack spacing={2}>
        <Typography variant="overline" color="text.secondary">
          {PANEL_TYPE_LABELS[panel.type]}
        </Typography>
        <TextField label="Id" value={panel.id} size="small" fullWidth disabled />
        <TitleField title={panel.title} onChange={(title) => updateTop((p) => ({ ...p, title }))} />
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
          siblingPanels={pagePanels.filter((p) => p.id !== panel.id && p.type !== 'tab' && p.type !== 'stack')}
          dataSources={dataSources}
          channels={channels}
          mapPanelOptions={mapPanelOptions}
          updateTop={updateTop}
        />
      </Stack>
    );
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <Typography variant="caption" color="text.secondary">
          Promote to:
        </Typography>
        <Button size="small" variant="outlined" onClick={() => promoteToContainer(pageId, panel.id, 'tab')}>
          Tabs
        </Button>
        <Button size="small" variant="outlined" onClick={() => promoteToContainer(pageId, panel.id, 'stack')}>
          Split
        </Button>
      </Stack>
      <LeafPanelFields
        key={panel.id}
        leafPanel={panel}
        dataSources={dataSources}
        channels={channels}
        mapPanelOptions={mapPanelOptions}
        onChange={(updater) => updateTop((p) => updater(p as LeafPanelConfig) as typeof p)}
      />
    </Stack>
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
  siblingPanels: GridPanel[];
  dataSources: DataSourceConfig[];
  channels: LinkingChannel[];
  mapPanelOptions: MapPanelOption[];
  updateTop: (updater: (p: GridPanel) => GridPanel) => void;
}

// `tab`/`stack` both hold a list of nested leaf panels (tabs[].panel / items), each editable
// inline via an accordion reusing the same LeafPanelFields form as a top-level panel.
function NestedPanelList({ pageId, panel, siblingPanels, dataSources, channels, mapPanelOptions, updateTop }: NestedPanelListProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const demoteFromContainer = useEditorStore((s) => s.demoteFromContainer);
  const movePanelIntoContainer = useEditorStore((s) => s.movePanelIntoContainer);
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

  // Swaps two adjacent entries - for a stack, a parallel `sizes[]` weight (keyed by index, not id)
  // must be swapped right along with `items` or a size would end up applying to the wrong item.
  const moveEntry = (key: string, direction: 'up' | 'down') => {
    const index = entries.findIndex((e) => e.key === key);
    const nextIndex = direction === 'up' ? index - 1 : index + 1;
    if (index < 0 || nextIndex < 0 || nextIndex >= entries.length) return;
    updateTop((p) => {
      if (isTab) {
        const tabs = [...(p as GridTabPanel).tabs];
        [tabs[index], tabs[nextIndex]] = [tabs[nextIndex], tabs[index]];
        return { ...(p as GridTabPanel), tabs };
      }
      const stackPanel = p as GridStackPanel;
      const items = [...stackPanel.items];
      [items[index], items[nextIndex]] = [items[nextIndex], items[index]];
      let sizes = stackPanel.sizes;
      if (sizes && sizes.length === stackPanel.items.length) {
        sizes = [...sizes];
        [sizes[index], sizes[nextIndex]] = [sizes[nextIndex], sizes[index]];
      }
      return { ...stackPanel, items, sizes };
    });
  };

  return (
    <Stack spacing={1}>
      <Typography variant="subtitle2">{isTab ? 'Tabs' : 'Items'}</Typography>
      {entries.map(({ key, label, leaf }, index) => (
        <Accordion key={key} disableGutters>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', pr: 1 }}>
              <Typography variant="body2">
                {label} ({PANEL_TYPE_LABELS[leaf.type]})
              </Typography>
              <Box>
                <IconButton
                  size="small"
                  title="Move earlier"
                  disabled={index === 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    moveEntry(key, 'up');
                  }}
                >
                  <ArrowUpwardIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  title="Move later"
                  disabled={index === entries.length - 1}
                  onClick={(e) => {
                    e.stopPropagation();
                    moveEntry(key, 'down');
                  }}
                >
                  <ArrowDownwardIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  title="Extract to top-level grid"
                  onClick={(e) => {
                    e.stopPropagation();
                    demoteFromContainer(pageId, panel.id, key);
                  }}
                >
                  <OpenInFullIcon fontSize="small" />
                </IconButton>
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
      <Stack direction="row" spacing={1}>
        <Button size="small" onClick={() => setAddDialogOpen(true)}>
          {isTab ? 'Add tab' : 'Add item'}
        </Button>
        <Button size="small" disabled={siblingPanels.length === 0} onClick={() => setImportDialogOpen(true)}>
          Import existing panel
        </Button>
      </Stack>
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
      <ImportPanelDialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        panels={siblingPanels}
        onPick={(panelId) => movePanelIntoContainer(pageId, panel.id, panelId)}
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

interface ImportPanelDialogProps {
  open: boolean;
  onClose: () => void;
  panels: GridPanel[];
  onPick: (panelId: string) => void;
}

// Lists the page's other top-level leaf panels (tab/stack panels themselves are excluded - the
// schema doesn't support nesting a container inside another container) so an author can move an
// EXISTING panel into this tab/stack instead of re-creating the same panel from scratch inside it.
function ImportPanelDialog({ open, onClose, panels, onPick }: ImportPanelDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Import existing panel</DialogTitle>
      <List sx={{ pt: 0 }}>
        {panels.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ px: 2, pb: 2 }}>
            No other eligible panels on this page.
          </Typography>
        )}
        {panels.map((p) => (
          <ListItemButton
            key={p.id}
            onClick={() => {
              onPick(p.id);
              onClose();
            }}
          >
            <ListItemText primary={p.title || p.id} secondary={PANEL_TYPE_LABELS[p.type]} />
          </ListItemButton>
        ))}
      </List>
    </Dialog>
  );
}

