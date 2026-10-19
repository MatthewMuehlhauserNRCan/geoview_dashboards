import { Typography } from '@mui/material';

import type { StatPanelConfig, DataSourceConfig } from '../config/types';
import { PanelContainer } from './PanelContainer';
import { useDataSource } from '../dataSources/useDataSource';
import { useListenChannels } from '../linking/useChannel';
import { rowMatchesFieldFilter } from '../linking/rowFilter';

interface StatPanelProps {
  panel: StatPanelConfig;
  dataSources: DataSourceConfig[];
}

export function StatPanel({ panel, dataSources }: StatPanelProps) {
  const { data, isLoading } = useDataSource(panel.dataSource, dataSources);
  // Merges every listened channel (e.g. a shared filter panel's channel AND a legend's own,
  // separate channel) into one combined filter, so this stat reacts to all of them at once.
  const filterValue = useListenChannels(panel.interactions?.listensTo ?? []);
  // The data source always returns the layer's full, unfiltered feature set (same as GeoView's
  // own data table) - a linked filter panel's selection is applied here, client-side, instead.
  const count = (data ?? []).filter((row) => rowMatchesFieldFilter(row, filterValue)).length;

  return (
    <PanelContainer title={panel.title} centerContent>
      <Typography sx={{ fontSize: '2rem' }}>{isLoading ? '…' : count}</Typography>
    </PanelContainer>
  );
}
