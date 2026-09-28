import type { ChartPanelConfig, DataSourceConfig } from '../config/types';
import { PanelContainer } from './PanelContainer';
import { useDataSource } from '../dataSources/useDataSource';
import { useEmitChannel } from '../linking/useChannel';

interface ChartPanelProps {
  panel: ChartPanelConfig;
  dataSources: DataSourceConfig[];
}

// TODO: render an actual chart (ECharts/Vega-Lite) once the chart library is chosen;
// clicking a row stands in for a chart selection to demonstrate the linking channel.
export function ChartPanel({ panel, dataSources }: ChartPanelProps) {
  const { data, isLoading, error } = useDataSource(panel.dataSource, dataSources);
  const emitChannel = panel.interactions?.emits?.[0];
  const emit = useEmitChannel(emitChannel ?? '');

  if (isLoading) return <PanelContainer title={panel.title}>Loading…</PanelContainer>;
  if (error) return <PanelContainer title={panel.title}>Failed to load data</PanelContainer>;

  const rows = data ?? [];

  return (
    <PanelContainer title={panel.title}>
      <div>
        Chart placeholder ({panel.chartType}) — {rows.length} records
      </div>
      {emitChannel && (
        <ul>
          {rows.slice(0, 5).map((row, index) => (
            <li key={index}>
              <button type="button" onClick={() => emit(row)}>
                {JSON.stringify(row)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </PanelContainer>
  );
}
