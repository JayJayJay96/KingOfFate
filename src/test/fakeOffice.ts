/**
 * In-memory stand-in for the supabase/office.sql functions (same arguments and replies), used by
 * unit tests and by the E2E suite behind a routed request. No app imports: the E2E (Node) loads it.
 */
export function createFakeOfficeServer(code = '116059') {
  const state = {
    code,
    online: true,
    setup: null as unknown,
    version: 0,
    matches: new Map<string, { matchId: string; completedAt: string }>(),
    calls: [] as string[],
  };

  function handle(name: string, args: Record<string, unknown>): Record<string, unknown> {
    state.calls.push(name);
    if (args.p_code !== state.code) return { ok: false, error: 'code' };
    switch (name) {
      case 'kof_get_setup':
        return { ok: true, setup: state.setup, version: state.version };
      case 'kof_save_setup':
        if (args.p_base_version !== state.version) {
          return { ok: false, error: 'conflict', setup: state.setup, version: state.version };
        }
        state.setup = structuredClone(args.p_setup);
        state.version++;
        return { ok: true, version: state.version };
      case 'kof_list_matches':
        return {
          ok: true,
          matches: [...state.matches.values()]
            .sort((a, b) => a.completedAt.localeCompare(b.completedAt))
            .map((m) => structuredClone(m)),
        };
      case 'kof_put_matches': {
        const records = args.p_records as { matchId: string; completedAt: string }[];
        if (args.p_mode === 'replace') state.matches.clear();
        for (const r of records) {
          if (args.p_mode === 'add' && state.matches.has(r.matchId)) continue;
          state.matches.set(r.matchId, structuredClone(r));
        }
        return { ok: true };
      }
      case 'kof_delete_match':
        state.matches.delete(args.p_match_id as string);
        return { ok: true };
      case 'kof_change_code':
        state.code = args.p_new_code as string;
        return { ok: true };
      default:
        return { ok: false, error: 'invalid' };
    }
  }

  /** A fetch that answers /rest/v1/rpc/<name> like Supabase; fails like a network error offline. */
  async function fetchImpl(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    if (!state.online) throw new TypeError('Failed to fetch');
    const name = String(input).split('/rpc/')[1] ?? '';
    const body = handle(name, JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>);
    return new Response(JSON.stringify(body), { status: 200 });
  }

  return { state, handle, fetchImpl };
}
