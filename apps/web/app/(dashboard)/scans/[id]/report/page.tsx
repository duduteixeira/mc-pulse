'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { Card, Title, Text, TabGroup, TabList, Tab, TabPanels, TabPanel } from '@tremor/react';
import { ArrowLeft, FileText, Download, Loader2 } from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import { Markdown } from '@/components/markdown';
import type { AiReport, ScanRun } from '@/lib/types';

export default function ReportPage({ params }: { params: { id: string } }): JSX.Element {
  const api = useApi();
  const [downloading, setDownloading] = useState<'executive' | 'technical' | null>(null);

  const scanQuery = useQuery({
    queryKey: ['scan', params.id],
    queryFn: async () => (await api.get<ScanRun>(`/scans/${params.id}`)).data,
  });

  const reportQuery = useQuery({
    queryKey: ['ai-report', params.id],
    queryFn: async () => (await api.get<AiReport>(`/scans/${params.id}/report`)).data,
    retry: (count, err) => {
      // Se o report ainda não existe (404), continua tentando por até 60s
      if (count > 30) return false;
      return true;
    },
    retryDelay: 2000,
  });

  const downloadPdf = async (type: 'executive' | 'technical'): Promise<void> => {
    setDownloading(type);
    try {
      const response = await api.get<Blob>(`/scans/${params.id}/reports/${type}.pdf`, {
        responseType: 'blob',
      } as never);
      const blob = new Blob([response.data as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mc-pulse-${type}-${params.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('PDF não disponível em modo demo. Execute com backend real para gerar PDFs.');
    } finally {
      setDownloading(null);
    }
  };

  if (scanQuery.isLoading) {
    return <div className="text-gray-500">Carregando…</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/scans/${params.id}`}
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para o scan
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Relatório IA</h1>
            <Text className="mt-1">
              Gerado por Claude · scan {params.id.slice(0, 8)}
            </Text>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => downloadPdf('executive')}
              disabled={downloading !== null}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {downloading === 'executive' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              PDF Executivo
            </button>
            <button
              onClick={() => downloadPdf('technical')}
              disabled={downloading !== null}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {downloading === 'technical' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              PDF Técnico
            </button>
          </div>
        </div>
      </div>

      {reportQuery.isLoading && (
        <Card>
          <div className="py-12 text-center">
            <Loader2 className="h-10 w-10 text-blue-500 animate-spin mx-auto mb-3" />
            <Title>Gerando relatório com IA…</Title>
            <Text className="mt-2">
              Claude está analisando os findings. Isso pode levar alguns segundos.
            </Text>
          </div>
        </Card>
      )}

      {reportQuery.data && reportQuery.data.status === 'COMPLETED' && (
        <Card>
          <TabGroup>
            <TabList>
              <Tab icon={FileText}>Resumo Executivo</Tab>
              <Tab icon={FileText}>Análise Técnica</Tab>
              <Tab icon={FileText}>Plano 30/60/90</Tab>
              <Tab icon={FileText}>Checklist</Tab>
            </TabList>
            <TabPanels>
              <TabPanel>
                <div className="py-4">
                  {reportQuery.data.executiveSummary ? (
                    <Markdown>{reportQuery.data.executiveSummary}</Markdown>
                  ) : (
                    <Text>Resumo ainda não disponível.</Text>
                  )}
                </div>
              </TabPanel>
              <TabPanel>
                <div className="py-4">
                  {reportQuery.data.technicalAnalysis ? (
                    <Markdown>{reportQuery.data.technicalAnalysis}</Markdown>
                  ) : (
                    <Text>Análise ainda não disponível.</Text>
                  )}
                </div>
              </TabPanel>
              <TabPanel>
                <div className="py-4 space-y-6">
                  {reportQuery.data.actionPlan30 && (
                    <div>
                      <Markdown>{reportQuery.data.actionPlan30}</Markdown>
                    </div>
                  )}
                  {reportQuery.data.actionPlan60 && (
                    <div>
                      <Markdown>{reportQuery.data.actionPlan60}</Markdown>
                    </div>
                  )}
                  {reportQuery.data.actionPlan90 && (
                    <div>
                      <Markdown>{reportQuery.data.actionPlan90}</Markdown>
                    </div>
                  )}
                </div>
              </TabPanel>
              <TabPanel>
                <div className="py-4">
                  {reportQuery.data.operationalChecklist ? (
                    <Markdown>{reportQuery.data.operationalChecklist}</Markdown>
                  ) : (
                    <Text>Checklist ainda não disponível.</Text>
                  )}
                </div>
              </TabPanel>
            </TabPanels>
          </TabGroup>
        </Card>
      )}

      {reportQuery.data?.status === 'FAILED' && (
        <Card>
          <div className="py-8 text-center">
            <Text className="text-red-600">Falha ao gerar relatório.</Text>
          </div>
        </Card>
      )}
    </div>
  );
}
