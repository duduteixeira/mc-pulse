'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import type { ProgressEvent } from '@/lib/types';
import { isDemoMode } from '@/lib/mock-client';
import { ALL_DOMAINS } from '@/lib/mock-data';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/**
 * Abre uma conexão SSE ao endpoint /scans/:id/progress.
 * Em DEMO_MODE, emite eventos simulados ao longo de ~12s.
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

    // Demo: simula SSE com timers
    if (isDemoMode()) {
      setConnected(true);
      const timers: ReturnType<typeof setTimeout>[] = [];
      ALL_DOMAINS.forEach((domain, i) => {
        timers.push(
          setTimeout(() => {
            setEvents((prev) => [...prev, { scanRunId: scanId, domain, status: 'running' }]);
          }, 500 + i * 400),
        );
        timers.push(
          setTimeout(
            () => {
              setEvents((prev) => [
                ...prev,
                {
                  scanRunId: scanId,
                  domain,
                  status: 'completed',
                  itemsCollected: Math.floor(Math.random() * 100) + 10,
                },
              ]);
            },
            2500 + i * 1200,
          ),
        );
      });
      timers.push(
        setTimeout(() => {
          setEvents((prev) => [
            ...prev,
            { scanRunId: scanId, status: 'finalized', overallScore: 72.4 },
          ]);
          setConnected(false);
        }, 11_500),
      );
      return () => {
        timers.forEach(clearTimeout);
      };
    }

    // Real: EventSource com token via query param
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
