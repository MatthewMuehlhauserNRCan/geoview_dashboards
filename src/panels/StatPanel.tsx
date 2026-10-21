import { useMemo } from 'react';
import { Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Chart as ChartJS, ArcElement, Tooltip } from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import type { DoughnutLabelAnnotationOptions } from 'chartjs-plugin-annotation';
import { Doughnut } from 'react-chartjs-2';

import type { StatPanelConfig, DataSourceConfig } from '../config/types';
import { PanelContainer } from './PanelContainer';
import { useDataSource } from '../dataSources/useDataSource';
import { useListenChannels } from '../linking/useChannel';
import { rowMatchesFieldFilter } from '../linking/rowFilter';
import { aggregateValues } from '../dataSources/aggregate';

ChartJS.register(ArcElement, Tooltip, annotationPlugin);

// chartjs-plugin-annotation 3.1.0 ships `DoughnutLabelAnnotationOptions` but omits it from its
// own `AnnotationTypeRegistry` - augment it so `type: 'doughnutLabel'` below type-checks.
declare module 'chartjs-plugin-annotation' {
  interface AnnotationTypeRegistry {
    doughnutLabel: DoughnutLabelAnnotationOptions;
  }
}


interface StatPanelProps {
  panel: StatPanelConfig;
  dataSources: DataSourceConfig[];
}

type Row = Record<string, unknown>;

export function StatPanel({ panel, dataSources }: StatPanelProps) {
  const { data, isLoading } = useDataSource(panel.dataSource, dataSources);
  // Merges every listened channel (e.g. a shared filter panel's channel AND a legend's own,
  // separate channel) into one combined filter, so this stat reacts to all of them at once.
  const filterValue = useListenChannels(panel.interactions?.listensTo ?? []);
  // The data source always returns the layer's full, unfiltered feature set (same as GeoView's
  // own data table) - a linked filter panel's selection is applied here, client-side, instead.
  const rows = useMemo(() => (data ?? []).filter((row) => rowMatchesFieldFilter(row, filterValue)), [data, filterValue]);

  const aggregate = useMemo(
    () => (sourceRows: Row[]) => aggregateValues(sourceRows, panel.aggregation ?? 'count', panel.field),
    [panel.aggregation, panel.field],
  );
  const value = useMemo(() => aggregate(rows), [aggregate, rows]);
  // A fixed 0..100 default would clamp a count/sum in the hundreds to a permanently-full arc that
  // never visibly reacts to a filter change - default instead to this same stat's own unfiltered
  // total, so the gauge reads as "filtered value out of the whole", unless gauge.max is set.
  const unfilteredValue = useMemo(() => aggregate(data ?? []), [aggregate, data]);

  return (
    <PanelContainer title={panel.title} centerContent>
      {isLoading ? (
        <Typography sx={{ fontSize: '2rem' }}>…</Typography>
      ) : panel.display === 'gauge' ? (
        <Gauge value={value} gauge={panel.gauge} defaultMax={unfilteredValue} />
      ) : (
        <Typography sx={{ fontSize: '2rem' }}>{formatValue(value)}</Typography>
      )}
    </PanelContainer>
  );
}

function Gauge({
  value,
  gauge,
  defaultMax,
}: {
  value: number;
  gauge: StatPanelConfig['gauge'];
  defaultMax: number;
}) {
  const theme = useTheme();
  const min = gauge?.min ?? 0;
  const max = gauge?.max ?? (defaultMax || 100);
  const range = max - min || 1;
  const fraction = Math.min(Math.max((value - min) / range, 0), 1);

  // Green/amber/red zones at 70%/90% of the range, matching Chart.js's own gauge sample.
  const color =
    fraction < 0.7 ? theme.palette.success.main : fraction < 0.9 ? theme.palette.warning.main : theme.palette.error.main;

  const label = gauge?.label ?? 'value';
  const valueText = formatValue(value);
  const percentageText = `${Math.round(fraction * 100)}%`;
  const content =
    label === 'percentage' ? [percentageText] : label === 'both' ? [valueText, percentageText] : [valueText];
  const font =
    label === 'both'
      ? [{ size: 28, weight: 'bold' as const }, { size: 16 }]
      : [{ size: 28, weight: 'bold' as const }];
  const textColor =
    label === 'both' ? [theme.palette.text.primary, theme.palette.text.secondary] : theme.palette.text.primary;

  return (
    // PanelContainer's `centerContent` uses `align-items/justify-content: center`, which (unlike
    // the default `stretch`) lets this div shrink to fit its content instead of filling the card -
    // Chart.js's `responsive` canvas then has nothing real to measure itself against and renders
    // at a tiny fallback size (and shrinks the doughnutLabel text to match, via its own autoFit).
    // An explicit 100%/100% here restores a real box for it to fill.
    <div style={{ width: '100%', height: '100%' }}>
      <Doughnut
        // The gauge's value/percentage text is drawn on canvas (chartjs-plugin-annotation), with
        // no corresponding real DOM text - without this, a screen reader has nothing to read.
        aria-label={`${content.join(', ')} gauge`}
        data={{
          datasets: [
            {
              data: [fraction, 1 - fraction],
              backgroundColor: [color, theme.palette.divider],
              borderWidth: 0,
            },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          aspectRatio: 2,
          circumference: 180,
          rotation: -90,
          plugins: {
            tooltip: { enabled: false },
            // chartjs-plugin-datalabels is registered globally (ChartJS is one shared registry
            // across the whole app, see ChartPanel.tsx) - without this, it defaults to labeling
            // both doughnut segments with their raw fraction values, on top of the one real label
            // below (the doughnutLabel annotation) that's actually wanted here.
            datalabels: { display: false },
            annotation: {
              annotations: {
                label: {
                  type: 'doughnutLabel',
                  // chartjs-plugin-annotation resolves `display` as falsy for this annotation type
                  // unless set explicitly, silently skipping the draw entirely without it. Its
                  // `backgroundColor` default has the same gap - left unset, the canvas falls back
                  // to its own default fillStyle (opaque black) instead of the plugin's documented
                  // "transparent" default.
                  display: true,
                  backgroundColor: 'transparent',
                  content,
                  font,
                  color: textColor,
                  // the arc only occupies the top half of the doughnut's full circle (circumference:
                  // 180, rotation: -90) - shift the label up from the circle's true center (the
                  // flat bottom edge) into the middle of that visible half.
                  position: { y: '-50%' },
                },
              },
            },
          },
        }}
      />
    </div>
  );
}

function formatValue(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

