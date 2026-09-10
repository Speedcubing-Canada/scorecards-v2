import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Pin the one VITE_ var the app reads at module scope. Without this a test
    // inherits the developer's .env and passes locally while failing in CI,
    // where no .env exists (src/auth/wca.ts reads CLIENT_ID at import time).
    env: { VITE_WCA_CLIENT_ID: 'test-client-id' },
    coverage: {
      provider: 'v8',
      // Files no test imports are listed on purpose: the baseline has to be the
      // honest number, not the number for whatever happens to be covered.
      include: ['src/**/*.{ts,tsx}', 'analytics.js', 'server.js'],
      exclude: [
        '**/*.test.*',
        'src/test/**',
        'src/**/*.d.ts',
        'src/assets/**',   // base64 blobs, no logic
        'src/types/**',    // type-only
        'src/main.tsx',    // bootstrap, nothing to assert
      ],
      reporter: ['text', 'json-summary', 'html'],
      // A ratchet: autoUpdate rewrites these upward on any run that improves
      // coverage, so CI only ever fails on a drop. Never lower them by hand.
      thresholds: { autoUpdate: true, lines: 77.29, functions: 73.16, branches: 74.02, statements: 76.09 },
    },
  },
});
