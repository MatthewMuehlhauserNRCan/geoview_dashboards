import { useEffect } from 'react';
import type { DataSourceConfig } from '../config/types';
import { useDataSource } from './useDataSource';
import { useMapHandle } from '../map/registry';

// Shape every "combine several data sources into one panel" config needs at minimum - chart's
// own `sources[]` entries carry extra fields (e.g. `color`) but are still assignable here.
export interface MultiSourceEntry {
  dataSourceId: string;
  label?: string;
}

export interface SourceRowsResult {
  label: string;
  rows: Record<string, unknown>[];
  isLoading: boolean;
  error: boolean;
  // only set for a `map-layer` data source - lets a consumer (e.g. a merged table's per-row
  // zoom-to-feature) still address the right map/layer for rows that came from this source.
  mapPanelId?: string;
  layerId?: string;
}

interface SourceRowsFetcherProps {
  source: MultiSourceEntry;
  dataSources: DataSourceConfig[];
  onResult: (dataSourceId: string, result: SourceRowsResult) => void;
}

// Invisible - fetches ONE data source and reports its rows/default label up to a parent
// "combine several data sources" panel (chart multi-source mode, table multi-source mode), so a
// variable number of sources can each own their own hooks safely (rules-of-hooks - one component
// instance per source, not a dynamic number of hook calls inside a single component).
export function SourceRowsFetcher({ source, dataSources, onResult }: SourceRowsFetcherProps) {
  const { data, isLoading, error } = useDataSource(source.dataSourceId, dataSources);
  const matchedSource = dataSources.find((d) => d.id === source.dataSourceId);
  const isMapLayer = matchedSource?.type === 'map-layer';
  const mapPanelId = isMapLayer ? matchedSource.mapPanelId : undefined;
  const layerId = isMapLayer ? matchedSource.layerId : undefined;
  const mapHandle = useMapHandle(mapPanelId ?? '');
  const defaultLabel = isMapLayer ? mapHandle?.listLayers().find((l) => l.id === layerId)?.name : undefined;
  const label = source.label ?? defaultLabel ?? source.dataSourceId;

  useEffect(() => {
    onResult(source.dataSourceId, { label, rows: data ?? [], isLoading, error: Boolean(error), mapPanelId, layerId });
  }, [source.dataSourceId, label, data, isLoading, error, onResult, mapPanelId, layerId]);

  return null;
}
