import { useCallback, useEffect, useMemo, useState, type FocusEvent, type KeyboardEvent, type ReactNode } from 'react';
import { alpha, darken, getLuminance, lighten, useTheme } from '@mui/material/styles';
import { Box, Button, FormControlLabel, Stack, Switch, Typography } from '@mui/material';
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
  type ChartData,
  type ChartEvent,
  type ChartOptions,
  type ActiveElement,
} from 'chart.js';
import ChartDataLabels, { type Context as DataLabelsContext } from 'chartjs-plugin-datalabels';
import { Bar, Line, Pie, Scatter } from 'react-chartjs-2';
import type { ChartPanelConfig, DataSourceConfig } from '../config/types';
import { PanelContainer } from './PanelContainer';
import { visuallyHidden } from '../common/a11y';
import { useDataSource } from '../dataSources/useDataSource';
import { useListenChannels, useSetChannelField } from '../linking/useChannel';
import {
  rowMatchesFieldFilter,
  CHART_SOURCE_FIELD,
  CHART_SOURCE_UNIVERSE_FIELD,
  getViewExtentFromFilter,
  type FieldFilterValue,
} from '../linking/rowFilter';
import { rowPassesViewExtent } from '../map/rowExtent';
import { aggregateValues, describeAggregation } from '../dataSources/aggregate';
import { SourceRowsFetcher, type SourceRowsResult } from '../dataSources/SourceRowsFetcher';
import {
  buildCategoryChartData,
  buildNumericBins,
  formatChartNumber,
  OTHER_CATEGORY_KEY,
  pickAxisKeys,
  resolveScatterKeys,
  splitIntoSeries,
  type CategoryChartData,
  type Row,
} from './chartData';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend, ChartDataLabels);

// One distinct color per category (or per series, when there's more than one) instead of
// repeating one flat color, so individual classes/slices stay visually distinguishable without
// relying solely on a legend. Hue-rotated around the color wheel rather than theme-derived, since
// an arbitrary number of categories can't all be guaranteed to look good next to a single brand
// color anyway.
function getCategoryColor(index: number, count: number, alphaValue = 0.75): string {
  const hue = count > 0 ? Math.round((index * 360) / count) : 0;
  return `hsla(${hue}, 65%, 55%, ${alphaValue})`;
}

// While something's selected, the selected category keeps ITS OWN color but darkened/more solid,
// and every other category fades (lightened + more transparent) instead of all being replaced by
// one flat highlight color. MUI's color helpers throw on formats they can't parse (e.g. CSS named
// colors like "red" from `panel.colors`) - such a color just skips the emphasis rather than
// crashing the chart.
function emphasizeColor(baseColor: string, isSelected: boolean, hasSelection: boolean): string {
  if (!hasSelection) return baseColor;
  try {
    return isSelected ? darken(baseColor, 0.25) : alpha(lighten(baseColor, 0.35), 0.35);
  } catch {
    return baseColor;
  }
}

// Black or white label text, whichever contrasts more with the bar/slice behind it (luminance
// ~0.18 is where the two contrast ratios cross). Unparseable colors fall back to white.
function contrastTextFor(color: unknown): string {
  if (typeof color !== 'string') return '#fff';
  try {
    return getLuminance(color) > 0.18 ? 'rgba(0, 0, 0, 0.87)' : '#fff';
  } catch {
    return '#fff';
  }
}

// Pie's auto-generated one-entry-per-slice legend gets crowded above the chart with more than a
// few categories - default it to the side (stacks vertically) instead of Chart.js's own 'top'
// default; other chart types keep that default (legend = one entry per dataset/series there).
function getLegendPosition(panel: ChartPanelConfig): 'top' | 'right' | 'bottom' | 'left' | 'none' {
  return panel.legendPosition ?? (panel.chartType === 'pie' ? 'right' : 'top');
}

function getLegendOptions(panel: ChartPanelConfig) {
  const position = getLegendPosition(panel);
  return { display: position !== 'none', position: position === 'none' ? undefined : position };
}

function toggleValue(current: string[], value: string): string[] {
  return current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
}

// ---- Linking (shared by single- and multi-source charts) ----

// The emit channel (its own click-to-select) and any listened channels (e.g. a shared filter
// panel's combined selection, or a legend's own separate channel) are merged so this chart reacts
// to all of them, even though it only ever emits onto its own single channel.
function useChartLinking(panel: ChartPanelConfig) {
  const channel = panel.interactions?.emits?.[0] ?? panel.interactions?.listensTo?.[0] ?? '';
  const listenChannels = useMemo(
    () => Array.from(new Set([...(panel.interactions?.emits ?? []), ...(panel.interactions?.listensTo ?? [])])),
    [panel.interactions?.emits, panel.interactions?.listensTo],
  );
  const filterValue = useListenChannels(listenChannels);
  const setField = useSetChannelField(channel);
  // Only defined once some listened channel is actually carrying a map's current view extent
  // (see MapPanelConfig's `interactions.emits` doc) - the toggle only appears then too.
  const viewExtent = useMemo(() => getViewExtentFromFilter(filterValue), [filterValue]);
  const [filterToMapView, setFilterToMapView] = useState(panel.filterToMapView ?? true);
  return { channel, filterValue, setField, viewExtent, filterToMapView, setFilterToMapView };
}

type ChartLinking = ReturnType<typeof useChartLinking>;

// Cross-filtered by every OTHER active field, but deliberately NOT by this chart's own selection
// field - otherwise clicking a bar would immediately erase every other bar, with no way to pick a
// different one (or see the bigger picture) afterwards.
function filterChartRows(
  rows: Row[],
  filterValue: FieldFilterValue | undefined,
  viewExtent: [number, number, number, number] | undefined,
  filterToMapView: boolean,
  ownField: string | undefined,
): Row[] {
  let result = rows;
  if (filterValue) {
    const otherFilters = ownField ? Object.fromEntries(Object.entries(filterValue).filter(([field]) => field !== ownField)) : filterValue;
    result = result.filter((row) => rowMatchesFieldFilter(row, otherFilters));
  }
  if (viewExtent && filterToMapView) result = result.filter((row) => rowPassesViewExtent(row, viewExtent));
  return result;
}

function renderHeaderActions(linking: ChartLinking, hasSelection: boolean, onClear: () => void): ReactNode {
  const { viewExtent, filterToMapView, setFilterToMapView } = linking;
  if (!hasSelection && !viewExtent) return undefined;
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
      {viewExtent && (
        <FormControlLabel
          sx={{ m: 0 }}
          control={<Switch size="small" checked={filterToMapView} onChange={(e) => setFilterToMapView(e.target.checked)} />}
          label="Map view"
        />
      )}
      {hasSelection && (
        <Button size="small" onClick={onClear}>
          Clear selection
        </Button>
      )}
    </Stack>
  );
}

// ---- Rendering (shared by single- and multi-source charts) ----

interface CategoryChartProps {
  panel: ChartPanelConfig;
  data: CategoryChartData;
  // Base (un-emphasized) color of one bar/point/slice.
  colorOf: (seriesIndex: number, categoryIndex: number) => string;
  // A line chart's connecting line color, per series.
  lineColorOf: (seriesIndex: number) => string;
  selectedKeys: string[];
  onCategoryClick?: (key: string) => void;
  categoryAxisTitle: string;
  valueAxisTitle: string;
  description: string;
  isBinned: boolean;
}

// bar/line/pie/histogram: one dataset per series, all sharing one category axis.
function CategoryChart({
  panel,
  data,
  colorOf,
  lineColorOf,
  selectedKeys,
  onCategoryClick,
  categoryAxisTitle,
  valueAxisTitle,
  description,
  isBinned,
}: CategoryChartProps) {
  const theme = useTheme();
  const isBar = panel.chartType === 'bar' || panel.chartType === 'histogram';
  const isLine = panel.chartType === 'line';
  const isPie = panel.chartType === 'pie';
  const hasSelection = selectedKeys.length > 0;
  const horizontal = isBar && Boolean(panel.horizontal);
  const stacked = !isPie && Boolean(panel.stacked) && data.series.length > 1;

  const chartData = {
    labels: data.labels,
    datasets: data.series.map((series, seriesIndex) => {
      const colors = data.keys.map((key, categoryIndex) =>
        emphasizeColor(colorOf(seriesIndex, categoryIndex), selectedKeys.includes(key), hasSelection),
      );
      return {
        label: series.label,
        data: series.values,
        backgroundColor: colors,
        ...(isLine && { borderColor: lineColorOf(seriesIndex), pointBackgroundColor: colors, pointBorderColor: colors }),
        // Histogram bins are a continuous range - no gaps between adjacent bars.
        ...(isBinned && isBar && { barPercentage: 1, categoryPercentage: data.series.length > 1 && !stacked ? 0.9 : 1 }),
      };
    }),
  };

  const handleClick = onCategoryClick
    ? (_event: ChartEvent, elements: ActiveElement[]) => {
        if (elements.length === 0) return;
        const key = data.keys[elements[0].index];
        if (key === undefined || key === OTHER_CATEGORY_KEY) return;
        onCategoryClick(key);
      }
    : undefined;

  // Keyboard equivalent of hovering/clicking the canvas (WCAG 2.1.1): arrow keys step through
  // categories (showing Chart.js's own tooltip on that category, and announcing its values via the
  // live region below), Enter/Space toggles its selection exactly like a click would.
  const [activeIndex, setActiveIndex] = useState<number | undefined>();
  const [announcement, setAnnouncement] = useState('');
  const categoryCount = data.keys.length;

  const describeCategory = (index: number) => {
    const values = data.series
      .map((series) => `${data.series.length > 1 ? `${series.label}: ` : ''}${formatChartNumber(series.values[index] ?? 0)}`)
      .join(', ');
    const selected = onCategoryClick && selectedKeys.includes(data.keys[index]) ? ' (selected)' : '';
    return `${data.labels[index]}: ${values}${selected}. ${index + 1} of ${categoryCount}.`;
  };

  const highlightCategory = (chart: ChartJS | undefined, index: number | undefined) => {
    if (!chart) return;
    const elements = index === undefined ? [] : data.series.map((_, datasetIndex) => ({ datasetIndex, index }));
    chart.setActiveElements(elements);
    chart.tooltip?.setActiveElements(elements, { x: 0, y: 0 });
    chart.update();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLCanvasElement>) => {
    if (categoryCount === 0) return;
    const chart = ChartJS.getChart(event.currentTarget);
    if ((event.key === 'Enter' || event.key === ' ') && activeIndex !== undefined && onCategoryClick) {
      event.preventDefault();
      const key = data.keys[activeIndex];
      if (key === undefined || key === OTHER_CATEGORY_KEY) return;
      onCategoryClick(key);
      setAnnouncement(`${data.labels[activeIndex]} ${selectedKeys.includes(key) ? 'deselected' : 'selected'}.`);
      return;
    }
    let next: number;
    const current = activeIndex ?? -1;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (current + 1) % categoryCount;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = current <= 0 ? categoryCount - 1 : current - 1;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = categoryCount - 1;
    else if (event.key === 'Escape' && activeIndex !== undefined) {
      setActiveIndex(undefined);
      highlightCategory(chart, undefined);
      return;
    } else return;
    event.preventDefault();
    setActiveIndex(next);
    highlightCategory(chart, next);
    setAnnouncement(describeCategory(next));
  };

  const handleBlur = (event: FocusEvent<HTMLCanvasElement>) => {
    if (activeIndex === undefined) return;
    setActiveIndex(undefined);
    highlightCategory(ChartJS.getChart(event.currentTarget), undefined);
  };

  // Axis titles are keyed by VISUAL axis (x = horizontal), so a horizontal bar chart's category
  // axis is `y`. An explicit `xAxisTitle`/`yAxisTitle` (even '') always wins.
  const categoryAxis = horizontal ? 'y' : 'x';
  const autoTitles = { [categoryAxis]: categoryAxisTitle, [horizontal ? 'x' : 'y']: valueAxisTitle } as Record<'x' | 'y', string>;
  const xTitle = panel.xAxisTitle ?? autoTitles.x;
  const yTitle = panel.yAxisTitle ?? autoTitles.y;

  const showNames = isPie && Boolean(panel.showSliceLabels);
  const showValues = Boolean(panel.showValueLabels);
  const datalabels = {
    display: (context: DataLabelsContext) => {
      if (!showNames && !showValues) return false;
      const value = context.dataset.data[context.dataIndex];
      if (typeof value !== 'number' || value === 0) return false;
      if (isBar && showValues) {
        // Skip a segment too short to hold its own label (e.g. a stacked sliver).
        const scale = context.chart.scales[horizontal ? 'x' : 'y'];
        if (scale && Math.abs(scale.getPixelForValue(value) - scale.getPixelForValue(0)) < 14) return false;
      }
      return true;
    },
    color: (context: DataLabelsContext) => {
      if (isLine) return theme.palette.text.primary;
      const background = context.dataset.backgroundColor;
      return contrastTextFor(Array.isArray(background) ? background[context.dataIndex] : background);
    },
    anchor: isLine ? ('end' as const) : ('center' as const),
    align: isLine ? ('top' as const) : ('center' as const),
    font: { weight: 'bold' as const, size: 11 },
    formatter: (value: unknown, context: DataLabelsContext) => {
      const parts: string[] = [];
      if (showNames) parts.push(String(context.chart.data.labels?.[context.dataIndex] ?? ''));
      if (showValues && typeof value === 'number') parts.push(formatChartNumber(value));
      return parts.join('\n');
    },
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    onClick: handleClick,
    indexAxis: horizontal ? ('y' as const) : ('x' as const),
    plugins: { legend: getLegendOptions(panel), datalabels },
    ...(!isPie && {
      scales: {
        x: { stacked, title: { display: Boolean(xTitle), text: xTitle } },
        y: { stacked, title: { display: Boolean(yTitle), text: yTitle } },
      },
    }),
  };

  const canvasProps = {
    'aria-label': `${description}. Use the arrow keys to read each value${onCategoryClick ? ', and Enter to select or deselect it' : ''}.`,
    tabIndex: 0,
    onKeyDown: handleKeyDown,
    onBlur: handleBlur,
  };

  return (
    <Box sx={{ flex: 1, minHeight: 0, '& canvas:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 } }}>
      {isLine && <Line {...canvasProps} data={chartData as ChartData<'line'>} options={options as unknown as ChartOptions<'line'>} />}
      {isPie && <Pie {...canvasProps} data={chartData as ChartData<'pie'>} options={options as unknown as ChartOptions<'pie'>} />}
      {isBar && <Bar {...canvasProps} data={chartData as ChartData<'bar'>} options={options as unknown as ChartOptions<'bar'>} />}
      <Box sx={visuallyHidden} aria-live="polite">
        {announcement}
      </Box>
      <ChartDataTable data={data} caption={description} selectedKeys={onCategoryClick ? selectedKeys : undefined} />
    </Box>
  );
}

// Screen-reader-only text alternative for a category chart's canvas (WCAG 1.1.1) - the same
// numbers the chart draws, as a real table.
function ChartDataTable({ data, caption, selectedKeys }: { data: CategoryChartData; caption: string; selectedKeys?: string[] }) {
  return (
    <Box component="table" sx={visuallyHidden}>
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">Category</th>
          {data.series.map((series) => (
            <th scope="col" key={series.key}>
              {series.label}
            </th>
          ))}
          {selectedKeys && <th scope="col">Selected</th>}
        </tr>
      </thead>
      <tbody>
        {data.keys.map((key, index) => (
          <tr key={key}>
            <th scope="row">{data.labels[index]}</th>
            {data.series.map((series) => (
              <td key={series.key}>{formatChartNumber(series.values[index] ?? 0)}</td>
            ))}
            {selectedKeys && <td>{selectedKeys.includes(key) ? 'Yes' : 'No'}</td>}
          </tr>
        ))}
      </tbody>
    </Box>
  );
}

interface ScatterSeries {
  label: string;
  color: string;
  rows: Row[];
}

function ScatterChartView({ panel, series, xKey, yKey }: { panel: ChartPanelConfig; series: ScatterSeries[]; xKey: string; yKey: string }) {
  const toPoints = (rows: Row[]) =>
    rows
      .map((row) => ({ x: Number(row[xKey]), y: Number(row[yKey]) }))
      .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  const xTitle = panel.xAxisTitle ?? xKey;
  const yTitle = panel.yAxisTitle ?? yKey;
  return (
    <div style={{ flex: 1, minHeight: 0 }}>
      <Scatter
        aria-label={`${panel.title ?? 'Scatter chart'}: ${yKey} versus ${xKey}`}
        data={{
          datasets: series.map((s) => ({ label: s.label, data: toPoints(s.rows), backgroundColor: s.color, borderColor: s.color })),
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: getLegendOptions(panel), datalabels: { display: false } },
          scales: {
            x: { title: { display: Boolean(xTitle), text: xTitle } },
            y: { title: { display: Boolean(yTitle), text: yTitle } },
          },
        }}
      />
    </div>
  );
}

// ---- Panels ----

interface ChartPanelProps {
  panel: ChartPanelConfig;
  dataSources: DataSourceConfig[];
}

export function ChartPanel({ panel, dataSources }: ChartPanelProps) {
  // Multi-source mode is a different data shape (rows per data source, fetched separately) -
  // delegated to its own component rather than threaded through the single-source path.
  if (panel.sources && panel.sources.length > 0) {
    return <MultiSourceChart panel={panel} dataSources={dataSources} sources={panel.sources} />;
  }
  return <SingleSourceChart panel={panel} dataSources={dataSources} />;
}

function SingleSourceChart({ panel, dataSources }: ChartPanelProps) {
  const theme = useTheme();
  // Flat fallback color for a single line/histogram/scatter (no per-category palette there).
  const flatColor = alpha(theme.palette.primary.main, 0.5);
  const otherColor = alpha(theme.palette.grey[500], 0.75);
  const linking = useChartLinking(panel);
  const { filterValue, setField, viewExtent, filterToMapView } = linking;
  const { data, isLoading, error } = useDataSource(panel.dataSource, dataSources);
  const rows = useMemo(() => data ?? [], [data]);

  const groupByField = panel.field;
  const isPie = panel.chartType === 'pie';
  const seriesField = isPie ? undefined : panel.seriesField;
  const displayRows = useMemo(
    () => filterChartRows(rows, filterValue, viewExtent, filterToMapView, groupByField),
    [rows, filterValue, viewExtent, filterToMapView, groupByField],
  );
  // Bin edges come from the UNFILTERED rows so the bins stay put while cross-filtering.
  const bins = useMemo(
    () => (panel.chartType === 'histogram' && groupByField ? buildNumericBins(rows, groupByField, panel.bins ?? 10) : undefined),
    [panel.chartType, groupByField, rows, panel.bins],
  );
  const aggregation = panel.aggregation ?? 'count';
  const aggregationLabel = describeAggregation(aggregation, panel.valueField);

  // Ungrouped (no `field`): one bar/point/slice per raw row - only sensible for small row sets.
  const ungroupedKeys = useMemo(
    () => (groupByField ? {} : { labelKey: panel.xField ?? pickAxisKeys(displayRows).labelKey, valueKey: panel.yField ?? pickAxisKeys(displayRows).valueKey }),
    [groupByField, panel.xField, panel.yField, displayRows],
  );
  const chartData = useMemo<CategoryChartData>(() => {
    if (groupByField) {
      return buildCategoryChartData(
        splitIntoSeries(displayRows, seriesField, panel.title ?? groupByField),
        bins?.categoryOf ?? ((row) => String(row[groupByField] ?? 'null')),
        { aggregation, valueField: panel.valueField, sort: panel.sort, limit: panel.limit, fixedCategories: bins?.categories },
      );
    }
    const { labelKey, valueKey } = ungroupedKeys;
    const labels = labelKey ? displayRows.map((row) => String(row[labelKey])) : [];
    return {
      keys: labels,
      labels,
      series: [{ key: '', label: panel.title ?? valueKey ?? 'value', values: displayRows.map((row) => (valueKey ? Number(row[valueKey]) || 0 : 1)) }],
    };
  }, [groupByField, displayRows, seriesField, panel.title, bins, aggregation, panel.valueField, panel.sort, panel.limit, ungroupedKeys]);

  // Clicking a category toggles it in/out of the shared cross-filter channel (multiple can be
  // selected at once) - only for real field values, not histogram bins or raw ungrouped rows.
  const isSelectable = Boolean(groupByField) && !bins;
  const selectedKeys = (isSelectable && groupByField && filterValue?.[groupByField]) || [];
  const handleCategoryClick = useCallback(
    (key: string) => {
      if (!groupByField) return;
      setField(groupByField, toggleValue(filterValue?.[groupByField] ?? [], key));
    },
    [groupByField, filterValue, setField],
  );

  const headerAction = renderHeaderActions(linking, selectedKeys.length > 0, () => groupByField && setField(groupByField, []));

  if (isLoading) return <PanelContainer title={panel.title}>Loading…</PanelContainer>;
  if (error) return <PanelContainer title={panel.title}>Failed to load data</PanelContainer>;

  if (panel.chartType === 'scatter') {
    const keys = resolveScatterKeys(displayRows, panel.xField, panel.yField);
    if (!keys) return <PanelContainer title={panel.title}>Not enough numeric fields for a scatter chart</PanelContainer>;
    const scatterSeries = splitIntoSeries(displayRows, panel.seriesField, panel.title ?? `${keys[1]} vs ${keys[0]}`);
    return (
      <PanelContainer title={panel.title} headerAction={headerAction}>
        <ScatterChartView
          panel={panel}
          xKey={keys[0]}
          yKey={keys[1]}
          series={scatterSeries.map((s, i) => ({
            label: s.label,
            rows: s.rows,
            color: panel.seriesField ? (panel.colors?.[s.key] ?? getCategoryColor(i, scatterSeries.length)) : flatColor,
          }))}
        />
      </PanelContainer>
    );
  }

  // In series mode, each series has ONE color (keyed by series value in `colors`); otherwise each
  // category gets its own, except a single line/histogram which keeps one flat color.
  const seriesColor = (seriesIndex: number) => {
    const series = chartData.series[seriesIndex];
    return panel.colors?.[series.key] ?? getCategoryColor(seriesIndex, chartData.series.length);
  };
  const colorOf = (seriesIndex: number, categoryIndex: number) => {
    if (seriesField) return seriesColor(seriesIndex);
    const key = chartData.keys[categoryIndex];
    if (key === OTHER_CATEGORY_KEY) return otherColor;
    return panel.colors?.[key] ?? (panel.chartType === 'line' || bins ? flatColor : getCategoryColor(categoryIndex, chartData.keys.length));
  };
  const description = `${panel.title ?? 'Chart'}: ${panel.chartType} chart${
    groupByField ? ` of ${aggregationLabel.toLowerCase()} by ${groupByField}` : ''
  }${seriesField ? `, split by ${seriesField}` : ''}`;

  return (
    <PanelContainer title={panel.title} headerAction={headerAction}>
      <CategoryChart
        panel={panel}
        data={chartData}
        colorOf={colorOf}
        lineColorOf={(seriesIndex) => (seriesField ? seriesColor(seriesIndex) : flatColor)}
        selectedKeys={selectedKeys}
        onCategoryClick={isSelectable ? handleCategoryClick : undefined}
        categoryAxisTitle={groupByField ?? ungroupedKeys.labelKey ?? ''}
        valueAxisTitle={groupByField ? aggregationLabel : (ungroupedKeys.valueKey ?? 'Count')}
        description={description}
        isBinned={Boolean(bins)}
      />
    </PanelContainer>
  );
}

type ChartSource = NonNullable<ChartPanelConfig['sources']>[number];

interface MultiSourceChartProps {
  panel: ChartPanelConfig;
  dataSources: DataSourceConfig[];
  sources: ChartSource[];
}

// Three shapes, all pulling each `sources[]` entry's own data source:
// - per-source (no `field`, or 'pie'): one bar/slice per data source, its rows aggregated (row
//   count by default) - e.g. one bar per sublayer of a group layer. Clicking selects SOURCES.
// - series (`field` set): one dataset per source, all grouped by `field` on shared axes (grouped
//   or `stacked` bars, one line per source, ...). Clicking selects `field` values, same as a
//   single-source chart.
// - scatter: one point cloud per source.
function MultiSourceChart({ panel, dataSources, sources }: MultiSourceChartProps) {
  const theme = useTheme();
  const [results, setResults] = useState<Record<string, SourceRowsResult>>({});
  const linking = useChartLinking(panel);
  const { channel, filterValue, setField, viewExtent, filterToMapView } = linking;
  const isScatter = panel.chartType === 'scatter';
  const groupByField = !isScatter && panel.chartType !== 'pie' ? panel.field : undefined;
  const isPerSource = !isScatter && !groupByField;

  // Selection in per-source mode is routed through the SAME linking-channel system every other
  // panel uses, via a reserved virtual field (CHART_SOURCE_FIELD) whose values are selected
  // `dataSourceId`s - not a real row field, so this needs its own dedicated channel (see
  // rowFilter.ts for why).
  const selectedSourceIds = useMemo(() => filterValue?.[CHART_SOURCE_FIELD] ?? [], [filterValue]);

  // A listening map panel needs to know every `dataSourceId` this chart COULD select from, not
  // just the currently-selected ones - otherwise it can't tell "deliberately filtered out" apart
  // from "a layer that was never part of this chart" (see CHART_SOURCE_UNIVERSE_FIELD).
  useEffect(() => {
    if (isPerSource) setField(CHART_SOURCE_UNIVERSE_FIELD, sources.map((s) => s.dataSourceId));
  }, [isPerSource, setField, sources]);

  // Each SourceRowsFetcher below is its own component instance with its own hooks, so a
  // variable-length `sources` list is safe (not a dynamic number of hook calls in ONE component).
  const handleResult = useCallback((dataSourceId: string, result: SourceRowsResult) => {
    setResults((prev) => ({ ...prev, [dataSourceId]: result }));
  }, []);

  const isLoading = sources.some((s) => results[s.dataSourceId]?.isLoading ?? true);
  const hasError = sources.some((s) => results[s.dataSourceId]?.error);
  const sourceLabels = useMemo(
    () => sources.map((s) => results[s.dataSourceId]?.label ?? s.label ?? s.dataSourceId),
    [sources, results],
  );
  const sourceColor = (index: number) => sources[index].color ?? getCategoryColor(index, sources.length);
  const aggregation = panel.aggregation ?? 'count';
  const aggregationLabel = describeAggregation(aggregation, panel.valueField);

  const filteredRows = useMemo(
    () => sources.map((s) => filterChartRows(results[s.dataSourceId]?.rows ?? [], filterValue, viewExtent, filterToMapView, groupByField)),
    [sources, results, filterValue, viewExtent, filterToMapView, groupByField],
  );
  const bins = useMemo(() => {
    if (panel.chartType !== 'histogram' || !groupByField) return undefined;
    const allRows = sources.flatMap((s) => results[s.dataSourceId]?.rows ?? []);
    return buildNumericBins(allRows, groupByField, panel.bins ?? 10);
  }, [panel.chartType, panel.bins, groupByField, sources, results]);

  const chartData = useMemo<CategoryChartData | undefined>(() => {
    if (isScatter) return undefined;
    if (!groupByField) {
      return {
        keys: sources.map((s) => s.dataSourceId),
        labels: sourceLabels,
        series: [
          {
            key: '',
            label: panel.title ?? aggregationLabel,
            values: filteredRows.map((rows) => aggregateValues(rows, aggregation, panel.valueField)),
          },
        ],
      };
    }
    return buildCategoryChartData(
      sources.map((s, i) => ({ key: s.dataSourceId, label: sourceLabels[i], rows: filteredRows[i] })),
      bins?.categoryOf ?? ((row) => String(row[groupByField] ?? 'null')),
      { aggregation, valueField: panel.valueField, sort: panel.sort, limit: panel.limit, fixedCategories: bins?.categories },
    );
  }, [isScatter, groupByField, sources, sourceLabels, filteredRows, bins, aggregation, aggregationLabel, panel.title, panel.valueField, panel.sort, panel.limit]);

  const isSelectable = isPerSource ? Boolean(channel) : Boolean(groupByField) && !bins;
  const selectedKeys = isPerSource ? selectedSourceIds : (isSelectable && groupByField && filterValue?.[groupByField]) || [];
  const handleCategoryClick = useCallback(
    (key: string) => {
      if (isPerSource) setField(CHART_SOURCE_FIELD, toggleValue(selectedSourceIds, key));
      else if (groupByField) setField(groupByField, toggleValue(filterValue?.[groupByField] ?? [], key));
    },
    [isPerSource, selectedSourceIds, groupByField, filterValue, setField],
  );
  const headerAction = renderHeaderActions(linking, selectedKeys.length > 0, () =>
    setField(isPerSource ? CHART_SOURCE_FIELD : (groupByField ?? ''), []),
  );

  let content: ReactNode;
  if (isLoading) {
    content = (
      <Typography variant="body2" color="text.secondary">
        Loading…
      </Typography>
    );
  } else if (hasError) {
    content = (
      <Typography variant="body2" color="error">
        One or more data sources failed to load.
      </Typography>
    );
  } else if (isScatter) {
    const keys = resolveScatterKeys(filteredRows.find((rows) => rows.length > 0) ?? [], panel.xField, panel.yField);
    content = keys ? (
      <ScatterChartView
        panel={panel}
        xKey={keys[0]}
        yKey={keys[1]}
        series={sources.map((_, i) => ({ label: sourceLabels[i], rows: filteredRows[i], color: sourceColor(i) }))}
      />
    ) : (
      <Typography variant="body2" color="text.secondary">
        Not enough numeric fields for a scatter chart
      </Typography>
    );
  } else if (chartData) {
    const description = groupByField
      ? `${panel.title ?? 'Chart'}: ${panel.chartType} chart of ${aggregationLabel.toLowerCase()} by ${groupByField}, one series per data source`
      : `${panel.title ?? 'Chart'}: ${panel.chartType} chart of ${aggregationLabel.toLowerCase()} by data source`;
    const otherColor = alpha(theme.palette.grey[500], 0.75);
    content = (
      <CategoryChart
        panel={panel}
        data={chartData}
        colorOf={(seriesIndex, categoryIndex) => {
          if (isPerSource) return chartData.keys[categoryIndex] === OTHER_CATEGORY_KEY ? otherColor : sourceColor(categoryIndex);
          return sourceColor(seriesIndex);
        }}
        lineColorOf={(seriesIndex) => (isPerSource ? alpha(theme.palette.primary.main, 0.5) : sourceColor(seriesIndex))}
        selectedKeys={selectedKeys}
        onCategoryClick={isSelectable ? handleCategoryClick : undefined}
        categoryAxisTitle={groupByField ?? 'Data source'}
        valueAxisTitle={aggregationLabel}
        description={description}
        isBinned={Boolean(bins)}
      />
    );
  }

  return (
    <PanelContainer title={panel.title} headerAction={headerAction}>
      {sources.map((s) => (
        <SourceRowsFetcher key={s.dataSourceId} source={s} dataSources={dataSources} onResult={handleResult} />
      ))}
      {content}
    </PanelContainer>
  );
}
