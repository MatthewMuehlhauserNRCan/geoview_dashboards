# Data Sources

Panels don't fetch data themselves - they reference an entry in the top-level `dataSources`
array by `id` via their own `dataSource` field. There are 3 types.

## `rest-json`

Fetches a JSON array from a URL.

```ts
interface RestJsonDataSourceConfig {
  id: string;
  type: 'rest-json';
  url: string;
  auth?: { type: 'none' }; // token-based auth isn't implemented yet - only 'none' exists
  refresh?: { mode: 'static' | 'interval'; seconds?: number };
}
```

- `refresh.mode: 'static'` (or omitted): fetched once.
- `refresh.mode: 'interval'`: re-fetched every `seconds` (default `60`) while any panel using it
  is mounted.

## `static-file`

Fetches and parses a CSV, JSON, or Excel file from a URL. Always fetched once (no refresh modes).

```ts
interface StaticFileDataSourceConfig {
  id: string;
  type: 'static-file';
  format: 'csv' | 'json' | 'excel';
  url: string;
}
```

## `map-layer`

Reads features directly from a vector layer already loaded in one of the dashboard's own `map`
panels, instead of making a separate network request.

```ts
interface MapLayerDataSourceConfig {
  id: string;
  type: 'map-layer';
  mapPanelId: string; // must match a `map` panel's own `id`
  layerId: string; // the layer's full layerPath: geoviewLayerId + "/" + layerEntry id
}
```

`layerId` is GeoView's own `layerPath` format - for a `map` panel's
`config.map.listOfGeoviewLayerConfig` entry with `geoviewLayerId: "myLayer"` and a
`listOfLayerEntryConfig` entry with `layerId: "0"`, the full path is `"myLayer/0"`. The
[editor](../editor.html)'s data source form discovers this for you automatically once you've
previewed the map panel there, instead of requiring you to work it out by hand.

Only vector layers whose individual features can be read are usable this way (raster/tile layers
report as non-queryable and are rejected with a clear error) - a `filter`/`legend`/table's "zoom
to feature" all specifically require this data source type, since they need a real map
feature/layer behind the data, not just arbitrary rows.
