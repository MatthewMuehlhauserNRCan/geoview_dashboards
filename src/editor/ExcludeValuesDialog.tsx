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

interface ExcludeEntry {
  field: string;
  values: string;
}

interface ExcludeValuesDialogProps {
  open: boolean;
  onClose: () => void;
  excludeValues: Record<string, (string | number)[]>;
  onChange: (next: Record<string, (string | number)[]>) => void;
}

// Rows whose field exactly matches one of a known list of values are hidden entirely - edited as
// a local draft list (not directly against the record), same reasoning as CardStylesDialog
// (renaming a field name mid-typing shouldn't reorder/jump the row). The caller remounts this
// component (via a `key` that changes) each time it opens.
export function ExcludeValuesDialog({ open, onClose, excludeValues, onChange }: ExcludeValuesDialogProps) {
  const [draft, setDraft] = useState<ExcludeEntry[]>(() =>
    Object.entries(excludeValues).map(([field, values]) => ({ field, values: values.join(', ') })),
  );

  const commit = (next: ExcludeEntry[]) => {
    setDraft(next);
    onChange(
      Object.fromEntries(
        next
          .filter((e) => e.field)
          .map((e) => [
            e.field,
            e.values
              .split(',')
              .map((v) => v.trim())
              .filter(Boolean),
          ]),
      ),
    );
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Exclude specific row values</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          A row whose Field's value matches one of these Values (comma-separated) exactly is
          hidden entirely, before any other filtering - e.g. hide one specific known
          mostly-blank row by its exact title.
        </Typography>
        <List dense disablePadding>
          {draft.map((entry, index) => (
            <ListItem key={index} disableGutters sx={{ gap: 1 }}>
              <TextField
                label="Field"
                size="small"
                sx={{ flex: '0 0 35%' }}
                value={entry.field}
                onChange={(e) => commit(draft.map((d, i) => (i === index ? { ...d, field: e.target.value } : d)))}
              />
              <TextField
                label="Values (comma-separated)"
                size="small"
                fullWidth
                value={entry.values}
                onChange={(e) => commit(draft.map((d, i) => (i === index ? { ...d, values: e.target.value } : d)))}
              />
              <IconButton size="small" onClick={() => commit(draft.filter((_, i) => i !== index))}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </ListItem>
          ))}
        </List>
        {draft.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            No exclusions yet.
          </Typography>
        )}
        <Box>
          <Button size="small" onClick={() => commit([...draft, { field: '', values: '' }])}>
            + Add exclusion
          </Button>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Done</Button>
      </DialogActions>
    </Dialog>
  );
}
