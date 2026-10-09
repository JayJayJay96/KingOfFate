import { useState } from 'react';
import { MatchScreen } from '../components/match/MatchScreen';
import { SetupScreen } from '../components/setup/SetupScreen';
import { createCryptoRng, type Rng } from '../game/rng/rng';
import { activeParticipants } from '../game/setup/roster';
import { validateSetup } from '../game/setup/validation';
import { useMatch } from '../hooks/useMatch';
import { useSetupConfig } from '../hooks/useSetupConfig';
import { createIndexedDbMatchRepository, type MatchRepository } from '../storage/matchStorage';

export interface AppProps {
  /** Injection points for tests; production uses IndexedDB, crypto RNG and the approved timing. */
  readonly matchRepository?: MatchRepository;
  readonly rng?: Rng;
  /** Multiplies all spin timings; tests use a tiny value. Production: 1. */
  readonly timeScale?: number;
}

export function App({ matchRepository, rng, timeScale = 1 }: AppProps) {
  const [repository] = useState(() => matchRepository ?? createIndexedDbMatchRepository());
  const [matchRng] = useState(() => rng ?? createCryptoRng());
  const setup = useSetupConfig();
  const game = useMatch(repository, matchRng);

  function handleStart() {
    const { config } = setup;
    if (!validateSetup(config).canStart) return;
    void game.start({
      players: activeParticipants(config.roster).map(({ id, name }) => ({ id, name })),
      winnerCount: config.winnerCount,
      presetId: config.presetId,
    });
  }

  if (game.loading) {
    return (
      <main className="loading" aria-busy="true">
        Loading…
      </main>
    );
  }

  if (game.match) {
    return (
      <MatchScreen
        match={game.match}
        timeScale={timeScale}
        saveError={game.saveError}
        onSpin={() => void game.spin()}
        onShuffle={() => void game.shuffle()}
        onSpinComplete={(turnId) => void game.completeSpin(turnId)}
        onLeave={() => void game.leave()}
      />
    );
  }

  return (
    <SetupScreen store={setup} onStart={handleStart} matchNotice={game.notice ?? game.saveError} />
  );
}
