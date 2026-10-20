# AGENTS.md

Context for any agent (or human) working on this repo. Read this first, then dig into
`docs/ARCHITECTURE.md` (long-form, chronological decision log) or the source itself for detail
on a specific area. Keep this file short - if you add a feature, add a one-paragraph pointer
here and put the detail in `docs/ARCHITECTURE.md` instead of growing this file.

## What this is

`geoview_dashboards` - embeddable, config-driven dashboards built on top of the
[GeoView](https://github.com/Canadian-Geospatial-Platform/geoview) map viewer. A dashboard is a
single JSON-serializable `DashboardConfig` object (pages, grid layout, panels, data sources,
cross-panel linking, theme) - no custom code per dashboard, just config. Three ways to consume it:

1. **Script-tag embed** - `window.GeoViewDashboards.render(elementId, config)`, a standalone IIFE
   bundle (`src/embed.tsx` / `vite.config.lib.ts`) for dropping into any HTML page.
2. **Standalone viewer page** (`example.html` / `src/main.tsx` / `App.tsx`) - same engine, hosts
   the live demo (`src/app/sampleConfig.ts`).
3. **Editor** (`editor.html` / `src/editor/`) - a separate authoring tool that builds/exports a
   `DashboardConfig` visually (no auth system, so intentionally NOT reachable from the viewer).

The public, user-facing config reference guide lives at `public/docs/` (docsify, published to
GitHub Pages at `/docs/`) - **when you change the config schema, update the matching page under
`public/docs/guide/` too.** `docs/ARCHITECTURE.md` is the internal/dev-only decision log, not
meant for dashboard authors.

## Stack

React 19 + TypeScript + Vite 8, MUI v9 (`@mui/material`), Zustand 5 (editor state + linking
channels + map registry), TanStack Query 5 (data source fetching/caching), Zod 4 (config
validation, `src/config/schema.ts`), Chart.js 4 + `react-chartjs-2`, `material-react-table` 3,
`react-resizable-panels` 4 (the grid engine), `geoview-core-types` (GitHub `#types` branch - real
`.d.ts` for GeoView's `window.cgpv` API, not published to npm).

## Repo layout

```
src/config/      canonical types (types.ts) + Zod schema (schema.ts), parseDashboardConfig()
src/dataSources/ rest-json / static-file / map-layer providers + registry.ts + useDataSource.ts
src/linking/     pub/sub "channel" event bus (eventBus.ts) + useChannel.ts hooks
src/map/         GeoView-agnostic map registry/contract (registry.ts, types.ts)
src/geoview/     ALL GeoView-specific glue (cgpvTypes.ts, loadCgpv.ts, mapLifecycle.ts, mapHandleAdapter.ts)
src/grid/        DashboardGrid.tsx (recursive partitioner) + layoutUtils.ts
src/panels/      one component per panel type + PanelContainer.tsx (shared chrome) + leafRegistry.ts
src/title/       TitleElement (dashboard-wide header) + TitlePanel (per-page strip) - NOT panels
src/footer/      auto-generated page-switcher tabs (shown when there's >1 page)
src/theme/       createDashboardTheme.ts (DashboardThemeConfig -> MUI theme, w/ auto text contrast)
src/app/         DashboardApp.tsx (the actual renderer, shared by viewer + embed) + sampleConfig.ts
src/editor/      standalone authoring tool (own Zustand store, own entry point)
src/embed.tsx    script-tag embed entry (window.GeoViewDashboards)
public/docs/     public docsify config guide (auto-published to dist/docs/ via Vite's public/ copy)
docs/ARCHITECTURE.md   internal, chronological decision log - NOT for dashboard authors
```

## Commands

- `npm run dev` - Vite dev server (serves `/`, `/example.html`, `/editor.html`, `/docs/`).
- `npm run build` - `tsc -b && vite build && vite build --config vite.config.lib.ts`. Three
  separate build passes: the main multi-page app build (index/example/editor, `vite.config.ts`),
  then the embed library build (`vite.config.lib.ts`, `emptyOutDir: false` so it doesn't clobber
  the first pass). Both must run for a complete `dist/`.
- `npm run lint` - `oxlint`.
- Deploys automatically via `.github/workflows/deploy-pages.yml` on push to `main` (runs
  `npm run build`, publishes `dist/` to GitHub Pages) - no manual steps needed after pushing.

## Core conventions / gotchas (don't rediscover these)

- **100%-height chain**: this app has no page scroll - everything relies on an unbroken
  `height:100%` chain from `html`/`body` down to whatever's rendering (`index.css`). Any NEW
  top-level mount point (a new `#some-root` div) needs its own explicit height rule added to that
  same chain, or it silently collapses to content height with nothing visibly scrollable. See the
  `css-debugging.md` user-memory note and the "EDITOR SCROLL BUG FIX" entry in
  `docs/ARCHITECTURE.md` for a worked example.
- **Grid engine**: `DashboardGrid.tsx` recursively partitions the page into nested
  `react-resizable-panels` `Grid`/`Cell`/`Gridline` instances along "clean seams" (boundaries no
  panel's span crosses), falling back to a flat grid only where panels are genuinely interlocked.
  Config stays simple/flat (1-indexed `col`/`row`/`colSpan`/`rowSpan`) - the partitioning is a
  pure rendering-time concern, not part of the schema. `stack` panels reuse the exact same
  Grid/Cell/Gridline + `toPercentFromWeights` primitives (`src/grid/layoutUtils.ts`) - don't use
  plain flexbox for a new "split this cell into resizable pieces" feature.
- **Linking channels**: named pub/sub channels (`linking.channels` + each panel's
  `interactions.emits`/`listensTo`), no implicit matching. **Important**: a single channel value
  can't safely serve both "feed the map's own native filter" (needs RAW/untranslated attribute
  values) and "feed in-memory filtering of already-alias-translated query rows" (table/chart/stat)
  for the same ESRI domain/coded-value field - these are genuinely different value spaces. See
  the legend panel's two-channel split (`cesi-filter` vs `cesi-legend-filter` in
  `sampleConfig.ts`) and `public/docs/guide/linking.md` before wiring a new map-driven filter.
- **GeoView integration** (`src/geoview/`): map created via
  `cgpv.api.createMapFromConfigFast(divId, ...)`, NOT the `class="geoview-map"`+`data-config`+
  `cgpv.init()` DOM-scan path. Map div id is stable (derived from `panel.id`), and
  create/delete calls for the same id are serialized (`mapLifecycle.ts`) to survive React
  StrictMode's double-invoke. `MapViewer`'s convenience methods aren't uniformly unit-consistent -
  e.g. `setCenter()` silently expects lon/lat and converts, while `zoomToExtent()` takes the raw
  view-projection `Extent` as-is; `getView().setCenter()` is the raw OL passthrough. Always check
  a wrapper's real implementation before trusting it with already-projected coordinates. GeoView
  types are centralized in `src/geoview/cgpvTypes.ts` (re-exports from `geoview-core-types`) -
  import from there, not directly from `geoview-core-types/...` elsewhere.
- **GeoView source trust**: the GitHub `develop` branch can genuinely diverge from the actual
  deployed CDN bundle `loadCgpv.ts` loads (different build artifacts) - when behavior is
  uncertain, prefer `geoview-core-types`'s real `.d.ts` (reflects the `types` branch build) or a
  live check over trusting `develop`-branch source reading alone, especially for exact runtime
  behavior (not just public API shape).
- **MUI v9 API quirks** hit multiple times: `Stack` only accepts `direction`/`spacing`/`divider`/
  `useFlexGap`/`sx` (not `alignItems`/`justifyContent` directly - put those in `sx`);
  `ListItemText` needs `slotProps={{ primary: { sx: {...} } }}`, not `primaryTypographyProps`.
- **Theming**: `DashboardThemeConfig` -> MUI theme (`src/theme/createDashboardTheme.ts`) with
  auto text-contrast when `textColor` is omitted. A few genuinely-hardcoded spots (plain CSS in
  `App.css`, raw inline `style` on non-MUI elements) are bridged via a `<GlobalStyles>` block /
  `useTheme()` in `DashboardApp.tsx` - if you add a new hardcoded color anywhere, bridge it the
  same way rather than leaving it unthemed. The editor's own UI chrome is deliberately NOT themed
  by the config being edited (it's an authoring tool, not a live preview).
- **Embed bundle self-containment**: `src/embed.tsx` imports `App.css` directly (grid/divider
  classNames live there) so the standalone IIFE stays fully self-contained. If you add a new
  plain-CSS-class dependency anywhere reachable from `DashboardApp`, make sure it's covered by
  that same import, not just pulled in incidentally by `App.tsx`.

## Extending the config schema

1. `src/config/types.ts` (TS type) + `src/config/schema.ts` (matching Zod schema) - keep these
   field-for-field identical.
2. New panel type: add the component under `src/panels/`, register it in
   `src/panels/leafRegistry.ts`, add authoring fields in `src/editor/PanelInspector.tsx`.
3. New data source type: add the provider under `src/dataSources/`, register it in
   `src/dataSources/registry.ts`.
4. Update `public/docs/guide/panels.md` / `data-sources.md` / etc. (whichever applies) and
   `src/app/sampleConfig.ts` if it's a good candidate for the worked example.

## Testing/verification conventions

- `tsc -b` + `npm run build` are the baseline for "done" on any change.
- For live browser verification: if a change is visual/interactive/non-trivial, live-verify
  proactively without asking. Otherwise, for routine/low-risk changes, rely on `tsc -b`/
  `vite build` only and ask first before running a live dev-server + browser-testing loop.
- Known flaky spots in this environment, not code bugs: the real CESI ArcGIS endpoint
  (`maps-cartes.ec.gc.ca`) is sometimes unreachable from a sandboxed browser (CORS or just no
  requests firing) - don't over-conclude from one failed live attempt against it. Simulating a
  divider drag via raw mouse events is unreliable - prefer `page.setViewportSize(...)` to trigger
  a real resize in tests instead.
