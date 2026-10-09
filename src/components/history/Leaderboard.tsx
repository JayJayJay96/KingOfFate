import { formatLuck } from '../../game/history/format';
import type { FighterStats } from '../../game/history/history';

/** Ranked by luck vs expected (owner decision, Phase 6). Describes chance, not skill. */
export function Leaderboard({ stats }: { readonly stats: readonly FighterStats[] }) {
  return (
    <section className="panel history-panel" aria-labelledby="leaderboard-title">
      <h2 id="leaderboard-title" className="panel__title">
        Luck board
      </h2>
      <p className="hint">
        Everyone has the same odds every match, so this measures luck, not skill.{' '}
        <strong>Expected</strong> = winners ÷ fighters, added up over the matches someone played.{' '}
        <strong>Luck</strong> = wins − expected: above 0 means luckier than average.
      </p>
      {stats.length === 0 ? (
        <p className="empty">No completed matches yet.</p>
      ) : (
        <div className="table-scroll">
          <table className="history-table" data-testid="leaderboard">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Fighter</th>
                <th scope="col">Played</th>
                <th scope="col">Wins</th>
                <th scope="col">Win rate</th>
                <th scope="col">Expected</th>
                <th scope="col">Luck</th>
                <th scope="col">Finals</th>
                <th scope="col" title="Times the fighter cursor landed on them">
                  Picked
                </th>
                <th scope="col">Shields</th>
                <th scope="col">VS won</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s, i) => (
                <tr key={s.id}>
                  <td>{i + 1}</td>
                  <th scope="row">{s.name}</th>
                  <td>{s.played}</td>
                  <td>{s.wins}</td>
                  <td>{Math.round(s.winRate * 100)}%</td>
                  <td>{s.expectedWins.toFixed(2)}</td>
                  <td className={s.luck > 0.005 ? 'luck--up' : s.luck < -0.005 ? 'luck--down' : ''}>
                    {formatLuck(s.luck)}
                  </td>
                  <td>{s.finals}</td>
                  <td>{s.selected}</td>
                  <td>{s.shieldsGained}</td>
                  <td>
                    {s.vsWon}/{s.vsFought}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
