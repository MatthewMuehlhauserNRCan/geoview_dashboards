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
    // Never auto-refetch just because a NEW component started observing this same query key
    // (e.g. switching tabs mounts a fresh set of chart/table fetchers) - TanStack caches PER QUERY
    // KEY, not per consumer, so the default staleTime:0 + refetchOnMount:true combo meant EVERY
    // tab switch re-queried every map-layer source and overwrote the one shared cache entry every
    // OTHER already-mounted consumer (e.g. a chart on a different tab) was also reading from.
    // Confirmed in practice: switching to a table panel after panning the map caused an already-
    // working chart to go blank too, with no code of its own ever re-running - purely from its
    // shared query cache entry getting silently replaced out from under it. `refetchInterval`
    // below is a separate, deliberate polling mechanism and still works independently of this.
    staleTime: Infinity,
    refetchInterval:
      source?.type === 'rest-json' && source.refresh?.mode === 'interval'
        ? (source.refresh.seconds ?? 60) * 1000
        : false,
  });
}
