import { useMemo, useState } from 'react';
import {
  createOfficeClient,
  describeOfficeError,
  officeServerFromEnv,
  type OfficeClient,
} from '../office/officeClient';
import { createOfficeMatchRepository } from '../office/officeRepository';
import {
  loadOfficeSettings,
  saveOfficeSettings,
  type OfficeSettings,
} from '../office/officeSettings';
import { createOfficeStatusStore, useOfficeStatus } from '../office/officeStatus';
import type { SoundEngine } from '../audio/soundEngine';
import { SoundProvider } from '../audio/SoundProvider';
import { HistoryScreen, type Downloader } from '../components/history/HistoryScreen';
import { MatchScreen } from '../components/match/MatchScreen';
import { LooksContext, looksByName } from '../components/sprites/looksContext';
import { StageBackdrop } from '../components/stage/StageArt';
import { StageContext } from '../components/stage/stageContext';
import { stageForMatch } from '../game/config/stages';
import { OfficePanel } from '../components/setup/OfficePanel';
import { SetupScreen } from '../components/setup/SetupScreen';
import { TitleScreen } from '../components/TitleScreen';
import { createCryptoRng, type Rng } from '../game/rng/rng';
import { lastChampionNames } from '../game/history/history';
import { activeParticipants, nameKey } from '../game/setup/roster';
import { validateSetup } from '../game/setup/validation';
import { useFairSitOut } from '../hooks/useFairSitOut';
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
  /** Office server; production builds it from the Vercel environment (null = not set up). */
  readonly officeClient?: OfficeClient | null;
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
  'matchRepository' | 'rng' | 'timeScale' | 'download' | 'titleScreen' | 'officeClient'
>;

const envServer = officeServerFromEnv();

/** Screens, plus a warning when the game is open in another tab (both would share one save). */
function Game({ officeClient, ...props }: GameProps) {
  const otherTab = useOtherTabWarning();
  // Once per page load, also across a Personal/Office switch.
  const [coinInserted, setCoinInserted] = useState(false);
  const [client] = useState(() =>
    officeClient !== undefined ? officeClient : envServer && createOfficeClient(envServer),
  );
  const [officeSettings, setOfficeSettings] = useState(loadOfficeSettings);
  const settings = client ? officeSettings : { mode: 'personal' as const, code: '' };
  const changeOffice = (next: OfficeSettings) => {
    saveOfficeSettings(next);
    setOfficeSettings(next);
  };
  return (
    <>
      {otherTab && (
        <p className="tab-warning" role="alert">
          King of Fate is also open in another tab. Play in one tab only: both share the same saved
          match.
        </p>
      )}
      {/* A mode or code change starts the screens afresh on the other storage. */}
      <Screens
        key={`${settings.mode}:${settings.code}`}
        {...props}
        client={client}
        officeSettings={settings}
        onOfficeChange={changeOffice}
        coinAlreadyInserted={coinInserted}
        onCoinInserted={() => setCoinInserted(true)}
      />
    </>
  );
}

interface ScreensProps extends Omit<GameProps, 'officeClient'> {
  readonly client: OfficeClient | null;
  readonly officeSettings: OfficeSettings;
  readonly onOfficeChange: (settings: OfficeSettings) => void;
  readonly coinAlreadyInserted: boolean;
  readonly onCoinInserted: () => void;
}

function Screens({
  matchRepository,
  rng,
  timeScale = 1,
  download,
  titleScreen = true,
  client,
  officeSettings,
  onOfficeChange,
  coinAlreadyInserted,
  onCoinInserted,
}: ScreensProps) {
  const [office] = useState(() =>
    client && officeSettings.mode === 'office'
      ? { client, code: officeSettings.code, status: createOfficeStatusStore() }
      : undefined,
  );
  const [repository] = useState(() => {
    const local =
      matchRepository ?? createIndexedDbMatchRepository(undefined, office ? 'kof-office' : 'kof');
    return office
      ? createOfficeMatchRepository(local, office.client, office.code, office.status)
      : local;
  });
  const officeStatus = useOfficeStatus(office?.status ?? null);
  const [matchRng] = useState(() => rng ?? createCryptoRng());
  const setup = useSetupConfig(office);
  const game = useMatch(repository, matchRng);
  const [showHistory, setShowHistory] = useState(false);
  const coinInserted = coinAlreadyInserted || !titleScreen;
  const matchPlayers = game.match?.players;
  const matchLooks = useMemo(() => looksByName(matchPlayers ?? []), [matchPlayers]);
  const roster = setup.config.roster;
  const rosterLooks = useMemo(() => looksByName(roster), [roster]);
  const setupVisible = coinInserted && !game.loading && !game.match && !showHistory;
  const sitOut = useFairSitOut(repository, setup, setupVisible);

  /** Office mode: copies this PC's Personal history to the office (results are never replaced). */
  async function uploadPersonalHistory() {
    if (!office) return '';
    const records = await createIndexedDbMatchRepository().listCompleted();
    if (records.length === 0) return 'This PC has no Personal history to upload.';
    const result = await office.client.putMatches(office.code, records, 'add');
    if (!result.ok) throw new Error(describeOfficeError(result.error));
    return `Uploaded ${records.length} match${records.length === 1 ? '' : 'es'} (ones already in the office were kept).`;
  }

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
      ...(config.presetId === 'custom' ? { customOdds: config.customOdds } : {}),
      title: config.title,
      championIds: players.filter((p) => champions.has(nameKey(p.name))).map((p) => p.id),
    });
  }

  if (!coinInserted) {
    return <TitleScreen onStart={onCoinInserted} timeScale={timeScale} />;
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
        office={!!office}
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
        sitOut={sitOut}
        office={
          <OfficePanel
            settings={officeSettings}
            client={client}
            status={officeStatus}
            sync={setup.office}
            onChange={onOfficeChange}
            onUploadPersonalHistory={matchRepository ? undefined : uploadPersonalHistory}
          />
        }
      />
    </LooksContext.Provider>
  );
}
