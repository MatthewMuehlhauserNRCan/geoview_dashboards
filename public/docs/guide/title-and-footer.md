# Title & Footer

Three separate, independent pieces sit around the main grid - none of them are `panel`s (no
`type`, no `layout`, not placed in the col/row system).

## Title element (dashboard-wide, fixed)

A non-resizable header bar above everything else, including the title panel below.

```ts
interface TitleElementConfig {
  image?: { src: string; alt?: string; href?: string }; // left-side logo, optionally a link
  title: string;
  subtitle?: string;
  backgroundColor?: string;
  optionsMenu?: {
    icon?: { src: string; alt?: string };
    label?: string;
    // defined once, shared by every option below
    targets?: { id: string; label?: string; channel: string; field: string; dataSources?: string[] }[];
    options: {
      id: string;
      label: string;
      values?: Record<string, string[]>; // keyed by target id
    }[];
  };
  hamburgerMenu?: {
    links?: { id: string; label: string; href: string }[];
    notice?: { label: string; title: string; content: string }; // opens a plain-text modal
  };
}
```

Set once at the top level (`DashboardConfig.titleElement`) - shared across every page, unlike the
title panel below.

`optionsMenu.targets` makes an option clickable as a filter preset: each **target** defines WHERE
a value lands - a channel + field (same shape any panel's selection would push onto a
[linking](guide/linking.md) channel) - defined once and shared by every option, instead of
repeating that shape per option. Each **option** then just supplies a short `values` list per
target (keyed by the target's `id`). Selecting an option sets every target's channel/field to that
option's `values[target.id]` (or clears it, if omitted). Options in the same menu behave like a
radio group - at most one is "active" at a time, shown with a checkmark; selecting a different
option clears every *other* option's values first, and clicking the already-active option again
clears it (back to unconstrained/show-all). An option with no matching `values` entry for a given
target just clears that target.

`targets[].dataSources` is optional and purely a note-to-self (shown as a multi-select in the
editor) - it documents which data source(s) share this target's exact `field` name AND value
representation, but it is NOT applied at runtime; only `channel`/`field` are. If your data sources
use **different field names** (or different value representations) for what's conceptually the
same filter (e.g. one layer's `AGENCY_NAME` vs. another's `AGENCY_CODE`), give each one its **own
target**, each on its **own, separate channel** (and make sure only that data source's panels
`listensTo` it) - same pattern as the legend panel's channel split described in
[Linking](guide/linking.md#important-caveat-legend-channels-and-domain-coded-fields). Putting two
different fields for two different data sources on the *same* channel instead will AND them
together (a channel's fields are all required to match - see `rowMatchesFieldFilter`), emptying
out any panel whose rows don't have *every* one of those fields.

## Title panel (per-page, resizable)

A thin, full-width strip below the title element: left text / optional centered image / right
text, any of which may be omitted.

```ts
interface TitlePanelConfig {
  left?: string;
  image?: { src: string; alt?: string; href?: string };
  right?: string;
  backgroundColor?: string;
}
```

Set per-page (`DashboardPageConfig.titlePanel`) - different pages can show different title-panel
text, or omit it entirely. Starts sized to its content and only becomes a fixed height once a
viewer drags its bottom edge (so it doesn't force every page to reserve space for it). If its
content is actually meant to be the **same on every page**, just author it identically on each
page (the editor's "Apply to all pages" button, next to this section, copies one page's title
panel onto every other page so you only have to edit it in one place).

## Page heading (per-page, plain)

A simple, non-resizable single line of text below the title panel - unlike the title panel's
left/image/right layout, this is just one line, meant for content that genuinely changes per page
(e.g. naming the current page/section).

```ts
interface PageHeadingConfig {
  text: string;
  align?: 'left' | 'center' | 'right'; // defaults to 'center'
  textColor?: string;
  backgroundColor?: string;
}
```

Set per-page (`DashboardPageConfig.pageHeading`).

## Data values in titles (`templateValues`)

Any title text - the title element's `title`/`subtitle`, a title panel's `left`/`right`, and a
page heading's `text` - can include values pulled from a data source. Declare each value once,
by name, at the top level (`DashboardConfig.templateValues`, shared by every page), then
reference it as `{{$id}}`:

```ts
interface TemplateValueConfig {
  id: string; // letters, digits, `_` and `-` only; unique - referenced as {{$id}}
  dataSource: string; // a DataSourceConfig id
  aggregation?: 'first' | 'count' | 'sum' | 'avg' | 'min' | 'max'; // defaults to 'first'
  field?: string; // required unless aggregation is 'count'
  decimals?: number; // fixed decimal places for a numeric result; omitted = value as-is
  listensTo?: string[]; // linking channels whose filters are applied first
}
```

```ts
templateValues: [
  { id: 'siteCount', dataSource: 'cesi-layer', aggregation: 'count', listensTo: ['cesi-filter'] },
  { id: 'avgLevel', dataSource: 'cesi-layer', aggregation: 'avg', field: 'Level', decimals: 1 },
  { id: 'updated', dataSource: 'metadata', field: 'LastUpdated' },
],
titleElement: {
  title: 'Water Quality',
  subtitle: '{{$siteCount}} sites · average level {{$avgLevel}} · updated {{$updated}}',
},
```

- `'first'` takes `field` from the first row, unchanged (text or number). This is most useful with a
  data source that already returns just the one row you want (e.g. a `where=` in its URL).
- `'count'` counts rows; `sum`/`avg`/`min`/`max` aggregate a numeric `field` across them (same
  rules as a [stat panel](guide/panels.md#stat)).
- `listensTo` filters the rows by those [linking](guide/linking.md) channels first, exactly like a
  panel's own `interactions.listensTo` - so e.g. a count in the title updates as the viewer
  filters the map/chart.
- Values are shown exactly as the data provides them (no thousands separators, no rounding)
  unless `decimals` is set, which fixes numeric values to that many decimal places.
- A value is empty while its data source is loading, when there are no rows (`first`), or when
  there's nothing numeric to aggregate (`avg`/`min`/`max`). Wrap text in
  `{{#$id}}...{{/$id}}` to hide it entirely while the value is empty, e.g.
  `'{{#$siteCount}}{{$siteCount}} sites · {{/$siteCount}}Updated daily'`.

The same `{{$id}}` placeholders also work in a [text panel's `template`](guide/panels.md#text) and
a cards panel's `summaryTemplate`/`detailTemplate`. The `$` is what keeps them apart from those
templates' own `{{FieldName}}` row placeholders, so the two never collide.

In the editor, manage these under **Values** in the toolbar.

## Footer (automatic, not configured)

A row of tabs, one per page, letting a viewer switch between them - shown automatically whenever
`DashboardConfig.pages` has more than one entry. There's no separate config for it: a page's own
`label` is what appears on its tab.
