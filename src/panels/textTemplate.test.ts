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

  it('keeps a conditional section when its field is non-empty, substituting inside it', () => {
    const template = '{{#Activities}}**Activities**\n{{Activities}}{{/Activities}}';
    expect(fillTextTemplate(template, { Activities: 'Flooding response' })).toBe('**Activities**\nFlooding response');
  });

  it('drops a conditional section entirely when its field is missing/null/blank', () => {
    const template = 'before {{#Activities}}**Activities**\n{{Activities}}{{/Activities}} after';
    expect(fillTextTemplate(template, { Activities: '' })).toBe('before  after');
    expect(fillTextTemplate(template, { Activities: null })).toBe('before  after');
    expect(fillTextTemplate(template, {})).toBe('before  after');
    expect(fillTextTemplate(template, undefined)).toBe('before  after');
  });

  it('treats a real 0 or false value as present, not empty', () => {
    expect(fillTextTemplate('{{#Count}}Count: {{Count}}{{/Count}}', { Count: 0 })).toBe('Count: 0');
    expect(fillTextTemplate('{{#Flag}}Flag: {{Flag}}{{/Flag}}', { Flag: false })).toBe('Flag: false');
  });

  it('handles multiple independent conditional sections in one template', () => {
    const template = '{{#A}}A: {{A}}{{/A}}|{{#B}}B: {{B}}{{/B}}';
    expect(fillTextTemplate(template, { A: 'x' })).toBe('A: x|');
    expect(fillTextTemplate(template, { B: 'y' })).toBe('|B: y');
  });

  it('supports a differently-named section nested inside another', () => {
    const template = '{{#A}}outer {{#B}}inner {{B}}{{/B}} end{{/A}}';
    expect(fillTextTemplate(template, { A: 'x', B: 'y' })).toBe('outer inner y end');
    expect(fillTextTemplate(template, { A: 'x' })).toBe('outer  end');
    expect(fillTextTemplate(template, {})).toBe('');
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

