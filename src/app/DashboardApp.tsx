import { useMemo, useState } from 'react';
import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Box, GlobalStyles, ThemeProvider } from '@mui/material';
import { alpha } from '@mui/material/styles';
import type { DashboardConfig } from '../config/types';
import { DashboardGrid } from '../grid/DashboardGrid';
import { TitleElement } from '../title/TitleElement';
import { TitlePanel } from '../title/TitlePanel';
import { FooterElement } from '../footer/FooterElement';
import { createDashboardTheme } from '../theme/createDashboardTheme';

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
  const theme = useMemo(() => createDashboardTheme(config.theme), [config.theme]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        {/* Bridges the theme into the plain-CSS grid divider rules (App.css) - same fallback
            values as before, so an unconfigured theme looks pixel-identical to today. */}
        <GlobalStyles
          styles={{
            ':root': {
              '--dashboard-grid-background': theme.palette.background.default,
              '--dashboard-divider-color': theme.palette.divider,
              '--dashboard-divider-hover-color': alpha(theme.palette.primary.main, 0.25),
            },
          }}
        />
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
          {config.titleElement && <TitleElement config={config.titleElement} />}
          {/* Border wraps everything except the title element, which sits outside/above it. */}
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              border: '5px solid',
              borderColor: 'divider',
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
      </ThemeProvider>
    </QueryClientProvider>
  );
}
