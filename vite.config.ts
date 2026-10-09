import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

interface VercelConfig {
  readonly headers: readonly {
    readonly source: string;
    readonly headers: readonly { readonly key: string; readonly value: string }[];
  }[];
}

/**
 * The site-wide security headers from vercel.json, so `vite preview` (and the E2E suite that
 * runs against it) serves the production build under exactly the policy Vercel will apply.
 */
function productionHeaders(): Record<string, string> {
  const config = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8'));
  const global = (config as VercelConfig).headers.find((h) => h.source === '/(.*)');
  return Object.fromEntries((global?.headers ?? []).map((h) => [h.key, h.value]));
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Fonts stay separate files: the CSP allows fonts from 'self' only (no data: URLs).
    assetsInlineLimit: (file) => (/\.(woff2?|ttf|otf)$/.test(file) ? false : undefined),
  },
  preview: {
    headers: productionHeaders(),
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
  },
});
