import { useId, useState } from 'react';
import type { SetupStore } from '../../hooks/useSetupConfig';
import { describeOfficeError, type OfficeClient } from '../../office/officeClient';
import { DEFAULT_OFFICE_CODE, type OfficeSettings } from '../../office/officeSettings';
import type { OfficeStatus } from '../../office/officeStatus';

interface OfficePanelProps {
  readonly settings: OfficeSettings;
  /** null when this site has no office server set up. */
  readonly client: OfficeClient | null;
  readonly status: OfficeStatus | null;
  readonly sync?: SetupStore['office'];
  readonly onChange: (settings: OfficeSettings) => void;
  /** Uploads this PC's Personal history to the office; resolves to a report line. */
  readonly onUploadPersonalHistory?: () => Promise<string>;
}

/** Personal (this PC) or Office (shared server) storage, per PC (owner decision 2026-10-29). */
export function OfficePanel({
  settings,
  client,
  status,
  sync,
  onChange,
  onUploadPersonalHistory,
}: OfficePanelProps) {
  const titleId = useId();
  const office = settings.mode === 'office';
  const [code, setCode] = useState(settings.code || DEFAULT_OFFICE_CODE);
  const [newCode, setNewCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function connect() {
    if (!client) return;
    setBusy(true);
    setMessage(null);
    const result = await client.getSetup(code.trim());
    setBusy(false);
    if (result.ok) onChange({ mode: 'office', code: code.trim() });
    else setMessage({ ok: false, text: describeOfficeError(result.error) });
  }

  async function changeCode() {
    if (!client) return;
    setBusy(true);
    const result = await client.changeCode(settings.code, newCode.trim());
    setBusy(false);
    if (result.ok) {
      setNewCode('');
      onChange({ mode: 'office', code: newCode.trim() });
    } else {
      setMessage({
        ok: false,
        text:
          result.error === 'invalid'
            ? 'The new code needs 6 to 64 characters.'
            : describeOfficeError(result.error),
      });
    }
  }

  async function uploadHistory() {
    if (!onUploadPersonalHistory) return;
    setBusy(true);
    try {
      setMessage({ ok: true, text: await onUploadPersonalHistory() });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  const pending = status?.pending ?? 0;
  return (
    <section className="panel office-panel" aria-labelledby={titleId}>
      <h2 id={titleId} className="panel__title">
        Saved where
      </h2>
      {!office ? (
        <>
          <p className="hint">
            <strong>Personal:</strong> roster, settings and history are saved on this PC only.
          </p>
          {client ? (
            <div className="office-panel__form">
              <label className="title-input">
                <span>Office code</span>
                <input
                  type="password"
                  autoComplete="off"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </label>
              <button
                type="button"
                className="button button--small"
                disabled={busy || !code.trim()}
                onClick={() => void connect()}
              >
                Switch to Office
              </button>
              <p className="hint">
                Office shares the roster, looks, settings, history and fair sit-outs with every PC
                that uses the code. Sound settings and music stay on each PC.
              </p>
            </div>
          ) : (
            <p className="hint">Office mode is not set up on this site yet.</p>
          )}
        </>
      ) : (
        <>
          <p className="hint" data-testid="office-state">
            <strong>Office:</strong>{' '}
            {status?.link === 'offline'
              ? 'the office server cannot be reached. Using this PC’s copy.'
              : status?.link === 'code'
                ? 'the office code was refused.'
                : 'shared with every PC that uses the office code.'}
            {pending > 0 &&
              ` ${pending} result${pending === 1 ? '' : 's'} waiting to upload (sent automatically).`}
          </p>
          {sync?.state === 'conflict' || sync?.state === 'diverged' ? (
            <div className="confirm" role="group" aria-label="Setup differs from the office">
              <p className="confirm__question">
                {sync.state === 'conflict'
                  ? 'Another host changed the office setup while you were editing.'
                  : 'You changed the setup while the office server was unreachable.'}{' '}
                Which setup should everyone use?
              </p>
              <button type="button" className="button button--small" onClick={sync.uploadMine}>
                Upload my setup
              </button>
              <button type="button" className="button button--small" onClick={sync.useOffice}>
                Use office setup
              </button>
            </div>
          ) : (
            sync?.state === 'offline' && (
              <p className="hint">Setup changes are saved on this PC until the server is back.</p>
            )
          )}
          <div className="toolbar">
            {onUploadPersonalHistory && (
              <button
                type="button"
                className="button button--small"
                disabled={busy}
                onClick={() => void uploadHistory()}
              >
                Upload this PC’s history
              </button>
            )}
            <button
              type="button"
              className="button button--small"
              onClick={() => onChange({ mode: 'personal', code: '' })}
            >
              Switch to Personal
            </button>
          </div>
          <div className="office-panel__form">
            <label className="title-input">
              <span>New office code</span>
              <input
                type="password"
                autoComplete="new-password"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="button button--small"
              disabled={busy || newCode.trim().length < 6}
              onClick={() => void changeCode()}
            >
              Change code
            </button>
          </div>
        </>
      )}
      {message && (
        <p className={message.ok ? 'hint' : 'hint office-panel__error'} role="status">
          {message.text}
        </p>
      )}
    </section>
  );
}
