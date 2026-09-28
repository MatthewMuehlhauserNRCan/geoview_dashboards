import { useState } from 'react';
import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, Dialog, IconButton } from '@mui/material';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';

interface PanelContainerProps {
  title?: string;
  children: ReactNode;
  // lets users open a bigger view of the panel to explore data (e.g. a table); not for tabs, which already switch views
  expandable?: boolean;
}

export function PanelContainer({ title, children, expandable = true }: PanelContainerProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <CardHeader
          title={title}
          action={
            expandable && (
              <IconButton size="small" aria-label="Expand panel" onClick={() => setExpanded(true)}>
                <FullscreenIcon fontSize="small" />
              </IconButton>
            )
          }
          sx={{ pb: 0 }}
        />
        <CardContent sx={{ flex: 1, overflow: 'auto' }}>{children}</CardContent>
      </Card>
      {expandable && (
        <Dialog open={expanded} onClose={() => setExpanded(false)} fullScreen>
          <CardHeader
            title={title}
            action={
              <IconButton aria-label="Close" onClick={() => setExpanded(false)}>
                <FullscreenExitIcon />
              </IconButton>
            }
          />
          <CardContent sx={{ flex: 1, overflow: 'auto' }}>{children}</CardContent>
        </Dialog>
      )}
    </>
  );
}
