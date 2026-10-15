import type { ComponentType } from 'react';
import type { PanelConfig, DataSourceConfig } from '../config/types';
import { leafPanelRegistry } from './leafRegistry';
import { TabPanel } from './TabPanel';
import { StackPanel } from './StackPanel';

export interface PanelComponentProps<T extends PanelConfig = PanelConfig> {
  panel: T;
  dataSources: DataSourceConfig[];
}

// `any` is intentional here: each panel component has a narrower, panel-specific prop type,
// which a single lookup-by-`type` registry can't express without losing the per-panel typing above.
export const panelRegistry: Record<PanelConfig['type'], ComponentType<any>> = {
  ...leafPanelRegistry,
  tab: TabPanel,
  stack: StackPanel,
};
