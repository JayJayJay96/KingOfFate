/** Thrown when an action is not allowed in the current match phase. */
export class IllegalTransitionError extends Error {
  override name = 'IllegalTransitionError';
}
