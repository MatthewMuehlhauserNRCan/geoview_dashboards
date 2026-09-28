# Architecture

Status: **decisions locked for v1 planning** — revisit as implementation surfaces new constraints.

## 1. Goals

- Embeddable the same way as GeoView / GeoView Stories: a bundle + JSON/YAML config dropped into a page.
- Arrange multiple panels (map + non-map) on a fixed NxM grid (e.g. 3x3, 4x4) that always fills
  the viewport — panels can span multiple cells, but nothing resizes or scrolls the page.
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
| Charts | ECharts or Vega-Lite (TBD when we build the chart panel) | Spec/config-driven, fits "config → render" model |
| Layout engine | Native CSS Grid | Fixed `columns`/`rows`; panels place via `{col, row, colSpan, rowSpan}` |
| State / event bus | Zustand + small pub/sub channel model | Needed for cross-panel linking |
| Data fetching/caching | TanStack Query | Polling, caching, retry for external sources |
| Config validation | Zod (runtime) + JSON Schema (authoring + docs) | Fail fast with author-friendly errors |
| Build | Vite, library mode → UMD/ESM | Same embed model as GeoView |

## 3. Grid / layout

- Fixed NxM grid (e.g. 3x3, 4x4, or any author-chosen `columns`/`rows`) that always fills
  `100vw`/`100vh` — no page scroll, no leftover space. Implemented as native CSS Grid
  (`grid-template-columns/rows: repeat(N, 1fr)`), not a drag/resize library.
- Panels declare a position and span — `{col, row, colSpan, rowSpan}` (1-indexed) — so any panel
  can take up multiple cells, but the grid dimensions themselves never change at runtime.
- **No free-drag resizing** in the viewer. If an edit mode adds resizing later, it would be
  constrained to picking `colSpan`/`rowSpan` on the fixed grid, not pixel-level dragging.
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

**Fullscreen/lightbox**: every leaf panel (not `tab`, which already switches views) exposes an
expand action that opens the same panel content in a fullscreen dialog, for exploring data
(e.g. a table) without resizing its grid cell.

**Tab panel**: `type: "tab"` holds a list of `{ id, label, panel }` tabs, each wrapping one leaf
panel (chart/table/stat/etc., minus its own `layout` — position belongs to the tab panel, not
its tabs). Nesting a tab panel inside another tab panel isn't supported, to keep authoring and
the schema simple.

## 5. Data connection infrastructure

Map layers keep their existing connectors (WMS/WFS/ESRI/GeoJSON via GeoView). Dashboards add a
**data source layer independent of the map**, since charts/tables/stats may not touch the map.

- **Data source registry**: named sources in config, each with a `type`. v1 priority types:
  - `rest-json` — REST/JSON APIs
  - `static-file` — CSV/JSON/Excel served as a file
  - Deferred: OGC API Features as tabular data, WebSocket/SSE real-time, DB-via-backend-proxy.
- **Per-panel query**: a panel references a `dataSource` id plus a query/transform (filter,
  group-by, aggregate, field mapping) so one source can feed multiple panels differently.
- **Refresh strategy**: `static` (load once) vs `interval` (poll every N seconds) per source.
  Push-based (websocket) sources are a later phase.
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

## 7. Authoring

Built-in **edit mode** in the same viewer app (not a separate builder app):

- Same rendering code is used for view and edit — WYSIWYG by construction, no second renderer
  to keep in sync.
- Edit-mode UI (drag/resize handles, panel inspector, data source manager) is code-split and
  lazy-loaded, so it isn't shipped to end viewers who only ever render a finished dashboard.
- Edit mode reads/writes the same JSON config that the runtime consumes.

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

- Exact GeoView core package name/version to depend on, and which parts of its config are
  reusable as-is for the `map` panel type.
- Chart library final pick (ECharts vs Vega-Lite) — decide when building the `chart` panel.
- Where CORS/auth for `rest-json` sources gets handled when the target API doesn't allow
  browser-side calls (proxy? documented author requirement?).
- Versioning/migration strategy for the config schema as it evolves.
