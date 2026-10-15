import type { DashboardConfig } from '../config/types';

// Illustrative config for local dev; will be replaced by real author-produced configs.
// 4 columns x 3 rows, fully filled: map (2x2) + a tab panel (2x2) switching between
// a chart and table view of the same data, plus four single-cell panels along the bottom.
export const sampleDashboardConfig: DashboardConfig = {
  id: 'sample-dashboard',
  title: 'Sample Dashboard',
  grid: { columns: 4, rows: 3 },
  dataSources: [
    {
      id: 'sample-api',
      type: 'rest-json',
      url: 'https://jsonplaceholder.typicode.com/users',
      refresh: { mode: 'static' },
    },
  ],
  linking: {
    channels: [{ id: 'user-select', type: 'filter', field: 'id' }],
  },
  panels: [
    {
      id: 'panel-map',
      type: 'map',
      // title: 'Map',
      layout: { col: 1, row: 1, colSpan: 2, rowSpan: 2 },
      // Minimal valid GeoView config (verified against docs/app/api/api.md's own example)
      config: {
        map: {
          interaction: 'dynamic',
          viewSettings: {
            projection: 3978,
            initialView: { zoomAndCenter: [4, [-95, 55]] },
          },
          basemapOptions: { basemapId: 'transport', shaded: true, labeled: true },
          "listOfGeoviewLayerConfig": [
            {
              "geoviewLayerId": "uniqueValueId",
              "geoviewLayerName": "uniqueValue",
              "metadataAccessPath": "https://maps-cartes.ec.gc.ca/arcgis/rest/services/CESI/MapServer/",
              "geoviewLayerType": "esriFeature",
              "listOfLayerEntryConfig": [
                  {
                      "layerId": "1"
                  }
              ]
            }
          ]
        },
        appBar: {
          tabs: {
            "core": []
          }
        },
        footerBar: {
          tabs: {
            "core": []
          }
        }
      },
    },
    {
      id: 'panel-users-views',
      type: 'tab',
      title: 'Users',
      layout: { col: 3, row: 1, colSpan: 2, rowSpan: 2 },
      tabs: [
        {
          id: 'chart',
          label: 'Chart',
          panel: {
            id: 'panel-users-chart',
            type: 'chart',
            dataSource: 'sample-api',
            chartType: 'bar',
            interactions: { emits: ['user-select'] },
          },
        },
        {
          id: 'table',
          label: 'Table',
          panel: {
            id: 'panel-users-table',
            type: 'table',
            dataSource: 'sample-api',
            interactions: { listensTo: ['user-select'] },
          },
        },
      ],
    },
    {
      id: 'panel-filter',
      type: 'filter',
      title: 'Filter',
      layout: { col: 1, row: 3, colSpan: 1, rowSpan: 1 },
      control: 'dropdown',
      field: 'username',
    },
    {
      id: 'panel-stat',
      type: 'stat',
      title: 'User Count',
      layout: { col: 2, row: 3, colSpan: 1, rowSpan: 1 },
      dataSource: 'sample-api',
    },
    {
      id: 'panel-legend',
      type: 'legend',
      title: 'Legend',
      layout: { col: 3, row: 3, colSpan: 1, rowSpan: 1 },
      mapPanelId: 'panel-map',
    },
    {
      id: 'panel-notes',
      type: 'text',
      title: 'Notes',
      layout: { col: 4, row: 3, colSpan: 1, rowSpan: 1 },
      content: 'Notes panel placeholder.',
    },
  ],
};
