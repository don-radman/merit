import { useCallback, useEffect, useRef, useState } from 'react';
import { MODE, onStubChange } from '@/lib/index.ts';
import type { ClientError } from '@/lib/index.ts';

/**
 * Fetch something from the client and keep it fresh.
 *
 * - Refetches when the stub changes (this tab or another — the investor
 *   finishing in one window updates the scout's book in the next).
 * - In live mode, polls on an interval instead; the chain has no push.
 * - Keeps the last good value while refetching, so the screen never flickers
 *   back to a skeleton once it has data.
 */
export function useLiveData<T>(
  load: () => Promise<T>,
  deps: unknown[] = [],
  { pollMs = 6000 }: { pollMs?: number } = {},
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ClientError | null>(null);
  const [loading, setLoading] = useState(true);
  const alive = useRef(true);

  const refetch = useCallback(async () => {
    try {
      const next = await load();
      if (!alive.current) return;
      setData(next);
      setError(null);
    } catch (e) {
      if (!alive.current) return;
      setError(e as ClientError);
    } finally {
      if (alive.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    alive.current = true;
    setLoading(true);
    void refetch();
    const unsub = MODE === 'stub' ? onStubChange(() => void refetch()) : () => {};
    const timer = MODE === 'live' ? setInterval(() => void refetch(), pollMs) : undefined;
    return () => {
      alive.current = false;
      unsub();
      if (timer) clearInterval(timer);
    };
  }, [refetch, pollMs]);

  return { data, error, loading, refetch, setData };
}
