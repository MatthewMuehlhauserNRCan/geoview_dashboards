import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  // Served from https://<user>.github.io/geoview_dashboards/ (a project page, not a custom
  // domain), so built asset URLs need that subpath prefix - but not during local dev.
  base: command === 'build' ? '/geoview_dashboards/' : '/',
  build: {
    // Three separate pages/bundles, all published to GitHub Pages together: a static landing
    // page (index.html) linking to the other two, the end-viewer example dashboard
    // (example.html), and the standalone authoring tool (editor.html) - the editor is never
    // linked from/shipped with the viewer itself.
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, 'index.html'),
        example: resolve(import.meta.dirname, 'example.html'),
        editor: resolve(import.meta.dirname, 'editor.html'),
      },
    },
  },
}))
