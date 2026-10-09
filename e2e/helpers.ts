import { expect, type Page } from '@playwright/test';

/** The title screen shows once per page load; press it like a host would. */
export async function insertCoin(page: Page) {
  await page.getByRole('button', { name: 'Insert coin' }).click();
  await expect(page.getByRole('main', { name: 'Title' })).toBeHidden();
}

/** Waits out (or skips) the ~4 s character-select intro after Start. */
export async function skipIntro(page: Page) {
  const intro = page.getByTestId('match-intro');
  await intro.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => undefined);
  if (await intro.isVisible()) await intro.click();
  await expect(intro).toBeHidden();
}
