import { MAX_TITLE_LENGTH, WINNER_COUNT_OPTIONS, type WinnerCount } from '../../game/config/limits';
import { cleanTitle } from '../../storage/setupStorage';
import { isStageChoice, STAGE_IDS, STAGE_LABELS, type StageChoice } from '../../game/config/stages';
import {
  adjustOdds,
  CUSTOM_PRESET_ID,
  FATE_PRESET_IDS,
  FATE_PRESETS,
  formatOdds,
  slotsToPercent,
  type AdjustableKind,
  type FateOdds,
  type FatePresetId,
} from '../../game/config/presets';

interface MatchOptionsProps {
  readonly winnerCount: WinnerCount;
  readonly presetId: FatePresetId;
  readonly onWinnerCountChange: (winnerCount: WinnerCount) => void;
  readonly onPresetChange: (presetId: FatePresetId) => void;
  readonly stage: StageChoice;
  readonly onStageChange: (stage: StageChoice) => void;
  readonly turbo: boolean;
  readonly onTurboChange: (turbo: boolean) => void;
  readonly title: string;
  readonly onTitleChange: (title: string) => void;
  readonly customOdds: FateOdds;
  readonly onCustomOddsChange: (odds: FateOdds) => void;
}

export function MatchOptions({
  winnerCount,
  presetId,
  onWinnerCountChange,
  onPresetChange,
  stage,
  onStageChange,
  turbo,
  onTurboChange,
  title,
  onTitleChange,
  customOdds,
  onCustomOddsChange,
}: MatchOptionsProps) {
  return (
    <section className="panel">
      <label className="fieldset title-input">
        <span className="panel__title">Prize / title</span>
        <input
          type="text"
          value={title}
          maxLength={MAX_TITLE_LENGTH}
          placeholder="Who buys kopi today?"
          onChange={(e) => onTitleChange(cleanTitle(e.target.value))}
        />
        <span className="hint">
          Optional. Shown in the intro, the finale and on the winner screen.
        </span>
      </label>

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
          <label className="preset-card">
            <input
              type="radio"
              name="fate-preset"
              value={CUSTOM_PRESET_ID}
              checked={presetId === CUSTOM_PRESET_ID}
              onChange={() => onPresetChange(CUSTOM_PRESET_ID)}
            />
            <span className="preset-card__body">
              <span className="preset-card__name">Custom</span>
              <span className="preset-card__odds">{formatOdds(customOdds.normal)}</span>
              <span className="preset-card__sd">
                Sudden Death: {formatOdds(customOdds.suddenDeath)}
              </span>
            </span>
          </label>
        </div>
        {presetId === CUSTOM_PRESET_ID && (
          <CustomOddsEditor odds={customOdds} onChange={onCustomOddsChange} />
        )}
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

      <label className="fieldset toggle-option">
        <input type="checkbox" checked={turbo} onChange={(e) => onTurboChange(e.target.checked)} />
        <span>
          <span className="panel__title">Turbo spins</span>
          <span className="hint">
            Shorter spins (1.5–4 s instead of 2.5–6.5 s) for big rosters. Same odds.
          </span>
        </span>
      </label>
    </section>
  );
}

const KIND_LABEL: Readonly<Record<AdjustableKind, string>> = {
  VS: 'VS',
  SHIELD: 'Shield',
  BOMB: 'Bomb',
};

/**
 * Custom Fate odds (owner decision 2026-10-16): +/- moves one of the 20 equally likely slots
 * (5 %) between a Fate and KO, so the pool always adds up to 100 %.
 */
function CustomOddsEditor({
  odds,
  onChange,
}: {
  readonly odds: FateOdds;
  readonly onChange: (odds: FateOdds) => void;
}) {
  const rows = [
    { pool: 'normal', title: 'Normal play', kinds: ['VS', 'SHIELD', 'BOMB'] },
    { pool: 'suddenDeath', title: 'Sudden Death', kinds: ['VS', 'BOMB'] },
  ] as const;
  return (
    <div className="odds-editor" data-testid="odds-editor">
      {rows.map(({ pool, title, kinds }) => (
        <div key={pool} className="odds-editor__row" role="group" aria-label={`${title} odds`}>
          <span className="odds-editor__pool">{title}</span>
          <span className="odds-editor__ko" data-testid={`odds-${pool}-KO`}>
            KO {slotsToPercent(odds[pool].KO)}%
          </span>
          {kinds.map((kind) => (
            <span key={kind} className="odds-editor__step">
              <button
                type="button"
                className="button button--small"
                aria-label={`Less ${KIND_LABEL[kind]} (${title})`}
                onClick={() => onChange(adjustOdds(odds, pool, kind, -1))}
              >
                −
              </button>
              <span data-testid={`odds-${pool}-${kind}`}>
                {KIND_LABEL[kind]} {slotsToPercent(odds[pool][kind])}%
              </span>
              <button
                type="button"
                className="button button--small"
                aria-label={`More ${KIND_LABEL[kind]} (${title})`}
                onClick={() => onChange(adjustOdds(odds, pool, kind, 1))}
              >
                +
              </button>
            </span>
          ))}
        </div>
      ))}
      <p className="hint">
        Each step is 5 % (one of the 20 Fate slots); KO takes whatever is left. Sudden Death has no
        Shields and never more VS than normal play.
      </p>
    </div>
  );
}
