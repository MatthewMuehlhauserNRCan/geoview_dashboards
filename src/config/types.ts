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
  // passed straight through to the GeoView core map component; optional when `configUrl` is used instead
  config?: Record<string, unknown>;
  // fetches the GeoView map config JSON from a separate file/URL instead of embedding it inline -
  // keeps a complex map config out of the (often hand-authored) dashboard config. If both are set,
  // `configUrl` wins (its fetched value is used, `config` is ignored).
  configUrl?: string;
  // NOTE: `interactions.emits` (inherited from BasePanelConfig) has a special meaning for a map
  // panel - when set, it publishes the map's current VIEW EXTENT onto those channels (updated on
  // every pan/zoom), not a click selection like other panel types. Chart/table panels listening
  // to the same channel can then optionally filter their own rows down to just the current map
  // view (see ChartPanelConfig.filterToMapView / TablePanelConfig.filterToMapView).
}

export interface ChartPanelConfig extends BasePanelConfig {
  type: 'chart';
  chartType: 'bar' | 'line' | 'pie' | 'scatter' | 'histogram';
  // Optional categorical field to aggregate by (count of rows per distinct value) for
  // bar/pie/histogram charts - e.g. a count of features per distinct "Symbol" value. Without it,
  // these chart types fall back to one bar per raw row (only sensible for already-small row sets).
  field?: string;
  // 'count' (default) counts rows per group; sum/avg/min/max aggregate `valueField` per group instead.
  aggregation?: 'count' | 'sum' | 'avg' | 'min' | 'max';
  // numeric field to aggregate; required (and only used) when aggregation isn't 'count'.
  valueField?: string;
  // Alternative to `dataSource`/`field`-based grouping: one bar/slice per entry here, each
  // pulling its OWN data source and counting its rows - e.g. one bar per sublayer of a group
  // layer. Mutually exclusive with `dataSource`/`field` (when set, those are ignored). Not
  // supported for chartType 'scatter' (which needs two numeric fields on one row set).
  sources?: { dataSourceId: string; label?: string; color?: string }[];
  // Overrides the auto-assigned color for specific category values (keyed by the `field`'s raw
  // value, e.g. `{ "Natural": "#4caf50" }`) - any category not listed here still gets its own
  // auto-assigned color. Ignored in multi-source mode (use `sources[].color` there instead).
  colors?: Record<string, string>;
  // Where the built-in per-category legend appears, or 'none' to hide it entirely. Defaults to
  // 'right' (stacked vertically) for 'pie' - its auto-generated one-entry-per-slice legend gets
  // crowded above the chart with more than a few categories; other chart types default to 'top'
  // (one entry for the whole dataset, same as Chart.js's own default).
  legendPosition?: 'top' | 'right' | 'bottom' | 'left' | 'none';
  // 'pie' only: labels each slice directly with its category name, as an alternative (or
  // addition) to the legend - most useful with `legendPosition: 'none'` when there are many
  // categories and a long side legend is still more than wanted.
  showSliceLabels?: boolean;
  // Whether this chart's rows are restricted to the current map view extent, when a listened
  // channel actually carries one (published by a map panel with `interactions.emits` set) -
  // ignored entirely otherwise. Defaults to true (on by default); the viewer can still toggle it
  // off at runtime via a switch that only appears once a view extent is actually available.
  filterToMapView?: boolean;
}

export interface StatPanelConfig extends BasePanelConfig {
  type: 'stat';
  // 'count' (default) counts matching rows; sum/avg/min/max aggregate `field` across them instead.
  aggregation?: 'count' | 'sum' | 'avg' | 'min' | 'max';
  // numeric field to aggregate; required (and only used) when aggregation isn't 'count'.
  field?: string;
  // plain number (default) or a semi-circular gauge arc showing the value within gauge.min..max.
  display?: 'number' | 'gauge';
  gauge?: {
    min?: number;
    max?: number;
    // what's shown centered on the arc: the raw value (default), its percentage of min..max, or
    // both (value as the main line, percentage as a smaller line underneath).
    label?: 'value' | 'percentage' | 'both';
  };
}

export interface TablePanelConfig extends BasePanelConfig {
  type: 'table';
  // Shows/hides the "zoom to feature" row action (only possible when `dataSource` is a
  // `map-layer` source with an identifiable id field) - auto-detected when omitted. In
  // single-source mode this is all-or-nothing (not checked per row): either every row gets the
  // action or none do, since one layer's rows all share the same schema. In multi-source mode
  // (`sources` set) it's checked per row instead, since a merged table's rows no longer all come
  // from the same layer - `false` still always hides it entirely either way.
  showZoomToFeature?: boolean;
  // Whether this table's rows are restricted to the current map view extent, when a listened
  // channel actually carries one (published by a map panel with `interactions.emits` set) -
  // ignored entirely otherwise. Defaults to true (on by default); the viewer can still toggle it
  // off at runtime via a switch that only appears once a view extent is actually available.
  filterToMapView?: boolean;
  // Alternative to `dataSource`: combines rows from MULTIPLE data sources into one table instead
  // of showing just one - e.g. every sublayer of a group layer, without needing a separate tab per
  // layer. Mutually exclusive with `dataSource` (when set, it's ignored). Adds a "Source" column
  // identifying which data source each row came from (label defaults to its map layer name, or
  // its id otherwise; `label` overrides this per entry).
  sources?: { dataSourceId: string; label?: string }[];
}

export interface LegendPanelConfig extends BasePanelConfig {
  type: 'legend';
  mapPanelId?: string;
  // Hides each layer's header row (name + toggle-all) - useful when the map has just one layer
  // of interest and the panel's own `title` already describes it. Defaults to true (shown).
  showLayerHeaders?: boolean;
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
  // inline text; required unless `contentUrl` is set. Rendered per `format` (plain text by default).
  content?: string;
  // fetches a remote document's text instead of using `content` - always rendered as markdown,
  // regardless of `format` (that's the whole point of pointing at a `.md` document).
  contentUrl?: string;
  // how `content` is rendered; ignored when `contentUrl` is set (always markdown there). Defaults to 'plain'.
  format?: 'plain' | 'markdown';
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
  // Freeform author note on what this channel is for - purely documentation (shown in the
  // editor), never read at runtime. A channel can carry MANY different fields at once (it's
  // just a shared `{field: values[]}` bag - see FieldFilterValue) - this is NOT a binding to one
  // field, so don't rely on it to mean "only this field is ever pushed onto this channel".
  description?: string;
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
// (rendered automatically whenever there's more than one). `titlePanel` is per-page (unlike
// `titleElement`, which is dashboard-wide) so e.g. the right-side text can differ per page.
export interface DashboardPageConfig {
  id: string;
  label: string;
  titlePanel?: TitlePanelConfig;
  grid: GridConfig;
  panels: GridPanel[];
}

// Colors only for v1 - every field is optional CSS color string; an omitted field falls back to
// MUI's own default palette, so an unconfigured dashboard looks exactly like it did before this
// existed. Drives an MUI theme (src/theme/createDashboardTheme.ts) rather than overriding
// individual component styles - most of the app already references theme-relative palette
// tokens (`primary.main`, `background.paper`, etc.), so this re-skins the whole dashboard
// without touching per-panel styling.
export interface DashboardThemeConfig {
  primaryColor?: string;
  secondaryColor?: string;
  // page backdrop behind the grid (MUI's palette.background.default)
  backgroundColor?: string;
  // panel/card surfaces (MUI's palette.background.paper)
  paperColor?: string;
  // Main text color (MUI's palette.text.primary). If omitted but `backgroundColor`/`paperColor`
  // is customized, a readable black/white is picked automatically based on contrast - this only
  // needs to be set explicitly to override that automatic choice.
  textColor?: string;
}

export interface DashboardConfig {
  id: string;
  title: string;
  // Sits above the main grid, outside the col/row panel system entirely (so authoring the rest
  // of `panels` never has to account for it) - see src/title/. Shared across every page, unlike
  // `titlePanel` which is authored per-page (DashboardPageConfig.titlePanel).
  titleElement?: TitleElementConfig;
  // Dashboard-wide, like `titleElement` - not authored per-page.
  theme?: DashboardThemeConfig;
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
  // Applied when this option is clicked: sets each listed channel's field to these values, same
  // shape a filter panel's own selection would push. Options in the same menu behave like a radio
  // group - selecting one clears every OTHER option's filter fields first (never combined),
  // clicking the active option again clears its own.
  filters?: TitleMenuOptionFilter[];
}

export interface TitleMenuOptionFilter {
  channel: string;
  field: string;
  values: string[];
}

// The author configures the option list; clicking one applies its `filters` (see TitleMenuOption).
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
