/**
 * Stage backgrounds (owner decision 2026-10-10): original pixel scenes drawn in code. Random per
 * match unless the host pins one. Purely visual; never part of any outcome.
 */
export const STAGE_IDS = ['kl-night', 'mamak', 'pantry', 'pasar-malam', 'rooftop'] as const;
export type StageId = (typeof STAGE_IDS)[number];
export type StageChoice = StageId | 'random';

export const STAGE_LABELS: Readonly<Record<StageId, string>> = {
  'kl-night': 'KL Night',
  mamak: 'Mamak Stall',
  pantry: 'Office Pantry',
  'pasar-malam': 'Pasar Malam',
  rooftop: 'Rooftop Sunset',
};

export function isStageChoice(value: unknown): value is StageChoice {
  return value === 'random' || (STAGE_IDS as readonly unknown[]).includes(value);
}

/**
 * The stage for a match: the pinned one, or one picked from the match ID (so a refresh shows the
 * same stage without storing anything extra).
 */
export function stageForMatch(choice: StageChoice, matchId: string): StageId {
  if (choice !== 'random') return choice;
  let h = 0x811c9dc5;
  for (let i = 0; i < matchId.length; i++) {
    h ^= matchId.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 13;
  return STAGE_IDS[(h >>> 0) % STAGE_IDS.length]!;
}
