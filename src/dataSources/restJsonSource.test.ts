import { describe, it, expect } from 'vitest';
import { normalizeRestJsonRows } from './restJsonSource';

describe('normalizeRestJsonRows', () => {
  it('unwraps an ArcGIS FeatureSet into flat attribute rows', () => {
    const data = {
      features: [{ attributes: { OBJECTID: 1, Name: 'a' } }, { attributes: { OBJECTID: 2, Name: 'b' } }],
    };
    expect(normalizeRestJsonRows(data)).toEqual([
      { OBJECTID: 1, Name: 'a' },
      { OBJECTID: 2, Name: 'b' },
    ]);
  });

  it('treats an empty FeatureSet as zero rows', () => {
    expect(normalizeRestJsonRows({ features: [] })).toEqual([]);
  });

  it('passes a plain array through unchanged', () => {
    const data = [{ a: 1 }, { a: 2 }];
    expect(normalizeRestJsonRows(data)).toEqual(data);
  });

  it('wraps a single plain object as one row', () => {
    expect(normalizeRestJsonRows({ a: 1 })).toEqual([{ a: 1 }]);
  });
});
