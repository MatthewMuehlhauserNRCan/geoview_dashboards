import type { LeafPanelConfig, PanelConfig } from '../config/types';
import { generateId } from './idUtils';

// Starting shape for each newly-added panel type, so the inspector always has valid (if empty)
// fields to render instead of handling "field doesn't exist yet" everywhere.
export function createDefaultLeafPanel(type: LeafPanelConfig['type'], id = generateId(`panel-${type}`)): LeafPanelConfig {
  switch (type) {
    case 'map':
      return { id, type, title: 'Map', config: {} };
    case 'chart':
      return { id, type, title: 'Chart', chartType: 'bar' };
    case 'stat':
      return { id, type, title: 'Stat' };
    case 'table':
      return { id, type, title: 'Table' };
    case 'legend':
      return { id, type, title: 'Legend' };
    case 'filter':
      return { id, type, title: 'Filter', fields: [] };
    case 'text':
      return { id, type, title: 'Text', content: '', format: 'plain' };
  }
}

export function createDefaultPanel(type: PanelConfig['type'], id = generateId(`panel-${type}`)): PanelConfig {
  if (type === 'tab') return { id, type, title: 'Tabs', tabs: [] };
  if (type === 'stack') return { id, type, title: 'Stack', items: [] };
  return createDefaultLeafPanel(type, id);
}

export const LEAF_PANEL_TYPES: LeafPanelConfig['type'][] = ['map', 'chart', 'stat', 'table', 'legend', 'filter', 'text'];
export const GRID_PANEL_TYPES: PanelConfig['type'][] = [...LEAF_PANEL_TYPES, 'tab', 'stack'];

export const PANEL_TYPE_LABELS: Record<PanelConfig['type'], string> = {
  map: 'Map',
  chart: 'Chart',
  stat: 'Stat card',
  table: 'Table',
  legend: 'Legend',
  filter: 'Filter',
  text: 'Text',
  tab: 'Tabs (multiple views in one cell)',
  stack: 'Stack (split one cell)',
};
