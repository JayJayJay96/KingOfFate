import { readFile } from 'node:fs/promises';
import { insertCoin } from './helpers.ts';
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
  await insertCoin(page);
});

/** Plays a real 2-fighter match (opens in the finale) to the victory screen. */
async function playQuickMatch(page: Page, names: string[]) {
  await page.getByLabel(/paste names/i).fill(names.join('\n'));
  await page.getByRole('button', { name: /add to roster/i }).click();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByRole('button', { name: /start the finale/i }).click();
  await expect(page.getByRole('main', { name: 'Victory' })).toBeVisible({ timeout: 150_000 });
  const winner = (await page.getByRole('list', { name: 'Winners' }).textContent()) ?? '';
  await page.getByRole('button', { name: /return to setup/i }).click();
  return winner.trim();
}

async function downloadText(page: Page, button: string) {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: button }).click(),
  ]);
  return {
    name: download.suggestedFilename(),
    text: await readFile(await download.path(), 'utf8'),
  };
}

test('a finished match is in History, survives a reload, exports, and can be deleted', async ({
  page,
}) => {
  test.setTimeout(200_000);
  const winner = await playQuickMatch(page, ['Aisyah', 'Wei Jie']);

  await page.getByRole('button', { name: 'History' }).click();
  const board = page.getByTestId('leaderboard');
  await expect(board.getByRole('row')).toHaveCount(3);
  await expect(board.getByRole('row').nth(1).getByRole('rowheader')).toHaveText(winner);
  await expect(board.getByRole('row').nth(1)).toContainText('+0.50');

  // History lives in IndexedDB: a reload keeps it.
  await page.reload();
  await insertCoin(page);
  await page.getByRole('button', { name: 'History' }).click();
  await page.getByRole('button', { name: 'Matches (1)' }).click();
  await expect(page.getByTestId('match-list')).toContainText(`Winner: ${winner}`);
  await page.getByTestId('match-list').getByRole('button').first().click();
  await expect(page.getByTestId('history-log')).toContainText(`Winner: ${winner}!`);

  const json = await downloadText(page, 'Export JSON (full backup)');
  expect(json.name).toMatch(/^kof-history_.*\.json$/);
  const backup = JSON.parse(json.text);
  expect(backup.matches).toHaveLength(1);
  expect(backup.matches[0].match.finale.winnerIds).toHaveLength(1);

  const csv = await downloadText(page, 'Luck board CSV');
  expect(csv.name).toMatch(/^kof-luck-board_.*\.csv$/);
  const lines = csv.text.replace(/^﻿/, '').trim().split('\r\n');
  expect(lines).toHaveLength(3);
  expect(lines[1]).toContain(`,${winner},1,1,1,0.5,0.5,`);

  await page.getByRole('button', { name: 'Delete this match' }).click();
  await page.getByRole('button', { name: 'Yes, delete' }).click();
  await expect(page.getByRole('button', { name: 'Matches (0)' })).toBeVisible();
  await page.reload();
  await insertCoin(page);
  await page.getByRole('button', { name: 'History' }).click();
  await expect(page.getByText('No completed matches yet.')).toBeVisible();
});
