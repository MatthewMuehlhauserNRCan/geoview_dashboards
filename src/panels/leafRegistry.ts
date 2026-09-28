import type { ComponentType } from 'react';
import type { LeafPanelConfig } from '../config/types';
import { MapPanel } from './MapPanel';
import { ChartPanel } from './ChartPanel';
import { StatPanel } from './StatPanel';
import { TablePanel } from './TablePanel';
import { LegendPanel } from './LegendPanel';
import { FilterPanel } from './FilterPanel';
import { TextPanel } from './TextPanel';

// `any` is intentional: each component has a narrower, panel-specific prop type that a
// single lookup-by-`type` registry can't express without losing the per-panel typing.
export const leafPanelRegistry: Record<LeafPanelConfig['type'], ComponentType<any>> = {
  map: MapPanel,
  chart: ChartPanel,
  stat: StatPanel,
  table: TablePanel,
  legend: LegendPanel,
  filter: FilterPanel,
  text: TextPanel,
};
