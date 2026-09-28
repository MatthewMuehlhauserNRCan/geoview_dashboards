import type { DataSourceConfig } from '../config/types';

export type DataSourceRecord = Record<string, unknown>;

export interface DataSourceProvider {
  fetch(source: DataSourceConfig): Promise<DataSourceRecord[]>;
}
