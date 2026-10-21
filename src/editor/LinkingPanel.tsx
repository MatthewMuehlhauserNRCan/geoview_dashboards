import { useState } from 'react';
import { Box, Button, IconButton, List, ListItem, ListItemText, Stack, TextField, Typography } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { useEditorStore } from './store';
import { generateId } from './idUtils';

// Named pub/sub channels panels can emit/listen to for cross-panel filtering (see
// docs/ARCHITECTURE.md section 6) - `type` is always 'filter' for now. A channel isn't bound to
// a single field - it can carry many different fields at once, each contributed by a different
// panel - so `description` is just an optional freeform note, not a field binding.
export function LinkingPanel() {
  const channels = useEditorStore((s) => s.config.linking?.channels ?? []);
  const addChannel = useEditorStore((s) => s.addChannel);
  const updateChannel = useEditorStore((s) => s.updateChannel);
  const removeChannel = useEditorStore((s) => s.removeChannel);
  const [newDescription, setNewDescription] = useState('');

  const add = () => {
    addChannel({ id: generateId('channel'), type: 'filter', description: newDescription || undefined });
    setNewDescription('');
  };

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Linking channels
      </Typography>
      <List dense disablePadding>
        {channels.map((c) => (
          <ListItem
            key={c.id}
            disableGutters
            secondaryAction={
              <IconButton size="small" onClick={() => removeChannel(c.id)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            }
          >
            <ListItemText
              primary={c.id}
              slotProps={{ secondary: { component: 'div' } }}
              secondary={
                <TextField
                  variant="standard"
                  size="small"
                  value={c.description ?? ''}
                  onChange={(e) => updateChannel(c.id, (ch) => ({ ...ch, description: e.target.value || undefined }))}
                  placeholder="Note: what this channel is for (optional)"
                />
              }
            />
          </ListItem>
        ))}
      </List>
      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
        <TextField size="small" label="New channel note (optional)" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} />
        <Button size="small" variant="outlined" onClick={add}>
          Add
        </Button>
      </Stack>
    </Box>
  );

}
