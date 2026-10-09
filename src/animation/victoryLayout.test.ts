import { describe, expect, it } from 'vitest';
import { CLEAR_LEFT, CLEAR_RIGHT, scatterFallen } from './victoryLayout';

const names = Array.from({ length: 30 }, (_, i) => `Fighter ${i}`);

describe('scatterFallen', () => {
  it('keeps every body on screen and out of the winners’ centre column', () => {
    for (const spot of scatterFallen(names)) {
      expect(spot.x >= 2 && spot.x <= 98).toBe(true);
      expect(spot.y >= 6 && spot.y <= 92).toBe(true);
      expect(spot.x < CLEAR_LEFT || spot.x > CLEAR_RIGHT).toBe(true);
      expect([90, -90]).toContain(spot.rotate);
    }
  });

  it('is deterministic, so a refresh shows the same scene', () => {
    expect(scatterFallen(names)).toEqual(scatterFallen(names));
  });

  it('uses both sides of the screen', () => {
    const spots = scatterFallen(names);
    expect(spots.some((s) => s.x < 50)).toBe(true);
    expect(spots.some((s) => s.x > 50)).toBe(true);
  });
});
