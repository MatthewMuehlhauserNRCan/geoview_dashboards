import { useEffect, useMemo } from 'react';
import { Autocomplete, Stack, TextField } from '@mui/material';
import type { DataSourceConfig, FilterPanelConfig } from '../config/types';
import { PanelContainer } from './PanelContainer';
import { useDataSource } from '../dataSources/useDataSource';
import { useMapHandle } from '../map/registry';
import { useListenChannel, useSetChannelField } from '../linking/useChannel';
import { isFieldFilterValue, type FieldFilterValue } from '../linking/rowFilter';
import { buildFilterExpression } from '../map/filterExpression';

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

