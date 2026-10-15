// Normalizes a list of fr-like weights into percentages keyed by child index, the shape
// react-resizable-panels' defaultLayout expects. Shared by DashboardGrid (top-level layout) and
// StackPanel (a single grid cell split further into resizable items).
export function toPercentFromWeights(weights: number[]): Record<string, number> {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  return Object.fromEntries(weights.map((weight, index) => [String(index), (weight / total) * 100]));
}
