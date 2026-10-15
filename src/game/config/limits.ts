/** Hard limits from PROJECT.md §1 and §3. */
export const MIN_ACTIVE_PLAYERS = 2;
export const MAX_ACTIVE_PLAYERS = 32;
export const MIN_WINNERS = 1;
export const MAX_WINNERS = 5;

/** D5 (approved 2026-10-09): display names are at most 20 characters. */
export const MAX_NAME_LENGTH = 20;
/** Prize / title line, e.g. "Who buys kopi today?" (owner request 2026-10-16). */
export const MAX_TITLE_LENGTH = 60;

export const WINNER_COUNT_OPTIONS = [1, 2, 3, 4, 5] as const;
export type WinnerCount = (typeof WINNER_COUNT_OPTIONS)[number];

export function isWinnerCount(value: unknown): value is WinnerCount {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= MIN_WINNERS &&
    value <= MAX_WINNERS
  );
}
