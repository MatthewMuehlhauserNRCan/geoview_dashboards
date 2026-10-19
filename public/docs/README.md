# GeoView Dashboards - Configuration Guide

A dashboard is a single JSON/TypeScript config object (`DashboardConfig`) describing its pages,
grid layout, panels, data sources, linking channels, theme, title/footer content. This guide
documents that config format directly.

**The [editor](../editor.html) is the primary, recommended way to build a dashboard** - it
builds this same config visually, validates it as you go, and lets you preview a live map. Use
this guide as a reference for anything the editor doesn't expose a dedicated control for yet, or
if you'd rather hand-write/script a config.

## Where to start

- [Getting Started](guide/getting-started.md) - the overall shape of a config, and how to load one
- [Embedding in a Web Page](guide/embedding.md) - adding a dashboard to any HTML page via a script tag
- [Pages & Grid](guide/pages-and-grid.md) - pages, the grid, and panel placement
- [Panels](guide/panels.md) - every panel type and its fields
- [Data Sources](guide/data-sources.md) - where panels get their data
- [Linking](guide/linking.md) - cross-panel filtering/selection
- [Theming](guide/theming.md) - recoloring the dashboard
- [Title & Footer](guide/title-and-footer.md) - header, title strip, and multi-page footer tabs
- [Full Example](guide/full-example.md) - a complete, annotated config

## Other references

- [Example dashboard](../example.html) - a live dashboard built from the config in
  [Full Example](guide/full-example.md)
- [Architecture notes](https://github.com/MatthewMuehlhauserNRCan/geoview_dashboards/blob/main/docs/ARCHITECTURE.md) -
  internal implementation notes (not needed for authoring a dashboard)
