import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { insertCoin, skipIntro } from './helpers.ts';

/** Phase 7: accessibility, CSP, storage/audio failure, reduced motion and the 32-fighter cap. */

const NAMES = ['Aisyah', 'Wei Jie', 'Kavitha', 'Hafiz', 'Mei Ling', 'Arjun'];

async function resetStorage(page: Page) {
  await page.goto('/');
  await page.evaluate(async () => {
    localStorage.clear();
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase('kof');
      request.onsuccess = request.onerror = request.onblocked = () => resolve();
    });
  });
  await page.reload();
}

/** Any console error or uncaught exception (incl. CSP violations) fails the test. */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

async function addNames(page: Page, names: readonly string[]) {
  await page.getByLabel(/paste names/i).fill(names.join('\n'));
  await page.getByRole('button', { name: /add to roster/i }).click();
}

async function expectAccessible(page: Page, where: string) {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const summary = result.violations.map(
    (v) => `${where}: ${v.id} (${v.impact}) ×${v.nodes.length} — ${v.nodes[0]?.target.join(' ')}`,
  );
  expect(summary).toEqual([]);
}

/** A 2-fighter match opens straight in the finale and runs itself to the victory screen. */
async function playQuickMatch(page: Page) {
  await addNames(page, ['Aisyah', 'Wei Jie']);
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByRole('button', { name: /start the finale/i }).click();
  await expect(page.getByRole('main', { name: 'Victory' })).toBeVisible({ timeout: 120_000 });
}

test('every screen passes automated WCAG 2.1 AA checks, with no console or CSP errors', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const errors = watchErrors(page);
  await resetStorage(page);
  await expectAccessible(page, 'title');
  await insertCoin(page);

  await addNames(page, NAMES);
  await expectAccessible(page, 'setup');
  await page.getByRole('button', { name: 'Change look for Aisyah' }).click();
  await expectAccessible(page, 'look editor');
  await page.getByRole('button', { name: 'Cancel' }).click();

  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await skipIntro(page);
  await expectAccessible(page, 'match');
  await page.keyboard.press('Escape');
  await expectAccessible(page, 'pause menu');
  await page.getByRole('button', { name: 'Abandon match' }).click();
  await page.getByRole('button', { name: /yes, abandon/i }).click();

  await page.getByRole('button', { name: 'All out' }).click();
  await page.getByRole('button', { name: 'Aisyah', exact: true }).click();
  await page.getByRole('button', { name: 'Wei Jie', exact: true }).click();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.getByRole('main', { name: 'Finale' })).toBeVisible();
  await expectAccessible(page, 'finale');
  await page.getByRole('button', { name: /start the finale/i }).click();
  await expect(page.getByRole('main', { name: 'Victory' })).toBeVisible({ timeout: 120_000 });
  await expectAccessible(page, 'victory');

  await page.getByRole('button', { name: /return to setup/i }).click();
  await page.getByRole('button', { name: 'History' }).click();
  await expectAccessible(page, 'luck board');
  await page.getByRole('button', { name: 'Rivalries' }).click();
  await expectAccessible(page, 'rivalries');
  await page.getByRole('button', { name: /^Matches \(/ }).click();
  await page.getByTestId('match-list').getByRole('button').first().click();
  await expectAccessible(page, 'match details');
  await page.getByRole('button', { name: 'Luck board', exact: true }).click();
  await page.getByTestId('leaderboard').getByRole('button').first().click();
  await expectAccessible(page, 'profile');

  expect(errors).toEqual([]);
});

test('without IndexedDB the game still plays and says results are not saved', async ({ page }) => {
  test.setTimeout(150_000);
  await page.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: true });
  });
  await page.goto('/');
  await insertCoin(page);
  await expect(page.getByText(/match progress cannot be saved/i)).toBeVisible();
  await playQuickMatch(page);
  await expect(page.getByText(/the result could not be saved/i)).toBeVisible();
  await page.getByRole('button', { name: /return to setup/i }).click();
  await page.getByRole('button', { name: 'History' }).click();
  await expect(page.getByRole('alert')).toContainText(/history could not be loaded/i);
});

test('when browser storage is blocked, setup still works and warns that nothing is saved', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const blocked = () => {
      throw new DOMException('blocked', 'SecurityError');
    };
    Storage.prototype.getItem = blocked;
    Storage.prototype.setItem = blocked;
  });
  await page.goto('/');
  await insertCoin(page);
  await addNames(page, ['Aisyah', 'Wei Jie', 'Kavitha']);
  await expect(page.getByTestId('roster-count')).toContainText('3');
  await expect(page.getByRole('alert')).toContainText(/settings are not being saved/i);
});

test('without Web Audio or speech the whole game still runs silently', async ({ page }) => {
  test.setTimeout(150_000);
  const errors = watchErrors(page);
  await page.addInitScript(() => {
    for (const key of [
      'AudioContext',
      'webkitAudioContext',
      'speechSynthesis',
      'SpeechSynthesisUtterance',
    ]) {
      Object.defineProperty(window, key, { value: undefined, configurable: true });
    }
  });
  await resetStorage(page);
  await insertCoin(page);
  await playQuickMatch(page);
  expect(errors).toEqual([]);
});

test('reduced motion turns off the idle bob, shake and flashes', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await resetStorage(page);
  const coin = page.getByRole('button', { name: 'Insert coin' });
  expect(await coin.evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
  const sprite = page.locator('.fighter-sprite--idle').first();
  expect(await sprite.evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
});

test('32 fighters fit without sideways scrolling and a turn plays normally', async ({ page }) => {
  test.setTimeout(90_000);
  await resetStorage(page);
  await insertCoin(page);
  await addNames(
    page,
    Array.from({ length: 32 }, (_, i) => `Fighter ${String(i + 1).padStart(2, '0')}`),
  );
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await skipIntro(page);
  await expect(page.getByRole('list', { name: 'Fighters' }).getByRole('listitem')).toHaveCount(32);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  await page.getByRole('button', { name: /random: start the next turn/i }).click();
  await expect(
    page
      .getByTestId('event-log')
      .getByRole('listitem')
      .filter({ hasText: /^Turn 1:/ }),
  ).toHaveCount(1, { timeout: 30_000 });
});

test('a second tab gets a warning (both tabs share one saved match)', async ({ context }) => {
  const first = await context.newPage();
  await first.goto('/');
  await insertCoin(first);
  const second = await context.newPage();
  await second.goto('/');
  await insertCoin(second);
  const warning = /also open in another tab/i;
  await expect(second.getByRole('alert').filter({ hasText: warning })).toBeVisible();
  await expect(first.getByRole('alert').filter({ hasText: warning })).toBeVisible();
  await second.close();
  await expect(first.getByRole('alert').filter({ hasText: warning })).toBeHidden();
});

test('idle fighters visibly bob (at least 2 px, even on small grid sprites)', async ({ page }) => {
  await resetStorage(page);
  await insertCoin(page);
  await addNames(page, NAMES);
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await skipIntro(page);
  const sprite = page.locator('.fighter .fighter-sprite--idle').first();
  const travel = await sprite.evaluate(async (el) => {
    const tops: number[] = [];
    for (let i = 0; i < 30; i++) {
      tops.push(el.getBoundingClientRect().top);
      await new Promise((r) => setTimeout(r, 50));
    }
    return Math.max(...tops) - Math.min(...tops);
  });
  expect(travel).toBeGreaterThanOrEqual(2);
  expect(travel).toBeLessThanOrEqual(5.5);
});
