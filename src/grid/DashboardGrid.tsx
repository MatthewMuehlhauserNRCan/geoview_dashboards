import { Cell, Grid, Gridline } from 'react-resizable-panels';
import type { DashboardConfig, GridPanel } from '../config/types';
import { panelRegistry } from '../panels';

interface DashboardGridProps {
  config: DashboardConfig;
}

interface AxisRect {
  primaryStart: number;
  primarySpan: number;
  crossStart: number;
  crossSpan: number;
}

// For a given boundary along the "primary" axis (a column line, or a row line), finds the
// contiguous runs along the "cross" axis where no cell spans across that boundary - a
// Gridline can only be placed in those runs (react-resizable-panels errors otherwise).
function freeCrossSegments(rects: AxisRect[], boundary: number, crossCount: number): Array<[start: number, length: number]> {
  const blocked = new Set<number>();
  for (const rect of rects) {
    const end = rect.primaryStart + rect.primarySpan - 1;
    if (rect.primaryStart < boundary && boundary <= end) {
      for (let i = rect.crossStart; i < rect.crossStart + rect.crossSpan; i += 1) blocked.add(i);
    }
  }
  const segments: Array<[number, number]> = [];
  let segmentStart: number | null = null;
  for (let i = 0; i < crossCount; i += 1) {
    if (!blocked.has(i)) {
      segmentStart ??= i;
    } else if (segmentStart !== null) {
      segments.push([segmentStart, i - segmentStart]);
      segmentStart = null;
    }
  }
  if (segmentStart !== null) segments.push([segmentStart, crossCount - segmentStart]);
  return segments;
}

// Normalizes fr-like size weights (author-settable via GridConfig.columnSizes/rowSizes) into
// percentages keyed by track index, the shape react-resizable-panels' defaultLayout expects.
function toPercentLayout(sizes: number[] | undefined, count: number): Record<string, number> {
  const weights = sizes && sizes.length === count ? sizes : Array(count).fill(1);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  return Object.fromEntries(weights.map((weight, index) => [String(index), (weight / total) * 100]));
}

// A fixed NxM grid that always fills the viewport (like an ESRI Dashboard) - column/row
// track sizes are draggable, but only where a Gridline doesn't cross a panel that spans
// that boundary, so a panel's cell never gets a "phantom" divider running through it.
export function DashboardGrid({ config }: DashboardGridProps) {
  const { columns, rows } = config.grid;
  const panels = config.panels as GridPanel[];

  const columnRects: AxisRect[] = panels.map((panel) => ({
    primaryStart: panel.layout.col - 1,
    primarySpan: panel.layout.colSpan ?? 1,
    crossStart: panel.layout.row - 1,
    crossSpan: panel.layout.rowSpan ?? 1,
  }));
  const rowRects: AxisRect[] = panels.map((panel) => ({
    primaryStart: panel.layout.row - 1,
    primarySpan: panel.layout.rowSpan ?? 1,
    crossStart: panel.layout.col - 1,
    crossSpan: panel.layout.colSpan ?? 1,
  }));

  const columnGridlines = Array.from({ length: columns - 1 }, (_, i) => i + 1).flatMap((boundary) =>
    freeCrossSegments(columnRects, boundary, rows).map(([row, rowSpan]) => ({ column: boundary, row, rowSpan }))
  );
  const rowGridlines = Array.from({ length: rows - 1 }, (_, i) => i + 1).flatMap((boundary) =>
    freeCrossSegments(rowRects, boundary, columns).map(([column, columnSpan]) => ({ row: boundary, column, columnSpan }))
  );

  return (
    <Grid
      className="dashboard-grid"
      columns={columns}
      rows={rows}
      defaultLayout={{
        columns: toPercentLayout(config.grid.columnSizes, columns),
        rows: toPercentLayout(config.grid.rowSizes, rows),
      }}
    >
      {panels.map((panel) => {
        const PanelComponent = panelRegistry[panel.type];
        const { col, row, colSpan = 1, rowSpan = 1 } = panel.layout;
        return (
          <Cell key={panel.id} column={col - 1} row={row - 1} columnSpan={colSpan} rowSpan={rowSpan} style={{ minWidth: 0, minHeight: 0 }}>
            <PanelComponent panel={panel} dataSources={config.dataSources} />
          </Cell>
        );
      })}
      {columnGridlines.map((line, index) => (
        <Gridline key={`col-${index}`} className="grid-divider" type="column" column={line.column} row={line.row} rowSpan={line.rowSpan} />
      ))}
      {rowGridlines.map((line, index) => (
        <Gridline
          key={`row-${index}`}
          className="grid-divider"
          type="row"
          row={line.row}
          column={line.column}
          columnSpan={line.columnSpan}
        />
      ))}
    </Grid>
  );
}

