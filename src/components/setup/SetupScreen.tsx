import { useId } from 'react';
import type { Roster } from '../../game/setup/roster';
import { describeSetupIssue, validateSetup } from '../../game/setup/validation';
import type { FairWin } from '../../game/setup/fairSitOut';
import type { SetupStore } from '../../hooks/useSetupConfig';
import type { SetupLoadStatus } from '../../storage/setupStorage';
import { MatchOptions } from './MatchOptions';
import { RosterGrid } from './RosterGrid';
import { RosterInput } from './RosterInput';
import { DisplaySettings } from './DisplaySettings';
import { SoundSettings } from './SoundSettings';

interface SetupScreenProps {
  readonly store: SetupStore;
  readonly onStart: () => void;
  readonly onOpenHistory: () => void;
  /** Problem with the saved/in-progress match (corrupt checkpoint, storage unavailable). */
  readonly matchNotice?: string | null;
  readonly sitOut?: ReadonlyMap<string, readonly FairWin[]>;
}

const LOAD_NOTICES: Partial<Record<SetupLoadStatus, string>> = {
  corrupt:
    'Saved settings could not be read, so defaults were loaded. A copy of the old data was kept in browser storage.',
  repaired: 'Some saved settings were invalid and have been reset or removed.',
};

export function SetupScreen({
  store,
  onStart,
  onOpenHistory,
  matchNotice = null,
  sitOut,
}: SetupScreenProps) {
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
        <button
          type="button"
          className="button button--small title__history"
          onClick={onOpenHistory}
        >
          History
        </button>
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
          <RosterGrid roster={config.roster} onRosterChange={changeRoster} sitOut={sitOut} />
        </div>

        <aside className="setup__side">
          <MatchOptions
            winnerCount={config.winnerCount}
            presetId={config.presetId}
            onWinnerCountChange={(winnerCount) => update((c) => ({ ...c, winnerCount }))}
            onPresetChange={(presetId) => update((c) => ({ ...c, presetId }))}
            stage={config.stage}
            onStageChange={(stage) => update((c) => ({ ...c, stage }))}
            turbo={config.turbo}
            onTurboChange={(turbo) => update((c) => ({ ...c, turbo }))}
            customOdds={config.customOdds}
            onCustomOddsChange={(customOdds) => update((c) => ({ ...c, customOdds }))}
            title={config.title}
            onTitleChange={(title) => update((c) => ({ ...c, title }))}
          />

          <SoundSettings />

          <DisplaySettings />

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
