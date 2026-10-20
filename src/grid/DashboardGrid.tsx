import { Cell, Grid, Gridline } from 'react-resizable-panels';
import type { DataSourceConfig, GridConfig, GridPanel } from '../config/types';
import { panelRegistry } from '../panels';
import { PanelErrorBoundary } from '../panels/PanelErrorBoundary';
import { toPercentFromWeights } from './layoutUtils';

interface DashboardGridProps {
  grid: GridConfig;
  panels: GridPanel[];
  dataSources: DataSourceConfig[];
}

// The subset of page data the recursive partition helpers below actually need (just the track
// sizes and the data sources to hand to each panel) - not the whole DashboardConfig.
interface GridPageData {
  grid: GridConfig;
  dataSources: DataSourceConfig[];
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

interface LayoutItem {
  panel: GridPanel;
  col0: number;
  colSpan: number;
  row0: number;
  rowSpan: number;
}

function toLayoutItems(panels: GridPanel[]): LayoutItem[] {
  return panels.map((panel) => ({
    panel,
    col0: panel.layout.col - 1,
    colSpan: panel.layout.colSpan ?? 1,
    row0: panel.layout.row - 1,
    rowSpan: panel.layout.rowSpan ?? 1,
  }));
}

// Finds every boundary strictly between start and end, along the given axis, that no
// item's span crosses - a "clean seam" where the region can be split into independent
// zones with their own resizable track sizing (e.g. a map's row height no longer tied
// to an unrelated panel's row height just because they happen to share row indices).
function findFreeCuts(items: LayoutItem[], axis: 'col' | 'row', start: number, end: number): number[] {
  const cuts: number[] = [];
  for (let boundary = start + 1; boundary < end; boundary += 1) {
    const crossed = items.some((item) => {
      const itemStart = axis === 'col' ? item.col0 : item.row0;
      const itemSpan = axis === 'col' ? item.colSpan : item.rowSpan;
      return itemStart < boundary && boundary <= itemStart + itemSpan - 1;
    });
    if (!crossed) cuts.push(boundary);
  }
  return cuts;
}

type PartitionNode =
  | { kind: 'single'; panel: GridPanel }
  | { kind: 'flat'; panels: GridPanel[]; colStart: number; colEnd: number; rowStart: number; rowEnd: number }
  | { kind: 'split'; axis: 'column' | 'row'; boundaries: number[]; children: PartitionNode[] };

// Recursively slices a region into independent sub-grids wherever a clean seam exists,
// so resizing one zone's rows/columns never affects an unrelated zone that merely
// happens to share the same row/column indices. Falls back to a flat multi-cell grid
// (today's single-Grid algorithm, scoped to the region) when panels are genuinely
// interlocked and no clean seam remains.
function partition(items: LayoutItem[], colStart: number, colEnd: number, rowStart: number, rowEnd: number): PartitionNode {
  if (items.length === 1) return { kind: 'single', panel: items[0].panel };

  const colCuts = findFreeCuts(items, 'col', colStart, colEnd);
  if (colCuts.length > 0) {
    const boundaries = [colStart, ...colCuts, colEnd];
    const children = boundaries.slice(0, -1).map((b0, i) => {
      const b1 = boundaries[i + 1];
      const subset = items.filter((item) => item.col0 >= b0 && item.col0 + item.colSpan <= b1);
      return partition(subset, b0, b1, rowStart, rowEnd);
    });
    return { kind: 'split', axis: 'column', boundaries, children };
  }

  const rowCuts = findFreeCuts(items, 'row', rowStart, rowEnd);
  if (rowCuts.length > 0) {
    const boundaries = [rowStart, ...rowCuts, rowEnd];
    const children = boundaries.slice(0, -1).map((b0, i) => {
      const b1 = boundaries[i + 1];
      const subset = items.filter((item) => item.row0 >= b0 && item.row0 + item.rowSpan <= b1);
      return partition(subset, colStart, colEnd, b0, b1);
    });
    return { kind: 'split', axis: 'row', boundaries, children };
  }

  return { kind: 'flat', panels: items.map((item) => item.panel), colStart, colEnd, rowStart, rowEnd };
}

function renderPanel(panel: GridPanel, dataSources: DataSourceConfig[]) {
  const PanelComponent = panelRegistry[panel.type];
  return (
    <PanelErrorBoundary panelId={panel.id} title={panel.title}>
      <PanelComponent panel={panel} dataSources={dataSources} />
    </PanelErrorBoundary>
  );
}

function FlatGridLeaf({
  node,
  config,
}: {
  node: Extract<PartitionNode, { kind: 'flat' }>;
  config: GridPageData;
}) {
  const { panels, colStart, colEnd, rowStart, rowEnd } = node;
  const columns = colEnd - colStart;
  const rows = rowEnd - rowStart;

  const columnRects: AxisRect[] = panels.map((panel) => ({
    primaryStart: panel.layout.col - 1 - colStart,
    primarySpan: panel.layout.colSpan ?? 1,
    crossStart: panel.layout.row - 1 - rowStart,
    crossSpan: panel.layout.rowSpan ?? 1,
  }));
  const rowRects: AxisRect[] = panels.map((panel) => ({
    primaryStart: panel.layout.row - 1 - rowStart,
    primarySpan: panel.layout.rowSpan ?? 1,
    crossStart: panel.layout.col - 1 - colStart,
    crossSpan: panel.layout.colSpan ?? 1,
  }));

  const columnGridlines = Array.from({ length: columns - 1 }, (_, i) => i + 1).flatMap((boundary) =>
    freeCrossSegments(columnRects, boundary, rows).map(([row, rowSpan]) => ({ column: boundary, row, rowSpan }))
  );
  const rowGridlines = Array.from({ length: rows - 1 }, (_, i) => i + 1).flatMap((boundary) =>
    freeCrossSegments(rowRects, boundary, columns).map(([column, columnSpan]) => ({ row: boundary, column, columnSpan }))
  );

  const columnWeights = Array.from({ length: columns }, (_, i) => config.grid.columnSizes?.[colStart + i] ?? 1);
  const rowWeights = Array.from({ length: rows }, (_, i) => config.grid.rowSizes?.[rowStart + i] ?? 1);

  return (
    <Grid
      className="dashboard-grid-nested"
      columns={columns}
      rows={rows}
      defaultLayout={{ columns: toPercentFromWeights(columnWeights), rows: toPercentFromWeights(rowWeights) }}
    >
      {panels.map((panel) => {
        const { col, row, colSpan = 1, rowSpan = 1 } = panel.layout;
        return (
          <Cell
            key={panel.id}
            column={col - 1 - colStart}
            row={row - 1 - rowStart}
            columnSpan={colSpan}
            rowSpan={rowSpan}
            style={{ minWidth: 0, minHeight: 0 }}
          >
            {renderPanel(panel, config.dataSources)}
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

function PartitionGrid({ node, config }: { node: PartitionNode; config: GridPageData }) {
  if (node.kind === 'single') return renderPanel(node.panel, config.dataSources);
  if (node.kind === 'flat') return <FlatGridLeaf node={node} config={config} />;

  const { axis, boundaries, children } = node;
  const isColumn = axis === 'column';
  const sizes = isColumn ? config.grid.columnSizes : config.grid.rowSizes;
  const weights = boundaries.slice(0, -1).map((b0, i) => {
    const b1 = boundaries[i + 1];
    let sum = 0;
    for (let k = b0; k < b1; k += 1) sum += sizes?.[k] ?? 1;
    return sum;
  });
  const percent = toPercentFromWeights(weights);
  const count = children.length;

  return (
    <Grid
      className="dashboard-grid-nested"
      columns={isColumn ? count : 1}
      rows={isColumn ? 1 : count}
      defaultLayout={isColumn ? { columns: percent, rows: { 0: 100 } } : { columns: { 0: 100 }, rows: percent }}
    >
      {children.map((child, index) => (
        <Cell
          key={index}
          column={isColumn ? index : 0}
          row={isColumn ? 0 : index}
          columnSpan={1}
          rowSpan={1}
          style={{ minWidth: 0, minHeight: 0 }}
        >
          <PartitionGrid node={child} config={config} />
        </Cell>
      ))}
      {children.slice(0, -1).map((_, index) =>
        isColumn ? (
          <Gridline key={`sep-${index}`} className="grid-divider" type="column" column={index + 1} row={0} rowSpan={1} />
        ) : (
          <Gridline key={`sep-${index}`} className="grid-divider" type="row" row={index + 1} column={0} columnSpan={1} />
        )
      )}
    </Grid>
  );
}

// A fixed NxM grid that always fills the viewport (like an ESRI Dashboard). Panels are
// recursively partitioned into independent sub-grids wherever a clean seam exists (a
// column or row boundary no panel spans across), so e.g. resizing a map panel's row
// never also resizes an unrelated panel that merely shares the same row indices.
// Column/row track sizes are draggable, but only where a divider doesn't cross a panel
// that spans that boundary, so a panel's cell never gets a "phantom" divider through it.
export function DashboardGrid({ grid, panels, dataSources }: DashboardGridProps) {
  const { columns, rows } = grid;
  const tree = partition(toLayoutItems(panels), 0, columns, 0, rows);

  return (
    <div className="dashboard-grid" style={{ width: '100%', height: '100%' }}>
      <PartitionGrid node={tree} config={{ grid, dataSources }} />
    </div>
  );
}

