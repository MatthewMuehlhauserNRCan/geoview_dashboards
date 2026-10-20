import { describe, expect, it } from 'vitest';
import { toPercentFromWeights } from './layoutUtils';

describe('toPercentFromWeights', () => {
  it('splits equal weights into equal percentages', () => {
    expect(toPercentFromWeights([1, 1])).toEqual({ '0': 50, '1': 50 });
    const thirds = toPercentFromWeights([1, 1, 1]);
    expect(thirds['0']).toBeCloseTo(100 / 3);
    expect(thirds['1']).toBeCloseTo(100 / 3);
    expect(thirds['2']).toBeCloseTo(100 / 3);
  });

  it('weighs unequal fr-like values proportionally', () => {
    expect(toPercentFromWeights([1, 3])).toEqual({ '0': 25, '1': 75 });
  });

  it('keys the result by child index as a string, in input order', () => {
    const result = toPercentFromWeights([2, 1, 1]);
    expect(Object.keys(result)).toEqual(['0', '1', '2']);
    expect(result['0']).toBe(50);
  });
});
