import type { StatPanelConfig, DataSourceConfig } from '../config/types';
import { PanelContainer } from './PanelContainer';
import { useDataSource } from '../dataSources/useDataSource';

interface StatPanelProps {
  panel: StatPanelConfig;
  dataSources: DataSourceConfig[];
}

export function StatPanel({ panel, dataSources }: StatPanelProps) {
  const { data, isLoading } = useDataSource(panel.dataSource, dataSources);

  return (
    <PanelContainer title={panel.title}>
      <div style={{ fontSize: '2rem' }}>{isLoading ? '…' : (data?.length ?? 0)}</div>
    </PanelContainer>
  );
}
