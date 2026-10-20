# About this dashboard

This example is built with **GeoView Dashboards** - embeddable, config-driven dashboards on top
of the [GeoView](https://github.com/Canadian-Geospatial-Platform/geoview) map viewer. The entire
page you're looking at, including this note, comes from a single JSON-serializable config object -
no custom code per dashboard.

## What's on this page

- A live, interactive **map** panel (top-left)
- A **chart** / **table** switcher showing the same underlying data two ways (top-right)
- A **filter** panel driving both the map and the other panels (bottom-left)
- **Stat** gauges summarizing the filtered vs. total counts
- A **legend** with per-item visibility toggles
- This **text** panel, rendered from a remote markdown file via `contentUrl`

## Learn more

- [Configuration guide](./docs/index.html) - the full reference for pages, panels, data sources,
  linking, and theming
- [GeoView project](https://github.com/Canadian-Geospatial-Platform/geoview)

> Tip: panels support plain text, inline markdown (`format: "markdown"`), or a link to a markdown
> document like this one (`contentUrl`).
