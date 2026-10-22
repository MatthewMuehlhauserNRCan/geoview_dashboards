# Panels

## Fields every panel shares

```ts
interface BasePanelConfig {
  id: string;
  title?: string; // shown in the panel's header bar; omit for no header at all (some panels)
  dataSource?: string; // the id of an entry in the top-level `dataSources` array
  query?: Record<string, unknown>; // reserved for future query/transform support - not used yet
  interactions?: {
    emits?: string[]; // linking channel id(s) this panel publishes selections/filters onto
    listensTo?: string[]; // linking channel id(s) this panel reacts to
  };
}
```

See [Linking](guide/linking.md) for what `emits`/`listensTo` actually do.

Every panel also needs a `type` discriminating which kind it is, and (when placed directly on a
page's grid) a `layout` - see [Pages & Grid](guide/pages-and-grid.md).

## `map`

Renders a live, interactive GeoView map.

```ts
interface MapPanelConfig {
  type: 'map';
  config?: Record<string, unknown>; // passed straight through to GeoView, unchanged
  configUrl?: string; // fetches the config JSON from a separate file instead of embedding it
}
```

Exactly one of `config`/`configUrl` must be set (if both are, `configUrl` wins). Either way it's
a real GeoView map config object (the same shape you'd hand to GeoView directly) - see GeoView's
own
[configuration reference](https://canadian-geospatial-platform.github.io/geoview/docs/#/app/config/configuration-reference)
for its full shape. At minimum it needs a `map` key with `viewSettings`/`basemapOptions`/
`listOfGeoviewLayerConfig`. See [Full Example](guide/full-example.md) for a complete, working one.

Use `configUrl` to keep a large/complex map config in its own file instead of embedding it inline
in the dashboard config - handy once a map's config grows beyond a few layers. It's fetched at
runtime with a plain `fetch()` (same mechanism as a text panel's `contentUrl`), so it must be
reachable (and CORS-permitting, if hosted on a different origin) from wherever the dashboard is
viewed - there's no bundling/packaging step that inlines it for you.

Other panels read a map panel's layers via a `map-layer` [data source](guide/data-sources.md)
that references this panel's own `id` as `mapPanelId`.

### Filtering other panels to the current map view

A map panel's `interactions.emits` has a different meaning than on every other panel type -
instead of publishing a click selection, it publishes the map's current VIEW EXTENT onto those
channel(s), updated on every pan/zoom:

```json
{ "type": "map", "id": "main-map", "config": { ... }, "interactions": { "emits": ["map-view"] } }
```

A `chart` or `table` panel that `listensTo` the same channel can then restrict its own rows to
only those currently visible on the map (see each panel's own `filterToMapView` option below) -
on by default, with a viewer-facing toggle switch that only appears once a view extent is
actually available. Rows with no resolvable geometry are treated as "not in view" while this
filtering is active, rather than always shown - in practice this only affects an `esriDynamic`
layer whose geometry recovery request failed (its normal bulk feature query never includes
geometry, so this app issues one extra request to get it; every other queryable vector layer type
already includes geometry on its normal query). Non-queryable raster/image services have no
per-feature row data at all regardless, so this doesn't apply to them.

## `chart`

Renders a bar/line/pie/scatter/histogram chart (Chart.js) from its `dataSource`'s rows.

```ts
interface ChartPanelConfig {
  type: 'chart';
  chartType: 'bar' | 'line' | 'pie' | 'scatter' | 'histogram';
  field?: string; // categorical field to group rows by
  aggregation?: 'count' | 'sum' | 'avg' | 'min' | 'max'; // defaults to 'count'
  valueField?: string; // numeric field to aggregate; required (and only used) when aggregation isn't 'count'
  sources?: { dataSourceId: string; label?: string; color?: string }[]; // multi-source mode, see below
  colors?: Record<string, string>; // per-category color overrides, keyed by the field's raw value
  legendPosition?: 'top' | 'right' | 'bottom' | 'left' | 'none'; // defaults to 'right' for pie, 'top' otherwise
  showSliceLabels?: boolean; // 'pie' only - labels each slice directly with its category name
  filterToMapView?: boolean; // defaults to true - see "Filtering other panels to the current map view" above
}
```

- `field`: for `bar`/`pie`/`histogram`, groups rows by this field's distinct values (e.g. one bar
  per distinct `"Symbol"` value). Without it, these chart types fall back to one bar per raw row -
  only sensible for an already-small row set. `histogram` is currently an alias for `bar` (no real
  binning yet).
- `aggregation` (only applies when `field` is set): `'count'` (default) counts rows per group;
  `'sum'`/`'avg'`/`'min'`/`'max'` aggregate `valueField` within each group instead (e.g. average
  population per region rather than a feature count per region).
- `scatter` ignores `field`/`aggregation` - it needs exactly 2 numeric fields in the data and
  plots them directly against each other (auto-detected from the row shape).
- Each category (bar/slice) gets its own distinct color automatically - `bar`/`pie`/`histogram`
  only; `line`/`scatter` keep one flat color, since a single connected line/point cloud doesn't
  read as separate "categories" the same way. `colors` overrides specific categories by their
  exact raw `field` value (e.g. `{ "Natural": "#4caf50" }`) - any category not listed still gets
  its own auto-assigned color. Ignored in multi-source mode (use `sources[].color` there instead).
- `legendPosition`/`showSliceLabels`: a pie chart's auto-generated one-entry-per-slice legend can
  get crowded above the chart with many categories - `legendPosition` moves it to a side (stacks
  vertically) or hides it (`'none'`), and `showSliceLabels` labels each slice directly as an
  alternative (most useful combined with `legendPosition: 'none'`). Both can be combined however
  you like (e.g. slice labels AND a side legend). Only `'pie'` honors `showSliceLabels`; other
  chart types ignore it (but still honor `legendPosition`, using Chart.js's own `'top'` default
  unless overridden).
- Clicking a bar/slice toggles that category in/out of the selection (multiple can be selected at
  once) in whichever channel this panel `emits` to (see [Linking](guide/linking.md)) - clicking an
  already-selected one again removes just that one. A "Clear selection" button appears whenever
  anything is selected.
- `filterToMapView` (default `true`): when this panel `listensTo` a channel a map panel is
  publishing its view extent onto, restricts the chart's own rows to just the current map view -
  see "Filtering other panels to the current map view" under `map` above. Ignored entirely when no
  such channel is listened to. Applies in multi-source mode too (each source's own row count is
  restricted before being charted).

### Multi-source mode

Instead of grouping rows from ONE `dataSource` by a field, `sources` renders one bar/slice per
**data source**, each showing that source's row count - useful for e.g. one bar per sublayer of a
group layer (several `map-layer` data sources pointed at the same map panel). When `sources` is
set, `dataSource`/`field`/`aggregation`/`valueField` are ignored; not supported for `scatter`.

```json
{
  "type": "chart",
  "chartType": "bar",
  "sources": [
    { "dataSourceId": "sublayer-a" },
    { "dataSourceId": "sublayer-b", "label": "Custom bar label", "color": "#4caf50" }
  ]
}
```

Clicking toggles that source in/out of the selection, emitted on this panel's channel as a
reserved field (not a real row field) carrying the selected data source ids. A `map` panel that
`listensTo` the same channel will show only the selected sources' layers, hiding every OTHER
layer backed by a data source listed in this chart's own `sources` - a layer backed by a data
source that ISN'T one of this chart's `sources` is left alone regardless of what's selected, and
everything shows again once the selection is cleared/empty.

Each entry's `color` overrides its auto-assigned color, same as the single-source `colors` map above.

Each entry's bar label defaults to that data source's underlying map layer name (for `map-layer`
sources) or its id otherwise - `label` overrides this per entry.

## `stat`


A single big number (or gauge) summarizing the rows currently matching every channel this panel
`listensTo` (or the data source's full row set, if it listens to nothing).

```ts
interface StatPanelConfig {
  type: 'stat';
  aggregation?: 'count' | 'sum' | 'avg' | 'min' | 'max'; // defaults to 'count'
  field?: string; // numeric field to aggregate; required (and only used) when aggregation isn't 'count'
  display?: 'number' | 'gauge'; // defaults to 'number'
  gauge?: { min?: number; max?: number; label?: 'value' | 'percentage' | 'both' }; // gauge arc range; max defaults to this stat's own unfiltered total (min defaults to 0); label defaults to 'value'
}
```

- `aggregation: 'count'` (default): the number of matching rows.
- `aggregation: 'sum' | 'avg' | 'min' | 'max'`: the total/average/minimum/maximum of `field`
  across matching rows.
- `display: 'gauge'`: renders the value as a semi-circular gauge arc (instead of a plain number),
  colored green/amber/red as it crosses 70%/90% of the `gauge.min`..`gauge.max` range. Without an
  explicit `gauge.max`, it defaults to this same stat's own unfiltered total - so by default the
  arc reads as "filtered value out of the whole" rather than clamping to a fixed 0..100 scale.
- `gauge.label`: what's shown centered on the arc - the raw `value` (default), its `percentage` of
  `gauge.min`..`gauge.max`, or `both` (value as the main line, percentage smaller underneath).


Give it a `title` (e.g. `"Total Count"`) and a `dataSource`.


## `table`

A sortable/filterable/searchable data table (material-react-table) of its `dataSource`'s rows.

```ts
interface TablePanelConfig {
  type: 'table';
  showZoomToFeature?: boolean;
  filterToMapView?: boolean; // defaults to true - see "Filtering other panels to the current map view" under `map` above
  sources?: { dataSourceId: string; label?: string }[]; // multi-source mode, see below
}
```

- `showZoomToFeature`: only relevant when the underlying data is a `map-layer` source. Adds a
  "zoom to feature" row action that pans/zooms the map to a clicked row's feature and highlights it.
  - Omitted (default): auto-detected - shown only when the underlying map layer has an
    identifiable id field GeoView can use to re-locate a feature (most ESRI/vector layers do).
  - `true`: always show it, even if auto-detection says it isn't possible (the button will just
    silently do nothing per row if it genuinely can't resolve a feature).
  - `false`: always hide it.
  - In single-source mode this is all-or-nothing for the whole table, not checked per row - either
    every row gets the action, or none do, since one layer's rows all share the same schema. In
    multi-source mode (`sources` set) it's checked per row instead, since a merged table's rows can
    come from layers of genuinely different types/capabilities. There's currently no support for a
    plain JSON/CSV data source (no map layer behind it) to offer this, even if it happens to have
    latitude/longitude columns.
- `filterToMapView` (default `true`): when this table `listensTo` a channel a map panel is
  publishing its view extent onto, restricts the table to just the rows currently visible on the
  map (a viewer-facing toggle switch appears once this applies). Ignored entirely when no such
  channel is listened to. Applies per-row across every source in multi-source mode too.

### Multi-source mode

Instead of one `dataSource`, `sources` merges rows from SEVERAL data sources into one table - e.g.
every sublayer of a group layer, without needing a separate tab per layer. When `sources` is set,
`dataSource` is ignored.

```json
{
  "type": "table",
  "sources": [{ "dataSourceId": "sublayer-a" }, { "dataSourceId": "sublayer-b", "label": "Custom source label" }]
}
```

A "Source" column is added identifying which data source each row came from - defaults to that
data source's underlying map layer name (for `map-layer` sources) or its id otherwise; `label`
overrides this per entry. Columns are the UNION of every source's own fields (not just the first
row's) - a row with no value for some other source's field just shows blank in that column.

## `legend`

Renders a live GeoView map's legend (one entry per layer, one swatch per class), with
visibility toggles.

```ts
interface LegendPanelConfig {
  type: 'legend';
  mapPanelId?: string; // the `id` of a `map` panel on the same page
  showLayerHeaders?: boolean; // default true
}
```

- `mapPanelId` is required for this panel to do anything - it must reference a `map` panel's own
  `id` (not a data source).
- `showLayerHeaders`: each layer's legend normally starts with a bold header row (its name, also
  a whole-layer visibility toggle). Set to `false` to hide that row entirely - useful when the
  map only has one layer of interest and the panel's own `title` already describes it (you lose
  the "toggle the whole layer" affordance for that layer when hidden).
- Toggling an individual item (not the whole-layer toggle) also pushes which items are still
  checked onto whichever channel(s) this panel `emits` to, so other panels can filter by the same
  classification - see [Linking](guide/linking.md) for the specifics and an important caveat
  about which channel to use for this.

## `filter`

One or more dropdown (multiselect) filters, each over a distinct field's values, combined with
AND and applied to the map.

```ts
interface FilterPanelConfig {
  type: 'filter';
  fields: { field: string; label?: string }[];
}
```

- `dataSource` (the shared base field) is **required** for this panel and must point at a
  `map-layer` source - its features supply both the selectable per-field dropdown values and the
  map layer the combined filter actually gets applied to.
- Each entry in `fields` becomes one dropdown; `label` overrides the field name as the dropdown's
  displayed label (defaults to the raw field name).
- The combined selection is pushed onto whichever channel(s) this panel `emits` to, and also
  applied directly to the map as a native attribute filter (via GeoView's `setLayerFiltersPanel`).

## `text`

Plain text, formatted markdown, or a remote markdown document (e.g. notes, instructions, a
changelog fetched from a CMS/repo).

```ts
interface TextPanelConfig {
  type: 'text';
  content?: string; // inline text; required unless `contentUrl` is set
  contentUrl?: string; // fetches a remote document instead of `content` - always rendered as markdown
  format?: 'plain' | 'markdown'; // how `content` is rendered; defaults to 'plain'
}
```

- Plain text (default): `content` is shown as-is, no formatting applied.
- `format: 'markdown'`: `content` is rendered as markdown (headings, bold/italic, lists, links,
  tables, code blocks - [GitHub-flavored](https://github.github.com/gfm/), via `remark-gfm`).
- `contentUrl`: fetches that URL's text and renders it as markdown, regardless of `format` - use
  this to point at a `.md` file hosted anywhere (a repo's raw file URL, a CMS, etc.) instead of
  pasting its contents inline. `content` is ignored while `contentUrl` is set.
- Raw HTML embedded in markdown is NOT rendered (intentionally, to avoid a script-injection risk
  when `contentUrl` points at content the dashboard author doesn't fully control) - only genuine
  markdown syntax is converted to formatting.

## `tab`

Not itself a leaf panel - splits one grid cell into multiple panels the viewer switches between
with a tab strip (only one visible at a time).

```ts
interface TabPanelConfig {
  type: 'tab';
  tabs: { id: string; label: string; panel: LeafPanelConfig }[];
}
```

Each `tabs[].panel` is any leaf panel type (`map`/`chart`/`stat`/`table`/`legend`/`filter`/
`text`) **without** its own `layout` - its position is the whole `tab` panel's single grid cell.
Nesting a `tab` inside another `tab`'s tabs isn't supported.

## `stack`

Also not a leaf panel - splits one grid cell into multiple panels shown **together** side by
side (unlike `tab`, which switches between them), with a resizable divider between them.

```ts
interface StackPanelConfig {
  type: 'stack';
  direction?: 'row' | 'column'; // default 'column'
  sizes?: number[]; // relative weights, default: all equal
  items: LeafPanelConfig[];
}
```

Each `items[]` entry is any leaf panel type, again without its own `layout`. Nesting a `tab` or
`stack` inside a `stack`'s items isn't supported. A common use: two small `stat` panels sharing
one grid cell that doesn't need a whole row/column each (see [Full Example](guide/full-example.md)).
