'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Card, Badge, Title, Text } from '@tremor/react';
import { Plus, Play, Trash2, TestTube2 } from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import type { Connection, ScanDomain } from '@/lib/types';
import { ScanDomainPicker } from '@/components/scan-domain-picker';

const STATUS_COLOR: Record<string, 'emerald' | 'yellow' | 'red' | 'gray'> = {
  ACTIVE: 'emerald',
  PENDING: 'yellow',
  FAILED: 'red',
  EXPIRED: 'gray',
};

export default function ConnectionsPage(): JSX.Element {
  const api = useApi();
  const router = useRouter();
  const qc = useQueryClient();
  const [pickerFor, setPickerFor] = useState<Connection | null>(null);

  const connectionsQuery = useQuery({
    queryKey: ['connections'],
    queryFn: async () => (await api.get<Connection[]>('/connections')).data,
  });

  const testMutation = useMutation({
    mutationFn: async (id: string) =>
      (await api.post<{ ok: boolean; message?: string }>(`/connections/${id}/test`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['connections'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/connections/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['connections'] }),
  });

  const scanMutation = useMutation({
    mutationFn: async ({
      connectionId,
      domains,
    }: {
      connectionId: string;
      domains: ScanDomain[];
    }) =>
      (
        await api.post<{ scanRunId: string }>('/scans', {
          connectionId,
          domains,
        })
      ).data,
    onSuccess: (data) => {
      setPickerFor(null);
      router.push(`/scans/${data.scanRunId}`);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Conexões</h1>
          <p className="text-gray-600 mt-1">
            Ambientes do Salesforce Marketing Cloud cadastrados
          </p>
        </div>
        <Link
          href="/connections/new"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
        >
          <Plus className="h-4 w-4" />
          Nova conexão
        </Link>
      </div>

      {connectionsQuery.isLoading && <Text>Carregando…</Text>}

      {connectionsQuery.data?.length === 0 && (
        <Card>
          <div className="py-12 text-center">
            <Title>Nenhuma conexão cadastrada</Title>
            <Text className="mt-2">
              Cadastre seu primeiro ambiente SFMC para começar a escanear.
            </Text>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {connectionsQuery.data?.map((c) => (
          <Card key={c.id}>
            <div className="flex items-start justify-between">
              <div>
                <Title>{c.name}</Title>
                <Text className="mt-1 font-mono text-xs">
                  {c.subdomain}.marketingcloudapis.com
                </Text>
              </div>
              <Badge color={STATUS_COLOR[c.status] ?? 'gray'}>{c.status}</Badge>
            </div>
            <div className="mt-4 text-xs text-gray-500 space-y-1">
              <div>Account ID: {c.accountId}</div>
              <div>Tipo: {c.integrationType}</div>
              {c.lastTestedAt && (
                <div>Testado em: {new Date(c.lastTestedAt).toLocaleString('pt-BR')}</div>
              )}
              {c.errorMessage && <div className="text-red-600">Erro: {c.errorMessage}</div>}
            </div>
            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={() => setPickerFor(c)}
                disabled={c.status !== 'ACTIVE'}
                className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:bg-gray-300"
              >
                <Play className="h-3.5 w-3.5" />
                Novo scan
              </button>
              <button
                onClick={() => testMutation.mutate(c.id)}
                disabled={testMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                <TestTube2 className="h-3.5 w-3.5" />
                Testar
              </button>
              <button
                onClick={() => {
                  if (confirm(`Remover a conexão "${c.name}"?`)) deleteMutation.mutate(c.id);
                }}
                className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </Card>
        ))}
      </div>

      <ScanDomainPicker
        open={!!pickerFor}
        connectionName={pickerFor?.name ?? ''}
        loading={scanMutation.isPending}
        onClose={() => setPickerFor(null)}
        onConfirm={(domains) => {
          if (pickerFor) {
            scanMutation.mutate({ connectionId: pickerFor.id, domains });
          }
        }}
      />
    </div>
  );
}
