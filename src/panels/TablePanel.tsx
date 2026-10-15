import { useMemo } from 'react';
import { MaterialReactTable, type MRT_ColumnDef } from 'material-react-table';
import type { TablePanelConfig, DataSourceConfig } from '../config/types';
import { PanelContainer } from './PanelContainer';
import { useDataSource } from '../dataSources/useDataSource';
import { useListenChannel } from '../linking/useChannel';
import { isFieldFilterValue, rowMatchesFieldFilter } from '../linking/rowFilter';

interface TablePanelProps {
  panel: TablePanelConfig;
  dataSources: DataSourceConfig[];
}

type Row = Record<string, unknown>;

export function TablePanel({ panel, dataSources }: TablePanelProps) {
  const { data, isLoading, error } = useDataSource(panel.dataSource, dataSources);
  const listenChannel = panel.interactions?.listensTo?.[0] ?? '';
  const filterValue = useListenChannel(listenChannel);

  // Only a field-filter channel (e.g. the shared cross-filter) actually narrows rows here - any
  // other channel shape (e.g. a single clicked row from an older/unrelated linking setup) is a
  // no-op, so this stays safe to wire to either kind of channel.
  const rows = useMemo(() => (data ?? []).filter((row) => rowMatchesFieldFilter(row, filterValue)), [data, filterValue]);
  const columns = useMemo<MRT_ColumnDef<Row>[]>(() => {
    const columnKeys = rows.length > 0 ? Object.keys(rows[0]) : [];
    return columnKeys.map((key) => ({
      accessorKey: key,
      header: key,
      Cell: ({ cell }) => <CellValue value={cell.getValue()} />,
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
        {filterValue !== undefined && !isFieldFilterValue(filterValue) && <div>Linked selection: {JSON.stringify(filterValue)}</div>}
      </div>
    </PanelContainer>
  );
}

// Nested objects (e.g. address/company fields) can't be rendered directly as a React child.
function stringifyCellValue(value: unknown): string {
  return typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value);
}

// Some feature-service fields come back as an `<a href="...">label</a>` string rather than a
// plain value (e.g. ESRI "hyperlink" fields) - render those as a real, clickable link instead of
// the raw markup. Parsed via DOMParser (not dangerouslySetInnerHTML) and restricted to http(s)
// hrefs so untrusted field data can't inject a `javascript:`/`data:` URI or arbitrary markup.
function parseAnchorTag(value: string): { href: string; text: string } | null {
  if (!/^\s*<a\b/i.test(value)) return null;
  const anchor = new DOMParser().parseFromString(value, 'text/html').querySelector('a');
  if (!anchor) return null;
  const href = anchor.getAttribute('href');
  if (!href || !/^https?:\/\//i.test(href)) return null;
  return { href, text: anchor.textContent || href };
}

function CellValue({ value }: { value: unknown }) {
  if (typeof value === 'string') {
    const anchor = parseAnchorTag(value);
    if (anchor) {
      return (
        <a href={anchor.href} target="_blank" rel="noopener noreferrer">
          {anchor.text}
        </a>
      );
    }
  }
  return <>{stringifyCellValue(value)}</>;
}
