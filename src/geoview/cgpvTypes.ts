// Re-exports the subset of GeoView's own (real) types this app uses, instead of hand-rolled
// duck types - sourced from the `geoview-core-types` devDependency (package.json), a types-only
// package built straight from geoview-core's source (see the geoview repo's
// docs/app/accessing-types.md for how it's published/kept in sync). GeoView itself still has no
// runtime npm package here - it's loaded as a global script (see loadCgpv.ts) - so these are
// compile-time-only `import type`s/re-exports, erased entirely before bundling.
export type { MapViewer } from 'geoview-core-types/src/geo/map/map-viewer';
export type { AbstractGVLayer } from 'geoview-core-types/src/geo/layer/gv-layers/abstract-gv-layer';
export type { TypeFeatureInfoEntry, TypeFeatureInfoResult, TypeLayerStyleConfig } from 'geoview-core-types/src/api/types/map-schema-types';
export type { DomainLayerStatusChangedDelegate } from 'geoview-core-types/src/core/domains/layer-domain';
export type { TypeLegendItem } from 'geoview-core-types/src/core/components/layers/types';
// Importing TypeWindow also pulls in geoview-core-types' own `declare global` augmentation of
// `Window.cgpv`, so this app doesn't need to (re-)declare that global itself.
export type { TypeWindow } from 'geoview-core-types/src/core/types/global-types';

