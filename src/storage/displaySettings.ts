/**
 * Per-browser display preference (owner decision 2026-10-10). `system` follows the computer's
 * reduced-motion setting (Windows "Show animations"); `always` keeps every game animation on,
 * e.g. for an office PC (Windows Server) where Windows animations are switched off.
 */
export type MotionSetting = 'system' | 'always';

export const DISPLAY_SETTINGS_KEY = 'kof.display';

export function loadMotionSetting(storage: Storage | null = safeStorage()): MotionSetting {
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(DISPLAY_SETTINGS_KEY) ?? 'null');
    return typeof parsed === 'object' &&
      parsed !== null &&
      (parsed as { motion?: unknown }).motion === 'always'
      ? 'always'
      : 'system';
  } catch {
    return 'system';
  }
}

export function saveMotionSetting(
  motion: MotionSetting,
  storage: Storage | null = safeStorage(),
): boolean {
  try {
    storage?.setItem(DISPLAY_SETTINGS_KEY, JSON.stringify({ motion }));
    return !!storage;
  } catch {
    return false;
  }
}

/** The CSS reads `<html data-motion="always">` to override reduced-motion rules. */
export function applyMotionSetting(
  motion: MotionSetting,
  root: HTMLElement = document.documentElement,
) {
  if (motion === 'always') root.dataset.motion = 'always';
  else delete root.dataset.motion;
}

/** True when the computer asks for reduced motion. */
export function systemPrefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
