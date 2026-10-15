import { useMemo, useState } from 'react';
import type { SoundEngine } from '../audio/soundEngine';
import { SoundProvider } from '../audio/SoundProvider';
import { HistoryScreen, type Downloader } from '../components/history/HistoryScreen';
import { MatchScreen } from '../components/match/MatchScreen';
import { LooksContext, looksByName } from '../components/sprites/looksContext';
import { StageBackdrop } from '../components/stage/StageArt';
import { StageContext } from '../components/stage/stageContext';
import { stageForMatch } from '../game/config/stages';
import { SetupScreen } from '../components/setup/SetupScreen';
import { TitleScreen } from '../components/TitleScreen';
import { createCryptoRng, type Rng } from '../game/rng/rng';
import { lastChampionNames } from '../game/history/history';
import { activeParticipants, nameKey } from '../game/setup/roster';
import { validateSetup } from '../game/setup/validation';
import { useMatch } from '../hooks/useMatch';
import { useOtherTabWarning } from '../hooks/useOtherTabWarning';
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

type GameProps = Pick<
  AppProps,
  'matchRepository' | 'rng' | 'timeScale' | 'download' | 'titleScreen'
>;

/** Screens, plus a warning when the game is open in another tab (both would share one save). */
function Game(props: GameProps) {
  const otherTab = useOtherTabWarning();
  return (
    <>
      {otherTab && (
        <p className="tab-warning" role="alert">
          King of Fate is also open in another tab. Play in one tab only: both share the same saved
          match.
        </p>
      )}
      <Screens {...props} />
    </>
  );
}

function Screens({ matchRepository, rng, timeScale = 1, download, titleScreen = true }: GameProps) {
  const [repository] = useState(() => matchRepository ?? createIndexedDbMatchRepository());
  const [matchRng] = useState(() => rng ?? createCryptoRng());
  const setup = useSetupConfig();
  const game = useMatch(repository, matchRng);
  const [showHistory, setShowHistory] = useState(false);
  const [coinInserted, setCoinInserted] = useState(!titleScreen);
  const matchPlayers = game.match?.players;
  const matchLooks = useMemo(() => looksByName(matchPlayers ?? []), [matchPlayers]);
  const roster = setup.config.roster;
  const rosterLooks = useMemo(() => looksByName(roster), [roster]);

  async function handleStart() {
    const { config } = setup;
    if (!validateSetup(config).canStart) return;
    const players = activeParticipants(config.roster);
    // Last match's winners wear a crown (owner request 2026-10-16); history problems never block.
    const champions = new Set(
      lastChampionNames(await repository.listCompleted().catch(() => [])).map(nameKey),
    );
    await game.start({
      players: players.map(({ id, name, look }) => (look ? { id, name, look } : { id, name })),
      winnerCount: config.winnerCount,
      presetId: config.presetId,
      title: config.title,
      championIds: players.filter((p) => champions.has(nameKey(p.name))).map((p) => p.id),
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
    const stage = stageForMatch(setup.config.stage, game.match.matchId);
    return (
      <StageContext.Provider value={stage}>
        <LooksContext.Provider value={matchLooks}>
          <StageBackdrop stage={stage} />
          <MatchScreen
            match={game.match}
            timeScale={timeScale}
            turbo={setup.config.turbo}
            saveError={game.saveError}
            onSpin={() => void game.spin()}
            onShuffle={() => void game.shuffle()}
            onSpinComplete={(turnId) => void game.completeSpin(turnId)}
            onBeginFinale={() => void game.beginFinale()}
            onNextFinaleRound={() => void game.nextFinaleRound()}
            onResolveFinaleRound={(roundId) => void game.completeFinaleRound(roundId)}
            onLeave={() => void game.leave()}
          />
        </LooksContext.Provider>
      </StageContext.Provider>
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
    <LooksContext.Provider value={rosterLooks}>
      <SetupScreen
        store={setup}
        onStart={() => void handleStart()}
        onOpenHistory={() => setShowHistory(true)}
        matchNotice={game.notice ?? game.saveError}
      />
    </LooksContext.Provider>
  );
}
