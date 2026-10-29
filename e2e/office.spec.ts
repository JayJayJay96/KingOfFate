import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { createFakeOfficeServer } from '../src/test/fakeOffice.ts';
import { insertCoin } from './helpers.ts';

/** Every office call goes to an in-memory fake (the E2E build points at kof-e2e.supabase.co). */
async function routeOffice(
  context: BrowserContext,
  server: ReturnType<typeof createFakeOfficeServer>,
) {
  await context.route('https://kof-e2e.supabase.co/rest/v1/rpc/**', async (route) => {
    if (!server.state.online) return route.abort('internetdisconnected');
    const name = route.request().url().split('/rpc/')[1] ?? '';
    const body = server.handle(name, route.request().postDataJSON() as Record<string, unknown>);
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}

async function openFresh(page: Page) {
  await page.goto('/');
  await page.evaluate(async () => {
    localStorage.clear();
    for (const name of ['kof', 'kof-office']) {
      await new Promise<void>((resolve) => {
        const request = indexedDB.deleteDatabase(name);
        request.onsuccess = request.onerror = request.onblocked = () => resolve();
      });
    }
  });
  await page.reload();
  await insertCoin(page);
}

async function switchToOffice(page: Page, code = '116059') {
  await page.getByLabel('Office code').fill(code);
  await page.getByRole('button', { name: 'Switch to Office' }).click();
  await expect(page.getByTestId('office-state')).toContainText('Office:');
}

test('Office mode: one host sets up, another PC hosts with the same roster; results upload', async ({
  browser,
}) => {
  test.setTimeout(200_000);
  const server = createFakeOfficeServer();
  const errors: string[] = [];

  const pc1 = await browser.newContext();
  await routeOffice(pc1, server);
  const host1 = await pc1.newPage();
  host1.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await openFresh(host1);
  await host1.getByLabel(/paste names/i).fill('Aisyah\nWei Jie');
  await host1.getByRole('button', { name: /add to roster/i }).click();
  await switchToOffice(host1);
  // This PC's roster filled the empty office.
  await expect
    .poll(() => (server.state.setup as { roster?: unknown[] } | null)?.roster?.length)
    .toBe(2);

  // A second PC: switch to Office and the roster is there without setting anything up.
  const pc2 = await browser.newContext();
  await routeOffice(pc2, server);
  const host2 = await pc2.newPage();
  await openFresh(host2);
  await switchToOffice(host2);
  await expect(host2.getByRole('button', { name: 'Wei Jie', exact: true })).toBeVisible();

  // The server goes down mid-match: the result is kept and uploaded once it is back.
  server.state.online = false;
  await host2.getByRole('button', { name: 'Start', exact: true }).click();
  await host2.getByRole('button', { name: /start the finale/i }).click();
  await expect(host2.getByRole('main', { name: 'Victory' })).toBeVisible({ timeout: 150_000 });
  await host2.getByRole('button', { name: /return to setup/i }).click();
  await expect(host2.getByTestId('office-state')).toContainText('cannot be reached', {
    timeout: 15_000,
  });
  await expect(host2.getByTestId('office-state')).toContainText('1 result waiting to upload');
  expect(server.state.matches.size).toBe(0);

  server.state.online = true;
  await host2.reload();
  await insertCoin(host2);
  await expect.poll(() => server.state.matches.size, { timeout: 15_000 }).toBe(1);
  await expect(host2.getByTestId('office-state')).toContainText('shared with every PC');

  // The first PC sees the shared history.
  await host1.getByRole('button', { name: 'History', exact: true }).click();
  await expect(host1.getByRole('button', { name: 'Matches (1)' })).toBeVisible();
  expect(errors.filter((e) => /Content Security Policy/i.test(e))).toEqual([]);
  await pc1.close();
  await pc2.close();
});
