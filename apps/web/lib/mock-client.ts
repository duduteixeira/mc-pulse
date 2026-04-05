import type { AxiosInstance } from 'axios';
import {
  mockConnections,
  mockScanRuns,
  mockFindings,
  mockHealthScore,
  mockAiReport,
  createRunningScan,
  mockDomainMetadata,
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

      if (url === '/scan-domains') return wrap(mockDomainMetadata);
      if (url === '/connections') return wrap(state.connections);
      if (url.match(/^\/connections\/[^/]+\/history$/)) {
        const id = url.split('/')[2];
        // Gera histórico fictício de 8 scans nos últimos 56 dias
        const history = Array.from({ length: 8 }, (_, i) => {
          const daysBack = (7 - i) * 7;
          const d = new Date();
          d.setDate(d.getDate() - daysBack);
          // Score com tendência de melhoria + ruído
          const base = 58 + i * 2.1 + (Math.random() * 4 - 2);
          return {
            scanRunId: `scan-history-${id}-${i}`,
            createdAt: d.toISOString(),
            scoreOverall: Math.round(base * 10) / 10,
            scoreByDomain: {
              governance: Math.round((base + 10 + Math.random() * 5) * 10) / 10,
              data: Math.round((base - 8 + Math.random() * 5) * 10) / 10,
              journey: Math.round((base + 4 + Math.random() * 5) * 10) / 10,
              automation: Math.round((base - 5 + Math.random() * 5) * 10) / 10,
              email: Math.round((base + 6 + Math.random() * 5) * 10) / 10,
              security: Math.round((base + 2 + Math.random() * 5) * 10) / 10,
            },
            totalFindings: 35 - i * 1 + Math.floor(Math.random() * 3),
          };
        });
        return wrap(history);
      }
      if (url.startsWith('/connections/')) {
        const id = url.split('/')[2];
        const conn = state.connections.find((c) => c.id === id);
        return conn ? wrap(conn) : Promise.reject(new Error('Not found'));
      }
      if (url === '/scans/compare') {
        const params = config?.params ?? {};
        const a = state.scans.find((s) => s.id === params.a);
        const b = state.scans.find((s) => s.id === params.b);
        if (!a || !b || !a.healthScore || !b.healthScore) {
          throw new Error('Scans não encontrados');
        }
        // Mock de diff plausível
        return wrap({
          a: {
            scanRunId: a.id,
            createdAt: a.createdAt,
            scoreOverall: a.healthScore.scoreOverall,
          },
          b: {
            scanRunId: b.id,
            createdAt: b.createdAt,
            scoreOverall: b.healthScore.scoreOverall,
          },
          delta: {
            overall: Number(
              (b.healthScore.scoreOverall - a.healthScore.scoreOverall).toFixed(1),
            ),
            byDomain: {
              governance: 2.5,
              data: -3.2,
              journey: 0,
              automation: 5.1,
              email: 1.8,
              security: -1.5,
            },
          },
          findingsDiff: {
            new: [
              { ruleId: 'AUT-001', objectName: 'New_Broken_Automation', severity: 'CRITICAL' },
              { ruleId: 'DATA-003', objectName: 'temp_new_de', severity: 'MEDIUM' },
            ],
            resolved: [
              { ruleId: 'DATA-001', objectName: 'Old_Retention_Fixed', severity: 'HIGH' },
              { ruleId: 'EML-002', objectName: 'Commercial_Fixed', severity: 'HIGH' },
              { ruleId: 'AUT-003', objectName: 'Documented_Now', severity: 'LOW' },
            ],
            persistent: 18,
          },
        });
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
        const scanId = url.split('/')[2];
        const scan = state.scans.find((s) => s.id === scanId);
        // Report só fica disponível quando o scan terminou
        if (!scan || scan.status !== 'COMPLETED') {
          const err = new Error('Report ainda não disponível') as Error & { response?: unknown };
          err.response = { status: 404 };
          throw err;
        }
        return wrap({ ...mockAiReport, id: `ai-${scanId}` });
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
        const payload = body as { connectionId?: string; domains?: Finding['category'][] };
        const requestedDomains = (payload.domains ?? []) as Array<Finding['category']>;
        const newScan: ScanRun = createRunningScan();
        // Filtra domain scans apenas para os pedidos
        if (requestedDomains.length > 0) {
          newScan.domainScans = newScan.domainScans.filter((d) =>
            requestedDomains.includes(d.domain),
          );
        }
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
          // Filtra findings do scan apenas para os domínios selecionados
          const scanFindings = mockFindings.filter((f) =>
            requestedDomains.length === 0 ? true : requestedDomains.includes(f.category),
          );
          scan.healthScore = {
            ...mockHealthScore,
            scanRunId: newScan.id,
            totalFindings: scanFindings.length,
          };
          state.findings[newScan.id] = scanFindings;
        }, 12_000);
        return wrap({ scanRunId: newScan.id, domains: requestedDomains });
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
