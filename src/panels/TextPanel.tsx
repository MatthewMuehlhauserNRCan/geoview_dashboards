import type { TextPanelConfig } from '../config/types';
import { PanelContainer } from './PanelContainer';

interface TextPanelProps {
  panel: TextPanelConfig;
}

// TODO: render as markdown once a markdown library is chosen; plain text for now
export function TextPanel({ panel }: TextPanelProps) {
  return (
    <PanelContainer title={panel.title}>
      <div>{panel.content}</div>
    </PanelContainer>
  );
}
