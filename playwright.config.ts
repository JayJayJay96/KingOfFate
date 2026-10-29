import { defineConfig } from '@playwright/test';

const PORT = 4173;

// Locally we drive the installed Microsoft Edge (no browser download needed).
// Set PW_CHANNEL=chromium (after `npx playwright install chromium`) for bundled Chromium.
const channel = process.env.PW_CHANNEL ?? (process.platform === 'win32' ? 'msedge' : undefined);

export default defineConfig({
  testDir: './e2e',
  // Real spins last up to 10 s; a refresh-mid-spin test replays one.
  timeout: 60_000,
  fullyParallel: true,
  // Timing-sensitive specs (cursor order, animations) need real frames; too many parallel
  // browsers on one machine starve them and cause false failures.
  workers: 4,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: channel === 'chromium' ? undefined : channel,
    trace: 'retain-on-failure',
  },
  webServer: {
    // Smoke-test the production build, not the dev server.
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // Office mode against a routed fake server (e2e/office.spec.ts); nothing leaves the machine.
    env: {
      VITE_SUPABASE_URL: 'https://kof-e2e.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'e2e-public-key',
    },
  },
});
