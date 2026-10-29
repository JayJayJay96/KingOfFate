import { useRef, useState, type ChangeEvent } from 'react';
import type { ImportMode } from '../../game/history/importData';
import { fileStamp, historyToJson, matchesToCsv, statsToCsv } from '../../game/history/exportData';
import { useHistory, type PreparedImport } from '../../hooks/useHistory';
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
  /** Office mode: history is shared on the office server. */
  readonly office?: boolean;
}

type Tab = 'leaderboard' | 'rivalries' | 'matches';

/** Larger files are refused before reading (an export of ~1000 matches is a few MB). */
const MAX_IMPORT_BYTES = 50 * 1024 * 1024;

/** Phase 6: completed-match history, luck board and exports. All data stays in this browser. */
export function HistoryScreen({
  repository,
  onBack,
  download = downloadText,
  office = false,
}: HistoryScreenProps) {
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
  const fileInput = useRef<HTMLInputElement>(null);
  const [importMode, setImportMode] = useState<ImportMode>('merge');
  /** A "replace" import waiting for the host to confirm. */
  const [pendingReplace, setPendingReplace] = useState<(PreparedImport & { ok: true }) | null>(
    null,
  );
  const [importReport, setImportReport] = useState<{ ok: boolean; text: string } | null>(null);

  function pickFile(mode: ImportMode) {
    setImportMode(mode);
    setImportReport(null);
    setPendingReplace(null);
    fileInput.current?.click();
  }

  async function runImport(prepared: PreparedImport & { ok: true }) {
    setPendingReplace(null);
    const report = await history.applyImport(prepared);
    if (report) setImportReport({ ok: true, text: `Done: ${report}.` });
  }

  async function onFileChosen(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      setImportReport({ ok: false, text: 'This file is too large to be a history export.' });
      return;
    }
    const prepared = history.prepareImport(await file.text(), importMode);
    if (!prepared.ok) setImportReport({ ok: false, text: prepared.message });
    else if (prepared.mode === 'replace') setPendingReplace(prepared);
    else await runImport(prepared);
  }

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
          {office
            ? 'Office mode: history is shared on the office server (this PC keeps a copy for when the server cannot be reached).'
            : 'History lives only in this browser on this computer. Clearing browser data deletes it.'}{' '}
          Export to keep a copy. Merge adds the matches from an export file (an exact copy is
          skipped, a changed one takes the file&apos;s version); Import replaces all history.
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
        <div className="toolbar history__exports">
          <button type="button" className="button button--small" onClick={() => pickFile('merge')}>
            Merge from file
          </button>
          <button
            type="button"
            className="button button--small"
            onClick={() => pickFile('replace')}
          >
            Import (replace all)
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            hidden
            aria-label="History file to import"
            onChange={(e) => void onFileChosen(e)}
          />
        </div>
        {pendingReplace && (
          <div className="confirm" role="group" aria-label="Confirm import">
            <p className="confirm__question">
              Replace all {history.records.length + history.skipped} saved matches with the{' '}
              {pendingReplace.plan.records.length} in this file? Export first if you want a copy.
            </p>
            <button
              type="button"
              className="button button--small button--danger"
              onClick={() => void runImport(pendingReplace)}
            >
              Yes, replace all
            </button>
            <button
              type="button"
              className="button button--small"
              onClick={() => setPendingReplace(null)}
            >
              Cancel
            </button>
          </div>
        )}
        {importReport && (
          <p
            className={`banner ${importReport.ok ? 'banner--ok' : 'banner--error'}`}
            role={importReport.ok ? 'status' : 'alert'}
          >
            {importReport.text}
          </p>
        )}
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
