import { expect, test, type Page } from '@playwright/test';

const SPIN_BUDGET = 9_000; // 4.5 s spin + hold + margin

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    localStorage.clear();
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase('kof');
      request.onsuccess = request.onerror = request.onblocked = () => resolve();
    });
  });
  await page.reload();
});

async function startMatch(page: Page, names: string[], winners: number) {
  await page.getByLabel(/paste names/i).fill(names.join('\n'));
  await page.getByRole('button', { name: /add to roster/i }).click();
  await page.getByRole('radio', { name: String(winners), exact: true }).check({ force: true });
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.getByRole('list', { name: 'Fighters' })).toBeVisible();
}

const eliminated = (page: Page) => page.locator('[data-state="out"]');
const randomButton = (page: Page) =>
  page.getByRole('button', { name: /random: start the next turn/i });

test('KO-only match runs a real 4–5 s spin and hands off at W + 1', async ({ page }) => {
  await startMatch(page, ['Aisyah', 'Wei Jie', 'Kavitha', 'Hafiz'], 2);

  const started = Date.now();
  await randomButton(page).click();
  await expect(randomButton(page)).toBeDisabled();
  await expect(page.getByRole('heading', { name: 'Finale!' })).toBeVisible({
    timeout: SPIN_BUDGET,
  });
  const elapsed = Date.now() - started;
  expect(elapsed).toBeGreaterThanOrEqual(4_000);

  await expect(page.getByRole('list', { name: 'Finalists' }).getByRole('listitem')).toHaveCount(3);
  await expect(page.getByTestId('event-log')).toContainText('takes a KO. Eliminated!');
  await page.getByRole('button', { name: /return to setup/i }).click();
  await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeEnabled();
});

test('refreshing mid-spin restores the committed turn and applies it exactly once', async ({
  page,
}) => {
  await startMatch(page, ['Aisyah', 'Wei Jie', 'Kavitha', 'Hafiz', 'Mei Ling'], 1);

  await randomButton(page).click();
  await page.waitForTimeout(1_000);
  await page.reload();

  // Restored straight into the same match, which finishes the committed spin.
  await expect(page.getByRole('list', { name: 'Fighters' })).toBeVisible();
  await expect(eliminated(page)).toHaveCount(1, { timeout: SPIN_BUDGET });
  await expect(page.getByTestId('alive-count')).toHaveText('4 / 5 alive');
  const log = page.getByTestId('event-log').getByRole('listitem');
  await expect(log.filter({ hasText: 'Eliminated!' })).toHaveCount(1);

  // A second reload must not double-apply anything.
  await page.reload();
  await expect(page.getByTestId('alive-count')).toHaveText('4 / 5 alive');
  await expect(log.filter({ hasText: 'Eliminated!' })).toHaveCount(1);
  await expect(randomButton(page)).toBeEnabled();
});

test('mashing Space starts only one turn', async ({ page }) => {
  await startMatch(page, ['Aisyah', 'Wei Jie', 'Kavitha', 'Hafiz', 'Mei Ling'], 1);
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  for (let i = 0; i < 5; i++) await page.keyboard.press('Space');

  await expect(eliminated(page)).toHaveCount(1, { timeout: SPIN_BUDGET });
  await page.waitForTimeout(500);
  await expect(eliminated(page)).toHaveCount(1);
  await expect(page.getByTestId('alive-count')).toHaveText('4 / 5 alive');
});
