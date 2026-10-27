/**
 * useHealthCheck — polls the API health endpoint on mount.
 * Returns { status: 'healthy' | 'unhealthy' | 'checking' }
 */
import { useState, useEffect } from 'react';
import { checkHealth } from '../api/localize';

export function useHealthCheck() {
  const [status, setStatus] = useState('checking');

  useEffect(() => {
    let cancelled = false;

    async function ping() {
      try {
        await checkHealth();
        if (!cancelled) setStatus('healthy');
      } catch {
        if (!cancelled) setStatus('unhealthy');
      }
    }

    ping();
    const id = setInterval(ping, 30_000); // re-check every 30 s
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return status;
}
