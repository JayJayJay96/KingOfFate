import { isWinnerCount, MAX_ACTIVE_PLAYERS, MIN_ACTIVE_PLAYERS } from '../config/limits';
import { activeParticipants } from './roster';
import type { SetupConfig } from './setupConfig';

export type SetupIssue =
  | { readonly code: 'too-few-players'; readonly activeCount: number }
  | { readonly code: 'too-many-players'; readonly activeCount: number }
  | { readonly code: 'invalid-winner-count'; readonly winnerCount: number }
  | {
      readonly code: 'not-enough-for-winners';
      readonly activeCount: number;
      readonly winnerCount: number;
    };

export interface SetupValidation {
  readonly canStart: boolean;
  readonly issues: readonly SetupIssue[];
  readonly activeCount: number;
  /** True when the match would open directly in the W+1 finale (PROJECT.md §3.6). */
  readonly startsInFinale: boolean;
}

/** Start rule: 2 <= N <= 32, 1 <= W <= 5, N >= W + 1 (N = W is rejected, not auto-awarded). */
export function validateSetup(config: SetupConfig): SetupValidation {
  const activeCount = activeParticipants(config.roster).length;
  const { winnerCount } = config;
  const issues: SetupIssue[] = [];

  if (activeCount < MIN_ACTIVE_PLAYERS) issues.push({ code: 'too-few-players', activeCount });
  if (activeCount > MAX_ACTIVE_PLAYERS) issues.push({ code: 'too-many-players', activeCount });

  const winnerCountValid = isWinnerCount(winnerCount);
  if (!winnerCountValid) {
    issues.push({ code: 'invalid-winner-count', winnerCount });
  } else if (activeCount >= MIN_ACTIVE_PLAYERS && activeCount < winnerCount + 1) {
    issues.push({ code: 'not-enough-for-winners', activeCount, winnerCount });
  }

  const canStart = issues.length === 0;
  return {
    canStart,
    issues,
    activeCount,
    startsInFinale: canStart && activeCount === winnerCount + 1,
  };
}

export function describeSetupIssue(issue: SetupIssue): string {
  switch (issue.code) {
    case 'too-few-players':
      return `Need at least ${MIN_ACTIVE_PLAYERS} active fighters (currently ${issue.activeCount}). Add names or switch players in.`;
    case 'too-many-players':
      return `At most ${MAX_ACTIVE_PLAYERS} active fighters (currently ${issue.activeCount}). Switch ${issue.activeCount - MAX_ACTIVE_PLAYERS} out.`;
    case 'invalid-winner-count':
      return `Winner count must be 1–5.`;
    case 'not-enough-for-winners':
      return `${issue.winnerCount} winner${issue.winnerCount === 1 ? '' : 's'} need at least ${issue.winnerCount + 1} active fighters (currently ${issue.activeCount}). Lower the winners or switch players in.`;
  }
}
