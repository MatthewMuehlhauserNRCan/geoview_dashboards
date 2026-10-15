import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DashboardConfig, DataSourceConfig, GridConfig, GridPanel, LinkingChannel, PanelLayout, TitleElementConfig, TitlePanelConfig } from '../config/types';
import { generateId } from './idUtils';

export const BLANK_CONFIG: DashboardConfig = {
  id: 'new-dashboard',
  title: 'New Dashboard',
  pages: [{ id: 'page-1', label: 'Page 1', grid: { columns: 3, rows: 2 }, panels: [] }],
  dataSources: [],
  linking: { channels: [] },
};

interface EditorState {
  config: DashboardConfig;
  activePageId: string;
  selectedPanelId: string | undefined;
  // which map panel's live preview is mounted, so map-layer data sources can discover real layers
  previewMapPanelId: string | undefined;

  loadConfig: (config: DashboardConfig) => void;
  resetConfig: () => void;
  setActivePageId: (pageId: string) => void;
  selectPanel: (panelId: string | undefined) => void;
  setPreviewMapPanelId: (panelId: string | undefined) => void;

  updateMeta: (fields: Partial<Pick<DashboardConfig, 'id' | 'title'>>) => void;
  setTitleElement: (titleElement: TitleElementConfig | undefined) => void;
  setTitlePanel: (pageId: string, titlePanel: TitlePanelConfig | undefined) => void;

  addPage: () => void;
  renamePage: (pageId: string, label: string) => void;
  removePage: (pageId: string) => void;
  updateGrid: (pageId: string, grid: Partial<GridConfig>) => void;

  addPanel: (pageId: string, panel: GridPanel) => void;
  updatePanel: (pageId: string, panelId: string, updater: (panel: GridPanel) => GridPanel) => void;
  removePanel: (pageId: string, panelId: string) => void;
  updateLayout: (pageId: string, panelId: string, layout: Partial<PanelLayout>) => void;

  addDataSource: (source: DataSourceConfig) => void;
  updateDataSource: (id: string, updater: (source: DataSourceConfig) => DataSourceConfig) => void;
  removeDataSource: (id: string) => void;

  addChannel: (channel: LinkingChannel) => void;
  updateChannel: (id: string, updater: (channel: LinkingChannel) => LinkingChannel) => void;
  removeChannel: (id: string) => void;
}

export const useEditorStore = create<EditorState>()(
  persist(
    (set) => ({
      config: BLANK_CONFIG,
      activePageId: BLANK_CONFIG.pages[0].id,
      selectedPanelId: undefined,
      previewMapPanelId: undefined,

      loadConfig: (config) => set({ config, activePageId: config.pages[0]?.id, selectedPanelId: undefined }),
      resetConfig: () => set({ config: BLANK_CONFIG, activePageId: BLANK_CONFIG.pages[0].id, selectedPanelId: undefined }),
      setActivePageId: (activePageId) => set({ activePageId, selectedPanelId: undefined }),
      selectPanel: (selectedPanelId) => set({ selectedPanelId }),
      setPreviewMapPanelId: (previewMapPanelId) => set({ previewMapPanelId }),

      updateMeta: (fields) => set((state) => ({ config: { ...state.config, ...fields } })),
      setTitleElement: (titleElement) => set((state) => ({ config: { ...state.config, titleElement } })),
      setTitlePanel: (pageId, titlePanel) =>
        set((state) => ({
          config: { ...state.config, pages: state.config.pages.map((p) => (p.id === pageId ? { ...p, titlePanel } : p)) },
        })),

      addPage: () =>
        set((state) => {
          const id = generateId('page');
          const page = { id, label: `Page ${state.config.pages.length + 1}`, grid: { columns: 3, rows: 2 }, panels: [] };
          return { config: { ...state.config, pages: [...state.config.pages, page] }, activePageId: id };
        }),
      renamePage: (pageId, label) =>
        set((state) => ({
          config: { ...state.config, pages: state.config.pages.map((p) => (p.id === pageId ? { ...p, label } : p)) },
        })),
      removePage: (pageId) =>
        set((state) => {
          const pages = state.config.pages.filter((p) => p.id !== pageId);
          const nextPages = pages.length > 0 ? pages : BLANK_CONFIG.pages;
          return {
            config: { ...state.config, pages: nextPages },
            activePageId: state.activePageId === pageId ? nextPages[0].id : state.activePageId,
          };
        }),
      updateGrid: (pageId, grid) =>
        set((state) => ({
          config: {
            ...state.config,
            pages: state.config.pages.map((p) => (p.id === pageId ? { ...p, grid: { ...p.grid, ...grid } } : p)),
          },
        })),

      addPanel: (pageId, panel) =>
        set((state) => ({
          config: {
            ...state.config,
            pages: state.config.pages.map((p) => (p.id === pageId ? { ...p, panels: [...p.panels, panel] } : p)),
          },
          selectedPanelId: panel.id,
        })),
      updatePanel: (pageId, panelId, updater) =>
        set((state) => ({
          config: {
            ...state.config,
            pages: state.config.pages.map((p) =>
              p.id === pageId ? { ...p, panels: p.panels.map((panel) => (panel.id === panelId ? updater(panel) : panel)) } : p,
            ),
          },
        })),
      removePanel: (pageId, panelId) =>
        set((state) => ({
          config: {
            ...state.config,
            pages: state.config.pages.map((p) => (p.id === pageId ? { ...p, panels: p.panels.filter((panel) => panel.id !== panelId) } : p)),
          },
          selectedPanelId: state.selectedPanelId === panelId ? undefined : state.selectedPanelId,
        })),
      updateLayout: (pageId, panelId, layout) =>
        set((state) => ({
          config: {
            ...state.config,
            pages: state.config.pages.map((p) =>
              p.id === pageId
                ? { ...p, panels: p.panels.map((panel) => (panel.id === panelId ? { ...panel, layout: { ...panel.layout, ...layout } } : panel)) }
                : p,
            ),
          },
        })),

      addDataSource: (source) => set((state) => ({ config: { ...state.config, dataSources: [...state.config.dataSources, source] } })),
      updateDataSource: (id, updater) =>
        set((state) => ({
          config: { ...state.config, dataSources: state.config.dataSources.map((s) => (s.id === id ? updater(s) : s)) },
        })),
      removeDataSource: (id) =>
        set((state) => ({ config: { ...state.config, dataSources: state.config.dataSources.filter((s) => s.id !== id) } })),

      addChannel: (channel) =>
        set((state) => ({
          config: { ...state.config, linking: { channels: [...(state.config.linking?.channels ?? []), channel] } },
        })),
      updateChannel: (id, updater) =>
        set((state) => ({
          config: {
            ...state.config,
            linking: { channels: (state.config.linking?.channels ?? []).map((c) => (c.id === id ? updater(c) : c)) },
          },
        })),
      removeChannel: (id) =>
        set((state) => ({
          config: { ...state.config, linking: { channels: (state.config.linking?.channels ?? []).filter((c) => c.id !== id) } },
        })),
    }),
    { name: 'geoview-dashboard-editor-draft', partialize: (state) => ({ config: state.config, activePageId: state.activePageId }) },
  ),
);
