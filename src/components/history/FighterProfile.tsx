import type { CareerBadge, HeadToHead } from '../../game/history/awards';
import { formatDateTime, formatLuck } from '../../game/history/format';
import type { FighterStats, MatchSummary } from '../../game/history/history';
import { FighterSprite } from '../sprites/icons';
import { BadgeList } from './Badges';

interface FighterProfileProps {
  readonly stats: FighterStats;
  readonly badges: readonly CareerBadge[];
  readonly rivals: readonly HeadToHead[];
  /** All summaries, newest first. */
  readonly summaries: readonly MatchSummary[];
  readonly onOpen: (personId: string) => void;
  readonly onBack: () => void;
}

/** One person across all completed matches: luck, badges, rivals, recent results. */
export function FighterProfile({
  stats: s,
  badges,
  rivals,
  summaries,
  onOpen,
  onBack,
}: FighterProfileProps) {
  const played = summaries.filter((m) => m.fighters.some((f) => f.id === s.id));
  const latest = played[0]?.fighters.find((f) => f.id === s.id);
  return (
    <section className="panel history-panel profile" aria-labelledby="profile-title">
      <div className="panel__header">
        <h2 id="profile-title" className="panel__title">
          {s.name}
        </h2>
        <button type="button" className="button button--small" onClick={onBack}>
          Back
        </button>
      </div>

      <div className="profile__top">
        <span className="profile__portrait">
          <FighterSprite seed={s.name} look={latest?.look ?? null} size={120} idle />
        </span>
        <dl className="profile__stats" data-testid="profile-stats">
          <div>
            <dt>Played</dt>
            <dd>{s.played}</dd>
          </div>
          <div>
            <dt>Wins</dt>
            <dd>{s.wins}</dd>
          </div>
          <div>
            <dt>Win rate</dt>
            <dd>{Math.round(s.winRate * 100)}%</dd>
          </div>
          <div>
            <dt>Expected</dt>
            <dd>{s.expectedWins.toFixed(2)}</dd>
          </div>
          <div>
            <dt>Luck</dt>
            <dd>{formatLuck(s.luck)}</dd>
          </div>
          <div>
            <dt>Finals</dt>
            <dd>{s.finals}</dd>
          </div>
          <div>
            <dt>Picked</dt>
            <dd>{s.selected}</dd>
          </div>
          <div>
            <dt>Shields</dt>
            <dd>{s.shieldsGained}</dd>
          </div>
          <div>
            <dt>VS</dt>
            <dd>
              {s.vsWon}–{s.vsFought - s.vsWon}
            </dd>
          </div>
        </dl>
      </div>

      <h3 className="history-detail__log-title">Badges</h3>
      <BadgeList items={badges} />

      <h3 className="history-detail__log-title">Head-to-head (VS)</h3>
      {rivals.length === 0 ? (
        <p className="empty">No VS duels yet.</p>
      ) : (
        <ul className="rivalry-list" data-testid="head-to-head">
          {rivals.map((r) => (
            <li key={r.opponentId} className="rivalry">
              <span>vs</span>
              <button type="button" className="link-button" onClick={() => onOpen(r.opponentId)}>
                {r.opponentName}
              </button>
              <span className="rivalry__score">
                {r.wins} – {r.losses}
              </span>
            </li>
          ))}
        </ul>
      )}

      <h3 className="history-detail__log-title">Recent matches</h3>
      <ol className="profile__recent" data-testid="recent-matches">
        {played.slice(0, 8).map((m) => {
          const f = m.fighters.find((x) => x.id === s.id)!;
          const result = f.won
            ? 'Winner'
            : f.finalist
              ? 'Finalist'
              : f.eliminatedOnTurn !== null
                ? `KO on turn ${f.eliminatedOnTurn}`
                : 'Out';
          return (
            <li key={m.matchId}>
              <span className="match-list__date">{formatDateTime(m.completedAt)}</span>{' '}
              <span className={f.won ? 'luck--up' : undefined}>{result}</span>{' '}
              <span className="match-list__meta">({m.fighterCount} fighters)</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
