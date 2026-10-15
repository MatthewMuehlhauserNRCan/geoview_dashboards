import type { StatPanelConfig, DataSourceConfig } from '../config/types';
import { PanelContainer } from './PanelContainer';
import { useDataSource } from '../dataSources/useDataSource';
import { useListenChannel } from '../linking/useChannel';
import { rowMatchesFieldFilter } from '../linking/rowFilter';

interface StatPanelProps {
  panel: StatPanelConfig;
  dataSources: DataSourceConfig[];
}

export function StatPanel({ panel, dataSources }: StatPanelProps) {
  const { data, isLoading } = useDataSource(panel.dataSource, dataSources);
  const filterValue = useListenChannel(panel.interactions?.listensTo?.[0] ?? '');
  // The data source always returns the layer's full, unfiltered feature set (same as GeoView's
  // own data table) - a linked filter panel's selection is applied here, client-side, instead.
  const count = (data ?? []).filter((row) => rowMatchesFieldFilter(row, filterValue)).length;

  return (
    <PanelContainer title={panel.title}>
      <div style={{ fontSize: '2rem' }}>{isLoading ? '…' : count}</div>
    </PanelContainer>
  );
}
