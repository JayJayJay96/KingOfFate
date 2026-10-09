import { expect, test } from '@playwright/test';

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

test('setup validates, survives a refresh and starts a match', async ({ page }) => {
  const start = page.getByRole('button', { name: 'Start', exact: true });
  await expect(page.getByRole('heading', { name: 'King of Fate' })).toBeVisible();
  await expect(start).toBeDisabled();

  await page.getByLabel(/paste names/i).fill('Aisyah\nWei Jie\n\n  Kavitha  \naisyah\nMuthu');
  await page.getByRole('button', { name: /add to roster/i }).click();
  await expect(page.getByText(/added 4 fighters/i)).toBeVisible();
  await expect(page.getByText('“aisyah” is already on the roster.')).toBeVisible();
  await expect(start).toBeEnabled();

  // N = W is rejected.
  await page.getByRole('radio', { name: '4', exact: true }).check({ force: true });
  await expect(start).toBeDisabled();
  await page.getByRole('radio', { name: '2', exact: true }).check({ force: true });
  await page.getByRole('radio', { name: /chaotic/i }).check({ force: true });
  await page.getByRole('button', { name: 'Muthu', exact: true }).click();
  await expect(page.getByTestId('roster-count')).toHaveText('3 in · 4 total');

  await page.reload();

  await expect(page.getByTestId('roster-count')).toHaveText('3 in · 4 total');
  await expect(page.getByRole('button', { name: 'Muthu', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await expect(page.getByRole('radio', { name: '2', exact: true })).toBeChecked();
  await expect(page.getByRole('radio', { name: /chaotic/i })).toBeChecked();

  // 3 active for 2 winners = W + 1: straight to the finale, inactive Muthu excluded.
  await start.click();
  await expect(page.getByRole('main', { name: 'Finale' })).toBeVisible();
  await expect(page.locator('[data-testid=finalist] .finalist__name')).toHaveText([
    'Aisyah',
    'Wei Jie',
    'Kavitha',
  ]);
});
