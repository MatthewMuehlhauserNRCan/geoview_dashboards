import { useQuery } from '@tanstack/react-query';
import type { DataSourceConfig } from '../config/types';
import { getDataSourceProvider } from './registry';
import { useLayerReady } from '../map/registry';

export function useDataSource(sourceId: string | undefined, dataSources: DataSourceConfig[]) {
  const source = dataSources.find((candidate) => candidate.id === sourceId);

  // map-layer sources aren't ready until the specific layer they reference has actually finished
  // loading on its map panel (not just the map panel itself registering) - reactive, so the query
  // fires the moment it's ready instead of only on next remount.
  const mapLayerReady = useLayerReady(source?.type === 'map-layer' ? source.mapPanelId : '', source?.type === 'map-layer' ? source.layerId : '');
  const mapReady = source?.type !== 'map-layer' || Boolean(mapLayerReady);

  return useQuery({
    queryKey: ['data-source', source?.id],
    queryFn: () => getDataSourceProvider(source!.type).fetch(source!),
    enabled: Boolean(source) && mapReady,
    refetchInterval:
      source?.type === 'rest-json' && source.refresh?.mode === 'interval'
        ? (source.refresh.seconds ?? 60) * 1000
        : false,
  });
}
