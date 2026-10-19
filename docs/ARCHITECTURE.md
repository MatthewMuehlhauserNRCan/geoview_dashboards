# Architecture

Status: **decisions locked for v1 planning** — revisit as implementation surfaces new constraints.

## 1. Goals

- Embeddable the same way as GeoView / GeoView Stories: a bundle + JSON/YAML config dropped into a page.
- Arrange multiple panels (map + non-map) on a fixed NxM grid (e.g. 3x3, 4x4) that always fills
  the viewport — panels can span multiple cells, and column/row track sizes are user-draggable
  (like an ESRI Dashboard), but the grid itself always fills 100% of the page, never scrolls.
- Support data sources beyond map layers (REST APIs, static files, later: real-time/DB).
- Panels can be linked (cross-filtering/brushing), not just independent widgets.
- Authoring is a first-class concern: config is complex enough that hand-editing JSON isn't
  the primary authoring path — a built-in edit mode is.

## 2. Tech stack

| Concern | Choice | Notes |
|---|---|---|
| UI framework | React + TypeScript | Matches GeoView/Stories |
| UI kit | MUI | Reuse GeoView's component look/feel |
| Map | GeoView core map package (dependency, not reimplemented) | Map panel config passes straight through to GeoView |
| Charts | `chart.js` + `react-chartjs-2` | Matches geoview-geochart's underlying engine; bar/line/pie/scatter built in |
| Layout engine | `react-resizable-panels` (`Grid`/`Cell`/`Gridline`) | Fixed `columns`/`rows`, draggable tracks that never divide a spanning cell |
| State / event bus | Zustand + small pub/sub channel model | Needed for cross-panel linking |
| Data fetching/caching | TanStack Query | Polling, caching, retry for external sources |
| Config validation | Zod (runtime) + JSON Schema (authoring + docs) | Fail fast with author-friendly errors |
| Build | Vite, library mode → UMD/ESM | Same embed model as GeoView |

## 3. Grid / layout

- Fixed NxM grid (e.g. 3x3, 4x4, or any author-chosen `columns`/`rows`) that always fills
  `100%` of its container (which the `html`/`body`/`#root` chain in `index.css` in turn makes
  the full viewport) — no page scroll, no leftover space.
- Panels declare a position and span — `{col, row, colSpan, rowSpan}` (1-indexed) — so any panel
  can take up multiple cells, but the grid's `columns`/`rows` counts themselves never change at
  runtime (no adding/removing tracks outside of edit mode).
- **Track sizes are draggable** (like an ESRI Dashboard), implemented with
  [`react-resizable-panels`](https://react-resizable-panels.vercel.app/)'s `Grid`/`Cell`/
  `Gridline` API rather than a hand-rolled CSS Grid + custom drag code (an earlier version of
  this doc described the latter — superseded). This library was specifically chosen because it
  **refuses to place a resize divider across a boundary that a spanning cell crosses** — e.g. a
  panel spanning 2x2 cells never gets a "phantom" divider running through its middle, which a
  naive shared-track CSS Grid does (confirmed as a real bug in this app before switching).
  `DashboardGrid.tsx` computes, per internal grid line, the contiguous runs along the
  cross-axis that aren't blocked by a spanning cell, and renders one `Gridline` per run — so a
  boundary that's fully free gets one full-length divider, one that's partially blocked gets a
  divider only in the free segment(s), and one that's fully blocked (e.g. entirely inside a
  spanning panel) gets no divider at all.
- Relative size weights per column/row (`GridConfig.columnSizes`/`rowSizes`, like CSS `fr` units)
  feed the `Grid`'s `defaultLayout` prop as a starting point; the library manages live dragging
  itself (ephemeral per viewer, resets on reload). An author can set different starting weights
  in the config; a future edit mode would persist a viewer's drag via the library's own
  `onLayoutChanged` callback, writing back into those same config fields.
- Authoring offers **template presets** (e.g. "3x3", "4x4", "map-focus") that just pre-fill
  `columns`/`rows` and a starting panel layout — presets are a convenience, not a separate engine.
- To explore something bigger than its cell (e.g. a data table), a panel has a **fullscreen/
  lightbox action** instead of being resized — see section 4. Multiple views that don't fit
  side by side can share one cell via a **tab panel** — see section 4.

## 4. Component catalog (v1 draft)

- `map` — GeoView map instance
- `chart` — bar/line/pie/scatter/histogram
- `stat` — KPI/stat card
- `table` — sortable/filterable data grid
- `legend` — layer list / legend
- `filter` — dropdown, slider, date range, search control
- `text` — markdown/static content panel
- `tab` — holds multiple panels in one grid cell, switched via a tab bar (see below)

Time slider, gauge, and media panels are deferred post-v1.

**Fullscreen/lightbox**: every leaf panel (not `tab`, which already switches views, and not
`map`/`table`, which already ship their own fullscreen control) exposes an expand action that
opens the same panel content in a fullscreen dialog. The expand button is hidden until the panel
is hovered (or focused, for keyboard use), so it doesn't clutter the view — matching the ESRI
Dashboard convention.

**Tab panel**: `type: "tab"` holds a list of `{ id, label, panel }` tabs, each wrapping one leaf
panel (chart/table/stat/etc., minus its own `layout` — position belongs to the tab panel, not
its tabs). Nesting a tab panel inside another tab panel isn't supported, to keep authoring and
the schema simple.

## 5. Data connection infrastructure

Dashboards need data from two places: sources authors add themselves, and data that already
exists inside one of the dashboard's own map panels. Both are exposed through the same
**data source registry** so any panel (chart/table/stat/...) can consume either one identically.

- **Data source registry**: named sources in config, each with a `type`. v1 priority types:
  - `rest-json` — REST/JSON APIs (author-added)
  - `static-file` — CSV/JSON/Excel served as a file (author-added)
  - `map-layer` — reads features from a vector layer already loaded in one of the dashboard's
    map panels (see below)
  - Deferred: OGC API Features as tabular data, WebSocket/SSE real-time, DB-via-backend-proxy.
- **Per-panel query**: a panel references a `dataSource` id plus a query/transform (filter,
  group-by, aggregate, field mapping) so one source can feed multiple panels differently.
- **Refresh strategy**: `static` (load once) vs `interval` (poll every N seconds) per source.
  Push-based (websocket) sources are a later phase. `map-layer` sources are refetched on demand
  (via the query cache) rather than live-subscribed to map events for v1 — see open questions.

### Map-layer data sources

A `map-layer` source (`{ mapPanelId, layerId }`) reads features from a layer already on one of
the dashboard's own map panels, instead of making a separate network request:

- **Map registry** (`src/map/registry.ts`): a small store, keyed by map panel id, that a map
  panel registers itself into once its map has loaded (`registerMap(panelId, handle)`), and
  removes itself from on unmount. Other code looks the handle up by id — reactively via
  `useMapHandle` (React) or synchronously via `getMapHandle` (inside a data source's `fetch`).
  `useLayerReady(mapPanelId, layerId)` goes one step further: GeoView loads each configured
  layer asynchronously after the map itself registers, so a layer can legitimately be missing
  from `listLayers()` for a while even after the map handle exists — this hook resolves the
  moment that specific layer finishes loading, by subscribing to the map handle's
  `onLayerLoaded` event (backed by GeoView's real `mapViewer.layer.onLayerStatusChanged`/
  `offLayerStatusChanged` API, confirmed via its real types and verified live — status
  transitions through `registered → processing → processed → loading → loaded`), not by polling.
- **Map handle contract** (`src/map/types.ts`): whatever loads the real map (GeoView) must expose
  `listLayers(): DashboardMapLayerInfo[]`, `getLayerFeatures(layerId)`, and `onLayerLoaded(callback)`
  (returns an unsubscribe function). Each layer reports a `queryable` flag — **only vector layers
  with individually accessible features are queryable**; raster/tile layers (WMS/WMTS/tile)
  report `queryable: false` and can't be used as a data source.
- **Legend data** (2026-10-19): the `legend` panel (`src/panels/LegendPanel.tsx`) is no longer a
  placeholder. GeoView ships as one global `<script>` bundle, not an importable React component
  library, so its own built-in legend UI can't literally be embedded — instead the map handle
  exposes the underlying legend DATA (`getMapLegend(): Promise<DashboardMapLegendLayer[]>`, each
  with `{layerId, layerName, visible, items: {name, icon (base64), isVisible}[]}`) and two
  visibility setters (`setLayerVisible`, `setLegendItemVisible`), backed by GeoView's real
  `mapViewer.layer.legendsLayerSet` (`queryLegend`/`waitForLegendQueried`) and per-layer
  `layer.setVisible()`/`mapViewer.layer.setItemVisibility()` APIs — then `LegendPanel` renders its
  own plain MUI `List`, same "pull real data, render our own UI" pattern as every other panel. It
  refetches via the already-existing `onLayerLoaded` event (not a new mechanism) whenever a layer
  finishes loading, since layers can still be loading after the map handle itself first registers.
  - **Styling** intentionally matches GeoView's own legend (`legend-layer-items.tsx`/
    `legend-styles.ts`, fetched directly from their repo for reference) instead of a generic MUI
    checkbox: no checkbox control at all — a colored left border bar (green when checked, grey
    when unchecked, via our own theme's `success.main`/`grey.400` rather than GeoView's
    custom-only `geoViewColor` palette extension, which this app doesn't have) plus italic text
    for the unchecked state. The whole row is clickable to toggle, same as GeoView's.
  - `LegendPanelConfig` gained `showLayerHeaders?: boolean` (default true) — hides each layer's
    name/toggle-all header row, useful when the map has exactly one layer of interest and the
    panel's own `title` already describes it (removing the header also removes the "toggle whole
    layer" affordance for that layer, accepted as a fine tradeoff when it's hidden).
  - Cross-panel filtering (legend → other panels): toggling an item pushes which items are still
    checked onto a linking channel (`useSetChannelField`, same mechanism `FilterPanel`/
    `ChartPanel` use), using each item's display `name` directly (not a resolved raw/coded value
    — see below for why). **Two bugs found and fixed, same investigation**:
    1. The first version filtered by each item's display `name` directly — but for a classified
       field backed by an ESRI domain/coded-value (e.g. a numeric code where "Natural" is only
       the label for value `3`), the MAP's own backend/style filter (`setLayerFilter` →
       GeoView's `setLayerFiltersPanel` → `featureRespectsFilterEquation`, confirmed via
       GeoView's own `docs/programming/layer-filters.md`) evaluates against the RAW, untranslated
       OpenLayers feature attribute — so `Symbol IN ('Natural')` compared a string literal
       against a numeric column, matched zero rows, and (because `FilterPanel` combines every
       contributor's field from the shared channel into one expression it pushes to the map)
       stacked an accidental "hide everything" filter on top of the map's own correct per-item
       toggle — the "toggling any one item hides all features" symptom.
    2. The *fix* for (1) — resolving each item's raw/coded value from the style config instead of
       its display name — broke chart/table/stat instead: GeoView's own feature queries
       (`getLayerFeatures`, what those panels' row data comes from) return the DOMAIN/ALIAS-
       TRANSLATED display value for a classified field (confirmed via GeoView's own internal test
       `testEsriFeatureDomainFieldQueryValue`), i.e. the same string as the legend item's `name`
       — NOT the raw code. So a row's value for "Symbol" already IS "Natural", never the coded
       number, making the raw-value-based filter never match any row either.
    - **Root cause**: for a domain/coded-value field, the map's own native filter mechanism and
      the app's in-memory row-filtering mechanism need two genuinely INCOMPATIBLE value
      representations for the exact same field — no single shared filter value can correctly
      serve both.
    - **Fix**: split the legend onto its OWN dedicated linking channel (`"cesi-legend-filter"` in
      `sampleConfig.ts`, separate from `FilterPanel`/`ChartPanel`'s `"cesi-filter"`), carrying
      the display `name` (matching what chart/table/stat's row data actually contains).
      `FilterPanel.tsx` is untouched — it only reads `"cesi-filter"`, so the legend's channel
      never reaches `setLayerFilter`/the map at all (the map's own visual state for legend
      toggles is already fully and correctly handled independently via the native
      `setItemVisibility`/`setLayerVisible` calls, so it doesn't need anything from a channel).
      `ChartPanel`/`TablePanel`/`StatPanel` gained the ability to listen to MULTIPLE channels at
      once (`useListenChannels(channels: string[])` in `src/linking/useChannel.ts`, shallow-
      merging each channel's `FieldFilterValue`) and now read the full `listensTo` array (it was
      always typed as `string[]`, only index `[0]` was used before) so they can react to both
      their existing filter channel AND the legend's separate one.
    - As a consequence, `resolveLegendField()` in `mapHandleAdapter.ts` no longer resolves/
      validates a raw value per item at all — it now only needs to find which single field a
      style classifies on (`settings.fields.length === 1`), since the channel's value is just
      `item.name` directly. This also fully subsumes the earlier default/"other"-class special-
      casing (nothing left to fail on). `DashboardLegendItem.value` was removed (no longer used).
    3. **Third bug, also found and fixed, same investigation**: even after (1) and (2), nothing
       changed — because the CESI layer's REAL symbology turned out to be based on THREE fields
       combined (`E_Regulated`/`E_SampleType`/`E_Overall_Condition`), not the single `Symbol`
       field every earlier fix had assumed (that field was only ever used by `ChartPanel`'s own
       grouping — unrelated to the renderer). Resolving "which field(s) does this legend
       classify by" required exactly one field before, so it silently returned `undefined` for
       this layer the whole time, and `emitFilter` skipped emitting anything at all regardless of
       which value representation was tried. Generalized to support any number of classifying
       fields (confirmed via GeoView's real `esri-renderer.ts` that ESRI unique-value renderers
       support up to 3 combined fields, `field1`/`field2`/`field3` → `TypeLayerStyleSettings
       .fields: string[]`, each `info.values` being the per-field RAW values in that same field
       order). A checked item for a multi-field classification represents one specific TUPLE of
       values (not independently-OK values per field — plain per-field IN-lists would wrongly
       match mixed-and-matched combinations across different checked items), so that case builds
       a SYNTHETIC composite channel key + composite value (new `rowFilter.ts` helpers,
       `makeCompositeField`/`makeCompositeValue`, joining with a reserved separator) instead —
       `rowMatchesFieldFilter` recognizes this composite format and computes the same join from
       row data before comparing. The single-field case is unchanged (still uses `item.name`
       directly, from fix (2) above). `DashboardMapLegendLayer.field?: string` →
       `fields?: string[]`; `DashboardLegendItem` regained a `values?: (string|number)[]` (the
       item's raw per-field tuple, only needed/used for the multi-field case).
  - Only this ONE direction is implemented (legend → other panels); the reverse (another panel's
    filter auto-unchecking the matching legend item) is NOT done — flagged as real added
    complexity, deferred until asked for.

- **Table → map "zoom to feature"** (2026-10-19): `TablePanel` gets a pinned "zoom" row-action
  icon button (same idea as GeoView's own data table, researched directly from its real source
  rather than guessed) — but ONLY when its `dataSource` is a `map-layer` type (there's a real map
  feature behind each row only then). Clicking it zooms the map to that feature's extent and
  highlights it, mirroring GeoView's own combined zoom+highlight action
  (`zoomToExtentRestrictedAndHighlight`) rather than inventing a separate highlight-only toggle
  GeoView itself doesn't have.
  - `getLayerFeatures()` previously discarded everything from `TypeFeatureInfoEntry` except each
    field's display `.value` (via `flattenFieldInfo`) — the real feature (carrying `.extent`,
    `.uid`, `.geometry`) is now ALSO kept in a `WeakMap<row, TypeFeatureInfoEntry>` inside
    `mapHandleAdapter.ts`, keyed by the flattened row's own object identity, so no fake extra
    column/field needs to leak into the row shape every other panel (chart/stat/table) already
    assumes is just plain data.
  - `DashboardMapHandle` gained `canZoomToFeature(row)`/`zoomToFeature(row): Promise<void>` — both
    take the row itself (not a separate layerId/id pair); `row` MUST be the exact object instance
    `getLayerFeatures()` returned (a copy misses the WeakMap entry and silently no-ops).
    Implemented via `MapViewer`'s own direct public surface (`mapViewer.zoomToExtent(extent)`,
    `mapViewer.featureHighlight.{highlightFeature, removeHighlight, highlightGeolocatorBBox}`) —
    not the internal `mapViewer.controllers.*` path GeoView's own source uses, which its own
    `.d.ts` comments say to avoid as an external consumer.
  - Deliberately NOT replicated (scoped down from GeoView's full feature): the OID-based extent
    fallback for geometry-less queries, GeoView's "details" button/modal (no equivalent view
    here), the click-marker pin, and visible-scale-range zoom clamping.

- The `map-layer` provider looks up the map by id, finds the layer, rejects non-queryable layers
  with a clear error, then calls `getLayerFeatures` — returning the same record shape as any
  other data source, so charts/tables/stats don't need to know where the data came from.
- `useDataSource` treats a `map-layer` source as "not ready" until `useLayerReady` resolves (not
  just until the map panel has registered) — this is a reactive React state change, so the query
  fires the moment the layer becomes available instead of only on a panel's next remount (e.g.
  switching tabs away and back used to be the only thing that "fixed" a stuck panel).
- `MapPanel` currently registers a stub handle with an empty layer list (no real GeoView
  integration yet) purely to exercise this registration lifecycle end-to-end.


- **Auth**: per-source auth block (`none` for v1; token-based auth deferred until a real source
  needs it — don't build speculative auth flows).

## 6. Cross-panel interactivity (linking)

Required for v1. Panels don't reference each other directly — they publish/subscribe to named
**channels** on the event bus:

- A panel can `emit` an interaction (e.g. selecting a bar emits `{ channel: "region-select", value }`).
- A panel can `listen` to a channel and apply it as an implicit filter to its own query.
- Channels are declared once in config (`linking.channels`) with a type (e.g. `filter`) and the
  field they filter on, so authors wire panels together explicitly rather than relying on magic
  matching.
- A panel isn't limited to one listened channel: `panel.interactions.listensTo` is an array, and
  `useListenChannels(channels: string[])` (`src/linking/useChannel.ts`) shallow-merges several
  channels' `FieldFilterValue`s into one combined filter. Used so a panel can react to two
  *independently managed* channels at once without them needing to share a single channel's value
  space — see the legend cross-filter fix in section 4 for a concrete case where this mattered
  (a domain/coded-value field needs two incompatible value representations for the map's own
  filter vs. in-memory row-filtering, so the legend got its own separate channel entirely).

## 7. Authoring

**SUPERSEDED (2026-10-15)**: originally planned as a built-in edit mode inside the viewer app.
Reversed because there's no auth/user system in this app to gate who can see an edit affordance
on a live, publicly-viewable dashboard — so authoring is instead a **completely separate app**,
not reachable from (or shipped with) the end-viewer dashboard:

- Separate Vite multi-page entry: `editor.html` → `src/editor/main.tsx` → `EditorApp`, built as
  its own bundle alongside the viewer's `example.html`/`main.tsx` (`vite.config.ts`'s
  `build.rollupOptions.input` lists both, plus a third plain static `index.html` landing page —
  see "GitHub Pages hosting" below). The viewer never imports anything from `src/editor/`.
  `src/editor/EditModeApp.tsx` (the original in-viewer stub) was deleted.
- Still WYSIWYG-ish: the editor reuses real runtime pieces where it matters most (notably
  `MapPanel`/the map registry, for live layer discovery — see below) rather than hand-rolling a
  second map-rendering path, but it is its own standalone UI, not the same rendered view toggled
  into an "edit mode".
- State: a Zustand store (`src/editor/store.ts`) holds the in-progress `DashboardConfig` draft,
  persisted to `localStorage` (`zustand/middleware`'s `persist`) so a page refresh doesn't lose
  work. Saving/loading a real config is explicit: **Export** validates via the existing
  `dashboardConfigSchema` (Zod) and downloads a `.json` file; **Import** reads an uploaded file
  through the same schema before replacing the draft. There is no backend — this is the only
  persistence model for v1.
- Grid/panel placement is **click-based, not pixel drag-and-drop** (a deliberate v1 scope call):
  click an empty cell to add a panel there, then use small arrow buttons to move it cell-by-cell
  and +/- steppers to grow/shrink its `colSpan`/`rowSpan` once selected (`GridEditor.tsx`).
- **Map-driven data source discovery** (the main "pull from the map" ask): a `map` panel needs a
  real, valid GeoView config pasted into its inspector before it's useful — once pasted, the
  editor can mount a genuinely live GeoView map for it (`MapPreview.tsx`, reusing the exact same
  `src/panels/MapPanel.tsx` component and map registry the end-viewer dashboard uses) and the
  **map-layer** data source dialog then lists that map's real queryable layers (via
  `useMapHandle(mapPanelId)?.listLayers()`) instead of requiring the author to type a layer path
  blind. Verified live end-to-end: pasting a real CESI map config renders the actual map with
  real features, and the data-source dialog's "Layer" dropdown correctly lists `uniqueValue`
  (`layerId: "uniqueValueId/1"`), matching what was previously only hand-authored in
  `sampleConfig.ts`.
- Panel property editing (`PanelInspector.tsx`) covers every panel type, including recursive
  editing of `tab`/`stack`'s nested leaf panels (shared `LeafPanelFields` component, reused both
  top-level and nested - nesting a tab/stack inside another tab/stack still isn't offered, same
  restriction as the schema itself).
- Not yet covered by the editor UI (schema already supports these, just no form yet - add if
  asked): `titleElement`/`titlePanel`/footer authoring, and no overlap-prevention when manually
  moving/resizing panels (same permissiveness as hand-authoring raw JSON today).

**GitHub Pages hosting (2026-10-16)**: `dist/` is published to GitHub Pages (project page at
`https://<owner>.github.io/geoview_dashboards/`, repo isn't gitignore-committing `dist/` itself -
see `.github/workflows/deploy-pages.yml`, which builds on every push to `main` and deploys via
the official `actions/configure-pages`/`upload-pages-artifact`/`deploy-pages` actions - requires
the repo's Settings → Pages → Source set to "GitHub Actions", a one-time manual step). Three
pages are built and published together:
- `index.html` — a small static (non-React) landing page linking to the other two.
- `example.html` — the end-viewer example dashboard (this used to be `index.html`; renamed so
  the landing page could take that slot instead, since GitHub Pages serves `index.html` by
  default at a directory's root).
- `editor.html` — the authoring tool, unchanged otherwise.
`vite.config.ts`'s `base` is conditionally `/geoview_dashboards/` only during `vite build`
(kept `/` for local dev) since this is a project page under a subpath, not a custom domain -
every built asset reference needs that prefix or it 404s once deployed. HTML `<link rel="icon">`
tags use Vite's `%BASE_URL%` placeholder rather than a hardcoded `/favicon.svg` for the same
reason. `public/.nojekyll` was added so GitHub Pages doesn't run the output through Jekyll.

## 8. Config schema (draft — will evolve)

```jsonc
{
  "id": "dashboard-id",
  "title": "My Dashboard",
  "grid": {
    "columns": 4,
    "rows": 3,
    "template": "4x3" // optional preset used only by the editor
  },
  "dataSources": [
    {
      "id": "sales-api",
      "type": "rest-json",
      "url": "https://api.example.com/sales",
      "auth": { "type": "none" },
      "refresh": { "mode": "interval", "seconds": 60 }
    },
    {
      "id": "regions-csv",
      "type": "static-file",
      "format": "csv",
      "url": "/data/regions.csv"
    }
  ],
  "linking": {
    "channels": [
      { "id": "region-select", "type": "filter", "field": "region" }
    ]
  },
  "panels": [
    {
      "id": "panel-map",
      "type": "map",
      "layout": { "col": 1, "row": 1, "colSpan": 2, "rowSpan": 2 },
      "config": { /* passed straight through to GeoView core */ }
    },
    {
      "id": "panel-sales-views",
      "type": "tab",
      "layout": { "col": 3, "row": 1, "colSpan": 2, "rowSpan": 2 },
      "tabs": [
        {
          "id": "chart",
          "label": "Chart",
          "panel": {
            "id": "panel-chart-sales",
            "type": "chart",
            "dataSource": "sales-api",
            "query": { "groupBy": "region", "aggregate": "sum(amount)" },
            "chartType": "bar",
            "interactions": { "emits": ["region-select"] }
          }
        },
        {
          "id": "table",
          "label": "Table",
          "panel": {
            "id": "panel-table-sales",
            "type": "table",
            "dataSource": "sales-api",
            "interactions": { "listensTo": ["region-select"] }
          }
        }
      ]
    }
  ]
}
```

## 9. Open questions (not blocking, but need answers before implementation of that area)

- ~~Exact GeoView core package name/version to depend on~~ — resolved, see section 10.
- How GeoView actually exposes layer type/geometry so `MapPanel` can compute each layer's
  `queryable` flag for real (today it's derived from `layer.getQueryable()`, which reflects
  GeoView's own broader definition, not specifically "vector with readable features").
- Exact shape of `TypeFieldEntry` inside a feature's `fieldInfo` beyond `.value` — revisit if
  flattened data source records look wrong once tested against a layer with real data.
- Whether `map-layer` sources should eventually live-update on map events (feature edits, layer
  reload) instead of only refetching on demand like other sources.
- ~~Chart library final pick~~ — resolved: `chart.js` + `react-chartjs-2`, see section 11.
- Where CORS/auth for `rest-json` sources gets handled when the target API doesn't allow
  browser-side calls (proxy? documented author requirement?).
- Versioning/migration strategy for the config schema as it evolves.

## 10. GeoView integration (verified against Canadian-Geospatial-Platform/geoview, `develop` branch)

`MapPanel` loads the real GeoView bundle and creates a real map — this was tested live against
the actual CDN script, not just inferred from docs.

- **Script**: `https://canadian-geospatial-platform.github.io/geoview/public/cgpv-main.js`,
  loaded once lazily via `src/geoview/loadCgpv.ts` (injects a `<script>` tag, resolves once
  `window.cgpv` exists).
- **Map creation**: uses `cgpv.api.createMapFromConfigFast(divId, JSON.stringify(config), height?)`
  — **not** the `class="geoview-map"` + `data-config`/`data-config-url` + `cgpv.init()` DOM-scan
  approach. The function-call path creates one specific map by div id directly, which fits a
  React-mounted panel much better: no DOM-scan timing/MutationObserver dance, and we get the
  `MapViewer` instance straight back from the promise instead of relying on the global
  `cgpv.onMapReady`/`onMapInit` callbacks (which really are single-slot globals — confirmed in
  `app.tsx` — but irrelevant here since we never use them; the *per-instance*
  `mapViewer.onMapReady()` is proper pub/sub, in case it's needed later).
- **Map config shape**: the top-level object passed to `createMapFromConfigFast` must have a
  `map` key; `map.basemapOptions` requires `basemapId`, `shaded`, **and** `labeled` (confirmed via
  the live schema validator's own error messages, not the — slightly stale — docs example).
- **Div lifecycle**: the map's `<div>` uses a **stable id derived from `panel.id`**
  (`geoview-map-${panel.id}`), not a freshly-generated id per mount. A stable id matters because
  `panel.id` is also how the app's own map registry (section 5) addresses a map — if the
  dashboard ever supports multiple concurrent map panels, or a future interaction needs to
  reference one specific map by name (e.g. "zoom map A from this button"), a churning id would
  silently orphan that reference across a remount. GeoView's `layerController`/
  `layerSetController`/etc. are all scoped to one specific `MapViewer` — there's no implicit
  "current map" — so any cross-map interaction must carry a stable id (or `panel.id`, via the
  registry) alongside every action, never assume a single map.
  - The catch: GeoView map ids must be unique *at any given moment*, and React 18 StrictMode
    double-invokes this effect in dev (mount → cleanup → mount again) — reusing the same id
    immediately would collide (`MapViewerAlreadyExistsError` / `InitMapWrongCallError`) if the
    two calls raced. Fixed by serializing create/delete calls per id through
    `src/geoview/mapLifecycle.ts` (`runMapLifecycleStep`): each step waits for the previous one
    for that id to fully settle before running, so the throwaway StrictMode mount's create+delete
    always finishes before the real mount's create begins, even though both use the same id.
- **Cleanup**: `cgpv.api.deleteMapViewer(divId, true)` on unmount, and also on a failed creation
  attempt (GeoView can partially register a MapViewer before failing config validation, which
  would otherwise collide with a retry using the same id).
- **Reading layer data**: `mapViewer.layer.allFeatureInfoLayerSet.queryLayer(layerPath)` — the
  same mechanism backing GeoView's own Data Table — returns `{ results: TypeFeatureInfoEntry[] }`
  with per-field data under `entry.fieldInfo[fieldName].value`. Layers that can't produce a full
  feature list (raster/WMS) throw `NotImplementedError` here, so there's no need for a separate
  vector-type pre-check — attempting the query is itself the eligibility check.
- **Map ↔ dashboard bridge**: `src/geoview/mapHandleAdapter.ts` implements the app's generic
  `DashboardMapHandle` contract (section 5) against the real `MapViewer`, so `mapLayerSource.ts`
  and the rest of the data-source layer stay GeoView-agnostic.

## 11. Table and chart libraries (matched to what GeoView itself uses)

For both the `table` and `chart` panels, we checked what GeoView's own equivalents
(`geoview-core`'s data table, `geoview-geochart`) are built on, and matched versions where it made
sense, rather than picking arbitrarily:

- **Table**: `material-react-table` (pinned to `^3.2.1`, the exact version `geoview-core` uses,
  confirmed compatible with our existing MUI v9 + React 19). `TablePanel` derives columns
  dynamically from the first data row; object-valued cells (e.g. `address`/`company`) are
  `JSON.stringify`'d since a raw object can't be rendered as a React child. It already ships a
  fullscreen toggle, search, sort, and column visibility out of the box — so `PanelContainer`'s
  own fullscreen action is disabled (`expandable={false}`) for this panel to avoid a duplicate.
- **Chart**: `chart.js` + `react-chartjs-2` (pinned to `4.5.1` / `5.3.1`, matching
  `geoview-geochart`'s own dependency versions) — **not** GeoView's own `geochart` wrapper
  package, which bundles a lot of GeoView-specific schema/store coupling (layer paths, Zustand
  state, a custom config schema) that doesn't apply to a generic dashboard panel. Chart.js itself
  was chosen over D3 because it has bar/line/pie/scatter built in out of the box, matching
  `ChartPanelConfig.chartType` directly, versus D3 requiring each chart type to be hand-built from
  primitives.
  - Bar/line/histogram charts set Chart.js `options.scales.x/y.title` (x = the grouping field
    name, y = `"Count"`; scatter sets both to its two numeric field names) — no axis labels were
    shown at all before this (2026-10-19 fix), just the raw tick values.

## 12. Theming (colors only, v1)

Deliberately scoped small: colors only (no typography/dark-mode/per-panel-type overrides yet).
Implemented via MUI's own theming system rather than physically relocating every component's
`sx` prop into separate files — most of the app already references theme-relative palette tokens
(`primary.main`, `background.paper`, `divider`, etc.) instead of hardcoded colors, so providing a
custom theme re-skins the whole dashboard without touching individual components.

- `DashboardConfig.theme?: DashboardThemeConfig` (`config/types.ts`/`schema.ts`) — four optional
  CSS color strings: `primaryColor`, `secondaryColor`, `backgroundColor` (page backdrop behind the
  grid), `paperColor` (panel/card surfaces). Dashboard-wide, like `titleElement` — not authored
  per-page. Any omitted field falls back to MUI's own default palette.
- `src/theme/createDashboardTheme.ts` builds an MUI `Theme` from that config via `createTheme`.
  `DashboardApp.tsx` wraps its render in `<ThemeProvider theme={...}>` (memoized on
  `config.theme`). The **editor's own UI chrome is NOT themed by this** — it's a tool for
  authoring the config, not a live preview of the final look, so its own buttons/dialogs always
  stay default MUI regardless of what theme is being authored.
- A handful of genuinely hardcoded (non-theme-aware) colors were fixed to track the theme instead:
  `App.css`'s grid-divider colors (bridged into plain CSS via a `<GlobalStyles>` block setting
  CSS custom properties, since `ThemeProvider` only reaches MUI/`sx`-driven components, not plain
  CSS files — same fallback values as before, so an unconfigured theme is pixel-identical to
  before this existed), `DashboardApp.tsx`'s outer border, `FooterElement.tsx`'s top border,
  `TitlePanel.tsx`'s default text color, `MapPanel.tsx`'s container border (via `useTheme()`,
  since that's a plain inline `style`, not `sx`), and `ChartPanel.tsx`'s default/selected bar
  colors (via `useTheme()` + MUI's `alpha()` helper).
- Editor authoring: `src/editor/ThemeForm.tsx` (4 plain text fields, not a color-swatch picker —
  consistent with how `TitleElementForm`/`TitlePanelForm` already handle `backgroundColor`),
  opened via a new "Theme" button in `EditorApp`'s top toolbar. No live preview of the theme
  inside the editor yet (`GridEditor` is a schematic editing view, not a real render of the
  panels) — an author needs to Export and open the config in the actual viewer to see the result.
- Verified live: setting a custom `primaryColor`/`backgroundColor` correctly re-skinned the
  `TitleElement` AppBar, `TitlePanel` strip, selected tab color (`Users` tab panel), and footer
  page-tab indicator, with zero changes needed to those components beyond the earlier hardcoded-
  color fixes above.
  - `bar`/`line`/`pie` share one code path: labels come from the first string-typed field in the
    data, values from the first numeric-typed field (falls back to counting `1` per row if there
    isn't one) — there's no groupBy/aggregate query layer yet (see section 9), so this is a
    reasonable default until one exists, not a real aggregation.
  - `scatter` needs two numeric fields (x/y); shows an explicit "not enough numeric fields"
    message if the data doesn't have them, rather than guessing.
  - `histogram` is treated as an alias for `bar` for now (no real binning yet) — flagged with a
    TODO rather than left unhandled.
  - Clicking a chart element calls `onSelect(rows[elements[0].index])` via Chart.js's `onClick`
    handler, feeding the same linking-channel mechanism as before (verified live: clicking a bar
    updates the linked `TablePanel`'s "Linked selection" text).
