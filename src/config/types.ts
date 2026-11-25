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
  // Categorical field to group by (one bar/slice/point per distinct value) for bar/line/pie - e.g.
  // a count of features per distinct "Symbol" value. For 'histogram', a NUMERIC field to bin
  // instead (falls back to categorical grouping if its values aren't numeric). Without it,
  // bar/line/pie fall back to one bar per raw row (see `xField`/`yField`).
  field?: string;
  // 'count' (default) counts rows per group; sum/avg/min/max aggregate `valueField` per group instead.
  aggregation?: 'count' | 'sum' | 'avg' | 'min' | 'max';
  // numeric field to aggregate; required (and only used) when aggregation isn't 'count'.
  valueField?: string;
  // Splits each `field` group into one dataset per distinct value of this second field (grouped
  // bars, or one line/point cloud per value) - e.g. `field: "agency"` + `seriesField: "status"`.
  // Combine with `stacked` for stacked bars. Ignored by 'pie' and in multi-source mode (where each
  // source is already its own series).
  seriesField?: string;
  // Alternative to a single `dataSource`: pulls each entry's OWN data source. Without `field`
  // (or for 'pie'), one bar/slice per source showing its aggregated rows (row count by default) -
  // e.g. one bar per sublayer of a group layer. With `field`, one SERIES per source instead, all
  // grouped by that field on shared axes. 'scatter' plots one point cloud per source.
  sources?: { dataSourceId: string; label?: string; color?: string }[];
  // Overrides the auto-assigned color for specific values, keyed by raw value (e.g.
  // `{ "Natural": "#4caf50" }`) - `field` values normally, or `seriesField` values when that's
  // set (each series has one color). Anything not listed still gets its own auto-assigned color.
  // Ignored in multi-source mode (use `sources[].color` there instead).
  colors?: Record<string, string>;
  // Where the built-in legend appears, or 'none' to hide it entirely. Defaults to 'right'
  // (stacked vertically) for 'pie' - its auto-generated one-entry-per-slice legend gets crowded
  // above the chart with more than a few categories; other chart types default to 'top' (one entry
  // per dataset/series, same as Chart.js's own default).
  legendPosition?: 'top' | 'right' | 'bottom' | 'left' | 'none';
  // 'pie' only: labels each slice directly with its category name, as an alternative (or
  // addition) to the legend - most useful with `legendPosition: 'none'` when there are many
  // categories and a long side legend is still more than wanted.
  showSliceLabels?: boolean;
  // Draws each bar/segment/point/slice's value directly on the chart. Bar labels too small to
  // fit inside their bar segment are skipped automatically.
  showValueLabels?: boolean;
  // bar/line/histogram with more than one series: stacks the series instead of placing them side
  // by side (bar) or overlapping (line).
  stacked?: boolean;
  // bar/histogram only: bars run horizontally (categories down the left axis).
  horizontal?: boolean;
  // Category order when grouped by `field`: by label (default - numeric-aware) or by value
  // (the aggregate across all series combined, e.g. a stacked bar's total). Not used by histogram
  // (bins stay in numeric order).
  sort?: 'label' | 'value-asc' | 'value-desc';
  // Keeps only the first N categories (after `sort`) and folds the rest into one "Other" category.
  limit?: number;
  // 'histogram' only: number of equal-width bins (default 10).
  bins?: number;
  // Explicit columns instead of auto-detection: x/y for 'scatter', or label (x) / value (y) for
  // ungrouped (no `field`) bar/line/pie charts. Auto-detected when omitted (first two numeric
  // fields for scatter; first string + first numeric field otherwise).
  xField?: string;
  yField?: string;
  // Overrides the auto-generated axis titles (by visual axis - x is horizontal even for
  // `horizontal` bars). An empty string hides that title. Ignored by 'pie'.
  xAxisTitle?: string;
  yAxisTitle?: string;
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
  // inline text; required unless `contentUrl` or `template` is set. Rendered per `format` (plain text by default).
  content?: string;
  // fetches a remote document's text instead of using `content` - always rendered as markdown,
  // regardless of `format` (that's the whole point of pointing at a `.md` document).
  contentUrl?: string;
  // markdown template with `{{FieldName}}` placeholders, filled in from `dataSource` (inherited
  // from BasePanelConfig) - e.g. combining several header/body fields from one feature into one
  // formatted panel. A missing field renders as an empty string. Always rendered as markdown,
  // like `contentUrl`. Requires `dataSource`; takes priority over `content`/`contentUrl` if more
  // than one is set.
  template?: string;
  // when `dataSource` returns more than one row: true (default) repeats `template` once per row
  // (joined by a markdown rule); false renders it only against the first row, ignoring the rest.
  repeatTemplate?: boolean;
  // shown instead of `template` (rendered as markdown) when `dataSource` returns zero rows (e.g.
  // its `where` clause matched nothing) - ignored unless `template` is set. Omit to fall back to
  // rendering `template` itself against an empty row (every `{{field}}` renders blank).
  emptyContent?: string;
  // how `content` is rendered; ignored when `contentUrl`/`template` is set (always markdown there). Defaults to 'plain'.
  format?: 'plain' | 'markdown';
}

export interface ImageItemConfig {
  // image URL (or data URI)
  src: string;
  // accessibility/alt text; defaults to empty (decorative) when omitted
  alt?: string;
  // optional caption shown over the bottom of the image (and in the lightbox)
  caption?: string;
  // optional URL opened in a new tab when the image is clicked (instead of opening the lightbox)
  link?: string;
  // optional per-image title - while this image is showing, it replaces the panel's own
  // `title` in the header (and the lightbox). Falls back to the panel's `title` when omitted.
  title?: string;
}

export interface ImagePanelConfig extends BasePanelConfig {
  type: 'image';
  // single-image shorthand (equivalent to `images: [{ src, alt, link }]`); ignored when `images`
  // is set. One of `src` / `images` is required.
  src?: string;
  alt?: string;
  link?: string;
  // one or more images - more than one turns the panel into a carousel with prev/next controls
  images?: ImageItemConfig[];
  // how the image fits its panel, like CSS `object-fit`. Defaults to 'contain'.
  fit?: 'contain' | 'cover' | 'fill';
  // clicking an image opens it full screen. Defaults to true.
  lightbox?: boolean;
  // carousel only: auto-advance through the images (with a pause button). Defaults to false.
  autoplay?: boolean;
  // carousel only: seconds each image is shown while autoplaying. Defaults to 5.
  autoplaySeconds?: number;
}

// Author-supplied visual identity for one card, keyed by that card's `titleField` value in
// `CardsPanelConfig.cardStyles` - for when the data source has no icon/color fields of its own.
export interface CardStyleConfig {
  icon?: string;
  color?: string;
}

// One manually-authored card (used instead of generating cards from `dataSource` rows) - plain
// markdown, no `{{FieldName}}` templating (there's no row to fill in from).
export interface CardEntryConfig {
  title: string;
  summary?: string;
  detail?: string;
  icon?: string;
  color?: string;
}

// Either a fixed, manually-authored list (`cards`) or one card auto-generated per row of
// `dataSource` (inherited from BasePanelConfig) - e.g. a grid of organizations, each showing a
// short always-visible summary and a longer detail section revealed on hover (desktop) or by
// tapping the card's own expand icon (touch). Cards are laid out in a responsive grid (more
// columns on wide screens, a single stacked column on a phone-width screen).
export interface CardsPanelConfig extends BasePanelConfig {
  type: 'cards';
  // A fixed list of cards, authored directly here - takes priority over `dataSource`-driven cards
  // below when non-empty (e.g. for a handful of one-off cards with no backing service at all).
  cards?: CardEntryConfig[];
  // Fixed number of cards per row on wide screens (still naturally wraps to fewer on narrower
  // screens, down to one at phone width) - omit for a fully responsive auto-fit grid instead.
  columns?: number;
  // field whose value becomes each card's title, and the key used to look up `cardStyles` -
  // required (along with `dataSource`) when `cards` above is unset/empty.
  titleField?: string;
  // markdown (same {{FieldName}} placeholders as a text panel's `template`) always shown under
  // the title, filled in from that row - e.g. a short status line. Ignored when `cards` is set
  // (use each entry's own `summary` instead).
  summaryTemplate?: string;
  // markdown (same {{FieldName}} syntax) revealed on hover/tap - e.g. longer detail text, links.
  // A card with no detail content has nothing to expand (no expand icon shown for it). Ignored
  // when `cards` is set (use each entry's own `detail` instead).
  detailTemplate?: string;
  // reads an icon (image URL) / background color straight from each row, if the data source
  // happens to provide them - checked before `cardStyles`/the default below. Ignored when `cards`
  // is set (use each entry's own `icon`/`color` instead).
  iconField?: string;
  colorField?: string;
  // per-card icon/color, keyed by the row's `titleField` value - used when `iconField`/
  // `colorField` are unset, or a specific row has no value for them. Ignored when `cards` is set.
  cardStyles?: Record<string, CardStyleConfig>;
  // fallback icon/color when neither a row/manual-card entry nor `cardStyles` supplies one;
  // `defaultColor` falls back further to the dashboard theme's primary color if also unset.
  defaultIcon?: string;
  defaultColor?: string;
  // shown instead of the (empty) grid when there are zero cards to show (no `cards` entries, or
  // `dataSource` returned zero rows).
  emptyText?: string;
}

// Panel types that can be placed directly on the grid or nested inside a tab panel.
export type LeafPanelConfig =
  | MapPanelConfig
  | ChartPanelConfig
  | StatPanelConfig
  | TablePanelConfig
  | LegendPanelConfig
  | FilterPanelConfig
  | TextPanelConfig
  | ImagePanelConfig
  | CardsPanelConfig;

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
  // A simple, single-line heading below `titlePanel` (e.g. naming which page/section is active) -
  // unlike `titlePanel`'s 3-column left/image/right layout, this is just one line of text. Use
  // this for content that genuinely changes per page; if `titlePanel`'s content is actually the
  // SAME on every page, just author it identically on each page rather than using this instead.
  pageHeading?: PageHeadingConfig;
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

// One reusable "slot" a header-menu option can set a value for - channel/field (and optionally
// which data source(s) share that field/value) are defined ONCE here and shared by every option,
// instead of repeating that shape per option (an option then just supplies a short values list
// per target - see TitleMenuOption.values).
export interface TitleMenuFilterTarget {
  id: string;
  // Optional author-facing row label shown in the editor's matrix (e.g. "Agency (layer A)");
  // purely cosmetic, falls back to showing the field/channel when omitted.
  label?: string;
  channel: string;
  field: string;
  // Optional - notes which data source(s) share this exact field name AND value representation;
  // purely documentation/editor convenience (drives the editor's data-source picker), never read
  // by the running dashboard - only `channel`/`field` are actually applied (see TitleElement.tsx).
  // If a data source needs a different field name or value for what's conceptually the same
  // filter, give it its OWN target instead of adding it here (targets can still share one
  // `channel` if desired) - same pattern as the legend panel's channel split in linking.md.
  dataSources?: string[];
}

export interface TitleMenuOption {
  id: string;
  label: string;
  // Applied when this option is clicked: for every optionsMenu.targets entry, sets that target's
  // channel/field to values[target.id] (or clears it, if omitted) - same shape a filter panel's
  // own selection would push. Options in the same menu behave like a radio group - selecting one
  // clears every OTHER option's values first (never combined), clicking the active option again
  // clears its own. Keyed by target id, not channel/field, so renaming a target's field doesn't
  // require touching every option.
  values?: Record<string, string[]>;
}

// The author configures `targets` once and `options` list; clicking an option applies its
// `values` against every target (see TitleMenuOption).
export interface TitleOptionsMenuConfig {
  icon?: TitleImageConfig;
  label?: string;
  targets?: TitleMenuFilterTarget[];
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

// A plain, non-resizable single-line heading - deliberately much simpler than TitlePanelConfig
// (no left/image/right split), meant for a short label naming the current page/section.
export interface PageHeadingConfig {
  text: string;
  align?: 'left' | 'center' | 'right';
  textColor?: string;
  backgroundColor?: string;
}
