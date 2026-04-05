'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Card, Title, Text, Badge } from '@tremor/react';
import { useApi } from '@/hooks/use-api';
import type { Finding, FindingStatus, Severity, FindingCategory, ScanRun } from '@/lib/types';
import { CATEGORY_LABELS, SEVERITY_COLORS } from '@/lib/utils';

const CATEGORIES: FindingCategory[] = [
  'GOVERNANCE',
  'DATA',
  'JOURNEY',
  'AUTOMATION',
  'EMAIL',
  'SECURITY',
];
const SEVERITIES: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
const STATUSES: FindingStatus[] = ['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'IGNORED'];

export default function FindingsPage(): JSX.Element {
  const api = useApi();
  const qc = useQueryClient();
  const [filters, setFilters] = useState<{
    category?: FindingCategory;
    severity?: Severity;
    status?: FindingStatus;
  }>({});

  const scansQuery = useQuery({
    queryKey: ['scans'],
    queryFn: async () => (await api.get<ScanRun[]>('/scans')).data,
  });
  const latestScanId = scansQuery.data?.[0]?.id;

  const findingsQuery = useQuery({
    queryKey: ['findings', latestScanId, filters],
    enabled: !!latestScanId,
    queryFn: async () =>
      (
        await api.get<{ items: Finding[]; total: number }>(
          `/scans/${latestScanId}/findings`,
          { params: { ...filters, limit: 100 } },
        )
      ).data,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: FindingStatus }) =>
      (await api.patch<Finding>(`/findings/${id}`, { status })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['findings'] }),
  });

  if (!latestScanId) {
    return (
      <div className="text-gray-500">
        Nenhum scan encontrado. Rode um scan em Conexões para ver findings aqui.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Findings</h1>
        <p className="text-gray-600 mt-1">Achados do último scan ({findingsQuery.data?.total ?? 0})</p>
      </div>

      <Card>
        <div className="flex flex-wrap gap-3">
          <FilterSelect
            label="Categoria"
            value={filters.category}
            options={CATEGORIES}
            format={(v) => CATEGORY_LABELS[v]}
            onChange={(v) => setFilters((f) => ({ ...f, category: v as FindingCategory }))}
          />
          <FilterSelect
            label="Severidade"
            value={filters.severity}
            options={SEVERITIES}
            onChange={(v) => setFilters((f) => ({ ...f, severity: v as Severity }))}
          />
          <FilterSelect
            label="Status"
            value={filters.status}
            options={STATUSES}
            onChange={(v) => setFilters((f) => ({ ...f, status: v as FindingStatus }))}
          />
          {(filters.category || filters.severity || filters.status) && (
            <button
              onClick={() => setFilters({})}
              className="text-sm text-blue-600 hover:text-blue-500"
            >
              Limpar filtros
            </button>
          )}
        </div>
      </Card>

      {findingsQuery.isLoading && <Text>Carregando…</Text>}

      <div className="space-y-3">
        {findingsQuery.data?.items.map((f) => (
          <Card key={f.id}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span
                    className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${
                      SEVERITY_COLORS[f.severity]
                    }`}
                  >
                    {f.severity}
                  </span>
                  <span className="text-xs font-mono text-gray-500">{f.ruleId}</span>
                  <Badge color="blue">{CATEGORY_LABELS[f.category]}</Badge>
                  <Badge color="gray">{f.status}</Badge>
                </div>
                <Title>{f.objectName ?? f.objectType}</Title>
                <Text className="mt-1">{f.evidence}</Text>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="font-medium text-gray-900">Impacto: </span>
                    <span className="text-gray-700">{f.impact}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-900">Recomendação: </span>
                    <span className="text-gray-700">{f.recommendation}</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                {f.status === 'OPEN' && (
                  <>
                    <button
                      onClick={() => updateMutation.mutate({ id: f.id, status: 'ACKNOWLEDGED' })}
                      className="text-xs rounded border border-gray-300 bg-white px-2 py-1 text-gray-700 hover:bg-gray-50"
                    >
                      Reconhecer
                    </button>
                    <button
                      onClick={() => updateMutation.mutate({ id: f.id, status: 'RESOLVED' })}
                      className="text-xs rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-emerald-700 hover:bg-emerald-100"
                    >
                      Resolver
                    </button>
                    <button
                      onClick={() => updateMutation.mutate({ id: f.id, status: 'IGNORED' })}
                      className="text-xs rounded border border-gray-300 bg-white px-2 py-1 text-gray-500 hover:bg-gray-50"
                    >
                      Ignorar
                    </button>
                  </>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function FilterSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  format,
}: {
  label: string;
  value: T | undefined;
  options: readonly T[];
  onChange: (v: T | undefined) => void;
  format?: (v: T) => string;
}): JSX.Element {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      <select
        value={value ?? ''}
        onChange={(e) => onChange((e.target.value || undefined) as T | undefined)}
        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
      >
        <option value="">Todos</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {format ? format(o) : o}
          </option>
        ))}
      </select>
    </div>
  );
}
