import { FATE_PRESETS } from '../config/presets';
import type { MatchEvent, MatchState } from './matchTypes';

/**
 * Log line for an event, or null for internal events. TURN_COMMITTED is internal on purpose:
 * showing it would spoil the outcome before the reveal animation finishes.
 */
export function describeEvent(event: MatchEvent, state: MatchState): string | null {
  const nameOf = (id: string) => state.players.find((p) => p.id === id)?.name ?? 'Unknown';
  switch (event.type) {
    case 'MATCH_STARTED':
      return `Match started: ${event.playerIds.length} fighters, ${event.winnerCount} winner${
        event.winnerCount === 1 ? '' : 's'
      }, ${FATE_PRESETS[event.presetId].label} preset.`;
    case 'TURN_COMMITTED':
      return null;
    case 'PLAYER_ELIMINATED':
      return `Turn ${event.turnNumber}: ${nameOf(event.playerId)} takes a KO. Eliminated!`;
    case 'FINALE_REACHED':
      return `Finale! ${joinNames(event.finalistIds.map(nameOf))} advance.`;
    case 'PLAYERS_SHUFFLED':
      return null; // kept for audit, hidden from the visible log (owner preference)
  }
}

function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
