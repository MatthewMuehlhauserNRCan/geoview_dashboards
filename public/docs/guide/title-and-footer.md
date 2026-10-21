# Title & Footer

Three separate, independent pieces sit around the main grid - none of them are `panel`s (no
`type`, no `layout`, not placed in the col/row system).

## Title element (dashboard-wide, fixed)

A non-resizable header bar above everything else, including the title panel below.

```ts
interface TitleElementConfig {
  image?: { src: string; alt?: string; href?: string }; // left-side logo, optionally a link
  title: string;
  subtitle?: string;
  backgroundColor?: string;
  optionsMenu?: {
    icon?: { src: string; alt?: string };
    label?: string;
    options: {
      id: string;
      label: string;
      filters?: { channel: string; field: string; values: string[] }[];
    }[];
  };
  hamburgerMenu?: {
    links?: { id: string; label: string; href: string }[];
    notice?: { label: string; title: string; content: string }; // opens a plain-text modal
  };
}
```

Set once at the top level (`DashboardConfig.titleElement`) - shared across every page, unlike the
title panel below.

`optionsMenu.options[].filters` makes an option clickable as a filter preset: selecting it sets
each listed channel's field to those values (same shape any panel's selection would push onto a
[linking](guide/linking.md) channel). Options in the same menu behave like a radio group - at most
one is "active" at a time, shown with a checkmark; selecting a different option clears every
*other* option's configured fields first, and clicking the already-active option again clears it
(back to unconstrained/show-all). An option with no `filters` is just an inert menu item.

## Title panel (per-page, resizable)

A thin, full-width strip below the title element: left text / optional centered image / right
text, any of which may be omitted.

```ts
interface TitlePanelConfig {
  left?: string;
  image?: { src: string; alt?: string; href?: string };
  right?: string;
  backgroundColor?: string;
}
```

Set per-page (`DashboardPageConfig.titlePanel`) - different pages can show different title-panel
text, or omit it entirely. Starts sized to its content and only becomes a fixed height once a
viewer drags its bottom edge (so it doesn't force every page to reserve space for it).

## Footer (automatic, not configured)

A row of tabs, one per page, letting a viewer switch between them - shown automatically whenever
`DashboardConfig.pages` has more than one entry. There's no separate config for it: a page's own
`label` is what appears on its tab.
