# Linking (cross-panel filtering)

Panels don't reference each other directly - they publish/subscribe to named **channels**, a
simple shared pub/sub mechanism. A channel carries one combined value: a set of selected values
per field (e.g. `{ "Symbol": ["Natural", "Developed"] }`) - every contributing panel's selection
for its own field(s) is merged into the same object.

## Declaring channels

```ts
interface LinkingConfig {
  channels: { id: string; type: 'filter'; field: string }[];
}
```

Declared once at the top level (`DashboardConfig.linking.channels`) - `field` here is
documentation only (helps authors/the editor remember what a channel is for), not read by the
app at runtime. A panel actually joins a channel via its own `interactions.emits`/`listensTo`
(an array of channel ids), not anything in this top-level list.

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
  implicitly read back from the same channel to highlight the currently-selected bar.
- `stat` and `table` panels only **listen** - they filter their own rows down to whatever
  matches every field currently set across all their `listensTo` channels combined (a panel can
  listen to more than one channel at once; their contributions are merged together).
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
