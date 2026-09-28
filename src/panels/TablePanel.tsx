import type { TablePanelConfig, DataSourceConfig } from '../config/types';
import { PanelContainer } from './PanelContainer';
import { useDataSource } from '../dataSources/useDataSource';
import { useListenChannel } from '../linking/useChannel';

interface TablePanelProps {
  panel: TablePanelConfig;
  dataSources: DataSourceConfig[];
}

export function TablePanel({ panel, dataSources }: TablePanelProps) {
  const { data, isLoading, error } = useDataSource(panel.dataSource, dataSources);
  const listenChannel = panel.interactions?.listensTo?.[0] ?? '';
  const filterValue = useListenChannel(listenChannel);

  if (isLoading) return <PanelContainer title={panel.title}>Loading…</PanelContainer>;
  if (error) return <PanelContainer title={panel.title}>Failed to load data</PanelContainer>;

  const rows = data ?? [];
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

  return (
    <PanelContainer title={panel.title}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column} style={{ textAlign: 'left' }}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {columns.map((column) => (
                <td key={column}>{String(row[column])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {/* TODO: apply filterValue as an actual row filter once the query/transform layer is built */}
      {filterValue !== undefined && <div>Linked selection: {JSON.stringify(filterValue)}</div>}
    </PanelContainer>
  );
}
