import { describe, expect, it } from 'vitest';
import {
  applyMotionSetting,
  DISPLAY_SETTINGS_KEY,
  loadMotionSetting,
  saveMotionSetting,
} from './displaySettings';

describe('display settings: Animations (owner request 2026-10-10)', () => {
  it('follows the computer by default and remembers Always on', () => {
    localStorage.clear();
    expect(loadMotionSetting(localStorage)).toBe('system');
    expect(saveMotionSetting('always', localStorage)).toBe(true);
    expect(JSON.parse(localStorage.getItem(DISPLAY_SETTINGS_KEY)!)).toEqual({ motion: 'always' });
    expect(loadMotionSetting(localStorage)).toBe('always');
    localStorage.setItem(DISPLAY_SETTINGS_KEY, '{oops');
    expect(loadMotionSetting(localStorage)).toBe('system');
    localStorage.clear();
  });

  it('marks <html> so the reduced-motion rules are skipped', () => {
    const root = document.createElement('html');
    applyMotionSetting('always', root);
    expect(root.dataset.motion).toBe('always');
    applyMotionSetting('system', root);
    expect(root.dataset.motion).toBeUndefined();
  });

  it('works without storage', () => {
    expect(loadMotionSetting(null)).toBe('system');
    expect(saveMotionSetting('always', null)).toBe(false);
  });
});
