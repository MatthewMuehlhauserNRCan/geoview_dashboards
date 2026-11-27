import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Box, GlobalStyles, IconButton, ThemeProvider, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import PrintIcon from '@mui/icons-material/Print';
import type { DashboardConfig } from '../config/types';
import { DashboardGrid } from '../grid/DashboardGrid';
import { TitleElement } from '../title/TitleElement';
import { TitlePanel } from '../title/TitlePanel';
import { PageHeading } from '../title/PageHeading';
import { FooterElement } from '../footer/FooterElement';
import { createDashboardTheme } from '../theme/createDashboardTheme';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { TemplateValuesProvider } from '../templateValues/TemplateValuesProvider';
import { HeadingLevelContext, clampHeadingLevel } from '../common/headingLevel';

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
  // Unique per dashboard instance - the embed can mount several dashboards on one host page, and
  // duplicate ids would break the skip link and the footer tabs' aria-controls/labelledby wiring.
  const idPrefix = useId();
  const contentId = `${idPrefix}-content`;
  const pageTabId = (pageId: string) => `${idPrefix}-page-tab-${pageId.replace(/[^\w-]/g, '_')}`;
  const hasPageTabs = config.pages.length > 1;

  // Each heading only steps down from whatever's actually rendered above it, so no level is skipped.
  const titleLevel = clampHeadingLevel(config.headingLevel ?? 1);
  const pageHeadingLevel = clampHeadingLevel(config.titleElement ? titleLevel + 1 : titleLevel);
  const panelLevel = clampHeadingLevel(activePage?.pageHeading ? pageHeadingLevel + 1 : pageHeadingLevel);

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
              '--dashboard-focus-color': theme.palette.primary.main,
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
        <TemplateValuesProvider values={config.templateValues} dataSources={config.dataSources}>
          <Box ref={rootRef} sx={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
            {/* Visually hidden until focused - lets keyboard/screen-reader users jump past the
                title element's menu buttons straight to the dashboard content. */}
            <a href={`#${contentId}`} className="skip-link no-print">
              Skip to dashboard content
            </a>
            {config.titleElement && (
              <TitleElement config={config.titleElement} dataSources={config.dataSources} level={titleLevel} />
            )}
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
              {/* Distinct key prefixes: these are siblings, and duplicate sibling keys make React
                  leak stale copies on page switch instead of replacing them. */}
              {activePage.titlePanel && <TitlePanel key={`title-panel-${activePage.id}`} config={activePage.titlePanel} />}
              {activePage.pageHeading && (
                <PageHeading key={`page-heading-${activePage.id}`} config={activePage.pageHeading} level={pageHeadingLevel} />
              )}
              {/* Only the grid gets the remaining space and may scroll/shrink - nothing around it
                  is ever pushed off-screen or clipped. `id`/`tabIndex` make this the skip link's
                  target; `region`+`aria-label` give it a landmark (not `main`, since the embed
                  bundle can be dropped into a host page that already has its own `<main>`). With
                  page tabs it's instead the tabs' `tabpanel`, labelled by the active page's tab. */}
              <Box
                id={contentId}
                tabIndex={-1}
                role={hasPageTabs ? 'tabpanel' : 'region'}
                aria-label={hasPageTabs ? undefined : config.title}
                aria-labelledby={hasPageTabs ? pageTabId(activePage.id) : undefined}
                sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}
              >
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
                    <HeadingLevelContext.Provider value={panelLevel}>
                      <DashboardGrid grid={activePage.grid} panels={activePage.panels} dataSources={config.dataSources} />
                    </HeadingLevelContext.Provider>
                  </ErrorBoundary>
                )}
              </Box>
              {config.pages.length > 1 && (
                <FooterElement
                  pages={config.pages}
                  activePageId={activePage.id}
                  onChange={setActivePageId}
                  tabId={pageTabId}
                  panelId={contentId}
                />
              )}
            </Box>
          </Box>
        </TemplateValuesProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
