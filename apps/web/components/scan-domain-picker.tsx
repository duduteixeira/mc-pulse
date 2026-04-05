'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { X, Clock, Zap, Lock, CheckCircle2 } from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import type { DomainMetadata, ScanDomain } from '@/lib/types';

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (domains: ScanDomain[]) => void;
  connectionName: string;
  loading?: boolean;
}

export function ScanDomainPicker({
  open,
  onClose,
  onConfirm,
  connectionName,
  loading = false,
}: Props): JSX.Element | null {
  const api = useApi();
  const [selected, setSelected] = useState<Set<ScanDomain>>(new Set());

  const domainsQuery = useQuery({
    queryKey: ['scan-domains'],
    queryFn: async () => (await api.get<DomainMetadata[]>('/scan-domains')).data,
    staleTime: Infinity, // metadados estáticos
  });

  useEffect(() => {
    if (open && domainsQuery.data) {
      // Pré-seleciona os domínios do plano FREE por default
      const defaults = new Set<ScanDomain>(
        domainsQuery.data.filter((d) => d.minimumPlan === 'FREE').map((d) => d.domain),
      );
      setSelected(defaults);
    }
  }, [open, domainsQuery.data]);

  if (!open) return null;

  const toggle = (domain: ScanDomain): void => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });
  };

  const selectAll = (): void => {
    if (!domainsQuery.data) return;
    setSelected(new Set(domainsQuery.data.map((d) => d.domain)));
  };

  const deselectAll = (): void => setSelected(new Set());

  const selectedList = Array.from(selected);
  const totalCalls = (domainsQuery.data ?? [])
    .filter((d) => selected.has(d.domain))
    .reduce((sum, d) => sum + d.estimatedApiCalls, 0);
  const totalSeconds = Math.max(
    ...(domainsQuery.data ?? [])
      .filter((d) => selected.has(d.domain))
      .map((d) => d.estimatedDurationSeconds),
    0,
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Novo scan</h2>
            <p className="text-sm text-gray-600 mt-1">
              Selecione os domínios a analisar em <strong>{connectionName}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Actions bar */}
        <div className="flex items-center justify-between px-6 py-3 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={selectAll}
              className="text-blue-600 hover:text-blue-500 font-medium"
            >
              Selecionar todos
            </button>
            <span className="text-gray-300">·</span>
            <button
              onClick={deselectAll}
              className="text-gray-600 hover:text-gray-500 font-medium"
            >
              Limpar
            </button>
          </div>
          <div className="text-xs text-gray-600">
            {selected.size} de {domainsQuery.data?.length ?? 0} selecionados
          </div>
        </div>

        {/* Domain list */}
        <div className="flex-1 overflow-auto p-4 space-y-2">
          {domainsQuery.isLoading && (
            <div className="text-center py-8 text-gray-500">Carregando domínios…</div>
          )}
          {domainsQuery.data?.map((d) => {
            const isSelected = selected.has(d.domain);
            return (
              <button
                key={d.domain}
                type="button"
                onClick={() => toggle(d.domain)}
                className={`w-full text-left rounded-lg border-2 p-4 transition-all ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 flex-shrink-0 h-5 w-5 rounded border-2 flex items-center justify-center ${
                      isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-300 bg-white'
                    }`}
                  >
                    {isSelected && <CheckCircle2 className="h-4 w-4 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900">{d.label}</h3>
                      {d.minimumPlan !== 'FREE' && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 text-amber-800 px-1.5 py-0.5 text-xs font-medium">
                          <Lock className="h-3 w-3" />
                          {d.minimumPlan}
                        </span>
                      )}
                      <span className="inline-flex items-center rounded-md bg-gray-100 text-gray-600 px-1.5 py-0.5 text-xs font-mono">
                        {d.protocol}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{d.description}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Zap className="h-3 w-3" />
                        ~{d.estimatedApiCalls} chamadas SFMC
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />~{d.estimatedDurationSeconds}s
                      </span>
                      <span>{d.ruleCount} regras</span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4 text-sm">
            <div className="text-gray-600">
              Total estimado:{' '}
              <strong className="text-gray-900">~{totalCalls} chamadas SFMC</strong> ·{' '}
              <strong className="text-gray-900">~{totalSeconds}s</strong> (jobs paralelos)
            </div>
          </div>
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => onConfirm(selectedList)}
              disabled={selected.size === 0 || loading}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:bg-gray-300"
            >
              {loading
                ? 'Iniciando…'
                : `Iniciar scan${selected.size > 0 ? ` (${selected.size})` : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
