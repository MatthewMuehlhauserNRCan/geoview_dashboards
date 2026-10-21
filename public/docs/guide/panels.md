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

## `chart`

Renders a bar/line/pie/scatter/histogram chart (Chart.js) from its `dataSource`'s rows.

```ts
interface ChartPanelConfig {
  type: 'chart';
  chartType: 'bar' | 'line' | 'pie' | 'scatter' | 'histogram';
  field?: string; // categorical field to group rows by
  aggregation?: 'count' | 'sum' | 'avg' | 'min' | 'max'; // defaults to 'count'
  valueField?: string; // numeric field to aggregate; required (and only used) when aggregation isn't 'count'
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
- Clicking a bar/slice toggles that category on/off in whichever channel this panel `emits` to
  (see [Linking](guide/linking.md)) - clicking the same one again clears the selection.

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
}
```

- `showZoomToFeature`: only relevant when `dataSource` is a `map-layer` source. Adds a "zoom to
  feature" row action that pans/zooms the map to a clicked row's feature and highlights it.
  - Omitted (default): auto-detected - shown only when the underlying map layer has an
    identifiable id field GeoView can use to re-locate a feature (most ESRI/vector layers do).
  - `true`: always show it, even if auto-detection says it isn't possible (the button will just
    silently do nothing per row if it genuinely can't resolve a feature).
  - `false`: always hide it.
  - This is an all-or-nothing decision for the whole table, not checked per row - either every
    row gets the action, or none do, since a layer's rows all share the same schema. There's
    currently no support for a plain JSON/CSV `dataSource` (no map layer behind it) to offer this,
    even if it happens to have latitude/longitude columns.

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
