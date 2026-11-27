import type { Theme } from '@mui/material/styles';

// Hidden visually but still read by screen readers (same technique as MUI's own `visuallyHidden`).
export const visuallyHidden = {
  border: 0,
  clip: 'rect(0 0 0 0)',
  height: '1px',
  margin: '-1px',
  overflow: 'hidden',
  padding: 0,
  position: 'absolute',
  whiteSpace: 'nowrap',
  width: '1px',
} as const;

// Readable black/white text for an author-supplied background color. MUI's getContrastText throws
// on formats it can't parse (e.g. CSS named colors like "darkred") - those fall back to `fallback`.
export function contrastTextFor(theme: Theme, background: string | undefined, fallback: string): string {
  if (!background) return fallback;
  try {
    return theme.palette.getContrastText(background);
  } catch {
    return fallback;
  }
}
