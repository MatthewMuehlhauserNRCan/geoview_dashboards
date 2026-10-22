import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  DashboardConfig,
  DashboardThemeConfig,
  DataSourceConfig,
  GridConfig,
  GridPanel,
  LeafPanelConfig,
  LinkingChannel,
  PanelLayout,
  TitleElementConfig,
  TitlePanelConfig,
} from '../config/types';
import { generateId } from './idUtils';

// First cell (reading left-to-right, top-to-bottom) not covered by any existing panel's span -
// used by demoteFromContainer() to place an extracted panel somewhere that won't silently
// overlap/hide an existing one. Falls back to a brand new row when the grid is completely full.
function findFreeCell(panels: GridPanel[], columns: number, rows: number): { col: number; row: number } {
  const occupied = new Set<string>();
  for (const panel of panels) {
    const { col, row, colSpan = 1, rowSpan = 1 } = panel.layout;
    for (let r = row; r < row + rowSpan; r += 1) {
      for (let c = col; c < col + colSpan; c += 1) occupied.add(`${r}-${c}`);
    }
  }
  for (let r = 1; r <= rows; r += 1) {
    for (let c = 1; c <= columns; c += 1) {
      if (!occupied.has(`${r}-${c}`)) return { col: c, row: r };
    }
  }
  return { col: 1, row: rows + 1 };
}

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
  setTheme: (theme: DashboardThemeConfig | undefined) => void;

  addPage: () => void;
  renamePage: (pageId: string, label: string) => void;
  removePage: (pageId: string) => void;
  updateGrid: (pageId: string, grid: Partial<GridConfig>) => void;

  addPanel: (pageId: string, panel: GridPanel) => void;
  updatePanel: (pageId: string, panelId: string, updater: (panel: GridPanel) => GridPanel) => void;
  removePanel: (pageId: string, panelId: string) => void;
  updateLayout: (pageId: string, panelId: string, layout: Partial<PanelLayout>) => void;
  // Wraps an existing top-level LEAF panel into a NEW tab/stack panel at the same grid position,
  // as that container's first (only) tab/item - the leaf keeps its own id (anything referencing
  // it, e.g. a legend/filter's `mapPanelId`, keeps working unchanged), only the container is new.
  promoteToContainer: (pageId: string, panelId: string, containerType: 'tab' | 'stack') => void;
  // Pulls one tab/item back out of a tab/stack panel to the top-level grid - if it was the ONLY
  // one left, the container is replaced entirely by the leaf (inheriting its layout); otherwise
  // the leaf is placed in the first free grid cell (growing the grid by one row if none is free).
  demoteFromContainer: (pageId: string, containerId: string, leafId: string) => void;
  // Moves an existing top-level LEAF panel (freeing its grid cell) into an existing tab/stack
  // panel as a new tab/item - an alternative to re-creating the same panel from scratch inside it.
  movePanelIntoContainer: (pageId: string, containerId: string, panelId: string) => void;

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
      setTheme: (theme) => set((state) => ({ config: { ...state.config, theme } })),

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
      promoteToContainer: (pageId, panelId, containerType) =>
        set((state) => {
          let newContainerId: string | undefined;
          const pages = state.config.pages.map((p) => {
            if (p.id !== pageId) return p;
            const target = p.panels.find((panel) => panel.id === panelId);
            if (!target || target.type === 'tab' || target.type === 'stack') return p;
            const { layout, ...leaf } = target;
            newContainerId = generateId(`panel-${containerType}`);
            const container: GridPanel =
              containerType === 'tab'
                ? { id: newContainerId, type: 'tab', title: leaf.title, tabs: [{ id: leaf.id, label: leaf.title || 'Tab 1', panel: leaf }], layout }
                : { id: newContainerId, type: 'stack', title: leaf.title, items: [leaf], layout };
            return { ...p, panels: p.panels.map((panel) => (panel.id === panelId ? container : panel)) };
          });
          return { config: { ...state.config, pages }, selectedPanelId: newContainerId ?? state.selectedPanelId };
        }),
      demoteFromContainer: (pageId, containerId, leafId) =>
        set((state) => {
          const pages = state.config.pages.map((p) => {
            if (p.id !== pageId) return p;
            const container = p.panels.find((panel) => panel.id === containerId);
            if (!container || (container.type !== 'tab' && container.type !== 'stack')) return p;
            const entries: LeafPanelConfig[] = container.type === 'tab' ? container.tabs.map((t) => t.panel) : container.items;
            const leaf = entries.find((e) => e.id === leafId);
            if (!leaf) return p;

            if (entries.length === 1) {
              // Nothing left in the container once this one's gone - replace it with the leaf
              // directly, inheriting its grid position, instead of leaving an empty container.
              return { ...p, panels: p.panels.map((panel) => (panel.id === containerId ? { ...leaf, layout: container.layout } : panel)) };
            }

            const remainingContainer: GridPanel =
              container.type === 'tab'
                ? { ...container, tabs: container.tabs.filter((t) => t.id !== leafId) }
                : { ...container, items: container.items.filter((item) => item.id !== leafId) };
            const { col, row } = findFreeCell(p.panels, p.grid.columns, p.grid.rows);
            const grid: GridConfig = row > p.grid.rows ? { ...p.grid, rows: row } : p.grid;
            const extracted: GridPanel = { ...leaf, layout: { col, row, colSpan: 1, rowSpan: 1 } };
            return {
              ...p,
              grid,
              panels: [...p.panels.map((panel) => (panel.id === containerId ? remainingContainer : panel)), extracted],
            };
          });
          return { config: { ...state.config, pages }, selectedPanelId: leafId };
        }),
      movePanelIntoContainer: (pageId, containerId, panelId) =>
        set((state) => {
          const pages = state.config.pages.map((p) => {
            if (p.id !== pageId) return p;
            const source = p.panels.find((panel) => panel.id === panelId);
            const container = p.panels.find((panel) => panel.id === containerId);
            if (!source || source.type === 'tab' || source.type === 'stack') return p;
            if (!container || (container.type !== 'tab' && container.type !== 'stack')) return p;
            const { layout: _layout, ...leaf } = source;
            const nextContainer: GridPanel =
              container.type === 'tab'
                ? { ...container, tabs: [...container.tabs, { id: leaf.id, label: leaf.title || `Tab ${container.tabs.length + 1}`, panel: leaf }] }
                : { ...container, items: [...container.items, leaf] };
            return {
              ...p,
              panels: p.panels.filter((panel) => panel.id !== panelId).map((panel) => (panel.id === containerId ? nextContainer : panel)),
            };
          });
          return { config: { ...state.config, pages }, selectedPanelId: containerId };
        }),

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
