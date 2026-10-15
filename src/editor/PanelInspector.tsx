import { useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  FormControl,
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
import type { DataSourceConfig, GridPanel, LeafPanelConfig, LinkingChannel } from '../config/types';
import { LEAF_PANEL_TYPES, PANEL_TYPE_LABELS, createDefaultLeafPanel } from './panelDefaults';
import { useEditorStore } from './store';
import { AddPanelDialog } from './AddPanelDialog';

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
  const [configText, setConfigText] = useState(() => (leafPanel.type === 'map' ? JSON.stringify(leafPanel.config, null, 2) : ''));
  const [configError, setConfigError] = useState<string | undefined>();

  const commitConfigText = () => {
    try {
      const parsed = JSON.parse(configText || '{}');
      setConfigError(undefined);
      onChange((p) => (p.type === 'map' ? { ...p, config: parsed } : p));
    } catch {
      setConfigError('Invalid JSON - changes not saved until this is fixed.');
    }
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
      <FormControl size="small" fullWidth>
        <InputLabel>Data source</InputLabel>
        <Select
          label="Data source"
          value={leafPanel.dataSource ?? ''}
          onChange={(e) => onChange((p) => ({ ...p, dataSource: e.target.value || undefined }))}
        >
          <MenuItem value="">None</MenuItem>
          {dataSources.map((ds) => (
            <MenuItem key={ds.id} value={ds.id}>
              {ds.id} ({ds.type})
            </MenuItem>
          ))}
        </Select>
      </FormControl>

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
            <MenuItem key={c.id} value={c.id}>
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
            <MenuItem key={c.id} value={c.id}>
              {c.id}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      {channels.length === 0 && (
        <Typography variant="caption" color="text.secondary">
          No linking channels defined yet - add one in the Linking section to cross-filter panels.
        </Typography>
      )}

      <Divider />

      {leafPanel.type === 'map' && (
        <Stack spacing={1}>
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
            placeholder='{ "map": { ... } }'
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
          <TextField
            label="Field (categorical field to aggregate by)"
            value={leafPanel.field ?? ''}
            size="small"
            fullWidth
            onChange={(e) => onChange((p) => (p.type === 'chart' ? { ...p, field: e.target.value || undefined } : p))}
          />
        </Stack>
      )}

      {leafPanel.type === 'legend' && (
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
        <TextField
          label="Content"
          value={leafPanel.content}
          multiline
          minRows={4}
          fullWidth
          size="small"
          onChange={(e) => onChange((p) => (p.type === 'text' ? { ...p, content: e.target.value } : p))}
        />
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

