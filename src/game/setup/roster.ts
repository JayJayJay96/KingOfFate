import { MAX_NAME_LENGTH } from '../config/limits';

/** A stored roster entry. `id` is the identity; `name` is only a display label. */
export interface Participant {
  readonly id: string;
  readonly name: string;
  readonly active: boolean;
}

export type Roster = readonly Participant[];

export type NameRejectionReason = 'too-long' | 'duplicate';

export interface NameRejection {
  readonly name: string;
  readonly reason: NameRejectionReason;
}

export interface RosterAddResult {
  readonly roster: Roster;
  readonly added: readonly Participant[];
  readonly rejected: readonly NameRejection[];
}

/** NFC-normalise, collapse internal whitespace runs and trim (D5). */
export function normalizeName(raw: string): string {
  return raw.normalize('NFC').replace(/\s+/g, ' ').trim();
}

/** Length in user-visible code points, so Vietnamese diacritics count once after NFC. */
export function nameLength(name: string): number {
  return Array.from(name).length;
}

/** Case-insensitive comparison key for duplicate detection (D5). */
export function nameKey(name: string): string {
  return normalizeName(name).toLowerCase();
}

/**
 * Parses newline-separated names and appends the valid ones as new active participants.
 * Blank lines are dropped silently; over-long and duplicate names (within the paste or
 * against the existing roster) are rejected and reported.
 */
export function addNamesToRoster(
  roster: Roster,
  input: string,
  createId: () => string,
): RosterAddResult {
  const seen = new Set(roster.map((p) => nameKey(p.name)));
  const added: Participant[] = [];
  const rejected: NameRejection[] = [];

  for (const line of input.split(/\r\n|\r|\n/)) {
    const name = normalizeName(line);
    if (name === '') continue;
    if (nameLength(name) > MAX_NAME_LENGTH) {
      rejected.push({ name, reason: 'too-long' });
      continue;
    }
    const key = nameKey(name);
    if (seen.has(key)) {
      rejected.push({ name, reason: 'duplicate' });
      continue;
    }
    seen.add(key);
    added.push({ id: createId(), name, active: true });
  }

  return { roster: added.length ? [...roster, ...added] : roster, added, rejected };
}

export function setParticipantActive(roster: Roster, id: string, active: boolean): Roster {
  return roster.map((p) => (p.id === id && p.active !== active ? { ...p, active } : p));
}

export function setAllActive(roster: Roster, active: boolean): Roster {
  return roster.map((p) => (p.active === active ? p : { ...p, active }));
}

export function removeParticipant(roster: Roster, id: string): Roster {
  return roster.filter((p) => p.id !== id);
}

export function activeParticipants(roster: Roster): Roster {
  return roster.filter((p) => p.active);
}
