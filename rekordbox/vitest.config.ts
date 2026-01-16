import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/apps/desktop/**'], // Desktop has its own vite config
  },
  resolve: {
    alias: {
      '@dropcrate/core': path.resolve(__dirname, './packages/core/src'),
      '@dropcrate/bridge': path.resolve(__dirname, './apps/bridge/src'),
    },
  },
});
