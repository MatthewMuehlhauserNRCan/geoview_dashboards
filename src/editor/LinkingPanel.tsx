import { useState } from 'react';
import { Box, Button, IconButton, List, ListItem, ListItemText, Stack, TextField, Typography } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { useEditorStore } from './store';
import { generateId } from './idUtils';

// Named pub/sub channels panels can emit/listen to for cross-panel filtering (see
// docs/ARCHITECTURE.md section 6) - `type` is always 'filter' for now, only `field` varies.
export function LinkingPanel() {
  const channels = useEditorStore((s) => s.config.linking?.channels ?? []);
  const addChannel = useEditorStore((s) => s.addChannel);
  const updateChannel = useEditorStore((s) => s.updateChannel);
  const removeChannel = useEditorStore((s) => s.removeChannel);
  const [newField, setNewField] = useState('');

  const add = () => {
    addChannel({ id: generateId('channel'), type: 'filter', field: newField || 'field' });
    setNewField('');
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
                  value={c.field}
                  onChange={(e) => updateChannel(c.id, (ch) => ({ ...ch, field: e.target.value }))}
                  placeholder="field name"
                />
              }
            />
          </ListItem>
        ))}
      </List>
      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
        <TextField size="small" label="New channel field" value={newField} onChange={(e) => setNewField(e.target.value)} />
        <Button size="small" variant="outlined" onClick={add}>
          Add
        </Button>
      </Stack>
    </Box>
  );
}
