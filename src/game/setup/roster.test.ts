import { describe, expect, it } from 'vitest';
import {
  activeParticipants,
  addNamesToRoster,
  nameLength,
  normalizeName,
  removeParticipant,
  setAllActive,
  setParticipantActive,
  type Roster,
} from './roster';

function idSequence() {
  let n = 0;
  return () => `id-${++n}`;
}

describe('normalizeName', () => {
  it('trims and collapses internal whitespace', () => {
    expect(normalizeName('  Bao \t  Tran  ')).toBe('Bao Tran');
  });

  it('NFC-normalises so decomposed Vietnamese counts as composed', () => {
    const decomposed = 'Nguyễn'; // "Nguyễn" with combining marks
    expect(normalizeName(decomposed)).toBe('Nguyễn');
    expect(nameLength(normalizeName(decomposed))).toBe(6);
  });
});

describe('addNamesToRoster', () => {
  it('adds trimmed names as active participants with fresh IDs and drops blank lines', () => {
    const result = addNamesToRoster([], '  An \n\n   \nBình\r\nChi\r', idSequence());
    expect(result.added).toEqual([
      { id: 'id-1', name: 'An', active: true },
      { id: 'id-2', name: 'Bình', active: true },
      { id: 'id-3', name: 'Chi', active: true },
    ]);
    expect(result.rejected).toEqual([]);
    expect(result.roster).toEqual(result.added);
  });

  it('accepts exactly 20 characters and rejects 21', () => {
    const twenty = 'A'.repeat(20);
    const twentyOne = 'B'.repeat(21);
    const result = addNamesToRoster([], `${twenty}\n${twentyOne}`, idSequence());
    expect(result.added.map((p) => p.name)).toEqual([twenty]);
    expect(result.rejected).toEqual([{ name: twentyOne, reason: 'too-long' }]);
  });

  it('rejects case-insensitive duplicates within the same paste', () => {
    const result = addNamesToRoster([], 'Ben\nben\nBEN \n Jay', idSequence());
    expect(result.added.map((p) => p.name)).toEqual(['Ben', 'Jay']);
    expect(result.rejected).toEqual([
      { name: 'ben', reason: 'duplicate' },
      { name: 'BEN', reason: 'duplicate' },
    ]);
  });

  it('rejects duplicates of names already on the roster, including Vietnamese case folding', () => {
    const existing: Roster = [{ id: 'x', name: 'Đức', active: false }];
    const result = addNamesToRoster(existing, 'đức\nĐỨC\nHà', idSequence());
    expect(result.added.map((p) => p.name)).toEqual(['Hà']);
    expect(result.rejected.map((r) => r.reason)).toEqual(['duplicate', 'duplicate']);
    expect(result.roster).toHaveLength(2);
  });

  it('returns the same roster reference when nothing was added', () => {
    const existing: Roster = [{ id: 'x', name: 'An', active: true }];
    expect(addNamesToRoster(existing, '\n  \nan', idSequence()).roster).toBe(existing);
  });

  it('never merges people: distinct names always get distinct IDs', () => {
    const result = addNamesToRoster([], 'An\nAnh\nAn Nguyen', idSequence());
    expect(new Set(result.added.map((p) => p.id)).size).toBe(3);
  });
});

describe('roster updates', () => {
  const roster: Roster = [
    { id: 'a', name: 'An', active: true },
    { id: 'b', name: 'Bình', active: true },
    { id: 'c', name: 'Chi', active: false },
  ];

  it('toggles attendance without mutating the input', () => {
    const next = setParticipantActive(roster, 'b', false);
    expect(next.find((p) => p.id === 'b')?.active).toBe(false);
    expect(roster[1]?.active).toBe(true);
    expect(activeParticipants(next).map((p) => p.id)).toEqual(['a']);
  });

  it('sets everyone in or out', () => {
    expect(activeParticipants(setAllActive(roster, true))).toHaveLength(3);
    expect(activeParticipants(setAllActive(roster, false))).toHaveLength(0);
  });

  it('removes a participant by id only', () => {
    expect(removeParticipant(roster, 'a').map((p) => p.id)).toEqual(['b', 'c']);
    expect(removeParticipant(roster, 'missing')).toEqual(roster);
  });
});
