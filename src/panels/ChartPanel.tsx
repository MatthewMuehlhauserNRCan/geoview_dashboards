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
import { useEmitChannel } from '../linking/useChannel';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend);

interface ChartPanelProps {
  panel: ChartPanelConfig;
  dataSources: DataSourceConfig[];
}

type Row = Record<string, unknown>;

export function ChartPanel({ panel, dataSources }: ChartPanelProps) {
  const { data, isLoading, error } = useDataSource(panel.dataSource, dataSources);
  const emitChannel = panel.interactions?.emits?.[0];
  const emit = useEmitChannel(emitChannel ?? '');
  const rows = useMemo(() => data ?? [], [data]);

  const handleClick = useMemo(() => makeClickHandler(rows, emitChannel ? emit : undefined), [rows, emitChannel, emit]);

  if (isLoading) return <PanelContainer title={panel.title}>Loading…</PanelContainer>;
  if (error) return <PanelContainer title={panel.title}>Failed to load data</PanelContainer>;

  if (panel.chartType === 'scatter') {
    const numericKeys = findNumericKeys(rows);
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
                data: rows.map((row) => ({ x: Number(row[xKey]) || 0, y: Number(row[yKey]) || 0 })),
              },
            ],
          }}
          options={{ responsive: true, maintainAspectRatio: false, onClick: handleClick }}
        />
      </PanelContainer>
    );
  }

  // TODO: real binning once the query/transform layer exists; treated as a bar chart for now
  const { labelKey, valueKey } = pickAxisKeys(rows);
  const chartData = {
    labels: labelKey ? rows.map((row) => String(row[labelKey])) : [],
    datasets: [
      {
        label: panel.title ?? valueKey ?? 'value',
        data: rows.map((row) => (valueKey ? Number(row[valueKey]) || 0 : 1)),
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

// Reused across bar/line/pie/scatter - Chart.js's click handler shape is the same for all of them.
function makeClickHandler(rows: Row[], onSelect: ((value: unknown) => void) | undefined) {
  return (_event: ChartEvent, elements: ActiveElement[]) => {
    if (!onSelect || elements.length === 0) return;
    onSelect(rows[elements[0].index]);
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
