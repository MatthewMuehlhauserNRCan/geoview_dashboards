import { describe, it, expect } from 'vitest';
import { fillTextTemplate, renderTextTemplate } from './textTemplate';

describe('fillTextTemplate', () => {
  it('substitutes {{field}} placeholders from the row', () => {
    const row = { Header1_EN: 'National Overview', Text1_EN: 'Rain and wind.' };
    expect(fillTextTemplate('## {{Header1_EN}}\n\n{{Text1_EN}}', row)).toBe('## National Overview\n\nRain and wind.');
  });

  it('renders an empty string for a missing field', () => {
    expect(fillTextTemplate('{{Missing}}', { a: 1 })).toBe('');
  });

  it('renders every placeholder empty when there is no row', () => {
    expect(fillTextTemplate('## {{Header1_EN}}', undefined)).toBe('## ');
  });

  it('tolerates whitespace inside the placeholder', () => {
    expect(fillTextTemplate('{{ Header1_EN }}', { Header1_EN: 'Overview' })).toBe('Overview');
  });
});

describe('renderTextTemplate', () => {
  const rows = [{ name: 'A' }, { name: 'B' }, { name: 'C' }];

  it('repeats the template once per row, joined by a rule, when repeatForAllRows is true', () => {
    expect(renderTextTemplate('{{name}}', rows, true)).toBe('A\n\n---\n\nB\n\n---\n\nC');
  });

  it('uses only the first row when repeatForAllRows is false', () => {
    expect(renderTextTemplate('{{name}}', rows, false)).toBe('A');
  });

  it('does not add a separator for a single row even when repeating', () => {
    expect(renderTextTemplate('{{name}}', [{ name: 'A' }], true)).toBe('A');
  });

  it('falls back to an empty-row render when there are no rows at all', () => {
    expect(renderTextTemplate('{{name}}', [], true)).toBe('');
    expect(renderTextTemplate('{{name}}', undefined, true)).toBe('');
  });
});

