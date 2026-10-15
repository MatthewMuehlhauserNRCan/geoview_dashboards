import { useQuery } from '@tanstack/react-query';
import type { DataSourceConfig } from '../config/types';
import { getDataSourceProvider } from './registry';
import { useMapHandle } from '../map/registry';

export function useDataSource(sourceId: string | undefined, dataSources: DataSourceConfig[]) {
  const source = dataSources.find((candidate) => candidate.id === sourceId);

  // map-layer sources aren't ready until their map panel has registered its handle
  const mapHandle = useMapHandle(source?.type === 'map-layer' ? source.mapPanelId : '');
  const mapReady = source?.type !== 'map-layer' || Boolean(mapHandle);

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
