import { useState } from 'react';

interface ConfirmButtonProps {
  readonly label: string;
  /** Question shown after the first click. */
  readonly question: string;
  readonly confirmLabel: string;
  readonly onConfirm: () => void;
  readonly disabled?: boolean;
}

/** Two-step destructive action: first click asks, second click acts. No browser dialogs. */
export function ConfirmButton({
  label,
  question,
  confirmLabel,
  onConfirm,
  disabled = false,
}: ConfirmButtonProps) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <button
        type="button"
        className="button button--small button--danger"
        disabled={disabled}
        onClick={() => setAsking(true)}
      >
        {label}
      </button>
    );
  }
  return (
    <div className="confirm" role="group" aria-label={question}>
      <p className="confirm__question">{question}</p>
      <button
        type="button"
        className="button button--small button--danger"
        onClick={() => {
          setAsking(false);
          onConfirm();
        }}
      >
        {confirmLabel}
      </button>
      <button type="button" className="button button--small" onClick={() => setAsking(false)}>
        Cancel
      </button>
    </div>
  );
}
