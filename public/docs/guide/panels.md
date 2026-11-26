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
  field?: string; // field to group rows by (a NUMERIC field to bin, for 'histogram')
  aggregation?: 'count' | 'sum' | 'avg' | 'min' | 'max'; // defaults to 'count'
  valueField?: string; // numeric field to aggregate; required (and only used) when aggregation isn't 'count'
  seriesField?: string; // splits each group into one series per distinct value of this field
  sources?: { dataSourceId: string; label?: string; color?: string }[]; // multi-source mode, see below
  colors?: Record<string, string>; // color overrides, keyed by raw field (or seriesField) value
  legendPosition?: 'top' | 'right' | 'bottom' | 'left' | 'none'; // defaults to 'right' for pie, 'top' otherwise
  showSliceLabels?: boolean; // 'pie' only - labels each slice directly with its category name
  showValueLabels?: boolean; // draws each bar/segment/point/slice's value on the chart
  stacked?: boolean; // bar/line/histogram with several series - stack them
  horizontal?: boolean; // bar/histogram - horizontal bars
  sort?: 'label' | 'value-asc' | 'value-desc'; // category order, defaults to 'label'
  limit?: number; // keep the first N categories (after sort), fold the rest into "Other"
  bins?: number; // 'histogram' only - number of equal-width bins, defaults to 10
  xField?: string; // scatter x / ungrouped label column - auto-detected when omitted
  yField?: string; // scatter y / ungrouped value column - auto-detected when omitted
  xAxisTitle?: string; // overrides the auto-generated horizontal axis title ('' hides it)
  yAxisTitle?: string; // overrides the auto-generated vertical axis title ('' hides it)
  filterToMapView?: boolean; // defaults to true - see "Filtering other panels to the current map view" above
}
```

- `field`: for `bar`/`line`/`pie`, groups rows by this field's distinct values (e.g. one bar per
  distinct `"Symbol"` value). Without it, these chart types fall back to one bar/point/slice per
  raw row, labelled by `xField` and sized by `yField` (auto-detected as the first text and first
  numeric field when omitted) - only sensible for an already-small row set.
- `aggregation` (only applies when grouping): `'count'` (default) counts rows per group;
  `'sum'`/`'avg'`/`'min'`/`'max'` aggregate `valueField` within each group instead (e.g. average
  population per region rather than a feature count per region).
- `seriesField`: splits every `field` group into one **series** (dataset) per distinct value of a
  second field - side-by-side bars, one line per value, or stacked bars with `stacked: true`.
  Each series gets one color (overridable via `colors`, keyed by the series value), and the legend
  lists the series. Ignored by `pie`.
- `sort`/`limit`: categories are ordered by label by default (numerically when every label is a
  number). `'value-desc'`/`'value-asc'` orders them by their value instead - with several series,
  by the combined value across all of them (e.g. a stacked bar's total height). `limit` keeps only
  the first N categories after sorting and folds the rest into one grey **"Other"** category
  (re-aggregated from those rows, so averages stay correct). "Other" can't be clicked.
- `histogram`: bins a **numeric** `field` into `bins` equal-width ranges (default 10) spanning
  its min-max, then counts (or `aggregation`s) the rows in each bin. Bins stay in numeric order
  (`sort`/`limit` don't apply) and keep their edges while other panels filter the chart. Clicking
  a bin doesn't select anything. If `field` isn't numeric, it falls back to plain grouping like `bar`.
- `scatter` plots `yField` against `xField` (auto-detected as the first two numeric fields when
  omitted); `seriesField` splits it into one colored point cloud per value. `field`/`aggregation`
  don't apply.
- Colors: without a `seriesField`, each category (bar/slice) gets its own distinct color
  automatically - a single `line`/`histogram`/`scatter` keeps one flat color instead. `colors`
  overrides specific values by their exact raw value (e.g. `{ "Natural": "#4caf50" }`) - any value
  not listed still gets its own auto-assigned color. Ignored in multi-source mode (use
  `sources[].color` there instead). Prefer hex/`rgb()`/`hsl()` values - CSS named colors like
  `"red"` render fine but don't fade when another category is selected.
- `showValueLabels` draws each value directly on its bar (centered in each stacked segment),
  above each line point, or inside each pie slice. Bar labels that don't fit inside their segment
  are skipped automatically, as are zero values.
- `legendPosition`/`showSliceLabels`: a pie chart's auto-generated one-entry-per-slice legend can
  get crowded above the chart with many categories - `legendPosition` moves it to a side (stacks
  vertically) or hides it (`'none'`), and `showSliceLabels` labels each slice directly as an
  alternative (most useful combined with `legendPosition: 'none'`). Both can be combined however
  you like. Only `'pie'` honors `showSliceLabels`; every chart type honors `legendPosition`.
- `xAxisTitle`/`yAxisTitle` refer to the **visual** axes (x is always horizontal, even for
  `horizontal` bars). They default to the grouping field and the aggregation (e.g. "Count",
  "Average of population"); set `""` to hide one.
- Clicking a bar/slice/point toggles that category in/out of the selection (multiple can be
  selected at once) in whichever channel this panel `emits` to (see [Linking](guide/linking.md)) -
  clicking an already-selected one again removes just that one. With a `seriesField`, a click
  selects the **category** (`field` value), not the series. A "Clear selection" button appears
  whenever anything is selected.
- `filterToMapView` (default `true`): when this panel `listensTo` a channel a map panel is
  publishing its view extent onto, restricts the chart's own rows to just the current map view -
  see "Filtering other panels to the current map view" under `map` above. Ignored entirely when no
  such channel is listened to. Applies in multi-source mode too (each source's rows are
  restricted before being charted).

### Example: stacked bars by category and status

One bar per agency, stacked by fire status, with fixed status colors, counts drawn on each
segment and the legend underneath:

```json
{
  "id": "fires-by-agency",
  "type": "chart",
  "title": "Active Fires Status by Agency",
  "dataSource": "active-fires",
  "chartType": "bar",
  "field": "agency",
  "seriesField": "status",
  "stacked": true,
  "showValueLabels": true,
  "legendPosition": "bottom",
  "colors": {
    "Under Control": "#5b5bff",
    "Being Held": "#e5e526",
    "Out of Control": "#ff1a1a"
  }
}
```

Add `"sort": "value-desc"` to put the agency with the most fires first, or `"horizontal": true`
for horizontal bars.

### Multi-source mode

Instead of one `dataSource`, `sources` pulls each entry's **own** data source - useful for e.g.
the sublayers of a group layer (several `map-layer` data sources pointed at the same map panel).
`dataSource` is ignored when `sources` is set. What it draws depends on `field`:

- **No `field`** (or `pie`): one bar/slice per **data source**, showing its rows aggregated by
  `aggregation`/`valueField` (row count by default).
- **With `field`**: one **series** per data source, all grouped by `field` on shared axes - e.g.
  side-by-side or `stacked` bars comparing each sublayer's feature count per category.
  `aggregation`, `sort`, `limit` and `histogram` binning all work the same as single-source mode.
- **`scatter`**: one point cloud per data source (`xField`/`yField` or auto-detected).

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

Without a `field`, clicking toggles that **source** in/out of the selection, emitted on this
panel's channel as a reserved field (not a real row field) carrying the selected data source ids.
A `map` panel that `listensTo` the same channel will show only the selected sources' layers,
hiding every OTHER layer backed by a data source listed in this chart's own `sources` - a layer
backed by a data source that ISN'T one of this chart's `sources` is left alone regardless of
what's selected, and everything shows again once the selection is cleared/empty. With a `field`,
clicking selects that `field` value instead, the same as a single-source chart.

Each entry's `color` overrides its auto-assigned color (the bar's color without a `field`, or the
whole series' color with one), same as the single-source `colors` map above.

Each entry's label (bar label, or series name in the legend) defaults to that data source's
underlying map layer name (for `map-layer` sources) or its id otherwise - `label` overrides this
per entry.

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

Plain text, formatted markdown, a remote markdown document (e.g. notes, instructions, a
changelog fetched from a CMS/repo), or a markdown template filled in from a data source row (e.g.
combining several header/body fields from one feature of a shared service into one formatted
panel).

```ts
interface TextPanelConfig {
  type: 'text';
  content?: string; // inline text; required unless `contentUrl` or `template` is set
  contentUrl?: string; // fetches a remote document instead of `content` - always rendered as markdown
  template?: string; // markdown with {{FieldName}} placeholders, filled from `dataSource`'s row(s)
  repeatTemplate?: boolean; // repeat `template` per row (default true) or use only the first row
  emptyContent?: string; // markdown shown instead of `template` when `dataSource` has zero rows
  format?: 'plain' | 'markdown'; // how `content` is rendered; defaults to 'plain'
}
```

- Plain text (default): `content` is shown as-is, no formatting applied.
- `format: 'markdown'`: `content` is rendered as markdown (headings, bold/italic, lists, links,
  tables, code blocks - [GitHub-flavored](https://github.github.com/gfm/), via `remark-gfm`).
- `contentUrl`: fetches that URL's text and renders it as markdown, regardless of `format` - use
  this to point at a `.md` file hosted anywhere (a repo's raw file URL, a CMS, etc.) instead of
  pasting its contents inline. `content` is ignored while `contentUrl` is set.
- `template`: fetches `dataSource` (the panel's own top-level data source field, shared with every
  other panel type) and substitutes `{{FieldName}}` placeholders in the template string with
  values from its row(s) - always rendered as markdown, and takes priority over
  `content`/`contentUrl` if more than one is set. A missing field renders as an empty string. If
  `dataSource` returns more than one row, `repeatTemplate` (default `true`) renders the template
  **once per row**, each copy joined by a markdown rule (`---`); set it to `false` to render the
  template only once, against the first row, ignoring the rest. If `dataSource` returns **zero**
  rows (e.g. a `where=` clause matched nothing), `emptyContent` is rendered instead, if set -
  without it, `template` still renders once against an empty row (every `{{field}}` comes out
  blank, which is usually not what you want, so setting `emptyContent` is recommended whenever a
  template's data source could plausibly return no rows). This is the way to combine several
  fields from one record into one panel, e.g.:
  ```ts
  {
    type: 'text',
    dataSource: 'national-weather-overview', // a rest-json source whose own URL already
                                              // filters to ONE feature, e.g. an ArcGIS query
                                              // endpoint with `where=display_PageTitle_EN=...`
    template: '## {{Header1_EN}}\n\n{{Text1_EN}}\n\n## {{Header2_EN}}\n\n{{Text2_EN}}',
    emptyContent: 'No overview is currently available.',
  }
  ```
  If several panels need different single features from the *same* underlying service, give each
  panel its own `rest-json` data source with the `where=`/filter baked into that source's own
  `url` - a data source is just a URL, there's no separate per-panel query/filter config. A
  `rest-json` source pointed at an ArcGIS `query` endpoint is automatically unwrapped from its
  `{ features: [{ attributes: {...} }] }` response shape into plain rows.
- **Conditional sections**: wrap part of a template in `{{#FieldName}}...{{/FieldName}}` to show
  that whole section (including its own header/wording, not just the field's own value) only when
  `FieldName` actually has a value on the row - empty/missing/blank hides the entire section,
  tags and all. A real `0` or `false` value still counts as present. Useful for e.g. hiding a
  "Current or Projected Activities" header entirely when there's nothing to report that day:
  ```
  {{#Activities}}
  **Current or Projected Activities**
  {{Activities}}
  {{/Activities}}
  ```
  Sections can sit side by side or nest (a differently-named section inside another), but a
  section can't nest inside ANOTHER section of the *same* name.
- **Line breaks**: a `template` (unlike `content`/`contentUrl`) renders every single `\n` as a
  real line break, not just a double `\n\n` (standard markdown otherwise collapses a lone
  newline into just a space, which is easy to trip over when a template's own header/value lines
  are only one newline apart, e.g. `'**Activation Level**\n{{ActivationLevel}}'` - this is exactly
  what makes that render as two lines instead of one run-on sentence).
- Raw HTML embedded in markdown is NOT rendered (intentionally, to avoid a script-injection risk
  when `contentUrl`/`template` points at content the dashboard author doesn't fully control) - only
  genuine markdown syntax is converted to formatting.

## `image`

One image (e.g. a logo, photo, diagram, or legend graphic that isn't tied to a map layer), or
several images shown as a carousel. Clicking an image opens it full screen (a lightbox).

```ts
interface ImagePanelConfig {
  type: 'image';
  // either a single image via the shorthand fields...
  src?: string; // image URL (or data URI)
  alt?: string; // accessibility text; defaults to empty (decorative)
  link?: string; // optional URL opened in a new tab when the image is clicked
  // ...or a list of images (takes priority over src/alt/link when both are set)
  images?: Array<{
    src: string;
    alt?: string;
    caption?: string; // shown over the bottom of the image and in the lightbox
    link?: string;
    title?: string; // replaces the panel's own title while this image is showing
  }>;
  fit?: 'contain' | 'cover' | 'fill'; // like CSS object-fit; defaults to 'contain'
  lightbox?: boolean; // click to view full screen; defaults to true
  autoplay?: boolean; // carousel only: auto-advance, with a pause button; defaults to false
  autoplaySeconds?: number; // carousel only: seconds per image while autoplaying; defaults to 5
}
```

- One of `src` or `images` is required.
- `fit: 'contain'` (default) shows the whole image, letterboxed if its aspect ratio doesn't match
  the panel; `'cover'` fills the panel and crops any overflow; `'fill'` stretches the image to
  the panel's exact size, ignoring aspect ratio. The lightbox always shows the whole image.
- **Lightbox**: clicking an image opens it full screen. Close it with the close button or
  <kbd>Esc</kbd>. Set `lightbox: false` to turn this off.
- `link` makes an image open that URL in a new tab when clicked, instead of opening the lightbox.
  The lightbox is still available from the full-screen button in the panel's corner, and the
  lightbox shows an "open link" button.
- **Carousel**: with more than one entry in `images`, the panel shows previous/next buttons and
  a dot for each image. The left/right arrow keys also work, in the panel and in the lightbox.
  Moving between images in the lightbox also changes the image shown in the panel.
- Each image's `title` replaces the panel's own `title` in the header (and the lightbox) while
  that image is showing - e.g. for a carousel of several sites where the title names the one
  currently visible. Images without their own `title` fall back to the panel's `title`.
- `autoplay: true` advances to the next image every `autoplaySeconds` and shows a play/pause
  button. Previous/next buttons still work. Autoplay also pauses while the pointer is over the
  carousel, while keyboard focus is inside it, and while the lightbox is open. It starts paused
  for users whose system is set to reduce motion.

```json
{
  "id": "site-photos",
  "type": "image",
  "title": "Monitoring sites",
  "fit": "cover",
  "autoplay": true,
  "autoplaySeconds": 6,
  "images": [
    { "src": "https://example.com/site-a.jpg", "alt": "Site A", "caption": "Spring survey", "title": "Site A" },
    { "src": "https://example.com/site-b.jpg", "alt": "Site B", "caption": "River outlet", "title": "Site B" }
  ]
}
```

## `cards`

A responsive grid of flip-style cards - either a fixed, manually-authored list, or one card
auto-generated per row of `dataSource` - e.g. one card per organization. `columns` fixes how many
show per row on wide screens (still naturally wraps to fewer on narrower ones, down to a single
stacked column at phone width); omit it for a fully responsive auto-fit grid instead.

Each card has a **front** and a **back**, swapped by hovering the card (desktop) or tapping its
own expand icon (touch only - a real pointer device already reveals the back on hover alone, so
the icon doesn't show there at all):
- **Front**: a colored band (`color`, always shown) containing `icon` - sized smaller than the
  band itself and centered, not stretched edge-to-edge - which is expected to already contain the
  card's own branding/title baked into the graphic (e.g. a logo + organization name) on a
  transparent background, so the band's own color shows around it. A card with no `icon` shows
  the title as text in the band instead. Directly below: `summary`, which stays visible on BOTH
  the front and the back (it never swaps away). The front's own content is what fixes this card's
  height.
- **Back**: the title re-appears here as plain text (since the image itself isn't shown anymore),
  followed by `summary` again and then `detail`. It slides up to cover the front rather than
  growing the card to fit - if its content is taller than the front, it scrolls internally instead
  of changing this card's (or its whole grid row's) size. A card with neither `icon` nor `detail`
  has nothing to flip to, so it's shown statically with no hover/tap affordance at all.

```ts
interface CardsPanelConfig {
  type: 'cards';
  // a fixed list, authored directly - takes priority over dataSource-driven cards below when set
  cards?: Array<{ title: string; summary?: string; detail?: string; icon?: string; color?: string }>;
  columns?: number; // cards per row on wide screens; omit for a fully responsive auto-fit grid
  // required (along with dataSource) when `cards` above is unset/empty:
  titleField?: string; // row field used as each card's title, and the key for cardStyles below
  requireFields?: string[]; // only rows where EVERY one of these fields has a real value become a card
  excludeValues?: Record<string, (string | number)[]>; // rows matching any listed value for a field are hidden entirely
  summaryTemplate?: string; // markdown w/ {{FieldName}} placeholders, shown under the header on BOTH faces
  detailTemplate?: string; // markdown shown on the back, under the title; omit for no flip at all
  iconField?: string; // row field holding the card's full header image URL, if the data source provides one
  colorField?: string; // row field holding the fallback band's background color, if provided
  cardStyles?: Record<string, { icon?: string; color?: string }>; // per-card fallback, keyed by titleField's value
  // used by both modes:
  defaultIcon?: string; // fallback header image when nothing else (row/manual card/cardStyles) supplies one
  defaultColor?: string; // fallback band color; falls back further to the theme's primary color
  emptyText?: string; // shown instead of the (empty) grid when there are zero cards to show
}
```

- **Manual mode** (`cards` set, non-empty): each entry's own `summary`/`detail` is plain markdown
  (no `{{FieldName}}` templating - there's no row to fill in from) - use this for a handful of
  one-off cards with no backing data source at all, or content a service can't provide (mixing
  freely with `defaultIcon`/`defaultColor` as a per-entry fallback). `dataSource` and every
  `*Field`/`*Template` field below are ignored while `cards` is set.
- **Data-driven mode** (`cards` unset/empty, `titleField` + `dataSource` set): point `dataSource`
  at a `rest-json`/`static-file` source returning ALL the rows you want cards for (e.g. every
  organization in one feature-service query) - **one shared data source, not one per card** - the
  panel renders one card per row. This is the key difference from a `text` panel's `template`,
  which is meant for ONE feature per panel; `cards` is meant for MANY features in one panel, from
  one shared fetch. `summaryTemplate`/`detailTemplate` use the exact same `{{FieldName}}` markdown
  templating as a [text panel's `template`](#text) - INCLUDING `{{#FieldName}}...{{/FieldName}}`
  conditional sections - filled in per-row.
- **Excluding rows** (data-driven mode): `requireFields` drops a row entirely if it's missing a
  real value for ANY of the listed fields (e.g. a mostly-null placeholder row - just a title,
  everything else blank - is hidden until its real content field is actually populated, then
  appears automatically). `excludeValues` drops a row whose field exactly matches one of a known
  list of values (e.g. hide one specific row by its exact title). Both apply independently - a row
  failing either check is hidden.
- **Icon/color** (data-driven mode): checked in this order per card: (1) `iconField`/`colorField`
  read straight from that row, if the data source happens to provide them; (2)
  `cardStyles[titleField's value]`, an author-maintained map for data sources that don't have
  icon/color fields (so you don't need a separate data source or column just for styling); (3)
  `defaultIcon`/`defaultColor`.
- Like every panel, `dataSource` is just a URL/fetch - if the underlying service also has other
  consumers (e.g. a `text` panel showing one filtered feature), that's a completely separate data
  source entry pointed at a differently-filtered URL (see [Data Sources](data-sources.md)); this
  panel's own `dataSource` should return the FULL set of rows you want cards for, unfiltered.

```json
{
  "id": "federal-activities",
  "type": "cards",
  "dataSource": "federal-activities-all",
  "titleField": "AgencyName",
  "summaryTemplate": "**Activation Level**\n{{ActivationLevel}}",
  "detailTemplate": "**Current or Projected Activities**\n{{Activities}}",
  "cardStyles": {
    "Canada Border Services Agency": { "icon": "https://example.com/cbsa.svg", "color": "#9c1f28" },
    "Canadian Food Inspection Agency": { "icon": "https://example.com/cfia.svg", "color": "#2e7d32" }
  },
  "emptyText": "No federal activities to report."
}
```

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
`text`/`image`) **without** its own `layout` - its position is the whole `tab` panel's single
grid cell. Nesting a `tab` inside another `tab`'s tabs isn't supported.

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
