import { useEffect, useMemo, useRef, useState } from 'react';
import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Box, GlobalStyles, IconButton, ThemeProvider, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import PrintIcon from '@mui/icons-material/Print';
import type { DashboardConfig } from '../config/types';
import { DashboardGrid } from '../grid/DashboardGrid';
import { TitleElement } from '../title/TitleElement';
import { TitlePanel } from '../title/TitlePanel';
import { FooterElement } from '../footer/FooterElement';
import { createDashboardTheme } from '../theme/createDashboardTheme';
import { ErrorBoundary } from '../common/ErrorBoundary';

// Largest envelope a sheet of Letter paper can offer, in CSS px (96/in), in either orientation -
// used to pick whichever orientation fits the dashboard's own shape best.
const INCH_PX = 96;
const LETTER_LONG_IN = 11;
const LETTER_SHORT_IN = 8.5;

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
  const rootRef = useRef<HTMLDivElement>(null);

  // The on-screen layout fills the browser viewport, which is almost never the same aspect ratio
  // as a fixed Letter page - naively scaling to fit a FIXED page shape leaves empty space on
  // whichever axis isn't the binding constraint (e.g. a wide dashboard scaled to fit the page's
  // width ends up shorter than the page, leaving blank space below it). Fixed by sizing the
  // PAGE ITSELF to the dashboard's own aspect ratio instead (whichever orientation - and however
  // much shrinking - lets it fill a Letter sheet edge-to-edge with zero leftover margin), rather
  // than fitting the dashboard into an unrelated fixed page shape.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return undefined;

    const styleEl = document.createElement('style');
    document.head.appendChild(styleEl);

    const handleBeforePrint = () => {
      const { width, height } = el.getBoundingClientRect();
      // `zoom` (unlike `transform: scale`) also shrinks what the browser considers the element's
      // actual rendered size, so the printed page genuinely gets smaller/fewer pages instead of
      // just repainting pixels within an otherwise-unchanged layout.
      const landscapeScale = Math.min((LETTER_LONG_IN * INCH_PX) / width, (LETTER_SHORT_IN * INCH_PX) / height, 1);
      const portraitScale = Math.min((LETTER_SHORT_IN * INCH_PX) / width, (LETTER_LONG_IN * INCH_PX) / height, 1);
      const scale = Math.max(landscapeScale, portraitScale);
      el.style.zoom = String(scale);

      const pageWidthIn = (width * scale) / INCH_PX;
      const pageHeightIn = (height * scale) / INCH_PX;
      styleEl.textContent = `@page { size: ${pageWidthIn.toFixed(2)}in ${pageHeightIn.toFixed(2)}in; margin: 0; }`;
    };
    const handleAfterPrint = () => {
      el.style.zoom = '';
    };

    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
      styleEl.remove();
    };
  }, []);

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
            // Scrollbars otherwise follow the OS/browser's own light-vs-dark preference, which
            // can clash with this app's own (possibly differently-themed) light/dark colors.
            '*': { scrollbarColor: `${theme.palette.action.disabled} transparent`, scrollbarWidth: 'thin' },
            '*::-webkit-scrollbar': { width: 8, height: 8 },
            '*::-webkit-scrollbar-track': { background: 'transparent' },
            '*::-webkit-scrollbar-thumb': { backgroundColor: theme.palette.action.disabled, borderRadius: 4 },
            '*::-webkit-scrollbar-thumb:hover': { backgroundColor: theme.palette.action.active },
          }}
        />
        <Box ref={rootRef} sx={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
          {/* Visually hidden until focused - lets keyboard/screen-reader users jump past the
              title element's menu buttons straight to the dashboard content. */}
          <a href="#dashboard-content" className="skip-link no-print">
            Skip to dashboard content
          </a>
          {config.titleElement && <TitleElement config={config.titleElement} dataSources={config.dataSources} />}
          {/* Border wraps everything except the title element, which sits outside/above it. */}
          <Box
            sx={{
              position: 'relative',
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
            {/* No titleElement means there's nowhere else to put a print action - float one
                in the corner instead (titleElement gets its own inline button, see TitleElement.tsx). */}
            {!config.titleElement && (
              <IconButton
                className="no-print"
                aria-label="Print"
                onClick={() => window.print()}
                sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1, bgcolor: 'background.paper', '&:hover': { bgcolor: 'action.hover' } }}
              >
                <PrintIcon fontSize="small" />
              </IconButton>
            )}
            {activePage.titlePanel && <TitlePanel key={activePage.id} config={activePage.titlePanel} />}
            {/* Only the grid gets the remaining space and may scroll/shrink - nothing around it
                is ever pushed off-screen or clipped. `id`/`tabIndex` make this the skip link's
                target; `region`+`aria-label` give it a landmark (not `main`, since the embed
                bundle can be dropped into a host page that already has its own `<main>`). */}
            <Box id="dashboard-content" tabIndex={-1} role="region" aria-label={config.title} sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
              {activePage && (
                <ErrorBoundary
                  key={activePage.id}
                  onError={(error) => console.error('Dashboard grid failed to render:', error)}
                  fallback={() => (
                    <Box sx={{ p: 2 }}>
                      <Typography color="error">This page failed to render. See the browser console for details.</Typography>
                    </Box>
                  )}
                >
                  <DashboardGrid grid={activePage.grid} panels={activePage.panels} dataSources={config.dataSources} />
                </ErrorBoundary>
              )}
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
