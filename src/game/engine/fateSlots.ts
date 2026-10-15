import { FATE_KINDS, FATE_SLOT_COUNT, type FateKind, type FateWeights } from '../config/presets';

/**
 * Builds the visible 20-slot Fate strip for given weights. Minority Fates are spread evenly so
 * the starting layout looks fair; positions never change odds (each slot is equally likely).
 */
export function spreadSlots(weights: FateWeights): FateKind[] {
  assertTwentySlots(weights);
  const slots: (FateKind | null)[] = new Array<FateKind | null>(FATE_SLOT_COUNT).fill(null);
  for (const kind of ['SHIELD', 'VS', 'BOMB'] as const) {
    const count = weights[kind];
    for (let i = 0; i < count; i++) {
      let pos = Math.floor(((i + 0.5) * FATE_SLOT_COUNT) / count) % FATE_SLOT_COUNT;
      while (slots[pos] !== null) pos = (pos + 1) % FATE_SLOT_COUNT;
      slots[pos] = kind;
    }
  }
  return slots.map((s) => s ?? 'KO');
}

/**
 * Converts the current strip to the Sudden Death composition IN PLACE, so the host can see
 * which slots flipped: every Shield slot becomes KO, then the first surplus VS slots become KO.
 * Bomb slots stay where they are (a strip saved before Bombs existed gets its Bomb slots from KO).
 */
export function toSuddenDeathSlots(
  current: readonly FateKind[],
  suddenDeath: FateWeights,
): FateKind[] {
  assertTwentySlots(suddenDeath);
  if (suddenDeath.SHIELD !== 0) throw new Error('Sudden Death pools never contain Shield');
  const next = current.map((k) => (k === 'SHIELD' ? 'KO' : k));
  let surplusVs = next.filter((k) => k === 'VS').length - suddenDeath.VS;
  if (surplusVs < 0) throw new Error('Sudden Death cannot add VS slots');
  for (let i = 0; i < next.length && surplusVs > 0; i++) {
    if (next[i] === 'VS') {
      next[i] = 'KO';
      surplusVs--;
    }
  }
  let bombs = suddenDeath.BOMB - next.filter((k) => k === 'BOMB').length;
  for (let i = 0; i < next.length && bombs !== 0; i++) {
    if (bombs > 0 && next[i] === 'KO') {
      next[i] = 'BOMB';
      bombs--;
    } else if (bombs < 0 && next[i] === 'BOMB') {
      next[i] = 'KO';
      bombs++;
    }
  }
  return next;
}

export function countSlots(slots: readonly FateKind[]): FateWeights {
  const counts = { KO: 0, VS: 0, SHIELD: 0, BOMB: 0 };
  for (const kind of slots) counts[kind]++;
  return counts;
}

export function isFateKind(value: unknown): value is FateKind {
  return typeof value === 'string' && (FATE_KINDS as readonly string[]).includes(value);
}

function assertTwentySlots(weights: FateWeights): void {
  const total = weights.KO + weights.VS + weights.SHIELD + weights.BOMB;
  if (total !== FATE_SLOT_COUNT) throw new Error(`Fate weights must total ${FATE_SLOT_COUNT}`);
}
