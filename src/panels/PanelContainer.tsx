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
  // 'hidden' when the content manages its own internal scrolling (e.g. MaterialReactTable)
  bodyOverflow?: 'auto' | 'hidden';
  // true for content that should fill the panel edge-to-edge (e.g. a map or table) instead of
  // sitting inside CardContent's default padding
  disablePadding?: boolean;
}

export function PanelContainer({
  title,
  children,
  expandable = true,
  bodyOverflow = 'auto',
  disablePadding = false,
}: PanelContainerProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <Card
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          '&:hover .panel-expand-button': { opacity: 1 },
        }}
      >
        <CardHeader
          title={title}
          action={
            expandable && (
              <IconButton
                className="panel-expand-button"
                size="small"
                aria-label="Expand panel"
                onClick={() => setExpanded(true)}
                sx={{ opacity: 0, transition: 'opacity 0.15s ease', '&:focus-visible': { opacity: 1 } }}
              >
                <FullscreenIcon fontSize="small" />
              </IconButton>
            )
          }
          sx={{ pb: 0 }}
        />
        <CardContent
          sx={{
            flex: 1,
            overflow: bodyOverflow,
            minHeight: 0,
            ...(disablePadding && { p: 0, '&:last-child': { pb: 0 } }),
          }}
        >
          {children}
        </CardContent>
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
