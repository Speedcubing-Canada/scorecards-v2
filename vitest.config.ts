import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
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
      thresholds: { autoUpdate: true, lines: 77.29, functions: 73.16, branches: 73.96, statements: 76.09 },
    },
  },
});
