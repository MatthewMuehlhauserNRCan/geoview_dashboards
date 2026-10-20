import { describe, expect, it } from 'vitest';
import { isFieldFilterValue, makeCompositeField, makeCompositeValue, rowMatchesFieldFilter } from './rowFilter';

describe('isFieldFilterValue', () => {
  it('accepts an object whose values are all arrays', () => {
    expect(isFieldFilterValue({ Symbol: ['Natural'] })).toBe(true);
    expect(isFieldFilterValue({})).toBe(true);
  });

  it('rejects non-objects and objects with non-array values', () => {
    expect(isFieldFilterValue(undefined)).toBe(false);
    expect(isFieldFilterValue('Natural')).toBe(false);
    expect(isFieldFilterValue({ Symbol: 'Natural' })).toBe(false);
  });
});

describe('rowMatchesFieldFilter', () => {
  it('matches everything when the filter is missing or empty', () => {
    const row = { Symbol: 'Natural' };
    expect(rowMatchesFieldFilter(row, undefined)).toBe(true);
    expect(rowMatchesFieldFilter(row, {})).toBe(true);
    expect(rowMatchesFieldFilter(row, { Symbol: [] })).toBe(true);
  });

  it('matches a row whose field value is in the selected list', () => {
    const row = { Symbol: 'Natural' };
    expect(rowMatchesFieldFilter(row, { Symbol: ['Natural', 'Modified'] })).toBe(true);
    expect(rowMatchesFieldFilter(row, { Symbol: ['Modified'] })).toBe(false);
  });

  it('requires every constrained field to match (AND across fields)', () => {
    const row = { Symbol: 'Natural', Region: 'East' };
    expect(rowMatchesFieldFilter(row, { Symbol: ['Natural'], Region: ['East'] })).toBe(true);
    expect(rowMatchesFieldFilter(row, { Symbol: ['Natural'], Region: ['West'] })).toBe(false);
  });

  it('matches composite (multi-field) classifications as one combined tuple', () => {
    const field = makeCompositeField(['Regulated', 'SampleType']);
    const row = { Regulated: 'Yes', SampleType: 'Soil' };
    const matchingValue = makeCompositeValue(['Yes', 'Soil']);
    const otherValue = makeCompositeValue(['No', 'Soil']);

    expect(rowMatchesFieldFilter(row, { [field]: [matchingValue] })).toBe(true);
    expect(rowMatchesFieldFilter(row, { [field]: [otherValue] })).toBe(false);
    // a row matching each field independently, but not as the same combined tuple, must NOT match
    expect(rowMatchesFieldFilter({ Regulated: 'No', SampleType: 'Soil' }, { [field]: [matchingValue] })).toBe(false);
  });
});
