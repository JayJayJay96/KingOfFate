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

describe('KO-only match', () => {
  it('plays from setup to the finale gate with only active fighters, then returns to setup', async () => {
    // Living-list indices: turn 1 picks index 1 (Wei Jie); turn 2 picks index 0 (Aisyah).
    const { user } = await renderApp(createMemoryMatchRepository(), createScriptedRng([1, 0]));
    await addNames(user, 'Aisyah{Enter}Wei Jie{Enter}Kavitha{Enter}Hafiz{Enter}Mei Ling');
    await user.click(screen.getByRole('button', { name: 'Mei Ling' })); // sits out
    await user.click(startButton());

    const grid = await screen.findByRole('list', { name: 'Fighters' });
    expect(within(grid).getAllByRole('listitem')).toHaveLength(4);
    expect(screen.getByTestId('alive-count')).toHaveTextContent('4 / 4 alive');

    await user.click(randomButton());
    expect(randomButton()).toBeDisabled();
    await screen.findByText('Turn 1: Wei Jie takes a KO. Eliminated!');
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
    const { user } = await renderApp(createMemoryMatchRepository(), createScriptedRng([0, 0]));
    await addNames(user, 'Aisyah{Enter}Wei Jie{Enter}Kavitha{Enter}Hafiz');
    await user.click(startButton());
    await screen.findByRole('list', { name: 'Fighters' });

    (document.activeElement as HTMLElement | null)?.blur();
    await user.keyboard('[Space][Space][Enter]');
    await screen.findByText(/Turn 1: Aisyah takes a KO/);
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
    const repo = createMemoryMatchRepository(beginTurn(match, createScriptedRng([3]), 't1'));

    // If anything tried to sample again, this RNG would throw.
    await renderApp(repo, createScriptedRng([]));
    await screen.findByText('Turn 1: Hafiz takes a KO. Eliminated!');
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
  it('reorders the grid between turns, logs it and persists the new order', async () => {
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
    const { user } = await renderApp(createMemoryMatchRepository(), createScriptedRng([0]));
    await addNames(user, 'Aisyah{Enter}Wei Jie{Enter}Kavitha{Enter}Hafiz');
    await user.click(startButton());
    await screen.findByRole('list', { name: 'Fighters' });
    await user.click(randomButton());
    expect(screen.getByRole('button', { name: 'Shuffle' })).toBeDisabled();
    await screen.findByText(/Turn 1: Aisyah takes a KO/);
    expect(screen.getByRole('button', { name: 'Shuffle' })).toBeEnabled();
  });
});
