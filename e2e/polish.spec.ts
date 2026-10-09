import { insertCoin, skipIntro } from './helpers.ts';
import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    localStorage.clear();
    for (const name of ['kof', 'kof-assets']) {
      await new Promise<void>((resolve) => {
        const request = indexedDB.deleteDatabase(name);
        request.onsuccess = request.onerror = request.onblocked = () => resolve();
      });
    }
  });
  await page.reload();
  await insertCoin(page);
});

async function start(page: Page, names: string[], winners: number) {
  await page.getByLabel(/paste names/i).fill(names.join('\n'));
  await page.getByRole('button', { name: /add to roster/i }).click();
  await page.getByRole('radio', { name: String(winners), exact: true }).check({ force: true });
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  if (names.length > winners + 1) await skipIntro(page);
}

/** A tiny valid 8 kHz mono WAV (0.1 s of silence). */
function silentWav(): Buffer {
  const samples = 800;
  const buf = Buffer.alloc(44 + samples);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + samples, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(8000, 24);
  buf.writeUInt32LE(8000, 28);
  buf.writeUInt16LE(1, 32);
  buf.writeUInt16LE(8, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(samples, 40);
  buf.fill(128, 44);
  return buf;
}

test('every fighter has a pixel portrait; Fate slots use pixel icons', async ({ page }) => {
  await start(page, ['Aisyah', 'Wei Jie', 'Kavitha', 'Hafiz', 'Mei Ling'], 1);
  await expect(page.locator('.fighter svg.fighter-sprite')).toHaveCount(5);
  await expect(page.locator('.fate-slot svg.pixel-icon')).toHaveCount(20);
});

test('D4: Esc pauses the finale after the current round, Resume continues', async ({ page }) => {
  test.setTimeout(180_000);
  await start(page, ['Aisyah', 'Wei Jie'], 1);
  await page.getByRole('button', { name: /start the finale/i }).click();
  const rounds = page
    .getByTestId('event-log')
    .getByRole('listitem')
    .filter({ hasText: /Round \d+:/ });
  await expect(rounds).not.toHaveCount(0, { timeout: 20_000 });

  await page.keyboard.press('Escape');
  const dialog = page.getByRole('dialog', { name: 'Finale paused' });
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  const held = await rounds.count();
  await page.waitForTimeout(5_000); // longer than a round
  await expect(rounds).toHaveCount(held);

  await dialog.getByRole('button', { name: 'Resume' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('main', { name: 'Victory' })).toBeVisible({ timeout: 150_000 });
});

test('sound settings and a custom music file persist in this browser', async ({ page }) => {
  const music = page.getByRole('slider', { name: 'Music' });
  await music.fill('15');
  await expect(page.getByRole('combobox', { name: 'Chant voice' })).toBeVisible();

  await page.getByLabel(/choose file/i).setInputFiles({
    name: 'office-theme.wav',
    mimeType: 'audio/wav',
    buffer: silentWav(),
  });
  await expect(page.getByText('My music file: office-theme.wav')).toBeVisible();
  await expect(page.getByRole('radio', { name: /my music file/i })).toBeChecked();

  await page.reload();
  await insertCoin(page);
  await expect(music).toHaveValue('15');
  await expect(page.getByText('My music file: office-theme.wav')).toBeVisible();
  await expect(page.getByRole('radio', { name: /my music file/i })).toBeChecked();

  await page.getByRole('button', { name: 'Remove' }).click();
  await expect(page.getByRole('radio', { name: /built-in chiptune/i })).toBeChecked();
  await page.reload();
  await insertCoin(page);
  await expect(page.getByText(/My music file:/)).toHaveCount(0);
});

test('keyboard shortcuts in a match: Esc menu, M mute, S shuffle', async ({ page }) => {
  await start(page, ['Aisyah', 'Wei Jie', 'Kavitha', 'Hafiz', 'Mei Ling', 'Arjun'], 1);
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  const names = page.locator('.fighter .fighter__name');
  const before = await names.allTextContents();

  await page.keyboard.press('s');
  await expect.poll(() => names.allTextContents()).not.toEqual(before);

  await page.keyboard.press('m');
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('kof.audio') ?? '{}').muted))
    .toBe(true);

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Paused' })).toBeHidden();
});
