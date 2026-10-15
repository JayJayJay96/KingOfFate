import type { WinnerCount } from '../config/limits';
import { DEFAULT_PRESET_ID, type FatePresetId } from '../config/presets';
import type { StageChoice } from '../config/stages';
import type { Roster } from './roster';

/** The single persisted default configuration (PROJECT.md §3). */
export interface SetupConfig {
  readonly roster: Roster;
  readonly winnerCount: WinnerCount;
  readonly presetId: FatePresetId;
  /** Stage background: random per match, or pinned. */
  readonly stage: StageChoice;
  /** Turbo spins: shorter cursor spins for big rosters (presentation only). */
  readonly turbo: boolean;
  /** Prize / title line shown in the intro, finale and victory (empty = none). */
  readonly title: string;
}

export const DEFAULT_WINNER_COUNT: WinnerCount = 1;

export const DEFAULT_SETUP: SetupConfig = {
  roster: [],
  winnerCount: DEFAULT_WINNER_COUNT,
  presetId: DEFAULT_PRESET_ID,
  stage: 'random',
  turbo: false,
  title: '',
};
