'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Card, Metric, Text, Flex, ProgressBar, Badge, Title } from '@tremor/react';
import { AlertTriangle, CheckCircle2, Plus } from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import type { ScanRun, Finding } from '@/lib/types';
import { classifyScore, CATEGORY_LABELS, SEVERITY_COLORS } from '@/lib/utils';

export default function OverviewPage(): JSX.Element {
  const api = useApi();

  const scansQuery = useQuery({
    queryKey: ['scans'],
    queryFn: async () => (await api.get<ScanRun[]>('/scans')).data,
  });

  const latestScan = scansQuery.data?.[0];
  const score = latestScan?.healthScore;

  const findingsQuery = useQuery({
    queryKey: ['scan-findings', latestScan?.id],
    enabled: !!latestScan?.id,
    queryFn: async () =>
      (
        await api.get<{ items: Finding[] }>(`/scans/${latestScan!.id}/findings`, {
          params: { severity: 'CRITICAL', limit: 5 },
        })
      ).data,
  });

  if (scansQuery.isLoading) {
    return <div className="text-gray-500">Carregando…</div>;
  }

  if (!latestScan) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 mb-6">
          <Plus className="h-8 w-8 text-blue-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Nenhum scan ainda</h2>
        <p className="text-gray-600 mb-6">
          Comece cadastrando sua primeira conexão com o Salesforce Marketing Cloud.
        </p>
        <Link
          href="/connections"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"
        >
          <Plus className="h-4 w-4" />
          Nova conexão
        </Link>
      </div>
    );
  }

  const classification = score ? classifyScore(score.scoreOverall) : null;

  const domainScores: Array<{ label: string; value: number | null }> = [
    { label: 'Governança', value: score?.scoreGovernance ?? null },
    { label: 'Dados', value: score?.scoreData ?? null },
    { label: 'Jornadas', value: score?.scoreJourney ?? null },
    { label: 'Automações', value: score?.scoreAutomation ?? null },
    { label: 'Email', value: score?.scoreEmail ?? null },
    { label: 'Segurança', value: score?.scoreSecurity ?? null },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Overview</h1>
          <p className="text-gray-600 mt-1">
            Último scan: {new Date(latestScan.createdAt).toLocaleString('pt-BR')}
          </p>
        </div>
        <Link
          href={`/scans/${latestScan.id}`}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Ver detalhes do scan
        </Link>
      </div>

      {score && classification && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="col-span-1">
            <Text>Score geral</Text>
            <Metric className="mt-2">{score.scoreOverall.toFixed(1)}</Metric>
            <Badge color={classification.color} className="mt-2">
              {classification.label}
            </Badge>
            <ProgressBar value={score.scoreOverall} color={classification.color} className="mt-4" />
          </Card>

          <Card className="col-span-1">
            <Text>Total de findings</Text>
            <Metric className="mt-2">{score.totalFindings}</Metric>
            <Flex className="mt-4 gap-2">
              <Badge color="red">{score.criticalCount} críticos</Badge>
              <Badge color="orange">{score.highCount} altos</Badge>
            </Flex>
          </Card>

          <Card className="col-span-1">
            <Text>Distribuição por severidade</Text>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Crítico</span>
                <span className="font-medium">{score.criticalCount}</span>
              </div>
              <div className="flex justify-between">
                <span>Alto</span>
                <span className="font-medium">{score.highCount}</span>
              </div>
              <div className="flex justify-between">
                <span>Médio</span>
                <span className="font-medium">{score.mediumCount}</span>
              </div>
              <div className="flex justify-between">
                <span>Baixo</span>
                <span className="font-medium">{score.lowCount}</span>
              </div>
            </div>
          </Card>
        </div>
      )}

      <Card>
        <Title>Score por domínio</Title>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {domainScores.map((d) => {
            const classif = d.value !== null ? classifyScore(d.value) : null;
            return (
              <div key={d.label} className="rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <Text className="font-medium">{d.label}</Text>
                  {classif && <Badge color={classif.color}>{d.value?.toFixed(0)}</Badge>}
                </div>
                {d.value !== null && classif && (
                  <ProgressBar value={d.value} color={classif.color} />
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <Title>Findings críticos</Title>
          <Link href="/findings" className="text-sm font-medium text-blue-600 hover:text-blue-500">
            Ver todos →
          </Link>
        </div>
        {findingsQuery.data?.items.length === 0 ? (
          <div className="py-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-2" />
            <Text>Nenhum finding crítico — seu ambiente está em boas mãos.</Text>
          </div>
        ) : (
          <div className="space-y-3">
            {findingsQuery.data?.items.slice(0, 5).map((f) => (
              <div
                key={f.id}
                className="flex items-start gap-3 rounded-lg border border-gray-200 p-4"
              >
                <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${
                        SEVERITY_COLORS[f.severity]
                      }`}
                    >
                      {f.severity}
                    </span>
                    <span className="text-xs font-mono text-gray-500">{f.ruleId}</span>
                    <span className="text-xs text-gray-500">
                      · {CATEGORY_LABELS[f.category]}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-900">
                    {f.objectName ?? f.objectType}
                  </p>
                  <p className="text-sm text-gray-600 mt-0.5 truncate">{f.evidence}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
