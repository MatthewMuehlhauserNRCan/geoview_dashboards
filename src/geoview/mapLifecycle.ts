// Serializes create/delete calls per GeoView map id so overlapping mount/unmount cycles
// (e.g. React 18 StrictMode's dev-only double-invoke, or a genuine fast remount) can't run
// concurrently against the same id - each step waits for the previous one to fully settle.
const pending = new Map<string, Promise<void>>();

export function runMapLifecycleStep(mapDivId: string, step: () => Promise<void>): Promise<void> {
  const previous = pending.get(mapDivId) ?? Promise.resolve();
  const next = previous.then(step, step);
  pending.set(mapDivId, next);
  return next;
}
