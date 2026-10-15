import { describe, expect, it } from 'vitest';
import { STAGE_IDS } from '../game/config/stages';
import { noteToFrequency, THEMES } from './chiptune';
import { FANFARE_STEPS, FANFARES, fanfareSeconds } from './fanfares';
import { parseManifest, VOICE_CLIPS } from './voiceClips';

describe('stage victory fanfares (owner request 2026-10-10)', () => {
  it('every stage has its own two-bar fanfare of valid notes and drums', () => {
    const shapes = new Set<string>();
    for (const stage of STAGE_IDS) {
      const f = FANFARES[stage];
      expect(f.lead).toHaveLength(FANFARE_STEPS);
      expect(f.bass).toHaveLength(FANFARE_STEPS);
      expect(f.drums).toHaveLength(FANFARE_STEPS);
      for (const n of [...f.lead, ...f.bass]) {
        if (n) expect(noteToFrequency(n)).toBeGreaterThan(40);
        if (n) expect(noteToFrequency(n)).toBeLessThan(2000);
      }
      expect(f.drums.every((d) => d === null || 'KSHTGC'.includes(d))).toBe(true);
      // Short and sweet: about 2.5–5 seconds including the ringing last note.
      expect(fanfareSeconds(f)).toBeGreaterThan(2.5);
      expect(fanfareSeconds(f)).toBeLessThan(5);
      shapes.add(f.lead.join());
    }
    expect(shapes.size).toBe(STAGE_IDS.length);
  });
});

describe('finale music layers', () => {
  it('the finale theme carries an arpeggio and extra hats, one loop long, all valid', () => {
    const t = THEMES.finale;
    expect(t.layered).toBe(true);
    expect(t.arp).toHaveLength(t.lead.length);
    expect(t.drumsExtra).toHaveLength(t.drums.length);
    for (const n of t.arp!) if (n) expect(noteToFrequency(n) * 2 ** (1 / 12)).toBeLessThan(2000);
    expect(THEMES.select.layered).toBeFalsy();
  });
});

describe('voice clip manifest', () => {
  it('keeps only known clip ids, once each', () => {
    expect(parseManifest({ clips: ['one', 'juice', 'one', 'nope', 3] })).toEqual(['one', 'juice']);
    expect(parseManifest({})).toEqual([]);
    expect(parseManifest(null)).toEqual([]);
    expect(VOICE_CLIPS).toEqual(['one', 'two', 'juice', 'ko', 'versus', 'fight']);
  });
});
