import { useEffect, useRef, useState } from 'react';
import { useSound } from '../audio/soundContext';
import { FighterSprite } from './sprites/icons';

/** Generic attract-mode crowd (not real people). */
const CROWD = ['Ryu-chan', 'Kiki', 'Bao', 'Mira', 'Tok Wan', 'Zed', 'Lulu'];
const COIN_TO_START_MS = 700;

interface TitleScreenProps {
  readonly onStart: () => void;
  /** Tests use a tiny value. */
  readonly timeScale?: number;
}

/**
 * "INSERT COIN" title, once per page load (owner decision 2026-10-10). The press is also the
 * user gesture browsers require before any sound can play.
 */
export function TitleScreen({ onStart, timeScale = 1 }: TitleScreenProps) {
  const { engine } = useSound();
  const [credit, setCredit] = useState(false);
  const started = useRef(false);
  const onStartRef = useRef(onStart);
  useEffect(() => {
    onStartRef.current = onStart;
  });

  function insertCoin() {
    if (started.current) return;
    started.current = true;
    engine.unlock();
    setCredit(true);
    setTimeout(() => engine.sfx('coin'), 30);
    setTimeout(() => onStartRef.current(), COIN_TO_START_MS * timeScale);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.repeat || event.key === 'Tab') return;
      event.preventDefault();
      insertCoin();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  return (
    <main className="title-screen" aria-label="Title">
      <div className="title-screen__inner">
        <h1 className="title__logo title-screen__logo">King of Fate</h1>
        <p className="title-screen__edition">Office Arcade Edition</p>
        <div className="title-screen__crowd" aria-hidden="true">
          {CROWD.map((seed) => (
            <FighterSprite key={seed} seed={seed} size={64} idle />
          ))}
        </div>
        <button
          type="button"
          className={`title-screen__coin${credit ? ' title-screen__coin--credit' : ''}`}
          onClick={insertCoin}
        >
          {credit ? 'Credit 01' : 'Insert coin'}
        </button>
        <p className="title-screen__hint">Press any key or click to start</p>
        <p className="title-screen__credit" aria-hidden="true">
          Credit {credit ? '01' : '00'}
        </p>
      </div>
    </main>
  );
}
