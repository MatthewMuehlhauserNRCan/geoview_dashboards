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
  // true to center the content both ways (e.g. a single stat value) - centering via the flex
  // container itself (rather than a child sized to a percentage of it) avoids sub-pixel
  // rounding between nested percentage heights, which can otherwise trigger a permanent,
  // unnecessary scrollbar even when the content clearly fits.
  centerContent?: boolean;
}

export function PanelContainer({
  title,
  children,
  expandable = true,
  bodyOverflow = 'auto',
  disablePadding = false,
  centerContent = false,
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
        {title || expandable ? (
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
        ) : undefined}
        <CardContent
          sx={{
            flex: 1,
            overflow: bodyOverflow,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            // MUI's CardContent gives its own last child (itself, here) extra bottom padding by
            // default - overridden back to match the top/sides so centered content isn't skewed.
            '&:last-child': { pb: 2 },
            ...(centerContent && { alignItems: 'center', justifyContent: 'center' }),
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
          <CardContent
            sx={{
              flex: 1,
              overflow: 'auto',
              display: 'flex',
              flexDirection: 'column',
              '&:last-child': { pb: 2 },
              ...(centerContent && { alignItems: 'center', justifyContent: 'center' }),
            }}
          >
            {children}
          </CardContent>
        </Dialog>
      )}
    </>
  );
}
