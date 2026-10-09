import type { FighterStats, MatchSummary } from './history';

/**
 * Pack C (owner decision 2026-10-10): VS rivalries and fun badges. Everything here describes
 * luck from completed matches, never skill, and never feeds back into the game.
 */

// ---------- rivalries ----------

export interface Rivalry {
  /** Ordered so that `aId` has at least as many wins as `bId`. */
  readonly aId: string;
  readonly bId: string;
  readonly aName: string;
  readonly bName: string;
  readonly aWins: number;
  readonly bWins: number;
  readonly duels: number;
  readonly lastAt: string;
}

/** Every pair that has met in a VS duel, most duels first, then closest, then most recent. */
export function rivalries(summaries: readonly MatchSummary[]): Rivalry[] {
  const names = latestNames(summaries);
  const pairs = new Map<
    string,
    { x: string; y: string; xWins: number; yWins: number; lastAt: string }
  >();
  for (const s of summaries) {
    for (const d of s.duels) {
      const [x, y] = d.winnerId < d.loserId ? [d.winnerId, d.loserId] : [d.loserId, d.winnerId];
      const key = `${x}|${y}`;
      const p = pairs.get(key) ?? { x, y, xWins: 0, yWins: 0, lastAt: s.completedAt };
      if (d.winnerId === x) p.xWins++;
      else p.yWins++;
      if (s.completedAt > p.lastAt) p.lastAt = s.completedAt;
      pairs.set(key, p);
    }
  }
  return [...pairs.values()]
    .map((p) => {
      const flip = p.yWins > p.xWins;
      const [aId, bId, aWins, bWins] = flip
        ? [p.y, p.x, p.yWins, p.xWins]
        : [p.x, p.y, p.xWins, p.yWins];
      return {
        aId,
        bId,
        aName: names.get(aId) ?? '???',
        bName: names.get(bId) ?? '???',
        aWins,
        bWins,
        duels: aWins + bWins,
        lastAt: p.lastAt,
      };
    })
    .sort(
      (a, b) =>
        b.duels - a.duels ||
        a.aWins - a.bWins - (b.aWins - b.bWins) ||
        b.lastAt.localeCompare(a.lastAt) ||
        a.aName.localeCompare(b.aName),
    );
}

export interface HeadToHead {
  readonly opponentId: string;
  readonly opponentName: string;
  readonly wins: number;
  readonly losses: number;
}

/** One person's VS record against everyone they have dueled. */
export function headToHead(summaries: readonly MatchSummary[], personId: string): HeadToHead[] {
  return rivalries(summaries)
    .filter((r) => r.aId === personId || r.bId === personId)
    .map((r) =>
      r.aId === personId
        ? { opponentId: r.bId, opponentName: r.bName, wins: r.aWins, losses: r.bWins }
        : { opponentId: r.aId, opponentName: r.aName, wins: r.bWins, losses: r.aWins },
    );
}

// ---------- badges ----------

export const BADGES = {
  firstBlood: { emoji: '🩸', name: 'First Blood', text: 'First fighter knocked out in a match' },
  magnet: { emoji: '🧲', name: 'Magnet', text: 'Picked by the cursor the most in a match (2+)' },
  ironWall: { emoji: '🧱', name: 'Iron Wall', text: 'Shield blocked 2+ hits in one match' },
  duelist: { emoji: '⚔️', name: 'Duelist', text: 'Won 2+ VS duels in one match' },
  flawless: {
    emoji: '💯',
    name: 'Flawless',
    text: 'Won the finale without anyone else scoring a point',
  },
  backToBack: {
    emoji: '🔥',
    name: 'Back-to-back',
    text: 'Won two matches in a row (of the matches they played)',
  },
  survivor: { emoji: '🏟️', name: 'Survivor', text: 'Reached 3+ finales' },
  shieldHoarder: { emoji: '🛡️', name: 'Shield Hoarder', text: 'Most Shields earned overall' },
} as const;

export type BadgeId = keyof typeof BADGES;
export const MATCH_BADGES = ['firstBlood', 'magnet', 'ironWall', 'duelist', 'flawless'] as const;
export type MatchBadgeId = (typeof MATCH_BADGES)[number];

export interface MatchAward {
  readonly badge: MatchBadgeId;
  readonly playerIds: readonly string[];
}

/** Awards of one match, in badge order; badges nobody earned are left out. */
export function matchAwards(s: MatchSummary): MatchAward[] {
  const f = s.fighters;
  const out: MatchAward[] = [];
  const add = (badge: MatchBadgeId, ids: string[]) => {
    if (ids.length) out.push({ badge, playerIds: ids });
  };
  const knocked = f.filter((x) => x.eliminatedOnTurn !== null);
  const firstTurn = Math.min(...knocked.map((x) => x.eliminatedOnTurn!));
  add(
    'firstBlood',
    knocked.filter((x) => x.eliminatedOnTurn === firstTurn).map((x) => x.id),
  );
  const mostPicked = Math.max(0, ...f.map((x) => x.selected));
  add('magnet', mostPicked >= 2 ? f.filter((x) => x.selected === mostPicked).map((x) => x.id) : []);
  add(
    'ironWall',
    f.filter((x) => x.shieldBlocks >= 2).map((x) => x.id),
  );
  add(
    'duelist',
    f.filter((x) => x.vsWon >= 2).map((x) => x.id),
  );
  add(
    'flawless',
    f.filter((x) => x.flawless).map((x) => x.id),
  );
  return out;
}

export interface CareerBadge {
  readonly badge: BadgeId;
  /** Times earned (match badges), best streak (Back-to-back), finales (Survivor), Shields. */
  readonly count: number;
}

/** Every badge each person holds over the whole history. */
export function careerBadges(
  summaries: readonly MatchSummary[],
  stats: readonly FighterStats[],
): ReadonlyMap<string, CareerBadge[]> {
  const byPerson = new Map<string, Map<BadgeId, number>>();
  const give = (id: string, badge: BadgeId, count: number) => {
    const m = byPerson.get(id) ?? new Map<BadgeId, number>();
    m.set(badge, count);
    byPerson.set(id, m);
  };
  const bump = (id: string, badge: BadgeId) =>
    give(id, badge, (byPerson.get(id)?.get(badge) ?? 0) + 1);

  const ordered = [...summaries].sort((a, b) => a.completedAt.localeCompare(b.completedAt));
  for (const s of ordered) {
    for (const award of matchAwards(s)) for (const id of award.playerIds) bump(id, award.badge);
  }

  // Back-to-back: best run of consecutive wins among the matches each person played.
  const streak = new Map<string, { run: number; best: number }>();
  for (const s of ordered) {
    for (const f of s.fighters) {
      const st = streak.get(f.id) ?? { run: 0, best: 0 };
      st.run = f.won ? st.run + 1 : 0;
      st.best = Math.max(st.best, st.run);
      streak.set(f.id, st);
    }
  }
  for (const [id, st] of streak) if (st.best >= 2) give(id, 'backToBack', st.best);

  for (const s of stats) if (s.finals >= 3) give(s.id, 'survivor', s.finals);
  const most = Math.max(0, ...stats.map((s) => s.shieldsGained));
  if (most > 0) {
    for (const s of stats) if (s.shieldsGained === most) give(s.id, 'shieldHoarder', most);
  }

  const order = Object.keys(BADGES) as BadgeId[];
  const result = new Map<string, CareerBadge[]>();
  for (const [id, m] of byPerson) {
    result.set(
      id,
      order.filter((b) => m.has(b)).map((badge) => ({ badge, count: m.get(badge)! })),
    );
  }
  return result;
}

function latestNames(summaries: readonly MatchSummary[]): Map<string, string> {
  const names = new Map<string, string>();
  const ordered = [...summaries].sort((a, b) => a.completedAt.localeCompare(b.completedAt));
  for (const s of ordered) for (const f of s.fighters) names.set(f.id, f.name);
  return names;
}
