# Theming

Recolors the whole dashboard via an MUI theme - no per-panel styling needed.

```ts
interface DashboardThemeConfig {
  primaryColor?: string; // MUI palette.primary.main
  secondaryColor?: string; // MUI palette.secondary.main
  backgroundColor?: string; // page backdrop behind the grid (palette.background.default)
  paperColor?: string; // panel/card surfaces (palette.background.paper)
  textColor?: string; // main text color (palette.text.primary) - see below
}
```

All fields are optional CSS color strings (hex, `rgb()`, named colors, etc.) - an omitted field
falls back to MUI's own default palette, so an unconfigured dashboard looks exactly like it would
with no `theme` at all.

```json
{
  "theme": {
    "primaryColor": "#6a1b9a",
    "backgroundColor": "#121212",
    "paperColor": "#1e1e1e"
  }
}
```

## Automatic text contrast

If you set `backgroundColor`/`paperColor` to something dark (or otherwise unusual) without also
setting `textColor`, a readable black/white is picked **automatically** based on contrast against
`paperColor` (preferred) or `backgroundColor` - most of this app's own text renders inside panels/
cards, so that's the color that matters most. Only set `textColor` explicitly if you want to
override that automatic choice.

## Where this applies

Dashboard-wide, like `titleElement` - not authored per-page. It's set once at the top level of
`DashboardConfig`, not per-page or per-panel.
