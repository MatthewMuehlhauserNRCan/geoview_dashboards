import type { ReactNode } from 'react';
import { Box, IconButton, Paper, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import AddBoxIcon from '@mui/icons-material/AddBox';
import RemoveIcon from '@mui/icons-material/Remove';
import type { DashboardPageConfig, GridPanel } from '../config/types';
import { PANEL_TYPE_LABELS } from './panelDefaults';
import { useEditorStore } from './store';

interface GridEditorProps {
  page: DashboardPageConfig;
  selectedPanelId: string | undefined;
  onAddAt: (col: number, row: number) => void;
}

// Which (row,col) cells are covered by some panel's span - so cells that are part of a span
// (but aren't that panel's own top-left anchor) render nothing, avoiding overlapping elements.
function buildOccupancy(panels: GridPanel[]) {
  const covered = new Map<string, string>();
  for (const panel of panels) {
    const { col, row, colSpan = 1, rowSpan = 1 } = panel.layout;
    for (let r = row; r < row + rowSpan; r += 1) {
      for (let c = col; c < col + colSpan; c += 1) {
        covered.set(`${r}-${c}`, panel.id);
      }
    }
  }
  return covered;
}

export function GridEditor({ page, selectedPanelId, onAddAt }: GridEditorProps) {
  const selectPanel = useEditorStore((s) => s.selectPanel);
  const removePanel = useEditorStore((s) => s.removePanel);
  const updateLayout = useEditorStore((s) => s.updateLayout);
  const { columns, rows } = page.grid;
  const occupancy = buildOccupancy(page.panels);

  const cells: ReactNode[] = [];
  for (let row = 1; row <= rows; row += 1) {
    for (let col = 1; col <= columns; col += 1) {
      const panel = page.panels.find((p) => p.layout.col === col && p.layout.row === row);
      if (panel) {
        const { colSpan = 1, rowSpan = 1 } = panel.layout;
        const selected = panel.id === selectedPanelId;
        cells.push(
          <Paper
            key={panel.id}
            variant="outlined"
            onClick={() => selectPanel(panel.id)}
            sx={{
              gridColumn: `${col} / span ${colSpan}`,
              gridRow: `${row} / span ${rowSpan}`,
              p: 1,
              display: 'flex',
              flexDirection: 'column',
              cursor: 'pointer',
              borderColor: selected ? 'primary.main' : undefined,
              borderWidth: selected ? 2 : 1,
              bgcolor: selected ? 'action.selected' : 'background.paper',
              overflow: 'hidden',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <Box sx={{ overflow: 'hidden' }}>
                <Typography variant="caption" color="text.secondary">
                  {PANEL_TYPE_LABELS[panel.type]}
                </Typography>
                <Typography variant="body2" noWrap title={panel.title ?? panel.id}>
                  {panel.title || panel.id}
                </Typography>
              </Box>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  removePanel(page.id, panel.id);
                }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
            {selected && (
              <Box sx={{ mt: 'auto', display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                <IconButton size="small" disabled={row <= 1} onClick={() => updateLayout(page.id, panel.id, { row: row - 1 })}>
                  <ArrowUpwardIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  disabled={row + rowSpan - 1 >= rows}
                  onClick={() => updateLayout(page.id, panel.id, { row: row + 1 })}
                >
                  <ArrowDownwardIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" disabled={col <= 1} onClick={() => updateLayout(page.id, panel.id, { col: col - 1 })}>
                  <ArrowBackIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  disabled={col + colSpan - 1 >= columns}
                  onClick={() => updateLayout(page.id, panel.id, { col: col + 1 })}
                >
                  <ArrowForwardIcon fontSize="small" />
                </IconButton>
                <Typography variant="caption" sx={{ ml: 1 }}>
                  cols
                </Typography>
                <IconButton size="small" disabled={colSpan <= 1} onClick={() => updateLayout(page.id, panel.id, { colSpan: colSpan - 1 })}>
                  <RemoveIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  disabled={col + colSpan > columns}
                  onClick={() => updateLayout(page.id, panel.id, { colSpan: colSpan + 1 })}
                >
                  <AddBoxIcon fontSize="small" />
                </IconButton>
                <Typography variant="caption" sx={{ ml: 1 }}>
                  rows
                </Typography>
                <IconButton size="small" disabled={rowSpan <= 1} onClick={() => updateLayout(page.id, panel.id, { rowSpan: rowSpan - 1 })}>
                  <RemoveIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  disabled={row + rowSpan > rows}
                  onClick={() => updateLayout(page.id, panel.id, { rowSpan: rowSpan + 1 })}
                >
                  <AddBoxIcon fontSize="small" />
                </IconButton>
              </Box>
            )}
          </Paper>,
        );
        continue;
      }
      if (occupancy.has(`${row}-${col}`)) continue;
      cells.push(
        <Paper
          key={`empty-${row}-${col}`}
          variant="outlined"
          onClick={() => onAddAt(col, row)}
          sx={{
            gridColumn: `${col} / span 1`,
            gridRow: `${row} / span 1`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            borderStyle: 'dashed',
            color: 'text.disabled',
            '&:hover': { color: 'primary.main', borderColor: 'primary.main' },
          }}
        >
          <AddIcon />
        </Paper>,
      );
    }
  }

  return (
    <Box
      sx={{
        height: '100%',
        width: '100%',
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        gap: 1,
      }}
    >
      {cells}
    </Box>
  );
}
