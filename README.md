# GeoView Dashboards

A config-driven dashboard package in the GeoView family. Like GeoView Stories, a dashboard
is embedded into a page via a script tag plus a JSON/YAML config — but instead of stacking
narrative steps, a dashboard arranges multiple linked panels (map, charts, tables, filters)
on a flexible grid, optionally pulling data from sources outside the map itself.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the locked-in architecture decisions,
config schema draft, and open questions.

## Status

Base project scaffolded (Vite + React + TypeScript). Panel/data-source/linking abstractions
are being stubbed out per the architecture doc.

## Development

```
npm install
npm run dev
```
