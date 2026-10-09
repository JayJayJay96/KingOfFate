/** Immutable internal participant/match IDs. Names are never used as identity. */
export function createId(): string {
  return crypto.randomUUID();
}
