import type { ReactNode } from 'react';
import { Alert } from '@mui/material';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { PanelContainer } from './PanelContainer';

interface PanelErrorBoundaryProps {
  panelId: string;
  title?: string;
  children: ReactNode;
}

// Wraps one panel's render in an ErrorBoundary so a single broken panel (bad data, a GeoView
// failure, whatever) shows an inline error in its own cell instead of crashing the whole page.
export function PanelErrorBoundary({ panelId, title, children }: PanelErrorBoundaryProps) {
  return (
    <ErrorBoundary
      onError={(error) => console.error(`Panel "${panelId}" failed to render:`, error)}
      fallback={() => (
        <PanelContainer title={title} expandable={false}>
          <Alert severity="error">This panel failed to render. See the browser console for details.</Alert>
        </PanelContainer>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
