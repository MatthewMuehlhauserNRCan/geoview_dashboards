import { Dialog, DialogActions, DialogContent, DialogTitle, Button, List, ListItem, ListItemText, TextField, Typography } from '@mui/material';
import type { TablePanelConfig } from '../config/types';

type TableSource = NonNullable<TablePanelConfig['sources']>[number];

interface TableSourcesDialogProps {
  open: boolean;
  onClose: () => void;
  sources: TableSource[];
  onChange: (next: TableSource[]) => void;
}

// Which data sources are included is managed by the unified "Data source(s)" picker in the main
// inspector (select 1 = single table, several = merged rows from each) - this dialog only lets an
// author override each already-selected source's "Source" column label (defaults to its map layer
// name, or its id otherwise).
export function TableSourcesDialog({ open, onClose, sources, onChange }: TableSourcesDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Customize data source labels</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Overrides the "Source" column label shown for each data source's rows (defaults to its
          map layer name, or its id otherwise). To add/remove data sources, use the picker above
          instead.
        </Typography>
        <List dense disablePadding>
          {sources.map((source, index) => (
            <ListItem key={source.dataSourceId} disableGutters sx={{ gap: 1 }}>
              <ListItemText primary={source.dataSourceId} sx={{ flex: '0 0 35%' }} />
              <TextField
                label="Label (optional)"
                size="small"
                fullWidth
                value={source.label ?? ''}
                onChange={(e) => onChange(sources.map((s, i) => (i === index ? { ...s, label: e.target.value || undefined } : s)))}
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
