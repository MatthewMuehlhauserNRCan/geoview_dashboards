import { z } from 'zod';

const panelLayoutSchema = z.object({
  col: z.number(),
  row: z.number(),
  colSpan: z.number().optional(),
  rowSpan: z.number().optional(),
});

const panelInteractionsSchema = z.object({
  emits: z.array(z.string()).optional(),
  listensTo: z.array(z.string()).optional(),
});

// Shared fields for every panel type; layout is added separately since only
// grid-level panels need a position (tab-nested panels don't).
const baseFields = {
  id: z.string(),
  title: z.string().optional(),
  dataSource: z.string().optional(),
  query: z.record(z.string(), z.unknown()).optional(),
  interactions: panelInteractionsSchema.optional(),
};

const mapPanelFields = z.object({
  ...baseFields,
  type: z.literal('map'),
  config: z.record(z.string(), z.unknown()),
});

const chartPanelFields = z.object({
  ...baseFields,
  type: z.literal('chart'),
  chartType: z.enum(['bar', 'line', 'pie', 'scatter', 'histogram']),
});

const statPanelFields = z.object({ ...baseFields, type: z.literal('stat') });

const tablePanelFields = z.object({ ...baseFields, type: z.literal('table') });

const legendPanelFields = z.object({
  ...baseFields,
  type: z.literal('legend'),
  mapPanelId: z.string().optional(),
});

const filterPanelFields = z.object({
  ...baseFields,
  type: z.literal('filter'),
  control: z.enum(['dropdown', 'slider', 'date-range', 'search']),
  field: z.string(),
});

const textPanelFields = z.object({
  ...baseFields,
  type: z.literal('text'),
  content: z.string(),
});

const leafPanelSchema = z.discriminatedUnion('type', [
  mapPanelFields,
  chartPanelFields,
  statPanelFields,
  tablePanelFields,
  legendPanelFields,
  filterPanelFields,
  textPanelFields,
]);

const tabItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  panel: leafPanelSchema,
});

const tabPanelFields = z.object({
  ...baseFields,
  type: z.literal('tab'),
  tabs: z.array(tabItemSchema),
});

const panelSchema = z.discriminatedUnion('type', [
  mapPanelFields,
  chartPanelFields,
  statPanelFields,
  tablePanelFields,
  legendPanelFields,
  filterPanelFields,
  textPanelFields,
  tabPanelFields,
]);

// A panel as placed on the dashboard grid always carries a layout.
const gridPanelSchema = z.intersection(panelSchema, z.object({ layout: panelLayoutSchema }));

const dataSourceRefreshSchema = z.object({
  mode: z.enum(['static', 'interval']),
  seconds: z.number().optional(),
});

const dataSourceAuthSchema = z.object({ type: z.literal('none') });

const restJsonDataSourceSchema = z.object({
  id: z.string(),
  type: z.literal('rest-json'),
  url: z.string(),
  auth: dataSourceAuthSchema.optional(),
  refresh: dataSourceRefreshSchema.optional(),
});

const staticFileDataSourceSchema = z.object({
  id: z.string(),
  type: z.literal('static-file'),
  format: z.enum(['csv', 'json', 'excel']),
  url: z.string(),
});

const dataSourceSchema = z.discriminatedUnion('type', [
  restJsonDataSourceSchema,
  staticFileDataSourceSchema,
]);

const linkingChannelSchema = z.object({
  id: z.string(),
  type: z.literal('filter'),
  field: z.string(),
});

const linkingSchema = z.object({ channels: z.array(linkingChannelSchema) });

const gridSchema = z.object({
  columns: z.number(),
  rows: z.number(),
  template: z.string().optional(),
});

export const dashboardConfigSchema = z.object({
  id: z.string(),
  title: z.string(),
  grid: gridSchema,
  dataSources: z.array(dataSourceSchema),
  linking: linkingSchema.optional(),
  panels: z.array(gridPanelSchema),
});

export function parseDashboardConfig(input: unknown) {
  return dashboardConfigSchema.parse(input);
}
