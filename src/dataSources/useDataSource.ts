import { useQuery } from '@tanstack/react-query';
import type { DataSourceConfig } from '../config/types';
import { getDataSourceProvider } from './registry';

export function useDataSource(sourceId: string | undefined, dataSources: DataSourceConfig[]) {
  const source = dataSources.find((candidate) => candidate.id === sourceId);

  return useQuery({
    queryKey: ['data-source', source?.id],
    queryFn: () => getDataSourceProvider(source!.type).fetch(source!),
    enabled: Boolean(source),
    refetchInterval:
      source?.type === 'rest-json' && source.refresh?.mode === 'interval'
        ? (source.refresh.seconds ?? 60) * 1000
        : false,
  });
}
