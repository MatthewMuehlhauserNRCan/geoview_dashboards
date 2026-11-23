import type { ImagePanelConfig } from '../config/types';
import { PanelContainer } from './PanelContainer';

interface ImagePanelProps {
  panel: ImagePanelConfig;
}

export function ImagePanel({ panel }: ImagePanelProps) {
  const img = (
    <img
      src={panel.src}
      alt={panel.alt ?? ''}
      style={{ width: '100%', height: '100%', objectFit: panel.fit ?? 'contain' }}
    />
  );

  return (
    <PanelContainer title={panel.title} disablePadding centerContent>
      {panel.link ? (
        <a href={panel.link} target="_blank" rel="noopener noreferrer" style={{ display: 'block', width: '100%', height: '100%' }}>
          {img}
        </a>
      ) : (
        img
      )}
    </PanelContainer>
  );
}
