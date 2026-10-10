import { FATE_PRESETS } from '../config/presets';
import { countSlots } from './fateSlots';
import type {
  CommittedDuel,
  FinaleRoundResult,
  MatchEvent,
  MatchState,
  TurnOutcome,
} from './matchTypes';
import type { Gesture } from './rps';

export const GESTURE_LABEL: Readonly<Record<Gesture, string>> = {
  ROCK: 'Rock',
  PAPER: 'Paper',
  SCISSORS: 'Scissors',
};

/**
 * Log line for an event, or null for internal events. TURN_COMMITTED is internal on purpose:
 * showing it would spoil the outcome before the reveal animation finishes. Shuffles are hidden
 * at the owner's request (kept in state for audit).
 */
export function describeEvent(event: MatchEvent, state: MatchState): string | null {
  const nameOf = (id: string) => state.players.find((p) => p.id === id)?.name ?? 'Unknown';
  switch (event.type) {
    case 'MATCH_STARTED':
      return `Match started: ${event.playerIds.length} fighters, ${event.winnerCount} winner${
        event.winnerCount === 1 ? '' : 's'
      }, ${FATE_PRESETS[event.presetId].label} preset.`;
    case 'TURN_COMMITTED':
    case 'POSITIONS_SHUFFLED':
    case 'FINALE_ROUND_COMMITTED':
      return null;
    case 'TURN_RESOLVED':
      return `Turn ${event.turnNumber}: ${describeOutcome(event.outcome, event.playerId, event.duel, nameOf)}`;
    case 'SUDDEN_DEATH_STARTED': {
      const c = countSlots(event.fateSlots);
      const shattered =
        event.shatteredIds.length > 0
          ? ` Shields shatter (${joinNames(event.shatteredIds.map(nameOf))}).`
          : '';
      return `SUDDEN DEATH! Only ${event.aliveCount} fighters left.${shattered} No more Shields. Fate is now KO ${c.KO * 5}% · VS ${c.VS * 5}%.`;
    }
    case 'SHIELD_SUPPLY_EXHAUSTED':
      return 'The last Shield has been taken! Shield slots turn into KO.';
    case 'SHIELDS_CLEARED':
      return `Finale rules: all Shields removed (${joinNames(event.playerIds.map(nameOf))}).`;
    case 'FINALE_REACHED':
      return `Finale! ${joinNames(event.finalistIds.map(nameOf))} advance.`;
    case 'FINALE_STARTED':
      return '1, 2, Juice! The finale begins: first to 3 points takes a winner slot.';
    case 'FINALE_ROUND_RESOLVED':
      return describeFinaleRound(event.round, nameOf);
    case 'FINALISTS_QUALIFIED': {
      const names = joinNames(event.playerIds.map(nameOf));
      const many = event.playerIds.length > 1;
      return event.automatic
        ? `${names} ${many ? 'take' : 'takes'} the last slot${many ? 's' : ''} automatically.`
        : `${names} ${many ? 'reach' : 'reaches'} 3 and ${many ? 'take winner slots' : 'takes a winner slot'}!`;
    }
    case 'TIEBREAK_STARTED':
      return `TIEBREAK! ${joinNames(event.contenderIds.map(nameOf))} reached 3 together for ${event.slots} slot${event.slots === 1 ? '' : 's'}. Their scores reset; everyone else is out.`;
    case 'MATCH_COMPLETED':
      return `${event.winnerIds.length === 1 ? 'Winner' : 'Winners'}: ${joinNames(event.winnerIds.map(nameOf))}!`;
  }
}

export function describeFinaleRound(
  round: FinaleRoundResult,
  nameOf: (id: string) => string,
): string {
  const prefix = `${round.stageNumber > 1 ? 'Tiebreak ' : ''}Round ${round.roundNumber}:`;
  if (!round.winningGesture) {
    const kinds = new Set(round.throws.map((t) => t.gesture));
    return kinds.size === 1
      ? `${prefix} draw, everyone threw ${GESTURE_LABEL[round.throws[0]!.gesture]}.`
      : `${prefix} draw, Rock, Paper and Scissors all thrown.`;
  }
  const loser = round.throws.find((t) => t.gesture !== round.winningGesture)!.gesture;
  return `${prefix} ${GESTURE_LABEL[round.winningGesture]} beats ${GESTURE_LABEL[loser]}, +1 for ${joinNames(round.scorerIds.map(nameOf))}.`;
}

export function describeOutcome(
  outcome: TurnOutcome,
  playerId: string,
  duel: CommittedDuel | null,
  nameOf: (id: string) => string,
): string {
  const name = nameOf(playerId);
  switch (outcome.fate) {
    case 'KO':
      return outcome.result === 'ELIMINATED'
        ? `${name} takes a KO. Eliminated!`
        : `${name} takes a KO, but the Shield absorbs it.`;
    case 'SHIELD':
      return outcome.result === 'GAINED'
        ? `${name} gains a Shield.`
        : `${name} already has a Shield. Wasted!`;
    case 'VS': {
      const opponent = nameOf(duel?.opponentId ?? '');
      const last = duel?.throws.at(-1);
      const draws = (duel?.throws.length ?? 1) - 1;
      const winnerHand = last
        ? GESTURE_LABEL[outcome.winnerId === playerId ? last.challenger : last.opponent]
        : '';
      const loserHand = last
        ? GESTURE_LABEL[outcome.winnerId === playerId ? last.opponent : last.challenger]
        : '';
      const drawText = draws > 0 ? ` after ${draws} draw${draws === 1 ? '' : 's'}` : '';
      const loss =
        outcome.loserResult === 'ELIMINATED'
          ? `${nameOf(outcome.loserId)} is eliminated!`
          : `${nameOf(outcome.loserId)}'s Shield absorbs the loss.`;
      const reward =
        outcome.winnerShield === 'GAINED'
          ? ` ${nameOf(outcome.winnerId)} earns a Shield.`
          : outcome.winnerShield === 'SUDDEN_DEATH'
            ? ' No Shield reward in Sudden Death.'
            : outcome.winnerShield === 'NO_SUPPLY'
              ? ' No Shields left to earn.'
              : '';
      return `${name} VS ${opponent}: ${winnerHand} beats ${loserHand}${drawText}. ${nameOf(outcome.winnerId)} wins; ${loss}${reward}`;
    }
  }
}

function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
