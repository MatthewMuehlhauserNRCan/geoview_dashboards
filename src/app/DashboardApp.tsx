import { useState } from 'react';
import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Box } from '@mui/material';
import type { DashboardConfig } from '../config/types';
import { DashboardGrid } from '../grid/DashboardGrid';
import { TitleElement } from '../title/TitleElement';
import { TitlePanel } from '../title/TitlePanel';
import { FooterElement } from '../footer/FooterElement';

// Panels only show a generic "Failed to load" message, so log the real error for debugging.
const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => console.error(`Data source query "${String(query.queryKey)}" failed:`, error),
  }),
});

interface DashboardAppProps {
  config: DashboardConfig;
}

export function DashboardApp({ config }: DashboardAppProps) {
  const [activePageId, setActivePageId] = useState(config.pages[0]?.id);
  const activePage = config.pages.find((page) => page.id === activePageId) ?? config.pages[0];

  return (
    <QueryClientProvider client={queryClient}>
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
        {config.titleElement && <TitleElement config={config.titleElement} />}
        {/* Border wraps everything except the title element, which sits outside/above it. */}
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            border: '5px solid #d1d1d1',
            borderRadius: '8px',
            boxSizing: 'border-box',
            overflow: 'hidden',
          }}
        >
          {activePage.titlePanel && <TitlePanel key={activePage.id} config={activePage.titlePanel} />}
          {/* Only the grid gets the remaining space and may scroll/shrink - nothing around it
              is ever pushed off-screen or clipped. */}
          <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            {activePage && <DashboardGrid grid={activePage.grid} panels={activePage.panels} dataSources={config.dataSources} />}
          </Box>
          {config.pages.length > 1 && (
            <FooterElement pages={config.pages} activePageId={activePage.id} onChange={setActivePageId} />
          )}
        </Box>
      </Box>
    </QueryClientProvider>
  );
}
