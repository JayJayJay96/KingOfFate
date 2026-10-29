import { isHistoryRecord } from '../history/history';
import type { Roster } from './roster';

/**
 * Fair sit-outs (owner decision 2026-10-29): within the current cycle, anyone whose wins are above
 * the lowest win count on the roster sits out by default. When everyone is level a new cycle
 * starts. People are matched by roster entry ID (match players keep the roster entry ID).
 */
export interface FairState {
  /** completedAt of the last match of the previous cycle; only later matches count. */
  readonly cycleStart: string | null;
  /**
   * People the rule has already handled, with their win count at that time and whether the game
   * switched them off. Handled again only after another win, so a host who switches someone back
   * in is not overruled every time the menu opens.
   */
  readonly handled: Readonly<Record<string, { readonly wins: number; readonly off: boolean }>>;
}

export const EMPTY_FAIR_STATE: FairState = { cycleStart: null, handled: {} };

export interface FairWin {
  readonly completedAt: string;
  readonly title?: string;
}

export interface FairResult {
  readonly roster: Roster;
  readonly fair: FairState;
  /** People who should sit out, with their wins this cycle (oldest first). */
  readonly sitOut: ReadonlyMap<string, readonly FairWin[]>;
}

export function applyFairSitOut(
  roster: Roster,
  records: readonly unknown[],
  fair: FairState,
): FairResult {
  let cycleStart = fair.cycleStart;
  let wins = winsSince(roster, records, cycleStart);
  const counts = roster.map((p) => wins.get(p.id)!.length);
  if (roster.length > 0 && Math.min(...counts) === Math.max(...counts) && counts[0]! > 0) {
    // Everyone is level: a new cycle starts after the newest counted match; nobody sits out.
    cycleStart = [...wins.values()]
      .flat()
      .reduce((a, w) => (w.completedAt > a ? w.completedAt : a), cycleStart ?? '');
    wins = winsSince(roster, records, cycleStart);
  }

  const lowest = Math.min(...roster.map((p) => wins.get(p.id)!.length));
  const sitOut = new Map<string, readonly FairWin[]>();
  for (const p of roster) {
    const w = wins.get(p.id)!;
    if (w.length > lowest) sitOut.set(p.id, w);
  }

  const handled: Record<string, { wins: number; off: boolean }> = {};
  const nextRoster = roster.map((p) => {
    const before = fair.handled[p.id];
    const w = sitOut.get(p.id);
    if (!w) {
      // Eligible again: switch back on only the people the game switched off.
      return before?.off && !p.active ? { ...p, active: true } : p;
    }
    if (before && w.length <= before.wins) {
      handled[p.id] = before;
      return p;
    }
    handled[p.id] = { wins: w.length, off: p.active || (before?.off ?? false) };
    return p.active ? { ...p, active: false } : p;
  });

  const fairChanged =
    cycleStart !== fair.cycleStart || JSON.stringify(handled) !== JSON.stringify(fair.handled);
  return {
    roster: nextRoster.some((p, i) => p !== roster[i]) ? nextRoster : roster,
    fair: fairChanged ? { cycleStart, handled } : fair,
    sitOut,
  };
}

function winsSince(
  roster: Roster,
  records: readonly unknown[],
  cycleStart: string | null,
): Map<string, FairWin[]> {
  const wins = new Map<string, FairWin[]>(roster.map((p) => [p.id, []]));
  const counted = records
    .filter(isHistoryRecord)
    .filter((r) => cycleStart === null || r.completedAt > cycleStart)
    .sort((a, b) => a.completedAt.localeCompare(b.completedAt));
  for (const r of counted) {
    const win: FairWin = r.match.title
      ? { completedAt: r.completedAt, title: r.match.title }
      : { completedAt: r.completedAt };
    for (const id of new Set(r.winnerIds)) wins.get(id)?.push(win);
  }
  return wins;
}

export function isFairState(value: unknown): value is FairState {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (v.cycleStart !== null && typeof v.cycleStart !== 'string') return false;
  if (typeof v.handled !== 'object' || v.handled === null || Array.isArray(v.handled)) return false;
  return Object.values(v.handled).every(
    (h) =>
      typeof h === 'object' &&
      h !== null &&
      Number.isInteger((h as { wins?: unknown }).wins) &&
      typeof (h as { off?: unknown }).off === 'boolean',
  );
}
