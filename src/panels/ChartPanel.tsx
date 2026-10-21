import { useCallback, useEffect, useMemo, useState } from 'react';
import { alpha, useTheme } from '@mui/material/styles';
import { Button, Typography } from '@mui/material';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  type ChartEvent,
  type ActiveElement,
} from 'chart.js';
import { Bar, Line, Pie, Scatter } from 'react-chartjs-2';
import type { ChartPanelConfig, DataSourceConfig } from '../config/types';
import { PanelContainer } from './PanelContainer';
import { useDataSource } from '../dataSources/useDataSource';
import { useListenChannels, useSetChannelField } from '../linking/useChannel';
import { rowMatchesFieldFilter, CHART_SOURCE_FIELD, type FieldFilterValue } from '../linking/rowFilter';
import { groupAndAggregate, describeAggregation } from '../dataSources/aggregate';
import { useMapHandle } from '../map/registry';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend);


interface ChartPanelProps {
  panel: ChartPanelConfig;
  dataSources: DataSourceConfig[];
}

type Row = Record<string, unknown>;

export function ChartPanel({ panel, dataSources }: ChartPanelProps) {
  const theme = useTheme();
  // Highlights the bar/slice matching the shared filter channel's current selection for this
  // chart's own field - derived from the theme so a custom theme's colors show through here too.
  const defaultColor = alpha(theme.palette.primary.main, 0.5);
  const selectedColor = alpha(theme.palette.warning.main, 0.9);
  const { data, isLoading, error } = useDataSource(panel.dataSource, dataSources);
  // The emit channel (its own click-to-select) and any listened channels (e.g. a shared filter
  // panel's combined selection, or a legend's own separate channel) are merged so this chart
  // reacts to all of them, even though it only ever emits onto its own single channel.
  const channel = panel.interactions?.emits?.[0] ?? panel.interactions?.listensTo?.[0] ?? '';
  const listenChannels = useMemo(
    () => Array.from(new Set([...(panel.interactions?.emits ?? []), ...(panel.interactions?.listensTo ?? [])])),
    [panel.interactions?.emits, panel.interactions?.listensTo],
  );
  const filterValue = useListenChannels(listenChannels);
  const setField = useSetChannelField(channel);
  const rows = useMemo(() => data ?? [], [data]);

  // Cross-filtered by every OTHER active field, but deliberately NOT by this chart's own field -
  // otherwise clicking a bar would immediately erase every other bar, with no way to pick a
  // different one (or see the bigger picture) afterwards.
  const groupByField = panel.field;
  const displayRows = useMemo(() => {
    if (!groupByField || !filterValue) return rows;
    const otherFilters = Object.fromEntries(Object.entries(filterValue).filter(([field]) => field !== groupByField));
    return rows.filter((row) => rowMatchesFieldFilter(row, otherFilters));
  }, [rows, filterValue, groupByField]);

  const grouped = useMemo(
    () => (groupByField ? groupAndAggregate(displayRows, groupByField, panel.aggregation ?? 'count', panel.valueField) : undefined),
    [displayRows, groupByField, panel.aggregation, panel.valueField],
  );

  // Clicking a bar toggles that category on/off in the shared cross-filter channel (clicking the
  // currently-selected one again clears it), rather than emitting the raw clicked row.
  const handleClick = useMemo(() => {
    if (!groupByField || !grouped) return undefined;
    return makeGroupClickHandler(grouped.labels, groupByField, filterValue, setField);
  }, [groupByField, grouped, filterValue, setField]);

  // Multi-source mode (one bar per data source's row count) is a completely different data shape
  // from everything above (single data source, optionally grouped by a field) - delegate to its
  // own component rather than threading it through the single-source branches below.
  if (panel.sources && panel.sources.length > 0) {
    return <MultiSourceChart panel={panel} dataSources={dataSources} sources={panel.sources} />;
  }

  if (isLoading) return <PanelContainer title={panel.title}>Loading…</PanelContainer>;
  if (error) return <PanelContainer title={panel.title}>Failed to load data</PanelContainer>;

  if (panel.chartType === 'scatter') {
    const numericKeys = findNumericKeys(displayRows);
    if (!numericKeys) {
      return <PanelContainer title={panel.title}>Not enough numeric fields for a scatter chart</PanelContainer>;
    }
    const [xKey, yKey] = numericKeys;
    return (
      <PanelContainer title={panel.title}>
        <Scatter
          aria-label={`${panel.title ?? 'Scatter chart'}: ${yKey} versus ${xKey}`}
          data={{
            datasets: [
              {
                label: panel.title ?? `${yKey} vs ${xKey}`,
                data: displayRows.map((row) => ({ x: Number(row[xKey]) || 0, y: Number(row[yKey]) || 0 })),
              },
            ],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            scales: { x: { title: { display: true, text: xKey } }, y: { title: { display: true, text: yKey } } },
          }}
        />
      </PanelContainer>
    );
  }

  // TODO: real binning once the query/transform layer exists; treated as a bar chart for now
  const { labelKey, valueKey } = grouped ? {} : pickAxisKeys(displayRows);
  const selectedValues = (groupByField && filterValue?.[groupByField]) || [];
  const aggregationLabel = describeAggregation(panel.aggregation ?? 'count', panel.valueField);
  const chartData = grouped
    ? {
        labels: grouped.labels,
        datasets: [
          {
            label: panel.title ?? groupByField,
            data: grouped.values,
            backgroundColor: grouped.labels.map((label) => (selectedValues.includes(label) ? selectedColor : defaultColor)),
          },
        ],
      }
    : {
        labels: labelKey ? displayRows.map((row) => String(row[labelKey])) : [],
        datasets: [
          {
            label: panel.title ?? valueKey ?? 'value',
            data: displayRows.map((row) => (valueKey ? Number(row[valueKey]) || 0 : 1)),
          },
        ],
      };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    onClick: handleClick,
    // Pie has no axes - only bar/line/histogram get axis titles (x = the grouped/label field, y = the aggregation).
    ...(panel.chartType !== 'pie' && {
      scales: {
        x: { title: { display: true, text: groupByField ?? labelKey ?? '' } },
        y: { title: { display: true, text: grouped ? aggregationLabel : 'Count' } },
      },
    }),
  };
  // Chart.js canvases get `role="img"` for free (react-chartjs-2's default), but that alone has
  // no accessible NAME for screen readers - this is read instead of the (purely visual) chart.
  const chartDescription = `${panel.title ?? 'Chart'}: ${panel.chartType} chart${
    groupByField ? ` of ${aggregationLabel.toLowerCase()} by ${groupByField}` : ''
  }`;

  return (
    <PanelContainer title={panel.title}>
      {selectedValues.length > 0 && (
        <Button size="small" onClick={() => groupByField && setField(groupByField, [])} sx={{ alignSelf: 'flex-start', mb: 1 }}>
          Clear selection
        </Button>
      )}
      {/* flex:1/minHeight:0 gives the chart its own measurable box independent of the Clear
          button above it - Chart.js sizes its canvas off this wrapper (its immediate
          parentNode), not the outer CardContent, so the button doesn't eat into the chart. */}
      <div style={{ flex: 1, minHeight: 0 }}>
        {panel.chartType === 'line' && <Line aria-label={chartDescription} data={chartData} options={options} />}
        {panel.chartType === 'pie' && <Pie aria-label={chartDescription} data={chartData} options={options} />}
        {(panel.chartType === 'bar' || panel.chartType === 'histogram') && (
          <Bar aria-label={chartDescription} data={chartData} options={options} />
        )}
      </div>
    </PanelContainer>
  );
}

// Clicking toggles a category in/out of the selection (multiple can be selected at once) rather
// than always replacing it with just the newly-clicked one.
function makeGroupClickHandler(
  labels: string[],
  field: string,
  filterValue: FieldFilterValue | undefined,
  setField: (field: string, values: string[]) => void
) {
  return (_event: ChartEvent, elements: ActiveElement[]) => {
    if (elements.length === 0) return;
    const clicked = labels[elements[0].index];
    const current = filterValue?.[field] ?? [];
    const next = current.includes(clicked) ? current.filter((v) => v !== clicked) : [...current, clicked];
    setField(field, next);
  };
}

type ChartSource = NonNullable<ChartPanelConfig['sources']>[number];

interface SourceResult {
  label: string;
  rows: Row[];
  isLoading: boolean;
  error: boolean;
}

interface MultiSourceChartProps {
  panel: ChartPanelConfig;
  dataSources: DataSourceConfig[];
  sources: ChartSource[];
}

// One bar/slice per data source, each showing that source's row count - e.g. one bar per
// sublayer of a group layer, instead of grouping by a field within a single data source. Each
// source's actual ROWS are kept (not just a count) so a future feature could filter/combine them
// - the chart itself only ever displays the count.
function MultiSourceChart({ panel, dataSources, sources }: MultiSourceChartProps) {
  const theme = useTheme();
  const defaultColor = alpha(theme.palette.primary.main, 0.5);
  const selectedColor = alpha(theme.palette.warning.main, 0.9);
  const [results, setResults] = useState<Record<string, SourceResult>>({});

  // Selection is routed through the SAME linking-channel system every other panel uses, via a
  // reserved virtual field (CHART_SOURCE_FIELD) whose values are selected `dataSourceId`s - not a
  // real row field, so this needs its own dedicated channel (see rowFilter.ts for why).
  const channel = panel.interactions?.emits?.[0] ?? panel.interactions?.listensTo?.[0] ?? '';
  const listenChannels = useMemo(
    () => Array.from(new Set([...(panel.interactions?.emits ?? []), ...(panel.interactions?.listensTo ?? [])])),
    [panel.interactions?.emits, panel.interactions?.listensTo],
  );
  const filterValue = useListenChannels(listenChannels);
  const setField = useSetChannelField(channel);
  const selectedSourceIds = useMemo(() => filterValue?.[CHART_SOURCE_FIELD] ?? [], [filterValue]);

  // Each SourceRowsFetcher below is its own component instance with its own hooks, so a
  // variable-length `sources` list is safe (not a dynamic number of hook calls in ONE component).
  const handleResult = useCallback((dataSourceId: string, result: SourceResult) => {
    setResults((prev) => ({ ...prev, [dataSourceId]: result }));
  }, []);

  const isLoading = sources.some((s) => results[s.dataSourceId]?.isLoading ?? true);
  const hasError = sources.some((s) => results[s.dataSourceId]?.error);
  const labels = sources.map((s) => results[s.dataSourceId]?.label ?? s.label ?? s.dataSourceId);
  const values = sources.map((s) => results[s.dataSourceId]?.rows.length ?? 0);

  // Clicking toggles that source's id in/out of the selection (multiple can be selected at once).
  const handleClick = useCallback(
    (_event: ChartEvent, elements: ActiveElement[]) => {
      if (elements.length === 0 || !channel) return;
      const clickedId = sources[elements[0].index]?.dataSourceId;
      if (!clickedId) return;
      const next = selectedSourceIds.includes(clickedId)
        ? selectedSourceIds.filter((id) => id !== clickedId)
        : [...selectedSourceIds, clickedId];
      setField(CHART_SOURCE_FIELD, next);
    },
    [channel, sources, selectedSourceIds, setField],
  );

  const chartData = {
    labels,
    datasets: [
      {
        label: panel.title ?? 'Count',
        data: values,
        backgroundColor: sources.map((s) => (selectedSourceIds.includes(s.dataSourceId) ? selectedColor : defaultColor)),
      },
    ],
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    onClick: handleClick,
    ...(panel.chartType !== 'pie' && {
      scales: { x: { title: { display: true, text: 'Data source' } }, y: { title: { display: true, text: 'Count' } } },
    }),
  };
  const chartDescription = `${panel.title ?? 'Chart'}: ${panel.chartType} chart of feature counts by data source`;

  return (
    <PanelContainer title={panel.title}>
      {sources.map((s) => (
        <SourceRowsFetcher key={s.dataSourceId} source={s} dataSources={dataSources} onResult={handleResult} />
      ))}
      {panel.chartType === 'scatter' && (
        <Typography variant="body2" color="text.secondary">
          Scatter charts aren't supported in multi-source mode.
        </Typography>
      )}
      {isLoading && panel.chartType !== 'scatter' && (
        <Typography variant="body2" color="text.secondary">
          Loading…
        </Typography>
      )}
      {!isLoading && hasError && panel.chartType !== 'scatter' && (
        <Typography variant="body2" color="error">
          One or more data sources failed to load.
        </Typography>
      )}
      {!isLoading && !hasError && (
        <>
          {selectedSourceIds.length > 0 && (
            <Button size="small" onClick={() => setField(CHART_SOURCE_FIELD, [])} sx={{ alignSelf: 'flex-start', mb: 1 }}>
              Clear selection
            </Button>
          )}
          <div style={{ flex: 1, minHeight: 0 }}>
            {panel.chartType === 'line' && <Line aria-label={chartDescription} data={chartData} options={options} />}
            {panel.chartType === 'pie' && <Pie aria-label={chartDescription} data={chartData} options={options} />}
            {(panel.chartType === 'bar' || panel.chartType === 'histogram') && (
              <Bar aria-label={chartDescription} data={chartData} options={options} />
            )}
          </div>
        </>
      )}
    </PanelContainer>
  );
}

// Invisible - just fetches one data source and reports its rows/default label up to the parent
// chart, so a variable number of sources can each own their own hooks safely (see above).
function SourceRowsFetcher({
  source,
  dataSources,
  onResult,
}: {
  source: ChartSource;
  dataSources: DataSourceConfig[];
  onResult: (dataSourceId: string, result: SourceResult) => void;
}) {
  const { data, isLoading, error } = useDataSource(source.dataSourceId, dataSources);
  const matchedSource = dataSources.find((d) => d.id === source.dataSourceId);
  const mapHandle = useMapHandle(matchedSource?.type === 'map-layer' ? matchedSource.mapPanelId : '');
  const defaultLabel =
    matchedSource?.type === 'map-layer' ? mapHandle?.listLayers().find((l) => l.id === matchedSource.layerId)?.name : undefined;
  const label = source.label ?? defaultLabel ?? source.dataSourceId;

  useEffect(() => {
    onResult(source.dataSourceId, { label, rows: data ?? [], isLoading, error: Boolean(error) });
  }, [source.dataSourceId, label, data, isLoading, error, onResult]);

  return null;
}

function pickAxisKeys(rows: Row[]): { labelKey?: string; valueKey?: string } {
  if (rows.length === 0) return {};
  const keys = Object.keys(rows[0]);
  const labelKey = keys.find((key) => typeof rows[0][key] === 'string') ?? keys[0];
  const valueKey = keys.find((key) => typeof rows[0][key] === 'number');
  return { labelKey, valueKey };
}

function findNumericKeys(rows: Row[]): [string, string] | undefined {
  if (rows.length === 0) return undefined;
  const numericKeys = Object.keys(rows[0]).filter((key) => typeof rows[0][key] === 'number');
  return numericKeys.length >= 2 ? [numericKeys[0], numericKeys[1]] : undefined;
}

