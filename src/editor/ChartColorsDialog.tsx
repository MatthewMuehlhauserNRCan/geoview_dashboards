import { useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  TextField,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';

interface ColorEntry {
  category: string;
  color: string;
}

interface ChartColorsDialogProps {
  open: boolean;
  onClose: () => void;
  colors: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}

// Overrides the auto-assigned per-category color for specific values of the chart's `field`
// (e.g. always render "Natural" green regardless of its position in the data). Edited as a local
// draft list (not directly against the `colors` record) so renaming a category's text mid-typing
// doesn't reorder/jump the row (an object's key order shifts when a key is deleted+reinserted).
// The caller remounts this component (via a `key` that changes) each time it opens, so this local
// draft always starts fresh from the current `colors` without needing an effect to resync it.
export function ChartColorsDialog({ open, onClose, colors, onChange }: ChartColorsDialogProps) {
  const [draft, setDraft] = useState<ColorEntry[]>(() => Object.entries(colors).map(([category, color]) => ({ category, color })));

  const commit = (next: ColorEntry[]) => {
    setDraft(next);
    onChange(Object.fromEntries(next.filter((e) => e.category).map((e) => [e.category, e.color])));
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Customize category colors</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Overrides the auto-assigned color for specific values of the Field above (matched by the
          exact raw value, e.g. "Natural"). Any category not listed here still gets its own
          auto-assigned color.
        </Typography>
        <List dense disablePadding>
          {draft.map((entry, index) => (
            <ListItem key={index} disableGutters sx={{ gap: 1 }}>
              <TextField
                label="Category value"
                size="small"
                sx={{ flex: '0 0 45%' }}
                value={entry.category}
                onChange={(e) => commit(draft.map((d, i) => (i === index ? { ...d, category: e.target.value } : d)))}
              />
              <TextField
                label="Color"
                size="small"
                fullWidth
                placeholder="e.g. #4caf50"
                value={entry.color}
                onChange={(e) => commit(draft.map((d, i) => (i === index ? { ...d, color: e.target.value } : d)))}
              />
              <IconButton size="small" onClick={() => commit(draft.filter((_, i) => i !== index))}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </ListItem>
          ))}
        </List>
        {draft.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            No overrides yet.
          </Typography>
        )}
        <Box>
          <Button size="small" onClick={() => commit([...draft, { category: '', color: '' }])}>
            + Add override
          </Button>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Done</Button>
      </DialogActions>
    </Dialog>
  );
}
