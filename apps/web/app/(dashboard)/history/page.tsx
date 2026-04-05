'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import Link from 'next/link';
import { Card, Title, Text, AreaChart, Badge, Select, SelectItem } from '@tremor/react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import type { Connection, ScanRun } from '@/lib/types';
import { classifyScore } from '@/lib/utils';

interface HistoryPoint {
  scanRunId: string;
  createdAt: string;
  scoreOverall: number;
  scoreByDomain: Record<string, number | null>;
  totalFindings: number;
}

export default function HistoryPage(): JSX.Element {
  const api = useApi();
  const [selectedConnection, setSelectedConnection] = useState<string | null>(null);

  const connectionsQuery = useQuery({
    queryKey: ['connections'],
    queryFn: async () => (await api.get<Connection[]>('/connections')).data,
  });

  // Auto-seleciona a primeira conexão ativa
  const activeConnectionId =
    selectedConnection ??
    connectionsQuery.data?.find((c) => c.status === 'ACTIVE')?.id ??
    null;

  const historyQuery = useQuery({
    queryKey: ['history', activeConnectionId],
    enabled: !!activeConnectionId,
    queryFn: async () =>
      (
        await api.get<HistoryPoint[]>(
          `/connections/${activeConnectionId}/history`,
        )
      ).data,
  });

  const history = historyQuery.data ?? [];
  const latest = history[history.length - 1];
  const previous = history[history.length - 2];
  const delta = latest && previous ? latest.scoreOverall - previous.scoreOverall : 0;

  const chartData = history.map((p) => ({
    date: new Date(p.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
    'Score geral': p.scoreOverall,
    Governança: p.scoreByDomain.governance ?? 0,
    Dados: p.scoreByDomain.data ?? 0,
    Jornadas: p.scoreByDomain.journey ?? 0,
    Automações: p.scoreByDomain.automation ?? 0,
    Email: p.scoreByDomain.email ?? 0,
    Segurança: p.scoreByDomain.security ?? 0,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Histórico</h1>
          <p className="text-gray-600 mt-1">
            Evolução do health score ao longo do tempo
          </p>
        </div>
        {connectionsQuery.data && connectionsQuery.data.length > 0 && (
          <div className="w-64">
            <Select
              value={activeConnectionId ?? ''}
              onValueChange={(v) => setSelectedConnection(v || null)}
              placeholder="Selecione uma conexão"
            >
              {connectionsQuery.data.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </Select>
          </div>
        )}
      </div>

      {historyQuery.isLoading && <Text>Carregando…</Text>}

      {!historyQuery.isLoading && history.length === 0 && (
        <Card>
          <div className="py-12 text-center">
            <Title>Nenhum scan concluído ainda</Title>
            <Text className="mt-2">
              Execute ao menos 2 scans para ver a evolução do score no tempo.
            </Text>
          </div>
        </Card>
      )}

      {latest && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <Text>Score atual</Text>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-4xl font-bold text-gray-900">
                {latest.scoreOverall.toFixed(1)}
              </span>
              <Badge color={classifyScore(latest.scoreOverall).color}>
                {classifyScore(latest.scoreOverall).label}
              </Badge>
            </div>
          </Card>
          <Card>
            <Text>Variação vs anterior</Text>
            <div className="mt-2 flex items-center gap-2">
              {delta > 0 ? (
                <TrendingUp className="h-6 w-6 text-emerald-500" />
              ) : delta < 0 ? (
                <TrendingDown className="h-6 w-6 text-red-500" />
              ) : (
                <Minus className="h-6 w-6 text-gray-400" />
              )}
              <span
                className={`text-3xl font-bold ${
                  delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-red-600' : 'text-gray-600'
                }`}
              >
                {delta > 0 ? '+' : ''}
                {delta.toFixed(1)}
              </span>
            </div>
            <Text className="mt-1 text-xs">
              {previous
                ? `Comparado ao scan de ${new Date(previous.createdAt).toLocaleDateString('pt-BR')}`
                : 'Primeiro scan'}
            </Text>
          </Card>
          <Card>
            <Text>Total de scans</Text>
            <div className="mt-2 text-4xl font-bold text-gray-900">{history.length}</div>
            <Text className="mt-1 text-xs">
              Desde {new Date(history[0].createdAt).toLocaleDateString('pt-BR')}
            </Text>
          </Card>
        </div>
      )}

      {history.length > 0 && (
        <Card>
          <Title>Evolução do score</Title>
          <Text>Score geral e por domínio</Text>
          <AreaChart
            className="mt-6 h-80"
            data={chartData}
            index="date"
            categories={[
              'Score geral',
              'Governança',
              'Dados',
              'Jornadas',
              'Automações',
              'Email',
              'Segurança',
            ]}
            colors={['blue', 'cyan', 'indigo', 'violet', 'fuchsia', 'pink', 'rose']}
            yAxisWidth={40}
            showLegend={true}
          />
        </Card>
      )}

      {history.length > 0 && (
        <Card>
          <Title>Scans recentes</Title>
          <div className="mt-4 divide-y divide-gray-100">
            {[...history].reverse().map((h) => {
              const classif = classifyScore(h.scoreOverall);
              return (
                <Link
                  key={h.scanRunId}
                  href={`/scans/${h.scanRunId}`}
                  className="flex items-center justify-between py-3 hover:bg-gray-50 -mx-4 px-4 rounded"
                >
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {new Date(h.createdAt).toLocaleString('pt-BR')}
                    </div>
                    <div className="text-xs text-gray-500">
                      {h.totalFindings} findings
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold text-gray-900">
                      {h.scoreOverall.toFixed(1)}
                    </span>
                    <Badge color={classif.color}>{classif.label}</Badge>
                  </div>
                </Link>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
