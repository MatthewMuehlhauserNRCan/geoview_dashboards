import type { ImageItemConfig, ImagePanelConfig } from '../config/types';

// Normalizes the single-image shorthand (`src`/`alt`/`link`) and the `images` list into one list.
// `images` wins when both are set. Entries are returned as-is (including empty `src`s) so the
// editor can edit them; the panel filters out empty ones itself.
export function toImageItems(panel: ImagePanelConfig): ImageItemConfig[] {
  if (panel.images) return panel.images;
  if (panel.src === undefined) return [];
  return [{ src: panel.src, alt: panel.alt, link: panel.link }];
}
