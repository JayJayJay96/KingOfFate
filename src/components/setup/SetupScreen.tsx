import { useId } from 'react';
import type { Roster } from '../../game/setup/roster';
import { describeSetupIssue, validateSetup } from '../../game/setup/validation';
import type { SetupStore } from '../../hooks/useSetupConfig';
import type { SetupLoadStatus } from '../../storage/setupStorage';
import { MatchOptions } from './MatchOptions';
import { RosterGrid } from './RosterGrid';
import { RosterInput } from './RosterInput';
import { SoundSettings } from './SoundSettings';

interface SetupScreenProps {
  readonly store: SetupStore;
  readonly onStart: () => void;
  /** Problem with the saved/in-progress match (corrupt checkpoint, storage unavailable). */
  readonly matchNotice?: string | null;
}

const LOAD_NOTICES: Partial<Record<SetupLoadStatus, string>> = {
  corrupt:
    'Saved settings could not be read, so defaults were loaded. A copy of the old data was kept in browser storage.',
  repaired: 'Some saved settings were invalid and have been reset or removed.',
};

export function SetupScreen({ store, onStart, matchNotice = null }: SetupScreenProps) {
  const { config, update, loadStatus, saveError } = store;
  const validation = validateSetup(config);
  const issuesId = useId();
  const loadNotice = LOAD_NOTICES[loadStatus];
  const changeRoster = (change: (roster: Roster) => Roster) =>
    update((c) => ({ ...c, roster: change(c.roster) }));

  return (
    <main className="setup">
      <header className="title">
        <h1 className="title__logo">King of Fate</h1>
        <p className="title__tagline">Select today&apos;s fighters</p>
      </header>

      {loadNotice && (
        <p className="banner banner--warn" role="status">
          {loadNotice}
        </p>
      )}
      {saveError && (
        <p className="banner banner--error" role="alert">
          Settings are not being saved. {saveError}
        </p>
      )}
      {matchNotice && (
        <p className="banner banner--warn" role="status">
          {matchNotice}
        </p>
      )}

      <div className="setup__layout">
        <div className="setup__main">
          <RosterInput onRosterChange={changeRoster} />
          <RosterGrid roster={config.roster} onRosterChange={changeRoster} />
        </div>

        <aside className="setup__side">
          <MatchOptions
            winnerCount={config.winnerCount}
            presetId={config.presetId}
            onWinnerCountChange={(winnerCount) => update((c) => ({ ...c, winnerCount }))}
            onPresetChange={(presetId) => update((c) => ({ ...c, presetId }))}
          />

          <SoundSettings />

          <section className="panel start-panel">
            <div id={issuesId} aria-live="polite">
              {validation.issues.length > 0 ? (
                <ul className="warning-list">
                  {validation.issues.map((issue) => (
                    <li key={issue.code}>{describeSetupIssue(issue)}</li>
                  ))}
                </ul>
              ) : (
                <p className="ready">
                  {validation.activeCount} fighters ready for {config.winnerCount} winner
                  {config.winnerCount === 1 ? '' : 's'}.
                  {validation.startsInFinale &&
                    ' Exactly winners + 1: the match opens in the finale.'}
                </p>
              )}
            </div>
            <button
              type="button"
              className="button button--start"
              disabled={!validation.canStart}
              aria-describedby={issuesId}
              onClick={onStart}
            >
              Start
            </button>
          </section>
        </aside>
      </div>
    </main>
  );
}
