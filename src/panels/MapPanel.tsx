import type { MapPanelConfig } from '../config/types';
import { PanelContainer } from './PanelContainer';

interface MapPanelProps {
  panel: MapPanelConfig;
}

// TODO: replace with the actual GeoView core map component once that dependency is resolved
export function MapPanel({ panel }: MapPanelProps) {
  return (
    <PanelContainer title={panel.title}>
      <div>Map panel placeholder (GeoView core integration pending)</div>
    </PanelContainer>
  );
}
