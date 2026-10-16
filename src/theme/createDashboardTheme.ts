import { alpha, createTheme, type Theme } from '@mui/material/styles';
import type { DashboardThemeConfig } from '../config/types';

// Builds the MUI theme the whole dashboard renders with - any omitted field falls back to MUI's
// own default palette, so an unconfigured dashboard looks exactly like MUI's default styling.
// Most components already reference theme-relative tokens (`primary.main`, `background.paper`,
// `divider`, etc.) rather than hardcoded colors, so this alone re-skins the dashboard without
// needing per-component changes.
export function createDashboardTheme(config: DashboardThemeConfig | undefined): Theme {
  const paletteInput = {
    ...(config?.primaryColor ? { primary: { main: config.primaryColor } } : {}),
    ...(config?.secondaryColor ? { secondary: { main: config.secondaryColor } } : {}),
    background: {
      ...(config?.backgroundColor ? { default: config.backgroundColor } : {}),
      ...(config?.paperColor ? { paper: config.paperColor } : {}),
    },
  };

  // A custom background/paper color needs a matching text color or it can end up unreadable
  // (e.g. MUI's default near-black text on a custom dark background) - if the author didn't set
  // one explicitly, pick a readable black/white automatically via MUI's own contrast calculation
  // against whichever surface most of the dashboard's text actually sits on (panel/card surfaces).
  let textColor = config?.textColor;
  if (!textColor && (config?.backgroundColor || config?.paperColor)) {
    const base = createTheme({ palette: paletteInput });
    textColor = base.palette.getContrastText(config.paperColor ?? config.backgroundColor!);
  }

  return createTheme({
    palette: {
      ...paletteInput,
      ...(textColor
        ? {
            text: {
              primary: textColor,
              // Same ~70% opacity relationship MUI's own dark-mode default uses between
              // text.secondary and text.primary, so secondary text stays visibly dimmer but
              // still legible instead of defaulting to MUI's light-mode near-black gray.
              secondary: alpha(textColor, 0.7),
            },
          }
        : {}),
    },
  });
}
