// Types mirroring the config schema drafted in docs/ARCHITECTURE.md.

// Position on the fixed dashboard grid (1-indexed, like CSS grid-column/grid-row).
export interface PanelLayout {
  col: number;
  row: number;
  colSpan?: number;
  rowSpan?: number;
}

export interface PanelInteractions {
  emits?: string[];
  listensTo?: string[];
}

interface BasePanelConfig {
  id: string;
  title?: string;
  dataSource?: string;
  query?: Record<string, unknown>;
  interactions?: PanelInteractions;
}

export interface MapPanelConfig extends BasePanelConfig {
  type: 'map';
  // passed straight through to the GeoView core map component
  config: Record<string, unknown>;
}

export interface ChartPanelConfig extends BasePanelConfig {
  type: 'chart';
  chartType: 'bar' | 'line' | 'pie' | 'scatter' | 'histogram';
}

export interface StatPanelConfig extends BasePanelConfig {
  type: 'stat';
}

export interface TablePanelConfig extends BasePanelConfig {
  type: 'table';
}

export interface LegendPanelConfig extends BasePanelConfig {
  type: 'legend';
  mapPanelId?: string;
}

export interface FilterPanelConfig extends BasePanelConfig {
  type: 'filter';
  control: 'dropdown' | 'slider' | 'date-range' | 'search';
  field: string;
}

export interface TextPanelConfig extends BasePanelConfig {
  type: 'text';
  content: string;
}

// Panel types that can be placed directly on the grid or nested inside a tab panel.
export type LeafPanelConfig =
  | MapPanelConfig
  | ChartPanelConfig
  | StatPanelConfig
  | TablePanelConfig
  | LegendPanelConfig
  | FilterPanelConfig
  | TextPanelConfig;

export interface TabItemConfig {
  id: string;
  label: string;
  // tabs hold one leaf panel each; nesting tabs inside tabs isn't supported
  panel: LeafPanelConfig;
}

export interface TabPanelConfig extends BasePanelConfig {
  type: 'tab';
  tabs: TabItemConfig[];
}

export type PanelConfig = LeafPanelConfig | TabPanelConfig;

// A panel as it appears directly on the dashboard grid (needs a position; tab-nested panels don't).
export type GridPanel = PanelConfig & { layout: PanelLayout };

export interface DataSourceRefresh {
  mode: 'static' | 'interval';
  seconds?: number;
}

export interface DataSourceAuth {
  // token-based auth is deferred until a real source needs it
  type: 'none';
}

export interface RestJsonDataSourceConfig {
  id: string;
  type: 'rest-json';
  url: string;
  auth?: DataSourceAuth;
  refresh?: DataSourceRefresh;
}

export interface StaticFileDataSourceConfig {
  id: string;
  type: 'static-file';
  format: 'csv' | 'json' | 'excel';
  url: string;
}

export type DataSourceConfig = RestJsonDataSourceConfig | StaticFileDataSourceConfig;

export interface LinkingChannel {
  id: string;
  type: 'filter';
  field: string;
}

export interface LinkingConfig {
  channels: LinkingChannel[];
}

export interface GridConfig {
  // fixed grid that always fills the viewport (e.g. 3x3, 4x4) - not a free-resize layout
  columns: number;
  rows: number;
  // named preset used only by the editor to pre-fill columns/rows/panels
  template?: string;
}

export interface DashboardConfig {
  id: string;
  title: string;
  grid: GridConfig;
  dataSources: DataSourceConfig[];
  linking?: LinkingConfig;
  panels: GridPanel[];
}
