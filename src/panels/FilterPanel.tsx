import { useEffect, useMemo } from 'react';
import { Autocomplete, Stack, TextField } from '@mui/material';
import type { DataSourceConfig, FilterPanelConfig } from '../config/types';
import { PanelContainer } from './PanelContainer';
import { useDataSource } from '../dataSources/useDataSource';
import { useMapHandle } from '../map/registry';
import { useListenChannel, useSetChannelField } from '../linking/useChannel';
import { isFieldFilterValue, type FieldFilterValue } from '../linking/rowFilter';

interface FilterPanelProps {
  panel: FilterPanelConfig;
  dataSources: DataSourceConfig[];
}

export function FilterPanel({ panel, dataSources }: FilterPanelProps) {
  const source = dataSources.find((candidate) => candidate.id === panel.dataSource);
  const mapSource = source?.type === 'map-layer' ? source : undefined;

  const { data } = useDataSource(panel.dataSource, dataSources);
  const mapHandle = useMapHandle(mapSource?.mapPanelId ?? '');
  const rows = useMemo(() => data ?? [], [data]);

  // The combined cross-filter lives on a shared linking channel (not local state), so other
  // contributors - e.g. a chart's click-to-select - can merge their own field into the SAME
  // filter this panel's dropdowns edit, instead of each owning a separate, conflicting filter.
  const channel = panel.interactions?.emits?.[0] ?? '';
  const rawFilterValue = useListenChannel(channel);
  const filterValue: FieldFilterValue | undefined = isFieldFilterValue(rawFilterValue) ? rawFilterValue : undefined;
  const setField = useSetChannelField(channel);

  const fieldOptions = useMemo(() => {
    const options: Record<string, string[]> = {};
    for (const { field } of panel.fields) {
      const values = new Set<string>();
      for (const row of rows) {
        const value = row[field];
        if (value !== null && value !== undefined && value !== '') values.add(String(value));
      }
      options[field] = Array.from(values).sort();
    }
    return options;
  }, [rows, panel.fields]);

  // Pushes the FULL combined filter (every contributor's field, not just this panel's own dropdowns)
  // straight to the GeoView layer whenever it changes or the map becomes ready.
  useEffect(() => {
    if (!mapHandle || !mapSource) return;
    mapHandle.setLayerFilter(mapSource.layerId, buildFilterExpression(filterValue));
  }, [mapHandle, mapSource, filterValue]);

  if (!mapSource) {
    return <PanelContainer title={panel.title}>Filter panel needs a "map-layer" dataSource configured</PanelContainer>;
  }

  return (
    <PanelContainer title={panel.title}>
      <Stack spacing={2}>
        {panel.fields.map(({ field, label }) => (
          <Autocomplete
            key={field}
            multiple
            size="small"
            options={fieldOptions[field] ?? []}
            value={filterValue?.[field] ?? []}
            onChange={(_event, value) => setField(field, value)}
            renderInput={(params) => <TextField {...params} label={label ?? field} />}
          />
        ))}
      </Stack>
    </PanelContainer>
  );
}

// Combines every active field's selected values into a single SQL-like WHERE expression (GeoView's
// layer filters are plain SQL-like string fragments - see docs/programming/layer-filters.md),
// e.g. `(E_Regulated IN ('Yes')) AND (Symbol IN ('A'))`. Fields with no selection are omitted
// entirely (no constraint), and `undefined` is returned (clears the filter) when nothing is set.
function buildFilterExpression(filter: FieldFilterValue | undefined): string | undefined {
  if (!filter) return undefined;
  const clauses = Object.entries(filter)
    .filter(([, values]) => values.length > 0)
    .map(([field, values]) => `${field} IN (${values.map(formatValue).join(', ')})`);

  if (clauses.length === 0) return undefined;
  return clauses.length === 1 ? clauses[0] : clauses.map((clause) => `(${clause})`).join(' AND ');
}

// Numeric fields must be unquoted (`Symbol IN (1, 2)`) - quoting them (`IN ('1', '2')`) compares
// a string literal against a numeric column, which GeoView/ESRI never matches, silently filtering
// out every feature. Only genuinely non-numeric values get SQL string-literal quoting/escaping.
function formatValue(value: string): string {
  return value.trim() !== '' && !Number.isNaN(Number(value)) ? value : quoteValue(value);
}

function quoteValue(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

