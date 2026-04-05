import { ScanDomain } from '@prisma/client';

/**
 * Metadados de cada domínio de scan.
 *
 * Fonte única de verdade sobre:
 * - Nome amigável e descrição
 * - Custo estimado de chamadas às APIs do SFMC
 * - Duração média do job
 * - Plano mínimo necessário (para gating futuro)
 * - Número de regras aplicadas
 *
 * Frontend consome este metadado via GET /scan-domains.
 * Scanner usa para validar pedidos e estimar tempo total.
 */
export interface DomainMetadata {
  domain: ScanDomain;
  label: string;
  description: string;
  /** Estimativa de chamadas às APIs do SFMC por scan (ordem de magnitude). */
  estimatedApiCalls: number;
  /** Duração média do job em segundos. */
  estimatedDurationSeconds: number;
  /** Plano mínimo para habilitar este domínio (placeholder — sem gating ativo ainda). */
  minimumPlan: 'FREE' | 'PRO' | 'AGENCY' | 'ENTERPRISE';
  /** Quantidade de regras aplicadas neste domínio. */
  ruleCount: number;
  /** Peso no score geral (PRD seção 4 - Health Score). */
  scoreWeight: number;
  /** Protocolo principal usado pelo collector. */
  protocol: 'SOAP' | 'REST' | 'MIXED';
}

export const DOMAIN_METADATA: Record<ScanDomain, DomainMetadata> = {
  GOVERNANCE: {
    domain: 'GOVERNANCE',
    label: 'Governança',
    description:
      'Business Units, usuários, roles e Installed Packages. Avalia ownership, excesso de admins e packages sem uso.',
    estimatedApiCalls: 4,
    estimatedDurationSeconds: 15,
    minimumPlan: 'FREE',
    ruleCount: 4,
    scoreWeight: 0.2,
    protocol: 'SOAP',
  },
  DATA: {
    domain: 'DATA',
    label: 'Dados',
    description:
      'Data Extensions, campos, retention policies e primary keys. Detecta duplicidades, naming e DEs sem governança.',
    estimatedApiCalls: 2,
    estimatedDurationSeconds: 25,
    minimumPlan: 'FREE',
    ruleCount: 5,
    scoreWeight: 0.2,
    protocol: 'SOAP',
  },
  JOURNEY: {
    domain: 'JOURNEY',
    label: 'Jornadas',
    description:
      'Journeys ativas, pausadas e drafts. Identifica conteúdo obsoleto e artefatos esquecidos.',
    estimatedApiCalls: 3,
    estimatedDurationSeconds: 10,
    minimumPlan: 'FREE',
    ruleCount: 3,
    scoreWeight: 0.15,
    protocol: 'REST',
  },
  AUTOMATION: {
    domain: 'AUTOMATION',
    label: 'Automações',
    description:
      'Automations com status, schedules e histórico de execução. Detecta falhas silenciosas e processos órfãos.',
    estimatedApiCalls: 3,
    estimatedDurationSeconds: 10,
    minimumPlan: 'FREE',
    ruleCount: 4,
    scoreWeight: 0.15,
    protocol: 'REST',
  },
  EMAIL: {
    domain: 'EMAIL',
    label: 'Email Setup',
    description:
      'Send Classifications, Delivery Profiles, Send Definitions e Triggered Sends. Identifica configurações incompletas.',
    estimatedApiCalls: 4,
    estimatedDurationSeconds: 20,
    minimumPlan: 'PRO',
    ruleCount: 3,
    scoreWeight: 0.15,
    protocol: 'SOAP',
  },
  SECURITY: {
    domain: 'SECURITY',
    label: 'Segurança',
    description:
      'Installed Packages e scopes. Detecta escopos excessivos, ausência de rotação e combinações perigosas.',
    estimatedApiCalls: 1,
    estimatedDurationSeconds: 8,
    minimumPlan: 'PRO',
    ruleCount: 3,
    scoreWeight: 0.15,
    protocol: 'SOAP',
  },
};

/** Retorna metadados de todos os domínios, ordenados pelo label. */
export function listDomains(): DomainMetadata[] {
  return Object.values(DOMAIN_METADATA).sort((a, b) => a.label.localeCompare(b.label));
}

/** Valida um array de domínios solicitados no scan. */
export function validateDomains(domains: ScanDomain[]): void {
  if (!domains || domains.length === 0) {
    throw new Error('Selecione ao menos um domínio para escanear');
  }
  const known = new Set(Object.keys(DOMAIN_METADATA));
  for (const d of domains) {
    if (!known.has(d)) {
      throw new Error(`Domínio inválido: ${d}`);
    }
  }
}
