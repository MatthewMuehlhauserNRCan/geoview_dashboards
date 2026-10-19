# Full Example

The complete config behind the live [example dashboard](../example.html) (`src/app/sampleConfig.ts`)
- a 4x3 grid on its main page: a map (2x2) + a tab panel (2x2) switching between a chart/table/
table view of the same live map layer, a filter panel, two stacked stat panels, a legend, and a
notes panel - plus a second, minimal page.

```json
{
  "id": "sample-dashboard",
  "title": "Sample Dashboard",
  "titleElement": {
    "title": "GeoView Dashboard Example",
    "subtitle": "A sample dashboard built on the GeoView viewer",
    "optionsMenu": {
      "label": "View options",
      "options": [
        { "id": "option-a", "label": "Option A" },
        { "id": "option-b", "label": "Option B" }
      ]
    },
    "hamburgerMenu": {
      "links": [
        { "id": "docs", "label": "Documentation", "href": "https://canadian-geospatial-platform.github.io/geoview/" }
      ],
      "notice": {
        "label": "Notice",
        "title": "Notice",
        "content": "This is a sample notice shown in a modal from the hamburger menu."
      }
    }
  },
  "dataSources": [
    { "id": "sample-api", "type": "rest-json", "url": "https://jsonplaceholder.typicode.com/users", "refresh": { "mode": "static" } },
    { "id": "cesi-layer", "type": "map-layer", "mapPanelId": "panel-map", "layerId": "uniqueValueId/1" }
  ],
  "linking": {
    "channels": [
      { "id": "cesi-filter", "type": "filter", "field": "Symbol" },
      { "id": "cesi-legend-filter", "type": "filter", "field": "Symbol" }
    ]
  },
  "pages": [
    {
      "id": "main",
      "label": "Dashboard",
      "titlePanel": { "left": "Example Dashboard Title", "right": "Updated daily" },
      "grid": { "columns": 4, "rows": 3 },
      "panels": [
        {
          "id": "panel-map",
          "type": "map",
          "layout": { "col": 1, "row": 1, "colSpan": 2, "rowSpan": 2 },
          "config": {
            "map": {
              "interaction": "dynamic",
              "viewSettings": { "projection": 3978, "initialView": { "zoomAndCenter": [4, [-95, 55]] } },
              "basemapOptions": { "basemapId": "transport", "shaded": true, "labeled": true },
              "listOfGeoviewLayerConfig": [
                {
                  "geoviewLayerId": "uniqueValueId",
                  "geoviewLayerName": "uniqueValue",
                  "metadataAccessPath": "https://maps-cartes.ec.gc.ca/arcgis/rest/services/CESI/MapServer/",
                  "geoviewLayerType": "esriFeature",
                  "listOfLayerEntryConfig": [{ "layerId": "1" }]
                }
              ]
            },
            "appBar": { "tabs": { "core": [] } },
            "footerBar": { "tabs": { "core": [] } }
          }
        },
        {
          "id": "panel-users-views",
          "type": "tab",
          "layout": { "col": 3, "row": 1, "colSpan": 2, "rowSpan": 2 },
          "tabs": [
            {
              "id": "chart",
              "label": "Chart",
              "panel": {
                "id": "panel-users-chart",
                "type": "chart",
                "dataSource": "cesi-layer",
                "chartType": "bar",
                "field": "Symbol",
                "interactions": { "emits": ["cesi-filter"], "listensTo": ["cesi-legend-filter"] }
              }
            },
            {
              "id": "layer",
              "label": "Map Layer",
              "panel": {
                "id": "panel-layer-table",
                "type": "table",
                "dataSource": "cesi-layer",
                "interactions": { "listensTo": ["cesi-filter", "cesi-legend-filter"] }
              }
            },
            {
              "id": "table",
              "label": "Table",
              "panel": { "id": "panel-users-table", "type": "table", "dataSource": "sample-api" }
            }
          ]
        },
        {
          "id": "panel-filter",
          "type": "filter",
          "title": "Filter",
          "layout": { "col": 1, "row": 3, "colSpan": 1, "rowSpan": 1 },
          "dataSource": "cesi-layer",
          "fields": [{ "field": "E_Regulated" }, { "field": "E_SampleType" }, { "field": "E_Overall_Condition" }],
          "interactions": { "emits": ["cesi-filter"] }
        },
        {
          "id": "panel-stat",
          "type": "stack",
          "layout": { "col": 2, "row": 3, "colSpan": 1, "rowSpan": 1 },
          "items": [
            {
              "id": "panel-stat-filtered",
              "type": "stat",
              "title": "Project Count",
              "dataSource": "cesi-layer",
              "interactions": { "listensTo": ["cesi-filter", "cesi-legend-filter"] }
            },
            { "id": "panel-stat-total", "type": "stat", "title": "Total Count", "dataSource": "cesi-layer" }
          ]
        },
        {
          "id": "panel-legend",
          "type": "legend",
          "title": "Legend",
          "layout": { "col": 3, "row": 3, "colSpan": 1, "rowSpan": 1 },
          "mapPanelId": "panel-map",
          "showLayerHeaders": false,
          "interactions": { "emits": ["cesi-legend-filter"] }
        },
        {
          "id": "panel-notes",
          "type": "text",
          "title": "Notes",
          "layout": { "col": 4, "row": 3, "colSpan": 1, "rowSpan": 1 },
          "content": "Notes panel placeholder."
        }
      ]
    },
    {
      "id": "page-2",
      "label": "Second Page",
      "grid": { "columns": 1, "rows": 1 },
      "panels": [
        {
          "id": "panel-second-page-note",
          "type": "text",
          "layout": { "col": 1, "row": 1, "colSpan": 1, "rowSpan": 1 },
          "content": "This is an example second page."
        }
      ]
    }
  ]
}
```

A few things worth noticing in this config:

- `panel-map` and `panel-stat`/`panel-filter`/`panel-legend` all share the same `cesi-layer`
  `map-layer` data source - several panels can read from the same live map layer at once.
- `panel-legend` emits onto its **own** `"cesi-legend-filter"` channel (not the same one
  `panel-filter`/the chart use) - see [Linking](guide/linking.md#important-caveat-legend-channels-and-domain-coded-fields)
  for why.
- `panel-stat`/`panel-layer-table` listen to **both** channels at once (`listensTo` is an array)
  so they react to either source of filtering.
- `panel-users-table` uses a completely unrelated `rest-json` data source (`sample-api`) and
  isn't wired into any linking channel - panels don't have to participate in linking at all.
