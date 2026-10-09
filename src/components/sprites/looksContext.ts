import { createContext } from 'react';
import { isFighterLook, type FighterLook } from '../../game/config/looks';

/**
 * Custom looks of the people currently on screen, keyed by name (names are unique within a
 * roster/match, D5). Sprites without an entry use the neutral look derived from the name.
 */
export const LooksContext = createContext<ReadonlyMap<string, FighterLook>>(new Map());

export const lookKey = (name: string) => name.trim().toLowerCase();

export function looksByName(
  people: readonly { readonly name: string; readonly look?: FighterLook | null }[],
): ReadonlyMap<string, FighterLook> {
  const map = new Map<string, FighterLook>();
  for (const p of people) if (p.look && isFighterLook(p.look)) map.set(lookKey(p.name), p.look);
  return map;
}
