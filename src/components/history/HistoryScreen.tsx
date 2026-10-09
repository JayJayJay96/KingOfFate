import { useState } from 'react';
import { fileStamp, historyToJson, matchesToCsv, statsToCsv } from '../../game/history/exportData';
import { useHistory } from '../../hooks/useHistory';
import type { MatchRepository } from '../../storage/matchStorage';
import { downloadText } from '../../utils/download';
import { headToHead } from '../../game/history/awards';
import { ConfirmButton } from './ConfirmButton';
import { FighterProfile } from './FighterProfile';
import { Leaderboard } from './Leaderboard';
import { MatchHistory } from './MatchHistory';
import { Rivalries } from './Rivalries';

export type Downloader = (fileName: string, text: string, mimeType: string) => void;

interface HistoryScreenProps {
  readonly repository: MatchRepository;
  readonly onBack: () => void;
  /** Injection point for tests. */
  readonly download?: Downloader;
}

type Tab = 'leaderboard' | 'rivalries' | 'matches';

/** Phase 6: completed-match history, luck board and exports. All data stays in this browser. */
export function HistoryScreen({ repository, onBack, download = downloadText }: HistoryScreenProps) {
  const history = useHistory(repository);
  const [tab, setTab] = useState<Tab>('leaderboard');
  /** Open fighter profile (roster entry ID), shown instead of the tab content. */
  const [profileId, setProfileId] = useState<string | null>(null);
  const profile = history.stats.find((s) => s.id === profileId) ?? null;
  const showTab = (next: Tab) => {
    setTab(next);
    setProfileId(null);
  };
  const empty = history.records.length === 0;

  function exportFile(kind: 'json' | 'matches' | 'fighters') {
    const now = new Date();
    const stamp = fileStamp(now);
    if (kind === 'json') {
      download(
        `kof-history_${stamp}.json`,
        historyToJson(history.records, now.toISOString()),
        'application/json',
      );
    } else if (kind === 'matches') {
      download(
        `kof-matches_${stamp}.csv`,
        matchesToCsv(history.summaries),
        'text/csv;charset=utf-8',
      );
    } else {
      download(`kof-luck-board_${stamp}.csv`, statsToCsv(history.stats), 'text/csv;charset=utf-8');
    }
  }

  return (
    <main className="history">
      <header className="title">
        <h1 className="title__logo">Hall of Fate</h1>
        <p className="title__tagline">Every completed match</p>
      </header>

      <div className="history__bar">
        <button type="button" className="button" onClick={onBack}>
          Back to setup
        </button>
        <div className="history__tabs" role="group" aria-label="History view">
          <button
            type="button"
            className="button button--small history__tab"
            aria-pressed={!profile && tab === 'leaderboard'}
            onClick={() => showTab('leaderboard')}
          >
            Luck board
          </button>
          <button
            type="button"
            className="button button--small history__tab"
            aria-pressed={!profile && tab === 'rivalries'}
            onClick={() => showTab('rivalries')}
          >
            Rivalries
          </button>
          <button
            type="button"
            className="button button--small history__tab"
            aria-pressed={!profile && tab === 'matches'}
            onClick={() => showTab('matches')}
          >
            Matches ({history.records.length})
          </button>
        </div>
      </div>

      {history.error && (
        <p className="banner banner--error" role="alert">
          {history.error}
        </p>
      )}
      {history.skipped > 0 && (
        <p className="banner banner--warn" role="status">
          {history.skipped} saved match{history.skipped === 1 ? '' : 'es'} could not be read and{' '}
          {history.skipped === 1 ? 'is' : 'are'} left out.
        </p>
      )}

      {history.loading ? (
        <p className="empty" aria-busy="true">
          Loading history…
        </p>
      ) : profile ? (
        <FighterProfile
          key={profile.id}
          stats={profile}
          badges={history.badges.get(profile.id) ?? []}
          rivals={headToHead(history.summaries, profile.id)}
          summaries={history.summaries}
          onOpen={setProfileId}
          onBack={() => setProfileId(null)}
        />
      ) : tab === 'leaderboard' ? (
        <Leaderboard stats={history.stats} badges={history.badges} onOpen={setProfileId} />
      ) : tab === 'rivalries' ? (
        <Rivalries items={history.rivalries} onOpen={setProfileId} />
      ) : (
        <MatchHistory
          summaries={history.summaries}
          records={history.records}
          onDelete={history.deleteMatch}
        />
      )}

      <section className="panel history-panel" aria-labelledby="export-title">
        <h2 id="export-title" className="panel__title">
          Export & storage
        </h2>
        <p className="hint">
          History lives only in this browser on this computer. Clearing browser data deletes it.
          Export to keep a copy.
        </p>
        <div className="toolbar history__exports">
          <button
            type="button"
            className="button button--small"
            disabled={empty}
            onClick={() => exportFile('json')}
          >
            Export JSON (full backup)
          </button>
          <button
            type="button"
            className="button button--small"
            disabled={empty}
            onClick={() => exportFile('matches')}
          >
            Matches CSV
          </button>
          <button
            type="button"
            className="button button--small"
            disabled={empty}
            onClick={() => exportFile('fighters')}
          >
            Luck board CSV
          </button>
        </div>
        <ConfirmButton
          label="Clear all history"
          question={`Delete all ${history.records.length} matches for good? Export first if you want a copy.`}
          confirmLabel="Yes, clear all"
          disabled={empty && history.skipped === 0}
          onConfirm={() => void history.clearAll()}
        />
      </section>
    </main>
  );
}
