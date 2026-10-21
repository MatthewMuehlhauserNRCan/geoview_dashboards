import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Separate from vite.config.ts (which is build-only: multi-page inputs, GH Pages base path) so
// vitest's config stays simple and the two never fight over conflicting `test`/`build` options.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    // Default 'forks' pool spawns real OS child processes, which on this machine sometimes never
    // responds in time (`Timeout waiting for worker to respond`, likely antivirus/security
    // software scanning each new node.exe) - 'threads' uses in-process worker_threads instead,
    // which starts near-instantly and hasn't reproduced the timeout across repeated runs.
    pool: 'threads',
  },
});
