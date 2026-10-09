import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('setup validates, survives a refresh and starts the placeholder match', async ({ page }) => {
  const start = page.getByRole('button', { name: 'Start', exact: true });
  await expect(page.getByRole('heading', { name: 'King of Fate' })).toBeVisible();
  await expect(start).toBeDisabled();

  await page.getByLabel(/paste names/i).fill('An\nBình\n\n  Chi  \nan\nDũng');
  await page.getByRole('button', { name: /add to roster/i }).click();
  await expect(page.getByText(/added 4 fighters/i)).toBeVisible();
  await expect(page.getByText('“an” is already on the roster.')).toBeVisible();
  await expect(start).toBeEnabled();

  // N = W is rejected.
  await page.getByRole('radio', { name: '4', exact: true }).check({ force: true });
  await expect(start).toBeDisabled();
  await page.getByRole('radio', { name: '2', exact: true }).check({ force: true });
  await page.getByRole('radio', { name: /chaotic/i }).check({ force: true });
  await page.getByRole('button', { name: 'Dũng', exact: true }).click();
  await expect(page.getByTestId('roster-count')).toHaveText('3 in · 4 total');

  await page.reload();

  await expect(page.getByTestId('roster-count')).toHaveText('3 in · 4 total');
  await expect(page.getByRole('button', { name: 'Dũng', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await expect(page.getByRole('radio', { name: '2', exact: true })).toBeChecked();
  await expect(page.getByRole('radio', { name: /chaotic/i })).toBeChecked();

  await start.click();
  await expect(page.getByText(/gameplay is not implemented yet/i)).toBeVisible();
  await expect(page.getByRole('listitem')).toHaveText(['An', 'Bình', 'Chi']);
  await page.getByRole('button', { name: /back to setup/i }).click();
  await expect(start).toBeEnabled();
});
