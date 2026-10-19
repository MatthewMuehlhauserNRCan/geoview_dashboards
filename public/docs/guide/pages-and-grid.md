# Pages & Grid

## Pages

```ts
interface DashboardPageConfig {
  id: string;
  label: string; // shown on the footer tab, when there's more than one page
  titlePanel?: TitlePanelConfig; // per-page - see Title & Footer
  grid: GridConfig;
  panels: GridPanel[];
}
```

Each page has its own independent grid and set of panels. `dataSources` and `linking` are
**not** authored per-page - they live on the top-level `DashboardConfig` and are shared by every
page.

Switching pages fully unmounts/remounts the outgoing page's panels - e.g. a map panel on a page
you switch away from and back to will reload from scratch.

## The grid

```ts
interface GridConfig {
  columns: number;
  rows: number;
  columnSizes?: number[]; // relative weights (like CSS fr units), default: all equal
  rowSizes?: number[];
}
```

The grid always fills the available space (no leftover space, no page-level scroll) - pick
`columns`/`rows` for the coarse layout you want (e.g. `4` x `3`), then place panels into cells.
A viewer can drag the dividers between tracks at runtime to resize them - `columnSizes`/
`rowSizes` are just the **starting** sizes, a viewer's drag doesn't write back into the config.

## Placing a panel

Every panel placed directly on a page's grid needs a `layout`:

```ts
interface PanelLayout {
  col: number; // 1-indexed, like CSS grid-column
  row: number; // 1-indexed, like CSS grid-row
  colSpan?: number; // default 1
  rowSpan?: number; // default 1
}
```

A panel spanning `colSpan`/`rowSpan` > 1 occupies multiple cells - e.g. a map panel is commonly
`{ col: 1, row: 1, colSpan: 2, rowSpan: 2 }` to take up a 2x2 block. Every cell in the grid should
be covered by exactly one panel (no gaps, no overlaps) for a fully-filled layout, though this
isn't strictly enforced.

Panels nested inside a `tab`'s `tabs[].panel` or a `stack`'s `items[]` do **not** have a `layout`
- their position is implied by their parent (see [Panels](guide/panels.md#tab) for `tab` and
`stack`).
