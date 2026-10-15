import { Dialog, DialogTitle, List, ListItemButton, ListItemText } from '@mui/material';
import type { PanelConfig } from '../config/types';
import { GRID_PANEL_TYPES, PANEL_TYPE_LABELS } from './panelDefaults';

interface AddPanelDialogProps {
  open: boolean;
  onClose: () => void;
  onPick: (type: PanelConfig['type']) => void;
  // defaults to every panel type; pass a narrower list to e.g. exclude tab/stack when adding a
  // panel nested inside a tab/stack (nesting tabs/stacks inside each other isn't supported)
  types?: PanelConfig['type'][];
}

export function AddPanelDialog({ open, onClose, onPick, types = GRID_PANEL_TYPES }: AddPanelDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Add panel</DialogTitle>
      <List sx={{ pt: 0 }}>
        {types.map((type) => (
          <ListItemButton
            key={type}
            onClick={() => {
              onPick(type);
              onClose();
            }}
          >
            <ListItemText primary={PANEL_TYPE_LABELS[type]} />
          </ListItemButton>
        ))}
      </List>
    </Dialog>
  );
}
