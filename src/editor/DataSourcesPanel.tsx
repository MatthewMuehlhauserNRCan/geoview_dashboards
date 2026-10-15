import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import type { DataSourceConfig } from '../config/types';
import { useMapHandle } from '../map/registry';
import { generateId } from './idUtils';
import { useMapPanels } from './MapPreview';
import { useEditorStore } from './store';

type DataSourceType = DataSourceConfig['type'];

function createDefaultDataSource(type: DataSourceType): DataSourceConfig {
  if (type === 'rest-json') return { id: generateId('source'), type, url: '', refresh: { mode: 'static' } };
  if (type === 'static-file') return { id: generateId('source'), type, format: 'json', url: '' };
  return { id: generateId('source'), type, mapPanelId: '', layerId: '' };
}

interface DataSourceFormProps {
  value: DataSourceConfig;
  onChange: (next: DataSourceConfig) => void;
}

function DataSourceForm({ value, onChange }: DataSourceFormProps) {
  const config = useEditorStore((s) => s.config);
  const mapPanels = useMapPanels(config);
  const mapHandle = useMapHandle(value.type === 'map-layer' ? value.mapPanelId : '');

  return (
    <Stack spacing={2} sx={{ mt: 1 }}>
      <TextField label="Id" value={value.id} size="small" fullWidth onChange={(e) => onChange({ ...value, id: e.target.value })} />

      {value.type === 'rest-json' && (
        <>
          <TextField label="URL" value={value.url} size="small" fullWidth onChange={(e) => onChange({ ...value, url: e.target.value })} />
          <FormControl size="small" fullWidth>
            <InputLabel>Refresh</InputLabel>
            <Select
              label="Refresh"
              value={value.refresh?.mode ?? 'static'}
              onChange={(e) => onChange({ ...value, refresh: { mode: e.target.value as 'static' | 'interval' } })}
            >
              <MenuItem value="static">Load once</MenuItem>
              <MenuItem value="interval">Poll on an interval</MenuItem>
            </Select>
          </FormControl>
          {value.refresh?.mode === 'interval' && (
            <TextField
              label="Seconds"
              type="number"
              value={value.refresh.seconds ?? 60}
              size="small"
              onChange={(e) => onChange({ ...value, refresh: { mode: 'interval', seconds: Number(e.target.value) } })}
            />
          )}
        </>
      )}

      {value.type === 'static-file' && (
        <>
          <FormControl size="small" fullWidth>
            <InputLabel>Format</InputLabel>
            <Select label="Format" value={value.format} onChange={(e) => onChange({ ...value, format: e.target.value as typeof value.format })}>
              <MenuItem value="csv">CSV</MenuItem>
              <MenuItem value="json">JSON</MenuItem>
              <MenuItem value="excel">Excel</MenuItem>
            </Select>
          </FormControl>
          <TextField label="URL" value={value.url} size="small" fullWidth onChange={(e) => onChange({ ...value, url: e.target.value })} />
        </>
      )}

      {value.type === 'map-layer' && (
        <>
          <FormControl size="small" fullWidth>
            <InputLabel>Map panel</InputLabel>
            <Select label="Map panel" value={value.mapPanelId} onChange={(e) => onChange({ ...value, mapPanelId: e.target.value, layerId: '' })}>
              {mapPanels.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.title || p.id}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {!mapHandle && value.mapPanelId && (
            <Alert severity="info">
              This map isn't loaded yet - open it in the "Map preview" section (left) so its real layers can be listed here.
            </Alert>
          )}
          {mapHandle && (
            <FormControl size="small" fullWidth>
              <InputLabel>Layer</InputLabel>
              <Select label="Layer" value={value.layerId} onChange={(e) => onChange({ ...value, layerId: e.target.value })}>
                {mapHandle
                  .listLayers()
                  .filter((l) => l.queryable)
                  .map((l) => (
                    <MenuItem key={l.id} value={l.id}>
                      {l.name}
                    </MenuItem>
                  ))}
              </Select>
              {mapHandle.listLayers().filter((l) => l.queryable).length === 0 && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                  No queryable vector layers found on this map.
                </Typography>
              )}
            </FormControl>
          )}
        </>
      )}
    </Stack>
  );
}

export function DataSourcesPanel() {
  const dataSources = useEditorStore((s) => s.config.dataSources);
  const addDataSource = useEditorStore((s) => s.addDataSource);
  const updateDataSource = useEditorStore((s) => s.updateDataSource);
  const removeDataSource = useEditorStore((s) => s.removeDataSource);

  const [dialogSource, setDialogSource] = useState<DataSourceConfig | undefined>();
  const [isNew, setIsNew] = useState(false);

  const openNew = (type: DataSourceType) => {
    setDialogSource(createDefaultDataSource(type));
    setIsNew(true);
  };
  const openEdit = (source: DataSourceConfig) => {
    setDialogSource(source);
    setIsNew(false);
  };

  const save = () => {
    if (!dialogSource) return;
    if (isNew) addDataSource(dialogSource);
    else updateDataSource(dialogSource.id, () => dialogSource);
    setDialogSource(undefined);
  };

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Data sources
      </Typography>
      <List dense disablePadding>
        {dataSources.map((ds) => (
          <ListItem
            key={ds.id}
            disableGutters
            secondaryAction={
              <>
                <IconButton size="small" onClick={() => openEdit(ds)}>
                  <EditIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" onClick={() => removeDataSource(ds.id)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </>
            }
          >
            <ListItemText primary={ds.id} secondary={ds.type} />
          </ListItem>
        ))}
      </List>
      <Stack direction="row" spacing={1} useFlexGap sx={{ mt: 1, flexWrap: 'wrap' }}>
        <Button size="small" variant="outlined" onClick={() => openNew('rest-json')}>
          + REST/JSON
        </Button>
        <Button size="small" variant="outlined" onClick={() => openNew('static-file')}>
          + File
        </Button>
        <Button size="small" variant="outlined" onClick={() => openNew('map-layer')}>
          + Map layer
        </Button>
      </Stack>

      <Dialog open={!!dialogSource} onClose={() => setDialogSource(undefined)} fullWidth maxWidth="xs">
        <DialogTitle>{isNew ? 'Add' : 'Edit'} data source</DialogTitle>
        <DialogContent>
          {dialogSource && <DataSourceForm value={dialogSource} onChange={setDialogSource} />}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogSource(undefined)}>Cancel</Button>
          <Button variant="contained" onClick={save} disabled={!dialogSource?.id}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
