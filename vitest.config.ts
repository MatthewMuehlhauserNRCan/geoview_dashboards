import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Separate from vite.config.ts (which is build-only: multi-page inputs, GH Pages base path) so
// vitest's config stays simple and the two never fight over conflicting `test`/`build` options.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
