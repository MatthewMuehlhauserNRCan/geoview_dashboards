import { Box, Dialog, IconButton, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import type { DashboardConfig } from '../config/types';
import { DashboardApp } from '../app/DashboardApp';

interface PreviewDialogProps {
  open: boolean;
  config: DashboardConfig;
  onClose: () => void;
}

// Full-screen, closable live render of the draft config, reusing the exact same DashboardApp the
// viewer/embed bundle renders - updates live since `config` is the editor's own reactive Zustand
// state. MUI unmounts Dialog children while closed, so this never competes with the sidebar
// "Map preview" (MapPreview.tsx) for the same GeoView map div id - EditorApp pauses that one
// while this is open, so the two are never both live at once.
export function PreviewDialog({ open, config, onClose }: PreviewDialogProps) {
  return (
    <Dialog fullScreen open={open} onClose={onClose}>
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Box
          sx={{
            flex: '0 0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2,
            py: 0.5,
            bgcolor: 'grey.900',
          }}
        >
          <Typography variant="body2" sx={{ color: 'common.white' }}>
            Dashboard preview
          </Typography>
          <IconButton size="small" onClick={onClose} aria-label="Close preview" sx={{ color: 'common.white' }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
        <Box sx={{ flex: 1, minHeight: 0 }}>
          <DashboardApp config={config} />
        </Box>
      </Box>
    </Dialog>
  );
}
