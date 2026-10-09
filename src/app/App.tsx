import { useState } from 'react';
import { MatchScreen } from '../components/match/MatchScreen';
import { SetupScreen } from '../components/setup/SetupScreen';
import { REVEAL_HOLD_MS, SPIN_DURATION_MS } from '../game/config/timing';
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
  readonly spinDurationMs?: number;
  readonly revealHoldMs?: number;
}

export function App({
  matchRepository,
  rng,
  spinDurationMs = SPIN_DURATION_MS,
  revealHoldMs = REVEAL_HOLD_MS,
}: AppProps) {
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
        spinDurationMs={spinDurationMs}
        revealHoldMs={revealHoldMs}
        saveError={game.saveError}
        onSpin={() => void game.spin()}
        onSpinComplete={(turnId) => void game.completeSpin(turnId)}
        onLeave={() => void game.leave()}
      />
    );
  }

  return (
    <SetupScreen store={setup} onStart={handleStart} matchNotice={game.notice ?? game.saveError} />
  );
}
