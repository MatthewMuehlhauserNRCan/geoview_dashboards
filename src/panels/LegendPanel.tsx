import type { LegendPanelConfig } from '../config/types';
import { PanelContainer } from './PanelContainer';

interface LegendPanelProps {
  panel: LegendPanelConfig;
}

// TODO: pull the real layer list from the linked map panel (panel.mapPanelId) once GeoView integration lands
export function LegendPanel({ panel }: LegendPanelProps) {
  return (
    <PanelContainer title={panel.title}>
      <div>Legend placeholder for map panel "{panel.mapPanelId ?? 'unset'}"</div>
    </PanelContainer>
  );
}
