'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import type { ProgressEvent } from '@/lib/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/**
 * Abre uma conexão SSE ao endpoint /scans/:id/progress.
 * EventSource não suporta headers custom — por isso o token é passado via
 * query param e o backend aceita tanto Authorization header quanto access_token.
 *
 * Alternativa: biblioteca `@microsoft/fetch-event-source` com fetch + headers.
 */
export function useScanProgress(scanId: string | null): {
  events: ProgressEvent[];
  connected: boolean;
} {
  const { getToken } = useAuth();
  const [events, setEvents] = useState<ProgressEvent[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!scanId) return;
    let source: EventSource | null = null;
    let cancelled = false;

    (async () => {
      const token = await getToken();
      if (cancelled || !token) return;
      const url = `${API_URL}/scans/${scanId}/progress?access_token=${encodeURIComponent(token)}`;
      source = new EventSource(url);
      source.onopen = () => setConnected(true);
      source.onerror = () => setConnected(false);
      source.onmessage = (e) => {
        try {
          const parsed = JSON.parse(e.data) as ProgressEvent;
          setEvents((prev) => [...prev, parsed]);
        } catch {
          /* ignore malformed */
        }
      };
    })();

    return () => {
      cancelled = true;
      source?.close();
    };
  }, [scanId, getToken]);

  return { events, connected };
}
