import { describe, it, expect } from 'vitest';
import { fillTextTemplate } from './textTemplate';

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
