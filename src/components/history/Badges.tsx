import { BADGES, type BadgeId } from '../../game/history/awards';

/** Badge chips: emoji + name (+ ×count), with the rule as a tooltip. */
export function BadgeList({
  items,
  compact = false,
}: {
  readonly items: readonly { readonly badge: BadgeId; readonly count?: number }[];
  /** Emoji only (for table cells); the name stays available to screen readers. */
  readonly compact?: boolean;
}) {
  if (items.length === 0) return compact ? null : <p className="empty">No badges yet.</p>;
  return (
    <ul className={compact ? 'badge-list badge-list--compact' : 'badge-list'}>
      {items.map(({ badge, count }) => {
        const b = BADGES[badge];
        const times = count && count > 1 ? ` ×${count}` : '';
        return (
          <li key={badge} className="badge-chip" title={`${b.name}: ${b.text}`}>
            <span aria-hidden="true">{b.emoji}</span>
            {compact ? (
              <span className="sr-only">
                {b.name}
                {times}
              </span>
            ) : (
              <span>
                {b.name}
                {times}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
