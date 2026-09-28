import type { RestJsonDataSourceConfig } from '../config/types';
import type { DataSourceProvider } from './types';

export const restJsonSource: DataSourceProvider = {
  async fetch(source) {
    const config = source as RestJsonDataSourceConfig;
    const response = await fetch(config.url);
    if (!response.ok) {
      throw new Error(`Failed to fetch data source "${config.id}": ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    return Array.isArray(data) ? data : [data];
  },
};
