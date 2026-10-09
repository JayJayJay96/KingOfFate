import { expect, test, type Page } from '@playwright/test';

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

/** Starts a match whose roster is exactly W + 1, so it opens straight in the finale. */
async function openFinale(page: Page, names: string[], winners: number) {
  await page.getByLabel(/paste names/i).fill(names.join('\n'));
  await page.getByRole('button', { name: /add to roster/i }).click();
  await page.getByRole('radio', { name: String(winners), exact: true }).check({ force: true });
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.getByRole('main', { name: 'Finale' })).toBeVisible();
}

async function completedRecords(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const r = indexedDB.open('kof');
        r.onsuccess = () => {
          const db = r.result;
          if (!db.objectStoreNames.contains('completed-matches')) return resolve(-1);
          const req = db.transaction('completed-matches').objectStore('completed-matches').count();
          req.onsuccess = () => resolve(req.result);
        };
      }),
  );
}

const roundLines = (page: Page) =>
  page
    .getByTestId('event-log')
    .getByRole('listitem')
    .filter({ hasText: /Round \d+:/ });

test('a real Một Hai Ba Yo finale runs automatically to exactly one winner', async ({ page }) => {
  test.setTimeout(180_000);
  await openFinale(page, ['Aisyah', 'Wei Jie'], 1);
  await expect(page.getByTestId('finalist')).toHaveCount(2);

  await page.getByRole('button', { name: /start the finale/i }).click();
  await expect(page.getByTestId('chant')).toHaveText(/Một|Hai|Ba|Yo!/, { timeout: 5_000 });

  const victory = page.getByRole('main', { name: 'Victory' });
  await expect(victory).toBeVisible({ timeout: 150_000 });
  await expect(page.getByRole('list', { name: 'Winners' }).getByRole('listitem')).toHaveCount(1);
  await expect(page.getByTestId('result-saved')).toBeVisible();
  expect(await completedRecords(page)).toBe(1);

  // A reload during the ceremony shows the same result and records nothing new.
  const winner = await page.getByRole('list', { name: 'Winners' }).textContent();
  await page.reload();
  await expect(victory).toBeVisible();
  await expect(page.getByRole('list', { name: 'Winners' })).toHaveText(winner ?? '');
  expect(await completedRecords(page)).toBe(1);

  await page.getByRole('button', { name: /return to setup/i }).click();
  await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeEnabled();
  expect(await completedRecords(page)).toBe(1);
});

test('refreshing mid-finale continues the same finale without repeating or losing rounds', async ({
  page,
}) => {
  test.setTimeout(240_000);
  await openFinale(page, ['Aisyah', 'Wei Jie', 'Kavitha'], 2);
  await page.getByRole('button', { name: /start the finale/i }).click();
  await expect(roundLines(page)).not.toHaveCount(0, { timeout: 20_000 });

  const before = await roundLines(page).allTextContents();
  await page.reload();
  await expect(page.getByRole('main', { name: /Finale|Victory/ })).toBeVisible();
  // Everything already resolved is still there, unchanged.
  expect((await roundLines(page).allTextContents()).slice(0, before.length)).toEqual(before);

  await expect(page.getByRole('main', { name: 'Victory' })).toBeVisible({ timeout: 200_000 });
  await expect(page.getByRole('list', { name: 'Winners' }).getByRole('listitem')).toHaveCount(2);
  const numbers = (await roundLines(page).allTextContents()).map((t) =>
    Number(/Round (\d+):/.exec(t)![1]),
  );
  expect(numbers).toEqual(numbers.map((_, i) => i + 1)); // 1, 2, 3, … no gaps, no repeats
  expect(await completedRecords(page)).toBe(1);
});
