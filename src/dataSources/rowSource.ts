// Non-enumerable property (same technique as src/map/rowExtent.ts) carrying which data source a
// row came from, when rows from SEVERAL data sources have been merged into one array (e.g. a
// multi-source table) - needed for a "Source" column and for per-row zoom-to-feature, since a
// merged table's rows no longer all share one schema/layer the way a single-source table's do.
const ROW_SOURCE_KEY = '__rowSource';

export interface RowSource {
  dataSourceId: string;
  label: string;
  // only present for a `map-layer` data source - lets a merged row still be zoomed-to/highlighted
  // on its own originating map, even though the table itself no longer has just one layerId.
  mapPanelId?: string;
  layerId?: string;
}

export function setRowSource(row: Record<string, unknown>, source: RowSource): void {
  Object.defineProperty(row, ROW_SOURCE_KEY, { value: source, enumerable: false, configurable: true });
}

export function getRowSource(row: Record<string, unknown>): RowSource | undefined {
  return row[ROW_SOURCE_KEY] as RowSource | undefined;
}
