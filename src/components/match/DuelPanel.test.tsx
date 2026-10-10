import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { CommittedDuel } from '../../game/engine/matchTypes';
import { DuelPanel } from './DuelPanel';

const duel = (challenger: string, opponent: string, draws = 0): CommittedDuel => ({
  opponentId: 'b',
  throws: [
    ...Array.from({ length: draws }, () => ({
      challenger: 'ROCK' as const,
      opponent: 'ROCK' as const,
    })),
    { challenger, opponent } as CommittedDuel['throws'][number],
  ],
});

const hands = () => [...document.querySelectorAll('.duel__hand')];

function show(d: CommittedDuel, throwIndex: number, word: 'ROCK' | 'PAPER' | 'SCISSORS' | null) {
  render(
    <DuelPanel
      mode="fight"
      challengerName="Aisyah"
      opponentName="Wei Jie"
      duel={d}
      throwIndex={throwIndex}
      word={word}
    />,
  );
}

describe('DuelPanel: count and hand attacks (owner requests 2026-10-10)', () => {
  it('counts ROCK… PAPER… with fists up before the reveal', () => {
    show(duel('ROCK', 'SCISSORS'), -1, 'PAPER');
    expect(screen.getByTestId('duel-count')).toHaveTextContent('PAPER');
    expect(screen.getByText('Paper…')).toBeInTheDocument();
    expect(hands().every((h) => h.classList.contains('duel__hand--bounce'))).toBe(true);
    expect(document.querySelector('[data-attack]')).toBeNull();
  });

  it.each([
    ['ROCK', 'SCISSORS', 'crush', 0, 1],
    ['PAPER', 'ROCK', 'wrap', 0, 1],
    ['SCISSORS', 'PAPER', 'cut', 0, 1],
    ['SCISSORS', 'ROCK', 'crush', 1, 0],
  ])('%s vs %s: the winner %s-attacks the loser', (c, o, action, winner, loser) => {
    show(duel(c, o), 0, 'SCISSORS');
    const [first, second] = hands();
    const byIndex = [first!, second!];
    expect(byIndex[winner]).toHaveClass('hand-attack', `hand-attack--${action}`);
    expect(byIndex[winner]).toHaveAttribute('data-attack', 'winner');
    expect(byIndex[loser]).toHaveClass('hand-hit', `hand-hit--${action}`);
    expect(byIndex[loser]).toHaveAttribute('data-attack', 'loser');
    expect(screen.getByTestId('duel-count')).toHaveTextContent('SCISSORS!');
  });

  it('a draw shows both hands with no attack', () => {
    show(duel('PAPER', 'ROCK', 1), 0, 'SCISSORS');
    expect(screen.getByText('Draw! Throw again…')).toBeInTheDocument();
    expect(document.querySelector('[data-attack]')).toBeNull();
  });
});
