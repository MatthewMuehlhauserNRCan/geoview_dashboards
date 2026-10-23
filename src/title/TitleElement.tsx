import { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Box,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import PrintIcon from '@mui/icons-material/Print';
import CheckIcon from '@mui/icons-material/Check';
import type { DataSourceConfig, TitleElementConfig, TitleMenuFilterTarget, TitleMenuOption } from '../config/types';
import { setChannelField } from '../linking/useChannel';
import type { FieldFilterValue } from '../linking/rowFilter';
import { buildFilterExpression } from '../map/filterExpression';
import { getMapHandle } from '../map/registry';

interface TitleElementProps {
  config: TitleElementConfig;
  dataSources: DataSourceConfig[];
}

// The fixed, non-resizable header above everything else (including the resizable title panel) -
// logo on the left, title/subtitle in the middle, options + hamburger menus on the right.
export function TitleElement({ config, dataSources }: TitleElementProps) {
  const [optionsAnchor, setOptionsAnchor] = useState<HTMLElement | null>(null);
  const [hamburgerAnchor, setHamburgerAnchor] = useState<HTMLElement | null>(null);
  const [noticeOpen, setNoticeOpen] = useState(false);
  // Which options-menu item is currently "active" (radio-style - at most one at a time). Plain
  // component state, not derived from the channels themselves, since two options could coincide
  // on the same values - this is the source of truth for which one is considered selected.
  const [activeOptionId, setActiveOptionId] = useState<string | undefined>();

  // Selecting an option clears every OTHER option's configured values first (so a stale
  // selection from a previously-active option can't linger), then applies the clicked option's
  // own values - clicking the already-active option again just clears everything (deselects).
  const handleOptionClick = (option: TitleMenuOption) => {
    const isActive = activeOptionId === option.id;
    const nextActive = isActive ? undefined : option;
    const targets = config.optionsMenu?.targets ?? [];
    for (const target of targets) {
      setChannelField(target.channel, target.field, nextActive?.values?.[target.id] ?? []);
    }
    applyNativeMapFilters(targets, nextActive, dataSources);
    setActiveOptionId(nextActive?.id);
    setOptionsAnchor(null);
  };

  return (
    <AppBar position="static" sx={{ bgcolor: config.backgroundColor ?? 'primary.main', flex: '0 0 auto' }}>
      <Toolbar sx={{ gap: 2 }}>
        {config.image && (
          <Box
            component={config.image.href ? 'a' : 'div'}
            href={config.image.href}
            sx={{ display: 'flex', alignItems: 'center', flex: '0 0 auto' }}
          >
            <img src={config.image.src} alt={config.image.alt ?? ''} style={{ height: 32, display: 'block' }} />
          </Box>
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h6" noWrap component="div">
            {config.title}
          </Typography>
          {config.subtitle && (
            <Typography variant="body2" noWrap sx={{ opacity: 0.85 }}>
              {config.subtitle}
            </Typography>
          )}
        </Box>

        {config.optionsMenu && (
          <>
            <IconButton
              className="no-print"
              color="inherit"
              aria-label={config.optionsMenu.label ?? 'Options'}
              onClick={(event) => setOptionsAnchor(event.currentTarget)}
            >
              {config.optionsMenu.icon ? (
                <img src={config.optionsMenu.icon.src} alt={config.optionsMenu.icon.alt ?? ''} style={{ height: 24 }} />
              ) : (
                <MoreVertIcon />
              )}
            </IconButton>
            <Menu anchorEl={optionsAnchor} open={Boolean(optionsAnchor)} onClose={() => setOptionsAnchor(null)}>
              {config.optionsMenu.options.map((option) => (
                <MenuItem key={option.id} selected={activeOptionId === option.id} onClick={() => handleOptionClick(option)}>
                  <ListItemIcon>{activeOptionId === option.id && <CheckIcon fontSize="small" />}</ListItemIcon>
                  {option.label}
                </MenuItem>
              ))}
            </Menu>
          </>
        )}

        <IconButton className="no-print" color="inherit" aria-label="Print" onClick={() => window.print()}>
          <PrintIcon />
        </IconButton>

        {config.hamburgerMenu && (
          <>
            <IconButton className="no-print" color="inherit" aria-label="Menu" onClick={(event) => setHamburgerAnchor(event.currentTarget)}>
              <MenuIcon />
            </IconButton>
            <Menu anchorEl={hamburgerAnchor} open={Boolean(hamburgerAnchor)} onClose={() => setHamburgerAnchor(null)}>
              {config.hamburgerMenu.links?.map((link) => (
                <MenuItem
                  key={link.id}
                  component="a"
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setHamburgerAnchor(null)}
                >
                  {link.label}
                </MenuItem>
              ))}
              {config.hamburgerMenu.notice && (
                <MenuItem
                  onClick={() => {
                    setHamburgerAnchor(null);
                    setNoticeOpen(true);
                  }}
                >
                  {config.hamburgerMenu.notice.label}
                </MenuItem>
              )}
            </Menu>
          </>
        )}
      </Toolbar>

      {config.hamburgerMenu?.notice && (
        <Dialog open={noticeOpen} onClose={() => setNoticeOpen(false)}>
          <DialogTitle>{config.hamburgerMenu.notice.title}</DialogTitle>
          <DialogContent>{config.hamburgerMenu.notice.content}</DialogContent>
          <DialogActions>
            <Button onClick={() => setNoticeOpen(false)}>Close</Button>
          </DialogActions>
        </Dialog>
      )}
    </AppBar>
  );
}

// The generic linking-channel mechanism (setChannelField, above) is what drives chart/table/stat
// panels - but it can't safely drive a map's OWN rendered features too: a channel's merged
// FieldFilterValue carries every field ANY listening panel contributed, and a map can own MANY
// layers that don't all share the same fields (see linking.md's AND-everything caveat) - blindly
// pushing the full merged value to every layer the map owns would reference a nonexistent column
// on any layer that doesn't have that field. Instead, each target's own `dataSources` (the exact
// map-layer sources it was authored for) scopes its field/value clause to ONLY those layers,
// combined per-layer with any OTHER target that also targets it (e.g. two different header
// filters both scoping the same layer) - mirroring how a `filter` panel pushes its own selection
// straight to the map (FilterPanel.tsx), just driven by the option's values instead of dropdowns.
// Don't also list a layer here that's already a `filter` panel's own `dataSource` - both would
// independently call setLayerFilter on it and race each other.
function applyNativeMapFilters(
  targets: TitleMenuFilterTarget[],
  activeOption: TitleMenuOption | undefined,
  dataSources: DataSourceConfig[],
) {
  const byLayer = new Map<string, { mapPanelId: string; layerId: string; filter: FieldFilterValue }>();
  for (const target of targets) {
    const values = activeOption?.values?.[target.id] ?? [];
    for (const dataSourceId of target.dataSources ?? []) {
      const source = dataSources.find((d) => d.id === dataSourceId);
      if (!source || source.type !== 'map-layer') continue;
      const key = `${source.mapPanelId}\u0000${source.layerId}`;
      const entry = byLayer.get(key) ?? { mapPanelId: source.mapPanelId, layerId: source.layerId, filter: {} };
      entry.filter[target.field] = values;
      byLayer.set(key, entry);
    }
  }
  for (const { mapPanelId, layerId, filter } of byLayer.values()) {
    getMapHandle(mapPanelId)?.setLayerFilter(layerId, buildFilterExpression(filter));
  }
}
