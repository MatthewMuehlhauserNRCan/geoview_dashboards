import { Tabs, Tab } from '@mui/material';
import type { DashboardPageConfig } from '../config/types';

interface FooterElementProps {
  pages: DashboardPageConfig[];
  activePageId: string;
  onChange: (pageId: string) => void;
  // DOM id for each page's tab, and of the dashboard content area every tab controls.
  tabId: (pageId: string) => string;
  panelId: string;
}

// Bottom tab bar for switching between whole dashboard PAGES (each its own grid/panels) - not
// to be confused with the `tab` panel type, which switches between leaf panels in one grid cell.
export function FooterElement({ pages, activePageId, onChange, tabId, panelId }: FooterElementProps) {
  return (
    <Tabs
      className="dashboard-footer"
      aria-label="Dashboard pages"
      value={activePageId}
      onChange={(_event, value: string) => onChange(value)}
      sx={{ flex: '0 0 auto', minHeight: 0, bgcolor: 'background.paper', borderTop: '1px solid', borderColor: 'divider' }}
    >
      {pages.map((page) => (
        <Tab
          key={page.id}
          id={tabId(page.id)}
          aria-controls={panelId}
          value={page.id}
          label={page.label}
          sx={{ minHeight: 40, py: 1 }}
        />
      ))}
    </Tabs>
  );
}
