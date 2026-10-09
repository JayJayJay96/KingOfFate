import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../../app/App';
import { createSeededRng } from '../../game/rng/rng';
import { playCompletedMatch, playToVictory } from '../../test/historyFixtures';
import {
  createMemoryMatchRepository,
  type CompletedMatchRecord,
  type MatchRepository,
} from '../../storage/matchStorage';

const ROSTER = [
  ['a', 'Aisyah'],
  ['b', 'Wei Jie'],
  ['c', 'Kavitha'],
  ['d', 'Hafiz'],
] as const;

const older = playCompletedMatch({
  matchId: 'm-old',
  players: ROSTER,
  seed: 11,
  startedAt: '2026-10-01T02:00:00.000Z',
  completedAt: '2026-10-01T02:04:00.000Z',
});
const newer = playCompletedMatch({
  matchId: 'm-new',
  players: ROSTER,
  winnerCount: 2,
  seed: 12,
  startedAt: '2026-10-08T02:00:00.000Z',
  completedAt: '2026-10-08T02:03:00.000Z',
});

async function openHistory(repo: MatchRepository) {
  const user = userEvent.setup();
  const download = vi.fn();
  render(
    <App matchRepository={repo} rng={createSeededRng(1)} timeScale={0.005} download={download} />,
  );
  await waitFor(() => expect(screen.queryByText('Loading…')).not.toBeInTheDocument());
  await user.click(screen.getByRole('button', { name: 'History' }));
  await screen.findByRole('heading', { name: 'Hall of Fate' });
  await waitFor(() => expect(screen.queryByText('Loading history…')).not.toBeInTheDocument());
  return { user, download };
}

const nameIn = (r: CompletedMatchRecord, id: string) =>
  r.match.players.find((p) => p.id === id)!.name;

describe('History screen (Phase 6)', () => {
  it('shows an empty state with exports disabled when nothing is stored', async () => {
    await openHistory(createMemoryMatchRepository());
    expect(screen.getByText('No completed matches yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export JSON (full backup)' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Matches CSV' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Clear all history' })).toBeDisabled();
  });

  it('ranks the luck board and explains it is chance, not skill', async () => {
    await openHistory(createMemoryMatchRepository(null, [older, newer]));
    expect(screen.getByText(/this measures luck, not skill/)).toBeInTheDocument();
    const rows = within(screen.getByTestId('leaderboard')).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(4);
    // Cells: #, Played, Wins, Win rate, Expected, Luck, ... (the name is a row header).
    // Everyone played both matches: expected = 1/4 + 2/4 = 0.75.
    for (const row of rows) {
      const cells = within(row).getAllByRole('cell');
      expect(cells[1]).toHaveTextContent('2');
      expect(cells[4]).toHaveTextContent('0.75');
    }
    const wins = rows.map((r) => Number(within(r).getAllByRole('cell')[2]!.textContent));
    expect(wins.reduce((a, b) => a + b, 0)).toBe(3);
    // Same expected for all, so ranking by luck = ranking by wins here.
    expect([...wins].sort((a, b) => b - a)).toEqual(wins);
  });

  it('lists matches newest first and opens one with its full log', async () => {
    const { user } = await openHistory(createMemoryMatchRepository(null, [older, newer]));
    await user.click(screen.getByRole('button', { name: 'Matches (2)' }));
    const items = within(screen.getByTestId('match-list')).getAllByRole('button');
    expect(items[0]).toHaveTextContent(
      `Winners: ${newer.winnerIds.map((id) => nameIn(newer, id)).join(', ')}`,
    );
    expect(items[1]).toHaveTextContent(`Winner: ${nameIn(older, older.winnerIds[0]!)}`);

    await user.click(items[1]!);
    expect(screen.getByTestId('match-summary')).toHaveTextContent(
      `4 fighters, 1 winner slot, Normal preset, ${older.match.completedTurns} turns`,
    );
    expect(screen.getByTestId('match-summary')).toHaveTextContent('4 min 0 s');
    const log = within(screen.getByTestId('history-log')).getAllByRole('listitem');
    expect(log[0]).toHaveTextContent('Match started: 4 fighters, 1 winner, Normal preset.');
    expect(log.at(-1)).toHaveTextContent(`Winner: ${nameIn(older, older.winnerIds[0]!)}!`);
    const results = within(screen.getByTestId('match-fighters')).getAllByRole('row').slice(1);
    expect(results[0]).toHaveTextContent('Winner');
    expect(results.filter((r) => /KO on turn \d+/.test(r.textContent ?? ''))).toHaveLength(2);
  });

  it('deletes one match only after confirmation', async () => {
    const repo = createMemoryMatchRepository(null, [older, newer]);
    const { user } = await openHistory(repo);
    await user.click(screen.getByRole('button', { name: 'Matches (2)' }));
    await user.click(within(screen.getByTestId('match-list')).getAllByRole('button')[0]!);

    await user.click(screen.getByRole('button', { name: 'Delete this match' }));
    expect(screen.getByText(/Delete this match from history for good\?/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(await repo.listCompleted()).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'Delete this match' }));
    await user.click(screen.getByRole('button', { name: 'Yes, delete' }));
    await screen.findByRole('button', { name: 'Matches (1)' });
    expect((await repo.listCompleted()).map((r) => r.matchId)).toEqual(['m-old']);
    expect(within(screen.getByTestId('match-list')).getAllByRole('button')).toHaveLength(1);
  });

  it('clears all history only after confirmation', async () => {
    const repo = createMemoryMatchRepository(null, [older, newer]);
    const { user } = await openHistory(repo);
    await user.click(screen.getByRole('button', { name: 'Clear all history' }));
    expect(screen.getByText(/Delete all 2 matches for good\?/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Yes, clear all' }));
    await screen.findByText('No completed matches yet.');
    expect(await repo.listCompleted()).toEqual([]);
  });

  it('exports JSON and both CSVs', async () => {
    const { user, download } = await openHistory(createMemoryMatchRepository(null, [older, newer]));
    await user.click(screen.getByRole('button', { name: 'Export JSON (full backup)' }));
    await user.click(screen.getByRole('button', { name: 'Matches CSV' }));
    await user.click(screen.getByRole('button', { name: 'Luck board CSV' }));
    expect(download).toHaveBeenCalledTimes(3);

    const [jsonName, jsonText, jsonType] = download.mock.calls[0]!;
    expect(jsonName).toMatch(/^kof-history_\d{4}-\d{2}-\d{2}_\d{4}\.json$/);
    expect(jsonType).toBe('application/json');
    expect(JSON.parse(jsonText).matches).toEqual([older, newer]);

    const [csvName, csvText] = download.mock.calls[1]!;
    expect(csvName).toMatch(/^kof-matches_.*\.csv$/);
    expect(csvText.trim().split('\r\n')).toHaveLength(3);
    const [boardName, boardText, boardType] = download.mock.calls[2]!;
    expect(boardName).toMatch(/^kof-luck-board_.*\.csv$/);
    expect(boardType).toBe('text/csv;charset=utf-8');
    expect(boardText.trim().split('\r\n')).toHaveLength(5);
  });

  it('leaves out unreadable records with a notice', async () => {
    const broken = {
      ...older,
      matchId: 'broken',
      match: { nope: true },
    } as unknown as CompletedMatchRecord;
    await openHistory(createMemoryMatchRepository(null, [newer, broken]));
    expect(screen.getByRole('status')).toHaveTextContent(
      '1 saved match could not be read and is left out.',
    );
    expect(screen.getByRole('button', { name: 'Matches (1)' })).toBeInTheDocument();
  });

  it('a match finished in the app shows up in History', async () => {
    const won = playToVictory({ matchId: 'm-live', players: ROSTER, seed: 5 });
    const winner = won.players.find((p) => p.id === won.finale!.winnerIds[0])!.name;
    const repo = createMemoryMatchRepository();
    await repo.save(won); // the victory checkpoint writes its record in the same save
    const user = userEvent.setup();
    render(<App matchRepository={repo} rng={createSeededRng(1)} timeScale={0.005} />);
    await screen.findByRole('main', { name: 'Victory' });
    expect(screen.getByTestId('result-saved')).toHaveTextContent('Result saved to History.');
    await user.click(screen.getByRole('button', { name: /return to setup/i }));
    await user.click(screen.getByRole('button', { name: 'History' }));
    await user.click(await screen.findByRole('button', { name: 'Matches (1)' }));
    expect(screen.getByTestId('match-list')).toHaveTextContent(`Winner: ${winner}`);
    await user.click(screen.getByRole('button', { name: 'Back to setup' }));
    expect(screen.getByRole('button', { name: /^start$/i })).toBeInTheDocument();
  });
});
