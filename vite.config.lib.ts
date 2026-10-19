import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Separate build pass (run after the main `vite build`) that produces a single-file,
// script-tag-embeddable bundle - the same "script tag + config" embed model as GeoView itself.
// Outputs to the same dist/ as the main build (not cleared) so both ship together to Pages.
export default defineConfig({
  plugins: [react()],
  base: '/geoview_dashboards/',
  // Library mode (unlike the app build) doesn't replace process.env.NODE_ENV by default, but
  // react-dom/scheduler read it directly at runtime - leaving it undefined throws in the browser.
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: resolve(import.meta.dirname, 'src/embed.tsx'),
      name: 'GeoViewDashboards',
      formats: ['iife'],
      fileName: () => 'geoview-dashboards.js',
      cssFileName: 'geoview-dashboards',
    },
  },
});
