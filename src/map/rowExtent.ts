import type { MapExtent } from './types';

// Non-enumerable property name carrying a row's own bounding-box extent (same projection as
// MapExtent), when known - attached directly onto row objects returned by a map-layer data
// source's getLayerFeatures() so it travels with the row data itself. Non-enumerable so it's
// invisible to Object.keys() (used by TablePanel's dynamic columns and ChartPanel's
// numeric/label-key auto-detection) and to JSON.stringify - a plain string key would otherwise
// leak in as a bogus extra column/field everywhere row keys are enumerated.
//
// Deliberately NOT a separate identity-keyed (WeakMap) lookup, unlike zoom-to-feature's first
// attempt at something similar - that broke across refetches/HMR because a remounted map handle
// gets a fresh WeakMap while cached query data still points at objects from the old one (see
// docs/ARCHITECTURE.md, "ZOOM-TO-FEATURE: REDESIGNED AWAY FROM WEAKMAP IDENTITY"). Attaching the
// extent directly to the exact row object produced by that same fetch avoids that class of bug
// entirely - there's no separate map to go stale.
const ROW_EXTENT_KEY = '__rowExtent';

export function setRowExtent(row: Record<string, unknown>, extent: MapExtent | undefined): void {
  if (!extent) return;
  Object.defineProperty(row, ROW_EXTENT_KEY, { value: extent, enumerable: false, configurable: true });
}

export function getRowExtent(row: Record<string, unknown>): MapExtent | undefined {
  return row[ROW_EXTENT_KEY] as MapExtent | undefined;
}

export function extentsIntersect(a: MapExtent, b: MapExtent): boolean {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
}

// A row with no resolvable geometry can't be verified as "in view" - treated as NOT passing the
// filter (rather than always kept) so turning on map-view filtering also hides rows this app
// already can't place on the map at all, instead of leaving them in indefinitely.
export function rowPassesViewExtent(row: Record<string, unknown>, viewExtent: MapExtent): boolean {
  const rowExtent = getRowExtent(row);
  return rowExtent !== undefined && extentsIntersect(rowExtent, viewExtent);
}
