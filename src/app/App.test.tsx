import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { beginFinale, resolveFinaleRound, startFinaleRound } from '../game/engine/finale';
import { beginTurn, createMatch } from '../game/engine/match';
import { createScriptedRng, createSeededRng, type Rng } from '../game/rng/rng';
import { createMemoryMatchRepository, type MatchRepository } from '../storage/matchStorage';
import { SETUP_STORAGE_KEY } from '../storage/setupStorage';
import type { SoundEngine } from '../audio/soundEngine';
import { App } from './App';

type User = ReturnType<typeof userEvent.setup>;

// Spins take up to 10 s in production; scale to <= 50 ms in tests.
const FAST = { timeScale: 0.005 };

async function renderApp(
  repo: MatchRepository = createMemoryMatchRepository(),
  rng: Rng = createSeededRng(1),
  timeScale = FAST.timeScale,
) {
  const user = userEvent.setup();
  const utils = render(
    <App matchRepository={repo} rng={rng} timeScale={timeScale} titleScreen={false} />,
  );
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

/** Starts the match and waits until the ~4 s character-select intro (scaled) is over. */
async function startMatch(user: User) {
  await user.click(startButton());
  await waitFor(() =>
    expect(
      screen.queryByRole('list', { name: 'Fighters' }) ??
        screen.queryByRole('main', { name: 'Finale' }),
    ).not.toBeNull(),
  );
  await waitFor(() => expect(screen.queryByTestId('match-intro')).toBeNull());
}
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
  it('plays from setup through the finale to the winner, then returns to setup', async () => {
    // Turn 1: living 1 (Wei Jie) KO; turn 2: living 0 (Aisyah) KO → Kavitha vs Hafiz finale.
    // Finale reveals (Kavitha, Hafiz): Rock beats Scissors three times → Kavitha wins.
    const ROCK = 0;
    const SCISSORS = 2;
    const repo = createMemoryMatchRepository();
    const { user } = await renderApp(
      repo,
      createScriptedRng([1, KO, 0, KO, ROCK, SCISSORS, ROCK, SCISSORS, ROCK, SCISSORS]),
    );
    await addNames(user, 'Aisyah{Enter}Wei Jie{Enter}Kavitha{Enter}Hafiz{Enter}Mei Ling');
    await user.click(screen.getByRole('button', { name: 'Mei Ling' })); // sits out
    await startMatch(user);

    const grid = await screen.findByRole('list', { name: 'Fighters' });
    expect(within(grid).getAllByRole('listitem')).toHaveLength(4);
    await user.click(randomButton());
    await findInLog('Turn 1: Wei Jie takes a KO. Eliminated!');
    await user.click(randomButton());

    // Full-screen finale with the two finalists, waiting for the host.
    await screen.findByRole('main', { name: 'Finale' });
    expect(screen.getAllByTestId('finalist').map((f) => f.textContent)).toEqual([
      expect.stringContaining('Kavitha'),
      expect.stringContaining('Hafiz'),
    ]);
    await user.click(screen.getByRole('button', { name: /start the finale/i }));

    // Automatic rounds → victory, committed (with a single record) before the ceremony.
    await screen.findByRole('main', { name: 'Victory' });
    expect(screen.getByRole('heading', { name: 'Winner!' })).toBeInTheDocument();
    expect(
      within(screen.getByRole('list', { name: 'Winners' }))
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['Kavitha']);
    expect(screen.getByTestId('result-saved')).toBeInTheDocument();
    // Knocked-out fighters lie scattered; the finale loser lies beside the winner.
    expect(screen.getAllByTestId('fallen').map((el) => el.textContent)).toEqual([
      'Wei Jie',
      'Aisyah',
    ]);
    expect(screen.getByTestId('finale-loser')).toHaveTextContent('Hafiz');
    expect(await repo.listCompleted()).toHaveLength(1);
    await findInLog('Winner: Kavitha!');

    await user.click(screen.getByRole('button', { name: /return to setup/i }));
    expect(screen.getByRole('button', { name: 'Mei Ling' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(await repo.load()).toEqual({ status: 'none' });
    expect(await repo.listCompleted()).toHaveLength(1);
  });

  it('starts directly in the finale when N = W + 1', async () => {
    const { user } = await renderApp();
    await addNames(user, 'Aisyah{Enter}Wei Jie');
    await startMatch(user);
    expect(await screen.findByRole('main', { name: 'Finale' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start the finale/i })).toBeInTheDocument();
  });

  it('resumes a finale mid-round after a reload without re-rolling the committed hands', async () => {
    const players = ['Aisyah', 'Wei Jie', 'Kavitha'].map((name, i) => ({ id: `p${i}`, name }));
    let m = beginFinale(
      createMatch(
        { players, winnerCount: 2, presetId: 'normal' },
        { matchId: 'm1', startedAt: '2026-10-09T07:00:00.000Z' },
      ),
    );
    // Committed reveal: Rock, Rock, Scissors → Aisyah and Wei Jie score.
    m = startFinaleRound(m, createScriptedRng([0, 0, 2]), 'r1');
    const repo = createMemoryMatchRepository(m);

    // After the committed round, each following reveal is scripted; anything else would throw.
    await renderApp(repo, createScriptedRng([0, 0, 2, 0, 0, 2]));
    await findInLog('Round 1: Rock beats Scissors, +1 for Aisyah and Wei Jie.');
    await screen.findByRole('main', { name: 'Victory' });
    expect(
      within(screen.getByRole('list', { name: 'Winners' }))
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['Aisyah', 'Wei Jie']);
  });

  it('shows the victory again after a reload, without recording a second result', async () => {
    const players = ['Aisyah', 'Wei Jie'].map((name, i) => ({ id: `p${i}`, name }));
    let m = beginFinale(
      createMatch(
        { players, winnerCount: 1, presetId: 'normal' },
        { matchId: 'm1', startedAt: '2026-10-09T07:00:00.000Z' },
      ),
    );
    for (let i = 1; i <= 3; i++) {
      m = startFinaleRound(m, createScriptedRng([2, 1]), `r${i}`); // Scissors beats Paper
      m = resolveFinaleRound(m, `r${i}`, '2026-10-09T08:00:00.000Z');
    }
    const repo = createMemoryMatchRepository();
    await repo.save(m);
    await renderApp(repo, createScriptedRng([]));
    expect(await screen.findByRole('main', { name: 'Victory' })).toBeInTheDocument();
    expect(await repo.listCompleted()).toHaveLength(1);
  });

  it('starts a turn with Space but ignores rapid repeats (one turn only)', async () => {
    const { user } = await renderApp(createMemoryMatchRepository(), createScriptedRng([0, KO]));
    await addNames(user, 'Aisyah{Enter}Wei Jie{Enter}Kavitha{Enter}Hafiz');
    await startMatch(user);
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
    await startMatch(user);
    await screen.findByRole('list', { name: 'Fighters' });

    // Abandon lives in the Esc menu.
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog', { name: 'Paused' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /abandon match/i }));
    await user.click(screen.getByRole('button', { name: /keep playing/i }));
    await user.click(screen.getByRole('button', { name: 'Resume' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Fighters' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /menu/i }));
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
    await startMatch(user);
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
    await startMatch(user);
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
    await startMatch(user);
    expect(await screen.findByTestId('fate-odds')).toHaveTextContent('KO 75% · VS 20% · Shield 5%');
    expect(document.querySelectorAll('.fate-slot')).toHaveLength(20);
  });

  it('Shield: the fighter gets a Shield icon and the log says so', async () => {
    const { user } = await renderApp(createMemoryMatchRepository(), createScriptedRng([2, SHIELD]));
    await addNames(user, 'Aisyah{Enter}Wei Jie{Enter}Kavitha{Enter}Hafiz');
    await startMatch(user);
    await screen.findByRole('list', { name: 'Fighters' });
    await user.click(randomButton());
    await findInLog('Turn 1: Kavitha gains a Shield.');
    expect(shielded()).toEqual(['Kavitha']);
  });

  it('VS: plays back the committed duel, then applies the result', async () => {
    const { user } = await renderApp(
      createMemoryMatchRepository(),
      createScriptedRng([0, VS, 0, ROCK, ROCK, ROCK, SCISSORS]),
      0.1, // slow enough for each reveal step to be observed
    );
    await addNames(user, 'Aisyah{Enter}Wei Jie{Enter}Kavitha{Enter}Hafiz');
    await startMatch(user);
    await screen.findByRole('list', { name: 'Fighters' });
    await user.click(randomButton());
    // 1. Fighter first, then Fate.
    await screen.findByText('Fate is choosing…', {}, { timeout: 3000 });
    // 2. VS! with a mystery opponent.
    const duel = await screen.findByTestId('duel', {}, { timeout: 3000 });
    expect(duel).toHaveTextContent(/Aisyah.*VS!.*\?\?\?/);
    expect(duel).toHaveTextContent('Aisyah must fight… who?');
    // 3. Opponent cursor lands on Wei Jie, then the throws.
    await waitFor(
      () => expect(screen.getByTestId('duel')).toHaveTextContent(/Aisyah.*VS.*Wei Jie/),
      {
        timeout: 3000,
      },
    );
    await within(screen.getByTestId('event-log')).findByText(
      'Turn 1: Aisyah VS Wei Jie: Rock beats Scissors after 1 draw. Aisyah wins; Wei Jie is eliminated! Aisyah earns a Shield.',
      {},
      { timeout: 5000 },
    );
    expect(shielded()).toEqual(['Aisyah']);
    expect(eliminatedCount()).toBe(1);
  });

  it('says there is no Sudden Death when the finale comes first', async () => {
    // 5 fighters, 1 winner: one-third left = 2 = finale count, so the finale pre-empts it.
    const { user } = await renderApp();
    await addNames(user, 'Aisyah{Enter}Wei Jie{Enter}Kavitha{Enter}Hafiz{Enter}Siti');
    await startMatch(user);
    await screen.findByRole('list', { name: 'Fighters' });
    expect(screen.getByTestId('shield-supply')).toHaveTextContent('1 of 1');
    expect(screen.getByTestId('sudden-death-at')).toHaveTextContent(
      'No Sudden Death: finale at 2 left',
    );
  });

  it('shows the Shield supply, then Sudden Death at one-third left with the new odds', async () => {
    // 9 fighters, 1 winner: 2 Shields in supply, Sudden Death at 3 left. Six KOs on index 0.
    const { user } = await renderApp(
      createMemoryMatchRepository(),
      createScriptedRng(Array.from({ length: 6 }, () => [0, KO]).flat()),
    );
    await addNames(user, `${EIGHT}{Enter}Siti`);
    await startMatch(user);
    await screen.findByRole('list', { name: 'Fighters' });
    expect(screen.getByTestId('shield-supply')).toHaveTextContent('2 of 2');
    expect(screen.getByTestId('sudden-death-at')).toHaveTextContent('Sudden Death at 3 left');
    for (let i = 1; i <= 6; i++) {
      await user.click(randomButton());
      await within(screen.getByTestId('event-log')).findByText(new RegExp('Turn ' + i + ':'));
    }
    expect(await screen.findByText(/^SUDDEN DEATH! Only 3 fighters left\./)).toBeInTheDocument();
    expect(screen.getByTestId('sudden-death')).toHaveTextContent('Shields shattered');
    expect(screen.getByTestId('fate-odds')).toHaveTextContent('KO 90% · VS 10%');
    expect(document.querySelectorAll('.fate-slot--SHIELD')).toHaveLength(0);
  });
});

function spyEngine() {
  const calls: string[] = [];
  const engine: SoundEngine = {
    webAudio: true,
    speech: true,
    unlock: () => calls.push('unlock'),
    apply: () => undefined,
    setMusic: (theme) => calls.push(`music:${theme}`),
    setPaused: (p) => calls.push(`paused:${p}`),
    setMusicRate: (rate) => calls.push(`rate:${rate.toFixed(2)}`),
    sfx: (name) => calls.push(`sfx:${name}`),
    chant: (word) => calls.push(`chant:${word}`),
    announce: (text) => calls.push(`announce:${text}`),
    listVoices: () => [],
    onVoicesChanged: () => () => undefined,
    dispose: () => undefined,
  };
  return { engine, calls };
}

describe('Phase 5: sound, shortcuts and pause', () => {
  const ROCK = 0;
  const SCISSORS = 2;

  it('plays music per phase, cursor ticks, outcome sounds, the chant and the victory jingle', async () => {
    const { engine, calls } = spyEngine();
    const user = userEvent.setup();
    render(
      <App
        matchRepository={createMemoryMatchRepository()}
        rng={createScriptedRng([0, KO, ROCK, SCISSORS, ROCK, SCISSORS, ROCK, SCISSORS])}
        timeScale={0.005}
        soundEngine={engine}
        titleScreen={false}
      />,
    );
    await waitFor(() => expect(screen.queryByText('Loading…')).not.toBeInTheDocument());
    await addNames(user, 'Aisyah{Enter}Wei Jie{Enter}Kavitha');
    await startMatch(user);
    await screen.findByRole('list', { name: 'Fighters' });
    expect(calls).toContain('music:select');

    await user.click(randomButton());
    await screen.findByRole('main', { name: 'Finale' });
    expect(calls).toContain('sfx:tick');
    expect(calls).toContain('sfx:fateTick');
    expect(calls).toContain('sfx:ko');

    await user.click(screen.getByRole('button', { name: /start the finale/i }));
    await screen.findByRole('main', { name: 'Victory' });
    expect(calls).toContain('music:finale');
    for (const word of ['ONE', 'TWO', 'JUICE']) expect(calls).toContain(`chant:${word}`);
    expect(calls).toContain('sfx:score');
    // The winning reveal ends the match, so the victory jingle replaces the qualify sting.
    expect(calls).toContain('sfx:victory');
    expect(calls.at(-1)).not.toBe('music:finale');
  });

  it('D4: Esc pauses the finale after the current round; Resume continues', async () => {
    // Two finalists; the slow scale lets the test act between rounds.
    const players = ['Aisyah', 'Wei Jie'].map((name, i) => ({ id: `p${i}`, name }));
    const repo = createMemoryMatchRepository(
      beginFinale(
        createMatch(
          { players, winnerCount: 1, presetId: 'normal' },
          { matchId: 'm1', startedAt: '2026-10-09T07:00:00.000Z' },
        ),
      ),
    );
    const { user } = await renderApp(
      repo,
      createScriptedRng([ROCK, SCISSORS, ROCK, SCISSORS, ROCK, SCISSORS]),
      0.02,
    );
    await findInLog('Round 1: Rock beats Scissors, +1 for Aisyah.');
    await user.keyboard('{Escape}');
    expect(await screen.findByRole('dialog', { name: 'Finale paused' })).toBeInTheDocument();

    // While paused no further round is played.
    const roundsNow = () =>
      within(screen.getByTestId('event-log')).queryAllByText(/^Round \d+:/).length;
    const held = roundsNow();
    await new Promise((r) => setTimeout(r, 300));
    expect(roundsNow()).toBe(held);
    expect(screen.getByRole('main', { name: 'Finale' })).toBeInTheDocument();

    const dialog = screen.getByRole('dialog', { name: 'Finale paused' });
    await user.click(within(dialog).getByRole('button', { name: 'Resume' }));
    await screen.findByRole('main', { name: 'Victory' }, { timeout: 4000 });
  });

  it('keyboard: S shuffles, M mutes, Esc opens the menu and blocks spinning', async () => {
    const { user } = await renderApp(createMemoryMatchRepository(), createSeededRng(9));
    await addNames(user, 'Aisyah{Enter}Wei Jie{Enter}Kavitha{Enter}Hafiz{Enter}Mei Ling');
    await startMatch(user);
    const grid = await screen.findByRole('list', { name: 'Fighters' });
    const order = () =>
      within(grid)
        .getAllByRole('listitem')
        .map((li) => li.textContent);
    const before = order();
    (document.activeElement as HTMLElement | null)?.blur();

    await user.keyboard('s');
    await waitFor(() => expect(order()).not.toEqual(before));

    await user.keyboard('m');
    expect(JSON.parse(localStorage.getItem('kof.audio')!).muted).toBe(true);

    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog', { name: 'Paused' })).toBeInTheDocument();
    expect(randomButton()).toBeDisabled();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(randomButton()).toBeEnabled();
  });

  it('sound settings persist, and a custom music file is kept locally and can be removed', async () => {
    const { user } = await renderApp();
    const music = screen.getByRole('slider', { name: 'Music' });
    fireEvent.change(music, { target: { value: '20' } });
    expect(JSON.parse(localStorage.getItem('kof.audio')!).music).toBe(0.2);

    const file = new File([new Uint8Array([1, 2, 3, 4])], 'office-theme.mp3', {
      type: 'audio/mpeg',
    });
    await user.upload(screen.getByLabelText(/choose file/i), file);
    expect(await screen.findByText(/My music file: office-theme\.mp3/)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /my music file/i })).toBeChecked();

    await user.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() =>
      expect(screen.getByRole('radio', { name: /built-in chiptune/i })).toBeChecked(),
    );
    expect(screen.getByRole('radio', { name: /my music file/i })).toBeDisabled();
  });
});

describe('Arcade pack A: title, intro, announcer, impacts (owner decisions 2026-10-10)', () => {
  it('opens on INSERT COIN; any key inserts a coin, unlocks sound and goes to setup', async () => {
    const { engine, calls } = spyEngine();
    const user = userEvent.setup();
    render(
      <App
        matchRepository={createMemoryMatchRepository()}
        timeScale={0.005}
        soundEngine={engine}
      />,
    );
    expect(screen.getByRole('main', { name: 'Title' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Insert coin' })).toBeInTheDocument();
    await user.keyboard('{Enter}');
    await screen.findByRole('button', { name: /^start$/i });
    expect(calls).toContain('unlock');
    await waitFor(() => expect(calls).toContain('sfx:coin'));
  });

  it('plays the character-select intro; Space skips it without starting a turn', async () => {
    const { user } = await renderApp(createMemoryMatchRepository(), createScriptedRng([]), 1);
    await addNames(user, 'Aisyah{Enter}Wei Jie{Enter}Kavitha{Enter}Hafiz');
    await user.click(startButton());
    const intro = await screen.findByTestId('match-intro');
    for (const name of ['Aisyah', 'Wei Jie', 'Kavitha', 'Hafiz']) {
      expect(intro).toHaveTextContent(name);
    }
    expect(randomButton()).toBeDisabled();
    (document.activeElement as HTMLElement | null)?.blur();
    await user.keyboard('[Space]');
    expect(screen.queryByTestId('match-intro')).not.toBeInTheDocument();
    expect(within(screen.getByTestId('event-log')).queryByText(/Turn 1/)).not.toBeInTheDocument();
    expect(randomButton()).toBeEnabled();
  });

  it('announces ROUND 1 and FIGHT!, then K.O. with a stamp and the knock-back fall', async () => {
    const { engine, calls } = spyEngine();
    const user = userEvent.setup();
    render(
      <App
        matchRepository={createMemoryMatchRepository()}
        rng={createScriptedRng([0, KO])}
        timeScale={0.05}
        soundEngine={engine}
        titleScreen={false}
      />,
    );
    await waitFor(() => expect(screen.queryByText('Loading…')).not.toBeInTheDocument());
    await addNames(user, 'Aisyah{Enter}Wei Jie{Enter}Kavitha{Enter}Hafiz');
    await startMatch(user);
    expect(calls).toContain('announce:Round one!');
    expect(calls).toContain('announce:Fight!');
    expect(calls).toContain('sfx:fight');

    await user.click(randomButton());
    const impact = await screen.findByTestId('impact', {}, { timeout: 5000 });
    expect(impact).toHaveAttribute('data-kind', 'ko');
    expect(impact).toHaveTextContent('K.O.');
    expect(document.querySelector('.fighter--falling')).toHaveTextContent('Aisyah');
    expect(calls).toContain('announce:K. O.!');
    await waitFor(() => expect(screen.queryByTestId('impact')).not.toBeInTheDocument());
  });

  it(
    'plays the final blow and names the winner when the finale is won',
    { timeout: 30000 },
    async () => {
      const { engine, calls } = spyEngine();
      const user = userEvent.setup();
      const ROCK = 0;
      const SCISSORS = 2;
      render(
        <App
          matchRepository={createMemoryMatchRepository()}
          rng={createScriptedRng([ROCK, SCISSORS, ROCK, SCISSORS, ROCK, SCISSORS])}
          timeScale={0.05}
          soundEngine={engine}
          titleScreen={false}
        />,
      );
      await waitFor(() => expect(screen.queryByText('Loading…')).not.toBeInTheDocument());
      await addNames(user, 'Aisyah{Enter}Wei Jie');
      await startMatch(user);
      expect(calls).toContain('announce:Final round!');
      await user.click(screen.getByRole('button', { name: /start the finale/i }));
      await screen.findByTestId('final-blow', {}, { timeout: 15000 });
      await screen.findByRole('main', { name: 'Victory' }, { timeout: 5000 });
      expect(calls).toContain('announce:Finish!');
      expect(calls).toContain('announce:Aisyah wins!');
    },
  );
});

describe('Arcade pack B: looks and stages (owner decisions 2026-10-10)', () => {
  const savedSetup = () => JSON.parse(localStorage.getItem(SETUP_STORAGE_KEY) ?? '{}');

  it('Change look: picks a tudung, saves it with the roster and carries it into the match', async () => {
    const repo = createMemoryMatchRepository();
    const { user } = await renderApp(repo);
    await addNames(user, 'Aisyah{Enter}Wei Jie');
    await user.click(screen.getByRole('button', { name: 'Change look for Aisyah' }));
    const dialog = screen.getByRole('dialog', { name: 'Look: Aisyah' });
    expect(within(dialog).getByText('Default look (from the name)')).toBeInTheDocument();
    await user.selectOptions(within(dialog).getByLabelText('Headwear'), 'tudung');
    await user.selectOptions(within(dialog).getByLabelText('Outfit'), 'baju-melayu');
    await user.click(
      within(dialog).getByRole('button', { name: 'Accent / headwear colour: Beige' }),
    );
    expect(within(dialog).getByText('Custom look')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Save look' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    const aisyah = savedSetup().roster.find((p: { name: string }) => p.name === 'Aisyah');
    expect(aisyah.look).toMatchObject({
      headwear: 'tudung',
      outfit: 'baju-melayu',
      accent: 'beige',
    });
    expect(savedSetup().roster.find((p: { name: string }) => p.name === 'Wei Jie').look).toBe(
      undefined,
    );

    await startMatch(user);
    const loaded = await repo.load();
    expect(loaded.status === 'loaded' && loaded.match.players[0]!.look).toMatchObject({
      headwear: 'tudung',
    });
    expect(loaded.status === 'loaded' && loaded.match.players[1]!.look).toBe(undefined);
  });

  it('Use default removes a custom look; Cancel and Esc keep the old one', async () => {
    const { user } = await renderApp();
    await addNames(user, 'Hafiz');
    const open = () => user.click(screen.getByRole('button', { name: 'Change look for Hafiz' }));

    await open();
    await user.selectOptions(screen.getByLabelText('Headwear'), 'songkok');
    await user.click(screen.getByRole('button', { name: 'Save look' }));
    expect(savedSetup().roster[0].look.headwear).toBe('songkok');

    await open();
    await user.selectOptions(screen.getByLabelText('Headwear'), 'cap');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(savedSetup().roster[0].look.headwear).toBe('songkok');

    await open();
    await user.selectOptions(screen.getByLabelText('Headwear'), 'cap');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(savedSetup().roster[0].look.headwear).toBe('songkok');

    await open();
    await user.click(screen.getByRole('button', { name: 'Use default' }));
    expect(savedSetup().roster[0].look).toBe(undefined);
  });

  it('a pinned stage is saved and shown behind the match and the preview', async () => {
    const { user } = await renderApp();
    await addNames(user, 'Aisyah{Enter}Wei Jie{Enter}Kavitha');
    expect(screen.getByRole('combobox', { name: 'Stage' })).toHaveValue('random');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Stage' }), 'mamak');
    expect(savedSetup().stage).toBe('mamak');
    await startMatch(user);
    expect(screen.getByTestId('stage-backdrop')).toHaveAttribute('data-stage', 'mamak');
    expect(
      screen.getByRole('region', { name: 'Selected fighter' }).querySelector('[data-stage]'),
    ).toHaveAttribute('data-stage', 'mamak');
  });

  it('random stage: some stage is shown and it stays the same after a reload', async () => {
    const repo = createMemoryMatchRepository();
    const first = await renderApp(repo);
    await addNames(first.user, 'Aisyah{Enter}Wei Jie{Enter}Kavitha');
    await startMatch(first.user);
    const stage = screen.getByTestId('stage-backdrop').getAttribute('data-stage');
    expect(stage).toMatch(/^(kl-night|mamak|pantry|pasar-malam|rooftop)$/);
    first.unmount();
    await renderApp(repo);
    await screen.findByRole('list', { name: 'Fighters' });
    expect(screen.getByTestId('stage-backdrop')).toHaveAttribute('data-stage', stage!);
  });
});

describe('Owner requests 2026-10-10: RPS count and hand attacks', () => {
  const ROCK = 0;
  const SCISSORS = 2;

  it('a VS is counted ROCK… PAPER… SCISSORS! for every throw, with a beat (no voice)', async () => {
    const { engine, calls } = spyEngine();
    const user = userEvent.setup();
    render(
      <App
        matchRepository={createMemoryMatchRepository()}
        // Challenger 0, VS slot, opponent 0 of the others, one draw (Rock/Rock), then Rock beats Scissors.
        rng={createScriptedRng([0, VS, 0, ROCK, ROCK, ROCK, SCISSORS])}
        timeScale={0.02}
        soundEngine={engine}
        titleScreen={false}
      />,
    );
    await waitFor(() => expect(screen.queryByText('Loading…')).not.toBeInTheDocument());
    await addNames(user, 'Aisyah{Enter}Wei Jie{Enter}Kavitha{Enter}Hafiz');
    await startMatch(user);
    const before = calls.length;
    await user.click(randomButton());
    await findInLog(/Turn 1: Aisyah VS Wei Jie: Rock beats Scissors after 1 draw/);
    const turn = calls.slice(before);
    expect(turn.filter((c) => c === 'sfx:count')).toHaveLength(6);
    // Owner request: beat only, no spoken Rock / Paper / Scissors.
    expect(turn.some((c) => /^announce:(Rock|Paper|Scissors)!$/.test(c))).toBe(false);
    // Every SCISSORS beat reveals: once as a draw, once as the decisive clash.
    expect(turn).toContain('sfx:draw');
    expect(turn).toContain('sfx:clash');
  });

  it('in the finale the winning rock flies at the scissors and crushes them', async () => {
    const { user } = await renderApp(
      createMemoryMatchRepository(),
      createScriptedRng([ROCK, SCISSORS, ROCK, SCISSORS, ROCK, SCISSORS]),
      0.05,
    );
    await addNames(user, 'Aisyah{Enter}Wei Jie');
    await startMatch(user);
    await user.click(screen.getByRole('button', { name: /start the finale/i }));
    await waitFor(
      () => {
        expect(document.querySelector('.hand-attack.hand-attack--crush')).not.toBeNull();
        expect(document.querySelector('.hand-hit.hand-hit--crush')).not.toBeNull();
      },
      { timeout: 5000, interval: 10 },
    );
  });
});

describe('Finale rising pace and showdown music (owner request 2026-10-10)', () => {
  it('three draws in a row speed the music up step by step', async () => {
    const { engine, calls } = spyEngine();
    const user = userEvent.setup();
    const ROCK = 0;
    const SCISSORS = 2;
    render(
      <App
        matchRepository={createMemoryMatchRepository()}
        // Three draws (Rock/Rock), then Rock beats Scissors three times.
        rng={createScriptedRng([
          ROCK,
          ROCK,
          ROCK,
          ROCK,
          ROCK,
          ROCK,
          ROCK,
          SCISSORS,
          ROCK,
          SCISSORS,
          ROCK,
          SCISSORS,
        ])}
        timeScale={0.005}
        soundEngine={engine}
        titleScreen={false}
      />,
    );
    await waitFor(() => expect(screen.queryByText('Loading…')).not.toBeInTheDocument());
    await addNames(user, 'Aisyah{Enter}Wei Jie');
    await startMatch(user);
    await user.click(screen.getByRole('button', { name: /start the finale/i }));
    await screen.findByRole('main', { name: 'Victory' }, { timeout: 5000 });
    expect(calls).toContain('music:finale');
    const rates = calls.filter((c) => c.startsWith('rate:')).map((c) => Number(c.slice(5)));
    // 600 → 550 → 500 → 450 ms beats after 1, 2 and 3 rounds without a new winner.
    expect(rates).toEqual(expect.arrayContaining([1, 1.09, 1.2, 1.33]));
    const firstFast = rates.indexOf(1.33);
    expect(rates.slice(0, firstFast + 1).filter((r) => r > 1)).toEqual([1.09, 1.2, 1.33]);
    expect(rates.at(-1)).toBe(1); // back to normal when the finale ends
  });
});
