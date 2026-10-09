import { expect, test, type Page } from '@playwright/test';

const SPIN_BUDGET = 13_000; // spin + dwell is capped at 10 s, plus margin

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

test('cursor steps through the grid in order and slows down before stopping', async ({ page }) => {
  await startMatch(page, ['Aisyah', 'Wei Jie', 'Kavitha', 'Hafiz', 'Mei Ling', 'Arjun'], 1);
  const gridOrder = await page.locator('.fighter .fighter__name').allTextContents();

  // Record every cursor move with a timestamp, straight from the DOM.
  await page.evaluate(() => {
    const w = window as unknown as { cursorLog: { name: string; t: number }[] };
    w.cursorLog = [];
    new MutationObserver(() => {
      const el = document.querySelector('[data-cursor="true"] .fighter__name');
      const name = el?.textContent ?? '';
      if (name && w.cursorLog.at(-1)?.name !== name)
        w.cursorLog.push({ name, t: performance.now() });
    }).observe(document.body, { subtree: true, attributes: true, childList: true });
  });

  await randomButton(page).click();
  await expect(eliminated(page)).toHaveCount(1, { timeout: SPIN_BUDGET });
  const log = await page.evaluate(
    () => (window as unknown as { cursorLog: { name: string; t: number }[] }).cursorLog,
  );

  expect(log.length).toBeGreaterThanOrEqual(10); // move count varies per spin style
  for (let i = 1; i < log.length; i++) {
    const prev = gridOrder.indexOf(log[i - 1]!.name);
    expect(log[i]!.name).toBe(gridOrder[(prev + 1) % gridOrder.length]);
  }
  const firstGap = log[1]!.t - log[0]!.t;
  const lastGap = log.at(-1)!.t - log.at(-2)!.t;
  // Gentlest random braking curve still gives ~5×; 3× leaves room for timer jitter.
  expect(lastGap).toBeGreaterThan(firstGap * 3);

  const koName = await eliminated(page).locator('.fighter__name').textContent();
  expect(log.at(-1)!.name).toBe(koName);
});

test('shuffle reorders the grid and the order survives a reload', async ({ page }) => {
  await startMatch(page, ['Aisyah', 'Wei Jie', 'Kavitha', 'Hafiz', 'Mei Ling', 'Arjun'], 1);
  const names = page.locator('.fighter .fighter__name');
  const before = await names.allTextContents();

  await page.getByRole('button', { name: 'Shuffle' }).click();
  await expect.poll(() => names.allTextContents()).not.toEqual(before);
  await expect(page.getByTestId('event-log')).not.toContainText(/shuffled/i);
  const after = await names.allTextContents();
  expect(after).not.toEqual(before);
  expect([...after].sort()).toEqual([...before].sort());

  await page.reload();
  await expect(names).toHaveText(after);
});
