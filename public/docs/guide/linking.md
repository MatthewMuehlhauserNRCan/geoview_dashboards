# Linking (cross-panel filtering)

Panels don't reference each other directly - they publish/subscribe to named **channels**, a
simple shared pub/sub mechanism. A channel carries one combined value: a set of selected values
per field (e.g. `{ "Symbol": ["Natural", "Developed"] }`) - every contributing panel's selection
for its own field(s) is merged into the same object. **A channel is not bound to one field** - any
number of panels can each contribute their OWN differently-named field onto the same channel; the
combined object just grows one more key per contributor. There's no technical need for "one
channel per field" or "one channel per data source" - reach for a new channel only when two
contributors' values would genuinely conflict if merged (see the dual-value-space note below).

## Declaring channels

```ts
interface LinkingConfig {
  channels: { id: string; type: 'filter'; description?: string }[];
}
```

Declared once at the top level (`DashboardConfig.linking.channels`) - `description` is a plain
freeform note for your own reference (shown in the editor's Linking section), not read by the app
at runtime and not a binding to any particular field. A panel actually joins a channel via its own
`interactions.emits`/`listensTo` (an array of channel ids), not anything in this top-level list.

## Emitting and listening

Every panel's shared `interactions` field:

```ts
interactions?: {
  emits?: string[]; // channels this panel publishes to
  listensTo?: string[]; // channels this panel reacts to
}
```

- `filter` panels and `legend` panels **emit** - their dropdown selections / checked legend items
  push onto the channel(s) in `emits`.
- `chart` panels both emit (clicking a bar/slice toggles that category on the channel) and
  implicitly read back from the same channel to highlight the currently-selected bar/slice(s).
- `stat` and `table` panels only **listen** - they filter their own rows down to whatever
  matches every field currently set across all their `listensTo` channels combined (a panel can
  listen to more than one channel at once; their contributions are merged together).
- A `map` panel can also **listen** - if a `chart` panel is in [multi-source mode](guide/panels.md)
  and `emits` onto a channel the map `listensTo`, selecting bars/slices there shows only the
  corresponding `map-layer`-backed layers on that map, hiding every OTHER layer backed by a data
  source that's part of that SAME chart's own `sources` list - a layer backed by a data source
  the chart never listed is left untouched regardless of what's selected, using a reserved field
  key rather than a real row field - don't reuse that same channel for a normal row-field filter
  too (see the dual-value-space note below).
- A `map` panel can also **emit** - with `interactions.emits` set, it publishes its current view
  extent onto those channel(s) on every pan/zoom (see "Filtering other panels to the current map
  view" under `map` in [Panels](guide/panels.md)). `chart`/`table` panels listening to the same
  channel can restrict their own rows to the current map view (`filterToMapView`, on by default).
  Unlike the legend's own channel caveat below, this one's reserved field is safe to share with a
  normal filter/chart channel at the same time (e.g. `cesi-filter` carrying both a filter panel's
  own field selections AND the map's view extent) - it's never swept into per-row field matching.
- A panel's `dataSource` is independent of its channels - a panel only reacts to a channel's
  *values*, it never assumes those values came from its own data source.

## A worked example

```json
{
  "linking": {
    "channels": [{ "id": "cesi-filter", "type": "filter", "field": "Symbol" }]
  },
  "pages": [
    {
      "panels": [
        {
          "id": "panel-filter",
          "type": "filter",
          "dataSource": "cesi-layer",
          "fields": [{ "field": "E_Regulated" }],
          "interactions": { "emits": ["cesi-filter"] }
        },
        {
          "id": "panel-stat",
          "type": "stat",
          "dataSource": "cesi-layer",
          "interactions": { "listensTo": ["cesi-filter"] }
        }
      ]
    }
  ]
}
```

Selecting a value in the filter panel's `E_Regulated` dropdown narrows the stat panel's count to
matching rows, and also applies the same filter to the map (a `filter` panel always pushes its
combined selection directly to the map as a native attribute filter, in addition to the channel).

## Important caveat: legend channels and domain-coded fields

A `legend` panel's items are usually best kept on their **own, separate** channel from any
`filter`/`chart` panel's channel, rather than sharing one - **don't just reuse the same channel
id for convenience.** Here's why:

- A `filter`/`chart` panel's selection is applied to the map's own native backend filter (a
  SQL-like WHERE expression), which needs the **raw, stored attribute value** for a field.
- A `legend` item's selection, pushed by this app, uses the **display label** instead, to match
  what `table`/`chart`/`stat` panels' own row data actually contains (GeoView's own feature
  queries return alias/domain-translated display values, not raw codes, for a classified field -
  see the architecture notes if you want the full technical reason).
- For a field backed by an ESRI coded-value domain (common for a symbology/classification
  field), these two representations genuinely differ (e.g. the stored value might be a numeric
  code `3`, while the display label is `"Natural"`) - sharing one channel between a `legend` panel
  and a `filter`/`chart` panel for that kind of field can silently break one side or the other.
- The map's own visual state for a legend toggle is already handled correctly without the
  channel at all (via GeoView's native per-item visibility API) - the legend's channel is purely
  for letting `table`/`chart`/`stat` panels react to the same selection, so giving it a separate
  channel id costs nothing.

See [Full Example](guide/full-example.md) for this pattern in practice (`"cesi-filter"` for the
filter/chart panels, `"cesi-legend-filter"` for the legend, with `table`/`chart`/`stat` listening
to both).
