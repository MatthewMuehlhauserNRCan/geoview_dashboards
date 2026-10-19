import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DashboardApp } from './app/DashboardApp';
import { parseDashboardConfig } from './config/schema';
import './App.css';

// One React root per mounted container, so render() can be called again on the same
// container (to swap configs) without leaking roots, and unmount() can clean up properly.
const roots = new Map<HTMLElement, Root>();

function resolveElement(container: HTMLElement | string): HTMLElement {
  const el = typeof container === 'string' ? document.getElementById(container) : container;
  if (!el) {
    throw new Error(`GeoViewDashboards: no element found for "${container}"`);
  }
  return el;
}

/** Validates `config` and renders a dashboard into `container` (an element or its id). */
function render(container: HTMLElement | string, config: unknown): void {
  const el = resolveElement(container);
  const parsed = parseDashboardConfig(config);

  let root = roots.get(el);
  if (!root) {
    root = createRoot(el);
    roots.set(el, root);
  }
  root.render(
    <StrictMode>
      <DashboardApp config={parsed} />
    </StrictMode>,
  );
}

/** Unmounts a dashboard previously rendered into `container`. No-op if none was mounted there. */
function unmount(container: HTMLElement | string): void {
  const el = resolveElement(container);
  const root = roots.get(el);
  if (root) {
    root.unmount();
    roots.delete(el);
  }
}

declare global {
  interface Window {
    GeoViewDashboards: { render: typeof render; unmount: typeof unmount };
  }
}

window.GeoViewDashboards = { render, unmount };
