import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useSound } from '../../audio/soundContext';

interface PauseMenuProps {
  readonly title: string;
  readonly message?: string;
  readonly onResume: () => void;
  /** Extra actions (e.g. Abandon match). */
  readonly children?: ReactNode;
}

/** Esc menu. Pausing never changes any committed outcome. */
export function PauseMenu({ title, message, onResume, children }: PauseMenuProps) {
  const titleId = useId();
  const resumeRef = useRef<HTMLButtonElement>(null);
  const { settings, toggleMute } = useSound();

  useEffect(() => {
    resumeRef.current?.focus();
  }, []);

  return (
    <div className="pause-backdrop">
      <section
        className="panel pause-menu"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h2 id={titleId} className="pause-menu__title">
          {title}
        </h2>
        {message && <p className="pause-menu__message">{message}</p>}
        <div className="pause-menu__actions">
          <button ref={resumeRef} type="button" className="button button--start" onClick={onResume}>
            Resume
          </button>
          <button
            type="button"
            className="button"
            aria-pressed={!settings.muted}
            onClick={toggleMute}
          >
            {settings.muted ? 'Sound: off' : 'Sound: on'}
          </button>
          {children}
        </div>
        <dl className="shortcut-list" aria-label="Keyboard shortcuts">
          <dt>Space / Enter</dt>
          <dd>Spin (or start the finale)</dd>
          <dt>S</dt>
          <dd>Shuffle positions</dd>
          <dt>M</dt>
          <dd>Mute / unmute</dd>
          <dt>Esc</dt>
          <dd>Pause menu (finale: pause after the current round)</dd>
        </dl>
      </section>
    </div>
  );
}
