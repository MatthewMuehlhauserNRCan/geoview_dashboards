import { useMemo } from 'react';
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
import { useListenChannel, useSetChannelField } from '../linking/useChannel';
import { isFieldFilterValue, rowMatchesFieldFilter, type FieldFilterValue } from '../linking/rowFilter';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend);

interface ChartPanelProps {
  panel: ChartPanelConfig;
  dataSources: DataSourceConfig[];
}

type Row = Record<string, unknown>;

export function ChartPanel({ panel, dataSources }: ChartPanelProps) {
  const { data, isLoading, error } = useDataSource(panel.dataSource, dataSources);
  const channel = panel.interactions?.emits?.[0] ?? panel.interactions?.listensTo?.[0] ?? '';
  const rawFilterValue = useListenChannel(channel);
  const filterValue: FieldFilterValue | undefined = isFieldFilterValue(rawFilterValue) ? rawFilterValue : undefined;
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

  const grouped = useMemo(() => (groupByField ? groupCounts(displayRows, groupByField) : undefined), [displayRows, groupByField]);

  // Clicking a bar toggles that category on/off in the shared cross-filter channel (clicking the
  // currently-selected one again clears it), rather than emitting the raw clicked row.
  const handleClick = useMemo(() => {
    if (!groupByField || !grouped) return undefined;
    return makeGroupClickHandler(grouped.labels, groupByField, filterValue, setField);
  }, [groupByField, grouped, filterValue, setField]);

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
          data={{
            datasets: [
              {
                label: panel.title ?? `${yKey} vs ${xKey}`,
                data: displayRows.map((row) => ({ x: Number(row[xKey]) || 0, y: Number(row[yKey]) || 0 })),
              },
            ],
          }}
          options={{ responsive: true, maintainAspectRatio: false }}
        />
      </PanelContainer>
    );
  }

  // TODO: real binning once the query/transform layer exists; treated as a bar chart for now
  const { labelKey, valueKey } = grouped ? {} : pickAxisKeys(displayRows);
  const selectedValues = (groupByField && filterValue?.[groupByField]) || [];
  const chartData = grouped
    ? {
        labels: grouped.labels,
        datasets: [
          {
            label: panel.title ?? groupByField,
            data: grouped.counts,
            backgroundColor: grouped.labels.map((label) => (selectedValues.includes(label) ? SELECTED_COLOR : DEFAULT_COLOR)),
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
  const options = { responsive: true, maintainAspectRatio: false, onClick: handleClick };

  return (
    <PanelContainer title={panel.title}>
      {panel.chartType === 'line' && <Line data={chartData} options={options} />}
      {panel.chartType === 'pie' && <Pie data={chartData} options={options} />}
      {(panel.chartType === 'bar' || panel.chartType === 'histogram') && <Bar data={chartData} options={options} />}
    </PanelContainer>
  );
}

// Highlights the bar/slice matching the shared filter channel's current selection for this
// chart's own field - derived from that channel (not local state), so the highlight survives a
// tab switch unmounting and remounting this component.
const DEFAULT_COLOR = 'rgba(25, 118, 210, 0.5)';
const SELECTED_COLOR = 'rgba(245, 124, 0, 0.9)';

// Counts rows per distinct value of `field` - the data behind a categorical bar/pie chart.
function groupCounts(rows: Row[], field: string): { labels: string[]; counts: number[] } {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = String(row[field] ?? 'null');
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const labels = sortLabels(Array.from(counts.keys()));
  return { labels, counts: labels.map((label) => counts.get(label) ?? 0) };
}

// Plain string sort puts "10"/"11" before "2" - sort numerically when every label looks numeric.
function sortLabels(labels: string[]): string[] {
  const allNumeric = labels.every((label) => label.trim() !== '' && !Number.isNaN(Number(label)));
  return [...labels].sort((a, b) => (allNumeric ? Number(a) - Number(b) : a.localeCompare(b)));
}

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
    setField(field, current.includes(clicked) ? [] : [clicked]);
  };
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
