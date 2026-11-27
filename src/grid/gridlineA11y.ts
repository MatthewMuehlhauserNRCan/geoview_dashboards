// react-resizable-panels' Gridline renders a focusable role="separator" but has no prop for an
// accessible name (WCAG 4.1.2) - set one directly on its element via `elementRef` instead.
function nameSeparator(label: string) {
  return (element: HTMLDivElement | null) => {
    element?.setAttribute('aria-label', label);
  };
}

// Module-level so the ref callbacks stay stable across renders.
export const columnGridlineRef = nameSeparator('Resize columns');
export const rowGridlineRef = nameSeparator('Resize rows');
