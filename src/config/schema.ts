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
  field: z.string().optional(),
});

const statPanelFields = z.object({ ...baseFields, type: z.literal('stat') });

const tablePanelFields = z.object({ ...baseFields, type: z.literal('table') });

const legendPanelFields = z.object({
  ...baseFields,
  type: z.literal('legend'),
  mapPanelId: z.string().optional(),
  showLayerHeaders: z.boolean().optional(),
});

const filterFieldSchema = z.object({
  field: z.string(),
  label: z.string().optional(),
});

const filterPanelFields = z.object({
  ...baseFields,
  type: z.literal('filter'),
  fields: z.array(filterFieldSchema),
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

const stackPanelFields = z.object({
  ...baseFields,
  type: z.literal('stack'),
  direction: z.enum(['row', 'column']).optional(),
  sizes: z.array(z.number()).optional(),
  items: z.array(leafPanelSchema),
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
  stackPanelFields,
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

const mapLayerDataSourceSchema = z.object({
  id: z.string(),
  type: z.literal('map-layer'),
  mapPanelId: z.string(),
  layerId: z.string(),
});

const dataSourceSchema = z.discriminatedUnion('type', [
  restJsonDataSourceSchema,
  staticFileDataSourceSchema,
  mapLayerDataSourceSchema,
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
  columnSizes: z.array(z.number()).optional(),
  rowSizes: z.array(z.number()).optional(),
  template: z.string().optional(),
});

const titleImageSchema = z.object({
  src: z.string(),
  alt: z.string().optional(),
  href: z.string().optional(),
});

const titleMenuOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
});

const titleOptionsMenuSchema = z.object({
  icon: titleImageSchema.optional(),
  label: z.string().optional(),
  options: z.array(titleMenuOptionSchema),
});

const titleHamburgerLinkSchema = z.object({
  id: z.string(),
  label: z.string(),
  href: z.string(),
});

const titleHamburgerNoticeSchema = z.object({
  label: z.string(),
  title: z.string(),
  content: z.string(),
});

const titleHamburgerMenuSchema = z.object({
  links: z.array(titleHamburgerLinkSchema).optional(),
  notice: titleHamburgerNoticeSchema.optional(),
});

const titleElementSchema = z.object({
  image: titleImageSchema.optional(),
  title: z.string(),
  subtitle: z.string().optional(),
  backgroundColor: z.string().optional(),
  optionsMenu: titleOptionsMenuSchema.optional(),
  hamburgerMenu: titleHamburgerMenuSchema.optional(),
});

const titlePanelSchema = z.object({
  left: z.string().optional(),
  image: titleImageSchema.optional(),
  right: z.string().optional(),
  backgroundColor: z.string().optional(),
});

const dashboardPageSchema = z.object({
  id: z.string(),
  label: z.string(),
  titlePanel: titlePanelSchema.optional(),
  grid: gridSchema,
  panels: z.array(gridPanelSchema),
});

const dashboardThemeSchema = z.object({
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  backgroundColor: z.string().optional(),
  paperColor: z.string().optional(),
  textColor: z.string().optional(),
});

export const dashboardConfigSchema = z.object({
  id: z.string(),
  title: z.string(),
  titleElement: titleElementSchema.optional(),
  theme: dashboardThemeSchema.optional(),
  pages: z.array(dashboardPageSchema),
  dataSources: z.array(dataSourceSchema),
  linking: linkingSchema.optional(),
});

export function parseDashboardConfig(input: unknown) {
  return dashboardConfigSchema.parse(input);
}
