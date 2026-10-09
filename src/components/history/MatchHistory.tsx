import { useState } from 'react';
import { formatDateTime, formatDuration } from '../../game/history/format';
import {
  historyLog,
  presetLabel,
  type FighterResult,
  type MatchSummary,
} from '../../game/history/history';
import type { CompletedMatchRecord } from '../../storage/matchStorage';
import { ConfirmButton } from './ConfirmButton';
import { MatchAwards } from './MatchAwards';

interface MatchHistoryProps {
  /** Newest first. */
  readonly summaries: readonly MatchSummary[];
  readonly records: readonly CompletedMatchRecord[];
  readonly onDelete: (matchId: string) => Promise<boolean>;
}

/** Completed-match list with a per-match detail view and full event log. */
export function MatchHistory({ summaries, records, onDelete }: MatchHistoryProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = summaries.find((s) => s.matchId === openId);
  const record = records.find((r) => r.matchId === openId);

  if (open && record) {
    return (
      <MatchDetail
        summary={open}
        record={record}
        onBack={() => setOpenId(null)}
        onDelete={async () => {
          if (await onDelete(open.matchId)) setOpenId(null);
        }}
      />
    );
  }

  return (
    <section className="panel history-panel" aria-labelledby="matches-title">
      <h2 id="matches-title" className="panel__title">
        Matches
      </h2>
      {summaries.length === 0 ? (
        <p className="empty">No completed matches yet. Finish a match and it appears here.</p>
      ) : (
        <ol className="match-list" data-testid="match-list">
          {summaries.map((s) => (
            <li key={s.matchId}>
              <button
                type="button"
                className="match-list__item"
                onClick={() => setOpenId(s.matchId)}
              >
                <span className="match-list__date">{formatDateTime(s.completedAt)}</span>
                <span className="match-list__winners">
                  {s.winnerIds.length === 1 ? 'Winner' : 'Winners'}: {winnerNames(s)}
                </span>
                <span className="match-list__meta">
                  {s.fighterCount} fighters · {presetLabel(s.presetId)} · {s.turns} turns
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function MatchDetail({
  summary: s,
  record,
  onBack,
  onDelete,
}: {
  readonly summary: MatchSummary;
  readonly record: CompletedMatchRecord;
  readonly onBack: () => void;
  readonly onDelete: () => void;
}) {
  const log = historyLog(record);
  const ranked = [...s.fighters].sort(
    (a, b) => rankOf(a) - rankOf(b) || (b.eliminatedOnTurn ?? 0) - (a.eliminatedOnTurn ?? 0),
  );
  return (
    <section className="panel history-panel" aria-labelledby="match-detail-title">
      <div className="panel__header">
        <h2 id="match-detail-title" className="panel__title">
          Match of {formatDateTime(s.completedAt)}
        </h2>
        <button type="button" className="button button--small" onClick={onBack}>
          All matches
        </button>
      </div>
      <p className="history-detail__summary" data-testid="match-summary">
        {s.winnerIds.length === 1 ? 'Winner' : 'Winners'}: <strong>{winnerNames(s)}</strong>.{' '}
        {s.fighterCount} fighters, {s.winnerCount} winner slot{s.winnerCount === 1 ? '' : 's'},{' '}
        {presetLabel(s.presetId)} preset, {s.turns} turns, {s.finaleRounds} finale rounds,{' '}
        {formatDuration(s.durationMs)}.
      </p>

      <div className="table-scroll">
        <table className="history-table" data-testid="match-fighters">
          <thead>
            <tr>
              <th scope="col">Fighter</th>
              <th scope="col">Result</th>
              <th scope="col">Picked</th>
              <th scope="col">Shields</th>
              <th scope="col">Blocks</th>
              <th scope="col">VS won</th>
              <th scope="col">Finale pts</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((f) => (
              <tr key={f.id}>
                <th scope="row">{f.name}</th>
                <td>{resultLabel(f)}</td>
                <td>{f.selected}</td>
                <td>{f.shieldsGained}</td>
                <td>{f.shieldBlocks}</td>
                <td>
                  {f.vsWon}/{f.vsFought}
                </td>
                <td>{f.finalist ? f.finalePoints : '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="history-detail__log-title">Awards</h3>
      <MatchAwards summary={s} />

      <h3 className="history-detail__log-title">Event log</h3>
      <ol className="event-log__list history-detail__log" data-testid="history-log">
        {log.map((line) => (
          <li key={line.id} className="event-log__item">
            {line.text}
          </li>
        ))}
      </ol>

      <div className="history-detail__actions">
        <ConfirmButton
          label="Delete this match"
          question="Delete this match from history for good? Export first if you want a copy."
          confirmLabel="Yes, delete"
          onConfirm={onDelete}
        />
      </div>
    </section>
  );
}

function rankOf(f: FighterResult): number {
  return f.won ? 0 : f.finalist ? 1 : 2;
}

function resultLabel(f: FighterResult): string {
  if (f.won) return 'Winner';
  if (f.finalist) return 'Finalist';
  return f.eliminatedOnTurn === null ? 'Out' : `KO on turn ${f.eliminatedOnTurn}`;
}

function winnerNames(s: MatchSummary): string {
  return s.winnerIds.map((id) => s.fighters.find((f) => f.id === id)?.name ?? '???').join(', ');
}
