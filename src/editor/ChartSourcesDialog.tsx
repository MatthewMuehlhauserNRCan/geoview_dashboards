import { useState } from 'react';
import {
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
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import type { ChartPanelConfig, DataSourceConfig } from '../config/types';

type ChartSource = NonNullable<ChartPanelConfig['sources']>[number];

interface ChartSourcesDialogProps {
  open: boolean;
  onClose: () => void;
  dataSources: DataSourceConfig[];
  sources: ChartSource[];
  onChange: (next: ChartSource[]) => void;
}

function dataSourceLabel(ds: DataSourceConfig): string {
  return `${ds.id} (${ds.type})`;
}

// Lets an author manage a chart's multi-source list (one value per data source, e.g. one per
// sublayer of a group layer) in its own window, instead of an inline list cluttering the main
// inspector - same "its own window" pattern as the dashboard-wide Data sources dialog.
export function ChartSourcesDialog({ open, onClose, dataSources, sources, onChange }: ChartSourcesDialogProps) {
  const [newSourceId, setNewSourceId] = useState('');
  const newSourceLabel = dataSources.find((d) => d.id === newSourceId);

  const addSource = () => {
    if (!newSourceId) return;
    onChange([...sources, { dataSourceId: newSourceId }]);
    setNewSourceId('');
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Chart data sources</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          One value (bar/slice/point) per data source below, counting its rows.
        </Typography>
        <List dense disablePadding>
          {sources.map((source, index) => {
            const matched = dataSources.find((d) => d.id === source.dataSourceId);
            const selectedLabel = matched ? dataSourceLabel(matched) : 'Select a data source';
            return (
              <ListItem key={index} disableGutters sx={{ gap: 1, alignItems: 'center' }}>
                <FormControl size="small" sx={{ width: '45%' }}>
                  <InputLabel>Data source</InputLabel>
                  <Select
                    label="Data source"
                    value={source.dataSourceId}
                    SelectDisplayProps={{ title: selectedLabel }}
                    onChange={(e) => onChange(sources.map((s, i) => (i === index ? { ...s, dataSourceId: e.target.value } : s)))}
                  >
                    {dataSources.map((ds) => (
                      <MenuItem key={ds.id} value={ds.id} title={dataSourceLabel(ds)}>
                        {dataSourceLabel(ds)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  label="Label (optional)"
                  size="small"
                  sx={{ flex: 1 }}
                  value={source.label ?? ''}
                  onChange={(e) =>
                    onChange(sources.map((s, i) => (i === index ? { ...s, label: e.target.value || undefined } : s)))
                  }
                />
                <IconButton size="small" onClick={() => onChange(sources.filter((_, i) => i !== index))}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </ListItem>
            );
          })}
        </List>
        {sources.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            No data sources added yet.
          </Typography>
        )}
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end', mt: 1 }}>
          <FormControl size="small" sx={{ flex: 1 }}>
            <InputLabel>Add data source</InputLabel>
            <Select
              label="Add data source"
              value={newSourceId}
              SelectDisplayProps={{ title: newSourceLabel ? dataSourceLabel(newSourceLabel) : '' }}
              onChange={(e) => setNewSourceId(e.target.value)}
            >
              {dataSources.map((ds) => (
                <MenuItem key={ds.id} value={ds.id} title={dataSourceLabel(ds)}>
                  {dataSourceLabel(ds)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button size="small" variant="outlined" onClick={addSource} disabled={!newSourceId}>
            + Add
          </Button>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Done</Button>
      </DialogActions>
    </Dialog>
  );
}
