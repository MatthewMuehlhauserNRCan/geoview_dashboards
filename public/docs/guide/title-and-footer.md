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
    // defined once, shared by every option below
    targets?: { id: string; label?: string; channel: string; field: string; dataSources?: string[] }[];
    options: {
      id: string;
      label: string;
      values?: Record<string, string[]>; // keyed by target id
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

`optionsMenu.targets` makes an option clickable as a filter preset: each **target** defines WHERE
a value lands - a channel + field (same shape any panel's selection would push onto a
[linking](guide/linking.md) channel) - defined once and shared by every option, instead of
repeating that shape per option. Each **option** then just supplies a short `values` list per
target (keyed by the target's `id`). Selecting an option sets every target's channel/field to that
option's `values[target.id]` (or clears it, if omitted). Options in the same menu behave like a
radio group - at most one is "active" at a time, shown with a checkmark; selecting a different
option clears every *other* option's values first, and clicking the already-active option again
clears it (back to unconstrained/show-all). An option with no matching `values` entry for a given
target just clears that target.

`targets[].dataSources` is optional and purely a note-to-self (shown as a multi-select in the
editor) - it documents which data source(s) share this target's exact `field` name AND value
representation, but it is NOT applied at runtime; only `channel`/`field` are. If your data sources
use **different field names** (or different value representations) for what's conceptually the
same filter (e.g. one layer's `AGENCY_NAME` vs. another's `AGENCY_CODE`), give each one its **own
target**, each on its **own, separate channel** (and make sure only that data source's panels
`listensTo` it) - same pattern as the legend panel's channel split described in
[Linking](guide/linking.md#important-caveat-legend-channels-and-domain-coded-fields). Putting two
different fields for two different data sources on the *same* channel instead will AND them
together (a channel's fields are all required to match - see `rowMatchesFieldFilter`), emptying
out any panel whose rows don't have *every* one of those fields.

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
