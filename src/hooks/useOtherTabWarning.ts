import { useEffect, useState } from 'react';

const CHANNEL = 'kof-tabs';

/**
 * True while the game is also open in another tab of this browser. Both tabs would read and
 * write the same saved match, so the host is warned to play in one tab only. Silent where
 * BroadcastChannel is unavailable.
 */
export function useOtherTabWarning(): boolean {
  const [otherTab, setOtherTab] = useState(false);

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(CHANNEL);
    const others = new Set<string>();
    const me = Math.random().toString(36).slice(2);
    const update = () => setOtherTab(others.size > 0);
    channel.onmessage = (event: MessageEvent<{ type: string; id: string }>) => {
      const { type, id } = event.data ?? {};
      if (!id || id === me) return;
      if (type === 'hello') {
        others.add(id);
        channel.postMessage({ type: 'here', id: me });
      } else if (type === 'here') {
        others.add(id);
      } else if (type === 'bye') {
        others.delete(id);
      }
      update();
    };
    channel.postMessage({ type: 'hello', id: me });
    const bye = () => channel.postMessage({ type: 'bye', id: me });
    window.addEventListener('pagehide', bye);
    return () => {
      window.removeEventListener('pagehide', bye);
      bye();
      channel.close();
    };
  }, []);

  return otherTab;
}
