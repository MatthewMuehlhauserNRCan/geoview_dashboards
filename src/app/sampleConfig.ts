import type { DashboardConfig } from "../config/types";

// Illustrative config for local dev; will be replaced by real author-produced configs.
// 4 columns x 3 rows, fully filled: map (2x2) + a tab panel (2x2) switching between
// a chart and table view of the same data, plus four single-cell panels along the bottom.
export const sampleDashboardConfig: DashboardConfig = {
  id: "sample-dashboard",
  title: "Sample Dashboard",
  titleElement: {
    title: "GeoView Dashboard Example",
    subtitle: "A sample dashboard built on the GeoView viewer",
    optionsMenu: {
      label: "View options",
      options: [
        { id: "option-a", label: "Option A" },
        { id: "option-b", label: "Option B" },
      ],
    },
    hamburgerMenu: {
      links: [
        {
          id: "docs",
          label: "Documentation",
          href: "./docs/index.html",
        },
      ],
      notice: {
        label: "Notice",
        title: "Notice",
        content:
          "This is a sample notice shown in a modal from the hamburger menu.",
      },
    },
  },
  dataSources: [
    {
      id: "sample-api",
      type: "rest-json",
      url: "https://jsonplaceholder.typicode.com/users",
      refresh: { mode: "static" },
    },
    {
      // mapPanelId must match the "id" of the map panel below; layerId is that map's
      // geoviewLayerId + "/" + layerEntry id (the layerPath GeoView queries features by).
      id: "cesi-layer",
      type: "map-layer",
      mapPanelId: "panel-map",
      layerId: "uniqueValueId/1",
    },
  ],
  linking: {
    channels: [
      {
        id: "cesi-filter",
        type: "filter",
        description:
          "Raw/native values for the map's own filter - fed by the Filter panel's dropdowns and the chart's bar clicks.",
      },
      // Separate from "cesi-filter": the legend's field is classified/domain-coded, so its items'
      // display names don't match the raw values the map's own backend filter needs. Keeping it on
      // its own channel means only in-memory consumers (chart/table/stat) read it, not the filter
      // panel's combined WHERE-clause push to the map (which would break on the value mismatch).
      {
        id: "cesi-legend-filter",
        type: "filter",
        description: "Alias/display values from the legend only - never pushed to the map's own filter.",
      },
    ],
  },
  pages: [
    {
      id: "main",
      label: "Dashboard",
      titlePanel: {
        left: "Example Dashboard Title",
        right: "Updated daily",
      },
      grid: { columns: 4, rows: 3 },
      panels: [
        {
          id: "panel-map",
          type: "map",
          // title: 'Map',
          layout: { col: 1, row: 1, colSpan: 2, rowSpan: 2 },
          // Demonstrates `configUrl`: the real GeoView map config (same shape as the inline
          // `config` alternative) lives in its own file instead of inline here.
          configUrl: "./sample-map-config.json",
        },
        {
          id: "panel-users-views",
          type: "tab",
          layout: { col: 3, row: 1, colSpan: 2, rowSpan: 2 },
          tabs: [
            {
              id: "chart",
              label: "Chart",
              panel: {
                id: "panel-users-chart",
                type: "chart",
                dataSource: "cesi-layer",
                chartType: "bar",
                field: "Symbol",
                interactions: { emits: ["cesi-filter"], listensTo: ["cesi-legend-filter"] },
              },
            },
            {
              id: "layer",
              label: "Map Layer",
              panel: {
                id: "panel-layer-table",
                type: "table",
                dataSource: "cesi-layer",
                interactions: { listensTo: ["cesi-filter", "cesi-legend-filter"] },
              },
            },
            {
              id: "table",
              label: "Table",
              panel: {
                id: "panel-users-table",
                type: "table",
                dataSource: "sample-api",
              },
            },
          ],
        },
        {
          id: "panel-filter",
          type: "filter",
          title: "Filter",
          layout: { col: 1, row: 3, colSpan: 1, rowSpan: 1 },
          dataSource: "cesi-layer",
          fields: [
            { field: "E_Regulated" },
            { field: "E_SampleType" },
            { field: "E_Overall_Condition" },
          ],
          interactions: { emits: ["cesi-filter"] },
        },
        {
          id: "panel-stat",
          type: "stack",
          layout: { col: 2, row: 3, colSpan: 1, rowSpan: 1 },
          sizes: [2, 1],
          items: [
            {
              id: "panel-stat-filtered",
              type: "stat",
              display: "gauge",
              gauge: { label: "percentage" },
              title: "Project Count",
              dataSource: "cesi-layer",
              interactions: { listensTo: ["cesi-filter", "cesi-legend-filter"] },
            },
            {
              id: "panel-stat-total",
              type: "stat",
              title: "Total Count",
              dataSource: "cesi-layer",
            },
          ],
        },
        {
          id: "panel-legend",
          type: "legend",
          title: "Legend",
          layout: { col: 3, row: 3, colSpan: 1, rowSpan: 1 },
          mapPanelId: "panel-map",
          showLayerHeaders: false,
          interactions: { emits: ["cesi-legend-filter"] },
        },
        {
          id: "panel-notes",
          type: "text",
          title: "Notes",
          layout: { col: 4, row: 3, colSpan: 1, rowSpan: 1 },
          contentUrl: "./sample-notes.md",
        },
      ],
    },
    {
      id: "page-2",
      label: "Second Page",
      grid: { columns: 1, rows: 1 },
      panels: [
        {
          id: "panel-second-page-note",
          type: "text",
          layout: { col: 1, row: 1, colSpan: 1, rowSpan: 1 },
          content: "This is an example second page.",
        },
      ],
    },
  ],
};
