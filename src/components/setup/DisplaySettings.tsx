import { useId, useState } from 'react';
import {
  applyMotionSetting,
  loadMotionSetting,
  saveMotionSetting,
  systemPrefersReducedMotion,
  type MotionSetting,
} from '../../storage/displaySettings';

/** Animations: follow the computer's reduced-motion setting, or always on (owner request). */
export function DisplaySettings() {
  const titleId = useId();
  const [motion, setMotion] = useState<MotionSetting>(loadMotionSetting);
  const reduced = systemPrefersReducedMotion();

  function choose(next: MotionSetting) {
    setMotion(next);
    saveMotionSetting(next);
    applyMotionSetting(next);
  }

  return (
    <section className="panel display-settings" aria-labelledby={titleId}>
      <fieldset className="fieldset">
        <legend id={titleId} className="panel__title">
          Animations
        </legend>
        <label>
          <input
            type="radio"
            name="motion"
            checked={motion === 'system'}
            onChange={() => choose('system')}
          />{' '}
          Follow this computer&apos;s setting
        </label>
        <label>
          <input
            type="radio"
            name="motion"
            checked={motion === 'always'}
            onChange={() => choose('always')}
          />{' '}
          Always on
        </label>
      </fieldset>
      <p className="hint" data-testid="motion-hint">
        {reduced
          ? motion === 'always'
            ? 'This computer has animations turned off, but the game plays them anyway.'
            : 'This computer has animations turned off (common on Windows Server and Remote Desktop), so idle and K.O. animations are hidden. Choose Always on to show them.'
          : 'This computer allows animations.'}
      </p>
    </section>
  );
}
