import type { WinnerCount } from '../config/limits';
import {
  DEFAULT_CUSTOM_ODDS,
  DEFAULT_PRESET_ID,
  type FateOdds,
  type FatePresetId,
} from '../config/presets';
import type { StageChoice } from '../config/stages';
import { EMPTY_FAIR_STATE, type FairState } from './fairSitOut';
import type { Roster } from './roster';

/** The single persisted default configuration (PROJECT.md §3). */
export interface SetupConfig {
  readonly roster: Roster;
  readonly winnerCount: WinnerCount;
  readonly presetId: FatePresetId;
  /** The Custom preset's odds (kept even while another preset is chosen). */
  readonly customOdds: FateOdds;
  /** Stage background: random per match, or pinned. */
  readonly stage: StageChoice;
  /** Turbo spins: shorter cursor spins for big rosters (presentation only). */
  readonly turbo: boolean;
  /** Prize / title line shown in the intro, finale and victory (empty = none). */
  readonly title: string;
  /** Fair sit-out cycle (owner decision 2026-10-29). */
  readonly fair: FairState;
}

export const DEFAULT_WINNER_COUNT: WinnerCount = 1;

export const DEFAULT_SETUP: SetupConfig = {
  roster: [],
  winnerCount: DEFAULT_WINNER_COUNT,
  presetId: DEFAULT_PRESET_ID,
  customOdds: DEFAULT_CUSTOM_ODDS,
  stage: 'random',
  turbo: false,
  title: '',
  fair: EMPTY_FAIR_STATE,
};
