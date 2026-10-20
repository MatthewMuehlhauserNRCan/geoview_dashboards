import { useState } from 'react';
import { Box, Tab, Tabs } from '@mui/material';
import type { DataSourceConfig, TabPanelConfig } from '../config/types';
import { PanelContainer } from './PanelContainer';
import { PanelErrorBoundary } from './PanelErrorBoundary';
import { leafPanelRegistry } from './leafRegistry';

interface TabPanelProps {
  panel: TabPanelConfig;
  dataSources: DataSourceConfig[];
}

// Holds multiple panels in one grid cell, switched via tabs, instead of resizing to fit them all.
export function TabPanel({ panel, dataSources }: TabPanelProps) {
  const [activeId, setActiveId] = useState(panel.tabs[0]?.id);
  const activeTab = panel.tabs.find((tab) => tab.id === activeId) ?? panel.tabs[0];

  if (!activeTab) {
    return <PanelContainer title={panel.title}>No tabs configured</PanelContainer>;
  }

  const ActivePanelComponent = leafPanelRegistry[activeTab.panel.type];

  return (
    // not expandable itself: each tab's content already has its own fullscreen action
    <PanelContainer title={panel.title} expandable={false}>
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Tabs value={activeTab.id} onChange={(_, value) => setActiveId(value)}>
          {panel.tabs.map((tab) => (
            <Tab key={tab.id} value={tab.id} label={tab.label} />
          ))}
        </Tabs>
        <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          <PanelErrorBoundary key={activeTab.id} panelId={activeTab.panel.id} title={activeTab.panel.title}>
            <ActivePanelComponent panel={activeTab.panel} dataSources={dataSources} />
          </PanelErrorBoundary>
        </Box>
      </Box>
    </PanelContainer>
  );
}
