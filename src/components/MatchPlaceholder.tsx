import { FATE_PRESETS, type FatePresetId } from '../game/config/presets';
import type { Participant } from '../game/setup/roster';

export interface MatchLaunch {
  readonly players: readonly Participant[];
  readonly winnerCount: number;
  readonly presetId: FatePresetId;
}

interface MatchPlaceholderProps {
  readonly launch: MatchLaunch;
  readonly onBack: () => void;
}

/** PHASE 1 PLACEHOLDER: the playable match arrives in Phase 2. Nothing is sampled here. */
export function MatchPlaceholder({ launch, onBack }: MatchPlaceholderProps) {
  return (
    <main className="placeholder">
      <section className="panel">
        <h1 className="panel__title">Match lineup</h1>
        <p className="banner banner--warn" role="status">
          Phase 1 build: gameplay is not implemented yet (arrives in Phase 2).
        </p>
        <p>
          {launch.players.length} fighters · {launch.winnerCount} winner
          {launch.winnerCount === 1 ? '' : 's'} · {FATE_PRESETS[launch.presetId].label} preset
        </p>
        <ul className="lineup">
          {launch.players.map((p) => (
            <li key={p.id}>{p.name}</li>
          ))}
        </ul>
        <button type="button" className="button" onClick={onBack}>
          Back to setup
        </button>
      </section>
    </main>
  );
}
