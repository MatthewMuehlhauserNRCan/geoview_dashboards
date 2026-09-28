import type { StaticFileDataSourceConfig } from '../config/types';
import type { DataSourceProvider, DataSourceRecord } from './types';

function parseCsv(text: string): DataSourceRecord[] {
  const [headerLine, ...lines] = text.trim().split('\n');
  const headers = headerLine.split(',').map((header) => header.trim());
  return lines
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const values = line.split(',');
      const record: DataSourceRecord = {};
      headers.forEach((header, index) => {
        record[header] = values[index]?.trim();
      });
      return record;
    });
}

export const staticFileSource: DataSourceProvider = {
  async fetch(source) {
    const config = source as StaticFileDataSourceConfig;
    const response = await fetch(config.url);
    if (!response.ok) {
      throw new Error(`Failed to fetch data source "${config.id}": ${response.status} ${response.statusText}`);
    }

    switch (config.format) {
      case 'json':
        return response.json();
      case 'csv':
        return parseCsv(await response.text());
      case 'excel':
        // TODO: excel parsing is deferred until a real source needs it
        throw new Error('Excel data sources are not yet supported');
      default:
        throw new Error('Unsupported static file format');
    }
  },
};
