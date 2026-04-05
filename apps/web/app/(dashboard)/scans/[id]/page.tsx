'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import Link from 'next/link';
import { Card, Title, Text, Badge, ProgressBar } from '@tremor/react';
import { CheckCircle2, XCircle, Loader2, Circle } from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import { useScanProgress } from '@/hooks/use-scan-progress';
import type { ScanRun, DomainStatus } from '@/lib/types';
import { CATEGORY_LABELS, classifyScore } from '@/lib/utils';

const STATUS_ICON: Record<DomainStatus, JSX.Element> = {
  PENDING: <Circle className="h-5 w-5 text-gray-300" />,
  RUNNING: <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />,
  COMPLETED: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
  FAILED: <XCircle className="h-5 w-5 text-red-500" />,
  SKIPPED: <Circle className="h-5 w-5 text-gray-400" />,
};

export default function ScanDetailPage({ params }: { params: { id: string } }): JSX.Element {
  const api = useApi();
  const qc = useQueryClient();

  const scanQuery = useQuery({
    queryKey: ['scan', params.id],
    queryFn: async () => (await api.get<ScanRun>(`/scans/${params.id}`)).data,
    refetchInterval: (q) =>
      q.state.data?.status === 'RUNNING' || q.state.data?.status === 'PENDING' ? 3000 : false,
  });

  const { events, connected } = useScanProgress(params.id);

  // Invalida a query quando chegam eventos do SSE para refetch imediato
  useEffect(() => {
    if (events.length > 0) {
      qc.invalidateQueries({ queryKey: ['scan', params.id] });
    }
  }, [events.length, params.id, qc]);

  if (scanQuery.isLoading || !scanQuery.data) {
    return <div className="text-gray-500">Carregando…</div>;
  }

  const scan = scanQuery.data;
  const score = scan.healthScore;
  const classification = score ? classifyScore(score.scoreOverall) : null;

  const completed = scan.domainScans.filter((d) => d.status === 'COMPLETED').length;
  const totalDomains = scan.domainScans.length;
  const progress = totalDomains > 0 ? (completed / totalDomains) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Scan {scan.id.slice(0, 8)}</h1>
          <Text className="mt-1">
            Iniciado em {new Date(scan.createdAt).toLocaleString('pt-BR')}
          </Text>
        </div>
        <div className="flex items-center gap-3">
          <Badge
            color={
              scan.status === 'COMPLETED'
                ? 'emerald'
                : scan.status === 'FAILED'
                  ? 'red'
                  : scan.status === 'PARTIAL'
                    ? 'yellow'
                    : 'blue'
            }
          >
            {scan.status}
          </Badge>
          {scan.status === 'COMPLETED' && (
            <Link
              href={`/scans/${scan.id}/report`}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
            >
              Ver relatório IA
            </Link>
          )}
        </div>
      </div>

      {(scan.status === 'RUNNING' || scan.status === 'PENDING') && (
        <Card>
          <div className="flex items-center gap-3 mb-3">
            <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
            <Title>Scan em execução</Title>
            {connected && <Badge color="emerald">Conectado em tempo real</Badge>}
          </div>
          <ProgressBar value={progress} color="blue" />
          <Text className="mt-2">
            {completed} de {totalDomains} domínios concluídos
          </Text>
        </Card>
      )}

      <Card>
        <Title>Progresso por domínio</Title>
        <div className="mt-4 space-y-3">
          {scan.domainScans.map((d) => (
            <div
              key={d.id}
              className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
            >
              <div className="flex items-center gap-3">
                {STATUS_ICON[d.status]}
                <div>
                  <Text className="font-medium">{CATEGORY_LABELS[d.domain]}</Text>
                  {d.errorMessage && (
                    <Text className="text-xs text-red-600 mt-0.5">{d.errorMessage}</Text>
                  )}
                </div>
              </div>
              <div className="text-right">
                <Text className="text-xs text-gray-500">
                  {d.status === 'COMPLETED' && `${d.itemsCollected} itens coletados`}
                  {d.status === 'RUNNING' && 'Em execução…'}
                  {d.status === 'PENDING' && 'Aguardando'}
                  {d.status === 'FAILED' && 'Falhou'}
                </Text>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {score && classification && (
        <Card>
          <Title>Resultado</Title>
          <div className="mt-4 flex items-center gap-6">
            <div>
              <Text>Score geral</Text>
              <div className="text-5xl font-bold text-gray-900 mt-1">
                {score.scoreOverall.toFixed(1)}
              </div>
              <Badge color={classification.color} className="mt-2">
                {classification.label}
              </Badge>
            </div>
            <div className="flex-1">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>Total findings: <strong>{score.totalFindings}</strong></div>
                <div>Críticos: <strong className="text-red-600">{score.criticalCount}</strong></div>
                <div>Altos: <strong className="text-orange-600">{score.highCount}</strong></div>
                <div>Médios: <strong className="text-yellow-600">{score.mediumCount}</strong></div>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
