import { BADGES, matchAwards } from '../../game/history/awards';
import type { MatchSummary } from '../../game/history/history';

/** "First Blood: Kavitha · Magnet: Aisyah, Wei Jie · …" for one match. Luck, not skill. */
export function MatchAwards({ summary }: { readonly summary: MatchSummary }) {
  const awards = matchAwards(summary);
  if (awards.length === 0) return null;
  const nameOf = (id: string) => summary.fighters.find((f) => f.id === id)?.name ?? '???';
  return (
    <ul className="match-awards" aria-label="Match awards" data-testid="match-awards">
      {awards.map((a) => {
        const b = BADGES[a.badge];
        return (
          <li key={a.badge} className="badge-chip" title={b.text}>
            <span aria-hidden="true">{b.emoji}</span> {b.name}: {a.playerIds.map(nameOf).join(', ')}
          </li>
        );
      })}
    </ul>
  );
}
