import type { AxiosInstance } from 'axios';
import {
  mockConnections,
  mockScanRuns,
  mockFindings,
  mockHealthScore,
  mockAiReport,
  createRunningScan,
} from './mock-data';
import type { Connection, ScanRun, Finding } from './types';

/**
 * Estado in-memory do demo. Persiste enquanto a aba estiver aberta.
 * Reseta ao reload.
 */
const state = {
  connections: [...mockConnections],
  scans: [...mockScanRuns],
  findings: { 'scan-demo-1': [...mockFindings] } as Record<string, Finding[]>,
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function id(): string {
  return Math.random().toString(36).slice(2, 10);
}

interface MockResponse<T> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  config: Record<string, unknown>;
}

function wrap<T>(data: T): MockResponse<T> {
  return { data, status: 200, statusText: 'OK', headers: {}, config: {} };
}

/**
 * Cria um "axios" fake que responde aos endpoints usados pelo frontend.
 * Usado quando NEXT_PUBLIC_DEMO_MODE === 'true'.
 */
export function createMockApiClient(): AxiosInstance {
  const handler = {
    async get(url: string, config?: { params?: Record<string, unknown> }): Promise<unknown> {
      await sleep(200);

      if (url === '/connections') return wrap(state.connections);
      if (url.startsWith('/connections/')) {
        const id = url.split('/')[2];
        const conn = state.connections.find((c) => c.id === id);
        return conn ? wrap(conn) : Promise.reject(new Error('Not found'));
      }
      if (url === '/scans') return wrap(state.scans);
      if (url.match(/^\/scans\/[^/]+$/)) {
        const id = url.split('/')[2];
        const scan = state.scans.find((s) => s.id === id);
        return scan ? wrap(scan) : Promise.reject(new Error('Not found'));
      }
      if (url.match(/^\/scans\/[^/]+\/findings$/)) {
        const id = url.split('/')[2];
        const findings = state.findings[id] ?? [];
        const params = config?.params ?? {};
        let items = [...findings];
        if (params.category) items = items.filter((f) => f.category === params.category);
        if (params.severity) items = items.filter((f) => f.severity === params.severity);
        if (params.status) items = items.filter((f) => f.status === params.status);
        return wrap({ items, total: items.length, page: 1, limit: 100 });
      }
      if (url.match(/^\/scans\/[^/]+\/score$/)) {
        return wrap(mockHealthScore);
      }
      if (url.match(/^\/scans\/[^/]+\/report$/)) {
        return wrap(mockAiReport);
      }
      throw new Error(`Mock: GET ${url} não implementado`);
    },

    async post(url: string, body?: unknown): Promise<unknown> {
      await sleep(300);

      if (url === '/connections') {
        const payload = body as Partial<Connection> & { clientSecret?: string };
        const newConn: Connection = {
          id: `conn-${id()}`,
          name: payload.name ?? 'Nova conexão',
          subdomain: payload.subdomain ?? 'mcxxx',
          accountId: payload.accountId ?? '0',
          clientId: payload.clientId ?? '',
          integrationType: payload.integrationType ?? 'SINGLE_BU',
          status: 'PENDING',
          lastTestedAt: null,
          errorMessage: null,
          createdAt: new Date().toISOString(),
        };
        state.connections.unshift(newConn);
        return wrap(newConn);
      }

      if (url.match(/^\/connections\/[^/]+\/test$/)) {
        const connId = url.split('/')[2];
        const conn = state.connections.find((c) => c.id === connId);
        if (conn) {
          conn.status = 'ACTIVE';
          conn.lastTestedAt = new Date().toISOString();
          conn.errorMessage = null;
        }
        return wrap({
          ok: true,
          scopes: ['data_extensions_read', 'journeys_read', 'automations_read', 'email_read'],
        });
      }

      if (url === '/scans') {
        const newScan: ScanRun = createRunningScan();
        state.scans.unshift(newScan);
        // Simula conclusão 12s depois
        setTimeout(() => {
          const scan = state.scans.find((s) => s.id === newScan.id);
          if (!scan) return;
          scan.status = 'COMPLETED';
          scan.completedAt = new Date().toISOString();
          scan.domainScans.forEach((d) => {
            d.status = 'COMPLETED';
            d.itemsCollected = Math.floor(Math.random() * 100) + 10;
            d.completedAt = new Date().toISOString();
          });
          scan.healthScore = { ...mockHealthScore, scanRunId: newScan.id };
          state.findings[newScan.id] = [...mockFindings];
        }, 12_000);
        return wrap({ scanRunId: newScan.id });
      }

      throw new Error(`Mock: POST ${url} não implementado`);
    },

    async patch(url: string, body?: unknown): Promise<unknown> {
      await sleep(150);
      if (url.startsWith('/findings/')) {
        const id = url.split('/')[2];
        const payload = body as { status: Finding['status'] };
        for (const key in state.findings) {
          const target = state.findings[key].find((f) => f.id === id);
          if (target) {
            target.status = payload.status;
            return wrap(target);
          }
        }
      }
      throw new Error(`Mock: PATCH ${url} não implementado`);
    },

    async delete(url: string): Promise<unknown> {
      await sleep(200);
      if (url.startsWith('/connections/')) {
        const connId = url.split('/')[2];
        state.connections = state.connections.filter((c) => c.id !== connId);
        return wrap({});
      }
      throw new Error(`Mock: DELETE ${url} não implementado`);
    },
  };

  // Retorna um objeto compatível com o subset do AxiosInstance que usamos
  return handler as unknown as AxiosInstance;
}

export function isDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
}
