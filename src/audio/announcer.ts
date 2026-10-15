import type { ResolvedTurn } from '../game/engine/matchTypes';

/**
 * Arcade announcer lines (English voice). Spelled for text-to-speech, e.g. "K. O." so voices
 * say the letters. Purely presentation.
 */
export const ANNOUNCE = {
  roundOne: 'Round one!',
  fight: 'Fight!',
  versus: 'Versus!',
  suddenDeath: 'Sudden death!',
  finalRound: 'Final round!',
  finish: 'Finish!',
} as const;

export type ImpactKind = 'ko' | 'boom' | 'blocked' | 'shield' | 'wasted';

/** What a resolved turn looks and sounds like. */
export function turnImpact(last: ResolvedTurn): ImpactKind {
  const o = last.outcome;
  if (o.fate === 'KO') return o.result === 'ELIMINATED' ? 'ko' : 'blocked';
  if (o.fate === 'SHIELD') return o.result === 'GAINED' ? 'shield' : 'wasted';
  if (o.fate === 'BOMB') {
    return o.result === 'ELIMINATED' || o.neighbourResult === 'ELIMINATED' ? 'boom' : 'blocked';
  }
  return o.loserResult === 'ELIMINATED' ? 'ko' : 'blocked';
}

export const IMPACT_LINE: Readonly<Record<ImpactKind, string>> = {
  ko: 'K. O.!',
  boom: 'Boom!',
  blocked: 'Blocked!',
  shield: 'Shield up!',
  wasted: 'Wasted!',
};

/** Big on-screen stamp for each impact. */
export const IMPACT_STAMP: Readonly<Record<ImpactKind, string>> = {
  ko: 'K.O.',
  boom: 'BOOM!',
  blocked: 'BLOCKED',
  shield: 'SHIELD UP',
  wasted: 'WASTED',
};

export function victoryLine(winnerNames: readonly string[]): string {
  if (winnerNames.length === 1) return `${winnerNames[0]} wins!`;
  return `${winnerNames.slice(0, -1).join(', ')} and ${winnerNames.at(-1)} win!`;
}
