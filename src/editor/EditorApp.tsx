import { useRef, useState } from 'react';
import {
  AppBar,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
  Tab,
  Tabs,
  TextField,
  Toolbar,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import ViewHeadlineIcon from '@mui/icons-material/ViewHeadline';
import type { PanelConfig } from '../config/types';
import { dashboardConfigSchema } from '../config/schema';
import { AddPanelDialog } from './AddPanelDialog';
import { DataSourcesPanel } from './DataSourcesPanel';
import { GridEditor } from './GridEditor';
import { LinkingPanel } from './LinkingPanel';
import { MapPreview, useMapPanels } from './MapPreview';
import { PanelInspector } from './PanelInspector';
import { TitleElementForm } from './TitleElementForm';
import { TitlePanelForm } from './TitlePanelForm';
import { createDefaultPanel } from './panelDefaults';
import { useEditorStore } from './store';

export function EditorApp() {
  const config = useEditorStore((s) => s.config);
  const activePageId = useEditorStore((s) => s.activePageId);
  const selectedPanelId = useEditorStore((s) => s.selectedPanelId);
  const setActivePageId = useEditorStore((s) => s.setActivePageId);
  const addPage = useEditorStore((s) => s.addPage);
  const renamePage = useEditorStore((s) => s.renamePage);
  const removePage = useEditorStore((s) => s.removePage);
  const updateGrid = useEditorStore((s) => s.updateGrid);
  const addPanel = useEditorStore((s) => s.addPanel);
  const updateMeta = useEditorStore((s) => s.updateMeta);
  const setTitleElement = useEditorStore((s) => s.setTitleElement);
  const setTitlePanel = useEditorStore((s) => s.setTitlePanel);
  const loadConfig = useEditorStore((s) => s.loadConfig);
  const resetConfig = useEditorStore((s) => s.resetConfig);

  const mapPanelOptions = useMapPanels(config).map((p) => ({ id: p.id, label: p.title || p.id }));

  const page = config.pages.find((p) => p.id === activePageId) ?? config.pages[0];
  const selectedPanel = page.panels.find((p) => p.id === selectedPanelId);

  const [addAt, setAddAt] = useState<{ col: number; row: number } | undefined>();
  const [errors, setErrors] = useState<string[] | undefined>();
  const [headerDialogOpen, setHeaderDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handlePick = (type: PanelConfig['type']) => {
    if (!addAt) return;
    const panel = createDefaultPanel(type);
    addPanel(page.id, { ...panel, layout: { col: addAt.col, row: addAt.row, colSpan: 1, rowSpan: 1 } });
    setAddAt(undefined);
  };

  const handleExport = () => {
    const result = dashboardConfigSchema.safeParse(config);
    if (!result.success) {
      setErrors(result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`));
      return;
    }
    const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${config.id || 'dashboard'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = dashboardConfigSchema.safeParse(JSON.parse(text));
      if (!parsed.success) {
        setErrors(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`));
        return;
      }
      loadConfig(parsed.data);
    } catch (e) {
      setErrors([e instanceof Error ? e.message : 'Could not read this file as JSON.']);
    }
  };

  return (
    <Box sx={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar sx={{ gap: 2 }}>
          <Typography variant="h6">Dashboard Editor</Typography>
          <TextField
            size="small"
            label="Dashboard title"
            value={config.title}
            onChange={(e) => updateMeta({ title: e.target.value })}
          />
          <TextField size="small" label="Dashboard id" value={config.id} onChange={(e) => updateMeta({ id: e.target.value })} />
          <Box sx={{ flex: 1 }} />
          <Button size="small" startIcon={<ViewHeadlineIcon />} onClick={() => setHeaderDialogOpen(true)}>
            Header
          </Button>
          <Button
            size="small"
            startIcon={<RestartAltIcon />}
            onClick={() => {
              if (window.confirm('Discard the current draft and start a new blank dashboard?')) resetConfig();
            }}
          >
            New
          </Button>
          <Button size="small" startIcon={<UploadIcon />} onClick={() => fileInputRef.current?.click()}>
            Import
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleImportFile(file);
              e.target.value = '';
            }}
          />
          <Button size="small" variant="contained" startIcon={<DownloadIcon />} onClick={handleExport}>
            Export
          </Button>
        </Toolbar>
        <Toolbar variant="dense" sx={{ gap: 1 }}>
          <Tabs value={page.id} onChange={(_, v) => setActivePageId(v)} sx={{ flex: 1, minHeight: 0 }}>
            {config.pages.map((p) => (
              <Tab
                key={p.id}
                value={p.id}
                label={
                  <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                    <TextField
                      variant="standard"
                      value={p.label}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => renamePage(p.id, e.target.value)}
                      sx={{ width: 90 }}
                    />
                    <IconButton
                      size="small"
                      component="span"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`Remove page "${p.label}"?`)) removePage(p.id);
                      }}
                    >
                      <CloseIcon fontSize="inherit" />
                    </IconButton>
                  </Stack>
                }
              />
            ))}
          </Tabs>
          <IconButton size="small" onClick={addPage} title="Add page">
            <AddIcon />
          </IconButton>
          <TextField
            size="small"
            type="number"
            label="Columns"
            value={page.grid.columns}
            onChange={(e) => updateGrid(page.id, { columns: Math.max(1, Number(e.target.value)) })}
            sx={{ width: 90 }}
          />
          <TextField
            size="small"
            type="number"
            label="Rows"
            value={page.grid.rows}
            onChange={(e) => updateGrid(page.id, { rows: Math.max(1, Number(e.target.value)) })}
            sx={{ width: 90 }}
          />
        </Toolbar>
      </AppBar>

      <Box sx={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <Box sx={{ width: 320, borderRight: '1px solid', borderColor: 'divider', overflow: 'auto', p: 1 }}>
          <Stack spacing={2}>
            <DataSourcesPanel />
            <LinkingPanel />
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Title panel ({page.label})
              </Typography>
              <TitlePanelForm value={page.titlePanel} onChange={(next) => setTitlePanel(page.id, next)} />
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Map preview
              </Typography>
              <Box sx={{ height: 360, border: '1px solid', borderColor: 'divider' }}>
                <MapPreview />
              </Box>
            </Box>
          </Stack>
        </Box>

        <Box sx={{ flex: 1, minWidth: 0, overflow: 'auto', p: 2 }}>
          <GridEditor page={page} selectedPanelId={selectedPanelId} onAddAt={(col, row) => setAddAt({ col, row })} />
        </Box>

        <Box sx={{ width: 380, borderLeft: '1px solid', borderColor: 'divider', overflow: 'auto', p: 2 }}>
          {selectedPanel ? (
            <PanelInspector
              pageId={page.id}
              panel={selectedPanel}
              dataSources={config.dataSources}
              channels={config.linking?.channels ?? []}
              mapPanelOptions={mapPanelOptions}
            />
          ) : (
            <Typography variant="body2" color="text.secondary">
              Select a panel to edit its properties, or click an empty grid cell to add one.
            </Typography>
          )}
        </Box>
      </Box>

      <AddPanelDialog open={!!addAt} onClose={() => setAddAt(undefined)} onPick={handlePick} />

      <Dialog open={headerDialogOpen} onClose={() => setHeaderDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Dashboard header</DialogTitle>
        <DialogContent>
          <TitleElementForm value={config.titleElement} onChange={setTitleElement} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHeaderDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!errors} onClose={() => setErrors(undefined)} fullWidth maxWidth="sm">
        <DialogTitle>Config isn't valid yet</DialogTitle>
        <DialogContent>
          <List dense>
            {errors?.map((err, i) => (
              <ListItem key={i}>
                <ListItemText primary={err} />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setErrors(undefined)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
