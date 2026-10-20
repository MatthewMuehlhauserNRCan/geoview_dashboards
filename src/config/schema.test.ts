import { describe, expect, it } from 'vitest';
import { parseDashboardConfig } from './schema';
import { sampleDashboardConfig } from '../app/sampleConfig';

describe('parseDashboardConfig', () => {
  it('accepts the app\'s own real sample config unchanged', () => {
    expect(() => parseDashboardConfig(sampleDashboardConfig)).not.toThrow();
  });

  it('rejects a config missing required top-level fields', () => {
    expect(() => parseDashboardConfig({})).toThrow();
    expect(() => parseDashboardConfig({ id: 'x', title: 'x' })).toThrow();
  });

  it('rejects a panel of an unknown type', () => {
    const invalid = {
      id: 'd',
      title: 'Dashboard',
      dataSources: [],
      pages: [
        {
          id: 'p',
          label: 'Page',
          grid: { columns: 1, rows: 1 },
          panels: [{ id: 'bad', type: 'not-a-real-type', layout: { col: 1, row: 1 } }],
        },
      ],
    };
    expect(() => parseDashboardConfig(invalid)).toThrow();
  });

  it('rejects a text panel with neither content nor contentUrl', () => {
    const invalid = {
      id: 'd',
      title: 'Dashboard',
      dataSources: [],
      pages: [
        {
          id: 'p',
          label: 'Page',
          grid: { columns: 1, rows: 1 },
          panels: [{ id: 'txt', type: 'text', layout: { col: 1, row: 1 } }],
        },
      ],
    };
    expect(() => parseDashboardConfig(invalid)).toThrow();
  });
});
