import { useState } from 'react';
import type { SoundEngine } from '../audio/soundEngine';
import { SoundProvider } from '../audio/SoundProvider';
import { HistoryScreen, type Downloader } from '../components/history/HistoryScreen';
import { MatchScreen } from '../components/match/MatchScreen';
import { SetupScreen } from '../components/setup/SetupScreen';
import { TitleScreen } from '../components/TitleScreen';
import { createCryptoRng, type Rng } from '../game/rng/rng';
import { activeParticipants } from '../game/setup/roster';
import { validateSetup } from '../game/setup/validation';
import { useMatch } from '../hooks/useMatch';
import { useSetupConfig } from '../hooks/useSetupConfig';
import type { AssetStore } from '../storage/assetStorage';
import { createIndexedDbMatchRepository, type MatchRepository } from '../storage/matchStorage';

export interface AppProps {
  /** Injection points for tests; production uses IndexedDB, crypto RNG and the approved timing. */
  readonly matchRepository?: MatchRepository;
  readonly rng?: Rng;
  /** Multiplies all spin timings; tests use a tiny value. Production: 1. */
  readonly timeScale?: number;
  readonly soundEngine?: SoundEngine;
  readonly assetStore?: AssetStore;
  /** Export file saver; tests capture files instead of downloading. */
  readonly download?: Downloader;
  /** "INSERT COIN" title once per page load. Tests that are not about it turn it off. */
  readonly titleScreen?: boolean;
}

export function App({ soundEngine, assetStore, ...rest }: AppProps) {
  return (
    <SoundProvider engine={soundEngine} assets={assetStore}>
      <Game {...rest} />
    </SoundProvider>
  );
}

function Game({
  matchRepository,
  rng,
  timeScale = 1,
  download,
  titleScreen = true,
}: Pick<AppProps, 'matchRepository' | 'rng' | 'timeScale' | 'download' | 'titleScreen'>) {
  const [repository] = useState(() => matchRepository ?? createIndexedDbMatchRepository());
  const [matchRng] = useState(() => rng ?? createCryptoRng());
  const setup = useSetupConfig();
  const game = useMatch(repository, matchRng);
  const [showHistory, setShowHistory] = useState(false);
  const [coinInserted, setCoinInserted] = useState(!titleScreen);

  function handleStart() {
    const { config } = setup;
    if (!validateSetup(config).canStart) return;
    void game.start({
      players: activeParticipants(config.roster).map(({ id, name }) => ({ id, name })),
      winnerCount: config.winnerCount,
      presetId: config.presetId,
    });
  }

  if (!coinInserted) {
    return <TitleScreen onStart={() => setCoinInserted(true)} timeScale={timeScale} />;
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
        onBeginFinale={() => void game.beginFinale()}
        onNextFinaleRound={() => void game.nextFinaleRound()}
        onResolveFinaleRound={(roundId) => void game.completeFinaleRound(roundId)}
        onLeave={() => void game.leave()}
      />
    );
  }

  if (showHistory) {
    return (
      <HistoryScreen
        repository={repository}
        onBack={() => setShowHistory(false)}
        download={download}
      />
    );
  }

  return (
    <SetupScreen
      store={setup}
      onStart={handleStart}
      onOpenHistory={() => setShowHistory(true)}
      matchNotice={game.notice ?? game.saveError}
    />
  );
}
