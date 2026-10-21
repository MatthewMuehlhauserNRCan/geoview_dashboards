import { Dialog, DialogActions, DialogContent, DialogTitle, Button, List, ListItem, ListItemText, TextField, Typography } from '@mui/material';
import type { ChartPanelConfig } from '../config/types';

type ChartSource = NonNullable<ChartPanelConfig['sources']>[number];

interface ChartSourcesDialogProps {
  open: boolean;
  onClose: () => void;
  sources: ChartSource[];
  onChange: (next: ChartSource[]) => void;
}

// Which data sources are included is managed by the unified "Data source(s)" picker in the main
// inspector (select 1 = single chart, several = one value per source) - this dialog only lets an
// author override each already-selected source's display label/color (label defaults to its map
// layer name; color defaults to an auto-assigned palette color).
export function ChartSourcesDialog({ open, onClose, sources, onChange }: ChartSourcesDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Customize data sources</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Overrides the bar/slice label and/or color shown for each data source (label defaults to
          its map layer name, or its id otherwise; color defaults to an auto-assigned one). To
          add/remove data sources, use the picker above instead.
        </Typography>
        <List dense disablePadding>
          {sources.map((source, index) => (
            <ListItem key={source.dataSourceId} disableGutters sx={{ gap: 1 }}>
              <ListItemText primary={source.dataSourceId} sx={{ flex: '0 0 25%' }} />
              <TextField
                label="Label (optional)"
                size="small"
                fullWidth
                value={source.label ?? ''}
                onChange={(e) =>
                  onChange(sources.map((s, i) => (i === index ? { ...s, label: e.target.value || undefined } : s)))
                }
              />
              <TextField
                label="Color (optional)"
                size="small"
                placeholder="e.g. #4caf50"
                sx={{ width: '35%' }}
                value={source.color ?? ''}
                onChange={(e) =>
                  onChange(sources.map((s, i) => (i === index ? { ...s, color: e.target.value || undefined } : s)))
                }
              />
            </ListItem>
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Done</Button>
      </DialogActions>
    </Dialog>
  );
}
