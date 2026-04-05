'use client';

import { useQuery } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { Card, Title, Text, Select, SelectItem, Badge } from '@tremor/react';
import { ArrowRight, Plus, Minus, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import type { ScanRun, Connection } from '@/lib/types';
import { SEVERITY_COLORS } from '@/lib/utils';

interface ScanComparison {
  a: { scanRunId: string; createdAt: string; scoreOverall: number };
  b: { scanRunId: string; createdAt: string; scoreOverall: number };
  delta: {
    overall: number;
    byDomain: Record<string, number | null>;
  };
  findingsDiff: {
    new: Array<{ ruleId: string; objectName: string | null; severity: string }>;
    resolved: Array<{ ruleId: string; objectName: string | null; severity: string }>;
    persistent: number;
  };
}

const DOMAIN_LABELS: Record<string, string> = {
  governance: 'Governança',
  data: 'Dados',
  journey: 'Jornadas',
  automation: 'Automações',
  email: 'Email',
  security: 'Segurança',
};

export default function ComparePage(): JSX.Element {
  const api = useApi();
  const [scanA, setScanA] = useState<string | null>(null);
  const [scanB, setScanB] = useState<string | null>(null);

  const scansQuery = useQuery({
    queryKey: ['scans'],
    queryFn: async () => (await api.get<ScanRun[]>('/scans')).data,
  });

  const connectionsQuery = useQuery({
    queryKey: ['connections'],
    queryFn: async () => (await api.get<Connection[]>('/connections')).data,
  });

  // Filtra só scans completos
  const completedScans = useMemo(
    () => (scansQuery.data ?? []).filter((s) => s.status === 'COMPLETED' && s.healthScore),
    [scansQuery.data],
  );

  const connectionName = (connId: string): string =>
    connectionsQuery.data?.find((c) => c.id === connId)?.name ?? connId.slice(0, 8);

  const comparisonQuery = useQuery({
    queryKey: ['compare', scanA, scanB],
    enabled: !!scanA && !!scanB && scanA !== scanB,
    queryFn: async () =>
      (await api.get<ScanComparison>('/scans/compare', { params: { a: scanA, b: scanB } }))
        .data,
  });

  const c = comparisonQuery.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Comparar scans</h1>
        <p className="text-gray-600 mt-1">
          Veja o que mudou entre dois scans — findings novos, resolvidos e persistentes
        </p>
      </div>

      <Card>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Text className="mb-2">Scan A (anterior)</Text>
            <Select
              value={scanA ?? ''}
              onValueChange={(v) => setScanA(v || null)}
              placeholder="Selecione um scan"
            >
              {completedScans.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {new Date(s.createdAt).toLocaleString('pt-BR')} ·{' '}
                  {connectionName(s.connectionId)} · Score{' '}
                  {s.healthScore?.scoreOverall.toFixed(1)}
                </SelectItem>
              ))}
            </Select>
          </div>
          <div>
            <Text className="mb-2">Scan B (posterior)</Text>
            <Select
              value={scanB ?? ''}
              onValueChange={(v) => setScanB(v || null)}
              placeholder="Selecione um scan"
            >
              {completedScans.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {new Date(s.createdAt).toLocaleString('pt-BR')} ·{' '}
                  {connectionName(s.connectionId)} · Score{' '}
                  {s.healthScore?.scoreOverall.toFixed(1)}
                </SelectItem>
              ))}
            </Select>
          </div>
        </div>
        {completedScans.length < 2 && (
          <Text className="mt-4 text-amber-600">
            É necessário ao menos 2 scans concluídos para comparar.
          </Text>
        )}
      </Card>

      {comparisonQuery.isLoading && <Text>Carregando comparação…</Text>}

      {c && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <Text>Delta de score</Text>
              <div className="mt-2 flex items-baseline gap-2">
                <span
                  className={`text-4xl font-bold ${
                    c.delta.overall > 0
                      ? 'text-emerald-600'
                      : c.delta.overall < 0
                        ? 'text-red-600'
                        : 'text-gray-600'
                  }`}
                >
                  {c.delta.overall > 0 ? '+' : ''}
                  {c.delta.overall.toFixed(1)}
                </span>
              </div>
              <Text className="mt-1 text-xs">
                De {c.a.scoreOverall.toFixed(1)} para {c.b.scoreOverall.toFixed(1)}
              </Text>
            </Card>
            <Card>
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-red-500" />
                <Text>Findings novos</Text>
              </div>
              <div className="mt-2 text-4xl font-bold text-red-600">
                {c.findingsDiff.new.length}
              </div>
              <Text className="mt-1 text-xs">Apareceram em B que não existiam em A</Text>
            </Card>
            <Card>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <Text>Findings resolvidos</Text>
              </div>
              <div className="mt-2 text-4xl font-bold text-emerald-600">
                {c.findingsDiff.resolved.length}
              </div>
              <Text className="mt-1 text-xs">Existiam em A e não existem mais em B</Text>
            </Card>
          </div>

          <Card>
            <Title>Variação por domínio</Title>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              {Object.entries(c.delta.byDomain).map(([domain, delta]) => {
                if (delta === null) return null;
                const color =
                  delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-red-600' : 'text-gray-600';
                return (
                  <div key={domain} className="rounded-lg border border-gray-200 p-3">
                    <Text className="text-xs">{DOMAIN_LABELS[domain] ?? domain}</Text>
                    <div className={`text-2xl font-bold ${color}`}>
                      {delta > 0 ? '+' : ''}
                      {delta.toFixed(1)}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <Title>Findings novos ({c.findingsDiff.new.length})</Title>
              </div>
              {c.findingsDiff.new.length === 0 ? (
                <Text>Nenhum finding novo — bom trabalho!</Text>
              ) : (
                <div className="space-y-2">
                  {c.findingsDiff.new.map((f, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-sm py-1.5 border-b border-gray-100 last:border-0"
                    >
                      <span
                        className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-xs font-medium ${
                          SEVERITY_COLORS[f.severity]
                        }`}
                      >
                        {f.severity}
                      </span>
                      <span className="font-mono text-xs text-gray-500">{f.ruleId}</span>
                      <span className="text-gray-900 truncate">
                        {f.objectName ?? '—'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                <Title>Findings resolvidos ({c.findingsDiff.resolved.length})</Title>
              </div>
              {c.findingsDiff.resolved.length === 0 ? (
                <Text>Nenhum finding resolvido entre os scans.</Text>
              ) : (
                <div className="space-y-2">
                  {c.findingsDiff.resolved.map((f, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-sm py-1.5 border-b border-gray-100 last:border-0"
                    >
                      <span
                        className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-xs font-medium ${
                          SEVERITY_COLORS[f.severity]
                        }`}
                      >
                        {f.severity}
                      </span>
                      <span className="font-mono text-xs text-gray-500">{f.ruleId}</span>
                      <span className="text-gray-900 truncate">
                        {f.objectName ?? '—'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <Card>
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-gray-500" />
              <Text>
                <strong>{c.findingsDiff.persistent}</strong> findings persistentes (existem em
                ambos os scans)
              </Text>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
