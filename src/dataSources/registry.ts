import type { DataSourceConfig } from '../config/types';
import type { DataSourceProvider } from './types';
import { restJsonSource } from './restJsonSource';
import { staticFileSource } from './staticFileSource';
import { mapLayerSource } from './mapLayerSource';

const providers: Record<DataSourceConfig['type'], DataSourceProvider> = {
  'rest-json': restJsonSource,
  'static-file': staticFileSource,
  'map-layer': mapLayerSource,
};

export function getDataSourceProvider(type: DataSourceConfig['type']): DataSourceProvider {
  const provider = providers[type];
  if (!provider) {
    throw new Error(`No data source provider registered for type "${type}"`);
  }
  return provider;
}
