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
  // Optional categorical field to aggregate by (count of rows per distinct value) for
  // bar/pie/histogram charts - e.g. a count of features per distinct "Symbol" value. Without it,
  // these chart types fall back to one bar per raw row (only sensible for already-small row sets).
  field?: string;
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

// One filterable field within a filter panel - rendered as a multiselect of that field's
// distinct values (sourced from the panel's own `dataSource`).
export interface FilterFieldConfig {
  field: string;
  label?: string;
}

export interface FilterPanelConfig extends BasePanelConfig {
  type: 'filter';
  // All fields are shown together on one panel (not split into tabs). `dataSource` (inherited
  // from BasePanelConfig) must point at a `map-layer` data source - its features supply both the
  // selectable per-field values and the map layer the combined filter gets applied to.
  fields: FilterFieldConfig[];
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

// Splits one grid cell into multiple leaf panels stacked together (all visible at once, unlike
// `tab` which switches between them) - e.g. two small stat panels sharing a cell that doesn't
// need a whole grid row/column each.
export interface StackPanelConfig extends BasePanelConfig {
  type: 'stack';
  direction?: 'row' | 'column';
  // relative size weight per item (like CSS flex-grow); defaults to equal sizes if omitted/mismatched
  sizes?: number[];
  // items hold one leaf panel each; nesting tabs/stacks inside a stack isn't supported
  items: LeafPanelConfig[];
}

export type PanelConfig = LeafPanelConfig | TabPanelConfig | StackPanelConfig;

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

// Reads features from a vector layer already loaded in one of the dashboard's own map panels,
// instead of fetching from an external source.
export interface MapLayerDataSourceConfig {
  id: string;
  type: 'map-layer';
  mapPanelId: string;
  layerId: string;
}

export type DataSourceConfig = RestJsonDataSourceConfig | StaticFileDataSourceConfig | MapLayerDataSourceConfig;


export interface LinkingChannel {
  id: string;
  type: 'filter';
  field: string;
}

export interface LinkingConfig {
  channels: LinkingChannel[];
}

export interface GridConfig {
  // fixed grid that always fills the viewport (e.g. 3x3, 4x4); track sizes are draggable at
  // runtime, but the grid itself always fills 100% - no leftover space, no page scroll.
  columns: number;
  rows: number;
  // relative size weights (like CSS fr units) per column/row; defaults to equal sizes.
  // starting point only - a viewer's live drag-resize doesn't write back into this config.
  columnSizes?: number[];
  rowSizes?: number[];
  // named preset used only by the editor to pre-fill columns/rows/panels
  template?: string;
}

// One switchable "view" of the dashboard - its own grid + panels, sharing the parent
// DashboardConfig's dataSources/linking. A footer tab bar lets viewers switch between pages
// (rendered automatically whenever there's more than one).
export interface DashboardPageConfig {
  id: string;
  label: string;
  grid: GridConfig;
  panels: GridPanel[];
}

export interface DashboardConfig {
  id: string;
  title: string;
  // Both sit above the main grid, outside the col/row panel system entirely (so authoring the
  // rest of `panels` never has to account for them) - see src/title/. Either/both may be omitted.
  titleElement?: TitleElementConfig;
  titlePanel?: TitlePanelConfig;
  pages: DashboardPageConfig[];
  dataSources: DataSourceConfig[];
  linking?: LinkingConfig;
}

export interface TitleImageConfig {
  src: string;
  alt?: string;
  // optional: wraps the image in a link (e.g. a logo linking back to an org's homepage)
  href?: string;
}

export interface TitleMenuOption {
  id: string;
  label: string;
}

// Shell only for now - the author configures the option list, but what selecting one actually
// does (filter data, switch a view, etc.) isn't wired up yet.
export interface TitleOptionsMenuConfig {
  icon?: TitleImageConfig;
  label?: string;
  options: TitleMenuOption[];
}

export interface TitleHamburgerLinkConfig {
  id: string;
  label: string;
  href: string;
}

export interface TitleHamburgerNoticeConfig {
  // menu item label; `title`/`content` are the modal's own title/body text
  label: string;
  title: string;
  content: string;
}

export interface TitleHamburgerMenuConfig {
  links?: TitleHamburgerLinkConfig[];
  notice?: TitleHamburgerNoticeConfig;
}

// The fixed, non-resizable header above everything (including the resizable title panel below).
export interface TitleElementConfig {
  image?: TitleImageConfig;
  title: string;
  subtitle?: string;
  backgroundColor?: string;
  optionsMenu?: TitleOptionsMenuConfig;
  hamburgerMenu?: TitleHamburgerMenuConfig;
}

// A thin, full-width, height-resizable strip below the title element: three boxes side by
// side (left text, centered image, right text), any of which may be omitted. Starts sized to
// its content and only grows/shrinks from there if the viewer drags its bottom edge.
export interface TitlePanelConfig {
  left?: string;
  image?: TitleImageConfig;
  right?: string;
  backgroundColor?: string;
}
