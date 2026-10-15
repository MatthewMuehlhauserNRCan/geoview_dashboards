import { Box } from '@mui/material';
import type { TitlePanelConfig } from '../config/types';
import { useResizableHeight } from './useResizableHeight';

interface TitlePanelProps {
  config: TitlePanelConfig;
}

// A thin, full-width strip below the title element: three boxes side by side (left text,
// centered image, right text). Starts sized to its content; dragging the handle below it
// resizes it like any other divider on the page, taking space from the grid underneath.
export function TitlePanel({ config }: TitlePanelProps) {
  const { height, containerRef, onHandlePointerDown, onHandlePointerMove, onHandlePointerUp } = useResizableHeight(32);
  const background = config.backgroundColor ?? 'primary.main';

  return (
    <Box ref={containerRef} sx={{ flex: '0 0 auto', width: '100%', display: 'flex', flexDirection: 'column' }} style={{ height }}>
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', width: '100%', bgcolor: background, color: '#fff' }}>
        <Box sx={{ flex: 1, minWidth: 0, px: 2 }}>{config.left}</Box>
        {config.image && (
          <Box sx={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', px: 2 }}>
            <img src={config.image.src} alt={config.image.alt ?? ''} style={{ height: '100%', maxHeight: 48, display: 'block' }} />
          </Box>
        )}
        <Box sx={{ flex: 1, minWidth: 0, px: 2, textAlign: 'right' }}>{config.right}</Box>
      </Box>
      <Box
        role="separator"
        aria-orientation="horizontal"
        className="grid-divider"
        sx={{ flex: '0 0 auto', height: 4, cursor: 'row-resize' }}
        onPointerDown={onHandlePointerDown}
        onPointerMove={onHandlePointerMove}
        onPointerUp={onHandlePointerUp}
      />
    </Box>
  );
}
