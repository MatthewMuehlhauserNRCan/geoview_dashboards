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
import type { TitleElementConfig, TitleMenuOption } from '../config/types';
import { setChannelField } from '../linking/useChannel';

interface TitleElementProps {
  config: TitleElementConfig;
}

// The fixed, non-resizable header above everything else (including the resizable title panel) -
// logo on the left, title/subtitle in the middle, options + hamburger menus on the right.
export function TitleElement({ config }: TitleElementProps) {
  const [optionsAnchor, setOptionsAnchor] = useState<HTMLElement | null>(null);
  const [hamburgerAnchor, setHamburgerAnchor] = useState<HTMLElement | null>(null);
  const [noticeOpen, setNoticeOpen] = useState(false);
  // Which options-menu item is currently "active" (radio-style - at most one at a time). Plain
  // component state, not derived from the channels themselves, since two options could coincide
  // on the same values - this is the source of truth for which one is considered selected.
  const [activeOptionId, setActiveOptionId] = useState<string | undefined>();

  // Selecting an option clears every OTHER option's configured filter fields first (so a stale
  // selection from a previously-active option can't linger), then applies the clicked option's
  // own values - clicking the already-active option again just clears everything (deselects).
  const handleOptionClick = (option: TitleMenuOption) => {
    const allOptions = config.optionsMenu?.options ?? [];
    const isActive = activeOptionId === option.id;
    const nextActive = isActive ? undefined : option;
    const seen = new Set<string>();
    for (const opt of allOptions) {
      for (const filter of opt.filters ?? []) {
        const key = `${filter.channel}\u0000${filter.field}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const matching = nextActive?.filters?.find((f) => f.channel === filter.channel && f.field === filter.field);
        setChannelField(filter.channel, filter.field, matching?.values ?? []);
      }
    }
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
