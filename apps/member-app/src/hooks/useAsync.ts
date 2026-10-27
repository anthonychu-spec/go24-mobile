import { useCallback, useEffect, useRef, useState } from 'react';
import { apiErrorMessage } from '../api/errors';

/** Load data on mount (and on reload()); error is a user-facing message. */
export function useAsync<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const live = useRef(true);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(load, deps);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const next = await run();
      if (live.current) { setData(next); setError(null); }
    } catch (err) {
      if (live.current) setError(apiErrorMessage(err));
    } finally {
      if (live.current) setLoading(false);
    }
  }, [run]);

  useEffect(() => {
    live.current = true;
    void reload();
    return () => { live.current = false; };
  }, [reload]);

  return { data, error, loading, reload };
}
