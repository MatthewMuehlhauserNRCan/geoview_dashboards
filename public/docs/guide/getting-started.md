# Getting Started

A dashboard is described entirely by one JSON-serializable object, `DashboardConfig`
(`src/config/types.ts`, validated at runtime by `src/config/schema.ts`'s Zod schema). There's no
build step required to change a dashboard - edit the config, reload the page.

## Top-level shape

```ts
interface DashboardConfig {
  id: string;
  title: string;
  titleElement?: TitleElementConfig; // dashboard-wide header - see Title & Footer
  theme?: DashboardThemeConfig; // dashboard-wide colors - see Theming
  pages: DashboardPageConfig[]; // one or more independent grid+panel sets
  dataSources: DataSourceConfig[]; // shared by every page
  linking?: LinkingConfig; // named cross-panel filter channels
}
```

- `id`/`title` are metadata only (not currently rendered anywhere but kept for future use and
  for the editor's own bookkeeping).
- `pages` is an array, even for a single-page dashboard. A footer tab bar is shown automatically
  whenever there's more than one page - no separate config for it.
- `dataSources` and `linking` are shared across every page (not authored per-page).

## Loading a config

For embedding a dashboard in your own web page, see [Embedding in a Web Page](guide/embedding.md)
- it covers the `GeoViewDashboards.render(elementId, config)` script-tag API end to end.

Internally, the example viewer (`src/app/DashboardApp.tsx`) takes a parsed `DashboardConfig` as a
prop and renders it - the embed API above is just a thin wrapper around mounting that same
component into a given element.

Always validate an externally-sourced config through `parseDashboardConfig()` before using it:

```ts
import { parseDashboardConfig } from './config/schema';

const config = parseDashboardConfig(JSON.parse(rawJsonString));
```

This throws a descriptive Zod error if the config doesn't match the schema, instead of failing
confusingly deep inside a component later. `GeoViewDashboards.render()` already does this for you.

## Minimal example

```json
{
  "id": "my-dashboard",
  "title": "My Dashboard",
  "dataSources": [],
  "pages": [
    {
      "id": "main",
      "label": "Dashboard",
      "grid": { "columns": 2, "rows": 1 },
      "panels": [
        {
          "id": "panel-notes",
          "type": "text",
          "title": "Notes",
          "layout": { "col": 1, "row": 1, "colSpan": 2, "rowSpan": 1 },
          "content": "Hello, dashboard!"
        }
      ]
    }
  ]
}
```

See [Full Example](guide/full-example.md) for a complete, realistic config using most panel
types, a live map layer, cross-panel filtering, and theming together.
