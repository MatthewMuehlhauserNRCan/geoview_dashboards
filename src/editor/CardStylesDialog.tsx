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
import type { CardStyleConfig } from '../config/types';

interface StyleEntry {
  title: string;
  icon: string;
  color: string;
}

interface CardStylesDialogProps {
  open: boolean;
  onClose: () => void;
  cardStyles: Record<string, CardStyleConfig>;
  onChange: (next: Record<string, CardStyleConfig>) => void;
}

// Per-card icon/color overrides, keyed by the card's own Title field value (e.g. "Canada Border
// Services Agency") - edited as a local draft list, not directly against the record, so renaming
// a title mid-typing doesn't reorder/jump the row (same reasoning as ChartColorsDialog). The
// caller remounts this component (via a `key` that changes) each time it opens.
export function CardStylesDialog({ open, onClose, cardStyles, onChange }: CardStylesDialogProps) {
  const [draft, setDraft] = useState<StyleEntry[]>(() =>
    Object.entries(cardStyles).map(([title, style]) => ({ title, icon: style.icon ?? '', color: style.color ?? '' })),
  );

  const commit = (next: StyleEntry[]) => {
    setDraft(next);
    onChange(
      Object.fromEntries(
        next
          .filter((e) => e.title)
          .map((e) => [e.title, { icon: e.icon || undefined, color: e.color || undefined }]),
      ),
    );
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Customize card header images/colors</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Overrides the header image/fallback band color for a specific card, matched by its Title
          field's exact value (e.g. "Canada Border Services Agency"). Only used when Icon field/
          Color field above are unset, or a row has no value for them. Any card not listed here
          falls back to Default icon/Default color.
        </Typography>
        <List dense disablePadding>
          {draft.map((entry, index) => (
            <ListItem key={index} disableGutters sx={{ gap: 1 }}>
              <TextField
                label="Title value"
                size="small"
                sx={{ flex: '0 0 35%' }}
                value={entry.title}
                onChange={(e) => commit(draft.map((d, i) => (i === index ? { ...d, title: e.target.value } : d)))}
              />
              <TextField
                label="Icon URL"
                size="small"
                fullWidth
                helperText="Full header image for the front of this card"
                value={entry.icon}
                onChange={(e) => commit(draft.map((d, i) => (i === index ? { ...d, icon: e.target.value } : d)))}
              />
              <TextField
                label="Color"
                size="small"
                sx={{ flex: '0 0 25%' }}
                placeholder="e.g. #9c1f28"
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
          <Button size="small" onClick={() => commit([...draft, { title: '', icon: '', color: '' }])}>
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
