import type { DashboardConfig } from '../config/types';
import { panelRegistry } from '../panels';

interface DashboardGridProps {
  config: DashboardConfig;
}

// A fixed NxM grid that always fills the viewport - panels span multiple cells but
// never resize or scroll the page; use a panel's fullscreen action or a tab panel
// to explore something bigger instead.
export function DashboardGrid({ config }: DashboardGridProps) {
  return (
    <div
      className="dashboard-grid"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${config.grid.columns}, 1fr)`,
        gridTemplateRows: `repeat(${config.grid.rows}, 1fr)`,
      }}
    >
      {config.panels.map((panel) => {
        const PanelComponent = panelRegistry[panel.type];
        const { col, row, colSpan = 1, rowSpan = 1 } = panel.layout;
        return (
          <div
            key={panel.id}
            style={{
              gridColumn: `${col} / span ${colSpan}`,
              gridRow: `${row} / span ${rowSpan}`,
              minWidth: 0,
              minHeight: 0,
            }}
          >
            <PanelComponent panel={panel} dataSources={config.dataSources} />
          </div>
        );
      })}
    </div>
  );
}
