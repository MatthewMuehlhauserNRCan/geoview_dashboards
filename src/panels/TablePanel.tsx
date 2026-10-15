import { useMemo } from 'react';
import { MaterialReactTable, type MRT_ColumnDef } from 'material-react-table';
import type { TablePanelConfig, DataSourceConfig } from '../config/types';
import { PanelContainer } from './PanelContainer';
import { useDataSource } from '../dataSources/useDataSource';
import { useListenChannel } from '../linking/useChannel';

interface TablePanelProps {
  panel: TablePanelConfig;
  dataSources: DataSourceConfig[];
}

type Row = Record<string, unknown>;

export function TablePanel({ panel, dataSources }: TablePanelProps) {
  const { data, isLoading, error } = useDataSource(panel.dataSource, dataSources);
  const listenChannel = panel.interactions?.listensTo?.[0] ?? '';
  const filterValue = useListenChannel(listenChannel);

  const rows = useMemo(() => data ?? [], [data]);
  const columns = useMemo<MRT_ColumnDef<Row>[]>(() => {
    const columnKeys = rows.length > 0 ? Object.keys(rows[0]) : [];
    return columnKeys.map((key) => ({
      accessorKey: key,
      header: key,
      Cell: ({ cell }) => stringifyCellValue(cell.getValue()),
    }));
  }, [rows]);

  if (isLoading) return <PanelContainer title={panel.title}>Loading…</PanelContainer>;
  if (error) return <PanelContainer title={panel.title}>Failed to load data</PanelContainer>;

  return (
    // material-react-table already has its own fullscreen toggle, so this panel doesn't need ours too;
    // bodyOverflow="hidden" hands scrolling over to MRT's own table container (below) instead of
    // scrolling the whole panel, so MRT can scroll vertically and horizontally in one place.
    <PanelContainer title={panel.title} expandable={false} bodyOverflow="hidden" disablePadding>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
        <div style={{ flex: 1, minHeight: 0 }}>
          <MaterialReactTable
            columns={columns}
            data={rows}
            enableStickyHeader
            initialState={{ density: 'compact' }}
            muiTablePaperProps={{ sx: { height: '100%', display: 'flex', flexDirection: 'column' } }}
            muiTableContainerProps={{ sx: { flex: 1 } }}
          />
        </div>
        {/* TODO: apply filterValue as an actual row filter once the query/transform layer is built */}
        {filterValue !== undefined && <div>Linked selection: {JSON.stringify(filterValue)}</div>}
      </div>
    </PanelContainer>
  );
}

// Nested objects (e.g. address/company fields) can't be rendered directly as a React child.
function stringifyCellValue(value: unknown): string {
  return typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value);
}
