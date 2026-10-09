import { WINNER_COUNT_OPTIONS, type WinnerCount } from '../../game/config/limits';
import { isStageChoice, STAGE_IDS, STAGE_LABELS, type StageChoice } from '../../game/config/stages';
import {
  FATE_PRESET_IDS,
  FATE_PRESETS,
  formatOdds,
  type FatePresetId,
} from '../../game/config/presets';

interface MatchOptionsProps {
  readonly winnerCount: WinnerCount;
  readonly presetId: FatePresetId;
  readonly onWinnerCountChange: (winnerCount: WinnerCount) => void;
  readonly onPresetChange: (presetId: FatePresetId) => void;
  readonly stage: StageChoice;
  readonly onStageChange: (stage: StageChoice) => void;
}

export function MatchOptions({
  winnerCount,
  presetId,
  onWinnerCountChange,
  onPresetChange,
  stage,
  onStageChange,
}: MatchOptionsProps) {
  return (
    <section className="panel">
      <fieldset className="fieldset">
        <legend className="panel__title">Winners</legend>
        <div className="segmented">
          {WINNER_COUNT_OPTIONS.map((n) => (
            <label key={n} className="segmented__option">
              <input
                type="radio"
                name="winner-count"
                value={n}
                checked={winnerCount === n}
                onChange={() => onWinnerCountChange(n)}
              />
              <span>{n}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="fieldset">
        <legend className="panel__title">Fate preset</legend>
        <div className="preset-list">
          {FATE_PRESET_IDS.map((id) => {
            const preset = FATE_PRESETS[id];
            return (
              <label key={id} className="preset-card">
                <input
                  type="radio"
                  name="fate-preset"
                  value={id}
                  checked={presetId === id}
                  onChange={() => onPresetChange(id)}
                />
                <span className="preset-card__body">
                  <span className="preset-card__name">{preset.label}</span>
                  <span className="preset-card__odds">{formatOdds(preset.normal)}</span>
                  <span className="preset-card__sd">
                    Sudden Death: {formatOdds(preset.suddenDeath)}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <label className="fieldset stage-select">
        <span className="panel__title">Stage</span>
        <select
          value={stage}
          onChange={(e) => {
            if (isStageChoice(e.target.value)) onStageChange(e.target.value);
          }}
        >
          <option value="random">Random each match</option>
          {STAGE_IDS.map((id) => (
            <option key={id} value={id}>
              {STAGE_LABELS[id]}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}
