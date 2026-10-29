/**
 * Office mode server calls (owner decision 2026-10-29): Supabase Postgres functions from
 * supabase/office.sql, called over the REST API with the public key. The office code is checked
 * on the server; the public key alone can read or write nothing.
 */
export type OfficeError = 'offline' | 'code' | 'conflict' | 'invalid';

export type OfficeFailure = {
  readonly ok: false;
  readonly error: OfficeError;
  /** On 'conflict': the office copy that won. */
  readonly setup?: unknown;
  readonly version?: number;
};

export type OfficeResult<T> = ({ readonly ok: true } & T) | OfficeFailure;

export type PutMode = 'add' | 'upsert' | 'replace';

export interface OfficeClient {
  getSetup(code: string): Promise<OfficeResult<{ setup: unknown; version: number }>>;
  saveSetup(
    code: string,
    setup: unknown,
    baseVersion: number,
  ): Promise<OfficeResult<{ version: number }>>;
  listMatches(code: string): Promise<OfficeResult<{ matches: unknown[] }>>;
  putMatches(
    code: string,
    records: readonly unknown[],
    mode: PutMode,
  ): Promise<OfficeResult<object>>;
  deleteMatch(code: string, matchId: string): Promise<OfficeResult<object>>;
  changeCode(code: string, newCode: string): Promise<OfficeResult<object>>;
}

export interface OfficeServer {
  readonly url: string;
  readonly key: string;
}

/** Build-time settings from Vercel environment variables; null when Office mode is not set up. */
export function officeServerFromEnv(
  env: Record<string, unknown> = import.meta.env,
): OfficeServer | null {
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_ANON_KEY;
  if (typeof url !== 'string' || typeof key !== 'string' || !url || !key) return null;
  return { url: url.replace(/\/+$/, ''), key };
}

/** Retries a few times on network and server errors before reporting "offline". */
export const RETRY_DELAYS_MS = [400, 1200];

export function createOfficeClient(
  server: OfficeServer,
  fetchImpl: typeof fetch = (...args) => fetch(...args),
  delays: readonly number[] = RETRY_DELAYS_MS,
): OfficeClient {
  async function rpc<T>(name: string, args: Record<string, unknown>): Promise<OfficeResult<T>> {
    for (let attempt = 0; ; attempt++) {
      try {
        const response = await fetchImpl(`${server.url}/rest/v1/rpc/${name}`, {
          method: 'POST',
          // The public key goes on the apikey header only (Supabase docs: not a bearer token).
          headers: { apikey: server.key, 'Content-Type': 'application/json' },
          body: JSON.stringify(args),
        });
        if (response.ok) {
          const body = (await response.json()) as Record<string, unknown> | null;
          if (body?.ok === true) return body as OfficeResult<T>;
          const error =
            body?.error === 'code' || body?.error === 'conflict' ? body.error : 'invalid';
          return { ...body, ok: false, error };
        }
        // A 4xx other than rate limiting will not get better by retrying.
        if (response.status < 500 && response.status !== 429) {
          return { ok: false, error: 'invalid' };
        }
      } catch {
        // Network error: retry below.
      }
      if (attempt >= delays.length) return { ok: false, error: 'offline' };
      await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
    }
  }

  return {
    getSetup: (code) => rpc('kof_get_setup', { p_code: code }),
    saveSetup: (code, setup, baseVersion) =>
      rpc('kof_save_setup', { p_code: code, p_setup: setup, p_base_version: baseVersion }),
    listMatches: (code) => rpc('kof_list_matches', { p_code: code }),
    putMatches: (code, records, mode) =>
      rpc('kof_put_matches', { p_code: code, p_records: records, p_mode: mode }),
    deleteMatch: (code, matchId) => rpc('kof_delete_match', { p_code: code, p_match_id: matchId }),
    changeCode: (code, newCode) => rpc('kof_change_code', { p_code: code, p_new_code: newCode }),
  };
}

export function describeOfficeError(error: OfficeError): string {
  switch (error) {
    case 'offline':
      return 'The office server could not be reached.';
    case 'code':
      return 'The office code was refused (wrong code, or too many wrong tries: wait 15 minutes).';
    case 'conflict':
      return 'Another host changed the office setup at the same time.';
    default:
      return 'The office server refused the request.';
  }
}
