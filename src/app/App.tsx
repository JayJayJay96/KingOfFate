import { useState } from 'react';
import { MatchPlaceholder, type MatchLaunch } from '../components/MatchPlaceholder';
import { SetupScreen } from '../components/setup/SetupScreen';
import { activeParticipants } from '../game/setup/roster';
import { validateSetup } from '../game/setup/validation';
import { useSetupConfig } from '../hooks/useSetupConfig';

export function App() {
  const store = useSetupConfig();
  const [launch, setLaunch] = useState<MatchLaunch | null>(null);

  function handleStart() {
    const { config } = store;
    if (!validateSetup(config).canStart) return;
    setLaunch({
      players: activeParticipants(config.roster),
      winnerCount: config.winnerCount,
      presetId: config.presetId,
    });
  }

  if (launch) return <MatchPlaceholder launch={launch} onBack={() => setLaunch(null)} />;
  return <SetupScreen store={store} onStart={handleStart} />;
}
