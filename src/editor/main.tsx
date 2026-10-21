import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../index.css';
import { EditorApp } from './EditorApp';

// Needed because MapPreview mounts the real MapPanel component, which uses useQuery
// (e.g. for MapPanelConfig.configUrl) - that hook requires a QueryClientProvider ancestor
// even when the query itself is disabled.
const queryClient = new QueryClient();

createRoot(document.getElementById('editor-root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <EditorApp />
    </QueryClientProvider>
  </StrictMode>,
);
