import { expect, test, type Page } from '@playwright/test';

// Cursors ≤ 10 s, plus a VS duel (~2–4 s, longer with draws), plus margin.
const TURN_BUDGET = 20_000;

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

async function startMatch(
  page: Page,
  names: string[],
  winners: number,
  preset: 'Fast' | 'Normal' | 'Chaotic' = 'Normal',
) {
  await page.getByLabel(/paste names/i).fill(names.join('\n'));
  await page.getByRole('button', { name: /add to roster/i }).click();
  await page.getByRole('radio', { name: String(winners), exact: true }).check({ force: true });
  await page.getByRole('radio', { name: new RegExp(preset, 'i') }).check({ force: true });
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.getByRole('list', { name: 'Fighters' })).toBeVisible();
}

const randomButton = (page: Page) =>
  page.getByRole('button', { name: /random: start the next turn/i });
const turnLines = (page: Page) =>
  page
    .getByTestId('event-log')
    .getByRole('listitem')
    .filter({ hasText: /^Turn \d+:/ });

/** Everything that must survive a reload unchanged. */
async function snapshot(page: Page) {
  return {
    alive: await page.getByTestId('alive-count').textContent(),
    out: await page.locator('[data-state="out"] .fighter__name').allTextContents(),
    shields: await page.locator('[data-shield="true"] .fighter__name').allTextContents(),
    log: await page.getByTestId('event-log').getByRole('listitem').allTextContents(),
    odds: await page.getByTestId('fate-odds').textContent(),
  };
}

test('a real match runs full-length spins and hands off at W + 1', async ({ page }) => {
  test.setTimeout(150_000);
  await startMatch(page, ['Aisyah', 'Wei Jie', 'Kavitha', 'Hafiz'], 2, 'Fast');
  const finale = page.getByRole('heading', { name: 'Finale!' });

  const started = Date.now();
  await randomButton(page).click();
  await expect(randomButton(page)).toBeDisabled();
  await expect(turnLines(page)).toHaveCount(1, { timeout: TURN_BUDGET });
  expect(Date.now() - started).toBeGreaterThanOrEqual(4_000);

  // Shields/blocks can delay the handoff; keep playing until W + 1 remain.
  for (let turn = 2; turn <= 8 && !(await finale.isVisible()); turn++) {
    await randomButton(page).click();
    // The finale screen shows the event log too, so the count works either way.
    await expect(turnLines(page)).toHaveCount(turn, { timeout: TURN_BUDGET });
  }
  await expect(finale).toBeVisible();
  await expect(page.getByRole('list', { name: 'Finalists' }).getByRole('listitem')).toHaveCount(3);
  await page.getByRole('button', { name: /return to setup/i }).click();
  await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeEnabled();
});

test('refreshing mid-spin replays the committed turn and applies it exactly once', async ({
  page,
}) => {
  await startMatch(page, ['Aisyah', 'Wei Jie', 'Kavitha', 'Hafiz', 'Mei Ling'], 1);

  await randomButton(page).click();
  await page.waitForTimeout(1_000);
  await page.reload();

  // Restored into the same match, which finishes the committed turn once.
  await expect(page.getByRole('list', { name: 'Fighters' })).toBeVisible();
  await expect(turnLines(page)).toHaveCount(1, { timeout: TURN_BUDGET });
  await expect(randomButton(page)).toBeEnabled();
  const before = await snapshot(page);

  // A second reload must not change or re-apply anything.
  await page.reload();
  await expect(turnLines(page)).toHaveCount(1);
  expect(await snapshot(page)).toEqual(before);
});

test('mashing Space starts only one turn', async ({ page }) => {
  await startMatch(page, ['Aisyah', 'Wei Jie', 'Kavitha', 'Hafiz', 'Mei Ling'], 1);
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  for (let i = 0; i < 5; i++) await page.keyboard.press('Space');

  await expect(turnLines(page)).toHaveCount(1, { timeout: TURN_BUDGET });
  await page.waitForTimeout(500);
  await expect(turnLines(page)).toHaveCount(1);
});

test('both cursors walk in order and land on what the log reports', async ({ page }) => {
  await startMatch(page, ['Aisyah', 'Wei Jie', 'Kavitha', 'Hafiz', 'Mei Ling', 'Arjun'], 1);
  const gridOrder = await page.locator('.fighter .fighter__name').allTextContents();

  // Record every cursor move with a timestamp, straight from the DOM.
  await page.evaluate(() => {
    type Log = { player: { name: string; t: number }[]; fate: { index: number; kind: string }[] };
    const w = window as unknown as { cursorLog: Log };
    w.cursorLog = { player: [], fate: [] };
    new MutationObserver(() => {
      const p = document.querySelector('[data-cursor="true"] .fighter__name')?.textContent ?? '';
      if (p && w.cursorLog.player.at(-1)?.name !== p) {
        w.cursorLog.player.push({ name: p, t: performance.now() });
      }
      const slot = document.querySelector('.fate-slot[data-cursor="true"]');
      if (slot) {
        const index = [...slot.parentElement!.children].indexOf(slot);
        if (w.cursorLog.fate.at(-1)?.index !== index) {
          w.cursorLog.fate.push({ index, kind: slot.getAttribute('data-kind') ?? '' });
        }
      }
    }).observe(document.body, { subtree: true, attributes: true, childList: true });
  });

  await randomButton(page).click();
  await expect(turnLines(page)).toHaveCount(1, { timeout: TURN_BUDGET });
  const log = await page.evaluate(
    () =>
      (
        window as unknown as {
          cursorLog: {
            player: { name: string; t: number }[];
            fate: { index: number; kind: string }[];
          };
        }
      ).cursorLog,
  );

  // Player cursor: consecutive grid order, decelerating, lands on the selected fighter.
  expect(log.player.length).toBeGreaterThanOrEqual(10);
  for (let i = 1; i < log.player.length; i++) {
    const prev = gridOrder.indexOf(log.player[i - 1]!.name);
    expect(log.player[i]!.name).toBe(gridOrder[(prev + 1) % gridOrder.length]);
  }
  const firstGap = log.player[1]!.t - log.player[0]!.t;
  const lastGap = log.player.at(-1)!.t - log.player.at(-2)!.t;
  expect(lastGap).toBeGreaterThan(firstGap * 3);
  await expect(page.getByTestId('preview-name')).toHaveText(log.player.at(-1)!.name);

  // Fate cursor: consecutive slots (wrapping at 20) and lands on the Fate the log reports.
  expect(log.fate.length).toBeGreaterThanOrEqual(10);
  for (let i = 1; i < log.fate.length; i++) {
    expect(log.fate[i]!.index).toBe((log.fate[i - 1]!.index + 1) % 20);
  }
  const line = (await turnLines(page).first().textContent()) ?? '';
  const landed = log.fate.at(-1)!.kind;
  const expected = / VS /.test(line)
    ? 'VS'
    : /Shield/.test(line) && !/KO/.test(line)
      ? 'SHIELD'
      : 'KO';
  expect(landed).toBe(expected);
});

test('shuffle reorders fighters and Fate slots; the order survives a reload', async ({ page }) => {
  await startMatch(page, ['Aisyah', 'Wei Jie', 'Kavitha', 'Hafiz', 'Mei Ling', 'Arjun'], 1);
  const names = page.locator('.fighter .fighter__name');
  const slots = page.locator('.fate-slot');
  const kinds = () => slots.evaluateAll((els) => els.map((e) => e.getAttribute('data-kind')));
  const beforeNames = await names.allTextContents();
  const beforeKinds = await kinds();

  await page.getByRole('button', { name: 'Shuffle' }).click();
  await expect.poll(() => names.allTextContents()).not.toEqual(beforeNames);
  await expect(page.getByTestId('event-log')).not.toContainText(/shuffled/i);
  const afterNames = await names.allTextContents();
  const afterKinds = await kinds();
  expect([...afterNames].sort()).toEqual([...beforeNames].sort());
  expect([...afterKinds].sort()).toEqual([...beforeKinds].sort());
  expect(afterKinds).not.toEqual(beforeKinds);
  await expect(page.getByTestId('fate-odds')).toHaveText('KO 75% · VS 20% · Shield 5%');

  await page.reload();
  await expect(names).toHaveText(afterNames);
  expect(await kinds()).toEqual(afterKinds);
});
