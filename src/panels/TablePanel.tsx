import { useMemo } from 'react';
import { MaterialReactTable, type MRT_ColumnDef } from 'material-react-table';
import { IconButton, Tooltip } from '@mui/material';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import type { TablePanelConfig, DataSourceConfig } from '../config/types';
import { PanelContainer } from './PanelContainer';
import { useDataSource } from '../dataSources/useDataSource';
import { useListenChannels } from '../linking/useChannel';
import { rowMatchesFieldFilter } from '../linking/rowFilter';
import { useMapHandle } from '../map/registry';

interface TablePanelProps {
  panel: TablePanelConfig;
  dataSources: DataSourceConfig[];
}

type Row = Record<string, unknown>;

export function TablePanel({ panel, dataSources }: TablePanelProps) {
  const { data, isLoading, error } = useDataSource(panel.dataSource, dataSources);
  // Only a "map-layer" source has a real map feature behind each row to zoom to/highlight.
  const sourceConfig = dataSources.find((source) => source.id === panel.dataSource);
  const isMapLayerSource = sourceConfig?.type === 'map-layer';
  const mapHandle = useMapHandle(isMapLayerSource ? sourceConfig.mapPanelId : '');
  const layerId = isMapLayerSource ? sourceConfig.layerId : undefined;
  // All-or-nothing per layer (not per row) - auto-detected unless the author overrides it.
  const canZoomToFeature = Boolean(mapHandle && layerId) && (panel.showZoomToFeature ?? mapHandle!.canZoomToFeature(layerId!));
  // Merges every listened channel (e.g. a shared filter panel's channel AND a legend's own,
  // separate channel) into one combined filter, so this table reacts to all of them at once.
  const filterValue = useListenChannels(panel.interactions?.listensTo ?? []);
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
      <MaterialReactTable
        columns={columns}
        data={rows}
        enableStickyHeader
        initialState={{ density: 'compact' }}
        muiTablePaperProps={{ sx: { height: '100%', display: 'flex', flexDirection: 'column' } }}
        muiTableContainerProps={{ sx: { flex: 1 } }}
        // Same "zoom to feature" affordance GeoView's own data table has (zooms the map to the
        // feature's extent and highlights it) - all-or-nothing for the whole layer, not a per-row
        // check, since every row of a layer shares the same schema.
        {...(canZoomToFeature && {
          enableRowActions: true,
          positionActionsColumn: 'first',
          displayColumnDefOptions: { 'mrt-row-actions': { header: '', size: 50, grow: false } },
          renderRowActions: ({ row }: { row: { original: Row } }) => (
            <Tooltip title="Zoom to feature">
              <IconButton size="small" color="primary" onClick={() => void mapHandle!.zoomToFeature(layerId!, row.original)}>
                <ZoomInIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          ),
        })}
      />
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
