import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { beginTurn, createMatch } from '../game/engine/match';
import { createScriptedRng, createSeededRng, type Rng } from '../game/rng/rng';
import { createMemoryMatchRepository, type MatchRepository } from '../storage/matchStorage';
import { SETUP_STORAGE_KEY } from '../storage/setupStorage';
import { App } from './App';

type User = ReturnType<typeof userEvent.setup>;

// Spins take up to 10 s in production; scale to <= 50 ms in tests.
const FAST = { timeScale: 0.005 };

async function renderApp(
  repo: MatchRepository = createMemoryMatchRepository(),
  rng: Rng = createSeededRng(1),
) {
  const user = userEvent.setup();
  const utils = render(<App matchRepository={repo} rng={rng} {...FAST} />);
  await waitFor(() => expect(screen.queryByText('Loading…')).not.toBeInTheDocument());
  return { user, repo, ...utils };
}

async function addNames(user: User, names: string) {
  await user.type(screen.getByLabelText(/paste names/i), names);
  await user.click(screen.getByRole('button', { name: /add to roster/i }));
}

const findInLog = (text: string | RegExp) =>
  within(screen.getByTestId('event-log')).findByText(text);

const startButton = () => screen.getByRole('button', { name: /^start$/i });
const randomButton = () => screen.getByRole('button', { name: /random: start the next turn/i });
const eliminatedCount = () => document.querySelectorAll('[data-state="out"]').length;

describe('Setup flow', () => {
  it('starts disabled with an actionable message on an empty roster', async () => {
    await renderApp();
    expect(startButton()).toBeDisabled();
    expect(screen.getByText(/need at least 2 active fighters/i)).toBeInTheDocument();
  });

  it('adds pasted names, reports skipped ones and keeps them in the box', async () => {
    const { user } = await renderApp();
    await addNames(user, 'Aisyah{Enter}Wei Jie{Enter}aisyah{Enter}{Enter}Kavitha');

    expect(screen.getByRole('button', { name: 'Aisyah' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Wei Jie' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kavitha' })).toBeInTheDocument();
    expect(screen.getByText(/added 3 fighters/i)).toBeInTheDocument();
    expect(screen.getByText(/“aisyah” is already on the roster/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/paste names/i)).toHaveValue('aisyah');
    expect(startButton()).toBeEnabled();
  });

  it('enforces N >= W + 1 and updates as attendance and winners change', async () => {
    const { user } = await renderApp();
    await addNames(user, 'Aisyah{Enter}Wei Jie{Enter}Kavitha');

    await user.click(screen.getByRole('radio', { name: '3' }));
    expect(startButton()).toBeDisabled();
    expect(screen.getByText(/3 winners need at least 4 active fighters/i)).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: '2' }));
    expect(startButton()).toBeEnabled();
    expect(screen.getByText(/opens in the finale/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Kavitha' }));
    expect(screen.getByRole('button', { name: 'Kavitha' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(startButton()).toBeDisabled();
  });

  it('persists roster, attendance, winners and preset across a remount', async () => {
    const { user, unmount } = await renderApp();
    await addNames(user, 'Aisyah{Enter}Wei Jie{Enter}Kavitha{Enter}Hafiz');
    await user.click(screen.getByRole('button', { name: 'Wei Jie' }));
    await user.click(screen.getByRole('radio', { name: '2' }));
    await user.click(screen.getByRole('radio', { name: /chaotic/i }));
    unmount();

    expect(localStorage.getItem(SETUP_STORAGE_KEY)).toContain('Hafiz');
    await renderApp();
    expect(screen.getByRole('button', { name: 'Wei Jie' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByRole('radio', { name: '2' })).toBeChecked();
    expect(screen.getByRole('radio', { name: /chaotic/i })).toBeChecked();
    expect(screen.getByTestId('roster-count')).toHaveTextContent('3 in · 4 total');
  });

  it('removes a fighter from the roster', async () => {
    const { user } = await renderApp();
    await addNames(user, 'Aisyah{Enter}Wei Jie');
    await user.click(screen.getByRole('button', { name: 'Remove Aisyah' }));
    expect(screen.queryByRole('button', { name: 'Aisyah' })).not.toBeInTheDocument();
    expect(startButton()).toBeDisabled();
  });

  it('shows a notice when saved settings were corrupt', async () => {
    localStorage.setItem(SETUP_STORAGE_KEY, '{oops');
    await renderApp();
    expect(screen.getByText(/could not be read, so defaults were loaded/i)).toBeInTheDocument();
  });
});

// Normal preset strip (spread layout): KO at slot 0, VS at 2/7/12/17, Shield at 10.
const KO = 0;
const VS = 2;
const SHIELD = 10;

describe('Match', () => {
  it('plays from setup to the finale gate with only active fighters, then returns to setup', async () => {
    // Turn 1: living index 1 (Wei Jie) + KO; turn 2: living index 0 (Aisyah) + KO.
    const { user } = await renderApp(
      createMemoryMatchRepository(),
      createScriptedRng([1, KO, 0, KO]),
    );
    await addNames(user, 'Aisyah{Enter}Wei Jie{Enter}Kavitha{Enter}Hafiz{Enter}Mei Ling');
    await user.click(screen.getByRole('button', { name: 'Mei Ling' })); // sits out
    await user.click(startButton());

    const grid = await screen.findByRole('list', { name: 'Fighters' });
    expect(within(grid).getAllByRole('listitem')).toHaveLength(4);
    expect(screen.getByTestId('alive-count')).toHaveTextContent('4 / 4 alive');

    await user.click(randomButton());
    expect(randomButton()).toBeDisabled();
    await findInLog('Turn 1: Wei Jie takes a KO. Eliminated!');
    expect(screen.getByTestId('alive-count')).toHaveTextContent('3 / 4 alive');

    await user.click(randomButton());
    await screen.findByRole('heading', { name: 'Finale!' });
    const finalists = screen.getByRole('list', { name: 'Finalists' });
    expect(
      within(finalists)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['Kavitha', 'Hafiz']);

    await user.click(screen.getByRole('button', { name: /return to setup/i }));
    expect(screen.getByRole('button', { name: 'Mei Ling' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('starts directly at the finale gate when N = W + 1', async () => {
    const { user } = await renderApp();
    await addNames(user, 'Aisyah{Enter}Wei Jie');
    await user.click(startButton());
    expect(await screen.findByRole('heading', { name: 'Finale!' })).toBeInTheDocument();
  });

  it('starts a turn with Space but ignores rapid repeats (one turn only)', async () => {
    const { user } = await renderApp(createMemoryMatchRepository(), createScriptedRng([0, KO]));
    await addNames(user, 'Aisyah{Enter}Wei Jie{Enter}Kavitha{Enter}Hafiz');
    await user.click(startButton());
    await screen.findByRole('list', { name: 'Fighters' });

    (document.activeElement as HTMLElement | null)?.blur();
    await user.keyboard('[Space][Space][Enter]');
    await findInLog(/Turn 1: Aisyah takes a KO/);
    expect(eliminatedCount()).toBe(1);
    expect(within(screen.getByTestId('event-log')).queryByText(/Turn 2/)).not.toBeInTheDocument();
    expect(randomButton()).toBeEnabled();
  });

  it('resumes a match that was mid-spin when the page was closed, without re-rolling', async () => {
    const players = ['Aisyah', 'Wei Jie', 'Kavitha', 'Hafiz'].map((name, i) => ({
      id: `p${i}`,
      name,
    }));
    const match = createMatch(
      { players, winnerCount: 1, presetId: 'normal' },
      { matchId: 'm1', startedAt: '2026-10-09T07:00:00.000Z' },
    );
    const repo = createMemoryMatchRepository(beginTurn(match, createScriptedRng([3, KO]), 't1'));

    // If anything tried to sample again, this RNG would throw.
    await renderApp(repo, createScriptedRng([]));
    await findInLog('Turn 1: Hafiz takes a KO. Eliminated!');
    expect(eliminatedCount()).toBe(1);

    const saved = await repo.load();
    expect(saved.status === 'loaded' && saved.match.completedTurns).toBe(1);
  });

  it('abandons a match only after confirmation', async () => {
    const repo = createMemoryMatchRepository();
    const { user } = await renderApp(repo);
    await addNames(user, 'Aisyah{Enter}Wei Jie{Enter}Kavitha');
    await user.click(startButton());
    await screen.findByRole('list', { name: 'Fighters' });

    await user.click(screen.getByRole('button', { name: /abandon match/i }));
    await user.click(screen.getByRole('button', { name: /keep playing/i }));
    expect(screen.getByRole('list', { name: 'Fighters' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /abandon match/i }));
    await user.click(screen.getByRole('button', { name: /yes, abandon/i }));
    expect(await screen.findByRole('button', { name: /^start$/i })).toBeInTheDocument();
    expect(await repo.load()).toEqual({ status: 'none' });
  });

  it('auto-restores an in-progress match on load', async () => {
    const players = ['Aisyah', 'Wei Jie', 'Kavitha'].map((name, i) => ({ id: `p${i}`, name }));
    const repo = createMemoryMatchRepository(
      createMatch(
        { players, winnerCount: 1, presetId: 'chaotic' },
        { matchId: 'm1', startedAt: '2026-10-09T07:00:00.000Z' },
      ),
    );
    await act(async () => {
      await renderApp(repo);
    });
    expect(screen.getByTestId('alive-count')).toHaveTextContent('3 / 3 alive');
    expect(screen.getByText('Chaotic')).toBeInTheDocument();
  });
});

describe('Shuffle', () => {
  it('reorders the grid between turns without logging it, and persists the new order', async () => {
    const repo = createMemoryMatchRepository();
    const { user } = await renderApp(repo, createSeededRng(3));
    await addNames(user, 'Aisyah{Enter}Wei Jie{Enter}Kavitha{Enter}Hafiz{Enter}Mei Ling');
    await user.click(startButton());
    const grid = await screen.findByRole('list', { name: 'Fighters' });
    const order = () =>
      within(grid)
        .getAllByRole('listitem')
        .map((li) => li.textContent);
    const before = order();

    await user.click(screen.getByRole('button', { name: 'Shuffle' }));
    await waitFor(() => expect(order()).not.toEqual(before));
    expect(
      within(screen.getByTestId('event-log')).queryByText(/shuffled/i),
    ).not.toBeInTheDocument();
    expect([...order()].sort()).toEqual([...before].sort());

    const saved = await repo.load();
    expect(saved.status === 'loaded' && saved.match.players.map((p) => p.name)).toEqual(order());
  });

  it('is disabled while a spin is running', async () => {
    const { user } = await renderApp(createMemoryMatchRepository(), createScriptedRng([0, KO]));
    await addNames(user, 'Aisyah{Enter}Wei Jie{Enter}Kavitha{Enter}Hafiz');
    await user.click(startButton());
    await screen.findByRole('list', { name: 'Fighters' });
    await user.click(randomButton());
    expect(screen.getByRole('button', { name: 'Shuffle' })).toBeDisabled();
    await findInLog(/Turn 1: Aisyah takes a KO/);
    expect(screen.getByRole('button', { name: 'Shuffle' })).toBeEnabled();
  });
});

describe('Fates on screen', () => {
  const EIGHT =
    'Aisyah{Enter}Wei Jie{Enter}Kavitha{Enter}Hafiz{Enter}Mei Ling{Enter}Arjun{Enter}Nurul{Enter}Jason';
  const ROCK = 0;
  const SCISSORS = 2;
  const shielded = () =>
    [...document.querySelectorAll('[data-shield="true"] .fighter__name')].map((n) => n.textContent);

  it('shows the live odds on the Fate strip', async () => {
    const { user } = await renderApp();
    await addNames(user, 'Aisyah{Enter}Wei Jie{Enter}Kavitha');
    await user.click(startButton());
    expect(await screen.findByTestId('fate-odds')).toHaveTextContent('KO 75% · VS 20% · Shield 5%');
    expect(document.querySelectorAll('.fate-slot')).toHaveLength(20);
  });

  it('Shield: the fighter gets a Shield icon and the log says so', async () => {
    const { user } = await renderApp(createMemoryMatchRepository(), createScriptedRng([2, SHIELD]));
    await addNames(user, 'Aisyah{Enter}Wei Jie{Enter}Kavitha{Enter}Hafiz');
    await user.click(startButton());
    await screen.findByRole('list', { name: 'Fighters' });
    await user.click(randomButton());
    await findInLog('Turn 1: Kavitha gains a Shield.');
    expect(shielded()).toEqual(['Kavitha']);
  });

  it('VS: plays back the committed duel, then applies the result', async () => {
    const { user } = await renderApp(
      createMemoryMatchRepository(),
      createScriptedRng([0, VS, 0, ROCK, ROCK, ROCK, SCISSORS]),
    );
    await addNames(user, 'Aisyah{Enter}Wei Jie{Enter}Kavitha{Enter}Hafiz');
    await user.click(startButton());
    await screen.findByRole('list', { name: 'Fighters' });
    await user.click(randomButton());
    expect(await screen.findByTestId('duel')).toHaveTextContent(/Aisyah.*VS.*Wei Jie/);
    await findInLog(
      'Turn 1: Aisyah VS Wei Jie: Rock beats Scissors after 1 draw. Aisyah wins; Wei Jie is eliminated! Aisyah earns a Shield.',
    );
    expect(shielded()).toEqual(['Aisyah']);
    expect(eliminatedCount()).toBe(1);
  });

  it('Sudden Death after 3 turns without elimination swaps the visible odds', async () => {
    // Living index, VS slot, opponent index, Rock vs Scissors — traced like the engine test:
    // p0 beats p1 (out); then three protected losses in a row.
    const turn = (living: number) => [living, VS, 0, ROCK, SCISSORS];
    const { user } = await renderApp(
      createMemoryMatchRepository(),
      createScriptedRng([...turn(0), ...turn(1), ...turn(0), ...turn(1)]),
    );
    await addNames(user, EIGHT);
    await user.click(startButton());
    await screen.findByRole('list', { name: 'Fighters' });
    for (let i = 1; i <= 4; i++) {
      await user.click(randomButton());
      await within(screen.getByTestId('event-log')).findByText(new RegExp('Turn ' + i + ':'));
    }
    expect(await screen.findByText(/^SUDDEN DEATH!/)).toBeInTheDocument();
    expect(screen.getByTestId('sudden-death')).toBeInTheDocument();
    expect(screen.getByTestId('fate-odds')).toHaveTextContent('KO 90% · VS 10%');
    expect(document.querySelectorAll('.fate-slot--SHIELD')).toHaveLength(0);
  });
});
