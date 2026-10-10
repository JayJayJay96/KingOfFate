import { useEffect, useState } from 'react';

const LOCK = 'kof-open-tab';
const CHANNEL = 'kof-tabs';
/** How often each tab re-checks (locks) or re-announces itself (fallback). */
const CHECK_MS = 1500;
/** Fallback only: a tab not heard from for this long is treated as closed. */
const STALE_MS = 5000;

/**
 * True while the game is also open in another tab of this browser. Both tabs would read and
 * write the same saved match, so the host is warned to play in one tab only.
 *
 * Uses Web Locks: every tab asks for the same lock; the browser keeps the queue and releases a
 * tab's place the moment it closes or crashes, so no tab has to wait for another to reply.
 * Falls back to BroadcastChannel heartbeats where Web Locks are missing; silent if neither is.
 */
export function useOtherTabWarning(): boolean {
  const [otherTab, setOtherTab] = useState(false);

  useEffect(() => {
    const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
    if (locks && typeof locks.request === 'function' && typeof locks.query === 'function') {
      return watchWithLocks(locks, setOtherTab);
    }
    if (typeof BroadcastChannel !== 'undefined') return watchWithChannel(setOtherTab);
    return undefined;
  }, []);

  return otherTab;
}

function watchWithLocks(locks: LockManager, setOtherTab: (v: boolean) => void): () => void {
  let release: () => void = () => undefined;
  let holding = false;
  let stopped = false;
  // Join the queue for the lock and keep it (or our place in line) until unmount.
  void locks
    .request(LOCK, () => {
      holding = true;
      void check();
      return new Promise<void>((resolve) => {
        release = resolve;
        if (stopped) resolve();
      });
    })
    .catch(() => undefined);

  async function check() {
    try {
      const state = await locks.query();
      const held = state.held?.filter((l) => l.name === LOCK).length ?? 0;
      const waiting = state.pending?.filter((l) => l.name === LOCK).length ?? 0;
      // Holder: anyone waiting is another tab. Waiting: the holder is another tab.
      const others = holding ? waiting : held + waiting - 1;
      if (!stopped) setOtherTab(others > 0);
    } catch {
      // Locks unavailable right now: keep the last answer.
    }
  }

  void check();
  const timer = setInterval(() => void check(), CHECK_MS);
  return () => {
    stopped = true;
    clearInterval(timer);
    release();
  };
}

type Message = { readonly type: 'hello' | 'here' | 'bye'; readonly id: string };

function watchWithChannel(setOtherTab: (v: boolean) => void): () => void {
  const channel = new BroadcastChannel(CHANNEL);
  const lastSeen = new Map<string, number>();
  const me = Math.random().toString(36).slice(2);
  const send = (type: Message['type']) => channel.postMessage({ type, id: me } satisfies Message);
  const update = () => {
    const now = Date.now();
    for (const [id, at] of lastSeen) if (now - at > STALE_MS) lastSeen.delete(id);
    setOtherTab(lastSeen.size > 0);
  };
  channel.onmessage = (event: MessageEvent<Message>) => {
    const { type, id } = event.data ?? {};
    if (!id || id === me) return;
    if (type === 'bye') lastSeen.delete(id);
    else lastSeen.set(id, Date.now());
    if (type === 'hello') send('here');
    update();
  };
  send('hello');
  const heartbeat = setInterval(() => {
    send('here');
    update();
  }, CHECK_MS);
  const bye = () => send('bye');
  window.addEventListener('pagehide', bye);
  return () => {
    clearInterval(heartbeat);
    window.removeEventListener('pagehide', bye);
    bye();
    channel.close();
  };
}
