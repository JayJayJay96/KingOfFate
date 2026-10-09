import type { MatchState, NewMatchEvent } from './matchTypes';

/** Appends an event with a deterministic, unique id: `${matchId}#${seq}`. */
export function appendEvent(state: MatchState, event: NewMatchEvent): MatchState {
  const seq = state.events.length + 1;
  return { ...state, events: [...state.events, { ...event, id: `${state.matchId}#${seq}`, seq }] };
}
