import { Cell, Grid, Gridline } from 'react-resizable-panels';
import type { DataSourceConfig, StackPanelConfig } from '../config/types';
import { leafPanelRegistry } from './leafRegistry';
import { PanelErrorBoundary } from './PanelErrorBoundary';
import { toPercentFromWeights } from '../grid/layoutUtils';

interface StackPanelProps {
  panel: StackPanelConfig;
  dataSources: DataSourceConfig[];
}

// Splits one grid cell into multiple leaf panels, all visible together (unlike `tab`, which
// switches between them) - e.g. two small stat panels sharing a cell. Uses the SAME resizable
// Grid/Cell/Gridline primitives as the top-level dashboard grid (see grid/DashboardGrid.tsx), so
// items fill their slice edge-to-edge (no more left-aligned/flex-shrunk look) and the boundary
// between them is draggable just like every other divider on the page.
export function StackPanel({ panel, dataSources }: StackPanelProps) {
  // 'row' direction = items side-by-side = split along columns; 'column' (default) = stacked
  // top-to-bottom = split along rows - same terms flexDirection would use.
  const isColumnSplit = (panel.direction ?? 'column') === 'row';
  const count = panel.items.length;
  const weights = panel.sizes?.length === count ? panel.sizes : panel.items.map(() => 1);
  const percent = toPercentFromWeights(weights);

  return (
    <Grid
      className="dashboard-grid-nested"
      columns={isColumnSplit ? count : 1}
      rows={isColumnSplit ? 1 : count}
      defaultLayout={isColumnSplit ? { columns: percent, rows: { 0: 100 } } : { columns: { 0: 100 }, rows: percent }}
    >
      {panel.items.map((item, index) => {
        const ItemComponent = leafPanelRegistry[item.type];
        return (
          <Cell
            key={item.id}
            column={isColumnSplit ? index : 0}
            row={isColumnSplit ? 0 : index}
            columnSpan={1}
            rowSpan={1}
            style={{ minWidth: 0, minHeight: 0 }}
          >
            <PanelErrorBoundary panelId={item.id} title={item.title}>
              <ItemComponent panel={item} dataSources={dataSources} />
            </PanelErrorBoundary>
          </Cell>
        );
      })}
      {Array.from({ length: count - 1 }, (_, index) => index + 1).map((boundary) =>
        isColumnSplit ? (
          <Gridline key={boundary} className="grid-divider" type="column" column={boundary} row={0} rowSpan={1} />
        ) : (
          <Gridline key={boundary} className="grid-divider" type="row" row={boundary} column={0} columnSpan={1} />
        )
      )}
    </Grid>
  );
}
