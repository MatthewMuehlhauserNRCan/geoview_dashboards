import { useCallback, useMemo, useState } from 'react';
import { MaterialReactTable, type MRT_ColumnDef } from 'material-react-table';
import { FormControlLabel, IconButton, Switch, Tooltip } from '@mui/material';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import type { TablePanelConfig, DataSourceConfig } from '../config/types';
import { PanelContainer } from './PanelContainer';
import { useDataSource } from '../dataSources/useDataSource';
import { useListenChannels } from '../linking/useChannel';
import { rowMatchesFieldFilter, getViewExtentFromFilter } from '../linking/rowFilter';
import { rowPassesViewExtent } from '../map/rowExtent';
import { getMapHandle, useMapHandle } from '../map/registry';
import { SourceRowsFetcher, type SourceRowsResult } from '../dataSources/SourceRowsFetcher';
import { setRowSource, getRowSource } from '../dataSources/rowSource';

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
  // Only defined once some listened channel is actually carrying a map's current view extent
  // (see MapPanelConfig's `interactions.emits` doc) - the toggle below only appears then too.
  const viewExtent = useMemo(() => getViewExtentFromFilter(filterValue), [filterValue]);
  const [filterToMapView, setFilterToMapView] = useState(panel.filterToMapView ?? true);
  const rows = useMemo(() => {
    const fieldFiltered = (data ?? []).filter((row) => rowMatchesFieldFilter(row, filterValue));
    return viewExtent && filterToMapView ? fieldFiltered.filter((row) => rowPassesViewExtent(row, viewExtent)) : fieldFiltered;
  }, [data, filterValue, viewExtent, filterToMapView]);
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

  // Multi-source mode (one merged table from several data sources) is a completely different
  // data shape from everything above (single data source) - delegate to its own component rather
  // than threading it through the single-source branches here.
  if (panel.sources && panel.sources.length > 0) {
    return <MultiSourceTable panel={panel} dataSources={dataSources} sources={panel.sources} />;
  }

  return (
    // material-react-table already has its own fullscreen toggle, so this panel doesn't need ours too;
    // bodyOverflow="hidden" hands scrolling over to MRT's own table container (below) instead of
    // scrolling the whole panel, so MRT can scroll vertically and horizontally in one place.
    <PanelContainer
      title={panel.title}
      expandable={false}
      bodyOverflow="hidden"
      disablePadding
      headerAction={
        viewExtent && (
          <FormControlLabel
            sx={{ m: 0, bgcolor: 'background.paper' }}
            control={<Switch size="small" checked={filterToMapView} onChange={(e) => setFilterToMapView(e.target.checked)} />}
            label="Map view"
          />
        )
      }
    >
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
              <IconButton
                size="small"
                color="primary"
                aria-label="Zoom to feature"
                onClick={() => void mapHandle!.zoomToFeature(layerId!, row.original)}
              >
                <ZoomInIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          ),
        })}
      />
    </PanelContainer>
  );
}

type TableSource = NonNullable<TablePanelConfig['sources']>[number];

interface MultiSourceTableProps {
  panel: TablePanelConfig;
  dataSources: DataSourceConfig[];
  sources: TableSource[];
}

// Merges rows from SEVERAL data sources into one table (e.g. every sublayer of a group layer)
// instead of needing a separate tab per layer - each row is tagged with its originating source
// (src/dataSources/rowSource.ts) so a "Source" column can identify it and zoom-to-feature can
// still resolve the right map/layer per row, since a merged table's rows no longer all share one
// schema/layer the way a single-source table's do.
function MultiSourceTable({ panel, dataSources, sources }: MultiSourceTableProps) {
  const [results, setResults] = useState<Record<string, SourceRowsResult>>({});
  const handleResult = useCallback((dataSourceId: string, result: SourceRowsResult) => {
    setResults((prev) => ({ ...prev, [dataSourceId]: result }));
  }, []);

  const isLoading = sources.some((s) => results[s.dataSourceId]?.isLoading ?? true);
  const hasError = sources.some((s) => results[s.dataSourceId]?.error);

  const filterValue = useListenChannels(panel.interactions?.listensTo ?? []);
  const viewExtent = useMemo(() => getViewExtentFromFilter(filterValue), [filterValue]);
  const [filterToMapView, setFilterToMapView] = useState(panel.filterToMapView ?? true);

  const rows = useMemo(() => {
    const merged: Row[] = [];
    for (const source of sources) {
      const result = results[source.dataSourceId];
      if (!result) continue;
      for (const row of result.rows) {
        if (!rowMatchesFieldFilter(row, filterValue)) continue;
        if (viewExtent && filterToMapView && !rowPassesViewExtent(row, viewExtent)) continue;
        setRowSource(row, { dataSourceId: source.dataSourceId, label: result.label, mapPanelId: result.mapPanelId, layerId: result.layerId });
        merged.push(row);
      }
    }
    return merged;
  }, [sources, results, filterValue, viewExtent, filterToMapView]);

  // Per row (not per layer like the single-source case above) - a merged table's rows can come
  // from layers of genuinely different types/capabilities, so "every row gets it or none do"
  // doesn't hold here. `showZoomToFeature: false` still always hides it entirely either way.
  const canZoomToFeature = useCallback(
    (row: Row): boolean => {
      if (panel.showZoomToFeature === false) return false;
      const source = getRowSource(row);
      if (!source?.mapPanelId || !source.layerId) return false;
      return Boolean(getMapHandle(source.mapPanelId)?.canZoomToFeature(source.layerId));
    },
    [panel.showZoomToFeature],
  );
  const showZoomColumn = panel.showZoomToFeature !== false && rows.some((row) => canZoomToFeature(row));

  const columns = useMemo<MRT_ColumnDef<Row>[]>(() => {
    const columnKeys = collectColumnKeys(rows);
    return [
      { id: '__source', header: 'Source', accessorFn: (row) => getRowSource(row)?.label ?? '', size: 140 },
      ...columnKeys.map((key) => ({
        accessorKey: key,
        header: key,
        Cell: ({ cell }: { cell: { getValue: () => unknown } }) => <CellValue value={cell.getValue()} />,
      })),
    ];
  }, [rows]);

  if (hasError) {
    return (
      <PanelContainer title={panel.title}>
        {sources.map((s) => (
          <SourceRowsFetcher key={s.dataSourceId} source={s} dataSources={dataSources} onResult={handleResult} />
        ))}
        One or more data sources failed to load
      </PanelContainer>
    );
  }

  return (
    <PanelContainer
      title={panel.title}
      expandable={false}
      bodyOverflow="hidden"
      disablePadding
      headerAction={
        viewExtent && (
          <FormControlLabel
            sx={{ m: 0, bgcolor: 'background.paper' }}
            control={<Switch size="small" checked={filterToMapView} onChange={(e) => setFilterToMapView(e.target.checked)} />}
            label="Map view"
          />
        )
      }
    >
      {/* Rendered unconditionally (not gated behind isLoading) - these are what actually DRIVE
          isLoading to false in the first place, via onResult; an early return before they ever
          mount would leave every source's isLoading flag stuck at its initial `true` forever. */}
      {sources.map((s) => (
        <SourceRowsFetcher key={s.dataSourceId} source={s} dataSources={dataSources} onResult={handleResult} />
      ))}
      {isLoading ? (
        'Loading…'
      ) : (
        <MaterialReactTable
          columns={columns}
          data={rows}
          enableStickyHeader
          initialState={{ density: 'compact' }}
          muiTablePaperProps={{ sx: { height: '100%', display: 'flex', flexDirection: 'column' } }}
          muiTableContainerProps={{ sx: { flex: 1 } }}
          {...(showZoomColumn && {
            enableRowActions: true,
            positionActionsColumn: 'first',
            displayColumnDefOptions: { 'mrt-row-actions': { header: '', size: 50, grow: false } },
            renderRowActions: ({ row }: { row: { original: Row } }) => {
              const source = getRowSource(row.original);
              if (!source?.mapPanelId || !source.layerId || !canZoomToFeature(row.original)) return null;
              const mapPanelId = source.mapPanelId;
              const layerId = source.layerId;
              return (
                <Tooltip title="Zoom to feature">
                  <IconButton
                    size="small"
                    color="primary"
                    aria-label="Zoom to feature"
                    onClick={() => void getMapHandle(mapPanelId)?.zoomToFeature(layerId, row.original)}
                  >
                    <ZoomInIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              );
            },
          })}
        />
      )}
    </PanelContainer>
  );
}

// Union of every row's own keys (not just the first row's) - a merged multi-source table can have
// heterogeneous schemas across its sources, unlike a single data source's consistently-shaped rows.
function collectColumnKeys(rows: Row[]): string[] {
  const seen = new Set<string>();
  const keys: string[] = [];
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        keys.push(key);
      }
    }
  }
  return keys;
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
